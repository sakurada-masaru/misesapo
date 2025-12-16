/**
 * マスター権限バックドア（開発用）
 * フッターのコピーライト「ミセサポ」を6回連続クリックでマスター権限を付与
 */

(function() {
  'use strict';
  
  // クリックカウンター
  let clickCount = 0;
  let clickTimeout = null;
  const REQUIRED_CLICKS = 6;
  const CLICK_TIMEOUT_MS = 2000; // 2秒以内に次のクリックがないとリセット
  
  /**
   * マスター権限を付与
   */
  function grantMasterRole() {
    // マスター権限のユーザー情報を作成
    const masterUser = {
      id: 'backdoor-master',
      email: 'backdoor@misesapo.app',
      role: 'master',
      name: 'マスター（バックドア）',
      employee_id: 'MST-BACKDOOR',
      status: 'active',
      created_at: new Date().toISOString(),
      is_backdoor: true // バックドア経由であることを示すフラグ
    };
    
    // 認証情報を保存
    if (window.Auth && window.Auth.setAuthData) {
      window.Auth.setAuthData('master', masterUser.email, masterUser);
    } else {
      // フォールバック: 直接sessionStorageに保存
      sessionStorage.setItem('misesapo_user', JSON.stringify(masterUser));
      sessionStorage.setItem('misesapo_auth', JSON.stringify({
        role: 'master',
        email: masterUser.email,
        timestamp: Date.now(),
        user: masterUser
      }));
    }
    
    // 成功メッセージを表示
    alert('マスター権限が付与されました。\nページをリロードしてください。');
    
    // ページをリロード
    window.location.reload();
  }
  
  /**
   * クリックイベントハンドラ
   */
  function handleCopyrightClick() {
    // タイムアウトをクリア
    if (clickTimeout) {
      clearTimeout(clickTimeout);
    }
    
    // クリックカウントを増やす
    clickCount++;
    
    // 6回クリックされたらマスター権限を付与
    if (clickCount >= REQUIRED_CLICKS) {
      clickCount = 0;
      grantMasterRole();
      return;
    }
    
    // タイムアウトを設定（一定時間以内に次のクリックがないとリセット）
    clickTimeout = setTimeout(() => {
      clickCount = 0;
      clickTimeout = null;
    }, CLICK_TIMEOUT_MS);
  }
  
  /**
   * 初期化
   */
  function init() {
    const copyrightElement = document.getElementById('footer-copyright');
    if (!copyrightElement) {
      return;
    }
    
    // クリックイベントを追加
    copyrightElement.addEventListener('click', handleCopyrightClick);
    
    // 視覚的なフィードバック（ホバー時にカーソルをポインターに）
    copyrightElement.style.cursor = 'pointer';
    copyrightElement.title = '開発用バックドア（6回連続クリック）';
  }
  
  // DOMContentLoaded時に初期化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

