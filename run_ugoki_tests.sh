#!/bin/bash
BASE_PROD="https://v7komjxk4k.execute-api.ap-northeast-1.amazonaws.com/prod"
TOKEN=$(cat ~/.cognito_token | tr -d '\n')
AUTH="Authorization: Bearer ${TOKEN}"

echo "=== UGOKI Phase2 Test Execution ==="
echo "Target: ${BASE_PROD}"
echo ""

# 1. テスト用の予定を作成 (2026-02-19)
echo "[Setup] Create a test yotei for 2026-02-19"
YOTEI_RESP=$(curl -sS -X POST "${BASE_PROD}/yotei" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{
    "start_at":"2026-02-19T10:00:00+09:00",
    "end_at":"2026-02-19T11:00:00+09:00",
    "sagyouin_id":"WORKER#TEST01",
    "tenpo_id":"TENPO#TEST01",
    "jotai":"yuko",
    "memo":"UGOKI Test Schedule"
  }')
Y_ID=$(echo "$YOTEI_RESP" | jq -r .id)
echo "Yotei ID: $Y_ID"
echo ""

# 2. 一覧取得 (未完了状態でマージされているか)
echo "[Test 2] GET /ugoki?date=2026-02-19 (Merged check)"
curl -sS -H "$AUTH" "${BASE_PROD}/ugoki?date=2026-02-19" | jq .
echo ""

# 3. 進行中に変更 (jokyo エイリアスを使用)
echo "[Test 3] PATCH /ugoki/$Y_ID (shinkou using jokyo alias)"
curl -sS -X PATCH "${BASE_PROD}/ugoki/${Y_ID}" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"jokyo": "shinkou"}' | jq .
echo ""

# 4. 単体取得
echo "[Test 4] GET /ugoki/$Y_ID"
curl -sS -H "$AUTH" "${BASE_PROD}/ugoki/${Y_ID}" | jq .
echo ""

# 5. 完了に変更 (report draftのトリガー)
echo "[Test 5] PATCH /ugoki/$Y_ID (kanryou)"
curl -sS -X PATCH "${BASE_PROD}/ugoki/${Y_ID}" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"jotai": "kanryou"}' | jq .
echo ""

# 8. Report Draft 作成確認
echo "[Test 8] Verify Staff Report Draft"
aws dynamodb scan --table-name staff-reports \
  --filter-expression "yotei_id = :y" \
  --expression-attribute-values "{\":y\": {\"S\": \"$Y_ID\"}}" \
  --region ap-northeast-1 | jq '{count: .Count, items: [.Items[] | {report_id: .report_id.S, status: .status.S, origin: .origin.S}]}'
echo ""

# 6. Adminによる差し戻し (理由必須チェック)
echo "[Test 6] Admin Revoke (kanryou -> shinkou, without reason - fails)"
curl -sS -X PATCH "${BASE_PROD}/ugoki/${Y_ID}" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"jotai": "shinkou"}' | jq .
echo ""

echo "[Test 7] Admin Revoke (kanryou -> shinkou, with reason - success)"
curl -sS -X PATCH "${BASE_PROD}/ugoki/${Y_ID}" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{
    "jotai": "shinkou",
    "reason": "Admin correction test",
    "override": {"note": "forced by admin"}
  }' | jq .
echo ""

# 7. 最終確認
echo "=== Final Verify ==="
curl -sS -H "$AUTH" "${BASE_PROD}/ugoki/${Y_ID}" | jq .
