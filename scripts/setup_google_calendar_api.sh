#!/bin/bash
# Google Calendar API Gateway設定スクリプト

set -e

REST_API_ID="51bhoxkbxd"
REGION="ap-northeast-1"
LAMBDA_FUNCTION_NAME="misesapo-s3-upload"
LAMBDA_ARN="arn:aws:lambda:${REGION}:475462779604:function:${LAMBDA_FUNCTION_NAME}"
ACCOUNT_ID="475462779604"

echo "=== Google Calendar API Gateway設定を開始 ==="

# ルートリソースIDを取得
ROOT_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/'].id" \
  --output text)

echo "ルートリソースID: ${ROOT_RESOURCE_ID}"

# /google-calendar リソースが存在するか確認
GOOGLE_CALENDAR_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/google-calendar'].id" \
  --output text)

if [ -z "$GOOGLE_CALENDAR_RESOURCE_ID" ]; then
  echo "[/google-calendar] リソースを作成中..."
  GOOGLE_CALENDAR_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --region ${REGION} \
    --parent-id ${ROOT_RESOURCE_ID} \
    --path-part "google-calendar" \
    --query "id" \
    --output text)
  echo "[/google-calendar] リソースを作成しました: ${GOOGLE_CALENDAR_RESOURCE_ID}"
else
  echo "[/google-calendar] リソースは既に存在します: ${GOOGLE_CALENDAR_RESOURCE_ID}"
fi

# /google-calendar/events リソースが存在するか確認
EVENTS_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/google-calendar/events'].id" \
  --output text)

if [ -z "$EVENTS_RESOURCE_ID" ]; then
  echo "[/google-calendar/events] リソースを作成中..."
  EVENTS_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --region ${REGION} \
    --parent-id ${GOOGLE_CALENDAR_RESOURCE_ID} \
    --path-part "events" \
    --query "id" \
    --output text)
  echo "[/google-calendar/events] リソースを作成しました: ${EVENTS_RESOURCE_ID}"
else
  echo "[/google-calendar/events] リソースは既に存在します: ${EVENTS_RESOURCE_ID}"
fi

# /google-calendar/events/{event_id} リソースが存在するか確認
EVENT_ID_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/google-calendar/events/{event_id}'].id" \
  --output text)

if [ -z "$EVENT_ID_RESOURCE_ID" ]; then
  echo "[/google-calendar/events/{event_id}] リソースを作成中..."
  EVENT_ID_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --region ${REGION} \
    --parent-id ${EVENTS_RESOURCE_ID} \
    --path-part "{event_id}" \
    --query "id" \
    --output text)
  echo "[/google-calendar/events/{event_id}] リソースを作成しました: ${EVENT_ID_RESOURCE_ID}"
else
  echo "[/google-calendar/events/{event_id}] リソースは既に存在します: ${EVENT_ID_RESOURCE_ID}"
fi

# GET /google-calendar/events メソッドを設定
echo "[/google-calendar/events] GETメソッドを設定中..."
aws apigateway put-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${EVENTS_RESOURCE_ID} \
  --http-method GET \
  --authorization-type NONE \
  --region ${REGION} > /dev/null 2>&1 || echo "メソッドは既に存在します"

aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${EVENTS_RESOURCE_ID} \
  --http-method GET \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
  --region ${REGION} > /dev/null 2>&1 || echo "統合は既に存在します"

# OPTIONS /google-calendar/events メソッドを設定（CORS用）
echo "[/google-calendar/events] OPTIONSメソッドを設定中..."
aws apigateway put-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${EVENTS_RESOURCE_ID} \
  --http-method OPTIONS \
  --authorization-type NONE \
  --region ${REGION} > /dev/null 2>&1 || echo "OPTIONSメソッドは既に存在します"

aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${EVENTS_RESOURCE_ID} \
  --http-method OPTIONS \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
  --region ${REGION} > /dev/null 2>&1 || echo "OPTIONS統合は既に存在します"

