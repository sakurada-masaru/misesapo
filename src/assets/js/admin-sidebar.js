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
    'assignments': ['assignments'],
    'reports-new': ['reports', 'new'],
    'training': ['training'],
    'cleaning-manual': ['cleaning-manual'],
    'announcements': ['announcements'],
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
    
    // スタッフマイページの場合はmypageを返す
    if (path.includes('/staff/mypage')) {
      return 'mypage';
    }
    
    // ユーザー向けマイページの場合はmypageを返す
    if (path.includes('/mypage') && !path.includes('/staff/')) {
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
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    
    if (!sidebar) return;

    // ローカルストレージから状態を読み込み（PCのみ）
    if (window.innerWidth > 768) {
      const isCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';
      if (isCollapsed) {
        sidebar.classList.add('collapsed');
      }
    }

    // PC用トグルボタンのイベント
    if (sidebarToggle) {
      sidebarToggle.addEventListener('click', function() {
        sidebar.classList.toggle('collapsed');
        const collapsed = sidebar.classList.contains('collapsed');
        localStorage.setItem('sidebar-collapsed', collapsed.toString());
      });
    }

    // モバイルメニューボタンのイベント
    if (mobileMenuButton) {
      mobileMenuButton.addEventListener('click', function() {
        sidebar.classList.toggle('open');
        if (sidebarOverlay) {
          sidebarOverlay.classList.toggle('active');
        }
        // ボタンのアイコンを変更
        const icon = mobileMenuButton.querySelector('i');
        if (icon) {
          if (sidebar.classList.contains('open')) {
            icon.className = 'fas fa-times';
          } else {
            icon.className = 'fas fa-bars';
          }
        }
      });
    }

    // オーバーレイクリックでサイドバーを閉じる
    if (sidebarOverlay) {
      sidebarOverlay.addEventListener('click', function() {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('active');
        const icon = mobileMenuButton?.querySelector('i');
        if (icon) {
          icon.className = 'fas fa-bars';
        }
      });
    }

    // サイドバー内のリンククリックでモバイルサイドバーを閉じる
    if (window.innerWidth <= 768) {
      const navItems = sidebar.querySelectorAll('.nav-item');
      navItems.forEach(item => {
        item.addEventListener('click', function() {
          sidebar.classList.remove('open');
          if (sidebarOverlay) {
            sidebarOverlay.classList.remove('active');
          }
          const icon = mobileMenuButton?.querySelector('i');
          if (icon) {
            icon.className = 'fas fa-bars';
          }
        });
      });
    }

    // ウィンドウリサイズ時の処理
    let resizeTimer;
    window.addEventListener('resize', function() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function() {
        if (window.innerWidth > 768) {
          // PC表示に切り替え
          sidebar.classList.remove('open');
          if (sidebarOverlay) {
            sidebarOverlay.classList.remove('active');
          }
          const icon = mobileMenuButton?.querySelector('i');
          if (icon) {
            icon.className = 'fas fa-bars';
          }
        } else {
          // モバイル表示に切り替え
          sidebar.classList.remove('collapsed');
        }
      }, 250);
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
        mypageLink.href = `/staff/mypage?email=${encodeURIComponent(email)}`;
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
        toggleSidebarElementsByRole();
        setupMypageLink();
      });
    } else {
      setActiveNavItem();
      initSidebarToggle();
      updateRoleBadge();
      toggleSidebarElementsByRole();
      setupMypageLink();
    }
  }

  // グローバルに公開
  window.AdminSidebar = {
    init: init,
    setActiveNavItem: setActiveNavItem,
    updateRoleBadge: updateRoleBadge,
    toggleSidebarElementsByRole: toggleSidebarElementsByRole,
    getCurrentUserRole: getCurrentUserRole,
    hasAdminAccess: hasAdminAccess,
    setupMypageLink: setupMypageLink
  };

  // 自動初期化
  init();
})();

