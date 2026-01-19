/**
 * ユーザーデータ（クライアントサイド認証用）
 * 
 * 注意: このファイルはGitHub Pagesでも動作するように、クライアントサイドのみで認証を処理します。
 * パスワードはSHA-256でハッシュ化されていますが、ハッシュ値がJavaScriptファイルに含まれるため、
 * 本質的にセキュリティ上の制限があります。
 * 
 * 本番環境では、別のバックエンドサービス（Firebase Auth、Auth0など）を使用することを推奨します。
 */

(function() {
  'use strict';
  
  // パスワードをSHA-256でハッシュ化する関数
  async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  // ユーザーデータ（パスワードはSHA-256でハッシュ化）
  // 注意: ハッシュ値はJavaScriptファイルに含まれるため、誰でも見ることができます。
  // これは本質的にセキュリティ上の制限があります。
  const USERS_DATA = [
    {
      id: 1,
      email: 'admin@misesapo.app',
      passwordHash: '521843379b7bcde6e023a7a57a250e939e42cb746517b15b4beaf8df2872776f', // SHA-256ハッシュ
      role: 'admin',
      name: '管理者',
      employee_id: 'ADM001',
      status: 'active',
      created_at: '2024-07-29T00:00:00Z',
      last_login_at: null
    },
    {
      id: 2,
      email: 'keiri@misesapo.app',
      passwordHash: 'e70cd7fbeff451473d62536a465970d873876100c39f3b711f1621fcd7ea9533', // SHA-256ハッシュ
      role: 'admin',
      name: '管理者（経理）',
      employee_id: 'ADM002',
      status: 'active',
      created_at: '2024-07-29T00:00:00Z',
      last_login_at: null
    },
    {
      id: 3,
      email: 'worker@misesapo.app',
      passwordHash: '5929aebf73f07351f0607bf4b67e1349d18e20127e815d9036abfd691147f049', // SHA-256ハッシュ
      role: 'staff',
      name: '清掃員',
      employee_id: 'STF001',
      status: 'active',
      created_at: '2024-07-29T00:00:00Z',
      last_login_at: null
    },
    {
      id: 4,
      email: 'design@misesapo.app',
      passwordHash: 'ccfc8f26ea1b3d9cb9cef047c481d044cec370a54cf3dcb4e70b7f8a2d5742aa', // SHA-256ハッシュ
      role: 'developer',
      name: '開発者',
      employee_id: 'DEV001',
      status: 'active',
      created_at: '2024-07-29T00:00:00Z',
      last_login_at: null
    },
    {
      id: 5,
      email: 'misesapofeedback@gmail.com',
      passwordHash: 'cc47b765dd7aa10ca00baf12a7a6273c7f7bf4973891b81cbef318262ff309b6', // SHA-256ハッシュ
      role: 'concierge',
      name: 'コンシェルジュ',
      employee_id: 'CON001',
      status: 'active',
      created_at: '2024-07-29T00:00:00Z',
      last_login_at: null
    },
    {
      id: 6,
      email: 'info@misesapo.app',
      passwordHash: 'd166479b06bb623bbfbedf676db690af1073289d17e254703f5aa5231b182387', // SHA-256ハッシュ
      role: 'master',
      name: 'マスター',
      employee_id: 'MST001',
      status: 'active',
      created_at: '2024-07-29T00:00:00Z',
      last_login_at: null
    },
    {
      id: 7,
      email: 'masarunospec@gmail.com',
      passwordHash: 'cc47b765dd7aa10ca00baf12a7a6273c7f7bf4973891b81cbef318262ff309b6', // SHA-256ハッシュ
      role: 'master',
      name: 'マスター',
      employee_id: 'MST002',
      status: 'active',
      created_at: '2024-07-29T00:00:00Z',
      last_login_at: null
    },
    {
      id: 8,
      email: 'misesapolemuel@gmail.com',
      passwordHash: 'c843ff42604c4693e4609a1820f50cd132c5128ab0bfcd27361452caac50b0c8', // SHA-256ハッシュ (Misesapo123)
      role: 'staff',
      name: '清掃員（レミュエル）',
      employee_id: 'STF002',
      status: 'active',
      created_at: '2025-01-20T00:00:00Z',
      last_login_at: null
    },
    {
      id: 9,
      email: 'misesapogabi@yahoo.com',
      passwordHash: 'c843ff42604c4693e4609a1820f50cd132c5128ab0bfcd27361452caac50b0c8', // SHA-256ハッシュ (Misesapo123)
      role: 'staff',
      name: '清掃員（ガビ）',
      employee_id: 'STF003',
      status: 'active',
      created_at: '2025-01-20T00:00:00Z',
      last_login_at: null
    },
    {
      id: 10,
      email: 'misesapomatsuoka@yahoo.com',
      passwordHash: 'c843ff42604c4693e4609a1820f50cd132c5128ab0bfcd27361452caac50b0c8', // SHA-256ハッシュ (Misesapo123)
      role: 'staff',
      name: '清掃員（松岡）',
      employee_id: 'STF004',
      status: 'active',
      created_at: '2025-01-20T00:00:00Z',
      last_login_at: null
    },
    // ========== お客様アカウント ==========
    {
      id: 101,
      email: 'customer@misesapo.co.jp',
      passwordHash: '16a99bd9df58d2774a902f56aaaaa8276d4ba2b75a55b0bc13af7c8b9368368f', // SHA-256ハッシュ (Customer1234)
      role: 'customer',
      name: 'テスト顧客',
      customer_id: 'CUS001',
      store_name: 'テスト店舗',
      status: 'active',
      created_at: '2025-12-03T00:00:00Z',
      last_login_at: null
    },
    {
      id: 102,
      email: 'demo@misesapo.co.jp',
      passwordHash: '16a99bd9df58d2774a902f56aaaaa8276d4ba2b75a55b0bc13af7c8b9368368f', // SHA-256ハッシュ (Customer1234)
      role: 'customer',
      name: 'デモ顧客',
      customer_id: 'CUS002',
      store_name: 'デモ店舗',
      status: 'active',
      created_at: '2025-12-03T00:00:00Z',
      last_login_at: null
    },
    {
      id: 103,
      email: 'sample@misesapo.co.jp',
      passwordHash: '16a99bd9df58d2774a902f56aaaaa8276d4ba2b75a55b0bc13af7c8b9368368f', // SHA-256ハッシュ (Customer1234)
      role: 'customer',
      name: 'サンプル顧客',
      customer_id: 'CUS003',
      store_name: 'サンプル店舗',
      status: 'active',
      created_at: '2025-12-03T00:00:00Z',
      last_login_at: null
    }
  ];
  
  // ユーザーを検索する関数
  async function findUserByEmailAndPassword(email, password) {
    const passwordHash = await hashPassword(password);
    
    for (const user of USERS_DATA) {
      if (user.email.toLowerCase() === email.toLowerCase() && user.passwordHash === passwordHash) {
        // パスワードを除いたユーザー情報を返す
        const { passwordHash: _, ...userWithoutPassword } = user;
        return userWithoutPassword;
      }
    }
    
    return null;
  }
  
  // ユーザーをメールアドレスで検索する関数
  function findUserByEmail(email) {
    for (const user of USERS_DATA) {
      if (user.email.toLowerCase() === email.toLowerCase()) {
        // パスワードを除いたユーザー情報を返す
        const { passwordHash: _, ...userWithoutPassword } = user;
        return userWithoutPassword;
      }
    }
    
    return null;
  }
  
  // グローバルスコープに公開
  window.Users = {
    findUserByEmailAndPassword: findUserByEmailAndPassword,
    findUserByEmail: findUserByEmail,
    hashPassword: hashPassword
  };
})();

