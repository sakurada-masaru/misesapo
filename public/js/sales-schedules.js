const API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';

// キャッシュ対策:
// 一部環境でHTML/JSが古いキャッシュのまま配信されることがあるため、
// 初回ロード時だけ「no-store」で最新のJS本文を取得して実行する。
// （二重ロード防止のためグローバルフラグでガード）
if (!window.__salesSchedulesLatestLoaded) {
  window.__salesSchedulesLatestLoaded = true;
  fetch(`/js/sales-schedules.js?ts=${Date.now()}`, { cache: 'no-store' })
    .then(r => r.ok ? r.text() : null)
    .then(code => {
      if (!code) return;
      // 取得した最新版を実行（グローバルスコープでeval）
      // eslint-disable-next-line no-eval
      (0, eval)(code);
    })
    .catch(() => {});
  // このファイル（キャッシュ版）の実行は止める
  throw new Error('Reloading latest sales-schedules.js');
}

let allSchedules = [];
let allStores = [];
let allWorkers = [];
let allClients = [];
let allBrands = [];
let allServices = [];
let selectedCleaningItems = [];
let filteredSchedules = [];
let currentPage = 1;
const perPage = 20;
let currentView = 'list';
let currentMonth = new Date();
let deleteTargetId = null;

// DOM要素（初期化時に取得）
let scheduleCardList, pagination, scheduleDialog, deleteDialog, scheduleForm, formStatus;

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
  // DOM要素を取得
  scheduleCardList = document.getElementById('schedule-card-list');
  pagination = document.getElementById('pagination');
  scheduleDialog = document.getElementById('schedule-dialog');
  deleteDialog = document.getElementById('delete-dialog');
  scheduleForm = document.getElementById('schedule-form');
  formStatus = document.getElementById('form-status');
  
  // DataUtilsが利用可能になるまで待つ（最大5秒）
  let retries = 0;
  const maxRetries = 50; // 5秒間待機（100ms × 50）
  while (typeof DataUtils === 'undefined' && retries < maxRetries) {
    await new Promise(resolve => setTimeout(resolve, 100));
    retries++;
  }
  
  if (typeof DataUtils === 'undefined') {
    console.error('DataUtils is not loaded after waiting');
    if (scheduleCardList) {
      scheduleCardList.innerHTML = '<div class="loading-state">データユーティリティの読み込みに失敗しました</div>';
    }
    return;
  }
  
  await Promise.all([
    loadStores(), 
    loadWorkers(), 
    loadClients(), 
    loadBrands(), 
    loadServices(), 
    loadSchedules()
  ]);
  setupEventListeners();
  setupStoreSearch();
  setupCleaningItemsSearch();
});

// データ読み込み
async function loadSchedules() {
  try {
    const response = await fetch(`${API_BASE}/schedules`);
    if (!response.ok) {
      throw new Error('Failed to load schedules');
    }
    const schedulesData = await response.json();
    // APIレスポンスが配列かオブジェクトかをチェック
    allSchedules = Array.isArray(schedulesData) ? schedulesData : (schedulesData.items || schedulesData.schedules || []);
    updateNewProjectAlert();
    filterAndRender();
  } catch (error) {
    console.error('Failed to load schedules:', error);
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="10" class="loading-cell">読み込みに失敗しました</td></tr>';
    }
  }
}

// 新規案件アラート更新
function updateNewProjectAlert() {
  const draftCount = allSchedules.filter(s => s.status === 'draft').length;
  const alertEl = document.getElementById('draft-alert');
  const countEl = document.getElementById('draft-count');
  
  if (alertEl && countEl) {
    if (draftCount > 0) {
      alertEl.classList.remove('hidden');
      countEl.textContent = draftCount;
    } else {
      alertEl.classList.add('hidden');
    }
  }
}

// 新規案件フィルター（グローバル関数）
window.filterNewProjects = function() {
  const statusFilter = document.getElementById('status-filter');
  if (statusFilter) {
    statusFilter.value = 'draft';
    filterAndRender();
  }
};

async function loadStores() {
  try {
    const response = await fetch(`${API_BASE}/stores`);
    const storesData = await response.json();
    allStores = Array.isArray(storesData) ? storesData : (storesData.items || storesData.stores || []);
    populateStoreSelects();
  } catch (error) {
    console.error('Failed to load stores:', error);
    allStores = [];
  }
}

async function loadWorkers() {
  try {
    const response = await fetch(`${API_BASE}/workers`);
    const workersData = await response.json();
    allWorkers = Array.isArray(workersData) ? workersData : (workersData.items || workersData.workers || []);
    populateWorkerSelects();
    populateSalesSelects();
  } catch (error) {
    console.error('Failed to load workers:', error);
    allWorkers = [];
  }
}

async function loadClients() {
  try {
    const response = await fetch(`${API_BASE}/clients`);
    const clientsData = await response.json();
    allClients = Array.isArray(clientsData) ? clientsData : (clientsData.items || clientsData.clients || []);
  } catch (error) {
    console.error('Failed to load clients:', error);
    allClients = [];
  }
}

async function loadBrands() {
  try {
    const response = await fetch(`${API_BASE}/brands`);
    const brandsData = await response.json();
    allBrands = Array.isArray(brandsData) ? brandsData : (brandsData.items || brandsData.brands || []);
  } catch (error) {
    console.error('Failed to load brands:', error);
    allBrands = [];
  }
}

async function loadServices() {
  try {
    const response = await fetch(`${API_BASE}/services`);
    const servicesData = await response.json();
    allServices = Array.isArray(servicesData) ? servicesData : (servicesData.items || servicesData.services || []);
  } catch (error) {
    console.error('Failed to load services:', error);
    allServices = [];
  }
}

