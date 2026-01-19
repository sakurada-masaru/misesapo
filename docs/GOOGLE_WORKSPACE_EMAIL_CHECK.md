# Google Workspaceメールアドレスの確認方法

## 📋 概要

Google Workspaceで作成したメールアドレス（例: `sakurada@misesapo.app`）の確認方法です。

## ⚠️ 重要なポイント

**Google Workspaceで作成したメールアドレスは、AWSでは直接確認できません。**

- ✅ **AWSで確認できること**: DNS設定（MXレコード、TXTレコードなど）
- ❌ **AWSで確認できないこと**: メールアドレス自体の存在、メールボックスの内容

## 🔍 確認方法

### 1. DNS設定の確認（AWS Route 53）

Route 53でGoogle Workspaceのメール設定が正しく行われているか確認できます。

#### MXレコードの確認

```bash
dig MX misesapo.app +short
```

**期待される結果**:
```
1 aspmx.l.google.com.
5 alt1.aspmx.l.google.com.
5 alt2.aspmx.l.google.com.
10 alt3.aspmx.l.google.com.
10 alt4.aspmx.l.google.com.
```

#### TXTレコード（SPF/DKIM）の確認

```bash
# SPFレコード
dig TXT misesapo.app +short | grep spf

# DKIMレコード
dig TXT google._domainkey.misesapo.app +short

# DMARCレコード
dig TXT _dmarc.misesapo.app +short
```

### 2. メールアドレスの確認（Google Workspace管理コンソール）

メールアドレス自体の存在は、Google Workspaceの管理コンソールで確認する必要があります。

#### 確認手順

1. **Google Workspace管理コンソールにアクセス**
   - https://admin.google.com/ にアクセス
   - 管理者アカウントでログイン

2. **ユーザー一覧を確認**
   - 「ユーザー」→「ユーザー」を選択
   - `sakurada@misesapo.app` が表示されることを確認

3. **メールアドレスの詳細を確認**
   - ユーザーをクリック
   - メールアドレス、ステータス、メールボックス容量などを確認

### 3. メール送受信のテスト

#### 送信テスト

```bash
# メール送信テスト（mailコマンドが利用可能な場合）
echo "Test email" | mail -s "Test" sakurada@misesapo.app
```

#### 受信テスト

1. 別のメールアドレスから `sakurada@misesapo.app` にメールを送信
2. Google WorkspaceのWebメール（Gmail）で受信を確認

## 🔧 AWS Route 53でのDNS設定確認

### Route 53コンソールでの確認

1. **AWS Console** → **Route 53** → **ホストゾーン**
2. `misesapo.app` のホストゾーンを選択
3. **レコード** タブで以下を確認:
   - **MXレコード**: Google Workspaceのメールサーバーが設定されているか
   - **TXTレコード**: SPF、DKIM、DMARCが設定されているか

### AWS CLIでの確認

```bash
# ホストゾーンIDを取得
ZONE_ID=$(aws route53 list-hosted-zones --query "HostedZones[?Name=='misesapo.app.'].Id" --output text | sed 's|/hostedzone/||')

# MXレコードを確認
aws route53 list-resource-record-sets \
  --hosted-zone-id $ZONE_ID \
  --query "ResourceRecordSets[?Type=='MX']" \
  --output json

# TXTレコードを確認
aws route53 list-resource-record-sets \
  --hosted-zone-id $ZONE_ID \
  --query "ResourceRecordSets[?Type=='TXT']" \
  --output json
```

## 📝 確認チェックリスト

### DNS設定（Route 53）

- [ ] MXレコードが正しく設定されている
- [ ] SPFレコード（TXT）が設定されている
- [ ] DKIMレコード（TXT）が設定されている（オプション）
- [ ] DMARCレコード（TXT）が設定されている（オプション）

### Google Workspace

- [ ] メールアドレス `sakurada@misesapo.app` が存在する
- [ ] ユーザーのステータスが「アクティブ」
- [ ] メールボックスが作成されている
- [ ] メール送受信が正常に動作する

## 🔗 参考リンク

- [Google Workspace管理コンソール](https://admin.google.com/)
- [Google Workspace メール設定ガイド](https://support.google.com/a/answer/140034)
- [Route 53 DNS設定](https://console.aws.amazon.com/route53/)

## 💡 まとめ

- **メールアドレスの存在**: Google Workspace管理コンソールで確認
- **DNS設定**: AWS Route 53で確認可能
- **メール送受信**: 実際にメールを送受信してテスト

Google Workspaceで作成したメールアドレスは、Google Workspaceの管理コンソールで管理する必要があります。AWSではDNS設定のみを確認できます。

