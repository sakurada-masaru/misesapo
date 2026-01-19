(() => {
  const apiBase = window.API_BASE || localStorage.getItem('api_base') || 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';
  const getToken = () => (window.EntranceCore && typeof EntranceCore.getToken === 'function')
    ? EntranceCore.getToken()
    : localStorage.getItem('cognito_id_token');

  const dateInput = document.getElementById('hr-board-date');
  const refreshBtn = document.getElementById('hr-board-refresh');

  async function fetchBoard(date) {
    const token = getToken();
    if (!token) throw new Error('No token');
    const res = await fetch(`${apiBase}/admin/attendance/board?date=${date}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to load board');
    return res.json();
  }

  function renderKpi(kpi) {
    document.querySelector('#kpi-pending span').textContent = kpi.pending_requests ?? '--';
    document.querySelector('#kpi-unfixed span').textContent = kpi.unconfirmed ?? '--';
    document.querySelector('#kpi-errors span').textContent = kpi.unresolved_errors ?? '--';
    document.querySelector('#kpi-missing span').textContent = kpi.missing_clock_suspect ?? '--';
  }

  function renderBoard(rows) {
    const tbody = document.querySelector('#attendance-table tbody');
    const empty = document.getElementById('hr-board-empty');
    tbody.innerHTML = '';
    if (!rows || rows.length === 0) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    rows.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.staff_name || '-'}</td>
        <td>${r.raw?.clock_in || '-'}</td>
        <td>${r.raw?.clock_out || '-'}</td>
        <td>${r.fixed?.clock_in || '-'}</td>
        <td>${r.fixed?.clock_out || '-'}</td>
        <td>${r.fixed?.status || r.raw?.status || '-'}</td>
        <td>${r.requests_count || 0}</td>
        <td>${r.errors_count || 0}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderQueue(items) {
    const list = document.getElementById('hr-queue-list');
    const empty = document.getElementById('hr-queue-empty');
    list.innerHTML = '';
    if (!items || items.length === 0) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    items.forEach(req => {
      const div = document.createElement('div');
      div.className = 'hr-queue-item';
      div.innerHTML = `
        <div><strong>${req.staff_name || req.staff_id || '-'}</strong> ${req.date || ''}</div>
        <div>差分: ${req.current_clock_in || '--'} → ${req.requested_clock_in || '--'}</div>
        <div>理由: ${req.reason || '-'}</div>
      `;
      list.appendChild(div);
    });
  }

  async function loadBoard() {
    const date = dateInput.value || new Date().toISOString().slice(0, 10);
    dateInput.value = date;
    try {
      const data = await fetchBoard(date);
      renderKpi(data.kpis || {});
      renderBoard(data.board || []);
      renderQueue(data.queue || []);
    } catch (e) {
      const emptyBoard = document.getElementById('hr-board-empty');
      const emptyQueue = document.getElementById('hr-queue-empty');
      emptyBoard.style.display = 'block';
      emptyQueue.style.display = 'block';
      emptyBoard.textContent = '読み込みに失敗しました';
      emptyQueue.textContent = '読み込みに失敗しました';
      console.error('Failed to load HR attendance board', e);
    }
  }

  if (refreshBtn) refreshBtn.addEventListener('click', loadBoard);
  loadBoard();
})();
