import boto3
import re
import uuid
from datetime import datetime, timedelta
from calendar import monthrange

# 設定
REGION = 'ap-northeast-1'
SCHEDULES_TABLE = 'schedules'
STORES_TABLE = 'misesapo-stores'
ICS_FILE = '/Users/sakuradamasaru/Desktop/misesapo/filtered.ics'

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
    'umeokayudi@gmail.com': 'W002',
    'gabrielamayumi444@gmail.com': 'W01003',
    'noemi_midory@hotmail.com': 'W740024',
    'midory@misesapo.co.jp': 'W740024',
}

WEEKDAY_MAP = {'MO': 0, 'TU': 1, 'WE': 2, 'TH': 3, 'FR': 4, 'SA': 5, 'SU': 6}

def unfold_ics(content):
    return re.sub(r'(\r?\n)+[ \t]', '', content)

def get_all_stores():
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
    text = re.sub(r'株式会社|有限会社|（株）|\(株\)|店|支店', '', text)
    text = re.sub(r'[\s　\-\[\]【】\(\)（）]', '', text)
    return text

def find_matched_store(summary, stores):
    summary_norm = normalize(summary)
    if not summary_norm: return None
    for s in stores:
        name_norm = normalize(s.get('name', ''))
        brand_norm = normalize(s.get('brand_name', ''))
        if name_norm and (name_norm in summary_norm or summary_norm in name_norm):
            if len(name_norm) >= 2: return s
        if brand_norm and (brand_norm in summary_norm or summary_norm in brand_norm):
            if len(brand_norm) >= 2: return s
    return None

def get_nth_weekday_of_month(year, month, weekday, n):
    """月のn番目の特定曜日の日付を取得"""
    first_day = datetime(year, month, 1)
    first_weekday = first_day.weekday()
    days_until = (weekday - first_weekday) % 7
    first_occurrence = first_day + timedelta(days=days_until)
    target = first_occurrence + timedelta(weeks=n-1)
    if target.month != month:
        return None
    return target

def expand_rrule(dtstart, rrule_str, target_start, target_end):
    """RRULEを展開して対象期間内の日付リストを返す"""
    occurrences = []
    
    freq_match = re.search(r'FREQ=(\w+)', rrule_str)
    interval_match = re.search(r'INTERVAL=(\d+)', rrule_str)
    byday_match = re.search(r'BYDAY=(\d*)(\w{2})', rrule_str)
    until_match = re.search(r'UNTIL=(\d{8})', rrule_str)
    
    freq = freq_match.group(1) if freq_match else 'MONTHLY'
    interval = int(interval_match.group(1)) if interval_match else 1
    until = datetime.strptime(until_match.group(1), '%Y%m%d') if until_match else target_end
    
    if byday_match:
        nth = int(byday_match.group(1)) if byday_match.group(1) else 1
        weekday = WEEKDAY_MAP.get(byday_match.group(2), 0)
    else:
        nth = None
        weekday = None
    
    current = dtstart
    
    while current <= until and current <= target_end:
        if current >= target_start:
            if freq == 'MONTHLY':
                if nth and weekday is not None:
                    occ = get_nth_weekday_of_month(current.year, current.month, weekday, nth)
                    if occ and occ >= target_start and occ <= target_end:
                        occ = occ.replace(hour=dtstart.hour, minute=dtstart.minute)
                        occurrences.append(occ)
                else:
                    occurrences.append(current)
        
        if freq == 'MONTHLY':
            month = current.month + interval
            year = current.year + (month - 1) // 12
            month = (month - 1) % 12 + 1
            day = min(current.day, monthrange(year, month)[1])
            current = current.replace(year=year, month=month, day=day)
        elif freq == 'WEEKLY':
            current += timedelta(weeks=interval)
        elif freq == 'DAILY':
            current += timedelta(days=interval)
        else:
            break
            
        if len(occurrences) > 50:
            break
    
    return occurrences

