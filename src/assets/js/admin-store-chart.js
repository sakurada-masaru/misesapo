/**
 * 管理画面向け清掃カルテ管理（完全版）
 */

const API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';

let currentStoreId = null;
let currentStore = null;
let allStores = [];
let allClients = [];
let allBrands = [];
let allWorkers = [];
let allServices = [];
let allCharts = []; // 店舗の全カルテ履歴
let chartData = {
  chart_id: null,
  store_id: null,
  brand_id: null,
  client_id: null,
  status: 'active',
  version: 'complete', // 管理画面は完全版
  plan_frequency: 'semiannual', // プラン頻度: monthly, bimonthly, quarterly, semiannual, yearly, spot
  security_box_number: '', // セキュリティボックス番号
  created_at: null,
  created_by: null,
  updated_at: null,
  updated_by: null,
  equipment: [],
  services: [],
  consumables: [],
  cleaning_staff_history: [],
  notes: ''
};

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
  // URLから店舗IDを取得（複数の方法で試行）
  const path = window.location.pathname;
  
  // 方法1: /admin/customers/stores/{id}/chart.html の形式から取得
  const chartMatch = path.match(/\/admin\/customers\/stores\/([^\/]+)\/chart\.html/);
  if (chartMatch) {
    currentStoreId = chartMatch[1];
  } else {
    // 方法2: パスパーツから取得（従来の方法）
    const pathParts = path.split('/');
    const storeIdIndex = pathParts.indexOf('stores');
    if (storeIdIndex >= 0 && pathParts[storeIdIndex + 1]) {
      currentStoreId = pathParts[storeIdIndex + 1];
    }
  }

  // [id]が含まれている場合は、404.htmlのルーティングを待つ
  if (currentStoreId === '[id]' || !currentStoreId) {
    // 404.htmlのルーティングが実行されるまで待つ
    let retryCount = 0;
    const maxRetries = 10;
    const checkInterval = setInterval(() => {
      const pathParts = window.location.pathname.split('/');
      const storeIdIndex = pathParts.indexOf('stores');
      if (storeIdIndex >= 0 && pathParts[storeIdIndex + 1] && pathParts[storeIdIndex + 1] !== '[id]') {
        currentStoreId = pathParts[storeIdIndex + 1];
        clearInterval(checkInterval);
        initializeChart();
      } else if (retryCount >= maxRetries) {
        clearInterval(checkInterval);
        console.error('Store ID not found in URL after retries');
        document.body.innerHTML = '<div style="text-align:center;padding:40px;"><h1>エラー</h1><p>店舗IDが見つかりませんでした。</p><a href="/admin/customers/" style="color:#FF679C;text-decoration:none;">顧客管理に戻る</a></div>';
      }
      retryCount++;
    }, 100);
    return;
  }

  initializeChart();
});

// カルテの初期化処理
async function initializeChart() {
  if (!currentStoreId) {
    console.error('Store ID not found in URL');
    return;
  }

  // データ読み込み
  await Promise.all([
    loadStores(),
    loadClients(),
    loadBrands(),
    loadWorkers(),
    loadServices(),
    loadAllCharts(), // 全カルテ履歴を読み込む
    loadChartData()
  ]);

  // イベントリスナー設定
  setupEventListeners();

  // セクションのアコーディオン機能
  setupAccordions();
  
  // バージョン表示を更新
  updateVersionDisplay();
}

// バージョン表示を更新
function updateVersionDisplay() {
  const versionBadge = document.getElementById('chart-version-badge');
  const versionText = document.getElementById('version-text');
  const upgradeBtn = document.getElementById('upgrade-chart-btn');
  
  if (versionBadge && versionText) {
    const version = chartData.version || 'simple';
    if (version === 'complete') {
      versionText.textContent = '完全版';
      versionBadge.style.background = '#d1fae5';
      versionBadge.style.borderColor = '#10b981';
      versionBadge.style.color = '#065f46';
      versionBadge.style.display = 'flex';
      if (upgradeBtn) upgradeBtn.style.display = 'none';
    } else {
      versionText.textContent = '簡易版（完全版に変換可能）';
      versionBadge.style.background = '#fff3cd';
      versionBadge.style.borderColor = '#ffc107';
      versionBadge.style.color = '#856404';
      versionBadge.style.display = 'flex';
      if (upgradeBtn) upgradeBtn.style.display = 'block';
    }
  }
}

