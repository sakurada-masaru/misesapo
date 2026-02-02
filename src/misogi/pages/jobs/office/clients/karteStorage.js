/**
 * 店舗ID紐づきカルテの取得・保存・存在保証
 * localStorage を一次保存とし、API があれば同期する。
 */

import { createKarteForStore, mergeKarteWithTemplate } from './karteTemplate.js';

const STORAGE_KEY_PREFIX = 'chart_';
// API ベースURL: 本番環境では直接API Gatewayエンドポイントを使用
const API_BASE = (() => {
  if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
    return '/api';
  }
  if (import.meta.env?.DEV) {
    return '/api';
  }
  // 本番環境: 直接API Gatewayエンドポイントを使用
  return import.meta.env?.VITE_API_BASE || 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';
})();

function getStorageKey(storeId) {
  return `${STORAGE_KEY_PREFIX}${storeId}`;
}

/**
 * 認証ヘッダーを返す
 */
function getAuthHeaders() {
  try {
    const token = localStorage.getItem('cognito_id_token') || (JSON.parse(localStorage.getItem('misesapo_auth') || '{}').token);
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  } catch {
    return { 'Content-Type': 'application/json' };
  }
}

/**
 * 店舗IDに紐づくカルテを localStorage から取得する。
 * @param {string} storeId
 * @returns {object|null} カルテオブジェクト、なければ null
 */
export function getKarte(storeId) {
  if (!storeId) return null;
  try {
    const raw = localStorage.getItem(getStorageKey(storeId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * 店舗IDに紐づくカルテを localStorage に保存する。
 * @param {string} storeId
 * @param {object} karte
 */
export function setKarte(storeId, karte) {
  if (!storeId || !karte) return;
  const toSave = { ...karte, store_id: storeId, updated_at: new Date().toISOString() };
  localStorage.setItem(getStorageKey(storeId), JSON.stringify(toSave));
}

/**
 * 店舗IDに紐づくカルテが存在するかどうか
 * @param {string} storeId
 * @returns {boolean}
 */
export function hasKarte(storeId) {
  return getKarte(storeId) != null;
}

/**
 * 店舗IDに紐づくカルテを取得する。存在しなければテンプレートから作成して保存し、返す。
 * @param {string} storeId - 店舗ID（必須）
 * @param {object} [store] - 店舗オブジェクト（テンプレート作成時に使用）
 * @returns {object} 店舗ID紐づきのカルテ（必ず1件返る）
 */
export function ensureKarteExists(storeId, store = {}) {
  if (!storeId) {
    throw new Error('karteStorage: storeId is required');
  }
  const existing = getKarte(storeId);
  if (existing) {
    return mergeKarteWithTemplate(existing, storeId, store);
  }
  const created = createKarteForStore(storeId, store);
  setKarte(storeId, created);
  return created;
}

/**
 * 店舗IDに紐づく新規カルテをテンプレートから作成し、保存する（既存があれば上書き）。
 * 「新規カルテ作成」ボタン用。
 * @param {string} storeId - 店舗ID（必須）
 * @param {object} [store] - 店舗オブジェクト（テンプレート作成時に使用）
 * @returns {object} 作成したカルテ
 */
export function forceCreateKarte(storeId, store = {}) {
  if (!storeId) {
    throw new Error('karteStorage: storeId is required');
  }
  const created = createKarteForStore(storeId, store);
  setKarte(storeId, created);
  return created;
}

/**
 * カルテを保存（localStorage + 任意で API）
 * @param {string} storeId
 * @param {object} karte
 * @returns {Promise<void>}
 */
export async function saveKarte(storeId, karte) {
  setKarte(storeId, karte);
  try {
    await fetch(`${API_BASE}/kartes`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ store_id: storeId, ...karte }),
    });
  } catch (e) {
    console.warn('[karteStorage] API save failed (optional)', e);
  }
}
