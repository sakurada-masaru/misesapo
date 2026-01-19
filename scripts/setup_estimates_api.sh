#!/bin/bash
# 見積もり管理API Gateway設定スクリプト

set -e

REST_API_ID="51bhoxkbxd"
REGION="ap-northeast-1"
LAMBDA_FUNCTION_NAME="misesapo-s3-upload"
LAMBDA_ARN="arn:aws:lambda:${REGION}:475462779604:function:${LAMBDA_FUNCTION_NAME}"

echo "=== 見積もり管理API Gateway設定を開始 ==="

# ルートリソースIDを取得
ROOT_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/'].id" \
  --output text)

echo "ルートリソースID: ${ROOT_RESOURCE_ID}"

# /estimates リソースが存在するか確認
ESTIMATES_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/estimates'].id" \
  --output text)

if [ -z "$ESTIMATES_RESOURCE_ID" ]; then
  echo "[/estimates] リソースを作成中..."
  ESTIMATES_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --region ${REGION} \
    --parent-id ${ROOT_RESOURCE_ID} \
    --path-part "estimates" \
    --query "id" \
    --output text)
  echo "[/estimates] リソースを作成しました: ${ESTIMATES_RESOURCE_ID}"
else
  echo "[/estimates] リソースは既に存在します: ${ESTIMATES_RESOURCE_ID}"
fi

# /estimates/{id} リソースが存在するか確認（既存のリソースは {id} を使用）
ESTIMATE_ID_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/estimates/{id}'].id" \
  --output text)

if [ -z "$ESTIMATE_ID_RESOURCE_ID" ]; then
  echo "[/estimates/{id}] リソースを作成中..."
  ESTIMATE_ID_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --region ${REGION} \
    --parent-id ${ESTIMATES_RESOURCE_ID} \
    --path-part "{id}" \
    --query "id" \
    --output text)
  echo "[/estimates/{id}] リソースを作成しました: ${ESTIMATE_ID_RESOURCE_ID}"
else
  echo "[/estimates/{id}] リソースは既に存在します: ${ESTIMATE_ID_RESOURCE_ID}"
fi

# /estimates リソースのメソッドを設定
echo ""
echo "=== /estimates リソースのメソッドを設定 ==="

# GET メソッド
echo "GET メソッドを設定中..."
aws apigateway put-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ESTIMATES_RESOURCE_ID} \
  --http-method GET \
  --authorization-type NONE \
  --region ${REGION} > /dev/null 2>&1 || echo "GET メソッドは既に存在します"

aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ESTIMATES_RESOURCE_ID} \
  --http-method GET \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
  --region ${REGION} > /dev/null 2>&1 || echo "GET 統合は既に設定されています"

# POST メソッド
echo "POST メソッドを設定中..."
aws apigateway put-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ESTIMATES_RESOURCE_ID} \
  --http-method POST \
  --authorization-type NONE \
  --region ${REGION} > /dev/null 2>&1 || echo "POST メソッドは既に存在します"

aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ESTIMATES_RESOURCE_ID} \
  --http-method POST \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
  --region ${REGION} > /dev/null 2>&1 || echo "POST 統合は既に設定されています"

# OPTIONS メソッド（CORS用）
echo "OPTIONS メソッドを設定中..."
aws apigateway put-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ESTIMATES_RESOURCE_ID} \
  --http-method OPTIONS \
  --authorization-type NONE \
  --region ${REGION} > /dev/null 2>&1 || echo "OPTIONS メソッドは既に存在します"

# /estimates/{id} リソースのメソッドを設定
echo ""
echo "=== /estimates/{id} リソースのメソッドを設定 ==="

# GET メソッド
echo "GET メソッドを設定中..."
aws apigateway put-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ESTIMATE_ID_RESOURCE_ID} \
  --http-method GET \
  --authorization-type NONE \
  --region ${REGION} > /dev/null 2>&1 || echo "GET メソッドは既に存在します"

aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ESTIMATE_ID_RESOURCE_ID} \
  --http-method GET \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
  --region ${REGION} > /dev/null 2>&1 || echo "GET 統合は既に設定されています"

# PUT メソッド
echo "PUT メソッドを設定中..."
aws apigateway put-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ESTIMATE_ID_RESOURCE_ID} \
  --http-method PUT \
  --authorization-type NONE \
  --region ${REGION} > /dev/null 2>&1 || echo "PUT メソッドは既に存在します"

aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ESTIMATE_ID_RESOURCE_ID} \
  --http-method PUT \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
  --region ${REGION} > /dev/null 2>&1 || echo "PUT 統合は既に設定されています"

# DELETE メソッド
echo "DELETE メソッドを設定中..."
aws apigateway put-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ESTIMATE_ID_RESOURCE_ID} \
  --http-method DELETE \
  --authorization-type NONE \
  --region ${REGION} > /dev/null 2>&1 || echo "DELETE メソッドは既に存在します"

aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ESTIMATE_ID_RESOURCE_ID} \
  --http-method DELETE \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
  --region ${REGION} > /dev/null 2>&1 || echo "DELETE 統合は既に設定されています"

# OPTIONS メソッド（CORS用）
echo "OPTIONS メソッドを設定中..."
aws apigateway put-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ESTIMATE_ID_RESOURCE_ID} \
  --http-method OPTIONS \
  --authorization-type NONE \
  --region ${REGION} > /dev/null 2>&1 || echo "OPTIONS メソッドは既に存在します"

# Lambda関数にAPI Gatewayからの呼び出し権限を付与
echo ""
echo "=== Lambda関数に権限を付与 ==="
aws lambda add-permission \
  --function-name ${LAMBDA_FUNCTION_NAME} \
  --statement-id apigateway-estimates-$(date +%s) \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:475462779604:${REST_API_ID}/*/*" \
  --region ${REGION} > /dev/null 2>&1 || echo "権限は既に付与されています"

# デプロイ
echo ""
echo "=== API Gatewayをデプロイ ==="
DEPLOYMENT_ID=$(aws apigateway create-deployment \
  --rest-api-id ${REST_API_ID} \
  --stage-name prod \
  --region ${REGION} \
  --query "id" \
  --output text)

echo "デプロイID: ${DEPLOYMENT_ID}"
echo ""
echo "=== 見積もり管理API Gateway設定が完了しました ==="
echo "エンドポイントURL: https://${REST_API_ID}.execute-api.${REGION}.amazonaws.com/prod/estimates"

