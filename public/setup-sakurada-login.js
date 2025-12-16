// sakuradaユーザーでログイン状態を設定するスクリプト
// ブラウザのコンソールで実行するか、このファイルを読み込んで実行してください

(function() {
  const sakuradaUser = {
    id: "9999",
    name: "櫻田傑",
    email: "sakurada@misesapo.co.jp",
    username: "sakurada@misesapo.co.jp",
    role: "admin",
    role_code: "1",
    department: "開発",
    status: "active",
    scheduled_start_time: "09:00",
    scheduled_end_time: "18:00",
    scheduled_work_hours: 8
  };

  // localStorageに認証情報を設定
  localStorage.setItem('cognito_user', JSON.stringify(sakuradaUser));
  localStorage.setItem('misesapo_auth', JSON.stringify({
    role: 'admin',
    email: 'sakurada@misesapo.co.jp',
    user: sakuradaUser
  }));

  console.log('✅ sakuradaユーザーでログイン状態を設定しました');
  console.log('ユーザー情報:', sakuradaUser);
  console.log('ページをリロードしてください: location.reload()');
  
  // 自動リロード（オプション）
  // location.reload();
})();





