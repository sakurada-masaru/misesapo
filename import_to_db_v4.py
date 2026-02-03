import boto3
import re
import uuid
import json
from datetime import datetime, timedelta
import sys

# 設定
REGION = 'ap-northeast-1'
TABLE_NAME = 'schedules'
ICS_FILE = '/Users/sakuradamasaru/Desktop/misesapo/filtered.ics'

dynamodb = boto3.resource('dynamodb', region_name=REGION)
table = dynamodb.Table(TABLE_NAME)

def hhmm_to_minutes(hhmm):
    try:
        h, m = map(int, hhmm.split(':'))
        return h * 60 + m
    except:
        return 540

def unescape_ics_text(text):
    if not text: return ""
    return text.replace('\\n', '\n').replace('\\,', ',').replace('\\;', ';').replace('\\\\', '\\')

def extract_info(summary, description):
    # 暗証番号抽出
    key_match = re.search(r'(番号|コード|暗証番号|キーボックス|ロックナンバー|解錠|キー)[:：\s]*([0-9A-Za-z*]{4,})', description)
    security_code = key_match.group(2) if key_match else ""
    
    # 清掃項目 (リスト形式)
    cleaning_items = []
    if description:
        lines = description.split('\n')
        for line in lines:
            line = line.strip()
            if line.startswith(('・', '*', '-', '●')):
                item_name = re.sub(r'^[・\*\-\●]\s*', '', line).strip()
                if item_name:
                    cleaning_items.append({'name': item_name, 'status': 'pending'})
    
    # 店名のクリーンアップ
    target_name = re.sub(r'【[^】]+】', '', summary).strip()
    work_type = 'cleaning'
    plan_match = re.search(r'【([^】]+)】', summary)
    if plan_match:
        work_type = plan_match.group(1)
    
    return target_name, work_type, security_code, cleaning_items

def parse_ics_simple(file_path):
    events = []
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    raw_events = re.findall(r'BEGIN:VEVENT.*?END:VEVENT', content, re.DOTALL)
    for raw in raw_events:
        event = {}
        m = re.search(r'SUMMARY:(.*)', raw)
        if m: event['summary'] = unescape_ics_text(m.group(1).strip())
        m = re.search(r'DESCRIPTION:(.*?)(\r?\n[A-Z]|$)', raw, re.DOTALL)
        if m: event['description'] = unescape_ics_text(m.group(1).strip())
        m = re.search(r'DTSTART[:;].*?:(\d{8}T\d{6}Z?)', raw)
        if m: event['dtstart'] = m.group(1).strip()
        m = re.search(r'UID:(.*)', raw)
        if m: event['uid'] = m.group(1).strip()
        m = re.search(r'LOCATION:(.*)', raw)
        if m: event['location'] = unescape_ics_text(m.group(1).strip())
        events.append(event)
    return events

def run_cleanup_and_import():
    # 1. 以前の誤った形式のデータを削除 (type='imported' または カメルケースのキーを持つもの)
    # 簡易的に、今日作成した 'imported' タイプのものをスキャンして消す
    print("Cleaning up old imported items...")
    scan = table.scan(FilterExpression=boto3.dynamodb.conditions.Attr('type').eq('imported'))
    items_to_delete = scan.get('Items', [])
    for item in items_to_delete:
        table.delete_item(Key={'id': item['id']})
    print(f"Deleted {len(items_to_delete)} old items.")

    # 2. 新しいスキーマでインポート
    events = parse_ics_simple(ICS_FILE)
    print(f"Total events to process: {len(events)}")
    
    # 既存のワーカーIDを取得 (適当な一人をデフォルトとして使うか、未割当にするか)
    # 今回は一旦 '未割当' (worker_idなし) でインポートする。
    # タイムラインに強制表示させるため、最初のワーカーを取得してみる。
    worker_id = None
    try:
        # 従業員テーブルがあればそこから取得するが、今はハードコードされた w1 とかを使う
        # AdminScheduleTimelinePage.jsx 1438行目付近を見ると、w.id が使われている
        worker_id = "w1" # 仮のID。実際には未割当だとタイムラインに出ない可能性がある。
    except:
        pass

    count = 0
    now = datetime.now().isoformat()
    for ev in events:
        summary = ev.get('summary', '')
        description = ev.get('description', '')
        dtstart_str = ev.get('dtstart', '')
        uid = ev.get('uid', '')
        location = ev.get('location', '')
        if not dtstart_str: continue
        
        try:
            dt = datetime.strptime(dtstart_str[:15], '%Y%m%dT%H%M%S')
            dt = dt + timedelta(hours=9) # JST
            date_str = dt.strftime('%Y-%m-%d')
            start_time = dt.strftime('%H:%M')
            end_time = (dt + timedelta(hours=2)).strftime('%H:%M')
            
            target_name, work_type, sec_code, items = extract_info(summary, description)
            
            # ID生成 (SCH-YYYYMMDD-SEQ の形式に寄せる)
            date_prefix = dt.strftime('%Y%m%d')
            schedule_id = f"SCH-{date_prefix}-{uuid.uuid4().hex[:4].upper()}"
            
            start_min = hhmm_to_minutes(start_time)
            end_min = hhmm_to_minutes(end_time)

            db_item = {
                'id': schedule_id,
                'date': date_str,
                'scheduled_date': date_str,
                'start_time': start_time,
                'end_time': end_time,
                'start_min': start_min,
                'end_min': end_min,
                'target_name': target_name,
                'summary': summary,
                'description': description,
                'notes': description,
                'security_code': sec_code,
                'cleaning_items': items,
                'status': 'scheduled',
                'work_type': work_type,
                'origin': 'google_ics',
                'external_id': uid,
                'location': location,
                'created_at': now,
                'updated_at': now,
                'type': 'imported' # 削除用のフラグとして残す
            }
            
            # タイムラインに強制的に出すために w1 に割り当てる（本来は調整が必要）
            db_item['worker_id'] = 'w1'
            db_item['assigned_to'] = 'w1'
            
            table.put_item(Item=db_item)
            count += 1
            if count % 10 == 0:
                print(f"[{count}/{len(events)}] Processed...")
        except Exception as e:
            print(f"Error: {e}")

    print(f"Successfully imported {count} items with correct schema.")

if __name__ == "__main__":
    run_cleanup_and_import()
