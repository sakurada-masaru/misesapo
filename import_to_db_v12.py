import boto3
import re
import uuid
import json
from datetime import datetime, timedelta
import sys

# 設定
REGION = 'ap-northeast-1'
SCHEDULES_TABLE = 'schedules'
ICS_FILE = '/Users/sakuradamasaru/Desktop/misesapo/filtered.ics'

dynamodb = boto3.resource('dynamodb', region_name=REGION)
table = dynamodb.Table(SCHEDULES_TABLE)

# ユーザー指定の「絶対」マッピング表
GUEST_MAP = {
    'lemueldesousa@gmail.com': 'W01005',
    'kokiendou7@gmail.com': 'W021',
    'yuin3034@gmail.com': 'W003',
    'zuomuhezhen187@gmail.com': 'W006',
    'matsuokajonas@gmail.com': 'W01000',
    'bibisayuri2011@hotmail.com': 'W01003',
    'umeokagroup@gmail.com': 'W002',
    # 柔軟なマッチング用
    'umeokayudi@gmail.com': 'W002'
}

def unfold_ics(content):
    # ICS特有の折り畳み（行頭のスペース）を解消
    return re.sub(r'(\r?\n)+[ \t]', '', content)

def run_v12_step1_worker_only():
    print("STEP 1: Full Reset...")
    scan = table.scan(FilterExpression=boto3.dynamodb.conditions.Attr('type').eq('imported'))
    with table.batch_writer() as batch:
        for item in scan.get('Items', []):
            batch.delete_item(Key={'id': item['id']})
    print("Cleanup DONE.")

    print("STEP 1: Importing (Worker focus)...")
    with open(ICS_FILE, 'r', encoding='utf-8') as f:
        content = unfold_ics(f.read())
    
    events = re.findall(r'BEGIN:VEVENT.*?END:VEVENT', content, re.DOTALL)
    now = datetime.now().isoformat() + 'Z'
    total_count = 0
    assigned_count = 0
    
    for raw in events:
        # 最小限の抽出
        m_summary = re.search(r'SUMMARY:(.*)', raw)
        m_start = re.search(r'DTSTART[:;].*?:(\d{8}T\d{6}Z?)', raw)
        m_uid = re.search(r'UID:(.*)', raw)
        attendees = re.findall(r'ATTENDEE.*?:mailto:([^\s;]+)', raw)
        
        if not m_start: continue
        
        summary = m_summary.group(1).strip() if m_summary else "無題"
        dtstart = m_start.group(1).strip()
        uid = m_uid.group(1).strip() if m_uid else str(uuid.uuid4())
        
        try:
            dt = datetime.strptime(dtstart[:15], '%Y%m%dT%H%M%S') + timedelta(hours=9)
            date_str = dt.strftime('%Y-%m-%d')
            
            # 参加者全員についてチェック
            workers_for_this_event = []
            for email in attendees:
                e = email.lower().strip()
                if e in GUEST_MAP:
                    workers_for_this_event.append(GUEST_MAP[e])
            
            # 重複排除
            workers_for_this_event = list(set(workers_for_this_event))
            
            # 各ワーカーに対して1つずつデータを作成（行に表示させるため）
            # マッチしない場合は "未割当" 行に出るように None で1つ作成
            targets = workers_for_this_event if workers_for_this_event else [None]
            
            for wid in targets:
                # 名前をはめていく。今はサマリーをそのまま店舗名扱い。
                item = {
                    'id': f"SCH-{dt.strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}",
                    'date': date_str,
                    'scheduled_date': date_str,
                    'start_time': dt.strftime('%H:%M'),
                    'end_time': (dt + timedelta(hours=2)).strftime('%H:%M'),
                    'start_min': dt.hour * 60 + dt.minute,
                    'end_min': (dt.hour + 2) * 60 + dt.minute,
                    'target_name': summary, # 店舗名との整合性は「次のステップ」
                    'summary': summary,
                    'status': 'scheduled',
                    'origin': 'google_ics',
                    'external_id': uid,
                    'type': 'imported',
                    'created_at': now,
                    'updated_at': now
                }
                
                if wid:
                    item['worker_id'] = wid
                    item['assigned_to'] = wid
                    assigned_count += 1
                
                table.put_item(Item=item)
                total_count += 1
                
        except Exception as e:
            print(f"Error processing {summary}: {e}")

    print(f"STEP 1 FINISHED. Total items: {total_count}, Assigned rows: {assigned_count}")

if __name__ == "__main__":
    run_v12_step1_worker_only()
