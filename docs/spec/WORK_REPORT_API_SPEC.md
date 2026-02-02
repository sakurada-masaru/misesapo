# ワークレポート（業務報告）API 仕様

## 完全新規で立ち上げる（一番早い）

**業務報告は API もテーブルも DB（DynamoDB）も全部新しく作る。既存の WORK REPORT には一切依存しない。**

| リソース | 新規で作るもの | 既存は使わない |
|----------|----------------|----------------|
| **API** | 専用ゲート **1x0f73dj2l**（misesapo-work-report） | 本番 API の work-report パスは使わない |
| **テーブル（DB）** | **misesapo-sales-work-reports**（DynamoDB） | UNIVERSAL_WORK_LOGS は使わない |
| **バケット** | **misesapo-work-reports**（S3・添付用） | 他バケットに混ぜない |

フロントは `/api-wr` で専用ゲートにプロキシ。**業務報告専用 Lambda（misesapo-work-reports）** が上記テーブル・バケットだけを参照。管理一覧は本番ゲート（51bhoxkbxd）の GET /admin/work-reports で **misesapo-reports** が上記テーブルから返す。

---

## 構成

- **業務報告専用ゲート**: **1x0f73dj2l**（REST、misesapo-work-report）。フロントは `/api-wr` でここにプロキシ。work-report・upload-url・upload-put はすべてこのゲート経由。
- **業務報告専用 Lambda**: **misesapo-work-reports**（handler: `lambda_work_reports.lambda_handler`）。上記ゲートからのみ呼ばれ、テーブル・バケットはこの Lambda 専用。作成: `./scripts/aws/create_work_reports_lambda.sh`。デプロイ: `./scripts/deploy_work_reports_lambda.sh prod`。
- **テーブル（DB）**: **misesapo-sales-work-reports**（DynamoDB・新規）。作成: `./scripts/aws/create_sales_work_reports_table.sh`。
- **管理一覧・詳細・状態変更・経理**: 専用ゲート **1x0f73dj2l**（/api-wr）の GET /admin/work-reports、GET /admin/work-reports/{id}、PATCH /admin/work-reports/{id}/state、GET /admin/payroll/{user_id}/{YYYY-MM}。**misesapo-work-reports** が処理。
- **バケット**: **misesapo-work-reports**（S3・新規）。添付は /upload-put でここに保存。

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

いずれも **認証 NONE**、統合は **Lambda プロキシ（misesapo-work-reports:prod）**。

- **営業・清掃**: 専用ゲート（/api-wr → 1x0f73dj2l）で PUT/PATCH/GET `/work-report`、POST `/upload-url`、POST `/upload-put` で保存・提出。
- **管理**: 専用ゲート（/api-wr → 1x0f73dj2l）で GET `/admin/work-reports`（一覧）、GET `/admin/work-reports/{id}`（詳細）、PATCH `/admin/work-reports/{id}/state`、GET `/admin/payroll/{user_id}/{YYYY-MM}`（経理月次）。

## ゼロから立ち上げ手順（API・テーブル・DB・バケットすべて新規）

既存の業務報告には触らず、**全部新しく作る**。一括スクリプトで実行する。

```bash
# 一括で立ち上げ（テーブル・バケット・S3/DynamoDB 権限付与・Lambda デプロイ）
./scripts/aws/setup_work_report_from_zero.sh

# 専用 API（1x0f73dj2l）もまだ無い場合は先に作成してから上を実行
./scripts/aws/setup_work_report_from_zero.sh gateway
```

**中でやっていること**: (0) オプションで専用 API 作成 → (1) テーブル misesapo-sales-work-reports 作成 → (2) バケット misesapo-work-reports 作成 → (3)(4) 実行ロールに S3/DynamoDB 権限付与 → (5) 業務報告専用 Lambda（misesapo-work-reports）の作成・デプロイ → (6) 専用 API 1x0f73dj2l を misesapo-work-reports に紐づけ。既存の WORK REPORT は使わない。

## それでなんとかなるか（確認チェック）

**業務報告専用ゲート（1x0f73dj2l）** を使う。このゲートは create_work_report_gateway.sh で作成済みで、/work-report・/upload-url・/upload-put は認証 NONE。フロントは /api-wr でここにプロキシする。

