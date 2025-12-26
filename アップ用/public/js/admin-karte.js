const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE = IS_LOCAL
  ? '/api/proxy'
  : 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function pickFirst(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function formatDateLabel(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function getAuthToken() {
  try {
    const cognitoIdToken = localStorage.getItem('cognito_id_token');
    if (cognitoIdToken) return cognitoIdToken;
    const authData = localStorage.getItem('misesapo_auth');
    if (authData) {
      const parsed = JSON.parse(authData);
      if (parsed.token) return parsed.token;
    }
  } catch (error) {
    return null;
  }
  return null;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value || '-';
}

function setPhoto(url) {
  const container = document.getElementById('karte-photo');
  if (!container) return;
  container.innerHTML = '';
  if (!url) {
    container.textContent = '🏢';
    return;
  }
  const img = document.createElement('img');
  img.src = url;
  img.alt = '店舗外観写真';
  container.appendChild(img);
}

function setStatusPill(text, tone) {
  const pill = document.getElementById('karte-status-pill');
  if (!pill) return;
  pill.textContent = text || '未診断';
  pill.style.background = '';
  pill.style.color = '';
  if (tone === 'ok') {
    pill.style.background = 'rgba(22, 163, 74, 0.12)';
    pill.style.color = '#15803d';
  }
  if (tone === 'warn') {
    pill.style.background = 'rgba(245, 158, 11, 0.15)';
    pill.style.color = '#b45309';
  }
  if (tone === 'alert') {
    pill.style.background = 'rgba(239, 68, 68, 0.15)';
    pill.style.color = '#b91c1c';
  }
}

function parseScore(value) {
  if (value === undefined || value === null || value === '') return null;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return null;
  if (numeric <= 10) return Math.round(numeric * 10);
  return Math.min(100, Math.max(0, Math.round(numeric)));
}

function buildStatusClass(value) {
  if (!value) return 'status-item';
  const text = String(value).toLowerCase();
  if (text.includes('良') || text.includes('ok') || text.includes('正常')) {
    return 'status-item status-ok';
  }
  if (text.includes('注意') || text.includes('点検') || text.includes('要')) {
    return 'status-item status-warn';
  }
  if (text.includes('不良') || text.includes('故障') || text.includes('危険')) {
    return 'status-item status-alert';
  }
  return 'status-item';
}

function resolveTimelineTitle(item) {
  return pickFirst(
    item.title,
    item.summary,
    item.type,
    item.category,
    item.plan,
    '定期清掃'
  );
}

function resolveTimelineStatus(item) {
  const raw = pickFirst(item.status, item.state, item.progress, 'complete');
  const text = String(raw);
  if (text.includes('要') || text.includes('pending') || text.includes('open')) {
    return { label: '要対応', className: 'badge-alert' };
  }
  if (text.includes('観察') || text.includes('注意') || text.includes('review')) {
    return { label: '観察中', className: 'badge-warn' };
  }
  return { label: '完了', className: 'badge-ok' };
}

function resolvePhoto(item, keys) {
  for (const key of keys) {
    if (item[key]) return item[key];
  }
  return '';
}

function renderTimeline(items) {
  const wrap = document.getElementById('karte-timeline');
  const empty = document.getElementById('karte-empty');
  if (!wrap || !empty) return;
  wrap.innerHTML = '';
  if (!items || items.length === 0) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  items.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'timeline-item';

    const meta = document.createElement('div');
    meta.className = 'timeline-meta';

    const date = document.createElement('span');
    date.className = 'timeline-date';
    date.textContent = formatDateLabel(pickFirst(item.created_at, item.updated_at));

    const badge = document.createElement('span');
    const badgeInfo = resolveTimelineStatus(item);
    badge.className = `timeline-badge ${badgeInfo.className}`;
    badge.textContent = badgeInfo.label;

    meta.appendChild(date);
    meta.appendChild(badge);

    const title = document.createElement('h3');
    title.className = 'timeline-title';
    title.textContent = resolveTimelineTitle(item);

    const desc = document.createElement('p');
    desc.className = 'timeline-desc';
    desc.textContent = pickFirst(item.notes, item.memo, item.issue, item.summary, '');

    const photos = document.createElement('div');
    photos.className = 'timeline-photos';
    const beforeUrl = resolvePhoto(item, ['beforePhotoUrl', 'before_photo_url', 'beforeImageUrl', 'before_image_url']);
    const afterUrl = resolvePhoto(item, ['afterPhotoUrl', 'after_photo_url', 'afterImageUrl', 'after_image_url']);
    if (beforeUrl) {
      const fig = document.createElement('figure');
      const img = document.createElement('img');
      img.src = beforeUrl;
      img.alt = '清掃前の写真';
      const cap = document.createElement('figcaption');
      cap.textContent = 'Before';
      fig.appendChild(img);
      fig.appendChild(cap);
      photos.appendChild(fig);
    }
    if (afterUrl) {
      const fig = document.createElement('figure');
      const img = document.createElement('img');
      img.src = afterUrl;
      img.alt = '清掃後の写真';
      const cap = document.createElement('figcaption');
      cap.textContent = 'After';
      fig.appendChild(img);
      fig.appendChild(cap);
      photos.appendChild(fig);
    }

    card.appendChild(meta);
    card.appendChild(title);
    if (desc.textContent) card.appendChild(desc);
    if (photos.children.length > 0) card.appendChild(photos);

    wrap.appendChild(card);
  });
}

