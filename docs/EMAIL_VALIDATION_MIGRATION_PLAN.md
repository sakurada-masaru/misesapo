# メールアドレスバリデーション移行計画

## 📋 現状

### 現在の設定
- **個人メールアドレスも許可**: `@gmail.com`, `@yahoo.co.jp`なども使用可能
- **基本的なメールアドレス形式のチェックのみ**: 有効なメールアドレス形式であればOK
- **ドメイン設定中**: `misesapo.app`のドメイン情報を設定中（数日かかる予定）

### 理由
- ドメイン設定が完了するまでの暫定対応
- 従業員の登録を進めるため

---

## 🎯 将来的な設定変更

### 目標
- **企業用メールアドレス（@misesapo.app）のみ許可**
- 個人メールアドレス（@gmail.comなど）を拒否
- コンプライアンスとセキュリティの向上

### 変更タイミング
- ドメイン設定が完了し、メールアドレスが作成可能になった時点

---

## 🔧 設定変更手順

### ステップ1: ドメイン設定の確認

1. **ロリポップのサーバーパネルにログイン**
2. **ドメイン設定を確認**
   - `misesapo.app`が正しく設定されているか確認
   - メールアドレスが作成可能か確認

### ステップ2: メールアドレスの作成

1. **ロリポップで各従業員のメールアドレスを作成**
   - 例: `yamada.taro@misesapo.app`
   - 例: `suzuki.hanako@misesapo.app`
   - ...（全従業員分）

2. **メールアドレスの一覧を作成**
   - 従業員名とメールアドレスの対応表を作成

### ステップ3: バリデーション設定の変更

#### フロントエンド（`src/pages/admin/users/index.html`）

**変更前**:
```javascript
// メールアドレスのバリデーション（現状は個人メールアドレスも許可）
function validateEmail(email) {
  if (!email) {
    return { valid: false, message: 'メールアドレスは必須です。' };
  }
  
  // 基本的なメールアドレス形式のチェック
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      valid: false,
      message: '有効なメールアドレスを入力してください。'
    };
  }
  
  // 現状は個人メールアドレスも許可
  return { valid: true };
}
```

**変更後**:
```javascript
// メールアドレスのバリデーション（企業用メールアドレスのみ許可）
function validateEmail(email) {
  if (!email) {
    return { valid: false, message: 'メールアドレスは必須です。' };
  }
  
  // @misesapo.appで終わることを確認
  if (!email.endsWith('@misesapo.app')) {
    return {
      valid: false,
      message: 'メールアドレスは@misesapo.appで終わる必要があります。企業用メールアドレスを使用してください。'
    };
  }
  
  // 個人のメールアドレスを拒否
  const personalDomains = ['@gmail.com', '@yahoo.co.jp', '@outlook.com', '@hotmail.com', '@icloud.com'];
  if (personalDomains.some(domain => email.includes(domain))) {
    return {
      valid: false,
      message: '個人のメールアドレスは使用できません。企業用メールアドレス（@misesapo.app）を使用してください。'
    };
  }
  
  return { valid: true };
}
```

#### バックエンド（`lambda_function.py`）

**変更前**:
```python
def validate_worker_email(email):
    """
    従業員のメールアドレスをバリデーション
    現状は個人メールアドレスも許可（将来的には企業用メールアドレスへの移行を推奨）
    """
    if not email:
        return {'valid': False, 'message': 'メールアドレスは必須です。'}
    
    # 基本的なメールアドレス形式のチェック
    import re
    email_pattern = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
    if not re.match(email_pattern, email):
        return {
            'valid': False,
            'message': '有効なメールアドレスを入力してください。'
        }
    
    # 現状は個人メールアドレスも許可
    return {'valid': True}
```

**変更後**:
```python
def validate_worker_email(email):
    """
    従業員のメールアドレスをバリデーション
    @misesapo.appで終わることを確認し、個人のメールアドレスを拒否
    """
    if not email:
        return {'valid': False, 'message': 'メールアドレスは必須です。'}
    
    # @misesapo.appで終わることを確認
    if not email.endswith('@misesapo.app'):
        return {
            'valid': False,
            'message': 'メールアドレスは@misesapo.appで終わる必要があります。企業用メールアドレスを使用してください。'
        }
    
    # 個人のメールアドレスを拒否
    personal_domains = ['@gmail.com', '@yahoo.co.jp', '@outlook.com', '@hotmail.com', '@icloud.com']
    if any(email.endswith(domain) for domain in personal_domains):
        return {
            'valid': False,
            'message': '個人のメールアドレスは使用できません。企業用メールアドレス（@misesapo.app）を使用してください。'
        }
    
    return {'valid': True}
```

