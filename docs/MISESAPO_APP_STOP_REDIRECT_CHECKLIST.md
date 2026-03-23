# misesapo.app → misesapo.co.jp のリダイレクトをやめる（チェックリスト）

「misesapo.app にアクセスしたら、どこ経由でも **misesapo.co.jp（や /misogi）に飛ばさない**」ようにするための確認一覧です。  
**上から順に**潰すと切り分けしやすいです。

---

## 1. DNS（Route 53）— 最優先

### 1.1 AAAA（IPv6）をすべて削除する

- **misesapo.app** と **www.misesapo.app** の **AAAA レコードが 1 本でも残っている**と、多くの端末は IPv6 で **CloudFront** に行き、そこで **misesapo.co.jp へ 301** されます。
- Route 53 → ホストゾーン `misesapo.app` → **タイプ AAAA のレコードをすべて削除**（エイリアスで CloudFront を向いているものも含む）。

### 1.2 A レコードは EC2 のみ

- **misesapo.app** の **A** は **52.192.10.204** のみ（エイリアスで CloudFront を向けない）。
- **www.misesapo.app** も同様に EC2 へ向けるなら **A = 52.192.10.204**。

### 1.3 確認コマンド（自分の Mac のターミナル）

```bash
dig AAAA misesapo.app +short
dig AAAA www.misesapo.app +short
```

**何も出なければ OK**。`2600:9000:...` が出る限り、IPv6 経由のリダイレクトは止まりません。

---

## 2. EC2 の Nginx

### 2.1 misesapo.app 用の server に return 301 がないか

EC2 に SSH して:

```bash
grep -n "misesapo.co.jp\|return 301\|return 302" /etc/nginx/sites-available/misesapo.app.conf
```

- **`misesapo.app` の `server { ... }` ブロック内**に `return 301 https://misesapo.co.jp` などがあれば **削除またはコメントアウト**し、`sudo nginx -t && sudo systemctl reload nginx`。

### 2.2 conf.d のリダイレクト専用ファイル

```bash
ls /etc/nginx/conf.d/
grep -r "misesapo.co.jp" /etc/nginx/conf.d/
```

- `return 301 https://misesapo.co.jp` があるファイルがあり、かつ **`default_server`** で **すべての Host** を拾っている場合、`misesapo.app` にマッチしないリクエストが飛ばされることがあります。  
  **misesapo.app 用の `server_name` が先にマッチする**よう整理するか、**misesapo.app 向けにリダイレクトしない**設定に変更する。

---

## 3. Laravel（本番は `/opt/prod.misesapo.app`）

ドキュメントルートはシンボリックリンク:  
`/var/www/misesapo.app` → `/opt/prod.misesapo.app/public/`

### 3.1 .env

```bash
sudo grep -E "APP_URL|REDIRECT|FRONTEND|MISOGI|CO_JP" /opt/prod.misesapo.app/.env
```

- `APP_URL` が `https://misesapo.co.jp` だけだと、生成 URL やリダイレクトが co.jp になることがある。  
  **misesapo.app で完結させる**なら `APP_URL=https://misesapo.app` にし、`php artisan config:clear`（必要なら `cache:clear`）。

### 3.2 ルート・ミドルウェア・ログイン後の遷移

```bash
sudo grep -r "misesapo.co.jp\|misogi" /opt/prod.misesapo.app/routes /opt/prod.misesapo.app/app --include="*.php" | head -50
```

- `redirect()->away('https://misesapo.co.jp/...')` や `Route::redirect` があれば、**意図に合わせて削除・変更**。

### 3.3 フロント（Blade / public の JS）

```bash
sudo grep -r "misesapo.co.jp\|misogi" /opt/prod.misesapo.app/resources /opt/prod.misesapo.app/public --include="*.blade.php" --include="*.js" 2>/dev/null | head -30
```

---

## 4. まだ CloudFront に当たっているとき

- `curl -sI https://misesapo.app/` の応答に **`server: AmazonS3`** や **`via: cloudfront`** が付く → まだ **AAAA または別レコード**で CloudFront に届いている。
- Route 53 を直したあと **数分〜48 時間** キャッシュが残ることがある。別回線・シークレットウィンドウで再確認。

---

## 5. ブラウザ

- 以前の **301 はブラウザに強くキャッシュ**されることがある。  
  - シークレットウィンドウで試す  
  - 別ブラウザで試す  
  - 開発者ツール → ネットワークで「キャッシュ無効」をオン

---

## 6. 運用メモ（AGENTS.md との関係）

- リポジトリのルールでは **本番のメイン UI** は `https://misesapo.co.jp/misogi/` とされています。  
- **misesapo.app を独立サイトとして残す**のと、**misogi を co.jp に集約する**のは方針のトレードオフです。  
  リダイレクトを全部やめるなら、**ユーザー導線・ブックマーク・社内説明**も合わせて更新してください。

---

## 参照

- [MISESAPO_APP_DISPLAY_SETUP.md](./MISESAPO_APP_DISPLAY_SETUP.md)（AAAA 削除・A レコード）
- [EC2_SSH_KEYS.md](./EC2_SSH_KEYS.md)
