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

