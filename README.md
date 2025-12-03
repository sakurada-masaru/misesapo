# MisesapoRenewal — デザインモックアップ開発ガイド

## 目的
本リポジトリは、デザインモックアップ（静的な HTML/CSS/JS）をローカルまたはコンテナで動かしながら作り進める最小環境です。将来的には別プロジェクトで Laravel / Rails などの MVC 実装へ移行しますが、その前段として「部分テンプレート対応の簡易テンプレート生成（ビルド）」を整えます。

## ドキュメント

プロジェクトのドキュメントは `docs/` ディレクトリにあります。93個のドキュメントをカテゴリ別に整理したインデックスは以下を参照してください：

📚 **[ドキュメントインデックス](docs/DOCUMENTATION_INDEX.md)** - すべてのドキュメントをカテゴリ別に整理

### よく使うドキュメント
- **AWS設定**: [AWS Lambda + API Gateway セットアップ](docs/AWS_LAMBDA_API_GATEWAY_SETUP.md)
- **AWS移行**: [FirebaseからAWSへの移行ガイド](docs/AWS_MIGRATION_GUIDE.md)
- **GitHub認証**: [GitHub PAT セットアップ](docs/GITHUB_PAT_SETUP.md)
- **プッシュ前確認**: [GitHub アップロードチェックリスト](docs/GITHUB_UPLOAD_CHECKLIST.md)

## 現状のディレクトリ構成
```
public/            # 生成物（配信対象・Git 追跡しない）
  index.html
  login.html
  signup.html
  report.html
  mypage.html
  styles.css       # 共通スタイル
nginx/
  default.conf.template
Dockerfile         # Nginx で配信（Cloud Run など想定）
README.md, AGENTS.md
```

## 起動方法
ローカルの簡易サーバまたは Docker を利用できます。

### 開発用サーバー（推奨：サービス管理機能付き）
営業事務の方がブラウザからサービスページを編集できる機能付きサーバーです。

```bash
# 初回のみビルド
python3 scripts/build.py

# 開発サーバーを起動（静的ファイル配信 + API機能）
python3 scripts/dev_server.py

# ブラウザで http://localhost:5173 を開く
```

**機能:**
- 静的ファイル配信（通常のページ表示）
- API機能（サービス登録・編集・削除）
- 自動ビルド（フォーム送信時に自動的にページを生成）

**注意:** シークレットキーや`.env`ファイルは**不要**です。AWS S3を使わない場合はローカルストレージで動作します。シークレットキーを要求された場合は、別のスクリプト（例: `upload_wiki_to_s3.py`）を実行した可能性があります。通常の開発サーバー起動では必要ありません。

### 静的ファイル配信のみ（従来の方法）
- Python 簡易サーバ:
  - まずビルド: `python3 scripts/build.py`
  - 配信: `python3 -m http.server 5173 --directory public`
  - 開発:`python3 scripts/dev_server.py`
  - ブラウザで `http://localhost:5173` を開く
- Node のワンショット配信:
  - まずビルド: `python3 scripts/build.py`
  - 配信: `npx serve public`
- Docker（Nginx）:
  - ビルド: `docker build -t misesapo-mock .`
  - 実行: `docker run --rm -p 8080:8080 misesapo-mock`
  - ブラウザで `http://localhost:8080` を開く

## Cloud Run 手動デプロイ（--source .）
Cloud Run にソースから直接デプロイします。リポジトリ直下にある `Dockerfile` を Cloud Build が検出してビルドします（レジストリの事前準備は不要）。

### 前提条件
- gcloud CLI が導入済み（`gcloud --version`）。
- GCP プロジェクトが課金有効化済み。
- 初回は必要な API を有効化（実行時に自動で促される場合あり）。

```bash
# 変数（必要に応じて置き換え）
PROJECT_ID="your-project-id"
REGION="asia-northeast1"      # 例: 東京
SERVICE="misesapo-mock"       # Cloud Run サービス名

gcloud auth login
gcloud config set project "${PROJECT_ID}"
gcloud config set run/region "${REGION}"

# 初回のみ: 必要な API を有効化（自動有効化される場合はスキップ可）
gcloud services enable run.googleapis.com cloudbuild.googleapis.com
```

