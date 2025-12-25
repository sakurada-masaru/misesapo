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

// IDトークン取得（Cognito/localStorageから取得）
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
    console.error('Error getting ID token:', error);
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
    
    console.log('[Sales Clients] Loading data from API:', API_BASE);
    console.log('[Sales Clients] Auth token present:', !!idToken && idToken !== 'mock-token');
    
    const [storesRes, clientsRes, brandsRes, schedulesRes] = await Promise.all([
      fetch(`${API_BASE}/stores`, { headers }).catch((err) => {
        console.error('[Sales Clients] Failed to fetch stores:', err);
        return { ok: false, status: 0, statusText: err.message };
      }),
      fetch(`${API_BASE}/clients`, { headers }).catch((err) => {
        console.error('[Sales Clients] Failed to fetch clients:', err);
        return { ok: false, status: 0, statusText: err.message };
      }),
      fetch(`${API_BASE}/brands`, { headers }).catch((err) => {
        console.error('[Sales Clients] Failed to fetch brands:', err);
        return { ok: false, status: 0, statusText: err.message };
      }),
      fetch(`${API_BASE}/schedules`, { headers }).catch((err) => {
        console.error('[Sales Clients] Failed to fetch schedules:', err);
        return { ok: false, status: 0, statusText: err.message };
      })
    ]);
    
    if (storesRes.ok) {
      try {
      const storesData = await storesRes.json();
      allStores = Array.isArray(storesData) ? storesData : (storesData.items || storesData.stores || []);
        console.log('[Sales Clients] Loaded stores:', allStores.length);
      } catch (jsonError) {
        console.error('[Sales Clients] Error parsing stores JSON:', jsonError);
        allStores = [];
      }
    } else {
      console.warn('[Sales Clients] Failed to load stores:', storesRes.status, storesRes.statusText);
      if (storesRes.status === 0) {
        console.error('[Sales Clients] Network error - API may be unreachable or CORS issue');
      }
      allStores = [];
    }
    
    if (clientsRes.ok) {
      try {
      const clientsData = await clientsRes.json();
      if (Array.isArray(clientsData)) {
        allClients = clientsData;
      } else if (clientsData.items && Array.isArray(clientsData.items)) {
        allClients = clientsData.items;
      } else if (clientsData.clients && Array.isArray(clientsData.clients)) {
        allClients = clientsData.clients;
      } else {
          console.warn('[Sales Clients] Unexpected clients data format:', clientsData);
          allClients = [];
        }
        console.log('[Sales Clients] Loaded clients:', allClients.length);
      } catch (jsonError) {
        console.error('[Sales Clients] Error parsing clients JSON:', jsonError);
        allClients = [];
      }
    } else {
      console.warn('[Sales Clients] Failed to load clients:', clientsRes.status, clientsRes.statusText);
      if (clientsRes.status === 0) {
        console.error('[Sales Clients] Network error - API may be unreachable or CORS issue');
      }
      allClients = [];
    }
    
    if (brandsRes.ok) {
      try {
      const brandsData = await brandsRes.json();
      allBrands = Array.isArray(brandsData) ? brandsData : (brandsData.items || brandsData.brands || []);
        console.log('[Sales Clients] Loaded brands:', allBrands.length);
      } catch (jsonError) {
        console.error('[Sales Clients] Error parsing brands JSON:', jsonError);
        allBrands = [];
      }
    } else {
      console.warn('[Sales Clients] Failed to load brands:', brandsRes.status, brandsRes.statusText);
      if (brandsRes.status === 0) {
        console.error('[Sales Clients] Network error - API may be unreachable or CORS issue');
      }
      allBrands = [];
    }
    
    if (schedulesRes.ok) {
      try {
        const schedulesData = await schedulesRes.json();
        allSchedules = Array.isArray(schedulesData) ? schedulesData : (schedulesData.items || schedulesData.schedules || []);
        console.log('[Sales Clients] Loaded schedules:', allSchedules.length);
      } catch (jsonError) {
        console.error('[Sales Clients] Error parsing schedules JSON:', jsonError);
        allSchedules = [];
      }
    } else {
      console.warn('[Sales Clients] Failed to load schedules:', schedulesRes.status, schedulesRes.statusText);
      if (schedulesRes.status === 0) {
        console.error('[Sales Clients] Network error - API may be unreachable or CORS issue');
      }
      allSchedules = [];
    }
    
    // データ読み込み後に顧客一覧を表示
    renderClientList();
  } catch (error) {
    console.error('[Sales Clients] Failed to load data:', error);
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
  if (!container) {
    console.warn('client-list-container not found');
    return;
  }
  
  // allStoresが空の場合は読み込み中を表示
  if (!Array.isArray(allStores) || allStores.length === 0) {
    container.innerHTML = '<div class="loading">読み込み中...</div>';
    return;
  }
  
  let filtered = allStores.filter(store => {
    // ステータスフィルター
    if (clientCurrentFilter !== 'all') {
      const status = store.status || '';
      // ステータスの正規化（英語と日本語の両方に対応）
      let normalizedStatus = status;
      if (status === 'active') {
        normalizedStatus = '稼働中';
      } else if (status === 'suspended') {
        normalizedStatus = '休止';
      } else if (status === 'terminated') {
        normalizedStatus = '契約終了';
      } else if (!status) {
        normalizedStatus = '稼働中'; // デフォルトは稼働中
      }
      if (normalizedStatus !== clientCurrentFilter) return false;
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
  // 稼働中: status === 'active' または status === '稼働中' または statusが空（デフォルトで稼働中とみなす）
  if (activeCountEl) {
    const activeCount = allStores.filter(s => {
      const status = s.status || '';
      return status === 'active' || status === '稼働中' || !status;
    }).length;
    activeCountEl.textContent = activeCount;
    console.log('[Sales Clients] Active count:', activeCount, 'out of', allStores.length, 'stores');
    console.log('[Sales Clients] Store statuses:', allStores.map(s => ({ id: s.id, name: s.name, status: s.status || '(empty)' })));
  }
  
  if (filtered.length === 0) {
    container.innerHTML = '<div class="loading">該当する顧客がありません</div>';
    return;
  }
  
  container.innerHTML = filtered.map(store => {
    // ステータスの正規化（英語と日本語の両方に対応）
    const rawStatus = store.status || '';
    let status = rawStatus;
    let statusLabel = rawStatus;
    if (rawStatus === 'active') {
      status = 'active';
      statusLabel = '稼働中';
    } else if (rawStatus === 'suspended') {
      status = 'suspended';
      statusLabel = '休止';
    } else if (rawStatus === 'terminated') {
      status = 'terminated';
      statusLabel = '契約終了';
    } else if (!rawStatus) {
      status = 'active';
      statusLabel = '稼働中';
    }
    
    const clientName = getClientName(store.client_id) || '';
    const brandName = getBrandName(store.brand_id) || '';
    const storeId = store.id || '';
    
    return `
      <div class="client-card" onclick="viewClientDetail('${escapeHtml(storeId)}')">
        <div class="client-card-header">
          <div>
            <div class="client-store-name">${escapeHtml(store.name || '店舗名なし')}</div>
            <div class="client-company-name">${escapeHtml(clientName)}${brandName ? ' / ' + escapeHtml(brandName) : ''}</div>
          </div>
          <span class="client-status-badge client-status-${escapeHtml(status)}">${escapeHtml(statusLabel)}</span>
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
  if (id) {
    window.location.href = `/sales/clients/detail.html?id=${encodeURIComponent(id)}`;
    return;
  }
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
// 法人・ブランドの選択肢を更新
function populateHierarchySelects() {
  if (!Array.isArray(allClients)) {
    console.warn('allClients is not an array in populateHierarchySelects:', allClients);
    allClients = [];
  }
  if (!Array.isArray(allBrands)) {
    console.warn('allBrands is not an array in populateHierarchySelects:', allBrands);
    allBrands = [];
  }
  
  const clientSelect = document.getElementById('store-client');
  const brandSelect = document.getElementById('store-brand');
  
  if (!clientSelect || !brandSelect) return;
  
  // 法人選択肢
  clientSelect.innerHTML = '<option value="">-- 新規法人または選択 --</option>' + 
    allClients.map(c => `<option value="${c.id}">${c.name || c.company_name || ''}</option>`).join('');
  
  // ブランド選択肢（全て）
  updateBrandSelectForForm();
}

// フォーム用ブランド選択肢を更新
function updateBrandSelectForForm() {
  if (!Array.isArray(allBrands)) {
    console.warn('allBrands is not an array in updateBrandSelectForForm:', allBrands);
    allBrands = [];
  }
  if (!Array.isArray(allClients)) {
    console.warn('allClients is not an array in updateBrandSelectForForm:', allClients);
    allClients = [];
  }
  
  const clientSelect = document.getElementById('store-client');
  const brandSelect = document.getElementById('store-brand');
  
  if (!clientSelect || !brandSelect) return;
  
  const clientId = clientSelect.value;
  
  let brands;
  if (clientId) {
    if (window.DataUtils?.IdUtils?.isSame) {
      brands = allBrands.filter(b => window.DataUtils.IdUtils.isSame(b.client_id, clientId));
    } else {
      brands = allBrands.filter(b => b.client_id === clientId || String(b.client_id) === String(clientId));
    }
  } else {
    brands = allBrands;
  }
  
  brandSelect.innerHTML = '<option value="">-- 新規ブランドまたは選択 --</option>' + 
    brands.map(b => {
      let client = null;
      if (window.DataUtils?.EntityFinder?.findClient) {
        client = window.DataUtils.EntityFinder.findClient(allClients, b.client_id);
      } else {
        client = allClients.find(c => c.id === b.client_id || String(c.id) === String(b.client_id));
      }
      const clientName = client ? ` (${client.name || client.company_name || ''})` : '';
      return `<option value="${b.id}">${b.name}${clientName}</option>`;
    }).join('');
}

// IDトークン取得（Cognito/localStorageから取得）
async function getAuthHeaders() {
  try {
    const cognitoIdToken = localStorage.getItem('cognito_id_token');
    if (cognitoIdToken) {
      return {
        'Authorization': `Bearer ${cognitoIdToken}`,
        'Content-Type': 'application/json'
      };
    }
    
    const authData = localStorage.getItem('misesapo_auth');
    if (authData) {
      const parsed = JSON.parse(authData);
      if (parsed.token) {
        return {
          'Authorization': `Bearer ${parsed.token}`,
          'Content-Type': 'application/json'
        };
      }
    }
    
    return { 'Content-Type': 'application/json' };
  } catch (error) {
    console.error('Error getting auth headers:', error);
    return { 'Content-Type': 'application/json' };
  }
}

function getSurveyValue(id) {
  const el = document.getElementById(id);
  if (!el) return '';
  if (el.type === 'checkbox') {
    return el.checked;
  }
  return el.value || '';
}

function getSafeFileName(file, fallbackPrefix) {
  const rawName = file?.name || `${fallbackPrefix}-photo.jpg`;
  return rawName.replace(/[^\w.\-]+/g, '_');
}

function buildUploadPrefix(storeId, type) {
  if (!storeId) return '';
  return `stores/${storeId}/assets/${type}`;
}

function setPreviewImage(previewId, src) {
  const preview = document.getElementById(previewId);
  if (!preview) return;
  preview.innerHTML = '';
  if (!src) return;
  const img = document.createElement('img');
  img.src = src;
  img.alt = 'アップロード画像';
  preview.appendChild(img);
}

async function uploadSurveyPhoto({ storeId, fileInputId, hiddenInputId, previewId, type }) {
  const fileInput = document.getElementById(fileInputId);
  const hiddenInput = document.getElementById(hiddenInputId);
  if (!fileInput) return hiddenInput?.value || '';

  if (fileInput.files && fileInput.files.length > 0) {
    if (!window.AWSS3Upload || !window.AWSS3Upload.isAvailable()) {
      throw new Error('S3アップロードが利用できません');
    }
    const file = fileInput.files[0];
    const timestamp = new Date().toISOString().replace(/[^\d]/g, '');
    const safeName = getSafeFileName(file, type);
    const keyPrefix = buildUploadPrefix(storeId, type);
    const result = await window.AWSS3Upload.uploadImage(file, type, {
      keyPrefix,
      fileName: `${timestamp}-${safeName}`
    });
    const url = result?.url || result?.path || '';
    if (hiddenInput) hiddenInput.value = url;
    setPreviewImage(previewId, url);
    return url;
  }

  return hiddenInput?.value || '';
}

function buildSurveyPayload() {
  const payload = {
    issue: getSurveyValue('survey-issue'),
    environment: getSurveyValue('survey-environment'),
    staffNormal: getSurveyValue('survey-staff-normal'),
    staffPeak: getSurveyValue('survey-staff-peak'),
    hours: getSurveyValue('survey-hours'),
    aircon: getSurveyValue('survey-aircon'),
    kitchen: getSurveyValue('survey-kitchen'),
    hotspots: getSurveyValue('survey-hotspots'),
    floorMaterial: getSurveyValue('survey-floor-material'),
    wallMaterial: getSurveyValue('survey-wall-material'),
    toiletCount: getSurveyValue('survey-toilet-count'),
    areaSqm: getSurveyValue('survey-area-sqm'),
    ceilingHeight: getSurveyValue('survey-ceiling-height'),
    breakerLocation: getSurveyValue('survey-breaker-location'),
    keyLocation: getSurveyValue('survey-key-location'),
    seatCounter: !!getSurveyValue('survey-seat-counter'),
    seatBox: !!getSurveyValue('survey-seat-box'),
    seatZashiki: !!getSurveyValue('survey-seat-zashiki'),
    notes: getSurveyValue('survey-notes'),
    lastClean: getSurveyValue('survey-last-clean'),
    plan: getSurveyValue('survey-plan'),
    breakerPhotoUrl: getSurveyValue('survey-breaker-photo-url'),
    keyPhotoUrl: getSurveyValue('survey-key-photo-url')
  };

  const hasValue = Object.values(payload).some((value) => {
    if (typeof value === 'boolean') return value;
    return value !== '';
  });
  if (!hasValue) return null;
  return payload;
}

// フォーム送信処理（管理ページと同じロジック）
async function handleStoreFormSubmit(e) {
  e.preventDefault();
  
  const id = document.getElementById('store-id').value;
  const isNew = !id;
  
  const sendInviteEl = document.getElementById('send-invite');
  const sendInvite = !!sendInviteEl && sendInviteEl.checked;
  const email = document.getElementById('store-email').value;
  
  // 招待送信時はメール必須
  if (isNew && sendInvite && !email) {
    alert('招待リンクを送信するにはメールアドレスが必要です');
    document.getElementById('store-email').focus();
    return;
  }
  
  // 3層構造の取得
  let clientId = document.getElementById('store-client').value;
  let brandId = document.getElementById('store-brand').value;
  const newClientName = document.getElementById('store-client-new').value.trim();
  const newBrandName = document.getElementById('store-brand-new').value.trim();
  
  const formStatus = document.getElementById('form-status');
  
  try {
    if (formStatus) {
      formStatus.textContent = '保存中...';
      formStatus.className = 'form-status';
    }

    const authHeaders = await getAuthHeaders();
    
    // 新規法人の作成
    if (!clientId && newClientName) {
      const newClient = {
        name: newClientName,
        type: 'corporate',
        created_at: new Date().toISOString()
      };
      const clientRes = await fetch(`${API_BASE}/clients`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(newClient)
      });
      if (!clientRes.ok) {
        const errorData = await clientRes.json().catch(() => ({}));
        throw new Error(errorData.error || '法人の作成に失敗しました');
      }
      const createdClientRes = await clientRes.json();
      const createdClient = createdClientRes.client || createdClientRes;
      allClients.push(createdClient);
      clientId = createdClientRes.id || createdClient.id;
    }
    
    // 新規ブランドの作成
    if (!brandId && newBrandName) {
    if (!clientId) {
        throw new Error('ブランドを作成するには法人を選択または作成してください');
      }
      const newBrand = {
        name: newBrandName,
        client_id: clientId,
        created_at: new Date().toISOString()
      };
        const brandRes = await fetch(`${API_BASE}/brands`, {
          method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(newBrand)
        });
        if (!brandRes.ok) {
          const errorData = await brandRes.json().catch(() => ({}));
        throw new Error(errorData.error || 'ブランドの作成に失敗しました');
      }
      const createdBrandRes = await brandRes.json();
      const createdBrand = createdBrandRes.brand || createdBrandRes;
      allBrands.push(createdBrand);
      brandId = createdBrandRes.id || createdBrand.id;
    }
    
    // 店舗データ
    const data = {
      contact_person: document.getElementById('store-contact').value,
      name: document.getElementById('store-name').value,
      postcode: document.getElementById('store-postcode').value,
      pref: document.getElementById('store-pref').value,
      city: document.getElementById('store-city').value,
      address1: document.getElementById('store-address1').value,
      address2: document.getElementById('store-address2').value,
      phone: document.getElementById('store-phone').value,
      email: email,
      description: document.getElementById('store-description').value,
      status: document.getElementById('store-status').value,
      client_id: clientId || null,
      brand_id: brandId || null
    };
    
    if (isNew) {
      data.created_at = new Date().toISOString();
      if (sendInvite) data.status = 'pending_customer_info';
    } else {
      data.id = id;
    }
    data.updated_at = new Date().toISOString();
    
    const response = await fetch(`${API_BASE}/stores${isNew ? '' : '/' + id}`, {
      method: isNew ? 'POST' : 'PUT',
      headers: authHeaders,
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      const storeRes = await response.json().catch(() => ({}));
      const savedStore = storeRes.store || storeRes;
      const storeIdForSurvey = savedStore.id || data.id;
      try {
        await uploadSurveyPhoto({
          storeId: storeIdForSurvey,
          fileInputId: 'survey-breaker-photo',
          hiddenInputId: 'survey-breaker-photo-url',
          previewId: 'survey-breaker-photo-preview',
          type: 'breaker'
        });
        await uploadSurveyPhoto({
          storeId: storeIdForSurvey,
          fileInputId: 'survey-key-photo',
          hiddenInputId: 'survey-key-photo-url',
          previewId: 'survey-key-photo-preview',
          type: 'key'
        });
      } catch (uploadError) {
        console.warn('[Sales Clients] Survey image upload failed:', uploadError);
      }
      const surveyPayload = buildSurveyPayload();
      if (surveyPayload) {
        const fullSurveyPayload = {
          ...surveyPayload,
          store_id: storeIdForSurvey,
          client_id: clientId || null,
          brand_id: brandId || null
        };
        try {
          await fetch(`${API_BASE}/kartes`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify(fullSurveyPayload)
          });
        } catch (surveyError) {
          console.warn('[Sales Clients] Failed to save survey to kartes:', surveyError);
        }
      }
      // リスト更新
      if (isNew) {
        allStores.unshift(savedStore);
        
        // 招待リンク送信
        if (sendInvite) {
          const storeIdForInvite = savedStore.id || data.id;
          const inviteLink = `${window.location.origin}/registration/customer-complete.html?token=${storeIdForInvite}`;
          if (formStatus) {
            formStatus.innerHTML = `
              <div class="invite-success">
                <div class="invite-success-header">
                  <i class="fas fa-check-circle"></i> 保存しました
                </div>
                <div class="invite-success-body">
                  <p>招待リンク:</p>
                  <input type="text" value="${inviteLink}" readonly class="invite-link-input" onclick="this.select()">
                  <small>このリンクをお客様にお送りください</small>
                </div>
              </div>
            `;
            formStatus.className = 'form-status success';
          }
        } else {
          if (formStatus) {
            formStatus.textContent = '保存しました';
            formStatus.className = 'form-status success';
          }
          // フォームリセット
          const storeForm = document.getElementById('store-form');
          if (storeForm) storeForm.reset();
          document.getElementById('store-id').value = '';
          populateHierarchySelects();
        }
      } else {
        let idx = -1;
        if (window.DataUtils?.IdUtils?.isSame) {
          idx = allStores.findIndex(s => window.DataUtils.IdUtils.isSame(s.id, id));
        } else {
          idx = allStores.findIndex(s => s.id === id || String(s.id) === String(id));
        }
        if (idx >= 0) allStores[idx] = { ...allStores[idx], ...savedStore };
        if (formStatus) {
          formStatus.textContent = '保存しました';
          formStatus.className = 'form-status success';
        }
      }
    await loadData();
    renderClientList();
    } else {
      throw new Error('Save failed');
    }
  } catch (error) {
    console.error('Save failed:', error);
    if (formStatus) {
      formStatus.textContent = '保存に失敗しました: ' + (error.message || '不明なエラー');
      formStatus.className = 'form-status error';
    }
  }
}

// 後方互換のため、submitClient関数も残す
async function submitClient() {
  const form = document.getElementById('store-form');
  if (form) {
    const event = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(event);
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
  
  // フォーム送信イベントリスナー
  const storeForm = document.getElementById('store-form');
  if (storeForm) {
    storeForm.addEventListener('submit', handleStoreFormSubmit);
  }

  const breakerPhotoInput = document.getElementById('survey-breaker-photo');
  if (breakerPhotoInput) {
    breakerPhotoInput.addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0];
      if (file) {
        setPreviewImage('survey-breaker-photo-preview', URL.createObjectURL(file));
      }
    });
  }
  const keyPhotoInput = document.getElementById('survey-key-photo');
  if (keyPhotoInput) {
    keyPhotoInput.addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0];
      if (file) {
        setPreviewImage('survey-key-photo-preview', URL.createObjectURL(file));
      }
    });
  }
  
  // 法人選択時にブランド選択肢を更新
  const clientSelect = document.getElementById('store-client');
  if (clientSelect) {
    clientSelect.addEventListener('change', updateBrandSelectForForm);
  }
  
  // 初期表示時に選択肢を更新
  populateHierarchySelects();
  
  // 初期表示時に顧客一覧を表示（顧客一覧タブがアクティブな場合）
  const activeTab = document.querySelector('.client-tab.active');
  if (activeTab && activeTab.dataset.clientTab === 'list') {
    renderClientList();
  }
});
