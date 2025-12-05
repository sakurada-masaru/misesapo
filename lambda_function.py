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
ANNOUNCEMENTS_TABLE = dynamodb.Table('business-announcements')
ANNOUNCEMENT_READS_TABLE = dynamodb.Table('business-announcement-reads')
REPORTS_TABLE = dynamodb.Table('staff-reports')
SCHEDULES_TABLE = dynamodb.Table('schedules')
ESTIMATES_TABLE = dynamodb.Table('estimates')
WORKERS_TABLE = dynamodb.Table('workers')
CLIENTS_TABLE = dynamodb.Table('clients')
BRANDS_TABLE = dynamodb.Table('brands')
STORES_TABLE = dynamodb.Table('stores')
ATTENDANCE_TABLE = dynamodb.Table('attendance')
ATTENDANCE_ERRORS_TABLE = dynamodb.Table('attendance-errors')
ATTENDANCE_REQUESTS_TABLE = dynamodb.Table('attendance-requests')
HOLIDAYS_TABLE = dynamodb.Table('holidays')
INVENTORY_ITEMS_TABLE = dynamodb.Table('inventory-items')
INVENTORY_TRANSACTIONS_TABLE = dynamodb.Table('inventory-transactions')

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
            # レポート詳細の取得・更新・削除
            parts = normalized_path.split('/')
            if len(parts) >= 4 and parts[-1] == 'feedback':
                # /staff/reports/{report_id}/feedback - フィードバック取得
                report_id = parts[-2]
                if method == 'GET':
                    return get_report_feedback(report_id, event, headers)
            else:
                report_id = parts[-1]
            if method == 'GET':
                return get_report_detail(report_id, event, headers)
                elif method == 'PUT':
                    return update_report_by_id(report_id, event, headers)
            elif method == 'DELETE':
                return delete_report(report_id, event, headers)
        elif normalized_path.startswith('/public/reports/'):
            # 公開レポート関連（認証不要）
            parts = normalized_path.split('/')
            print(f"[DEBUG] Public reports path parts: {parts}, method: {method}")
            if len(parts) >= 4 and parts[-1] == 'feedback':
                # /public/reports/{report_id}/feedback - フィードバック送信
                report_id = parts[-2]
                print(f"[DEBUG] Feedback endpoint, report_id: {report_id}, method: {method}")
                if method == 'POST':
                    return save_report_feedback(report_id, event, headers)
                else:
                    # メソッドが一致しない場合もCORSヘッダーを返す
                    return {
                        'statusCode': 405,
                        'headers': headers,
                        'body': json.dumps({'error': 'Method not allowed'}, ensure_ascii=False)
                    }
            else:
                # /public/reports/{report_id} - 公開レポート詳細の取得
                report_id = parts[-1]
                if method == 'GET':
                    return get_public_report(report_id, headers)
                else:
                    return {
                        'statusCode': 405,
                        'headers': headers,
                        'body': json.dumps({'error': 'Method not allowed'}, ensure_ascii=False)
                    }
        elif normalized_path == '/staff/inventory/items':
            # 在庫一覧の取得・商品登録
            if method == 'GET':
                return get_inventory_items(event, headers)
            elif method == 'POST':
                return create_inventory_item(event, headers)
            else:
                return {
                    'statusCode': 405,
                    'headers': headers,
                    'body': json.dumps({'error': 'Method not allowed'}, ensure_ascii=False)
                }
        elif normalized_path.startswith('/staff/inventory/items/'):
            # 商品詳細の取得・更新・削除
            product_id = normalized_path.split('/')[-1]
            if method == 'GET':
                # 商品詳細取得（実装は後で追加）
                return {
                    'statusCode': 404,
                    'headers': headers,
                    'body': json.dumps({'error': 'Not implemented'}, ensure_ascii=False)
                }
        elif normalized_path == '/staff/inventory/out':
            # 出庫処理
            if method == 'POST':
                return process_inventory_transaction(event, headers, 'out')
        elif normalized_path == '/staff/inventory/in':
            # 入庫処理
            if method == 'POST':
                return process_inventory_transaction(event, headers, 'in')
        elif normalized_path == '/staff/inventory/transactions' or normalized_path == '/admin/inventory/transactions':
            # トランザクション履歴取得
            if method == 'GET':
                return get_inventory_transactions(event, headers)
        elif normalized_path == '/staff/report-images':
            # レポート用画像のアップロード・一覧取得
            if method == 'POST':
                return upload_report_image(event, headers)
            elif method == 'GET':
                return get_report_images(event, headers)
        elif normalized_path == '/staff/announcements':
            # 業務連絡一覧取得（清掃員向け）
            if method == 'GET':
                return get_staff_announcements(event, headers)
        elif normalized_path.startswith('/staff/announcements/') and normalized_path.endswith('/read'):
            # 業務連絡の既読マーク
            announcement_id = normalized_path.split('/')[-2]
            if method == 'POST':
                return mark_announcement_read(announcement_id, event, headers)
        elif normalized_path == '/admin/announcements':
            # 業務連絡一覧取得・作成（管理者向け）
            if method == 'GET':
                return get_admin_announcements(event, headers)
            elif method == 'POST':
                return create_announcement(event, headers)
        elif normalized_path.startswith('/admin/announcements/'):
            # 業務連絡詳細取得・更新・削除（管理者向け）
            announcement_id = normalized_path.split('/')[-1]
            if method == 'GET':
                return get_announcement_detail(announcement_id, event, headers)
            elif method == 'PUT':
                return update_announcement(announcement_id, event, headers)
            elif method == 'DELETE':
                return delete_announcement(announcement_id, event, headers)
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
        elif normalized_path == '/attendance/errors':
            # 出退勤エラーログの取得
            if method == 'GET':
                return get_attendance_errors(event, headers)
        elif normalized_path == '/attendance/requests':
            # 出退勤修正申請の取得・作成
            if method == 'GET':
                return get_attendance_requests(event, headers)
            elif method == 'POST':
                return create_attendance_request(event, headers)
        elif normalized_path.startswith('/attendance/requests/'):
            # 出退勤修正申請の詳細・更新・削除
            request_id = normalized_path.split('/')[-1]
            if method == 'GET':
                return get_attendance_request_detail(request_id, headers)
            elif method == 'PUT':
                return update_attendance_request(request_id, event, headers)
            elif method == 'DELETE':
                return delete_attendance_request(request_id, headers)
        elif normalized_path == '/attendance':
            # 出退勤記録の取得・作成・更新
            if method == 'GET':
                return get_attendance(event, headers)
            elif method == 'POST':
                return create_or_update_attendance(event, headers)
        elif normalized_path.startswith('/attendance/'):
            # 出退勤記録の詳細・更新・削除
            attendance_id = normalized_path.split('/')[-1]
            if method == 'GET':
                return get_attendance_detail(attendance_id, headers)
            elif method == 'PUT':
                return create_or_update_attendance(event, headers)
        elif normalized_path == '/holidays':
            # 休日・祝日の取得・作成
            if method == 'GET':
                return get_holidays(event, headers)
            elif method == 'POST':
                return create_holiday(event, headers)
        elif normalized_path.startswith('/holidays/'):
            # 休日・祝日の詳細・更新・削除
            holiday_id = normalized_path.split('/')[-1]
            if method == 'GET':
                return get_holiday_detail(holiday_id, headers)
            elif method == 'PUT':
                return update_holiday(holiday_id, event, headers)
            elif method == 'DELETE':
                return delete_holiday(holiday_id, headers)
            elif method == 'DELETE':
                return delete_attendance(attendance_id, headers)
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
        import traceback
        error_trace = traceback.format_exc()
        print(f"Error: {str(e)}")
        print(f"Traceback: {error_trace}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '処理に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
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
    Cognito ID Tokenを検証（簡易版）
    注意: 本番環境では、適切なJWT検証ライブラリを使用して署名検証を行うことを推奨
    """
    if not id_token:
        return None
    
    try:
        # JWTトークンをデコード（署名検証なしの簡易版）
        # JWTは3つの部分（header.payload.signature）に分かれている
        parts = id_token.split('.')
        if len(parts) != 3:
            print(f"Invalid token format: expected 3 parts, got {len(parts)}")
            return None
        
        # ペイロード部分をデコード
        payload_part = parts[1]
        # Base64URLデコード（パディングを追加）
        padding = 4 - len(payload_part) % 4
        if padding != 4:
            payload_part += '=' * padding
        
        import base64
        payload_json = base64.urlsafe_b64decode(payload_part)
        payload = json.loads(payload_json)
        
        # ユーザー情報を取得
        uid = payload.get('sub') or payload.get('cognito:username', '')
        email = payload.get('email', '')
        name = payload.get('name') or payload.get('given_name', '') or email.split('@')[0] if email else ''
        
        # ロールを取得（カスタムクレームから）
        role = payload.get('custom:role') or payload.get('role', 'staff')
        
    return {
            'uid': uid,
            'cognito_sub': uid,
            'email': email,
            'name': name,
            'role': role
        }
    except Exception as e:
        print(f"Error verifying token: {str(e)}")
        # エラー時はNoneを返す（認証失敗）
        return None

def check_admin_permission(user_info):
    """
    管理者権限をチェック
    """
    return user_info.get('role') == 'admin'

def convert_to_s3_url(path):
    """
    相対パスをS3の完全URLに変換
    - /images-public/xxx.png → https://bucket.s3.region.amazonaws.com/images-public/xxx.png
    - すでにhttpで始まる場合はそのまま返す
    """
    if not path:
        return path
    
    # すでに完全なURLの場合はそのまま返す
    if path.startswith('http://') or path.startswith('https://'):
        return path
    
    # 先頭のスラッシュを除去
    clean_path = path.lstrip('/')
    
    # S3の完全URLを生成
    return f"https://{S3_BUCKET_NAME}.s3.{S3_REGION}.amazonaws.com/{clean_path}"

def upload_photo_to_s3(base64_image, s3_key):
    """
    Base64エンコードされた画像をS3にアップロード
    """
    try:
        # Base64をデコード（data:image/jpeg;base64, のプレフィックスを除去）
        if ',' in base64_image:
            base64_image = base64_image.split(',')[-1]
        image_data = base64.b64decode(base64_image)
        
        # S3にアップロード（ACLなし - バケットポリシーで公開設定）
        s3_client.put_object(
            Bucket=S3_BUCKET_NAME,
            Key=s3_key,
            Body=image_data,
            ContentType='image/jpeg'
        )
        
        # 公開URLを生成
        photo_url = f"https://{S3_BUCKET_NAME}.s3.{S3_REGION}.amazonaws.com/{s3_key}"
        return photo_url
    except Exception as e:
        print(f"Error uploading photo to S3: {str(e)}")
        raise

def upload_report_photo_with_metadata(base64_image, category, cleaning_date, staff_id=None):
    """
    レポート用画像を日付単位でS3に保存し、メタデータをDynamoDBに保存
    
    Args:
        base64_image: Base64エンコードされた画像
        category: 'before' または 'after'
        cleaning_date: 清掃日 (YYYY-MM-DD形式)
        staff_id: 清掃員ID（オプション）
    
    Returns:
        dict: { image_id, url, category, date }
    """
    try:
        # 画像IDを生成（ユニークなUUID）
        image_id = str(uuid.uuid4())[:8]
        
        # 日付をパース
        date_parts = cleaning_date.split('-')
        year = date_parts[0]
        month = date_parts[1]
        day = date_parts[2]
        
        # S3キーを生成（日付単位のパス）
        # before/2025/12/04/abc12345.jpg
        s3_key = f"{category}/{year}/{month}/{day}/{image_id}.jpg"
        
        # S3にアップロード
        if ',' in base64_image:
            base64_image = base64_image.split(',')[-1]
        image_data = base64.b64decode(base64_image)
        
        s3_client.put_object(
            Bucket=S3_BUCKET_NAME,
            Key=s3_key,
            Body=image_data,
            ContentType='image/jpeg'
        )
        
        # 公開URLを生成
        photo_url = f"https://{S3_BUCKET_NAME}.s3.{S3_REGION}.amazonaws.com/{s3_key}"
        
        # メタデータをDynamoDBに保存
        report_images_table = dynamodb.Table('report-images')
        metadata = {
            'image_id': image_id,
            'url': photo_url,
            's3_key': s3_key,
            'category': category,
            'cleaning_date': cleaning_date,
            'staff_id': staff_id or 'unknown',
            'uploaded_at': datetime.now(timezone(timedelta(hours=9))).isoformat(),
            'used_in_reports': []  # このカラムに使用されたレポートIDを追加
        }
        report_images_table.put_item(Item=metadata)
        
        print(f"[upload_report_photo] Saved: {s3_key}")
        
        return {
            'image_id': image_id,
            'url': photo_url,
            'category': category,
            'date': cleaning_date
        }
    except Exception as e:
        print(f"Error uploading report photo: {str(e)}")
        raise

def get_report_images_by_date(cleaning_date, category=None):
    """
    日付で画像を取得
    
    Args:
        cleaning_date: 清掃日 (YYYY-MM-DD形式)
        category: 'before', 'after', または None（両方）
    
    Returns:
        list: 画像メタデータのリスト
    """
    try:
        report_images_table = dynamodb.Table('report-images')
        
        # 日付でフィルタ
        if category:
            response = report_images_table.scan(
                FilterExpression=Attr('cleaning_date').eq(cleaning_date) & Attr('category').eq(category)
            )
        else:
            response = report_images_table.scan(
                FilterExpression=Attr('cleaning_date').eq(cleaning_date)
            )
        
        images = response.get('Items', [])
        
        # uploaded_atでソート（新しい順）
        images.sort(key=lambda x: x.get('uploaded_at', ''), reverse=True)
        
        return images
    except Exception as e:
        print(f"Error getting report images: {str(e)}")
        return []

def upload_report_image(event, headers):
    """
    レポート用画像をアップロード（清掃員用API）
    
    Request Body:
        - image: Base64エンコードされた画像
        - category: 'before' または 'after'
        - cleaning_date: 清掃日 (YYYY-MM-DD形式)
    """
    try:
        body = json.loads(event.get('body', '{}'))
        
        image_data = body.get('image')
        category = body.get('category')
        cleaning_date = body.get('cleaning_date')
        staff_id = body.get('staff_id', 'unknown')
        
        # バリデーション
        if not image_data:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': '画像データが必要です'}, ensure_ascii=False)
            }
        
        if category not in ['before', 'after']:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'categoryは"before"または"after"を指定してください'}, ensure_ascii=False)
            }
        
        if not cleaning_date:
            # 清掃日が指定されていない場合は今日の日付を使用
            cleaning_date = datetime.now(timezone(timedelta(hours=9))).strftime('%Y-%m-%d')
        
        # 画像をアップロード
        result = upload_report_photo_with_metadata(image_data, category, cleaning_date, staff_id)
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'success': True,
                'image': result
            }, ensure_ascii=False)
        }
        
    except Exception as e:
        print(f"Error uploading report image: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': str(e)}, ensure_ascii=False)
        }

def get_report_images(event, headers):
    """
    レポート用画像一覧を取得（画像倉庫API）
    
    Query Parameters:
        - date: 清掃日 (YYYY-MM-DD形式)
        - category: 'before', 'after', または指定なし（両方）
    """
    try:
        # クエリパラメータを取得
        params = event.get('queryStringParameters') or {}
        cleaning_date = params.get('date')
        category = params.get('category')
        
        if not cleaning_date:
            # 日付が指定されていない場合は今日の日付を使用
            cleaning_date = datetime.now(timezone(timedelta(hours=9))).strftime('%Y-%m-%d')
        
        # 画像を取得
        images = get_report_images_by_date(cleaning_date, category)
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'date': cleaning_date,
                'category': category,
                'images': images,
                'count': len(images)
            }, ensure_ascii=False, default=str)
        }
        
    except Exception as e:
        print(f"Error getting report images: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': str(e)}, ensure_ascii=False)
        }

def create_report(event, headers):
    """
    レポートを作成（管理者・清掃員どちらも可能）
    """
    try:
        # Firebase ID Tokenを取得
        auth_header = event.get('headers', {}).get('Authorization') or event.get('headers', {}).get('authorization', '')
        id_token = auth_header.replace('Bearer ', '') if auth_header else ''
        
        # トークンを検証（清掃員もレポート作成可能）
        user_info = verify_firebase_token(id_token)
        if not user_info.get('verified'):
            # トークンがない場合でも、開発環境では許可（後で削除可能）
            if not id_token or id_token == 'dev-token':
                user_info = {
                    'verified': True,
                    'uid': 'dev-user',
                    'email': 'dev@example.com',
                    'role': 'staff'
                }
            else:
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': 'Unauthorized'}, ensure_ascii=False)
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
        print(f"[DEBUG] work_items count: {len(body_json.get('work_items', []))}")
        for item in body_json.get('work_items', []):
            item_id = item['item_id']
            print(f"[DEBUG] Processing item: {item_id}")
            print(f"[DEBUG] Item photos: {item.get('photos', {})}")
            photo_urls[item_id] = {
                'before': [],
                'after': []
            }
            
            # 作業前の写真
            before_photos = item.get('photos', {}).get('before', [])
            print(f"[DEBUG] Before photos count: {len(before_photos)}")
            base64_counter_before = 0
            for photo_data in before_photos:
                if photo_data:
                    print(f"[DEBUG] Processing before photo: {photo_data[:100] if len(str(photo_data)) > 100 else photo_data}")
                    # Base64画像の場合はS3にアップロード
                    if isinstance(photo_data, str) and photo_data.startswith('data:image'):
                        base64_counter_before += 1
                        photo_key = f"reports/{report_id}/{item_id}-before-{base64_counter_before}.jpg"
                    try:
                            photo_url = upload_photo_to_s3(photo_data, photo_key)
                        photo_urls[item_id]['before'].append(photo_url)
                            print(f"[DEBUG] Uploaded to S3: {photo_url}")
                    except Exception as e:
                        print(f"Error uploading before photo: {str(e)}")
                    else:
                        # 既に完全URLの場合はそのまま使用、そうでなければ変換
                        if isinstance(photo_data, str) and (photo_data.startswith('http://') or photo_data.startswith('https://')):
                            s3_url = photo_data
                        else:
                            s3_url = convert_to_s3_url(photo_data)
                        photo_urls[item_id]['before'].append(s3_url)
                        print(f"[DEBUG] Using S3 URL: {s3_url}")
            
            # 作業後の写真
            base64_counter_after = 0
            for photo_data in item.get('photos', {}).get('after', []):
                if photo_data:
                    print(f"[DEBUG] Processing after photo: {photo_data[:100] if len(str(photo_data)) > 100 else photo_data}")
                    # Base64画像の場合はS3にアップロード
                    if isinstance(photo_data, str) and photo_data.startswith('data:image'):
                        base64_counter_after += 1
                        photo_key = f"reports/{report_id}/{item_id}-after-{base64_counter_after}.jpg"
                    try:
                            photo_url = upload_photo_to_s3(photo_data, photo_key)
                        photo_urls[item_id]['after'].append(photo_url)
                            print(f"[DEBUG] Uploaded to S3: {photo_url}")
                    except Exception as e:
                        print(f"Error uploading after photo: {str(e)}")
                    else:
                        # 既に完全URLの場合はそのまま使用、そうでなければ変換
                        if isinstance(photo_data, str) and (photo_data.startswith('http://') or photo_data.startswith('https://')):
                            s3_url = photo_data
                        else:
                            s3_url = convert_to_s3_url(photo_data)
                        photo_urls[item_id]['after'].append(s3_url)
                        print(f"[DEBUG] Using S3 URL: {s3_url}")
        
        # staff_idが指定されていない場合は、created_byを使用
        staff_id = body_json.get('staff_id') or user_info.get('uid', 'admin-uid')
        
        # sectionsの画像をS3にアップロード
        sections = body_json.get('sections', [])
        processed_sections = []
        for section in sections:
            if section.get('section_type') == 'image':
                section_id = section.get('section_id', str(uuid.uuid4()))
                processed_section = {
                    'section_id': section_id,
                    'section_type': 'image',
                    'image_type': section.get('image_type', 'work'),
                    'photos': {
                        'before': [],
                        'after': []
                    }
                }
                
                # 作業前の写真
                base64_counter = 0
                for photo_data in section.get('photos', {}).get('before', []):
                    if photo_data:
                        if isinstance(photo_data, str) and photo_data.startswith('data:image'):
                            base64_counter += 1
                            photo_key = f"reports/{report_id}/section-{section_id}-before-{base64_counter}.jpg"
                            try:
                                photo_url = upload_photo_to_s3(photo_data, photo_key)
                                processed_section['photos']['before'].append(photo_url)
                            except Exception as e:
                                print(f"Error uploading section before photo: {str(e)}")
                        elif isinstance(photo_data, str) and (photo_data.startswith('http://') or photo_data.startswith('https://')):
                            processed_section['photos']['before'].append(photo_data)
                
                # 作業後の写真
                base64_counter = 0
                for photo_data in section.get('photos', {}).get('after', []):
                    if photo_data:
                        if isinstance(photo_data, str) and photo_data.startswith('data:image'):
                            base64_counter += 1
                            photo_key = f"reports/{report_id}/section-{section_id}-after-{base64_counter}.jpg"
                            try:
                                photo_url = upload_photo_to_s3(photo_data, photo_key)
                                processed_section['photos']['after'].append(photo_url)
                            except Exception as e:
                                print(f"Error uploading section after photo: {str(e)}")
                        elif isinstance(photo_data, str) and (photo_data.startswith('http://') or photo_data.startswith('https://')):
                            processed_section['photos']['after'].append(photo_data)
                
                processed_sections.append(processed_section)
            else:
                # コメントや作業内容セクションはそのまま追加
                processed_sections.append(section)
        
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
            'sections': processed_sections,
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
        print(f"[DEBUG] photo_urls: {json.dumps(photo_urls, default=str)}")
        for item in report_item['work_items']:
            item_id = item['item_id']
            print(f"[DEBUG] Processing work_item: {item_id}, photo_urls has key: {item_id in photo_urls}")
            if item_id in photo_urls:
                item['photos'] = photo_urls[item_id]
                print(f"[DEBUG] Set photos for {item_id}: {json.dumps(item['photos'], default=str)}")
            else:
                print(f"[DEBUG] No photos found for {item_id}")
        
        print(f"[DEBUG] Final work_items: {json.dumps(report_item['work_items'], default=str)}")
        
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
        limit = int(query_params.get('limit', 50))
        status_filter = query_params.get('status')
        staff_id_filter = query_params.get('staff_id')
        
        # 管理者は全レポートを取得、清掃員は自分のレポートのみ
        is_admin = user_info.get('role') == 'admin'
        user_uid = user_info.get('uid')
        
        # フィルター条件を構築
        filter_expressions = []
        
        # ステータスフィルター
        if status_filter:
            filter_expressions.append(Attr('status').eq(status_filter))
        
        # 清掃員の場合は自分のレポートのみ
        if not is_admin and user_uid:
            filter_expressions.append(Attr('staff_id').eq(user_uid))
        elif staff_id_filter:
            filter_expressions.append(Attr('staff_id').eq(staff_id_filter))
        
        # スキャン実行
        if filter_expressions:
            from functools import reduce
            filter_expr = reduce(lambda x, y: x & y, filter_expressions)
            response = REPORTS_TABLE.scan(
                FilterExpression=filter_expr,
                Limit=limit
            )
        else:
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

def get_public_report(report_id, headers):
    """
    公開レポート詳細を取得（認証不要）
    """
    try:
        # DynamoDBからレポートを取得（スキャンを使用）
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
            
            if items:
                break
            
            last_evaluated_key = response.get('LastEvaluatedKey')
            if not last_evaluated_key:
                break
        
        if not items:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({'error': 'Report not found'}, ensure_ascii=False)
            }
        
        # 公開用にセンシティブな情報を除外
        report = items[0]
        public_report = {
            'report_id': report.get('report_id'),
            'store_name': report.get('store_name'),
            'staff_name': report.get('staff_name'),  # 担当者氏名
            'cleaning_date': report.get('cleaning_date'),
            'cleaning_start_time': report.get('cleaning_start_time'),
            'cleaning_end_time': report.get('cleaning_end_time'),
            'work_items': report.get('work_items', []),
            'sections': report.get('sections', []),  # 画像・コメント・作業内容セクション
            'satisfaction': report.get('satisfaction', {})
        }
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'report': public_report}, ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"Error getting public report: {str(e)}")
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
        
        # staff_idの処理（空文字列の場合は既存の値を使用、それもなければNone）
        # DynamoDBのセカンダリインデックスキーには空文字列を設定できないため
        staff_id_value = body_json.get('staff_id', '')
        if staff_id_value == '':
            staff_id_value = existing_item.get('staff_id')
        if staff_id_value == '' or staff_id_value is None:
            staff_id_value = None
        
        # レポートを更新
        updated_item = {
            'report_id': report_id,
            'created_at': existing_item['created_at'],
            'updated_at': datetime.utcnow().isoformat() + 'Z',
            'created_by': existing_item.get('created_by'),
            'created_by_name': body_json.get('created_by_name', existing_item.get('created_by_name', '')),
            'created_by_email': existing_item.get('created_by_email'),
            'staff_id': staff_id_value,
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
        
        # staff_idがNoneの場合は、DynamoDBアイテムから削除（インデックスキーとして使用できないため）
        if updated_item['staff_id'] is None:
            del updated_item['staff_id']
        
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

def update_report_by_id(report_id, event, headers):
    """
    レポートを更新（IDをURLパスから取得）
    管理者は全レポートを更新可能、清掃員は自分のレポートのみ更新可能
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
        
        is_admin = user_info.get('role') == 'admin'
        user_uid = user_info.get('uid')
        
        # リクエストボディを取得
        if event.get('isBase64Encoded'):
            body = base64.b64decode(event['body'])
        else:
            body = event.get('body', '')
        
        if isinstance(body, str):
            body_json = json.loads(body)
        else:
            body_json = json.loads(body.decode('utf-8'))
        
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
        
        # staff_idの処理（空文字列の場合は既存の値を使用、それもなければNone）
        # DynamoDBのセカンダリインデックスキーには空文字列を設定できないため
        staff_id_value = body_json.get('staff_id', '')
        if staff_id_value == '':
            staff_id_value = existing_item.get('staff_id')
        if staff_id_value == '' or staff_id_value is None:
            staff_id_value = None
        
        # sectionsの画像をS3にアップロード
        sections = body_json.get('sections', existing_item.get('sections', []))
        processed_sections = []
        for section in sections:
            if section.get('section_type') == 'image':
                section_id = section.get('section_id', str(uuid.uuid4()))
                processed_section = {
                    'section_id': section_id,
                    'section_type': 'image',
                    'image_type': section.get('image_type', 'work'),
                    'photos': {
                        'before': [],
                        'after': []
                    }
                }
                
                # 作業前の写真
                base64_counter = 0
                for photo_data in section.get('photos', {}).get('before', []):
                    if photo_data:
                        if isinstance(photo_data, str) and photo_data.startswith('data:image'):
                            base64_counter += 1
                            photo_key = f"reports/{report_id}/section-{section_id}-before-{base64_counter}.jpg"
                            try:
                                photo_url = upload_photo_to_s3(photo_data, photo_key)
                                processed_section['photos']['before'].append(photo_url)
                            except Exception as e:
                                print(f"Error uploading section before photo: {str(e)}")
                        elif isinstance(photo_data, str) and (photo_data.startswith('http://') or photo_data.startswith('https://')):
                            processed_section['photos']['before'].append(photo_data)
                
                # 作業後の写真
                base64_counter = 0
                for photo_data in section.get('photos', {}).get('after', []):
                    if photo_data:
                        if isinstance(photo_data, str) and photo_data.startswith('data:image'):
                            base64_counter += 1
                            photo_key = f"reports/{report_id}/section-{section_id}-after-{base64_counter}.jpg"
                            try:
                                photo_url = upload_photo_to_s3(photo_data, photo_key)
                                processed_section['photos']['after'].append(photo_url)
                            except Exception as e:
                                print(f"Error uploading section after photo: {str(e)}")
                        elif isinstance(photo_data, str) and (photo_data.startswith('http://') or photo_data.startswith('https://')):
                            processed_section['photos']['after'].append(photo_data)
                
                processed_sections.append(processed_section)
            else:
                # コメントや作業内容セクションはそのまま追加
                processed_sections.append(section)
        
        # ステータスを取得
        old_status = existing_item.get('status', 'published')
        new_status = body_json.get('status', old_status)
        
        # 再提出フラグをチェック（revision_requestedからpendingに変更された場合）
        resubmitted = False
        if old_status == 'revision_requested' and new_status == 'pending' and not is_admin:
            # 清掃員がrevision_requestedからpendingに変更した場合、再提出フラグを設定
            resubmitted = True
        
        # レポートを更新
        updated_item = {
            'report_id': report_id,
            'created_at': existing_item['created_at'],
            'updated_at': datetime.utcnow().isoformat() + 'Z',
            'created_by': existing_item.get('created_by'),
            'created_by_name': body_json.get('created_by_name', existing_item.get('created_by_name', '')),
            'created_by_email': existing_item.get('created_by_email'),
            'staff_id': staff_id_value,
            'staff_name': body_json.get('staff_name', existing_item.get('staff_name')),
            'staff_email': body_json.get('staff_email', existing_item.get('staff_email')),
            'store_id': body_json.get('store_id', existing_item['store_id']),
            'store_name': body_json.get('store_name', existing_item['store_name']),
            'cleaning_date': body_json.get('cleaning_date', existing_item['cleaning_date']),
            'cleaning_start_time': body_json.get('cleaning_start_time', existing_item.get('cleaning_start_time')),
            'cleaning_end_time': body_json.get('cleaning_end_time', existing_item.get('cleaning_end_time')),
            'status': new_status,
            'work_items': body_json.get('work_items', existing_item['work_items']),
            'sections': processed_sections,
            'location': body_json.get('location', existing_item.get('location')),
            'satisfaction': body_json.get('satisfaction', existing_item.get('satisfaction', {})),
            'ttl': existing_item.get('ttl')
        }
        
        # 再提出フラグを設定
        if 'resubmitted' in body_json:
            # 明示的にresubmittedが指定されている場合（管理者がクリアする場合など）
            if body_json.get('resubmitted') is False:
                # フラグをクリア
                if 'resubmitted' in updated_item:
                    del updated_item['resubmitted']
                if 'resubmitted_at' in updated_item:
                    del updated_item['resubmitted_at']
            else:
                updated_item['resubmitted'] = True
                updated_item['resubmitted_at'] = datetime.utcnow().isoformat() + 'Z'
        elif resubmitted:
            # 清掃員がrevision_requestedからpendingに変更した場合
            updated_item['resubmitted'] = True
            updated_item['resubmitted_at'] = datetime.utcnow().isoformat() + 'Z'
        elif existing_item.get('resubmitted'):
            # 既存の再提出フラグを保持（管理者が確認するまで残す）
            updated_item['resubmitted'] = existing_item.get('resubmitted')
            updated_item['resubmitted_at'] = existing_item.get('resubmitted_at')
        
        # 修正コメントを保存（管理者が要修正として返す場合）
        if 'revision_comment' in body_json:
            updated_item['revision_comment'] = body_json['revision_comment']
        elif existing_item.get('revision_comment'):
            # 既存のコメントを保持（清掃員が修正した場合は削除されない）
            updated_item['revision_comment'] = existing_item['revision_comment']
        
        # staff_idがNoneの場合は、DynamoDBアイテムから削除（インデックスキーとして使用できないため）
        if updated_item['staff_id'] is None:
            del updated_item['staff_id']
        
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
            'name', 'email', 'phone', 'role', 'role_code', 'department', 'status',
            'scheduled_start_time', 'scheduled_end_time', 'scheduled_work_hours', 'work_pattern'
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
        date_from = query_params.get('date_from')
        date_to = query_params.get('date_to')
        year = query_params.get('year')
        month = query_params.get('month')
        limit = int(query_params.get('limit', 100))
        
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
        else:
            # フィルタリング条件を構築
            filter_expressions = []
            expression_attribute_values = {}
            expression_attribute_names = {}
            
            if staff_id:
                filter_expressions.append("#staff_id = :staff_id")
                expression_attribute_names["#staff_id"] = "staff_id"
                expression_attribute_values[":staff_id"] = staff_id
            
            if date_from:
                filter_expressions.append("#date >= :date_from")
                expression_attribute_names["#date"] = "date"
                expression_attribute_values[":date_from"] = date_from
            
            if date_to:
                filter_expressions.append("#date <= :date_to")
                if "#date" not in expression_attribute_names:
                    expression_attribute_names["#date"] = "date"
                expression_attribute_values[":date_to"] = date_to
            
            if year and month:
                # 月次フィルタリング
                month_start = f"{year}-{month.zfill(2)}-01"
                # 次の月の1日を計算
                next_month = int(month) + 1
                next_year = int(year)
                if next_month > 12:
                    next_month = 1
                    next_year += 1
                month_end = f"{next_year}-{str(next_month).zfill(2)}-01"
                
                filter_expressions.append("#date >= :month_start")
                filter_expressions.append("#date < :month_end")
                if "#date" not in expression_attribute_names:
                    expression_attribute_names["#date"] = "date"
                expression_attribute_values[":month_start"] = month_start
                expression_attribute_values[":month_end"] = month_end
            
            # スキャンまたはクエリを実行
            if staff_id and 'staff_id-date-index' in [idx['IndexName'] for idx in ATTENDANCE_TABLE.meta.client.describe_table(TableName='attendance').get('Table', {}).get('GlobalSecondaryIndexes', [])]:
                # GSIを使用してクエリ
                try:
                    response = ATTENDANCE_TABLE.query(
                        IndexName='staff_id-date-index',
                        KeyConditionExpression=Key('staff_id').eq(staff_id),
                        FilterExpression=' AND '.join(filter_expressions) if filter_expressions else None,
                        ExpressionAttributeNames=expression_attribute_names if expression_attribute_names else None,
                        ExpressionAttributeValues=expression_attribute_values if expression_attribute_values else None,
                        ScanIndexForward=False,
                        Limit=limit
                    )
                except Exception as e:
                    # GSIが存在しない場合はスキャンにフォールバック
                    print(f"GSI query failed, falling back to scan: {str(e)}")
                    if filter_expressions:
                        response = ATTENDANCE_TABLE.scan(
                            FilterExpression=' AND '.join(filter_expressions),
                            ExpressionAttributeNames=expression_attribute_names,
                            ExpressionAttributeValues=expression_attribute_values,
                            Limit=limit
                        )
                    else:
                        response = ATTENDANCE_TABLE.scan(Limit=limit)
            else:
                # スキャンでフィルタリング
                if filter_expressions:
                    response = ATTENDANCE_TABLE.scan(
                        FilterExpression=' AND '.join(filter_expressions),
                        ExpressionAttributeNames=expression_attribute_names,
                        ExpressionAttributeValues=expression_attribute_values,
                        Limit=limit
                    )
                else:
                    response = ATTENDANCE_TABLE.scan(Limit=limit)
            
            items = response.get('Items', [])
            # 日付でソート（新しい順）
            items.sort(key=lambda x: x.get('date', ''), reverse=True)
            
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({
                    'attendance': items,
                    'count': len(items)
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
        break_start = body_json.get('break_start')
        break_end = body_json.get('break_end')
        breaks = body_json.get('breaks', [])  # 休憩の配列
        
        # バリデーション
        if not staff_id or not date:
            error_response = {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': 'staff_idとdateは必須です',
                    'code': 'VALIDATION_ERROR'
                }, ensure_ascii=False)
            }
            log_attendance_error(staff_id or 'unknown', 'VALIDATION_ERROR', 'staff_idとdateは必須です', body_json, 400)
            return error_response
        
        # 日付形式のバリデーション
        try:
            datetime.strptime(date, '%Y-%m-%d')
        except ValueError:
            error_response = {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': '日付の形式が正しくありません（YYYY-MM-DD形式で指定してください）',
                    'code': 'VALIDATION_ERROR'
                }, ensure_ascii=False)
            }
            log_attendance_error(staff_id, 'VALIDATION_ERROR', '日付の形式が正しくありません', body_json, 400)
            return error_response
        
        # 時刻のバリデーション
        now_utc = datetime.now(timezone.utc)
        now_iso = now_utc.isoformat().replace('+00:00', 'Z')
        
        if clock_in:
            try:
                clock_in_dt = datetime.fromisoformat(clock_in.replace('Z', '+00:00'))
                # 未来時刻のチェック（5分の許容範囲を設ける）
                if clock_in_dt > now_utc + timedelta(minutes=5):
                    error_response = {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({
                            'error': '出勤時刻が未来の時刻です',
                            'code': 'VALIDATION_ERROR'
                        }, ensure_ascii=False)
                    }
                    log_attendance_error(staff_id, 'VALIDATION_ERROR', '出勤時刻が未来の時刻です', body_json, 400)
                    return error_response
            except (ValueError, AttributeError):
                error_response = {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({
                        'error': '出勤時刻の形式が正しくありません',
                        'code': 'VALIDATION_ERROR'
                    }, ensure_ascii=False)
                }
                log_attendance_error(staff_id, 'VALIDATION_ERROR', '出勤時刻の形式が正しくありません', body_json, 400)
                return error_response
        
        if clock_out:
            try:
                clock_out_dt = datetime.fromisoformat(clock_out.replace('Z', '+00:00'))
                # 未来時刻のチェック（5分の許容範囲を設ける）
                if clock_out_dt > now_utc + timedelta(minutes=5):
                    error_response = {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({
                            'error': '退勤時刻が未来の時刻です',
                            'code': 'VALIDATION_ERROR'
                        }, ensure_ascii=False)
                    }
                    log_attendance_error(staff_id, 'VALIDATION_ERROR', '退勤時刻が未来の時刻です', body_json, 400)
                    return error_response
            except (ValueError, AttributeError):
                error_response = {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({
                        'error': '退勤時刻の形式が正しくありません',
                        'code': 'VALIDATION_ERROR'
                    }, ensure_ascii=False)
                }
                log_attendance_error(staff_id, 'VALIDATION_ERROR', '退勤時刻の形式が正しくありません', body_json, 400)
                return error_response
        
        # 休憩時間のバリデーション
        if break_start and break_end:
            try:
                break_start_dt = datetime.fromisoformat(break_start.replace('Z', '+00:00'))
                break_end_dt = datetime.fromisoformat(break_end.replace('Z', '+00:00'))
                if break_end_dt <= break_start_dt:
                    error_response = {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({
                            'error': '休憩終了時刻が休憩開始時刻より前です',
                            'code': 'VALIDATION_ERROR'
                        }, ensure_ascii=False)
                    }
                    log_attendance_error(staff_id, 'VALIDATION_ERROR', '休憩終了時刻が休憩開始時刻より前です', body_json, 400)
                    return error_response
                # 休憩時間が24時間を超える場合はエラー
                break_duration = (break_end_dt - break_start_dt).total_seconds() / 3600
                if break_duration > 24:
                    error_response = {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({
                            'error': '休憩時間が24時間を超えています',
                            'code': 'VALIDATION_ERROR'
                        }, ensure_ascii=False)
                    }
                    log_attendance_error(staff_id, 'VALIDATION_ERROR', '休憩時間が24時間を超えています', body_json, 400)
                    return error_response
            except (ValueError, AttributeError):
                pass
        
        # 出退勤時刻の整合性チェック
        if clock_in and clock_out:
            try:
                clock_in_dt = datetime.fromisoformat(clock_in.replace('Z', '+00:00'))
                clock_out_dt = datetime.fromisoformat(clock_out.replace('Z', '+00:00'))
                if clock_out_dt <= clock_in_dt:
                    error_response = {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({
                            'error': '退勤時刻が出勤時刻より前です',
                            'code': 'VALIDATION_ERROR'
                        }, ensure_ascii=False)
                    }
                    log_attendance_error(staff_id, 'VALIDATION_ERROR', '退勤時刻が出勤時刻より前です', body_json, 400)
                    return error_response
                # 勤務時間が24時間を超える場合は警告（エラーにはしない）
                total_hours = (clock_out_dt - clock_in_dt).total_seconds() / 3600
                if total_hours > 24:
                    error_response = {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({
                            'error': '勤務時間が24時間を超えています。時刻を確認してください',
                            'code': 'VALIDATION_ERROR'
                        }, ensure_ascii=False)
                    }
                    log_attendance_error(staff_id, 'VALIDATION_ERROR', '勤務時間が24時間を超えています', body_json, 400)
                    return error_response
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
                error_response = {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({
                        'error': '既に退勤記録があります',
                        'code': 'DUPLICATE_RECORD',
                        'existing_clock_out': existing_item.get('clock_out')
                    }, ensure_ascii=False)
                }
                log_attendance_error(staff_id, 'DUPLICATE_RECORD', '既に退勤記録があります', body_json, 400)
                return error_response
        
        # 休憩時間の処理
        existing_breaks = existing_item.get('breaks', []) if existing_item else []
        processed_breaks = []
        
        # 新しい休憩開始/終了を処理
        if break_start and break_end:
            # 新しい休憩を追加
            try:
                break_start_dt = datetime.fromisoformat(break_start.replace('Z', '+00:00'))
                break_end_dt = datetime.fromisoformat(break_end.replace('Z', '+00:00'))
                break_duration = (break_end_dt - break_start_dt).total_seconds() / 3600
                
                new_break = {
                    'break_start': break_start,
                    'break_end': break_end,
                    'break_duration': round(break_duration, 2)
                }
                processed_breaks = existing_breaks + [new_break]
            except (ValueError, AttributeError):
                processed_breaks = existing_breaks
        elif breaks:
            # breaks配列が直接指定された場合
            processed_breaks = breaks
        else:
            # 既存の休憩を保持
            processed_breaks = existing_breaks
        
        # 総休憩時間を計算
        total_break_hours = sum(b.get('break_duration', 0) for b in processed_breaks if isinstance(b, dict))
        
        # 従業員の所定労働時間を取得
        scheduled_start_time = None
        scheduled_end_time = None
        scheduled_work_hours = 8.0  # デフォルト8時間
        
        try:
            worker_response = WORKERS_TABLE.get_item(Key={'id': staff_id})
            if 'Item' in worker_response:
                worker = worker_response['Item']
                scheduled_start_time = worker.get('scheduled_start_time', '09:00')
                scheduled_end_time = worker.get('scheduled_end_time', '18:00')
                scheduled_work_hours = float(worker.get('scheduled_work_hours', 8.0))
        except Exception as e:
            print(f"Error fetching worker info: {str(e)}")
        
        # 遅刻・早退の判定
        is_late = False
        late_minutes = 0
        is_early_leave = False
        early_leave_minutes = 0
        
        if clock_in and scheduled_start_time:
            try:
                clock_in_dt = datetime.fromisoformat(clock_in.replace('Z', '+00:00'))
                # 日付部分を取得（UTC+9に変換）
                clock_in_jst = clock_in_dt + timedelta(hours=9)
                date_str = clock_in_jst.strftime('%Y-%m-%d')
                
                # 所定開始時刻を取得（JST）
                scheduled_hour, scheduled_minute = map(int, scheduled_start_time.split(':'))
                scheduled_dt_jst = datetime.strptime(f"{date_str} {scheduled_hour:02d}:{scheduled_minute:02d}", '%Y-%m-%d %H:%M')
                scheduled_dt_utc = scheduled_dt_jst - timedelta(hours=9)
                scheduled_dt_utc = scheduled_dt_utc.replace(tzinfo=timezone.utc)
                
                if clock_in_dt > scheduled_dt_utc:
                    is_late = True
                    late_minutes = int((clock_in_dt - scheduled_dt_utc).total_seconds() / 60)
            except (ValueError, AttributeError) as e:
                print(f"Error calculating late time: {str(e)}")
        
        if clock_out and scheduled_end_time:
            try:
                clock_out_dt = datetime.fromisoformat(clock_out.replace('Z', '+00:00'))
                # 日付部分を取得（UTC+9に変換）
                clock_out_jst = clock_out_dt + timedelta(hours=9)
                date_str = clock_out_jst.strftime('%Y-%m-%d')
                
                # 所定終了時刻を取得（JST）
                scheduled_hour, scheduled_minute = map(int, scheduled_end_time.split(':'))
                scheduled_dt_jst = datetime.strptime(f"{date_str} {scheduled_hour:02d}:{scheduled_minute:02d}", '%Y-%m-%d %H:%M')
                scheduled_dt_utc = scheduled_dt_jst - timedelta(hours=9)
                scheduled_dt_utc = scheduled_dt_utc.replace(tzinfo=timezone.utc)
                
                if clock_out_dt < scheduled_dt_utc:
                    is_early_leave = True
                    early_leave_minutes = int((scheduled_dt_utc - clock_out_dt).total_seconds() / 60)
            except (ValueError, AttributeError) as e:
                print(f"Error calculating early leave time: {str(e)}")
        
        # 労働時間を計算
        total_hours = 0
        work_hours = 0
        overtime_hours = 0
        
        if clock_in and clock_out:
            try:
                clock_in_dt = datetime.fromisoformat(clock_in.replace('Z', '+00:00'))
                clock_out_dt = datetime.fromisoformat(clock_out.replace('Z', '+00:00'))
                total_hours = (clock_out_dt - clock_in_dt).total_seconds() / 3600
                work_hours = max(0, total_hours - total_break_hours)
                # 残業時間（所定労働時間超過分）
                overtime_hours = max(0, work_hours - scheduled_work_hours)
            except (ValueError, AttributeError):
                pass
        
        # 休日判定
        is_holiday = False
        is_holiday_work = False
        
        try:
            # 日付で休日を検索
            holiday_response = HOLIDAYS_TABLE.query(
                IndexName='date-index',
                KeyConditionExpression=Key('date').eq(date)
            )
            if holiday_response.get('Items'):
                is_holiday = True
                # 出退勤記録がある場合は休日出勤
                if clock_in:
                    is_holiday_work = True
        except Exception as e:
            print(f"Error checking holiday: {str(e)}")
        
        # 勤務状態を判定
        status = 'working'
        if clock_in and clock_out:
            status = 'completed'
        elif clock_in:
            status = 'working'
        else:
            status = 'absent'
        
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
            
            if processed_breaks:
                update_expression_parts.append("#breaks = :breaks")
                expression_attribute_names["#breaks"] = "breaks"
                expression_attribute_values[":breaks"] = processed_breaks
            
            if total_break_hours > 0:
                update_expression_parts.append("#break_time = :break_time")
                expression_attribute_names["#break_time"] = "break_time"
                expression_attribute_values[":break_time"] = round(total_break_hours, 2)
            
            if work_hours > 0:
                update_expression_parts.append("#work_hours = :work_hours")
                expression_attribute_names["#work_hours"] = "work_hours"
                expression_attribute_values[":work_hours"] = round(work_hours, 2)
            
            if total_hours > 0:
                update_expression_parts.append("#total_hours = :total_hours")
                expression_attribute_names["#total_hours"] = "total_hours"
                expression_attribute_values[":total_hours"] = round(total_hours, 2)
            
            if overtime_hours > 0:
                update_expression_parts.append("#overtime_hours = :overtime_hours")
                expression_attribute_names["#overtime_hours"] = "overtime_hours"
                expression_attribute_values[":overtime_hours"] = round(overtime_hours, 2)
            
            if is_late:
                update_expression_parts.append("#is_late = :is_late")
                update_expression_parts.append("#late_minutes = :late_minutes")
                expression_attribute_names["#is_late"] = "is_late"
                expression_attribute_names["#late_minutes"] = "late_minutes"
                expression_attribute_values[":is_late"] = True
                expression_attribute_values[":late_minutes"] = late_minutes
            
            if is_early_leave:
                update_expression_parts.append("#is_early_leave = :is_early_leave")
                update_expression_parts.append("#early_leave_minutes = :early_leave_minutes")
                expression_attribute_names["#is_early_leave"] = "is_early_leave"
                expression_attribute_names["#early_leave_minutes"] = "early_leave_minutes"
                expression_attribute_values[":is_early_leave"] = True
                expression_attribute_values[":early_leave_minutes"] = early_leave_minutes
            
            if is_holiday:
                update_expression_parts.append("#is_holiday = :is_holiday")
                expression_attribute_names["#is_holiday"] = "is_holiday"
                expression_attribute_values[":is_holiday"] = True
            
            if is_holiday_work:
                update_expression_parts.append("#is_holiday_work = :is_holiday_work")
                expression_attribute_names["#is_holiday_work"] = "is_holiday_work"
                expression_attribute_values[":is_holiday_work"] = True
            
            update_expression_parts.append("#status = :status")
            expression_attribute_names["#status"] = "status"
            expression_attribute_values[":status"] = status
            
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
                'breaks': processed_breaks,
                'break_time': round(total_break_hours, 2) if total_break_hours > 0 else None,
                'total_hours': round(total_hours, 2) if total_hours > 0 else None,
                'work_hours': round(work_hours, 2) if work_hours > 0 else None,
                'overtime_hours': round(overtime_hours, 2) if overtime_hours > 0 else None,
                'is_late': is_late if is_late else None,
                'late_minutes': late_minutes if is_late else None,
                'is_early_leave': is_early_leave if is_early_leave else None,
                'early_leave_minutes': early_leave_minutes if is_early_leave else None,
                'is_holiday': is_holiday if is_holiday else None,
                'is_holiday_work': is_holiday_work if is_holiday_work else None,
                'status': status,
                'created_at': now,
                'updated_at': now
            }
            # Noneの値を削除
            attendance_data = {k: v for k, v in attendance_data.items() if v is not None}
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
        error_message = str(e)
        staff_id = body_json.get('staff_id', 'unknown') if 'body_json' in locals() else 'unknown'
        log_attendance_error(staff_id, 'SERVER_ERROR', error_message, body_json if 'body_json' in locals() else {}, 500)
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '勤怠記録の保存に失敗しました',
                'message': error_message
            }, ensure_ascii=False)
        }

