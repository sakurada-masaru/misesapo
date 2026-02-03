import json
import boto3
import re
import urllib.request
from datetime import datetime
from boto3.dynamodb.conditions import Attr

# --- DynamoDB Table Names ---
SCHEDULES_TABLE_NAME = 'schedules'
STORES_TABLE_NAME = 'misesapo-stores'
WORKERS_TABLE_NAME = 'workers'

# --- Initialize Resources ---
dynamodb = boto3.resource('dynamodb', region_name='ap-northeast-1')
SCHEDULES_TABLE = dynamodb.Table(SCHEDULES_TABLE_NAME)
STORES_TABLE = dynamodb.Table(STORES_TABLE_NAME)
WORKERS_TABLE = dynamodb.Table(WORKERS_TABLE_NAME)

def unescape_ics_text(text):
    if not text: return ""
    return text.replace('\\,', ',').replace('\\;', ';').replace('\\n', '\n').replace('\\\\', '\\')

def parse_ics_datetime(value):
    """
    ICSの日時形式をdatetimeオブジェクトに変換
    例: 20211015T230000Z, 20250618T100000, 20250618
    """
    if not value: return None
    value = value.strip()
    try:
        if 'T' in value:
            # 時刻あり (UTC or TZID)
            # ZがあればUTC、なければローカル（JST前提で扱う）
            clean_val = value.replace('Z', '')
            dt = datetime.strptime(clean_val[:15], '%Y%m%dT%H%M%S')
            return dt
        else:
            # 日付のみ
            return datetime.strptime(value[:8], '%Y%m%d')
    except:
        return None

def parse_ics_content(ics_content, from_date=None, to_date=None):
    events = []
    current_event = {}
    in_vevent = False
    
    from_dt = datetime.strptime(from_date, '%Y-%m-%d') if from_date else None
    to_dt = datetime.strptime(to_date, '%Y-%m-%d') if to_date else None
    
    lines = ics_content.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i].replace('\r', '').strip()
        if not line:
            i += 1
            continue
            
        if line == 'BEGIN:VEVENT':
            in_vevent = True
            current_event = {}
            i += 1
            continue
        
        if line == 'END:VEVENT':
            if in_vevent and current_event.get('uid'):
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
                        events.append(current_event)
                    except:
                        pass
            in_vevent = False
            i += 1
            continue
        
        if in_vevent and (':' in line or ';' in line):
            # 継続行の結合
            full_line = line
            j = i + 1
            while j < len(lines) and (lines[j].startswith(' ') or lines[j].startswith('\t')):
                full_line += lines[j][1:].replace('\r', '')
                j += 1
            i = j - 1
            
            # Key:Value または Key;Params:Value
            if ':' in full_line:
                parts = full_line.split(':', 1)
                key_part = parts[0].split(';')[0]
                value = parts[1]
                
                if key_part == 'DTSTART':
                    dt = parse_ics_datetime(value)
                    if dt:
                        current_event['date'] = dt.strftime('%Y-%m-%d')
                        current_event['start_time'] = dt.strftime('%H:%M')
                        current_event['start_min'] = dt.hour * 60 + dt.minute
                elif key_part == 'DTEND':
                    dt = parse_ics_datetime(value)
                    if dt:
                        current_event['end_time'] = dt.strftime('%H:%M')
                        current_event['end_min'] = dt.hour * 60 + dt.minute
                elif key_part == 'UID':
                    current_event['uid'] = value.strip()
                elif key_part == 'SUMMARY':
                    current_event['summary'] = unescape_ics_text(value.strip())
                elif key_part == 'LOCATION':
                    current_event['location'] = unescape_ics_text(value.strip())
                elif key_part == 'DESCRIPTION':
                    current_event['description'] = unescape_ics_text(value.strip())
                elif key_part == 'ATTENDEE':
                    if 'attendees' not in current_event: current_event['attendees'] = []
                    email = value.split('mailto:')[1].strip() if 'mailto:' in value else value.strip()
                    current_event['attendees'].append({'email': email})
        i += 1
    return events

def get_max_sequence_for_date(table, date_prefix):
    prefix = f"SCH-{date_prefix}-"
    try:
        response = table.scan(
            FilterExpression=Attr('id').begins_with(prefix),
            ProjectionExpression='id'
        )
        max_seq = 0
        for item in response.get('Items', []):
            sid = item.get('id', '')
            try:
                seq = int(sid.split('-')[-1])
                if seq > max_seq: max_seq = seq
            except: pass
        while 'LastEvaluatedKey' in response:
            response = table.scan(FilterExpression=Attr('id').begins_with(prefix), ProjectionExpression='id', ExclusiveStartKey=response['LastEvaluatedKey'])
            for item in response.get('Items', []):
                sid = item.get('id', '')
                try:
                    seq = int(sid.split('-')[-1])
                    if seq > max_seq: max_seq = seq
                except: pass
        return max_seq
    except: return 0

