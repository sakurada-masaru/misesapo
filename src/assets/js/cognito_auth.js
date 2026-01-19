/**
 * AWS Cognito認証処理
 * 従業員用認証システム
 */

(function () {
  'use strict';

  // AWS SDKの読み込みを確認
  if (typeof AmazonCognitoIdentity === 'undefined') {
    console.error('[CognitoAuth] Amazon Cognito Identity JSが読み込まれていません');
    return;
  }

  // Cognito設定
  const config = window.CognitoConfig || {};
  const region = config.region || 'ap-northeast-1';
  const userPoolId = config.userPoolId;
  const clientId = config.clientId;

  if (!userPoolId || !clientId) {
    console.error('[CognitoAuth] Cognito設定が不完全です');
    return;
  }

  // User Poolの設定
  const poolData = {
    UserPoolId: userPoolId,
    ClientId: clientId
  };
  const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

  /**
   * 既存の認証情報をクリア
   */
  function clearAuthData() {
    // Cognitoセッションをクリア
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser) {
      cognitoUser.signOut();
    }

    // localStorageから認証情報を削除
    localStorage.removeItem('cognito_id_token');
    localStorage.removeItem('cognito_access_token');
    localStorage.removeItem('cognito_refresh_token');
    localStorage.removeItem('cognito_user');
    localStorage.removeItem('misesapo_auth');

    // sessionStorageもクリア
    sessionStorage.clear();
  }

  /**
   * 既存のユーザー情報を取得（ログイン前のチェック用）
   */
  function getExistingUser() {
    try {
      const storedUser = localStorage.getItem('cognito_user');
      if (storedUser) {
        return JSON.parse(storedUser);
      }
    } catch (e) {
      console.warn('[CognitoAuth] Error parsing stored user:', e);
    }
    return null;
  }

  /**
   * ログイン（USER_SRP_AUTHを使用）
   */
  async function login(email, password) {
    return new Promise(async (resolve, reject) => {
      // 既存のユーザー情報をチェック
      const existingUser = getExistingUser();
      const isAuth = isAuthenticated();

      // 既に別のユーザーでログインしている場合
      if (existingUser && isAuth) {
        const existingEmail = existingUser.email;
        if (existingEmail && existingEmail.toLowerCase() !== email.toLowerCase()) {
          // 既存の認証情報をクリア
          clearAuthData();

          // 少し待ってから再試行を促す
          reject({
            success: false,
            message: '別のユーザーでログイン中です。認証情報をクリアしました。数秒待ってから再度ログインしてください。',
            code: 'AUTH_CONFLICT',
            requiresRetry: true
          });
          return;
        }
      }

      // 既存の認証情報をクリア（同じユーザーでも念のため）
      clearAuthData();

      // 少し待ってからログイン処理を開始（クリア処理の完了を待つ）
      await new Promise(resolve => setTimeout(resolve, 100));

      const authenticationData = {
        Username: email,
        Password: password
      };
      const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails(authenticationData);

      const userData = {
        Username: email,
        Pool: userPool
      };
      const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: async function (result) {
          // トークンを保存
          const idToken = result.getIdToken().getJwtToken();
          const accessToken = result.getAccessToken().getJwtToken();
          const refreshToken = result.getRefreshToken().getToken();

          localStorage.setItem('cognito_id_token', idToken);
          localStorage.setItem('cognito_access_token', accessToken);
          localStorage.setItem('cognito_refresh_token', refreshToken);

          // ユーザー情報を取得
          const payload = result.getIdToken().payload;
          const cognitoSub = payload.sub;
          const userEmail = payload.email;

          // DynamoDBからユーザー情報を取得（メールアドレスとCognito Subの両方で検索）
          let userInfo = null;
          const apiBaseUrl = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';
          const timestamp = new Date().getTime();

          try {
            // まずメールアドレスで検索（キャッシュ無効化）
            if (userEmail) {
              console.log('[CognitoAuth] Searching for user by email:', userEmail);
              const emailResponse = await fetch(`${apiBaseUrl}/workers?email=${encodeURIComponent(userEmail)}&t=${timestamp}&_=${Date.now()}`, {
                cache: 'no-store'
              });
              console.log('[CognitoAuth] Email search response status:', emailResponse.status);
              if (emailResponse.ok) {
                const workers = await emailResponse.json();
                console.log('[CognitoAuth] Email search response:', workers);
                const workersArray = Array.isArray(workers) ? workers : (workers.items || workers.workers || []);
                console.log('[CognitoAuth] Workers array length:', workersArray.length);
                if (workersArray.length > 0) {
                  // クライアント側でフィルタリング
                  const matchingUser = workersArray.find(u => u.email && u.email.toLowerCase() === userEmail.toLowerCase());
                  console.log('[CognitoAuth] Matching user by email:', matchingUser);
                  if (matchingUser && matchingUser.id) {
                    userInfo = matchingUser;
                    console.log('[CognitoAuth] Found user by email from DynamoDB:', userInfo.name, 'ID:', userInfo.id);
                  } else {
                    console.warn('[CognitoAuth] No matching user found by email in response');
                  }
                } else {
                  console.warn('[CognitoAuth] Empty workers array from email search');
                }
              } else {
                console.warn('[CognitoAuth] Email search failed with status:', emailResponse.status);
              }
            }

            // メールアドレスで見つからない場合、Cognito Subで検索
            if (!userInfo && cognitoSub) {
              console.log('[CognitoAuth] Searching for user by cognito_sub:', cognitoSub);
              const subResponse = await fetch(`${apiBaseUrl}/workers?cognito_sub=${encodeURIComponent(cognitoSub)}&t=${timestamp}&_=${Date.now()}`, {
                cache: 'no-store'
              });
              console.log('[CognitoAuth] Cognito sub search response status:', subResponse.status);
              if (subResponse.ok) {
                const workers = await subResponse.json();
                console.log('[CognitoAuth] Cognito sub search response:', workers);
                const workersArray = Array.isArray(workers) ? workers : (workers.items || workers.workers || []);
                console.log('[CognitoAuth] Workers array length:', workersArray.length);
                if (workersArray.length > 0) {
                  // クライアント側でフィルタリング
                  const matchingUser = workersArray.find(u => u.cognito_sub === cognitoSub);
                  console.log('[CognitoAuth] Matching user by cognito_sub:', matchingUser);
                  if (matchingUser && matchingUser.id) {
                    userInfo = matchingUser;
                    console.log('[CognitoAuth] Found user by cognito_sub from DynamoDB:', userInfo.name, 'ID:', userInfo.id);
                  } else {
                    console.warn('[CognitoAuth] No matching user found by cognito_sub in response');
                  }
                } else {
                  console.warn('[CognitoAuth] Empty workers array from cognito_sub search');
                }
              } else {
                console.warn('[CognitoAuth] Cognito sub search failed with status:', subResponse.status);
              }
            }
          } catch (error) {
            console.error('[CognitoAuth] Error fetching user info from DynamoDB:', error);
            reject({
              success: false,
              message: 'ユーザー情報の取得に失敗しました。しばらく待ってから再度お試しください。'
            });
            return;
          }

          // ユーザー情報が取得できない場合はエラー
          if (!userInfo || !userInfo.id) {
            console.error('[CognitoAuth] User not found in DynamoDB. Email:', userEmail, 'CognitoSub:', cognitoSub);
            reject({
              success: false,
              message: 'ユーザー情報が見つかりません。管理者にお問い合わせください。'
            });
            return;
          }

          // DynamoDBから取得したIDを使用（重要！）
          const user = {
            id: userInfo.id,  // DynamoDBのID（必須）
            cognito_sub: cognitoSub,  // Cognito Sub
            email: userInfo.email || userEmail,
            name: userInfo.name || userEmail.split('@')[0],
            role: userInfo.role || (payload['custom:role'] || 'staff'),
            department: userInfo.department || (payload['custom:department'] || '')
          };

          // ユーザー情報をlocalStorageに保存（確実にIDを保存）
          localStorage.setItem('cognito_user', JSON.stringify(user));

          resolve({
            success: true,
            user: user,
            tokens: {
              idToken: idToken,
              accessToken: accessToken,
              refreshToken: refreshToken
            }
          });
        },
        onFailure: function (err) {
          console.error('[CognitoAuth] Login error:', err);
          reject({
            success: false,
            message: getCognitoErrorMessage(err)
          });
        }
      });
    });
  }

  /**
   * 認証ガード（セッションチェック）
   * @param {string} redirectUrl - 認証切れ時のリダイレクト先
   * @param {string[]} excludePaths - チェックを除外するパス（無限ループ防止）
   */
  async function guard(redirectUrl = '/entrance.html', excludePaths = ['/entrance.html', '/staff/signin.html', '/signup.html']) {
    const currentPath = window.location.pathname;

    // 除外パスなら何もしない
    if (excludePaths.some(path => currentPath.includes(path))) {
      return true;
    }

    const isAuth = isAuthenticated();
    if (!isAuth) {
      console.warn('[CognitoAuth] Guard: Unauthorized access to', currentPath);
      // セッション切れなので、クリーンアップしてリダイレクト
      await logout(redirectUrl);
      return false;
    }
    return true;
  }

  /**
   * ログアウト（完全クリーンアップ）
   * @param {string} redirectUrl - ログアウト後のリダイレクト先
   */
  async function logout(redirectUrl = '/entrance.html') {
    console.log('[CognitoAuth] Logging out...');

    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser) {
      try {
        cognitoUser.signOut();
      } catch (e) {
        console.warn('SignOut error:', e);
      }
    }

    // 既知の認証系キーを全て削除（ゾンビデータ対策）
    const keysToRemove = [
      'cognito_id_token',
      'cognito_access_token',
      'cognito_refresh_token',
      'cognito_user',
      'misesapo_auth',
      'lastAttendanceCheckDate',
      'misesapo_context', // コンテキスト用
      'current_mode'      // モード用
    ];

    keysToRemove.forEach(key => localStorage.removeItem(key));
    sessionStorage.clear();

    // リダイレクト（現在地がリダイレクト先でない場合のみ）
    if (redirectUrl && window.location.pathname !== redirectUrl) {
      window.location.href = redirectUrl;
    }
  }

  /**
   * ユーザー情報を解析してロールを取得（ヘルパー）
   */
  function getUserRole(user) {
    if (!user) return 'guest';
    // role プロパティ > department からの推論
    if (user.role) return user.role.toLowerCase();

    if (user.department) {
      const dept = user.department.toLowerCase();
      if (dept.includes('開発') || dept.includes('developer')) return 'developer';
      if (dept.includes('事務') || dept.includes('office') || dept.includes('経理')) return 'office';
      if (dept.includes('営業') || dept.includes('sales')) return 'sales';
      if (dept.includes('清掃') || dept.includes('clean') || dept.includes('os')) return 'cleaner';
    }
    return 'staff'; // デフォルト
  }

  /**
   * 現在のユーザー情報を取得
   */
  async function getCurrentUser() {
    return new Promise((resolve) => {
      const cognitoUser = userPool.getCurrentUser();

      if (cognitoUser != null) {
        cognitoUser.getSession(async function (err, session) {
          if (err) {
            resolve(null);
            return;
          }

          // localStorageからユーザー情報を取得
          const storedUser = localStorage.getItem('cognito_user');
          if (storedUser) {
            try {
              resolve(JSON.parse(storedUser));
            } catch (e) {
              resolve(null);
            }
          } else {
            // セッションから最低限の情報を構築
            const idToken = session.getIdToken().getJwtToken();
            const payload = session.getIdToken().decodePayload();
            resolve({
              email: payload.email,
              sub: payload.sub
            });
          }
        });
      } else {
        resolve(null);
      }
    });
  }

  /**
   * IDトークンを取得
   */
  function getIdToken() {
    return localStorage.getItem('cognito_id_token');
  }

  /**
   * 認証済みかどうか判定
   */
  function isAuthenticated() {
    const token = localStorage.getItem('cognito_id_token');
    return !!token;
  }

  /**
   * パスワード変更
   */
  function changePassword(oldPassword, newPassword) {
    return new Promise((resolve, reject) => {
      const cognitoUser = userPool.getCurrentUser();
      if (!cognitoUser) {
        reject({ message: 'ユーザーがログインしていません' });
        return;
      }

      cognitoUser.getSession(function (err, session) {
        if (err) {
          reject(err);
          return;
        }

        cognitoUser.changePassword(oldPassword, newPassword, function (err, result) {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });
    });
  }

  /**
   * エラーメッセージの変換
   */
  function getCognitoErrorMessage(err) {
    if (err.code === 'UserNotFoundException') {
      return 'ユーザーが見つかりません。';
    } else if (err.code === 'NotAuthorizedException') {
      return 'メールアドレスまたはパスワードが間違っています。';
    } else if (err.code === 'UserNotConfirmedException') {
      return 'アカウントが確認されていません。メールを確認してください。';
    } else if (err.code === 'PasswordResetRequiredException') {
      return 'パスワードのリセットが必要です。';
    } else {
      return err.message || 'ログイン中にエラーが発生しました。';
    }
  }

  // グローバルに公開
  window.CognitoAuth = {
    login: login,
    logout: logout,
    getCurrentUser: getCurrentUser,
    getIdToken: getIdToken,
    isAuthenticated: isAuthenticated,
    changePassword: changePassword,
    guard: guard,
    getUserRole: getUserRole
  };

})();

