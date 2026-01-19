# リポジトリを公開する方法

このガイドでは、ミセサポプロジェクトを公開する方法を説明します。

## 方法1: GitHubリポジトリを公開（Public）にする

### 手順

1. GitHubにログイン: https://github.com
2. リポジトリにアクセス: https://github.com/sakurada-masaru/misesapo
3. リポジトリの「Settings」タブをクリック
4. 左サイドバーの一番下にある「Danger Zone」セクションを開く
5. 「Change visibility」をクリック
6. 「Change to public」を選択
7. 確認ダイアログでリポジトリ名を入力して「I understand, change repository visibility.」をクリック

これで、誰でもリポジトリのコードを閲覧できるようになります。

## 方法2: GitHub Pagesでサイトを公開する

GitHub Pagesを使用すると、`public` ディレクトリの内容を静的サイトとして公開できます。

### 前提条件

- リポジトリが公開（Public）されていること（Privateリポジトリでも利用可能ですが、有料プランが必要）
- ビルド済みの `public/` ディレクトリがあること

### 手順

#### オプションA: GitHub Actionsで自動デプロイ

1. `.github/workflows/pages.yml` を作成（下記参照）
2. リポジトリの Settings → Pages を開く
3. Source で「GitHub Actions」を選択
4. `main` ブランチにプッシュすると自動的にビルド・デプロイされます

#### オプションB: 手動でデプロイ

1. ローカルでビルド: `python3 scripts/build.py`
2. `public/` ディレクトリを `gh-pages` ブランチにプッシュ
3. リポジトリの Settings → Pages を開く
4. Source で「Deploy from a branch」を選択
5. Branch で「gh-pages」を選択し、Folder を「/ (root)」に設定
6. Save をクリック

### GitHub Actions設定（オプションA用）

`.github/workflows/pages.yml` を作成：

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Build static files
        run: python3 scripts/build.py
      
      - name: Setup Pages
        uses: actions/configure-pages@v3
      
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v2
        with:
          path: './public'
  
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v2
```

### アクセス方法

デプロイが完了すると、以下のURLでアクセスできます：

```
https://sakurada-masaru.github.io/misesapo/
```

## 方法3: Netlify / Vercelで公開する

### Netlify

1. https://netlify.com にサインアップ
2. 「Add new site」→「Import an existing project」
3. GitHubリポジトリを選択
4. ビルド設定:
   - Build command: `python3 scripts/build.py`
   - Publish directory: `public`
5. Deploy をクリック

### Vercel

1. https://vercel.com にサインアップ
2. 「New Project」をクリック
3. GitHubリポジトリを選択
4. ビルド設定:
   - Build Command: `python3 scripts/build.py`
   - Output Directory: `public`
5. Deploy をクリック

## 方法4: Cloud Runで公開する（既存の設定を使用）

既に `.github/workflows/deploy.yml` が設定されているので、GitHub Actionsの変数を設定すれば自動デプロイできます。

### 手順

1. Google Cloud Platformでプロジェクトを作成
2. Cloud Run APIを有効化
3. Workload Identity Federationを設定
4. GitHubリポジトリの Settings → Secrets and variables → Actions で以下を設定:
   - `GCP_PROJECT_ID`
   - `CLOUD_RUN_SERVICE`
   - `CLOUD_RUN_REGION`
   - `WIF_PROVIDER`
   - `WIF_SERVICE_ACCOUNT`
5. `main` ブランチにプッシュすると自動的にデプロイされます

詳細は `README.md` の「Cloud Run 手動デプロイ」セクションを参照してください。

## 推奨方法

### 簡単に公開したい場合
→ **GitHub Pages**（方法2、オプションA）

### 本番環境として公開したい場合
→ **Netlify / Vercel**（方法3）

### 既存のGCP環境がある場合
→ **Cloud Run**（方法4）

## 注意事項

### 機密情報について

公開リポジトリにする場合、以下の情報は**絶対に含めないでください**：

- APIキー
- パスワード
- 個人情報（顧客データなど）
- `.env` ファイル
- 認証情報（トークン、シークレット）

必要に応じて `.gitignore` に追加してください。

### ビルドファイルについて

`public/` ディレクトリは `.gitignore` に含まれているため、GitHub Pagesを使用する場合は、GitHub Actionsで自動ビルドするか、`gh-pages` ブランチに手動でプッシュする必要があります。

---

**最終更新**: 2025年3月


