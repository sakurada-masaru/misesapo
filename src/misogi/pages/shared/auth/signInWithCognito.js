/**
 * Cognito でサインインし、トークンとユーザー情報を localStorage に保存する。
 * 既存サインイン (src/pages/staff/signin.html + cognito_auth.js) と同様に
 * window.AmazonCognitoIdentity と window.CognitoConfig（index.html で CDN 読み込み）を使用。
 */

// ブラウザ直叩きは CORS で死ぬので、dev/prod ともに同一オリジン相対を正とする。
// Vite 側では `/api-jinzai` を API Gateway にプロキシする。
const JINZAI_API_BASE = '/api-jinzai';

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

function toArray(v) {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  return [v];
}

function inferRoleFromJinzai(item) {
  const yakuwari = toArray(item?.yakuwari).map((v) => String(v || '').trim().toLowerCase()).filter(Boolean);
  const yset = new Set(yakuwari);
  if (yset.has('admin')) return 'admin';
  if (yset.has('sales')) return 'sales';
  if (yset.has('dev') || yset.has('developer') || yset.has('engineering')) return 'dev';
  if (yset.has('office') || yset.has('leader')) return 'office';
  if (yset.has('cleaning') || yset.has('staff')) return 'cleaning';

  const shokushu = toArray(item?.shokushu).map((v) => String(v || '').trim().toLowerCase()).filter(Boolean);
  const codeSet = new Set(shokushu);

  if (codeSet.has('keiei')) return 'admin';
  if (codeSet.has('eigyo')) return 'sales';
  if (codeSet.has('engineer') || codeSet.has('design')) return 'dev';
  if (codeSet.has('seisou') || codeSet.has('maintenance')) return 'cleaning';
  if (codeSet.has('operator') || codeSet.has('jimu') || codeSet.has('keiri') || codeSet.has('jinji')) return 'office';
  return 'office';
}

function inferDeptFromRole(role) {
  const r = String(role || '').trim().toLowerCase();
  if (r === 'admin') return 'ADMIN';
  if (r === 'sales') return 'SALES';
  if (r === 'dev' || r === 'developer') return 'ENGINEERING';
  if (r === 'cleaning' || r === 'staff') return 'CLEANING';
  return 'OFFICE';
}

/**
 * jinzai-data API から cognito_sub / email でログイン人材を引き当てる。
 */
async function fetchJinzaiFromApi(idToken, userEmail, cognitoSub) {
  const base = JINZAI_API_BASE.replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${String(idToken).trim()}` };
  const listRes = await fetch(`${base}/jinzai?limit=1000&jotai=yuko`, { cache: 'no-store', headers });
  if (!listRes.ok) {
    throw new Error(`JINZAI_LIST_HTTP_${listRes.status}`);
  }
  const listData = await listRes.json();
  const items = Array.isArray(listData) ? listData : (listData.items || []);

  const normalizedEmail = String(userEmail || '').trim().toLowerCase();
  const match = items.find((u) => {
    const e = String(u?.email || '').trim().toLowerCase();
    if (cognitoSub && u?.cognito_sub && String(u.cognito_sub) === String(cognitoSub)) return true;
    if (normalizedEmail && e && e === normalizedEmail) return true;
    return false;
  });
  if (!match || !match.jinzai_id) return null;

  let bushoNames = [];
  try {
    const bushoRes = await fetch(`${base}/jinzai/busho?limit=1000&jotai=yuko`, { cache: 'no-store', headers });
    if (bushoRes.ok) {
      const bushoData = await bushoRes.json();
      const bushoItems = Array.isArray(bushoData) ? bushoData : (bushoData.items || []);
      const bushoMap = new Map(bushoItems.map((b) => [String(b.busho_id || ''), b.name || '']));
      bushoNames = toArray(match.busho_ids).map((id) => bushoMap.get(String(id))).filter(Boolean);
    }
  } catch {
    bushoNames = [];
  }

  const role = inferRoleFromJinzai(match);
  const dept = inferDeptFromRole(role);
  const displayName = match.name || (normalizedEmail ? normalizedEmail.split('@')[0] : 'user');

  return {
    id: match.jinzai_id,
    jinzai_id: match.jinzai_id,
    worker_id: match.jinzai_id,
    sagyouin_id: match.jinzai_id,
    cognito_sub: cognitoSub || match.cognito_sub || '',
    email: match.email || userEmail || '',
    name: displayName,
    role,
    roles: [role],
    dept,
    department: dept,
    busho_ids: toArray(match.busho_ids),
    busho_names: bushoNames,
    yakuwari: toArray(match.yakuwari),
    shokushu: toArray(match.shokushu),
    koyou_kubun: match.koyou_kubun || '',
  };
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
          userInfo = await fetchJinzaiFromApi(idToken, userEmail, cognitoSub);
        } catch (e) {
          console.error('[signInWithCognito] fetch user error:', e);
          resolve({ success: false, message: '人材情報（jinzai）の取得に失敗しました。しばらく待ってから再度お試しください。' });
          return;
        }

        if (!userInfo || !userInfo.jinzai_id) {
          resolve({ success: false, message: '人材情報（jinzai）が見つかりません。管理者にお問い合わせください。' });
          return;
        }
        const user = userInfo;

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
