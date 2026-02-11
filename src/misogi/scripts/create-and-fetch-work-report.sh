#!/usr/bin/env bash
# 業務報告（管理）表示確認用：テスト報告 1 件作成 → GET で取得確認
# 前提: ~/.cognito_token に有効な Cognito ID Token が入っていること

set -e
# 業務報告は専用ゲート（misesapo-work-report: 1x0f73dj2l）。
# 旧スケジュールAPI(51bhoxkbxd)は使用しない。
BASE_PROD="${BASE_PROD:-https://1x0f73dj2l.execute-api.ap-northeast-1.amazonaws.com/prod}"
AUTH="Authorization: Bearer $(cat ~/.cognito_token)"
DATE="${DATE:-2026-01-31}"

echo "=== PUT /work-report (date=$DATE, target_label=test-store-001) ==="
PUT_RES=$(curl -sS -w "\n%{http_code}" -X PUT "$BASE_PROD/work-report" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{
    "date":"'"$DATE"'",
    "template_id":"ENGINEERING_V1",
    "target_label":"test-store-001",
    "work_minutes":12,
    "state":"submitted",
    "description":{
      "summary":"（テスト）管理一覧表示確認",
      "issues":"（テスト）課題欄の表示と省略確認",
      "notes":"（テスト）検索対象メモ"
    },
    "attachments":[
      "https://example.com/test-a.jpg",
      "https://example.com/test-b.jpg"
    ]
  }')
PUT_BODY=$(echo "$PUT_RES" | head -n -1)
PUT_STATUS=$(echo "$PUT_RES" | tail -n 1)
echo "HTTP $PUT_STATUS"
echo "$PUT_BODY" | head -c 500
echo ""
if [ "$PUT_STATUS" != "200" ]; then
  echo "PUT failed. Check token: cat ~/.cognito_token (refresh if expired)"
  exit 1
fi

echo ""
echo "=== GET /work-report?date=$DATE ==="
GET_RES=$(curl -sS -w "\n%{http_code}" -X GET "$BASE_PROD/work-report?date=$DATE" -H "$AUTH")
GET_BODY=$(echo "$GET_RES" | head -n -1)
GET_STATUS=$(echo "$GET_RES" | tail -n 1)
echo "HTTP $GET_STATUS"
echo "$GET_BODY" | head -c 800
echo ""
if echo "$GET_BODY" | grep -q "test-store-001"; then
  echo "[OK] target_label test-store-001 が一覧に含まれています"
else
  echo "[?] target_label test-store-001 が一覧に見つかりません（日付・フィルタを確認）"
fi
