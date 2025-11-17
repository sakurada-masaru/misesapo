<?php
/**
 * ヒーローセクション テンプレート（アニメーションなし版）
 * 
 * エックスサーバーのファイルマネージャーで以下にアップロード:
 * /misesapo.site/public_html/corporate/wp-content/themes/lightning-child/templates/hero-section-no-animation.php
 */

if (!function_exists('misesapo_image_url')) {
    function misesapo_image_url($path) {
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
            $theme_slug = function_exists('get_option') ? get_option('stylesheet') : 'lightning-child';
            return home_url('/wp-content/themes/' . $theme_slug . '/assets/images/' . $path);
        }
        
        // フォールバック: site_url()を使用
        if (function_exists('site_url')) {
            $theme_slug = function_exists('get_option') ? get_option('stylesheet') : 'lightning-child';
            return site_url('/wp-content/themes/' . $theme_slug . '/assets/images/' . $path);
        }
        
        // 最終フォールバック: プロトコル相対URL
        if (isset($_SERVER['HTTP_HOST'])) {
            $theme_slug = function_exists('get_option') ? get_option('stylesheet') : 'lightning-child';
            return '//' . $_SERVER['HTTP_HOST'] . '/wp-content/themes/' . $theme_slug . '/assets/images/' . $path;
        }
        
        // 最後の手段: 相対パス（非推奨）
        return '/wp-content/themes/lightning-child/assets/images/' . $path;
    }
}
?>

<!-- ヒーローセクション（アニメーションなし） -->
<section class="fullscreen-image-section no-animation" id="hero">
    <div class="fullscreen-image-wrapper">
        <!-- 最初の画像のみ表示（アニメーションなし） -->
        <img src="<?php echo esc_url(misesapo_image_url('images-admin/hero-image001.png')); ?>" 
             alt="ヒーロー画像" 
             class="fullscreen-image fullscreen-image-static">
    </div>
    
    <!-- マスク画像 -->
    <div class="hero-mask">
        <img src="<?php echo esc_url(misesapo_image_url('images-admin/mask-hero001.png')); ?>" 
             alt="マスク" 
             class="hero-mask-image">
    </div>
</section>

<script>
// ヒーローセクションの高さ調整（アニメーションなし）
(function() {
    function setHeroSectionHeight() {
        const maskImage = document.querySelector('.hero-mask-image');
        const heroSection = document.querySelector('.fullscreen-image-section.no-animation');
        const imageWrapper = document.querySelector('.fullscreen-image-wrapper');
        
        if (maskImage && heroSection && imageWrapper) {
            const maskHeight = maskImage.offsetHeight;
            heroSection.style.height = (maskHeight - 5) + 'px';
            imageWrapper.style.height = maskHeight + 'px';
        }
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setHeroSectionHeight);
    } else {
        setHeroSectionHeight();
    }
    
    window.addEventListener('resize', setHeroSectionHeight);
    
    // 画像読み込み完了時にも実行
    const maskImage = document.querySelector('.hero-mask-image');
    if (maskImage) {
        if (maskImage.complete) {
            setHeroSectionHeight();
        } else {
            maskImage.addEventListener('load', setHeroSectionHeight);
        }
    }
})();
</script>

