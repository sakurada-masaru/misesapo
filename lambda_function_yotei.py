import json
import boto3
import base64
import os
import uuid
import hashlib
import urllib.request
import urllib.parse
import re
import html
from decimal import Decimal
from datetime import datetime, timedelta, timezone
from boto3.dynamodb.conditions import Key, Attr
try:
    from pydantic import ValidationError
except ImportError:
    ValidationError = ValueError  # Fallback if pydantic not available

# --- グローバル初期化エラーのトラップ用 ---
import sys
import traceback
import logging
# ----------------------------------------

# Logger 設定（import 失敗時の traceback 出力用）
logger = logging.getLogger()
logger.setLevel(logging.INFO)

ATTENDANCE_STAFF_DATE_INDEX = 'staff_id-date-index'

class DependencyNotReadyError(Exception):
    def __init__(self, missing_index, missing_table=None):
        super().__init__(missing_index)
        self.missing_index = missing_index
        self.missing_table = missing_table

from misogi_flags import (
    build_report_flag_pk,
    can_list,
    can_patch,
    can_suggest,
    has_disallowed_patch_fields,
    is_same_unit,
)
try:
    from misogi_schemas import PatchFlagRequest, SuggestFlagRequest
except ImportError:
    # Fallback if pydantic not available
    PatchFlagRequest = None
    SuggestFlagRequest = None

# universal_work_reports implementation has been removed for safety.
UNIVERSAL_WORK_REPORTS_AVAILABLE = False
handle_universal_worker_work_reports = None
handle_universal_admin_work_reports = None
handle_admin_work_reports = None


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
try:
    ANNOUNCEMENTS_TABLE = dynamodb.Table('business-announcements')
    ANNOUNCEMENT_READS_TABLE = dynamodb.Table('business-announcement-reads')
    REPORTS_TABLE = dynamodb.Table('staff-reports')
    CLEANING_LOGS_TABLE = dynamodb.Table('cleaning-logs')
    NFC_TAGS_TABLE = dynamodb.Table('nfc-tags')
    SCHEDULES_TABLE = dynamodb.Table('schedules')
    BLOCKS_TABLE = dynamodb.Table('blocks')
    ESTIMATES_TABLE = dynamodb.Table('estimates')
    WORKERS_TABLE = dynamodb.Table('workers')
    WORKER_AVAILABILITY_TABLE = dynamodb.Table('worker-availability')
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
    REPORT_IMAGES_TABLE = dynamodb.Table('report-images')
    STORE_AUDITS_TABLE = dynamodb.Table('misesapo-store-audits')
    STAFF_REPORT_APPROVALS_TABLE = dynamodb.Table('staff-report-approvals')
    REPORT_FLAGS_TABLE = dynamodb.Table('report-flags-v2')
except Exception as _e:
    print(f"CRITICAL: Table initialization failed: {str(_e)}")
    traceback.print_exc()

# YOTEI v2 tables (new schedule domain)
# boto3.resource.Table() does not validate existence here, so this is safe even before table creation.
YOTEI_SCHEDULES_TABLE = dynamodb.Table('yotei')
YOTEI_DISPATCH_TABLE = dynamodb.Table('yotei-dispatch')
UGOKI_TABLE = dynamodb.Table('ugoki')
YAKUSOKU_TABLE = dynamodb.Table('yakusoku')

TORIHIKISAKI_TABLE = dynamodb.Table('torihikisaki')
YAGOU_TABLE = dynamodb.Table('yagou')
TENPO_TABLE = dynamodb.Table('tenpo')
SOUKO_TABLE = dynamodb.Table('souko')

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
    # クレデンシャルが false なので、特定のオリジンを返す代わりに * でも動作するが、
    # 互換性のためにリクエストの Origin をそのまま返すか、許可リストをチェックする。
    # API Gateway はキーを小文字にする場合があるので両方参照
    origin = (
        event_headers.get("origin")
        or event_headers.get("Origin")
        or event_headers.get("ORIGIN")
        or ""
    )
    if isinstance(origin, list):
        origin = origin[0] if origin else ""
    origin = (origin or "").strip()

    if not origin:
        return "*"

    # * が許可されている場合はオリジンを返す
    if "*" in ALLOWED_ORIGINS:
        return origin

    # ローカル開発: localhost / 127.0.0.1（任意ポート）を許可（http://localhost:3335 等）
    if origin.startswith("http://localhost:") or origin.startswith("https://localhost:"):
        return origin
    if origin.startswith("http://127.0.0.1:") or origin.startswith("https://127.0.0.1:"):
        return origin

    # ドメインマッチング（サフィックスチェック）
    if origin.endswith("misesapo.co.jp") or origin.endswith("sakurada-masaru.github.io"):
        return origin

    # 特定のオリジンが許可リストにある場合
    if origin in ALLOWED_ORIGINS:
        return origin

    # デフォルトのオリジンを返す
    return ALLOWED_ORIGINS[0] if ALLOWED_ORIGINS else "*"


# --- Utils: time / breaks ---

def time_to_minutes(time_str):
    if not time_str:
        return None
    try:
        if 'T' in str(time_str):
            # ISO: 2026-01-20T09:00:00+09:00 -> 09:00
            time_part = str(time_str).split('T')[1][:5]
        else:
            time_part = str(time_str)[:5]
        h, m = map(int, time_part.split(':'))
        return h * 60 + m
    except Exception:
        return None

def calc_break_total(breaks_data):
    if not breaks_data:
        return 0
    total = 0
    if isinstance(breaks_data, list):
        for b in breaks_data:
            start = time_to_minutes(b.get('start') or b.get('break_start'))
            end = time_to_minutes(b.get('end') or b.get('break_end'))
            if start is not None and end is not None and end > start:
                total += (end - start)
    return total

def abs_diff_minutes(t1, t2):
    m1 = time_to_minutes(t1)
    m2 = time_to_minutes(t2)
    if m1 is None or m2 is None:
        return 0
    return abs(m1 - m2)


def _get_headers(event):
    """event の headers を必ず dict で返す。API Gateway の headers / multiValueHeaders の両方に対応。"""
    h = event.get("headers")
    if h is None or not isinstance(h, dict):
        h = {}
    # API Gateway HTTP API などでは小文字キーで渡る場合がある。multiValueHeaders の先頭値も使う
    multi = event.get("multiValueHeaders") or {}
    if isinstance(multi, dict):
        for k, v in multi.items():
            if k not in h and isinstance(v, list) and len(v) > 0:
                h[k] = v[0]
    return h


def _get_auth_header(event):
    """event から Authorization ヘッダー値を取得する。headers が None/非 dict でも安全。"""
    headers = _get_headers(event)
    return headers.get("Authorization") or headers.get("authorization") or ""


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
    event_headers = _get_headers(event)
    headers = {
        'Access-Control-Allow-Origin': resolve_cors_origin(event_headers),
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,Accept,Origin,X-Requested-With',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
        'Content-Type': 'application/json'
    }
    
    # OPTIONSリクエスト（プリフライト）の処理: どのパスでも即座に200を返す
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
    print(f"DEBUG: normalized_path (before stage removal)={normalized_path}")
    
    # stage 除去（/prod/clients → /clients, /prod → /）
    for stage in ('/prod', '/stg', '/dev', '/stage', '/test'):
        if normalized_path == stage:
            normalized_path = '/'
            break
        elif normalized_path.startswith(stage + '/'):
            normalized_path = normalized_path[len(stage) + 1:]  # stage + '/' を除去
            break
    
    print(f"DEBUG: normalized_path (after stage removal)={normalized_path}")
    
    # 先頭にスラッシュがない場合は追加、再度末尾のスラッシュを除去して耐性を持たせる
    if normalized_path and not normalized_path.startswith('/'):
        normalized_path = '/' + normalized_path
    if normalized_path and len(normalized_path) > 1:
        normalized_path = normalized_path.rstrip('/')
    
    print(f"DEBUG: normalized_path (final)={normalized_path}")
    
    try:
        # パスに応じて処理を分岐
        if normalized_path == '/upload':
            # 画像アップロード
            return handle_image_upload(event, headers)
        elif normalized_path == '/upload-url':
            # 業務報告添付用 Presigned URL 取得（認証必須）
            if method == 'POST':
                return handle_upload_url(event, headers)
            return {'statusCode': 405, 'headers': headers, 'body': json.dumps({'error': 'Method not allowed'}, ensure_ascii=False)}
        elif normalized_path == '/upload-put':
            # Presigned URL 宛に Lambda が PUT（CORS プリフライト回避）
            if method == 'POST':
                return handle_upload_put(event, headers)
            return {'statusCode': 405, 'headers': headers, 'body': json.dumps({'error': 'Method not allowed'}, ensure_ascii=False)}
        elif normalized_path == '/ai/process' or normalized_path == '/staff/ai/process':
            # AIによるデータ処理（要約・生成・分析）。/staff/ai/process も同一ハンドラにフォールスルー
            if method == 'POST':
                return handle_ai_process(event, headers)
        elif normalized_path == '/chat':
            # 汎用チャットエンドポイント（画像解析対応）
            if method == 'POST':
                return handle_chat(event, headers)
        elif normalized_path == '/extract/store-info':
            # URLや店名から店舗情報を抽出
            if method == 'POST':
                return handle_extract_store_info(event, headers)
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
        elif normalized_path.startswith('/reports/'):
            parts = normalized_path.split('/')
            if len(parts) >= 4 and parts[3] == 'flags':
                report_id = parts[2]
                if len(parts) == 5 and parts[4] == 'suggest':
                    if method == 'POST':
                        return handle_report_flags_suggest(report_id, event, headers)
                    return {
                        'statusCode': 405,
                        'headers': headers,
                        'body': json.dumps({'error': 'Method not allowed'}, ensure_ascii=False)
                    }
                if len(parts) == 4:
                    if method == 'GET':
                        return handle_report_flags_list(report_id, event, headers)
                    return {
                        'statusCode': 405,
                        'headers': headers,
                        'body': json.dumps({'error': 'Method not allowed'}, ensure_ascii=False)
                    }
                if len(parts) == 5:
                    flag_id = parts[4]
                    if method == 'PATCH':
                        return handle_report_flags_patch(report_id, flag_id, event, headers)
                    return {
                        'statusCode': 405,
                        'headers': headers,
                        'body': json.dumps({'error': 'Method not allowed'}, ensure_ascii=False)
                    }
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({'error': 'Not found'}, ensure_ascii=False)
            }
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
        elif normalized_path.startswith('/admin/attendance/users/') and normalized_path.endswith('/detail'):
            worker_id = normalized_path.split('/')[-2]
            if method == 'GET':
                return get_admin_attendance_user_detail(event, headers, worker_id)
        elif normalized_path == '/admin/attendance/board':
            # 勤怠司令塔ボード
            if method == 'GET':
                return get_admin_attendance_board(event, headers)
        elif normalized_path == '/admin/attendance/monthly/summary':
            # 月次サマリー
            if method == 'GET':
                return get_admin_attendance_monthly_summary(event, headers)
        elif normalized_path == '/admin/attendance/monthly/users':
            # 月次人別
            if method == 'GET':
                return get_admin_attendance_monthly_users(event, headers)
        elif normalized_path.startswith('/admin/attendance/') and normalized_path.endswith('/fixed'):
            # 勤怠内容の修正・確定
            attendance_id = normalized_path.split('/')[-2]
            if method == 'PATCH' or method == 'PUT':
                return patch_admin_attendance_fixed(attendance_id, event, headers)
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
        elif normalized_path == '/settings/portal-operating-days':
            # 玄関（Portal）稼働日設定：非稼働日リストの取得・更新（S3保存）
            if method == 'GET':
                return get_portal_operating_days(headers)
            elif method == 'PUT':
                return put_portal_operating_days(event, headers)
            return {'statusCode': 405, 'headers': headers, 'body': json.dumps({'error': 'Method not allowed'}, ensure_ascii=False)}
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
        elif normalized_path == '/admin/import/google-ics':
            # GoogleカレンダーICS取り込み（管理者のみ）
            if method == 'POST':
                return import_google_ics(event, headers)
            return {
                'statusCode': 405,
                'headers': headers,
                'body': json.dumps({'error': 'Method not allowed'}, ensure_ascii=False)
            }
        elif normalized_path == '/yotei':
            # YOTEI v2 schedules
            if method == 'GET':
                return yotei_get_schedules(event, headers)
            elif method == 'POST':
                return yotei_create_schedule(event, headers)
        elif normalized_path == '/yotei/dispatch':
            # YOTEI v2 dispatch list
            if method == 'GET':
                return yotei_get_dispatch(event, headers)
        elif normalized_path.startswith('/yotei/dispatch/'):
            # YOTEI v2 dispatch upsert/patch
            dispatch_id = normalized_path.split('/')[-1]
            if method == 'PUT':
                return yotei_put_dispatch(dispatch_id, event, headers)
            elif method == 'PATCH':
                return yotei_patch_dispatch(dispatch_id, event, headers)
        elif normalized_path.startswith('/yotei/'):
            # YOTEI v2 schedule detail
            schedule_id = normalized_path.split('/')[-1]
            if method == 'GET':
                return yotei_get_schedule_detail(schedule_id, headers)
            elif method == 'PUT':
                return yotei_update_schedule(schedule_id, event, headers)
            elif method == 'DELETE':
                return yotei_delete_schedule(schedule_id, headers)
        elif normalized_path == '/ugoki':
            # UGOKI v2 status management
            if method == 'GET':
                return ugoki_get_list(event, headers)
        elif normalized_path.startswith('/ugoki/'):
            # UGOKI v2 status detail/patch/start/done
            parts = normalized_path.split('/')
            yotei_id = parts[2]
            action = parts[3] if len(parts) > 3 else None
            
            if action == 'start' and method == 'POST':
                event['body'] = json.dumps({'jotai': 'shinkou'})
                return ugoki_patch_status(yotei_id, event, headers)
            elif action == 'done' and method == 'POST':
                event['body'] = json.dumps({'jotai': 'kanryou'})
                return ugoki_patch_status(yotei_id, event, headers)
            elif not action:
                if method == 'GET':
                    return ugoki_get_detail(yotei_id, headers)
                elif method == 'PATCH':
                    return ugoki_patch_status(yotei_id, event, headers)
        elif normalized_path == '/me/yotei':
            if method == 'GET':
                return worker_me_yotei(event, headers)
        elif normalized_path.startswith('/master/'):
            # マスタCRUD (/master/torihikisaki, /master/yagou, /master/tenpo, /master/souko)
            parts = normalized_path.split('/')
            collection = parts[2] if len(parts) >= 3 else None
            record_id = parts[3] if len(parts) >= 4 else None
            
            if collection in ['torihikisaki', 'yagou', 'tenpo', 'souko']:
                return handle_master_crud(collection, record_id, event, headers)
        elif normalized_path == '/yakusoku':
            if method == 'GET':
                return yakusoku_get_list(event, headers)
            elif method == 'POST':
                return yakusoku_create(event, headers)
        elif normalized_path.startswith('/yakusoku/'):
            yakusoku_id = normalized_path.split('/')[-1]
            if method == 'GET':
                return yakusoku_get_detail(yakusoku_id, event, headers)
            elif method == 'PUT':
                return yakusoku_update(yakusoku_id, event, headers)
            elif method == 'DELETE':
                return yakusoku_delete(yakusoku_id, event, headers)
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
        elif normalized_path == '/blocks':
            # ブロック（クローズ）の取得・作成
            if method == 'GET':
                return get_blocks(event, headers)
            elif method == 'POST':
                return create_block(event, headers)
        elif normalized_path.startswith('/blocks/'):
            # ブロック詳細の取得・更新・削除
            block_id = normalized_path.split('/')[-1]
            if method == 'GET':
                return get_block_detail(block_id, headers)
            elif method == 'PUT':
                return update_block(block_id, event, headers)
            elif method == 'DELETE':
                return delete_block(block_id, headers)
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
            elif query_params.get('type') == 'simple_cleaning':
                # 新規：シンプル版清掃報告
                if method == 'POST':
                    return create_simple_cleaning_report(event, headers)
                elif method == 'GET':
                    return get_simple_cleaning_reports(event, headers)
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
        elif normalized_path.startswith('/schedules/') and normalized_path.endswith('/decline'):
            # スケジュール辞退
            schedule_id = normalized_path.split('/')[2] if len(normalized_path.split('/')) > 2 else ''
            if method == 'POST':
                return decline_schedule(schedule_id, event, headers)
        elif normalized_path.startswith('/schedules/'):
            # スケジュール詳細の取得・更新・削除
            schedule_id = normalized_path.split('/')[-1]
            if method == 'GET':
                return get_schedule_detail(schedule_id, headers)
            elif method == 'PUT':
                return update_schedule(schedule_id, event, headers)
            elif method == 'DELETE':
                return delete_schedule(schedule_id, headers)
        elif normalized_path == '/sales/availability-matrix':
            # 営業向け 稼働可否マトリクス
            if method == 'GET':
                return get_sales_availability_matrix(event, headers)
        elif normalized_path == '/workers/me/availability':
            # 作業者本人の稼働可否を取得/更新
            if method == 'GET':
                return get_worker_availability(event, headers)
            elif method == 'PUT':
                return update_worker_availability(event, headers)
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
            # クライアント（お客様）詳細の取得・更新・削除、または登録申込書送付
            parts = normalized_path.split('/')
            if len(parts) >= 4 and parts[-1] == 'send-registration':
                # /clients/{client_id}/send-registration - 登録申込書メール送付
                client_id = parts[-2]
                if method == 'POST':
                    return send_registration_form(client_id, event, headers)
                else:
                    return {
                        'statusCode': 405,
                        'headers': headers,
                        'body': json.dumps({'error': 'Method not allowed'}, ensure_ascii=False)
                    }
            else:
                client_id = parts[-1]
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
        elif normalized_path == '/store-audits':
            # 店舗査定一覧の取得・作成
            if method == 'GET':
                return get_store_audits(event, headers)
            elif method == 'POST':
                return create_store_audit(event, headers)
            else:
                return {
                    'statusCode': 405,
                    'headers': headers,
                    'body': json.dumps({'error': 'Method not allowed'}, ensure_ascii=False)
                }
        elif normalized_path.startswith('/store-audits/'):
            # 店舗査定詳細の取得
            audit_id = normalized_path.split('/')[-1]
            if method == 'GET':
                return get_store_audit_detail(audit_id, headers)
            else:
                return {
                    'statusCode': 405,
                    'headers': headers,
                    'body': json.dumps({'error': 'Method not allowed'}, ensure_ascii=False)
                }
        # ========================================
        # ライン機能（チケットB）
        # ========================================
        elif normalized_path == '/line/status':
            # ラインステータス取得
            if method == 'GET':
                return get_line_status(event, headers)
            else:
                return {
                    'statusCode': 405,
                    'headers': headers,
                    'body': json.dumps({'error': 'Method not allowed'}, ensure_ascii=False)
                }
        elif normalized_path == '/line/pass':
            # ライン通過処理
            if method == 'POST':
                return handle_line_pass(event, headers)
            else:
                return {
                    'statusCode': 405,
                    'headers': headers,
                    'body': json.dumps({'error': 'Method not allowed'}, ensure_ascii=False)
                }
        # ========================================
        # 業務報告（work-report / admin/work-reports / admin/payroll）
        # /admin/work-reports: 一覧・詳細・PATCH state・PDF
        # /admin/payroll: 経理用・ユーザー×年月の月次ビュー
        # ========================================
        # universal_work_reports routing removed
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
        # NOTE:
        # - 既存のエラーレスポンス仕様は維持する
        # - ただし DEBUG_LOG=1 のときは原因特定のため、必ず traceback を出して raise する
        import os
        import traceback

        if os.getenv("DEBUG_LOG") == "1":
            print("🔥 UNHANDLED ERROR")
            try:
                # event が巨大/非JSON化の場合でも落ちないように安全に要約して出す
                event_summary = json.dumps(event, ensure_ascii=False, default=str)[:4000]
            except Exception:
                event_summary = "<event not json serializable>"
            print("event=", event_summary)
            print("error=", repr(e))
            traceback.print_exc()
            raise

        error_trace = traceback.format_exc()
        print(f"Error in _lambda_handler_internal: {str(e)}")
        print(f"Traceback: {error_trace}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'Internal Server Error',
                'message': str(e),
                'stage': event.get('requestContext', {}).get('stage')
            }, ensure_ascii=False)
        }

def _sanitize_upload_filename(filename):
    """アップロード用ファイル名をサニタイズ（reports/ 用）"""
    if not filename or not isinstance(filename, str):
        return 'file'
    import re
    base = re.sub(r'^.*[/\\]', '', filename)
    base = re.sub(r'[^\w\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf.\-]', '_', base)
    return (base[:200] or 'file')


def handle_upload_url(event, headers):
    """
    POST /upload-url: 業務報告添付用 Presigned URL を発行（認証必須）
    ボディ: { filename, mime, size, context, date, storeKey? }
    返却: { uploadUrl, fileUrl, key }
    """
    user_info = _get_user_info_from_event(event)
    if not user_info:
        print("[upload-url] 403/401: user_info is None (token missing or invalid; 403 may be from API Gateway Authorizer)")
        return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Unauthorized'}, ensure_ascii=False)}
    try:
        body = event.get('body') or '{}'
        body_json = json.loads(body) if isinstance(body, str) else body
    except json.JSONDecodeError:
        return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Invalid JSON'}, ensure_ascii=False)}
    filename = body_json.get('filename') or 'file'
    mime = body_json.get('mime') or 'application/octet-stream'
    date = body_json.get('date') or datetime.utcnow().strftime('%Y-%m-%d')
    safe_name = _sanitize_upload_filename(filename)
    key = f"reports/{date}/{str(uuid.uuid4())}_{safe_name}"
    # 業務報告専用バケット（WORK_REPORTS_BUCKET）があれば優先、なければ UPLOAD_BUCKET / S3_BUCKET_NAME
    bucket = os.environ.get('WORK_REPORTS_BUCKET') or os.environ.get('UPLOAD_BUCKET', S3_BUCKET_NAME)
    region = os.environ.get('S3_REGION', S3_REGION)
    try:
        upload_url = s3_client.generate_presigned_url(
            'put_object',
            Params={'Bucket': bucket, 'Key': key, 'ContentType': mime},
            ExpiresIn=3600
        )
    except Exception as e:
        print(f"[upload-url] presign failed: {e}")
        return {'statusCode': 500, 'headers': headers, 'body': json.dumps({'error': 'Failed to generate upload URL'}, ensure_ascii=False)}
    file_url = f"https://{bucket}.s3.{region}.amazonaws.com/{key}"
    return {
        'statusCode': 200,
        'headers': headers,
        'body': json.dumps({'uploadUrl': upload_url, 'fileUrl': file_url, 'key': key}, ensure_ascii=False)
    }


def handle_upload_put(event, headers):
    """
    POST /upload-put: Presigned URL 宛に Lambda が PUT する（CORS プリフライト回避用）
    ボディ JSON: { uploadUrl, contentType, fileBase64 }
    フロントは S3 に直接 PUT せずこの API を呼ぶことで、S3 CORS プリフライト問題を回避する。
    ペイロード制限: Lambda 6MB のため、base64 込みで約 4.5MB 程度のファイルまで。
    """
    user_info = _get_user_info_from_event(event)
    if not user_info:
        print("[upload-put] 401: user_info is None")
        return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Unauthorized'}, ensure_ascii=False)}
    try:
        body = event.get('body') or '{}'
        body_json = json.loads(body) if isinstance(body, str) else body
    except json.JSONDecodeError:
        return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Invalid JSON'}, ensure_ascii=False)}
    upload_url = body_json.get('uploadUrl')
    contentType = body_json.get('contentType') or 'application/octet-stream'
    file_b64 = body_json.get('fileBase64')
    if not upload_url or not file_b64:
        return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'uploadUrl and fileBase64 required'}, ensure_ascii=False)}
    try:
        file_bytes = base64.b64decode(file_b64)
    except Exception as e:
        print(f"[upload-put] base64 decode failed: {e}")
        return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Invalid base64'}, ensure_ascii=False)}
    try:
        req = urllib.request.Request(upload_url, data=file_bytes, method='PUT', headers={'Content-Type': contentType})
        with urllib.request.urlopen(req, timeout=60) as resp:
            if resp.status not in (200, 204):
                print(f"[upload-put] S3 PUT returned {resp.status}")
                return {'statusCode': 502, 'headers': headers, 'body': json.dumps({'error': 'Upload failed'}, ensure_ascii=False)}
    except urllib.error.HTTPError as e:
        print(f"[upload-put] S3 PUT HTTPError: {e.code} {e.reason}")
        return {'statusCode': 502, 'headers': headers, 'body': json.dumps({'error': 'Upload failed'}, ensure_ascii=False)}
    except Exception as e:
        print(f"[upload-put] S3 PUT failed: {e}")
        return {'statusCode': 502, 'headers': headers, 'body': json.dumps({'error': 'Upload failed'}, ensure_ascii=False)}
    return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'ok': True}, ensure_ascii=False)}


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

