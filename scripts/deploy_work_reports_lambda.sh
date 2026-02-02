#!/bin/bash
# 業務報告専用 Lambda（misesapo-work-reports）のデプロイ
# 同梱: lambda_work_reports.py（handler）, universal_work_reports.py
# 実行: ./scripts/deploy_work_reports_lambda.sh [stg|prod]
# 仕様: docs/spec/WORK_REPORT_API_SPEC.md

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <stg|prod>"
  echo "Example: $0 prod"
  exit 1
fi

STAGE=$1
FUNCTION_NAME="misesapo-work-reports"
HANDLER="lambda_work_reports.lambda_handler"
API_ID="1x0f73dj2l"
REGION="ap-northeast-1"
ACCOUNT_ID="475462779604"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT" || exit 1

echo "--------------------------------------------------"
echo "🚀 Deploying $FUNCTION_NAME ($STAGE)"
echo "   Handler: $HANDLER"
echo "   API: $API_ID (業務報告専用ゲート)"
echo "--------------------------------------------------"

TEMP_ZIP="/tmp/lambda_work_reports_$(date +%s).zip"
rm -f "$TEMP_ZIP"
zip -j "$TEMP_ZIP" "$REPO_ROOT/lambda_work_reports.py" "$REPO_ROOT/universal_work_reports.py"
if ! unzip -l "$TEMP_ZIP" | grep -q "universal_work_reports.py"; then
  echo "❌ ERROR: universal_work_reports.py がZIPに含まれていません。"
  rm -f "$TEMP_ZIP"
  exit 1
fi
echo "✅ 同梱: lambda_work_reports.py, universal_work_reports.py"

echo "📥 Updating function code..."
aws lambda update-function-code \
  --function-name "$FUNCTION_NAME" \
  --zip-file "fileb://$TEMP_ZIP" \
  --region "$REGION" > /dev/null

echo "⏳ Waiting for update to complete..."
aws lambda wait function-updated \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION"

echo "🔧 Ensuring environment variables (UNIVERSAL_WORK_LOGS_TABLE, WORK_REPORTS_BUCKET)..."
aws lambda update-function-configuration \
  --function-name "$FUNCTION_NAME" \
  --environment "Variables={UNIVERSAL_WORK_LOGS_TABLE=misesapo-sales-work-reports,WORK_REPORTS_BUCKET=misesapo-work-reports}" \
  --region "$REGION" > /dev/null

echo "⏳ Waiting for config update..."
aws lambda wait function-updated \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION"

echo "🔖 Publishing new version..."
VERSION=$(aws lambda publish-version --function-name "$FUNCTION_NAME" --region "$REGION" --query "Version" --output text)
echo "   Version: $VERSION"

echo "🔗 Updating alias '$STAGE' to version $VERSION..."
aws lambda update-alias \
  --function-name "$FUNCTION_NAME" \
  --name "$STAGE" \
  --function-version "$VERSION" \
  --region "$REGION" 2>/dev/null || \
aws lambda create-alias \
  --function-name "$FUNCTION_NAME" \
  --name "$STAGE" \
  --function-version "$VERSION" \
  --region "$REGION"

echo "🔑 Ensuring API Gateway ($API_ID) permission..."
aws lambda add-permission \
  --function-name "arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${FUNCTION_NAME}:${STAGE}" \
  --statement-id "apigw-invoke-${STAGE}-$(date +%s)" \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/${STAGE}/*/*" \
  --region "$REGION" > /dev/null 2>&1 || echo "⚠️ Permission already exists (Skipped)"

rm -f "$TEMP_ZIP"

echo "🔑 Ensuring DynamoDB/S3 permissions on Lambda role..."
SCRIPT_AWS="$(cd "$SCRIPT_DIR/aws" 2>/dev/null && pwd)"
if [[ -n "$SCRIPT_AWS" ]] && [[ -f "$SCRIPT_AWS/attach_work_reports_dynamodb_policy.sh" ]]; then
  "$SCRIPT_AWS/attach_work_reports_dynamodb_policy.sh" 2>/dev/null || echo "⚠️ DynamoDB policy attach skipped (check role name)"
  "$SCRIPT_AWS/attach_work_reports_s3_policy.sh" 2>/dev/null || echo "⚠️ S3 policy attach skipped"
fi

echo "--------------------------------------------------"
echo "✨ Deployment Complete!"
echo "   Function: $FUNCTION_NAME"
echo "   Alias:    $STAGE -> Version $VERSION"
echo "   URL:      https://${API_ID}.execute-api.${REGION}.amazonaws.com/${STAGE}/"
echo "--------------------------------------------------"
