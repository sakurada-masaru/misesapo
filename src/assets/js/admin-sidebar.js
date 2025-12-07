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
   * ロールに基づいてサイドバー要素の表示/非表示を制御
   */
  function toggleSidebarElementsByRole() {
    const adminDashboardLink = document.querySelector('.nav-item-admin');
    if (!adminDashboardLink) return;

    if (window.Auth && window.Auth.getCurrentUser) {
      const user = window.Auth.getCurrentUser();
      if (user && user.role) {
        const role = user.role;
        // 管理者、運営、総務のみ管理ダッシュボードを表示
        if (['admin', 'operation', 'general_affairs'].includes(role)) {
          adminDashboardLink.style.display = 'flex';
        } else {
          adminDashboardLink.style.display = 'none';
        }
      } else {
        adminDashboardLink.style.display = 'none';
      }
    } else {
      adminDashboardLink.style.display = 'none';
    }
  }

  /**
   * マイページリンクを設定（AWS Cognito認証のみ使用）
   */
  async function setupMypageLink() {
    const mypageLink = document.getElementById('sidebar-mypage-link');
    if (!mypageLink) return;

    try {
      let userId = null;
      let email = null;

      // Cognito認証から最新の情報を取得（最優先）
      if (window.CognitoAuth && window.CognitoAuth.isAuthenticated()) {
        try {
          const cognitoUser = await window.CognitoAuth.getCurrentUser();
          if (cognitoUser) {
            if (cognitoUser.id) {
              userId = cognitoUser.id;
              console.log('[AdminSidebar] Using ID from Cognito:', userId);
            } else if (cognitoUser.email) {
              email = cognitoUser.email;
              console.log('[AdminSidebar] Using email from Cognito:', email);
            }
          }
        } catch (e) {
          console.warn('[AdminSidebar] Error getting user from Cognito:', e);
        }
      }

      // Cognito認証から取得できなかった場合、ローカルストレージのcognito_userから取得（フォールバック）
      if (!userId && !email) {
        try {
          const storedCognitoUser = localStorage.getItem('cognito_user');
          if (storedCognitoUser) {
            const parsedUser = JSON.parse(storedCognitoUser);
            if (parsedUser.id) {
              userId = parsedUser.id;
              console.log('[AdminSidebar] Using ID from stored cognito_user (fallback):', userId);
            } else if (parsedUser.email) {
              email = parsedUser.email;
              console.log('[AdminSidebar] Using email from stored cognito_user (fallback):', email);
            }
          }
        } catch (e) {
          console.warn('[AdminSidebar] Error parsing stored cognito_user:', e);
        }
      }

      // メールアドレスからIDを取得（IDが取得できなかった場合）
      if (!userId && email) {
        try {
          // ローカルのworkers.jsonから検索
          const localResponse = await fetch('/data/workers.json');
          if (localResponse.ok) {
            const localWorkers = await localResponse.json();
            if (Array.isArray(localWorkers) && localWorkers.length > 0) {
              const matchingUser = localWorkers.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
              if (matchingUser && matchingUser.id) {
                userId = matchingUser.id;
                console.log('[AdminSidebar] Found ID from local workers.json:', userId);
              }
            }
          }
        } catch (e) {
          console.log('[AdminSidebar] Could not fetch local workers.json, will use email');
        }
      }

      // リンクを設定（IDを優先、なければメールアドレス）
      if (userId) {
        mypageLink.href = `/staff/mypage.html?id=${encodeURIComponent(userId)}`;
        mypageLink.style.display = 'flex';
        console.log('[AdminSidebar] Mypage link set with ID:', userId);
      } else if (email) {
        mypageLink.href = `/staff/mypage.html?email=${encodeURIComponent(email)}`;
        mypageLink.style.display = 'flex';
        console.log('[AdminSidebar] Mypage link set with email:', email);
      }
    } catch (error) {
      console.error('Error setting up mypage link:', error);
    }
  }

  /**
   * 現在のユーザーのロールを取得
   * @returns {string|null} ロール名、取得できない場合はnull
   */
  function getCurrentUserRole() {
    if (window.Auth && window.Auth.getCurrentUser) {
      const user = window.Auth.getCurrentUser();
      if (user && user.role) {
        return user.role;
      }
    }
    return null;
  }

  /**
   * 管理者アクセス権限があるかチェック
   * @returns {boolean} 管理者以上のロールの場合はtrue
   */
  function hasAdminAccess() {
    const role = getCurrentUserRole();
    return role && ['admin', 'operation', 'general_affairs'].includes(role);
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

