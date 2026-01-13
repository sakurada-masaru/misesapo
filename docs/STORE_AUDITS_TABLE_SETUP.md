# DynamoDB テーブル作成手順：misesapo-store-audits

## 概要
店舗査定（Before/Afterスコア）を保存するためのテーブルを作成します。

## テーブル仕様

| 項目 | 値 |
|:---|:---|
| テーブル名 | `misesapo-store-audits` |
| パーティションキー | `id` (String) |
| 課金モード | オンデマンド（推奨）または プロビジョンド |
| リージョン | ap-northeast-1 |

## AWS CLI コマンド

```bash
aws dynamodb create-table \
  --table-name misesapo-store-audits \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
  --key-schema \
    AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region ap-northeast-1
```

## データ構造

```json
{
  "id": "AUD-20260113-001",
  "store_id": "STR00001",
  "store_name": "晩杯屋 門前仲町店",
  "type": "before",
  "total_score": 42,
  "total_rank": "B",
  "location_results": [
    {
      "locationId": "kitchen",
      "locationLabel": "厨房全体",
      "score": 38,
      "rank": "C",
      "photoUrl": "https://...",
      "issues": ["油の固着", "埃の蓄積"],
      "deductions": [
        {"type": "oil", "severity": "high", "points": -25}
      ],
      "restoration_plan": "厨房分解洗浄",
      "required_points": 21.5
    }
  ],
  "auditor_id": "WRK00001",
  "auditor_name": "田中太郎",
  "cycle": 1,
  "created_at": "2026-01-13T05:00:00.000Z",
  "updated_at": "2026-01-13T05:00:00.000Z"
}
```

## GSI（グローバルセカンダリインデックス）- 任意

店舗IDでの検索を高速化する場合：

```bash
aws dynamodb update-table \
  --table-name misesapo-store-audits \
  --attribute-definitions \
    AttributeName=store_id,AttributeType=S \
    AttributeName=created_at,AttributeType=S \
  --global-secondary-index-updates \
    "[{\"Create\":{\"IndexName\":\"store_id-created_at-index\",\"KeySchema\":[{\"AttributeName\":\"store_id\",\"KeyType\":\"HASH\"},{\"AttributeName\":\"created_at\",\"KeyType\":\"RANGE\"}],\"Projection\":{\"ProjectionType\":\"ALL\"}}}]" \
  --region ap-northeast-1
```

## 確認

テーブル作成後、以下のコマンドで確認：

```bash
aws dynamodb describe-table --table-name misesapo-store-audits --region ap-northeast-1
```

## Lambda関数のデプロイ

テーブル作成後、更新した`lambda_function.py`をLambdaにデプロイしてください。

```bash
# lambda_function.pyをzipに固め、デプロイ
cd /Users/sakuradamasaru/Desktop/misesapo-main
zip -r lambda_function.zip lambda_function.py
aws lambda update-function-code \
  --function-name misesapo-s3-upload \
  --zip-file fileb://lambda_function.zip \
  --region ap-northeast-1
```
