const API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';

// Auth checks
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
    if (cognitoIdToken && !isTokenExpired(cognitoIdToken)) return cognitoIdToken;
    const authData = localStorage.getItem('misesapo_auth');
    if (authData) {
      const parsed = JSON.parse(authData);
      if (parsed.token && !isTokenExpired(parsed.token)) return parsed.token;
    }
  } catch (error) {
    console.error('Error getting ID token:', error);
  }
  return null;
}

function ensureAuthOrRedirect() {
  const token = getStoredToken();
  if (!token) {
    const redirect = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/staff/signin.html?redirect=${redirect}`;
    return null;
  }
  return token;
}

async function getAuthHeaders() {
  const token = ensureAuthOrRedirect();
  if (!token) return null;
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

// State
let allSchedules = [];
let allStores = [];
let allWorkers = [];
let allClients = [];
let allBrands = [];
let allServices = [];
let selectedCleaningItems = [];
let selectedWorkers = [];
let filteredSchedules = [];
let currentPage = 1;
const perPage = 20;
let currentView = 'list'; // Default to list (Request Management)
let currentMonth = new Date();
let deleteTargetId = null;

// DOM Elements
let scheduleCardList, pagination, scheduleDialog, deleteDialog, scheduleForm, formStatus;

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
  if (!ensureAuthOrRedirect()) return;

  scheduleCardList = document.getElementById('schedule-card-list');
  pagination = document.getElementById('pagination');
  scheduleDialog = document.getElementById('schedule-dialog');
  deleteDialog = document.getElementById('delete-dialog');
  scheduleForm = document.getElementById('schedule-form');
  formStatus = document.getElementById('form-status');

  // Wait for DataUtils
  let retries = 0;
  while (typeof DataUtils === 'undefined' && retries < 50) {
    await new Promise(r => setTimeout(r, 100));
    retries++;
  }

  // Load Reference Data
  await Promise.all([
    loadStores(),
    loadWorkers(),
    loadClients(),
    loadBrands(),
    loadServices(),
  ]);

  enrichStoreData();

  // Load Schedules
  await loadSchedules();

  // Auto-open from URL param
  const p = new URLSearchParams(window.location.search);
  const oid = p.get('open_id');
  if (oid) {
    // Small delay to ensure render
    setTimeout(() => {
      if (typeof openEditDialog === 'function') openEditDialog(oid);
      window.history.replaceState({}, '', window.location.pathname);
    }, 500);
  }

  setupEventListeners();
  setupEventListeners();
  setupHierarchicalSelection(); // Replaced items
  setupCleaningItemsSearch();
  setupCleaningItemsSearch();
  setupWorkerSearch();

  // Initial Render (Calendar)
  renderCalendar();
  toggleView('calendar'); // Ensure UI matches state
});


// Data Loading
async function loadSchedules() {
  try {
    const response = await fetch(`${API_BASE}/schedules`);
    if (!response.ok) throw new Error('Failed to load schedules');
    const data = await response.json();
    allSchedules = Array.isArray(data) ? data : (data.items || data.schedules || data.data || []);
    updateNewProjectAlert();
    filterAndRender();
  } catch (error) {
    console.error('Failed to load schedules:', error);
    if (scheduleCardList) scheduleCardList.innerHTML = '<div class="empty-state">読み込みに失敗しました</div>';
  }
}

async function loadStores() {
  try {
    const res = await fetch(`${API_BASE}/stores`);
    const data = await res.json();
    allStores = Array.isArray(data) ? data : (data.items || data.stores || data.data || []);
    populateStoreSelects();
  } catch (e) { console.error(e); }
}

async function loadWorkers() {
  try {
    const res = await fetch(`${API_BASE}/workers`);
    const data = await res.json();
    allWorkers = Array.isArray(data) ? data : (data.items || data.workers || data.staff || data.data || []);
    populateWorkerSelects();
    populateSalesSelects();
  } catch (e) { console.error(e); }
}

async function loadClients() {
  try {
    const res = await fetch(`${API_BASE}/clients`);
    const data = await res.json();
    allClients = Array.isArray(data) ? data : (data.items || data.clients || data.data || []);
  } catch (e) { console.error(e); }
}
async function loadBrands() {
  try {
    const res = await fetch(`${API_BASE}/brands`);
    const data = await res.json();
    allBrands = Array.isArray(data) ? data : (data.items || data.brands || data.data || []);
  } catch (e) { console.error(e); }
}
async function loadServices() {
  try {
    const res = await fetch(`${API_BASE}/services`);
    const data = await res.json();
    allServices = Array.isArray(data) ? data : (data.items || data.services || data.data || []);
  } catch (e) { console.error(e); }
}

function enrichStoreData() {
  if (!allStores) return;
  allStores.forEach(s => {
    if (s.brand_id) {
      const b = allBrands.find(x => String(x.id) === String(s.brand_id));
      if (b) {
        s.brand_name = b.name;
        if (!s.client_id && b.client_id) s.client_id = b.client_id;
      }
    }
    if (s.client_id) {
      const c = allClients.find(x => String(x.id) === String(s.client_id));
      if (c) s.client_name = c.name;
    }
  });
}

// --- Karte (Survey) Data Loading & Handling ---

async function loadKarteData(storeId) {
  if (!storeId) return;

  // Reset fields first
  resetSurveyFields();

  try {
    // Attempt to fetch karte data for this store
    const headers = await getAuthHeaders();
    // Assuming GET /kartes?store_id=... works properly.
    // If exact endpoint differs, we must adjust. Based on sales-clients.js, we *saved* to /kartes, so fetching from there makes sense.
    // However, sales-clients.js loaded detail from allStores/schedules. 
    // It seems "viewClientDetail" loaded data from memory mostly or fetched details?
    // sales-clients.js:385 viewClientDetail uses preloaded allStores.

    // BUT! The SURVEY data (environment, area, etc.) was saved to /kartes.
    // So we need to fetch it.

    const res = await fetch(`${API_BASE}/kartes?store_id=${storeId}`, { headers });

    let karteData = null;
    if (res.ok) {
      const data = await res.json();
      const items = Array.isArray(data) ? data : (data.items || [data]);
      karteData = items.find(k => String(k.store_id) === String(storeId));
      if (!karteData && items.length > 0) karteData = items[0];
    }

    if (karteData) {
      populateSurveyFields(karteData);
    } else {
      console.log('No existing karte data found for store:', storeId);
    }
  } catch (error) {
    console.warn('Failed to load karte data:', error);
  }
}

function resetSurveyFields() {
  const fields = [
    'survey-issue', 'survey-environment', 'survey-cleaning-frequency',
    'survey-area-sqm', 'survey-entrances', 'survey-ceiling-height', 'survey-key-location', 'survey-breaker-location',
    'survey-wall-material', 'survey-floor-material', 'survey-toilet-count',
    'survey-hotspots', 'survey-notes'
  ];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  // Checkboxes
  document.querySelectorAll('#survey-equipment input[type="checkbox"]').forEach(cb => cb.checked = false);
}

function populateSurveyFields(data) {
  const map = {
    'survey-issue': data.issue,
    'survey-environment': data.environment,
    'survey-cleaning-frequency': data.cleaningFrequency || data.cleaning_frequency,
    'survey-area-sqm': data.areaSqm || data.area_sqm,
    'survey-entrances': data.entrances,
    'survey-ceiling-height': data.ceilingHeight || data.ceiling_height,
    'survey-key-location': data.keyLocation || data.key_location,
    'survey-breaker-location': data.breakerLocation || data.breaker_location,
    'survey-wall-material': data.wallMaterial || data.wall_material,
    'survey-floor-material': data.floorMaterial || data.floor_material,
    'survey-toilet-count': data.toiletCount || data.toilet_count,
    'survey-hotspots': data.hotspots,
    'survey-notes': data.notes
  };

  for (const [id, val] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (el && val) el.value = val;
  }

  // Equipment checkboxes
  const equipment = data.equipment || [];
  if (Array.isArray(equipment)) {
    equipment.forEach(val => {
      const cb = document.querySelector(`#survey-equipment input[value="${val}"]`);
      if (cb) cb.checked = true;
    });
  }
}

function getSurveyValue(id) {
  const el = document.getElementById(id);
  if (!el) return '';
  if (el.type === 'checkbox') return el.checked;
  return el.value || '';
}

