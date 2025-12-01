import json
import boto3
import base64
import os
import uuid
from datetime import datetime, timedelta, timezone
from boto3.dynamodb.conditions import Key, Attr

# ID生成ヘルパー関数をインポート
def extract_number_from_id(id_str, prefix):
    """IDから数値部分を抽出"""
    if not id_str:
        return 0
    str_id = str(id_str)
    if str_id.startswith(prefix):
        str_id = str_id[len(prefix):]
    import re
    match = re.match(r'^0*(\d+)', str_id)
    if match:
        return int(match.group(1))
    return 0

def get_max_id_number(table, prefix):
    """テーブル内の最大ID番号を取得"""
    try:
        response = table.scan(ProjectionExpression='id')
        max_num = 0
        for item in response.get('Items', []):
            num = extract_number_from_id(item.get('id', ''), prefix)
            if num > max_num:
                max_num = num
        while 'LastEvaluatedKey' in response:
            response = table.scan(
                ProjectionExpression='id',
                ExclusiveStartKey=response['LastEvaluatedKey']
            )
            for item in response.get('Items', []):
                num = extract_number_from_id(item.get('id', ''), prefix)
                if num > max_num:
                    max_num = num
        return max_num
    except Exception as e:
        print(f"Error getting max ID: {str(e)}")
        return 0

def generate_next_id(table, prefix):
    """次のIDを生成（5桁形式）"""
    max_num = get_max_id_number(table, prefix)
    next_num = max_num + 1
    return f"{prefix}{str(next_num).zfill(5)}"

def validate_worker_email(email):
    """
    従業員のメールアドレスをバリデーション
    現状は個人メールアドレスも許可（将来的には企業用メールアドレスへの移行を推奨）
    """
    if not email:
        return {'valid': False, 'message': 'メールアドレスは必須です。'}
    
    # 基本的なメールアドレス形式のチェック
    import re
    email_pattern = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
    if not re.match(email_pattern, email):
        return {
            'valid': False,
            'message': '有効なメールアドレスを入力してください。'
        }
    
    # 現状は個人メールアドレスも許可
    # 将来的には企業用メールアドレス（@misesapo.app）への移行を推奨
    return {'valid': True}

# Cognitoクライアントの初期化
cognito_client = boto3.client('cognito-idp', region_name='ap-northeast-1')
COGNITO_USER_POOL_ID = 'ap-northeast-1_EDKElIGoC'

# S3クライアントの初期化
s3_client = boto3.client('s3')

# DynamoDBリソースの初期化
dynamodb = boto3.resource('dynamodb')
ANNOUNCEMENTS_TABLE = dynamodb.Table('announcements')
REPORTS_TABLE = dynamodb.Table('staff-reports')
SCHEDULES_TABLE = dynamodb.Table('schedules')
ESTIMATES_TABLE = dynamodb.Table('estimates')
WORKERS_TABLE = dynamodb.Table('workers')
CLIENTS_TABLE = dynamodb.Table('clients')
BRANDS_TABLE = dynamodb.Table('brands')
STORES_TABLE = dynamodb.Table('stores')
ATTENDANCE_TABLE = dynamodb.Table('attendance')

# 環境変数から設定を取得
S3_BUCKET_NAME = os.environ.get('S3_BUCKET_NAME', 'misesapo-cleaning-manual-images')
S3_REGION = os.environ.get('S3_REGION', 'ap-northeast-1')
ALLOWED_ORIGINS = os.environ.get('ALLOWED_ORIGINS', '*').split(',')

# データファイルのS3キー
DATA_KEY = 'cleaning-manual/data.json'
DRAFT_KEY = 'cleaning-manual/draft.json'
SERVICES_KEY = 'services/service_items.json'
WIKI_KEY = 'wiki/wiki_entries.json'

def lambda_handler(event, context):
    """
    S3に画像をアップロード、または清掃マニュアルデータの読み書きを行うLambda関数
    """
    # CORSヘッダー
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE,OPTIONS',
        'Access-Control-Allow-Credentials': 'false',
        'Content-Type': 'application/json'
    }
    
    # OPTIONSリクエスト（プリフライト）の処理
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'message': 'OK'})
        }
    
    # パスとメソッドを取得（複数の可能性を試す）
    # API Gatewayのプロキシ統合の場合
    path = event.get('path', '') or event.get('resourcePath', '') or event.get('resource', '')
    method = event.get('httpMethod', '') or event.get('method', '')
    
    # リクエストパスを取得（リクエストパラメータから）
    if not path:
        request_context = event.get('requestContext', {})
        path = request_context.get('path', '') or request_context.get('resourcePath', '')
    
    # デバッグ: パスとメソッドをログに出力（必ず実行される）
    print(f"DEBUG: path={path}, method={method}")
    print(f"DEBUG: full event keys={list(event.keys())}")
    print(f"DEBUG: event={json.dumps(event, default=str)[:500]}")  # 最初の500文字のみ
    
    # パスを正規化（末尾のスラッシュを削除、先頭のスラッシュを保持）
    # ステージパス（/prod, /dev など）を除去
    normalized_path = path.rstrip('/') if path else ''
    if normalized_path.startswith('/prod/'):
        normalized_path = normalized_path[6:]  # '/prod/' を除去
    elif normalized_path.startswith('/dev/'):
        normalized_path = normalized_path[5:]  # '/dev/' を除去
    elif normalized_path.startswith('/stage/'):
        normalized_path = normalized_path[7:]  # '/stage/' を除去
    # 先頭にスラッシュがない場合は追加
    if normalized_path and not normalized_path.startswith('/'):
        normalized_path = '/' + normalized_path
    
    try:
        # パスに応じて処理を分岐
        if normalized_path == '/upload':
            # 画像アップロード
            return handle_image_upload(event, headers)
        elif normalized_path == '/cleaning-manual':
            # 清掃マニュアルデータの読み書き
            if method == 'GET':
                return get_cleaning_manual_data(headers, False)
            elif method == 'PUT' or method == 'POST':
                return save_cleaning_manual_data(event, headers, False)
        elif normalized_path == '/cleaning-manual/draft':
            # 下書きデータの読み書き
            if method == 'GET':
                return get_cleaning_manual_data(headers, True)
            elif method == 'PUT' or method == 'POST':
                return save_cleaning_manual_data(event, headers, True)
        elif normalized_path == '/services':
            # サービス一覧の取得・作成
            if method == 'GET':
                return get_services(headers)
            elif method == 'POST':
                return create_service(event, headers)
        elif normalized_path.startswith('/services/'):
            # サービス詳細の取得・更新・削除
            service_id = normalized_path.split('/')[-1]
            if method == 'GET':
                return get_service_detail(service_id, headers)
            elif method == 'PUT':
                return update_service(service_id, event, headers)
            elif method == 'DELETE':
                return delete_service(service_id, headers)
        elif normalized_path == '/training-videos':
            # 研修動画データの読み書き
            if method == 'GET':
                return get_training_videos_data(headers)
            elif method == 'PUT' or method == 'POST':
                return save_training_videos_data(event, headers)
        elif normalized_path == '/announcements':
            # お知らせデータの読み書き
            if method == 'GET':
                return get_announcements(headers)
            elif method == 'POST' or method == 'PUT':
                return create_announcement(event, headers)
        elif normalized_path == '/staff/reports':
            # レポートデータの読み書き
            if method == 'GET':
                return get_reports(event, headers)
            elif method == 'POST':
                return create_report(event, headers)
            elif method == 'PUT':
                return update_report(event, headers)
        elif normalized_path.startswith('/staff/reports/'):
            # レポート詳細の取得・削除
            report_id = normalized_path.split('/')[-1]
            if method == 'GET':
                return get_report_detail(report_id, event, headers)
            elif method == 'DELETE':
                return delete_report(report_id, event, headers)
        elif normalized_path == '/admin/dashboard/stats':
            # 管理ダッシュボードの統計データを取得
            if method == 'GET':
                return get_dashboard_stats(headers)
        elif normalized_path == '/wiki':
            # WIKIデータの読み書き
            if method == 'GET':
                return get_wiki_data(headers)
            elif method == 'PUT' or method == 'POST':
                return save_wiki_data(event, headers)
        elif normalized_path == '/estimates':
            # 見積もりデータの読み書き
            if method == 'GET':
                return get_estimates(event, headers)
            elif method == 'POST':
                return create_estimate(event, headers)
        elif normalized_path.startswith('/estimates/'):
            # 見積もり詳細の取得・更新・削除
            estimate_id = normalized_path.split('/')[-1]
            if method == 'GET':
                return get_estimate_detail(estimate_id, headers)
            elif method == 'PUT':
                return update_estimate(estimate_id, event, headers)
            elif method == 'DELETE':
                return delete_estimate(estimate_id, headers)
        elif normalized_path == '/schedules':
            # スケジュールデータの読み書き
            if method == 'GET':
                return get_schedules(event, headers)
            elif method == 'POST':
                return create_schedule(event, headers)
        elif normalized_path.startswith('/schedules/'):
            # スケジュール詳細の取得・更新・削除
            schedule_id = normalized_path.split('/')[-1]
            if method == 'GET':
                return get_schedule_detail(schedule_id, headers)
            elif method == 'PUT':
                return update_schedule(schedule_id, event, headers)
            elif method == 'DELETE':
                return delete_schedule(schedule_id, headers)
        elif normalized_path == '/workers':
            # ユーザー（従業員）一覧の取得・作成
            if method == 'GET':
                return get_workers(event, headers)
            elif method == 'POST':
                return create_worker(event, headers)
        elif normalized_path.startswith('/workers/'):
            # ユーザー（従業員）詳細の取得・更新・削除
            worker_id = normalized_path.split('/')[-1]
            if method == 'GET':
                return get_worker_detail(worker_id, headers)
            elif method == 'PUT':
                return update_worker(worker_id, event, headers)
            elif method == 'DELETE':
                return delete_worker(worker_id, headers)
        elif normalized_path == '/clients':
            # クライアント（お客様）一覧の取得・作成
            if method == 'GET':
                return get_clients(event, headers)
            elif method == 'POST':
                return create_client(event, headers)
        elif normalized_path.startswith('/clients/'):
            # クライアント（お客様）詳細の取得・更新・削除
            client_id = normalized_path.split('/')[-1]
            if method == 'GET':
                return get_client_detail(client_id, headers)
            elif method == 'PUT':
                return update_client(client_id, event, headers)
            elif method == 'DELETE':
                return delete_client(client_id, headers)
        elif normalized_path.startswith('/admin/cognito/users'):
            # Cognitoユーザー作成（管理者のみ）
            if method == 'POST':
                return create_cognito_user(event, headers)
        else:
            # デバッグ: パスが一致しなかった場合
            print(f"DEBUG: Path not matched. normalized_path={normalized_path}, original_path={path}")
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({
                    'error': 'Not found',
                    'debug': {
                        'path': path,
                        'normalized_path': normalized_path,
                        'method': method
                    }
                })
            }
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '処理に失敗しました',
                'message': str(e)
            })
        }

def handle_image_upload(event, headers):
    """
    画像をS3にアップロード
    """
    try:
        # リクエストボディを取得
        if event.get('isBase64Encoded'):
            body = base64.b64decode(event['body'])
        else:
            body = event.get('body', '')
        
        # リクエストボディがJSONの場合
        if isinstance(body, str):
            try:
                body_json = json.loads(body)
            except:
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({'error': 'Invalid JSON'})
                }
        else:
            body_json = json.loads(body.decode('utf-8'))
        
        # 画像データとメタデータを取得
        image_data = base64.b64decode(body_json.get('image'))
        file_name = body_json.get('fileName', 'image.jpg')
        content_type = body_json.get('contentType', 'image/jpeg')
        
        # ファイル名を生成（タイムスタンプ + 元のファイル名）
        timestamp = int(datetime.now().timestamp() * 1000)
        safe_file_name = file_name.replace(' ', '_').replace('/', '_')
        s3_key = f"cleaning-manual-images/{timestamp}_{safe_file_name}"
        
        # S3にアップロード
        # 注意: ACLは使用しない（バケットポリシーでパブリックアクセスを許可）
        s3_client.put_object(
            Bucket=S3_BUCKET_NAME,
            Key=s3_key,
            Body=image_data,
            ContentType=content_type
        )
        
        # S3の公開URLを生成
        s3_url = f"https://{S3_BUCKET_NAME}.s3.{S3_REGION}.amazonaws.com/{s3_key}"
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'message': '画像をS3にアップロードしました',
                'url': s3_url,
                'path': s3_url
            })
        }
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'アップロードに失敗しました',
                'message': str(e)
            })
        }

