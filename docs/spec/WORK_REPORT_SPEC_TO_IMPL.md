# 作業報告システム 仕様書 ↔ 現行実装マッピング

仕様書（WORK_REPORT_SYSTEM_SPEC.md）と、現行の `universal_work_reports.py` / API の対応を整理する。今後の実装で仕様に揃える際の参照用。

---

## ステータス

| 仕様書       | 現行実装（universal_work_reports） | 備考           |
| --------- | -------------------------------- | ------------ |
| draft     | draft                            | 一致          |
| submitted | submitted                        | 一致          |
| reviewing | （なし）→ triaged に相当する可能性   | 要追加検討      |
| returned  | rejected の「差し戻し」として扱う場合あり | 仕様は returned→draft |
| approved  | approved                         | 一致          |
| fixed     | （なし）                         | 管理責任者のみ。要追加 |
| rejected  | rejected                         | 一致          |

---

## API パス

| 仕様書（例）                    | 現行                         | 備考        |
| ------------------------- | -------------------------- | --------- |
| POST /work-reports        | PUT /work-report（upsert）  | 単数形で運用中 |
| PUT /work-reports/{id}    | PUT /work-report（bodyにlog_id） | 同上        |
| POST .../submit           | PATCH /work-report（state→submitted） | 提出        |
| POST .../approve, /return, /reject | /admin/work-reports 側で状態遷移 | 管理者用     |
| POST .../fix              | （未実装）                    | 確定は要実装   |

---

## データ項目

| 仕様書           | 現行（UNIVERSAL_WORK_LOGS 想定） | 備考     |
| ------------- | ------------------------------- | ------ |
| report_id     | log_id                         | 同一概念  |
| worker_id     | worker_id                      | 一致    |
| contract_id   | （未実装）                       | 要追加   |
| project_id    | （未実装）                       | 要追加   |
| work_date     | work_date / date               | 一致    |
| start_time    | start_at                       | 一致    |
| end_time      | end_at                         | 一致    |
| break_minutes | break_minutes                  | 一致    |
| total_minutes | work_minutes                   | 一致    |
| work_type     | （category 等に相当する可能性）     | 要マッピング |
| task_contents | description / deliverables     | 要マッピング |
| before/after_photos | （S3キー等で別管理の可能性）      | 要確認   |
| status        | state                          | 一致    |
| submitted_at  | last_submitted_at 等           | 要確認   |
| admin_comment | 管理コメント用フィールド             | 要確認   |
| audit_log     | history                        | 監査は history で対応 |

---

## 権限・役割

| 仕様書   | 現行                         |
| ----- | -------------------------- |
| 作業者   | Worker（Cognito 等）         |
| 管理者   | is_hr_admin 等で判定          |
| 管理責任者 | 未分化の場合は管理者と同一。要ロール追加 |

---

## 今後の実装で揃えたい点（例）

1. **ステータス**: reviewing / returned / fixed の正式追加と遷移ルールの統一。
2. **API パス**: 必要に応じて `/work-reports`（複数形）への統一またはエイリアス。
3. **項目**: contract_id, project_id, before_photos, after_photos, admin_comment のスキーマ追加。
4. **確定（fix）**: 管理責任者のみ実行可能な「確定」操作と API の追加。
5. **監査**: audit_log と history の役割分担（または history を audit_log として仕様書と対応づけ）。
