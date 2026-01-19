# ログインセキュリティ向上策

## 現在の実装の問題点

1. **クライアントサイドのみの認証**
   - パスワードがJavaScriptで平文チェック
   - ソースコードからパスワードが読み取れる

2. **ブルートフォース攻撃対策なし**
   - ログイン試行回数の制限がない
   - 無制限に試行可能

3. **セッション管理の脆弱性**
   - sessionStorageのみで管理
   - XSS攻撃に脆弱

4. **パスワードの複雑性チェックなし**
   - 弱いパスワードでも受け入れる

## 実装可能な改善策（優先順位順）

### 1. ログイン試行回数の制限（レート制限）⭐️⭐️⭐️
**優先度: 高 | 実装難易度: 低**

- localStorageでログイン試行回数を記録
- 5回失敗で15分間ロック
- IPアドレスと組み合わせて記録

**実装例:**
```javascript
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15分

function checkLoginAttempts(role) {
  const key = `login_attempts_${role}`;
  const attempts = JSON.parse(localStorage.getItem(key) || '{"count": 0, "timestamp": 0}');
  
  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    const elapsed = Date.now() - attempts.timestamp;
    if (elapsed < LOCKOUT_DURATION) {
      const remaining = Math.ceil((LOCKOUT_DURATION - elapsed) / 1000 / 60);
      return { locked: true, remainingMinutes: remaining };
    } else {
      // ロックアウト期間が過ぎたのでリセット
      localStorage.removeItem(key);
    }
  }
  return { locked: false };
}
```

### 2. セッショントークンの生成⭐️⭐️⭐️
**優先度: 高 | 実装難易度: 低**

- ランダムなセッショントークンを生成
- トークンとロールを組み合わせて保存
- セッションの改ざんを検出

**実装例:**
```javascript
function generateSessionToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

function setAuthData(role, email = null) {
  const token = generateSessionToken();
  const sessionData = {
    role: role,
    email: email,
    token: token,
    timestamp: Date.now()
  };
  sessionStorage.setItem(AUTH_KEY, JSON.stringify(sessionData));
}
```

### 3. ログイン試行の遅延（指数バックオフ）⭐️⭐️
**優先度: 中 | 実装難易度: 低**

- 失敗回数に応じて遅延を追加
- 1回目: 0秒、2回目: 1秒、3回目: 2秒、4回目: 4秒...

**実装例:**
```javascript
function getDelayForAttempt(attemptCount) {
  return Math.min(Math.pow(2, attemptCount - 1) * 1000, 10000); // 最大10秒
}
```

### 4. パスワードのハッシュ化（クライアントサイド）⭐️⭐️
**優先度: 中 | 実装難易度: 中**

- SHA-256でハッシュ化してから比較
- ただし、クライアントサイドでは限界がある（ソースコードにハッシュが含まれる）

**実装例:**
```javascript
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
```

### 5. セッションタイムアウトの短縮⭐️
**優先度: 低 | 実装難易度: 低**

- 現在8時間 → 2-4時間に短縮
- アクティビティベースのタイムアウト

### 6. IPアドレスの記録と検証⭐️⭐️
**優先度: 中 | 実装難易度: 中**

- ログイン時のIPアドレスを記録
- セッション確認時にIPが変わっていたら警告

**注意:** クライアントサイドではIP取得が困難（外部APIが必要）

### 7. パスワードの複雑性チェック⭐️
**優先度: 低 | 実装難易度: 低**

- 最低8文字、大文字・小文字・数字を含む
- クライアントサイドでのバリデーション

### 8. CSRF対策トークン⭐️⭐️
**優先度: 中 | 実装難易度: 中**

- フォーム送信時にトークンを生成
- セッションとトークンを照合

## 推奨実装順序

1. **ログイン試行回数の制限**（最も効果的で実装が簡単）
2. **セッショントークンの生成**（セッション改ざん対策）
3. **ログイン試行の遅延**（ブルートフォース対策の補強）

## 根本的な解決策（バックエンド実装）

現在のクライアントサイドのみの認証では、根本的なセキュリティ向上には限界があります。

**推奨される改善:**
1. **バックエンドAPIの実装**
   - パスワードをサーバー側で検証
   - セッション管理をサーバー側で行う
   - JWT（JSON Web Token）の使用

2. **データベースの導入**
   - ユーザー情報をデータベースに保存
   - パスワードをハッシュ化して保存（bcrypt等）

3. **HTTPSの強制**
   - 通信の暗号化
   - 中間者攻撃対策

4. **二要素認証（2FA）**
   - SMS、メール、アプリベースの認証

## 実装の優先度

- ⭐️⭐️⭐️: すぐに実装すべき（高優先度）
- ⭐️⭐️: 可能な限り実装すべき（中優先度）
- ⭐️: 余裕があれば実装（低優先度）

