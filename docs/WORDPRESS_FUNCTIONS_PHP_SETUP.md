# WordPress functions.php への追加方法

## 概要
WordPressテーマの `functions.php` にカスタムコードを追加する方法を説明します。

## 方法1: 子テーマの functions.php に追加（推奨）

### なぜ子テーマを使うのか？
- 親テーマの更新時にコードが消えない
- 安全にカスタマイズできる
- ベストプラクティス

### 手順

#### ステップ1: 子テーマの作成

1. **wp-content/themes/** ディレクトリに新しいフォルダを作成
   ```
   wp-content/themes/misesapo-child/
   ```

2. **style.css** を作成
   ```css
   /*
   Theme Name: Misesapo Child
   Template: twentytwentyfour
   Version: 1.0.0
   */
   
   @import url("../twentytwentyfour/style.css");
   ```
   ※ `Template:` の値は使用している親テーマ名に変更してください

3. **functions.php** を作成
   ```php
   <?php
   /**
    * Misesapo Child Theme functions.php
    */
   
   // 親テーマのスタイルを読み込む
   function misesapo_child_enqueue_styles() {
       wp_enqueue_style('parent-style', get_template_directory_uri() . '/style.css');
   }
   add_action('wp_enqueue_scripts', 'misesapo_child_enqueue_styles');
   
   // ここにカスタムコードを追加
   ```

#### ステップ2: 子テーマを有効化

1. WordPress管理画面にログイン
2. **外観 > テーマ** に移動
3. 「Misesapo Child」テーマを有効化

#### ステップ3: カスタムコードを追加

1. **外観 > テーマファイルエディター** に移動
2. **functions.php** を選択
3. 既存のコードの下に、`WORDPRESS_ELEMENTOR_EXAMPLES.php` の内容を追加

または、FTP/SSHで直接編集：
```bash
# ファイルを開く
nano wp-content/themes/misesapo-child/functions.php
```

## 方法2: 親テーマの functions.php に直接追加（非推奨）

⚠️ **注意**: 親テーマを更新するとコードが消えます

### 手順

1. **外観 > テーマファイルエディター** に移動
2. **functions.php** を選択
3. ファイルの最後（`?>` の前、または最後の行）にコードを追加

## 方法3: カスタムプラグインとして作成（推奨）

### メリット
- テーマに依存しない
- テーマを変更しても機能が残る
- 再利用可能

### 手順

#### ステップ1: プラグインフォルダの作成

```
wp-content/plugins/misesapo-custom/
```

#### ステップ2: プラグインファイルの作成

**misesapo-custom.php** を作成：
```php
<?php
/**
 * Plugin Name: Misesapo Custom Functions
 * Plugin URI: https://example.com
 * Description: Misesapoサイト用のカスタム機能
 * Version: 1.0.0
 * Author: Your Name
 * Author URI: https://example.com
 * License: GPL v2 or later
 */

// セキュリティ: 直接アクセスを防ぐ
if (!defined('ABSPATH')) {
    exit;
}

// ここに WORDPRESS_ELEMENTOR_EXAMPLES.php の内容を追加
require_once plugin_dir_path(__FILE__) . 'includes/functions.php';
```

#### ステップ3: 関数ファイルの作成

**includes/functions.php** を作成し、`WORDPRESS_ELEMENTOR_EXAMPLES.php` の内容をコピー

#### ステップ4: プラグインを有効化

1. WordPress管理画面にログイン
2. **プラグイン > インストール済みプラグイン** に移動
3. 「Misesapo Custom Functions」を有効化

## 具体的な追加手順（子テーマの場合）

### 完全な functions.php の例

```php
<?php
/**
 * Misesapo Child Theme functions.php
 */

// セキュリティ: 直接アクセスを防ぐ
if (!defined('ABSPATH')) {
    exit;
}

// ============================================
// 親テーマのスタイルを読み込む
// ============================================
function misesapo_child_enqueue_styles() {
    wp_enqueue_style('parent-style', get_template_directory_uri() . '/style.css');
}
add_action('wp_enqueue_scripts', 'misesapo_child_enqueue_styles');

// ============================================
// 以下、WORDPRESS_ELEMENTOR_EXAMPLES.php の内容を追加
// ============================================

