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

print(f"Boto3 version: {boto3.__version__}")
sys.stdout.flush()

try:
    dynamodb = boto3.resource('dynamodb', region_name=REGION)
    table = dynamodb.Table(TABLE_NAME)
    table.table_status
    print(f"Connected to DynamoDB table: {TABLE_NAME}")
except Exception as e:
    print(f"Connection Error: {e}")
    sys.exit(1)

def unescape_ics_text(text):
    if not text: return ""
    return text.replace('\\n', '\n').replace('\\,', ',').replace('\\;', ';').replace('\\\\', '\\')

def extract_info(summary, description):
    # 暗証番号抽出 (番号：0207, ロックナンバー 1234 等)
    key_match = re.search(r'(番号|コード|暗証番号|キーボックス|ロックナンバー|解錠|キー)[:：\s]*([0-9A-Za-z*]{4,})', description)
    security_code = key_match.group(2) if key_match else ""
    
    # 清掃項目 (・ で始まる行、または "＜定期清掃項目＞" 以降)
    cleaning_items = []
    if description:
        # 特徴的なリスト形式を抽出
        matches = re.findall(r'[・\-\*]\s*([^\n]+)', description)
        if matches:
            cleaning_items = [m.strip() for m in matches if len(m.strip()) > 1]
    
    # 店名のクリーンアップ (【定期清掃】等を削除)
    store_name = re.sub(r'【[^】]+】', '', summary).strip()
    
    return store_name, security_code, cleaning_items

def parse_ics_simple(file_path):
    events = []
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    raw_events = re.findall(r'BEGIN:VEVENT.*?END:VEVENT', content, re.DOTALL)
    for raw in raw_events:
        event = {}
        m = re.search(r'SUMMARY:(.*)', raw)
        if m: event['summary'] = unescape_ics_text(m.group(1).strip())
        
        # DESCRIPTION is often multi-line in ICS, but we handle it simply
        m = re.search(r'DESCRIPTION:(.*?)(\r?\n[A-Z]|$)', raw, re.DOTALL)
        if m: event['description'] = unescape_ics_text(m.group(1).strip())
        
        m = re.search(r'DTSTART[:;].*?:(\d{8}T\d{6}Z?)', raw)
        if m: event['dtstart'] = m.group(1).strip()
        
        m = re.search(r'UID:(.*)', raw)
        if m: event['uid'] = m.group(1).strip()
        
        events.append(event)
    return events

def run_import():
    # まず既存の 'imported' データを削除してクリーンにする (任意)
    # 完全に上書きしたい場合は、googleEventId をキーに使う設計が必要だが、
    # 今はシンプルに全件再注入する。
    
    events = parse_ics_simple(ICS_FILE)
    print(f"Total events to process with AI extraction: {len(events)}")
    sys.stdout.flush()
    
    count = 0
    for ev in events:
        summary = ev.get('summary', '')
        description = ev.get('description', '')
        dtstart_str = ev.get('dtstart', '')
        if not dtstart_str: continue
        
        try:
            # 日時
            dt = datetime.strptime(dtstart_str[:15], '%Y%m%dT%H%M%S')
            dt = dt + timedelta(hours=9) # JST
            date_str = dt.strftime('%Y-%m-%d')
            time_str = dt.strftime('%H:%M')
            
            # AI情報抽出
            store_name, sec_code, items = extract_info(summary, description)
            
            item_id = f"SCH-{uuid.uuid4().hex[:8].upper()}"
            db_item = {
                'id': item_id,
                'date': date_str,
                'startTime': time_str,
                'endTime': (dt + timedelta(hours=2)).strftime('%H:%M'),
                'storeName': store_name,
                'summary': summary,
                'description': description,
                'securityCode': sec_code,
                'cleaningItems': items,
                'status': 'confirmed',
                'type': 'imported',
                'googleEventId': ev.get('uid', ''),
                'createdAt': datetime.now().isoformat()
            }
            
            table.put_item(Item=db_item)
            count += 1
            if sec_code:
                print(f"[{count}/{len(events)}] Imported: {store_name} (Code: {sec_code})")
            else:
                print(f"[{count}/{len(events)}] Imported: {store_name}")
            sys.stdout.flush()
        except Exception as e:
            print(f"Error importing {summary}: {e}")

    print(f"FINISHED! Imported total {count} schedules with rich info.")
    sys.stdout.flush()

if __name__ == "__main__":
    run_import()
