# Route 53 に Google 用 MX を追加する（info@misesapo.app を届ける）

misesapo.app のネームサーバが Route 53 なので、**メールを受信するには Route 53 に MX レコード**が必要です。  
ここでは Google Workspace 用の MX を追加する手順だけを書きます。

---

## やること（3ステップ）

1. Route 53 で misesapo.app のホストゾーンを開く  
2. MX レコードが無ければ「レコードを作成」で追加する  
3. 保存して、反映を待つ（数分〜最大48時間）

---

## 手順

### 1. Route 53 を開く

1. ブラウザで **https://console.aws.amazon.com/** にアクセスしてログインする。
2. 画面上の検索で **「Route 53」** と入力し、**Route 53** を開く。
3. 左メニューで **「ホストゾーン」** をクリックする。
4. 一覧から **「misesapo.app」** の行をクリックする（ドメイン名のリンクでも可）。

→ これで **misesapo.app のレコード一覧** が表示されます。

---

### 2. MX があるか確認する

- 一覧に **タイプが「MX」** のレコードがあるか見る。
- **ある** → 値を確認し、Google のサーバー（下記「3. 入力する値」）になっていればそのままでOK。違う値なら編集する。
- **ない** → 次の「3. レコードを作成」で新規追加する。

---

### 3. レコードを作成（MX が無い場合）

1. **「レコードを作成」** ボタンをクリックする。

2. 次のように入力する。

   | 項目 | 入力する内容 |
   |------|----------------|
   | **レコード名** | 空欄のまま（何も入れない） |
   | **レコードタイプ** | **MX** を選ぶ |
   | **値** | 次の5行をそのまま1つの値として入力する（1行ずつ改行でOK）：<br>`1 aspmx.l.google.com.`<br>`5 alt1.aspmx.l.google.com.`<br>`5 alt2.aspmx.l.google.com.`<br>`10 alt3.aspmx.l.google.com.`<br>`10 alt4.aspmx.l.google.com.` |
   | **TTL** | 300 または 3600 のまま |
   | **ルーティングポリシー** | 「シンプルルーティング」のまま |

   **ポイント**
   - 各 MX の行の**末尾のピリオド（.）** を忘れずにつける（例: `aspmx.l.google.com.`）。
   - レコード名は**空欄**にすると、`misesapo.app` 用の MX になる（`info@misesapo.app` を含む全アドレスが対象）。

3. **「レコードを作成」** をクリックして保存する。

---

### 4. 反映を待つ

- 変更後、**数分〜最大48時間** で世界中の DNS に反映されます（多くの場合は数分〜1時間以内）。
- 反映後、メールは **Google のサーバー** に届くようになり、Google Workspace の **info** ユーザーの受信トレイに届きます。

---

## 入力値のコピー用（値フィールドに貼り付け）

```
1 aspmx.l.google.com.
5 alt1.aspmx.l.google.com.
5 alt2.aspmx.l.google.com.
10 alt3.aspmx.l.google.com.
10 alt4.aspmx.l.google.com.
```

---

## うまくいかないとき

- **「レコード名」を空にできない**  
  → レコード名を `misesapo.app` または `@` にして、値は上と同じにする。
- **「値」を複数行で入れられない**  
  → 画面によっては1行ずつ「値を追加」で5回追加する。優先度とサーバー名は上表のとおり。
- **すでに MX があるが別のサーバー（Google 以外）**  
  → その MX を編集し、上記の Google 用の5行に書き換える（Google Workspace を使う場合）。

---

## 参照

- [EMAIL_TROUBLESHOOTING.md](./EMAIL_TROUBLESHOOTING.md) — 届かないときの全体の確認
- [GOOGLE_WORKSPACE_EMAIL_CHECK.md](./GOOGLE_WORKSPACE_EMAIL_CHECK.md) — Google メール設定の確認
