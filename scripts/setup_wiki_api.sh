#!/bin/bash
# Wiki API Gateway設定スクリプト

set -e

REST_API_ID="51bhoxkbxd"
REGION="ap-northeast-1"
LAMBDA_FUNCTION_NAME="misesapo-s3-upload"
LAMBDA_ARN="arn:aws:lambda:${REGION}:475462779604:function:${LAMBDA_FUNCTION_NAME}"

echo "=== Wiki API Gateway設定を開始 ==="

# ルートリソースIDを取得
ROOT_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/'].id" \
  --output text)

echo "ルートリソースID: ${ROOT_RESOURCE_ID}"

# /wiki リソースが存在するか確認
WIKI_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/wiki'].id" \
  --output text)

if [ -z "$WIKI_RESOURCE_ID" ]; then
  echo "[/wiki] リソースを作成中..."
  WIKI_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --region ${REGION} \
    --parent-id ${ROOT_RESOURCE_ID} \
    --path-part "wiki" \
    --query "id" \
    --output text)
  echo "[/wiki] リソースを作成しました: ${WIKI_RESOURCE_ID}"
else
  echo "[/wiki] リソースは既に存在します: ${WIKI_RESOURCE_ID}"
fi

# /wiki のGET, POST, PUTメソッドを設定
for METHOD in GET POST PUT; do
  echo "[/wiki] ${METHOD}メソッドを設定中..."
  if aws apigateway get-method \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${WIKI_RESOURCE_ID} \
    --http-method ${METHOD} \
    --region ${REGION} &>/dev/null; then
    echo "[/wiki] ${METHOD}メソッドは既に存在します（更新します）"
  else
    aws apigateway put-method \
      --rest-api-id ${REST_API_ID} \
      --resource-id ${WIKI_RESOURCE_ID} \
      --http-method ${METHOD} \
      --authorization-type "NONE" \
      --region ${REGION} > /dev/null
    echo "[/wiki] ${METHOD}メソッドを作成しました"
  fi

  # Lambda統合を設定
  aws apigateway put-integration \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${WIKI_RESOURCE_ID} \
    --http-method ${METHOD} \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
    --region ${REGION} > /dev/null

  echo "[/wiki] ${METHOD}メソッドのLambda統合を設定しました"
done

# Lambda関数にAPI Gatewayの実行権限を付与
echo "Lambda関数にAPI Gatewayの実行権限を付与中..."
for METHOD in GET POST PUT; do
  METHOD_LOWER=$(echo ${METHOD} | tr '[:upper:]' '[:lower:]')
  aws lambda add-permission \
    --function-name ${LAMBDA_FUNCTION_NAME} \
    --statement-id "apigateway-${METHOD_LOWER}-wiki-$(date +%s)-${RANDOM}" \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:475462779604:${REST_API_ID}/*/${METHOD}/wiki" \
    --region ${REGION} 2>/dev/null || echo "権限は既に存在するか、エラーが発生しました（続行します）"
done

# OPTIONSメソッドを設定（CORS用）
echo "[/wiki] OPTIONSメソッドを設定中..."

if aws apigateway get-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WIKI_RESOURCE_ID} \
  --http-method OPTIONS \
  --region ${REGION} &>/dev/null; then
  echo "[/wiki] OPTIONSメソッドは既に存在します"
else
  aws apigateway put-method \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${WIKI_RESOURCE_ID} \
    --http-method OPTIONS \
    --authorization-type "NONE" \
    --region ${REGION} > /dev/null
  echo "[/wiki] OPTIONSメソッドを作成しました"
fi

# OPTIONSメソッドの統合を設定（MOCK統合）
aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WIKI_RESOURCE_ID} \
  --http-method OPTIONS \
  --type MOCK \
  --request-templates '{"application/json":"{\"statusCode\": 200}"}' \
  --region ${REGION} > /dev/null 2>&1 || echo "OPTIONS integration already exists"

# OPTIONSメソッドのレスポンスを設定
aws apigateway put-method-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WIKI_RESOURCE_ID} \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters "method.response.header.Access-Control-Allow-Origin=false,method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false" \
  --region ${REGION} 2>/dev/null || echo "OPTIONS method response already exists"

# OPTIONSメソッドの統合レスポンスを設定
aws apigateway put-integration-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WIKI_RESOURCE_ID} \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'","method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,PUT,POST,DELETE,OPTIONS'"'"'"}' \
  --response-templates '{"application/json":"{\"statusCode\":200}"}' \
  --region ${REGION} 2>/dev/null || echo "OPTIONS integration response already exists"

# APIをデプロイ
echo ""
echo "APIをデプロイ中..."
DEPLOYMENT_ID=$(aws apigateway create-deployment \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --stage-name "prod" \
  --description "Wiki API CORS設定" \
  --query "id" \
  --output text)

echo ""
echo "=== 設定完了 ==="
echo "デプロイID: ${DEPLOYMENT_ID}"
echo "APIエンドポイント: https://${REST_API_ID}.execute-api.${REGION}.amazonaws.com/prod/wiki"
echo ""
echo "✅ Wiki APIのCORS設定が完了しました"