def get_cleaning_manual_data(headers, is_draft=False):
    """
    清掃マニュアルデータを取得
    """
    s3_key = DRAFT_KEY if is_draft else DATA_KEY
    
    try:
        # S3からデータを取得
        response = s3_client.get_object(
            Bucket=S3_BUCKET_NAME,
            Key=s3_key
        )
        data = json.loads(response['Body'].read().decode('utf-8'))
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(data)
        }
    except s3_client.exceptions.NoSuchKey:
        # ファイルが存在しない場合は初期データを返す
        initial_data = {
            'kitchen': [],
            'aircon': [],
            'floor': [],
            'other': []
        }
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(initial_data)
        }
    except Exception as e:
        print(f"Error reading from S3: {str(e)}")
        raise

def save_cleaning_manual_data(event, headers, is_draft=False):
    """
    清掃マニュアルデータを保存
    """
    s3_key = DRAFT_KEY if is_draft else DATA_KEY
    
    try:
        # リクエストボディを取得
        if event.get('isBase64Encoded'):
            body = base64.b64decode(event['body'])
        else:
            body = event.get('body', '')
        
        # JSONをパース
        if isinstance(body, str):
            data = json.loads(body)
        else:
            data = json.loads(body.decode('utf-8'))
        
        # メタデータを追加
        data['updatedAt'] = datetime.now().isoformat()
        data['updatedBy'] = data.get('updatedBy', 'unknown')
        
        # S3に保存
        s3_client.put_object(
            Bucket=S3_BUCKET_NAME,
            Key=s3_key,
            Body=json.dumps(data, ensure_ascii=False, indent=2),
            ContentType='application/json'
        )
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'message': 'データを保存しました',
                'isDraft': is_draft
            })
        }
    except json.JSONDecodeError as e:
        return {
            'statusCode': 400,
            'headers': headers,
            'body': json.dumps({
                'error': 'Invalid JSON',
                'message': str(e)
            })
        }
    except Exception as e:
        print(f"Error saving to S3: {str(e)}")
        raise

# ==================== WIKI管理 ====================

def get_wiki_data(headers):
    """
    WIKIデータを取得
    """
    try:
        # S3からデータを取得
        response = s3_client.get_object(
            Bucket=S3_BUCKET_NAME,
            Key=WIKI_KEY
        )
        data = json.loads(response['Body'].read().decode('utf-8'))
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(data)
        }
    except s3_client.exceptions.NoSuchKey:
        # ファイルが存在しない場合は初期データを返す
        initial_data = {
            'entries': [],
            'categories': []
        }
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(initial_data)
        }
    except Exception as e:
        print(f"Error reading WIKI data from S3: {str(e)}")
        raise

def save_wiki_data(event, headers):
    """
    WIKIデータを保存
    """
    try:
        # リクエストボディを取得
        if event.get('isBase64Encoded'):
            body = base64.b64decode(event['body'])
        else:
            body = event.get('body', '')
        
        # JSONをパース
        if isinstance(body, str):
            data = json.loads(body)
        else:
            data = json.loads(body.decode('utf-8'))
        
        # メタデータを追加
        if 'updatedAt' not in data:
            data['updatedAt'] = datetime.now().isoformat()
        
        # S3に保存
        s3_client.put_object(
            Bucket=S3_BUCKET_NAME,
            Key=WIKI_KEY,
            Body=json.dumps(data, ensure_ascii=False, indent=2),
            ContentType='application/json'
        )
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'message': 'WIKIデータを保存しました'
            })
        }
    except json.JSONDecodeError as e:
        return {
            'statusCode': 400,
            'headers': headers,
            'body': json.dumps({
                'error': 'Invalid JSON',
                'message': str(e)
            })
        }
    except Exception as e:
        print(f"Error saving WIKI data to S3: {str(e)}")
        raise

# ==================== 管理ダッシュボード統計 ====================

def get_dashboard_stats(headers):
    """
    管理ダッシュボードの統計データを取得
    """
    try:
        stats = {
            'pending_reports': 0,
            'today_schedules': 0,
            'urgent_tickets': 0,
            'total_customers': 0,
            'monthly_orders': 0,
            'monthly_revenue': 0,
            'active_staff': 0
        }
        
        # 承認待ちレポート数を取得（status='draft'のレポート）
        try:
            # status-created_at-indexを使用してdraftステータスのレポートを取得
            response = REPORTS_TABLE.query(
                IndexName='status-created_at-index',
                KeyConditionExpression=Key('status').eq('draft'),
                Select='COUNT'
            )
            stats['pending_reports'] = response.get('Count', 0)
        except Exception as e:
            print(f"Error getting pending reports: {str(e)}")
            # GSIが存在しない場合はスキャンで取得
            try:
                response = REPORTS_TABLE.scan(
                    FilterExpression=Attr('status').eq('draft'),
                    Select='COUNT'
                )
                stats['pending_reports'] = response.get('Count', 0)
            except Exception as e2:
                print(f"Error scanning pending reports: {str(e2)}")
        
        # TODO: 今日の清掃予定数を取得（スケジュールテーブルができたら実装）
        # TODO: 緊急お問い合わせ数を取得（お問い合わせテーブルができたら実装）
        # TODO: 総顧客数を取得（顧客テーブルができたら実装）
        # TODO: 今月発注数を取得（発注テーブルができたら実装）
        # TODO: 今月売上を取得（支払いテーブルができたら実装）
        # TODO: 稼働中清掃員数を取得（清掃員テーブルができたら実装）
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(stats, ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"Error getting dashboard stats: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '統計データの取得に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

# ==================== サービス管理 ====================

def get_services(headers):
    """
    サービス一覧を取得
    """
    try:
        # S3からデータを取得
        response = s3_client.get_object(
            Bucket=S3_BUCKET_NAME,
            Key=SERVICES_KEY
        )
        data = json.loads(response['Body'].read().decode('utf-8'))
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(data, ensure_ascii=False)
        }
    except s3_client.exceptions.NoSuchKey:
        # ファイルが存在しない場合は空の配列を返す
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps([], ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error reading services from S3: {str(e)}")
        raise

def get_service_detail(service_id, headers):
    """
    サービス詳細を取得
    """
    try:
        # サービス一覧を取得
        response = s3_client.get_object(
            Bucket=S3_BUCKET_NAME,
            Key=SERVICES_KEY
        )
        services = json.loads(response['Body'].read().decode('utf-8'))
        
        # サービスIDで検索
        service = None
        for s in services:
            if str(s.get('id')) == str(service_id):
                service = s
                break
        
        if not service:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({'error': 'Service not found'}, ensure_ascii=False)
            }
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(service, ensure_ascii=False)
        }
    except s3_client.exceptions.NoSuchKey:
        return {
            'statusCode': 404,
            'headers': headers,
            'body': json.dumps({'error': 'Service not found'}, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error reading service from S3: {str(e)}")
        raise

def create_service(event, headers):
    """
    サービスを作成
    """
    try:
        # リクエストボディを取得
        if event.get('isBase64Encoded'):
            body = base64.b64decode(event['body'])
        else:
            body = event.get('body', '')
        
        # JSONをパース
        if isinstance(body, str):
            service_data = json.loads(body)
        else:
            service_data = json.loads(body.decode('utf-8'))
        
        # サービス一覧を取得
        try:
            response = s3_client.get_object(
                Bucket=S3_BUCKET_NAME,
                Key=SERVICES_KEY
            )
            services = json.loads(response['Body'].read().decode('utf-8'))
        except s3_client.exceptions.NoSuchKey:
            services = []
        
        # 新しいIDを生成
        max_id = max([s.get('id', 0) for s in services], default=0)
        new_id = max_id + 1
        service_data['id'] = new_id
        
        # 新しいサービスを追加
        services.append(service_data)
        
        # S3に保存
        s3_client.put_object(
            Bucket=S3_BUCKET_NAME,
            Key=SERVICES_KEY,
            Body=json.dumps(services, ensure_ascii=False, indent=2),
            ContentType='application/json'
        )
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'id': new_id,
                'message': 'サービスを登録しました'
            }, ensure_ascii=False)
        }
    except json.JSONDecodeError as e:
        return {
            'statusCode': 400,
            'headers': headers,
            'body': json.dumps({
                'error': 'Invalid JSON',
                'message': str(e)
            }, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error creating service: {str(e)}")
        raise

def update_service(service_id, event, headers):
    """
    サービスを更新
    """
    try:
        # リクエストボディを取得
        if event.get('isBase64Encoded'):
            body = base64.b64decode(event['body'])
        else:
            body = event.get('body', '')
        
        # JSONをパース
        if isinstance(body, str):
            service_data = json.loads(body)
        else:
            service_data = json.loads(body.decode('utf-8'))
        
        # サービス一覧を取得
        response = s3_client.get_object(
            Bucket=S3_BUCKET_NAME,
            Key=SERVICES_KEY
        )
        services = json.loads(response['Body'].read().decode('utf-8'))
        
        # サービスを更新
        updated = False
        for i, service in enumerate(services):
            if str(service.get('id')) == str(service_id):
                service_data['id'] = int(service_id)
                services[i] = service_data
                updated = True
                break
        
        if not updated:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({'error': 'Service not found'}, ensure_ascii=False)
            }
        
        # S3に保存
        s3_client.put_object(
            Bucket=S3_BUCKET_NAME,
            Key=SERVICES_KEY,
            Body=json.dumps(services, ensure_ascii=False, indent=2),
            ContentType='application/json'
        )
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'id': int(service_id),
                'message': 'サービスを更新しました'
            }, ensure_ascii=False)
        }
    except s3_client.exceptions.NoSuchKey:
        return {
            'statusCode': 404,
            'headers': headers,
            'body': json.dumps({'error': 'Service not found'}, ensure_ascii=False)
        }
    except json.JSONDecodeError as e:
        return {
            'statusCode': 400,
            'headers': headers,
            'body': json.dumps({
                'error': 'Invalid JSON',
                'message': str(e)
            }, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error updating service: {str(e)}")
        raise

def delete_service(service_id, headers):
    """
    サービスを削除
    """
    try:
        # サービス一覧を取得
        response = s3_client.get_object(
            Bucket=S3_BUCKET_NAME,
            Key=SERVICES_KEY
        )
        services = json.loads(response['Body'].read().decode('utf-8'))
        
        # サービスを削除
        original_length = len(services)
        services = [s for s in services if str(s.get('id')) != str(service_id)]
        
        if len(services) == original_length:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({'error': 'Service not found'}, ensure_ascii=False)
            }
        
        # S3に保存
        s3_client.put_object(
            Bucket=S3_BUCKET_NAME,
            Key=SERVICES_KEY,
            Body=json.dumps(services, ensure_ascii=False, indent=2),
            ContentType='application/json'
        )
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'id': int(service_id),
                'message': 'サービスを削除しました'
            }, ensure_ascii=False)
        }
    except s3_client.exceptions.NoSuchKey:
        return {
            'statusCode': 404,
            'headers': headers,
            'body': json.dumps({'error': 'Service not found'}, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error deleting service: {str(e)}")
        raise

def get_training_videos_data(headers):
    """
    研修動画データを取得
    """
    try:
        # S3からデータを取得
        response = s3_client.get_object(
            Bucket=S3_BUCKET_NAME,
            Key=TRAINING_VIDEOS_KEY
        )
        
        data = json.loads(response['Body'].read().decode('utf-8'))
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(data, ensure_ascii=False)
        }
    except s3_client.exceptions.NoSuchKey:
        # ファイルが存在しない場合は空のデータを返す
        empty_data = {'categories': []}
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(empty_data, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error reading from S3: {str(e)}")
        raise

def save_training_videos_data(event, headers):
    """
    研修動画データを保存
    """
    try:
        # リクエストボディを取得
        if event.get('isBase64Encoded'):
            body = base64.b64decode(event['body'])
        else:
            body = event.get('body', '')
        
        # JSONをパース
        if isinstance(body, str):
            data = json.loads(body)
        else:
            data = json.loads(body.decode('utf-8'))
        
        # メタデータを追加
        data['updatedAt'] = datetime.now().isoformat()
        data['updatedBy'] = data.get('updatedBy', 'unknown')
        
        # S3に保存
        s3_client.put_object(
            Bucket=S3_BUCKET_NAME,
            Key=TRAINING_VIDEOS_KEY,
            Body=json.dumps(data, ensure_ascii=False, indent=2),
            ContentType='application/json'
        )
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'message': 'データを保存しました'
            })
        }
    except json.JSONDecodeError as e:
        return {
            'statusCode': 400,
            'headers': headers,
            'body': json.dumps({
                'error': 'Invalid JSON',
                'message': str(e)
            })
        }
    except Exception as e:
        print(f"Error saving to S3: {str(e)}")
        raise

