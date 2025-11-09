# 営業マン・清掃員・管理者・開発者・マスター向け実装提案

## 📋 概要

顧客（customer）は一旦除外し、**営業マン（sales）**、**清掃員（staff）**、**管理者（admin）**、**開発者（developer）**、**マスター（master）**の5つのロールに特化した実装提案です。

---

## 🎯 対象ロール

### 1. **staff（清掃員）**
- **説明**: 清掃作業を行うスタッフ
- **主な機能**: スケジュール確認、作業割り当て、レポート作成、研修動画視聴
- **アクセス可能ページ**: `/staff/*`, `/schedule.html`, `/report.html`, `/reports/*`

### 2. **sales（営業マン・コンシェルジュ）**
- **説明**: 営業担当者
- **主な機能**: 顧客管理、見積もり作成、スケジュール管理、発注管理
- **アクセス可能ページ**: `/sales/*`, `/schedule.html`

### 3. **admin（管理者）**
- **説明**: システム管理者
- **主な機能**: サービス管理、顧客管理、発注管理、ユーザー管理
- **アクセス可能ページ**: すべてのページ（開発者専用ページ除く）

### 4. **developer（開発者）**
- **説明**: 技術者・開発者
- **主な機能**: サービス変更レビュー、画像管理、システム管理
- **アクセス可能ページ**: すべてのページ + `/admin/services/review.html`, `/admin/images.html`

### 5. **master（マスター）**
- **説明**: 最上位権限
- **主な機能**: すべての機能へのアクセス、システム全体の管理
- **アクセス可能ページ**: すべてのページ

---

## 🔐 認証方式の提案

### メールアドレスベース認証（推奨）

#### ロール判定ロジック

**メールドメイン別のロールマッピング**
```javascript
const EMAIL_ROLE_MAPPING = {
  // 清掃員: @staff.misesapo.com または @staff.example.com
  '@staff.misesapo.com': 'staff',
  '@staff.example.com': 'staff',
  
  // 営業マン: @sales.misesapo.com または @sales.example.com
  '@sales.misesapo.com': 'sales',
  '@sales.example.com': 'sales',
  
  // 管理者: @admin.misesapo.com または @misesapo.com
  '@admin.misesapo.com': 'admin',
  '@misesapo.com': 'admin',  // デフォルトで管理者
  
  // 開発者: @dev.misesapo.com または @developer.misesapo.com
  '@dev.misesapo.com': 'developer',
  '@developer.misesapo.com': 'developer',
  
  // マスター: 個別指定（例: master@misesapo.com）
  'master@misesapo.com': 'master'
};

// 個別マッピング（ドメイン以外の個別指定）
const INDIVIDUAL_MAPPING = {
  'admin@example.com': 'admin',
  'developer@example.com': 'developer',
  'master@example.com': 'master'
};
```

#### ロール判定関数

```javascript
function determineRoleFromEmail(email) {
  // 1. 個別マッピングをチェック
  if (INDIVIDUAL_MAPPING[email]) {
    return INDIVIDUAL_MAPPING[email];
  }
  
  // 2. ドメインベースのマッピングをチェック
  const domain = '@' + email.split('@')[1];
  if (EMAIL_ROLE_MAPPING[domain]) {
    return EMAIL_ROLE_MAPPING[domain];
  }
  
  // 3. デフォルトは清掃員（staff）
  // 注意: 顧客（customer）は除外しているため、デフォルトをstaffに設定
  return 'staff';
}
```

---

## 📊 ロール階層と権限

### ロール階層

```
master (最上位)
  └─ developer (開発者)
      └─ admin (管理者)
          └─ sales (営業マン)
              └─ staff (清掃員)
```

### 権限マトリックス

