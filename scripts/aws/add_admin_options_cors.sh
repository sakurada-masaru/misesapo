#!/bin/bash
# API Gateway 1x0f73dj2l の /admin 系パスに OPTIONS（CORS プリフライト）を追加
# 実行: ./scripts/aws/add_admin_options_cors.sh [API_ID]
# デフォルト: 1x0f73dj2l（業務報告専用）

set -e
REST_API_ID="${1:-1x0f73dj2l}"
REGION="ap-northeast-1"
STAGE="prod"
LAMBDA_FUNCTION_NAME="misesapo-work-reports"
LAMBDA_ARN="arn:aws:lambda:${REGION}:475462779604:function:${LAMBDA_FUNCTION_NAME}:${STAGE}"

echo "=============================================="
echo "API Gateway /admin 系 OPTIONS（CORS）追加"
echo "API ID: $REST_API_ID  Region: $REGION"
echo "=============================================="

RESOURCES_JSON=$(aws apigateway get-resources --rest-api-id "$REST_API_ID" --region "$REGION" --output json)
ROOT_ID=$(echo "$RESOURCES_JSON" | jq -r '.items[] | select(.path == "/") | .id')
ADMIN_ID=$(echo "$RESOURCES_JSON" | jq -r '.items[] | select(.path == "/admin") | .id')
ADMIN_PROXY_ID=$(echo "$RESOURCES_JSON" | jq -r '.items[] | select(.path == "/admin/{proxy+}") | .id')
ADMIN_WORK_REPORTS_ID=$(echo "$RESOURCES_JSON" | jq -r '.items[] | select(.path == "/admin/work-reports") | .id')
ADMIN_WORK_REPORTS_ID_RESOURCE_ID=$(echo "$RESOURCES_JSON" | jq -r '.items[] | select(.path == "/admin/work-reports/{id}") | .id')
ADMIN_WORK_REPORTS_STATE_ID=$(echo "$RESOURCES_JSON" | jq -r '.items[] | select(.path == "/admin/work-reports/{id}/state") | .id')
ADMIN_PAYROLL_ID=$(echo "$RESOURCES_JSON" | jq -r '.items[] | select(.path == "/admin/payroll/{user_id}/{yyyy_mm}") | .id')

if [ -z "$ROOT_ID" ] || [ "$ROOT_ID" = "null" ]; then
  echo "❌ エラー: ルートリソース (/) が見つかりません"
  exit 1
fi

# --- /admin が無ければ作成 ---
if [ -z "$ADMIN_ID" ] || [ "$ADMIN_ID" = "null" ]; then
  echo ""
  echo "[/admin] リソースが無いため作成します..."
  ADMIN_ID=$(aws apigateway create-resource \
    --rest-api-id "$REST_API_ID" \
    --region "$REGION" \
    --parent-id "$ROOT_ID" \
    --path-part "admin" \
    --query "id" --output text)
  echo "  /admin (id: $ADMIN_ID) を作成しました"
fi

# --- /admin に OPTIONS を追加（Lambda proxy 統合）---
echo ""
echo "[/admin] OPTIONS メソッドを追加（Lambda proxy 統合）..."
aws apigateway put-method \
  --rest-api-id "$REST_API_ID" --resource-id "$ADMIN_ID" \
  --http-method OPTIONS --authorization-type NONE --region "$REGION" 2>/dev/null || echo "  OPTIONS は既に存在します"
aws apigateway put-integration \
  --rest-api-id "$REST_API_ID" --resource-id "$ADMIN_ID" \
  --http-method OPTIONS --type AWS_PROXY --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
  --region "$REGION" 2>/dev/null || echo "  統合は既に設定済みです"
