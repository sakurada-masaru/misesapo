const API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';
const REPORT_API = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';
let currentUser = null;
let attendanceRecords = {};
let currentCalendarDate = new Date();

async function buildAuthHeaders(includeContentType = false) {
  const headers = {};
  if (includeContentType) {
    headers['Content-Type'] = 'application/json';
  }
  const idToken = await getCognitoIdToken();
  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`;
  }
  return headers;
}

async function requireAuthOrRedirect(contextLabel) {
  const idToken = await getCognitoIdToken();
  if (idToken) return idToken;

  showErrorMessage(`${contextLabel}のため再ログインが必要です。ログイン画面へ移動します。`);
  const redirect = encodeURIComponent(window.location.pathname + window.location.search);
  setTimeout(() => {
    window.location.href = `/staff/signin.html?redirect=${redirect}`;
  }, 800);
  return null;
}

function handleAuthError(contextLabel) {
  showErrorMessage(`${contextLabel}のため再ログインが必要です。ログイン画面へ移動します。`);
  const redirect = encodeURIComponent(window.location.pathname + window.location.search);
  setTimeout(() => {
    window.location.href = `/staff/signin.html?redirect=${redirect}`;
  }, 800);
}

// 従業員用ログアウト関数
function staffLogout() {
  // Cognitoからログアウト
  if (window.CognitoAuth && typeof window.CognitoAuth.logout === 'function') {
    window.CognitoAuth.logout();
  }
  // ローカルストレージをクリア
  localStorage.removeItem('cognito_user');
  localStorage.removeItem('misesapo_auth');
  localStorage.removeItem('cognito_id_token');
  localStorage.removeItem('cognito_access_token');
  localStorage.removeItem('cognito_refresh_token');
  // 従業員ログイン画面にリダイレクト
  window.location.href = '/staff/signin.html';
}

// 日付が変わったときに今日の出退勤データを初期化
function initializeAttendanceForToday() {
  const today = new Date().toISOString().split('T')[0];
  const lastCheckDate = localStorage.getItem('lastAttendanceCheckDate');

  // 日付が変わった場合
  if (lastCheckDate && lastCheckDate !== today) {
    console.log('[Attendance] 日付が変わりました。新しい日の出退勤を開始します。');
    console.log('[Attendance] 前日の日付:', lastCheckDate, '→ 今日の日付:', today);

    // 前日のデータは保持（出勤履歴で使用）
    // 今日のデータを初期化（存在しない場合のみ）
    if (!attendanceRecords[today]) {
      attendanceRecords[today] = {};
    }

    // 今日のデータが存在する場合でも、現在のユーザーのデータを初期化しない
    // （既に打刻済みの場合は保持）
    // ただし、前日のデータが今日のデータとして誤って表示されないようにする
    if (attendanceRecords[lastCheckDate] && attendanceRecords[lastCheckDate][currentUser?.id]) {
      console.log('[Attendance] 前日の出退勤データを保持:', lastCheckDate);
    }
  } else if (!lastCheckDate) {
    // 初回実行時
    console.log('[Attendance] 初回実行。今日の日付:', today);
  }

  // 最後にチェックした日付を更新
  localStorage.setItem('lastAttendanceCheckDate', today);
}

// 現在のユーザー情報を取得
async function loadCurrentUser() {
  const loadingEl = document.getElementById('loading');
  const contentEl = document.getElementById('mypage-content');
  const errorEl = document.getElementById('error-message');

  try {
    loadingEl.style.display = 'block';
    contentEl.style.display = 'none';
    errorEl.style.display = 'none';

    // 日付が変わったかチェックして初期化
    initializeAttendanceForToday();

    // ユーザーIDまたはメールアドレスを取得（優先順位: URLパラメータ > 認証情報）
    let userId = null;
    let userEmail = null;

    // URLパラメータからIDまたはメールアドレスを取得
    const urlParams = new URLSearchParams(window.location.search);
    const urlId = urlParams.get('id');
    const urlEmail = urlParams.get('email');

    if (urlId) {
      userId = urlId;
    } else if (urlEmail) {
      userEmail = urlEmail;
    }

    // URLパラメータがない場合、認証情報から個人のIDまたはメールアドレスを取得（Cognito認証を優先）
    if (!userId && !userEmail) {
      // まずローカルストレージのcognito_userを確認（最も信頼性が高い）
      try {
        const storedCognitoUser = localStorage.getItem('cognito_user');
        if (storedCognitoUser) {
          const parsedUser = JSON.parse(storedCognitoUser);
          // IDを優先（マイページはIDで紐付け）
          if (parsedUser.id) {
            userId = parsedUser.id;
            console.log('[Mypage] Using ID from stored cognito_user:', userId);
          } else if (parsedUser.email) {
            userEmail = parsedUser.email;
            console.log('[Mypage] Using email from stored cognito_user (fallback):', userEmail);
          }
        }
      } catch (e) {
        console.warn('[Mypage] Error parsing stored cognito_user:', e);
      }

      // ローカルストレージになければCognito認証を確認
      if (!userId && !userEmail && window.CognitoAuth && window.CognitoAuth.isAuthenticated()) {
        const cognitoUser = await window.CognitoAuth.getCurrentUser();
        console.log('[Mypage] Cognito user:', cognitoUser);
        if (cognitoUser) {
          // IDを優先（マイページはIDで紐付け）
          if (cognitoUser.id) {
            userId = cognitoUser.id;  // DynamoDBのID
            console.log('[Mypage] Using ID from Cognito:', userId);
          } else if (cognitoUser.email) {
            userEmail = cognitoUser.email;
            console.log('[Mypage] Using email from Cognito (fallback):', userEmail);
          }
        }
      }

      // misesapo_authも確認（フォールバック）
      if (!userId && !userEmail) {
        try {
          const storedAuth = localStorage.getItem('misesapo_auth');
          if (storedAuth) {
            const parsedAuth = JSON.parse(storedAuth);
            if (parsedAuth.email) {
              userEmail = parsedAuth.email;
              console.log('[Mypage] Using email from misesapo_auth:', userEmail);
            } else if (parsedAuth.user && parsedAuth.user.email) {
              userEmail = parsedAuth.user.email;
              console.log('[Mypage] Using email from misesapo_auth.user:', userEmail);
            }
          }
        } catch (e) {
          console.warn('[Mypage] Error parsing misesapo_auth:', e);
        }
      }

    }

    if (!userId && !userEmail) {
      throw new Error('ミセサポへようこそ。従業員アカウントでログインしてください。');
    }

    // ユーザー情報を取得（AWS APIを優先、ローカルJSONはフォールバック）
    try {
      // キャッシュを無効化するためにタイムスタンプを追加
      const timestamp = new Date().getTime();

      // まずAWS APIから最新データを取得
      let response = null;
      let urlParamId = userId; // URLパラメータのIDを保存
      const authHeaders = await buildAuthHeaders();

      if (userId) {
        // IDで取得を試みる（キャッシュ無効化）
        response = await fetch(`${API_BASE}/workers/${userId}?t=${timestamp}&_=${Date.now()}`, {
          cache: 'no-store',
          headers: authHeaders
        });
        if (response.ok) {
          currentUser = await response.json();
          console.log('[Mypage] Found user by ID from API:', currentUser.name);
        } else if (response.status === 404) {
          // 404エラーの場合、URLパラメータのIDが無効な可能性がある
          console.warn('[Mypage] User not found by URL param ID:', userId, '- will try email or Cognito auth');
          // URLパラメータのIDを無視して、メールアドレスまたはCognito認証から取得したIDを使用
          userId = null;
          // メールアドレスを取得
          if (!userEmail) {
            try {
              const storedCognitoUser = localStorage.getItem('cognito_user');
              if (storedCognitoUser) {
                const parsedUser = JSON.parse(storedCognitoUser);
                if (parsedUser.email) {
                  userEmail = parsedUser.email;
                  console.log('[Mypage] Using email from stored cognito_user after 404:', userEmail);
                }
              }
            } catch (e) {
              console.warn('[Mypage] Error parsing stored cognito_user:', e);
            }
          }
        }
      }

      // IDで見つからない場合、Cognito認証から取得したIDを使用
      if (!currentUser || !currentUser.id) {
        // まずCognito認証から最新のユーザー情報を取得
        if (window.CognitoAuth && window.CognitoAuth.isAuthenticated()) {
          try {
            const cognitoUser = await window.CognitoAuth.getCurrentUser();
            if (cognitoUser && cognitoUser.id && cognitoUser.id !== urlParamId) {
              // Cognito認証から取得したIDがURLパラメータのIDと異なる場合、そのIDで検索
              console.log('[Mypage] Trying Cognito auth ID:', cognitoUser.id);
              response = await fetch(`${API_BASE}/workers/${cognitoUser.id}?t=${timestamp}&_=${Date.now()}`, {
                cache: 'no-store',
                headers: authHeaders
              });
              if (response && response.ok) {
                currentUser = await response.json();
                console.log('[Mypage] Found user by Cognito auth ID from API:', currentUser.name);
                // URLを更新（古いIDを新しいIDに置き換え）
                const newUrl = new URL(window.location.href);
                newUrl.searchParams.set('id', cognitoUser.id);
                window.history.replaceState({}, '', newUrl.toString());
              }
            }
          } catch (cognitoError) {
            console.warn('[Mypage] Error getting Cognito user:', cognitoError);
          }
        }
      }

      // まだ見つからない場合、メールアドレスで検索
      if (!currentUser || !currentUser.id) {
        if (userEmail) {
          response = await fetch(`${API_BASE}/workers?email=${encodeURIComponent(userEmail)}&t=${timestamp}&_=${Date.now()}`, {
            cache: 'no-store',
            headers: authHeaders
          });
          if (response && response.ok) {
            const users = await response.json();
            const items = users.items || users.workers || users;
            if (Array.isArray(items) && items.length > 0) {
              const matchingUser = items.find(u => u.email && u.email.toLowerCase() === userEmail.toLowerCase());
              if (matchingUser) {
                currentUser = matchingUser;
                console.log('[Mypage] Found user by email from API:', matchingUser.name);
                // URLを更新（正しいIDに置き換え）
                const newUrl = new URL(window.location.href);
                newUrl.searchParams.set('id', matchingUser.id);
                window.history.replaceState({}, '', newUrl.toString());
              }
            }
          }
        }
      }

      // まだ見つからない場合、Cognito Subで検索
      if (!currentUser || !currentUser.id) {
        let fallbackResponse = null;

        // Cognito Subで検索
        if (window.CognitoAuth) {
          const cognitoUser = await window.CognitoAuth.getCurrentUser();
          if (cognitoUser && cognitoUser.cognito_sub) {
            fallbackResponse = await fetch(`${API_BASE}/workers?cognito_sub=${encodeURIComponent(cognitoUser.cognito_sub)}&t=${timestamp}&_=${Date.now()}`, {
              cache: 'no-store',
              headers: authHeaders
            });
          }
        }


        if (fallbackResponse && fallbackResponse.ok) {
          const users = await fallbackResponse.json();
          const items = users.items || users.workers || users;
          if (Array.isArray(items) && items.length > 0) {
            currentUser = items[0];
            console.log('[Mypage] Found user from fallback API:', currentUser.name);
            // URLを更新（正しいIDに置き換え）
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('id', currentUser.id);
            window.history.replaceState({}, '', newUrl.toString());
          }
        }
      }

      // APIで取得できない場合のみ、ローカルのworkers.jsonをフォールバックとして使用
      if (!currentUser || !currentUser.id) {
        console.warn('[Mypage] API取得に失敗、ローカルのworkers.jsonを試行');
        try {
          const localResponse = await fetch(`/data/workers.json?t=${timestamp}&_=${Date.now()}`, {
            cache: 'no-store'
          });
          if (localResponse.ok) {
            const localWorkers = await localResponse.json();
            if (Array.isArray(localWorkers) && localWorkers.length > 0) {
              // メールアドレスで検索
              if (userEmail) {
                const matchingUser = localWorkers.find(u => u.email && u.email.toLowerCase() === userEmail.toLowerCase());
                if (matchingUser) {
                  currentUser = matchingUser;
                  console.log('[Mypage] Found user from local data (fallback):', matchingUser.name);
                }
              }
              // IDで検索
              if (!currentUser && userId) {
                const matchingUser = localWorkers.find(u => u.id === userId);
                if (matchingUser) {
                  currentUser = matchingUser;
                  console.log('[Mypage] Found user by ID from local data (fallback):', matchingUser.name);
                }
              }
            }
          }
        } catch (localError) {
          console.log('[Mypage] Local workers.json also not available');
        }
      }
    } catch (error) {
      console.error('Error fetching user info:', error);
    }

    if (!currentUser || !currentUser.id) {
      throw new Error('ユーザー情報を取得できませんでした。ミセサポの従業員ログインをお願いします。');
    }

    console.log('User loaded:', currentUser);

    // ロールを変換
    if (currentUser.role_code !== undefined) {
      currentUser.role = getRoleFromCode(currentUser.role_code);
    }

    const hasAttendanceUI = Boolean(document.getElementById('attendance-toggle-btn'));
    const hasDailyReportUI = Boolean(document.getElementById('daily-report-content'));
    const hasCalendarUI = Boolean(document.getElementById('calendar-title')) && Boolean(document.getElementById('calendar-grid'));
    const isOSPage = window.location.pathname.includes('/staff/os/mypage');

    // 出退勤記録を読み込み（非同期）
    // OS課のマイページでは通常の出退勤システムが当てはまらないため、スキップ
    if ((hasAttendanceUI || hasCalendarUI) && !isOSPage) {
      await loadAttendanceRecords();
    }

    // ユーザー情報を表示
    renderUser(currentUser);

    // スケジュールと業務連絡を読み込み
    // loadWeeklySchedule(); // weekly-scheduleセクションが存在しないためコメントアウト
    loadAnnouncements();
    if (hasDailyReportUI) {
      loadDailyReports();
    }

    // カレンダーを表示
    if (hasCalendarUI) {
      renderCalendar();
    }

    loadingEl.style.display = 'none';
    contentEl.style.display = 'flex';

    console.log('Content displayed, checking button...');
    console.log('Button element:', document.getElementById('attendance-toggle-btn'));
    console.log('Content element display:', window.getComputedStyle(contentEl).display);

    // Bentoグリッドでは配置はCSS Gridで管理されるため、restoreSectionLayoutは不要
    // setTimeout(() => {
    //   restoreSectionLayout();
    // }, 100);

    // 出退勤ボタンのイベントリスナーを再設定（コンテンツ表示後）
    // 少し遅延を入れてDOMが完全にレンダリングされるのを待つ
    if (hasAttendanceUI) {
      setTimeout(() => {
        console.log('Setting up button after delay...');
        setupAttendanceToggleButton();

        // ボタンが存在するか再確認
        const btn = document.getElementById('attendance-toggle-btn');
        if (btn) {
          console.log('Button found after setup:', btn);
          console.log('Button display style:', window.getComputedStyle(btn).display);
          console.log('Button visibility:', window.getComputedStyle(btn).visibility);
          console.log('Button parent display:', window.getComputedStyle(btn.parentElement).display);
        } else {
          console.error('Button still not found after setup!');
        }

        // アコーディオン機能は削除されました
      }, 100);
    }
  } catch (error) {
    console.error('Error loading user:', error);
    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
    errorEl.textContent = `エラー: ${error.message}`;
  }
}

function getRoleFromCode(code) {
  if (code === '99' || code === 99) return 'staff';
  if (code === '1' || code === 1) return 'admin';
  if (code === '2' || code === 2) return 'sales';
  return 'staff';
}

function getRoleLabel(role) {
  const labels = { staff: '清掃員', sales: '営業', admin: '管理者', other: 'その他' };
  return labels[role] || role;
}

function getRoleColor(role) {
  const colors = {
    staff: '#f59e0b',
    sales: '#10b981',
    admin: '#ec4899',
    other: '#64748b'
  };
  return colors[role] || '#64748b';
}

// ユーザー情報を表示
function renderUser(user) {
  // ヘッダーは削除されたため、ユーザー名の表示は不要

  // 基本情報を表示
  renderBasicInfo(user);

  // 出退勤セクションのヘッダーにユーザー名を表示する処理は削除（基本情報に統合されたため）

  // 営業マイページまたはOS課マイページの場合、今月の総案件数を読み込む
  if (window.location.pathname.includes('/sales/mypage') || window.location.pathname.includes('/staff/os/mypage')) {
    loadMonthlySchedulesCount();
  }

  // OS課マイページの場合、直近のスケジュール情報を読み込む
  if (window.location.pathname.includes('/staff/os/mypage')) {
    loadOSNextSchedule(user);
    // リアルタイム更新（30秒ごと）
    setInterval(() => {
      loadOSNextSchedule(user);
    }, 30000);
  }

  // TODOリストコンテナの時計を初期化
  initializeTodoClock();

  // スケジュール一覧を読み込む（清掃員マイページの場合）
  if (window.location.pathname.includes('/staff/mypage') || window.location.pathname.includes('/staff/os/mypage')) {
    loadScheduleList(user);
  }

  // OS課の場合は専用サイドバーに置き換え
  if (user.department === 'OS課') {
    loadOSSectionSidebar();
  } else {
    // サイドバーのロールバッジを更新
    const roleBadge = document.getElementById('sidebar-role-badge');
    if (roleBadge && user.department) {
      roleBadge.textContent = user.department;
    }
  }

}

// OS課専用サイドバーを設定
function loadOSSectionSidebar() {
  const sidebarNav = document.querySelector('#admin-sidebar .sidebar-nav');
  if (!sidebarNav) {
    console.warn('Sidebar nav not found');
    return;
  }

  // ロールバッジを更新
  const roleBadge = document.getElementById('sidebar-role-badge');
  if (roleBadge) {
    roleBadge.textContent = 'OS課';
  }

  // 日報と出勤履歴を非表示にする
  const dailyReportsLink = sidebarNav.querySelector('a[data-page="daily-reports"]');
  const attendanceHistoryLink = sidebarNav.querySelector('a[data-page="attendance-history"]');
  if (dailyReportsLink) {
    dailyReportsLink.style.display = 'none';
  }
  if (attendanceHistoryLink) {
    attendanceHistoryLink.style.display = 'none';
  }

  // 作業一覧リンクが存在しない場合は追加
  let workListLink = sidebarNav.querySelector('a[data-page="work-list"]');
  if (!workListLink) {
    // スケジュールリンクの後に作業一覧を追加
    const scheduleLink = sidebarNav.querySelector('a[data-page="schedule"]');
    if (scheduleLink) {
      workListLink = document.createElement('a');
      workListLink.href = '/staff/work-list';
      workListLink.className = 'nav-item';
      workListLink.setAttribute('data-page', 'work-list');
      workListLink.innerHTML = '<i class="fas fa-tasks"></i><span class="nav-label">作業一覧</span>';
      scheduleLink.insertAdjacentElement('afterend', workListLink);
    }
  }

  // レポート作成リンクが存在しない場合は追加
  let reportNewLink = sidebarNav.querySelector('a[data-page="reports-new"]');
  if (!reportNewLink) {
    // 作業一覧の後にレポート作成を追加
    if (workListLink) {
      reportNewLink = document.createElement('a');
      reportNewLink.href = '/staff/reports/new';
      reportNewLink.className = 'nav-item';
      reportNewLink.setAttribute('data-page', 'reports-new');
      reportNewLink.innerHTML = '<i class="fas fa-file-alt"></i><span class="nav-label">レポート作成</span>';
      workListLink.insertAdjacentElement('afterend', reportNewLink);
    }
  }

  console.log('OS section sidebar configured');
}


function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatTime(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

// 労働時間を計算（休憩時間を考慮）
function calculateWorkHours(clockIn, clockOut, breaks) {
  if (!clockIn || !clockOut) return 0;

  const start = new Date(clockIn);
  const end = new Date(clockOut);
  const totalHours = (end - start) / (1000 * 60 * 60);

  const breakTime = calculateTotalBreakTime(breaks || []);
  const workHours = Math.max(0, totalHours - breakTime);

  return round(workHours, 2);
}

// 労働時間をフォーマット
function formatWorkHours(hours) {
  if (!hours || hours === 0) return '0時間';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) {
    return `${h}時間`;
  }
  return `${h}時間${m}分`;
}

// 出退勤記録を読み込み
async function loadAttendanceRecords() {
  if (!currentUser) {
    // ローカルストレージから読み込み（フォールバック）
    try {
      const stored = localStorage.getItem('attendanceRecords');
      if (stored) {
        attendanceRecords = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading attendance records from localStorage:', error);
      attendanceRecords = {};
    }
    renderAttendanceStatus();
    calculateMonthlyStats();
    return;
  }

  try {
    // APIから勤怠記録を取得（今日の記録）
    const today = new Date().toISOString().split('T')[0];
    const idToken = await getCognitoIdToken();
    const headers = {
      'Content-Type': 'application/json'
    };
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }
    // 404エラーを抑制するため、エラーハンドリングを改善
    let response = null;
    try {
      response = await fetch(`${API_BASE}/attendance?staff_id=${currentUser.id}&date=${today}`, {
        headers: headers
      });
    } catch (error) {
      // ネットワークエラーのみキャッチ（404は正常なケースとして扱う）
      if (error && error.message && !error.message.includes('404')) {
        console.warn('Attendance API request failed:', error);
      }
      response = null;
    }

    // 404エラーの場合は静かに処理（APIが実装されていない場合）
    if (response && response.status === 404) {
      // 404は正常なケース（APIが実装されていない）として扱い、ログを出力しない
      response = null;
    }

    if (response && response.ok) {
      const data = await response.json();
      // レスポンスが配列の場合とオブジェクトの場合に対応
      let record = null;
      if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        record = data.items[0];
      } else if (data.date || data.clock_in) {
        record = data;
      }

      if (record) {
        // APIから取得したデータをattendanceRecordsに変換
        const date = record.date || today;
        if (!attendanceRecords[date]) {
          attendanceRecords[date] = {};
        }
        attendanceRecords[date][currentUser.id] = {
          clock_in: record.clock_in,
          clock_out: record.clock_out,
          staff_id: record.staff_id || currentUser.id,
          staff_name: record.staff_name || currentUser.name,
          breaks: record.breaks || [],
          work_hours: record.work_hours,
          is_late: record.is_late,
          late_minutes: record.late_minutes,
          is_early_leave: record.is_early_leave,
          early_leave_minutes: record.early_leave_minutes
        };
      }
    }
    // 404エラーやその他のエラーは正常（APIが実装されていない場合）
    // ローカルストレージから読み込むため、エラーをログに出力しない
  } catch (error) {
    // ネットワークエラーなどの場合のみ警告を出力（404は除外）
    if (error && error.message && !error.message.includes('404')) {
      console.warn('APIからの勤怠記録取得に失敗しました。ローカルストレージから読み込みます:', error);
    }
  }

  // ローカルストレージからも読み込み（フォールバック）
  try {
    const stored = localStorage.getItem('attendanceRecords');
    if (stored) {
      const localRecords = JSON.parse(stored);
      // ローカルストレージのデータとマージ
      for (const date in localRecords) {
        if (!attendanceRecords[date]) {
          attendanceRecords[date] = {};
        }
        Object.assign(attendanceRecords[date], localRecords[date]);
      }
    }
  } catch (error) {
    console.error('Error loading attendance records from localStorage:', error);
    if (Object.keys(attendanceRecords).length === 0) {
      attendanceRecords = {};
    }
  }

  // DOM要素が存在することを確認してから表示を更新
  const statusIndicator = document.getElementById('status-indicator');
  if (statusIndicator) {
    renderAttendanceStatus();
    calculateMonthlyStats();
  } else {
    // DOM要素がまだ存在しない場合は、少し遅延してから再試行
    setTimeout(() => {
      renderAttendanceStatus();
      calculateMonthlyStats();
    }, 100);
  }
}

// 出退勤ステータスを表示
function renderAttendanceStatus() {
  if (!currentUser) return;

  // 日付が変わったかチェック（表示前に実行）
  initializeAttendanceForToday();

  const today = new Date().toISOString().split('T')[0];
  const todayRecord = attendanceRecords[today]?.[currentUser.id];

  const statusIndicator = document.getElementById('status-indicator');
  const statusLabel = document.getElementById('status-label');
  const statusTime = document.getElementById('status-time');
  const toggleBtn = document.getElementById('attendance-toggle-btn');
  const toggleBtnText = document.getElementById('toggle-btn-text');

  // 要素が存在しない場合は処理を中断
  if (!statusIndicator || !statusLabel || !statusTime || !toggleBtn || !toggleBtnText) {
    console.warn('[Attendance] 出退勤ステータス表示用の要素が見つかりません。ページの読み込みが完了していない可能性があります。');
    return;
  }

  if (todayRecord && todayRecord.clock_in && !todayRecord.clock_out) {
    // 出勤中
    statusIndicator.className = 'status-indicator working';
    statusLabel.textContent = '出勤中';
    statusTime.textContent = formatTime(todayRecord.clock_in);
    toggleBtnText.textContent = '退勤';
    toggleBtn.classList.remove('btn-clock-in');
    toggleBtn.classList.add('btn-clock-out');
    const icon = toggleBtn.querySelector('i');
    if (icon) {
      icon.className = 'fas fa-sign-out-alt';
    }
  } else if (todayRecord && todayRecord.clock_out) {
    // 退勤済み
    statusIndicator.className = 'status-indicator';
    statusLabel.textContent = '退勤済み';

    // 退勤時刻を表示
    statusTime.textContent = formatTime(todayRecord.clock_out);

    toggleBtnText.textContent = '出勤';
    toggleBtn.classList.remove('btn-clock-out');
    toggleBtn.classList.add('btn-clock-in');
    const icon = toggleBtn.querySelector('i');
    if (icon) {
      icon.className = 'fas fa-sign-in-alt';
    }
  } else {
    // 未出勤
    statusIndicator.className = 'status-indicator';
    statusLabel.textContent = '未出勤';
    statusTime.textContent = '--:--';
    toggleBtnText.textContent = '出勤';
    toggleBtn.classList.remove('btn-clock-out');
    toggleBtn.classList.add('btn-clock-in');
    const icon = toggleBtn.querySelector('i');
    if (icon) {
      icon.className = 'fas fa-sign-in-alt';
    }
  }
}

// 総休憩時間を計算（労働時間計算で使用）
function calculateTotalBreakTime(breaks) {
  if (!breaks || !Array.isArray(breaks)) return 0;
  return breaks.reduce((total, b) => {
    if (b.break_duration) {
      return total + b.break_duration;
    } else if (b.break_start && b.break_end) {
      const start = new Date(b.break_start);
      const end = new Date(b.break_end);
      return total + (end - start) / (1000 * 60 * 60);
    }
    return total;
  }, 0);
}

// 月間統計を計算
function calculateMonthlyStats() {
  if (!currentUser) return;
  const workDaysEl = document.getElementById('monthly-work-days');
  const workHoursEl = document.getElementById('monthly-work-hours');
  if (!workDaysEl || !workHoursEl) return;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  let workDays = 0;
  let totalHours = 0;

  for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const record = attendanceRecords[dateStr]?.[currentUser.id];

    if (record && record.clock_in && record.clock_out) {
      workDays++;
      // 実労働時間を計算（休憩時間を考慮）
      const hours = calculateWorkHours(record.clock_in, record.clock_out, record.breaks || []);
      totalHours += hours;
    }
  }

  workDaysEl.textContent = `${workDays}日`;
  workHoursEl.textContent = formatWorkHours(totalHours);
}

// 確認ダイアログを表示する関数
function showConfirmDialog(title, message, confirmText, cancelText) {
  return new Promise((resolve) => {
    // ダイアログのHTMLを作成
    const dialogHTML = `
      <div id="attendance-confirm-dialog" style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      ">
        <div style="
          background: white;
          border-radius: 8px;
          padding: 24px;
          max-width: 400px;
          width: 90%;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        ">
          <h3 style="
            margin: 0 0 16px 0;
            font-size: 1.25rem;
            font-weight: 600;
            color: #1f2937;
          ">${title}</h3>
          <div style="
            margin-bottom: 24px;
            color: #4b5563;
            line-height: 1.6;
            white-space: pre-line;
          ">${message}</div>
          <div style="
            display: flex;
            gap: 12px;
            justify-content: flex-end;
          ">
            <button id="dialog-cancel-btn" style="
              padding: 8px 16px;
              border: 1px solid #d1d5db;
              border-radius: 4px;
              background: white;
              color: #374151;
              cursor: pointer;
              font-size: 0.875rem;
            ">${cancelText}</button>
            <button id="dialog-confirm-btn" style="
              padding: 8px 16px;
              border: none;
              border-radius: 4px;
              background: var(--primary, #3b82f6);
              color: white;
              cursor: pointer;
              font-size: 0.875rem;
              font-weight: 500;
            ">${confirmText}</button>
          </div>
        </div>
      </div>
    `;

    // ダイアログをDOMに追加
    document.body.insertAdjacentHTML('beforeend', dialogHTML);

    const dialog = document.getElementById('attendance-confirm-dialog');
    const confirmBtn = document.getElementById('dialog-confirm-btn');
    const cancelBtn = document.getElementById('dialog-cancel-btn');

    // 確認ボタン
    confirmBtn.addEventListener('click', () => {
      dialog.remove();
      resolve(true);
    });

    // キャンセルボタン
    cancelBtn.addEventListener('click', () => {
      dialog.remove();
      resolve(false);
    });

    // 背景クリックでキャンセル
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) {
        dialog.remove();
        resolve(false);
      }
    });
  });
}

// エラーメッセージを表示
function showErrorMessage(message) {
  const errorEl = document.getElementById('error-message');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    errorEl.style.background = '#fee2e2';
    errorEl.style.color = '#991b1b';

    // 5秒後に自動的に非表示
    setTimeout(() => {
      errorEl.style.display = 'none';
    }, 5000);
  } else {
    alert(message);
  }
}

// 警告メッセージを表示
function showWarningMessage(message) {
  const errorEl = document.getElementById('error-message');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    errorEl.style.background = '#fef3c7';
    errorEl.style.color = '#92400e';

    // 5秒後に自動的に非表示
    setTimeout(() => {
      errorEl.style.display = 'none';
    }, 5000);
  } else {
    alert(message);
  }
}

// 成功メッセージを表示
function showSuccessMessage(message) {
  const errorEl = document.getElementById('error-message');
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    errorEl.style.background = '#d1fae5';
    errorEl.style.color = '#065f46';

    // 3秒後に自動的に非表示
    setTimeout(() => {
      errorEl.style.display = 'none';
    }, 3000);
  }
}

// 時刻をフォーマット（確認ダイアログ用）
function formatTimeForDialog(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

// 勤務時間を計算（旧バージョン - 互換性のため残す）
function calculateWorkHoursOld(clockIn, clockOut) {
  if (!clockIn || !clockOut) return null;
  const start = new Date(clockIn);
  const end = new Date(clockOut);
  const diff = end - start;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return { hours, minutes };
}

// 労働時間を計算（休憩時間を考慮）
function calculateWorkHours(clockIn, clockOut, breaks) {
  if (!clockIn || !clockOut) return 0;

  const start = new Date(clockIn);
  const end = new Date(clockOut);
  const totalHours = (end - start) / (1000 * 60 * 60);

  const breakTime = calculateTotalBreakTime(breaks || []);
  const workHours = Math.max(0, totalHours - breakTime);

  return round(workHours, 2);
}

// 労働時間をフォーマット
function formatWorkHours(hours) {
  if (!hours || hours === 0) return '0時間';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) {
    return `${h}時間`;
  }
  return `${h}時間${m}分`;
}

// 数値を丸める
function round(value, decimals) {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

// 時刻の妥当性チェック
function validateTime(timeString, type = 'clock_in') {
  if (!timeString) return { valid: true };

  const time = new Date(timeString);
  const now = new Date();

  // 未来時刻のチェック（5分の許容範囲を設ける）
  const futureLimit = new Date(now.getTime() + 5 * 60 * 1000); // 5分後
  if (time > futureLimit) {
    return {
      valid: false,
      message: `${type === 'clock_in' ? '出勤' : '退勤'}時刻が未来の時刻です`
    };
  }

  // 過去の時刻チェック（1日前より前はエラー）
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (time < oneDayAgo) {
    return {
      valid: false,
      message: `${type === 'clock_in' ? '出勤' : '退勤'}時刻が過去すぎます（24時間以内の時刻を指定してください）`
    };
  }

  return { valid: true };
}

// 出退勤時刻の整合性チェック
function validateAttendanceTimes(clockIn, clockOut) {
  if (!clockIn || !clockOut) return { valid: true };

  const inTime = new Date(clockIn);
  const outTime = new Date(clockOut);

  // 退勤時刻が出勤時刻より前の場合はエラー
  if (outTime <= inTime) {
    return {
      valid: false,
      message: '退勤時刻が出勤時刻より前です'
    };
  }

  // 勤務時間が24時間を超える場合は警告
  const workHours = (outTime - inTime) / (1000 * 60 * 60);
  if (workHours > 24) {
    return {
      valid: false,
      message: '勤務時間が24時間を超えています。時刻を確認してください'
    };
  }

  return { valid: true };
}

// 出退勤トグルボタンのセットアップ
function setupAttendanceToggleButton() {
  const toggleBtn = document.getElementById('attendance-toggle-btn');
  if (!toggleBtn) {
    return;
  }

  console.log('Setting up attendance toggle button:', toggleBtn);

  // 既存のイベントリスナーを削除（重複防止）
  const newToggleBtn = toggleBtn.cloneNode(true);
  toggleBtn.parentNode.replaceChild(newToggleBtn, toggleBtn);

  newToggleBtn.addEventListener('click', async () => {
    if (!currentUser) return;

    // 日付が変わったかチェック（打刻前に実行）
    initializeAttendanceForToday();

    // 重複送信を防止（ローディング中は無効化）
    if (newToggleBtn.disabled) {
      console.log('[Attendance] 既に処理中です。重複送信を防止します。');
      return;
    }

    // ボタンを無効化
    newToggleBtn.disabled = true;
    const originalText = newToggleBtn.innerHTML;
    newToggleBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 処理中...';

    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    if (!attendanceRecords[today]) {
      attendanceRecords[today] = {};
    }

    const todayRecord = attendanceRecords[today][currentUser.id] || {};
    let attendanceData = {};
    let shouldProceed = false;

    if (!todayRecord.clock_in) {
      // 出勤
      // 1日1回制限チェックは既に!todayRecord.clock_inで確認済み

      // 時刻の妥当性チェック
      const timeValidation = validateTime(now, 'clock_in');
      if (!timeValidation.valid) {
        showErrorMessage(timeValidation.message);
        newToggleBtn.disabled = false;
        newToggleBtn.innerHTML = originalText;
        return;
      }

      // 確認ダイアログを表示
      const currentTime = formatTimeForDialog(now);
      const message = `現在時刻: ${currentTime}\n\n出勤を記録しますか？`;
      shouldProceed = await showConfirmDialog('出勤を記録しますか？', message, '出勤する', 'キャンセル');

      if (!shouldProceed) {
        newToggleBtn.disabled = false;
        newToggleBtn.innerHTML = originalText;
        return;
      }

      attendanceData = {
        staff_id: currentUser.id,
        staff_name: currentUser.name,
        date: today,
        clock_in: now
      };
      attendanceRecords[today][currentUser.id] = {
        ...todayRecord,
        clock_in: now,
        staff_id: currentUser.id,
        staff_name: currentUser.name
      };

      // 出勤記録後、作業開始ボタンを表示
      setTimeout(() => {
        renderAttendanceStatus();
      }, 100);
    } else if (!todayRecord.clock_out) {
      // 退勤
      // 1日1回制限チェックは既に!todayRecord.clock_outで確認済み

      // 時刻の妥当性チェック
      const timeValidation = validateTime(now, 'clock_out');
      if (!timeValidation.valid) {
        showErrorMessage(timeValidation.message);
        newToggleBtn.disabled = false;
        newToggleBtn.innerHTML = originalText;
        return;
      }

      // 出退勤時刻の整合性チェック
      const consistencyValidation = validateAttendanceTimes(todayRecord.clock_in, now);
      if (!consistencyValidation.valid) {
        showErrorMessage(consistencyValidation.message);
        newToggleBtn.disabled = false;
        newToggleBtn.innerHTML = originalText;
        return;
      }

      // 確認ダイアログを表示
      const clockInTime = formatTimeForDialog(todayRecord.clock_in);
      const currentTime = formatTimeForDialog(now);
      const breaks = todayRecord.breaks || [];
      const workHours = calculateWorkHours(todayRecord.clock_in, now, breaks);
      const workHoursText = formatWorkHours(workHours);

      const message = `出勤時刻: ${clockInTime}\n現在時刻: ${currentTime}\n実労働時間: ${workHoursText}\n\n退勤を記録しますか？`;
      shouldProceed = await showConfirmDialog('退勤を記録しますか？', message, '退勤する', 'キャンセル');

      if (!shouldProceed) {
        newToggleBtn.disabled = false;
        newToggleBtn.innerHTML = originalText;
        return;
      }

      attendanceData = {
        staff_id: currentUser.id,
        staff_name: currentUser.name,
        date: today,
        clock_in: todayRecord.clock_in,
        clock_out: now,
        breaks: todayRecord.breaks || []
      };
      attendanceRecords[today][currentUser.id] = {
        ...todayRecord,
        clock_out: now
      };
    } else {
      // 再出勤（1日1回制限の例外：退勤後の再出勤は別記録として扱う）
      // 時刻の妥当性チェック
      const timeValidation = validateTime(now, 'clock_in');
      if (!timeValidation.valid) {
        showErrorMessage(timeValidation.message);
        newToggleBtn.disabled = false;
        newToggleBtn.innerHTML = originalText;
        return;
      }

      // 確認ダイアログを表示
      const currentTime = formatTimeForDialog(now);
      const message = `現在時刻: ${currentTime}\n\n再出勤を記録しますか？\n（退勤後の再出勤は別記録として扱われます）`;
      shouldProceed = await showConfirmDialog('再出勤を記録しますか？', message, '再出勤する', 'キャンセル');

      if (!shouldProceed) {
        newToggleBtn.disabled = false;
        newToggleBtn.innerHTML = originalText;
        return;
      }

      attendanceData = {
        staff_id: currentUser.id,
        staff_name: currentUser.name,
        date: today,
        clock_in: now,
        breaks: []
      };
      attendanceRecords[today][currentUser.id] = {
        clock_in: now,
        staff_id: currentUser.id,
        staff_name: currentUser.name,
        breaks: []
      };
    }

    try {
      // APIに保存
      const idToken = await getCognitoIdToken();
      const headers = {
        'Content-Type': 'application/json'
      };
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      // リクエストボディの形式を確認・修正
      // breaks配列が正しい形式（break_start, break_end）になっているか確認
      const sanitizedData = {
        staff_id: attendanceData.staff_id,
        staff_name: attendanceData.staff_name,
        date: attendanceData.date,
        clock_in: attendanceData.clock_in,
        clock_out: attendanceData.clock_out
      };

      // breaks配列の処理
      if (attendanceData.breaks && Array.isArray(attendanceData.breaks) && attendanceData.breaks.length > 0) {
        sanitizedData.breaks = attendanceData.breaks.map(breakItem => {
          // APIが期待する形式に変換
          if (breakItem && typeof breakItem === 'object') {
            if (breakItem.start && breakItem.end) {
              // start/end形式からbreak_start/break_end形式に変換
              return {
                break_start: breakItem.start,
                break_end: breakItem.end,
                break_duration: breakItem.duration || breakItem.break_duration
              };
            } else if (breakItem.break_start && breakItem.break_end) {
              // 既に正しい形式の場合はそのまま
              return breakItem;
            }
          }
          // 無効な形式の場合はスキップ
          return null;
        }).filter(item => item !== null); // nullを除外
      } else {
        // breaksが空または存在しない場合は空配列を送信しない（サーバー側で処理）
        sanitizedData.breaks = [];
      }

      console.log('Sending attendance data:', JSON.stringify(sanitizedData, null, 2));
      console.log('Request headers:', headers);

      const response = await fetch(`${API_BASE}/attendance`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(sanitizedData)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('[Attendance] 出退勤記録をAPIに保存しました:', result);
        console.log('[Attendance] 保存したデータ:', sanitizedData);
        console.log('[Attendance] 保存した日付:', sanitizedData.date);
        console.log('[Attendance] 保存した出勤時刻:', sanitizedData.clock_in);
        console.log('[Attendance] 保存した退勤時刻:', sanitizedData.clock_out);

        // 成功メッセージを表示（オプション）
        showSuccessMessage('出退勤記録を保存しました');

        // ローカルストレージにも保存（オフライン対応）
        localStorage.setItem('attendanceRecords', JSON.stringify(attendanceRecords));
        console.log('[Attendance] ローカルストレージに保存しました');

        // 画面をリフレッシュしてボタン状態を更新
        setTimeout(() => {
          location.reload();
        }, 500);
      } else {
        // ボタンを再有効化
        newToggleBtn.disabled = false;
        newToggleBtn.innerHTML = originalText;
        // エラーレスポンスを解析
        let errorMessage = '出退勤記録の保存に失敗しました';
        let errorCode = 'UNKNOWN_ERROR';

        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
          errorCode = errorData.code || errorCode;

          // エラーメッセージの詳細をログに出力
          console.error('Error response data:', errorData);

          // サーバーエラーの詳細メッセージを確認
          if (errorData.message && errorData.message.includes('Float types are not supported')) {
            // DynamoDBのFloat型エラーの場合
            errorMessage = 'サーバー側のデータベースエラーが発生しました。システム管理者に連絡してください。';
            console.error('DynamoDB Float type error - this is a server-side issue that needs to be fixed in the Lambda function');
          }

          // エラーコードに応じた処理
          if (errorCode === 'VALIDATION_ERROR') {
            // バリデーションエラーの場合
            showErrorMessage(`入力エラー: ${errorMessage}`);

            // ローカルストレージには保存しない（不正なデータのため）
            return;
          } else if (errorCode === 'DUPLICATE_RECORD') {
            // 重複記録エラーの場合
            showErrorMessage(`記録エラー: ${errorMessage}`);

            // 既存の記録を再読み込み
            await loadAttendanceRecords();
            renderAttendanceStatus();
            return;
          }
        } catch (parseError) {
          // JSON解析に失敗した場合、テキストとして取得を試みる
          try {
            const errorText = await response.text();
            console.error('Error response text:', errorText);
            errorMessage = `サーバーエラー (${response.status}): ${errorText || response.statusText}`;
          } catch (textError) {
            errorMessage = `サーバーエラー (${response.status}): ${response.statusText}`;
            console.error('Error parsing response:', parseError, textError);
          }
        }

        // エラーの詳細をログに出力
        console.error('Attendance API error:', {
          status: response.status,
          statusText: response.statusText,
          errorMessage: errorMessage,
          errorCode: errorCode,
          requestData: sanitizedData,
          originalRequestData: attendanceData
        });

        // ネットワークエラー以外の場合は、ローカルストレージに保存を試みる
        if (response.status >= 500) {
          // サーバーエラーの場合はローカルストレージに保存
          localStorage.setItem('attendanceRecords', JSON.stringify(attendanceRecords));
          renderAttendanceStatus();
          calculateMonthlyStats();
          renderCalendar();
          showWarningMessage('APIへの保存に失敗しましたが、ローカルストレージに保存しました。後で同期してください。');
        } else if (response.status === 401) {
          // 認証エラーの場合
          showErrorMessage('認証エラーが発生しました。ページを再読み込みしてください。');
          console.error('Authentication error - token may be invalid or expired');
        } else {
          // クライアントエラー（400番台）の場合は保存しない
          showErrorMessage(errorMessage);
        }
      }
    } catch (error) {
      // ネットワークエラーなどの例外
      console.error('Error saving attendance:', error);

      // ネットワークエラーの場合はローカルストレージに保存
      try {
        localStorage.setItem('attendanceRecords', JSON.stringify(attendanceRecords));
        renderAttendanceStatus();
        calculateMonthlyStats();
        renderCalendar();
        showWarningMessage('ネットワークエラーが発生しましたが、ローカルストレージに保存しました。接続が復旧したら自動的に同期されます。');
      } catch (localError) {
        console.error('Error saving to local storage:', localError);
        showErrorMessage('出退勤記録の保存に失敗しました。ページを再読み込みして再試行してください。');
      }
    } finally {
      // ボタンを再有効化（エラー時も確実に実行）
      newToggleBtn.disabled = false;
      newToggleBtn.innerHTML = originalText;
    }
  });
}

// 週間スケジュールを読み込み
async function loadWeeklySchedule() {
  if (!currentUser) return;

  try {
    // TODO: APIからスケジュールを取得
    const scheduleEl = document.getElementById('weekly-schedule-content');
    if (scheduleEl) {
      scheduleEl.innerHTML = '<div class="empty-state">今週の予定はありません</div>';
    }
    // weekly-scheduleセクションが存在しない場合は何もしない
  } catch (error) {
    // エラーを静かに処理（要素が存在しない場合は正常）
    if (error && error.message && !error.message.includes('null')) {
      console.error('Error loading schedule:', error);
    }
  }
}

// 業務連絡を読み込み
// Firebase ID Token取得（REPORT_API用）
async function getFirebaseIdToken() {
  try {
    // 1. Cognito ID Token（最優先）
    const cognitoIdToken = localStorage.getItem('cognito_id_token');
    if (cognitoIdToken) {
      return cognitoIdToken;
    }

    // 2. Cognito認証のユーザーオブジェクトからトークンを取得
    const cognitoUser = localStorage.getItem('cognito_user');
    if (cognitoUser) {
      try {
        const parsed = JSON.parse(cognitoUser);
        if (parsed.tokens && parsed.tokens.idToken) {
          return parsed.tokens.idToken;
        }
        if (parsed.idToken) {
          return parsed.idToken;
        }
      } catch (e) {
        console.warn('Error parsing cognito user:', e);
      }
    }

    // 3. CognitoAuthから取得
    if (window.CognitoAuth && window.CognitoAuth.isAuthenticated && window.CognitoAuth.isAuthenticated()) {
      try {
        const cognitoUser = await window.CognitoAuth.getCurrentUser();
        if (cognitoUser && cognitoUser.tokens && cognitoUser.tokens.idToken) {
          return cognitoUser.tokens.idToken;
        }
      } catch (e) {
        console.warn('Error getting token from CognitoAuth:', e);
      }
    }

    // 4. misesapo_auth から取得（フォールバック）
    const authData = localStorage.getItem('misesapo_auth');
    if (authData) {
      try {
        const parsed = JSON.parse(authData);
        if (parsed.token) {
          return parsed.token;
        }
      } catch (e) {
        console.warn('Error parsing auth data:', e);
      }
    }

    // 5. getCognitoIdToken()を試す（最後の手段）
    const cognitoToken = await getCognitoIdToken();
    if (cognitoToken && cognitoToken !== 'mock-token' && cognitoToken !== 'dev-token') {
      return cognitoToken;
    }

    return null;
  } catch (error) {
    console.error('Error getting Firebase ID token:', error);
    return null;
  }
}

async function loadAnnouncements() {
  if (!currentUser) {
    renderAnnouncements([]);
    return;
  }

  try {
    // Cognitoトークンを優先的に使用（REPORT_APIエンドポイントはCognitoトークンを受け入れる）
    const idToken = await getCognitoIdToken();
    // トークンがない場合はAPI呼び出しをスキップ
    if (!idToken) {
      console.log('[Announcements] No token available, skipping API call');
      renderAnnouncements([]);
      return;
    }

    console.log('[Announcements] Attempting to load announcements with token');
    const response = await fetch(`${REPORT_API}/staff/announcements`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${idToken}`
      }
    }).catch((error) => {
      // ネットワークエラーは静かに処理
      console.warn('Network error loading announcements:', error);
      return null;
    });

    if (response && response.ok) {
      const data = await response.json();
      const announcements = data.announcements || [];
      renderAnnouncements(announcements);
    } else {
      // 401エラーの場合、空のリストを表示（認証エラーは正常な動作として扱う）
      if (response && response.status === 401) {
        console.log('[Announcements] 401 Unauthorized - API endpoint may require different authentication or may not be available');
        // 401エラーは正常な動作として扱い、空のリストを表示
        renderAnnouncements([]);
      } else if (response) {
        console.warn(`Error loading announcements: ${response.status} ${response.statusText}`);
        renderAnnouncements([]);
      } else {
        renderAnnouncements([]);
      }
    }
  } catch (error) {
    // すべてのエラーを静かに処理（空のリストを表示）
    renderAnnouncements([]);
  }
}