function populateStoreSelects() {
  const options = allStores.map(s => `<option value="${s.id}">${escapeHtml(s.name || '')}</option>`).join('');
  const storeFilterEl = document.getElementById('store-filter');
  if (storeFilterEl) {
    storeFilterEl.innerHTML = '<option value="">全店舗</option>' + options;
  }
}

function populateSalesSelects() {
  // 管理画面と同じ基準で「営業」を抽出（role / roles / department など）
  const isSalesPerson = (w) => {
    if (!w) return false;
    const role = String(w.role || '').toLowerCase();
    const roles = Array.isArray(w.roles) ? w.roles.map(r => String(r).toLowerCase()) : [];
    const dept = String(w.department || w.dept || w.division || w.team || '').toLowerCase();
    return role === 'sales' || roles.includes('sales') || dept.includes('営業') || dept.includes('sales');
  };
  let sales = allWorkers.filter(isSalesPerson);
  
  // 万が一 role 情報が無い / sales が一人もいない場合は、全件を使う
  if (sales.length === 0) {
    sales = allWorkers;
  }
  
  const options = sales.map(w => `<option value="${w.id}">${escapeHtml(w.name || '')}</option>`).join('');
  const salesSelectEl = document.getElementById('schedule-sales');
  if (salesSelectEl) {
    salesSelectEl.innerHTML = '<option value="">未設定</option>' + options;
  }
}

function populateWorkerSelects() {
  // 清掃員のみを抽出（role が staff のユーザー）
  let cleaners = allWorkers.filter(w => (w.role || '').toLowerCase() === 'staff');

  // 万が一 role 情報が無い / staff が一人もいない場合は、従来どおり全件を使う
  if (cleaners.length === 0) {
    cleaners = allWorkers;
  }

  const options = cleaners.map(w => `<option value="${w.id}">${escapeHtml(w.name || '')}</option>`).join('');
  const workerFilterEl = document.getElementById('worker-filter');
  const scheduleWorkerEl = document.getElementById('schedule-worker');
  if (workerFilterEl) {
    workerFilterEl.innerHTML = '<option value="">全員</option>' + options;
  }
  if (scheduleWorkerEl) {
    scheduleWorkerEl.innerHTML = '<option value="">未割当</option>' + options;
  }
}

// 店舗検索機能のセットアップ（カテゴリ絞り込み機能付き）
function setupStoreSearch() {
  const searchInput = document.getElementById('schedule-store-search');
  const resultsDiv = document.getElementById('schedule-store-results');
  const hiddenInput = document.getElementById('schedule-store');
  const categoryFilter = document.getElementById('store-category-filter');
  // 選択サマリー
  const summaryStoreEl = document.getElementById('schedule-store-summary-store');
  const summaryClientEl = document.getElementById('schedule-store-summary-client');
  const summaryBrandEl = document.getElementById('schedule-store-summary-brand');
  const summaryAddressEl = document.getElementById('schedule-store-summary-address');
  
  if (!searchInput || !resultsDiv || !hiddenInput) return;
  
  function setSummary({ storeName = '-', clientName = '-', brandName = '-', address = '-' } = {}) {
    if (summaryStoreEl) summaryStoreEl.textContent = storeName || '-';
    if (summaryClientEl) summaryClientEl.textContent = clientName || '-';
    if (summaryBrandEl) summaryBrandEl.textContent = brandName || '-';
    if (summaryAddressEl) summaryAddressEl.textContent = address || '-';
  }

  function setContactFields({ address = '', phone = '', email = '', contactPerson = '' } = {}) {
    const addressEl = document.getElementById('schedule-address');
    const phoneEl = document.getElementById('schedule-phone');
    const emailEl = document.getElementById('schedule-email');
    const contactEl = document.getElementById('schedule-contact-person');
    if (addressEl) addressEl.value = address || '';
    if (phoneEl) phoneEl.value = phone || '';
    if (emailEl) emailEl.value = email || '';
    if (contactEl) contactEl.value = contactPerson || '';
  }

  function getClientName(clientId) {
    if (!clientId) return '';
    const client = allClients.find(c => c.id === clientId || String(c.id) === String(clientId));
    return client ? (client.name || client.company_name || '') : '';
  }
  
  function getBrandName(brandId) {
    if (!brandId) return '';
    const brand = allBrands.find(b => b.id === brandId || String(b.id) === String(brandId));
    return brand ? brand.name : '';
  }
  
  function updateStoreDropdown() {
    const query = searchInput.value.trim().toLowerCase();
    const category = categoryFilter ? categoryFilter.value : '';
    
    if (query.length === 0) {
      resultsDiv.style.display = 'none';
      return;
    }
    
    // 店舗名、ブランド名、法人名で部分一致検索
    let filtered = allStores.filter(store => {
      const storeName = (store.name || '').toLowerCase();
      const brandId = store.brand_id;
      const brandName = getBrandName(brandId).toLowerCase();
      const clientId = store.client_id || (brandId ? allBrands.find(b => b.id === brandId)?.client_id : null);
      const clientName = getClientName(clientId).toLowerCase();
      
      // カテゴリで絞り込み
      if (category === 'store' && !storeName.includes(query)) return false;
      if (category === 'brand' && !brandName.includes(query)) return false;
      if (category === 'client' && !clientName.includes(query)) return false;
      
      // キーワード検索
      return storeName.includes(query) || brandName.includes(query) || clientName.includes(query);
    });
    
    if (filtered.length === 0) {
      resultsDiv.innerHTML = '<div class="store-search-item no-results">該当する店舗が見つかりません</div>';
      resultsDiv.style.display = 'block';
      return;
    }
    
    resultsDiv.innerHTML = filtered.map(store => {
      const storeName = store.name || '';
      const brandId = store.brand_id;
      const brandName = getBrandName(brandId);
      const clientId = store.client_id || (brandId ? allBrands.find(b => b.id === brandId)?.client_id : null);
      const clientName = getClientName(clientId);
      
      let displayText = '';
      let categoryLabel = '';
      if (category === 'store' || (!category && storeName.toLowerCase().includes(query))) {
        displayText = storeName;
        categoryLabel = '<span class="store-search-item-category">店舗</span>';
      } else if (category === 'brand' || (!category && brandName.toLowerCase().includes(query))) {
        displayText = brandName;
        categoryLabel = '<span class="store-search-item-category">ブランド</span>';
      } else if (category === 'client' || (!category && clientName.toLowerCase().includes(query))) {
        displayText = clientName;
        categoryLabel = '<span class="store-search-item-category">法人</span>';
      } else {
        displayText = storeName;
        if (brandName) displayText += ` / ${brandName}`;
        if (clientName) displayText += ` (${clientName})`;
      }
      
      return `<div class="store-search-item" data-id="${store.id}" data-name="${escapeHtml(storeName)}">${categoryLabel}${escapeHtml(displayText)}</div>`;
    }).join('');
    
    resultsDiv.style.display = 'block';
    
    // クリックイベント
    resultsDiv.querySelectorAll('.store-search-item').forEach(item => {
      if (item.classList.contains('no-results')) return;
      item.addEventListener('click', function() {
        const id = this.dataset.id;
        const name = this.dataset.name;
        hiddenInput.value = id;
        searchInput.value = name;
        resultsDiv.style.display = 'none';

        // サマリーと連絡先の自動入力
        const store = allStores.find(s => s.id === id || String(s.id) === String(id)) || {};
        const storeName = store.name || name || '';
        const brandId = store.brand_id;
        const brandName = getBrandName(brandId) || '';
        const clientId = store.client_id || (brandId ? allBrands.find(b => b.id === brandId || String(b.id) === String(brandId))?.client_id : null);
        const clientName = getClientName(clientId) || '';
        const address = (store.address || `${store.postcode ? '〒' + store.postcode + ' ' : ''}${store.pref || ''}${store.city || ''}${store.address1 || ''}${store.address2 || ''}`).trim();
        setSummary({ storeName, clientName, brandName, address });
        setContactFields({
          address,
          phone: store.phone || store.tel || '',
          email: store.email || '',
          contactPerson: store.contact_person || store.contactPerson || ''
        });
      });
    });
  }
  
  searchInput.addEventListener('input', updateStoreDropdown);
  searchInput.addEventListener('focus', updateStoreDropdown);
  if (categoryFilter) {
    categoryFilter.addEventListener('change', updateStoreDropdown);
  }
  
  // 外側をクリックしたら閉じる
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !resultsDiv.contains(e.target) && (!categoryFilter || !categoryFilter.contains(e.target))) {
      resultsDiv.style.display = 'none';
    }
  });

  // 初期表示（未選択）
  setSummary();
}

