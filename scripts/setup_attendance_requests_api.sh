#!/bin/bash
# 出退勤修正申請API Gateway設定スクリプト

set -e

REST_API_ID="51bhoxkbxd"
REGION="ap-northeast-1"
LAMBDA_FUNCTION_NAME="misesapo-s3-upload"
LAMBDA_ARN="arn:aws:lambda:${REGION}:475462779604:function:${LAMBDA_FUNCTION_NAME}"

echo "=== 出退勤修正申請API Gateway設定を開始 ==="

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

# /attendance/requests リソースが存在するか確認
REQUESTS_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/attendance/requests'].id" \
  --output text)

if [ -z "$REQUESTS_RESOURCE_ID" ]; then
  echo "[/attendance/requests] リソースを作成中..."
  REQUESTS_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --region ${REGION} \
    --parent-id ${ATTENDANCE_RESOURCE_ID} \
    --path-part "requests" \
    --query "id" \
    --output text)
  echo "[/attendance/requests] リソースを作成しました: ${REQUESTS_RESOURCE_ID}"
else
  echo "[/attendance/requests] リソースは既に存在します: ${REQUESTS_RESOURCE_ID}"
fi

# /attendance/requests/{id} リソースが存在するか確認
REQUESTS_ID_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/attendance/requests/{id}'].id" \
  --output text)

if [ -z "$REQUESTS_ID_RESOURCE_ID" ]; then
  echo "[/attendance/requests/{id}] リソースを作成中..."
  REQUESTS_ID_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --region ${REGION} \
    --parent-id ${REQUESTS_RESOURCE_ID} \
    --path-part "{id}" \
    --query "id" \
    --output text)
  echo "[/attendance/requests/{id}] リソースを作成しました: ${REQUESTS_ID_RESOURCE_ID}"
else
  echo "[/attendance/requests/{id}] リソースは既に存在します: ${REQUESTS_ID_RESOURCE_ID}"
fi

# /attendance/requests のGET, POSTメソッドを設定
for METHOD in GET POST; do
  echo "[/attendance/requests] ${METHOD}メソッドを設定中..."
  if aws apigateway get-method \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${REQUESTS_RESOURCE_ID} \
    --http-method ${METHOD} \
    --region ${REGION} &>/dev/null; then
    echo "[/attendance/requests] ${METHOD}メソッドは既に存在します（更新します）"
  else
    aws apigateway put-method \
      --rest-api-id ${REST_API_ID} \
      --resource-id ${REQUESTS_RESOURCE_ID} \
      --http-method ${METHOD} \
      --authorization-type "NONE" \
      --region ${REGION} > /dev/null
    echo "[/attendance/requests] ${METHOD}メソッドを作成しました"
  fi

  # Lambda統合を設定
  aws apigateway put-integration \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${REQUESTS_RESOURCE_ID} \
    --http-method ${METHOD} \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
    --region ${REGION} > /dev/null

  echo "[/attendance/requests] ${METHOD}メソッドのLambda統合を設定しました"
done

# /attendance/requests/{id} のGET, PUT, DELETEメソッドを設定
for METHOD in GET PUT DELETE; do
  echo "[/attendance/requests/{id}] ${METHOD}メソッドを設定中..."
  if aws apigateway get-method \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${REQUESTS_ID_RESOURCE_ID} \
    --http-method ${METHOD} \
    --region ${REGION} &>/dev/null; then
    echo "[/attendance/requests/{id}] ${METHOD}メソッドは既に存在します（更新します）"
  else
    aws apigateway put-method \
      --rest-api-id ${REST_API_ID} \
      --resource-id ${REQUESTS_ID_RESOURCE_ID} \
      --http-method ${METHOD} \
      --authorization-type "NONE" \
      --region ${REGION} > /dev/null
    echo "[/attendance/requests/{id}] ${METHOD}メソッドを作成しました"
  fi

  # Lambda統合を設定
  aws apigateway put-integration \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${REQUESTS_ID_RESOURCE_ID} \
    --http-method ${METHOD} \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
    --region ${REGION} > /dev/null

  echo "[/attendance/requests/{id}] ${METHOD}メソッドのLambda統合を設定しました"
done

# Lambda関数にAPI Gatewayの実行権限を付与
echo "Lambda関数にAPI Gatewayの実行権限を付与中..."
for METHOD in GET POST PUT DELETE; do
  METHOD_LOWER=$(echo ${METHOD} | tr '[:upper:]' '[:lower:]')
  aws lambda add-permission \
    --function-name ${LAMBDA_FUNCTION_NAME} \
    --statement-id "apigateway-${METHOD_LOWER}-attendance-requests-$(date +%s)-${RANDOM}" \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:475462779604:${REST_API_ID}/*/${METHOD}/attendance/requests" \
    --region ${REGION} 2>/dev/null || echo "権限は既に存在するか、エラーが発生しました（続行します）"
  
  aws lambda add-permission \
    --function-name ${LAMBDA_FUNCTION_NAME} \
    --statement-id "apigateway-${METHOD_LOWER}-attendance-requests-id-$(date +%s)-${RANDOM}" \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:475462779604:${REST_API_ID}/*/${METHOD}/attendance/requests/*" \
    --region ${REGION} 2>/dev/null || echo "権限は既に存在するか、エラーが発生しました（続行します）"
done

# OPTIONSメソッドを設定（CORS用）
for RESOURCE_ID in ${REQUESTS_RESOURCE_ID} ${REQUESTS_ID_RESOURCE_ID}; do
  RESOURCE_PATH=$([ "$RESOURCE_ID" == "$REQUESTS_RESOURCE_ID" ] && echo "/attendance/requests" || echo "/attendance/requests/{id}")
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
    echo "[${RESOURCE_PATH}] OPTIONSメソッドを作成しました"
  fi

  # OPTIONSメソッドの統合を設定（MOCK統合）
  aws apigateway put-integration \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${RESOURCE_ID} \
    --http-method OPTIONS \
    --type MOCK \
    --request-templates '{"application/json":"{\"statusCode\": 200}"}' \
    --region ${REGION} > /dev/null 2>&1 || echo "OPTIONS integration already exists"

  # OPTIONSメソッドのレスポンスを設定
  aws apigateway put-method-response \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${RESOURCE_ID} \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters "method.response.header.Access-Control-Allow-Origin=false,method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false" \
    --region ${REGION} 2>/dev/null || echo "OPTIONS method response already exists"

  # OPTIONSメソッドの統合レスポンスを設定
  aws apigateway put-integration-response \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${RESOURCE_ID} \
    --http-method OPTIONS \
    --status-code 200 \
    --response-parameters '{"method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'","method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,PUT,POST,DELETE,OPTIONS'"'"'"}' \
    --response-templates '{"application/json":"{\"statusCode\":200}"}' \
    --region ${REGION} 2>/dev/null || echo "OPTIONS integration response already exists"
done

# APIをデプロイ
echo ""
echo "APIをデプロイ中..."
DEPLOYMENT_ID=$(aws apigateway create-deployment \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --stage-name "prod" \
  --description "Attendance Requests API設定" \
  --query "id" \
  --output text)

echo ""
echo "=== 設定完了 ==="
echo "デプロイID: ${DEPLOYMENT_ID}"
echo "APIエンドポイント: https://${REST_API_ID}.execute-api.${REGION}.amazonaws.com/prod/attendance/requests"
echo ""
echo "✅ 出退勤修正申請APIの設定が完了しました"

