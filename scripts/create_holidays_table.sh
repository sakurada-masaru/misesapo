#!/bin/bash

# 休日・祝日管理用DynamoDBテーブルを作成

TABLE_NAME="holidays"
REGION="ap-northeast-1"

echo "Creating DynamoDB table: $TABLE_NAME"

aws dynamodb create-table \
  --table-name $TABLE_NAME \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
    AttributeName=date,AttributeType=S \
  --key-schema \
    AttributeName=id,KeyType=HASH \
  --global-secondary-indexes \
    "[
      {
        \"IndexName\": \"date-index\",
        \"KeySchema\": [
          {\"AttributeName\": \"date\", \"KeyType\": \"HASH\"}
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

