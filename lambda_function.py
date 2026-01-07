import json
import boto3
import base64
import os
import uuid
import hashlib
import urllib.request
import urllib.parse
from decimal import Decimal
from datetime import datetime, timedelta, timezone
from boto3.dynamodb.conditions import Key, Attr

# Google Calendar API用のインポート（オプション）
# 注意: Lambda Layerまたはrequirements.txtにgoogle-api-python-clientを追加する必要があります
try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    GOOGLE_CALENDAR_AVAILABLE = True
except ImportError:
    GOOGLE_CALENDAR_AVAILABLE = False
    print("Warning: Google Calendar API libraries not available. Calendar integration will be disabled.")

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

def get_max_sequence_for_date(table, date_prefix):
    """
    指定日付の最大連番を取得（スケジュールID用）
    形式: SCH-YYYYMMDD-NNN から NNN を抽出
    """
    prefix = f"SCH-{date_prefix}-"
    
    try:
        # その日付のIDを持つスケジュールをスキャン
        response = table.scan(
            FilterExpression=Attr('id').begins_with(prefix),
            ProjectionExpression='id'
        )
        
        max_seq = 0
        for item in response.get('Items', []):
            schedule_id = item.get('id', '')
            # SCH-YYYYMMDD-NNN から NNN を抽出
            if schedule_id.startswith(prefix):
                seq_str = schedule_id[len(prefix):]
                try:
                    seq = int(seq_str)
                    if seq > max_seq:
                        max_seq = seq
                except:
                    pass
        
        # ページネーション対応
        while 'LastEvaluatedKey' in response:
            response = table.scan(
                FilterExpression=Attr('id').begins_with(prefix),
                ProjectionExpression='id',
                ExclusiveStartKey=response['LastEvaluatedKey']
            )
            for item in response.get('Items', []):
                schedule_id = item.get('id', '')
                if schedule_id.startswith(prefix):
                    seq_str = schedule_id[len(prefix):]
                    try:
                        seq = int(seq_str)
                        if seq > max_seq:
                            max_seq = seq
                    except:
                        pass
        
        return max_seq
    except Exception as e:
        print(f"Error getting max sequence for date {date_prefix}: {str(e)}")
        return 0

def generate_schedule_id(date_str, table):
    """
    スケジュールIDを生成: SCH-YYYYMMDD-NNN
    日付ごとに連番をリセット
    """
    # 日付をYYYYMMDD形式に変換
    if isinstance(date_str, str) and date_str:
        try:
            date_obj = datetime.strptime(date_str, '%Y-%m-%d')
            date_prefix = date_obj.strftime('%Y%m%d')
        except:
            # 日付が無効な場合は現在日付を使用
            date_prefix = datetime.now().strftime('%Y%m%d')
    else:
        date_prefix = datetime.now().strftime('%Y%m%d')
    
    # その日の最大連番を取得
    max_seq = get_max_sequence_for_date(table, date_prefix)
    next_seq = max_seq + 1
    
    # 3桁の連番にゼロパディング
    seq_str = str(next_seq).zfill(3)
    
    return f"SCH-{date_prefix}-{seq_str}"

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