def run_v21_rrule_import():
    print("STEP 10: Importing with RRULE expansion...")
    stores_master = get_all_stores()
    print(f"Loaded {len(stores_master)} stores")
    
    # 古いインポートデータを削除
    from boto3.dynamodb.conditions import Attr
    scan = schedules_table.scan(FilterExpression=Attr('type').eq('imported'))
    deleted = 0
    with schedules_table.batch_writer() as batch:
        for item in scan.get('Items', []):
            batch.delete_item(Key={'id': item['id']})
            deleted += 1
    print(f"Deleted {deleted} old imported items")
    
    with open(ICS_FILE, 'r', encoding='utf-8') as f:
        content = unfold_ics(f.read())
    
    events = re.findall(r'BEGIN:VEVENT.*?END:VEVENT', content, re.DOTALL)
    now = datetime.now().isoformat() + 'Z'
    
    # 対象期間: 2026年2月〜3月
    target_start = datetime(2026, 2, 1)
    target_end = datetime(2026, 3, 31)
    
    count = 0
    accident_count = 0
    
    for raw in events:
        m_summary = re.search(r'SUMMARY:(.*)', raw)
        m_description = re.search(r'DESCRIPTION:(.*)', raw, re.DOTALL)
        m_start = re.search(r'DTSTART.*?:(\d{8}T\d{6})', raw)
        m_rrule = re.search(r'RRULE:(.*)', raw)
        m_uid = re.search(r'UID:(.*)', raw)
        
        if not m_start: continue
        
        summary = m_summary.group(1).strip() if m_summary else ""
        description = m_description.group(1).strip() if m_description else ""
        dtstart_str = m_start.group(1).strip()
        rrule = m_rrule.group(1).strip() if m_rrule else None
        uid = m_uid.group(1).strip() if m_uid else str(uuid.uuid4())
        
        attendees = re.findall(r'ATTENDEE.*?:mailto:([^\s;]+)', raw)
        
        is_accident = ("再清掃" in summary) or ("再清掃" in description)
        matched_store = find_matched_store(summary, stores_master)
        matched_worker_ids = list(set([GUEST_MAP[e.lower().strip()] for e in attendees if e.lower().strip() in GUEST_MAP]))
        
        try:
            # TZID付きかどうかで処理を変える
            if "TZID=" in raw:
                dt = datetime.strptime(dtstart_str[:15], '%Y%m%dT%H%M%S')
            else:
                dt = datetime.strptime(dtstart_str[:15], '%Y%m%dT%H%M%S') + timedelta(hours=9)
            
            # RRULE展開
            if rrule:
                occurrences = expand_rrule(dt, rrule, target_start, target_end)
            else:
                # 単発イベント
                if target_start <= dt <= target_end:
                    occurrences = [dt]
                else:
                    occurrences = []
            
            for occ in occurrences:
                date_str = occ.strftime('%Y-%m-%d')
                
                prefix = "ACC" if is_accident else "SCH"
                item_id = f"{prefix}-{occ.strftime('%m%d')}-{hash(uid + date_str) % 10000:04X}"
                
                item = {
                    'id': item_id,
                    'date': date_str,
                    'scheduled_date': date_str,
                    'start_time': occ.strftime('%H:%M'),
                    'end_time': (occ + timedelta(hours=2)).strftime('%H:%M'),
                    'start_min': occ.hour * 60 + occ.minute,
                    'end_min': (occ.hour + 2) * 60 + occ.minute,
                    'target_name': summary,
                    'summary': summary,
                    'description': description[:500] if description else '',
                    'status': 'scheduled',
                    'work_type': '再清掃' if is_accident else '定期清掃',
                    'origin': 'google_ics_v21',
                    'external_id': uid,
                    'type': 'imported',
                    'worker_ids': matched_worker_ids,
                    'created_at': now,
                    'updated_at': now
                }
                
                if is_accident:
                    item['is_accident'] = True
                    accident_count += 1
                
                if matched_store:
                    item['store_id'] = matched_store.get('id')
                    item['store_name'] = matched_store.get('name')
                    item['brand_name'] = matched_store.get('brand_name', '')
                
                if matched_worker_ids:
                    item['worker_id'] = matched_worker_ids[0]
                    item['assigned_to'] = matched_worker_ids[0]
                
                schedules_table.put_item(Item=item)
                count += 1
                
        except Exception as e:
            print(f"Error: {summary[:30]} - {e}")
    
    print(f"STEP 10 FINISHED. Total: {count}, Accidents: {accident_count}")

if __name__ == "__main__":
    run_v21_rrule_import()