function buildSurveyPayload(storeId) {
  // Build payload for Master Karte update
  const equipment = Array.from(document.querySelectorAll('#survey-equipment input[type="checkbox"]:checked'))
    .map(input => input.value);

  return {
    store_id: storeId,
    issue: getSurveyValue('survey-issue'),
    environment: getSurveyValue('survey-environment'),
    cleaning_frequency: getSurveyValue('survey-cleaning-frequency'),
    area_sqm: getSurveyValue('survey-area-sqm'),
    entrances: getSurveyValue('survey-entrances'),
    ceiling_height: getSurveyValue('survey-ceiling-height'),
    key_location: getSurveyValue('survey-key-location'),
    breaker_location: getSurveyValue('survey-breaker-location'),
    wall_material: getSurveyValue('survey-wall-material'),
    floor_material: getSurveyValue('survey-floor-material'),
    toilet_count: getSurveyValue('survey-toilet-count'),
    hotspots: getSurveyValue('survey-hotspots'),
    notes: getSurveyValue('survey-notes'),
    equipment: equipment,
    updated_at: new Date().toISOString()
  };
}

// --- UI Helpers & Search ---

function populateStoreSelects() {
  // Populate filter only
  const options = allStores.map(s => `<option value="${s.id}">${escapeHtml(s.name || '')}</option>`).join('');
  const filterEl = document.getElementById('store-filter');
  if (filterEl) filterEl.innerHTML = '<option value="">全店舗</option>' + options;
}

function populateSalesSelects() {
  const isSales = w => {
    const role = (w.role || '').toLowerCase();
    const dept = (w.department || '').toLowerCase();
    return role.includes('sales') || dept.includes('営業');
  }
  let sales = allWorkers.filter(isSales);
  if (sales.length === 0) sales = allWorkers;
  const options = sales.map(w => `<option value="${w.id}">${escapeHtml(w.name)}</option>`).join('');
  const el = document.getElementById('schedule-sales');
  if (el) el.innerHTML = '<option value="">未設定</option>' + options;
}

function isOSStaff(w) {
  const role = (w.role || '').toLowerCase();
  const dept = (w.department || '').toLowerCase();
  // OS課、現場、Operationsなどの名称をカバー
  const isOS = dept.includes('os') || dept.includes('operation') || dept.includes('現場') || dept.includes('清掃');
  return role === 'staff' && isOS;
}

function populateWorkerSelects() {
  // Filter for 'staff' role AND 'OS' department
  let cleaners = allWorkers.filter(isOSStaff);

  // Fallback if no OS staff found
  if (cleaners.length === 0 && allWorkers.some(w => (w.role || '').toLowerCase() === 'staff')) {
    console.warn('No "OS" staff found. Using all staff as fallback.');
    cleaners = allWorkers.filter(w => (w.role || '').toLowerCase() === 'staff');
  }

  // Filter Dropdown (Main Page Filter)
  const filterEl = document.getElementById('worker-filter');
  if (filterEl) {
    const options = cleaners.map(w => `<option value="${w.id}">${escapeHtml(w.name)}</option>`).join('');
    filterEl.innerHTML = '<option value="">全員</option>' + options;
  }

  // Modal List (Render into #worker-selection-list)
  renderWorkerSelectionList(cleaners);
}

function renderWorkerSelectionList(workers) {
  const list = document.getElementById('worker-selection-list');
  if (!list) return;

  if (workers.length === 0) {
    list.innerHTML = '<div style="color:#999;">該当する清掃員がいません</div>';
    return;
  }

  list.innerHTML = workers.map(w => `
        <label class="checkbox-row" style="display:flex; align-items:center; padding:10px; border-bottom:1px solid #f3f4f6; cursor:pointer;" data-name="${escapeHtml(w.name).toLowerCase()}">
            <input type="checkbox" name="worker_id" value="${w.id}" data-name="${escapeHtml(w.name)}" style="margin-right:12px; transform:scale(1.2);">
            <div>
                <div style="font-weight:600; color:#374151;">${escapeHtml(w.name)}</div>
                <div style="font-size:0.8rem; color:#9ca3af;">${escapeHtml(w.department || '')}</div>
            </div>
        </label>
    `).join('');

  // Search Filter Logic
  const searchInput = document.getElementById('worker-search-input');
  if (searchInput) {
    searchInput.oninput = () => {
      const key = searchInput.value.trim().toLowerCase();
      const rows = list.querySelectorAll('.checkbox-row');
      rows.forEach(row => {
        const name = row.dataset.name || '';
        row.style.display = name.includes(key) ? 'flex' : 'none';
      });
    };
  }
}

function updateSelectedWorkersDisplay() {
  const checked = Array.from(document.querySelectorAll('#worker-selection-list input[type="checkbox"]:checked'));
  const display = document.getElementById('selected-workers-display');
  if (!display) return;

  if (checked.length === 0) {
    display.innerHTML = '<span style="color:#9ca3af;">オープン（未割当）</span>';
  } else {
    const names = checked.map(cb => cb.dataset.name).join(', ');
    display.innerHTML = `<span style="color:#111827; font-weight:500;">${names}</span>`;
  }
}

// Ensure confirmation works
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('confirm-worker-selection')?.addEventListener('click', () => {
    updateSelectedWorkersDisplay();
    document.getElementById('worker-selection-dialog').close();
  });
});

// --- Hierarchical Selection Setup (Modal) ---
function setupHierarchicalSelection() {
  const clientSelect = document.getElementById('modal-select-client');
  const brandSelect = document.getElementById('modal-select-brand');
  const storeSelect = document.getElementById('modal-select-store');
  const hiddenStoreInput = document.getElementById('schedule-store');

  if (!clientSelect) return;

  const displayAddress = document.getElementById('modal-display-address');
  const displayPhone = document.getElementById('modal-display-phone');
  const storeInfoDisplay = document.getElementById('modal-store-info-display');

  // Helper to populate Clients
  const populateClients = () => {
    clientSelect.innerHTML = '<option value="">法人を選択してください</option>';
    allClients.forEach(c => {
      const option = document.createElement('option');
      option.value = c.id;
      option.textContent = c.name || c.company_name;
      clientSelect.appendChild(option);
    });
  };

  // Client Change -> Brands
  clientSelect.addEventListener('change', () => {
    const clientId = clientSelect.value;
    brandSelect.innerHTML = '<option value="">先に法人を選択</option>';
    brandSelect.disabled = true;
    storeSelect.innerHTML = '<option value="">先にブランドを選択</option>';
    storeSelect.disabled = true;
    hiddenStoreInput.value = '';
    if (storeInfoDisplay) storeInfoDisplay.style.display = 'none';

    if (!clientId) return;

    const brands = allBrands.filter(b => String(b.client_id) === String(clientId));
    if (brands.length === 0) {
      brandSelect.innerHTML = '<option value="">ブランドなし</option>';
      return;
    }

    brandSelect.innerHTML = '<option value="">ブランドを選択</option>';
    brands.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = b.name;
      brandSelect.appendChild(opt);
    });
    brandSelect.disabled = false;
  });

  // Brand Change -> Stores
  brandSelect.addEventListener('change', () => {
    const brandId = brandSelect.value;
    storeSelect.innerHTML = '<option value="">先にブランドを選択</option>';
    storeSelect.disabled = true;
    hiddenStoreInput.value = '';
    if (storeInfoDisplay) storeInfoDisplay.style.display = 'none';

    if (!brandId) return;

    const stores = allStores.filter(s => String(s.brand_id) === String(brandId));
    if (stores.length === 0) {
      storeSelect.innerHTML = '<option value="">店舗なし</option>';
      return;
    }

    storeSelect.innerHTML = '<option value="">店舗を選択</option>';
    stores.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      storeSelect.appendChild(opt);
    });
    storeSelect.disabled = false;
  });

  // Store Change -> Set Value & Show Info
  storeSelect.addEventListener('change', () => {
    const storeId = storeSelect.value;
    hiddenStoreInput.value = storeId;

    if (!storeId) {
      if (storeInfoDisplay) storeInfoDisplay.style.display = 'none';
      return;
    }

    // Update Info Display
    const store = allStores.find(s => String(s.id) === String(storeId));
    if (store && storeInfoDisplay) {
      storeInfoDisplay.style.display = 'block';
      if (displayAddress) displayAddress.textContent = store.address || '未登録';
      if (displayPhone) displayPhone.textContent = store.phone || store.tel || '未登録';
    }

    // Trigger Karte loading
    loadKarteData(storeId);
  });

  // Initial Population (Wait a bit for data load)
  setTimeout(populateClients, 500);
}

