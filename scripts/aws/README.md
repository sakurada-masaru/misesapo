# scripts/aws — AWS 関連スクリプト・設定

業務報告用 S3 や Lambda 実行ロールなど、AWS リソース用のスクリプトと設定を置くディレクトリです。

## 構成

| パス | 説明 |
|------|------|
| **create_sales_work_reports_table.sh** | 営業用業務報告 DynamoDB テーブル（misesapo-sales-work-reports）を作成。専用ゲート 1x0f73dj2l 用。既存テーブルは使わない。 |
| **create_work_reports_bucket.sh** | 業務報告用 S3 バケット（misesapo-work-reports）を作成 |
| **attach_work_reports_s3_policy.sh** | Lambda 実行ロールに業務報告用 S3 への権限を付与 |
| **iam/work-reports-s3-policy.json** | 上記で付与する IAM ポリシー定義（PutObject / GetObject / ListBucket） |

## 業務報告（専用ゲート 1x0f73dj2l）のセットアップ手順

1. `./scripts/aws/create_sales_work_reports_table.sh` — 営業用業務報告テーブル作成（新API用。既存テーブルは使わない）
2. Lambda（misesapo-reports）の環境変数に `UNIVERSAL_WORK_LOGS_TABLE=misesapo-sales-work-reports` を設定
3. `./scripts/aws/create_work_reports_bucket.sh` — バケット作成
4. Lambda の環境変数に `WORK_REPORTS_BUCKET=misesapo-work-reports` を追加
5. `./scripts/aws/attach_work_reports_s3_policy.sh` — 実行ロールへ S3 権限付与
6. `./scripts/deploy_lambda.sh misesapo-reports prod lambda_function.py` — Lambda デプロイ

詳細はルートの `docs/AWS_CONSOLE_REF.md` を参照。