// 全カルテ履歴を読み込む
async function loadAllCharts() {
  try {
    // TODO: APIから全カルテを読み込む
    // const response = await fetch(`${API_BASE}/stores/${currentStoreId}/charts`);
    // const data = await response.json();
    // allCharts = Array.isArray(data) ? data : (data.items || data.charts || []);
    
    // 仮のデータ（ローカルストレージから読み込む）
    const saved = localStorage.getItem(`chart_${currentStoreId}`);
    if (saved) {
      const loaded = JSON.parse(saved);
      allCharts = [loaded]; // 単一カルテを配列に変換
    } else {
      allCharts = [];
    }
    
    renderChartHistorySelector();
  } catch (error) {
    console.error('Failed to load all charts:', error);
  }
}

// カルテ履歴セレクターを表示
function renderChartHistorySelector() {
  const selector = document.getElementById('chart-history-selector');
  const select = document.getElementById('chart-select');
  
  if (!selector || !select) return;
  
  if (allCharts.length <= 1) {
    selector.style.display = 'none';
    return;
  }
  
  selector.style.display = 'block';
  select.innerHTML = '<option value="">アクティブなカルテを選択</option>' +
    allCharts.map(chart => {
      const date = chart.created_at ? formatDate(chart.created_at) : '-';
      const version = chart.version === 'complete' ? '完全版' : '簡易版';
      const status = chart.status === 'active' ? 'アクティブ' : 'アーカイブ';
      return `<option value="${chart.chart_id || ''}">${chart.chart_id || '新規'} - ${version} - ${status} (${date})</option>`;
    }).join('');
  
  // アクティブなカルテを選択
  const activeChart = allCharts.find(c => c.status === 'active');
  if (activeChart && activeChart.chart_id) {
    select.value = activeChart.chart_id;
  }
}

// データ読み込み
async function loadStores() {
  try {
    const response = await fetch(`${API_BASE}/stores`);
    const data = await response.json();
    allStores = Array.isArray(data) ? data : (data.items || data.stores || []);
    currentStore = allStores.find(s => s.id === currentStoreId || String(s.id) === String(currentStoreId));
    if (currentStore) {
      renderBasicInfo();
    }
  } catch (error) {
    console.error('Failed to load stores:', error);
  }
}

async function loadClients() {
  try {
    const response = await fetch(`${API_BASE}/clients`);
    const data = await response.json();
    allClients = Array.isArray(data) ? data : (data.items || data.clients || []);
  } catch (error) {
    console.error('Failed to load clients:', error);
  }
}

async function loadBrands() {
  try {
    const response = await fetch(`${API_BASE}/brands`);
    const data = await response.json();
    allBrands = Array.isArray(data) ? data : (data.items || data.brands || []);
  } catch (error) {
    console.error('Failed to load brands:', error);
  }
}

async function loadWorkers() {
  try {
    const response = await fetch(`${API_BASE}/workers`);
    const data = await response.json();
    allWorkers = Array.isArray(data) ? data : (data.items || data.workers || []);
    populateStaffSelect();
  } catch (error) {
    console.error('Failed to load workers:', error);
  }
}

async function loadServices() {
  try {
    const response = await fetch('/data/service_items.json');
    const data = await response.json();
    allServices = Array.isArray(data) ? data : [];
    renderServices();
  } catch (error) {
    console.error('Failed to load services:', error);
    try {
      const apiResponse = await fetch(`${API_BASE}/services`);
      const apiData = await apiResponse.json();
      allServices = Array.isArray(apiData) ? apiData : (apiData.items || apiData.services || []);
      renderServices();
    } catch (apiError) {
      console.error('Failed to load services from API:', apiError);
    }
  }
}