aws lambda add-permission \
  --function-name "${LAMBDA_FUNCTION_NAME}:${STAGE}" \
  --statement-id "apigw-admin-options-$(date +%s)-${RANDOM}" \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:475462779604:${REST_API_ID}/*/OPTIONS/admin" \
  --region "$REGION" 2>/dev/null || echo "  Lambda permission は既に存在します（スキップ）"

# --- /admin/{proxy+} が無ければ作成、OPTIONS を追加 ---
if [ -z "$ADMIN_PROXY_ID" ] || [ "$ADMIN_PROXY_ID" = "null" ]; then
  echo ""
  echo "[/admin/{proxy+}] リソースが無いため作成します..."
  ADMIN_PROXY_ID=$(aws apigateway create-resource \
    --rest-api-id "$REST_API_ID" \
    --region "$REGION" \
    --parent-id "$ADMIN_ID" \
    --path-part "{proxy+}" \
    --query "id" --output text)
  echo "  /admin/{proxy+} (id: $ADMIN_PROXY_ID) を作成しました"
  
  # ANY メソッドも追加（既存の setup_work_report_api_full.sh と同様）
  aws apigateway put-method \
    --rest-api-id "$REST_API_ID" --resource-id "$ADMIN_PROXY_ID" \
    --http-method ANY --authorization-type NONE --region "$REGION" 2>/dev/null || true
  aws apigateway put-integration \
    --rest-api-id "$REST_API_ID" --resource-id "$ADMIN_PROXY_ID" \
    --http-method ANY --type AWS_PROXY --integration-http-method POST \
    --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
    --region "$REGION" 2>/dev/null || true
  aws lambda add-permission \
    --function-name "${LAMBDA_FUNCTION_NAME}:${STAGE}" \
    --statement-id "apigw-admin-proxy-any-$(date +%s)-${RANDOM}" \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:475462779604:${REST_API_ID}/*/*/admin/*" \
    --region "$REGION" 2>/dev/null || true
fi

echo ""
echo "[/admin/{proxy+}] OPTIONS メソッドを追加（Lambda proxy 統合）..."
aws apigateway put-method \
  --rest-api-id "$REST_API_ID" --resource-id "$ADMIN_PROXY_ID" \
  --http-method OPTIONS --authorization-type NONE --region "$REGION" 2>/dev/null || echo "  OPTIONS は既に存在します"
aws apigateway put-integration \
  --rest-api-id "$REST_API_ID" --resource-id "$ADMIN_PROXY_ID" \
  --http-method OPTIONS --type AWS_PROXY --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
  --region "$REGION" 2>/dev/null || echo "  統合は既に設定済みです"
aws lambda add-permission \
  --function-name "${LAMBDA_FUNCTION_NAME}:${STAGE}" \
  --statement-id "apigw-admin-proxy-options-$(date +%s)-${RANDOM}" \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:475462779604:${REST_API_ID}/*/OPTIONS/admin/*" \
  --region "$REGION" 2>/dev/null || echo "  Lambda permission は既に存在します（スキップ）"

# --- /admin/work-reports が存在する場合は OPTIONS を追加 ---
if [ -n "$ADMIN_WORK_REPORTS_ID" ] && [ "$ADMIN_WORK_REPORTS_ID" != "null" ]; then
  echo ""
  echo "[/admin/work-reports] OPTIONS メソッドを追加（Lambda proxy 統合）..."
  aws apigateway put-method \
    --rest-api-id "$REST_API_ID" --resource-id "$ADMIN_WORK_REPORTS_ID" \
    --http-method OPTIONS --authorization-type NONE --region "$REGION" 2>/dev/null || echo "  OPTIONS は既に存在します"
  aws apigateway put-integration \
    --rest-api-id "$REST_API_ID" --resource-id "$ADMIN_WORK_REPORTS_ID" \
    --http-method OPTIONS --type AWS_PROXY --integration-http-method POST \
    --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
    --region "$REGION" 2>/dev/null || echo "  統合は既に設定済みです"
fi

# --- /admin/work-reports/{id} が存在する場合は OPTIONS を追加 ---
if [ -n "$ADMIN_WORK_REPORTS_ID_RESOURCE_ID" ] && [ "$ADMIN_WORK_REPORTS_ID_RESOURCE_ID" != "null" ]; then
  echo ""
  echo "[/admin/work-reports/{id}] OPTIONS メソッドを追加（Lambda proxy 統合）..."
  aws apigateway put-method \
    --rest-api-id "$REST_API_ID" --resource-id "$ADMIN_WORK_REPORTS_ID_RESOURCE_ID" \
    --http-method OPTIONS --authorization-type NONE --region "$REGION" 2>/dev/null || echo "  OPTIONS は既に存在します"
  aws apigateway put-integration \
    --rest-api-id "$REST_API_ID" --resource-id "$ADMIN_WORK_REPORTS_ID_RESOURCE_ID" \
    --http-method OPTIONS --type AWS_PROXY --integration-http-method POST \
    --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
    --region "$REGION" 2>/dev/null || echo "  統合は既に設定済みです"
fi

# --- /admin/work-reports/{id}/state が存在する場合は OPTIONS を追加 ---
if [ -n "$ADMIN_WORK_REPORTS_STATE_ID" ] && [ "$ADMIN_WORK_REPORTS_STATE_ID" != "null" ]; then
  echo ""
  echo "[/admin/work-reports/{id}/state] OPTIONS メソッドを追加（Lambda proxy 統合）..."
  aws apigateway put-method \
    --rest-api-id "$REST_API_ID" --resource-id "$ADMIN_WORK_REPORTS_STATE_ID" \
    --http-method OPTIONS --authorization-type NONE --region "$REGION" 2>/dev/null || echo "  OPTIONS は既に存在します"
  aws apigateway put-integration \
    --rest-api-id "$REST_API_ID" --resource-id "$ADMIN_WORK_REPORTS_STATE_ID" \
    --http-method OPTIONS --type AWS_PROXY --integration-http-method POST \
    --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
    --region "$REGION" 2>/dev/null || echo "  統合は既に設定済みです"
fi

# --- /admin/payroll/{user_id}/{yyyy_mm} が存在する場合は OPTIONS を追加 ---
if [ -n "$ADMIN_PAYROLL_ID" ] && [ "$ADMIN_PAYROLL_ID" != "null" ]; then
  echo ""
  echo "[/admin/payroll/{user_id}/{yyyy_mm}] OPTIONS メソッドを追加（Lambda proxy 統合）..."
  aws apigateway put-method \
    --rest-api-id "$REST_API_ID" --resource-id "$ADMIN_PAYROLL_ID" \
    --http-method OPTIONS --authorization-type NONE --region "$REGION" 2>/dev/null || echo "  OPTIONS は既に存在します"
  aws apigateway put-integration \
    --rest-api-id "$REST_API_ID" --resource-id "$ADMIN_PAYROLL_ID" \
    --http-method OPTIONS --type AWS_PROXY --integration-http-method POST \
    --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
    --region "$REGION" 2>/dev/null || echo "  統合は既に設定済みです"
fi

echo ""
echo "=== API を ${STAGE} にデプロイ ==="
DEPLOYMENT_ID=$(aws apigateway create-deployment \
  --rest-api-id "$REST_API_ID" \
  --region "$REGION" \
  --stage-name "$STAGE" \
  --description "Add OPTIONS (CORS) to /admin paths (add_admin_options_cors.sh)" \
  --query "id" --output text)
echo "  Deployment ID: $DEPLOYMENT_ID"

echo ""
echo "=============================================="
echo "✅ /admin 系 OPTIONS（CORS）追加完了"
echo "   API: $REST_API_ID"
echo "   Stage: $STAGE"
echo "   Deployment: $DEPLOYMENT_ID"
echo ""
echo "動作確認:"
echo "  curl -i -X OPTIONS \\"
echo "    'https://${REST_API_ID}.execute-api.${REGION}.amazonaws.com/${STAGE}/admin/work-reports/28c19e6e-225f-4497-9148-24b491845c56' \\"
echo "    -H 'Origin: https://misesapo.co.jp' \\"
echo "    -H 'Access-Control-Request-Method: GET'"
echo "=============================================="
