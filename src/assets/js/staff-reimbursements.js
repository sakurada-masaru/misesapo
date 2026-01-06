/**
 * 立て替え精算申請ロジック
 */
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

    const staffId = user.id || user.uid || user.username;
    const staffName = user.display_name || user.name || 'スタッフ';

    // DOM要素
    const form = document.getElementById('reimbursement-form');
    const receiptInput = document.getElementById('receipt');
    const receiptDropZone = document.getElementById('receipt-drop-zone');
    const uploadPlaceholder = document.getElementById('upload-placeholder');
    const uploadPreview = document.getElementById('upload-preview');
    const previewImg = document.getElementById('preview-img');
    const removeFileBtn = document.getElementById('remove-file-btn');
    const submitBtn = document.getElementById('submit-btn');
    const historyList = document.getElementById('history-list');
    const refreshHistoryBtn = document.getElementById('refresh-history');

    let selectedFile = null;

    // 初期ロード：履歴取得
    loadHistory();

    // ファイル選択のイベント
    receiptDropZone.addEventListener('click', () => receiptInput.click());

    receiptInput.addEventListener('change', (e) => {
        handleFileSelect(e.target.files[0]);
    });

    receiptDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        receiptDropZone.classList.add('drag-over');
    });

    receiptDropZone.addEventListener('dragleave', () => {
        receiptDropZone.classList.remove('drag-over');
    });

    receiptDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        receiptDropZone.classList.remove('drag-over');
        handleFileSelect(e.dataTransfer.files[0]);
    });

    removeFileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clearFile();
    });

    function handleFileSelect(file) {
        if (!file) return;
        if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
            showToast('画像またはPDFファイルを選択してください。', 'error');
            return;
        }

        selectedFile = file;

        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                previewImg.src = e.target.result;
                uploadPlaceholder.style.display = 'none';
                uploadPreview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        } else {
            // PDFの場合の簡易表示
            previewImg.src = '/images/pdf-icon.png'; // 仮のアイコン
            uploadPlaceholder.style.display = 'none';
            uploadPreview.style.display = 'block';
        }

        checkFormValidity();
    }

    function clearFile() {
        selectedFile = null;
        receiptInput.value = '';
        previewImg.src = '';
        uploadPlaceholder.style.display = 'block';
        uploadPreview.style.display = 'none';
        checkFormValidity();
    }

    // フォームのバリデーション
    form.addEventListener('input', checkFormValidity);

    function checkFormValidity() {
        const isValid = form.checkValidity() && selectedFile;
        submitBtn.disabled = !isValid;
    }

    // 申請送信
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!selectedFile) return;

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 送信中...';

        try {
            // 1. 領収書のアップロード（S3等）
            // ここでは既存のs3_upload等の仕組みを模倣するか、直接APIに含める
            // 今回は仕様として「receipt_url」が必要なので、まずアップロード処理を行うと仮定
            const receiptUrl = await uploadReceipt(selectedFile);

            // 2. 申請データの登録
            const data = {
                staff_id: staffId,
                staff_name: staffName,
                date: document.getElementById('date').value,
                category: document.getElementById('category').value,
                title: document.getElementById('title').value,
                amount: parseInt(document.getElementById('amount').value),
                description: document.getElementById('description').value,
                receipt_url: receiptUrl,
                status: 'pending'
            };

            const response = await fetch('/api/reimbursements', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${window.CognitoAuth.getIdToken()}`
                },
                body: json.stringify(data)
            });

            if (!response.ok) throw new Error('申請に失敗しました。');

            showToast('申請が完了しました。', 'success');
            form.reset();
            clearFile();
            loadHistory();
        } catch (error) {
            console.error(error);
            showToast('エラーが発生しました：' + error.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> 申請する';
        }
    });

    // 履歴読み込み
    async function loadHistory() {
        historyList.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> 読み込み中...</div>';

        try {
            const response = await fetch(`/api/reimbursements?staff_id=${staffId}&limit=10`, {
                headers: {
                    'Authorization': `Bearer ${window.CognitoAuth.getIdToken()}`
                }
            });

            if (!response.ok) throw new Error('履歴の取得に失敗しました。');

            const { reimbursements } = await response.json();

            if (!reimbursements || reimbursements.length === 0) {
                historyList.innerHTML = '<div class="empty-state">履歴はありません。</div>';
                return;
            }

            historyList.innerHTML = reimbursements.map(item => `
        <div class="history-item">
          <div class="history-header">
            <span class="history-date">${formatDate(item.date)}</span>
            <span class="status-badge status-${item.status}">${translateStatus(item.status)}</span>
          </div>
          <div class="history-content">
            <span class="history-title">${item.title}</span>
            <span class="history-amount">¥${item.amount.toLocaleString()}</span>
          </div>
          <div class="history-meta">
            <span><i class="fas fa-tag"></i> ${translateCategory(item.category)}</span>
            ${item.review_comments ? `<span><i class="fas fa-comment-dots"></i> ${item.review_comments}</span>` : ''}
          </div>
        </div>
      `).join('');
        } catch (error) {
            console.error(error);
            historyList.innerHTML = '<div class="error-state">データの取得に失敗しました。</div>';
        }
    }

    refreshHistoryBtn.addEventListener('click', loadHistory);

    // ユーティリティ
    function formatDate(dateStr) {
        const d = new Date(dateStr);
        return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    }

    function translateStatus(status) {
        const map = {
            'pending': '申請中',
            'approved': '承認済み',
            'rejected': '差し戻し',
            'paid': '精算完了'
        };
        return map[status] || status;
    }

    function translateCategory(cat) {
        const map = {
            'transportation': '交通費',
            'supplies': '消耗品費',
            'entertainment': '接待交際費',
            'travel': '出張費',
            'other': 'その他'
        };
        return map[cat] || cat;
    }

    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
      <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
      <span>${message}</span>
    `;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // 仮の画像アップロード関数
    async function uploadReceipt(file) {
        // 実際には FormData を使用して S3 等へアップロードし、その URL を返す
        // ここでは開発環境用のデモパスを返す
        console.log('Uploading file:', file.name);
        return `/uploads/receipts/${Date.now()}_${file.name}`;
    }
});
