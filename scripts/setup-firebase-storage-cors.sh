#!/bin/bash

# Firebase Storage CORS設定スクリプト
# このスクリプトはFirebase StorageのCORS設定を適用します

set -e

PROJECT_ID="misesapo-system"
CORS_FILE="storage-cors.json"

echo "=========================================="
echo "Firebase Storage CORS設定スクリプト"
echo "=========================================="
echo ""

# gsutilがインストールされているか確認
if ! command -v gsutil &> /dev/null; then
    echo "❌ エラー: gsutilがインストールされていません。"
    echo "   Google Cloud SDKをインストールしてください:"
    echo "   brew install google-cloud-sdk"
    exit 1
fi

echo "✅ gsutilが見つかりました"

# プロジェクトが設定されているか確認
CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null || echo "")
if [ "$CURRENT_PROJECT" != "$PROJECT_ID" ]; then
    echo "⚠️  プロジェクトが設定されていません。設定します..."
    gcloud config set project $PROJECT_ID
fi

echo "✅ プロジェクト: $PROJECT_ID"

# CORS設定ファイルが存在するか確認
if [ ! -f "$CORS_FILE" ]; then
    echo "❌ エラー: $CORS_FILE が見つかりません。"
    exit 1
fi

echo "✅ CORS設定ファイル: $CORS_FILE"

# バケット名を確認
echo ""
echo "バケット名を確認中..."
BUCKETS=$(gcloud storage buckets list --project=$PROJECT_ID 2>&1 | grep -E "firebasestorage|appspot" || echo "")

if [ -z "$BUCKETS" ]; then
    echo "⚠️  警告: Firebase Storageバケットが見つかりません。"
    echo "   Firebase ConsoleでStorageを有効化してください:"
    echo "   https://console.firebase.google.com/project/$PROJECT_ID/storage"
    echo ""
    echo "   バケット名を手動で入力してください（例: misesapo-system.firebasestorage.app）:"
    read -p "バケット名: " BUCKET_NAME
else
    echo "利用可能なバケット:"
    echo "$BUCKETS"
    echo ""
    echo "バケット名を入力してください（上記のいずれか、または手動入力）:"
    read -p "バケット名: " BUCKET_NAME
fi

if [ -z "$BUCKET_NAME" ]; then
    echo "❌ エラー: バケット名が指定されていません。"
    exit 1
fi

# gs://プレフィックスを追加（ない場合）
if [[ ! "$BUCKET_NAME" =~ ^gs:// ]]; then
    BUCKET_NAME="gs://$BUCKET_NAME"
fi

echo ""
echo "CORS設定を適用中..."
echo "バケット: $BUCKET_NAME"

# CORS設定を適用
if gsutil cors set "$CORS_FILE" "$BUCKET_NAME"; then
    echo "✅ CORS設定が正常に適用されました！"
    echo ""
    echo "適用された設定を確認:"
    gsutil cors get "$BUCKET_NAME"
    echo ""
    echo "=========================================="
    echo "完了！"
    echo "=========================================="
    echo ""
    echo "⚠️  注意: ブラウザのキャッシュをクリアしてください（Cmd+Shift+R または Ctrl+Shift+R）"
else
    echo "❌ エラー: CORS設定の適用に失敗しました。"
    echo ""
    echo "考えられる原因:"
    echo "1. バケット名が間違っている"
    echo "2. Firebase Storageが有効化されていない"
    echo "3. 権限が不足している"
    exit 1
fi

