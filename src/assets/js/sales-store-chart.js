/**
 * 清掃カルテ管理
 */

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

let currentStoreId = null;
let currentStore = null;
let allStores = [];
let allClients = [];
let allBrands = [];
let allWorkers = [];
let allServices = [];
let chartData = {
  chart_id: null,  // カルテID（主キー）
  store_id: null,  // 店舗ID（外部キー）
  brand_id: null,  // 参照用（ブランド情報取得用）
  client_id: null, // 参照用（法人情報取得用）
  status: 'active', // active（現在使用中）| archived（アーカイブ）
  version: 'simple', // simple（簡易版）| complete（完全版）
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
  if (!ensureAuthOrRedirect()) return;
  // URLから店舗IDを取得
  const pathParts = window.location.pathname.split('/');
  const storeIdIndex = pathParts.indexOf('stores');
  if (storeIdIndex >= 0 && pathParts[storeIdIndex + 1]) {
    currentStoreId = pathParts[storeIdIndex + 1];
  }

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
    loadChartData()
  ]);

  // イベントリスナー設定
  setupEventListeners();

  // セクションのアコーディオン機能
  setupAccordions();
  
  // 完全版の場合は印刷ボタンを表示
  updatePrintButton();
});

// データ読み込み
async function loadStores() {
  try {
    const response = await fetch(`${API_BASE}/stores`);
    if (handleUnauthorized(response)) return;
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
    if (handleUnauthorized(response)) return;
    const data = await response.json();
    allClients = Array.isArray(data) ? data : (data.items || data.clients || []);
  } catch (error) {
    console.error('Failed to load clients:', error);
  }
}

async function loadBrands() {
  try {
    const response = await fetch(`${API_BASE}/brands`);
    if (handleUnauthorized(response)) return;
    const data = await response.json();
    allBrands = Array.isArray(data) ? data : (data.items || data.brands || []);
  } catch (error) {
    console.error('Failed to load brands:', error);
  }
}

async function loadWorkers() {
  try {
    const response = await fetch(`${API_BASE}/workers`);
    if (handleUnauthorized(response)) return;
    const data = await response.json();
    allWorkers = Array.isArray(data) ? data : (data.items || data.workers || []);
    populateStaffSelect();
  } catch (error) {
    console.error('Failed to load workers:', error);
  }
}

async function loadServices() {
  try {
    // サービス一覧を読み込む（service_items.json）
    const response = await fetch('/data/service_items.json');
    const data = await response.json();
    allServices = Array.isArray(data) ? data : [];
    renderServices();
  } catch (error) {
    console.error('Failed to load services:', error);
    // APIからも試す
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
    // TODO: APIからカルテデータを読み込む
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
        version: loaded.version || 'simple',
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
      // 新規作成時は店舗情報を設定（カルテIDは保存時に生成）
      chartData.store_id = currentStoreId;
      chartData.status = 'active';
      chartData.version = 'simple'; // 営業向けは簡易版
      if (currentStore) {
        chartData.brand_id = currentStore.brand_id;
        chartData.client_id = currentStore.client_id;
      }
    }
    
    renderChartData();
    updatePrintButton();
  } catch (error) {
    console.error('Failed to load chart data:', error);
  }
}

