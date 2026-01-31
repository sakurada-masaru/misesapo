/**
 * Role 定義・判定
 * 権限チェックや表示制御に利用。
 */

export const ROLES = {
  ADMIN: 'admin',
  STAFF: 'staff',
  GUEST: 'guest',
};

/**
 * @param {object} user - 認証ユーザー
 * @param {string} role - ROLES のいずれか
 */
export function hasRole(user, role) {
  return user?.role === role;
}
