(async () => {
    const API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';
    const REPORT_API = 'https://2z0ui5xfxb.execute-api.ap-northeast-1.amazonaws.com/prod';

    const urlParams = new URLSearchParams(window.location.search);
    const storeId = urlParams.get('store_id');

    if (!storeId) {
        alert('店舗IDが指定されていません');
        window.history.back();
        return;
    }

    const loading = document.getElementById('loading');
    const content = document.getElementById('karte-content');

    try {
        // 認証ヘッダーの取得（Firebaseトークンまわりは共有JSに依存、ここでは簡易的にlocalStorageからも試行）
        let idToken = localStorage.getItem('id_token'); // 仮置き
        // 実際には getFirebaseIdToken() が必要だが、グローバルにない場合はスキップされる
        if (typeof window.getFirebaseIdToken === 'function') {
            idToken = await window.getFirebaseIdToken();
        }
        const headers = idToken ? { 'Authorization': `Bearer ${idToken}` } : {};

        // データの並列取得
        const [storesRes, kartesRes, reportsRes] = await Promise.all([
            fetch(`${API_BASE}/stores`, { headers }),
            fetch(`${API_BASE}/kartes?store_id=${storeId}`, { headers }),
            fetch(`${REPORT_API}/staff/reports?limit=1000`, { headers }) // 本来はstore_idでフィルタしたいが全取得してJSでフィルタ
        ]);

        const allStores = await storesRes.json();
        const stores = Array.isArray(allStores) ? allStores : (allStores.items || []);
        const store = stores.find(s => String(s.store_id || s.id) === String(storeId));

        const karteData = await kartesRes.json();
        const latestKarte = Array.isArray(karteData) ? karteData[0] : (karteData.items ? karteData.items[0] : karteData);

        const reportsData = await reportsRes.json();
        const allReports = Array.isArray(reportsData) ? reportsData : (reportsData.items || []);
        const storeReports = allReports
            .filter(r => String(r.store_id) === String(storeId))
            .sort((a, b) => new Date(b.cleaning_date) - new Date(a.cleaning_date));

        // UI反映：基本情報
        if (store) {
            document.getElementById('store-name').textContent = store.store_name || store.name || '不明な店舗';
            document.getElementById('store-address').innerHTML = `<i class="fas fa-map-marker-alt"></i> ${store.address || '住所未登録'}`;
            document.getElementById('store-tel').textContent = store.phone || store.tel || '-';
            document.getElementById('store-manager').textContent = store.manager_name || '-';
            // ブランド名取得
            if (store.brand_id && window.DataUtils) {
                // DataUtilsがあれば利用
            }
        }

        // UI反映：注意事項（最新のカルテデータから）
        const instructionList = document.getElementById('instruction-list');
        instructionList.innerHTML = '';

        const instructions = [
            { label: 'ブレーカー位置', value: latestKarte?.breaker_location || latestKarte?.equipment?.find(e => e.includes('ブレーカー')) ? '別途詳細確認' : '未登録' },
            { label: 'ゴミ出しルール', value: latestKarte?.trash_rule || '未登録' },
            { label: '鍵の管理', value: latestKarte?.key_management || '未登録' },
            { label: '特記事項', value: latestKarte?.notes || 'なし' }
        ];

        instructions.forEach(ins => {
            const card = document.createElement('div');
            card.className = 'instruction-card';
            card.innerHTML = `
        <div class="info-label">${ins.label}</div>
        <div class="info-value" style="font-weight: 400; font-size: 0.9rem;">${ins.value.replace(/\n/g, '<br>')}</div>
      `;
            instructionList.appendChild(card);
        });

        // UI反映：レポート履歴
        const historyList = document.getElementById('history-list');
        historyList.innerHTML = '';

        if (storeReports.length === 0) {
            historyList.innerHTML = '<div class="empty-state">過去のレポートはありません</div>';
        } else {
            storeReports.forEach(report => {
                const dateStr = report.cleaning_date ? new Date(report.cleaning_date).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '日付不明';
                const card = document.createElement('a');
                card.className = 'history-card';
                card.href = `/staff/os/reports/view/?id=${report.report_id || report.id}`;
                card.innerHTML = `
          <div class="history-info">
            <div class="history-date">${dateStr}</div>
            <div class="history-staff">${report.staff_name || '清掃スタッフ'}</div>
          </div>
          <i class="fas fa-chevron-right" style="color: #d1d5db;"></i>
        `;
                historyList.appendChild(card);
            });
        }

        loading.style.display = 'none';
        content.style.display = 'block';

    } catch (error) {
        console.error('Karte loading error:', error);
        alert('カルテの読み込みに失敗しました');
        loading.style.display = 'none';
    }
})();
