// 作業履歴ページのJavaScript

// API設定
const REPORT_API = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';
const API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';

// グローバル変数
let allWorkHistory = [];
let currentView = 'list';
let currentFilter = {
  date: null,
  month: null,
  store: null
};

// 認証トークン取得
async function getCognitoIdToken() {
  try {
    if (window.CognitoAuth && window.CognitoAuth.getCurrentUser) {
      const user = window.CognitoAuth.getCurrentUser();
      if (user) {
        const session = await new Promise((resolve, reject) => {
          user.getSession((err, session) => {
            if (err) reject(err);
            else resolve(session);
          });
        });
        if (session && session.isValid()) {
          return session.getIdToken().getJwtToken();
        }
      }
    }
    const idToken = localStorage.getItem('cognito_id_token');
    if (idToken) return idToken;
  } catch (error) {
    console.error('Error getting Cognito ID token:', error);
  }
  return null;
}

// 現在のユーザー情報を取得
async function getCurrentUserInfo() {
  try {
    // localStorageからcognito_userを取得
    const storedCognitoUser = localStorage.getItem('cognito_user');
    if (storedCognitoUser) {
      const parsedUser = JSON.parse(storedCognitoUser);
      return {
        id: parsedUser.id || null,
        email: parsedUser.email || null,
        name: parsedUser.name || null
      };
    }
    
    // Cognito認証から取得
    if (window.CognitoAuth && window.CognitoAuth.isAuthenticated()) {
      const cognitoUser = await window.CognitoAuth.getCurrentUser();
      if (cognitoUser) {
        return {
          id: cognitoUser.id || null,
          email: cognitoUser.email || null,
          name: cognitoUser.name || null
        };
      }
    }
    
    // APIから取得を試みる
    try {
      const idToken = await getCognitoIdToken();
      if (idToken) {
        const response = await fetch(`${API_BASE}/workers?limit=1`, {
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json'
          }
        });
        if (response && response.ok) {
          const data = await response.json();
          const users = data.items || data.workers || [];
          if (users.length > 0) {
            const user = users[0];
            return {
              id: user.id || null,
              email: user.email || null,
              name: user.name || null
            };
          }
        }
      }
    } catch (apiError) {
      console.warn('[WorkHistory] Error fetching user from API:', apiError);
    }
  } catch (error) {
    console.error('[WorkHistory] Error getting user info:', error);
  }
  return { id: null, email: null, name: null };
}

