#!/bin/bash
# Staff Reports API Gateway CORS設定スクリプト
# /staff/reports エンドポイントのCORS設定（OPTIONSメソッド）を追加・更新

set -e

REST_API_ID="51bhoxkbxd"
REGION="ap-northeast-1"

echo "=== Staff Reports API Gateway CORS設定を開始 ==="

# /staff リソースIDを取得
STAFF_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/staff'].id" \
  --output text)

echo "/staff Resource ID: ${STAFF_RESOURCE_ID}"

if [ -z "$STAFF_RESOURCE_ID" ] || [ "$STAFF_RESOURCE_ID" == "None" ]; then
    echo "Error: /staff resource not found. Please ensure the API matches the ID."
    exit 1
fi

# /staff/reports リソースIDを取得
REPORTS_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/staff/reports'].id" \
  --output text)

echo "/staff/reports Resource ID: ${REPORTS_RESOURCE_ID}"

if [ -z "$REPORTS_RESOURCE_ID" ] || [ "$REPORTS_RESOURCE_ID" == "None" ]; then
    echo "/staff/reports resource not found. Creating..."
    REPORTS_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --region ${REGION} \
    --parent-id ${STAFF_RESOURCE_ID} \
    --path-part "reports" \
    --query "id" \
    --output text)
    echo "Created /staff/reports Resource ID: ${REPORTS_RESOURCE_ID}"
fi

# OPTIONSメソッドを設定する関数
setup_options_method() {
  local resource_id=$1
  local path=$2
  local allowed_methods=$3
  
  echo "[${path}] OPTIONS メソッドを設定中..."
  
  # OPTIONSメソッドが既に存在するか確認（存在しても上書き設定するためにput-methodを実行）
  aws apigateway put-method \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${resource_id} \
    --http-method OPTIONS \
    --authorization-type "NONE" \
    --region ${REGION} > /dev/null
    
  echo "[${path}] OPTIONS メソッドを設定しました"
  
  # MOCK統合を設定
  aws apigateway put-integration \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${resource_id} \
    --http-method OPTIONS \
    --type MOCK \
    --request-templates '{"application/json":"{\"statusCode\":200}"}' \
    --region ${REGION} > /dev/null
  
  # OPTIONSメソッドのレスポンスを設定
  aws apigateway put-method-response \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${resource_id} \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters "method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false,method.response.header.Access-Control-Allow-Origin=false" \
    --region ${REGION} > /dev/null 2>&1 || true
  
  # 統合レスポンスを設定（ここでCORSヘッダーを返す）
  # Originを '*' に設定して全オリジンを許可（Lambda側でもチェックしているので安全）
  # または特定ドメインのみにするなら 'https://misesapo.co.jp'
  aws apigateway put-integration-response \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${resource_id} \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters "{\"method.response.header.Access-Control-Allow-Headers\":\"'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'\",\"method.response.header.Access-Control-Allow-Methods\":\"'${allowed_methods}'\",\"method.response.header.Access-Control-Allow-Origin\":\"'*'\"}" \
    --region ${REGION} > /dev/null
  
  echo "[${path}] OPTIONS メソッドのCORS設定完了"
}

# /staff/reports の設定
setup_options_method ${REPORTS_RESOURCE_ID} "/staff/reports" "GET,POST,OPTIONS"

# APIをデプロイ
echo ""
echo "APIをデプロイ中..."
DEPLOYMENT_ID=$(aws apigateway create-deployment \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --stage-name "prod" \
  --description "Staff Reports API CORS Update" \
  --query "id" \
  --output text)

echo ""
echo "=== 設定完了 ==="
echo "デプロイID: ${DEPLOYMENT_ID}"
echo "APIエンドポイント: https://${REST_API_ID}.execute-api.${REGION}.amazonaws.com/prod/staff/reports"
echo "✅ CORS設定が完了しました。https://misesapo.co.jp からのアクセスが可能になるはずです。"
