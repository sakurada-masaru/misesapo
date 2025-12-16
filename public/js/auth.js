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
  const getDefaultPageForRole = window.RoleConfig?.getDefaultPageForRole || function(role) { return '/'; };
  
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
    // カスタムドメインの場合はルートパスを使用
    const hostname = window.location.hostname;
    if (hostname === 'misesapo.co.jp' || hostname === 'www.misesapo.co.jp') {
      return '/';
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
    // 本番環境のAPIエンドポイント
    const PROD_API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';
    
    // ローカル開発環境
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return PROD_API_BASE;  // ローカルでも本番APIを使用
    }
    
    // 本番環境
    return PROD_API_BASE;
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
   * Firebaseエラーメッセージを日本語に変換
   */
  // Firebase関連の関数は削除済み（Cognitoに移行）
  
  /**
   * ログイン（Cognito → API → クライアントサイド認証の順で試行）
   */
  async function login(email, password) {
    // 1. Cognito認証が利用可能な場合はCognitoを使用（最優先）
    if (window.CognitoAuth && window.CognitoAuth.login) {
      try {
        const result = await window.CognitoAuth.login(email, password);
        if (result.success) {
          return result;
        }
        // Cognitoログインが失敗した場合は次の方法を試す
      } catch (error) {
        console.warn('[Auth] Cognito login failed, trying fallback:', error);
        // Cognitoエラーの場合は次の方法を試す
      }
    }
    
    const apiBaseUrl = getApiBaseUrl();
    
    // 2. APIサーバーが利用可能な場合はAPIを使用
    if (apiBaseUrl) {
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
          // APIエラーの場合はクライアントサイド認証にフォールバック
        } else {
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
        }
      } catch (error) {
        console.error('[Auth] API login error:', error);
        // APIエラーの場合はクライアントサイド認証にフォールバック
      }
    }
    
    // APIが使えない場合（GitHub Pagesなど）はクライアントサイド認証を使用
    if (!window.Users || !window.Users.findUserByEmailAndPassword) {
      return {
        success: false,
        message: '認証システムが利用できません。users.jsが読み込まれているか確認してください。'
      };
    }
    
    try {
      const user = await window.Users.findUserByEmailAndPassword(email, password);
      
      if (!user) {
        return {
          success: false,
          message: 'メールアドレスまたはパスワードが正しくありません'
        };
      }
      
      // ステータスチェック
      if (user.status !== 'active') {
        return {
          success: false,
          message: 'このアカウントは無効化されています'
        };
      }
      
      // 認証情報を保存
      const role = user.role;
      if (typeof role !== 'string') {
        console.error('[Auth] Invalid role in user data:', user);
        return {
          success: false,
          message: 'ユーザーデータが正しくありません。'
        };
      }
      
      setAuthData(role, user.email, user);
      
      return {
        success: true,
        user: user,
        role: role
      };
    } catch (error) {
      console.error('[Auth] Client-side login error:', error);
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
    // Cognito認証からログアウト
    if (window.CognitoAuth && window.CognitoAuth.logout) {
      try {
        await window.CognitoAuth.logout();
      } catch (error) {
        console.error('[Auth] Cognito logout error:', error);
        // エラーが発生しても続行
      }
    }
    
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
    window.location.href = basePath === '/' ? '/signin' : basePath + 'signin';
  }
  
  // Firebase関連の関数は削除済み（Cognitoに移行）
  
  /**
   * ユーザー登録（Cognito経由）
   * 注意: signup.htmlから呼び出される場合は、customerロールで登録されます
   * 他のロール（staff, concierge, adminなど）は管理者が登録する必要があります
   */
  async function register(email, password, name = null, role = 'customer') {
    try {
      const apiBaseUrl = getApiBaseUrl();
      if (!apiBaseUrl) {
        return {
          success: false,
          message: 'ユーザー登録機能は現在利用できません。APIサーバーに接続できません。'
        };
      }
      
      // Lambda関数経由でCognitoユーザーを作成
      const response = await fetch(`${apiBaseUrl}/admin/cognito/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: email,
          password: password,
          name: name || email.split('@')[0],
          role: role,
          department: role === 'customer' ? 'お客様' : ''
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        return {
          success: false,
          message: errorData.error || errorData.message || 'ユーザー登録に失敗しました'
        };
      }
      
      const result = await response.json();
      const cognitoSub = result.sub;
      
      // DynamoDBのclientsテーブルに登録（お客様専用）
      if (role === 'customer') {
        try {
          const clientId = 'C' + Date.now();
          const clientData = {
            id: clientId,
            cognito_sub: cognitoSub,
            email: email,
            name: name || email.split('@')[0],
            phone: '',
            company_name: '',
            store_name: '',
            role: 'customer',
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          const clientResponse = await fetch(`${apiBaseUrl}/clients`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(clientData)
          });
          
          if (clientResponse.ok) {
            const createdClient = await clientResponse.json();
            if (createdClient && createdClient.id) {
              clientData.id = createdClient.id;
            }
          }
        } catch (error) {
          console.error('[Auth] Error creating client in DynamoDB:', error);
          // DynamoDBへの登録に失敗しても、Cognito登録は成功とする
        }
      }
      
      // 認証情報を保存
      setAuthData(role, email, {
        id: cognitoSub,
        cognito_sub: cognitoSub,
        email: email,
        role: role,
        name: name || email.split('@')[0],
        emailVerified: false
      });
      
      return {
        success: true,
        user: {
          id: cognitoSub,
          email: email,
          role: role,
          name: name || email.split('@')[0],
          emailVerified: false
        }
      };
    } catch (error) {
      console.error('[Auth] Registration error:', error);
      return {
        success: false,
        message: error.message || 'ユーザー登録に失敗しました'
      };
    }
  }
  
  /**
   * 認証チェック
   */
  function checkAuth() {
    const currentPath = window.location.pathname;
    const basePath = getBasePath();
    let normalizedPath = currentPath;
    if (basePath !== '/' && currentPath.startsWith(basePath)) {
      normalizedPath = currentPath.substring(basePath.length - 1);
    }
    
    // 従業員関連ページ（管理、営業、清掃）では、Firebase認証（顧客用）のチェックをスキップ
    // これらのページはAWS Cognito認証のみを使用する
    if (normalizedPath.startsWith('/admin/') || 
        normalizedPath.startsWith('/sales/') || 
        normalizedPath.startsWith('/staff/') ||
        normalizedPath.startsWith('/wiki') ||
        currentPath.includes('/admin/') || 
        currentPath.includes('/sales/') || 
        currentPath.includes('/staff/') ||
        currentPath.includes('/wiki')) {
      // 従業員関連ページでは、AWS Cognito認証をチェック
      const cognitoUser = localStorage.getItem('cognito_user');
      if (cognitoUser) {
        try {
          const user = JSON.parse(cognitoUser);
          if (user && user.role) {
            return true;
          }
        } catch (e) {
          // パースエラーは無視
        }
      }
      // Cognito認証がない場合でも、misesapo_authがあれば従業員として認証済みとみなす
      const authData = getAuthData();
      if (authData && authData.role && authData.role !== 'customer') {
        return true;
      }
      return false;
    }
    
    // 顧客関連ページ（/mypage/*など）では、Cognito認証をチェック
    // Cognito認証の認証状態をチェック
    if (window.CognitoAuth && window.CognitoAuth.isAuthenticated) {
      if (window.CognitoAuth.isAuthenticated()) {
        const authData = getAuthData();
        if (authData) {
          return true;
        }
        return true;
      }
    }
    
    // フォールバック: sessionStorageをチェック
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
    const basePath = getBasePath();
    let normalizedPath = currentPath;
    if (basePath !== '/' && currentPath.startsWith(basePath)) {
      normalizedPath = currentPath.substring(basePath.length - 1); // 先頭の/を残す
    }
    
    // パブリックページ（認証不要）のリスト
    const publicPages = [
      '/',
      '/index.html',
      '/service.html',
      '/service/',           // /service/1.html など
      '/about.html',
      '/greeting.html',      // 代表あいさつ
      '/partner.html',       // パートナーシップ
      '/contact.html',
      '/voice.html',
      '/announcements.html',
      '/privacy-policy.html',
      '/privacy-policy',
      '/service-terms.html',
      '/service-terms',
      '/security-policy.html',
      '/security-policy',
      '/workplace-policy.html',
      '/workplace-policy',
      '/antisocial-declaration.html',
      '/antisocial-declaration',
      '/cleaning-manual.html',
      '/teikiseisou.html',
      '/lp.html',
      '/recruit.html',
      '/recruit/',           // /recruit/apply/cleaning.html など
      '/customers.html',
      '/customers-support-desk.html',
      '/tokushoho.html',
      '/tokushoho',
      '/signin.html',
      '/signup.html',
      '/signup/',            // /signup/2.html など
      '/new-page.html'
    ];
    
    // パブリックページかどうかをチェック
    // .htmlを削除して比較（.htmlあり/なしの両方に対応）
    const normalizePathForCheck = (path) => {
      if (path.endsWith('.html')) {
        return path.slice(0, -5); // .htmlを削除
      }
      return path;
    };
    const normalizedPathWithoutHtml = normalizePathForCheck(normalizedPath);
    
    const isPublicPage = publicPages.some(page => {
      if (page.endsWith('/')) {
        // ディレクトリパスの場合は前方一致
        return normalizedPath.startsWith(page) || currentPath.includes(page);
      }
      // .htmlを削除して比較
      const pageWithoutHtml = normalizePathForCheck(page);
      // 完全一致（.htmlあり/なしの両方に対応）
      return normalizedPath === page || 
             normalizedPathWithoutHtml === pageWithoutHtml ||
             currentPath.endsWith(page) ||
             currentPath.endsWith(pageWithoutHtml);
    });
    
    if (isPublicPage) {
      return true;
    }
    
    // 従業員関連ページ（管理、営業、清掃）では、顧客認証（Firebase）のチェックをスキップ
    // これらのページはAWS Cognito認証のみを使用する
    if (normalizedPath.startsWith('/admin/') || 
        normalizedPath.startsWith('/sales/') || 
        normalizedPath.startsWith('/staff/') ||
        normalizedPath.startsWith('/wiki') ||
        currentPath.includes('/admin/') || 
        currentPath.includes('/sales/') || 
        currentPath.includes('/staff/') ||
        currentPath.includes('/wiki')) {
      return true;
    }
    
    // 以下は顧客専用ページ（/mypage/*, /order/*, /cart/* など）のみFirebase認証をチェック
    const customerOnlyPaths = ['/mypage/', '/order/', '/cart/', '/order-history/'];
    const isCustomerOnlyPage = customerOnlyPaths.some(path => 
      normalizedPath.startsWith(path) || currentPath.includes(path)
    );
    
    if (!isCustomerOnlyPage) {
      // 顧客専用ページでなければ認証不要
      return true;
    }
    
    // 顧客専用ページの場合、認証をチェック
    const currentRole = getCurrentRole();
    
    // マスター、管理者、開発者はすべてのページにアクセス可能
    if (currentRole === 'master' || currentRole === 'admin' || currentRole === 'developer') {
      return true;
    }
    
    // ページアクセス権限をチェック（顧客関連ページのみ）
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
  
  /**
   * メール確認の再送信（Cognito対応）
   */
  async function resendEmailVerification() {
    // Cognitoではメール確認の再送信はAPI経由で行う
    const apiBaseUrl = getApiBaseUrl();
    if (!apiBaseUrl) {
      return {
        success: false,
        message: 'メール確認の再送信機能は現在利用できません。'
      };
    }
    
    const authData = getAuthData();
    if (!authData || !authData.user || !authData.user.email) {
      return {
        success: false,
        message: 'ログインしていません。'
      };
    }
    
    try {
      // API経由でメール確認の再送信をリクエスト
      const response = await fetch(`${apiBaseUrl}/admin/cognito/resend-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: authData.user.email
        })
      });
      
      if (response.ok) {
        return {
          success: true,
          message: '確認メールを再送信しました。メールボックスをご確認ください。'
        };
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        return {
          success: false,
          message: errorData.error || errorData.message || 'メール確認の再送信に失敗しました。'
        };
      }
    } catch (error) {
      console.error('[Auth] Could not resend email verification:', error);
      return {
        success: false,
        message: getFirebaseErrorMessage(error)
      };
    }
  }
  
  // グローバルに公開
  window.Auth = {
    login: login,
    register: register,
    logout: logout,
    checkAuth: checkAuth,
    getCurrentRole: getCurrentRole,
    checkPageAccess: checkPageAccessForPath,
    checkCurrentPageAccess: checkCurrentPageAccess,
    getDefaultPageForRole: getDefaultPageForRole,
    getAuthData: getAuthData,
    setAuthData: setAuthData,
    resendEmailVerification: resendEmailVerification
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
