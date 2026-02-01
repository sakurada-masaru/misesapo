#!/bin/bash
# 業務報告専用の **新規** API Gateway を作成し、Lambda に統合して prod にデプロイする
# 既存の 51bhoxkbxd には触らず、ワークレポートだけ別ゲートで運用する
# 実行: ./scripts/aws/create_work_report_gateway.sh
# 出力: 新 API の Invoke URL（フロントの proxy や環境変数に設定する）

set -e
REGION="ap-northeast-1"
STAGE="prod"
LAMBDA_FUNCTION_NAME="misesapo-reports"
LAMBDA_ARN="arn:aws:lambda:${REGION}:475462779604:function:${LAMBDA_FUNCTION_NAME}:${STAGE}"
ACCOUNT_ID="475462779604"
API_NAME="misesapo-work-report"

echo "=============================================="
echo "業務報告専用 API Gateway を新規作成"
echo "API 名: ${API_NAME}  Region: ${REGION}  Lambda: ${LAMBDA_FUNCTION_NAME}:${STAGE}"
echo "=============================================="

# 新規 REST API 作成
API_ID=$(aws apigateway create-rest-api \
  --name "$API_NAME" \
  --description "業務報告（ワークレポート）専用 API" \
  --region "$REGION" \
  --endpoint-configuration types=REGIONAL \
  --query "id" --output text)
echo "新規 API 作成: id=$API_ID"

ROOT_ID=$(aws apigateway get-resources --rest-api-id "$API_ID" --region "$REGION" --query "items[?path=='/'].id" --output text)

# /work-report
WR_ID=$(aws apigateway create-resource --rest-api-id "$API_ID" --region "$REGION" --parent-id "$ROOT_ID" --path-part "work-report" --query "id" --output text)
for METHOD in GET PUT; do
  aws apigateway put-method --rest-api-id "$API_ID" --resource-id "$WR_ID" --http-method "$METHOD" --authorization-type NONE --region "$REGION"
  aws apigateway put-integration --rest-api-id "$API_ID" --resource-id "$WR_ID" --http-method "$METHOD" --type AWS_PROXY --integration-http-method POST --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" --region "$REGION"
  aws lambda add-permission --function-name "${LAMBDA_FUNCTION_NAME}:${STAGE}" --statement-id "wr-${METHOD}-$(date +%s)-${RANDOM}" --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/${METHOD}/work-report" --region "$REGION" 2>/dev/null || true
done
aws apigateway put-method --rest-api-id "$API_ID" --resource-id "$WR_ID" --http-method OPTIONS --authorization-type NONE --region "$REGION" 2>/dev/null || true
aws apigateway put-integration --rest-api-id "$API_ID" --resource-id "$WR_ID" --http-method OPTIONS --type MOCK --request-templates '{"application/json":"{\"statusCode\":200}"}' --region "$REGION" 2>/dev/null || true
aws apigateway put-method-response --rest-api-id "$API_ID" --resource-id "$WR_ID" --http-method OPTIONS --status-code 200 --response-parameters '{"method.response.header.Access-Control-Allow-Origin":false,"method.response.header.Access-Control-Allow-Headers":false,"method.response.header.Access-Control-Allow-Methods":false}' --region "$REGION" 2>/dev/null || true
aws apigateway put-integration-response --rest-api-id "$API_ID" --resource-id "$WR_ID" --http-method OPTIONS --status-code 200 --response-parameters '{"method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'","method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,PUT,POST,PATCH,DELETE,OPTIONS'"'"'"}' --region "$REGION" 2>/dev/null || true
echo "  /work-report (GET, PUT, OPTIONS) 作成済み"

