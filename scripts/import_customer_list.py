#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
顧客管理リストCSVをDynamoDBにインポートするスクリプト
既存のデータを上書きします
"""

import boto3
import csv
import json
import re
from datetime import datetime, timezone
from collections import defaultdict
from botocore.exceptions import ClientError

# DynamoDB設定
REGION = 'ap-northeast-1'
CLIENTS_TABLE_NAME = 'misesapo-clients'
BRANDS_TABLE_NAME = 'misesapo-brands'
STORES_TABLE_NAME = 'misesapo-stores'

dynamodb = boto3.resource('dynamodb', region_name=REGION)
clients_table = dynamodb.Table(CLIENTS_TABLE_NAME)
brands_table = dynamodb.Table(BRANDS_TABLE_NAME)
stores_table = dynamodb.Table(STORES_TABLE_NAME)

def generate_next_id(table, prefix):
    """次のIDを生成（5桁形式: CL00001〜）"""
    try:
        response = table.scan(ProjectionExpression='id')
        items = response.get('Items', [])
        
        # 既存のIDから最大値を取得
        max_num = 0
        for item in items:
            id_str = item.get('id', '')
            if id_str.startswith(prefix):
                try:
                    num = int(id_str[len(prefix):])
                    max_num = max(max_num, num)
                except ValueError:
                    pass
        
        # 次の番号を生成
        next_num = max_num + 1
        return f"{prefix}{next_num:05d}"
    except Exception as e:
        print(f"Error generating ID: {e}")
        # フォールバック: タイムスタンプベース
        return f"{prefix}{int(datetime.now().timestamp())}"

def parse_address(address_str):
    """住所を解析して郵便番号、都道府県、市区町村、番地に分割"""
    if not address_str or address_str.strip() == '':
        return {'postcode': '', 'pref': '', 'city': '', 'address1': '', 'address2': ''}
    
    address = address_str.strip()
    
    # 郵便番号を抽出（〒123-4567 または 〒1234567）
    postcode = ''
    postcode_match = re.search(r'〒?(\d{3}-?\d{4})', address)
    if postcode_match:
        postcode = postcode_match.group(1).replace('-', '')
        address = address.replace(postcode_match.group(0), '').strip()
    
    # 都道府県を抽出
    pref = ''
    prefs = ['北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
             '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
             '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
             '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
             '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
             '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
             '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県']
    
    for p in prefs:
        if address.startswith(p):
            pref = p
            address = address[len(p):].strip()
            break
    
    # 市区町村を抽出（都道府県の後の最初の区切りまで）
    city = ''
    city_match = re.match(r'^([^市区町村]+[市区町村])', address)
    if city_match:
        city = city_match.group(1)
        address = address[len(city):].strip()
    
    # 残りをaddress1とaddress2に分割（簡易的に）
    address1 = address
    address2 = ''
    
    return {
        'postcode': postcode,
        'pref': pref,
        'city': city,
        'address1': address1,
        'address2': address2
    }

def clean_string(s):
    """文字列をクリーンアップ"""
    if not s:
        return ''
    return s.strip().replace('\n', ' ').replace('\r', '')

def import_customer_list(csv_file_path):
    """CSVファイルを読み込んでDynamoDBにインポート"""
    
    # 既存データを削除（オプション: コメントアウトで無効化）
    print("既存データを削除中...")
    try:
        # 既存のclientsを削除
        response = clients_table.scan(ProjectionExpression='id')
        for item in response.get('Items', []):
            clients_table.delete_item(Key={'id': item['id']})
        print(f"  - {len(response.get('Items', []))}件のclientsを削除")
        
        # 既存のbrandsを削除
        response = brands_table.scan(ProjectionExpression='id')
        for item in response.get('Items', []):
            brands_table.delete_item(Key={'id': item['id']})
        print(f"  - {len(response.get('Items', []))}件のbrandsを削除")
        
        # 既存のstoresを削除
        response = stores_table.scan(ProjectionExpression='id')
        for item in response.get('Items', []):
            stores_table.delete_item(Key={'id': item['id']})
        print(f"  - {len(response.get('Items', []))}件のstoresを削除")
    except Exception as e:
        print(f"既存データの削除でエラー: {e}")
    
    # データを読み込む
    clients_map = {}  # 法人名 -> client_id
    brands_map = {}   # (client_id, ブランド名) -> brand_id
    stores_data = []  # 店舗データのリスト
    
    print("\nCSVファイルを読み込み中...")
    with open(csv_file_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # CSVのカラム名を取得
            company_name = clean_string(row.get('法人名', ''))
            brand_name = clean_string(row.get('ブランド名', ''))
            store_name = clean_string(row.get('店舗名（地名・ビル名+店）', ''))
            address = clean_string(row.get('住所', ''))
            contact_person = clean_string(row.get('担当者名(できればフルネーム+要フリガナ)', ''))
            phone = clean_string(row.get('電話番号', ''))
            email = clean_string(row.get('連絡手段（メールアドレス）', ''))
            contract_type = clean_string(row.get('定期契約', ''))
            concierge = clean_string(row.get('コンシェルジュ名', ''))
            status = clean_string(row.get('稼働状態', ''))
            notes = clean_string(row.get('備考', ''))
            
            # 空行や無効なデータをスキップ
            if not company_name and not brand_name and not store_name:
                continue
            
            # 「稼働中」などの無効なデータをスキップ
            if company_name in ['稼働中'] or brand_name in ['稼働中'] or store_name in ['稼働中']:
                continue
            
            # 法人名が空の場合はブランド名を使用
            if not company_name:
                company_name = brand_name if brand_name else store_name
            
            # ブランド名が空の場合は法人名を使用
            if not brand_name:
                brand_name = company_name
            
            # 店舗名が空の場合はブランド名を使用
            if not store_name:
                store_name = brand_name
            
            # クライアント（法人）を登録
            if company_name not in clients_map:
                client_id = generate_next_id(clients_table, 'CL')
                clients_map[company_name] = client_id
                
                now = datetime.now(timezone.utc).isoformat()
                client_data = {
                    'id': client_id,
                    'name': company_name,
                    'email': email if email else '',
                    'phone': phone if phone else '',
                    'contact_person': contact_person if contact_person else '',
                    'status': 'active' if status == '稼働中' else 'inactive',
                    'role': 'customer',
                    'created_at': now,
                    'updated_at': now
                }
                
                try:
                    clients_table.put_item(Item=client_data)
                    print(f"  ✓ クライアント作成: {company_name} ({client_id})")
                except Exception as e:
                    print(f"  ✗ クライアント作成エラー: {company_name} - {e}")
            
            client_id = clients_map[company_name]
            
            # ブランドを登録
            brand_key = (client_id, brand_name)
            if brand_key not in brands_map:
                brand_id = generate_next_id(brands_table, 'BR')
                brands_map[brand_key] = brand_id
                
                now = datetime.now(timezone.utc).isoformat()
                brand_data = {
                    'id': brand_id,
                    'client_id': client_id,
                    'name': brand_name,
                    'status': 'active',
                    'created_at': now,
                    'updated_at': now
                }
                
                try:
                    brands_table.put_item(Item=brand_data)
                    print(f"    ✓ ブランド作成: {brand_name} ({brand_id})")
                except Exception as e:
                    print(f"    ✗ ブランド作成エラー: {brand_name} - {e}")
            
            brand_id = brands_map[brand_key]
            
            # 店舗データを収集（後で一括登録）
            address_parts = parse_address(address)
            now = datetime.utcnow().isoformat() + 'Z'
            
            store_data = {
                'client_id': client_id,
                'brand_id': brand_id,
                'name': store_name,
                'postcode': address_parts['postcode'],
                'pref': address_parts['pref'],
                'city': address_parts['city'],
                'address1': address_parts['address1'],
                'address2': address_parts['address2'],
                'phone': phone if phone else '',
                'email': email if email else '',
                'contact_person': contact_person if contact_person else '',
                'status': 'active' if status == '稼働中' else 'inactive',
                'notes': notes if notes else '',
                'sales_notes': f"契約タイプ: {contract_type}, コンシェルジュ: {concierge}" if contract_type or concierge else '',
                'registration_type': 'csv_import',
                'created_at': now,
                'updated_at': now
            }
            
            stores_data.append(store_data)
    
    # 店舗を一括登録
    print(f"\n店舗を登録中... ({len(stores_data)}件)")
    for store_data in stores_data:
        store_id = generate_next_id(stores_table, 'ST')
        store_data['id'] = store_id
        
        try:
            stores_table.put_item(Item=store_data)
            print(f"  ✓ 店舗作成: {store_data['name']} ({store_id})")
        except Exception as e:
            print(f"  ✗ 店舗作成エラー: {store_data['name']} - {e}")
    
    print("\n==========================================")
    print("インポート完了！")
    print("==========================================")
    print(f"クライアント: {len(clients_map)}件")
    print(f"ブランド: {len(brands_map)}件")
    print(f"店舗: {len(stores_data)}件")
    print("==========================================")

if __name__ == '__main__':
    import sys
    
    if len(sys.argv) < 2:
        print("使用方法: python3 import_customer_list.py <CSVファイルパス>")
        sys.exit(1)
    
    csv_file_path = sys.argv[1]
    import_customer_list(csv_file_path)

