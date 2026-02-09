#!/bin/bash
BASE_PROD="https://v7komjxk4k.execute-api.ap-northeast-1.amazonaws.com/prod"
TOKEN=$(cat ~/.cognito_token | tr -d '\n')
AUTH="Authorization: Bearer ${TOKEN}"

echo "=== YOTEI Phase1 Test Execution ==="
echo "Target: ${BASE_PROD}"
echo ""

# 1. 正常作成 3件
echo "[Test 1] Create 3 normal schedules (no overlap)"
for i in {1..3}; do
  START_H=$((i + 10))
  END_H=$((i + 11))
  case $i in
    1) SID="SAGYOUIN#W002"; TID="TENPO#ST0005" ;;
    2) SID="SAGYOUIN#W003"; TID="TENPO#ST0006" ;;
    3) SID="SAGYOUIN#W021"; TID="TENPO#ST0007" ;;
  esac
  
  curl -sS -X POST "${BASE_PROD}/yotei" \
    -H "$AUTH" -H "Content-Type: application/json" \
    -d "{
      \"start_at\":\"2026-02-12T${START_H}:00:00+09:00\",
      \"end_at\":\"2026-02-12T${END_H}:00:00+09:00\",
      \"sagyouin_id\":\"${SID}\",
      \"tenpo_id\":\"${TID}\",
      \"jotai\":\"yuko\",
      \"memo\":\"Test Success $i\"
    }" | jq .
  echo ""
done

# 2. 重複作成 2件
echo "[Test 2] Create 2 overlapping schedules (should fail with 409)"
# 重複1: W002 の時間重なり (11:30 - 12:30, 既存は 11:00 - 12:00)
curl -sS -X POST "${BASE_PROD}/yotei" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{
    "start_at":"2026-02-12T11:30:00+09:00",
    "end_at":"2026-02-12T12:30:00+09:00",
    "sagyouin_id":"SAGYOUIN#W002",
    "tenpo_id":"TENPO#S999",
    "jotai":"yuko",
    "memo":"Test Conflict 1"
  }' | jq .
echo ""

# 重複2: W002 の時間包含 (11:15 - 11:45)
curl -sS -X POST "${BASE_PROD}/yotei" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{
    "start_at":"2026-02-12T11:15:00+09:00",
    "end_at":"2026-02-12T11:45:00+09:00",
    "sagyouin_id":"SAGYOUIN#W002",
    "tenpo_id":"TENPO#S999",
    "jotai":"yuko",
    "memo":"Test Conflict 2"
  }' | jq .
echo ""

# 3. torikeshi 後に再作成 1件
echo "[Test 3] Create -> Delete (torikeshi) -> Create (same time, should succeed)"
# A. まず作成
RESP_A=$(curl -sS -X POST "${BASE_PROD}/yotei" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{
    "start_at":"2026-02-13T10:00:00+09:00",
    "end_at":"2026-02-13T12:00:00+09:00",
    "sagyouin_id":"SAGYOUIN#W002",
    "tenpo_id":"TENPO#ST0005",
    "jotai":"yuko",
    "memo":"Test Recreate Phase A"
  }')
ID_A=$(echo "$RESP_A" | jq -r .id)
echo "Created ID: $ID_A"

# B. 取消 (DELETE)
echo "Deleting $ID_A..."
curl -sS -X DELETE "${BASE_PROD}/yotei/${ID_A}" -H "$AUTH" | jq .

# C. 同じ時間で再作成 (W002, same time)
echo "Re-creating at same time..."
curl -sS -X POST "${BASE_PROD}/yotei" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{
    "start_at":"2026-02-13T10:00:00+09:00",
    "end_at":"2026-02-13T12:00:00+09:00",
    "sagyouin_id":"SAGYOUIN#W002",
    "tenpo_id":"TENPO#ST0005",
    "jotai":"yuko",
    "memo":"Test Recreate Phase C (Success)"
  }' | jq .
echo ""

echo "=== Test Summary ==="
curl -sS -H "$AUTH" "${BASE_PROD}/yotei?limit=10" | jq '{count: .count, items: [.items[] | {id: .id, sagyouin_id: .sagyouin_id, jotai: .jotai, start_at: .start_at}]}'
