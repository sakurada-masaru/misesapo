# misogi ログインの前提（DynamoDB 従業員でログインするには）

misogi のサインインでは、**Cognito User Pool** でメール＋パスワード認証し、**DynamoDB workers** から同じメールの従業員情報（名前・ロール・部署）を取得して表示しています。

そのため「登録されているメールアドレスでログインできる」ようにするには、**DynamoDB の workers にいるメールアドレスが、Cognito User Pool にもユーザーとして存在している必要**があります。

## 現在の状態を確認する

- **DynamoDB の従業員一覧**: `python3 scripts/list_users_roles_departments.py` で API から取得
- **Cognito に未登録の従業員**: `python3 scripts/sync_workers_to_cognito.py --dry-run` で「Cognito に未登録」のメールだけ表示

## DynamoDB の従業員を Cognito に登録する（一括）

DynamoDB（workers API）にいる従業員のうち、Cognito にまだいないメールアドレスを、Cognito に一括でユーザー作成します。

1. **AWS CLI が設定済み**（`aws configure`）で、Cognito の `admin_create_user` ができる権限があること
2. 初回パスワードを環境変数で指定（推奨）:
   ```bash
   export COGNITO_DEFAULT_PASSWORD='任意の安全な初回パスワード'
   python3 scripts/sync_workers_to_cognito.py
   ```
3. 未設定の場合はスクリプト内のデフォルトパスワードが使われます（本番では必ず `COGNITO_DEFAULT_PASSWORD` を設定し、利用者に初回パスワードを通知・変更を促してください）

**dry-run（登録せずに未登録メールだけ表示）**:
```bash
python3 scripts/sync_workers_to_cognito.py --dry-run
```

## 1 件だけ Cognito に追加する

既存の `scripts/create_cognito_user.sh` で 1 件ずつ作成できます。

```bash
./scripts/create_cognito_user.sh メール@example.com パスワード 表示名 ロール 部署
```

## Cognito で 400 が出る場合

ブラウザで `cognito-idp.ap-northeast-1.amazonaws.com` に 400 が返る場合、**Cognito のアプリクライアント設定**を確認してください。

1. **クライアントシークレットなし**
   - ブラウザから使うアプリクライアントは「**クライアントシークレットを生成しない**」である必要があります。
   - AWS コンソール → Cognito → ユーザープール → アプリの統合 → アプリクライアント → 該当クライアントを編集し、クライアントシークレットが「なし」か確認してください。シークレットありのクライアントは別のクライアント（シークレットなし）を新規作成して misogi / 既存サインインで使ってください。

2. **認証フロー**
   - 「認証フロー」で **ALLOW_USER_SRP_AUTH** が有効になっていることを確認してください。

3. **エラー内容の確認**
   - misogi のサインインモーダルでログイン失敗時、画面のエラーメッセージとブラウザのコンソール（F12 → Console）に `[signInWithCognito] Cognito onFailure:` のログが出ます。ここに Cognito のエラーコード・メッセージが含まれます。
   - ネットワークタブで 400 を返しているリクエストを選択し、レスポンス本文にもエラー内容が書かれています。

## 参照

- ユーザー情報の取得元: `src/misogi/pages/shared/auth/useAuth.js`（localStorage の `cognito_user`）← サインイン時に API `/workers?email=...` から取得して保存
- Cognito 一括同期: `scripts/sync_workers_to_cognito.py`
