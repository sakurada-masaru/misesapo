#!/bin/bash
# TODO API Gateway設定スクリプト

set -e

REST_API_ID="51bhoxkbxd"
REGION="ap-northeast-1"
LAMBDA_FUNCTION_NAME="misesapo-s3-upload"
LAMBDA_ARN="arn:aws:lambda:${REGION}:475462779604:function:${LAMBDA_FUNCTION_NAME}"

echo "=== TODO API Gateway設定を開始 ==="

# ルートリソースIDを取得
ROOT_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/'].id" \
  --output text)

echo "ルートリソースID: ${ROOT_RESOURCE_ID}"

# /todos リソースが存在するか確認
TODOS_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/todos'].id" \
  --output text)

if [ -z "$TODOS_RESOURCE_ID" ] || [ "$TODOS_RESOURCE_ID" == "None" ]; then
  echo "[/todos] リソースを作成中..."
  TODOS_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --region ${REGION} \
    --parent-id ${ROOT_RESOURCE_ID} \
    --path-part "todos" \
    --query "id" \
    --output text)
  echo "[/todos] リソースを作成しました: ${TODOS_RESOURCE_ID}"
else
  echo "[/todos] リソースは既に存在します: ${TODOS_RESOURCE_ID}"
fi

# /todos/{id} リソースが存在するか確認
TODO_ID_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/todos/{id}'].id" \
  --output text)

if [ -z "$TODO_ID_RESOURCE_ID" ] || [ "$TODO_ID_RESOURCE_ID" == "None" ]; then
  echo "[/todos/{id}] リソースを作成中..."
  TODO_ID_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --region ${REGION} \
    --parent-id ${TODOS_RESOURCE_ID} \
    --path-part "{id}" \
    --query "id" \
    --output text)
  echo "[/todos/{id}] リソースを作成しました: ${TODO_ID_RESOURCE_ID}"
else
  echo "[/todos/{id}] リソースは既に存在します: ${TODO_ID_RESOURCE_ID}"
fi

# メソッドの設定関数
setup_method() {
  local RES_ID=$1
  local METHOD=$2
  echo "Setting up ${METHOD} on resource ${RES_ID}..."
  
  aws apigateway put-method \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${RES_ID} \
    --http-method ${METHOD} \
    --authorization-type NONE \
    --region ${REGION} &>/dev/null || echo "${METHOD} method already exists"

  aws apigateway put-integration \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${RES_ID} \
    --http-method ${METHOD} \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
    --region ${REGION} &>/dev/null || echo "${METHOD} integration already exists"
}

# CORS(OPTIONS)の設定関数
setup_cors() {
  local RES_ID=$1
  echo "Setting up OPTIONS (CORS) on resource ${RES_ID}..."
  
  aws apigateway put-method \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${RES_ID} \
    --http-method OPTIONS \
    --authorization-type NONE \
    --region ${REGION} &>/dev/null || echo "OPTIONS method already exists"

  aws apigateway put-integration \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${RES_ID} \
    --http-method OPTIONS \
    --type MOCK \
    --request-templates '{"application/json":"{\"statusCode\": 200}"}' \
    --region ${REGION} &>/dev/null || echo "OPTIONS integration already exists"

  aws apigateway put-method-response \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${RES_ID} \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters "method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false,method.response.header.Access-Control-Allow-Origin=false" \
    --region ${REGION} &>/dev/null || echo "OPTIONS method response already exists"

  aws apigateway put-integration-response \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${RES_ID} \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,PUT,POST,DELETE,OPTIONS'"'"'","method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'"}' \
    --response-templates '{"application/json":"{\"statusCode\":200}"}' \
    --region ${REGION} &>/dev/null || echo "OPTIONS integration response already exists"
}

# /todos のメソッド作成
setup_method ${TODOS_RESOURCE_ID} "GET"
setup_method ${TODOS_RESOURCE_ID} "POST"
setup_cors ${TODOS_RESOURCE_ID}

# /todos/{id} のメソッド作成
setup_method ${TODO_ID_RESOURCE_ID} "GET"
setup_method ${TODO_ID_RESOURCE_ID} "PUT"
setup_method ${TODO_ID_RESOURCE_ID} "DELETE"
setup_cors ${TODO_ID_RESOURCE_ID}

# Lambda権限の付与
echo "Lambda関数にAPI Gatewayからの呼び出し権限を付与中..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# メソッドごとに権限付与
for METHOD in GET POST; do
  METHOD_LOWER=$(echo ${METHOD} | tr '[:upper:]' '[:lower:]')
  aws lambda add-permission \
    --function-name ${LAMBDA_FUNCTION_NAME} \
    --statement-id "apigateway-todos-${METHOD_LOWER}-$(date +%s)-${RANDOM}" \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${REST_API_ID}/*/${METHOD}/todos" \
    --region ${REGION} &>/dev/null || echo "/todos ${METHOD} permission already exists"
done

for METHOD in GET PUT DELETE; do
  METHOD_LOWER=$(echo ${METHOD} | tr '[:upper:]' '[:lower:]')
  aws lambda add-permission \
    --function-name ${LAMBDA_FUNCTION_NAME} \
    --statement-id "apigateway-todos-id-${METHOD_LOWER}-$(date +%s)-${RANDOM}" \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${REST_API_ID}/*/${METHOD}/todos/*" \
    --region ${REGION} &>/dev/null || echo "/todos/{id} ${METHOD} permission already exists"
done


# API Gatewayをデプロイ
echo "API Gatewayをデプロイ中..."
aws apigateway create-deployment \
  --rest-api-id ${REST_API_ID} \
  --stage-name prod \
  --region ${REGION} &>/dev/null || echo "デプロイに失敗したか既に実行済みです"

echo ""
echo "=== TODO API Gateway設定完了 ==="
