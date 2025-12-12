#!/bin/bash

# NFCタグ打刻システム - テストスクリプト
# このスクリプトは、NFCタグ打刻APIをテストします

set -e

# 設定変数（API GatewayのURLに合わせて変更してください）
API_URL="${API_GATEWAY_URL:-https://YOUR_API_GATEWAY_URL/prod/staff/nfc/clock-in}"

echo "=========================================="
echo "NFCタグ打刻システム - APIテスト"
echo "=========================================="
echo ""
echo "API URL: $API_URL"
echo ""

# 1. 正常なリクエストのテスト
echo "1. 正常なリクエストのテスト..."
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "WKR_001",
    "facility_id": "ABC_001",
    "location_id": "TK_R01_TOILET_IN"
  }')

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

echo "  ステータスコード: $HTTP_STATUS"
echo "  レスポンス: $BODY"
echo ""

if [ "$HTTP_STATUS" = "200" ]; then
    echo "  ✓ テスト成功"
    LOG_ID=$(echo "$BODY" | grep -o '"log_id":"[^"]*"' | cut -d'"' -f4)
    echo "  ログID: $LOG_ID"
else
    echo "  ✗ テスト失敗"
fi
echo ""

# 2. 必須パラメータ不足のテスト
echo "2. user_id不足のテスト..."
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "facility_id": "ABC_001",
    "location_id": "TK_R01_TOILET_IN"
  }')

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

echo "  ステータスコード: $HTTP_STATUS"
echo "  レスポンス: $BODY"
echo ""

if [ "$HTTP_STATUS" = "400" ]; then
    echo "  ✓ エラーハンドリング正常"
else
    echo "  ✗ エラーハンドリング異常"
fi
echo ""

# 3. ログ取得のテスト
echo "3. 打刻ログ取得のテスト..."
GET_URL="${API_URL%/clock-in}"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X GET "${GET_URL}?user_id=WKR_001&limit=10" \
  -H "Content-Type: application/json")

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

echo "  ステータスコード: $HTTP_STATUS"
echo "  レスポンス: $BODY"
echo ""

if [ "$HTTP_STATUS" = "200" ]; then
    echo "  ✓ ログ取得成功"
    COUNT=$(echo "$BODY" | grep -o '"count":[0-9]*' | cut -d: -f2)
    echo "  取得件数: $COUNT"
else
    echo "  ✗ ログ取得失敗"
fi
echo ""

echo "=========================================="
echo "テスト完了"
echo "=========================================="

