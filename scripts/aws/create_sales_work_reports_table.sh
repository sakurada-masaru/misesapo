#!/bin/bash
# 営業用業務報告テーブル作成（専用ゲート 1x0f73dj2l 用）
# 既存の UNIVERSAL_WORK_LOGS は使わない。この新テーブルだけを使う。
# 実行: ./scripts/aws/create_sales_work_reports_table.sh
# 仕様: docs/spec/WORK_REPORT_API_SPEC.md

set -e
REGION="ap-northeast-1"
TABLE_NAME="misesapo-sales-work-reports"

echo "=============================================="
echo "営業用業務報告 DynamoDB テーブル作成"
echo "テーブル名: ${TABLE_NAME}  Region: ${REGION}"
echo "=============================================="

if aws dynamodb describe-table --table-name "${TABLE_NAME}" --region "${REGION}" &>/dev/null; then
  echo "⚠️  テーブル ${TABLE_NAME} は既に存在します"
  exit 0
fi

echo "テーブル ${TABLE_NAME} を作成中..."
aws dynamodb create-table \
  --table-name "${TABLE_NAME}" \
  --attribute-definitions \
    AttributeName=log_id,AttributeType=S \
    AttributeName=worker_id,AttributeType=S \
    AttributeName=work_date,AttributeType=S \
    AttributeName=state,AttributeType=S \
  --key-schema AttributeName=log_id,KeyType=HASH \
  --global-secondary-indexes '[
    {
      "IndexName": "WorkerIndex",
      "KeySchema": [
        {"AttributeName": "worker_id", "KeyType": "HASH"},
        {"AttributeName": "work_date", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"}
    },
    {
      "IndexName": "StateIndex",
      "KeySchema": [
        {"AttributeName": "state", "KeyType": "HASH"},
        {"AttributeName": "work_date", "KeyType": "RANGE"}
      ],
      "Projection": {"ProjectionType": "ALL"}
    }
  ]' \
  --billing-mode PAY_PER_REQUEST \
  --region "${REGION}"

echo "作成完了を待機中..."
aws dynamodb wait table-exists --table-name "${TABLE_NAME}" --region "${REGION}"
echo ""
echo "✅ テーブル ${TABLE_NAME} の作成が完了しました"
echo ""
echo "Lambda（misesapo-reports）の環境変数に以下を設定してください:"
echo "  UNIVERSAL_WORK_LOGS_TABLE=${TABLE_NAME}"
echo ""
echo "既存の UNIVERSAL_WORK_LOGS テーブルは使わない（新API用にこのテーブルのみ使用）。"
