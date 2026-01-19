// URLからレポートIDを取得
function getReportIdFromUrl() {
    const path = window.location.pathname;
    // /reports/shared/{id} の形式からIDを取得
    const match = path.match(/\/reports\/shared\/([^\/]+)/);
    return match ? match[1] : null;
}

// ページ読み込み時に直接レポート表示ページにリダイレクト
window.addEventListener('DOMContentLoaded', function() {
    const reportId = getReportIdFromUrl();
    if (reportId) {
        // /view が含まれていない場合のみリダイレクト（無限ループを防ぐ）
        if (!window.location.pathname.includes('/view')) {
            const cleanId = reportId.replace('.html', '');
            window.location.href = `/reports/shared/${cleanId}/view`;
            return;
        }
    }
});

// フォーム送信処理（このページは使用されなくなりましたが、念のため残しておきます）
const form = document.getElementById('viewer-info-form');
if (form) {
    form.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const reportId = getReportIdFromUrl();
    if (!reportId) {
        alert('レポートIDが取得できませんでした');
        return;
    }

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = '送信中...';

    // フォームデータを取得
    const formData = new FormData(e.target);
    const viewerInfo = {
        last_name: formData.get('last_name'),
        first_name: formData.get('first_name'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        company: formData.get('company') || '',
        postal_code: formData.get('postal_code') || '',
        prefecture: formData.get('prefecture') || '',
        address: formData.get('address') || '',
        building: formData.get('building') || '',
        message: formData.get('message') || '',
        service_interest: formData.get('service_interest') || '',
        contact_method: formData.getAll('contact_method')
    };

    // バリデーション
    if (!viewerInfo.last_name || !viewerInfo.first_name || !viewerInfo.email || !viewerInfo.phone) {
        alert('必須項目を入力してください');
        submitBtn.disabled = false;
        submitBtn.textContent = 'レポートを閲覧する';
        return;
    }

    // ローカルストレージに保存（将来的にAPIに送信）
    localStorage.setItem(`report_viewer_${reportId}`, JSON.stringify(viewerInfo));

    // レポート表示ページに遷移
    // reportIdから.htmlを削除（もし含まれている場合）
    const cleanId = reportId.replace('.html', '');
    window.location.href = `/reports/shared/${cleanId}/view`;
    });
}

// 入力済み情報があれば復元（このページは使用されなくなりましたが、念のため残しておきます）
const formForRestore = document.getElementById('viewer-info-form');
if (formForRestore) {
    const reportId = getReportIdFromUrl();
    if (reportId && !window.location.pathname.includes('/view')) {
        const saved = localStorage.getItem(`report_viewer_${reportId}`);
        if (saved) {
            try {
                const info = JSON.parse(saved);
                if (info.last_name) document.getElementById('last-name').value = info.last_name;
                if (info.first_name) document.getElementById('first-name').value = info.first_name;
                if (info.email) document.getElementById('email').value = info.email;
                if (info.phone) document.getElementById('phone').value = info.phone;
                if (info.company) document.getElementById('company').value = info.company;
                if (info.postal_code) document.getElementById('postal-code').value = info.postal_code;
                if (info.prefecture) document.getElementById('prefecture').value = info.prefecture;
                if (info.address) document.getElementById('address').value = info.address;
                if (info.building) document.getElementById('building').value = info.building;
                if (info.message) document.getElementById('message').value = info.message;
                if (info.service_interest) {
                    const radio = document.querySelector(`input[name="service_interest"][value="${info.service_interest}"]`);
                    if (radio) radio.checked = true;
                }
                if (info.contact_method && Array.isArray(info.contact_method)) {
                    info.contact_method.forEach(method => {
                        const checkbox = document.querySelector(`input[name="contact_method"][value="${method}"]`);
                        if (checkbox) checkbox.checked = true;
                    });
                }
            } catch (e) {
                console.error('Failed to restore form data:', e);
            }
        }
    }
}


