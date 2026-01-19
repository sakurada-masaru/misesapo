#!/bin/bash
# 出退勤エラーログAPI Gateway設定スクリプト

set -e

REST_API_ID="51bhoxkbxd"
REGION="ap-northeast-1"
LAMBDA_FUNCTION_NAME="misesapo-s3-upload"
LAMBDA_ARN="arn:aws:lambda:${REGION}:475462779604:function:${LAMBDA_FUNCTION_NAME}"

echo "=== 出退勤エラーログAPI Gateway設定を開始 ==="

# ルートリソースIDを取得
ROOT_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/'].id" \
  --output text)

echo "ルートリソースID: ${ROOT_RESOURCE_ID}"

# /attendance リソースIDを取得
ATTENDANCE_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/attendance'].id" \
  --output text)

if [ -z "$ATTENDANCE_RESOURCE_ID" ]; then
  echo "エラー: /attendance リソースが見つかりません"
  exit 1
fi

echo "/attendance リソースID: ${ATTENDANCE_RESOURCE_ID}"

# /attendance/errors リソースが存在するか確認
ERRORS_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/attendance/errors'].id" \
  --output text)

if [ -z "$ERRORS_RESOURCE_ID" ]; then
  echo "[/attendance/errors] リソースを作成中..."
  ERRORS_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --region ${REGION} \
    --parent-id ${ATTENDANCE_RESOURCE_ID} \
    --path-part "errors" \
    --query "id" \
    --output text)
  echo "[/attendance/errors] リソースを作成しました: ${ERRORS_RESOURCE_ID}"
else
  echo "[/attendance/errors] リソースは既に存在します: ${ERRORS_RESOURCE_ID}"
fi

# GETメソッドを設定
echo "[/attendance/errors] GETメソッドを設定中..."
if aws apigateway get-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ERRORS_RESOURCE_ID} \
  --http-method GET \
  --region ${REGION} &>/dev/null; then
  echo "[/attendance/errors] GETメソッドは既に存在します（更新します）"
else
  aws apigateway put-method \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${ERRORS_RESOURCE_ID} \
    --http-method GET \
    --authorization-type "NONE" \
    --region ${REGION} > /dev/null
  echo "[/attendance/errors] GETメソッドを作成しました"
fi

# Lambda統合を設定
aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ERRORS_RESOURCE_ID} \
  --http-method GET \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
  --region ${REGION} > /dev/null

echo "[/attendance/errors] GETメソッドのLambda統合を設定しました"

# Lambda関数にAPI Gatewayの実行権限を付与
echo "Lambda関数にAPI Gatewayの実行権限を付与中..."
aws lambda add-permission \
  --function-name ${LAMBDA_FUNCTION_NAME} \
  --statement-id "apigateway-get-attendance-errors-$(date +%s)-${RANDOM}" \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:475462779604:${REST_API_ID}/*/GET/attendance/errors" \
  --region ${REGION} 2>/dev/null || echo "権限は既に存在するか、エラーが発生しました（続行します）"

# OPTIONSメソッドを設定（CORS用）
echo "[/attendance/errors] OPTIONSメソッドを設定中..."

if aws apigateway get-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ERRORS_RESOURCE_ID} \
  --http-method OPTIONS \
  --region ${REGION} &>/dev/null; then
  echo "[/attendance/errors] OPTIONSメソッドは既に存在します"
else
  aws apigateway put-method \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${ERRORS_RESOURCE_ID} \
    --http-method OPTIONS \
    --authorization-type "NONE" \
    --region ${REGION} > /dev/null
  echo "[/attendance/errors] OPTIONSメソッドを作成しました"
fi

# OPTIONSメソッドの統合を設定（MOCK統合）
aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ERRORS_RESOURCE_ID} \
  --http-method OPTIONS \
  --type MOCK \
  --request-templates '{"application/json":"{\"statusCode\": 200}"}' \
  --region ${REGION} > /dev/null 2>&1 || echo "OPTIONS integration already exists"

# OPTIONSメソッドのレスポンスを設定
aws apigateway put-method-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ERRORS_RESOURCE_ID} \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters "method.response.header.Access-Control-Allow-Origin=false,method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false" \
  --region ${REGION} 2>/dev/null || echo "OPTIONS method response already exists"

# OPTIONSメソッドの統合レスポンスを設定
aws apigateway put-integration-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ERRORS_RESOURCE_ID} \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'","method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,OPTIONS'"'"'"}' \
  --response-templates '{"application/json":"{\"statusCode\":200}"}' \
  --region ${REGION} 2>/dev/null || echo "OPTIONS integration response already exists"

# APIをデプロイ
echo ""
echo "APIをデプロイ中..."
DEPLOYMENT_ID=$(aws apigateway create-deployment \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --stage-name "prod" \
  --description "Attendance Errors API設定" \
  --query "id" \
  --output text)

echo ""
echo "=== 設定完了 ==="
echo "デプロイID: ${DEPLOYMENT_ID}"
echo "APIエンドポイント: https://${REST_API_ID}.execute-api.${REGION}.amazonaws.com/prod/attendance/errors"
echo ""
echo "✅ 出退勤エラーログAPIの設定が完了しました"

