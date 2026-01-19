#!/bin/bash
# DynamoDB kartesテーブル作成スクリプト

set -e

REGION="ap-northeast-1"
TABLE_NAME="kartes"

echo "=== DynamoDB kartesテーブル作成を開始 ==="

# テーブルが既に存在するか確認
if aws dynamodb describe-table --table-name ${TABLE_NAME} --region ${REGION} &>/dev/null; then
  echo "⚠️  テーブル ${TABLE_NAME} は既に存在します"
  exit 0
fi

echo "テーブル ${TABLE_NAME} を作成中..."
aws dynamodb create-table \
  --table-name ${TABLE_NAME} \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
    AttributeName=store_id,AttributeType=S \
    AttributeName=client_id,AttributeType=S \
    AttributeName=created_at,AttributeType=S \
  --key-schema \
    AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --global-secondary-indexes \
    "IndexName=store-created-at,KeySchema=[{AttributeName=store_id,KeyType=HASH},{AttributeName=created_at,KeyType=RANGE}],Projection={ProjectionType=ALL}" \
    "IndexName=client-created-at,KeySchema=[{AttributeName=client_id,KeyType=HASH},{AttributeName=created_at,KeyType=RANGE}],Projection={ProjectionType=ALL}" \
  --region ${REGION}

echo "テーブル ${TABLE_NAME} の作成を開始しました。作成完了まで待機中..."
aws dynamodb wait table-exists \
  --table-name ${TABLE_NAME} \
  --region ${REGION}

echo "✅ テーブル ${TABLE_NAME} の作成が完了しました"
