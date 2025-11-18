#!/bin/bash

# GitHub PAT設定スクリプト
# このスクリプトは、GitHubへのプッシュ時に使用するPATをキーチェーンに保存します。

set -e

echo "=========================================="
echo "GitHub PAT 設定スクリプト"
echo "=========================================="
echo ""

# リポジトリのルートディレクトリに移動
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

# リモートURLを確認
echo "現在のリモートURL:"
git remote -v
echo ""

# 認証情報ヘルパーの確認
echo "認証情報ヘルパーの設定:"
git config --list | grep credential || echo "設定されていません"
echo ""

# 認証情報ヘルパーを設定（未設定の場合）
if ! git config --global credential.helper | grep -q osxkeychain; then
    echo "認証情報ヘルパーを設定します..."
    git config --global credential.helper osxkeychain
    echo "✅ 認証情報ヘルパーを設定しました"
    echo ""
fi

# PATの入力
echo "=========================================="
echo "PAT（Personal Access Token）の入力"
echo "=========================================="
echo ""
echo "GitHubでPATを作成していない場合は、以下の手順で作成してください："
echo "1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)"
echo "2. Generate new token (classic) をクリック"
echo "3. 'repo' スコープにチェックを入れる"
echo "4. 生成されたトークンをコピー"
echo ""
read -p "GitHubユーザー名を入力してください: " GITHUB_USERNAME
read -sp "PAT（Personal Access Token）を入力してください: " GITHUB_PAT
echo ""

# リモートURLを確認
REMOTE_URL=$(git remote get-url origin)
if [[ "$REMOTE_URL" != https://github.com/* ]]; then
    echo "⚠️  リモートURLがHTTPSではありません。HTTPSに変更することを推奨します。"
    echo "現在のURL: $REMOTE_URL"
    read -p "HTTPSに変更しますか？ (y/N): " CHANGE_URL
    if [[ "$CHANGE_URL" == [Yy] ]]; then
        # HTTPS URLに変換
        HTTPS_URL=$(echo "$REMOTE_URL" | sed 's|git@github.com:|https://github.com/|' | sed 's|\.git$||')
        HTTPS_URL="${HTTPS_URL}.git"
        git remote set-url origin "$HTTPS_URL"
        echo "✅ リモートURLをHTTPSに変更しました: $HTTPS_URL"
    fi
fi

# 認証情報をキーチェーンに保存
echo ""
echo "認証情報をキーチェーンに保存しています..."
echo "protocol=https" | git credential-osxkeychain store
echo "host=github.com" | git credential-osxkeychain store
echo "username=$GITHUB_USERNAME" | git credential-osxkeychain store
echo "password=$GITHUB_PAT" | git credential-osxkeychain store
echo "" | git credential-osxkeychain store

echo "✅ 認証情報をキーチェーンに保存しました"
echo ""

# テスト（オプション）
read -p "テストプッシュを実行しますか？ (y/N): " TEST_PUSH
if [[ "$TEST_PUSH" == [Yy] ]]; then
    echo ""
    echo "現在のブランチとステータスを確認..."
    git status
    echo ""
    
    # コミット済みの変更があるか確認
    if git status --porcelain | grep -q .; then
        echo "⚠️  未コミットの変更があります。"
        read -p "コミットしてからプッシュしますか？ (y/N): " COMMIT_AND_PUSH
        if [[ "$COMMIT_AND_PUSH" == [Yy] ]]; then
            read -p "コミットメッセージを入力してください: " COMMIT_MSG
            git add .
            git commit -m "$COMMIT_MSG"
        fi
    fi
    
    # リモートより先に進んでいるか確認
    if git status | grep -q "Your branch is ahead"; then
        echo ""
        echo "プッシュを実行します..."
        if git push origin main; then
            echo "✅ プッシュに成功しました！"
        else
            echo "❌ プッシュに失敗しました。エラーメッセージを確認してください。"
            exit 1
        fi
    else
        echo "ℹ️  プッシュする変更がありません。"
    fi
fi

echo ""
echo "=========================================="
echo "設定完了"
echo "=========================================="
echo ""
echo "今後のプッシュでは、キーチェーンに保存された認証情報が自動的に使用されます。"
echo ""

