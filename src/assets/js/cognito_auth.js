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
   * ログアウト
   */
  function logout() {
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser) {
      cognitoUser.signOut();
    }

    // トークンを削除
    localStorage.removeItem('cognito_id_token');
    localStorage.removeItem('cognito_access_token');
    localStorage.removeItem('cognito_refresh_token');
    localStorage.removeItem('cognito_user');
  }

  /**
   * 現在のユーザーを取得
   */
  function getCurrentUser() {
    return new Promise((resolve, reject) => {
      const cognitoUser = userPool.getCurrentUser();
      if (!cognitoUser) {
        resolve(null);
        return;
      }

      cognitoUser.getSession(async function (err, session) {
        if (err || !session.isValid()) {
          resolve(null);
          return;
        }

        const idToken = session.getIdToken();
        const payload = idToken.payload;
        const cognitoSub = payload.sub;
        const userEmail = payload.email;

        // ユーザー情報を取得（DynamoDBから確実に取得）
        let userInfo = null;
        const apiBaseUrl = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';

        try {
          // キャッシュを無効化するためにタイムスタンプを追加
          const timestamp = new Date().getTime();

          // まずメールアドレスで検索（キャッシュ無効化）
          if (userEmail) {
            const emailResponse = await fetch(`${apiBaseUrl}/workers?email=${encodeURIComponent(userEmail)}&t=${timestamp}&_=${Date.now()}`, {
              cache: 'no-store'
            });
            if (emailResponse.ok) {
              const workers = await emailResponse.json();
              const workersArray = Array.isArray(workers) ? workers : (workers.items || workers.workers || []);
              if (workersArray.length > 0) {
                // クライアント側でフィルタリング
                const matchingUser = workersArray.find(u => u.email && u.email.toLowerCase() === userEmail.toLowerCase());
                if (matchingUser && matchingUser.id) {
                  userInfo = matchingUser;
                  console.log('[CognitoAuth] Found user by email from DynamoDB:', userInfo.name, 'ID:', userInfo.id);
                }
              }
            }
          }

          // メールアドレスで見つからない場合、Cognito Subで検索
          if (!userInfo && cognitoSub) {
            const subResponse = await fetch(`${apiBaseUrl}/workers?cognito_sub=${encodeURIComponent(cognitoSub)}&t=${timestamp}&_=${Date.now()}`, {
              cache: 'no-store'
            });
            if (subResponse.ok) {
              const workers = await subResponse.json();
              const workersArray = Array.isArray(workers) ? workers : (workers.items || workers.workers || []);
              if (workersArray.length > 0) {
                // クライアント側でフィルタリング
                const matchingUser = workersArray.find(u => u.cognito_sub === cognitoSub);
                if (matchingUser && matchingUser.id) {
                  userInfo = matchingUser;
                  console.log('[CognitoAuth] Found user by cognito_sub from DynamoDB:', userInfo.name, 'ID:', userInfo.id);
                }
              }
            }
          }

          // まだ見つからない場合、ローカルストレージから取得（フォールバック）
          if (!userInfo) {
            try {
              const storedCognitoUser = localStorage.getItem('cognito_user');
              if (storedCognitoUser) {
                const parsedUser = JSON.parse(storedCognitoUser);
                if (parsedUser.id && parsedUser.id !== cognitoSub) {
                  // ローカルストレージのIDがcognitoSubでない場合、そのIDで再検索
                  const idResponse = await fetch(`${apiBaseUrl}/workers/${parsedUser.id}?t=${timestamp}&_=${Date.now()}`, {
                    cache: 'no-store'
                  });
                  if (idResponse.ok) {
                    userInfo = await idResponse.json();
                    console.log('[CognitoAuth] Found user by stored ID from DynamoDB:', userInfo.name, 'ID:', userInfo.id);
                  }
                }
              }
            } catch (localError) {
              console.warn('[CognitoAuth] Could not use stored user info:', localError);
            }
          }
        } catch (error) {
          console.error('[CognitoAuth] Error fetching user info from DynamoDB:', error);
        }

        // ユーザー情報が取得できない場合は警告（ログイン時ではないため、エラーにはしない）
        if (!userInfo || !userInfo.id) {
          console.warn('[CognitoAuth] User not found in DynamoDB. Email:', userEmail, 'CognitoSub:', cognitoSub);
          // ローカルストレージから取得を試みる（最後のフォールバック）
          try {
            const storedCognitoUser = localStorage.getItem('cognito_user');
            if (storedCognitoUser) {
              const parsedUser = JSON.parse(storedCognitoUser);
              if (parsedUser.id) {
                resolve(parsedUser);
                return;
              }
            }
          } catch (e) {
            console.warn('[CognitoAuth] Could not parse stored user:', e);
          }
          // それでも見つからない場合はnullを返す
          resolve(null);
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

        resolve(user);
      });
    });
  }

  /**
   * ID Tokenを取得
   */
  function getIdToken() {
    return localStorage.getItem('cognito_id_token');
  }

  /**
   * 認証状態をチェック
   */
  function isAuthenticated() {
    // まず、localStorageにトークンがあるかチェック
    const idToken = getIdToken();
    if (!idToken) {
      console.log('[CognitoAuth] No ID token found in localStorage');
      return false;
    }

    // トークンの有効期限をチェック
    try {
      const payload = JSON.parse(atob(idToken.split('.')[1]));
      const exp = payload.exp * 1000; // ミリ秒に変換
      const isValid = Date.now() < exp;
      if (!isValid) {
        console.log('[CognitoAuth] ID token expired');
        // 期限切れのトークンを削除
        localStorage.removeItem('cognito_id_token');
        localStorage.removeItem('cognito_access_token');
        localStorage.removeItem('cognito_refresh_token');
        return false;
      }

      // トークンが有効な場合、Cognitoのセッションも確認
      const cognitoUser = userPool.getCurrentUser();
      if (!cognitoUser) {
        console.log('[CognitoAuth] No Cognito user found, but token exists');
        // トークンはあるがCognitoユーザーがない場合は、トークンが無効とみなす
        return false;
      }

      return true;
    } catch (e) {
      console.warn('[CognitoAuth] Error parsing token:', e);
      return false;
    }
  }

  /**
   * Cognitoエラーメッセージを日本語に変換
   */
  function getCognitoErrorMessage(error) {
    const errorCode = error.code || error.name || error.__type;
    const errorMessages = {
      'NotAuthorizedException': 'メールアドレスまたはパスワードが正しくありません',
      'UserNotFoundException': 'ユーザーが見つかりません',
      'UserNotConfirmedException': 'メールアドレスが確認されていません',
      'PasswordResetRequiredException': 'パスワードのリセットが必要です',
      'TooManyRequestsException': 'リクエストが多すぎます。しばらく待ってから再度お試しください',
      'LimitExceededException': '試行回数の上限に達しました。しばらく待ってから再度お試しください',
      'InvalidParameterException': error.message || 'パラメータが無効です',
      'InvalidPasswordException': 'パスワードが正しくありません'
    };

    return errorMessages[errorCode] || error.message || 'ログインに失敗しました';
  }

  /**
   * パスワード変更
   */
  async function changePassword(oldPassword, newPassword) {
    return new Promise((resolve, reject) => {
      const cognitoUser = userPool.getCurrentUser();
      if (!cognitoUser) {
        reject({
          success: false,
          message: 'ユーザーがログインしていません'
        });
        return;
      }

      cognitoUser.getSession((err, session) => {
        if (err || !session.isValid()) {
          reject({
            success: false,
            message: 'セッションが無効です。再ログインしてください。'
          });
          return;
        }

        cognitoUser.changePassword(oldPassword, newPassword, (err, result) => {
          if (err) {
            console.error('[CognitoAuth] Change password error:', err);
            reject({
              success: false,
              message: getCognitoErrorMessage(err)
            });
            return;
          }
          resolve({
            success: true,
            message: 'パスワードを変更しました'
          });
        });
      });
    });
  }

  // グローバルに公開
  window.CognitoAuth = {
    login: login,
    logout: logout,
    getCurrentUser: getCurrentUser,
    getIdToken: getIdToken,
    isAuthenticated: isAuthenticated,
    changePassword: changePassword
  };

})();

