#!/bin/bash
# Workers API Gateway CORS設定スクリプト
# DELETEメソッドのCORS設定を追加

set -e

REST_API_ID="51bhoxkbxd"
REGION="ap-northeast-1"

echo "=== Workers API Gateway CORS設定を開始 ==="

# ルートリソースIDを取得
ROOT_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/'].id" \
  --output text)

echo "ルートリソースID: ${ROOT_RESOURCE_ID}"

# /workers リソースが存在するか確認
WORKERS_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/workers'].id" \
  --output text)

if [ -z "$WORKERS_RESOURCE_ID" ]; then
  echo "[/workers] リソースを作成中..."
  WORKERS_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --region ${REGION} \
    --parent-id ${ROOT_RESOURCE_ID} \
    --path-part "workers" \
    --query "id" \
    --output text)
  echo "[/workers] リソースを作成しました: ${WORKERS_RESOURCE_ID}"
else
  echo "[/workers] リソースは既に存在します: ${WORKERS_RESOURCE_ID}"
fi

# /workers/{id} リソースが存在するか確認
WORKER_ID_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/workers/{id}'].id" \
  --output text)

if [ -z "$WORKER_ID_RESOURCE_ID" ]; then
  echo "[/workers/{id}] リソースを作成中..."
  WORKER_ID_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --region ${REGION} \
    --parent-id ${WORKERS_RESOURCE_ID} \
    --path-part "{id}" \
    --query "id" \
    --output text)
  echo "[/workers/{id}] リソースを作成しました: ${WORKER_ID_RESOURCE_ID}"
else
  echo "[/workers/{id}] リソースは既に存在します: ${WORKER_ID_RESOURCE_ID}"
fi

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
  
  aws apigateway put-integration-response \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${resource_id} \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters "{\"method.response.header.Access-Control-Allow-Headers\":\"'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'\",\"method.response.header.Access-Control-Allow-Methods\":\"'${allowed_methods}'\",\"method.response.header.Access-Control-Allow-Origin\":\"'*'\"}" \
    --region ${REGION} > /dev/null 2>&1 || true
  
  echo "[${path}] OPTIONS メソッドのCORS設定を完了しました"
}

# DELETEメソッドを設定する関数
setup_delete_method() {
  local resource_id=$1
  local path=$2
  
  echo "[${path}] DELETE メソッドを設定中..."
  
  # DELETEメソッドが既に存在するか確認
  if aws apigateway get-method \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${resource_id} \
    --http-method DELETE \
    --region ${REGION} &>/dev/null; then
    echo "[${path}] DELETE メソッドは既に存在します"
  else
    # DELETEメソッドを作成
    aws apigateway put-method \
      --rest-api-id ${REST_API_ID} \
      --resource-id ${resource_id} \
      --http-method DELETE \
      --authorization-type "NONE" \
      --region ${REGION} > /dev/null
    echo "[${path}] DELETE メソッドを作成しました"
    
    # Lambda統合を設定（既存のLambda関数を使用）
    LAMBDA_FUNCTION_NAME="misesapo-s3-upload"
    LAMBDA_ARN="arn:aws:lambda:${REGION}:475462779604:function:${LAMBDA_FUNCTION_NAME}"
    
    aws apigateway put-integration \
      --rest-api-id ${REST_API_ID} \
      --resource-id ${resource_id} \
      --http-method DELETE \
      --type AWS_PROXY \
      --integration-http-method POST \
      --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
      --region ${REGION} > /dev/null
    echo "[${path}] DELETE メソッドのLambda統合を設定しました"
  fi
  
  # DELETEメソッドのレスポンスにCORSヘッダーを追加
  aws apigateway put-method-response \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${resource_id} \
    --http-method DELETE \
    --status-code 200 \
    --response-parameters "method.response.header.Access-Control-Allow-Origin=false" \
    --region ${REGION} > /dev/null 2>&1 || true
  
  echo "[${path}] DELETE メソッドのCORSヘッダーを設定しました"
}

# /workers リソースのOPTIONSメソッドを設定
setup_options_method ${WORKERS_RESOURCE_ID} "/workers" "GET,POST,OPTIONS"

# /workers/{id} リソースのOPTIONSメソッドを設定
setup_options_method ${WORKER_ID_RESOURCE_ID} "/workers/{id}" "GET,PUT,DELETE,OPTIONS"

# /workers/{id} リソースのDELETEメソッドを設定
setup_delete_method ${WORKER_ID_RESOURCE_ID} "/workers/{id}"

# APIをデプロイ
echo ""
echo "APIをデプロイ中..."
DEPLOYMENT_ID=$(aws apigateway create-deployment \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --stage-name "prod" \
  --description "Workers API CORS設定" \
  --query "id" \
  --output text)

echo ""
echo "=== 設定完了 ==="
echo "デプロイID: ${DEPLOYMENT_ID}"
echo "APIエンドポイント: https://${REST_API_ID}.execute-api.${REGION}.amazonaws.com/prod/workers"
echo ""
echo "✅ CORS設定が完了しました。"
echo "✅ DELETEメソッドのプリフライトリクエスト（OPTIONS）が正常に処理されるようになりました。"

