#!/bin/bash
# 業務報告Lambda（misesapo-work-reports）の環境変数を確認するスクリプト

FUNCTION_NAME="misesapo-work-reports"
REGION="ap-northeast-1"

echo "=========================================="
echo "🔍 Checking Lambda Environment Variables"
echo "   Function: $FUNCTION_NAME"
echo "   Region: $REGION"
echo "=========================================="
echo ""

# Lambda関数の設定を取得
CONFIG=$(aws lambda get-function-configuration \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" 2>&1)

if [ $? -ne 0 ]; then
  echo "❌ ERROR: Failed to get Lambda configuration"
  echo "$CONFIG"
  exit 1
fi

# 環境変数を抽出
ENV_VARS=$(echo "$CONFIG" | jq -r '.Environment.Variables // {}')

echo "📋 Environment Variables:"
echo "$ENV_VARS" | jq '.'

echo ""
echo "🔑 Key Variables:"
UNIVERSAL_TABLE=$(echo "$ENV_VARS" | jq -r '.UNIVERSAL_WORK_LOGS_TABLE // "NOT SET"')
BUCKET=$(echo "$ENV_VARS" | jq -r '.WORK_REPORTS_BUCKET // "NOT SET"')
REGION_VAR=$(echo "$ENV_VARS" | jq -r '.AWS_REGION // "NOT SET"')

echo "  UNIVERSAL_WORK_LOGS_TABLE: $UNIVERSAL_TABLE"
echo "  WORK_REPORTS_BUCKET: $BUCKET"
echo "  AWS_REGION: $REGION_VAR"

echo ""
echo "✅ Expected Values:"
echo "  UNIVERSAL_WORK_LOGS_TABLE: misesapo-sales-work-reports"
echo "  WORK_REPORTS_BUCKET: misesapo-work-reports"
echo "  AWS_REGION: ap-northeast-1"

echo ""
if [ "$UNIVERSAL_TABLE" = "misesapo-sales-work-reports" ] && [ "$BUCKET" = "misesapo-work-reports" ]; then
  echo "✅ Environment variables are correctly set!"
else
  echo "⚠️  WARNING: Environment variables may not be set correctly!"
  echo "   Run: ./scripts/deploy_work_reports_lambda.sh prod"
fi

echo ""
echo "📊 Lambda Function Info:"
HANDLER=$(echo "$CONFIG" | jq -r '.Handler')
RUNTIME=$(echo "$CONFIG" | jq -r '.Runtime')
LAST_MODIFIED=$(echo "$CONFIG" | jq -r '.LastModified')
echo "  Handler: $HANDLER"
echo "  Runtime: $RUNTIME"
echo "  Last Modified: $LAST_MODIFIED"
