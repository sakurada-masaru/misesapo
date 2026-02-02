#!/bin/bash
# ワークレポート API を一から揃える（リソースが無ければ作成、認証 NONE、Lambda プロキシ、prod デプロイ）
# 実行: ./scripts/aws/setup_work_report_api_full.sh [API_ID] [LAMBDA_NAME]
# デフォルト: API 1x0f73dj2l（業務報告専用）、Lambda misesapo-work-reports（vite /api-wr のプロキシ先）
# 仕様: docs/spec/WORK_REPORT_API_SPEC.md

set -e
REST_API_ID="${1:-1x0f73dj2l}"
LAMBDA_FUNCTION_NAME="${2:-misesapo-work-reports}"
REGION="ap-northeast-1"
STAGE="prod"
LAMBDA_ARN="arn:aws:lambda:${REGION}:475462779604:function:${LAMBDA_FUNCTION_NAME}:${STAGE}"

echo "=============================================="
echo "ワークレポート API 一括セットアップ"
echo "API ID: $REST_API_ID  Region: $REGION  Lambda: $LAMBDA_FUNCTION_NAME:$STAGE"
echo "=============================================="

RESOURCES_JSON=$(aws apigateway get-resources --rest-api-id "$REST_API_ID" --region "$REGION" --output json)
ROOT_ID=$(echo "$RESOURCES_JSON" | jq -r '.items[] | select(.path == "/") | .id')
WORK_REPORT_ID=$(echo "$RESOURCES_JSON" | jq -r '.items[] | select(.path == "/work-report") | .id')

if [ -z "$ROOT_ID" ] || [ "$ROOT_ID" = "null" ]; then
  echo "エラー: ルートリソース (/) が見つかりません"
  exit 1
fi

# --- /work-report が無ければ作成 ---
if [ -z "$WORK_REPORT_ID" ] || [ "$WORK_REPORT_ID" = "null" ]; then
  echo ""
  echo "[/work-report] リソースが無いため作成します..."
  WORK_REPORT_ID=$(aws apigateway create-resource \
    --rest-api-id "$REST_API_ID" \
    --region "$REGION" \
    --parent-id "$ROOT_ID" \
    --path-part "work-report" \
    --query "id" --output text)
  echo "  /work-report (id: $WORK_REPORT_ID) を作成しました"

  for METHOD in GET PUT; do
    echo "  $METHOD メソッドを追加（認証 NONE、Lambda プロキシ）..."
    aws apigateway put-method \
      --rest-api-id "$REST_API_ID" --resource-id "$WORK_REPORT_ID" \
      --http-method "$METHOD" --authorization-type NONE --region "$REGION"
    aws apigateway put-integration \
      --rest-api-id "$REST_API_ID" --resource-id "$WORK_REPORT_ID" \
      --http-method "$METHOD" --type AWS_PROXY --integration-http-method POST \
      --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
      --region "$REGION"
    aws lambda add-permission \
      --function-name "${LAMBDA_FUNCTION_NAME}:${STAGE}" \
      --statement-id "apigw-work-report-${METHOD}-$(date +%s)-${RANDOM}" \
      --action lambda:InvokeFunction \
      --principal apigateway.amazonaws.com \
      --source-arn "arn:aws:execute-api:${REGION}:475462779604:${REST_API_ID}/*/${METHOD}/work-report" \
      --region "$REGION" 2>/dev/null || true
  done

  echo "  OPTIONS（CORS）を追加..."
  aws apigateway put-method \
    --rest-api-id "$REST_API_ID" --resource-id "$WORK_REPORT_ID" \
    --http-method OPTIONS --authorization-type NONE --region "$REGION" 2>/dev/null || true
  aws apigateway put-integration \
    --rest-api-id "$REST_API_ID" --resource-id "$WORK_REPORT_ID" \
    --http-method OPTIONS --type MOCK \
    --request-templates '{"application/json":"{\"statusCode\":200}"}' \
    --region "$REGION" 2>/dev/null || true
  aws apigateway put-method-response \
    --rest-api-id "$REST_API_ID" --resource-id "$WORK_REPORT_ID" \
    --http-method OPTIONS --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Origin":false,"method.response.header.Access-Control-Allow-Headers":false,"method.response.header.Access-Control-Allow-Methods":false}' \
    --region "$REGION" 2>/dev/null || true
  aws apigateway put-integration-response \
    --rest-api-id "$REST_API_ID" --resource-id "$WORK_REPORT_ID" \
    --http-method OPTIONS --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'","method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,PUT,POST,PATCH,DELETE,OPTIONS'"'"'"}' \
    --region "$REGION" 2>/dev/null || true
