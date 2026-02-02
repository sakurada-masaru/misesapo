/**
 * 認証用 localStorage 参照（既存の認証方式に合わせる）
 * token: localStorage.getItem('cognito_id_token')
 * user:  JSON.parse(localStorage.getItem('cognito_user'))
 * 秘密情報は扱わず、所在・キー名のみ。
 */

const TOKEN_KEY = 'cognito_id_token';
const USER_KEY = 'cognito_user';

export function getCognitoIdToken() {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getCognitoUser() {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getStoredRole() {
  const user = getCognitoUser();
  return user?.role ?? null;
}

/** admin / headquarters（マスター）または office なら true */
const ALLOWED_ROLES = ['admin', 'headquarters', 'office'];
export function isAdminOrOffice() {
  const role = getStoredRole();
  return role && ALLOWED_ROLES.includes(role);
}

/** API 用 Authorization ヘッダー（token がある場合のみ） */
export function getAuthHeaders() {
  const token = getCognitoIdToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
