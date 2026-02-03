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
    text = text.lower()
    # 一般的な接頭辞・接尾辞を除去
    text = re.sub(r'株式会社|有限会社|（株）|\(株\)|店|支店', '', text)
    # 記号・スペースを除去
    text = re.sub(r'[\s　\-\[\]【】\(\)（）]', '', text)
    return text

def find_matched_store(summary, stores):
    summary_norm = normalize(summary)
    if not summary_norm: return None
    
    # 1. 正規化後のキーワードが含まれているか
    for s in stores:
        name_norm = normalize(s.get('name', ''))
        brand_norm = normalize(s.get('brand_name', ''))
        
        # 店名がSUMMARYに含まれている、またはSUMMARYが店名に含まれている
        if name_norm and (name_norm in summary_norm or summary_norm in name_norm):
            if len(name_norm) >= 2: return s
            
        if brand_norm and (brand_norm in summary_norm or summary_norm in brand_norm):
            if len(brand_norm) >= 2: return s

    # 2. 単語分割によるマッチング
    words = re.findall(r'[a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]+', summary)
    for word in words:
        if len(word) < 2: continue
        if word in ["定期", "清掃", "再清掃", "スポット", "調査"]: continue
        
        word_norm = normalize(word)
        for s in stores:
            name_norm = normalize(s.get('name', ''))
            brand_norm = normalize(s.get('brand_name', ''))
            if word_norm in name_norm or word_norm in brand_norm:
                return s
                
    return None

def run_v20_final_import():
    print("STEP 9: FINAL Improved Import with robust regex and matching...")
    stores_master = get_all_stores()
    
    # リセット
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
    mapped_count = 0
    
    # 改良したDTSTART正規表現
    # DTSTART:20260204T010000Z や DTSTART;TZID=...:20260204... に対応
    re_start = re.compile(r'DTSTART[;:][^:]*?(\d{8}T\d{6}Z?)')
    
    for raw in events:
        m_summary = re.search(r'SUMMARY:(.*)', raw)
        m_description = re.search(r'DESCRIPTION:(.*)', raw, re.DOTALL)
        m_start = re_start.search(raw)
        
        if not m_start: continue
        dtstart = m_start.group(1).strip()
        
        summary = m_summary.group(1).strip() if m_summary else ""
        description = m_description.group(1).strip() if m_description else ""
        
        is_accident = ("再清掃" in summary) or ("再清掃" in description)
        is_spot = ("スポット" in summary) or ("スポット" in description)
        
        # 対象期間: 2026年1月〜3月 または 事故案件
        is_target_date = any(dtstart.startswith(d) for d in ['202601', '202602', '202603'])
        if not (is_target_date or is_accident):
            continue

        matched_store = find_matched_store(summary, stores_master)
        
        uid_match = re.search(r'UID:(.*)', raw)
        uid = uid_match.group(1).strip() if uid_match else str(uuid.uuid4())
        attendees = re.findall(r'ATTENDEE.*?:mailto:([^\s;]+)', raw)
        
        try:
            # 常にUTC+9として扱う（簡易化）
            dt = datetime.strptime(dtstart[:15], '%Y%m%dT%H%M%S') + timedelta(hours=9)
            date_str = dt.strftime('%Y-%m-%d')
            matched_worker_ids = list(set([GUEST_MAP[e.lower().strip()] for e in attendees if e.lower().strip() in GUEST_MAP]))
            
            prefix = "ACC" if is_accident else ("STP" if is_spot else "SCH")
            item_id = f"{prefix}-{dt.strftime('%m%d')}-{hash(uid) % 10000:04X}"
            
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
                'origin': 'google_ics_v20',
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
                
                # 表示名を「ブランド名 店舗名」に統一
                brand_and_store = f"{item['brand_name']} {item['store_name']}".strip()
                if is_accident:
                    item['target_name'] = f"【再清掃】{brand_and_store}"
                elif is_spot:
                    item['target_name'] = f"【スポット】{brand_and_store}"
                else:
                    item['target_name'] = brand_and_store
            
            if matched_worker_ids:
                item['worker_id'] = matched_worker_ids[0]
                item['assigned_to'] = matched_worker_ids[0]
            
            schedules_table.put_item(Item=item)
            count += 1

        except Exception as e:
            print(f"Error processing {summary}: {e}")

    print(f"STEP 9 FINISHED. Total: {count}, Accidents: {accident_count}, Mapped: {mapped_count}")

if __name__ == "__main__":
    run_v20_final_import()
