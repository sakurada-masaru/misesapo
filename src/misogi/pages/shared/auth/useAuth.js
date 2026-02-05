/**
 * 認証状態フック（localStorage の cognito_id_token / cognito_user を参照）
 * サインインはメインサイトの /staff/signin.html で行い、同一オリジンならトークンが共有される。
 *
 * @returns {{ user: object | null, isAuthenticated: boolean, isLoading: boolean, getToken: fn, login: fn, logout: fn }}
 */

import { useState, useEffect, useCallback } from 'react';
import { getCognitoIdToken, getCognitoUser } from './cognitoStorage';

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
    const u = getCognitoUser();
    setUser(u || { id: 'unknown', role: 'staff' });
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

  const authz = (() => {
    if (!user) return { workerId: null, isDev: false, isAdmin: false, allowedTemplateIds: [] };

    const workerId = user.worker_id || user.workerId || user.id || 'unknown';
    const roles = Array.isArray(user.roles) ? user.roles : (user.role ? [user.role] : []);
    const dept = (user.department || user.dept || '').toUpperCase();

    const isDev = workerId === 'W999';
    const isAdmin = isDev || roles.some(r => ['ADMIN', 'OWNER', 'SUPERADMIN'].includes(r.toUpperCase()));

    let allowedTemplateIds = [];
    if (isDev || isAdmin) {
      allowedTemplateIds = ['CLEANING_V1', 'FIELD_SALES_V1', 'ENGINEERING_V1', 'OFFICE_ADMIN_V1'];
    } else {
      if (dept === 'SALES') allowedTemplateIds.push('FIELD_SALES_V1');
      else if (dept === 'ENGINEERING') allowedTemplateIds.push('ENGINEERING_V1');
      else if (['OFFICE', 'ADMIN'].includes(dept)) allowedTemplateIds.push('OFFICE_ADMIN_V1');
      else allowedTemplateIds.push('CLEANING_V1');
    }

    return { workerId, isDev, isAdmin, allowedTemplateIds };
  })();

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