def get_google_calendar_service():
    """
    Google Calendar APIサービスオブジェクトを取得
    サービスアカウント認証を使用
    
    認証情報の取得方法（優先順位）:
    1. AWS Secrets Managerから取得（GOOGLE_SERVICE_ACCOUNT_SECRET_NAMEが設定されている場合）
    2. 環境変数から直接取得（GOOGLE_SERVICE_ACCOUNT_JSONが設定されている場合）
    """
    if not GOOGLE_CALENDAR_AVAILABLE or not GOOGLE_CALENDAR_ENABLED:
        return None
    
    try:
        service_account_info = None
        
        # 方法1: AWS Secrets Managerから取得（推奨）
        if GOOGLE_SERVICE_ACCOUNT_SECRET_NAME:
            try:
                secrets_client = boto3.client('secretsmanager')
                secret_response = secrets_client.get_secret_value(
                    SecretId=GOOGLE_SERVICE_ACCOUNT_SECRET_NAME
                )
                secret_string = secret_response['SecretString']
                service_account_info = json.loads(secret_string)
                print(f"Successfully retrieved service account info from Secrets Manager: {GOOGLE_SERVICE_ACCOUNT_SECRET_NAME}")
            except Exception as e:
                print(f"Error retrieving secret from Secrets Manager: {str(e)}")
                # Secrets Managerからの取得に失敗した場合は、環境変数から取得を試みる
                if not GOOGLE_SERVICE_ACCOUNT_JSON:
                    return None
        
        # 方法2: 環境変数から直接取得（開発・テスト用）
        if not service_account_info and GOOGLE_SERVICE_ACCOUNT_JSON:
            try:
                if isinstance(GOOGLE_SERVICE_ACCOUNT_JSON, str):
                    service_account_info = json.loads(GOOGLE_SERVICE_ACCOUNT_JSON)
                else:
                    service_account_info = GOOGLE_SERVICE_ACCOUNT_JSON
                print("Successfully loaded service account info from environment variable")
            except json.JSONDecodeError as e:
                print(f"Error parsing GOOGLE_SERVICE_ACCOUNT_JSON: {str(e)}")
                return None
        
        # 認証情報が取得できなかった場合
        if not service_account_info:
            print("Warning: Google Service Account JSON not configured. Set GOOGLE_SERVICE_ACCOUNT_SECRET_NAME or GOOGLE_SERVICE_ACCOUNT_JSON")
            return None
        
        # 認証情報を作成
        credentials = service_account.Credentials.from_service_account_info(
            service_account_info,
            scopes=['https://www.googleapis.com/auth/calendar']
        )
        
        # Calendar APIサービスを構築
        service = build('calendar', 'v3', credentials=credentials)
        return service
    except Exception as e:
        print(f"Error creating Google Calendar service: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return None

def create_google_calendar_event(schedule_data, calendar_id=None):
    """
    Google Calendarにイベントを作成
    
    Args:
        schedule_data: スケジュールデータ（辞書形式）
            - date: 日付 (YYYY-MM-DD)
            - time_slot: 時間帯 (HH:MM-HH:MM または HH:MM)
            - store_name: 店舗名
            - client_name: クライアント名
            - address: 住所
            - cleaning_items: 清掃項目のリスト
            - notes: 備考
            - schedule_id: スケジュールID
        calendar_id: カレンダーID（指定がない場合は環境変数のデフォルト値を使用）
    
    Returns:
        dict: 作成されたイベントの情報、またはエラー情報
    """
    if not GOOGLE_CALENDAR_ENABLED:
        return {'success': False, 'message': 'Google Calendar integration is disabled'}
    
    service = get_google_calendar_service()
    if not service:
        return {'success': False, 'message': 'Failed to initialize Google Calendar service'}
    
    # カレンダーIDを決定（指定があればそれを使用、なければ環境変数から）
    target_calendar_id = calendar_id or schedule_data.get('calendar_id') or GOOGLE_CALENDAR_ID
    if not target_calendar_id:
        return {'success': False, 'message': 'Calendar ID is required. Set GOOGLE_CALENDAR_ID environment variable or specify calendar_id parameter.'}
    
    try:
        # 日付と時間をパース
        date_str = schedule_data.get('date') or schedule_data.get('scheduled_date', '')
        time_str = schedule_data.get('time_slot') or schedule_data.get('scheduled_time', '10:00')
        
        # 開始時刻を取得（HH:MM形式を想定）
        if '-' in time_str:
            start_time_str = time_str.split('-')[0].strip()
        else:
            start_time_str = time_str.strip()
        
        # 日時を組み合わせてISO形式に変換
        start_datetime_str = f"{date_str}T{start_time_str}:00"
        start_datetime = datetime.strptime(start_datetime_str, '%Y-%m-%dT%H:%M:%S')
        
        # 終了時刻を計算（デフォルトは1時間後）
        duration_minutes = schedule_data.get('duration_minutes', 60)
        end_datetime = start_datetime + timedelta(minutes=duration_minutes)
        
        # イベントのタイトルを作成
        store_name = schedule_data.get('store_name', '')
        client_name = schedule_data.get('client_name', '')
        if store_name and client_name:
            title = f"{client_name} {store_name} - 清掃"
        elif store_name:
            title = f"{store_name} - 清掃"
        else:
            title = "清掃予定"
        
        # イベントの説明を作成
        description_parts = []
        
        # 清掃項目
        cleaning_items = schedule_data.get('cleaning_items', [])
        if cleaning_items:
            items_text = '\n'.join([
                f"・{item.get('name', '')}" + 
                (f" ({item.get('quantity', '')}{item.get('unit', '')})" if item.get('quantity') else '')
                for item in cleaning_items
            ])
            description_parts.append(f"【清掃項目】\n{items_text}")
        
        # 備考
        notes = schedule_data.get('notes', '')
        if notes:
            description_parts.append(f"【備考】\n{notes}")
        
        # 住所
        address = schedule_data.get('address', '')
        if address:
            description_parts.append(f"【住所】\n{address}")
        
        # スケジュールID
        schedule_id = schedule_data.get('schedule_id') or schedule_data.get('id', '')
        if schedule_id:
            description_parts.append(f"【スケジュールID】\n{schedule_id}")
        
        description = '\n\n'.join(description_parts) if description_parts else ''
        
        # イベントオブジェクトを作成
        event = {
            'summary': title,
            'description': description,
            'start': {
                'dateTime': start_datetime.isoformat(),
                'timeZone': 'Asia/Tokyo',
            },
            'end': {
                'dateTime': end_datetime.isoformat(),
                'timeZone': 'Asia/Tokyo',
            },
        }
        
        # 住所がある場合は場所として追加
        if address:
            event['location'] = address
        
        # イベントを作成
        created_event = service.events().insert(
            calendarId=target_calendar_id,
            body=event
        ).execute()
        
        return {
            'success': True,
            'event_id': created_event.get('id'),
            'html_link': created_event.get('htmlLink'),
            'message': 'Google Calendarイベントを作成しました'
        }
    except Exception as e:
        print(f"Error creating Google Calendar event: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'success': False,
            'message': f'Failed to create Google Calendar event: {str(e)}'
        }

def get_google_calendar_event(event_id, calendar_id=None):
    """
    Google Calendarから特定のイベントを取得
    
    Args:
        event_id: Google CalendarのイベントID
        calendar_id: カレンダーID（指定がない場合は環境変数のデフォルト値を使用）
    
    Returns:
        dict: イベント情報、またはエラー情報
    """
    if not GOOGLE_CALENDAR_ENABLED:
        return {'success': False, 'message': 'Google Calendar integration is disabled'}
    
    service = get_google_calendar_service()
    if not service:
        return {'success': False, 'message': 'Failed to initialize Google Calendar service'}
    
    # カレンダーIDを決定（指定があればそれを使用、なければ環境変数から）
    target_calendar_id = calendar_id or GOOGLE_CALENDAR_ID
    if not target_calendar_id:
        return {'success': False, 'message': 'Calendar ID is required. Set GOOGLE_CALENDAR_ID environment variable or specify calendar_id parameter.'}
    
    try:
        event = service.events().get(
            calendarId=target_calendar_id,
            eventId=event_id
        ).execute()
        
        # イベント情報を整形
        result = {
            'success': True,
            'event_id': event.get('id'),
            'summary': event.get('summary', ''),
            'description': event.get('description', ''),
            'location': event.get('location', ''),
            'start': event.get('start', {}),
            'end': event.get('end', {}),
            'html_link': event.get('htmlLink', ''),
            'created': event.get('created', ''),
            'updated': event.get('updated', ''),
            'status': event.get('status', '')
        }
        
        # 説明からスケジュールIDを抽出（【スケジュールID】の行を探す）
        description = event.get('description', '')
        if description:
            for line in description.split('\n'):
                if '【スケジュールID】' in line or 'スケジュールID' in line:
                    # 次の行にスケジュールIDがある可能性
                    lines = description.split('\n')
                    idx = lines.index(line) if line in lines else -1
                    if idx >= 0 and idx + 1 < len(lines):
                        schedule_id = lines[idx + 1].strip()
                        if schedule_id:
                            result['schedule_id'] = schedule_id
                    break
        
        return result
    except Exception as e:
        print(f"Error getting Google Calendar event: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'success': False,
            'message': f'Failed to get Google Calendar event: {str(e)}'
        }

def list_google_calendar_events(start_date=None, end_date=None, max_results=100, calendar_id=None):
    """
    Google Calendarからイベント一覧を取得
    
    Args:
        start_date: 開始日時 (ISO 8601形式、例: '2025-01-15T00:00:00+09:00')
        end_date: 終了日時 (ISO 8601形式、例: '2025-01-15T23:59:59+09:00')
        max_results: 最大取得件数（デフォルト: 100）
        calendar_id: カレンダーID（指定がない場合は環境変数のデフォルト値を使用）
    
    Returns:
        dict: イベント一覧、またはエラー情報
    """
    if not GOOGLE_CALENDAR_ENABLED:
        return {'success': False, 'message': 'Google Calendar integration is disabled'}
    
    service = get_google_calendar_service()
    if not service:
        return {'success': False, 'message': 'Failed to initialize Google Calendar service'}
    
    # カレンダーIDを決定（指定があればそれを使用、なければ環境変数から）
    target_calendar_id = calendar_id or GOOGLE_CALENDAR_ID
    if not target_calendar_id:
        return {'success': False, 'message': 'Calendar ID is required. Set GOOGLE_CALENDAR_ID environment variable or specify calendar_id parameter.'}
    
    try:
        # デフォルト値の設定
        if not start_date:
            # 今日の0時（JST）
            from datetime import timezone, timedelta
            jst = timezone(timedelta(hours=9))
            today = datetime.now(jst).replace(hour=0, minute=0, second=0, microsecond=0)
            start_date = today.isoformat()
        elif 'T' not in start_date or '+' not in start_date:
            # 日付文字列または不完全な形式の場合は、ISO 8601形式に変換
            if 'T' not in start_date:
                start_date = f"{start_date}T00:00:00+09:00"
            elif '+' not in start_date:
                start_date = start_date + '+09:00'
        
        if not end_date:
            # 30日後（JST）
            from datetime import timezone, timedelta
            jst = timezone(timedelta(hours=9))
            end_date_obj = datetime.now(jst) + timedelta(days=30)
            end_date = end_date_obj.isoformat()
        elif 'T' not in end_date or '+' not in end_date:
            # 日付文字列または不完全な形式の場合は、ISO 8601形式に変換
            if 'T' not in end_date:
                end_date = f"{end_date}T23:59:59+09:00"
            elif '+' not in end_date:
                end_date = end_date + '+09:00'
        
        # イベント一覧を取得
        events_result = service.events().list(
            calendarId=target_calendar_id,
            timeMin=start_date,
            timeMax=end_date,
            maxResults=max_results,
            singleEvents=True,
            orderBy='startTime'
        ).execute()
        
        events = events_result.get('items', [])
        
        # イベント情報を整形
        formatted_events = []
        for event in events:
            formatted_event = {
                'event_id': event.get('id'),
                'summary': event.get('summary', ''),
                'description': event.get('description', ''),
                'location': event.get('location', ''),
                'start': event.get('start', {}),
                'end': event.get('end', {}),
                'html_link': event.get('htmlLink', ''),
                'status': event.get('status', '')
            }
            
            # 説明からスケジュールIDを抽出
            description = event.get('description', '')
            if description:
                for line in description.split('\n'):
                    if '【スケジュールID】' in line or 'スケジュールID' in line:
                        lines = description.split('\n')
                        idx = lines.index(line) if line in lines else -1
                        if idx >= 0 and idx + 1 < len(lines):
                            schedule_id = lines[idx + 1].strip()
                            if schedule_id:
                                formatted_event['schedule_id'] = schedule_id
                        break
            
            formatted_events.append(formatted_event)
        
        return {
            'success': True,
            'events': formatted_events,
            'count': len(formatted_events)
        }
    except Exception as e:
        print(f"Error listing Google Calendar events: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'success': False,
            'message': f'Failed to list Google Calendar events: {str(e)}'
        }

def sync_google_calendar_event_to_schedule(event_data):
    """
    Google CalendarイベントをDynamoDBのschedulesテーブルに同期
    
    Args:
        event_data: Google Calendarイベントデータ（get_google_calendar_eventの結果形式）
    
    Returns:
        dict: 同期結果
    """
    try:
        event_id = event_data.get('event_id')
        if not event_id:
            return {'success': False, 'message': 'event_id is required'}
        
        # 既存のスケジュールを確認（google_calendar_event_idで検索）
        existing_schedule = None
        try:
            # スキャンでgoogle_calendar_event_idを検索
            response = SCHEDULES_TABLE.scan(
                FilterExpression=Attr('google_calendar_event_id').eq(event_id)
            )
            items = response.get('Items', [])
            if items:
                existing_schedule = items[0]
        except Exception as e:
            print(f"Error checking existing schedule: {str(e)}")
        
        # イベント情報からスケジュールデータを構築
        summary = event_data.get('summary', '')
        description = event_data.get('description', '')
        location = event_data.get('location', '')
        start = event_data.get('start', {})
        end = event_data.get('end', {})
        
        # 日付と時間を抽出
        start_datetime_str = start.get('dateTime') or start.get('date', '')
        end_datetime_str = end.get('dateTime') or end.get('date', '')
        
        # ISO形式の日時をパース
        if start_datetime_str:
            if 'T' in start_datetime_str:
                # dateTime形式
                start_dt = datetime.fromisoformat(start_datetime_str.replace('Z', '+00:00'))
                scheduled_date = start_dt.strftime('%Y-%m-%d')
                scheduled_time = start_dt.strftime('%H:%M')
            else:
                # date形式（終日イベント）
                scheduled_date = start_datetime_str
                scheduled_time = '10:00'  # デフォルト時刻
        else:
            return {'success': False, 'message': 'start time is required'}
        
        # 説明から情報を抽出
        schedule_id = event_data.get('schedule_id')  # 既に抽出済み
        cleaning_items = []
        notes = ''
        store_name = ''
        client_name = ''
        
        if description:
            lines = description.split('\n')
            current_section = None
            for line in lines:
                line = line.strip()
                if '【清掃項目】' in line:
                    current_section = 'cleaning_items'
                elif '【備考】' in line:
                    current_section = 'notes'
                elif '【住所】' in line:
                    current_section = 'address'
                elif '【スケジュールID】' in line:
                    current_section = 'schedule_id'
                elif line.startswith('・') and current_section == 'cleaning_items':
                    # 清掃項目を抽出
                    item_name = line.replace('・', '').strip()
                    if item_name:
                        cleaning_items.append({'name': item_name})
                elif current_section == 'notes' and line:
                    notes = line
                elif current_section == 'address' and line:
                    location = line  # 住所を上書き
        
        # タイトルから店舗名とクライアント名を抽出
        if summary:
            # "【定期清掃】クライアント名 店舗名（備考）" の形式を想定
            # または "クライアント名 店舗名 - 清掃" の形式
            summary_clean = summary
            # 【定期清掃】などのプレフィックスを削除
            if '【' in summary_clean and '】' in summary_clean:
                summary_clean = summary_clean.split('】', 1)[1] if '】' in summary_clean else summary_clean
            
            # 括弧内の備考を削除
            import re
            summary_clean = re.sub(r'（[^）]*）', '', summary_clean)
            summary_clean = re.sub(r'\([^)]*\)', '', summary_clean)
            summary_clean = summary_clean.strip()
            
            # 店舗名を抽出（locationがあれば優先、なければsummaryから）
            if location:
                # locationから店舗名を抽出（カンマの前の部分）
                location_parts = location.split(',')
                if location_parts:
                    store_name = location_parts[0].strip()
            
            if not store_name and summary_clean:
                # summaryから抽出
                if ' - ' in summary_clean:
                    name_part = summary_clean.split(' - ')[0]
                    parts = name_part.split(' ', 1)
                    if len(parts) >= 2:
                        client_name = parts[0]
                        store_name = parts[1]
                    else:
                        store_name = name_part
                else:
                    # スペースで分割して最後の部分を店舗名とする
                    parts = summary_clean.split()
                    if len(parts) >= 2:
                        # 最初の部分をクライアント名、残りを店舗名とする
                        client_name = parts[0]
                        store_name = ' '.join(parts[1:])
                    else:
                        store_name = summary_clean
        
        # スケジュールIDが既に存在する場合は更新、なければ新規作成
        now = datetime.utcnow().isoformat() + 'Z'
        
        if existing_schedule:
            # 既存スケジュールを更新
            schedule_id = existing_schedule.get('id')
            update_expression_parts = []
            expression_attribute_values = {}
            expression_attribute_names = {}
            
            update_expression_parts.append('updated_at = :updated_at')
            expression_attribute_values[':updated_at'] = now
            
            if scheduled_date:
                update_expression_parts.append('#date = :date')
                expression_attribute_names['#date'] = 'date'
                expression_attribute_values[':date'] = scheduled_date
                update_expression_parts.append('scheduled_date = :scheduled_date')
                expression_attribute_values[':scheduled_date'] = scheduled_date
            
            if scheduled_time:
                update_expression_parts.append('time_slot = :time_slot')
                expression_attribute_values[':time_slot'] = scheduled_time
                update_expression_parts.append('scheduled_time = :scheduled_time')
                expression_attribute_values[':scheduled_time'] = scheduled_time
            
            if store_name:
                update_expression_parts.append('store_name = :store_name')
                expression_attribute_values[':store_name'] = store_name
            
            if client_name:
                update_expression_parts.append('client_name = :client_name')
                expression_attribute_values[':client_name'] = client_name
            
            if location:
                update_expression_parts.append('address = :address')
                expression_attribute_values[':address'] = location
            
            if cleaning_items:
                update_expression_parts.append('cleaning_items = :cleaning_items')
                expression_attribute_values[':cleaning_items'] = cleaning_items
            
            if notes:
                update_expression_parts.append('notes = :notes')
                expression_attribute_values[':notes'] = notes
            
            # google_calendar_event_idを確実に設定
            update_expression_parts.append('google_calendar_event_id = :event_id')
            expression_attribute_values[':event_id'] = event_id
            
            update_params = {
                'Key': {'id': schedule_id},
                'UpdateExpression': 'SET ' + ', '.join(update_expression_parts),
                'ExpressionAttributeValues': expression_attribute_values
            }
            if expression_attribute_names:
                update_params['ExpressionAttributeNames'] = expression_attribute_names
            
            SCHEDULES_TABLE.update_item(**update_params)
            
            return {
                'success': True,
                'action': 'updated',
                'schedule_id': schedule_id,
                'message': 'スケジュールを更新しました'
            }
        else:
            # 新規スケジュールを作成
            if not schedule_id:
                # スケジュールIDがなければ生成
                schedule_id = generate_schedule_id(scheduled_date, SCHEDULES_TABLE)
            
            schedule_item = {
                'id': schedule_id,
                'created_at': now,
                'updated_at': now,
                'date': scheduled_date,
                'scheduled_date': scheduled_date,
                'time_slot': scheduled_time,
                'scheduled_time': scheduled_time,
                'order_type': 'regular',
                'store_id': '',  # 後で設定可能
                'store_name': store_name,
                'client_name': client_name,
                'address': location,
                'cleaning_items': cleaning_items,
                'notes': notes,
                'status': 'draft',
                'google_calendar_event_id': event_id
            }
            
            SCHEDULES_TABLE.put_item(Item=schedule_item)
            
            return {
                'success': True,
                'action': 'created',
                'schedule_id': schedule_id,
                'message': 'スケジュールを作成しました'
            }
            
    except Exception as e:
        print(f"Error syncing Google Calendar event to schedule: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'success': False,
            'message': f'Failed to sync event to schedule: {str(e)}'
        }

# Cognitoクライアントの初期化
cognito_client = boto3.client('cognito-idp', region_name='ap-northeast-1')
# SESクライアントの初期化
ses_client = boto3.client('ses', region_name='ap-northeast-1')
COGNITO_USER_POOL_ID = 'ap-northeast-1_EDKElIGoC'

# S3クライアントの初期化
s3_client = boto3.client('s3')

# DynamoDBリソースの初期化
dynamodb = boto3.resource('dynamodb')
ANNOUNCEMENTS_TABLE = dynamodb.Table('business-announcements')
ANNOUNCEMENT_READS_TABLE = dynamodb.Table('business-announcement-reads')
REPORTS_TABLE = dynamodb.Table('staff-reports')
CLEANING_LOGS_TABLE = dynamodb.Table('cleaning-logs')
NFC_TAGS_TABLE = dynamodb.Table('nfc-tags')
SCHEDULES_TABLE = dynamodb.Table('schedules')
ESTIMATES_TABLE = dynamodb.Table('estimates')
WORKERS_TABLE = dynamodb.Table('workers')
CLIENTS_TABLE = dynamodb.Table('misesapo-clients')
BRANDS_TABLE = dynamodb.Table('misesapo-brands')
STORES_TABLE = dynamodb.Table('misesapo-stores')
ATTENDANCE_TABLE = dynamodb.Table('attendance')
ATTENDANCE_ERRORS_TABLE = dynamodb.Table('attendance-errors')
ATTENDANCE_REQUESTS_TABLE = dynamodb.Table('attendance-requests')
HOLIDAYS_TABLE = dynamodb.Table('holidays')
INVENTORY_ITEMS_TABLE = dynamodb.Table('inventory-items')
INVENTORY_TRANSACTIONS_TABLE = dynamodb.Table('inventory-transactions')
DAILY_REPORTS_TABLE = dynamodb.Table('daily-reports')
TODOS_TABLE = dynamodb.Table('todos')
REIMBURSEMENTS_TABLE = dynamodb.Table('misesapo-reimbursements')

# 環境変数から設定を取得
S3_BUCKET_NAME = os.environ.get('S3_BUCKET_NAME', 'misesapo-cleaning-manual-images')
S3_REGION = os.environ.get('S3_REGION', 'ap-northeast-1')
ALLOWED_ORIGINS = [origin.strip() for origin in os.environ.get('ALLOWED_ORIGINS', '*').split(',') if origin.strip()]
# Add misesapo.co.jp explicitly to avoid CORS issues
# Add misesapo.co.jp explicitly to avoid CORS issues
# 本番環境で環境変数設定が漏れていても動作するように、確実にリストに追加する
_required_origins = [
    'https://misesapo.co.jp', 
    'https://www.misesapo.co.jp'
]
for _org in _required_origins:
    if _org not in ALLOWED_ORIGINS and '*' not in ALLOWED_ORIGINS:
        ALLOWED_ORIGINS.append(_org)

# Google Calendar API設定（※このプロジェクトでは今後Googleカレンダーを使用しない方針）
# - Google側の共有を外しても、システムが誤って同期処理を試みると権限エラーが発生し得るため、
#   「環境変数が残っていても」Google APIを呼ばないようにコード側で恒久的に無効化する。
# - 既存データ（google_calendar_event_id 等）がDBに残っていても問題ないが、今後は利用しない。
GOOGLE_CALENDAR_ENABLED = False
GOOGLE_CALENDAR_ID = None
GOOGLE_SERVICE_ACCOUNT_JSON = None
GOOGLE_SERVICE_ACCOUNT_SECRET_NAME = None
print("INFO: Google Calendar integration is permanently disabled by code (project policy).")

# データファイルのS3キー
DATA_KEY = 'cleaning-manual/data.json'
DRAFT_KEY = 'cleaning-manual/draft.json'
SERVICES_KEY = 'services/service_items.json'
WIKI_KEY = 'wiki/wiki_entries.json'

def resolve_cors_origin(event_headers: dict) -> str:
    origin = event_headers.get("origin") or event_headers.get("Origin") or ""
    if not origin:
        return ALLOWED_ORIGINS[0] if ALLOWED_ORIGINS else "*"
    
    # * が許可されている、あるいは特定のオリジンが許可リストにある場合はそのオリジンを返す
    if "*" in ALLOWED_ORIGINS or origin in ALLOWED_ORIGINS:
        return origin
    
    return ALLOWED_ORIGINS[0] if ALLOWED_ORIGINS else "*"

def lambda_handler(event, context):
    """
    S3に画像をアップロード、または清掃マニュアルデータの読み書きを行うLambda関数
    """
    # パスとメソッドを取得（複数の可能性を試す）
    # API Gatewayのプロキシ統合の場合
    path = event.get('path', '') or event.get('resourcePath', '') or event.get('resource', '')
    method = event.get('httpMethod', '') or event.get('method', '')
    
    # リクエストパスを取得（リクエストパラメータから）
    if not path:
        request_context = event.get('requestContext', {})
        path = request_context.get('path', '') or request_context.get('resourcePath', '')
        if not method:
            method = request_context.get('http', {}).get('method', '')
    
    # CORSヘッダー
    event_headers = event.get("headers") or {}
    headers = {
        'Access-Control-Allow-Origin': resolve_cors_origin(event_headers),
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE,OPTIONS',
        'Access-Control-Allow-Credentials': 'false',
        'Content-Type': 'application/json'
    }
    
    # OPTIONSリクエスト（プリフライト）の処理
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'message': 'OK'})
        }
    
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
        elif normalized_path == '/ai/process':
            # AIによるデータ処理（要約・生成・分析）
            if method == 'POST':
                return handle_ai_process(event, headers)
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
        elif normalized_path == '/announcements' or normalized_path == '/staff/announcements' or normalized_path == '/admin/announcements':
            # お知らせデータの読み書き
            if method == 'GET':
                return get_announcements(headers)
            elif method == 'POST' or method == 'PUT':
                return create_announcement(event, headers)
        elif normalized_path == '/staff/reports' or normalized_path == '/staff/os/reports':
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
            elif method == 'PUT':
                return update_inventory_item(product_id, event, headers)
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
        elif normalized_path == '/staff/nfc/clock-in':
            # NFCタグ打刻
            if method == 'POST':
                return handle_nfc_clock_in(event, headers)
            elif method == 'GET':
                return get_nfc_clock_in_logs(event, headers)
        elif normalized_path == '/staff/nfc/tag':
            # NFCタグ情報取得
            if method == 'GET':
                return get_nfc_tag_info(event, headers)
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
        elif normalized_path == '/admin/accounting/schedules':
            # 経理・財務用スケジュール一覧（報告書状況付き）
            if method == 'GET':
                return get_accounting_schedules(event, headers)
        elif normalized_path == '/admin/accounting/reports/issue':
            # 報告書発行
            if method == 'POST':
                return issue_formal_report(event, headers)
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
        elif normalized_path.startswith('/attendance/errors/') and normalized_path.endswith('/resolve'):
            # 出退勤エラーログを解決済みにマーク
            error_id = normalized_path.split('/')[-2]
            if method == 'PUT':
                return resolve_attendance_error(error_id, headers)
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
            elif method == 'DELETE':
                return delete_attendance(attendance_id, headers)
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
        elif normalized_path == '/admin/schedules/clear':
            # 危険操作: スケジュールを全件削除（誤操作防止のため確認文字列必須）
            # Googleカレンダーには一切触れない（システム側のみクリア）
            if method in ['POST', 'DELETE']:
                return clear_all_schedules(event, headers)
            return {
                'statusCode': 405,
                'headers': headers,
                'body': json.dumps({'error': 'Method not allowed'}, ensure_ascii=False)
            }
        elif normalized_path == '/schedules':
            # スケジュールデータの読み書き
            if method == 'GET':
                return get_schedules(event, headers)
            elif method == 'POST':
                return create_schedule(event, headers)
        elif normalized_path == '/google-calendar/events':
            # Google Calendar連携は廃止（今後はシステム内スケジュールのみ）
            return {
                'statusCode': 410,
                'headers': headers,
                'body': json.dumps({
                    'success': False,
                    'error': 'gone',
                    'message': 'Google Calendar integration is disabled (project policy).'
                }, ensure_ascii=False)
            }
        elif normalized_path == '/daily-reports':
            # 日報の取得・作成
            # クエリパラメータで分岐
            query_params = event.get('queryStringParameters') or {}
            
            if query_params.get('type') == 'cleaning':
                # 清掃レポート（Cleaning Reports）
                if method == 'GET':
                    return get_reports(event, headers)
                elif method == 'POST':
                    return create_report(event, headers)
                elif method == 'PUT':
                    return update_report(event, headers)
            elif query_params.get('type') == 'cleaning_image':
                # 画像アップロード
                if method == 'POST':
                    return upload_report_image(event, headers)
            else:
                # 既存の日報（Daily Reports）
                if method == 'GET':
                    return get_daily_reports(event, headers)
                elif method == 'POST':
                    return create_or_update_daily_report(event, headers)
        elif normalized_path.startswith('/daily-reports/'):
            # 日報の詳細・更新・削除
            report_id = normalized_path.split('/')[-1]
            if method == 'GET':
                return get_daily_report_detail(report_id, headers)
            elif method == 'PUT':
                return create_or_update_daily_report(event, headers)
            elif method == 'DELETE':
                return delete_daily_report(report_id, headers)
        elif normalized_path == '/todos':
            # TODOの取得・作成
            if method == 'GET':
                return get_todos(event, headers)
            elif method == 'POST':
                return create_todo(event, headers)
        elif normalized_path.startswith('/todos/'):
            # TODOの詳細・更新・削除
            todo_id = normalized_path.split('/')[-1]
            if method == 'GET':
                return get_todo_detail(todo_id, headers)
            elif method == 'PUT':
                return update_todo(todo_id, event, headers)
            elif method == 'DELETE':
                return delete_todo(todo_id, headers)
        elif normalized_path == '/reimbursements':
            # 立て替え精算の取得・作成
            if method == 'GET':
                return get_reimbursements(event, headers)
            elif method == 'POST':
                return create_reimbursement(event, headers)
        elif normalized_path.startswith('/reimbursements/'):
            # 立て替え精算の詳細・更新・削除
            reimbursement_id = normalized_path.split('/')[-1]
            if method == 'GET':
                return get_reimbursement_detail(reimbursement_id, headers)
            elif method == 'PUT':
                return update_reimbursement(reimbursement_id, event, headers)
            elif method == 'DELETE':
                return delete_reimbursement(reimbursement_id, headers)
        elif normalized_path.startswith('/google-calendar/events/'):
            # Google Calendar連携は廃止（今後はシステム内スケジュールのみ）
            return {
                'statusCode': 410,
                'headers': headers,
                'body': json.dumps({
                    'success': False,
                    'error': 'gone',
                    'message': 'Google Calendar integration is disabled (project policy).'
                }, ensure_ascii=False)
            }
        elif normalized_path == '/google-calendar/sync':
            # Google Calendar連携は廃止（今後はシステム内スケジュールのみ）
            return {
                'statusCode': 410,
                'headers': headers,
                'body': json.dumps({
                    'success': False,
                    'error': 'gone',
                    'message': 'Google Calendar integration is disabled (project policy).'
                }, ensure_ascii=False)
            }
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
        elif normalized_path == '/brands':
            # ブランド一覧の取得・作成
            if method == 'GET':
                return get_brands(event, headers)
            elif method == 'POST':
                return create_brand(event, headers)
            else:
                return {
                    'statusCode': 405,
                    'headers': headers,
                    'body': json.dumps({'error': 'Method not allowed'}, ensure_ascii=False)
                }
        elif normalized_path.startswith('/brands/'):
            # ブランド詳細の取得・更新・削除
            brand_id = normalized_path.split('/')[-1]
            if method == 'GET':
                return get_brand_detail(brand_id, headers)
            elif method == 'PUT':
                return update_brand(brand_id, event, headers)
            elif method == 'DELETE':
                return delete_brand(brand_id, headers)
            else:
                return {
                    'statusCode': 405,
                    'headers': headers,
                    'body': json.dumps({'error': 'Method not allowed'}, ensure_ascii=False)
                }
        elif normalized_path == '/stores':
            # 店舗一覧の取得・作成
            if method == 'GET':
                return get_stores(event, headers)
            elif method == 'POST':
                return create_store(event, headers)
            else:
                return {
                    'statusCode': 405,
                    'headers': headers,
                    'body': json.dumps({'error': 'Method not allowed'}, ensure_ascii=False)
                }
        elif normalized_path.startswith('/stores/'):
            # 店舗詳細の取得・更新・削除
            store_id = normalized_path.split('/')[-1]
            if method == 'GET':
                return get_store_detail(store_id, headers)
            elif method == 'PUT':
                return update_store(store_id, event, headers)
            elif method == 'DELETE':
                return delete_store(store_id, headers)
            else:
                return {
                    'statusCode': 405,
                    'headers': headers,
                    'body': json.dumps({'error': 'Method not allowed'}, ensure_ascii=False)
                }
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
        
        # ロールを取得（カスタムクレーム、グループ、またはデフォルト）
        role = payload.get('custom:role') or payload.get('role')
        
        # Cognitoグループをチェック
        groups = payload.get('cognito:groups', [])
        if not role and groups:
            if 'admin' in groups or 'ADMIN' in groups:
                role = 'admin'
            elif 'staff' in groups or 'STAFF' in groups:
                role = 'cleaning'
        
        # デフォルトロール
        if not role:
            role = 'cleaning'
        
        return {
            'uid': uid,
            'cognito_sub': uid,
            'email': email,
            'name': name,
            'role': role,
            'verified': True  # Cognitoトークンがデコードできた場合は認証済みとみなす
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

def upload_report_photo_with_metadata(base64_image, category, cleaning_date, staff_id=None, folder_name=None, image_hash=None):
    """
    レポート用画像を日付単位でS3に保存し、メタデータをDynamoDBに保存
    
    Args:
        base64_image: Base64エンコードされた画像
        category: 'before' または 'after'
        cleaning_date: 清掃日 (YYYY-MM-DD形式)
        staff_id: 清掃員ID（オプション）
        folder_name: フォルダ名（オプション）
        image_hash: 画像のハッシュ値（オプション、指定されない場合は計算）
    
    Returns:
        dict: { image_id, url, category, date, folder_name }
    """
    try:
        # 画像データをデコード
        if ',' in base64_image:
            base64_image = base64_image.split(',')[-1]
        image_data = base64.b64decode(base64_image)
        
        # ハッシュ値を計算（指定されていない場合）
        if not image_hash:
            image_hash = hashlib.sha256(image_data).hexdigest()
        
        # 重複チェック：同じハッシュ値の画像が既に存在するか確認
        report_images_table = dynamodb.Table('report-images')
        try:
            response = report_images_table.scan(
                FilterExpression=Attr('image_hash').eq(image_hash)
            )
            existing_images = response.get('Items', [])
            
            if existing_images:
                # 既存の画像が見つかった場合、エラーを返す
                existing_image = existing_images[0]
                raise ValueError(f'この画像は既にアップロードされています（画像ID: {existing_image.get("image_id", "unknown")}）')
        except Exception as e:
            # 重複エラーの場合はそのまま再スロー
            if '既にアップロードされています' in str(e):
                raise
            # その他のエラー（テーブルが存在しない、属性がないなど）は無視して続行
            print(f"Warning: Could not check for duplicates: {str(e)}")
        
        # 画像IDを生成（ユニークなUUID）
        image_id = str(uuid.uuid4())[:8]
        
        # 日付をパース
        date_parts = cleaning_date.split('-')
        year = date_parts[0]
        month = date_parts[1]
        day = date_parts[2]
        
        # S3キーを生成（フォルダ名がある場合は含める）
        # before/2025/12/04/abc12345.jpg または
        # before/2025/12/04/フォルダ名/abc12345.jpg
        if folder_name:
            # フォルダ名を安全な文字列に変換（スラッシュやスペースをアンダースコアに）
            safe_folder_name = folder_name.replace('/', '_').replace(' ', '_')
            s3_key = f"{category}/{year}/{month}/{day}/{safe_folder_name}/{image_id}.jpg"
        else:
            s3_key = f"{category}/{year}/{month}/{day}/{image_id}.jpg"
        
        # S3にアップロード
        s3_client.put_object(
            Bucket=S3_BUCKET_NAME,
            Key=s3_key,
            Body=image_data,
            ContentType='image/jpeg'
        )
        
        # 公開URLを生成
        photo_url = f"https://{S3_BUCKET_NAME}.s3.{S3_REGION}.amazonaws.com/{s3_key}"
        
        # メタデータをDynamoDBに保存
        metadata = {
            'image_id': image_id,
            'url': photo_url,
            's3_key': s3_key,
            'category': category,
            'cleaning_date': cleaning_date,
            'staff_id': staff_id or 'unknown',
            'uploaded_at': datetime.now(timezone(timedelta(hours=9))).isoformat(),
            'used_in_reports': [],  # このカラムに使用されたレポートIDを追加
            'image_hash': image_hash  # ハッシュ値を保存
        }
        
        # フォルダ名がある場合はメタデータに追加
        if folder_name:
            metadata['folder_name'] = folder_name
        
        report_images_table.put_item(Item=metadata)
        
        print(f"[upload_report_photo] Saved: {s3_key} (hash: {image_hash[:16]}...)")
        
        result = {
            'image_id': image_id,
            'url': photo_url,
            'category': category,
            'date': cleaning_date
        }
        
        if folder_name:
            result['folder_name'] = folder_name
        
        return result
    except ValueError as e:
        # 重複エラーはそのまま再スロー
        raise
    except Exception as e:
        print(f"Error uploading report photo: {str(e)}")
        raise

def get_report_images_by_date(cleaning_date, category=None, folder_name=None):
    """
    日付で画像を取得
    
    Args:
        cleaning_date: 清掃日 (YYYY-MM-DD形式)
        category: 'before', 'after', または None（両方）
        folder_name: フォルダ名（オプション、指定された場合はそのフォルダのみ）
    
    Returns:
        list: 画像メタデータのリスト
    """
    try:
        report_images_table = dynamodb.Table('report-images')
        
        # フィルタ式を構築
        filter_expr = Attr('cleaning_date').eq(cleaning_date)
        
        if category:
            filter_expr = filter_expr & Attr('category').eq(category)
        
        if folder_name:
            filter_expr = filter_expr & Attr('folder_name').eq(folder_name)
        
        response = report_images_table.scan(FilterExpression=filter_expr)
        
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
        - folder_name: フォルダ名（オプション）
        - image_hash: 画像のハッシュ値（オプション）
    """
    try:
        body = json.loads(event.get('body', '{}'))
        
        image_data = body.get('image')
        category = body.get('category')
        cleaning_date = body.get('cleaning_date')
        staff_id = body.get('staff_id', 'unknown')
        folder_name = body.get('folder_name')  # フォルダ名（オプション）
        image_hash = body.get('image_hash')  # ハッシュ値（オプション）
        
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
        
        # フォルダ名のバリデーション（空文字列の場合はNoneに変換）
        if folder_name and folder_name.strip():
            folder_name = folder_name.strip()
            if len(folder_name) > 50:
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({'error': 'フォルダ名は50文字以内で指定してください'}, ensure_ascii=False)
                }
        else:
            folder_name = None
        
        # 画像をアップロード
        result = upload_report_photo_with_metadata(image_data, category, cleaning_date, staff_id, folder_name, image_hash)
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'success': True,
                'image': result
            }, ensure_ascii=False)
        }
        
    except ValueError as e:
        # 重複エラー
        error_message = str(e)
        return {
            'statusCode': 409,  # Conflict
            'headers': headers,
            'body': json.dumps({'error': error_message}, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error uploading report image: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': str(e)}, ensure_ascii=False)
        }

def handle_nfc_clock_in(event, headers):
    """
    NFCタグ打刻処理
    
    Request Body:
        {
            "user_id": "WKR_001",
            "facility_id": "ABC_001",
            "location_id": "TK_R01_TOILET_IN"
        }
    
    Returns:
        - 200: 打刻成功
        - 400: 入力データ不足
        - 500: サーバーエラー
    """
    try:
        # リクエストボディを取得
        body = event.get('body', '{}')
        if isinstance(body, str):
            body_json = json.loads(body)
        else:
            body_json = body
        
        # 必須パラメータの取得
        user_id = body_json.get('user_id')
        facility_id = body_json.get('facility_id')
        location_id = body_json.get('location_id')
        
        # バリデーション
        if not user_id:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': 'user_id is required'
                }, ensure_ascii=False)
            }
        
        if not facility_id:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': 'facility_id is required'
                }, ensure_ascii=False)
            }
        
        if not location_id:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': 'location_id is required'
                }, ensure_ascii=False)
            }
        
        # 現在時刻をUTC形式で取得
        timestamp = datetime.now(timezone.utc).isoformat()
        
        # 打刻ログIDを生成（UUID）
        log_id = str(uuid.uuid4())
        
        # DynamoDBに保存するデータ
        log_item = {
            'log_id': log_id,  # パーティションキー
            'timestamp': timestamp,  # ソートキー
            'user_id': user_id,
            'facility_id': facility_id,
            'location_id': location_id,
            'created_at': timestamp
        }
        
        # DynamoDBに保存
        CLEANING_LOGS_TABLE.put_item(Item=log_item)
        
        print(f"[NFC Clock-in] Recorded: user_id={user_id}, facility_id={facility_id}, location_id={location_id}, timestamp={timestamp}")
        
        # 成功レスポンス
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'message': 'Clock-in recorded',
                'log_id': log_id,
                'timestamp': timestamp
            }, ensure_ascii=False)
        }
        
    except json.JSONDecodeError as e:
        return {
            'statusCode': 400,
            'headers': headers,
            'body': json.dumps({
                'error': 'Invalid JSON format',
                'message': str(e)
            }, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error handling NFC clock-in: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e)
            }, ensure_ascii=False)
        }

def get_nfc_clock_in_logs(event, headers):
    """
    NFCタグ打刻ログを取得
    
    Query Parameters:
        - user_id: ユーザーID（オプション）
        - facility_id: 施設ID（オプション）
        - location_id: 場所ID（オプション）
        - start_date: 開始日時（ISO 8601形式、オプション）
        - end_date: 終了日時（ISO 8601形式、オプション）
        - limit: 取得件数（デフォルト: 100、最大: 1000）
    
    Returns:
        - 200: ログ取得成功
        - 500: サーバーエラー
    """
    try:
        # 認証チェック（開発環境では緩和）
        auth_header = event.get('headers', {}).get('Authorization') or event.get('headers', {}).get('authorization', '')
        id_token = auth_header.replace('Bearer ', '') if auth_header else ''
        
        # 開発環境ではdev-tokenを許可
        if id_token and id_token != 'dev-token':
            user_info = verify_firebase_token(id_token)
            if not user_info:
                print(f"[NFC Clock-in Logs] Invalid token: {id_token[:20]}...")
                # 開発環境ではエラーを返さない（後で削除可能）
                pass
        
        # クエリパラメータを取得
        params = event.get('queryStringParameters') or {}
        user_id = params.get('user_id')
        facility_id = params.get('facility_id')
        location_id = params.get('location_id')
        start_date = params.get('start_date')
        end_date = params.get('end_date')
        limit = int(params.get('limit', 100))
        
        # リミットの最大値を制限
        if limit > 1000:
            limit = 1000
        if limit < 1:
            limit = 100
        
        # フィルタ式を構築
        filter_expressions = []
        
        if user_id:
            filter_expressions.append(Attr('user_id').eq(user_id))
        if facility_id:
            filter_expressions.append(Attr('facility_id').eq(facility_id))
        if location_id:
            filter_expressions.append(Attr('location_id').eq(location_id))
        if start_date:
            filter_expressions.append(Attr('timestamp').gte(start_date))
        if end_date:
            filter_expressions.append(Attr('timestamp').lte(end_date))
        
        # スキャンまたはクエリを実行
        if filter_expressions:
            # フィルタがある場合はスキャン
            filter_expr = filter_expressions[0]
            for expr in filter_expressions[1:]:
                filter_expr = filter_expr & expr
            
            response = CLEANING_LOGS_TABLE.scan(
                FilterExpression=filter_expr,
                Limit=limit
            )
        else:
            # フィルタがない場合は全件スキャン（リミット付き）
            response = CLEANING_LOGS_TABLE.scan(Limit=limit)
        
        logs = response.get('Items', [])
        
        # timestampでソート（新しい順）
        logs.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        
        print(f"[NFC Clock-in Logs] Retrieved {len(logs)} logs")
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'count': len(logs),
                'logs': logs
            }, ensure_ascii=False, default=str)
        }
        
    except Exception as e:
        print(f"Error getting NFC clock-in logs: {str(e)}")
        import traceback
        traceback_str = traceback.format_exc()
        print(f"Traceback: {traceback_str}")
        
        # エラーの種類に応じて適切なステータスコードを返す
        error_message = str(e)
        status_code = 500
        error_type = 'Internal server error'
        
        # DynamoDBのリソースが見つからない場合
        if 'ResourceNotFoundException' in error_message or 'does not exist' in error_message:
            status_code = 404
            error_type = 'Resource not found'
            error_message = '打刻ログテーブルが見つかりません。テーブルが作成されているか確認してください。'
        # 権限エラーの場合
        elif 'AccessDeniedException' in error_message or 'UnauthorizedOperation' in error_message:
            status_code = 403
            error_type = 'Access denied'
            error_message = 'DynamoDBへのアクセス権限がありません。IAMポリシーを確認してください。'
        # クライアントエラーの場合
        elif 'ClientError' in error_message or 'ValidationException' in error_message:
            status_code = 400
            error_type = 'Bad request'
        
        return {
            'statusCode': status_code,
            'headers': headers,
            'body': json.dumps({
                'status': 'error',
                'error': error_type,
                'message': error_message,
                'details': traceback_str if status_code == 500 else None
            }, ensure_ascii=False, default=str)
        }

def get_nfc_tag_info(event, headers):
    """
    NFCタグ情報を取得（トリガー用）
    
    Query Parameters:
        - tag_id: NFCタグID（必須）
    
    Returns:
        - 200: タグ情報取得成功
        - 404: タグが見つからない
        - 400: tag_idが指定されていない
        - 500: サーバーエラー
    """
    try:
        # クエリパラメータを取得
        params = event.get('queryStringParameters') or {}
        tag_id = params.get('tag_id')
        
        if not tag_id:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': 'tag_id is required'
                }, ensure_ascii=False)
            }
        
        # DynamoDBからタグ情報を取得
        try:
            response = NFC_TAGS_TABLE.get_item(
                Key={'tag_id': tag_id}
            )
            
            if 'Item' not in response:
                return {
                    'statusCode': 404,
                    'headers': headers,
                    'body': json.dumps({
                        'error': 'NFC tag not found',
                        'tag_id': tag_id
                    }, ensure_ascii=False)
                }
            
            tag_info = response['Item']
            
            print(f"[NFC Tag Info] Retrieved: tag_id={tag_id}, facility_id={tag_info.get('facility_id')}, location_id={tag_info.get('location_id')}")
            
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({
                    'status': 'success',
                    'tag_id': tag_id,
                    'facility_id': tag_info.get('facility_id'),
                    'location_id': tag_info.get('location_id'),
                    'facility_name': tag_info.get('facility_name'),
                    'location_name': tag_info.get('location_name'),
                    'description': tag_info.get('description'),
                    'product_id': tag_info.get('product_id'),  # 在庫管理用
                    'uid': tag_info.get('uid')  # 物理UID（シリアルナンバー）
                }, ensure_ascii=False, default=str)
            }
            
        except Exception as db_error:
            print(f"Error querying NFC tag: {str(db_error)}")
            return {
                'statusCode': 500,
                'headers': headers,
                'body': json.dumps({
                    'error': 'Failed to retrieve NFC tag information',
                    'message': str(db_error)
                }, ensure_ascii=False)
            }
        
    except Exception as e:
        print(f"Error getting NFC tag info: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'Internal server error',
                'message': str(e)
            }, ensure_ascii=False)
        }

def get_report_images(event, headers):
    """
    レポート用画像一覧を取得（画像倉庫API）
    
    Query Parameters:
        - date: 清掃日 (YYYY-MM-DD形式)
        - category: 'before', 'after', または指定なし（両方）
        - folder_name: フォルダ名（オプション、指定された場合はそのフォルダのみ）
    """
    try:
        # クエリパラメータを取得
        params = event.get('queryStringParameters') or {}
        cleaning_date = params.get('date')
        category = params.get('category')
        folder_name = params.get('folder_name')  # フォルダ名（オプション）
        
        if not cleaning_date:
            # 日付が指定されていない場合は今日の日付を使用
            cleaning_date = datetime.now(timezone(timedelta(hours=9))).strftime('%Y-%m-%d')
        
        # フォルダ名が空文字列の場合はNoneに変換
        if folder_name and not folder_name.strip():
            folder_name = None
        
        # 画像を取得
        images = get_report_images_by_date(cleaning_date, category, folder_name)
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'date': cleaning_date,
                'category': category,
                'folder_name': folder_name,
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
                    'role': 'cleaning'
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
            'schedule_id': body_json.get('schedule_id'),  # スケジュールIDを保存
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
        
        # メール送信処理（清掃レポート通知）
        try:
            sender = "info@misesapo.co.jp"
            recipient = "info@misesapo.co.jp"
            
            clean_staff = body_json.get('staff_name', '') or user_info.get('uid', '不明')
            clean_store = body_json.get('store_name', '店舗不明')
            
            mail_subject = f"【清掃完了】{clean_store} - {clean_staff}"
            mail_body = f"清掃レポートが提出されました。\n\n" \
                        f"■店舗\n{clean_store}\n\n" \
                        f"■担当者\n{clean_staff}\n\n" \
                        f"■作成日時\n{now} (UTC)\n\n" \
                        f"■状態\n{body_json.get('status', '完了')}\n"
            
            ses_client.send_email(
                Source=sender,
                Destination={'ToAddresses': [recipient]},
                Message={
                    'Subject': {'Data': mail_subject},
                    'Body': {'Text': {'Data': mail_body}}
                }
            )
            print(f"Cleaning report notification email sent to {recipient}")
        except Exception as e:
            print(f"Failed to send cleaning report email: {str(e)}")
        
        # スケジュール情報も更新（report_idを紐付け）
        schedule_id = body_json.get('schedule_id')
        if schedule_id:
            try:
                print(f"[DEBUG] Updating schedule {schedule_id} with report_id {report_id}")
                SCHEDULES_TABLE.update_item(
                    Key={'id': schedule_id},
                    UpdateExpression='SET report_id = :rid, #s = :status, updated_at = :updated_at',
                    ExpressionAttributeNames={'#s': 'status'},
                    ExpressionAttributeValues={
                        ':rid': report_id,
                        ':status': 'completed',
                        ':updated_at': now
                    }
                )
            except Exception as e:
                print(f"[ERROR] Failed to update schedule {schedule_id}: {str(e)}")

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
        
        # スケジュールIDフィルター
        schedule_id_filter = query_params.get('schedule_id')
        if schedule_id_filter:
            filter_expressions.append(Attr('schedule_id').eq(schedule_id_filter))
        
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
            'brand_name': report.get('brand_name'),  # ブランド名
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
        
        # スケジュールIDを生成（新形式: SCH-YYYYMMDD-NNN）
        # フロントエンドから送信されるフィールド名に対応（scheduled_date または date）
        date_str = body_json.get('scheduled_date') or body_json.get('date', '')
        schedule_id = generate_schedule_id(date_str, SCHEDULES_TABLE)
        now = datetime.utcnow().isoformat() + 'Z'
        
        # 条件付き書き込みで重複を防止（最大5回リトライ）
        max_retries = 5
        retry_count = 0
        schedule_created = False
        
        while retry_count < max_retries and not schedule_created:
            try:
                # 既に存在するIDかチェック
                check_response = SCHEDULES_TABLE.get_item(Key={'id': schedule_id})
                if 'Item' in check_response:
                    # IDが存在する場合は連番をインクリメントして再生成
                    schedule_id = generate_schedule_id(date_str, SCHEDULES_TABLE)
                    retry_count += 1
                    continue
                
                # 見積もり情報が含まれている場合は、見積もりも同時に作成
                estimate_id = None
                estimate_data = body_json.get('estimate')
                if estimate_data and estimate_data.get('items') and len(estimate_data.get('items', [])) > 0:
                    # 見積もりIDを生成（UUID形式のまま）
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
                        'schedule_id': schedule_id  # 新形式のスケジュールIDを紐付け
                    }
                    
                    # 見積もりを保存
                    ESTIMATES_TABLE.put_item(Item=estimate_item)
                
                # DynamoDBに保存するアイテムを作成
                # フロントエンドから送信されるフィールド名に対応
                scheduled_date = body_json.get('scheduled_date') or body_json.get('date', '')
                scheduled_time = body_json.get('scheduled_time') or body_json.get('time_slot', '')
                store_id = body_json.get('store_id') or body_json.get('client_id')
                
                schedule_item = {
                    'id': schedule_id,  # 新形式のID（パーティションキー）
                    'created_at': now,
                    'updated_at': now,
                    'date': scheduled_date,
                    'scheduled_date': scheduled_date,  # フロントエンド用に追加
                    'time_slot': scheduled_time,
                    'scheduled_time': scheduled_time,  # フロントエンド用に追加
                    'duration_minutes': body_json.get('duration_minutes', 60),
                    'order_type': body_json.get('order_type', 'regular'),
                    'client_id': store_id,  # store_idをclient_idとして保存（既存のスキーマとの互換性）
                    'store_id': store_id,  # フロントエンド用に追加
                    'client_name': body_json.get('client_name', ''),
                    'brand_name': body_json.get('brand_name', ''),
                    'store_name': body_json.get('store_name', ''),
                    'address': body_json.get('address', ''),
                    'phone': body_json.get('phone', ''),
                    'email': body_json.get('email', ''),
                    'cleaning_items': body_json.get('cleaning_items', []),
                    'work_content': body_json.get('work_content', ''),
                    'notes': body_json.get('notes', ''),
                    'status': body_json.get('status', 'draft'),  # draft, pending, assigned, in_progress, completed, cancelled
                }
                
                # 営業担当者ID（sales_id）を追加
                sales_id = body_json.get('sales_id')
                if sales_id:
                    schedule_item['sales_id'] = sales_id
                
                # 清掃員ID（worker_id）を追加
                worker_id = body_json.get('worker_id')
                if worker_id:
                    schedule_item['worker_id'] = worker_id
                    schedule_item['assigned_to'] = worker_id  # GSI用
                
                # カルテ情報（survey_data）を追加
                survey_data = body_json.get('survey_data')
                if survey_data:
                    schedule_item['survey_data'] = survey_data
                
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
                
                # 条件付き書き込み（IDが存在しない場合のみ）
                SCHEDULES_TABLE.put_item(
                    Item=schedule_item,
                    ConditionExpression='attribute_not_exists(id)'
                )
                
                schedule_created = True
                
            except SCHEDULES_TABLE.meta.client.exceptions.ConditionalCheckFailedException:
                # 競合が発生した場合は再試行
                schedule_id = generate_schedule_id(date_str, SCHEDULES_TABLE)
                retry_count += 1
                if retry_count >= max_retries:
                    raise Exception('スケジュールIDの生成に失敗しました（最大リトライ回数に達しました）')
            except Exception as e:
                raise e
        
        # Google Calendarにイベントを作成（オプション）
        calendar_event_result = None
        if GOOGLE_CALENDAR_ENABLED:
            try:
                # スケジュールデータを準備
                calendar_schedule_data = {
                    'date': scheduled_date,
                    'time_slot': scheduled_time,
                    'store_name': body_json.get('store_name', ''),
                    'client_name': body_json.get('client_name', ''),
                    'address': body_json.get('address', ''),
                    'cleaning_items': body_json.get('cleaning_items', []),
                    'notes': body_json.get('notes', ''),
                    'schedule_id': schedule_id,
                    'duration_minutes': body_json.get('duration_minutes', 60)
                }
                calendar_event_result = create_google_calendar_event(calendar_schedule_data)
                
                # スケジュールアイテムにGoogle CalendarイベントIDを保存
                if calendar_event_result.get('success') and calendar_event_result.get('event_id'):
                    schedule_item['google_calendar_event_id'] = calendar_event_result.get('event_id')
                    # DynamoDBアイテムを更新（既に作成済みなので、update_itemを使用）
                    SCHEDULES_TABLE.update_item(
                        Key={'id': schedule_id},
                        UpdateExpression='SET google_calendar_event_id = :event_id',
                        ExpressionAttributeValues={':event_id': calendar_event_result.get('event_id')}
                    )
            except Exception as e:
                # Google Calendarの作成に失敗しても、スケジュール作成は成功とする
                print(f"Warning: Failed to create Google Calendar event: {str(e)}")
                calendar_event_result = {'success': False, 'message': str(e)}
        
        response_body = {
            'status': 'success',
            'message': 'スケジュールを作成しました',
            'schedule_id': schedule_id
        }
        
        # 見積もりも作成した場合は、見積もりIDも返す
        if estimate_id:
            response_body['estimate_id'] = estimate_id
            response_body['message'] = 'スケジュールと見積もりを作成しました'
        
        # Google Calendar連携は廃止（今後は返さない）
        
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

def get_google_calendar_events(event, headers):
    """
    Google Calendarイベント一覧を取得
    """
    try:
        # クエリパラメータを取得
        query_params = event.get('queryStringParameters') or {}
        start_date = query_params.get('start_date')
        end_date = query_params.get('end_date')
        max_results = int(query_params.get('max_results', 100))
        calendar_id = query_params.get('calendar_id')
        
        # イベント一覧を取得
        result = list_google_calendar_events(start_date, end_date, max_results, calendar_id)
        
        if result.get('success'):
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps(result, ensure_ascii=False, default=str)
            }
        else:
            return {
                'statusCode': 500,
                'headers': headers,
                'body': json.dumps(result, ensure_ascii=False, default=str)
            }
    except Exception as e:
        print(f"Error getting Google Calendar events: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'success': False,
                'error': 'Google Calendarイベントの取得に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def get_google_calendar_event_detail(event_id, event, headers):
    """
    Google Calendarイベント詳細を取得
    """
    try:
        # クエリパラメータを取得
        query_params = event.get('queryStringParameters') or {}
        calendar_id = query_params.get('calendar_id')
        
        # イベントを取得
        result = get_google_calendar_event(event_id, calendar_id)
        
        if result.get('success'):
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps(result, ensure_ascii=False, default=str)
            }
        else:
            return {
                'statusCode': 404 if 'not found' in result.get('message', '').lower() else 500,
                'headers': headers,
                'body': json.dumps(result, ensure_ascii=False, default=str)
            }
    except Exception as e:
        print(f"Error getting Google Calendar event detail: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'success': False,
                'error': 'Google Calendarイベントの取得に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def sync_google_calendar_to_schedules(event, headers):
    """
    Google CalendarイベントをDynamoDBのschedulesテーブルに同期
    """
    try:
        # リクエストボディを取得
        if event.get('isBase64Encoded'):
            body = base64.b64decode(event['body'])
        else:
            body = event.get('body', '')
        
        if isinstance(body, str):
            body_json = json.loads(body) if body else {}
        else:
            body_json = json.loads(body.decode('utf-8')) if body else {}
        
        # クエリパラメータまたはボディから取得
        query_params = event.get('queryStringParameters') or {}
        event_id = body_json.get('event_id') or query_params.get('event_id')
        calendar_id = body_json.get('calendar_id') or query_params.get('calendar_id') or GOOGLE_CALENDAR_ID
        
        # 今日以降のイベントのみ取得（デフォルト）
        if not event_id:
            # 日付文字列が渡された場合はISO 8601形式の日時に変換
            start_date_param = body_json.get('start_date') or query_params.get('start_date')
            if start_date_param:
                if 'T' not in start_date_param:
                    # 日付のみの場合は、その日の0時（JST）に変換
                    start_date = f"{start_date_param}T00:00:00+09:00"
                elif '+' not in start_date_param and 'Z' not in start_date_param:
                    # 日時はあるがタイムゾーンがない場合は、JSTを追加
                    start_date = start_date_param + '+09:00'
                else:
                    start_date = start_date_param
            else:
                # デフォルト: 今日の0時（JST）
                from datetime import timezone, timedelta
                jst = timezone(timedelta(hours=9))
                today = datetime.now(jst).replace(hour=0, minute=0, second=0, microsecond=0)
                start_date = today.isoformat()
            
            end_date_param = body_json.get('end_date') or query_params.get('end_date')
            if end_date_param:
                if 'T' not in end_date_param:
                    # 日付のみの場合は、その日の23:59:59（JST）に変換
                    end_date = f"{end_date_param}T23:59:59+09:00"
                elif '+' not in end_date_param and 'Z' not in end_date_param:
                    # 日時はあるがタイムゾーンがない場合は、JSTを追加
                    end_date = end_date_param + '+09:00'
                else:
                    end_date = end_date_param
            else:
                end_date = None  # list_google_calendar_eventsで30日後に設定される
            
            max_results = int(body_json.get('max_results') or query_params.get('max_results', 100))
        else:
            start_date = body_json.get('start_date') or query_params.get('start_date')
            end_date = body_json.get('end_date') or query_params.get('end_date')
            max_results = int(body_json.get('max_results') or query_params.get('max_results', 100))
        
        results = {
            'success': True,
            'synced': [],
            'errors': [],
            'total': 0
        }
        
        if event_id:
            # 特定のイベントを同期
            event_data = get_google_calendar_event(event_id, calendar_id)
            if event_data.get('success'):
                sync_result = sync_google_calendar_event_to_schedule(event_data)
                if sync_result.get('success'):
                    results['synced'].append({
                        'event_id': event_id,
                        'schedule_id': sync_result.get('schedule_id'),
                        'action': sync_result.get('action')
                    })
                    results['total'] += 1
                else:
                    results['errors'].append({
                        'event_id': event_id,
                        'error': sync_result.get('message')
                    })
            else:
                results['errors'].append({
                    'event_id': event_id,
                    'error': event_data.get('message', 'Failed to get event')
                })
        else:
            # 日付範囲でイベント一覧を取得して同期
            events_result = list_google_calendar_events(start_date, end_date, max_results, calendar_id)
            if events_result.get('success'):
                events = events_result.get('events', [])
                for event_data in events:
                    sync_result = sync_google_calendar_event_to_schedule(event_data)
                    if sync_result.get('success'):
                        results['synced'].append({
                            'event_id': event_data.get('event_id'),
                            'schedule_id': sync_result.get('schedule_id'),
                            'action': sync_result.get('action')
                        })
                        results['total'] += 1
                    else:
                        results['errors'].append({
                            'event_id': event_data.get('event_id'),
                            'error': sync_result.get('message')
                        })
            else:
                return {
                    'statusCode': 500,
                    'headers': headers,
                    'body': json.dumps(events_result, ensure_ascii=False, default=str)
                }
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(results, ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"Error syncing Google Calendar to schedules: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'success': False,
                'error': 'Google Calendarの同期に失敗しました',
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
            'date', 'time_slot', 'scheduled_date', 'scheduled_time', 'order_type', 
            'client_id', 'store_id', 'client_name', 'brand_name', 'store_name', 
            'address', 'phone', 'email', 'cleaning_items', 'notes', 'status', 
            'assigned_to', 'worker_id', 'sales_id', 'survey_data'
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

def clear_all_schedules(event, headers):
    """
    危険操作: schedules テーブルを全件削除（システム側のみ）
    - 誤操作防止: confirm=DELETE_ALL_SCHEDULES が必須
    - Googleカレンダーは一切操作しない
    """
    try:
        query_params = event.get('queryStringParameters') or {}
        body = event.get('body')
        body_json = {}
        if body:
            try:
                if isinstance(body, str):
                    body_json = json.loads(body)
                else:
                    body_json = json.loads(body.decode('utf-8'))
            except Exception:
                body_json = {}

        confirm = (query_params.get('confirm') or body_json.get('confirm') or '').strip()
        if confirm != 'DELETE_ALL_SCHEDULES':
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'success': False,
                    'error': 'confirmation_required',
                    'message': 'This operation is destructive. Provide confirm=DELETE_ALL_SCHEDULES to proceed.'
                }, ensure_ascii=False)
            }

        deleted = 0
        scan_kwargs = {'ProjectionExpression': 'id'}
        response = SCHEDULES_TABLE.scan(**scan_kwargs)
        with SCHEDULES_TABLE.batch_writer() as batch:
            for item in response.get('Items', []):
                if item.get('id'):
                    batch.delete_item(Key={'id': item['id']})
                    deleted += 1
            while 'LastEvaluatedKey' in response:
                response = SCHEDULES_TABLE.scan(ExclusiveStartKey=response['LastEvaluatedKey'], **scan_kwargs)
                for item in response.get('Items', []):
                    if item.get('id'):
                        batch.delete_item(Key={'id': item['id']})
                        deleted += 1

        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'success': True,
                'message': 'All schedules have been deleted (system side only).',
                'deleted_count': deleted
            }, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error clearing schedules: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'success': False,
                'error': 'スケジュールの全削除に失敗しました',
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
        
        # スキャンまたはクエリを実行（強整合性読み取りを有効化、ページネーション対応）
        workers = []
        scan_kwargs = {'ConsistentRead': True}
        
        if cognito_sub:
            # Cognito Subでフィルタ（従業員ログイン用）
            scan_kwargs['FilterExpression'] = Attr('cognito_sub').eq(cognito_sub)
        elif firebase_uid:
            # Firebase UIDでフィルタ（お客様ログイン用、後方互換性のため残す）
            scan_kwargs['FilterExpression'] = Attr('firebase_uid').eq(firebase_uid)
        elif role:
            # ロールでフィルタ
            scan_kwargs['FilterExpression'] = Attr('role').eq(role)
        elif status:
            # ステータスでフィルタ
            scan_kwargs['FilterExpression'] = Attr('status').eq(status)
        elif email:
            # メールアドレスでフィルタ
            scan_kwargs['FilterExpression'] = Attr('email').eq(email)
        
        # フィルタがある場合は、ページネーションで全件取得
        if 'FilterExpression' in scan_kwargs:
            while True:
                response = WORKERS_TABLE.scan(**scan_kwargs)
                workers.extend(response.get('Items', []))
                
                # 次のページがあるか確認
                if 'LastEvaluatedKey' not in response:
                    break
                
                # 次のページを取得
                scan_kwargs['ExclusiveStartKey'] = response['LastEvaluatedKey']
        else:
            # 全件取得（強整合性読み取りを有効化、ページネーション対応）
            workers = []
            scan_kwargs = {'ConsistentRead': True}
            
            while True:
                response = WORKERS_TABLE.scan(**scan_kwargs)
                workers.extend(response.get('Items', []))
                
                # 次のページがあるか確認
                if 'LastEvaluatedKey' not in response:
                    break
                
                # 次のページを取得
                scan_kwargs['ExclusiveStartKey'] = response['LastEvaluatedKey']
        
        # ID 9999を除外（削除済みだがAPIに残っている可能性があるため）
        workers = [w for w in workers if str(w.get('id', '')).strip() != '9999']
        
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
        # 強整合性読み取りを有効化（常に最新データを取得）
        response = WORKERS_TABLE.get_item(
            Key={'id': worker_id},
            ConsistentRead=True
        )
        
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
        role = body_json.get('role', 'cleaning')
        department = body_json.get('department', '')
        # jobフィールドはCognitoのカスタム属性として定義されていないため、ここでは使用しない
        
        if not email or not password:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': 'メールアドレスとパスワードは必須です'
                }, ensure_ascii=False)
            }
        
        # メールアドレスのバリデーション
        if '@' not in email:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': '無効なメールアドレスです'
                }, ensure_ascii=False)
            }
        
        # Cognitoにユーザーを作成
        try:
            # UserAttributesを構築（空の値は除外）
            # 注意: custom:name属性はCognito User Poolに定義されていないため、設定しない
            user_attributes = [
                {'Name': 'email', 'Value': email},
                {'Name': 'email_verified', 'Value': 'true'}
            ]
            
            # custom:roleとcustom:departmentのみ設定（custom:nameは設定しない）
            if role and str(role).strip():
                user_attributes.append({'Name': 'custom:role', 'Value': str(role).strip()})
            if department and str(department).strip():
                user_attributes.append({'Name': 'custom:department', 'Value': str(department).strip()})
            
            print(f"Creating Cognito user: email={email}, name={name}, role={role}, department={department}")
            print(f"UserAttributes: {user_attributes}")
            
            response = cognito_client.admin_create_user(
                UserPoolId=COGNITO_USER_POOL_ID,
                Username=email,
                UserAttributes=user_attributes,
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
                print(f"Password set to permanent for user: {email}")
            except Exception as e:
                print(f"Warning: Could not set permanent password: {str(e)}")
                # 一時パスワードのままでも動作する
            
            user_sub = response['User'].get('Username', email)
            
            print(f"Successfully created Cognito user: {email}, sub: {user_sub}")
            
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
        except cognito_client.exceptions.UsernameExistsException as e:
            print(f"UsernameExistsException: {str(e)}")
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': 'このメールアドレスは既に使用されています'
                }, ensure_ascii=False)
            }
        except cognito_client.exceptions.InvalidPasswordException as e:
            print(f"InvalidPasswordException: {str(e)}")
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': 'パスワードが弱すぎます。8文字以上で、大文字・小文字・数字・特殊文字を含めてください'
                }, ensure_ascii=False)
            }
        except cognito_client.exceptions.InvalidParameterException as e:
            print(f"InvalidParameterException: {str(e)}")
            error_msg = str(e)
            if 'custom:' in error_msg:
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({
                        'error': 'カスタム属性の設定に失敗しました。システム管理者に連絡してください。',
                        'details': error_msg
                    }, ensure_ascii=False)
                }
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': '無効なパラメータです',
                    'details': error_msg
                }, ensure_ascii=False)
            }
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            print(f"Error creating Cognito user: {str(e)}")
            print(f"Traceback: {error_trace}")
            return {
                'statusCode': 500,
                'headers': headers,
                'body': json.dumps({
                    'error': 'Cognitoユーザーの作成に失敗しました',
                    'message': str(e),
                    'type': type(e).__name__
                }, ensure_ascii=False)
            }
    except json.JSONDecodeError as e:
        print(f"JSON decode error: {str(e)}")
        return {
            'statusCode': 400,
            'headers': headers,
            'body': json.dumps({
                'error': 'リクエストボディの解析に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Error in create_cognito_user: {str(e)}")
        print(f"Traceback: {error_trace}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'リクエストの処理に失敗しました',
                'message': str(e),
                'type': type(e).__name__
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
            'role': body_json.get('role', 'cleaning'),
            'role_code': body_json.get('role_code', '4'),
            'department': body_json.get('department', ''),
            'job': body_json.get('job', ''),  # 担当業務
            'status': body_json.get('status', 'active'),
            'created_at': body_json.get('created_at', now),
            'updated_at': now
        }
        
        # role_codeからroleを設定（roleが指定されていない場合）
        if not worker_data['role'] or worker_data['role'] == 'cleaning':
            if worker_data['role_code'] == '1':
                worker_data['role'] = 'admin'
            elif worker_data['role_code'] == '2':
                worker_data['role'] = 'sales'
            elif worker_data['role_code'] == '3':
                worker_data['role'] = 'office'
            elif worker_data['role_code'] == '4':
                worker_data['role'] = 'cleaning'
            elif worker_data['role_code'] == '5':
                worker_data['role'] = 'public_relations'
            elif worker_data['role_code'] == '6':
                worker_data['role'] = 'designer'
            elif worker_data['role_code'] == '7':
                worker_data['role'] = 'general_affairs'
            elif worker_data['role_code'] == '8':
                worker_data['role'] = 'director'
            elif worker_data['role_code'] == '9':
                worker_data['role'] = 'contractor'
            elif worker_data['role_code'] == '10':
                worker_data['role'] = 'accounting'
            elif worker_data['role_code'] == '11':
                worker_data['role'] = 'human_resources'
            elif worker_data['role_code'] == '12':
                worker_data['role'] = 'special_advisor'
            elif worker_data['role_code'] == '13':
                worker_data['role'] = 'field_sales'
            elif worker_data['role_code'] == '14':
                worker_data['role'] = 'inside_sales'
            elif worker_data['role_code'] == '15':
                worker_data['role'] = 'mechanic'
            elif worker_data['role_code'] == '16':
                worker_data['role'] = 'engineer'
            elif worker_data['role_code'] == '17':
                worker_data['role'] = 'part_time'
            else:
                worker_data['role'] = 'cleaning'
        
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
            'name', 'email', 'phone', 'role', 'role_code', 'department', 'job', 'status',
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
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({
                        'message': '勤怠記録が見つかりません',
                        'data': None
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
            
            if date:
                filter_expressions.append("#date = :date")
                if "#date" not in expression_attribute_names:
                    expression_attribute_names["#date"] = "date"
                expression_attribute_values[":date"] = date
            
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
                expression_attribute_values[":break_time"] = Decimal(str(round(total_break_hours, 2)))
            
            if work_hours > 0:
                update_expression_parts.append("#work_hours = :work_hours")
                expression_attribute_names["#work_hours"] = "work_hours"
                expression_attribute_values[":work_hours"] = Decimal(str(round(work_hours, 2)))
            
            if total_hours > 0:
                update_expression_parts.append("#total_hours = :total_hours")
                expression_attribute_names["#total_hours"] = "total_hours"
                expression_attribute_values[":total_hours"] = Decimal(str(round(total_hours, 2)))
            
            if overtime_hours > 0:
                update_expression_parts.append("#overtime_hours = :overtime_hours")
                expression_attribute_names["#overtime_hours"] = "overtime_hours"
                expression_attribute_values[":overtime_hours"] = Decimal(str(round(overtime_hours, 2)))
            
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
                'break_time': Decimal(str(round(total_break_hours, 2))) if total_break_hours > 0 else None,
                'total_hours': Decimal(str(round(total_hours, 2))) if total_hours > 0 else None,
                'work_hours': Decimal(str(round(work_hours, 2))) if work_hours > 0 else None,
                'overtime_hours': Decimal(str(round(overtime_hours, 2))) if overtime_hours > 0 else None,
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
            
            # ConditionExpressionを使用して重複レコードの作成を防止
            # 同じIDのレコードが存在しない場合のみ作成を許可
            try:
                ATTENDANCE_TABLE.put_item(
                    Item=attendance_data,
                    ConditionExpression='attribute_not_exists(id)'
                )
            except ATTENDANCE_TABLE.meta.client.exceptions.ConditionalCheckFailedException:
                # 既にレコードが存在する場合は更新処理に切り替え
                print(f"Record {attendance_id} already exists, switching to update")
                existing_response = ATTENDANCE_TABLE.get_item(Key={'id': attendance_id})
                existing_item = existing_response.get('Item')
                if existing_item:
                    # 既存レコードを更新
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
                        expression_attribute_values[":break_time"] = Decimal(str(round(total_break_hours, 2)))
                    
                    if work_hours > 0:
                        update_expression_parts.append("#work_hours = :work_hours")
                        expression_attribute_names["#work_hours"] = "work_hours"
                        expression_attribute_values[":work_hours"] = Decimal(str(round(work_hours, 2)))
                    
                    if total_hours > 0:
                        update_expression_parts.append("#total_hours = :total_hours")
                        expression_attribute_names["#total_hours"] = "total_hours"
                        expression_attribute_values[":total_hours"] = Decimal(str(round(total_hours, 2)))
                    
                    if overtime_hours > 0:
                        update_expression_parts.append("#overtime_hours = :overtime_hours")
                        expression_attribute_names["#overtime_hours"] = "overtime_hours"
                        expression_attribute_values[":overtime_hours"] = Decimal(str(round(overtime_hours, 2)))
                    
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
        # エラーメッセージを日本語化
        if 'Float types are not supported' in error_message:
            error_message = 'データ型エラー: 浮動小数点型はサポートされていません。Decimal型を使用してください。'
        elif 'ResourceNotFoundException' in error_message or 'does not exist' in error_message:
            error_message = 'リソースが見つかりません: テーブルが存在しないか、アクセス権限がありません。'
        elif 'AccessDeniedException' in error_message or 'UnauthorizedOperation' in error_message:
            error_message = 'アクセス権限エラー: DynamoDBへのアクセス権限がありません。'
        elif 'ValidationException' in error_message:
            error_message = 'バリデーションエラー: データの形式が正しくありません。'
        elif 'ConditionalCheckFailedException' in error_message:
            error_message = '条件チェックエラー: データの更新条件を満たしていません。'
        else:
            error_message = f'サーバーエラー: {error_message}'
        
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
        
        # スタッフ名を取得して追加
        staff_ids = list(set([item.get('staff_id') for item in items if item.get('staff_id')]))
        staff_map = {}
        if staff_ids:
            try:
                for sid in staff_ids:
                    try:
                        worker_response = WORKERS_TABLE.get_item(Key={'id': sid})
                        if 'Item' in worker_response:
                            worker = worker_response['Item']
                            staff_map[sid] = worker.get('name', worker.get('display_name', sid))
                    except Exception as e:
                        print(f"Error getting worker {sid}: {str(e)}")
                        staff_map[sid] = sid
            except Exception as e:
                print(f"Error getting staff names: {str(e)}")
        
        # 各エラーにスタッフ名を追加
        for item in items:
            staff_id = item.get('staff_id')
            if staff_id and staff_id in staff_map:
                item['staff_name'] = staff_map[staff_id]
            else:
                item['staff_name'] = staff_id or '-'
        
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

def resolve_attendance_error(error_id, headers):
    """
    出退勤エラーログを解決済みにマーク
    """
    try:
        # 既存のエラーログを取得
        response = ATTENDANCE_ERRORS_TABLE.get_item(Key={'id': error_id})
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({
                    'error': 'エラーログが見つかりません'
                }, ensure_ascii=False)
            }
        
        # 解決済みにマーク
        ATTENDANCE_ERRORS_TABLE.update_item(
            Key={'id': error_id},
            UpdateExpression='SET resolved = :resolved, resolved_at = :resolved_at',
            ExpressionAttributeValues={
                ':resolved': True,
                ':resolved_at': datetime.now(timezone.utc).isoformat() + 'Z'
            }
        )
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'message': 'エラーログを解決済みにマークしました'
            }, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error resolving attendance error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'エラーログの解決に失敗しました',
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
        
        # 承認された場合、依頼内容を確定してタイムカードに保存
        if status == 'approved':
            attendance_id = existing_request.get('attendance_id')
            request_date = existing_request.get('date')  # 申請の日付を取得
            action = existing_request.get('action')  # 削除依頼かどうか
            
            # 削除依頼の場合は、タイムカードを削除
            if action == 'delete' and attendance_id:
                try:
                    ATTENDANCE_TABLE.delete_item(Key={'id': attendance_id})
                    print(f"[UpdateAttendanceRequest] Deleted attendance record {attendance_id} for delete request")
                except Exception as e:
                    print(f"Error deleting attendance record: {str(e)}")
            elif attendance_id:
                # 既存の勤怠記録を取得
                existing_attendance_response = ATTENDANCE_TABLE.get_item(Key={'id': attendance_id})
                existing_attendance = existing_attendance_response.get('Item', {})
                
                # 更新後の時刻を取得（申請の時刻を優先、Noneの場合は既存の値を保持）
                requested_clock_in = existing_request.get('requested_clock_in')
                requested_clock_out = existing_request.get('requested_clock_out')
                # 申請の時刻が指定されている場合はそれを使用、Noneの場合は既存の値を保持
                clock_in = requested_clock_in if requested_clock_in is not None else existing_attendance.get('clock_in')
                clock_out = requested_clock_out if requested_clock_out is not None else existing_attendance.get('clock_out')
                
                print(f"[UpdateAttendanceRequest] Updating attendance {attendance_id} with clock_in: {clock_in}, clock_out: {clock_out}, date: {request_date}")
                
                print(f"[UpdateAttendanceRequest] Updating attendance {attendance_id} with clock_in: {clock_in}, clock_out: {clock_out}, date: {request_date}")
                
                # 休憩時間を取得（申請に含まれている場合はそれを使用、なければ既存の値を使用）
                requested_break_hours = existing_request.get('requested_break_hours')
                if requested_break_hours is not None:
                    # 申請で指定された休憩時間を使用
                    total_break_hours = float(requested_break_hours)
                else:
                    # 既存の休憩時間を取得
                    existing_breaks = existing_attendance.get('breaks', [])
                    if not existing_breaks or not isinstance(existing_breaks, list):
                        existing_breaks = []
                    
                    # 総休憩時間を計算（create_or_update_attendanceと同じロジック）
                    total_break_hours = 0
                    for b in existing_breaks:
                        if isinstance(b, dict):
                            # break_durationが存在する場合はそれを使用
                            if 'break_duration' in b:
                                total_break_hours += float(b.get('break_duration', 0))
                            # durationが存在する場合（互換性のため）
                            elif 'duration' in b:
                                total_break_hours += float(b.get('duration', 0))
                            # break_startとbreak_endから計算
                            elif 'break_start' in b and 'break_end' in b:
                                try:
                                    break_start_dt = datetime.fromisoformat(b['break_start'].replace('Z', '+00:00'))
                                    break_end_dt = datetime.fromisoformat(b['break_end'].replace('Z', '+00:00'))
                                    break_duration = (break_end_dt - break_start_dt).total_seconds() / 3600
                                    total_break_hours += break_duration
                                except (ValueError, AttributeError):
                                    pass
                
                # 従業員の所定労働時間を取得
                staff_id = existing_request.get('staff_id')
                scheduled_work_hours = 8.0  # デフォルト8時間
                try:
                    worker_response = WORKERS_TABLE.get_item(Key={'id': staff_id})
                    if 'Item' in worker_response:
                        worker = worker_response['Item']
                        scheduled_work_hours = float(worker.get('scheduled_work_hours', 8.0))
                except Exception as e:
                    print(f"Error fetching worker info: {str(e)}")
                
                # 労働時間を計算
                total_hours = 0
                work_hours = 0
                overtime_hours = 0
                
                # 労働時間計算に使用する休憩時間を決定（申請で指定された場合はそれを使用）
                break_hours_for_calc = float(requested_break_hours) if requested_break_hours is not None else total_break_hours
                
                if clock_in and clock_out:
                    try:
                        clock_in_dt = datetime.fromisoformat(clock_in.replace('Z', '+00:00'))
                        clock_out_dt = datetime.fromisoformat(clock_out.replace('Z', '+00:00'))
                        total_hours = (clock_out_dt - clock_in_dt).total_seconds() / 3600
                        work_hours = max(0, total_hours - break_hours_for_calc)
                        # 残業時間（所定労働時間超過分）
                        overtime_hours = max(0, work_hours - scheduled_work_hours)
                    except (ValueError, AttributeError) as e:
                        print(f"Error calculating work hours: {str(e)}")
                
                # 勤怠記録を更新
                update_expression_parts = []
                expression_attribute_values = {}
                expression_attribute_names = {}
                
                # dateフィールドを更新（申請の日付を使用）
                if request_date:
                    update_expression_parts.append("#date = :date")
                    expression_attribute_names["#date"] = "date"
                    expression_attribute_values[":date"] = request_date
                
                # 申請された時刻を更新（requested_clock_in/outが指定されている場合は必ず更新）
                # Noneの場合は既存の値を保持するため更新しない
                if requested_clock_in is not None:
                    update_expression_parts.append("#clock_in = :clock_in")
                    expression_attribute_names["#clock_in"] = "clock_in"
                    expression_attribute_values[":clock_in"] = requested_clock_in if requested_clock_in else None
                    print(f"[UpdateAttendanceRequest] Setting clock_in to: {requested_clock_in}")
                else:
                    # Noneの場合は既存の値を保持（更新しない）
                    print(f"[UpdateAttendanceRequest] requested_clock_in is None, keeping existing value")
                
                if requested_clock_out is not None:
                    update_expression_parts.append("#clock_out = :clock_out")
                    expression_attribute_names["#clock_out"] = "clock_out"
                    expression_attribute_values[":clock_out"] = requested_clock_out if requested_clock_out else None
                    print(f"[UpdateAttendanceRequest] Setting clock_out to: {requested_clock_out}")
                else:
                    # Noneの場合は既存の値を保持（更新しない）
                    print(f"[UpdateAttendanceRequest] requested_clock_out is None, keeping existing value")
                
                # 労働時間を更新
                if work_hours > 0:
                    update_expression_parts.append("#work_hours = :work_hours")
                    expression_attribute_names["#work_hours"] = "work_hours"
                    expression_attribute_values[":work_hours"] = Decimal(str(round(work_hours, 2)))
                
                if overtime_hours > 0:
                    update_expression_parts.append("#overtime_hours = :overtime_hours")
                    expression_attribute_names["#overtime_hours"] = "overtime_hours"
                    expression_attribute_values[":overtime_hours"] = Decimal(str(round(overtime_hours, 2)))
                
                # 総労働時間を更新
                if total_hours > 0:
                    update_expression_parts.append("#total_hours = :total_hours")
                    expression_attribute_names["#total_hours"] = "total_hours"
                    expression_attribute_values[":total_hours"] = Decimal(str(round(total_hours, 2)))
                
                # 休憩時間を更新（申請で指定された場合はそれを使用、そうでなければ計算した値を使用）
                # requested_break_hoursが指定されている場合はそれを使用、そうでなければ計算したtotal_break_hoursを使用
                if requested_break_hours is not None:
                    # 申請で指定された休憩時間を使用
                    final_break_hours = float(requested_break_hours)
                else:
                    # 計算した休憩時間を使用
                    final_break_hours = total_break_hours
                
                # 休憩時間を更新（0の場合も含む）
                break_time_value = Decimal(str(round(final_break_hours, 2)))
                update_expression_parts.append("#break_time = :break_time")
                expression_attribute_names["#break_time"] = "break_time"
                expression_attribute_values[":break_time"] = break_time_value
                
                # breaks配列も更新（シンプルな形式で保存）
                if final_break_hours > 0:
                    new_breaks = [{
                        'break_duration': round(final_break_hours, 2)
                    }]
                else:
                    new_breaks = []
                update_expression_parts.append("#breaks = :breaks")
                expression_attribute_names["#breaks"] = "breaks"
                expression_attribute_values[":breaks"] = new_breaks
                
                update_expression_parts.append("#updated_at = :updated_at")
                expression_attribute_names["#updated_at"] = "updated_at"
                expression_attribute_values[":updated_at"] = now
                
                # 勤務状態を更新
                if clock_in and clock_out:
                    update_expression_parts.append("#status = :status")
                    expression_attribute_names["#status"] = "status"
                    expression_attribute_values[":status"] = "completed"
                elif clock_in:
                    update_expression_parts.append("#status = :status")
                    expression_attribute_names["#status"] = "status"
                    expression_attribute_values[":status"] = "working"
                
                if update_expression_parts:
                    print(f"[UpdateAttendanceRequest] Updating attendance record with {len(update_expression_parts)} fields")
                    print(f"[UpdateAttendanceRequest] Update expression: SET {', '.join(update_expression_parts)}")
                    ATTENDANCE_TABLE.update_item(
                        Key={'id': attendance_id},
                        UpdateExpression='SET ' + ', '.join(update_expression_parts),
                        ExpressionAttributeNames=expression_attribute_names,
                        ExpressionAttributeValues=expression_attribute_values
                    )
                    print(f"[UpdateAttendanceRequest] Attendance record updated successfully")
                else:
                    print(f"[UpdateAttendanceRequest] No fields to update, skipping")
        
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


def update_inventory_item(product_id, event, headers):
    """
    商品情報を更新（管理者のみ）
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
        
        # 既存商品を取得
        try:
            existing = INVENTORY_ITEMS_TABLE.get_item(Key={'product_id': product_id})
            if 'Item' not in existing:
                return {
                    'statusCode': 404,
                    'headers': headers,
                    'body': json.dumps({'error': '商品が見つかりません'}, ensure_ascii=False)
                }
        except Exception as e:
            return {
                'statusCode': 500,
                'headers': headers,
                'body': json.dumps({'error': '商品の取得に失敗しました', 'message': str(e)}, ensure_ascii=False)
            }
        
        # 更新可能なフィールド
        update_expression_parts = []
        expression_attribute_values = {}
        expression_attribute_names = {}
        
        # 商品名の更新
        if 'name' in body:
            name = body.get('name', '').strip()
            if not name:
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({'error': '商品名は必須です'}, ensure_ascii=False)
                }
            update_expression_parts.append('#name = :name')
            expression_attribute_names['#name'] = 'name'
            expression_attribute_values[':name'] = name
        
        # 在庫数の更新（オプション）
        if 'stock' in body:
            stock = int(body.get('stock', 0))
            if stock < 0:
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({'error': '在庫数は0以上である必要があります'}, ensure_ascii=False)
                }
            update_expression_parts.append('#stock = :stock')
            expression_attribute_names['#stock'] = 'stock'
            expression_attribute_values[':stock'] = stock
        
        # 最小在庫数の更新（オプション）
        if 'minStock' in body:
            min_stock = int(body.get('minStock', 0))
            update_expression_parts.append('#minStock = :minStock')
            expression_attribute_names['#minStock'] = 'minStock'
            expression_attribute_values[':minStock'] = min_stock
        
        # 安全在庫数の更新（オプション）
        if 'safeStock' in body:
            safe_stock = int(body.get('safeStock', 0))
            update_expression_parts.append('#safeStock = :safeStock')
            expression_attribute_names['#safeStock'] = 'safeStock'
            expression_attribute_values[':safeStock'] = safe_stock
        
        if not update_expression_parts:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': '更新するフィールドが指定されていません'}, ensure_ascii=False)
            }
        
        # updated_atを更新
        now = datetime.now(timezone.utc).isoformat()
        update_expression_parts.append('#updated_at = :updated_at')
        expression_attribute_names['#updated_at'] = 'updated_at'
        expression_attribute_values[':updated_at'] = now
        
        # 商品を更新
        update_expression = 'SET ' + ', '.join(update_expression_parts)
        
        INVENTORY_ITEMS_TABLE.update_item(
            Key={'product_id': product_id},
            UpdateExpression=update_expression,
            ExpressionAttributeNames=expression_attribute_names,
            ExpressionAttributeValues=expression_attribute_values
        )
        
        # 更新後の商品情報を取得
        updated = INVENTORY_ITEMS_TABLE.get_item(Key={'product_id': product_id})
        updated_item = updated.get('Item', {})
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'item': updated_item
            }, ensure_ascii=False, default=str)
        }
    except Exception as e:
        import traceback
        print(f"Error updating inventory item: {str(e)}")
        print(traceback.format_exc())
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '商品の更新に失敗しました',
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
        # 認証チェック（CognitoトークンまたはFirebaseトークン）
        auth_header = event.get('headers', {}).get('Authorization') or event.get('headers', {}).get('authorization', '')
        id_token = auth_header.replace('Bearer ', '') if auth_header else ''
        
        if not id_token or id_token == 'mock-token':
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': 'Unauthorized'}, ensure_ascii=False)
            }
        
        user_info = verify_firebase_token(id_token)
        if not user_info:
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': 'Unauthorized'}, ensure_ascii=False)
            }
        
        staff_id = user_info.get('uid') or user_info.get('cognito_sub')
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
        print(f"[DEBUG] get_admin_announcements called")
        print(f"[DEBUG] ANNOUNCEMENTS_TABLE: {ANNOUNCEMENTS_TABLE}")
        
        # 認証・権限チェック
        auth_header = event.get('headers', {}).get('Authorization') or event.get('headers', {}).get('authorization', '')
        id_token = auth_header.replace('Bearer ', '') if auth_header else ''
        user_info = verify_firebase_token(id_token)
        if not user_info or not user_info.get('verified'):
            print(f"[DEBUG] Unauthorized: user_info={user_info}")
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': 'Unauthorized'}, ensure_ascii=False)
            }
        
        if not check_admin_permission(user_info):
            print(f"[DEBUG] Forbidden: user_info={user_info}")
            return {
                'statusCode': 403,
                'headers': headers,
                'body': json.dumps({'error': 'Forbidden: Admin access required'}, ensure_ascii=False)
            }
        
        query_params = event.get('queryStringParameters') or {}
        limit = int(query_params.get('limit', 50))
        target_type = query_params.get('target_type', '')  # 'all' or 'individual' or ''
        
        print(f"[DEBUG] Query params: limit={limit}, target_type={target_type}")
        
        # 業務連絡を取得
        try:
            if target_type:
                print(f"[DEBUG] Querying with target_type={target_type}")
                response = ANNOUNCEMENTS_TABLE.query(
                    IndexName='created_at-index',
                    KeyConditionExpression=Key('target_type').eq(target_type),
                    ScanIndexForward=False,
                    Limit=limit
                )
                announcements = response.get('Items', [])
            else:
                print(f"[DEBUG] Scanning all announcements")
                response = ANNOUNCEMENTS_TABLE.scan(Limit=limit)
                announcements = response.get('Items', [])
                announcements.sort(key=lambda x: x.get('created_at', ''), reverse=True)
            
            print(f"[DEBUG] Found {len(announcements)} announcements")
        except Exception as table_error:
            print(f"[DEBUG] Table error: {str(table_error)}")
            import traceback
            print(traceback.format_exc())
            return {
                'statusCode': 500,
                'headers': headers,
                'body': json.dumps({
                    'error': '業務連絡の取得に失敗しました',
                    'message': f'テーブルアクセスエラー: {str(table_error)}'
                }, ensure_ascii=False)
            }
        
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
        error_trace = traceback.format_exc()
        print(f"[ERROR] Error getting admin announcements: {str(e)}")
        print(f"[ERROR] Traceback: {error_trace}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '業務連絡の取得に失敗しました',
                'message': str(e),
                'traceback': error_trace
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
                FilterExpression=Attr('role_code').eq('4')  # 清掃
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

# ==================== 日報機能 ====================

def get_daily_reports(event, headers):
    """
    日報を取得
    """
    try:
        query_params = event.get('queryStringParameters') or {}
        staff_id = query_params.get('staff_id')
        date = query_params.get('date')
        date_from = query_params.get('date_from')
        date_to = query_params.get('date_to')
        limit = int(query_params.get('limit', 100))
        
        if staff_id and date:
            # 特定の従業員の特定日の日報を取得
            report_id = f"{date}_{staff_id}"
            response = DAILY_REPORTS_TABLE.get_item(Key={'id': report_id})
            if 'Item' in response:
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps(response['Item'], ensure_ascii=False, default=str)
                }
            else:
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({
                        'message': '日報が見つかりません',
                        'data': None
                    }, ensure_ascii=False)
                }
        else:
            # フィルタリング条件を構築
            filter_expressions = []
            expression_attribute_names = {}
            expression_attribute_values = {}
            
            if staff_id:
                filter_expressions.append('#staff_id = :staff_id')
                expression_attribute_names['#staff_id'] = 'staff_id'
                expression_attribute_values[':staff_id'] = staff_id
            
            if date_from:
                filter_expressions.append('#date >= :date_from')
                expression_attribute_names['#date'] = 'date'
                expression_attribute_values[':date_from'] = date_from
            
            if date_to:
                filter_expressions.append('#date <= :date_to')
                expression_attribute_names['#date'] = 'date'
                expression_attribute_values[':date_to'] = date_to
            
            # スキャンでフィルタリング
            if filter_expressions:
                response = DAILY_REPORTS_TABLE.scan(
                    FilterExpression=' AND '.join(filter_expressions),
                    ExpressionAttributeNames=expression_attribute_names,
                    ExpressionAttributeValues=expression_attribute_values,
                    Limit=limit
                )
            else:
                response = DAILY_REPORTS_TABLE.scan(Limit=limit)
            
            items = response.get('Items', [])
            # 日付でソート（新しい順）
            items.sort(key=lambda x: x.get('date', ''), reverse=True)
            
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({
                    'daily_reports': items,
                    'count': len(items)
                }, ensure_ascii=False, default=str)
            }
    except Exception as e:
        print(f"Error getting daily reports: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '日報の取得に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def create_or_update_daily_report(event, headers):
    """
    日報を作成または更新
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
        content = body_json.get('content', '')
        staff_name = body_json.get('staff_name')
        
        # バリデーション
        if not staff_id or not date:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': 'staff_idとdateは必須です'
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
                    'error': '日付の形式が正しくありません（YYYY-MM-DD形式で指定してください）'
                }, ensure_ascii=False)
            }
        
        # 日報IDを生成（日付_従業員ID）
        report_id = f"{date}_{staff_id}"
        
        now = datetime.utcnow().isoformat() + 'Z'
        
        # 既存の記録を取得
        existing_response = DAILY_REPORTS_TABLE.get_item(Key={'id': report_id})
        existing_item = existing_response.get('Item')
        
        if existing_item:
            # 更新
            item = {
                'id': report_id,
                'staff_id': staff_id,
                'staff_name': staff_name or existing_item.get('staff_name', ''),
                'date': date,
                'content': content,
                'created_at': existing_item.get('created_at', now),
                'updated_at': now
            }
        else:
            # 新規作成
            item = {
                'id': report_id,
                'staff_id': staff_id,
                'staff_name': staff_name or '',
                'date': date,
                'content': content,
                'created_at': now,
                'updated_at': now
            }
        
        DAILY_REPORTS_TABLE.put_item(Item=item)
        
        # メール送信処理（info@misesapo.co.jpに通知）
        try:
            sender = "info@misesapo.co.jp"
            recipient = "info@misesapo.co.jp"
            mail_staff_name = staff_name or existing_item.get('staff_name', '') if existing_item else staff_name or '担当者不明'

            mail_subject = f"【日報提出】{mail_staff_name} ({date})"
            mail_body = f"日報が提出されました。\n\n" \
                        f"■提出者\n{mail_staff_name} (ID: {staff_id})\n\n" \
                        f"■日付\n{date}\n\n" \
                        f"■内容\n{content}\n"
            
            ses_client.send_email(
                Source=sender,
                Destination={'ToAddresses': [recipient]},
                Message={
                    'Subject': {'Data': mail_subject},
                    'Body': {'Text': {'Data': mail_body}}
                }
            )
            print(f"Daily report notification email sent to {recipient}")
        except Exception as e:
            print(f"Failed to send daily report email: {str(e)}")
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'report_id': report_id,
                'message': '日報を保存しました',
                'data': item
            }, ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"Error creating/updating daily report: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '日報の保存に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def get_daily_report_detail(report_id, headers):
    """
    日報の詳細を取得
    """
    try:
        response = DAILY_REPORTS_TABLE.get_item(Key={'id': report_id})
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
                    'error': '日報が見つかりません'
                }, ensure_ascii=False)
            }
    except Exception as e:
        print(f"Error getting daily report detail: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '日報の取得に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def delete_daily_report(report_id, headers):
    """
    日報を削除
    """
    try:
        DAILY_REPORTS_TABLE.delete_item(Key={'id': report_id})
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'message': '日報を削除しました'
            }, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error deleting daily report: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '日報の削除に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

# ==================== TODO機能 ====================

def get_todos(event, headers):
    """
    TODOを取得
    """
    try:
        query_params = event.get('queryStringParameters') or {}
        staff_id = query_params.get('staff_id')
        completed = query_params.get('completed')  # 'true' or 'false'
        limit = int(query_params.get('limit', 100))
        
        # フィルタリング条件を構築
        filter_expressions = []
        expression_attribute_names = {}
        expression_attribute_values = {}
        
        if staff_id:
            filter_expressions.append('#staff_id = :staff_id')
            expression_attribute_names['#staff_id'] = 'staff_id'
            expression_attribute_values[':staff_id'] = staff_id
        
        if completed is not None:
            filter_expressions.append('#completed = :completed')
            expression_attribute_names['#completed'] = 'completed'
            expression_attribute_values[':completed'] = completed.lower() == 'true'
        
        # スキャンでフィルタリング
        if filter_expressions:
            response = TODOS_TABLE.scan(
                FilterExpression=' AND '.join(filter_expressions),
                ExpressionAttributeNames=expression_attribute_names,
                ExpressionAttributeValues=expression_attribute_values,
                Limit=limit
            )
        else:
            response = TODOS_TABLE.scan(Limit=limit)
        
        items = response.get('Items', [])
        # 作成日時でソート（新しい順）
        items.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'todos': items,
                'count': len(items)
            }, ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"Error getting todos: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'TODOの取得に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def create_todo(event, headers):
    """
    TODOを作成
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
        text = body_json.get('text', '').strip()
        completed = body_json.get('completed', False)
        
        # バリデーション
        if not staff_id:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': 'staff_idは必須です'
                }, ensure_ascii=False)
            }
        
        if not text:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': 'textは必須です'
                }, ensure_ascii=False)
            }
        
        # TODO IDを生成
        todo_id = f"todo_{uuid.uuid4().hex[:12]}"
        
        now = datetime.utcnow().isoformat() + 'Z'
        
        item = {
            'id': todo_id,
            'staff_id': staff_id,
            'text': text,
            'completed': completed,
            'created_at': now,
            'updated_at': now
        }
        
        TODOS_TABLE.put_item(Item=item)
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'todo_id': todo_id,
                'message': 'TODOを作成しました',
                'data': item
            }, ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"Error creating todo: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'TODOの作成に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def get_todo_detail(todo_id, headers):
    """
    TODOの詳細を取得
    """
    try:
        response = TODOS_TABLE.get_item(Key={'id': todo_id})
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
                    'error': 'TODOが見つかりません'
                }, ensure_ascii=False)
            }
    except Exception as e:
        print(f"Error getting todo detail: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'TODOの取得に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def update_todo(todo_id, event, headers):
    """
    TODOを更新
    """
    try:
        # 既存のTODOを取得
        existing_response = TODOS_TABLE.get_item(Key={'id': todo_id})
        if 'Item' not in existing_response:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({
                    'error': 'TODOが見つかりません'
                }, ensure_ascii=False)
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
        
        existing_item = existing_response['Item']
        
        # 更新可能なフィールドを更新
        update_expression_parts = []
        expression_attribute_values = {}
        expression_attribute_names = {}
        
        if 'text' in body_json:
            text = body_json['text'].strip()
            if not text:
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({
                        'error': 'textは空にできません'
                    }, ensure_ascii=False)
                }
            update_expression_parts.append("#text = :text")
            expression_attribute_names["#text"] = "text"
            expression_attribute_values[":text"] = text
        
        if 'completed' in body_json:
            update_expression_parts.append("#completed = :completed")
            expression_attribute_names["#completed"] = "completed"
            expression_attribute_values[":completed"] = body_json['completed']
        
        update_expression_parts.append("#updated_at = :updated_at")
        expression_attribute_names["#updated_at"] = "updated_at"
        expression_attribute_values[":updated_at"] = datetime.utcnow().isoformat() + 'Z'
        
        if update_expression_parts:
            TODOS_TABLE.update_item(
                Key={'id': todo_id},
                UpdateExpression='SET ' + ', '.join(update_expression_parts),
                ExpressionAttributeNames=expression_attribute_names,
                ExpressionAttributeValues=expression_attribute_values
            )
        
        # 更新後のデータを取得
        updated_response = TODOS_TABLE.get_item(Key={'id': todo_id})
        updated_item = updated_response['Item']
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'message': 'TODOを更新しました',
                'data': updated_item
            }, ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"Error updating todo: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'TODOの更新に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def delete_todo(todo_id, headers):
    """
    TODOを削除
    """
    try:
        TODOS_TABLE.delete_item(Key={'id': todo_id})
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'message': 'TODOを削除しました'
            }, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error deleting todo: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'TODOの削除に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def get_reimbursements(event, headers):
    """
    立て替え精算申請一覧を取得
    """
    try:
        query_params = event.get('queryStringParameters') or {}
        staff_id = query_params.get('staff_id')
        status = query_params.get('status')
        limit = int(query_params.get('limit', 50))

        if staff_id:
            # スタッフIDでフィルタリング
            # ※GSI (staff_id-date-index) がある想定
            try:
                response = REIMBURSEMENTS_TABLE.query(
                    IndexName='staff_id-date-index',
                    KeyConditionExpression=Key('staff_id').eq(staff_id),
                    ScanIndexForward=False,
                    Limit=limit
                )
            except Exception:
                # インデックスがない場合はスキャンで対応（フォールバック）
                response = REIMBURSEMENTS_TABLE.scan(
                    FilterExpression=Attr('staff_id').eq(staff_id),
                    Limit=limit
                )
        else:
            # 全員分（管理者/経理用）
            response = REIMBURSEMENTS_TABLE.scan(Limit=limit)
        
        items = response.get('Items', [])
        
        # ステータスフィルタ
        if status:
            items = [item for item in items if item.get('status') == status]
            
        # ID順（作成日順に近い）にソート
        items.sort(key=lambda x: x.get('date', ''), reverse=True)

        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'reimbursements': items}, ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"Error getting reimbursements: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'データ取得に失敗しました', 'message': str(e)}, ensure_ascii=False)
        }