// (Old setupStoreSearch removed)

function setupCleaningItemsSearch() {
  const input = document.getElementById('cleaning-items-search');
  const results = document.getElementById('cleaning-items-results');
  const selectedContainer = document.getElementById('cleaning-items-selected');

  if (!input || !results) return;

  const renderSelected = () => {
    if (selectedCleaningItems.length === 0) {
      selectedContainer.innerHTML = '<span style="color:#9ca3af;font-size:0.8rem;">選択なし</span>';
      return;
    }
    selectedContainer.innerHTML = selectedCleaningItems.map((item, i) => `
            <span class="cleaning-tag" style="background:#f3f4f6;padding:4px 8px;border-radius:4px;margin-right:4px;">
                ${escapeHtml(item.name)} <span style="cursor:pointer;margin-left:4px;" onclick="removeCleaningItem(${i})">×</span>
            </span>
        `).join('');
  };

  window.removeCleaningItem = (i) => {
    selectedCleaningItems.splice(i, 1);
    renderSelected();
  };

  const showResults = (query = '') => {
    const q = query.toLowerCase();
    // Show all available services if query is empty
    const filtered = q ? allServices.filter(s => (s.title || s.name || '').toLowerCase().includes(q)) : allServices;

    if (filtered.length === 0) {
      results.innerHTML = '<div style="padding:12px;color:#9ca3af;text-align:center;">見つかりません</div>';
    } else {
      results.innerHTML = filtered.map(s => `
                <div class="search-item" style="padding:10px 12px;cursor:pointer;border-bottom:1px solid #f3f4f6;transition:background 0.2s;" 
                     onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='transparent'"
                     data-id="${s.id}" data-name="${escapeHtml(s.title || s.name)}">
                    ${escapeHtml(s.title || s.name)}
                </div>
            `).join('');

      results.querySelectorAll('.search-item').forEach(el => {
        el.addEventListener('click', () => {
          // Prevent duplicates
          const id = el.dataset.id;
          if (!selectedCleaningItems.some(x => String(x.id || x) === String(id))) {
            selectedCleaningItems.push({ id: id, name: el.dataset.name });
            renderSelected();
          }
          input.value = '';
          results.style.display = 'none';
        });
      });
    }
    results.style.display = 'block';
  };

  input.addEventListener('input', () => showResults(input.value.trim()));
  input.addEventListener('focus', () => showResults(input.value.trim()));

  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !results.contains(e.target)) results.style.display = 'none';
  });
}

function setupWorkerSearch() {
  const input = document.getElementById('worker-search-input');
  const results = document.getElementById('worker-search-results');
  const container = document.getElementById('selected-workers-container');

  if (!input || !results) return;

  window.renderSelectedWorkers = () => {
    if (selectedWorkers.length === 0) {
      container.innerHTML = '<span style="color:#9ca3af; font-size:0.85rem;">オープン（未割当）</span>';
      return;
    }
    container.innerHTML = selectedWorkers.map((w, i) => `
          <span class="cleaning-tag" style="background:#f3f4f6;padding:4px 8px;border-radius:4px;margin-right:4px;display:inline-flex;align-items:center;">
             <i class="fas fa-user-circle" style="color:#d1d5db;margin-right:4px;"></i>
             ${escapeHtml(w.name)}
             <span onclick="removeWorker(${i})" style="cursor:pointer;margin-left:6px;color:#999;font-weight:bold;">&times;</span>
          </span>
      `).join('');
  };

  window.removeWorker = (i) => {
    selectedWorkers.splice(i, 1);
    renderSelectedWorkers();
  };

  const showResults = (query = '') => {
    const q = query.toLowerCase();
    const osWorkers = allWorkers.filter(isOSStaff);
    const filtered = q ? osWorkers.filter(w => (w.name || '').toLowerCase().includes(q)) : osWorkers;

    if (filtered.length === 0) {
      results.innerHTML = '<div style="padding:12px;color:#9ca3af;text-align:center;">条件に一致するOSスタッフがいません</div>';
    } else {
      results.innerHTML = filtered.map(w => `
              <div class="search-item" style="padding:10px 12px;cursor:pointer;border-bottom:1px solid #f3f4f6;transition:background 0.2s;" 
                   onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='transparent'"
                   data-id="${w.id}" data-name="${escapeHtml(w.name)}">
                   <div style="font-weight:500; color:#374151;">${escapeHtml(w.name)}</div>
                   <div style="font-size:0.75rem; color:#9ca3af;">${escapeHtml(w.department || '')}</div>
              </div>
          `).join('');

      results.querySelectorAll('.search-item').forEach(el => {
        el.addEventListener('click', () => {
          const id = el.dataset.id;
          if (!selectedWorkers.some(x => String(x.id) === String(id))) {
            selectedWorkers.push({ id: id, name: el.dataset.name });
            renderSelectedWorkers();
          }
          input.value = '';
          results.style.display = 'none';
        });
      });
    }
    results.style.display = 'block';
  };

  input.addEventListener('input', () => showResults(input.value.trim()));
  input.addEventListener('focus', () => showResults(input.value.trim()));

  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !results.contains(e.target)) results.style.display = 'none';
  });
}

// --- Status & Filtering ---
function updateNewProjectAlert() {
  // Only count 'draft' where worker_id is empty (Unassigned)
  const count = allSchedules.filter(s => s.status === 'draft' && !s.worker_id).length;
  const alert = document.getElementById('draft-alert');
  if (alert) {
    document.getElementById('draft-count').textContent = count;
    if (count > 0) alert.classList.remove('hidden');
    else alert.classList.add('hidden');
  }
}

window.filterNewProjects = () => {
  const f = document.getElementById('status-filter');
  if (f) {
    f.value = 'draft';
    filterAndRender();
    toggleView('list');
  }
}

function filterAndRender() {
  const storeId = document.getElementById('store-filter')?.value;
  const workerId = document.getElementById('worker-filter')?.value;
  const status = document.getElementById('status-filter')?.value;
  const range = document.getElementById('date-range-filter')?.value || 'future';

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  filteredSchedules = allSchedules.filter(s => {
    const sStoreId = s.store_id || s.client_id;
    const sWorkerId = s.worker_id || s.assigned_to;

    if (storeId && sStoreId !== storeId) return false;
    if (workerId && sWorkerId !== workerId) return false;
    if (status && s.status !== status) return false;

    const date = new Date(s.date || s.scheduled_date || '');
    if (isNaN(date.getTime())) return range === 'past'; // Invalid date treated as past

    date.setHours(0, 0, 0, 0);
    if (range === 'future' && date < now) return false;
    if (range === 'past' && date >= now) return false;

    return true;
  });

  // Sort
  filteredSchedules.sort((a, b) => {
    const da = a.date || a.scheduled_date;
    const db = b.date || b.scheduled_date;
    return (da || '').localeCompare(db || '');
  });

  renderPagination();
  renderTable(); // Even if hidden
  renderCalendar(); // Even if hidden
}

// --- Views ---

function toggleView(view) {
  currentView = view;
  const listView = document.getElementById('list-view');
  const calView = document.getElementById('calendar-view');
  const toggleBtn = document.getElementById('view-toggle');

  if (view === 'list') {
    if (listView) listView.style.display = 'block';
    if (calView) calView.style.display = 'none';
    if (toggleBtn) toggleBtn.innerHTML = '<i class="fas fa-calendar"></i>';
  } else {
    if (listView) listView.style.display = 'none';
    if (calView) calView.style.display = 'block';
    if (toggleBtn) toggleBtn.innerHTML = '<i class="fas fa-list"></i>';
  }
}
document.getElementById('view-toggle')?.addEventListener('click', () => {
  toggleView(currentView === 'list' ? 'calendar' : 'list');
});

