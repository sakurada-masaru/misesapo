# functions.php 修正版

## 修正箇所

1. `auth.js` の読み込みをコメントアウト
2. `script.js` のバージョン番号を `1.0` から `1.1` に変更（キャッシュ対策）

---

## 修正後の `functions.php`

以下のコードを `functions.php` にコピー&ペーストしてください：

```php
<?php
/**
 * Lightning Child theme functions
 *
 * @package lightning
 */

/************************************************
 * 独自CSSファイルの読み込み処理
 *
 * 主に CSS を SASS で 書きたい人用です。 素の CSS を直接書くなら style.css に記載してかまいません.
 */

// 独自のCSSファイル（assets/css/）を読み込む場合は true に変更してください.
$my_lightning_additional_css = false;

if ( $my_lightning_additional_css ) {
	// 公開画面側のCSSの読み込み.
	add_action(
		'wp_enqueue_scripts',
		function() {
			wp_enqueue_style(
				'my-lightning-custom',
				get_stylesheet_directory_uri() . '/assets/css/style.css',
				array( 'lightning-design-style' ),
				filemtime( dirname( __FILE__ ) . '/assets/css/style.css' )
			);
		}
	);
	// 編集画面側のCSSの読み込み.
	add_action(
		'enqueue_block_editor_assets',
		function() {
			wp_enqueue_style(
				'my-lightning-editor-custom',
				get_stylesheet_directory_uri() . '/assets/css/editor.css',
				array( 'wp-edit-blocks', 'lightning-gutenberg-editor' ),
				filemtime( dirname( __FILE__ ) . '/assets/css/editor.css' )
			);
		}
	);
}

/************************************************
 * 独自の処理を必要に応じて書き足します
 */
// ============================================
// Misesapo アセットファイルの読み込み
// ============================================
function misesapo_enqueue_assets() {
    $theme_uri = get_stylesheet_directory_uri();
    
    // CSS
    wp_enqueue_style('ress-css', 'https://unpkg.com/ress@4.0.0/dist/ress.min.css', array(), '4.0.0');
    wp_enqueue_style('google-fonts', 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@100..900&display=swap', array(), null);
    wp_enqueue_style('swiper-css', $theme_uri . '/assets/css/swiper-bundle.min.css', array(), '1.0');
    wp_enqueue_style('misesapo-style', $theme_uri . '/assets/css/style.css', array(), '1.0');
    
    // JavaScript
    wp_enqueue_script('swiper-js', $theme_uri . '/assets/js/swiper-bundle.min.js', array(), '1.0', true);
    wp_enqueue_script('misesapo-script', $theme_uri . '/assets/js/script.js', array('jquery'), '1.1', true); // バージョン1.1に変更
    wp_enqueue_script('misesapo-navigation', $theme_uri . '/assets/js/navigation.js', array('jquery'), '1.0', true);
    // auth.jsはWordPress環境では不要（WordPressの認証システムを使用）
    // wp_enqueue_script('misesapo-auth', $theme_uri . '/assets/js/auth.js', array('jquery'), '1.0', true);
}
add_action('wp_enqueue_scripts', 'misesapo_enqueue_assets', 20);

// ============================================
// 画像パス用のヘルパー関数
// ============================================
function misesapo_image_url($path) {
    // 先頭のスラッシュを削除
    $path = ltrim($path, '/');
    
    // WordPressのコンテキスト内で実行されている場合
    if (function_exists('get_stylesheet_directory_uri')) {
        $theme_uri = get_stylesheet_directory_uri();
        // 空でないことを確認し、http://またはhttps://で始まることを確認
        if (!empty($theme_uri) && (strpos($theme_uri, 'http://') === 0 || strpos($theme_uri, 'https://') === 0)) {
            return trailingslashit($theme_uri) . 'assets/images/' . $path;
        }
    }
    
    // フォールバック: home_url()を使用（より確実）
    if (function_exists('home_url')) {
        // テーマフォルダ名を動的に取得
        $theme_slug = get_option('stylesheet');
        return home_url('/wp-content/themes/' . $theme_slug . '/assets/images/' . $path);
    }
    
    // フォールバック: site_url()を使用
    if (function_exists('site_url')) {
        $theme_slug = get_option('stylesheet');
        return site_url('/wp-content/themes/' . $theme_slug . '/assets/images/' . $path);
    }
    
    // 最終フォールバック: プロトコル相対URL
    if (isset($_SERVER['HTTP_HOST'])) {
        $theme_slug = get_option('stylesheet');
        return '//' . $_SERVER['HTTP_HOST'] . '/wp-content/themes/' . $theme_slug . '/assets/images/' . $path;
    }
    
    // 最後の手段: 相対パス（非推奨）
    return '/wp-content/themes/lightning-child/assets/images/' . $path;
}

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
// ショートコード: お問い合わせボタンセクション
// ============================================
function misesapo_contact_box_section_shortcode($atts) {
    ob_start();
    $template_path = get_stylesheet_directory() . '/templates/contact-box-section.php';
    
    if (file_exists($template_path)) {
        include $template_path;
    } else {
        echo '<!-- テンプレートファイルが見つかりません: ' . $template_path . ' -->';
    }
    
    return ob_get_clean();
}
add_shortcode('misesapo_contact_box', 'misesapo_contact_box_section_shortcode');

// ============================================
// インラインJavaScript（ヘッダースクロール処理など）
// ============================================
function misesapo_inline_scripts() {
    ?>
    <script>
    (function($) {
        'use strict';
        
        $(document).ready(function() {
            // ヘッダーのスクロール処理
            const SCROLL_THRESHOLD = 150;
            const cosmeticHeader = $('.cosmetic-header');
            const normalHeader = $('.normal-header');
            let ticking = false;

            if (cosmeticHeader.length && normalHeader.length) {
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
            }
        });
        
    })(jQuery);
    </script>
    <?php
}
add_action('wp_footer', 'misesapo_inline_scripts');
```

---

## 変更点

### 1. `auth.js` の読み込みをコメントアウト

**変更前:**
```php
wp_enqueue_script('misesapo-auth', $theme_uri . '/assets/js/auth.js', array('jquery'), '1.0', true);
```

**変更後:**
```php
// auth.jsはWordPress環境では不要（WordPressの認証システムを使用）
// wp_enqueue_script('misesapo-auth', $theme_uri . '/assets/js/auth.js', array('jquery'), '1.0', true);
```

### 2. `script.js` のバージョン番号を変更

**変更前:**
```php
wp_enqueue_script('misesapo-script', $theme_uri . '/assets/js/script.js', array('jquery'), '1.0', true);
```

**変更後:**
```php
wp_enqueue_script('misesapo-script', $theme_uri . '/assets/js/script.js', array('jquery'), '1.1', true); // バージョン1.1に変更
```

---

## 更新手順

1. WordPress管理画面 → **外観** → **テーマファイルエディター**
2. `functions.php` を選択
3. 上記のコード全体をコピー&ペースト
4. **ファイルを更新** をクリック
5. エラーが出ないか確認

---

## 更新後の確認

1. ページを再読み込み
2. ブラウザの開発者ツール（F12）でエラーがないか確認
3. `auth.js` が読み込まれていないことを確認（ネットワークタブで確認）


