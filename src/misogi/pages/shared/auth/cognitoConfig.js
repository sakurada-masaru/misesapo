/**
 * Cognito User Pool 設定（misogi 用）
 * 環境変数 VITE_COGNITO_USER_POOL_ID / VITE_COGNITO_CLIENT_ID があれば使用、なければ既存のデフォルト。
 */

const DEFAULT_USER_POOL_ID = 'ap-northeast-1_EDKElIGoC';
const DEFAULT_CLIENT_ID = '25abe85ibm5hn6rrsokd5jssb5';

export const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID ?? DEFAULT_USER_POOL_ID;
export const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID ?? DEFAULT_CLIENT_ID;
export const region = import.meta.env.VITE_COGNITO_REGION ?? 'ap-northeast-1';

export const poolData = {
  UserPoolId: userPoolId,
  ClientId: clientId,
};
