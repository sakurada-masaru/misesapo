const API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';
const REPORT_API = 'https://2z0ui5xfxb.execute-api.ap-northeast-1.amazonaws.com/prod';
let currentUser = null;
let attendanceRecords = {};
let currentCalendarDate = new Date();

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

// 現在のユーザー情報を取得
async function loadCurrentUser() {
  const loadingEl = document.getElementById('loading');
  const contentEl = document.getElementById('mypage-content');
  const errorEl = document.getElementById('error-message');

  try {
    loadingEl.style.display = 'block';
    contentEl.style.display = 'none';
    errorEl.style.display = 'none';

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
      throw new Error('ログインしてください。');
    }
    
    // ユーザー情報を取得（AWS APIを優先、ローカルJSONはフォールバック）
    try {
      // キャッシュを無効化するためにタイムスタンプを追加
      const timestamp = new Date().getTime();
      
      // まずAWS APIから最新データを取得
      let response = null;
      let urlParamId = userId; // URLパラメータのIDを保存
      
      if (userId) {
        // IDで取得を試みる（キャッシュ無効化）
        response = await fetch(`${API_BASE}/workers/${userId}?t=${timestamp}&_=${Date.now()}`, {
          cache: 'no-store'
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
                cache: 'no-store'
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
            cache: 'no-store'
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
      
      // まだ見つからない場合、Cognito SubまたはFirebase UIDで検索
      if (!currentUser || !currentUser.id) {
        let fallbackResponse = null;
        
        // Cognito Subで検索
        if (window.CognitoAuth) {
          const cognitoUser = await window.CognitoAuth.getCurrentUser();
          if (cognitoUser && cognitoUser.cognito_sub) {
            fallbackResponse = await fetch(`${API_BASE}/workers?cognito_sub=${encodeURIComponent(cognitoUser.cognito_sub)}&t=${timestamp}&_=${Date.now()}`, {
              cache: 'no-store'
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
      throw new Error('ユーザー情報を取得できませんでした。ログインしてください。');
    }

    console.log('User loaded:', currentUser);

    // ロールを変換
    if (currentUser.role_code !== undefined) {
      currentUser.role = getRoleFromCode(currentUser.role_code);
    }

    // 出退勤記録を読み込み（非同期）
    await loadAttendanceRecords();

    // ユーザー情報を表示
    renderUser(currentUser);

    // スケジュールと業務連絡を読み込み
    loadWeeklySchedule();
    loadAnnouncements();
    loadDailyReports();

    // カレンダーを表示
    renderCalendar();
    
    loadingEl.style.display = 'none';
    contentEl.style.display = 'flex';
    
    console.log('Content displayed, checking button...');
    console.log('Button element:', document.getElementById('attendance-toggle-btn'));
    console.log('Content element display:', window.getComputedStyle(contentEl).display);
    
    // コンテナの配置を復元（コンテンツ表示後）
    setTimeout(() => {
      restoreSectionLayout();
    }, 100);
    
    // 出退勤ボタンのイベントリスナーを再設定（コンテンツ表示後）
    // 少し遅延を入れてDOMが完全にレンダリングされるのを待つ
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
    }, 100);
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
  
  // サイドバーのロールバッジを更新
  const roleBadge = document.getElementById('sidebar-role-badge');
  if (roleBadge && user.department) {
    roleBadge.textContent = user.department;
  }
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
    const response = await fetch(`${API_BASE}/attendance?staff_id=${currentUser.id}&date=${today}`, {
      // 404エラーを抑制するために、エラーハンドリングを改善
      // ただし、ブラウザのコンソールには自動的に表示される可能性がある
    }).catch(() => null);
    
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
          staff_name: record.staff_name || currentUser.name
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
  
  renderAttendanceStatus();
  calculateMonthlyStats();
}

// 出退勤ステータスを表示
function renderAttendanceStatus() {
  if (!currentUser) return;
  
  const today = new Date().toISOString().split('T')[0];
  const todayRecord = attendanceRecords[today]?.[currentUser.id];
  
  const statusIndicator = document.getElementById('status-indicator');
  const statusLabel = document.getElementById('status-label');
  const statusTime = document.getElementById('status-time');
  const toggleBtn = document.getElementById('attendance-toggle-btn');
  const toggleBtnText = document.getElementById('toggle-btn-text');
  
  if (todayRecord && todayRecord.clock_in && !todayRecord.clock_out) {
    // 出勤中
    statusIndicator.className = 'status-indicator working';
    statusLabel.textContent = '出勤中';
    statusTime.textContent = formatTime(todayRecord.clock_in);
    toggleBtnText.textContent = '退勤';
    toggleBtn.classList.remove('btn-clock-in');
    toggleBtn.classList.add('btn-clock-out');
    toggleBtn.querySelector('i').className = 'fas fa-sign-out-alt';
  } else if (todayRecord && todayRecord.clock_out) {
    // 退勤済み
    statusIndicator.className = 'status-indicator';
    statusLabel.textContent = '退勤済み';
    
    // 労働時間を表示
    const workHours = todayRecord.work_hours || calculateWorkHours(todayRecord.clock_in, todayRecord.clock_out, todayRecord.breaks || []);
    statusTime.textContent = workHours ? formatWorkHours(workHours) : '--:--';
    
    toggleBtnText.textContent = '出勤';
    toggleBtn.classList.remove('btn-clock-out');
    toggleBtn.classList.add('btn-clock-in');
    toggleBtn.querySelector('i').className = 'fas fa-sign-in-alt';
  } else {
    // 未出勤
    statusIndicator.className = 'status-indicator';
    statusLabel.textContent = '未出勤';
    statusTime.textContent = '--:--';
    toggleBtnText.textContent = '出勤';
    toggleBtn.classList.remove('btn-clock-out');
    toggleBtn.classList.add('btn-clock-in');
    toggleBtn.querySelector('i').className = 'fas fa-sign-in-alt';
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
  
  document.getElementById('monthly-work-days').textContent = `${workDays}日`;
  document.getElementById('monthly-work-hours').textContent = formatWorkHours(totalHours);
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
    console.error('Attendance toggle button not found!');
    console.error('Available elements:', {
      mypageContent: document.getElementById('mypage-content'),
      attendanceCard: document.querySelector('.attendance-card'),
      attendanceToday: document.querySelector('.attendance-today')
    });
    return;
  }
  
  console.log('Setting up attendance toggle button:', toggleBtn);
  
  // 既存のイベントリスナーを削除（重複防止）
  const newToggleBtn = toggleBtn.cloneNode(true);
  toggleBtn.parentNode.replaceChild(newToggleBtn, toggleBtn);
  
  newToggleBtn.addEventListener('click', async () => {
  if (!currentUser) return;
  
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
      return;
    }
    
    // 確認ダイアログを表示
    const currentTime = formatTimeForDialog(now);
    const message = `現在時刻: ${currentTime}\n\n出勤を記録しますか？`;
    shouldProceed = await showConfirmDialog('出勤を記録しますか？', message, '出勤する', 'キャンセル');
    
    if (!shouldProceed) {
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
      return;
    }
    
    // 出退勤時刻の整合性チェック
    const consistencyValidation = validateAttendanceTimes(todayRecord.clock_in, now);
    if (!consistencyValidation.valid) {
      showErrorMessage(consistencyValidation.message);
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
      return;
    }
    
    attendanceData = {
      staff_id: currentUser.id,
      staff_name: currentUser.name,
      date: today,
      clock_in: todayRecord.clock_in,
      clock_out: now
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
      return;
    }
    
    // 確認ダイアログを表示
    const currentTime = formatTimeForDialog(now);
    const message = `現在時刻: ${currentTime}\n\n再出勤を記録しますか？\n（退勤後の再出勤は別記録として扱われます）`;
    shouldProceed = await showConfirmDialog('再出勤を記録しますか？', message, '再出勤する', 'キャンセル');
    
    if (!shouldProceed) {
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
    const response = await fetch(`${API_BASE}/attendance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(attendanceData)
    });
    
    if (response.ok) {
      const result = await response.json();
      // 成功メッセージを表示（オプション）
      showSuccessMessage('出退勤記録を保存しました');
      
      // ローカルストレージにも保存（オフライン対応）
      localStorage.setItem('attendanceRecords', JSON.stringify(attendanceRecords));
      renderAttendanceStatus();
      calculateMonthlyStats();
      renderCalendar();
    } else {
      // エラーレスポンスを解析
      let errorMessage = '出退勤記録の保存に失敗しました';
      let errorCode = 'UNKNOWN_ERROR';
      
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
        errorCode = errorData.code || errorCode;
        
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
        // JSON解析に失敗した場合
        errorMessage = `サーバーエラー (${response.status}): ${response.statusText}`;
      }
      
      // ネットワークエラー以外の場合は、ローカルストレージに保存を試みる
      if (response.status >= 500) {
        // サーバーエラーの場合はローカルストレージに保存
        localStorage.setItem('attendanceRecords', JSON.stringify(attendanceRecords));
        renderAttendanceStatus();
        calculateMonthlyStats();
        renderCalendar();
        showWarningMessage('APIへの保存に失敗しましたが、ローカルストレージに保存しました。後で同期してください。');
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
  }
  });
}

// 週間スケジュールを読み込み
async function loadWeeklySchedule() {
  if (!currentUser) return;
  
  try {
    // TODO: APIからスケジュールを取得
    const scheduleEl = document.getElementById('weekly-schedule');
    scheduleEl.innerHTML = '<div class="empty-state">今週の予定はありません</div>';
  } catch (error) {
    console.error('Error loading schedule:', error);
  }
}

// 業務連絡を読み込み
async function loadAnnouncements() {
  if (!currentUser) return;
  
  try {
    const idToken = await getCognitoIdToken();
    if (!idToken) {
      console.warn('[Announcements] No ID token available');
      renderAnnouncements([]);
      return;
    }
    
    const response = await fetch(`${REPORT_API}/staff/announcements`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${idToken}`
      }
    }).catch((err) => {
      console.warn('[Announcements] Fetch error:', err);
      return null;
    });
    
    if (response && response.ok) {
      const data = await response.json();
      const announcements = data.announcements || [];
      renderAnnouncements(announcements);
    } else {
      // 401エラーやその他のエラーは正常（認証が必要な場合やAPIが実装されていない場合）
      // 空のリストを表示（エラーログは出力しない）
      renderAnnouncements([]);
    }
  } catch (error) {
    // ネットワークエラーなどの場合のみ警告を出力（401は除外）
    if (error && error.message && !error.message.includes('401')) {
      console.warn('[Announcements] Error:', error);
    }
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
  }
  
  // 今日の日報を読み込む
  loadTodayDailyReport();
  
  // イベントリスナーを設定
  setupDailyReportListeners();
}

// 今日の日報を読み込む
async function loadTodayDailyReport() {
  if (!currentUser) return;
  
  const today = new Date().toISOString().split('T')[0];
  const storageKey = `daily_report_${currentUser.id}_${today}`;
  
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const data = JSON.parse(saved);
      const textarea = document.getElementById('daily-report-content');
      if (textarea) {
        textarea.value = data.content || '';
        // クリアボタンを表示
        const clearBtn = document.getElementById('daily-report-clear-btn');
        if (clearBtn && textarea.value.trim()) {
          clearBtn.style.display = 'inline-flex';
        }
      }
    }
  } catch (error) {
    console.error('Error loading today daily report:', error);
  }
}

// 日報のイベントリスナーを設定
// デジタル時計機能
let clockFormat24 = true; // true: 24時間表示, false: 12時間表示
let alarmTime = null;
let alarmEnabled = false;

function setupDigitalClock() {
  const clockDisplay = document.getElementById('digital-clock-display');
  const clockDate = document.getElementById('digital-clock-date');
  const formatToggle = document.getElementById('clock-format-toggle');
  const alarmSetBtn = document.getElementById('alarm-set-btn');
  const alarmToggleBtn = document.getElementById('alarm-toggle-btn');
  const alarmSection = document.getElementById('digital-clock-alarm-section');
  const alarmTimeDisplay = document.getElementById('alarm-time-display');
  
  if (!clockDisplay || !clockDate) return;
  
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
    
    // 日付の表示
    const dateStr = now.toLocaleDateString('ja-JP', {
      month: 'long',
      day: 'numeric',
      weekday: 'short'
    });
    clockDate.textContent = dateStr;
    
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
      audio.play().catch(() => {});
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
  
  if (saveBtn) {
    saveBtn.addEventListener('click', saveDailyReport);
  }
  
  if (clearBtn) {
    clearBtn.addEventListener('click', clearDailyReport);
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

// 日報を保存
async function saveDailyReport() {
  if (!currentUser) return;
  
  const textarea = document.getElementById('daily-report-content');
  const todayDateEl = document.getElementById('daily-report-today-date');
  
  if (!textarea) return;
  
  const content = textarea.value.trim();
  const date = todayDateEl?.dataset.date || new Date().toISOString().split('T')[0];
  const storageKey = `daily_report_${currentUser.id}_${date}`;
  
  const data = {
    content: content,
    staff_id: currentUser.id,
    staff_name: currentUser.name,
    date: date,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  try {
    // localStorageに保存
    localStorage.setItem(storageKey, JSON.stringify(data));
    
    // TODO: APIに保存（将来的に実装）
    // const idToken = await getCognitoIdToken();
    // await fetch(`${API_BASE}/daily-reports`, {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${idToken}`,
    //     'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify(data)
    // });
    
    showSuccessMessage('日報を保存しました');
    
    // クリアボタンを表示
    const clearBtn = document.getElementById('daily-report-clear-btn');
    if (clearBtn && content) {
      clearBtn.style.display = 'inline-flex';
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

// Cognito ID Token取得（従業員認証用）
async function getCognitoIdToken() {
  try {
    // 1. localStorageから直接取得
    const cognitoIdToken = localStorage.getItem('cognito_id_token');
    if (cognitoIdToken) {
      return cognitoIdToken;
    }
    
    // 2. CognitoAuthから取得
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
    
    // 3. cognito_userから取得
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
    
    // 4. misesapo_authから取得
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
    
    return 'mock-token';
  } catch (error) {
    console.error('Error getting Cognito ID token:', error);
    return 'mock-token';
  }
}


// カレンダーを表示
function renderCalendar() {
  const year = currentCalendarDate.getFullYear();
  const month = currentCalendarDate.getMonth();
  
  document.getElementById('calendar-title').textContent = `${year} ${month + 1}`;
  
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - startDate.getDay());
  
  const grid = document.getElementById('calendar-grid');
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
      
      // 出退勤記録があるかチェック
      if (currentUser && attendanceRecords[dateStr]?.[currentUser.id]) {
        cell.classList.add('has-attendance');
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

function loadTodos() {
  try {
    const userId = currentUser?.id || 'default';
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

function addTodo(text) {
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
}

function toggleTodo(id) {
  const todo = todos.find(t => t.id === id);
  if (todo) {
    todo.completed = !todo.completed;
    saveTodos();
    renderTodos();
  }
}

function deleteTodo(id) {
  todos = todos.filter(t => t.id !== id);
  saveTodos();
  renderTodos();
}

function updateTodoText(id, newText) {
  const todo = todos.find(t => t.id === id);
  if (todo && newText.trim()) {
    todo.text = newText.trim();
    saveTodos();
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
        <div class="todo-checkbox" onclick="toggleTodo('${todo.id}')">
          ${todo.completed ? '<i class="fas fa-check"></i>' : ''}
        </div>
        <input type="text" class="todo-text-input" value="${escapeHtml(todo.text)}" 
               onblur="updateTodoText('${todo.id}', this.value)"
               onkeypress="if(event.key==='Enter') this.blur()">
        <button class="todo-delete" onclick="deleteTodo('${todo.id}')">
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
}

// ドラッグ&ドロップ機能
let editMode = false;
let draggedElement = null;
let dragOffset = { x: 0, y: 0 };
// グリッド位置のキャッシュ（パフォーマンス向上のため）
let gridPositionCache = null;
let gridPositionCacheTimestamp = 0;
const GRID_CACHE_DURATION = 100; // キャッシュの有効期限（ms）

// コンテナのドラッグ開始ハンドラ（グローバルスコープで定義）
function handleContainerDragStart(e) {
  if (!editMode) {
    e.preventDefault();
    return false;
  }
  
  // ドラッグハンドルまたはコンテナ自体からドラッグを開始できるようにする
  let container = e.currentTarget;
  
  // ドラッグハンドルからドラッグを開始した場合、親のコンテナを取得
  if (container.classList.contains('drag-handle') || container.closest('.drag-handle')) {
    container = container.closest('.draggable-container');
  }
  
  // コンテナが見つからない、またはdraggableでない場合は中止
  if (!container || !container.classList.contains('draggable-container') || !container.draggable) {
    e.preventDefault();
    console.log('[Drag] Drag start prevented - container:', container, 'draggable:', container?.draggable);
    return false;
  }
  
  console.log('[Drag] Drag start:', container.dataset.containerId, 'draggable:', container.draggable);
  
  draggedElement = container;
  draggedElement.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', container.dataset.containerId || '');
  
  // ドラッグ中のサイズを保存（サイズを維持するため）
  const rect = draggedElement.getBoundingClientRect();
  draggedElement.style.setProperty('--dragging-width', `${rect.width}px`);
  draggedElement.style.setProperty('--dragging-height', `${rect.height}px`);
  
  // コンテナの左上からのマウスオフセットを保存
  // グリッド線に合わせるため、オフセットを調整
  const CELL_SIZE = 80;
  const offsetX = e.clientX - rect.left;
  const offsetY = e.clientY - rect.top;
  
  // オフセットをグリッド線内の相対位置に調整（0-80pxの範囲）
  dragOffset.x = offsetX % CELL_SIZE;
  dragOffset.y = offsetY % CELL_SIZE;
  
  console.log('[Drag] Drag offset calculated:', dragOffset.x, dragOffset.y, 'from:', offsetX, offsetY);
  
  return true;
}

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

// 編集モードの切り替え
function toggleEditMode() {
  console.log('[EditMode] toggleEditMode called, current editMode:', editMode);
  editMode = !editMode;
  console.log('[EditMode] New editMode:', editMode);
  
  const grid = document.getElementById('mypage-grid');
  const container = document.querySelector('.mypage-main-grid-container');
  const toggleBtn = document.getElementById('edit-mode-toggle');
  
  if (!toggleBtn) {
    console.error('[EditMode] Edit mode toggle button not found');
    return;
  }
  
  if (editMode) {
    console.log('[EditMode] Enabling edit mode');
    // 編集モード開始時にキャッシュをクリア
    clearGridPositionCache();
    if (grid) grid.classList.add('edit-mode');
    if (container) container.classList.add('edit-mode');
    toggleBtn.classList.add('active');
    const span = toggleBtn.querySelector('span');
    if (span) span.textContent = '編集モード ON';
    
    // 既存の位置スタイルをクリア（異常な値が適用されている可能性があるため）
    if (grid) {
      grid.querySelectorAll('.draggable-container').forEach(container => {
        const left = parseInt(container.style.left) || 0;
        const top = parseInt(container.style.top) || 0;
        // 異常な値が検出された場合はスタイルをクリア
        if (isNaN(left) || isNaN(top) || !isFinite(left) || !isFinite(top) ||
            Math.abs(left) > 100000 || Math.abs(top) > 100000) {
          console.warn('[EditMode] Clearing invalid position for container:', container.dataset.containerId);
          container.style.removeProperty('left');
          container.style.removeProperty('top');
          container.dataset.absolutePosition = '';
        }
      });
    }
    
    // 保存されたレイアウトを検証してから復元
    setTimeout(() => {
      restoreSectionLayout();
      
      // メイングリッド内のコンテナのみドラッグ可能に
      if (grid) {
        grid.querySelectorAll('.draggable-container').forEach(container => {
          // draggable属性とプロパティの両方を設定
          container.setAttribute('draggable', 'true');
          container.draggable = true;
          // コンテナ全体にドラッグイベントを設定
          container.style.cursor = 'move';
          console.log('[Drag] Set draggable=true for:', container.dataset.containerId, 'actual draggable:', container.draggable, 'attribute:', container.getAttribute('draggable'));
          // ドラッグハンドルをクリック可能にする
          const dragHandle = container.querySelector('.drag-handle');
          if (dragHandle) {
            dragHandle.style.cursor = 'move';
            // ドラッグハンドルにもdraggableを設定（親コンテナのドラッグを開始）
            dragHandle.setAttribute('draggable', 'true');
            dragHandle.draggable = true;
          }
        });
        // イベントリスナーを再設定
        setTimeout(() => {
          if (window.attachDragListeners) {
            window.attachDragListeners();
          }
        }, 50);
      }
      // グリッド線を描画
      setTimeout(() => {
        drawGridLines();
      }, 100);
    }, 50);
  } else {
    // 編集モード終了時に現在の位置を保存
    saveSectionLayout();
    
    if (grid) grid.classList.remove('edit-mode');
    if (container) container.classList.remove('edit-mode');
    toggleBtn.classList.remove('active');
    const span = toggleBtn.querySelector('span');
    if (span) span.textContent = '編集モード';
    // すべてのコンテナをドラッグ不可に
    document.querySelectorAll('.draggable-container').forEach(container => {
      container.draggable = false;
      container.classList.remove('dragging', 'drag-over');
    });
    // グリッド線を削除
    const overlay = container?.querySelector('.grid-lines-overlay');
    if (overlay) overlay.remove();
  }
}

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
    return {
      id: container.dataset.containerId,
      cost: parseInt(container.dataset.containerCost) || 1,
      position: pos ? `${pos.x},${pos.y}` : null
    };
  });
  localStorage.setItem('mypage_section_layout', JSON.stringify(layout));
}

// コンテナの配置を復元
function restoreSectionLayout() {
  try {
    const grid = document.getElementById('mypage-grid');
    if (!grid) {
      console.warn('Grid not found, retrying...');
      setTimeout(restoreSectionLayout, 100);
      return;
    }
    
    const savedLayout = localStorage.getItem('mypage_section_layout');
    if (!savedLayout) {
      // デフォルト配置を適用
      applyDefaultLayout();
      return;
    }
    
    const layout = JSON.parse(savedLayout);
    
    // コンテナが読み込まれるまで待つ
    const containers = grid.querySelectorAll('.draggable-container');
    if (containers.length === 0) {
      console.warn('Containers not found, retrying...');
      setTimeout(restoreSectionLayout, 100);
      return;
    }
    
    const gridWidth = grid.offsetWidth;
    const gridHeight = grid.offsetHeight;
    let hasInvalidPosition = false;
    
    layout.forEach(item => {
      const container = grid.querySelector(`[data-container-id="${item.id}"]`);
      if (container && item.position) {
        // 旧形式（col,row）と新形式（x,y）の両方に対応
        const parts = item.position.split(',').map(Number);
        if (parts.length === 2) {
          // 異常な値（NaN、無限大、極端に大きい/小さい値）をチェック
          if (isNaN(parts[0]) || isNaN(parts[1]) || 
              !isFinite(parts[0]) || !isFinite(parts[1]) ||
              Math.abs(parts[0]) > 100000 || Math.abs(parts[1]) > 100000) {
            console.warn('[Layout] Invalid position data for container:', item.id, 'position:', item.position);
            hasInvalidPosition = true;
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
              setAbsolutePosition(container, parts[0], parts[1]);
            } else {
              console.warn('[Layout] Position out of bounds for container:', item.id, 'x:', parts[0], 'y:', parts[1]);
              hasInvalidPosition = true;
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
    'announcements': { x: 240, y: 0 },         // 業務連絡: 3×3マス
    'basic-info': { x: 480, y: 0 },            // 基本情報: 3×3マス
    'weekly-schedule': { x: 720, y: 0 },       // 今週のスケジュール: 3×3マス
    'digital-clock': { x: 960, y: 0 },         // デジタル時計: 3×3マス
    'todo': { x: 0, y: 240 },                  // TODOリスト: 3×3マス
    'calendar': { x: 240, y: 240 },            // カレンダー: 3×3マス
    'daily-reports': { x: 480, y: 240 }        // 日報: 3×3マス
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
  const gridWidth = grid.offsetWidth;
  const gridHeight = grid.offsetHeight;
  
  // グリッドの交点（アンカー）を計算
  const anchors = [];
  const maxCols = Math.ceil(gridWidth / CELL_SIZE);
  const maxRows = Math.ceil(gridHeight / CELL_SIZE);
  
  for (let row = 0; row <= maxRows; row++) {
    for (let col = 0; col <= maxCols; col++) {
      const x = col * CELL_SIZE;
      const y = row * CELL_SIZE;
      // グリッド範囲内のアンカーのみ追加
      if (x <= gridWidth && y <= gridHeight) {
        anchors.push({ x, y });
      }
    }
  }
  
  gridAnchors = anchors;
  gridAnchorsCacheTimestamp = now;
  
  console.log('[Grid] Calculated grid anchors:', anchors.length, 'anchors');
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

// すべてのコンテナにドラッグイベントリスナーを設定
function attachDragListeners() {
  const grid = document.getElementById('mypage-grid');
  if (!grid) return;
  
  grid.querySelectorAll('.draggable-container').forEach(container => {
    // 既存のリスナーを削除（重複を防ぐ）
    container.removeEventListener('dragstart', handleContainerDragStart);
    // 新しいリスナーを追加
    container.addEventListener('dragstart', handleContainerDragStart);
    
    // ドラッグハンドルにもイベントリスナーを追加
    const dragHandle = container.querySelector('.drag-handle');
    if (dragHandle) {
      dragHandle.removeEventListener('dragstart', handleContainerDragStart);
      dragHandle.addEventListener('dragstart', handleContainerDragStart);
    }
    
    console.log('[Drag] Attached listener to:', container.dataset.containerId, 'draggable:', container.draggable);
  });
}

// ドラッグ&ドロップイベントの設定
function setupDragAndDrop() {
  const grid = document.getElementById('mypage-grid');
  if (!grid) return;

  // 初回設定
  attachDragListeners();
  
  // グローバルに公開（編集モード切り替え時に呼び出せるように）
  window.attachDragListeners = attachDragListeners;

  grid.addEventListener('dragend', (e) => {
    if (!editMode) return;
    
    console.log('[Drag] Drag end event fired');
    
    // プレビューガイドを削除
    hideDropPreview(grid);
    
    if (draggedElement) {
      // ドラッグ終了時の位置を取得して更新（dropイベントが発火しない場合のフォールバック）
      const lastPreview = grid.querySelector('.drop-preview-guide');
      if (lastPreview) {
        const previewX = parseInt(lastPreview.style.left) || 0;
        const previewY = parseInt(lastPreview.style.top) || 0;
        console.log('[Drag] Using preview position from dragend:', previewX, previewY);
        setAbsolutePosition(draggedElement, previewX, previewY);
        saveSectionLayout();
      }
      
      draggedElement.classList.remove('dragging');
      // ドラッグ中のサイズスタイルを削除
      draggedElement.style.removeProperty('--dragging-width');
      draggedElement.style.removeProperty('--dragging-height');
      draggedElement = null;
    }
    dragOffset = { x: 0, y: 0 };
    // すべてのコンテナからdrag-overクラスを削除
    grid.querySelectorAll('.draggable-container').forEach(container => {
      container.classList.remove('drag-over', 'drag-preview');
    });
  });

  // dragoverイベントをdocumentレベルで監視（コンテナの上でも発火するように）
  document.addEventListener('dragover', (e) => {
    // 常にpreventDefaultを呼ぶ（ドロップを許可するため）
    e.preventDefault();
    e.stopPropagation();
    
    if (!editMode || !draggedElement) {
      return;
    }
    
    // グリッドの範囲内かどうかをマウス位置で判定
    const gridRect = grid.getBoundingClientRect();
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    
    // マウスがグリッドの範囲外の場合は処理しない
    if (mouseX < gridRect.left || mouseX > gridRect.right ||
        mouseY < gridRect.top || mouseY > gridRect.bottom) {
      hideDropPreview(grid);
      return;
    }
    
    e.dataTransfer.dropEffect = 'move';
    
    // コンテナの左上の位置を計算（マウス位置からオフセットを引く）
    const containerLeftX = mouseX - dragOffset.x;
    const containerTopY = mouseY - dragOffset.y;
    const { x, y } = getAbsolutePositionFromMouse(grid, containerLeftX, containerTopY);
    
    // プレビューガイドを常に表示（位置が有効かどうかに関係なく）
    showDropPreviewAbsolute(grid, draggedElement, x, y);
    
    // 有効な位置かチェック（視覚的なフィードバック用）
    const isValid = isValidAbsolutePosition(grid, draggedElement, x, y);
    const preview = grid.querySelector('.drop-preview-guide');
    if (preview) {
      if (isValid) {
        preview.style.borderColor = 'rgba(16, 185, 129, 0.8)'; // 緑色（有効）
        preview.style.background = 'rgba(16, 185, 129, 0.1)';
      } else {
        preview.style.borderColor = 'rgba(239, 68, 68, 0.8)'; // 赤色（無効）
        preview.style.background = 'rgba(239, 68, 68, 0.1)';
      }
    }
    
    // 他のコンテナからdrag-overクラスを削除
    grid.querySelectorAll('.draggable-container').forEach(container => {
      if (container !== draggedElement) {
        container.classList.remove('drag-over');
      }
    });
  });

  // dropイベントもdocumentレベルで監視
  document.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('[Drag] Drop event fired on document');
    
    if (!editMode || !draggedElement) {
      console.log('[Drag] Drop ignored - editMode:', editMode, 'draggedElement:', draggedElement);
      return;
    }
    
    // グリッドの範囲内かどうかをマウス位置で判定
    const gridRect = grid.getBoundingClientRect();
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    
    console.log('[Drag] Drop position - mouseX:', mouseX, 'mouseY:', mouseY, 'gridRect:', gridRect);
    
    // マウスがグリッドの範囲外の場合は処理しない
    if (mouseX < gridRect.left || mouseX > gridRect.right ||
        mouseY < gridRect.top || mouseY > gridRect.bottom) {
      console.log('[Drag] Drop outside grid bounds');
      hideDropPreview(grid);
      return;
    }
    
    console.log('[Drag] Drop event processed');
    
    // プレビューガイドを削除
    hideDropPreview(grid);
    
    // コンテナの左上の位置を計算（マウス位置からオフセットを引く）
    const containerLeftX = mouseX - dragOffset.x;
    const containerTopY = mouseY - dragOffset.y;
    const { x, y } = getAbsolutePositionFromMouse(grid, containerLeftX, containerTopY);
    
    console.log('[Drag] Drop position - x:', x, 'y:', y, 'gridWidth:', grid.offsetWidth, 'gridHeight:', grid.offsetHeight, 'dragOffset:', dragOffset);
    
    // 有効な位置（他のコンテナと重複していない）のみ配置
    const isValid = isValidAbsolutePosition(grid, draggedElement, x, y);
    if (isValid) {
      console.log('[Drag] Valid position, moving container to x:', x, 'y:', y);
      setAbsolutePosition(draggedElement, x, y);
      saveSectionLayout();
    } else {
      console.log('[Drag] Invalid position - overlaps with another container at x:', x, 'y:', y);
      // 無効な位置（重複している）の場合は配置しない
    }
    
    // すべてのコンテナからdrag-overクラスを削除
    grid.querySelectorAll('.draggable-container').forEach(container => {
      container.classList.remove('drag-over', 'drag-preview');
    });
    
    // draggedElementをクリア（dragendで再度クリアされるが、念のため）
    // draggedElement = null;
  });
}

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

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  // ページ読み込み時にlocalStorageの異常なデータをクリア
  setTimeout(validateAndClearInvalidLayout, 100);
  loadCurrentUser();
  setupAttendanceToggleButton();
  setupCorrectionRequestButton();
  setupTodoListeners();
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
  
  // 編集モード切り替えボタン
  const editModeToggle = document.getElementById('edit-mode-toggle');
  if (editModeToggle) {
    editModeToggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('[EditMode] Toggle button clicked');
      toggleEditMode();
    });
    console.log('[EditMode] Event listener attached to edit mode toggle button');
  } else {
    console.error('[EditMode] Edit mode toggle button not found!');
  }
  
  // 自動整列ボタン
  const autoAlignBtn = document.getElementById('auto-align-btn');
  if (autoAlignBtn) {
    autoAlignBtn.addEventListener('click', () => {
      if (confirm('すべてのコンテナを自動整列しますか？')) {
        const grid = document.getElementById('mypage-grid');
        if (!grid) return;
        const containers = Array.from(grid.querySelectorAll('.draggable-container'));
        autoAlignContainers(grid, containers);
        // 編集モード中の場合、グリッド線を再描画
        if (editMode) {
          drawGridLines();
        }
      }
    });
  }
  
  // ドラッグ&ドロップの設定
  setupDragAndDrop();
  
  // セクションの配置はloadCurrentUser()内で復元されるため、ここでは呼ばない
  
  // コンテナのツールチップを設定
  setupContainerTooltips();
  
  // ウィンドウリサイズ時にグリッド線を再描画
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    // リサイズ時にキャッシュをクリア
    clearGridPositionCache();
    resizeTimeout = setTimeout(() => {
      if (editMode) {
        drawGridLines();
      }
    }, 250);
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
});
