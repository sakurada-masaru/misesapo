#!/bin/bash
# Kartes API Gateway設定スクリプト

set -e

REST_API_ID="51bhoxkbxd"
REGION="ap-northeast-1"
LAMBDA_FUNCTION_NAME="misesapo-kartes-api"
LAMBDA_ARN="arn:aws:lambda:${REGION}:475462779604:function:${LAMBDA_FUNCTION_NAME}"

echo "=== Kartes API Gateway設定を開始 ==="

ROOT_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/'].id" \
  --output text)

echo "ルートリソースID: ${ROOT_RESOURCE_ID}"

# /kartes リソース
KARTES_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/kartes'].id" \
  --output text)

if [ -z "$KARTES_RESOURCE_ID" ]; then
  echo "[/kartes] リソースを作成中..."
  KARTES_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --region ${REGION} \
    --parent-id ${ROOT_RESOURCE_ID} \
    --path-part "kartes" \
    --query "id" \
    --output text)
  echo "[/kartes] リソースを作成しました: ${KARTES_RESOURCE_ID}"
else
  echo "[/kartes] リソースは既に存在します: ${KARTES_RESOURCE_ID}"
fi

# /kartes/{id} リソース
KARTE_ID_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/kartes/{id}'].id" \
  --output text)

if [ -z "$KARTE_ID_RESOURCE_ID" ]; then
  echo "[/kartes/{id}] リソースを作成中..."
  KARTE_ID_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --region ${REGION} \
    --parent-id ${KARTES_RESOURCE_ID} \
    --path-part "{id}" \
    --query "id" \
    --output text)
  echo "[/kartes/{id}] リソースを作成しました: ${KARTE_ID_RESOURCE_ID}"
else
  echo "[/kartes/{id}] リソースは既に存在します: ${KARTE_ID_RESOURCE_ID}"
fi

# /kartes のGET/POST
for METHOD in GET POST; do
  echo "[/kartes] ${METHOD}メソッドを設定中..."
  if aws apigateway get-method \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${KARTES_RESOURCE_ID} \
    --http-method ${METHOD} \
    --region ${REGION} &>/dev/null; then
    echo "[/kartes] ${METHOD}メソッドは既に存在します（更新します）"
  else
    aws apigateway put-method \
      --rest-api-id ${REST_API_ID} \
      --resource-id ${KARTES_RESOURCE_ID} \
      --http-method ${METHOD} \
      --authorization-type "NONE" \
      --region ${REGION} > /dev/null
  fi

  aws apigateway put-integration \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${KARTES_RESOURCE_ID} \
    --http-method ${METHOD} \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
    --region ${REGION} > /dev/null
done

# /kartes/{id} のGET/PUT/DELETE
for METHOD in GET PUT DELETE; do
  echo "[/kartes/{id}] ${METHOD}メソッドを設定中..."
  if aws apigateway get-method \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${KARTE_ID_RESOURCE_ID} \
    --http-method ${METHOD} \
    --region ${REGION} &>/dev/null; then
    echo "[/kartes/{id}] ${METHOD}メソッドは既に存在します（更新します）"
  else
    aws apigateway put-method \
      --rest-api-id ${REST_API_ID} \
      --resource-id ${KARTE_ID_RESOURCE_ID} \
      --http-method ${METHOD} \
      --authorization-type "NONE" \
      --region ${REGION} > /dev/null
  fi

  aws apigateway put-integration \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${KARTE_ID_RESOURCE_ID} \
    --http-method ${METHOD} \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
    --region ${REGION} > /dev/null
done

# Lambda権限
echo "Lambda関数にAPI Gatewayの実行権限を付与中..."
for METHOD in GET POST PUT DELETE; do
  METHOD_LOWER=$(echo ${METHOD} | tr '[:upper:]' '[:lower:]')
  aws lambda add-permission \
    --function-name ${LAMBDA_FUNCTION_NAME} \
    --statement-id "apigateway-${METHOD_LOWER}-kartes-$(date +%s)-${RANDOM}" \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:475462779604:${REST_API_ID}/*/${METHOD}/kartes*" \
    --region ${REGION} 2>/dev/null || echo "権限は既に存在するか、エラーが発生しました（続行します）"
done

# OPTIONSメソッド（CORS）
for RESOURCE_ID in ${KARTES_RESOURCE_ID} ${KARTE_ID_RESOURCE_ID}; do
  RESOURCE_PATH=$([ "$RESOURCE_ID" == "$KARTES_RESOURCE_ID" ] && echo "/kartes" || echo "/kartes/{id}")
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

    aws apigateway put-integration \
      --rest-api-id ${REST_API_ID} \
      --resource-id ${RESOURCE_ID} \
      --http-method OPTIONS \
      --type MOCK \
      --request-templates '{"application/json":"{\"statusCode\":200}"}' \
      --region ${REGION} > /dev/null

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

echo "APIをデプロイ中..."
aws apigateway create-deployment \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --stage-name "prod" \
  --description "Kartes API設定" \
  --query "id" \
  --output text
