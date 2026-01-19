const API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';

let availableJobs = [];
let allStores = [];
let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Auth Check
    const token = localStorage.getItem('cognito_id_token') || localStorage.getItem('misesapo_auth');
    if (!token) {
        window.location.href = '/staff/signin.html';
        return;
    }

    // Get Current User (Mock or Decode)
    try {
        // Simplified user fetching for now. In real app, we decode token or fetch /me
        const storedUser = localStorage.getItem('misesapo_user'); // Assuming we store this on login
        if (storedUser) currentUser = JSON.parse(storedUser);
        // If no user stored, we might struggle to assign.
        // For now, let's fetch all workers and match distinctively or use a fallback 'me'.
        // BUT catch requires a worker_id.
        // Let's assume user.id is available.
        if (!currentUser || !currentUser.id) {
            // Try to find self in workers list by email if token has email?
            // Skipping complex auth logic for MVP speed.
            // We'll assume a global "current user" context from `auth.js` if it existed,
            // Otherwise we need to mock or finding it.
            // Let's fetch /workers and find 'me' if possible, or warn.
        }
    } catch (e) { console.error(e); }

    await Promise.all([
        loadStores(),
        loadAvailableJobs()
    ]);
});

async function loadStores() {
    try {
        const res = await fetch(`${API_BASE}/stores`);
        const data = await res.json();
        allStores = Array.isArray(data) ? data : (data.items || []);
    } catch (e) { console.error(e); }
}

async function loadAvailableJobs() {
    try {
        const res = await fetch(`${API_BASE}/schedules`);
        const data = await res.json();
        const all = Array.isArray(data) ? data : (data.items || []);

        // Filter: Status 'draft' AND worker_id is null/empty
        availableJobs = all.filter(s => {
            const isDraft = s.status === 'draft';
            const hasWorker = s.worker_id || s.assigned_to;
            return isDraft && !hasWorker;
        });

        // Filter out past jobs?
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        availableJobs = availableJobs.filter(s => {
            const d = new Date(s.date || s.scheduled_date);
            return d >= now;
        });

        // Sort by date
        availableJobs.sort((a, b) => (a.date || a.scheduled_date).localeCompare(b.date || b.scheduled_date));

        renderJobs();
    } catch (e) {
        console.error(e);
        document.getElementById('job-list').innerHTML = '<div style="text-align:center;padding:20px;">読み込みエラー</div>';
    }
}

function renderJobs() {
    const list = document.getElementById('job-list');
    if (availableJobs.length === 0) {
        list.innerHTML = '<div style="text-align:center;padding:40px;color:#999;">現在、募集中の案件はありません</div>';
        return;
    }

    list.innerHTML = availableJobs.map(job => {
        const store = allStores.find(s => s.id === (job.store_id || job.client_id)) || {};
        const dateStr = job.date || job.scheduled_date;
        const timeStr = job.time_slot || job.scheduled_time || '時間未定';

        return `
            <div class="job-card" onclick="openJobDetail('${job.id}')">
                <div class="job-header">
                    <div class="job-date"><i class="far fa-calendar-alt"></i> ${dateStr} ${timeStr}</div>
                </div>
                <div class="job-store">${escapeHtml(store.name || '店舗名未設定')}</div>
                <div class="job-address">
                    <i class="fas fa-map-marker-alt"></i> ${escapeHtml(store.address || '住所未登録')}
                </div>
                <div class="job-tags">
                    ${(job.cleaning_items || []).map(i => `<span class="job-tag">${escapeHtml(i.name || i.title)}</span>`).join('')}
                </div>
            </div>
        `;
    }).join('');
}

window.openJobDetail = function (id) {
    const job = availableJobs.find(j => j.id === id);
    if (!job) return;

    const store = allStores.find(s => s.id === (job.store_id || job.client_id)) || {};

    document.getElementById('modal-store-name').textContent = store.name || '店舗名未設定';
    document.getElementById('modal-datetime').textContent = `${job.date || job.scheduled_date} ${job.time_slot || job.scheduled_time || ''}`;
    document.getElementById('modal-address').textContent = store.address || '-';

    const mapLink = document.getElementById('modal-map-link');
    if (store.address) {
        mapLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.address)}`;
        mapLink.style.display = 'inline-block';
    } else {
        mapLink.style.display = 'none';
    }

    const itemsContainer = document.getElementById('modal-items');
    itemsContainer.innerHTML = (job.cleaning_items || []).map(i =>
        `<span style="background:#f1f5f9; padding:4px 8px; border-radius:4px; font-size:0.85rem;">${escapeHtml(i.name || i.title)}</span>`
    ).join('');

    document.getElementById('modal-notes').textContent = job.notes || 'なし';

    // Karte (Stub - ideally load from store obj if available or fetch)
    document.getElementById('modal-key-location').textContent = store.key_location || '-';
    // Parking is usually in karte, not store master... check store obj structure if mixed

    // Setup Catch Button
    const btn = document.getElementById('catch-btn');
    btn.onclick = () => catchJob(job.id);

    document.getElementById('job-detail-dialog').showModal();
}

async function catchJob(jobId) {
    if (!confirm('この案件を受託しますか？\n自己割り当てされ、修正権限が付与されます。')) return;

    // Find Current User ID
    // Hack: If no currentUser, try to get from localStorage auth
    let workerId = null;
    try {
        const auth = JSON.parse(localStorage.getItem('misesapo_auth') || '{}');
        if (auth.user && auth.user.id) workerId = auth.user.id;
        // Or if we select "Staff" in a dev environment...
        if (!workerId && localStorage.getItem('debug_worker_id')) {
            workerId = localStorage.getItem('debug_worker_id');
        }

    } catch (e) { }

    if (!workerId) {
        alert('ユーザー情報が見つかりません。再ログインしてください。');
        return;
    }

    try {
        // Fetch existing logic to keep data intact
        // Then PUT update
        // We need the full object or just the patch? 
        // Best to read fresh, update worker_id and status, then save.

        // Mocking the update purely on frontend for speed if API allows partial?
        // Let's try standard PUT pattern

        const job = availableJobs.find(j => j.id === jobId);
        if (!job) return;

        const updateData = {
            ...job,
            worker_id: workerId,
            status: 'scheduled'
        };

        const res = await fetch(`${API_BASE}/schedules/${jobId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                // Add Authorization header if needed
            },
            body: JSON.stringify(updateData)
        });

        if (!res.ok) throw new Error('受託に失敗しました');

        alert('案件を受託しました！\nマイページのアクティビティに追加されました。');
        document.getElementById('job-detail-dialog').close();
        loadAvailableJobs(); // Refresh

    } catch (e) {
        console.error(e);
        alert('エラーが発生しました: ' + e.message);
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
