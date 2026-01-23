/**
 * HR勤怠個人詳細ロジック（完成版）
 */
window.HrAttendanceUser = (() => {
    const apiBase = window.API_BASE || localStorage.getItem('api_base') || 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';
    const getToken = () => (window.EntranceCore && typeof EntranceCore.getToken === 'function')
        ? EntranceCore.getToken()
        : localStorage.getItem('cognito_id_token');

    let params = new URLSearchParams(window.location.search);
    let userId = params.get('uid');
    let currentMonth = params.get('month') || new Date().toISOString().slice(0, 7);

    // DOM Elements
    const nameEl = document.getElementById('target-staff-name');
    const monthEl = document.getElementById('target-month');
    const tbody = document.querySelector('#attendance-detail-table tbody');
    const emptyEl = document.getElementById('hr-detail-empty');
    const refreshBtn = document.getElementById('hr-detail-refresh');
    const logContainer = document.getElementById('hr-audit-logs');

    // Summary Elements
    const statDays = document.getElementById('stat-days');
    const statHours = document.getElementById('stat-hours');
    const statAvg = document.getElementById('stat-avg');

    // Modal Elements
    const modalOverlay = document.getElementById('fix-modal-overlay');
    const fixDateInput = document.getElementById('fix-date');
    const fixClockIn = document.getElementById('fix-clock-in');
    const fixClockOut = document.getElementById('fix-clock-out');
    const fixBreakHours = document.getElementById('fix-break-hours');
    const fixReason = document.getElementById('fix-reason');
    const modalTitle = document.getElementById('modal-date-title');

    function formatTime(isoString) {
        if (!isoString) return '-';
        if (isoString.length === 5) return isoString; // Already HH:MM
        try {
            if (isoString.includes('T')) {
                return isoString.split('T')[1].substring(0, 5);
            }
            return isoString.substring(0, 5);
        } catch { return isoString; }
    }

    async function fetchDetail() {
        if (!userId) return;

        const token = getToken();
        if (!token) return;

        try {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">読み込み中...</td></tr>';

            const res = await fetch(`${apiBase}/admin/attendance/detail?user_id=${userId}&month=${currentMonth}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.message || 'データ取得に失敗しました');

            renderDetail(data);
        } catch (e) {
            console.error(e);
            tbody.innerHTML = '';
            emptyEl.style.display = 'block';
            emptyEl.textContent = e.message;
        }
    }

    function renderDetail(data) {
        nameEl.textContent = data.staff_name || '不明なユーザー';
        monthEl.textContent = currentMonth.replace('-', '年') + '月';

        // Summary
        statDays.textContent = data.summary?.work_days || 0;
        statHours.textContent = (data.summary?.total_hours || 0).toFixed(1);
        statAvg.textContent = (data.summary?.avg_daily_hours || 0).toFixed(1);

        tbody.innerHTML = '';
        const days = data.days || [];

        if (days.length === 0) {
            emptyEl.style.display = 'block';
            emptyEl.textContent = '指定期間のデータはありません。';
            return;
        }
        emptyEl.style.display = 'none';

        days.forEach(day => {
            const tr = document.createElement('tr');
            const hasError = day.errors && day.errors.length > 0;
            const statusLabel = day.status_label || (day.status === 'ok' ? '正常' : day.status);

            if (hasError) tr.style.backgroundColor = 'rgba(239, 68, 68, 0.08)';

            tr.innerHTML = `
                <td>${day.date.split('-')[2]}日 (${day.day_of_week || '-'})</td>
                <td style="opacity:0.6">${formatTime(day.raw?.clock_in)}</td>
                <td style="opacity:0.6">${formatTime(day.raw?.clock_out)}</td>
                <td><strong>${formatTime(day.fixed?.clock_in)}</strong></td>
                <td><strong>${formatTime(day.fixed?.clock_out)}</strong></td>
                <td>${day.work_hours || '0.0'}h</td>
                <td>${day.break_hours || '0.0'}h</td>
                <td>
                    <span class="status-badge" style="color:${hasError ? '#ef4444' : '#10b981'}">${statusLabel}</span>
                </td>
                <td style="text-align:center">
                    <button class="fix-btn" onclick="HrAttendanceUser.openModal('${day.date}', '${formatTime(day.fixed?.clock_in)}', '${formatTime(day.fixed?.clock_out)}', ${day.break_hours || 0})">
                        <i class="fas fa-edit"></i> 修正
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Audit Logs
        renderAuditLogs(data.audit_logs || []);
    }

    function renderAuditLogs(logs) {
        if (!logContainer) return;
        if (logs.length === 0) {
            logContainer.innerHTML = '<div class="history-item">修正履歴はありません。</div>';
            return;
        }
        logContainer.innerHTML = logs.map(l => `
            <div class="history-item">
                <strong>${l.timestamp.slice(5, 16).replace('T', ' ')}</strong>: 
                ${l.admin_name} が修正 (${l.date}) - 
                内容: <em>${l.change_details}</em> 
                - 理由: <strong>${l.reason}</strong>
            </div>
        `).join('');
    }

    // --- Modal Logic ---
    function openModal(date, clockIn, clockOut, breakHours) {
        modalTitle.textContent = `${date} の勤怠修正`;
        fixDateInput.value = date;
        fixClockIn.value = clockIn === '-' ? '' : clockIn;
        fixClockOut.value = clockOut === '-' ? '' : clockOut;
        fixBreakHours.value = breakHours || 0.5;
        fixReason.value = '';
        modalOverlay.style.display = 'flex';
    }

    function closeModal() {
        modalOverlay.style.display = 'none';
    }

    async function saveFix() {
        if (!fixReason.value.trim()) {
            alert('修正理由は必須です。');
            return;
        }

        const token = getToken();
        const payload = {
            staff_id: userId,
            date: fixDateInput.value,
            fixed_clock_in: fixClockIn.value,
            fixed_clock_out: fixClockOut.value,
            fixed_break_hours: parseFloat(fixBreakHours.value),
            reason: fixReason.value
        };

        try {
            const btn = document.querySelector('.btn-save');
            btn.disabled = true;
            btn.textContent = '保存中...';

            const res = await fetch(`${apiBase}/admin/attendance/fix`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || '修正の保存に失敗しました');
            }

            alert('修正を保存しました。');
            closeModal();
            fetchDetail();
        } catch (e) {
            alert(e.message);
        } finally {
            const btn = document.querySelector('.btn-save');
            btn.disabled = false;
            btn.textContent = '変更を保存';
        }
    }

    function changeMonth(delta) {
        const [y, m] = currentMonth.split('-').map(Number);
        const d = new Date(y, m - 1 + delta, 1);
        currentMonth = d.toISOString().slice(0, 7);

        // Update URL without reload if possible, or just reload with new param
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('month', currentMonth);
        window.history.pushState({}, '', newUrl);

        fetchDetail();
    }

    // Initialize
    if (refreshBtn) refreshBtn.addEventListener('click', fetchDetail);
    fetchDetail();

    return {
        openModal,
        closeModal,
        saveFix,
        changeMonth
    };
})();
