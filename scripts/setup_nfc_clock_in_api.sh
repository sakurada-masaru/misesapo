#!/bin/bash

# NFCタグ打刻API - API Gateway設定スクリプト
# このスクリプトは、NFCタグ打刻APIのAPI Gatewayエンドポイントを設定します

set -e

REGION="ap-northeast-1"
REST_API_ID="51bhoxkbxd"  # misesapo-s3-upload-api
LAMBDA_FUNCTION_NAME="misesapo-s3-upload"
ACCOUNT_ID="475462779604"

echo "=========================================="
echo "NFCタグ打刻API - API Gateway設定"
echo "=========================================="
echo ""

# Lambda関数のARNを取得
LAMBDA_ARN=$(aws lambda get-function \
  --function-name ${LAMBDA_FUNCTION_NAME} \
  --region ${REGION} \
  --query 'Configuration.FunctionArn' \
  --output text)

echo "Lambda関数ARN: ${LAMBDA_ARN}"
echo ""

# /staff リソースを取得または作成
echo "[/staff] リソースを確認中..."
STAFF_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query 'items[?path==`/staff`].id' \
  --output text)

if [ -z "$STAFF_RESOURCE_ID" ]; then
  echo "[/staff] リソースを作成中..."
  STAFF_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --parent-id $(aws apigateway get-resources --rest-api-id ${REST_API_ID} --region ${REGION} --query 'items[?path==`/`].id' --output text) \
    --path-part staff \
    --region ${REGION} \
    --query 'id' \
    --output text)
  echo "[/staff] リソースを作成しました: ${STAFF_RESOURCE_ID}"
else
  echo "[/staff] リソースは既に存在します: ${STAFF_RESOURCE_ID}"
fi
echo ""

# /staff/nfc リソースを取得または作成
echo "[/staff/nfc] リソースを確認中..."
NFC_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query 'items[?path==`/staff/nfc`].id' \
  --output text)

if [ -z "$NFC_RESOURCE_ID" ]; then
  echo "[/staff/nfc] リソースを作成中..."
  NFC_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --parent-id ${STAFF_RESOURCE_ID} \
    --path-part nfc \
    --region ${REGION} \
    --query 'id' \
    --output text)
  echo "[/staff/nfc] リソースを作成しました: ${NFC_RESOURCE_ID}"
else
  echo "[/staff/nfc] リソースは既に存在します: ${NFC_RESOURCE_ID}"
fi
echo ""

# /staff/nfc/clock-in リソースを取得または作成
echo "[/staff/nfc/clock-in] リソースを確認中..."
CLOCK_IN_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query 'items[?path==`/staff/nfc/clock-in`].id' \
  --output text)

if [ -z "$CLOCK_IN_RESOURCE_ID" ]; then
  echo "[/staff/nfc/clock-in] リソースを作成中..."
  CLOCK_IN_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --parent-id ${NFC_RESOURCE_ID} \
    --path-part clock-in \
    --region ${REGION} \
    --query 'id' \
    --output text)
  echo "[/staff/nfc/clock-in] リソースを作成しました: ${CLOCK_IN_RESOURCE_ID}"
else
  echo "[/staff/nfc/clock-in] リソースは既に存在します: ${CLOCK_IN_RESOURCE_ID}"
fi
echo ""

# GET メソッドを設定
echo "[/staff/nfc/clock-in] GETメソッドを設定中..."
aws apigateway put-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${CLOCK_IN_RESOURCE_ID} \
  --http-method GET \
  --authorization-type NONE \
  --region ${REGION} > /dev/null 2>&1 || echo "GETメソッドは既に存在します（更新します）"

aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${CLOCK_IN_RESOURCE_ID} \
  --http-method GET \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
  --region ${REGION} > /dev/null

echo "[/staff/nfc/clock-in] GETメソッドのLambda統合を設定しました"
echo ""

# POST メソッドを設定
echo "[/staff/nfc/clock-in] POSTメソッドを設定中..."
aws apigateway put-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${CLOCK_IN_RESOURCE_ID} \
  --http-method POST \
  --authorization-type NONE \
  --region ${REGION} > /dev/null 2>&1 || echo "POSTメソッドは既に存在します（更新します）"

aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${CLOCK_IN_RESOURCE_ID} \
  --http-method POST \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
  --region ${REGION} > /dev/null

echo "[/staff/nfc/clock-in] POSTメソッドのLambda統合を設定しました"
echo ""

