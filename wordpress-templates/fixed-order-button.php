<?php
/**
 * 固定発注ボタン テンプレート
 * 
 * エックスサーバーのファイルマネージャーで以下にアップロード:
 * /misesapo.site/public_html/corporate/wp-content/themes/lightning-child/templates/fixed-order-button.php
 * 
 * 使用方法:
 * Elementorで「ショートコード」ウィジェットを追加し、[misesapo_fixed_order_button] を入力
 * 
 * 注意: このテンプレートはショートコード関数から呼び出されます
 * $atts変数はショートコード関数で定義されています
 */

// 注意: $atts変数はショートコード関数（functions.php）で定義されています
// このテンプレートでは$attsを使用するだけです
?>

<!-- 固定発注ボタン -->
<div class="fixed-order-button" style="bottom: <?php echo esc_attr($atts['bottom']); ?>; right: <?php echo esc_attr($atts['right']); ?>;">
    <a href="<?php echo esc_url($atts['url']); ?>" class="fixed-order-button-link">
        <!-- 円形回転テキスト -->
        <?php $unique_id = uniqid('circle-path-'); ?>
        <div class="fixed-order-button__rotating-text">
            <svg viewBox="0 0 190 190">
                <defs>
                    <path id="<?php echo esc_attr($unique_id); ?>" d="M 95, 95 m -85, 0 a 85,85 0 1,1 170,0 a 85,85 0 1,1 -170,0" />
                </defs>
                <text>
                    <textPath href="#<?php echo esc_attr($unique_id); ?>" startOffset="0%">
                        <?php echo esc_html($atts['rotating_text']); ?>
                    </textPath>
                </text>
            </svg>
        </div>
        
        <!-- 円形ボタン -->
        <div class="fixed-order-button__circle">
            <div class="fixed-order-button__text">
                <?php echo wp_kses_post($atts['text']); ?>
            </div>
        </div>
    </a>
</div>

