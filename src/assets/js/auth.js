/**
 * 統一認証システム（APIベース）
 * ロールベースのアクセス制御を実装
 * 
 * 注意: role_config.jsが先に読み込まれている必要があります
 */

(function() {
  'use strict';
  
  // role_config.jsから関数と設定を取得（グローバルスコープから）
  function getRoleConfig() {
    return window.RoleConfig?.ROLE_CONFIG;
  }
  
  const checkPageAccess = window.RoleConfig?.checkPageAccess || function() { return false; };
  const getRoleDisplayName = window.RoleConfig?.getRoleDisplayName || function(role) { return role; };
  const getNavigationForRole = window.RoleConfig?.getNavigationForRole || function(role) { return []; };
  const getMasterNavigation = window.RoleConfig?.getMasterNavigation || function() { return {}; };
  const getDefaultPageForRole = window.RoleConfig?.getDefaultPageForRole || function(role) { return '/index.html'; };
  
  // 認証設定
  const AUTH_KEY = 'misesapo_auth';
  const USER_KEY = 'misesapo_user';
  
  /**
   * ベースパスを取得（GitHub Pages対応）
   */
  function getBasePath() {
    const base = document.querySelector('base');
    if (base && base.href) {
      try {
        const url = new URL(base.href);
        return url.pathname;
      } catch (e) {
        return base.getAttribute('href') || '/';
      }
    }
    const path = window.location.pathname;
    if (path.includes('/misesapo/')) {
      return '/misesapo/';
    }
    return '/';
  }
  
  /**
   * APIエンドポイントのベースURLを取得
   */
  function getApiBaseUrl() {
    // GitHub PagesではAPIが使えないため、ローカル開発サーバーのURLを使用
    // 本番環境では別のAPIサーバーを使用する必要がある
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:5173';
    }
    // GitHub PagesではAPIが使えないため、空文字を返す
    return '';
  }
  
  /**
   * 認証情報を取得
   */
  function getAuthData() {
    try {
      // まずuserオブジェクトから取得を試みる
      const userData = sessionStorage.getItem(USER_KEY);
      if (userData) {
        const user = JSON.parse(userData);
        // roleが文字列であることを確認
        if (user && typeof user.role === 'string') {
          return {
            role: user.role,
            email: user.email,
            user: user
          };
        }
      }
      
      // フォールバック: 古い形式の認証データ
      const authData = sessionStorage.getItem(AUTH_KEY);
      if (authData) {
        const data = JSON.parse(authData);
        // roleが文字列であることを確認
        if (data && typeof data.role === 'string') {
          return data;
        }
        // roleがオブジェクトの場合、userオブジェクトから取得を試みる
        if (data && data.user && typeof data.user.role === 'string') {
          return {
            role: data.user.role,
            email: data.user.email,
            user: data.user
          };
        }
      }
      
      return null;
    } catch (e) {
      console.error('[Auth] Error getting auth data:', e);
      return null;
    }
  }
  
  /**
   * 認証情報を保存
   */
  function setAuthData(role, email, user) {
    // roleが文字列であることを確認
    if (typeof role !== 'string') {
      console.error('[Auth] Invalid role type:', typeof role, role);
      if (user && typeof user.role === 'string') {
        role = user.role;
      } else {
        console.error('[Auth] Cannot determine role from user object');
        return;
      }
    }
    
    // userオブジェクトを保存
    if (user) {
      sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    }
    
    // 認証データを保存（後方互換性のため）
    sessionStorage.setItem(AUTH_KEY, JSON.stringify({
      role: role,
      email: email || (user ? user.email : null),
      timestamp: Date.now(),
      user: user || null
    }));
  }
  
  /**
   * 認証情報を削除
   */
  function clearAuthData() {
    sessionStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem(USER_KEY);
  }
  
  /**
   * 現在のロールを取得
   */
  function getCurrentRole() {
    const authData = getAuthData();
    if (!authData) {
      return 'guest';
    }
    
    // roleが文字列であることを確認
    if (typeof authData.role === 'string') {
      return authData.role;
    }
    
    // roleがオブジェクトの場合、userオブジェクトから取得を試みる
    if (authData.user && typeof authData.user.role === 'string') {
      return authData.user.role;
    }
    
    console.warn('[Auth] Invalid role format:', authData);
    return 'guest';
  }
  
  /**
   * ログイン（APIベース）
   */
  async function login(email, password) {
    const apiBaseUrl = getApiBaseUrl();
    if (!apiBaseUrl) {
      return {
        success: false,
        message: 'APIサーバーに接続できません。ローカル開発サーバーを起動してください。'
      };
    }
    
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: email,
          password: password
        })
      });
      
      // Content-Typeを確認
      const contentType = response.headers.get('Content-Type') || '';
      if (!contentType.includes('application/json')) {
        const text = await response.text();
        console.error('[Auth] Invalid response type:', contentType, text.substring(0, 200));
        return {
          success: false,
          message: 'サーバーからの応答が正しくありません。ページを再読み込みしてください。'
        };
      }
      
      const result = await response.json();
      
      if (result.success && result.user) {
        // 認証情報を保存
        const role = result.user.role;
        if (typeof role !== 'string') {
          console.error('[Auth] Invalid role in response:', result.user);
          return {
            success: false,
            message: 'サーバーからの応答が正しくありません。'
          };
        }
        
        setAuthData(role, result.user.email, result.user);
        
        return {
          success: true,
          user: result.user,
          role: role
        };
      } else {
        return {
          success: false,
          message: result.message || 'ログインに失敗しました'
        };
      }
    } catch (error) {
      console.error('[Auth] Login error:', error);
      return {
        success: false,
        message: 'ログイン処理でエラーが発生しました。ページを再読み込みしてください。'
      };
    }
  }
  
  /**
   * ログアウト
   */
  async function logout() {
    const apiBaseUrl = getApiBaseUrl();
    
    // APIサーバーにログアウトリクエストを送信（オプション）
    if (apiBaseUrl) {
      try {
        await fetch(`${apiBaseUrl}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });
      } catch (error) {
        console.error('[Auth] Logout API error:', error);
        // エラーが発生しても続行
      }
    }
    
    // 認証情報を削除
    clearAuthData();
    
    // ログインページにリダイレクト
    const basePath = getBasePath();
    window.location.href = basePath === '/' ? '/signin.html' : basePath + 'signin.html';
  }
  
  /**
   * 認証チェック
   */
  function checkAuth() {
    return getAuthData() !== null;
  }
  
  /**
   * ページアクセス権限をチェック
   */
  function checkPageAccessForPath(path) {
    const currentRole = getCurrentRole();
    return checkPageAccess(path, currentRole);
  }
  
  /**
   * パスを解決（ベースパス付き）
   */
  function resolvePath(path) {
    if (!path || path.startsWith('http://') || path.startsWith('https://') || path.startsWith('//')) {
      return path;
    }
    const basePath = getBasePath();
    if (path.startsWith('/')) {
      return basePath === '/' ? path : basePath.slice(0, -1) + path;
    }
    return basePath === '/' ? '/' + path : basePath + path;
  }
  
  /**
   * 現在のページへのアクセス権限をチェック
   */
  function checkCurrentPageAccess() {
    const currentPath = window.location.pathname;
    const currentRole = getCurrentRole();
    
    // マスター、管理者、開発者はすべてのページにアクセス可能
    if (currentRole === 'master' || currentRole === 'admin' || currentRole === 'developer') {
      return true;
    }
    
    // ログインページとサインアップページは常にアクセス可能
    if (currentPath.includes('/signin.html') || currentPath.includes('/signup')) {
      return true;
    }
    
    // ベースパスを除去したパスでチェック（GitHub Pages対応）
    const basePath = getBasePath();
    let normalizedPath = currentPath;
    if (basePath !== '/' && currentPath.startsWith(basePath)) {
      normalizedPath = currentPath.substring(basePath.length - 1); // 先頭の/を残す
    }
    
    // パブリックページ（index.html, service.html）は常にアクセス可能
    if (normalizedPath === '/index.html' || normalizedPath === '/service.html' || normalizedPath.startsWith('/service/')) {
      return true;
    }
    
    // ページアクセス権限をチェック
    if (typeof checkPageAccess === 'function' && !checkPageAccess(normalizedPath, currentRole)) {
      // アクセス権限がない場合、ログインページにリダイレクト
      const redirectUrl = encodeURIComponent(window.location.href);
      window.location.href = basePath === '/' 
        ? `/signin.html?redirect=${redirectUrl}` 
        : `${basePath}signin.html?redirect=${redirectUrl}`;
      return false;
    }
    
    return true;
  }
  
  // グローバルに公開
  window.Auth = {
    login: login,
    logout: logout,
    checkAuth: checkAuth,
    getCurrentRole: getCurrentRole,
    checkPageAccess: checkPageAccessForPath,
    checkCurrentPageAccess: checkCurrentPageAccess,
    getDefaultPageForRole: getDefaultPageForRole,
    getAuthData: getAuthData,
    setAuthData: setAuthData
  };
  
  // getDefaultPageForRoleを直接使用可能にする（後方互換性のため）
  window.Auth.getDefaultPageForRole = getDefaultPageForRole;
  
  // ページ読み込み時に実行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      checkCurrentPageAccess();
    });
  } else {
    checkCurrentPageAccess();
  }
})();
