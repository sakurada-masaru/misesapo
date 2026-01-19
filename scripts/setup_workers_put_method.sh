#!/bin/bash
# Workers API Gateway PUTメソッドの作成とLambda統合設定スクリプト

set -e

REST_API_ID="51bhoxkbxd"
REGION="ap-northeast-1"
LAMBDA_FUNCTION_NAME="misesapo-s3-upload"
LAMBDA_ARN="arn:aws:lambda:${REGION}:475462779604:function:${LAMBDA_FUNCTION_NAME}"

echo "=== Workers API Gateway PUTメソッドの設定を開始 ==="

# /workers/{id} リソースIDを取得
WORKER_ID_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/workers/{id}'].id" \
  --output text)

if [ -z "$WORKER_ID_RESOURCE_ID" ]; then
  echo "❌ エラー: /workers/{id} リソースが見つかりません"
  exit 1
fi

echo "[/workers/{id}] リソースID: ${WORKER_ID_RESOURCE_ID}"

# PUTメソッドが存在するか確認
if aws apigateway get-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WORKER_ID_RESOURCE_ID} \
  --http-method PUT \
  --region ${REGION} &>/dev/null; then
  echo "[/workers/{id}] PUTメソッドは既に存在します（更新します）"
else
  # PUTメソッドを作成
  echo "[/workers/{id}] PUTメソッドを作成中..."
  aws apigateway put-method \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${WORKER_ID_RESOURCE_ID} \
    --http-method PUT \
    --authorization-type "NONE" \
    --region ${REGION}
  echo "[/workers/{id}] PUTメソッドを作成しました"
fi

# Lambda統合を設定（Lambdaプロキシ統合を使用）
echo "[/workers/{id}] PUTメソッドのLambda統合を設定中..."
aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WORKER_ID_RESOURCE_ID} \
  --http-method PUT \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
  --region ${REGION}

echo "[/workers/{id}] PUTメソッドのLambda統合を設定しました"

# Lambda関数にAPI Gatewayの実行権限を付与
echo "Lambda関数にAPI Gatewayの実行権限を付与中..."
aws lambda add-permission \
  --function-name ${LAMBDA_FUNCTION_NAME} \
  --statement-id "apigateway-put-workers-id-$(date +%s)-${RANDOM}" \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:475462779604:${REST_API_ID}/*/PUT/workers/*" \
  --region ${REGION} 2>/dev/null || echo "権限は既に存在するか、エラーが発生しました（続行します）"

# OPTIONSメソッドを設定（CORS用）
echo "[/workers/{id}] OPTIONSメソッドを設定中..."

# OPTIONSメソッドが存在するか確認
if aws apigateway get-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WORKER_ID_RESOURCE_ID} \
  --http-method OPTIONS \
  --region ${REGION} &>/dev/null; then
  echo "[/workers/{id}] OPTIONSメソッドは既に存在します"
else
  # OPTIONSメソッドを作成
  aws apigateway put-method \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${WORKER_ID_RESOURCE_ID} \
    --http-method OPTIONS \
    --authorization-type "NONE" \
    --region ${REGION} > /dev/null
  echo "[/workers/{id}] OPTIONSメソッドを作成しました"
fi

# OPTIONSメソッドの統合を設定（MOCK統合）
aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WORKER_ID_RESOURCE_ID} \
  --http-method OPTIONS \
  --type MOCK \
  --request-templates '{"application/json":"{\"statusCode\": 200}"}' \
  --region ${REGION} > /dev/null 2>&1 || echo "OPTIONS integration already exists"

# OPTIONSメソッドのレスポンスを設定
aws apigateway put-method-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WORKER_ID_RESOURCE_ID} \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters "method.response.header.Access-Control-Allow-Origin=false,method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false" \
  --region ${REGION} 2>/dev/null || echo "OPTIONS method response already exists"

# OPTIONSメソッドの統合レスポンスを設定
aws apigateway put-integration-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WORKER_ID_RESOURCE_ID} \
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
  --description "Workers PUTメソッドの作成とLambda統合設定" \
  --query "id" \
  --output text)

echo ""
echo "=== 設定完了 ==="
echo "デプロイID: ${DEPLOYMENT_ID}"
echo "APIエンドポイント: https://${REST_API_ID}.execute-api.${REGION}.amazonaws.com/prod/workers/{id}"
echo ""
echo "✅ PUTメソッドを作成しました"
echo "✅ PUTメソッドのLambda統合を設定しました（AWS_PROXY）"
echo "✅ OPTIONSメソッド（プリフライトリクエスト）を設定しました"
echo ""
echo "⚠️  注意: ブラウザをリロードして再度お試しください"

