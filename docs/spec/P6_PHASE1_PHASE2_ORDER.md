# P6 統合実装（Phase1 優先 → Phase2）

**方針: PHASE 1 を先に完了してから PHASE 2 に着手する。同時着手禁止（散りやすい）。**

---

## 受け入れ条件チェック手順（実行順）

### Phase 1 受け入れ（本番で確認）

1. **表示**  
   `https://misesapo.co.jp/office/work-reports` が本番で表示される（404 でない）。

2. **一覧 API**  
   画面表示後、`GET /admin/work-reports` が 200 を返し、rows が描画される。

3. **詳細・状態更新**  
   詳細で `PATCH /admin/work-reports/{id}/state` が通り、state と history が更新される。

4. **409 対応**  
   409 は必ず `reason` を返す。UI は ⚠ 表示 + 再読み込み導線を出す。

### Phase 2 受け入れ（stg で OK → prod）

5. **missing-detector**  
   stg で手動 invoke → `ops_events` に `WORK_REPORT_MISSING_DETECTED` が入る。

6. **通知**  
   stg で Slack 通知（またはログ通知）が出る。

7. **Runbook**  
   `scripts/runbooks/alias_verify.sh` がローカルで実行できる。

8. **回帰**  
   既存の `/work-report` 本番動作（200）が維持される。

---

## 変更ファイル一覧（Phase 1）

| ファイル | 内容 |
|----------|------|
| `docs/spec/P6_PHASE1_PHASE2_ORDER.md` | 本ファイル（受け入れ・手順・一覧） |
| `docs/spec/P6_REQUEST_P6_UNIFIED.md` | 依頼書コピー |
| `lambda_function.py` | `/admin/work-reports` を `handle_admin_work_reports` にルーティング、`handle_admin_work_reports` を import |
| `universal_work_reports.py` | GET 一覧: 直近7日 default・`rows` 返却／PATCH state: 409 で `reason` 必須（_admin_409）、楽観ロック |
| `src/pages/entrance/office/work-reports/index.html` | 新規: 一覧テーブル・詳細・受付/承認/差戻し・409 トースト・再読み込み CTA・差戻し理由モーダル・PDF（approved + CLEANING_PDF） |
| `src/assets/js/office-work-reports.js` | 新規: getAuthToken, fetchAdminReports, fetchReportDetail, patchState, exportPdf, handle409, stateLabel |

**ルーティング**: 本番で `https://misesapo.co.jp/office/work-reports` が表示されるよう、ビルド／配信で `src/pages/entrance/office/work-reports/index.html` を `/office/work-reports`（または `/office/work-reports/`）にマッピングすること。404 対策は SPA/SSR 構成に合わせてリライト or artifact 配置で対応。

---

## 実行手順（Phase 1）

### デプロイ前

- `universal_work_reports.py` を Lambda ZIP に含めること。  
  - 現行 `deploy_lambda.sh` は `lambda_package/*.py` のみ同梱するため、  
    **ルートにしか無い場合は `lambda_package/` にコピーするか、スクリプトを修正してルートの `universal_work_reports.py` を ZIP に追加すること。**

### デプロイ

```bash
cd /path/to/misesapo
./scripts/deploy_lambda.sh misesapo-reports prod lambda_function.py
```

### stg 検証

```bash
# 1) GET /admin/work-reports（200 + rows/items）
curl -s "https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/stg/admin/work-reports" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# 期待: 200、body に items または rows

# 2) PATCH state（1件）
# log_id を上記レスポンスの 1 件の log_id に置換
curl -s -X PATCH "https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/stg/admin/work-reports/<log_id>/state" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"to":"triaged"}'
# 期待: 200

# 3) 409 確認（rejected で reason なし）
curl -s -X PATCH "https://.../stg/admin/work-reports/<log_id>/state" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"to":"rejected"}'
# 期待: 400 または 409、body に reason が含まれること
```

### prod 反映

- stg で受け入れ条件 1〜4 を確認後、上記 deploy で prod alias を更新。
- フロント: `/office/work-reports` が本番で表示されるよう、ビルド／配信で該当 HTML をマッピングする。

---

以上