def create_reimbursement(event, headers):
    """
    立て替え精算申請を作成
    """
    try:
        if event.get('isBase64Encoded'):
            body_str = base64.b64decode(event['body']).decode('utf-8')
        else:
            body_str = event.get('body', '{}')
        body = json.loads(body_str)
        
        reimbursement_id = f"REIMB_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M')}_{uuid.uuid4().hex[:6]}"
        now = datetime.now(timezone.utc).isoformat() + 'Z'
        
        # Decimal変換（金額用）
        amount = Decimal(str(body.get('amount', 0)))
        
        data = {
            'id': reimbursement_id,
            'staff_id': body.get('staff_id'),
            'staff_name': body.get('staff_name'),
            'date': body.get('date'),
            'category': body.get('category'),
            'title': body.get('title'),
            'amount': amount,
            'description': body.get('description', ''),
            'receipt_url': body.get('receipt_url', ''),
            'status': 'pending', # pending, approved, rejected, paid
            'created_at': now,
            'updated_at': now
        }
        
        REIMBURSEMENTS_TABLE.put_item(Item=data)
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'status': 'success', 'id': reimbursement_id}, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error creating reimbursement: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': '申請の作成に失敗しました', 'message': str(e)}, ensure_ascii=False)
        }

def get_reimbursement_detail(reimbursement_id, headers):
    """
    立て替え精算申請詳細を取得
    """
    try:
        response = REIMBURSEMENTS_TABLE.get_item(Key={'id': reimbursement_id})
        if 'Item' in response:
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps(response['Item'], ensure_ascii=False, default=str)
            }
        return {
            'statusCode': 404,
            'headers': headers,
            'body': json.dumps({'error': '申請が見つかりません'}, ensure_ascii=False)
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': '詳細取得に失敗しました', 'message': str(e)}, ensure_ascii=False)
        }