def verify_cognito_id_token(id_token):
    """
    Cognito ID Token（Authorization: Bearer）を検証（簡易デコード版）。
    注意: 本番環境では、適切なJWT検証ライブラリで署名検証を行うことを推奨。
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
        
        # Cognitoグループをチェック（文字列で渡る場合あり）
        groups_raw = payload.get('cognito:groups', [])
        groups = groups_raw if isinstance(groups_raw, list) else (groups_raw.split(',') if isinstance(groups_raw, str) else [])
        if not role and groups:
            g_lower = [str(g).lower() for g in groups]
            if 'admin' in g_lower:
                role = 'admin'
            elif 'headquarters' in g_lower:
                role = 'headquarters'
            elif 'staff' in g_lower:
                role = 'cleaning'
        
        unit_id = payload.get('custom:unit_id') or payload.get('unit_id') or payload.get('tenant_id')

        # デフォルトロール
        if not role:
            role = 'cleaning'
        
        return {
            'uid': uid,
            'cognito_sub': uid,
            'email': email,
            'name': name,
            'role': role,
            'unit_id': unit_id,
            'verified': True  # Cognitoトークンがデコードできた場合は認証済みとみなす
        }
    except Exception as e:
        print(f"Error verifying token: {str(e)}")
        # エラー時はNoneを返す（認証失敗）
        return None


def _is_master_role(role):
    """admin または headquarters（マスター＝全閲覧可）"""
    return role in ('admin', 'headquarters')


def check_admin_permission(user_info):
    """
    管理者権限をチェック（admin または headquarters＝マスター）
    """
    return _is_master_role(user_info.get('role'))


def _get_user_info_from_event(event):
    """
    API GatewayのAuthorizerコンテキスト、またはAuthorizationヘッダーからユーザー情報を取得
    """
    # 1. API Gateway Authorizer (verified claims) を優先
    authorizer_claims = event.get('requestContext', {}).get('authorizer', {}).get('claims')
    if authorizer_claims:
        uid = authorizer_claims.get('sub') or authorizer_claims.get('cognito:username')
        role = authorizer_claims.get('custom:role')
        groups = authorizer_claims.get('cognito:groups', [])
        # 文字列として渡ってくる場合があるためリスト化
        if isinstance(groups, str):
            groups = groups.split(',')
        
        if not role and groups:
            if any(g.lower() == 'admin' for g in groups):
                role = 'admin'
        
        return {
            'uid': uid,
            'email': authorizer_claims.get('email'),
            'role': role or 'cleaning',
            'verified': True
        }

    # 2. Authorizationヘッダーからのデコード（Fallback/Local Test）
    auth_header = _get_auth_header(event)
    id_token = auth_header.replace('Bearer ', '') if auth_header else ''
    if id_token:
        return verify_cognito_id_token(id_token)
    
    return None

def _resolve_unit_id(user_info):
    unit_id = None
    if user_info:
        unit_id = user_info.get('unit_id') or user_info.get('custom:unit_id')
    return unit_id or 'unit_internal'

def handle_report_flags_suggest(report_id, event, headers):
    user_info = _get_user_info_from_event(event)
    if not user_info:
        return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Unauthorized'}, ensure_ascii=False)}

    role = user_info.get('role')
    if not can_suggest(role):
        return {'statusCode': 403, 'headers': headers, 'body': json.dumps({'error': 'Forbidden'}, ensure_ascii=False)}

    try:
        body_json = json.loads(event.get('body') or '{}')
    except json.JSONDecodeError:
        return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Invalid JSON'}, ensure_ascii=False)}

    try:
        payload = SuggestFlagRequest(**body_json)
    except ValidationError as exc:
        return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Validation error', 'details': exc.errors()}, ensure_ascii=False)}

    now = datetime.utcnow().isoformat() + 'Z'
    unit_id = _resolve_unit_id(user_info)
    flag_id = str(uuid.uuid4())
    pk = build_report_flag_pk(unit_id, report_id)
    item = {
        'pk': pk,
        'sk': flag_id,
        'unit_id': unit_id,
        'report_id': report_id,
        'flag_id': flag_id,
        'type': payload.type,
        'origin': payload.origin.value,
        'severity': payload.severity,
        'evidence': payload.evidence,
        'decision': None,
        'tags': payload.tags or [],
        'state': 'open',
        'created_at': now,
        'updated_at': now
    }

    REPORT_FLAGS_TABLE.put_item(Item=item)
    return {'statusCode': 201, 'headers': headers, 'body': json.dumps(item, ensure_ascii=False)}

def handle_report_flags_list(report_id, event, headers):
    user_info = _get_user_info_from_event(event)
    if not user_info:
        return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Unauthorized'}, ensure_ascii=False)}

    role = user_info.get('role')
    if not can_list(role):
        return {'statusCode': 403, 'headers': headers, 'body': json.dumps({'error': 'Forbidden'}, ensure_ascii=False)}

    query_params = event.get('queryStringParameters') or {}
    filter_state = query_params.get('state')
    filter_type = query_params.get('type')
    filter_origin = query_params.get('origin')

    unit_id = _resolve_unit_id(user_info)
    pk = build_report_flag_pk(unit_id, report_id)
    response = REPORT_FLAGS_TABLE.query(
        KeyConditionExpression=Key('pk').eq(pk)
    )
    items = response.get('Items', [])

    if filter_state:
        items = [item for item in items if item.get('state') == filter_state]
    if filter_type:
        items = [item for item in items if item.get('type') == filter_type]
    if filter_origin:
        items = [item for item in items if item.get('origin') == filter_origin]

    return {'statusCode': 200, 'headers': headers, 'body': json.dumps(items, ensure_ascii=False)}

def handle_report_flags_patch(report_id, flag_id, event, headers):
    user_info = _get_user_info_from_event(event)
    if not user_info:
        return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Unauthorized'}, ensure_ascii=False)}

    role = user_info.get('role')
    if not can_patch(role):
        return {'statusCode': 403, 'headers': headers, 'body': json.dumps({'error': 'Forbidden'}, ensure_ascii=False)}

    try:
        body_json = json.loads(event.get('body') or '{}')
    except json.JSONDecodeError:
        return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Invalid JSON'}, ensure_ascii=False)}

    if has_disallowed_patch_fields(body_json):
        return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Only state and decision can be updated'}, ensure_ascii=False)}

    try:
        payload = PatchFlagRequest(**body_json)
    except ValidationError as exc:
        return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Validation error', 'details': exc.errors()}, ensure_ascii=False)}

    unit_id = _resolve_unit_id(user_info)
    pk = build_report_flag_pk(unit_id, report_id)
    existing = REPORT_FLAGS_TABLE.get_item(Key={'pk': pk, 'sk': flag_id}).get('Item')
    if not existing:
        return {'statusCode': 404, 'headers': headers, 'body': json.dumps({'error': 'Not found'}, ensure_ascii=False)}
    if not is_same_unit(unit_id, existing.get('unit_id')):
        return {'statusCode': 403, 'headers': headers, 'body': json.dumps({'error': 'Forbidden'}, ensure_ascii=False)}

    now = datetime.utcnow().isoformat() + 'Z'
    update_expr_parts = ['#state = :state', 'updated_at = :updated_at']
    expr_attr_names = {'#state': 'state'}
    expr_attr_values = {':state': payload.state.value, ':updated_at': now}

    if payload.decision is not None:
        update_expr_parts.append('decision = :decision')
        expr_attr_values[':decision'] = payload.decision.dict()

    REPORT_FLAGS_TABLE.update_item(
        Key={'pk': pk, 'sk': flag_id},
        UpdateExpression='SET ' + ', '.join(update_expr_parts),
        ExpressionAttributeNames=expr_attr_names,
        ExpressionAttributeValues=expr_attr_values
    )

    updated = REPORT_FLAGS_TABLE.get_item(Key={'pk': pk, 'sk': flag_id}).get('Item')
    return {'statusCode': 200, 'headers': headers, 'body': json.dumps(updated, ensure_ascii=False)}

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
        - image / image_data: Base64エンコードされた画像
        - category: 'before', 'after', 'stock', 'extra'
        - cleaning_date: 清掃日 (YYYY-MM-DD形式)
        - folder_name: フォルダ名（オプション）
        - image_hash: 画像のハッシュ値（オプション）
    """
    try:
        # リクエストボディを安全に取得（Base64エンコード対策）
        body_raw = event.get('body')
        print(f"DEBUG: body_raw type={type(body_raw)}")
        
        if event.get('isBase64Encoded') and isinstance(body_raw, str):
            body_raw = base64.b64decode(body_raw)
            
        if isinstance(body_raw, bytes):
            body_raw = body_raw.decode('utf-8')
            
        if isinstance(body_raw, str):
            body = json.loads(body_raw)
        elif isinstance(body_raw, dict):
            body = body_raw
        else:
            body = {}
            
        print(f"DEBUG: body keys={list(body.keys())}")
        
        image_data = body.get('image') or body.get('image_data')
        category = body.get('category') or 'extra'
        cleaning_date = body.get('cleaning_date')
        staff_id = body.get('staff_id', 'unknown')
        folder_name = body.get('folder_name')  # フォルダ名（オプション）
        image_hash = body.get('image_hash')  # ハッシュ値（オプション）
        
        # バリデーション
        if not image_data:
            print(f"ERROR: No image data in body. Body snippet: {str(body)[:200]}")
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': '画像データが必要です', 'debug_keys': list(body.keys())}, ensure_ascii=False)
            }
        
        if category not in ['before', 'after', 'stock', 'extra']:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'categoryは"before", "after", "stock", "extra"を指定してください'}, ensure_ascii=False)
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
        auth_header = _get_auth_header(event)
        id_token = auth_header.replace('Bearer ', '') if auth_header else ''
        
        # 開発環境ではdev-tokenを許可
        if id_token and id_token != 'dev-token':
            user_info = verify_cognito_id_token(id_token)
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
        # Cognito ID Token（Bearer）を取得
        auth_header = _get_auth_header(event)
        id_token = auth_header.replace('Bearer ', '') if auth_header else ''
        
        # トークンを検証（清掃員もレポート作成可能）
        user_info = verify_cognito_id_token(id_token)
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

def create_simple_cleaning_report(event, headers):
    """
    管理者・清掃員向けの非常にシンプルなテキストベースのレポート作成
    """
    try:
        body = event.get('body', '')
        if isinstance(body, str):
            body_json = json.loads(body)
        else:
            body_json = json.loads(body.decode('utf-8'))
            
        report_id = str(uuid.uuid4())
        # JST (GMT+9) を取得。
        now = (datetime.utcnow() + timedelta(hours=9)).isoformat() + '+09:00'
        
        # ユーザー情報を取得
        headers_dict = _get_headers(event)
        auth_header = _get_auth_header(event)
        # X-Simple-Auth もチェック
        simple_auth = headers_dict.get('X-Simple-Auth') or headers_dict.get('x-simple-auth')
        
        user_info = {}
        token = simple_auth or (auth_header.replace('Bearer ', '') if auth_header else None)
        
        if token:
            try:
                user_info = verify_cognito_id_token(token)
            except:
                pass

        report_item = {
            'log_id': report_id,
            'report_type': 'simple_cleaning',
            'work_date': body_json.get('work_date') or body_json.get('date'),
            'target_label': body_json.get('target_label', '不明'),
            'created_by_name': body_json.get('created_by_name') or user_info.get('email', '不明'),
            'work_minutes': int(body_json.get('work_minutes', 0)),
            'report_text': body_json.get('report_text', ''),
            'description': body_json.get('description', ''), # Fallback compatibility
            'created_at': now,
            'updated_at': now,
            'status': 'submitted',
            'state': 'submitted'
        }
        
        REPORTS_TABLE.put_item(Item=report_item)
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'status': 'success', 'report_id': report_id}, ensure_ascii=False)
        }
    except Exception as e:
        print(f"[ERROR] create_simple_cleaning_report failed: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': str(e)}, ensure_ascii=False)
        }

def get_simple_cleaning_reports(event, headers):
    """
    シンプルレポート一覧取得
    """
    try:
        params = event.get('queryStringParameters') or {}
        target_date = params.get('date') or params.get('work_date')
        
        # staff-reports テーブルをスキャン (小規模運用なら十分)
        # report_type = 'simple_cleaning' でフィルタ
        fe = Attr('report_type').eq('simple_cleaning')
        if target_date:
            fe = fe & (Attr('work_date').eq(target_date) | Attr('date').eq(target_date))
        
        resp = REPORTS_TABLE.scan(FilterExpression=fe, Limit=100)
        items = resp.get('Items', [])
        
        # 最新順にソート (created_at desc)
        items.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        # Decimal 対策
        items_serializable = json.loads(json.dumps(items, default=str))
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(items_serializable, ensure_ascii=False)
        }
    except Exception as e:
        print(f"[ERROR] get_simple_cleaning_reports failed: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': str(e)}, ensure_ascii=False)
        }

def get_reports(event, headers):
    """
    レポート一覧を取得
    """
    try:
        # Cognito ID Token（Bearer）を取得
        auth_header = _get_auth_header(event)
        id_token = auth_header.replace('Bearer ', '') if auth_header else ''
        
        # トークンを検証
        user_info = verify_cognito_id_token(id_token)
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
        
        # 管理者・マスターは全レポートを取得、清掃員は自分のレポートのみ
        is_admin = _is_master_role(user_info.get('role'))
        user_uid = user_info.get('uid')
        
        # フィルター条件を構築
        filter_expressions = []
        
        # ステータスフィルター
        if status_filter:
            filter_expressions.append(Attr('status').eq(status_filter))
        
        # レポート種別フィルター (diagnosis, cleaning, daily, etc.)
        report_type_filter = query_params.get('report_type')
        if report_type_filter:
            filter_expressions.append(Attr('report_type').eq(report_type_filter))
        
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
        # Cognito ID Token（Bearer）を取得
        auth_header = _get_auth_header(event)
        id_token = auth_header.replace('Bearer ', '') if auth_header else ''
        
        # トークンを検証
        user_info = verify_cognito_id_token(id_token)
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

def _extract_json_payload(raw_text):
    if isinstance(raw_text, dict):
        return raw_text
    if raw_text is None:
        return None
    if not isinstance(raw_text, str):
        raw_text = str(raw_text)
    try:
        return json.loads(raw_text)
    except Exception:
        match = re.search(r'\{[\s\S]*\}', raw_text)
        if match:
            try:
                return json.loads(match.group(0))
            except Exception:
                return None
    return None

def _validate_sales_schema(action, payload):
    if not isinstance(payload, dict):
        return False, 'payload must be an object'

    if action == 'suggest_estimate':
        required_keys = {'company_name', 'store_name', 'services', 'notes'}
        allowed_keys = set(required_keys)
        missing = required_keys - set(payload.keys())
        if missing:
            return False, f'missing keys: {", ".join(sorted(missing))}'
        extra = set(payload.keys()) - allowed_keys
        if extra:
            return False, f'extra keys not allowed: {", ".join(sorted(extra))}'
        if not isinstance(payload.get('company_name'), str):
            return False, 'company_name must be string'
        if not isinstance(payload.get('store_name'), str):
            return False, 'store_name must be string'
        if not isinstance(payload.get('notes'), str):
            return False, 'notes must be string'
        services = payload.get('services')
        if not isinstance(services, list):
            return False, 'services must be array'
        for idx, svc in enumerate(services):
            if not isinstance(svc, dict):
                return False, f'services[{idx}] must be object'
            if set(svc.keys()) != {'name', 'quantity'}:
                return False, f'services[{idx}] must have name and quantity only'
            if not isinstance(svc.get('name'), str):
                return False, f'services[{idx}].name must be string'
            if not isinstance(svc.get('quantity'), (int, float)):
                return False, f'services[{idx}].quantity must be number'
        return True, None

    if action == 'suggest_request_form':
        required_keys = {'client_name', 'brand_name', 'store_name', 'assessments', 'survey', 'work', 'logistics', 'notes'}
        allowed_keys = set(required_keys)
        missing = required_keys - set(payload.keys())
        if missing:
            return False, f'missing keys: {", ".join(sorted(missing))}'
        extra = set(payload.keys()) - allowed_keys
        if extra:
            return False, f'extra keys not allowed: {", ".join(sorted(extra))}'
        if not isinstance(payload.get('client_name'), str):
            return False, 'client_name must be string'
        if not isinstance(payload.get('brand_name'), str):
            return False, 'brand_name must be string'
        if not isinstance(payload.get('store_name'), str):
            return False, 'store_name must be string'
        if not isinstance(payload.get('notes'), str):
            return False, 'notes must be string'

        assessments = payload.get('assessments')
        if not isinstance(assessments, dict):
            return False, 'assessments must be object'
        for key in ['area1', 'area2', 'area3', 'area4']:
            area = assessments.get(key)
            if not isinstance(area, dict):
                return False, f'assessments.{key} must be object'
            if set(area.keys()) != {'status', 'note'}:
                return False, f'assessments.{key} must have status and note only'
            if area.get('status') not in ['good', 'warn', 'bad']:
                return False, f'assessments.{key}.status must be good|warn|bad'
            if not isinstance(area.get('note'), str):
                return False, f'assessments.{key}.note must be string'

        survey = payload.get('survey')
        if not isinstance(survey, dict):
            return False, 'survey must be object'
        survey_keys = {'issue', 'environment', 'area_sqm', 'notes', 'equipment'}
        if set(survey.keys()) != survey_keys:
            return False, 'survey keys must match schema'
        if not isinstance(survey.get('issue'), str):
            return False, 'survey.issue must be string'
        if not isinstance(survey.get('environment'), str):
            return False, 'survey.environment must be string'
        if not isinstance(survey.get('area_sqm'), str):
            return False, 'survey.area_sqm must be string'
        if not isinstance(survey.get('notes'), str):
            return False, 'survey.notes must be string'
        if not isinstance(survey.get('equipment'), list):
            return False, 'survey.equipment must be array'
        if not all(isinstance(item, str) for item in survey.get('equipment')):
            return False, 'survey.equipment items must be string'

        work = payload.get('work')
        if not isinstance(work, dict):
            return False, 'work must be object'
        work_keys = {'date', 'time', 'type', 'items'}
        if set(work.keys()) != work_keys:
            return False, 'work keys must match schema'
        if not isinstance(work.get('date'), str):
            return False, 'work.date must be string'
        if not isinstance(work.get('time'), str):
            return False, 'work.time must be string'
        if not isinstance(work.get('type'), str):
            return False, 'work.type must be string'
        if not isinstance(work.get('items'), list):
            return False, 'work.items must be array'
        if not all(isinstance(item, str) for item in work.get('items')):
            return False, 'work.items items must be string'

        logistics = payload.get('logistics')
        if not isinstance(logistics, dict):
            return False, 'logistics must be object'
        logistics_keys = {'parking', 'key'}
        if set(logistics.keys()) != logistics_keys:
            return False, 'logistics keys must match schema'
        if not isinstance(logistics.get('parking'), str):
            return False, 'logistics.parking must be string'
        if not isinstance(logistics.get('key'), str):
            return False, 'logistics.key must be string'

        return True, None

    return False, 'unsupported action'

def _log_staff_report_approval(report_id, existing_item, user_info, decision, reason_code, reason_text=None, review_comment=None):
    reviewed_at = datetime.utcnow().isoformat() + 'Z'
    snapshot_json = json.dumps(existing_item, ensure_ascii=False, sort_keys=True, default=str)
    snapshot_hash = hashlib.sha256(snapshot_json.encode('utf-8')).hexdigest()

    approval_item = {
        'approval_id': f"APR_{uuid.uuid4().hex}",
        'report_id': report_id,
        'reviewed_at': reviewed_at,
        'reviewer_id': user_info.get('uid'),
        'reviewer_name': user_info.get('name'),
        'reviewer_role': user_info.get('role'),
        'actor_id': user_info.get('uid'),
        'created_at': reviewed_at,
        'decision': decision,
        'reason_code': reason_code,
        'report_status_before': existing_item.get('status'),
        'report_status_after': decision,
        'reviewed_snapshot_json': snapshot_json,
        'reviewed_snapshot_hash': snapshot_hash
    }
    if reason_text:
        approval_item['reason_text'] = reason_text
    if review_comment:
        approval_item['review_comment'] = review_comment

    STAFF_REPORT_APPROVALS_TABLE.put_item(Item=approval_item)

def update_report(event, headers):
    """
    レポートを更新（管理者のみ）
    """
    try:
        # Cognito ID Token（Bearer）を取得
        auth_header = _get_auth_header(event)
        id_token = auth_header.replace('Bearer ', '') if auth_header else ''
        
        # トークンを検証
        user_info = verify_cognito_id_token(id_token)
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
        requested_status = body_json.get('status')
        if requested_status in ['approved', 'rejected', 'revision_requested']:
            reason_code = body_json.get('reason_code')
            if not reason_code:
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({'error': 'reason_code is required'}, ensure_ascii=False)
                }
            reason_text = body_json.get('reason_text')
            review_comment = body_json.get('revision_comment')
            try:
                _log_staff_report_approval(
                    report_id,
                    existing_item,
                    user_info,
                    requested_status,
                    reason_code,
                    reason_text,
                    review_comment
                )
            except Exception as e:
                return {
                    'statusCode': 500,
                    'headers': headers,
                    'body': json.dumps({
                        'error': 'approval_log_failed',
                        'message': str(e)
                    }, ensure_ascii=False)
                }
        
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
        # Cognito ID Token（Bearer）を取得
        auth_header = _get_auth_header(event)
        id_token = auth_header.replace('Bearer ', '') if auth_header else ''
        
        # トークンを検証
        user_info = verify_cognito_id_token(id_token)
        if not user_info.get('verified'):
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': 'Unauthorized'}, ensure_ascii=False)
            }
        
        is_admin = _is_master_role(user_info.get('role'))
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
        requested_status = body_json.get('status')
        if requested_status in ['approved', 'rejected', 'revision_requested']:
            if not is_admin:
                return {
                    'statusCode': 403,
                    'headers': headers,
                    'body': json.dumps({'error': 'Forbidden: Admin access required'}, ensure_ascii=False)
                }
            reason_code = body_json.get('reason_code')
            if not reason_code:
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({'error': 'reason_code is required'}, ensure_ascii=False)
                }
            reason_text = body_json.get('reason_text')
            review_comment = body_json.get('revision_comment')
            try:
                _log_staff_report_approval(
                    report_id,
                    existing_item,
                    user_info,
                    requested_status,
                    reason_code,
                    reason_text,
                    review_comment
                )
            except Exception as e:
                return {
                    'statusCode': 500,
                    'headers': headers,
                    'body': json.dumps({
                        'error': 'approval_log_failed',
                        'message': str(e)
                    }, ensure_ascii=False)
                }
        
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
        # Cognito ID Token（Bearer）を取得
        auth_header = _get_auth_header(event)
        id_token = auth_header.replace('Bearer ', '') if auth_header else ''
        
        # トークンを検証
        user_info = verify_cognito_id_token(id_token)
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


# ----------------------------
# YOTEI v2: schedules/dispatch
# ----------------------------
def _yotei_parse_body(event):
    if event.get('isBase64Encoded'):
        raw = base64.b64decode(event.get('body') or b'')
        text = raw.decode('utf-8') if isinstance(raw, (bytes, bytearray)) else str(raw or '')
    else:
        raw = event.get('body', '') or ''
        text = raw if isinstance(raw, str) else raw.decode('utf-8')
    return json.loads(text) if text else {}


def _yotei_normalize_datetime_parts(payload):
    scheduled_date = payload.get('scheduled_date') or payload.get('date')
    start_time = payload.get('start_time')
    end_time = payload.get('end_time')

    time_slot = payload.get('time_slot') or payload.get('scheduled_time')
    if time_slot and (not start_time or not end_time) and isinstance(time_slot, str) and '-' in time_slot:
        parts = [x.strip() for x in time_slot.split('-', 1)]
        if len(parts) == 2:
            start_time = start_time or parts[0]
            end_time = end_time or parts[1]

    start_at = payload.get('start_at')
    end_at = payload.get('end_at')

    if not scheduled_date and start_at:
        try:
            scheduled_date = str(start_at).split('T')[0]
        except Exception:
            pass

    if not start_at and scheduled_date and start_time:
        start_at = f"{scheduled_date}T{start_time}:00"
    if not end_at and scheduled_date and end_time:
        end_at = f"{scheduled_date}T{end_time}:00"

    return scheduled_date, start_time, end_time, start_at, end_at


def _yotei_collect_conflicts(worker_id, start_at, end_at, exclude_schedule_id=None):
    if not worker_id or not start_at or not end_at:
        return []

    try:
        # 重複判定は jotai=yuko のみ対象
        response = YOTEI_SCHEDULES_TABLE.scan(
            FilterExpression=(
                (Attr('sagyouin_id').eq(worker_id) | Attr('worker_id').eq(worker_id))
                & Attr('jotai').eq('yuko')
                & Attr('start_at').lt(end_at)
                & Attr('end_at').gt(start_at)
            ),
            Limit=2000
        )
        items = response.get('Items', [])
    except Exception as e:
        print(f"[yotei] conflict scan failed: {str(e)}")
        items = []

    conflicts = []
    for item in items:
        sid = item.get('id')
        if exclude_schedule_id and str(sid) == str(exclude_schedule_id):
            continue
        conflicts.append({
            'id': sid,
            'worker_id': worker_id,
            'start_at': item.get('start_at'),
            'end_at': item.get('end_at')
        })
    return conflicts


def _yotei_normalize_status(raw_status):
    s = str(raw_status or '').strip().lower()
    if s in ('cancelled', 'torikeshi'):
        return 'torikeshi'
    return 'yuko'


def _yotei_normalize_item_status(item):
    if not isinstance(item, dict):
        return item
    normalized = dict(item)
    s = _yotei_normalize_status(item.get('jotai') or item.get('status'))
    normalized['jotai'] = s
    # 互換性のための内部フィールドのみ残し、外部向けは jotai に統一
    
    # UIの期待値に合わせる
    if 'tenpo_name' not in normalized:
        normalized['tenpo_name'] = item.get('store_name') or item.get('target_name') or ''
    if 'sagyouin_name' not in normalized:
        normalized['sagyouin_name'] = item.get('worker_name') or item.get('staff_name') or ''
    if 'tenpo_id' not in normalized:
        normalized['tenpo_id'] = item.get('store_id') or ''
    if 'sagyouin_id' not in normalized:
        normalized['sagyouin_id'] = item.get('worker_id') or item.get('assigned_to') or ''
        
    return normalized


