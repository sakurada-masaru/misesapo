/**
 * 統一認証システム
 * ロールベースのアクセス制御を実装
 * 
 * 注意: role_config.jsが先に読み込まれている必要があります
 */

(function() {
  'use strict';
  
  // role_config.jsから関数と設定を取得（グローバルスコープから）
  // 注意: この時点でrole_config.jsが読み込まれている必要がある
  function getRoleConfig() {
    return window.RoleConfig?.ROLE_CONFIG;
  }
  
  const checkPageAccess = window.RoleConfig?.checkPageAccess || function() { return false; };
  const getRoleDisplayName = window.RoleConfig?.getRoleDisplayName || function(role) { return role; };
  const getNavigationForRole = window.RoleConfig?.getNavigationForRole || function(role) { return []; };
  const getMasterNavigation = window.RoleConfig?.getMasterNavigation || function() { return {}; };
  
  // 認証設定
  const AUTH_KEY = 'misesapo_auth';
  const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8時間
  
  /**
   * 認証情報を取得
   */
  function getAuthData() {
    try {
      const authData = sessionStorage.getItem(AUTH_KEY);
      if (!authData) return null;
      
      const data = JSON.parse(authData);
      const now = Date.now();
      
      // セッション期限をチェック
      if (now - data.timestamp > SESSION_DURATION) {
        sessionStorage.removeItem(AUTH_KEY);
        return null;
      }
      
      return data;
    } catch (e) {
      return null;
    }
  }
  
  /**
   * 認証情報を保存
   */
  function setAuthData(role, email = null) {
    sessionStorage.setItem(AUTH_KEY, JSON.stringify({
      role: role,
      email: email,
      timestamp: Date.now()
    }));
  }
  
  /**
   * 認証情報を削除
   */
  function clearAuthData() {
    sessionStorage.removeItem(AUTH_KEY);
  }
  
  /**
   * 現在のロールを取得
   */
  function getCurrentRole() {
    const authData = getAuthData();
    return authData ? authData.role : 'guest';
  }
  
  /**
   * ログイン
   */
  function login(role, password, email = null) {
    // 実行時にROLE_CONFIGを取得（読み込みタイミングの問題を回避）
    const ROLE_CONFIG = getRoleConfig();
    
    if (!ROLE_CONFIG) {
      console.error('[Auth] ROLE_CONFIG not found:', {
        RoleConfig: window.RoleConfig,
        role: role
      });
      return { success: false, message: 'ロール設定が読み込まれていません。ページを再読み込みしてください。' };
    }
    
    const roleConfig = ROLE_CONFIG.roles[role];
    if (!roleConfig) {
      console.error('[Auth] Invalid role:', {
        role: role,
        availableRoles: Object.keys(ROLE_CONFIG.roles)
      });
      return { success: false, message: '無効なロールです' };
    }
    
    // パスワードチェック
    if (roleConfig.password && roleConfig.password !== password) {
      return { success: false, message: 'パスワードが正しくありません' };
    }
    
    // 認証情報を保存
    setAuthData(role, email);
    
    return { success: true, role: role };
  }
  
  /**
   * ログアウト
   */
  function logout() {
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
    
    // ページアクセス権限をチェック
    if (typeof checkPageAccess === 'function' && !checkPageAccess(currentPath, currentRole)) {
      // アクセス権限がない場合、ログインページにリダイレクト
      const redirectUrl = encodeURIComponent(window.location.href);
      const basePath = getBasePath();
      window.location.href = basePath === '/' 
        ? `/signin.html?redirect=${redirectUrl}` 
        : `${basePath}signin.html?redirect=${redirectUrl}`;
      return false;
    }
    
    return true;
  }
  
  /**
   * マスター権限用のドロップダウンリストを生成
   */
  function createMasterDropdown() {
    const masterNav = getMasterNavigation();
    const basePath = getBasePath();
    
    const dropdownContainer = document.createElement('div');
    dropdownContainer.className = 'master-nav-dropdown';
    dropdownContainer.style.cssText = 'position: relative; display: inline-block;';
    
    const dropdownButton = document.createElement('button');
    dropdownButton.className = 'nav-link master-dropdown-btn';
    dropdownButton.innerHTML = '<i class="fas fa-crown"></i> ページ一覧 <i class="fas fa-chevron-down"></i>';
    dropdownButton.style.cssText = 'cursor: pointer; border: none; background: none; color: inherit; font: inherit; padding: 0;';
    dropdownButton.setAttribute('aria-haspopup', 'true');
    dropdownButton.setAttribute('aria-expanded', 'false');
    
    const dropdownMenu = document.createElement('div');
    dropdownMenu.className = 'master-dropdown-menu';
    dropdownMenu.style.cssText = `
      display: none;
      position: absolute;
      top: 100%;
      left: 0;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      min-width: 300px;
      max-height: 80vh;
      overflow-y: auto;
      z-index: 1000;
      margin-top: 8px;
      padding: 16px;
    `;
    
    // カテゴリごとに項目を生成
    Object.entries(masterNav).forEach(([category, items]) => {
      const categoryDiv = document.createElement('div');
      categoryDiv.style.cssText = 'margin-bottom: 24px;';
      
      const categoryTitle = document.createElement('h4');
      categoryTitle.textContent = category;
      categoryTitle.style.cssText = `
        font-size: 0.875rem;
        font-weight: 600;
        color: #6b7280;
        margin: 0 0 8px 0;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      `;
      categoryDiv.appendChild(categoryTitle);
      
      const itemsList = document.createElement('div');
      itemsList.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';
      
      items.forEach(item => {
        const link = document.createElement('a');
        link.href = resolvePath(item.href);
        link.className = 'master-dropdown-item';
        link.style.cssText = `
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          color: #374151;
          text-decoration: none;
          border-radius: 4px;
          transition: background-color 0.2s;
        `;
        link.onmouseenter = function() {
          this.style.backgroundColor = '#f3f4f6';
        };
        link.onmouseleave = function() {
          this.style.backgroundColor = 'transparent';
        };
        
        if (item.icon) {
          const icon = document.createElement('i');
          icon.className = `fas ${item.icon}`;
          icon.style.cssText = 'width: 16px; text-align: center; color: #6b7280;';
          link.appendChild(icon);
        }
        
        const label = document.createElement('span');
        label.textContent = item.label;
        link.appendChild(label);
        
        itemsList.appendChild(link);
      });
      
      categoryDiv.appendChild(itemsList);
      dropdownMenu.appendChild(categoryDiv);
    });
    
    // ドロップダウンの開閉
    dropdownButton.addEventListener('click', function(e) {
      e.stopPropagation();
      const isOpen = dropdownMenu.style.display === 'block';
      dropdownMenu.style.display = isOpen ? 'none' : 'block';
      dropdownButton.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
    });
    
    // 外側をクリックしたら閉じる
    document.addEventListener('click', function(e) {
      if (!dropdownContainer.contains(e.target)) {
        dropdownMenu.style.display = 'none';
        dropdownButton.setAttribute('aria-expanded', 'false');
      }
    });
    
    dropdownContainer.appendChild(dropdownButton);
    dropdownContainer.appendChild(dropdownMenu);
    
    return dropdownContainer;
  }
  
  /**
   * ヘッダーナビゲーションの表示/非表示を制御
   */
  function updateHeaderNavigation() {
    const currentRole = getCurrentRole();
    const basePath = getBasePath();
    
    // メインナビゲーション（左側）を更新
    const navLeft = document.querySelector('.nav-left nav');
    if (navLeft) {
      // 既存のナビゲーション項目をクリア
      navLeft.innerHTML = '';
      
      // マスター権限の場合はドロップダウンリストを表示
      if (currentRole === 'master') {
        const dropdown = createMasterDropdown();
        navLeft.appendChild(dropdown);
      } else {
        // その他のロールは通常のナビゲーション項目を表示
        const navItems = getNavigationForRole(currentRole);
        
        // ナビゲーション項目を生成
        navItems.forEach(item => {
          const link = document.createElement('a');
          link.className = 'nav-link';
          link.href = resolvePath(item.href);
          
          // アイコンがある場合は追加
          if (item.icon) {
            const icon = document.createElement('i');
            icon.className = `fas ${item.icon}`;
            link.appendChild(icon);
            link.appendChild(document.createTextNode(' ' + item.label));
          } else {
            link.textContent = item.label;
          }
          
          navLeft.appendChild(link);
        });
      }
    }
    
    // 開発用ナビゲーション（管理者、開発者、マスターのみ表示）
    const navDev = document.querySelector('.nav-dev');
    if (navDev) {
      if (currentRole === 'master' || currentRole === 'admin' || currentRole === 'developer') {
        navDev.style.display = '';
      } else {
        navDev.style.display = 'none';
      }
    }
    
    // ログイン状態に応じてヘッダーを更新
    const navRight = document.querySelector('.nav-right');
    if (navRight) {
      const authData = getAuthData();
      if (authData) {
        // ログイン済みの場合、ログアウトボタンを表示
        const loginLink = navRight.querySelector('a[href*="signin.html"]');
        if (loginLink) {
          loginLink.textContent = 'ログアウト';
          loginLink.href = '#';
          loginLink.onclick = function(e) {
            e.preventDefault();
            logout();
          };
        }
        
        // 新規登録リンクを非表示
        const signupLink = navRight.querySelector('a[href*="signup.html"]');
        if (signupLink) {
          signupLink.style.display = 'none';
        }
        
        // ロール表示（オプション）
        let roleDisplay = navRight.querySelector('.nav-role');
        if (!roleDisplay) {
          roleDisplay = document.createElement('span');
          roleDisplay.className = 'nav-role';
          navRight.insertBefore(roleDisplay, navRight.firstChild);
        }
        const roleName = (typeof getRoleDisplayName === 'function') 
          ? getRoleDisplayName(currentRole) 
          : currentRole;
        roleDisplay.textContent = `(${roleName})`;
        roleDisplay.style.cssText = 'font-size: 0.75rem; color: #6b7280; margin-left: 8px;';
      } else {
        // 未ログインの場合、ログイン・新規登録リンクを表示
        const loginLink = navRight.querySelector('a[href*="signin.html"]');
        if (loginLink) {
          loginLink.textContent = 'ログイン';
          loginLink.href = resolvePath('/signin.html');
          loginLink.onclick = null;
        }
        
        const signupLink = navRight.querySelector('a[href*="signup.html"]');
        if (signupLink) {
          signupLink.style.display = '';
        }
        
        // ロール表示を削除
        const roleDisplay = navRight.querySelector('.nav-role');
        if (roleDisplay) {
          roleDisplay.remove();
        }
      }
    }
  }
  
  // グローバルに公開
  window.Auth = {
    login: login,
    logout: logout,
    checkAuth: checkAuth,
    getCurrentRole: getCurrentRole,
    checkPageAccess: checkPageAccessForPath,
    checkCurrentPageAccess: checkCurrentPageAccess,
    updateHeaderNavigation: updateHeaderNavigation,
    getAuthData: getAuthData
  };
  
  // ページ読み込み時に実行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      checkCurrentPageAccess();
      updateHeaderNavigation();
    });
  } else {
    checkCurrentPageAccess();
    updateHeaderNavigation();
  }
})();