// 基本情報を表示
function renderBasicInfo(user) {
  if (!user) return;

  const nameEl = document.getElementById('basic-info-name');
  const departmentEl = document.getElementById('basic-info-department');
  const emailEl = document.getElementById('basic-info-email');
  const phoneEl = document.getElementById('basic-info-phone');

  if (nameEl) nameEl.textContent = user.name || '-';
  if (departmentEl) departmentEl.textContent = user.department || '-';
  if (emailEl) emailEl.textContent = user.email || '-';
  if (phoneEl) phoneEl.textContent = user.phone || '-';
}

// 業務連絡を表示
function renderAnnouncements(announcements) {
  const announcementsEl = document.getElementById('announcements-list');
  if (!announcementsEl) return;

  if (announcements.length === 0) {
    announcementsEl.innerHTML = '<div class="empty-state">業務連絡はありません</div>';
    return;
  }

  // 最新5件のみ表示
  const recentAnnouncements = announcements.slice(0, 5);

  let html = '';
  recentAnnouncements.forEach(announcement => {
    const createdDate = new Date(announcement.created_at);
    const dateStr = createdDate.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const newBadge = announcement.is_new ? '<span class="new-badge">NEW</span>' : '';
    const readClass = announcement.is_read ? 'read' : 'unread';

    html += `
      <div class="announcement-item ${readClass}" data-id="${announcement.id}">
        <div class="announcement-header">
          <span class="announcement-title">${escapeHtml(announcement.title)}</span>
          ${newBadge}
        </div>
        <div class="announcement-meta">
          <span class="announcement-date">${dateStr}</span>
        </div>
        <div class="announcement-content">${escapeHtml(announcement.content.substring(0, 100))}${announcement.content.length > 100 ? '...' : ''}</div>
      </div>
    `;
  });

  if (announcements.length > 5) {
    html += `<div class="announcement-more"><a href="/staff/announcements" class="btn btn-text btn-sm">すべて見る</a></div>`;
  }

  announcementsEl.innerHTML = html;

  // クリックイベントを追加（既読マーク）
  announcementsEl.querySelectorAll('.announcement-item').forEach(item => {
    item.addEventListener('click', async () => {
      const announcementId = item.dataset.id;
      if (!announcementId) return;

      // 既読マーク
      try {
        const idToken = await getCognitoIdToken();
        await fetch(`${REPORT_API}/staff/announcements/${announcementId}/read`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        });

        // 表示を更新
        item.classList.remove('unread');
        item.classList.add('read');

        // サイドバーのバッジも更新
        if (window.AdminSidebar && window.AdminSidebar.updateNotificationBadges) {
          window.AdminSidebar.updateNotificationBadges();
        }
      } catch (error) {
        console.error('Error marking announcement read:', error);
      }

      // 詳細ページに遷移
      window.location.href = `/staff/announcements?id=${announcementId}`;
    });
  });
}