def create_announcement(event, headers):
    """
    お知らせを作成してDynamoDBに保存
    """
    try:
        print(f"[DEBUG] create_announcement called. event keys: {list(event.keys())}")
        print(f"[DEBUG] event body type: {type(event.get('body'))}")
        print(f"[DEBUG] event body: {str(event.get('body'))[:200]}")
        
        # リクエストボディを取得
        if event.get('isBase64Encoded'):
            body = base64.b64decode(event['body'])
        else:
            body = event.get('body', '')
        
        print(f"[DEBUG] body after decode: {str(body)[:200]}")
        
        # JSONをパース
        if isinstance(body, str):
            body_json = json.loads(body)
        else:
            body_json = json.loads(body.decode('utf-8'))
        
        print(f"[DEBUG] body_json: {body_json}")
        
        # 現在時刻を取得
        now = datetime.utcnow().isoformat() + 'Z'
        announcement_id = str(uuid.uuid4())
        
        # DynamoDBに保存するアイテムを作成
        item = {
            'announcement_id': announcement_id,
            'published_at': now,
            'title': body_json.get('title', ''),
            'body': body_json.get('body', ''),
            'target': body_json.get('target', 'all'),  # all, customers, staff, partners
            'priority': body_json.get('priority', 'normal'),  # normal, high, critical
            'link': body_json.get('link', ''),
            'status': 'published',  # published, draft, archived
            'created_at': now,
            'updated_at': now,
        }
        
        print(f"[DEBUG] Item to save: {item}")
        print(f"[DEBUG] Table name: {ANNOUNCEMENTS_TABLE.table_name}")
        
        # DynamoDBに保存
        ANNOUNCEMENTS_TABLE.put_item(Item=item)
        
        print(f"[DEBUG] Successfully saved to DynamoDB")
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'message': 'お知らせを投稿しました',
                'id': announcement_id
            }, ensure_ascii=False)
        }
    except json.JSONDecodeError as e:
        print(f"[ERROR] JSON decode error: {str(e)}")
        import traceback
        print(f"[ERROR] Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 400,
            'headers': headers,
            'body': json.dumps({
                'error': 'Invalid JSON',
                'message': str(e)
            })
        }
    except Exception as e:
        print(f"[ERROR] Error creating announcement: {str(e)}")
        import traceback
        print(f"[ERROR] Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'お知らせの投稿に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def get_announcements(headers):
    """
    お知らせ一覧を取得（最新10件）
    """
    try:
        # GSIを使用して公開済みのお知らせを取得
        response = ANNOUNCEMENTS_TABLE.query(
            IndexName='status-published_at-index',
            KeyConditionExpression=Key('status').eq('published'),
            ScanIndexForward=False,  # 降順（新しい順）
            Limit=10
        )
        
        # DynamoDBのアイテムをJSONに変換
        items = response.get('Items', [])
        
        # 日付文字列をそのまま返す（フロントエンドで処理）
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(items, ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"Error getting announcements: {str(e)}")
        # エラー時は空配列を返す
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps([], ensure_ascii=False)
        }

# ============================================================================
# レポート機能
# ============================================================================

def verify_firebase_token(id_token):
    """
    Firebase ID Tokenを検証（簡易版）
    注意: 本番環境では、Firebase Admin SDKを使用して検証することを推奨
    """
    # TODO: Firebase Admin SDKを使用した検証を実装
    # 現状は簡易的にトークンの存在のみをチェック
    if not id_token:
        return {'verified': False, 'error': 'No token provided'}
    
    # 簡易検証（本番ではFirebase Admin SDKを使用）
    # ここでは、トークンが存在することを確認するだけ
    return {
        'verified': True,
        'uid': 'admin-uid',  # 実際にはトークンから取得
        'email': 'admin@example.com',
        'role': 'admin'  # 実際にはCustom Claimsから取得
    }

def check_admin_permission(user_info):
    """
    管理者権限をチェック
    """
    return user_info.get('role') == 'admin'

def upload_photo_to_s3(base64_image, s3_key):
    """
    Base64エンコードされた画像をS3にアップロード
    """
    try:
        # Base64をデコード（data:image/jpeg;base64, のプレフィックスを除去）
        if ',' in base64_image:
            base64_image = base64_image.split(',')[-1]
        image_data = base64.b64decode(base64_image)
        
        # S3にアップロード
        s3_client.put_object(
            Bucket=S3_BUCKET_NAME,
            Key=s3_key,
            Body=image_data,
            ContentType='image/jpeg',
            ACL='public-read'  # 公開読み取り可能
        )
        
        # 公開URLを生成
        photo_url = f"https://{S3_BUCKET_NAME}.s3.{S3_REGION}.amazonaws.com/{s3_key}"
        return photo_url
    except Exception as e:
        print(f"Error uploading photo to S3: {str(e)}")
        raise

