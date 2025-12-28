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

  // Load Schedules
  await loadSchedules();

  setupEventListeners();
  setupStoreSearch();
  setupCleaningItemsSearch();

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
      resultsDiv.innerHTML = '<div class="store-search-item no-results">見つかりません</div>';
    } else {
      resultsDiv.innerHTML = filtered.map(s =>
        `<div class="store-search-item" data-id="${s.id}" data-name="${escapeHtml(s.name)}">
            <div style="font-weight:bold;">${escapeHtml(s.name)}</div>
            <div style="font-size:0.75rem;color:#666;">
               ${s.brand_name ? '<span class="tag">Brand</span> ' + escapeHtml(s.brand_name) : ''} 
               ${s.client_name ? '<span class="tag">Corp</span> ' + escapeHtml(s.client_name) : ''}
            </div>
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
        if (summaryText) summaryText.textContent = name;

        // LOAD KARTE DATA
        loadKarteData(id);
      });
    });
  };

  searchInput.addEventListener('input', updateDropdown);
  document.querySelectorAll('input[name="store_search_mode"]').forEach(r => r.addEventListener('change', updateDropdown));

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

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { results.style.display = 'none'; return; }

    const filtered = allServices.filter(s => (s.title || s.name || '').toLowerCase().includes(q));
    if (filtered.length === 0) {
      results.innerHTML = '<div style="padding:8px;">見つかりません</div>';
    } else {
      results.innerHTML = filtered.map(s => `
                <div class="search-item" style="padding:8px;cursor:pointer;hover:bg-gray-100;" data-id="${s.id}" data-name="${s.title || s.name}">
                    ${escapeHtml(s.title || s.name)}
                </div>
            `).join('');

      results.querySelectorAll('.search-item').forEach(el => {
        el.addEventListener('click', () => {
          selectedCleaningItems.push({ id: el.dataset.id, name: el.dataset.name });
          renderSelected();
          input.value = '';
          results.style.display = 'none';
        });
      });
    }
    results.style.display = 'block';
  });

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

    // Items
    const daysItems = calSchedules.filter(s => (s.date || s.scheduled_date) === dateStr);

    if (daysItems.length > 0) {
      const eventsContainer = document.createElement('div');
      eventsContainer.className = 'day-events';

      // Limit display count
      const maxDisplay = 3;
      const displayItems = daysItems.slice(0, maxDisplay);

      displayItems.forEach(s => {
        const store = allStores.find(x => x.id === (s.store_id || s.client_id)) || {};
        const el = document.createElement('div');
        el.className = `day-event status-${s.status}`;
        if (new Date(dateStr) < new Date().setHours(0, 0, 0, 0)) {
          el.classList.add('past');
        }

        const timeLabel = s.time_slot ? s.time_slot.split('-')[0] : '';
        el.textContent = `${timeLabel} ${store.name || s.store_name || '件名なし'}`;
        el.title = `${s.time_slot || ''} ${store.name}`;

        el.onclick = (e) => {
          e.stopPropagation();
          openEditDialog(s.id);
        };
        eventsContainer.appendChild(el);
      });

      if (daysItems.length > maxDisplay) {
        const more = document.createElement('div');
        more.className = 'day-event-more';
        more.textContent = `+他${daysItems.length - maxDisplay}件`;
        eventsContainer.appendChild(more);
      }

      cel.appendChild(eventsContainer);
    }

    // Show Daily Schedules on click (background)
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
        <div class="schedule-card" onclick="openEditDialog('${s.id}'); document.getElementById('daily-schedule-dialog').close();" style="cursor:pointer; border:1px solid #eee; padding:10px; margin-bottom:8px; border-radius:6px;">
           <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
              <span class="status-badge status-${s.status}">${statusLabel}</span>
              <span style="font-size:0.8rem; color:#666;">${s.time_slot || ''}</span>
           </div>
           <div style="font-weight:bold; color:#333;">${escapeHtml(store.name || s.store_name || '店舗未設定')}</div>
           <div style="font-size:0.85rem; color:#666; margin-top:4px;">
              担当: ${s.worker_id ? (allWorkers.find(w => w.id === s.worker_id)?.name || '未定') : '未割当'}
           </div>
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
  const form = document.getElementById('schedule-form');
  if (!form) return;
  const elements = form.querySelectorAll('input, select, textarea');
  elements.forEach(el => {
    if (el.type !== 'hidden') el.disabled = isReadOnly;
  });

  // Specific Action Buttons inside the form area
  const workerBtn = document.querySelector('.request-basic-info-section button.btn-secondary'); // Worker select
  if (workerBtn) workerBtn.disabled = isReadOnly;

  const reloadBtn = document.getElementById('reload-customers-data-btn');
  if (reloadBtn) reloadBtn.disabled = isReadOnly;
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

  // Populate Fields
  openAddDialog(s.date || s.scheduled_date); // Reuse population logic? No, openAddDialog resets things. 
  // We need to call openAddDialog to reset, THEN fill.
  // BUT openAddDialog sets mode to Create. We need to override mode AFTER calling it, OR split/duplicate logic.
  // Let's rely on openAddDialog for reset, then override to ReadOnly.

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

  document.getElementById('schedule-id').value = s.id;

  // Workers (Checkboxes)
  const workerId = s.worker_id || s.assigned_to;
  // Handle multiple (stub)
  const assignedIds = workerId ? String(workerId).split(',') : [];

  document.querySelectorAll('#worker-selection-list input[type="checkbox"]').forEach(cb => {
    cb.checked = assignedIds.includes(String(cb.value));
  });
  updateSelectedWorkersDisplay();
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

  // Time & fields
  document.getElementById('schedule-time').value = s.time_slot || s.scheduled_time || '';

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

  // Karte Data?
  loadKarteData(storeId);

  // Update Print Button visibility/action
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
  const s = getScheduleData(id);
  if (!s) { alert('データが見つかりません'); return; }

  // Store in local storage to ensure data persistence for the popup
  // We also augment it with store info if needed, though the print page logic handles some.
  // Let's attach store address/phone to the object for easier printing if not present.
  const store = allStores.find(st => st.id === (s.store_id || s.client_id));
  const enrichment = {
    store_address: store?.address,
    store_phone: store?.phone,
    ...s
  };

  localStorage.setItem('preview_schedule_data', JSON.stringify(enrichment));
  window.open(`/sales/schedules/print.html?id=${id}`, '_blank', 'width=900,height=1000,resizable=yes,scrollbars=yes');
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
        const checkedWorkers = Array.from(document.querySelectorAll('#worker-selection-list input[type="checkbox"]:checked'))
          .map(cb => cb.value);

        // If multiple, join by comma? Schema likely implies singular worker_id.
        // However, "Uber" model often has one assignee.
        // We will save the FIRST one as primary `worker_id` for compatibility,
        // BUT if we want to support multiple, we'd need a `worker_ids` field.
        // User said "Selectable via checkboxes".
        // I'll save `worker_id` as the JOINED string if possible, or just the first.
        // Existing system seems to expect one ID.
        const primaryWorkerId = checkedWorkers.length > 0 ? checkedWorkers[0] : null;

        const scheduleData = {
          store_id: storeId,
          scheduled_date: document.getElementById('schedule-date').value,
          scheduled_time: document.getElementById('schedule-time').value,
          sales_id: document.getElementById('schedule-sales').value || null,
          worker_id: primaryWorkerId,
          // Store ALL selected in notes or a custom field if backend ignores extra fields?
          // For now, assume primary assignment is what matters for "Accepted".
          status: 'draft',
          cleaning_items: selectedCleaningItems,
          notes: document.getElementById('schedule-notes').value || ''
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
        setTimeout(() => {
          formStatus.textContent = '';
          if (scheduleDialog) scheduleDialog.close();
          loadSchedules(); // Reload
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