async function loadChartData() {
  try {
    // TODO: APIからアクティブなカルテを読み込む
    // const response = await fetch(`${API_BASE}/stores/${currentStoreId}/chart`);
    // const data = await response.json();
    // chartData = data;
    
    // 仮のデータ（ローカルストレージから読み込む）
    const saved = localStorage.getItem(`chart_${currentStoreId}`);
    if (saved) {
      const loaded = JSON.parse(saved);
      chartData = {
        chart_id: loaded.chart_id || null,
        store_id: loaded.store_id || currentStoreId,
        brand_id: loaded.brand_id || (currentStore ? currentStore.brand_id : null),
        client_id: loaded.client_id || (currentStore ? currentStore.client_id : null),
        status: loaded.status || 'active',
        version: loaded.version || 'complete', // 管理画面は完全版をデフォルト
        plan_frequency: loaded.plan_frequency || 'semiannual',
        security_box_number: loaded.security_box_number || '',
        created_at: loaded.created_at || null,
        created_by: loaded.created_by || null,
        updated_at: loaded.updated_at || null,
        updated_by: loaded.updated_by || null,
        equipment: loaded.equipment || [],
        services: loaded.services || [],
        consumables: loaded.consumables || [],
        cleaning_staff_history: loaded.cleaning_staff_history || [],
        notes: loaded.notes || ''
      };
    } else {
      // 新規作成時は店舗情報を設定
      chartData.store_id = currentStoreId;
      chartData.status = 'active';
      chartData.version = 'complete'; // 管理画面は完全版
      chartData.plan_frequency = 'semiannual';
      chartData.security_box_number = '';
      if (currentStore) {
        chartData.brand_id = currentStore.brand_id;
        chartData.client_id = currentStore.client_id;
      }
    }
    
    renderChartData();
    updateVersionDisplay();
  } catch (error) {
    console.error('Failed to load chart data:', error);
  }
}

// 基本情報の表示
function renderBasicInfo() {
  if (!currentStore) return;

  // ヘッダーID情報
  const headerClientIdEl = document.getElementById('header-client-id');
  const headerBrandIdEl = document.getElementById('header-brand-id');
  const headerStoreIdEl = document.getElementById('header-store-id');
  const headerChartIdEl = document.getElementById('header-chart-id');
  
  if (headerClientIdEl) {
    const clientId = currentStore.client_id || (currentStore.brand_id ? 
      allBrands.find(b => b.id === currentStore.brand_id)?.client_id : null);
    headerClientIdEl.textContent = clientId ? `-${clientId}` : '-';
  }
  
  if (headerBrandIdEl) {
    const brandId = currentStore.brand_id;
    headerBrandIdEl.textContent = brandId ? `-${brandId}` : '-';
  }
  
  if (headerStoreIdEl) {
    headerStoreIdEl.textContent = currentStoreId ? `-${currentStoreId}` : '-';
  }
  
  if (headerChartIdEl) {
    headerChartIdEl.textContent = chartData.chart_id || '-';
  }

  // メインコンテンツ
  const storeNameEl = document.getElementById('store-name');
  const brandNameEl = document.getElementById('brand-name');
  const contactPersonEl = document.getElementById('contact-person');
  const storeAddressEl = document.getElementById('store-address');
  const storePhoneEl = document.getElementById('store-phone');
  const storeEmailEl = document.getElementById('store-email');

  if (storeNameEl) storeNameEl.textContent = currentStore.name || '-';
  
  if (brandNameEl) {
    const brandId = currentStore.brand_id;
    const brand = allBrands.find(b => b.id === brandId || String(b.id) === String(brandId));
    brandNameEl.textContent = brand ? (brand.name || '-') : '-';
  }

  if (contactPersonEl) {
    contactPersonEl.textContent = currentStore.contact_person || currentStore.contact_name || '-';
  }

  if (storeAddressEl) {
    const address = currentStore.address || 
      `${currentStore.postcode ? '〒' + currentStore.postcode + ' ' : ''}${currentStore.pref || ''}${currentStore.city || ''}${currentStore.address1 || ''}${currentStore.address2 || ''}`;
    storeAddressEl.textContent = address.trim() || '-';
  }

  if (storePhoneEl) {
    storePhoneEl.textContent = currentStore.phone || currentStore.tel || '-';
  }
  
  if (storeEmailEl) {
    storeEmailEl.textContent = currentStore.email || currentStore.email_address || '-';
  }
  
  // プラン選択
  const planFrequency = chartData.plan_frequency || 'semiannual';
  const planRadio = document.getElementById(`plan-${planFrequency}`);
  if (planRadio) {
    planRadio.checked = true;
  }
  
  // セキュリティボックス番号
  const securityBoxNumberEl = document.getElementById('security-box-number');
  if (securityBoxNumberEl) {
    securityBoxNumberEl.value = chartData.security_box_number || '';
  }
}