// --- Table Render ---
function renderTable() {
  if (!scheduleCardList) return;
  const start = (currentPage - 1) * perPage;
  const items = filteredSchedules.slice(start, start + perPage);

  if (items.length === 0) {
    scheduleCardList.innerHTML = '<div class="empty-state">該当なし</div>';
    return;
  }

  scheduleCardList.innerHTML = items.map(s => {
    const store = allStores.find(x => x.id === (s.store_id || s.client_id)) || {};
    const client = allClients.find(c => String(c.id) === String(s.client_id || store.client_id));
    const brand = allBrands.find(b => String(b.id) === String(s.brand_id || store.brand_id));

    let workerName = '未割当';
    if (s.worker_names) {
      workerName = s.worker_names;
    } else if (s.worker_id) {
      // Handle potential comma-separated IDs if logic changes, but assume single for now or first one
      const wIds = String(s.worker_id).split(',');
      const names = wIds.map(id => {
        const w = allWorkers.find(x => String(x.id) === String(id.trim()));
        return w ? w.name : '不明';
      });
      workerName = names.join(', ');
    } else if (s.assigned_to_user) {
      workerName = s.assigned_to_user.name;
    }

    const isDraft = s.status === 'draft';
    return `
            <div class="schedule-card ${isDraft ? 'draft-card' : ''}" onclick="openEditDialog('${s.id}')">
               <div class="schedule-card-header">
                  <span class="status-badge status-${s.status}">${getStatusLabel(s.status)}</span>
                  ${(s.work_type === 'periodic' || s.work_type === 'regular') ? '<span style="background:#e0f2fe; color:#0369a1; border-radius:4px; padding:2px 6px; font-size:0.7rem; margin-left:6px; font-weight:bold;"><i class="fas fa-sync-alt"></i> 定期</span>' : ''}
                  <span style="margin-left:auto;font-size:0.8rem;color:#666;">${s.date || s.scheduled_date}</span>
               </div>
               <div style="font-size:0.75rem; color:#888; margin-top:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:flex; align-items:baseline;">
                   <span>${client ? escapeHtml(client.name || client.company_name) : '-'}</span>
                   <span style="color:#d1d5db; margin:0 6px;">|</span>
                   <span style="font-size:1.1rem; font-weight:bold; color:#FF679C;">${brand ? escapeHtml(brand.name) : '-'}</span>
               </div>
               <div style="font-weight:bold;margin:2px 0 6px 0; font-size:1rem;">${escapeHtml(store.name || s.store_name || '店舗未設定')}</div>
               <div style="font-size:0.85rem;color:#444; border-top:1px dashed #eee; padding-top:4px; display:flex; align-items:center;">
                  <i class="fas fa-user-friends" style="color:#9ca3af; margin-right:5px; font-size:0.8rem;"></i>
                  ${escapeHtml(workerName)}
               </div>
            </div>
        `;
  }).join('');
}

function renderPagination() {
  if (!pagination) return;
  const total = Math.ceil(filteredSchedules.length / perPage);
  if (total <= 1) { pagination.innerHTML = ''; return; }
  // Simplified pagination for brevity
  pagination.innerHTML = `
        <button ${currentPage === 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})">前</button>
        <span style="margin:0 8px;">${currentPage} / ${total}</span>
        <button ${currentPage === total ? 'disabled' : ''} onclick="goToPage(${currentPage + 1})">次</button>
    `;
}
window.goToPage = p => { currentPage = p; renderTable(); };

// --- Calendar Render ---
// Helper to get schedules ignoring date range (for Calendar)
function getCalendarSchedules() {
  const storeId = document.getElementById('store-filter')?.value;
  const workerId = document.getElementById('worker-filter')?.value;
  const status = document.getElementById('status-filter')?.value;

  return allSchedules.filter(s => {
    const sStoreId = s.store_id || s.client_id;
    const sWorkerId = s.worker_id || s.assigned_to;
    if (storeId && sStoreId !== storeId) return false;
    if (workerId && sWorkerId !== workerId) return false;
    if (status && s.status !== status) return false;
    return true;
  });
}

function renderCalendar() {
  const calendarDays = document.getElementById('calendar-days');
  const monthLabel = document.getElementById('calendar-month');
  if (!calendarDays || !monthLabel) return;

  calendarDays.innerHTML = '';
  monthLabel.textContent = `${currentMonth.getFullYear()}年 ${currentMonth.getMonth() + 1}月`;

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDay = firstDay.getDay();

  // Get items for calendar (ignoring date range filter)
  const calSchedules = getCalendarSchedules();

  // Empty prefix cells
  for (let i = 0; i < startDay; i++) {
    const cel = document.createElement('div');
    cel.className = 'calendar-day empty';
    calendarDays.appendChild(cel);
  }

  // Days
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const cel = document.createElement('div');
    cel.className = 'calendar-day';

    const num = document.createElement('div');
    num.className = 'day-number';
    num.textContent = day;
    cel.appendChild(num);

    // Items (Summary Count Only)
    const daysItems = calSchedules.filter(s => (s.date || s.scheduled_date) === dateStr);

    if (daysItems.length > 0) {
      const summary = document.createElement('div');
      summary.className = 'day-summary-badge';
      summary.textContent = `${daysItems.length}件`;
      summary.style.marginTop = '4px';
      summary.style.fontSize = '0.8rem';
      summary.style.background = '#FF679C'; // Primary Brand Color
      summary.style.color = '#fff';
      summary.style.borderRadius = '12px';
      summary.style.padding = '2px 8px';
      summary.style.display = 'inline-block';

      cel.appendChild(summary);
    }

    // Show Daily Schedules on click
    cel.onclick = () => showDailySchedules(dateStr);

    calendarDays.appendChild(cel);
  }
}

function showDailySchedules(dateStr) {
  const dialog = document.getElementById('daily-schedule-dialog');
  const listEl = document.getElementById('daily-schedule-list');
  const dateTitle = document.getElementById('daily-dialog-date');
  if (!dialog || !listEl) return;

  dateTitle.textContent = dateStr;

  // Use same logic as calendar (ignore global list filter)
  const calSchedules = getCalendarSchedules();
  const items = calSchedules.filter(s => (s.date || s.scheduled_date) === dateStr);

  if (items.length === 0) {
    listEl.innerHTML = '<div class="empty-state">この日の依頼はありません</div>';
  } else {
    listEl.innerHTML = items.map(s => {
      const store = allStores.find(x => x.id === (s.store_id || s.client_id)) || {};
      const client = allClients.find(c => String(c.id) === String(s.client_id || store.client_id));
      const brand = allBrands.find(b => String(b.id) === String(s.brand_id || store.brand_id));
      const statusLabel = getStatusLabel(s.status);
      const isPeriodic = s.work_type === 'periodic' || s.work_type === 'regular';

      return `
        <div class="schedule-card" style="border:1px solid #e5e7eb; padding:12px; margin-bottom:10px; border-radius:12px; position:relative; transition:all 0.2s; background:#fff; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
           
           <!-- Main Click Area: Open Print View -->
           <div onclick="printScheduleRequest('${s.id}')" style="cursor:pointer; padding-right:40px;">
             <div style="display:flex; justify-content:space-between; margin-bottom:8px; align-items:center;">
                <div style="display:flex; align-items:center;">
                    <span class="status-badge status-${s.status}">${statusLabel}</span>
                    ${isPeriodic ? '<span style="background:#e0f2fe; color:#0369a1; border-radius:4px; padding:2px 6px; font-size:0.7rem; margin-left:6px; font-weight:bold;"><i class="fas fa-sync-alt"></i> 定期</span>' : ''}
                </div>
                <span style="font-size:0.8rem; color:#6b7280;">${s.time_slot || ''}</span>
             </div>

             <div style="font-size:0.75rem; color:#6b7280; margin-bottom:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; display:flex; align-items:baseline;">
                <span>${client ? escapeHtml(client.name || client.company_name) : '-'}</span>
                <span style="color:#d1d5db; margin:0 6px;">|</span>
                <span style="font-size:1.1rem; font-weight:bold; color:#FF679C;">${brand ? escapeHtml(brand.name) : '-'}</span>
             </div>

             <div style="font-weight:700; color:#111827; margin-bottom:6px; font-size:1rem; line-height:1.4;">${escapeHtml(store.name || s.store_name || '店舗未設定')}</div>
             <div style="font-size:0.85rem; color:#6B7280; display:flex; align-items:center; gap:6px; margin-bottom:10px;">
                <i class="fas fa-user-circle" style="color:#9ca3af;"></i>
                <span>${s.worker_id ? (allWorkers.find(w => w.id === s.worker_id)?.name || '未定') : '未割当'}</span>
             </div>
             <div style="font-size:0.85rem; color:#FF679C; font-weight:600; display:flex; align-items:center; gap:6px;">
               <i class="fas fa-file-alt"></i> 依頼内容を確認
             </div>
           </div>

           <!-- Edit Button (Distinct) -->
           <button onclick="openEditDialog('${s.id}'); document.getElementById('daily-schedule-dialog').close();" 
                   style="position:absolute; top:12px; right:12px; width:36px; height:36px; border:none; background:#f3f4f6; color:#6b7280; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.2s;"
                   onmouseover="this.style.background='#e5e7eb';this.style.color='#374151'" 
                   onmouseout="this.style.background='#f3f4f6';this.style.color='#6b7280'"
                   title="詳細編集">
             <i class="fas fa-pen" style="font-size:0.9rem;"></i>
           </button>

        </div>
      `;
    }).join('');
  }

  dialog.showModal();
}