// 日報を読み込む
async function loadDailyReports() {
  if (!currentUser) return;
  if (!document.getElementById('daily-report-content')) return;

  // 今日の日付を表示
  const today = new Date();
  const todayStr = today.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });
  const todayDateEl = document.getElementById('daily-report-today-date');
  if (todayDateEl) {
    todayDateEl.textContent = todayStr;
    todayDateEl.dataset.date = today.toISOString().split('T')[0];
  }

  // 今日の日報を読み込む
  loadTodayDailyReport();

  // イベントリスナーを設定
  setupDailyReportListeners();
}

// 今日の日報を読み込む
async function loadTodayDailyReport() {
  if (!currentUser) return;
  if (!document.getElementById('daily-report-content')) return;

  const today = new Date().toISOString().split('T')[0];
  const storageKey = `daily_report_${currentUser.id}_${today}`;
  const listStorageKey = `daily_reports_${currentUser.id}`;

  try {
    // まずAPIから読み込む
    try {
      const idToken = await requireAuthOrRedirect('日報の読み込み');
      if (!idToken) return;
      const headers = {};
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      const response = await fetch(`${API_BASE}/daily-reports?staff_id=${encodeURIComponent(currentUser.id)}&date=${today}`, {
        method: 'GET',
        headers: headers,
        mode: 'cors' // CORSモードを明示的に指定
      }).catch(err => {
        // CORSエラーやネットワークエラーの場合はnullを返してローカルストレージから読み込む
        if (err.name === 'TypeError' && (err.message.includes('Failed to fetch') || err.message.includes('CORS'))) {
          return null;
        }
        throw err;
      });

      if (response && response.ok) {
        const data = await response.json();
        if (data.content !== undefined) {
          // APIから取得したデータを表示（ユーザー要望によりデフォルトはクリア状態に）
          const textarea = document.getElementById('daily-report-content');
          if (textarea) {
            // textarea.value = data.content || '';
            // const clearBtn = document.getElementById('daily-report-clear-btn');
            // if (clearBtn && textarea.value.trim()) {
            //   clearBtn.style.display = 'inline-flex';
            // }
          }
          // APIから取得したデータをlocalStorageにも保存
          localStorage.setItem(storageKey, JSON.stringify(data));
          upsertDailyReportList(listStorageKey, {
            id: `report_${currentUser.id}_${today}`,
            staff_id: currentUser.id,
            date: today,
            work_content: data.content || '',
            achievements: data.achievements || '',
            issues: data.issues || '',
            tomorrow: data.tomorrow || '',
            notes: data.notes || '',
            created_at: data.created_at || new Date().toISOString(),
            updated_at: data.updated_at || new Date().toISOString()
          });
          return;
        }
      } else if (response && response.status === 401) {
        handleAuthError('日報の読み込み');
        return;
      }
    } catch (apiError) {
      // CORSエラーやネットワークエラーの場合は静かに処理（ローカルストレージから読み込む）
      if (apiError.name === 'TypeError' && apiError.message.includes('Failed to fetch')) {
        // CORSエラーやネットワークエラーの場合は警告を出さない
        console.debug('日報のAPI読み込みに失敗（CORS/ネットワークエラーの可能性）、ローカルストレージから読み込みます');
      } else {
        console.warn('日報のAPI読み込みに失敗、ローカルストレージから読み込みます:', apiError);
      }
    }

    // APIから読み込めない場合はローカルストレージから読み込む
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const data = JSON.parse(saved);
      const textarea = document.getElementById('daily-report-content');
      if (textarea) {
        // textarea.value = data.content || '';
        // const clearBtn = document.getElementById('daily-report-clear-btn');
        // if (clearBtn && textarea.value.trim()) {
        //   clearBtn.style.display = 'inline-flex';
        // }
      }
      upsertDailyReportList(listStorageKey, {
        id: data.id || `report_${currentUser.id}_${today}`,
        staff_id: currentUser.id,
        date: today,
        work_content: data.content || '',
        achievements: data.achievements || '',
        issues: data.issues || '',
        tomorrow: data.tomorrow || '',
        notes: data.notes || '',
        created_at: data.created_at || new Date().toISOString(),
        updated_at: data.updated_at || new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error loading today daily report:', error);
  }
}

function upsertDailyReportList(listStorageKey, entry) {
  let list = [];
  try {
    list = JSON.parse(localStorage.getItem(listStorageKey)) || [];
  } catch (error) {
    list = [];
  }

  const existingIndex = list.findIndex((report) => report.date === entry.date);
  if (existingIndex >= 0) {
    const existing = list[existingIndex];
    list[existingIndex] = {
      ...existing,
      ...entry,
      created_at: existing.created_at || entry.created_at
    };
  } else {
    list.push(entry);
  }

  try {
    localStorage.setItem(listStorageKey, JSON.stringify(list));
  } catch (error) {
    console.error('Error saving daily report list:', error);
  }
}

// 日報のイベントリスナーを設定
// デジタル時計機能
let clockFormat24 = true; // true: 24時間表示, false: 12時間表示
let alarmTime = null;
let alarmEnabled = false;

function setupDigitalClock() {
  const clockDisplay = document.getElementById('digital-clock-display');
  const formatToggle = document.getElementById('clock-format-toggle');
  const alarmSetBtn = document.getElementById('alarm-set-btn');
  const alarmToggleBtn = document.getElementById('alarm-toggle-btn');
  const alarmSection = document.getElementById('digital-clock-alarm-section');
  const alarmTimeDisplay = document.getElementById('alarm-time-display');

  if (!clockDisplay) return;

  // 表示形式の読み込み
  const savedFormat = localStorage.getItem('digital-clock-format');
  if (savedFormat === '12') {
    clockFormat24 = false;
  }

  // アラーム設定の読み込み
  const savedAlarm = localStorage.getItem('digital-clock-alarm');
  if (savedAlarm) {
    try {
      const alarmData = JSON.parse(savedAlarm);
      alarmTime = alarmData.time;
      alarmEnabled = alarmData.enabled;
      if (alarmTime) {
        alarmTimeDisplay.textContent = alarmTime;
        alarmSection.style.display = 'flex';
        if (alarmEnabled) {
          alarmToggleBtn.innerHTML = '<i class="fas fa-bell"></i>';
        }
      }
    } catch (e) {
      console.warn('Failed to load alarm settings:', e);
    }
  }

  // 時計の更新
  function updateClock() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    let ampm = '';

    if (!clockFormat24) {
      ampm = hours >= 12 ? ' PM' : ' AM';
      hours = hours % 12 || 12;
    }

    const hoursStr = String(hours).padStart(2, '0');
    clockDisplay.textContent = `${hoursStr}:${minutes}:${seconds}${ampm}`;

    // アラームチェック
    if (alarmEnabled && alarmTime) {
      const currentTime = `${hoursStr}:${minutes}`;
      if (currentTime === alarmTime && seconds === '00') {
        triggerAlarm();
      }
    }
  }

  // アラーム発動
  function triggerAlarm() {
    // ブラウザの通知APIを使用
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('アラーム', {
        body: `設定時刻 ${alarmTime} になりました`,
        icon: '/images/logo_144x144.png'
      });
    }

    // 音声で通知（オプション）
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURAJR6Ph8sBlIAUwgM/z1oY5CBxsvO3mnlEQDE+n4vG2YxwGOJLX8sx5LAUkd8fw3ZBACxRetOnrqFUUCkaf4PK+bCEFMYfR89OCMwYebsDv45lREAlHo+HywGUgBTCAz/PWhjkIHGy87eaeURAMT6fi8bZjHAY4ktfy');
      audio.play().catch(() => { });
    } catch (e) {
      // 音声再生に失敗しても続行
    }
  }

  // 表示形式の切り替え
  if (formatToggle) {
    formatToggle.addEventListener('click', () => {
      clockFormat24 = !clockFormat24;
      localStorage.setItem('digital-clock-format', clockFormat24 ? '24' : '12');
      updateClock();
    });
  }

  // アラーム設定ボタン
  if (alarmSetBtn) {
    alarmSetBtn.addEventListener('click', () => {
      const timeInput = prompt('アラーム時刻を入力してください（例: 09:00）:');
      if (timeInput && /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeInput)) {
        alarmTime = timeInput;
        alarmEnabled = true;
        alarmTimeDisplay.textContent = alarmTime;
        alarmSection.style.display = 'flex';
        alarmToggleBtn.innerHTML = '<i class="fas fa-bell"></i>';
        saveAlarmSettings();
      } else if (timeInput) {
        alert('正しい時刻形式で入力してください（例: 09:00）');
      }
    });
  }

  // アラームON/OFF切り替え
  if (alarmToggleBtn) {
    alarmToggleBtn.addEventListener('click', () => {
      alarmEnabled = !alarmEnabled;
      if (alarmEnabled) {
        alarmToggleBtn.innerHTML = '<i class="fas fa-bell"></i>';
      } else {
        alarmToggleBtn.innerHTML = '<i class="fas fa-bell-slash"></i>';
      }
      saveAlarmSettings();
    });
  }

  // アラーム設定の保存
  function saveAlarmSettings() {
    localStorage.setItem('digital-clock-alarm', JSON.stringify({
      time: alarmTime,
      enabled: alarmEnabled
    }));
  }

  // 通知の許可をリクエスト
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  // 1秒ごとに時計を更新
  updateClock();
  setInterval(updateClock, 1000);
}

function setupDailyReportListeners() {
  const saveBtn = document.getElementById('daily-report-save-btn');
  const clearBtn = document.getElementById('daily-report-clear-btn');
  const textarea = document.getElementById('daily-report-content');
  const templateBtn = document.getElementById('daily-report-template-btn');

  if (!saveBtn && !clearBtn && !textarea && !templateBtn) return;

  if (saveBtn) {
    saveBtn.addEventListener('click', saveDailyReport);
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', clearDailyReport);
  }

  if (templateBtn) {
    templateBtn.addEventListener('click', insertDailyReportTemplate);
  }

  if (textarea) {
    textarea.addEventListener('input', () => {
      // 入力がある場合はクリアボタンを表示
      if (clearBtn) {
        clearBtn.style.display = textarea.value.trim() ? 'inline-flex' : 'none';
      }
    });
  }
}

function insertDailyReportTemplate() {
  const textarea = document.getElementById('daily-report-content');
  if (!textarea) return;

  const template = [
    '1：本日の作業内容',
    '2：明日の作業予定',
    '3：コメント'
  ].join('\n');

  if (!textarea.value.trim()) {
    textarea.value = template;
    textarea.dispatchEvent(new Event('input'));
    textarea.focus();
    return;
  }

  const needsNewline = !textarea.value.endsWith('\n');
  textarea.value = `${textarea.value}${needsNewline ? '\n' : ''}\n${template}`;
  textarea.dispatchEvent(new Event('input'));
  textarea.focus();
}