// サービスの表示
function renderServices() {
  const servicesListEl = document.getElementById('services-list');
  if (!servicesListEl) return;

  if (allServices.length === 0) {
    servicesListEl.innerHTML = '<div class="empty-state">サービスが見つかりません</div>';
    return;
  }

  const servicesByCategory = {};
  allServices.forEach(service => {
    const category = service.category || 'その他';
    if (!servicesByCategory[category]) {
      servicesByCategory[category] = [];
    }
    servicesByCategory[category].push(service);
  });

  let html = '';
  Object.keys(servicesByCategory).forEach(category => {
    html += `<div class="equipment-category">
      <h3 class="category-title">${escapeHtml(category)}</h3>
      <div class="checkbox-group">`;
    
    servicesByCategory[category].forEach(service => {
      const serviceName = service.title || service.name || '';
      const isChecked = chartData.services.includes(serviceName);
      html += `
        <label class="checkbox-item">
          <input type="checkbox" name="services" value="${escapeHtml(serviceName)}" ${isChecked ? 'checked' : ''}>
          <span class="checkbox-label">${escapeHtml(serviceName)}</span>
        </label>`;
    });
    
    html += `</div></div>`;
  });

  servicesListEl.innerHTML = html;
}

// カルテデータの表示
function renderChartData() {
  // カルテIDを表示
  const chartIdEl = document.getElementById('chart-id');
  if (chartIdEl) {
    chartIdEl.textContent = chartData.chart_id || '-';
  }
  
  // 設備チェックボックス
  const equipmentCheckboxes = document.querySelectorAll('input[name="equipment"]');
  equipmentCheckboxes.forEach(checkbox => {
    checkbox.checked = chartData.equipment.includes(checkbox.value);
  });

  // サービスチェックボックス（renderServicesで処理済み）

  // 消耗品
  renderConsumables();

  // 担当者履歴
  renderStaffHistory();

  // メモ
  const notesEl = document.getElementById('chart-notes');
  if (notesEl) {
    notesEl.value = chartData.notes || '';
  }
  
  // ステータス
  const statusEl = document.getElementById('chart-status');
  if (statusEl) {
    statusEl.value = chartData.status || 'active';
  }
}

// 消耗品の表示
function renderConsumables() {
  const consumablesListEl = document.getElementById('consumables-list');
  if (!consumablesListEl) return;

  if (chartData.consumables.length === 0) {
    consumablesListEl.innerHTML = '<div class="empty-state">消耗品が登録されていません</div>';
    return;
  }

  consumablesListEl.innerHTML = chartData.consumables.map((item, index) => `
    <div class="consumable-item">
      <div class="consumable-info">
        <div class="consumable-name">${escapeHtml(item.name)}</div>
        <div class="consumable-details">
          ${item.quantity ? `数量: ${escapeHtml(item.quantity)}` : ''}
          ${item.notes ? ` | ${escapeHtml(item.notes)}` : ''}
        </div>
      </div>
      <div class="consumable-actions">
        <button type="button" class="btn-icon" onclick="editConsumable(${index})" aria-label="編集">
          <i class="fas fa-edit"></i>
        </button>
        <button type="button" class="btn-icon danger" onclick="removeConsumable(${index})" aria-label="削除">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `).join('');
}

