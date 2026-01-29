/**
 * 事務: 作業報告一覧・詳細・状態操作（/office/work-reports）
 * - getAuthToken, fetchAdminReports, renderTable, 409 対応
 */
(function () {
  'use strict';

  const API_BASE = window.OFFICE_WORK_REPORTS_API_BASE || 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';

  function getAuthToken() {
    if (window.CognitoAuth && window.CognitoAuth.isAuthenticated && window.CognitoAuth.isAuthenticated()) {
      const t = window.CognitoAuth.getIdToken && window.CognitoAuth.getIdToken();
      if (t) return t;
    }
    return localStorage.getItem('cognito_id_token') || '';
  }

  function authHeaders() {
    const token = getAuthToken();
    const h = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = 'Bearer ' + token;
    return h;
  }

  async function fetchAdminReports(params) {
    const q = new URLSearchParams(params || {}).toString();
    const url = q ? `${API_BASE}/admin/work-reports?${q}` : `${API_BASE}/admin/work-reports`;
    const res = await fetch(url, { headers: authHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, status: res.status, data };
    return { ok: true, status: res.status, data };
  }

  async function fetchReportDetail(id) {
    const res = await fetch(`${API_BASE}/admin/work-reports/${id}`, { headers: authHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, status: res.status, data };
    return { ok: true, status: res.status, data };
  }

  async function patchState(id, body) {
    const res = await fetch(`${API_BASE}/admin/work-reports/${id}/state`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  async function exportPdf(id) {
    const res = await fetch(`${API_BASE}/admin/work-reports/${id}/export/pdf`, {
      method: 'POST',
      headers: authHeaders()
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  function showToast(message, type) {
    const toast = document.getElementById('office-wr-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'office-wr-toast ' + (type || 'info');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 4000);
  }

  function handle409(data, onRefresh) {
    const reason = (data && data.reason) ? data.reason : 'conflict';
    const msg = (data && data.message) ? data.message : '競合が発生しました。';
    if (reason === 'reason_required') {
      return 'reason_required';
    }
    if (reason === 'version_mismatch' || reason === 'concurrent_update') {
      showToast('⚠ ' + msg + ' 再読み込みしてください。', 'warn');
      if (typeof onRefresh === 'function') onRefresh();
      return 'refresh';
    }
    if (reason === 'invalid_transition' || reason === 'state_locked') {
      showToast('⚠ ' + msg, 'warn');
      return 'disable';
    }
    if (reason === 'not_authorized') {
      showToast('⚠ 権限がありません。管理者ロールを確認してください。', 'warn');
      return 'disable';
    }
    showToast('⚠ ' + msg, 'warn');
    if (typeof onRefresh === 'function') onRefresh();
    return 'refresh';
  }

  function stateLabel(s) {
    const map = { draft: '下書き', submitted: '提出済', triaged: '受付済', approved: '承認済', rejected: '差戻し', archived: 'アーカイブ', canceled: '取消' };
    return map[s] || s;
  }

  window.OfficeWorkReports = {
    API_BASE,
    getAuthToken,
    fetchAdminReports,
    fetchReportDetail,
    patchState,
    exportPdf,
    showToast,
    handle409,
    stateLabel
  };
})();
