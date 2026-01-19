/**
 * 清掃員向け清掃カルテ閲覧
 */

const API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';

let currentScheduleId = null;
let currentStoreId = null;
let currentStore = null;
let allStores = [];
let allClients = [];
let allBrands = [];
let allWorkers = [];
let chartData = null;

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
  // URLからスケジュールIDを取得
  const pathParts = window.location.pathname.split('/');
  const scheduleIndex = pathParts.indexOf('schedules');
  if (scheduleIndex >= 0 && pathParts[scheduleIndex + 1]) {
    currentScheduleId = pathParts[scheduleIndex + 1];
  }

  if (!currentScheduleId) {
    console.error('Schedule ID not found in URL');
    return;
  }

  // データ読み込み
  await Promise.all([
    loadStores(),
    loadClients(),
    loadBrands(),
    loadWorkers(),
    loadSchedule(),
    loadChartData()
  ]);

  // セクションのアコーディオン機能
  setupAccordions();
});

// スケジュールを読み込んで店舗IDを取得
async function loadSchedule() {
  try {
    // TODO: APIからスケジュールを読み込む
    // const response = await fetch(`${API_BASE}/schedules/${currentScheduleId}`);
    // const schedule = await response.json();
    // currentStoreId = schedule.store_id;
    
    // 仮の実装（URLから直接取得できない場合は、スケジュール一覧から取得する必要がある）
    // ここでは、スケジュールIDから店舗IDを取得する方法を想定
    console.log('Loading schedule:', currentScheduleId);
  } catch (error) {
    console.error('Failed to load schedule:', error);
  }
}

// データ読み込み
async function loadStores() {
  try {
    const response = await fetch(`${API_BASE}/stores`);
    const data = await response.json();
    allStores = Array.isArray(data) ? data : (data.items || data.stores || []);
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
  } catch (error) {
    console.error('Failed to load workers:', error);
  }
}

async function loadChartData() {
  try {
    // まずスケジュールから店舗IDを取得（仮実装）
    // 実際には、スケジュールAPIから取得する必要がある
    // ここでは、URLパラメータやlocalStorageから取得することを想定
    
    // TODO: APIからアクティブなカルテを読み込む
    // const response = await fetch(`${API_BASE}/stores/${currentStoreId}/chart`);
    // const data = await response.json();
    // chartData = data;
    
    // 仮のデータ（ローカルストレージから読み込む）
    // スケジュールIDから店舗IDを取得する必要がある
    // ここでは、すべての店舗のカルテを検索する（非効率だが仮実装）
    let foundChart = null;
    for (const store of allStores) {
      const saved = localStorage.getItem(`chart_${store.id}`);
      if (saved) {
        const loaded = JSON.parse(saved);
        if (loaded.status === 'active' && loaded.version === 'complete') {
          foundChart = loaded;
          currentStoreId = store.id;
          break;
        }
      }
    }
    
    if (foundChart) {
      chartData = foundChart;
      currentStore = allStores.find(s => s.id === currentStoreId || String(s.id) === String(currentStoreId));
      renderChartData();
    } else {
      // カルテが見つからない場合
      document.getElementById('equipment-list').innerHTML = '<div class="empty-state">カルテが登録されていません</div>';
      document.getElementById('services-list').innerHTML = '<div class="empty-state">カルテが登録されていません</div>';
      document.getElementById('consumables-list').innerHTML = '<div class="empty-state">カルテが登録されていません</div>';
      document.getElementById('staff-history-list').innerHTML = '<div class="empty-state">カルテが登録されていません</div>';
      document.getElementById('notes-content').innerHTML = '<div class="empty-state">カルテが登録されていません</div>';
    }
  } catch (error) {
    console.error('Failed to load chart data:', error);
  }
}

// カルテデータの表示
function renderChartData() {
  if (!chartData || !currentStore) return;

  // 基本情報
  renderBasicInfo();

  // 設備
  renderEquipment();

  // サービス
  renderServices();

  // 消耗品
  renderConsumables();

  // 担当者履歴
  renderStaffHistory();

  // メモ
  renderNotes();
}

// 基本情報の表示
function renderBasicInfo() {
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

// 設備の表示
function renderEquipment() {
  const equipmentListEl = document.getElementById('equipment-list');
  if (!equipmentListEl) return;

  if (!chartData.equipment || chartData.equipment.length === 0) {
    equipmentListEl.innerHTML = '<div class="empty-state">設備情報がありません</div>';
    return;
  }

  equipmentListEl.innerHTML = chartData.equipment.map(eq => `
    <span class="equipment-tag">${escapeHtml(eq)}</span>
  `).join('');
}

// サービスの表示
function renderServices() {
  const servicesListEl = document.getElementById('services-list');
  if (!servicesListEl) return;

  if (!chartData.services || chartData.services.length === 0) {
    servicesListEl.innerHTML = '<div class="empty-state">サービス情報がありません</div>';
    return;
  }

  servicesListEl.innerHTML = chartData.services.map(service => `
    <div class="service-item">${escapeHtml(service)}</div>
  `).join('');
}

// 消耗品の表示
function renderConsumables() {
  const consumablesListEl = document.getElementById('consumables-list');
  if (!consumablesListEl) return;

  if (!chartData.consumables || chartData.consumables.length === 0) {
    consumablesListEl.innerHTML = '<div class="empty-state">消耗品情報がありません</div>';
    return;
  }

  consumablesListEl.innerHTML = chartData.consumables.map(item => `
    <div class="consumable-item">
      <div class="consumable-name">${escapeHtml(item.name)}</div>
      <div class="consumable-details">
        ${item.quantity ? `数量: ${escapeHtml(item.quantity)}` : ''}
        ${item.notes ? ` | ${escapeHtml(item.notes)}` : ''}
      </div>
    </div>
  `).join('');
}

// 担当者履歴の表示
function renderStaffHistory() {
  const staffHistoryListEl = document.getElementById('staff-history-list');
  if (!staffHistoryListEl) return;

  if (!chartData.cleaning_staff_history || chartData.cleaning_staff_history.length === 0) {
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
        <div class="staff-history-name">
          ${escapeHtml(workerName)}
          ${isCurrent ? '<span class="staff-current-badge">現在</span>' : ''}
        </div>
        <div class="staff-history-dates">${startDate} 〜 ${endDate}</div>
        ${item.notes ? `<div class="staff-history-notes">${escapeHtml(item.notes)}</div>` : ''}
      </div>
    `;
  }).join('');
}

// メモの表示
function renderNotes() {
  const notesContentEl = document.getElementById('notes-content');
  if (!notesContentEl) return;

  if (!chartData.notes || chartData.notes.trim() === '') {
    notesContentEl.innerHTML = '<div class="empty-state">特記事項はありません</div>';
    return;
  }

  notesContentEl.textContent = chartData.notes;
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