// 担当者履歴の表示
function renderStaffHistory() {
  const staffHistoryListEl = document.getElementById('staff-history-list');
  if (!staffHistoryListEl) return;

  if (chartData.cleaning_staff_history.length === 0) {
    staffHistoryListEl.innerHTML = '<div class="empty-state">担当者履歴がありません</div>';
    return;
  }

  staffHistoryListEl.innerHTML = chartData.cleaning_staff_history.map((item, index) => {
    const worker = allWorkers.find(w => w.id === item.worker_id || String(w.id) === String(item.worker_id));
    const workerName = worker ? (worker.name || '-') : (item.worker_name || '-');
    const isCurrent = !item.end_date;
    const startDate = item.start_date ? formatDate(item.start_date) : '-';
    const endDate = item.end_date ? formatDate(item.end_date) : '現在';

    return `
      <div class="staff-history-item">
        <div class="staff-history-header">
          <span class="staff-history-name">
            ${escapeHtml(workerName)}
            ${isCurrent ? '<span class="staff-current-badge">現在</span>' : ''}
          </span>
          <div class="consumable-actions">
            <button type="button" class="btn-icon" onclick="editStaffHistory(${index})" aria-label="編集">
              <i class="fas fa-edit"></i>
            </button>
            <button type="button" class="btn-icon danger" onclick="removeStaffHistory(${index})" aria-label="削除">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
        <div class="staff-history-dates">${startDate} 〜 ${endDate}</div>
        ${item.notes ? `<div class="staff-history-notes">${escapeHtml(item.notes)}</div>` : ''}
      </div>
    `;
  }).join('');
}

// 担当者セレクトの設定
function populateStaffSelect() {
  const staffSelectEl = document.getElementById('staff-select');
  if (!staffSelectEl) return;

  const cleaners = allWorkers.filter(w => (w.role || '').toLowerCase() === 'staff');
  const workers = cleaners.length > 0 ? cleaners : allWorkers;

  staffSelectEl.innerHTML = '<option value="">選択してください</option>' +
    workers.map(w => `<option value="${w.id}">${escapeHtml(w.name || '')}</option>`).join('');
}

// イベントリスナー設定
function setupEventListeners() {
  // 保存ボタン
  const saveBtn = document.getElementById('save-chart-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveChartData);
  }

  // 完全版への変換ボタン
  const upgradeBtn = document.getElementById('upgrade-chart-btn');
  if (upgradeBtn) {
    upgradeBtn.addEventListener('click', upgradeToComplete);
  }

  // カルテ履歴セレクター
  const chartSelect = document.getElementById('chart-select');
  if (chartSelect) {
    chartSelect.addEventListener('change', (e) => {
      const chartId = e.target.value;
      if (chartId) {
        loadChartById(chartId);
      }
    });
  }

  // プラン選択変更
  const planRadios = document.querySelectorAll('input[name="plan-frequency"]');
  planRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      chartData.plan_frequency = e.target.value;
    });
  });
  
  // セキュリティボックス番号変更
  const securityBoxNumberEl = document.getElementById('security-box-number');
  if (securityBoxNumberEl) {
    securityBoxNumberEl.addEventListener('input', (e) => {
      chartData.security_box_number = e.target.value.trim();
    });
  }

  // 消耗品追加
  const addConsumableBtn = document.getElementById('add-consumable-btn');
  if (addConsumableBtn) {
    addConsumableBtn.addEventListener('click', () => {
      const modal = document.getElementById('consumable-modal');
      if (modal) {
        document.getElementById('consumable-name').value = '';
        document.getElementById('consumable-quantity').value = '';
        document.getElementById('consumable-notes').value = '';
        modal.showModal();
      }
    });
  }

  const saveConsumableBtn = document.getElementById('save-consumable-btn');
  if (saveConsumableBtn) {
    saveConsumableBtn.addEventListener('click', addConsumable);
  }

  // 担当者追加
  const addStaffBtn = document.getElementById('add-staff-btn');
  if (addStaffBtn) {
    addStaffBtn.addEventListener('click', () => {
      const modal = document.getElementById('staff-modal');
      if (modal) {
        document.getElementById('staff-select').value = '';
        document.getElementById('staff-start-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('staff-end-date').value = '';
        document.getElementById('staff-notes').value = '';
        modal.showModal();
      }
    });
  }

  const saveStaffBtn = document.getElementById('save-staff-btn');
  if (saveStaffBtn) {
    saveStaffBtn.addEventListener('click', addStaff);
  }
}

// アコーディオン機能
function setupAccordions() {
  const sectionHeaders = document.querySelectorAll('.section-header');
  sectionHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const section = header.closest('.chart-section');
      const content = section.querySelector('.section-content');
      const toggle = header.querySelector('.section-toggle');
      
      if (content) {
        content.classList.toggle('collapsed');
        if (toggle) {
          toggle.classList.toggle('active');
        }
      }
    });
  });
}

