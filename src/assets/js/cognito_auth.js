/**
 * AWS Cognito認証処理
 * 従業員用認証システム
 */

(function() {
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
   * ログイン（USER_SRP_AUTHを使用）
   */
  async function login(email, password) {
    return new Promise((resolve, reject) => {
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
        onSuccess: async function(result) {
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
          
          // DynamoDBからユーザー情報を取得（Cognito Subで検索）
          let userInfo = null;
          try {
            const apiBaseUrl = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';
            const response = await fetch(`${apiBaseUrl}/workers?cognito_sub=${encodeURIComponent(cognitoSub)}`);
            if (response.ok) {
              const workers = await response.json();
              const workersArray = Array.isArray(workers) ? workers : (workers.items || workers.workers || []);
              if (workersArray.length > 0) {
                userInfo = workersArray[0];
              }
            }
          } catch (error) {
            console.warn('[CognitoAuth] Could not fetch user info from DynamoDB:', error);
          }
          
          const user = {
            id: userInfo ? userInfo.id : cognitoSub,  // DynamoDBのID（重要！）
            cognito_sub: cognitoSub,  // Cognito Sub
            email: payload.email,
            name: userInfo ? userInfo.name : payload.email.split('@')[0],  // DynamoDBから取得、フォールバックはメールアドレスのローカル部分
            role: userInfo ? userInfo.role : (payload['custom:role'] || 'staff'),  // DynamoDBから取得、フォールバックはCognito属性
            department: userInfo ? userInfo.department : (payload['custom:department'] || '')  // DynamoDBから取得、フォールバックはCognito属性
          };

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
        onFailure: function(err) {
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

      cognitoUser.getSession(async function(err, session) {
        if (err || !session.isValid()) {
          resolve(null);
          return;
        }

        const idToken = session.getIdToken();
        const payload = idToken.payload;
        const cognitoSub = payload.sub;
        const userEmail = payload.email;
        
        // ユーザー情報を取得（ローカルJSONを優先、APIをフォールバック）
        let userInfo = null;
        const apiBaseUrl = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';
        
        try {
          // キャッシュを無効化するためにタイムスタンプを追加
          const timestamp = new Date().getTime();
          
          // まずAWS APIから最新データを取得
          if (userEmail) {
            const emailResponse = await fetch(`${apiBaseUrl}/workers?email=${encodeURIComponent(userEmail)}&t=${timestamp}&_=${Date.now()}`, {
              cache: 'no-store'
            });
            if (emailResponse.ok) {
              const workers = await emailResponse.json();
              const workersArray = Array.isArray(workers) ? workers : (workers.items || workers.workers || []);
              if (workersArray.length > 0) {
                // APIがフィルタリングしない場合に備えてクライアント側でもフィルタリング
                const matchingUser = workersArray.find(u => u.email && u.email.toLowerCase() === userEmail.toLowerCase());
                if (matchingUser) {
                  userInfo = matchingUser;
                  console.log('[CognitoAuth] Found user by email from API:', userInfo.name);
                }
              }
            }
          }
          
          // APIで取得できない場合のみ、ローカルのworkers.jsonをフォールバックとして使用
          if (!userInfo && userEmail) {
            console.warn('[CognitoAuth] API取得に失敗、ローカルのworkers.jsonを試行');
            try {
              const localResponse = await fetch(`/data/workers.json?t=${timestamp}&_=${Date.now()}`, {
                cache: 'no-store'
              });
              if (localResponse.ok) {
                const localWorkers = await localResponse.json();
                if (Array.isArray(localWorkers) && localWorkers.length > 0) {
                  const matchingUser = localWorkers.find(u => u.email && u.email.toLowerCase() === userEmail.toLowerCase());
                  if (matchingUser) {
                    userInfo = matchingUser;
                    console.log('[CognitoAuth] Found user from local data (fallback):', userInfo.name);
                  }
                }
              }
            } catch (localError) {
              console.log('[CognitoAuth] Local workers.json also not available');
            }
          }
          
          // まだ見つからない場合、Cognito Subで検索
          if (!userInfo && cognitoSub) {
            const subResponse = await fetch(`${apiBaseUrl}/workers?cognito_sub=${encodeURIComponent(cognitoSub)}`);
            if (subResponse.ok) {
              const workers = await subResponse.json();
              const workersArray = Array.isArray(workers) ? workers : (workers.items || workers.workers || []);
              if (workersArray.length > 0) {
                // クライアント側でフィルタリング
                const matchingUser = workersArray.find(u => u.cognito_sub === cognitoSub);
                if (matchingUser) {
                  userInfo = matchingUser;
                  console.log('[CognitoAuth] Found user by cognito_sub:', userInfo.name);
                }
              }
            }
          }
        } catch (error) {
          console.warn('[CognitoAuth] Could not fetch user info:', error);
        }
        
        const user = {
          id: userInfo ? userInfo.id : cognitoSub,  // DynamoDBのID（重要！）
          cognito_sub: cognitoSub,  // Cognito Sub
          email: userEmail,
          name: userInfo ? userInfo.name : userEmail.split('@')[0],  // DynamoDBから取得、フォールバックはメールアドレスのローカル部分
          role: userInfo ? userInfo.role : (payload['custom:role'] || 'staff'),  // DynamoDBから取得、フォールバックはCognito属性
          department: userInfo ? userInfo.department : (payload['custom:department'] || '')  // DynamoDBから取得、フォールバックはCognito属性
        };

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
    const idToken = getIdToken();
    if (!idToken) {
      return false;
    }

    // トークンの有効期限をチェック（簡易版）
    try {
      const payload = JSON.parse(atob(idToken.split('.')[1]));
      const exp = payload.exp * 1000; // ミリ秒に変換
      return Date.now() < exp;
    } catch (e) {
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

  // グローバルに公開
  window.CognitoAuth = {
    login: login,
    logout: logout,
    getCurrentUser: getCurrentUser,
    getIdToken: getIdToken,
    isAuthenticated: isAuthenticated
  };

})();

