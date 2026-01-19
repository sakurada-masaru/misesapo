# Cognitoユーザー作成完了

## 作成されたユーザー

- **メールアドレス**: `masarunospec@gmail.com`
- **パスワード**: `MandC280408!`（記号を含む）
- **Cognito Sub**: `97a48a88-7031-7035-de1a-566993e9d6ec`
- **ステータス**: 有効

## 注意事項

1. **カスタム属性**: User Poolのスキーマにカスタム属性（`custom:name`, `custom:role`, `custom:department`）が定義されていないため、Cognitoには保存されていません。
2. **DynamoDBへの保存**: 管理者画面（`/admin/users/index.html`）からユーザー情報をDynamoDBに保存する必要があります。

## 次のステップ

### 1. ログインを試す

1. `/staff/signin.html` にアクセス
2. 以下の情報でログイン：
   - メールアドレス: `masarunospec@gmail.com`
   - パスワード: `MandC280408!`

### 2. DynamoDBにユーザー情報を保存

ログイン後、管理者画面でユーザー情報をDynamoDBに保存してください：

1. `/admin/users/index.html` にアクセス
2. 新規ユーザー登録で以下の情報を入力：
   - メールアドレス: `masarunospec@gmail.com`
   - 名前: `Masaru`
   - ロール: `admin`
   - 部署: `管理者`
   - パスワード: `MandC280408!`（既存ユーザーのため、空欄でも可）

これにより、Cognito SubがDynamoDBの`workers`テーブルに紐付けられます。

