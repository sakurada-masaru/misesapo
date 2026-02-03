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
    'yuin3034@gmail.com': 'W003',
    'zuomuhezhen187@gmail.com': 'W006',
    'matsuokajonas@gmail.com': 'W01000',
    'bibisayuri2011@hotmail.com': 'W01003',
    'umeokagroup@gmail.com': 'W002',
    # 柔軟なマッチング用
    'umeokayudi@gmail.com': 'W002',
    'rebond.yonezawa@gmail.com': 'W021' # 例
}

print("Fetching stores...")
store_list = []
try:
    table_stores = dynamodb.Table(STORES_TABLE)
    scan = table_stores.scan()
    store_list = scan.get('Items', [])
except Exception: pass

def unescape_ics_text(text):
    if not text: return ""
    return text.replace('\\n', '\n').replace('\\,', ',').replace('\\;', ';').replace('\\\\', '\\')

def unfold_ics(content):
    # ICSのコンテンツをアンフォールド（改行＋スペース/タブを削除）
    return re.sub(r'\r\n[ \t]', '', content).replace('\n ', '').replace('\r ', '')

def extract_info_precise(summary, description):
    security_code = ""
    if description:
        desc_clean = re.sub(r'[\s\n\r]', '', description)
        m = re.search(r'(?:キーボックス|暗証番号|番号|コード|解錠)[:：]?([0-9]{3,6})', desc_clean)
        if m: security_code = m.group(1)
        else:
            m = re.search(r'ポスト[:：]?右に(\d)左に(\d)', desc_clean)
            if m: security_code = f"P:{m.group(1)}-{m.group(2)}"

    target_name = re.sub(r'^【[^】]+】\s*', '', summary).strip()
    target_name = re.sub(r'\s*[\（\(].*[\）\)]$', '', target_name)
    work_type = '定期清掃' if '定期' in summary else ('スポット' if 'スポット' in summary else 'cleaning')
    return target_name, work_type, security_code

def run_v10_final_fix():
    print("Cleaning up...")
    scan = table_schedules.scan(FilterExpression=boto3.dynamodb.conditions.Attr('type').eq('imported'))
    with table_schedules.batch_writer() as batch:
        for item in scan.get('Items', []):
            batch.delete_item(Key={'id': item['id']})

    with open(ICS_FILE, 'r', encoding='utf-8') as f:
        content = unfold_ics(f.read())
    
    raw_events = re.findall(r'BEGIN:VEVENT.*?END:VEVENT', content, re.DOTALL)
    now = datetime.now().isoformat() + 'Z'
    count = 0
    assigned_count = 0
    
    for raw in raw_events:
        m = re.search(r'SUMMARY:(.*)', raw); summary = unescape_ics_text(m.group(1).strip()) if m else ""
        m = re.search(r'DESCRIPTION:(.*?)(\r?\n[A-Z]|$)', raw, re.DOTALL); description = unescape_ics_text(m.group(1).strip()) if m else ""
        m = re.search(r'DTSTART[:;].*?:(\d{8}T\d{6}Z?)', raw); dtstart_str = m.group(1).strip() if m else ""
        m = re.search(r'UID:(.*)', raw); uid = m.group(1).strip() if m else ""
        
        # 参加者の抽出精度を上げる
        attendees = re.findall(r'ATTENDEE.*?:mailto:([^\s;]+)', raw)
        
        if not dtstart_str: continue
        
        try:
            dt = datetime.strptime(dtstart_str[:15], '%Y%m%dT%H%M%S') + timedelta(hours=9)
            date_str = dt.strftime('%Y-%m-%d')
            target_name, work_type, sec_code = extract_info_precise(summary, description)
            
            worker_id = None
            for email in attendees:
                e = email.lower().strip()
                if e in GUEST_MAP:
                    worker_id = GUEST_MAP[e]
                    break
            
            rich_description = (f"【🔑 暗証番号：{sec_code}】\n\n" if sec_code else "") + description
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
            
            # 店舗マッチング
            for s in store_list:
                s_name = (s.get('name') or s.get('store_name') or '').lower()
                if s_name and (s_name in target_name.lower() or target_name.lower() in s_name):
                    item['store_id'] = s['id']
                    break
            
            if worker_id:
                item['worker_id'] = worker_id
                item['assigned_to'] = worker_id
                assigned_count += 1
            
            table_schedules.put_item(Item=item)
            count += 1
        except Exception as e: print(f"Error: {e}")

    print(f"FINISHED! Imported {count} items. Assigned to workers: {assigned_count}")

if __name__ == "__main__":
    run_v10_final_fix()
