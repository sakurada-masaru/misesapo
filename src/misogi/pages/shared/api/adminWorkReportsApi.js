/**
 * 業務報告（管理）用 API
 * GET /admin/work-reports … 一覧（from/to, states）※本番ゲート /api
 * GET /work-report?date=… … 作業者用・自分の報告のみ（専用ゲート /api-wr = 1x0f73dj2l）
 */

import { apiFetch, apiFetchWorkReport } from './client';
import { getAuthHeaders } from '../auth/cognitoStorage';

/**
 * 指定日の work-report 一覧を取得（作業者用・自分の報告のみ）。業務報告専用ゲート /api-wr を使用。
 * @param {string} date - YYYY-MM-DD
 * @returns {Promise<Array>} 報告配列
 */
export async function getWorkReportsByDate(date) {
  const qs = `date=${encodeURIComponent(date)}`;
  const res = await apiFetchWorkReport(`/work-report?${qs}`, { headers: getAuthHeaders() });
  if (Array.isArray(res)) return res;
  return res?.items ?? res?.rows ?? [];
}

/**
 * 管理一覧取得（/admin/work-reports 用）
 * @param {{ from?: string, to?: string, states?: string[], templates?: string[] }} params
 */
export async function getAdminWorkReports(params = {}) {
  const q = new URLSearchParams();
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  if (params.states?.length) q.set('states', params.states.join(','));
  if (params.templates?.length) q.set('templates', params.templates.join(','));
  if (params.limit != null) q.set('limit', String(params.limit));
  const qs = q.toString();
  const url = qs ? `/admin/work-reports?${qs}` : '/admin/work-reports';
  const res = await apiFetch(url, { headers: getAuthHeaders() });
  return res?.items ?? res?.rows ?? [];
}

/**
 * 報告詳細取得（社内・認証必須）
 * GET /admin/work-reports/{report_id}
 */
export async function getAdminWorkReportDetail(reportId) {
  return apiFetch(`/admin/work-reports/${encodeURIComponent(reportId)}`, { headers: getAuthHeaders() });
}

/**
 * 報告の状態変更（差し戻し・承認など）。社内・認証必須。
 * PATCH /admin/work-reports/{report_id}/state
 * @param {string} reportId - log_id
 * @param {{ to: 'rejected'|'approved'|'triaged'|'archived', reason?: string, comment?: string, version?: number }} body
 *   - to: 遷移先状態（rejected のときは reason または comment 必須）
 */
export async function patchAdminWorkReportState(reportId, body) {
  return apiFetch(`/admin/work-reports/${encodeURIComponent(reportId)}/state`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
}

/**
 * 経理用・ユーザー×年月の月次ビュー（社内・認証必須）
 * GET /admin/payroll/{user_id}/{YYYY-MM}
 * @param {string} userId - worker_id
 * @param {string} yyyyMm - YYYY-MM
 * @param {{ state?: string }} params - state=all で全件、デフォルトは approved のみ
 */
export async function getAdminPayrollMonth(userId, yyyyMm, params = {}) {
  const q = new URLSearchParams();
  if (params.state) q.set('state', params.state);
  const qs = q.toString();
  const path = `/admin/payroll/${encodeURIComponent(userId)}/${encodeURIComponent(yyyyMm)}`;
  const url = qs ? `${path}?${qs}` : path;
  return apiFetch(url, { headers: getAuthHeaders() });
}