def update_reimbursement(reimbursement_id, event, headers):
    """
    立て替え精算申請を更新（承認・却下・精算処理用）
    """
    try:
        if event.get('isBase64Encoded'):
            body_str = base64.b64decode(event['body']).decode('utf-8')
        else:
            body_str = event.get('body', '{}')
        body = json.loads(body_str)
        
        now = datetime.now(timezone.utc).isoformat() + 'Z'
        
        update_expression = "SET #status = :s, updated_at = :u"
        expression_names = {"#status": "status"}
        expression_values = {":s": body.get('status'), ":u": now}
        
        if 'review_comments' in body:
            update_expression += ", review_comments = :c"
            expression_values[":c"] = body.get('review_comments')
        
        if 'reviewer_id' in body:
            update_expression += ", reviewer_id = :r"
            expression_values[":r"] = body.get('reviewer_id')
            
        REIMBURSEMENTS_TABLE.update_item(
            Key={'id': reimbursement_id},
            UpdateExpression=update_expression,
            ExpressionAttributeNames=expression_names,
            ExpressionAttributeValues=expression_values
        )
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'status': 'success', 'message': '申請を更新しました'}, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error updating reimbursement {reimbursement_id}: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': '更新に失敗しました', 'message': str(e)}, ensure_ascii=False)
        }

