#!/bin/bash
# 出退勤エラーログテーブル作成スクリプト

set -e

REGION="ap-northeast-1"
TABLE_NAME="attendance-errors"

echo "=== 出退勤エラーログテーブルを作成 ==="

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
    AttributeName=created_at,AttributeType=S \
    AttributeName=staff_id,AttributeType=S \
    AttributeName=error_code,AttributeType=S \
  --key-schema \
    AttributeName=id,KeyType=HASH \
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
        },
        \"ProvisionedThroughput\": {
          \"ReadCapacityUnits\": 5,
          \"WriteCapacityUnits\": 5
        }
      },
      {
        \"IndexName\": \"error_code-created_at-index\",
        \"KeySchema\": [
          {\"AttributeName\": \"error_code\", \"KeyType\": \"HASH\"},
          {\"AttributeName\": \"created_at\", \"KeyType\": \"RANGE\"}
        ],
        \"Projection\": {
          \"ProjectionType\": \"ALL\"
        },
        \"ProvisionedThroughput\": {
          \"ReadCapacityUnits\": 5,
          \"WriteCapacityUnits\": 5
        }
      }
    ]" \
  --provisioned-throughput \
    ReadCapacityUnits=5,WriteCapacityUnits=5 \
  --region ${REGION} > /dev/null

echo "テーブル ${TABLE_NAME} を作成しました"

# テーブルの作成完了を待つ
echo "テーブルの作成完了を待機中..."
aws dynamodb wait table-exists \
  --table-name ${TABLE_NAME} \
  --region ${REGION}

echo ""
echo "=== 作成完了 ==="
echo "テーブル名: ${TABLE_NAME}"
echo "リージョン: ${REGION}"
echo ""
echo "✅ 出退勤エラーログテーブルの作成が完了しました"

