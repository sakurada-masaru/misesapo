# 業務報告・補助資料添付 実装完了報告

## 追加仕様の反映

1. **PATCH 提出時は version 必須**  
   `patchWorkReport(logId, body)` の body に必ず `version` を含める（V1 楽観ロック）。  
   例: `{ version, state: 'submitted' }`  
   → `cleaningDayReportApi.js` に JSDoc で明記済み。呼び出し側は `{ state: 'submitted', version: s.saved.version }` を送信。

2. **POST /upload-url の実装を確定**  
   - 対象バケット: 環境変数（`UPLOAD_BUCKET` 等）  
   - key: `reports/{date}/{uuid}_{sanitized_filename}`（衝突防止で uuid 必須）  
   - Content-Type を presign 条件に含める  
   - S3 CORS: PUT/GET 許可、Origin は misesapo ドメイン  
   - fileUrl: S3 直 or CloudFront を仕様で決定し返す  
   → `docs/UPLOAD_URL_SPEC.md` に仕様、`docs/upload-url-handler.example.js` に参照実装を記載。

---

## 変更ファイル一覧（path）

| 種別 | パス |
|------|------|
| フロント | `src/shared/ui/Report/CleaningDayReportPage.jsx` |
| フロント | `src/shared/ui/Report/cleaningDayReportApi.js` |
| スタイル | `src/shared/ui/Report/cleaning-day-report.css` |
| 仕様 | `docs/UPLOAD_URL_SPEC.md` |
| 参照実装 | `docs/upload-url-handler.example.js` |
| 報告 | `docs/IMPLEMENTATION_REPORT_CLEANING_ATTACHMENTS.md`（本ファイル） |

---

## CleaningDayReportPage.jsx の serializeStoreReport / deserializeStoreReport 実装抜粋

```javascript
/** 店舗レポートの description(JSON) をシリアライズ（後で report_data 移行時も流用） */
function serializeStoreReport(store) {
  return {
    store: {
      name: store.store_name || '',
      address: store.address || '',
      witness: store.witness || '',
      work_start_time: store.work_start_time || '',
      work_end_time: store.work_end_time || '',
      note: store.note || '',
    },
    services: store.services || [],
    attachments: store.attachments || [],
  };
}

/** GET で取得した 1 件の店舗レポートから store オブジェクトを復元 */
function deserializeStoreReport(descriptionJson, workReportItem) {
  let store = {};
  let services = [{ name: '', minutes: 0, memo: '' }];
  let attachments = [];
  try {
    const d = JSON.parse(descriptionJson || '{}');
    store = d.store || {};
    services = Array.isArray(d.services) && d.services.length ? d.services : services;
    attachments = Array.isArray(d.attachments) ? d.attachments : [];
  } catch (_) {}
  return {
    enabled: true,
    store_name: store.name || workReportItem?.target_label || '',
    address: store.address || '',
    witness: store.witness || '',
    work_start_time: store.work_start_time || '',
    work_end_time: store.work_end_time || '',
    store_minutes: workReportItem?.work_minutes || 0,
    note: store.note || '',
    services,
    attachments,
    saved: {
      log_id: workReportItem?.log_id ?? null,
      version: workReportItem?.version ?? null,
      state: workReportItem?.state ?? null,
    },
  };
}
```

---

## PUT /work-report の body（店舗保存）例

```json
{
  "date": "2026-01-31",
  "work_date": "2026-01-31",
  "work_minutes": 120,
  "template_id": "CLEANING_STORE_V1",
  "state": "draft",
  "target_label": "店舗A",
  "description": "{\"store\":{\"name\":\"店舗A\",\"address\":\"\",\"witness\":\"\",\"work_start_time\":\"09:00\",\"work_end_time\":\"11:00\",\"note\":\"\"},\"services\":[{\"name\":\"清掃\",\"minutes\":60,\"memo\":\"\"}],\"attachments\":[{\"name\":\"指示書.pdf\",\"mime\":\"application/pdf\",\"size\":12345,\"url\":\"https://.../reports/2026-01-31/uuid_指示書.pdf\",\"key\":\"reports/2026-01-31/uuid_指示書.pdf\",\"uploaded_at\":\"2026-01-31T00:00:00.000Z\"}]}"
}
```

- 既存保存の上書き時は `log_id`, `version` を同 body に含める。

---

## GET /work-report 復元ロジック（template_id / target_label マッチ）抜粋

```javascript
getWorkReport({ date })
  .then((items) => {
    if (!items || !Array.isArray(items) || items.length === 0) return;
    // 日次サマリ
    const dayItem = items.find((i) => i.template_id === TEMPLATE_DAY);
    if (dayItem) { /* header, daySaved を set */ }
    // 店舗レポート（CLEANING_STORE_V1）をインデックス 0,1,2 に復元
    const storeItems = items.filter((i) => i.template_id === TEMPLATE_STORE);
    if (storeItems.length > 0) {
      setStores((prev) => {
        const next = [...prev];
        storeItems.slice(0, 3).forEach((it, i) => {
          next[i] = deserializeStoreReport(it.description, it);
        });
        return next;
      });
    }
  });
```

- `template_id === 'CLEANING_STORE_V1'` の要素を最大 3 件取得し、配列インデックス 0,1,2 に `deserializeStoreReport(it.description, it)` で復元。  
- 店舗の対応付けは「日付＋template_id で取得した順」で行い、`target_label`（店舗名）は `deserializeStoreReport` 内で `store.name` のフォールバックに使用。

---

## upload-url 実装（参照実装）抜粋

- **フロント呼び出し**: `src/shared/ui/Report/cleaningDayReportApi.js` の `getUploadUrl({ filename, mime, size, context, date, storeIndex })` が `POST /upload-url` を呼び、レスポンスの `{ uploadUrl, fileUrl, key }` を返す。
- **バックエンド**: 本リポジトリには API サーバーが含まれないため、仕様と参照実装をドキュメントで提供。

**参照実装抜粋**（`docs/upload-url-handler.example.js`）:

```javascript
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { randomUUID } = require('crypto');

const key = `reports/${date}/${randomUUID()}_${sanitizeFilename(filename)}`;

const command = new PutObjectCommand({
  Bucket: bucket,
  Key: key,
  ContentType: mime || 'application/octet-stream',
});

const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

const fileUrl = cloudFrontDomain
  ? `https://${cloudFrontDomain}/${key}`
  : `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

return { uploadUrl, fileUrl, key };
```

- バケット: 環境変数（例: `UPLOAD_BUCKET`）。  
- key: `reports/{date}/{uuid}_{sanitized_filename}`。  
- Presign 時に `ContentType` を指定し、署名条件に含める。  
- fileUrl: `CLOUDFRONT_DOMAIN` があれば CloudFront、なければ S3 直 URL。  
- 詳細は `docs/UPLOAD_URL_SPEC.md` を参照。
