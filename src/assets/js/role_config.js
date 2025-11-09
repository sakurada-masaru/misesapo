/**
 * ロール設定とページアクセス制御
 */

const ROLE_CONFIG = {
  // ロール定義
  roles: {
    guest: { 
      name: 'ゲスト', 
      password: null,
      displayName: 'ゲスト'
    },
    customer: { 
      name: 'ユーザー（顧客）', 
      password: 'customer1234',
      displayName: 'ユーザー'
    },
    staff: { 
      name: '清掃員', 
      password: 'staff1234',
      displayName: '清掃員'
    },
    concierge: { 
      name: 'コンシェルジュ', 
      password: null,
      displayName: 'コンシェルジュ'
    },
    admin: { 
      name: '管理者', 
      password: 'admin1234',
      displayName: '管理者'
    },
    developer: { 
      name: '開発者', 
      password: 'misesapo1234',
      displayName: '開発者'
    },
    master: { 
      name: 'マスター', 
      password: 'master1234',
      displayName: 'マスター'
    }
  },
  
  // ロール階層（上位ロールは下位ロールの権限も持つ）
  // 階層: マスター > 開発者 > 管理者 > コンシェルジュ > 清掃員・ユーザー（同レベル）
  roleHierarchy: {
    guest: ['guest'],
    customer: ['guest', 'customer'],  // ユーザー（顧客）
    staff: ['guest', 'staff'],        // 清掃員
    concierge: ['guest', 'customer', 'staff', 'concierge'],  // コンシェルジュ: 清掃員とユーザーの権限も持つ
    admin: ['guest', 'customer', 'staff', 'concierge', 'admin'],  // 管理者: すべての権限
    developer: ['guest', 'customer', 'staff', 'concierge', 'admin', 'developer'],  // 開発者: すべての権限
    master: ['guest', 'customer', 'staff', 'concierge', 'admin', 'developer', 'master']  // マスター: すべての権限（最上位）
  },
  
  // ロールごとのログイン後リダイレクト先
  defaultPages: {
    'customer': '/mypage.html',
    'staff': '/staff/dashboard.html',
    'concierge': '/sales/dashboard.html',
    'admin': '/admin/dashboard.html',
    'developer': '/admin/dashboard.html',
    'master': '/admin/sitemap.html',
    'guest': '/index.html'
  },
  
  // ページ別アクセス制御（パスパターン）
  pageAccess: {
    // パブリックページ（全員アクセス可能）
    '/index.html': ['guest', 'customer', 'staff', 'concierge', 'admin', 'developer', 'master'],
    '/service.html': ['guest', 'customer', 'staff', 'concierge', 'admin', 'developer', 'master'],
    '/service/': ['guest', 'customer', 'staff', 'concierge', 'admin', 'developer', 'master'],
    '/signin.html': ['guest', 'customer', 'staff', 'concierge', 'admin', 'developer'],
    '/signup.html': ['guest', 'customer', 'staff', 'concierge', 'admin', 'developer'],
    '/signup2.html': ['guest', 'customer', 'staff', 'concierge', 'admin', 'developer'],
    '/signup3.html': ['guest', 'customer', 'staff', 'concierge', 'admin', 'developer'],
    '/reset-password.html': ['guest', 'customer', 'staff', 'concierge', 'admin', 'developer'],
    '/contact.html': ['guest', 'customer', 'staff', 'concierge', 'admin', 'developer'],
    '/concierge.html': ['guest', 'customer', 'staff', 'concierge', 'admin', 'developer'],
    
    // 顧客向けページ（ユーザーと清掃員がアクセス可能、コンシェルジュと管理者も可）
    '/mypage.html': ['customer', 'staff', 'concierge', 'admin', 'developer'],
    '/mypage/': ['customer', 'staff', 'concierge', 'admin', 'developer'],
    '/cart.html': ['customer', 'staff', 'concierge', 'admin', 'developer'],
    '/checkout.html': ['customer', 'staff', 'concierge', 'admin', 'developer'],
    '/order/': ['customer', 'staff', 'concierge', 'admin', 'developer'],
    '/order-complete.html': ['customer', 'staff', 'concierge', 'admin', 'developer'],
    '/order-confirm.html': ['customer', 'staff', 'concierge', 'admin', 'developer'],
    
    // 清掃員向けページ（清掃員とユーザーがアクセス可能、コンシェルジュと管理者も可）
    '/staff/': ['staff', 'customer', 'concierge', 'admin', 'developer'],
    '/schedule.html': ['staff', 'customer', 'concierge', 'admin', 'developer'],
    '/report.html': ['staff', 'customer', 'concierge', 'admin', 'developer'],
    '/reports/': ['staff', 'customer', 'concierge', 'admin', 'developer'],
    
    // コンシェルジュ向けページ（コンシェルジュと管理者のみ）
    '/sales/': ['concierge', 'admin', 'developer'],
    
    // 管理者向けページ（管理者と開発者のみ）
    '/admin/': ['admin', 'developer'],
    '/admin/partners.html': ['admin', 'developer'],
    '/admin/partners/': ['admin', 'developer'],
    '/admin/partners/new.html': ['admin', 'developer'],
    
    // 開発者向けページ（開発者のみ）
    '/admin/services/review.html': ['developer']
  },
  
  // ロールごとのナビゲーション項目（推奨ナビゲーション）
  navigation: {
    guest: [
      { href: '/index.html', label: '発注', icon: 'fa-shopping-cart' },
      { href: '/service.html', label: 'サービス一覧', icon: 'fa-list' },
      { href: '/contact.html', label: 'お問い合わせ', icon: 'fa-envelope' }
    ],
    customer: [
      { href: '/mypage.html', label: 'マイページ', icon: 'fa-user' },
      { href: '/index.html', label: '発注', icon: 'fa-shopping-cart' },
      { href: '/service.html', label: 'サービス一覧', icon: 'fa-list' },
      { href: '/cart.html', label: 'カート', icon: 'fa-shopping-bag' },
      { href: '/order/history.html', label: '注文履歴', icon: 'fa-history' },
      { href: '/schedule.html', label: 'スケジュール', icon: 'fa-calendar' },
      { href: '/report.html', label: 'レポート一覧', icon: 'fa-file-alt' }
    ],
    staff: [
      { href: '/staff/dashboard.html', label: 'ダッシュボード', icon: 'fa-tachometer-alt' },
      { href: '/staff/schedule.html', label: 'スケジュール', icon: 'fa-calendar' },
      { href: '/staff/assignments.html', label: '作業一覧', icon: 'fa-tasks' },
      { href: '/staff/reports/new.html', label: 'レポート作成', icon: 'fa-file-alt' },
      { href: '/staff/training.html', label: 'トレーニング', icon: 'fa-graduation-cap' }
    ],
    concierge: [
      { href: '/sales/dashboard.html', label: 'ダッシュボード', icon: 'fa-tachometer-alt' },
      { href: '/sales/clients.html', label: '顧客管理', icon: 'fa-users' },
      { href: '/sales/clients/new.html', label: '新規顧客登録', icon: 'fa-user-plus' },
      { href: '/sales/estimates.html', label: '見積もり一覧', icon: 'fa-file-invoice' },
      { href: '/sales/estimates/new.html', label: '見積もり作成', icon: 'fa-file-invoice-dollar' },
      { href: '/sales/schedule.html', label: 'スケジュール', icon: 'fa-calendar' },
      { href: '/sales/orders.html', label: '発注管理', icon: 'fa-shopping-cart' }
    ],
    admin: [
      { href: '/admin/dashboard.html', label: 'ダッシュボード', icon: 'fa-tachometer-alt' },
      { href: '/admin/services.html', label: 'サービス管理', icon: 'fa-cogs' },
      { href: '/admin/services/new.html', label: '新規サービス登録', icon: 'fa-plus-circle' },
      { href: '/admin/clients.html', label: '顧客管理', icon: 'fa-users' },
      { href: '/admin/orders.html', label: '発注管理', icon: 'fa-shopping-cart' },
      { href: '/admin/users.html', label: 'ユーザーID管理', icon: 'fa-user-shield' },
      { href: '/admin/partners.html', label: 'パートナー企業一覧', icon: 'fa-handshake' }
    ],
    developer: [
      { href: '/admin/dashboard.html', label: 'ダッシュボード', icon: 'fa-tachometer-alt' },
      { href: '/admin/services.html', label: 'サービス管理', icon: 'fa-cogs' },
      { href: '/admin/services/review.html', label: '変更レビュー', icon: 'fa-code-branch' },
      { href: '/admin/images.html', label: '画像管理', icon: 'fa-images' },
      { href: '/admin/clients.html', label: '顧客管理', icon: 'fa-users' },
      { href: '/admin/orders.html', label: '発注管理', icon: 'fa-shopping-cart' },
      { href: '/admin/users.html', label: 'ユーザーID管理', icon: 'fa-user-shield' },
      { href: '/admin/sitemap.html', label: 'サイトマップ', icon: 'fa-sitemap' }
    ],
    master: [
      // マスター権限はドロップダウンリストを使用するため、通常のナビゲーション項目は最小限
      { href: '/admin/dashboard.html', label: 'ダッシュボード', icon: 'fa-tachometer-alt' },
      { href: '/admin/sitemap.html', label: 'サイトマップ', icon: 'fa-sitemap', special: 'dropdown' }
    ]
  },
  
  // マスター権限用のドロップダウンリスト項目（カテゴリ別）
  masterNavigation: {
    'パブリック': [
      { href: '/index.html', label: 'トップページ（発注）', icon: 'fa-home' },
      { href: '/service.html', label: 'サービス一覧', icon: 'fa-list' },
      { href: '/concierge.html', label: 'コンシェルジュ', icon: 'fa-concierge-bell' },
      { href: '/contact.html', label: 'お問い合わせ', icon: 'fa-envelope' },
      { href: '/signin.html', label: 'ログイン', icon: 'fa-sign-in-alt' },
      { href: '/signup.html', label: '新規登録', icon: 'fa-user-plus' }
    ],
    'ユーザー（顧客）': [
      { href: '/mypage.html', label: 'マイページ', icon: 'fa-user' },
      { href: '/mypage/info.html', label: 'オーナー情報', icon: 'fa-id-card' },
      { href: '/mypage/settings.html', label: '設定', icon: 'fa-cog' },
      { href: '/mypage/support.html', label: 'サポートセンター', icon: 'fa-life-ring' },
      { href: '/cart.html', label: 'カート', icon: 'fa-shopping-bag' },
      { href: '/checkout.html', label: '決済確認', icon: 'fa-credit-card' },
      { href: '/order/history.html', label: '注文履歴', icon: 'fa-history' },
      { href: '/schedule.html', label: 'スケジュール', icon: 'fa-calendar' },
      { href: '/report.html', label: 'レポート一覧', icon: 'fa-file-alt' }
    ],
    '清掃員': [
      { href: '/staff/dashboard.html', label: 'ダッシュボード', icon: 'fa-tachometer-alt' },
      { href: '/staff/schedule.html', label: 'スケジュール', icon: 'fa-calendar' },
      { href: '/staff/assignments.html', label: '作業一覧', icon: 'fa-tasks' },
      { href: '/staff/reports/new.html', label: 'レポート作成', icon: 'fa-file-alt' },
      { href: '/staff/training.html', label: 'トレーニング', icon: 'fa-graduation-cap' }
    ],
    '営業マン（コンシェルジュ）': [
      { href: '/sales/dashboard.html', label: 'ダッシュボード', icon: 'fa-tachometer-alt' },
      { href: '/sales/clients.html', label: '顧客管理', icon: 'fa-users' },
      { href: '/sales/clients/new.html', label: '新規顧客登録', icon: 'fa-user-plus' },
      { href: '/sales/estimates.html', label: '見積もり一覧', icon: 'fa-file-invoice' },
      { href: '/sales/estimates/new.html', label: '見積もり作成', icon: 'fa-file-invoice-dollar' },
      { href: '/sales/schedule.html', label: 'スケジュール', icon: 'fa-calendar' },
      { href: '/sales/orders.html', label: '発注管理', icon: 'fa-shopping-cart' }
    ],
    '管理者': [
      { href: '/admin/dashboard.html', label: 'ダッシュボード', icon: 'fa-tachometer-alt' },
      { href: '/admin/services.html', label: 'サービス管理', icon: 'fa-cogs' },
      { href: '/admin/services/new.html', label: '新規サービス登録', icon: 'fa-plus-circle' },
      { href: '/admin/clients.html', label: '顧客管理', icon: 'fa-users' },
      { href: '/admin/orders.html', label: '発注管理', icon: 'fa-shopping-cart' },
      { href: '/admin/users.html', label: 'ユーザーID管理', icon: 'fa-user-shield' },
      { href: '/admin/users/customers.html', label: '顧客一覧', icon: 'fa-users' },
      { href: '/admin/users/sales.html', label: 'コンシェルジュ一覧', icon: 'fa-user-tie' },
      { href: '/admin/users/staff.html', label: '清掃員一覧', icon: 'fa-user-cog' },
      { href: '/admin/partners.html', label: 'パートナー企業一覧', icon: 'fa-handshake' },
      { href: '/admin/sitemap.html', label: 'サイトマップ', icon: 'fa-sitemap' }
    ],
    '開発者': [
      { href: '/admin/services/review.html', label: '変更レビュー', icon: 'fa-code-branch' },
      { href: '/admin/images.html', label: '画像一覧', icon: 'fa-images' }
    ]
  }
};

