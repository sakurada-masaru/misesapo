// 求人ページではインクルードヘッダーを削除し、通常ヘッダーを常時表示
document.addEventListener('DOMContentLoaded', function() {
  // インクルードヘッダーを削除
  const defaultHeader = document.getElementById('default-header-wrapper');
  if (defaultHeader) {
    defaultHeader.remove();
  }
  const siteHeader = document.querySelector('.site-header');
  if (siteHeader) {
    siteHeader.remove();
  }
  
  // 通常ヘッダーを常時表示
  const normalHeader = document.querySelector('.normal-header');
  if (normalHeader) {
    normalHeader.classList.add('visible');
    // スクロールイベントでクラスを削除しないようにする
    const originalRemove = normalHeader.classList.remove;
    normalHeader.classList.remove = function(...args) {
      if (args[0] !== 'visible') {
        originalRemove.apply(this, args);
      }
    };
  }
});

// スプラッシュスクリーンとスクロールアニメーション
(function() {
  const splash = document.getElementById('recruit-splash');
  if (!splash) return;

  // フェードインアップはCSSアニメーションで自動実行
  // 3秒後にフェードアウト開始
  setTimeout(function() {
    splash.classList.add('fade-out');
    // フェードアウト完了後に非表示
    setTimeout(function() {
      splash.classList.add('hidden');
      // スプラッシュスクリーンが非表示になったらスクロールアニメーションを開始
      initScrollFadeIn();
    }, 800); // フェードアウトの時間（0.8s）に合わせる
  }, 3000); // 3秒表示

  // スプラッシュスクリーンが表示されていない場合は即座に開始
  if (splash.classList.contains('hidden')) {
    initScrollFadeIn();
  }
})();

// スクロールアニメーションの初期化
function initScrollFadeIn() {
  const fadeElements = document.querySelectorAll('.scroll-fade-in');
  
  // Intersection Observerの設定
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
  };

  const observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        // 一度表示されたら監視を解除
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // 各要素を監視（JOBカードは順次表示のため、少し遅延を追加）
  fadeElements.forEach(function(element, index) {
    // JOBカードの場合は、少しずつ遅延を追加して順次表示
    if (element.classList.contains('recruit-job-card')) {
      setTimeout(function() {
        observer.observe(element);
      }, index * 100); // 各カードに100msずつ遅延
    } else {
      observer.observe(element);
    }
  });
}

