# 現状の状態を他者と共有する方法

## 方法一覧（優先度順）

### 1. 🚀 **ngrok（最も簡単・即座に共有可能）**
**所要時間**: 2-3分  
**メリット**: 設定が簡単、即座に共有可能、無料プランあり  
**デメリット**: URLが毎回変わる（無料プラン）、セッション時間制限あり

```bash
# 1. ngrokをインストール（未インストールの場合）
# macOS: brew install ngrok
# または https://ngrok.com/download からダウンロード

# 2. ローカルサーバーを起動
python3 scripts/build.py
python3 -m http.server 5173 --directory public

# 3. 別ターミナルでngrokを起動
ngrok http 5173

# 4. 表示されたURL（例: https://xxxx.ngrok.io）を共有
```

**注意**: 無料プランは8時間でセッションが切れます。有料プランでは固定URLが使えます。

---

### 2. 🌐 **ローカルネットワーク共有（同じWi-Fi内）**
**所要時間**: 1分  
**メリット**: 設定不要、無料、セキュア  
**デメリット**: 同じネットワーク内のみ

```bash
# 1. ビルド
python3 scripts/build.py

# 2. ローカルIPアドレスを確認
# macOS/Linux:
ifconfig | grep "inet " | grep -v 127.0.0.1

# 3. サーバーを起動（0.0.0.0で全インターフェースにバインド）
python3 -m http.server 5173 --directory public --bind 0.0.0.0

# 4. 自分のIPアドレスを確認（例: 192.168.1.100）
# 共有URL: http://192.168.1.100:5173
```

**注意**: ファイアウォールの設定が必要な場合があります。

---

### 3. ☁️ **GitHub Pages（無料・永続的）**
**所要時間**: 5-10分（初回のみ）  
**メリット**: 無料、永続的、カスタムドメイン対応  
**デメリット**: 公開リポジトリが必要（プライベートは有料）

```bash
# 1. GitHubリポジトリを作成（まだの場合）
# GitHubでリポジトリを作成

# 2. リポジトリをクローンまたは既存リポジトリに追加
git remote add origin https://github.com/your-username/misesapo-renewal.git

# 3. .github/workflows/deploy-pages.yml を作成（下記参照）

# 4. コミット＆プッシュ
git add .
git commit -m "Add GitHub Pages deployment"
git push origin main

# 5. GitHubリポジトリの Settings > Pages で有効化
# 自動的に https://your-username.github.io/misesapo-renewal で公開
```

**GitHub Actions ワークフローファイル例**:
```yaml
# .github/workflows/deploy-pages.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - name: Build
        run: python3 scripts/build.py
      - name: Deploy
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./public
```

---

### 4. 🐳 **Cloud Run（GCP）**
**所要時間**: 10-15分（初回のみ）  
**メリット**: 本番環境に近い、スケーラブル、無料枠あり  
**デメリット**: GCPアカウントが必要、設定がやや複雑

```bash
# 1. gcloud CLIをインストール（未インストールの場合）
# https://cloud.google.com/sdk/docs/install

# 2. 認証
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# 3. ビルド
python3 scripts/build.py

# 4. デプロイ
gcloud run deploy misesapo-mock \
  --source . \
  --region asia-northeast1 \
  --platform managed \
  --allow-unauthenticated

# 5. URLを確認
gcloud run services describe misesapo-mock \
  --region asia-northeast1 \
  --format='value(status.url)'
```

**注意**: 無料枠は月間200万リクエストまで。課金が発生する可能性があります。

---

### 5. 🎬 **Netlify / Vercel（無料・簡単）**
**所要時間**: 5分  
**メリット**: 無料、設定が簡単、自動デプロイ  
**デメリット**: ビルド設定が必要

#### Netlifyの場合:
```bash
# 1. Netlify CLIをインストール
npm install -g netlify-cli

# 2. ビルド
python3 scripts/build.py

# 3. デプロイ
netlify deploy --prod --dir=public

# または、NetlifyのWeb UIからドラッグ&ドロップで public/ フォルダをアップロード
```

#### Vercelの場合:
```bash
# 1. Vercel CLIをインストール
npm install -g vercel

# 2. ビルド
python3 scripts/build.py

# 3. デプロイ
vercel --prod

# または、vercel.json を作成してGitHubと連携
```

---

### 6. 📸 **スクリーンショット・動画（視覚的共有）**
**所要時間**: 即座  
**メリット**: 設定不要、セキュア  
**デメリット**: インタラクティブではない

```bash
# macOSの場合
# 1. スクリーンショット: Cmd + Shift + 4
# 2. 画面録画: Cmd + Shift + 5 > 録画

# または、ブラウザ拡張機能を使用
# - Loom（動画）
# - Nimbus Screenshot（スクリーンショット）
```

---

### 7. 🔗 **Cloudflare Tunnel（無料・セキュア）**
**所要時間**: 5分  
**メリット**: 無料、セキュア、固定URL  
**デメリット**: 設定がやや複雑

```bash
# 1. Cloudflare Tunnelをインストール
# https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/

# 2. トンネルを作成
cloudflared tunnel create misesapo

# 3. 設定ファイルを作成
# ~/.cloudflared/config.yml に設定を追加

# 4. トンネルを起動
cloudflared tunnel --url http://localhost:5173
```

---

## 推奨方法（状況別）

### 🎯 **すぐに共有したい（今すぐ）**
→ **ngrok** または **ローカルネットワーク共有**

### 🎯 **永続的に共有したい（長期的）**
→ **GitHub Pages** または **Netlify/Vercel**

### 🎯 **本番環境に近い形で共有したい**
→ **Cloud Run** または **Netlify/Vercel**

### 🎯 **セキュアに共有したい（認証付き）**
→ **Cloudflare Tunnel** または **ngrok（有料プラン）**

---

## 共有時の注意事項

1. **セキュリティ**
   - 公開URLを共有する場合は、機密情報が含まれていないか確認
   - 必要に応じて認証を追加

2. **パフォーマンス**
   - 画像が多い場合は、最適化を検討
   - CDNの利用を検討

3. **ドメイン**
   - カスタムドメインを使用する場合は、DNS設定が必要

4. **コスト**
   - 無料枠を超える場合は、課金が発生する可能性がある

---

## トラブルシューティング

### ローカルサーバーが起動しない
```bash
# ポートが使用中の場合
lsof -ti:5173 | xargs kill -9

# 別のポートを使用
python3 -m http.server 8080 --directory public
```

### ngrokが接続できない
- インターネット接続を確認
- ファイアウォール設定を確認
- ngrokのアカウントを作成（無料）

### GitHub Pagesが更新されない
- GitHub Actionsのログを確認
- キャッシュをクリア（ブラウザのハードリロード: Cmd + Shift + R）

---

## 次のステップ

1. **最も簡単な方法から試す**: ngrok または ローカルネットワーク共有
2. **永続的な共有が必要**: GitHub Pages または Netlify/Vercel
3. **本番環境に近い形**: Cloud Run

