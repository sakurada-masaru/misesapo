# Lambda デプロイ ZIP 検証

## 目的

`misesapo-reports` をデプロイする際、ZIP に `universal_work_reports.py` が含まれていないと本番で `import universal_work_reports` が失敗し、GET /work-report が 503 になる。  
デプロイ前に ZIP 内容を確認する手順を残す。

## デプロイ時の同梱ルール（scripts/deploy_lambda.sh）

- **ソースが `lambda_function.py` の場合**
  - `lambda_package/*.py` をすべて ZIP ルートに同梱（`zip -j` でパスを落とす）
  - 続けてルートの `lambda_function.py`, `misogi_flags.py`, `misogi_schemas.py` を追加（handler はルート版で上書き）
  - `universal_work_reports.py` が ZIP に含まれていなければスクリプトがエラー終了する

## ローカルで ZIP 内容を確認する手順

リポジトリルートで実行:

```bash
cd /path/to/misesapo
TEMP_ZIP="/tmp/lambda_verify.zip"
for f in lambda_package/*.py; do [[ -f "$f" ]] && zip -j "$TEMP_ZIP" "$f"; done
for f in lambda_function.py misogi_flags.py misogi_schemas.py; do [[ -f "$f" ]] && zip -j "$TEMP_ZIP" "$f"; done
unzip -l "$TEMP_ZIP" | grep universal_work_reports.py   # 必ず 1 行出ること
rm -f "$TEMP_ZIP"
```

`universal_work_reports.py` が 1 行表示されれば OK。

## universal_work_reports.py の import 依存

- 標準庫: `json`, `os`, `uuid`, `datetime`, `decimal`
- AWS: `boto3`, `botocore.exceptions`
- ローカル .py は不要（Lambda ランタイムに boto3 は含まれる）

## 完了条件

- `./scripts/deploy_lambda.sh misesapo-reports prod lambda_function.py` 実行後、
- `GET https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod/work-report?date=2026-01-29` が 503 ではなく 200/401/404 など「処理が進む」状態になること。
