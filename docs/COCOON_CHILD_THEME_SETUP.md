# Cocoon子テーマの functions.php 設定ガイド

## 概要
Cocoonテーマの子テーマ（Cocoon Child）にカスタム機能を追加する方法を説明します。

## 現在の状況
- 子テーマ: Cocoon Child
- 親テーマ: cocoon-master
- style.css は既に作成済み

## functions.php の作成

### ステップ1: functions.php ファイルを作成

子テーマのフォルダに `functions.php` を作成します：

```
wp-content/themes/cocoon-child/
├── style.css          ← 既存
└── functions.php      ← 新規作成
```

### ステップ2: functions.php の基本構造

```php
<?php
/**
 * Cocoon Child Theme functions.php
 * 
 * このファイルにカスタム機能を追加します
 */

// セキュリティ: 直接アクセスを防ぐ
if (!defined('ABSPATH')) {
    exit;
}

// ============================================
// 親テーマのスタイルを読み込む
// ============================================
function cocoon_child_enqueue_styles() {
    // 親テーマのスタイルを読み込む
    wp_enqueue_style('parent-style', get_template_directory_uri() . '/style.css');
    
    // 子テーマのスタイルを読み込む（style.css）
    wp_enqueue_style('child-style', 
        get_stylesheet_directory_uri() . '/style.css',
        array('parent-style'),
        wp_get_theme()->get('Version')
    );
}
add_action('wp_enqueue_scripts', 'cocoon_child_enqueue_styles');

// ============================================
// 以下、Misesapo用のカスタム機能を追加
// ============================================
```

## Misesapo用のカスタム機能を追加

### 完全な functions.php の例

```php
<?php
/**
 * Cocoon Child Theme functions.php
 * Misesapo カスタム機能
 */

// セキュリティ: 直接アクセスを防ぐ
if (!defined('ABSPATH')) {
    exit;
}

// ============================================
// 親テーマのスタイルを読み込む
// ============================================
function cocoon_child_enqueue_styles() {
    // 親テーマのスタイル
    wp_enqueue_style('parent-style', get_template_directory_uri() . '/style.css');
    
    // 子テーマのスタイル
    wp_enqueue_style('child-style', 
        get_stylesheet_directory_uri() . '/style.css',
        array('parent-style'),
        wp_get_theme()->get('Version')
    );
}
add_action('wp_enqueue_scripts', 'cocoon_child_enqueue_styles');

// ============================================
// Misesapo アセットファイルの読み込み
// ============================================
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
    wp_enqueue_script('misesapo-auth', $theme_uri . '/assets/js/auth.js', array('jquery'), '1.0', true);
}
add_action('wp_enqueue_scripts', 'misesapo_enqueue_assets', 20); // 優先度を20に設定（親テーマの後に読み込む）

// ============================================
// 画像パス用のヘルパー関数
// ============================================
function misesapo_image_url($path) {
    // 先頭のスラッシュを削除
    $path = ltrim($path, '/');
    return get_stylesheet_directory_uri() . '/assets/images/' . $path;
}

// 使用例: <?php echo misesapo_image_url('images-admin/hero-image001.png'); ?>

// ============================================
// ショートコード: ヒーローセクション
// ============================================
function misesapo_hero_section_shortcode($atts) {
    ob_start();
    $template_path = get_stylesheet_directory() . '/templates/hero-section.php';
    
    if (file_exists($template_path)) {
        include $template_path;
    } else {
        echo '<!-- テンプレートファイルが見つかりません: ' . $template_path . ' -->';
    }
    
    return ob_get_clean();
}
add_shortcode('misesapo_hero', 'misesapo_hero_section_shortcode');

// Elementorで使用: [misesapo_hero]

// ============================================
// ショートコード: お悩みセクション
// ============================================
function misesapo_problem_section_shortcode($atts) {
    ob_start();
    $template_path = get_stylesheet_directory() . '/templates/problem-section.php';
    
    if (file_exists($template_path)) {
        include $template_path;
    }
    
    return ob_get_clean();
}
add_shortcode('misesapo_problem', 'misesapo_problem_section_shortcode');

// ============================================
// インラインJavaScript（既存コードの統合）
// ============================================
function misesapo_inline_scripts() {
    ?>
    <script>
    (function($) {
        'use strict';
        
        // 既存のJavaScriptコードをここに配置
        $(document).ready(function() {
            // ヘッダーのスクロール処理
            const SCROLL_THRESHOLD = 150;
            const cosmeticHeader = $('.cosmetic-header');
            const normalHeader = $('.normal-header');
            let ticking = false;

            function updateHeaderState(scrollY) {
                if (scrollY > SCROLL_THRESHOLD) {
                    cosmeticHeader.addClass('hidden');
                    normalHeader.removeClass('hidden');
                } else {
                    cosmeticHeader.removeClass('hidden');
                    normalHeader.addClass('hidden');
                }
            }

            $(window).on('scroll', function() {
                if (!ticking) {
                    window.requestAnimationFrame(function() {
                        updateHeaderState($(window).scrollTop());
                        ticking = false;
                    });
                    ticking = true;
                }
            });
        });
        
    })(jQuery);
    </script>
    <?php
}
add_action('wp_footer', 'misesapo_inline_scripts');

// ============================================
// カスタムCSS（必要に応じて）
// ============================================
function misesapo_custom_css() {
    ?>
    <style>
    /* 既存のCSSをここに追加 */
    /* または、style.css に追加することを推奨 */
    </style>
    <?php
}
// add_action('wp_head', 'misesapo_custom_css'); // 必要に応じてコメントアウトを外す

// ============================================
// Elementorウィジェットの登録（オプション）
// ============================================
if (did_action('elementor/loaded')) {
    // Elementorが有効な場合のみ実行
    
    // カスタムElementorウィジェットを登録
    function register_misesapo_elementor_widgets($widgets_manager) {
        require_once get_stylesheet_directory() . '/includes/elementor-widgets.php';
    }
    add_action('elementor/widgets/register', 'register_misesapo_elementor_widgets');
    
    // Elementorカテゴリーの追加
    function add_misesapo_elementor_category($elements_manager) {
        $elements_manager->add_category(
            'misesapo',
            [
                'title' => __('Misesapo', 'misesapo'),
                'icon' => 'fa fa-plug',
            ]
        );
    }
    add_action('elementor/elements/categories_registered', 'add_misesapo_elementor_category');
}
```

