import boto3
import re
import uuid
from datetime import datetime, timedelta

# 設定
REGION = 'ap-northeast-1'
SCHEDULES_TABLE = 'schedules'
STORES_TABLE = 'misesapo-stores'
CLIENTS_TABLE = 'misesapo-clients'
ICS_FILE = '/Users/sakuradamasaru/Desktop/misesapo/basic.ics'

dynamodb = boto3.resource('dynamodb', region_name=REGION)
schedules_table = dynamodb.Table(SCHEDULES_TABLE)
stores_table = dynamodb.Table(STORES_TABLE)

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

def get_all_stores():
    print("Fetching store master data...")
    stores = []
    response = stores_table.scan()
    stores.extend(response.get('Items', []))
    while 'LastEvaluatedKey' in response:
        response = stores_table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
        stores.extend(response.get('Items', []))
    return stores

def find_matched_store(summary, stores):
    # 名前で完全一致に近いものを探す
    # SUMMARYから余計な接頭辞を除去
    clean_summary = re.sub(r'【.*?】', '', summary).strip()
    
    # 1. 店名(name)またはブランド名(brand_name)がSUMMARYに含まれているか
    for s in stores:
        name = s.get('name', '')
        brand = s.get('brand_name', '')
        if name and name in summary:
            return s
        if brand and brand in summary:
            return s
            
    # 2. クライアント名が含まれているか
    for s in stores:
        client = s.get('client_name', '')
        if client and client in summary:
            return s
            
    return None

def run_v18_smart_import():
    print("STEP 7: Smart Importing with Store Matching & Spot Detection...")
    
    stores_master = get_all_stores()
    
    # 既存のインポートデータを削除
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
        
        summary = m_summary.group(1).strip() if m_summary else ""
        description = m_description.group(1).strip() if m_description else ""
        
        # 2月のデータのみ対象にする（あるいは全件）
        m_start = re.search(r'DTSTART[:;].*?:(\d{8}T\d{6}Z?)', raw)
        if not m_start: continue
        
        dtstart = m_start.group(1).strip()
        # 2026年を見つける
        if not dtstart.startswith('202602'):
            # 再清掃案件などは過去のものでも重要かもしれないが、
            # とりあえず今の表示範囲(2月)を優先
            # ※全件だと重いので、表示範囲+αに絞る
            if not (dtstart.startswith('202601') or dtstart.startswith('202603')):
                continue

        # 特徴判定
        is_accident = "再清掃" in summary or "再清掃" in description
        is_spot = "スポット" in summary or "スポット" in description
        
        # 店名マッチング
        matched_store = find_matched_store(summary, stores_master)
        
        uid = re.search(r'UID:(.*)', raw)
        uid = uid.group(1).strip() if uid else str(uuid.uuid4())
        attendees = re.findall(r'ATTENDEE.*?:mailto:([^\s;]+)', raw)
        
        try:
            if "TZID=" in raw:
                dt = datetime.strptime(dtstart[:15], '%Y%m%dT%H%M%S')
            else:
                dt = datetime.strptime(dtstart[:15], '%Y%m%dT%H%M%S') + timedelta(hours=9)
            
            date_str = dt.strftime('%Y-%m-%d')
            
            matched_worker_ids = []
            for email in attendees:
                e = email.lower().strip()
                if e in GUEST_MAP:
                    matched_worker_ids.append(GUEST_MAP[e])
            
            matched_worker_ids = list(set(matched_worker_ids))
            
            # ID生成（事故案件なら分かりやすく）
            prefix = "ACC" if is_accident else "SCH"
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
                'origin': 'google_ics_smart',
                'external_id': uid,
                'type': 'imported',
                'worker_ids': matched_worker_ids,
                'created_at': now,
                'updated_at': now
            }
            
            # フラグセット
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
            
            # マスターデータとの紐付け（重要：これでカルテが表示される）
            if matched_store:
                item['store_id'] = matched_store.get('id')
                item['client_id'] = matched_store.get('id') # このシステムでは一部 store_id=client_id
                item['store_name'] = matched_store.get('name')
                item['client_name'] = matched_store.get('client_name')
                item['brand_name'] = matched_store.get('brand_name')
                item['address'] = matched_store.get('address', '')
                mapped_count += 1

            if matched_worker_ids:
                item['worker_id'] = matched_worker_ids[0]
                item['assigned_to'] = matched_worker_ids[0]
            
            schedules_table.put_item(Item=item)
            count += 1

        except Exception as e:
            print(f"Error processing {summary}: {e}")

    print(f"STEP 7 FINISHED. Total: {count}, Accidents: {accident_count}, Spots: {spot_count}, Mapped to Stores: {mapped_count}")

if __name__ == "__main__":
    run_v18_smart_import()
