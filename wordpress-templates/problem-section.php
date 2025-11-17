<?php
/**
 * お悩みセクション テンプレート
 * 
 * エックスサーバーのファイルマネージャーで以下にアップロード:
 * /misesapo.site/public_html/corporate/wp-content/themes/cocoon-child-master/templates/problem-section.php
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