# OPTIONS メソッドを設定（CORS用）
echo "[/staff/nfc/clock-in] OPTIONSメソッドを設定中..."
aws apigateway put-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${CLOCK_IN_RESOURCE_ID} \
  --http-method OPTIONS \
  --authorization-type NONE \
  --region ${REGION} > /dev/null 2>&1 || echo "OPTIONSメソッドは既に存在します（更新します）"

aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${CLOCK_IN_RESOURCE_ID} \
  --http-method OPTIONS \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
  --region ${REGION} > /dev/null

echo "[/staff/nfc/clock-in] OPTIONSメソッドのLambda統合を設定しました"
echo ""

# /staff/nfc/tag リソースを取得または作成
echo "[/staff/nfc/tag] リソースを確認中..."
TAG_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query 'items[?path==`/staff/nfc/tag`].id' \
  --output text)

if [ -z "$TAG_RESOURCE_ID" ]; then
  echo "[/staff/nfc/tag] リソースを作成中..."
  TAG_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --parent-id ${NFC_RESOURCE_ID} \
    --path-part tag \
    --region ${REGION} \
    --query 'id' \
    --output text)
  echo "[/staff/nfc/tag] リソースを作成しました: ${TAG_RESOURCE_ID}"
else
  echo "[/staff/nfc/tag] リソースは既に存在します: ${TAG_RESOURCE_ID}"
fi
echo ""

# GET メソッドを設定
echo "[/staff/nfc/tag] GETメソッドを設定中..."
aws apigateway put-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${TAG_RESOURCE_ID} \
  --http-method GET \
  --authorization-type NONE \
  --region ${REGION} > /dev/null 2>&1 || echo "GETメソッドは既に存在します（更新します）"

aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${TAG_RESOURCE_ID} \
  --http-method GET \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
  --region ${REGION} > /dev/null

echo "[/staff/nfc/tag] GETメソッドのLambda統合を設定しました"
echo ""

# OPTIONS メソッドを設定（CORS用）
echo "[/staff/nfc/tag] OPTIONSメソッドを設定中..."
aws apigateway put-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${TAG_RESOURCE_ID} \
  --http-method OPTIONS \
  --authorization-type NONE \
  --region ${REGION} > /dev/null 2>&1 || echo "OPTIONSメソッドは既に存在します（更新します）"

aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${TAG_RESOURCE_ID} \
  --http-method OPTIONS \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
  --region ${REGION} > /dev/null

echo "[/staff/nfc/tag] OPTIONSメソッドのLambda統合を設定しました"
echo ""

# Lambda関数にAPI Gatewayの実行権限を付与
echo "Lambda関数にAPI Gatewayの実行権限を付与中..."
for METHOD in GET POST OPTIONS; do
  METHOD_LOWER=$(echo ${METHOD} | tr '[:upper:]' '[:lower:]')
  aws lambda add-permission \
    --function-name ${LAMBDA_FUNCTION_NAME} \
    --statement-id "apigateway-${METHOD_LOWER}-nfc-clock-in-$(date +%s)-${RANDOM}" \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${REST_API_ID}/*/${METHOD}/staff/nfc/clock-in" \
    --region ${REGION} 2>/dev/null || echo "権限は既に存在するか、エラーが発生しました（続行します）"
done

# /staff/nfc/tag エンドポイントの権限を付与
for METHOD in GET OPTIONS; do
  METHOD_LOWER=$(echo ${METHOD} | tr '[:upper:]' '[:lower:]')
  aws lambda add-permission \
    --function-name ${LAMBDA_FUNCTION_NAME} \
    --statement-id "apigateway-${METHOD_LOWER}-nfc-tag-$(date +%s)-${RANDOM}" \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${REST_API_ID}/*/${METHOD}/staff/nfc/tag" \
    --region ${REGION} 2>/dev/null || echo "権限は既に存在するか、エラーが発生しました（続行します）"
done
echo ""

# API Gatewayをデプロイ
echo "API Gatewayをデプロイ中..."
DEPLOYMENT_ID=$(aws apigateway create-deployment \
  --rest-api-id ${REST_API_ID} \
  --stage-name prod \
  --region ${REGION} \
  --query "id" \
  --output text)

echo "デプロイID: ${DEPLOYMENT_ID}"
echo ""

echo "=========================================="
echo "セットアップ完了！"
echo "=========================================="
echo ""
echo "エンドポイントURL:"
echo "  GET:  https://${REST_API_ID}.execute-api.${REGION}.amazonaws.com/prod/staff/nfc/clock-in"
echo "  POST: https://${REST_API_ID}.execute-api.${REGION}.amazonaws.com/prod/staff/nfc/clock-in"
echo "  GET:  https://${REST_API_ID}.execute-api.${REGION}.amazonaws.com/prod/staff/nfc/tag"
echo ""