| 確認項目 | やること |
|----------|----------|
| 専用ゲート 1x0f73dj2l が「利用可能」 | コンソールで API Gateway → misesapo-work-report を確認。既にあればそのまま使用。 |
| バケットが無い | `./scripts/aws/create_work_reports_bucket.sh` → `./scripts/aws/attach_work_reports_s3_policy.sh` |
| Lambda にバケット名が渡っていない | Lambda（misesapo-work-reports）の環境変数に `WORK_REPORTS_BUCKET=misesapo-work-reports` を設定（create_work_reports_lambda.sh で自動設定） |
| 管理一覧が空 | 管理は GET /api-wr/admin/work-reports。専用 API 1x0f73dj2l に /admin/{proxy+} が misesapo-work-reports に紐づいているか確認。`./scripts/aws/setup_work_report_api_full.sh`（引数なしで 1x0f73dj2l / misesapo-work-reports）で追加可。 |
| 報告詳細URLで 404（/sales/work-reports/{id} や /office/work-reports/{id}） | (1) API Gateway: 1x0f73dj2l に /admin と /admin/{proxy+} が無いと 404。`./scripts/aws/setup_work_report_api_full.sh` で追加・デプロイ。(2) Lambda: 該当 log_id が DynamoDB（misesapo-sales-work-reports）に無いと Lambda が 404 を返す。`python3 scripts/get_work_report_by_id.py <log_id>` でテーブルに存在するか確認。Lambda の環境変数 `UNIVERSAL_WORK_LOGS_TABLE` が正しいかも確認。 |

営業日報で保存・提出 → /api-wr。管理画面で一覧・詳細・経理 → /api-wr。いずれも 200 なら通っている。

## 営業の業務報告の提出フロー（保存の流れ）

**コード上は「下書き保存 → 提出」の両方で同じ DynamoDB テーブル（misesapo-sales-work-reports）に書く実装になっている。**

| 操作 | フロント | API | Lambda（universal_work_reports） | 保存先 |
|------|----------|-----|----------------------------------|--------|
| 日次サマリを下書き保存 | `putWorkReport(body)` | PUT /work-report | `path == '/work-report'` → `table.put_item(Item=item)` | DynamoDB **misesapo-sales-work-reports**（`UNIVERSAL_WORK_LOGS_TABLE`） |
| 提出する | `patchWorkReport(log_id, { state: 'submitted', version })` | PATCH /work-report/{log_id} | `table.get_item` → `table.update_item`（state=submitted） | 同上 |

- テーブル名は Lambda の環境変数 **UNIVERSAL_WORK_LOGS_TABLE**（未設定時は `misesapo-sales-work-reports`）。リージョンは **AWS_REGION**（未設定時は `ap-northeast-1`）。
- **デプロイ時に環境変数を必ず設定する**: `./scripts/deploy_work_reports_lambda.sh prod` で `UNIVERSAL_WORK_LOGS_TABLE=misesapo-sales-work-reports` を渡している。**未デプロイや古いデプロイのままだと、Lambda が別テーブルを参照している可能性がある。**

## 保存が反映されない場合（提出後に詳細が 404）

- **UI**: 提出成功後に「サーバーに反映されていない可能性があります」と出た場合、Lambda が参照しているテーブルに書けていないか、別テーブルに書いている。
- **まず確認**: `python3 scripts/list_work_reports_table.py` で **misesapo-sales-work-reports** の件数。0 件のままなら、Lambda が別テーブルを参照しているか、PUT/PATCH の path が Lambda 側でマッチしていない（例: API Gateway の path に `/prod` が含まれている場合、Lambda で stage 除去が必要。lambda_work_reports.py で実施済み）。
- **Lambda 環境変数**: **misesapo-work-reports** の `UNIVERSAL_WORK_LOGS_TABLE` が **misesapo-sales-work-reports** であること。**再デプロイで上書きされる**: `./scripts/deploy_work_reports_lambda.sh prod`。
- **IAM**: Lambda 実行ロールにそのテーブルへの PutItem/UpdateItem/GetItem/Query/Scan 権限があること。`./scripts/aws/attach_work_reports_dynamodb_policy.sh` で付与。
- **1件確認**: `python3 scripts/get_work_report_by_id.py <log_id>` で該当レコードがあるか。ない場合は上記のいずれか（別テーブル・path 不一致・権限）を疑う。

## 営業の提出〜管理での確認：現状の課題・想定トラブル・ベストな結果

### 想定フロー（正常時）

1. **営業**: 日次サマリを下書き保存（PUT /work-report）→ 提出（PATCH /work-report/{id}）→ 社内共有URL発行
2. **共有**: 同じURL（#/sales/work-reports/{log_id}）を開く
3. **管理／本人**: ログイン後に GET /api-wr/admin/work-reports/{id} で詳細表示 → 一覧（GET /admin/work-reports）でも確認可能

