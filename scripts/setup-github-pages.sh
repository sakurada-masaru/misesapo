#!/bin/bash
# GitHub Pagesの設定を自動化するスクリプト

set -e

echo "=== GitHub Pages 設定スクリプト ==="
echo ""

# GitHub CLIがインストールされているか確認
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) がインストールされていません"
    echo ""
    echo "インストール方法:"
    echo "  macOS: brew install gh"
    echo "  または: https://cli.github.com からダウンロード"
    echo ""
    exit 1
fi

echo "✅ GitHub CLI がインストールされています"
echo ""

# 認証状態を確認
if ! gh auth status &> /dev/null; then
    echo "⚠️  GitHubに認証されていません"
    echo "認証を開始します..."
    gh auth login
else
    echo "✅ GitHubに認証されています"
fi

echo ""
echo "=== GitHub Pages の設定を変更します ==="
echo ""

# リポジトリ名を取得
REPO="sakurada-masaru/misesapo"

echo "リポジトリ: $REPO"
echo ""

# GitHub Pagesの設定を確認
echo "現在の設定を確認中..."
gh api repos/$REPO/pages --jq '.source' || echo "GitHub Pagesが有効化されていません"

echo ""
echo "=== GitHub Pages を有効化します ==="
echo ""

# GitHub Pagesを有効化（GitHub Actionsを使用）
echo "GitHub Actionsを使用するように設定します..."

# 注意: GitHub Pagesの設定はGitHub API v3では直接変更できません
# そのため、GitHub CLIでは設定を変更できません
# 手動で設定する必要があります

echo ""
echo "⚠️  注意: GitHub Pagesの設定はGitHub CLIでは直接変更できません"
echo ""
echo "以下の手順で手動で設定してください:"
echo ""
echo "1. GitHubリポジトリにアクセス: https://github.com/$REPO"
echo "2. Settings → Pages を開く"
echo "3. Source で「GitHub Actions」を選択"
echo "4. Save をクリック"
echo ""
echo "または、以下のURLから直接設定できます:"
echo "https://github.com/$REPO/settings/pages"
echo ""

# ワークフローの実行状況を確認
echo "=== GitHub Actions の実行状況を確認 ==="
echo ""
gh run list --workflow="Deploy to GitHub Pages" --limit 5 || echo "ワークフローが見つかりません"

echo ""
echo "完了しました！"


