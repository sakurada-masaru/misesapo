# v1 データ所在マップ（顧客・サービス・認証）

v1（MISESAPO / legacy）の AWS 構成から、**Source of Truth（所在）** を一覧化したもの。  
秘密情報（secret value, token, password）は含めない。所在・方式・関連リソース名のみ。

---

## 1. データ種別 → 所在一覧

| Data | Source of Truth | Table / Bucket / リソース | API（v1） | Lambda / ハンドラ | Note |
|------|-----------------|---------------------------|-----------|-------------------|------|
| **Customer（顧客/法人）** | DynamoDB | `misesapo-clients` | （管理画面経由・API は要確認） | lambda_function.py（CLIENTS_TABLE） | 顧客マスタ |
| **Brand（ブランド）** | DynamoDB | `misesapo-brands` | （管理画面経由） | lambda_function.py（BRANDS_TABLE） | ブランドマスタ |
| **Store（店舗）** | DynamoDB | `misesapo-stores` | （管理画面経由） | lambda_function.py（STORES_TABLE） | 店舗マスタ |
| **Karte（カルテ）** | DynamoDB | `UNIVERSAL_WORK_LOGS`（環境変数 `UNIVERSAL_WORK_LOGS_TABLE` で上書き可） | GET/PUT/PATCH `/work-report` | universal_work_reports.py | 業務報告・営業カルテ・清掃レポート等を一元。template_id / target_label で種別分岐 |
| **Service Items（サービス内容）** | リポジトリ | `legacy/misesapo v1/src/data/service_items.json` | 静的配信 or API 要確認 | — | サービスカタログ。清掃レポートのテンプレ分岐に流用可能（別 doc 参照） |
| **添付（Attachments）** | S3 | バケット名: 環境変数 `S3_BUCKET_NAME`（デフォルト `misesapo-cleaning-manual-images`） | v1: POST `/upload`（画像） / v2 想定: POST `/upload-url` → Presigned PUT | lambda_function.py（handle_image_upload, upload_report_image 等） | 画像・PDF 等。report-images テーブルにメタデータ |
| **添付メタデータ** | DynamoDB | `report-images` | （Lambda 内で put_item / scan） | lambda_function.py | レポート画像の key・日付・カテゴリ等 |
| **Auth Users（認証ユーザ）** | Cognito | User Pool ID: `ap-northeast-1_EDKElIGoC`（lambda_function.py 記載） | ログイン・トークン発行は Cognito が担当 | cognito_client（boto3 cognito-idp） | ユーザ一覧は取得しない（個人情報） |
| **権限/ロール** | IAM + アプリロール | IAM ロールは Lambda 実行ロール等。アプリ側は user_info / role で admin, sales, cleaning 等を判定 | API Gateway Authorizer または Lambda 内で user_info 検証 | lambda_function.py（user_info を Authorizer から受け取る想定） | Authorizer 有無は `aws apigateway get-authorizers` で確認 |

---

## 2. 認証の方式（v1 推定）

| 項目 | 内容 |
|------|------|
| **認証基盤** | Cognito User Pool（`ap-northeast-1_EDKElIGoC`） |
| **トークン** | JWT（Cognito 発行の ID Token / Access Token を想定） |
| **API 認証** | API Gateway Authorizer（Cognito または Custom）で JWT 検証 → Lambda に user_info 渡す想定。実際の Authorizer 設定は `get-authorizers` で確認 |
| **フロントのトークン取得** | ログイン画面で Cognito Hosted UI または SDK（amplify/auth）でサインイン → トークンを保持して API リクエストの Authorization に付与する想定 |

※ 秘密情報（Client Secret, トークン値）は本ドキュメントに記載しない。

---

## 3. v1 で参照している DynamoDB テーブル（lambda_function.py より）

- `business-announcements` / `business-announcement-reads` … お知らせ
- `staff-reports` … スタッフ報告
- `cleaning-logs` … 清掃ログ
- `nfc-tags` … NFC タグ
- `schedules` … スケジュール（Google Calendar 同期等）
- `estimates` … 見積
- `workers` / `worker-availability` … 作業者
- **`misesapo-clients`** … 顧客（法人）
- **`misesapo-brands`** … ブランド
- **`misesapo-stores`** … 店舗
- `attendance` / `attendance-errors` / `attendance-requests` … 勤怠
- `holidays` … 祝日
- `inventory-items` / `inventory-transactions` … 在庫
- `daily-reports` … 日報
- `todos` … ToDo
- `misesapo-reimbursements` … 経費精算
- **`report-images`** … レポート画像メタデータ
- `misesapo-store-audits` … 店舗監査
- `staff-report-approvals` … 報告承認
- `report-flags-v2` … 報告フラグ
- **`UNIVERSAL_WORK_LOGS`**（universal_work_reports.py） … 業務報告・カルテ・レポート一元テーブル

---

## 4. v2 で流用できるか（判断の目安）

| データ | 流用の目安 |
|--------|------------|
| Customer / Brand / Store | v1 の DynamoDB を参照する API を v2 から呼ぶ、または v2 用にマイグレーション。v2 顧客登録（localStorage）は別ソース。 |
| Karte（業務報告） | v1 は `UNIVERSAL_WORK_LOGS` + `/work-report`。v2 は同じ API（PUT/PATCH/GET /work-report）を想定して実装済み。テーブル名・環境変数を揃えれば流用可能。 |
| Service Items | リポジトリの `service_items.json` を v2 で静的配信 or API 化。清掃レポートのテンプレ分岐に利用可能。 |
| 添付 | v1 は `/upload`（画像）と S3。v2 は `/upload-url`（Presigned）仕様で設計済み。同一 S3 バケットを指定すれば保存先は統一可能。 |
| 認証 | Cognito User Pool は v1 と共通化可能。v2 フロントで Cognito SDK または Hosted UI を導入すれば、同一プールでログイン可能。 |

---

## 5. 追加で取得する AWS 情報（CLI）

所在を確定するために、以下を実行して `aws_inventory/` に出力する想定（秘密は取得しない）。

- **Cognito**: `list-user-pools`, `list-identity-pools`（必要なら describe-user-pool / list-user-pool-clients）
- **API Gateway**: `get-authorizers`（REST API ID を指定）… 認証方式の所在確認
- **S3**: `list-buckets`（必要なら get-bucket-cors / get-bucket-location）
- **Secrets Manager**: `list-secrets` のみ（**get-secret-value は実行しない**）
- **CloudFront**: `list-distributions`（fileUrl が CDN の場合）
- **IAM**: `list-roles`（Lambda 実行ロール等。必要なら misesapo 系のみ抽出）
- **DynamoDB**: `list-tables`（必要なら describe-table で候補テーブル）

実行例: `bash docs/aws_inventory_commands.sh`（スクリプト内で上記のうち主要なものを実行し、結果を `aws_inventory/` に保存）。
