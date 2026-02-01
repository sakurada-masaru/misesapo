#!/bin/bash
# DynamoDB misesapo-stores テーブル作成（顧客DB・Lambda 用）
# 設計: docs/CUSTOMER_TABLE_SCHEMA.md
# 実行: ./scripts/create_stores_table.sh

set -e
REGION="ap-northeast-1"
TABLE_NAME="misesapo-stores"

echo "=== DynamoDB ${TABLE_NAME} 作成 ==="

if aws dynamodb describe-table --table-name "${TABLE_NAME}" --region "${REGION}" &>/dev/null; then
  echo "⚠️  テーブル ${TABLE_NAME} は既に存在します"
  exit 0
fi

echo "テーブル ${TABLE_NAME} を作成中..."
aws dynamodb create-table \
  --table-name "${TABLE_NAME}" \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region "${REGION}"

echo "作成完了を待機中..."
aws dynamodb wait table-exists --table-name "${TABLE_NAME}" --region "${REGION}"
echo "✅ テーブル ${TABLE_NAME} の作成が完了しました"
