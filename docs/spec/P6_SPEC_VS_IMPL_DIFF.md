# P6 仕様書 vs 実装 差異メモ

仕様書（P6_REQUEST_P6_UNIFIED.md / P6_PHASE1_PHASE2_ORDER.md）と、実際のコード・ファイルを照合した差異。戻ってきたときに「受け入れ条件チェック手順」「変更ファイル一覧」の次に確認すると事故りにくい。

---

## 1. 仕様で言及されているが未実装／未対応

| 項目 | 仕様 | 実装 | 推奨 |
|------|------|------|------|
| **only_actionable** | GET の default で「from/to/**only_actionable** の default を安全側に」 | GET 一覧は `from`/`to`/`states` のみ。`only_actionable` パラメータは未実装 | 空配列対策は直近7日＋states で対応済み。`only_actionable` は必要なら後で「操作可能な状態のみ」フィルタとして追加 |
| **archived 操作** | PATCH state の to: **triaged \| approved \| rejected \| archived** | BE は `archived` を許可。**FE に「アーカイブ」ボタンなし**（submitted/triaged 時の受付・承認・差戻しのみ） | 詳細画面で state が submitted/triaged/approved のとき「アーカイブ」ボタンを出し分け可能（仕様どおりにするなら追加） |
| **403 に reason** | not_authorized → 管理者ロール案内 | 403 は `{ "error": "Forbidden" }` のみ。**reason: "not_authorized" は返していない** | 403 時に body に `reason: "not_authorized"` を入れると FE で「管理者ロール確認」案内に統一しやすい |

---

## 2. 実装バグ／挙動リスク（対応済み）

| 項目 | 内容 | 対応 |
|------|------|------|
| **一覧 scan の日付フィルタ** | GET 一覧のフォールバック scan で日付フィルタに `report_date` を使うと、テーブルが **work_date** のみ持つ場合に効かない | **対応済み**: scan_filter を `Attr('work_date')` で実施するよう `universal_work_reports.py` を修正済み |

---

## 3. 別仕様書（WORK_REPORT_SYSTEM_SPEC）との関係

- **WORK_REPORT_SYSTEM_SPEC.md**: 状態に `reviewing` / `returned` / `fixed` を定義。
- **P6 統合仕様**: 状態は **triaged / approved / rejected / archived**（受付・承認・差戻し・アーカイブ）。
- **実装**: P6 に合わせて **triaged, approved, rejected, archived** を採用。  
→ 現行実装は P6 に準拠。WORK_REPORT_SYSTEM_SPEC との対応は `WORK_REPORT_SPEC_TO_IMPL.md` 参照。

---

## 4. 受け入れ・配信まわり

| 項目 | 内容 |
|------|------|
| **/office/work-reports の URL** | **対応済み**: `scripts/build.py` に **entrance/office → public/office** の出力マッピングを追加済み。本番 URL は **`/office/work-reports/`** で一致。 |
| **universal_work_reports.py の同梱** | **対応済み**: `deploy_lambda.sh` が **lambda_package を生成**（mkdir + ルートから universal_work_reports.py をコピー）してから ZIP するため、.gitignore で lambda_package/ が無くても再現性あり。 |

---

## 5. 一致している点（仕様どおり）

- GET /admin/work-reports: 200、body に `items` と `rows`、直近7日 default。
- PATCH /admin/work-reports/{id}/state: to=triaged|approved|rejected|archived、rejected 時 reason 必須、409 で **reason** 文字列（invalid_transition, state_locked, reason_required, version_mismatch）。
- FE: 認可ガード（Cognito JWT）、一覧・行クリックで詳細、受付/承認/差戻し、409 時トースト＋再読み込み CTA、差戻し理由モーダル、PDF は approved かつ CLEANING_PDF のみ表示。
- Lambda: `/admin/work-reports` を `handle_admin_work_reports` にルーティング。

---

## 6. その他（参照用）

| 項目 | 内容 |
|------|------|
| **LINE_CHECKLIST.md** | **作成済み**: P6 完了判定・運用で回り続ける条件を記載。finalize 前にここを完了させる。 |
| **TODO_CONFLICTS.md** | **作成済み**: 既知のズレ・保留・仕様競合を列挙。握りつぶさない運用の付録。 |
| **RUNBOOK_RELEASE.md** | **作成済み**: 本番リリース手順を1ページに固定（静的 / Lambda / 確認 / ロールバック）。 |
| **ビルド・デプロイ** | 静的: `.github/workflows/pages.yml` → `scripts/build.py` → `public/`。Lambda: `scripts/deploy_lambda.sh`（lambda_package を生成してから ZIP）。詳細は RUNBOOK_RELEASE.md。 |

---

以上。差異を直す場合は「受け入れ条件」「変更ファイル一覧」を更新すること。