else
  echo "[/work-report] は既に存在します (id: $WORK_REPORT_ID)"
fi

# 以降は setup_work_report_upload_api.sh と同様
RESOURCES_JSON=$(aws apigateway get-resources --rest-api-id "$REST_API_ID" --region "$REGION" --output json)
WORK_REPORT_ID=$(echo "$RESOURCES_JSON" | jq -r '.items[] | select(.path == "/work-report") | .id')
UPLOAD_URL_ID=$(echo "$RESOURCES_JSON" | jq -r '.items[] | select(.path == "/upload-url") | .id')
UPLOAD_PUT_ID=$(echo "$RESOURCES_JSON" | jq -r '.items[] | select(.path == "/upload-put") | .id')
WORK_REPORT_ID_RESOURCE_ID=$(echo "$RESOURCES_JSON" | jq -r '.items[] | select(.path == "/work-report/{id}") | .id')

# --- /upload-url が無ければ作成 ---
if [ -z "$UPLOAD_URL_ID" ] || [ "$UPLOAD_URL_ID" = "null" ]; then
  echo ""
  echo "[/upload-url] リソースが無いため作成します..."
  UPLOAD_URL_ID=$(aws apigateway create-resource --rest-api-id "$REST_API_ID" --region "$REGION" --parent-id "$ROOT_ID" --path-part "upload-url" --query "id" --output text)
  echo "  /upload-url (id: $UPLOAD_URL_ID) を作成しました"
  aws apigateway put-method --rest-api-id "$REST_API_ID" --resource-id "$UPLOAD_URL_ID" --http-method POST --authorization-type NONE --region "$REGION"
  aws apigateway put-integration --rest-api-id "$REST_API_ID" --resource-id "$UPLOAD_URL_ID" --http-method POST --type AWS_PROXY --integration-http-method POST --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" --region "$REGION"
  aws apigateway put-method --rest-api-id "$REST_API_ID" --resource-id "$UPLOAD_URL_ID" --http-method OPTIONS --authorization-type NONE --region "$REGION" 2>/dev/null || true
  aws apigateway put-integration --rest-api-id "$REST_API_ID" --resource-id "$UPLOAD_URL_ID" --http-method OPTIONS --type MOCK --request-templates '{"application/json":"{\"statusCode\":200}"}' --region "$REGION" 2>/dev/null || true
  aws apigateway put-method-response --rest-api-id "$REST_API_ID" --resource-id "$UPLOAD_URL_ID" --http-method OPTIONS --status-code 200 --response-parameters '{"method.response.header.Access-Control-Allow-Origin":false,"method.response.header.Access-Control-Allow-Headers":false,"method.response.header.Access-Control-Allow-Methods":false}' --region "$REGION" 2>/dev/null || true
  aws apigateway put-integration-response --rest-api-id "$REST_API_ID" --resource-id "$UPLOAD_URL_ID" --http-method OPTIONS --status-code 200 --response-parameters '{"method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'","method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,PUT,POST,PATCH,DELETE,OPTIONS'"'"'"}' --region "$REGION" 2>/dev/null || true
  aws lambda add-permission --function-name "${LAMBDA_FUNCTION_NAME}:${STAGE}" --statement-id "apigw-upload-url-$(date +%s)" --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:475462779604:${REST_API_ID}/*/POST/upload-url" --region "$REGION" 2>/dev/null || true
else
  echo "[/upload-url] は既に存在します (id: $UPLOAD_URL_ID)"
fi

# --- /upload-put が無ければ作成 ---
if [ -z "$UPLOAD_PUT_ID" ] || [ "$UPLOAD_PUT_ID" = "null" ]; then
  echo ""
  echo "[/upload-put] リソースが無いため作成します..."
  UPLOAD_PUT_ID=$(aws apigateway create-resource --rest-api-id "$REST_API_ID" --region "$REGION" --parent-id "$ROOT_ID" --path-part "upload-put" --query "id" --output text)
  echo "  /upload-put (id: $UPLOAD_PUT_ID) を作成しました"
  aws apigateway put-method --rest-api-id "$REST_API_ID" --resource-id "$UPLOAD_PUT_ID" --http-method POST --authorization-type NONE --region "$REGION"
  aws apigateway put-integration --rest-api-id "$REST_API_ID" --resource-id "$UPLOAD_PUT_ID" --http-method POST --type AWS_PROXY --integration-http-method POST --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" --region "$REGION"
  aws apigateway put-method --rest-api-id "$REST_API_ID" --resource-id "$UPLOAD_PUT_ID" --http-method OPTIONS --authorization-type NONE --region "$REGION" 2>/dev/null || true
  aws apigateway put-integration --rest-api-id "$REST_API_ID" --resource-id "$UPLOAD_PUT_ID" --http-method OPTIONS --type MOCK --request-templates '{"application/json":"{\"statusCode\":200}"}' --region "$REGION" 2>/dev/null || true
  aws apigateway put-method-response --rest-api-id "$REST_API_ID" --resource-id "$UPLOAD_PUT_ID" --http-method OPTIONS --status-code 200 --response-parameters '{"method.response.header.Access-Control-Allow-Origin":false,"method.response.header.Access-Control-Allow-Headers":false,"method.response.header.Access-Control-Allow-Methods":false}' --region "$REGION" 2>/dev/null || true
  aws apigateway put-integration-response --rest-api-id "$REST_API_ID" --resource-id "$UPLOAD_PUT_ID" --http-method OPTIONS --status-code 200 --response-parameters '{"method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'","method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,PUT,POST,PATCH,DELETE,OPTIONS'"'"'"}' --region "$REGION" 2>/dev/null || true
  aws lambda add-permission --function-name "${LAMBDA_FUNCTION_NAME}:${STAGE}" --statement-id "apigw-upload-put-$(date +%s)" --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:475462779604:${REST_API_ID}/*/POST/upload-put" --region "$REGION" 2>/dev/null || true
