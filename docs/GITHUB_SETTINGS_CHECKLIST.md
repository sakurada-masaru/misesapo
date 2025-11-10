# GitHub設定チェックリスト

## 📋 確認すべき設定

### 1. GitHub Pagesの設定

**確認場所**: https://github.com/sakurada-masaru/misesapo/settings/pages

**確認事項**:
- [ ] GitHub Pagesが有効化されている
- [ ] ソースが「GitHub Actions」に設定されている
- [ ] ブランチが「main」に設定されている（必要に応じて）

**現在の状態**: 
- ワークフロー: `.github/workflows/pages.yml` が存在
- トリガー: `push` イベント（`main` ブランチ）
- デプロイ先: GitHub Pages

### 2. GitHub Actionsの設定

**確認場所**: https://github.com/sakurada-masaru/misesapo/settings/actions

**確認事項**:
- [ ] GitHub Actionsが有効化されている
- [ ] ワークフローの権限が適切に設定されている
- [ ] ワークフローの実行ログが確認できる

**現在のワークフロー**:
1. **Deploy to GitHub Pages** (`.github/workflows/pages.yml`)
   - 状態: 正常に動作しているはず
   - トリガー: `push` イベント（`main` ブランチ）
   - 必要な設定: なし（GitHub Pagesの設定のみ）

2. **Cloud Run deploy** (`.github/workflows/deploy.yml`)
   - 状態: 無効化済み（手動実行のみ）
   - トリガー: `workflow_dispatch`（手動実行のみ）
   - 必要な設定: 以下の変数（Cloud Runを使用する場合のみ）
     - `GCP_PROJECT_ID`
     - `CLOUD_RUN_SERVICE`
     - `CLOUD_RUN_REGION`
     - `WIF_PROVIDER`
     - `WIF_SERVICE_ACCOUNT`

### 3. リポジトリ変数（Variables）

**確認場所**: https://github.com/sakurada-masaru/misesapo/settings/secrets/actions

**確認事項**:
- [ ] Cloud Runデプロイを使用する場合のみ、以下の変数が必要:
  - `GCP_PROJECT_ID`: GCPプロジェクトID
  - `CLOUD_RUN_SERVICE`: Cloud Runサービス名
  - `CLOUD_RUN_REGION`: リージョン
  - `WIF_PROVIDER`: Workload Identity Federationプロバイダ
  - `WIF_SERVICE_ACCOUNT`: サービスアカウント

**現在の状態**: 
- GitHub Pagesのみを使用する場合、変数は不要
- Cloud Runデプロイは無効化されているため、変数は設定不要

### 4. シークレット（Secrets）

**確認場所**: https://github.com/sakurada-masaru/misesapo/settings/secrets/actions

**確認事項**:
- [ ] 機密情報（APIキー、パスワードなど）がシークレットとして設定されているか
- [ ] 現在、必要なシークレットはなし（GitHub Pagesのみを使用する場合）

### 5. ブランチ保護設定

**確認場所**: https://github.com/sakurada-masaru/misesapo/settings/branches

**確認事項**:
- [ ] `main` ブランチの保護設定が適切か
- [ ] 必要に応じて、ブランチ保護ルールを設定

### 6. リポジトリの可視性

**確認場所**: https://github.com/sakurada-masaru/misesapo/settings

**確認事項**:
- [ ] リポジトリが公開（Public）または非公開（Private）に設定されているか
- [ ] GitHub PagesのURLが正しく設定されているか

## 🔍 現在の設定状態

### GitHub Pages
- **URL**: https://sakurada-masaru.github.io/misesapo/
- **状態**: 正常に動作しているはず
- **ワークフロー**: `.github/workflows/pages.yml`
- **必要な設定**: GitHub Pagesの有効化のみ

### Cloud Runデプロイ
- **状態**: 無効化済み（手動実行のみ）
- **ワークフロー**: `.github/workflows/deploy.yml`
- **必要な設定**: なし（無効化されているため）

## ✅ 確認手順

### 1. GitHub Pagesの動作確認

1. https://sakurada-masaru.github.io/misesapo/ にアクセス
2. ページが正しく表示されるか確認
3. CSSや画像が正しく読み込まれているか確認
4. リンクが正しく動作するか確認

### 2. GitHub Actionsの動作確認

1. https://github.com/sakurada-masaru/misesapo/actions にアクセス
2. 最新のワークフロー実行を確認
3. `Deploy to GitHub Pages` が成功しているか確認
4. `Cloud Run deploy` が無効化されているか確認（手動実行のみ）

### 3. 設定の確認

1. https://github.com/sakurada-masaru/misesapo/settings/pages にアクセス
2. GitHub Pagesが有効化されているか確認
3. ソースが「GitHub Actions」に設定されているか確認

## 🛠️ 問題が発生した場合

### GitHub Pagesが表示されない場合

1. **GitHub Pagesの設定を確認**
   - Settings > Pages で有効化されているか確認
   - ソースが「GitHub Actions」に設定されているか確認

2. **GitHub Actionsのログを確認**
   - Actions タブで最新のワークフロー実行を確認
   - エラーメッセージを確認

3. **ビルドが成功しているか確認**
   - `build` ジョブが成功しているか確認
   - `deploy` ジョブが成功しているか確認

### Cloud Runデプロイが失敗する場合

1. **ワークフローが無効化されているか確認**
   - `.github/workflows/deploy.yml` の `on:` セクションを確認
   - `workflow_dispatch` のみに設定されているか確認

2. **リポジトリ変数が設定されているか確認**
   - Settings > Secrets and variables > Actions > Variables で確認
   - 必要な変数がすべて設定されているか確認

## 📝 次のステップ

1. **GitHub Pagesの動作確認**
   - 上記URLにアクセスして、ページが正しく表示されるか確認

2. **GitHub Actionsの動作確認**
   - Actions タブで最新のワークフロー実行を確認

3. **設定の確認**
   - Settings > Pages でGitHub Pagesが有効化されているか確認

問題があれば、具体的なエラーメッセージを共有してください。