def yotei_create_schedule(event, headers):
    try:
        body = _yotei_parse_body(event)
        schedule_id = body.get('schedule_id') or body.get('id') or f"YOT-{uuid.uuid4().hex[:12]}"
        worker_id = body.get('sagyouin_id') or body.get('worker_id') or body.get('assigned_to') or body.get('cleaner_id')

        scheduled_date, start_time, end_time, start_at, end_at = _yotei_normalize_datetime_parts(body)
        yakusoku_id = body.get('yakusoku_id')
        
        if not scheduled_date or not worker_id or not start_at or not end_at or not yakusoku_id:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'scheduled_date, worker_id, start_at, end_at, and yakusoku_id are required'}, ensure_ascii=False)
            }

        conflicts = _yotei_collect_conflicts(worker_id, start_at, end_at)
        if conflicts:
            return {
                'statusCode': 409,
                'headers': headers,
                'body': json.dumps({
                    'error': 'yotei_conflict',
                    'message': '指定時間に重複があります',
                    'conflicts': conflicts
                }, ensure_ascii=False, default=str)
            }

        now = datetime.utcnow().isoformat() + 'Z'
        jotai_value = _yotei_normalize_status(body.get('jotai') or body.get('status'))
        
        # worker_id -> sagyouin_id, store_id -> tenpo_id への移行
        sagyouin_id = body.get('sagyouin_id') or worker_id
        tenpo_id = body.get('tenpo_id') or body.get('store_id')

        item = {
            'id': schedule_id,
            'schedule_id': schedule_id,
            'created_at': now,
            'updated_at': now,
            'date': scheduled_date,
            'scheduled_date': scheduled_date,
            'start_time': start_time,
            'end_time': end_time,
            'time_slot': body.get('time_slot') or body.get('scheduled_time') or (f"{start_time}-{end_time}" if start_time and end_time else None),
            'scheduled_time': body.get('scheduled_time') or body.get('time_slot') or (f"{start_time}-{end_time}" if start_time and end_time else None),
            'start_min': body.get('start_min'),
            'end_min': body.get('end_min'),
            'start_at': start_at,
            'end_at': end_at,
            'duration_minutes': body.get('duration_minutes', 60),
            'store_id': tenpo_id,
            'tenpo_id': tenpo_id,
            'client_id': body.get('client_id'),
            'brand_name': body.get('brand_name', ''),
            'store_name': body.get('store_name') or body.get('target_name') or '',
            'target_name': body.get('target_name') or body.get('store_name') or '',
            'work_type': body.get('work_type') or body.get('order_type') or 'その他',
            'yakusoku_id': body.get('yakusoku_id'),
            'status': jotai_value,
            'jotai': jotai_value,
            'worker_id': sagyouin_id,
            'sagyouin_id': sagyouin_id,
            'assigned_to': sagyouin_id,
            'worker_ids': body.get('worker_ids') or [sagyouin_id],
            'description': body.get('description') or body.get('notes') or body.get('memo') or '',
            'notes': body.get('notes') or body.get('description') or body.get('memo') or '',
            'memo': body.get('memo') or body.get('description') or body.get('notes') or '',
            'origin': body.get('origin') or 'manual',
        }
        item = {k: v for k, v in item.items() if v is not None}

        YOTEI_SCHEDULES_TABLE.put_item(
            Item=item,
            ConditionExpression='attribute_not_exists(id)'
        )
        
        # UGOKI の初期化
        try:
            UGOKI_TABLE.put_item(
                Item={
                    'yotei_id': schedule_id,
                    'jotai': 'mikanryo',
                    'jokyo': 'mikanryo',
                    'updated_at': now,
                    'sagyouin_id': sagyouin_id,
                    'tenpo_id': tenpo_id
                },
                ConditionExpression='attribute_not_exists(yotei_id)'
            )
        except Exception as ue:
            print(f"[yotei] failed to init ugoki: {str(ue)}")

        return {
            'statusCode': 201,
            'headers': headers,
            'body': json.dumps({'id': schedule_id, 'schedule_id': schedule_id}, ensure_ascii=False)
        }
    except YOTEI_SCHEDULES_TABLE.meta.client.exceptions.ConditionalCheckFailedException:
        return {
            'statusCode': 409,
            'headers': headers,
            'body': json.dumps({'error': 'duplicate_schedule_id'}, ensure_ascii=False)
        }
    except Exception as e:
        print(f"[yotei] create schedule failed: {str(e)}")
        traceback.print_exc()
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'Failed to create yotei schedule', 'message': str(e)}, ensure_ascii=False)
        }


def yotei_get_schedules(event, headers):
    try:
        query_params = event.get('queryStringParameters') or {}
        date = query_params.get('date')
        date_from = query_params.get('date_from')
        date_to = query_params.get('date_to')
        worker_id = query_params.get('worker_id') or query_params.get('assigned_to')
        store_id = query_params.get('store_id')
        status = query_params.get('status')
        limit = int(query_params.get('limit', 2000))

        filters = []
        if status:
            normalized_status = _yotei_normalize_status(status)
            filters.append((Attr('jotai').eq(normalized_status) | Attr('status').eq(normalized_status)))
        
        if worker_id:
            filters.append((Attr('sagyouin_id').eq(worker_id) | Attr('worker_id').eq(worker_id) | Attr('assigned_to').eq(worker_id)))
        if store_id:
            filters.append((Attr('tenpo_id').eq(store_id) | Attr('store_id').eq(store_id)))
        if date:
            filters.append((Attr('scheduled_date').eq(date) | Attr('date').eq(date)))
        elif date_from and date_to:
            filters.append((Attr('scheduled_date').between(date_from, date_to) | Attr('date').between(date_from, date_to)))
        elif date_from:
            filters.append((Attr('scheduled_date').gte(date_from) | Attr('date').gte(date_from)))
        elif date_to:
            filters.append((Attr('scheduled_date').lte(date_to) | Attr('date').lte(date_to)))

        if filters:
            filter_expr = filters[0]
            for expr in filters[1:]:
                filter_expr = filter_expr & expr
            response = YOTEI_SCHEDULES_TABLE.scan(FilterExpression=filter_expr, Limit=limit)
        else:
            response = YOTEI_SCHEDULES_TABLE.scan(Limit=limit)

        items = [_yotei_normalize_item_status(i) for i in response.get('Items', [])]
        
        # yakusoku 情報を JOIN
        yakusoku_ids = list(set([i['yakusoku_id'] for i in items if i.get('yakusoku_id')]))
        if yakusoku_ids:
            yak_map = {}
            for k in range(0, len(yakusoku_ids), 100):
                batch_keys = [{'yakusoku_id': yid} for yid in yakusoku_ids[k:k+100]]
                batch_res = dynamodb.batch_get_item(RequestItems={'yakusoku': {'Keys': batch_keys}})
                for yitem in batch_res.get('Responses', {}).get('yakusoku', []):
                    yak_map[yitem['yakusoku_id']] = yitem
            for i in items:
                if i.get('yakusoku_id') in yak_map:
                    i['yakusoku'] = yak_map[i['yakusoku_id']]

        items = sorted(items, key=lambda x: (str(x.get('scheduled_date') or x.get('date') or ''), str(x.get('start_at') or x.get('scheduled_time') or '')))
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'items': items, 'count': len(items), 'has_more': 'LastEvaluatedKey' in response}, ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"[yotei] get schedules failed: {str(e)}")
        traceback.print_exc()
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'Failed to get yotei schedules', 'message': str(e)}, ensure_ascii=False)
        }


def yotei_get_schedule_detail(schedule_id, headers):
    try:
        response = YOTEI_SCHEDULES_TABLE.get_item(Key={'id': schedule_id})
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({'error': 'schedule not found'}, ensure_ascii=False)
            }
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(_yotei_normalize_item_status(response['Item']), ensure_ascii=False, default=str)
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'Failed to get yotei schedule', 'message': str(e)}, ensure_ascii=False)
        }


def yotei_update_schedule(schedule_id, event, headers):
    try:
        current = YOTEI_SCHEDULES_TABLE.get_item(Key={'id': schedule_id}).get('Item')
        if not current:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({'error': 'schedule not found'}, ensure_ascii=False)
            }

        body = _yotei_parse_body(event)
        merged = {**current, **body}
        worker_id = merged.get('sagyouin_id') or merged.get('worker_id') or merged.get('assigned_to') or merged.get('cleaner_id')
        scheduled_date, start_time, end_time, start_at, end_at = _yotei_normalize_datetime_parts(merged)
        if not scheduled_date or not worker_id or not start_at or not end_at:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'scheduled_date, worker_id, start_at, end_at are required'}, ensure_ascii=False)
            }

        conflicts = _yotei_collect_conflicts(worker_id, start_at, end_at, exclude_schedule_id=schedule_id)
        if conflicts:
            return {
                'statusCode': 409,
                'headers': headers,
                'body': json.dumps({
                    'error': 'yotei_conflict',
                    'message': '指定時間に重複があります',
                    'conflicts': conflicts
                }, ensure_ascii=False, default=str)
            }

        now = datetime.utcnow().isoformat() + 'Z'
        jotai_value = _yotei_normalize_status(merged.get('jotai') or merged.get('status'))
        sagyouin_id = merged.get('sagyouin_id') or worker_id
        tenpo_id = merged.get('tenpo_id') or merged.get('store_id')

        updated_item = {
            **current,
            **body,
            'id': schedule_id,
            'schedule_id': schedule_id,
            'worker_id': sagyouin_id,
            'sagyouin_id': sagyouin_id,
            'assigned_to': sagyouin_id,
            'store_id': tenpo_id,
            'tenpo_id': tenpo_id,
            'date': scheduled_date,
            'scheduled_date': scheduled_date,
            'start_time': start_time,
            'end_time': end_time,
            'start_at': start_at,
            'end_at': end_at,
            'status': jotai_value,
            'jotai': jotai_value,
            'updated_at': now,
        }
        if start_time and end_time:
            slot = f"{start_time}-{end_time}"
            updated_item['time_slot'] = body.get('time_slot') or slot
            updated_item['scheduled_time'] = body.get('scheduled_time') or slot
        updated_item = {k: v for k, v in updated_item.items() if v is not None}
        YOTEI_SCHEDULES_TABLE.put_item(Item=updated_item)
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'status': 'success', 'id': schedule_id}, ensure_ascii=False)
        }
    except Exception as e:
        print(f"[yotei] update schedule failed: {str(e)}")
        traceback.print_exc()
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'Failed to update yotei schedule', 'message': str(e)}, ensure_ascii=False)
        }


def yotei_delete_schedule(schedule_id, headers):
    try:
        existing = YOTEI_SCHEDULES_TABLE.get_item(Key={'id': schedule_id}).get('Item')
        if not existing:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({'error': 'schedule not found'}, ensure_ascii=False)
            }
        now = datetime.utcnow().isoformat() + 'Z'
        YOTEI_SCHEDULES_TABLE.update_item(
            Key={'id': schedule_id},
            UpdateExpression='SET #jotai = :jotai, #status = :status, updated_at = :updated_at',
            ExpressionAttributeNames={'#jotai': 'jotai', '#status': 'status'},
            ExpressionAttributeValues={
                ':jotai': 'torikeshi',
                ':status': 'torikeshi',
                ':updated_at': now
            }
        )
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'status': 'success', 'id': schedule_id, 'torikeshi': True}, ensure_ascii=False)
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'Failed to delete yotei schedule', 'message': str(e)}, ensure_ascii=False)
        }


def yotei_get_dispatch(event, headers):
    try:
        query_params = event.get('queryStringParameters') or {}
        worker_id = query_params.get('worker_id')
        biz_date = query_params.get('biz_date')
        limit = int(query_params.get('limit', 500))

        filters = []
        if worker_id:
            filters.append(Attr('worker_id').eq(worker_id))
        if biz_date:
            filters.append(Attr('biz_date').eq(biz_date))

        if filters:
            filter_expr = filters[0]
            for expr in filters[1:]:
                filter_expr = filter_expr & expr
            response = YOTEI_DISPATCH_TABLE.scan(FilterExpression=filter_expr, Limit=limit)
        else:
            response = YOTEI_DISPATCH_TABLE.scan(Limit=limit)
        items = response.get('Items', [])
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'items': items, 'count': len(items)}, ensure_ascii=False, default=str)
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'Failed to get yotei dispatch', 'message': str(e)}, ensure_ascii=False)
        }


def yotei_put_dispatch(dispatch_id, event, headers):
    try:
        body = _yotei_parse_body(event)
        now = datetime.utcnow().isoformat() + 'Z'
        item = {
            'id': dispatch_id,
            'schedule_id': body.get('schedule_id'),
            'worker_id': body.get('worker_id'),
            'store_id': body.get('store_id'),
            'category': body.get('category', 'CLEAN'),
            'status': body.get('status', 'todo'),
            'biz_date': body.get('biz_date'),
            'updated_at': body.get('updated_at') or now,
            'meta': body.get('meta', {}),
        }
        item = {k: v for k, v in item.items() if v is not None}
        YOTEI_DISPATCH_TABLE.put_item(Item=item)
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'status': 'success', 'id': dispatch_id}, ensure_ascii=False)
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'Failed to put yotei dispatch', 'message': str(e)}, ensure_ascii=False)
        }


def ugoki_get_list(event, headers):
    try:
        query_params = event.get('queryStringParameters') or {}
        date_str = query_params.get('date') or datetime.utcnow().strftime('%Y-%m-%d')
        worker_id = query_params.get('worker_id') or query_params.get('sagyouin_id')

        # 1. 当日の yotei を取得
        filters = [Attr('scheduled_date').eq(date_str), Attr('jotai').eq('yuko')]
        if worker_id:
            filters.append(Attr('sagyouin_id').eq(worker_id) | Attr('worker_id').eq(worker_id))
        
        filter_expr = filters[0]
        for f in filters[1:]:
            filter_expr = filter_expr & f
            
        yotei_res = YOTEI_SCHEDULES_TABLE.scan(FilterExpression=filter_expr)
        yotei_items = yotei_res.get('Items', [])
        
        if not yotei_items:
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({'date': date_str, 'items': []}, ensure_ascii=False)
            }
            
        # 2. 対応する ugoki レコードを BatchGet
        yotei_ids = [y['id'] for y in yotei_items]
        ugoki_items = []
        for i in range(0, len(yotei_ids), 100):
            batch = yotei_ids[i:i+100]
            res = dynamodb.batch_get_item(
                RequestItems={
                    'ugoki': {
                        'Keys': [{'yotei_id': yid} for yid in batch]
                    }
                }
            )
            ugoki_items.extend(res.get('Responses', {}).get('ugoki', []))
            
        ugoki_map = {item['yotei_id']: item for item in ugoki_items}
        
        # 3. マージ & フラット化 (UIの期待値に合わせる)
        results = []
        now_ms = int(datetime.utcnow().timestamp() * 1000)
        for y in yotei_items:
            u = ugoki_map.get(y['id'], {
                'yotei_id': y['id'],
                'jotai': 'mikanryo',
                'jokyo': 'mikanryo',
                'sagyouin_id': y.get('sagyouin_id'),
                'tenpo_id': y.get('tenpo_id')
            })
            
            # 必須項目をトップレベルに配置
            item = {
                'id': y['id'],
                'yotei_id': y['id'],
                'start_at': y.get('start_at') or '',
                'end_at': y.get('end_at') or '',
                'tenpo_id': y.get('tenpo_id') or '',
                'tenpo_name': y.get('tenpo_name') or y.get('store_name') or y.get('target_name') or '',
                'sagyouin_id': y.get('sagyouin_id') or y.get('worker_id') or '',
                'sagyouin_name': y.get('sagyouin_name') or y.get('worker_name') or y.get('staff_name') or '',
                'work_type': y.get('work_type') or 'その他',
                'yotei_jotai': y.get('jotai') or 'yuko',
                
                # ugokiプロパティ (jotaiに一本化)
                'jotai': u.get('jotai') or u.get('jokyo') or 'mikanryo',
                'updated_at': u.get('updated_at') or '',
                'started_at': u.get('started_at') or '',
                'reason_code': u.get('reason_code') or '',
                'reason_note': u.get('reason_note') or u.get('admin_reason') or '',
                
                # 互換性・デバッグ用
                'ugoki': u
            }
            results.append(item)
            
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'date': date_str,
                'items': sorted(results, key=lambda x: str(x.get('start_at') or ''))
            }, ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"[ugoki] get list failed: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'Failed to get ugoki list', 'message': str(e)}, ensure_ascii=False)
        }

def ugoki_get_detail(yotei_id, headers):
    try:
        res = UGOKI_TABLE.get_item(Key={'yotei_id': yotei_id})
        item = res.get('Item')
        if not item:
            y_res = YOTEI_SCHEDULES_TABLE.get_item(Key={'id': yotei_id})
            y_item = y_res.get('Item')
            if not y_item:
                return {'statusCode': 404, 'headers': headers, 'body': json.dumps({'error': 'yotei not found'})}
            item = {
                'yotei_id': yotei_id,
                'jotai': 'mikanryo',
                'jokyo': 'mikanryo',
                'sagyouin_id': y_item.get('sagyouin_id'),
                'tenpo_id': y_item.get('tenpo_id')
            }
        
        item['jokyo'] = item.get('jokyo') or item.get('jotai')
        item['jotai'] = item.get('jotai') or item.get('jokyo')
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(item, ensure_ascii=False, default=str)
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'Failed to get ugoki detail', 'message': str(e)}, ensure_ascii=False)
        }

def ugoki_patch_status(yotei_id, event, headers):
    try:
        user_info = _get_user_info_from_event(event) or {}
        uid = user_info.get('uid')
        role = user_info.get('role', 'worker')
        is_admin = role in ('admin', 'headquarters')
        
        body = _yotei_parse_body(event)
        new_jotai = body.get('jotai') or body.get('jokyo')
        override = body.get('override')
        reason_note = body.get('reason_note') or body.get('note')
        reason = body.get('reason') or body.get('admin_reason') or reason_note
        reason_code = body.get('reason_code')
        
        if not new_jotai:
             return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'jotai or jokyo is required'})}

        if new_jotai not in ('mikanryo', 'shinkou', 'kanryou'):
            return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'invalid status'})}
            
        # 1. 現状取得
        res = UGOKI_TABLE.get_item(Key={'yotei_id': yotei_id})
        current_item = res.get('Item')
        curr_jotai = current_item.get('jotai', 'mikanryo') if current_item else 'mikanryo'
        
        # 2. 状態遷移バリデーション
        allowed = False
        if is_admin:
            allowed = True
            if not reason and (new_jotai == 'mikanryo' or (curr_jotai == 'kanryou' and new_jotai != 'kanryou')):
                return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'admin requires reason for backward transition'})}
        else:
            if curr_jotai == 'mikanryo' and new_jotai == 'shinkou':
                allowed = True
            elif curr_jotai == 'shinkou' and new_jotai == 'kanryou':
                allowed = True
                
        if not allowed:
            return {
                'statusCode': 403, 
                'headers': headers, 
                'body': json.dumps({'error': f'transition from {curr_jotai} to {new_jotai} not allowed for your role'})
            }
            
        # 3. Yotei情報取得
        y_res = YOTEI_SCHEDULES_TABLE.get_item(Key={'id': yotei_id})
        y_item = y_res.get('Item')
        if not y_item:
            return {'statusCode': 404, 'headers': headers, 'body': json.dumps({'error': 'base yotei not found'})}

        # 4. 更新
        now = datetime.utcnow().isoformat() + 'Z'
        if not current_item:
            current_item = {
                'yotei_id': yotei_id,
                'sagyouin_id': y_item.get('sagyouin_id'),
                'tenpo_id': y_item.get('tenpo_id'),
                'han_id': y_item.get('han_id'),
                'started_at': now if new_jotai == 'shinkou' else None
            }
        
        if curr_jotai == 'mikanryo' and new_jotai == 'shinkou':
            current_item['started_at'] = now
            
        current_item.update({
            'jotai': new_jotai,
            'updated_at': now,
            'last_updated_by': uid or 'system',
        })
        
        if is_admin:
            if override:
                current_item['override'] = override
            if reason:
                current_item['admin_reason'] = reason
            if reason_note:
                current_item['reason_note'] = reason_note
            if reason_code:
                current_item['reason_code'] = reason_code

        UGOKI_TABLE.put_item(Item=current_item)
        
        # 5. Step 4: houkoku連動 (完了時)
        report_id = None
        if new_jotai == 'kanryou' and curr_jotai != 'kanryou':
            try:
                report_id = _create_houkoku_draft(y_item)
                
                # yakusoku 消化カウント
                yak_id = y_item.get('yakusoku_id')
                if yak_id:
                    month_key = (y_item.get('scheduled_date') or '').split('-')[:2] # YYYY-MM
                    if len(month_key) == 2:
                        m_key = "-".join(month_key)
                        try:
                            # consumption_count が未定義なら空Mapで初期化してから加算
                            YAKUSOKU_TABLE.update_item(
                                Key={'yakusoku_id': yak_id},
                                UpdateExpression="SET consumption_count = if_not_exists(consumption_count, :empty), updated_at = :now",
                                ExpressionAttributeValues={':empty': {}, ':now': now}
                            )
                            YAKUSOKU_TABLE.update_item(
                                Key={'yakusoku_id': yak_id},
                                UpdateExpression="SET consumption_count.#m = if_not_exists(consumption_count.#m, :zero) + :one, updated_at = :now",
                                ExpressionAttributeNames={'#m': m_key},
                                ExpressionAttributeValues={':zero': 0, ':one': 1, ':now': now}
                            )
                        except Exception as ye:
                            print(f"[ugoki] yakusoku count increment failed: {str(ye)}")
            except Exception as e:
                print(f"[ugoki] error creating report draft: {str(e)}")
                
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'status': 'success', 'jotai': new_jotai, 'yotei_id': yotei_id, 'report_id': report_id}, ensure_ascii=False)
        }
    except Exception as e:
        print(f"[ugoki] patch failed: {str(e)}")
        traceback.print_exc()
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'Failed to update ugoki', 'message': str(e)}, ensure_ascii=False)
        }

def _create_houkoku_draft(y_item):
    """
    完了時に報告書下書きを自動作成 (staff-reports)
    冪等性を確保：同一 yotei_id の下書きが既に存在する場合は何もしない
    """
    target_table = dynamodb.Table('staff-reports')
    yotei_id = y_item.get('id')
    
    # 既存の報告書をチェック (yotei_id でフィルター)
    existing = target_table.scan(
        FilterExpression=Attr('yotei_id').eq(yotei_id),
        Limit=1,
        ProjectionExpression='report_id'
    ).get('Items', [])
    
    if existing:
        return existing[0].get('report_id')
        
    now_ts = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')
    report_id = f"REP-AUTO-{yotei_id}"
    
    item = {
        'report_id': report_id,
        'created_at': now_ts,
        'yotei_id': yotei_id,
        'status': 'draft',
        'staff_id': y_item.get('sagyouin_id'),
        'worker_id': y_item.get('sagyouin_id'),
        'store_id': y_item.get('tenpo_id'),
        'store_name': y_item.get('tenpo_name') or y_item.get('store_name') or y_item.get('target_name'),
        'cleaning_date': y_item.get('scheduled_date'),
        'yakusoku_id': y_item.get('yakusoku_id'),
        'updated_at': now_ts,
        'origin': 'ugoki_auto'
    }
    item = {k: v for k, v in item.items() if v is not None}
    
    try:
        target_table.put_item(
            Item=item,
            ConditionExpression='attribute_not_exists(report_id)'
        )
        return report_id
    except dynamodb.meta.client.exceptions.ConditionalCheckFailedException:
        return report_id # Concurrent request already created it
    except Exception as e:
        print(f"[ugoki] error creating report draft: {str(e)}")
        return None

# --- YAKUSOKU handlers ---

def yakusoku_get_list(event, headers):
    try:
        user_info = _get_user_info_from_event(event)
        if not user_info:
            return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Unauthorized'}, ensure_ascii=False)}
        role = user_info.get('role')
        if not _is_master_role(role):
            return {
                'statusCode': 403, 
                'headers': headers, 
                'body': json.dumps({
                    'error': 'Forbidden', 
                    'reason': 'role_not_allowed', 
                    'role': role, 
                    'required': ['admin', 'headquarters']
                }, ensure_ascii=False)
            }

        qp = event.get('queryStringParameters') or {}
        client_id = qp.get('client_id')
        tenpo_id = qp.get('tenpo_id')
        
        filters = [Attr('status').ne('deleted')]
        if client_id: filters.append(Attr('client_id').eq(client_id))
        if tenpo_id: filters.append(Attr('tenpo_id').eq(tenpo_id))
        
        filter_expr = filters[0]
        for f in filters[1:]: filter_expr = filter_expr & f
            
        res = YAKUSOKU_TABLE.scan(FilterExpression=filter_expr)
        items = res.get('Items', [])
        return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'items': items}, default=str, ensure_ascii=False)}
    except Exception as e:
        return {'statusCode': 500, 'headers': headers, 'body': json.dumps({'error': str(e)})}

def yakusoku_get_detail(yakusoku_id, event, headers):
    try:
        user_info = _get_user_info_from_event(event)
        if not user_info:
            return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Unauthorized'}, ensure_ascii=False)}
        role = user_info.get('role')
        if not _is_master_role(role):
            return {
                'statusCode': 403, 
                'headers': headers, 
                'body': json.dumps({
                    'error': 'Forbidden', 
                    'reason': 'role_not_allowed', 
                    'role': role, 
                    'required': ['admin', 'headquarters']
                }, ensure_ascii=False)
            }

        res = YAKUSOKU_TABLE.get_item(Key={'yakusoku_id': yakusoku_id})
        item = res.get('Item')
        if not item or item.get('status') == 'deleted':
            return {'statusCode': 404, 'headers': headers, 'body': json.dumps({'error': 'not found'})}
        return {'statusCode': 200, 'headers': headers, 'body': json.dumps(item, default=str, ensure_ascii=False)}
    except Exception as e:
        return {'statusCode': 500, 'headers': headers, 'body': json.dumps({'error': str(e)})}

