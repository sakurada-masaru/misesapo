# EC2（misesapo-app-web）を misesapo.co.jp へリダイレクトする手順

## 目的

- EC2（52.192.10.204 / タグ: misesapo-app-web）にアクセスした場合、常に **https://misesapo.co.jp** へ 301 リダイレクトする。
- 本番サイトは GitHub Pages（misesapo.co.jp）のため、この EC2 は「見れなくなっている」状態を、リダイレクトで解消する。

---

## 1. AWS 側で確認すること

### 1.1 EC2 インスタンス

| 項目 | 期待値 |
|------|--------|
| インスタンス ID | `i-0db77d6fe8de2e5d1` |
| 名前（タグ） | `misesapo-app-web` |
| 状態 | **実行中** |
| パブリック IP | `52.192.10.204`（Elastic IP） |
| リージョン | アジアパシフィック（東京） ap-northeast-1 |

- コンソール: **EC2 → インスタンス** で上記を確認。
- 状態が「停止」の場合は「インスタンスの起動」で起動する。

### 1.2 セキュリティグループ

- **EC2 → インスタンス → 対象インスタンス → セキュリティ** タブを開く。
- **インバウンド** で以下が開いているか確認:
  - **HTTP**: タイプ HTTP、ポート 80、ソース 0.0.0.0/0（または必要な範囲）
  - **HTTPS**: タイプ HTTPS、ポート 443、ソース 0.0.0.0/0（または必要な範囲）
- 80/443 が閉じていると、ブラウザから「見れない」原因になるので、必要ならルールを追加する。

### 1.3 Elastic IP

- パブリック IP `52.192.10.204` が **Elastic IP** としてこのインスタンスに紐付いているか確認。
- **EC2 → Elastic IP** で一覧を確認し、未使用の場合は「アドレスの関連付け」でこのインスタンスに割り当てる。

### 1.4 DNS（任意）

- この EC2 を指しているドメイン（例: `app.misesapo.co.jp` や別ドメイン）がある場合:
  - **Route 53** または外部 DNS で、A レコードが `52.192.10.204` を向いているか確認。
- IP 直アクセスのみの場合は、この確認は不要。

### 1.5 AWS CLI で確認する

AWS CLI が入っていれば、コンソールを開かずに以下で確認できる。リージョンは `ap-northeast-1`（東京）。

**インスタンスの状態・IP**

```bash
REGION=ap-northeast-1
INSTANCE_ID=i-0db77d6fe8de2e5d1

aws ec2 describe-instances \
  --instance-ids "$INSTANCE_ID" \
  --region "$REGION" \
  --query 'Reservations[0].Instances[0].{State:State.Name,PublicIp:PublicIpAddress,PrivateIp:PrivateIpAddress}' \
  --output table
```

`State` が `running`、`PublicIp` が `52.192.10.204` であれば OK。

**セキュリティグループのインバウンド（80/443）**

```bash
# このインスタンスに付いている SG の ID を取得
SG_IDS=$(aws ec2 describe-instances --instance-ids "$INSTANCE_ID" --region "$REGION" \
  --query 'Reservations[0].Instances[0].SecurityGroups[*].GroupId' --output text)

# 各 SG のインバウンドルールを表示
for sg in $SG_IDS; do
  echo "--- $sg ---"
  aws ec2 describe-security-groups --group-ids "$sg" --region "$REGION" \
    --query 'SecurityGroups[0].IpPermissions[?FromPort==`80` || FromPort==`443`].[FromPort,ToPort,IpRanges[0].CidrIp]' \
    --output table
done
```

**Elastic IP の関連付け**

```bash
aws ec2 describe-addresses --region "$REGION" \
  --filters "Name=address,Values=52.192.10.204" \
  --query 'Addresses[0].{AllocationId:AllocationId,InstanceId:InstanceId,PublicIp:PublicIp}' \
  --output table
```

**リダイレクトの動作確認（CLI）**

```bash
# 301 で Location: https://misesapo.co.jp/ になるか
curl -sI -o /dev/null -w '%{http_code} %{redirect_url}\n' http://52.192.10.204/
```

期待: `301` と `https://misesapo.co.jp/`（または空で、レスポンスヘッダーに `Location: https://misesapo.co.jp/` が含まれる）。

---

## 2. EC2 上でリダイレクトを設定する（Nginx の場合）

### 2.1 SSH で EC2 にログイン

```bash
ssh misesapo-sakurada
# または
ssh -i ~/.ssh/misesapo_sakurada ubuntu@52.192.10.204
```

（キー設定は [EC2_SSH_KEYS.md](./EC2_SSH_KEYS.md) を参照。）

### 2.2 Nginx の有無と設定場所の確認

```bash
sudo nginx -t
ls -la /etc/nginx/sites-enabled/
ls -la /etc/nginx/conf.d/
```

- 既存の `default` や `sites-enabled` の設定を確認する。

### 2.3 リダイレクト用設定を入れる

**方法 A: 既存 default をリダイレクト専用に差し替える**

バックアップを取ったうえで、`/etc/nginx/sites-available/default`（または `sites-enabled/default`）を次の内容に置き換える:

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    return 301 https://misesapo.co.jp$request_uri;
}

server {
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    server_name _;
    # 自己署名でもよい（リダイレクト専用のため）
    ssl_certificate     /etc/ssl/certs/ssl-cert-snakeoil.pem;
    ssl_certificate_key /etc/ssl/private/ssl-cert-snakeoil.key;
    return 301 https://misesapo.co.jp$request_uri;
}
```

**方法 B: 別ファイルで読み込む**

リポジトリの `nginx/redirect-to-misesapo.conf` を EC2 にコピーし、`/etc/nginx/conf.d/redirect-to-misesapo.conf` に配置する。  
既存の `default` で `listen 80 default_server` などが使われている場合は、`default_server` をリダイレクト用の server にだけ付与し、既存の server からは外す。

### 2.4 設定チェックと Nginx 再読込

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 2.5 動作確認

- ブラウザで `http://52.192.10.204` または `https://52.192.10.204` を開く。
- `https://misesapo.co.jp/` へ 301 で飛ぶこと、アドレスバーが `https://misesapo.co.jp` に変わることを確認する。

---

## 3. リポジトリ内の設定ファイル

- **Nginx 用サンプル**: リポジトリの `nginx/redirect-to-misesapo.conf` を EC2 にコピーして利用できる。
- 本番サイトの配信は **GitHub Pages（misesapo.co.jp）** のまま。EC2 は「リダイレクト専用」として運用する。

---

## 4. トラブルシュート

| 現象 | 確認すること |
|------|----------------|
| 接続できない | セキュリティグループで 80/443 が開いているか、Elastic IP が付与されているか |
| 502 Bad Gateway | `sudo systemctl status nginx` で Nginx が起動しているか、`nginx -t` で設定エラーがないか |
| リダイレクトされない | 該当 server に `default_server` が付いているか、別の server が先にマッチしていないか |
| 証明書エラー（HTTPS） | リダイレクト専用なら自己署名証明書でも可。必要なら Let's Encrypt で証明書を取得する |

---

## 参照

- [EC2_SSH_KEYS.md](./EC2_SSH_KEYS.md) — SSH 接続
- [RUNBOOK_RELEASE.md](./spec/RUNBOOK_RELEASE.md) — 本番（GitHub Pages + Lambda）のリリース手順
