/**
 * 通常ヘッダー・ハンバーガーメニュー（768px以下）
 * - プレースホルダーあり: data-src の HTML を取得して差し込み→初期化
 * - プレースホルダーなし: .normal-header-with-hamburger をそのまま初期化
 */
(function () {
    'use strict';

    function resolvePath(path) {
        if (!path || path.startsWith('http://') || path.startsWith('https://') || path.startsWith('//') || path.startsWith('mailto:')) {
            return path;
        }
        var base = document.querySelector('base');
        if (base && base.href) {
            return new URL(path, base.href).href;
        }
        var hostname = window.location.hostname;
        var isLocalDev = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '';
        var isCustomDomain = hostname === 'misesapo.co.jp' || hostname === 'www.misesapo.co.jp';
        if (isLocalDev || isCustomDomain) {
            return path.charAt(0) === '/' ? path : '/' + path;
        }
        if (path.indexOf('/misesapo/') === 0) return window.location.origin + path;
        if (path.charAt(0) === '/') return window.location.origin + '/misesapo' + path;
        return window.location.origin + '/misesapo/' + path;
    }

    function applyResolvePath(root) {
        if (!root) return;
        root.querySelectorAll('a[href^="/"]').forEach(function (link) {
            var href = link.getAttribute('href');
            if (href) link.href = resolvePath(href);
        });
        root.querySelectorAll('img[src^="/"]').forEach(function (img) {
            var src = img.getAttribute('src');
            if (src) img.src = resolvePath(src);
        });
    }

    function initHamburger() {
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

    function run() {
        var mount = document.getElementById('normal-header-mount');
        var src = mount && mount.getAttribute('data-src');

        if (mount && src) {
            var url = new URL(src, document.baseURI || window.location.href).href;
            fetch(url)
                .then(function (res) { return res.ok ? res.text() : Promise.reject(new Error('load failed')); })
                .then(function (html) {
                    mount.innerHTML = html;
                    applyResolvePath(mount);
                    var normalHeader = mount.querySelector('.normal-header');
                    if (normalHeader) {
                        normalHeader.classList.add('visible');
                    }
                    initHamburger();
                })
                .catch(function () {
                    mount.innerHTML = '<!-- header load error -->';
                });
        } else {
            initHamburger();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run);
    } else {
        run();
    }
})();
