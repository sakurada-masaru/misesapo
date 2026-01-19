#!/bin/bash
# Attendance API Gateway設定スクリプト

set -e

REST_API_ID="51bhoxkbxd"
REGION="ap-northeast-1"
LAMBDA_FUNCTION_NAME="misesapo-s3-upload"
LAMBDA_ARN="arn:aws:lambda:${REGION}:475462779604:function:${LAMBDA_FUNCTION_NAME}"

echo "=== Attendance API Gateway設定を開始 ==="

# ルートリソースIDを取得
ROOT_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/'].id" \
  --output text)

echo "ルートリソースID: ${ROOT_RESOURCE_ID}"

# /attendance リソースが存在するか確認
ATTENDANCE_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/attendance'].id" \
  --output text)

if [ -z "$ATTENDANCE_RESOURCE_ID" ]; then
  echo "[/attendance] リソースを作成中..."
  ATTENDANCE_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --region ${REGION} \
    --parent-id ${ROOT_RESOURCE_ID} \
    --path-part "attendance" \
    --query "id" \
    --output text)
  echo "[/attendance] リソースを作成しました: ${ATTENDANCE_RESOURCE_ID}"
else
  echo "[/attendance] リソースは既に存在します: ${ATTENDANCE_RESOURCE_ID}"
fi

# /attendance/{id} リソースが存在するか確認
ATTENDANCE_ID_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/attendance/{id}'].id" \
  --output text)

if [ -z "$ATTENDANCE_ID_RESOURCE_ID" ]; then
  echo "[/attendance/{id}] リソースを作成中..."
  ATTENDANCE_ID_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --region ${REGION} \
    --parent-id ${ATTENDANCE_RESOURCE_ID} \
    --path-part "{id}" \
    --query "id" \
    --output text)
  echo "[/attendance/{id}] リソースを作成しました: ${ATTENDANCE_ID_RESOURCE_ID}"
else
  echo "[/attendance/{id}] リソースは既に存在します: ${ATTENDANCE_ID_RESOURCE_ID}"
fi

# /attendance のGET, POSTメソッドを設定
for METHOD in GET POST; do
  echo "[/attendance] ${METHOD}メソッドを設定中..."
  if aws apigateway get-method \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${ATTENDANCE_RESOURCE_ID} \
    --http-method ${METHOD} \
    --region ${REGION} &>/dev/null; then
    echo "[/attendance] ${METHOD}メソッドは既に存在します（更新します）"
  else
    aws apigateway put-method \
      --rest-api-id ${REST_API_ID} \
      --resource-id ${ATTENDANCE_RESOURCE_ID} \
      --http-method ${METHOD} \
      --authorization-type "NONE" \
      --region ${REGION} > /dev/null
    echo "[/attendance] ${METHOD}メソッドを作成しました"
  fi

  # Lambda統合を設定
  aws apigateway put-integration \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${ATTENDANCE_RESOURCE_ID} \
    --http-method ${METHOD} \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
    --region ${REGION} > /dev/null

  echo "[/attendance] ${METHOD}メソッドのLambda統合を設定しました"
done

# /attendance/{id} のGET, PUT, DELETEメソッドを設定
for METHOD in GET PUT DELETE; do
  echo "[/attendance/{id}] ${METHOD}メソッドを設定中..."
  if aws apigateway get-method \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${ATTENDANCE_ID_RESOURCE_ID} \
    --http-method ${METHOD} \
    --region ${REGION} &>/dev/null; then
    echo "[/attendance/{id}] ${METHOD}メソッドは既に存在します（更新します）"
  else
    aws apigateway put-method \
      --rest-api-id ${REST_API_ID} \
      --resource-id ${ATTENDANCE_ID_RESOURCE_ID} \
      --http-method ${METHOD} \
      --authorization-type "NONE" \
      --region ${REGION} > /dev/null
    echo "[/attendance/{id}] ${METHOD}メソッドを作成しました"
  fi

  # Lambda統合を設定
  aws apigateway put-integration \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${ATTENDANCE_ID_RESOURCE_ID} \
    --http-method ${METHOD} \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
    --region ${REGION} > /dev/null

  echo "[/attendance/{id}] ${METHOD}メソッドのLambda統合を設定しました"
done

# Lambda関数にAPI Gatewayの実行権限を付与
echo "Lambda関数にAPI Gatewayの実行権限を付与中..."
for METHOD in GET POST PUT DELETE; do
  METHOD_LOWER=$(echo ${METHOD} | tr '[:upper:]' '[:lower:]')
  aws lambda add-permission \
    --function-name ${LAMBDA_FUNCTION_NAME} \
    --statement-id "apigateway-${METHOD_LOWER}-attendance-$(date +%s)-${RANDOM}" \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:475462779604:${REST_API_ID}/*/${METHOD}/attendance" \
    --region ${REGION} 2>/dev/null || echo "権限は既に存在するか、エラーが発生しました（続行します）"
  
  aws lambda add-permission \
    --function-name ${LAMBDA_FUNCTION_NAME} \
    --statement-id "apigateway-${METHOD_LOWER}-attendance-id-$(date +%s)-${RANDOM}" \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:475462779604:${REST_API_ID}/*/${METHOD}/attendance/*" \
    --region ${REGION} 2>/dev/null || echo "権限は既に存在するか、エラーが発生しました（続行します）"
done

# OPTIONSメソッドを設定（CORS用）
for RESOURCE_ID in ${ATTENDANCE_RESOURCE_ID} ${ATTENDANCE_ID_RESOURCE_ID}; do
  RESOURCE_PATH=$([ "$RESOURCE_ID" == "$ATTENDANCE_RESOURCE_ID" ] && echo "/attendance" || echo "/attendance/{id}")
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

  # OPTIONSメソッドの統合を設定（Lambda統合に変更）
  aws apigateway put-integration \
    --rest-api-id ${REST_API_ID} \
    --resource-id ${RESOURCE_ID} \
    --http-method OPTIONS \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
    --region ${REGION} > /dev/null 2>&1 || echo "OPTIONS integration already exists"
done

# APIをデプロイ
echo ""
echo "APIをデプロイ中..."
DEPLOYMENT_ID=$(aws apigateway create-deployment \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --stage-name "prod" \
  --description "Attendance API設定" \
  --query "id" \
  --output text)

echo ""
echo "=== 設定完了 ==="
echo "デプロイID: ${DEPLOYMENT_ID}"
echo "APIエンドポイント: https://${REST_API_ID}.execute-api.${REGION}.amazonaws.com/prod/attendance"
echo ""
echo "✅ Attendance APIの設定が完了しました"

