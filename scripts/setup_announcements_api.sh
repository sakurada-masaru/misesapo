#!/bin/bash
# 業務連絡API Gateway設定スクリプト

set -e

REST_API_ID="2z0ui5xfxb"
REGION="ap-northeast-1"
LAMBDA_FUNCTION_NAME="misesapo-s3-upload"
LAMBDA_ARN="arn:aws:lambda:${REGION}:475462779604:function:${LAMBDA_FUNCTION_NAME}"

echo "=== 業務連絡API Gateway設定を開始 ==="

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

# /staff/announcements リソースが存在するか確認
ANNOUNCEMENTS_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/staff/announcements'].id" \
  --output text)

if [ -z "$ANNOUNCEMENTS_RESOURCE_ID" ]; then
  echo "[/staff/announcements] リソースを作成中..."
  ANNOUNCEMENTS_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --region ${REGION} \
    --parent-id ${STAFF_RESOURCE_ID} \
    --path-part "announcements" \
    --query "id" \
    --output text)
  echo "[/staff/announcements] リソースを作成しました: ${ANNOUNCEMENTS_RESOURCE_ID}"
else
  echo "[/staff/announcements] リソースは既に存在します: ${ANNOUNCEMENTS_RESOURCE_ID}"
fi

# /staff/announcements/{id} リソースが存在するか確認
ANNOUNCEMENT_ID_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/staff/announcements/{id}'].id" \
  --output text)

if [ -z "$ANNOUNCEMENT_ID_RESOURCE_ID" ]; then
  echo "[/staff/announcements/{id}] リソースを作成中..."
  ANNOUNCEMENT_ID_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --region ${REGION} \
    --parent-id ${ANNOUNCEMENTS_RESOURCE_ID} \
    --path-part "{id}" \
    --query "id" \
    --output text)
  echo "[/staff/announcements/{id}] リソースを作成しました: ${ANNOUNCEMENT_ID_RESOURCE_ID}"
else
  echo "[/staff/announcements/{id}] リソースは既に存在します: ${ANNOUNCEMENT_ID_RESOURCE_ID}"
fi

# /staff/announcements/{id}/read リソースが存在するか確認
ANNOUNCEMENT_READ_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/staff/announcements/{id}/read'].id" \
  --output text)

if [ -z "$ANNOUNCEMENT_READ_RESOURCE_ID" ]; then
  echo "[/staff/announcements/{id}/read] リソースを作成中..."
  ANNOUNCEMENT_READ_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --region ${REGION} \
    --parent-id ${ANNOUNCEMENT_ID_RESOURCE_ID} \
    --path-part "read" \
    --query "id" \
    --output text)
  echo "[/staff/announcements/{id}/read] リソースを作成しました: ${ANNOUNCEMENT_READ_RESOURCE_ID}"
else
  echo "[/staff/announcements/{id}/read] リソースは既に存在します: ${ANNOUNCEMENT_READ_RESOURCE_ID}"
fi

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

# /admin/announcements リソースが存在するか確認
ADMIN_ANNOUNCEMENTS_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/admin/announcements'].id" \
  --output text)

if [ -z "$ADMIN_ANNOUNCEMENTS_RESOURCE_ID" ]; then
  echo "[/admin/announcements] リソースを作成中..."
  ADMIN_ANNOUNCEMENTS_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --region ${REGION} \
    --parent-id ${ADMIN_RESOURCE_ID} \
    --path-part "announcements" \
    --query "id" \
    --output text)
  echo "[/admin/announcements] リソースを作成しました: ${ADMIN_ANNOUNCEMENTS_RESOURCE_ID}"
else
  echo "[/admin/announcements] リソースは既に存在します: ${ADMIN_ANNOUNCEMENTS_RESOURCE_ID}"
fi

# /admin/announcements/{id} リソースが存在するか確認
ADMIN_ANNOUNCEMENT_ID_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/admin/announcements/{id}'].id" \
  --output text)

if [ -z "$ADMIN_ANNOUNCEMENT_ID_RESOURCE_ID" ]; then
  echo "[/admin/announcements/{id}] リソースを作成中..."
  ADMIN_ANNOUNCEMENT_ID_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --region ${REGION} \
    --parent-id ${ADMIN_ANNOUNCEMENTS_RESOURCE_ID} \
    --path-part "{id}" \
    --query "id" \
    --output text)
  echo "[/admin/announcements/{id}] リソースを作成しました: ${ADMIN_ANNOUNCEMENT_ID_RESOURCE_ID}"
