# 営業側 MVP（店舗カルテ＋活動ログ＋ToDo＋添付）実装完了報告

## ゴール（Phase1）

営業が「ここだけ見れば全部わかる」店舗カルテ画面を実装。  
店舗（=顧客接点）単位のカルテページで、営業ステータス（パイプライン）・活動ログ・次アクション（ToDo）・補助資料添付を一括管理。  
保存は既存 `/work-report` を使用し、`template_id` で区別（Phase1 は `description`(JSON) 格納）。  
添付は清掃側と同じ `POST /upload-url` を流用（context で区別）。

---

## 変更ファイル一覧

| 種別 | パス |
|------|------|
| API | `src/shared/ui/Sales/salesKarteApi.js` |
| ページ | `src/shared/ui/Sales/SalesStoreKartePage.jsx` |
| スタイル | `src/shared/ui/Sales/sales-store-karte.css` |
| ルート | `src/app/router.jsx` |
| ナビ | `src/app/App.jsx` |
| Portal | `src/portal/pages/Portal.jsx` |
| 報告 | `docs/IMPLEMENTATION_REPORT_SALES_KARTE.md`（本ファイル） |

---

## 主要差分（state / serialize・deserialize / API payload 例）

### state（SalesStoreKartePage.jsx）

- **entity**: 店舗基本情報＋パイプライン＋メモ＋添付＋`saved { log_id, version, state }`
- **activities**: 活動ログ配列（各要素に `saved`）
- **todos**: ToDo 配列（各要素に `saved`、`status: 'open' | 'done'`）
- **loading / error**: 初回 GET 用
- **entitySaving / entityError**: 基本情報保存
- **activitySaving / activityErrors**: 活動ログ保存（index または `'new'`）
- **todoSaving / todoErrors**: ToDo 保存・完了切替
- **uploading / attachmentErrors**: 添付アップロード（section + id で識別）
- **showActivityForm / showTodoForm**: 追加フォーム表示
- **newActivity / newTodo**: 追加フォーム用の一時 state

### serialize / deserialize（関数化・将来 report_data 移行を想定）

- **serializeEntity(entity)** → `{ store, pipeline, note, attachments }`
- **deserializeEntity(descriptionJson, workReportItem)** → entity オブジェクト（`saved` 含む）
- **serializeActivity(act)** → `{ store_key, store_name, type, datetime, summary, detail, pipeline_after, attachments }`
- **deserializeActivity(descriptionJson, workReportItem)** → activity オブジェクト（`saved` 含む）
- **serializeTodo(todo)** → `{ store_key, store_name, due_date, title, note, status, attachments }`
- **deserializeTodo(descriptionJson, workReportItem)** → todo オブジェクト（`saved` 含む）

### API payload 例（PUT /work-report）

- **店舗エンティティ（基本情報）**  
  `template_id: "SALES_ENTITY_V1"`, `target_label: 店舗名`,  
  `description: JSON.stringify(serializeEntity(entity))`  
  （中身: `store`（key, company_name, brand_name, store_name, address, tel, contact_person, email）, `pipeline`, `note`, `attachments`）

- **活動ログ**  
  `template_id: "SALES_ACTIVITY_V1"`, `target_label: 店舗名`,  
  `description: JSON.stringify(serializeActivity(act))`  
  （中身: `store_key`, `store_name`, `type`, `datetime`, `summary`, `detail`, `pipeline_after`, `attachments`）

- **ToDo**  
  `template_id: "SALES_TODO_V1"`, `target_label: 店舗名`,  
  `description: JSON.stringify(serializeTodo(todo))`  
  （中身: `store_key`, `store_name`, `due_date`, `title`, `note`, `status`, `attachments`）

---

## 保存例（PUT body）と復元ロジック抜粋

### PUT body 例（店舗エンティティ）

```json
{
  "date": "2026-01-31",
  "work_date": "2026-01-31",
  "work_minutes": 0,
  "template_id": "SALES_ENTITY_V1",
  "state": "draft",
  "target_label": "セブン新宿",
  "description": "{\"store\":{\"key\":\"%E3%82%BB%E3%83%96%E3%83%B3%E6%96%B0%E5%AE%BF\",\"company_name\":\"\",\"brand_name\":\"\",\"store_name\":\"セブン新宿\",\"address\":\"\",\"tel\":\"\",\"contact_person\":\"\",\"email\":\"\"},\"pipeline\":\"contacted\",\"note\":\"\",\"attachments\":[{\"name\":\"file.pdf\",\"mime\":\"application/pdf\",\"size\":12345,\"url\":\"https://...\",\"key\":\"reports/2026-01-31/uuid_file.pdf\",\"uploaded_at\":\"2026-01-31T00:00:00.000Z\"}]}"
}
```