function renderVitals(latest) {
  const scoreEl = document.getElementById('cleanliness-score');
  const bar = document.getElementById('cleanliness-bar');
  const note = document.getElementById('cleanliness-note');
  const equipmentList = document.getElementById('equipment-status-list');
  const notesWrap = document.getElementById('staff-notes');

  if (!scoreEl || !bar || !note || !equipmentList || !notesWrap) return;

  const scoreValue = parseScore(pickFirst(
    latest?.cleanlinessScore,
    latest?.cleanliness_score,
    latest?.score,
    latest?.selfRating,
    latest?.self_rating
  ));

  if (scoreValue === null) {
    scoreEl.textContent = '-';
    bar.style.width = '0%';
    note.textContent = '清潔度スコアが未登録です。';
  } else {
    scoreEl.textContent = scoreValue;
    bar.style.width = `${scoreValue}%`;
    note.textContent = '清潔度の推移をスコアで把握できます。';
  }

  const equipmentStates = [
    { label: '空調', value: pickFirst(latest?.airconStatus, latest?.aircon, latest?.aircon_condition) },
    { label: '排水', value: pickFirst(latest?.drainStatus, latest?.drain, latest?.drain_condition) },
    { label: '厨房', value: pickFirst(latest?.kitchenStatus, latest?.kitchen, latest?.kitchen_condition) }
  ];

  equipmentList.innerHTML = '';
  equipmentStates.forEach((item) => {
    const row = document.createElement('div');
    row.className = buildStatusClass(item.value);
    const label = document.createElement('span');
    label.textContent = item.label;
    const status = document.createElement('span');
    status.className = 'status-indicator';
    const dot = document.createElement('span');
    dot.className = 'status-dot';
    status.appendChild(dot);
    status.appendChild(document.createTextNode(item.value || '未登録'));
    row.appendChild(label);
    row.appendChild(status);
    equipmentList.appendChild(row);
  });

  notesWrap.innerHTML = '';
  const noteSource = pickFirst(latest?.staffNotes, latest?.handover, latest?.notes, latest?.memo);
  if (!noteSource) {
    const empty = document.createElement('div');
    empty.className = 'note-empty';
    empty.textContent = '申し送り事項はまだ登録されていません。';
    notesWrap.appendChild(empty);
    return;
  }
  const noteItems = Array.isArray(noteSource)
    ? noteSource
    : String(noteSource).split(/\n|;|、/).map((line) => line.trim()).filter(Boolean);
  noteItems.forEach((text) => {
    const card = document.createElement('div');
    card.className = 'note-card';
    card.textContent = text;
    notesWrap.appendChild(card);
  });
}

