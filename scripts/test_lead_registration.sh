#!/usr/bin/env bash
# リード登録 API のテスト（1件登録）
# 使い方:
#   ./scripts/test_lead_registration.sh
#   COGNITO_ID_TOKEN="..." ./scripts/test_lead_registration.sh   # 認証付き
#   ./scripts/test_lead_registration.sh --local                    # ローカル dev サーバー (localhost:3334) 向け

set -e
API_BASE="${API_BASE:-https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod}"
if [[ "${1:-}" == "--local" ]]; then
  API_BASE="http://localhost:3334/api"
  shift
fi

# テスト用リード1件（見込み客）
LEAD_JSON='{
  "name": "テスト店舗",
  "company_name": "株式会社テストリード",
  "store_name": "新宿テスト店",
  "contact_person": "山田太郎",
  "phone": "03-1234-5678",
  "email": "test-lead@example.com",
  "lead_status": "appointment",
  "notes": "リード登録APIテストです。",
  "next_action_date": "2026-02-15",
  "next_action_content": "ヒアリング実施",
  "registration_type": "lead"
}'

HEADERS=(-H "Content-Type: application/json")
if [[ -n "${COGNITO_ID_TOKEN:-}" ]]; then
  HEADERS+=(-H "Authorization: Bearer $COGNITO_ID_TOKEN")
fi

echo "POST $API_BASE/stores"
echo "Body: $LEAD_JSON"
echo "---"
curl -s -w "\nHTTP %{http_code}\n" -X POST "${API_BASE}/stores" "${HEADERS[@]}" -d "$LEAD_JSON"
