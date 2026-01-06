/**
 * 立て替え精算管理ロジック (Admin)
 */
const API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';

document.addEventListener('DOMContentLoaded', async () => {
    // 認証チェック
    if (!window.CognitoAuth || !window.CognitoAuth.isAuthenticated()) {
        window.location.replace('/staff/signin.html');
        return;
    }

    const user = await window.CognitoAuth.getCurrentUser();
    if (!user) {
        window.location.replace('/staff/signin.html');
        return;
    }
    // 管理者/経理権限チェック（本来はバックエンドでも行われる）

    // DOM要素
    const tableBody = document.getElementById('reimbursements-tbody');
    const statusFilter = document.getElementById('status-filter');
    const staffSearch = document.getElementById('staff-name-search');
    const applyFilterBtn = document.getElementById('apply-filters');
    const detailModal = document.getElementById('detail-modal');
    const modalContent = document.getElementById('modal-content');
    const closeModalBtn = document.querySelector('.modal-close');
    const btnApprove = document.getElementById('btn-approve');
    const btnReject = document.getElementById('btn-reject');
    const btnMarkPaid = document.getElementById('btn-mark-paid');

    let currentItems = [];
    let selectedId = null;

    // 初期ロード
    loadReimbursements();

    // フィルタリング
    applyFilterBtn.addEventListener('click', loadReimbursements);

    async function loadReimbursements() {
        tableBody.innerHTML = '<tr><td colspan="8" class="text-center py-4"><i class="fas fa-spinner fa-spin"></i> 読み込み中...</td></tr>';

        const status = statusFilter.value;
        const staffName = staffSearch.value;

        let url = `${API_BASE}/reimbursements?limit=100`;
        if (status !== 'all') url += `&status=${status}`;

        try {
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${window.CognitoAuth.getIdToken()}` }
            });
            if (!response.ok) throw new Error('取得失敗');

            const { reimbursements } = await response.json();
            currentItems = reimbursements;

            // クライアントサイド検索（名前）
            let filtered = reimbursements;
            if (staffName) {
                filtered = reimbursements.filter(item =>
                    (item.staff_name || '').includes(staffName)
                );
            }

            renderTable(filtered);
        } catch (error) {
            console.error(error);
            tableBody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-danger">データの取得に失敗しました。</td></tr>';
        }
    }

    function renderTable(items) {
        if (items.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="8" class="text-center py-4 text-muted">申請は見つかりませんでした。</td></tr>';
            return;
        }

        tableBody.innerHTML = items.map(item => `
      <tr>
        <td>${formatDateTime(item.created_at)}</td>
        <td>${formatDate(item.date)}</td>
        <td><strong>${item.staff_name || '不明'}</strong></td>
        <td>${item.title}</td>
        <td class="amount-cell">¥${item.amount.toLocaleString()}</td>
        <td>${translateCategory(item.category)}</td>
        <td><span class="status-badge status-${item.status}">${translateStatus(item.status)}</span></td>
        <td>
          <button class="btn btn-outline btn-sm" onclick="showDetail('${item.id}')">
            詳細
          </button>
        </td>
      </tr>
    `).join('');
    }

    // グローバル関数として公開
    window.showDetail = async (id) => {
        selectedId = id;
        const item = currentItems.find(i => i.id === id);
        if (!item) return;

        modalContent.innerHTML = `
      <div class="detail-grid">
        <div class="detail-label">申請ID</div><div class="detail-value">${item.id}</div>
        <div class="detail-label">申請者</div><div class="detail-value">${item.staff_name} (${item.staff_id})</div>
        <div class="detail-label">利用日</div><div class="detail-value">${formatDate(item.date)}</div>
        <div class="detail-label">項目</div><div class="detail-value">${item.title}</div>
        <div class="detail-label">金額</div><div class="detail-value"><strong>¥${item.amount.toLocaleString()}</strong></div>
        <div class="detail-label">カテゴリ</div><div class="detail-value">${translateCategory(item.category)}</div>
        <div class="detail-label">備考</div><div class="detail-value">${item.description || '-'}</div>
      </div>
      <div class="receipt-preview">
        <div class="detail-label mb-2">領収書イメージ:</div>
        <a href="${item.receipt_url}" target="_blank">
          <img src="${item.receipt_url}" alt="領収書" onerror="this.src='/images/no-image.png'">
        </a>
      </div>
      <div class="review-section">
        <label class="detail-label">審査コメント:</label>
        <textarea id="review-comment" class="comment-area" rows="3" placeholder="差し戻し理由や承認時の注意点など">${item.review_comments || ''}</textarea>
      </div>
    `;

        // ボタンの制御
        btnApprove.style.display = item.status === 'pending' ? 'inline-block' : 'none';
        btnReject.style.display = item.status === 'pending' ? 'inline-block' : 'none';
        btnMarkPaid.style.display = item.status === 'approved' ? 'inline-block' : 'none';

        detailModal.classList.add('active');
    };

    closeModalBtn.addEventListener('click', () => detailModal.classList.remove('active'));

    // アクション処理
    async function processAction(status) {
        if (!selectedId) return;
        const comment = document.getElementById('review-comment').value;

        try {
            const response = await fetch(`${API_BASE}/reimbursements/${selectedId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${window.CognitoAuth.getIdToken()}`
                },
                body: JSON.stringify({
                    status: status,
                    review_comments: comment,
                    reviewer_id: user.id || 'admin'
                })
            });

            if (!response.ok) throw new Error('更新失敗');

            showToast('処理が完了しました。');
            detailModal.classList.remove('active');
            loadReimbursements();
        } catch (error) {
            showToast('エラーが発生しました。', 'error');
        }
    }

    btnApprove.addEventListener('click', () => processAction('approved'));
    btnReject.addEventListener('click', () => processAction('rejected'));
    btnMarkPaid.addEventListener('click', () => processAction('paid'));

    // ユーティリティ
    function formatDate(d) { return new Date(d).toLocaleDateString(); }
    function formatDateTime(d) { return new Date(d).toLocaleString(); }
    function translateStatus(s) {
        const map = { 'pending': '申請中', 'approved': '承認済み', 'rejected': '否認済み', 'paid': '精算完了' };
        return map[s] || s;
    }
    function translateCategory(c) {
        return { 'transportation': '交通費', 'supplies': '消耗品', 'entertainment': '交際費', 'travel': '出張', 'other': 'その他' }[c] || c;
    }
    function showToast(msg) {
        const container = document.getElementById('toast-container');
        const t = document.createElement('div');
        t.className = 'toast';
        t.innerHTML = `<i class="fas fa-info-circle"></i><span>${msg}</span>`;
        container.appendChild(t);
        setTimeout(() => t.remove(), 3000);
    }
});