def create_report(event, headers):
    """
    レポートを作成
    """
    try:
        # Firebase ID Tokenを取得
        auth_header = event.get('headers', {}).get('Authorization') or event.get('headers', {}).get('authorization', '')
        id_token = auth_header.replace('Bearer ', '') if auth_header else ''
        
        # トークンを検証
        user_info = verify_firebase_token(id_token)
        if not user_info.get('verified'):
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': 'Unauthorized'}, ensure_ascii=False)
            }
        
        # 管理者権限をチェック
        if not check_admin_permission(user_info):
            return {
                'statusCode': 403,
                'headers': headers,
                'body': json.dumps({'error': 'Forbidden: Admin access required'}, ensure_ascii=False)
            }
        
        # リクエストボディを取得
        if event.get('isBase64Encoded'):
            body = base64.b64decode(event['body'])
        else:
            body = event.get('body', '')
        
        if isinstance(body, str):
            body_json = json.loads(body)
        else:
            body_json = json.loads(body.decode('utf-8'))
        
        # レポートIDを生成
        report_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat() + 'Z'
        
        # 写真をS3にアップロード
        photo_urls = {}
        for item in body_json.get('work_items', []):
            item_id = item['item_id']
            photo_urls[item_id] = {
                'before': [],
                'after': []
            }
            
            # 作業前の写真
            for idx, base64_image in enumerate(item.get('photos', {}).get('before', [])):
                if base64_image:
                    photo_key = f"reports/{report_id}/{item_id}-before-{idx+1}.jpg"
                    try:
                        photo_url = upload_photo_to_s3(base64_image, photo_key)
                        photo_urls[item_id]['before'].append(photo_url)
                    except Exception as e:
                        print(f"Error uploading before photo: {str(e)}")
            
            # 作業後の写真
            for idx, base64_image in enumerate(item.get('photos', {}).get('after', [])):
                if base64_image:
                    photo_key = f"reports/{report_id}/{item_id}-after-{idx+1}.jpg"
                    try:
                        photo_url = upload_photo_to_s3(base64_image, photo_key)
                        photo_urls[item_id]['after'].append(photo_url)
                    except Exception as e:
                        print(f"Error uploading after photo: {str(e)}")
        
        # staff_idが指定されていない場合は、created_byを使用
        staff_id = body_json.get('staff_id') or user_info.get('uid', 'admin-uid')
        
        # DynamoDBに保存するアイテムを作成
        report_item = {
            'report_id': report_id,
            'created_at': now,
            'updated_at': now,
            'created_by': user_info.get('uid'),
            'created_by_name': body_json.get('created_by_name', ''),
            'created_by_email': user_info.get('email', ''),
            'staff_id': staff_id,
            'staff_name': body_json.get('staff_name', ''),
            'staff_email': body_json.get('staff_email', ''),
            'store_id': body_json['store_id'],
            'store_name': body_json['store_name'],
            'cleaning_date': body_json['cleaning_date'],
            'cleaning_start_time': body_json.get('cleaning_start_time'),
            'cleaning_end_time': body_json.get('cleaning_end_time'),
            'status': 'published',
            'work_items': body_json['work_items'],
            'location': body_json.get('location'),
            'satisfaction': {
                'rating': None,
                'comment': None,
                'commented_at': None,
                'commented_by': None
            },
            'ttl': int((datetime.utcnow().timestamp() + (365 * 5 * 24 * 60 * 60)))  # 5年後
        }
        
        # 写真URLをwork_itemsに反映
        for item in report_item['work_items']:
            item_id = item['item_id']
            if item_id in photo_urls:
                item['photos'] = photo_urls[item_id]
        
        # DynamoDBに保存
        REPORTS_TABLE.put_item(Item=report_item)
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'message': 'レポートを作成しました',
                'report_id': report_id
            }, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error creating report: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'レポートの作成に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def get_reports(event, headers):
    """
    レポート一覧を取得
    """
    try:
        # Firebase ID Tokenを取得
        auth_header = event.get('headers', {}).get('Authorization') or event.get('headers', {}).get('authorization', '')
        id_token = auth_header.replace('Bearer ', '') if auth_header else ''
        
        # トークンを検証
        user_info = verify_firebase_token(id_token)
        if not user_info.get('verified'):
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': 'Unauthorized'}, ensure_ascii=False)
            }
        
        # クエリパラメータを取得
        query_params = event.get('queryStringParameters') or {}
        limit = int(query_params.get('limit', 20))
        
        # 管理者は全レポートを取得、その他は暫定で全レポート閲覧可能
        # TODO: 店舗とユーザーの関連テーブルができたら、ユーザーは自分の店舗のみ閲覧可能にする
        
        # 全レポートをスキャン（効率化のため、将来はGSIを使用）
        response = REPORTS_TABLE.scan(Limit=limit)
        
        items = response.get('Items', [])
        
        # 日付でソート（降順）
        items.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'items': items,
                'last_key': response.get('LastEvaluatedKey'),
                'count': len(items)
            }, ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"Error getting reports: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'レポートの取得に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def get_report_detail(report_id, event, headers):
    """
    レポート詳細を取得
    """
    try:
        # Firebase ID Tokenを取得
        auth_header = event.get('headers', {}).get('Authorization') or event.get('headers', {}).get('authorization', '')
        id_token = auth_header.replace('Bearer ', '') if auth_header else ''
        
        # トークンを検証
        user_info = verify_firebase_token(id_token)
        if not user_info.get('verified'):
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': 'Unauthorized'}, ensure_ascii=False)
            }
        
        # DynamoDBからレポートを取得（スキャンを使用）
        # 注意: テーブルにソートキー（created_at）がある場合、スキャンを使用
        # または、テーブルスキーマを変更してreport_idのみをパーティションキーにする
        # スキャン操作ではFilterExpressionにAttrを使用
        print(f"DEBUG: Getting report with ID: {report_id}")
        try:
            # ページネーションに対応してスキャンを実行
            items = []
            last_evaluated_key = None
            
            while True:
                scan_kwargs = {
                    'FilterExpression': Attr('report_id').eq(report_id),
                    'Limit': 10
                }
                if last_evaluated_key:
                    scan_kwargs['ExclusiveStartKey'] = last_evaluated_key
                
                response = REPORTS_TABLE.scan(**scan_kwargs)
                print(f"DEBUG: Scan response: Items={len(response.get('Items', []))}, ScannedCount={response.get('ScannedCount', 0)}")
                
                items.extend(response.get('Items', []))
                
                # 見つかったら終了
                if items:
                    break
                
                # ページネーションが続くか確認
                last_evaluated_key = response.get('LastEvaluatedKey')
                if not last_evaluated_key:
                    break
            
            print(f"DEBUG: Total items found: {len(items)}")
        except Exception as e:
            print(f"DEBUG: Scan error: {str(e)}")
            import traceback
            print(f"DEBUG: Traceback: {traceback.format_exc()}")
            raise
        
        if not items:
            print(f"DEBUG: No items found for report_id: {report_id}")
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({'error': 'Report not found'}, ensure_ascii=False)
            }
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(items[0], ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"Error getting report detail: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'レポートの取得に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def update_report(event, headers):
    """
    レポートを更新（管理者のみ）
    """
    try:
        # Firebase ID Tokenを取得
        auth_header = event.get('headers', {}).get('Authorization') or event.get('headers', {}).get('authorization', '')
        id_token = auth_header.replace('Bearer ', '') if auth_header else ''
        
        # トークンを検証
        user_info = verify_firebase_token(id_token)
        if not user_info.get('verified'):
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': 'Unauthorized'}, ensure_ascii=False)
            }
        
        # 管理者権限をチェック
        if not check_admin_permission(user_info):
            return {
                'statusCode': 403,
                'headers': headers,
                'body': json.dumps({'error': 'Forbidden: Admin access required'}, ensure_ascii=False)
            }
        
        # リクエストボディを取得
        if event.get('isBase64Encoded'):
            body = base64.b64decode(event['body'])
        else:
            body = event.get('body', '')
        
        if isinstance(body, str):
            body_json = json.loads(body)
        else:
            body_json = json.loads(body.decode('utf-8'))
        
        report_id = body_json.get('report_id')
        if not report_id:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'report_id is required'}, ensure_ascii=False)
            }
        
        # 既存のレポートを取得（スキャンを使用、ページネーションに対応）
        items = []
        last_evaluated_key = None
        
        while True:
            scan_kwargs = {
                'FilterExpression': Attr('report_id').eq(report_id),
                'Limit': 10
            }
            if last_evaluated_key:
                scan_kwargs['ExclusiveStartKey'] = last_evaluated_key
            
            existing_response = REPORTS_TABLE.scan(**scan_kwargs)
            items.extend(existing_response.get('Items', []))
            
            # 見つかったら終了
            if items:
                break
            
            # ページネーションが続くか確認
            last_evaluated_key = existing_response.get('LastEvaluatedKey')
            if not last_evaluated_key:
                break
        
        if not items:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({'error': 'Report not found'}, ensure_ascii=False)
            }
        
        existing_item = items[0]
        
        # 写真をS3にアップロード（新しいBase64画像がある場合）
        photo_urls = {}
        for item in body_json.get('work_items', []):
            item_id = item['item_id']
            photo_urls[item_id] = {
                'before': [],
                'after': []
            }
            
            # 既存の写真URLを保持（Base64でないもの）
            existing_photos = item.get('photos', {})
            for photo_url in existing_photos.get('before', []):
                if not photo_url.startswith('data:image'):
                    photo_urls[item_id]['before'].append(photo_url)
            
            for photo_url in existing_photos.get('after', []):
                if not photo_url.startswith('data:image'):
                    photo_urls[item_id]['after'].append(photo_url)
            
            # 新しいBase64画像をアップロード
            for idx, photo_data in enumerate(item.get('photos', {}).get('before', [])):
                if isinstance(photo_data, str) and photo_data.startswith('data:image'):
                    photo_key = f"reports/{report_id}/{item_id}-before-{len(photo_urls[item_id]['before'])+1}.jpg"
                    try:
                        photo_url = upload_photo_to_s3(photo_data, photo_key)
                        photo_urls[item_id]['before'].append(photo_url)
                    except Exception as e:
                        print(f"Error uploading before photo: {str(e)}")
            
            for idx, photo_data in enumerate(item.get('photos', {}).get('after', [])):
                if isinstance(photo_data, str) and photo_data.startswith('data:image'):
                    photo_key = f"reports/{report_id}/{item_id}-after-{len(photo_urls[item_id]['after'])+1}.jpg"
                    try:
                        photo_url = upload_photo_to_s3(photo_data, photo_key)
                        photo_urls[item_id]['after'].append(photo_url)
                    except Exception as e:
                        print(f"Error uploading after photo: {str(e)}")
        
        # レポートを更新
        updated_item = {
            'report_id': report_id,
            'created_at': existing_item['created_at'],
            'updated_at': datetime.utcnow().isoformat() + 'Z',
            'created_by': existing_item.get('created_by'),
            'created_by_name': body_json.get('created_by_name', existing_item.get('created_by_name', '')),
            'created_by_email': existing_item.get('created_by_email'),
            'staff_id': body_json.get('staff_id', existing_item.get('staff_id')),
            'staff_name': body_json.get('staff_name', existing_item.get('staff_name')),
            'staff_email': body_json.get('staff_email', existing_item.get('staff_email')),
            'store_id': body_json.get('store_id', existing_item['store_id']),
            'store_name': body_json.get('store_name', existing_item['store_name']),
            'cleaning_date': body_json.get('cleaning_date', existing_item['cleaning_date']),
            'cleaning_start_time': body_json.get('cleaning_start_time', existing_item.get('cleaning_start_time')),
            'cleaning_end_time': body_json.get('cleaning_end_time', existing_item.get('cleaning_end_time')),
            'status': body_json.get('status', existing_item.get('status', 'published')),
            'work_items': body_json.get('work_items', existing_item['work_items']),
            'location': body_json.get('location', existing_item.get('location')),
            'satisfaction': body_json.get('satisfaction', existing_item.get('satisfaction', {})),
            'ttl': existing_item.get('ttl')
        }
        
        # 写真URLをwork_itemsに反映
        for item in updated_item['work_items']:
            item_id = item['item_id']
            if item_id in photo_urls:
                item['photos'] = photo_urls[item_id]
        
        # DynamoDBに保存
        REPORTS_TABLE.put_item(Item=updated_item)
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'message': 'レポートを更新しました',
                'report_id': report_id
            }, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error updating report: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'レポートの更新に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def delete_report(report_id, event, headers):
    """
    レポートを削除（管理者のみ）
    """
    try:
        # Firebase ID Tokenを取得
        auth_header = event.get('headers', {}).get('Authorization') or event.get('headers', {}).get('authorization', '')
        id_token = auth_header.replace('Bearer ', '') if auth_header else ''
        
        # トークンを検証
        user_info = verify_firebase_token(id_token)
        if not user_info.get('verified'):
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': 'Unauthorized'}, ensure_ascii=False)
            }
        
        # 管理者権限をチェック
        if not check_admin_permission(user_info):
            return {
                'statusCode': 403,
                'headers': headers,
                'body': json.dumps({'error': 'Forbidden: Admin access required'}, ensure_ascii=False)
            }
        
        # DynamoDBから削除
        # 注意: テーブルにソートキー（created_at）がある場合、まずアイテムを取得してから削除
        # または、テーブルスキーマを変更してreport_idのみをパーティションキーにする
        # まず、レポートを取得してcreated_atを取得（ページネーションに対応）
        items = []
        last_evaluated_key = None
        
        while True:
            scan_kwargs = {
                'FilterExpression': Attr('report_id').eq(report_id),
                'Limit': 10
            }
            if last_evaluated_key:
                scan_kwargs['ExclusiveStartKey'] = last_evaluated_key
            
            response = REPORTS_TABLE.scan(**scan_kwargs)
            items.extend(response.get('Items', []))
            
            # 見つかったら終了
            if items:
                break
            
            # ページネーションが続くか確認
            last_evaluated_key = response.get('LastEvaluatedKey')
            if not last_evaluated_key:
                break
        
        if not items:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({'error': 'Report not found'}, ensure_ascii=False)
            }
        
        item = items[0]
        # ソートキーがある場合、パーティションキーとソートキーの両方を指定
        if 'created_at' in item:
            REPORTS_TABLE.delete_item(
                Key={
                    'report_id': report_id,
                    'created_at': item['created_at']
                }
            )
        else:
            # ソートキーがない場合
            REPORTS_TABLE.delete_item(Key={'report_id': report_id})
        
        # TODO: S3の写真も削除する（オプション）
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'message': 'レポートを削除しました'
            }, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error deleting report: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'レポートの削除に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def create_schedule(event, headers):
    """
    スケジュールを作成（見積もりも同時に作成可能）
    """
    try:
        # リクエストボディを取得
        if event.get('isBase64Encoded'):
            body = base64.b64decode(event['body'])
        else:
            body = event.get('body', '')
        
        if isinstance(body, str):
            body_json = json.loads(body)
        else:
            body_json = json.loads(body.decode('utf-8'))
        
        # スケジュールIDを生成（必須）
        schedule_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat() + 'Z'
        
        # 見積もり情報が含まれている場合は、見積もりも同時に作成
        estimate_id = None
        estimate_data = body_json.get('estimate')
        if estimate_data and estimate_data.get('items') and len(estimate_data.get('items', [])) > 0:
            # 見積もりIDを生成
            estimate_id = str(uuid.uuid4())
            
            # 見積もり合計を計算
            estimate_total = estimate_data.get('total', 0)
            if estimate_total == 0:
                # 合計が指定されていない場合は計算
                estimate_total = sum(item.get('price', 0) for item in estimate_data.get('items', []))
            
            # 見積もりアイテムを作成
            estimate_item = {
                'id': estimate_id,  # パーティションキー（必須）
                'created_at': now,
                'updated_at': now,
                'store_id': body_json.get('client_id'),  # スケジュールのclient_idを使用
                'store_name': body_json.get('store_name', ''),
                'items': estimate_data.get('items', []),
                'total': estimate_total,
                'notes': estimate_data.get('notes', ''),
                'status': 'pending',  # pending: 未処理, processing: 本見積作成中, completed: 完了, rejected: 却下
                'created_by': body_json.get('created_by', 'sales'),
                'schedule_id': schedule_id  # スケジュールIDを紐付け
            }
            
            # 見積もりを保存
            ESTIMATES_TABLE.put_item(Item=estimate_item)
        
        # DynamoDBに保存するアイテムを作成
        schedule_item = {
            'id': schedule_id,  # パーティションキー（必須）
            'created_at': now,
            'updated_at': now,
            'date': body_json.get('date', ''),
            'time_slot': body_json.get('time_slot', ''),
            'order_type': body_json.get('order_type', 'regular'),
            'client_id': body_json.get('client_id'),
            'client_name': body_json.get('client_name', ''),
            'store_name': body_json.get('store_name', ''),
            'address': body_json.get('address', ''),
            'phone': body_json.get('phone', ''),
            'email': body_json.get('email', ''),
            'cleaning_items': body_json.get('cleaning_items', []),
            'notes': body_json.get('notes', ''),
            'status': body_json.get('status', 'draft'),  # draft, pending, assigned, in_progress, completed, cancelled
        }
        
        # 見積もりIDを紐付け（存在する場合）
        if estimate_id:
            schedule_item['estimate_id'] = estimate_id
        
        # GSIキーとなる属性は、値が存在する場合のみ追加（NULLは許可されない）
        assigned_to = body_json.get('assigned_to')
        if assigned_to:
            schedule_item['assigned_to'] = assigned_to
        
        created_by = body_json.get('created_by')
        if created_by:
            schedule_item['created_by'] = created_by
        
        # DynamoDBに保存
        SCHEDULES_TABLE.put_item(Item=schedule_item)
        
        response_body = {
            'status': 'success',
            'message': 'スケジュールを作成しました',
            'schedule_id': schedule_id
        }
        
        # 見積もりも作成した場合は、見積もりIDも返す
        if estimate_id:
            response_body['estimate_id'] = estimate_id
            response_body['message'] = 'スケジュールと見積もりを作成しました'
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(response_body, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error creating schedule: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'An error occurred (ValidationException) when calling the PutItem operation',
                'message': str(e)
            }, ensure_ascii=False)
        }

