/*===========================
    ハンバーガーメニュー
===========================*/
const btn = document.querySelector('.btn');
const g_nav = document.querySelector('#g-nav');
const html = document.querySelector('html');
const body = document.querySelector('body');
const g_nav_links = document.querySelectorAll('#g-nav ul li a');

if (btn && g_nav) {
    btn.addEventListener('click', () => {
        btn.classList.toggle('active');
        g_nav.classList.toggle('active');
        if (html) html.classList.toggle('active');
        if (body) body.classList.toggle('active');
    });
    g_nav_links.forEach((g_nav_link) => {
        g_nav_link.addEventListener('click', () => {
            btn.classList.remove('active');
            g_nav.classList.remove('active');
            if (html) html.classList.remove('active');
            if (body) body.classList.remove('active');
        });
    });
}


/*=====================================================
    キービジュアルテキスト表示
=====================================================*/
const key_title_inners = document.querySelectorAll('.key-title-inner');
const kv_anime = (entries, obs) => {
    entries.forEach((entry) => {
        if(entry.isIntersecting) {
            entry.target.animate(
                {
                    translate:[0, '100%'],
                },
                {
                    duration: 1000,
                    easing: 'ease',
                    pseudoElement: '::before',//擬似要素を指定
                    fill: 'forwards',
                }
            );
            obs.unobserve(entry.target);
        }
    });
}
const kv_options = {
    threshold: 0.8
}
const kv_animeObserver = new IntersectionObserver(kv_anime, kv_options);
key_title_inners.forEach((key_title_inner) => {
    kv_animeObserver.observe(key_title_inner);
});


/*=====================================================
    フェードアップ
=====================================================*/
// 重複実行を防ぐため、IIFEでラップ
(function() {
    'use strict';
    // 既に実行済みかチェック
    if (window.fadeUpsInitialized) return;
    window.fadeUpsInitialized = true;
    
    const fadeUps = document.querySelectorAll('.fadeUp');
    if (fadeUps.length > 0) {
        const fadeUpAnime = (entries, obs) => {
            entries.forEach((entry) => {
                if(entry.isIntersecting) {
                    entry.target.animate(
                        {
                            opacity: [0, 1],
                            translate: ['0 100%', 0],
                        },
                        {
                            duration: 1000,
                            easing: 'ease',
                            fill: 'forwards',
                        }
                    );
                    obs.unobserve(entry.target);
                }
            });
        }
        const fadeUp_options = {
            rootMargin: '-20%',
        }
        const fadeUpsObserver = new IntersectionObserver(fadeUpAnime, fadeUp_options);
        fadeUps.forEach((fadeUp) => {
            fadeUpsObserver.observe(fadeUp);
        });
    }
})();


/*=====================================================
    ボーダーライン表示
=====================================================*/
const border_lines = document.querySelectorAll('.border-line');
const border_lineAnime = (entries, obs) => {
    entries.forEach((entry) => {
        if(entry.isIntersecting) {
            entry.target.animate(
                {
                    width: [0, '100%'],
                },
                {
                    duration: 500,
                    delay: 500,
                    easing: 'ease',
                    fill: 'forwards',
                    pseudoElement: '::after',//擬似要素を指定
                }
            );
            obs.unobserve(entry.target);
        }
    });
}
const border_lineOptions = {
    rootMargin: '-20%',
}
const border_lineObserver = new IntersectionObserver(border_lineAnime, border_lineOptions);
border_lines.forEach((border_line) => {
    border_lineObserver.observe(border_line);
});


