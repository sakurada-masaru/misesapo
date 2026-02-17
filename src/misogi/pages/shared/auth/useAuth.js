/**
 * 認証状態フック（localStorage の cognito_id_token / cognito_user を参照）
 * サインインはメインサイトの /staff/signin.html で行い、同一オリジンならトークンが共有される。
 *
 * @returns {{ user: object | null, isAuthenticated: boolean, isLoading: boolean, getToken: fn, login: fn, logout: fn }}
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getCognitoIdToken, getCognitoUser } from './cognitoStorage';

const MASTER_OWNER_EMAIL = 'sakurada@misesapo.co.jp';

/** JWT の exp（秒）を読む。無効なら null */
function getTokenExp(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    const exp = payload.exp;
    return typeof exp === 'number' ? exp : null;
  } catch {
    return null;
  }
}

/** トークンが有効期限内か（60秒マージン） */
function isTokenValid(token) {
  const exp = getTokenExp(token);
  if (exp == null) return false;
  return Date.now() / 1000 < exp - 60;
}

export function useAuth() {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(() => {
    const token = getCognitoIdToken();
    const valid = !!token && isTokenValid(token);
    if (!valid) {
      setUser(null);
      setIsAuthenticated(false);
      return;
    }
    const rawUser = getCognitoUser() || { id: 'unknown', role: 'staff' };
    const email = String(rawUser?.email || rawUser?.attributes?.email || '').trim().toLowerCase();
    if (email === MASTER_OWNER_EMAIL) {
      const roles = Array.isArray(rawUser.roles) ? rawUser.roles : [];
      const mergedRoles = roles.includes('admin') ? roles : [...roles, 'admin'];
      setUser({ ...rawUser, role: 'admin', roles: mergedRoles });
    } else {
      setUser(rawUser);
    }
    setIsAuthenticated(true);
  }, []);

  useEffect(() => {
    refresh();
    setIsLoading(false);
  }, [refresh]);

  /** API 用 Bearer トークン。無い場合は null */
  const getToken = useCallback(() => {
    const token = getCognitoIdToken();
    if (!token || !isTokenValid(token)) return null;
    return token;
  }, []);

  /** 未認証時にポータルへ（そこでログインしてもらう方針に変更） */
  const login = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.location.href = window.location.origin + (import.meta.env.BASE_URL || '/');
    }
  }, []);

  /** ログアウト：localStorage をクリアしてサインインへ */
  const logout = useCallback(() => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem('cognito_id_token');
    window.localStorage.removeItem('cognito_access_token');
    window.localStorage.removeItem('cognito_refresh_token');
    window.localStorage.removeItem('cognito_user');
    window.localStorage.removeItem('misesapo_auth');
    setUser(null);
    setIsAuthenticated(false);

    // Redirect to the application root (Portal) instead of signin.html
    if (typeof window !== 'undefined') {
      window.location.href = window.location.origin + (import.meta.env.BASE_URL || '/');
    }
  }, []);

  const authz = useMemo(() => {
    if (!user) return { workerId: null, isDev: false, isAdmin: false, dept: null, allowedTemplateIds: [] };

    const workerId = user.sagyouin_id || user.worker_id || user.workerId || user.id || 'unknown';
    const roles = (Array.isArray(user.roles) ? user.roles : (user.role ? [user.role] : []))
      .map((r) => String(r || '').trim().toUpperCase())
      .filter(Boolean);
    const email = (user.email || user.attributes?.email || '').trim().toLowerCase();

    let dept = String(user.department || user.dept || '').trim().toUpperCase();
    if (!dept) {
      if (roles.includes('SALES') || roles.includes('EIGYO')) dept = 'SALES';
      else if (roles.includes('DEV') || roles.includes('DEVELOPER') || roles.includes('ENGINEERING') || roles.includes('ENGINEER')) dept = 'ENGINEERING';
      else if (roles.includes('CLEANING') || roles.includes('STAFF') || roles.includes('SEISOU')) dept = 'CLEANING';
      else if (roles.includes('ADMIN') || roles.includes('OWNER') || roles.includes('SUPERADMIN')) dept = 'ADMIN';
      else dept = 'OFFICE';
    }

    if (email === 'konno@misesapo.co.jp') dept = 'SALES';
    if (email === 'taira@misesapo.co.jp') dept = 'SALES';

    const isDev = roles.includes('DEV') || roles.includes('DEVELOPER') || workerId === 'W999';
    const isAdmin = isDev || roles.some((r) => ['ADMIN', 'OWNER', 'SUPERADMIN'].includes(r));

    let allowedTemplateIds = [];
    if (isDev || isAdmin) {
      if (dept === 'SALES') {
        allowedTemplateIds = ['SALES_ACTIVITY_REPORT_V1', 'CLEANING_V1', 'ENGINEERING_V1', 'OFFICE_ADMIN_V1'];
      } else {
        allowedTemplateIds = ['CLEANING_V1', 'SALES_ACTIVITY_REPORT_V1', 'ENGINEERING_V1', 'OFFICE_ADMIN_V1'];
      }
    } else {
      if (dept === 'SALES') allowedTemplateIds.push('SALES_ACTIVITY_REPORT_V1');
      else if (dept === 'ENGINEERING') allowedTemplateIds.push('ENGINEERING_V1');
      else if (['OFFICE', 'ADMIN'].includes(dept)) allowedTemplateIds.push('OFFICE_ADMIN_V1');
      else allowedTemplateIds.push('CLEANING_V1');
    }

    return { workerId, isDev, isAdmin, dept, allowedTemplateIds };
  }, [user]);

  return {
    user,
    isAuthenticated,
    isLoading,
    getToken,
    login,
    logout,
    refresh,
    authz,
  };
}
