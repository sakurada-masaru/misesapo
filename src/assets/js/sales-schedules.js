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
let currentView = 'calendar'; // Default to calendar
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

  setupEventListeners();
  setupStoreSearch();
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
    allSchedules = Array.isArray(data) ? data : (data.items || data.schedules || []);
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
    allStores = Array.isArray(data) ? data : (data.items || []);
    populateStoreSelects();
  } catch (e) { console.error(e); }
}

async function loadWorkers() {
  try {
    const res = await fetch(`${API_BASE}/workers`);
    const data = await res.json();
    allWorkers = Array.isArray(data) ? data : (data.items || []);
    populateWorkerSelects();
    populateSalesSelects();
  } catch (e) { console.error(e); }
}

async function loadClients() {
  try {
    const res = await fetch(`${API_BASE}/clients`);
    const data = await res.json();
    allClients = Array.isArray(data) ? data : (data.items || []);
  } catch (e) { console.error(e); }
}
async function loadBrands() {
  try {
    const res = await fetch(`${API_BASE}/brands`);
    const data = await res.json();
    allBrands = Array.isArray(data) ? data : (data.items || []);
  } catch (e) { console.error(e); }
}
async function loadServices() {
  try {
    const res = await fetch(`${API_BASE}/services`);
    const data = await res.json();
    allServices = Array.isArray(data) ? data : (data.items || []);
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

function populateWorkerSelects() {
  // Filter for 'staff' role AND 'OS' department
  let cleaners = allWorkers.filter(w => {
    const role = (w.role || '').toLowerCase();
    const dept = (w.department || '').toLowerCase();
    return role === 'staff' && (dept.includes('os') || dept.includes('operations'));
  });

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

function setupStoreSearch() {
  const searchInput = document.getElementById('schedule-store-search');
  const resultsDiv = document.getElementById('schedule-store-results');
  const hiddenInput = document.getElementById('schedule-store');
  const summaryText = document.getElementById('schedule-store-summary-text');

  if (!searchInput || !resultsDiv) return;

  const getFilterMode = () => {
    const el = document.querySelector('input[name="store_search_mode"]:checked');
    return el ? el.value : '';
  };

  const updateDropdown = () => {
    const query = searchInput.value.trim().toLowerCase();
    const cat = getFilterMode();

    if (query.length === 0) {
      resultsDiv.style.display = 'none';
      return;
    }

    let filtered = allStores.filter(store => {
      const sName = (store.name || '').toLowerCase();
      const sBrand = (store.brand_name || '').toLowerCase();
      const sClient = (store.client_name || '').toLowerCase();

      if (cat === 'store') return sName.includes(query);
      if (cat === 'brand') return sBrand.includes(query);
      if (cat === 'client') return sClient.includes(query);

      // All
      return sName.includes(query) || sBrand.includes(query) || sClient.includes(query);
    });

    if (filtered.length === 0) {
      resultsDiv.innerHTML = '<div class="store-search-item no-results">該当する店舗は見つかりません</div>';
    } else {
      resultsDiv.innerHTML = filtered.map(s =>
        `<div class="store-search-item" data-id="${s.id}" data-name="${escapeHtml(s.name)}">
            <div style="display:flex; justify-content:space-between; align-items:center;">
               <div style="font-weight:700; color:#111827; font-size:1rem;">
                  ${s.brand_name ? escapeHtml(s.brand_name) : (s.client_name ? escapeHtml(s.client_name) : '<span style="color:#999;font-weight:400;font-size:0.85rem;">所属なし</span>')}
               </div>
               ${s.client_name && s.brand_name ? `<div style="font-size:0.7rem; color:#6b7280; background:#f3f4f6; padding:2px 6px; border-radius:4px;">${escapeHtml(s.client_name)}</div>` : ''}
            </div>
            
            <div style="display:flex; align-items:center; gap:6px; margin-top:4px; color:#4b5563; font-size:0.85rem;">
                 <i class="fas fa-store" style="color:#d1d5db; font-size:0.75rem;"></i>
                 <span>${escapeHtml(s.name)}</span>
            </div>
            
            ${s.address ? `<div style="font-size:0.75rem; color:#9ca3af; margin-top:2px; margin-left:20px;">${escapeHtml(s.address)}</div>` : ''}
        </div>`
      ).join('');
    }
    resultsDiv.style.display = 'block';

    // Click handlers
    resultsDiv.querySelectorAll('.store-search-item:not(.no-results)').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        const name = item.dataset.name;
        hiddenInput.value = id;
        searchInput.value = name;
        resultsDiv.style.display = 'none';

        // 選択した店舗データを取得
        const selectedStore = allStores.find(s => s.id === id);

        // 法人名・ブランド名・店舗名フィールドを表示して入力
        const detailsSection = document.getElementById('selected-store-details');
        if (detailsSection && selectedStore) {
          detailsSection.style.display = 'block';
          document.getElementById('schedule-client-name').value = selectedStore.client_name || '';
          document.getElementById('schedule-brand-name').value = selectedStore.brand_name || '';
          document.getElementById('schedule-store-name').value = selectedStore.name || '';
        }

        // LOAD KARTE DATA
        loadKarteData(id);
      });
    });
  };

  searchInput.addEventListener('input', updateDropdown);
  document.querySelectorAll('input[name="store_search_mode"]').forEach(r => {
    r.addEventListener('change', () => {
      updateDropdown();
      const mode = r.value;
      const placeholderMap = {
        'store': '店舗名を検索...',
        'brand': 'ブランド名を検索...',
        'client': '法人名を検索...'
      };
      searchInput.placeholder = placeholderMap[mode] || '店舗・ブランド・法人を検索...';
    });
  });

  document.addEventListener('click', e => {
    if (!searchInput.contains(e.target) && !resultsDiv.contains(e.target)) resultsDiv.style.display = 'none';
  });
}

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
    // Filter for OS Department only
    const osWorkers = allWorkers.filter(w => w.department === 'OS' || w.department === 'OS課');
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
    const isDraft = s.status === 'draft';
    return `
            <div class="schedule-card ${isDraft ? 'draft-card' : ''}" onclick="openEditDialog('${s.id}')">
               <div class="schedule-card-header">
                  <span class="status-badge status-${s.status}">${getStatusLabel(s.status)}</span>
                  <span style="margin-left:auto;font-size:0.8rem;color:#666;">${s.date || s.scheduled_date}</span>
               </div>
               <div style="font-weight:bold;margin:8px 0;">${escapeHtml(store.name || s.store_name || '店舗未設定')}</div>
               <div style="font-size:0.85rem;color:#666;">
                  清掃員: ${s.worker_id ? (allWorkers.find(w => w.id === s.worker_id)?.name || '不明') : '未割当'}
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
      const statusLabel = getStatusLabel(s.status);
      return `
        <div class="schedule-card" style="border:1px solid #e5e7eb; padding:12px; margin-bottom:10px; border-radius:12px; position:relative; transition:all 0.2s; background:#fff; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
           
           <!-- Main Click Area: Open Print View -->
           <div onclick="printScheduleRequest('${s.id}')" style="cursor:pointer; padding-right:40px;">
             <div style="display:flex; justify-content:space-between; margin-bottom:8px; align-items:center;">
                <span class="status-badge status-${s.status}">${statusLabel}</span>
                <span style="font-size:0.8rem; color:#6b7280;">${s.time_slot || ''}</span>
             </div>
             <div style="font-weight:700; color:#111827; margin-bottom:6px; font-size:1rem; line-height:1.4;">${escapeHtml(store.name || s.store_name || '店舗未設定')}</div>
             <div style="font-size:0.85rem; color:#6B7280; display:flex; align-items:center; gap:6px; margin-bottom:10px;">
                <i class="fas fa-user-circle" style="color:#9ca3af;"></i>
                <span>${s.worker_id ? (allWorkers.find(w => w.id === s.worker_id)?.name || '未定') : '未割当'}</span>
             </div>
             <div style="font-size:0.85rem; color:#FF679C; font-weight:600; display:flex; align-items:center; gap:6px;">
               <i class="fas fa-file-alt"></i> 依頼書プレビュー
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

  // Clear Store Selection
  document.getElementById('schedule-store').value = '';
  document.getElementById('schedule-store-search').value = '';
  document.getElementById('schedule-store-summary-text').textContent = '未選択';

  // Reset Karte Fields
  resetSurveyFields();

  // Reset Worker Selection
  document.querySelectorAll('#worker-selection-list input[type="checkbox"]').forEach(cb => cb.checked = false);
  updateSelectedWorkersDisplay();

  // Reset selection lists
  selectedCleaningItems = [];
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

  // Store
  const storeId = s.store_id || s.client_id;
  if (storeId) {
    document.getElementById('schedule-store').value = storeId;
    const store = allStores.find(x => x.id === storeId);
    if (store) {
      document.getElementById('schedule-store-search').value = store.name;
      document.getElementById('schedule-store-summary-text').textContent = store.name;
    }
  }

  // Items
  if (s.cleaning_items) {
    selectedCleaningItems = Array.isArray(s.cleaning_items) ? s.cleaning_items : [];
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

  // Survey Data (Full Population)
  const sd = s.survey_data || {};
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
    cleaning_items: s.cleaning_items || []
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

function setupEventListeners() {
  if (scheduleForm) {
    scheduleForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const formStatus = document.getElementById('form-status');
      formStatus.textContent = '保存中...';

      try {
        const authHeaders = await getAuthHeaders();
        const id = document.getElementById('schedule-id').value;
        const isNew = !id;
        const storeId = document.getElementById('schedule-store').value;
        // Validations
        if (!storeId) throw new Error('店舗を選択してください');

        // 1. Save Schedule
        // Use selectedWorkers state
        const primaryWorkerId = selectedWorkers.length > 0 ? selectedWorkers.map(w => w.id).join(',') : null;

        const scheduleData = {
          store_id: storeId,
          client_name: document.getElementById('schedule-client-name')?.value || '',
          brand_name: document.getElementById('schedule-brand-name')?.value || '',
          store_name: document.getElementById('schedule-store-name')?.value || '',
          address: (() => {
            const el = document.getElementById('schedule-address');
            if (el) return el.value;
            // 店舗データから取得
            const store = allStores.find(s => s.id === storeId);
            return store?.address || '';
          })(),
          phone: (() => {
            const el = document.getElementById('schedule-phone');
            if (el) return el.value;
            // 店舗データから取得
            const store = allStores.find(s => s.id === storeId);
            return store?.phone || '';
          })(),
          scheduled_date: document.getElementById('schedule-date').value,
          scheduled_time: document.getElementById('schedule-time').value,
          sales_id: document.getElementById('schedule-sales').value || null,
          worker_id: primaryWorkerId,
          // Store ALL selected in notes or a custom field if backend ignores extra fields?
          // For now, assume primary assignment is what matters for "Accepted".
          status: 'draft',
          cleaning_items: selectedCleaningItems,
          survey_data: {
            issue: document.getElementById('survey-issue')?.value || '',
            environment: document.getElementById('survey-environment')?.value || '',
            cleaning_frequency: document.getElementById('survey-cleaning-frequency')?.value || '',
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
          },
        };

        // If worker assigned, status = scheduled.
        // If NO worker assigned (Open), status = draft.
        if (scheduleData.worker_id) {
          scheduleData.status = 'scheduled';
        } else {
          scheduleData.status = 'draft'; // Open
        }

        if (!isNew) scheduleData.id = id;

        const schedRes = await fetch(`${API_BASE}/schedules${isNew ? '' : '/' + id}`, {
          method: isNew ? 'POST' : 'PUT',
          headers: authHeaders,
          body: JSON.stringify(scheduleData)
        });
        if (!schedRes.ok) throw new Error('スケジュールの保存に失敗しました');
        const schedResult = await schedRes.json();

        // 2. Save Karte (Simultaneous)
        const kartePayload = buildSurveyPayload(storeId);
        if (kartePayload) {
          // Try Saving Karte
          const karteRes = await fetch(`${API_BASE}/kartes`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify(kartePayload)
          });
          if (!karteRes.ok) {
            console.warn('カルテの保存に失敗しました', await karteRes.text());
          }
        }

        // Success
        formStatus.textContent = '保存しました';

        // Update Local Cache Immediately
        const savedId = isNew ? (schedResult.id || schedResult.item?.id) : id;
        // Merge existing fields with input fields to ensure cache is rich
        const baseItem = isNew ? {} : (allSchedules.find(s => String(s.id) === String(id)) || {});
        const savedItem = {
          ...baseItem,
          ...scheduleData,
          id: savedId,
          // Ensure survey_data is saved too
          survey_data: scheduleData.survey_data,
          ...schedResult
        };

        const existingIdx = allSchedules.findIndex(s => String(s.id) === String(savedId));
        if (existingIdx !== -1) {
          allSchedules[existingIdx] = savedItem;
        } else {
          allSchedules.push(savedItem);
        }

        setTimeout(() => {
          formStatus.textContent = '';
          if (scheduleDialog) scheduleDialog.close();
          loadSchedules(); // Reload for full sync
        }, 1000);

      } catch (err) {
        console.error(err);
        formStatus.textContent = 'エラー: ' + err.message;
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