/*=====================================================
    テキストを左から右へ表示するための処理(「ミセサポなら」の部分)
=====================================================*/
const pink_sliders = document.querySelectorAll('.pink-slide');
const pink_slidersAnime = (entries, obs) => {
    entries.forEach((entry, index) => {
        if(entry.isIntersecting) {
            entry.target.animate(
                {
                    width:['100%', 0],
                },
                {
                    duration: 1000,
                    delay: index * 800,
                    easing: 'ease',
                    pseudoElement: '::before',//擬似要素を指定
                    fill: 'forwards',
                }
            );
            obs.unobserve(entry.target);
        }
    });
}
const pink_slidersOptions = {
    rootMargin: '-20%',
}
const pink_slidersObserver = new IntersectionObserver(pink_slidersAnime, pink_slidersOptions);
pink_sliders.forEach((pink_slide) => {
    pink_slidersObserver.observe(pink_slide);
});


/*=====================================================
    テキストを拡大表示するための処理(「ミセサポなら」の部分)
=====================================================*/
const fadeIns = document.querySelectorAll('.fadeIn');
const fadeInAnime = (entries, obs) => {
    entries.forEach((entry) => {
        if(entry.isIntersecting) {
            entry.target.animate(
                [
                    {
                        transform: 'scale(0) translateY(20px)',
                        opacity: 0
                    },
                    {
                        transform: 'scale(1.1) translateY(-5px)',
                        opacity: 1
                    },
                    {
                        transform: 'scale(1) translateY(0)',
                        opacity: 1
                    }
                ],
                {
                    duration: 800,
                    delay: 300,
                    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                    fill: 'forwards',
                }
            );
            obs.unobserve(entry.target);
        }
    });
}
const fadeInsOptions = {
    rootMargin: '-20%',
}
const fadeInsObserver = new IntersectionObserver(fadeInAnime, fadeInsOptions);
fadeIns.forEach((fadeIn) => {
    fadeInsObserver.observe(fadeIn);
});


/*===================================
   opacityIn
===================================*/
const opacityIns = document.querySelectorAll('.opacityIn');
const opacityInsAnime = (entries, obs) => {
    entries.forEach((entry) => {
        if(entry.isIntersecting) {
            entry.target.animate(
                {
                    opacity: [0, 1]
                },
                {
                    duration: 500,
                    //delay: index * 300,
                    easing: 'ease',
                    fill: 'forwards',
                }
            );
            obs.unobserve(entry.target);
        }
    });
}
const opacityInsOptions = {
    rootMargin: "-20% 0%"
}
const opacityInsObserver = new IntersectionObserver(opacityInsAnime, opacityInsOptions);
opacityIns.forEach((opacityIn) => {
    opacityInsObserver.observe(opacityIn);
});

/*===================================
   既存顧客一覧自動スクロール(Swiper.js)
===================================*/
const swiper01 = new Swiper('.swiper-left', {
   loop: true,
   loopAdditionalSlides: 1,
   effect: 'slide',
   speed: 5000,
   slidesPerView: 'auto',
   allowTouchMove: false,
   centerSlides: true,
   autoplay: {
    delay: 0,
    disableOnInteraction: false,
   }
});
const swiper02 = new Swiper('.swiper-right', {
   loop: true,
   loopAdditionalSlides: 1,
   effect: 'slide',
   speed: 5000,
   slidesPerView: 'auto',
   allowTouchMove: false,
   centerSlides: true,
   autoplay: {
    reverseDirection: true,//左から右へ自動スクロールができるようにする
    delay: 0,
    disableOnInteraction: false,
   }
});
// ウィンドウリサイズ時のイベントリスナー
window.addEventListener('resize', () => {
  // swiper01 の自動再生を再開
  if (swiper01 && swiper01.autoplay) {
    // swiper01.update(); // 必要に応じてSwiperのインスタンスを更新
    swiper01.autoplay.start(); // 自動再生を開始
  }

  // swiper02 の自動再生を再開
  if (swiper02 && swiper02.autoplay) {
    // swiper02.update(); // 必要に応じてSwiperのインスタンスを更新
    swiper02.autoplay.start(); // 自動再生を開始
  }
});


