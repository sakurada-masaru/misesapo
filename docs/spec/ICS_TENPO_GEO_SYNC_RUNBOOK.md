# ICS -> Tenpo Geo Sync Runbook

## 目的
Googleカレンダー由来のICSから `tenpo` を照合し、`address` / `map_url`（`google_map_url` も同値）を安全に反映する。

- 既定は **dry-run**（書き込みなし）
- `--apply` 指定時のみ `PUT /master/tenpo/{tenpo_id}` を実行

## スクリプト
- `scripts/sync_tenpo_geo_from_ics.py`

## 前提
- Master API が稼働していること（`/master/tenpo`）
- 認証トークンが `~/.cognito_token` にあること（または `--token-file` 指定）
- ICSファイルを取得済みであること

## 実行（dry-run）
```bash
cd /Users/sakuradamasaru/Desktop/misesapo
python3 scripts/sync_tenpo_geo_from_ics.py \
  --ics-path "/Users/sakuradamasaru/Downloads/basic.ics" \
  --base "https://jtn6in2iuj.execute-api.ap-northeast-1.amazonaws.com/prod" \
  --min-score 84
```

### dry-runで確認するポイント
- `candidate_updates` が妥当件数か
- 生成CSV:
  - `docs/spec/ics_tenpo_geo_matched_*.csv`
  - `docs/spec/ics_tenpo_geo_unmatched_*.csv`
- `matched_by` / `score` / `summary` が期待どおりか

## 本反映（apply）
```bash
cd /Users/sakuradamasaru/Desktop/misesapo
python3 scripts/sync_tenpo_geo_from_ics.py \
  --ics-path "/Users/sakuradamasaru/Downloads/basic.ics" \
  --base "https://jtn6in2iuj.execute-api.ap-northeast-1.amazonaws.com/prod" \
  --min-score 84 \
  --apply
```

## オプション
- `--overwrite`
  - 既存 `address` / `map_url` が入っていても上書きする
- `--token-file`
  - 認証トークンのパスを変更
- `--report-dir`
  - レポート出力先（既定: `docs/spec`）

## 反映フィールド
- `address`
- `map_url`
- `google_map_url`
- `geo_source` = `ics_import`
- `geo_updated_at` = UTC ISO8601

## マッチング概要
- 候補文字列:
  - `SUMMARY`（清掃種別プレフィックス除去）
  - `LOCATION` 先頭
  - `DESCRIPTION` 補助
- 照合:
  - 正規化一致（全角空白/記号/会社接頭辞除去）
  - 部分一致
  - 類似度（SequenceMatcher）

## 注意
- 同名店舗・似た名称の誤マッチを防ぐため、必ず dry-run でCSV確認後に apply すること。
- 本スクリプトは `tenpo` のみ更新する。`torihikisaki` / `yagou` は更新しない。