else
  echo "[/upload-put] は既に存在します (id: $UPLOAD_PUT_ID)"
fi

# --- /work-report/{id} が無ければ作成 ---
if [ -z "$WORK_REPORT_ID_RESOURCE_ID" ] || [ "$WORK_REPORT_ID_RESOURCE_ID" = "null" ]; then
  echo ""
  echo "[/work-report/{id}] リソースが無いため作成します..."
  WORK_REPORT_ID_RESOURCE_ID=$(aws apigateway create-resource --rest-api-id "$REST_API_ID" --region "$REGION" --parent-id "$WORK_REPORT_ID" --path-part "{id}" --query "id" --output text)
  echo "  /work-report/{id} (id: $WORK_REPORT_ID_RESOURCE_ID) を作成しました"
  for METHOD in GET PATCH; do
    aws apigateway put-method --rest-api-id "$REST_API_ID" --resource-id "$WORK_REPORT_ID_RESOURCE_ID" --http-method "$METHOD" --authorization-type NONE --region "$REGION"
    aws apigateway put-integration --rest-api-id "$REST_API_ID" --resource-id "$WORK_REPORT_ID_RESOURCE_ID" --http-method "$METHOD" --type AWS_PROXY --integration-http-method POST --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" --region "$REGION"
    aws lambda add-permission --function-name "${LAMBDA_FUNCTION_NAME}:${STAGE}" --statement-id "apigw-work-report-id-${METHOD}-$(date +%s)-${RANDOM}" --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:475462779604:${REST_API_ID}/*/${METHOD}/work-report/*" --region "$REGION" 2>/dev/null || true
  done
  aws apigateway put-method --rest-api-id "$REST_API_ID" --resource-id "$WORK_REPORT_ID_RESOURCE_ID" --http-method OPTIONS --authorization-type NONE --region "$REGION" 2>/dev/null || true
  aws apigateway put-integration --rest-api-id "$REST_API_ID" --resource-id "$WORK_REPORT_ID_RESOURCE_ID" --http-method OPTIONS --type MOCK --request-templates '{"application/json":"{\"statusCode\":200}"}' --region "$REGION" 2>/dev/null || true
  aws apigateway put-method-response --rest-api-id "$REST_API_ID" --resource-id "$WORK_REPORT_ID_RESOURCE_ID" --http-method OPTIONS --status-code 200 --response-parameters '{"method.response.header.Access-Control-Allow-Origin":false,"method.response.header.Access-Control-Allow-Headers":false,"method.response.header.Access-Control-Allow-Methods":false}' --region "$REGION" 2>/dev/null || true
  aws apigateway put-integration-response --rest-api-id "$REST_API_ID" --resource-id "$WORK_REPORT_ID_RESOURCE_ID" --http-method OPTIONS --status-code 200 --response-parameters '{"method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'","method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,PUT,POST,PATCH,DELETE,OPTIONS'"'"'"}' --region "$REGION" 2>/dev/null || true
else
  echo "[/work-report/{id}] は既に存在します (id: $WORK_REPORT_ID_RESOURCE_ID)"
fi

# --- /admin/{proxy+} が無ければ作成（管理一覧・詳細・state・payroll 用）---
RESOURCES_JSON=$(aws apigateway get-resources --rest-api-id "$REST_API_ID" --region "$REGION" --output json)
ADMIN_ID=$(echo "$RESOURCES_JSON" | jq -r '.items[] | select(.path == "/admin") | .id')
ADMIN_PROXY_ID=$(echo "$RESOURCES_JSON" | jq -r '.items[] | select(.path == "/admin/{proxy+}") | .id')

if [ -z "$ADMIN_ID" ] || [ "$ADMIN_ID" = "null" ]; then
  echo ""
  echo "[/admin] リソースが無いため作成します..."
  ADMIN_ID=$(aws apigateway create-resource --rest-api-id "$REST_API_ID" --region "$REGION" --parent-id "$ROOT_ID" --path-part "admin" --query "id" --output text)
  echo "  /admin (id: $ADMIN_ID) を作成しました"
fi

if [ -z "$ADMIN_PROXY_ID" ] || [ "$ADMIN_PROXY_ID" = "null" ]; then
  echo ""
  echo "[/admin/{proxy+}] リソースが無いため作成します（管理一覧・詳細・payroll 用）..."
  ADMIN_PROXY_ID=$(aws apigateway create-resource --rest-api-id "$REST_API_ID" --region "$REGION" --parent-id "$ADMIN_ID" --path-part "{proxy+}" --query "id" --output text)
  echo "  /admin/{proxy+} (id: $ADMIN_PROXY_ID) を作成しました"
  aws apigateway put-method --rest-api-id "$REST_API_ID" --resource-id "$ADMIN_PROXY_ID" --http-method ANY --authorization-type NONE --region "$REGION"
  aws apigateway put-integration --rest-api-id "$REST_API_ID" --resource-id "$ADMIN_PROXY_ID" --http-method ANY --type AWS_PROXY --integration-http-method POST --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" --region "$REGION"
  aws apigateway put-method --rest-api-id "$REST_API_ID" --resource-id "$ADMIN_PROXY_ID" --http-method OPTIONS --authorization-type NONE --region "$REGION" 2>/dev/null || true
  aws apigateway put-integration --rest-api-id "$REST_API_ID" --resource-id "$ADMIN_PROXY_ID" --http-method OPTIONS --type MOCK --request-templates '{"application/json":"{\"statusCode\":200}"}' --region "$REGION" 2>/dev/null || true
  aws lambda add-permission --function-name "${LAMBDA_FUNCTION_NAME}:${STAGE}" --statement-id "apigw-admin-proxy-$(date +%s)-${RANDOM}" --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:475462779604:${REST_API_ID}/*/*/admin/*" --region "$REGION" 2>/dev/null || true
else
  echo "[/admin/{proxy+}] は既に存在します (id: $ADMIN_PROXY_ID)"
fi

echo ""
echo "=== API を ${STAGE} にデプロイ ==="
DEPLOYMENT_ID=$(aws apigateway create-deployment \
  --rest-api-id "$REST_API_ID" \
  --region "$REGION" \
  --stage-name "$STAGE" \
  --description "work-report API full (setup_work_report_api_full.sh)" \
  --query "id" --output text)
echo "  Deployment ID: $DEPLOYMENT_ID"

echo ""
echo "=============================================="
echo "✅ ワークレポート API の一括セットアップ完了。"
echo "   認証を NONE に統一: ./scripts/apigw_proxy_auth_to_none.sh"
echo "   仕様: docs/spec/WORK_REPORT_API_SPEC.md"
echo "=============================================="
