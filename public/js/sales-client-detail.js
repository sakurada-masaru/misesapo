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

async function getFirebaseIdToken() {
  try {
    const cognitoIdToken = localStorage.getItem('cognito_id_token');
    if (cognitoIdToken) {
      return cognitoIdToken;
    }
    const authData = localStorage.getItem('misesapo_auth');
    if (authData) {
      const parsed = JSON.parse(authData);
      if (parsed.token) {
        return parsed.token;
      }
    }
    return 'mock-token';
  } catch (error) {
    console.error('Error getting ID token:', error);
    return 'mock-token';
  }
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

function setHtml(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = value || '-';
}

function setHref(id, href, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.href = href;
  if (text) {
    el.textContent = text;
  }
}

async function loadClientDetail() {
  const storeId = getQueryParam('id');
  if (!storeId) {
    setText('client-company', '顧客IDが指定されていません');
    return;
  }

  const token = await getFirebaseIdToken();
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

    setText('client-company', companyName);
    setText('client-company-value', companyName);
    setText('client-store', storeName);
    setText('client-store-value', storeName);
    setText('client-brand-value', brandName);

    const brandEl = document.getElementById('client-brand');
    if (brandEl && brandName !== '-') {
      brandEl.textContent = brandName;
      brandEl.style.display = 'block';
    }

    setText('client-store-count', store.store_count || store.store_count_total || '-');
    setText('client-contact-person', store.contact_person || '-');
    setText('client-sales-rep', store.sales_rep || '-');
    setText('client-cleaning-frequency', store.cleaning_frequency || '-');

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
  } catch (error) {
    console.error('Failed to load client detail:', error);
    setText('client-company', '読み込みに失敗しました');
  }
}

document.addEventListener('DOMContentLoaded', loadClientDetail);