def delete_reimbursement(reimbursement_id, headers):
    """
    立て替え精算申請を削除
    """
    try:
        REIMBURSEMENTS_TABLE.delete_item(Key={'id': reimbursement_id})
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'status': 'success', 'message': '申請を削除しました'}, ensure_ascii=False)
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': '削除に失敗しました', 'message': str(e)}, ensure_ascii=False)
        }

def call_gemini_api(prompt, system_instruction=None, media=None):
    """
    Gemini API (1.5 Flash) を呼び出す
    """
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        raise Exception("GEMINI_API_KEY is not set.")

    # Model for 1.5 Flash
    model_name = "gemini-flash-latest"
    api_version = "v1beta"
    url = f"https://generativelanguage.googleapis.com/{api_version}/models/{model_name}:generateContent?key={api_key}"
    
    parts = []
    # User prompt
    parts.append({"text": prompt})
    
    # Media (Audio)
    if media:
        parts.append({
            "inline_data": {
                "mime_type": media.get('mime_type', 'audio/wav'),
                "data": media.get('data')
            }
        })
        
    data = {
        "contents": [{"parts": parts}],
        "generationConfig": {
            "temperature": 0.2,
            "topP": 0.8,
            "maxOutputTokens": 1024
        }
    }

    # Correct placement for System Instruction in 1.5 API
    if system_instruction:
        data["system_instruction"] = {
            "parts": [{"text": system_instruction}]
        }

    # Set response format to JSON if the word JSON is in prompt
    if "json" in prompt.lower() or (system_instruction and "json" in system_instruction.lower()):
        data["generationConfig"]["responseMimeType"] = "application/json"
    
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            res_body = json.loads(response.read().decode('utf-8'))
            candidates = res_body.get('candidates', [])
            if not candidates:
                raise Exception(f"Gemini returned no candidates: {json.dumps(res_body)}")
            
            content = candidates[0].get('content', {})
            parts = content.get('parts', [])
            if not parts:
                raise Exception(f"Gemini returned no parts: {json.dumps(res_body)}")
                
            return parts[0].get('text', '')
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        print(f"Gemini API Error: {error_body}")
        raise Exception(f"Gemini API ({e.code}): {error_body}")
    except Exception as e:
        print(f"Gemini Call Failed: {str(e)}")
        raise e

