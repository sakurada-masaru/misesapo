#!/bin/bash
# 在庫管理API Gateway設定スクリプト

set -e

REST_API_ID="2z0ui5xfxb"
REGION="ap-northeast-1"
LAMBDA_FUNCTION_NAME="misesapo-s3-upload"
LAMBDA_ARN="arn:aws:lambda:${REGION}:475462779604:function:${LAMBDA_FUNCTION_NAME}"

echo "=== 在庫管理API Gateway設定を開始 ==="

# ルートリソースIDを取得
ROOT_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/'].id" \
  --output text)

echo "ルートリソースID: ${ROOT_RESOURCE_ID}"

# /staff リソースが存在するか確認
STAFF_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/staff'].id" \
  --output text)

if [ -z "$STAFF_RESOURCE_ID" ]; then
  echo "[/staff] リソースを作成中..."
  STAFF_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --region ${REGION} \
    --parent-id ${ROOT_RESOURCE_ID} \
    --path-part "staff" \
    --query "id" \
    --output text)
  echo "[/staff] リソースを作成しました: ${STAFF_RESOURCE_ID}"
else
  echo "[/staff] リソースは既に存在します: ${STAFF_RESOURCE_ID}"
fi

# /staff/inventory リソースが存在するか確認
INVENTORY_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/staff/inventory'].id" \
  --output text)

if [ -z "$INVENTORY_RESOURCE_ID" ]; then
  echo "[/staff/inventory] リソースを作成中..."
  INVENTORY_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --region ${REGION} \
    --parent-id ${STAFF_RESOURCE_ID} \
    --path-part "inventory" \
    --query "id" \
    --output text)
  echo "[/staff/inventory] リソースを作成しました: ${INVENTORY_RESOURCE_ID}"
else
  echo "[/staff/inventory] リソースは既に存在します: ${INVENTORY_RESOURCE_ID}"
fi

# /staff/inventory/items リソースが存在するか確認
ITEMS_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/staff/inventory/items'].id" \
  --output text)

if [ -z "$ITEMS_RESOURCE_ID" ]; then
  echo "[/staff/inventory/items] リソースを作成中..."
  ITEMS_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --region ${REGION} \
    --parent-id ${INVENTORY_RESOURCE_ID} \
    --path-part "items" \
    --query "id" \
    --output text)
  echo "[/staff/inventory/items] リソースを作成しました: ${ITEMS_RESOURCE_ID}"
else
  echo "[/staff/inventory/items] リソースは既に存在します: ${ITEMS_RESOURCE_ID}"
fi

# GET メソッドを追加
echo "[/staff/inventory/items] GET メソッドを設定中..."
aws apigateway put-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ITEMS_RESOURCE_ID} \
  --http-method GET \
  --authorization-type NONE \
  --region ${REGION} > /dev/null 2>&1 || echo "GET メソッドは既に存在します"

aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ITEMS_RESOURCE_ID} \
  --http-method GET \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
  --region ${REGION} > /dev/null 2>&1 || echo "GET 統合は既に設定されています"

# POST メソッドを追加
echo "[/staff/inventory/items] POST メソッドを設定中..."
aws apigateway put-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ITEMS_RESOURCE_ID} \
  --http-method POST \
  --authorization-type NONE \
  --region ${REGION} > /dev/null 2>&1 || echo "POST メソッドは既に存在します"

aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ITEMS_RESOURCE_ID} \
  --http-method POST \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
  --region ${REGION} > /dev/null 2>&1 || echo "POST 統合は既に設定されています"

# OPTIONS メソッドを追加（CORS用 - Lambdaプロキシ統合）
echo "[/staff/inventory/items] OPTIONS メソッドを設定中..."
aws apigateway put-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ITEMS_RESOURCE_ID} \
  --http-method OPTIONS \
  --authorization-type NONE \
  --region ${REGION} > /dev/null 2>&1 || echo "OPTIONS メソッドは既に存在します"

# 既存の統合を削除（MOCKからAWS_PROXYに変更するため）
aws apigateway delete-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ITEMS_RESOURCE_ID} \
  --http-method OPTIONS \
  --region ${REGION} > /dev/null 2>&1 || true