def yakusoku_create(event, headers):
    try:
        user_info = _get_user_info_from_event(event)
        if not user_info:
            return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Unauthorized'}, ensure_ascii=False)}
        role = user_info.get('role')
        if not _is_master_role(role):
            return {
                'statusCode': 403, 
                'headers': headers, 
                'body': json.dumps({
                    'error': 'Forbidden', 
                    'reason': 'role_not_allowed', 
                    'role': role, 
                    'required': ['admin', 'headquarters']
                }, ensure_ascii=False)
            }

        body = _yotei_parse_body(event)
        yid = body.get('yakusoku_id') or f"YAK-{uuid.uuid4().hex[:12]}"
        now = datetime.utcnow().isoformat() + 'Z'
        item = {
            'yakusoku_id': yid,
            'client_id': body.get('client_id'),
            'tenpo_id': body.get('tenpo_id'),
            'type': body.get('type', 'teiki'),
            'recurrence_rule': body.get('recurrence_rule', {}),
            'monthly_quota': body.get('monthly_quota'),
            'consumption_count': {},
            'price': body.get('price'),
            'start_date': body.get('start_date'),
            'end_date': body.get('end_date'),
            'status': body.get('status', 'active'),
            'memo': body.get('memo', ''),
            'created_at': now,
            'updated_at': now
        }
        YAKUSOKU_TABLE.put_item(Item=item)
        return {'statusCode': 201, 'headers': headers, 'body': json.dumps(item, default=str, ensure_ascii=False)}
    except Exception as e:
        return {'statusCode': 500, 'headers': headers, 'body': json.dumps({'error': str(e)})}

def yakusoku_update(yakusoku_id, event, headers):
    try:
        user_info = _get_user_info_from_event(event)
        if not user_info:
            return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Unauthorized'}, ensure_ascii=False)}
        role = user_info.get('role')
        if not _is_master_role(role):
            return {
                'statusCode': 403, 
                'headers': headers, 
                'body': json.dumps({
                    'error': 'Forbidden', 
                    'reason': 'role_not_allowed', 
                    'role': role, 
                    'required': ['admin', 'headquarters']
                }, ensure_ascii=False)
            }

        body = _yotei_parse_body(event)
        now = datetime.utcnow().isoformat() + 'Z'
        res = YAKUSOKU_TABLE.get_item(Key={'yakusoku_id': yakusoku_id})
        item = res.get('Item')
        if not item: return {'statusCode': 404, 'headers': headers, 'body': json.dumps({'error': 'not found'})}
        
        for f in ['client_id', 'tenpo_id', 'type', 'recurrence_rule', 'monthly_quota', 'price', 'start_date', 'end_date', 'status', 'memo']:
            if f in body: item[f] = body[f]
        item['updated_at'] = now
        YAKUSOKU_TABLE.put_item(Item=item)
        return {'statusCode': 200, 'headers': headers, 'body': json.dumps(item, default=str, ensure_ascii=False)}
    except Exception as e:
        return {'statusCode': 500, 'headers': headers, 'body': json.dumps({'error': str(e)})}

def yakusoku_delete(yakusoku_id, event, headers):
    try:
        user_info = _get_user_info_from_event(event)
        if not user_info:
            return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Unauthorized'}, ensure_ascii=False)}
        role = user_info.get('role')
        if not _is_master_role(role):
            return {
                'statusCode': 403, 
                'headers': headers, 
                'body': json.dumps({
                    'error': 'Forbidden', 
                    'reason': 'role_not_allowed', 
                    'role': role, 
                    'required': ['admin', 'headquarters']
                }, ensure_ascii=False)
            }

        now = datetime.utcnow().isoformat() + 'Z'
        YAKUSOKU_TABLE.update_item(
            Key={'yakusoku_id': yakusoku_id},
            UpdateExpression='SET #s = :s, updated_at = :u',
            ExpressionAttributeNames={'#s': 'status'},
            ExpressionAttributeValues={':s': 'deleted', ':u': now}
        )
        return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'status': 'success'})}
    except Exception as e:
        return {'statusCode': 500, 'headers': headers, 'body': json.dumps({'error': str(e)})}

# --- Mobile Worker Handlers ---

def worker_me_yotei(event, headers):
    try:
        user_info = _get_user_info_from_event(event)
        if not user_info:
            return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Unauthorized'})}
        
        worker_id = user_info.get('uid')
        
        # 営業日（Shift基準）の算出
        # 16:00 - 04:00 を一つの日付とする
        # 0:00 - 4:00 の間は、前日の日付を biz_date とする
        now = datetime.now(timezone(timedelta(hours=9)))
        if now.hour < 4:
            biz_date = (now - timedelta(days=1)).strftime('%Y-%m-%d')
        else:
            biz_date = now.strftime('%Y-%m-%d')
            
        # yotei を取得
        res = YOTEI_SCHEDULES_TABLE.scan(
            FilterExpression=(
                (Attr('sagyouin_id').eq(worker_id) | Attr('worker_id').eq(worker_id)) &
                Attr('scheduled_date').eq(biz_date) &
                Attr('jotai').ne('torikeshi')
            )
        )
        items = [_yotei_normalize_item_status(i) for i in res.get('Items', [])]
        
        # ugoki 情報を JOIN
        yotei_ids = [i['id'] for i in items]
        ugoki_map = {}
        if yotei_ids:
            for k in range(0, len(yotei_ids), 100):
                batch_keys = [{'yotei_id': yid} for yid in yotei_ids[k:k+100]]
                batch_res = dynamodb.batch_get_item(RequestItems={'ugoki': {'Keys': batch_keys}})
                for uitem in batch_res.get('Responses', {}).get('ugoki', []):
                    ugoki_map[uitem['yotei_id']] = uitem
        
        for i in items:
            u = ugoki_map.get(i['id'])
            i['ugoki'] = {
                'jotai': u.get('jotai') if u else 'mikanryo',
                'updated_at': u.get('updated_at') if u else ''
            }

        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'biz_date': biz_date, 'items': items}, default=str, ensure_ascii=False)
        }
    except Exception as e:
        print(f"[worker_me] failed: {str(e)}")
        return {'statusCode': 500, 'headers': headers, 'body': json.dumps({'error': str(e)})}



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
        
        # 必須項目の取得
        scheduled_date = body_json.get('scheduled_date') or body_json.get('date', '')
        store_id = body_json.get('store_id')
        worker_id = body_json.get('worker_id')
        if not scheduled_date or not store_id or not worker_id:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'store_id, scheduled_date, worker_id are required'}, ensure_ascii=False)
            }

        # service/status を強制
        service_value = 'cleaning'
        status_value = 'scheduled'

        # 稼働可否チェック（レコードなしは closed 扱い）
        availability = WORKER_AVAILABILITY_TABLE.get_item(
            Key={'worker_id': worker_id, 'date': scheduled_date}
        ).get('Item')
        if not availability or availability.get('status') != 'open':
            return {
                'statusCode': 409,
                'headers': headers,
                'body': json.dumps({'error': 'worker_unavailable'}, ensure_ascii=False)
            }

        # 重複チェック
        try:
            dup_response = SCHEDULES_TABLE.scan(
                FilterExpression=(
                    Attr('store_id').eq(store_id)
                    & Attr('scheduled_date').eq(scheduled_date)
                    & Attr('worker_id').eq(worker_id)
                    & Attr('service').eq(service_value)
                    & Attr('status').eq('scheduled')
                )
            )
            if dup_response.get('Items'):
                return {
                    'statusCode': 409,
                    'headers': headers,
                    'body': json.dumps({'error': 'duplicate_schedule'}, ensure_ascii=False)
                }
        except Exception as e:
            print(f"Error checking schedule duplication: {str(e)}")

        # スケジュールIDを生成（新形式: SCH-YYYYMMDD-NNN）
        schedule_id = generate_schedule_id(scheduled_date, SCHEDULES_TABLE)
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
                scheduled_time = body_json.get('scheduled_time') or body_json.get('time_slot', '')
                
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
                    'status': status_value,
                    'service': service_value
                }
                
                # 営業担当者ID（sales_id）を追加
                sales_id = body_json.get('sales_id')
                if sales_id:
                    schedule_item['sales_id'] = sales_id
                
                # 清掃員ID（worker_id）を追加
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
            'id': schedule_id
        }
        
        # 見積もりも作成した場合は、見積もりIDも返す
        if estimate_id:
            response_body['estimate_id'] = estimate_id
        
        # Google Calendar連携は廃止（今後は返さない）
        
        return {
            'statusCode': 201,
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
    クエリパラメータ:
    - status: ステータスでフィルタ
    - date: 単一の日付でフィルタ (YYYY-MM-DD)
    - date_from: 開始日でフィルタ (YYYY-MM-DD)
    - date_to: 終了日でフィルタ (YYYY-MM-DD)
    - assigned_to: 担当者IDでフィルタ
    - worker_id: 清掃員IDでフィルタ
    - limit: 最大取得件数（デフォルト: 1000）
    """
    try:
        # クエリパラメータからフィルタ条件を取得
        query_params = event.get('queryStringParameters') or {}
        status = query_params.get('status')
        date = query_params.get('date')
        date_from = query_params.get('date_from')
        date_to = query_params.get('date_to')
        assigned_to = query_params.get('assigned_to')
        worker_id = query_params.get('worker_id')
        limit = int(query_params.get('limit', 1000))
        
        # フィルタ式を構築
        filter_expressions = []
        
        if status:
            filter_expressions.append(Attr('status').eq(status))
        
        if date:
            # 単一の日付でフィルタ（date または scheduled_date の両方をチェック）
            filter_expressions.append(
                (Attr('date').eq(date) | Attr('scheduled_date').eq(date))
            )
        elif date_from or date_to:
            # 日付範囲でフィルタ
            if date_from and date_to:
                filter_expressions.append(
                    (Attr('date').between(date_from, date_to) | Attr('scheduled_date').between(date_from, date_to))
                )
            elif date_from:
                filter_expressions.append(
                    (Attr('date').gte(date_from) | Attr('scheduled_date').gte(date_from))
                )
            elif date_to:
                filter_expressions.append(
                    (Attr('date').lte(date_to) | Attr('scheduled_date').lte(date_to))
                )
        
        if assigned_to:
            filter_expressions.append(Attr('assigned_to').eq(assigned_to))
        
        if worker_id:
            # worker_idパラメータがある場合、worker_idまたはassigned_toのいずれかに一致するものを取得
            filter_expressions.append(
                (Attr('worker_id').eq(worker_id) | Attr('assigned_to').eq(worker_id))
            )
        
        # フィルタ式を結合
        if filter_expressions:
            filter_expr = filter_expressions[0]
            for expr in filter_expressions[1:]:
                filter_expr = filter_expr & expr
            response = SCHEDULES_TABLE.scan(
                FilterExpression=filter_expr,
                Limit=limit
            )
        else:
            # 全件取得（制限付き）
            response = SCHEDULES_TABLE.scan(Limit=limit)
        
        schedules = response.get('Items', [])
        
        # ページネーション対応（LastEvaluatedKeyがある場合は警告を出す）
        has_more = 'LastEvaluatedKey' in response
        if has_more:
            print(f"Warning: More than {limit} schedules found. Consider using pagination.")
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'items': schedules,
                'count': len(schedules),
                'has_more': has_more
            }, ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"Error getting schedules: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
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

def decline_schedule(schedule_id, event, headers):
    """
    スケジュールを辞退
    """
    try:
        auth_header = _get_auth_header(event)
        id_token = auth_header.replace('Bearer ', '') if auth_header else ''
        user_info = verify_cognito_id_token(id_token)
        if not user_info.get('verified'):
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': 'Unauthorized'}, ensure_ascii=False)
            }

        if event.get('isBase64Encoded'):
            body = base64.b64decode(event['body'])
        else:
            body = event.get('body', '')
        if isinstance(body, str):
            body_json = json.loads(body)
        else:
            body_json = json.loads(body.decode('utf-8'))

        reason_code = body_json.get('reason_code')
        if not reason_code:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'reason_code is required'}, ensure_ascii=False)
            }

        if not schedule_id:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({'error': 'schedule not found'}, ensure_ascii=False)
            }

        response = SCHEDULES_TABLE.get_item(Key={'id': schedule_id})
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({'error': 'schedule not found'}, ensure_ascii=False)
            }

        schedule_item = response['Item']
        worker_id = schedule_item.get('worker_id') or schedule_item.get('assigned_to')
        if worker_id != user_info.get('uid'):
            return {
                'statusCode': 403,
                'headers': headers,
                'body': json.dumps({'error': 'forbidden'}, ensure_ascii=False)
            }

        if schedule_item.get('status') != 'scheduled':
            return {
                'statusCode': 409,
                'headers': headers,
                'body': json.dumps({'error': 'invalid_status'}, ensure_ascii=False)
            }

        now = datetime.utcnow().isoformat() + 'Z'
        SCHEDULES_TABLE.update_item(
            Key={'id': schedule_id},
            UpdateExpression='SET #status = :status, declined_at = :declined_at, decline_reason_code = :reason_code, updated_at = :updated_at',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={
                ':status': 'declined',
                ':declined_at': now,
                ':reason_code': reason_code,
                ':updated_at': now
            }
        )

        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'status': 'success'}, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error declining schedule: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'Failed to decline schedule', 'message': str(e)}, ensure_ascii=False)
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

def get_blocks(event, headers):
    """
    ブロック（クローズ）一覧を取得
    クエリパラメータ:
    - user_id: ユーザーIDでフィルタ
    - date_from: 開始日でフィルタ (YYYY-MM-DD)
    - date_to: 終了日でフィルタ (YYYY-MM-DD)
    - limit: 最大取得件数（デフォルト: 1000）
    """
    try:
        query_params = event.get('queryStringParameters') or {}
        user_id = query_params.get('user_id')
        date_from = query_params.get('date_from')
        date_to = query_params.get('date_to')
        limit = int(query_params.get('limit', 1000))
        
        # フィルタ式を構築
        filter_expressions = []
        
        if user_id:
            filter_expressions.append(Attr('user_id').eq(user_id))
        
        if date_from or date_to:
            # 日付範囲でフィルタ（start_atまたはend_atが範囲内にあるもの）
            if date_from:
                filter_expressions.append(Attr('start_at').gte(date_from))
            if date_to:
                filter_expressions.append(Attr('end_at').lte(date_to + 'T23:59:59'))
        
        # スキャン実行
        if filter_expressions:
            filter_expr = filter_expressions[0]
            for expr in filter_expressions[1:]:
                filter_expr = filter_expr & expr
            response = BLOCKS_TABLE.scan(FilterExpression=filter_expr, Limit=limit)
        else:
            response = BLOCKS_TABLE.scan(Limit=limit)
        
        items = response.get('Items', [])
        
        # ページネーション対応
        while 'LastEvaluatedKey' in response and len(items) < limit:
            if filter_expressions:
                response = BLOCKS_TABLE.scan(
                    FilterExpression=filter_expr,
                    ExclusiveStartKey=response['LastEvaluatedKey'],
                    Limit=limit - len(items)
                )
            else:
                response = BLOCKS_TABLE.scan(
                    ExclusiveStartKey=response['LastEvaluatedKey'],
                    Limit=limit - len(items)
                )
            items.extend(response.get('Items', []))
        
        # Decimal型を変換
        for item in items:
            for key, value in item.items():
                if isinstance(value, Decimal):
                    item[key] = float(value) if value % 1 else int(value)
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'items': items,
                'count': len(items),
                'has_more': 'LastEvaluatedKey' in response
            }, ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"Error getting blocks: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'ブロックの取得に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def create_block(event, headers):
    """
    ブロック（クローズ）を作成
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
        
        # 必須フィールドのチェック
        if not body_json.get('start_at') or not body_json.get('end_at'):
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': 'start_atとend_atは必須です'
                }, ensure_ascii=False)
            }
        
        # ブロックIDを生成
        block_id = f"BLK-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}"
        
        now = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
        
        # ブロックアイテムを作成
        block_item = {
            'id': block_id,
            'user_id': body_json.get('user_id'),
            'start_at': body_json['start_at'],
            'end_at': body_json['end_at'],
            'type': body_json.get('type', 'personal_close'),
            'reason_code': body_json.get('reason_code', 'other'),
            'reason_note': body_json.get('reason_note'),
            'visibility': body_json.get('visibility', 'admin_only'),
            'rrule': body_json.get('rrule'),
            'created_at': now,
            'updated_at': now
        }
        
        # DynamoDBに保存
        BLOCKS_TABLE.put_item(Item=block_item)
        
        return {
            'statusCode': 201,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'block': block_item,
                'message': 'ブロックを作成しました'
            }, ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"Error creating block: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'ブロックの作成に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def get_block_detail(block_id, headers):
    """
    ブロック詳細を取得
    """
    try:
        response = BLOCKS_TABLE.get_item(Key={'id': block_id})
        
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({
                    'error': 'ブロックが見つかりません'
                }, ensure_ascii=False)
            }
        
        item = response['Item']
        # Decimal型を変換
        for key, value in item.items():
            if isinstance(value, Decimal):
                item[key] = float(value) if value % 1 else int(value)
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'block': item
            }, ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"Error getting block detail: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'ブロックの取得に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def update_block(block_id, event, headers):
    """
    ブロックを更新
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
        
        # 更新可能なフィールド
        update_fields = ['start_at', 'end_at', 'reason_code', 'reason_note', 'rrule']
        
        update_expression_parts = []
        expression_attribute_values = {}
        expression_attribute_names = {}
        
        for field in update_fields:
            if field in body_json:
                update_expression_parts.append(f"#{field} = :{field}")
                expression_attribute_names[f"#{field}"] = field
                expression_attribute_values[f":{field}"] = body_json[field]
        
        if not update_expression_parts:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': '更新するフィールドが指定されていません'
                }, ensure_ascii=False)
            }
        
        update_expression_parts.append("#updated_at = :updated_at")
        expression_attribute_names["#updated_at"] = "updated_at"
        expression_attribute_values[":updated_at"] = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
        
        update_expression = "SET " + ", ".join(update_expression_parts)
        
        # DynamoDBを更新
        BLOCKS_TABLE.update_item(
            Key={'id': block_id},
            UpdateExpression=update_expression,
            ExpressionAttributeNames=expression_attribute_names,
            ExpressionAttributeValues=expression_attribute_values,
            ReturnValues='ALL_NEW'
        )
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'message': 'ブロックを更新しました'
            }, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error updating block: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'ブロックの更新に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def delete_block(block_id, headers):
    """
    ブロックを削除
    """
    try:
        BLOCKS_TABLE.delete_item(Key={'id': block_id})
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'message': 'ブロックを削除しました'
            }, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error deleting block: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'ブロックの削除に失敗しました',
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

def import_google_ics(event, headers):
    """
    GoogleカレンダーICS取り込み（管理者のみ）
    POST /admin/import/google-ics
    body: {
        "ics_url": "<iCal URL>",
        "from": "YYYY-MM-DD",
        "to": "YYYY-MM-DD",
        "dry_run": false
    }
    """
    try:
        # 認証: 管理者のみ
        auth_header = _get_auth_header(event)
        if not auth_header or not auth_header.startswith('Bearer '):
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': 'Unauthorized', 'message': 'Authorization: Bearer <id_token> が必要です'}, ensure_ascii=False)
            }
        id_token = auth_header.replace('Bearer ', '').strip()
        user_info = verify_cognito_id_token(id_token)
        if not user_info or not user_info.get('verified'):
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': 'Unauthorized', 'message': 'トークンが無効または期限切れです'}, ensure_ascii=False)
            }
        
        # 管理者権限チェック
        role = user_info.get('role', '')
        groups = user_info.get('groups', [])
        is_admin = role == 'admin' or 'admin' in [g.lower() for g in groups]
        if not is_admin:
            return {
                'statusCode': 403,
                'headers': headers,
                'body': json.dumps({'error': 'Forbidden', 'message': '管理者権限が必要です'}, ensure_ascii=False)
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
        
        ics_url = body_json.get('ics_url', '').strip()
        ics_content_direct = body_json.get('ics_content', '').strip()
        from_date = body_json.get('from', '').strip()
        to_date = body_json.get('to', '').strip()
        dry_run = body_json.get('dry_run', False)
        
        ics_content = ""
        if ics_content_direct:
            ics_content = ics_content_direct
        elif ics_url:
            # ICSファイルを取得
            try:
                req = urllib.request.Request(ics_url)
                req.add_header('User-Agent', 'MISOGI-ICS-Importer/1.0')
                with urllib.request.urlopen(req, timeout=30) as response:
                    ics_content = response.read().decode('utf-8')
            except Exception as e:
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({
                        'error': 'ICS取得失敗',
                        'message': f'ICS URLの取得に失敗しました: {str(e)}'
                    }, ensure_ascii=False)
                }
        else:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'ics_url or ics_content is required'}, ensure_ascii=False)
            }
        
        # ICSをパース
        events = parse_ics_content(ics_content, from_date, to_date)
        
        if dry_run:
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({
                    'success': True,
                    'dry_run': True,
                    'found': len(events),
                    'range': {'from': from_date, 'to': to_date},
                    'events': events[:10]  # 最初の10件をプレビュー
                }, ensure_ascii=False, default=str)
            }
        
        # 従業員情報を取得（メールアドレスからworker_idを引くため）
        worker_email_map = {}
        # イレギュラーな個人用メールアドレスとワーカーIDのマッピング
        personal_email_to_worker_id = {
            'lemueldesousa@gmail.com': 'W01005',
            'kokiendou7@gmail.com': 'W021',
            'yuin3034@gmail.com': 'W003',
            'zuomuhezhen187@gmail.com': 'W006',
            'matsuokajonas@gmail.com': 'W01000',
            'bibisayuri2011@hotmail.com': 'W01003',
            'umeokagroup@gmail.com': 'W002'
        }

        try:
            worker_scan = WORKERS_TABLE.scan(ProjectionExpression='id, email')
            worker_items = worker_scan.get('Items', [])
            while 'LastEvaluatedKey' in worker_scan:
                worker_scan = WORKERS_TABLE.scan(
                    ProjectionExpression='id, email',
                    ExclusiveStartKey=worker_scan['LastEvaluatedKey']
                )
                worker_items.extend(worker_scan.get('Items', []))
            
            for w in worker_items:
                email = w.get('email')
                if email:
                    worker_email_map[email.lower().strip()] = w.get('id')
        except Exception as e:
            print(f"Warning: Failed to fetch worker emails: {str(e)}")

        # 店舗情報を取得（名寄せ・自動紐付けのため）
        all_stores = []
        try:
            store_scan = STORES_TABLE.scan(ProjectionExpression='id, store_name, brand_name, security_code')
            all_stores = store_scan.get('Items', [])
            while 'LastEvaluatedKey' in store_scan:
                store_scan = STORES_TABLE.scan(
                    ProjectionExpression='id, store_name, brand_name, security_code',
                    ExclusiveStartKey=store_scan['LastEvaluatedKey']
                )
                all_stores.extend(store_scan.get('Items', []))
        except Exception as e:
            print(f"Warning: Failed to fetch stores for matching: {str(e)}")

        # 既存のexternal_idとworker_idをチェック（重複防止）
        existing_schedules = set() # (external_id, worker_id) のタプル
        try:
            scan_kwargs = {
                'ProjectionExpression': 'external_id, worker_id',
                'FilterExpression': Attr('external_id').exists()
            }
            while True:
                scan_response = SCHEDULES_TABLE.scan(**scan_kwargs)
                for item in scan_response.get('Items', []):
                    ext_id = item.get('external_id')
                    w_id = item.get('worker_id')
                    existing_schedules.add((ext_id, w_id))
                
                if 'LastEvaluatedKey' not in scan_response:
                    break
                scan_kwargs['ExclusiveStartKey'] = scan_response['LastEvaluatedKey']
        except Exception as e:
            print(f"Warning: Failed to check existing schedules: {str(e)}")
        
        # 日付ごとにグループ化して、各日付の最大連番を事前に取得（パフォーマンス最適化）
        date_to_max_seq = {}
        unique_dates = set()
        for event_data in events:
            date_str = event_data.get('date')
            if date_str:
                unique_dates.add(date_str)
        
        # 各日付の最大連番を一度だけ取得
        for date_str in unique_dates:
            try:
                date_obj = datetime.strptime(date_str, '%Y-%m-%d')
                date_prefix = date_obj.strftime('%Y%m%d')
                max_seq = get_max_sequence_for_date(SCHEDULES_TABLE, date_prefix)
                date_to_max_seq[date_str] = max_seq
            except Exception as e:
                print(f"Warning: Failed to get max sequence for {date_str}: {str(e)}")
                date_to_max_seq[date_str] = 0
        
        # 日付ごとの連番カウンター
        date_seq_counters = {date: date_to_max_seq[date] for date in unique_dates}
        
        # スケジュールを作成
        inserted = 0
        skipped = 0
        errors = []
        
        for event_data in events:
            external_id = event_data.get('uid')
            if not external_id:
                errors.append({'event': event_data.get('summary', 'Unknown'), 'error': 'UID not found'})
                continue
            
            try:
                # 参加者のメールアドレスからマッチする従業員を探す
                attendees = event_data.get('attendees', [])
                matched_worker_ids = []
                attendee_emails = []
                if attendees:
                    for a in attendees:
                        email = a.get('email')
                        if email:
                            email_clean = email.lower().strip()
                            attendee_emails.append(email_clean)
                            
                            # まず個人用メール対応表をチェック
                            w_id = personal_email_to_worker_id.get(email_clean)
                            if not w_id:
                                # 次にシステム用メールをチェック
                                w_id = worker_email_map.get(email_clean)
                                
                            if w_id and w_id not in matched_worker_ids:
                                matched_worker_ids.append(w_id)
                
                # 作成ターゲット（worker_idのリスト）。マッチしなければNone（未割当）で1件作成
                targets = matched_worker_ids if matched_worker_ids else [None]
                
                date_str = event_data.get('date')
                if not date_str:
                    errors.append({'event': event_data.get('summary', 'Unknown'), 'error': 'Date not found'})
                    continue
                
                date_obj = datetime.strptime(date_str, '%Y-%m-%d')
                date_prefix = date_obj.strftime('%Y%m%d')

                # 重複チェック（UIDと清掃員の組み合わせ）
                for worker_id in targets:
                    if (external_id, worker_id) in existing_schedules:
                        skipped += 1
                        continue
                        
                    # --- AI情報抽出ロジック ---
                    summary = event_data.get('summary', '').strip()
                    if not summary:
                        summary = "(本文から推測)" if event_data.get('description') else "名称未設定"
                    
                    description = event_data.get('description', '').strip()
                    
                    work_type = 'cleaning' # デフォルト
                    target_name = summary
                    
                    # 1. プラン/種別の抽出 【定期清掃】など
                    plan_match = re.search(r'【([^】]+)】', summary)
                    if plan_match:
                        work_type_extracted = plan_match.group(1)
                        # 長すぎる場合は現場名のママにするが、短いものは種別へ
                        if len(work_type_extracted) < 15:
                            work_type = work_type_extracted
                        # 現場名からはブラケット部分を除く
                        target_name = summary.replace(f'【{work_type_extracted}】', '').strip()
                    
                    # 2. 店舗の自動同定（名寄せ）
                    matched_store = None
                    # ヒントになる文字列を準備
                    match_target_text = (summary + " " + target_name).lower()
                    
                    # スコアリングで最も近い店舗を探す（簡易実装）
                    best_match_score = 0
                    for s in all_stores:
                        s_name = str(s.get('store_name') or '').lower()
                        b_name = str(s.get('brand_name') or '').lower()
                        
                        score = 0
                        if s_name and s_name in match_target_text:
                            score += 10
                        if b_name and b_name in match_target_text:
                            score += 5
                        
                        # 完全に一致する場合
                        if s_name and s_name == target_name.lower():
                            score += 50
                            
                        if score > best_match_score and score >= 10:
                            best_match_score = score
                            matched_store = s
                    
                    # 3. セキュリティーコード（キーボックス番号）の抽出
                    security_code = matched_store.get('security_code') if matched_store else ''
                    # 本文から数字を探す (例: 番号：0207, ロックナンバー 1234, キーボックス: 5566 等)
                    key_match = re.search(r'(番号|コード|暗証番号|キーボックス|ロックナンバー|解錠|キー)[:：\s]*(\d{3,6})', description)
                    if key_match:
                        security_code = key_match.group(2)
                    
                    # 4. 清掃項目の抽出（・や*で始まる行を探す）
                    cleaning_items = []
                    lines = description.split('\n')
                    for line in lines:
                        line = line.strip()
                        if line.startswith(('・', '*', '-', '●')):
                            item_name = re.sub(r'^[・\*\-\●]\s*', '', line).strip()
                            if item_name:
                                cleaning_items.append({'name': item_name, 'status': 'pending'})
                    
                    # --- ID生成 ---
                    if date_str not in date_seq_counters:
                        date_seq_counters[date_str] = 0
                    date_seq_counters[date_str] += 1
                    seq_str = str(date_seq_counters[date_str]).zfill(3)
                    schedule_id = f"SCH-{date_prefix}-{seq_str}"
                    
                    now = datetime.utcnow().isoformat() + 'Z'
                    
                    schedule_item = {
                        'id': schedule_id,
                        'scheduled_date': event_data['date'],
                        'date': event_data['date'],
                        'start_time': event_data.get('start_time', '09:00'),
                        'end_time': event_data.get('end_time', '10:00'),
                        'start_min': event_data.get('start_min', 540),
                        'end_min': event_data.get('end_min', 600),
                        'service': 'cleaning',
                        'status': 'scheduled',
                        'work_type': work_type,
                        'origin': 'google_ics',
                        'external_id': external_id,
                        'target_name': target_name,
                        'location': event_data.get('location', ''),
                        'description': description, # 生のデータを残す
                        'notes': description, # 備考欄を指示書代わりに使う
                        'security_code': security_code,
                        'cleaning_items': cleaning_items,
                        'raw': json.dumps({
                            'summary': summary,
                            'location': event_data.get('location'),
                            'description': description[:1000],
                            'attendees': attendees
                        }, ensure_ascii=False),
                        'created_at': now,
                        'updated_at': now
                    }
                    
                    if matched_store:
                        schedule_item['store_id'] = matched_store.get('id')
                    
                    if attendee_emails:
                        schedule_item['attendee_emails'] = attendee_emails
                    
                    if worker_id:
                        schedule_item['worker_id'] = worker_id
                        schedule_item['assigned_to'] = worker_id
                    
                    SCHEDULES_TABLE.put_item(Item=schedule_item)
                    existing_schedules.add((external_id, worker_id))
                    inserted += 1

            except Exception as e:
                errors.append({
                    'event': event_data.get('summary', 'Unknown'),
                    'error': str(e)
                })
                print(f"Error creating schedule for {external_id}: {str(e)}")
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'success': True,
                'inserted': inserted,
                'skipped': skipped,
                'errors': errors[:10],
                'range': {'from': from_date, 'to': to_date}
            }, ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"Error importing Google ICS: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'success': False,
                'error': 'ICS取り込みに失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

def parse_ics_content(ics_content, from_date=None, to_date=None):
    """
    ICSコンテンツをパースしてイベントリストを返す（最小実装）
    返却形式: [
        {
            'uid': '...',
            'date': 'YYYY-MM-DD',
            'start_time': 'HH:MM',
            'end_time': 'HH:MM',
            'start_min': int,
            'end_min': int,
            'summary': '...',
            'location': '...',
            'description': '...'
        },
        ...
    ]
    """
    events = []
    current_event = {}
    in_vevent = False
    
    # 日付範囲のパース
    from_dt = None
    to_dt = None
    if from_date:
        try:
            from_dt = datetime.strptime(from_date, '%Y-%m-%d')
        except:
            pass
    if to_date:
        try:
            to_dt = datetime.strptime(to_date, '%Y-%m-%d')
        except:
            pass
    
    lines = ics_content.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        # VEVENT開始
        if line == 'BEGIN:VEVENT':
            in_vevent = True
            current_event = {}
            i += 1
            continue
        
        # VEVENT終了
        if line == 'END:VEVENT':
            if in_vevent and current_event.get('uid'):
                # 日付範囲チェック
                event_date = current_event.get('date')
                if event_date:
                    try:
                        event_dt = datetime.strptime(event_date, '%Y-%m-%d')
                        if from_dt and event_dt < from_dt:
                            i += 1
                            continue
                        if to_dt and event_dt > to_dt:
                            i += 1
                            continue
                    except:
                        pass
                events.append(current_event)
            in_vevent = False
            current_event = {}
            i += 1
            continue
        
        # プロパティのパース（継続行対応）
        if in_vevent and ':' in line:
            # 継続行の結合
            full_line = line
            j = i + 1
            while j < len(lines) and lines[j].startswith(' '):
                full_line += lines[j].lstrip()
                j += 1
            
            parts = full_line.split(':', 1)
            if len(parts) == 2:
                key_part = parts[0].split(';')[0]  # パラメータを除去
                value = parts[1]
                
                # DTSTART/DTEND
                if key_part == 'DTSTART':
                    dt_start = parse_ics_datetime(value)
                    if dt_start:
                        current_event['date'] = dt_start.strftime('%Y-%m-%d')
                        current_event['start_time'] = dt_start.strftime('%H:%M')
                        current_event['start_min'] = dt_start.hour * 60 + dt_start.minute
                
                if key_part == 'DTEND':
                    dt_end = parse_ics_datetime(value)
                    if dt_end:
                        current_event['end_time'] = dt_end.strftime('%H:%M')
                        current_event['end_min'] = dt_end.hour * 60 + dt_end.minute
                
                # UID
                if key_part == 'UID':
                    current_event['uid'] = value.strip()
                
                # SUMMARY
                if key_part == 'SUMMARY':
                    current_event['summary'] = unescape_ics_text(value.strip())
                
                # LOCATION
                if key_part == 'LOCATION':
                    current_event['location'] = unescape_ics_text(value.strip())
                
                # DESCRIPTION
                if key_part == 'DESCRIPTION':
                    current_event['description'] = unescape_ics_text(value.strip())
                
                # ORGANIZER（主催者）
                if key_part == 'ORGANIZER':
                    # mailto:email@example.com の形式からメールアドレスを抽出
                    if 'mailto:' in value:
                        email = value.split('mailto:')[1].strip()
                        if 'attendees' not in current_event:
                            current_event['attendees'] = []
                        current_event['attendees'].append({
                            'email': email,
                            'role': 'organizer',
                            'status': 'accepted'
                        })
                
                # ATTENDEE（参加者）
                if key_part == 'ATTENDEE':
                    # パラメータから情報を抽出
                    params = parts[0].split(';')
                    email = None
                    status = 'needs-action'
                    role = 'req-participant'
                    
                    # mailto:email@example.com の形式からメールアドレスを抽出
                    if 'mailto:' in value:
                        email = value.split('mailto:')[1].strip()
                    
                    # PARTSTATパラメータから参加ステータスを取得
                    for param in params:
                        if param.startswith('PARTSTAT='):
                            status = param.split('=')[1].lower()
                        elif param.startswith('ROLE='):
                            role = param.split('=')[1].lower()
                    
                    if email:
                        if 'attendees' not in current_event:
                            current_event['attendees'] = []
                        current_event['attendees'].append({
                            'email': email,
                            'role': role,
                            'status': status
                        })
            
            i = j
        else:
            i += 1
    
    return events

def parse_ics_datetime(ics_dt_str):
    """
    ICS日時文字列をdatetimeに変換（Asia/Tokyo前提）
    対応形式:
    - 20250101T090000 (DATE-TIME, local)
    - 20250101T090000Z (UTC)
    - 20250101 (DATE only)
    """
    try:
        ics_dt_str = ics_dt_str.strip()
        
        # UTC判定
        is_utc = ics_dt_str.endswith('Z')
        if is_utc:
            ics_dt_str = ics_dt_str[:-1]
        
        # T区切りをチェック
        if 'T' in ics_dt_str:
            date_part, time_part = ics_dt_str.split('T', 1)
            if len(time_part) >= 6:
                hour = int(time_part[0:2])
                minute = int(time_part[2:4])
                second = int(time_part[4:6]) if len(time_part) >= 6 else 0
            else:
                hour = minute = second = 0
        else:
            date_part = ics_dt_str
            hour = minute = second = 0
        
        # 日付パース
        if len(date_part) >= 8:
            year = int(date_part[0:4])
            month = int(date_part[4:6])
            day = int(date_part[6:8])
        else:
            return None
        
        dt = datetime(year, month, day, hour, minute, second)
        
        # UTCの場合はAsia/Tokyoに変換
        if is_utc:
            dt = dt.replace(tzinfo=timezone.utc)
            # UTCからJSTへの変換（+9時間）
            dt = dt + timedelta(hours=9)
            dt = dt.replace(tzinfo=None)
        
        return dt
    except Exception as e:
        print(f"Error parsing ICS datetime '{ics_dt_str}': {str(e)}")
        return None

def unescape_ics_text(text):
    """
    ICSテキストのエスケープを解除
    \\ -> \
    \\n -> \n
    \\, -> ,
    """
    if not text:
        return ''
    text = text.replace('\\n', '\n')
    text = text.replace('\\,', ',')
    text = text.replace('\\\\', '\\')
    return text

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
        cognito_sub = query_params.get('cognito_sub')
        
        # スキャンまたはクエリを実行（強整合性読み取りを有効化、ページネーション対応）
        workers = []
        scan_kwargs = {'ConsistentRead': True}
        
        if cognito_sub:
            # Cognito Subでフィルタ（従業員ログイン用）
            scan_kwargs['FilterExpression'] = Attr('cognito_sub').eq(cognito_sub)
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

def get_worker_availability(event, headers):
    """
    作業者本人の稼働可否を取得
    """
    try:
        auth_header = _get_auth_header(event)
        id_token = auth_header.replace('Bearer ', '') if auth_header else ''
        user_info = verify_cognito_id_token(id_token)
        if not user_info.get('verified'):
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': 'Unauthorized'}, ensure_ascii=False)
            }

        params = event.get('queryStringParameters') or {}
        date_from = params.get('from')
        date_to = params.get('to')
        if not date_from or not date_to:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'from and to are required'}, ensure_ascii=False)
            }

        worker_id = user_info.get('uid')
        response = WORKER_AVAILABILITY_TABLE.query(
            KeyConditionExpression=Key('worker_id').eq(worker_id) & Key('date').between(date_from, date_to)
        )
        items = response.get('Items', [])

        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'items': items}, ensure_ascii=False, default=str)
        }
    except Exception as e:
        print(f"Error getting worker availability: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'Failed to get availability', 'message': str(e)}, ensure_ascii=False)
        }

def update_worker_availability(event, headers):
    """
    作業者本人の稼働可否を更新
    """
    try:
        auth_header = _get_auth_header(event)
        id_token = auth_header.replace('Bearer ', '') if auth_header else ''
        user_info = verify_cognito_id_token(id_token)
        if not user_info.get('verified'):
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': 'Unauthorized'}, ensure_ascii=False)
            }

        if event.get('isBase64Encoded'):
            body = base64.b64decode(event['body'])
        else:
            body = event.get('body', '')
        if isinstance(body, str):
            body_json = json.loads(body)
        else:
            body_json = json.loads(body.decode('utf-8'))

        date_value = body_json.get('date')
        status_value = body_json.get('status')
        if not date_value or status_value not in ['open', 'closed']:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'date and status are required'}, ensure_ascii=False)
            }

        worker_id = user_info.get('uid')
        now = datetime.utcnow().isoformat() + 'Z'
        WORKER_AVAILABILITY_TABLE.put_item(Item={
            'worker_id': worker_id,
            'date': date_value,
            'status': status_value,
            'updated_at': now
        })

        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'status': 'success'}, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error updating worker availability: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'Failed to update availability', 'message': str(e)}, ensure_ascii=False)
        }

def get_sales_availability_matrix(event, headers):
    """
    営業向け 稼働可否マトリクス
    """
    try:
        auth_header = _get_auth_header(event)
        id_token = auth_header.replace('Bearer ', '') if auth_header else ''
        user_info = verify_cognito_id_token(id_token)
        if not user_info.get('verified'):
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': 'Unauthorized'}, ensure_ascii=False)
            }

        params = event.get('queryStringParameters') or {}
        date_from = params.get('from')
        date_to = params.get('to')
        worker_ids_raw = params.get('worker_ids')
        service_value = params.get('service') or 'cleaning'
        if not date_from or not date_to or not worker_ids_raw:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'from, to, worker_ids are required'}, ensure_ascii=False)
            }

        worker_ids = [w.strip() for w in worker_ids_raw.split(',') if w.strip()]
        if not worker_ids:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'worker_ids are required'}, ensure_ascii=False)
            }

        try:
            start_date = datetime.strptime(date_from, '%Y-%m-%d').date()
            end_date = datetime.strptime(date_to, '%Y-%m-%d').date()
        except ValueError:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'invalid date format'}, ensure_ascii=False)
            }

        if end_date < start_date:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'invalid date range'}, ensure_ascii=False)
            }

        date_list = []
        cursor = start_date
        while cursor <= end_date:
            date_list.append(cursor.strftime('%Y-%m-%d'))
            cursor += timedelta(days=1)

        workers_output = []
        for worker_id in worker_ids:
            availability_response = WORKER_AVAILABILITY_TABLE.query(
                KeyConditionExpression=Key('worker_id').eq(worker_id) & Key('date').between(date_from, date_to)
            )
            availability_items = availability_response.get('Items', [])
            availability_map = {item.get('date'): item.get('status') for item in availability_items if item.get('date')}

            schedule_response = SCHEDULES_TABLE.scan(
                FilterExpression=(
                    Attr('worker_id').eq(worker_id)
                    & Attr('service').eq(service_value)
                    & Attr('scheduled_date').between(date_from, date_to)
                    & Attr('status').eq('scheduled')
                )
            )
            schedule_items = schedule_response.get('Items', [])
            scheduled_dates = {item.get('scheduled_date') for item in schedule_items if item.get('scheduled_date')}

            day_status = {}
            for date_value in date_list:
                if date_value in scheduled_dates:
                    day_status[date_value] = 'scheduled'
                elif availability_map.get(date_value) == 'open':
                    day_status[date_value] = 'open'
                else:
                    day_status[date_value] = 'closed'

            workers_output.append({
                'worker_id': worker_id,
                'days': day_status
            })

        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'workers': workers_output}, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error getting sales availability matrix: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'Failed to get availability matrix', 'message': str(e)}, ensure_ascii=False)
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
        status = query_params.get('status')
        
        # スキャンまたはクエリを実行
        if email:
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

def send_registration_form(client_id, event, headers):
    """
    クライアントに登録申込書フォームのリンクをメールで送信
    """
    try:
        # リクエストボディを取得
        body_json = {}
        if event.get('body'):
            if event.get('isBase64Encoded'):
                body = base64.b64decode(event['body'])
            else:
                body = event.get('body', '')
            
            if isinstance(body, str):
                body_json = json.loads(body) if body else {}
            else:
                body_json = json.loads(body.decode('utf-8')) if body else {}
        
        # フォームタイプ（regular or spot）
        form_type = body_json.get('form_type', 'regular')
        
        # クライアント情報を取得
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
        
        client = response['Item']
        client_email = client.get('email')
        client_name = client.get('company_name') or client.get('name') or 'お客様'
        contact_name = client.get('contact_name') or client.get('name', '')
        phone = client.get('phone', '')
        
        if not client_email:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': 'クライアントのメールアドレスが設定されていません'
                }, ensure_ascii=False)
            }
        
        # 登録フォームのURLを生成（事前入力パラメータ付き）
        base_url = "https://misesapo.co.jp/registration"
        params = [
            f"customer_id={client_id}",
            f"type={form_type}",
            f"company_name={urllib.parse.quote(client_name)}",
            f"email={urllib.parse.quote(client_email)}",
        ]
        if contact_name:
            params.append(f"contact_name={urllib.parse.quote(contact_name)}")
        if phone:
            params.append(f"phone={urllib.parse.quote(phone)}")
        
        registration_url = f"{base_url}?{'&'.join(params)}"
        
        # フォームタイプに応じたメール内容
        if form_type == 'spot':
            form_type_label = "スポット利用者登録（簡易契約書）"
        else:
            form_type_label = "利用者登録（契約書）"
        
        # メール送信
        sender = "info@misesapo.co.jp"
        recipient = client_email
        
        mail_subject = f"【ミセサポ】{form_type_label}のご案内"
        mail_body = f"""{client_name} 様

