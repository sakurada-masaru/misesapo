#!/bin/bash

# 清掃員スケジュール用ブロック（クローズ）DynamoDBテーブルを作成
# 清掃員が登録する「睡眠・移動・私用」などのクローズ時間を保存

TABLE_NAME="blocks"
REGION="ap-northeast-1"

echo "Creating DynamoDB table: $TABLE_NAME"

aws dynamodb create-table \
  --table-name $TABLE_NAME \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
    AttributeName=user_id,AttributeType=S \
    AttributeName=start_at,AttributeType=S \
  --key-schema \
    AttributeName=id,KeyType=HASH \
  --global-secondary-indexes \
    "[
      {
        \"IndexName\": \"user_id-start_at-index\",
        \"KeySchema\": [
          {\"AttributeName\": \"user_id\", \"KeyType\": \"HASH\"},
          {\"AttributeName\": \"start_at\", \"KeyType\": \"RANGE\"}
        ],
        \"Projection\": {
          \"ProjectionType\": \"ALL\"
        }
      }
    ]" \
  --billing-mode PAY_PER_REQUEST \
  --region $REGION

echo "Waiting for table to be created..."
aws dynamodb wait table-exists --table-name $TABLE_NAME --region $REGION

echo "Table $TABLE_NAME created successfully!"
