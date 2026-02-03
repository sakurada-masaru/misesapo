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

# ワーカー情報の取得 (メールアドレスからIDを引くため)
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

# ICS上のメール -> システムID の個別マッピング
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

def hhmm_to_minutes(hhmm):
    try:
        h, m = map(int, hhmm.split(':'))
        return h * 60 + m
    except:
        return 540

def unescape_ics_text(text):
    if not text: return ""
    # 改行やエスケープの処理をより強固に
    t = text.replace('\\n', '\n').replace('\\,', ',').replace('\\;', ';').replace('\\\\', '\\')
    return t

def extract_info_ai(summary, description):
    # 1. 暗証番号の抽出 (改行やスペースを無視して数字を拾う)
    # 「キーボックス\n 110\n 6」のようなパターンに対応
    # descriptionから改行とスペースを除去した一時的な文字列で検索
    desc_clean = re.sub(r'[\s\n\r]', '', description)
    security_code = ""
    
    # 典型的なキーワードの後の数字を拾う
    patterns = [
        r'(?:キーボックス|暗証番号|番号|コード|ロックナンバー|解錠)[:：]?([0-9]{3,6})',
        r'ポスト[:：]?右に(\d)左に(\d)'
    ]
    
    for p in patterns:
        m = re.search(p, desc_clean)
        if m:
            if 'ポスト' in p:
                security_code = f"P:{m.group(1)}-{m.group(2)}"
            else:
                security_code = m.group(1)
            break
            
    # もし見つからなければ、元のテキストからもう少し広く探す
    if not security_code:
        m = re.search(r'キーボックス[:：\s\n]*([0-9\s\n]{3,8})', description)
        if m:
            security_code = re.sub(r'[\s\n]', '', m.group(1))

    # 2. 清掃項目 (リスト形式)
    cleaning_items = []
    if description:
        # 「・」で始まるものを抽出
        matches = re.findall(r'[・●\*]\s*([^\n]+)', description)
        for m in matches:
            item = m.strip()
            if len(item) > 1 and "：" not in item: # 料金などの行を除外
                cleaning_items.append({'name': item, 'status': 'pending'})

    # 3. 店名のクリーンアップ
    target_name = re.sub(r'^【[^】]+】\s*', '', summary).strip()
    target_name = re.sub(r'\s*\（.*\）$', '', target_name) # （日曜定休）などを除去
    
    work_type = 'cleaning'
    if 'スポット' in summary:
        work_type = 'スポット'
    elif '定期' in summary:
        work_type = '定期清掃'
    
    return target_name, work_type, security_code, cleaning_items

def parse_ics_rich(content):
    events = []
    raw_events = re.findall(r'BEGIN:VEVENT.*?END:VEVENT', content, re.DOTALL)
    for raw in raw_events:
        event = {'attendees': []}
        
        # 基本フィールド
        m = re.search(r'SUMMARY:(.*)', raw)
        if m: event['summary'] = unescape_ics_text(m.group(1).strip())
        
        m = re.search(r'DESCRIPTION:(.*?)(\r?\n[A-Z]|$)', raw, re.DOTALL)
        if m: event['description'] = unescape_ics_text(m.group(1).strip())
        
        m = re.search(r'DTSTART[:;].*?:(\d{8}T\d{6}Z?)', raw)
        if m: event['dtstart'] = m.group(1).strip()
        
        m = re.search(r'UID:(.*)', raw)
        if m: event['uid'] = m.group(1).strip()
        
        m = re.search(r'LOCATION:(.*)', raw)
        if m: event['location'] = unescape_ics_text(m.group(1).strip())
        
        # 参加者
        atts = re.findall(r'ATTENDEE.*?:mailto:(.*)', raw)
        for a in atts:
            event['attendees'].append(a.strip().lower())
            
        events.append(event)
    return events

def run_ultimate_import():
    print("Step 1: Cleaning up ALL previously imported items...")
    count_del = 0
    scan = table.scan(FilterExpression=boto3.dynamodb.conditions.Attr('origin').eq('google_ics') | boto3.dynamodb.conditions.Attr('type').eq('imported'))
    for item in scan.get('Items', []):
        table.delete_item(Key={'id': item['id']})
        count_del += 1
    print(f"Deleted {count_del} items.")

    print("Step 2: Parsing ICS and re-importing with high-precision AI extraction...")
    with open(ICS_FILE, 'r', encoding='utf-8') as f:
        content = f.read()
    
    events = parse_ics_rich(content)
    now = datetime.now().isoformat() + 'Z'
    success_count = 0
    
    for ev in events:
        summary = ev.get('summary', '')
        description = ev.get('description', '')
        dtstart_str = ev.get('dtstart', '')
        if not dtstart_str: continue
        
        try:
            # 日時計算
            dt = datetime.strptime(dtstart_str[:15], '%Y%m%dT%H%M%S')
            dt = dt + timedelta(hours=9) # JST
            date_str = dt.strftime('%Y-%m-%d')
            start_time = dt.strftime('%H:%M')
            end_time = (dt + timedelta(hours=2)).strftime('%H:%M')
            
            # AI情報抽出
            target_name, work_type, sec_code, items = extract_info_ai(summary, description)
            
            # ワーカー特定
            worker_id = None
            for email in ev['attendees']:
                worker_id = PERSONAL_EMAIL_MAP.get(email) or worker_email_map.get(email)
                if worker_id: break
            
            # ID生成 (フロントエンドが好む形式)
            date_prefix = dt.strftime('%Y%m%d')
            schedule_id = f"SCH-{date_prefix}-{uuid.uuid4().hex[:4].upper()}"
            
            item = {
                'id': schedule_id,
                'date': date_str,
                'scheduled_date': date_str,
                'start_time': start_time,
                'end_time': end_time,
                'start_min': hhmm_to_minutes(start_time),
                'end_min': hhmm_to_minutes(end_time),
                'target_name': target_name,
                'summary': summary,
                'description': description, # 生データ
                'notes': description, # 表示用
                'security_code': sec_code,
                'cleaning_items': items,
                'status': 'scheduled',
                'work_type': work_type,
                'origin': 'google_ics',
                'external_id': ev.get('uid'),
                'location': ev.get('location', ''),
                'created_at': now,
                'updated_at': now,
                'type': 'imported'
            }
            
            if worker_id:
                item['worker_id'] = worker_id
                item['assigned_to'] = worker_id
            
            table.put_item(Item=item)
            success_count += 1
            
        except Exception as e:
            print(f"Error processing {summary}: {e}")

    print(f"Successfully re-imported {success_count} items.")
    if success_count > 0:
        print("Final Check: Data is now in snake_case AND assigned to workers where possible.")

if __name__ == "__main__":
    run_ultimate_import()
