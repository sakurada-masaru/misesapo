#!/bin/bash
# 顧客まわり 3 テーブルを一括作成（15カラム対応）
# misesapo-clients（法人）, misesapo-brands（ブランド）, misesapo-stores（店舗）
# 設計: docs/CUSTOMER_TABLE_SCHEMA.md
# 実行: ./scripts/create_customer_tables.sh

set -e
REGION="ap-northeast-1"

echo "=============================================="
echo "顧客テーブル一括作成（clients / brands / stores）"
echo "=============================================="

for TABLE_NAME in misesapo-clients misesapo-brands misesapo-stores; do
  echo ""
  echo "--- ${TABLE_NAME} ---"
  if aws dynamodb describe-table --table-name "${TABLE_NAME}" --region "${REGION}" &>/dev/null; then
    echo "⚠️  既に存在します"
  else
    echo "作成中..."
    aws dynamodb create-table \
      --table-name "${TABLE_NAME}" \
      --attribute-definitions AttributeName=id,AttributeType=S \
      --key-schema AttributeName=id,KeyType=HASH \
      --billing-mode PAY_PER_REQUEST \
      --region "${REGION}"
    echo "待機中..."
    aws dynamodb wait table-exists --table-name "${TABLE_NAME}" --region "${REGION}"
    echo "✅ ${TABLE_NAME} 作成完了"
  fi
done

echo ""
echo "=============================================="
echo "完了: misesapo-clients, misesapo-brands, misesapo-stores"
echo "=============================================="
