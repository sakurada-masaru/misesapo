# Cocoon子テーマ functions.php への追加コード

## 現在の状態
```php
<?php //子テーマ用関数
if ( !defined( 'ABSPATH' ) ) exit;

//子テーマ用のビジュアルエディタースタイルを適用
add_editor_style();

//以下に子テーマ用の関数を書く
```

## 追加するコード

**「//以下に子テーマ用の関数を書く」の下に、以下をコピー&ペーストしてください：**

```php
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
        return home_url('/wp-content/themes/cocoon-child-master/assets/images/' . $path);
    }
    
    // フォールバック: site_url()を使用
    if (function_exists('site_url')) {
        return site_url('/wp-content/themes/cocoon-child-master/assets/images/' . $path);
    }
    
    // 最終フォールバック: プロトコル相対URL
    if (isset($_SERVER['HTTP_HOST'])) {
        return '//' . $_SERVER['HTTP_HOST'] . '/wp-content/themes/cocoon-child-master/assets/images/' . $path;
    }
    
    // 最後の手段: 相対パス（非推奨）
    return '/wp-content/themes/cocoon-child-master/assets/images/' . $path;
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

## 完成後の functions.php の全体像

```php
<?php //子テーマ用関数
if ( !defined( 'ABSPATH' ) ) exit;

//子テーマ用のビジュアルエディタースタイルを適用
add_editor_style();

//以下に子テーマ用の関数を書く

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
        return home_url('/wp-content/themes/cocoon-child-master/assets/images/' . $path);
    }
    
    // フォールバック: site_url()を使用
    if (function_exists('site_url')) {
        return site_url('/wp-content/themes/cocoon-child-master/assets/images/' . $path);
    }
    
    // 最終フォールバック: プロトコル相対URL
    if (isset($_SERVER['HTTP_HOST'])) {
        return '//' . $_SERVER['HTTP_HOST'] . '/wp-content/themes/cocoon-child-master/assets/images/' . $path;
    }
    
    // 最後の手段: 相対パス（非推奨）
    return '/wp-content/themes/cocoon-child-master/assets/images/' . $path;
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

## 手順

1. **「//以下に子テーマ用の関数を書く」の下に、上記のコードをコピー&ペースト**
2. **「ファイルを更新」をクリック**
3. **サイトが正常に表示されるか確認**

## 注意点

- ファイルがまだ存在しない場合はエラーになります
- まずはアセットファイル（CSS/JS/画像）を配置してから追加してください
- エラーが出た場合は、エラーメッセージを確認してください

## 次のステップ

1. ✅ functions.php にコードを追加
2. ⬜ アセットファイルを配置
   - `wp-content/themes/cocoon-child/assets/css/`
   - `wp-content/themes/cocoon-child/assets/js/`
   - `wp-content/themes/cocoon-child/assets/images/`
3. ⬜ テンプレートファイルを作成
   - `wp-content/themes/cocoon-child/templates/hero-section.php`
   - `wp-content/themes/cocoon-child/templates/problem-section.php`

