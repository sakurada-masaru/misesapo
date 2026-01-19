#!/bin/bash

# APIエンドポイントURLを設定
API_URL="${API_URL:-https://2z0ui5xfxb.execute-api.ap-northeast-1.amazonaws.com/prod}"

echo "=========================================="
echo "レポート機能 API テスト"
echo "=========================================="
echo "API URL: $API_URL"
echo ""

# 1. GET /staff/reports のテスト
echo "=== 1. GET /staff/reports ==="
echo "リクエスト: GET ${API_URL}/staff/reports"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X GET "${API_URL}/staff/reports" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mock-token")
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')
echo "ステータスコード: $HTTP_STATUS"
echo "レスポンス: $BODY"
echo ""

if [ "$HTTP_STATUS" != "200" ]; then
  echo "❌ エラー: GET /staff/reports が失敗しました"
  exit 1
fi

# 2. POST /staff/reports のテスト
echo "=== 2. POST /staff/reports ==="
echo "リクエスト: POST ${API_URL}/staff/reports"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "${API_URL}/staff/reports" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mock-token" \
  -d '{
    "store_id": "store-001",
    "store_name": "テスト店舗",
    "cleaning_date": "2025-03-28",
    "cleaning_start_time": "10:00",
    "cleaning_end_time": "12:00",
    "staff_id": "staff-001",
    "staff_name": "テスト清掃員",
    "work_items": [
      {
        "item_id": "grease-trap",
        "item_name": "グリストラップ",
        "details": {
          "type": "床置き型",
          "count": 1,
          "notes": "テストメモ"
        },
        "work_content": "テスト作業内容",
        "work_memo": "テスト作業メモ",
        "photos": {
          "before": [],
          "after": []
        }
      }
    ]
  }')
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')
echo "ステータスコード: $HTTP_STATUS"
echo "レスポンス: $BODY"
echo ""

if [ "$HTTP_STATUS" != "200" ]; then
  echo "❌ エラー: POST /staff/reports が失敗しました"
  exit 1
fi

# レポートIDを抽出（JSONから、Pythonを使用）
REPORT_ID=$(echo "$BODY" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('report_id', ''))" 2>/dev/null || echo "")

if [ -z "$REPORT_ID" ]; then
  echo "⚠️  警告: レポートIDが取得できませんでした"
  echo "レスポンスを確認してください: $BODY"
  exit 1
fi

echo "✅ 作成されたレポートID: $REPORT_ID"
echo ""

# 3. GET /staff/reports/{report_id} のテスト
echo "=== 3. GET /staff/reports/${REPORT_ID} ==="
echo "リクエスト: GET ${API_URL}/staff/reports/${REPORT_ID}"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X GET "${API_URL}/staff/reports/${REPORT_ID}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mock-token")
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')
echo "ステータスコード: $HTTP_STATUS"
echo "レスポンス: $BODY"
echo ""

if [ "$HTTP_STATUS" != "200" ]; then
  echo "❌ エラー: GET /staff/reports/${REPORT_ID} が失敗しました"
  exit 1
fi

# 4. PUT /staff/reports のテスト
echo "=== 4. PUT /staff/reports ==="
echo "リクエスト: PUT ${API_URL}/staff/reports"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X PUT "${API_URL}/staff/reports" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mock-token" \
  -d '{
    "report_id": "'"${REPORT_ID}"'",
    "store_id": "store-001",
    "store_name": "テスト店舗（更新）",
    "cleaning_date": "2025-03-28",
    "cleaning_start_time": "10:00",
    "cleaning_end_time": "12:00",
    "work_items": [
      {
        "item_id": "grease-trap",
        "item_name": "グリストラップ",
        "details": {
          "type": "床置き型（更新）",
          "count": 2,
          "notes": "テストメモ（更新）"
        },
        "work_content": "テスト作業内容（更新）",
        "work_memo": "テスト作業メモ（更新）",
        "photos": {
          "before": [],
          "after": []
        }
      }
    ]
  }')
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')
echo "ステータスコード: $HTTP_STATUS"
echo "レスポンス: $BODY"
echo ""

if [ "$HTTP_STATUS" != "200" ]; then
  echo "❌ エラー: PUT /staff/reports が失敗しました"
  exit 1
fi

# 5. DELETE /staff/reports/{report_id} のテスト
echo "=== 5. DELETE /staff/reports/${REPORT_ID} ==="
echo "リクエスト: DELETE ${API_URL}/staff/reports/${REPORT_ID}"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X DELETE "${API_URL}/staff/reports/${REPORT_ID}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mock-token")
HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')
echo "ステータスコード: $HTTP_STATUS"
echo "レスポンス: $BODY"
echo ""

if [ "$HTTP_STATUS" != "200" ]; then
  echo "❌ エラー: DELETE /staff/reports/${REPORT_ID} が失敗しました"
  exit 1
fi

echo "=========================================="
echo "✅ すべてのテストが成功しました！"
echo "=========================================="


