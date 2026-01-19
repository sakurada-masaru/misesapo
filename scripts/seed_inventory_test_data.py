#!/usr/bin/env python3
# 在庫管理テストデータ投入スクリプト

import boto3
import json
from datetime import datetime, timezone

REGION = "ap-northeast-1"
TABLE_NAME = "inventory-items"

# DynamoDBクライアント
dynamodb = boto3.resource('dynamodb', region_name=REGION)
table = dynamodb.Table(TABLE_NAME)

# テストデータ（10商品）
test_items = [
    {"product_id": "P001", "name": "商品A（ビスケット）", "stock": 150, "minStock": 50, "safeStock": 100},
    {"product_id": "P002", "name": "商品B（飲料水）", "stock": 200, "minStock": 50, "safeStock": 100},
    {"product_id": "P003", "name": "商品C（文房具セット）", "stock": 50, "minStock": 30, "safeStock": 60},
    {"product_id": "P004", "name": "商品D（電池パック）", "stock": 300, "minStock": 50, "safeStock": 100},
    {"product_id": "P005", "name": "商品E（タオル）", "stock": 100, "minStock": 40, "safeStock": 80},
    {"product_id": "P006", "name": "商品F（シャンプー）", "stock": 120, "minStock": 50, "safeStock": 100},
    {"product_id": "P007", "name": "商品G（トイレットペーパー）", "stock": 80, "minStock": 40, "safeStock": 80},
    {"product_id": "P008", "name": "商品H（洗剤）", "stock": 140, "minStock": 50, "safeStock": 100},
    {"product_id": "P009", "name": "商品I（歯磨き粉）", "stock": 90, "minStock": 40, "safeStock": 80},
    {"product_id": "P010", "name": "商品J（レトルト食品）", "stock": 250, "minStock": 50, "safeStock": 100},
]

print("=== 在庫管理テストデータ投入を開始 ===")

now = datetime.now(timezone.utc).isoformat()

for item in test_items:
    product_id = item["product_id"]
    print(f"商品を登録中: {product_id}")
    
    try:
        # created_atとupdated_atを追加
        item_data = {
            "product_id": product_id,
            "name": item["name"],
            "stock": item["stock"],
            "minStock": item["minStock"],
            "safeStock": item["safeStock"],
            "created_at": now,
            "updated_at": now
        }
        
        table.put_item(Item=item_data)
        print(f"✅ {product_id} を登録しました")
    except Exception as e:
        print(f"❌ {product_id} の登録に失敗しました: {str(e)}")

print("")
print("=== テストデータ投入完了 ===")
print(f"登録された商品数: {len(test_items)}")
print("")