// 日報を保存
async function saveDailyReport() {
  if (!currentUser) return;

  const textarea = document.getElementById('daily-report-content');
  const todayDateEl = document.getElementById('daily-report-today-date');

  if (!textarea) return;

  const content = textarea.value.trim();
  const date = todayDateEl?.dataset.date || new Date().toISOString().split('T')[0];
  const storageKey = `daily_report_${currentUser.id}_${date}`;
  const listStorageKey = `daily_reports_${currentUser.id}`;

  const data = {
    content: content,
    work_content: content, // Backend requires this field
    achievements: '',
    issues: '',
    tomorrow: '',
    notes: '',
    staff_id: currentUser.id,
    staff_name: currentUser.name,
    date: date
  };

  try {
    // localStorageに保存（オフライン対応）
    const localData = {
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    localStorage.setItem(storageKey, JSON.stringify(localData));
    upsertDailyReportList(listStorageKey, {
      id: `report_${currentUser.id}_${date}`,
      staff_id: currentUser.id,
      date: date,
      work_content: content,
      achievements: '',
      issues: '',
      tomorrow: '',
      notes: '',
      created_at: localData.created_at,
      updated_at: localData.updated_at
    });

    // APIに保存
    try {
      const idToken = await requireAuthOrRedirect('日報の保存');
      if (!idToken) return;
      const headers = {
        'Content-Type': 'application/json'
      };
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      const response = await fetch(`${API_BASE}/daily-reports`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(data)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('日報をAPIに保存しました:', result);
        showSuccessMessage('日報を保存しました');
      } else {
        if (response.status === 401) {
          handleAuthError('日報の保存');
          return;
        }
        const errorData = await response.json().catch(() => ({}));
        console.error('日報のAPI保存に失敗:', errorData);
        // API保存に失敗してもローカル保存は成功しているので、警告のみ
        showSuccessMessage('日報をローカルに保存しました（API保存に失敗）');
      }
    } catch (apiError) {
      console.error('日報のAPI保存エラー:', apiError);
      // API保存に失敗してもローカル保存は成功しているので、警告のみ
      showSuccessMessage('日報をローカルに保存しました（API保存に失敗）');
    }

    // 保存完了後、入力内容をクリア
    textarea.value = '';
    const clearBtn = document.getElementById('daily-report-clear-btn');
    if (clearBtn) {
      clearBtn.style.display = 'none';
    }
  } catch (error) {
    console.error('Error saving daily report:', error);
    showErrorMessage('日報の保存に失敗しました');
  }
}

// 日報をクリア
function clearDailyReport() {
  const textarea = document.getElementById('daily-report-content');
  const todayDateEl = document.getElementById('daily-report-today-date');
  const clearBtn = document.getElementById('daily-report-clear-btn');

  if (!textarea) return;

  if (confirm('入力内容をクリアしますか？')) {
    textarea.value = '';
    if (clearBtn) {
      clearBtn.style.display = 'none';
    }

    // 今日の日付に戻す
    const today = new Date();
    const todayStr = today.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    });
    if (todayDateEl) {
      todayDateEl.textContent = todayStr;
      delete todayDateEl.dataset.date;
    }
  }
}

// JWTトークンの有効期限をチェック
function isTokenExpired(token) {
  if (!token || token === 'mock-token' || token === 'dev-token') return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1]));
    const exp = payload.exp * 1000; // ミリ秒に変換
    const now = Date.now();
    // 5分前を期限切れとみなす（バッファ）
    return now >= (exp - 5 * 60 * 1000);
  } catch (e) {
    console.warn('Error parsing token:', e);
    return true;
  }
}

// Cognitoトークンをリフレッシュ
async function refreshCognitoToken() {
  try {
    // Cognito User Poolから現在のユーザーを取得
    if (typeof AmazonCognitoIdentity === 'undefined') {
      console.warn('Amazon Cognito Identity JS not loaded');
      return null;
    }

    const config = window.CognitoConfig || {};
    if (!config.userPoolId || !config.clientId) {
      console.warn('Cognito config not found');
      return null;
    }

    const poolData = {
      UserPoolId: config.userPoolId,
      ClientId: config.clientId
    };
    const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
    const cognitoUser = userPool.getCurrentUser();

    if (!cognitoUser) {
      console.warn('No current Cognito user found');
      return null;
    }

    return new Promise((resolve) => {
      cognitoUser.getSession((err, session) => {
        if (err) {
          console.warn('Error getting session:', err);
          // エラーが発生した場合でも、リフレッシュを試みる
          const refreshToken = localStorage.getItem('cognito_refresh_token');
          if (refreshToken) {
            const refreshTokenObj = new AmazonCognitoIdentity.CognitoRefreshToken({ RefreshToken: refreshToken });
            cognitoUser.refreshSession(refreshTokenObj, (refreshErr, newSession) => {
              if (refreshErr) {
                console.warn('Error refreshing session:', refreshErr);
                resolve(null);
                return;
              }

              const idToken = newSession.getIdToken().getJwtToken();
              const accessToken = newSession.getAccessToken().getJwtToken();

              // トークンを更新
              localStorage.setItem('cognito_id_token', idToken);
              localStorage.setItem('cognito_access_token', accessToken);

              resolve(idToken);
            });
          } else {
            resolve(null);
          }
          return;
        }

        if (session.isValid()) {
          const idToken = session.getIdToken().getJwtToken();
          const accessToken = session.getAccessToken().getJwtToken();

          // トークンを更新
          localStorage.setItem('cognito_id_token', idToken);
          localStorage.setItem('cognito_access_token', accessToken);

          resolve(idToken);
        } else {
          // セッションが無効な場合はリフレッシュ
          const refreshTokenObj = session.getRefreshToken();
          cognitoUser.refreshSession(refreshTokenObj, (refreshErr, newSession) => {
            if (refreshErr) {
              console.warn('Error refreshing session:', refreshErr);
              resolve(null);
              return;
            }

            const idToken = newSession.getIdToken().getJwtToken();
            const accessToken = newSession.getAccessToken().getJwtToken();

            // トークンを更新
            localStorage.setItem('cognito_id_token', idToken);
            localStorage.setItem('cognito_access_token', accessToken);

            resolve(idToken);
          });
        }
      });
    });
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
}

// Cognito ID Token取得（従業員認証用）
// トークンの有効期限をチェック
function isTokenExpired(token) {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000;
    return Date.now() >= exp;
  } catch (e) {
    return true;
  }
}

// Cognitoトークンをリフレッシュ
async function refreshCognitoToken() {
  if (typeof AmazonCognitoIdentity === 'undefined') return null;

  try {
    const config = window.CognitoConfig || {};
    if (!config.userPoolId || !config.clientId) return null;

    const poolData = {
      UserPoolId: config.userPoolId,
      ClientId: config.clientId
    };
    const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
    const cognitoUser = userPool.getCurrentUser();

    if (!cognitoUser) return null;

    return new Promise((resolve) => {
      cognitoUser.getSession((err, session) => {
        if (err || !session || !session.isValid()) {
          resolve(null);
          return;
        }

        // セッションが有効なら新しいトークンを取得
        const newToken = session.getIdToken().getJwtToken();
        localStorage.setItem('cognito_id_token', newToken);
        resolve(newToken);
      });
    });
  } catch (e) {
    console.warn('Error refreshing token:', e);
    return null;
  }
}

async function getCognitoIdToken() {
  try {
    // 1. localStorageから直接取得
    let cognitoIdToken = localStorage.getItem('cognito_id_token');

    // トークンが期限切れの場合はリフレッシュを試みる
    if (cognitoIdToken && isTokenExpired(cognitoIdToken)) {
      console.log('Token expired, attempting to refresh...');
      const refreshedToken = await refreshCognitoToken();
      if (refreshedToken) {
        cognitoIdToken = refreshedToken;
      } else {
        console.warn('Failed to refresh token, token may be invalid');
      }
    }

    if (cognitoIdToken && !isTokenExpired(cognitoIdToken)) {
      return cognitoIdToken;
    }

    // 2. Cognito User Poolから直接セッションを取得
    if (typeof AmazonCognitoIdentity !== 'undefined') {
      try {
        const config = window.CognitoConfig || {};
        if (config.userPoolId && config.clientId) {
          const poolData = {
            UserPoolId: config.userPoolId,
            ClientId: config.clientId
          };
          const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
          const cognitoUser = userPool.getCurrentUser();

          if (cognitoUser) {
            const sessionToken = await new Promise((resolve) => {
              cognitoUser.getSession((err, session) => {
                if (!err && session && session.isValid()) {
                  const token = session.getIdToken().getJwtToken();
                  if (!isTokenExpired(token)) {
                    // トークンを更新
                    localStorage.setItem('cognito_id_token', token);
                    resolve(token);
                    return;
                  }
                }
                resolve(null);
              });
            });
            if (sessionToken) {
              return sessionToken;
            }
          }
        }
      } catch (e) {
        console.warn('Error getting token from Cognito User Pool:', e);
      }
    }

    // 3. CognitoAuthから取得
    if (window.CognitoAuth && window.CognitoAuth.isAuthenticated && window.CognitoAuth.isAuthenticated()) {
      try {
        const cognitoUser = await window.CognitoAuth.getCurrentUser();
        if (cognitoUser && cognitoUser.tokens && cognitoUser.tokens.idToken) {
          const token = cognitoUser.tokens.idToken;
          if (!isTokenExpired(token)) {
            return token;
          }
        }
      } catch (e) {
        console.warn('Error getting token from CognitoAuth:', e);
      }
    }

    // 4. cognito_userから取得
    const cognitoUser = localStorage.getItem('cognito_user');
    if (cognitoUser) {
      try {
        const parsed = JSON.parse(cognitoUser);
        if (parsed.tokens && parsed.tokens.idToken) {
          const token = parsed.tokens.idToken;
          if (!isTokenExpired(token)) {
            return token;
          }
        }
        if (parsed.idToken) {
          const token = parsed.idToken;
          if (!isTokenExpired(token)) {
            return token;
          }
        }
      } catch (e) {
        console.warn('Error parsing cognito user:', e);
      }
    }

    // 4. misesapo_authから取得
    const authData = localStorage.getItem('misesapo_auth');
    if (authData) {
      try {
        const parsed = JSON.parse(authData);
        if (parsed.token) {
          const token = parsed.token;
          if (!isTokenExpired(token)) {
            return token;
          }
        }
      } catch (e) {
        console.warn('Error parsing auth data:', e);
      }
    }

    console.warn('No valid authentication token found');
    return null;
  } catch (error) {
    console.error('Error getting Cognito ID token:', error);
    return null;
  }
}


// カレンダーを表示
function renderCalendar() {
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();

  const titleEl = document.getElementById('calendar-title');
  const grid = document.getElementById('calendar-grid');
  if (!titleEl || !grid) return;
  titleEl.textContent = `${year} ${month + 1}`;

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - startDate.getDay());

  grid.innerHTML = '';

  // 曜日ヘッダー
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  dayNames.forEach(day => {
    const cell = document.createElement('div');
    cell.className = 'calendar-cell calendar-day-name';
    cell.textContent = day;
    grid.appendChild(cell);
  });

  // 日付セル
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < 42; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    const cell = document.createElement('div');
    cell.className = 'calendar-cell calendar-date';

    if (date.getMonth() !== month) {
      cell.classList.add('disabled');
    } else {
      if (date.getTime() === today.getTime()) {
        cell.classList.add('today');
      }

      // 出勤記録があるかチェック（clock_inがある日を出勤日とする）
      if (currentUser && attendanceRecords[dateStr]?.[currentUser.id]) {
        const record = attendanceRecords[dateStr][currentUser.id];
        if (record.clock_in) {
          cell.classList.add('has-attendance');
        }
      }
    }

    cell.textContent = date.getDate();
    grid.appendChild(cell);
  }
}

// カレンダーナビゲーション（DOMContentLoaded内で設定）

// 修正申請ボタンの設定
function setupCorrectionRequestButton() {
  const btn = document.getElementById('request-correction-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      openCorrectionRequestModal();
    });
  }
}

// 修正申請モーダルを開く
function openCorrectionRequestModal() {
  if (!currentUser) return;

  const today = new Date().toISOString().split('T')[0];
  const todayRecord = attendanceRecords[today]?.[currentUser.id] || {};

  // モーダルHTMLを作成
  const modalHTML = `
    <div id="correction-request-modal" style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    ">
      <div style="
        background: white;
        border-radius: 8px;
        padding: 24px;
        max-width: 600px;
        width: 90%;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      ">
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        ">
          <h2 style="margin: 0; font-size: 1.5rem; font-weight: 600;">打刻修正を申請</h2>
          <button id="close-correction-modal" style="
            background: none;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            color: #6b7280;
            padding: 0;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
          ">×</button>
        </div>
        
        <form id="correction-request-form">
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500;">修正する日付</label>
            <input type="date" id="correction-date" value="${today}" required style="
              width: 100%;
              padding: 8px 12px;
              border: 1px solid #d1d5db;
              border-radius: 6px;
              font-size: 0.875rem;
            ">
          </div>
          
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500;">現在の出勤時刻</label>
            <input type="datetime-local" id="current-clock-in" value="${todayRecord.clock_in ? new Date(todayRecord.clock_in).toISOString().slice(0, 16) : ''}" style="
              width: 100%;
              padding: 8px 12px;
              border: 1px solid #d1d5db;
              border-radius: 6px;
              font-size: 0.875rem;
            ">
          </div>
          
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500;">修正後の出勤時刻</label>
            <input type="datetime-local" id="requested-clock-in" required style="
              width: 100%;
              padding: 8px 12px;
              border: 1px solid #d1d5db;
              border-radius: 6px;
              font-size: 0.875rem;
            ">
          </div>
          
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500;">現在の退勤時刻</label>
            <input type="datetime-local" id="current-clock-out" value="${todayRecord.clock_out ? new Date(todayRecord.clock_out).toISOString().slice(0, 16) : ''}" style="
              width: 100%;
              padding: 8px 12px;
              border: 1px solid #d1d5db;
              border-radius: 6px;
              font-size: 0.875rem;
            ">
          </div>
          
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500;">修正後の退勤時刻</label>
            <input type="datetime-local" id="requested-clock-out" style="
              width: 100%;
              padding: 8px 12px;
              border: 1px solid #d1d5db;
              border-radius: 6px;
              font-size: 0.875rem;
            ">
          </div>
          
          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500;">修正理由 <span style="color: #dc2626;">*</span></label>
            <textarea id="correction-reason" required placeholder="修正理由を入力してください" style="
              width: 100%;
              padding: 8px 12px;
              border: 1px solid #d1d5db;
              border-radius: 6px;
              font-size: 0.875rem;
              min-height: 100px;
              resize: vertical;
              font-family: inherit;
            "></textarea>
          </div>
          
          <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button type="button" id="cancel-correction-btn" style="
              padding: 8px 16px;
              border: 1px solid #d1d5db;
              border-radius: 4px;
              background: white;
              color: #374151;
              cursor: pointer;
              font-size: 0.875rem;
            ">キャンセル</button>
            <button type="submit" style="
              padding: 8px 16px;
              border: none;
              border-radius: 4px;
              background: var(--primary, #3b82f6);
              color: white;
              cursor: pointer;
              font-size: 0.875rem;
              font-weight: 500;
            ">申請する</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);

  const modal = document.getElementById('correction-request-modal');
  const form = document.getElementById('correction-request-form');
  const closeBtn = document.getElementById('close-correction-modal');
  const cancelBtn = document.getElementById('cancel-correction-btn');

  // 閉じるボタン
  closeBtn.addEventListener('click', () => modal.remove());
  cancelBtn.addEventListener('click', () => modal.remove());

  // 背景クリックで閉じる
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  // フォーム送信
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await submitCorrectionRequest();
  });
}

// 修正申請を送信
async function submitCorrectionRequest() {
  if (!currentUser) return;

  const date = document.getElementById('correction-date').value;
  const currentClockIn = document.getElementById('current-clock-in').value;
  const requestedClockIn = document.getElementById('requested-clock-in').value;
  const currentClockOut = document.getElementById('current-clock-out').value;
  const requestedClockOut = document.getElementById('requested-clock-out').value;
  const reason = document.getElementById('correction-reason').value.trim();

  if (!reason) {
    alert('修正理由を入力してください');
    return;
  }

  // 日付からattendance_idを生成
  const attendance_id = `${date}_${currentUser.id}`;

  // 時刻をISO形式に変換
  const formatDateTime = (dateTimeStr) => {
    if (!dateTimeStr) return null;
    return new Date(dateTimeStr).toISOString();
  };

  const requestData = {
    staff_id: currentUser.id,
    staff_name: currentUser.name,
    attendance_id: attendance_id,
    date: date,
    reason: reason,
    current_clock_in: formatDateTime(currentClockIn),
    current_clock_out: formatDateTime(currentClockOut),
    requested_clock_in: formatDateTime(requestedClockIn),
    requested_clock_out: formatDateTime(requestedClockOut)
  };

  try {
    const response = await fetch(`${API_BASE}/attendance/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData)
    });

    if (response.ok) {
      const result = await response.json();
      showSuccessMessage('修正申請を送信しました');
      document.getElementById('correction-request-modal').remove();
    } else {
      const errorData = await response.json().catch(() => ({}));
      showErrorMessage(errorData.error || '修正申請の送信に失敗しました');
    }
  } catch (error) {
    console.error('Error submitting correction request:', error);
    showErrorMessage('修正申請の送信に失敗しました');
  }
}