def log_attendance_error(staff_id, error_code, error_message, request_data=None, status_code=400):
    """
    出退勤エラーをログに記録
    """
    try:
        error_id = f"{datetime.now(timezone.utc).isoformat()}_{staff_id}_{uuid.uuid4().hex[:8]}"
        error_log = {
            'id': error_id,
            'staff_id': staff_id,
            'error_code': error_code,
            'error_message': error_message,
            'status_code': status_code,
            'request_data': request_data or {},
            'created_at': datetime.now(timezone.utc).isoformat() + 'Z',
            'resolved': False
        }
        ATTENDANCE_ERRORS_TABLE.put_item(Item=error_log)
        print(f"Attendance error logged: {error_id} - {error_code}: {error_message}")
    except Exception as e:
        print(f"Error logging attendance error: {str(e)}")
        # エラーログの記録に失敗しても処理は続行

def get_attendance_errors(event, headers):
    """
    出退勤エラーログを取得
    """
    try:
        # クエリパラメータを取得
        query_params = event.get('queryStringParameters') or {}
        staff_id = query_params.get('staff_id')
        error_code = query_params.get('error_code')
        resolved = query_params.get('resolved')
        limit = int(query_params.get('limit', 50))
        
        # スキャンまたはクエリを実行
        if staff_id:
            # スタッフIDでフィルタリング
            response = ATTENDANCE_ERRORS_TABLE.query(
                IndexName='staff_id-created_at-index',
                KeyConditionExpression=Key('staff_id').eq(staff_id),
                ScanIndexForward=False,
                Limit=limit
            )
        elif error_code:
            # エラーコードでフィルタリング
            response = ATTENDANCE_ERRORS_TABLE.query(
                IndexName='error_code-created_at-index',
                KeyConditionExpression=Key('error_code').eq(error_code),
                ScanIndexForward=False,
                Limit=limit
            )
        else:
            # 全件取得（スキャン）
            response = ATTENDANCE_ERRORS_TABLE.scan(Limit=limit)
        
        items = response.get('Items', [])
        
        # resolvedフィルタリング
        if resolved is not None:
            resolved_bool = resolved.lower() == 'true'
            items = [item for item in items if item.get('resolved', False) == resolved_bool]
        
        # 日付でソート（新しい順）
        items.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'errors': items,
                'count': len(items)
            }, ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"Error getting attendance errors: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'エラーログの取得に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def create_attendance_request(event, headers):
    """
    出退勤修正申請を作成
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
        attendance_id = body_json.get('attendance_id')
        date = body_json.get('date')
        reason = body_json.get('reason', '')
        requested_clock_in = body_json.get('requested_clock_in')
        requested_clock_out = body_json.get('requested_clock_out')
        current_clock_in = body_json.get('current_clock_in')
        current_clock_out = body_json.get('current_clock_out')
        
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
        
        if not reason:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': '修正理由は必須です',
                    'code': 'VALIDATION_ERROR'
                }, ensure_ascii=False)
            }
        
        # 申請IDを生成
        request_id = f"REQ_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}_{staff_id}_{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc).isoformat() + 'Z'
        
        # 申請データを作成
        request_data = {
            'id': request_id,
            'staff_id': staff_id,
            'staff_name': body_json.get('staff_name', ''),
            'attendance_id': attendance_id,
            'date': date,
            'reason': reason,
            'current_clock_in': current_clock_in,
            'current_clock_out': current_clock_out,
            'requested_clock_in': requested_clock_in,
            'requested_clock_out': requested_clock_out,
            'status': 'pending',  # pending, approved, rejected
            'created_at': now,
            'updated_at': now
        }
        
        ATTENDANCE_REQUESTS_TABLE.put_item(Item=request_data)
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'message': '修正申請を作成しました',
                'request_id': request_id
            }, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error creating attendance request: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '修正申請の作成に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def get_attendance_requests(event, headers):
    """
    出退勤修正申請一覧を取得
    """
    try:
        # クエリパラメータを取得
        query_params = event.get('queryStringParameters') or {}
        staff_id = query_params.get('staff_id')
        status = query_params.get('status')
        limit = int(query_params.get('limit', 50))
        
        # スキャンまたはクエリを実行
        if staff_id:
            # スタッフIDでフィルタリング
            response = ATTENDANCE_REQUESTS_TABLE.query(
                IndexName='staff_id-created_at-index',
                KeyConditionExpression=Key('staff_id').eq(staff_id),
                ScanIndexForward=False,
                Limit=limit
            )
        elif status:
            # ステータスでフィルタリング
            response = ATTENDANCE_REQUESTS_TABLE.query(
                IndexName='status-created_at-index',
                KeyConditionExpression=Key('status').eq(status),
                ScanIndexForward=False,
                Limit=limit
            )
        else:
            # 全件取得（スキャン）
            response = ATTENDANCE_REQUESTS_TABLE.scan(Limit=limit)
        
        items = response.get('Items', [])
        
        # 日付でソート（新しい順）
        items.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'requests': items,
                'count': len(items)
            }, ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"Error getting attendance requests: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '修正申請の取得に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def get_attendance_request_detail(request_id, headers):
    """
    出退勤修正申請詳細を取得
    """
    try:
        response = ATTENDANCE_REQUESTS_TABLE.get_item(Key={'id': request_id})
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
                    'error': '修正申請が見つかりません'
                }, ensure_ascii=False)
            }
    except Exception as e:
        print(f"Error getting attendance request detail: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '修正申請の取得に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def update_attendance_request(request_id, event, headers):
    """
    出退勤修正申請を更新（承認・却下）
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
        
        status = body_json.get('status')  # approved, rejected
        admin_comment = body_json.get('admin_comment', '')
        admin_id = body_json.get('admin_id', '')
        
        if status not in ['approved', 'rejected']:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': 'statusはapprovedまたはrejectedである必要があります',
                    'code': 'VALIDATION_ERROR'
                }, ensure_ascii=False)
            }
        
        # 既存の申請を取得
        existing_response = ATTENDANCE_REQUESTS_TABLE.get_item(Key={'id': request_id})
        if 'Item' not in existing_response:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({
                    'error': '修正申請が見つかりません'
                }, ensure_ascii=False)
            }
        
        existing_request = existing_response['Item']
        
        # 承認済みまたは却下済みの場合は更新不可
        if existing_request.get('status') in ['approved', 'rejected']:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': '既に処理済みの申請です',
                    'code': 'ALREADY_PROCESSED'
                }, ensure_ascii=False)
            }
        
        now = datetime.now(timezone.utc).isoformat() + 'Z'
        
        # 申請を更新
        update_expression_parts = []
        expression_attribute_values = {}
        expression_attribute_names = {}
        
        update_expression_parts.append("#status = :status")
        expression_attribute_names["#status"] = "status"
        expression_attribute_values[":status"] = status
        
        update_expression_parts.append("#updated_at = :updated_at")
        expression_attribute_names["#updated_at"] = "updated_at"
        expression_attribute_values[":updated_at"] = now
        
        if admin_comment:
            update_expression_parts.append("#admin_comment = :admin_comment")
            expression_attribute_names["#admin_comment"] = "admin_comment"
            expression_attribute_values[":admin_comment"] = admin_comment
        
        if admin_id:
            update_expression_parts.append("#admin_id = :admin_id")
            expression_attribute_names["#admin_id"] = "admin_id"
            expression_attribute_values[":admin_id"] = admin_id
        
        if status == 'approved':
            update_expression_parts.append("#approved_at = :approved_at")
            expression_attribute_names["#approved_at"] = "approved_at"
            expression_attribute_values[":approved_at"] = now
        elif status == 'rejected':
            update_expression_parts.append("#rejected_at = :rejected_at")
            expression_attribute_names["#rejected_at"] = "rejected_at"
            expression_attribute_values[":rejected_at"] = now
        
        ATTENDANCE_REQUESTS_TABLE.update_item(
            Key={'id': request_id},
            UpdateExpression='SET ' + ', '.join(update_expression_parts),
            ExpressionAttributeNames=expression_attribute_names,
            ExpressionAttributeValues=expression_attribute_values
        )
        
        # 承認された場合、勤怠記録を更新
        if status == 'approved':
            attendance_id = existing_request.get('attendance_id')
            if attendance_id:
                # 勤怠記録を更新
                update_expression_parts = []
                expression_attribute_values = {}
                expression_attribute_names = {}
                
                if existing_request.get('requested_clock_in'):
                    update_expression_parts.append("#clock_in = :clock_in")
                    expression_attribute_names["#clock_in"] = "clock_in"
                    expression_attribute_values[":clock_in"] = existing_request['requested_clock_in']
                
                if existing_request.get('requested_clock_out'):
                    update_expression_parts.append("#clock_out = :clock_out")
                    expression_attribute_names["#clock_out"] = "clock_out"
                    expression_attribute_values[":clock_out"] = existing_request['requested_clock_out']
                
                update_expression_parts.append("#updated_at = :updated_at")
                expression_attribute_names["#updated_at"] = "updated_at"
                expression_attribute_values[":updated_at"] = now
                
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
                'message': f'修正申請を{status}しました'
            }, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error updating attendance request: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '修正申請の更新に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def delete_attendance_request(request_id, headers):
    """
    出退勤修正申請を削除
    """
    try:
        ATTENDANCE_REQUESTS_TABLE.delete_item(Key={'id': request_id})
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'message': '修正申請を削除しました'
            }, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error deleting attendance request: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '修正申請の削除に失敗しました',
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

