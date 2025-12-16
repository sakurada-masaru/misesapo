// ログイン画面では通常ヘッダーを表示
(function() {
  const path = window.location.pathname || '';
  const isSigninPage = path.includes('/signin.html') || path.includes('/signin');
  
  // ログイン画面では通常ヘッダーを表示、デフォルトヘッダーを非表示
  if (isSigninPage) {
    const defaultHeaderWrapper = document.getElementById('default-header-wrapper');
    const normalHeaderWrapper = document.getElementById('normal-header-wrapper');
    if (defaultHeaderWrapper) {
      defaultHeaderWrapper.style.display = 'none';
    }
    if (normalHeaderWrapper) {
      normalHeaderWrapper.style.display = 'block';
      // ログイン画面では通常ヘッダーを常に表示
      const normalHeader = normalHeaderWrapper.querySelector('.normal-header');
      if (normalHeader) {
        normalHeader.classList.add('visible');
      }
    }
  }
})();





