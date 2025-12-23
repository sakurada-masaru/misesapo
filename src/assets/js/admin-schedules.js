const API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';

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
let tbody, pagination, scheduleDialog, deleteDialog, scheduleForm, formStatus;

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
  // DOM要素を取得
  tbody = document.getElementById('schedule-tbody');
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
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="10" class="loading-cell">データユーティリティの読み込みに失敗しました</td></tr>';
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
  // 初回描画は全データ読み込み完了後に実行（brands未ロードでブランド名が欠けるのを防ぐ）
  filterAndRender();
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
    updateDraftAlert();
  } catch (error) {
    console.error('Failed to load schedules:', error);
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="10" class="loading-cell">読み込みに失敗しました</td></tr>';
    }
  }
}

// 新規案件アラート更新
function updateDraftAlert() {
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
window.filterDraft = function() {
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
  // 営業担当者（営業部署/role/roles などから判定）を抽出
  const isSalesPerson = (w) => {
    if (!w) return false;
    const role = (w.role || '').toLowerCase();
    const roles = Array.isArray(w.roles) ? w.roles.map(r => String(r).toLowerCase()) : [];
    const dept = String(w.department || w.dept || w.division || w.team || '').toLowerCase();
    // いずれか一致で営業扱い
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

  // 一覧フィルター: 営業IDで絞り込み（表示ラベルはIDのみ）
  const salesFilterEl = document.getElementById('sales-filter');
  if (salesFilterEl) {
    const idOptions = sales
      .map(w => {
        const label = w.name ? `${w.name}${w.id ? ` (${w.id})` : ''}` : (w.id || '');
        return `<option value="${w.id}">${escapeHtml(label)}</option>`;
      })
      .join('');
    salesFilterEl.innerHTML = '<option value="">全営業</option>' + idOptions;
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
    // 担当清掃員: 「全員（オープン）」を選ぶと特定の清掃員に割り当てずオープンな状態にできる
    scheduleWorkerEl.innerHTML = '<option value="">全員（オープン）</option>' + options;
  }
}

// 店舗検索機能のセットアップ（カテゴリ絞り込み機能付き）
function setupStoreSearch() {
  const searchInput = document.getElementById('schedule-store-search');
  const resultsDiv = document.getElementById('schedule-store-results');
  const hiddenInput = document.getElementById('schedule-store');
  const categoryFilter = document.getElementById('store-category-filter');
  const summaryStoreEl = document.getElementById('schedule-store-summary-store');
  const summaryClientEl = document.getElementById('schedule-store-summary-client');
  const summaryBrandEl = document.getElementById('schedule-store-summary-brand');
  const summaryAddressEl = document.getElementById('schedule-store-summary-address');
  
  if (!searchInput || !resultsDiv || !hiddenInput) return;

  function updatePlaceholder() {
    const category = categoryFilter ? categoryFilter.value : '';
    if (category === 'store') {
      searchInput.placeholder = '店舗名で検索...';
    } else if (category === 'brand') {
      searchInput.placeholder = 'ブランド名で検索...';
    } else if (category === 'client') {
      searchInput.placeholder = '法人名で検索...';
    } else {
      searchInput.placeholder = '店舗名、ブランド名、法人名で検索...';
    }
  }

  function setSummary({ storeName = '-', clientName = '-', brandName = '-', address = '-' } = {}) {
    if (summaryStoreEl) summaryStoreEl.textContent = storeName || '-';
    if (summaryClientEl) summaryClientEl.textContent = clientName || '-';
    if (summaryBrandEl) summaryBrandEl.textContent = brandName || '-';
    if (summaryAddressEl) summaryAddressEl.textContent = address || '-';
  }

  function getSelectedStoreSummary(storeId) {
    const store = DataUtils.findStore(allStores, storeId) || allStores.find(s => s.id === storeId) || {};
    const storeName = store.name || '';
    const brandId = store.brand_id;
    const brand = allBrands.find(b => b.id === brandId || String(b.id) === String(brandId)) || null;
    const brandName = brand ? (brand.name || '') : '';
    const clientId = store.client_id || (brand ? brand.client_id : null);
    const client = allClients.find(c => c.id === clientId || String(c.id) === String(clientId)) || null;
    const clientName = client ? (client.name || client.company_name || '') : '';
    const address = (
      store.address ||
      `${store.postcode ? '〒' + store.postcode + ' ' : ''}${store.pref || ''}${store.city || ''}${store.address1 || ''}${store.address2 || ''}`
    ).trim();
    return { store, storeName, brandName, clientName, address };
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
      
      // 表示は常に「店舗名」を主にして、補足で法人/ブランドを出す（混同防止）
      const categoryLabel = category === 'client'
        ? '<span class="store-search-item-category">法人</span>'
        : category === 'brand'
          ? '<span class="store-search-item-category">ブランド</span>'
          : category === 'store'
            ? '<span class="store-search-item-category">店舗</span>'
            : '<span class="store-search-item-category">検索</span>';

      let sub = '';
      if (brandName || clientName) {
        const parts = [];
        if (brandName) parts.push(brandName);
        if (clientName) parts.push(clientName);
        sub = ` <small style="color:#6b7280;">(${escapeHtml(parts.join(' / '))})</small>`;
      }
      
      return `<div class="store-search-item" data-id="${store.id}" data-name="${escapeHtml(storeName)}">${categoryLabel}${escapeHtml(storeName)}${sub}</div>`;
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
        const summary = getSelectedStoreSummary(id);
        setSummary({
          storeName: summary.storeName || name || '-',
          clientName: summary.clientName || '-',
          brandName: summary.brandName || '-',
          address: summary.address || '-'
        });
        setContactFields({
          address: summary.address || '',
          phone: summary.store?.phone || '',
          email: summary.store?.email || '',
          contactPerson: summary.store?.contact_person || ''
        });
      });
    });
  }
  
  searchInput.addEventListener('input', updateStoreDropdown);
  searchInput.addEventListener('focus', updateStoreDropdown);
  if (categoryFilter) {
    categoryFilter.addEventListener('change', () => {
      updatePlaceholder();
      // 入力中の文言とカテゴリがズレると混同しやすいので、カテゴリ変更時は候補を再計算
      updateStoreDropdown();
    });
  }
  
  // 外側をクリックしたら閉じる
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !resultsDiv.contains(e.target) && (!categoryFilter || !categoryFilter.contains(e.target))) {
      resultsDiv.style.display = 'none';
    }
  });

  // 初期状態
  updatePlaceholder();
  setSummary();
  setContactFields();
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
  const salesFilter = document.getElementById('sales-filter');
  const workerFilter = document.getElementById('worker-filter');
  const statusFilter = document.getElementById('status-filter');
  const dateRangeFilter = document.getElementById('date-range-filter');
  
  if (!storeFilter || !workerFilter || !statusFilter) return;
  
  const storeId = storeFilter.value;
  const salesId = salesFilter ? salesFilter.value : '';
  const workerId = workerFilter.value;
  const status = statusFilter.value;
  const dateRange = dateRangeFilter ? dateRangeFilter.value : 'future'; // デフォルトは「今後のみ」

  // 現在の日時を取得（時刻は00:00:00に設定して日付のみで比較）
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  filteredSchedules = allSchedules.filter(s => {
    // store_id または client_id に対応
    const scheduleStoreId = s.store_id || s.client_id;
    const matchStore = !storeId || (
      window.DataUtils?.IdUtils?.isSame
        ? window.DataUtils.IdUtils.isSame(scheduleStoreId, storeId)
        : (String(scheduleStoreId) === String(storeId))
    );
    // sales_id
    const scheduleSalesId = s.sales_id || (window.DataUtils?.normalizeSchedule ? DataUtils.normalizeSchedule(s)?.sales_id : null) || '';
    const matchSales = !salesId || (
      window.DataUtils?.IdUtils?.isSame
        ? window.DataUtils.IdUtils.isSame(scheduleSalesId, salesId)
        : (String(scheduleSalesId) === String(salesId))
    );
    // worker_id または assigned_to に対応
    const scheduleWorkerId = s.worker_id || s.assigned_to;
    const matchWorker = !workerId || (
      window.DataUtils?.IdUtils?.isSame
        ? window.DataUtils.IdUtils.isSame(scheduleWorkerId, workerId)
        : (String(scheduleWorkerId) === String(workerId))
    );
    const matchStatus = !status || s.status === status;
    
    // 日付範囲フィルター
    let matchDateRange = true;
    if (dateRange === 'future' || dateRange === 'past') {
      const normalized = DataUtils.normalizeSchedule(s);
      const scheduleDate = normalized.date || s.date || s.scheduled_date;
      if (scheduleDate) {
        const scheduleDateObj = new Date(scheduleDate);
        scheduleDateObj.setHours(0, 0, 0, 0);
        
        if (dateRange === 'future') {
          // 今後のみ：今日以降のスケジュール
          matchDateRange = scheduleDateObj >= now;
        } else if (dateRange === 'past') {
          // 過去のみ：今日より前のスケジュール
          matchDateRange = scheduleDateObj < now;
        }
      } else {
        // 日付がない場合は、過去として扱う（アーカイブ表示時のみ表示）
        matchDateRange = dateRange === 'past';
      }
    }
    
    return matchStore && matchSales && matchWorker && matchStatus && matchDateRange;
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

// テーブル描画
function renderTable() {
  if (!tbody) return;
  
  const cardsEl = document.getElementById('schedule-cards');
  const start = (currentPage - 1) * perPage;
  const pageSchedules = filteredSchedules.slice(start, start + perPage);

  if (pageSchedules.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="loading-cell">該当するスケジュールがありません</td></tr>';
    if (cardsEl) {
      cardsEl.innerHTML = '<div class="schedule-card"><div class="schedule-card-title">該当するスケジュールがありません</div></div>';
    }
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

  // カード描画（狭い画面用）
  if (cardsEl) {
    cardsEl.innerHTML = pageSchedules.map(schedule => {
      const normalized = DataUtils.normalizeSchedule(schedule);
      const storeId = normalized.store_id || schedule.store_id || schedule.client_id;
      const store = DataUtils.findStore(allStores, storeId) || {};
      const workerId = normalized.worker_id || schedule.worker_id || schedule.assigned_to;
      // IDの正規化処理を使用してworkerを検索
      let worker = null;
      if (workerId) {
        if (DataUtils && DataUtils.IdUtils && DataUtils.IdUtils.isSame) {
          worker = allWorkers.find(w => DataUtils.IdUtils.isSame(w.id, workerId));
        } else {
          worker = allWorkers.find(w => String(w.id) === String(workerId));
        }
      }
      const salesId = schedule.sales_id || normalized.sales_id;
      const sales = salesId ? allWorkers.find(w => w.id === salesId) : null;
      const isDraft = schedule.status === 'draft';
      const displayStoreName = DataUtils.getStoreName(allStores, storeId, normalized.store_name || schedule.store_name || schedule.client_name);

      const storeFound = !!store?.id;
      const brandId = storeFound ? store.brand_id : null;
      let brandName = storeFound ? getBrandName(brandId) : (schedule.brand_name || '');
      let clientId = storeFound ? (store.client_id || (brandId ? allBrands.find(b => b.id === brandId)?.client_id : null)) : null;
      let clientName = storeFound ? getClientName(clientId) : (schedule.client_name || '');
      if (!storeFound && !brandName) {
        const inferredBrand = inferBrandFromText(displayStoreName || schedule.store_name || '');
        if (inferredBrand) {
          brandName = inferredBrand.name || '';
          clientId = inferredBrand.client_id || clientId;
          if (!clientName && clientId) clientName = getClientName(clientId) || clientName;
        }
      }

      const cleaningItems = schedule.cleaning_items || normalized.cleaning_items || [];
      const itemNames = Array.isArray(cleaningItems)
        ? cleaningItems.map(item => escapeHtml(item.name || item.title || '')).filter(Boolean)
        : [];
      const cleaningHtml = itemNames.length
        ? `<div class="cleaning-tags">${itemNames.map(n => `<span class="cleaning-tag">${n}</span>`).join('')}</div>`
        : '<span style="color:#9ca3af;">-</span>';

      return `
        <div class="schedule-card ${isDraft ? 'draft-row' : ''}" data-id="${escapeHtml(schedule.id || '')}">
          <div class="schedule-card-head">
            <div>
              <div class="schedule-card-title">${escapeHtml(displayStoreName || '-')}</div>
              <div class="schedule-card-sub">
                <div class="schedule-card-subline">${escapeHtml(clientName || '-')}</div>
                <div class="schedule-card-subline">${escapeHtml(brandName || '-')}</div>
              </div>
              <div class="schedule-card-id">${escapeHtml(schedule.id || '-')}</div>
            </div>
            <div>
              <span class="status-badge status-${normalized.status}">${getStatusLabel(normalized.status)}</span>
            </div>
          </div>
          <div class="schedule-card-meta">
            <div class="k">日時</div><div>${escapeHtml(formatDate(normalized.date || schedule.date || schedule.scheduled_date) || '-')}${normalized.time ? ` ${escapeHtml(normalized.time)}` : ''}</div>
            <div class="k">営業</div><div>${sales ? `<span class="worker-avatar" title="${escapeHtml(sales.id || '')}${sales.name ? ' / ' + escapeHtml(sales.name) : ''}">${(sales.name || sales.id || '?')[0]}</span>` : '<span class="unassigned">未設定</span>'}</div>
            <div class="k">清掃員</div><div>${worker ? escapeHtml(worker.name || '') : '<span class="unassigned">未割当</span>'}</div>
            <div class="k">清掃内容</div><div>${cleaningHtml}</div>
          </div>
          <div class="schedule-card-actions">
            ${isDraft ? `
              <button class="action-btn assign" title="アサイン・確定（新規案件）" onclick="quickAssignWorker('${schedule.id}')" style="background:#ffc107;color:#333">
                <i class="fas fa-user-check"></i>
              </button>
            ` : `
              <button class="action-btn edit" title="編集" onclick="editSchedule('${schedule.id}')">
                <i class="fas fa-edit"></i>
              </button>
            `}
            <button class="action-btn delete" title="削除" onclick="confirmDelete('${schedule.id}')">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  tbody.innerHTML = pageSchedules.map(schedule => {
    // 正規化されたスケジュールデータを使用
    const normalized = DataUtils.normalizeSchedule(schedule);
    // store_id または client_id に対応（営業側は client_id を使用）
    const storeId = normalized.store_id || schedule.store_id || schedule.client_id;
    const store = DataUtils.findStore(allStores, storeId) || {};
    // worker_id または assigned_to に対応
    const workerId = normalized.worker_id || schedule.worker_id || schedule.assigned_to;
    // IDの正規化処理を使用してworkerを検索
    let worker = null;
    if (workerId) {
      if (DataUtils && DataUtils.IdUtils && DataUtils.IdUtils.isSame) {
        worker = allWorkers.find(w => DataUtils.IdUtils.isSame(w.id, workerId));
      } else {
        worker = allWorkers.find(w => String(w.id) === String(workerId));
      }
    }
    // 営業担当者を取得
    const salesId = schedule.sales_id || normalized.sales_id;
    const sales = salesId ? allWorkers.find(w => w.id === salesId) : null;
    const isDraft = schedule.status === 'draft';
    
    const displayStoreName = DataUtils.getStoreName(allStores, storeId, normalized.store_name || schedule.store_name || schedule.client_name);
    
    // 法人名・ブランド名を取得
    // - storeId から店舗が引ける場合: stores/brands/clients から導出
    // - 引けない場合（旧データ等）: schedule側に保存されている名称でフォールバック
    const storeFound = !!store?.id;
    const brandId = storeFound ? store.brand_id : null;
    let brandName = storeFound ? getBrandName(brandId) : (schedule.brand_name || '');
    let clientId = storeFound ? (store.client_id || (brandId ? allBrands.find(b => b.id === brandId)?.client_id : null)) : null;
    let clientName = storeFound ? getClientName(clientId) : (schedule.client_name || '');

    // 旧データ救済: 店舗が引けず brand_name も無い場合、店舗名テキストからブランド推定
    if (!storeFound && !brandName) {
      const inferredBrand = inferBrandFromText(displayStoreName || schedule.store_name || '');
      if (inferredBrand) {
        brandName = inferredBrand.name || '';
        clientId = inferredBrand.client_id || clientId;
        if (!clientName && clientId) {
          clientName = getClientName(clientId) || clientName;
        }
      }
    }
    
    return `
      <tr data-id="${schedule.id}" class="${isDraft ? 'draft-row' : ''}">
        <td>
          <span class="schedule-id">${escapeHtml(schedule.id || '-')}</span>
        </td>
        <td>
          <div><strong>${formatDate(normalized.date || schedule.date || schedule.scheduled_date)}</strong></div>
          <div style="font-size:0.85rem;color:#6b7280">${normalized.time || schedule.time_slot || schedule.scheduled_time || '-'}${normalized.duration ? ` (${normalized.duration}分)` : ''}</div>
        </td>
        <td>
          <div class="client-brand-cell">
            <div class="client-line">${escapeHtml(clientName || '-')}</div>
            <div class="brand-line">${escapeHtml(brandName || '-')}</div>
          </div>
        </td>
        <td>
          <div class="store-info">
            <span class="store-address">${escapeHtml(store.pref || '')}${escapeHtml(store.city || '')}</span>
            <span class="store-name">${escapeHtml(displayStoreName)}</span>
          </div>
        </td>
        <td>
          ${sales ? `
            <div class="worker-info" title="${escapeHtml(sales.id || '')}${sales.name ? ' / ' + escapeHtml(sales.name) : ''}">
              <span class="worker-avatar">${(sales.name || sales.id || '?')[0]}</span>
            </div>
          ` : '<span class="unassigned">未設定</span>'}
        </td>
        <td>
          ${worker ? `
            <div class="worker-info">
              <span class="worker-avatar">${(worker.name || '?')[0]}</span>
              <span>${escapeHtml(worker.name || '')}</span>
            </div>
          ` : '<span class="unassigned">未割当</span>'}
        </td>
        <td>
          <span class="status-badge status-${normalized.status}">${getStatusLabel(normalized.status)}</span>
        </td>
        <td>
          ${(() => {
            const cleaningItems = schedule.cleaning_items || normalized.cleaning_items || [];
            if (!Array.isArray(cleaningItems) || cleaningItems.length === 0) {
              return '<span style="color: #9ca3af;">-</span>';
            }
            const itemNames = cleaningItems.map(item => {
              const name = item.name || item.title || '';
              return escapeHtml(name);
            }).filter(name => name);
            if (itemNames.length === 0) return '<span style="color: #9ca3af;">-</span>';
            return `
              <div class="cleaning-tags">
                ${itemNames.map(n => `<span class="cleaning-tag">${n}</span>`).join('')}
              </div>
            `;
          })()}
        </td>
        <td>
          <div class="action-btns">
            ${isDraft ? `
              <button class="action-btn assign" title="アサイン・確定（新規案件）" onclick="quickAssignWorker('${schedule.id}')" style="background:#ffc107;color:#333">
                <i class="fas fa-user-check"></i>
              </button>
            ` : `
              <button class="action-btn edit" title="編集" onclick="editSchedule('${schedule.id}')">
                <i class="fas fa-edit"></i>
              </button>
            `}
            <button class="action-btn delete" title="削除" onclick="confirmDelete('${schedule.id}')">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
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
};

// イベントリスナー
function setupEventListeners() {
  // フィルター
  const storeFilter = document.getElementById('store-filter');
  const salesFilter = document.getElementById('sales-filter');
  const workerFilter = document.getElementById('worker-filter');
  const statusFilter = document.getElementById('status-filter');
  const resetFilters = document.getElementById('reset-filters');
  
  if (storeFilter) {
    storeFilter.addEventListener('change', filterAndRender);
  }
  if (salesFilter) {
    salesFilter.addEventListener('change', filterAndRender);
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
      if (salesFilter) salesFilter.value = '';
      if (workerFilter) workerFilter.value = '';
      if (statusFilter) statusFilter.value = '';
      if (dateRangeFilter) dateRangeFilter.value = 'future'; // デフォルトは「今後のみ」
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
        // フィルタの店舗一覧も更新
        populateStoreSelects();
        // 画面の表示も更新（一覧/カレンダー）
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

      // 店舗/法人/ブランド/住所を補完（保存データを安定させる）
      const store = DataUtils.findStore(allStores, storeId) || allStores.find(s => s.id === storeId) || {};
      const brandId = store.brand_id;
      const brand = allBrands.find(b => b.id === brandId || String(b.id) === String(brandId)) || null;
      const clientId = store.client_id || (brand ? brand.client_id : null);
      const client = allClients.find(c => c.id === clientId || String(c.id) === String(clientId)) || null;
      const derivedStoreName = store.name || '';
      const derivedBrandName = brand ? (brand.name || '') : '';
      const derivedClientName = client ? (client.name || client.company_name || '') : '';
      const derivedAddress = (store.address || `${store.pref || ''}${store.city || ''}${store.street || ''}` || '').trim();
      
      // 清掃内容を取得
      const cleaningItems = selectedCleaningItems.map(item => ({
        name: item.name,
        id: item.id
      }));
      
      const data = {
        store_id: storeId,
        scheduled_date: document.getElementById('schedule-date').value,
        scheduled_time: document.getElementById('schedule-time').value,
        duration_minutes: parseInt(document.getElementById('schedule-duration').value) || 60,
        sales_id: document.getElementById('schedule-sales').value || null,
        worker_id: document.getElementById('schedule-worker').value || null,
        store_name: derivedStoreName,
        brand_name: derivedBrandName,
        client_name: derivedClientName,
        address: derivedAddress,
        cleaning_items: cleaningItems,
        work_content: cleaningItems.length > 0 ? cleaningItems.map(item => item.name).join(', ') : '',
        status: document.getElementById('schedule-status').value,
        notes: document.getElementById('schedule-notes').value
      };

      // 清掃員を割り当てた場合、未確定（draft）から確定（scheduled）に自動更新
      if (!isNew && originalSchedule) {
        const wasDraft = originalSchedule.status === 'draft';
        const originalWorkerId = originalSchedule.worker_id || originalSchedule.assigned_to || '';
        const hadWorker = originalWorkerId && originalWorkerId !== '';
        const hasWorker = data.worker_id && data.worker_id !== '';
        
        // IDの正規化処理を使用して比較
        let workerAssigned = false;
        if (DataUtils && DataUtils.IdUtils && DataUtils.IdUtils.isSame) {
          // IdUtils.isSameを使用してID比較
          workerAssigned = !hadWorker && hasWorker; // 新しく清掃員が割り当てられた
        } else {
          // フォールバック: 文字列比較
          workerAssigned = !hadWorker && hasWorker;
        }
        
        // 未確定状態で清掃員を新しく割り当てた場合、自動的に確定に変更
        if (wasDraft && workerAssigned) {
          data.status = 'scheduled';
          const statusEl = document.getElementById('schedule-status');
          if (statusEl) {
            statusEl.value = 'scheduled';
          }
          console.log('[Admin Schedules] Auto-updating status to scheduled after worker assignment');
        }
      }

      if (isNew) {
        // ID生成はバックエンドに任せる（SCH-YYYYMMDD-NNN形式）
        // data.id = DataUtils.IdUtils.generateSchedule(); // 削除
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
          
          // 新規作成の場合は、適切な時間後に画面をリフレッシュ
          if (isNew) {
            setTimeout(() => {
              location.reload();
            }, 1000); // 1秒後にリフレッシュ（保存成功メッセージを表示してから）
          } else {
            // 編集の場合は、フィルターとレンダリングを更新
            filterAndRender();
            renderCalendar();
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
          updateDraftAlert();
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
  // 店舗サマリーをリセット
  const summaryStoreEl = document.getElementById('schedule-store-summary-store');
  const summaryClientEl = document.getElementById('schedule-store-summary-client');
  const summaryBrandEl = document.getElementById('schedule-store-summary-brand');
  const summaryAddressEl = document.getElementById('schedule-store-summary-address');
  if (summaryStoreEl) summaryStoreEl.textContent = '-';
  if (summaryClientEl) summaryClientEl.textContent = '-';
  if (summaryBrandEl) summaryBrandEl.textContent = '-';
  if (summaryAddressEl) summaryAddressEl.textContent = '-';
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
  
  // 店舗サマリーを更新
  try {
    const summaryStoreEl = document.getElementById('schedule-store-summary-store');
    const summaryClientEl = document.getElementById('schedule-store-summary-client');
    const summaryBrandEl = document.getElementById('schedule-store-summary-brand');
    const summaryAddressEl = document.getElementById('schedule-store-summary-address');
    const store = DataUtils.findStore(allStores, storeId) || allStores.find(s => s.id === storeId) || {};
    const brandId = store.brand_id;
    const brand = allBrands.find(b => b.id === brandId || String(b.id) === String(brandId)) || null;
    const clientId = store.client_id || (brand ? brand.client_id : null);
    const client = allClients.find(c => c.id === clientId || String(c.id) === String(clientId)) || null;
    const storeName = store.name || '-';
    const brandName = brand ? (brand.name || '-') : '-';
    const clientName = client ? (client.name || client.company_name || '-') : '-';
    const address = (store.address || `${store.pref || ''}${store.city || ''}${store.street || ''}` || '').trim() || '-';
    if (summaryStoreEl) summaryStoreEl.textContent = storeName;
    if (summaryClientEl) summaryClientEl.textContent = clientName;
    if (summaryBrandEl) summaryBrandEl.textContent = brandName;
    if (summaryAddressEl) summaryAddressEl.textContent = address;
  } catch (e) {
    // サマリー表示は補助なので失敗しても続行
    console.warn('Failed to update store summary:', e);
  }
  
  if (scheduleDateEl) scheduleDateEl.value = date;
  if (scheduleTimeEl) scheduleTimeEl.value = time;
  if (scheduleDurationEl) scheduleDurationEl.value = schedule.duration_minutes || normalized.duration || 60;
  if (scheduleSalesEl) scheduleSalesEl.value = schedule.sales_id || schedule.created_by || '';
  
  // 清掃員選択の更新（IDの正規化処理を追加）
  if (scheduleWorkerEl) {
    // 清掃員ドロップダウンが既に更新されていることを確認
    // もし更新されていない場合は、populateWorkerSelects()を呼び出す
    if (scheduleWorkerEl.options.length <= 1) {
      populateWorkerSelects();
    }
    
    // workerIdが空の場合は空文字列を設定
    if (!workerId) {
      scheduleWorkerEl.value = '';
    } else {
      // IDの正規化処理を使用して一致する清掃員を探す
      let matchedWorkerId = '';
      if (DataUtils && DataUtils.IdUtils && DataUtils.IdUtils.isSame) {
        // IdUtils.isSameを使用してID比較
        for (let i = 0; i < scheduleWorkerEl.options.length; i++) {
          const option = scheduleWorkerEl.options[i];
          if (option.value && DataUtils.IdUtils.isSame(option.value, workerId)) {
            matchedWorkerId = option.value;
            break;
          }
        }
      } else {
        // フォールバック: 文字列比較
        for (let i = 0; i < scheduleWorkerEl.options.length; i++) {
          const option = scheduleWorkerEl.options[i];
          if (String(option.value) === String(workerId)) {
            matchedWorkerId = option.value;
            break;
          }
        }
      }
      
      if (matchedWorkerId) {
        scheduleWorkerEl.value = matchedWorkerId;
      } else {
        // 一致する清掃員が見つからない場合は空文字列を設定
        console.warn('[Admin Schedules] Worker ID not found in dropdown:', workerId);
        scheduleWorkerEl.value = '';
      }
    }
  }
  
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

// クイックアサイン（清掃員を素早く割り当てる）
window.quickAssignWorker = async function(scheduleId) {
  const schedule = allSchedules.find(s => s.id === scheduleId);
  if (!schedule) {
    alert('スケジュールが見つかりません');
    return;
  }

  // OS課の清掃員のみを抽出
  let osCleaners = allWorkers.filter(w => {
    const role = (w.role || '').toLowerCase();
    const department = (w.department || '').trim();
    // roleがstaffで、かつdepartmentがOS課の場合のみ
    return role === 'staff' && department === 'OS課';
  });

  // OS課の清掃員が見つからない場合のフォールバック
  if (osCleaners.length === 0) {
    // roleがstaffの場合は含める（department情報がない場合の救済）
    osCleaners = allWorkers.filter(w => (w.role || '').toLowerCase() === 'staff');
  }

  if (osCleaners.length === 0) {
    alert('OS課の清掃員が見つかりません');
    return;
  }

  // 現在の清掃員IDを取得
  const normalized = DataUtils.normalizeSchedule(schedule);
  const currentWorkerId = normalized.worker_id || schedule.worker_id || schedule.assigned_to || '';

  // 清掃員選択のドロップダウンを作成
  // 「全員（オープン）」を一番上に追加
  const allOptionHtml = `<option value="ALL" ${!currentWorkerId || currentWorkerId === '' ? 'selected' : ''}>全員（オープン）</option>`;
  const cleanersHtml = osCleaners.map(w => {
    const isSelected = currentWorkerId && (
      (DataUtils && DataUtils.IdUtils && DataUtils.IdUtils.isSame && DataUtils.IdUtils.isSame(w.id, currentWorkerId)) ||
      String(w.id) === String(currentWorkerId)
    );
    return `<option value="${w.id}" ${isSelected ? 'selected' : ''}>${escapeHtml(w.name || '')}</option>`;
  }).join('');
  
  const selectHtml = allOptionHtml + cleanersHtml;

  // モーダルを作成
  const modal = document.createElement('div');
  modal.className = 'quick-assign-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;

  modal.innerHTML = `
    <div style="background: white; padding: 24px; border-radius: 8px; min-width: 320px; max-width: 90%; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
      <h3 style="margin: 0 0 16px 0; font-size: 1.25rem; font-weight: 600;">清掃員を割り当て</h3>
      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #374151;">清掃員を選択</label>
        <select id="quick-assign-worker-select" style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 1rem;">
          ${selectHtml}
        </select>
      </div>
      <div style="display: flex; gap: 8px; justify-content: flex-end;">
        <button id="quick-assign-cancel" style="padding: 8px 16px; border: 1px solid #d1d5db; background: white; border-radius: 6px; cursor: pointer; font-size: 0.875rem;">キャンセル</button>
        <button id="quick-assign-save" style="padding: 8px 16px; border: none; background: #ff679c; color: white; border-radius: 6px; cursor: pointer; font-size: 0.875rem; font-weight: 500;">保存</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // キャンセルボタン
  modal.querySelector('#quick-assign-cancel').addEventListener('click', () => {
    document.body.removeChild(modal);
  });

  // 背景クリックで閉じる
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });

  // 保存ボタン
  modal.querySelector('#quick-assign-save').addEventListener('click', async () => {
    const selectEl = modal.querySelector('#quick-assign-worker-select');
    const selectedValue = selectEl.value;
    
    // 「全員（オープン）」が選択された場合はworker_idをnullに
    const selectedWorkerId = (selectedValue === 'ALL' || selectedValue === '') ? null : selectedValue;

    try {
      // スケジュールを更新
      const updateData = {
        worker_id: selectedWorkerId,
        status: selectedWorkerId ? 'scheduled' : schedule.status // 清掃員を割り当てた場合は自動的にscheduledに
      };

      const response = await fetch(`${API_BASE}/schedules/${scheduleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        throw new Error('更新に失敗しました');
      }

      // レスポンスから更新されたスケジュールデータを取得
      const responseData = await response.json();
      const updatedSchedule = responseData.schedule || responseData || { ...schedule, ...updateData };

      // ローカルデータを更新
      const idx = allSchedules.findIndex(s => s.id === scheduleId);
      if (idx >= 0) {
        allSchedules[idx] = { ...allSchedules[idx], ...updatedSchedule };
      } else {
        // 見つからない場合は追加（念のため）
        allSchedules.push(updatedSchedule);
      }

      // データを再読み込み（最新の状態を取得）
      await loadSchedules();
      
      // 画面を更新
      filterAndRender();
      updateDraftAlert();
      
      // カレンダー表示の場合は再描画
      if (currentView === 'calendar') {
        renderCalendar();
      }

      // モーダルを閉じる
      document.body.removeChild(modal);

      // 成功メッセージを表示
      if (selectedValue === 'ALL' || selectedValue === '') {
        alert('全員（オープン）に設定しました');
      } else {
        alert('清掃員を割り当てました');
      }
    } catch (error) {
      console.error('Quick assign error:', error);
      alert('更新に失敗しました: ' + error.message);
    }
  });
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

function truncateText(text, maxChars) {
  const s = String(text || '');
  if (!maxChars || maxChars <= 0) return s;
  if (s.length <= maxChars) return s;
  return s.slice(0, Math.max(0, maxChars - 1)) + '…';
}

// 参照データ（allBrands/allClients）を使う共通ヘルパー
// ※ renderTable / setupStoreSearch 内のローカル関数とは別。カレンダー等からも参照できる位置に置く。
function getBrandName(brandId) {
  if (!brandId) return '';
  const brand = allBrands.find(b => b.id === brandId || String(b.id) === String(brandId));
  return brand ? (brand.name || '') : '';
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
        const storeFound = !!store?.id;
        const displayStoreName = DataUtils.getStoreName(allStores, storeId, normalized.store_name || schedule.store_name || schedule.client_name);
        const brandId = storeFound ? store.brand_id : null;
        let brandName = storeFound ? getBrandName(brandId) : (schedule.brand_name || '');
        if (!storeFound && !brandName) {
          const inferredBrand = inferBrandFromText(displayStoreName || schedule.store_name || '');
          if (inferredBrand) brandName = inferredBrand.name || '';
        }
        const labelFull = brandName || displayStoreName || '-';
        const labelShort = truncateText(labelFull, 12);
        event.textContent = labelShort;
        event.title = `${normalized.time || ''} ${labelFull}`;
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