# /work-report/{id}
WR_ID_RESOURCE=$(aws apigateway create-resource --rest-api-id "$API_ID" --region "$REGION" --parent-id "$WR_ID" --path-part "{id}" --query "id" --output text)
for METHOD in GET PATCH; do
  aws apigateway put-method --rest-api-id "$API_ID" --resource-id "$WR_ID_RESOURCE" --http-method "$METHOD" --authorization-type NONE --region "$REGION"
  aws apigateway put-integration --rest-api-id "$API_ID" --resource-id "$WR_ID_RESOURCE" --http-method "$METHOD" --type AWS_PROXY --integration-http-method POST --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" --region "$REGION"
  aws lambda add-permission --function-name "${LAMBDA_FUNCTION_NAME}:${STAGE}" --statement-id "wr-id-${METHOD}-$(date +%s)-${RANDOM}" --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/${METHOD}/work-report/*" --region "$REGION" 2>/dev/null || true
done
aws apigateway put-method --rest-api-id "$API_ID" --resource-id "$WR_ID_RESOURCE" --http-method OPTIONS --authorization-type NONE --region "$REGION" 2>/dev/null || true
aws apigateway put-integration --rest-api-id "$API_ID" --resource-id "$WR_ID_RESOURCE" --http-method OPTIONS --type MOCK --request-templates '{"application/json":"{\"statusCode\":200}"}' --region "$REGION" 2>/dev/null || true
aws apigateway put-method-response --rest-api-id "$API_ID" --resource-id "$WR_ID_RESOURCE" --http-method OPTIONS --status-code 200 --response-parameters '{"method.response.header.Access-Control-Allow-Origin":false,"method.response.header.Access-Control-Allow-Headers":false,"method.response.header.Access-Control-Allow-Methods":false}' --region "$REGION" 2>/dev/null || true
aws apigateway put-integration-response --rest-api-id "$API_ID" --resource-id "$WR_ID_RESOURCE" --http-method OPTIONS --status-code 200 --response-parameters '{"method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'","method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,PUT,POST,PATCH,DELETE,OPTIONS'"'"'"}' --region "$REGION" 2>/dev/null || true
echo "  /work-report/{id} (GET, PATCH, OPTIONS) 作成済み"

# /upload-url
UPLOAD_URL_ID=$(aws apigateway create-resource --rest-api-id "$API_ID" --region "$REGION" --parent-id "$ROOT_ID" --path-part "upload-url" --query "id" --output text)
aws apigateway put-method --rest-api-id "$API_ID" --resource-id "$UPLOAD_URL_ID" --http-method POST --authorization-type NONE --region "$REGION"
aws apigateway put-integration --rest-api-id "$API_ID" --resource-id "$UPLOAD_URL_ID" --http-method POST --type AWS_PROXY --integration-http-method POST --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" --region "$REGION"
aws apigateway put-method --rest-api-id "$API_ID" --resource-id "$UPLOAD_URL_ID" --http-method OPTIONS --authorization-type NONE --region "$REGION" 2>/dev/null || true
aws apigateway put-integration --rest-api-id "$API_ID" --resource-id "$UPLOAD_URL_ID" --http-method OPTIONS --type MOCK --request-templates '{"application/json":"{\"statusCode\":200}"}' --region "$REGION" 2>/dev/null || true
aws apigateway put-method-response --rest-api-id "$API_ID" --resource-id "$UPLOAD_URL_ID" --http-method OPTIONS --status-code 200 --response-parameters '{"method.response.header.Access-Control-Allow-Origin":false,"method.response.header.Access-Control-Allow-Headers":false,"method.response.header.Access-Control-Allow-Methods":false}' --region "$REGION" 2>/dev/null || true
aws apigateway put-integration-response --rest-api-id "$API_ID" --resource-id "$UPLOAD_URL_ID" --http-method OPTIONS --status-code 200 --response-parameters '{"method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'","method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,PUT,POST,PATCH,DELETE,OPTIONS'"'"'"}' --region "$REGION" 2>/dev/null || true
aws lambda add-permission --function-name "${LAMBDA_FUNCTION_NAME}:${STAGE}" --statement-id "wr-upload-url-$(date +%s)" --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/POST/upload-url" --region "$REGION" 2>/dev/null || true
echo "  /upload-url (POST, OPTIONS) 作成済み"

# /upload-put
UPLOAD_PUT_ID=$(aws apigateway create-resource --rest-api-id "$API_ID" --region "$REGION" --parent-id "$ROOT_ID" --path-part "upload-put" --query "id" --output text)
aws apigateway put-method --rest-api-id "$API_ID" --resource-id "$UPLOAD_PUT_ID" --http-method POST --authorization-type NONE --region "$REGION"
aws apigateway put-integration --rest-api-id "$API_ID" --resource-id "$UPLOAD_PUT_ID" --http-method POST --type AWS_PROXY --integration-http-method POST --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" --region "$REGION"
aws apigateway put-method --rest-api-id "$API_ID" --resource-id "$UPLOAD_PUT_ID" --http-method OPTIONS --authorization-type NONE --region "$REGION" 2>/dev/null || true
aws apigateway put-integration --rest-api-id "$API_ID" --resource-id "$UPLOAD_PUT_ID" --http-method OPTIONS --type MOCK --request-templates '{"application/json":"{\"statusCode\":200}"}' --region "$REGION" 2>/dev/null || true
aws apigateway put-method-response --rest-api-id "$API_ID" --resource-id "$UPLOAD_PUT_ID" --http-method OPTIONS --status-code 200 --response-parameters '{"method.response.header.Access-Control-Allow-Origin":false,"method.response.header.Access-Control-Allow-Headers":false,"method.response.header.Access-Control-Allow-Methods":false}' --region "$REGION" 2>/dev/null || true
aws apigateway put-integration-response --rest-api-id "$API_ID" --resource-id "$UPLOAD_PUT_ID" --http-method OPTIONS --status-code 200 --response-parameters '{"method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'","method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,PUT,POST,PATCH,DELETE,OPTIONS'"'"'"}' --region "$REGION" 2>/dev/null || true
aws lambda add-permission --function-name "${LAMBDA_FUNCTION_NAME}:${STAGE}" --statement-id "wr-upload-put-$(date +%s)" --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/POST/upload-put" --region "$REGION" 2>/dev/null || true
echo "  /upload-put (POST, OPTIONS) 作成済み"

# prod にデプロイ（--stage-name でステージが無ければ自動作成される）
aws apigateway create-deployment \
  --rest-api-id "$API_ID" \
  --region "$REGION" \
  --stage-name "$STAGE" \
  --description "Initial deployment (create_work_report_gateway.sh)" \
  --query "id" --output text > /dev/null
echo ""
echo "=== prod にデプロイ済み ==="

INVOKE_URL="https://${API_ID}.execute-api.${REGION}.amazonaws.com/${STAGE}"

# 作成した Invoke URL を保存（vite の proxy がこのファイルを参照する）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
URL_FILE="$ROOT/docs/spec/WORK_REPORT_GATEWAY_URL.txt"
echo "$INVOKE_URL" > "$URL_FILE"
echo "   Invoke URL を保存: $URL_FILE"

echo ""
echo "=============================================="
echo "✅ 業務報告専用 API Gateway 作成完了"
echo "   API ID: $API_ID"
echo "   Invoke URL: $INVOKE_URL"
echo ""
echo "フロント: vite の /api-wr プロキシが上記 URL を参照します（vite 再起動で反映）。"
echo "   仕様: docs/spec/WORK_REPORT_API_SPEC.md"
echo "=============================================="