いつもお世話になっております。
株式会社ミセサポでございます。

この度は弊社サービスのご利用をご検討いただき、誠にありがとうございます。

下記リンクより、{form_type_label}のご登録をお願いいたします。

━━━━━━━━━━━━━━━━━━━━━━━━
▼ 登録申込フォーム
{registration_url}
━━━━━━━━━━━━━━━━━━━━━━━━

ご不明点がございましたら、お気軽にお問い合わせください。

今後ともミセサポをよろしくお願いいたします。

--------------------------------
株式会社ミセサポ
代表取締役 正田 和輝
住所：東京都中央区日本橋茅場町1-8-1 7F
電話：070-3332-3939
メール：info@misesapo.co.jp
--------------------------------
"""
        
        ses_client.send_email(
            Source=sender,
            Destination={'ToAddresses': [recipient]},
            Message={
                'Subject': {'Data': mail_subject},
                'Body': {'Text': {'Data': mail_body}}
            }
        )
        
        # クライアントのregistration_statusを更新
        now = datetime.now(timezone.utc).isoformat()
        try:
            CLIENTS_TABLE.update_item(
                Key={'id': client_id},
                UpdateExpression='SET registration_status = :status, registration_sent_at = :sent_at, registration_form_type = :form_type',
                ExpressionAttributeValues={
                    ':status': 'sent',
                    ':sent_at': now,
                    ':form_type': form_type
                }
            )
        except Exception as e:
            print(f"Failed to update client registration status: {str(e)}")
        
        print(f"Registration form email sent to {recipient} (client_id: {client_id}, type: {form_type})")
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'message': f'登録申込書を {client_email} に送信しました',
                'form_type': form_type,
                'registration_url': registration_url
            }, ensure_ascii=False)
        }
        
    except Exception as e:
        import traceback
        print(f"Error sending registration form: {str(e)}")
        print(traceback.format_exc())
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '登録申込書の送信に失敗しました',
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
        
        # 更新可能なフィールドの定義とバリデーションルール
        update_parts = []
        remove_parts = []
        attr_values = {}
        attr_names = {}
        
        # 許容される選択肢
        OPTIONS = {
            'employment_type': ['full_time', 'part_time', 'contract', 'temporary'],
            'salary_type': ['hourly', 'monthly', 'annual'],
            'evaluation': ['S', 'A', 'B', 'C', 'D'],
            'language': ['ja', 'pt', 'en']
        }
        
        fields = [
            'name', 'email', 'phone', 'role', 'role_code', 'department', 'job', 'status', 'cognito_sub',
            'scheduled_start_time', 'scheduled_end_time', 'scheduled_work_hours', 'work_pattern',
            'hire_date', 'employment_type', 'contract_period', 'certifications', 'skills',
            'experience_years', 'previous_experience', 'emergency_contact_name', 'emergency_contact_phone',
            'emergency_contact_relation', 'address', 'salary', 'salary_type', 'evaluation', 'hr_notes', 'language'
        ]
        
        for f in fields:
            if f not in body_json: continue
            val = body_json[f]
            
            # 空値は削除 (REMOVE)
            if val == "" or val is None:
                if f not in ['name', 'email', 'status', 'role']:
                    remove_parts.append(f"#{f}")
                    attr_names[f"#{f}"] = f
                continue

            # 数値型変換
            if f in ['salary', 'experience_years', 'scheduled_work_hours']:
                try:
                    val = Decimal(str(val))
                    if val < 0: raise ValueError()
                except:
                    return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': f'Invalid value for {f}'})}
            
            # 形式チェック
            elif f == 'hire_date' and not re.match(r'^\d{4}-\d{2}-\d{2}$', str(val)):
                return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'hire_date format: YYYY-MM-DD'})}
            
            # 選択肢チェック
            elif f in OPTIONS and val not in OPTIONS[f]:
                return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': f'Invalid Option for {f}'})}

            update_parts.append(f"#{f} = :{f}")
            attr_names[f"#{f}"] = f
            attr_values[f":{f}"] = val
        
        update_parts.append("#updated_at = :updated_at")
        attr_names["#updated_at"] = "updated_at"
        attr_values[":updated_at"] = datetime.utcnow().isoformat() + 'Z'
        
        expressions = []
        if update_parts: expressions.append('SET ' + ', '.join(update_parts))
        if remove_parts: expressions.append('REMOVE ' + ', '.join(remove_parts))
            
        if expressions:
            WORKERS_TABLE.update_item(
                Key={'id': worker_id},
                UpdateExpression=' '.join(expressions),
                ExpressionAttributeNames=attr_names,
                ExpressionAttributeValues=attr_values if update_parts else None
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
    勤怠記録を取得 (Scan封印版)
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
        limit = min(int(query_params.get('limit', 50)), 100) # 上限を100に制限
        
        # Scan封印: staff_id, date, または year+month のいずれも無い場合は拒否
        if not (staff_id or date or date_from or (year and month)):
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': '検索条件が不足しています。staff_id, date, または yearとmonthを指定してください。',
                    'code': 'QUERY_PARAMETER_REQUIRED'
                }, ensure_ascii=False)
            }
        
        items = []
        if staff_id:
            # 従業員IDがある場合はGSIを使用してクエリ
            try:
                from boto3.dynamodb.conditions import Key
                key_expr = Key('staff_id').eq(staff_id)
                
                if date:
                    key_expr = key_expr & Key('date').eq(date)
                elif date_from and date_to:
                    key_expr = key_expr & Key('date').between(date_from, date_to)
                elif date_from:
                    key_expr = key_expr & Key('date').gte(date_from)
                elif date_to:
                    key_expr = key_expr & Key('date').lte(date_to)
                elif year and month:
                    month_start = f"{year}-{month.zfill(2)}-01"
                    import calendar
                    _, last_day = calendar.monthrange(int(year), int(month))
                    month_end = f"{year}-{month.zfill(2)}-{str(last_day).zfill(2)}"
                    key_expr = key_expr & Key('date').between(month_start, month_end)
                
                response = ATTENDANCE_TABLE.query(
                    IndexName='staff_id-date-index',
                    KeyConditionExpression=key_expr,
                    ScanIndexForward=False,
                    Limit=limit
                )
                items = response.get('Items', [])
            except Exception as e:
                print(f"GSI query failed: {str(e)}")
                return {
                    'statusCode': 500,
                    'headers': headers,
                    'body': json.dumps({'error': 'クエリ実行に失敗しました', 'message': str(e)}, ensure_ascii=False)
                }
        else:
            # staff_idがない場合（管理画面などの月次・日次一覧）
            # 現状はフィルタ付きScanになるが、実行範囲を限定させる
            filter_expressions = []
            expression_attribute_names = {}
            expression_attribute_values = {}
            
            if date:
                filter_expressions.append("#date = :date")
                expression_attribute_names["#date"] = "date"
                expression_attribute_values[":date"] = date
            elif year and month:
                month_start = f"{year}-{month.zfill(2)}-01"
                import calendar
                _, last_day = calendar.monthrange(int(year), int(month))
                month_end = f"{year}-{month.zfill(2)}-{str(last_day).zfill(2)}"
                filter_expressions.append("#date BETWEEN :month_start AND :month_end")
                expression_attribute_names["#date"] = "date"
                expression_attribute_values[":month_start"] = month_start
                expression_attribute_values[":month_end"] = month_end
            elif date_from:
                filter_expressions.append("#date >= :date_from")
                expression_attribute_names["#date"] = "date"
                expression_attribute_values[":date_from"] = date_from
                if date_to:
                    filter_expressions.append("#date <= :date_to")
                    expression_attribute_values[":date_to"] = date_to

            # フィルタが空の場合はScanを走らせない（上記バリデーションで弾いているが念のため）
            if not filter_expressions:
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({'error': 'フィルタ条件が必要です'}, ensure_ascii=False)
                }

            response = ATTENDANCE_TABLE.scan(
                FilterExpression=' AND '.join(filter_expressions),
                ExpressionAttributeNames=expression_attribute_names,
                ExpressionAttributeValues=expression_attribute_values,
                Limit=limit
            )
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
        
        
        # ステータスによる休憩処理（シンプルなコマンド対応）
        status = body_json.get('status')
        status_timestamp = body_json.get('timestamp') or now
        
        # 既存の休憩をロード
        existing_breaks = existing_item.get('breaks', []) if existing_item else []
        processed_breaks = []
        
        if status == 'break_start':
            # 休憩開始：新しいエントリを追加（終了時刻はNone/null）
            new_break = {
                'break_start': status_timestamp,
                'break_end': None,
                'break_duration': 0
            }
            # 既存の未完了の休憩がないかチェック（あれば無視 or 強制終了？）
            # シンプルに追記する形にする
            processed_breaks = existing_breaks + [new_break]
            
        elif status == 'break_end':
            # 休憩終了：最後の未完了休憩を探して終了時刻をセット
            if existing_breaks:
                last_break = existing_breaks[-1]
                if isinstance(last_break, dict) and not last_break.get('break_end'):
                    # 完了させる
                    start_ts = last_break.get('break_start')
                    if start_ts:
                        try:
                            start_dt = datetime.fromisoformat(start_ts.replace('Z', '+00:00'))
                            end_dt = datetime.fromisoformat(status_timestamp.replace('Z', '+00:00'))
                            duration = (end_dt - start_dt).total_seconds() / 3600
                            last_break['break_end'] = status_timestamp
                            last_break['break_duration'] = round(duration, 2)
                        except Exception as e:
                            print(f"Error calculating break duration: {e}")
                            last_break['break_end'] = status_timestamp
                
            processed_breaks = existing_breaks
            
        elif break_start and break_end:
             # 明示的な休憩指定（従来ロジック）
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
            # 何も変更がない場合は既存を保持
            processed_breaks = existing_breaks
            
        # 総休憩時間を計算（完了しているものだけ）
        total_break_hours = sum(b.get('break_duration', 0) for b in processed_breaks if isinstance(b, dict) and b.get('break_duration'))
        
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
        
        # 管理者判定 (トークンベース)
        user_info = _get_user_info_from_event(event)
        is_admin_request = False
        if user_info and user_info.get('verified'):
            is_admin_request = _is_master_role(user_info.get('role'))
        
        # デバッグログ（管理者として判定されたか）
        if is_admin_request:
            print(f"DEBUG: Admin request verified for user: {user_info.get('email')}")
        
        # 管理者用フィールドの保護
        admin_only_fields = ['fixed_clock_in', 'fixed_clock_out', 'fixed_break_hours', 'notes']
        if not is_admin_request:
            # 一般スタッフからのリクエストの場合、管理者用フィールドを削除
            for field in admin_only_fields:
                if field in body_json:
                    print(f"WARNING: unauthorized_fixed_field_ignored approach=pop field={field} user={user_info.get('email') if user_info else 'unknown'}")
                    body_json.pop(field)
                    if field == 'notes': continue # notesは後続で使う可能性があるが、一般打刻では基本使わない
        
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
            expression_attribute_names = {}
            expression_attribute_values = {}
            condition_expression = None
            
            # 冪等性のための条件式構築
            if clock_in and not clock_out and not is_admin_request:
                # 一般の出勤打刻：既に出勤時刻があればエラーにするための条件
                # 既存ロジック(7047-7075)で再出勤用ID生成をしているため、
                # ここでは「同一IDで出勤のみ上書き」を防ぐ
                condition_expression = Attr('clock_in').not_exists()
            elif clock_out and not is_admin_request:
                # 一般の退勤打刻：出勤記録があり、かつ、まだ退勤していないこと
                condition_expression = Attr('clock_in').exists() & Attr('clock_out').not_exists()

            if clock_in:
                update_expression_parts.append("#clock_in = :clock_in")
                expression_attribute_names["#clock_in"] = "clock_in"
                expression_attribute_values[":clock_in"] = clock_in
            
            if clock_out:
                update_expression_parts.append("#clock_out = :clock_out")
                expression_attribute_names["#clock_out"] = "clock_out"
                expression_attribute_values[":clock_out"] = clock_out
            
            # 管理者による修正フィールドの反映
            if is_admin_request:
                for field in admin_only_fields:
                    val = body_json.get(field)
                    if val is not None:
                        update_expression_parts.append(f"#{field} = :{field}")
                        expression_attribute_names[f"#{field}"] = field
                        expression_attribute_values[f":{field}"] = Decimal(str(val)) if isinstance(val, (int, float)) else val

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
            
            try:
                update_params = {
                    'Key': {'id': attendance_id},
                    'UpdateExpression': 'SET ' + ', '.join(update_expression_parts),
                    'ExpressionAttributeNames': expression_attribute_names,
                    'ExpressionAttributeValues': expression_attribute_values
                }
                if condition_expression:
                    update_params['ConditionExpression'] = condition_expression
                
                ATTENDANCE_TABLE.update_item(**update_params)
            except ATTENDANCE_TABLE.meta.client.exceptions.ConditionalCheckFailedException:
                return {
                    'statusCode': 409,
                    'headers': headers,
                    'body': json.dumps({
                        'error': '既に打刻済みか、無効な打刻順序です。',
                        'code': 'IDEMPOTENCY_ERROR'
                    }, ensure_ascii=False)
                }
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
                'is_late': is_late,
                'late_minutes': late_minutes,
                'is_early_leave': is_early_leave,
                'early_leave_minutes': early_leave_minutes,
                'is_holiday': is_holiday,
                'is_holiday_work': is_holiday_work,
                'status': status,
                'created_at': now,
                'updated_at': now
            }
            # 管理者修正用フィールドの初期値（あれば）
            if is_admin_request:
                for field in admin_only_fields:
                    val = body_json.get(field)
                    if val is not None:
                        attendance_data[field] = Decimal(str(val)) if isinstance(val, (int, float)) else val

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

def get_admin_attendance_board(event, headers):
    """
    勤怠司令塔ボード用データを合成して返す
    5分類の異常判定: 欠勤/未退勤/遅刻/休憩不備/raw-fixed乖離
    """
    # --- 暫定閾値（後で設定化可能） ---
    SCHEDULED_START_TIME = "09:00"  # 規定出勤時刻
    MIN_BREAK_MINUTES = 60          # 最低休憩時間（分）
    RAW_FIXED_THRESHOLD_MINUTES = 10  # raw/fixed乖離閾値（分）

    user_info = _get_user_info_from_event(event)
    role = (user_info or {}).get('role')
    if role not in ['human_resources', 'hr', 'admin', 'operation', 'general_affairs']:
        return {'statusCode': 403, 'headers': headers, 'body': json.dumps({'error': 'Forbidden', 'message': '権限がありません'}, ensure_ascii=False)}

    query_params = event.get('queryStringParameters') or {}
    date = query_params.get('date')
    now_jst = datetime.now(timezone.utc) + timedelta(hours=9)
    if not date:
        date = now_jst.strftime('%Y-%m-%d')

    # 日付範囲制限: 今日から±7日以内
    try:
        requested_date = datetime.strptime(date, '%Y-%m-%d')
        today = now_jst.replace(hour=0, minute=0, second=0, microsecond=0)
        diff_days = abs((requested_date - today.replace(tzinfo=None)).days)
        if diff_days > 7:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'date_range_exceeded', 'message': '日付は今日から±7日以内で指定してください'}, ensure_ascii=False)
            }
    except ValueError:
        return {
            'statusCode': 400,
            'headers': headers,
            'body': json.dumps({'error': 'invalid_date', 'message': '日付形式が不正です（YYYY-MM-DD）'}, ensure_ascii=False)
        }

    attendance_items = []
    request_items = []
    error_items = []
    workers = []

    try:
        attendance_response = ATTENDANCE_TABLE.scan(
            FilterExpression=Attr('date').eq(date)
        )
        attendance_items = attendance_response.get('Items', [])
    except Exception as e:
        print(f"Error fetching attendance for board: {str(e)}")
        return {'statusCode': 500, 'headers': headers, 'body': json.dumps({'error': 'attendance_fetch_failed', 'message': 'エラーが発生しました（運用へ連絡）'}, ensure_ascii=False)}

    try:
        request_response = ATTENDANCE_REQUESTS_TABLE.scan(
            FilterExpression=Attr('date').eq(date)
        )
        request_items = request_response.get('Items', [])
    except Exception as e:
        print(f"Error fetching attendance requests for board: {str(e)}")

    try:
        error_response = ATTENDANCE_ERRORS_TABLE.scan()
        error_items = [item for item in error_response.get('Items', []) if not item.get('resolved', False)]
    except Exception as e:
        print(f"Error fetching attendance errors for board: {str(e)}")

    # 人数把握
    try:
        workers_response = WORKERS_TABLE.scan()
        workers = workers_response.get('Items', [])
    except Exception as e:
        print(f"Error fetching workers for board: {str(e)}")
        return {'statusCode': 500, 'headers': headers, 'body': json.dumps({'error': 'workers_fetch_failed', 'message': 'エラーが発生しました（運用へ連絡）'}, ensure_ascii=False)}

    attendance_map = {item.get('staff_id'): item for item in attendance_items if item.get('staff_id')}
    request_by_staff = {}
    pending_requests = []
    for req in request_items:
        staff_id = req.get('staff_id')
        if staff_id:
            request_by_staff.setdefault(staff_id, []).append(req)
        if req.get('status') == 'pending':
            pending_requests.append(req)

    error_by_staff = {}
    for err in error_items:
        staff_id = err.get('staff_id')
        if staff_id:
            error_by_staff.setdefault(staff_id, []).append(err)

    board_rows = []
    count_absent = 0
    count_no_clockout = 0
    count_late = 0
    count_break_issue = 0
    count_divergence = 0
    count_alert_12h = 0
    count_alert_break_90m = 0

    scheduled_minutes = time_to_minutes(SCHEDULED_START_TIME)
    
    for worker in workers:
        staff_id = worker.get('id')
        staff_name = worker.get('name') or worker.get('display_name') or staff_id
        attendance = attendance_map.get(staff_id)
        requests = request_by_staff.get(staff_id, [])
        # 必須③：エラーを当日＋未解決のみにフィルタ
        all_errors = error_by_staff.get(staff_id, [])
        errors = [e for e in all_errors if e.get('date') == date and not e.get('resolved', False)]


        raw_in = attendance.get('clock_in') if attendance else None
        raw_out = attendance.get('clock_out') if attendance else None
        fixed_in = attendance.get('fixed_clock_in') if attendance else None
        fixed_out = attendance.get('fixed_clock_out') if attendance else None
        raw_breaks = attendance.get('breaks') if attendance else None
        fixed_breaks = attendance.get('fixed_breaks') if attendance else None

        issues = []
        
        # 1. 欠勤
        if not raw_in:
            issues.append('absent')
            count_absent += 1
        else:
            # 2. 未退勤 (12時間超チェック含む)
            if not raw_out:
                issues.append('no_clockout')
                count_no_clockout += 1
                try:
                    in_dt = datetime.fromisoformat(raw_in.replace('Z', '+00:00'))
                    if (now_jst - in_dt).total_seconds() > 12 * 3600:
                        issues.append('alert_12h')
                        count_alert_12h += 1
                except: pass
            
            # 3. 遅刻
            in_min = time_to_minutes(raw_in)
            if in_min and scheduled_minutes and in_min > scheduled_minutes:
                issues.append('late')
                count_late += 1
            
            # 4. 休憩不備 (90分超チェック含む)
            brk_total = calc_break_total(fixed_breaks) or calc_break_total(raw_breaks)
            if brk_total < MIN_BREAK_MINUTES:
                issues.append('break_issue')
                count_break_issue += 1
            
            current_breaks = fixed_breaks or raw_breaks
            if isinstance(current_breaks, list):
                for b in current_breaks:
                    b_start = b.get('start') or b.get('break_start')
                    b_end = b.get('end') or b.get('break_end')
                    if b_start and not b_end:
                        try:
                            s_dt = datetime.fromisoformat(b_start.replace('Z', '+00:00'))
                            if (now_jst - s_dt).total_seconds() > 90 * 60:
                                issues.append('alert_break_90m')
                                count_alert_break_90m += 1
                                break
                        except: pass

            # 5. 乖離
            if attendance:
                if fixed_in is None and fixed_out is None:
                    issues.append('divergence')
                    count_divergence += 1
                else:
                    diff_in = abs_diff_minutes(raw_in, fixed_in) if fixed_in else 0
                    diff_out = abs_diff_minutes(raw_out, fixed_out) if fixed_out else 0
                    if diff_in > RAW_FIXED_THRESHOLD_MINUTES or diff_out > RAW_FIXED_THRESHOLD_MINUTES:
                        issues.append('divergence')
                        count_divergence += 1

        STATUS_LABELS = {
            'absent': '欠勤',
            'no_clockout': '未退勤',
            'alert_12h': '退勤未打刻(12h超)',
            'late': '遅刻',
            'break_issue': '休憩不足',
            'alert_break_90m': '休憩未終了(90m超)',
            'divergence': '記載乖離'
        }
        primary_issue = None
        # 警告を優先
        for key in ['alert_12h', 'alert_break_90m', 'absent', 'no_clockout', 'late', 'break_issue', 'divergence']:
            if key in issues:
                primary_issue = key
                break
        
        board_rows.append({
            'attendance_id': attendance.get('id') if attendance else None,
            'staff_id': staff_id,
            'staff_name': staff_name,
            'role': worker.get('role'),
            'raw': {
                'clock_in': _to_jst_iso(raw_in),
                'clock_out': _to_jst_iso(raw_out),
                'breaks': raw_breaks
            },
            'fixed': {
                'clock_in': _to_jst_iso(fixed_in),
                'clock_out': _to_jst_iso(fixed_out),
                'breaks': fixed_breaks
            },
            'issues': issues,
            'status': primary_issue or 'ok',
            'status_label': STATUS_LABELS.get(primary_issue, '正常'),
            'requests_count': len(requests),
            'errors_count': len(errors)
        })

    kpis = {
        'pending_requests': len(pending_requests),
        'absent': count_absent,
        'no_clockout': count_no_clockout,
        'late': count_late,
        'break_issue': count_break_issue,
        'divergence': count_divergence,
        'alert_12h': count_alert_12h,
        'alert_break_90m': count_alert_break_90m,
        'unresolved_errors': len(error_items)
    }

    return {
        'statusCode': 200,
        'headers': headers,
        'body': json.dumps({
            'result': 'ok' if board_rows else 'no_data',
            'date': date,
            'kpis': kpis,
            'board': board_rows,
            'queue': pending_requests
        }, ensure_ascii=False, default=str)
    }


def _to_jst_iso(value):
    if not value or not isinstance(value, str):
        return value
    try:
        text = value.strip()
        if text.endswith('Z'):
            text = text.replace('Z', '+00:00')
        dt = datetime.fromisoformat(text)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        jst = dt.astimezone(timezone(timedelta(hours=9)))
        return jst.isoformat()
    except Exception:
        return value


def _normalize_breaks(breaks):
    if not isinstance(breaks, list):
        return []
    normalized = []
    for b in breaks:
        if not isinstance(b, dict):
            continue
        normalized.append({
            'start': _to_jst_iso(b.get('start')),
            'end': _to_jst_iso(b.get('end'))
        })
    return normalized


def _query_by_staff_date(table, staff_id, date_from, date_to):
    if not staff_id or not date_from or not date_to:
        return []
    indexes = table.meta.client.describe_table(TableName=table.name).get('Table', {}).get('GlobalSecondaryIndexes', [])
    index_meta = {idx.get('IndexName'): idx for idx in indexes}
    index = index_meta.get(ATTENDANCE_STAFF_DATE_INDEX)
    if not index or index.get('IndexStatus') != 'ACTIVE':
        raise DependencyNotReadyError(ATTENDANCE_STAFF_DATE_INDEX, table.name)
    response = table.query(
        IndexName=ATTENDANCE_STAFF_DATE_INDEX,
        KeyConditionExpression=Key('staff_id').eq(staff_id) & Key('date').between(date_from, date_to)
    )
    return response.get('Items', [])


def get_admin_attendance_user_detail(event, headers, worker_id):
    """個人別勤怠詳細（read-only）- 最大31日制限"""
    MAX_RANGE_DAYS = 31  # 最大日付範囲

    user_info = _get_user_info_from_event(event)
    role = (user_info or {}).get('role')
    if role not in ['human_resources', 'hr', 'admin', 'operation', 'general_affairs']:
        return {'statusCode': 403, 'headers': headers, 'body': json.dumps({'error': 'Forbidden', 'message': '権限がありません'}, ensure_ascii=False)}

    query_params = event.get('queryStringParameters') or {}
    date_from = query_params.get('from')
    date_to = query_params.get('to')
    
    # from/to が空の場合は date パラメータまたは今日の日付をフォールバック
    if not date_from or not date_to:
        fallback_date = query_params.get('date') or datetime.now(timezone(timedelta(hours=9))).strftime('%Y-%m-%d')
        original_from, original_to = date_from, date_to
        date_from = date_from or fallback_date
        date_to = date_to or fallback_date
        print(f"[get_admin_attendance_user_detail] Fallback date applied: from={original_from}->{date_from}, to={original_to}->{date_to}, worker_id={worker_id}")

    # 日付範囲バリデーション: 最大31日
    try:
        dt_from = datetime.strptime(date_from, '%Y-%m-%d')
        dt_to = datetime.strptime(date_to, '%Y-%m-%d')
        if dt_to < dt_from:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'invalid_range', 'message': 'to は from より後の日付を指定してください'}, ensure_ascii=False)
            }
        range_days = (dt_to - dt_from).days + 1
        if range_days > MAX_RANGE_DAYS:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'range_exceeded', 'message': f'日付範囲は最大{MAX_RANGE_DAYS}日までです（指定: {range_days}日）'}, ensure_ascii=False)
            }
    except ValueError:
        return {
            'statusCode': 400,
            'headers': headers,
            'body': json.dumps({'error': 'invalid_date', 'message': '日付形式が不正です（YYYY-MM-DD）'}, ensure_ascii=False)
        }

    try:
        attendance_items = _query_by_staff_date(ATTENDANCE_TABLE, worker_id, date_from, date_to)
        request_items = _query_by_staff_date(ATTENDANCE_REQUESTS_TABLE, worker_id, date_from, date_to)
        error_items = _query_by_staff_date(ATTENDANCE_ERRORS_TABLE, worker_id, date_from, date_to)
    except DependencyNotReadyError as e:
        body = {
            'result': 'dependency_not_ready',
            'message': '現在データ準備中です（運用へ連絡）',
            'missing_index': e.missing_index
        }
        if e.missing_table:
            body['missing_table'] = e.missing_table
        return {
            'statusCode': 503,
            'headers': headers,
            'body': json.dumps(body, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error fetching attendance detail: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'attendance_query_failed', 'message': 'エラーが発生しました（運用へ連絡）'}, ensure_ascii=False)
        }

    requests_by_date = {}
    for req in request_items:
        date_key = req.get('date')
        if date_key:
            requests_by_date.setdefault(date_key, []).append({
                'request_id': req.get('id'),
                'type': req.get('type'),
                'status': req.get('status'),
                'reason_code': req.get('reason_code')
            })

    errors_by_date = {}
    for err in error_items:
        date_key = err.get('date')
        if date_key:
            errors_by_date.setdefault(date_key, []).append({
                'error_id': err.get('id'),
                'type': err.get('type'),
                'status': err.get('status'),
                'message': err.get('message', ''),  # 必須②：エラーメッセージ追加
                'resolved': err.get('resolved', False),  # 必須②：解決フラグ追加
                'created_at': err.get('created_at', '')  # 必須②：作成日時追加
            })

    days = []
    for item in attendance_items:
        date_key = item.get('date')
        if not date_key:
            continue
        days.append({
            'date': date_key,
            'attendance_id': item.get('id'),  # 必須①：attendance_id追加
            'fixed': {
                'clock_in': _to_jst_iso(item.get('fixed_clock_in')),
                'clock_out': _to_jst_iso(item.get('fixed_clock_out')),
                'breaks': _normalize_breaks(item.get('fixed_breaks')),
                'total_minutes': item.get('fixed_total_minutes'),
                'status': item.get('fixed_status'),
                'reason_code': item.get('fixed_reason_code')
            },
            'raw': {
                'clock_in': _to_jst_iso(item.get('clock_in')),
                'clock_out': _to_jst_iso(item.get('clock_out')),
                'breaks': _normalize_breaks(item.get('breaks'))
            },
            'requests': requests_by_date.get(date_key, []),
            'errors': errors_by_date.get(date_key, [])
        })

    days.sort(key=lambda d: d.get('date'))

    result = 'ok' if days else 'no_data'
    return {
        'statusCode': 200,
        'headers': headers,
        'body': json.dumps({
            'worker_id': worker_id,
            'from': date_from,
            'to': date_to,
            'timezone': 'Asia/Tokyo',
            'result': result,
            'days': days
        }, ensure_ascii=False, default=str)
    }

def _is_hr_admin(user_info):
    role = (user_info or {}).get('role')
    if not role:
        return False
    r = str(role).lower()
    allowed = [
        'human_resources', 'hr', 'admin', 'operation', 'general_affairs',
        'headquarters',  # 本社（業務報告の事務操作を許可）
    ]
    if role == '管理者':
        return True
    return r in allowed

def get_admin_attendance_monthly_summary(event, headers):
    user_info = _get_user_info_from_event(event)
    if not _is_hr_admin(user_info):
        return {'statusCode': 403, 'headers': headers, 'body': json.dumps({'error': 'Forbidden'}, ensure_ascii=False)}
    
    query_params = event.get('queryStringParameters') or {}
    month = query_params.get('month') # YYYY-MM
    if not month:
        return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'month is required'}, ensure_ascii=False)}
    
    try:
        # Scan for the month
        response = ATTENDANCE_TABLE.scan(
            FilterExpression=Attr('date').begins_with(month)
        )
        items = response.get('Items', [])
        
        # Calculate summary
        total_work_min = 0
        total_work_days = len(set(item.get('date') for item in items))
        alert_count = 0
        unconfirmed_count = 0
        
        now_jst = datetime.now(timezone.utc) + timedelta(hours=9)
        
        for item in items:
            total_work_min += calc_work_minutes(item)
            issues = get_issues(item, now_jst)
            if any(i.startswith('alert_') or i in ['late', 'break_issue'] for i in issues):
                alert_count += 1
            if not item.get('fixed_clock_in') and not item.get('fixed_clock_out'):
                unconfirmed_count += 1
                
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'month': month,
                'kpis': {
                    'total_work_hours': round(total_work_min / 60, 1),
                    'total_work_days': total_work_days,
                    'unconfirmed_days': unconfirmed_count,
                    'alert_count': alert_count
                }
            }, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error monthly summary: {str(e)}")
        return {'statusCode': 500, 'headers': headers, 'body': json.dumps({'error': str(e)}, ensure_ascii=False)}

def get_admin_attendance_monthly_users(event, headers):
    user_info = _get_user_info_from_event(event)
    if not _is_hr_admin(user_info):
        return {'statusCode': 403, 'headers': headers, 'body': json.dumps({'error': 'Forbidden'}, ensure_ascii=False)}
    
    query_params = event.get('queryStringParameters') or {}
    month = query_params.get('month')
    if not month:
        return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'month is required'}, ensure_ascii=False)}
    
    try:
        # Get all workers first to ensure everyone is listed
        workers_res = WORKERS_TABLE.scan()
        workers = workers_res.get('Items', [])
        
        # Get all attendance for the month
        att_res = ATTENDANCE_TABLE.scan(
            FilterExpression=Attr('date').begins_with(month)
        )
        items = att_res.get('Items', [])
        
        # Group by user
        user_stats = {}
        for w in workers:
            user_stats[w['id']] = {
                'staff_id': w['id'],
                'staff_name': w.get('name') or w.get('display_name'),
                'work_days': 0,
                'total_work_min': 0,
                'total_break_min': 0,
                'unconfirmed_days': 0,
                'alert_count': 0
            }
            
        now_jst = datetime.now(timezone.utc) + timedelta(hours=9)
        
        for item in items:
            sid = item.get('staff_id')
            if sid not in user_stats: continue
            
            stats = user_stats[sid]
            stats['work_days'] += 1
            stats['total_work_min'] += calc_work_minutes(item)
            stats['total_break_min'] += calc_break_total(item.get('fixed_breaks') or item.get('breaks'))
            
            issues = get_issues(item, now_jst)
            if any(i.startswith('alert_') or i in ['late', 'break_issue'] for i in issues):
                stats['alert_count'] += 1
            if not item.get('fixed_clock_in') and not item.get('fixed_clock_out'):
                stats['unconfirmed_days'] += 1
                
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'month': month,
                'users': list(user_stats.values())
            }, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error monthly users: {str(e)}")
        return {'statusCode': 500, 'headers': headers, 'body': json.dumps({'error': str(e)}, ensure_ascii=False)}

def patch_admin_attendance_fixed(attendance_id, event, headers):
    user_info = _get_user_info_from_event(event)
    if not _is_hr_admin(user_info):
        return {'statusCode': 403, 'headers': headers, 'body': json.dumps({'error': 'Forbidden'}, ensure_ascii=False)}
    
    body = json.loads(event.get('body', '{}'))
    reason_code = body.get('reason_code')
    if not reason_code:
        return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'reason_code is required'}, ensure_ascii=False)}
    
    try:
        # Prepare UpdateExpression
        update_parts = ["SET fixed_reason_code = :rc, fixed_at = :now, fixed_by = :by"]
        vals = {
            ':rc': reason_code,
            ':now': (datetime.now(timezone.utc) + timedelta(hours=9)).isoformat(),
            ':by': user_info.get('email')
        }
        
        # 可変フィールド
        fields = ['fixed_clock_in', 'fixed_clock_out', 'fixed_breaks', 'fixed_total_minutes', 'fixed_status']
        for f in fields:
            if f in body:
                update_parts.append(f"{f} = :{f}")
                vals[f":{f}"] = body[f]
        
        ATTENDANCE_TABLE.update_item(
            Key={'id': attendance_id},
            UpdateExpression=", ".join(update_parts),
            ExpressionAttributeValues=vals
        )
        
        return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'status': 'success'}, ensure_ascii=False)}
    except Exception as e:
        print(f"Error patching attendance: {str(e)}")
        return {'statusCode': 500, 'headers': headers, 'body': json.dumps({'error': str(e)}, ensure_ascii=False)}

def calc_work_minutes(attendance):
    # (Helper used by monthly)
    clock_in = attendance.get('fixed_clock_in') or attendance.get('clock_in')
    clock_out = attendance.get('fixed_clock_out') or attendance.get('clock_out')
    if not clock_in or not clock_out:
        return 0
    try:
        in_dt = datetime.fromisoformat(clock_in.replace('Z', '+00:00'))
        out_dt = datetime.fromisoformat(clock_out.replace('Z', '+00:00'))
        total_min = (out_dt - in_dt).total_seconds() / 60
        brk = calc_break_total(attendance.get('fixed_breaks') or attendance.get('breaks'))
        return max(0, int(total_min - brk))
    except:
        return 0

def get_issues(attendance, now_jst):
    # (Helper used by monthly)
    issues = []
    raw_in = attendance.get('clock_in')
    raw_out = attendance.get('clock_out')
    if not raw_in:
        issues.append('absent')
        return issues
        
    if not raw_out:
        issues.append('no_clockout')
        try:
            in_dt = datetime.fromisoformat(raw_in.replace('Z', '+00:00'))
            if (now_jst - in_dt).total_seconds() > 12 * 3600:
                issues.append('alert_12h')
        except: pass
    
    # Simple thresholds for late/break issue
    # clock_in > 09:00 JST
    try:
        in_dt = datetime.fromisoformat(raw_in.replace('Z', '+00:00'))
        in_jst = in_dt + timedelta(hours=9)
        if in_jst.hour > 9 or (in_jst.hour == 9 and in_jst.minute > 0):
            issues.append('late')
    except: pass
    
    brk = calc_break_total(attendance.get('fixed_breaks') or attendance.get('breaks'))
    if brk < 60:
        issues.append('break_issue')
        
    return issues

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


# 玄関（Portal）稼働日設定の S3 キー
PORTAL_OPERATING_DAYS_S3_KEY = 'config/portal-operating-days.json'


def get_portal_operating_days(headers):
    """
    玄関の稼働日設定を取得（非稼働日リスト）。S3 の config/portal-operating-days.json を返す。
    認証不要（Portal で未ログイン時も今日が休業日か表示するため）。
    """
    try:
        response = s3_client.get_object(Bucket=S3_BUCKET_NAME, Key=PORTAL_OPERATING_DAYS_S3_KEY)
        body = response['Body'].read().decode('utf-8')
        data = json.loads(body)
        if not isinstance(data.get('non_operating_dates'), list):
            data['non_operating_dates'] = []
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps(data, ensure_ascii=False)
        }
    except s3_client.exceptions.NoSuchKey:
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'non_operating_dates': []}, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error getting portal operating days: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '玄関稼働日設定の取得に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }


def put_portal_operating_days(event, headers):
    """
    玄関の稼働日設定を更新（非稼働日リスト）。管理者・認証必須。
    """
    auth_header = event.get('headers') or {}
    auth = auth_header.get('Authorization') or auth_header.get('authorization') or ''
    if not auth.startswith('Bearer '):
        return {
            'statusCode': 401,
            'headers': headers,
            'body': json.dumps({'error': '認証が必要です'}, ensure_ascii=False)
        }
    try:
        body_str = event.get('body') or '{}'
        data = json.loads(body_str)
        dates = data.get('non_operating_dates')
        if not isinstance(dates, list):
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'non_operating_dates は配列で指定してください'}, ensure_ascii=False)
            }
        # YYYY-MM-DD 形式のみ許可
        normalized = []
        for d in dates:
            s = str(d).strip()
            if len(s) == 10 and s[4] == '-' and s[7] == '-':
                normalized.append(s)
        payload = {'non_operating_dates': sorted(set(normalized))}
        s3_client.put_object(
            Bucket=S3_BUCKET_NAME,
            Key=PORTAL_OPERATING_DAYS_S3_KEY,
            Body=json.dumps(payload, ensure_ascii=False).encode('utf-8'),
            ContentType='application/json'
        )
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'non_operating_dates': payload['non_operating_dates']
            }, ensure_ascii=False)
        }
    except json.JSONDecodeError as e:
        return {
            'statusCode': 400,
            'headers': headers,
            'body': json.dumps({'error': 'JSON が不正です', 'message': str(e)}, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error putting portal operating days: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '玄関稼働日設定の保存に失敗しました',
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
    ブランド一覧を取得。
    ページネーション対応で全件返す。いかなる例外でも 200 で空配列を返し 502 を避ける。
    """
    def _ok(brands_list):
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'items': brands_list, 'count': len(brands_list)}, ensure_ascii=False, default=str)
        }
    try:
        query_params = event.get('queryStringParameters') or {}
        client_id = query_params.get('client_id')
        brands = []
        scan_kw = {}
        if client_id:
            scan_kw['FilterExpression'] = Attr('client_id').eq(client_id)
        while True:
            response = BRANDS_TABLE.scan(**scan_kw)
            brands.extend(response.get('Items', []))
            if 'LastEvaluatedKey' not in response:
                break
            scan_kw['ExclusiveStartKey'] = response['LastEvaluatedKey']
        return _ok(brands)
    except Exception as e:
        print(f"get_brands: error (returning empty list to avoid 502): {e}")
        import traceback
        traceback.print_exc()
        return _ok([])

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
    営業担当者は自分の担当店舗のみ、その他は権限に応じてフィルタリング
    """
    try:
        # 認証・権限チェック
        auth_header = _get_auth_header(event)
        id_token = auth_header.replace('Bearer ', '') if auth_header else ''
        user_info = verify_cognito_id_token(id_token)
        
        # 開発環境などのためのフォールバック: 認証なしでも一旦通すが、本番では厳格化推奨
        if not user_info and os.environ.get('STAGE') == 'dev':
            # 開発用ダミーユーザー
            print("WARNING: No auth token, using dev fallback")
            user_info = {'uid': 'dev_user', 'role': 'admin'}

        current_user_id = user_info.get('uid') if user_info else None
        current_role = user_info.get('role') if user_info else None

        # クエリパラメータからフィルタ条件を取得
        query_params = event.get('queryStringParameters') or {}
        client_id = query_params.get('client_id')
        brand_id = query_params.get('brand_id')
        
        # フィルタリング条件の構築
        filter_expressions = []
        expression_attribute_names = {}
        expression_attribute_values = {}
        
        # 1. ユーザーロールによる強制フィルタ
        if current_role == 'sales':
            # 営業担当: 自分がオーナーのデータのみ表示
            # ただし、将来的に「割り当てられたデータ」も見れるようにするなら条件追加
            filter_expressions.append('#owner_id = :current_user_id')
            expression_attribute_names['#owner_id'] = 'owner_id'
            expression_attribute_values[':current_user_id'] = current_user_id
        
        # 2. クエリパラメータによるフィルタ
        if brand_id:
            filter_expressions.append('brand_id = :brand_id')
            expression_attribute_values[':brand_id'] = brand_id
        elif client_id:
            filter_expressions.append('client_id = :client_id')
            expression_attribute_values[':client_id'] = client_id
            
        # スキャンパラメータの構築
        scan_params = {}
        if filter_expressions:
            scan_params['FilterExpression'] = ' AND '.join(filter_expressions)
            if expression_attribute_names:
                scan_params['ExpressionAttributeNames'] = expression_attribute_names
            scan_params['ExpressionAttributeValues'] = expression_attribute_values
            
        response = STORES_TABLE.scan(**scan_params)
        stores = response.get('Items', [])
        # ページネーション: 全件取得
        while 'LastEvaluatedKey' in response:
            scan_params['ExclusiveStartKey'] = response['LastEvaluatedKey']
            response = STORES_TABLE.scan(**scan_params)
            stores.extend(response.get('Items', []))

        # client_name / brand_name は店舗レコードに保存済み（インポート・create/update で設定）。そのまま返す。

        # レスポンス形式を統一（items配列で返す）
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'items': stores,
                'count': len(stores),
                'debug_info': {'role': current_role, 'uid': current_user_id}
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
    営業担当者が作成した場合、自動的にowner_idを付与しstatusをprospectにする
    """
    try:
        # 認証チェック
        auth_header = _get_auth_header(event)
        id_token = auth_header.replace('Bearer ', '') if auth_header else ''
        user_info = verify_cognito_id_token(id_token)
        
        # 開発環境フォールバック
        if not user_info and os.environ.get('STAGE') == 'dev':
            user_info = {'uid': 'dev_user', 'role': 'admin', 'name': 'Dev User'}
            
        if not user_info:
             return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': 'Unauthorized', 'message': '認証に失敗しました。再ログインしてください。'}, ensure_ascii=False)
            }

        current_user_id = user_info.get('uid')
        current_role = user_info.get('role')
        current_user_name = user_info.get('name')

        # リクエストボディを取得
        if event.get('isBase64Encoded'):
            body = base64.b64decode(event['body'])
        else:
            body = event.get('body', '')
        
        try:
            if isinstance(body, str):
                body_json = json.loads(body)
            else:
                body_json = json.loads(body.decode('utf-8'))
        except Exception as e:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'Invalid JSON', 'message': 'リクエストの内容が正しくありません(JSON形式エラー)'}, ensure_ascii=False)
            }
        
        # ID生成（5桁形式: ST00001〜）
        if 'id' not in body_json or not body_json['id']:
            store_id = generate_next_id(STORES_TABLE, 'ST')
        else:
            store_id = body_json['id']
        
        now = datetime.utcnow().isoformat() + 'Z'
        
        # デフォルトステータスの決定
        # 営業担当なら 'prospect'、それ以外（管理者など）は指定がなければ 'active'
        default_status = 'prospect' if current_role == 'sales' else 'active'
        status = body_json.get('status', default_status)
        
        # データマッピング (Wizardからの入力に対応)
        store_name = body_json.get('name') or body_json.get('store_name', '')
        address1 = body_json.get('address1') or body_json.get('address', '')
        notes = body_json.get('notes') or body_json.get('memo', '')
        
        # デフォルト値を設定（顧客DBCSV設計: docs/CUSTOMER_TABLE_SCHEMA.md の属性を含む）
        store_data = {
            'id': store_id,
            'name': store_name,
            'client_id': body_json.get('client_id', ''),
            'company_name': body_json.get('company_name', ''), # テキスト入力の会社名
            'brand_id': body_json.get('brand_id', ''),
            'brand_name': body_json.get('brand_name', ''),     # テキスト入力のブランド名
            'postcode': body_json.get('postcode', ''),
            'pref': body_json.get('pref', ''),
            'city': body_json.get('city', ''),
            'address1': address1,
            'address2': body_json.get('address2', ''),
            'phone': body_json.get('phone', ''),
            'email': body_json.get('email', ''),
            'contact_person': body_json.get('contact_person', ''),
            'status': status,
            'notes': notes,
            'sales_notes': body_json.get('sales_notes', ''),
            'registration_type': body_json.get('registration_type', 'manual'),
            # リード登録用（misogi /sales/leads/new から送信）
            'lead_status': body_json.get('lead_status', ''),
            'next_action_date': body_json.get('next_action_date', ''),
            'next_action_content': body_json.get('next_action_content', ''),
            # 顧客DBCSV由来の属性
            'url': body_json.get('url', ''),
            'acquired_by': body_json.get('acquired_by', ''),
            'assigned_to': body_json.get('assigned_to', ''),
            'store_count': body_json.get('store_count', ''),
            'needs_notes': body_json.get('needs_notes', ''),
            'cleaning_frequency': body_json.get('cleaning_frequency', ''),
            'introducer': body_json.get('introducer', ''),
            'implementation_items': body_json.get('implementation_items', ''),
            # オーナー情報（最重要）
            'owner_id': current_user_id,
            'created_by': current_user_id,
            'created_by_name': current_user_name,
            'created_at': body_json.get('created_at', now),
            'updated_at': now
        }
        # 店舗レコードに法人名・ブランド名を保存（一覧で名前を返すため）
        try:
            cid = store_data.get('client_id')
            bid = store_data.get('brand_id')
            if cid:
                r = CLIENTS_TABLE.get_item(Key={'id': cid})
                c = r.get('Item') or {}
                store_data['client_name'] = c.get('name') or c.get('company_name') or ''
            else:
                store_data['client_name'] = body_json.get('client_name', '')
            if bid:
                r = BRANDS_TABLE.get_item(Key={'id': bid})
                b = r.get('Item') or {}
                store_data['brand_name'] = b.get('name') or ''
            else:
                store_data['brand_name'] = body_json.get('brand_name', '')
        except Exception as _e:
            print(f"create_store: resolve client/brand name: {_e}")
            store_data['client_name'] = store_data.get('client_name', '')
            store_data['brand_name'] = store_data.get('brand_name', '')

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
                'message': f'システムエラー: {str(e)}'
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
        
        # 更新可能なフィールド（顧客DBCSV設計の属性を含む）
        updatable_fields = [
            'name', 'client_id', 'brand_id', 'client_name', 'brand_name',
            'postcode', 'pref', 'city', 'address1', 'address2', 'phone', 'email', 'contact_person',
            'status', 'notes', 'sales_notes', 'registration_type',
            'url', 'acquired_by', 'assigned_to', 'store_count',
            'needs_notes', 'cleaning_frequency', 'introducer', 'implementation_items'
        ]
        updated_data = existing_item.copy()
        for field in updatable_fields:
            if field in body_json:
                updated_data[field] = body_json[field]
        # client_id / brand_id が更新されたら法人名・ブランド名を解決して持たせる
        if 'client_id' in body_json or 'brand_id' in body_json:
            try:
                cid = updated_data.get('client_id')
                bid = updated_data.get('brand_id')
                if cid:
                    r = CLIENTS_TABLE.get_item(Key={'id': cid})
                    c = r.get('Item') or {}
                    updated_data['client_name'] = c.get('name') or c.get('company_name') or ''
                if bid:
                    r = BRANDS_TABLE.get_item(Key={'id': bid})
                    b = r.get('Item') or {}
                    updated_data['brand_name'] = b.get('name') or ''
            except Exception as _e:
                print(f"update_store: resolve client/brand name: {_e}")
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
        auth_header = _get_auth_header(event)
        if not auth_header or not auth_header.startswith('Bearer '):
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': '認証が必要です'}, ensure_ascii=False)
            }
        
        id_token = auth_header.replace('Bearer ', '')
        user_info = verify_cognito_id_token(id_token)
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
        auth_header = _get_auth_header(event)
        if not auth_header or not auth_header.startswith('Bearer '):
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': '認証が必要です'}, ensure_ascii=False)
            }
        
        id_token = auth_header.replace('Bearer ', '')
        user_info = verify_cognito_id_token(id_token)
        
        if not user_info or not _is_master_role(user_info.get('role')):
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
        auth_header = _get_auth_header(event)
        if not auth_header or not auth_header.startswith('Bearer '):
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': '認証が必要です'}, ensure_ascii=False)
            }
        
        id_token = auth_header.replace('Bearer ', '')
        user_info = verify_cognito_id_token(id_token)
        
        if not user_info or not _is_master_role(user_info.get('role')):
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
        auth_header = _get_auth_header(event)
        if not auth_header or not auth_header.startswith('Bearer '):
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': '認証が必要です'}, ensure_ascii=False)
            }
        
        id_token = auth_header.replace('Bearer ', '')
        user_info = verify_cognito_id_token(id_token)
        
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
        auth_header = _get_auth_header(event)
        if not auth_header or not auth_header.startswith('Bearer '):
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': '認証が必要です'}, ensure_ascii=False)
            }
        
        id_token = auth_header.replace('Bearer ', '')
        user_info = verify_cognito_id_token(id_token)
        
        if not user_info:
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': '認証に失敗しました'}, ensure_ascii=False)
            }
        
        # クエリパラメータを取得
        query_params = event.get('queryStringParameters') or {}
        is_admin = _is_master_role(user_info.get('role'))
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
        # 認証チェック（Cognito ID トークン）
        auth_header = _get_auth_header(event)
        id_token = auth_header.replace('Bearer ', '') if auth_header else ''
        
        if not id_token or id_token == 'mock-token':
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': 'Unauthorized'}, ensure_ascii=False)
            }
        
        user_info = verify_cognito_id_token(id_token)
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
        auth_header = _get_auth_header(event)
        id_token = auth_header.replace('Bearer ', '') if auth_header else ''
        user_info = verify_cognito_id_token(id_token)
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
        auth_header = _get_auth_header(event)
        id_token = auth_header.replace('Bearer ', '') if auth_header else ''
        user_info = verify_cognito_id_token(id_token)
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
        auth_header = _get_auth_header(event)
        id_token = auth_header.replace('Bearer ', '') if auth_header else ''
        user_info = verify_cognito_id_token(id_token)
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
        
        # 通知設定の取得
        notify_email = body_json.get('notify_email', False)
        notify_line = body_json.get('notify_line', False)
        notify_push = body_json.get('notify_push', False)
        notify_sound = body_json.get('notify_sound', False)

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
            'target_type': target_type,  # GSI用
            
            # 通知設定を保存
            'notify_email': notify_email,
            'notify_line': notify_line,
            'notify_push': notify_push,
            'notify_sound': notify_sound
        }
        
        ANNOUNCEMENTS_TABLE.put_item(Item=announcement_item)

        # メール通知処理
        if notify_email:
            try:
                recipients = []
                if target_type == 'all':
                    # 全従業員のメールアドレスを取得
                    response = WORKERS_TABLE.scan(
                        FilterExpression=Attr('status').eq('active'),
                        ProjectionExpression='email'
                    )
                    recipients = [item['email'] for item in response.get('Items', []) if item.get('email')]
                elif target_type == 'individual' and target_staff_ids:
                    # 個別従業員のメールアドレスを取得
                    # 注意: batch_get_itemはキーが必要だが、ここではscanで代用（件数が少ない想定）
                    response = WORKERS_TABLE.scan(ProjectionExpression='id, email')
                    all_workers = response.get('Items', [])
                    recipients = [w['email'] for w in all_workers if w['id'] in target_staff_ids and w.get('email')]

                if recipients:
                    mail_subject = f"【業務連絡】{title}"
                    mail_body = f"新規の業務連絡があります。\n\n" \
                                f"■タイトル\n{title}\n\n" \
                                f"■内容\n{content}\n\n" \
                                f"■確認・詳細\nhttps://misesapo.app/staff/announcements/{announcement_id}\n" \
                                f"(ログインが必要です)\n\n" \
                                f"--------------------------------\n" \
                                f"MISESAPO 管理システム"

                    # 50件ずつ分割してBCC送信（SESの制限回避）
                    chunk_size = 40
                    for i in range(0, len(recipients), chunk_size):
                        chunk = recipients[i:i + chunk_size]
                        try:
                            ses_client.send_email(
                                Source="info@misesapo.co.jp",
                                Destination={
                                    'ToAddresses': ["info@misesapo.co.jp"],  # ダミー宛先
                                    'BccAddresses': chunk
                                },
                                Message={
                                    'Subject': {'Data': mail_subject},
                                    'Body': {'Text': {'Data': mail_body}}
                                }
                            )
                            print(f"[INFO] Announcement email sent to {len(chunk)} recipients (chunk {i//chunk_size + 1})")
                        except Exception as e:
                            print(f"[ERROR] Failed to send announcement email chunk: {e}")
            except Exception as e:
                print(f"[ERROR] Failed to process announcement email notifications: {e}")

        
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
        auth_header = _get_auth_header(event)
        id_token = auth_header.replace('Bearer ', '') if auth_header else ''
        user_info = verify_cognito_id_token(id_token)
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
        auth_header = _get_auth_header(event)
        id_token = auth_header.replace('Bearer ', '') if auth_header else ''
        user_info = verify_cognito_id_token(id_token)
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
        auth_header = _get_auth_header(event)
        id_token = auth_header.replace('Bearer ', '') if auth_header else ''
        user_info = verify_cognito_id_token(id_token)
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

    # Using gemini-flash-latest which is available for this API Key
    model_name = "gemini-flash-latest"
    api_version = "v1beta"
    url = f"https://generativelanguage.googleapis.com/{api_version}/models/{model_name}:generateContent?key={api_key}"
    
    parts = []
    # User prompt
    parts.append({"text": prompt})
    
    # Media (Audio/Image)
    if media:
        parts.append({
            "inline_data": {
                "mime_type": media.get('mime_type', 'image/jpeg'),
                "data": media.get('data')
            }
        })
        
    data = {
        "contents": [{"parts": parts}],
        "generationConfig": {
            "temperature": 0.2,
            "topP": 0.8,
            "maxOutputTokens": 2048
        }
    }

    # Correct placement for System Instruction
    if system_instruction:
        data["system_instruction"] = {
            "parts": [{"text": system_instruction}]
        }

    # Set response format to JSON if requested
    if "json" in prompt.lower() or (system_instruction and "json" in system_instruction.lower()):
        data["generationConfig"]["response_mime_type"] = "application/json"
    
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
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
        print(f"Gemini API Error ({e.code}): {error_body}")
        try:
            err_json = json.loads(error_body)
            msg = err_json.get('error', {}).get('message', error_body)
            raise Exception(f"Gemini API ({e.code}): {msg}")
        except:
            raise Exception(f"Gemini API ({e.code}): {error_body}")
    except Exception as e:
        print(f"Gemini Call Failed: {str(e)}")
        raise e