/*===================================
   お客様の声自動スクロール(Swiper.js)
===================================*/
//matchMedia()メソッドを使用し、レスポンシブ対応させる
const mediaQuery = window.matchMedia('(max-width: 933px)'); //768px未満にマッチ
let swiper03;
function handleTabletChange(e) {
    if(e.matches) {//メディアクエリの条件（e.matches）に基づいてSwiperの初期化または破棄を行う（.matchesは、キープロパティ）
        // 767.98px以下の場合（モバイル・タブレット）
        if(!swiper03) {
            swiper03 = new Swiper('.swiper-cards', {
                slidesPerView: 1, // コンテナ内に表示させるスライド数（CSSでサイズ指定する場合は 'auto'）
                centeredSlides: true, // アクティブなスライドを中央に配置する
                loop: true,
                spaceBetween: 10,

                autoplay: { // 自動再生させる
                    delay: 3000, // 次のスライドに切り替わるまでの時間（ミリ秒）
                    disableOnInteraction: false, // ユーザーが操作しても自動再生を止めない
                    waitForTransition: false, // アニメーションの間も自動再生を止めない（最初のスライドの表示時間を揃えたいときに）
                },

                // ページネーションが必要なら追加
                pagination: {
                    el: ".swiper-pagination"
                },
                // ナビボタンが必要なら追加
                navigation: {
                    nextEl: ".swiper-button-next",
                    prevEl: ".swiper-button-prev"
                }
            });
        }
    } else {
        // 768px以上の場合（PC）
        if(swiper03) {
            swiper03.destroy(true, true);
            swiper03 = undefined;
        }
    }
}
// 初期チェック
handleTabletChange(mediaQuery);//初期ロード時に handleTabletChange(mediaQuery) を呼び出して現在の状態を確認し、Swiperを適切に処理する
// リスナーを追加して、メディアクエリの状態変化を監視
  // Safari 13以前では .addListener() を使用する必要がある場合がある
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handleTabletChange);
} else if (mediaQuery.addListener) { // Safari 13 以前のフォールバック
    mediaQuery.addListener(handleTabletChange);
}


/*===================================
   TOPへ戻るボタン
===================================*/
const pagetop = document.querySelector('.pagetop');
const kvImageBox = document.querySelector('.key-visual');
const footer_for_topbtn =document.querySelector('footer');

const topBtnOptions = {
    threshold: 0.5
};

if (pagetop) {
const pagetopAnime = (entries) => {
    entries.forEach((entry) => {
        if(entry.isIntersecting) {//kvImageBoxが画面上に現れたらTOPページへ戻るボタンを外す
            pagetop.classList.remove('topActive');
        } else {
            pagetop.classList.add('topActive');
        }
    });
}
    
pagetop.addEventListener('click', (e) => {
    e.preventDefault();//aタグのデフォルトイベントをキャンセルする(一瞬でTOPに戻るのを防ぐ)
    window.scroll({
        top: 0,
        behavior: "smooth"
    });
});
    
// footerの表示監視
    if (footer_for_topbtn) {
const footer_topbtn_Observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    // footerが表示されたら2rem
                    pagetop.style.bottom = "2rem";
                } else {
                    // footerが非表示で、kvImageBoxも画面外の場合は12rem
                    if (kvImageBox && !kvImageBox.getBoundingClientRect().top < window.innerHeight) {
                        pagetop.style.bottom = "12rem";
                    }
                }
            });
        }, {
            threshold: 0.1
        });
        footer_topbtn_Observer.observe(footer_for_topbtn);
    }

    // kvImageBoxの表示監視
    if (kvImageBox) {
const topBtnObserver = new IntersectionObserver(pagetopAnime, topBtnOptions);
topBtnObserver.observe(kvImageBox);
    }
}


/*=====================
    お問い合わせBOX
=====================*/
const order_bottom_box = document.querySelector('.order-bottom-box');
const order_box_views = document.querySelectorAll('.order-box-view');
const footer = document.querySelector('footer');