def run_import(file_path):
    print(f"Reading {file_path}...")
    with open(file_path, 'r', encoding='utf-8') as f:
        ics_content = f.read()
    
    # 2025年以降のデータを対象にする
    events = parse_ics_content(ics_content, from_date="2025-01-01")
    print(f"Found {len(events)} events.")
    events = events[:10]

    print("Fetching workers...")
    workers = WORKERS_TABLE.scan(ProjectionExpression='id, email').get('Items', [])
    print(f"Found {len(workers)} workers.")
    worker_map = {w.get('email', '').lower(): w.get('id') for w in workers if w.get('email')}
    
    # 個人メール対応
    worker_map['lemueldesousa@gmail.com'] = 'W01005'
    worker_map['kokiendou7@gmail.com'] = 'W021'
    worker_map['yuin3034@gmail.com'] = 'W003'
    worker_map['zuomuhezhen187@gmail.com'] = 'W006'
    
    print("Fetching stores...")
    all_stores = STORES_TABLE.scan(ProjectionExpression='id, store_name, brand_name, security_code').get('Items', [])
    print(f"Found {len(all_stores)} stores.")
    
    print("Checking existing schedules...")
    existing = set()
    scan = SCHEDULES_TABLE.scan(ProjectionExpression='external_id, assigned_to').get('Items', [])
    print(f"Found {len(scan)} existing schedules.")

    inserted = 0
    date_counters = {}

    for event in events:
        uid = event.get('uid')
        summary = event.get('summary', '').strip()
        description = event.get('description', '').strip()
        date_str = event.get('date')
        
        # 参加者からワーカー特定
        matched_workers = []
        for a in event.get('attendees', []):
            email = a.get('email', '').lower().strip()
            if email in worker_map:
                matched_workers.append(worker_map[email])
        
        targets = matched_workers if matched_workers else [None]
        
        for w_id in targets:
            if (uid, w_id) in existing:
                continue
            
            # --- AI抽出 ---
            target_name = summary
            work_type = 'cleaning'
            plan_match = re.search(r'【([^】]+)】', summary)
            if plan_match:
                work_type = plan_match.group(1)
                target_name = summary.replace(f'【{work_type}】', '').strip()
            
            # 店舗マッチング
            matched_store_id = None
            security_code = ""
            best_score = 0
            for s in all_stores:
                s_name = str(s.get('store_name') or '').lower()
                if s_name and s_name in summary.lower():
                    score = 10
                    if score > best_score:
                        best_score = score
                        matched_store_id = s.get('id')
                        security_code = s.get('security_code')
            
            #本文からキーボックス番号
            key_match = re.search(r'(番号|コード|暗証番号|キーボックス|ロックナンバー|解錠|キー)[:：\s]*(\d{3,6})', description)
            if key_match:
                security_code = key_match.group(2)
            
            # 清掃項目
            cleaning_items = []
            for line in description.split('\n'):
                line = line.strip()
                if line.startswith(('・', '*', '-', '●')):
                    item = re.sub(r'^[・\*\-\●]\s*', '', line).strip()
                    if item: cleaning_items.append({'name': item, 'status': 'pending'})

            # ID生成
            date_prefix = date_str.replace('-', '')
            if date_prefix not in date_counters:
                date_counters[date_prefix] = get_max_sequence_for_date(SCHEDULES_TABLE, date_prefix)
            date_counters[date_prefix] += 1
            sid = f"SCH-{date_prefix}-{str(date_counters[date_prefix]).zfill(3)}"
            
            item = {
                'id': sid,
                'external_id': uid,
                'date': date_str,
                'scheduled_date': date_str,
                'start_time': event.get('start_time', '00:00'),
                'end_time': event.get('end_time', '23:59'),
                'target_name': target_name,
                'work_type': work_type,
                'assigned_to': w_id,
                'worker_id': w_id,
                'store_id': matched_store_id,
                'security_code': security_code,
                'cleaning_items': cleaning_items,
                'notes': description,
                'status': 'confirmed',
                'origin': 'google_ics',
                'created_at': datetime.utcnow().isoformat() + 'Z'
            }
            
            SCHEDULES_TABLE.put_item(Item=item)
            inserted += 1
            if inserted % 10 == 0:
                print(f"Inserted {inserted}...")

    print(f"Import finished. Total inserted: {inserted}")

if __name__ == "__main__":
    run_import('/Users/sakuradamasaru/Desktop/misesapo/basic.ics')
