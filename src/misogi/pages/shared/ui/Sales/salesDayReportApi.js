/**
 * 営業日報用 API
 * PUT /work-report（日次・案件の下書き）、PATCH /work-report/{log_id}（案件提出）、GET /work-report?date=...
 * POST /upload-url（添付用、清掃側と同等・context で区別）
 */
import { apiFetch } from '../../api/client';

export async function putWorkReport(body) {
  return apiFetch('/work-report', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/**
 * 楽観ロック更新（version 必須）
 * @param {string} logId
 * @param {{ version: number, state?: string }} body - 例: { version, state: 'submitted' }
 */
export async function patchWorkReport(logId, body) {
  return apiFetch(`/work-report/${logId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function getWorkReport(query = {}) {
  const params = new URLSearchParams(query);
  const qs = params.toString();
  return apiFetch(qs ? `/work-report?${qs}` : '/work-report');
}

/**
 * 指定日の work-report 一覧を取得（復元用）
 * @param {string} date - YYYY-MM-DD
 */
export async function getWorkReportByDate(date) {
  return getWorkReport({ date });
}

/**
 * 補助資料アップロード用 Presigned URL
 * @param {{ filename: string, mime: string, size: number, context: string, date: string, storeKey?: string }} params
 * context: "sales-day-attachment" | "sales-case-attachment"
 * storeKey: 案件用の場合に case.store_key を渡す（任意）
 */
export async function getUploadUrl({ filename, mime, size, context, date, storeKey }) {
  return apiFetch('/upload-url', {
    method: 'POST',
    body: JSON.stringify({ filename, mime, size, context, date, storeKey: storeKey || '' }),
  });
}