else
  echo "[/admin/announcements/{id}] リソースは既に存在します: ${ADMIN_ANNOUNCEMENT_ID_RESOURCE_ID}"
fi

# GET /staff/announcements メソッドを作成
echo "GET /staff/announcements メソッドを作成中..."
aws apigateway put-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ANNOUNCEMENTS_RESOURCE_ID} \
  --http-method GET \
  --authorization-type NONE \
  --region ${REGION} &>/dev/null || echo "メソッドは既に存在します"

aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ANNOUNCEMENTS_RESOURCE_ID} \
  --http-method GET \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
  --region ${REGION} &>/dev/null || echo "統合は既に存在します"

# OPTIONS /staff/announcements メソッドを作成（CORS用）
echo "OPTIONS /staff/announcements メソッドを作成中..."
aws apigateway put-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ANNOUNCEMENTS_RESOURCE_ID} \
  --http-method OPTIONS \
  --authorization-type NONE \
  --region ${REGION} &>/dev/null || echo "OPTIONSメソッドは既に存在します"

aws apigateway delete-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ANNOUNCEMENTS_RESOURCE_ID} \
  --http-method OPTIONS \
  --region ${REGION} &>/dev/null || true

aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ANNOUNCEMENTS_RESOURCE_ID} \
  --http-method OPTIONS \
  --type MOCK \
  --request-templates '{"application/json":"{\"statusCode\": 200}"}' \
  --region ${REGION} &>/dev/null || echo "OPTIONS統合は既に存在します"

aws apigateway put-method-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ANNOUNCEMENTS_RESOURCE_ID} \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters "method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false,method.response.header.Access-Control-Allow-Origin=false" \
  --region ${REGION} &>/dev/null || echo "OPTIONSメソッドレスポンスは既に存在します"

aws apigateway put-integration-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ANNOUNCEMENTS_RESOURCE_ID} \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,PUT,POST,DELETE,OPTIONS'"'"'","method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'"}' \
  --region ${REGION} &>/dev/null || echo "OPTIONS統合レスポンスは既に存在します"

# POST /staff/announcements/{id}/read メソッドを作成
echo "POST /staff/announcements/{id}/read メソッドを作成中..."
aws apigateway put-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ANNOUNCEMENT_READ_RESOURCE_ID} \
  --http-method POST \
  --authorization-type NONE \
  --region ${REGION} &>/dev/null || echo "メソッドは既に存在します"

aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ANNOUNCEMENT_READ_RESOURCE_ID} \
  --http-method POST \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
  --region ${REGION} &>/dev/null || echo "統合は既に存在します"

# OPTIONS /staff/announcements/{id}/read メソッドを作成（CORS用）
echo "OPTIONS /staff/announcements/{id}/read メソッドを作成中..."
aws apigateway put-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ANNOUNCEMENT_READ_RESOURCE_ID} \
  --http-method OPTIONS \
  --authorization-type NONE \
  --region ${REGION} &>/dev/null || echo "OPTIONSメソッドは既に存在します"

aws apigateway delete-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ANNOUNCEMENT_READ_RESOURCE_ID} \
  --http-method OPTIONS \
  --region ${REGION} &>/dev/null || true

aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ANNOUNCEMENT_READ_RESOURCE_ID} \
  --http-method OPTIONS \
  --type MOCK \
  --request-templates '{"application/json":"{\"statusCode\": 200}"}' \
  --region ${REGION} &>/dev/null || echo "OPTIONS統合は既に存在します"

aws apigateway put-method-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ANNOUNCEMENT_READ_RESOURCE_ID} \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters "method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false,method.response.header.Access-Control-Allow-Origin=false" \
  --region ${REGION} &>/dev/null || echo "OPTIONSメソッドレスポンスは既に存在します"

aws apigateway put-integration-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ANNOUNCEMENT_READ_RESOURCE_ID} \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,PUT,POST,DELETE,OPTIONS'"'"'","method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'"}' \
  --region ${REGION} &>/dev/null || echo "OPTIONS統合レスポンスは既に存在します"

# GET /admin/announcements メソッドを作成
echo "GET /admin/announcements メソッドを作成中..."
aws apigateway put-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ADMIN_ANNOUNCEMENTS_RESOURCE_ID} \
  --http-method GET \
  --authorization-type NONE \
  --region ${REGION} &>/dev/null || echo "メソッドは既に存在します"

aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ADMIN_ANNOUNCEMENTS_RESOURCE_ID} \
  --http-method GET \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
  --region ${REGION} &>/dev/null || echo "統合は既に存在します"

# POST /admin/announcements メソッドを作成
echo "POST /admin/announcements メソッドを作成中..."
aws apigateway put-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ADMIN_ANNOUNCEMENTS_RESOURCE_ID} \
  --http-method POST \
  --authorization-type NONE \
  --region ${REGION} &>/dev/null || echo "メソッドは既に存在します"

aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ADMIN_ANNOUNCEMENTS_RESOURCE_ID} \
  --http-method POST \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
  --region ${REGION} &>/dev/null || echo "統合は既に存在します"

# OPTIONS /admin/announcements メソッドを作成（CORS用）
echo "OPTIONS /admin/announcements メソッドを作成中..."
aws apigateway put-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ADMIN_ANNOUNCEMENTS_RESOURCE_ID} \
  --http-method OPTIONS \
  --authorization-type NONE \
  --region ${REGION} &>/dev/null || echo "OPTIONSメソッドは既に存在します"

aws apigateway delete-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ADMIN_ANNOUNCEMENTS_RESOURCE_ID} \
  --http-method OPTIONS \
  --region ${REGION} &>/dev/null || true

aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ADMIN_ANNOUNCEMENTS_RESOURCE_ID} \
  --http-method OPTIONS \
  --type MOCK \
  --request-templates '{"application/json":"{\"statusCode\": 200}"}' \
  --region ${REGION} &>/dev/null || echo "OPTIONS統合は既に存在します"

aws apigateway put-method-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ADMIN_ANNOUNCEMENTS_RESOURCE_ID} \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters "method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false,method.response.header.Access-Control-Allow-Origin=false" \
  --region ${REGION} &>/dev/null || echo "OPTIONSメソッドレスポンスは既に存在します"

aws apigateway put-integration-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ADMIN_ANNOUNCEMENTS_RESOURCE_ID} \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,PUT,POST,DELETE,OPTIONS'"'"'","method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'"}' \
  --region ${REGION} &>/dev/null || echo "OPTIONS統合レスポンスは既に存在します"

# GET /admin/announcements/{id} メソッドを作成
echo "GET /admin/announcements/{id} メソッドを作成中..."
aws apigateway put-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ADMIN_ANNOUNCEMENT_ID_RESOURCE_ID} \
  --http-method GET \
  --authorization-type NONE \
  --region ${REGION} &>/dev/null || echo "メソッドは既に存在します"

aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ADMIN_ANNOUNCEMENT_ID_RESOURCE_ID} \
  --http-method GET \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
  --region ${REGION} &>/dev/null || echo "統合は既に存在します"

# PUT /admin/announcements/{id} メソッドを作成
echo "PUT /admin/announcements/{id} メソッドを作成中..."
aws apigateway put-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ADMIN_ANNOUNCEMENT_ID_RESOURCE_ID} \
  --http-method PUT \
  --authorization-type NONE \
  --region ${REGION} &>/dev/null || echo "メソッドは既に存在します"

aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ADMIN_ANNOUNCEMENT_ID_RESOURCE_ID} \
  --http-method PUT \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
  --region ${REGION} &>/dev/null || echo "統合は既に存在します"

# DELETE /admin/announcements/{id} メソッドを作成
echo "DELETE /admin/announcements/{id} メソッドを作成中..."
aws apigateway put-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ADMIN_ANNOUNCEMENT_ID_RESOURCE_ID} \
  --http-method DELETE \
  --authorization-type NONE \
  --region ${REGION} &>/dev/null || echo "メソッドは既に存在します"

aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ADMIN_ANNOUNCEMENT_ID_RESOURCE_ID} \
  --http-method DELETE \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
  --region ${REGION} &>/dev/null || echo "統合は既に存在します"

# OPTIONS /admin/announcements/{id} メソッドを作成（CORS用）
echo "OPTIONS /admin/announcements/{id} メソッドを作成中..."
aws apigateway put-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ADMIN_ANNOUNCEMENT_ID_RESOURCE_ID} \
  --http-method OPTIONS \
  --authorization-type NONE \
  --region ${REGION} &>/dev/null || echo "OPTIONSメソッドは既に存在します"