def get_schedules(event, headers):
    """
    スケジュール一覧を取得
    """
    try:
        # クエリパラメータからフィルタ条件を取得
        query_params = event.get('queryStringParameters') or {}
        status = query_params.get('status')
        date = query_params.get('date')
        assigned_to = query_params.get('assigned_to')
        
        # スキャンまたはクエリを実行
        if status:
            # ステータスでフィルタ（GSIを使用する場合）
            response = SCHEDULES_TABLE.scan(
                FilterExpression=Attr('status').eq(status)
            )
        elif date:
            # 日付でフィルタ
            response = SCHEDULES_TABLE.scan(
                FilterExpression=Attr('date').eq(date)
            )
        elif assigned_to:
            # 担当者でフィルタ（GSIを使用する場合）
            response = SCHEDULES_TABLE.scan(
                FilterExpression=Attr('assigned_to').eq(assigned_to)
            )
        else:
            # 全件取得
            response = SCHEDULES_TABLE.scan()
        
        schedules = response.get('Items', [])
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(schedules, ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"Error getting schedules: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'スケジュールの取得に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def get_schedule_detail(schedule_id, headers):
    """
    スケジュール詳細を取得
    """
    try:
        response = SCHEDULES_TABLE.get_item(Key={'id': schedule_id})
        
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({
                    'error': 'スケジュールが見つかりません'
                }, ensure_ascii=False)
            }
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(response['Item'], ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"Error getting schedule detail: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'スケジュールの取得に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def update_schedule(schedule_id, event, headers):
    """
    スケジュールを更新
    """
    try:
        # リクエストボディを取得
        if event.get('isBase64Encoded'):
            body = base64.b64decode(event['body'])
        else:
            body = event.get('body', '')
        
        if isinstance(body, str):
            body_json = json.loads(body)
        else:
            body_json = json.loads(body.decode('utf-8'))
        
        # 既存のスケジュールを取得
        response = SCHEDULES_TABLE.get_item(Key={'id': schedule_id})
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({
                    'error': 'スケジュールが見つかりません'
                }, ensure_ascii=False)
            }
        
        existing_item = response['Item']
        
        # 更新可能なフィールドを更新
        update_expression_parts = []
        expression_attribute_values = {}
        expression_attribute_names = {}
        
        updatable_fields = [
            'date', 'time_slot', 'order_type', 'client_id', 'client_name',
            'store_name', 'address', 'phone', 'email', 'cleaning_items',
            'notes', 'status', 'assigned_to'
        ]
        
        for field in updatable_fields:
            if field in body_json:
                update_expression_parts.append(f"#{field} = :{field}")
                expression_attribute_names[f"#{field}"] = field
                expression_attribute_values[f":{field}"] = body_json[field]
        
        # updated_atを更新
        update_expression_parts.append("#updated_at = :updated_at")
        expression_attribute_names["#updated_at"] = "updated_at"
        expression_attribute_values[":updated_at"] = datetime.utcnow().isoformat() + 'Z'
        
        if update_expression_parts:
            SCHEDULES_TABLE.update_item(
                Key={'id': schedule_id},
                UpdateExpression='SET ' + ', '.join(update_expression_parts),
                ExpressionAttributeNames=expression_attribute_names,
                ExpressionAttributeValues=expression_attribute_values
            )
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'message': 'スケジュールを更新しました'
            }, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error updating schedule: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'スケジュールの更新に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def delete_schedule(schedule_id, headers):
    """
    スケジュールを削除
    """
    try:
        SCHEDULES_TABLE.delete_item(Key={'id': schedule_id})
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'message': 'スケジュールを削除しました'
            }, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error deleting schedule: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'スケジュールの削除に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

# ==================== 見積もり関連の関数 ====================

def create_estimate(event, headers):
    """
    見積もりを作成
    """
    try:
        # リクエストボディを取得
        if event.get('isBase64Encoded'):
            body = base64.b64decode(event['body'])
        else:
            body = event.get('body', '')
        
        if isinstance(body, str):
            body_json = json.loads(body)
        else:
            body_json = json.loads(body.decode('utf-8'))
        
        # 見積もりIDを生成（必須）
        estimate_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat() + 'Z'
        
        # 見積もり合計を計算
        estimate_total = body_json.get('total', 0)
        if estimate_total == 0:
            # 合計が指定されていない場合は計算
            estimate_total = sum(item.get('price', 0) for item in body_json.get('items', []))
        
        # DynamoDBに保存するアイテムを作成
        estimate_item = {
            'id': estimate_id,  # パーティションキー（必須）
            'created_at': now,
            'updated_at': now,
            'store_id': body_json.get('store_id'),
            'store_name': body_json.get('store_name', ''),
            'items': body_json.get('items', []),
            'total': estimate_total,
            'notes': body_json.get('notes', ''),
            'status': body_json.get('status', 'pending'),  # pending: 未処理, processing: 本見積作成中, completed: 完了, rejected: 却下
            'created_by': body_json.get('created_by', 'sales'),
        }
        
        # スケジュールIDが指定されている場合は紐付け
        schedule_id = body_json.get('schedule_id')
        if schedule_id:
            estimate_item['schedule_id'] = schedule_id
        
        # DynamoDBに保存
        ESTIMATES_TABLE.put_item(Item=estimate_item)
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'message': '見積もりを作成しました',
                'id': estimate_id,
                'estimate_id': estimate_id
            }, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error creating estimate: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '見積もりの作成に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def get_estimates(event, headers):
    """
    見積もり一覧を取得
    """
    try:
        # クエリパラメータからフィルタ条件を取得
        query_params = event.get('queryStringParameters') or {}
        store_id = query_params.get('store_id')
        status = query_params.get('status')
        schedule_id = query_params.get('schedule_id')
        
        # スキャンまたはクエリを実行
        if store_id:
            # 店舗IDでフィルタ
            response = ESTIMATES_TABLE.scan(
                FilterExpression=Attr('store_id').eq(store_id)
            )
        elif status:
            # ステータスでフィルタ
            response = ESTIMATES_TABLE.scan(
                FilterExpression=Attr('status').eq(status)
            )
        elif schedule_id:
            # スケジュールIDでフィルタ
            response = ESTIMATES_TABLE.scan(
                FilterExpression=Attr('schedule_id').eq(schedule_id)
            )
        else:
            # 全件取得
            response = ESTIMATES_TABLE.scan()
        
        estimates = response.get('Items', [])
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'estimates': estimates,
                'count': len(estimates)
            }, ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"Error getting estimates: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '見積もりの取得に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def get_estimate_detail(estimate_id, headers):
    """
    見積もり詳細を取得
    """
    try:
        response = ESTIMATES_TABLE.get_item(Key={'id': estimate_id})
        
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({
                    'error': '見積もりが見つかりません'
                }, ensure_ascii=False)
            }
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'estimate': response['Item']
            }, ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"Error getting estimate detail: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '見積もりの取得に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def update_estimate(estimate_id, event, headers):
    """
    見積もりを更新
    """
    try:
        # リクエストボディを取得
        if event.get('isBase64Encoded'):
            body = base64.b64decode(event['body'])
        else:
            body = event.get('body', '')
        
        if isinstance(body, str):
            body_json = json.loads(body)
        else:
            body_json = json.loads(body.decode('utf-8'))
        
        # 既存の見積もりを取得
        response = ESTIMATES_TABLE.get_item(Key={'id': estimate_id})
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({
                    'error': '見積もりが見つかりません'
                }, ensure_ascii=False)
            }
        
        # 更新可能なフィールド
        updatable_fields = ['items', 'total', 'notes', 'status', 'store_id', 'store_name', 'schedule_id']
        
        update_expression_parts = []
        expression_attribute_names = {}
        expression_attribute_values = {}
        
        for field in updatable_fields:
            if field in body_json:
                update_expression_parts.append(f"#{field} = :{field}")
                expression_attribute_names[f"#{field}"] = field
                expression_attribute_values[f":{field}"] = body_json[field]
        
        # updated_atを更新
        update_expression_parts.append("#updated_at = :updated_at")
        expression_attribute_names["#updated_at"] = "updated_at"
        expression_attribute_values[":updated_at"] = datetime.utcnow().isoformat() + 'Z'
        
        if update_expression_parts:
            ESTIMATES_TABLE.update_item(
                Key={'id': estimate_id},
                UpdateExpression='SET ' + ', '.join(update_expression_parts),
                ExpressionAttributeNames=expression_attribute_names,
                ExpressionAttributeValues=expression_attribute_values
            )
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'message': '見積もりを更新しました'
            }, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error updating estimate: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '見積もりの更新に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def delete_estimate(estimate_id, headers):
    """
    見積もりを削除
    """
    try:
        ESTIMATES_TABLE.delete_item(Key={'id': estimate_id})
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'message': '見積もりを削除しました'
            }, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error deleting estimate: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '見積もりの削除に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

# ==================== Workers（従業員）管理 ====================

