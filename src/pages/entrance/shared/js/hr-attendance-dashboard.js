/**
 * HR勤怠ダッシュボード - 5分類表示対応
 * 異常分類: 欠勤/未退勤/遅刻/休憩不備/raw-fixed乖離
 */
window.HrAttendanceDashboard = (() => {
  const apiBase = window.API_BASE || localStorage.getItem('api_base') || 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';
  const getToken = () => (window.EntranceCore && typeof EntranceCore.getToken === 'function')
    ? EntranceCore.getToken()
    : localStorage.getItem('cognito_id_token');

  const dateInput = document.getElementById('hr-board-date');
  const refreshBtn = document.getElementById('hr-board-refresh');

  // --- ステータスラベルと色の定義 ---
  const STATUS_CONFIG = {
    'absent': { label: '欠勤', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.15)' },
    'no_clockout': { label: '未退勤', color: '#f97316', bgColor: 'rgba(249, 115, 22, 0.15)' },
    'late': { label: '遅刻', color: '#eab308', bgColor: 'rgba(234, 179, 8, 0.15)' },
    'break_issue': { label: '休憩不備', color: '#8b5cf6', bgColor: 'rgba(139, 92, 246, 0.15)' },
    'divergence': { label: 'raw/fixed乖離', color: '#06b6d4', bgColor: 'rgba(6, 182, 212, 0.15)' },
    'ok': { label: '正常', color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.15)' }
  };

  // --- エラーメッセージ定義 ---
  const ERROR_MESSAGES = {
    'no_data': 'この期間のデータはありません',
    'dependency_not_ready': '現在データ準備中です（運用へ連絡）',
    'Forbidden': '権限がありません',
    'forbidden': '権限がありません',
    'default': 'エラーが発生しました（運用へ連絡）'
  };

  function getErrorMessage(response, data) {
    if (response.status === 403) return ERROR_MESSAGES['forbidden'];
    if (response.status === 503) return ERROR_MESSAGES['dependency_not_ready'];
    if (response.status === 500) return ERROR_MESSAGES['default'];
    if (data?.result === 'no_data') return ERROR_MESSAGES['no_data'];
    if (data?.result === 'dependency_not_ready') return ERROR_MESSAGES['dependency_not_ready'];
    if (data?.message) return data.message;
    if (data?.error) return ERROR_MESSAGES[data.error] || data.error;
    return ERROR_MESSAGES['default'];
  }

  async function fetchBoard(date) {
    const token = getToken();
    if (!token) throw new Error('認証トークンがありません');

    const res = await fetch(`${apiBase}/admin/attendance/board?date=${date}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await res.json();

    if (!res.ok) {
      const errorMsg = getErrorMessage(res, data);
      throw { status: res.status, message: errorMsg, data };
    }

    return data;
  }

  function formatTime(isoString) {
    if (!isoString) return '-';
    try {
      // JST (+09:00) 表記を維持
      if (isoString.includes('T')) {
        const timePart = isoString.split('T')[1];
        // HH:MM:SS+09:00 → HH:MM
        return timePart.substring(0, 5);
      }
      return isoString.substring(0, 5);
    } catch {
      return isoString;
    }
  }

  function renderKpi(kpis) {
    // 新しい5分類KPI
    const kpiContainer = document.querySelector('.hr-kpi-grid');
    if (!kpiContainer) return;

    // KPI HTML を動的に構築
    kpiContainer.innerHTML = `
      <div class="kpi-card kpi-absent" style="border-color: ${STATUS_CONFIG.absent.color}">
        <span class="kpi-label">欠勤</span>
        <span class="kpi-value" style="color: ${STATUS_CONFIG.absent.color}">${kpis.absent ?? 0}</span>
      </div>
      <div class="kpi-card kpi-no-clockout" style="border-color: ${STATUS_CONFIG.no_clockout.color}">
        <span class="kpi-label">未退勤</span>
        <span class="kpi-value" style="color: ${STATUS_CONFIG.no_clockout.color}">${kpis.no_clockout ?? 0}</span>
      </div>
      <div class="kpi-card kpi-late" style="border-color: ${STATUS_CONFIG.late.color}">
        <span class="kpi-label">遅刻</span>
        <span class="kpi-value" style="color: ${STATUS_CONFIG.late.color}">${kpis.late ?? 0}</span>
      </div>
      <div class="kpi-card kpi-break" style="border-color: ${STATUS_CONFIG.break_issue.color}">
        <span class="kpi-label">休憩不備</span>
        <span class="kpi-value" style="color: ${STATUS_CONFIG.break_issue.color}">${kpis.break_issue ?? 0}</span>
      </div>
      <div class="kpi-card kpi-divergence" style="border-color: ${STATUS_CONFIG.divergence.color}">
        <span class="kpi-label">乖離</span>
        <span class="kpi-value" style="color: ${STATUS_CONFIG.divergence.color}">${kpis.divergence ?? 0}</span>
      </div>
      <div class="kpi-card kpi-pending" style="border-color: #3b82f6">
        <span class="kpi-label">承認待ち</span>
        <span class="kpi-value" style="color: #3b82f6">${kpis.pending_requests ?? 0}</span>
      </div>
      <div class="kpi-card kpi-errors" style="border-color: #ef4444">
        <span class="kpi-label">エラー未解決</span>
        <span class="kpi-value" style="color: #ef4444">${kpis.unresolved_errors ?? 0}</span>
      </div>
    `;
  }

  function renderBoard(rows, result) {
    const tbody = document.querySelector('#attendance-table tbody');
    const empty = document.getElementById('hr-board-empty');
    const table = document.getElementById('attendance-table');

    if (!tbody) return;
    tbody.innerHTML = '';

    if (!rows || rows.length === 0 || result === 'no_data') {
      if (table) table.style.display = 'none';
      if (empty) {
        empty.style.display = 'block';
        empty.textContent = ERROR_MESSAGES['no_data'];
        empty.className = 'hr-empty hr-empty-info';
      }
      return;
    }

    if (table) table.style.display = 'table';
    if (empty) empty.style.display = 'none';

    rows.forEach(r => {
      const statusConfig = STATUS_CONFIG[r.status] || STATUS_CONFIG['ok'];
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.dataset.userId = r.staff_id;

      // 異常がある行に背景色を適用
      if (r.status && r.status !== 'ok') {
        tr.style.backgroundColor = statusConfig.bgColor;
      }

      tr.innerHTML = `
        <td>${escapeHtml(r.staff_name || '-')}</td>
        <td>${formatTime(r.raw?.clock_in)}</td>
        <td>${formatTime(r.raw?.clock_out)}</td>
        <td>${formatTime(r.fixed?.clock_in)}</td>
        <td>${formatTime(r.fixed?.clock_out)}</td>
        <td>
          <span class="status-badge" style="background-color: ${statusConfig.bgColor}; color: ${statusConfig.color}; border: 1px solid ${statusConfig.color}">
            ${r.status_label || statusConfig.label}
          </span>
        </td>
        <td>${r.requests_count || 0}</td>
        <td>${r.errors_count || 0}</td>
      `;

      tr.onclick = () => {
        const month = dateInput ? dateInput.value.slice(0, 7) : new Date().toISOString().slice(0, 7);
        const url = `attendance/user.html?uid=${r.staff_id}&month=${month}`;
        window.location.href = url;
      };

      tbody.appendChild(tr);
    });
  }

  function renderQueue(items) {
    const list = document.getElementById('hr-queue-list');
    const empty = document.getElementById('hr-queue-empty');
    if (!list) return;

    list.innerHTML = '';
    if (!items || items.length === 0) {
      if (empty) {
        empty.style.display = 'block';
        empty.textContent = '申請はありません';
      }
      return;
    }
    if (empty) empty.style.display = 'none';

    items.forEach(req => {
      const div = document.createElement('div');
      div.className = 'hr-queue-item';
      div.innerHTML = `
        <div><strong>${escapeHtml(req.staff_name || req.staff_id || '-')}</strong> ${req.date || ''}</div>
        <div>差分: ${formatTime(req.current_clock_in)} → ${formatTime(req.requested_clock_in)}</div>
        <div>理由: ${escapeHtml(req.reason || '-')}</div>
      `;
      list.appendChild(div);
    });
  }

  function showError(message, statusCode) {
    const emptyBoard = document.getElementById('hr-board-empty');
    const emptyQueue = document.getElementById('hr-queue-empty');
    const table = document.getElementById('attendance-table');
    const queueList = document.getElementById('hr-queue-list');

    if (table) table.style.display = 'none';
    if (queueList) queueList.innerHTML = '';

    // エラータイプに応じたスタイル
    let iconClass = 'fas fa-exclamation-circle';
    let colorClass = 'hr-empty-error';

    if (statusCode === 403) {
      iconClass = 'fas fa-lock';
      colorClass = 'hr-empty-forbidden';
    } else if (statusCode === 503) {
      iconClass = 'fas fa-clock';
      colorClass = 'hr-empty-loading';
    }

    if (emptyBoard) {
      emptyBoard.style.display = 'block';
      emptyBoard.innerHTML = `<i class="${iconClass}"></i> ${escapeHtml(message)}`;
      emptyBoard.className = `hr-empty ${colorClass}`;
    }
    if (emptyQueue) {
      emptyQueue.style.display = 'block';
      emptyQueue.textContent = message;
      emptyQueue.className = `hr-empty ${colorClass}`;
    }

    // KPI をリセット
    renderKpi({});
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function loadBoard() {
    const date = dateInput?.value || new Date().toISOString().slice(0, 10);
    if (dateInput) dateInput.value = date;

    try {
      const data = await fetchBoard(date);
      renderKpi(data.kpis || {});
      renderBoard(data.board || [], data.result);
      renderQueue(data.queue || []);
    } catch (e) {
      console.error('Failed to load HR attendance board', e);
      const message = e.message || ERROR_MESSAGES['default'];
      const statusCode = e.status || 500;
      showError(message, statusCode);
    }
  }

  // --- イベントリスナー ---
  if (refreshBtn) refreshBtn.addEventListener('click', loadBoard);

  // 初回読み込み
  loadBoard();

  return {
    fetchBoard: loadBoard
  };
})();
