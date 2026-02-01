#!/bin/bash
# API Gateway CORS: localhost (3333/3334) を許可し、両 API を prod にデプロイ
# 51bhoxkbxd と 2z0ui5xfxb の全リソースに OPTIONS（MOCK）を追加し、Access-Control-Allow-Origin: * で localhost を許可
# 実行: ./scripts/apigw_cors_localhost.sh

set -e
REGION="ap-northeast-1"
STAGE="prod"

# OPTIONS + CORS を1リソースに設定する関数
setup_cors_options() {
  local api_id=$1
  local resource_id=$2
  local path=$3
  local methods="${4:-GET,POST,PUT,PATCH,DELETE,OPTIONS}"

  echo "  [${path}] OPTIONS を設定..."
  aws apigateway put-method \
    --rest-api-id "$api_id" \
    --resource-id "$resource_id" \
    --http-method OPTIONS \
    --authorization-type NONE \
    --region "$REGION" \
    --no-api-key-required \
    > /dev/null 2>&1 || true

  aws apigateway put-integration \
    --rest-api-id "$api_id" \
    --resource-id "$resource_id" \
    --http-method OPTIONS \
    --type MOCK \
    --request-templates '{"application/json":"{\"statusCode\":200}"}' \
    --region "$REGION" \
    > /dev/null 2>&1 || true

  aws apigateway put-method-response \
    --rest-api-id "$api_id" \
    --resource-id "$resource_id" \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Headers":false,"method.response.header.Access-Control-Allow-Methods":false,"method.response.header.Access-Control-Allow-Origin":false}' \
    --region "$REGION" \
    > /dev/null 2>&1 || true

  # Allow-Origin: * で localhost 含む全オリジンを許可
  aws apigateway put-integration-response \
    --rest-api-id "$api_id" \
    --resource-id "$resource_id" \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters "{\"method.response.header.Access-Control-Allow-Headers\":\"'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,Accept,Origin,X-Requested-With'\",\"method.response.header.Access-Control-Allow-Methods\":\"'${methods}'\",\"method.response.header.Access-Control-Allow-Origin\":\"'*'\"}" \
    --region "$REGION" \
    > /dev/null 2>&1 || true
}

# 1 API に対して全リソースに CORS OPTIONS を追加しデプロイ
deploy_api_cors() {
  local api_id=$1
  echo ""
  echo "=== API ${api_id} のリソース一覧取得 ==="
  local resources_json
  resources_json=$(aws apigateway get-resources --rest-api-id "$api_id" --region "$REGION" --output json)
  local count
  count=$(echo "$resources_json" | jq -r '.items | length')
  echo "  リソース数: ${count}"

  echo "$resources_json" | jq -r '.items[] | "\(.id) \(.path)"' | while read -r rid path; do
    [ -z "$rid" ] && continue
    setup_cors_options "$api_id" "$rid" "$path"
  done

  echo ""
  echo "=== API ${api_id} を ${STAGE} にデプロイ ==="
  aws apigateway create-deployment \
    --rest-api-id "$api_id" \
    --region "$REGION" \
    --stage-name "$STAGE" \
    --description "CORS allow localhost (apigw_cors_localhost.sh)" \
    --query "id" \
    --output text
  echo "  デプロイ完了: https://${api_id}.execute-api.${REGION}.amazonaws.com/${STAGE}/"
}

echo "=============================================="
echo "API Gateway CORS 設定 (localhost 許可) + デプロイ"
echo "=============================================="
echo "対象: 51bhoxkbxd, 2z0ui5xfxb"
echo "Allow-Origin: * (http://localhost:3334 等を含む)"
echo ""

deploy_api_cors "51bhoxkbxd"
deploy_api_cors "2z0ui5xfxb"

echo ""
echo "=============================================="
echo "✅ 両 API の CORS 設定と prod デプロイが完了しました。"
echo "   http://localhost:3334 からのアクセスが許可されます。"
echo "=============================================="
