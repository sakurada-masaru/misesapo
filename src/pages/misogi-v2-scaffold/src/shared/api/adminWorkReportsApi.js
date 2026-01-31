/**
 * 業務報告（管理）用 API
 * GET /work-report?date=YYYY-MM-DD … 一覧（Bearer 認証）
 * GET /admin/work-reports … 一覧（from/to, states, templates）※別途利用可
 */

import { apiFetch } from './client';
import { getAuthHeaders } from '../auth/cognitoStorage';

/**
 * 指定日の work-report 一覧を取得（Bearer 付与）
 * @param {string} date - YYYY-MM-DD
 * @returns {Promise<Array>} 報告配列（API が配列で返す場合と { items } の両対応）
 */
export async function getWorkReportsByDate(date) {
  const qs = `date=${encodeURIComponent(date)}`;
  const res = await apiFetch(`/work-report?${qs}`, { headers: getAuthHeaders() });
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
