<?php
/**
 * WordPress + Elementor 移行用サンプルコード
 * 
 * このファイルは functions.php に追加するか、カスタムプラグインとして使用してください
 */

// ============================================
// 1. アセットファイルの読み込み
// ============================================
function misesapo_enqueue_assets() {
    $theme_uri = get_template_directory_uri();
    
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
add_action('wp_enqueue_scripts', 'misesapo_enqueue_assets');

// ============================================
// 2. 画像パス用のヘルパー関数
// ============================================
function misesapo_image_url($path) {
    // 先頭のスラッシュを削除
    $path = ltrim($path, '/');
    return get_template_directory_uri() . '/assets/' . $path;
}

// 使用例: <?php echo misesapo_image_url('images-admin/hero-image001.png'); ?>

// ============================================
// 3. ショートコード: ヒーローセクション
// ============================================
function misesapo_hero_section_shortcode($atts) {
    ob_start();
    include get_template_directory() . '/templates/hero-section.php';
    return ob_get_clean();
}
add_shortcode('misesapo_hero', 'misesapo_hero_section_shortcode');

// Elementorで使用: [misesapo_hero]

// ============================================
// 4. ショートコード: お悩みセクション
// ============================================
function misesapo_problem_section_shortcode($atts) {
    ob_start();
    include get_template_directory() . '/templates/problem-section.php';
    return ob_get_clean();
}
add_shortcode('misesapo_problem', 'misesapo_problem_section_shortcode');

// ============================================
// 5. カスタムElementorウィジェット: ヒーローセクション
// ============================================
class Misesapo_Hero_Widget extends \Elementor\Widget_Base {
    
    public function get_name() {
        return 'misesapo_hero';
    }
    
    public function get_title() {
        return __('Misesapo Hero Section', 'misesapo');
    }
    
    public function get_icon() {
        return 'eicon-slider-push';
    }
    
    public function get_categories() {
        return ['misesapo'];
    }
    
    protected function render() {
        include get_template_directory() . '/templates/hero-section.php';
    }
}

// Elementorウィジェットを登録
function register_misesapo_widgets($widgets_manager) {
    $widgets_manager->register(new \Misesapo_Hero_Widget());
}
add_action('elementor/widgets/register', 'register_misesapo_widgets');

// ============================================
// 6. Elementorカテゴリーの追加
// ============================================
function add_elementor_widget_categories($elements_manager) {
    $elements_manager->add_category(
        'misesapo',
        [
            'title' => __('Misesapo', 'misesapo'),
            'icon' => 'fa fa-plug',
        ]
    );
}
add_action('elementor/elements/categories_registered', 'add_elementor_widget_categories');

// ============================================
// 7. インラインJavaScript（既存コードの統合）
// ============================================
function misesapo_inline_scripts() {
    ?>
    <script>
    (function($) {
        'use strict';
        
        // 既存のJavaScriptコードをここに配置
        // 例: ヘッダーのスクロール処理
        $(document).ready(function() {
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
// 8. カスタムCSS（Elementor用）
// ============================================
function misesapo_elementor_custom_css() {
    ?>
    <style>
    /* 既存のCSSをここに追加 */
    /* または、Elementorの設定 > カスタムCSS に追加 */
    </style>
    <?php
}
add_action('wp_head', 'misesapo_elementor_custom_css');

// ============================================
// 9. テンプレートパーツの読み込み関数
// ============================================
function misesapo_get_template_part($template_name, $args = array()) {
    extract($args);
    include get_template_directory() . '/templates/' . $template_name . '.php';
}

// 使用例: misesapo_get_template_part('hero-section', array('title' => 'タイトル'));

// ============================================
// 10. 画像最適化用の関数
// ============================================
function misesapo_get_optimized_image($image_path, $size = 'full') {
    // WordPressの画像サイズ機能を活用
    $attachment_id = attachment_url_to_postid(misesapo_image_url($image_path));
    
    if ($attachment_id) {
        return wp_get_attachment_image($attachment_id, $size, false, array(
            'class' => 'img-cover',
            'loading' => 'lazy'
        ));
    }
    
    // フォールバック: 通常のimgタグ
    return '<img src="' . esc_url(misesapo_image_url($image_path)) . '" alt="" class="img-cover" loading="lazy">';
}

// ============================================
// 11. データファイル（JSON）の読み込み
// ============================================
function misesapo_get_json_data($file_path) {
    $full_path = get_template_directory() . '/assets/data/' . $file_path;
    
    if (file_exists($full_path)) {
        $json_content = file_get_contents($full_path);
        return json_decode($json_content, true);
    }
    
    return array();
}

// 使用例: $service_items = misesapo_get_json_data('service_items.json');

// ============================================
// 12. Elementorの条件付き表示（Pro版）
// ============================================
function misesapo_elementor_conditions($element) {
    // ログイン状態に応じた表示制御など
    if (is_user_logged_in()) {
        // ログイン済みユーザー向けの表示
    } else {
        // 未ログインユーザー向けの表示
    }
}
// Elementor Proの条件付き表示機能を使用する場合は、Elementorの設定から設定

// ============================================
// 13. カスタム投稿タイプ（必要に応じて）
// ============================================
function misesapo_register_custom_post_types() {
    // サービス投稿タイプ
    register_post_type('service', array(
        'labels' => array(
            'name' => 'サービス',
            'singular_name' => 'サービス'
        ),
        'public' => true,
        'has_archive' => true,
        'supports' => array('title', 'editor', 'thumbnail'),
        'menu_icon' => 'dashicons-admin-tools'
    ));
}
add_action('init', 'misesapo_register_custom_post_types');

// ============================================
// 14. パフォーマンス最適化
// ============================================
function misesapo_defer_scripts($tag, $handle, $src) {
    $defer_scripts = array('swiper-js', 'misesapo-script');
    
    if (in_array($handle, $defer_scripts)) {
        return str_replace(' src', ' defer src', $tag);
    }
    
    return $tag;
}
add_filter('script_loader_tag', 'misesapo_defer_scripts', 10, 3);

// ============================================
// 15. セキュリティ: ファイルアクセスの制限
// ============================================
function misesapo_restrict_file_access() {
    // .htaccess または nginx 設定で実装
    // 直接アクセスを制限するファイルを指定
}
// 実際の実装はサーバー設定ファイルで行う


