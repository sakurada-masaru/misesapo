#!/bin/bash
# API Gateway の Gateway Responses の Access-Control-Allow-Origin を '*' に更新
# これによりエラー応答（404/403/500等）でも localhost から CORS が通る
# 実行: ./scripts/apigw_gateway_response_cors_star.sh

set -e
API_ID="${1:-51bhoxkbxd}"
REGION="ap-northeast-1"
STAGE="prod"

# 既存の CORS ヘッダーを維持しつつ Allow-Origin のみ '*' に（1行JSON）
CORS_PARAMS='{"gatewayresponse.header.Access-Control-Allow-Credentials":"'\''true'\''","gatewayresponse.header.Access-Control-Allow-Headers":"'\''Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,Accept,Origin,X-Requested-With'\''","gatewayresponse.header.Access-Control-Allow-Methods":"'\''GET,PUT,POST,PATCH,DELETE,OPTIONS'\''","gatewayresponse.header.Access-Control-Allow-Origin":"'\''*'\''"}'

RESPONSE_TYPES="
DEFAULT_4XX
DEFAULT_5XX
ACCESS_DENIED
API_CONFIGURATION_ERROR
AUTHORIZER_CONFIGURATION_ERROR
AUTHORIZER_FAILURE
BAD_REQUEST_BODY
BAD_REQUEST_PARAMETERS
EXPIRED_TOKEN
INTEGRATION_FAILURE
INTEGRATION_TIMEOUT
INVALID_API_KEY
INVALID_SIGNATURE
MISSING_AUTHENTICATION_TOKEN
QUOTA_EXCEEDED
REQUEST_TOO_LARGE
RESOURCE_NOT_FOUND
THROTTLED
UNAUTHORIZED
UNSUPPORTED_MEDIA_TYPE
WAF_FILTERED
"

echo "=============================================="
echo "API Gateway Gateway Responses: Allow-Origin → *"
echo "API ID: $API_ID"
echo "=============================================="

for rt in $RESPONSE_TYPES; do
  echo "  Updating $rt..."
  aws apigateway put-gateway-response \
    --rest-api-id "$API_ID" \
    --response-type "$rt" \
    --response-parameters "$CORS_PARAMS" \
    --region "$REGION" \
    > /dev/null 2>&1 || echo "    (skip $rt)"
done

echo ""
echo "=== API を ${STAGE} にデプロイ ==="
aws apigateway create-deployment \
  --rest-api-id "$API_ID" \
  --region "$REGION" \
  --stage-name "$STAGE" \
  --description "Gateway Responses CORS Allow-Origin * (apigw_gateway_response_cors_star.sh)" \
  --query "id" \
  --output text

echo ""
echo "=============================================="
echo "✅ Gateway Responses の CORS を * に更新し、prod にデプロイしました。"
echo "   https://${API_ID}.execute-api.${REGION}.amazonaws.com/${STAGE}/"
echo "=============================================="
