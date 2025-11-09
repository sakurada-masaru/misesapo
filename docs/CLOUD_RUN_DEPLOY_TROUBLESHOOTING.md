# Cloud Run デプロイ トラブルシューティング

## エラー概要
Cloud Runへのデプロイが失敗している場合の対処法をまとめます。

## 考えられる原因と対処法

### 1. GitHubリポジトリ変数が設定されていない

**症状**: `deploy`ジョブが5秒以内に失敗する

**確認方法**:
1. GitHubリポジトリの `Settings` > `Secrets and variables` > `Actions` > `Variables` タブを開く
2. 以下の変数が設定されているか確認:
   - `GCP_PROJECT_ID`: GCPプロジェクトID（例: `my-project-123456`）
   - `CLOUD_RUN_SERVICE`: Cloud Runサービス名（例: `misesapo-mock`）
   - `CLOUD_RUN_REGION`: リージョン（例: `asia-northeast1`）
   - `WIF_PROVIDER`: Workload Identity Federationプロバイダ（例: `projects/123456789/locations/global/workloadIdentityPools/gh-pool/providers/gh-provider`）
   - `WIF_SERVICE_ACCOUNT`: サービスアカウント（例: `cloud-run-deployer@my-project-123456.iam.gserviceaccount.com`）

**対処法**:
- 未設定の変数を追加する
- 変数名のタイポがないか確認する
- 値が正しいか確認する（特に`WIF_PROVIDER`は完全なパスが必要）

### 2. Workload Identity Federation (WIF) の設定が正しくない

**症状**: `Auth with WIF`ステップで失敗

**確認方法**:
1. GCPコンソールで `IAM & Admin` > `Workload Identity Federation` を開く
2. プールとプロバイダが作成されているか確認
3. サービスアカウントに適切な権限が付与されているか確認

**必要な権限**:
- `roles/run.admin`: Cloud Runの管理権限
- `roles/cloudbuild.builds.editor`: Cloud Buildの編集権限
- `roles/iam.serviceAccountUser`: サービスアカウントの使用権限（実行SAを指定する場合）

**対処法**:
```bash
# サービスアカウントに権限を付与
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:SERVICE_ACCOUNT_EMAIL" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:SERVICE_ACCOUNT_EMAIL" \
  --role="roles/cloudbuild.builds.editor"
```

### 3. Cloud Build APIが有効化されていない

**症状**: `gcloud builds submit`で失敗

**確認方法**:
```bash
gcloud services list --enabled | grep cloudbuild
```

**対処法**:
```bash
gcloud services enable cloudbuild.googleapis.com
```

### 4. Artifact Registryリポジトリが存在しない

**症状**: `Build & push image`ステップで失敗

**確認方法**:
```bash
gcloud artifacts repositories list --location=asia-northeast1
```

**対処法**:
```bash
# Artifact Registryリポジトリを作成
gcloud artifacts repositories create cloud-run-source-deploy \
  --repository-format=docker \
  --location=asia-northeast1 \
  --description="Cloud Run deployment images"
```

### 5. Dockerfileのビルドエラー

**症状**: `Build & push image`ステップでビルドが失敗

**確認方法**:
1. GitHub Actionsのログを確認
2. Cloud Buildのログを確認（GCPコンソール）

**対処法**:
- `Dockerfile`が正しく存在するか確認
- `public/`ディレクトリが存在するか確認（ビルドステップで生成される）
- `nginx/default.conf.template`が存在するか確認

### 6. `public/`ディレクトリが存在しない

**症状**: `Build static files`ステップで失敗、またはDockerfileのビルドで失敗

**確認方法**:
```bash
ls -la public/
```

**対処法**:
- ワークフロー内で`python3 scripts/build.py`が実行されているか確認
- ビルドスクリプトが正常に動作するか確認

### 7. GCSバケットが存在しない

**症状**: `gcloud builds submit`で`--gcs-source-staging-dir`が失敗

**確認方法**:
```bash
gsutil ls gs://run-sources-PROJECT_ID-REGION/
```

**対処法**:
```bash
# GCSバケットを作成
gsutil mb -p PROJECT_ID -l REGION gs://run-sources-PROJECT_ID-REGION/
```

## デバッグ手順

### 1. GitHub Actionsのログを確認
1. GitHubリポジトリの `Actions` タブを開く
2. 失敗したワークフロー実行をクリック
3. `deploy`ジョブをクリック
4. 各ステップのログを確認して、どのステップで失敗しているか特定

### 2. Cloud Buildのログを確認
1. GCPコンソールで `Cloud Build` > `History` を開く
2. 失敗したビルドをクリック
3. ログを確認してエラー内容を特定

### 3. ローカルでテスト
```bash
# ビルドをテスト
python3 scripts/build.py

# Dockerイメージをローカルでビルド
docker build -t misesapo-mock .

# ローカルで実行
docker run --rm -p 8080:8080 misesapo-mock
```

## よくあるエラーメッセージ

### `ERROR: Failed to extract Cloud Build ID from submit output`
- **原因**: `gcloud builds submit`の出力形式が想定と異なる
- **対処法**: ワークフローファイルの`BUILD_ID`抽出ロジックを確認

### `Permission denied`
- **原因**: サービスアカウントに必要な権限がない
- **対処法**: 上記「2. Workload Identity Federation (WIF) の設定」を参照

### `Repository not found`
- **原因**: Artifact Registryリポジトリが存在しない
- **対処法**: 上記「4. Artifact Registryリポジトリが存在しない」を参照

### `Bucket not found`
- **原因**: GCSバケットが存在しない
- **対処法**: 上記「7. GCSバケットが存在しない」を参照

## チェックリスト

デプロイが失敗した場合、以下を順番に確認してください:

- [ ] GitHubリポジトリ変数がすべて設定されている
- [ ] Workload Identity Federationが正しく設定されている
- [ ] サービスアカウントに必要な権限が付与されている
- [ ] Cloud Build APIが有効化されている
- [ ] Artifact Registryリポジトリが存在する
- [ ] GCSバケットが存在する
- [ ] `public/`ディレクトリが生成される（ビルドスクリプトが正常に動作する）
- [ ] `Dockerfile`が正しく存在する
- [ ] `nginx/default.conf.template`が存在する

