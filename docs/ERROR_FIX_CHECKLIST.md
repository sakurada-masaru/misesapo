# エラー修正チェックリスト

## 🔴 現在のエラー

1. `script.js:10` - `Cannot read properties of null (reading 'addEventListener')`
2. `auth.js:557` - `signin.html`へのリダイレクト（404エラー）
3. `main.js` - Lightningテーマのエラー（無視可能）

---

## ✅ 修正手順

### ステップ1: `functions.php` の確認

`functions.php` で `auth.js` の読み込みがコメントアウトされているか確認：

```php
// 正しい状態:
// auth.jsはWordPress環境では不要（WordPressの認証システムを使用）
// wp_enqueue_script('misesapo-auth', $theme_uri . '/assets/js/auth.js', array('jquery'), '1.0', true);
```

**確認方法:**
1. WordPress管理画面 → **外観** → **テーマファイルエディター**
2. `functions.php` を開く
3. `auth.js` の行がコメントアウトされているか確認

**もしコメントアウトされていない場合:**
- 該当行をコメントアウトしてください

---

### ステップ2: 修正した `script.js` をアップロード

修正した `script.js` をXserverにアップロード：

1. **ローカルファイル**: `public/js/script.js`
2. **アップロード先**: `/lightning-child/assets/js/script.js`
3. **既存ファイルを上書き**

**確認方法:**
- アップロード後、ブラウザで直接アクセス：
  ```
  https://misesapo.site/wp-content/themes/lightning-child/assets/js/script.js
  ```
- 10行目に `if (btn && g_nav) {` があることを確認

---

### ステップ3: `auth.js` ファイルを削除

`auth.js` ファイルがサーバー上に残っている場合、削除：

1. Xserverのファイルマネージャーで以下に移動：
   ```
   /lightning-child/assets/js/
   ```
2. `auth.js` を削除

**注意:** `functions.php` でコメントアウトしていても、ファイルが存在すると他の場所から読み込まれる可能性があります。

---

### ステップ4: ブラウザのキャッシュをクリア

1. **開発者ツールを開く**（F12）
2. **ネットワークタブ**を開く
3. **「キャッシュを無効にする」**にチェック
4. **ページを再読み込み**（Ctrl+Shift+R または Cmd+Shift+R）

または、**シークレットモード**でページを開いて確認

---

### ステップ5: WordPressのキャッシュをクリア

WordPressのキャッシュプラグインを使用している場合：

1. キャッシュプラグインの設定から「キャッシュをクリア」
2. または、WordPress管理画面から「パーマリンク設定」を再保存

---

## 🔍 確認項目

### `functions.php` の確認

以下の3つのJSファイルのみが読み込まれていることを確認：

```php
// JavaScript
wp_enqueue_script('swiper-js', $theme_uri . '/assets/js/swiper-bundle.min.js', array(), '1.0', true);
wp_enqueue_script('misesapo-script', $theme_uri . '/assets/js/script.js', array('jquery'), '1.0', true);
wp_enqueue_script('misesapo-navigation', $theme_uri . '/assets/js/navigation.js', array('jquery'), '1.0', true);
// auth.jsはコメントアウトされている
// wp_enqueue_script('misesapo-auth', $theme_uri . '/assets/js/auth.js', array('jquery'), '1.0', true);
```

### `script.js` の確認

10行目に以下のコードがあることを確認：

```javascript
if (btn && g_nav) {
    btn.addEventListener('click', () => {
```

### サーバー上のファイル確認

`/lightning-child/assets/js/` フォルダに以下のファイルのみが存在：

- ✅ `swiper-bundle.min.js`
- ✅ `script.js`
- ✅ `navigation.js`
- ❌ `auth.js` は存在しない（削除済み）

---

## 🚨 まだエラーが出る場合

### 1. `script.js` のバージョン番号を変更

`functions.php` で `script.js` のバージョン番号を変更：

```php
// 変更前:
wp_enqueue_script('misesapo-script', $theme_uri . '/assets/js/script.js', array('jquery'), '1.0', true);

// 変更後:
wp_enqueue_script('misesapo-script', $theme_uri . '/assets/js/script.js', array('jquery'), '1.1', true);
```

これにより、ブラウザが新しいファイルを読み込むようになります。

### 2. ブラウザの開発者ツールで確認

1. 開発者ツール（F12）を開く
2. **ネットワークタブ**を開く
3. ページを再読み込み
4. `script.js` と `auth.js` が読み込まれているか確認
5. `script.js` の内容を確認（10行目をチェック）

### 3. 直接ファイルにアクセスして確認

ブラウザで直接アクセス：

- `https://misesapo.site/wp-content/themes/lightning-child/assets/js/script.js`
- 10行目に `if (btn && g_nav) {` があるか確認

---

## 📝 まとめ

1. ✅ `functions.php` で `auth.js` をコメントアウト
2. ✅ 修正した `script.js` をアップロード
3. ✅ `auth.js` ファイルを削除
4. ✅ ブラウザのキャッシュをクリア
5. ✅ WordPressのキャッシュをクリア

これらをすべて実行してもエラーが続く場合は、エラーメッセージの詳細を教えてください。


