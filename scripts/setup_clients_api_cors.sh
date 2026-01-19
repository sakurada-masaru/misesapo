#!/bin/bash
# Clients, Stores, Brands API Gateway CORS設定スクリプト
# Authorizationヘッダーを許可するようにCORS設定を修正

set -e

REST_API_ID="51bhoxkbxd"
REGION="ap-northeast-1"

echo "=== Clients/Stores/Brands API Gateway CORS設定を開始 ==="

# ルートリソースIDを取得
ROOT_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/'].id" \
  --output text)

echo "ルートリソースID: ${ROOT_RESOURCE_ID}"

# OPTIONSメソッドを設定する関数
setup_options_method() {
  local resource_id=$1
  local path=$2
  local allowed_methods=$3
  
  echo "[${path}] OPTIONS メソッドを設定中..."
  
  # OPTIONSメソッドが既に存在するか確認
  if aws apigateway get-method \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${resource_id} \
    --http-method OPTIONS \
    --region ${REGION} &>/dev/null; then
    echo "[${path}] OPTIONS メソッドは既に存在します（更新します）"
  else
    # OPTIONSメソッドを作成
    aws apigateway put-method \
      --rest-api-id ${REST_API_ID} \
      --resource-id ${resource_id} \
      --http-method OPTIONS \
      --authorization-type "NONE" \
      --region ${REGION} > /dev/null
    echo "[${path}] OPTIONS メソッドを作成しました"
  fi
  
  # MOCK統合を設定
  aws apigateway put-integration \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${resource_id} \
    --http-method OPTIONS \
    --type MOCK \
    --request-templates '{"application/json":"{\"statusCode\":200}"}' \
    --region ${REGION} > /dev/null 2>&1 || true
  
  # OPTIONSメソッドのレスポンスを設定
  aws apigateway put-method-response \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${resource_id} \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters "method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false,method.response.header.Access-Control-Allow-Origin=false" \
    --region ${REGION} > /dev/null 2>&1 || true
  
  # 統合レスポンスでCORSヘッダーを設定（Authorizationヘッダーを含む）
  aws apigateway put-integration-response \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${resource_id} \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters "{\"method.response.header.Access-Control-Allow-Headers\":\"'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'\",\"method.response.header.Access-Control-Allow-Methods\":\"'${allowed_methods}'\",\"method.response.header.Access-Control-Allow-Origin\":\"'*'\"}" \
    --region ${REGION} > /dev/null 2>&1 || true
  
  echo "[${path}] OPTIONS メソッドのCORS設定を完了しました（Authorizationヘッダーを許可）"
}

# /clients リソースが存在するか確認
CLIENTS_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/clients'].id" \
  --output text)

if [ -z "$CLIENTS_RESOURCE_ID" ]; then
  echo "[/clients] リソースを作成中..."
  CLIENTS_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --region ${REGION} \
    --parent-id ${ROOT_RESOURCE_ID} \
    --path-part "clients" \
    --query "id" \
    --output text)
  echo "[/clients] リソースを作成しました: ${CLIENTS_RESOURCE_ID}"
else
  echo "[/clients] リソースは既に存在します: ${CLIENTS_RESOURCE_ID}"
fi

# /stores リソースが存在するか確認
STORES_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/stores'].id" \
  --output text)

if [ -z "$STORES_RESOURCE_ID" ]; then
  echo "[/stores] リソースを作成中..."
  STORES_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --region ${REGION} \
    --parent-id ${ROOT_RESOURCE_ID} \
    --path-part "stores" \
    --query "id" \
    --output text)
  echo "[/stores] リソースを作成しました: ${STORES_RESOURCE_ID}"
else
  echo "[/stores] リソースは既に存在します: ${STORES_RESOURCE_ID}"
fi

# /brands リソースが存在するか確認
BRANDS_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/brands'].id" \
  --output text)

if [ -z "$BRANDS_RESOURCE_ID" ]; then
  echo "[/brands] リソースを作成中..."
  BRANDS_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --region ${REGION} \
    --parent-id ${ROOT_RESOURCE_ID} \
    --path-part "brands" \
    --query "id" \
    --output text)
  echo "[/brands] リソースを作成しました: ${BRANDS_RESOURCE_ID}"
else
  echo "[/brands] リソースは既に存在します: ${BRANDS_RESOURCE_ID}"
fi

# /clients リソースのOPTIONSメソッドを設定
setup_options_method ${CLIENTS_RESOURCE_ID} "/clients" "GET,POST,PUT,DELETE,OPTIONS"

# /stores リソースのOPTIONSメソッドを設定
setup_options_method ${STORES_RESOURCE_ID} "/stores" "GET,POST,PUT,DELETE,OPTIONS"

# /brands リソースのOPTIONSメソッドを設定
setup_options_method ${BRANDS_RESOURCE_ID} "/brands" "GET,POST,PUT,DELETE,OPTIONS"

# APIをデプロイ
echo ""
echo "APIをデプロイ中..."
DEPLOYMENT_ID=$(aws apigateway create-deployment \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --stage-name "prod" \
  --description "Clients/Stores/Brands API CORS設定（Authorizationヘッダー許可）" \
  --query "id" \
  --output text)

echo ""
echo "=== 設定完了 ==="
echo "デプロイID: ${DEPLOYMENT_ID}"
echo "APIエンドポイント:"
echo "  - https://${REST_API_ID}.execute-api.${REGION}.amazonaws.com/prod/clients"
echo "  - https://${REST_API_ID}.execute-api.${REGION}.amazonaws.com/prod/stores"
echo "  - https://${REST_API_ID}.execute-api.${REGION}.amazonaws.com/prod/brands"
echo ""
echo "✅ CORS設定が完了しました。"
echo "✅ Authorizationヘッダーが許可されました。"
echo "✅ プリフライトリクエスト（OPTIONS）が正常に処理されるようになりました。"