# Lambdaプロキシ統合を設定（Lambda関数でOPTIONSを処理）
aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ITEMS_RESOURCE_ID} \
  --http-method OPTIONS \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
  --region ${REGION} > /dev/null 2>&1 || echo "OPTIONS 統合は既に設定されています"

# /staff/inventory/out リソースが存在するか確認
OUT_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/staff/inventory/out'].id" \
  --output text)

if [ -z "$OUT_RESOURCE_ID" ]; then
  echo "[/staff/inventory/out] リソースを作成中..."
  OUT_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --region ${REGION} \
    --parent-id ${INVENTORY_RESOURCE_ID} \
    --path-part "out" \
    --query "id" \
    --output text)
  echo "[/staff/inventory/out] リソースを作成しました: ${OUT_RESOURCE_ID}"
else
  echo "[/staff/inventory/out] リソースは既に存在します: ${OUT_RESOURCE_ID}"
fi

# POST メソッドを追加
echo "[/staff/inventory/out] POST メソッドを設定中..."
aws apigateway put-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${OUT_RESOURCE_ID} \
  --http-method POST \
  --authorization-type NONE \
  --region ${REGION} > /dev/null 2>&1 || echo "POST メソッドは既に存在します"

aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${OUT_RESOURCE_ID} \
  --http-method POST \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
  --region ${REGION} > /dev/null 2>&1 || echo "POST 統合は既に設定されています"

# OPTIONS メソッドを追加（CORS用 - MOCK統合）
echo "[/staff/inventory/out] OPTIONS メソッドを設定中..."
aws apigateway put-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${OUT_RESOURCE_ID} \
  --http-method OPTIONS \
  --authorization-type NONE \
  --region ${REGION} > /dev/null 2>&1 || echo "OPTIONS メソッドは既に存在します"

# 既存の統合を削除（AWS_PROXYからMOCKに変更するため）
aws apigateway delete-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${OUT_RESOURCE_ID} \
  --http-method OPTIONS \
  --region ${REGION} > /dev/null 2>&1 || true

# MOCK統合を設定
aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${OUT_RESOURCE_ID} \
  --http-method OPTIONS \
  --type MOCK \
  --request-templates '{"application/json":"{\"statusCode\": 200}"}' \
  --region ${REGION} > /dev/null 2>&1 || echo "OPTIONS 統合は既に設定されています"

# /staff/inventory/in リソースが存在するか確認
IN_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/staff/inventory/in'].id" \
  --output text)

if [ -z "$IN_RESOURCE_ID" ]; then
  echo "[/staff/inventory/in] リソースを作成中..."
  IN_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --region ${REGION} \
    --parent-id ${INVENTORY_RESOURCE_ID} \
    --path-part "in" \
    --query "id" \
    --output text)
  echo "[/staff/inventory/in] リソースを作成しました: ${IN_RESOURCE_ID}"
else
  echo "[/staff/inventory/in] リソースは既に存在します: ${IN_RESOURCE_ID}"
fi

# POST メソッドを追加
echo "[/staff/inventory/in] POST メソッドを設定中..."
aws apigateway put-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${IN_RESOURCE_ID} \
  --http-method POST \
  --authorization-type NONE \
  --region ${REGION} > /dev/null 2>&1 || echo "POST メソッドは既に存在します"

aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${IN_RESOURCE_ID} \
  --http-method POST \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
  --region ${REGION} > /dev/null 2>&1 || echo "POST 統合は既に設定されています"

# OPTIONS メソッドを追加（CORS用 - MOCK統合）
echo "[/staff/inventory/in] OPTIONS メソッドを設定中..."
aws apigateway put-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${IN_RESOURCE_ID} \
  --http-method OPTIONS \
  --authorization-type NONE \
  --region ${REGION} > /dev/null 2>&1 || echo "OPTIONS メソッドは既に存在します"

# 既存の統合を削除（AWS_PROXYからMOCKに変更するため）
aws apigateway delete-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${IN_RESOURCE_ID} \
  --http-method OPTIONS \
  --region ${REGION} > /dev/null 2>&1 || true

# MOCK統合を設定
aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${IN_RESOURCE_ID} \
  --http-method OPTIONS \
  --type MOCK \
  --request-templates '{"application/json":"{\"statusCode\": 200}"}' \
  --region ${REGION} > /dev/null 2>&1 || echo "OPTIONS 統合は既に設定されています"

