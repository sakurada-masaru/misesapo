# GitHub Actions トラブルシューティング

## 🔍 問題の確認方法

### 1. GitHub Actionsのログを確認

1. GitHubリポジトリにアクセス: https://github.com/sakurada-masaru/misesapo
2. `Actions` タブをクリック
3. 失敗したワークフロー実行をクリック
4. 各ジョブをクリックして、どのステップで失敗しているか確認

### 2. エラーメッセージの確認

失敗したステップのログを確認して、以下のエラーメッセージを探してください：

#### よくあるエラー

**`GCP_PROJECT_ID` が見つかりません**
- **原因**: GitHubリポジトリ変数が設定されていない
- **対処法**: `Settings` > `Secrets and variables` > `Actions` > `Variables` で変数を設定

**`Permission denied`**
- **原因**: Workload Identity Federationの設定が正しくない
- **対処法**: GCPコンソールでWIFの設定を確認

**`Repository not found`**
- **原因**: Artifact Registryリポジトリが存在しない
- **対処法**: GCPコンソールでArtifact Registryリポジトリを作成

**`Bucket not found`**
- **原因**: GCSバケットが存在しない
- **対処法**: GCPコンソールでGCSバケットを作成

## 📋 現在のワークフロー

### 1. GitHub Pagesデプロイ（`.github/workflows/pages.yml`）
- **状態**: 正常に動作しているはず
- **URL**: https://sakurada-masaru.github.io/misesapo/
- **確認方法**: 上記URLにアクセスしてページが表示されるか確認

### 2. Cloud Runデプロイ（`.github/workflows/deploy.yml`）
- **状態**: 失敗している
- **原因**: GitHubリポジトリ変数が設定されていない可能性が高い

## 🛠️ 対処方法

### オプション1: Cloud Runデプロイを無効化（推奨）

GitHub Pagesのみを使用する場合、Cloud Runデプロイのワークフローを無効化できます。

**方法1: ワークフローファイルを削除**
```bash
git rm .github/workflows/deploy.yml
git commit -m "chore: Cloud Runデプロイワークフローを削除"
git push origin main
```

**方法2: ワークフローファイルを無効化**
`.github/workflows/deploy.yml`の`on:`セクションをコメントアウト

### オプション2: Cloud Runデプロイを設定

Cloud Runも使用する場合、以下の手順で設定してください：

1. **GitHubリポジトリ変数を設定**
   - `Settings` > `Secrets and variables` > `Actions` > `Variables` タブを開く
   - 以下の変数を追加：
     - `GCP_PROJECT_ID`: GCPプロジェクトID
     - `CLOUD_RUN_SERVICE`: Cloud Runサービス名（例: `misesapo-mock`）
     - `CLOUD_RUN_REGION`: リージョン（例: `asia-northeast1`）
     - `WIF_PROVIDER`: Workload Identity Federationプロバイダ
     - `WIF_SERVICE_ACCOUNT`: サービスアカウント

2. **GCPの設定を確認**
   - Workload Identity Federationが設定されているか
   - Artifact Registryリポジトリが存在するか
   - GCSバケットが存在するか

詳細は `docs/CLOUD_RUN_DEPLOY_TROUBLESHOOTING.md` を参照してください。

## ✅ 確認事項

### GitHub Pagesが正常に動作しているか確認

1. https://sakurada-masaru.github.io/misesapo/ にアクセス
2. ページが正しく表示されるか確認
3. CSSや画像が正しく読み込まれているか確認
4. リンクが正しく動作するか確認

### GitHub Actionsの状態を確認

1. https://github.com/sakurada-masaru/misesapo/actions にアクセス
2. 最新のワークフロー実行を確認
3. `Deploy to GitHub Pages` が成功しているか確認
4. `Cloud Run deploy` が失敗しているか確認

## 📝 次のステップ

1. **GitHub Pagesの確認**
   - 上記URLにアクセスして、ページが正しく表示されるか確認
   - 問題があれば、ブラウザのコンソール（F12キー）でエラーを確認

2. **Cloud Runデプロイの対処**
   - GitHub Pagesのみを使用する場合: ワークフローを無効化
   - Cloud Runも使用する場合: リポジトリ変数を設定