// localStorageから履歴を表示する関数（テキスト形式）
async function renderHistoryFromLocalStorage() {
  const historyEl = document.getElementById('history');
  if (!historyEl) {
    console.warn('[WorkHistory] history element not found');
    return;
  }

  try {
    console.log('[WorkHistory] Rendering history from localStorage...');
    
    // 現在のユーザー情報を取得
    const currentUser = await getCurrentUserInfo();
    console.log('[WorkHistory] Current user info:', currentUser);
    
    // report_input_historyからデータを取得（レポート送信情報）
    const reportInputHistoryStr = localStorage.getItem('report_input_history');
    
    console.log('[WorkHistory] report_input_history exists:', !!reportInputHistoryStr);
    
    let allHistory = [];
    
    // report_input_historyからデータを取得（現在のユーザーに紐づくもののみ）
    if (reportInputHistoryStr) {
      try {
        const reportInputHistory = JSON.parse(reportInputHistoryStr);
        console.log('[WorkHistory] Parsed report_input_history, count:', Array.isArray(reportInputHistory) ? reportInputHistory.length : 0);
        if (Array.isArray(reportInputHistory) && reportInputHistory.length > 0) {
          // report_input_historyのデータをwork_history形式に変換（現在のユーザーに紐づくもののみ）
          reportInputHistory.forEach(item => {
            // ユーザー情報でフィルタリング
            const matchesUser = 
              (currentUser.id && item.user_id && item.user_id === currentUser.id) ||
              (currentUser.email && item.user_email && item.user_email.toLowerCase() === currentUser.email.toLowerCase()) ||
              (!currentUser.id && !currentUser.email); // ユーザー情報が取得できない場合は全て表示（後方互換性）
            
            if (matchesUser) {
              const id = item.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
              const convertedItem = {
                id: id,
                date: item.date,
                brand_name: item.brand_name || '',
                store_name: item.store_name || '',
                store_id: item.store_id || '',
                brand_id: item.brand_id || '',
                start_time: item.start_time || '',
                end_time: item.end_time || '',
                work_items: (item.work_items || []).map(wi => {
                  if (typeof wi === 'string') {
                    return {
                      item_name: wi,
                      item_id: wi.toLowerCase().replace(/\s+/g, '-')
                    };
                  } else {
                    return {
                      item_name: wi.item_name || wi || '項目名不明',
                      item_id: wi.item_id || (wi.item_name ? wi.item_name.toLowerCase().replace(/\s+/g, '-') : '')
                    };
                  }
                }),
                created_at: item.created_at || new Date().toISOString(),
                status: item.status || 'pending',
                user_id: item.user_id || null,
                user_email: item.user_email || null,
                user_name: item.user_name || null
              };
              console.log('[WorkHistory] Converted item (user matched):', convertedItem);
              allHistory.push(convertedItem);
            }
          });
        }
      } catch (e) {
        console.error('[WorkHistory] Error parsing report_input_history:', e);
        console.error('[WorkHistory] Error details:', e.message, e.stack);
      }
    }
    
    // work_historyからもデータを取得（現在のユーザーに紐づくもののみ）
    const workHistoryStr = localStorage.getItem('work_history');
    if (workHistoryStr) {
      try {
        const workHistory = JSON.parse(workHistoryStr);
        console.log('[WorkHistory] Parsed work_history, count:', Array.isArray(workHistory) ? workHistory.length : 0);
        if (Array.isArray(workHistory)) {
          workHistory.forEach(item => {
            // ユーザー情報でフィルタリング
            const matchesUser = 
              (currentUser.id && item.user_id && item.user_id === currentUser.id) ||
              (currentUser.email && item.user_email && item.user_email.toLowerCase() === currentUser.email.toLowerCase()) ||
              (!currentUser.id && !currentUser.email); // ユーザー情報が取得できない場合は全て表示（後方互換性）
            
            if (matchesUser) {
              allHistory.push(item);
            }
          });
        }
      } catch (e) {
        console.error('[WorkHistory] Error parsing work_history:', e);
      }
    }
    
    console.log('[WorkHistory] Total history items:', allHistory.length);
    
    if (allHistory.length === 0) {
      console.log('[WorkHistory] No history items found');
      historyEl.innerHTML = '<table style="width: 100%; border-collapse: collapse;"><tbody><tr><td colspan="5" style="text-align: center; padding: 2rem; color: #6b7280; background: #f9fafb;"><i class="fas fa-clipboard-list" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5;"></i><p style="margin: 0;">レポート送信履歴がありません</p></td></tr></tbody></table>';
      return;
    }
    
    // テーブル構造を生成
    const tableStartHTML = `
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr class="history-header" style="background: #f3f4f6;">
            <th class="history-header-cell history-header-date" style="padding: 0.75rem 1rem; text-align: left; font-weight: 600; font-size: 0.875rem; color: #374151; width: 120px;">日付</th>
            <th class="history-header-cell history-header-time" style="padding: 0.75rem 1rem; text-align: left; font-weight: 600; font-size: 0.875rem; color: #374151; width: 120px;">時間</th>
            <th class="history-header-cell history-header-store" style="padding: 0.75rem 1rem; text-align: left; font-weight: 600; font-size: 0.875rem; color: #374151;">店舗名</th>
            <th class="history-header-cell history-header-brand" style="padding: 0.75rem 1rem; text-align: left; font-weight: 600; font-size: 0.875rem; color: #374151;">ブランド名</th>
            <th class="history-header-cell history-header-work-items" style="padding: 0.75rem 1rem; text-align: left; font-weight: 600; font-size: 0.875rem; color: #374151;">清掃項目</th>
          </tr>
        </thead>
        <tbody>
    `;
    const tableEndHTML = `
        </tbody>
      </table>
    `;

    // 日付でソート（新しい順）
    const sortedHistory = [...allHistory].sort((a, b) => {
      const dateA = a.date || a.created_at || '';
      const dateB = b.date || b.created_at || '';
      return dateB.localeCompare(dateA);
    });

    // 統計を計算（今日と今月の件数）
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD形式
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM形式
    
    const todayCount = sortedHistory.filter(item => {
      const itemDate = item.date || (item.created_at ? item.created_at.split('T')[0] : '');
      return itemDate === today;
    }).length;
    
    const monthCount = sortedHistory.filter(item => {
      const itemDate = item.date || (item.created_at ? item.created_at.split('T')[0] : '');
      return itemDate ? itemDate.slice(0, 7) === currentMonth : false;
    }).length;

    // 統計を表示
    const todayCountEl = document.getElementById('today-count');
    const monthCountEl = document.getElementById('month-count');
    if (todayCountEl) {
      todayCountEl.textContent = todayCount;
    }
    if (monthCountEl) {
      monthCountEl.textContent = monthCount;
    }

    // テキスト形式で表示（レポート送信履歴）
    console.log('[WorkHistory] Rendering', sortedHistory.length, 'history items as text');
    const textHTML = sortedHistory.map((item, index) => {
      // 日付をyyyy/mm/dd形式にフォーマット
      let dateStr = '日付不明';
      const dateValue = item.date || (item.created_at ? item.created_at.split('T')[0] : '');
      if (dateValue) {
        try {
          const date = new Date(dateValue + 'T00:00:00');
          if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            dateStr = `${year}/${month}/${day}`;
          }
        } catch (e) {
          dateStr = dateValue;
        }
      }
      
      const timeStr = item.start_time || item.end_time 
        ? `${item.start_time || '--:--'} - ${item.end_time || '--:--'}`
        : '--:-- - --:--';
      
      const workItemsText = (item.work_items || []).map(wi => {
        const name = typeof wi === 'string' ? wi : (wi.item_name || '項目名不明');
        return escapeHtml(name);
      }).join(', ') || '清掃項目なし';
      
      console.log(`[WorkHistory] Item ${index + 1}:`, {
        date: dateStr,
        time: timeStr,
        store: item.store_name,
        brand: item.brand_name,
        workItems: workItemsText
      });

      // テーブル行として表示
      return `
        <tr class="history-row" style="background: #fff;">
          <td class="history-cell history-cell-date" style="padding: 1rem; font-size: 0.875rem; color: #6b7280; width: 120px;">
            ${dateStr}
          </td>
          <td class="history-cell history-cell-time" style="padding: 1rem; font-size: 0.875rem; color: #6b7280; width: 120px;">
            ${timeStr}
          </td>
          <td class="history-cell history-cell-store" style="padding: 1rem; font-size: 0.875rem; color: #111827; font-weight: 500;">
            ${escapeHtml(item.store_name || '店舗名不明')}
          </td>
          <td class="history-cell history-cell-brand" style="padding: 1rem; font-size: 0.875rem; color: #111827; font-weight: 500;">
            ${escapeHtml(item.brand_name || 'ブランド名不明')}
          </td>
          <td class="history-cell history-cell-work-items" style="padding: 1rem; font-size: 0.875rem; color: #374151;">
            ${workItemsText}
          </td>
        </tr>
      `;
    }).join('');

    // 履歴を表示（テーブル形式）
    historyEl.innerHTML = tableStartHTML + textHTML + tableEndHTML;
    console.log('[WorkHistory] History rendered successfully to #history element');
  } catch (error) {
    console.error('[WorkHistory] Error rendering history:', error);
    if (historyEl) {
      historyEl.innerHTML = '<div style="text-align: center; padding: 2rem; color: #dc2626;"><i class="fas fa-exclamation-circle"></i><p>履歴の読み込みに失敗しました</p></div>';
    }
  }
}

