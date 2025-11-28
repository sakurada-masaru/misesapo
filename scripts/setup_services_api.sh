#!/bin/bash
# サービス管理API Gateway設定スクリプト

set -e

REST_API_ID="51bhoxkbxd"
REGION="ap-northeast-1"
LAMBDA_FUNCTION_NAME="misesapo-s3-upload"
LAMBDA_ARN="arn:aws:lambda:${REGION}:475462779604:function:${LAMBDA_FUNCTION_NAME}"

echo "=== サービス管理API Gateway設定を開始 ==="

# ルートリソースIDを取得
ROOT_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/'].id" \
  --output text)

echo "ルートリソースID: ${ROOT_RESOURCE_ID}"

# /services リソースが存在するか確認
SERVICES_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/services'].id" \
  --output text)

if [ -z "$SERVICES_RESOURCE_ID" ]; then
  echo "[/services] リソースを作成中..."
  SERVICES_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --region ${REGION} \
    --parent-id ${ROOT_RESOURCE_ID} \
    --path-part "services" \
    --query "id" \
    --output text)
  echo "[/services] リソースを作成しました: ${SERVICES_RESOURCE_ID}"
else
  echo "[/services] リソースは既に存在します: ${SERVICES_RESOURCE_ID}"
fi

# /services/{service_id} リソースが存在するか確認
SERVICE_ID_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/services/{service_id}'].id" \
  --output text)

if [ -z "$SERVICE_ID_RESOURCE_ID" ]; then
  echo "[/services/{service_id}] リソースを作成中..."
  SERVICE_ID_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --region ${REGION} \
    --parent-id ${SERVICES_RESOURCE_ID} \
    --path-part "{service_id}" \
    --query "id" \
    --output text)
  echo "[/services/{service_id}] リソースを作成しました: ${SERVICE_ID_RESOURCE_ID}"
else
  echo "[/services/{service_id}] リソースは既に存在します: ${SERVICE_ID_RESOURCE_ID}"
fi

# Lambda関数の権限を付与
echo "Lambda関数の権限を確認中..."
aws lambda add-permission \
  --function-name ${LAMBDA_FUNCTION_NAME} \
  --statement-id "apigateway-services-$(date +%s)" \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:475462779604:${REST_API_ID}/*/*" \
  --region ${REGION} 2>/dev/null || echo "権限は既に存在するか、エラーが発生しました（続行します）"

# /services リソースにメソッドを設定
setup_method() {
  local resource_id=$1
  local method=$2
  local path=$3
  
  echo "[${path}] ${method} メソッドを設定中..."
  
  # メソッドが既に存在するか確認
  if aws apigateway get-method \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${resource_id} \
    --http-method ${method} \
    --region ${REGION} &>/dev/null; then
    echo "[${path}] ${method} メソッドは既に存在します"
    return
  fi
  
  # メソッドを作成
  aws apigateway put-method \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${resource_id} \
    --http-method ${method} \
    --authorization-type "NONE" \
    --region ${REGION} > /dev/null
  
  # Lambda統合を設定
  aws apigateway put-integration \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${resource_id} \
    --http-method ${method} \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
    --region ${REGION} > /dev/null
  
  echo "[${path}] ${method} メソッドを設定しました"
}

# /services リソースにメソッドを設定
setup_method ${SERVICES_RESOURCE_ID} "GET" "/services"
setup_method ${SERVICES_RESOURCE_ID} "POST" "/services"
setup_method ${SERVICES_RESOURCE_ID} "OPTIONS" "/services"

# /services/{service_id} リソースにメソッドを設定
setup_method ${SERVICE_ID_RESOURCE_ID} "GET" "/services/{service_id}"
setup_method ${SERVICE_ID_RESOURCE_ID} "PUT" "/services/{service_id}"
setup_method ${SERVICE_ID_RESOURCE_ID} "DELETE" "/services/{service_id}"
setup_method ${SERVICE_ID_RESOURCE_ID} "OPTIONS" "/services/{service_id}"

# CORSを有効化
echo "CORSを設定中..."
aws apigateway put-method-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${SERVICES_RESOURCE_ID} \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters "method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false,method.response.header.Access-Control-Allow-Origin=false" \
  --region ${REGION} > /dev/null 2>&1 || true

aws apigateway put-integration-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${SERVICES_RESOURCE_ID} \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,POST,OPTIONS'"'"'","method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'"}' \
  --region ${REGION} > /dev/null 2>&1 || true

aws apigateway put-method-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${SERVICE_ID_RESOURCE_ID} \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters "method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false,method.response.header.Access-Control-Allow-Origin=false" \
  --region ${REGION} > /dev/null 2>&1 || true

aws apigateway put-integration-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${SERVICE_ID_RESOURCE_ID} \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,PUT,DELETE,OPTIONS'"'"'","method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'"}' \
  --region ${REGION} > /dev/null 2>&1 || true

# APIをデプロイ
echo "APIをデプロイ中..."
DEPLOYMENT_ID=$(aws apigateway create-deployment \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --stage-name "prod" \
  --description "サービス管理API設定" \
  --query "id" \
  --output text)

echo "=== 設定完了 ==="
echo "デプロイID: ${DEPLOYMENT_ID}"
echo "APIエンドポイント: https://${REST_API_ID}.execute-api.${REGION}.amazonaws.com/prod/services"