// 基本情報の表示
function renderBasicInfo() {
  if (!currentStore) return;

  const storeNameEl = document.getElementById('store-name');
  const brandNameEl = document.getElementById('brand-name');
  const clientNameEl = document.getElementById('client-name');
  const storeAddressEl = document.getElementById('store-address');
  const storePhoneEl = document.getElementById('store-phone');

  if (storeNameEl) storeNameEl.textContent = currentStore.name || '-';
  
  if (brandNameEl) {
    const brandId = currentStore.brand_id;
    const brand = allBrands.find(b => b.id === brandId || String(b.id) === String(brandId));
    brandNameEl.textContent = brand ? (brand.name || '-') : '-';
  }

  if (clientNameEl) {
    const clientId = currentStore.client_id || (currentStore.brand_id ? 
      allBrands.find(b => b.id === currentStore.brand_id)?.client_id : null);
    const client = allClients.find(c => c.id === clientId || String(c.id) === String(clientId));
    clientNameEl.textContent = client ? (client.name || client.company_name || '-') : '-';
  }

  if (storeAddressEl) {
    const address = currentStore.address || 
      `${currentStore.postcode ? '〒' + currentStore.postcode + ' ' : ''}${currentStore.pref || ''}${currentStore.city || ''}${currentStore.address1 || ''}${currentStore.address2 || ''}`;
    storeAddressEl.textContent = address.trim() || '-';
  }

  if (storePhoneEl) {
    storePhoneEl.textContent = currentStore.phone || currentStore.tel || '-';
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

  // カテゴリ別にグループ化
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
      <button type="button" class="consumable-remove" onclick="removeConsumable(${index})" aria-label="削除">
        <i class="fas fa-times"></i>
      </button>
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

  staffHistoryListEl.innerHTML = chartData.cleaning_staff_history.map(item => {
    const worker = allWorkers.find(w => w.id === item.worker_id || String(w.id) === String(item.worker_id));
    const workerName = worker ? (worker.name || '-') : (item.worker_name || '-');
    const isCurrent = !item.end_date;
    const startDate = item.start_date ? formatDate(item.start_date) : '-';
    const endDate = item.end_date ? formatDate(item.end_date) : '現在';

    return `
      <div class="staff-history-item">
        <div class="staff-history-header">
          <span class="staff-name">
            ${escapeHtml(workerName)}
            ${isCurrent ? '<span class="staff-current-badge">現在</span>' : ''}
          </span>
        </div>
        <div class="staff-dates">${startDate} 〜 ${endDate}</div>
        ${item.notes ? `<div class="staff-notes">${escapeHtml(item.notes)}</div>` : ''}
      </div>
    `;
  }).join('');
}

// 担当者セレクトの設定
function populateStaffSelect() {
  const staffSelectEl = document.getElementById('staff-select');
  if (!staffSelectEl) return;

  // 清掃員のみを抽出（role が staff のユーザー）
  const cleaners = allWorkers.filter(w => (w.role || '').toLowerCase() === 'staff');
  const workers = cleaners.length > 0 ? cleaners : allWorkers;

  staffSelectEl.innerHTML = '<option value="">選択してください</option>' +
    workers.map(w => `<option value="${w.id}">${escapeHtml(w.name || '')}</option>`).join('');
}

// 印刷ボタンの表示/非表示を更新
function updatePrintButton() {
  const printBtn = document.getElementById('print-chart-btn');
  if (printBtn) {
    const version = chartData.version || 'simple';
    if (version === 'complete') {
      printBtn.style.display = 'block';
    } else {
      printBtn.style.display = 'none';
    }
  }
}

// イベントリスナー設定
function setupEventListeners() {
  // 保存ボタン
  const saveBtn = document.getElementById('save-chart-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveChartData);
  }

  // 印刷ボタン
  const printBtn = document.getElementById('print-chart-btn');
  if (printBtn) {
    printBtn.addEventListener('click', printChart);
  }

  // 消耗品追加
  const addConsumableBtn = document.getElementById('add-consumable-btn');
  if (addConsumableBtn) {
    addConsumableBtn.addEventListener('click', () => {
      const modal = document.getElementById('consumable-modal');
      if (modal) {
        // フォームをリセット
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
        // フォームをリセット
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
};

// カルテID生成（簡易版）
function generateChartId() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  // タイムスタンプの下3桁を連番として使用（実際の連番はバックエンドで管理すべき）
  const seq = String(Date.now()).slice(-3).padStart(3, '0');
  return `CHT-${dateStr}-${seq}`;
}

// カルテデータの保存
async function saveChartData() {
  // 店舗IDを確実に設定
  chartData.store_id = currentStoreId;
  
  // ブランドID・法人IDを設定（店舗情報から取得）
  if (currentStore) {
    chartData.brand_id = currentStore.brand_id;
    chartData.client_id = currentStore.client_id;
  }
  
  // カルテIDが未設定の場合は生成（新規作成時）
  if (!chartData.chart_id) {
    chartData.chart_id = generateChartId();
    chartData.created_at = new Date().toISOString();
    // TODO: created_by を現在のユーザーIDに設定
  }
  
  // 更新日時を設定
  chartData.updated_at = new Date().toISOString();
  // TODO: updated_by を現在のユーザーIDに設定
  
  // バージョンを設定（営業向けは簡易版）
  chartData.version = 'simple';
  chartData.status = 'active';
  
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
    
    // 仮の保存（ローカルストレージ）
    localStorage.setItem(`chart_${currentStoreId}`, JSON.stringify(chartData));
    
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

// カルテを印刷
function printChart() {
  // 印刷用のウィンドウを開く
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('ポップアップがブロックされています。ブラウザの設定を確認してください。');
    return;
  }

  // 印刷用HTMLを生成
  const printContent = generatePrintContent();
  printWindow.document.write(printContent);
  printWindow.document.close();
  
  // 印刷ダイアログを表示
  setTimeout(() => {
    printWindow.print();
  }, 250);
}

// 印刷用HTMLを生成
function generatePrintContent() {
  const storeName = currentStore ? (currentStore.name || '-') : '-';
  const brandName = currentStore && currentStore.brand_id
    ? (allBrands.find(b => b.id === currentStore.brand_id)?.name || '-')
    : '-';
  const clientName = currentStore && currentStore.client_id
    ? (allClients.find(c => c.id === currentStore.client_id)?.name || allClients.find(c => c.id === currentStore.client_id)?.company_name || '-')
    : '-';
  const address = currentStore ? (currentStore.address || 
    `${currentStore.postcode ? '〒' + currentStore.postcode + ' ' : ''}${currentStore.pref || ''}${currentStore.city || ''}${currentStore.address1 || ''}${currentStore.address2 || ''}`).trim() : '-';
  const phone = currentStore ? (currentStore.phone || currentStore.tel || '-') : '-';
  
  const equipmentList = chartData.equipment && chartData.equipment.length > 0
    ? chartData.equipment.map(eq => `<li>${escapeHtml(eq)}</li>`).join('')
    : '<li>設備情報がありません</li>';
  
  const servicesList = chartData.services && chartData.services.length > 0
    ? chartData.services.map(svc => `<li>${escapeHtml(svc)}</li>`).join('')
    : '<li>サービス情報がありません</li>';
  
  const consumablesList = chartData.consumables && chartData.consumables.length > 0
    ? chartData.consumables.map(item => {
        const details = [];
        if (item.quantity) details.push(`数量: ${escapeHtml(item.quantity)}`);
        if (item.notes) details.push(escapeHtml(item.notes));
        return `<li>${escapeHtml(item.name)}${details.length > 0 ? ` (${details.join(', ')})` : ''}</li>`;
      }).join('')
    : '<li>消耗品情報がありません</li>';
  
  const staffHistoryList = chartData.cleaning_staff_history && chartData.cleaning_staff_history.length > 0
    ? chartData.cleaning_staff_history.map(item => {
        const worker = allWorkers.find(w => w.id === item.worker_id || String(w.id) === String(item.worker_id));
        const workerName = worker ? (worker.name || '-') : (item.worker_name || '-');
        const isCurrent = !item.end_date;
        const startDate = item.start_date ? formatDate(item.start_date) : '-';
        const endDate = item.end_date ? formatDate(item.end_date) : '現在';
        return `<li>${escapeHtml(workerName)}${isCurrent ? ' (現在)' : ''} - ${startDate} 〜 ${endDate}${item.notes ? ` (${escapeHtml(item.notes)})` : ''}</li>`;
      }).join('')
    : '<li>担当者履歴がありません</li>';
  
  const notes = chartData.notes && chartData.notes.trim() !== ''
    ? escapeHtml(chartData.notes)
    : '特記事項はありません';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>清掃カルテ - ${escapeHtml(storeName)}</title>
  <style>
    @media print {
      @page {
        size: A4;
        margin: 20mm;
      }
      body {
        margin: 0;
        padding: 0;
      }
    }
    body {
      font-family: 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', 'Meiryo', sans-serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #333;
      max-width: 210mm;
      margin: 0 auto;
      padding: 20px;
    }
    h1 {
      font-size: 18pt;
      font-weight: bold;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #333;
    }
    h2 {
      font-size: 14pt;
      font-weight: bold;
      margin-top: 20px;
      margin-bottom: 10px;
      padding-bottom: 5px;
      border-bottom: 1px solid #ccc;
    }
    .info-section {
      margin-bottom: 20px;
    }
    .info-row {
      display: flex;
      margin-bottom: 8px;
    }
    .info-label {
      font-weight: bold;
      width: 120px;
      flex-shrink: 0;
    }
    .info-value {
      flex: 1;
    }
    ul {
      margin: 10px 0;
      padding-left: 20px;
    }
    li {
      margin-bottom: 5px;
    }
    .notes-section {
      margin-top: 20px;
      padding: 10px;
      background: #f5f5f5;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    .print-date {
      text-align: right;
      font-size: 10pt;
      color: #666;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="print-date">印刷日時: ${new Date().toLocaleString('ja-JP')}</div>
  <h1>清掃カルテ</h1>
  
  <div class="info-section">
    <h2>基本情報</h2>
    <div class="info-row">
      <span class="info-label">カルテID:</span>
      <span class="info-value">${chartData.chart_id || '-'}</span>
    </div>
    <div class="info-row">
      <span class="info-label">店舗名:</span>
      <span class="info-value">${escapeHtml(storeName)}</span>
    </div>
    <div class="info-row">
      <span class="info-label">ブランド名:</span>
      <span class="info-value">${escapeHtml(brandName)}</span>
    </div>
    <div class="info-row">
      <span class="info-label">法人名:</span>
      <span class="info-value">${escapeHtml(clientName)}</span>
    </div>
    <div class="info-row">
      <span class="info-label">住所:</span>
      <span class="info-value">${escapeHtml(address)}</span>
    </div>
    <div class="info-row">
      <span class="info-label">電話番号:</span>
      <span class="info-value">${escapeHtml(phone)}</span>
    </div>
  </div>
  
  <div class="info-section">
    <h2>設備</h2>
    <ul>${equipmentList}</ul>
  </div>
  
  <div class="info-section">
    <h2>サービス内容</h2>
    <ul>${servicesList}</ul>
  </div>
  
  <div class="info-section">
    <h2>使用消耗品</h2>
    <ul>${consumablesList}</ul>
  </div>
  
  <div class="info-section">
    <h2>清掃担当者履歴</h2>
    <ul>${staffHistoryList}</ul>
  </div>
  
  <div class="info-section">
    <h2>メモ・特記事項</h2>
    <div class="notes-section">${notes}</div>
  </div>
</body>
</html>
  `;
}
