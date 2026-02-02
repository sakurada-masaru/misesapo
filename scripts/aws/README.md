# scripts/aws — AWS 関連スクリプト・設定

業務報告用 S3 や Lambda 実行ロールなど、AWS リソース用のスクリプトと設定を置くディレクトリです。

## 構成

| パス | 説明 |
|------|------|
| **setup_work_report_from_zero.sh** | **業務報告をゼロから一括立ち上げ**（テーブル・バケット・S3/DynamoDB 権限・Lambda デプロイ）。引数 `gateway` で専用 API も新規作成。 |
| **create_sales_work_reports_table.sh** | 営業用業務報告 DynamoDB テーブル（misesapo-sales-work-reports）を作成。既存テーブルは使わない。 |
| **create_work_reports_bucket.sh** | 業務報告用 S3 バケット（misesapo-work-reports）を作成 |
| **attach_work_reports_s3_policy.sh** | Lambda 実行ロールに業務報告用 S3 への権限を付与 |
| **attach_work_reports_dynamodb_policy.sh** | Lambda 実行ロールに misesapo-sales-work-reports への DynamoDB 権限を付与 |
| **iam/work-reports-s3-policy.json** | S3 用 IAM ポリシー定義 |
| **iam/work-reports-dynamodb-policy.json** | DynamoDB 用 IAM ポリシー定義 |

## 業務報告をゼロから立ち上げる（推奨）

```bash
./scripts/aws/setup_work_report_from_zero.sh
# 専用 API（1x0f73dj2l）がまだ無い場合: ./scripts/aws/setup_work_report_from_zero.sh gateway
```

上記でテーブル・バケット・権限・Lambda デプロイまで一括で完了する。既存の WORK REPORT には触らない。

詳細はルートの `docs/AWS_CONSOLE_REF.md` を参照。
