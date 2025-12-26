/**
 * Customer Dashboard Logic
 * Responsible for fetching store vitals, recent reports, and AI advisor state.
 */

const API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';
const KARTE_API = 'https://psm6ndh457.execute-api.ap-northeast-1.amazonaws.com/prod';

async function initDashboard() {
    console.log('Initializing Customer Dashboard...');

    // 1. Check Authentication (Client only)
    const authData = window.Auth?.getAuthData?.();
    if (!authData || !authData.user) {
        console.warn('User not authenticated. Redirecting to signin...');
        // window.location.href = '/signin.html';
        // return;
    }

    // 2. Mock Data for Prototype (Integration with real API pending)
    const clientData = {
        company_name: '株式会社グローバルダイニング',
        stores: [
            { id: 'ST00184', name: '代官山 権八', grade: 'A', last_cleaning: '2025-12-20', status: 'Healthy' },
            { id: 'ST00185', name: '西麻布 権八', grade: 'B', last_cleaning: '2025-12-15', status: 'Warning' },
            { id: 'ST00186', name: '渋谷 モンスーンカフェ', grade: 'C', last_cleaning: '2025-12-01', status: 'Action Required' }
        ]
    };

    // 3. Render Header
    document.getElementById('client-company-name').textContent = clientData.company_name;

    // 4. Load Store Status
    renderStoreGrid(clientData.stores);

    // 5. Load Recent Reports
    loadRecentReports();

    // 6. Update AI Advisor Greeting (Randomized for prototype)
    const greetings = [
        '代官山店のレンジフードが前回の清掃から3ヶ月経過しました。効率低下を防ぐため、点検をお勧めします。',
        '今週は全店舗の清潔度が維持されています。素晴らしい管理状態ですね！',
        '西麻布店で先程提出されたレポートに、軽微な設備修繕の提案がAIから届いています。'
    ];
    document.getElementById('ai-greeting').textContent = greetings[Math.floor(Math.random() * greetings.length)];
}

function renderStoreGrid(stores) {
    const grid = document.getElementById('store-status-grid');
    if (!grid) return;
    grid.innerHTML = '';

    stores.forEach(store => {
        const card = document.createElement('div');
        card.className = 'store-status-card';
        card.onclick = () => window.location.href = `/customer/karte?store_id=${store.id}`;

        card.innerHTML = `
            <div class="store-info">
                <h3 class="store-name">${store.name}</h3>
                <div class="store-meta">最終清掃: ${store.last_cleaning}</div>
            </div>
            <div class="store-vitals">
                <div>
                    <div class="health-label">Cleanliness</div>
                    <div class="health-badge grade-${store.grade}">${store.grade}</div>
                </div>
                <div style="text-align: right">
                    <div class="health-label">Status</div>
                    <div style="font-weight: 700; color: ${store.grade === 'A' ? '#16a34a' : (store.grade === 'B' ? '#ca8a04' : '#e11d48')}">
                        ${store.status}
                    </div>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

async function loadRecentReports() {
    const list = document.getElementById('recent-report-list');
    if (!list) return;

    // Mock response from cleaning_reports.json integration
    const reports = [
        { id: 'REP001', store: '代官山 権八', date: '2025.12.20', type: 'レンジフード洗浄' },
        { id: 'REP002', store: '西麻布 権八', date: '2025.12.18', type: 'グリストラップ清掃' },
        { id: 'REP003', store: '渋谷 モンスーン', date: '2025.12.15', type: '定期清掃' }
    ];

    list.innerHTML = '';
    reports.forEach(rep => {
        const item = document.createElement('div');
        item.className = 'activity-item';
        item.innerHTML = `
            <div class="activity-icon"><i class="fas fa-file-alt"></i></div>
            <div class="activity-content">
                <div class="activity-title">${rep.store} - ${rep.type}</div>
                <div class="activity-time">${rep.date} · 完了</div>
            </div>
        `;
        item.onclick = () => window.location.href = `/customer/reports/${rep.id}.html`;
        list.appendChild(item);
    });
}

document.addEventListener('DOMContentLoaded', initDashboard);