| 機能 | staff | sales | admin | developer | master |
|------|-------|-------|-------|-----------|--------|
| **清掃員向け機能** |
| スケジュール確認 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 作業割り当て確認 | ✅ | ✅ | ✅ | ✅ | ✅ |
| レポート作成 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 研修動画視聴 | ✅ | ✅ | ✅ | ✅ | ✅ |
| **営業マン向け機能** |
| 顧客管理 | ❌ | ✅ | ✅ | ✅ | ✅ |
| 見積もり作成 | ❌ | ✅ | ✅ | ✅ | ✅ |
| 発注管理 | ❌ | ✅ | ✅ | ✅ | ✅ |
| スケジュール管理 | ❌ | ✅ | ✅ | ✅ | ✅ |
| **管理者向け機能** |
| サービス管理 | ❌ | ❌ | ✅ | ✅ | ✅ |
| 顧客管理（全件） | ❌ | ❌ | ✅ | ✅ | ✅ |
| 発注管理（全件） | ❌ | ❌ | ✅ | ✅ | ✅ |
| ユーザー管理 | ❌ | ❌ | ✅ | ✅ | ✅ |
| **開発者向け機能** |
| サービス変更レビュー | ❌ | ❌ | ❌ | ✅ | ✅ |
| 画像管理 | ❌ | ❌ | ❌ | ✅ | ✅ |
| システム設定 | ❌ | ❌ | ❌ | ✅ | ✅ |
| **マスター向け機能** |
| すべての機能 | ❌ | ❌ | ❌ | ❌ | ✅ |
| ロール管理 | ❌ | ❌ | ❌ | ❌ | ✅ |
| システム全体の管理 | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 🚀 実装計画

### フェーズ1: 認証システムの実装（必須・短期）

#### 1.1 ユーザーデータ構造

**`src/data/staff_users.json`**（清掃員・営業マン・管理者・開発者・マスター用）
```json
[
  {
    "id": 1,
    "email": "staff1@staff.misesapo.com",
    "password_hash": "$2b$10$...",  // bcrypt等でハッシュ化
    "role": "staff",
    "name": "山田太郎",
    "employee_id": "STF001",
    "status": "active",
    "created_at": "2025-01-01T00:00:00Z",
    "last_login_at": null
  },
  {
    "id": 2,
    "email": "sales1@sales.misesapo.com",
    "password_hash": "$2b$10$...",
    "role": "sales",
    "name": "佐藤花子",
    "employee_id": "SAL001",
    "status": "active",
    "created_at": "2025-01-01T00:00:00Z",
    "last_login_at": null
  },
  {
    "id": 3,
    "email": "admin@misesapo.com",
    "password_hash": "$2b$10$...",
    "role": "admin",
    "name": "鈴木一郎",
    "employee_id": "ADM001",
    "status": "active",
    "created_at": "2025-01-01T00:00:00Z",
    "last_login_at": null
  },
  {
    "id": 4,
    "email": "developer@dev.misesapo.com",
    "password_hash": "$2b$10$...",
    "role": "developer",
    "name": "田中二郎",
    "employee_id": "DEV001",
    "status": "active",
    "created_at": "2025-01-01T00:00:00Z",
    "last_login_at": null
  },
  {
    "id": 5,
    "email": "master@misesapo.com",
    "password_hash": "$2b$10$...",
    "role": "master",
    "name": "管理者",
    "employee_id": "MST001",
    "status": "active",
    "created_at": "2025-01-01T00:00:00Z",
    "last_login_at": null
  }
]
```

#### 1.2 認証APIの実装

**`scripts/dev_server.py`に追加する認証エンドポイント**
```python
# POST /api/auth/login
# リクエスト: { "email": "staff1@staff.misesapo.com", "password": "password123" }
# レスポンス: { "success": true, "token": "jwt_token", "user": { "id": 1, "email": "...", "role": "staff", "name": "..." } }

# POST /api/auth/logout
# リクエスト: { "token": "jwt_token" }
# レスポンス: { "success": true }

# GET /api/auth/me
# リクエストヘッダー: Authorization: Bearer jwt_token
# レスポンス: { "id": 1, "email": "...", "role": "staff", "name": "..." }
```

#### 1.3 ログイン画面の改善

**`src/pages/signin.html`の変更**
- ロール選択を削除
- メールアドレス + パスワードのみ
- メールアドレスから自動的にロールを判定

```html
<form id="login-form" action="#" method="post" class="stack lg mt-8">
  <div>
    <label for="email" class="label">
      メールアドレス
      <span class="pill pill-required" style="margin-left: 8px;">必須</span>
    </label>
    <input type="email" id="email" name="email" class="input" placeholder="name@example.com" autocomplete="username" required />
  </div>

  <div>
    <label for="password" class="label">
      パスワード
      <span class="pill pill-required" style="margin-left: 8px;">必須</span>
    </label>
    <div class="field">
      <input type="password" id="password" name="password" class="input" autocomplete="current-password" required />
      <button type="button" class="toggle-visibility" aria-label="パスワードを表示" onclick="togglePasswordVisibility('password')">
        <i class="fas fa-eye"></i>
      </button>
    </div>
  </div>

  <div id="login-error" class="error-message" style="display: none;"></div>

  <div>
    <button type="submit" class="btn btn-primary btn-round btn-full btn-lg fw-700">ログイン</button>
  </div>
</form>
```

