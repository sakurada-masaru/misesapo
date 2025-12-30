const API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';

function isTokenExpired(token) {
  if (!token || token === 'mock-token' || token === 'dev-token') return true;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return true;
    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return false;
    const now = Math.floor(Date.now() / 1000);
    return payload.exp <= now + 30;
  } catch (error) {
    console.warn('[Auth] Failed to parse token:', error);
    return true;
  }
}

function getStoredToken() {
  try {
    const cognitoIdToken = localStorage.getItem('cognito_id_token');
    if (cognitoIdToken && !isTokenExpired(cognitoIdToken)) {
      return cognitoIdToken;
    }
    const authData = localStorage.getItem('misesapo_auth');
    if (authData) {
      const parsed = JSON.parse(authData);
      if (parsed.token && !isTokenExpired(parsed.token)) {
        return parsed.token;
      }
    }
  } catch (error) {
    console.error('Error getting ID token:', error);
  }
  return null;
}

let authRedirecting = false;
function redirectToSignin() {
  if (authRedirecting) return;
  authRedirecting = true;
  localStorage.removeItem('cognito_id_token');
  localStorage.removeItem('cognito_access_token');
  localStorage.removeItem('cognito_refresh_token');
  localStorage.removeItem('cognito_user');
  localStorage.removeItem('misesapo_auth');
  const redirect = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.href = `/staff/signin.html?redirect=${redirect}`;
}

function ensureAuthOrRedirect() {
  const token = getStoredToken();
  if (!token) {
    redirectToSignin();
    return null;
  }
  return token;
}

function handleUnauthorized(response) {
  if (response.status === 401 || response.status === 403) {
    redirectToSignin();
    return true;
  }
  return false;
}

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
  if (!ensureAuthOrRedirect()) return;
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
  setupEventListeners();
  setupHierarchicalSelection(); // Changed from setupStoreSearch
  setupCleaningItemsSearch();
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
    if (handleUnauthorized(response)) return;
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
    if (handleUnauthorized(response)) return;
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
    if (handleUnauthorized(response)) return;
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
    if (handleUnauthorized(response)) return;
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

  // 管理画面と同じ基準で「営業」を抽出（role / roles / department など）
  const isSalesPerson = (w) => {
    if (!w) return false;
    const role = String(w.role || '').toLowerCase();
    const roles = Array.isArray(w.roles) ? w.roles.map(r => String(r).toLowerCase()) : [];
    const dept = String(w.department || w.dept || w.division || w.team || '').toLowerCase();
    return role === 'sales' || roles.includes('sales') || dept.includes('営業') || dept.includes('sales');
  };
  let salesWorkers = allWorkers.filter(isSalesPerson);
  if (salesWorkers.length === 0) salesWorkers = allWorkers;
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

