/**
 * メガメニュー JavaScript
 * WordPress/Elementor用
 */

(function() {
    'use strict';

    // DOM要素の存在確認
    const megaMenu = document.getElementById('misesapo-mega-menu');
    const toggleButton = document.getElementById('mega-menu-toggle');
    const menuList = megaMenu?.querySelector('.mega-menu-list');
    const menuItems = megaMenu?.querySelectorAll('.mega-menu-item');

    if (!megaMenu || !toggleButton || !menuList) {
        return; // 要素が存在しない場合は終了
    }

    // ============================================
    // ハンバーガーメニューの開閉
    // ============================================
    toggleButton.addEventListener('click', function() {
        const isActive = toggleButton.classList.contains('active');
        
        if (isActive) {
            closeMenu();
        } else {
            openMenu();
        }
    });

    function openMenu() {
        toggleButton.classList.add('active');
        toggleButton.setAttribute('aria-expanded', 'true');
        menuList.classList.add('active');
        document.body.classList.add('mega-menu-open');
    }

    function closeMenu() {
        toggleButton.classList.remove('active');
        toggleButton.setAttribute('aria-expanded', 'false');
        menuList.classList.remove('active');
        document.body.classList.remove('mega-menu-open');
        
        // サブメニューも閉じる
        menuItems.forEach(item => {
            item.classList.remove('active');
        });
    }

    // ============================================
    // スマホ用サブメニューの開閉
    // ============================================
    if (window.innerWidth <= 768) {
        menuItems.forEach(item => {
            const link = item.querySelector('.mega-menu-link');
            const submenu = item.querySelector('.mega-menu-submenu');
            
            if (link && submenu) {
                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    const isActive = item.classList.contains('active');
                    
                    // 他のサブメニューを閉じる
                    menuItems.forEach(otherItem => {
                        if (otherItem !== item) {
                            otherItem.classList.remove('active');
                        }
                    });
                    
                    // 現在のサブメニューを開閉
                    if (isActive) {
                        item.classList.remove('active');
                    } else {
                        item.classList.add('active');
                    }
                });
            }
        });
    }

    // ============================================
    // ウィンドウリサイズ時の処理
    // ============================================
    let resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            // デスクトップサイズに戻ったらメニューを閉じる
            if (window.innerWidth > 768) {
                closeMenu();
            }
        }, 250);
    });

    // ============================================
    // メニュー外クリックで閉じる
    // ============================================
    document.addEventListener('click', function(e) {
        if (window.innerWidth <= 768) {
            if (!megaMenu.contains(e.target) && menuList.classList.contains('active')) {
                closeMenu();
            }
        }
    });

    // ============================================
    // ESCキーで閉じる
    // ============================================
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && menuList.classList.contains('active')) {
            closeMenu();
        }
    });

    // ============================================
    // デスクトップ用ホバー処理（タッチデバイス対応）
    // ============================================
    if (window.innerWidth > 768) {
        menuItems.forEach(item => {
            const submenu = item.querySelector('.mega-menu-submenu');
            
            if (submenu) {
                // マウスホバー
                item.addEventListener('mouseenter', function() {
                    item.classList.add('hover');
                });
                
                item.addEventListener('mouseleave', function() {
                    item.classList.remove('hover');
                });
                
                // タッチデバイス対応
                let touchTimer;
                item.addEventListener('touchstart', function(e) {
                    e.preventDefault();
                    clearTimeout(touchTimer);
                    
                    const isActive = item.classList.contains('touch-active');
                    
                    // 他のサブメニューを閉じる
                    menuItems.forEach(otherItem => {
                        if (otherItem !== item) {
                            otherItem.classList.remove('touch-active');
                        }
                    });
                    
                    if (isActive) {
                        item.classList.remove('touch-active');
                    } else {
                        item.classList.add('touch-active');
                    }
                });
            }
        });
    }

    // ============================================
    // 現在のページをハイライト
    // ============================================
    const currentUrl = window.location.href;
    const menuLinks = megaMenu.querySelectorAll('.mega-menu-link');
    
    menuLinks.forEach(link => {
        const linkUrl = link.getAttribute('href');
        if (linkUrl && currentUrl.includes(linkUrl)) {
            link.classList.add('current');
            // 親のメニュー項目もハイライト
            const parentItem = link.closest('.mega-menu-item');
            if (parentItem) {
                parentItem.classList.add('current');
            }
        }
    });

})();