def get_workers(event, headers):
    """
    従業員一覧を取得
    """
    try:
        # クエリパラメータからフィルタ条件を取得
        query_params = event.get('queryStringParameters') or {}
        role = query_params.get('role')
        status = query_params.get('status')
        email = query_params.get('email')
        firebase_uid = query_params.get('firebase_uid')
        cognito_sub = query_params.get('cognito_sub')
        
        # スキャンまたはクエリを実行
        if cognito_sub:
            # Cognito Subでフィルタ（従業員ログイン用）
            response = WORKERS_TABLE.scan(
                FilterExpression=Attr('cognito_sub').eq(cognito_sub)
            )
        elif firebase_uid:
            # Firebase UIDでフィルタ（お客様ログイン用、後方互換性のため残す）
            response = WORKERS_TABLE.scan(
                FilterExpression=Attr('firebase_uid').eq(firebase_uid)
            )
        elif role:
            # ロールでフィルタ
            response = WORKERS_TABLE.scan(
                FilterExpression=Attr('role').eq(role)
            )
        elif status:
            # ステータスでフィルタ
            response = WORKERS_TABLE.scan(
                FilterExpression=Attr('status').eq(status)
            )
        elif email:
            # メールアドレスでフィルタ
            response = WORKERS_TABLE.scan(
                FilterExpression=Attr('email').eq(email)
            )
        else:
            # 全件取得
            response = WORKERS_TABLE.scan()
        
        workers = response.get('Items', [])
        
        # レスポンス形式を統一（items配列で返す）
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'items': workers,
                'workers': workers,  # 後方互換性のため
                'count': len(workers)
            }, ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"Error getting workers: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '従業員一覧の取得に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def get_worker_detail(worker_id, headers):
    """
    従業員詳細を取得
    """
    try:
        response = WORKERS_TABLE.get_item(Key={'id': worker_id})
        
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({
                    'error': '従業員が見つかりません'
                }, ensure_ascii=False)
            }
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(response['Item'], ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"Error getting worker detail: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '従業員詳細の取得に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

# ==================== Clients（クライアント）管理 ====================

def get_clients(event, headers):
    """
    クライアント一覧を取得
    """
    try:
        # クエリパラメータからフィルタ条件を取得
        query_params = event.get('queryStringParameters') or {}
        email = query_params.get('email')
        firebase_uid = query_params.get('firebase_uid')
        status = query_params.get('status')
        
        # スキャンまたはクエリを実行
        if firebase_uid:
            # Firebase UIDでフィルタ（クライアントログイン用）
            response = CLIENTS_TABLE.scan(
                FilterExpression=Attr('firebase_uid').eq(firebase_uid)
            )
        elif email:
            # メールアドレスでフィルタ
            response = CLIENTS_TABLE.scan(
                FilterExpression=Attr('email').eq(email)
            )
        elif status:
            # ステータスでフィルタ
            response = CLIENTS_TABLE.scan(
                FilterExpression=Attr('status').eq(status)
            )
        else:
            # 全件取得
            response = CLIENTS_TABLE.scan()
        
        clients = response.get('Items', [])
        
        # レスポンス形式を統一（items配列で返す）
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'items': clients,
                'count': len(clients)
            }, ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"Error getting clients: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'クライアント一覧の取得に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def create_client(event, headers):
    """
    クライアントを作成
    """
    try:
        # リクエストボディを取得
        if event.get('isBase64Encoded'):
            body = base64.b64decode(event['body'])
        else:
            body = event.get('body', '')
        
        if isinstance(body, str):
            body_json = json.loads(body)
        else:
            body_json = json.loads(body.decode('utf-8'))
        
        # ID生成（5桁形式: CL00001〜）
        if 'id' not in body_json or not body_json['id']:
            client_id = generate_next_id(CLIENTS_TABLE, 'CL')
        else:
            client_id = body_json['id']
        now = datetime.utcnow().isoformat() + 'Z'
        
        # デフォルト値を設定
        client_data = {
            'id': client_id,
            'firebase_uid': body_json.get('firebase_uid', ''),  # Firebase UID（必須）
            'email': body_json.get('email', ''),
            'name': body_json.get('name', ''),
            'phone': body_json.get('phone', ''),
            'company_name': body_json.get('company_name', ''),
            'store_name': body_json.get('store_name', ''),
            'role': 'customer',  # 固定
            'status': body_json.get('status', 'active'),
            'created_at': body_json.get('created_at', now),
            'updated_at': now
        }
        
        # DynamoDBに保存
        CLIENTS_TABLE.put_item(Item=client_data)
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'id': client_id,
                'message': 'クライアントを作成しました',
                'client': client_data
            }, ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"Error creating client: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'クライアントの作成に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def get_client_detail(client_id, headers):
    """
    クライアント詳細を取得
    """
    try:
        response = CLIENTS_TABLE.get_item(Key={'id': client_id})
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({
                    'error': 'クライアントが見つかりません',
                    'id': client_id
                }, ensure_ascii=False)
            }
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(response['Item'], ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"Error getting client detail: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'クライアント詳細の取得に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def update_client(client_id, event, headers):
    """
    クライアントを更新
    """
    try:
        # リクエストボディを取得
        if event.get('isBase64Encoded'):
            body = base64.b64decode(event['body'])
        else:
            body = event.get('body', '')
        
        if isinstance(body, str):
            body_json = json.loads(body)
        else:
            body_json = json.loads(body.decode('utf-8'))
        
        # 既存のクライアントを取得
        response = CLIENTS_TABLE.get_item(Key={'id': client_id})
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({
                    'error': 'クライアントが見つかりません',
                    'id': client_id
                }, ensure_ascii=False)
            }
        
        existing_item = response['Item']
        
        # 更新可能なフィールドを更新
        update_expression_parts = []
        expression_attribute_values = {}
        expression_attribute_names = {}
        
        updatable_fields = [
            'name', 'email', 'phone', 'company_name', 'store_name', 'status'
        ]
        
        for field in updatable_fields:
            if field in body_json:
                update_expression_parts.append(f"#{field} = :{field}")
                expression_attribute_names[f"#{field}"] = field
                expression_attribute_values[f":{field}"] = body_json[field]
        
        # updated_atを更新
        update_expression_parts.append("#updated_at = :updated_at")
        expression_attribute_names["#updated_at"] = "updated_at"
        expression_attribute_values[":updated_at"] = datetime.utcnow().isoformat() + 'Z'
        
        if update_expression_parts:
            update_expression = "SET " + ", ".join(update_expression_parts)
            CLIENTS_TABLE.update_item(
                Key={'id': client_id},
                UpdateExpression=update_expression,
                ExpressionAttributeNames=expression_attribute_names,
                ExpressionAttributeValues=expression_attribute_values
            )
        
        # 更新後のデータを取得
        updated_response = CLIENTS_TABLE.get_item(Key={'id': client_id})
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'message': 'クライアントを更新しました',
                'client': updated_response['Item']
            }, ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"Error updating client: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'クライアントの更新に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def delete_client(client_id, headers):
    """
    クライアントを削除
    """
    try:
        # 既存のクライアントを確認
        response = CLIENTS_TABLE.get_item(Key={'id': client_id})
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({
                    'error': 'クライアントが見つかりません',
                    'id': client_id
                }, ensure_ascii=False)
            }
        
        # 削除実行
        CLIENTS_TABLE.delete_item(Key={'id': client_id})
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'message': 'クライアントを削除しました',
                'id': client_id
            }, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error deleting client: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'クライアントの削除に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def create_cognito_user(event, headers):
    """
    AWS Cognitoにユーザーを作成（管理者のみ）
    """
    try:
        # リクエストボディを取得
        if event.get('isBase64Encoded'):
            body = base64.b64decode(event['body'])
        else:
            body = event.get('body', '')
        
        if isinstance(body, str):
            body_json = json.loads(body)
        else:
            body_json = json.loads(body.decode('utf-8'))
        
        email = body_json.get('email')
        password = body_json.get('password')
        name = body_json.get('name', '')
        role = body_json.get('role', 'staff')
        department = body_json.get('department', '')
        
        if not email or not password:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': 'メールアドレスとパスワードは必須です'
                }, ensure_ascii=False)
            }
        
        # Cognitoにユーザーを作成
        try:
            response = cognito_client.admin_create_user(
                UserPoolId=COGNITO_USER_POOL_ID,
                Username=email,
                UserAttributes=[
                    {'Name': 'email', 'Value': email},
                    {'Name': 'email_verified', 'Value': 'true'},
                    {'Name': 'custom:name', 'Value': name},
                    {'Name': 'custom:role', 'Value': role},
                    {'Name': 'custom:department', 'Value': department}
                ],
                TemporaryPassword=password,
                MessageAction='SUPPRESS'  # メール送信を抑制（管理者が通知）
            )
            
            # パスワードを永続化（一時パスワードから通常パスワードに変更）
            try:
                cognito_client.admin_set_user_password(
                    UserPoolId=COGNITO_USER_POOL_ID,
                    Username=email,
                    Password=password,
                    Permanent=True
                )
            except Exception as e:
                print(f"Warning: Could not set permanent password: {str(e)}")
                # 一時パスワードのままでも動作する
            
            user_sub = response['User']['Username']
            
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({
                    'status': 'success',
                    'message': 'Cognitoユーザーを作成しました',
                    'sub': user_sub,
                    'email': email
                }, ensure_ascii=False)
            }
        except cognito_client.exceptions.UsernameExistsException:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': 'このメールアドレスは既に使用されています'
                }, ensure_ascii=False)
            }
        except cognito_client.exceptions.InvalidPasswordException as e:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': 'パスワードが弱すぎます。8文字以上で、大文字・小文字・数字・特殊文字を含めてください'
                }, ensure_ascii=False)
            }
        except Exception as e:
            print(f"Error creating Cognito user: {str(e)}")
            return {
                'statusCode': 500,
                'headers': headers,
                'body': json.dumps({
                    'error': 'Cognitoユーザーの作成に失敗しました',
                    'message': str(e)
                }, ensure_ascii=False)
            }
    except Exception as e:
        print(f"Error in create_cognito_user: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'リクエストの処理に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def create_worker(event, headers):
    """
    従業員を作成
    """
    try:
        # リクエストボディを取得
        if event.get('isBase64Encoded'):
            body = base64.b64decode(event['body'])
        else:
            body = event.get('body', '')
        
        if isinstance(body, str):
            body_json = json.loads(body)
        else:
            body_json = json.loads(body.decode('utf-8'))
        
        # メールアドレスのバリデーション
        email = body_json.get('email', '')
        email_validation = validate_worker_email(email)
        if not email_validation['valid']:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': email_validation['message']
                }, ensure_ascii=False)
            }
        
        # ID生成（5桁形式: W00001〜）
        if 'id' not in body_json or not body_json['id']:
            worker_id = generate_next_id(WORKERS_TABLE, 'W')
        else:
            worker_id = body_json['id']
        now = datetime.utcnow().isoformat() + 'Z'
        
        # デフォルト値を設定
        worker_data = {
            'id': worker_id,
            'cognito_sub': body_json.get('cognito_sub', ''),  # Cognito User Sub（従業員用）
            'firebase_uid': body_json.get('firebase_uid', ''),  # Firebase UID（お客様用、後方互換性のため残す）
            'name': body_json.get('name', ''),
            'email': email,
            'phone': body_json.get('phone', ''),
            'role': body_json.get('role', 'staff'),
            'role_code': body_json.get('role_code', '99'),
            'department': body_json.get('department', ''),
            'status': body_json.get('status', 'active'),
            'created_at': body_json.get('created_at', now),
            'updated_at': now
        }
        
        # role_codeからroleを設定（roleが指定されていない場合）
        if not worker_data['role'] or worker_data['role'] == 'staff':
            if worker_data['role_code'] == '1':
                worker_data['role'] = 'admin'
            elif worker_data['role_code'] == '2':
                worker_data['role'] = 'sales'
            elif worker_data['role_code'] == '3':
                worker_data['role'] = 'office'
            elif worker_data['role_code'] == '4':
                worker_data['role'] = 'staff'
            elif worker_data['role_code'] == '5':
                worker_data['role'] = 'developer'
            elif worker_data['role_code'] == '6':
                worker_data['role'] = 'designer'
            elif worker_data['role_code'] == '7':
                worker_data['role'] = 'general_affairs'
            elif worker_data['role_code'] == '8':
                worker_data['role'] = 'operation'
            elif worker_data['role_code'] == '9':
                worker_data['role'] = 'contractor'
            elif worker_data['role_code'] == '10':
                worker_data['role'] = 'accounting'
            elif worker_data['role_code'] == '11':
                worker_data['role'] = 'human_resources'
            else:
                worker_data['role'] = 'staff'
        
        # DynamoDBに保存
        WORKERS_TABLE.put_item(Item=worker_data)
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'id': worker_id,
                'message': '従業員を作成しました',
                'worker': worker_data
            }, ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"Error creating worker: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '従業員の作成に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def update_worker(worker_id, event, headers):
    """
    従業員を更新
    """
    try:
        # リクエストボディを取得
        if event.get('isBase64Encoded'):
            body = base64.b64decode(event['body'])
        else:
            body = event.get('body', '')
        
        if isinstance(body, str):
            body_json = json.loads(body)
        else:
            body_json = json.loads(body.decode('utf-8'))
        
        # メールアドレスのバリデーション（メールアドレスが更新される場合）
        if 'email' in body_json:
            email = body_json.get('email', '')
            email_validation = validate_worker_email(email)
            if not email_validation['valid']:
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({
                        'error': email_validation['message']
                    }, ensure_ascii=False)
                }
        
        # 既存の従業員を取得
        response = WORKERS_TABLE.get_item(Key={'id': worker_id})
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({
                    'error': '従業員が見つかりません'
                }, ensure_ascii=False)
            }
        
        existing_item = response['Item']
        
        # 更新可能なフィールドを更新
        update_expression_parts = []
        expression_attribute_values = {}
        expression_attribute_names = {}
        
        updatable_fields = [
            'name', 'email', 'phone', 'role', 'role_code', 'department', 'status'
        ]
        
        for field in updatable_fields:
            if field in body_json:
                update_expression_parts.append(f"#{field} = :{field}")
                expression_attribute_names[f"#{field}"] = field
                expression_attribute_values[f":{field}"] = body_json[field]
        
        # updated_atを更新
        update_expression_parts.append("#updated_at = :updated_at")
        expression_attribute_names["#updated_at"] = "updated_at"
        expression_attribute_values[":updated_at"] = datetime.utcnow().isoformat() + 'Z'
        
        if update_expression_parts:
            WORKERS_TABLE.update_item(
                Key={'id': worker_id},
                UpdateExpression='SET ' + ', '.join(update_expression_parts),
                ExpressionAttributeNames=expression_attribute_names,
                ExpressionAttributeValues=expression_attribute_values
            )
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'message': '従業員を更新しました'
            }, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error updating worker: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '従業員の更新に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def get_attendance(event, headers):
    """
    勤怠記録を取得
    """
    try:
        # クエリパラメータを取得
        query_params = event.get('queryStringParameters') or {}
        staff_id = query_params.get('staff_id')
        date = query_params.get('date')
        
        if staff_id and date:
            # 特定の従業員の特定日の勤怠記録を取得
            attendance_id = f"{date}_{staff_id}"
            response = ATTENDANCE_TABLE.get_item(Key={'id': attendance_id})
            if 'Item' in response:
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps(response['Item'], ensure_ascii=False, default=str)
                }
            else:
                return {
                    'statusCode': 404,
                    'headers': headers,
                    'body': json.dumps({
                        'error': '勤怠記録が見つかりません'
                    }, ensure_ascii=False)
                }
        elif staff_id:
            # 特定の従業員の勤怠記録一覧を取得（scanでフィルタリング）
            response = ATTENDANCE_TABLE.scan(
                FilterExpression=Attr('staff_id').eq(staff_id)
            )
            items = response.get('Items', [])
            # 日付でソート
            items.sort(key=lambda x: x.get('date', ''), reverse=True)
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({
                    'items': items
                }, ensure_ascii=False, default=str)
            }
        else:
            # 全従業員の勤怠記録を取得
            response = ATTENDANCE_TABLE.scan()
            items = response.get('Items', [])
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({
                    'items': items
                }, ensure_ascii=False, default=str)
            }
    except Exception as e:
        print(f"Error getting attendance: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '勤怠記録の取得に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def create_or_update_attendance(event, headers):
    """
    勤怠記録を作成または更新
    """
    try:
        # リクエストボディを取得
        if event.get('isBase64Encoded'):
            body = base64.b64decode(event['body'])
        else:
            body = event.get('body', '')
        
        if isinstance(body, str):
            body_json = json.loads(body)
        else:
            body_json = json.loads(body.decode('utf-8'))
        
        staff_id = body_json.get('staff_id')
        date = body_json.get('date')
        clock_in = body_json.get('clock_in')
        clock_out = body_json.get('clock_out')
        
        # バリデーション
        if not staff_id or not date:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': 'staff_idとdateは必須です',
                    'code': 'VALIDATION_ERROR'
                }, ensure_ascii=False)
            }
        
        # 日付形式のバリデーション
        try:
            datetime.strptime(date, '%Y-%m-%d')
        except ValueError:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': '日付の形式が正しくありません（YYYY-MM-DD形式で指定してください）',
                    'code': 'VALIDATION_ERROR'
                }, ensure_ascii=False)
            }
        
        # 時刻のバリデーション
        now_utc = datetime.now(timezone.utc)
        now_iso = now_utc.isoformat().replace('+00:00', 'Z')
        
        if clock_in:
            try:
                clock_in_dt = datetime.fromisoformat(clock_in.replace('Z', '+00:00'))
                # 未来時刻のチェック（5分の許容範囲を設ける）
                if clock_in_dt > now_utc + timedelta(minutes=5):
                    return {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({
                            'error': '出勤時刻が未来の時刻です',
                            'code': 'VALIDATION_ERROR'
                        }, ensure_ascii=False)
                    }
            except (ValueError, AttributeError):
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({
                        'error': '出勤時刻の形式が正しくありません',
                        'code': 'VALIDATION_ERROR'
                    }, ensure_ascii=False)
                }
        
        if clock_out:
            try:
                clock_out_dt = datetime.fromisoformat(clock_out.replace('Z', '+00:00'))
                # 未来時刻のチェック（5分の許容範囲を設ける）
                if clock_out_dt > now_utc + timedelta(minutes=5):
                    return {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({
                            'error': '退勤時刻が未来の時刻です',
                            'code': 'VALIDATION_ERROR'
                        }, ensure_ascii=False)
                    }
            except (ValueError, AttributeError):
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({
                        'error': '退勤時刻の形式が正しくありません',
                        'code': 'VALIDATION_ERROR'
                    }, ensure_ascii=False)
                }
        
        # 出退勤時刻の整合性チェック
        if clock_in and clock_out:
            try:
                clock_in_dt = datetime.fromisoformat(clock_in.replace('Z', '+00:00'))
                clock_out_dt = datetime.fromisoformat(clock_out.replace('Z', '+00:00'))
                if clock_out_dt <= clock_in_dt:
                    return {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({
                            'error': '退勤時刻が出勤時刻より前です',
                            'code': 'VALIDATION_ERROR'
                        }, ensure_ascii=False)
                    }
                # 勤務時間が24時間を超える場合は警告（エラーにはしない）
                work_hours = (clock_out_dt - clock_in_dt).total_seconds() / 3600
                if work_hours > 24:
                    return {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({
                            'error': '勤務時間が24時間を超えています。時刻を確認してください',
                            'code': 'VALIDATION_ERROR'
                        }, ensure_ascii=False)
                    }
            except (ValueError, AttributeError):
                pass  # 既に個別の時刻バリデーションでエラーが返される
        
        # 勤怠記録IDを生成（日付_従業員ID）
        attendance_id = f"{date}_{staff_id}"
        
        now = datetime.utcnow().isoformat() + 'Z'
        
        # 既存の記録を取得
        existing_response = ATTENDANCE_TABLE.get_item(Key={'id': attendance_id})
        existing_item = existing_response.get('Item')
        
        # 重複記録のチェック（1日1回制限）
        if existing_item:
            # 出勤記録の重複チェック
            if clock_in and existing_item.get('clock_in'):
                # 既存の出勤時刻と新しい出勤時刻が同じ日付の場合
                existing_clock_in = existing_item.get('clock_in')
                if existing_clock_in and date == existing_item.get('date'):
                    # 既存の出勤記録がある場合、更新を許可（修正の場合）
                    # ただし、新しい出勤時刻が既存の出勤時刻より大幅に異なる場合は警告
                    try:
                        existing_clock_in_dt = datetime.fromisoformat(existing_clock_in.replace('Z', '+00:00'))
                        new_clock_in_dt = datetime.fromisoformat(clock_in.replace('Z', '+00:00'))
                        # 既存の出勤記録があり、退勤記録がない場合は更新を許可
                        if not existing_item.get('clock_out'):
                            pass  # 出勤時刻の更新を許可
                        else:
                            # 退勤済みの場合は、再出勤として別記録として扱う（IDを変更）
                            # 再出勤の場合は、新しいIDを生成（日付_従業員ID_2, _3...）
                            counter = 2
                            new_attendance_id = f"{date}_{staff_id}_{counter}"
                            while True:
                                check_response = ATTENDANCE_TABLE.get_item(Key={'id': new_attendance_id})
                                if 'Item' not in check_response:
                                    attendance_id = new_attendance_id
                                    existing_item = None  # 新規作成として扱う
                                    break
                                counter += 1
                                new_attendance_id = f"{date}_{staff_id}_{counter}"
                    except (ValueError, AttributeError):
                        pass
            
            # 退勤記録の重複チェック（existing_itemがNoneでない場合のみ）
            if existing_item and clock_out and existing_item.get('clock_out'):
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({
                        'error': '既に退勤記録があります',
                        'code': 'DUPLICATE_RECORD',
                        'existing_clock_out': existing_item.get('clock_out')
                    }, ensure_ascii=False)
                }
        
        if existing_item:
            # 既存の記録を更新
            update_expression_parts = []
            expression_attribute_values = {}
            expression_attribute_names = {}
            
            if clock_in:
                update_expression_parts.append("#clock_in = :clock_in")
                expression_attribute_names["#clock_in"] = "clock_in"
                expression_attribute_values[":clock_in"] = clock_in
            
            if clock_out:
                update_expression_parts.append("#clock_out = :clock_out")
                expression_attribute_names["#clock_out"] = "clock_out"
                expression_attribute_values[":clock_out"] = clock_out
            
            update_expression_parts.append("#updated_at = :updated_at")
            expression_attribute_names["#updated_at"] = "updated_at"
            expression_attribute_values[":updated_at"] = now
            
            ATTENDANCE_TABLE.update_item(
                Key={'id': attendance_id},
                UpdateExpression='SET ' + ', '.join(update_expression_parts),
                ExpressionAttributeNames=expression_attribute_names,
                ExpressionAttributeValues=expression_attribute_values
            )
        else:
            # 新規作成
            attendance_data = {
                'id': attendance_id,
                'staff_id': staff_id,
                'staff_name': body_json.get('staff_name', ''),
                'date': date,
                'clock_in': clock_in,
                'clock_out': clock_out,
                'created_at': now,
                'updated_at': now
            }
            ATTENDANCE_TABLE.put_item(Item=attendance_data)
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'message': '勤怠記録を保存しました'
            }, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error creating/updating attendance: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '勤怠記録の保存に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def get_attendance_detail(attendance_id, headers):
    """
    勤怠記録詳細を取得
    """
    try:
        response = ATTENDANCE_TABLE.get_item(Key={'id': attendance_id})
        if 'Item' in response:
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps(response['Item'], ensure_ascii=False, default=str)
            }
        else:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({
                    'error': '勤怠記録が見つかりません'
                }, ensure_ascii=False)
            }
    except Exception as e:
        print(f"Error getting attendance detail: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '勤怠記録の取得に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def update_attendance(attendance_id, event, headers):
    """
    勤怠記録を更新
    """
    try:
        # リクエストボディを取得
        if event.get('isBase64Encoded'):
            body = base64.b64decode(event['body'])
        else:
            body = event.get('body', '')
        
        if isinstance(body, str):
            body_json = json.loads(body)
        else:
            body_json = json.loads(body.decode('utf-8'))
        
        # 既存の記録を取得
        existing_response = ATTENDANCE_TABLE.get_item(Key={'id': attendance_id})
        if 'Item' not in existing_response:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({
                    'error': '勤怠記録が見つかりません'
                }, ensure_ascii=False)
            }
        
        # 更新可能なフィールドを更新
        update_expression_parts = []
        expression_attribute_values = {}
        expression_attribute_names = {}
        
        updatable_fields = ['clock_in', 'clock_out', 'staff_name']
        for field in updatable_fields:
            if field in body_json:
                update_expression_parts.append(f"#{field} = :{field}")
                expression_attribute_names[f"#{field}"] = field
                expression_attribute_values[f":{field}"] = body_json[field]
        
        update_expression_parts.append("#updated_at = :updated_at")
        expression_attribute_names["#updated_at"] = "updated_at"
        expression_attribute_values[":updated_at"] = datetime.utcnow().isoformat() + 'Z'
        
        if update_expression_parts:
            ATTENDANCE_TABLE.update_item(
                Key={'id': attendance_id},
                UpdateExpression='SET ' + ', '.join(update_expression_parts),
                ExpressionAttributeNames=expression_attribute_names,
                ExpressionAttributeValues=expression_attribute_values
            )
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'message': '勤怠記録を更新しました'
            }, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error updating attendance: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '勤怠記録の更新に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def delete_attendance(attendance_id, headers):
    """
    勤怠記録を削除
    """
    try:
        ATTENDANCE_TABLE.delete_item(Key={'id': attendance_id})
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'message': '勤怠記録を削除しました'
            }, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error deleting attendance: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '勤怠記録の削除に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def delete_worker(worker_id, headers):
    """
    従業員を削除
    """
    try:
        # IDを文字列として正規化
        worker_id = str(worker_id)
        print(f"Delete request for worker_id: {worker_id} (type: {type(worker_id).__name__})")
        
        # 削除前に存在確認
        # IDを文字列として正規化（数値の可能性があるため）
        worker_id_str = str(worker_id)
        print(f"Looking up worker with ID: {worker_id_str} (original: {worker_id}, type: {type(worker_id).__name__})")
        
        response = WORKERS_TABLE.get_item(Key={'id': worker_id_str})
        if 'Item' not in response:
            # 全ユーザーをスキャンしてIDを確認（デバッグ用）
            try:
                scan_response = WORKERS_TABLE.scan()
                all_items = scan_response.get('Items', [])
                all_ids = [str(item.get('id', '')) for item in all_items]
                print(f"Worker not found: {worker_id_str}")
                print(f"Total workers in DB: {len(all_items)}")
                print(f"Available worker IDs (first 20): {all_ids[:20]}")
                
                # IDが数値として保存されている可能性があるため、数値としても検索
                if worker_id_str.isdigit():
                    numeric_id = int(worker_id_str)
                    print(f"Trying numeric lookup: {numeric_id}")
                    numeric_response = WORKERS_TABLE.get_item(Key={'id': numeric_id})
                    if 'Item' in numeric_response:
                        print(f"Found worker with numeric ID: {numeric_id}")
                        # 数値IDで見つかった場合は、文字列IDで削除を試みる
                        WORKERS_TABLE.delete_item(Key={'id': numeric_id})
                        return {
                            'statusCode': 200,
                            'headers': headers,
                            'body': json.dumps({
                                'status': 'success',
                                'message': '従業員を削除しました',
                                'id': worker_id_str
                            }, ensure_ascii=False)
                        }
            except Exception as scan_error:
                print(f"Error scanning workers table: {str(scan_error)}")
                all_ids = []
            
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({
                    'error': '従業員が見つかりません',
                    'id': worker_id_str,
                    'available_ids': all_ids[:20]  # 最初の20件を返す
                }, ensure_ascii=False)
            }
        
        # 削除実行
        print(f"Deleting worker: {worker_id_str}")
        WORKERS_TABLE.delete_item(Key={'id': worker_id_str})
        print(f"Worker deleted successfully: {worker_id_str}")
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'message': '従業員を削除しました',
                'id': worker_id_str
            }, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error deleting worker: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '従業員の削除に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }
# ==================== Brands（ブランド）管理 ====================

def get_brands(event, headers):
    """
    ブランド一覧を取得
    """
    try:
        # クエリパラメータからフィルタ条件を取得
        query_params = event.get('queryStringParameters') or {}
        client_id = query_params.get('client_id')
        
        # スキャンまたはクエリを実行
        if client_id:
            # クライアントIDでフィルタ
            response = BRANDS_TABLE.scan(
                FilterExpression=Attr('client_id').eq(client_id)
            )
        else:
            # 全件取得
            response = BRANDS_TABLE.scan()
        
        brands = response.get('Items', [])
        
        # レスポンス形式を統一（items配列で返す）
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'items': brands,
                'count': len(brands)
            }, ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"Error getting brands: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'ブランド一覧の取得に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def create_brand(event, headers):
    """
    ブランドを作成
    """
    try:
        # リクエストボディを取得
        if event.get('isBase64Encoded'):
            body = base64.b64decode(event['body'])
        else:
            body = event.get('body', '')
        
        if isinstance(body, str):
            body_json = json.loads(body)
        else:
            body_json = json.loads(body.decode('utf-8'))
        
        # ID生成（5桁形式: BR00001〜）
        if 'id' not in body_json or not body_json['id']:
            brand_id = generate_next_id(BRANDS_TABLE, 'BR')
        else:
            brand_id = body_json['id']
        
        now = datetime.utcnow().isoformat() + 'Z'
        
        # デフォルト値を設定
        brand_data = {
            'id': brand_id,
            'name': body_json.get('name', ''),
            'client_id': body_json.get('client_id', ''),
            'status': body_json.get('status', 'active'),
            'created_at': body_json.get('created_at', now),
            'updated_at': now
        }
        
        # DynamoDBに保存
        BRANDS_TABLE.put_item(Item=brand_data)
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'id': brand_id,
                'message': 'ブランドを作成しました',
                'brand': brand_data
            }, ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"Error creating brand: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'ブランドの作成に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def get_brand_detail(brand_id, headers):
    """
    ブランド詳細を取得
    """
    try:
        response = BRANDS_TABLE.get_item(Key={'id': brand_id})
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({
                    'error': 'ブランドが見つかりません',
                    'id': brand_id
                }, ensure_ascii=False)
            }
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(response['Item'], ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"Error getting brand detail: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'ブランド詳細の取得に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def update_brand(brand_id, event, headers):
    """
    ブランドを更新
    """
    try:
        # リクエストボディを取得
        if event.get('isBase64Encoded'):
            body = base64.b64decode(event['body'])
        else:
            body = event.get('body', '')
        
        if isinstance(body, str):
            body_json = json.loads(body)
        else:
            body_json = json.loads(body.decode('utf-8'))
        
        # 既存データを取得
        response = BRANDS_TABLE.get_item(Key={'id': brand_id})
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({
                    'error': 'ブランドが見つかりません'
                }, ensure_ascii=False)
            }
        
        existing_item = response['Item']
        now = datetime.utcnow().isoformat() + 'Z'
        
        # 更新可能なフィールド
        updatable_fields = ['name', 'client_id', 'status']
        updated_data = existing_item.copy()
        for field in updatable_fields:
            if field in body_json:
                updated_data[field] = body_json[field]
        
        updated_data['updated_at'] = now
        
        # DynamoDBに保存
        BRANDS_TABLE.put_item(Item=updated_data)
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'message': 'ブランドを更新しました',
                'brand': updated_data
            }, ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"Error updating brand: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'ブランドの更新に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def delete_brand(brand_id, headers):
    """
    ブランドを削除
    """
    try:
        # ブランドが存在するか確認
        response = BRANDS_TABLE.get_item(Key={'id': brand_id})
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({
                    'error': 'ブランドが見つかりません'
                }, ensure_ascii=False)
            }
        
        # 削除
        BRANDS_TABLE.delete_item(Key={'id': brand_id})
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'message': 'ブランドを削除しました'
            }, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error deleting brand: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'ブランドの削除に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

