#!/bin/bash

# DynamoDB table name
TABLE_NAME="misesapo-reimbursements"
REGION="ap-northeast-1"

echo "Creating DynamoDB table: $TABLE_NAME..."

# Create the table with 'id' as Partition Key
aws dynamodb create-table \
    --table-name $TABLE_NAME \
    --attribute-definitions \
        AttributeName=id,AttributeType=S \
        AttributeName=staff_id,AttributeType=S \
        AttributeName=date,AttributeType=S \
    --key-schema \
        AttributeName=id,KeyType=HASH \
    --provisioned-throughput \
        ReadCapacityUnits=5,WriteCapacityUnits=5 \
    --global-secondary-indexes \
        "[
            {
                \"IndexName\": \"staff_id-date-index\",
                \"KeySchema\": [
                    {\"AttributeName\": \"staff_id\", \"KeyType\": \"HASH\"},
                    {\"AttributeName\": \"date\", \"KeyType\": \"RANGE\"}
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
    --region $REGION

if [ $? -eq 0 ]; then
    echo "Table creation initiated successfully."
    echo "Waiting for table to be active..."
    aws dynamodb wait table-exists --table-name $TABLE_NAME --region $REGION
    echo "Table is now ACTIVE and ready to use."
else
    echo "Failed to create table."
    exit 1
fi
