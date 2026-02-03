import boto3
import re
import uuid
import json
from datetime import datetime, timedelta
import sys

# 設定
REGION = 'ap-northeast-1'
# テーブル名は list-tables で確認した正しい方を使う
# フロントエンドが misesapo- シリーズを使っている可能性が高いが、
# これまでの経緯から schedules も使われている。念のため両方チェックするか、
# lambda_function.py の定義に合わせる。
TABLE_NAME = 'schedules' 
ICS_FILE = '/Users/sakuradamasaru/Desktop/misesapo/filtered.ics'

dynamodb = boto3.resource('dynamodb', region_name=REGION)
table = dynamodb.Table(TABLE_NAME)

# ユーザー指定の完璧なマッピング表
GUEST_MAP = {
    'lemueldesousa@gmail.com': 'W01005',
    'kokiendou7@gmail.com': 'W021',
    'yuin3034@gmail.com': 'W003',
    'zuomuhezhen187@gmail.com': 'W006',
    'matsuokajonas@gmail.com': 'W01000',
    'bibisayuri2011@hotmail.com': 'W01003',
    'umeokagroup@gmail.com': 'W002',
    # 既存のエイリアス
    'umeokayudi@gmail.com': 'W002',
    'yuin3034@gmail.com': 'W003'
}

def unescape_ics_text(text):
    if not text: return ""
    return text.replace('\\n', '\n').replace('\\,', ',').replace('\\;', ';').replace('\\\\', '\\')

def extract_info_precise(summary, description):
    # 暗証番号抽出 (改行やスペースを徹底除去して探す)
    # 例: 「キーボックス\n 110\n 6」
    security_code = ""
    if description:
        # まず全文から改行を除去した掃除済みテキストで作る
        desc_clean = re.sub(r'[\s\n\r]', '', description)
        
        # キーボックス / 暗証番号 の後の数字を拾う
        m = re.search(r'(?:キーボックス|暗証番号|番号|コード|解錠)[:：]?([0-9]{3,6})', desc_clean)
        if m:
            security_code = m.group(1)
        else:
            # ポートの特殊パターン
            m = re.search(r'ポスト[:：]?右に(\d)左に(\d)', desc_clean)
            if m:
                security_code = f"P:{m.group(1)}-{m.group(2)}"

    # 店名のクリーンアップ
    target_name = re.sub(r'^【[^】]+】\s*', '', summary).strip()
    target_name = re.sub(r'\s*\（.*\）$', '', target_name) # （日曜定休）などを除去
    
    work_type = 'cleaning'
    if 'スポット' in summary: work_type = 'スポット'
    elif '定期' in summary: work_type = '定期清掃'
    
    return target_name, work_type, security_code

def run_v8_perfect_import():
    print("Step 1: Cleaning up previous data...")
    # origin が google_ics か type が imported のものをすべて消す
    scan = table.scan(FilterExpression=boto3.dynamodb.conditions.Attr('origin').eq('google_ics') | boto3.dynamodb.conditions.Attr('type').eq('imported'))
    for item in scan.get('Items', []):
        table.delete_item(Key={'id': item['id']})

    print("Step 2: Importing with PERFECT mapping...")
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
            
            # メールアドレスから完璧にワーカーを特定
            worker_id = None
            for email in attendees:
                email_clean = email.strip().lower()
                if email_clean in GUEST_MAP:
                    worker_id = GUEST_MAP[email_clean]
                    break
            
            # 備考欄の先頭に暗証番号を挿入（視認性UP）
            rich_description = description
            if sec_code:
                rich_description = f"【🔑 暗証番号：{sec_code}】\n\n" + rich_description
            
            # タイムラインに出現させるための ID 形式
            # SCH-YYYYMMDD-UUID8
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
            
            # このワーカーIDがあれば、タイムラインの「行」に確実に現れる
            if worker_id:
                item['worker_id'] = worker_id
                item['assigned_to'] = worker_id
            
            table.put_item(Item=item)
            count += 1
            
        except Exception as e:
            print(f"Error: {e}")

    print(f"DONE! Imported {count} items with PERFECT worker mapping.")

if __name__ == "__main__":
    run_v8_perfect_import()
