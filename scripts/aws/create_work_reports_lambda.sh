#!/bin/bash
# 業務報告専用 Lambda（misesapo-work-reports）を新規作成
# 既存の misesapo-reports と同じ実行ロール（misesapo-lambda-role）を使用し、
# 環境変数 UNIVERSAL_WORK_LOGS_TABLE / WORK_REPORTS_BUCKET を設定する。
# 実行: ./scripts/aws/create_work_reports_lambda.sh
# 仕様: docs/spec/WORK_REPORT_API_SPEC.md

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
REGION="ap-northeast-1"
FUNCTION_NAME="misesapo-work-reports"
HANDLER="lambda_work_reports.lambda_handler"
RUNTIME="python3.11"

echo "=============================================="
echo "業務報告専用 Lambda の新規作成"
echo "   Function: $FUNCTION_NAME"
echo "   Handler:  $HANDLER"
echo "=============================================="

# 既存 Lambda が存在するか確認
if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" >/dev/null 2>&1; then
  echo "   $FUNCTION_NAME は既に存在します。デプロイは ./scripts/deploy_work_reports_lambda.sh prod で実行してください。"
  exit 0
fi

# misesapo-reports の実行ロールを取得（同じロールを使う）
ROLE_ARN=$(aws lambda get-function --function-name "misesapo-reports" --region "$REGION" --query 'Configuration.Role' --output text 2>/dev/null || true)
if [[ -z "$ROLE_ARN" ]]; then
  echo "❌ misesapo-reports の実行ロールを取得できません。先に misesapo-reports をデプロイするか、ROLE_ARN を指定してください。"
  exit 1
fi
echo "   実行ロール: $ROLE_ARN"

# ZIP 作成（lambda_work_reports.py + universal_work_reports.py）
TEMP_ZIP="/tmp/lambda_work_reports_create_$(date +%s).zip"
rm -f "$TEMP_ZIP"
cd "$REPO_ROOT" || exit 1
zip -j "$TEMP_ZIP" lambda_work_reports.py universal_work_reports.py
if ! unzip -l "$TEMP_ZIP" | grep -q "universal_work_reports.py"; then
  echo "❌ universal_work_reports.py がZIPに含まれていません。"
  rm -f "$TEMP_ZIP"
  exit 1
fi

echo ""
echo ">>> Lambda 関数を作成しています..."
aws lambda create-function \
  --function-name "$FUNCTION_NAME" \
  --runtime "$RUNTIME" \
  --role "$ROLE_ARN" \
  --handler "$HANDLER" \
  --timeout 30 \
  --memory-size 256 \
  --environment "Variables={UNIVERSAL_WORK_LOGS_TABLE=misesapo-sales-work-reports,WORK_REPORTS_BUCKET=misesapo-work-reports}" \
  --zip-file "fileb://$TEMP_ZIP" \
  --region "$REGION"

rm -f "$TEMP_ZIP"

echo ""
echo ">>> prod エイリアスを作成..."
VERSION=$(aws lambda publish-version --function-name "$FUNCTION_NAME" --region "$REGION" --query "Version" --output text)
aws lambda create-alias \
  --function-name "$FUNCTION_NAME" \
  --name "prod" \
  --function-version "$VERSION" \
  --region "$REGION"

echo ""
echo ">>> 実行ロールに DynamoDB / S3 権限を付与（既に付与済みの場合はスキップ）..."
"$SCRIPT_DIR/attach_work_reports_dynamodb_policy.sh" 2>/dev/null || true
"$SCRIPT_DIR/attach_work_reports_s3_policy.sh" 2>/dev/null || true

echo ""
echo "=============================================="
echo "✅ 業務報告専用 Lambda の作成が完了しました"
echo "   Function: $FUNCTION_NAME"
echo "   Handler:  $HANDLER"
echo "   環境変数: UNIVERSAL_WORK_LOGS_TABLE=misesapo-sales-work-reports, WORK_REPORTS_BUCKET=misesapo-work-reports"
echo ""
echo "次に:"
echo "   1) API Gateway 1x0f73dj2l をこの Lambda に紐づける: ./scripts/aws/setup_work_report_api_full.sh 1x0f73dj2l misesapo-work-reports"
echo "   2) コード更新時: ./scripts/deploy_work_reports_lambda.sh prod"
echo "=============================================="
