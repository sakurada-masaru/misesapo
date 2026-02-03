import boto3
import re
import uuid
from datetime import datetime, timedelta

# 設定
REGION = 'ap-northeast-1'
SCHEDULES_TABLE = 'schedules'
# 再清掃案件が含まれている basic.ics を直接スキャンする
ICS_FILE = '/Users/sakuradamasaru/Desktop/misesapo/basic.ics'

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

def run_v17_accident_force_import():
    print("STEP 6: Force Importing ALL '再清掃' items from Basic ICS...")
    
    with open(ICS_FILE, 'r', encoding='utf-8') as f:
        content = unfold_ics(f.read())
    
    events = re.findall(r'BEGIN:VEVENT.*?END:VEVENT', content, re.DOTALL)
    now = datetime.now().isoformat() + 'Z'
    count = 0
    accident_count = 0
    
    for raw in events:
        m_summary = re.search(r'SUMMARY:(.*)', raw)
        m_description = re.search(r'DESCRIPTION:(.*)', raw, re.DOTALL)
        
        summary = m_summary.group(1).strip() if m_summary else ""
        description = m_description.group(1).strip() if m_description else ""
        
        # 「再清掃」が含まれるか判定
        is_accident = ("再清掃" in summary) or ("再清掃" in description)
        
        # 事故案件のみを取り込む（あるいは既存と重複しないように取り込む）
        if not is_accident:
            continue

        m_start = re.search(r'DTSTART[:;].*?:(\d{8}T\d{6}Z?)', raw)
        m_uid = re.search(r'UID:(.*)', raw)
        attendees = re.findall(r'ATTENDEE.*?:mailto:([^\s;]+)', raw)
        
        if not m_start: continue
        
        dtstart = m_start.group(1).strip()
        uid = m_uid.group(1).strip() if m_uid else str(uuid.uuid4())
        
        try:
            # タイムゾーン考慮
            if "TZID=" in raw:
                dt = datetime.strptime(dtstart[:15], '%Y%m%dT%H%M%S')
            else:
                # Z付きなどはUTCとして+9
                dt = datetime.strptime(dtstart[:15], '%Y%m%dT%H%M%S') + timedelta(hours=9)
            
            date_str = dt.strftime('%Y-%m-%d')
            
            # 2026年2月周辺のデータに限定しても良いが、事故案件は全期間で見えるべきなら制限なし
            # ここでは将来の事故を見逃さないように全期間対象
            
            matched_worker_ids = []
            for email in attendees:
                e = email.lower().strip()
                if e in GUEST_MAP:
                    matched_worker_ids.append(GUEST_MAP[e])
            
            matched_worker_ids = list(set(matched_worker_ids))
            
            # IDを事故案件として一意にする
            item_id = f"ACCID-{dt.strftime('%Y%m%d')}-{hash(uid) % 10000:04X}"
            
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
                'description': description,
                'status': 'scheduled',
                'work_type': '再清掃',
                'origin': 'google_ics_accident',
                'external_id': uid,
                'type': 'imported',
                'is_accident': True,
                'worker_ids': matched_worker_ids,
                'created_at': now,
                'updated_at': now
            }
            
            if matched_worker_ids:
                item['worker_id'] = matched_worker_ids[0]
                item['assigned_to'] = matched_worker_ids[0]
            
            table.put_item(Item=item)
            accident_count += 1

        except Exception as e:
            print(f"Error processing {summary}: {e}")

    print(f"STEP 6 FINISHED. Found and imported {accident_count} ACCIDENT items.")

if __name__ == "__main__":
    run_v17_accident_force_import()
