# GitHubへのアップロード手順

このガイドでは、ミセサポプロジェクトをGitHubにアップロードする手順を説明します。

## 前提条件

- GitHubアカウントを持っている
- Gitがインストールされている（`git --version` で確認可能）

## 手順

### 1. Gitリポジトリの初期化（完了済み）

```bash
cd "/Users/sakuradamasaru/Downloads/MisesapoRenewal-main 5"
git init
git branch -M main
```

### 2. 初回コミット

```bash
git add .
git commit -m "Initial commit: ミセサポリニューアルプロジェクト"
```

### 3. GitHubでリポジトリを作成

1. GitHubにログイン: https://github.com
2. 右上の「+」ボタンをクリック → 「New repository」を選択
3. リポジトリ設定を入力：
   - **Repository name**: `MisesapoRenewal` （お好みの名前）
   - **Description**: 「ミセサポリニューアル - デザインモックアップ開発」
   - **Visibility**: Public または Private（お好みで）
   - **Initialize this repository with**: すべてチェックを外す（既にローカルにファイルがあるため）
4. 「Create repository」をクリック

### 4. リモートリポジトリを追加

GitHubで作成したリポジトリのURLをコピーして、以下のコマンドを実行：

```bash
# 例: https://github.com/your-username/MisesapoRenewal.git
git remote add origin https://github.com/your-username/MisesapoRenewal.git
```

**注意**: `your-username` をあなたのGitHubユーザー名に置き換えてください。

### 5. ファイルをGitHubにプッシュ

```bash
git push -u origin main
```

初回プッシュ時、GitHubの認証情報が求められます：
- **Personal Access Token** を使用する場合が推奨されます
- または、GitHub CLI (`gh`) を使用している場合は自動認証されます

### 6. 認証エラーが発生した場合

#### Personal Access Token を使用する方法

1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. 「Generate new token (classic)」をクリック
3. スコープで以下を選択：
   - `repo` (すべてのリポジトリへのアクセス)
4. 「Generate token」をクリック
5. トークンをコピー（一度しか表示されません）
6. プッシュ時にパスワードの代わりにトークンを入力

または、URLにトークンを含める：

```bash
git remote set-url origin https://YOUR_TOKEN@github.com/your-username/MisesapoRenewal.git
git push -u origin main
```

## 今後の更新方法

ファイルを変更した後、以下のコマンドで更新をプッシュできます：

```bash
git add .
git commit -m "変更内容の説明"
git push
```

## 注意事項

### .gitignore について

以下のファイル・ディレクトリは自動的に除外されます：
- `/public/` - ビルド出力（生成されるファイル）
- `.DS_Store` - macOSのシステムファイル
- `__pycache__/` - Pythonのキャッシュファイル
- `*.pyc` - Pythonのコンパイル済みファイル

### 機密情報について

以下の情報は**絶対にコミットしないでください**：
- APIキー
- パスワード
- 個人情報（顧客データなど本番環境のデータ）
- `.env` ファイル（環境変数）

必要に応じて `.env.example` を作成し、`.env` を `.gitignore` に追加してください。

## GitHub Actions について

このプロジェクトには `.github/workflows/deploy.yml` が含まれています。これは Cloud Run への自動デプロイ設定です。

GitHubにプッシュした後、以下の設定が必要です：

1. GitHubリポジトリの Settings → Secrets and variables → Actions
2. 以下の変数を追加：
   - `GCP_PROJECT_ID`
   - `CLOUD_RUN_SERVICE`
   - `CLOUD_RUN_REGION`
   - `WIF_PROVIDER`
   - `WIF_SERVICE_ACCOUNT`

詳細は `README.md` の「Cloud Run 手動デプロイ」セクションを参照してください。

## トラブルシューティング

### リモートリポジトリのURLを確認

```bash
git remote -v
```

### リモートリポジトリを変更

```bash
git remote set-url origin https://github.com/your-username/new-repo-name.git
```

### 強制プッシュ（注意：通常は不要）

```bash
git push -f origin main
```

**警告**: 強制プッシュは既存の履歴を上書きするため、他の人と共同作業している場合は使用しないでください。

---

**作成日**: 2025年3月


