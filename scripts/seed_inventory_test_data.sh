#!/bin/bash
# 在庫管理テストデータ投入スクリプト

set -e

REGION="ap-northeast-1"
TABLE_NAME="inventory-items"

echo "=== 在庫管理テストデータ投入を開始 ==="

# テストデータ（10商品）
ITEMS=(
  '{"product_id":"P001","name":"商品A（ビスケット）","stock":150,"minStock":50,"safeStock":100}'
  '{"product_id":"P002","name":"商品B（飲料水）","stock":200,"minStock":50,"safeStock":100}'
  '{"product_id":"P003","name":"商品C（文房具セット）","stock":50,"minStock":30,"safeStock":60}'
  '{"product_id":"P004","name":"商品D（電池パック）","stock":300,"minStock":50,"safeStock":100}'
  '{"product_id":"P005","name":"商品E（タオル）","stock":100,"minStock":40,"safeStock":80}'
  '{"product_id":"P006","name":"商品F（シャンプー）","stock":120,"minStock":50,"safeStock":100}'
  '{"product_id":"P007","name":"商品G（トイレットペーパー）","stock":80,"minStock":40,"safeStock":80}'
  '{"product_id":"P008","name":"商品H（洗剤）","stock":140,"minStock":50,"safeStock":100}'
  '{"product_id":"P009","name":"商品I（歯磨き粉）","stock":90,"minStock":40,"safeStock":80}'
  '{"product_id":"P010","name":"商品J（レトルト食品）","stock":250,"minStock":50,"safeStock":100}'
)

NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

for item_json in "${ITEMS[@]}"; do
  # created_atとupdated_atを追加
  item_with_dates=$(echo "$item_json" | jq --arg now "$NOW" '. + {created_at: $now, updated_at: $now}')
  
  product_id=$(echo "$item_with_dates" | jq -r '.product_id')
  echo "商品を登録中: $product_id"
  
  aws dynamodb put-item \
    --table-name ${TABLE_NAME} \
    --item "$(echo "$item_with_dates" | jq '{product_id: .product_id, name: .name, stock: {N: (.stock | tostring)}, minStock: {N: (.minStock | tostring)}, safeStock: {N: (.safeStock | tostring)}, created_at: {S: .created_at}, updated_at: {S: .updated_at}}')" \
    --region ${REGION} > /dev/null
  
  echo "✅ $product_id を登録しました"
done

echo ""
echo "=== テストデータ投入完了 ==="
echo "登録された商品数: ${#ITEMS[@]}"
echo ""