// 1. アセットファイルの読み込み
function misesapo_enqueue_assets() {
    $theme_uri = get_stylesheet_directory_uri(); // 子テーマのURI
    
    // CSS
    wp_enqueue_style('ress-css', 'https://unpkg.com/ress@4.0.0/dist/ress.min.css', array(), '4.0.0');
    wp_enqueue_style('google-fonts', 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@100..900&display=swap', array(), null);
    wp_enqueue_style('swiper-css', $theme_uri . '/assets/css/swiper-bundle.min.css', array(), '1.0');
    wp_enqueue_style('misesapo-style', $theme_uri . '/assets/css/style.css', array(), '1.0');
    
    // JavaScript
    wp_enqueue_script('swiper-js', $theme_uri . '/assets/js/swiper-bundle.min.js', array(), '1.0', true);
    wp_enqueue_script('misesapo-script', $theme_uri . '/assets/js/script.js', array('jquery'), '1.0', true);
    wp_enqueue_script('misesapo-navigation', $theme_uri . '/assets/js/navigation.js', array('jquery'), '1.0', true);
}
add_action('wp_enqueue_scripts', 'misesapo_enqueue_assets');

// 2. 画像パス用のヘルパー関数
function misesapo_image_url($path) {
    $path = ltrim($path, '/');
    return get_stylesheet_directory_uri() . '/assets/images/' . $path;
}

// 3. ショートコード: ヒーローセクション
function misesapo_hero_section_shortcode($atts) {
    ob_start();
    include get_stylesheet_directory() . '/templates/hero-section.php';
    return ob_get_clean();
}
add_shortcode('misesapo_hero', 'misesapo_hero_section_shortcode');

// ... 以下、必要な関数を追加 ...
```

## ファイルパスの違い

### 子テーマを使用する場合
- `get_stylesheet_directory()` - 子テーマのパス
- `get_stylesheet_directory_uri()` - 子テーマのURL

### 親テーマを使用する場合
- `get_template_directory()` - 親テーマのパス
- `get_template_directory_uri()` - 親テーマのURL

## エラーの確認方法

### 1. 構文エラーの確認

WordPress管理画面でエラーが表示される場合：
- **外観 > テーマファイルエディター** でエラーメッセージを確認
- または、`wp-config.php` でデバッグモードを有効化：
  ```php
  define('WP_DEBUG', true);
  define('WP_DEBUG_LOG', true);
  define('WP_DEBUG_DISPLAY', false);
  ```

### 2. ログファイルの確認

```
wp-content/debug.log
```

### 3. よくあるエラー

**エラー: Parse error: syntax error**
- PHPの構文エラー
- セミコロン（;）の欠落
- 引用符の不一致

**エラー: Call to undefined function**
- 関数名のタイプミス
- 必要なファイルが読み込まれていない

**エラー: Cannot redeclare function**
- 同じ関数が2回定義されている
- 既存のプラグインと関数名が重複

## 安全な追加方法

### 1. バックアップを取る
```bash
# functions.php のバックアップ
cp functions.php functions.php.backup
```

### 2. 少しずつ追加
- 一度に全部追加せず、機能ごとに追加
- 動作確認してから次を追加

### 3. コメントアウトでテスト
```php
// 一時的に無効化
/*
function test_function() {
    // コード
}
*/
```

## 推奨されるファイル構成

```
wp-content/themes/misesapo-child/
├── style.css
├── functions.php          ← ここに追加
├── assets/
│   ├── css/
│   │   ├── style.css
│   │   └── swiper-bundle.min.css
│   ├── js/
│   │   ├── script.js
│   │   └── navigation.js
│   └── images/
│       ├── images-admin/
│       └── images-service/
└── templates/
    ├── hero-section.php
    └── problem-section.php
```

## まとめ

1. **子テーマを作成**（推奨）
2. **functions.php を開く**
3. **既存のコードの下に追加**
4. **保存して動作確認**

## 参考リンク

- [WordPress Codex: functions.php](https://codex.wordpress.org/Functions_File_Explained)
- [子テーマの作成方法](https://developer.wordpress.org/themes/advanced-topics/child-themes/)
- [プラグイン開発ガイド](https://developer.wordpress.org/plugins/)

