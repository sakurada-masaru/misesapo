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
