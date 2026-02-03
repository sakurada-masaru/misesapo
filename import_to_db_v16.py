import boto3
import re
import uuid
import json
from datetime import datetime, timedelta

# 設定
REGION = 'ap-northeast-1'
SCHEDULES_TABLE = 'schedules'
ICS_FILE = '/Users/sakuradamasaru/Desktop/misesapo/filtered.ics'

dynamodb = boto3.resource('dynamodb', region_name=REGION)
table = dynamodb.Table(SCHEDULES_TABLE)

# 完璧なマッピング表
GUEST_MAP = {
    'lemueldesousa@gmail.com': 'W01005',
    'kokiendou7@gmail.com': 'W021',
    'yuin3034@gmail.com': 'W003',
    'zuomuhezhen187@gmail.com': 'W006',
    'matsuokajonas@gmail.com': 'W01000',
    'bibisayuri2011@hotmail.com': 'W01003',
    'umeokagroup@gmail.com': 'W002',
    'umeokayudi@gmail.com': 'W002'
}

def unfold_ics(content):
    return re.sub(r'(\r?\n)+[ \t]', '', content)

def run_v16_accident_import():
    print("STEP 5: Importing with ACCIDENT (再清掃) detection...")
    
    # 既存のインポートデータを削除
    scan = table.scan(FilterExpression=boto3.dynamodb.conditions.Attr('type').eq('imported'))
    with table.batch_writer() as batch:
        for item in scan.get('Items', []):
            batch.delete_item(Key={'id': item['id']})

    with open(ICS_FILE, 'r', encoding='utf-8') as f:
        content = unfold_ics(f.read())
    
    events = re.findall(r'BEGIN:VEVENT.*?END:VEVENT', content, re.DOTALL)
    now = datetime.now().isoformat() + 'Z'
    count = 0
    accident_count = 0
    
    for raw in events:
        m_summary = re.search(r'SUMMARY:(.*)', raw)
        m_start = re.search(r'DTSTART[:;].*?:(\d{8}T\d{6}Z?)', raw)
        m_uid = re.search(r'UID:(.*)', raw)
        attendees = re.findall(r'ATTENDEE.*?:mailto:([^\s;]+)', raw)
        
        if not m_start: continue
        
        summary = m_summary.group(1).strip() if m_summary else "無題"
        dtstart = m_start.group(1).strip()
        uid = m_uid.group(1).strip() if m_uid else str(uuid.uuid4())
        
        # 再清掃（事故案件）の判定
        is_accident = "再清掃" in summary
        work_type = "再清掃" if is_accident else "定期清掃（1ヶ月）"
        
        try:
            dt = datetime.strptime(dtstart[:15], '%Y%m%dT%H%M%S') + timedelta(hours=9)
            date_str = dt.strftime('%Y-%m-%d')
            
            # マッピングに一致する「全てのワーカーID」を抽出
            matched_worker_ids = []
            for email in attendees:
                e = email.lower().strip()
                if e in GUEST_MAP:
                    matched_worker_ids.append(GUEST_MAP[e])
            
            matched_worker_ids = list(set(matched_worker_ids))
            
            item_id = f"SCH-{dt.strftime('%Y%m%d')}-{hash(uid) % 10000:04X}"
            
            item = {
                'id': item_id,
                'date': date_str,
                'scheduled_date': date_str,
                'start_time': dt.strftime('%H:%M'),
                'end_time': (dt + timedelta(hours=2)).strftime('%H:%M'),
                'start_min': dt.hour * 60 + dt.minute,
                'end_min': (dt.hour + 2) * 60 + dt.minute,
                'target_name': summary,
                'summary': summary,
                'status': 'scheduled',
                'work_type': work_type, # ここでセット
                'origin': 'google_ics',
                'external_id': uid,
                'type': 'imported',
                'worker_ids': matched_worker_ids,
                'created_at': now,
                'updated_at': now
            }
            
            if is_accident:
                item['is_accident'] = True # 事故フラグ
                accident_count += 1
            
            if matched_worker_ids:
                item['worker_id'] = matched_worker_ids[0]
                item['assigned_to'] = matched_worker_ids[0]
            
            table.put_item(Item=item)
            count += 1

        except Exception as e:
            print(f"Error processing {summary}: {e}")

    print(f"STEP 5 FINISHED. Total: {count}, Accident items: {accident_count}")

if __name__ == "__main__":
    run_v16_accident_import()
