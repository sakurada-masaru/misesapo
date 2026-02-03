import boto3
import re
import uuid
import json
from datetime import datetime, timedelta

# 設定
REGION = 'ap-northeast-1'
TABLE_NAME = 'schedules'
ICS_FILE = '/Users/sakuradamasaru/Desktop/misesapo/filtered.ics'

dynamodb = boto3.resource('dynamodb', region_name=REGION)
table = dynamodb.Table(TABLE_NAME)

def unescape_ics_text(text):
    if not text: return ""
    return text.replace('\\n', '\n').replace('\\,', ',').replace('\\;', ';').replace('\\\\', '\\')

def parse_ics_simple(file_path):
    events = []
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 簡易パース
    raw_events = re.findall(r'BEGIN:VEVENT.*?END:VEVENT', content, re.DOTALL)
    for raw in raw_events:
        event = {}
        # SUMMARY
        m = re.search(r'SUMMARY:(.*)', raw)
        if m: event['summary'] = unescape_ics_text(m.group(1).strip())
        
        # DESCRIPTION
        m = re.search(r'DESCRIPTION:(.*?)(\r?\n[A-Z]|$)', raw, re.DOTALL)
        if m: event['description'] = unescape_ics_text(m.group(1).strip())
        
        # LOCATION
        m = re.search(r'LOCATION:(.*)', raw)
        if m: event['location'] = unescape_ics_text(m.group(1).strip())
        
        # DTSTART
        m = re.search(r'DTSTART[:;].*?:(\d{8}T\d{6}Z?)', raw)
        if m: event['dtstart'] = m.group(1).strip()
        
        # UID
        m = re.search(r'UID:(.*)', raw)
        if m: event['uid'] = m.group(1).strip()
        
        events.append(event)
    return events

def extract_info(summary, description):
    # 暗証番号抽出
    key_match = re.search(r'(番号|コード|暗証番号|キーボックス|ロックナンバー|解錠|キー)[:：\s]*([0-9A-Za-z*]{4,})', description)
    security_code = key_match.group(2) if key_match else ""
    
    # 清掃項目 (・ で始まる行)
    cleaning_items = []
    if description:
        lines = description.split('\n')
        for line in lines:
            line = line.strip()
            if line.startswith('・') or line.startswith('- '):
                cleaning_items.append(line.lstrip('・- '))
    
    return security_code, cleaning_items

def run_import():
    events = parse_ics_simple(ICS_FILE)
    print(f"Total events found in filtered.ics: {len(events)}")
    
    count = 0
    for ev in events:
        summary = ev.get('summary', '')
        description = ev.get('description', '')
        dtstart_str = ev.get('dtstart', '')
        
        if not dtstart_str: continue
        
        # 日時変換 (20260201T080000Z -> 2026-02-01 08:00)
        try:
            dt = datetime.strptime(dtstart_str[:15], '%Y%m%dT%H%M%S')
            # 簡易的にJSTへ (+9h)
            dt = dt + timedelta(hours=9)
            date_str = dt.strftime('%Y-%m-%d')
            time_str = dt.strftime('%H:%M')
        except:
            continue

        sec_code, items = extract_info(summary, description)
        
        item_id = f"SCH-{uuid.uuid4().hex[:8].upper()}"
        
        db_item = {
            'id': item_id,
            'date': date_str,
            'startTime': time_str,
            'endTime': (dt + timedelta(hours=2)).strftime('%H:%M'), # デフォルト2時間
            'storeName': summary,
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
        if count % 10 == 0:
            print(f"Imported {count} items...")

    print(f"Done! Imported total {count} schedules.")

if __name__ == "__main__":
    run_import()
