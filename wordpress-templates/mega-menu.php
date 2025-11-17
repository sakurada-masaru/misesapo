<?php
/**
 * メガメニュー テンプレート（モダン版）
 * 
 * エックスサーバーのファイルマネージャーで以下にアップロード:
 * /misesapo.site/public_html/corporate/wp-content/themes/lightning-child/templates/mega-menu.php
 * 
 * 使用方法:
 * Elementorで「ショートコード」ウィジェットを追加し、[misesapo_mega_menu] を入力
 */
?>

<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<link rel="stylesheet" href="<?php echo esc_url(get_stylesheet_directory_uri() . '/assets/css/mega-menu-ishikawa.css'); ?>">

<nav class="misesapo-mega-menu ishikawa-style" id="misesapo-mega-menu">
    <ul class="mega-menu-list">
        <!-- トップページ -->
        <li class="mega-menu-item">
            <a href="<?php echo esc_url(home_url('/')); ?>" class="mega-menu-link">
                <span class="mega-menu-text">トップページ</span>
            </a>
        </li>

        <!-- サービス -->
        <li class="mega-menu-item mega-menu-has-submenu">
            <a href="<?php echo esc_url(home_url('/service')); ?>" class="mega-menu-link">
                <span class="mega-menu-text">サービス</span>
                <i class="fas fa-chevron-down mega-menu-arrow"></i>
            </a>
            <div class="mega-menu-submenu">
                <div class="mega-menu-submenu-inner">
                    <div class="mega-menu-column">
                        <ul class="mega-menu-column-list">
                            <li>
                                <a href="<?php echo esc_url(home_url('/service')); ?>">
                                    <span>すべてのサービス</span>
                                </a>
                            </li>
                            <li>
                                <a href="<?php echo esc_url(home_url('/service/cleaning')); ?>">
                                    <span>清掃サービス</span>
                                </a>
                            </li>
                            <li>
                                <a href="<?php echo esc_url(home_url('/service/maintenance')); ?>">
                                    <span>メンテナンス</span>
                                </a>
                            </li>
                            <li>
                                <a href="<?php echo esc_url(home_url('/service/inspection')); ?>">
                                    <span>点検サービス</span>
                                </a>
                            </li>
                        </ul>
                    </div>
                    <div class="mega-menu-column">
                        <ul class="mega-menu-column-list">
                            <li>
                                <a href="<?php echo esc_url(home_url('/service/about')); ?>">
                                    <span>サービス概要</span>
                                </a>
                            </li>
                            <li>
                                <a href="<?php echo esc_url(home_url('/service/flow')); ?>">
                                    <span>ご利用の流れ</span>
                                </a>
                            </li>
                            <li>
                                <a href="<?php echo esc_url(home_url('/service/price')); ?>">
                                    <span>料金プラン</span>
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </li>

        <!-- コンシェルジュ -->
        <li class="mega-menu-item mega-menu-has-submenu">
            <a href="<?php echo esc_url(home_url('/concierge')); ?>" class="mega-menu-link">
                <span class="mega-menu-text">コンシェルジュ</span>
                <i class="fas fa-chevron-down mega-menu-arrow"></i>
            </a>
            <div class="mega-menu-submenu">
                <div class="mega-menu-submenu-inner">
                    <div class="mega-menu-column">
                        <ul class="mega-menu-column-list">
                            <li>
                                <a href="<?php echo esc_url(home_url('/concierge')); ?>">
                                    <span>コンシェルジュとは</span>
                                </a>
                            </li>
                            <li>
                                <a href="<?php echo esc_url(home_url('/concierge/features')); ?>">
                                    <span>サービスの特徴</span>
                                </a>
                            </li>
                            <li>
                                <a href="<?php echo esc_url(home_url('/concierge/case')); ?>">
                                    <span>導入事例</span>
                                </a>
                            </li>
                        </ul>
                    </div>
                    <div class="mega-menu-column">
                        <ul class="mega-menu-column-list">
                            <li>
                                <a href="<?php echo esc_url(home_url('/support')); ?>">
                                    <span>サポートセンター</span>
                                </a>
                            </li>
                            <li>
                                <a href="<?php echo esc_url(home_url('/support/faq')); ?>">
                                    <span>よくある質問</span>
                                </a>
                            </li>
                            <li>
                                <a href="<?php echo esc_url(home_url('/support/contact')); ?>">
                                    <span>お問い合わせ</span>
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </li>

        <!-- お問い合わせ -->
        <li class="mega-menu-item">
            <a href="<?php echo esc_url(home_url('/contact')); ?>" class="mega-menu-link">
                <span class="mega-menu-text">お問い合わせ</span>
            </a>
        </li>

        <!-- 求人 -->
        <li class="mega-menu-item">
            <a href="<?php echo esc_url(home_url('/recruit')); ?>" class="mega-menu-link">
                <span class="mega-menu-text">求人</span>
            </a>
        </li>

        <!-- ログイン -->
        <li class="mega-menu-item mega-menu-login">
            <a href="<?php echo esc_url(wp_login_url()); ?>" class="mega-menu-link mega-menu-link-login">
                <span class="mega-menu-text">ログイン</span>
            </a>
        </li>

        <!-- 新規登録 -->
        <li class="mega-menu-item mega-menu-signup">
            <a href="<?php echo esc_url(home_url('/signup')); ?>" class="mega-menu-link mega-menu-link-signup">
                <span class="mega-menu-text">新規登録</span>
            </a>
        </li>
    </ul>

    <!-- スマホ用ハンバーガーボタン -->
    <button class="mega-menu-toggle" id="mega-menu-toggle" aria-label="メニュー" aria-expanded="false">
        <span></span>
        <span></span>
        <span></span>
    </button>
</nav>

