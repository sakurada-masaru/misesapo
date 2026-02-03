import boto3
import re
import uuid
import json
from datetime import datetime, timedelta
import sys

# 設定
REGION = 'ap-northeast-1'
SCHEDULES_TABLE = 'schedules'
STORES_TABLE = 'misesapo-stores'
ICS_FILE = '/Users/sakuradamasaru/Desktop/misesapo/filtered.ics'

dynamodb = boto3.resource('dynamodb', region_name=REGION)
table_schedules = dynamodb.Table(SCHEDULES_TABLE)

# ユーザー指定の完璧なマッピング表
GUEST_MAP = {
    'lemueldesousa@gmail.com': 'W01005',
    'kokiendou7@gmail.com': 'W021',
    'yuin3034@gmail.com': 'W003', # 中澤様と指定されたがDBでは中島様の可能性あり、ユーザー指示優先
    'zuomuhezhen187@gmail.com': 'W006',
    'matsuokajonas@gmail.com': 'W01000',
    'bibisayuri2011@hotmail.com': 'W01003',
    'umeokagroup@gmail.com': 'W002'
}

# 店舗データの取得
print("Fetching stores for matching...")
store_list = []
try:
    table_stores = dynamodb.Table(STORES_TABLE)
    scan = table_stores.scan()
    store_list = scan.get('Items', [])
    print(f"Loaded {len(store_list)} stores.")
except Exception as e:
    print(f"Warning: Store fetch failed: {e}")

def unescape_ics_text(text):
    if not text: return ""
    return text.replace('\\n', '\n').replace('\\,', ',').replace('\\;', ';').replace('\\\\', '\\')

def extract_info_precise(summary, description):
    security_code = ""
    if description:
        # 改行・空白を無視して検索
        desc_clean = re.sub(r'[\s\n\r]', '', description)
        m = re.search(r'(?:キーボックス|暗証番号|番号|コード|解錠)[:：]?([0-9]{3,6})', desc_clean)
        if m:
            security_code = m.group(1)
        else:
            m = re.search(r'ポスト[:：]?右に(\d)左に(\d)', desc_clean)
            if m:
                security_code = f"P:{m.group(1)}-{m.group(2)}"

    # 店名のクリーンアップ
    target_name = re.sub(r'^【[^】]+】\s*', '', summary).strip()
    target_name = re.sub(r'\s*[\（\(].*[\）\)]$', '', target_name) # （日曜定休）などを除去
    
    # 現場名が「GOSSO（株） 0秒レモンサワーときわ亭池袋西口店」などの場合、
    # 店舗DBの「池袋西口店」などと部分一致させるためのヒント
    
    work_type = 'cleaning'
    if 'スポット' in summary: work_type = 'スポット'
    elif '定期' in summary: work_type = '定期清掃'
    
    return target_name, work_type, security_code

def match_store(target_name):
    if not target_name: return None
    t_name = target_name.lower()
    best_match = None
    max_score = 0
    
    for s in store_list:
        s_name = (s.get('name') or s.get('store_name') or '').lower()
        if not s_name: continue
        
        score = 0
        if s_name == t_name:
            score = 100
        elif s_name in t_name or t_name in s_name:
            score = len(s_name) # 長い一致を優先
            
        if score > max_score:
            max_score = score
            best_match = s['id']
            
    return best_match if max_score > 5 else None

def run_v9_ultimate_import():
    print("Step 1: Cleaning up existing imported data...")
    scan = table_schedules.scan(FilterExpression=boto3.dynamodb.conditions.Attr('type').eq('imported') | boto3.dynamodb.conditions.Attr('origin').eq('google_ics'))
    with table_schedules.batch_writer() as batch:
        for item in scan.get('Items', []):
            batch.delete_item(Key={'id': item['id']})

    print("Step 2: Re-importing with PERFECT worker mapping and Store matching...")
    with open(ICS_FILE, 'r', encoding='utf-8') as f:
        content = f.read()
    
    raw_events = re.findall(r'BEGIN:VEVENT.*?END:VEVENT', content, re.DOTALL)
    now = datetime.now().isoformat() + 'Z'
    count = 0
    
    for raw in raw_events:
        m = re.search(r'SUMMARY:(.*)', raw); summary = unescape_ics_text(m.group(1).strip()) if m else ""
        m = re.search(r'DESCRIPTION:(.*?)(\r?\n[A-Z]|$)', raw, re.DOTALL); description = unescape_ics_text(m.group(1).strip()) if m else ""
        m = re.search(r'DTSTART[:;].*?:(\d{8}T\d{6}Z?)', raw); dtstart_str = m.group(1).strip() if m else ""
        m = re.search(r'UID:(.*)', raw); uid = m.group(1).strip() if m else ""
        attendees = re.findall(r'ATTENDEE.*?:mailto:(.*)', raw)
        
        if not dtstart_str: continue
        
        try:
            dt = datetime.strptime(dtstart_str[:15], '%Y%m%dT%H%M%S') + timedelta(hours=9)
            date_str = dt.strftime('%Y-%m-%d')
            
            target_name, work_type, sec_code = extract_info_precise(summary, description)
            store_id = match_store(target_name)
            
            worker_id = None
            for email in attendees:
                email_clean = email.strip().lower()
                if email_clean in GUEST_MAP:
                    worker_id = GUEST_MAP[email_clean]
                    break
            
            rich_description = description
            if sec_code:
                rich_description = f"【🔑 暗証番号：{sec_code}】\n\n" + rich_description
            
            schedule_id = f"SCH-{dt.strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}"
            
            item = {
                'id': schedule_id,
                'date': date_str,
                'scheduled_date': date_str,
                'start_time': dt.strftime('%H:%M'),
                'end_time': (dt + timedelta(hours=2)).strftime('%H:%M'),
                'start_min': dt.hour * 60 + dt.minute,
                'end_min': (dt.hour + 2) * 60 + dt.minute,
                'target_name': target_name,
                'summary': summary,
                'description': rich_description,
                'notes': rich_description,
                'security_code': sec_code,
                'status': 'scheduled',
                'work_type': work_type,
                'origin': 'google_ics',
                'external_id': uid,
                'type': 'imported',
                'created_at': now,
                'updated_at': now
            }
            
            if store_id: item['store_id'] = store_id
            if worker_id:
                item['worker_id'] = worker_id
                item['assigned_to'] = worker_id
            
            table_schedules.put_item(Item=item)
            count += 1
            if count % 10 == 0:
                print(f"Processed {count} items...")
            
        except Exception as e:
            print(f"Error processing {summary}: {e}")

    print(f"ULTIMATE SUCCESS! Imported {count} items with worker mapping and store linking.")

if __name__ == "__main__":
    run_v9_ultimate_import()