### デプロイ（ソースから）
```bash
# このリポジトリのルートで実行
gcloud run deploy "${SERVICE}" \
  --source . \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated

# デプロイ URL を確認
gcloud run services describe "${SERVICE}" \
  --region "${REGION}" \
  --format='value(status.url)'
```

メモ:
- `Dockerfile` が存在するため、自動的に Docker ビルドが走ります。特別なビルド設定は不要です。
- 必要な API の有効化を求められたら指示に従ってください（手動でのレジストリ作成は不要）。
- 本コンテナは `PORT` 環境変数で起動ポートを受け取り Nginx を起動します。Cloud Run 側のポート指定は不要です。

## ビルド運用（重要）
- `public/` は自動生成物です。直接編集せず、`src/pages/`（必要なら `src/partials/`, `src/layouts/`）を編集してください。
- アセットは `src/assets/` に配置してください（例: `src/assets/styles.css`）。ビルド時に `public/` 配下へコピーされます。
- 生成: `python3 scripts/build.py`（`src/pages/**/*.html` を生成し、`src/assets/**` を `public/` にコピー）。
- Git: `public/` は `.gitignore` で除外しています。

### レスポンシブ設計ルール（SP対応方針）
- ブレークポイント: `--bp-xs:480px`, `--bp-sm:640px`, `--bp-md:768px`, `--bp-lg:1024px`, `--bp-xl:1280px`
- コンテナ幅: `--container-sm:640px`, `--container-md:768px`, `--container-lg:1024px`, `--container-xl:1280px`
- 代表ユーティリティ:
  - 表示切替: `.hide-sm`（SPで非表示）, `.show-sm`（SPで表示）
  - レイアウト: `.grid`, `.stack`, `.row`, `.stack-on-sm`（SPで縦積み）
  - テーブル横スクロール: `.table-wrap > .table`
  - 余白/間隔: `.gap-8/12/16/24`, `.p-16/24`, `.px-16`, `.py-16`
- 画像: 既定で `img { max-width:100%; height:auto; }`。必要に応じて `srcset`/`sizes` を付与。

### テンプレートの使い方
- 共通レイアウト: `src/layouts/base.html`
- 共通部品: `src/partials/*.html`（例: `header.html`, `footer.html`）
- ページからの読み込み: `@include('partials.header')` のように `@include` を使用
- データ注入: `@json('path/to.json', $var)` → 簡易 `@foreach $var ... @endforeach` で展開

### ヘッダー管理（ロール毎のヘッダー）
- ロール毎に異なるヘッダーを表示（IDベースで管理）
- 詳細仕様: `docs/HEADER_ROLE_MANAGEMENT.md` を参照
- 実装ファイル:
  - `src/partials/header-{role}.html` - 各ロール用ヘッダー
  - `src/assets/js/navigation.js` - ヘッダー切り替えロジック
  - `src/assets/js/role_config.js` - ロール設定とナビゲーション定義
- **注意**: `index.html` は対象外（独自のヘッダー構造を維持）

### 画像最適化ポリシー
- 可能な箇所で `srcset`/`sizes` を付与（例: ヒーロー画像）。
- 将来的に WebP/AVIF を追加（フォールバックPNG/JPEGを併用）。
- アイコンは順次 SVG へ移行。

## CI/CD（GitHub Actions 自動デプロイ）
`main` に push された最新コミットをトリガーに、静的ビルド（`scripts/build.py`）→ Cloud Run へのデプロイ（ソースから）まで自動化しています。

- ワークフロー: `.github/workflows/deploy-cloudrun.yml`
- トリガー: `push`（ブランチ `main`）
- 実行手順:
  - Python をセットアップし、`python3 scripts/build.py` を実行して `src/pages/**/*.html` を `public/` 配下に生成。
  - Workload Identity Federation（推奨）で GCP に認証。
  - `google-github-actions/deploy-cloudrun@v2` の `source: .` を用いて Cloud Run へデプロイ。