# GET /google-calendar/events/{event_id} メソッドを設定
echo "[/google-calendar/events/{event_id}] GETメソッドを設定中..."
aws apigateway put-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${EVENT_ID_RESOURCE_ID} \
  --http-method GET \
  --authorization-type NONE \
  --region ${REGION} > /dev/null 2>&1 || echo "メソッドは既に存在します"

aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${EVENT_ID_RESOURCE_ID} \
  --http-method GET \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
  --region ${REGION} > /dev/null 2>&1 || echo "統合は既に存在します"

# OPTIONS /google-calendar/events/{event_id} メソッドを設定（CORS用）
echo "[/google-calendar/events/{event_id}] OPTIONSメソッドを設定中..."
aws apigateway put-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${EVENT_ID_RESOURCE_ID} \
  --http-method OPTIONS \
  --authorization-type NONE \
  --region ${REGION} > /dev/null 2>&1 || echo "OPTIONSメソッドは既に存在します"

aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${EVENT_ID_RESOURCE_ID} \
  --http-method OPTIONS \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
  --region ${REGION} > /dev/null 2>&1 || echo "OPTIONS統合は既に存在します"

# Lambda関数にAPI Gatewayの実行権限を付与
echo "Lambda関数にAPI Gatewayの実行権限を付与中..."
for METHOD in GET OPTIONS; do
  METHOD_LOWER=$(echo ${METHOD} | tr '[:upper:]' '[:lower:]')
  aws lambda add-permission \
    --function-name ${LAMBDA_FUNCTION_NAME} \
    --statement-id "apigateway-${METHOD_LOWER}-google-calendar-events-$(date +%s)-${RANDOM}" \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${REST_API_ID}/*/${METHOD}/google-calendar/events" \
    --region ${REGION} 2>/dev/null || echo "権限は既に存在するか、エラーが発生しました（続行します）"
done

# /google-calendar/events/{event_id} エンドポイントの権限を付与
for METHOD in GET OPTIONS; do
  METHOD_LOWER=$(echo ${METHOD} | tr '[:upper:]' '[:lower:]')
  aws lambda add-permission \
    --function-name ${LAMBDA_FUNCTION_NAME} \
    --statement-id "apigateway-${METHOD_LOWER}-google-calendar-event-id-$(date +%s)-${RANDOM}" \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${REST_API_ID}/*/${METHOD}/google-calendar/events/*" \
    --region ${REGION} 2>/dev/null || echo "権限は既に存在するか、エラーが発生しました（続行します）"
done

# /google-calendar/sync リソースが存在するか確認
SYNC_RESOURCE_ID=$(aws apigateway get-resources \
  --rest-api-id ${REST_API_ID} \
  --region ${REGION} \
  --query "items[?path=='/google-calendar/sync'].id" \
  --output text)

if [ -z "$SYNC_RESOURCE_ID" ]; then
  echo "[/google-calendar/sync] リソースを作成中..."
  SYNC_RESOURCE_ID=$(aws apigateway create-resource \
    --rest-api-id ${REST_API_ID} \
    --region ${REGION} \
    --parent-id ${GOOGLE_CALENDAR_RESOURCE_ID} \
    --path-part "sync" \
    --query "id" \
    --output text)
  echo "[/google-calendar/sync] リソースを作成しました: ${SYNC_RESOURCE_ID}"
else
  echo "[/google-calendar/sync] リソースは既に存在します: ${SYNC_RESOURCE_ID}"
fi

# POST /google-calendar/sync メソッドを設定
echo "[/google-calendar/sync] POSTメソッドを設定中..."
aws apigateway put-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${SYNC_RESOURCE_ID} \
  --http-method POST \
  --authorization-type NONE \
  --region ${REGION} > /dev/null 2>&1 || echo "メソッドは既に存在します"

aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${SYNC_RESOURCE_ID} \
  --http-method POST \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
  --region ${REGION} > /dev/null 2>&1 || echo "統合は既に存在します"

# OPTIONS /google-calendar/sync メソッドを設定（CORS用）
echo "[/google-calendar/sync] OPTIONSメソッドを設定中..."
aws apigateway put-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${SYNC_RESOURCE_ID} \
  --http-method OPTIONS \
  --authorization-type NONE \
  --region ${REGION} > /dev/null 2>&1 || echo "OPTIONSメソッドは既に存在します"

aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${SYNC_RESOURCE_ID} \
  --http-method OPTIONS \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${LAMBDA_ARN}/invocations" \
  --region ${REGION} > /dev/null 2>&1 || echo "OPTIONS統合は既に存在します"

# /google-calendar/sync エンドポイントの権限を付与
for METHOD in POST OPTIONS; do
  METHOD_LOWER=$(echo ${METHOD} | tr '[:upper:]' '[:lower:]')
  aws lambda add-permission \
    --function-name ${LAMBDA_FUNCTION_NAME} \
    --statement-id "apigateway-${METHOD_LOWER}-google-calendar-sync-$(date +%s)-${RANDOM}" \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${REST_API_ID}/*/${METHOD}/google-calendar/sync" \
    --region ${REGION} 2>/dev/null || echo "権限は既に存在するか、エラーが発生しました（続行します）"
