#!/bin/bash
# 在庫管理DynamoDBテーブル作成スクリプト

set -e

REGION="ap-northeast-1"
ITEMS_TABLE="inventory-items"
TRANSACTIONS_TABLE="inventory-transactions"

echo "=== 在庫管理DynamoDBテーブル作成を開始 ==="

# ==================== inventory-items テーブル ====================
echo ""
echo "--- ${ITEMS_TABLE} テーブルを作成 ---"

if aws dynamodb describe-table \
  --table-name ${ITEMS_TABLE} \
  --region ${REGION} &>/dev/null; then
  echo "テーブル ${ITEMS_TABLE} は既に存在します"
else
  echo "テーブル ${ITEMS_TABLE} を作成中..."
  aws dynamodb create-table \
    --table-name ${ITEMS_TABLE} \
    --attribute-definitions \
      AttributeName=product_id,AttributeType=S \
    --key-schema \
      AttributeName=product_id,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region ${REGION}

  echo "テーブル ${ITEMS_TABLE} の作成を開始しました"
  echo "テーブルがアクティブになるまで待機中..."
  aws dynamodb wait table-exists \
    --table-name ${ITEMS_TABLE} \
    --region ${REGION}
  echo "✅ テーブル ${ITEMS_TABLE} の作成が完了しました"
fi

# ==================== inventory-transactions テーブル ====================
echo ""
echo "--- ${TRANSACTIONS_TABLE} テーブルを作成 ---"

if aws dynamodb describe-table \
  --table-name ${TRANSACTIONS_TABLE} \
  --region ${REGION} &>/dev/null; then
  echo "テーブル ${TRANSACTIONS_TABLE} は既に存在します"
else
  echo "テーブル ${TRANSACTIONS_TABLE} を作成中..."
  aws dynamodb create-table \
    --table-name ${TRANSACTIONS_TABLE} \
    --attribute-definitions \
      AttributeName=transaction_id,AttributeType=S \
      AttributeName=staff_id,AttributeType=S \
      AttributeName=product_id,AttributeType=S \
      AttributeName=created_at,AttributeType=S \
      AttributeName=type,AttributeType=S \
    --key-schema \
      AttributeName=transaction_id,KeyType=HASH \
    --global-secondary-indexes \
      "[
        {
          \"IndexName\": \"staff_id-created_at-index\",
          \"KeySchema\": [
            {\"AttributeName\": \"staff_id\", \"KeyType\": \"HASH\"},
            {\"AttributeName\": \"created_at\", \"KeyType\": \"RANGE\"}
          ],
          \"Projection\": {
            \"ProjectionType\": \"ALL\"
          }
        },
        {
          \"IndexName\": \"product_id-created_at-index\",
          \"KeySchema\": [
            {\"AttributeName\": \"product_id\", \"KeyType\": \"HASH\"},
            {\"AttributeName\": \"created_at\", \"KeyType\": \"RANGE\"}
          ],
          \"Projection\": {
            \"ProjectionType\": \"ALL\"
          }
        },
        {
          \"IndexName\": \"type-created_at-index\",
          \"KeySchema\": [
            {\"AttributeName\": \"type\", \"KeyType\": \"HASH\"},
            {\"AttributeName\": \"created_at\", \"KeyType\": \"RANGE\"}
          ],
          \"Projection\": {
            \"ProjectionType\": \"ALL\"
          }
        }
      ]" \
    --billing-mode PAY_PER_REQUEST \
    --region ${REGION}

  echo "テーブル ${TRANSACTIONS_TABLE} の作成を開始しました"
  echo "テーブルがアクティブになるまで待機中..."
  aws dynamodb wait table-exists \
    --table-name ${TRANSACTIONS_TABLE} \
    --region ${REGION}
  echo "✅ テーブル ${TRANSACTIONS_TABLE} の作成が完了しました"
fi

echo ""
echo "=== テーブル作成完了 ==="
echo "作成されたテーブル:"
echo "  - ${ITEMS_TABLE}"
echo "  - ${TRANSACTIONS_TABLE}"
echo "リージョン: ${REGION}"
echo ""