def handle_chat(event, headers):
    """
    汎用チャットエンドポイント
    営業モードの店舗査定（AIスコアリング）などで使用
    
    リクエストボディ:
    {
        "message": "ユーザーメッセージ",
        "image": "base64エンコードされた画像データ（オプション）",
        "system_prompt": "システムプロンプト（オプション）",
        "response_format": "json" or "text"
    }
    """
    try:
        body = json.loads(event.get('body') or '{}')
        message = body.get('message', '')
        image_data = body.get('image')  # Base64 encoded
        system_prompt = body.get('system_prompt', '')
        response_format = body.get('response_format', 'text')
        
        if not message:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'message is required'}, ensure_ascii=False)
            }
        
        # メディアデータの準備
        media = None
        if image_data:
            # Base64データの先頭にdata:image/...が含まれている場合は除去
            if ',' in image_data:
                image_data = image_data.split(',')[1]
            media = {
                'mime_type': 'image/jpeg',
                'data': image_data
            }
        
        # システムプロンプトの構築
        full_system_prompt = system_prompt if system_prompt else """あなたはMISESAPO AI System『MISOGI』です。
ユーザーからの質問やリクエストに対して、的確かつ丁寧に応答してください。
画像が添付されている場合は、その画像を詳細に分析してください。"""
        
        # JSON形式での応答が要求されている場合
        if response_format == 'json':
            if 'json' not in full_system_prompt.lower():
                full_system_prompt += "\n\n必ずJSON形式で応答してください。"
        
        # Gemini APIを呼び出し
        result = call_gemini_api(message, full_system_prompt, media)
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'success',
                'response': result
            }, ensure_ascii=False)
        }
        
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"ERROR in handle_chat: {str(e)}")
        print(f"Traceback: {error_detail}")
        
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': 'CHAT_FAILED',
                'message': str(e),
                'debug': error_detail[:300]
            }, ensure_ascii=False)
        }