document.getElementById('prev-month')?.addEventListener('click', () => {
  currentMonth.setMonth(currentMonth.getMonth() - 1);
  renderCalendar();
});
document.getElementById('next-month')?.addEventListener('click', () => {
  currentMonth.setMonth(currentMonth.getMonth() + 1);
  renderCalendar();
});


// --- Dialogs (Request Creation) ---

function setScheduleFormReadOnly(isReadOnly) {
  // Use Dialog context if possible, or fallback to form. Target schedule-dialog specifically.
  const dialog = document.getElementById('schedule-dialog');
  const container = dialog || document.getElementById('schedule-form');

  if (!container) return;

  const elements = container.querySelectorAll('input, select, textarea');
  elements.forEach(el => {
    // Exclude hidden inputs
    if (el.type !== 'hidden') {
      el.disabled = isReadOnly;
      // Visual feedback for search inputs if needed
      if (isReadOnly && (el.id === 'worker-search-input' || el.id === 'cleaning-items-search')) {
        el.placeholder = '';
      } else if (!isReadOnly) {
        if (el.id === 'worker-search-input') el.placeholder = '担当者を検索...';
        if (el.id === 'cleaning-items-search') el.placeholder = '清掃内容を検索...';
      }
    }
  });

  const reloadBtn = document.getElementById('reload-customers-data-btn');
  if (reloadBtn) reloadBtn.disabled = isReadOnly;

  // Toggle "Remove (x)" buttons on tags
  // Workers and Cleaning Items use spans with onclick inside .cleaning-tag or similar
  // We hide the 'x' button in ReadOnly mode
  const removeButtons = container.querySelectorAll('[onclick*="removeWorker"], [onclick*="removeCleaningItem"]');
  removeButtons.forEach(btn => {
    btn.style.display = isReadOnly ? 'none' : 'inline-block';
  });
}

function openAddDialog(dateStr) {
  if (scheduleForm) scheduleForm.reset();

  // Mode: Create (Editable)
  setScheduleFormReadOnly(false);
  document.getElementById('dialog-title').textContent = '依頼書作成';
  document.getElementById('schedule-id').value = '';

  document.getElementById('edit-btn').style.display = 'none';
  document.getElementById('save-btn').style.display = 'inline-block';

  // Set Date
  if (dateStr) document.getElementById('schedule-date').value = dateStr;

  // Clear Store Selection (Hierarchical)
  const hiddenStore = document.getElementById('schedule-store');
  if (hiddenStore) hiddenStore.value = '';

  // Reset Dropdowns
  const clientSelect = document.getElementById('modal-select-client');
  const brandSelect = document.getElementById('modal-select-brand');
  const storeSelect = document.getElementById('modal-select-store');

  if (clientSelect) clientSelect.value = '';
  if (brandSelect) {
    brandSelect.innerHTML = '<option value="">先に法人を選択</option>';
    brandSelect.disabled = true;
    brandSelect.value = '';
  }
  if (storeSelect) {
    storeSelect.innerHTML = '<option value="">先にブランドを選択</option>';
    storeSelect.disabled = true;
    storeSelect.value = '';
  }

  // Clear Info Display
  const infoDisplay = document.getElementById('modal-store-info-display');
  if (infoDisplay) infoDisplay.style.display = 'none';
  if (document.getElementById('modal-display-address')) document.getElementById('modal-display-address').textContent = '-';
  if (document.getElementById('modal-display-phone')) document.getElementById('modal-display-phone').textContent = '-';

  // Remove old search logic references
  // The following elements were removed in the refactor:
  // schedule-store-search, selected-store-details, schedule-client-name, etc.
  // We can safely remove lines trying to clear them.

  // Reset Karte Fields
  resetSurveyFields();

  // Reset Assessment
  ['area1', 'area2', 'area3', 'area4'].forEach(area => {
    document.querySelectorAll(`input[name="assess_${area}"]`).forEach(cb => cb.checked = false);
    const note = document.getElementById(`assess-note-${area}`);
    if (note) note.value = '';
  });

  // Reset Worker Selection
  document.querySelectorAll('#worker-selection-list input[type="checkbox"]').forEach(cb => cb.checked = false);
  updateSelectedWorkersDisplay();

  // Reset selection lists
  selectedCleaningItems = [];
  document.querySelectorAll('input[name="work_items_check[]"]').forEach(cb => cb.checked = false);
  document.getElementById('cleaning-items-selected').innerHTML = '';

  // Hide Print Button (New Request)
  const printBtn = document.getElementById('print-request-btn');
  if (printBtn) printBtn.style.display = 'none';

  if (scheduleDialog) scheduleDialog.showModal();
}
window.openAddDialog = openAddDialog;