- 既存レポートの上書き時は `log_id`, `version` を同 body に含める。

### 復元ロジック抜粋

- **取得**: `getWorkReportsForStore(storeKey, 30)` で直近 30 日分の `GET /work-report?date=YYYY-MM-DD` を順に叩き、`description.store.key === storeKey` または `description.store_key === storeKey` のものだけをマージ。
- **entity**: `template_id === "SALES_ENTITY_V1"` かつ `description.store.key === storeKey` の 1 件を `deserializeEntity(it.description, it)` で復元。
- **activities**: `template_id === "SALES_ACTIVITY_V1"` のものを `deserializeActivity` で復元し、`datetime` の新しい順にソート。
- **todos**: `template_id === "SALES_TODO_V1"` のものを `deserializeTodo` で復元。

```javascript
getWorkReportsForStore(decodedKey, 30)
  .then((items) => {
    const entityItem = items.find((i) => {
      if (i.template_id !== TEMPLATE_ENTITY) return false;
      const d = JSON.parse(i.description || '{}');
      return d.store?.key === decodedKey;
    }) || null;
    const activityItems = items.filter((i) => i.template_id === TEMPLATE_ACTIVITY);
    const todoItems = items.filter((i) => i.template_id === TEMPLATE_TODO);
    if (entityItem) setEntity(deserializeEntity(entityItem.description, entityItem));
    setActivities(activityItems.map((it) => deserializeActivity(it.description, it)).sort((a, b) => (b.datetime || '').localeCompare(a.datetime || '')));
    setTodos(todoItems.map((it) => deserializeTodo(it.description, it)));
  });
```

---

## 添付アップロードの流れ（getUploadUrl → PUT S3 → attachments 反映）

1. **フロント**: 「ファイルを追加」でファイル選択 → `validateAttachmentFile`（拡張子・10MB・最大 10 件）で検証。
2. **Presigned URL 取得**: `getUploadUrl({ filename, mime, size, context, date, storeKey })` を呼び出し。  
   - context: `"sales-entity-attachment"` / `"sales-activity-attachment"` / `"sales-todo-attachment"` のいずれか。  
   - レスポンス: `{ uploadUrl, fileUrl, key }`。
3. **S3 へ PUT**: `fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })`。
4. **attachments 反映**: 成功時、`{ name, mime, size, url, key, uploaded_at }` を該当オブジェクトの `attachments` に追加。  
   - entity / activity / todo のいずれかを `section` + `id` で識別。
5. **保存**: 基本情報保存・活動保存・ToDo 保存時に `serializeEntity` / `serializeActivity` / `serializeTodo` で `attachments` を含めた `description` を PUT。
6. **削除**: UI から削除するだけ（S3 オブジェクトは削除しない）。次回保存時に削除後の配列が送られる。

**PATCH 時の version**: ToDo の open/done 切替は、現状「description を更新した PUT」で実施（`serializeTodo` で `status` を反映）。  
将来的に PATCH で `description.status` のみ更新する場合は、`patchWorkReport(logId, { version, ... })` で **version を必ず送る**（V1 楽観ロック）。

---

## ルーティング・ナビ

- **ルート**: `/sales/store/:storeKey` → `SalesStoreKartePage.jsx`。  
  `storeKey` は暫定（例: URL エンコードした店舗名: `/sales/store/%E3%82%BB%E3%83%96%E3%83%B3%E6%96%B0%E5%AE%BF`）。
- **ナビ**: App.jsx のナビに「営業カルテ（店舗）」→ `/sales/store/demo`。Portal に「営業カルテ」→ `/sales/store/demo`（固定リンク・MVP）。

---

## 補足

- **upload-url バックエンド**: 清掃は `storeIndex`、営業は `storeKey` を送る。バックエンドは `context` に応じて `storeIndex` または `storeKey` を受け取り、key 命名などに利用する想定。
- **GET が date のみの場合**: 直近 30 日を順に取得し、`storeKey` でフィルタする `getWorkReportsForStore(storeKey, 30)` で対応。  
  将来、admin 一覧 API や storeKey 指定 GET があれば差し替え可能。
- **Phase1**: 店舗情報は手入力・暫定 ID（URL の storeKey）で OK。将来 V1 の clients/brands/stores と統合する際も、serialize/deserialize を流用しやすい形で関数化済み。
