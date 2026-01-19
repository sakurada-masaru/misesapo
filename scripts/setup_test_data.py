import boto3
import json
import datetime
import uuid
import os
import sys
from boto3.dynamodb.conditions import Key, Attr

# Initialize DynamoDB
dynamodb = boto3.resource('dynamodb', region_name='ap-northeast-1')

WORKERS_TABLE = dynamodb.Table('workers')
CLIENTS_TABLE = dynamodb.Table('misesapo-clients')
STORES_TABLE = dynamodb.Table('misesapo-stores')
SCHEDULES_TABLE = dynamodb.Table('schedules')

TARGET_EMAIL = "info@misesapo.co.jp"

def setup_test_data():
    print(f"Searching for user with email: {TARGET_EMAIL}...")
    
    # 1. Find User
    response = WORKERS_TABLE.scan(
        FilterExpression=Attr('email').eq(TARGET_EMAIL)
    )
    items = response.get('Items', [])
    
    if not items:
        print(f"Error: User with email {TARGET_EMAIL} not found.")
        return
    
    worker = items[0]
    worker_id = worker['id']
    worker_name = worker.get('name', 'Unknown')
    print(f"Found user: {worker_name} (ID: {worker_id})")

    # 2. Create Test Client
    client_id = "TEST-CLIENT-001"
    client_name = "テスト株式会社（検証用）"
    
    print(f"Creating/Updating Test Client: {client_name}...")
    CLIENTS_TABLE.put_item(Item={
        'id': client_id,
        'name': client_name,
        'company_name': client_name,
        'status': 'active',
        'created_at': datetime.datetime.now().isoformat(),
        'updated_at': datetime.datetime.now().isoformat()
    })

    # 3. Create Test Store
    store_id = "TEST-STORE-001"
    store_name = "テスト店舗 渋谷店（検証用）"
    
    print(f"Creating/Updating Test Store: {store_name}...")
    STORES_TABLE.put_item(Item={
        'id': store_id,
        'client_id': client_id,
        'name': store_name,
        'address': "東京都渋谷区道玄坂1-1-1",
        'phone': "03-0000-0000",
        'status': 'active',
        'created_at': datetime.datetime.now().isoformat(),
        'updated_at': datetime.datetime.now().isoformat()
    })

    # 4. Create Test Schedule (Today)
    today = datetime.datetime.now()
    date_str = today.strftime('%Y-%m-%d')
    # Schedule for 1 hour later (or current time if logical)
    # Let's verify 'upcoming' logic. needs to be today or future.
    # Set time to now + 30 mins to be safe
    scheduled_time = (today + datetime.timedelta(minutes=30)).strftime('%H:%M')
    
    schedule_id = f"SCH-TEST-{today.strftime('%Y%m%d')}-001"
    
    print(f"Creating Test Schedule: {schedule_id} for {date_str} {scheduled_time}...")
    
    schedule_item = {
        'id': schedule_id,
        'store_id': store_id,
        'store_name': store_name,
        'client_name': client_name,
        'worker_id': worker_id,
        'worker_name': worker_name,
        'date': date_str,
        'scheduled_date': date_str,
        'time': scheduled_time,
        'scheduled_time': scheduled_time,
        'time_slot': scheduled_time,
        'status': 'scheduled', # Important for it to show up as "upcoming"
        'cleaning_items': [
            {'name': 'フロア清掃'},
            {'name': 'トイレ清掃'},
            {'name': 'ガラス清掃'}
        ],
        'notes': 'これは自動生成されたエンドツーエンドテスト用の案件です。自由に操作してください。',
        'created_at': datetime.datetime.now().isoformat(),
        'updated_at': datetime.datetime.now().isoformat()
    }
    
    SCHEDULES_TABLE.put_item(Item=schedule_item)
    
    print("Test data setup completed successfully!")
    print("\n-------------------------------------------")
    print(f"User: {worker_name} ({TARGET_EMAIL})")
    print(f"Client: {client_name}")
    print(f"Store: {store_name}")
    print(f"Schedule: {date_str} {scheduled_time}")
    print("-------------------------------------------\n")

if __name__ == "__main__":
    try:
        setup_test_data()
    except Exception as e:
        print(f"An error occurred: {e}")