def handle_ai_process(event, headers):
    """
    AI処理のエンドポイント
    """
    try:
        body = json.loads(event.get('body') or '{}')
        action = body.get('action')
        input_text = body.get('text', '')
        audio_data = body.get('audio') # Base64 encoded
        mime_type = body.get('mime_type')

        # Multimodal Image check
        image_data = body.get('image') # Base64 encoded
        image_mime = body.get('image_mime')

        if not action:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'action is required'}, ensure_ascii=False)
            }
        
        media = None
        
        # Priority 1: Audio Input
        if audio_data:
            # Gemini documentation lists: wav, mp3, aiff, aac, ogg, flac
            # Safari (iOS) usually sends audio/mp4 which is AAC.
            # We map it to audio/aac to satisfy Gemini's strict MIME check.
            clean_mime = 'audio/wav'
            if mime_type:
                target = mime_type.lower()
                if 'webm' in target: clean_mime = 'audio/webm'
                elif 'mp4' in target or 'mpeg' in target or 'aac' in target: clean_mime = 'audio/aac'
                elif 'ogg' in target: clean_mime = 'audio/ogg'
            
            print(f"DEBUG: Mic processing start. Action: {action}, MIME: {mime_type} -> {clean_mime}, Data Length: {len(audio_data)}")
            
            media = {
                'mime_type': clean_mime,
                'data': audio_data
            }
            if not input_text:
                input_text = "音声の内容を解析してください。"

        # Priority 2: Image Input (if no audio)
        elif image_data:
            clean_mime = 'image/jpeg'
            if image_mime:
                target = image_mime.lower()
                if 'png' in target: clean_mime = 'image/png'
                elif 'webp' in target: clean_mime = 'image/webp'
                elif 'heic' in target: clean_mime = 'image/heic'
                elif 'heif' in target: clean_mime = 'image/heif'
            
            print(f"DEBUG: Image processing start. Action: {action}, MIME: {image_mime} -> {clean_mime}, Data Length: {len(image_data)}")
            
            media = {
                'mime_type': clean_mime,
                'data': image_data
            }
            if not input_text:
                input_text = "この画像を解析してください。"
            
        if action == 'summarize_report':
            system_instruction = "あなたはプロの清掃管理アドバイザーです。ユーザーの清掃メモから、丁寧な清掃報告書を作成してください。"
            result = call_gemini_api(f"作成依頼:\n{input_text}", system_instruction, media)
            
        elif action == 'assistant_concierge':
            import datetime
            jst_now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).strftime('%Y-%m-%d %H:%M')
            system_instruction = f"""あなたはMISESAPO AI Systemの『Misogi（ミソギ）』です。
正式名称は "Misesapo Intelligent System for Operational Guidance & Integration" (M.I.S.O.G.I.) です。
あなたは「水」のように澄んだ心を持ち、冷静かつ丁寧、効率的に営業担当者をサポートするAI秘書です。
語りかけに対し自然な日本語で返答し、必ず以下のJSON形式のみで返してください。これ以外のテキストは含めないでください。
現在時刻: {jst_now}
フォーマット: {{"reply": "...", "intent": "...", "extracted_data": {{}}}}"""
            result = call_gemini_api(f"ユーザー: {input_text}", system_instruction, media)

        elif action == 'report_assistant':
            # Dedicated action for Report Creation Page
            system_instruction = """あなたは清掃レポート作成支援AIです。
ユーザーの入力（テキスト/音声/画像）を解析し、レポートに追加すべきセクションを提案します。
以下のJSONスキーマに従って出力してください。Markdownコードブロックは不要です。

{
  "reply": "ユーザーへの短い応答 (例: '床清掃の項目を追加しました')",
  "actions": [
    {
      "type": "addSection",
      "sectionType": "cleaning" | "image_before_after" | "image_completed",
      "data": {
        "item_name": "項目名 (cleaningの場合)",
        "comments": ["コメント1", "コメント2"],
        "haccp_info": {} // 任意
      }
    }
  ]
}

- "cleaning": 一般的な清掃項目（床、トイレ、エアコンなど）。commentsに状況を含める。
- "image_before_after": 作業前後の写真用セクション。
- "image_completed": 仕上がり写真用セクション。
"""
            # Use 'input_text' which acts as the prompt
            result = call_gemini_api(f"入力: {input_text}", system_instruction, media)
            
        elif action == 'suggest_request_form':
            system_instruction = "営業報告から清掃依頼書（JSON）を作成してください。"
            result = call_gemini_api(f"解析対象:\n{input_text}", system_instruction, media)
            
        else:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'Invalid Action', 'message': f'Unsupported action: {action}'})
            }
            
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'status': 'success', 'result': result}, ensure_ascii=False)
        }
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"ERROR in handle_ai_process: {str(e)}\n{error_detail}")
        
        # We return a 400 with the error message so the frontend can display it.
        return {
            'statusCode': 400,
            'headers': headers,
            'body': json.dumps({
                'error': 'AI_PROCESS_FAILED',
                'message': str(e),
                'debug': error_detail[:150]
            }, ensure_ascii=False)
        }

