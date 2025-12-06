const API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';

let allStores = [];
let allClients = [];
let allBrands = [];
let allSchedules = [];
let clientCurrentFilter = 'all';
let clientSearchQuery = '';
let selectedClientId = null;

// ローカルタイムゾーンで日付をYYYY-MM-DD形式の文字列に変換
function formatDateToYYYYMMDD(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// HTMLエスケープ
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Firebase ID Token取得
async function getFirebaseIdToken() {
  try {
    const cognitoIdToken = localStorage.getItem('cognito_id_token');
    if (cognitoIdToken) {
      return cognitoIdToken;
    }
    
    const authData = localStorage.getItem('misesapo_auth');
    if (authData) {
      const parsed = JSON.parse(authData);
      if (parsed.token) {
        return parsed.token;
      }
    }
    
    return 'mock-token';
  } catch (error) {
    console.error('Error getting Firebase ID token:', error);
    return 'mock-token';
  }
}

// データ読み込み
async function loadData() {
  try {
    const idToken = await getFirebaseIdToken();
    const headers = {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type': 'application/json'
    };
    
    const [storesRes, clientsRes, brandsRes, schedulesRes] = await Promise.all([
      fetch(`${API_BASE}/stores`, { headers }).catch(() => ({ ok: false })),
      fetch(`${API_BASE}/clients`, { headers }).catch(() => ({ ok: false })),
      fetch(`${API_BASE}/brands`, { headers }).catch(() => ({ ok: false })),
      fetch(`${API_BASE}/schedules`, { headers }).catch(() => ({ ok: false }))
    ]);
    
    if (storesRes.ok) {
      const storesData = await storesRes.json();
      allStores = Array.isArray(storesData) ? storesData : (storesData.items || storesData.stores || []);
    } else {
      console.warn('Failed to load stores:', storesRes.status, storesRes.statusText);
      allStores = [];
    }
    
    if (clientsRes.ok) {
      const clientsData = await clientsRes.json();
      if (Array.isArray(clientsData)) {
        allClients = clientsData;
      } else if (clientsData.items && Array.isArray(clientsData.items)) {
        allClients = clientsData.items;
      } else if (clientsData.clients && Array.isArray(clientsData.clients)) {
        allClients = clientsData.clients;
      } else {
        console.warn('Unexpected clients data format:', clientsData);
        allClients = [];
      }
    } else {
      console.warn('Failed to load clients');
      allClients = [];
    }
    
    if (brandsRes.ok) {
      const brandsData = await brandsRes.json();
      allBrands = Array.isArray(brandsData) ? brandsData : (brandsData.items || brandsData.brands || []);
    } else {
      console.warn('Failed to load brands:', brandsRes.status, brandsRes.statusText);
      allBrands = [];
    }
    
    if (schedulesRes.ok) {
      try {
        const schedulesData = await schedulesRes.json();
        allSchedules = Array.isArray(schedulesData) ? schedulesData : (schedulesData.items || schedulesData.schedules || []);
      } catch (jsonError) {
        console.error('Error parsing schedules JSON:', jsonError);
        allSchedules = [];
      }
    } else {
      console.warn('Failed to load schedules:', schedulesRes.status, schedulesRes.statusText);
      allSchedules = [];
    }
    
    renderClientList();
  } catch (error) {
    console.error('Failed to load data:', error);
  }
}

// 顧客管理タブの切り替え
function setupClientTabs() {
  const clientTabs = document.querySelectorAll('.client-tab');
  
  clientTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const clickedTab = tab.dataset.clientTab;
      
      const allClientTabs = document.querySelectorAll('.client-tab');
      const allClientContents = document.querySelectorAll('.client-tab-content');
      
      allClientTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      allClientContents.forEach(content => {
        content.classList.remove('active');
        if (content.dataset.clientContent === clickedTab) {
          content.classList.add('active');
        }
      });
      
      // 顧客一覧タブの場合、顧客一覧を再表示
      if (clickedTab === 'list') {
        renderClientList();
      }
    });
  });
  
  // 顧客一覧のフィルターと検索のイベントリスナー
  const filterTabs = document.querySelectorAll('.client-filter-tab');
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      clientCurrentFilter = tab.dataset.clientFilter;
      renderClientList();
    });
  });
  
  const searchInput = document.getElementById('client-list-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clientSearchQuery = e.target.value;
      renderClientList();
    });
  }
}

