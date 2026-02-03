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

# 店舗情報の取得 (名前からIDを推測するため)
print("Fetching real store data for auto-matching...")
store_map = {}
try:
    stores_table = dynamodb.Table('stores')
    scan = stores_table.scan()
    for s in scan.get('Items', []):
        name = s.get('name') or s.get('store_name')
        if name:
            store_map[name.strip()] = s['id']
except Exception as e:
    print(f"Warning: Store fetch failed: {e}")

# ワーカー情報の取得
print("Fetching real worker data...")
worker_email_map = {}
try:
    workers_table = dynamodb.Table('workers')
    scan = workers_table.scan()
    for w in scan.get('Items', []):
        email = w.get('email')
        if email:
            worker_email_map[email.lower().strip()] = w['id']
except Exception as e:
    print(f"Warning: Worker fetch failed: {e}")

PERSONAL_EMAIL_MAP = {
    'matsuokajonas@gmail.com': 'W01000',
    'umeokagroup@gmail.com': 'W002',
    'lemueldesousa@gmail.com': 'W01005',
    'umeokayudi@gmail.com': 'W002',
    'yuin3034@gmail.com': 'W002',
    'bibisayuri2011@hotmail.com': 'W023',
    'namai@misesapo.co.jp': 'W013',
    'sasaki@misesapo.co.jp': 'W006',
    'endo@misesapo.co.jp': 'W021'
}

def unescape_ics_text(text):
    if not text: return ""
    return text.replace('\\n', '\n').replace('\\,', ',').replace('\\;', ';').replace('\\\\', '\\')

def extract_info_ai_v7(summary, description):
    # 暗証番号抽出
    desc_clean = re.sub(r'[\s\r]', '', description) # 改行は正規表現の . でマッチしなくなるので残すか \n 込みで
    security_code = ""
    
    # 典型的なキーワードの後の数字を拾う
    patterns = [
        r'(?:キーボックス|暗証番号|番号|コード|ロックナンバー|解錠|キー)[:：\s\n]*([0-9A-Za-z*]{3,8})',
        r'ポスト[:：]?右に(\d)左に(\d)'
    ]
    
    for p in patterns:
        m = re.search(p, description, re.MULTILINE)
        if m:
            if 'ポスト' in p:
                security_code = f"P:{m.group(1)}-{m.group(2)}"
            else:
                security_code = m.group(1).strip()
            break
            
    # 店名のクリーンアップ
    clean_name = re.sub(r'^【[^】]+】\s*', '', summary).strip()
    clean_name = re.sub(r'\s*\（.*\）$', '', clean_name)
    
    work_type = 'cleaning'
    if 'スポット' in summary: work_type = 'スポット'
    elif '定期' in summary: work_type = '定期清掃'
    
    return clean_name, work_type, security_code

def run_v7_final_import():
    print("Step 1: Cleaning up for LAST time...")
    scan = table.scan(FilterExpression=boto3.dynamodb.conditions.Attr('type').eq('imported') | boto3.dynamodb.conditions.Attr('origin').eq('google_ics'))
    for item in scan.get('Items', []):
        table.delete_item(Key={'id': item['id']})

    print("Step 2: Rich Re-Importing...")
    with open(ICS_FILE, 'r', encoding='utf-8') as f:
        content = f.read()
    
    events = []
    raw_events = re.findall(r'BEGIN:VEVENT.*?END:VEVENT', content, re.DOTALL)
    now = datetime.now().isoformat() + 'Z'
    success_count = 0
    
    for raw in raw_events:
        ev = {'attendees': []}
        m = re.search(r'SUMMARY:(.*)', raw); ev['summary'] = unescape_ics_text(m.group(1).strip()) if m else ""
        m = re.search(r'DESCRIPTION:(.*?)(\r?\n[A-Z]|$)', raw, re.DOTALL); ev['description'] = unescape_ics_text(m.group(1).strip()) if m else ""
        m = re.search(r'DTSTART[:;].*?:(\d{8}T\d{6}Z?)', raw); ev['dtstart'] = m.group(1).strip() if m else ""
        m = re.search(r'UID:(.*)', raw); ev['uid'] = m.group(1).strip() if m else ""
        atts = re.findall(r'ATTENDEE.*?:mailto:(.*)', raw); ev['attendees'] = [a.strip().lower() for a in atts]
        
        if not ev['dtstart']: continue
        
        try:
            dt = datetime.strptime(ev['dtstart'][:15], '%Y%m%dT%H%M%S') + timedelta(hours=9)
            date_str = dt.strftime('%Y-%m-%d')
            
            clean_name, work_type, sec_code = extract_info_ai_v7(ev['summary'], ev['description'])
            
            # 店舗IDの自動マッチング (曖昧一致)
            matched_store_id = None
            for s_name, s_id in store_map.items():
                if s_name in clean_name or clean_name in s_name:
                    matched_store_id = s_id
                    break
            
            # ワーカー特定
            worker_id = None
            for email in ev['attendees']:
                worker_id = PERSONAL_EMAIL_MAP.get(email) or worker_email_map.get(email)
                if worker_id: break
            
            # 備考欄の冒頭に暗証番号を強調して挿入
            rich_description = ev['description']
            if sec_code:
                rich_description = f"【🔑 暗証番号：{sec_code}】\n\n" + rich_description
            
            schedule_id = f"SCH-{dt.strftime('%Y%md')}-{uuid.uuid4().hex[:4].upper()}"
            
            item = {
                'id': schedule_id,
                'date': date_str,
                'scheduled_date': date_str,
                'start_time': dt.strftime('%H:%M'),
                'end_time': (dt + timedelta(hours=2)).strftime('%H:%M'),
                'start_min': dt.hour * 60 + dt.minute,
                'end_min': (dt.hour + 2) * 60 + dt.minute,
                'target_name': clean_name,
                'summary': ev['summary'],
                'description': rich_description, # 暗証番号入りのリッチな説明文
                'notes': rich_description,
                'security_code': sec_code, # 独立したフィールド
                'status': 'scheduled',
                'work_type': work_type,
                'origin': 'google_ics',
                'external_id': ev['uid'],
                'type': 'imported',
                'created_at': now,
                'updated_at': now
            }
            
            if matched_store_id: item['store_id'] = matched_store_id
            if worker_id:
                item['worker_id'] = worker_id
                item['assigned_to'] = worker_id
            
            table.put_item(Item=item)
            success_count += 1
            
        except Exception as e:
            print(f"Error: {e}")

    print(f"Successfully re-imported {success_count} items with store matching and rich notes.")

if __name__ == "__main__":
    run_v7_final_import()
