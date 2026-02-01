#!/bin/bash
# Lambda 実行ロール（misesapo-lambda-role）に業務報告用 S3 バケットへの権限を付与
# ポリシー定義: 同ディレクトリの iam/work-reports-s3-policy.json
# 実行: ./scripts/aws/attach_work_reports_s3_policy.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
POLICY_FILE="$SCRIPT_DIR/iam/work-reports-s3-policy.json"
ROLE_NAME="${LAMBDA_ROLE_NAME:-misesapo-lambda-role}"
POLICY_NAME="WorkReportsS3Access"

if [[ ! -f "$POLICY_FILE" ]]; then
  echo "❌ ポリシーファイルが見つかりません: $POLICY_FILE"
  exit 1
fi

echo "=== 業務報告用 S3 権限の付与 ==="
echo "ロール: ${ROLE_NAME}"
echo "ポリシー: ${POLICY_NAME}"
echo ""

aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name "$POLICY_NAME" \
  --policy-document "file://$POLICY_FILE"

echo "✅ 付与完了"
