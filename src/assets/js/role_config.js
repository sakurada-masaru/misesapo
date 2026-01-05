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
      password: null,
      displayName: 'ユーザー'
    },
    staff: {
      name: '清掃員',
      password: null,
      displayName: '清掃員'
    },
    concierge: {
      name: 'コンシェルジュ',
      password: null,
      displayName: 'コンシェルジュ'
    },
    admin: {
      name: '管理者',
      password: null,
      displayName: '管理者'
    },
    developer: {
      name: '開発者',
      password: null,
      displayName: '開発者'
    },
    office: {
      name: '事務',
      password: null,
      displayName: '事務'
    },
    designer: {
      name: 'デザイナー',
      password: null,
      displayName: 'デザイナー'
    },
    contractor: {
      name: '外部委託',
      password: null,
      displayName: '外部委託'
    },
    general_affairs: {
      name: '総務',
      password: null,
      displayName: '総務'
    },
    operation: {
      name: '運営',
      password: null,
      displayName: '運営'
    },
    accounting: {
      name: '経理',
      password: null,
      displayName: '経理'
    },
    human_resources: {
      name: '人事',
      password: null,
      displayName: '人事'
    },
    master: {
      name: 'マスター',
      password: null,
      displayName: 'マスター'
    }
  },

  // ロール階層（上位ロールは下位ロールの権限も持つ）
  // 階層: マスター > 開発者 > 管理者 > コンシェルジュ > 事務・デザイナー・総務・運営・経理・人事 > 清掃員・外部委託・ユーザー（同レベル）
  roleHierarchy: {
    guest: ['guest'],
    customer: ['guest', 'customer'],  // ユーザー（顧客）
    staff: ['guest', 'staff'],        // 清掃員
    contractor: ['guest', 'contractor'],  // 外部委託
    office: ['guest', 'office'],      // 事務
    designer: ['guest', 'designer'],  // デザイナー
    general_affairs: ['guest', 'general_affairs'],  // 総務
    operation: ['guest', 'operation'],  // 運営
    accounting: ['guest', 'accounting'],  // 経理
    human_resources: ['guest', 'human_resources'],  // 人事
    concierge: ['guest', 'customer', 'staff', 'concierge'],  // コンシェルジュ: 清掃員とユーザーの権限も持つ
    admin: ['guest', 'customer', 'staff', 'contractor', 'office', 'designer', 'general_affairs', 'operation', 'accounting', 'human_resources', 'concierge', 'admin'],  // 管理者: すべての権限
    developer: ['guest', 'customer', 'staff', 'contractor', 'office', 'designer', 'general_affairs', 'operation', 'accounting', 'human_resources', 'concierge', 'admin', 'developer'],  // 開発者: すべての権限
    master: ['guest', 'customer', 'staff', 'contractor', 'office', 'designer', 'general_affairs', 'operation', 'accounting', 'human_resources', 'concierge', 'admin', 'developer', 'master']  // マスター: すべての権限（最上位）
  },

  // ロールごとのログイン後リダイレクト先
  defaultPages: {
    'customer': '/mypage',
    'staff': '/staff/mypage',  // 清掃員（OS課以外）は通常マイページ（PC向け）
    'office': '/staff/office/mypage',  // 事務は事務マイページ（PC向け）
    'designer': '/admin/dashboard',  // デザイナーは管理ダッシュボード
    'general_affairs': '/admin/dashboard',  // 総務は管理ダッシュボード
    'operation': '/admin/dashboard',  // 運営は管理ダッシュボード
    'accounting': '/admin/dashboard',  // 経理は管理ダッシュボード
    'human_resources': '/admin/dashboard',  // 人事は管理ダッシュボード
    'contractor': '/staff/mypage',  // 外部委託は通常マイページ（PC向け）
    'concierge': '/sales/mypage',  // コンシェルジュは営業マイページ（SP用、クイックメニューあり）
    'sales': '/sales/mypage',  // 営業は営業マイページ（SP用、クイックメニューあり）
    'admin': '/admin/dashboard',  // 管理者は管理ダッシュボード
    'developer': '/staff/developer/mypage',  // 開発者は開発マイページ（PC向け）
    'master': '/admin/sitemap',  // マスターはサイトマップ
    'guest': '/'
  },

  // ページ別アクセス制御（パスパターン）
  pageAccess: {
    // パブリックページ（全員アクセス可能）
    '/': ['guest', 'customer', 'staff', 'office', 'designer', 'concierge', 'admin', 'developer', 'master'],
    '/service.html': ['guest', 'customer', 'staff', 'office', 'designer', 'concierge', 'admin', 'developer', 'master'],
    '/service/': ['guest', 'customer', 'staff', 'concierge', 'admin', 'developer', 'master'],
    '/recruit.html': ['guest', 'customer', 'staff', 'office', 'designer', 'concierge', 'admin', 'developer', 'master'],
    '/recruit/': ['guest', 'customer', 'staff', 'office', 'designer', 'concierge', 'admin', 'developer', 'master'],
    '/signin.html': ['guest', 'customer', 'staff', 'office', 'designer', 'concierge', 'admin', 'developer', 'master'],
    '/signup.html': ['guest', 'customer', 'staff', 'office', 'designer', 'concierge', 'admin', 'developer', 'master'],
    '/signup2.html': ['guest', 'customer', 'staff', 'office', 'designer', 'concierge', 'admin', 'developer', 'master'],
    '/signup3.html': ['guest', 'customer', 'staff', 'office', 'designer', 'concierge', 'admin', 'developer', 'master'],
    '/reset-password.html': ['guest', 'customer', 'staff', 'office', 'designer', 'concierge', 'admin', 'developer', 'master'],
    '/contact.html': ['guest', 'customer', 'staff', 'office', 'designer', 'concierge', 'admin', 'developer', 'master'],
    '/voice.html': ['guest', 'customer', 'staff', 'office', 'designer', 'concierge', 'admin', 'developer', 'master'],
    '/customers.html': ['guest', 'customer', 'staff', 'office', 'designer', 'concierge', 'admin', 'developer', 'master'],
    '/customers-support-desk.html': ['guest', 'customer', 'staff', 'office', 'designer', 'concierge', 'admin', 'developer', 'master'],
    '/support/': ['guest', 'customer', 'staff', 'office', 'designer', 'concierge', 'admin', 'developer', 'master'],
    '/privacy-policy.html': ['guest', 'customer', 'staff', 'office', 'designer', 'concierge', 'admin', 'developer', 'master'],
    '/privacy-policy': ['guest', 'customer', 'staff', 'office', 'designer', 'concierge', 'admin', 'developer', 'master'],
    '/service-terms.html': ['guest', 'customer', 'staff', 'office', 'designer', 'concierge', 'admin', 'developer', 'master'],
    '/service-terms': ['guest', 'customer', 'staff', 'office', 'designer', 'concierge', 'admin', 'developer', 'master'],
    '/security-policy.html': ['guest', 'customer', 'staff', 'office', 'designer', 'concierge', 'admin', 'developer', 'master'],
    '/security-policy': ['guest', 'customer', 'staff', 'office', 'designer', 'concierge', 'admin', 'developer', 'master'],
    '/workplace-policy.html': ['guest', 'customer', 'staff', 'office', 'designer', 'concierge', 'admin', 'developer', 'master'],
    '/workplace-policy': ['guest', 'customer', 'staff', 'office', 'designer', 'concierge', 'admin', 'developer', 'master'],
    '/antisocial-declaration.html': ['guest', 'customer', 'staff', 'office', 'designer', 'concierge', 'admin', 'developer', 'master'],
    '/antisocial-declaration': ['guest', 'customer', 'staff', 'office', 'designer', 'concierge', 'admin', 'developer', 'master'],
    '/tokushoho.html': ['guest', 'customer', 'staff', 'office', 'designer', 'concierge', 'admin', 'developer', 'master'],
    '/tokushoho': ['guest', 'customer', 'staff', 'office', 'designer', 'concierge', 'admin', 'developer', 'master'],
    '/about.html': ['guest', 'customer', 'staff', 'office', 'designer', 'concierge', 'admin', 'developer', 'master'],
    '/lp.html': ['guest', 'customer', 'staff', 'office', 'designer', 'concierge', 'admin', 'developer', 'master'],

    // 顧客向けページ（ユーザーと清掃員がアクセス可能、コンシェルジュと管理者も可）
    '/mypage.html': ['customer', 'staff', 'office', 'designer', 'concierge', 'admin', 'developer', 'master'],
    '/mypage/': ['customer', 'staff', 'office', 'designer', 'concierge', 'admin', 'developer', 'master'],
    '/cart.html': ['customer', 'staff', 'office', 'designer', 'concierge', 'admin', 'developer', 'master'],
    '/checkout.html': ['customer', 'staff', 'office', 'designer', 'concierge', 'admin', 'developer', 'master'],
    '/order/': ['customer', 'staff', 'office', 'designer', 'concierge', 'admin', 'developer', 'master'],
    '/order-complete.html': ['customer', 'staff', 'office', 'designer', 'concierge', 'admin', 'developer', 'master'],
    '/order-confirm.html': ['customer', 'staff', 'office', 'designer', 'concierge', 'admin', 'developer', 'master'],

    // 清掃員向けページ（清掃員とユーザーがアクセス可能、コンシェルジュと管理者も可）
    '/staff/': ['staff', 'customer', 'office', 'designer', 'concierge', 'admin', 'developer', 'master'],
    '/schedule.html': ['staff', 'customer', 'office', 'designer', 'concierge', 'admin', 'developer', 'master'],
    '/report.html': ['staff', 'customer', 'office', 'designer', 'concierge', 'admin', 'developer', 'master'],
    '/reports/': ['staff', 'customer', 'office', 'designer', 'concierge', 'admin', 'developer', 'master'],

    // コンシェルジュ向けページ（コンシェルジュと管理者のみ）
    '/sales/': ['concierge', 'admin', 'developer', 'master'],

    // 管理者向けページ（管理者と開発者のみ）
    '/admin/': ['guest', 'customer', 'staff', 'office', 'designer', 'concierge', 'admin', 'developer', 'master'],
    '/admin/partners.html': ['admin', 'developer', 'master'],
    '/admin/partners/': ['admin', 'developer', 'master'],
    '/admin/partners/new.html': ['admin', 'developer', 'master'],

    // 開発者向けページ（開発者のみ）
    '/admin/services/review.html': ['developer', 'master'],

    // 清掃マニュアル管理画面（管理者・清掃員・コンシェルジュ・開発者・マスター）
    '/cleaning-manual-admin.html': ['admin', 'staff', 'office', 'designer', 'concierge', 'developer', 'master'],
    '/cleaning-manual.html': ['guest', 'customer', 'staff', 'office', 'designer', 'concierge', 'admin', 'developer', 'master']
  },

  // ロールごとのナビゲーション項目（推奨ナビゲーション）
  navigation: {
    guest: [
      { href: '/', label: '発注', icon: 'fa-shopping-cart' },
      { href: '/service', label: 'サービス一覧', icon: 'fa-list' },
      { href: '/contact', label: 'お問い合わせ', icon: 'fa-envelope' }
    ],
    customer: [
      { href: '/mypage', label: 'マイページ', icon: 'fa-user' },
      { href: '/', label: '発注', icon: 'fa-shopping-cart' },
      { href: '/service', label: 'サービス一覧', icon: 'fa-list' },
      { href: '/cart', label: 'カート', icon: 'fa-shopping-bag' },
      { href: '/order/history', label: '注文履歴', icon: 'fa-history' },
      { href: '/schedule', label: 'スケジュール', icon: 'fa-calendar' },
      { href: '/report', label: 'レポート一覧', icon: 'fa-file-alt' }
    ],
    staff: [
      { href: '/staff/dashboard.html', label: 'ダッシュボード', icon: 'fa-tachometer-alt' },
      { href: '/staff/schedule.html', label: 'スケジュール', icon: 'fa-calendar' },
      { href: '/staff/assignments.html', label: '作業一覧', icon: 'fa-tasks' },
      { href: '/staff/reports/new.html', label: 'レポート作成', icon: 'fa-file-alt' },
      { href: '/staff/training.html', label: 'トレーニング', icon: 'fa-graduation-cap' }
    ],
    office: [
      { href: '/admin/dashboard', label: 'ダッシュボード', icon: 'fa-tachometer-alt' },
      { href: '/admin/clients', label: '顧客管理', icon: 'fa-users' },
      { href: '/admin/orders', label: '発注管理', icon: 'fa-shopping-cart' },
      { href: '/admin/users', label: 'ユーザー管理', icon: 'fa-user-shield' }
    ],
    designer: [
      { href: '/admin/dashboard', label: 'ダッシュボード', icon: 'fa-tachometer-alt' },
      { href: '/admin/images', label: '画像管理', icon: 'fa-images' },
      { href: '/admin/services', label: 'サービス管理', icon: 'fa-cogs' }
    ],
    concierge: [
      { href: '/sales/dashboard', label: 'ダッシュボード', icon: 'fa-tachometer-alt' },
      { href: '/sales/dashboard#client', label: '顧客管理', icon: 'fa-users' },
      { href: '/sales/clients/new', label: '新規顧客登録', icon: 'fa-user-plus' },
      { href: '/sales/estimates', label: '見積もり一覧', icon: 'fa-file-invoice' },
      { href: '/sales/estimates/new', label: '見積もり作成', icon: 'fa-file-invoice-dollar' },
      { href: '/sales/schedule', label: 'スケジュール', icon: 'fa-calendar' },
      { href: '/sales/orders', label: '発注管理', icon: 'fa-shopping-cart' }
    ],
    admin: [
      { href: '/admin/dashboard', label: 'ダッシュボード', icon: 'fa-tachometer-alt' },
      { href: '/admin/services', label: 'サービス管理', icon: 'fa-cogs' },
      { href: '/admin/services/new', label: '新規サービス登録', icon: 'fa-plus-circle' },
      { href: '/admin/clients', label: '顧客管理', icon: 'fa-users' },
      { href: '/admin/orders', label: '発注管理', icon: 'fa-shopping-cart' },
      { href: '/admin/users', label: 'ユーザーID管理', icon: 'fa-user-shield' },
      { href: '/admin/partners', label: 'パートナー企業一覧', icon: 'fa-handshake' },
      { href: '/cleaning-manual-admin', label: '清掃マニュアル', icon: 'fa-book' }
    ],
    developer: [
      { href: '/admin/dashboard', label: 'ダッシュボード', icon: 'fa-tachometer-alt' },
      { href: '/admin/services', label: 'サービス管理', icon: 'fa-cogs' },
      { href: '/admin/services/review', label: '変更レビュー', icon: 'fa-code-branch' },
      { href: '/admin/images', label: '画像管理', icon: 'fa-images' },
      { href: '/admin/clients', label: '顧客管理', icon: 'fa-users' },
      { href: '/admin/orders', label: '発注管理', icon: 'fa-shopping-cart' },
      { href: '/admin/users', label: 'ユーザーID管理', icon: 'fa-user-shield' },
      { href: '/admin/sitemap', label: 'サイトマップ', icon: 'fa-sitemap' }
    ],
    master: [
      // マスター権限はドロップダウンリストを使用するため、通常のナビゲーション項目は最小限
      { href: '/admin/dashboard', label: 'ダッシュボード', icon: 'fa-tachometer-alt' },
      { href: '/admin/sitemap', label: 'サイトマップ', icon: 'fa-sitemap', special: 'dropdown' }
    ]
  },

  // マスター権限用のドロップダウンリスト項目（カテゴリ別）
  masterNavigation: {
    'パブリック': [
      { href: '/', label: 'トップページ（発注）', icon: 'fa-home' },
      { href: '/service.html', label: 'サービス一覧', icon: 'fa-list' },
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
    '事務': [
      { href: '/admin/dashboard.html', label: 'ダッシュボード', icon: 'fa-tachometer-alt' },
      { href: '/admin/clients.html', label: '顧客管理', icon: 'fa-users' },
      { href: '/admin/orders.html', label: '発注管理', icon: 'fa-shopping-cart' },
      { href: '/admin/users.html', label: 'ユーザー管理', icon: 'fa-user-shield' }
    ],
    'デザイナー': [
      { href: '/admin/dashboard.html', label: 'ダッシュボード', icon: 'fa-tachometer-alt' },
      { href: '/admin/images.html', label: '画像管理', icon: 'fa-images' },
      { href: '/admin/services.html', label: 'サービス管理', icon: 'fa-cogs' }
    ],
    '営業マン（コンシェルジュ）': [
      { href: '/sales/dashboard.html', label: 'ダッシュボード', icon: 'fa-tachometer-alt' },
      { href: '/sales/dashboard#client', label: '顧客管理', icon: 'fa-users' },
      { href: '/sales/clients/new.html', label: '新規顧客登録', icon: 'fa-user-plus' },
      { href: '/sales/estimates.html', label: '見積もり一覧', icon: 'fa-file-invoice' },
      { href: '/sales/estimates/new.html', label: '見積もり作成', icon: 'fa-file-invoice-dollar' },
      { href: '/sales/schedules', label: 'スケジュール', icon: 'fa-calendar' },
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
      { href: '/cleaning-manual-admin.html', label: '清掃マニュアル', icon: 'fa-book' },
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
 * @param {string|object} roleOrUser - ロール名（文字列）またはユーザーオブジェクト（role, departmentを含む）
 */
function getDefaultPageForRole(roleOrUser) {
  // ユーザーオブジェクトが渡された場合
  if (typeof roleOrUser === 'object' && roleOrUser !== null) {
    const user = roleOrUser;
    const role = (user.role || '').toLowerCase();
    const department = (user.department || '').toLowerCase();
    const parentDepartment = (user.parent_department || '').toLowerCase();

    // parent_departmentベースでマイページを決定
    // 運営本部 → 営業マイページ
    if (parentDepartment.includes('運営本部')) {
      return '/sales/mypage';
    }
    // 清掃事業部 → OS課マイページ
    if (parentDepartment.includes('清掃事業部')) {
      return '/staff/os/mypage';
    }
    // 経営管理本部 → 事務マイページ
    if (parentDepartment.includes('経営管理本部')) {
      return '/staff/office/mypage';
    }
    // 組織運営本部 → 開発マイページ
    if (parentDepartment.includes('組織運営本部')) {
      return '/staff/developer/mypage';
    }

    // parent_departmentがない場合はdepartmentで判定（後方互換性）
    // 営業: 営業用マイページ
    if (role === 'sales' || role === 'concierge' || department.includes('営業') || department.includes('sales')) {
      return '/sales/mypage';
    }
    // OS課: OS課用マイページ
    if (department.includes('os') || department.includes('ｏｓ') || department.includes('os課') || department.includes('ｏｓ課') || department.includes('清掃')) {
      return '/staff/os/mypage';
    }
    // 事務: 事務マイページ
    if (role === 'office' || department.includes('事務') || department.includes('office') || department.includes('財務') || department.includes('経理')) {
      return '/staff/office/mypage';
    }
    // 開発: 開発マイページ
    if (role === 'developer' || department.includes('開発') || department.includes('developer') || department.includes('dx')) {
      return '/staff/developer/mypage';
    }
    // その他はロールベースで判定
    return ROLE_CONFIG.defaultPages[role] || ROLE_CONFIG.defaultPages.guest || '/';
  }

  // ロール名（文字列）が渡された場合
  const role = typeof roleOrUser === 'string' ? roleOrUser.toLowerCase() : '';
  return ROLE_CONFIG.defaultPages[role] || ROLE_CONFIG.defaultPages.guest || '/';
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

