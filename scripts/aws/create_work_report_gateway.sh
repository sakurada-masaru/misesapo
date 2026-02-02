#!/bin/bash
# 業務報告専用 API Gateway を新規作成（misesapo-work-report）
# 作成後、setup_work_report_api_full.sh で /work-report・/upload-url・/upload-put を追加し、
# docs/spec/WORK_REPORT_GATEWAY_URL.txt に invoke URL を書き出す。
# 実行: ./scripts/aws/create_work_report_gateway.sh
# 仕様: docs/spec/WORK_REPORT_API_SPEC.md

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
REGION="ap-northeast-1"
STAGE="prod"

echo "=============================================="
echo "業務報告専用 API Gateway を新規作成"
echo "=============================================="

# 新規 REST API 作成
API_JSON=$(aws apigateway create-rest-api \
  --name "misesapo-work-report" \
  --description "業務報告専用（work-report, upload-url, upload-put）" \
  --region "$REGION" \
  --endpoint-configuration types=REGIONAL \
  --output json)
REST_API_ID=$(echo "$API_JSON" | jq -r '.id')
echo "  作成した API ID: $REST_API_ID"

# prod ステージを作成（空のデプロイ）
ROOT_ID=$(aws apigateway get-resources --rest-api-id "$REST_API_ID" --region "$REGION" --output json | jq -r '.items[] | select(.path == "/") | .id')
aws apigateway create-deployment \
  --rest-api-id "$REST_API_ID" \
  --region "$REGION" \
  --stage-name "$STAGE" \
  --description "Initial empty deployment" \
  --output json > /dev/null
echo "  ステージ: $STAGE"

# work-report 系リソースを一括追加（専用 Lambda misesapo-work-reports に紐づけ）
echo ""
echo ">>> /work-report・/upload-url・/upload-put・/work-report/{id} を追加（Lambda: misesapo-work-reports）..."
"$SCRIPT_DIR/setup_work_report_api_full.sh" "$REST_API_ID" "misesapo-work-reports"
echo ""

# invoke URL をファイルに書き出し
GATEWAY_URL="https://${REST_API_ID}.execute-api.${REGION}.amazonaws.com/${STAGE}"
URL_FILE="$REPO_ROOT/docs/spec/WORK_REPORT_GATEWAY_URL.txt"
echo "$GATEWAY_URL" > "$URL_FILE"
echo "  $URL_FILE に URL を書き出しました: $GATEWAY_URL"

echo ""
echo "=============================================="
echo "✅ 業務報告専用 API Gateway の作成が完了しました"
echo "   API ID: $REST_API_ID"
echo "   URL: $GATEWAY_URL"
echo "   認証 NONE に統一: ./scripts/apigw_proxy_auth_to_none.sh $REST_API_ID"
echo "=============================================="
echo ""
echo "vite.config.js の WORK_REPORT_GATEWAY を上記 URL に合わせて更新し、Vite を再起動してください。"
echo "（既に 1x0f73dj2l を使っている場合は、新規作成せずその API に setup_work_report_api_full.sh を実行しても可）"
