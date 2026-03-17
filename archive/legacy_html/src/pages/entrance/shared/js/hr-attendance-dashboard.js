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
        <td>
          <div style="font-weight:600">${escapeHtml(r.staff_name || '-')}</div>
          <div style="font-size:0.7rem;color:#888;margin-top:2px">${escapeHtml(r.staff_id || '')}</div>
          <a href="#" class="hr-admin-detail-link" data-staff-id="${escapeHtml(r.staff_id)}" style="font-size:0.7rem;color:#8b5cf6;text-decoration:underline;margin-top:4px;display:inline-block">個人詳細</a>
        </td>
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
      // 行クリックで日別モーダル（既存機能維持）
      tr.onclick = (e) => {
        // リンクのクリックはモーダルを開かない
        if (e.target.classList.contains('hr-admin-detail-link')) return;
        openDayDetail(r.staff_id, document.getElementById('hr-board-date').value, r.staff_name);
      };
      // 個人詳細リンクのクリックハンドラ
      const detailLink = tr.querySelector('.hr-admin-detail-link');
      if (detailLink) {
        detailLink.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          window.open('/admin/users/detail?id=' + r.staff_id, '_blank');
        };
      }
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
        <td>
          <div style="font-weight:600">${escapeHtml(u.staff_name || u.staff_id)}</div>
          <div style="font-size:0.7rem;color:#888;margin-top:2px">${escapeHtml(u.staff_id || '')}</div>
          <a href="#" class="hr-admin-detail-link" data-staff-id="${escapeHtml(u.staff_id)}" style="font-size:0.7rem;color:#8b5cf6;text-decoration:underline;margin-top:4px;display:inline-block">個人詳細</a>
        </td>
        <td>${u.work_days} 日</td>
        <td>${u.total_work_min ? (u.total_work_min / 60).toFixed(1) : 0} h</td>
        <td>${u.total_break_min || 0} min</td>
        <td><span style="${u.unconfirmed_days > 0 ? 'color:#ef4444;font-weight:700' : ''}">${u.unconfirmed_days}</span></td>
        <td>${u.alert_count || 0} 件</td>
      `;
      // 行クリックで個人月次ページへ（リンククリック時は除外）
      tr.onclick = (e) => {
        if (e.target.classList.contains('hr-admin-detail-link')) return;
        window.location.href = `attendance/user.html?uid=${u.staff_id}&month=${document.getElementById('hr-month-select').value}`;
      };
      // 個人詳細リンクのクリックハンドラ（タイムカードモーダル表示）
      const detailLink = tr.querySelector('.hr-admin-detail-link');
      if (detailLink) {
        detailLink.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const month = document.getElementById('hr-month-select')?.value || new Date().toISOString().slice(0, 7);
          openTimecardModal(u.staff_id, u.staff_name || u.staff_id, month);
        };
      }
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

    // dateが空の場合はボード日付または今日の日付を使用
    const effectiveDate = date || document.getElementById('hr-board-date')?.value || new Date().toISOString().slice(0, 10);

    try {
      const res = await fetch(`${apiBase}/admin/attendance/users/${staffId}/detail?from=${effectiveDate}&to=${effectiveDate}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      const day = data.days?.[0];
      if (!day) { body.innerHTML = 'データなし'; return; }

      // 時刻をHH:MM形式に変換
      const rawInTime = formatTime(day.raw.clock_in);
      const rawOutTime = formatTime(day.raw.clock_out);
      const fixedInTime = formatTime(day.fixed.clock_in) || rawInTime || '';
      const fixedOutTime = formatTime(day.fixed.clock_out) || rawOutTime || '';

      // エラー一覧HTML生成
      let errorsHtml = '';
      if (day.errors && day.errors.length > 0) {
        errorsHtml = `
          <div style="margin-top:15px;padding:10px;background:rgba(239,68,68,0.1);border-radius:8px;border:1px solid rgba(239,68,68,0.3)">
            <h5 style="margin:0 0 10px 0;color:#ef4444"><i class="fas fa-exclamation-triangle"></i> エラー (${day.errors.length}件)</h5>
            ${day.errors.map(e => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.1)">
                <div>
                  <span style="font-weight:600">${escapeHtml(e.type || 'unknown')}</span>
                  <span style="color:#888;font-size:0.8rem;margin-left:8px">${escapeHtml(e.message || '')}</span>
                  ${e.resolved ? '<span style="color:#10b981;font-size:0.75rem;margin-left:5px">[解決済]</span>' : ''}
                </div>
                ${!e.resolved ? `<button onclick="HrAttendanceDashboard.resolveError('${e.error_id}')" style="padding:4px 10px;background:#10b981;color:#fff;border:none;border-radius:4px;font-size:0.75rem;cursor:pointer">解決</button>` : ''}
              </div>
            `).join('')}
          </div>
        `;
      }

      // 申請一覧HTML生成
      let requestsHtml = '';
      if (day.requests && day.requests.length > 0) {
        requestsHtml = `
          <div style="margin-top:15px;padding:10px;background:rgba(139,92,246,0.1);border-radius:8px;border:1px solid rgba(139,92,246,0.3)">
            <h5 style="margin:0 0 10px 0;color:#8b5cf6"><i class="fas fa-file-alt"></i> 申請 (${day.requests.length}件)</h5>
            ${day.requests.map(r => `
              <div style="padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.1)">
                <span style="font-weight:600">${escapeHtml(r.type || '-')}</span>
                <span style="margin-left:10px;padding:2px 8px;border-radius:10px;font-size:0.7rem;background:${r.status === 'approved' ? '#10b981' : r.status === 'pending' ? '#f59e0b' : '#6b7280'}">${escapeHtml(r.status || '-')}</span>
                ${r.reason_code ? `<span style="color:#888;font-size:0.8rem;margin-left:8px">${escapeHtml(r.reason_code)}</span>` : ''}
              </div>
            `).join('')}
          </div>
        `;
      }

      body.innerHTML = `
        <h4>${escapeHtml(staffName)} (${effectiveDate})</h4>
        <input type="hidden" id="detail-attendance-id" value="${day.attendance_id || ''}">
        <input type="hidden" id="detail-staff-id" value="${staffId}">
        <input type="hidden" id="detail-date" value="${effectiveDate}">
        
        <table class="detail-table">
          <tr><th>実打刻</th><td>${rawInTime || '-'} - ${rawOutTime || '-'}</td></tr>
        </table>

        <div style="margin-top:15px;padding:15px;background:rgba(139,92,246,0.1);border-radius:8px;border:1px solid rgba(139,92,246,0.3)">
          <h5 style="margin:0 0 10px 0;color:#8b5cf6"><i class="fas fa-edit"></i> 確定値を編集</h5>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div>
              <label style="font-size:0.75rem;color:#888">出勤時刻</label>
              <input type="time" id="fixed-clock-in" value="${fixedInTime.replace('-', '')}" style="width:100%;padding:8px;background:#1a1a2e;color:#fff;border:1px solid #444;border-radius:4px">
            </div>
            <div>
              <label style="font-size:0.75rem;color:#888">退勤時刻</label>
              <input type="time" id="fixed-clock-out" value="${fixedOutTime.replace('-', '')}" style="width:100%;padding:8px;background:#1a1a2e;color:#fff;border:1px solid #444;border-radius:4px">
            </div>
          </div>
          <div style="margin-top:10px">
            <label style="font-size:0.75rem;color:#888">休憩時間（分）</label>
            <input type="number" id="fixed-break-minutes" value="${day.fixed.breaks?.[0] ? 60 : 0}" min="0" max="240" style="width:100%;padding:8px;background:#1a1a2e;color:#fff;border:1px solid #444;border-radius:4px">
          </div>
          <div style="margin-top:10px;padding:10px;background:rgba(0,0,0,0.2);border-radius:4px;text-align:center">
            <span style="color:#888;font-size:0.8rem">労働時間: </span>
            <span id="calculated-work-time" style="font-size:1.2rem;font-weight:700;color:#10b981">${day.fixed.total_minutes || 0} 分</span>
          </div>
        </div>

        ${errorsHtml}
        ${requestsHtml}

        <div style="margin-top:20px">
          <select id="fix-reason" style="width:100%;padding:8px;background:#1a1a2e;color:#fff;border:1px solid #444;border-radius:4px">
            <option value="admin">管理者修正</option>
            <option value="forget">打刻忘れ</option>
            <option value="system_error">システムエラー</option>
            <option value="other">その他</option>
          </select>
          <button onclick="HrAttendanceDashboard.approveWithValues()" style="width:100%;margin-top:10px;padding:12px;background:linear-gradient(135deg,#8b5cf6,#6d28d9);color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer">
            <i class="fas fa-check"></i> 確定値を保存
          </button>
        </div>
      `;

      // 労働時間自動計算
      const calcWorkTime = () => {
        const inVal = document.getElementById('fixed-clock-in')?.value;
        const outVal = document.getElementById('fixed-clock-out')?.value;
        const breakMin = parseInt(document.getElementById('fixed-break-minutes')?.value) || 0;
        if (inVal && outVal) {
          const [inH, inM] = inVal.split(':').map(Number);
          const [outH, outM] = outVal.split(':').map(Number);
          const totalMin = (outH * 60 + outM) - (inH * 60 + inM) - breakMin;
          document.getElementById('calculated-work-time').textContent = `${Math.max(0, totalMin)} 分`;
        }
      };
      document.getElementById('fixed-clock-in')?.addEventListener('change', calcWorkTime);
      document.getElementById('fixed-clock-out')?.addEventListener('change', calcWorkTime);
      document.getElementById('fixed-break-minutes')?.addEventListener('input', calcWorkTime);

    } catch (e) { body.innerHTML = 'Error: ' + e.message; }
  };

  window.closeHrDetail = () => document.getElementById('hr-detail-modal')?.classList.remove('active');

  // ============================================
  // Timecard Modal (iframe)
  // ============================================
  function openTimecardModal(staffId, staffName, month) {
    const modal = document.getElementById('hr-timecard-modal');
    const iframe = document.getElementById('hr-timecard-iframe');
    const title = document.getElementById('hr-timecard-title');
    if (!modal || !iframe) return;

    const safeName = staffName || staffId || 'タイムカード';
    if (title) {
      title.innerHTML = `<i class="fas fa-calendar-check"></i> ${escapeHtml(safeName)} (${escapeHtml(staffId)}) タイムカード`;
    }

    // embed=timecard でタイムカードのみ表示する埋め込みモードへ
    const qsMonth = month ? `&month=${encodeURIComponent(month)}` : '';
    iframe.src = `/admin/users/detail?id=${encodeURIComponent(staffId)}&embed=timecard${qsMonth}`;

    modal.classList.add('active');

    // ESCで閉じる
    document.addEventListener('keydown', onTimecardEscClose);
  }

  function onTimecardEscClose(e) {
    const modal = document.getElementById('hr-timecard-modal');
    if (!modal || !modal.classList.contains('active')) return;
    if (e.key === 'Escape') closeTimecardModal();
  }

  function closeTimecardModal() {
    const modal = document.getElementById('hr-timecard-modal');
    const iframe = document.getElementById('hr-timecard-iframe');
    if (!modal) return;
    modal.classList.remove('active');
    if (iframe) iframe.src = 'about:blank';
    document.removeEventListener('keydown', onTimecardEscClose);
  }


  // 確定値を含めた保存
  async function approveWithValues() {
    const attendanceId = document.getElementById('detail-attendance-id')?.value;
    const staffId = document.getElementById('detail-staff-id')?.value;
    const date = document.getElementById('detail-date')?.value;
    const fixedIn = document.getElementById('fixed-clock-in')?.value;
    const fixedOut = document.getElementById('fixed-clock-out')?.value;
    const breakMin = parseInt(document.getElementById('fixed-break-minutes')?.value) || 0;
    const reason = document.getElementById('fix-reason')?.value || 'admin';

    if (!fixedIn || !fixedOut) {
      alert('出勤・退勤時刻を入力してください');
      return;
    }

    // 労働時間計算
    const [inH, inM] = fixedIn.split(':').map(Number);
    const [outH, outM] = fixedOut.split(':').map(Number);
    const totalMin = Math.max(0, (outH * 60 + outM) - (inH * 60 + inM) - breakMin);

    const token = getToken();
    const payload = {
      fixed_clock_in: `${date}T${fixedIn}:00+09:00`,
      fixed_clock_out: `${date}T${fixedOut}:00+09:00`,
      fixed_breaks: breakMin > 0 ? [{ duration_minutes: breakMin }] : [],
      fixed_total_minutes: totalMin,
      fixed_status: 'ok',
      reason_code: reason
    };

    try {
      // attendance_idがあればPATCH、なければPOSTで新規作成
      let res;
      if (attendanceId) {
        res = await fetch(`${apiBase}/admin/attendance/${attendanceId}/fixed`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        // 新規作成の場合
        res = await fetch(`${apiBase}/attendance`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            staff_id: staffId,
            date: date,
            ...payload
          })
        });
      }

      if (res.ok) {
        alert('確定しました');
        closeHrDetail();
        loadBoard();
      } else {
        const errData = await res.json();
        alert('エラー: ' + (errData.message || res.status));
      }
    } catch (e) { alert('通信エラー: ' + e.message); }
  }

  // エラー解決
  async function resolveError(errorId) {
    if (!confirm('このエラーを解決済みにしますか？')) return;
    const token = getToken();
    try {
      const res = await fetch(`${apiBase}/attendance/errors/${errorId}/resolve`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved: true })
      });
      if (res.ok) {
        alert('エラーを解決済みにしました');
        // モーダル再読込
        const staffId = document.getElementById('detail-staff-id')?.value;
        const date = document.getElementById('detail-date')?.value;
        if (staffId && date) {
          openDayDetail(staffId, date, '');
        }
        loadBoard();
      } else {
        alert('エラー解決に失敗しました');
      }
    } catch (e) { alert('通信エラー: ' + e.message); }
  }

  // 旧approve関数（互換性のため残す）
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
    const rows = [["staff_id", "名前", "出勤(実)", "退勤(実)", "状態"], ...data.board.map(r => [r.staff_id || '', r.staff_name, formatTime(r.raw.clock_in), formatTime(r.raw.clock_out), r.status_label])];
    downloadCSV(`daily_${date}.csv`, rows);
  }

  async function exportMonthlyCSV() {
    const month = document.getElementById('hr-month-select').value;
    const token = getToken();
    const res = await fetch(`${apiBase}/admin/attendance/monthly/users?month=${month}`, { headers: { 'Authorization': `Bearer ${token}` } });
    const data = await res.json();
    const rows = [["staff_id", "名前", "日数", "時間(h)", "アラート"], ...data.users.map(u => [u.staff_id || '', u.staff_name, u.work_days, (u.total_work_min / 60).toFixed(1), u.alert_count])];
    downloadCSV(`monthly_${month}.csv`, rows);
  }

  if (refreshBtn) refreshBtn.onclick = () => {
    const isMonthly = document.getElementById('hr-monthly-view').style.display === 'block';
    isMonthly ? loadMonthlyBoard() : loadBoard();
  };

  loadBoard();

  return { loadBoard, approve, approveWithValues, resolveError, openTimecardModal, closeTimecardModal, exportDailyCSV, exportMonthlyCSV };
})();
