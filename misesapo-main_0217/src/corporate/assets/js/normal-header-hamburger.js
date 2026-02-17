/**
 * 通常ヘッダー・ハンバーガーメニュー（768px以下）
 * .normal-header-with-hamburger 内のドロワー開閉を制御
 */
(function () {
    'use strict';

    function init() {
        var header = document.querySelector('.normal-header-with-hamburger');
        if (!header) return;

        var hamburgerBtn = header.querySelector('#normal-header-hamburger-btn');
        var drawer = header.querySelector('#normal-header-drawer');
        var backdrop = header.querySelector('#normal-header-drawer-backdrop');

        function closeDrawer() {
            if (!header || !drawer || !backdrop || !hamburgerBtn) return;
            header.classList.remove('is-drawer-open');
            drawer.setAttribute('aria-hidden', 'true');
            backdrop.setAttribute('aria-hidden', 'true');
            hamburgerBtn.setAttribute('aria-expanded', 'false');
            hamburgerBtn.setAttribute('aria-label', 'メニューを開く');
        }

        function openDrawer() {
            if (!header || !drawer || !backdrop || !hamburgerBtn) return;
            header.classList.add('is-drawer-open');
            drawer.setAttribute('aria-hidden', 'false');
            backdrop.setAttribute('aria-hidden', 'false');
            hamburgerBtn.setAttribute('aria-expanded', 'true');
            hamburgerBtn.setAttribute('aria-label', 'メニューを閉じる');
        }

        if (hamburgerBtn && drawer && backdrop) {
            hamburgerBtn.addEventListener('click', function () {
                var isOpen = hamburgerBtn.getAttribute('aria-expanded') === 'true';
                if (isOpen) closeDrawer(); else openDrawer();
            });
            backdrop.addEventListener('click', closeDrawer);
            var drawerLinks = drawer.querySelectorAll('.normal-header-drawer-nav a');
            drawerLinks.forEach(function (a) {
                a.addEventListener('click', closeDrawer);
            });
            window.addEventListener('resize', function () {
                if (window.innerWidth > 768) closeDrawer();
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