// 数値を丸める
function round(value, decimals) {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

// ==================== TODOリスト機能 ====================
const TODO_STORAGE_KEY = 'staff_todos';
let todos = [];
let todoFilter = 'all';

async function loadTodos() {
  try {
    const userId = currentUser?.id || 'default';

    // まずAPIから読み込む
    try {
      const idToken = await getCognitoIdToken();
      const headers = {};
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      const response = await fetch(`${API_BASE}/todos?staff_id=${encodeURIComponent(userId)}`, {
        method: 'GET',
        headers: headers,
        mode: 'cors' // CORSモードを明示的に指定
      }).catch(err => {
        // CORSエラーやネットワークエラーの場合はnullを返してローカルストレージから読み込む
        if (err.name === 'TypeError' && (err.message.includes('Failed to fetch') || err.message.includes('CORS'))) {
          return null;
        }
        throw err;
      });

      if (response && response.ok) {
        const result = await response.json();
        if (result.todos && Array.isArray(result.todos)) {
          todos = result.todos;
          // APIから取得したデータをlocalStorageにも保存
          localStorage.setItem(`${TODO_STORAGE_KEY}_${userId}`, JSON.stringify(todos));
          renderTodos();
          return;
        }
      }
    } catch (apiError) {
      // CORSエラーやネットワークエラーの場合は静かに処理（ローカルストレージから読み込む）
      if (apiError.name === 'TypeError' && apiError.message.includes('Failed to fetch')) {
        // CORSエラーやネットワークエラーの場合は警告を出さない
        console.debug('TODOのAPI読み込みに失敗（CORS/ネットワークエラーの可能性）、ローカルストレージから読み込みます');
      } else {
        console.warn('TODOのAPI読み込みに失敗、ローカルストレージから読み込みます:', apiError);
      }
    }

    // APIから読み込めない場合はローカルストレージから読み込む
    const stored = localStorage.getItem(`${TODO_STORAGE_KEY}_${userId}`);
    if (stored) {
      todos = JSON.parse(stored);
    } else {
      todos = [];
    }
  } catch (error) {
    console.error('Error loading todos:', error);
    todos = [];
  }
  renderTodos();
}

function saveTodos() {
  try {
    const userId = currentUser?.id || 'default';
    localStorage.setItem(`${TODO_STORAGE_KEY}_${userId}`, JSON.stringify(todos));
  } catch (error) {
    console.error('Error saving todos:', error);
  }
}

// TODOをAPIにアップロード
async function uploadTodoToAPI(todo, method = 'POST') {
  if (!currentUser) return null;

  try {
    const idToken = await getCognitoIdToken();
    const headers = {
      'Content-Type': 'application/json'
    };
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    const url = method === 'POST'
      ? `${API_BASE}/todos`
      : `${API_BASE}/todos/${todo.id}`;

    const data = {
      staff_id: currentUser.id,
      text: todo.text,
      completed: todo.completed
    };

    const response = await fetch(url, {
      method: method === 'POST' ? 'POST' : 'PUT',
      headers: headers,
      body: JSON.stringify(data)
    });

    if (response.ok) {
      const result = await response.json();
      // APIから返されたIDを使用（新規作成の場合）
      if (result.data && result.data.id) {
        return result.data.id;
      }
      return todo.id;
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.error('TODOのAPI保存に失敗:', errorData);
      return null;
    }
  } catch (error) {
    console.error('TODOのAPI保存エラー:', error);
    return null;
  }
}

// TODOをAPIから削除
async function deleteTodoFromAPI(todoId) {
  if (!currentUser) return false;

  try {
    const idToken = await getCognitoIdToken();
    const headers = {};
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    const response = await fetch(`${API_BASE}/todos/${todoId}`, {
      method: 'DELETE',
      headers: headers
    });

    if (response.ok) {
      return true;
    } else {
      console.error('TODOのAPI削除に失敗');
      return false;
    }
  } catch (error) {
    console.error('TODOのAPI削除エラー:', error);
    return false;
  }
}

async function addTodo(text) {
  if (!text.trim()) return;

  const todo = {
    id: `todo_${Date.now()}`,
    text: text.trim(),
    completed: false,
    created_at: new Date().toISOString()
  };

  todos.unshift(todo);
  saveTodos();
  renderTodos();

  // APIにアップロード
  const apiId = await uploadTodoToAPI(todo, 'POST');
  if (apiId && apiId !== todo.id) {
    // APIから返されたIDに更新
    todo.id = apiId;
    saveTodos();
  }
}

async function toggleTodo(id) {
  const todo = todos.find(t => t.id === id);
  if (todo) {
    todo.completed = !todo.completed;
    saveTodos();
    renderTodos();

    // APIにアップロード
    await uploadTodoToAPI(todo, 'PUT');
  }
}

async function deleteTodo(id) {
  const todo = todos.find(t => t.id === id);
  if (todo) {
    // APIから削除
    await deleteTodoFromAPI(id);

    todos = todos.filter(t => t.id !== id);
    saveTodos();
    renderTodos();
  }
}

async function updateTodoText(id, newText) {
  const todo = todos.find(t => t.id === id);
  if (todo && newText.trim()) {
    todo.text = newText.trim();
    saveTodos();

    // APIにアップロード
    await uploadTodoToAPI(todo, 'PUT');
  }
}

function renderTodos() {
  const listEl = document.getElementById('todo-list');
  const countEl = document.getElementById('todo-count');

  if (!listEl || !countEl) return;

  // フィルタリング
  let filteredTodos = todos;
  if (todoFilter === 'active') {
    filteredTodos = todos.filter(t => !t.completed);
  } else if (todoFilter === 'completed') {
    filteredTodos = todos.filter(t => t.completed);
  }

  // 未完了カウントを更新
  const activeCount = todos.filter(t => !t.completed).length;
  countEl.textContent = activeCount;

  if (filteredTodos.length === 0) {
    const message = todoFilter === 'all' ? 'タスクがありません' :
      todoFilter === 'active' ? '未完了のタスクはありません' :
        '完了したタスクはありません';
    listEl.innerHTML = `<div class="todo-empty"><i class="fas fa-check-circle"></i> ${message}</div>`;
    return;
  }

  let html = '';
  filteredTodos.forEach(todo => {
    html += `
      <div class="todo-item ${todo.completed ? 'completed' : ''}" data-id="${todo.id}">
        <div class="todo-checkbox" onclick="window.toggleTodo('${todo.id}')">
          ${todo.completed ? '<i class="fas fa-check"></i>' : ''}
        </div>
        <input type="text" class="todo-text-input" value="${escapeHtml(todo.text)}" 
               onblur="window.updateTodoText('${todo.id}', this.value)"
               onkeypress="if(event.key==='Enter') this.blur()">
        <button class="todo-delete" onclick="window.deleteTodo('${todo.id}')">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
  });

  listEl.innerHTML = html;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function setupTodoListeners() {
  const input = document.getElementById('todo-input');
  const addBtn = document.getElementById('add-todo-btn');
  const filters = document.getElementById('todo-filters');

  if (input && addBtn) {
    addBtn.addEventListener('click', () => {
      addTodo(input.value);
      input.value = '';
      input.focus();
    });

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        addTodo(input.value);
        input.value = '';
      }
    });
  }

  if (filters) {
    filters.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        todoFilter = btn.dataset.filter;
        filters.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderTodos();
      });
    });
  }

  // TODOリストの時計表示/非表示ボタン
  const clockToggleBtn = document.getElementById('todo-clock-toggle-btn');
  if (clockToggleBtn) {
    clockToggleBtn.addEventListener('click', () => {
      const clockSection = document.getElementById('todo-clock-section');
      const toggleText = document.getElementById('todo-clock-toggle-text');
      if (clockSection) {
        const isVisible = clockSection.style.display !== 'none';
        clockSection.style.display = isVisible ? 'none' : 'block';
        if (toggleText) {
          toggleText.textContent = isVisible ? '時計を表示' : '時計を非表示';
        }
        // 表示状態をlocalStorageに保存
        localStorage.setItem('todo_clock_visible', !isVisible ? 'true' : 'false');
      }
    });

    // 保存された表示状態を復元
    const savedVisibility = localStorage.getItem('todo_clock_visible');
    if (savedVisibility === 'true') {
      const clockSection = document.getElementById('todo-clock-section');
      if (clockSection) {
        clockSection.style.display = 'block';
        const toggleText = document.getElementById('todo-clock-toggle-text');
        if (toggleText) {
          toggleText.textContent = '時計を非表示';
        }
      }
    }
  }
}

// TODOリストコンテナの時計を初期化
function initializeTodoClock() {
  const todoClockDisplay = document.getElementById('todo-clock-display');
  if (!todoClockDisplay) return;

  function updateTodoClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    todoClockDisplay.textContent = `${hours}:${minutes}:${seconds}`;
  }

  // 初回表示
  updateTodoClock();

  // 1秒ごとに更新
  setInterval(updateTodoClock, 1000);
}

// 今月の総案件数（スケジュール数）を読み込む
async function loadMonthlySchedulesCount() {
  try {
    const idToken = await getCognitoIdToken();
    const headers = {};
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    const response = await fetch(`${API_BASE}/schedules`, { headers });
    if (!response.ok) {
      throw new Error('Failed to load schedules');
    }

    const schedulesData = await response.json();
    const allSchedules = Array.isArray(schedulesData) ? schedulesData : (schedulesData.items || schedulesData.schedules || []);

    // 今月のスケジュール数をカウント
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const monthlySchedules = allSchedules.filter(schedule => {
      if (!schedule.scheduled_date && !schedule.date) return false;

      const scheduleDate = schedule.scheduled_date || schedule.date;
      const date = new Date(scheduleDate);

      return date.getFullYear() === currentYear && date.getMonth() === currentMonth;
    });

    // 表示を更新
    const countEl = document.getElementById('monthly-schedules-count');
    if (countEl) {
      countEl.textContent = monthlySchedules.length;
      const pageType = window.location.pathname.includes('/sales/mypage') ? 'Sales' : 'OS';
      console.log(`[${pageType} Mypage] Monthly schedules count:`, monthlySchedules.length);
    }
  } catch (error) {
    const pageType = window.location.pathname.includes('/sales/mypage') ? 'Sales' : 'OS';
    console.error(`[${pageType} Mypage] Failed to load monthly schedules count:`, error);
    const countEl = document.getElementById('monthly-schedules-count');
    if (countEl) {
      countEl.textContent = '0';
    }
  }
}

// ドラッグ&ドロップ機能は削除されました

// ドラッグ&ドロップ機能は削除されました

// 80x80px固定グリッドの列数・行数を計算（グリッドセルサイズは常に80px固定）
function getGridDimensions() {
  const grid = document.getElementById('mypage-grid');
  if (!grid) {
    return { cols: 10, rows: 6 }; // デフォルト値
  }

  // スマホの場合は1列（縦積み）
  if (window.innerWidth <= 599) {
    return { cols: 1, rows: 1 };
  }

  // グリッド要素の実際の幅を取得
  const gridWidth = grid.offsetWidth;
  const gridHeight = grid.offsetHeight;

  // 80px固定グリッドで列数を計算（画面幅が小さくなると使える列数が減るだけ）
  const CELL_SIZE = 80; // 固定80px
  const cols = Math.floor(gridWidth / CELL_SIZE);
  // 行数は画面の高さに応じて計算（最小6行、最大は画面高さに合わせて）
  const rows = Math.max(6, Math.floor(gridHeight / CELL_SIZE));

  return { cols, rows, cellSize: CELL_SIZE };
}

// グリッド線を描画（コンテナレベルで描画し、サイドバーの右端から画面右端まで80px間隔で等間隔に描画）
function drawGridLines() {
  const grid = document.getElementById('mypage-grid');
  const container = document.querySelector('.mypage-main-grid-container');
  if (!grid || !container) return;

  // 既存のグリッド線を削除（コンテナレベルで検索）
  const existingGrid = container.querySelector('.grid-lines-overlay');
  if (existingGrid) {
    existingGrid.remove();
  }

  // 現在の画面サイズに応じたグリッド数を取得
  const { cols, rows } = getGridDimensions();

  // スマホの場合はグリッド線を描画しない
  if (cols === 1) {
    return;
  }

  // グリッド線のオーバーレイを作成（コンテナレベルに配置）
  const overlay = document.createElement('div');
  overlay.className = 'grid-lines-overlay';
  overlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 0;
  `;

  // コンテナの実際のサイズを取得
  const containerWidth = container.offsetWidth;
  const containerHeight = container.offsetHeight;

  // 80px間隔で等間隔にグリッド線を描画
  const cellSize = 80; // 固定80px

  // SVGでグリッド線を描画（コンテナのサイズを基準に）
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.setAttribute('viewBox', `0 0 ${containerWidth} ${containerHeight}`);
  svg.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%;';

  // 縦線を描画（左端（0px）から右端まで80px間隔で）
  const maxCols = Math.ceil(containerWidth / cellSize) + 1;
  for (let i = 0; i <= maxCols; i++) {
    const x = i * cellSize;
    if (x <= containerWidth) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x);
      line.setAttribute('y1', 0);
      line.setAttribute('x2', x);
      line.setAttribute('y2', containerHeight);
      line.setAttribute('stroke', 'rgba(255, 192, 203, 0.8)');
      line.setAttribute('stroke-width', '1');
      line.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.appendChild(line);
    }
  }

  // 横線を描画（上端（0px）から下端まで80px間隔で）
  const maxRows = Math.ceil(containerHeight / cellSize) + 1;
  for (let i = 0; i <= maxRows; i++) {
    const y = i * cellSize;
    if (y <= containerHeight) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', 0);
      line.setAttribute('y1', y);
      line.setAttribute('x2', containerWidth);
      line.setAttribute('y2', y);
      line.setAttribute('stroke', 'rgba(255, 192, 203, 0.8)');
      line.setAttribute('stroke-width', '1');
      line.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.appendChild(line);
    }
  }

  overlay.appendChild(svg);
  container.appendChild(overlay);
}

// 編集モード機能は削除されました

// コンテナを絶対位置で配置（ピクセル単位で自由に配置）
function setAbsolutePosition(container, x, y) {
  if (!container) return;

  // data-container-widthとdata-container-heightを使用してサイズを計算
  const width = parseInt(container.dataset.containerWidth) || 3;
  const height = parseInt(container.dataset.containerHeight) || 3;
  const CELL_SIZE = 80; // 80px固定
  const containerWidth = width * CELL_SIZE;
  const containerHeight = height * CELL_SIZE;

  // 絶対位置とサイズを強制的に設定
  container.style.setProperty('left', `${x}px`, 'important');
  container.style.setProperty('top', `${y}px`, 'important');
  container.style.setProperty('width', `${containerWidth}px`, 'important');
  container.style.setProperty('height', `${containerHeight}px`, 'important');
  container.style.setProperty('max-width', 'none', 'important');
  container.style.setProperty('max-height', 'none', 'important');
  container.dataset.absolutePosition = `${x},${y}`;

  console.log(`[Layout] Set absolute position for ${container.dataset.containerId}: x=${x}, y=${y}, width=${containerWidth}, height=${containerHeight}`);
}

// 後方互換性のため、setGridPositionも残す（col, rowからピクセルに変換）
function setGridPosition(container, col, row) {
  if (!container) return;
  const CELL_SIZE = 80;
  const x = (col - 1) * CELL_SIZE;
  const y = (row - 1) * CELL_SIZE;
  setAbsolutePosition(container, x, y);
}

// 絶対位置を取得（data-absolute-positionから、またはstyleから）
function getAbsolutePosition(container) {
  // まずdata属性から取得を試みる
  const pos = container.dataset.absolutePosition;
  if (pos) {
    const [x, y] = pos.split(',').map(Number);
    // 異常な値をチェック
    if (isNaN(x) || isNaN(y) || !isFinite(x) || !isFinite(y) ||
      Math.abs(x) > 100000 || Math.abs(y) > 100000) {
      console.warn('[Layout] Invalid position in data attribute for container:', container.dataset.containerId, 'position:', pos);
      return null;
    }
    return { x, y };
  }
  // styleから取得
  const left = parseInt(container.style.left) || 0;
  const top = parseInt(container.style.top) || 0;
  // 異常な値をチェック
  if (isNaN(left) || isNaN(top) || !isFinite(left) || !isFinite(top) ||
    Math.abs(left) > 100000 || Math.abs(top) > 100000) {
    console.warn('[Layout] Invalid position in style for container:', container.dataset.containerId, 'left:', left, 'top:', top);
    return null;
  }
  if (left !== 0 || top !== 0) {
    return { x: left, y: top };
  }
  return null;
}

// 後方互換性のため、getGridPositionも残す（ピクセルからcol, rowに変換）
function getGridPosition(container) {
  const absPos = getAbsolutePosition(container);
  if (!absPos) return null;
  const CELL_SIZE = 80;
  const col = Math.floor(absPos.x / CELL_SIZE) + 1;
  const row = Math.floor(absPos.y / CELL_SIZE) + 1;
  return { col, row };
}

// コンテナの配置を保存（ピクセル単位）
function saveSectionLayout() {
  const grid = document.getElementById('mypage-grid');
  if (!grid) return;

  const containers = Array.from(grid.querySelectorAll('.draggable-container'));
  const gridWidth = grid.offsetWidth;
  const gridHeight = grid.offsetHeight;
  // グリッドアンカーを計算（保存前に位置をスナップするため）
  getGridAnchors(grid);

  const layout = containers.map(container => {
    const pos = getAbsolutePosition(container);
    // 位置データが有効かチェック
    if (pos && (isNaN(pos.x) || isNaN(pos.y) || !isFinite(pos.x) || !isFinite(pos.y) ||
      Math.abs(pos.x) > 100000 || Math.abs(pos.y) > 100000 ||
      pos.x < 0 || pos.y < 0 || pos.x >= gridWidth || pos.y >= gridHeight)) {
      console.warn('[Layout] Skipping invalid position when saving:', container.dataset.containerId, 'x:', pos.x, 'y:', pos.y);
      return {
        id: container.dataset.containerId,
        cost: parseInt(container.dataset.containerCost) || 1,
        position: null
      };
    }
    // 位置をアンカーにスナップしてから保存
    if (pos) {
      const snapped = findNearestAnchor(grid, pos.x, pos.y);
      // スナップされた位置が異なる場合は、コンテナの位置も更新
      if (snapped.x !== pos.x || snapped.y !== pos.y) {
        setAbsolutePosition(container, snapped.x, snapped.y);
      }
      return {
        id: container.dataset.containerId,
        cost: parseInt(container.dataset.containerCost) || 1,
        position: `${snapped.x},${snapped.y}`
      };
    }
    return {
      id: container.dataset.containerId,
      cost: parseInt(container.dataset.containerCost) || 1,
      position: null
    };
  });
  localStorage.setItem('mypage_section_layout', JSON.stringify(layout));
}

// コンテナの配置を復元
function restoreSectionLayout() {
  try {
    const grid = document.getElementById('mypage-grid');
    if (!grid) {
      // Bentoグリッドでは早期リターン（CSS Gridで配置が管理されるため）
      return;
    }

    // Bentoグリッドの場合は早期リターン（CSS Gridで配置が管理されるため）
    const bentoCards = grid.querySelectorAll('.bento-card');
    if (bentoCards.length > 0) {
      // Bentoグリッドでは配置はCSSで管理されるため、restoreSectionLayoutは不要
      return;
    }

    const savedLayout = localStorage.getItem('mypage_section_layout');
    if (!savedLayout) {
      // デフォルト配置を適用
      applyDefaultLayout();
      return;
    }

    const layout = JSON.parse(savedLayout);

    // コンテナが読み込まれるまで待つ（旧グリッドシステム用）
    const containers = grid.querySelectorAll('.draggable-container');
    if (containers.length === 0) {
      // Bentoグリッドの場合は早期リターン
      return;
    }

    // グリッドアンカーを計算（復元前に計算）
    getGridAnchors(grid);

    const gridWidth = grid.offsetWidth;
    const gridHeight = grid.offsetHeight;
    let hasInvalidPosition = false;

    layout.forEach(item => {
      const container = grid.querySelector(`[data-container-id="${item.id}"]`);
      if (container && item.position) {
        // 旧形式（col,row）と新形式（x,y）の両方に対応
        const parts = item.position.split(',').map(Number);
        if (parts.length === 2) {
          // 異常な値（NaN、無限大、極端に大きい/小さい値、負の値）をチェック
          if (isNaN(parts[0]) || isNaN(parts[1]) ||
            !isFinite(parts[0]) || !isFinite(parts[1]) ||
            Math.abs(parts[0]) > 100000 || Math.abs(parts[1]) > 100000 ||
            parts[0] < -1000 || parts[1] < -1000) {
            console.warn('[Layout] Invalid position data for container:', item.id, 'position:', item.position);
            hasInvalidPosition = true;
            // 異常な値の場合は位置をクリア
            container.style.removeProperty('left');
            container.style.removeProperty('top');
            container.dataset.absolutePosition = '';
            return;
          }

          // 数値が小さい場合は旧形式（col,row）、大きい場合は新形式（x,y）と判断
          if (parts[0] < 100 && parts[1] < 100) {
            // 旧形式: col, row
            setGridPosition(container, parts[0], parts[1]);
          } else {
            // 新形式: x, y
            // 位置が有効な範囲内かチェック
            if (parts[0] >= 0 && parts[1] >= 0 &&
              parts[0] < gridWidth && parts[1] < gridHeight) {
              // 位置をアンカーにスナップ
              const snapped = findNearestAnchor(grid, parts[0], parts[1]);
              setAbsolutePosition(container, snapped.x, snapped.y);
            } else {
              console.warn('[Layout] Position out of bounds for container:', item.id, 'x:', parts[0], 'y:', parts[1]);
              hasInvalidPosition = true;
              // 範囲外の場合は位置をクリア
              container.style.removeProperty('left');
              container.style.removeProperty('top');
              container.dataset.absolutePosition = '';
            }
          }
        }
      }
    });

    // 異常な位置データが見つかった場合、localStorageをクリアしてデフォルト配置を適用
    if (hasInvalidPosition) {
      console.warn('[Layout] Invalid position data detected, clearing localStorage and applying default layout');
      localStorage.removeItem('mypage_section_layout');
      applyDefaultLayout();
      return;
    }

    // 保存されていないコンテナ（新規追加など）にもサイズを設定
    const allContainers = Array.from(grid.querySelectorAll('.draggable-container'));
    allContainers.forEach(container => {
      // サイズが設定されていない場合のみ設定
      const width = parseInt(container.dataset.containerWidth) || 3;
      const height = parseInt(container.dataset.containerHeight) || 3;
      const CELL_SIZE = 80;
      const containerWidth = width * CELL_SIZE;
      const containerHeight = height * CELL_SIZE;

      // サイズを強制的に設定
      container.style.setProperty('width', `${containerWidth}px`, 'important');
      container.style.setProperty('height', `${containerHeight}px`, 'important');
      container.style.setProperty('max-width', 'none', 'important');
      container.style.setProperty('max-height', 'none', 'important');
      console.log('[Layout] Set size for container:', container.dataset.containerId, 'width:', containerWidth, 'height:', containerHeight);
    });

    console.log('Container layout restored');
  } catch (error) {
    console.warn('Failed to restore container layout:', error);
    applyDefaultLayout();
  }
}

// デフォルト配置を適用（絶対位置）
function applyDefaultLayout() {
  const grid = document.getElementById('mypage-grid');
  if (!grid) {
    console.warn('[Layout] Grid not found in applyDefaultLayout');
    return;
  }

  const CELL_SIZE = 80;
  // 各コンテナのデフォルト位置を設定（ピクセル単位、全て3×3マス）
  const defaultLayout = {
    'attendance': { x: 0, y: 0 },              // 出退勤記録: 3×3マス
    'announcements': { x: 0, y: 240 },         // 業務連絡: 3×3マス
    'daily-reports': { x: 240, y: 0 },         // 日報: 3×3マス
    'basic-info': { x: 240, y: 240 },          // 基本情報: 3×3マス
    'todo': { x: 480, y: 0 },                  // TODOリスト: 3×3マス
    'calendar': { x: 480, y: 240 },            // カレンダー: 3×3マス
    'weekly-schedule': { x: 720, y: 0 },       // 今週のスケジュール: 3×3マス
    'digital-clock': { x: 960, y: 0 }          // デジタル時計: 3×3マス
  };

  const containers = Array.from(grid.querySelectorAll('.draggable-container'));
  console.log('[Layout] Found containers:', containers.length);

  if (containers.length === 0) {
    console.warn('[Layout] No containers found, retrying...');
    setTimeout(applyDefaultLayout, 100);
    return;
  }

  // 各コンテナのサイズを設定
  containers.forEach(container => {
    const width = parseInt(container.dataset.containerWidth) || 3;
    const height = parseInt(container.dataset.containerHeight) || 3;
    const containerWidth = width * CELL_SIZE;
    const containerHeight = height * CELL_SIZE;

    // サイズを強制的に設定
    container.style.setProperty('width', `${containerWidth}px`, 'important');
    container.style.setProperty('height', `${containerHeight}px`, 'important');
    container.style.setProperty('max-width', 'none', 'important');
    container.style.setProperty('max-height', 'none', 'important');
  });

  // 自動整列アルゴリズムで配置
  autoAlignContainers(grid, containers);
}