## ファイル構成

Cocoon子テーマの推奨ファイル構成：

```
wp-content/themes/cocoon-child/
├── style.css                    ← 既存（そのまま使用）
├── functions.php                ← 新規作成（上記のコードを追加）
├── assets/
│   ├── css/
│   │   ├── style.css
│   │   └── swiper-bundle.min.css
│   ├── js/
│   │   ├── script.js
│   │   ├── navigation.js
│   │   └── auth.js
│   └── images/
│       ├── images-admin/
│       ├── images-service/
│       └── images-material/
└── templates/
    ├── hero-section.php
    └── problem-section.php
```

## 追加方法

### 方法1: WordPress管理画面から編集

1. WordPress管理画面にログイン
2. **外観 > テーマファイルエディター** に移動
3. **functions.php** を選択（なければ「新規ファイルを作成」）
4. 上記のコードを貼り付け
5. **ファイルを更新** をクリック

### 方法2: FTP/SSHで直接編集

```bash
# ファイルを作成
nano wp-content/themes/cocoon-child/functions.php

# または既存のファイルを編集
vim wp-content/themes/cocoon-child/functions.php
```

### 方法3: ローカルで編集してアップロード

1. ローカルで `functions.php` を作成
2. 上記のコードを保存
3. FTPで `wp-content/themes/cocoon-child/` にアップロード

## 注意点

### 1. Cocoonテーマとの競合を避ける

Cocoonテーマは独自の機能が多いため、以下の点に注意：

- 関数名の重複を避ける（`misesapo_` プレフィックスを使用）
- 優先度を調整（`add_action` の第3引数）
- Cocoonの既存機能を上書きしない

### 2. スタイルの優先順位

Cocoonのスタイルと競合する場合：

```php
// style.css に追加するか、インラインCSSで !important を使用
function misesapo_override_cocoon_styles() {
    ?>
    <style>
    .misesapo-section {
        /* !important を使用してCocoonのスタイルを上書き */
        background-color: #F8F4EC !important;
    }
    </style>
    <?php
}
add_action('wp_head', 'misesapo_override_cocoon_styles', 999);
```

### 3. エラーの確認

```php
// wp-config.php でデバッグモードを有効化
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
define('WP_DEBUG_DISPLAY', false);
```

エラーログは `wp-content/debug.log` に記録されます。

## テスト手順

1. **functions.php を追加**
2. **WordPress管理画面にアクセス**（エラーが出ないか確認）
3. **フロントエンドを確認**（スタイルが正しく読み込まれているか）
4. **Elementorでショートコードをテスト**（`[misesapo_hero]` など）

## トラブルシューティング

### エラー: Parse error
- PHPの構文エラー
- セミコロン（;）の欠落を確認
- 引用符の不一致を確認

### スタイルが適用されない
- ファイルパスを確認
- ブラウザのキャッシュをクリア
- Cocoonのスタイル優先度を確認

### JavaScriptが動作しない
- jQueryが読み込まれているか確認
- コンソールエラーを確認
- スクリプトの読み込み順序を確認

## 次のステップ

1. `functions.php` を作成・追加
2. アセットファイルを `assets/` フォルダに配置
3. テンプレートファイルを `templates/` フォルダに配置
4. Elementorでショートコードを使用してテスト

## 参考

- [Cocoon公式サイト](https://wp-cocoon.com/)
- [WordPress Codex: functions.php](https://codex.wordpress.org/Functions_File_Explained)
- [子テーマの作成方法](https://developer.wordpress.org/themes/advanced-topics/child-themes/)

