#!/bin/bash
# DynamoDB clientsテーブル作成スクリプト

set -e

REGION="ap-northeast-1"
TABLE_NAME="clients"

echo "=== DynamoDB clientsテーブル作成を開始 ==="

# テーブルが既に存在するか確認
if aws dynamodb describe-table --table-name ${TABLE_NAME} --region ${REGION} &>/dev/null; then
  echo "⚠️  テーブル ${TABLE_NAME} は既に存在します"
  exit 0
fi

# テーブルを作成
echo "テーブル ${TABLE_NAME} を作成中..."
aws dynamodb create-table \
  --table-name ${TABLE_NAME} \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
  --key-schema \
    AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region ${REGION}

echo "テーブル ${TABLE_NAME} の作成を開始しました。作成完了まで待機中..."

# テーブルがアクティブになるまで待機
aws dynamodb wait table-exists \
  --table-name ${TABLE_NAME} \
  --region ${REGION}

echo "✅ テーブル ${TABLE_NAME} の作成が完了しました"

