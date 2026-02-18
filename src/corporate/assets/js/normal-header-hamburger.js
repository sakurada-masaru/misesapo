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
            var drawerLinks = drawer.querySelectorAll('.normal-header-drawer-nav a[href]');
            drawerLinks.forEach(function (a) {
                a.addEventListener('click', closeDrawer);
            });
            window.addEventListener('resize', function () {
                if (window.innerWidth > 768) closeDrawer();
            });
        }
    }

    /** ドロップダウン（企業情報・規約＆ポリシー）をクリックで開閉（PC・モバイル共通） */
    function initDropdown() {
        var header = document.querySelector('.normal-header-with-hamburger');
        if (!header) return;

        var dropdowns = header.querySelectorAll('.normal-header-nav-dropdown');
        if (!dropdowns.length) return;

        dropdowns.forEach(function (dropdown) {
            var trigger = dropdown.querySelector(':scope > a');
            var menu = dropdown.querySelector('.normal-header-dropdown-menu');
            if (!trigger || !menu) return;

            trigger.setAttribute('role', 'button');
            trigger.setAttribute('aria-expanded', 'false');
            trigger.setAttribute('aria-haspopup', 'true');

            trigger.addEventListener('click', function (e) {
                e.preventDefault();
                var wasOpen = dropdown.classList.contains('is-dropdown-open');
                header.querySelectorAll('.normal-header-nav-dropdown').forEach(function (d) {
                    d.classList.remove('is-dropdown-open');
                    var t = d.querySelector(':scope > a');
                    if (t) t.setAttribute('aria-expanded', 'false');
                });
                if (!wasOpen) {
                    dropdown.classList.add('is-dropdown-open');
                    trigger.setAttribute('aria-expanded', 'true');
                }
            });
        });

        document.addEventListener('click', function (e) {
            if (!header.contains(e.target)) {
                header.querySelectorAll('.normal-header-nav-dropdown').forEach(function (d) {
                    d.classList.remove('is-dropdown-open');
                    var t = d.querySelector(':scope > a');
                    if (t) t.setAttribute('aria-expanded', 'false');
                });
            }
        });
    }

    function run() {
        var mount = document.getElementById('normal-header-mount');
        var src = mount && mount.getAttribute('data-src');

        if (mount && src) {
            // 相対パス（/ や http で始まらない）はサイトルート基準で解決（/about/message.html などサブパスでも同じモジュールを取得）
            var url;
            if (src.charAt(0) === '/' || src.indexOf('http') === 0) {
                url = new URL(src, window.location.origin).href;
            } else {
                url = window.location.origin + '/' + src.replace(/^\.\//, '');
            }
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
                    initDropdown();
                })
                .catch(function () {
                    mount.innerHTML = '<!-- header load error -->';
                });
        } else {
            initHamburger();
            initDropdown();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run);
    } else {
        run();
    }
})();
