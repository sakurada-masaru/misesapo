# AWS WorkMailでメールアドレス作成ガイド

## 📋 概要

AWS Route 53で管理している`misesapo.app`ドメインで、Amazon WorkMailを使用してメールアドレスを作成する手順です。

## 🎯 前提条件

- ✅ AWSアカウントを持っている
- ✅ Route 53で`misesapo.app`ドメインを管理している
- ✅ ドメインの検証が完了している

## 🚀 セットアップ手順

### ステップ1: WorkMail組織の作成

1. **AWS Console** → **WorkMail** → **「組織の作成」**
2. **組織の設定**:
   - **組織名**: `misesapo` または任意の名前
   - **組織エイリアス**: `misesapo`（自動生成される）
   - **リージョン**: `ap-northeast-1`（東京）
3. **「組織の作成」** をクリック

### ステップ2: ドメインの追加

1. WorkMail組織のダッシュボードで **「ドメイン」** を選択
2. **「ドメインの追加」** をクリック
3. **ドメイン名**: `misesapo.app` を入力
4. **「追加」** をクリック

### ステップ3: Route 53でのDNS設定

WorkMailが自動的にRoute 53に必要なDNSレコードを追加します。

**自動追加されるレコード**:
- MXレコード: メール受信用
- CNAMEレコード: メール送信認証用
- TXTレコード: ドメイン検証用

**確認方法**:
1. Route 53コンソール → **ホストゾーン** → `misesapo.app`
2. 以下のレコードが追加されていることを確認:
   ```
   Type: MX
   Name: misesapo.app
   Value: 10 inbound-smtp.ap-northeast-1.amazonaws.com
   
   Type: CNAME
   Name: _amazonses.misesapo.app
   Value: [WorkMailが生成した値]
   
   Type: TXT
   Name: _amazonses.misesapo.app
   Value: [WorkMailが生成した値]
   ```

### ステップ4: メールアドレスの作成

1. WorkMail組織のダッシュボードで **「ユーザー」** を選択
2. **「ユーザーの作成」** をクリック
3. **ユーザー情報**:
   - **名前**: 表示名（例: `ミセサポ管理者`）
   - **姓**: （任意）
   - **ユーザー名**: メールアドレスの@より前の部分（例: `info`）
   - **パスワード**: メールアドレスのパスワード
   - **メールボックス容量**: デフォルト（50GB）または任意
4. **「ユーザーの作成」** をクリック

**作成されるメールアドレス**: `info@misesapo.app`

### ステップ5: メールクライアントの設定

#### Outlook / Thunderbird / Apple Mail などの設定

**受信サーバー（IMAP）**:
- サーバー名: `outlook.office365.com`（WorkMailのエンドポイント）
- ポート: 993（SSL/TLS）
- ユーザー名: `info@misesapo.app`
- パスワード: 設定したパスワード

**送信サーバー（SMTP）**:
- サーバー名: `smtp.mail.us-east-1.awsapps.com`（リージョンによって異なる）
- ポート: 587（STARTTLS）
- ユーザー名: `info@misesapo.app`
- パスワード: 設定したパスワード

**WorkMailのエンドポイント確認方法**:
1. WorkMail組織のダッシュボード → **「設定」** → **「クライアント設定」**
2. IMAP/SMTPのエンドポイントを確認

### ステップ6: Webメールアクセス

1. WorkMail組織のダッシュボードで **「ユーザー」** を選択
2. 作成したユーザーを選択
3. **「Webメールにアクセス」** をクリック
4. ブラウザでメールを確認・送受信可能

## 💰 コスト

- **WorkMail**: 月額 $4/ユーザー（50GBメールボックス）
- **Route 53**: 月額 $0.50/ホストゾーン（既に使用中）
- **合計**: 月額約 $4.50/ユーザー

## 📝 よく作成されるメールアドレス例

- `info@misesapo.app` - お問い合わせ用
- `support@misesapo.app` - サポート用
- `admin@misesapo.app` - 管理者用
- `noreply@misesapo.app` - 自動送信用

## 🔧 AWS CLIでの操作（オプション）

### WorkMail組織の作成

```bash
aws workmail create-organization \
  --alias misesapo \
  --region ap-northeast-1
```

### ドメインの追加

```bash
aws workmail register-domain \
  --organization-id <組織ID> \
  --domain-name misesapo.app \
  --region ap-northeast-1
```

### ユーザーの作成

```bash
aws workmail create-user \
  --organization-id <組織ID> \
  --name "ミセサポ管理者" \
  --display-name "ミセサポ管理者" \
  --password "パスワード" \
  --region ap-northeast-1
```

### メールボックスの作成

```bash
aws workmail create-mailbox \
  --organization-id <組織ID> \
  --user-id <ユーザーID> \
  --region ap-northeast-1
```

## ⚠️ 注意点

1. **DNS伝播**: DNSレコードの変更が反映されるまで数時間かかる場合があります
2. **リージョン**: WorkMailはすべてのリージョンで利用可能ではありません。`ap-northeast-1`（東京）で利用可能です
3. **パスワードポリシー**: WorkMailのパスワードポリシーに従う必要があります（最低8文字など）

## 🔗 参考リンク

- [Amazon WorkMail ドキュメント](https://docs.aws.amazon.com/workmail/)
- [WorkMail 料金](https://aws.amazon.com/workmail/pricing/)
- [WorkMail クライアント設定](https://docs.aws.amazon.com/workmail/latest/userguide/client_setup.html)

## 📞 トラブルシューティング

### メールが受信できない

1. Route 53のMXレコードが正しく設定されているか確認
2. DNS伝播を待つ（最大48時間）
3. WorkMailのドメイン検証が完了しているか確認

### メールが送信できない

1. SMTP設定が正しいか確認
2. ポート587がブロックされていないか確認
3. パスワードが正しいか確認

### ドメイン検証が失敗する

1. Route 53のTXTレコードが正しく設定されているか確認
2. DNS伝播を待つ
3. WorkMailのドメイン設定を再確認

