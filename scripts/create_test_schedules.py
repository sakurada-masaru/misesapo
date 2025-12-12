#!/usr/bin/env python3
"""
テスト用スケジュールを10個作成するスクリプト
"""

import boto3
import json
import uuid
from datetime import datetime, timedelta
from decimal import Decimal

# DynamoDBクライアント
dynamodb = boto3.resource('dynamodb', region_name='ap-northeast-1')
schedules_table = dynamodb.Table('schedules')

# テストデータ
test_stores = [
    {'name': '神楽坂店', 'client': '株式会社テスト', 'address': '東京都新宿区神楽坂1-1-1', 'phone': '03-1234-5678', 'email': 'test1@example.com'},
    {'name': '日本橋店', 'client': 'テスト商事株式会社', 'address': '東京都中央区日本橋1-2-3', 'phone': '03-2345-6789', 'email': 'test2@example.com'},
    {'name': '銀座店', 'client': '銀座テスト株式会社', 'address': '東京都中央区銀座2-3-4', 'phone': '03-3456-7890', 'email': 'test3@example.com'},
    {'name': '新宿店', 'client': '新宿テスト株式会社', 'address': '東京都新宿区新宿3-4-5', 'phone': '03-4567-8901', 'email': 'test4@example.com'},
    {'name': '渋谷店', 'client': '渋谷テスト株式会社', 'address': '東京都渋谷区渋谷4-5-6', 'phone': '03-5678-9012', 'email': 'test5@example.com'},
    {'name': '池袋店', 'client': '池袋テスト株式会社', 'address': '東京都豊島区池袋5-6-7', 'phone': '03-6789-0123', 'email': 'test6@example.com'},
    {'name': '上野店', 'client': '上野テスト株式会社', 'address': '東京都台東区上野6-7-8', 'phone': '03-7890-1234', 'email': 'test7@example.com'},
    {'name': '品川店', 'client': '品川テスト株式会社', 'address': '東京都港区品川7-8-9', 'phone': '03-8901-2345', 'email': 'test8@example.com'},
    {'name': '横浜店', 'client': '横浜テスト株式会社', 'address': '神奈川県横浜市8-9-10', 'phone': '045-9012-3456', 'email': 'test9@example.com'},
    {'name': '川崎店', 'client': '川崎テスト株式会社', 'address': '神奈川県川崎市9-10-11', 'phone': '044-0123-4567', 'email': 'test10@example.com'},
]

cleaning_items_list = [
    [{'name': 'レンジフード洗浄', 'notes': ['分解洗浄あり'], 'quantity': 1, 'unit': None}],
    [{'name': 'グリストラップ清掃', 'notes': [], 'quantity': 1, 'unit': None}],
    [{'name': 'レンジフード洗浄', 'notes': ['分解洗浄あり'], 'quantity': 1, 'unit': None}, {'name': 'グリストラップ清掃', 'notes': [], 'quantity': 1, 'unit': None}],
    [{'name': '換気扇清掃', 'notes': [], 'quantity': 2, 'unit': '台'}],
    [{'name': 'レンジフード洗浄', 'notes': ['分解洗浄あり'], 'quantity': 1, 'unit': None}, {'name': '換気扇清掃', 'notes': [], 'quantity': 1, 'unit': '台'}],
]

time_slots = [
    '10:00-12:00',
    '13:00-15:00',
    '15:00-17:00',
    '17:00-19:00',
    '19:00-21:00',
]

statuses = ['draft', 'draft', 'draft', 'scheduled', 'scheduled']  # 主にdraft、一部scheduled

def create_test_schedules():
    """テスト用スケジュールを10個作成"""
    now = datetime.utcnow().isoformat() + 'Z'
    
    # 今日から30日後までの日付を生成
    base_date = datetime.now()
    
    created_count = 0
    failed_count = 0
    
    for i in range(10):
        schedule_id = str(uuid.uuid4())
        store = test_stores[i]
        
        # 日付は今日からi*3日後
        schedule_date = (base_date + timedelta(days=i*3)).strftime('%Y-%m-%d')
        
        # ステータスとタイムスロットをランダムに選択
        status = statuses[i % len(statuses)]
        time_slot = time_slots[i % len(time_slots)]
        cleaning_items = cleaning_items_list[i % len(cleaning_items_list)]
        
        schedule_item = {
            'id': schedule_id,
            'created_at': now,
            'updated_at': now,
            'date': schedule_date,
            'time_slot': time_slot,
            'order_type': 'regular',
            'client_name': store['client'],
            'store_name': store['name'],
            'address': store['address'],
            'phone': store['phone'],
            'email': store['email'],
            'cleaning_items': cleaning_items,
            'notes': f'テスト用スケジュール {i+1}',
            'status': status,
            'created_by': 'sales-test',
        }
        
        try:
            schedules_table.put_item(Item=schedule_item)
            print(f"✅ スケジュール {i+1} を作成しました: {schedule_id}")
            print(f"   日付: {schedule_date}, 店舗: {store['name']}, ステータス: {status}")
            created_count += 1
        except Exception as e:
            print(f"❌ スケジュール {i+1} の作成に失敗しました: {str(e)}")
            failed_count += 1
    
    print(f"\n作成完了: {created_count}個成功, {failed_count}個失敗")

if __name__ == '__main__':
    print("テスト用スケジュールを10個作成します...\n")
    create_test_schedules()












