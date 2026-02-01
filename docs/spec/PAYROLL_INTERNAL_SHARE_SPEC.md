# 業務報告「社内共有URL」・経理向け 仕様

経理が報酬計算に使えるようにするための、社内限定のURL設計・API・画面の仕様。

---

## 1. 前提・目的

- 業務委託/社員が提出する業務報告を、経理が報酬計算に使う。
- 公開範囲は**社内のみ**。外部公開は不要。
- 同じ日に複数報告があり得るため、日付だけでは一意にならない。
- 経理のメイン導線は「**ユーザー×年月**」の月次ビュー。

---

## 2. URL 設計

| 用途 | URL | 説明 |
|------|-----|------|
| 経理・月次ビュー | `/office/payroll/{user_id}/{YYYY-MM}` | 例: `/office/payroll/W999/2026-02` |
| 個別レポート詳細 | `/office/work-reports/{report_id}` | report_id = DynamoDB の log_id |

- **share_token** による認証なしの「public URL」は**廃止**。社内ログイン必須。
- URL に時刻は入れない（ズレ・再提出・同日複数で壊れやすいため）。

---

## 3. API

### 3.1 経理・月次ビュー

- **GET /admin/payroll/{user_id}/{YYYY-MM}**
- 認証: **必須**（管理者/経理権限想定）。
- クエリ:
  - `state=approved`（デフォルト）: 支払対象（approved）のみ。
  - `state=all`: 全状態。
- レスポンス例:
  - `user_id`, `month` (YYYY-MM)
  - `total_minutes`: 合計稼働分
  - `total_amount`: 合計支払額（現状は null、将来拡張）
  - `rows`: 明細配列
    - `report_id`, `date`, `template_id`, `minutes`, `state`, `amount`（現状 null）

- 実装: **WorkerIndex**（worker_id + work_date）で Query。**Scan は使わない**。

### 3.2 個別レポート詳細

- **GET /admin/work-reports/{report_id}**
- 認証: **必須**。
- 既存の管理用詳細取得APIをそのまま利用。report_id = log_id。

### 3.3 管理側の状態変更（差し戻し・承認）

- **PATCH /admin/work-reports/{report_id}/state**
- 認証: **必須**（管理者/社内）。
- ボディ: `{ "to": "rejected" | "approved" | "triaged" | "archived", "reason"?: string, "comment"?: string, "version"?: number }`
  - **to**: 遷移先状態。`rejected`（差し戻し）のときは **reason または comment 必須**。
  - **version**: 楽観ロック用（任意）。
- 状態遷移: **submitted** / **triaged** から **approved**（承認）または **rejected**（差し戻し）に変更可能。**rejected** にした報告は作業者が再編集できる。
- フロント: 業務報告（管理）一覧（`/admin/work-reports`）の詳細モーダルで、state が submitted または triaged のときに「承認」「差し戻し」を表示。差し戻し時は理由入力必須。

### 3.4 廃止したAPI

- **GET /work-report/public/:share_token**（認証なし）→ **廃止**。社内のみのため不要。

---

## 4. フロント（画面）

| 画面 | パス | 説明 |
|------|------|------|
| 経理・月次ビュー | `/office/payroll/:userId/:yyyyMm` | 月次サマリ・明細テーブル・「支払対象のみ/全件」切替。明細から詳細へリンク。 |
| 個別レポート詳細 | `/office/work-reports/:reportId` | 報告内容の閲覧専用（社内・認証必須）。 |

- 提出後「社内共有URL」: **report_id** を使った URL（`/office/work-reports/{report_id}`）を表示・コピー。
- 管理一覧・詳細モーダル: 「個別ページを開く」は `/office/work-reports/{log_id}` にリンク。
- **管理側の状態変更**: 業務報告（管理）一覧（`/admin/work-reports`）で報告カードをクリックして詳細モーダルを開き、state が「提出済み」または「triaged」のときに **承認** または **差し戻し** を実行。差し戻し時は理由（必須）を入力。差し戻し後、作業者は営業日報画面で当該報告を再編集できる。

---

## 5. 操作フロー

### 5.1 作業者（Worker）の流れ

1. **報告入力**  
   営業日報などから「業務報告」画面（例: `/sales/report-day`）を開く。
2. **下書き保存**  
   日次サマリ・案件を入力し「日次サマリを下書き保存」「この案件を下書き保存」で **draft** として保存。