function openEditDialog(id) {
  const s = allSchedules.find(x => x.id === id);
  if (!s) return;

  // Populate Fields via openAddDialog to reset first
  openAddDialog(s.date || s.scheduled_date);
  // Restore ID
  document.getElementById('schedule-id').value = s.id;

  // Override to ReadOnly (View Mode)
  setScheduleFormReadOnly(true);
  document.getElementById('dialog-title').textContent = '依頼書詳細';

  // Setup Actions
  const editBtn = document.getElementById('edit-btn');
  const saveBtn = document.getElementById('save-btn');

  editBtn.style.display = 'inline-block';
  saveBtn.style.display = 'none';

  editBtn.onclick = () => {
    // Enable Edit Mode
    setScheduleFormReadOnly(false);
    editBtn.style.display = 'none';
    saveBtn.style.display = 'inline-block';
    document.getElementById('dialog-title').textContent = '依頼書編集';
  };

  // Populate Sales & Time
  if (s.sales_id) document.getElementById('schedule-sales').value = s.sales_id;
  document.getElementById('schedule-time').value = s.time_slot || s.scheduled_time || '';

  // Workers (New Logic using selectedWorkers state)
  selectedWorkers = [];
  const wIds = (s.worker_id || s.assigned_to) ? String(s.worker_id || s.assigned_to).split(',') : [];
  wIds.forEach(wid => {
    const w = allWorkers.find(x => String(x.id) === String(wid));
    if (w) selectedWorkers.push({ id: w.id, name: w.name });
  });
  if (window.renderSelectedWorkers) window.renderSelectedWorkers();

  // Store & Hierarchy Population
  const storeId = s.store_id || s.client_id;
  if (storeId) {
    document.getElementById('schedule-store').value = storeId;

    // Reverse populate logic
    // We need to set Client -> Brand -> Store dropdowns
    const store = allStores.find(x => x.id === storeId);
    if (store) {
      const clientSelect = document.getElementById('modal-select-client');
      const brandSelect = document.getElementById('modal-select-brand');
      const storeSelect = document.getElementById('modal-select-store');

      let clientId = store.client_id;
      let brandId = store.brand_id;

      // Try to find IDs if missing on store object directly (enrichment might help)
      if (brandId && !clientId) {
        const tempBrand = allBrands.find(b => b.id === brandId);
        if (tempBrand) clientId = tempBrand.client_id;
      }

      if (clientId && clientSelect) {
        clientSelect.value = clientId;
        // Trigger change manually or simulate
        clientSelect.dispatchEvent(new Event('change'));

        // Allow time for brand populate (sync would be better but simple logic here)
        // Ideally we re-use the populate logic but synchronous 
        // Manual population for stability:

        // Populate Brands
        brandSelect.innerHTML = '<option value="">ブランドを選択</option>';
        allBrands.filter(b => String(b.client_id) === String(clientId)).forEach(b => {
          const opt = document.createElement('option');
          opt.value = b.id;
          opt.textContent = b.name;
          brandSelect.appendChild(opt);
        });
        brandSelect.disabled = false;

        if (brandId) {
          brandSelect.value = brandId;
          // Populate Stores
          storeSelect.innerHTML = '<option value="">店舗を選択</option>';
          allStores.filter(st => String(st.brand_id) === String(brandId)).forEach(st => {
            const opt = document.createElement('option');
            opt.value = st.id;
            opt.textContent = st.name;
            storeSelect.appendChild(opt);
          });
          storeSelect.disabled = false;
          storeSelect.value = storeId;
        }
      }

      // Show Info
      const infoDisplay = document.getElementById('modal-store-info-display');
      if (infoDisplay) {
        infoDisplay.style.display = 'block';
        document.getElementById('modal-display-address').textContent = store.address || '-';
        document.getElementById('modal-display-phone').textContent = store.phone || '-';
      }
    }
  }

  // Items
  // Items (Split between Checklist and Tags)
  selectedCleaningItems = [];
  // Reset all checkboxes first
  document.querySelectorAll('input[name="work_items_check[]"]').forEach(cb => cb.checked = false);

  if (s.cleaning_items && Array.isArray(s.cleaning_items)) {
    s.cleaning_items.forEach(item => {
      const name = item.name || item.title;
      // Try to find matching checkbox
      const checkbox = document.querySelector(`input[name="work_items_check[]"][value="${name}"]`);
      if (checkbox) {
        checkbox.checked = true;
      } else {
        // If not in checklist, add to tags
        selectedCleaningItems.push(item);
      }
    });

    // Render Tags
    const container = document.getElementById('cleaning-items-selected');
    if (container) {
      container.innerHTML = selectedCleaningItems.map((item, i) => `
                <span class="cleaning-tag" style="background:#f3f4f6;padding:4px 8px;border-radius:4px;margin-right:4px;">
                    ${escapeHtml(item.name || item.title)} <span style="cursor:pointer;margin-left:4px;" onclick="removeCleaningItem(${i})">×</span>
                </span>
            `).join('');
    }
  }

  // Notes
  if (s.notes) document.getElementById('schedule-notes').value = s.notes;

  // HACCP Data
  if (s.haccp_instructions && Array.isArray(s.haccp_instructions)) {
    document.querySelectorAll('input[name="haccp_instruction[]"]').forEach(cb => {
      cb.checked = s.haccp_instructions.includes(cb.value);
    });
  }
  if (s.haccp_notes) document.getElementById('modal-haccp-notes').value = s.haccp_notes;

  // Restore Extended Request Details
  if (document.getElementById('schedule-work-type')) document.getElementById('schedule-work-type').value = s.work_type || 'periodic';
  if (document.getElementById('schedule-parking')) document.getElementById('schedule-parking').value = s.parking_info || '';
  if (document.getElementById('schedule-key-info')) document.getElementById('schedule-key-info').value = s.key_info || '';
  if (document.getElementById('schedule-attendance-notes')) document.getElementById('schedule-attendance-notes').value = s.attendance_notes || '';

  if (s.attendance_required) {
    const attRadio = document.querySelector(`input[name="attendance_required"][value="${s.attendance_required}"]`);
    if (attRadio) attRadio.checked = true;
  } else {
    // Default to 'none' if undefined
    const attNone = document.querySelector(`input[name="attendance_required"][value="none"]`);
    if (attNone) attNone.checked = true;
  }

  // Survey Data (Full Population)
  const sd = s.survey_data || {};

  // Restore Assessment
  if (sd.assessment) {
    ['area1', 'area2', 'area3', 'area4'].forEach(area => {
      if (sd.assessment[area]) {
        const r = document.querySelector(`input[name="assess_${area}"][value="${sd.assessment[area].status}"]`);
        if (r) r.checked = true;
        const noteInput = document.getElementById(`assess-note-${area}`);
        if (noteInput) noteInput.value = sd.assessment[area].note || '';
      }
    });
  }

  document.getElementById('survey-issue').value = sd.issue || '';
  document.getElementById('survey-environment').value = sd.environment || '';
  document.getElementById('survey-cleaning-frequency').value = sd.cleaning_frequency || '';
  document.getElementById('survey-area-sqm').value = sd.area_sqm || '';
  document.getElementById('survey-entrances').value = sd.entrances || '';
  document.getElementById('survey-ceiling-height').value = sd.ceiling_height || '';
  document.getElementById('survey-key-location').value = sd.key_location || '';
  document.getElementById('survey-breaker-location').value = sd.breaker_location || '';
  document.getElementById('survey-wall-material').value = sd.wall_material || '';
  document.getElementById('survey-floor-material').value = sd.floor_material || '';
  document.getElementById('survey-toilet-count').value = sd.toilet_count || '';
  document.getElementById('survey-hotspots').value = sd.hotspots || '';
  if (document.getElementById('survey-notes')) document.getElementById('survey-notes').value = sd.notes || '';

  // Equipment Checkboxes (Populate)
  const eq = Array.isArray(sd.equipment) ? sd.equipment : [];
  document.querySelectorAll('#survey-equipment input[type="checkbox"]').forEach(cb => {
    cb.checked = eq.includes(cb.value);
  });

  // Update Print Button visibility/action
  const printBtn = document.getElementById('print-request-btn');
  if (printBtn) {
    printBtn.style.setProperty('display', 'inline-flex', 'important');
    printBtn.onclick = () => printScheduleRequest(id);
    console.log('Print button activated for:', id);
  }
}
window.openEditDialog = openEditDialog;

// --- Print / Preview ---
window.getScheduleData = function (id) {
  return allSchedules.find(s => s.id === id);
};

window.printScheduleRequest = function (id) {
  const s = allSchedules.find(x => x.id === id);
  if (!s) { alert('データが見つかりません'); return; }

  const store = allStores.find(st => st.id === (s.store_id || s.client_id));

  // Get worker name(s)
  let workerName = '未定';
  if (s.worker_id) {
    const wIds = String(s.worker_id).split(',');
    const names = wIds.map(wid => {
      const w = allWorkers.find(x => String(x.id) === String(wid));
      return w ? w.name : null;
    }).filter(Boolean);
    if (names.length > 0) workerName = names.join(', ');
  }

  // Build enriched data object for preview
  const enrichment = {
    ...s,
    store_name: store?.name || s.store_name || '店舗名未設定',
    store_address: store?.address || '',
    store_phone: store?.phone || '',
    worker_name: workerName,
    // Ensure survey_data is explicitly included
    survey_data: s.survey_data || {},
    cleaning_items: s.cleaning_items || [],
    haccp_instructions: s.haccp_instructions || [], // Include HACCP
    haccp_notes: s.haccp_notes || ''
  };

  console.log('Preview Data:', enrichment); // Debug log
  localStorage.setItem('preview_schedule_data', JSON.stringify(enrichment));

  // Try opening in modal
  const dialog = document.getElementById('print-preview-dialog');
  const iframe = document.getElementById('print-preview-frame');

  if (dialog && iframe) {
    iframe.src = `/sales/schedules/print.html?id=${id}`;
    dialog.showModal();
  } else {
    // Fallback
    window.open(`/sales/schedules/print.html?id=${id}`, '_blank', 'width=900,height=1000,resizable=yes,scrollbars=yes');
  }
};

// --- Handle Submit ---

function generatePeriodicDates(startStr, endStr, freq, weekdays) {
  const dates = [];
  const start = new Date(startStr);
  let end = endStr ? new Date(endStr) : new Date(start);
  if (!endStr) end.setFullYear(end.getFullYear() + 1);

  // Hard caps
  const MAX_ITEMS = 55; // Approx 1 year weekly

  let current = new Date(start);

  if (freq === 'monthly') {
    while (current <= end && dates.length < 24) {
      dates.push(new Date(current).toISOString().split('T')[0]);
      current.setMonth(current.getMonth() + 1);
    }
  } else if (freq === 'biweekly') {
    while (current <= end && dates.length < 30) {
      dates.push(new Date(current).toISOString().split('T')[0]);
      current.setDate(current.getDate() + 14);
    }
  } else {
    // Weekly: Iterate days to find match
    // Optimization: Iterate weeks? No, iterate days is safe enough for 1 year (365 iterations)
    while (current <= end && dates.length < MAX_ITEMS) {
      if (weekdays.includes(current.getDay())) {
        dates.push(new Date(current).toISOString().split('T')[0]);
      }
      current.setDate(current.getDate() + 1);
    }
  }
  return dates;
}