def upload_report_image(event, headers):
    """
    レポート用画像をS3にアップロード
    path: /staff/report-images (POST)
    """
    try:
        if event.get('isBase64Encoded'):
            body_str = base64.b64decode(event['body']).decode('utf-8')
        else:
            body_str = event.get('body', '{}')
        
        if isinstance(body_str, str):
            body = json.loads(body_str)
        else:
            body = body_str

        # api.jsからのペイロード: { image_data, category, file_name, content_type, report_id, cleaning_date }
        image_b64 = body.get('image_data')
        file_name = body.get('file_name', 'unknown.jpg')
        content_type = body.get('content_type', 'image/jpeg')
        category = body.get('category', 'general')
        
        if not image_b64:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'image_data is required'}, ensure_ascii=False)
            }

        image_data = base64.b64decode(image_b64)
        
        # S3キー生成: report-images/YYYYMM/timestamp_uuid_filename
        now = datetime.now(timezone.utc)
        folder = now.strftime('%Y%m')
        timestamp = int(now.timestamp() * 1000)
        unique_id = uuid.uuid4().hex[:8]
        safe_name = file_name.replace(' ', '_').replace('/', '_')
        
        s3_key = f"report-images/{folder}/{timestamp}_{unique_id}_{safe_name}"
        
        s3_client.put_object(
            Bucket=S3_BUCKET_NAME,
            Key=s3_key,
            Body=image_data,
            ContentType=content_type
            # ACL='public-read' # 無効化: バケットポリシーで公開制御されている前提
        )
        
        url = f"https://{S3_BUCKET_NAME}.s3.{S3_REGION}.amazonaws.com/{s3_key}"
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'url': url,
                'id': s3_key, # IDとしてS3キーを返す
                'message': 'アップロード成功'
            }, ensure_ascii=False)
        }

    except Exception as e:
        print(f"Error in upload_report_image: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'Internal Server Error', 'message': str(e)}, ensure_ascii=False)
        }