// 初期表示時は確実に非表示にする
document.addEventListener('DOMContentLoaded', () => {
    if (order_bottom_box) {
    order_bottom_box.classList.remove('bottom-box-active');
    // スタイルを直接指定して確実に非表示に
    order_bottom_box.style.opacity = '0';
    order_bottom_box.style.visibility = 'hidden';
    }
});


// TOPへ戻るボタンと同じタイミングで表示するための処理
const order_bottom_boxAnime = (entries) => {
    entries.forEach((entry) => {
        // kvImageBoxが画面外に出たら表示
        if (!entry.isIntersecting) {
            // footerが表示されていない場合のみ表示
            if (!footer.getBoundingClientRect().top < window.innerHeight) {
                order_bottom_box.classList.add('bottom-box-active');
                order_bottom_box.style.opacity = '1';
                order_bottom_box.style.visibility = 'visible';
            }
        } else {
            // kvImageBoxが画面内にある場合は非表示
            order_bottom_box.classList.remove('bottom-box-active');
            order_bottom_box.style.opacity = '0';
            order_bottom_box.style.visibility = 'hidden';
        }
    });
};

// footerの表示監視
const footerObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            // footerが表示されたら非表示
            order_bottom_box.classList.remove('bottom-box-active');
            order_bottom_box.style.opacity = '0';
        } else {
            // footerが非表示で、kvImageBoxも画面外の場合は表示
            if (!kvImageBox.getBoundingClientRect().top < window.innerHeight) {
                order_bottom_box.classList.add('bottom-box-active');
                order_bottom_box.style.opacity = '1';
            }
        }
    });
}, {
    threshold: 0.1
});

const order_bottom_boxOptions = {
    threshold: 0.1,
    rootMargin: '-20% 0px'
};

const order_bottom_boxObserver = new IntersectionObserver(order_bottom_boxAnime, order_bottom_boxOptions);
if (kvImageBox) {
order_bottom_boxObserver.observe(kvImageBox);
}
if (footer) {
footerObserver.observe(footer);
}


/*===================================
   発注フォーム(selectにおける処理)
===================================*/
const disabled_option = document.querySelector('.disabled-option')
const able_options = document.querySelectorAll('.able-option');
able_options.forEach((able_option) => {
    able_option.addEventListener('mouseover', () => {
        disabled_option.classList.add('removeBG');
    });

    able_option.addEventListener('mouseleave', () => {
        disabled_option.classList.remove('removeBG');
    });
});


