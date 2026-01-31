/**
 * 認証状態フック（後で Cognito 接続）
 * @returns {{ user: object | null, isAuthenticated: boolean, isLoading: boolean, login: fn, logout: fn }}
 */
export function useAuth() {
  // TODO: Cognito / セッション接続
  return {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: async () => {},
    logout: () => {},
  };
}
