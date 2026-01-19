// ヘッダーの表示制御
(function() {
    'use strict';

    const SCROLL_THRESHOLD = 150;
    const cosmeticHeader = document.querySelector('.cosmetic-header');
    const normalHeader = document.querySelector('.normal-header');
    let ticking = false;

    if (!cosmeticHeader || !normalHeader) {
        // 化粧ヘッダーまたは通常ヘッダーが存在しない場合は、通常ヘッダーのみを制御
        if (normalHeader) {
            const SCROLL_THRESHOLD_SINGLE = 100;
            function updateSingleHeaderState(scrollY) {
                if (scrollY > SCROLL_THRESHOLD_SINGLE) {
                    normalHeader.classList.add('visible');
                } else {
                    normalHeader.classList.remove('visible');
                }
            }

            updateSingleHeaderState(window.scrollY || window.pageYOffset);

            window.addEventListener('scroll', function() {
                if (!ticking) {
                    window.requestAnimationFrame(function() {
                        updateSingleHeaderState(window.scrollY || window.pageYOffset);
                        ticking = false;
                    });
                    ticking = true;
                }
            }, { passive: true });
        }
        return;
    }

    function updateHeaderState(scrollY) {
        if (scrollY > SCROLL_THRESHOLD) {
            // 下にスクロール時：化粧ヘッダーを非表示、通常ヘッダーを表示
            cosmeticHeader.classList.add('hidden');
            normalHeader.classList.add('visible');
        } else {
            // トップ時：化粧ヘッダーを表示、通常ヘッダーを非表示
            cosmeticHeader.classList.remove('hidden');
            normalHeader.classList.remove('visible');
        }
    }

    // 初期状態を設定
    updateHeaderState(window.scrollY || window.pageYOffset);

    // スクロールイベント
    window.addEventListener('scroll', function() {
        if (!ticking) {
            window.requestAnimationFrame(function() {
                updateHeaderState(window.scrollY || window.pageYOffset);
                ticking = false;
            });
            ticking = true;
        }
    }, { passive: true });

    // ユーザーメニューの表示制御
    const userMenuBtn = document.getElementById('cosmetic-user-menu-btn');
    const userDropdown = document.getElementById('cosmetic-user-dropdown');
    
    if (userMenuBtn && userDropdown) {
        userMenuBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            const isVisible = userDropdown.style.display === 'block';
            userDropdown.style.display = isVisible ? 'none' : 'block';
        });

        // クリックアウトサイドで閉じる
        document.addEventListener('click', function(e) {
            if (!userMenuBtn.contains(e.target) && !userDropdown.contains(e.target)) {
                userDropdown.style.display = 'none';
            }
        });
    }
})();


