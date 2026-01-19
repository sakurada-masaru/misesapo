#!/bin/bash
# Workers API Gateway PUTメソッドのCORS設定と認証設定を修正するスクリプト

set -e

REST_API_ID="51bhoxkbxd"
REGION="ap-northeast-1"

echo "=== Workers API Gateway PUTメソッドの設定を開始 ==="

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

# PUTメソッドの認証設定を確認・修正
echo "[/workers/{id}] PUTメソッドの認証設定を確認中..."
CURRENT_AUTH=$(aws apigateway get-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WORKER_ID_RESOURCE_ID} \
  --http-method PUT \
  --region ${REGION} \
  --query "authorizationType" \
  --output text 2>/dev/null || echo "NONE")

echo "現在の認証タイプ: ${CURRENT_AUTH}"

# 認証が設定されている場合は、NONEに変更
if [ "$CURRENT_AUTH" != "NONE" ]; then
  echo "[/workers/{id}] PUTメソッドの認証をNONEに変更中..."
  aws apigateway update-method \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${WORKER_ID_RESOURCE_ID} \
    --http-method PUT \
    --patch-ops '[{"op":"replace","path":"/authorizationType","value":"NONE"}]' \
    --region ${REGION}
  echo "✅ 認証設定をNONEに変更しました"
else
  echo "✅ 認証設定は既にNONEです"
fi

# PUTメソッドのレスポンスヘッダーにCORSヘッダーを追加
echo "[/workers/{id}] PUTメソッドのCORSヘッダーを設定中..."

# 200ステータスコードのレスポンスヘッダーを設定
aws apigateway put-method-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WORKER_ID_RESOURCE_ID} \
  --http-method PUT \
  --status-code 200 \
  --response-parameters "method.response.header.Access-Control-Allow-Origin=false,method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false" \
  --region ${REGION} 2>/dev/null || echo "PUT method response (200) already exists"

# 統合レスポンスでCORSヘッダーをマッピング
aws apigateway put-integration-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WORKER_ID_RESOURCE_ID} \
  --http-method PUT \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'","method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,PUT,POST,DELETE,OPTIONS'"'"'"}' \
  --region ${REGION} 2>/dev/null || echo "PUT integration response (200) already exists"

# 400ステータスコードのレスポンスヘッダーも設定
aws apigateway put-method-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WORKER_ID_RESOURCE_ID} \
  --http-method PUT \
  --status-code 400 \
  --response-parameters "method.response.header.Access-Control-Allow-Origin=false,method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false" \
  --region ${REGION} 2>/dev/null || echo "PUT method response (400) already exists"

aws apigateway put-integration-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WORKER_ID_RESOURCE_ID} \
  --http-method PUT \
  --status-code 400 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'","method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,PUT,POST,DELETE,OPTIONS'"'"'"}' \
  --region ${REGION} 2>/dev/null || echo "PUT integration response (400) already exists"

# 404ステータスコードのレスポンスヘッダーも設定
aws apigateway put-method-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WORKER_ID_RESOURCE_ID} \
  --http-method PUT \
  --status-code 404 \
  --response-parameters "method.response.header.Access-Control-Allow-Origin=false,method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false" \
  --region ${REGION} 2>/dev/null || echo "PUT method response (404) already exists"

aws apigateway put-integration-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WORKER_ID_RESOURCE_ID} \
  --http-method PUT \
  --status-code 404 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'","method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,PUT,POST,DELETE,OPTIONS'"'"'"}' \
  --region ${REGION} 2>/dev/null || echo "PUT integration response (404) already exists"

# 500ステータスコードのレスポンスヘッダーも設定
aws apigateway put-method-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WORKER_ID_RESOURCE_ID} \
  --http-method PUT \
  --status-code 500 \
  --response-parameters "method.response.header.Access-Control-Allow-Origin=false,method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false" \
  --region ${REGION} 2>/dev/null || echo "PUT method response (500) already exists"

aws apigateway put-integration-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WORKER_ID_RESOURCE_ID} \
  --http-method PUT \
  --status-code 500 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'","method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,PUT,POST,DELETE,OPTIONS'"'"'"}' \
  --region ${REGION} 2>/dev/null || echo "PUT integration response (500) already exists"

# OPTIONSメソッドを設定（プリフライトリクエスト用）
echo "[/workers/{id}] OPTIONSメソッドを設定中..."

# OPTIONSメソッドが存在するか確認
if aws apigateway get-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WORKER_ID_RESOURCE_ID} \
  --http-method OPTIONS \
  --region ${REGION} &>/dev/null; then
  echo "[/workers/{id}] OPTIONSメソッドは既に存在します"
else
  # OPTIONSメソッドを作成
  aws apigateway put-method \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${WORKER_ID_RESOURCE_ID} \
    --http-method OPTIONS \
    --authorization-type "NONE" \
    --region ${REGION} > /dev/null
  echo "[/workers/{id}] OPTIONSメソッドを作成しました"
fi

# OPTIONSメソッドの統合を設定（MOCK統合）
aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WORKER_ID_RESOURCE_ID} \
  --http-method OPTIONS \
  --type MOCK \
  --request-templates '{"application/json":"{\"statusCode\": 200}"}' \
  --region ${REGION} > /dev/null 2>&1 || echo "OPTIONS integration already exists"

# OPTIONSメソッドのレスポンスを設定
aws apigateway put-method-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WORKER_ID_RESOURCE_ID} \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters "method.response.header.Access-Control-Allow-Origin=false,method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false" \
  --region ${REGION} 2>/dev/null || echo "OPTIONS method response already exists"

# OPTIONSメソッドの統合レスポンスを設定
aws apigateway put-integration-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WORKER_ID_RESOURCE_ID} \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'","method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,PUT,POST,DELETE,OPTIONS'"'"'"}' \
  --response-templates '{"application/json":"{\"statusCode\":200}"}' \
  --region ${REGION} 2>/dev/null || echo "OPTIONS integration response already exists"

# OPTIONSメソッドの統合レスポンスを更新（既存の場合）
aws apigateway update-integration-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WORKER_ID_RESOURCE_ID} \
  --http-method OPTIONS \
  --status-code 200 \
  --patch-ops '[{"op":"replace","path":"/responseParameters/method.response.header.Access-Control-Allow-Origin","value":"'"'"'*'"'"'"},{"op":"replace","path":"/responseParameters/method.response.header.Access-Control-Allow-Headers","value":"'"'"'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'"'"'"},{"op":"replace","path":"/responseParameters/method.response.header.Access-Control-Allow-Methods","value":"'"'"'GET,PUT,POST,DELETE,OPTIONS'"'"'"}]' \
  --region ${REGION} 2>/dev/null || echo "OPTIONS integration response update skipped"

# APIをデプロイ
echo ""
echo "APIをデプロイ中..."
DEPLOYMENT_ID=$(aws apigateway create-deployment \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --stage-name "prod" \
  --description "Workers PUT API CORS設定と認証設定の修正" \
  --query "id" \
  --output text)

echo ""
echo "=== 設定完了 ==="
echo "デプロイID: ${DEPLOYMENT_ID}"
echo "APIエンドポイント: https://${REST_API_ID}.execute-api.${REGION}.amazonaws.com/prod/workers/{id}"
echo ""
echo "✅ PUTメソッドの認証設定をNONEに変更しました"
echo "✅ PUTメソッドのCORS設定が完了しました"
echo "✅ OPTIONSメソッド（プリフライトリクエスト）が正常に処理されるようになりました"
echo ""
echo "⚠️  注意: ブラウザをリロードして再度お試しください"

