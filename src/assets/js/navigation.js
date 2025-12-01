/**
 * ナビゲーション生成とヘッダー管理
 * ロールに応じてナビゲーション項目を生成し、ヘッダーを動的に切り替える
 */

(function() {
  'use strict';
  
  // ベースパスを取得（GitHub Pages対応）
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
  
  // パスを解決（ベースパス付き）
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
   * ナビゲーション項目を生成
   */
  function renderNavigation(containerId, role) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // ナビゲーション項目を取得
    let navItems = window.RoleConfig?.getNavigationForRole(role) || [];
    
    // マスター権限の場合は、サイトマップへのリンクを確実に追加
    if (role === 'master') {
      // サイトマップが既に含まれているかチェック
      const hasSitemap = navItems.some(item => item.href === '/admin/sitemap.html');
      if (!hasSitemap) {
        navItems = [
          { href: '/admin/sitemap.html', label: 'サイトマップ', icon: 'fa-sitemap' },
          ...navItems
        ];
      }
      // special属性を無視して通常のリンクとして表示
      navItems = navItems.map(item => {
        if (item.special === 'dropdown') {
          // dropdown属性を削除して通常のリンクとして扱う
          const { special, ...rest } = item;
          return rest;
        }
        return item;
      });
    }
    
    // 既存のナビゲーション項目をクリア
    container.innerHTML = '';
    
    // ナビゲーション項目を生成
    navItems.forEach(item => {
      const link = document.createElement('a');
      link.href = resolvePath(item.href);
      link.className = 'nav-link';
      link.textContent = item.label;
      link.setAttribute('aria-label', item.label);
      
      // アイコンがある場合は追加
      if (item.icon) {
        const icon = document.createElement('i');
        icon.className = `fas ${item.icon}`;
        icon.setAttribute('aria-hidden', 'true');
        link.insertBefore(icon, link.firstChild);
        link.insertBefore(document.createTextNode(' '), icon.nextSibling);
      }
      
      // 現在のページかチェック
      const currentPath = window.location.pathname;
      const basePath = getBasePath();
      let normalizedPath = currentPath;
      if (basePath !== '/' && currentPath.startsWith(basePath)) {
        normalizedPath = currentPath.substring(basePath.length - 1);
      }
      
      if (normalizedPath === item.href || normalizedPath === item.href.replace('.html', '')) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      }
      
      container.appendChild(link);
    });
    
    // スマホ版ナビゲーションにも同じ項目を生成
    const mobileNavPrimary = document.getElementById('mobile-nav-primary');
    if (mobileNavPrimary) {
      mobileNavPrimary.innerHTML = '';
      // マスター権限の場合も同じnavItemsを使用
      const mobileNavItems = role === 'master' ? navItems : (window.RoleConfig?.getNavigationForRole(role) || []);
      mobileNavItems.forEach(item => {
        const link = document.createElement('a');
        link.href = resolvePath(item.href);
        link.className = 'mobile-nav-link';
        link.textContent = item.label;
        link.setAttribute('aria-label', item.label);
        
        // アイコンがある場合は追加
        if (item.icon) {
          const icon = document.createElement('i');
          icon.className = `fas ${item.icon}`;
          icon.setAttribute('aria-hidden', 'true');
          link.insertBefore(icon, link.firstChild);
          link.insertBefore(document.createTextNode(' '), icon.nextSibling);
        }
        
        // 現在のページかチェック
        const currentPath = window.location.pathname;
        const basePath = getBasePath();
        let normalizedPath = currentPath;
        if (basePath !== '/' && currentPath.startsWith(basePath)) {
          normalizedPath = currentPath.substring(basePath.length - 1);
        }
        
        if (normalizedPath === item.href || normalizedPath === item.href.replace('.html', '')) {
          link.classList.add('active');
          link.setAttribute('aria-current', 'page');
        }
        
        // クリックでメニューを閉じる
        link.addEventListener('click', () => {
          closeMobileNav();
        });
        
        mobileNavPrimary.appendChild(link);
      });
    }
  }
  
  /**
   * ハンバーガーメニューの開閉
   */
  function toggleMobileNav() {
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const mobileNav = document.getElementById('mobile-nav');
    
    if (!hamburgerBtn || !mobileNav) return;
    
    const isActive = mobileNav.classList.contains('active');
    
    if (isActive) {
      closeMobileNav();
    } else {
      openMobileNav();
    }
  }
  
  function openMobileNav() {
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const mobileNav = document.getElementById('mobile-nav');
    
    if (!hamburgerBtn || !mobileNav) return;
    
    hamburgerBtn.classList.add('active');
    hamburgerBtn.setAttribute('aria-expanded', 'true');
    mobileNav.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  
  function closeMobileNav() {
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const mobileNav = document.getElementById('mobile-nav');
    
    if (!hamburgerBtn || !mobileNav) return;
    
    hamburgerBtn.classList.remove('active');
    hamburgerBtn.setAttribute('aria-expanded', 'false');
    mobileNav.classList.remove('active');
    document.body.style.overflow = '';
  }
  
  // ハンバーガーボタンのクリックイベント
  document.addEventListener('DOMContentLoaded', () => {
    const hamburgerBtn = document.getElementById('hamburger-btn');
    if (hamburgerBtn) {
      hamburgerBtn.addEventListener('click', toggleMobileNav);
    }
    
    // メニュー外をクリックで閉じる
    const mobileNav = document.getElementById('mobile-nav');
    if (mobileNav) {
      mobileNav.addEventListener('click', (e) => {
        if (e.target === mobileNav) {
          closeMobileNav();
        }
      });
    }
    
    // ESCキーで閉じる
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeMobileNav();
      }
    });
  });
  
  /**
   * ヘッダーをロールに応じて切り替え
   */
  function switchHeaderByRole(role) {
    // 現在のヘッダーを取得
    const currentHeader = document.querySelector('header.site-header');
    if (!currentHeader) return;
    
    // ロールに応じたヘッダーIDとナビゲーションIDを決定
    const headerId = `header-${role}`;
    const navId = `nav-${role}`;
    
    // ヘッダーのIDとdata-roleを更新
    currentHeader.id = headerId;
    currentHeader.setAttribute('data-role', role);
    
    // ナビゲーションコンテナのIDを更新
    const navContainer = currentHeader.querySelector('nav[aria-label="Primary"]');
    if (navContainer) {
      navContainer.id = navId;
    }
    
    // ロール名バッジを更新
    const roleBadge = currentHeader.querySelector('.role-badge');
    if (roleBadge) {
      const roleConfig = window.RoleConfig?.ROLE_CONFIG;
      const roleInfo = roleConfig?.roles?.[role];
      if (roleInfo) {
        roleBadge.textContent = roleInfo.displayName || roleInfo.name || role;
        
        // ロールに応じたバッジの色を設定
        const badgeColors = {
          'guest': { bg: '#e5e7eb', color: '#6b7280' },
          'customer': { bg: '#dbeafe', color: '#1e40af' },
          'staff': { bg: '#dcfce7', color: '#166534' },
          'concierge': { bg: '#fef3c7', color: '#92400e' },
          'admin': { bg: '#e0e7ff', color: '#3730a3' },
          'developer': { bg: '#fce7f3', color: '#831843' },
          'master': { bg: '#fef2f2', color: '#991b1b' }
        };
        
        const colors = badgeColors[role] || badgeColors['guest'];
        roleBadge.style.background = colors.bg;
        roleBadge.style.color = colors.color;
      }
    }
    
    // ログアウトボタンの表示/非表示を制御
    let logoutBtn = currentHeader.querySelector('button[aria-label="ログアウト"]');
    
    // ログアウトボタンが存在しない場合は作成
    if (!logoutBtn) {
      const navRight = currentHeader.querySelector('.nav-right');
      if (navRight) {
        logoutBtn = document.createElement('button');
        logoutBtn.className = 'icon-btn';
        logoutBtn.setAttribute('aria-label', 'ログアウト');
        logoutBtn.onclick = function() {
          if (window.Auth && window.Auth.logout) {
            window.Auth.logout();
          }
        };
        const icon = document.createElement('i');
        icon.className = 'fas fa-sign-out-alt';
        logoutBtn.appendChild(icon);
        navRight.appendChild(logoutBtn);
      }
    }
    
    const loginLink = currentHeader.querySelector('a[href="/signin.html"]');
    const signupLink = currentHeader.querySelector('a[href="/signup.html"]');
    
    if (role === 'guest') {
      // ゲストの場合はログイン・新規登録リンクを表示
      if (logoutBtn) logoutBtn.style.display = 'none';
      if (loginLink) loginLink.style.display = '';
      if (signupLink) signupLink.style.display = '';
    } else {
      // ログイン済みの場合はログアウトボタンを表示
      if (logoutBtn) logoutBtn.style.display = '';
      if (loginLink) loginLink.style.display = 'none';
      if (signupLink) signupLink.style.display = 'none';
    }
    
    // ナビゲーション項目を生成
    renderNavigation(navId, role);
  }
  
  /**
   * 初期化
   */
  function init() {
    // ロールを取得
    const currentRole = window.Auth?.getCurrentRole() || 'guest';
    
    // ヘッダーを切り替え
    switchHeaderByRole(currentRole);
  }
  
  // ページ読み込み時に実行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // グローバルに公開
  window.Navigation = {
    renderNavigation: renderNavigation,
    switchHeaderByRole: switchHeaderByRole,
    init: init,
    toggleMobileNav: toggleMobileNav,
    openMobileNav: openMobileNav,
    closeMobileNav: closeMobileNav
  };
})();