3. **提出**  
   「提出する」「この案件を提出」で **submitted** に遷移。
4. **社内共有URL**  
   提出完了後、モーダルで「社内共有URL」が表示される。  
   - URL: `/office/work-reports/{report_id}`（report_id = log_id）  
   - コピーして社内で共有可能。**閲覧は社内ログイン必須**。
5. **差戻し後**  
   事務から差戻し（rejected）された場合は、同じ画面で編集し再度下書き保存・提出。

### 5.2 事務（管理者）の流れ

1. **一覧表示**  
   「業務報告（管理）」画面（`/admin/work-reports`）を開く。日付・状態・テンプレート等でフィルタ可能。
2. **詳細確認**  
   一覧の行クリックでモーダル表示。または「個別ページを開く」で `/office/work-reports/{report_id}` を開く（別タブ可）。
3. **受付・承認・差戻し**  
   モーダルまたは詳細画面から状態を変更。  
   - **受付**: submitted → triaged  
   - **承認**: submitted / triaged → **approved**（支払対象になる）  
   - **差戻し**: submitted / triaged → rejected（理由必須）
4. **承認済み**  
   approved 以降は編集・状態変更不可（state_locked）。PDF 出力等は既存のとおり。

### 5.3 経理の流れ

1. **月次ビューを開く**  
   URL で直接指定: `/office/payroll/{user_id}/{YYYY-MM}`  
   例: `/office/payroll/W999/2026-02`
2. **表示切替**  
   - デフォルト: **支払対象（approved）のみ**（合計分・明細）  
   - 「全件」にすると submitted / rejected 等も含む
3. **明細確認**  
   表で 日付・種別・分・状態 を確認。支払計算の基礎は **approved の分のみ**。
4. **個別詳細へ**  
   明細行の「詳細」リンクで `/office/work-reports/{report_id}` を開き、内容を確認。
5. **報酬計算**  
   total_minutes（および将来の total_amount）を元に報酬計算。  
   （次フェーズ: approved スナップショット・CSV 出力を検討）

### 5.4 フロー概要図

```
[Worker] 入力 → 下書き保存(draft) → 提出(submitted)
                    ↓
[事務] 一覧で確認 → 受付(triaged) / 承認(approved) / 差戻し(rejected)
                    ↓
[経理] 月次ビュー(/office/payroll/{user_id}/{YYYY-MM}) で approved のみ集計
       → 明細の「詳細」で /office/work-reports/{report_id} を参照
```

---

## 6. 支払対象ルール

- **支払対象 = approved のみ**。
  - submitted: 未確定（支払対象に含めない）。
  - rejected: 除外。
- approved されたレポートは、支払計算の基礎値（minutes 等）を固定する方針が望ましい（変更する場合は履歴を残す想定）。

---

## 7. データ・インフラ

- **DynamoDB**: 業務報告は **misesapo-sales-work-reports**（新テーブル。既存の WORK REPORT は使わない）。WorkerIndex（worker_id, work_date）で月次取得。
- **S3（業務報告専用）**: バケット **misesapo-work-reports** に添付ファイル（`reports/日付/`）と PDF エクスポート（`work-reports/report_id/`）を保存。Lambda の環境変数 **WORK_REPORTS_BUCKET=misesapo-work-reports** を設定すると利用。作成: `./scripts/aws/create_work_reports_bucket.sh`。権限付与: `./scripts/aws/attach_work_reports_s3_policy.sh`（ポリシー定義は `scripts/aws/iam/work-reports-s3-policy.json`）。
- **share_token**: 項目は提出時に保存するが、**社内導線では参照しない**。将来、認証必須の短縮URLを復活させる場合は **GSI(share_token)** を追加し **Query** で取得（Scan 禁止）。

---

## 8. 次フェーズで検討する項目

- **approved スナップショット**: approved 時点の minutes 等を固定保存する仕組み。
- **CSV 出力**: 月次ビューまたは管理一覧の明細を CSV で出力（経理の報酬計算用）。

詳細は [PAYROLL_NEXT_PHASE.md](./PAYROLL_NEXT_PHASE.md) を参照。

---

## 9. 関連ドキュメント

- 状態遷移: [WORK_REPORT_STATE_TRANSITION.md](./WORK_REPORT_STATE_TRANSITION.md)
- 次フェーズ検討: [PAYROLL_NEXT_PHASE.md](./PAYROLL_NEXT_PHASE.md)
