<?php
/**
 * テンプレート例: ヒーローセクション
 * 
 * このファイルを wp-content/themes/your-theme/templates/hero-section.php に配置
 * ElementorのカスタムHTMLウィジェットまたはショートコードで使用
 */

// 画像パスのヘルパー関数（functions.phpで定義されている前提）
if (!function_exists('misesapo_image_url')) {
    function misesapo_image_url($path) {
        return get_template_directory_uri() . '/assets/' . ltrim($path, '/');
    }
}
?>

<!-- ヒーローセクション -->
<section class="fullscreen-image-section" id="hero">
    <div class="fullscreen-image-wrapper">
        <img src="<?php echo esc_url(misesapo_image_url('images-admin/hero-image001.png')); ?>" 
             alt="ヒーロー画像1" 
             class="hero-img hero-img-1">
        <img src="<?php echo esc_url(misesapo_image_url('images-admin/hero-image002.png')); ?>" 
             alt="ヒーロー画像2" 
             class="hero-img hero-img-2">
        <img src="<?php echo esc_url(misesapo_image_url('images-admin/hero-image003.png')); ?>" 
             alt="ヒーロー画像3" 
             class="hero-img hero-img-3">
    </div>
    
    <!-- マスク画像 -->
    <div class="hero-mask">
        <img src="<?php echo esc_url(misesapo_image_url('images-admin/mask-hero001.png')); ?>" 
             alt="マスク" 
             class="hero-mask-image">
    </div>
    
    <!-- スクロールヒント -->
    <div class="hero-scroll-hint">
        <p>↑ SCROLL ↓</p>
    </div>
</section>

<script>
// ヒーローセクションの高さ調整（既存のJavaScript）
(function() {
    function setHeroSectionHeight() {
        const maskImage = document.querySelector('.hero-mask-image');
        const heroSection = document.querySelector('.fullscreen-image-section');
        const imageWrapper = document.querySelector('.fullscreen-image-wrapper');
        
        if (maskImage && heroSection && imageWrapper) {
            const maskHeight = maskImage.offsetHeight;
            heroSection.style.height = (maskHeight - 5) + 'px';
            imageWrapper.style.height = (maskHeight - 5) + 'px';
        }
    }
    
    // ページ読み込み時とリサイズ時に実行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setHeroSectionHeight);
    } else {
        setHeroSectionHeight();
    }
    
    window.addEventListener('resize', setHeroSectionHeight);
})();
</script>

<?php
/**
 * テンプレート例: お悩みセクション
 * 
 * このファイルを wp-content/themes/your-theme/templates/problem-section.php に配置
 */
?>

<article id="problem" class="problem-bg section-box">
    <div class="wrapper problem-box">
        <h2 class="h2-title problem-h2 border-line fadeUp">こんなお悩みありませんか？</h2>
        <ul class="fadeUp">
            <li>
                <span class="problem-icon"></span>
                清掃作業に負担がかかり、本業に集中できない
            </li>
            <li>
                <span class="problem-icon"></span>
                清掃作業の外注は、シンプルに済ませたい
            </li>
            <li>
                <span class="problem-icon"></span>
                従業員の満足度を、さらに上げていきたい
            </li>
            <li>
                <span class="problem-icon"></span>
                「これもホントはやってほしいんだけど・・・」に答えるサービスがあると便利
            </li>
        </ul>
        <img class="fadeUp" 
             src="<?php echo esc_url(misesapo_image_url('images/problem-illust.png')); ?>" 
             alt="悩んでいる2人の店舗従業員のイラスト">
    </div>
</article>

<?php
/**
 * テンプレート例: 縦スライダーセクション
 * 
 * このファイルを wp-content/themes/your-theme/templates/vertical-slider.php に配置
 */

// サービス画像のリスト（JSONファイルから読み込む場合）
$service_images = array(
    'service01.jpg', 'service02.jpg', 'service03.jpg', 'service04.jpg',
    'service05.jpg', 'service06.jpg', 'service07.jpg', 'service08.jpg',
    'service09.jpg', 'service10.jpeg', 'service11.jpeg', 'service12.jpeg',
    'service13.jpg', 'service14.jpg'
);
?>

<div class="c-top-concept">
    <div class="c-top-concept__gallery-area">
        <!-- スライダー1（左：1-14） -->
        <div class="c-gallery-slider">
            <div class="c-gallery-slider__wrap">
                <ul class="c-gallery-slider__list">
                    <?php foreach ($service_images as $index => $image): ?>
                        <li class="c-gallery-slider__item">
                            <img src="<?php echo esc_url(misesapo_image_url('images-service/' . $image)); ?>" 
                                 alt="サービス<?php echo $index + 1; ?>">
                        </li>
                    <?php endforeach; ?>
                    <!-- ループ用に複製 -->
                    <?php foreach ($service_images as $index => $image): ?>
                        <li class="c-gallery-slider__item">
                            <img src="<?php echo esc_url(misesapo_image_url('images-service/' . $image)); ?>" 
                                 alt="サービス<?php echo $index + 1; ?>">
                        </li>
                    <?php endforeach; ?>
                </ul>
            </div>
        </div>
        <!-- 他のスライダーも同様に実装 -->
    </div>
</div>