#### 1.4 認証ロジックの実装

**`src/assets/js/auth.js`の変更**
```javascript
async function login(email, password) {
  // 1. バックエンドAPIで認証
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  const data = await response.json();
  
  if (!data.success) {
    return { 
      success: false, 
      message: data.message || 'ログインに失敗しました' 
    };
  }
  
  // 2. トークンとユーザー情報を保存
  sessionStorage.setItem('auth_token', data.token);
  sessionStorage.setItem('user', JSON.stringify(data.user));
  
  // 3. ロールに応じたダッシュボードへリダイレクト
  const defaultPage = getDefaultPageForRole(data.user.role);
  window.location.href = defaultPage;
  
  return { success: true, user: data.user };
}
```

---

### フェーズ2: ロール管理機能の実装（重要・中期）

#### 2.1 ユーザー管理画面（管理者・マスター向け）

**`/admin/users/staff.html`** - 清掃員管理
- 清掃員一覧表示
- 新規清掃員登録
- 清掃員情報編集
- 清掃員の有効/無効化

**`/admin/users/sales.html`** - 営業マン管理
- 営業マン一覧表示
- 新規営業マン登録
- 営業マン情報編集
- 営業マンの有効/無効化

**`/admin/users/admins.html`** - 管理者管理（マスターのみ）
- 管理者一覧表示
- 新規管理者登録
- 管理者情報編集
- 管理者の有効/無効化

**`/admin/users/developers.html`** - 開発者管理（マスターのみ）
- 開発者一覧表示
- 新規開発者登録
- 開発者情報編集
- 開発者の有効/無効化

#### 2.2 ユーザー登録API

**`scripts/dev_server.py`に追加**
```python
# POST /api/users/staff
# リクエスト: { "email": "staff2@staff.misesapo.com", "password": "temp123", "name": "新規清掃員", "employee_id": "STF002" }
# レスポンス: { "success": true, "user": { ... } }

# POST /api/users/sales
# POST /api/users/admins
# POST /api/users/developers
# 同様のエンドポイント
```

#### 2.3 パスワード管理機能

**パスワードリセット**
- `/reset-password.html` - パスワードリセット申請
- メールでリセットトークンを送信
- トークンでパスワード再設定

**パスワード変更**
- `/mypage/settings.html` - パスワード変更
- 現在のパスワードを確認
- 新しいパスワードを設定

---

### フェーズ3: 高度な機能の実装（拡張・長期）

#### 3.1 アクセスログ・監査機能

**ログ記録項目**
- ログイン・ログアウト時刻
- アクセスしたページ
- 実行した操作（CRUD）
- IPアドレス
- ユーザーエージェント

**`/admin/logs.html`** - アクセスログ一覧（管理者・マスター向け）
- ログの検索・フィルタリング
- ログのエクスポート
- 異常なアクセスの検出

#### 3.2 ロール切り替え機能（複数ロール対応）

**1ユーザーが複数のロールを持つ場合**
- 例: 管理者が開発者としても登録されている
- ヘッダーにロール切り替えドロップダウンを表示

```javascript
// ユーザーデータに複数ロールを保存
{
  "id": 1,
  "email": "admin@misesapo.com",
  "roles": ["admin", "developer"],  // 複数ロール
  "primary_role": "admin",  // デフォルトロール
  "role_switching_enabled": true
}
```

#### 3.3 セキュリティ強化

**二要素認証（2FA）**（オプション）
- 管理者・開発者・マスター向けに実装
- SMSまたはアプリベースの認証

**IP制限**（オプション）
- 管理画面へのアクセスを特定IPに制限
- VPN経由でのアクセスを推奨

---

## 📋 実装チェックリスト

### フェーズ1: 認証システム（必須）

- [ ] ユーザーデータ構造の設計（`staff_users.json`）
- [ ] メールアドレスベース認証の実装
- [ ] ロール判定ロジックの実装
- [ ] ログイン画面の改善（ロール選択削除）
- [ ] 認証APIの実装（`/api/auth/login`, `/api/auth/logout`, `/api/auth/me`）
- [ ] JWTトークンの実装
- [ ] パスワードハッシュ化の実装（bcrypt等）

