# Lightning Child functions.php 追加コード

## 概要
Lightning Childテーマの `functions.php` に追加するコードです。

## ファイルパス
```
/misesapo.site/public_html/corporate/wp-content/themes/lightning-child/functions.php
```

## 追加するコード

`functions.php` の最後に、以下のコードをコピー&ペーストしてください：

```php
// ============================================
// Misesapo アセットファイルの読み込み
// ============================================
function misesapo_enqueue_assets() {
    $theme_uri = get_stylesheet_directory_uri();
    
    // CSS
    wp_enqueue_style('ress-css', 'https://unpkg.com/ress@4.0.0/dist/ress.min.css', array(), '4.0.0');
    wp_enqueue_style('google-fonts', 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@100..900&display=swap', array(), null);
    wp_enqueue_style('swiper-css', $theme_uri . '/assets/css/swiper-bundle.min.css', array(), '1.0');
    wp_enqueue_style('misesapo-hero-css', $theme_uri . '/assets/css/hero-section.css', array(), '1.0');
    wp_enqueue_style('misesapo-hero-no-animation-css', $theme_uri . '/assets/css/hero-section-no-animation.css', array(), '1.0');
    wp_enqueue_style('misesapo-fixed-order-button-css', $theme_uri . '/assets/css/fixed-order-button.css', array(), '1.0');
    wp_enqueue_style('misesapo-mega-menu-css', $theme_uri . '/assets/css/mega-menu.css', array(), '1.0');
    wp_enqueue_style('misesapo-mega-menu-ishikawa-css', $theme_uri . '/assets/css/mega-menu-ishikawa.css', array(), '1.0');
    wp_enqueue_style('misesapo-style', $theme_uri . '/assets/css/style.css', array(), '1.0');
    
    // JavaScript
    wp_enqueue_script('swiper-js', $theme_uri . '/assets/js/swiper-bundle.min.js', array(), '1.0', true);
    wp_enqueue_script('misesapo-mega-menu-js', $theme_uri . '/assets/js/mega-menu.js', array('jquery'), '1.0', true);
    wp_enqueue_script('misesapo-script', $theme_uri . '/assets/js/script.js', array('jquery'), '1.0', true);
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
// ショートコード: ヒーローセクション（アニメーションなし）
// ============================================
function misesapo_hero_no_animation_shortcode($atts) {
    ob_start();
    $template_path = get_stylesheet_directory() . '/templates/hero-section-no-animation.php';
    
    if (file_exists($template_path)) {
        include $template_path;
    } else {
        echo '<!-- テンプレートファイルが見つかりません: ' . $template_path . ' -->';
    }
    
    return ob_get_clean();
}
add_shortcode('misesapo_hero_no_animation', 'misesapo_hero_no_animation_shortcode');

// ============================================
// ショートコード: 固定発注ボタン（円形ボタン + 回転テキスト）
// ============================================
function misesapo_fixed_order_button_shortcode($atts) {
    // ショートコードの属性を取得
    $atts = shortcode_atts(array(
        'url' => home_url('/service'), // デフォルトのリンク先
        'text' => '発注は<br>こちらから', // ボタン内のテキスト
        'rotating_text' => 'Welcome to Misesapo! To place an order, click here. For any questions, please contact us!', // 回転テキスト
        'bottom' => '50px', // 下からの位置
        'right' => '50px', // 右からの位置
    ), $atts);
    
    ob_start();
    $template_path = get_stylesheet_directory() . '/templates/fixed-order-button.php';
    
    if (file_exists($template_path)) {
        include $template_path;
    } else {
        echo '<!-- テンプレートファイルが見つかりません: ' . $template_path . ' -->';
    }
    
    return ob_get_clean();
}
add_shortcode('misesapo_fixed_order_button', 'misesapo_fixed_order_button_shortcode');

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
// ショートコード: スクロールヒントアニメーション
// ============================================
function misesapo_scroll_hint_shortcode($atts) {
    ob_start();
    $template_path = get_stylesheet_directory() . '/templates/scroll-hint.php';
    
    if (file_exists($template_path)) {
        include $template_path;
    } else {
        echo '<!-- テンプレートファイルが見つかりません: ' . $template_path . ' -->';
    }
    
    return ob_get_clean();
}
add_shortcode('misesapo_scroll_hint', 'misesapo_scroll_hint_shortcode');

// ============================================
// ショートコード: メガメニュー
// ============================================
function misesapo_mega_menu_shortcode($atts) {
    ob_start();
    $template_path = get_stylesheet_directory() . '/templates/mega-menu.php';
    
    if (file_exists($template_path)) {
        include $template_path;
    } else {
        echo '<!-- テンプレートファイルが見つかりません: ' . $template_path . ' -->';
    }
    
    return ob_get_clean();
}
add_shortcode('misesapo_mega_menu', 'misesapo_mega_menu_shortcode');

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

## 追加方法

### 方法1: WordPress管理画面から編集（推奨）

1. WordPress管理画面にログイン
2. **外観** → **テーマファイルエディター** に移動
3. 右側の「テーマファイル」から **functions.php** を選択
4. ファイルの最後に上記のコードを貼り付け
5. **ファイルを更新** をクリック
6. エラーが出ないか確認

### 方法2: Xserverのファイルマネージャーで編集

1. Xserverのサーバーパネルにログイン
2. **ファイルマネージャー** を開く
3. 以下のパスに移動：
   ```
   /misesapo.site/public_html/corporate/wp-content/themes/lightning-child/
   ```
4. **functions.php** をクリック
5. **編集** をクリック
6. ファイルの最後に上記のコードを貼り付け
7. **保存** をクリック

## 注意事項

- 既存の `functions.php` にコードがある場合は、その下に追加してください
- PHPの構文エラーがないか確認してください
- コードを追加後、サイトが正常に表示されるか確認してください
- エラーが出た場合は、追加したコードを削除して元に戻してください

## 次のステップ

`functions.php` へのコード追加が完了したら：
1. フォルダ構造の作成
2. アセットファイルのアップロード
3. テンプレートファイルのアップロード

詳細は `LIGHTNING_CHILD_SETUP_GUIDE.md` を参照してください。

