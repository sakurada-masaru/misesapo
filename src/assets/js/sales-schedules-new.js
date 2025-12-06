const API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';

let allStores = [];
let allWorkers = [];
let allClients = [];
let allBrands = [];
let allServices = [];
let selectedCleaningItems = [];

// DOM要素
let scheduleForm, formStatus;

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
  // DOM要素を取得
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
    if (formStatus) {
      formStatus.textContent = 'データユーティリティの読み込みに失敗しました';
      formStatus.className = 'form-status error';
    }
    return;
  }
  
  await Promise.all([
    loadStores(), 
    loadWorkers(), 
    loadClients(), 
    loadBrands(), 
    loadServices()
  ]);
  
  setupEventListeners();
  setupStoreSearch();
  setupCleaningItemsSearch();
  
  // URLパラメータから日付を取得、なければ今日の日付をデフォルトに設定
  const dateInput = document.getElementById('schedule-date');
  if (dateInput) {
    const urlParams = new URLSearchParams(window.location.search);
    const dateParam = urlParams.get('date');
    if (dateParam) {
      dateInput.value = dateParam;
    } else {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      dateInput.value = `${year}-${month}-${day}`;
    }
  }
});

// データ読み込み
async function loadStores() {
  try {
    const response = await fetch(`${API_BASE}/stores`);
    if (!response.ok) throw new Error('Failed to load stores');
    const data = await response.json();
    allStores = Array.isArray(data) ? data : (data.items || data.stores || []);
  } catch (error) {
    console.error('Failed to load stores:', error);
    allStores = [];
  }
}

async function loadWorkers() {
  try {
    const response = await fetch(`${API_BASE}/workers`);
    if (!response.ok) throw new Error('Failed to load workers');
    const data = await response.json();
    const workers = Array.isArray(data) ? data : (data.items || data.workers || []);
    allWorkers = workers;
    populateSalesSelects();
    populateWorkerSelects();
  } catch (error) {
    console.error('Failed to load workers:', error);
    allWorkers = [];
  }
}

async function loadClients() {
  try {
    const response = await fetch(`${API_BASE}/clients`);
    if (!response.ok) throw new Error('Failed to load clients');
    const data = await response.json();
    allClients = Array.isArray(data) ? data : (data.items || data.clients || []);
  } catch (error) {
    console.error('Failed to load clients:', error);
    allClients = [];
  }
}

async function loadBrands() {
  try {
    const response = await fetch(`${API_BASE}/brands`);
    if (!response.ok) throw new Error('Failed to load brands');
    const data = await response.json();
    allBrands = Array.isArray(data) ? data : (data.items || data.brands || []);
  } catch (error) {
    console.error('Failed to load brands:', error);
    allBrands = [];
  }
}

async function loadServices() {
  try {
    // AWSServicesAPI が読み込まれるまで待機（最大3秒）
    let retries = 30;
    while (!window.AWSServicesAPI && retries > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
      retries--;
    }

    if (window.AWSServicesAPI && window.AWSServicesAPI.loadServices) {
      const data = await window.AWSServicesAPI.loadServices();
      if (Array.isArray(data) && data.length > 0) {
        allServices = data;
      } else if (data && Array.isArray(data.items) && data.items.length > 0) {
        allServices = data.items;
      }
    }
  } catch (error) {
    console.error('Failed to load services:', error);
    allServices = [];
  }
}

// 営業担当者セレクトを設定
function populateSalesSelects() {
  const scheduleSalesEl = document.getElementById('schedule-sales');
  if (!scheduleSalesEl) return;
  
  const salesWorkers = allWorkers.filter(w => w.role === 'sales');
  const options = salesWorkers.map(w => 
    `<option value="${w.id}">${escapeHtml(w.name || '')}</option>`
  ).join('');
  
  scheduleSalesEl.innerHTML = '<option value="">未設定</option>' + options;
}

// 清掃員セレクトを設定
function populateWorkerSelects() {
  const scheduleWorkerEl = document.getElementById('schedule-worker');
  if (!scheduleWorkerEl) return;
  
  const cleaningWorkers = allWorkers.filter(w => w.role === 'staff' || w.role === 'worker');
  const options = cleaningWorkers.map(w => 
    `<option value="${w.id}">${escapeHtml(w.name || '')}</option>`
  ).join('');
  
  if (scheduleWorkerEl) {
    scheduleWorkerEl.innerHTML = '<option value="">全員（オープン）</option>' + options;
  }
}

// 店舗検索機能のセットアップ（カテゴリ絞り込み機能付き）
function setupStoreSearch() {
  const searchInput = document.getElementById('schedule-store-search');
  const resultsDiv = document.getElementById('schedule-store-results');
  const hiddenInput = document.getElementById('schedule-store');
  const categoryFilter = document.getElementById('store-category-filter');
  
  if (!searchInput || !resultsDiv || !hiddenInput) return;
  
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

// イベントリスナー設定
function setupEventListeners() {
  // フォーム送信
  if (scheduleForm) {
    scheduleForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
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
        notes: document.getElementById('schedule-notes').value
      };

      data.created_at = new Date().toISOString();
      data.updated_at = new Date().toISOString();

      try {
        if (formStatus) {
          formStatus.textContent = '保存中...';
          formStatus.className = 'form-status';
        }
        
        const response = await fetch(`${API_BASE}/schedules`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        if (response.ok) {
          if (formStatus) {
            formStatus.textContent = '保存しました';
            formStatus.className = 'form-status success';
          }
          
          // スケジュール一覧ページにリダイレクト
          setTimeout(() => {
            window.location.href = '/sales/schedules';
          }, 1000);
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
}

// HTMLエスケープ関数
function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

