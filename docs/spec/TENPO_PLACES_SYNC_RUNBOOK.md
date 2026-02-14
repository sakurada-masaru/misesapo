# Tenpo Places Sync Runbook

## 目的
`tenpo` に Google Places 由来の情報（電話番号/営業時間/Place ID）を安全に反映する。

- 既定は **dry-run**（書き込みなし）
- `--apply` 指定時のみ `PUT /master/tenpo/{tenpo_id}` を実行

## スクリプト
- `scripts/sync_tenpo_places_details.py`

## 事前準備
- Places API が有効な Google API キー
  - 推奨: `GOOGLE_MAPS_API_KEY` 環境変数
- Master API が稼働していること
- 認証トークン（`~/.cognito_token`）

## dry-run
```bash
cd /Users/sakuradamasaru/Desktop/misesapo
export GOOGLE_MAPS_API_KEY="***"

python3 scripts/sync_tenpo_places_details.py \
  --base "https://jtn6in2iuj.execute-api.ap-northeast-1.amazonaws.com/prod"
```

## apply
```bash
cd /Users/sakuradamasaru/Desktop/misesapo
export GOOGLE_MAPS_API_KEY="***"

python3 scripts/sync_tenpo_places_details.py \
  --base "https://jtn6in2iuj.execute-api.ap-northeast-1.amazonaws.com/prod" \
  --apply
```

## 主なオプション
- `--overwrite`
  - 既存 `phone` / `opening_hours` / `address` / `map_url` を上書き
- `--sleep-sec`
  - Places API 呼び出し間隔（既定 `0.05` 秒）
- `--limit-tenpo`
  - 取得上限（既定 `20000`）
- `--api-key`
  - APIキーを引数で直接指定（通常は環境変数推奨）

## 反映フィールド
- `maps_place_id`
- `maps_name`
- `phone`
- `phone_international`
- `opening_hours`（JSON）
- `google_map_url` / `map_url`
- `website`
- `maps_source` = `google_places`
- `maps_updated_at` = UTC ISO8601

## 生成レポート
- `docs/spec/tenpo_places_sync_YYYYmmdd_HHMMSS.csv`
  - `status`: `PLAN` / `NO_CHANGE` / `NO_MATCH` / `DETAIL_EMPTY` / `LOOKUP_NG:*`

## 注意
- Places API の料金が発生するため、最初は dry-run で件数確認する。
- `NO_MATCH` は店舗名揺れによる未一致。必要なら `address` を先に整備して再実行する。
