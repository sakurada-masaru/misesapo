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
    'alert_12h': { label: '未退勤(12h超)', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.2)' },
    'late': { label: '遅刻', color: '#eab308', bgColor: 'rgba(234, 179, 8, 0.15)' },
    'break_issue': { label: '休憩不備', color: '#8b5cf6', bgColor: 'rgba(139, 92, 246, 0.15)' },
    'alert_break_90m': { label: '休憩未終(90m超)', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.2)' },
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
      if (isoString.includes('T')) {
        const timePart = isoString.split('T')[1];
        return timePart.substring(0, 5);
      }
      return isoString.substring(0, 5);
    } catch {
      return isoString;
    }
  }

  function renderKpi(kpis) {
    const kpiContainer = document.querySelector('.hr-kpi-grid');
    if (!kpiContainer) return;

    kpiContainer.innerHTML = `
      <div class="kpi-card" style="border-color: ${STATUS_CONFIG.absent.color}">
        <span class="kpi-label">欠勤</span>
        <span class="kpi-value" style="color: ${STATUS_CONFIG.absent.color}">${kpis.absent ?? 0}</span>
      </div>
      <div class="kpi-card" style="border-color: ${STATUS_CONFIG.no_clockout.color}">
        <span class="kpi-label">未退勤</span>
        <span class="kpi-value" style="color: ${STATUS_CONFIG.no_clockout.color}">${kpis.no_clockout ?? 0}</span>
      </div>
      <div class="kpi-card" style="border-color: #ef4444">
        <span class="kpi-label">アラート</span>
        <span class="kpi-value" style="color: #ef4444">${(kpis.alert_12h || 0) + (kpis.alert_break_90m || 0)}</span>
      </div>
      <div class="kpi-card" style="border-color: ${STATUS_CONFIG.late.color}">
        <span class="kpi-label">遅刻</span>
        <span class="kpi-value" style="color: ${STATUS_CONFIG.late.color}">${kpis.late ?? 0}</span>
      </div>
      <div class="kpi-card" style="border-color: ${STATUS_CONFIG.break_issue.color}">
        <span class="kpi-label">休憩不備</span>
        <span class="kpi-value" style="color: ${STATUS_CONFIG.break_issue.color}">${kpis.break_issue ?? 0}</span>
      </div>
      <div class="kpi-card" style="border-color: #3b82f6">
        <span class="kpi-label">申請</span>
        <span class="kpi-value" style="color: #3b82f6">${kpis.pending_requests ?? 0}</span>
      </div>
    `;
  }

  function renderBoard(rows, result) {
    const tbody = document.querySelector('#attendance-table tbody');
    const empty = document.getElementById('hr-board-empty');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!rows || rows.length === 0 || result === 'no_data') {
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';

    rows.forEach(r => {
      const statusConfig = STATUS_CONFIG[r.status] || STATUS_CONFIG['ok'];
      const tr = document.createElement('tr');
      tr.className = 'hr-clickable-row';
      tr.dataset.userId = r.staff_id;
      if (r.status && r.status !== 'ok') tr.style.backgroundColor = statusConfig.bgColor;

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
      tr.onclick = () => openDayDetail(r.staff_id, document.getElementById('hr-board-date').value, r.staff_name);
      tbody.appendChild(tr);
    });
  }

  function renderQueue(items) {
    const list = document.getElementById('hr-queue-list');
    if (!list) return;
    list.innerHTML = '';

    if (!items || items.length === 0) {
      document.getElementById('hr-queue-empty').style.display = 'block';
      return;
    }
    document.getElementById('hr-queue-empty').style.display = 'none';

    items.forEach(req => {
      const div = document.createElement('div');
      div.className = 'hr-queue-item';
      div.innerHTML = `
        <div><strong>${escapeHtml(req.staff_name || req.staff_id)}</strong> ${req.date}</div>
        <div>申請: ${formatTime(req.requested_clock_in)} - ${formatTime(req.requested_clock_out)}</div>
        <div style="font-size:0.8rem;opacity:0.7">理由: ${escapeHtml(req.reason)}</div>
      `;
      list.appendChild(div);
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  async function loadBoard() {
    const dateInput = document.getElementById('hr-board-date');
    const date = dateInput?.value || new Date().toISOString().slice(0, 10);
    try {
      const data = await fetchBoard(date);
      renderKpi(data.kpis || {});
      renderBoard(data.board || [], data.result);
      renderQueue(data.queue || []);
    } catch (e) {
      console.error(e);
    }
  }

  // --- Monthly View ---
  window.switchHrView = (view) => {
    const dailyBtn = document.getElementById('hr-btn-daily');
    const monthlyBtn = document.getElementById('hr-btn-monthly');
    const dailyView = document.getElementById('hr-daily-view');
    const monthlyView = document.getElementById('hr-monthly-view');
    const dateInput = document.getElementById('hr-board-date');
    const monthInput = document.getElementById('hr-month-select');

    if (view === 'daily') {
      dailyBtn.classList.add('active');
      monthlyBtn.classList.remove('active');
      dailyView.style.display = 'block';
      monthlyView.style.display = 'none';
      dateInput.style.display = 'block';
      monthInput.style.display = 'none';
      loadBoard();
    } else {
      dailyBtn.classList.remove('active');
      monthlyBtn.classList.add('active');
      dailyView.style.display = 'none';
      monthlyView.style.display = 'block';
      dateInput.style.display = 'none';
      monthInput.style.display = 'block';
      if (!monthInput.value) monthInput.value = new Date().toISOString().slice(0, 7);
      loadMonthlyBoard();
    }
  };

  async function loadMonthlyBoard() {
    const month = document.getElementById('hr-month-select')?.value;
    const token = getToken();
    try {
      const resSum = await fetch(`${apiBase}/admin/attendance/monthly/summary?month=${month}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const sumData = await resSum.json();
      if (resSum.ok) renderKpi(sumData.kpis || {});

      const resUsers = await fetch(`${apiBase}/admin/attendance/monthly/users?month=${month}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const usersData = await resUsers.json();
      if (resUsers.ok) renderMonthlyTable(usersData.users || []);
    } catch (e) { console.error(e); }
  }

  function renderMonthlyTable(users) {
    const tbody = document.querySelector('#monthly-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    users.forEach(u => {
      const tr = document.createElement('tr');
      tr.className = 'hr-clickable-row';
      tr.innerHTML = `
        <td>${escapeHtml(u.staff_name || u.staff_id)}</td>
        <td>${u.work_days} 日</td>
        <td>${u.total_work_min ? (u.total_work_min / 60).toFixed(1) : 0} h</td>
        <td>${u.total_break_min || 0} min</td>
        <td><span style="${u.unconfirmed_days > 0 ? 'color:#ef4444;font-weight:700' : ''}">${u.unconfirmed_days}</span></td>
        <td>${u.alert_count || 0} 件</td>
      `;
      tr.onclick = () => {
        window.location.href = `attendance/user.html?uid=${u.staff_id}&month=${document.getElementById('hr-month-select').value}`;
      };
      tbody.appendChild(tr);
    });
  }

  // --- Detail ---
  window.openDayDetail = async (staffId, date, staffName) => {
    const token = getToken();
    const modal = document.getElementById('hr-detail-modal');
    const body = document.getElementById('hr-detail-body');
    if (!modal || !body) return;
    body.innerHTML = '読み込み中...';
    modal.classList.add('active');

    try {
      const res = await fetch(`${apiBase}/admin/attendance/users/${staffId}/detail?from=${date}&to=${date}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      const day = data.days?.[0];
      if (!day) { body.innerHTML = 'データなし'; return; }

      body.innerHTML = `
        <h4>${staffName} (${date})</h4>
        <table class="detail-table">
          <tr><th>実打刻</th><td>${formatTime(day.raw.clock_in)} - ${formatTime(day.raw.clock_out)}</td></tr>
          <tr><th>確定値</th><td>${formatTime(day.fixed.clock_in)} - ${formatTime(day.fixed.clock_out)}</td></tr>
          <tr><th>労働時間</th><td>${day.fixed.total_minutes || 0} 分</td></tr>
        </table>
        <div style="margin-top:20px">
          <select id="fix-reason" style="width:100%;padding:8px;background:#111;color:#fff;border:1px solid #444">
            <option value="admin">管理者修正</option>
            <option value="forget">打刻忘れ</option>
          </select>
          <button onclick="HrAttendanceDashboard.approve('${day.attendance_id}')" style="width:100%;margin-top:10px;padding:10px;background:#8b5cf6;color:#fff;border:none">確定する</button>
        </div>
      `;
    } catch (e) { body.innerHTML = 'Error: ' + e.message; }
  };

  window.closeHrDetail = () => document.getElementById('hr-detail-modal')?.classList.remove('active');

  async function approve(id) {
    const reason = document.getElementById('fix-reason').value;
    const token = getToken();
    try {
      const res = await fetch(`${apiBase}/admin/attendance/${id}/fixed`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason_code: reason, fixed_status: 'ok' })
      });
      if (res.ok) { alert('確定しました'); closeHrDetail(); loadBoard(); }
    } catch (e) { alert(e.message); }
  }

  // --- Export ---
  function downloadCSV(name, rows) {
    const content = "\ufeff" + rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
  }

  async function exportDailyCSV() {
    const date = document.getElementById('hr-board-date').value;
    const data = await fetchBoard(date);
    const rows = [["名前", "出勤(実)", "退勤(実)", "状態"], ...data.board.map(r => [r.staff_name, formatTime(r.raw.clock_in), formatTime(r.raw.clock_out), r.status_label])];
    downloadCSV(`daily_${date}.csv`, rows);
  }

  async function exportMonthlyCSV() {
    const month = document.getElementById('hr-month-select').value;
    const token = getToken();
    const res = await fetch(`${apiBase}/admin/attendance/monthly/users?month=${month}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    const rows = [["名前", "日数", "時間(h)", "アラート"], ...data.users.map(u => [u.staff_name, u.work_days, (u.total_work_min / 60).toFixed(1), u.alert_count])];
    downloadCSV(`monthly_${month}.csv`, rows);
  }

  if (refreshBtn) refreshBtn.onclick = () => {
    const isMonthly = document.getElementById('hr-monthly-view').style.display === 'block';
    isMonthly ? loadMonthlyBoard() : loadBoard();
  };

  loadBoard();

  return { loadBoard, approve, exportDailyCSV, exportMonthlyCSV };
})();
