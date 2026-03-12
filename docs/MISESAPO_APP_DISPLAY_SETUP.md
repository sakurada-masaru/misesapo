# misesapo.app を表示させる手順（misesapo.co.jp に飛ばさない）

misesapo.app にアクセスしたときに、misesapo.co.jp に飛ばず「misesapo.app のサイト」を表示するための手順です。

---

## やること（2つ）

1. **Route 53** で misesapo.app の A レコードを EC2（52.192.10.204）に向ける  
2. **EC2 の Nginx** で「misesapo.app で来たときは表示、それ以外は misesapo.co.jp にリダイレクト」に設定する  

---

## 手順 1: Route 53 で A レコードを変更

1. AWS コンソール → **Route 53** → **ホストゾーン** → **misesapo.app** を開く。
2. レコード一覧で **misesapo.app** の **A レコード**（CloudFront を向いている行）をクリックする。
3. 右側の **「レコードを編集」** をクリックする。
4. 次のように変更する。
   - **エイリアス**: **いいえ**（オフ）にする。
   - **値**: `52.192.10.204` を 1 行で入力する。
   - **TTL**: 300 など適宜入力する。
5. **「変更を保存」** をクリックする。

これで misesapo.app の名前解決が EC2 に向きます。

---

### 1.1 重要: AAAA（IPv6）レコードを削除する

**原因**: A レコードだけ EC2 に向けても、**AAAA（IPv6）** が CloudFront のまま残っていると、多くのブラウザや端末は IPv6 を優先するため、**CloudFront → misesapo.co.jp へのリダイレクト** が続きます。

**対処**: Route 53 で **misesapo.app** および **www.misesapo.app** の **AAAA レコードを削除** する。

1. **Route 53** → **ホストゾーン** → **misesapo.app** を開く。
2. レコード一覧で **タイプが AAAA** のレコードを探す（レコード名が `misesapo.app` または `www.misesapo.app`、値が `2600:9000:...` のような IPv6）。
3. 該当する **AAAA レコードの行をクリック** → 右側の **「レコードを削除」**（または「削除」）をクリックして保存する。
4. **www.misesapo.app** 用の AAAA もある場合は、同様に削除する。

削除後、数分待つと IPv6 で CloudFront に飛ばず、IPv4 の A（EC2）に届くようになります。

---

## 手順 2: EC2 の Nginx を設定

**SSH** とは「あなたの Mac から、EC2 サーバーの中に入って操作する」ための接続です。  
ここでは「Mac のターミナル」でコマンドを打ち、EC2 に接続 → 設定ファイルを 1 つ追加 → Nginx を読み直す、までやります。

---

### 2.1 Mac でターミナルを開く

- **Cursor** を使っている場合: メニュー **「ターミナル」→「新しいターミナル」**
- または Mac の **Spotlight**（Command + スペース）で「ターミナル」と入力して **ターミナル** アプリを起動

---

### 2.2 EC2 に接続する（SSH）

ターミナルに次の 1 行を打って Enter する。

```bash
ssh misesapo-sakurada
```

- 初回は「接続しますか？」と出たら **yes** と打って Enter。
- パスワードを聞かれた場合、EC2 用のパスワード（またはキーのパスフレーズ）を入力する。  
  （通常はキー認証のためパスワードは聞かれないことが多い。）

接続できると、**プロンプトが `ubuntu@ip-172.31...` のような表示に変わる**。これが「EC2 の中」です。

接続できない場合: [EC2_SSH_KEYS.md](./EC2_SSH_KEYS.md) を参照（キーの場所や `ssh -i` の使い方）。

---

### 2.3 misesapo.app 用の設定ファイルを 1 つ作る

**EC2 に接続した状態のターミナル**で、次のブロックを **まとめてコピーして貼り付け**、Enter する。

```bash
sudo tee /etc/nginx/conf.d/misesapo-app.conf << 'EOF'
# misesapo.app / www.misesapo.app: サイトを表示（リダイレクトしない）
server {
    listen 80;
    listen [::]:80;
    server_name misesapo.app www.misesapo.app;
    root /usr/share/nginx/html;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF
```

- `sudo` のため、**パスワードを聞かれたら** EC2 の ubuntu のパスワードを入力する（設定していなければ聞かれない場合あり）。
- 何もエラーが出ずにプロンプトが戻れば、ファイル作成は完了。

---

### 2.4 Nginx の設定を確認して反映する

同じく **EC2 に接続した状態**で、次の 2 行を順に打つ。

```bash
sudo nginx -t
```

- 「syntax is ok」「test is successful」のように出れば OK。  
  エラーが出た場合は、そのメッセージを控えてサポートに相談。

続けて、

```bash
sudo systemctl reload nginx
```

- プロンプトが戻れば反映完了。メッセージがなくても問題ない。

---

### 2.5 EC2 から抜ける（任意）

EC2 の中から出るには、次の 1 行を打つ。

```bash
exit
```

- プロンプトが `sakuradamasaru@Mac-mini` のような表示に戻れば、自分の Mac に戻っています。

---

### 2.6 既存のリダイレクト設定について

「IP やその他の Host で来たときは misesapo.co.jp に飛ばす」設定は、**そのまま触らなくてよい**です。  
`/etc/nginx/conf.d/misesapo-app.conf` は「misesapo.app / www.misesapo.app のときだけ」効くので、それ以外は今まで通りリダイレクトされます。

---

### 2.7 表示する中身（HTML）を置く

misesapo.app で表示したいページ（HTML）は、EC2 の **`/usr/share/nginx/html`** に置きます。  
まだ何も置いていない場合は、まずテスト用の `index.html` を 1 つ置いて、ブラウザで `http://misesapo.app` を開いて表示を確認してください。  
（中身の置き方は別途、SCP や Git でデプロイする方法などで対応。）

---

## 確認

1. ブラウザで **http://misesapo.app** を開く → misesapo.app のサイトが表示されること。
2. ブラウザで **http://52.192.10.204** を開く → https://misesapo.co.jp にリダイレクトされること。

---

## 参照

- [EC2_REDIRECT_TO_MISESAPO.md](./EC2_REDIRECT_TO_MISESAPO.md) — リダイレクト設定の詳細
- [EC2_SSH_KEYS.md](./EC2_SSH_KEYS.md) — SSH 接続
