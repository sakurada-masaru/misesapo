#!/bin/bash
# API Gateway: /upload-url, /upload-put と /work-report/{id} リソースを追加（無い場合のみ）
# フロントが api/upload-url, api/upload-put（S3 CORS 回避用）と api/work-report/{id} を呼ぶため
# 実行: ./scripts/aws/setup_work_report_upload_api.sh
# 前提: /work-report は既に存在すること。Lambda misesapo-reports:prod がデプロイ済みであること。

set -e
REST_API_ID="${1:-51bhoxkbxd}"
REGION="ap-northeast-1"
STAGE="prod"
LAMBDA_FUNCTION_NAME="misesapo-reports"
LAMBDA_ARN="arn:aws:lambda:${REGION}:475462779604:function:${LAMBDA_FUNCTION_NAME}:${STAGE}"

echo "=============================================="
echo "API Gateway: /upload-url と /work-report/{id} の追加"
echo "API ID: $REST_API_ID  Region: $REGION  Lambda: $LAMBDA_FUNCTION_NAME:$STAGE"
echo "=============================================="

RESOURCES_JSON=$(aws apigateway get-resources --rest-api-id "$REST_API_ID" --region "$REGION" --output json)
ROOT_ID=$(echo "$RESOURCES_JSON" | jq -r '.items[] | select(.path == "/") | .id')
WORK_REPORT_ID=$(echo "$RESOURCES_JSON" | jq -r '.items[] | select(.path == "/work-report") | .id')
UPLOAD_URL_ID=$(echo "$RESOURCES_JSON" | jq -r '.items[] | select(.path == "/upload-url") | .id')
UPLOAD_PUT_ID=$(echo "$RESOURCES_JSON" | jq -r '.items[] | select(.path == "/upload-put") | .id')
WORK_REPORT_ID_RESOURCE_ID=$(echo "$RESOURCES_JSON" | jq -r '.items[] | select(.path == "/work-report/{id}") | .id')

if [ -z "$ROOT_ID" ] || [ "$ROOT_ID" = "null" ]; then
  echo "エラー: ルートリソース (/) が見つかりません"
  exit 1
fi
if [ -z "$WORK_REPORT_ID" ] || [ "$WORK_REPORT_ID" = "null" ]; then
  echo "エラー: /work-report リソースが見つかりません。先に /work-report を作成してください。"
  exit 1
fi

