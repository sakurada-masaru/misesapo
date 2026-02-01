/**
 * 清掃レポート（1日）用 API（業務報告専用ゲート /api-wr = 1x0f73dj2l）
 * PUT /work-report、PATCH /work-report/{log_id}、GET /work-report?date=...
 */
import { apiFetchWorkReport } from '../../api/client';
import { getAuthHeaders } from '../../auth/cognitoStorage';

export async function putWorkReport(body) {
  return apiFetchWorkReport('/work-report', {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
}

/**
 * 店舗レポート提出（楽観ロック）
 * @param {string} logId - レポート log_id
 * @param {{ version: number, state?: string }} body - version 必須（V1 楽観ロック）。例: { version, state: 'submitted' }
 */
export async function patchWorkReport(logId, body) {
  return apiFetchWorkReport(`/work-report/${logId}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
}

export async function getWorkReport(query = {}) {
  const params = new URLSearchParams(query);
  const qs = params.toString();
  return apiFetchWorkReport(qs ? `/work-report?${qs}` : '/work-report', { headers: getAuthHeaders() });
}

/**
 * 補助資料アップロード用 Presigned URL 取得
 * @param {{ filename: string, mime: string, size: number, context: string, date: string, storeIndex: number }} params
 * @returns {{ uploadUrl: string, fileUrl: string, key: string }}
 */
export async function getUploadUrl({ filename, mime, size, context, date, storeIndex }) {
  return apiFetchWorkReport('/upload-url', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ filename, mime, size, context, date, storeIndex }),
  });
}
