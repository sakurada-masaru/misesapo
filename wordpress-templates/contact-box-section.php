<?php
/**
 * 「まずは無料で相談してみませんか？」セクション テンプレート
 * 
 * エックスサーバーのファイルマネージャーで以下にアップロード:
 * /misesapo.site/public_html/corporate/wp-content/themes/cocoon-child-master/templates/contact-box-section.php
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

<!-- まずは無料で相談してみませんか？ -->
<section class="contact-box">
    <div class="contact-box-inner wrapper">
        <h2 class="contact-box-heading">まずはご気軽にご相談してみませんか？</h2>
        <p class="contact-box-catchphrase">「これもホントはやってほしいんだけど・・・」<br>「痒いところに手が届く清掃サービスがあれば・・・」</p>
        <div class="g-nav-orderBox-title contact-box-subTitle">＼まずは無料で相談してみませんか？／</div>
        <h2 class="contact-box-title">店舗の清掃はミセサポへ！！</h2>
        <div class="contact-box-flex">
            <a class="gradient-link tel-link" href="tel:070-3332-3939">
                <span class="tel-icon"></span>070-3332-3939
            </a>
            <a class="gradient-link web-link" href="<?php echo esc_url(home_url('/contact')); ?>">Webでのお申し込みはこちら</a>
        </div>
    </div>
</section>
<!-- まずは無料で相談してみませんか？ end -->