// 自動整列アルゴリズム
// マスの左上から順番に右に配置、画面端まで行ったら左に戻って、すでに設置してあるコンテナの下に密着させて設置
function autoAlignContainers(grid, containers) {
  const CELL_SIZE = 80;
  const gridWidth = grid.offsetWidth;
  const gridHeight = grid.offsetHeight;

  // 配置済みのコンテナの矩形を記録
  const placedRects = [];

  // 各コンテナを順番に配置
  containers.forEach(container => {
    const width = parseInt(container.dataset.containerWidth) || 3;
    const height = parseInt(container.dataset.containerHeight) || 3;
    const containerWidth = width * CELL_SIZE;
    const containerHeight = height * CELL_SIZE;

    // 配置可能な位置を探す
    let placed = false;
    let currentY = 0;

    // 上から下へ、各行をチェック
    while (currentY + containerHeight <= gridHeight && !placed) {
      let currentX = 0;

      // 左から右へ、各列をチェック
      while (currentX + containerWidth <= gridWidth && !placed) {
        // この位置に配置できるかチェック
        const newRect = {
          left: currentX,
          top: currentY,
          right: currentX + containerWidth,
          bottom: currentY + containerHeight
        };

        // 既存のコンテナと重複していないかチェック
        let overlaps = false;
        for (const placedRect of placedRects) {
          if (newRect.left < placedRect.right &&
            newRect.right > placedRect.left &&
            newRect.top < placedRect.bottom &&
            newRect.bottom > placedRect.top) {
            overlaps = true;
            break;
          }
        }

        // 重複していない場合、この位置に配置
        if (!overlaps) {
          setAbsolutePosition(container, currentX, currentY);
          placedRects.push(newRect);
          placed = true;
          console.log('[Layout] Auto-aligned container:', container.dataset.containerId, 'at x:', currentX, 'y:', currentY);
        } else {
          // 重複している場合、次の位置を試す
          // 重複しているコンテナの右端までスキップ
          let skipX = currentX + CELL_SIZE;
          for (const placedRect of placedRects) {
            if (newRect.top < placedRect.bottom && newRect.bottom > placedRect.top) {
              // 同じ行にあるコンテナの右端までスキップ
              if (placedRect.right > skipX) {
                skipX = placedRect.right;
              }
            }
          }
          currentX = skipX;
        }
      }

      // この行で配置できなかった場合、次の行へ
      if (!placed) {
        // 次の行のY座標を計算（既存のコンテナの下に密着）
        let nextY = currentY + CELL_SIZE;
        for (const placedRect of placedRects) {
          // この行にあるコンテナの下端を確認
          if (placedRect.top <= currentY && placedRect.bottom > currentY) {
            if (placedRect.bottom > nextY) {
              nextY = placedRect.bottom;
            }
          }
        }
        currentY = nextY;
      }
    }

    // 配置できなかった場合（画面からはみ出す場合）、重ならない範囲で配置
    if (!placed) {
      // 画面内で重ならない位置を探す（画面からはみ出しても重ならないように）
      let found = false;
      for (let y = 0; y < gridHeight && !found; y += CELL_SIZE) {
        for (let x = 0; x < gridWidth && !found; x += CELL_SIZE) {
          const newRect = {
            left: x,
            top: y,
            right: x + containerWidth,
            bottom: y + containerHeight
          };

          // 既存のコンテナと重複していないかチェック
          let overlaps = false;
          for (const placedRect of placedRects) {
            if (newRect.left < placedRect.right &&
              newRect.right > placedRect.left &&
              newRect.top < placedRect.bottom &&
              newRect.bottom > placedRect.top) {
              overlaps = true;
              break;
            }
          }

          if (!overlaps) {
            setAbsolutePosition(container, x, y);
            placedRects.push(newRect);
            found = true;
            console.log('[Layout] Auto-aligned container (fallback):', container.dataset.containerId, 'at x:', x, 'y:', y);
          }
        }
      }

      // それでも配置できなかった場合、既存のコンテナの下に配置
      if (!found && placedRects.length > 0) {
        // 最も下にあるコンテナの下端を取得
        let maxBottom = 0;
        for (const placedRect of placedRects) {
          if (placedRect.bottom > maxBottom) {
            maxBottom = placedRect.bottom;
          }
        }
        setAbsolutePosition(container, 0, maxBottom);
        const newRect = {
          left: 0,
          top: maxBottom,
          right: containerWidth,
          bottom: maxBottom + containerHeight
        };
        placedRects.push(newRect);
        console.log('[Layout] Auto-aligned container (below others):', container.dataset.containerId, 'at x: 0, y:', maxBottom);
      } else if (!found) {
        // 最初のコンテナの場合
        setAbsolutePosition(container, 0, 0);
        const newRect = {
          left: 0,
          top: 0,
          right: containerWidth,
          bottom: containerHeight
        };
        placedRects.push(newRect);
        console.log('[Layout] Auto-aligned container (first):', container.dataset.containerId, 'at x: 0, y: 0');
      }
    }
  });

  // レイアウトを保存
  saveSectionLayout();
}

// グリッドセルの位置情報をキャッシュから取得または計算
function getGridCellPositions(grid) {
  const now = Date.now();
  // キャッシュが有効な場合は再利用
  if (gridPositionCache && (now - gridPositionCacheTimestamp) < GRID_CACHE_DURATION) {
    return gridPositionCache;
  }

  const rect = grid.getBoundingClientRect();
  const { cols, rows } = getGridDimensions();

  const cellPositions = {
    cols: [],
    rows: [],
    rect: rect
  };

  // 各列の境界位置を取得（offsetLeft/offsetTopを使用してスクロール位置の影響を排除）
  for (let col = 1; col <= cols; col++) {
    const marker = document.createElement('div');
    marker.style.cssText = `
      grid-column: ${col} / ${col};
      grid-row: 1 / 1;
      width: 1px;
      height: 1px;
      visibility: hidden;
      pointer-events: none;
      margin: 0;
      padding: 0;
    `;
    grid.appendChild(marker);
    void marker.offsetHeight; // レイアウト再計算

    // offsetLeft/offsetTopを使用（スクロール位置の影響を受けない）
    const cellLeft = marker.offsetLeft;
    const cellRight = cellLeft + marker.offsetWidth;

    grid.removeChild(marker);

    cellPositions.cols.push({
      left: cellLeft,
      right: cellRight,
      center: (cellLeft + cellRight) / 2
    });
  }

  // 各行の境界位置を取得（offsetLeft/offsetTopを使用してスクロール位置の影響を排除）
  for (let row = 1; row <= rows; row++) {
    const marker = document.createElement('div');
    marker.style.cssText = `
      grid-column: 1 / 1;
      grid-row: ${row} / ${row};
      width: 1px;
      height: 1px;
      visibility: hidden;
      pointer-events: none;
      margin: 0;
      padding: 0;
    `;
    grid.appendChild(marker);
    void marker.offsetHeight; // レイアウト再計算

    // offsetLeft/offsetTopを使用（スクロール位置の影響を受けない）
    const cellTop = marker.offsetTop;
    const cellBottom = cellTop + marker.offsetHeight;

    grid.removeChild(marker);

    cellPositions.rows.push({
      top: cellTop,
      bottom: cellBottom,
      center: (cellTop + cellBottom) / 2
    });
  }

  // キャッシュに保存
  gridPositionCache = cellPositions;
  gridPositionCacheTimestamp = now;

  return cellPositions;
}

// グリッド位置のキャッシュをクリア
function clearGridPositionCache() {
  gridPositionCache = null;
  gridPositionCacheTimestamp = 0;
  // グリッドアンカーのキャッシュもクリア
  gridAnchors = null;
  gridAnchorsCacheTimestamp = 0;
}

// グリッドの交点（アンカー）を計算して記憶
let gridAnchors = null;
let gridAnchorsCacheTimestamp = 0;
const ANCHOR_CACHE_DURATION = 1000; // 1秒間キャッシュ

function getGridAnchors(grid) {
  const now = Date.now();
  // キャッシュが有効な場合は再利用
  if (gridAnchors && (now - gridAnchorsCacheTimestamp) < ANCHOR_CACHE_DURATION) {
    return gridAnchors;
  }

  const CELL_SIZE = 80;
  // グリッドコンテナのサイズを取得（grid要素ではなく、親のコンテナ要素）
  const container = grid.closest('.mypage-main-grid-container') || grid.parentElement;
  const gridWidth = container ? container.offsetWidth : grid.offsetWidth;
  const gridHeight = container ? container.offsetHeight : grid.offsetHeight;

  // グリッドの交点（アンカー）を計算
  // 画面に表示されているマス目の交点を確定
  const anchors = [];
  const maxCols = Math.floor(gridWidth / CELL_SIZE);
  const maxRows = Math.floor(gridHeight / CELL_SIZE);

  // 0からmaxCols/maxRowsまで、すべての交点を計算
  for (let row = 0; row <= maxRows; row++) {
    for (let col = 0; col <= maxCols; col++) {
      const x = col * CELL_SIZE;
      const y = row * CELL_SIZE;
      // グリッド範囲内のアンカーのみ追加（画面からはみ出さないように）
      if (x < gridWidth && y < gridHeight) {
        anchors.push({ x, y });
      }
    }
  }

  gridAnchors = anchors;
  gridAnchorsCacheTimestamp = now;

  console.log('[Grid] Calculated grid anchors:', anchors.length, 'anchors', 'gridWidth:', gridWidth, 'gridHeight:', gridHeight, 'maxCols:', maxCols, 'maxRows:', maxRows);
  return anchors;
}

// 指定された位置に最も近いアンカーを見つける
function findNearestAnchor(grid, x, y) {
  const anchors = getGridAnchors(grid);
  if (anchors.length === 0) {
    return { x: 0, y: 0 };
  }

  let nearestAnchor = anchors[0];
  let minDistance = Math.sqrt(Math.pow(x - nearestAnchor.x, 2) + Math.pow(y - nearestAnchor.y, 2));

  for (const anchor of anchors) {
    const distance = Math.sqrt(Math.pow(x - anchor.x, 2) + Math.pow(y - anchor.y, 2));
    if (distance < minDistance) {
      minDistance = distance;
      nearestAnchor = anchor;
    }
  }

  return nearestAnchor;
}

// マウス位置から絶対位置（ピクセル）を計算（グリッドの交点（アンカー）にスナップ）
// コンテナの左上角を基準点として、基準点がアンカーと重なるように配置
function getAbsolutePositionFromMouse(grid, x, y) {
  try {
    // マウス位置をグリッド要素からの相対位置に変換
    const rect = grid.getBoundingClientRect();
    const gridX = x - rect.left;
    const gridY = y - rect.top;

    // 負の値は0に制限
    const clampedX = Math.max(0, gridX);
    const clampedY = Math.max(0, gridY);

    // 最も近いアンカーを見つけてスナップ
    const nearestAnchor = findNearestAnchor(grid, clampedX, clampedY);

    return {
      x: nearestAnchor.x,
      y: nearestAnchor.y
    };
  } catch (error) {
    console.error('[Position] Error calculating absolute position:', error);
    // エラー時はフォールバック
    const rect = grid.getBoundingClientRect();
    const gridX = x - rect.left;
    const gridY = y - rect.top;
    const clampedX = Math.max(0, gridX);
    const clampedY = Math.max(0, gridY);
    const nearestAnchor = findNearestAnchor(grid, clampedX, clampedY);
    return {
      x: nearestAnchor.x,
      y: nearestAnchor.y
    };
  }
}

// 後方互換性のため、getGridPositionFromMouseも残す
function getGridPositionFromMouse(grid, x, y) {
  const absPos = getAbsolutePositionFromMouse(grid, x, y);
  const CELL_SIZE = 80;
  const col = Math.floor(absPos.x / CELL_SIZE) + 1;
  const row = Math.floor(absPos.y / CELL_SIZE) + 1;
  return { col, row };
}

// ドロッププレビューガイドを表示
// 絶対位置でプレビューを表示
function showDropPreviewAbsolute(grid, container, x, y) {
  // 既存のプレビューを削除
  hideDropPreview(grid);

  const width = parseInt(container.dataset.containerWidth) || 3;
  const height = parseInt(container.dataset.containerHeight) || 3;
  const CELL_SIZE = 80;
  const previewWidth = width * CELL_SIZE;
  const previewHeight = height * CELL_SIZE;

  // プレビュー要素を作成（絶対位置で配置）
  const preview = document.createElement('div');
  preview.className = 'drop-preview-guide';
  preview.style.cssText = `
    position: absolute;
    left: ${x}px;
    top: ${y}px;
    width: ${previewWidth}px;
    height: ${previewHeight}px;
    border: 2px dashed rgba(255, 192, 203, 0.8);
    background: rgba(255, 192, 203, 0.1);
    pointer-events: none;
    z-index: 1;
    box-sizing: border-box;
  `;

  grid.appendChild(preview);
  console.log('[Drag] Preview shown at x:', x, 'y:', y, 'width:', previewWidth, 'height:', previewHeight);
}

// 後方互換性のため、showDropPreviewも残す
function showDropPreview(grid, container, col, row) {
  const CELL_SIZE = 80;
  const x = (col - 1) * CELL_SIZE;
  const y = (row - 1) * CELL_SIZE;
  showDropPreviewAbsolute(grid, container, x, y);
}

// ドロッププレビューガイドを削除
function hideDropPreview(grid) {
  const existingPreview = grid.querySelector('.drop-preview-guide');
  if (existingPreview) {
    existingPreview.remove();
  }
}

// コンテナの最小/最大サイズ制約を取得
function getContainerSizeConstraints(container) {
  const minWidth = parseInt(container.dataset.containerMinWidth) || 1;
  const maxWidth = parseInt(container.dataset.containerMaxWidth) || 999;
  const minHeight = parseInt(container.dataset.containerMinHeight) || 1;
  const maxHeight = parseInt(container.dataset.containerMaxHeight) || 999;
  return { minWidth, maxWidth, minHeight, maxHeight };
}

// コンテナサイズが制約内かチェック
function isValidContainerSize(container, width, height) {
  const { minWidth, maxWidth, minHeight, maxHeight } = getContainerSizeConstraints(container);
  return width >= minWidth && width <= maxWidth && height >= minHeight && height <= maxHeight;
}

// 絶対位置が有効かチェック（他のコンテナと重複しないか、範囲内か）
// 他のコンテナと重なっていない場所のみに配置可能
// 画面からはみ出さないようにする
function isValidAbsolutePosition(grid, container, x, y) {
  const width = parseInt(container.dataset.containerWidth) || 3;
  const height = parseInt(container.dataset.containerHeight) || 3;
  const CELL_SIZE = 80;
  const containerWidth = width * CELL_SIZE;
  const containerHeight = height * CELL_SIZE;

  // サイズ制約チェック
  if (!isValidContainerSize(container, width, height)) {
    return false;
  }

  // グリッドの範囲を取得
  const gridWidth = grid.offsetWidth;
  const gridHeight = grid.offsetHeight;

  // 画面からはみ出さないようにチェック
  // 左端・上端が範囲外の場合は無効
  if (x < 0 || y < 0) {
    return false;
  }

  // 右端・下端が範囲外の場合は無効（コンテナが完全にグリッド内に収まる必要がある）
  if (x + containerWidth > gridWidth || y + containerHeight > gridHeight) {
    return false;
  }

  // 新しい位置の矩形
  const newRect = {
    left: x,
    top: y,
    right: x + containerWidth,
    bottom: y + containerHeight
  };

  // グリッド内のすべてのコンテナを取得（ドラッグ中のコンテナを除く）
  const allContainers = grid.querySelectorAll('.draggable-container');

  // 他のコンテナと重複していないかチェック
  for (const otherContainer of allContainers) {
    // ドラッグ中のコンテナはスキップ
    if (otherContainer === container || otherContainer === draggedElement) {
      continue;
    }

    // 他のコンテナの位置とサイズを取得
    const otherLeft = parseInt(otherContainer.style.left) || 0;
    const otherTop = parseInt(otherContainer.style.top) || 0;
    const otherWidth = parseInt(otherContainer.dataset.containerWidth) || 3;
    const otherHeight = parseInt(otherContainer.dataset.containerHeight) || 3;
    const otherContainerWidth = otherWidth * CELL_SIZE;
    const otherContainerHeight = otherHeight * CELL_SIZE;

    const otherRect = {
      left: otherLeft,
      top: otherTop,
      right: otherLeft + otherContainerWidth,
      bottom: otherTop + otherContainerHeight
    };

    // 矩形の重複チェック
    if (newRect.left < otherRect.right &&
      newRect.right > otherRect.left &&
      newRect.top < otherRect.bottom &&
      newRect.bottom > otherRect.top) {
      // 重複している
      return false;
    }
  }

  // 重複していない
  return true;
}

// 後方互換性のため、isValidPositionも残す
function isValidPosition(grid, container, col, row) {
  const CELL_SIZE = 80;
  const x = (col - 1) * CELL_SIZE;
  const y = (row - 1) * CELL_SIZE;
  return isValidAbsolutePosition(grid, container, x, y);
}

// ドラッグ&ドロップ機能は削除されました

// マイページのテーマを適用
function applyMypageTheme(theme = null) {
  try {
    const settings = JSON.parse(localStorage.getItem('staff_settings') || '{}');
    const selectedTheme = theme || settings.theme || 'misesapo';

    // テーマクラスを適用（mypage-contentのみ、ヘッダーは除外）
    const mypageContent = document.getElementById('mypage-content');
    if (mypageContent) {
      mypageContent.setAttribute('data-theme', selectedTheme);
    }

    // ドキュメント全体にも適用
    document.documentElement.setAttribute('data-mypage-theme', selectedTheme);

    console.log('[Theme] Applied theme:', selectedTheme);
  } catch (error) {
    console.warn('Failed to apply mypage theme:', error);
  }
}

// コンテナにツールチップを設定（マス数表示）
function setupContainerTooltips() {
  const containers = document.querySelectorAll('.draggable-container');
  containers.forEach(container => {
    const width = parseInt(container.dataset.containerWidth) || 1;
    const height = parseInt(container.dataset.containerHeight) || 1;
    const cost = width * height;
    container.title = `${width}×${height}マス（合計${cost}マス）`;
  });
}

// localStorageの異常な位置データをクリア
function validateAndClearInvalidLayout() {
  try {
    const savedLayout = localStorage.getItem('mypage_section_layout');
    if (!savedLayout) return;

    const layout = JSON.parse(savedLayout);
    const grid = document.getElementById('mypage-grid');
    if (!grid) return;

    const gridWidth = grid.offsetWidth || 1920;
    const gridHeight = grid.offsetHeight || 1080;
    let hasInvalid = false;

    layout.forEach(item => {
      if (item.position) {
        const parts = item.position.split(',').map(Number);
        if (parts.length === 2) {
          if (isNaN(parts[0]) || isNaN(parts[1]) ||
            !isFinite(parts[0]) || !isFinite(parts[1]) ||
            Math.abs(parts[0]) > 100000 || Math.abs(parts[1]) > 100000 ||
            (parts[0] >= 100 && (parts[0] < 0 || parts[0] >= gridWidth || parts[1] < 0 || parts[1] >= gridHeight))) {
            hasInvalid = true;
          }
        }
      }
    });

    if (hasInvalid) {
      console.warn('[Layout] Invalid layout data found in localStorage, clearing...');
      localStorage.removeItem('mypage_section_layout');
    }
  } catch (error) {
    console.warn('[Layout] Error validating layout data:', error);
    localStorage.removeItem('mypage_section_layout');
  }
}