#### 編集フォーム（`src/pages/admin/users/detail.html`）

**変更前**:
```html
<input type="email" id="edit-email" required placeholder="yamada.taro@example.com">
<small class="form-hint">現状は個人メールアドレスも使用可能です（将来的には企業用メールアドレスへの移行を推奨）</small>
```

**変更後**:
```html
<input type="email" id="edit-email" required placeholder="yamada.taro@misesapo.app">
<small class="form-hint">企業用メールアドレス（@misesapo.app）のみ使用可能です</small>
```

### ステップ4: 既存従業員のメールアドレス更新

1. **既存従業員のメールアドレスを確認**
   - 現在のメールアドレス一覧を取得

2. **ロリポップでメールアドレスを作成**
   - 各従業員に企業用メールアドレスを付与

3. **AWS Cognitoのメールアドレスを更新**
   - 各従業員のCognitoアカウントのメールアドレスを更新

4. **DynamoDBのメールアドレスを更新**
   - `workers`テーブルの`email`フィールドを更新

### ステップ5: テストと確認

1. **新規従業員登録のテスト**
   - 企業用メールアドレス（@misesapo.app）で登録できるか確認
   - 個人メールアドレス（@gmail.comなど）で登録できないか確認

2. **既存従業員の編集テスト**
   - メールアドレスを企業用に変更できるか確認
   - 個人メールアドレスに変更できないか確認

3. **ログイン動作の確認**
   - 更新したメールアドレスでログインできるか確認

---

## 📝 チェックリスト

### 準備フェーズ

- [ ] ドメイン設定が完了している
- [ ] ロリポップでメールアドレスが作成可能であることを確認
- [ ] 既存従業員のメールアドレス一覧を作成

### メールアドレス作成フェーズ

- [ ] ロリポップで各従業員のメールアドレスを作成
- [ ] メールアドレスの一覧を作成（従業員名とメールアドレスの対応表）

### 設定変更フェーズ

- [ ] フロントエンドのバリデーションを変更（`src/pages/admin/users/index.html`）
- [ ] バックエンドのバリデーションを変更（`lambda_function.py`）
- [ ] 編集フォームのバリデーションを変更（`src/pages/admin/users/detail.html`）
- [ ] プレースホルダーとヒントメッセージを更新

### 既存従業員の更新フェーズ

- [ ] AWS Cognitoのメールアドレスを更新
- [ ] DynamoDBのメールアドレスを更新
- [ ] 各従業員に新しいメールアドレスとパスワードを通知

### テストフェーズ

- [ ] 新規従業員登録のテスト（企業用メールアドレス）
- [ ] 新規従業員登録のテスト（個人メールアドレス - 拒否されることを確認）
- [ ] 既存従業員の編集テスト（企業用メールアドレス）
- [ ] 既存従業員の編集テスト（個人メールアドレス - 拒否されることを確認）
- [ ] ログイン動作の確認

---

## 🔄 移行スクリプト（オプション）

既存従業員のメールアドレスを一括更新するスクリプトを作成することも可能です。

```python
# scripts/migrate_worker_emails.py
# 既存従業員のメールアドレスを企業用メールアドレスに更新するスクリプト

# メールアドレスマッピング（old_email -> new_email）
EMAIL_MAPPING = {
    'old_email@gmail.com': 'new_email@misesapo.app',
    # ... 他のマッピング ...
}

# AWS CognitoとDynamoDBのメールアドレスを更新
```

---

## 📝 まとめ

### 現状
- ✅ 個人メールアドレスも許可（暫定対応）
- ✅ ドメイン設定中（数日かかる予定）

### 将来的な変更
- 🔄 ドメイン設定完了後、企業用メールアドレス（@misesapo.app）のみ許可
- 🔄 既存従業員のメールアドレスを企業用に更新

### 変更手順
1. ドメイン設定の確認
2. メールアドレスの作成
3. バリデーション設定の変更
4. 既存従業員のメールアドレス更新
5. テストと確認

**ドメイン設定が完了し、メールアドレスが作成可能になったら、この手順に従って設定を変更してください。**

---

## 🔗 参考資料

- [ロリポップで従業員メールアドレス作成ガイド](docs/LOLIPOP_EMAIL_SETUP.md)
- [従業員メールアドレス移行計画](docs/EMPLOYEE_EMAIL_MIGRATION_PLAN.md)
- [会社名義のメールアドレスを従業員に渡すことのコンプライアンス確認](docs/COMPANY_EMAIL_COMPLIANCE_CONFIRMATION.md)