function formatAddress(store) {
  return pickFirst(
    store?.address,
    store?.full_address,
    [store?.pref, store?.city, store?.address1, store?.address2].filter(Boolean).join(' '),
    '-'
  );
}

async function loadStoreInfo(storeId, clientId, token) {
  if (!storeId && !clientId) return null;
  const headers = token ? { Authorization: token } : {};
  if (storeId) {
    const res = await fetch(`${API_BASE}/stores/${encodeURIComponent(storeId)}`, { headers });
    if (res.ok) return res.json();
  }
  if (clientId) {
    const res = await fetch(`${API_BASE}/clients/${encodeURIComponent(clientId)}`, { headers });
    if (res.ok) return res.json();
  }
  return null;
}

async function loadKarteData() {
  const storeId = pickFirst(
    getQueryParam('store_id'),
    getQueryParam('storeId'),
    getQueryParam('id')
  );
  const clientId = pickFirst(
    getQueryParam('client_id'),
    getQueryParam('clientId')
  );

  const token = getAuthToken();
  const headers = token ? { Authorization: token } : {};

  setText('karte-id', storeId || clientId || '-');

  const store = await loadStoreInfo(storeId, clientId, token).catch(() => null);
  if (store) {
    setText('store-name', pickFirst(store.name, store.store_name, store.shop_name, store.brand_name));
    setText('store-type', pickFirst(store.type, store.business_type, store.category, '飲食店'));
    setText('store-address', formatAddress(store));
    setText('store-manager', pickFirst(store.contact_person, store.manager_name, store.owner_name, '-'));
    setText('store-contact', pickFirst(store.phone, store.tel, store.email, '-'));
    setPhoto(pickFirst(store.photoUrl, store.photo_url, store.imageUrl, store.image_url));
  }

  if (!storeId && !clientId) {
    renderTimeline([]);
    renderVitals(null);
    return;
  }

  const query = new URLSearchParams();
  if (storeId) query.set('store_id', storeId);
  if (clientId) query.set('client_id', clientId);

  const response = await fetch(`${API_BASE}/kartes?${query.toString()}`, { headers });
  if (!response.ok) {
    renderTimeline([]);
    renderVitals(null);
    setStatusPill('要確認', 'alert');
    return;
  }

  const data = await response.json().catch(() => ({}));
  const items = Array.isArray(data) ? data : (data.items || data.kartes || []);
  const sorted = items.slice().sort((a, b) => {
    const aDate = new Date(pickFirst(a.created_at, a.updated_at) || 0).getTime();
    const bDate = new Date(pickFirst(b.created_at, b.updated_at) || 0).getTime();
    return bDate - aDate;
  });

  renderTimeline(sorted);
  renderVitals(sorted[0]);

  if (sorted.length > 0) {
    setStatusPill('診断済み', 'ok');
  } else {
    setStatusPill('未診断', 'warn');
  }
}

function initKarte() {
  const editLink = document.getElementById('karte-edit-link');
  if (editLink) {
    const storeId = new URLSearchParams(window.location.search).get('store_id');
    if (storeId) {
      editLink.href = `/admin/customers/stores/${encodeURIComponent(storeId)}/chart.html`;
    }
  }

  const createBtn = document.getElementById('karte-create-btn');
  if (createBtn) {
    const storeId = new URLSearchParams(window.location.search).get('store_id');
    if (storeId) {
      createBtn.href = `/admin/customers/stores/${encodeURIComponent(storeId)}/chart.html`;
    }
  }

  const refresh = document.getElementById('karte-refresh');
  if (refresh) {
    refresh.addEventListener('click', () => loadKarteData());
  }
  loadKarteData();
}

document.addEventListener('DOMContentLoaded', initKarte);