def get_report_images(event, headers):
    """
    レポート用画像一覧取得 (Stub)
    path: /staff/report-images (GET)
    """
    return {
        'statusCode': 200,
        'headers': headers,
        'body': json.dumps({'images': []}, ensure_ascii=False)
    }

def get_accounting_schedules(event, headers):
    """
    経理・財務用スケジュール一覧取得（報告書提出状況付き）
    """
    try:
        # クエリパラメータからフィルタ条件を取得
        query_params = event.get('queryStringParameters') or {}
        date_from = query_params.get('date_from')
        date_to = query_params.get('date_to')
        status = query_params.get('status') # pending, ready, issued

        # 1. スケジュール一覧を取得
        # 本来は日付範囲でフィルタリングすべきだが、簡易的に全件取得または直近のもの取得
        # ここではscanを使用（本番ではGSI推奨）
        response = SCHEDULES_TABLE.scan()
        all_schedules = response.get('Items', [])
        
        # 簡易フィルタ
        filtered_schedules = []
        for imp in all_schedules:
            # 日付フィルタ
            sch_date = imp.get('date', '')
            if date_from and sch_date < date_from:
                continue
            if date_to and sch_date > date_to:
                continue
            filtered_schedules.append(imp)
            
        # 結果リスト
        results = []
        
        # 2. 各ジュールの詳細情報を付与
        for schedule in filtered_schedules:
            schedule_id = schedule.get('id')
            
            # 2.1 割り当てスタッフ数を取得
            # assigned_staff はリストまたはカンマ区切り文字列と仮定
            assigned_staff = schedule.get('assigned_staff', [])
            if isinstance(assigned_staff, str):
                # JSON文字列の場合やカンマ区切りの場合のハンドリング
                try:
                    assigned_staff = json.loads(assigned_staff)
                except:
                    assigned_staff = [s.strip() for s in assigned_staff.split(',') if s.strip()]
            
            staff_count = len(assigned_staff) if assigned_staff else 0
            
            # 2.2 提出された報告書をカウント
            # GSI: schedule_id-index を使用
            try:
                rep_resp = REPORTS_TABLE.query(
                    IndexName='schedule_id-index',
                    KeyConditionExpression=Key('schedule_id').eq(schedule_id)
                )
                reports = rep_resp.get('Items', [])
            except Exception:
                # インデックスがない場合はスキャン（フォールバック）
                rep_resp = REPORTS_TABLE.scan(
                    FilterExpression=Attr('schedule_id').eq(schedule_id)
                )
                reports = rep_resp.get('Items', [])
            
            report_count = len(reports)
            
            # 2.3 ステータス判定
            # staff_countが0の場合は、報告書数が1以上なら完了とみなすなどのロジックが必要
            # ここではシンプルに report_count >= staff_count とするか、staff_countが未定なら1以上でOKとする
            
            target_count = staff_count if staff_count > 0 else 1
            
            if report_count >= target_count:
                report_status = 'ready' # 提出完了
            else:
                report_status = 'pending' # 未完了
                
            # 依頼書・契約書ステータス（ダミーロジック：スケジュールがあればOKとする）
            doc_status = 'ready'
            
            # 発行済みかどうか
            is_issued = schedule.get('report_issued', False)
            
            # フロントエンドフィルタ用ステータス
            overall_status = 'issued' if is_issued else report_status
            
            if status and overall_status != status:
                continue

            results.append({
                'id': schedule_id,
                'date': schedule.get('date'),
                'store_name': schedule.get('store_name'),
                'client_name': schedule.get('client_name'),
                'staff_count': staff_count,
                'report_count': report_count,
                'target_count': target_count,
                'status': overall_status, # pending, ready, issued
                'doc_status': doc_status,
                'report_issued': is_issued,
                'reports': [{'id': r.get('id'), 'staff_name': r.get('staff_name', 'Unknown')} for r in reports]
            })
            
        # 日付順にソート
        results.sort(key=lambda x: x.get('date', ''), reverse=True)

        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'schedules': results}, ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"Error getting accounting schedules: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'データ取得に失敗しました', 'message': str(e)}, ensure_ascii=False)
        }

def issue_formal_report(event, headers):
    """
    報告書発行（公開URL生成）
    """
    try:
        if event.get('isBase64Encoded'):
            body_str = base64.b64decode(event['body']).decode('utf-8')
        else:
            body_str = event.get('body', '{}')
        
        body = json.loads(body_str) if isinstance(body_str, str) else body_str
        schedule_id = body.get('schedule_id')
        
        if not schedule_id:
             return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'schedule_id is required'}, ensure_ascii=False)
            }
            
        # URL生成 (実際にはレポート表示用ページへのリンク)
        # トークンを生成してDBに保存すべきだが、ここでは簡易的にIDを使用
        report_url = f"https://misesapo.co.jp/report/view/{schedule_id}"
        
        # スケジュールのステータスを更新
        SCHEDULES_TABLE.update_item(
            Key={'id': schedule_id},
            UpdateExpression="set report_issued = :issued, report_issued_at = :now, report_url = :url",
            ExpressionAttributeValues={
                ':issued': True,
                ':now': datetime.now(timezone.utc).isoformat(),
                ':url': report_url
            }
        )
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'success': True,
                'url': report_url,
                'message': '報告書が発行されました'
            }, ensure_ascii=False)
        }

    except Exception as e:
        print(f"Error issuing report: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': '発行処理に失敗しました', 'message': str(e)}, ensure_ascii=False)
        }
