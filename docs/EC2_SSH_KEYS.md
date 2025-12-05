# EC2 SSH キー管理

## 保存場所

EC2インスタンスへのアクセスに使用するSSHキーは以下の場所に保存されています：

### メインキー（sakurada@misesapo.co.jp - 現在使用中）
- **プライベートキー**: `~/.ssh/misesapo_sakurada`
- **パブリックキー**: `~/.ssh/misesapo_sakurada.pub`
- **作成日**: 2025年12月
- **所有者**: sakurada@misesapo.co.jp

### 旧キー（前エンジニア - ubuntu）
- **プライベートキー**: `~/.ssh/id_ed25519`
- **パブリックキー**: `~/.ssh/id_ed25519.pub`
- **パブリックキー内容**:
  ```
  ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDxZeweOTJRlSCqRmq3qCU4l4VbCZJvTIrKaA0qyMmOB sakurada-masaru@masaruMac-mini.local
  ```

### その他のキー
- **PEMキー**: `~/.ssh/misesapo-ec2-access.pem` (1679B)

## SSH設定

`~/.ssh/config` に以下の設定があります：

### 新しいキー（推奨）
```
Host misesapo-sakurada
    HostName 52.192.10.204
    User ubuntu
    IdentityFile ~/.ssh/misesapo_sakurada
    StrictHostKeyChecking no
    UserKnownHostsFile /dev/null
```

### 旧キー（前エンジニア）
```
Host misesapo
    HostName 52.192.10.204
    User ubuntu
    IdentityFile ~/.ssh/id_ed25519
    StrictHostKeyChecking no
    UserKnownHostsFile /dev/null
```

## 使用方法

### 新しいキーで接続（推奨）
```bash
ssh misesapo-sakurada
```

### 旧キーで接続（非推奨）
```bash
ssh misesapo
```

## 注意事項

- **セキュリティ**: これらのキーファイルは機密情報です。リポジトリにコミットしないでください。
- **バックアップ**: 必要に応じて、安全な場所にバックアップを取ってください。
- **権限**: プライベートキーのファイル権限は `600` (rw-------) に設定してください。

## EC2インスタンス情報

- **インスタンスID**: `i-0db77d6fe8de2e5d1`
- **IPアドレス**: `52.192.10.204`
- **リージョン**: `ap-northeast-1`
- **ユーザー**: `ubuntu`