// 清掃内容検索機能のセットアップ（店舗検索と同様のUI）
function setupCleaningItemsSearch() {
  const searchInput = document.getElementById('cleaning-items-search');
  const resultsDiv = document.getElementById('cleaning-items-results');
  const selectedDiv = document.getElementById('cleaning-items-selected');
  const categoryFilter = document.getElementById('cleaning-category-filter');
  
  if (!searchInput || !resultsDiv || !selectedDiv) return;
  
  function updateCleaningItemsDropdown() {
    const query = searchInput.value.trim().toLowerCase();
    const category = categoryFilter ? categoryFilter.value : '';
    
    // サービス名で部分一致検索（検索クエリが空の場合は全件表示）
    let filtered = allServices.filter(service => {
      const serviceName = (service.title || service.name || '').toLowerCase();
      
      // 検索クエリが空の場合は全件表示
      if (query.length === 0) {
        return true;
      }
      
      // カテゴリで絞り込み（現時点ではサービス名のみ）
      if (category === 'service' && !serviceName.includes(query)) return false;
      
      // キーワード検索
      return serviceName.includes(query);
    });
    
    if (filtered.length === 0) {
      resultsDiv.innerHTML = '<div class="cleaning-item-result no-results">該当する清掃内容が見つかりません</div>';
      resultsDiv.style.display = 'block';
      return;
    }
    
    resultsDiv.innerHTML = filtered.map(service => {
      const serviceName = service.title || service.name || '';
      const serviceId = service.id || '';
      const categoryLabel = '<span class="store-search-item-category">サービス</span>';
      return `<div class="cleaning-item-result" data-id="${serviceId}" data-name="${escapeHtml(serviceName)}">${categoryLabel}${escapeHtml(serviceName)}</div>`;
    }).join('');
    
    resultsDiv.style.display = 'block';
    
    // クリックイベント
    resultsDiv.querySelectorAll('.cleaning-item-result').forEach(item => {
      if (item.classList.contains('no-results')) return;
      item.addEventListener('click', function() {
        const id = this.dataset.id;
        const name = this.dataset.name;
        
        // 既に選択されている場合は追加しない
        if (selectedCleaningItems.find(item => item.id === id)) return;
        
        selectedCleaningItems.push({ id, name });
        updateCleaningItemsSelected();
        searchInput.value = '';
        resultsDiv.style.display = 'none';
      });
    });
  }
  
  function updateCleaningItemsSelected() {
    if (selectedCleaningItems.length === 0) {
      selectedDiv.innerHTML = '<div style="color: #9ca3af; font-size: 0.875rem; padding: 8px;">選択された清掃内容がありません</div>';
      return;
    }
    
    selectedDiv.innerHTML = selectedCleaningItems.map((item, index) => {
      return `
        <div class="cleaning-item-tag">
          <span>${escapeHtml(item.name)}</span>
          <span class="cleaning-item-tag-remove" onclick="removeCleaningItem(${index})">×</span>
        </div>
      `;
    }).join('');
  }
  
  window.removeCleaningItem = function(index) {
    selectedCleaningItems.splice(index, 1);
    updateCleaningItemsSelected();
  };
  
  searchInput.addEventListener('input', updateCleaningItemsDropdown);
  searchInput.addEventListener('focus', function() {
    // フォーカス時は検索クエリに関係なく全サービスを表示
    updateCleaningItemsDropdown();
  });
  if (categoryFilter) {
    categoryFilter.addEventListener('change', updateCleaningItemsDropdown);
  }
  
  // 外側をクリックしたら閉じる
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !resultsDiv.contains(e.target) && (!categoryFilter || !categoryFilter.contains(e.target))) {
      resultsDiv.style.display = 'none';
    }
  });
  
  // 初期表示
  updateCleaningItemsSelected();
}