def get_holidays(event, headers):
    """
    休日・祝日一覧を取得
    """
    try:
        query_params = event.get('queryStringParameters') or {}
        date_from = query_params.get('date_from')
        date_to = query_params.get('date_to')
        year = query_params.get('year')
        month = query_params.get('month')
        holiday_type = query_params.get('type')
        
        if date_from and date_to:
            # 日付範囲でフィルタリング
            holidays = []
            scan_response = HOLIDAYS_TABLE.scan()
            for item in scan_response.get('Items', []):
                if date_from <= item.get('date', '') <= date_to:
                    if not holiday_type or item.get('type') == holiday_type:
                        holidays.append(item)
            holidays.sort(key=lambda x: x.get('date', ''))
        elif year and month:
            # 年月でフィルタリング
            month_start = f"{year}-{month.zfill(2)}-01"
            next_month = int(month) + 1
            next_year = int(year)
            if next_month > 12:
                next_month = 1
                next_year += 1
            month_end = f"{next_year}-{str(next_month).zfill(2)}-01"
            
            holidays = []
            scan_response = HOLIDAYS_TABLE.scan()
            for item in scan_response.get('Items', []):
                item_date = item.get('date', '')
                if month_start <= item_date < month_end:
                    if not holiday_type or item.get('type') == holiday_type:
                        holidays.append(item)
            holidays.sort(key=lambda x: x.get('date', ''))
        else:
            # 全件取得
            scan_response = HOLIDAYS_TABLE.scan()
            holidays = scan_response.get('Items', [])
            if holiday_type:
                holidays = [h for h in holidays if h.get('type') == holiday_type]
            holidays.sort(key=lambda x: x.get('date', ''))
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'holidays': holidays,
                'count': len(holidays)
            }, ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"Error getting holidays: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '休日一覧の取得に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def create_holiday(event, headers):
    """
    休日・祝日を作成
    """
    try:
        if event.get('isBase64Encoded'):
            body = base64.b64decode(event['body'])
        else:
            body = event.get('body', '')
        
        if isinstance(body, str):
            body_json = json.loads(body)
        else:
            body_json = json.loads(body.decode('utf-8'))
        
        holiday_id = body_json.get('id') or str(uuid.uuid4())
        date = body_json.get('date')
        name = body_json.get('name', '')
        holiday_type = body_json.get('type', 'custom')
        
        if not date:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': '日付は必須です'
                }, ensure_ascii=False)
            }
        
        now = datetime.now(timezone.utc).isoformat()
        
        holiday_data = {
            'id': holiday_id,
            'date': date,
            'name': name,
            'type': holiday_type,
            'created_at': now,
            'updated_at': now
        }
        
        HOLIDAYS_TABLE.put_item(Item=holiday_data)
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'message': '休日を登録しました',
                'holiday': holiday_data
            }, ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"Error creating holiday: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '休日の登録に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def get_holiday_detail(holiday_id, headers):
    """
    休日・祝日詳細を取得
    """
    try:
        response = HOLIDAYS_TABLE.get_item(Key={'id': holiday_id})
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
                    'error': '休日が見つかりません'
                }, ensure_ascii=False)
            }
    except Exception as e:
        print(f"Error getting holiday detail: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '休日の取得に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def update_holiday(holiday_id, event, headers):
    """
    休日・祝日を更新
    """
    try:
        if event.get('isBase64Encoded'):
            body = base64.b64decode(event['body'])
        else:
            body = event.get('body', '')
        
        if isinstance(body, str):
            body_json = json.loads(body)
        else:
            body_json = json.loads(body.decode('utf-8'))
        
        # 既存の休日を取得
        response = HOLIDAYS_TABLE.get_item(Key={'id': holiday_id})
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({
                    'error': '休日が見つかりません'
                }, ensure_ascii=False)
            }
        
        # 更新可能なフィールドを更新
        update_expression_parts = []
        expression_attribute_values = {}
        expression_attribute_names = {}
        
        updatable_fields = ['date', 'name', 'type']
        for field in updatable_fields:
            if field in body_json:
                update_expression_parts.append(f"#{field} = :{field}")
                expression_attribute_names[f"#{field}"] = field
                expression_attribute_values[f":{field}"] = body_json[field]
        
        update_expression_parts.append("#updated_at = :updated_at")
        expression_attribute_names["#updated_at"] = "updated_at"
        expression_attribute_values[":updated_at"] = datetime.now(timezone.utc).isoformat()
        
        if update_expression_parts:
            HOLIDAYS_TABLE.update_item(
                Key={'id': holiday_id},
                UpdateExpression='SET ' + ', '.join(update_expression_parts),
                ExpressionAttributeNames=expression_attribute_names,
                ExpressionAttributeValues=expression_attribute_values
            )
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'message': '休日を更新しました'
            }, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error updating holiday: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '休日の更新に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def delete_holiday(holiday_id, headers):
    """
    休日・祝日を削除
    """
    try:
        HOLIDAYS_TABLE.delete_item(Key={'id': holiday_id})
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'message': '休日を削除しました'
            }, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error deleting holiday: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '休日の削除に失敗しました',
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