aws apigateway delete-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ADMIN_ANNOUNCEMENT_ID_RESOURCE_ID} \
  --http-method OPTIONS \
  --region ${REGION} &>/dev/null || true

aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ADMIN_ANNOUNCEMENT_ID_RESOURCE_ID} \
  --http-method OPTIONS \
  --type MOCK \
  --request-templates '{"application/json":"{\"statusCode\": 200}"}' \
  --region ${REGION} &>/dev/null || echo "OPTIONS統合は既に存在します"

aws apigateway put-method-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ADMIN_ANNOUNCEMENT_ID_RESOURCE_ID} \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters "method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false,method.response.header.Access-Control-Allow-Origin=false" \
  --region ${REGION} &>/dev/null || echo "OPTIONSメソッドレスポンスは既に存在します"

aws apigateway put-integration-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${ADMIN_ANNOUNCEMENT_ID_RESOURCE_ID} \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'GET,PUT,POST,DELETE,OPTIONS'"'"'","method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'"}' \
  --region ${REGION} &>/dev/null || echo "OPTIONS統合レスポンスは既に存在します"

# Lambda関数にAPI Gatewayからの呼び出し権限を付与
echo "Lambda関数にAPI Gatewayからの呼び出し権限を付与中..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# GET /staff/announcements
aws lambda add-permission \
  --function-name ${LAMBDA_FUNCTION_NAME} \
  --statement-id "apigateway-announcements-get-staff-$(date +%s)" \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${REST_API_ID}/*/GET/staff/announcements" \
  --region ${REGION} &>/dev/null || echo "権限は既に存在します"

# POST /staff/announcements/{id}/read
aws lambda add-permission \
  --function-name ${LAMBDA_FUNCTION_NAME} \
  --statement-id "apigateway-announcements-post-read-$(date +%s)" \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${REST_API_ID}/*/POST/staff/announcements/*/read" \
  --region ${REGION} &>/dev/null || echo "権限は既に存在します"

# GET /admin/announcements
aws lambda add-permission \
  --function-name ${LAMBDA_FUNCTION_NAME} \
  --statement-id "apigateway-announcements-get-admin-$(date +%s)" \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${REST_API_ID}/*/GET/admin/announcements" \
  --region ${REGION} &>/dev/null || echo "権限は既に存在します"

# POST /admin/announcements
aws lambda add-permission \
  --function-name ${LAMBDA_FUNCTION_NAME} \
  --statement-id "apigateway-announcements-post-admin-$(date +%s)" \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${REST_API_ID}/*/POST/admin/announcements" \
  --region ${REGION} &>/dev/null || echo "権限は既に存在します"

# GET /admin/announcements/{id}
aws lambda add-permission \
  --function-name ${LAMBDA_FUNCTION_NAME} \
  --statement-id "apigateway-announcements-get-admin-id-$(date +%s)" \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${REST_API_ID}/*/GET/admin/announcements/*" \
  --region ${REGION} &>/dev/null || echo "権限は既に存在します"

# PUT /admin/announcements/{id}
aws lambda add-permission \
  --function-name ${LAMBDA_FUNCTION_NAME} \
  --statement-id "apigateway-announcements-put-admin-id-$(date +%s)" \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${REST_API_ID}/*/PUT/admin/announcements/*" \
  --region ${REGION} &>/dev/null || echo "権限は既に存在します"

# DELETE /admin/announcements/{id}
aws lambda add-permission \
  --function-name ${LAMBDA_FUNCTION_NAME} \
  --statement-id "apigateway-announcements-delete-admin-id-$(date +%s)" \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${REST_API_ID}/*/DELETE/admin/announcements/*" \
  --region ${REGION} &>/dev/null || echo "権限は既に存在します"

# API Gatewayをデプロイ
echo "API Gatewayをデプロイ中..."
aws apigateway create-deployment \
  --rest-api-id ${REST_API_ID} \
  --stage-name prod \
  --region ${REGION} &>/dev/null || echo "デプロイは既に実行済みです"

echo ""
echo "=== 業務連絡API Gateway設定完了 ==="
echo "作成されたエンドポイント:"
echo "  - GET  /staff/announcements"
echo "  - POST /staff/announcements/{id}/read"
echo "  - GET  /admin/announcements"
echo "  - POST /admin/announcements"
echo "  - GET  /admin/announcements/{id}"
echo "  - PUT  /admin/announcements/{id}"
echo "  - DELETE /admin/announcements/{id}"

