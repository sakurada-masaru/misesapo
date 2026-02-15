# TODO_CONFLICTS（既知のズレ・保留・仕様競合）

AGENTS.md 準拠: 既知の競合を握りつぶさずここに列挙する。

---

## 仕様 vs 実装のズレ（保留でよいもの）

| 項目 | 内容 | 方針 |
|------|------|------|
| only_actionable | GET 一覧のクエリに未実装 | 空配列対策は直近7日＋states で対応済み。必要なら後で追加 |
| archived 操作 | FE に「アーカイブ」ボタンなし | BE は許可済み。必要なら FE に追加 |
| 403 reason | 403 時に reason: not_authorized を返していない | FE で 403 を「管理者ロール確認」として扱うか、BE で body に reason を追加 |

## 別仕様書との対応

| 仕様書 | 状態 |
|--------|------|
| WORK_REPORT_SYSTEM_SPEC.md（reviewing/returned/fixed） | P6 統合仕様では triaged/approved/rejected/archived を採用。対応は WORK_REPORT_SPEC_TO_IMPL.md 参照 |

## 競合・保留の追加時

- 日付と簡潔な理由を追記する
- 解消したら「解消: 日付」を追記して残す

---

※ 差異の詳細は `P6_SPEC_VS_IMPL_DIFF.md` を参照。

## LINE system related (2026-02-08)

| Priority | 項目 | 内容 | 方針 |
|------|------|------|------|
| High | Flow guide source duplication | `FlowGuideScreen.jsx` と `flow/FlowGuideDrawer.jsx` に選択ロジックが並立しており、片方だけ修正されると挙動がズレる | 画面導線を `FlowGuideScreen.jsx` 本体に統一し、`flowData.js` / `messageTemplates.js` を唯一の業務ルールソースとして利用する |
| High | Flow rule gaps | `ROLE_ALLOWED_STEPS × ROLE_ALLOWED_ISSUES` に対して `FLOW_RULES` 未定義が多数（761） | UIでは未定義を非表示化し誤誘導を防止。埋める順序は `docs/spec/FLOW_RULE_GAP_PRIORITY.md` に従う |

## Schedule rebuild related (2026-02-08)

| Priority | 項目 | 内容 | 方針 |
|------|------|------|------|
| High | Schedule tables split | `schedules` / `misesapo-schedules` / `blocks` / `worker-availability` に概念が分裂し、責務が不明確 | V1は既存予定を維持しつつ `dispatch` を新設。後続でスケジュール領域を段階的に再設計する |
| High | Worker key inconsistency | `worker_id` / `user_id` / `cleaner_id` / `assigned_to` が混在し突合漏れが発生しうる | API境界で `worker_id` に正規化し、`sub` は認証IDとして別管理する |
| Medium | Reservation vs execution coupling | 予約情報だけでは実行状態（移動中/作業中/完了）が追えず、連絡遅延・状況不明が残る | 予約（schedule）と実行（dispatch）を分離した2層モデルを採用する |
| High | Legacy availability gate | 既存 `/schedules` は `worker-availability` の `open` がないと 409 `worker_unavailable` で作成不能 | `yotei` 新設で日次open必須を撤廃し、時間重複判定中心に置き換える |
| High | AWS deploy pending | ローカル実装は `/yotei/*` に切替済みだが、API Gateway/Lambdaへの反映と `yotei-*` テーブル作成が未実施 | AWS CLIで `lambda update-function-code` / APIGW route反映 / DynamoDBテーブル作成を実行して切替完了させる |
| High | ugoki progress naming ambiguity | 仕様文では `ugoki.jotai` が進捗（mikanryo/shinkou/kanryou）として記述される一方、ドメイン仕様では `jokyo` が進捗定義。API/UIでズレると不整合になる | UIは `jokyo` を正としつつ互換で `jotai` 入力も受理。API側で最終正規化を統一する |

| High | ugoki naming ambiguity | 仕様文では  が進捗（mikanryo/shinkou/kanryou）として扱われる記述がある一方、ドメイン仕様では  が進捗定義。API/UIでズレると不整合になる | UIは  を正としつつ、互換で  入力も受理する。API側で最終正規化を統一する |

## Yakusoku/Yotei MVP related (2026-02-15)

| Priority | 項目 | 内容 | 方針 |
|------|------|------|------|
| High | shigoto layer missing | `docs/spec/MISOGI_DOMAIN_SPEC.md` は `yakusoku -> shigoto -> yotei` を正としているが、現行MVPは `yotei.yakusoku_id` で直接紐付けており `shigoto` が未実装 | Phase0は `yakusoku_id` を必須として運用開始し、後続で `shigoto` を導入。移行時は `yotei` に `shigoto_id` を追加しつつ `yakusoku_id` も保持して段階移行する |
