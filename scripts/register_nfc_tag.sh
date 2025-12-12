#!/bin/bash

# NFCタグ情報をDynamoDBに登録するスクリプト

set -e

# 設定変数
REGION="ap-northeast-1"
TABLE_NAME="nfc-tags"

# デフォルト値
TAG_ID="${1:-TEST_001}"
FACILITY_ID="${2:-ABC_001}"
LOCATION_ID="${3:-TK_R01_TOILET_IN}"
FACILITY_NAME="${4:-テスト店舗}"
LOCATION_NAME="${5:-トイレ入口}"
DESCRIPTION="${6:-テスト用NFCタグ}"
PRODUCT_ID="${7:-}"  # 在庫管理用（オプション）

echo "=========================================="
echo "NFCタグ情報をDynamoDBに登録"
echo "=========================================="
echo ""
echo "設定:"
echo "  リージョン: $REGION"
echo "  テーブル名: $TABLE_NAME"
echo "  タグID: $TAG_ID"
echo "  施設ID: $FACILITY_ID"
echo "  場所ID: $LOCATION_ID"
echo "  施設名: $FACILITY_NAME"
echo "  場所名: $LOCATION_NAME"
echo "  説明: $DESCRIPTION"
if [ -n "$PRODUCT_ID" ]; then
    echo "  商品ID: $PRODUCT_ID (在庫管理用)"
fi
echo ""

# 現在の日時を取得（ISO 8601形式）
CURRENT_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# DynamoDBにアイテムを追加
echo "DynamoDBにアイテムを追加中..."

# アイテムJSONを構築
ITEM_JSON="{
    \"tag_id\": {\"S\": \"$TAG_ID\"},
    \"facility_id\": {\"S\": \"$FACILITY_ID\"},
    \"location_id\": {\"S\": \"$LOCATION_ID\"},
    \"facility_name\": {\"S\": \"$FACILITY_NAME\"},
    \"location_name\": {\"S\": \"$LOCATION_NAME\"},
    \"description\": {\"S\": \"$DESCRIPTION\"},
    \"created_at\": {\"S\": \"$CURRENT_TIME\"},
    \"updated_at\": {\"S\": \"$CURRENT_TIME\"}"

# product_idが指定されている場合は追加
if [ -n "$PRODUCT_ID" ]; then
    ITEM_JSON="$ITEM_JSON,
    \"product_id\": {\"S\": \"$PRODUCT_ID\"}"
fi

ITEM_JSON="$ITEM_JSON
}"

aws dynamodb put-item \
    --table-name $TABLE_NAME \
    --item "$ITEM_JSON" \
    --region $REGION \
    --no-cli-pager

echo ""
echo "✓ NFCタグ情報を登録しました"
echo ""
echo "使用方法:"
echo "  ./scripts/register_nfc_tag.sh [TAG_ID] [FACILITY_ID] [LOCATION_ID] [FACILITY_NAME] [LOCATION_NAME] [DESCRIPTION] [PRODUCT_ID]"
echo ""
echo "例（打刻用）:"
echo "  ./scripts/register_nfc_tag.sh TAG_001 ABC_001 TK_R01_TOILET_IN \"新宿店\" \"トイレ入口\" \"1階トイレ入口\""
echo ""
echo "例（在庫管理用）:"
echo "  ./scripts/register_nfc_tag.sh INVENTORY_001 ABC_001 LOC_001 \"新宿店\" \"倉庫\" \"在庫管理用タグ\" P001"

