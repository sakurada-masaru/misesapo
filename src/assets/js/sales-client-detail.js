const API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

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

let karteHistory = [];

function ensureAuthOrRedirect() {
  const token = getStoredToken();
  if (!token) {
    redirectToSignin();
    return null;
  }
  return token;
}

function formatDateToJa(dateValue) {
  if (!dateValue) return '-';
  try {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    if (Number.isNaN(date.getTime())) return String(dateValue);
    return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch (error) {
    return String(dateValue);
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value || '-';
}

function setInputValue(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = value || '';
}

function setCheckboxValue(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  if (typeof value === 'boolean') {
    el.checked = value;
    return;
  }
  if (value === undefined || value === null) return;
  if (typeof value === 'string') {
    el.checked = value === 'true' || value === '1' || value.toLowerCase() === 'yes';
    return;
  }
  el.checked = Boolean(value);
}

function normalizeEquipmentList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function getKarteKey(karte) {
  return karte?.id || karte?.karte_id || karte?.chart_id || karte?.created_at || '';
}

function formatKarteLabel(karte, index) {
  const dateLabel = formatDateToJa(karte?.created_at || karte?.updated_at || '');
  const orderLabel = index === 0 ? '最新' : `履歴${index}`;
  return `${orderLabel}：${dateLabel}`;
}

function setHtml(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = value || '-';
}

function setSurveyEditable(isEditable) {
  const reportCard = document.querySelector('.report-card');
  if (!reportCard) return;
  const fields = reportCard.querySelectorAll('.form-field');
  fields.forEach((field) => {
    field.disabled = !isEditable;
  });
  const checkboxes = reportCard.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach((checkbox) => {
    checkbox.disabled = !isEditable;
  });
  const fileInputs = reportCard.querySelectorAll('input[type="file"]');
  fileInputs.forEach((input) => {
    input.disabled = !isEditable;
  });
}

function setKarteStatus(hasKarte) {
  const statusChip = document.getElementById('karte-status');
  if (!statusChip) return;
  if (hasKarte) {
    statusChip.textContent = 'カルテ作成済み';
    statusChip.classList.remove('status-draft');
    statusChip.classList.add('status-complete');
  } else {
    statusChip.textContent = 'カルテ未作成';
    statusChip.classList.add('status-draft');
    statusChip.classList.remove('status-complete');
  }
}

function renderKarteHistory(items) {
  const historyWrap = document.getElementById('karte-history');
  const select = document.getElementById('karte-history-select');
  if (!historyWrap || !select) return;
  if (!items || items.length <= 1) {
    historyWrap.style.display = 'none';
    return;
  }
  historyWrap.style.display = 'flex';
  select.innerHTML = items.map((item, index) => {
    const value = getKarteKey(item);
    const label = formatKarteLabel(item, index);
    return `<option value="${escapeHtml(String(value))}">${escapeHtml(label)}</option>`;
  }).join('');
  select.value = getKarteKey(items[0]);
}

function setHref(id, href, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.href = href;
  if (text) {
    el.textContent = text;
  }
}

let currentStoreId = null;
let currentClientId = null;
let currentBrandId = null;

function getSafeFileName(file, fallbackPrefix) {
  const rawName = file?.name || `${fallbackPrefix}-photo.jpg`;
  return rawName.replace(/[^\w.\-]+/g, '_');
}

function buildUploadPrefix(storeId, type) {
  if (!storeId) return '';
  return `stores/${storeId}/assets/${type}`;
}

function setPreviewImage(previewId, src) {
  const preview = document.getElementById(previewId);
  if (!preview) return;
  preview.innerHTML = '';
  if (!src) return;
  const img = document.createElement('img');
  img.src = src;
  img.alt = 'アップロード画像';
  preview.appendChild(img);
}

async function uploadSurveyPhoto({ fileInputId, hiddenInputId, previewId, type }) {
  const fileInput = document.getElementById(fileInputId);
  const hiddenInput = document.getElementById(hiddenInputId);
  if (!fileInput) return hiddenInput?.value || '';

  if (fileInput.files && fileInput.files.length > 0) {
    if (!window.AWSS3Upload || !window.AWSS3Upload.isAvailable()) {
      throw new Error('S3アップロードが利用できません');
    }
    const file = fileInput.files[0];
    const timestamp = new Date().toISOString().replace(/[^\d]/g, '');
    const safeName = getSafeFileName(file, type);
    const keyPrefix = buildUploadPrefix(currentStoreId, type);
    const result = await window.AWSS3Upload.uploadImage(file, type, {
      keyPrefix,
      fileName: `${timestamp}-${safeName}`
    });
    const url = result?.url || result?.path || '';
    if (hiddenInput) hiddenInput.value = url;
    setPreviewImage(previewId, url);
    return url;
  }

  return hiddenInput?.value || '';
}

async function loadClientDetail() {
  const storeId = getQueryParam('id');
  if (!storeId) {
    setText('client-company', '顧客IDが指定されていません');
    return;
  }

  const token = ensureAuthOrRedirect();
  if (!token) return;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  try {
    const [storesRes, clientsRes, brandsRes, schedulesRes] = await Promise.all([
      fetch(`${API_BASE}/stores`, { headers }),
      fetch(`${API_BASE}/clients`, { headers }),
      fetch(`${API_BASE}/brands`, { headers }),
      fetch(`${API_BASE}/schedules`, { headers })
    ]);

    if (!storesRes.ok || !clientsRes.ok || !brandsRes.ok || !schedulesRes.ok) {
      if ([storesRes, clientsRes, brandsRes, schedulesRes].some((res) => res.status === 401 || res.status === 403)) {
        redirectToSignin();
        return;
      }
      throw new Error('Failed to load data');
    }

    const storesData = await storesRes.json();
    const clientsData = await clientsRes.json();
    const brandsData = await brandsRes.json();
    const schedulesData = await schedulesRes.json();

    const stores = Array.isArray(storesData) ? storesData : (storesData.items || storesData.stores || []);
    const clients = Array.isArray(clientsData) ? clientsData : (clientsData.items || clientsData.clients || []);
    const brands = Array.isArray(brandsData) ? brandsData : (brandsData.items || brandsData.brands || []);
    const schedules = Array.isArray(schedulesData) ? schedulesData : (schedulesData.items || schedulesData.schedules || []);

    const store = stores.find(s => String(s.id) === String(storeId)) || null;
    if (!store) {
      setText('client-company', '顧客情報が見つかりません');
      return;
    }

    const client = clients.find(c => String(c.id) === String(store.client_id)) || null;
    const brand = brands.find(b => String(b.id) === String(store.brand_id)) || null;
    currentStoreId = store.id || storeId;
    currentClientId = client ? client.id : store.client_id || null;
    currentBrandId = brand ? brand.id : store.brand_id || null;

    const status = store.status || '稼働中';
    const statusBadge = document.getElementById('client-status');
    if (statusBadge) {
      statusBadge.textContent = status;
      statusBadge.classList.add(`status-${status}`);
    }
    const statusValue = document.getElementById('client-status-value');
    if (statusValue) {
      statusValue.textContent = status;
      statusValue.classList.add(`status-${status}`);
    }

    const companyName = client ? (client.name || client.company_name || '-') : '-';
    const brandName = brand ? (brand.name || '-') : '-';
    const storeName = store.name || '-';

    setText('client-company-badge', companyName);
    setText('client-store', storeName);
    setText('client-brand-badge', brandName);

    setText('client-phone', store.phone || '-');
    const addressText = [store.pref, store.city, store.address, store.address_detail]
      .filter(Boolean)
      .join('');
    setText('client-address', addressText || '-');
    setText('client-contact-person', store.contact_person || '-');
    setText('client-sales-rep', store.sales_rep || '-');
    setText('client-cleaning-frequency', store.cleaning_frequency || '-');

    setInputValue('survey-area-sqm', store.area_sqm || store.area_square_m || '');
    setInputValue('survey-area-tatami', store.area_tatami || '');
    setInputValue('survey-toilet-count', store.toilet_count || '');
    setInputValue('survey-entrances', store.entrances || store.entry_points || '');
    setInputValue('survey-breaker-location', store.breaker_location || '');
    setInputValue('survey-key-location', store.key_location || '');
    setInputValue('survey-staff-room', store.staff_room || '');
    setInputValue('survey-wall-material', store.wall_material || '');
    setInputValue('survey-floor-material', store.floor_material || '');
    setInputValue('survey-electrical-amps', store.electrical_amps || '');
    setInputValue('survey-aircon-count', store.aircon_count || store.aircon_units || '');
    setInputValue('survey-ceiling-height', store.ceiling_height || '');

    if (store.email) {
      const emailLink = document.getElementById('client-email');
      if (emailLink) {
        emailLink.href = `mailto:${store.email}`;
        emailLink.textContent = store.email;
      }
      const emailAction = document.getElementById('client-email-link');
      if (emailAction) {
        emailAction.href = `mailto:${store.email}`;
        emailAction.style.display = 'flex';
      }
    }

    if (store.url) {
      const urlSection = document.getElementById('url-section');
      const urlLink = document.getElementById('client-url');
      const urlText = document.getElementById('client-url-text');
      if (urlSection && urlLink && urlText) {
        urlSection.style.display = 'block';
        urlLink.href = store.url;
        urlText.textContent = store.url;
      }
      const urlAction = document.getElementById('client-url-link');
      if (urlAction) {
        urlAction.href = store.url;
        urlAction.style.display = 'flex';
      }
    }

    if (store.notes) {
      const notesSection = document.getElementById('notes-section');
      if (notesSection) {
        notesSection.style.display = 'block';
      }
      setText('client-notes', store.notes);
    }

    const nextSchedule = schedules
      .filter(s => {
        const scheduleStoreId = s.store_id || s.client_id || s.storeId;
        const statusMatch = s.status === 'scheduled' || s.status === 'draft';
        return String(scheduleStoreId) === String(storeId) && statusMatch;
      })
      .sort((a, b) => {
        const dateA = a.date || a.scheduled_date || '';
        const dateB = b.date || b.scheduled_date || '';
        return String(dateA).localeCompare(String(dateB));
      })[0];

    if (nextSchedule) {
      const dateValue = nextSchedule.date || nextSchedule.scheduled_date || '';
      setText('client-next-date', formatDateToJa(dateValue));
    }

    const editLink = document.getElementById('client-edit-link');
    if (editLink) {
      editLink.href = `/sales/clients/${storeId}/edit.html`;
    }

    setHref('client-kart-link', `/sales/stores/${storeId}/chart`);
    setHref('client-estimate-link', `/sales/estimates/new?client_id=${storeId}`);
    setHref('client-orders-link', `/sales/orders?client_id=${storeId}`);

    const karteRes = await fetch(`${API_BASE}/kartes?store_id=${encodeURIComponent(storeId)}`, { headers });
    if (karteRes.ok) {
      const karteData = await karteRes.json().catch(() => ({}));
      const karteItems = Array.isArray(karteData) ? karteData : (karteData.items || []);
      karteHistory = karteItems.slice(0, 20);
      renderKarteHistory(karteHistory);
      const latestKarte = karteHistory[0];
      const hasKarte = Boolean(latestKarte);
      setKarteStatus(hasKarte);
      if (latestKarte) {
        setInputValue('survey-issue', latestKarte.issue || '');
        setInputValue('survey-environment', latestKarte.environment || '');
        setInputValue('survey-staff-normal', latestKarte.staffNormal || '');
        setInputValue('survey-staff-peak', latestKarte.staffPeak || '');
        setInputValue('survey-hours', latestKarte.hours || '');
        setInputValue('survey-cleaning-frequency', latestKarte.cleaningFrequency || '');
        setInputValue('survey-area-sqm', latestKarte.areaSqm || '');
        setInputValue('survey-area-tatami', latestKarte.areaTatami || '');
        setInputValue('survey-toilet-count', latestKarte.toiletCount || '');
        setInputValue('survey-entrances', latestKarte.entrances || '');
        setInputValue('survey-breaker-location', latestKarte.breakerLocation || '');
        setInputValue('survey-key-location', latestKarte.keyLocation || '');
        setInputValue('survey-staff-room', latestKarte.staffRoom || '');
        setInputValue('survey-wall-material', latestKarte.wallMaterial || '');
        setInputValue('survey-floor-material', latestKarte.floorMaterial || '');
        setInputValue('survey-electrical-amps', latestKarte.electricalAmps || '');
        setInputValue('survey-aircon-count', latestKarte.airconCount || '');
        setInputValue('survey-ceiling-height', latestKarte.ceilingHeight || '');
        setInputValue('survey-aircon', latestKarte.aircon || '');
        setInputValue('survey-kitchen', latestKarte.kitchen || '');
        setInputValue('survey-hotspots', latestKarte.hotspots || '');
        setInputValue('survey-notes', latestKarte.notes || '');
        setInputValue('survey-last-clean', latestKarte.lastClean || '');
        setInputValue('survey-plan', latestKarte.plan || '');
        setInputValue('survey-self-rating', latestKarte.selfRating || '');

        const equipmentValues = normalizeEquipmentList(latestKarte.equipment);
        equipmentValues.forEach((value) => {
          const checkbox = document.querySelector(`#survey-equipment input[value="${value}"]`);
          if (checkbox) checkbox.checked = true;
        });

        setCheckboxValue('survey-seat-counter', latestKarte.seatCounter);
        setCheckboxValue('survey-seat-box', latestKarte.seatBox);
        setCheckboxValue('survey-seat-zashiki', latestKarte.seatZashiki);

        if (latestKarte.breakerPhotoUrl) {
          setInputValue('survey-breaker-photo-url', latestKarte.breakerPhotoUrl);
          setPreviewImage('survey-breaker-photo-preview', latestKarte.breakerPhotoUrl);
        }
        if (latestKarte.keyPhotoUrl) {
          setInputValue('survey-key-photo-url', latestKarte.keyPhotoUrl);
          setPreviewImage('survey-key-photo-preview', latestKarte.keyPhotoUrl);
        }
      }

      const saveButton = document.getElementById('onsite-survey-save');
      const editButton = document.getElementById('onsite-survey-edit');
      if (hasKarte) {
        setSurveyEditable(false);
        if (saveButton) {
          saveButton.style.display = 'none';
        }
        if (editButton) {
          editButton.style.display = 'inline-flex';
        }
      } else {
        setSurveyEditable(true);
        if (saveButton) {
          saveButton.style.display = 'inline-flex';
          saveButton.innerHTML = '<i class="fas fa-pen"></i> 問診票を入力';
        }
        if (editButton) {
          editButton.style.display = 'none';
        }
      }
    } else if (karteRes.status === 401 || karteRes.status === 403) {
      redirectToSignin();
      return;
    }
  } catch (error) {
    console.error('Failed to load client detail:', error);
    setText('client-company', '読み込みに失敗しました');
  }
}

document.addEventListener('DOMContentLoaded', loadClientDetail);
document.addEventListener('DOMContentLoaded', () => {
  const breakerPhotoInput = document.getElementById('survey-breaker-photo');
  if (breakerPhotoInput) {
    breakerPhotoInput.addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0];
      if (file) {
        setPreviewImage('survey-breaker-photo-preview', URL.createObjectURL(file));
      }
    });
  }
  const keyPhotoInput = document.getElementById('survey-key-photo');
  if (keyPhotoInput) {
    keyPhotoInput.addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0];
      if (file) {
        setPreviewImage('survey-key-photo-preview', URL.createObjectURL(file));
      }
    });
  }

  const historySelect = document.getElementById('karte-history-select');
  if (historySelect) {
    historySelect.addEventListener('change', (event) => {
      const selectedKey = event.target.value;
      const selected = karteHistory.find((item) => String(getKarteKey(item)) === String(selectedKey));
      if (!selected) return;
      setInputValue('survey-issue', selected.issue || '');
      setInputValue('survey-environment', selected.environment || '');
      setInputValue('survey-staff-normal', selected.staffNormal || '');
      setInputValue('survey-staff-peak', selected.staffPeak || '');
      setInputValue('survey-hours', selected.hours || '');
      setInputValue('survey-cleaning-frequency', selected.cleaningFrequency || '');
      setInputValue('survey-area-sqm', selected.areaSqm || '');
      setInputValue('survey-area-tatami', selected.areaTatami || '');
      setInputValue('survey-toilet-count', selected.toiletCount || '');
      setInputValue('survey-entrances', selected.entrances || '');
      setInputValue('survey-breaker-location', selected.breakerLocation || '');
      setInputValue('survey-key-location', selected.keyLocation || '');
      setInputValue('survey-staff-room', selected.staffRoom || '');
      setInputValue('survey-wall-material', selected.wallMaterial || '');
      setInputValue('survey-floor-material', selected.floorMaterial || '');
      setInputValue('survey-electrical-amps', selected.electricalAmps || '');
      setInputValue('survey-aircon-count', selected.airconCount || '');
      setInputValue('survey-ceiling-height', selected.ceilingHeight || '');
      setInputValue('survey-aircon', selected.aircon || '');
      setInputValue('survey-kitchen', selected.kitchen || '');
      setInputValue('survey-hotspots', selected.hotspots || '');
      setInputValue('survey-notes', selected.notes || '');
      setInputValue('survey-last-clean', selected.lastClean || '');
      setInputValue('survey-plan', selected.plan || '');
      setInputValue('survey-self-rating', selected.selfRating || '');

      const equipmentValues = normalizeEquipmentList(selected.equipment);
      document.querySelectorAll('#survey-equipment input[type="checkbox"]').forEach((checkbox) => {
        checkbox.checked = equipmentValues.includes(checkbox.value);
      });
      setCheckboxValue('survey-seat-counter', selected.seatCounter);
      setCheckboxValue('survey-seat-box', selected.seatBox);
      setCheckboxValue('survey-seat-zashiki', selected.seatZashiki);

      setInputValue('survey-breaker-photo-url', selected.breakerPhotoUrl || '');
      setInputValue('survey-key-photo-url', selected.keyPhotoUrl || '');
      setPreviewImage('survey-breaker-photo-preview', selected.breakerPhotoUrl || '');
      setPreviewImage('survey-key-photo-preview', selected.keyPhotoUrl || '');

      setSurveyEditable(false);
      const saveButton = document.getElementById('onsite-survey-save');
      const editButton = document.getElementById('onsite-survey-edit');
      if (saveButton) saveButton.style.display = 'none';
      if (editButton) editButton.style.display = 'inline-flex';
    });
  }

  const saveButton = document.getElementById('onsite-survey-save');
  const editButton = document.getElementById('onsite-survey-edit');
  if (editButton) {
    editButton.addEventListener('click', () => {
      setSurveyEditable(true);
      editButton.style.display = 'none';
      if (saveButton) {
        saveButton.style.display = 'inline-flex';
        saveButton.innerHTML = '<i class="fas fa-save"></i> 保存する';
      }
    });
  }
  if (!saveButton) return;
  saveButton.addEventListener('click', async () => {
    saveButton.disabled = true;
    const equipment = Array.from(document.querySelectorAll('#survey-equipment input[type="checkbox"]:checked'))
      .map((input) => input.value);
    let breakerPhotoUrl = '';
    let keyPhotoUrl = '';
    try {
      breakerPhotoUrl = await uploadSurveyPhoto({
        fileInputId: 'survey-breaker-photo',
        hiddenInputId: 'survey-breaker-photo-url',
        previewId: 'survey-breaker-photo-preview',
        type: 'breaker'
      });
      keyPhotoUrl = await uploadSurveyPhoto({
        fileInputId: 'survey-key-photo',
        hiddenInputId: 'survey-key-photo-url',
        previewId: 'survey-key-photo-preview',
        type: 'key'
      });
    } catch (uploadError) {
      console.error('[Onsite Survey] Upload failed:', uploadError);
      alert('画像のアップロードに失敗しました');
      saveButton.disabled = false;
      return;
    }

    const payload = {
      store_id: currentStoreId,
      client_id: currentClientId,
      brand_id: currentBrandId,
      issue: document.getElementById('survey-issue')?.value || '',
      environment: document.getElementById('survey-environment')?.value || '',
      staffNormal: document.getElementById('survey-staff-normal')?.value || '',
      staffPeak: document.getElementById('survey-staff-peak')?.value || '',
      hours: document.getElementById('survey-hours')?.value || '',
      cleaningFrequency: document.getElementById('survey-cleaning-frequency')?.value || '',
      areaSqm: document.getElementById('survey-area-sqm')?.value || '',
      areaTatami: document.getElementById('survey-area-tatami')?.value || '',
      toiletCount: document.getElementById('survey-toilet-count')?.value || '',
      entrances: document.getElementById('survey-entrances')?.value || '',
      breakerLocation: document.getElementById('survey-breaker-location')?.value || '',
      keyLocation: document.getElementById('survey-key-location')?.value || '',
      staffRoom: document.getElementById('survey-staff-room')?.value || '',
      wallMaterial: document.getElementById('survey-wall-material')?.value || '',
      floorMaterial: document.getElementById('survey-floor-material')?.value || '',
      electricalAmps: document.getElementById('survey-electrical-amps')?.value || '',
      airconCount: document.getElementById('survey-aircon-count')?.value || '',
      ceilingHeight: document.getElementById('survey-ceiling-height')?.value || '',
      aircon: document.getElementById('survey-aircon')?.value || '',
      kitchen: document.getElementById('survey-kitchen')?.value || '',
      equipment,
      seatCounter: document.getElementById('survey-seat-counter')?.checked || false,
      seatBox: document.getElementById('survey-seat-box')?.checked || false,
      seatZashiki: document.getElementById('survey-seat-zashiki')?.checked || false,
      hotspots: document.getElementById('survey-hotspots')?.value || '',
      notes: document.getElementById('survey-notes')?.value || '',
      lastClean: document.getElementById('survey-last-clean')?.value || '',
      plan: document.getElementById('survey-plan')?.value || '',
      selfRating: document.getElementById('survey-self-rating')?.value || '',
      breakerPhotoUrl,
      keyPhotoUrl
    };
    try {
      const token = ensureAuthOrRedirect();
      if (!token) {
        saveButton.disabled = false;
        return;
      }
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
      const response = await fetch(`${API_BASE}/kartes`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          redirectToSignin();
          return;
        }
        const errorText = await response.text();
        throw new Error(errorText || '保存に失敗しました');
      }
      setKarteStatus(true);
      setSurveyEditable(false);
      if (editButton) {
        editButton.style.display = 'inline-flex';
      }
      saveButton.style.display = 'none';
      alert('問診票を保存しました');
    } catch (error) {
      console.error('[Onsite Survey] Save failed:', error);
      alert('問診票の保存に失敗しました');
    } finally {
      saveButton.disabled = false;
    }
  });
});