def handle_ai_process(event, headers):
    """
    AI処理のエンドポイント。Cognito ID トークン検証必須。
    """
    try:
        # 認証必須: Cognito ID トークン
        auth_header = _get_auth_header(event)
        if not auth_header or not auth_header.startswith('Bearer '):
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': 'Unauthorized', 'message': 'Authorization: Bearer <id_token> が必要です'}, ensure_ascii=False)
            }
        id_token = auth_header.replace('Bearer ', '').strip()
        user_info = verify_cognito_id_token(id_token)
        if not user_info or not user_info.get('verified'):
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': 'Unauthorized', 'message': 'トークンが無効または期限切れです'}, ensure_ascii=False)
            }

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
            clean_mime = 'audio/wav'
            if mime_type:
                target = mime_type.lower()
                if 'webm' in target: clean_mime = 'audio/webm'
                elif 'mp4' in target or 'mpeg' in target or 'aac' in target: clean_mime = 'audio/aac'
                elif 'ogg' in target: clean_mime = 'audio/ogg'
            
            media = {'mime_type': clean_mime, 'data': audio_data}
            if not input_text: input_text = "音声の内容を解析してください。"

        # Priority 2: Image Input (if no audio)
        elif image_data:
            clean_mime = 'image/jpeg'
            if image_mime:
                target = image_mime.lower()
                if 'png' in target: clean_mime = 'image/png'
                elif 'webp' in target: clean_mime = 'image/webp'
                elif 'heic' in target: clean_mime = 'image/heic'
                elif 'heif' in target: clean_mime = 'image/heif'
            
            media = {'mime_type': clean_mime, 'data': image_data}
            if not input_text: input_text = "この画像を解析してください。"

        allowed_actions = {'suggest_request_form', 'suggest_estimate', 'schedule_assistant'}
        if action not in allowed_actions:
            return {
                'statusCode': 403,
                'headers': headers,
                'body': json.dumps({
                    'error': 'action_disabled',
                    'message': f'Action disabled for line system: {action}'
                }, ensure_ascii=False)
            }

        # schedule_assistant: 選択スケジュール・rollingDays・visible schedules を context に重複・過密・事前連絡期限・注意事項要約を返す
        if action == 'schedule_assistant':
            selected_schedule = body.get('selected_schedule') or body.get('selectedSchedule')
            rolling_days = body.get('rolling_days') or body.get('rollingDays') or []
            visible_schedules = body.get('visible_schedules') or body.get('visibleSchedules') or []
            context_text = json.dumps({
                'selected_schedule': selected_schedule,
                'rolling_days': rolling_days,
                'visible_schedules': visible_schedules
            }, ensure_ascii=False, indent=2)
            system_instruction = """あなたは和風の守護霊のような存在です。断定せず、静かに助言する口調で話してください。

入力は selected_schedule（選択中の案件）、rolling_days（表示中の日付リスト）、visible_schedules（表示中の全案件リスト）のJSONです。

以下の4項目を必ず含むJSONのみで答えてください。余計な文章は書かないこと。
- overlaps: 重複している案件があれば簡潔に説明（配列または文字列）。なければ空配列または「なし」
- congestion: 過密（同じ担当・同日に詰まり）があれば簡潔に説明。なければ「なし」
- contact_deadline: 事前連絡の期限に注意が必要な案件があれば説明。なければ「なし」
- notes_summary: 注意事項の要約（1〜3文、和風守護霊調で）。特になければ「特になし」
- status: 状態を "normal" / "warning" / "danger" のいずれかで返す（通常/注意/危険）
- message: 和風守護霊調の短いメッセージ（1〜2文）。断定せず、静かな助言として。
出力はJSONのみ。"""
            result_text = call_gemini_api(f"スケジュールcontext:\n{context_text}", system_instruction, None)
            payload = _extract_json_payload(result_text)
            # schedule_assistant は sales schema で検証しない
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({'status': 'success', 'result': payload}, ensure_ascii=False)
            }

        if action == 'suggest_request_form':
            system_instruction = """営業報告から作業依頼書の構造化JSONを抽出してください。
出力はJSONのみ。余計な文章は書かないこと。"""
            result_text = call_gemini_api(f"解析対象:\n{input_text}", system_instruction, media)
        else:
            # suggest_estimate
            system_instruction = """営業報告から見積に必要な情報を構造化JSONで抽出してください。
出力はJSONのみ。余計な文章は書かないこと。"""
            result_text = call_gemini_api(f"解析対象:\n{input_text}", system_instruction, media)

        payload = _extract_json_payload(result_text)
        valid, reason = _validate_sales_schema(action, payload)
        if not valid:
            return {
                'statusCode': 422,
                'headers': headers,
                'body': json.dumps({
                    'error': 'invalid_ai_output',
                    'reason': reason,
                    'raw': result_text
                }, ensure_ascii=False)
            }

        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'status': 'success', 'result': payload}, ensure_ascii=False)
        }
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        print(f"ERROR in handle_ai_process: {str(e)}")
        
        # エラーメッセージを最前面のmessageフィールドに配置し、ブラウザで見やすくする
        return {
            'statusCode': 400,
            'headers': headers,
            'body': json.dumps({
                'error': 'AI_PROCESS_FAILED',
                'message': str(e),
                'debug': error_detail[:300]
            }, ensure_ascii=False)
        }

