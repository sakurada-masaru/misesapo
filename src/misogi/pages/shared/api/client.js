/**
 * API クライアント（fetch wrapper）
 * /api = 本番ゲート（51bhoxkbxd）。/api-wr = 業務報告専用ゲート（1x0f73dj2l = misesapo-work-report）。
 */

const defaultBase = '/api';
const workReportBase = '/api-wr';

function getApiBase() {
  if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') return defaultBase;
  if (import.meta.env.DEV) return defaultBase;
  return import.meta.env.VITE_API_BASE ?? defaultBase;
}

export function getWorkReportApiBase() {
  if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') return workReportBase;
  if (import.meta.env.DEV) return workReportBase;
  return import.meta.env.VITE_WORK_REPORT_API_BASE ?? workReportBase;
}

/**
 * @param {string} path - パス（先頭 / なし可）
 * @param {RequestInit} options - fetch の options
 */
export async function apiFetch(path, options = {}) {
  const base = getApiBase();
  const url = path.startsWith('http') ? path : `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) {
    let bodyMessage = res.statusText || 'API Error';
    let bodyText = '';
    try {
      bodyText = await res.text();
      if (bodyText) {
        const j = JSON.parse(bodyText);
        bodyMessage = j?.message || j?.error || bodyMessage;
      }
    } catch (_) {}
    const err = new Error(bodyMessage);
    err.status = res.status;
    err.response = res;
    err.url = url;
    err.body = bodyText;
    throw err;
  }
  return res.json();
}

/** 業務報告専用（/api-wr → 1x0f73dj2l）。work-report, upload-url, upload-put 用。 */
export async function apiFetchWorkReport(path, options = {}) {
  const base = getWorkReportApiBase();
  const url = path.startsWith('http') ? path : `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) {
    let bodyMessage = res.statusText || 'API Error';
    let bodyText = '';
    try {
      bodyText = await res.text();
      if (bodyText) {
        const j = JSON.parse(bodyText);
        bodyMessage = j?.message || j?.error || bodyMessage;
      }
    } catch (_) {}
    const err = new Error(bodyMessage);
    err.status = res.status;
    err.response = res;
    err.url = url;
    err.body = bodyText;
    throw err;
  }
  return res.json();
}
