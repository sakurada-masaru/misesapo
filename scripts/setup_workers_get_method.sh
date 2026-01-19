#!/bin/bash
# Workers API Gateway GETメソッドの設定スクリプト

set -e

REST_API_ID="51bhoxkbxd"
REGION="ap-northeast-1"
LAMBDA_FUNCTION_NAME="misesapo-s3-upload"
LAMBDA_ARN="arn:aws:lambda:${REGION}:475462779604:function:${LAMBDA_FUNCTION_NAME}"

echo "=== Workers API Gateway GETメソッドの設定を開始 ==="

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

# GETメソッドが存在するか確認
if aws apigateway get-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WORKER_ID_RESOURCE_ID} \
  --http-method GET \
  --region ${REGION} &>/dev/null; then
  echo "[/workers/{id}] GETメソッドは既に存在します（更新します）"
else
  # GETメソッドを作成
  echo "[/workers/{id}] GETメソッドを作成中..."
  aws apigateway put-method \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${WORKER_ID_RESOURCE_ID} \
    --http-method GET \
    --authorization-type "NONE" \
    --region ${REGION}
  echo "[/workers/{id}] GETメソッドを作成しました"
fi

# Lambda統合を設定（Lambdaプロキシ統合を使用）
echo "[/workers/{id}] GETメソッドのLambda統合を設定中..."
aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WORKER_ID_RESOURCE_ID} \
  --http-method GET \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
  --region ${REGION}

echo "[/workers/{id}] GETメソッドのLambda統合を設定しました"

# Lambda関数にAPI Gatewayの実行権限を付与
echo "Lambda関数にAPI Gatewayの実行権限を付与中..."
aws lambda add-permission \
  --function-name ${LAMBDA_FUNCTION_NAME} \
  --statement-id "apigateway-get-workers-id-$(date +%s)" \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:475462779604:${REST_API_ID}/*/GET/workers/{id}" \
  --region ${REGION} 2>/dev/null || echo "権限は既に存在するか、エラーが発生しました（続行します）"

# GETメソッドのレスポンスヘッダーにCORSヘッダーを追加
echo "[/workers/{id}] GETメソッドのCORSヘッダーを設定中..."

# 200ステータスコードのレスポンスヘッダーを設定
aws apigateway put-method-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WORKER_ID_RESOURCE_ID} \
  --http-method GET \
  --status-code 200 \
  --response-parameters "method.response.header.Access-Control-Allow-Origin=false,method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false" \
  --region ${REGION} 2>/dev/null || echo "GET method response already exists"

# 統合レスポンスでCORSヘッダーをマッピング（Lambdaプロキシ統合の場合は不要だが、念のため設定）
# Lambdaプロキシ統合を使用している場合、Lambda関数が返すヘッダーがそのまま返されるため、
# この設定は実際には不要ですが、念のため設定します
aws apigateway put-integration-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WORKER_ID_RESOURCE_ID} \
  --http-method GET \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'","method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,Authorization'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,PUT,POST,DELETE,OPTIONS'"'"'"}' \
  --region ${REGION} 2>/dev/null || echo "GET integration response already exists"

# APIをデプロイ
echo ""
echo "APIをデプロイ中..."
DEPLOYMENT_ID=$(aws apigateway create-deployment \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --stage-name "prod" \
  --description "Workers API GET method setup" \
  --query "id" \
  --output text)

echo ""
echo "=== 設定完了 ==="
echo "デプロイID: ${DEPLOYMENT_ID}"
echo "✅ GETメソッドの設定が完了しました。"