def handle_extract_store_info(event, headers):
    """
    URLや店名/電話番号から店舗情報を抽出する
    """
    try:
        body = json.loads(event.get('body') or '{}')
        target_url = body.get('url') or ''
        name = body.get('name') or ''
        phone = body.get('phone') or ''
        query = body.get('query') or ''

        if target_url and not re.match(r'^https?://', target_url):
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'invalid_url'}, ensure_ascii=False)
            }

        if not target_url:
            search_query = query or f"{name} {phone}".strip()
            if not search_query:
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({'error': 'url or query is required'}, ensure_ascii=False)
                }
            target_url = search_url_with_cse(search_query)

        if not target_url:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({'error': 'no_url_found'}, ensure_ascii=False)
            }

        info = extract_store_info_from_url(target_url)
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'url': target_url,
                'data': info
            }, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Extract Store Info Error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'extract_failed', 'message': str(e)}, ensure_ascii=False)
        }

def search_url_with_cse(query):
    api_key = os.environ.get('GOOGLE_CSE_API_KEY')
    cx = os.environ.get('GOOGLE_CSE_CX')
    if not api_key or not cx:
        print("Google CSE key/cx not configured")
        return None

    params = {
        'key': api_key,
        'cx': cx,
        'q': query
    }
    url = 'https://www.googleapis.com/customsearch/v1?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode('utf-8'))

    items = data.get('items') or []
    if not items:
        return None

    preferred = ['tabelog.com']
    for item in items:
        link = item.get('link') or ''
        if any(domain in link for domain in preferred):
            return link

    return items[0].get('link')

def extract_store_info_from_url(url):
    html_text = fetch_html_text(url)

    info = extract_store_info_from_html(html_text)

    if not info.get('name') and 'tabelog.com' in url:
        jina_text = fetch_jina_text(url)
        if jina_text:
            info = extract_store_info_from_tabelog_markdown(jina_text, info)

    return info

def fetch_html_text(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return resp.read().decode('utf-8', errors='ignore')

def extract_store_info_from_html(html_text):
    jsonld_blocks = re.findall(r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html_text, re.S | re.I)
    parsed_blocks = []
    for block in jsonld_blocks:
        block = block.strip()
        try:
            parsed = json.loads(block)
            parsed_blocks.append(parsed)
        except Exception:
            continue

    restaurant = None
    faq = None
    for block in parsed_blocks:
        if isinstance(block, list):
            for item in block:
                if isinstance(item, dict) and item.get('@type') == 'Restaurant':
                    restaurant = item
        elif isinstance(block, dict):
            if block.get('@type') == 'Restaurant':
                restaurant = block
            if block.get('@type') == 'FAQPage':
                faq = block

    name = (restaurant or {}).get('name', '')
    telephone = (restaurant or {}).get('telephone', '')
    address_obj = (restaurant or {}).get('address', {}) if isinstance((restaurant or {}).get('address', {}), dict) else {}
    address = ''.join([
        address_obj.get('addressRegion', ''),
        address_obj.get('addressLocality', ''),
        address_obj.get('streetAddress', '')
    ])
    postal_code = address_obj.get('postalCode', '')
    geo = (restaurant or {}).get('geo', {}) if isinstance((restaurant or {}).get('geo', {}), dict) else {}
    latitude = geo.get('latitude', '')
    longitude = geo.get('longitude', '')
    cuisine = (restaurant or {}).get('servesCuisine', '')
    price_range = (restaurant or {}).get('priceRange', '')

    opening_hours = extract_faq_answer(faq, '営業時間')
    access = extract_faq_answer(faq, 'アクセス')
    parking = extract_faq_answer(faq, '駐車場')
    private_room = extract_faq_answer(faq, '個室')

    return {
        'name': name,
        'address': address,
        'postal_code': postal_code,
        'telephone': telephone,
        'opening_hours': opening_hours,
        'access': access,
        'parking': normalize_yes_no(parking),
        'private_room': normalize_yes_no(private_room),
        'latitude': latitude,
        'longitude': longitude,
        'cuisine': cuisine,
        'price_range': price_range
    }

def fetch_jina_text(url):
    # Jina AIのReader APIを使用してWebページをMarkdown形式で取得
    # URLをそのまま渡す（https:// または http://）
    jina_url = f"https://r.jina.ai/{url}"
    try:
        req = urllib.request.Request(jina_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=20) as resp:
            return resp.read().decode('utf-8', errors='ignore')
    except Exception as e:
        print(f"Jina fetch failed: {str(e)}")
        return ''

def extract_store_info_from_tabelog_markdown(text, fallback):
    if not text:
        return fallback or {}

    def find_row(label):
        match = re.search(rf'\|\s*{re.escape(label)}\s*\|\s*(.+?)\s*\|', text)
        if not match:
            return ''
        value = match.group(1) or ''
        value = re.sub(r'!\[[^\]]*\]\([^\)]*\)', '', value)
        value = re.sub(r'\[\]\([^\)]*\)', '', value)
        value = re.sub(r'\[([^\]]+)\]\([^\)]*\)', r'\1', value)
        value = value.replace('**', '').replace('_', '').replace('*', '')
        value = re.sub(r'\s+', ' ', value).strip()
        return value

    def truncate_note(value):
        for marker in ['大きな地図を見る', '周辺のお店を探す', '利用金額分布を見る']:
            if marker in value:
                value = value.split(marker)[0].strip()
        return value

    name = find_row('店名') or fallback.get('name', '')
    telephone = find_row('お問い合わせ') or fallback.get('telephone', '')
    address = truncate_note(find_row('住所') or fallback.get('address', ''))
    access = find_row('交通手段') or fallback.get('access', '')
    opening_hours = find_row('営業時間') or fallback.get('opening_hours', '')
    cuisine = find_row('ジャンル') or fallback.get('cuisine', '')
    price_range = truncate_note(find_row('予算（口コミ集計）') or fallback.get('price_range', ''))
    parking = find_row('駐車場') or fallback.get('parking', '不明')
    private_room = find_row('個室') or fallback.get('private_room', '不明')

    return {
        'name': name,
        'address': address,
        'postal_code': fallback.get('postal_code', ''),
        'telephone': telephone,
        'opening_hours': opening_hours,
        'access': access,
        'parking': normalize_yes_no(parking),
        'private_room': normalize_yes_no(private_room),
        'latitude': fallback.get('latitude', ''),
        'longitude': fallback.get('longitude', ''),
        'cuisine': cuisine,
        'price_range': price_range
    }

def extract_faq_answer(faq_block, keyword):
    if not faq_block:
        return ''
    entities = faq_block.get('mainEntity') or []
    for entity in entities:
        if not isinstance(entity, dict):
            continue
        question = entity.get('name', '')
        if keyword in question:
            answer = (entity.get('acceptedAnswer') or {}).get('text', '')
            return strip_html(answer)
    return ''

def strip_html(text):
    if not text:
        return ''
    clean = re.sub(r'<[^>]+>', '', text)
    clean = html.unescape(clean)
    return clean.strip()

def normalize_yes_no(text):
    if not text:
        return '不明'
    if 'なし' in text:
        return 'なし'
    if 'あり' in text:
        return 'あり'
    return text


# ===== 店舗査定（Store Audit）関連の関数 =====

def get_store_audits(event, headers):
    """
    店舗査定一覧を取得
    クエリパラメータ:
      - store_id: 特定店舗の査定のみ取得
      - type: 'before' または 'after'
      - limit: 取得件数の上限
    """
    try:
        query_params = event.get('queryStringParameters') or {}
        store_id = query_params.get('store_id')
        audit_type = query_params.get('type')
        limit = int(query_params.get('limit', 100))

        # フィルター条件を構築
        filter_expression = None
        expression_attribute_values = {}

        if store_id:
            filter_expression = Attr('store_id').eq(store_id)
            expression_attribute_values[':store_id'] = store_id

        if audit_type:
            type_filter = Attr('type').eq(audit_type)
            if filter_expression:
                filter_expression = filter_expression & type_filter
            else:
                filter_expression = type_filter
            expression_attribute_values[':type'] = audit_type

        # スキャン実行
        scan_params = {'Limit': limit}
        if filter_expression:
            scan_params['FilterExpression'] = filter_expression

        response = STORE_AUDITS_TABLE.scan(**scan_params)
        items = response.get('Items', [])

        # Decimalを変換
        items = json.loads(json.dumps(items, default=str))

        # 日付でソート（新しい順）
        items.sort(key=lambda x: x.get('created_at', ''), reverse=True)

        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'audits': items,
                'count': len(items)
            }, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error getting store audits: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': str(e)}, ensure_ascii=False)
        }


def create_store_audit(event, headers):
    """
    店舗査定を作成
    リクエストボディ:
      - store_id: 店舗ID
      - store_name: 店舗名
      - type: 'before' または 'after'
      - total_score: 総合スコア (0-100)
      - total_rank: 総合ランク (A/B/C)
      - location_results: 箇所別の査定結果リスト
      - auditor_id: 査定者ID
      - auditor_name: 査定者名
    """
    try:
        body = json.loads(event.get('body', '{}'))

        # IDを生成（AUD-YYYYMMDD-NNN形式）
        now = datetime.utcnow()
        date_prefix = now.strftime('%Y%m%d')
        
        # その日の最大連番を取得
        prefix = f"AUD-{date_prefix}-"
        try:
            response = STORE_AUDITS_TABLE.scan(
                FilterExpression=Attr('id').begins_with(prefix),
                ProjectionExpression='id'
            )
            max_seq = 0
            for item in response.get('Items', []):
                audit_id = item.get('id', '')
                if audit_id.startswith(prefix):
                    seq_str = audit_id[len(prefix):]
                    try:
                        seq = int(seq_str)
                        if seq > max_seq:
                            max_seq = seq
                    except:
                        pass
            next_seq = max_seq + 1
        except:
            next_seq = 1

        audit_id = f"AUD-{date_prefix}-{str(next_seq).zfill(3)}"

        # 査定データを構築
        audit_item = {
            'id': audit_id,
            'store_id': body.get('store_id', ''),
            'store_name': body.get('store_name', ''),
            'type': body.get('type', 'before'),
            'total_score': body.get('total_score', 0),
            'total_rank': body.get('total_rank', 'B'),
            'location_results': body.get('location_results', []),
            'auditor_id': body.get('auditor_id', ''),
            'auditor_name': body.get('auditor_name', ''),
            'cycle': body.get('cycle', 1),
            'created_at': now.isoformat() + 'Z',
            'updated_at': now.isoformat() + 'Z'
        }

        # Decimalに変換（DynamoDB対応）
        audit_item = json.loads(json.dumps(audit_item), parse_float=Decimal)

        # DynamoDBに保存
        STORE_AUDITS_TABLE.put_item(Item=audit_item)

        return {
            'statusCode': 201,
            'headers': headers,
            'body': json.dumps({
                'message': '査定データを保存しました',
                'audit_id': audit_id,
                'audit': json.loads(json.dumps(audit_item, default=str))
            }, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error creating store audit: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': str(e)}, ensure_ascii=False)
        }


def get_store_audit_detail(audit_id, headers):
    """
    店舗査定詳細を取得
    """
    try:
        response = STORE_AUDITS_TABLE.get_item(Key={'id': audit_id})
        item = response.get('Item')

        if not item:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({'error': '査定データが見つかりません'}, ensure_ascii=False)
            }

        # Decimalを変換
        item = json.loads(json.dumps(item, default=str))

        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'audit': item}, ensure_ascii=False)
        }
    except Exception as e:
        print(f"Error getting store audit detail: {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': str(e)}, ensure_ascii=False)
        }


# ============================================================================
# ライン機能（チケットB）
# ============================================================================

# LINE_REPORTS_TABLEはstaff-reportsと共用（status: 'in_progress', 'pending_approval', 'passed'で区別）

def get_line_status(event, headers):
    """
    当日のラインステータスを取得
    GET /line/status?worker_id={id}&date={YYYY-MM-DD}
    
    Returns:
        status: 'in_progress' | 'pending_approval' | 'none'
        report_id: string | null
    """
    try:
        query_params = event.get('queryStringParameters') or {}
        worker_id = query_params.get('worker_id')
        date_str = query_params.get('date') or datetime.utcnow().strftime('%Y-%m-%d')
        
        if not worker_id:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'worker_id is required'}, ensure_ascii=False)
            }
        
        # 当日のライン対象レポートを検索
        response = REPORTS_TABLE.scan(
            FilterExpression=Attr('staff_id').eq(worker_id) & 
                           Attr('cleaning_date').eq(date_str) &
                           Attr('line_mode').eq(True)
        )
        
        items = response.get('Items', [])
        
        # 最新のレポートを取得
        if items:
            # created_atでソート
            items.sort(key=lambda x: x.get('created_at', ''), reverse=True)
            latest = items[0]
            status = latest.get('status', 'none')
            
            # ステータスをマッピング
            if status == 'in_progress':
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({
                        'status': 'in_progress',
                        'report_id': latest.get('report_id')
                    }, ensure_ascii=False)
                }
            elif status == 'pending_approval':
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({
                        'status': 'pending_approval',
                        'report_id': latest.get('report_id')
                    }, ensure_ascii=False)
                }
        
        # レポートがないか、完了済み
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'none',
                'report_id': None
            }, ensure_ascii=False)
        }
        
    except Exception as e:
        print(f"Error getting line status: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': str(e)}, ensure_ascii=False)
        }


def handle_line_pass(event, headers):
    """
    ライン通過処理
    POST /line/pass
    
    Request body:
        process_id: string (工程ID = スケジュールID)
        worker_id: string
        check_results: [{item_id: string, passed: bool}]
        is_exception: bool
        reason_code: string | null (例外時は必須)
    
    Response:
        status: 'passed' | 'pending_approval'
        certificate_id: string (通常時のみ)
        approval_request_id: string (例外時のみ)
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
        
        process_id = body_json.get('process_id')
        worker_id = body_json.get('worker_id')
        check_results = body_json.get('check_results', [])
        is_exception = body_json.get('is_exception', False)
        reason_code = body_json.get('reason_code')
        
        # 必須パラメータチェック
        if not process_id:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'process_id is required'}, ensure_ascii=False)
            }
        
        if not worker_id:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'worker_id is required'}, ensure_ascii=False)
            }
        
        # 例外時はreason_code必須
        if is_exception and not reason_code:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'reason_code is required for exceptions'}, ensure_ascii=False)
            }
        
        # ========================================
        # 範囲チェック: 工程の許可リストと照合
        # ========================================
        
        # 1. スケジュール（工程）を取得
        schedule_response = SCHEDULES_TABLE.get_item(Key={'id': process_id})
        schedule = schedule_response.get('Item')
        
        if not schedule:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': 'out_of_scope',
                    'message': '指定された工程が見つかりません',
                    'invalid_process_id': process_id
                }, ensure_ascii=False)
            }
        
        # 2. 許可されたitem_idリストを取得
        cleaning_items = schedule.get('cleaning_items', [])
        allowed_item_ids = set()
        for item in cleaning_items:
            item_id = item.get('item_id') or item.get('id') or item.get('name')
            if item_id:
                allowed_item_ids.add(str(item_id))
        
        # 3. リクエストのitem_idを検証
        invalid_items = []
        for check in check_results:
            item_id = str(check.get('item_id', ''))
            if item_id and item_id not in allowed_item_ids:
                invalid_items.append(item_id)
        
        # 1件でも範囲外があれば400
        if invalid_items:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'error': 'out_of_scope',
                    'message': '指定された項目は工程定義に含まれていません',
                    'invalid_items': invalid_items
                }, ensure_ascii=False)
            }
        
        # ========================================
        # レポート作成
        # ========================================
        
        now = datetime.utcnow().isoformat() + 'Z'
        today = datetime.utcnow().strftime('%Y-%m-%d')
        report_id = f"LINE-{uuid.uuid4().hex[:12]}"
        
        report_item = {
            'report_id': report_id,
            'staff_id': worker_id,
            'cleaning_date': today,
            'store_id': schedule.get('store_id', ''),
            'store_name': schedule.get('store_name', ''),
            'process_id': process_id,
            'check_results': check_results,
            'is_exception': is_exception,
            'reason_code': reason_code if is_exception else None,
            'line_mode': True,
            'created_at': now,
            'updated_at': now
        }
        
        if is_exception:
            # 例外: 承認待ち
            report_item['status'] = 'pending_approval'
            
            # スナップショットを保存
            snapshot_json = json.dumps(report_item, ensure_ascii=False, sort_keys=True, default=str)
            snapshot_hash = hashlib.sha256(snapshot_json.encode('utf-8')).hexdigest()
            report_item['snapshot_hash'] = snapshot_hash
            
            REPORTS_TABLE.put_item(Item=report_item)
            
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({
                    'status': 'pending_approval',
                    'approval_request_id': report_id,
                    'message': '承認待ちです'
                }, ensure_ascii=False)
            }
        else:
            # 通常: 即時通過・証明生成
            report_item['status'] = 'passed'
            
            # 実施証明IDを生成
            cert_date = datetime.utcnow().strftime('%Y%m%d')
            certificate_id = f"CERT-{cert_date}-{uuid.uuid4().hex[:8].upper()}"
            report_item['certificate_id'] = certificate_id
            report_item['passed_at'] = now
            
            REPORTS_TABLE.put_item(Item=report_item)
            
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({
                    'status': 'passed',
                    'certificate_id': certificate_id,
                    'message': '工程を通過しました'
                }, ensure_ascii=False)
            }
        
    except Exception as e:
        print(f"Error handling line pass: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'error': '通過処理に失敗しました',
                'message': str(e)
            }, ensure_ascii=False)
        }

# --- Master Data CRUD Handlers ---

def get_master_table(collection):
    if collection == 'torihikisaki': return TORIHIKISAKI_TABLE
    if collection == 'yagou': return YAGOU_TABLE
    if collection == 'tenpo': return TENPO_TABLE
    if collection == 'souko': return SOUKO_TABLE
    return None

def handle_master_crud(collection, record_id, event, headers):
    method = event.get('httpMethod')
    table = get_master_table(collection)
    pk_name = f"{collection}_id"
    
    try:
        # Authorization check (Admins only for master data)
        user_info = _get_user_info_from_event(event)
        if not user_info:
            return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Unauthorized'}, ensure_ascii=False)}
        
        role = user_info.get('role')
        if not _is_master_role(role):
            return {'statusCode': 403, 'headers': headers, 'body': json.dumps({'error': 'Forbidden'}, ensure_ascii=False)}

        if method == 'GET':
            if record_id:
                # 詳細取得
                res = table.get_item(Key={pk_name: record_id})
                item = res.get('Item')
                if not item:
                    return {'statusCode': 404, 'headers': headers, 'body': json.dumps({'error': 'Not found'}, ensure_ascii=False)}
                return {'statusCode': 200, 'headers': headers, 'body': json.dumps(item, ensure_ascii=False, default=str)}
            else:
                # 一覧取得（絞り込み対応）
                q_params = event.get('queryStringParameters') or {}
                jotai_filter = q_params.get('jotai', 'yuko') # デフォルトは有効のみ
                
                # 親IDでの絞り込み
                filter_expr = Attr('jotai').eq(jotai_filter)
                
                query_key = None
                index_name = None
                
                if collection == 'yagou' and 'torihikisaki_id' in q_params:
                    index_name = 'torihikisaki_index'
                    query_key = Key('torihikisaki_id').eq(q_params['torihikisaki_id'])
                elif collection == 'tenpo':
                    if 'yagou_id' in q_params:
                        index_name = 'yagou_index'
                        query_key = Key('yagou_id').eq(q_params['yagou_id'])
                    elif 'torihikisaki_id' in q_params:
                        index_name = 'torihikisaki_index'
                        query_key = Key('torihikisaki_id').eq(q_params['torihikisaki_id'])
                elif collection == 'souko' and 'tenpo_id' in q_params:
                    index_name = 'tenpo_index'
                    query_key = Key('tenpo_id').eq(q_params['tenpo_id'])
                
                if query_key and index_name:
                    res = table.query(
                        IndexName=index_name,
                        KeyConditionExpression=query_key,
                        FilterExpression=filter_expr
                    )
                else:
                    res = table.scan(FilterExpression=filter_expr)
                
                return {
                    'statusCode': 200, 
                    'headers': headers, 
                    'body': json.dumps({'items': res.get('Items', [])}, ensure_ascii=False, default=str)
                }
                
        elif method in ['POST', 'PUT']:
            body = json.loads(event.get('body') or '{}')
            now = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
            
            if method == 'POST':
                # 新規作成
                new_id = body.get(pk_name) or str(uuid.uuid4())
                item = {
                    pk_name: new_id,
                    'name': body.get('name', ''),
                    'jotai': 'yuko',
                    'created_at': now,
                    'updated_at': now
                }
                # 追加フィールドをマージ
                for k, v in body.items():
                    if k not in item:
                        item[k] = v
                
                table.put_item(Item=item)
                return {'statusCode': 201, 'headers': headers, 'body': json.dumps(item, ensure_ascii=False, default=str)}
            
            else: # PUT
                if not record_id:
                    return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Missing ID'}, ensure_ascii=False)}
                
                update_expr = "SET updated_at = :now"
                attr_values = {":now": now}
                attr_names = {}
                
                idx = 0
                for k, v in body.items():
                    if k == pk_name: continue
                    clean_k = f"#f{idx}"
                    attr_names[clean_k] = k
                    update_expr += f", {clean_k} = :v{idx}"
                    attr_values[f":v{idx}"] = v
                    idx += 1
                
                if not attr_names: # 更新対象がない場合
                    return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'message': 'No changes'}, ensure_ascii=False)}

                table.update_item(
                    Key={pk_name: record_id},
                    UpdateExpression=update_expr,
                    ExpressionAttributeNames=attr_names,
                    ExpressionAttributeValues=attr_values
                )
                return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'message': 'Updated'}, ensure_ascii=False)}

        elif method == 'DELETE':
            if not record_id:
                return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Missing ID'}, ensure_ascii=False)}
            
            # 論理削除
            now = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
            table.update_item(
                Key={pk_name: record_id},
                UpdateExpression="SET jotai = :j, updated_at = :now",
                ExpressionAttributeValues={":j": "torikeshi", ":now": now}
            )
            return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'message': 'Deleted (logical)'}, ensure_ascii=False)}

    except Exception as e:
        traceback.print_exc()
        return {'statusCode': 500, 'headers': headers, 'body': json.dumps({'error': str(e)}, ensure_ascii=False)}
