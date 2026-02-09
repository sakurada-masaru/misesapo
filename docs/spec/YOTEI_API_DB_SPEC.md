# YOTEI API/DB 再設計仕様（V1）

## 1. 目的

`schedules` / `blocks` / `worker-availability` の既存依存を分離し、  
`yotei` ドメインとしてスケジュール機能を再構築する。

本仕様の狙い:
- 予約作成不能（`worker_unavailable`）の構造問題を解消
- 管理側の配車（病院予約モデル）を主語に統一
- フェーズ分離（V1: `yotei` のみ、`ugoki` は後続）

---

## 2. 命名と範囲

- 新ドメイン名: `yotei`
- 旧 `/schedules` は利用しない（管理画面I/Oは全廃）
- 新規は `/yotei` を正とする

対象（V1）:
- 清掃スケジュール管理（管理側）

非対象（V1外）:
- 休み申告（将来追加）
- AI配車
- 実行状態更新（`/yotei/dispatch`）

---

## 3. テーブル設計

## 3.1 `yotei`

予約の正。

必須項目:
- `id` (PK, string) 例: `YOTEI#SCH#20260208#0001`
- `biz_date` (string, `YYYY-MM-DD`) ※16:00境界
- `scheduled_date` (string, `YYYY-MM-DD`)
- `start_at` (ISO datetime)
- `end_at` (ISO datetime)
- `worker_id` (string)
- `store_id` (string)
- `service_id` (string)
- `service_name` (string)
- `status` (string: `planned|torikeshi`)
- `created_at` (ISO datetime)
- `updated_at` (ISO datetime)

任意項目:
- `client_id`
- `brand_id`
- `memo`
- `created_by`
- `updated_by`

GSI:
- `gsi_worker_start`
  - PK: `worker_id`
  - SK: `start_at`
- `gsi_biz_date`
  - PK: `biz_date`
  - SK: `start_at`
- `gsi_store_start`（任意）
  - PK: `store_id`
  - SK: `start_at`

---

## 3.2 `yotei_dispatch`（Phase2）

実行状態の正（予約状態と分離）。

必須項目:
- `id` (PK, string) 例: `YOTEI#DSP#SCHEDULE#{schedule_id}#{biz_date}`
- `schedule_id` (string)
- `biz_date` (string)
- `worker_id` (string)
- `store_id` (string)
- `category` (string: `CLEAN|MAINT|PEST`)
- `status` (string: `todo|enroute|working|done`)
- `updated_at` (ISO datetime)

任意項目:
- `meta` (map/json)

GSI:
- `gsi_worker_biz_date`
  - PK: `worker_id`
  - SK: `biz_date#updated_at`
- `gsi_biz_date`
  - PK: `biz_date`
  - SK: `updated_at`

---

## 4. ルール

## 4.1 `biz_date`（確定）

- 朝勤: `04:00-16:00`
- 夜勤: `16:00-翌04:00`
- `start_at >= 16:00` -> 翌日 `biz_date`
- `start_at < 16:00` -> 当日 `biz_date`

## 4.2 重複判定（予約）

`POST /yotei` と `PUT /yotei/{id}` では以下を必須判定:
- 同一 `worker_id` に対して
- `new_start < existing_end && new_end > existing_start`
- 重複があれば `409`

V1では **`worker-availability` の日次 open レコード有無を必須条件にしない**。

## 4.3 409レスポンス

`409` は必ず詳細を返す:

```json
{
  "error": "yotei_conflict",
  "message": "指定時間に重複があります",
  "conflicts": [
    {
      "schedule_id": "YOTEI#SCH#20260208#0007",
      "worker_id": "W002",
      "start_at": "2026-02-08T23:00:00+09:00",
      "end_at": "2026-02-09T01:00:00+09:00"
    }
  ]
}
```

---

## 5. API設計

## 5.1 予約

- `GET /yotei?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD&worker_id=&store_id=&limit=`
- `POST /yotei`
- `PUT /yotei/{id}`
- `DELETE /yotei/{id}`（論理削除推奨）

`POST` リクエスト例:

```json
{
  "scheduled_date": "2026-02-08",
  "start_at": "2026-02-08T23:00:00+09:00",
  "end_at": "2026-02-09T01:00:00+09:00",
  "worker_id": "W002",
  "store_id": "S010",
  "service_id": "cleaning_regular",
  "service_name": "定期清掃",
  "memo": ""
}
```

---

## 5.2 実行状態（Phase2）

- `GET /yotei/dispatch?biz_date=YYYY-MM-DD&worker_id=`
- `PATCH /yotei/dispatch/{id}`
- `PUT /yotei/dispatch/{id}`（upsert）

`PATCH` リクエスト例:

```json
{
  "status": "working",
  "updated_at": "2026-02-08T23:30:00+09:00"
}
```

---

## 6. 画面側適用（MISOGI）

- 管理画面 `AdminScheduleTimelinePage.jsx` は `/yotei` をI/Oの正とする
- 旧 `/schedules` の参照を撤去する

V1暫定:
- 予約状態 `status` は `planned/torikeshi` のみ
- 実行状態は任意（フェーズ2で `dispatch.status` を正にする）

---

## 7. 移行方針

1. 先に `/yotei/*` APIと新テーブルを追加
2. 管理画面のみフラグ切替で `/yotei` 利用開始
3. 旧 `/schedules` の利用を停止（管理画面から完全切替）
4. 安定後に旧実装を段階削除

---

## 8. 受け入れ条件（V1）

- `POST /yotei` が `worker-availability` 非依存で作成できる
- 時間重複時は `409 + conflicts[]` が返る
- 管理画面で同日案件が表示され、作成・更新・状態反映ができる
