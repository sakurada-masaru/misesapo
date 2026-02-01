# ワークレポート（業務報告）API 仕様

## 完全新規で立ち上げる（一番早い）

**業務報告は API もテーブルも DB（DynamoDB）も全部新しく作る。既存の WORK REPORT には一切依存しない。**

| リソース | 新規で作るもの | 既存は使わない |
|----------|----------------|----------------|
| **API** | 専用ゲート **1x0f73dj2l**（misesapo-work-report） | 本番 API の work-report パスは使わない |
| **テーブル（DB）** | **misesapo-sales-work-reports**（DynamoDB） | UNIVERSAL_WORK_LOGS は使わない |
| **バケット** | **misesapo-work-reports**（S3・添付用） | 他バケットに混ぜない |

フロントは `/api-wr` で専用ゲートにプロキシ。Lambda はデフォルトで上記テーブルだけ参照。管理一覧は本番ゲート（51bhoxkbxd）の GET /admin/work-reports で同じ Lambda が上記テーブルから返す。

---

## 構成（上記のまま）

- **業務報告専用ゲート**: **1x0f73dj2l**（REST、misesapo-work-report）。フロントは `/api-wr` でここにプロキシ。work-report・upload-url・upload-put はすべてこのゲート経由。
- **テーブル（DB）**: **misesapo-sales-work-reports**（DynamoDB・新規）。Lambda はこのテーブルだけを参照（デフォルト。環境変数 `UNIVERSAL_WORK_LOGS_TABLE` で上書き可）。作成: `./scripts/aws/create_sales_work_reports_table.sh`。
- **管理一覧**: 本番ゲート **51bhoxkbxd**（/api）の GET /admin/work-reports?from=...&to=... で取得。同じ Lambda が上記テーブルから返す。
- **バケット**: **misesapo-work-reports**（S3・新規）。添付は /upload-put でここに保存。Lambda の環境変数 `WORK_REPORTS_BUCKET=misesapo-work-reports` と IAM 権限が必要。

## 認証方針

- **API Gateway**: 認証 **NONE**（入り口は通す）
- **Lambda**: `Authorization: Bearer <Cognito ID Token>` を検証し、`user_info` を取得。未認証は 401、他人の報告操作は 403

## ルート一覧（業務報告専用ゲート 1x0f73dj2l = /api-wr で使用するパス）

| パス | メソッド | 用途 |
|------|----------|------|
| `/work-report` | GET | 一覧取得（?date= 等） |
| `/work-report` | PUT | 下書き保存 |
| `/work-report` | POST | （submit 等は PATCH /work-report/{id} で実施） |
| `/work-report/{id}` | GET | 1件取得 |
| `/work-report/{id}` | PATCH | 更新・提出 |
| `/upload-url` | POST | Presigned URL 発行（添付用） |
| `/upload-put` | POST | ファイルを base64 で送り、Lambda が S3 に PUT（CORS 回避） |

## アップロードの流れ

1. フロント: **POST /upload-url** で `{ filename, mime, size, context, date, storeKey? }` → `{ uploadUrl, fileUrl, key }`
2. フロント: **POST /upload-put** で `{ uploadUrl, contentType, fileBase64 }` → Lambda が Presigned URL 宛に PUT（ブラウザは S3 に直接触らない）
3. 制限: Lambda 6MB のため、実質約 4.5MB までのファイル

## API Gateway で必要なリソース

- `/work-report` … GET, PUT, OPTIONS（既存）
- `/work-report/{id}` … GET, PATCH, OPTIONS
- `/upload-url` … POST, OPTIONS
- `/upload-put` … POST, OPTIONS

いずれも **認証 NONE**、統合は **Lambda プロキシ（misesapo-reports:prod）**。

- **営業・清掃**: 専用ゲート（/api-wr → 1x0f73dj2l）で PUT/PATCH/GET `/work-report`、POST `/upload-url`、POST `/upload-put` で保存・提出。
- **管理**: 本番ゲート（/api → 51bhoxkbxd）で GET `/admin/work-reports?from=...&to=...` で一覧取得。

## ゼロから立ち上げ手順（API・テーブル・DB・バケットすべて新規）

既存の業務報告には触らず、**全部新しく作る**。順番に実行すればよい。

```bash
# 1) 専用 API 作成（まだ無い場合）
./scripts/aws/create_work_report_gateway.sh
# → 1x0f73dj2l が作成され、docs/spec/WORK_REPORT_GATEWAY_URL.txt に URL が書かれる。
#    vite は 1x0f73dj2l をハードコードしているので、既にあればスキップ可。

# 2) 業務報告用テーブル（DynamoDB）を新規作成
./scripts/aws/create_sales_work_reports_table.sh
# → misesapo-sales-work-reports が作成される。

# 3) 業務報告用 S3 バケットを新規作成
./scripts/aws/create_work_reports_bucket.sh
# → misesapo-work-reports が作成される。

# 4) Lambda にバケット権限付与
./scripts/aws/attach_work_reports_s3_policy.sh

# 5) Lambda に新テーブルへの DynamoDB 権限があるか確認（実行ロールに misesapo-sales-work-reports への GetItem/PutItem/UpdateItem/Query/Scan を付与）

# 6) Lambda デプロイ（テーブル名・バケット名はデフォルトで新規のものが使われる）
./scripts/deploy_lambda.sh misesapo-reports prod lambda_function.py
```

これで **API（専用ゲート）・テーブル（DB）・バケット** がすべて新規で立ち上がる。既存の WORK REPORT は使わない。

## それでなんとかなるか（確認チェック）

**業務報告専用ゲート（1x0f73dj2l）** を使う。このゲートは create_work_report_gateway.sh で作成済みで、/work-report・/upload-url・/upload-put は認証 NONE。フロントは /api-wr でここにプロキシする。

| 確認項目 | やること |
|----------|----------|
| 専用ゲート 1x0f73dj2l が「利用可能」 | コンソールで API Gateway → misesapo-work-report を確認。既にあればそのまま使用。 |
| バケットが無い | `./scripts/aws/create_work_reports_bucket.sh` → `./scripts/aws/attach_work_reports_s3_policy.sh` |
| Lambda にバケット名が渡っていない | Lambda（misesapo-reports）の環境変数に `WORK_REPORTS_BUCKET=misesapo-work-reports` を設定 |
| 管理一覧が空 | 管理は GET /api/admin/work-reports（51bhoxkbxd）。本番 API に /admin/work-reports が Lambda に紐づいているか確認 |

営業日報で保存・提出 → /api-wr（1x0f73dj2l）。管理画面で一覧 → /api（51bhoxkbxd）。両方 200 なら通っている。

## 関連

- 403 の切り分け: `docs/spec/403_UPLOAD_AND_WORK_REPORT.md`
- **DynamoDB**: **misesapo-sales-work-reports**（`create_sales_work_reports_table.sh` で作成。既存テーブルは使わない）。Lambda 実行ロールにこのテーブルへの GetItem/PutItem/UpdateItem/Query/Scan/BatchGetItem 権限を付与すること。
- S3: **misesapo-work-reports**（`create_work_reports_bucket.sh` で作成。upload-put で添付保存）
- Lambda: **misesapo-reports**（universal_work_reports.py + lambda_function.py）。テーブルはデフォルト **misesapo-sales-work-reports**（環境変数 `UNIVERSAL_WORK_LOGS_TABLE` で上書き可）
