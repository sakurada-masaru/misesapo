# 経理向け・次フェーズ検討事項

業務報告の「社内共有URL」設計（経理向け運用）は現設計で確定。  
次フェーズで以下を検討する。

---

## 1. approved スナップショット

- **目的**: approved されたレポートを支払計算の基礎値として固定する。
- **検討内容**:
  - approved 遷移時に、その時点の `minutes` 等をスナップショットとして保存するか。
  - 変更する場合は履歴（誰がいつ変更したか）を残す方針か。
  - ストレージ形状（同一レコード内の `approved_snapshot` フィールド、別テーブル、履歴テーブルなど）。

---

## 2. CSV 出力

- **目的**: 経理が報酬計算・集計に使える形式でデータを出力する。
- **検討内容**:
  - 対象: 月次ビュー（/office/payroll/{user_id}/{YYYY-MM}）の明細、または管理一覧のフィルタ結果。
  - 出力項目: report_id, date, user_id, template_id, minutes, state, amount（将来）など。
  - 方式: API で CSV を返す（`Content-Type: text/csv`）、または FE で JSON を CSV に変換してダウンロード。

---

## 参照

- 現設計: 社内共有URL設計・実装指示（経理向け運用）に基づく。
- 支払対象: approved のみ。submitted は未確定、rejected は除外。
