#!/bin/bash
# Attendance DynamoDBテーブル作成スクリプト

set -e

REGION="ap-northeast-1"
TABLE_NAME="attendance"

echo "=== Attendance DynamoDBテーブル作成を開始 ==="

# テーブルが既に存在するか確認
if aws dynamodb describe-table \
  --table-name ${TABLE_NAME} \
  --region ${REGION} &>/dev/null; then
  echo "テーブル ${TABLE_NAME} は既に存在します"
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

echo "テーブル ${TABLE_NAME} の作成を開始しました"
echo "テーブルがアクティブになるまで待機中..."

# テーブルがアクティブになるまで待機
aws dynamodb wait table-exists \
  --table-name ${TABLE_NAME} \
  --region ${REGION}

echo ""
echo "=== テーブル作成完了 ==="
echo "テーブル名: ${TABLE_NAME}"
echo "リージョン: ${REGION}"
echo ""
echo "✅ テーブルが正常に作成されました"

