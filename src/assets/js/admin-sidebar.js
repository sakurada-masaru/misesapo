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
    'sitemap': ['sitemap'],
    'work-list': ['work-list', 'work', 'list']
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

    // リップルオーバーレイを作成（清掃員ページのメニューボタンと同じ効果）
    let rippleOverlay = document.querySelector('.menu-ripple-overlay');
    if (!rippleOverlay) {
      rippleOverlay = document.createElement('div');
      rippleOverlay.className = 'menu-ripple-overlay';
      document.body.appendChild(rippleOverlay);
    }

    // リップルオーバーレイをリセットする関数
    function resetRippleOverlay() {
      if (rippleOverlay) {
        rippleOverlay.classList.remove('animating', 'collapsing');
        rippleOverlay.style.display = 'none';
        rippleOverlay.style.opacity = '0';
        rippleOverlay.style.transform = 'scale(0)';
        rippleOverlay.style.top = '';
        rippleOverlay.style.left = '';
        rippleOverlay.style.width = '';
        rippleOverlay.style.height = '';
      }
    }

    // モバイルメニューボタンのイベント
    if (mobileMenuButton) {
      mobileMenuButton.addEventListener('click', function() {
        const isOpening = !sidebar.classList.contains('open');
        
        if (isOpening) {
          // メニューを開く：リップルアニメーション開始
          rippleOverlay.classList.remove('collapsing');
          
          // ボタンの位置を取得
          const buttonRect = mobileMenuButton.getBoundingClientRect();
          const buttonCenterX = buttonRect.left + buttonRect.width / 2;
          const buttonCenterY = buttonRect.top + buttonRect.height / 2;
          
          // リップルオーバーレイの初期サイズ
          const initialSize = 100;
          
          // リップルオーバーレイの位置をボタンの中心に設定
          rippleOverlay.style.width = initialSize + 'px';
          rippleOverlay.style.height = initialSize + 'px';
          rippleOverlay.style.left = (buttonCenterX - initialSize / 2) + 'px';
          rippleOverlay.style.top = (buttonCenterY - initialSize / 2) + 'px';
          rippleOverlay.style.transform = 'scale(0)';
          rippleOverlay.style.transformOrigin = 'center center';
          rippleOverlay.style.display = 'block';
          rippleOverlay.style.opacity = '0';
          
          // リップルアニメーション開始
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              rippleOverlay.classList.add('animating');
            });
          });
          
          // アニメーション完了後にサイドバーを表示
          setTimeout(() => {
            sidebar.classList.add('open');
        if (sidebarOverlay) {
              sidebarOverlay.classList.add('active');
        }
        // ボタンのアイコンを変更
        const icon = mobileMenuButton.querySelector('i');
        if (icon) {
            icon.className = 'fas fa-times';
            }
          }, 400); // リップルアニメーションの時間（0.4s）
          } else {
          // メニューを閉じる：リップルアニメーションで閉じる
          sidebar.classList.remove('open');
          if (sidebarOverlay) {
            sidebarOverlay.classList.remove('active');
          }
          
          // リップルオーバーレイを上にスライドアウト
          if (rippleOverlay.classList.contains('animating')) {
            rippleOverlay.classList.remove('animating');
            rippleOverlay.classList.add('collapsing');
          }
          
          // ボタンのアイコンを変更
          const icon = mobileMenuButton.querySelector('i');
          if (icon) {
            icon.className = 'fas fa-bars';
          }
          
          // アニメーション完了後にリセット
          setTimeout(() => {
            resetRippleOverlay();
          }, 300); // アニメーション時間（0.3s）
        }
      });
    }

    // オーバーレイクリックでサイドバーを閉じる
    if (sidebarOverlay) {
      sidebarOverlay.addEventListener('click', function() {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('active');
        
        // リップルオーバーレイを上にスライドアウト
        if (rippleOverlay && rippleOverlay.classList.contains('animating')) {
          rippleOverlay.classList.remove('animating');
          rippleOverlay.classList.add('collapsing');
        }
        
        const icon = mobileMenuButton?.querySelector('i');
        if (icon) {
          icon.className = 'fas fa-bars';
        }
        
        // アニメーション完了後にリセット
        setTimeout(() => {
          resetRippleOverlay();
        }, 300);
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
  async function updateRoleBadge() {
    const roleBadge = document.getElementById('sidebar-role-badge');
    if (!roleBadge) return;

    try {
      let userRole = null;
      let userDepartment = null;

      // Cognito認証からユーザー情報を取得（最優先）
      if (window.CognitoAuth && window.CognitoAuth.isAuthenticated()) {
        try {
          const cognitoUser = await window.CognitoAuth.getCurrentUser();
          if (cognitoUser) {
            userRole = cognitoUser.role;
            userDepartment = cognitoUser.department;
          }
        } catch (e) {
          console.warn('[AdminSidebar] Error getting user from Cognito:', e);
        }
      }

      // Cognito認証から取得できない場合、ローカルストレージから取得
      if (!userRole) {
        try {
          const storedCognitoUser = localStorage.getItem('cognito_user');
          if (storedCognitoUser) {
            const parsedUser = JSON.parse(storedCognitoUser);
            userRole = parsedUser.role;
            userDepartment = parsedUser.department;
          }
        } catch (e) {
          console.warn('[AdminSidebar] Error parsing stored cognito_user:', e);
        }
      }

      // ロールバッジを更新（部署があれば部署を表示、なければロールを表示）
      if (userDepartment) {
        roleBadge.textContent = userDepartment;
        // OS課の場合は専用サイドバーを設定
        if (userDepartment === 'OS課') {
          setupOSSectionSidebar();
        }
      } else if (userRole) {
        const roleLabels = {
          'admin': '管理者',
          '管理者': '管理者',
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
        roleBadge.textContent = roleLabels[userRole] || 'ユーザー';
      }
    } catch (error) {
      console.error('[AdminSidebar] Error in updateRoleBadge:', error);
    }
  }

  /**
   * ロールに基づいてサイドバー要素の表示/非表示を制御
   */
  async function toggleSidebarElementsByRole() {
    const adminDashboardLink = document.querySelector('.nav-item-admin');
    const navDivider = document.querySelector('.nav-divider[data-role-required]');
    if (!adminDashboardLink) return;

    try {
      let userRole = null;

      // Cognito認証からユーザー情報を取得（最優先）
      if (window.CognitoAuth && window.CognitoAuth.isAuthenticated()) {
        try {
          const cognitoUser = await window.CognitoAuth.getCurrentUser();
          if (cognitoUser && cognitoUser.role) {
            userRole = cognitoUser.role;
            console.log('[AdminSidebar] User role from Cognito:', userRole);
          }
        } catch (e) {
          console.warn('[AdminSidebar] Error getting user from Cognito:', e);
        }
      }

      // Cognito認証から取得できない場合、ローカルストレージから取得
      if (!userRole) {
        try {
          const storedCognitoUser = localStorage.getItem('cognito_user');
          if (storedCognitoUser) {
            const parsedUser = JSON.parse(storedCognitoUser);
            if (parsedUser.role) {
              userRole = parsedUser.role;
              console.log('[AdminSidebar] User role from localStorage:', userRole);
            }
          }
        } catch (e) {
          console.warn('[AdminSidebar] Error parsing stored cognito_user:', e);
        }
      }


      // 管理者ロールのみ管理ダッシュボードを表示
      if (userRole === 'admin' || userRole === '管理者') {
          adminDashboardLink.style.display = 'flex';
        if (navDivider) {
          navDivider.style.display = 'block';
        }
        console.log('[AdminSidebar] Admin dashboard link displayed');
      } else {
        adminDashboardLink.style.display = 'none';
        if (navDivider) {
          navDivider.style.display = 'none';
        }
        console.log('[AdminSidebar] Admin dashboard link hidden. User role:', userRole);
      }
    } catch (error) {
      console.error('[AdminSidebar] Error in toggleSidebarElementsByRole:', error);
      adminDashboardLink.style.display = 'none';
      if (navDivider) {
        navDivider.style.display = 'none';
      }
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
          // キャッシュを無効化するためにタイムスタンプを追加
          const timestamp = new Date().getTime();
          
          // まずAWS APIから最新データを取得
          const apiResponse = await fetch(`${API_BASE}/workers?email=${encodeURIComponent(email)}&t=${timestamp}&_=${Date.now()}`, {
            cache: 'no-store'
          });
          if (apiResponse.ok) {
            const workers = await apiResponse.json();
            const workersArray = Array.isArray(workers) ? workers : (workers.items || workers.workers || []);
            if (workersArray.length > 0) {
              const matchingUser = workersArray.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
              if (matchingUser && matchingUser.id) {
                userId = matchingUser.id;
                console.log('[AdminSidebar] Found ID from API:', userId);
              }
            }
          }
          
          // APIで取得できない場合のみ、ローカルのworkers.jsonをフォールバックとして使用
          if (!userId) {
            console.warn('[AdminSidebar] API取得に失敗、ローカルのworkers.jsonを試行');
            try {
              const localResponse = await fetch(`/data/workers.json?t=${timestamp}&_=${Date.now()}`, {
                cache: 'no-store'
              });
          if (localResponse.ok) {
            const localWorkers = await localResponse.json();
            if (Array.isArray(localWorkers) && localWorkers.length > 0) {
              const matchingUser = localWorkers.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
              if (matchingUser && matchingUser.id) {
                userId = matchingUser.id;
                    console.log('[AdminSidebar] Found ID from local workers.json (fallback):', userId);
                  }
                }
              }
            } catch (e) {
              console.log('[AdminSidebar] Local workers.json also not available');
            }
          }
        } catch (e) {
          console.log('[AdminSidebar] Error fetching user ID:', e);
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
   * OS課専用サイドバーを設定
   */
  function setupOSSectionSidebar() {
    const sidebarNav = document.querySelector('#admin-sidebar .sidebar-nav');
    if (!sidebarNav) return;

    // 日報と出勤履歴を非表示にする
    const dailyReportsLink = sidebarNav.querySelector('a[data-page="daily-reports"]');
    const attendanceHistoryLink = sidebarNav.querySelector('a[data-page="attendance-history"]');
    if (dailyReportsLink) {
      dailyReportsLink.style.display = 'none';
    }
    if (attendanceHistoryLink) {
      attendanceHistoryLink.style.display = 'none';
    }

    // 作業一覧リンクが存在しない場合は追加
    let workListLink = sidebarNav.querySelector('a[data-page="work-list"]');
    if (!workListLink) {
      // スケジュールリンクの後に作業一覧を追加
      const scheduleLink = sidebarNav.querySelector('a[data-page="schedule"]');
      if (scheduleLink) {
        workListLink = document.createElement('a');
        workListLink.href = '/staff/work-list';
        workListLink.className = 'nav-item';
        workListLink.setAttribute('data-page', 'work-list');
        workListLink.innerHTML = '<i class="fas fa-tasks"></i><span class="nav-label">作業一覧</span>';
        scheduleLink.insertAdjacentElement('afterend', workListLink);
      }
    }

    // レポート作成リンクが存在しない場合は追加
    let reportNewLink = sidebarNav.querySelector('a[data-page="reports-new"]');
    if (!reportNewLink) {
      // 作業一覧の後にレポート作成を追加
      if (workListLink) {
        reportNewLink = document.createElement('a');
        reportNewLink.href = '/staff/reports/new';
        reportNewLink.className = 'nav-item';
        reportNewLink.setAttribute('data-page', 'reports-new');
        reportNewLink.innerHTML = '<i class="fas fa-file-alt"></i><span class="nav-label">レポート作成</span>';
        workListLink.insertAdjacentElement('afterend', reportNewLink);
      } else {
        // 作業一覧が追加されていない場合は、スケジュールの後に追加
        const scheduleLink = sidebarNav.querySelector('a[data-page="schedule"]');
        if (scheduleLink) {
          reportNewLink = document.createElement('a');
          reportNewLink.href = '/staff/reports/new';
          reportNewLink.className = 'nav-item';
          reportNewLink.setAttribute('data-page', 'reports-new');
          reportNewLink.innerHTML = '<i class="fas fa-file-alt"></i><span class="nav-label">レポート作成</span>';
          scheduleLink.insertAdjacentElement('afterend', reportNewLink);
        }
      }
    }

    console.log('[AdminSidebar] OS section sidebar configured');
  }

  /**
   * 現在のユーザーのロールを取得
   * @returns {Promise<string|null>} ロール名、取得できない場合はnull
   */
  async function getCurrentUserRole() {
    try {
      // Cognito認証からユーザー情報を取得（最優先）
      if (window.CognitoAuth && window.CognitoAuth.isAuthenticated()) {
        try {
          const cognitoUser = await window.CognitoAuth.getCurrentUser();
          if (cognitoUser && cognitoUser.role) {
            return cognitoUser.role;
          }
        } catch (e) {
          console.warn('[AdminSidebar] Error getting user from Cognito:', e);
        }
      }

      // Cognito認証から取得できない場合、ローカルストレージから取得
      try {
        const storedCognitoUser = localStorage.getItem('cognito_user');
        if (storedCognitoUser) {
          const parsedUser = JSON.parse(storedCognitoUser);
          if (parsedUser.role) {
            return parsedUser.role;
      }
        }
      } catch (e) {
        console.warn('[AdminSidebar] Error parsing stored cognito_user:', e);
      }

    } catch (error) {
      console.error('[AdminSidebar] Error in getCurrentUserRole:', error);
    }
    return null;
  }

  /**
   * 管理者アクセス権限があるかチェック
   * @returns {Promise<boolean>} 管理者以上のロールの場合はtrue
   */
  async function hasAdminAccess() {
    const role = await getCurrentUserRole();
    return role && (role === 'admin' || role === '管理者');
  }

  /**
   * 初期化
   */
  async function init() {
    // DOMContentLoaded後に実行
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', async function() {
        setActiveNavItem();
        initSidebarToggle();
        await updateRoleBadge();
        await toggleSidebarElementsByRole();
        setupMypageLink();
      });
    } else {
      setActiveNavItem();
      initSidebarToggle();
      updateRoleBadge();
      await toggleSidebarElementsByRole();
      setupMypageLink();
    }
  }

  /**
   * 従業員用ログアウト関数
   * すべてのマイページから使用される
   */
  function staffLogout() {
    // Cognitoからログアウト
    if (window.CognitoAuth && typeof window.CognitoAuth.logout === 'function') {
      window.CognitoAuth.logout();
    }
    // ローカルストレージをクリア
    localStorage.removeItem('cognito_user');
    localStorage.removeItem('misesapo_auth');
    localStorage.removeItem('cognito_id_token');
    localStorage.removeItem('cognito_access_token');
    localStorage.removeItem('cognito_refresh_token');
    // 従業員ログイン画面にリダイレクト
    window.location.href = '/staff/signin.html';
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

  // staffLogoutをグローバルに公開（すべてのマイページで使用可能にする）
  window.staffLogout = staffLogout;

  // 自動初期化
  init();
})();