// フィルタリング
function filterAndRender() {
  const storeFilter = document.getElementById('store-filter');
  const workerFilter = document.getElementById('worker-filter');
  const statusFilter = document.getElementById('status-filter');
  
  if (!storeFilter || !workerFilter || !statusFilter) return;
  
  const storeId = storeFilter.value;
  const workerId = workerFilter.value;
  const status = statusFilter.value;

  filteredSchedules = allSchedules.filter(s => {
    // store_id または client_id に対応
    const scheduleStoreId = s.store_id || s.client_id;
    const matchStore = !storeId || scheduleStoreId === storeId;
    // worker_id または assigned_to に対応
    const scheduleWorkerId = s.worker_id || s.assigned_to;
    const matchWorker = !workerId || scheduleWorkerId === workerId;
    const matchStatus = !status || s.status === status;
    return matchStore && matchWorker && matchStatus;
  });

  // 予定日順（時系列順）にソート
  filteredSchedules.sort((a, b) => {
    // カレンダー表示と同じ方法で日付を取得
    const normalizedA = DataUtils.normalizeSchedule(a);
    const normalizedB = DataUtils.normalizeSchedule(b);
    const dateA = normalizedA.date || a.date || a.scheduled_date || '';
    const dateB = normalizedB.date || b.date || b.scheduled_date || '';
    
    // 日付で比較（同じ日付の場合は時間で比較）
    if (dateA !== dateB) {
      return dateA.localeCompare(dateB);
    }
    
    // 同じ日付の場合は時間でソート
    const timeA = normalizedA.time || a.time_slot || a.scheduled_time || '00:00';
    const timeB = normalizedB.time || b.time_slot || b.scheduled_time || '00:00';
    return timeA.localeCompare(timeB);
  });

  currentPage = 1;
  renderTable();
  renderPagination();
}

