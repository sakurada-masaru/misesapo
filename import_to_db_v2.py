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
    # 接続確認
    table.table_status
    print(f"Connected to DynamoDB table: {TABLE_NAME}")
except Exception as e:
    print(f"Connection Error: {e}")
    sys.exit(1)

def unescape_ics_text(text):
    if not text: return ""
    return text.replace('\\n', '\n').replace('\\,', ',').replace('\\;', ';').replace('\\\\', '\\')

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
        
        events.append(event)
    return events

def run_import():
    events = parse_ics_simple(ICS_FILE)
    print(f"Total events to process: {len(events)}")
    sys.stdout.flush()
    
    count = 0
    for ev in events:
        summary = ev.get('summary', '')
        dtstart_str = ev.get('dtstart', '')
        if not dtstart_str: continue
        
        try:
            dt = datetime.strptime(dtstart_str[:15], '%Y%m%dT%H%M%S')
            dt = dt + timedelta(hours=9) # JST
            date_str = dt.strftime('%Y-%m-%d')
            time_str = dt.strftime('%H:%M')
            
            item_id = f"SCH-{uuid.uuid4().hex[:8].upper()}"
            db_item = {
                'id': item_id,
                'date': date_str,
                'startTime': time_str,
                'endTime': (dt + timedelta(hours=2)).strftime('%H:%M'),
                'storeName': summary,
                'summary': summary,
                'description': ev.get('description', ''),
                'status': 'confirmed',
                'type': 'imported',
                'googleEventId': ev.get('uid', ''),
                'createdAt': datetime.now().isoformat()
            }
            
            table.put_item(Item=db_item)
            count += 1
            print(f"[{count}/{len(events)}] Imported: {summary} on {date_str}")
            sys.stdout.flush()
        except Exception as e:
            print(f"Error importing {summary}: {e}")

    print(f"FINISHED! Imported total {count} schedules.")
    sys.stdout.flush()

if __name__ == "__main__":
    run_import()
