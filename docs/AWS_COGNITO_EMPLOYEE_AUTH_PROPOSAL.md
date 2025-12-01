# AWS Cognito 従業員認証システム構築提案

## 🎯 目標

### 認証システムの分離
- **お客様（Customer）**: Firebase Authentication
- **従業員（Worker）**: AWS Cognito

### メリット
1. **セキュリティの向上**: 従業員とお客様の認証を完全に分離
2. **データ管理の明確化**: 従業員は`workers`テーブル、お客様は`clients`テーブル
3. **運用の簡素化**: 従業員の管理をAWSで一元化
4. **スケーラビリティ**: AWS Cognitoは従業員数の増加に対応可能

## 📋 実装計画

### ステップ1: AWS Cognito User Poolの作成

#### User Pool設定
- **User Pool名**: `misesapo-workers-pool`
- **認証方法**: メールアドレス + パスワード
- **パスワードポリシー**: 
  - 最小8文字
  - 大文字・小文字・数字・特殊文字を含む
- **MFA**: オプション（将来的に有効化可能）
- **属性**:
  - `email`（必須）
  - `name`（カスタム属性）
  - `role`（カスタム属性）
  - `department`（カスタム属性）

#### App Client設定
- **App Client名**: `misesapo-workers-client`
- **認証フロー**: `ALLOW_USER_PASSWORD_AUTH`, `ALLOW_REFRESH_TOKEN_AUTH`
- **トークン有効期限**: 
  - Access Token: 1時間
  - ID Token: 1時間
  - Refresh Token: 30日

### ステップ2: Lambda関数の拡張

#### Cognito認証用のLambda関数
- **関数名**: `misesapo-cognito-auth`
- **機能**:
  - 従業員のログイン認証
  - トークンの検証
  - ユーザー情報の取得

#### 既存Lambda関数の拡張
- `lambda_function.py`にCognito認証処理を追加
- Cognito ID Tokenの検証機能を追加

### ステップ3: フロントエンドの実装

#### 従業員用ログインページ
- **ページ**: `/staff/signin.html`（新規作成）
- **機能**:
  - AWS Cognitoでログイン
  - トークンを保存
  - 従業員ダッシュボードにリダイレクト

#### 認証処理の分離
- **お客様**: `src/assets/js/auth.js`（Firebase認証）
- **従業員**: `src/assets/js/cognito_auth.js`（新規作成、Cognito認証）

### ステップ4: ログイン後のリダイレクト処理

#### ログイン判定
```javascript
// お客様（Firebase）
if (firebaseUser) {
  redirectTo('/customers/dashboard.html');
}

// 従業員（Cognito）
if (cognitoUser) {
  redirectTo('/staff/dashboard.html');
}
```

## 🔧 実装詳細

### 1. AWS Cognito User Poolの作成

#### CloudFormationテンプレート
```yaml
Resources:
  WorkersUserPool:
    Type: AWS::Cognito::UserPool
    Properties:
      UserPoolName: misesapo-workers-pool
      UsernameAttributes:
        - email
      AutoVerifiedAttributes:
        - email
      Policies:
        PasswordPolicy:
          MinimumLength: 8
          RequireUppercase: true
          RequireLowercase: true
          RequireNumbers: true
          RequireSymbols: true
      Schema:
        - Name: email
          AttributeDataType: String
          Required: true
          Mutable: true
        - Name: name
          AttributeDataType: String
          Required: false
          Mutable: true
        - Name: role
          AttributeDataType: String
          Required: false
          Mutable: true
        - Name: department
          AttributeDataType: String
          Required: false
          Mutable: true

  WorkersUserPoolClient:
    Type: AWS::Cognito::UserPoolClient
    Properties:
      UserPoolId: !Ref WorkersUserPool
      ClientName: misesapo-workers-client
      GenerateSecret: false
      ExplicitAuthFlows:
        - ALLOW_USER_PASSWORD_AUTH
        - ALLOW_REFRESH_TOKEN_AUTH
      AccessTokenValidity: 3600
      IdTokenValidity: 3600
      RefreshTokenValidity: 2592000
```

### 2. Cognito認証用のJavaScriptライブラリ

#### `src/assets/js/cognito_auth.js`
```javascript
// AWS Cognito認証処理
class CognitoAuth {
  constructor() {
    this.userPoolId = 'ap-northeast-1_XXXXXXXXX';  // User Pool ID
    this.clientId = 'XXXXXXXXXXXXXXXXXXXXXXXXXX';  // App Client ID
    this.region = 'ap-northeast-1';
  }

  async login(email, password) {
    // Cognitoでログイン
    // トークンを保存
    // ユーザー情報を取得
  }

  async logout() {
    // トークンを削除
    // セッションをクリア
  }

  async getCurrentUser() {
    // 現在のユーザー情報を取得
  }
}
```

### 3. 従業員用ログインページ

#### `src/pages/staff/signin.html`
```html
<!-- 従業員専用ログインページ -->
<form id="staff-signin-form">
  <input type="email" id="email" required />
  <input type="password" id="password" required />
  <button type="submit">ログイン</button>
</form>
```

### 4. Lambda関数でのCognito認証検証

#### `lambda_function.py`に追加
```python
import boto3
import jwt
from jose import jws

def verify_cognito_token(id_token, user_pool_id, region='ap-northeast-1'):
    """Cognito ID Tokenを検証"""
    # JWKSから公開鍵を取得
    # トークンを検証
    # ユーザー情報を返す
```

## 📊 データフロー

### 従業員のログインフロー
```
1. 従業員が /staff/signin.html でログイン
   ↓
2. AWS Cognitoで認証
   ↓
3. ID Token, Access Token, Refresh Tokenを取得
   ↓
4. トークンをlocalStorageに保存
   ↓
5. DynamoDBのworkersテーブルからユーザー情報を取得
   ↓
6. 従業員ダッシュボードにリダイレクト
```

### 従業員の登録フロー（管理者が実行）
```
1. 管理者が /admin/users/index.html で従業員を登録
   ↓
2. AWS Cognito User Poolにユーザーを作成
   ↓
3. DynamoDBのworkersテーブルに情報を保存
   ↓
4. 初期パスワードを従業員に通知
```

## 🔒 セキュリティ

### トークン管理
- **Access Token**: APIリクエスト時に使用
- **ID Token**: ユーザー情報の取得に使用
- **Refresh Token**: トークンの更新に使用

### トークンの保存
- **localStorage**: トークンを保存（XSS対策が必要）
- **httpOnly Cookie**: より安全（将来的に実装）

### API認証
- Lambda関数でCognito ID Tokenを検証
- トークンが有効な場合のみAPIアクセスを許可

## 📋 実装手順

### フェーズ1: AWS Cognito User Poolの作成（1日）
1. CloudFormationテンプレートを作成
2. User PoolとApp Clientを作成
3. 設定を確認

### フェーズ2: フロントエンドの実装（2-3日）
1. `cognito_auth.js`を作成
2. `/staff/signin.html`を作成
3. 認証処理を実装

### フェーズ3: Lambda関数の拡張（2-3日）
1. Cognito認証処理を追加
2. トークン検証機能を実装
3. API認証を改善

### フェーズ4: 既存システムとの統合（1-2日）
1. ログイン後のリダイレクト処理を改善
2. 認証状態の管理を改善
3. エラーハンドリングを改善

**合計**: 約1-2週間

## 🎯 結論

AWS Cognitoを使用して従業員用の認証システムを構築することで、お客様と従業員の認証を完全に分離できます。これにより、セキュリティが向上し、データ管理が明確になります。

