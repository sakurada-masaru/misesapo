/**
 * AWS Cognito認証処理
 * 従業員用認証システム
 */

(function() {
  'use strict';

  // AWS SDKの読み込みを確認
  if (typeof AWS === 'undefined' || typeof AmazonCognitoIdentity === 'undefined') {
    console.error('[CognitoAuth] AWS SDKが読み込まれていません');
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
   * ログイン
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
        onSuccess: function(result) {
          // トークンを保存
          const idToken = result.getIdToken().getJwtToken();
          const accessToken = result.getAccessToken().getJwtToken();
          const refreshToken = result.getRefreshToken().getToken();

          localStorage.setItem('cognito_id_token', idToken);
          localStorage.setItem('cognito_access_token', accessToken);
          localStorage.setItem('cognito_refresh_token', refreshToken);

          // ユーザー情報を取得
          const payload = result.getIdToken().payload;
          const user = {
            id: payload.sub,
            email: payload.email,
            name: payload.name || payload.email.split('@')[0],
            role: payload['custom:role'] || 'staff',
            department: payload['custom:department'] || ''
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

      cognitoUser.getSession(function(err, session) {
        if (err || !session.isValid()) {
          resolve(null);
          return;
        }

        const idToken = session.getIdToken();
        const payload = idToken.payload;
        const user = {
          id: payload.sub,
          email: payload.email,
          name: payload.name || payload.email.split('@')[0],
          role: payload['custom:role'] || 'staff',
          department: payload['custom:department'] || ''
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
    const errorCode = error.code || error.name;
    const errorMessages = {
      'NotAuthorizedException': 'メールアドレスまたはパスワードが正しくありません',
      'UserNotFoundException': 'ユーザーが見つかりません',
      'UserNotConfirmedException': 'メールアドレスが確認されていません',
      'PasswordResetRequiredException': 'パスワードのリセットが必要です',
      'TooManyRequestsException': 'リクエストが多すぎます。しばらく待ってから再度お試しください',
      'LimitExceededException': '試行回数の上限に達しました。しばらく待ってから再度お試しください'
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

