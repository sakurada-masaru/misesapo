/**
 * 営業カルテ用 API（業務報告専用ゲート /api-wr = 1x0f73dj2l）
 * PUT /work-report, PATCH /work-report/{log_id}, GET /work-report?date=...
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
 * @param {{ version: number, state?: string }} body - 例: { version, state: 'submitted' } または ToDo 完了時 { version, state: 'done' }
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
 * 直近 N 日分を取得して storeKey でフィルタ（GET が date のみの場合の回避策）
 * @param {string} storeKey
 * @param {number} days - 取得する日数（デフォルト 30）
 * @returns {Promise<Array>} work-report 配列（日付混在）
 */
export async function getWorkReportsForStore(storeKey, days = 30) {
  const today = new Date();
  const results = [];
  const seen = new Set();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    try {
      const items = await getWorkReport({ date });
      if (!Array.isArray(items)) continue;
      for (const it of items) {
        let match = false;
        try {
          const desc = typeof it.description === 'string' ? JSON.parse(it.description || '{}') : it.description || {};
          if (desc.store?.key === storeKey || desc.store_key === storeKey) match = true;
        } catch (_) {}
        if (match && it.log_id && !seen.has(it.log_id)) {
          seen.add(it.log_id);
          results.push(it);
        }
      }
    } catch (_) {
      // 日付にデータがなければスキップ
    }
  }
  return results;
}

/**
 * 補助資料アップロード用 Presigned URL（清掃側と同じ POST /upload-url、context で区別）
 * @param {{ filename: string, mime: string, size: number, context: string, date: string, storeKey: string }} params
 * context: "sales-entity-attachment" | "sales-activity-attachment" | "sales-todo-attachment"
 */
export async function getUploadUrl({ filename, mime, size, context, date, storeKey }) {
  return apiFetchWorkReport('/upload-url', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ filename, mime, size, context, date, storeKey }),
  });
}