# ==================== Stores（店舗）管理 ====================

def get_stores(event, headers):
    """
    店舗一覧を取得
    """
    try:
        # クエリパラメータからフィルタ条件を取得
        query_params = event.get('queryStringParameters') or {}
        client_id = query_params.get('client_id')
        brand_id = query_params.get('brand_id')
        
        # スキャンまたはクエリを実行
        if brand_id:
            # ブランドIDでフィルタ
            response = STORES_TABLE.scan(
                FilterExpression=Attr('brand_id').eq(brand_id)
            )
        elif client_id:
            # クライアントIDでフィルタ
            response = STORES_TABLE.scan(
                FilterExpression=Attr('client_id').eq(client_id)
            )
        else:
            # 全件取得
            response = STORES_TABLE.scan()
        
        stores = response.get('Items', [])
        
        # レスポンス形式を統一（items配列で返す）
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'items': stores,
                'count': len(stores)
            }, ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"Error getting stores: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '店舗一覧の取得に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def create_store(event, headers):
    """
    店舗を作成
    """
    try:
        # リクエストボディを取得
        if event.get('isBase64Encoded'):
            body = base64.b64decode(event['body'])
        else:
            body = event.get('body', '')
        
        if isinstance(body, str):
            body_json = json.loads(body)
        else:
            body_json = json.loads(body.decode('utf-8'))
        
        # ID生成（5桁形式: ST00001〜）
        if 'id' not in body_json or not body_json['id']:
            store_id = generate_next_id(STORES_TABLE, 'ST')
        else:
            store_id = body_json['id']
        
        now = datetime.utcnow().isoformat() + 'Z'
        
        # デフォルト値を設定
        store_data = {
            'id': store_id,
            'name': body_json.get('name', ''),
            'client_id': body_json.get('client_id', ''),
            'brand_id': body_json.get('brand_id', ''),
            'postcode': body_json.get('postcode', ''),
            'pref': body_json.get('pref', ''),
            'city': body_json.get('city', ''),
            'address1': body_json.get('address1', ''),
            'address2': body_json.get('address2', ''),
            'phone': body_json.get('phone', ''),
            'email': body_json.get('email', ''),
            'contact_person': body_json.get('contact_person', ''),
            'status': body_json.get('status', 'active'),
            'notes': body_json.get('notes', ''),
            'sales_notes': body_json.get('sales_notes', ''),
            'registration_type': body_json.get('registration_type', 'manual'),
            'created_at': body_json.get('created_at', now),
            'updated_at': now
        }
        
        # DynamoDBに保存
        STORES_TABLE.put_item(Item=store_data)
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'id': store_id,
                'message': '店舗を作成しました',
                'store': store_data
            }, ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"Error creating store: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '店舗の作成に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def get_store_detail(store_id, headers):
    """
    店舗詳細を取得
    """
    try:
        response = STORES_TABLE.get_item(Key={'id': store_id})
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({
                    'error': '店舗が見つかりません',
                    'id': store_id
                }, ensure_ascii=False)
            }
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(response['Item'], ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"Error getting store detail: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '店舗詳細の取得に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def update_store(store_id, event, headers):
    """
    店舗を更新
    """
    try:
        # リクエストボディを取得
        if event.get('isBase64Encoded'):
            body = base64.b64decode(event['body'])
        else:
            body = event.get('body', '')
        
        if isinstance(body, str):
            body_json = json.loads(body)
        else:
            body_json = json.loads(body.decode('utf-8'))
        
        # 既存データを取得
        response = STORES_TABLE.get_item(Key={'id': store_id})
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({
                    'error': '店舗が見つかりません'
                }, ensure_ascii=False)
            }
        
        existing_item = response['Item']
        now = datetime.utcnow().isoformat() + 'Z'
        
        # 更新可能なフィールド
        updatable_fields = [
            'name', 'client_id', 'brand_id', 'postcode', 'pref', 'city',
            'address1', 'address2', 'phone', 'email', 'contact_person',
            'status', 'notes', 'sales_notes', 'registration_type'
        ]
        updated_data = existing_item.copy()
        for field in updatable_fields:
            if field in body_json:
                updated_data[field] = body_json[field]
        
        updated_data['updated_at'] = now
        
        # DynamoDBに保存
        STORES_TABLE.put_item(Item=updated_data)
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'message': '店舗を更新しました',
                'store': updated_data
            }, ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"Error updating store: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '店舗の更新に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def delete_store(store_id, headers):
    """
    店舗を削除
    """
    try:
        # 店舗が存在するか確認
        response = STORES_TABLE.get_item(Key={'id': store_id})
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({
                    'error': '店舗が見つかりません'
                }, ensure_ascii=False)
            }
        
        # 削除
        STORES_TABLE.delete_item(Key={'id': store_id})
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'message': '店舗を削除しました'
            }, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error deleting store: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '店舗の削除に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

