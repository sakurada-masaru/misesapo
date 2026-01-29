# 依頼: P6 統合実装（Phase1: 管理UI実用化 + Phase2: 運用レイヤ基盤）

**PHASE 1 を先に完了してから PHASE 2 に着手する。同時着手禁止（散りやすい）。**

返ってきたらまず見るもの: **受け入れ条件チェック手順**（`P6_PHASE1_PHASE2_ORDER.md`）と **変更ファイル一覧**（同ファイル内）。

---

- 対象: misesapo
- AWS Region: ap-northeast-1
- 前提: /work-report(Worker) 回帰ゼロ、stg で受け入れ→prod、alias 運用維持

---

## PHASE 1: 管理UIを「事務が迷わず使える」状態に

### 目的
本番で /office/work-reports にアクセスすると、一覧→詳細→受付(triaged)/承認(approved)/差戻し(rejected+reason)/PDF生成が業務として使える状態にする。

### 最優先の受け入れ条件
- https://misesapo.co.jp/office/work-reports が本番で表示される
- 画面表示後、GET /admin/work-reports が 200 を返し rows が描画される
- 詳細で PATCH /admin/work-reports/{id}/state が通り、state と history が更新される
- 409 は必ず reason を返し、UI は ⚠ 表示 + 再読み込み導線を出す

### 実装タスク（順番固定）
1. FE: /office/work-reports ルートを本番配信 (404対策)
2. FE: admin認可ガード（Cognito JWT）を接続 (403/ログインループ対策)
3. BE: GET /admin/work-reports の初期クエリを安全化 (空配列になりにくい default)
4. FE: 一覧テーブル + 行クリックで詳細遷移
5. BE: PATCH /admin/work-reports/{id}/state 実装/確認（to: triaged|approved|rejected|archived、rejected は reason 必須、409 + reason）
6. FE: 操作ボタンの表示条件を仕様通りに出し分け
7. FE: bulk/state は後回し、まず単体操作を完成
8. PDF: approved かつ CLEANING_PDF のみ表示、失敗時は toast+ステータス表示

### 仕様（厳守）
- 409 reason（BE は必ず文字列）: invalid_transition, state_locked, reason_required, version_mismatch/concurrent_update, not_authorized
- UI: invalid_transition/state_locked → トースト+ボタン無効化; version_mismatch/concurrent_update → トースト+再読み込みCTA; reason_required → モーダル必須; not_authorized → 管理者ロール案内

### 追加注意
- GET /admin/work-reports が空配列にならないよう from/to/only_actionable の default を安全側に（直近7日等）
- ルーティングは SPA/SSR に合わせて 404 を潰す
- 認可は Admin ロールが通ることを最優先

---

## PHASE 2: 運用レイヤ（ops_events 等）

Phase 1 完了後に着手。

- Epic1: ops_events テーブル + put_ops_event() + 運用イベント辞書（10個以上）
- Epic2: misesapo-ops-missing-detector（EventBridge 毎日 09:00 JST）
- Epic3: Slack 通知（最小）
- Epic4: scripts/runbooks/（healthcheck.sh, alias_verify.sh, rollback_alias.sh）

Phase 2 受け入れ: stg で missing-detector invoke → ops_events にレコード、Slack/ログ通知、runbook 実行可能、/work-report 本番 200 維持。

---

## 出力要件（必須）
- 変更ファイル一覧を最後に出す
- 実行手順（コマンド）を最後に出す
- 受け入れ条件のチェック項目を実行順に並べる
- 不明点は TODO: として安全に残し、破壊的変更をしない
