# 清掃側・業務報告の構造（管理表示用）

清掃側（`CleaningDayReportPage`）から提出される業務報告のデータ構造をまとめたもの。  
管理側（`/admin/work-reports`）で一覧・詳細を表示するときに参照する。

---

## 1. テンプレート種別

| template_id | 意味 | 提出単位 |
|-------------|------|----------|
| **CLEANING_DAY_V1** | 清掃・日次ヘッダ | 1日1件（下書き。店舗ごとに提出するので日次は提出しない場合あり） |
| **CLEANING_STORE_V1** | 清掃・店舗レポート | 店舗ごと。ここを「提出」すると `state: submitted` になる |

管理側では **CLEANING_STORE_V1** の提出済み（`state === 'submitted'`）が「清掃から提出された業務報告」として一覧に出る。

---

## 2. API 上の 1 件の形（清掃・店舗レポート）

清掃側で店舗を「提出」すると、`PATCH /work-report/{log_id}` で `state: 'submitted'` になる。  
GET `/work-report?date=YYYY-MM-DD` で返る 1 件の例:

```json
{
  "log_id": "LRxxx",
  "version": 2,
  "state": "submitted",
  "template_id": "CLEANING_STORE_V1",
  "work_date": "2026-01-31",
  "work_minutes": 90,
  "target_label": "○○店",
  "description": "{...JSON文字列...}",
  "updated_at": "2026-01-31T15:00:00+09:00"
}
```

- **target_label**: 店舗名（清掃画面の「店舗名」）
- **description**: 下記の JSON を `JSON.stringify` した文字列

---

## 3. description の中身（CLEANING_STORE_V1）

清掃側の `serializeStoreReport(store)` で保存している形:

```json
{
  "store": {
    "name": "店舗名",
    "address": "住所",
    "witness": "立会人",
    "work_start_time": "09:00",
    "work_end_time": "10:30",
    "note": "店舗メモ・特記事項"
  },
  "services": [
    { "name": "サービス名", "minutes": 30, "memo": "メモ" }
  ],
  "attachments": [
    { "url": "https://...", "name": "写真1.jpg" }
  ]
}
```

| フィールド | 説明 |
|------------|------|
| **store.name** | 店舗名（API の target_label と一致） |
| **store.address** | 住所 |
| **store.witness** | 立会人 |
| **store.work_start_time / work_end_time** | 作業開始・終了時刻 |
| **store.note** | 店舗メモ・特記事項（要約・検索用に使う） |
| **services** | サービス内訳（name, minutes, memo）の配列 |
| **attachments** | 添付（url, name）の配列 |

清掃では **summary / issues** は使わず、**store.note** がメモに相当する。  
管理側の「要約」「検索」では `description.store.note` と `description.store.name` を参照する。

---

## 4. 日次ヘッダ（CLEANING_DAY_V1）の description

```json
{
  "note": "日次のメモ",
  "stores_enabled": [true, false, false]
}
```

日次は提出しない運用なら、管理側の一覧には主に CLEANING_STORE_V1 が出る。

---

## 5. 管理側での表示・検索の対応

- **種別**: `template_id` が `CLEANING_*` → 「清掃」
- **店舗**: `target_label` をそのまま表示
- **要約**: `description.store?.note` または `description.summary`（清掃は store.note）
- **検索**: 提出者・target_label・要約・課題・メモ。清掃の場合は `description.store.note` と `description.store.name` も検索対象に含める
- **添付**: `description.attachments` と `description.store?.attachments` の両方から URL を集める（既存の collectAttachmentUrls で対応済み）

このドキュメントと `AdminWorkReportsPage.jsx` の `extractDescriptionText` / 詳細モーダルの表示を揃える。
