# 従業員登録状況

## ⚠️ 登録エラー

### 問題点

提供されたパスワードがAWS Cognitoのパスワードポリシーに適合していません。

**AWS Cognitoのパスワードポリシー要件**:
- 8文字以上
- 大文字を含む
- 小文字を含む
- 数字を含む
- 特殊文字を含む

### 各従業員のパスワード状況

| 従業員名 | メールアドレス | パスワード | 問題点 |
|---------|--------------|----------|--------|
| 管理者 | admin@misesapo.app | 887jchgasgw | 大文字・特殊文字なし |
| 管理者（経理） | keiri@misesapo.app | misesapo0000 | 大文字・特殊文字なし |
| 清掃員 | worker@misesapo.app | Toh0ohchie | 特殊文字なし |
| 開発者 | design@misesapo.app | misesapo1234 | 大文字・特殊文字なし |
| コンシェルジュ | misesapofeedback@gmail.com | MandC280408 | 特殊文字なし、個人Gmail |
| マスター | info@misesapo.app | Kazuki.428 | 特殊文字(.)あり - 可能性あり |

## 🔧 解決方法

### オプション1: パスワードを強化する

各パスワードに特殊文字を追加する例：

- `887jchgasgw` → `887jchgasgw!` または `887Jchgasgw!`
- `misesapo0000` → `Misesapo0000!`
- `Toh0ohchie` → `Toh0ohchie!`
- `misesapo1234` → `Misesapo1234!`
- `MandC280408` → `MandC280408!`
- `Kazuki.428` → `Kazuki.428!` (既に特殊文字あり)

### オプション2: Cognitoのパスワードポリシーを緩和する

AWS Cognitoのパスワードポリシーから特殊文字の要件を削除する（セキュリティ上推奨されません）。

### オプション3: コンシェルジュのメールアドレスを変更する

`misesapofeedback@gmail.com` を `feedback@misesapo.app` などの企業用メールアドレスに変更する。

## 📝 次のステップ

1. パスワードを強化するか、Cognitoのパスワードポリシーを確認する
2. コンシェルジュのメールアドレスを企業用に変更する
3. スクリプトを再実行する

## 🔄 再実行方法

パスワードを修正した後、以下のコマンドで再実行：

```bash
python3 scripts/register_employees.py
```

