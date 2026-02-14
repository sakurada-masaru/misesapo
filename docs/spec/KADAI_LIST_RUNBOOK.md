# Kadaiリスト（運用ツール）Runbook

目的: 顧客クレーム/社内課題を「項目」として管理し、`torihikisaki/yagou/tenpo/jinzai` と紐付けて追跡する。

## UI
- 管理エントランス: `運用ツール > Kadaiリスト`
- URL: `#/admin/kadai`

## データモデル（最小）
- `kadai_id` (PK) `KADAI#...`
- `name` (件名)
- `category` (例: complaint/ops/quality/…)
- `status` (例: open/in_progress/done/…)
- `priority` (low/mid/high/critical)
- `source` (customer/internal/partner/unknown)
- `reported_at` (YYYY-MM-DD)
- `reported_by` (窓口)
- `torihikisaki_id` / `yagou_id` / `tenpo_id` / `jinzai_id`（任意）
- `fact`（事実・短文）
- `request`（要件/課題定義・短文）
- `plan`（対応方針・短文）
- `result`（結果/メモ・短文）
- `jotai` (`yuko|torikeshi`)
- `created_at` / `updated_at`

注: 現場に作文を要求しない（AGENTS.md準拠）。自由文は管理側の整理用途で、文字数を制限して運用する。

## API（マスタAPIに追加）
- `GET  /master/kadai?limit=200&jotai=yuko&category=...&status=...`
- `POST /master/kadai`
- `PUT  /master/kadai/{kadai_id}`
- `DELETE /master/kadai/{kadai_id}` -> `jotai=torikeshi`

実装: `lambda_torihikisaki_api.py` に `kadai` collection を追加。

## DynamoDB テーブル作成（例）

```bash
REGION="ap-northeast-1"
TABLE="kadai"

aws dynamodb create-table \
  --table-name "$TABLE" \
  --attribute-definitions AttributeName=kadai_id,AttributeType=S \
  --key-schema AttributeName=kadai_id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region "$REGION"

aws dynamodb wait table-exists --table-name "$TABLE" --region "$REGION"
```

## Lambda 環境変数（例）

```bash
REGION="ap-northeast-1"
LAMBDA_NAME="misesapo-torihikisaki-data-api"

aws lambda update-function-configuration \
  --function-name "$LAMBDA_NAME" \
  --region "$REGION" \
  --environment "Variables={TABLE_TORIHIKISAKI=torihikisaki,TABLE_YAGOU=yagou,TABLE_TENPO=tenpo,TABLE_SOUKO=souko,TABLE_TENPO_KARTE=tenpo_karte,TABLE_JINZAI=jinzai,TABLE_SERVICE=service,TABLE_KADAI=kadai,STORAGE_BUCKET=torihikisaki-souko}"
```

## デプロイ
既存の `misesapo-torihikisaki-data-api` へ `lambda_torihikisaki_api.py` を zip 化して更新する（今までと同じ手順）。