// 簡易版→完全版への変換
async function upgradeToComplete() {
  if (chartData.version === 'complete') {
    alert('このカルテは既に完全版です');
    return;
  }

  if (!confirm('簡易版を完全版に変換しますか？この操作は元に戻せません。')) {
    return;
  }

  chartData.version = 'complete';
  chartData.updated_at = new Date().toISOString();
  
  try {
    // TODO: APIで変換
    // const response = await fetch(`${API_BASE}/charts/${chartData.chart_id}/upgrade`, {
    //   method: 'PUT',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ version: 'complete' })
    // });
    
    // ローカルストレージに保存
    localStorage.setItem(`chart_${currentStoreId}`, JSON.stringify(chartData));
    
    updateVersionDisplay();
    alert('完全版に変換しました');
  } catch (error) {
    console.error('Failed to upgrade chart:', error);
    alert('変換に失敗しました');
  }
}

// カルテIDでカルテを読み込む
async function loadChartById(chartId) {
  try {
    // TODO: APIから読み込む
    // const response = await fetch(`${API_BASE}/charts/${chartId}`);
    // const data = await response.json();
    // chartData = data;
    
    // 仮の実装（ローカルストレージから読み込む）
    const chart = allCharts.find(c => c.chart_id === chartId);
    if (chart) {
      chartData = { ...chart };
      renderChartData();
      updateVersionDisplay();
    }
  } catch (error) {
    console.error('Failed to load chart by ID:', error);
  }
}

// 消耗品の追加
function addConsumable() {
  const nameEl = document.getElementById('consumable-name');
  const quantityEl = document.getElementById('consumable-quantity');
  const notesEl = document.getElementById('consumable-notes');

  if (!nameEl || !nameEl.value.trim()) {
    alert('消耗品名を入力してください');
    return;
  }

  const consumable = {
    name: nameEl.value.trim(),
    quantity: quantityEl ? quantityEl.value.trim() : '',
    notes: notesEl ? notesEl.value.trim() : ''
  };

  if (!chartData.consumables) {
    chartData.consumables = [];
  }
  chartData.consumables.push(consumable);

  renderConsumables();

  const modal = document.getElementById('consumable-modal');
  if (modal) {
    modal.close();
  }
}

// 消耗品の編集
window.editConsumable = function(index) {
  const item = chartData.consumables[index];
  if (!item) return;

  const modal = document.getElementById('consumable-modal');
  if (modal) {
    document.getElementById('consumable-name').value = item.name || '';
    document.getElementById('consumable-quantity').value = item.quantity || '';
    document.getElementById('consumable-notes').value = item.notes || '';
    modal.showModal();
    
    // 保存ボタンのイベントを一時的に変更
    const saveBtn = document.getElementById('save-consumable-btn');
    if (saveBtn) {
      saveBtn.onclick = () => {
        item.name = document.getElementById('consumable-name').value.trim();
        item.quantity = document.getElementById('consumable-quantity').value.trim();
        item.notes = document.getElementById('consumable-notes').value.trim();
        renderConsumables();
        modal.close();
        saveBtn.onclick = addConsumable; // 元に戻す
      };
    }
  }
};

// 消耗品の削除
window.removeConsumable = function(index) {
  if (confirm('この消耗品を削除しますか？')) {
    chartData.consumables.splice(index, 1);
    renderConsumables();
  }
};

// 担当者の追加
function addStaff() {
  const selectEl = document.getElementById('staff-select');
  const startDateEl = document.getElementById('staff-start-date');
  const endDateEl = document.getElementById('staff-end-date');
  const notesEl = document.getElementById('staff-notes');

  if (!selectEl || !selectEl.value) {
    alert('担当者を選択してください');
    return;
  }

  const worker = allWorkers.find(w => w.id === selectEl.value || String(w.id) === String(selectEl.value));
  const staffHistory = {
    worker_id: selectEl.value,
    worker_name: worker ? (worker.name || '') : '',
    start_date: startDateEl ? startDateEl.value : new Date().toISOString().split('T')[0],
    end_date: endDateEl && endDateEl.value ? endDateEl.value : null,
    notes: notesEl ? notesEl.value.trim() : ''
  };

  if (!chartData.cleaning_staff_history) {
    chartData.cleaning_staff_history = [];
  }
  chartData.cleaning_staff_history.push(staffHistory);

  renderStaffHistory();

  const modal = document.getElementById('staff-modal');
  if (modal) {
    modal.close();
  }
}