### 現状の課題

| 課題 | 内容 | 影響 |
|------|------|------|
| **保存先のずれ** | Lambda の環境変数 `UNIVERSAL_WORK_LOGS_TABLE` が未設定／別名のままの可能性 | 提出は 200 でも別テーブルに書かれ、管理一覧・詳細では見えない（404） |
| **path と stage** | API Gateway の path に `/prod` が含まれると Lambda 内でルートがマッチしない | GET 詳細が 404。Lambda 側で stage 除去を実施済み（要デプロイ） |
| **テーブルが空** | 実際に `list_work_reports_table.py` で 0 件だった | 上記の「保存先ずれ」または PUT/PATCH が別 Lambda／別環境に飛んでいる可能性 |

### 想定されるトラブル

| トラブル | 原因の例 | 対処 |
|----------|----------|------|
| 提出後すぐに共有URLを開くと「Not found」 | (1) 保存が別テーブル (2) GET 詳細の path がマッチしていない | Lambda 再デプロイ（env + stage 除去）、API Gateway に /admin があるか確認 |
| 管理一覧に報告が出ない | 一覧も同じテーブルを Scan。テーブルが空 or 別テーブル参照 | `UNIVERSAL_WORK_LOGS_TABLE=misesapo-sales-work-reports` と IAM を確認、再デプロイ |
| 「サーバーに反映されていない可能性があります」 | 提出成功後に GET で確認して 404 | 上記に同じ。加えて `get_work_report_by_id.py` で DB に存在するか確認 |
| 認証エラー（401/403）で詳細が開けない | トークン未送信・期限切れ・worker_id 不一致 | 社内ログイン後に同じブラウザでURLを開く。報告本人または管理者のみ閲覧可 |

### ベストな結果（ここを目指す）

- **営業**: 下書き保存 → 提出 → 社内共有URLが発行され、同じURLを開くと**報告詳細が表示される**（Not found にならない）
- **管理**: 業務報告（管理）一覧に**提出済み報告が並び**、詳細を開いて内容・添付を確認し、必要に応じて承認・差し戻しができる
- **保存の一貫性**: すべて **misesapo-sales-work-reports**（ap-northeast-1）にのみ保存され、`list_work_reports_table.py` / `get_work_report_by_id.py` で同じ内容が確認できる

### ベストな結果に必要な実施項目

1. **Lambda の再デプロイ**  
   `./scripts/deploy_work_reports_lambda.sh prod` で、環境変数（`UNIVERSAL_WORK_LOGS_TABLE`）と stage 除去コードを反映する。
2. **API Gateway の確認**  
   1x0f73dj2l に `/admin` および `/admin/{proxy+}` が misesapo-work-reports に紐づいていること。未設定なら `./scripts/aws/setup_work_report_api_full.sh` を実行。
3. **IAM の確認**  
   misesapo-work-reports の実行ロールに、misesapo-sales-work-reports への PutItem/UpdateItem/GetItem/Query/Scan が付与されていること。`./scripts/aws/attach_work_reports_dynamodb_policy.sh` で付与可能。
4. **動作確認**  
   営業で「下書き保存 → 提出」後、`list_work_reports_table.py` で 1 件以上になること、同じ log_id で `get_work_report_by_id.py` が取得できること、共有URLで詳細が表示されることを確認する。

---

## 関連

- 403 の切り分け: `docs/spec/403_UPLOAD_AND_WORK_REPORT.md`
- **DynamoDB**: **misesapo-sales-work-reports**（`create_sales_work_reports_table.sh` で作成。既存テーブルは使わない）。Lambda 実行ロールにこのテーブルへの GetItem/PutItem/UpdateItem/Query/Scan/BatchGetItem 権限を付与すること。
- S3: **misesapo-work-reports**（`create_work_reports_bucket.sh` で作成。upload-put で添付保存）
- **業務報告専用 Lambda**: **misesapo-work-reports**（lambda_work_reports.py + universal_work_reports.py）。handler: `lambda_work_reports.lambda_handler`。環境変数: `UNIVERSAL_WORK_LOGS_TABLE=misesapo-sales-work-reports`, `WORK_REPORTS_BUCKET=misesapo-work-reports`
- 業務報告まわり（作業者・管理・経理）は **misesapo-work-reports** に統一。本番 API（51bhoxkbxd）の /admin/work-reports は使用しない。
