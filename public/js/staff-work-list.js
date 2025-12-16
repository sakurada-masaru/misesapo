// 作業一覧ページのJavaScript
let currentUser = null;
let currentMonth = new Date();
let workList = [];

// ページ読み込み時に初期化
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadCurrentUser();
    await loadWorkList();
    setupEventListeners();
  } catch (error) {
    console.error('Error initializing work list page:', error);
    showError('ページの読み込みに失敗しました');
  }
});

// 現在のユーザーを読み込む
async function loadCurrentUser() {
  try {
    // Cognito認証からユーザー情報を取得
    const idToken = await getCognitoIdToken();
    if (!idToken) {
      throw new Error('認証トークンが取得できませんでした');
    }

    // ユーザー情報を取得（既存のロジックを使用）
    const userId = localStorage.getItem('current_user_id') || 'default';
    currentUser = {
      id: userId,
      department: localStorage.getItem('current_user_department') || ''
    };

    // OS課でない場合はアクセス拒否
    if (currentUser.department !== 'OS課') {
      window.location.href = '/staff/mypage';
      return;
    }

    // サイドバーをOS課専用に設定
    setupOSSectionSidebar();
  } catch (error) {
    console.error('Error loading current user:', error);
    throw error;
  }
}

// OS課専用サイドバーを設定
function setupOSSectionSidebar() {
  const sidebarNav = document.querySelector('#admin-sidebar .sidebar-nav');
  if (!sidebarNav) return;

  // ロールバッジを更新
  const roleBadge = document.getElementById('sidebar-role-badge');
  if (roleBadge) {
    roleBadge.textContent = 'OS課';
  }

  // 日報と出勤履歴を非表示
  const dailyReportsLink = sidebarNav.querySelector('a[data-page="daily-reports"]');
  const attendanceHistoryLink = sidebarNav.querySelector('a[data-page="attendance-history"]');
  if (dailyReportsLink) dailyReportsLink.style.display = 'none';
  if (attendanceHistoryLink) attendanceHistoryLink.style.display = 'none';

  // 作業一覧リンクをアクティブにする
  const workListLink = sidebarNav.querySelector('a[data-page="work-list"]');
  if (workListLink) {
    workListLink.classList.add('active');
  }

  // マイページリンクからアクティブを削除
  const mypageLink = sidebarNav.querySelector('a[data-page="mypage"]');
  if (mypageLink) {
    mypageLink.classList.remove('active');
  }
}

// Cognito ID Token取得
async function getCognitoIdToken() {
  try {
    const token = localStorage.getItem('cognito_id_token');
    if (token) return token;
    
    // Cognito User Poolから取得を試みる
    if (typeof AmazonCognitoIdentity !== 'undefined') {
      const config = window.CognitoConfig || {};
      if (config.userPoolId && config.clientId) {
        const poolData = {
          UserPoolId: config.userPoolId,
          ClientId: config.clientId
        };
        const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
        const cognitoUser = userPool.getCurrentUser();
        
        if (cognitoUser) {
          return new Promise((resolve) => {
            cognitoUser.getSession((err, session) => {
              if (!err && session && session.isValid()) {
                resolve(session.getIdToken().getJwtToken());
              } else {
                resolve(null);
              }
            });
          });
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error getting Cognito ID token:', error);
    return null;
  }
}

// 作業一覧を読み込む
async function loadWorkList() {
  try {
    // TODO: APIから作業データを取得
    // 現時点ではモックデータを使用
    workList = [
      {
        id: '1',
        date: '2025-12-01',
        clientName: 'サンプル顧客A',
        caseName: '定期清掃',
        workContent: 'オフィス清掃',
        status: 'completed'
      },
      {
        id: '2',
        date: '2025-12-05',
        clientName: 'サンプル顧客B',
        caseName: '特別清掃',
        workContent: '厨房清掃',
        status: 'pending'
      }
    ];

    renderWorkList();
    updateSummary();
    hideLoading();
  } catch (error) {
    console.error('Error loading work list:', error);
    showError('作業一覧の読み込みに失敗しました');
  }
}

// 作業一覧を表示
function renderWorkList() {
  const tbody = document.getElementById('work-list-body');
  if (!tbody) return;

  const statusFilter = document.getElementById('status-filter')?.value || 'all';
  const clientFilter = document.getElementById('client-filter')?.value.toLowerCase() || '';

  const filteredList = workList.filter(work => {
    if (statusFilter !== 'all' && work.status !== statusFilter) {
      return false;
    }
    if (clientFilter && !work.clientName.toLowerCase().includes(clientFilter)) {
      return false;
    }
    return true;
  });

  if (filteredList.length === 0) {
    tbody.innerHTML = '';
    document.getElementById('empty-state').style.display = 'block';
    return;
  }

  document.getElementById('empty-state').style.display = 'none';

  tbody.innerHTML = filteredList.map(work => `
    <tr>
      <td>${formatDate(work.date)}</td>
      <td>${escapeHtml(work.clientName)}</td>
      <td>${escapeHtml(work.caseName)}</td>
      <td>${escapeHtml(work.workContent)}</td>
      <td>
        <span class="status-badge ${work.status}">
          ${work.status === 'completed' ? '完了' : '未完了'}
        </span>
      </td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="viewWorkDetail('${work.id}')">
          詳細
        </button>
      </td>
    </tr>
  `).join('');
}

// サマリーを更新
function updateSummary() {
  const total = workList.length;
  const completed = workList.filter(w => w.status === 'completed').length;
  const pending = workList.filter(w => w.status === 'pending').length;

  document.getElementById('total-work-count').textContent = total;
  document.getElementById('completed-work-count').textContent = completed;
  document.getElementById('pending-work-count').textContent = pending;
}

// イベントリスナーを設定
function setupEventListeners() {
  // 月選択
  document.getElementById('prev-month')?.addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    updateMonthDisplay();
    loadWorkList();
  });

  document.getElementById('next-month')?.addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() + 1);
    updateMonthDisplay();
    loadWorkList();
  });

  // フィルター
  document.getElementById('status-filter')?.addEventListener('change', renderWorkList);
  document.getElementById('client-filter')?.addEventListener('input', renderWorkList);
}

// 月表示を更新
function updateMonthDisplay() {
  const monthEl = document.getElementById('current-month');
  if (monthEl) {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth() + 1;
    monthEl.textContent = `${year}年${month}月`;
  }
}

// 日付をフォーマット
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// HTMLエスケープ
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 作業詳細を表示
function viewWorkDetail(workId) {
  // TODO: 作業詳細ページに遷移
  console.log('View work detail:', workId);
}

// ローディングを非表示
function hideLoading() {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('page-content').style.display = 'block';
}

// エラーを表示
function showError(message) {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('error-message').style.display = 'block';
  document.getElementById('error-text').textContent = message;
}