// 担当者履歴の編集
window.editStaffHistory = function(index) {
  const item = chartData.cleaning_staff_history[index];
  if (!item) return;

  const modal = document.getElementById('staff-modal');
  if (modal) {
    document.getElementById('staff-select').value = item.worker_id || '';
    document.getElementById('staff-start-date').value = item.start_date || new Date().toISOString().split('T')[0];
    document.getElementById('staff-end-date').value = item.end_date || '';
    document.getElementById('staff-notes').value = item.notes || '';
    modal.showModal();
    
    const saveBtn = document.getElementById('save-staff-btn');
    if (saveBtn) {
      saveBtn.onclick = () => {
        const selectEl = document.getElementById('staff-select');
        const worker = allWorkers.find(w => w.id === selectEl.value || String(w.id) === String(selectEl.value));
        item.worker_id = selectEl.value;
        item.worker_name = worker ? (worker.name || '') : '';
        item.start_date = document.getElementById('staff-start-date').value;
        item.end_date = document.getElementById('staff-end-date').value || null;
        item.notes = document.getElementById('staff-notes').value.trim();
        renderStaffHistory();
        modal.close();
        saveBtn.onclick = addStaff; // 元に戻す
      };
    }
  }
};

// 担当者履歴の削除
window.removeStaffHistory = function(index) {
  if (confirm('この担当者履歴を削除しますか？')) {
    chartData.cleaning_staff_history.splice(index, 1);
    renderStaffHistory();
  }
};

// カルテID生成
function generateChartId() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  const seq = String(Date.now()).slice(-3).padStart(3, '0');
  return `CHT-${dateStr}-${seq}`;
}

// カルテデータの保存
async function saveChartData() {
  chartData.store_id = currentStoreId;
  
  if (currentStore) {
    chartData.brand_id = currentStore.brand_id;
    chartData.client_id = currentStore.client_id;
  }
  
  if (!chartData.chart_id) {
    chartData.chart_id = generateChartId();
    chartData.created_at = new Date().toISOString();
  }
  
  chartData.updated_at = new Date().toISOString();
  chartData.version = 'complete'; // 管理画面は完全版
  
  // プラン頻度を取得
  const planRadio = document.querySelector('input[name="plan-frequency"]:checked');
  if (planRadio) {
    chartData.plan_frequency = planRadio.value;
  }
  
  // セキュリティボックス番号を取得
  const securityBoxNumberEl = document.getElementById('security-box-number');
  if (securityBoxNumberEl) {
    chartData.security_box_number = securityBoxNumberEl.value.trim();
  }
  
  // 設備データを取得
  const equipmentCheckboxes = document.querySelectorAll('input[name="equipment"]:checked');
  chartData.equipment = Array.from(equipmentCheckboxes).map(cb => cb.value);

  // サービスデータを取得
  const serviceCheckboxes = document.querySelectorAll('input[name="services"]:checked');
  chartData.services = Array.from(serviceCheckboxes).map(cb => cb.value);

  // メモを取得
  const notesEl = document.getElementById('chart-notes');
  if (notesEl) {
    chartData.notes = notesEl.value.trim();
  }

  try {
    // TODO: APIに保存
    // const response = await fetch(`${API_BASE}/charts`, {
    //   method: chartData.chart_id ? 'PUT' : 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(chartData)
    // });
    
    // ローカルストレージに保存
    localStorage.setItem(`chart_${currentStoreId}`, JSON.stringify(chartData));
    
    // 全カルテリストを更新
    const existingIndex = allCharts.findIndex(c => c.chart_id === chartData.chart_id);
    if (existingIndex >= 0) {
      allCharts[existingIndex] = { ...chartData };
    } else {
      allCharts.push({ ...chartData });
    }
    renderChartHistorySelector();
    
    alert('カルテを保存しました');
  } catch (error) {
    console.error('Failed to save chart data:', error);
    alert('保存に失敗しました');
  }
}

// ユーティリティ
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