# /staff/inventory/transactions リソースが存在するか確認
TRANSACTIONS_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/staff/inventory/transactions'].id" \
  --output text)

if [ -z "$TRANSACTIONS_RESOURCE_ID" ]; then
  echo "[/staff/inventory/transactions] リソースを作成中..."
  TRANSACTIONS_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --region ${REGION} \
    --parent-id ${INVENTORY_RESOURCE_ID} \
    --path-part "transactions" \
    --query "id" \
    --output text)
  echo "[/staff/inventory/transactions] リソースを作成しました: ${TRANSACTIONS_RESOURCE_ID}"
else
  echo "[/staff/inventory/transactions] リソースは既に存在します: ${TRANSACTIONS_RESOURCE_ID}"
fi

# GET メソッドを追加
echo "[/staff/inventory/transactions] GET メソッドを設定中..."
aws apigateway put-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${TRANSACTIONS_RESOURCE_ID} \
  --http-method GET \
  --authorization-type NONE \
  --region ${REGION} > /dev/null 2>&1 || echo "GET メソッドは既に存在します"

aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${TRANSACTIONS_RESOURCE_ID} \
  --http-method GET \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
  --region ${REGION} > /dev/null 2>&1 || echo "GET 統合は既に設定されています"

# OPTIONS メソッドを追加（CORS用 - MOCK統合）
echo "[/staff/inventory/transactions] OPTIONS メソッドを設定中..."
aws apigateway put-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${TRANSACTIONS_RESOURCE_ID} \
  --http-method OPTIONS \
  --authorization-type NONE \
  --region ${REGION} > /dev/null 2>&1 || echo "OPTIONS メソッドは既に存在します"

# 既存の統合を削除（AWS_PROXYからMOCKに変更するため）
aws apigateway delete-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${TRANSACTIONS_RESOURCE_ID} \
  --http-method OPTIONS \
  --region ${REGION} > /dev/null 2>&1 || true

# MOCK統合を設定
aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${TRANSACTIONS_RESOURCE_ID} \
  --http-method OPTIONS \
  --type MOCK \
  --request-templates '{"application/json":"{\"statusCode\": 200}"}' \
  --region ${REGION} > /dev/null 2>&1 || echo "OPTIONS 統合は既に設定されています"

# /admin/inventory/transactions リソースが存在するか確認
ADMIN_INVENTORY_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/admin/inventory'].id" \
  --output text)

if [ -z "$ADMIN_INVENTORY_RESOURCE_ID" ]; then
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

  echo "[/admin/inventory] リソースを作成中..."
  ADMIN_INVENTORY_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --region ${REGION} \
    --parent-id ${ADMIN_RESOURCE_ID} \
    --path-part "inventory" \
    --query "id" \
    --output text)
  echo "[/admin/inventory] リソースを作成しました: ${ADMIN_INVENTORY_RESOURCE_ID}"
else
  echo "[/admin/inventory] リソースは既に存在します: ${ADMIN_INVENTORY_RESOURCE_ID}"
fi

ADMIN_TRANSACTIONS_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/admin/inventory/transactions'].id" \
  --output text)

if [ -z "$ADMIN_TRANSACTIONS_RESOURCE_ID" ]; then
  echo "[/admin/inventory/transactions] リソースを作成中..."
  ADMIN_TRANSACTIONS_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --region ${REGION} \
    --parent-id ${ADMIN_INVENTORY_RESOURCE_ID} \
    --path-part "transactions" \
    --query "id" \
    --output text)
  echo "[/admin/inventory/transactions] リソースを作成しました: ${ADMIN_TRANSACTIONS_RESOURCE_ID}"
else
  echo "[/admin/inventory/transactions] リソースは既に存在します: ${ADMIN_TRANSACTIONS_RESOURCE_ID}"
fi

# GET メソッドを追加
echo "[/admin/inventory/transactions] GET メソッドを設定中..."
aws apigateway put-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ADMIN_TRANSACTIONS_RESOURCE_ID} \
  --http-method GET \
  --authorization-type NONE \
  --region ${REGION} > /dev/null 2>&1 || echo "GET メソッドは既に存在します"

aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ADMIN_TRANSACTIONS_RESOURCE_ID} \
  --http-method GET \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
  --region ${REGION} > /dev/null 2>&1 || echo "GET 統合は既に設定されています"

# OPTIONS メソッドを追加（CORS用 - MOCK統合）
echo "[/admin/inventory/transactions] OPTIONS メソッドを設定中..."
aws apigateway put-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ADMIN_TRANSACTIONS_RESOURCE_ID} \
  --http-method OPTIONS \
  --authorization-type NONE \
  --region ${REGION} > /dev/null 2>&1 || echo "OPTIONS メソッドは既に存在します"

# 既存の統合を削除（AWS_PROXYからMOCKに変更するため）
aws apigateway delete-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ADMIN_TRANSACTIONS_RESOURCE_ID} \
  --http-method OPTIONS \
  --region ${REGION} > /dev/null 2>&1 || true

# MOCK統合を設定
aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ADMIN_TRANSACTIONS_RESOURCE_ID} \
  --http-method OPTIONS \
  --type MOCK \
  --request-templates '{"application/json":"{\"statusCode\": 200}"}' \
  --region ${REGION} > /dev/null 2>&1 || echo "OPTIONS 統合は既に設定されています"

# CORS統合レスポンスを設定
echo ""
echo "CORS統合レスポンスを設定中..."

# /staff/inventory/items のOPTIONSメソッドはLambdaプロキシ統合なので、CORS設定は不要（Lambda関数で処理）

# /staff/inventory/out のOPTIONSメソッドにCORS設定
aws apigateway put-method-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${OUT_RESOURCE_ID} \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters "method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false,method.response.header.Access-Control-Allow-Origin=false" \
  --region ${REGION} > /dev/null 2>&1 || true

aws apigateway put-integration-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${OUT_RESOURCE_ID} \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'POST,OPTIONS'"'"'","method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'"}' \
  --region ${REGION} > /dev/null 2>&1 || true

# /staff/inventory/in のOPTIONSメソッドにCORS設定
aws apigateway put-method-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${IN_RESOURCE_ID} \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters "method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false,method.response.header.Access-Control-Allow-Origin=false" \
  --region ${REGION} > /dev/null 2>&1 || true

aws apigateway put-integration-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${IN_RESOURCE_ID} \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'POST,OPTIONS'"'"'","method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'"}' \
  --region ${REGION} > /dev/null 2>&1 || true

# /staff/inventory/transactions のOPTIONSメソッドにCORS設定
aws apigateway put-method-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${TRANSACTIONS_RESOURCE_ID} \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters "method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false,method.response.header.Access-Control-Allow-Origin=false" \
  --region ${REGION} > /dev/null 2>&1 || true

aws apigateway put-integration-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${TRANSACTIONS_RESOURCE_ID} \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,OPTIONS'"'"'","method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'"}' \
  --region ${REGION} > /dev/null 2>&1 || true

# /admin/inventory/transactions のOPTIONSメソッドにCORS設定
aws apigateway put-method-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ADMIN_TRANSACTIONS_RESOURCE_ID} \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters "method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false,method.response.header.Access-Control-Allow-Origin=false" \
  --region ${REGION} > /dev/null 2>&1 || true

aws apigateway put-integration-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ADMIN_TRANSACTIONS_RESOURCE_ID} \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,OPTIONS'"'"'","method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'"}' \
  --region ${REGION} > /dev/null 2>&1 || true

# APIをデプロイ
echo ""
echo "APIをデプロイ中..."
aws apigateway create-deployment \
  --rest-api-id ${REST_API_ID} \
  --stage-name prod \
  --region ${REGION} > /dev/null

echo ""
echo "=== 在庫管理API Gateway設定完了 ==="
echo "設定されたリソース:"
echo "  - /staff/inventory/items (GET, POST, OPTIONS)"
echo "  - /staff/inventory/out (POST, OPTIONS)"
echo "  - /staff/inventory/in (POST, OPTIONS)"
echo "  - /staff/inventory/transactions (GET, OPTIONS)"
echo "  - /admin/inventory/transactions (GET, OPTIONS)"
echo ""
echo "✅ API Gatewayの設定が完了しました"