// 作業履歴データを読み込む
async function loadWorkHistory() {
  const loadingEl = document.getElementById('work-list');
  if (loadingEl) {
    loadingEl.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i><p>読み込み中...</p></div>';
  }

  // localStorageから履歴を表示
  renderHistoryFromLocalStorage();

  try {
    const idToken = await getCognitoIdToken();
    if (!idToken) {
      throw new Error('認証が必要です。ログインしてください。');
    }

    // レポートAPIからデータを取得
    const res = await fetch(`${REPORT_API}/staff/reports?limit=1000`, {
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('認証エラー: ログインが必要です');
      }
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    const reports = data.items || [];

    // レポートデータを作業履歴形式に変換
    allWorkHistory = reports.map(report => {
      // 報酬額は仮の計算（実際のAPIから取得するか、設定から取得する必要がある）
      // ここでは1件あたり5000円と仮定
      const baseEarnings = 5000;
      const workItemsCount = report.work_items?.length || 1;
      const earnings = baseEarnings * workItemsCount;

      return {
        id: report.report_id || report.id,
        date: report.cleaning_date,
        store_id: report.store_id,
        store_name: report.store_name || '店舗名不明',
        brand_name: report.brand_name || '',
        start_time: report.cleaning_start_time || '',
        end_time: report.cleaning_end_time || '',
        work_items: report.work_items || [],
        status: report.status || 'submitted',
        earnings: earnings,
        created_at: report.created_at || new Date().toISOString()
      };
    });

    // 日付でソート（新しい順）
    allWorkHistory.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateB - dateA;
    });

    updateStats();
    renderWorkHistory();
  } catch (error) {
    console.error('Failed to load work history:', error);
    const errorMessage = error.message || '読み込みに失敗しました';
    if (loadingEl) {
      loadingEl.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>${escapeHtml(errorMessage)}</p></div>`;
    }
  }
}

// 統計情報を更新
function updateStats() {
  const today = new Date().toISOString().split('T')[0];
  const currentMonth = new Date().toISOString().slice(0, 7);

  // 今日のデータ
  const todayData = allWorkHistory.filter(item => item.date === today);
  const todayCount = todayData.length;
  const todayEarnings = todayData.reduce((sum, item) => sum + (item.earnings || 0), 0);

  // 今月のデータ
  const monthData = allWorkHistory.filter(item => {
    const itemMonth = item.date ? item.date.slice(0, 7) : '';
    return itemMonth === currentMonth;
  });
  const monthCount = monthData.length;
  const monthEarnings = monthData.reduce((sum, item) => sum + (item.earnings || 0), 0);

  // 統計を表示
  const todayCountEl = document.getElementById('today-count');
  const todayEarningsEl = document.getElementById('today-earnings');
  const monthCountEl = document.getElementById('month-count');
  const monthEarningsEl = document.getElementById('month-earnings');

  if (todayCountEl) todayCountEl.textContent = todayCount;
  if (todayEarningsEl) todayEarningsEl.textContent = `¥${todayEarnings.toLocaleString()}`;
  if (monthCountEl) monthCountEl.textContent = monthCount;
  if (monthEarningsEl) monthEarningsEl.textContent = `¥${monthEarnings.toLocaleString()}`;
}

// 作業履歴をレンダリング
function renderWorkHistory() {
  if (currentView === 'list') {
    renderListView();
  } else {
    renderCalendarView();
  }
}

// リストビューをレンダリング
function renderListView() {
  const container = document.getElementById('work-list');
  if (!container) return;

  // フィルター適用
  let filtered = [...allWorkHistory];
  
  if (currentFilter.date) {
    filtered = filtered.filter(item => item.date === currentFilter.date);
  }
  
  if (currentFilter.month) {
    filtered = filtered.filter(item => {
      const itemMonth = item.date ? item.date.slice(0, 7) : '';
      return itemMonth === currentFilter.month;
    });
  }
  
  if (currentFilter.store) {
    filtered = filtered.filter(item => item.store_id === currentFilter.store);
  }

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-clipboard-list"></i><p>作業履歴がありません</p></div>';
    return;
  }

  // 日付ごとにグループ化
  const groupedByDate = {};
  filtered.forEach(item => {
    const date = item.date || '日付不明';
    if (!groupedByDate[date]) {
      groupedByDate[date] = [];
    }
    groupedByDate[date].push(item);
  });

  // HTMLを生成
  const html = Object.keys(groupedByDate)
    .sort((a, b) => new Date(b) - new Date(a))
    .map(date => {
      const items = groupedByDate[date];
      const totalCount = items.length;
      const totalEarnings = items.reduce((sum, item) => sum + (item.earnings || 0), 0);

      const dateStr = formatDate(date);
      
      return `
        <div class="work-item" data-date="${date}">
          <div class="work-item-header">
            <div>
              <div class="work-item-date">${dateStr}</div>
              <div class="work-item-count">
                <i class="fas fa-tasks"></i>
                ${totalCount}件
              </div>
            </div>
          </div>
          <div class="work-item-cases">
            <div class="work-item-cases-title">作業案件</div>
            <div class="case-list">
              ${items.map(item => `
                <div class="case-item" data-id="${item.id}">
                  <div class="case-info">
                    <div class="case-name">${escapeHtml(item.store_name)}</div>
                    <div class="case-time">
                      ${item.start_time || ''} - ${item.end_time || ''}
                    </div>
                  </div>
                  <div class="case-earnings">¥${(item.earnings || 0).toLocaleString()}</div>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="work-item-summary">
            <div class="work-summary-label">合計報酬</div>
            <div class="work-summary-value">¥${totalEarnings.toLocaleString()}</div>
          </div>
        </div>
      `;
    })
    .join('');

  container.innerHTML = html;

  // イベントリスナーを追加
  container.querySelectorAll('.work-item, .case-item').forEach(el => {
    el.addEventListener('click', function() {
      const date = this.dataset.date;
      const id = this.dataset.id;
      if (id) {
        showDetail(id);
      } else if (date) {
        // 日付をクリックした場合は、その日の最初の案件を表示
        const items = groupedByDate[date];
        if (items && items.length > 0) {
          showDetail(items[0].id);
        }
      }
    });
  });
}

// カレンダービューをレンダリング
function renderCalendarView() {
  const container = document.getElementById('calendar-container');
  if (!container) return;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // 月の最初の日と最後の日を取得
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - startDate.getDay()); // 週の最初の日（日曜日）

  // カレンダーのヘッダー
  const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
  let html = weekDays.map(day => `<div class="calendar-header">${day}</div>`).join('');

  // カレンダーの日付
  const currentDate = new Date(startDate);
  for (let i = 0; i < 42; i++) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const isOtherMonth = currentDate.getMonth() !== month;
    const isToday = dateStr === new Date().toISOString().split('T')[0];
    
    // その日の作業データ
    const dayData = allWorkHistory.filter(item => item.date === dateStr);
    const hasWork = dayData.length > 0;
    const dayCount = dayData.length;
    const dayEarnings = dayData.reduce((sum, item) => sum + (item.earnings || 0), 0);

    const classes = ['calendar-day'];
    if (isOtherMonth) classes.push('other-month');
    if (isToday) classes.push('today');
    if (hasWork) classes.push('has-work');

    html += `
      <div class="${classes.join(' ')}" data-date="${dateStr}">
        <div class="calendar-day-number">${currentDate.getDate()}</div>
        ${hasWork ? `<div class="calendar-day-count">${dayCount}件</div>` : ''}
        ${hasWork && dayEarnings > 0 ? `<div class="calendar-day-earnings">¥${dayEarnings.toLocaleString()}</div>` : ''}
      </div>
    `;

    currentDate.setDate(currentDate.getDate() + 1);
  }

  container.innerHTML = html;

  // イベントリスナーを追加
  container.querySelectorAll('.calendar-day.has-work').forEach(el => {
    el.addEventListener('click', function() {
      const date = this.dataset.date;
      currentFilter.date = date;
      document.getElementById('date-filter').value = date;
      currentView = 'list';
      document.getElementById('view-list').classList.add('active');
      document.getElementById('view-calendar').classList.remove('active');
      document.getElementById('work-list-view').style.display = 'block';
      document.getElementById('work-calendar-view').style.display = 'none';
      renderWorkHistory();
    });
  });
}

