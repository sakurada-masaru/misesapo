# 清掃スケジュール MVP 仕様（Googleカレンダー脱却）

管理スケジュールの用語・データ・API・UI・重複禁止ロジックを定義する。明日運用開始MVPの受け入れ条件を満たす。

---

## A. 用語/前提（最重要）

### schedule_id（案件単位）
- **1案件 = 1 schedule_id**（参加者は複数可）
- A用 schedule / B用 schedule のように人別に分割しない
- `schedule.assignees` に参加者を配列で保持する

### 重複禁止
- schedule 作成/更新時に **assignees 全員** について時間重複チェックを実施
- ブロック（クローズ）も占有として扱い、schedule と同じく重複対象にする
- 重複があれば **409 Conflict** を返し、誰が何と被っているか返す

---

## B. データ設計（MVP）

### 1) schedules
| 項目 | 型 | 説明 |
|------|-----|------|
| id | string | schedule_id |
| store_id | string | 店舗ID（任意） |
| store_name | string | 店舗名 |
| start_at | string | ISO datetime |
| end_at | string | ISO datetime |
| service_label | string | サービスラベル（任意） |
| state | string | planned / in_progress / done / canceled 等 |
| assignees | array | `[{ user_id, name, role }]`（role: leader/support 等は任意） |
| contact_status | string | uncontacted \| contacted \| no_answer |
| contact_last_at | string \| null | ISO datetime |
| contact_note | string \| null | 事前連絡メモ |
| contact_operator_id | string \| null | 連絡実施者 user_id |

### 2) blocks（クローズ）
| 項目 | 型 | 説明 |
|------|-----|------|
| id | string | block_id |
| user_id | string \| null | null のとき company_close（全体クローズ） |
| start_at | string | ISO datetime |
| end_at | string | ISO datetime |
| type | string | personal_close \| company_close |
| reason_code | string | sleep \| private \| move \| other 等 |
| reason_note | string \| null | |
| visibility | string | admin_only（MVP は固定） |
| rrule | string \| null | 繰り返し（MVP は optional） |

---

## C. API（MVP）

- **GET** `/admin/schedules?from=YYYY-MM-DD&to=YYYY-MM-DD` … schedules 一覧（assignees 含む）
- **POST** `/admin/schedules` … 作成。重複時は 409。body: store_id, store_name, start_at, end_at, assignees, service_label
- **PATCH** `/admin/schedules/{id}` … 更新（時間/参加者）
- **PATCH** `/admin/schedules/{id}/contact` … 事前連絡更新。body: contact_status, contact_note, contact_operator_id
- **POST/PATCH/DELETE** blocks … ブロックも占有として扱い、重複時は 409

### 409 レスポンス例
```json
{
  "error": "conflict",
  "message": "鈴木が10:00-13:00で別予定と重複しています",
  "conflicts": [{ "user_id", "schedule_id", "start_at", "end_at", "type": "schedule|block" }]
}
```

---

## D. UI（管理PC）/admin/schedule

### D-1) 日次タイムライン
- 左: 時刻
- 上: 清掃員列（名簿順固定）
- 各列に、その人が参加する schedule カードを表示（**同一 schedule は参加者分だけ各列に表示**）
- ブロック（個人クローズ）はその列に 🔒 斜線カードで表示
- ブロック（全体クローズ）は全列に薄く表示（または背景帯）

### D-2) 同一案件ハイライト連動
- state: `activeScheduleId` (null or schedule_id)
- どれかカードクリック → activeScheduleId = schedule.id
- 同一 schedule_id のカード全てに `.is-linked`
- 背景クリック or 同カード再クリックで解除

### D-3) 事前連絡モード（上下2段）
- トグル「事前連絡」OFF: 清掃パネルのみ
- ON: 上に ContactWeekPanel、下に CleaningWeekPanel
- ContactWeekPanel: 週単位カード、連絡済/不通ボタン、メモ編集
- CleaningWeekPanel: 週単位早見表、📞連絡ステータス・最終メモ1行表示

### D-4) 営業向け 空きマークナビ（任意・MVP は後回し可）
- 1〜31日のミニ行、maxBlockMinutes / nightMaxBlockMinutes に応じたアイコン
- クリックで該当日へジャンプ

---

## E. UI（清掃員SP）

- **自分の案件のみ**表示（assignees に自分が含まれる schedule のみ）
- 日別縦リスト（今日/明日/今週）
- カード: 時間、店舗名、サービスラベル、📞事前連絡ステータス＋メモ抜粋、👥参加メンバー（自分以外）
- カードタップで詳細モーダル（参加メンバー、事前連絡メモ）
- **個人クローズ**:「この時間は入れない」で block 登録 → スケジュールに 🔒 反映

---

## F. 重複禁止ロジック（必須）

### F-1) schedule 作成/更新時
- 条件: `newStart < existingEnd && newEnd > existingStart` が 1 件でもあれば重複
- 対象:
  1) assignees 全員の既存 schedule
  2) assignees 全員の personal_close blocks
  3) company_close blocks（全員対象）

### F-2) 409 の返し方
- 誰が被っているか（ユーザー名）
- 何と被っているか（schedule_id or block）
- その時間帯

---

## G. 受け入れ条件（明日運用開始 MVP）

1. 管理画面で schedule を登録できる
2. ダブルブッキングは保存できない（409 で拒否）
3. 清掃員 SP は自分の案件だけ見れる
4. 複数人案件は各列に出るが、クリックで同一案件が全て光る（.is-linked）
5. ブロック（クローズ）を入れると、その時間に案件は入れられない
6. 事前連絡モード（上下2段）で、連絡ステータスとメモが保存/表示される

---

## 実装メモ（現行との対応）

- **localStorage MVP**: API 未実装時は `admin-schedule-appointments` に `schedule_id` を追加して運用。重複時は保存せず UI で 409 相当メッセージ表示。
- **既存 appointments**: 各 appointment に `schedule_id` を付与（単一割当の場合は `schedule_id = id`）。複数人案件は同一 `schedule_id` の appointment を複数登録する形で対応可能。
- **contact_status**: 仕様は uncontacted | contacted | no_answer。既存 UI は pending | done | unreachable → 表示ラベルで対応可。

---

## 実装状況（MVP 向け）

| 項目 | 状態 | 備考 |
|------|------|------|
| 仕様書 A–G | ✅ | 本ドキュメント |
| schedule_id による同一案件リンク | ✅ | カードクリックで activeScheduleId、同一 schedule_id に .is-linked |
| 背景/同カード再クリックで解除 | ✅ | bodyRow onClick / トグル |
| 保存時重複チェック（409） | ✅ | saveModal 内で detectConflicts、重複時は保存せずモーダルにメッセージ表示 |
| 事前連絡モード（上下2段） | ✅ | 既存 ContactWeekPanel / CleaningWeekPanel |
| blocks（クローズ）CRUD・表示 | ⏳ | 未実装 |
| 複数 assignees（1 schedule = 複数列に表示） | ⏳ | 現行は 1 appointment = 1 列。同一 schedule_id を複数登録すれば .is-linked で連動 |
| 清掃員 SP「自分の案件のみ」 | ⏳ | 別ルート/ページ要 |
| 空きマークナビ（D-4） | ⏳ | 任意・後回し可 |
