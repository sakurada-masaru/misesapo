# WordPress環境で必要なJSファイル チェックリスト

## ✅ 必要なJSファイル（functions.phpで読み込んでいる）

WordPress環境で実際に使用するJSファイルは以下の3つのみです：

### 1. `swiper-bundle.min.js` ✅ 必要
- **用途**: Swiper.jsライブラリ（スライダー機能）
- **読み込み**: `functions.php`で読み込み済み
- **場所**: `/lightning-child/assets/js/swiper-bundle.min.js`

### 2. `script.js` ✅ 必要
- **用途**: メインのJavaScript（アニメーション、フォーム処理など）
- **読み込み**: `functions.php`で読み込み済み
- **場所**: `/lightning-child/assets/js/script.js`
- **注意**: 修正済み（要素の存在チェックを追加）

### 3. `navigation.js` ⚠️ 要確認
- **用途**: ナビゲーション生成とヘッダー管理
- **読み込み**: `functions.php`で読み込み済み
- **場所**: `/lightning-child/assets/js/navigation.js`
- **注意**: WordPressのメニューシステムを使用する場合、不要な可能性あり

---

## ❌ 不要なJSファイル（削除推奨）

以下のファイルはWordPress環境では不要です。削除しても問題ありません：

### 認証関連（WordPressの認証システムを使用）
- ❌ `auth.js` - Firebase認証（不要）
- ❌ `client_auth.js` - クライアント認証（不要）
- ❌ `firebase-auth.js` - Firebase認証（不要）
- ❌ `firebase-config.js` - Firebase設定（不要）

### 管理機能関連（WordPressの管理画面を使用）
- ❌ `master-backdoor.js` - マスターバックドア（不要）
- ❌ `role_config.js` - ロール設定（不要）
- ❌ `users.js` - ユーザー管理（不要）

---

## 📋 推奨アクション

### オプション1: 不要なファイルを削除（推奨）

Xserverのファイルマネージャーで、以下のファイルを削除：

```
/lightning-child/assets/js/auth.js
/lightning-child/assets/js/client_auth.js
/lightning-child/assets/js/firebase-auth.js
/lightning-child/assets/js/firebase-config.js
/lightning-child/assets/js/master-backdoor.js
/lightning-child/assets/js/role_config.js
/lightning-child/assets/js/users.js
```

### オプション2: そのまま残す

削除しなくても、`functions.php`で読み込んでいないため、エラーにはなりません。
ただし、誤って読み込まれる可能性があるため、削除を推奨します。

---

## 🔍 `navigation.js`について

`navigation.js`は、ロールベースのナビゲーション生成を行っています。
WordPress環境では、WordPressのメニューシステムを使用するため、このファイルは不要な可能性があります。

### 確認方法

1. ページを表示して、ナビゲーションが正しく動作するか確認
2. エラーが出ないか確認
3. 問題がなければ、`functions.php`から`navigation.js`の読み込みをコメントアウト

### `functions.php`から削除する場合

```php
// 変更前:
wp_enqueue_script('misesapo-navigation', $theme_uri . '/assets/js/navigation.js', array('jquery'), '1.0', true);

// 変更後:
// navigation.jsはWordPressのメニューシステムを使用するため不要
// wp_enqueue_script('misesapo-navigation', $theme_uri . '/assets/js/navigation.js', array('jquery'), '1.0', true);
```

---

## ✅ 最終的な必要なファイル

WordPress環境で必要なJSファイルは以下の2つのみ：

1. ✅ `swiper-bundle.min.js` - Swiperライブラリ
2. ✅ `script.js` - メインスクリプト

`navigation.js`は、WordPressのメニューシステムを使用する場合は不要です。

---

## 📝 まとめ

**現在`functions.php`で読み込んでいるファイル:**
- ✅ `swiper-bundle.min.js` - 必要
- ✅ `script.js` - 必要
- ⚠️ `navigation.js` - 要確認（不要な可能性あり）
- ❌ `auth.js` - コメントアウト済み（不要）

**削除推奨ファイル:**
- `auth.js`
- `client_auth.js`
- `firebase-auth.js`
- `firebase-config.js`
- `master-backdoor.js`
- `role_config.js`
- `users.js`


