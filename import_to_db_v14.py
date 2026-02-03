import boto3
import re

# 設定
REGION = 'ap-northeast-1'
SCHEDULES_TABLE = 'schedules'

dynamodb = boto3.resource('dynamodb', region_name=REGION)
table_schedules = dynamodb.Table(SCHEDULES_TABLE)

# システム標準のサービス名とIDのマッピング
SERVICE_MASTER = {
    'グリスト': {'id': '1', 'name': 'グリストラップ'},
    'レンジフード': {'id': '4', 'name': 'レンジフード洗浄'},
    'エアコンフィルター': {'id': '13', 'name': 'エアコンフィルター洗浄'},
    'トイレ': {'id': '18', 'name': 'トイレ洗浄'},
    '床': {'id': '19', 'name': '床清掃'},
    'ネズミ': {'id': '31', 'name': 'ネズミ駆除'},
    '害虫': {'id': '32', 'name': 'ゴキブリ/チョウバエ駆除'},
    'チョウバエ': {'id': '32', 'name': 'ゴキブリ/チョウバエ駆除'},
}

def extract_rich_info(description):
    items = []
    sec_code = ""
    
    if not description:
        return items, sec_code
        
    # 1. 暗証番号の抽出
    desc_clean = re.sub(r'[\s\n\r]', '', description)
    m = re.search(r'(?:キーボックス|暗証番号|番号|コード|解錠)[:：]?([0-9]{3,6})', desc_clean)
    if m:
        sec_code = m.group(1)
    
    # 2. サービス名のマッチング（マスターIDへの変換）
    for keyword, info in SERVICE_MASTER.items():
        if keyword in description:
            # 重複を避けて追加
            if not any(it['id'] == info['id'] for it in items):
                items.append({'id': info['id'], 'name': info['name'], 'status': 'pending'})
    
    return items, sec_code

def run_v14_final_polish():
    print("STEP 3: Fitting Service items and Security codes...")
    
    scan = table_schedules.scan(FilterExpression=boto3.dynamodb.conditions.Attr('type').eq('imported'))
    items = scan.get('Items', [])
    
    count = 0
    for item in items:
        description = item.get('description', '')
        # すでに加工済みの場合は元のデータを推測（notes等も活用）
        cleaning_items, sec_code = extract_rich_info(description)
        
        # 備考欄の整形（最上部に暗証番号）
        notes = item.get('notes', description)
        if sec_code and f"🔑 暗証番号：{sec_code}" not in notes:
            notes = f"【🔑 暗証番号：{sec_code}】\n" + notes
            
        # 更新
        update_fields = {
            'cleaning_items': cleaning_items,
            'security_code': sec_code,
            'notes': notes
        }
        
        # 動的な更新式の構築
        expr = "SET cleaning_items = :ci, security_code = :sc, notes = :nt"
        vals = {':ci': cleaning_items, ':sc': sec_code, ':nt': notes}
        
        table_schedules.update_item(
            Key={'id': item['id']},
            UpdateExpression=expr,
            ExpressionAttributeValues=vals
        )
        count += 1

    print(f"STEP 3 FINISHED. Polished {count} items with official service IDs and secure info.")

if __name__ == "__main__":
    run_v14_final_polish()
