/**
 * API クライアント（fetch wrapper）
 * ベースURL・ヘッダー・エラーハンドリングを共通化。
 */

const defaultBase = '/api';

/**
 * @param {string} path - パス（先頭 / なし可）
 * @param {RequestInit} options - fetch の options
 */
export async function apiFetch(path, options = {}) {
  const base = import.meta.env.VITE_API_BASE ?? defaultBase;
  const url = path.startsWith('http') ? path : `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = new Error(res.statusText || 'API Error');
    err.status = res.status;
    err.response = res;
    throw err;
  }
  return res.json();
}
