/**
 * Cognito でサインインし、トークンとユーザー情報を localStorage に保存する。
 * 既存サインイン (src/pages/staff/signin.html + cognito_auth.js) と同様に
 * window.AmazonCognitoIdentity と window.CognitoConfig（index.html で CDN 読み込み）を使用。
 */

const API_BASE =
  (typeof window !== 'undefined' && window.location?.hostname === 'localhost') || import.meta.env.DEV
    ? '/api'
    : (import.meta.env.VITE_API_BASE ?? '/api');

/** 既存 signin.html と同様: window.CognitoConfig（index.html で設定）またはデフォルト */
function getPoolData() {
  const config = typeof window !== 'undefined' && window.CognitoConfig;
  if (config && config.userPoolId && config.clientId) {
    return { UserPoolId: config.userPoolId, ClientId: config.clientId };
  }
  return {
    UserPoolId: 'ap-northeast-1_EDKElIGoC',
    ClientId: '25abe85ibm5hn6rrsokd5jssb5',
  };
}

function getCognitoErrorMessage(err) {
  if (!err) return 'ログイン中にエラーが発生しました。';
  const code = err.code || err.name;
  const msg = err.message || '';
  if (code === 'UserNotFoundException') return 'ユーザーが見つかりません。';
  if (code === 'NotAuthorizedException') return 'メールアドレスまたはパスワードが間違っています。';
  if (code === 'UserNotConfirmedException') return 'アカウントが確認されていません。メールを確認してください。';
  if (code === 'PasswordResetRequiredException') return 'パスワードのリセットが必要です。';
  if (code === 'InvalidParameterException') {
    if (msg.includes('secret') || msg.includes('Secret')) {
      return 'Cognito アプリクライアントに「クライアントシークレット」が有効です。ブラウザログイン用にはシークレットなしのアプリクライアントが必要です。';
    }
    return msg || 'リクエストパラメータが不正です。';
  }
  if (code === 'InvalidLambdaResponseException') return '認証処理でエラーが発生しました。';
  if (msg) return `${code || 'Error'}: ${msg}`;
  return 'ログイン中にエラーが発生しました。';
}

/**
 * workers API からメールまたは cognito_sub でユーザーを取得
 */
async function fetchUserFromApi(userEmail, cognitoSub) {
  const base = API_BASE.replace(/\/$/, '');
  const ts = Date.now();

  if (userEmail) {
    const res = await fetch(`${base}/workers?email=${encodeURIComponent(userEmail)}&t=${ts}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      const items = Array.isArray(data) ? data : (data.items || data.workers || []);
      const match = items.find((u) => u.email && u.email.toLowerCase() === userEmail.toLowerCase());
      if (match && match.id) return match;
    }
  }

  if (cognitoSub) {
    const res = await fetch(`${base}/workers?cognito_sub=${encodeURIComponent(cognitoSub)}&t=${ts}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      const items = Array.isArray(data) ? data : (data.items || data.workers || []);
      const match = items.find((u) => u.cognito_sub === cognitoSub);
      if (match && match.id) return match;
    }
  }

  return null;
}

/**
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ success: boolean, user?: object, message?: string }>}
 */
export function signInWithCognito(email, password) {
  return new Promise(async (resolve) => {
    const AmazonCognitoIdentity = typeof window !== 'undefined' && window.AmazonCognitoIdentity;
    if (!AmazonCognitoIdentity) {
      resolve({ success: false, message: 'Cognito SDK が読み込まれていません。ページを再読み込みしてください。' });
      return;
    }
    const poolData = getPoolData();
    const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

    // 既存 cognito_auth.js と同様: ログイン前に既存認証をクリア
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser) cognitoUser.signOut();
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem('cognito_id_token');
      window.localStorage.removeItem('cognito_access_token');
      window.localStorage.removeItem('cognito_refresh_token');
      window.localStorage.removeItem('cognito_user');
      window.localStorage.removeItem('misesapo_auth');
    }
    await new Promise((r) => setTimeout(r, 100));

    const authDetails = new AmazonCognitoIdentity.AuthenticationDetails({
      Username: email,
      Password: password,
    });
    const userData = { Username: email, Pool: userPool };
    const cognitoUserToAuth = new AmazonCognitoIdentity.CognitoUser(userData);

    cognitoUserToAuth.authenticateUser(authDetails, {
      onSuccess: async (result) => {
        const idToken = result.getIdToken().getJwtToken();
        const accessToken = result.getAccessToken().getJwtToken();
        const refreshToken = result.getRefreshToken().getToken();
        const payload = result.getIdToken().payload;
        const cognitoSub = payload.sub;
        const userEmail = payload.email || email;

        let userInfo = null;
        try {
          userInfo = await fetchUserFromApi(userEmail, cognitoSub);
        } catch (e) {
          console.error('[signInWithCognito] fetch user error:', e);
          resolve({ success: false, message: 'ユーザー情報の取得に失敗しました。しばらく待ってから再度お試しください。' });
          return;
        }

        if (!userInfo || !userInfo.id) {
          resolve({ success: false, message: 'ユーザー情報が見つかりません。管理者にお問い合わせください。' });
          return;
        }

        const user = {
          id: userInfo.id,
          cognito_sub: cognitoSub,
          email: userInfo.email || userEmail,
          name: userInfo.name || userEmail.split('@')[0],
          role: userInfo.role || payload['custom:role'] || 'staff',
          department: userInfo.department || payload['custom:department'] || '',
        };

        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem('cognito_id_token', idToken);
          window.localStorage.setItem('cognito_access_token', accessToken);
          window.localStorage.setItem('cognito_refresh_token', refreshToken);
          window.localStorage.setItem('cognito_user', JSON.stringify(user));
        }

        resolve({ success: true, user });
      },
      onFailure: (err) => {
        console.error('[signInWithCognito] Cognito onFailure:', err?.code || err?.name, err?.message, err);
        resolve({ success: false, message: getCognitoErrorMessage(err) });
      },
    });
  });
}
