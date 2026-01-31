# 営業日報ページ（/sales/report-day）実装完了報告

## ゴール（Phase1）

営業が1日の報告を一画面で完結できる画面を追加。  
日次サマリ（1日1件）・案件カード（複数）・補助資料添付を実装。  
保存は既存 `/work-report` を使用し、`template_id` で区別（`description` に JSON 格納）。  
添付は清掃側と同様に `POST /upload-url` で Presigned URL 取得 → S3 へ PUT。

---

## 変更ファイル一覧

| 種別 | パス |
|------|------|
| API | `src/shared/ui/Sales/salesDayReportApi.js` |
| ページ | `src/shared/ui/Sales/SalesDayReportPage.jsx` |
| スタイル | `src/shared/ui/Sales/sales-day-report.css` |
| ルート | `src/app/router.jsx` |
| 報告 | `docs/IMPLEMENTATION_REPORT_SALES_DAY_REPORT.md`（本ファイル） |

---

## PUT / PATCH body 例

### 日次サマリ保存（PUT）

```json
{
  "date": "2026-01-31",
  "work_date": "2026-01-31",
  "work_minutes": 120,
  "template_id": "SALES_DAY_V1",
  "state": "draft",
  "target_label": "sales-day",
  "description": "{\"summary\":\"本日の成果メモ\",\"issues\":\"課題\",\"top_priority\":\"明日の最優先\",\"attachments\":[{\"name\":\"file.pdf\",\"mime\":\"application/pdf\",\"size\":12345,\"url\":\"https://...\",\"key\":\"reports/...\",\"uploaded_at\":\"2026-01-31T00:00:00.000Z\"}]}"
}
```

- 既存の上書き時は `log_id`, `version` を同 body に含める。

### 案件保存（PUT）

```json
{
  "date": "2026-01-31",
  "work_date": "2026-01-31",
  "work_minutes": 30,
  "template_id": "SALES_CASE_V1",
  "state": "draft",
  "target_label": "セブンイレブン新宿店",
  "description": "{\"store_key\":\"seven_shinjuku\",\"store_name\":\"セブンイレブン新宿店\",\"touch_type\":\"visit\",\"summary\":\"初回訪問\",\"detail\":\"ヒアリング\",\"next\":{\"due\":\"2026-02-02\",\"title\":\"見積送付\"},\"pipeline_after\":\"qualified\",\"attachments\":[]}"
}
```

### 案件提出（PATCH）

```json
{
  "version": 1,
  "state": "submitted"
}
```

- `PATCH /work-report/{log_id}` に上記 body。**version 必須**（V1 楽観ロック）。

---

## 復元ロジック抜粋

- **URL**: `/sales/report-day?date=YYYY-MM-DD`。`date` が無い場合は「今日」を初期値に使用。
- **取得**: マウント時に `getWorkReportByDate(workDate)`（`GET /work-report?date=YYYY-MM-DD`）を呼び出し。
- **振り分け**:
  - `template_id === "SALES_DAY_V1"` の 1 件 → `deserializeHeader(description, item)` で header に復元。
  - `template_id === "SALES_CASE_V1"` の一覧 → 各 `deserializeCase(description, item)` で cases 配列に復元。

```javascript
getWorkReportByDate(workDate)
  .then((items) => {
    if (!Array.isArray(items)) return;
    const dayItem = items.find((i) => i.template_id === TEMPLATE_DAY);
    const caseItems = items.filter((i) => i.template_id === TEMPLATE_CASE);
    if (dayItem) setHeader(deserializeHeader(dayItem.description, dayItem));
    setCases(caseItems.map((it) => deserializeCase(it.description, it)));
  });
```

- `deserializeHeader`: description から `summary`, `issues`, `top_priority`, `attachments` を復元し、`work_date` / `work_minutes` / `saved` は work-report 項目から取得。
- `deserializeCase`: description から `store_key`, `store_name`, `touch_type`, `summary`, `detail`, `next.due`/`next.title`, `pipeline_after`, `attachments` を復元し、`saved` は work-report 項目から取得。

---

## 添付アップロードの流れ

1. **フロント**: 「ファイルを追加」でファイル選択 → 拡張子・10MB・最大 10 件で検証。
2. **Presigned URL 取得**: `getUploadUrl({ filename, mime, size, context, date, storeKey? })` を呼び出し。  
   - 日次: `context: "sales-day-attachment"`, `storeKey` は未指定で可。  
   - 案件: `context: "sales-case-attachment"`, `storeKey`: 当該案件の `store_key`（任意）。
3. **S3 へ PUT**: `fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })`。
4. **反映**: 成功時、`{ name, mime, size, url, key, uploaded_at }` を該当の `header.attachments` または `cases[i].attachments` に追加。
5. **保存**: 日次サマリ保存・案件保存時に、それぞれの `description` に `attachments` を含めて PUT。
6. **削除**: UI 上で削除するだけ（S3 オブジェクトは削除しない）。次回保存時に削除後の配列が送られる。

---

## 補足

- **バリデーション**: 日次保存は `work_date` 必須・`total_minutes > 0` 必須。案件提出は `store_name`・`summary` 必須、かつ `next_due` または `next_title` のどちらか必須。
- **案件バッジ**: 未保存 ⚪ / 下書き 🟡 / 提出済 🟢。カード右上に表示。
- **ルート**: `/sales/report-day`（クエリ `?date=YYYY-MM-DD` で日付指定、省略時は今日）。
