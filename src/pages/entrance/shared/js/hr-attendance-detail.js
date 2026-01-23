/**
 * HR勤怠個人詳細ロジック
 */
window.HrAttendanceDetail = (() => {
    const apiBase = window.API_BASE || localStorage.getItem('api_base') || 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';
    const getToken = () => (window.EntranceCore && typeof EntranceCore.getToken === 'function')
        ? EntranceCore.getToken()
        : localStorage.getItem('cognito_id_token');

    const params = new URLSearchParams(window.location.search);
    const userId = params.get('user_id');
    const month = params.get('month');

    const nameEl = document.getElementById('target-staff-name');
    const monthEl = document.getElementById('target-month');
    const tbody = document.querySelector('#attendance-detail-table tbody');
    const emptyEl = document.getElementById('hr-detail-empty');
    const refreshBtn = document.getElementById('hr-detail-refresh');

    function formatTime(isoString) {
        if (!isoString) return '-';
        try {
            if (isoString.includes('T')) {
                return isoString.split('T')[1].substring(0, 5);
            }
            return isoString.substring(0, 5);
        } catch { return isoString; }
    }

    async function fetchDetail() {
        if (!userId || !month) return;

        const token = getToken();
        if (!token) return;

        try {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">読み込み中...</td></tr>';

            const res = await fetch(`${apiBase}/admin/attendance/detail?user_id=${userId}&month=${month}`, {
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
        monthEl.textContent = month ? month.replace('-', '年') + '月' : '-';

        tbody.innerHTML = '';
        const days = data.days || [];

        if (days.length === 0) {
            emptyEl.style.display = 'block';
            return;
        }
        emptyEl.style.display = 'none';

        days.forEach(day => {
            const tr = document.createElement('tr');
            const hasError = day.errors && day.errors.length > 0;
            const hasRequest = day.requests && day.requests.length > 0;

            if (hasError) tr.style.backgroundColor = 'rgba(239, 68, 68, 0.05)';

            tr.innerHTML = `
                <td>${day.date.split('-')[2]}日 (${day.day_of_week || '-'})</td>
                <td>${formatTime(day.raw?.clock_in)}</td>
                <td>${formatTime(day.raw?.clock_out)}</td>
                <td>${formatTime(day.fixed?.clock_in)}</td>
                <td>${formatTime(day.fixed?.clock_out)}</td>
                <td>${day.work_hours || '-'}h</td>
                <td>${day.break_hours || '-'}h</td>
                <td>
                    ${day.status_label ? `<span class="status-badge">${day.status_label}</span>` : '-'}
                </td>
                <td>
                    <button class="fix-btn" onclick="HrAttendanceDetail.openFixModal('${day.date}')">修正</button>
                    ${hasRequest ? `<button class="approve-btn" onclick="HrAttendanceDetail.approveRequest('${day.id}')">承認</button>` : ''}
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    // --- Actions ---
    function openFixModal(date) {
        alert(date + ' の修正機能は現在準備中です。');
    }

    function approveRequest(id) {
        if (confirm('この申請を承認しますか？')) {
            alert('承認処理（API連携）をシミュレートしました。');
        }
    }

    // Initialize
    if (refreshBtn) refreshBtn.addEventListener('click', fetchDetail);
    fetchDetail();

    return {
        openFixModal,
        approveRequest
    };
})();
