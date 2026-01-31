/**
 * 清掃レポート（1日）用 API
 * PUT /work-report（下書き保存）、PATCH /work-report/{log_id}（提出）、GET /work-report?date=...（復元）
 * POST /upload-url（Presigned URL取得）→ ブラウザからS3直PUT
 */
import { apiFetch } from '../../api/client';

export async function putWorkReport(body) {
  return apiFetch('/work-report', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

/**
 * 店舗レポート提出（楽観ロック）
 * @param {string} logId - レポート log_id
 * @param {{ version: number, state?: string }} body - version 必須（V1 楽観ロック）。例: { version, state: 'submitted' }
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
 * 補助資料アップロード用 Presigned URL 取得
 * @param {{ filename: string, mime: string, size: number, context: string, date: string, storeIndex: number }} params
 * @returns {{ uploadUrl: string, fileUrl: string, key: string }}
 */
export async function getUploadUrl({ filename, mime, size, context, date, storeIndex }) {
  return apiFetch('/upload-url', {
    method: 'POST',
    body: JSON.stringify({ filename, mime, size, context, date, storeIndex }),
  });
}
