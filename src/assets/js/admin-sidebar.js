/**
 * 共通サイドバー機能
 */

(function() {
  'use strict';

  // ページ識別子のマッピング
  const PAGE_MAPPING = {
    'dashboard': ['dashboard'],
    'mypage': ['mypage'],
    'order': ['index'],
    'service': ['service'],
    'cart': ['cart'],
    'order-history': ['order', 'history'],
    'schedule': ['schedule'],
    'report': ['report'],
    'info': ['info'],
    'stores': ['stores'],
    'settings': ['settings'],
    'schedules': ['schedules'],
    'customers': ['customers'],
    'reports': ['reports'],
    'estimates': ['estimates'],
    'orders': ['orders'],
    'partners': ['partners'],
    'users': ['users'],
    'attendance-errors': ['attendance', 'errors'],
    'attendance-requests': ['attendance', 'requests'],
    'attendance-history': ['attendance', 'history'],
    'services': ['services'],
    'analytics': ['analytics'],
    'images': ['images'],
    'wiki': ['wiki'],
    'sitemap': ['sitemap']
  };

  /**
   * 現在のページを判定
   */
  function getCurrentPage() {
    const path = window.location.pathname;
    const pathParts = path.split('/').filter(p => p && !p.endsWith('.html'));
    
    // 各ページマッピングをチェック
    for (const [pageId, keywords] of Object.entries(PAGE_MAPPING)) {
      if (keywords.every(keyword => pathParts.includes(keyword) || path.includes(keyword))) {
        return pageId;
      }
    }
    
    // マイページの場合はmypageを返す
    if (path.includes('/mypage')) {
      return 'mypage';
    }
    
    // デフォルトはdashboard
    return 'dashboard';
  }

  /**
   * アクティブなナビゲーション項目を設定
   */
  function setActiveNavItem() {
    const currentPage = getCurrentPage();
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item[data-page]');
    
    navItems.forEach(item => {
      const pageId = item.getAttribute('data-page');
      if (pageId === currentPage) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  /**
   * サイドバーのトグル機能
   */
  function initSidebarToggle() {
    const sidebar = document.getElementById('admin-sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    
    if (!sidebar || !sidebarToggle) return;

    // ローカルストレージから状態を読み込み
    const isCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';
    if (isCollapsed) {
      sidebar.classList.add('collapsed');
    }

    // トグルボタンのイベント
    sidebarToggle.addEventListener('click', function() {
      sidebar.classList.toggle('collapsed');
      const collapsed = sidebar.classList.contains('collapsed');
      localStorage.setItem('sidebar-collapsed', collapsed.toString());
    });
  }

  /**
   * ロールバッジを更新
   */
  function updateRoleBadge() {
    const roleBadge = document.getElementById('sidebar-role-badge');
    if (!roleBadge) return;

    if (window.Auth && window.Auth.getCurrentUser) {
      const user = window.Auth.getCurrentUser();
      if (user && user.role) {
        const roleLabels = {
          'admin': '管理者',
          'customer': '顧客',
          'sales': '営業',
          'office': '事務',
          'staff': '清掃員',
          'cleaner': '清掃員',
          'developer': '開発者',
          'designer': 'デザイナー',
          'contractor': '外部委託',
          'operation': '運営',
          'general_affairs': '総務',
          'accounting': '経理',
          'human_resources': '人事',
          'master': 'マスター'
        };
        roleBadge.textContent = roleLabels[user.role] || 'ユーザー';
      }
    }
  }

  /**
   * マイページリンクを設定
   */
  async function setupMypageLink() {
    const mypageLink = document.getElementById('sidebar-mypage-link');
    if (!mypageLink) return;

    try {
      let email = null;

      // Cognito認証からメールアドレスを取得
      if (window.CognitoAuth && window.CognitoAuth.isAuthenticated()) {
        const cognitoUser = await window.CognitoAuth.getCurrentUser();
        if (cognitoUser && cognitoUser.email) {
          email = cognitoUser.email;
        }
      }

      // Firebase認証からメールアドレスを取得（フォールバック）
      if (!email && window.Auth && window.Auth.getCurrentUser) {
        const user = window.Auth.getCurrentUser();
        if (user && user.email) {
          email = user.email;
        }
      }

      // Auth.getAuthDataから取得（追加のフォールバック）
      if (!email && window.Auth && window.Auth.getAuthData) {
        const authData = window.Auth.getAuthData();
        if (authData) {
          email = authData.user?.email || authData.email;
        }
      }

      if (email) {
        mypageLink.href = `/staff/mypage.html?email=${encodeURIComponent(email)}`;
        mypageLink.style.display = 'flex';
      }
    } catch (error) {
      console.error('Error setting up mypage link:', error);
    }
  }

  /**
   * 初期化
   */
  function init() {
    // DOMContentLoaded後に実行
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        setActiveNavItem();
        initSidebarToggle();
        updateRoleBadge();
        setupMypageLink();
      });
    } else {
      setActiveNavItem();
      initSidebarToggle();
      updateRoleBadge();
      setupMypageLink();
    }
  }

  // グローバルに公開
  window.AdminSidebar = {
    init: init,
    setActiveNavItem: setActiveNavItem,
    updateRoleBadge: updateRoleBadge,
    setupMypageLink: setupMypageLink
  };

  // 自動初期化
  init();
})();