// NFCタグ打刻処理（バックグラウンド）
(function () {
  const REPORT_API = 'https://2z0ui5xfxb.execute-api.ap-northeast-1.amazonaws.com/prod';

  // IDトークン取得
  async function getFirebaseIdToken() {
    try {
      const cognitoIdToken = localStorage.getItem('cognito_id_token');
      if (cognitoIdToken) return cognitoIdToken;

      const cognitoUser = localStorage.getItem('cognito_user');
      if (cognitoUser) {
        try {
          const parsed = JSON.parse(cognitoUser);
          if (parsed.tokens && parsed.tokens.idToken) return parsed.tokens.idToken;
          if (parsed.idToken) return parsed.idToken;
        } catch (e) {
          console.warn('Error parsing cognito user:', e);
        }
      }

      const authData = localStorage.getItem('misesapo_auth');
      if (authData) {
        try {
          const parsed = JSON.parse(authData);
          if (parsed.token) return parsed.token;
        } catch (e) {
          console.warn('Error parsing auth data:', e);
        }
      }

      return 'dev-token';
    } catch (error) {
      console.error('Error getting ID token:', error);
      return 'dev-token';
    }
  }

  // 現在のユーザーIDを取得
  function getCurrentUserId() {
    try {
      const cognitoUser = localStorage.getItem('cognito_user');
      if (cognitoUser) {
        const parsed = JSON.parse(cognitoUser);
        return parsed.username || parsed.email?.split('@')[0] || 'WKR_001';
      }

      const authData = localStorage.getItem('misesapo_auth');
      if (authData) {
        const parsed = JSON.parse(authData);
        return parsed.user?.id || parsed.user?.email?.split('@')[0] || 'WKR_001';
      }

      return 'WKR_001';
    } catch (e) {
      console.error('Error getting user ID:', e);
      return 'WKR_001';
    }
  }

  // 打刻を実行
  async function recordClockIn(facilityId, locationId) {
    try {
      const user_id = getCurrentUserId();

      const response = await fetch(`${REPORT_API}/staff/nfc/clock-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getFirebaseIdToken()}`
        },
        body: JSON.stringify({
          user_id: user_id,
          facility_id: facilityId,
          location_id: locationId
        })
      });

      const result = await response.json();

      if (response.ok && result.status === 'success') {
        return { success: true, result: result };
      } else {
        throw new Error(result.error || '打刻に失敗しました');
      }
    } catch (error) {
      console.error('Clock-in error:', error);
      return { success: false, error: error.message };
    }
  }

  // トースト通知を表示
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#22c55e' : '#ef4444'};
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      z-index: 10000;
      font-size: 0.875rem;
      font-weight: 500;
      animation: slideIn 0.3s ease-out;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // スタイルを追加
  if (!document.getElementById('nfc-toast-styles')) {
    const style = document.createElement('style');
    style.id = 'nfc-toast-styles';
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // 認証チェック関数
  async function checkAuthentication() {
    const token = await getFirebaseIdToken();

    // dev-tokenの場合は認証されていない
    if (token === 'dev-token') {
      return false;
    }

    // Cognitoユーザーを確認
    const cognitoUser = localStorage.getItem('cognito_user');
    if (cognitoUser) {
      try {
        const parsed = JSON.parse(cognitoUser);
        if (parsed.username || parsed.email) {
          return true;
        }
      } catch (e) {
        console.warn('Error parsing cognito user:', e);
      }
    }

    // misesapo_authを確認
    const authData = localStorage.getItem('misesapo_auth');
    if (authData) {
      try {
        const parsed = JSON.parse(authData);
        if (parsed.user || parsed.email) {
          return true;
        }
      } catch (e) {
        console.warn('Error parsing auth data:', e);
      }
    }

    return false;
  }

  // ページ読み込み時にURLパラメータをチェック
  window.addEventListener('DOMContentLoaded', async function () {
    const urlParams = new URLSearchParams(window.location.search);
    const tagId = urlParams.get('nfc_tag_id');

    if (tagId) {
      // 認証チェック
      const isAuthenticated = await checkAuthentication();
      if (!isAuthenticated) {
        // ログインページにリダイレクト（NFCタグIDを保持）
        const loginUrl = `/staff/signin.html?redirect=${encodeURIComponent(window.location.pathname)}&nfc_tag_id=${tagId}`;
        window.location.href = loginUrl;
        return;
      }

      // URLパラメータを削除（履歴に残さない）
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);

      // タグ情報を取得
      try {
        const tagResponse = await fetch(`${REPORT_API}/staff/nfc/tag?tag_id=${tagId}`, {
          headers: {
            'Authorization': `Bearer ${await getFirebaseIdToken()}`
          }
        });

        if (!tagResponse.ok) {
          throw new Error('タグ情報の取得に失敗しました');
        }

        const tagInfo = await tagResponse.json();

        if (!tagInfo.facility_id || !tagInfo.location_id) {
          throw new Error('タグ情報が不完全です');
        }

        // バックグラウンドで打刻を実行
        const clockInResult = await recordClockIn(tagInfo.facility_id, tagInfo.location_id);

        if (clockInResult.success) {
          const facilityName = tagInfo.facility_name || tagInfo.facility_id;
          const locationName = tagInfo.location_name || tagInfo.location_id;
          showToast(`打刻完了: ${facilityName} - ${locationName}`, 'success');

          // 出退勤記録を再読み込み（もし表示されている場合）
          if (typeof loadAttendanceRecords === 'function') {
            setTimeout(() => {
              loadAttendanceRecords();
            }, 1000);
          }
        } else {
          showToast(`打刻失敗: ${clockInResult.error}`, 'error');
        }
      } catch (error) {
        console.error('NFC tag processing error:', error);
        showToast(`エラー: ${error.message}`, 'error');
      }
    }
  });
})();

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  // ページ読み込み時にlocalStorageの異常なデータをクリア
  setTimeout(validateAndClearInvalidLayout, 100);

  // 日付が変わったかチェック（最初に実行）
  initializeAttendanceForToday();

  loadCurrentUser();
  if (document.getElementById('attendance-toggle-btn')) {
    setupAttendanceToggleButton();
  }
  setupCorrectionRequestButton();
  const hasTodoUI = Boolean(document.getElementById('todo-input')) || Boolean(document.getElementById('todo-list'));
  if (hasTodoUI) {
    setupTodoListeners();
    initializeTodoClock();
  }
  setupDigitalClock();
  applyMypageTheme();

  // 設定ページでテーマが変更された場合のイベントリスナー
  window.addEventListener('themeChanged', (e) => {
    applyMypageTheme(e.detail.theme);
  });

  // localStorageの変更を監視（別タブで設定が変更された場合）
  window.addEventListener('storage', (e) => {
    if (e.key === 'staff_settings') {
      applyMypageTheme();
    }
  });

  // 編集モード機能は削除されました

  // 自動整列ボタン
  const autoAlignBtn = document.getElementById('auto-align-btn');
  if (autoAlignBtn) {
    autoAlignBtn.addEventListener('click', () => {
      if (confirm('すべてのコンテナを自動整列しますか？')) {
        const grid = document.getElementById('mypage-grid');
        if (!grid) return;
        const containers = Array.from(grid.querySelectorAll('.draggable-container'));
        autoAlignContainers(grid, containers);
        // 編集モード機能は削除されました
      }
    });
  }

  // ドラッグ&ドロップ機能は削除されました

  // セクションの配置はloadCurrentUser()内で復元されるため、ここでは呼ばない

  // コンテナのツールチップを設定
  setupContainerTooltips();

  // ウィンドウリサイズ時にキャッシュをクリア
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    // リサイズ時にキャッシュをクリア
    clearGridPositionCache();
  });

  // カレンダーナビゲーション
  const calendarPrev = document.getElementById('calendar-prev');
  const calendarNext = document.getElementById('calendar-next');
  if (calendarPrev) {
    calendarPrev.addEventListener('click', (e) => {
      e.preventDefault();
      currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
      renderCalendar();
    });
  }
  if (calendarNext) {
    calendarNext.addEventListener('click', (e) => {
      e.preventDefault();
      currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
      renderCalendar();
    });
  }

  // ユーザー読み込み後にTODOを読み込む
  const originalLoadCurrentUser = loadCurrentUser;
  if (hasTodoUI) {
    const checkAndLoadTodos = setInterval(() => {
      if (currentUser) {
        loadTodos();
        clearInterval(checkAndLoadTodos);
      }
    }, 500);

    // 5秒後にタイムアウト
    setTimeout(() => {
      clearInterval(checkAndLoadTodos);
      if (!currentUser) {
        loadTodos(); // ユーザーがなくてもデフォルトで読み込む
      }
    }, 5000);
  }

  // アコーディオン機能のセットアップはloadCurrentUser()の完了後に実行される
});

// スケジュール一覧を読み込む（清掃員マイページ用）
async function loadScheduleList(user) {
  if (!user || !user.id) {
    console.warn('[Mypage] User ID not available for schedule list');
    return;
  }

  const scheduleListContent = document.getElementById('schedule-list-content');
  if (!scheduleListContent) return;

  try {
    const idToken = await getCognitoIdToken();
    const headers = {};
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    // スケジュールを取得
    const response = await fetch(`${API_BASE}/schedules`, { headers });
    if (!response.ok) {
      throw new Error('Failed to load schedules');
    }

    const schedulesData = await response.json();
    const allSchedules = Array.isArray(schedulesData) ? schedulesData : (schedulesData.items || schedulesData.schedules || []);

    // 現在のユーザーに割り当てられたスケジュール、または全員に割り当てられたスケジュールをフィルタリング
    // デフォルトは全員に割り当て（worker_idが空/null = 全員が見られる）
    // 特定の清掃員に割り当てられた場合は、その清掃員のみに表示
    const userSchedules = allSchedules.filter(schedule => {
      const scheduleWorkerId = schedule.worker_id || schedule.assigned_to || schedule.staff_id;

      // worker_idが空/nullの場合 = 全員に割り当て = 全員に表示
      if (!scheduleWorkerId || scheduleWorkerId === '' || scheduleWorkerId === null) {
        return true;
      }

      // 特定の清掃員に割り当てられた場合、現在のユーザーに割り当てられているか確認
      // IDの正規化処理を使用して比較
      if (window.DataUtils && window.DataUtils.IdUtils && window.DataUtils.IdUtils.isSame) {
        return window.DataUtils.IdUtils.isSame(scheduleWorkerId, user.id);
      } else {
        return String(scheduleWorkerId) === String(user.id);
      }
    });

    // 確定済み（scheduledまたはin_progress）の全スケジュール（過去・未来含む）
    const allRelevantSchedules = userSchedules.filter(schedule => {
      const status = schedule.status || '';
      return status === 'scheduled' || status === 'in_progress';
    });

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // 本日の予定
    const todaySchedules = allRelevantSchedules.filter(s => {
      const sDate = s.scheduled_date || s.date;
      return sDate === todayStr;
    }).sort((a, b) => {
      const tA = a.scheduled_time || a.time || '00:00';
      const tB = b.scheduled_time || b.time || '00:00';
      return tA.localeCompare(tB);
    });

    // 今週の予定（明日以降、7日後まで）
    const thisWeekSchedules = allRelevantSchedules.filter(s => {
      const sDate = s.scheduled_date || s.date;
      if (!sDate) return false;
      const sDateTime = new Date(sDate);
      return sDate > todayStr && sDateTime <= sevenDaysLater;
    }).sort((a, b) => {
      const dA = a.scheduled_date || a.date;
      const dB = b.scheduled_date || b.date;
      if (dA !== dB) return dA.localeCompare(dB);
      const tA = a.scheduled_time || a.time || '00:00';
      const tB = b.scheduled_time || b.time || '00:00';
      return tA.localeCompare(tB);
    });

    // 表示を更新
    if (todaySchedules.length === 0 && thisWeekSchedules.length === 0) {
      scheduleListContent.innerHTML = '<div class="empty-state">直近1週間のスケジュールはありません</div>';
      return;
    }

    let listHtml = '';

    if (todaySchedules.length > 0) {
      listHtml += `<div class="schedule-list-group-header"><i class="fas fa-star"></i> 本日の予定</div>`;
      listHtml += todaySchedules.map(s => renderScheduleItemHtml(s, user)).join('');
    }

    if (thisWeekSchedules.length > 0) {
      listHtml += `<div class="schedule-list-group-header"><i class="fas fa-calendar-alt"></i> 今週の予定</div>`;
      listHtml += thisWeekSchedules.map(s => renderScheduleItemHtml(s, user)).join('');
    }

    scheduleListContent.innerHTML = listHtml;
  } catch (error) {
    console.error('[Mypage] Failed to load schedule list:', error);
    scheduleListContent.innerHTML = '<div class="error-state">読み込みに失敗しました</div>';
  }
}

// スケジュールアイテムのHTMLを生成するヘルパー
function renderScheduleItemHtml(schedule, user) {
  const scheduleDate = schedule.scheduled_date || schedule.date;
  const scheduleTime = schedule.scheduled_time || schedule.time || schedule.time_slot || '00:00';
  const dateTime = new Date(`${scheduleDate}T${scheduleTime}:00`);

  // 日付と時刻をフォーマット
  const dateStr = dateTime.toLocaleDateString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short'
  });
  const timeStr = scheduleTime.length === 5 ? scheduleTime : scheduleTime.substring(0, 5);

  // ブランド名と店舗名を取得
  const brandName = schedule.brand_name || '';
  const storeName = schedule.store_name || schedule.client_name || '-';
  const displayName = brandName ? `${escapeHtml(brandName)} / ${escapeHtml(storeName)}` : escapeHtml(storeName);

  // 現在のユーザーに既に受託されているか確認
  const scheduleWorkerId = schedule.worker_id || schedule.assigned_to || schedule.staff_id || '';
  let isAssigned = false;
  if (scheduleWorkerId) {
    if (window.DataUtils && window.DataUtils.IdUtils && window.DataUtils.IdUtils.isSame) {
      isAssigned = window.DataUtils.IdUtils.isSame(scheduleWorkerId, user.id);
    } else {
      isAssigned = String(scheduleWorkerId) === String(user.id);
    }
  }

  const statusLabel = schedule.status === 'in_progress' ? '作業中' : '確定';
  const statusClass = schedule.status === 'in_progress' ? 'status-in-progress' : 'status-scheduled';

  return `
    <div class="schedule-list-item" style="padding: 10px 12px; border-bottom: 1px solid #f3f4f6;">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
        <div style="display: flex; flex-direction: column; gap: 4px; flex: 1; cursor: pointer;" onclick="window.location.href='/staff/os/schedule'">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-weight: 700; color: #111827; font-size: 0.9rem;">${timeStr}</span>
            <span style="color: #6b7280; font-size: 0.75rem;">${escapeHtml(dateStr)}</span>
          </div>
          <div style="font-size: 0.85rem; color: #374151; font-weight: 500;">${displayName}</div>
        </div>
        <div style="flex-shrink: 0;">
          ${isAssigned
      ? `<span class="status-badge ${statusClass}" style="padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 600;">${statusLabel}</span>`
      : `<button class="btn-accept-schedule" onclick="event.stopPropagation(); acceptSchedule('${escapeHtml(schedule.id)}', this);" style="padding: 5px 10px; border-radius: 6px; font-size: 0.7rem; font-weight: 600; background: #ff679c; color: white; border: none; cursor: pointer; transition: all 0.2s;">受託</button>`
    }
        </div>
      </div>
    </div>
  `;
}