/*===================================
   発注フォーム(年月日における処理)
===================================*/
// DOM要素の取得
        const yearSelect = document.getElementById('year');
        const monthSelect = document.getElementById('month');
        const daySelect = document.getElementById('day');

        // 要素が存在しない場合は処理をスキップ
        if (!yearSelect || !monthSelect || !daySelect) {
            console.warn('[script.js] Date select elements not found, skipping initialization');
            return;
        }

        // 年のオプションを生成 (例: 当年から5年先まで)
        const currentYear = new Date().getFullYear();
        const startYear = currentYear; 
        const endYear = currentYear + 5;

        for (let i = startYear; i <= endYear; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i;
            yearSelect.appendChild(option);
        }

        // 月のオプションを生成
        for (let i = 1; i <= 12; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = String(i).padStart(2, '0'); // 01, 02 ...
            monthSelect.appendChild(option);
        }

        // 日のオプションを更新する関数
        function updateDays() {
            const selectedYear = parseInt(yearSelect.value);
            const selectedMonth = parseInt(monthSelect.value);
            const currentDayValue = daySelect.value; // 文字列として現在の値を取得
            const currentDay = currentDayValue ? parseInt(currentDayValue) : null; // 現在選択されている日を数値として保持 (存在する場合)


            daySelect.innerHTML = ''; // 日のオプションをクリア

            // 特定の月の日数を取得 (閏年を考慮)
            // 月は0から始まるため、selectedMonth - 1 する
            const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();

            for (let i = 1; i <= daysInMonth; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = String(i).padStart(2, '0'); // 01, 02 ...
                daySelect.appendChild(option);
            }
            
            // 以前選択されていた日が存在し、新しい日数範囲内であれば再選択
            if (currentDay && currentDay <= daysInMonth) {
                daySelect.value = currentDay;
            } else if (daySelect.options.length > 0) {
                 // 範囲外になった場合、もしくは初期選択時でcurrentDayがnullの場合、最初の日を選択
                daySelect.value = daySelect.options[0].value;
            }
        }

        // 初期値を設定 (画像に合わせて 2025年7月1日)
        function setInitialDate() {
            const initialYear = 2025;
            const initialMonth = 7; // July
            const initialDay = 1;   // 1st

            // 年のオプションが存在するか確認し設定
            let yearExists = Array.from(yearSelect.options).some(opt => parseInt(opt.value) === initialYear);
            if(yearExists) {
                 yearSelect.value = initialYear;
            } else if (yearSelect.options.length > 0) {
                yearSelect.value = yearSelect.options[0].value; // 初期年が存在しない場合、最初のオプションを選択
            }

            // 月のオプションが存在するか確認し設定
            let monthExists = Array.from(monthSelect.options).some(opt => parseInt(opt.value) === initialMonth);
            if(monthExists) {
                 monthSelect.value = initialMonth;
            } else if (monthSelect.options.length > 0) {
                monthSelect.value = monthSelect.options[0].value; // 初期月が存在しない場合、最初のオプションを選択
            }
            
            updateDays(); // 日のオプションを更新 (年と月が設定された後)

            // 日のオプションが存在するか確認し設定
            let dayExists = Array.from(daySelect.options).some(opt => parseInt(opt.value) === initialDay);
            if(dayExists) {
                daySelect.value = initialDay;
            } else if (daySelect.options.length > 0) {
                 // updateDays後なので、daySelect.options[0]は常に存在するはず (月が1日以上ある限り)
                daySelect.value = daySelect.options[0].value; // 初期日が存在しない/無効な場合、最初の有効な日を選択
            }
        }

        // イベントリスナーを設定
        yearSelect.addEventListener('change', updateDays);
        monthSelect.addEventListener('change', updateDays);

        // 初期の日付を設定し、日のオプションを生成
        setInitialDate(); // これがupdateDaysを呼び出し、最終的にdaySelectも設定する

        // コンソールに選択された日付を出力する例 (デバッグ用)
        /*function logSelectedDate() {
            if (yearSelect.value && monthSelect.value && daySelect.value) {
                console.log(`選択された日付: ${yearSelect.value}年${monthSelect.value}月${daySelect.value}日`);
            } else {
                console.log("日付が完全に選択されていません。");
            }
        }*/

        /*yearSelect.addEventListener('change', logSelectedDate);
        monthSelect.addEventListener('change', logSelectedDate);
        daySelect.addEventListener('change', logSelectedDate);*/
        
        // 初期ロード時にもログ出力 (任意)
         //logSelectedDate();


/*===================================
   フォーム送信後のボタンデザイン変更
===================================*/
const order_forms = document.querySelectorAll('.order-form-box');
const submitBtns = document.querySelectorAll('.submit-button');
order_forms.forEach((order_form) => {
    order_form.addEventListener('submit', (e) => {
        e.preventDefault();// フォーム送信をキャンセルする

        // 送信ボタンのデザインを変更
        submitBtns.forEach((submitBtn) => {
            submitBtn.textContent = "送信済";
            submitBtn.style.backgroundColor = "var(--white)";
            submitBtn.style.color = "var(--main-bg-color)";
            submitBtn.style.padding = "1.4rem";
            submitBtn.style.margin = "6rem auto 0";
            submitBtn.style.fontSize = "1.56rem";
            submitBtn.style.borderRadius = "8px";
            submitBtn.style.fontWeight = "bold";
            submitBtn.style.border = "1px solid var(--main-bg-color)";
            submitBtn.style.lineHeight = "1";
            submitBtn.style.width = "min(100%, 28.9rem)";
        });
    });
});