def save_report_feedback(report_id, event, headers):
    """
    顧客からのフィードバック（評価・コメント）を保存
    認証不要
    """
    try:
        print(f"[Feedback] Saving feedback for report_id: {report_id}")
        
        # リクエストボディを取得
        body_str = event.get('body', '{}')
        if event.get('isBase64Encoded'):
            body_str = base64.b64decode(body_str).decode('utf-8')
        
        print(f"[Feedback] Body string: {body_str[:200]}")
        
        body = json.loads(body_str) if isinstance(body_str, str) else body_str
        rating = body.get('rating', 0)
        comment = body.get('comment', '')
        
        print(f"[Feedback] Parsed data: rating={rating}, comment={comment[:50] if comment else ''}")
        
        # レポートが存在するか確認
        REPORTS_TABLE = dynamodb.Table('misesapo-reports')
        response = REPORTS_TABLE.get_item(Key={'report_id': report_id})
        if 'Item' not in response:
            print(f"[Feedback] Report not found: {report_id}")
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({'error': 'レポートが見つかりません'}, ensure_ascii=False)
            }
        
        # フィードバックを保存
        feedback = {
            'rating': rating,
            'comment': comment,
            'submitted_at': datetime.now().isoformat()
        }
        
        print(f"[Feedback] Updating report with feedback: {feedback}")
        
        REPORTS_TABLE.update_item(
            Key={'report_id': report_id},
            UpdateExpression='SET satisfaction = :feedback',
            ExpressionAttributeValues={':feedback': feedback}
        )
        
        print(f"[Feedback] Successfully saved feedback")
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'message': 'フィードバックを保存しました'
            }, ensure_ascii=False)
        }
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[Feedback] Error saving feedback: {str(e)}")
        print(f"[Feedback] Traceback: {error_trace}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'フィードバックの保存に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }


def get_report_feedback(report_id, event, headers):
    """
    レポートのフィードバック（評価・コメント）を取得
    スタッフ用（認証必要）
    """
    try:
        # 認証チェック
        auth_header = event.get('headers', {}).get('Authorization', '') or event.get('headers', {}).get('authorization', '')
        if not auth_header or not auth_header.startswith('Bearer '):
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': '認証が必要です'}, ensure_ascii=False)
            }
        
        id_token = auth_header.replace('Bearer ', '')
        user_info = verify_firebase_token(id_token)
        if not user_info:
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': 'トークンが無効です'}, ensure_ascii=False)
            }
        
        # レポートを取得
        REPORTS_TABLE = dynamodb.Table('misesapo-reports')
        response = REPORTS_TABLE.get_item(Key={'report_id': report_id})
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({'error': 'レポートが見つかりません'}, ensure_ascii=False)
            }
        
        report = response['Item']
        feedback = report.get('satisfaction', {})
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'feedback': feedback
            }, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error getting feedback: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'フィードバックの取得に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }


# ==================== 在庫管理API ====================

def get_inventory_items(event, headers):
    """
    在庫一覧を取得（認証不要）
    """
    try:
        print("DEBUG: get_inventory_items called")
        items = []
        try:
            print("DEBUG: Attempting to scan inventory-items table")
            response = INVENTORY_ITEMS_TABLE.scan()
            print(f"DEBUG: Scan response received, items count: {len(response.get('Items', []))}")
            items.extend(response.get('Items', []))
            
            while 'LastEvaluatedKey' in response:
                print("DEBUG: Paginating scan results")
                response = INVENTORY_ITEMS_TABLE.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
                items.extend(response.get('Items', []))
        except Exception as table_error:
            # テーブルが存在しない場合やエラーの場合
            import traceback
            print(f"ERROR: Error scanning inventory items table: {str(table_error)}")
            print(traceback.format_exc())
            # 空の配列を返す（テーブルが存在しない場合のフォールバック）
            items = []
        
        print(f"DEBUG: Processing {len(items)} items")
        # 在庫ステータスを計算
        processed_items = []
        for item in items:
            # DynamoDBの型をJSONシリアライズ可能な型に変換
            processed_item = {}
            for key, value in item.items():
                # Decimal型をintに変換
                if hasattr(value, '__class__') and value.__class__.__name__ == 'Decimal':
                    processed_item[key] = int(value)
                elif isinstance(value, (int, float, str, bool, type(None))):
                    processed_item[key] = value
                else:
                    processed_item[key] = str(value)
            
            # 数値型に変換してから比較
            stock = processed_item.get('stock', 0)
            safe_stock = processed_item.get('safeStock', 100)
            min_stock = processed_item.get('minStock', 50)
            
            if stock >= safe_stock:
                processed_item['status'] = 'safe'
            elif stock >= min_stock:
                processed_item['status'] = 'warning'
            else:
                processed_item['status'] = 'danger'
            
            processed_items.append(processed_item)
        
        print(f"DEBUG: Returning {len(processed_items)} items")
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'items': processed_items
            }, ensure_ascii=False)
        }
    except Exception as e:
        import traceback
        error_msg = f"Error getting inventory items: {str(e)}"
        print(error_msg)
        print(traceback.format_exc())
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '在庫一覧の取得に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }


def create_inventory_item(event, headers):
    """
    商品を登録（管理者のみ）
    """
    try:
        # 認証チェック
        auth_header = event.get('headers', {}).get('Authorization', '') or event.get('headers', {}).get('authorization', '')
        if not auth_header or not auth_header.startswith('Bearer '):
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': '認証が必要です'}, ensure_ascii=False)
            }
        
        id_token = auth_header.replace('Bearer ', '')
        user_info = verify_firebase_token(id_token)
        
        if not user_info or user_info.get('role') != 'admin':
            return {
                'statusCode': 403,
                'headers': headers,
                'body': json.dumps({'error': '管理者権限が必要です'}, ensure_ascii=False)
            }
        
        # リクエストボディを取得
        if event.get('isBase64Encoded'):
            body = json.loads(base64.b64decode(event.get('body', '{}')).decode('utf-8'))
        else:
            body = json.loads(event.get('body', '{}'))
        
        product_id = body.get('product_id')
        name = body.get('name')
        stock = int(body.get('stock', 0))
        min_stock = int(body.get('minStock', 50))
        safe_stock = int(body.get('safeStock', 100))
        
        if not product_id or not name:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': '商品IDと商品名は必須です'}, ensure_ascii=False)
            }
        
        # 既存商品チェック
        try:
            existing = INVENTORY_ITEMS_TABLE.get_item(Key={'product_id': product_id})
            if 'Item' in existing:
                return {
                    'statusCode': 409,
                    'headers': headers,
                    'body': json.dumps({'error': 'この商品IDは既に登録されています'}, ensure_ascii=False)
                }
        except Exception:
            pass
        
        # 商品を登録
        now = datetime.now(timezone.utc).isoformat()
        item = {
            'product_id': product_id,
            'name': name,
            'stock': stock,
            'minStock': min_stock,
            'safeStock': safe_stock,
            'created_at': now,
            'updated_at': now
        }
        
        INVENTORY_ITEMS_TABLE.put_item(Item=item)
        
        return {
            'statusCode': 201,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'item': item
            }, ensure_ascii=False, default=str)
        }
    except Exception as e:
        import traceback
        print(f"Error creating inventory item: {str(e)}")
        print(traceback.format_exc())
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '商品の登録に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }


def process_inventory_transaction(event, headers, transaction_type):
    """
    在庫トランザクション処理（入庫/出庫）
    transaction_type: 'in' or 'out'
    """
    try:
        # 認証チェック
        auth_header = event.get('headers', {}).get('Authorization', '') or event.get('headers', {}).get('authorization', '')
        if not auth_header or not auth_header.startswith('Bearer '):
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': '認証が必要です'}, ensure_ascii=False)
            }
        
        id_token = auth_header.replace('Bearer ', '')
        user_info = verify_firebase_token(id_token)
        
        if not user_info:
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': '認証に失敗しました'}, ensure_ascii=False)
            }
        
        staff_id = user_info.get('uid') or user_info.get('cognito_sub', '')
        staff_name = user_info.get('name', '') or user_info.get('email', 'Unknown')
        staff_email = user_info.get('email', '')
        
        # リクエストボディを取得
        if event.get('isBase64Encoded'):
            body = json.loads(base64.b64decode(event.get('body', '{}')).decode('utf-8'))
        else:
            body = json.loads(event.get('body', '{}'))
        
        # 複数商品の一括処理に対応
        items = body.get('items', [])
        if not items:
            # 単一商品の場合
            product_id = body.get('product_id')
            quantity = int(body.get('quantity', 0))
            if product_id and quantity > 0:
                items = [{'product_id': product_id, 'quantity': quantity}]
        
        if not items:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': '商品IDと数量を指定してください'}, ensure_ascii=False)
            }
        
        results = []
        errors = []
        
        for item_data in items:
            product_id = item_data.get('product_id')
            quantity = int(item_data.get('quantity', 0))
            
            if not product_id or quantity <= 0:
                errors.append(f'商品IDまたは数量が不正です: {product_id}')
                continue
            
            try:
                # 商品を取得
                response = INVENTORY_ITEMS_TABLE.get_item(Key={'product_id': product_id})
                if 'Item' not in response:
                    errors.append(f'商品が見つかりません: {product_id}')
                    continue
                
                product = response['Item']
                current_stock = int(product.get('stock', 0))
                stock_before = current_stock
                
                # 在庫更新
                if transaction_type == 'out':
                    # 出庫処理
                    if current_stock < quantity:
                        errors.append(f'{product.get("name")}の在庫が不足しています（現在: {current_stock}個、必要: {quantity}個）')
                        continue
                    new_stock = current_stock - quantity
                else:
                    # 入庫処理
                    new_stock = current_stock + quantity
                
                # 在庫を更新
                now = datetime.now(timezone.utc).isoformat()
                INVENTORY_ITEMS_TABLE.update_item(
                    Key={'product_id': product_id},
                    UpdateExpression='SET stock = :stock, updated_at = :updated_at',
                    ExpressionAttributeValues={
                        ':stock': new_stock,
                        ':updated_at': now
                    }
                )
                
                # トランザクションログを記録
                transaction_id = str(uuid.uuid4())
                transaction = {
                    'transaction_id': transaction_id,
                    'product_id': product_id,
                    'product_name': product.get('name', ''),
                    'staff_id': staff_id,
                    'staff_name': staff_name,
                    'staff_email': staff_email,
                    'quantity': quantity,
                    'type': transaction_type,
                    'stock_before': stock_before,
                    'stock_after': new_stock,
                    'created_at': now,
                    'ttl': int((datetime.now(timezone.utc) + timedelta(days=90)).timestamp())  # 3ヶ月後に自動削除
                }
                
                INVENTORY_TRANSACTIONS_TABLE.put_item(Item=transaction)
                
                results.append({
                    'product_id': product_id,
                    'product_name': product.get('name', ''),
                    'quantity': quantity,
                    'stock_before': stock_before,
                    'stock_after': new_stock
                })
                
            except Exception as e:
                errors.append(f'{product_id}の処理に失敗しました: {str(e)}')
        
        if errors and not results:
            # 全てエラーの場合
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': '在庫更新に失敗しました',
                    'errors': errors
                }, ensure_ascii=False)
            }
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'results': results,
                'errors': errors if errors else None
            }, ensure_ascii=False, default=str)
        }
        
    except Exception as e:
        import traceback
        print(f"Error processing inventory transaction: {str(e)}")
        print(traceback.format_exc())
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '在庫更新に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }


def get_inventory_transactions(event, headers):
    """
    トランザクション履歴を取得
    """
    try:
        # 認証チェック
        auth_header = event.get('headers', {}).get('Authorization', '') or event.get('headers', {}).get('authorization', '')
        if not auth_header or not auth_header.startswith('Bearer '):
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': '認証が必要です'}, ensure_ascii=False)
            }
        
        id_token = auth_header.replace('Bearer ', '')
        user_info = verify_firebase_token(id_token)
        
        if not user_info:
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': '認証に失敗しました'}, ensure_ascii=False)
            }
        
        # クエリパラメータを取得
        query_params = event.get('queryStringParameters') or {}
        is_admin = user_info.get('role') == 'admin'
        staff_id = user_info.get('uid') or user_info.get('cognito_sub', '')
        
        # フィルター条件
        filter_expressions = []
        
        # 清掃員の場合は自分の履歴のみ
        if not is_admin and staff_id:
            filter_expressions.append(Attr('staff_id').eq(staff_id))
        
        # 管理者の場合はフィルタリング可能
        if is_admin:
            if query_params.get('staff_id'):
                filter_expressions.append(Attr('staff_id').eq(query_params['staff_id']))
            if query_params.get('product_id'):
                filter_expressions.append(Attr('product_id').eq(query_params['product_id']))
            if query_params.get('type'):
                filter_expressions.append(Attr('type').eq(query_params['type']))
        
        # 日付範囲フィルター
        date_from = query_params.get('date_from')
        date_to = query_params.get('date_to')
        if date_from:
            filter_expressions.append(Attr('created_at').gte(date_from))
        if date_to:
            filter_expressions.append(Attr('created_at').lte(date_to))
        
        # スキャン実行
        if filter_expressions:
            from functools import reduce
            filter_expr = reduce(lambda x, y: x & y, filter_expressions)
            response = INVENTORY_TRANSACTIONS_TABLE.scan(FilterExpression=filter_expr)
        else:
            response = INVENTORY_TRANSACTIONS_TABLE.scan()
        
        transactions = response.get('Items', [])
        
        while 'LastEvaluatedKey' in response:
            if filter_expressions:
                response = INVENTORY_TRANSACTIONS_TABLE.scan(
                    FilterExpression=filter_expr,
                    ExclusiveStartKey=response['LastEvaluatedKey']
                )
            else:
                response = INVENTORY_TRANSACTIONS_TABLE.scan(
                    ExclusiveStartKey=response['LastEvaluatedKey']
                )
            transactions.extend(response.get('Items', []))
        
        # 日付でソート（降順）
        transactions.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        # ページネーション
        limit = int(query_params.get('limit', 100))
        offset = int(query_params.get('offset', 0))
        paginated_transactions = transactions[offset:offset + limit]
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'transactions': paginated_transactions,
                'total': len(transactions),
                'limit': limit,
                'offset': offset
            }, ensure_ascii=False, default=str)
        }
        
    except Exception as e:
        import traceback
        print(f"Error getting inventory transactions: {str(e)}")
        print(traceback.format_exc())
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '履歴の取得に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

# ==================== 業務連絡機能 ====================

