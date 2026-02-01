#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
顧客DBCSV（顧客DB 152a4cf1e6bd80218baad0a094e029d5.csv 形式）を DynamoDB にインポートするスクリプト。
設計: docs/CUSTOMER_TABLE_SCHEMA.md に準拠。既存の clients / brands / stores は全件削除後に再投入。
"""

import boto3
import csv
from datetime import datetime, timezone
from collections import defaultdict

REGION = 'ap-northeast-1'
CLIENTS_TABLE_NAME = 'misesapo-clients'
BRANDS_TABLE_NAME = 'misesapo-brands'
STORES_TABLE_NAME = 'misesapo-stores'

dynamodb = boto3.resource('dynamodb', region_name=REGION)
clients_table = dynamodb.Table(CLIENTS_TABLE_NAME)
brands_table = dynamodb.Table(BRANDS_TABLE_NAME)
stores_table = dynamodb.Table(STORES_TABLE_NAME)


def normalize_status(csv_value):
    """CSVのステータスを API 用に正規化。"""
    if not csv_value:
        return 'inactive'
    v = str(csv_value).strip()
    if v == '稼働中':
        return 'active'
    if v == '契約作業中':
        return 'contract_in_progress'
    if v == '現場一時停止':
        return 'suspended'
    return 'inactive'


def generate_next_id(table, prefix):
    """次のIDを生成（5桁形式: CL00001〜）"""
    try:
        response = table.scan(ProjectionExpression='id')
        items = response.get('Items', [])
        max_num = 0
        for item in items:
            id_str = item.get('id', '')
            if id_str.startswith(prefix):
                try:
                    num = int(id_str[len(prefix):])
                    max_num = max(max_num, num)
                except ValueError:
                    pass
        return f"{prefix}{max_num + 1:05d}"
    except Exception as e:
        print(f"Error generating ID: {e}")
        return f"{prefix}{int(datetime.now().timestamp())}"


def clean_string(s):
    """文字列をクリーン（改行はスペースに）"""
    if not s:
        return ''
    return s.strip().replace('\r\n', ' ').replace('\n', ' ').replace('\r', '')


def get_cell(row, *keys):
    """複数の列名候補で最初に存在する値を返す（Notion 等の列名ゆれ対応）"""
    for k in keys:
        v = row.get(k, '')
        if v is not None and str(v).strip():
            return clean_string(str(v))
    return ''


def import_customer_list(csv_file_path):
    """CSV を読み込み、DynamoDB に clients / brands / stores を投入する。"""

    # 既存データを削除
    print("既存データを削除中...")
    def delete_all(table, label):
        deleted = 0
        kw = {'ProjectionExpression': 'id'}
        while True:
            response = table.scan(**kw)
            for item in response.get('Items', []):
                table.delete_item(Key={'id': item['id']})
                deleted += 1
            if 'LastEvaluatedKey' not in response:
                break
            kw['ExclusiveStartKey'] = response['LastEvaluatedKey']
        print(f"  - {deleted}件の{label}を削除")
        return deleted

    try:
        delete_all(clients_table, 'clients')
        delete_all(brands_table, 'brands')
        delete_all(stores_table, 'stores')
    except Exception as e:
        print(f"既存データの削除でエラー: {e}")

    clients_map = {}   # 法人名 -> client_id
    brands_map = {}    # (client_id, ブランド名) -> brand_id
    stores_data = []

    # CSV 列名（Notion エクスポートのゆれに対応）
    # 獲得者(ミセサポ) はスペース付きの可能性あり
    def company_name(r):
        return get_cell(r, '会社名', '法人名')
    def brand_name(r):
        return get_cell(r, 'ブランド名')
    def store_name(r):
        return get_cell(r, '店舗名（地名・ビル名+店）', '店舗名')
    def contact_person(r):
        return get_cell(r, '担当者（代表者）紹介者', '担当者名(できればフルネーム+要フリガナ)')
    def email(r):
        return get_cell(r, 'ログインメールアドレス', '連絡手段（メールアドレス）')
    def phone(r):
        return get_cell(r, '電話番号')
    def url(r):
        return get_cell(r, 'URL')
    def acquired_by(r):
        return get_cell(r, '獲得者(ミセサポ) ', '獲得者(ミセサポ)')
    def assigned_to(r):
        return get_cell(r, '担当者(ミセサポ)')
    def store_count(r):
        return get_cell(r, '店舗数')
    def status_raw(r):
        return get_cell(r, 'ステータス', '稼働状態')
    def needs_notes(r):
        return get_cell(r, 'ニーズ内容', '備考')
    def cleaning_frequency(r):
        return get_cell(r, '清掃頻度', '定期契約')
    def introducer(r):
        return get_cell(r, '紹介者')
    def implementation_items(r):
        return get_cell(r, '実施項目')

    print("\nCSVファイルを読み込み中...")
    with open(csv_file_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            company = company_name(row)
            brand = brand_name(row)
            store = store_name(row)

            if not company and not brand and not store:
                continue
            if company in ('稼働中',) or brand in ('稼働中',) or store in ('稼働中',):
                continue

            if not company:
                company = brand if brand else store
            if not brand:
                brand = company
            if not store:
                store = brand

            status = normalize_status(status_raw(row))

            # 法人
            if company not in clients_map:
                client_id = generate_next_id(clients_table, 'CL')
                clients_map[company] = client_id
                now = datetime.now(timezone.utc).isoformat()
                client_data = {
                    'id': client_id,
                    'name': company,
                    'status': status,
                    'created_at': now,
                    'updated_at': now,
                }
                try:
                    clients_table.put_item(Item=client_data)
                    print(f"  ✓ クライアント: {company} ({client_id})")
                except Exception as e:
                    print(f"  ✗ クライアントエラー: {company} - {e}")

            cid = clients_map[company]

            # ブランド
            brand_key = (cid, brand)
            if brand_key not in brands_map:
                brand_id = generate_next_id(brands_table, 'BR')
                brands_map[brand_key] = brand_id
                now = datetime.now(timezone.utc).isoformat()
                brand_data = {
                    'id': brand_id,
                    'client_id': cid,
                    'name': brand,
                    'status': status,
                    'created_at': now,
                    'updated_at': now,
                }
                try:
                    brands_table.put_item(Item=brand_data)
                    print(f"    ✓ ブランド: {brand} ({brand_id})")
                except Exception as e:
                    print(f"    ✗ ブランドエラー: {brand} - {e}")

            bid = brands_map[brand_key]

            # 店舗（1行 = 1店舗、CSV 全項目をマッピング。法人名・ブランド名を店舗に持たせる）
            now = datetime.now(timezone.utc).isoformat()
            store_data = {
                'client_id': cid,
                'client_name': company,
                'brand_id': bid,
                'brand_name': brand,
                'name': store,
                'contact_person': contact_person(row),
                'email': email(row),
                'phone': phone(row),
                'url': url(row),
                'acquired_by': acquired_by(row),
                'assigned_to': assigned_to(row),
                'store_count': store_count(row),
                'status': status,
                'needs_notes': needs_notes(row),
                'cleaning_frequency': cleaning_frequency(row),
                'introducer': introducer(row),
                'implementation_items': implementation_items(row),
                'postcode': '',
                'pref': '',
                'city': '',
                'address1': '',
                'address2': '',
                'notes': '',
                'sales_notes': '',
                'registration_type': 'csv_import',
                'created_at': now,
                'updated_at': now,
            }
            stores_data.append(store_data)

    # 店舗を一括登録
    print(f"\n店舗を登録中... ({len(stores_data)}件)")
    for store_data in stores_data:
        store_id = generate_next_id(stores_table, 'ST')
        store_data['id'] = store_id
        try:
            stores_table.put_item(Item=store_data)
            print(f"  ✓ 店舗: {store_data['name']} ({store_id})")
        except Exception as e:
            print(f"  ✗ 店舗エラー: {store_data['name']} - {e}")

    print("\n==========================================")
    print("インポート完了")
    print("==========================================")
    print(f"クライアント: {len(clients_map)}件")
    print(f"ブランド: {len(brands_map)}件")
    print(f"店舗: {len(stores_data)}件")
    print("==========================================")


if __name__ == '__main__':
    import sys
    if len(sys.argv) < 2:
        print("使用方法: python3 import_customer_list.py <CSVファイルパス>")
        print("例: python3 scripts/import_customer_list.py scripts/customer_list_notion.csv")
        sys.exit(1)
    import_customer_list(sys.argv[1])
