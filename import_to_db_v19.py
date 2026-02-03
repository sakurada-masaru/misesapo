import boto3
import re
import uuid
from datetime import datetime, timedelta

# 設定
REGION = 'ap-northeast-1'
SCHEDULES_TABLE = 'schedules'
STORES_TABLE = 'misesapo-stores'
ICS_FILE = '/Users/sakuradamasaru/Desktop/misesapo/basic.ics'

dynamodb = boto3.resource('dynamodb', region_name=REGION)
schedules_table = dynamodb.Table(SCHEDULES_TABLE)
stores_table = dynamodb.Table(STORES_TABLE)

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

def get_all_stores():
    print("Fetching store master data...")
    stores = []
    response = stores_table.scan()
    stores.extend(response.get('Items', []))
    while 'LastEvaluatedKey' in response:
        response = stores_table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
        stores.extend(response.get('Items', []))
    return stores

def normalize(text):
    if not text: return ""
    # カタカナ/ひらがな/英数字の正規化（簡易版）
    text = text.lower()
    text = re.sub(r'[株式会社|有限会社|（株）|\(株\)|店|支店]', '', text)
    return text.strip()

def find_matched_store(summary, stores):
    summary_norm = normalize(summary)
    if not summary_norm: return None
    
    # 1. 完全一致（正規化後）
    for s in stores:
        name_norm = normalize(s.get('name', ''))
        brand_norm = normalize(s.get('brand_name', ''))
        
        if name_norm and (name_norm in summary_norm or summary_norm in name_norm):
            if len(name_norm) > 2: return s # 1-2文字だと誤爆するので注意
            
        if brand_norm and (brand_norm in summary_norm or summary_norm in brand_norm):
            if len(brand_norm) > 2: return s

    # 2. キーワード抽出によるマッチング（Yakitaroなどの固有名詞）
    # 記号を除去して単語に分割
    words = re.findall(r'[a-zA-Z\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF0-9]+', summary_norm)
    for word in words:
        if len(word) < 2: continue
        if word in ["定期", "清掃", "再清掃", "スポット", "調査"]: continue
        
        for s in stores:
            name = s.get('name', '').lower()
            brand = s.get('brand_name', '').lower()
            if word in name or word in brand:
                return s
                
    return None

def run_v19_ultra_smart_import():
    print("STEP 8: ULTRA Smart Importing with improved matching...")
    stores_master = get_all_stores()
    
    # 既存のインポートデータ（type=importedのもの）を一度リセット
    scan = schedules_table.scan(FilterExpression=boto3.dynamodb.conditions.Attr('type').eq('imported'))
    with schedules_table.batch_writer() as batch:
        for item in scan.get('Items', []):
            batch.delete_item(Key={'id': item['id']})

    with open(ICS_FILE, 'r', encoding='utf-8') as f:
        content = unfold_ics(f.read())
    
    events = re.findall(r'BEGIN:VEVENT.*?END:VEVENT', content, re.DOTALL)
    now = datetime.now().isoformat() + 'Z'
    count = 0
    accident_count = 0
    spot_count = 0
    mapped_count = 0
    
    for raw in events:
        m_summary = re.search(r'SUMMARY:(.*)', raw)
        m_description = re.search(r'DESCRIPTION:(.*)', raw, re.DOTALL)
        m_start = re.search(r'DTSTART[:;].*?:(\d{8}T\d{6}Z?)', raw)
        
        if not m_start: continue
        dtstart = m_start.group(1).strip()
        
        summary = m_summary.group(1).strip() if m_summary else ""
        description = m_description.group(1).strip() if m_description else ""
        
        # 事故・スポット判定（説明文も含む）
        is_accident = ("再清掃" in summary) or ("再清掃" in description)
        is_spot = ("スポット" in summary) or ("スポット" in description)
        
        # 2月のデータ、または事故案件などは全件対象
        is_target_date = dtstart.startswith('202602') or dtstart.startswith('202601') or dtstart.startswith('202603')
        if not (is_target_date or is_accident):
            continue

        matched_store = find_matched_store(summary, stores_master)
        
        uid_match = re.search(r'UID:(.*)', raw)
        uid = uid_match.group(1).strip() if uid_match else str(uuid.uuid4())
        attendees = re.findall(r'ATTENDEE.*?:mailto:([^\s;]+)', raw)
        
        try:
            if "TZID=" in raw:
                dt = datetime.strptime(dtstart[:15], '%Y%m%dT%H%M%S')
            else:
                dt = datetime.strptime(dtstart[:15], '%Y%m%dT%H%M%S') + timedelta(hours=9)
            
            date_str = dt.strftime('%Y-%m-%d')
            matched_worker_ids = list(set([GUEST_MAP[e.lower().strip()] for e in attendees if e.lower().strip() in GUEST_MAP]))
            
            prefix = "ACC" if is_accident else ("STP" if is_spot else "SCH")
            item_id = f"{prefix}-{dt.strftime('%Y%m%d')}-{hash(uid) % 10000:04X}"
            
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
                'origin': 'google_ics_ultra',
                'external_id': uid,
                'type': 'imported',
                'worker_ids': matched_worker_ids,
                'created_at': now,
                'updated_at': now
            }
            
            if is_accident:
                item['is_accident'] = True
                item['work_type'] = '再清掃'
                accident_count += 1
            elif is_spot:
                item['order_type'] = 'spot'
                item['work_type'] = 'スポット清掃'
                spot_count += 1
            else:
                item['work_type'] = '定期清掃'
            
            if matched_store:
                item['store_id'] = matched_store.get('id')
                item['client_id'] = matched_store.get('id')
                item['store_name'] = matched_store.get('name')
                item['client_name'] = matched_store.get('client_name', '')
                item['brand_name'] = matched_store.get('brand_name', '')
                item['address'] = matched_store.get('address', '')
                mapped_count += 1
                # マッピングされたら target_name を「ブランド名 店名」に整える（ご要望に応える）
                item['target_name'] = f"{item['brand_name']} {item['store_name']}"
                if is_accident: item['target_name'] = f"【再清掃】{item['target_name']}"
                if is_spot: item['target_name'] = f"【スポット】{item['target_name']}"
            else:
                # マッピングされなかった場合でも最低限表示されるように
                # target_name はそのまま（要契約確認のようなデフォルトにはしない）
                pass

            if matched_worker_ids:
                item['worker_id'] = matched_worker_ids[0]
                item['assigned_to'] = matched_worker_ids[0]
            
            schedules_table.put_item(Item=item)
            count += 1

        except Exception as e:
            print(f"Error processing {summary}: {e}")

    print(f"STEP 8 FINISHED. Total: {count}, Accidents: {accident_count}, Spots: {spot_count}, Mapped: {mapped_count}")

if __name__ == "__main__":
    run_v19_ultra_smart_import()
