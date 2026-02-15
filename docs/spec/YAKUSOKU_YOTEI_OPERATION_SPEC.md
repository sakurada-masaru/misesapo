# Yakusoku -> Yotei Operation Spec (MVP)

目的:
- 管理側が `yakusoku(契約/案件)` を正データとして投入し、次に `yotei(実行予定)` を割り当てて運用開始する。
- Worker 側は `/jobs/:job/yotei` は閲覧専用（作成しない）。

## 1) Yakusoku (契約/案件) 必須項目（管理投入）

真 (truth):
- `tenpo_id` (必須): 現場を特定するID。表示用に `tenpo_name` はスナップショットとして保存してよい。
- `type` (必須): `teiki | tanpatsu`
- `service_ids` (必須): サービス複数選択を許可する。IDが真。表示用に `service_names` を保存してよい。

定期(teiki)の運用必須:
- `monthly_quota` (必須, >=1): 月間規定回数
- `price` (必須, >=0): 単価（MVPは税/請求単位の厳密化は後回し）
- `recurrence_rule` (必須): `task_matrix` を含む（後述）

任意:
- `start_date` / `end_date`（推奨）
- `status` (`active|inactive`)
- `memo`（管理メモ。現場入力は増やさない）
- `onsite_flags`（構造化の運用注意。自由文の代替）
  - `has_spare_key`: 合鍵あり
  - `key_loss_replacement_risk`: 鍵紛失＝鍵交換リスク（注意喚起）
  - `require_gas_valve_check`: ガス栓確認 必須
  - `trash_pickup_required`: ゴミ回収あり
  - `trash_photo_required`: ゴミ回収時に写真 必須

## 2) 現場名検索（統合検索）

管理UIの「現場名（統合検索）」は、以下を同一検索窓で扱う:
- `torihikisaki.name/id`
- `yagou.name/id`
- `tenpo.name/id`

ただし保存の真は `tenpo_id`。

## 3) Service 複数選択

- `yakusoku.service_ids[] / service_names[]` を正とし、単数互換として `service_id/service_name` を併記する。
- `yotei` の作業内容/種別は当面 `service_id/service_name` を主に参照してよい（後続で詳細化）。

## 4) 定期メニュー task_matrix の粒度

MVPでは `service_id` を「タグ」として採用し、`recurrence_rule.task_matrix` に格納する。
- 例: `task_matrix.monthly = ["cleaning_regular", "maintenance_check"]`
- バケット（毎月/奇数月/偶数月/四半期…）は UI の固定キーに従う。

理由:
- 生成物（shigoto/yotei）のテンプレ化がしやすい
- マスタ更新に強い（名前でなくID）

## 5) Yotei 作成時の yakusoku_id

結論: **必須**
- `yotei` は `yakusoku` から派生して割当を作る（yakusokuが正）。
- API/管理UIとも `yakusoku_id` を必須にし、選択時に `tenpo_id/tenpo_name` を自動補完する。

補足:
- 将来 `shigoto` 導入時に `yotei` は `shigoto_id` を正に移行するが、Phase0は `yakusoku_id` 必須で運用開始する（`docs/spec/TODO_CONFLICTS.md` 参照）。
