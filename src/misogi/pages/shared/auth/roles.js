/**
 * Role 定義・判定
 * 権限チェックや表示制御に利用。
 */

export const ROLES = {
  ADMIN: 'admin',
  STAFF: 'staff',
  GUEST: 'guest',
};

/** マスター＝全閲覧可（admin と同権限） */
export const MASTER_ROLES = ['admin', 'headquarters'];

/**
 * @param {object} user - 認証ユーザー
 * @param {string} role - ROLES のいずれか
 */
export function hasRole(user, role) {
  return user?.role === role;
}

/** マスター権限（全閲覧可）か */
export function hasMasterRole(user) {
  return user?.role && MASTER_ROLES.includes(user.role);
}