// 詳細を表示
function showDetail(id) {
  const item = allWorkHistory.find(h => h.id === id);
  if (!item) return;

  const modal = document.getElementById('detail-modal');
  const body = document.getElementById('detail-body');
  if (!modal || !body) return;

  const dateStr = formatDate(item.date);
  const workItems = item.work_items || [];
  
  body.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      <div>
        <div style="font-size: 0.875rem; color: #6b7280; margin-bottom: 0.5rem;">日付</div>
        <div style="font-size: 1.125rem; font-weight: 600; color: #111827;">${dateStr}</div>
      </div>
      <div>
        <div style="font-size: 0.875rem; color: #6b7280; margin-bottom: 0.5rem;">店舗</div>
        <div style="font-size: 1.125rem; font-weight: 600; color: #111827;">${escapeHtml(item.store_name)}</div>
        ${item.brand_name ? `<div style="font-size: 0.875rem; color: #6b7280; margin-top: 0.25rem;">${escapeHtml(item.brand_name)}</div>` : ''}
      </div>
      <div>
        <div style="font-size: 0.875rem; color: #6b7280; margin-bottom: 0.5rem;">作業時間</div>
        <div style="font-size: 1.125rem; font-weight: 600; color: #111827;">
          ${item.start_time || '--:--'} - ${item.end_time || '--:--'}
        </div>
      </div>
      <div>
        <div style="font-size: 0.875rem; color: #6b7280; margin-bottom: 0.5rem;">作業項目</div>
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          ${workItems.length > 0 ? workItems.map(wi => `
            <div style="padding: 0.75rem; background: #f9fafb; border-radius: 8px;">
              <div style="font-weight: 600; color: #111827; margin-bottom: 0.25rem;">${escapeHtml(wi.name || wi.item_name || '項目名不明')}</div>
              ${wi.work_content ? `<div style="font-size: 0.875rem; color: #6b7280; margin-top: 0.5rem;">${escapeHtml(wi.work_content)}</div>` : ''}
            </div>
          `).join('') : '<div style="color: #6b7280;">作業項目がありません</div>'}
        </div>
      </div>
      <div style="padding-top: 1rem; border-top: 2px solid var(--primary);">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="font-size: 0.875rem; color: #6b7280;">報酬額</div>
          <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary);">¥${(item.earnings || 0).toLocaleString()}</div>
        </div>
      </div>
    </div>
  `;

  modal.showModal();
}

// 日付をフォーマット
function formatDate(dateString) {
  if (!dateString) return '日付不明';
  try {
    const date = new Date(dateString + 'T00:00:00');
    const weekDays = ['日', '月', '火', '水', '木', '金', '土'];
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekDay = weekDays[date.getDay()];
    return `${date.getFullYear()}年${month}月${day}日(${weekDay})`;
  } catch (e) {
    return dateString;
  }
}

// HTMLエスケープ
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// フィルターをリセット
function resetFilters() {
  currentFilter = {
    date: null,
    month: null,
    store: null
  };
  document.getElementById('date-filter').value = '';
  document.getElementById('month-filter').value = '';
  document.getElementById('store-filter').value = '';
  renderWorkHistory();
}

// 初期化
// ページ読み込み時に即座に履歴を表示（DOMContentLoadedの前でも実行可能）
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeWorkHistory);
} else {
  // DOMContentLoadedが既に発火している場合は即座に実行
  initializeWorkHistory();
}

async function initializeWorkHistory() {
  console.log('[WorkHistory] Initializing work history page...');
  
  // localStorageから履歴を表示（即座に）
  renderHistoryFromLocalStorage();
  
  // ビューの切り替え
  document.getElementById('view-list')?.addEventListener('click', function() {
    currentView = 'list';
    this.classList.add('active');
    document.getElementById('view-calendar')?.classList.remove('active');
    document.getElementById('work-list-view').style.display = 'block';
    document.getElementById('work-calendar-view').style.display = 'none';
    renderWorkHistory();
  });

  document.getElementById('view-calendar')?.addEventListener('click', function() {
    currentView = 'calendar';
    this.classList.add('active');
    document.getElementById('view-list')?.classList.remove('active');
    document.getElementById('work-list-view').style.display = 'none';
    document.getElementById('work-calendar-view').style.display = 'block';
    renderWorkHistory();
  });

  // フィルター
  document.getElementById('date-filter')?.addEventListener('change', function() {
    currentFilter.date = this.value || null;
    currentFilter.month = null;
    document.getElementById('month-filter').value = '';
    renderWorkHistory();
  });

  document.getElementById('month-filter')?.addEventListener('change', function() {
    currentFilter.month = this.value || null;
    currentFilter.date = null;
    document.getElementById('date-filter').value = '';
    renderWorkHistory();
  });

  document.getElementById('store-filter')?.addEventListener('change', function() {
    currentFilter.store = this.value || null;
    renderWorkHistory();
  });

  document.getElementById('reset-filters')?.addEventListener('click', resetFilters);

  // データを読み込む
  await loadWorkHistory();
  
  // 再度履歴を表示（APIデータ読み込み後、確実に表示）
  setTimeout(() => {
    console.log('[WorkHistory] Re-rendering history after loadWorkHistory...');
    renderHistoryFromLocalStorage();
  }, 200);
  
  // ストレージイベントを監視（他のタブでデータが更新された場合）
  window.addEventListener('storage', function(e) {
    if (e.key === 'work_history' || e.key === 'report_input_history') {
      console.log('[WorkHistory] Storage event detected for key:', e.key, '- re-rendering...');
      renderHistoryFromLocalStorage();
    }
  });
  
  // ページがフォーカスされた時に履歴を更新
  window.addEventListener('focus', function() {
    console.log('[WorkHistory] Window focused - updating history');
    renderHistoryFromLocalStorage();
  });
  
  // 定期的に履歴を更新（送信後のデータを確実に取得）
  setInterval(function() {
    renderHistoryFromLocalStorage();
  }, 3000); // 3秒ごとに更新
  
  console.log('[WorkHistory] Initialization complete');
}

// グローバルスコープに公開（他のページからも呼び出せるように）
window.renderHistoryFromLocalStorage = renderHistoryFromLocalStorage;
