# ムームードメインでのメールアドレス作成ガイド

## 📋 概要

`misesapo.app`がムームードメイン（お名前.com）で登録されている場合のメールアドレス作成方法です。

## 🎯 選択肢

### 選択肢1: ムームードメインのメールサービスを使用（簡単）

**メリット**:
- ✅ 設定が簡単
- ✅ ムームードメインの管理画面から設定可能
- ✅ 追加のAWS設定が不要

**デメリット**:
- ⚠️ 月額料金がかかる（お名前.comのメールプラン）
- ⚠️ 機能が限定的

### 選択肢2: AWS WorkMailを使用（推奨）

**メリット**:
- ✅ AWSで一元管理
- ✅ 既存のAWSインフラと統合
- ✅ 機能が豊富

**デメリット**:
- ⚠️ Route 53へのDNS移管が必要
- ⚠️ 設定がやや複雑

### 選択肢3: 外部メールサービス（Gmail、Outlook等）を使用

**メリット**:
- ✅ 無料プランあり
- ✅ 機能が豊富

**デメリット**:
- ⚠️ カスタムドメインのメールアドレスには有料プランが必要

---

## 🚀 方法1: ムームードメインのメールサービスを使用

### 手順

1. **お名前.comにログイン**
   - https://www.onamae.com/ にアクセス
   - ムームードメインの管理画面にログイン

2. **メールプランの申し込み**
   - 「メール」→「メールプラン」を選択
   - 希望のプランを選択（例: メールボックス5個プラン）

3. **メールアドレスの作成**
   - 「メール」→「メールアドレス作成」
   - メールアドレス名を入力（例: `info`）
   - パスワードを設定
   - 作成完了

4. **メールクライアントの設定**
   - **受信サーバー（POP3/IMAP）**: `mail.onamae.com`
   - **送信サーバー（SMTP）**: `mail.onamae.com`
   - **ポート**: POP3(110/995), IMAP(143/993), SMTP(587/465)

**料金**: 月額 数百円〜（プランによる）

---

## 🚀 方法2: AWS WorkMailを使用（Route 53への移管が必要）

### 前提条件

- Route 53でホストゾーンを作成
- ムームードメインのネームサーバーをRoute 53に変更

### 手順

#### ステップ1: Route 53でホストゾーンを作成

```bash
aws route53 create-hosted-zone \
  --name misesapo.app \
  --caller-reference $(date +%s) \
  --hosted-zone-config Comment="misesapo.app domain"
```

#### ステップ2: ネームサーバーを取得

```bash
aws route53 get-hosted-zone --id <ホストゾーンID> \
  --query 'DelegationSet.NameServers' \
  --output text
```

#### ステップ3: ムームードメインのネームサーバーを変更

1. お名前.comにログイン
2. 「ドメイン」→「ネームサーバーの設定」
3. Route 53のネームサーバーに変更
   - 例: `ns-xxx.awsdns-xx.com`（4つのネームサーバー）

#### ステップ4: WorkMailでメールアドレスを作成

詳細は `docs/AWS_WORKMAIL_SETUP.md` を参照

---

## 🚀 方法3: 外部メールサービス（Gmail、Outlook等）

### Google Workspace（旧G Suite）

1. Google Workspaceに申し込み
2. ドメイン認証（MXレコード設定）
3. メールアドレス作成

**料金**: 月額 $6/ユーザー

### Microsoft 365（Outlook）

1. Microsoft 365に申し込み
2. ドメイン認証（MXレコード設定）
3. メールアドレス作成

**料金**: 月額 $6/ユーザー

---

## 💡 推奨

### すぐにメールアドレスが必要な場合
→ **方法1: ムームードメインのメールサービス**

### AWSで一元管理したい場合
→ **方法2: AWS WorkMail + Route 53移管**

### 豊富な機能が必要な場合
→ **方法3: Google Workspace または Microsoft 365**

---

## 📝 ムームードメインでのDNS設定確認

現在のDNS設定を確認するには:

```bash
# NSレコードを確認
dig NS misesapo.app +short

# MXレコードを確認
dig MX misesapo.app +short

# Aレコードを確認
dig A misesapo.app +short
```

---

## 🔗 参考リンク

- [ムームードメイン メールサービス](https://muumuu-domain.com/service/mail/)
- [お名前.com メール設定ガイド](https://www.onamae.com/guide/mail/)
- [AWS WorkMail ドキュメント](https://docs.aws.amazon.com/workmail/)

