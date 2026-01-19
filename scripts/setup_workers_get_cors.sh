#!/bin/bash
# Workers API Gateway GETメソッドのCORS設定スクリプト

set -e

REST_API_ID="51bhoxkbxd"
REGION="ap-northeast-1"

echo "=== Workers API Gateway GETメソッドのCORS設定を開始 ==="

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

# GETメソッドのレスポンスヘッダーにCORSヘッダーを追加
echo "[/workers/{id}] GETメソッドのCORSヘッダーを設定中..."

# 200ステータスコードのレスポンスヘッダーを設定
aws apigateway put-method-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WORKER_ID_RESOURCE_ID} \
  --http-method GET \
  --status-code 200 \
  --response-parameters "method.response.header.Access-Control-Allow-Origin=false,method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false" \
  --region ${REGION} 2>/dev/null || echo "GET method response already exists"

# 統合レスポンスでCORSヘッダーをマッピング
aws apigateway put-integration-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WORKER_ID_RESOURCE_ID} \
  --http-method GET \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'","method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,Authorization'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,PUT,POST,DELETE,OPTIONS'"'"'"}' \
  --region ${REGION} 2>/dev/null || echo "GET integration response already exists"

# 404ステータスコードのレスポンスヘッダーも設定
aws apigateway put-method-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WORKER_ID_RESOURCE_ID} \
  --http-method GET \
  --status-code 404 \
  --response-parameters "method.response.header.Access-Control-Allow-Origin=false,method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false" \
  --region ${REGION} 2>/dev/null || echo "GET 404 method response already exists"

aws apigateway put-integration-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WORKER_ID_RESOURCE_ID} \
  --http-method GET \
  --status-code 404 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'","method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,Authorization'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,PUT,POST,DELETE,OPTIONS'"'"'"}' \
  --region ${REGION} 2>/dev/null || echo "GET 404 integration response already exists"

# 500ステータスコードのレスポンスヘッダーも設定
aws apigateway put-method-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WORKER_ID_RESOURCE_ID} \
  --http-method GET \
  --status-code 500 \
  --response-parameters "method.response.header.Access-Control-Allow-Origin=false,method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false" \
  --region ${REGION} 2>/dev/null || echo "GET 500 method response already exists"

aws apigateway put-integration-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WORKER_ID_RESOURCE_ID} \
  --http-method GET \
  --status-code 500 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'","method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,Authorization'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,PUT,POST,DELETE,OPTIONS'"'"'"}' \
  --region ${REGION} 2>/dev/null || echo "GET 500 integration response already exists"

# APIをデプロイ
echo ""
echo "APIをデプロイ中..."
DEPLOYMENT_ID=$(aws apigateway create-deployment \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --stage-name "prod" \
  --description "Workers API GET method CORS設定" \
  --query "id" \
  --output text)

echo ""
echo "=== 設定完了 ==="
echo "デプロイID: ${DEPLOYMENT_ID}"
echo "✅ GETメソッドのCORS設定が完了しました。"

