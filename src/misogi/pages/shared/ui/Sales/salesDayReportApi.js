/**
 * 営業日報用 API（業務報告専用ゲート /api-wr = 1x0f73dj2l）
 * PUT /work-report、PATCH /work-report/{log_id}、GET /work-report?date=...
 * POST /upload-url、POST /upload-put（Lambda 経由 S3）
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
 * 楽観ロック更新（version 必須）
 * @param {string} logId
 * @param {{ version: number, state?: string }} body - 例: { version, state: 'submitted' }
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
 * 指定日の work-report 一覧を取得（復元用）
 * @param {string} date - YYYY-MM-DD
 */
export async function getWorkReportByDate(date) {
  return getWorkReport({ date });
}

/**
 * 補助資料アップロード用 Presigned URL
 */
export async function getUploadUrl({ filename, mime, size, context, date, storeKey }) {
  return apiFetchWorkReport('/upload-url', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ filename, mime, size, context, date, storeKey: storeKey || '' }),
  });
}

/**
 * Presigned URL 宛に API 経由で PUT（Lambda が S3 に PUT）。約 4.5MB まで。
 */
export async function uploadPutToS3(uploadUrl, contentType, fileBase64) {
  return apiFetchWorkReport('/upload-put', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ uploadUrl, contentType, fileBase64 }),
  });
}
