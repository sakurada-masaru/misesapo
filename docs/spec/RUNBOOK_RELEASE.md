# 本番リリース手順（Runbook）

静的と Lambda の両方を扱う場合の「1ページに固定」した手順。P6 運用の参照用。

---

## 前提

- 対象: misesapo
- 静的: GitHub Pages（CNAME: misesapo.co.jp）
- API: API Gateway + Lambda（51bhoxkbxd / ap-northeast-1）、alias: stg / prod
- stg で受け入れ → prod に反映

---

## 1. 静的（フロント）のデプロイ

| 手順 | 内容 |
|------|------|
| ビルド | `python3 scripts/build.py`（CI では .github/workflows/pages.yml が実行） |
| 出力 | `public/` に出力。`/office/work-reports` は `public/office/work-reports/` に出力される |
| 配信 | GitHub Pages に `public/` をデプロイ。CNAME があれば https://misesapo.co.jp で配信 |

**確認**: ブラウザで `https://misesapo.co.jp/office/work-reports/` が開くこと（404 でない）。

---

## 2. API（Lambda）のデプロイ

| 手順 | コマンド・内容 |
|------|----------------|
| デプロイ | `cd /path/to/misesapo` の上で `./scripts/deploy_lambda.sh misesapo-reports <stg\|prod> lambda_function.py` |
| 内容 | lambda_package をスクリプト内で生成 → ZIP に同梱 → Lambda 更新 → バージョン発行 → 指定 alias をそのバージョンに更新 |
| 先に stg | まず `stg` でデプロイし、受け入れ条件を確認してから `prod` でデプロイ |

**確認**: 下記「3. 確認」を実施。

---

## 3. 確認（curl / CloudWatch / 主要画面）

| 確認項目 | 方法 |
|----------|------|
| GET /admin/work-reports | `curl -s -o /dev/null -w "%{http_code}" "https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/<stg\|prod>/admin/work-reports" -H "Authorization: Bearer $TOKEN"` → 200 期待 |
| GET /work-report（Worker 回帰） | 同上で `/work-report`（Bearer は Worker トークン） → 200 期待 |
| CloudWatch | Lambda のログで import エラーや 5xx が無いこと |
| 主要画面 | 本番で `/office/work-reports` を開き、一覧・詳細・状態更新ができること |

---

## 4. ロールバック（Lambda のみ）

直前のバージョンに戻す場合:

```bash
# 現在の alias が指すバージョンを確認
aws lambda get-alias --function-name misesapo-reports --name prod --region ap-northeast-1

# 前のバージョン番号を指定して alias を更新
aws lambda update-alias --function-name misesapo-reports --name prod --function-version <前のバージョン番号> --region ap-northeast-1
```

静的のロールバックは GitHub の履歴から該当コミットを再デプロイする。

---

## 5. 参照

- 受け入れ条件の実行順: `P6_PHASE1_PHASE2_ORDER.md`
- 変更ファイル一覧: 同ファイル内
- 差異・注意: `P6_SPEC_VS_IMPL_DIFF.md`
- 完了判定: `LINE_CHECKLIST.md`