function setupEventListeners() {
  // Periodic Toggle
  const workTypeSelect = document.getElementById('schedule-work-type');
  const freqSelect = document.getElementById('periodic-frequency');

  if (workTypeSelect) {
    workTypeSelect.addEventListener('change', (e) => {
      const ps = document.getElementById('periodic-settings');
      if (ps) ps.style.display = e.target.value === 'periodic' ? 'block' : 'none';
    });
  }

  if (freqSelect) {
    freqSelect.addEventListener('change', (e) => {
      const wdGroup = document.getElementById('periodic-weekday-group');
      // Only show weekdays for weekly
      if (wdGroup) {
        if (e.target.value === 'weekly') {
          wdGroup.style.opacity = '1';
          wdGroup.style.pointerEvents = 'auto';
        } else {
          wdGroup.style.opacity = '0.5';
          wdGroup.style.pointerEvents = 'none';
        }
      }
    });
  }

  if (scheduleForm) {
    scheduleForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const formStatus = document.getElementById('form-status');
      formStatus.textContent = '保存中...';

      const storeId = document.getElementById('schedule-store').value;
      if (!storeId) {
        alert('店舗を選択してください');
        formStatus.textContent = '';
        return;
      }

      const basePayload = {
        store_id: storeId,
        date: document.getElementById('schedule-date').value,
        time_slot: document.getElementById('schedule-time').value,
        sales_id: document.getElementById('schedule-sales').value,
        work_type: document.getElementById('schedule-work-type')?.value || 'periodic',
        parking_info: document.getElementById('schedule-parking')?.value || '',
        key_info: document.getElementById('schedule-key-info')?.value || '',
        attendance_required: document.querySelector('input[name="attendance_required"]:checked')?.value || 'none',
        attendance_notes: document.getElementById('schedule-attendance-notes')?.value || '',
        worker_id: selectedWorkers.length > 0 ? selectedWorkers.map(w => w.id).join(',') : null,
        cleaning_items: [
          ...selectedCleaningItems,
          ...Array.from(document.querySelectorAll('input[name="work_items_check[]"]:checked')).map(cb => ({
            id: null,
            name: cb.value,
            type: 'checklist'
          }))
        ],
        notes: document.getElementById('schedule-notes').value,
        haccp_instructions: Array.from(document.querySelectorAll('input[name="haccp_instruction[]"]:checked')).map(cb => cb.value),
        haccp_notes: document.getElementById('modal-haccp-notes').value,
        status: 'scheduled',
        survey_data: {
          assessment: {
            area1: { status: document.querySelector('input[name="assess_area1"]:checked')?.value || '', note: document.getElementById('assess-note-area1')?.value || '' },
            area2: { status: document.querySelector('input[name="assess_area2"]:checked')?.value || '', note: document.getElementById('assess-note-area2')?.value || '' },
            area3: { status: document.querySelector('input[name="assess_area3"]:checked')?.value || '', note: document.getElementById('assess-note-area3')?.value || '' },
            area4: { status: document.querySelector('input[name="assess_area4"]:checked')?.value || '', note: document.getElementById('assess-note-area4')?.value || '' }
          },
          environment: document.getElementById('survey-environment')?.value || '',
          issue: document.getElementById('survey-issue')?.value || '',
          area_sqm: document.getElementById('survey-area-sqm')?.value || '',
          entrances: document.getElementById('survey-entrances')?.value || '',
          ceiling_height: document.getElementById('survey-ceiling-height')?.value || '',
          key_location: document.getElementById('survey-key-location')?.value || '',
          breaker_location: document.getElementById('survey-breaker-location')?.value || '',
          wall_material: document.getElementById('survey-wall-material')?.value || '',
          floor_material: document.getElementById('survey-floor-material')?.value || '',
          toilet_count: document.getElementById('survey-toilet-count')?.value || '',
          hotspots: document.getElementById('survey-hotspots')?.value || '',
          notes: document.getElementById('survey-notes')?.value || '',
          equipment: Array.from(document.querySelectorAll('#survey-equipment input:checked')).map(cb => cb.value)
        }
      };

      const scheduleId = document.getElementById('schedule-id').value;

      // Periodic Generation Logic logic
      const isPeriodicMode = basePayload.work_type === 'periodic' && !scheduleId;

      if (isPeriodicMode) {
        const freq = document.getElementById('periodic-frequency').value;
        const wdays = Array.from(document.querySelectorAll('input[name="periodic_wday"]:checked')).map(cb => Number(cb.value));
        const endDateVal = document.getElementById('periodic-end-date').value;

        // Safety: If weekly and no wdays, use start date's day
        if (freq === 'weekly' && wdays.length === 0) {
          wdays.push(new Date(basePayload.date).getDay());
        }

        const targetDates = generatePeriodicDates(basePayload.date, endDateVal, freq, wdays);

        if (targetDates.length === 0) {
          alert('生成可能な日付がありません。日付や曜日設定を確認してください。');
          formStatus.textContent = '';
          return;
        }

        if (!confirm(`【定期反映】\n${targetDates.length}件の依頼書を一括作成します。\n期間: ${basePayload.date} ～ ${targetDates[targetDates.length - 1]}\nよろしいですか？`)) {
          formStatus.textContent = '';
          return;
        }

        let successCount = 0;
        let failCount = 0;

        // Batch process
        for (const d of targetDates) {
          const p = { ...basePayload, date: d, status: 'scheduled' }; // force scheduled?
          // Use draft if preferred, but usually confirmed. Let's stick to status logic (new => draft)
          // But basePayload sets 'scheduled' above line 1367 in original code? 
          // Wait, I see "status: 'scheduled'" in my replacement block above. 
          // In original code it was "status: 'scheduled'" in the object definition, then later overridden to 'draft' if new.
          // I should respect the logic: New = draft? 
          // User said "定期清掃の場合スケジュールに定期的にスケジュールが反映". Reflected in schedule usually means active.
          // Let's set to 'scheduled' (Confirm) or 'draft' (Unconfirmed).
          // I'll keep 'scheduled' as in my replacement block, but maybe override to draft if that was the convention.
          // Original code: line 1405: payload.status = 'draft';
          // Okay, I will set them to 'draft' so sales can confirm them.
          p.status = 'draft';

          try {
            const res = await fetch(`${API_BASE}/schedules`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(p)
            });
            if (res.ok) successCount++;
            else failCount++;
          } catch (e) { failCount++; }

          formStatus.textContent = `作成中... ${successCount}/${targetDates.length}`;
        }

        if (failCount === 0) {
          formStatus.textContent = '完了しました';
          formStatus.className = 'form-status success';
          setTimeout(() => {
            scheduleDialog.close();
            loadSchedules();
          }, 1000);
        } else {
          alert(`${successCount}件 作成完了, ${failCount}件 失敗`);
          loadSchedules();
        }
        return; // End periodic flow
      }

      // -- Standard Single Save Flow --
      let method = 'POST';
      let url = `${API_BASE}/schedules`;

      // Copy payload to avoid reference issues
      const finalPayload = { ...basePayload };

      if (scheduleId) {
        method = 'PUT';
        url = `${API_BASE}/schedules/${scheduleId}`;
        const existing = allSchedules.find(s => s.id === scheduleId);
        if (existing) finalPayload.status = existing.status;
      } else {
        finalPayload.status = 'draft';
      }

      try {
        const res = await fetch(url, {
          method: method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(finalPayload)
        });

        if (res.ok) {
          formStatus.textContent = '保存しました';
          formStatus.className = 'form-status success';
          setTimeout(() => {
            scheduleDialog.close();
            loadSchedules();
          }, 1000);
        } else {
          throw new Error('Save Failed');
        }
      } catch (err) {
        console.error(err);
        formStatus.textContent = 'エラーが発生しました';
        formStatus.className = 'form-status error';
      }
    });
  }


  document.getElementById('add-schedule-btn')?.addEventListener('click', () => openAddDialog());
  document.getElementById('reload-customers-data-btn')?.addEventListener('click', async () => {
    await Promise.all([loadStores(), loadClients(), loadBrands()]);
    alert('顧客データを更新しました');
  });
}


