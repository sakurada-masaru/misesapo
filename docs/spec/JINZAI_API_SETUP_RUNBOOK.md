# JINZAI API セットアップ手順（CLI）

## 1. 目的

`jinzai` ドメインのDB/Lambda/API Gatewayを新規作成し、
人材データの投入を可能にする。

## 2. 前提

- AWS CLI で `ap-northeast-1` にアクセス可能
- IAM権限（DynamoDB/Lambda/APIGateway/S3）がある
- S3バケット `jinzai-kaban` が作成済み

## 3. 実行

```bash
cd /Users/sakuradamasaru/Desktop/misesapo
chmod +x scripts/setup_jinzai_api.sh
REGION=ap-northeast-1 API_NAME=jinzai-data STAGE=prod LAMBDA_NAME=misesapo-jinzai-data-api KABAN_BUCKET=jinzai-kaban ./scripts/setup_jinzai_api.sh
```

出力例:

- `API_ID=xxxxxxxxxx`
- `BASE=https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/prod`

## 4. 疎通確認

```bash
BASE="https://<API_ID>.execute-api.ap-northeast-1.amazonaws.com/prod"
AUTH="Authorization: Bearer $(cat ~/.cognito_token)"

curl -i -H "$AUTH" "$BASE/jinzai?limit=3"
curl -i -H "$AUTH" "$BASE/jinzai/busho?limit=3"
curl -i -H "$AUTH" "$BASE/jinzai/shokushu?limit=3"
```

## 5. 一括投入

```bash
python3 scripts/import_jinzai_to_api.py \
  --base "$BASE" \
  --jinzai-csv "docs/spec/templates/jinzai_import_ready.csv" \
  --busho-csv "docs/spec/templates/jinzai_busho_master.csv" \
  --shokushu-csv "docs/spec/templates/jinzai_shokushu_master.csv" \
  --jinzai-endpoint "/jinzai" \
  --busho-endpoint "/jinzai/busho" \
  --shokushu-endpoint "/jinzai/shokushu"
```