// OS課の直近のスケジュール情報を読み込む
async function loadOSNextSchedule(user) {
  if (!user || !user.id) {
    console.warn('[OS Mypage] User ID not available');
    return;
  }

  const scheduleInfoContent = document.getElementById('schedule-info-content');
  const refreshIndicator = document.getElementById('schedule-refresh-indicator');

  if (!scheduleInfoContent) return;

  try {
    // 更新インジケーターを表示
    if (refreshIndicator) {
      refreshIndicator.classList.add('fa-spin');
    }

    const idToken = await getCognitoIdToken();
    const headers = {};
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken} `;
    }

    // スケジュールを取得
    const response = await fetch(`${API_BASE}/schedules`, { headers });
    if (!response.ok) {
      throw new Error('Failed to load schedules');
    }

    const schedulesData = await response.json();
    const allSchedules = Array.isArray(schedulesData) ? schedulesData : (schedulesData.items || schedulesData.schedules || []);

    // 現在のユーザーに割り当てられたスケジュール、または全員に割り当てられたスケジュールをフィルタリング
    // デフォルトは全員に割り当て（worker_idが空/null = 全員が見られる）
    // 特定の清掃員に割り当てられた場合は、その清掃員のみに表示
    const userSchedules = allSchedules.filter(schedule => {
      const scheduleWorkerId = schedule.worker_id || schedule.assigned_to || schedule.staff_id;

      // worker_idが空/nullの場合 = 全員に割り当て = 全員に表示
      if (!scheduleWorkerId || scheduleWorkerId === '' || scheduleWorkerId === null) {
        return true;
      }

      // 特定の清掃員に割り当てられた場合、現在のユーザーに割り当てられているか確認
      // IDの正規化処理を使用して比較
      if (window.DataUtils && window.DataUtils.IdUtils && window.DataUtils.IdUtils.isSame) {
        return window.DataUtils.IdUtils.isSame(scheduleWorkerId, user.id);
      } else {
        return String(scheduleWorkerId) === String(user.id);
      }
    });

    // 確定済み（scheduledまたはin_progress）で、現在時刻以降のスケジュールを取得し、開始時刻順にソート
    const now = new Date();
    const upcomingSchedules = userSchedules
      .filter(schedule => {
        // ステータスが確定済み（scheduledまたはin_progress）
        const status = schedule.status || '';
        if (status !== 'scheduled' && status !== 'in_progress') {
          return false;
        }

        if (!schedule.scheduled_date && !schedule.date) return false;

        const scheduleDate = schedule.scheduled_date || schedule.date;
        const scheduleTime = schedule.scheduled_time || schedule.time || schedule.time_slot || '00:00';
        const scheduleDateTime = new Date(`${scheduleDate}T${scheduleTime}:00`);

        return scheduleDateTime >= now;
      })
      .sort((a, b) => {
        const dateA = a.scheduled_date || a.date;
        const timeA = a.scheduled_time || a.time || a.time_slot || '00:00';
        const dateTimeA = new Date(`${dateA}T${timeA}:00`);

        const dateB = b.scheduled_date || b.date;
        const timeB = b.scheduled_time || b.time || b.time_slot || '00:00';
        const dateTimeB = new Date(`${dateB}T${timeB}:00`);

        return dateTimeA - dateTimeB;
      });

    // 直近のスケジュール（最初の1件）
    const nextSchedule = upcomingSchedules[0];

    if (nextSchedule) {
      const scheduleDate = nextSchedule.scheduled_date || nextSchedule.date;
      const scheduleTime = nextSchedule.scheduled_time || nextSchedule.time || nextSchedule.time_slot || '00:00';
      const scheduleDateTime = new Date(`${scheduleDate}T${scheduleTime}:00`);

      // 日付と時刻をフォーマット
      const dateStr = new Date(scheduleDate).toLocaleDateString('ja-JP', {
        month: 'long',
        day: 'numeric',
        weekday: 'short'
      });
      const timeStr = scheduleTime.length === 5 ? scheduleTime : scheduleTime.substring(0, 5);

      // 残り時間を計算
      const timeDiff = scheduleDateTime - now;
      const hoursLeft = Math.floor(timeDiff / (1000 * 60 * 60));
      const minutesLeft = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

      let timeLeftText = '';
      let timeLeftColor = '#ff679c';
      if (hoursLeft > 0) {
        timeLeftText = `あと${hoursLeft}時間${minutesLeft}分`;
      } else if (minutesLeft > 0) {
        timeLeftText = `あと${minutesLeft}分`;
      } else if (timeDiff > 0) {
        timeLeftText = 'まもなく';
      } else {
        timeLeftText = '開始時刻を過ぎています';
        timeLeftColor = '#ef4444';
      }

      // レポート状況とメンバー、サービス内容を並列で読み込み
      let hasReport = false;
      let serviceNames = [];
      let memberNames = [];

      // チームメンバーの状況を取得（レポートベース）
      let teamMembers = [];

      // 1. レポート提出者（作業中・完了）
      if (hasReport) { // hasReport is true if *I* have report? No, fetch response check lines 4700.
        // reports variable is scoped inside if(reportRes.ok). I need to access it.
        // I should move reports fetching logic or extraction logic.
      }

      // Rewrite fetching logic to scope 'reports' variable
      let reports = [];
      try {
        const reportRes = await fetch(`${REPORT_API}/daily-reports?type=cleaning&schedule_id=${nextSchedule.id}`, { headers });
        if (reportRes.ok) {
          const json = await reportRes.json();
          reports = Array.isArray(json) ? json : (json.items || []);
        }
      } catch (e) { console.warn(e); }

      hasReport = reports.some(r => window.DataUtils?.IdUtils?.isSame(r.staff_id, user.id) || r.staff_id === user.id);

      // Map reports to member status
      // Create a map of staff_id/name -> status
      const memberStatusMap = new Map();
      reports.forEach(r => {
        // Staff Name is needed. Report might have staff_name?
        // If not, we might only have staff_id. We might need to map ID to Name if possible.
        // But reports usually contain staff_name snapshot.
        const name = r.staff_name || r.worker_name || 'Unknown';
        const status = r.status; // in_progress, completed
        memberStatusMap.set(name, status);
      });

      // 2. Assigned Members (Static) - Merge with reports
      let assignedNames = [];
      if (nextSchedule.member_names && Array.isArray(nextSchedule.member_names)) {
        assignedNames = nextSchedule.member_names;
      } else if (nextSchedule.worker_name) {
        assignedNames = [nextSchedule.worker_name];
      } else {
        assignedNames = [user.name];
      }

      // Build display list
      // Priority: Report Status > Assigned (Not Started)
      // We iterate over assignedNames and check status.
      // ALSO add anyone who reported but isn't in assignedNames (just in case).

      teamMembers = assignedNames.map(name => {
        const status = memberStatusMap.get(name) || 'not_started';
        // Remove from map to track unassigned reporters
        memberStatusMap.delete(name);
        return { name, status };
      });

      // Add remaining reporters
      memberStatusMap.forEach((status, name) => {
        teamMembers.push({ name, status });
      });

      // 打刻状態（開始済みかどうか）
      // 案件自体のステータスではなく、自分のレポートが存在するかどうかで判定
      const isWorking = hasReport; // レポートがあれば作業中（または完了）とみなす
      // const startedAt = nextSchedule.started_at ? new Date(nextSchedule.started_at) : null;
      // 個人の開始時間はレポートから取得すべきだが、ここでは簡易的に現在時刻またはスケジュール時間を表示
      // 本来は reported_at などを参照すべき

      const brandName = nextSchedule.brand_name || '';
      const storeName = nextSchedule.store_name || nextSchedule.store?.name || '-';
      const displayName = brandName ? `${escapeHtml(brandName)} / ${escapeHtml(storeName)}` : escapeHtml(storeName);

      scheduleInfoContent.innerHTML = `
        <div class="schedule-detail" style="background: #fff; padding: 16px; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          <!-- ヘッダー：ステータス -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              ${isWorking
          ? `<span style="background: #ecfdf5; color: #059669; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 700;"><i class="fas fa-play-circle"></i> 作業中</span>`
          : `<span style="background: #fdf2f8; color: #db2777; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 700;"><i class="fas fa-clock"></i> 未開始</span>`
        }
              ${hasReport
          ? `<span style="background: #eff6ff; color: #2563eb; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 700;"><i class="fas fa-check-double"></i> レポート済</span>`
          : `<span style="background: #fff7ed; color: #ea580c; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 700;"><i class="fas fa-exclamation-circle"></i> レポート未作成</span>`
        }
            </div>
            <div style="text-align: right;">
              <div style="font-size: 0.75rem; color: #6b7280;">開始時刻 ${timeStr}</div>
              <div style="font-size: 0.875rem; color: ${timeLeftColor}; font-weight: 700;">${timeLeftText}</div>
            </div>
          </div>

          <!-- 店舗情報 -->
          <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 16px;">
            <div style="flex: 1;">
              <div style="font-size: 1.125rem; font-weight: 700; color: #111827; margin-bottom: 4px;">${displayName}</div>
              <div style="font-size: 0.8125rem; color: #6b7280;"><i class="fas fa-map-marker-alt" style="margin-right: 4px;"></i> ${nextSchedule.location || '現場住所未設定'}</div>
            </div>
            <button onclick="window.open('/staff/os/karte.html?store_id=${nextSchedule.store_id || nextSchedule.storeId}', '_blank')" 
                    style="flex-shrink: 0; background: #f3f4f6; color: #4b5563; border: 1px solid #d1d5db; padding: 6px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px;">
              <i class="fas fa-notes-medical" style="color: #6366f1;"></i> 店舗カルテ
            </button>
          </div>

          <!-- 担当メンバー / サービス内容 -->
          <div style="display: flex; flex-direction: column; gap: 10px; padding: 12px; background: #f9fafb; border-radius: 8px; margin-bottom: 20px;">
            <div>
              <div style="font-size: 0.7rem; font-weight: 700; color: #9ca3af; margin-bottom: 4px; text-transform: uppercase;">Team Status</div>
              <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                ${teamMembers.map(m => {
          let style = 'background: #f3f4f6; color: #6b7280; border: 1px solid #e5e7eb;';
          let icon = '';
          if (m.status === 'in_progress') {
            style = 'background: #ecfdf5; color: #059669; border: 1px solid #10b981;';
            icon = '<i class="fas fa-play-circle" style="margin-right:4px;"></i>';
          } else if (m.status === 'completed' || m.status === 'approved') {
            style = 'background: #eff6ff; color: #2563eb; border: 1px solid #3b82f6;';
            icon = '<i class="fas fa-check-circle" style="margin-right:4px;"></i>';
          }
          return `<span style="${style} padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; display: inline-flex; align-items: center;">
                              ${icon}${escapeHtml(m.name)}
                            </span>`;
        }).join('')}
              </div>
            </div>
            <div style="border-top: 1px dashed #e5e7eb; padding-top: 8px;">
              <div style="font-size: 0.7rem; font-weight: 700; color: #9ca3af; margin-bottom: 4px; text-transform: uppercase;">Services</div>
              <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                ${serviceNames.map(name => `<span style="background: #ffecf2; color: #ff679c; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">#${escapeHtml(name)}</span>`).join('')}
                <button onclick="showAddServiceModal('${nextSchedule.id}')" style="background: #fff; border: 1px dashed #d1d5db; color: #6b7280; width: 20px; height: 20px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 0.75rem; cursor: pointer; margin-left: 4px;" title="清掃項目を追加">
                  <i class="fas fa-plus"></i>
                </button>
              </div>
            </div>
          </div>

          <!-- 案件ベースの作業開始・終了ボタン -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            ${!isWorking
          ? `
                <button class="btn-attendance" onclick="window.location.href='/staff/os/schedule'" style="background: #f3f4f6; color: #4b5563; border: 1px solid #d1d5db; padding: 12px; border-radius: 8px; font-weight: 700; font-size: 1rem; cursor: pointer;">
                  <i class="fas fa-info-circle" style="margin-right: 8px;"></i> 詳細確認
                </button>
                <button class="btn-attendance" onclick="window.location.href='/staff/os/reports/new?schedule_id=${nextSchedule.id}&mode=start'" style="background: #ff679c; color: white; border: none; padding: 12px; border-radius: 8px; font-weight: 700; font-size: 1rem; cursor: pointer;">
                  <i class="fas fa-play" style="margin-right: 8px;"></i> 作業開始
                </button>
            `
          : `
                <div style="grid-column: 1 / -1; background: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; padding: 10px; text-align: center; margin-bottom: 8px;">
                   <div style="font-size: 0.8125rem; color: #065f46; font-weight: 600;">作業中（${startedAtStr}開始）</div>
                </div>
                <button class="btn-attendance" onclick="handleReportCreation('${nextSchedule.id}')" style="background: white; border: 2px solid #ff679c; color: #ff679c; padding: 10px; border-radius: 8px; font-weight: 700; font-size: 0.875rem; cursor: pointer;">
                  <i class="fas fa-edit"></i> レポート作成
                </button>
                <button class="btn-attendance" onclick="completeWork('${nextSchedule.id}', ${hasReport}, this)" style="background: #374151; color: white; border: none; padding: 10px; border-radius: 8px; font-weight: 700; font-size: 0.875rem; cursor: pointer;">
                  <i class="fas fa-check-circle"></i> 作業終了
                </button>
              `
        }
          </div>
        </div>
      `;

      // 旧来の出退勤ボタンを非表示にする（OSユーザーのみ）
      const oldAttendanceGrid = document.querySelector('.attendance-today-grid');
      if (oldAttendanceGrid) {
        oldAttendanceGrid.style.display = 'none';
        const oldAttendanceHeader = document.querySelector('#attendance .container-header');
        if (oldAttendanceHeader) {
          // 既にメッセージが表示されているか確認
          if (!document.getElementById('os-attendance-warning')) {
            const infoBox = document.createElement('div');
            infoBox.id = 'os-attendance-warning';
            infoBox.style.padding = '8px 12px';
            infoBox.style.background = '#fef2f2';
            infoBox.style.color = '#991b1b';
            infoBox.style.fontSize = '0.75rem';
            infoBox.style.borderRadius = '6px';
            infoBox.style.marginTop = '8px';
            infoBox.innerHTML = '<i class="fas fa-info-circle"></i> OS課は案件ごとの「作業開始」ボタンを使用してください。';
            oldAttendanceGrid.parentElement.appendChild(infoBox);
          }
        }
      }
    } else {
      scheduleInfoContent.innerHTML = `
        <div class="schedule-empty" style="text-align: center; padding: 20px; color: #6b7280;">
          <i class="fas fa-calendar-times" style="font-size: 2rem; margin-bottom: 8px; opacity: 0.5;"></i>
          <div style="font-size: 0.875rem;">直近の清掃案件はありません</div>
        </div>
      `;
    }
  } catch (error) {
    console.error('[OS Mypage] Failed to load next schedule:', error);
    scheduleInfoContent.innerHTML = `
      <div class="schedule-error" style="text-align: center; padding: 20px; color: #ef4444;">
        <i class="fas fa-exclamation-triangle" style="margin-right: 8px;"></i>
        <span>スケジュール情報の読み込みに失敗しました</span>
      </div>
    `;
  } finally {
    // 更新インジケーターを停止
    if (refreshIndicator) {
      refreshIndicator.classList.remove('fa-spin');
    }
  }
}

// 案件受託
async function acceptSchedule(scheduleId, btn) {
  if (!confirm('この案件を受託しますか？')) return;

  try {
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 受託中...';
    }

    const headers = await buildAuthHeaders(true);
    const updateData = {
      status: 'in_progress',
      worker_id: currentUser?.id || '',
      accepted_at: new Date().toISOString()
    };

    const response = await fetch(`${API_BASE}/schedules/${scheduleId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updateData)
    });

    if (!response.ok) throw new Error('受託に失敗しました');

    showSuccessMessage('案件を受託しました');

    // UI更新
    if (typeof loadOSNextSchedule === 'function') {
      loadOSNextSchedule(currentUser);
    }
    // スケジュール一覧も更新（もしあれば）
    if (typeof renderOSScheduleList === 'function') {
      // renderOSScheduleListは内部でfetchしていない可能性があるので、再読み込みが必要かもしれない
      // しかし、現状ではloadOSNextScheduleがメイン
    }

    // ページ全体のスケジュールリストを再読み込み
    const scheduleListContent = document.getElementById('schedule-list-content');
    if (scheduleListContent) {
      // OS課のMyPageにいる場合、スケジュールリストを再読み込みする関数を呼ぶ
      // loadOSNextScheduleがメインの情報を更新するので、リストも必要なら再取得する
      // ここでは簡易的に画面をリロードするか、またはデータを再取得する
      setTimeout(() => window.location.reload(), 1000);
    }

  } catch (error) {
    console.error('[OS Mypage] Accept schedule error:', error);
    showErrorMessage('受託に失敗しました: ' + error.message);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '受託';
    }
  }
}

// 作業開始
async function startWork(scheduleId, btn) {
  if (!confirm('作業を開始しますか？')) return;

  try {
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 開始中...';
    }

    // 位置情報を取得（オプション）
    let location = null;
    if (navigator.geolocation) {
      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
      } catch (geoError) {
        console.warn('[OS Mypage] 位置情報の取得に失敗しました:', geoError);
      }
    }

    const headers = await buildAuthHeaders(true);
    const updateData = {
      status: 'in_progress',
      started_at: new Date().toISOString()
    };
    if (location) {
      updateData.start_location = location;
    }

    const response = await fetch(`${API_BASE}/schedules/${scheduleId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updateData)
    });

    if (!response.ok) throw new Error('作業開始に失敗しました');

    showSuccessMessage('作業を開始しました');

    setTimeout(() => window.location.reload(), 1000);

  } catch (error) {
    console.error('[OS Mypage] Start work error:', error);
    showErrorMessage('作業開始に失敗しました: ' + error.message);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '作業開始をつける';
    }
  }
}

// 作業終了
async function completeWork(scheduleId, hasReport, btn) {
  // レポート未作成のチェック
  if (!hasReport) {
    const goToReport = await showConfirmDialog('レポートが未作成です', '作業を終了する前に、本案件のレポート作成を完了してください。', 'レポート作成に進む', '閉じる');
    if (goToReport) {
      handleReportCreation(scheduleId);
    }
    return;
  }

  if (!confirm('作業を終了しますか？')) return;

  try {
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 終了中...';
    }

    const headers = await buildAuthHeaders(true);
    const updateData = {
      status: 'completed',
      completed_at: new Date().toISOString()
    };

    const response = await fetch(`${API_BASE}/schedules/${scheduleId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updateData)
    });

    if (!response.ok) throw new Error('作業終了に失敗しました');

    showSuccessMessage('作業を完了しました！お疲れ様でした。');
    setTimeout(() => window.location.reload(), 1500);

  } catch (error) {
    console.error('[OS Mypage] Complete work error:', error);
    showErrorMessage('作業終了に失敗しました: ' + error.message);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '作業終了';
    }
  }
}

/**
 * レポート作成フロー（サービス選択モーダル付き）
 */
async function handleReportCreation(scheduleId) {
  if (!scheduleId) return;

  try {
    const headers = await buildAuthHeaders();
    const response = await fetch(`${API_BASE}/schedules/${scheduleId}`, { headers });
    if (!response.ok) throw new Error('案件情報の取得に失敗しました');

    const schedule = await response.json();
    const serviceItems = schedule.service_items || schedule.service_names || [];

    if (serviceItems.length > 0) {
      const selected = await showServiceSelectionModal(scheduleId, serviceItems);
      if (selected) {
        window.location.href = `/staff/os/reports/new?schedule_id=${scheduleId}&services=${encodeURIComponent(selected.join(','))}`;
      }
    } else {
      window.location.href = `/staff/os/reports/new?schedule_id=${scheduleId}`;
    }
  } catch (err) {
    console.error('[ReportCreation] Error:', err);
    window.location.href = `/staff/os/reports/new?schedule_id=${scheduleId}`;
  }
}

/**
 * サービス内容選択モーダルを表示
 */
function showServiceSelectionModal(scheduleId, serviceItems) {
  return new Promise(resolve => {
    if (!serviceItems || serviceItems.length === 0) {
      resolve([]);
      return;
    }

    const items = serviceItems.map(item => {
      const name = typeof item === 'object' ? item.name : item;
      return { id: name, name: name };
    });

    const modalHTML = `
      <div id="service-selection-modal" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:20000;display:flex;align-items:center;justify-content:center;padding:20px;">
        <div style="background:white;padding:24px;border-radius:16px;max-width:440px;width:100%;box-shadow:0 10px 30px rgba(0,0,0,0.3);">
          <h3 style="margin-top:0;font-size:1.25rem;color:#111827;display:flex;align-items:center;gap:10px;">
            <i class="fas fa-tasks" style="color:#ff679c;"></i>
            担当サービスの選択
          </h3>
          <p style="font-size:0.875rem;color:#6b7280;margin:8px 0 20px;">本日の案件のうち、あなたが担当する項目をすべて選択してください。</p>
          <div style="max-height:300px;overflow-y:auto;display:grid;gap:10px;margin-bottom:24px;">
            ${items.map(item => `
              <label style="display:flex;align-items:center;gap:12px;padding:12px;border:1px solid #e5e7eb;border-radius:10px;cursor:pointer;transition:all 0.2s;" onmouseover="this.style.background='#fff7f9'" onmouseout="this.style.background='white'">
                <input type="checkbox" name="service-item" value="${escapeHtml(item.name)}" style="width:20px;height:20px;accent-color:#ff679c;">
                <span style="font-weight:600;color:#374151;">${escapeHtml(item.name)}</span>
              </label>
            `).join('')}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <button id="service-cancel-btn" style="background:#f3f4f6;color:#374151;border:none;padding:12px;border-radius:8px;font-weight:700;cursor:pointer;">キャンセル</button>
            <button id="service-confirm-btn" style="background:#ff679c;color:white;border:none;padding:12px;border-radius:8px;font-weight:700;cursor:pointer;">作成に進む</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = document.getElementById('service-selection-modal');

    modal.querySelector('#service-confirm-btn').onclick = () => {
      const selected = Array.from(modal.querySelectorAll('input[name="service-item"]:checked')).map(i => i.value);
      if (selected.length === 0) {
        alert('少なくとも1つの項目を選択してください。');
        return;
      }
      modal.remove();
      resolve(selected);
    };

    modal.querySelector('#service-cancel-btn').onclick = () => {
      modal.remove();
      resolve(null);
    };
  });
}

/**
 * クイックメニューからのレポート作成制御（強化版）
 */
async function handleQuickReportClick(event) {
  event.preventDefault();

  // 現在作業中の案件セクションを確認
  const nextScheduleSection = document.getElementById('schedule-info-content');
  const workingBadge = nextScheduleSection?.querySelector('.fa-play-circle');

  // 作業チェック（ブロック）を削除
  // if (!workingBadge) { ... }

  // 作業中ボタン（レポート作成）からscheduleIdを取得
  const reportBtn = nextScheduleSection.querySelector('button[onclick*="handleReportCreation"]');
  let scheduleId = null;
  if (reportBtn) {
    const onclick = reportBtn.getAttribute('onclick');
    const match = onclick.match(/handleReportCreation\('([^']+)'\)/);
    if (match) scheduleId = match[1];
  }

  if (scheduleId) {
    handleReportCreation(scheduleId);
  } else {
    window.location.href = '/staff/os/reports/new';
  }
}

// グローバル関数として公開
window.toggleTodo = toggleTodo;
window.addTodo = addTodo;
window.deleteTodo = deleteTodo;
window.updateTodoText = updateTodoText;
window.acceptSchedule = acceptSchedule;
window.startWork = startWork;

// アコーディオン機能は削除されました

// サービス一覧（キャッシュ用）
let masterServices = [];

async function getMasterServices() {
  if (masterServices.length > 0) return masterServices;
  try {
    const res = await fetch(`${API_BASE}/services`);
    if (res.ok) {
      const json = await res.json();
      masterServices = Array.isArray(json) ? json : (json.items || []);
    }
  } catch (e) { console.error('Failed to load services', e); }
  return masterServices;
}

async function showAddServiceModal(scheduleId) {
  const services = await getMasterServices();

  // 現在のスケジュール情報を再取得（最新のサービス状況を知るため）
  const schedule = scheduleById[scheduleId]; // キャッシュ利用
  if (!schedule) return;

  // 現在選択済みのIDリスト
  const currentServiceItems = schedule.service_items || [];
  const currentIds = new Set();
  const currentNames = new Set();

  currentServiceItems.forEach(item => {
    if (typeof item === 'object' && item.id) currentIds.add(String(item.id));
    if (typeof item === 'object' && item.name) currentNames.add(item.name);
    if (typeof item === 'string') currentNames.add(item);
  });

  // モーダル生成
  const modalId = 'add-service-modal';
  let modal = document.getElementById(modalId);
  if (!modal) {
    modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'custom-modal'; // 既存のモーダルクラス利用
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center;';

    modal.innerHTML = `
            <div class="custom-modal-content" style="background: white; border-radius: 8px; width: 90%; max-width: 400px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); display: flex; flex-direction: column; max-height: 80vh;">
                <div class="custom-modal-header" style="padding: 16px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin:0; font-size:1.1rem;">清掃項目の追加</h3>
                    <button class="close-btn" onclick="closeAddServiceModal()" style="background:none; border:none; font-size:1.5rem; cursor:pointer;">&times;</button>
                </div>
                <div class="custom-modal-body" style="overflow-y: auto; padding: 16px;">
                    <input type="text" id="service-search-input" placeholder="項目を検索..." style="width: 100%; padding: 8px; margin-bottom: 12px; border: 1px solid #d1d5db; border-radius: 4px;">
                    <div id="service-list-container" style="display: flex; flex-direction: column; gap: 8px;"></div>
                </div>
                <div class="custom-modal-footer" style="padding: 16px; border-top: 1px solid #e5e7eb; text-align: right;">
                    <button class="btn-cancel" onclick="closeAddServiceModal()" style="padding: 8px 16px; border: 1px solid #d1d5db; background: white; border-radius: 4px;">キャンセル</button>
                </div>
            </div>
        `;
    document.body.appendChild(modal);
  }

  // リスト描画関数
  const renderList = (filterText = '') => {
    const container = document.getElementById('service-list-container');
    container.innerHTML = '';
    const filtered = services.filter(s => {
      const name = s.title || s.name || '';
      // 既に選択済みのものは除外
      if (currentIds.has(String(s.id))) return false;
      if (currentNames.has(name)) return false;
      return name.toLowerCase().includes(filterText.toLowerCase());
    });

    if (filtered.length === 0) {
      container.innerHTML = '<div style="color: #9ca3af; text-align: center;">該当する項目がありません</div>';
      return;
    }

    filtered.forEach(s => {
      const div = document.createElement('div');
      div.style.cssText = 'padding: 10px; border: 1px solid #e5e7eb; border-radius: 4px; cursor: pointer; display: flex; justify-content: space-between; align-items: center;';
      div.innerHTML = `<span>${escapeHtml(s.title || s.name)}</span><i class="fas fa-plus-circle" style="color: #10b981;"></i>`;
      div.onclick = () => addServiceToSchedule(scheduleId, s);
      container.appendChild(div);
    });
  };

  renderList();

  // 検索イベント
  const searchInput = document.getElementById('service-search-input');
  searchInput.oninput = (e) => renderList(e.target.value);
  searchInput.value = '';

  modal.style.display = 'flex';
}

function closeAddServiceModal() {
  const modal = document.getElementById('add-service-modal');
  if (modal) modal.style.display = 'none';
}

async function addServiceToSchedule(scheduleId, service) {
  if (!confirm(`${service.title || service.name} を追加しますか？`)) return;

  try {
    const schedule = scheduleById[scheduleId];
    if (!schedule) throw new Error('Schedule not found');

    const currentItems = schedule.service_items || [];
    const newItem = { id: service.id, name: service.title || service.name };
    const newItems = [...currentItems, newItem];

    // ローカル更新（即時反映のため）
    schedule.service_items = newItems;
    schedule.service_names = newItems.map(i => i.name);

    // API更新 (PUT)
    const idToken = await getCognitoIdToken();
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    };

    const updateBody = {
      ...schedule,
      service_items: newItems
    };

    const res = await fetch(`${API_BASE}/schedules/${scheduleId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updateBody)
    });

    if (res.ok) {
      closeAddServiceModal();
      loadOSNextSchedule();
    } else {
      console.error('Update failed', await res.json());
      alert('更新に失敗しました。');
      loadOSNextSchedule();
    }
  } catch (e) {
    console.error(e);
    alert('エラーが発生しました');
  }
}
window.showAddServiceModal = showAddServiceModal;
window.closeAddServiceModal = closeAddServiceModal;
