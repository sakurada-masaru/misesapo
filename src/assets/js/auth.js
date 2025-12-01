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
   * Firebaseエラーメッセージを日本語に変換
   */
  function getFirebaseErrorMessage(error) {
    const errorMessages = {
      'auth/user-not-found': 'メールアドレスまたはパスワードが正しくありません',
      'auth/wrong-password': 'メールアドレスまたはパスワードが正しくありません',
      'auth/invalid-credential': 'メールアドレスまたはパスワードが正しくありません',
      'auth/invalid-email': 'メールアドレスの形式が正しくありません',
      'auth/email-already-in-use': 'このメールアドレスは既に使用されています',
      'auth/weak-password': 'パスワードが弱すぎます。6文字以上で入力してください',
      'auth/network-request-failed': 'ネットワークエラーが発生しました。接続を確認してください',
      'auth/too-many-requests': 'ログイン試行回数が多すぎます。しばらく待ってから再度お試しください',
      'auth/user-disabled': 'このアカウントは無効化されています',
      'auth/operation-not-allowed': 'この認証方法は許可されていません。Firebase Consoleでメール/パスワード認証を有効化してください',
      'auth/invalid-value-(email),-starting-an-object-on-a-scalar-field': 'メールアドレスの形式が正しくありません'
    };
    
    return errorMessages[error.code] || error.message || '認証処理でエラーが発生しました';
  }
  
  /**
   * Firebase Authenticationを使用したログイン
   */
  async function loginWithFirebase(email, password) {
    try {
      // Firebase Authのcompat版では、auth()の結果に対して直接メソッドを呼び出す
      const userCredential = await window.FirebaseAuth.signInWithEmailAndPassword(
        email,
        password
      );
      
      const firebaseUser = userCredential.user;
      const firebaseUid = firebaseUser.uid;
      
      // Firebase Custom Claimsからロールを取得
      let role = 'customer'; // デフォルトロール
      try {
        const idTokenResult = await firebaseUser.getIdTokenResult();
        role = idTokenResult.claims.role || 'customer';
      } catch (error) {
        console.warn('[Auth] Could not get custom claims, using default role:', error);
      }
      
      // DynamoDBからユーザー情報を取得（Firebase UIDで検索）
      let userInfo = null;
      try {
        const apiBaseUrl = getApiBaseUrl();
        if (apiBaseUrl) {
          const response = await fetch(`${apiBaseUrl}/workers?firebase_uid=${encodeURIComponent(firebaseUid)}`);
          if (response.ok) {
            const workers = await response.json();
            const workersArray = Array.isArray(workers) ? workers : (workers.items || workers.workers || []);
            if (workersArray.length > 0) {
              userInfo = workersArray[0];
              // DynamoDBから取得したロールを優先
              if (userInfo.role) {
                role = userInfo.role;
              }
            }
          }
        }
      } catch (error) {
        console.warn('[Auth] Could not fetch user info from DynamoDB:', error);
      }
      
      // Custom Claimsにロールがない場合、users.jsからロールを取得（フォールバック）
      if (role === 'customer' && window.Users && window.Users.findUserByEmail) {
        const userFromUsersJs = window.Users.findUserByEmail(firebaseUser.email);
        if (userFromUsersJs && userFromUsersJs.role) {
          role = userFromUsersJs.role;
          console.log('[Auth] Using role from users.js:', role);
        }
      }
      
      // ユーザー情報を保存（個人のIDを含む）
      const user = {
        id: userInfo ? userInfo.id : firebaseUid,  // DynamoDBのID（重要！）
        firebase_uid: firebaseUid,  // Firebase UID
        email: firebaseUser.email,
        role: role,
        name: userInfo ? userInfo.name : (firebaseUser.displayName || (window.Users && window.Users.findUserByEmail ? (window.Users.findUserByEmail(firebaseUser.email)?.name || email.split('@')[0]) : email.split('@')[0])),
        department: userInfo ? userInfo.department : '',
        emailVerified: firebaseUser.emailVerified
      };
      
      setAuthData(role, user.email, user);
      
      return {
        success: true,
        user: user,
        role: role
      };
    } catch (error) {
      console.error('[Auth] Firebase login error:', error);
      return {
        success: false,
        message: getFirebaseErrorMessage(error)
      };
    }
  }
  
  /**
   * ログイン（Firebase → API → クライアントサイド認証の順で試行）
   */
  async function login(email, password) {
    // 1. Firebase Authenticationが利用可能な場合はFirebaseを使用（最優先）
    if (window.FirebaseAuth) {
      return await loginWithFirebase(email, password);
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
    // Firebase Authenticationからログアウト
    if (window.FirebaseAuth) {
      try {
        // Firebase Authのcompat版では、auth()の結果に対して直接メソッドを呼び出す
        await window.FirebaseAuth.signOut();
      } catch (error) {
        console.error('[Auth] Firebase logout error:', error);
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
    window.location.href = basePath === '/' ? '/signin.html' : basePath + 'signin.html';
  }
  
  /**
   * Firebase Authenticationを使用したユーザー登録
   * 注意: signup.htmlから呼び出される場合は、customerロールで登録されます
   */
  async function registerWithFirebase(email, password, name = null, role = 'customer') {
    try {
      // Firebase Authのcompat版では、auth()の結果に対して直接メソッドを呼び出す
      const userCredential = await window.FirebaseAuth.createUserWithEmailAndPassword(
        email,
        password
      );
      
      const firebaseUser = userCredential.user;
      
      // 表示名を設定
      if (name) {
        await firebaseUser.updateProfile({
          displayName: name
        });
      }
      
      // メール確認を送信
      try {
        await firebaseUser.sendEmailVerification();
        console.log('[Auth] Email verification sent to:', firebaseUser.email);
      } catch (error) {
        console.error('[Auth] Could not send email verification:', error);
        // メール確認の送信に失敗しても登録は成功する
        // ユーザーには後でメール確認の再送信を促す
      }
      
      // ロールを設定（Custom Claimsを使用する場合はCloud Functionsが必要）
      // 現時点では、デフォルトでcustomerロールを使用
      // 将来的に、Cloud FunctionsでCustom Claimsを設定する必要がある
      
      // 認証情報を保存（customerロールで登録）
      setAuthData(role, firebaseUser.email, {
        id: firebaseUser.uid,
        email: firebaseUser.email,
        role: role,
        name: name || email.split('@')[0],
        emailVerified: false
      });
      
      return {
        success: true,
        user: {
          id: firebaseUser.uid,
          email: firebaseUser.email,
          role: role,
          name: name || email.split('@')[0],
          emailVerified: false
        }
      };
    } catch (error) {
      console.error('[Auth] Firebase registration error:', error);
      return {
        success: false,
        message: getFirebaseErrorMessage(error)
      };
    }
  }
  
  /**
   * ユーザー登録（Firebase優先）
   * 注意: signup.htmlから呼び出される場合は、customerロールで登録されます
   * 他のロール（staff, concierge, adminなど）は管理者が登録する必要があります
   */
  async function register(email, password, name = null, role = 'customer') {
    // Firebase Authenticationが利用可能な場合はFirebaseを使用
    if (window.FirebaseAuth) {
      return await registerWithFirebase(email, password, name, role);
    }
    
    // フォールバック: クライアントサイド登録（localStorageなど）
    // 将来的に実装可能
    return {
      success: false,
      message: 'ユーザー登録機能は現在利用できません。Firebase Authenticationを設定してください。'
    };
  }
  
  /**
   * 認証チェック
   */
  function checkAuth() {
    // Firebase Authenticationの認証状態をチェック
    if (window.FirebaseAuth) {
      const currentUser = window.FirebaseAuth.currentUser;
      if (currentUser) {
        // Firebase認証済みの場合、sessionStorageにも保存されているか確認
        const authData = getAuthData();
        if (authData) {
          return true;
        }
        // sessionStorageにない場合は、Firebaseから情報を取得して保存
        // これは非同期処理なので、ここでは簡易的にtrueを返す
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
    
    // パブリックページ（index.html, service.html, recruit.html）は常にアクセス可能
    if (normalizedPath === '/index.html' || normalizedPath === '/service.html' || normalizedPath.startsWith('/service/') || 
        normalizedPath === '/recruit.html' || normalizedPath.startsWith('/recruit/')) {
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
  
  /**
   * メール確認の再送信
   */
  async function resendEmailVerification() {
    if (!window.FirebaseAuth) {
      return {
        success: false,
        message: 'Firebase Authenticationが利用できません。'
      };
    }
    
    const currentUser = window.FirebaseAuth.currentUser;
    if (!currentUser) {
      return {
        success: false,
        message: 'ログインしていません。'
      };
    }
    
    try {
      await currentUser.sendEmailVerification();
      console.log('[Auth] Email verification resent to:', currentUser.email);
      return {
        success: true,
        message: '確認メールを再送信しました。メールボックスをご確認ください。'
      };
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
