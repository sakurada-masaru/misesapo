#!/bin/bash
# DynamoDB staff-report-approvalsテーブル作成スクリプト

set -e

REGION="ap-northeast-1"
TABLE_NAME="staff-report-approvals"

echo "=== DynamoDB ${TABLE_NAME} テーブル作成を開始 ==="

if aws dynamodb describe-table --table-name ${TABLE_NAME} --region ${REGION} &>/dev/null; then
  echo "⚠️  テーブル ${TABLE_NAME} は既に存在します"
  exit 0
fi

aws dynamodb create-table \
  --table-name ${TABLE_NAME} \
  --attribute-definitions \
    AttributeName=report_id,AttributeType=S \
    AttributeName=reviewed_at,AttributeType=S \
  --key-schema \
    AttributeName=report_id,KeyType=HASH \
    AttributeName=reviewed_at,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST \
  --region ${REGION}

aws dynamodb wait table-exists \
  --table-name ${TABLE_NAME} \
  --region ${REGION}

echo "✅ テーブル ${TABLE_NAME} の作成が完了しました"
