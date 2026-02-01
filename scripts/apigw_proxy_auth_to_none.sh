#!/bin/bash
# API Gateway: /{proxy+}（ANY）, /work-report, /upload 等の各メソッドの認証を AWS_IAM → NONE に変更し、prod にデプロイ
# 目的: api-wr/work-report や api-wr/upload-url の 403（Invalid key=value / IncompleteSignatureException）を解消
# フロントは Cognito Bearer トークンを送るため、API Gateway は NONE にして Lambda 側で検証する
# 実行: ./scripts/apigw_proxy_auth_to_none.sh [API_ID]
# 例:   ./scripts/apigw_proxy_auth_to_none.sh
#       ./scripts/apigw_proxy_auth_to_none.sh 51bhoxkbxd

set -e
API_ID="${1:-51bhoxkbxd}"
REGION="ap-northeast-1"
STAGE="prod"
# 認証を NONE にしたいリソースの path（/{proxy+} がある API では ANY が AWS_IAM だと 403 になるため含める）
TARGET_PATHS="/{proxy+} /work-report /upload /upload-url /upload-put"

echo "=============================================="
echo "API Gateway: work-report / upload 認証を NONE に統一"
echo "API ID: $API_ID  Region: $REGION  Stage: $STAGE"
echo "=============================================="

RESOURCES_JSON=$(aws apigateway get-resources \
  --rest-api-id "$API_ID" \
  --region "$REGION" \
  --output json)

# 対象 path のリソース ID を取得
UPDATED=0
for TARGET_PATH in $TARGET_PATHS; do
  RID=$(echo "$RESOURCES_JSON" | jq -r --arg p "$TARGET_PATH" '.items[] | select(.path == $p) | .id')
  if [ -z "$RID" ] || [ "$RID" = "null" ]; then
    echo "  スキップ: $TARGET_PATH (リソースなし)"
    continue
  fi
  # このリソースに紐づくメソッド一覧（resourceMethods のキー）
  METHODS=$(echo "$RESOURCES_JSON" | jq -r --arg id "$RID" '.items[] | select(.id == $id) | .resourceMethods // {} | keys[]')
  if [ -z "$METHODS" ]; then
    echo "  スキップ: $TARGET_PATH (id: $RID) — メソッドなし"
    continue
  fi
  echo "  対象: $TARGET_PATH (id: $RID) メソッド: $METHODS"
  for HTTP_METHOD in $METHODS; do
    AUTH=$(aws apigateway get-method \
      --rest-api-id "$API_ID" \
      --resource-id "$RID" \
      --http-method "$HTTP_METHOD" \
      --region "$REGION" \
      --query "authorizationType" \
      --output text 2>/dev/null) || AUTH=""
    if [ -z "$AUTH" ]; then
      echo "    $HTTP_METHOD: 取得失敗（スキップ）"
      continue
    fi
    if [ "$AUTH" = "NONE" ]; then
      echo "    $HTTP_METHOD: すでに NONE"
      continue
    fi
    echo "    $HTTP_METHOD: $AUTH → NONE に変更..."
    # update-method の patch は replace のみ有効（remove は不可）
    aws apigateway update-method \
      --rest-api-id "$API_ID" \
      --resource-id "$RID" \
      --http-method "$HTTP_METHOD" \
      --patch-operations "op=replace,path=/authorizationType,value=NONE" \
      --region "$REGION"
    echo "    $HTTP_METHOD: 更新しました"
    UPDATED=$((UPDATED + 1))
  done
done

# /work-report/{id} がある場合も対象にする（path が /work-report/ で始まる子リソース）
WORK_REPORT_ID=$(echo "$RESOURCES_JSON" | jq -r '.items[] | select(.path == "/work-report") | .id')
if [ -n "$WORK_REPORT_ID" ] && [ "$WORK_REPORT_ID" != "null" ]; then
  # path が /work-report/ で始まり /work-report 自身でないもの（例: /work-report/{id}）
  CHILD_IDS=$(echo "$RESOURCES_JSON" | jq -r '.items[] | select(.path | startswith("/work-report/") and (. != "/work-report")) | .id')
  for RID in $CHILD_IDS; do
    [ -z "$RID" ] || [ "$RID" = "null" ] && continue
    PATH_VAL=$(echo "$RESOURCES_JSON" | jq -r --arg id "$RID" '.items[] | select(.id == $id) | .path')
    METHODS=$(echo "$RESOURCES_JSON" | jq -r --arg id "$RID" '.items[] | select(.id == $id) | .resourceMethods // {} | keys[]')
    [ -z "$METHODS" ] && continue
    echo "  対象: $PATH_VAL (id: $RID) メソッド: $METHODS"
    for HTTP_METHOD in $METHODS; do
      AUTH=$(aws apigateway get-method --rest-api-id "$API_ID" --resource-id "$RID" --http-method "$HTTP_METHOD" --region "$REGION" --query "authorizationType" --output text 2>/dev/null) || AUTH=""
      [ -z "$AUTH" ] && continue
      if [ "$AUTH" = "NONE" ]; then echo "    $HTTP_METHOD: すでに NONE"; continue; fi
      echo "    $HTTP_METHOD: $AUTH → NONE に変更..."
      aws apigateway update-method --rest-api-id "$API_ID" --resource-id "$RID" --http-method "$HTTP_METHOD" \
        --patch-operations "op=replace,path=/authorizationType,value=NONE" --region "$REGION"
      echo "    $HTTP_METHOD: 更新しました"
      UPDATED=$((UPDATED + 1))
    done
  done
fi

echo ""
echo "=== API を ${STAGE} にデプロイ ==="
DEPLOYMENT_ID=$(aws apigateway create-deployment \
  --rest-api-id "$API_ID" \
  --region "$REGION" \
  --stage-name "$STAGE" \
  --description "work-report/upload auth NONE (apigw_proxy_auth_to_none.sh)" \
  --query "id" \
  --output text)
echo "  Deployment ID: $DEPLOYMENT_ID"

echo ""
echo "=============================================="
echo "✅ 完了（${UPDATED} メソッドを NONE に更新）。ブラウザで PATCH /work-report/{id} や POST /upload-url を再試行し、403 解消を確認してください。"
echo "   詳細: docs/spec/403_UPLOAD_AND_WORK_REPORT.md"
echo "=============================================="
