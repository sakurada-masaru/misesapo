# WordPress環境 JSファイル整理ガイド

## ✅ 残すファイル（3つ）

以下の3つのJSファイルのみを残します：

1. ✅ `swiper-bundle.min.js` - Swiperライブラリ
2. ✅ `script.js` - メインスクリプト
3. ✅ `navigation.js` - ナビゲーション管理

---

## ❌ 削除するファイル

以下のファイルをXserverのファイルマネージャーから削除してください：

### 認証関連（WordPressの認証システムを使用）
- ❌ `auth.js`
- ❌ `client_auth.js`
- ❌ `firebase-auth.js`
- ❌ `firebase-config.js`

### 管理機能関連（WordPressの管理画面を使用）
- ❌ `master-backdoor.js`
- ❌ `role_config.js`
- ❌ `users.js`

---

## 📋 削除手順

### Xserverのファイルマネージャーで削除

1. **Xserverのサーバーパネルにログイン**
2. **ファイルマネージャー** を開く
3. 以下のパスに移動：
   ```
   /misesapo.site/public_html/corporate/wp-content/themes/lightning-child/assets/js/
   ```
4. 以下のファイルを選択して削除：
   - `auth.js`
   - `client_auth.js`
   - `firebase-auth.js`
   - `firebase-config.js`
   - `master-backdoor.js`
   - `role_config.js`
   - `users.js`

---

## ✅ 最終的なファイル構成

削除後、`/lightning-child/assets/js/` フォルダには以下の3つのファイルのみが残ります：

```
/lightning-child/assets/js/
├── swiper-bundle.min.js  ✅
├── script.js             ✅
└── navigation.js         ✅
```

---

## 📝 functions.php の確認

`functions.php` で以下の3つのファイルが読み込まれていることを確認：

```php
// JavaScript
wp_enqueue_script('swiper-js', $theme_uri . '/assets/js/swiper-bundle.min.js', array(), '1.0', true);
wp_enqueue_script('misesapo-script', $theme_uri . '/assets/js/script.js', array('jquery'), '1.0', true);
wp_enqueue_script('misesapo-navigation', $theme_uri . '/assets/js/navigation.js', array('jquery'), '1.0', true);
```

`auth.js` の読み込みがコメントアウトされていることを確認：

```php
// auth.jsはWordPress環境では不要（WordPressの認証システムを使用）
// wp_enqueue_script('misesapo-auth', $theme_uri . '/assets/js/auth.js', array('jquery'), '1.0', true);
```

---

## 🔍 削除後の確認

1. ページを表示して、エラーが出ないか確認
2. ナビゲーションが正しく動作するか確認
3. スライダーが正しく動作するか確認
4. ブラウザの開発者ツール（F12）でエラーがないか確認

---

## ⚠️ 注意事項

- 削除する前に、念のためバックアップを取ることを推奨します
- 削除後、ページが正常に表示されるか確認してください
- 問題が発生した場合は、ファイルを再度アップロードしてください