### 必要なリポジトリ変数 / シークレット
リポジトリの Settings > Secrets and variables > Actions で以下を設定してください。

- 変数（Variables）
  - `GCP_PROJECT_ID`: GCP プロジェクトID
  - `CLOUD_RUN_SERVICE`: Cloud Run サービス名（例: `misesapo-mock`）
  - `CLOUD_RUN_REGION`: リージョン（例: `asia-northeast1`）
  - `WIF_PROVIDER`: WIF プロバイダ（例: `projects/123.../locations/global/workloadIdentityPools/gh-pool/providers/gh-provider`）
  - `WIF_SERVICE_ACCOUNT`: 偽装するサービスアカウント（例: `cloud-run-deployer@<PROJECT_ID>.iam.gserviceaccount.com`）

- 代替（推奨しない）: サービスアカウント鍵での認証を行う場合は、
  - シークレット（Secrets）に `GCP_SA_KEY` を JSON で保存し、ワークフロー内のコメントアウト部分を有効化してください。

### 必要な API / 権限
- 有効化 API: `run.googleapis.com`, `cloudbuild.googleapis.com`
- サービスアカウント権限（WIF 経由で偽装されるSA）:
  - 必須: `roles/run.admin`, `roles/cloudbuild.builds.editor`
  - 実行SAを指定/利用する場合: その実行SAに対する `roles/iam.serviceAccountUser`

### 補足
- コンテナは `PORT` 環境変数に追従して Nginx を起動するため、Cloud Run 側のポート設定は不要です。
- このワークフローは並列実行抑止（`concurrency`）を設定し、`main` への連続 push があっても最後の1つだけが反映されやすい構成にしています。
- ブランチ名やサービス名を変更する場合は、`.github/workflows/deploy-cloudrun.yml` を編集してください。

## 作業ルール（抜粋）
- 新規ページは `public/` 直下に `*.html` として追加し、必要に応じてナビゲーションからリンク。
- スタイルは当面 `public/styles.css` に集約（分割が必要になったら検討）。
- 命名・コード規約、コミット/PR ルールは `AGENTS.md` を参照。

## 次のステップ（簡易テンプレート生成）
静的モックの制作効率と一貫性を高めるため、Python 製の最小テンプレート生成エンジンを導入します。部分テンプレート（ヘッダー/フッター等）を共通化し、ビルドで `public/` に HTML を生成します。

- 目的: 手作業のコピペを排除し、共通パーツとレイアウトを再利用可能にする。
- コア機能: 変数置換、`layout` 適用、`include` での部分テンプレート読み込み。
- 想定構成（導入後）:
  - `src/layouts/` レイアウト（例: `base.html`）
  - `src/partials/` 共通部品（例: `header.html`, `footer.html`）
  - `src/pages/` 各ページのソース（例: `index.html`, `login.html`）
  - `scripts/build.py` 簡易ビルダー（`src/pages` → `public/*.html` を生成）
- ビルド実行例（予定）:
  - `python3 scripts/build.py`（`src/pages/*.html` を走査→出力先は `public/`）
- 運用方針:
  - 導入後は `public/*.html` を直接編集しない。ソース（`src/`）を編集→ビルド→プレビュー。
  - CSS/画像など静的アセットはこれまで通り `public/` 配下に配置。

将来（テンプレート生成が安定後）に MVC 実装へ移行します。その際は、分割粒度・変数命名・スタイル変数（色/間隔/タイポ）を整理して移植性を高めます。

## GitHub認証設定（PAT）

GitHubへのプッシュ時に認証エラーが発生する場合は、PAT（Personal Access Token）を設定してください。

### クイックセットアップ

```bash
# 設定スクリプトを実行
./scripts/setup_github_pat.sh
```

### 詳細手順

詳細な手順は `docs/GITHUB_PAT_SETUP.md` を参照してください。

- PATの作成方法
- キーチェーンへの保存方法
- トラブルシューティング