// 顧客一覧の表示
function renderClientList() {
  const container = document.getElementById('client-list-container');
  if (!container) return;
  
  let filtered = allStores.filter(store => {
    // ステータスフィルター
    if (clientCurrentFilter !== 'all') {
      const status = store.status || '稼働中';
      if (status !== clientCurrentFilter) return false;
    }
    
    // 検索フィルター
    if (clientSearchQuery) {
      const clientName = getClientName(store.client_id) || '';
      const brandName = getBrandName(store.brand_id) || '';
      const searchText = `${store.name || ''} ${clientName} ${brandName}`.toLowerCase();
      if (!searchText.includes(clientSearchQuery.toLowerCase())) return false;
    }
    
    return true;
  });
  
  // 統計更新
  const totalCountEl = document.getElementById('client-total-count');
  const activeCountEl = document.getElementById('client-active-count');
  if (totalCountEl) totalCountEl.textContent = allStores.length;
  if (activeCountEl) activeCountEl.textContent = allStores.filter(s => s.status === '稼働中' || !s.status).length;
  
  if (filtered.length === 0) {
    container.innerHTML = '<div class="loading">該当する顧客がありません</div>';
    return;
  }
  
  container.innerHTML = filtered.map(store => {
    const status = store.status || '稼働中';
    const clientName = getClientName(store.client_id) || '';
    const brandName = getBrandName(store.brand_id) || '';
    
    return `
      <div class="client-card" onclick="viewClientDetail('${store.id}')">
        <div class="client-card-header">
          <div>
            <div class="client-store-name">${escapeHtml(store.name || '店舗名なし')}</div>
            <div class="client-company-name">${escapeHtml(clientName)}${brandName ? ' / ' + escapeHtml(brandName) : ''}</div>
          </div>
          <span class="client-status-badge client-status-${status}">${status}</span>
        </div>
        <div class="client-card-info">
          ${store.pref ? `<div class="client-info-item"><i class="fas fa-map-marker-alt"></i>${escapeHtml(store.pref)}</div>` : ''}
          ${store.phone ? `<div class="client-info-item"><i class="fas fa-phone"></i>${escapeHtml(store.phone)}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function getClientName(clientId) {
  if (!clientId) return '';
  let c = null;
  if (window.DataUtils?.EntityFinder?.findClient) {
    c = window.DataUtils.EntityFinder.findClient(allClients, clientId);
  } else {
    c = allClients.find(x => x.id === clientId || String(x.id) === String(clientId));
  }
  return c ? (c.name || c.company_name || '') : '';
}

function getBrandName(brandId) {
  if (!brandId) return '';
  let b = null;
  if (window.DataUtils?.EntityFinder?.findBrand) {
    b = window.DataUtils.EntityFinder.findBrand(allBrands, brandId);
  } else {
    b = allBrands.find(x => x.id === brandId || String(x.id) === String(brandId));
  }
  return b ? b.name : '';
}

// 顧客詳細表示
async function viewClientDetail(id) {
  selectedClientId = id;
  const listView = document.getElementById('client-list-view');
  const detailView = document.getElementById('client-detail-view');
  const detailContent = document.getElementById('client-detail-content');
  
  if (!listView || !detailView || !detailContent) return;
  
  // ビューを切り替え
  listView.style.display = 'none';
  detailView.style.display = 'block';
  detailContent.innerHTML = '<div class="loading">読み込み中...</div>';
  
  // 顧客詳細データを取得
  try {
    let store = null;
    if (window.DataUtils?.EntityFinder?.findStore) {
      store = window.DataUtils.EntityFinder.findStore(allStores, id);
    } else {
      store = allStores.find(s => s.id === id || String(s.id) === String(id));
    }
    if (!store) {
      detailContent.innerHTML = '<div class="loading">顧客情報が見つかりません</div>';
      return;
    }
    
    let client = null;
    if (window.DataUtils?.EntityFinder?.findClient) {
      client = window.DataUtils.EntityFinder.findClient(allClients, store.client_id);
    } else {
      client = allClients.find(c => c.id === store.client_id || String(c.id) === String(store.client_id));
    }
    
    let brand = null;
    if (window.DataUtils?.EntityFinder?.findBrand) {
      brand = window.DataUtils.EntityFinder.findBrand(allBrands, store.brand_id);
    } else {
      brand = allBrands.find(b => b.id === store.brand_id || String(b.id) === String(store.brand_id));
    }
    
    // スケジュールから次回清掃日を取得
    const DataUtils = window.DataUtils || {};
    const nextSchedule = allSchedules
      .filter(s => {
        const normalized = DataUtils.normalizeSchedule ? DataUtils.normalizeSchedule(s) : s;
        const scheduleStoreId = normalized.store_id || s.store_id || s.client_id;
        const statusMatch = normalized.status === 'scheduled' || normalized.status === 'draft';
        if (window.DataUtils?.IdUtils?.isSame) {
          return window.DataUtils.IdUtils.isSame(scheduleStoreId, id) && statusMatch;
        } else {
          return (scheduleStoreId === id || String(scheduleStoreId) === String(id)) && statusMatch;
        }
      })
      .sort((a, b) => {
        const normalizedA = DataUtils.normalizeSchedule ? DataUtils.normalizeSchedule(a) : a;
        const normalizedB = DataUtils.normalizeSchedule ? DataUtils.normalizeSchedule(b) : b;
        let dateA = normalizedA.date || a.date || a.scheduled_date || '';
        let dateB = normalizedB.date || b.date || b.scheduled_date || '';
        
        if (dateA instanceof Date) {
          dateA = formatDateToYYYYMMDD(dateA);
        } else if (dateA && typeof dateA !== 'string') {
          dateA = formatDateToYYYYMMDD(new Date(dateA));
        } else if (dateA && dateA.includes('T')) {
          dateA = formatDateToYYYYMMDD(new Date(dateA));
        } else if (dateA && !dateA.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const dateObj = new Date(dateA);
          if (!isNaN(dateObj.getTime())) {
            dateA = formatDateToYYYYMMDD(dateObj);
          }
        }
        if (dateB instanceof Date) {
          dateB = formatDateToYYYYMMDD(dateB);
        } else if (dateB && typeof dateB !== 'string') {
          dateB = formatDateToYYYYMMDD(new Date(dateB));
        } else if (dateB && dateB.includes('T')) {
          dateB = formatDateToYYYYMMDD(new Date(dateB));
        } else if (dateB && !dateB.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const dateObj = new Date(dateB);
          if (!isNaN(dateObj.getTime())) {
            dateB = formatDateToYYYYMMDD(dateObj);
          }
        }
        
        return (dateA || '').localeCompare(dateB || '');
      })[0];
    
    let nextDateFormatted = '未設定';
    if (nextSchedule) {
      const normalized = DataUtils.normalizeSchedule ? DataUtils.normalizeSchedule(nextSchedule) : nextSchedule;
      const nextDate = normalized.date || nextSchedule.date || nextSchedule.scheduled_date || '';
      if (nextDate) {
        try {
          nextDateFormatted = new Date(nextDate).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
        } catch (e) {
          nextDateFormatted = nextDate;
        }
      }
    }
    
    // 編集ボタンのリンクを設定
    const editBtn = document.getElementById('client-detail-edit-btn');
    if (editBtn) {
      editBtn.onclick = () => {
        window.location.href = `/sales/clients/${id}/edit.html`;
      };
    }
    
    // 顧客詳細をレンダリング
    const status = store.status || '稼働中';
    const clientName = client ? client.name : '';
    const brandName = brand ? brand.name : '';
    
    detailContent.innerHTML = `
      <div class="client-detail-card">
        <div class="client-detail-header-info">
          <div class="client-detail-main-info">
            <h3 class="client-detail-company">${escapeHtml(clientName)}</h3>
            <div class="client-detail-store">${escapeHtml(store.name || '店舗名なし')}</div>
            ${brandName ? `<div class="client-detail-brand">${escapeHtml(brandName)}</div>` : ''}
          </div>
          <span class="client-detail-status-badge client-status-${status}">${status}</span>
        </div>
        
        <div class="client-detail-info-grid">
          <div class="client-detail-info-section">
            <h4 class="client-detail-section-title">
              <i class="fas fa-building"></i> 基本情報
            </h4>
            <div class="client-detail-info-item">
              <span class="client-detail-info-label">会社名</span>
              <span class="client-detail-info-value">${escapeHtml(clientName)}</span>
            </div>
            ${brandName ? `
            <div class="client-detail-info-item">
              <span class="client-detail-info-label">ブランド名</span>
              <span class="client-detail-info-value">${escapeHtml(brandName)}</span>
            </div>
            ` : ''}
            <div class="client-detail-info-item">
              <span class="client-detail-info-label">店舗名</span>
              <span class="client-detail-info-value">${escapeHtml(store.name || '店舗名なし')}</span>
            </div>
            ${store.pref ? `
            <div class="client-detail-info-item">
              <span class="client-detail-info-label">都道府県</span>
              <span class="client-detail-info-value">${escapeHtml(store.pref)}</span>
            </div>
            ` : ''}
            <div class="client-detail-info-item">
              <span class="client-detail-info-label">ステータス</span>
              <span class="client-detail-info-value client-status-${status}">${status}</span>
            </div>
          </div>
          
          <div class="client-detail-info-section">
            <h4 class="client-detail-section-title">
              <i class="fas fa-user"></i> 連絡先
            </h4>
            ${store.phone ? `
            <div class="client-detail-info-item">
              <span class="client-detail-info-label">電話番号</span>
              <span class="client-detail-info-value">
                <a href="tel:${escapeHtml(store.phone)}">${escapeHtml(store.phone)}</a>
              </span>
            </div>
            ` : ''}
            ${store.contact_person ? `
            <div class="client-detail-info-item">
              <span class="client-detail-info-label">担当者名</span>
              <span class="client-detail-info-value">${escapeHtml(store.contact_person)}</span>
            </div>
            ` : ''}
            ${store.email ? `
            <div class="client-detail-info-item">
              <span class="client-detail-info-label">メールアドレス</span>
              <span class="client-detail-info-value">
                <a href="mailto:${escapeHtml(store.email)}">${escapeHtml(store.email)}</a>
              </span>
            </div>
            ` : ''}
          </div>
          
          <div class="client-detail-info-section">
            <h4 class="client-detail-section-title">
              <i class="fas fa-calendar-alt"></i> 清掃情報
            </h4>
            <div class="client-detail-info-item">
              <span class="client-detail-info-label">次回清掃日</span>
              <span class="client-detail-info-value">${nextDateFormatted}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="client-detail-actions">
        <h4 class="client-detail-section-title">クイックアクション</h4>
        <div class="client-detail-action-buttons">
          <a href="/sales/estimates/new?client_id=${id}" class="client-detail-action-btn">
            <i class="fas fa-file-invoice"></i>
            <span>見積もり作成</span>
          </a>
          <a href="/sales/orders?client_id=${id}" class="client-detail-action-btn">
            <i class="fas fa-shopping-cart"></i>
            <span>発注履歴</span>
          </a>
          ${store.email ? `
          <a href="mailto:${escapeHtml(store.email)}" class="client-detail-action-btn">
            <i class="fas fa-envelope"></i>
            <span>メール送信</span>
          </a>
          ` : ''}
        </div>
      </div>
    `;
  } catch (error) {
    console.error('Failed to load client detail:', error);
    detailContent.innerHTML = '<div class="loading">エラーが発生しました</div>';
  }
}

function showClientList() {
  const listView = document.getElementById('client-list-view');
  const detailView = document.getElementById('client-detail-view');
  
  if (listView && detailView) {
    listView.style.display = 'block';
    detailView.style.display = 'none';
    selectedClientId = null;
  }
}

function editClientDetail() {
  if (selectedClientId) {
    window.location.href = `/sales/clients/${selectedClientId}/edit.html`;
  }
}

// 顧客登録
async function submitClient() {
  const companyName = document.getElementById('client-company').value.trim();
  const brandName = document.getElementById('client-brand').value.trim();
  const storeName = document.getElementById('client-store').value.trim();
  
  if (!companyName || !storeName) {
    alert('企業名と店舗名は必須です');
    return;
  }
  
  try {
    // 1. 法人を検索または作成
    let clientId = null;
    const clientsRes = await fetch(`${API_BASE}/clients`);
    if (!clientsRes.ok) {
      throw new Error('法人一覧の取得に失敗しました');
    }
    const clientsData = await clientsRes.json();
    const clients = Array.isArray(clientsData) ? clientsData : (clientsData.items || clientsData.clients || []);
    const existingClient = clients.find(c => c.name === companyName);
    
    if (existingClient) {
      clientId = existingClient.id;
    } else {
      // 新規法人作成
      const clientRes = await fetch(`${API_BASE}/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: companyName,
          type: 'company',
          status: 'active',
          created_at: new Date().toISOString()
        })
      });
      if (!clientRes.ok) {
        const errorData = await clientRes.json().catch(() => ({}));
        throw new Error(`法人の作成に失敗しました: ${errorData.error || clientRes.statusText}`);
      }
      const clientData = await clientRes.json();
      clientId = clientData.id;
    }
    
    if (!clientId) {
      throw new Error('法人IDの取得に失敗しました');
    }
    
    // 2. ブランドを検索または作成
    let brandId = null;
    if (brandName) {
      const brandsRes = await fetch(`${API_BASE}/brands`);
      if (!brandsRes.ok) {
        throw new Error('ブランド一覧の取得に失敗しました');
      }
      const brandsData = await brandsRes.json();
      const brands = Array.isArray(brandsData) ? brandsData : (brandsData.items || brandsData.brands || []);
      let existingBrand = null;
      if (window.DataUtils?.IdUtils?.isSame) {
        existingBrand = brands.find(b => b.name === brandName && window.DataUtils.IdUtils.isSame(b.client_id, clientId));
      } else {
        existingBrand = brands.find(b => b.name === brandName && (b.client_id === clientId || String(b.client_id) === String(clientId)));
      }
      
      if (existingBrand) {
        brandId = existingBrand.id;
      } else {
        // 新規ブランド作成
        const brandRes = await fetch(`${API_BASE}/brands`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: brandName,
            client_id: clientId,
            status: 'active',
            created_at: new Date().toISOString()
          })
        });
        if (!brandRes.ok) {
          const errorData = await brandRes.json().catch(() => ({}));
          throw new Error(`ブランドの作成に失敗しました: ${errorData.error || brandRes.statusText}`);
        }
        const brandData = await brandRes.json();
        brandId = brandData.id;
      }
    }
    
    // 3. 店舗を作成
    const storeData = {
      name: storeName,
      client_id: clientId,
      brand_id: brandId,
      pref: document.getElementById('client-pref').value,
      city: '',
      address1: document.getElementById('client-address').value,
      postcode: document.getElementById('client-postcode').value,
      phone: document.getElementById('client-phone').value,
      email: document.getElementById('client-email').value,
      contact_person: document.getElementById('client-contact').value,
      notes: document.getElementById('client-notes').value,
      status: 'active',
      registration_type: 'sales',
      created_at: new Date().toISOString()
    };
    
    const storeRes = await fetch(`${API_BASE}/stores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(storeData)
    });
    
    if (!storeRes.ok) {
      const errorData = await storeRes.json().catch(() => ({}));
      throw new Error(`店舗の作成に失敗しました: ${errorData.error || storeRes.statusText}`);
    }
    
    alert('顧客を登録しました');
    // フォームクリア
    document.querySelectorAll('#client-company, #client-brand, #client-store, #client-postcode, #client-address, #client-phone, #client-contact, #client-email, #client-notes').forEach(el => el.value = '');
    document.getElementById('client-pref').value = '';
    await loadData();
    renderClientList();
  } catch (e) {
    console.error('Customer registration error:', e);
    alert(`登録に失敗しました: ${e.message || '不明なエラーが発生しました'}`);
  }
}

// グローバル関数として公開
window.viewClientDetail = viewClientDetail;
window.showClientList = showClientList;
window.editClientDetail = editClientDetail;
window.submitClient = submitClient;

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
  // DataUtilsが利用可能になるまで待つ
  let retries = 0;
  const maxRetries = 50;
  while (typeof DataUtils === 'undefined' && retries < maxRetries) {
    await new Promise(resolve => setTimeout(resolve, 100));
    retries++;
  }
  
  setupClientTabs();
  await loadData();
});

