import boto3
import datetime
import uuid
from boto3.dynamodb.conditions import Key, Attr

# Initialize DynamoDB
dynamodb = boto3.resource('dynamodb', region_name='ap-northeast-1')

SCHEDULES_TABLE = dynamodb.Table('schedules')
STORES_TABLE = dynamodb.Table('misesapo-stores')

def create_requested_schedules():
    # Ensure Test Store Exists
    store_id = "TEST-STORE-001"
    store_name = "テスト店舗 渋谷店（検証用）"
    
    # Check if store exists, if not create (simplified)
    # We'll just assume it exists or put it to be safe, like setup_test_data.py did
    STORES_TABLE.put_item(Item={
        'id': store_id,
        'client_id': "TEST-CLIENT-001",
        'name': store_name,
        'address': "東京都渋谷区道玄坂1-1-1",
        'phone': "03-0000-0000",
        'status': 'active',
        'created_at': datetime.datetime.now().isoformat(),
        'updated_at': datetime.datetime.now().isoformat()
    })

    # Requested Schedules
    requests = [
        {"date": "2025-12-29", "time": "08:00"},
        {"date": "2025-12-29", "time": "12:00"},
        {"date": "2025-12-30", "time": "16:00"},
    ]

    print("Creating requested test schedules...")

    for req in requests:
        date_str = req["date"]
        time_str = req["time"]
        
        # Unique ID
        schedule_id = f"SCH-TEST-{date_str.replace('-','')}-{time_str.replace(':','')}-{uuid.uuid4().hex[:4]}"
        
        item = {
            'id': schedule_id,
            'store_id': store_id,
            'store_name': store_name,
            'client_name': "テスト株式会社（検証用）",
            # 'worker_id': None, # Unassigned
            'date': date_str,
            'scheduled_date': date_str,
            'time': time_str,
            'scheduled_time': time_str,
            'time_slot': time_str,
            'status': 'draft', # Draft = Request
            'cleaning_items': [
                {'name': 'フロア清掃'},
                {'name': 'トイレ清掃'}
            ],
            'notes': f'{date_str} {time_str} のテスト依頼書です。',
            'created_at': datetime.datetime.now().isoformat(),
            'updated_at': datetime.datetime.now().isoformat()
        }
        
        SCHEDULES_TABLE.put_item(Item=item)
        print(f"Created: {date_str} {time_str} (ID: {schedule_id})")

    print("\nDone! Please refresh the calendar.")

if __name__ == "__main__":
    create_requested_schedules()
