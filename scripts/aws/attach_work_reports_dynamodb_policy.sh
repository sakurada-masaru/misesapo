#!/bin/bash
# Lambda 実行ロールに業務報告用 DynamoDB テーブル（misesapo-sales-work-reports）への権限を付与
# 実行: ./scripts/aws/attach_work_reports_dynamodb_policy.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
POLICY_FILE="$SCRIPT_DIR/iam/work-reports-dynamodb-policy.json"
ROLE_NAME="${LAMBDA_ROLE_NAME:-misesapo-lambda-role}"
POLICY_NAME="WorkReportsDynamoDBAccess"

if [[ ! -f "$POLICY_FILE" ]]; then
  echo "❌ ポリシーファイルが見つかりません: $POLICY_FILE"
  exit 1
fi

echo "=== 業務報告用 DynamoDB 権限の付与 ==="
echo "ロール: ${ROLE_NAME}"
echo "ポリシー: ${POLICY_NAME} (misesapo-sales-work-reports)"
echo ""

aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name "$POLICY_NAME" \
  --policy-document "file://$POLICY_FILE"

echo "✅ 付与完了"