// カードリスト描画（スマホ向け）
function renderTable() {
  if (!scheduleCardList) return;
  
  const start = (currentPage - 1) * perPage;
  const pageSchedules = filteredSchedules.slice(start, start + perPage);

  if (pageSchedules.length === 0) {
    scheduleCardList.innerHTML = '<div class="empty-state">該当するスケジュールがありません</div>';
    return;
  }

  // 法人名・ブランド名取得用のヘルパー関数
  function getClientName(clientId) {
    if (!clientId) return '';
    const client = allClients.find(c => c.id === clientId || String(c.id) === String(clientId));
    return client ? (client.name || client.company_name || '') : '';
  }
  
  function getBrandName(brandId) {
    if (!brandId) return '';
    const brand = allBrands.find(b => b.id === brandId || String(b.id) === String(brandId));
    return brand ? brand.name : '';
  }

  function inferBrandFromText(text) {
    const t = (text || '').trim();
    if (!t) return null;
    // 店舗名テキストに含まれるブランド名を最長一致で推定（旧データのフォールバック）
    let best = null;
    for (const b of allBrands) {
      const name = (b?.name || '').trim();
      if (!name) continue;
      if (t.includes(name)) {
        if (!best || name.length > (best.name || '').length) best = b;
      }
    }
    return best;
  }

  scheduleCardList.innerHTML = pageSchedules.map(schedule => {
    // 正規化されたスケジュールデータを使用
    const normalized = DataUtils.normalizeSchedule(schedule);
    // store_id または client_id に対応（営業側は client_id を使用）
    const storeId = normalized.store_id || schedule.store_id || schedule.client_id;
    const store = DataUtils.findStore(allStores, storeId) || {};
    // worker_id または assigned_to に対応
    const workerId = normalized.worker_id || schedule.worker_id || schedule.assigned_to;
    const worker = allWorkers.find(w => w.id === workerId);
    // 営業担当者を取得
    const salesId = schedule.sales_id || normalized.sales_id;
    const sales = salesId ? allWorkers.find(w => w.id === salesId) : null;
    const isDraft = schedule.status === 'draft';
    
    const displayStoreName = DataUtils.getStoreName(allStores, storeId, normalized.store_name || schedule.store_name || schedule.client_name);
    
    // 法人名・ブランド名を取得
    // NOTE: DataUtils.normalizeSchedule() は client_name/brand_name を保持しないため、
    // まず normalized._raw（元データ）→ schedule から拾う
    const storeFound = !!store?.id;
    const brandId = storeFound ? store.brand_id : null;
    const raw = normalized?._raw || schedule || {};
    let brandName = escapeHtml(raw.brand_name || schedule.brand_name || '') || (storeFound ? getBrandName(brandId) : '');
    let clientName = escapeHtml(raw.client_name || schedule.client_name || '') || '';
    let clientId = storeFound ? (store.client_id || (brandId ? allBrands.find(b => b.id === brandId)?.client_id : null)) : null;
    if (!clientName && clientId) clientName = escapeHtml(getClientName(clientId) || '');

    if (!storeFound && !brandName) {
      const inferredBrand = inferBrandFromText(displayStoreName || schedule.store_name || '');
      if (inferredBrand) {
        brandName = escapeHtml(inferredBrand.name || '');
        clientId = inferredBrand.client_id || clientId;
        if (!clientName && clientId) clientName = escapeHtml(getClientName(clientId) || '');
      }
    }
    
    // 清掃内容を取得
    const cleaningItems = schedule.cleaning_items || normalized.cleaning_items || [];
    const itemNames = Array.isArray(cleaningItems) ? cleaningItems.map(item => {
      const name = item.name || item.title || '';
      return escapeHtml(name);
    }).filter(name => name) : [];
    
    // 時刻フォーマット
    const timeStr = normalized.time || schedule.time_slot || schedule.scheduled_time || '-';
    let formattedTime = timeStr;
    if (timeStr && timeStr !== '-' && !timeStr.includes('-')) {
      // 単一の時刻の場合、終了時刻を計算（duration_minutesから）
      const startTime = timeStr;
      if (normalized.duration_minutes || schedule.duration_minutes) {
        const duration = normalized.duration_minutes || schedule.duration_minutes;
        const [hours, minutes] = startTime.split(':').map(Number);
        const startDate = new Date();
        startDate.setHours(hours, minutes, 0, 0);
        const endDate = new Date(startDate.getTime() + duration * 60000);
        const endHours = String(endDate.getHours()).padStart(2, '0');
        const endMinutes = String(endDate.getMinutes()).padStart(2, '0');
        formattedTime = `${startTime}-${endHours}:${endMinutes}`;
      }
    }
    
    // 清掃内容（管理側と同じタグ表示）
    const cleaningHtml = itemNames.length
      ? `<div class="cleaning-tags">${itemNames.map(n => `<span class="cleaning-tag">${n}</span>`).join('')}</div>`
      : '<span style="color:#9ca3af;">-</span>';
    
    return `
      <div class="schedule-card ${isDraft ? 'draft-card' : ''}" data-id="${schedule.id}">
        <div class="schedule-card-header">
          <div class="schedule-card-field">
            <span class="field-label">法人名：</span>
            <span class="field-value" title="${escapeHtml(clientName || '-')}">${truncateText(clientName || '-', 20)}</span>
          </div>
          <span class="status-badge status-${normalized.status}">${getStatusLabel(normalized.status)}</span>
        </div>
        <div class="schedule-card-body">
          <div class="schedule-card-container">
            <div class="schedule-card-field-row brand-store-row">
              <div class="schedule-card-field">
                <span class="field-label">ブランド名：</span>
                <span class="field-value brand-store-value" title="${escapeHtml(brandName || '-')}">${truncateText(brandName || '-', 15)}</span>
              </div>
              <div class="schedule-card-field">
                <span class="field-label">店舗名：</span>
                <span class="field-value brand-store-value" title="${escapeHtml(displayStoreName)}">${truncateText(displayStoreName, 15)}</span>
              </div>
            </div>
          </div>
          <div class="schedule-card-container">
            <div class="schedule-card-field-row">
              <div class="schedule-card-field">
                <span class="field-label">日付：</span>
                <span class="field-value">${formatDate(normalized.date || schedule.date || schedule.scheduled_date)}</span>
              </div>
              <div class="schedule-card-field">
                <span class="field-label">時刻：</span>
                <span class="field-value">${escapeHtml(formattedTime)}</span>
              </div>
            </div>
          </div>
          <div class="schedule-card-container">
            <div class="schedule-card-field">
              <span class="field-label">清掃内容：</span>
              <span class="field-value">${cleaningHtml}</span>
            </div>
          </div>
          <div class="schedule-card-container">
            <div class="schedule-card-field">
              <span class="field-label">営業担当：</span>
              <span class="field-value">${sales ? truncateText(sales.name || '', 15) : '-'}</span>
            </div>
          </div>
          <div class="schedule-card-actions">
            <button class="action-btn edit" title="編集" onclick="editSchedule('${schedule.id}')">
              <i class="fas fa-edit"></i>
              <span>編集</span>
            </button>
            <button class="action-btn delete" title="削除" onclick="confirmDelete('${schedule.id}')">
              <i class="fas fa-trash"></i>
              <span>削除</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ページネーション
function renderPagination() {
  if (!pagination) return;
  
  const totalPages = Math.ceil(filteredSchedules.length / perPage);
  if (totalPages <= 1) {
    pagination.innerHTML = '';
    return;
  }

  let html = '';
  html += `<button ${currentPage === 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})">前</button>`;
  
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
      html += `<button class="${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    } else if (i === currentPage - 3 || i === currentPage + 3) {
      html += `<span style="padding:8px">...</span>`;
    }
  }
  
  html += `<button ${currentPage === totalPages ? 'disabled' : ''} onclick="goToPage(${currentPage + 1})">次</button>`;
  pagination.innerHTML = html;
}

window.goToPage = function(page) {
  currentPage = page;
  renderTable();
  renderPagination();
  // ページトップにスクロール
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// イベントリスナー
function setupEventListeners() {
  // フィルター
  const storeFilter = document.getElementById('store-filter');
  const workerFilter = document.getElementById('worker-filter');
  const statusFilter = document.getElementById('status-filter');
  const resetFilters = document.getElementById('reset-filters');
  
  if (storeFilter) {
    storeFilter.addEventListener('change', filterAndRender);
  }
  if (workerFilter) {
    workerFilter.addEventListener('change', filterAndRender);
  }
  if (statusFilter) {
    statusFilter.addEventListener('change', filterAndRender);
  }
  if (resetFilters) {
    resetFilters.addEventListener('click', () => {
      if (storeFilter) storeFilter.value = '';
      if (workerFilter) workerFilter.value = '';
      if (statusFilter) statusFilter.value = '';
      filterAndRender();
    });
  }

  // 表示切替
  const viewToggle = document.getElementById('view-toggle');
  if (viewToggle) {
    viewToggle.addEventListener('click', () => {
      const listView = document.getElementById('list-view');
      const calendarView = document.getElementById('calendar-view');
      
      if (currentView === 'list') {
        currentView = 'calendar';
        if (listView) listView.style.display = 'none';
        if (calendarView) calendarView.style.display = 'block';
        viewToggle.innerHTML = '<i class="fas fa-list"></i>';
        viewToggle.title = 'リスト表示';
        renderCalendar();
      } else {
        currentView = 'list';
        if (listView) listView.style.display = 'block';
        if (calendarView) calendarView.style.display = 'none';
        viewToggle.innerHTML = '<i class="fas fa-calendar"></i>';
        viewToggle.title = 'カレンダー表示';
      }
    });
  }

  // カレンダー月ナビゲーション
  const prevMonth = document.getElementById('prev-month');
  const nextMonth = document.getElementById('next-month');
  
  if (prevMonth) {
    prevMonth.addEventListener('click', () => {
      currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
      renderCalendar();
    });
  }

  if (nextMonth) {
    nextMonth.addEventListener('click', () => {
      currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
      renderCalendar();
    });
  }

  // 新規作成
  const addScheduleBtn = document.getElementById('add-schedule-btn');
  if (addScheduleBtn) {
    addScheduleBtn.addEventListener('click', () => {
      openAddDialog();
    });
  }

  // 顧客データ再読み込み（モーダル内）
  const reloadCustomersBtn = document.getElementById('reload-customers-data-btn');
  if (reloadCustomersBtn) {
    reloadCustomersBtn.addEventListener('click', async () => {
      try {
        reloadCustomersBtn.disabled = true;
        reloadCustomersBtn.textContent = '再読み込み中...';
        await Promise.all([loadClients(), loadBrands(), loadStores()]);
        populateStoreSelects();
        filterAndRender();
      } catch (e) {
        console.error('Failed to reload customer data:', e);
        alert('顧客データの再読み込みに失敗しました');
      } finally {
        reloadCustomersBtn.disabled = false;
        reloadCustomersBtn.innerHTML = '<i class="fas fa-sync-alt"></i> 顧客データ再読み込み';
      }
    });
  }

  // フォーム送信
  if (scheduleForm) {
    scheduleForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const id = document.getElementById('schedule-id').value;
      const isNew = !id;
      const originalSchedule = isNew ? null : allSchedules.find(s => s.id === id);
      
      const storeId = document.getElementById('schedule-store').value;
      if (!storeId) {
        alert('店舗を選択してください');
        return;
      }
      
      // 清掃内容を取得
      const cleaningItems = selectedCleaningItems.map(item => ({
        name: item.name,
        id: item.id
      }));

      // 選択店舗から法人/ブランド/店舗名を拾い、管理画面と同じく参照用に保存（表示・検索のフォールバック）
      const selectedStore = allStores.find(s => s.id === storeId || String(s.id) === String(storeId)) || null;
      const storeFound = !!selectedStore?.id;
      const brandId = storeFound ? selectedStore.brand_id : null;
      const brandName = storeFound ? (allBrands.find(b => b.id === brandId || String(b.id) === String(brandId))?.name || '') : '';
      const clientId = storeFound
        ? (selectedStore.client_id || (brandId ? allBrands.find(b => b.id === brandId || String(b.id) === String(brandId))?.client_id : null))
        : null;
      const clientName = storeFound ? (allClients.find(c => c.id === clientId || String(c.id) === String(clientId))?.name || '') : '';
      
      const data = {
        store_id: storeId,
        scheduled_date: document.getElementById('schedule-date').value,
        scheduled_time: document.getElementById('schedule-time').value,
        duration_minutes: parseInt(document.getElementById('schedule-duration').value) || 60,
        sales_id: document.getElementById('schedule-sales').value || null,
        worker_id: document.getElementById('schedule-worker').value || null,
        cleaning_items: cleaningItems,
        work_content: cleaningItems.length > 0 ? cleaningItems.map(item => item.name).join(', ') : '',
        status: document.getElementById('schedule-status').value,
        notes: document.getElementById('schedule-notes').value,
        client_name: clientName || '',
        brand_name: brandName || '',
        store_name: storeFound ? (selectedStore.name || '') : '',
        address: (document.getElementById('schedule-address')?.value || '').trim(),
        phone: (document.getElementById('schedule-phone')?.value || '').trim(),
        email: (document.getElementById('schedule-email')?.value || '').trim(),
        contact_person: (document.getElementById('schedule-contact-person')?.value || '').trim()
      };

      // 清掃員を割り当てた場合、未確定（draft）から確定（scheduled）に自動更新
      if (!isNew && originalSchedule) {
        const wasDraft = originalSchedule.status === 'draft';
        const hadWorker = originalSchedule.worker_id && originalSchedule.worker_id !== '';
        const hasWorker = data.worker_id && data.worker_id !== '';
        const workerAssigned = !hadWorker && hasWorker; // 新しく清掃員が割り当てられた
        
        // 未確定状態で清掃員を新しく割り当てた場合、自動的に確定に変更
        if (wasDraft && workerAssigned) {
          data.status = 'scheduled';
          document.getElementById('schedule-status').value = 'scheduled';
        }
      }

      if (isNew) {
        // ID生成はバックエンドに任せる（SCH-YYYYMMDD-NNN形式）
        data.created_at = new Date().toISOString();
      } else {
        data.id = id;
      }
      data.updated_at = new Date().toISOString();

      try {
        if (formStatus) {
          formStatus.textContent = '保存中...';
        }
        
        const response = await fetch(`${API_BASE}/schedules${isNew ? '' : '/' + id}`, {
          method: isNew ? 'POST' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        if (response.ok) {
          if (formStatus) {
            formStatus.textContent = '保存しました';
            formStatus.className = 'form-status success';
          }
          
          // レスポンスから作成されたスケジュールデータを取得
          // バックエンドから返されたIDを使用（新規作成時はschedule_id、更新時は既存のid）
          const responseData = await response.json();
          const savedSchedule = responseData.schedule || { 
            ...data, 
            id: responseData.schedule_id || responseData.id || id 
          };
          
          if (isNew) {
            allSchedules.unshift(savedSchedule);
          } else {
            const idx = allSchedules.findIndex(s => s.id === id);
            if (idx >= 0) allSchedules[idx] = { ...allSchedules[idx], ...savedSchedule };
          }
          
          // データを再読み込みして最新の状態を取得
          await loadSchedules();
          
          if (scheduleDialog) {
            setTimeout(() => scheduleDialog.close(), 500);
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.message || '保存に失敗しました');
        }
      } catch (error) {
        console.error('Error:', error);
        if (formStatus) {
          formStatus.textContent = error.message || '保存に失敗しました';
          formStatus.className = 'form-status error';
        }
      }
    });
  }

  // 削除確認
  const confirmDeleteBtn = document.getElementById('confirm-delete');
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', async () => {
      if (!deleteTargetId) return;
      
      try {
        const response = await fetch(`${API_BASE}/schedules/${deleteTargetId}`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          allSchedules = allSchedules.filter(s => s.id !== deleteTargetId);
          filterAndRender();
          updateNewProjectAlert();
          if (deleteDialog) {
            deleteDialog.close();
          }
        }
      } catch (error) {
        console.error('Delete failed:', error);
        alert('削除に失敗しました');
      }
    });
  }
}

// 新規作成ダイアログを開く（グローバルスコープで定義）
function openAddDialog(dateStr) {
  const dialogTitle = document.getElementById('dialog-title');
  const scheduleId = document.getElementById('schedule-id');
  const scheduleStore = document.getElementById('schedule-store');
  const scheduleStoreSearch = document.getElementById('schedule-store-search');
  const scheduleDate = document.getElementById('schedule-date');
  
  if (dialogTitle) dialogTitle.textContent = '新規スケジュール作成';
  if (scheduleForm) scheduleForm.reset();
  if (scheduleId) scheduleId.value = '';
  if (scheduleStore) scheduleStore.value = '';
  if (scheduleStoreSearch) scheduleStoreSearch.value = '';
  if (scheduleDate) scheduleDate.value = dateStr || new Date().toISOString().split('T')[0];
  
  // 清掃内容をリセット
  selectedCleaningItems = [];
  const selectedDiv = document.getElementById('cleaning-items-selected');
  const cleaningSearchInput = document.getElementById('cleaning-items-search');
  const cleaningCategoryFilter = document.getElementById('cleaning-category-filter');
  if (selectedDiv) {
    selectedDiv.innerHTML = '<div style="color: #9ca3af; font-size: 0.875rem; padding: 8px;">選択された清掃内容がありません</div>';
  }
  if (cleaningSearchInput) {
    cleaningSearchInput.value = '';
  }
  if (cleaningCategoryFilter) {
    cleaningCategoryFilter.value = '';
  }
  
  if (formStatus) formStatus.textContent = '';
  if (scheduleDialog) scheduleDialog.showModal();
}
window.openAddDialog = openAddDialog;

// 編集ダイアログを開く（グローバルスコープで定義）
function openEditDialog(schedule) {
  editSchedule(schedule.id);
}
window.openEditDialog = openEditDialog;

// 編集
window.editSchedule = function(id) {
  const schedule = allSchedules.find(s => s.id === id);
  if (!schedule) return;

  // 正規化されたスケジュールデータを使用
  const normalized = DataUtils.normalizeSchedule(schedule);
  const storeId = normalized.store_id || schedule.store_id || schedule.client_id;
  const date = normalized.date || schedule.date || schedule.scheduled_date || '';
  const time = normalized.time || schedule.time_slot || schedule.scheduled_time || '';
  const workerId = normalized.worker_id || schedule.worker_id || schedule.assigned_to || '';

  const dialogTitle = document.getElementById('dialog-title');
  const scheduleIdEl = document.getElementById('schedule-id');
  const scheduleStoreEl = document.getElementById('schedule-store');
  const scheduleStoreSearchEl = document.getElementById('schedule-store-search');
  const scheduleDateEl = document.getElementById('schedule-date');
  const scheduleTimeEl = document.getElementById('schedule-time');
  const scheduleDurationEl = document.getElementById('schedule-duration');
  const scheduleSalesEl = document.getElementById('schedule-sales');
  const scheduleWorkerEl = document.getElementById('schedule-worker');
  const scheduleStatusEl = document.getElementById('schedule-status');
  const scheduleNotesEl = document.getElementById('schedule-notes');

  if (dialogTitle) dialogTitle.textContent = 'スケジュール編集';
  if (scheduleIdEl) scheduleIdEl.value = schedule.id;
  
  // 店舗検索フィールドの更新
  if (scheduleStoreEl && scheduleStoreSearchEl) {
    const store = DataUtils.findStore(allStores, storeId);
    if (store) {
      scheduleStoreEl.value = storeId || '';
      scheduleStoreSearchEl.value = store.name || '';
    }
  }
  
  if (scheduleDateEl) scheduleDateEl.value = date;
  if (scheduleTimeEl) scheduleTimeEl.value = time;
  if (scheduleDurationEl) scheduleDurationEl.value = schedule.duration_minutes || normalized.duration || 60;
  if (scheduleSalesEl) scheduleSalesEl.value = schedule.sales_id || schedule.created_by || '';
  if (scheduleWorkerEl) scheduleWorkerEl.value = workerId;
  if (scheduleStatusEl) scheduleStatusEl.value = schedule.status || 'scheduled';
  if (scheduleNotesEl) scheduleNotesEl.value = schedule.notes || normalized.notes || '';
  
  // 清掃内容を読み込む
  selectedCleaningItems = [];
  if (schedule.cleaning_items && Array.isArray(schedule.cleaning_items)) {
    selectedCleaningItems = schedule.cleaning_items.map(item => ({
      id: item.id || item.name,
      name: item.name || item.title || ''
    }));
  } else if (schedule.work_content) {
    // 既存のwork_contentから清掃内容を復元（カンマ区切り）
    const workItems = schedule.work_content.split(',').map(s => s.trim()).filter(s => s);
    selectedCleaningItems = workItems.map(name => ({
      id: name,
      name: name
    }));
  }
  const selectedDiv = document.getElementById('cleaning-items-selected');
  if (selectedDiv) {
    if (selectedCleaningItems.length === 0) {
      selectedDiv.innerHTML = '<div style="color: #9ca3af; font-size: 0.875rem; padding: 8px;">選択された清掃内容がありません</div>';
    } else {
      selectedDiv.innerHTML = selectedCleaningItems.map((item, index) => {
        return `
          <div class="cleaning-item-tag">
            <span>${escapeHtml(item.name)}</span>
            <span class="cleaning-item-tag-remove" onclick="removeCleaningItem(${index})">×</span>
          </div>
        `;
      }).join('');
    }
  }
  
  if (formStatus) formStatus.textContent = '';
  if (scheduleDialog) scheduleDialog.showModal();
};

// 削除確認
window.confirmDelete = function(id) {
  deleteTargetId = id;
  if (deleteDialog) {
    deleteDialog.showModal();
  }
};

// ユーティリティ
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-');
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const date = new Date(dateStr);
  return `${m}/${d}(${weekdays[date.getDay()]})`;
}

// 文字数制限関数（最大文字数を超える場合は...表示）
function truncateText(text, maxLength = 15) {
  if (!text) return '-';
  const str = String(text);
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '...';
}

function getStatusLabel(status) {
  const labels = {
    'draft': '未確定',
    'scheduled': '確定',
    'in_progress': '作業中',
    'completed': '完了',
    'cancelled': 'キャンセル'
  };
  return labels[status] || status || '予定';
}

// カレンダー描画
function renderCalendar() {
  const calendarMonth = document.getElementById('calendar-month');
  const calendarDays = document.getElementById('calendar-days');
  
  if (!calendarMonth || !calendarDays) return;
  
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  calendarMonth.textContent = `${year}年${month + 1}月`;
  
  calendarDays.innerHTML = '';
  
  // 月の最初の日と最後の日
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  
  // 今日の日付
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  // 前月の空白セル
  for (let i = 0; i < startDayOfWeek; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'calendar-day empty';
    calendarDays.appendChild(emptyCell);
  }
  
  // 日付セル
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayOfWeek = new Date(year, month, day).getDay();
    
    const dayCell = document.createElement('div');
    dayCell.className = 'calendar-day';
    if (dateStr === todayStr) dayCell.classList.add('today');
    if (dayOfWeek === 0) dayCell.classList.add('sun');
    if (dayOfWeek === 6) dayCell.classList.add('sat');
    
    // 日付番号
    const dayNum = document.createElement('div');
    dayNum.className = 'day-number';
    dayNum.textContent = day;
    dayCell.appendChild(dayNum);
    
    // その日のスケジュール（カレンダー表示と整合性を取る）
    const daySchedules = allSchedules.filter(s => {
      const normalized = DataUtils.normalizeSchedule(s);
      const scheduleDate = normalized.date || s.date || s.scheduled_date;
      return scheduleDate === dateStr;
    });
    if (daySchedules.length > 0) {
      const eventsContainer = document.createElement('div');
      eventsContainer.className = 'day-events';
      
      // 最大3件表示
      daySchedules.slice(0, 3).forEach(schedule => {
        const event = document.createElement('div');
        const normalized = DataUtils.normalizeSchedule(schedule);
        event.className = `day-event status-${normalized.status}`;
        const storeId = normalized.store_id || schedule.store_id || schedule.client_id;
        const store = DataUtils.findStore(allStores, storeId) || {};
        
        // ブランド名を取得
        function getBrandName(brandId) {
          if (!brandId) return '';
          const brand = allBrands.find(b => b.id === brandId || String(b.id) === String(brandId));
          return brand ? brand.name : '';
        }
        
        const brandId = store.brand_id;
        const brandName = getBrandName(brandId);
        const displayName = brandName || DataUtils.getStoreName(allStores, storeId, normalized.store_name || schedule.store_name || schedule.client_name);
        event.textContent = displayName;
        event.title = `${normalized.time || ''} ${displayName}`;
        event.onclick = () => openEditDialog(schedule);
        eventsContainer.appendChild(event);
      });
      
      // 3件以上ある場合
      if (daySchedules.length > 3) {
        const more = document.createElement('div');
        more.className = 'day-event-more';
        more.textContent = `+${daySchedules.length - 3}件`;
        eventsContainer.appendChild(more);
      }
      
      dayCell.appendChild(eventsContainer);
    }
    
    // 日付クリックで新規作成
    dayCell.addEventListener('click', (e) => {
      if (e.target.classList.contains('day-event') || e.target.classList.contains('day-event-more')) return;
      if (typeof window.openAddDialog === 'function') {
        window.openAddDialog(dateStr);
      } else {
        // フォールバック: 直接ダイアログを開く
        openAddDialog(dateStr);
      }
    });
    
    calendarDays.appendChild(dayCell);
  }
  
  // 次月の空白セル（6行になるように）
  const totalCells = startDayOfWeek + daysInMonth;
  const remainingCells = (7 - (totalCells % 7)) % 7;
  for (let i = 0; i < remainingCells; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'calendar-day empty';
    calendarDays.appendChild(emptyCell);
  }
}

