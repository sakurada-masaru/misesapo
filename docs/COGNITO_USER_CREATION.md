# Cognitoユーザー作成ガイド

## パスワードポリシー

Cognito User Poolのパスワードポリシーは以下の通りです：
- 最小8文字
- 大文字を含む
- 小文字を含む
- 数字を含む
- **記号を含む**（重要！）

## ユーザー作成方法

### 方法1: 管理者画面から作成

1. `/admin/users/index.html` にアクセス
2. 「新規ユーザー登録」ボタンをクリック
3. ユーザー情報を入力（パスワードには記号を含める）
4. 保存

### 方法2: スクリプトから作成

```bash
bash scripts/create_cognito_user.sh \
  masarunospec@gmail.com \
  "MandC280408!" \
  "Masaru" \
  admin \
  "管理者"
```

**注意**: パスワードには記号（例: `!`, `@`, `#`, `$`など）を含める必要があります。

## 既存ユーザーのパスワード変更

```bash
aws cognito-idp admin-set-user-password \
  --user-pool-id ap-northeast-1_EDKElIGoC \
  --username masarunospec@gmail.com \
  --password "新しいパスワード（記号を含む）" \
  --permanent \
  --region ap-northeast-1
```

## ユーザー確認

```bash
aws cognito-idp list-users \
  --user-pool-id ap-northeast-1_EDKElIGoC \
  --region ap-northeast-1 \
  --filter "email = \"masarunospec@gmail.com\""
```

