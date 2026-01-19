#!/bin/bash
# Cognitoユーザー作成APIの設定スクリプト

set -e

REST_API_ID="51bhoxkbxd"
REGION="ap-northeast-1"
LAMBDA_FUNCTION_NAME="misesapo-s3-upload"
LAMBDA_ARN="arn:aws:lambda:${REGION}:475462779604:function:${LAMBDA_FUNCTION_NAME}"

echo "=== Cognitoユーザー作成APIの設定を開始 ==="

# ルートリソースIDを取得
ROOT_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/'].id" \
  --output text)

echo "ルートリソースID: ${ROOT_RESOURCE_ID}"

# /admin リソースが存在するか確認
ADMIN_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/admin'].id" \
  --output text)

if [ -z "$ADMIN_RESOURCE_ID" ]; then
  echo "[/admin] リソースを作成中..."
  ADMIN_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --region ${REGION} \
    --parent-id ${ROOT_RESOURCE_ID} \
    --path-part "admin" \
    --query "id" \
    --output text)
  echo "[/admin] リソースを作成しました: ${ADMIN_RESOURCE_ID}"
else
  echo "[/admin] リソースは既に存在します: ${ADMIN_RESOURCE_ID}"
fi

# /admin/cognito リソースが存在するか確認
COGNITO_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/admin/cognito'].id" \
  --output text)

if [ -z "$COGNITO_RESOURCE_ID" ]; then
  echo "[/admin/cognito] リソースを作成中..."
  COGNITO_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --region ${REGION} \
    --parent-id ${ADMIN_RESOURCE_ID} \
    --path-part "cognito" \
    --query "id" \
    --output text)
  echo "[/admin/cognito] リソースを作成しました: ${COGNITO_RESOURCE_ID}"
else
  echo "[/admin/cognito] リソースは既に存在します: ${COGNITO_RESOURCE_ID}"
fi

# /admin/cognito/users リソースが存在するか確認
USERS_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/admin/cognito/users'].id" \
  --output text)

if [ -z "$USERS_RESOURCE_ID" ]; then
  echo "[/admin/cognito/users] リソースを作成中..."
  USERS_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --region ${REGION} \
    --parent-id ${COGNITO_RESOURCE_ID} \
    --path-part "users" \
    --query "id" \
    --output text)
  echo "[/admin/cognito/users] リソースを作成しました: ${USERS_RESOURCE_ID}"
else
  echo "[/admin/cognito/users] リソースは既に存在します: ${USERS_RESOURCE_ID}"
fi

# POSTメソッドを作成
echo "[/admin/cognito/users] POSTメソッドを作成中..."
if aws apigateway get-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${USERS_RESOURCE_ID} \
  --http-method POST \
  --region ${REGION} &>/dev/null; then
  echo "[/admin/cognito/users] POSTメソッドは既に存在します（更新します）"
else
  aws apigateway put-method \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${USERS_RESOURCE_ID} \
    --http-method POST \
    --authorization-type "NONE" \
    --region ${REGION} > /dev/null
  echo "[/admin/cognito/users] POSTメソッドを作成しました"
fi

# Lambda統合を設定
echo "[/admin/cognito/users] POSTメソッドのLambda統合を設定中..."
aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${USERS_RESOURCE_ID} \
  --http-method POST \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
  --region ${REGION} > /dev/null

echo "[/admin/cognito/users] POSTメソッドのLambda統合を設定しました"

# Lambda関数にAPI Gatewayの実行権限を付与
echo "Lambda関数にAPI Gatewayの実行権限を付与中..."
aws lambda add-permission \
  --function-name ${LAMBDA_FUNCTION_NAME} \
  --statement-id "apigateway-post-admin-cognito-users-$(date +%s)" \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:475462779604:${REST_API_ID}/*/POST/admin/cognito/users" \
  --region ${REGION} 2>/dev/null || echo "権限は既に存在するか、エラーが発生しました（続行します）"

# OPTIONSメソッドを設定（CORS用）
echo "[/admin/cognito/users] OPTIONSメソッドを設定中..."
if aws apigateway get-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${USERS_RESOURCE_ID} \
  --http-method OPTIONS \
  --region ${REGION} &>/dev/null; then
  echo "[/admin/cognito/users] OPTIONSメソッドは既に存在します"
else
  aws apigateway put-method \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${USERS_RESOURCE_ID} \
    --http-method OPTIONS \
    --authorization-type "NONE" \
    --region ${REGION} > /dev/null
  
  # MOCK統合を設定
  aws apigateway put-integration \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${USERS_RESOURCE_ID} \
    --http-method OPTIONS \
    --type MOCK \
    --request-templates '{"application/json":"{\"statusCode\":200}"}' \
    --region ${REGION} > /dev/null
  
  # OPTIONSメソッドのレスポンスを設定
  aws apigateway put-method-response \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${USERS_RESOURCE_ID} \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters "method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false,method.response.header.Access-Control-Allow-Origin=false" \
    --region ${REGION} > /dev/null
  
  aws apigateway put-integration-response \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${USERS_RESOURCE_ID} \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters "{\"method.response.header.Access-Control-Allow-Headers\":\"'Content-Type,Authorization'\",\"method.response.header.Access-Control-Allow-Methods\":\"'POST,OPTIONS'\",\"method.response.header.Access-Control-Allow-Origin\":\"'*'\"}" \
    --region ${REGION} > /dev/null
  
  echo "[/admin/cognito/users] OPTIONSメソッドを設定しました"
fi

# POSTメソッドのCORSヘッダーを設定
echo "[/admin/cognito/users] POSTメソッドのCORSヘッダーを設定中..."
aws apigateway put-method-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${USERS_RESOURCE_ID} \
  --http-method POST \
  --status-code 200 \
  --response-parameters "method.response.header.Access-Control-Allow-Origin=false,method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false" \
  --region ${REGION} 2>/dev/null || echo "POST method response already exists"

aws apigateway put-integration-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${USERS_RESOURCE_ID} \
  --http-method POST \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'","method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,Authorization'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'POST,OPTIONS'"'"'"}' \
  --region ${REGION} 2>/dev/null || echo "POST integration response already exists"

# APIをデプロイ
echo ""
echo "APIをデプロイ中..."
DEPLOYMENT_ID=$(aws apigateway create-deployment \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --stage-name "prod" \
  --description "Cognitoユーザー作成API設定" \
  --query "id" \
  --output text)

echo ""
echo "=== 設定完了 ==="
echo "デプロイID: ${DEPLOYMENT_ID}"
echo "✅ Cognitoユーザー作成APIの設定が完了しました。"

