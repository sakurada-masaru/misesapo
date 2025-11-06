# GitHub CLIで設定を自動化する方法

## 概要

GitHub CLI (`gh`) を使用すると、コマンドラインからGitHubの設定を変更できます。

## インストール

### macOS

```bash
brew install gh
```

### その他のOS

https://cli.github.com からダウンロード

## 認証

### 初回認証

```bash
gh auth login
```

以下の手順に従います：
1. **GitHub.com** を選択
2. **HTTPS** を選択
3. **認証方法**: ブラウザを使用することを推奨
4. ブラウザで認証を完了

### 認証状態の確認

```bash
gh auth status
```

## GitHub Pagesの設定について

**重要**: GitHub Pagesの設定（Sourceの変更）は、現在GitHub CLIでは直接変更できません。

GitHub API v3では、Pagesの設定を変更する機能が提供されていないため、以下のいずれかの方法で設定する必要があります：

### 方法1: Web UIで手動設定（推奨）

1. https://github.com/sakurada-masaru/misesapo/settings/pages にアクセス
2. Source で「GitHub Actions」を選択
3. Save をクリック

### 方法2: GitHub APIを使用（上級者向け）

GitHub API v3を使用して設定を変更できますが、Personal Access Tokenが必要です。

## 私が代行できる作業

以下の作業は、GitHub CLIを使用して私が代行できます：

### ✅ 可能な作業

1. **GitHub Actionsのワークフローを実行**
   ```bash
   gh workflow run "Deploy to GitHub Pages"
   ```

2. **ワークフローの実行状況を確認**
   ```bash
   gh run list --workflow="Deploy to GitHub Pages"
   ```

3. **リポジトリの情報を確認**
   ```bash
   gh repo view sakurada-masaru/misesapo
   ```

4. **コミット・プッシュ**
   - 既に可能です（現在実行中）

### ❌ できない作業

1. **GitHub Pagesの設定変更**（Sourceの変更）
   - GitHub CLIでは直接変更できません
   - Web UIで手動設定が必要です

2. **リポジトリの権限設定**
   - 認証が必要な場合があります

## 設定スクリプトの使用

提供されたスクリプトを使用して、設定を確認できます：

```bash
./scripts/setup-github-pages.sh
```

## 権限について

GitHub CLIを使用する場合、以下の権限が必要です：

- **repo** (リポジトリへのアクセス)
- **workflow** (ワークフローの実行)
- **pages** (GitHub Pagesの設定 - ただし直接変更は不可)

認証時に必要な権限を選択できます。

## 次のステップ

1. GitHub CLIをインストール: `brew install gh`
2. 認証: `gh auth login`
3. ワークフローの実行: `gh workflow run "Deploy to GitHub Pages"`

---

**注意**: GitHub Pagesの設定（Sourceの変更）は、Web UIで手動で設定する必要があります。

**最終更新**: 2025年3月