/**
 * パスがパターンにマッチするかチェック
 */
function matchPathPattern(path, pattern) {
  if (pattern === path) {
    return true;
  }
  if (pattern.endsWith('/') && path.startsWith(pattern)) {
    return true;
  }
  if (pattern.endsWith('/*') && path.startsWith(pattern.slice(0, -2))) {
    return true;
  }
  return false;
}

/**
 * ページへのアクセス権限をチェック
 */
function checkPageAccess(path, userRole) {
  // マスター、管理者、開発者はすべてのページにアクセス可能
  if (userRole === 'master' || userRole === 'admin' || userRole === 'developer') {
    return true;
  }
  
  // パスを正規化（クエリパラメータやハッシュを除去）
  const normalizedPath = path.split('?')[0].split('#')[0];
  
  // ページアクセス設定をチェック
  for (const [pattern, allowedRoles] of Object.entries(ROLE_CONFIG.pageAccess)) {
    if (matchPathPattern(normalizedPath, pattern)) {
      // ロール階層を考慮
      const userRoles = ROLE_CONFIG.roleHierarchy[userRole] || [userRole];
      return allowedRoles.some(role => userRoles.includes(role));
    }
  }
  
  // デフォルトはアクセス不可
  return false;
}

/**
 * ロール名を取得
 */
function getRoleDisplayName(role) {
  return ROLE_CONFIG.roles[role]?.displayName || role;
}

/**
 * ロールごとのナビゲーション項目を取得
 */
function getNavigationForRole(role) {
  return ROLE_CONFIG.navigation[role] || ROLE_CONFIG.navigation.guest;
}

/**
 * マスター権限用のドロップダウンリスト項目を取得
 */
function getMasterNavigation() {
  return ROLE_CONFIG.masterNavigation || {};
}

/**
 * ロールごとのデフォルトページ（ログイン後リダイレクト先）を取得
 */
function getDefaultPageForRole(role) {
  return ROLE_CONFIG.defaultPages[role] || ROLE_CONFIG.defaultPages.guest || '/index.html';
}

// グローバルに公開
window.RoleConfig = {
  ROLE_CONFIG: ROLE_CONFIG,
  matchPathPattern: matchPathPattern,
  checkPageAccess: checkPageAccess,
  getRoleDisplayName: getRoleDisplayName,
  getNavigationForRole: getNavigationForRole,
  getMasterNavigation: getMasterNavigation,
  getDefaultPageForRole: getDefaultPageForRole
};