// Helpers
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
function getStatusLabel(s) {
  const map = { 'draft': '未確定', 'scheduled': '確定', 'in_progress': '作業中', 'completed': '完了' };
  return map[s] || s;
}

// --- Print Logic ---
window.printScheduleRequest = function (id) {
  const s = allSchedules.find(x => x.id === id);
  if (!s) return;

  const client = allClients.find(c => c.id === s.client_id) || {};
  const brand = allBrands.find(b => b.id === s.brand_id) || {};
  const store = allStores.find(st => st.id === s.store_id) || {};
  const sd = s.survey_data || {};
  const ass = sd.assessment || {};

  const workerNames = s.worker_names || (s.assigned_to_user ? s.assigned_to_user.name : '未定');

  const html = `
    <!-- Page 1 -->
    <div class="print-page">
        <div class="print-header">
            <h1 style="font-size:24px; margin:0;">清掃作業依頼書</h1>
            <div style="display:flex; justify-content:space-between; margin-top:10px;">
                <span>発行日: ${new Date().toLocaleDateString()}</span>
                <span>担当営業: ${escapeHtml(s.sales_user_name || '-')}</span>
            </div>
        </div>

        <div class="print-section">
            <h3>基本情報</h3>
            <div class="print-row"><div class="print-label">顧客名</div><div class="print-value">${escapeHtml(client.name || '')}</div></div>
            <div class="print-row"><div class="print-label">ブランド</div><div class="print-value">${escapeHtml(brand.name || '')}</div></div>
            <div class="print-row"><div class="print-label">店舗名</div><div class="print-value" style="font-size:1.2em; font-weight:bold;">${escapeHtml(store.name || '')}</div></div>
            <div class="print-row"><div class="print-label">住所</div><div class="print-value">${escapeHtml(store.address || '')}</div></div>
            <div class="print-row"><div class="print-label">電話番号</div><div class="print-value">${escapeHtml(store.phone || '-')}</div></div>
        </div>

        <div class="print-section">
            <h3>実施概要</h3>
            <div class="print-row"><div class="print-label">実施日時</div><div class="print-value" style="font-weight:bold;">${s.date || s.scheduled_date} <span style="margin-left:10px;">${s.time_slot || s.scheduled_time || ''}</span></div></div>
            <div class="print-row"><div class="print-label">作業種別</div><div class="print-value">${s.work_type === 'spot' ? '臨時（スポット）' : (s.work_type === 'special' ? '特別清掃' : '定期清掃')}</div></div>
            <div class="print-row"><div class="print-label">担当清掃員</div><div class="print-value">${escapeHtml(workerNames)}</div></div>
            <div class="print-row"><div class="print-label">立会い</div><div class="print-value">
                ${s.attendance_required === 'none' ? '無し' : (s.attendance_required === 'start' ? '開始時' : (s.attendance_required === 'end' ? '終了時' : '常時'))}
                ${s.attendance_notes ? `(${escapeHtml(s.attendance_notes)})` : ''}
            </div></div>
        </div>

        <div class="print-section">
            <h3>ロジスティクス</h3>
            <div class="print-row"><div class="print-label">駐車位置</div><div class="print-value">${escapeHtml(s.parking_info || '-')}</div></div>
            <div class="print-row"><div class="print-label">鍵受渡</div><div class="print-value">${escapeHtml(s.key_info || '-')}</div></div>
        </div>

        <div class="print-section">
            <h3>清掃実施項目・特記事項</h3>
            <div style="padding:10px; background:#f9f9f9; min-height:100px;">
                <strong>■ 実施項目:</strong><br>
                ${(s.cleaning_items || []).map(i => `・${escapeHtml(i.name || i.title)}`).join('<br>')}
                <br><br>
                <strong>■ 特記事項・注意事項:</strong><br>
                <div style="white-space:pre-wrap;">${escapeHtml(s.notes || '特になし')}</div>
            </div>
        </div>
    </div>

    <!-- Page 2 -->
    <div class="print-page">
        <div class="print-header">
            <h3>詳細情報・現地調査アセスメント</h3>
            <span>店舗名: ${escapeHtml(store.name || '')}</span>
        </div>

        <div class="print-section">
            <h3>現地調査アセスメント (4エリア)</h3>
            <table style="width:100%; border-collapse:collapse; font-size:14px;">
                <tr style="background:#eee;"><th style="border:1px solid #ccc; padding:5px;">エリア</th><th style="border:1px solid #ccc; padding:5px;">評価</th><th style="border:1px solid #ccc; padding:5px;">詳細メモ</th></tr>
                <tr>
                    <td style="border:1px solid #ccc; padding:5px;">調理エリア（厨房）</td>
                    <td style="border:1px solid #ccc; padding:5px; text-align:center;">${formatAssessStatus(ass.area1?.status)}</td>
                    <td style="border:1px solid #ccc; padding:5px;">${escapeHtml(ass.area1?.note || '')}</td>
                </tr>
                <tr>
                    <td style="border:1px solid #ccc; padding:5px;">厨房機器・設備</td>
                    <td style="border:1px solid #ccc; padding:5px; text-align:center;">${formatAssessStatus(ass.area2?.status)}</td>
                    <td style="border:1px solid #ccc; padding:5px;">${escapeHtml(ass.area2?.note || '')}</td>
                </tr>
                <tr>
                    <td style="border:1px solid #ccc; padding:5px;">手洗い設備・トイレ</td>
                    <td style="border:1px solid #ccc; padding:5px; text-align:center;">${formatAssessStatus(ass.area3?.status)}</td>
                    <td style="border:1px solid #ccc; padding:5px;">${escapeHtml(ass.area3?.note || '')}</td>
                </tr>
                <tr>
                    <td style="border:1px solid #ccc; padding:5px;">ねずみ・昆虫対策</td>
                    <td style="border:1px solid #ccc; padding:5px; text-align:center;">${formatAssessStatus(ass.area4?.status)}</td>
                    <td style="border:1px solid #ccc; padding:5px;">${escapeHtml(ass.area4?.note || '')}</td>
                </tr>
            </table>
        </div>

        <div class="print-section">
            <h3>HACCP 衛生管理指示</h3>
            <div class="print-row"><div class="print-label">重点項目</div><div class="print-value">${(s.haccp_instructions || []).join(', ')}</div></div>
            <div class="print-row"><div class="print-label">特記事項</div><div class="print-value">${escapeHtml(s.haccp_notes || '-')}</div></div>
        </div>

        <div class="print-section">
            <h3>店舗カルテ情報</h3>
             <div style="display:flex; flex-wrap:wrap;">
                <div style="width:50%; margin-bottom:5px;"><strong>環境:</strong> ${escapeHtml(sd.environment || '-')}</div>
                <div style="width:50%; margin-bottom:5px;"><strong>課題:</strong> ${escapeHtml(sd.issue || '-')}</div>
                <div style="width:33%;"><strong>広さ:</strong> ${escapeHtml(sd.area_sqm || '-')}</div>
                <div style="width:33%;"><strong>天井高:</strong> ${escapeHtml(sd.ceiling_height || '-')}</div>
                <div style="width:33%;"><strong>入口数:</strong> ${escapeHtml(sd.entrances || '-')}</div>
                <div style="width:100%; margin-top:5px;"><strong>設備詳細:</strong><br>
                   鍵: ${escapeHtml(sd.key_location || '-')}, ブレーカー: ${escapeHtml(sd.breaker_location || '-')},
                   壁: ${escapeHtml(sd.wall_material || '-')}, 床: ${escapeHtml(sd.floor_material || '-')}
                </div>
                <div style="width:100%; margin-top:5px;"><strong>重点箇所・備考:</strong> ${escapeHtml(sd.notes || '-')}</div>
             </div>
        </div>
    </div>
    `;

  const container = document.getElementById('print-layout-container');
  container.innerHTML = html;
  container.style.display = 'block';

  // Defer print to ensure DOM render
  setTimeout(() => {
    window.print();
  }, 100);
};

window.addEventListener('afterprint', () => {
  document.getElementById('print-layout-container').style.display = 'none';
});

function formatAssessStatus(st) {
  if (st === 'good') return '◎ 良好';
  if (st === 'warn') return '△ 要注意';
  if (st === 'bad') return '× 不良';
  return '-';
}
