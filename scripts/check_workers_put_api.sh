#!/bin/bash
# Workers API Gateway PUTメソッドの設定を確認するスクリプト

set -e

REST_API_ID="51bhoxkbxd"
REGION="ap-northeast-1"

echo "=== Workers API Gateway PUTメソッドの設定を確認 ==="

# /workers/{id} リソースIDを取得
WORKER_ID_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/workers/{id}'].id" \
  --output text)

if [ -z "$WORKER_ID_RESOURCE_ID" ]; then
  echo "❌ エラー: /workers/{id} リソースが見つかりません"
  exit 1
fi

echo "[/workers/{id}] リソースID: ${WORKER_ID_RESOURCE_ID}"
echo ""

# PUTメソッドの設定を確認
echo "=== PUTメソッドの設定 ==="
aws apigateway get-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WORKER_ID_RESOURCE_ID} \
  --http-method PUT \
  --region ${REGION} \
  --query '{authorizationType:authorizationType,apiKeyRequired:apiKeyRequired,requestParameters:requestParameters}' \
  --output json

echo ""
echo "=== PUTメソッドの統合設定 ==="
aws apigateway get-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WORKER_ID_RESOURCE_ID} \
  --http-method PUT \
  --region ${REGION} \
  --query '{type:type,integrationHttpMethod:httpMethod,uri:uri,requestTemplates:requestTemplates}' \
  --output json

echo ""
echo "=== PUTメソッドの統合レスポンス（200）==="
aws apigateway get-integration-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WORKER_ID_RESOURCE_ID} \
  --http-method PUT \
  --status-code 200 \
  --region ${REGION} \
  --query '{statusCode:statusCode,responseParameters:responseParameters,responseTemplates:responseTemplates}' \
  --output json 2>/dev/null || echo "統合レスポンス（200）が見つかりません"

echo ""
echo "=== PUTメソッドのメソッドレスポンス（200）==="
aws apigateway get-method-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WORKER_ID_RESOURCE_ID} \
  --http-method PUT \
  --status-code 200 \
  --region ${REGION} \
  --query '{statusCode:statusCode,responseParameters:responseParameters}' \
  --output json 2>/dev/null || echo "メソッドレスポンス（200）が見つかりません"

echo ""
echo "=== OPTIONSメソッドの設定 ==="
aws apigateway get-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WORKER_ID_RESOURCE_ID} \
  --http-method OPTIONS \
  --region ${REGION} \
  --query '{authorizationType:authorizationType,apiKeyRequired:apiKeyRequired}' \
  --output json 2>/dev/null || echo "OPTIONSメソッドが見つかりません"

echo ""
echo "=== OPTIONSメソッドの統合レスポンス（200）==="
aws apigateway get-integration-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WORKER_ID_RESOURCE_ID} \
  --http-method OPTIONS \
  --status-code 200 \
  --region ${REGION} \
  --query '{statusCode:statusCode,responseParameters:responseParameters}' \
  --output json 2>/dev/null || echo "OPTIONS統合レスポンス（200）が見つかりません"

