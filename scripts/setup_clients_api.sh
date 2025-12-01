#!/bin/bash
# Clients API Gateway設定スクリプト

set -e

REST_API_ID="51bhoxkbxd"
REGION="ap-northeast-1"
LAMBDA_FUNCTION_NAME="misesapo-s3-upload"
LAMBDA_ARN="arn:aws:lambda:${REGION}:475462779604:function:${LAMBDA_FUNCTION_NAME}"

echo "=== Clients API Gateway設定を開始 ==="

# ルートリソースIDを取得
ROOT_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/'].id" \
  --output text)

echo "ルートリソースID: ${ROOT_RESOURCE_ID}"

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

# /clients/{id} リソースが存在するか確認
CLIENT_ID_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/clients/{id}'].id" \
  --output text)

if [ -z "$CLIENT_ID_RESOURCE_ID" ]; then
  echo "[/clients/{id}] リソースを作成中..."
  CLIENT_ID_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --region ${REGION} \
    --parent-id ${CLIENTS_RESOURCE_ID} \
    --path-part "{id}" \
    --query "id" \
    --output text)
  echo "[/clients/{id}] リソースを作成しました: ${CLIENT_ID_RESOURCE_ID}"
else
  echo "[/clients/{id}] リソースは既に存在します: ${CLIENT_ID_RESOURCE_ID}"
fi

# /clients のGETメソッドを設定
for METHOD in GET POST; do
  echo "[/clients] ${METHOD}メソッドを設定中..."
  if aws apigateway get-method \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${CLIENTS_RESOURCE_ID} \
    --http-method ${METHOD} \
    --region ${REGION} &>/dev/null; then
    echo "[/clients] ${METHOD}メソッドは既に存在します（更新します）"
  else
    aws apigateway put-method \
      --rest-api-id ${REST_API_ID} \
      --resource-id ${CLIENTS_RESOURCE_ID} \
      --http-method ${METHOD} \
      --authorization-type "NONE" \
      --region ${REGION} > /dev/null
    echo "[/clients] ${METHOD}メソッドを作成しました"
  fi

  # Lambda統合を設定
  aws apigateway put-integration \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${CLIENTS_RESOURCE_ID} \
    --http-method ${METHOD} \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
    --region ${REGION} > /dev/null

  echo "[/clients] ${METHOD}メソッドのLambda統合を設定しました"
done

# /clients/{id} のGET, PUT, DELETEメソッドを設定
for METHOD in GET PUT DELETE; do
  echo "[/clients/{id}] ${METHOD}メソッドを設定中..."
  if aws apigateway get-method \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${CLIENT_ID_RESOURCE_ID} \
    --http-method ${METHOD} \
    --region ${REGION} &>/dev/null; then
    echo "[/clients/{id}] ${METHOD}メソッドは既に存在します（更新します）"
  else
    aws apigateway put-method \
      --rest-api-id ${REST_API_ID} \
      --resource-id ${CLIENT_ID_RESOURCE_ID} \
      --http-method ${METHOD} \
      --authorization-type "NONE" \
      --region ${REGION} > /dev/null
    echo "[/clients/{id}] ${METHOD}メソッドを作成しました"
  fi

  # Lambda統合を設定
  aws apigateway put-integration \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${CLIENT_ID_RESOURCE_ID} \
    --http-method ${METHOD} \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
    --region ${REGION} > /dev/null

  echo "[/clients/{id}] ${METHOD}メソッドのLambda統合を設定しました"
done

# Lambda関数にAPI Gatewayの実行権限を付与
echo "Lambda関数にAPI Gatewayの実行権限を付与中..."
for METHOD in GET POST PUT DELETE; do
  METHOD_LOWER=$(echo ${METHOD} | tr '[:upper:]' '[:lower:]')
  aws lambda add-permission \
    --function-name ${LAMBDA_FUNCTION_NAME} \
    --statement-id "apigateway-${METHOD_LOWER}-clients-$(date +%s)-${RANDOM}" \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:475462779604:${REST_API_ID}/*/${METHOD}/clients" \
    --region ${REGION} 2>/dev/null || echo "権限は既に存在するか、エラーが発生しました（続行します）"
done

# OPTIONSメソッドを設定（CORS用）
for RESOURCE_ID in ${CLIENTS_RESOURCE_ID} ${CLIENT_ID_RESOURCE_ID}; do
  RESOURCE_PATH=$([ "$RESOURCE_ID" == "$CLIENTS_RESOURCE_ID" ] && echo "/clients" || echo "/clients/{id}")
  echo "[${RESOURCE_PATH}] OPTIONSメソッドを設定中..."
  
  if aws apigateway get-method \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${RESOURCE_ID} \
    --http-method OPTIONS \
    --region ${REGION} &>/dev/null; then
    echo "[${RESOURCE_PATH}] OPTIONSメソッドは既に存在します"
  else
    aws apigateway put-method \
      --rest-api-id ${REST_API_ID} \
      --resource-id ${RESOURCE_ID} \
      --http-method OPTIONS \
      --authorization-type "NONE" \
      --region ${REGION} > /dev/null
    
    # MOCK統合を設定
    aws apigateway put-integration \
      --rest-api-id ${REST_API_ID} \
      --resource-id ${RESOURCE_ID} \
      --http-method OPTIONS \
      --type MOCK \
      --request-templates '{"application/json":"{\"statusCode\":200}"}' \
      --region ${REGION} > /dev/null
    
    # OPTIONSメソッドのレスポンスを設定
    aws apigateway put-method-response \
      --rest-api-id ${REST_API_ID} \
      --resource-id ${RESOURCE_ID} \
      --http-method OPTIONS \
      --status-code 200 \
      --response-parameters "method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false,method.response.header.Access-Control-Allow-Origin=false" \
      --region ${REGION} > /dev/null
    
    aws apigateway put-integration-response \
      --rest-api-id ${REST_API_ID} \
      --resource-id ${RESOURCE_ID} \
      --http-method OPTIONS \
      --status-code 200 \
      --response-parameters "{\"method.response.header.Access-Control-Allow-Headers\":\"'Content-Type,Authorization'\",\"method.response.header.Access-Control-Allow-Methods\":\"'GET,POST,PUT,DELETE,OPTIONS'\",\"method.response.header.Access-Control-Allow-Origin\":\"'*'\"}" \
      --region ${REGION} > /dev/null
    
    echo "[${RESOURCE_PATH}] OPTIONSメソッドを設定しました"
  fi
done

# APIをデプロイ
echo ""
echo "APIをデプロイ中..."
DEPLOYMENT_ID=$(aws apigateway create-deployment \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --stage-name "prod" \
  --description "Clients API設定" \
  --query "id" \
  --output text)

echo ""
echo "=== 設定完了 ==="
echo "デプロイID: ${DEPLOYMENT_ID}"
echo "✅ Clients APIの設定が完了しました。"

