# AWS コンソールで見る時の一覧

このプロジェクトで使っている AWS リソースを、コンソールで確認しやすいようにまとめています。  
**リージョンはすべて `ap-northeast-1`（東京）** です。

---

## リージョン

| リージョン | 用途 |
|------------|------|
| **ap-northeast-1** | API Gateway / Lambda / DynamoDB / S3 / Cognito すべて |

コンソール右上で **アジアパシフィック (東京) ap-northeast-1** を選択してから各サービスを開いてください。

---

## 1. API Gateway

| 項目 | 値 |
|------|-----|
| **メイン API（misogi / 業務報告等）** | API ID: **51bhoxkbxd** |
| 本番 URL | `https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod` |
| **サブ API** | API ID: **2z0ui5xfxb** |

**コンソール**: API Gateway → API 一覧 → 該当 API を選択。

- **51bhoxkbxd**: work-report, upload-url, admin/work-reports, admin/payroll などメイン API。Lambda **misesapo-reports** に紐づく想定。
- リソース／メソッドで `POST /upload-url` や `GET /work-report` が Lambda に渡るか確認できます（`{proxy+}` の場合はすべて Lambda に転送）。

---

## 2. Lambda

| 項目 | 値 |
|------|-----|
| **関数名** | **misesapo-reports** |
| エイリアス | **prod**（本番） |
| デプロイ | `./scripts/deploy_lambda.sh misesapo-reports prod lambda_function.py` |

**コンソール**: Lambda → 関数 → `misesapo-reports`。

- コード: `lambda_function.py` + `universal_work_reports.py` 等がデプロイされている。
- 環境変数: `UNIVERSAL_WORK_LOGS_TABLE`, `S3_BUCKET_NAME`, `UPLOAD_BUCKET`, `S3_REGION` などを確認可能。

---

## 3. DynamoDB

| テーブル名 | 用途 |
|------------|------|
| **misesapo-sales-work-reports** | 業務報告（work-report）の本文・メタデータ・状態。専用ゲート 1x0f73dj2l 用。既存の WORK REPORT（UNIVERSAL_WORK_LOGS）は使わない。作成: `./scripts/aws/create_sales_work_reports_table.sh` |
| business-announcements | お知らせ |
| staff-reports | スタッフレポート |
| misesapo-clients | 顧客 |
| misesapo-brands | ブランド |
| misesapo-stores | 店舗 |
| attendance | 勤怠 |
| その他 | lambda_function.py で参照しているテーブル多数 |

**コンソール**: DynamoDB → テーブル → 上記テーブル名で検索。

- 業務報告の保存先: **misesapo-sales-work-reports**（デフォルト。環境変数 `UNIVERSAL_WORK_LOGS_TABLE` で上書き可）。既存の UNIVERSAL_WORK_LOGS は使わない。

---

## 4. S3

| バケット名 | ARN（例） | 用途 |
|------------|-----------|------|
| **misesapo-work-reports** | `arn:aws:s3:::misesapo-work-reports` | **業務報告専用**。POST /upload-url の添付ファイル（`reports/日付/`）、業務報告 PDF エクスポート（`work-reports/report_id/`）。Lambda の環境変数 **WORK_REPORTS_BUCKET=misesapo-work-reports** を設定するとここに保存。作成: `./scripts/aws/create_work_reports_bucket.sh`。権限: `./scripts/aws/attach_work_reports_s3_policy.sh` |
| **misesapo-cleaning-manual-images** | `arn:aws:s3:::misesapo-cleaning-manual-images` | デフォルトの S3（`S3_BUCKET_NAME` 未設定時）。画像アップロード・清掃マニュアル。`WORK_REPORTS_BUCKET` 未設定時は upload-url・PDF もここを使用 |
| **misesapo-data** | `arn:aws:s3:::misesapo-data` | プライベートバケット。顧客データ・マスター・エクスポート・バックアップ（`exports/`, `masters/`, `backups/`, `migrations/`）。EC2 のスケジュールエクスポート（`schedules_export.json` 等）でも使用 |

**業務報告を専用バケットに保存する場合**

1. バケット作成: `./scripts/aws/create_work_reports_bucket.sh`（`misesapo-work-reports` を作成）
2. Lambda（misesapo-reports）の環境変数に **WORK_REPORTS_BUCKET=misesapo-work-reports** を追加
3. Lambda 実行ロールへ S3 権限を付与: `./scripts/aws/attach_work_reports_s3_policy.sh`（ポリシー定義は `scripts/aws/iam/work-reports-s3-policy.json`）
4. Lambda を再デプロイ

**コンソール**: S3 → バケット一覧 → 上記バケットを選択。

- 業務報告の添付パス: `reports/{YYYY-MM-DD}/{UUID}_{ファイル名}`。
- 業務報告の PDF パス: `work-reports/{report_id}/export_*.pdf`。
- **バケットが空の場合**: まだ誰も添付をアップロードしていない、または PDF エクスポートを実行していない状態ではオブジェクトが 0 件で正常です。業務報告で「添付」を追加して保存すると `reports/` 以下にオブジェクトが作成されます。PDF エクスポート実行時は最小限の PDF を S3 に配置してから署名 URL を返すため、リンクを開いても「オブジェクトがありません」にはなりません。
- **misesapo-data** の構造例: `docs/DATA_ARCHITECTURE.md` 参照。

---

## 5. Cognito

| 項目 | 値 |
|------|-----|
| **User Pool ID** | **ap-northeast-1_EDKElIGoC** |
| アプリクライアント | ブラウザ用（シークレットなし）。Client ID は cognitoConfig.js 等に記載 |
| 用途 | ログイン・ID Token（Bearer）発行。API Gateway の認証に利用 |

**コンソール**: Cognito → ユーザープール → `ap-northeast-1_EDKElIGoC`。

- ユーザー一覧・アプリクライアント設定・ドメインなどをここで確認できます。

---

## 6. アカウント・権限

- **デプロイスクリプト** (`deploy_lambda.sh`) では **ACCOUNT_ID=475462779604** を参照。
- Lambda に「API Gateway から呼ばれる」権限（`lambda:InvokeFunction`）と、DynamoDB / S3 へのアクセス権限が必要です。  
  これらは Lambda の実行ロール（IAM）で確認できます。

---

## 早見表（コピー用）

```
リージョン:     ap-northeast-1
API Gateway:    51bhoxkbxd (prod)
Lambda:         misesapo-reports (alias: prod)
DynamoDB:       misesapo-sales-work-reports（業務報告。既存 WORK REPORT は使わない）
S3:             misesapo-work-reports（業務報告専用）, misesapo-cleaning-manual-images（デフォルト）, misesapo-data（プライベート・データ用）
Cognito Pool:   ap-northeast-1_EDKElIGoC
本番 API URL:   https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod
```