done
echo ""

# API Gatewayをデプロイ
echo "API Gatewayをデプロイ中..."
DEPLOYMENT_ID=$(aws apigateway create-deployment \
  --rest-api-id ${REST_API_ID} \
  --stage-name prod \
  --region ${REGION} \
  --query "id" \
  --output text)

echo "デプロイID: ${DEPLOYMENT_ID}"
echo ""

echo "=========================================="
echo "セットアップ完了！"
echo "=========================================="
echo ""
echo "エンドポイントURL:"
echo "  GET:  https://${REST_API_ID}.execute-api.${REGION}.amazonaws.com/prod/google-calendar/events"
echo "  GET:  https://${REST_API_ID}.execute-api.${REGION}.amazonaws.com/prod/google-calendar/events/{event_id}"
echo "  POST: https://${REST_API_ID}.execute-api.${REGION}.amazonaws.com/prod/google-calendar/sync"
echo ""
echo "使用例:"
echo "  # イベント一覧を取得（今日から30日後まで）"
echo "  curl 'https://${REST_API_ID}.execute-api.${REGION}.amazonaws.com/prod/google-calendar/events'"
echo ""
echo "  # 特定の日付範囲でイベントを取得"
echo "  curl 'https://${REST_API_ID}.execute-api.${REGION}.amazonaws.com/prod/google-calendar/events?start_date=2025-01-15T00:00:00%2B09:00&end_date=2025-01-15T23:59:59%2B09:00'"
echo ""
echo "  # 特定のイベントを取得"
echo "  curl 'https://${REST_API_ID}.execute-api.${REGION}.amazonaws.com/prod/google-calendar/events/EVENT_ID'"
echo ""
echo "  # Googleカレンダーからイベントを取得してDynamoDBに同期"
echo "  curl -X POST 'https://${REST_API_ID}.execute-api.${REGION}.amazonaws.com/prod/google-calendar/sync'"
echo ""
echo "  # 特定の日付範囲でイベントを同期"
echo "  curl -X POST 'https://${REST_API_ID}.execute-api.${REGION}.amazonaws.com/prod/google-calendar/sync?start_date=2025-01-15T00:00:00%2B09:00&end_date=2025-01-15T23:59:59%2B09:00'"
echo ""
echo "  # 特定のイベントを同期"
echo "  curl -X POST 'https://${REST_API_ID}.execute-api.${REGION}.amazonaws.com/prod/google-calendar/sync?event_id=EVENT_ID'"