# --- /upload-url が無ければ作成 ---
if [ -z "$UPLOAD_URL_ID" ] || [ "$UPLOAD_URL_ID" = "null" ]; then
  echo ""
  echo "[/upload-url] リソースが無いため作成します..."
  UPLOAD_URL_ID=$(aws apigateway create-resource \
    --rest-api-id "$REST_API_ID" \
    --region "$REGION" \
    --parent-id "$ROOT_ID" \
    --path-part "upload-url" \
    --query "id" --output text)
  echo "  /upload-url (id: $UPLOAD_URL_ID) を作成しました"

  echo "  POST メソッドを追加（認証 NONE、Lambda プロキシ）..."
  aws apigateway put-method \
    --rest-api-id "$REST_API_ID" --resource-id "$UPLOAD_URL_ID" \
    --http-method POST --authorization-type NONE --region "$REGION"
  aws apigateway put-integration \
    --rest-api-id "$REST_API_ID" --resource-id "$UPLOAD_URL_ID" \
    --http-method POST --type AWS_PROXY --integration-http-method POST \
    --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
    --region "$REGION"

  echo "  OPTIONS（CORS）を追加..."
  aws apigateway put-method \
    --rest-api-id "$REST_API_ID" --resource-id "$UPLOAD_URL_ID" \
    --http-method OPTIONS --authorization-type NONE --region "$REGION" 2>/dev/null || true
  aws apigateway put-integration \
    --rest-api-id "$REST_API_ID" --resource-id "$UPLOAD_URL_ID" \
    --http-method OPTIONS --type MOCK \
    --request-templates '{"application/json":"{\"statusCode\":200}"}' \
    --region "$REGION" 2>/dev/null || true
  aws apigateway put-method-response \
    --rest-api-id "$REST_API_ID" --resource-id "$UPLOAD_URL_ID" \
    --http-method OPTIONS --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Origin":false,"method.response.header.Access-Control-Allow-Headers":false,"method.response.header.Access-Control-Allow-Methods":false}' \
    --region "$REGION" 2>/dev/null || true
  aws apigateway put-integration-response \
    --rest-api-id "$REST_API_ID" --resource-id "$UPLOAD_URL_ID" \
    --http-method OPTIONS --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'","method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,PUT,POST,PATCH,DELETE,OPTIONS'"'"'"}' \
    --region "$REGION" 2>/dev/null || true

  aws lambda add-permission \
    --function-name "${LAMBDA_FUNCTION_NAME}:${STAGE}" \
    --statement-id "apigw-upload-url-$(date +%s)" \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:475462779604:${REST_API_ID}/*/POST/upload-url" \
    --region "$REGION" 2>/dev/null || echo "  (Lambda 権限は既に存在する可能性)"
else
  echo "[/upload-url] は既に存在します (id: $UPLOAD_URL_ID)"
fi

# --- /upload-put が無ければ作成（S3 直接 PUT の CORS 回避用）---
if [ -z "$UPLOAD_PUT_ID" ] || [ "$UPLOAD_PUT_ID" = "null" ]; then
  echo ""
  echo "[/upload-put] リソースが無いため作成します..."
  UPLOAD_PUT_ID=$(aws apigateway create-resource \
    --rest-api-id "$REST_API_ID" \
    --region "$REGION" \
    --parent-id "$ROOT_ID" \
    --path-part "upload-put" \
    --query "id" --output text)
  echo "  /upload-put (id: $UPLOAD_PUT_ID) を作成しました"

  echo "  POST メソッドを追加（認証 NONE、Lambda プロキシ）..."
  aws apigateway put-method \
    --rest-api-id "$REST_API_ID" --resource-id "$UPLOAD_PUT_ID" \
    --http-method POST --authorization-type NONE --region "$REGION"
  aws apigateway put-integration \
    --rest-api-id "$REST_API_ID" --resource-id "$UPLOAD_PUT_ID" \
    --http-method POST --type AWS_PROXY --integration-http-method POST \
    --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
    --region "$REGION"

  echo "  OPTIONS（CORS）を追加..."
  aws apigateway put-method \
    --rest-api-id "$REST_API_ID" --resource-id "$UPLOAD_PUT_ID" \
    --http-method OPTIONS --authorization-type NONE --region "$REGION" 2>/dev/null || true
  aws apigateway put-integration \
    --rest-api-id "$REST_API_ID" --resource-id "$UPLOAD_PUT_ID" \
    --http-method OPTIONS --type MOCK \
    --request-templates '{"application/json":"{\"statusCode\":200}"}' \
    --region "$REGION" 2>/dev/null || true
  aws apigateway put-method-response \
    --rest-api-id "$REST_API_ID" --resource-id "$UPLOAD_PUT_ID" \
    --http-method OPTIONS --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Origin":false,"method.response.header.Access-Control-Allow-Headers":false,"method.response.header.Access-Control-Allow-Methods":false}' \
    --region "$REGION" 2>/dev/null || true
  aws apigateway put-integration-response \
    --rest-api-id "$REST_API_ID" --resource-id "$UPLOAD_PUT_ID" \
    --http-method OPTIONS --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'","method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,PUT,POST,PATCH,DELETE,OPTIONS'"'"'"}' \
    --region "$REGION" 2>/dev/null || true

  aws lambda add-permission \
    --function-name "${LAMBDA_FUNCTION_NAME}:${STAGE}" \
    --statement-id "apigw-upload-put-$(date +%s)" \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:475462779604:${REST_API_ID}/*/POST/upload-put" \
    --region "$REGION" 2>/dev/null || echo "  (Lambda 権限は既に存在する可能性)"
else
  echo "[/upload-put] は既に存在します (id: $UPLOAD_PUT_ID)"