// 階層型選択UIのセットアップ
function setupHierarchicalSelection() {
  const clientSelect = document.getElementById('select-client');
  const brandSelect = document.getElementById('select-brand');
  const storeSelect = document.getElementById('select-store');
  const hiddenStoreInput = document.getElementById('schedule-store');

  // 表示用エレメント
  const displayAddress = document.getElementById('display-address');
  const displayPhone = document.getElementById('display-phone');
  const storeInfoDisplay = document.getElementById('store-info-display');

  if (!clientSelect) return;

  // 1. Initial Load of Clients
  const populateClients = () => {
    clientSelect.innerHTML = '<option value="">法人を選択してください</option>';
    allClients.forEach(client => {
      const option = document.createElement('option');
      option.value = client.id;
      option.textContent = client.name || client.company_name;
      clientSelect.appendChild(option);
    });
  };

  // 2. Client Change -> Populate Brands
  clientSelect.addEventListener('change', () => {
    const clientId = clientSelect.value;

    // Reset lower levels
    brandSelect.innerHTML = '<option value="">先に法人を選択してください</option>';
    brandSelect.disabled = true;
    storeSelect.innerHTML = '<option value="">先にブランドを選択してください</option>';
    storeSelect.disabled = true;
    hiddenStoreInput.value = '';
    storeInfoDisplay.style.display = 'none';

    if (!clientId) return;

    // Filter brands by client
    // Note: brand object typically has client_id
    const filteredBrands = allBrands.filter(b => String(b.client_id) === String(clientId));

    if (filteredBrands.length === 0) {
      brandSelect.innerHTML = '<option value="">紐づくブランドがありません</option>';
      return;
    }

    brandSelect.innerHTML = '<option value="">ブランドを選択してください</option>';
    filteredBrands.forEach(brand => {
      const option = document.createElement('option');
      option.value = brand.id;
      option.textContent = brand.name;
      brandSelect.appendChild(option);
    });
    brandSelect.disabled = false;
  });

  // 3. Brand Change -> Populate Stores
  brandSelect.addEventListener('change', () => {
    const brandId = brandSelect.value;

    // Reset lower levels
    storeSelect.innerHTML = '<option value="">先にブランドを選択してください</option>';
    storeSelect.disabled = true;
    hiddenStoreInput.value = '';
    storeInfoDisplay.style.display = 'none';

    if (!brandId) return;

    // Filter stores by brand
    const filteredStores = allStores.filter(s => String(s.brand_id) === String(brandId));

    if (filteredStores.length === 0) {
      storeSelect.innerHTML = '<option value="">紐づく店舗がありません</option>';
      return;
    }

    storeSelect.innerHTML = '<option value="">店舗を選択してください</option>';
    filteredStores.forEach(store => {
      const option = document.createElement('option');
      option.value = store.id;
      option.textContent = store.name;
      storeSelect.appendChild(option);
    });
    storeSelect.disabled = false;
  });

  // 4. Store Change -> Set Hidden Input and Show Info
  storeSelect.addEventListener('change', () => {
    const storeId = storeSelect.value;
    hiddenStoreInput.value = storeId;

    if (!storeId) {
      storeInfoDisplay.style.display = 'none';
      return;
    }

    const store = allStores.find(s => String(s.id) === String(storeId));
    if (store) {
      const address = (store.address || `${store.postcode ? '〒' + store.postcode + ' ' : ''}${store.pref || ''}${store.city || ''}${store.address1 || ''}${store.address2 || ''}`).trim();
      displayAddress.textContent = address || '未登録';
      displayPhone.textContent = store.phone || store.tel || '未登録';
      storeInfoDisplay.style.display = 'block';

      // Set other hidden/auto fields
      const addressEl = document.getElementById('schedule-address');
      const phoneEl = document.getElementById('schedule-phone');
      const emailEl = document.getElementById('schedule-email');
      const contactEl = document.getElementById('schedule-contact-person');

      if (addressEl && !addressEl.value) addressEl.value = address;
      if (phoneEl && !phoneEl.value) phoneEl.value = store.phone || store.tel || '';
      if (emailEl && !emailEl.value) emailEl.value = store.email || '';
      if (contactEl && !contactEl.value) contactEl.value = store.contact_person || '';
    }
  });

  // Add delay to ensure data load
  setTimeout(populateClients, 500);
}

// (Old setupStoreSearch removed)

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
      item.addEventListener('click', function () {
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

  window.removeCleaningItem = function (index) {
    selectedCleaningItems.splice(index, 1);
    updateCleaningItemsSelected();
  };

  searchInput.addEventListener('input', updateCleaningItemsDropdown);
  searchInput.addEventListener('focus', function () {
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
        // 管理スケジュールと同じく、参照用に名称/連絡先を保存（検索/表示のフォールバックに使う）
        client_name: clientName || '',
        brand_name: brandName || '',
        store_name: storeFound ? (selectedStore.name || '') : '',
        address: (document.getElementById('schedule-address')?.value || '').trim(),
        phone: (document.getElementById('schedule-phone')?.value || '').trim(),
        email: (document.getElementById('schedule-email')?.value || '').trim(),
        contact_person: (document.getElementById('schedule-contact-person')?.value || '').trim(),

        // HACCP Data
        haccp_instructions: Array.from(document.querySelectorAll('input[name="haccp_instruction[]"]:checked')).map(cb => cb.value),
        haccp_notes: (document.getElementById('haccp-notes')?.value || '').trim()
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
