/**
 * API クライアント（fetch wrapper）
 * /api = 予定系ゲート。/api-wr = 業務報告専用ゲート（1x0f73dj2l = misesapo-work-report）。
 */

const defaultBase = '/api';
const workReportBase = '/api-wr';

export function getApiBase() {
  if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') return defaultBase;
  if (import.meta.env.DEV) return defaultBase;
  return import.meta.env.VITE_API_BASE ?? defaultBase;
}

export function getWorkReportApiBase() {
  // 開発環境では必ず Vite proxy を通す（CORS回避）。
  if (typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location?.hostname)) {
    return workReportBase;
  }
  if (import.meta.env.DEV) return workReportBase;

  // 本番は環境変数優先。未設定時のみ既定ゲートへ。
  return import.meta.env.VITE_WORK_REPORT_API_BASE
    ?? 'https://1x0f73dj2l.execute-api.ap-northeast-1.amazonaws.com/prod';
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
    } catch (_) { }
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
    let bodyParsed = null;
    try {
      bodyText = await res.text();
      if (bodyText) {
        try {
          bodyParsed = JSON.parse(bodyText);
          // エラーメッセージの優先順位: message > error > reason > statusText
          bodyMessage = bodyParsed?.message || bodyParsed?.error || bodyParsed?.reason || bodyMessage;
        } catch (_) {
          // JSON でない場合は bodyText をそのまま使用
          bodyMessage = bodyText.length > 200 ? bodyText.substring(0, 200) + '...' : bodyText;
        }
      }
    } catch (_) {
      // テキスト読み取り失敗時は statusText を使用
    }
    const err = new Error(bodyMessage);
    err.status = res.status;
    err.response = res;
    err.url = url;
    err.body = bodyText; // 生のレスポンスボディ（テキスト）
    err.bodyParsed = bodyParsed; // パース済みJSON（あれば）
    // デバッグ用: コンソールに詳細を出力
    console.error(`[apiFetchWorkReport] ${res.status} ${res.statusText}`, {
      url,
      status: res.status,
      bodyText,
      bodyParsed,
    });
    throw err;
  }
  return res.json();
}
