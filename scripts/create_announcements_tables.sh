#!/bin/bash
# Announcements DynamoDBテーブル作成スクリプト

set -e

REGION="ap-northeast-1"
ANNOUNCEMENTS_TABLE="business-announcements"
ANNOUNCEMENT_READS_TABLE="business-announcement-reads"

echo "=== Announcements DynamoDBテーブル作成を開始 ==="

# 1. announcementsテーブルを作成
if aws dynamodb describe-table \
  --table-name ${ANNOUNCEMENTS_TABLE} \
  --region ${REGION} &>/dev/null; then
  echo "テーブル ${ANNOUNCEMENTS_TABLE} は既に存在します"
else
  echo "テーブル ${ANNOUNCEMENTS_TABLE} を作成中..."
  aws dynamodb create-table \
    --table-name ${ANNOUNCEMENTS_TABLE} \
    --attribute-definitions \
      AttributeName=id,AttributeType=S \
      AttributeName=created_at,AttributeType=S \
      AttributeName=target_type,AttributeType=S \
    --key-schema \
      AttributeName=id,KeyType=HASH \
    --global-secondary-indexes \
      "[
        {
          \"IndexName\": \"created_at-index\",
          \"KeySchema\": [
            {\"AttributeName\": \"target_type\", \"KeyType\": \"HASH\"},
            {\"AttributeName\": \"created_at\", \"KeyType\": \"RANGE\"}
          ],
          \"Projection\": {
            \"ProjectionType\": \"ALL\"
          }
        }
      ]" \
    --billing-mode PAY_PER_REQUEST \
    --region ${REGION}

  echo "テーブル ${ANNOUNCEMENTS_TABLE} の作成を開始しました"
  echo "テーブルがアクティブになるまで待機中..."
  aws dynamodb wait table-exists \
    --table-name ${ANNOUNCEMENTS_TABLE} \
    --region ${REGION}
  echo "✅ テーブル ${ANNOUNCEMENTS_TABLE} の作成が完了しました"
fi

# 2. announcement-readsテーブルを作成
if aws dynamodb describe-table \
  --table-name ${ANNOUNCEMENT_READS_TABLE} \
  --region ${REGION} &>/dev/null; then
  echo "テーブル ${ANNOUNCEMENT_READS_TABLE} は既に存在します"
else
  echo "テーブル ${ANNOUNCEMENT_READS_TABLE} を作成中..."
  aws dynamodb create-table \
    --table-name ${ANNOUNCEMENT_READS_TABLE} \
    --attribute-definitions \
      AttributeName=id,AttributeType=S \
      AttributeName=announcement_id,AttributeType=S \
      AttributeName=staff_id,AttributeType=S \
      AttributeName=read_at,AttributeType=S \
    --key-schema \
      AttributeName=id,KeyType=HASH \
    --global-secondary-indexes \
      "[
        {
          \"IndexName\": \"announcement_id-read_at-index\",
          \"KeySchema\": [
            {\"AttributeName\": \"announcement_id\", \"KeyType\": \"HASH\"},
            {\"AttributeName\": \"read_at\", \"KeyType\": \"RANGE\"}
          ],
          \"Projection\": {
            \"ProjectionType\": \"ALL\"
          }
        },
        {
          \"IndexName\": \"staff_id-read_at-index\",
          \"KeySchema\": [
            {\"AttributeName\": \"staff_id\", \"KeyType\": \"HASH\"},
            {\"AttributeName\": \"read_at\", \"KeyType\": \"RANGE\"}
          ],
          \"Projection\": {
            \"ProjectionType\": \"ALL\"
          }
        }
      ]" \
    --billing-mode PAY_PER_REQUEST \
    --region ${REGION}

  echo "テーブル ${ANNOUNCEMENT_READS_TABLE} の作成を開始しました"
  echo "テーブルがアクティブになるまで待機中..."
  aws dynamodb wait table-exists \
    --table-name ${ANNOUNCEMENT_READS_TABLE} \
    --region ${REGION}
  echo "✅ テーブル ${ANNOUNCEMENT_READS_TABLE} の作成が完了しました"
fi

echo ""
echo "=== テーブル作成完了 ==="
echo "作成されたテーブル:"
echo "  - ${ANNOUNCEMENTS_TABLE}"
echo "  - ${ANNOUNCEMENT_READS_TABLE}"
echo "リージョン: ${REGION}"
echo ""
echo "✅ すべてのテーブルが正常に作成されました"