fi

# --- /work-report/{id} が無ければ作成 ---
if [ -z "$WORK_REPORT_ID_RESOURCE_ID" ] || [ "$WORK_REPORT_ID_RESOURCE_ID" = "null" ]; then
  echo ""
  echo "[/work-report/{id}] リソースが無いため作成します..."
  WORK_REPORT_ID_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id "$REST_API_ID" \
    --region "$REGION" \
    --parent-id "$WORK_REPORT_ID" \
    --path-part "{id}" \
    --query "id" --output text)
  echo "  /work-report/{id} (id: $WORK_REPORT_ID_RESOURCE_ID) を作成しました"

  for METHOD in GET PATCH; do
    echo "  $METHOD メソッドを追加（認証 NONE、Lambda プロキシ）..."
    aws apigateway put-method \
      --rest-api-id "$REST_API_ID" --resource-id "$WORK_REPORT_ID_RESOURCE_ID" \
      --http-method "$METHOD" --authorization-type NONE --region "$REGION"
    aws apigateway put-integration \
      --rest-api-id "$REST_API_ID" --resource-id "$WORK_REPORT_ID_RESOURCE_ID" \
      --http-method "$METHOD" --type AWS_PROXY --integration-http-method POST \
      --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
      --region "$REGION"

    aws lambda add-permission \
      --function-name "${LAMBDA_FUNCTION_NAME}:${STAGE}" \
      --statement-id "apigw-work-report-id-${METHOD}-$(date +%s)-${RANDOM}" \
      --action lambda:InvokeFunction \
      --principal apigateway.amazonaws.com \
      --source-arn "arn:aws:execute-api:${REGION}:475462779604:${REST_API_ID}/*/${METHOD}/work-report/*" \
      --region "$REGION" 2>/dev/null || echo "    (Lambda 権限は既に存在する可能性)"
  done

  echo "  OPTIONS（CORS）を追加..."
  aws apigateway put-method \
    --rest-api-id "$REST_API_ID" --resource-id "$WORK_REPORT_ID_RESOURCE_ID" \
    --http-method OPTIONS --authorization-type NONE --region "$REGION" 2>/dev/null || true
  aws apigateway put-integration \
    --rest-api-id "$REST_API_ID" --resource-id "$WORK_REPORT_ID_RESOURCE_ID" \
    --http-method OPTIONS --type MOCK \
    --request-templates '{"application/json":"{\"statusCode\":200}"}' \
    --region "$REGION" 2>/dev/null || true
  aws apigateway put-method-response \
    --rest-api-id "$REST_API_ID" --resource-id "$WORK_REPORT_ID_RESOURCE_ID" \
    --http-method OPTIONS --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Origin":false,"method.response.header.Access-Control-Allow-Headers":false,"method.response.header.Access-Control-Allow-Methods":false}' \
    --region "$REGION" 2>/dev/null || true
  aws apigateway put-integration-response \
    --rest-api-id "$REST_API_ID" --resource-id "$WORK_REPORT_ID_RESOURCE_ID" \
    --http-method OPTIONS --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'","method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,PUT,POST,PATCH,DELETE,OPTIONS'"'"'"}' \
    --region "$REGION" 2>/dev/null || true
else
  echo "[/work-report/{id}] は既に存在します (id: $WORK_REPORT_ID_RESOURCE_ID)"
fi

echo ""
echo "=== API を ${STAGE} にデプロイ ==="
DEPLOYMENT_ID=$(aws apigateway create-deployment \
  --rest-api-id "$REST_API_ID" \
  --region "$REGION" \
  --stage-name "$STAGE" \
  --description "upload-url and work-report/{id} (setup_work_report_upload_api.sh)" \
  --query "id" --output text)
echo "  Deployment ID: $DEPLOYMENT_ID"

echo ""
echo "=============================================="
echo "✅ 完了。続けて認証を NONE に統一する場合: ./scripts/apigw_proxy_auth_to_none.sh"
echo "   ブラウザで 写真追加・業務報告提出 を再試行してください。"
echo "=============================================="