def get_staff_announcements(event, headers):
    """
    清掃員向け業務連絡一覧取得
    """
    try:
        # 認証チェック
        auth_header = event.get('headers', {}).get('Authorization') or event.get('headers', {}).get('authorization', '')
        id_token = auth_header.replace('Bearer ', '') if auth_header else ''
        user_info = verify_firebase_token(id_token)
        if not user_info or not user_info.get('verified'):
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': 'Unauthorized'}, ensure_ascii=False)
            }
        
        staff_id = user_info.get('uid')
        query_params = event.get('queryStringParameters') or {}
        limit = int(query_params.get('limit', 50))
        
        # 全社員向けと個別向けの業務連絡を取得
        now = datetime.utcnow().isoformat() + 'Z'
        
        # 全社員向け（target_type='all'）
        all_announcements = []
        try:
            response = ANNOUNCEMENTS_TABLE.query(
                IndexName='created_at-index',
                KeyConditionExpression=Key('target_type').eq('all'),
                ScanIndexForward=False,
                Limit=limit
            )
            all_announcements = response.get('Items', [])
        except Exception as e:
            print(f"Error querying all announcements: {e}")
        
        # 個別向け（target_type='individual'、target_staff_idsにstaff_idが含まれる）
        individual_announcements = []
        try:
            response = ANNOUNCEMENTS_TABLE.scan(
                FilterExpression=Attr('target_type').eq('individual') & Attr('target_staff_ids').contains(staff_id)
            )
            individual_announcements = response.get('Items', [])
        except Exception as e:
            print(f"Error querying individual announcements: {e}")
        
        # マージしてソート
        all_items = all_announcements + individual_announcements
        all_items.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        # 既読情報を取得
        read_ids = set()
        try:
            read_response = ANNOUNCEMENT_READS_TABLE.query(
                IndexName='staff_id-read_at-index',
                KeyConditionExpression=Key('staff_id').eq(staff_id)
            )
            read_ids = {item.get('announcement_id') for item in read_response.get('Items', [])}
        except Exception as e:
            print(f"Error querying read status: {e}")
        
        # レスポンスに既読情報とNEWバッジ情報を追加
        announcements = []
        for item in all_items[:limit]:
            announcement_id = item.get('id')
            created_at = item.get('created_at', '')
            is_read = announcement_id in read_ids
            
            # NEWバッジ判定（作成から1週間以内）
            is_new = False
            if created_at:
                try:
                    created_date = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
                    is_new = created_date > week_ago
                except:
                    pass
            
            announcements.append({
                **item,
                'is_read': is_read,
                'is_new': is_new
            })
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'announcements': announcements,
                'total': len(announcements)
            }, ensure_ascii=False, default=str)
        }
    except Exception as e:
        import traceback
        print(f"Error getting staff announcements: {str(e)}")
        print(traceback.format_exc())
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '業務連絡の取得に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def mark_announcement_read(announcement_id, event, headers):
    """
    業務連絡の既読マーク
    """
    try:
        # 認証チェック
        auth_header = event.get('headers', {}).get('Authorization') or event.get('headers', {}).get('authorization', '')
        id_token = auth_header.replace('Bearer ', '') if auth_header else ''
        user_info = verify_firebase_token(id_token)
        if not user_info or not user_info.get('verified'):
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': 'Unauthorized'}, ensure_ascii=False)
            }
        
        staff_id = user_info.get('uid')
        now = datetime.utcnow().isoformat() + 'Z'
        read_id = f"{announcement_id}_{staff_id}"
        
        # 既読レコードを作成
        read_item = {
            'id': read_id,
            'announcement_id': announcement_id,
            'staff_id': staff_id,
            'staff_name': user_info.get('name', user_info.get('email', 'Unknown')),
            'read_at': now
        }
        
        ANNOUNCEMENT_READS_TABLE.put_item(Item=read_item)
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'message': '既読にマークしました'
            }, ensure_ascii=False)
        }
    except Exception as e:
        import traceback
        print(f"Error marking announcement read: {str(e)}")
        print(traceback.format_exc())
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '既読マークに失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def get_admin_announcements(event, headers):
    """
    管理者向け業務連絡一覧取得
    """
    try:
        # 認証・権限チェック
        auth_header = event.get('headers', {}).get('Authorization') or event.get('headers', {}).get('authorization', '')
        id_token = auth_header.replace('Bearer ', '') if auth_header else ''
        user_info = verify_firebase_token(id_token)
        if not user_info or not user_info.get('verified'):
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': 'Unauthorized'}, ensure_ascii=False)
            }
        
        if not check_admin_permission(user_info):
            return {
                'statusCode': 403,
                'headers': headers,
                'body': json.dumps({'error': 'Forbidden: Admin access required'}, ensure_ascii=False)
            }
        
        query_params = event.get('queryStringParameters') or {}
        limit = int(query_params.get('limit', 50))
        target_type = query_params.get('target_type', '')  # 'all' or 'individual' or ''
        
        # 業務連絡を取得
        if target_type:
            response = ANNOUNCEMENTS_TABLE.query(
                IndexName='created_at-index',
                KeyConditionExpression=Key('target_type').eq(target_type),
                ScanIndexForward=False,
                Limit=limit
            )
            announcements = response.get('Items', [])
        else:
            # すべて取得
            response = ANNOUNCEMENTS_TABLE.scan(Limit=limit)
            announcements = response.get('Items', [])
            announcements.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'announcements': announcements,
                'total': len(announcements)
            }, ensure_ascii=False, default=str)
        }
    except Exception as e:
        import traceback
        print(f"Error getting admin announcements: {str(e)}")
        print(traceback.format_exc())
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '業務連絡の取得に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def create_announcement(event, headers):
    """
    業務連絡作成（管理者のみ）
    """
    try:
        # 認証・権限チェック
        auth_header = event.get('headers', {}).get('Authorization') or event.get('headers', {}).get('authorization', '')
        id_token = auth_header.replace('Bearer ', '') if auth_header else ''
        user_info = verify_firebase_token(id_token)
        if not user_info or not user_info.get('verified'):
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': 'Unauthorized'}, ensure_ascii=False)
            }
        
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
        
        # 必須項目チェック
        title = body_json.get('title', '').strip()
        content = body_json.get('content', '').strip()
        target_type = body_json.get('target_type', 'all')  # 'all' or 'individual'
        target_staff_ids = body_json.get('target_staff_ids', [])  # 個別送信の場合のstaff_idリスト
        has_deadline = body_json.get('has_deadline', False)
        deadline = body_json.get('deadline', '')  # ISO 8601形式
        
        if not title or not content:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'タイトルと本文は必須です'}, ensure_ascii=False)
            }
        
        if target_type == 'individual' and not target_staff_ids:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': '個別送信の場合は対象者を選択してください'}, ensure_ascii=False)
            }
        
        if has_deadline and not deadline:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': '期限を設定する場合は期限日時を入力してください'}, ensure_ascii=False)
            }
        
        # 業務連絡を作成
        announcement_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat() + 'Z'
        
        announcement_item = {
            'id': announcement_id,
            'title': title,
            'content': content,
            'target_type': target_type,
            'target_staff_ids': target_staff_ids if target_type == 'individual' else [],
            'has_deadline': has_deadline,
            'deadline': deadline if has_deadline else None,
            'created_at': now,
            'updated_at': now,
            'created_by': user_info.get('uid'),
            'created_by_name': user_info.get('name', user_info.get('email', 'Unknown')),
            'target_type': target_type  # GSI用
        }
        
        ANNOUNCEMENTS_TABLE.put_item(Item=announcement_item)
        
        return {
            'statusCode': 201,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'message': '業務連絡を作成しました',
                'announcement_id': announcement_id
            }, ensure_ascii=False)
        }
    except Exception as e:
        import traceback
        print(f"Error creating announcement: {str(e)}")
        print(traceback.format_exc())
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '業務連絡の作成に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def get_announcement_detail(announcement_id, event, headers):
    """
    業務連絡詳細取得（既読状況含む、管理者向け）
    """
    try:
        # 認証・権限チェック
        auth_header = event.get('headers', {}).get('Authorization') or event.get('headers', {}).get('authorization', '')
        id_token = auth_header.replace('Bearer ', '') if auth_header else ''
        user_info = verify_firebase_token(id_token)
        if not user_info or not user_info.get('verified'):
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': 'Unauthorized'}, ensure_ascii=False)
            }
        
        if not check_admin_permission(user_info):
            return {
                'statusCode': 403,
                'headers': headers,
                'body': json.dumps({'error': 'Forbidden: Admin access required'}, ensure_ascii=False)
            }
        
        # 業務連絡を取得
        response = ANNOUNCEMENTS_TABLE.get_item(Key={'id': announcement_id})
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({'error': '業務連絡が見つかりません'}, ensure_ascii=False)
            }
        
        announcement = response['Item']
        
        # 既読状況を取得
        read_response = ANNOUNCEMENT_READS_TABLE.query(
            IndexName='announcement_id-read_at-index',
            KeyConditionExpression=Key('announcement_id').eq(announcement_id)
        )
        read_items = read_response.get('Items', [])
        
        # 全従業員リストを取得（既読チェック用）
        all_staff = []
        try:
            staff_response = WORKERS_TABLE.scan(
                FilterExpression=Attr('role_code').eq('99')  # 清掃員
            )
            all_staff = staff_response.get('Items', [])
        except Exception as e:
            print(f"Error getting staff list: {e}")
        
        # 既読マップを作成
        read_map = {item.get('staff_id'): item for item in read_items}
        
        # 対象者リストを作成
        target_staff_ids = announcement.get('target_staff_ids', [])
        if announcement.get('target_type') == 'all':
            # 全社員向けの場合は全従業員が対象
            target_staff_ids = [staff.get('id') for staff in all_staff]
        
        # 既読チェックリストを作成
        read_status = []
        for staff_id in target_staff_ids:
            staff = next((s for s in all_staff if s.get('id') == staff_id), None)
            if staff:
                read_item = read_map.get(staff_id)
                read_status.append({
                    'staff_id': staff_id,
                    'staff_name': staff.get('name', staff.get('email', 'Unknown')),
                    'is_read': read_item is not None,
                    'read_at': read_item.get('read_at') if read_item else None
                })
        
        announcement['read_status'] = read_status
        announcement['read_count'] = len([s for s in read_status if s['is_read']])
        announcement['total_count'] = len(read_status)
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(announcement, ensure_ascii=False, default=str)
        }
    except Exception as e:
        import traceback
        print(f"Error getting announcement detail: {str(e)}")
        print(traceback.format_exc())
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '業務連絡の取得に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def update_announcement(announcement_id, event, headers):
    """
    業務連絡更新（管理者のみ）
    """
    try:
        # 認証・権限チェック
        auth_header = event.get('headers', {}).get('Authorization') or event.get('headers', {}).get('authorization', '')
        id_token = auth_header.replace('Bearer ', '') if auth_header else ''
        user_info = verify_firebase_token(id_token)
        if not user_info or not user_info.get('verified'):
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': 'Unauthorized'}, ensure_ascii=False)
            }
        
        if not check_admin_permission(user_info):
            return {
                'statusCode': 403,
                'headers': headers,
                'body': json.dumps({'error': 'Forbidden: Admin access required'}, ensure_ascii=False)
            }
        
        # 既存の業務連絡を取得
        response = ANNOUNCEMENTS_TABLE.get_item(Key={'id': announcement_id})
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({'error': '業務連絡が見つかりません'}, ensure_ascii=False)
            }
        
        existing = response['Item']
        
        # リクエストボディを取得
        if event.get('isBase64Encoded'):
            body = base64.b64decode(event['body'])
        else:
            body = event.get('body', '')
        
        if isinstance(body, str):
            body_json = json.loads(body)
        else:
            body_json = json.loads(body.decode('utf-8'))
        
        # 更新
        now = datetime.utcnow().isoformat() + 'Z'
        update_item = {
            **existing,
            'title': body_json.get('title', existing.get('title')),
            'content': body_json.get('content', existing.get('content')),
            'target_type': body_json.get('target_type', existing.get('target_type')),
            'target_staff_ids': body_json.get('target_staff_ids', existing.get('target_staff_ids', [])),
            'has_deadline': body_json.get('has_deadline', existing.get('has_deadline', False)),
            'deadline': body_json.get('deadline', existing.get('deadline')),
            'updated_at': now
        }
        
        ANNOUNCEMENTS_TABLE.put_item(Item=update_item)
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'message': '業務連絡を更新しました'
            }, ensure_ascii=False)
        }
    except Exception as e:
        import traceback
        print(f"Error updating announcement: {str(e)}")
        print(traceback.format_exc())
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '業務連絡の更新に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def delete_announcement(announcement_id, event, headers):
    """
    業務連絡削除（管理者のみ）
    """
    try:
        # 認証・権限チェック
        auth_header = event.get('headers', {}).get('Authorization') or event.get('headers', {}).get('authorization', '')
        id_token = auth_header.replace('Bearer ', '') if auth_header else ''
        user_info = verify_firebase_token(id_token)
        if not user_info or not user_info.get('verified'):
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': 'Unauthorized'}, ensure_ascii=False)
            }
        
        if not check_admin_permission(user_info):
            return {
                'statusCode': 403,
                'headers': headers,
                'body': json.dumps({'error': 'Forbidden: Admin access required'}, ensure_ascii=False)
            }
        
        # 業務連絡を削除
        ANNOUNCEMENTS_TABLE.delete_item(Key={'id': announcement_id})
        
        # 既読レコードも削除（オプション）
        try:
            read_response = ANNOUNCEMENT_READS_TABLE.query(
                IndexName='announcement_id-read_at-index',
                KeyConditionExpression=Key('announcement_id').eq(announcement_id)
            )
            for read_item in read_response.get('Items', []):
                ANNOUNCEMENT_READS_TABLE.delete_item(Key={'id': read_item.get('id')})
        except Exception as e:
            print(f"Error deleting read records: {e}")
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'message': '業務連絡を削除しました'
            }, ensure_ascii=False)
        }
    except Exception as e:
        import traceback
        print(f"Error deleting announcement: {str(e)}")
        print(traceback.format_exc())
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '業務連絡の削除に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

