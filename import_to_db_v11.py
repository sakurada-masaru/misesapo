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
    'lemueldesousa@gmail.com': 'W01005',     # ソウザ レムエル
    'kokiendou7@gmail.com': 'W021',          # 遠藤虹輝
    'yuin3034@gmail.com': 'W003',            # 中澤裕 (DB上が誰であれ、ユーザー指定を優先)
    'zuomuhezhen187@gmail.com': 'W006',       # 佐々木一真
    'matsuokajonas@gmail.com': 'W01000',      # 松岡ジョナス
    'bibisayuri2011@hotmail.com': 'W01003',   # 松岡ガブリエレ
    'umeokagroup@gmail.com': 'W002',          # 梅岡アレサンドレユウジ
    'umeokayudi@gmail.com': 'W002'            # エイリアス
}

def unescape_ics_text(text):
    if not text: return ""
    return text.replace('\\n', '\n').replace('\\,', ',').replace('\\;', ';').replace('\\\\', '\\')

def unfold_ics(content):
    # ICSのコンテンツをアンフォールド（改行＋スペース/タブを削除して結合）
    return re.sub(r'\r\n[ \t]', '', content).replace('\n ', '').replace('\r ', '')

def run_v11_step_by_step_import():
    print("--- STEP 1: CLEANUP ---")
    scan = table.scan(FilterExpression=boto3.dynamodb.conditions.Attr('type').eq('imported'))
    with table.batch_writer() as batch:
        deleted = 0
        for item in scan.get('Items', []):
            batch.delete_item(Key={'id': item['id']})
            deleted += 1
    print(f"Cleanup finished. Deleted {deleted} items.")

    print("--- STEP 2: MULTI-WORKER IMPORT ---")
    with open(ICS_FILE, 'r', encoding='utf-8') as f:
        content = unfold_ics(f.read())
    
    raw_events = re.findall(r'BEGIN:VEVENT.*?END:VEVENT', content, re.DOTALL)
    now = datetime.now().isoformat() + 'Z'
    total_new_items = 0
    
    for raw in raw_events:
        # フィールド抽出
        m = re.search(r'SUMMARY:(.*)', raw); summary = unescape_ics_text(m.group(1).strip()) if m else ""
        m = re.search(r'DESCRIPTION:(.*?)(\r?\n[A-Z]|$)', raw, re.DOTALL); description = unescape_ics_text(m.group(1).strip()) if m else ""
        m = re.search(r'DTSTART[:;].*?:(\d{8}T\d{6}Z?)', raw); dtstart_str = m.group(1).strip() if m else ""
        m = re.search(r'UID:(.*)', raw); uid = m.group(1).strip() if m else ""
        # 参加者を全員拾う
        attendee_emails = re.findall(r'ATTENDEE.*?:mailto:([^\s;]+)', raw)
        
        if not dtstart_str: continue
        
        try:
            dt = datetime.strptime(dtstart_str[:15], '%Y%m%dT%H%M%S') + timedelta(hours=9)
            date_str = dt.strftime('%Y-%m-%d')
            
            # 今回は店名クリーンアップもごくシンプルに
            target_name = re.sub(r'^【[^】]+】\s*', '', summary).strip()

            # 参加者の中でマッピングに一致する「全員」に対してデータを作成
            matched_worker_ids = []
            for email in attendee_emails:
                e = email.lower().strip()
                if e in GUEST_MAP:
                    matched_worker_ids.append(GUEST_MAP[e])
            
            # 重複排除
            matched_worker_ids = list(set(matched_worker_ids))
            
            # マッチした人数分だけ、または未割当として1件作成
            targets = matched_worker_ids if matched_worker_ids else [None]
            
            for worker_id in targets:
                # 誰の行に出るかを決定する ID
                # 複数人の場合は ID を変える必要がある
                suffix = f"-{worker_id}" if worker_id else "-UNASSIGNED"
                schedule_id = f"SCH-{dt.strftime('%Y%m%d')}-{uuid.uuid4().hex[:4].upper()}{suffix}"
                
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
                    'description': description,
                    'status': 'scheduled',
                    'work_type': '定期清掃' if '定期' in summary else 'cleaning',
                    'origin': 'google_ics',
                    'external_id': uid,
                    'type': 'imported',
                    'created_at': now,
                    'updated_at': now
                }
                
                if worker_id:
                    item['worker_id'] = worker_id
                    item['assigned_to'] = worker_id
                
                table.put_item(Item=item)
                total_new_items += 1

        except Exception as e:
            print(f"Error: {e}")

    print(f"Step 2 finished. Created {total_new_items} DynamoDB items (Multi-worker supportive).")

if __name__ == "__main__":
    run_v11_step_by_step_import()