### フェーズ2: ロール管理機能（重要）

- [ ] ユーザー管理画面の実装（清掃員・営業マン・管理者・開発者）
- [ ] ユーザー登録APIの実装
- [ ] ユーザー編集APIの実装
- [ ] ユーザー削除APIの実装
- [ ] パスワードリセット機能の実装
- [ ] パスワード変更機能の実装

### フェーズ3: 高度な機能（拡張）

- [ ] アクセスログ・監査機能の実装
- [ ] ロール切り替え機能の実装（複数ロール対応）
- [ ] 二要素認証（2FA）の実装（オプション）
- [ ] IP制限機能の実装（オプション）

---

## 🔐 セキュリティ対策

### 認証関連

1. **パスワードポリシー**
   - 最低8文字以上
   - 大文字・小文字・数字を含む
   - 特殊文字を含む（推奨）
   - 過去のパスワードとの重複チェック

2. **セッション管理**
   - JWTトークンの有効期限設定（例: 8時間）
   - リフレッシュトークンの実装
   - ログアウト時のトークン無効化

3. **レート制限**
   - ログイン試行回数の制限（5回/15分）
   - API呼び出しのレート制限

### アクセス制御

1. **サーバーサイドでの権限チェック**
   - すべてのAPIエンドポイントで権限チェック
   - ページアクセス時にもサーバーサイドでチェック

2. **ロールベースのアクセス制御（RBAC）**
   - ロール階層を考慮した権限チェック
   - ページ単位で細かいアクセス制御

---

## 📊 運用フロー

### ユーザー登録フロー

#### 清掃員（staff）の登録
1. **管理者が登録** (`/admin/users/staff/new.html`)
2. メールアドレス + 初期パスワードを設定
3. メールで初期パスワードを通知
4. 初回ログイン時にパスワード変更を促す

#### 営業マン（sales）の登録
1. **管理者が登録** (`/admin/users/sales/new.html`)
2. メールアドレス + 初期パスワードを設定
3. メールで初期パスワードを通知
4. 初回ログイン時にパスワード変更を促す

#### 管理者（admin）の登録
1. **マスターが登録** (`/admin/users/admins/new.html`)
2. メールアドレス + 初期パスワードを設定
3. メールで初期パスワードを通知
4. 初回ログイン時にパスワード変更を促す

#### 開発者（developer）の登録
1. **マスターが登録** (`/admin/users/developers/new.html`)
2. メールアドレス + 初期パスワードを設定
3. メールで初期パスワードを通知
4. 初回ログイン時にパスワード変更を促す

#### マスター（master）の登録
1. **既存マスターが登録**（手動または初期設定）
2. メールアドレス + 初期パスワードを設定
3. メールで初期パスワードを通知
4. 初回ログイン時にパスワード変更を促す

### ロール管理フロー

#### ロールの変更
1. **マスターまたは管理者がユーザー管理画面**で変更
2. 変更理由を記録（監査ログ）
3. ユーザーにメール通知（オプション）
4. 次回ログイン時に新しいロールが適用

#### ユーザーの一時停止
1. **マスターまたは管理者がユーザーを一時停止**
2. `status: "suspended"` に変更
3. ログイン不可（エラーメッセージ表示）
4. 再開時に `status: "active"` に戻す

---

## 🎯 まとめ

### 実装の優先順位

1. **フェーズ1（必須・短期）**: 認証システムの実装
   - メールアドレスベース認証
   - ロール判定ロジック
   - JWTトークンによるセッション管理

2. **フェーズ2（重要・中期）**: ロール管理機能の実装
   - ユーザー管理画面
   - ユーザー登録・編集・削除API
   - パスワード管理機能

3. **フェーズ3（拡張・長期）**: 高度な機能の実装
   - アクセスログ・監査機能
   - ロール切り替え機能
   - セキュリティ強化

### 重要なポイント

1. **メールアドレスから自動的にロールを判定**
   - ユーザーはロールを選択する必要がない
   - ドメインベースのマッピング + 個別マッピング

2. **ロール階層を考慮した権限管理**
   - 上位ロールは下位ロールの権限も持つ
   - ページ単位で細かいアクセス制御

3. **セキュリティの強化**
   - サーバーサイドでの権限チェック
   - パスワードハッシュ化
   - アクセスログ・監査機能

営業マン、清掃員、管理者、開発者、マスターの5つのロールに特化した実装により、効率的な運用が可能になります。

