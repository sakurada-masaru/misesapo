import boto3
import re
import json
import uuid
from datetime import datetime

# 設定
REGION = 'ap-northeast-1'
SCHEDULES_TABLE = 'schedules'
STORES_MASTER_FILE = '/Users/sakuradamasaru/Desktop/misesapo/tmp_stores.json'

dynamodb = boto3.resource('dynamodb', region_name=REGION)
table_schedules = dynamodb.Table(SCHEDULES_TABLE)

# 店舗マスターの読み込み
with open(STORES_MASTER_FILE, 'r', encoding='utf-8') as f:
    stores_data = json.load(f)
    store_items = stores_data.get('Items', [])

print(f"Loaded {len(store_items)} master stores.")

def match_store_id(summary):
    if not summary: return None, summary
    
    # 検索用にクリーンアップ
    s_clean = summary.lower().replace(' ', '').replace('　', '')
    
    best_match = None
    best_name = summary
    max_len = 0
    
    for s in store_items:
        # DB内の店名を候補としてチェック
        names = [
            s.get('name', {}).get('S', ''),
            s.get('store_name', {}).get('S', ''),
            s.get('brand_name', {}).get('S', '')
        ]
        
        for name in names:
            if not name: continue
            name_clean = name.lower().replace(' ', '').replace('　', '')
            
            # 部分一致チェック
            if name_clean in s_clean or s_clean in name_clean:
                if len(name_clean) > max_len:
                    max_len = len(name_clean)
                    best_match = s.get('id', {}).get('S')
                    best_name = name # 正式名称を採用
                    
    return best_match, best_name

def run_v13_step2_store_matching():
    print("STEP 2: Matching stores to existing schedules...")
    
    # ステップ1で入れたデータをスキャン
    scan = table_schedules.scan(FilterExpression=boto3.dynamodb.conditions.Attr('type').eq('imported'))
    items = scan.get('Items', [])
    
    print(f"Updating {len(items)} items with store details...")
    
    count = 0
    for item in items:
        summary = item.get('summary', '')
        store_id, clean_name = match_store_id(summary)
        
        if store_id:
            # データを「はめ込む」
            table_schedules.update_item(
                Key={'id': item['id']},
                UpdateExpression="SET store_id = :sid, target_name = :tname",
                ExpressionAttributeValues={
                    ':sid': store_id,
                    ':tname': clean_name
                }
            )
            count += 1
            if count % 20 == 0:
                print(f"Matched {count} items...")

    print(f"STEP 2 FINISHED. Successfully linked {count} items to master stores.")

if __name__ == "__main__":
    run_v13_step2_store_matching()
