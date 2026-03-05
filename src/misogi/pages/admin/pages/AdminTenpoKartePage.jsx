import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
// Hamburger / admin-top are provided by GlobalNav.
import './admin-tenpo-karte.css';
import { normalizeGatewayBase, YOTEI_GATEWAY } from '../../shared/api/gatewayBase';

function isLocalUiHost() {
  if (typeof window === 'undefined') return false;
  const h = window.location?.hostname || '';
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
}

const MASTER_API_BASE =
  (import.meta.env?.DEV || isLocalUiHost())
    ? '/api-master'
    : (import.meta.env?.VITE_MASTER_API_BASE || 'https://jtn6in2iuj.execute-api.ap-northeast-1.amazonaws.com/prod');

const JINZAI_API_BASE =
  (import.meta.env?.DEV || isLocalUiHost())
    ? '/api-jinzai'
    : (import.meta.env?.VITE_JINZAI_API_BASE || 'https://ho3cd7ibtl.execute-api.ap-northeast-1.amazonaws.com/prod');

const YAKUSOKU_API_BASE =
  (import.meta.env?.DEV || isLocalUiHost())
    ? '/api'
    : normalizeGatewayBase(import.meta.env?.VITE_YAKUSOKU_API_BASE, YOTEI_GATEWAY);

const YAKUSOKU_FALLBACK_BASE =
  (import.meta.env?.DEV || isLocalUiHost())
    ? '/api2'
    : normalizeGatewayBase(import.meta.env?.VITE_YAKUSOKU_API_FALLBACK_BASE, YAKUSOKU_API_BASE);

const KARTE_VIEW = {
  SUMMARY: 'summary',
  DETAIL: 'detail',
};

// v1: 旧カルテ（OfficeClientKartePanel）の項目を、管理オペ用に再構築して tenpo.karte_detail に保持する。
// フィールドスタッフ入力ではないため、自由記述は最小限（短文・限定運用）にする。
const KARTE_DETAIL_VERSION = 2;

const HACCP_STATUS = {
  MIKANRYO: 'mikanryo',
  KAKUNIN_ZUMI: 'kakunin_zumi',
  GAITOU_NASHI: 'gaitou_nashi',
};

const HACCP_GROUPS = [
  {
    title: '衛生・清掃',
    items: [
      { code: 'haccp_seisou_keikaku', label: '清掃計画（手順/頻度）がある' },
      { code: 'haccp_seisou_kiroku', label: '清掃の記録が残せる運用になっている' },
      { code: 'haccp_tebori', label: '手洗い/消毒の導線が整っている' },
      { code: 'haccp_sanitation_tools', label: '清掃用具の保管場所が区別されている' },
    ],
  },
  {
    title: '温度・保管',
    items: [
      { code: 'haccp_temp_fridge', label: '冷蔵/冷凍の温度管理を行っている' },
      { code: 'haccp_storage_separation', label: '生/加熱後/アレルゲンの区別がある' },
    ],
  },
  {
    title: '害虫・異物',
    items: [
      { code: 'haccp_pest_control', label: '害虫対策（点検/駆除）の記録がある' },
      { code: 'haccp_foreign_object', label: '異物混入防止（清掃/点検/ルール）がある' },
    ],
  },
  {
    title: '廃棄物・排水',
    items: [
      { code: 'haccp_garbage', label: '廃棄物の分別/保管がルール化されている' },
      { code: 'haccp_drainage', label: '排水/グリストラップの管理計画がある' },
    ],
  },
];

const EQUIPMENT_OPTIONS = [
  { code: 'aircon', label: '空調' },
  { code: 'duct', label: 'ダクト' },
  { code: 'hood', label: 'レンジフード' },
  { code: 'grease', label: 'グリストラップ' },
  { code: 'floor', label: '床' },
  { code: 'drainage', label: '排水溝' },
  { code: 'toilet', label: 'トイレ' },
  { code: 'window', label: '窓・ガラス' },
];

const STAFF_ROOM_OPTIONS = [
  { value: 'ari', label: 'あり' },
  { value: 'nashi', label: 'なし' },
  { value: 'fumei', label: '不明' },
];

const CUSTOMER_ATTENDANCE_OPTIONS = [
  { value: 'ari', label: 'あり' },
  { value: 'nashi', label: 'なし' },
  { value: 'fumei', label: '不明' },
];

const PLAN_FREQUENCY_OPTIONS = [
  { value: 'monthly', label: '毎月' },
  { value: 'bimonthly', label: '隔月' },
  { value: 'q3', label: '3ヶ月' },
  { value: 'q6', label: '6ヶ月' },
  { value: 'yearly', label: '年1' },
  { value: 'spot', label: 'スポット' },
  { value: 'undecided', label: '未定' },
];

const SERVICE_CYCLE_OPTIONS = [
  { value: 'monthly', label: '毎月' },
  { value: 'bimonthly', label: '隔月' },
  { value: 'quarterly', label: '四半期' },
  { value: 'half_yearly', label: '半年' },
  { value: 'yearly', label: '年1' },
  { value: 'spot', label: 'スポット' },
];

const MONTH_OPTIONS = [
  { value: 1, label: '1月' },
  { value: 2, label: '2月' },
  { value: 3, label: '3月' },
  { value: 4, label: '4月' },
  { value: 5, label: '5月' },
  { value: 6, label: '6月' },
  { value: 7, label: '7月' },
  { value: 8, label: '8月' },
  { value: 9, label: '9月' },
  { value: 10, label: '10月' },
  { value: 11, label: '11月' },
  { value: 12, label: '12月' },
];

const BASIC_INFO_PROFILE_KEYS = [
  'name',
  'address',
  'phone',
  'url',
  'business_hours',
  'customer_attendance',
  'key_handling',
  'contact_method',
  'security_info',
  'customer_contact_name',
  'customer_contact_phone',
  'sales_owner',
];

function normalizeBasicInfoProfile(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const attendance = String(src.customer_attendance || '').trim();
  return {
    name: clampStr(src.name || '', 120),
    address: clampStr(src.address || '', 200),
    phone: clampStr(src.phone || '', 40),
    url: clampStr(src.url || '', 200),
    business_hours: clampStr(src.business_hours || '', 80),
    customer_attendance: CUSTOMER_ATTENDANCE_OPTIONS.some((o) => o.value === attendance) ? attendance : '',
    key_handling: clampStr(src.key_handling || '', 120),
    contact_method: clampStr(src.contact_method || '', 80),
    security_info: clampStr(src.security_info || '', 120),
    customer_contact_name: clampStr(src.customer_contact_name || '', 80),
    customer_contact_phone: clampStr(src.customer_contact_phone || '', 40),
    sales_owner: clampStr(src.sales_owner || '', 80),
  };
}

function extractBasicInfoProfileFromTenpoRecord(tp) {
  const spec = tp?.karte_detail?.spec || {};
  return normalizeBasicInfoProfile({
    name: tp?.name || '',
    address: tp?.address || '',
    phone: tp?.phone || '',
    url: tp?.url || '',
    business_hours: spec?.business_hours || tp?.business_hours || tp?.eigyou_jikan || '',
    customer_attendance: spec?.customer_attendance || '',
    key_handling: spec?.key_handling || tp?.key_handling || '',
    contact_method: spec?.contact_method || tp?.contact_method || '',
    security_info: spec?.security_info || tp?.security_info || '',
    customer_contact_name: spec?.customer_contact_name || tp?.contact_name || tp?.contact_person || tp?.tantou_name || '',
    customer_contact_phone: spec?.customer_contact_phone || tp?.tantou_phone || tp?.contact_person_phone || tp?.contact_phone || '',
    sales_owner: spec?.sales_owner || '',
  });
}

function isBlankValue(v) {
  return String(v || '').trim() === '';
}

function mergeBasicInfoProfile(baseProfile, overlayProfile) {
  const base = normalizeBasicInfoProfile(baseProfile);
  const overlay = normalizeBasicInfoProfile(overlayProfile);
  const next = { ...base };
  BASIC_INFO_PROFILE_KEYS.forEach((k) => {
    if (!isBlankValue(overlay[k])) next[k] = overlay[k];
  });
  return normalizeBasicInfoProfile(next);
}

function resolveBasicInfoByHierarchy(storeProfile, yagouSharedProfile, toriSharedProfile) {
  const byTori = mergeBasicInfoProfile(storeProfile, toriSharedProfile);
  return mergeBasicInfoProfile(byTori, yagouSharedProfile);
}

function isBasicInfoProfileEmpty(profile) {
  const p = normalizeBasicInfoProfile(profile);
  return BASIC_INFO_PROFILE_KEYS.every((k) => isBlankValue(p[k]));
}

function monthLabel(month) {
  const m = Number(month);
  if (!m || m < 1 || m > 12) return '';
  return `${m}月`;
}

function formatMonthSummary(months) {
  const arr = (Array.isArray(months) ? months : [])
    .map((m) => Number(m))
    .filter((m) => Number.isFinite(m) && m >= 1 && m <= 12);
  const uniq = Array.from(new Set(arr)).sort((a, b) => a - b);
  if (uniq.length === 0) return '未設定';
  return uniq.map(monthLabel).join('・');
}

function normalizeMonths(months) {
  const arr = (Array.isArray(months) ? months : [])
    .map((m) => Number(m))
    .filter((m) => Number.isFinite(m) && m >= 1 && m <= 12);
  return Array.from(new Set(arr)).sort((a, b) => a - b);
}

function parseMonthFromBucketKey(key) {
  const kk = String(key || '').trim();
  const m = kk.match(/_(?:m|month_)(\d{2})$/);
  if (!m) return null;
  const month = Number(m[1]);
  if (!Number.isFinite(month) || month < 1 || month > 12) return null;
  return month;
}

function parseMonthFromYmd(ymd) {
  const s = String(ymd || '').trim();
  const m = s.match(/^\d{4}-(\d{2})-\d{2}$/);
  if (!m) return null;
  const month = Number(m[1]);
  if (!Number.isFinite(month) || month < 1 || month > 12) return null;
  return month;
}

function pickYakusokuBucketKeys(y, tokens = []) {
  const tm = y?.recurrence_rule?.task_matrix;
  if (!tm || typeof tm !== 'object') return [];
  const tk = (Array.isArray(tokens) ? tokens : [])
    .map((v) => String(v || '').trim())
    .filter(Boolean);
  const hasToken = tk.length > 0;
  const picked = [];
  Object.entries(tm).forEach(([key, raw]) => {
    const arr = Array.isArray(raw) ? raw.map((v) => String(v || '').trim()).filter(Boolean) : [];
    if (arr.length <= 0) return;
    if (!hasToken || arr.some((v) => tk.includes(v))) picked.push(String(key || '').trim());
  });
  if (picked.length > 0 || !hasToken) return picked;
  // token指定で見つからない場合は、yakusoku全体の有効バケットを採用
  return pickYakusokuBucketKeys(y, []);
}

function deriveServiceCycleFromYakusokuBuckets(keys, y) {
  const arr = Array.isArray(keys) ? keys : [];
  if (String(y?.type || '').trim() !== 'teiki') return 'spot';
  if (arr.some((k) => k === 'yearly')) return 'yearly';
  if (arr.some((k) => k.startsWith('half_year_'))) return 'half_yearly';
  if (arr.some((k) => k.startsWith('quarterly_'))) return 'quarterly';
  if (arr.some((k) => k.startsWith('bimonthly_'))) return 'bimonthly';
  if (arr.some((k) => k === 'monthly')) return 'monthly';
  if (arr.some((k) => k.startsWith('weekly_') || k.startsWith('biweekly_') || k === 'daily')) return 'monthly';
  return 'monthly';
}

function derivePlanFrequencyFromYakusoku(y) {
  const keys = pickYakusokuBucketKeys(y, []);
  if (String(y?.type || '').trim() !== 'teiki') return 'spot';
  if (keys.some((k) => k === 'yearly')) return 'yearly';
  if (keys.some((k) => k.startsWith('half_year_'))) return 'q6';
  if (keys.some((k) => k.startsWith('quarterly_'))) return 'q3';
  if (keys.some((k) => k.startsWith('bimonthly_'))) return 'bimonthly';
  if (keys.some((k) => k === 'monthly' || k.startsWith('weekly_') || k.startsWith('biweekly_') || k === 'daily')) return 'monthly';
  return 'monthly';
}

function deriveMonthsFromYakusokuBuckets(keys, y) {
  const arr = Array.isArray(keys) ? keys : [];
  const directMonths = normalizeMonths(arr.map(parseMonthFromBucketKey).filter(Boolean));
  if (directMonths.length > 0) return directMonths;
  const cycle = deriveServiceCycleFromYakusokuBuckets(arr, y);
  if (cycle === 'spot') return [];
  const startMonth = parseMonthFromYmd(y?.start_date) || 1;
  if (cycle === 'monthly') return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  if (cycle === 'bimonthly') return normalizeMonths([startMonth, startMonth + 2, startMonth + 4, startMonth + 6, startMonth + 8, startMonth + 10].map((m) => ((m - 1) % 12) + 1));
  if (cycle === 'quarterly') return normalizeMonths([startMonth, startMonth + 3, startMonth + 6, startMonth + 9].map((m) => ((m - 1) % 12) + 1));
  if (cycle === 'half_yearly') return normalizeMonths([startMonth, ((startMonth + 5) % 12) + 1]);
  if (cycle === 'yearly') return [startMonth];
  return [];
}

function buildServicePlanFromYakusoku(y) {
  const ids = Array.isArray(y?.service_ids)
    ? y.service_ids.map((v) => String(v || '').trim()).filter(Boolean)
    : [];
  const names = Array.isArray(y?.service_names)
    ? y.service_names.map((v) => String(v || '').trim()).filter(Boolean)
    : [];
  const legacyId = String(y?.service_id || '').trim();
  const legacyName = String(y?.service_name || '').trim();
  if (!ids.length && legacyId) ids.push(legacyId);
  if (!names.length && legacyName) names.push(legacyName);

  const rowCount = Math.max(ids.length, names.length);
  const rows = [];
  for (let i = 0; i < rowCount; i += 1) {
    const service_id = ids[i] || '';
    const service_name = names[i] || service_id || names[0] || '';
    const bucketKeys = pickYakusokuBucketKeys(y, [service_id, service_name].filter(Boolean));
    const cycle = deriveServiceCycleFromYakusokuBuckets(bucketKeys, y);
    const months = deriveMonthsFromYakusokuBuckets(bucketKeys, y);
    rows.push({
      service_id,
      service_name,
      cycle,
      months,
      note: clampStr(`主契約同期(${String(y?.yakusoku_id || '').trim() || 'yakusoku'})`, 120),
    });
  }
  return rows.filter((r) => String(r?.service_id || '').trim() || String(r?.service_name || '').trim());
}

function findOptionLabel(options, value) {
  const vv = String(value || '').trim();
  if (!vv) return '';
  const hit = (Array.isArray(options) ? options : []).find((o) => String(o?.value || '') === vv);
  return String(hit?.label || vv);
}

function ServiceSearchSelect({ services, selectedId, onSelect }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  const selected = useMemo(() => {
    return (services || []).find((s) => String(s?.service_id || '') === String(selectedId || '')) || null;
  }, [services, selectedId]);

  const candidates = useMemo(() => {
    const qq = String(q || '').trim().toLowerCase();
    const list = Array.isArray(services) ? services : [];
    if (!qq) return [];
    const hits = list.filter((s) => {
      const id = String(s?.service_id || '').toLowerCase();
      const name = String(s?.name || '').toLowerCase();
      return id.includes(qq) || name.includes(qq);
    });
    return hits.slice(0, 30);
  }, [services, q]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      const t = e.target;
      if (!t) return;
      const root = t.closest?.('.service-search');
      if (!root) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="service-search">
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={selected?.name ? `選択中: ${selected.name}` : 'サービス名/IDで検索'}
        aria-label="サービス検索"
      />
      {open && candidates.length > 0 ? (
        <div className="service-search-pop">
          {candidates.map((s) => (
            <button
              key={String(s?.service_id || '')}
              type="button"
              className="service-search-item"
              onClick={() => {
                onSelect?.(String(s?.service_id || ''), String(s?.name || ''));
                setQ('');
                setOpen(false);
              }}
            >
              <span className="nm">{String(s?.name || s?.service_id || '')}</span>
              <span className="id">{String(s?.service_id || '')}</span>
            </button>
          ))}
        </div>
      ) : null}
      {selected?.name ? (
        <div className="service-search-selected">
          <span className="label">選択中</span>
          <span className="value">{selected.name}</span>
        </div>
      ) : null}
    </div>
  );
}

function ServicePlanRow({
  index,
  sp,
  services,
  onUpdate,
  onRemove,
  onToggleMonth,
}) {
  const [showMonths, setShowMonths] = useState(false);

  const selectedService = useMemo(() => {
    return (services || []).find((s) => String(s?.service_id || '') === String(sp?.service_id || '')) || null;
  }, [services, sp?.service_id]);

  const months = useMemo(() => normalizeMonths(sp?.months), [sp?.months]);
  const monthSummary = useMemo(() => formatMonthSummary(months), [months]);

  const preset = useCallback((m) => {
    onUpdate?.(index, { months: normalizeMonths(m) });
  }, [onUpdate, index]);

  return (
    <div className="service-plan-row">
      <div className="service-plan-head">
        <div className="service-plan-title">
          <span className="n">メニュー {index + 1}</span>
          <span className="s">対象月: {monthSummary}</span>
        </div>
        <div className="service-plan-actions">
          <button type="button" onClick={() => setShowMonths((v) => !v)}>
            {showMonths ? '月を閉じる' : '月を編集'}
          </button>
          <button type="button" onClick={() => onRemove?.(index)}>×</button>
        </div>
      </div>

      <div className="form-grid">
        <label className="f" style={{ gridColumn: '1 / -1' }}>
          <div className="lbl">サービス（検索）</div>
          <ServiceSearchSelect
            services={services}
            selectedId={String(sp?.service_id || '')}
            onSelect={(serviceId, serviceName) => onUpdate?.(index, { service_id: serviceId, service_name: serviceName })}
          />
        </label>
        <label className="f">
          <div className="lbl">周期</div>
          <select
            value={String(sp?.cycle || 'monthly')}
            onChange={(e) => onUpdate?.(index, { cycle: e.target.value })}
          >
            {SERVICE_CYCLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <label className="f">
          <div className="lbl">補足（任意）</div>
          <input
            value={String(sp?.note || '')}
            onChange={(e) => onUpdate?.(index, { note: clampStr(e.target.value, 120) })}
            placeholder="例: 9・11・1・3・5・7月実施"
          />
        </label>
      </div>

      <div className="muted small">
        {selectedService?.default_duration_min ? `標準時間: ${selectedService.default_duration_min}分` : '標準時間: -'}
        {selectedService?.default_price ? ` / 標準単価: ¥${Number(selectedService.default_price).toLocaleString()}` : ' / 標準単価: -'}
      </div>

      {showMonths ? (
        <div className="service-months">
          <div className="service-month-presets">
            <button type="button" onClick={() => preset([1,2,3,4,5,6,7,8,9,10,11,12])}>全月</button>
            <button type="button" onClick={() => preset([1,3,5,7,9,11])}>奇数月</button>
            <button type="button" onClick={() => preset([2,4,6,8,10,12])}>偶数月</button>
            <button type="button" onClick={() => preset([10,1,4,7])}>10/1/4/7</button>
            <button type="button" onClick={() => preset([11,2,5,8])}>11/2/5/8</button>
            <button type="button" onClick={() => preset([12,3,6,9])}>12/3/6/9</button>
            <button type="button" onClick={() => preset([])}>クリア</button>
          </div>
          <div className="month-chip-grid month-chip-grid-compact">
            {MONTH_OPTIONS.map((m) => (
              <button
                key={m.value}
                type="button"
                className={`month-chip ${months.includes(m.value) ? 'active' : ''}`}
                onClick={() => onToggleMonth?.(index, m.value)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const SUPPORT_HISTORY_CATEGORIES = [
  { value: 'ops', label: '運用' },
  { value: 'claim', label: 'クレーム' },
  { value: 'request', label: '要望' },
  { value: 'schedule', label: '日程' },
  { value: 'billing', label: '請求' },
  { value: 'other', label: 'その他' },
];

const SUPPORT_HISTORY_STATUS_OPTIONS = [
  { value: 'open', label: '対応中' },
  { value: 'waiting', label: '回答待ち' },
  { value: 'resolved', label: '完了' },
  { value: 'hold', label: '保留' },
];

const REPORT_FIELD_REQUIRED_OPTIONS = [
  { key: 'clock_in_out', label: '到着/開始/終了 打刻' },
  { key: 'work_items', label: '作業項目チェック' },
  { key: 'before_photo', label: '施工前写真' },
  { key: 'after_photo', label: '施工後写真' },
  { key: 'chemical_usage', label: '薬剤/資材 使用記録' },
  { key: 'anomaly_flag', label: '異常フラグ（破損/害虫/漏水）' },
];

const CUSTOMER_REPORT_REQUIRED_OPTIONS = [
  { key: 'scope_summary', label: '実施範囲サマリ' },
  { key: 'before_after_set', label: 'Before/After 写真' },
  { key: 'issue_summary', label: '異常/注意点' },
  { key: 'next_plan', label: '次回予定/引継ぎ' },
  { key: 'signoff', label: '確認者/署名' },
];

const REPORT_DUE_OPTIONS = [
  { value: 'same_day', label: '当日中' },
  { value: 'next_morning', label: '翌朝まで' },
  { value: 'next_day', label: '翌営業日' },
];

const CHEMICAL_UNIT_OPTIONS = [
  { value: 'ml', label: 'ml' },
  { value: 'l', label: 'L' },
  { value: 'g', label: 'g' },
  { value: 'kg', label: 'kg' },
  { value: 'sheet', label: '枚' },
  { value: 'other', label: 'その他' },
];

const SOUKO_DOC_CATEGORY_OPTIONS = [
  { value: 'estimate', label: '見積' },
  { value: 'contract', label: '契約書' },
  { value: 'invoice', label: '請求' },
  { value: 'report', label: '報告提出' },
  { value: 'photo', label: '写真' },
  { value: 'other', label: 'その他' },
];

function makeHistoryId() {
  return `HST#${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function makeSupportLogId() {
  return `LOG#${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function authHeaders() {
  const legacyAuth = (() => {
    try {
      return JSON.parse(localStorage.getItem('misesapo_auth') || '{}')?.token || '';
    } catch {
      return '';
    }
  })();
  const token =
    localStorage.getItem('idToken') ||
    localStorage.getItem('cognito_id_token') ||
    localStorage.getItem('id_token') ||
    localStorage.getItem('accessToken') ||
    localStorage.getItem('cognito_access_token') ||
    localStorage.getItem('token') ||
    legacyAuth ||
    '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch(path, init) {
  const base = MASTER_API_BASE.replace(/\/$/, '');
  return fetch(`${base}${path}`, { headers: authHeaders(), cache: 'no-store', ...(init || {}) });
}

async function yakusokuFetch(path, init) {
  const headers = { ...authHeaders(), ...(init?.headers || {}) };
  const primaryBase = YAKUSOKU_API_BASE.replace(/\/$/, '');
  const primaryRes = await fetch(`${primaryBase}${path}`, {
    cache: 'no-store',
    ...(init || {}),
    headers,
  });
  if (primaryRes.ok) return primaryRes;
  if (![401, 403, 404].includes(primaryRes.status)) return primaryRes;
  const fallbackBase = YAKUSOKU_FALLBACK_BASE.replace(/\/$/, '');
  if (fallbackBase === primaryBase) return primaryRes;
  return fetch(`${fallbackBase}${path}`, {
    cache: 'no-store',
    ...(init || {}),
    headers,
  });
}

async function jinzaiFetch(path, init) {
  const base = JINZAI_API_BASE.replace(/\/$/, '');
  return fetch(`${base}${path}`, { headers: authHeaders(), cache: 'no-store', ...(init || {}) });
}

async function apiGetJson(path) {
  const res = await apiFetch(path);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`MASTER HTTP ${res.status} ${text}`.trim());
    err.status = res.status;
    err.body = text;
    throw err;
  }
  return res.json();
}

async function apiPostJson(path, body) {
  const res = await apiFetch(path, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' }, // override default headers
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`MASTER HTTP ${res.status} ${text}`.trim());
  }
  return res.json();
}

async function apiPutJson(path, body) {
  const res = await apiFetch(path, {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' }, // override default headers
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`MASTER HTTP ${res.status} ${text}`.trim());
  }
  return res.json();
}

function asItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function pickId(x, key) {
  return x?.[key] || x?.id || '';
}

function safeArr(v) {
  if (Array.isArray(v)) return v;
  return [];
}

function nowIso() {
  return new Date().toISOString();
}

function fmtDateTimeJst(iso) {
  const s = String(iso || '').trim();
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  try {
    const dt = new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
    // "2026/02/16 06:15" or similar
    return dt.replace(/\u200e/g, '');
  } catch {
    // fallback: local time
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${dd} ${hh}:${mm}`;
  }
}

function todayDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function clampStr(v, max) {
  const s = String(v || '');
  if (!max) return s;
  return s.length > max ? s.slice(0, max) : s;
}

function toBool(v, fallback = false) {
  if (v === true || v === false) return v;
  const s = String(v || '').trim().toLowerCase();
  if (!s) return fallback;
  if (['1', 'true', 'yes', 'y', 'on'].includes(s)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(s)) return false;
  return fallback;
}

function normArr(v) {
  if (Array.isArray(v)) return v.filter(Boolean).map((x) => String(x).trim()).filter(Boolean);
  const s = String(v || '').trim();
  if (!s) return [];
  if (s.startsWith('[')) {
    try {
      const a = JSON.parse(s);
      return Array.isArray(a) ? a.filter(Boolean).map((x) => String(x).trim()).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [s];
}

function parseYmdToInt(ymd) {
  const s = String(ymd || '').trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return Number(`${m[1]}${m[2]}${m[3]}`);
}

function getKeiyakuStartDate(item) {
  return String(
    item?.start_date
    || item?.application_date
    || item?.keiyaku_start_date
    || ''
  ).trim();
}

function splitTags(s) {
  const raw = String(s || '').trim();
  if (!raw) return [];
  return raw
    .split(/[\/,、\n]+/g)
    .map((x) => String(x || '').trim())
    .filter(Boolean);
}

function uniqTags(arr, max = 8) {
  const out = [];
  const seen = new Set();
  (Array.isArray(arr) ? arr : []).forEach((x) => {
    const v = String(x || '').trim();
    if (!v) return;
    if (seen.has(v)) return;
    seen.add(v);
    out.push(v);
  });
  return out.slice(0, max);
}

function fileExt(fileName, key = '') {
  const base = String(fileName || key || '').trim();
  const i = base.lastIndexOf('.');
  if (i < 0) return '';
  return base.slice(i + 1).toLowerCase();
}

function isImageContentType(ct = '') {
  return String(ct || '').toLowerCase().startsWith('image/');
}

function isImageFile(fileName, contentType, key = '') {
  if (isImageContentType(contentType)) return true;
  const ext = fileExt(fileName, key);
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif', 'heic', 'heif'].includes(ext);
}

function fileKindLabel(fileName, contentType, key) {
  if (isImageFile(fileName, contentType, key)) return 'IMG';
  const ext = fileExt(fileName, key);
  if (ext === 'pdf') return 'PDF';
  if (['doc', 'docx'].includes(ext)) return 'DOC';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'SHEET';
  if (['zip', 'rar', '7z'].includes(ext)) return 'ZIP';
  if (['mp4', 'mov', 'avi'].includes(ext)) return 'VIDEO';
  return ext ? ext.toUpperCase() : 'FILE';
}

function sortSupportHistoryNewestFirst(list) {
  const arr = Array.isArray(list) ? list.slice() : [];
  const keyed = arr.map((it, idx) => {
    const key = parseYmdToInt(it?.date);
    return { it, idx, key: key == null ? -1 : key };
  });
  keyed.sort((a, b) => {
    // date desc, empty dates last
    if (a.key !== b.key) return b.key - a.key;
    return a.idx - b.idx;
  });
  return keyed.map((x) => x.it);
}

function uniqStaffMembers(arr, max = 8) {
  const out = [];
  const seen = new Set();
  (Array.isArray(arr) ? arr : []).forEach((m) => {
    const id = String(m?.jinzai_id || '').trim();
    const name = String(m?.name || '').trim();
    const k = id ? `id:${id}` : (name ? `nm:${name}` : '');
    if (!k) return;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ jinzai_id: id, name });
  });
  return out.slice(0, max);
}

function getCurrentUserName() {
  try {
    const u = JSON.parse(localStorage.getItem('cognito_user') || '{}') || {};
    return String(u?.name || u?.displayName || u?.username || u?.email || '').trim();
  } catch {
    return '';
  }
}

async function fetchOneByIdOrList({ collection, id, listQuery }) {
  if (!id) return null;
  try {
    // NOTE:
    // Some master APIs do not stably support /master/{collection}/{id}.
    // Query list first to avoid noisy 404 in browser console.
    const qs = new URLSearchParams({ limit: '2000', jotai: 'yuko', ...(listQuery || {}) }).toString();
    const res = await apiGetJson(`/master/${encodeURIComponent(collection)}?${qs}`);
    return asItems(res).find((it) => String(it?.[`${collection}_id`] || it?.id || '') === id) || null;
  } catch {
    return null;
  }
}

async function fetchTenpoByParentOrNull({ tenpoId, torihikisakiId, yagouId }) {
  if (!tenpoId || !torihikisakiId || !yagouId) return null;
  const list = await apiGetJson(
    `/master/tenpo?limit=5000&jotai=yuko&torihikisaki_id=${encodeURIComponent(
      torihikisakiId
    )}&yagou_id=${encodeURIComponent(yagouId)}`
  );
  return asItems(list).find((it) => String(it?.tenpo_id || it?.id || '') === tenpoId) || null;
}

async function fetchTenpoByGlobalScanOrNull(tenpoId) {
  if (!tenpoId) return null;
  const list = await apiGetJson('/master/tenpo?limit=20000&jotai=yuko');
  return asItems(list).find((it) => String(it?.tenpo_id || it?.id || '') === tenpoId) || null;
}

async function fetchTenpoDetail({ tenpoId, parentKeys }) {
  // Prefer parent-key query route to avoid /master/tenpo/{id} 404.
  if (parentKeys?.torihikisaki_id && parentKeys?.yagou_id) {
    const found = await fetchTenpoByParentOrNull({
      tenpoId,
      torihikisakiId: parentKeys.torihikisaki_id,
      yagouId: parentKeys.yagou_id,
    });
    if (found) return found;
  }

  // Fallback for direct URL open without parent query.
  const byGlobalScan = await fetchTenpoByGlobalScanOrNull(tenpoId);
  if (byGlobalScan) return byGlobalScan;

  // Last fallback if API supports id endpoint in some envs.
  try {
    return await apiGetJson(`/master/tenpo/${encodeURIComponent(tenpoId)}`);
  } catch {
    return null;
  }
}

export default function AdminTenpoKartePage() {
  const { tenpoId: tenpoIdParam } = useParams();
  const location = useLocation();

  const tenpoId = decodeURIComponent(String(tenpoIdParam || '')).trim();
  const pageMode = useMemo(() => {
    const sp = new URLSearchParams(location.search || '');
    return String(sp.get('mode') || '').trim().toLowerCase();
  }, [location.search]);
  const isMonshinMode = pageMode === 'monshin';
  const parentKeys = useMemo(() => {
    const sp = new URLSearchParams(location.search || '');
    return {
      torihikisaki_id: String(sp.get('torihikisaki_id') || '').trim(),
      yagou_id: String(sp.get('yagou_id') || '').trim(),
    };
  }, [location.search]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tenpo, setTenpo] = useState(null);
  const [torihikisaki, setTorihikisaki] = useState(null);
  const [yagou, setYagou] = useState(null);
  const [souko, setSouko] = useState(null); // 1 tenpo = 1 souko (運用想定)
  const [yakusokuItems, setYakusokuItems] = useState([]);
  const [yakusokuLoading, setYakusokuLoading] = useState(false);
  const [yakusokuError, setYakusokuError] = useState('');
  const [keiyakuCandidates, setKeiyakuCandidates] = useState([]);
  const [keiyakuLoading, setKeiyakuLoading] = useState(false);
  const [keiyakuError, setKeiyakuError] = useState('');
  const [isMobileLayout, setIsMobileLayout] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches
  ));
  const [karteView, setKarteView] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches
      ? KARTE_VIEW.DETAIL
      : KARTE_VIEW.SUMMARY
  ));

  // tenpo.karte_detail の編集ドラフト（master API PUTはmergeなので差分PUTで安全に保存できる）
  const [karteDetail, setKarteDetail] = useState(null);
  const [savingKarteDetail, setSavingKarteDetail] = useState(false);
  const [editingBasicInfo, setEditingBasicInfo] = useState(false);
  const [savingBasicInfo, setSavingBasicInfo] = useState(false);
  const [savingPrimaryYakusokuId, setSavingPrimaryYakusokuId] = useState('');
  const [basicInfoDraft, setBasicInfoDraft] = useState({
    name: '',
    address: '',
    phone: '',
    url: '',
    business_hours: '',
    customer_attendance: '',
    key_handling: '',
    contact_method: '',
    security_info: '',
    customer_contact_name: '',
    customer_contact_phone: '',
    sales_owner: '',
    torihikisaki_keiyaku_id: '',
    torihikisaki_keiyaku_name: '',
    torihikisaki_keiyaku_start_date: '',
  });
  const [peerTenpos, setPeerTenpos] = useState([]);
  const [selectedPeerTenpoId, setSelectedPeerTenpoId] = useState('');
  const [shareBusyScope, setShareBusyScope] = useState('');
  const [shareStatusMessage, setShareStatusMessage] = useState('');
  const [services, setServices] = useState([]);
  const [jinzais, setJinzais] = useState([]);

  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [lastUpload, setLastUpload] = useState(null);
  const [soukoView, setSoukoView] = useState('teishutsu'); // teishutsu|naibu|all
  const [uploadKubun, setUploadKubun] = useState('teishutsu'); // default for new upload
  const [uploadDocCategory, setUploadDocCategory] = useState('estimate');
  const [supportReplyInputs, setSupportReplyInputs] = useState({});

  const headerTitle = useMemo(() => {
    const tName = String(tenpo?.name || '').trim();
    const yName = String(yagou?.name || '').trim();
    if (yName && tName) return `${yName} / ${tName}`;
    if (tName) return tName;
    return tenpoId;
  }, [tenpo?.name, yagou?.name, tenpoId]);

  const directYoteiCreateLink = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set('create', '1');
    sp.set('from', 'tenpo_karte');
    sp.set('tenpo_id', String(tenpoId || '').trim());
    const tenpoName = String(tenpo?.name || '').trim();
    const yagouName = String(yagou?.name || '').trim();
    const torihikisakiName = String(torihikisaki?.name || '').trim();
    const torihikisakiId = String(tenpo?.torihikisaki_id || '').trim();
    const yagouId = String(tenpo?.yagou_id || '').trim();
    const primaryYakusokuId = String(karteDetail?.plan?.primary_yakusoku_id || '').trim();
    if (tenpoName) sp.set('tenpo_name', tenpoName);
    if (yagouName) sp.set('yagou_name', yagouName);
    if (torihikisakiName) sp.set('torihikisaki_name', torihikisakiName);
    if (torihikisakiId) sp.set('torihikisaki_id', torihikisakiId);
    if (yagouId) sp.set('yagou_id', yagouId);
    if (primaryYakusokuId) sp.set('yakusoku_id', primaryYakusokuId);
    return `/admin/yotei?${sp.toString()}`;
  }, [
    tenpoId,
    tenpo?.name,
    tenpo?.torihikisaki_id,
    tenpo?.yagou_id,
    torihikisaki?.name,
    yagou?.name,
    karteDetail?.plan?.primary_yakusoku_id,
  ]);

  const tenpoBasicInfoProfile = useMemo(() => (
    extractBasicInfoProfileFromTenpoRecord({
      ...(tenpo || {}),
      karte_detail: karteDetail && typeof karteDetail === 'object'
        ? karteDetail
        : (tenpo?.karte_detail || {}),
    })
  ), [tenpo, karteDetail]);

  const yagouSharedBasicInfoProfile = useMemo(() => (
    normalizeBasicInfoProfile(yagou?.shared_basic_profile || {})
  ), [yagou?.shared_basic_profile]);

  const toriSharedBasicInfoProfile = useMemo(() => (
    normalizeBasicInfoProfile(torihikisaki?.shared_basic_profile || {})
  ), [torihikisaki?.shared_basic_profile]);

  const resolvedBasicInfo = useMemo(() => (
    resolveBasicInfoByHierarchy(
      tenpoBasicInfoProfile,
      yagouSharedBasicInfoProfile,
      toriSharedBasicInfoProfile
    )
  ), [tenpoBasicInfoProfile, yagouSharedBasicInfoProfile, toriSharedBasicInfoProfile]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia('(max-width: 900px)');
    const sync = () => setIsMobileLayout(!!mq.matches);
    sync();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', sync);
      return () => mq.removeEventListener('change', sync);
    }
    mq.addListener(sync);
    return () => mq.removeListener(sync);
  }, []);

  useEffect(() => {
    if (!isMonshinMode) return;
    if (isMobileLayout) setKarteView(KARTE_VIEW.SUMMARY);
  }, [isMonshinMode, isMobileLayout]);

  const salesOwnerSummary = useMemo(() => {
    const rows = uniqTags([
      String(resolvedBasicInfo?.sales_owner || '').trim(),
    ], 4);
    return rows.join(' / ') || '—';
  }, [resolvedBasicInfo?.sales_owner]);

  const customerContactSummary = useMemo(() => {
    const rows = uniqTags([
      String(resolvedBasicInfo?.customer_contact_name || '').trim(),
    ], 4);
    return rows.join(' / ') || '—';
  }, [resolvedBasicInfo?.customer_contact_name]);

  const customerContactPhoneSummary = useMemo(() => {
    const rows = uniqTags([
      String(resolvedBasicInfo?.customer_contact_phone || '').trim(),
    ], 4);
    return rows.join(' / ') || '—';
  }, [resolvedBasicInfo?.customer_contact_phone]);

  const keiyakuById = useMemo(() => {
    const m = new Map();
    (Array.isArray(keiyakuCandidates) ? keiyakuCandidates : []).forEach((c) => {
      const id = String(c?.keiyaku_id || '').trim();
      if (!id) return;
      m.set(id, c);
    });
    return m;
  }, [keiyakuCandidates]);

  const keiyakuRowsForTorihikisaki = useMemo(() => {
    const rows = Array.isArray(keiyakuCandidates) ? keiyakuCandidates.slice() : [];
    const currentId = String(
      (editingBasicInfo ? basicInfoDraft?.torihikisaki_keiyaku_id : '')
      || torihikisaki?.keiyaku_id
      || ''
    ).trim();
    if (currentId && !rows.some((r) => String(r?.keiyaku_id || '').trim() === currentId)) {
      rows.unshift({
        keiyaku_id: currentId,
        name: String(
          (editingBasicInfo ? basicInfoDraft?.torihikisaki_keiyaku_name : '')
          || torihikisaki?.keiyaku_name
          || currentId
        ).trim(),
        start_date: String(
          (editingBasicInfo ? basicInfoDraft?.torihikisaki_keiyaku_start_date : '')
          || torihikisaki?.keiyaku_start_date
          || ''
        ).trim(),
        _stale: true,
      });
    }
    return rows;
  }, [
    keiyakuCandidates,
    editingBasicInfo,
    basicInfoDraft?.torihikisaki_keiyaku_id,
    basicInfoDraft?.torihikisaki_keiyaku_name,
    basicInfoDraft?.torihikisaki_keiyaku_start_date,
    torihikisaki?.keiyaku_id,
    torihikisaki?.keiyaku_name,
    torihikisaki?.keiyaku_start_date,
  ]);

  const servicePlanFrequencyLabel = useMemo(() => (
    findOptionLabel(PLAN_FREQUENCY_OPTIONS, String(karteDetail?.plan?.plan_frequency || '').trim())
  ), [karteDetail?.plan?.plan_frequency]);

  const servicePlanCycleGroups = useMemo(() => {
    const rows = Array.isArray(karteDetail?.service_plan) ? karteDetail.service_plan : [];
    const cycleOrder = new Map(SERVICE_CYCLE_OPTIONS.map((o, i) => [String(o.value || ''), i]));
    const byCycle = new Map();
    rows.forEach((sp) => {
      const cycleValue = String(sp?.cycle || '').trim() || 'monthly';
      const cycleLabel = findOptionLabel(SERVICE_CYCLE_OPTIONS, cycleValue) || cycleValue || '未設定';
      const serviceLabel = String(sp?.service_name || sp?.service_id || '').trim();
      if (!serviceLabel) return;
      if (!byCycle.has(cycleValue)) {
        byCycle.set(cycleValue, {
          cycleValue,
          cycleLabel,
          services: [],
        });
      }
      const row = byCycle.get(cycleValue);
      if (!row.services.includes(serviceLabel)) row.services.push(serviceLabel);
    });
    return Array.from(byCycle.values()).sort((a, b) => {
      const ai = cycleOrder.has(a.cycleValue) ? cycleOrder.get(a.cycleValue) : 999;
      const bi = cycleOrder.has(b.cycleValue) ? cycleOrder.get(b.cycleValue) : 999;
      if (ai !== bi) return ai - bi;
      return String(a.cycleLabel || '').localeCompare(String(b.cycleLabel || ''), 'ja');
    });
  }, [karteDetail?.service_plan]);

  const getYakusokuServiceSummary = useCallback((y) => {
    const names = Array.isArray(y?.service_names)
      ? y.service_names.map((v) => String(v || '').trim()).filter(Boolean)
      : [];
    const ids = Array.isArray(y?.service_ids)
      ? y.service_ids.map((v) => String(v || '').trim()).filter(Boolean)
      : [];
    const primary = names[0] || String(y?.service_name || '').trim() || ids[0] || String(y?.service_id || '').trim();
    const total = Math.max(names.length, ids.length, primary ? 1 : 0);
    if (!primary) return '未設定';
    if (total <= 1) return primary;
    return `${primary} +${total - 1}件`;
  }, []);

  const primaryYakusokuId = useMemo(() => (
    String(karteDetail?.plan?.primary_yakusoku_id || '').trim()
  ), [karteDetail?.plan?.primary_yakusoku_id]);

  const yakusokuActiveItems = useMemo(() => (
    (Array.isArray(yakusokuItems) ? yakusokuItems : []).filter((y) => String(y?.status || '').trim() !== 'inactive')
  ), [yakusokuItems]);

  const primaryYakusoku = useMemo(() => {
    if (primaryYakusokuId) {
      const hit = (Array.isArray(yakusokuItems) ? yakusokuItems : []).find(
        (y) => String(y?.yakusoku_id || y?.id || '').trim() === primaryYakusokuId
      );
      if (hit) return hit;
    }
    return yakusokuActiveItems[0] || (Array.isArray(yakusokuItems) ? yakusokuItems[0] : null) || null;
  }, [primaryYakusokuId, yakusokuItems, yakusokuActiveItems]);

  const yakusokuSummary = useMemo(() => {
    if (!primaryYakusoku) return '—';
    const start = String(primaryYakusoku?.start_date || '').trim() || '未設定';
    const status = String(primaryYakusoku?.status || '').trim() || 'active';
    const cycle = String(primaryYakusoku?.type || '').trim() === 'teiki'
      ? `定期/${Number(primaryYakusoku?.monthly_quota || 0) || '-'}回`
      : '単発';
    return `${start} / ${cycle} / ${status}`;
  }, [primaryYakusoku]);

  const monshinChecklist = useMemo(() => {
    const contactPhone = String(resolvedBasicInfo?.customer_contact_phone || '').trim();
    const keyHandling = String(resolvedBasicInfo?.key_handling || '').trim();
    const businessHours = String(resolvedBasicInfo?.business_hours || '').trim();
    const attendance = String(resolvedBasicInfo?.customer_attendance || '').trim();
    const salesOwner = String(resolvedBasicInfo?.sales_owner || '').trim();
    const hasYakusoku = Boolean(primaryYakusoku?.yakusoku_id) || yakusokuActiveItems.length > 0;
    const serviceSummary = getYakusokuServiceSummary(primaryYakusoku);
    const hasService = !!(hasYakusoku && serviceSummary && serviceSummary !== '未設定');
    const reportProfile = (karteDetail && typeof karteDetail === 'object' ? karteDetail.report_profile : {}) || {};
    const fieldRequiredCount = Object.values(reportProfile?.field_required || {}).filter(Boolean).length;
    const customerRequiredCount = Object.values(reportProfile?.customer_required || {}).filter(Boolean).length;

    const rows = [
      { key: 'customer_contact_phone', label: '担当者連絡先', ok: !!contactPhone },
      { key: 'key_handling', label: '鍵の扱い', ok: !!keyHandling },
      { key: 'business_hours', label: '営業時間', ok: !!businessHours },
      { key: 'customer_attendance', label: 'お客様立会い', ok: !!attendance },
      { key: 'sales_owner', label: '営業担当', ok: !!salesOwner },
      { key: 'yakusoku', label: '契約（yakusoku）', ok: hasYakusoku },
      { key: 'service', label: '契約サービス', ok: hasService },
      { key: 'report_field_required', label: '現場必須報告設計', ok: fieldRequiredCount > 0 },
      { key: 'report_customer_required', label: '顧客提出設計', ok: customerRequiredCount > 0 },
    ];

    const total = rows.length;
    const completed = rows.filter((r) => r.ok).length;
    const missing = rows.filter((r) => !r.ok);
    const ratio = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { rows, total, completed, missing, ratio };
  }, [
    resolvedBasicInfo?.customer_contact_phone,
    resolvedBasicInfo?.key_handling,
    resolvedBasicInfo?.business_hours,
    resolvedBasicInfo?.customer_attendance,
    resolvedBasicInfo?.sales_owner,
    primaryYakusoku,
    yakusokuActiveItems.length,
    getYakusokuServiceSummary,
    karteDetail,
  ]);

  const buildBasicInfoDraft = useCallback(() => ({
    ...resolvedBasicInfo,
    torihikisaki_keiyaku_id: String(torihikisaki?.keiyaku_id || '').trim(),
    torihikisaki_keiyaku_name: String(torihikisaki?.keiyaku_name || '').trim(),
    torihikisaki_keiyaku_start_date: String(torihikisaki?.keiyaku_start_date || '').trim(),
  }), [
    resolvedBasicInfo,
    torihikisaki?.keiyaku_id,
    torihikisaki?.keiyaku_name,
    torihikisaki?.keiyaku_start_date,
  ]);

  useEffect(() => {
    if (editingBasicInfo) return;
    setBasicInfoDraft(buildBasicInfoDraft());
  }, [editingBasicInfo, buildBasicInfoDraft]);

  const onBasicInfoField = useCallback((key, value) => {
    setBasicInfoDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const files = useMemo(() => {
    const arr = safeArr(souko?.files);
    return arr
      .map((it) => {
        const previewUrl = String(it?.preview_url || '').trim();
        const getUrl = String(it?.get_url || it?.url || '').trim();
        return {
          key: String(it?.key || '').trim(),
          file_name: String(it?.file_name || '').trim(),
          content_type: String(it?.content_type || '').trim(),
          size: Number(it?.size || 0) || 0,
          uploaded_at: String(it?.uploaded_at || '').trim(),
          kubun: String(it?.kubun || '').trim(), // teishutsu|naibu|'' (legacy)
          doc_category: String(it?.doc_category || '').trim(), // estimate|contract|invoice|report|photo|other
          preview_url: previewUrl,
          get_url: getUrl,
          open_url: previewUrl || getUrl,
        };
      })
      .filter((it) => it.key);
  }, [souko]);

  const filesByKubun = useMemo(() => {
    // legacy: kubun無しは安全側で「内部」扱い
    const teishutsu = [];
    const naibu = [];
    files.forEach((f) => {
      if (f.kubun === 'teishutsu') teishutsu.push(f);
      else naibu.push(f);
    });
    return { teishutsu, naibu };
  }, [files]);

  const visibleFiles = useMemo(() => {
    if (soukoView === 'teishutsu') return filesByKubun.teishutsu;
    if (soukoView === 'naibu') return filesByKubun.naibu;
    return files;
  }, [soukoView, files, filesByKubun]);

  useEffect(() => {
    if (!tenpo) return;
    setKarteDetail((prev) => (prev === null ? (tenpo?.karte_detail || {}) : prev));
  }, [tenpo]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiGetJson('/master/service?limit=2000&jotai=yuko');
        if (!cancelled) setServices(asItems(res));
      } catch {
        if (!cancelled) setServices([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const toriId = String(tenpo?.torihikisaki_id || '').trim();
      const yagouId = String(tenpo?.yagou_id || '').trim();
      if (!toriId || !yagouId) {
        setPeerTenpos([]);
        setSelectedPeerTenpoId('');
        return;
      }
      try {
        const res = await apiGetJson(
          `/master/tenpo?limit=5000&jotai=yuko&torihikisaki_id=${encodeURIComponent(toriId)}&yagou_id=${encodeURIComponent(yagouId)}`
        );
        const peers = asItems(res)
          .filter((it) => String(it?.tenpo_id || it?.id || '') && String(it?.tenpo_id || it?.id || '') !== tenpoId)
          .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'ja'));
        if (cancelled) return;
        setPeerTenpos(peers);
        setSelectedPeerTenpoId((prev) => {
          if (prev && peers.some((it) => String(it?.tenpo_id || it?.id || '') === prev)) return prev;
          return String(peers?.[0]?.tenpo_id || peers?.[0]?.id || '');
        });
      } catch {
        if (!cancelled) {
          setPeerTenpos([]);
          setSelectedPeerTenpoId('');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenpo?.torihikisaki_id, tenpo?.yagou_id, tenpoId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await jinzaiFetch('/jinzai?limit=2000&jotai=yuko');
        if (!res.ok) throw new Error(`JINZAI HTTP ${res.status}`);
        const data = await res.json();
        const items = asItems(data)
          .map((it) => ({
            jinzai_id: String(it?.jinzai_id || it?.id || '').trim(),
            name: String(it?.name || '').trim(),
            email: String(it?.email || '').trim(),
            phone: String(it?.phone || '').trim(),
            jotai: String(it?.jotai || '').trim(),
            shokushu: normArr(it?.shokushu).map((v) => String(v).trim().toLowerCase()),
          }))
          .filter((it) => {
            if (!it.jinzai_id || !it.name) return false;
            // 担当履歴/対応履歴に出す候補は、清掃/メンテのみ
            const ss = Array.isArray(it.shokushu) ? it.shokushu : [];
            return ss.includes('seisou') || ss.includes('maintenance') || ss.includes('cleaning');
          })
          .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ja'));
        if (!cancelled) setJinzais(items);
      } catch {
        if (!cancelled) setJinzais([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!tenpoId) return;
    setLoading(true);
    setError('');
    setYakusokuLoading(true);
    setYakusokuError('');
    try {
      const tp = await fetchTenpoDetail({ tenpoId, parentKeys });
      if (!tp) {
        const err = new Error(`tenpo not found: ${tenpoId}`);
        err.status = 404;
        throw err;
      }

      setTenpo(tp || null);

      const toriId = tp?.torihikisaki_id;
      const yagouId = tp?.yagou_id;
      const [tori, yg] = await Promise.all([
        fetchOneByIdOrList({
          collection: 'torihikisaki',
          id: toriId,
          // torihikisaki はフィルタ条件が不要（IDは全体でユニーク前提）
          listQuery: {},
        }),
        fetchOneByIdOrList({
          collection: 'yagou',
          id: yagouId,
          // yagou は親で絞れるなら絞る（scan負荷と誤一致を下げる）
          listQuery: toriId ? { torihikisaki_id: toriId } : {},
        }),
      ]);
      setTorihikisaki(tori);
      setYagou(yg);

      const soukoRes = await apiGetJson(
        `/master/souko?limit=20&jotai=yuko&tenpo_id=${encodeURIComponent(tenpoId)}`
      );
      const found = asItems(soukoRes)?.[0] || null;
      setSouko(found);

      try {
        const yRes = await yakusokuFetch('/yakusoku?limit=5000');
        if (!yRes.ok) {
          const txt = await yRes.text().catch(() => '');
          throw new Error(`yakusoku HTTP ${yRes.status} ${txt}`.trim());
        }
        const yData = await yRes.json();
        const normalized = asItems(yData)
          .map((it) => {
            const ids = Array.isArray(it?.service_ids)
              ? it.service_ids.map((v) => String(v || '').trim()).filter(Boolean)
              : [];
            const names = Array.isArray(it?.service_names)
              ? it.service_names.map((v) => String(v || '').trim()).filter(Boolean)
              : [];
            if (!ids.length && String(it?.service_id || '').trim()) ids.push(String(it.service_id).trim());
            if (!names.length && String(it?.service_name || '').trim()) names.push(String(it.service_name).trim());
            return {
              ...it,
              yakusoku_id: String(it?.yakusoku_id || it?.id || '').trim(),
              tenpo_id: String(it?.tenpo_id || '').trim(),
              start_date: String(it?.start_date || '').trim(),
              status: String(it?.status || 'active').trim() || 'active',
              type: String(it?.type || 'teiki').trim() || 'teiki',
              monthly_quota: Number(it?.monthly_quota || 0) || 0,
              price: Number(it?.price || 0) || 0,
              service_ids: ids,
              service_names: names,
            };
          })
          .filter((it) => it.yakusoku_id && it.tenpo_id === tenpoId)
          .sort((a, b) => {
            const aState = a.status === 'active' ? 0 : 1;
            const bState = b.status === 'active' ? 0 : 1;
            if (aState !== bState) return aState - bState;
            const ad = parseYmdToInt(a.start_date) || -1;
            const bd = parseYmdToInt(b.start_date) || -1;
            return bd - ad;
          });
        setYakusokuItems(normalized);
        setYakusokuError('');
      } catch (ye) {
        setYakusokuItems([]);
        setYakusokuError(ye?.message || 'yakusokuの取得に失敗しました');
      }
    } catch (e) {
      const isNotFound = Number(e?.status) === 404 || String(e?.message || '').includes('HTTP 404');
      if (isNotFound) {
        setError(
          `店舗が見つかりません: ${tenpoId}\n取引先名簿（/admin/torihikisaki-meibo）から開き直してください。`
        );
      } else {
        setError(e?.message || '読み込みに失敗しました');
      }
    } finally {
      setYakusokuLoading(false);
      setLoading(false);
    }
  }, [tenpoId, parentKeys.torihikisaki_id, parentKeys.yagou_id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const toriId = String(tenpo?.torihikisaki_id || '').trim();
      if (!toriId) {
        setKeiyakuCandidates([]);
        setKeiyakuError('');
        setKeiyakuLoading(false);
        return;
      }
      setKeiyakuLoading(true);
      setKeiyakuError('');
      try {
        const qs = new URLSearchParams();
        qs.set('limit', '5000');
        qs.set('jotai', 'yuko');
        qs.set('torihikisaki_id', toriId);
        const res = await apiGetJson(`/master/keiyaku?${qs.toString()}`);
        const rows = asItems(res)
          .map((it) => ({
            ...it,
            keiyaku_id: String(it?.keiyaku_id || it?.id || '').trim(),
            name: String(it?.name || '').trim(),
            start_date: getKeiyakuStartDate(it),
          }))
          .filter((it) => it.keiyaku_id)
          .sort((a, b) => {
            const ad = parseYmdToInt(a.start_date) || -1;
            const bd = parseYmdToInt(b.start_date) || -1;
            if (ad !== bd) return bd - ad;
            return String(a.name || '').localeCompare(String(b.name || ''), 'ja');
          });
        if (!cancelled) setKeiyakuCandidates(rows);
      } catch (e) {
        if (!cancelled) {
          setKeiyakuCandidates([]);
          setKeiyakuError(e?.message || 'keiyakuの取得に失敗しました');
        }
      } finally {
        if (!cancelled) setKeiyakuLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenpo?.torihikisaki_id]);

  const applyBasicInfoToDraft = useCallback((profile, withEdit = true) => {
    const normalized = normalizeBasicInfoProfile(profile);
    setBasicInfoDraft((prev) => {
      const merged = mergeBasicInfoProfile(prev, normalized);
      const fallbackId = String(torihikisaki?.keiyaku_id || '').trim();
      const fallbackName = String(torihikisaki?.keiyaku_name || '').trim();
      const fallbackStart = String(torihikisaki?.keiyaku_start_date || '').trim();
      return {
        ...merged,
        torihikisaki_keiyaku_id: String(prev?.torihikisaki_keiyaku_id || fallbackId).trim(),
        torihikisaki_keiyaku_name: String(prev?.torihikisaki_keiyaku_name || fallbackName).trim(),
        torihikisaki_keiyaku_start_date: String(prev?.torihikisaki_keiyaku_start_date || fallbackStart).trim(),
      };
    });
    if (withEdit) setEditingBasicInfo(true);
  }, [torihikisaki?.keiyaku_id, torihikisaki?.keiyaku_name, torihikisaki?.keiyaku_start_date]);

  const copyBasicInfoFromPeer = useCallback(async () => {
    const sourceId = String(selectedPeerTenpoId || '').trim();
    if (!sourceId) {
      window.alert('コピー元店舗を選択してください');
      return;
    }
    setShareBusyScope('copy');
    setShareStatusMessage('');
    try {
      const found = await fetchTenpoDetail({
        tenpoId: sourceId,
        parentKeys: {
          torihikisaki_id: String(tenpo?.torihikisaki_id || '').trim(),
          yagou_id: String(tenpo?.yagou_id || '').trim(),
        },
      });
      if (!found) throw new Error('コピー元店舗の取得に失敗しました');
      applyBasicInfoToDraft(extractBasicInfoProfileFromTenpoRecord(found), true);
      const nm = String(found?.name || sourceId);
      setShareStatusMessage(`コピー元: ${nm}`);
    } catch (e) {
      setError(e?.message || '他店舗からのコピーに失敗しました');
    } finally {
      setShareBusyScope('');
    }
  }, [selectedPeerTenpoId, tenpo?.torihikisaki_id, tenpo?.yagou_id, applyBasicInfoToDraft]);

  const applySharedProfile = useCallback((scope) => {
    const isYagou = scope === 'yagou';
    const src = isYagou ? yagouSharedBasicInfoProfile : toriSharedBasicInfoProfile;
    if (isBasicInfoProfileEmpty(src)) {
      window.alert(isYagou ? '屋号共有プロファイルが未設定です' : '取引先共有プロファイルが未設定です');
      return;
    }
    applyBasicInfoToDraft(src, true);
    setShareStatusMessage(isYagou ? '屋号共有をドラフトへ適用' : '取引先共有をドラフトへ適用');
  }, [applyBasicInfoToDraft, yagouSharedBasicInfoProfile, toriSharedBasicInfoProfile]);

  const saveSharedProfile = useCallback(async (scope) => {
    const isYagou = scope === 'yagou';
    const collection = isYagou ? 'yagou' : 'torihikisaki';
    const id = isYagou ? String(tenpo?.yagou_id || '').trim() : String(tenpo?.torihikisaki_id || '').trim();
    if (!id) {
      window.alert(isYagou ? '屋号IDがありません' : '取引先IDがありません');
      return;
    }
    const profile = normalizeBasicInfoProfile(editingBasicInfo ? basicInfoDraft : buildBasicInfoDraft());
    if (isBasicInfoProfileEmpty(profile)) {
      window.alert('共有する基本情報が空です');
      return;
    }
    if (!String(profile?.customer_contact_phone || '').trim()) {
      window.alert('担当者連絡先は必須です');
      return;
    }
    if (!String(profile?.key_handling || '').trim()) {
      window.alert('鍵の扱いは必須です');
      return;
    }
    const sharedProfile = {
      ...profile,
      _meta: {
        updated_at: nowIso(),
        updated_by: clampStr(getCurrentUserName(), 80),
        source_tenpo_id: tenpoId,
        scope: isYagou ? 'yagou' : 'torihikisaki',
      },
    };

    setShareBusyScope(scope);
    setShareStatusMessage('');
    try {
      let updated;
      try {
        updated = await apiPutJson(`/master/${collection}/${encodeURIComponent(id)}`, {
          shared_basic_profile: sharedProfile,
        });
      } catch {
        const baseRecord = isYagou ? (yagou || {}) : (torihikisaki || {});
        const fallbackPayload = { ...baseRecord, shared_basic_profile: sharedProfile };
        updated = await apiPutJson(`/master/${collection}/${encodeURIComponent(id)}`, fallbackPayload);
      }
      if (isYagou) setYagou((prev) => ({ ...(prev || {}), ...(updated || {}), shared_basic_profile: updated?.shared_basic_profile || sharedProfile }));
      else setTorihikisaki((prev) => ({ ...(prev || {}), ...(updated || {}), shared_basic_profile: updated?.shared_basic_profile || sharedProfile }));
      setShareStatusMessage(isYagou ? '屋号共有を保存しました' : '取引先共有を保存しました');
    } catch (e) {
      setError(e?.message || '共有プロファイルの保存に失敗しました');
    } finally {
      setShareBusyScope('');
    }
  }, [
    tenpo?.yagou_id,
    tenpo?.torihikisaki_id,
    tenpoId,
    editingBasicInfo,
    basicInfoDraft,
    buildBasicInfoDraft,
    yagou,
    torihikisaki,
  ]);

  const ensureSouko = useCallback(async () => {
    if (souko?.souko_id) return souko;
    if (!tenpoId) throw new Error('tenpo_id が不正です');
    const created = await apiPostJson('/master/souko', {
      tenpo_id: tenpoId,
      name: `${tenpo?.name || tenpoId} 顧客ストレージ`,
      jotai: 'yuko',
    });
    setSouko(created);
    return created;
  }, [souko, tenpoId, tenpo]);

  const ensureKarteDetailDefaults = useCallback(() => {
    const base = karteDetail && typeof karteDetail === 'object' ? karteDetail : {};
    const next = { ...base };
    next.version = next.version || KARTE_DETAIL_VERSION;
    if (!next.created_at) next.created_at = nowIso();
    next.updated_at = nowIso();
    next.updated_by = clampStr(getCurrentUserName(), 80);

    // Structured fields (旧カルテの精査版)
    if (!next.spec || typeof next.spec !== 'object') next.spec = {};
    if (!next.plan || typeof next.plan !== 'object') next.plan = {};
    if (!next.seats || typeof next.seats !== 'object') next.seats = {};
    if (!Array.isArray(next.equipment)) next.equipment = [];
    if (!Array.isArray(next.consumables)) next.consumables = [];
    if (!Array.isArray(next.staff_history)) next.staff_history = [];
    if (!Array.isArray(next.service_plan)) next.service_plan = [];
    if (!Array.isArray(next.support_history)) next.support_history = [];
    if (!next.spec.sales_owner) next.spec.sales_owner = '';
    if (!next.spec.customer_contact_name) {
      next.spec.customer_contact_name = clampStr(
        tenpo?.contact_name || tenpo?.contact_person || tenpo?.tantou_name || '',
        80
      );
    }
    if (!next.spec.customer_contact_phone) {
      next.spec.customer_contact_phone = clampStr(
        tenpo?.tantou_phone || tenpo?.contact_person_phone || tenpo?.contact_phone || '',
        40
      );
    }
    next.spec.key_handling = clampStr(next.spec.key_handling || '', 120);
    next.plan.primary_yakusoku_id = clampStr(next.plan.primary_yakusoku_id || '', 64);
    next.spec.security_info = clampStr(next.spec.security_info || '', 120);
    next.spec.business_hours = clampStr(next.spec.business_hours || '', 80);
    {
      const attendance = clampStr(next.spec.customer_attendance || '', 20);
      next.spec.customer_attendance = CUSTOMER_ATTENDANCE_OPTIONS.some((o) => o.value === attendance)
        ? attendance
        : '';
    }

    // Free text is allowed only as short exception memo (admin ops).
    next.memo = clampStr(next.memo || '', 200);

    // Staff history: store both jinzai_id and name to avoid ambiguity later.
    next.staff_history = (Array.isArray(next.staff_history) ? next.staff_history : [])
      .map((it) => ({
        // v2: allow multiple members as tags
        members: uniqStaffMembers([
          ...(Array.isArray(it?.members) ? it.members : []),
          {
            jinzai_id: clampStr(it?.jinzai_id || '', 40),
            name: clampStr(it?.name || '', 40),
          },
        ], 8),
        start_date: clampStr(it?.start_date || '', 20),
        end_date: clampStr(it?.end_date || '', 20),
      }))
      .map((it) => ({
        ...it,
        // legacy: keep first member in flat fields for backward compatibility
        jinzai_id: clampStr(it?.members?.[0]?.jinzai_id || '', 40),
        name: clampStr(it?.members?.[0]?.name || '', 40),
      }))
      .filter((it) => (Array.isArray(it.members) && it.members.length > 0) || it.start_date || it.end_date);

    // Support history: short, structured notes only.
    next.support_history = sortSupportHistoryNewestFirst((Array.isArray(next.support_history) ? next.support_history : [])
      .map((it, idx) => {
        const legacyNote = clampStr(it?.note || '', 200);
        const topic = clampStr(it?.topic || '', 60) || (legacyNote ? clampStr(legacyNote, 60) : '');
        const logs = (Array.isArray(it?.logs) ? it.logs : [])
          .map((lg, lgIdx) => ({
            log_id: clampStr(lg?.log_id || '', 64) || `${makeSupportLogId()}_${lgIdx}`,
            at: clampStr(lg?.at || '', 40) || nowIso(),
            by: clampStr(lg?.by || '', 80) || 'unknown',
            message: clampStr(lg?.message || '', 200),
            jotai: clampStr(lg?.jotai || 'yuko', 20) || 'yuko',
          }))
          .filter((lg) => lg.message && lg.jotai !== 'torikeshi')
          .sort((a, b) => String(a?.at || '').localeCompare(String(b?.at || '')));
        return {
          history_id: clampStr(it?.history_id || '', 64) || `${makeHistoryId()}_${idx}`,
          date: clampStr(it?.date || '', 20),
          category: clampStr(it?.category || 'ops', 20),
          status: clampStr(it?.status || 'open', 20) || 'open',
          owner: clampStr(it?.owner || it?.handled_by || '', 80),
          due_date: clampStr(it?.due_date || '', 20),
          requested_by: clampStr(it?.requested_by || it?.from || '', 40),
          handled_by: clampStr(it?.handled_by || it?.by || '', 80),
          topic,
          action: clampStr(it?.action || '', 120),
          outcome: clampStr(it?.outcome || '', 120),
          logs,
        };
      })
      .filter((it) => (
        it.date || it.topic || it.action || it.outcome || it.requested_by || it.handled_by || (Array.isArray(it.logs) && it.logs.length > 0)
      )));

    // Report profile: 現場報告/顧客報告がこのカルテだけで成立するための設計値
    if (!next.report_profile || typeof next.report_profile !== 'object') next.report_profile = {};
    const rp = { ...(next.report_profile || {}) };
    if (!rp.field_required || typeof rp.field_required !== 'object') rp.field_required = {};
    if (!rp.customer_required || typeof rp.customer_required !== 'object') rp.customer_required = {};
    REPORT_FIELD_REQUIRED_OPTIONS.forEach((o) => {
      rp.field_required[o.key] = toBool(rp.field_required[o.key], ['clock_in_out', 'work_items', 'before_photo', 'after_photo'].includes(o.key));
    });
    CUSTOMER_REPORT_REQUIRED_OPTIONS.forEach((o) => {
      rp.customer_required[o.key] = toBool(rp.customer_required[o.key], ['scope_summary', 'before_after_set', 'issue_summary'].includes(o.key));
    });
    rp.standard_team_size = clampStr(rp.standard_team_size || '', 8);
    rp.standard_duration_min = clampStr(rp.standard_duration_min || '', 8);
    rp.report_language = clampStr(rp.report_language || 'ja', 8);
    rp.customer_contact_channel = clampStr(rp.customer_contact_channel || '', 80);
    const due = clampStr(rp.customer_due || 'same_day', 20);
    rp.customer_due = REPORT_DUE_OPTIONS.some((o) => o.value === due) ? due : 'same_day';
    rp.report_scope = clampStr(rp.report_scope || '', 200);
    rp.customer_note = clampStr(rp.customer_note || '', 200);
    rp.chemicals = (Array.isArray(rp.chemicals) ? rp.chemicals : [])
      .map((ch, chIdx) => ({
        chemical_id: clampStr(ch?.chemical_id || '', 64) || `CHM#${chIdx + 1}`,
        name: clampStr(ch?.name || '', 80),
        dilution: clampStr(ch?.dilution || '', 40),
        amount: clampStr(ch?.amount || '', 16),
        unit: clampStr(ch?.unit || 'ml', 12) || 'ml',
        target: clampStr(ch?.target || '', 80),
        note: clampStr(ch?.note || '', 120),
        jotai: clampStr(ch?.jotai || 'yuko', 20) || 'yuko',
      }))
      .filter((ch) => ch.jotai !== 'torikeshi' && (ch.name || ch.target || ch.amount));
    rp.checkpoints = (Array.isArray(rp.checkpoints) ? rp.checkpoints : [])
      .map((cp, cpIdx) => ({
        checkpoint_id: clampStr(cp?.checkpoint_id || '', 64) || `CHK#${cpIdx + 1}`,
        zone: clampStr(cp?.zone || '', 60),
        item: clampStr(cp?.item || '', 80),
        standard: clampStr(cp?.standard || '', 120),
        photo_required: toBool(cp?.photo_required, true),
        customer_visible: toBool(cp?.customer_visible, true),
        jotai: clampStr(cp?.jotai || 'yuko', 20) || 'yuko',
      }))
      .filter((cp) => cp.jotai !== 'torikeshi' && (cp.zone || cp.item || cp.standard));
    next.report_profile = rp;

    // HACCP defaults
    if (!next.haccp || typeof next.haccp !== 'object') next.haccp = {};
    if (!next.haccp.items || typeof next.haccp.items !== 'object') next.haccp.items = {};
    HACCP_GROUPS.forEach((g) => {
      g.items.forEach((it) => {
        if (!next.haccp.items[it.code]) {
          next.haccp.items[it.code] = { status: HACCP_STATUS.MIKANRYO, updated_at: '' };
        }
      });
    });
    next.haccp.version = 1;
    return next;
  }, [karteDetail, tenpo?.contact_name, tenpo?.contact_person, tenpo?.contact_phone, tenpo?.contact_person_phone, tenpo?.tantou_name, tenpo?.tantou_phone]);

  const ensureHaccpDefaults = useCallback(() => {
    const base = karteDetail && typeof karteDetail === 'object' ? karteDetail : {};
    const next = { ...base };
    if (!next.haccp || typeof next.haccp !== 'object') next.haccp = {};
    if (!next.haccp.items || typeof next.haccp.items !== 'object') next.haccp.items = {};
    HACCP_GROUPS.forEach((g) => {
      g.items.forEach((it) => {
        if (!next.haccp.items[it.code]) {
          next.haccp.items[it.code] = { status: HACCP_STATUS.MIKANRYO, updated_at: '' };
        }
      });
    });
    next.haccp.version = 1;
    return next;
  }, [karteDetail]);

  const setKarteField = useCallback((path, value) => {
    setKarteDetail((prev) => {
      const base = prev && typeof prev === 'object' ? prev : {};
      const next = { ...base };
      const [p0, p1] = String(path || '').split('.');
      if (!p0) return next;
      if (!p1) {
        next[p0] = value;
        return next;
      }
      const obj = { ...(next[p0] || {}) };
      obj[p1] = value;
      next[p0] = obj;
      return next;
    });
  }, []);

  const buildKarteDetailWithPrimaryYakusoku = useCallback((detail, yakusokuId, selectedYakusoku) => {
    const targetId = String(yakusokuId || '').trim();
    const base = detail && typeof detail === 'object' ? detail : {};
    const next = { ...base };
    const plan = { ...(next.plan || {}) };
    plan.primary_yakusoku_id = targetId;
    if (selectedYakusoku) {
      plan.plan_frequency = derivePlanFrequencyFromYakusoku(selectedYakusoku);
      const syncedServicePlan = buildServicePlanFromYakusoku(selectedYakusoku);
      if (syncedServicePlan.length > 0) next.service_plan = syncedServicePlan;
    }
    next.plan = plan;
    return next;
  }, []);

  const applyPrimaryYakusokuToKarte = useCallback(async (yakusokuId) => {
    const targetId = String(yakusokuId || '').trim();
    if (!targetId || !tenpoId) return;
    const selected = (Array.isArray(yakusokuItems) ? yakusokuItems : []).find(
      (y) => String(y?.yakusoku_id || y?.id || '').trim() === targetId
    ) || null;
    const prev = ensureKarteDetailDefaults();
    const next = buildKarteDetailWithPrimaryYakusoku(prev, targetId, selected);
    setKarteDetail(next);
    setSavingPrimaryYakusokuId(targetId);
    setError('');
    try {
      const updated = await apiPutJson(`/master/tenpo/${encodeURIComponent(tenpoId)}`, { karte_detail: next });
      setTenpo(updated);
      setKarteDetail(updated?.karte_detail || next);
    } catch (e) {
      setKarteDetail(prev);
      setError(e?.message || '主契約の保存に失敗しました');
    } finally {
      setSavingPrimaryYakusokuId('');
    }
  }, [tenpoId, yakusokuItems, ensureKarteDetailDefaults, buildKarteDetailWithPrimaryYakusoku]);

  useEffect(() => {
    if (!primaryYakusokuId || !primaryYakusoku) return;
    setKarteDetail((prev) => {
      const base = prev && typeof prev === 'object' ? prev : {};
      const currentServicePlan = Array.isArray(base?.service_plan) ? base.service_plan : [];
      // 既存の手編集がある場合は上書きしない（空の場合のみ初期反映）
      if (currentServicePlan.length > 0) return prev;
      const next = { ...base };
      const plan = { ...(next.plan || {}) };
      const nextFreq = derivePlanFrequencyFromYakusoku(primaryYakusoku);
      const nextServicePlan = buildServicePlanFromYakusoku(primaryYakusoku);
      const hasFreqChange = String(plan.plan_frequency || '') !== String(nextFreq || '');
      const hasServiceChange = nextServicePlan.length > 0;
      if (!hasFreqChange && !hasServiceChange) return prev;
      if (hasFreqChange) plan.plan_frequency = nextFreq;
      if (hasServiceChange) next.service_plan = nextServicePlan;
      next.plan = plan;
      return next;
    });
  }, [primaryYakusokuId, primaryYakusoku]);

  const toggleEquipment = useCallback((code) => {
    setKarteDetail((prev) => {
      const base = prev && typeof prev === 'object' ? prev : {};
      const next = { ...base };
      const cur = Array.isArray(next.equipment) ? next.equipment.slice() : [];
      const idx = cur.indexOf(code);
      if (idx >= 0) cur.splice(idx, 1);
      else cur.push(code);
      next.equipment = cur;
      return next;
    });
  }, []);

  const addConsumable = useCallback(() => {
    setKarteDetail((prev) => {
      const base = prev && typeof prev === 'object' ? prev : {};
      const next = { ...base };
      const cur = Array.isArray(next.consumables) ? next.consumables.slice() : [];
      cur.push({ name: '', quantity: '' });
      next.consumables = cur;
      return next;
    });
  }, []);

  const updateConsumable = useCallback((index, key, value) => {
    setKarteDetail((prev) => {
      const base = prev && typeof prev === 'object' ? prev : {};
      const next = { ...base };
      const cur = Array.isArray(next.consumables) ? next.consumables.slice() : [];
      if (!cur[index]) return next;
      const it = { ...(cur[index] || {}) };
      it[key] = clampStr(value, 60);
      cur[index] = it;
      next.consumables = cur;
      return next;
    });
  }, []);

  const removeConsumable = useCallback((index) => {
    setKarteDetail((prev) => {
      const base = prev && typeof prev === 'object' ? prev : {};
      const next = { ...base };
      const cur = Array.isArray(next.consumables) ? next.consumables.slice() : [];
      next.consumables = cur.filter((_, i) => i !== index);
      return next;
    });
  }, []);

  const addStaffHistory = useCallback(() => {
    setKarteDetail((prev) => {
      const base = prev && typeof prev === 'object' ? prev : {};
      const next = { ...base };
      const cur = Array.isArray(next.staff_history) ? next.staff_history.slice() : [];
      cur.push({ members: [], start_date: '', end_date: '' });
      next.staff_history = cur;
      return next;
    });
  }, []);

  const updateStaffHistory = useCallback((index, key, value) => {
    setKarteDetail((prev) => {
      const base = prev && typeof prev === 'object' ? prev : {};
      const next = { ...base };
      const cur = Array.isArray(next.staff_history) ? next.staff_history.slice() : [];
      if (!cur[index]) return next;
      const it = { ...(cur[index] || {}) };
      if (key === 'start_date' || key === 'end_date') it[key] = clampStr(value, 20);
      cur[index] = it;
      next.staff_history = cur;
      return next;
    });
  }, []);

  const addStaffHistoryMember = useCallback((index, member) => {
    setKarteDetail((prev) => {
      const base = prev && typeof prev === 'object' ? prev : {};
      const next = { ...base };
      const cur = Array.isArray(next.staff_history) ? next.staff_history.slice() : [];
      const it0 = cur[index];
      if (!it0) return next;
      const it = { ...(it0 || {}) };
      const members = uniqStaffMembers([
        ...(Array.isArray(it.members) ? it.members : []),
        {
          jinzai_id: clampStr(member?.jinzai_id || '', 40),
          name: clampStr(member?.name || '', 40),
        },
      ], 8);
      it.members = members;
      it.jinzai_id = clampStr(members?.[0]?.jinzai_id || '', 40);
      it.name = clampStr(members?.[0]?.name || '', 40);
      cur[index] = it;
      next.staff_history = cur;
      return next;
    });
  }, []);

  const removeStaffHistoryMember = useCallback((index, member) => {
    setKarteDetail((prev) => {
      const base = prev && typeof prev === 'object' ? prev : {};
      const next = { ...base };
      const cur = Array.isArray(next.staff_history) ? next.staff_history.slice() : [];
      const it0 = cur[index];
      if (!it0) return next;
      const it = { ...(it0 || {}) };
      const id = String(member?.jinzai_id || '').trim();
      const name = String(member?.name || '').trim();
      const members = (Array.isArray(it.members) ? it.members : []).filter((m) => {
        if (id && String(m?.jinzai_id || '').trim() === id) return false;
        if (!id && name && String(m?.name || '').trim() === name) return false;
        return true;
      });
      const norm = uniqStaffMembers(members, 8);
      it.members = norm;
      it.jinzai_id = clampStr(norm?.[0]?.jinzai_id || '', 40);
      it.name = clampStr(norm?.[0]?.name || '', 40);
      cur[index] = it;
      next.staff_history = cur;
      return next;
    });
  }, []);

  const removeStaffHistory = useCallback((index) => {
    setKarteDetail((prev) => {
      const base = prev && typeof prev === 'object' ? prev : {};
      const next = { ...base };
      const cur = Array.isArray(next.staff_history) ? next.staff_history.slice() : [];
      next.staff_history = cur.filter((_, i) => i !== index);
      return next;
    });
  }, []);

  const addSupportHistory = useCallback(() => {
    const handledBy = getCurrentUserName();
    setKarteDetail((prev) => {
      const base = prev && typeof prev === 'object' ? prev : {};
      const next = { ...base };
      const cur = Array.isArray(next.support_history) ? next.support_history.slice() : [];
      // Newest-first
      cur.unshift({
        history_id: makeHistoryId(),
        date: todayDate(),
        category: 'ops',
        status: 'open',
        owner: clampStr(handledBy, 80),
        due_date: '',
        requested_by: '',
        handled_by: clampStr(handledBy, 80),
        topic: '',
        action: '',
        outcome: '',
        logs: [],
      });
      next.support_history = cur;
      return next;
    });
  }, []);

  const updateSupportHistory = useCallback((index, patch) => {
    setKarteDetail((prev) => {
      const base = prev && typeof prev === 'object' ? prev : {};
      const next = { ...base };
      const cur = Array.isArray(next.support_history) ? next.support_history.slice() : [];
      if (!cur[index]) return next;
      const it = { ...(cur[index] || {}) };
      const p = patch || {};
      const touchedDate = p.date !== undefined;
      if (touchedDate) it.date = clampStr(p.date, 20);
      if (p.category !== undefined) it.category = clampStr(p.category, 20);
      if (p.status !== undefined) it.status = clampStr(p.status, 20);
      if (p.owner !== undefined) it.owner = clampStr(p.owner, 80);
      if (p.due_date !== undefined) it.due_date = clampStr(p.due_date, 20);
      if (p.requested_by !== undefined) it.requested_by = clampStr(p.requested_by, 40);
      if (p.handled_by !== undefined) it.handled_by = clampStr(p.handled_by, 120);
      if (p.topic !== undefined) it.topic = clampStr(p.topic, 60);
      if (p.action !== undefined) it.action = clampStr(p.action, 120);
      if (p.outcome !== undefined) it.outcome = clampStr(p.outcome, 120);
      cur[index] = it;
      next.support_history = touchedDate ? sortSupportHistoryNewestFirst(cur) : cur;
      return next;
    });
  }, []);

  const removeSupportHistory = useCallback((index) => {
    setKarteDetail((prev) => {
      const base = prev && typeof prev === 'object' ? prev : {};
      const next = { ...base };
      const cur = Array.isArray(next.support_history) ? next.support_history.slice() : [];
      next.support_history = cur.filter((_, i) => i !== index);
      return next;
    });
  }, []);

  const setSupportReplyInput = useCallback((historyId, value) => {
    const key = String(historyId || '').trim();
    if (!key) return;
    setSupportReplyInputs((prev) => ({ ...(prev || {}), [key]: value }));
  }, []);

  const addSupportHistoryLog = useCallback((index) => {
    const row = Array.isArray(karteDetail?.support_history) ? karteDetail.support_history[index] : null;
    const historyId = String(row?.history_id || '').trim();
    if (!historyId) return;
    const message = clampStr(String(supportReplyInputs?.[historyId] || '').trim(), 200);
    if (!message) return;
    setKarteDetail((prev) => {
      const base = prev && typeof prev === 'object' ? prev : {};
      const next = { ...base };
      const cur = Array.isArray(next.support_history) ? next.support_history.slice() : [];
      if (!cur[index]) return next;
      const it = { ...(cur[index] || {}) };
      const logs = Array.isArray(it.logs) ? it.logs.slice() : [];
      logs.push({
        log_id: makeSupportLogId(),
        at: nowIso(),
        by: clampStr(getCurrentUserName() || 'unknown', 80),
        message,
        jotai: 'yuko',
      });
      it.logs = logs;
      if (!String(it.status || '').trim()) it.status = 'open';
      cur[index] = it;
      next.support_history = cur;
      return next;
    });
    setSupportReplyInputs((prev) => ({ ...(prev || {}), [historyId]: '' }));
  }, [karteDetail?.support_history, supportReplyInputs]);

  const setReportProfileField = useCallback((key, value) => {
    setKarteDetail((prev) => {
      const base = prev && typeof prev === 'object' ? prev : {};
      const next = { ...base };
      const rp = { ...(next.report_profile || {}) };
      rp[key] = value;
      next.report_profile = rp;
      return next;
    });
  }, []);

  const setReportProfileFlag = useCallback((group, key, value) => {
    setKarteDetail((prev) => {
      const base = prev && typeof prev === 'object' ? prev : {};
      const next = { ...base };
      const rp = { ...(next.report_profile || {}) };
      const g = { ...(rp[group] || {}) };
      g[key] = Boolean(value);
      rp[group] = g;
      next.report_profile = rp;
      return next;
    });
  }, []);

  const addReportCheckpoint = useCallback(() => {
    setKarteDetail((prev) => {
      const base = prev && typeof prev === 'object' ? prev : {};
      const next = { ...base };
      const rp = { ...(next.report_profile || {}) };
      const rows = Array.isArray(rp.checkpoints) ? rp.checkpoints.slice() : [];
      rows.push({
        checkpoint_id: `CHK#${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        zone: '',
        item: '',
        standard: '',
        photo_required: true,
        customer_visible: true,
        jotai: 'yuko',
      });
      rp.checkpoints = rows;
      next.report_profile = rp;
      return next;
    });
  }, []);

  const updateReportCheckpoint = useCallback((index, patch) => {
    setKarteDetail((prev) => {
      const base = prev && typeof prev === 'object' ? prev : {};
      const next = { ...base };
      const rp = { ...(next.report_profile || {}) };
      const rows = Array.isArray(rp.checkpoints) ? rp.checkpoints.slice() : [];
      if (!rows[index]) return next;
      const row = { ...(rows[index] || {}) };
      const p = patch || {};
      if (p.zone !== undefined) row.zone = clampStr(p.zone, 60);
      if (p.item !== undefined) row.item = clampStr(p.item, 80);
      if (p.standard !== undefined) row.standard = clampStr(p.standard, 120);
      if (p.photo_required !== undefined) row.photo_required = Boolean(p.photo_required);
      if (p.customer_visible !== undefined) row.customer_visible = Boolean(p.customer_visible);
      rows[index] = row;
      rp.checkpoints = rows;
      next.report_profile = rp;
      return next;
    });
  }, []);

  const removeReportCheckpoint = useCallback((index) => {
    setKarteDetail((prev) => {
      const base = prev && typeof prev === 'object' ? prev : {};
      const next = { ...base };
      const rp = { ...(next.report_profile || {}) };
      const rows = Array.isArray(rp.checkpoints) ? rp.checkpoints.slice() : [];
      rp.checkpoints = rows.filter((_, i) => i !== index);
      next.report_profile = rp;
      return next;
    });
  }, []);

  const addReportChemical = useCallback(() => {
    setKarteDetail((prev) => {
      const base = prev && typeof prev === 'object' ? prev : {};
      const next = { ...base };
      const rp = { ...(next.report_profile || {}) };
      const rows = Array.isArray(rp.chemicals) ? rp.chemicals.slice() : [];
      rows.push({
        chemical_id: `CHM#${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        name: '',
        dilution: '',
        amount: '',
        unit: 'ml',
        target: '',
        note: '',
        jotai: 'yuko',
      });
      rp.chemicals = rows;
      next.report_profile = rp;
      return next;
    });
  }, []);

  const updateReportChemical = useCallback((index, patch) => {
    setKarteDetail((prev) => {
      const base = prev && typeof prev === 'object' ? prev : {};
      const next = { ...base };
      const rp = { ...(next.report_profile || {}) };
      const rows = Array.isArray(rp.chemicals) ? rp.chemicals.slice() : [];
      if (!rows[index]) return next;
      const row = { ...(rows[index] || {}) };
      const p = patch || {};
      if (p.name !== undefined) row.name = clampStr(p.name, 80);
      if (p.dilution !== undefined) row.dilution = clampStr(p.dilution, 40);
      if (p.amount !== undefined) row.amount = clampStr(p.amount, 16);
      if (p.unit !== undefined) row.unit = clampStr(p.unit, 12);
      if (p.target !== undefined) row.target = clampStr(p.target, 80);
      if (p.note !== undefined) row.note = clampStr(p.note, 120);
      rows[index] = row;
      rp.chemicals = rows;
      next.report_profile = rp;
      return next;
    });
  }, []);

  const removeReportChemical = useCallback((index) => {
    setKarteDetail((prev) => {
      const base = prev && typeof prev === 'object' ? prev : {};
      const next = { ...base };
      const rp = { ...(next.report_profile || {}) };
      const rows = Array.isArray(rp.chemicals) ? rp.chemicals.slice() : [];
      rp.chemicals = rows.filter((_, i) => i !== index);
      next.report_profile = rp;
      return next;
    });
  }, []);

  const addServicePlan = useCallback(() => {
    setKarteDetail((prev) => {
      const base = prev && typeof prev === 'object' ? prev : {};
      const next = { ...base };
      const cur = Array.isArray(next.service_plan) ? next.service_plan.slice() : [];
      cur.push({
        service_id: '',
        service_name: '',
        cycle: 'monthly',
        months: [],
        note: '',
      });
      next.service_plan = cur;
      return next;
    });
  }, []);

  const updateServicePlan = useCallback((index, patch) => {
    setKarteDetail((prev) => {
      const base = prev && typeof prev === 'object' ? prev : {};
      const next = { ...base };
      const cur = Array.isArray(next.service_plan) ? next.service_plan.slice() : [];
      if (!cur[index]) return next;
      cur[index] = { ...cur[index], ...(patch || {}) };
      next.service_plan = cur;
      return next;
    });
  }, []);

  const removeServicePlan = useCallback((index) => {
    setKarteDetail((prev) => {
      const base = prev && typeof prev === 'object' ? prev : {};
      const next = { ...base };
      const cur = Array.isArray(next.service_plan) ? next.service_plan.slice() : [];
      next.service_plan = cur.filter((_, i) => i !== index);
      return next;
    });
  }, []);

  const toggleServicePlanMonth = useCallback((index, month) => {
    setKarteDetail((prev) => {
      const base = prev && typeof prev === 'object' ? prev : {};
      const next = { ...base };
      const cur = Array.isArray(next.service_plan) ? next.service_plan.slice() : [];
      const item = cur[index];
      if (!item) return next;
      const months = Array.isArray(item.months) ? item.months.slice() : [];
      const m = Number(month);
      const pos = months.indexOf(m);
      if (pos >= 0) months.splice(pos, 1);
      else months.push(m);
      months.sort((a, b) => a - b);
      cur[index] = { ...item, months };
      next.service_plan = cur;
      return next;
    });
  }, []);

  const setHaccpItemStatus = useCallback((code, status) => {
    setKarteDetail((prev) => {
      const base = prev && typeof prev === 'object' ? prev : {};
      const next = { ...base };
      const haccp = { ...(next.haccp || {}) };
      const items = { ...(haccp.items || {}) };
      items[code] = { ...(items[code] || {}), status, updated_at: nowIso() };
      haccp.items = items;
      haccp.updated_at = nowIso();
      haccp.version = 1;
      next.haccp = haccp;
      return next;
    });
  }, []);

  const saveKarteDetailNow = useCallback(async () => {
    if (!tenpoId) return;
    setSavingKarteDetail(true);
    setError('');
    try {
      const next = ensureKarteDetailDefaults();
      const requiredContactPhone = clampStr(next?.spec?.customer_contact_phone || '', 40);
      const requiredKeyHandling = clampStr(next?.spec?.key_handling || '', 120);
      if (!requiredContactPhone) throw new Error('担当者連絡先は必須です');
      if (!requiredKeyHandling) throw new Error('鍵の扱いは必須です');
      const updated = await apiPutJson(`/master/tenpo/${encodeURIComponent(tenpoId)}`, { karte_detail: next });
      setTenpo(updated);
      setKarteDetail(updated?.karte_detail || next);
    } catch (e) {
      setError(e?.message || '保存に失敗しました');
    } finally {
      setSavingKarteDetail(false);
    }
  }, [tenpoId, ensureKarteDetailDefaults]);

  const saveBasicInfoNow = useCallback(async () => {
    if (!tenpoId) return;
    setSavingBasicInfo(true);
    setError('');
    try {
      const customerContactPhone = clampStr(basicInfoDraft?.customer_contact_phone || '', 40);
      const keyHandling = clampStr(basicInfoDraft?.key_handling || '', 120);
      if (!customerContactPhone) throw new Error('担当者連絡先は必須です');
      if (!keyHandling) throw new Error('鍵の扱いは必須です');

      const nextKarte = ensureKarteDetailDefaults();
      const nextSpec = { ...(nextKarte?.spec || {}) };
      const attendance = String(basicInfoDraft?.customer_attendance || '').trim();
      nextSpec.business_hours = clampStr(basicInfoDraft?.business_hours || '', 80);
      nextSpec.customer_attendance = CUSTOMER_ATTENDANCE_OPTIONS.some((o) => o.value === attendance) ? attendance : '';
      nextSpec.key_handling = keyHandling;
      nextSpec.contact_method = clampStr(basicInfoDraft?.contact_method || '', 80);
      nextSpec.security_info = clampStr(basicInfoDraft?.security_info || '', 120);
      nextSpec.customer_contact_name = clampStr(basicInfoDraft?.customer_contact_name || '', 80);
      nextSpec.customer_contact_phone = customerContactPhone;
      nextSpec.sales_owner = clampStr(basicInfoDraft?.sales_owner || '', 80);
      nextKarte.spec = nextSpec;

      const customerContactName = clampStr(basicInfoDraft?.customer_contact_name || '', 80);
      const payload = {
        name: clampStr(basicInfoDraft?.name || '', 120),
        address: clampStr(basicInfoDraft?.address || '', 200),
        phone: clampStr(basicInfoDraft?.phone || '', 40),
        url: clampStr(basicInfoDraft?.url || '', 200),
        key_handling: keyHandling,
        tantou_name: customerContactName,
        tantou_phone: customerContactPhone,
        contact_method: clampStr(basicInfoDraft?.contact_method || '', 80),
        security_info: clampStr(basicInfoDraft?.security_info || '', 120),
        karte_detail: nextKarte,
      };
      const updated = await apiPutJson(`/master/tenpo/${encodeURIComponent(tenpoId)}`, payload);
      setTenpo(updated);
      setKarteDetail(updated?.karte_detail || nextKarte);
      const torihikisakiId = String(tenpo?.torihikisaki_id || '').trim();
      const selectedKeiyakuId = String(basicInfoDraft?.torihikisaki_keiyaku_id || '').trim();
      const selectedKeiyaku = selectedKeiyakuId ? keiyakuById.get(selectedKeiyakuId) : null;
      const linkedKeiyakuName = selectedKeiyakuId
        ? clampStr(
          selectedKeiyaku?.name
          || basicInfoDraft?.torihikisaki_keiyaku_name
          || '',
          120
        )
        : '';
      const linkedKeiyakuStart = selectedKeiyakuId
        ? clampStr(
          getKeiyakuStartDate(selectedKeiyaku)
          || basicInfoDraft?.torihikisaki_keiyaku_start_date
          || '',
          20
        )
        : '';
      let updatedTorihikisaki = torihikisaki;
      if (torihikisakiId) {
        try {
          updatedTorihikisaki = await apiPutJson(`/master/torihikisaki/${encodeURIComponent(torihikisakiId)}`, {
            keiyaku_id: selectedKeiyakuId,
            keiyaku_name: linkedKeiyakuName,
            keiyaku_start_date: linkedKeiyakuStart,
          });
        } catch {
          const baseTori = torihikisaki && typeof torihikisaki === 'object' ? torihikisaki : {};
          updatedTorihikisaki = await apiPutJson(`/master/torihikisaki/${encodeURIComponent(torihikisakiId)}`, {
            ...baseTori,
            keiyaku_id: selectedKeiyakuId,
            keiyaku_name: linkedKeiyakuName,
            keiyaku_start_date: linkedKeiyakuStart,
          });
        }
        setTorihikisaki((prev) => ({
          ...(prev || {}),
          ...(updatedTorihikisaki || {}),
          keiyaku_id: selectedKeiyakuId,
          keiyaku_name: linkedKeiyakuName,
          keiyaku_start_date: linkedKeiyakuStart,
        }));
      }
      setBasicInfoDraft({
        name: clampStr(updated?.name || payload.name || '', 120),
        address: clampStr(updated?.address || payload.address || '', 200),
        phone: clampStr(updated?.phone || payload.phone || '', 40),
        url: clampStr(updated?.url || payload.url || '', 200),
        business_hours: clampStr(updated?.karte_detail?.spec?.business_hours || nextSpec.business_hours || '', 80),
        customer_attendance: String(updated?.karte_detail?.spec?.customer_attendance || nextSpec.customer_attendance || ''),
        key_handling: clampStr(updated?.karte_detail?.spec?.key_handling || payload.key_handling || '', 120),
        contact_method: clampStr(updated?.karte_detail?.spec?.contact_method || payload.contact_method || '', 80),
        security_info: clampStr(updated?.karte_detail?.spec?.security_info || payload.security_info || '', 120),
        customer_contact_name: clampStr(
          updated?.karte_detail?.spec?.customer_contact_name
          || updated?.contact_name
          || updated?.contact_person
          || updated?.tantou_name
          || customerContactName
          || '',
          80
        ),
        customer_contact_phone: clampStr(
          updated?.karte_detail?.spec?.customer_contact_phone
          || updated?.tantou_phone
          || updated?.contact_person_phone
          || updated?.contact_phone
          || customerContactPhone
          || '',
          40
        ),
        sales_owner: clampStr(updated?.karte_detail?.spec?.sales_owner || nextSpec.sales_owner || '', 80),
        torihikisaki_keiyaku_id: String((updatedTorihikisaki?.keiyaku_id || selectedKeiyakuId || '')).trim(),
        torihikisaki_keiyaku_name: clampStr(
          String(
            updatedTorihikisaki?.keiyaku_name
            || linkedKeiyakuName
            || ''
          ),
          120
        ),
        torihikisaki_keiyaku_start_date: clampStr(
          String(
            updatedTorihikisaki?.keiyaku_start_date
            || linkedKeiyakuStart
            || ''
          ),
          20
        ),
      });
      setEditingBasicInfo(false);
    } catch (e) {
      setError(e?.message || '基本情報の保存に失敗しました');
    } finally {
      setSavingBasicInfo(false);
    }
  }, [
    tenpoId,
    tenpo?.torihikisaki_id,
    ensureKarteDetailDefaults,
    basicInfoDraft,
    keiyakuById,
    torihikisaki,
  ]);

  const onUpload = useCallback(async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    setLastUpload(null);
    try {
      const sk = await ensureSouko();
      const presign = await apiPostJson('/master/souko', {
        mode: 'presign_upload',
        tenpo_id: tenpoId,
        file_name: file.name || 'file.bin',
        content_type: file.type || 'application/octet-stream',
      });
      const putUrl = presign?.put_url;
      const key = presign?.key;
      if (!putUrl || !key) throw new Error('presign 응答が不正です');

      // PUT to S3 (presigned URL)
      const putRes = await fetch(putUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
        redirect: 'follow',
      });
      if (!putRes.ok) {
        const text = await putRes.text().catch(() => '');
        throw new Error(`S3 upload failed (${putRes.status}) ${text}`.trim());
      }

      const baseFiles = safeArr(souko?.files)
        .map((it) => {
          if (!it || typeof it !== 'object') return null;
          const one = { ...it };
          delete one.get_url;
          return one;
        })
        .filter((it) => String(it?.key || '').trim());
      const nextFiles = [
        ...baseFiles,
        {
          key,
          file_name: file.name || '',
          content_type: file.type || '',
          size: file.size || 0,
          uploaded_at: nowIso(),
          kubun: uploadKubun,
          doc_category: uploadDocCategory,
          preview_url: String(presign?.get_url || ''),
        },
      ];
      const updated = await apiPutJson(`/master/souko/${encodeURIComponent(pickId(sk, 'souko_id'))}`, {
        ...sk,
        files: nextFiles,
      });
      setSouko(updated);
      setLastUpload({ key, get_url: presign?.get_url || '' });
      setFile(null);
    } catch (e) {
      setError(e?.message || 'アップロードに失敗しました');
    } finally {
      setUploading(false);
    }
  }, [file, ensureSouko, tenpoId, souko, uploadKubun, uploadDocCategory]);

  const copy = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(String(text || ''));
    } catch {
      // noop
    }
  }, []);

  if (!tenpoId) {
    return (
      <div className="tenpo-karte-page">
        <header className="tenpo-karte-head">
          <div className="admin-top-left">
            {/* GlobalNav handles navigation */}
          </div>
          <h1>店舗カルテ</h1>
        </header>
        <div className="tenpo-karte-err">tenpo_id が不正です</div>
      </div>
    );
  }

  return (
    <div className={`tenpo-karte-page ${isMobileLayout ? 'is-mobile' : ''}`}>
      <header className="tenpo-karte-head">
        <div className="left">
          <div className="admin-top-left">
            {/* GlobalNav handles navigation */}
          </div>
          <div className="titles">
            <div className="kicker">お客様詳細</div>
            <h1>{headerTitle}</h1>
            <div className="pathline">
              <span className="seg">
                取引先: {torihikisaki?.name || '—'}
              </span>
            </div>
          </div>
        </div>
        <div className="right">
          <Link to={directYoteiCreateLink} className="btn-primary">予定</Link>
          <Link to="/admin/torihikisaki-meibo" className="link">取引先名簿</Link>
          <Link to="/admin/master/tenpo" className="link">店舗マスタ</Link>
          <button
            className="btn-primary"
            onClick={() => setKarteView((v) => (v === KARTE_VIEW.DETAIL ? KARTE_VIEW.SUMMARY : KARTE_VIEW.DETAIL))}
          >
            {karteView === KARTE_VIEW.DETAIL ? '概要に戻る' : 'カルテ詳細'}
          </button>
          <button onClick={refresh} disabled={loading}>{loading ? '更新中...' : '更新'}</button>
        </div>
      </header>

      {error ? <div className="tenpo-karte-err">{error}</div> : null}

      <section className={`monshin-overview ${isMonshinMode ? 'is-mode' : ''}`}>
        <div className="monshin-overview-head">
          <div className="left">
            <div className="title">{isMonshinMode ? '問診票モード' : '問診票チェック'}</div>
            <div className="desc">契約（yakusoku）・カルテ・報告設計の土台となる必須項目の充足率</div>
          </div>
          <div className={`pill ${monshinChecklist.missing.length === 0 ? 'pill-on' : 'pill-off'}`}>
            {monshinChecklist.completed}/{monshinChecklist.total} 完了
          </div>
        </div>
        <div className="monshin-progress">
          <div className="bar" style={{ width: `${monshinChecklist.ratio}%` }} />
        </div>
        {monshinChecklist.missing.length > 0 ? (
          <div className="monshin-missing">
            未入力: {monshinChecklist.missing.map((m) => m.label).join(' / ')}
          </div>
        ) : (
          <div className="monshin-ok">必須項目は揃っています。次は yakusoku と yotei 連携へ進めます。</div>
        )}
        <div className="monshin-actions">
          <button type="button" onClick={() => setKarteView(KARTE_VIEW.SUMMARY)}>基本情報</button>
          <button type="button" onClick={() => setKarteView(KARTE_VIEW.DETAIL)}>詳細入力</button>
          <Link to="/admin/yakusoku" className="link">yakusoku管理へ</Link>
        </div>
      </section>

      <datalist id="tenpo-karte-jinzai-name-list">
        {jinzais.map((j) => (
          <option key={j.jinzai_id} value={j.name} />
        ))}
      </datalist>

      {karteView === KARTE_VIEW.SUMMARY ? (
        <>
          {isMobileLayout ? (
            <div className="tenpo-mobile-cta">
              <button
                type="button"
                className="btn-primary"
                onClick={() => setKarteView(KARTE_VIEW.DETAIL)}
              >
                カルテ入力を開く
              </button>
            </div>
          ) : null}
          <div className="tenpo-karte-grid">
          <details className="card card-accordion basic-info-card" open>
            <summary>
              <div className="sum-left">
                <div className="sum-title">基本情報</div>
                <div className="sum-hint">
                  {torihikisaki?.name || '—'} / {yagou?.name || '—'} / {tenpo?.name || '—'}
                </div>
              </div>
              <div className="sum-right">
                <span className={`pill ${tenpo?.jotai === 'torikeshi' ? 'pill-off' : 'pill-on'}`}>
                  {tenpo?.jotai || '—'}
                </span>
                <span className="chev">›</span>
              </div>
            </summary>
            <div className="accordion-body">
              <div className="actions-row basic-info-actions">
                {!editingBasicInfo ? (
                  <button type="button" onClick={() => { setBasicInfoDraft(buildBasicInfoDraft()); setEditingBasicInfo(true); }}>
                    基本情報を編集
                  </button>
                ) : (
                  <>
                    <button type="button" className="btn-primary" onClick={saveBasicInfoNow} disabled={savingBasicInfo}>
                      {savingBasicInfo ? '保存中...' : '保存してマスタ反映'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setBasicInfoDraft(buildBasicInfoDraft());
                        setEditingBasicInfo(false);
                      }}
                      disabled={savingBasicInfo}
                    >
                      キャンセル
                    </button>
                  </>
                )}
              </div>

              <details className="karte-accordion" open={false}>
                <summary>
                  <span className="label">基本情報の共有・転用</span>
                  <span className="hint">他店舗コピー / 屋号共有 / 取引先共有</span>
                </summary>
                <div className="accordion-body">
                  <div className="kv">
                    <div className="k">他店舗コピー</div>
                    <div className="v">
                      <div className="actions-row" style={{ margin: 0 }}>
                        <select
                          value={selectedPeerTenpoId}
                          onChange={(e) => setSelectedPeerTenpoId(e.target.value)}
                          style={{ minWidth: 240 }}
                        >
                          {peerTenpos.length === 0 ? (
                            <option value="">同屋号の他店舗なし</option>
                          ) : (
                            peerTenpos.map((tp) => {
                              const id = String(tp?.tenpo_id || tp?.id || '');
                              const nm = String(tp?.name || id || '—');
                              return <option key={id} value={id}>{nm}</option>;
                            })
                          )}
                        </select>
                        <button
                          type="button"
                          onClick={copyBasicInfoFromPeer}
                          disabled={!peerTenpos.length || shareBusyScope === 'copy'}
                        >
                          {shareBusyScope === 'copy' ? 'コピー中...' : 'ドラフトへコピー'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="kv">
                    <div className="k">共有適用</div>
                    <div className="v">
                      <div className="actions-row" style={{ margin: 0 }}>
                        <button type="button" onClick={() => applySharedProfile('yagou')}>
                          屋号共有を適用
                        </button>
                        <button type="button" onClick={() => applySharedProfile('torihikisaki')}>
                          取引先共有を適用
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="kv">
                    <div className="k">共有保存</div>
                    <div className="v">
                      <div className="actions-row" style={{ margin: 0 }}>
                        <button
                          type="button"
                          onClick={() => saveSharedProfile('yagou')}
                          disabled={shareBusyScope === 'yagou'}
                        >
                          {shareBusyScope === 'yagou' ? '保存中...' : '現在値を屋号共有へ保存'}
                        </button>
                        <button
                          type="button"
                          onClick={() => saveSharedProfile('torihikisaki')}
                          disabled={shareBusyScope === 'torihikisaki'}
                        >
                          {shareBusyScope === 'torihikisaki' ? '保存中...' : '現在値を取引先共有へ保存'}
                        </button>
                      </div>
                      {shareStatusMessage ? (
                        <div className="v-sub" style={{ marginTop: 8 }}>
                          {shareStatusMessage}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </details>

              <div className="kv">
                <div className="k">取引先</div>
                <div className="v">
                  <div className="v-main">{torihikisaki?.name || '—'}</div>
                  <div className="v-sub">
                    <code>{tenpo?.torihikisaki_id || '—'}</code>
                  </div>
                </div>
              </div>
              <div className="kv">
                <div className="k">屋号</div>
                <div className="v">
                  <div className="v-main">{yagou?.name || '—'}</div>
                  <div className="v-sub">
                    <code>{tenpo?.yagou_id || '—'}</code>
                  </div>
                </div>
              </div>
              <div className="kv">
                <div className="k">店舗</div>
                <div className="v">
                  <div className="v-main">
                    {editingBasicInfo ? (
                      <input
                        value={String(basicInfoDraft?.name || '')}
                        onChange={(e) => onBasicInfoField('name', clampStr(e.target.value, 120))}
                        placeholder="店舗名"
                      />
                    ) : (resolvedBasicInfo?.name || '—')}
                  </div>
                  <div className="v-sub">
                    <code>{tenpo?.tenpo_id || tenpoId}</code>
                  </div>
                </div>
              </div>
              <div className="kv">
                <div className="k">住所</div>
                <div className="v">
                  <div className="v-main">
                    {editingBasicInfo ? (
                      <input
                        value={String(basicInfoDraft?.address || '')}
                        onChange={(e) => onBasicInfoField('address', clampStr(e.target.value, 200))}
                        placeholder="住所"
                      />
                    ) : (resolvedBasicInfo?.address || '—')}
                  </div>
                </div>
              </div>
              <div className="kv">
                <div className="k">電話番号</div>
                <div className="v">
                  <div className="v-main">
                    {editingBasicInfo ? (
                      <input
                        value={String(basicInfoDraft?.phone || '')}
                        onChange={(e) => onBasicInfoField('phone', clampStr(e.target.value, 40))}
                        placeholder="電話番号"
                      />
                    ) : (resolvedBasicInfo?.phone || '—')}
                  </div>
                </div>
              </div>
              <div className="kv">
                <div className="k">URL</div>
                <div className="v">
                  <div className="v-main">
                    {editingBasicInfo ? (
                      <input
                        value={String(basicInfoDraft?.url || '')}
                        onChange={(e) => onBasicInfoField('url', clampStr(e.target.value, 200))}
                        placeholder="https://..."
                      />
                    ) : String(resolvedBasicInfo?.url || '').trim() ? (
                      <a href={String(resolvedBasicInfo?.url)} target="_blank" rel="noreferrer" className="link">
                        {String(resolvedBasicInfo?.url)}
                      </a>
                    ) : '—'}
                  </div>
                </div>
              </div>
              <div className="kv">
                <div className="k">営業時間</div>
                <div className="v">
                  <div className="v-main">
                    {editingBasicInfo ? (
                      <input
                        value={String(basicInfoDraft?.business_hours || '')}
                        onChange={(e) => onBasicInfoField('business_hours', clampStr(e.target.value, 80))}
                        placeholder="例: 11:00-23:00"
                      />
                    ) : (String(resolvedBasicInfo?.business_hours || '').trim() || '—')}
                  </div>
                </div>
              </div>
              <div className="kv">
                <div className="k">お客様立会い</div>
                <div className="v">
                  <div className="v-main">
                    {editingBasicInfo ? (
                      <select
                        value={String(basicInfoDraft?.customer_attendance || '')}
                        onChange={(e) => onBasicInfoField('customer_attendance', e.target.value)}
                      >
                        <option value="">未設定</option>
                        {CUSTOMER_ATTENDANCE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    ) : (findOptionLabel(CUSTOMER_ATTENDANCE_OPTIONS, resolvedBasicInfo?.customer_attendance) || '—')}
                  </div>
                </div>
              </div>
              <div className="kv">
                <div className="k">連絡手段</div>
                <div className="v">
                  <div className="v-main">
                    {editingBasicInfo ? (
                      <input
                        value={String(basicInfoDraft?.contact_method || '')}
                        onChange={(e) => onBasicInfoField('contact_method', clampStr(e.target.value, 80))}
                        placeholder="例: 電話 / LINE / メール"
                      />
                    ) : (String(resolvedBasicInfo?.contact_method || '').trim() || '—')}
                  </div>
                </div>
              </div>
              <div className="kv">
                <div className="k">鍵の扱い *</div>
                <div className="v">
                  <div className="v-main">
                    {editingBasicInfo ? (
                      <input
                        value={String(basicInfoDraft?.key_handling || '')}
                        onChange={(e) => onBasicInfoField('key_handling', clampStr(e.target.value, 120))}
                        placeholder="例: キーボックスNo1 / 退出時に施錠確認"
                        required
                      />
                    ) : (String(resolvedBasicInfo?.key_handling || '').trim() || '—')}
                  </div>
                </div>
              </div>
              <div className="kv">
                <div className="k">セキュリティ</div>
                <div className="v">
                  <div className="v-main">
                    {editingBasicInfo ? (
                      <input
                        value={String(basicInfoDraft?.security_info || '')}
                        onChange={(e) => onBasicInfoField('security_info', clampStr(e.target.value, 120))}
                        placeholder="例: 警備会社 / 施錠ルール / 警報手順"
                      />
                    ) : (String(resolvedBasicInfo?.security_info || '').trim() || '—')}
                  </div>
                </div>
              </div>
              <div className="kv">
                <div className="k">ご担当者様</div>
                <div className="v">
                  <div className="v-main">
                    {editingBasicInfo ? (
                      <input
                        value={String(basicInfoDraft?.customer_contact_name || '')}
                        onChange={(e) => onBasicInfoField('customer_contact_name', clampStr(e.target.value, 80))}
                        placeholder="店舗ご担当者様"
                      />
                    ) : customerContactSummary}
                  </div>
                </div>
              </div>
              <div className="kv">
                <div className="k">担当者連絡先 *</div>
                <div className="v">
                  <div className="v-main">
                    {editingBasicInfo ? (
                      <input
                        value={String(basicInfoDraft?.customer_contact_phone || '')}
                        onChange={(e) => onBasicInfoField('customer_contact_phone', clampStr(e.target.value, 40))}
                        placeholder="例: 090-1234-5678"
                        required
                      />
                    ) : customerContactPhoneSummary}
                  </div>
                </div>
              </div>
              <div className="kv">
                <div className="k">営業担当</div>
                <div className="v">
                  <div className="v-main">
                    {editingBasicInfo ? (
                      <input
                        value={String(basicInfoDraft?.sales_owner || '')}
                        onChange={(e) => onBasicInfoField('sales_owner', clampStr(e.target.value, 80))}
                        placeholder="営業担当"
                      />
                    ) : salesOwnerSummary}
                  </div>
                </div>
              </div>
              <div className="kv">
                <div className="k">主契約</div>
                <div className="v">
                  <div className="v-main">
                    {primaryYakusoku ? (
                      <>
                        <code>{primaryYakusoku.yakusoku_id}</code>
                        {' '}
                        {yakusokuSummary}
                      </>
                    ) : '—'}
                  </div>
                </div>
              </div>
              <div className="kv">
                <div className="k">契約件数</div>
                <div className="v">
                  <div className="v-main">
                    有効 {yakusokuActiveItems.length} / 全体 {yakusokuItems.length}
                  </div>
                </div>
              </div>

              <details className="karte-accordion" open>
                <summary>
                  <span className="label">yakusoku 契約情報</span>
                  <span className="hint">
                    {yakusokuLoading ? '読み込み中...' : `${yakusokuItems.length}件`}
                  </span>
                </summary>
                <div className="accordion-body">
                  {yakusokuError ? (
                    <div className="muted" style={{ color: '#fbbf24' }}>{yakusokuError}</div>
                  ) : null}
                  {!yakusokuLoading && !yakusokuItems.length ? (
                    <div className="muted">この店舗に紐づく契約はありません</div>
                  ) : null}
                  {yakusokuItems.length > 0 ? (
                    <div className="yakusoku-mini-list">
                      {yakusokuItems.map((y) => {
                        const id = String(y?.yakusoku_id || '').trim();
                        const isPrimary = id && id === primaryYakusokuId;
                        const start = String(y?.start_date || '').trim() || '未設定';
                        const status = String(y?.status || '').trim() || 'active';
                        const cycle = String(y?.type || '').trim() === 'teiki'
                          ? `定期 / ${Number(y?.monthly_quota || 0) || '-'}回`
                          : '単発';
                        const service = getYakusokuServiceSummary(y);
                        return (
                          <div key={id} className={`yakusoku-mini-row ${isPrimary ? 'is-primary' : ''}`}>
                            <div className="id-line">
                              <code>{id}</code>
                              <span className={`pill ${status === 'active' ? 'pill-on' : 'pill-off'}`}>{status}</span>
                            </div>
                            <div className="meta-line">
                              <span>開始: {start}</span>
                              <span>周期: {cycle}</span>
                              <span>単価: ¥{Number(y?.price || 0).toLocaleString()}</span>
                            </div>
                            <div className="meta-line">サービス: {service}</div>
                            <div className="actions-row" style={{ marginTop: 6, marginBottom: 0 }}>
                              <button
                                type="button"
                                disabled={!id || isPrimary || Boolean(savingPrimaryYakusokuId)}
                                onClick={() => applyPrimaryYakusokuToKarte(id)}
                              >
                                {savingPrimaryYakusokuId === id
                                  ? '保存中...'
                                  : (isPrimary ? '主契約（設定済み）' : '主契約に設定')}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                  <div className="actions-row" style={{ marginTop: 10, marginBottom: 0 }}>
                    <Link to="/admin/yakusoku" className="link">yakusoku管理へ</Link>
                  </div>
                </div>
              </details>

              <details className="karte-accordion">
                <summary>
                  <span className="label">取引先 詳細</span>
                  <span className="hint">{torihikisaki?.name || tenpo?.torihikisaki_id || '—'}</span>
                </summary>
                <div className="accordion-body">
                  <div className="kv">
                    <div className="k">name</div>
                    <div className="v">{torihikisaki?.name || '—'}</div>
                  </div>
                  <div className="kv">
                    <div className="k">id</div>
                    <div className="v">
                      <code>{tenpo?.torihikisaki_id || '—'}</code>
                    </div>
                  </div>
                  <div className="kv">
                    <div className="k">契約（keiyaku）</div>
                    <div className="v">
                      <div className="v-main">
                        {editingBasicInfo ? (
                          <>
                            <select
                              value={String(basicInfoDraft?.torihikisaki_keiyaku_id || '')}
                              onChange={(e) => {
                                const nextId = String(e.target.value || '').trim();
                                const linked = nextId ? keiyakuById.get(nextId) : null;
                                onBasicInfoField('torihikisaki_keiyaku_id', nextId);
                                onBasicInfoField('torihikisaki_keiyaku_name', nextId ? String(linked?.name || '').trim() : '');
                                onBasicInfoField('torihikisaki_keiyaku_start_date', nextId ? getKeiyakuStartDate(linked) : '');
                              }}
                            >
                              <option value="">未設定</option>
                              {keiyakuRowsForTorihikisaki.map((c) => {
                                const id = String(c?.keiyaku_id || '').trim();
                                const nm = String(c?.name || id).trim();
                                const start = getKeiyakuStartDate(c);
                                const stale = c?._stale ? ' / 履歴' : '';
                                return (
                                  <option key={id} value={id}>
                                    {[nm || id, start ? `開始:${start}` : '', stale].filter(Boolean).join(' ')}
                                  </option>
                                );
                              })}
                            </select>
                            <div className="muted small">
                              {keiyakuLoading ? 'keiyaku 読み込み中...' : `候補 ${keiyakuRowsForTorihikisaki.length}件`}
                              {keiyakuError ? ` / ${keiyakuError}` : ''}
                            </div>
                          </>
                        ) : (
                          String(torihikisaki?.keiyaku_id || '').trim()
                            ? (
                              <>
                                <code>{String(torihikisaki?.keiyaku_id || '').trim()}</code>
                                {' '}
                                {String(torihikisaki?.keiyaku_name || '').trim() || ''}
                                {String(torihikisaki?.keiyaku_start_date || '').trim()
                                  ? `（開始: ${String(torihikisaki?.keiyaku_start_date || '').trim()}）`
                                  : ''}
                              </>
                            )
                            : '—'
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="kv">
                    <div className="k">状態</div>
                    <div className="v">{torihikisaki?.jotai || '—'}</div>
                  </div>
                  <div className="kv">
                    <div className="k">作成</div>
                    <div className="v">{torihikisaki?.created_at || '—'}</div>
                  </div>
                  <div className="kv">
                    <div className="k">更新</div>
                    <div className="v">{torihikisaki?.updated_at || '—'}</div>
                  </div>
                  <div className="actions-row">
                    <Link to="/admin/master/torihikisaki" className="link">取引先マスタ</Link>
                    <Link to="/admin/master/keiyaku" className="link">契約マスタ</Link>
                    {tenpo?.torihikisaki_id ? (
                      <button onClick={() => copy(String(tenpo?.torihikisaki_id))}>IDコピー</button>
                    ) : null}
                  </div>
                </div>
              </details>

              <details className="karte-accordion">
                <summary>
                  <span className="label">屋号 詳細</span>
                  <span className="hint">{yagou?.name || tenpo?.yagou_id || '—'}</span>
                </summary>
                <div className="accordion-body">
                  <div className="kv">
                    <div className="k">name</div>
                    <div className="v">{yagou?.name || '—'}</div>
                  </div>
                  <div className="kv">
                    <div className="k">id</div>
                    <div className="v">
                      <code>{tenpo?.yagou_id || '—'}</code>
                    </div>
                  </div>
                  <div className="kv">
                    <div className="k">状態</div>
                    <div className="v">{yagou?.jotai || '—'}</div>
                  </div>
                  <div className="kv">
                    <div className="k">作成</div>
                    <div className="v">{yagou?.created_at || '—'}</div>
                  </div>
                  <div className="kv">
                    <div className="k">更新</div>
                    <div className="v">{yagou?.updated_at || '—'}</div>
                  </div>
                  <div className="actions-row">
                    <Link to="/admin/master/yagou" className="link">屋号マスタ</Link>
                    {tenpo?.yagou_id ? (
                      <button onClick={() => copy(String(tenpo?.yagou_id))}>IDコピー</button>
                    ) : null}
                  </div>
                </div>
              </details>
            </div>
          </details>

          <section className="card support-history-card">
            <div className="card-title-row">
              <div className="card-title">対応履歴（短文・200字）</div>
              <div className="seg-tabs">
                <button type="button" onClick={addSupportHistory}>追加</button>
                <button type="button" onClick={saveKarteDetailNow} disabled={savingKarteDetail}>
                  {savingKarteDetail ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
            <div className="muted small">
              目的: 事実ベースで「いつ/誰から/何の件/誰が対応/何をした/結果」を短く残す。長文の経緯・評価・提案は書かない。
            </div>
            {Array.isArray(karteDetail?.support_history) && karteDetail.support_history.length > 0 ? (
              <div className="service-plan-list" style={{ marginTop: 10 }}>
                {karteDetail.support_history.map((h, i) => {
                  const historyId = String(h?.history_id || '').trim() || `legacy-${i}`;
                  const logs = (Array.isArray(h?.logs) ? h.logs : [])
                    .filter((lg) => String(lg?.jotai || 'yuko') !== 'torikeshi' && String(lg?.message || '').trim())
                    .sort((a, b) => String(a?.at || '').localeCompare(String(b?.at || '')));
                  return (
                    <div key={historyId} className="service-plan-row support-thread-row">
                      <div className="service-plan-head">
                        <div className="service-plan-title">
                          履歴 {karteDetail.support_history.length - i}
                          <span className="muted-inline">返信 {logs.length}件</span>
                        </div>
                        <button type="button" onClick={() => removeSupportHistory(i)}>×</button>
                      </div>
                      <div className="form-grid">
                        <label className="f">
                          <div className="lbl">日付</div>
                          <input
                            type="date"
                            value={String(h?.date || '')}
                            onChange={(e) => updateSupportHistory(i, { date: e.target.value })}
                          />
                        </label>
                        <label className="f">
                          <div className="lbl">区分</div>
                          <select
                            value={String(h?.category || 'ops')}
                            onChange={(e) => updateSupportHistory(i, { category: e.target.value })}
                          >
                            {SUPPORT_HISTORY_CATEGORIES.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="f">
                          <div className="lbl">状態</div>
                          <select
                            value={String(h?.status || 'open')}
                            onChange={(e) => updateSupportHistory(i, { status: e.target.value })}
                          >
                            {SUPPORT_HISTORY_STATUS_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="f">
                          <div className="lbl">期限</div>
                          <input
                            type="date"
                            value={String(h?.due_date || '')}
                            onChange={(e) => updateSupportHistory(i, { due_date: e.target.value })}
                          />
                        </label>
                        <label className="f" style={{ gridColumn: '1 / -1' }}>
                          <div className="lbl">起点（誰から/誰が言った）</div>
                          <input
                            value={String(h?.requested_by || '')}
                            onChange={(e) => updateSupportHistory(i, { requested_by: e.target.value })}
                            placeholder="例: 先方店長 / 本部 / 櫻田"
                          />
                        </label>
                        <label className="f">
                          <div className="lbl">主担当</div>
                          <input
                            value={String(h?.owner || h?.handled_by || '')}
                            onChange={(e) => updateSupportHistory(i, { owner: e.target.value, handled_by: e.target.value })}
                            placeholder="例: 櫻田 / 太田 / 清掃班長"
                          />
                        </label>
                        <label className="f">
                          <div className="lbl">対応（誰が対応した）</div>
                          <input
                            value={String(h?.handled_by || '')}
                            onChange={(e) => updateSupportHistory(i, { handled_by: e.target.value })}
                            placeholder="複数可"
                          />
                        </label>
                      </div>
                      <div className="form-grid" style={{ marginTop: 10 }}>
                        <label className="f" style={{ gridColumn: '1 / -1' }}>
                          <div className="lbl">何の件か（要件）</div>
                          <input
                            value={String(h?.topic || '')}
                            onChange={(e) => updateSupportHistory(i, { topic: e.target.value })}
                            placeholder="例: 窓の仕上がり / 臭い / 鍵運用 / 請求"
                          />
                        </label>
                        <label className="f" style={{ gridColumn: '1 / -1' }}>
                          <div className="lbl">何をした（対応）</div>
                          <input
                            value={String(h?.action || '')}
                            onChange={(e) => updateSupportHistory(i, { action: e.target.value })}
                            placeholder="例: 乾拭き徹底を指示 / 再清掃を手配"
                          />
                        </label>
                        <label className="f" style={{ gridColumn: '1 / -1' }}>
                          <div className="lbl">どうなった（結果）</div>
                          <input
                            value={String(h?.outcome || '')}
                            onChange={(e) => updateSupportHistory(i, { outcome: e.target.value })}
                            placeholder="例: 次回確認 / 了承 / 保留"
                          />
                        </label>
                      </div>

                      <div className="support-thread-log">
                        <div className="lbl">やり取り（この履歴内）</div>
                        <div className="support-chat-list">
                          {logs.length === 0 ? (
                            <div className="muted">返信なし</div>
                          ) : (
                            logs.map((lg) => (
                              <div key={lg.log_id || `${lg.at}-${lg.by}`} className="support-chat-item">
                                <div className="meta">
                                  <span>{fmtDateTimeJst(lg.at) || lg.at || '—'}</span>
                                  <span>{lg.by || 'unknown'}</span>
                                </div>
                                <div className="msg">{lg.message}</div>
                              </div>
                            ))
                          )}
                        </div>
                        <div className="support-chat-compose">
                          <textarea
                            rows={2}
                            maxLength={200}
                            value={String(supportReplyInputs?.[historyId] || '')}
                            onChange={(e) => setSupportReplyInput(historyId, e.target.value)}
                            placeholder="この履歴への返信を入力（200字）"
                          />
                          <button
                            type="button"
                            onClick={() => addSupportHistoryLog(i)}
                            disabled={!String(supportReplyInputs?.[historyId] || '').trim()}
                          >
                            返信を追加
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="muted" style={{ marginTop: 10 }}>未登録</div>
            )}
          </section>

          <section className="card souko-card">
            <div className="card-title-row">
              <div className="card-title">ストレージ（souko）</div>
              <div className="seg-tabs" role="tablist" aria-label="souko view">
                <button
                  type="button"
                  className={`seg ${soukoView === 'teishutsu' ? 'active' : ''}`}
                  onClick={() => setSoukoView('teishutsu')}
                >
                  提出物 {filesByKubun.teishutsu.length}
                </button>
                <button
                  type="button"
                  className={`seg ${soukoView === 'naibu' ? 'active' : ''}`}
                  onClick={() => setSoukoView('naibu')}
                >
                  内部 {filesByKubun.naibu.length}
                </button>
                <button
                  type="button"
                  className={`seg ${soukoView === 'all' ? 'active' : ''}`}
                  onClick={() => setSoukoView('all')}
                >
                  全て {files.length}
                </button>
              </div>
            </div>
            <div className="kv">
              <div className="k">souko</div>
              <div className="v">{souko?.name || (souko?.souko_id ? souko?.souko_id : '未作成')}</div>
            </div>
            <div className="actions-row">
              {souko?.souko_id ? (
                <button onClick={() => copy(String(souko?.souko_id))}>souko_idコピー</button>
              ) : (
                <button onClick={ensureSouko} disabled={loading}>souko作成</button>
              )}
              <Link to="/admin/master/souko" className="link">soukoマスタ</Link>
            </div>

            <div className="upload">
              <div className="upload-row">
                <select
                  value={uploadKubun}
                  onChange={(e) => setUploadKubun(e.target.value)}
                  disabled={uploading}
                  className="upload-kubun"
                  aria-label="アップロード区分"
                >
                  <option value="teishutsu">提出物</option>
                  <option value="naibu">内部</option>
                </select>
                <select
                  value={uploadDocCategory}
                  onChange={(e) => setUploadDocCategory(e.target.value)}
                  disabled={uploading}
                  className="upload-kubun"
                  aria-label="書類カテゴリ"
                >
                  {SOUKO_DOC_CATEGORY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} disabled={uploading} />
                <button onClick={onUpload} disabled={!file || uploading}>
                  {uploading ? 'アップロード中...' : 'アップロード'}
                </button>
              </div>
              {lastUpload?.key ? (
                <div className="upload-last">
                  <div className="label">直近アップロード</div>
                  <div className="value">
                    <code>{lastUpload.key}</code>
                    <button onClick={() => copy(lastUpload.key)}>キーコピー</button>
                    {lastUpload.get_url ? (
                      <a className="link" href={lastUpload.get_url} target="_blank" rel="noreferrer">開く(期限あり)</a>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="filelist">
              <div className="filelist-head">
                <div className="label">
                  登録済みファイル
                  <span className="muted-inline">
                    （表示: {soukoView === 'teishutsu' ? '提出物' : soukoView === 'naibu' ? '内部' : '全て'}）
                  </span>
                </div>
                <div className="count">{visibleFiles.length}</div>
              </div>
              {visibleFiles.length === 0 ? (
                <div className="muted">まだ登録がありません（アップロードすると一覧に残ります）</div>
              ) : (
                <div className="filelist-rows">
                  {visibleFiles.slice().reverse().map((f) => (
                    <div className="souko-file-card" key={f.key}>
                      <div className="souko-thumb">
                        {isImageFile(f.file_name, f.content_type, f.key) && f.open_url ? (
                          <img src={f.open_url} alt={f.file_name || f.key} loading="lazy" />
                        ) : (
                          <span className="kind">{fileKindLabel(f.file_name, f.content_type, f.key)}</span>
                        )}
                      </div>
                      <div className="souko-file-main">
                        <div className="file-name" title={f.file_name || f.key}>{f.file_name || '(no name)'}</div>
                        <div className="file-meta">
                          <span className="file-sub">{f.content_type || 'content-type: -'}</span>
                          <span className="file-sub">{findOptionLabel(SOUKO_DOC_CATEGORY_OPTIONS, f.doc_category) || '未分類'}</span>
                          <span className="file-sub">{f.size ? `${f.size} bytes` : '-'}</span>
                          <span className="file-sub">{f.uploaded_at || ''}</span>
                        </div>
                      </div>
                      <div className="souko-file-actions">
                        {f.open_url ? (
                          <a className="link" href={f.open_url} target="_blank" rel="noreferrer">開く</a>
                        ) : null}
                        <button onClick={() => copy(f.key)}>キーコピー</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
          </div>
        </>
      ) : (
        <div className="tenpo-karte-grid tenpo-karte-grid-detail">
          <section className="card card-large card-full">
            <div className="card-title-row">
              <div>
                <div className="card-title">カルテ詳細</div>
                <div className="muted small" style={{ marginTop: 6 }}>
                  最終更新: <code>{fmtDateTimeJst(karteDetail?.updated_at || tenpo?.updated_at || '') || '—'}</code>
                  {String(karteDetail?.updated_by || '').trim() ? (
                    <>
                      {' '} / 更新者: <code>{String(karteDetail.updated_by)}</code>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="seg-tabs tenpo-detail-save-top">
                <button type="button" onClick={saveKarteDetailNow} disabled={savingKarteDetail}>
                  {savingKarteDetail ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
            {isMobileLayout ? (
              <div className="tenpo-mobile-form-actions">
                <button type="button" className="btn-primary" onClick={saveKarteDetailNow} disabled={savingKarteDetail}>
                  {savingKarteDetail ? '保存中...' : '保存'}
                </button>
                <button type="button" onClick={() => setKarteView(KARTE_VIEW.SUMMARY)}>
                  概要へ
                </button>
              </div>
            ) : null}

            <div className="karte-detail-layout">
              <div className="karte-detail-col">
                <section className="card card-sub">
                  <div className="card-title-row">
                    <div className="card-title">サービスプラン</div>
                    <div className="seg-tabs">
                      <button type="button" onClick={addServicePlan}>追加</button>
                    </div>
                  </div>
                  {servicePlanCycleGroups.length > 0 ? (
                    <div className="service-cycle-groups">
                      {servicePlanFrequencyLabel ? (
                        <div className="service-cycle-frequency">
                          <span className="pill">頻度: {servicePlanFrequencyLabel}</span>
                        </div>
                      ) : null}
                      {servicePlanCycleGroups.map((g) => (
                        <div key={String(g?.cycleValue || g?.cycleLabel || '')} className="service-cycle-group">
                          <span className="service-cycle-label">{g.cycleLabel}</span>
                          <div className="service-cycle-tags">
                            {g.services.map((svc) => (
                              <span key={`${g.cycleValue}:${svc}`} className="service-cycle-tag">{svc}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="muted">未登録</div>
                  )}
                  <details className="karte-accordion" style={{ marginTop: 10 }}>
                    <summary>
                      <span className="label">サービス個別編集</span>
                      <span className="hint">{Array.isArray(karteDetail?.service_plan) ? `${karteDetail.service_plan.length}件` : '0件'}</span>
                    </summary>
                    <div className="accordion-body">
                      {Array.isArray(karteDetail?.service_plan) && karteDetail.service_plan.length > 0 ? (
                        <div className="service-plan-list">
                          {karteDetail.service_plan.map((sp, i) => (
                            <ServicePlanRow
                              key={i}
                              index={i}
                              sp={sp}
                              services={services}
                              onUpdate={(idx, patch) => updateServicePlan(idx, patch)}
                              onRemove={(idx) => removeServicePlan(idx)}
                              onToggleMonth={(idx, month) => toggleServicePlanMonth(idx, month)}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="muted">未登録</div>
                      )}
                    </div>
                  </details>
                </section>

                <section className="card card-sub">
                  <div className="card-title-row">
                    <div className="card-title">ルール</div>
                  </div>
                  <div className="form-grid">
                    <label className="f">
                      <div className="lbl">セキュリティボックスNo</div>
                      <input
                        value={String(karteDetail?.spec?.security_box_number || '')}
                        onChange={(e) => setKarteField('spec.security_box_number', clampStr(e.target.value, 30))}
                        placeholder="例: 1"
                      />
                    </label>
                    <label className="f">
                      <div className="lbl">鍵の位置</div>
                      <input
                        value={String(karteDetail?.spec?.key_location || '')}
                        onChange={(e) => setKarteField('spec.key_location', clampStr(e.target.value, 60))}
                        placeholder="例: 受付右棚"
                      />
                    </label>
                    <label className="f">
                      <div className="lbl">ブレーカーの位置</div>
                      <input
                        value={String(karteDetail?.spec?.breaker_location || '')}
                        onChange={(e) => setKarteField('spec.breaker_location', clampStr(e.target.value, 60))}
                        placeholder="例: 厨房奥"
                      />
                    </label>
                    <label className="f">
                      <div className="lbl">営業時間</div>
                      <input
                        value={String(karteDetail?.spec?.business_hours || '')}
                        onChange={(e) => setKarteField('spec.business_hours', clampStr(e.target.value, 80))}
                        placeholder="例: 11:00-23:00（L.O 22:30）"
                      />
                    </label>
                    <label className="f">
                      <div className="lbl">鍵の扱い *</div>
                      <input
                        value={String(karteDetail?.spec?.key_handling || '')}
                        onChange={(e) => setKarteField('spec.key_handling', clampStr(e.target.value, 120))}
                        placeholder="例: キーボックスNo1 / 退出時に施錠確認"
                      />
                    </label>
                    <label className="f">
                      <div className="lbl">連絡手段</div>
                      <input
                        value={String(karteDetail?.spec?.contact_method || '')}
                        onChange={(e) => setKarteField('spec.contact_method', clampStr(e.target.value, 80))}
                        placeholder="例: 電話 / LINE / SMS / メール"
                      />
                    </label>
                  </div>
                </section>

              </div>

              <div className="karte-detail-col">
                <section className="card card-sub">
                  <div className="card-title-row">
                    <div className="card-title">報告設計（現場 → 管理/顧客）</div>
                  </div>
                  <div className="muted small">
                    清掃員の報告要件と、お客様提出物の必須要件をここで固定します。自由記述ではなく、構造化項目中心で運用。
                  </div>
                  <div className="form-grid" style={{ marginTop: 10 }}>
                    <label className="f">
                      <div className="lbl">標準作業人数</div>
                      <input
                        value={String(karteDetail?.report_profile?.standard_team_size || '')}
                        onChange={(e) => setReportProfileField('standard_team_size', clampStr(e.target.value, 8))}
                        placeholder="例: 2"
                      />
                    </label>
                    <label className="f">
                      <div className="lbl">標準作業時間（分）</div>
                      <input
                        value={String(karteDetail?.report_profile?.standard_duration_min || '')}
                        onChange={(e) => setReportProfileField('standard_duration_min', clampStr(e.target.value, 8))}
                        placeholder="例: 180"
                      />
                    </label>
                    <label className="f">
                      <div className="lbl">現場報告言語</div>
                      <select
                        value={String(karteDetail?.report_profile?.report_language || 'ja')}
                        onChange={(e) => setReportProfileField('report_language', e.target.value)}
                      >
                        <option value="ja">日本語</option>
                        <option value="pt">Portuguese</option>
                        <option value="en">English</option>
                      </select>
                    </label>
                    <label className="f">
                      <div className="lbl">顧客提出期限</div>
                      <select
                        value={String(karteDetail?.report_profile?.customer_due || 'same_day')}
                        onChange={(e) => setReportProfileField('customer_due', e.target.value)}
                      >
                        {REPORT_DUE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="f" style={{ gridColumn: '1 / -1' }}>
                      <div className="lbl">現場報告スコープ（短文）</div>
                      <input
                        value={String(karteDetail?.report_profile?.report_scope || '')}
                        onChange={(e) => setReportProfileField('report_scope', clampStr(e.target.value, 200))}
                        placeholder="例: 厨房/ホール/トイレ/ダクト"
                      />
                    </label>
                    <label className="f" style={{ gridColumn: '1 / -1' }}>
                      <div className="lbl">顧客連絡チャネル</div>
                      <input
                        value={String(karteDetail?.report_profile?.customer_contact_channel || '')}
                        onChange={(e) => setReportProfileField('customer_contact_channel', clampStr(e.target.value, 80))}
                        placeholder="例: メール提出 / LINEワークス"
                      />
                    </label>
                  </div>
                  <div className="subhead">現場報告の必須項目</div>
                  <div className="check-grid">
                    {REPORT_FIELD_REQUIRED_OPTIONS.map((o) => (
                      <label key={o.key} className="chk">
                        <input
                          type="checkbox"
                          checked={toBool(karteDetail?.report_profile?.field_required?.[o.key], false)}
                          onChange={(e) => setReportProfileFlag('field_required', o.key, e.target.checked)}
                        />
                        <span>{o.label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="subhead">顧客報告の必須項目</div>
                  <div className="check-grid">
                    {CUSTOMER_REPORT_REQUIRED_OPTIONS.map((o) => (
                      <label key={o.key} className="chk">
                        <input
                          type="checkbox"
                          checked={toBool(karteDetail?.report_profile?.customer_required?.[o.key], false)}
                          onChange={(e) => setReportProfileFlag('customer_required', o.key, e.target.checked)}
                        />
                        <span>{o.label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="form-grid" style={{ marginTop: 10 }}>
                    <label className="f" style={{ gridColumn: '1 / -1' }}>
                      <div className="lbl">顧客向け追記（短文）</div>
                      <input
                        value={String(karteDetail?.report_profile?.customer_note || '')}
                        onChange={(e) => setReportProfileField('customer_note', clampStr(e.target.value, 200))}
                        placeholder="例: 異常時は即日連絡、写真3枚以上添付"
                      />
                    </label>
                  </div>
                </section>

              </div>

              <div className="karte-detail-col karte-detail-col-right">
                <section className="card card-sub">
                  <div className="card-title-row">
                    <div className="card-title">設備</div>
                  </div>
                  <div className="check-grid">
                    {EQUIPMENT_OPTIONS.map((it) => (
                      <label key={it.code} className="chk">
                        <input
                          type="checkbox"
                          checked={Array.isArray(karteDetail?.equipment) && karteDetail.equipment.includes(it.code)}
                          onChange={() => toggleEquipment(it.code)}
                        />
                        <span>{it.label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="subhead">客席</div>
                  <div className="check-grid">
                    {[
                      { code: 'counter', label: 'カウンター席' },
                      { code: 'box', label: 'ボックス席' },
                      { code: 'zashiki', label: '座敷' },
                    ].map((it) => (
                      <label key={it.code} className="chk">
                        <input
                          type="checkbox"
                          checked={Boolean(karteDetail?.seats?.[it.code])}
                          onChange={(e) => setKarteField(`seats.${it.code}`, e.target.checked)}
                        />
                        <span>{it.label}</span>
                      </label>
                    ))}
                  </div>
                </section>

                <section className="card card-sub">
                  <div className="card-title-row">
                    <div className="card-title">担当履歴</div>
                    <div className="seg-tabs">
                      <button type="button" onClick={addStaffHistory}>追加</button>
                    </div>
                  </div>
                  {Array.isArray(karteDetail?.staff_history) && karteDetail.staff_history.length > 0 ? (
                    <div className="rows">
                      {karteDetail.staff_history.map((h, i) => (
                        <div key={i} className="row row-3">
                          <div className="tag-picker">
                            <div className="tag-row">
                              {(Array.isArray(h?.members) ? h.members : (h?.name ? [{ jinzai_id: h?.jinzai_id || '', name: h.name }] : [])).map((m) => {
                                const label = String(m?.name || m?.jinzai_id || '').trim();
                                if (!label) return null;
                                return (
                                  <span key={`${String(m?.jinzai_id || '')}-${label}`} className="tag-chip">
                                    {label}
                                    <button
                                      type="button"
                                      className="x"
                                      onClick={() => removeStaffHistoryMember(i, m)}
                                      aria-label="remove"
                                    >
                                      ×
                                    </button>
                                  </span>
                                );
                              })}
                            </div>
                            <div className="tag-controls">
                              <select
                                value=""
                                onChange={(e) => {
                                  const id = e.target.value;
                                  if (!id) return;
                                  const hit = jinzais.find((j) => String(j.jinzai_id) === String(id));
                                  addStaffHistoryMember(i, { jinzai_id: id, name: hit?.name || '' });
                                }}
                                aria-label="担当者追加"
                              >
                                <option value="">担当者（清掃/メンテのみ）を追加</option>
                                {jinzais.map((j) => (
                                  <option key={j.jinzai_id} value={j.jinzai_id}>
                                    {j.name}{j.email ? ` / ${j.email}` : ''}{j.phone ? ` / ${j.phone}` : ''}
                                  </option>
                                ))}
                              </select>
                              <input
                                list="tenpo-karte-jinzai-name-list"
                                placeholder="氏名を手入力して追加（任意）"
                                onKeyDown={(e) => {
                                  if (e.key !== 'Enter') return;
                                  const v = String(e.currentTarget.value || '').trim();
                                  if (!v) return;
                                  addStaffHistoryMember(i, { jinzai_id: '', name: v });
                                  e.currentTarget.value = '';
                                }}
                                aria-label="担当者氏名（手入力）"
                              />
                            </div>
                            <div className="muted small">複数選択OK（タグ）</div>
                          </div>
                          <input
                            type="date"
                            value={String(h?.start_date || '')}
                            onChange={(e) => updateStaffHistory(i, 'start_date', e.target.value)}
                          />
                          <input
                            type="date"
                            value={String(h?.end_date || '')}
                            onChange={(e) => updateStaffHistory(i, 'end_date', e.target.value)}
                          />
                          <button type="button" onClick={() => removeStaffHistory(i)}>×</button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="muted">未登録</div>
                  )}
                </section>

                <section className="card card-sub">
                  <div className="card-title-row">
                    <div className="card-title">消耗品</div>
                    <div className="seg-tabs">
                      <button type="button" onClick={addConsumable}>追加</button>
                    </div>
                  </div>
                  {Array.isArray(karteDetail?.consumables) && karteDetail.consumables.length > 0 ? (
                    <div className="rows">
                      {karteDetail.consumables.map((c, i) => (
                        <div key={i} className="row">
                          <input
                            placeholder="品名"
                            value={String(c?.name || '')}
                            onChange={(e) => updateConsumable(i, 'name', e.target.value)}
                          />
                          <input
                            placeholder="数量"
                            value={String(c?.quantity || '')}
                            onChange={(e) => updateConsumable(i, 'quantity', e.target.value)}
                          />
                          <button type="button" onClick={() => removeConsumable(i)}>×</button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="muted">未登録</div>
                  )}
                </section>

                <section className="card card-sub">
                  <div className="card-title-row">
                    <div className="card-title">使用薬剤・資材（追記）</div>
                    <div className="seg-tabs">
                      <button type="button" onClick={addReportChemical}>追加</button>
                    </div>
                  </div>
                  <div className="muted small">
                    現場で使う薬剤と使用量の基準。報告時に選択/追記しやすいよう、名称・希釈・対象箇所を固定します。
                  </div>
                  {Array.isArray(karteDetail?.report_profile?.chemicals) && karteDetail.report_profile.chemicals.length > 0 ? (
                    <div className="service-plan-list" style={{ marginTop: 10 }}>
                      {karteDetail.report_profile.chemicals.map((ch, i) => (
                        <div key={ch?.chemical_id || i} className="service-plan-row">
                          <div className="service-plan-head">
                            <div className="service-plan-title">薬剤 {i + 1}</div>
                            <button type="button" onClick={() => removeReportChemical(i)}>×</button>
                          </div>
                          <div className="form-grid">
                            <label className="f">
                              <div className="lbl">名称</div>
                              <input
                                value={String(ch?.name || '')}
                                onChange={(e) => updateReportChemical(i, { name: e.target.value })}
                                placeholder="例: アルカリ洗剤A"
                              />
                            </label>
                            <label className="f">
                              <div className="lbl">希釈率</div>
                              <input
                                value={String(ch?.dilution || '')}
                                onChange={(e) => updateReportChemical(i, { dilution: e.target.value })}
                                placeholder="例: 10倍"
                              />
                            </label>
                            <label className="f">
                              <div className="lbl">使用量</div>
                              <input
                                value={String(ch?.amount || '')}
                                onChange={(e) => updateReportChemical(i, { amount: e.target.value })}
                                placeholder="例: 200"
                              />
                            </label>
                            <label className="f">
                              <div className="lbl">単位</div>
                              <select
                                value={String(ch?.unit || 'ml')}
                                onChange={(e) => updateReportChemical(i, { unit: e.target.value })}
                              >
                                {CHEMICAL_UNIT_OPTIONS.map((u) => (
                                  <option key={u.value} value={u.value}>{u.label}</option>
                                ))}
                              </select>
                            </label>
                            <label className="f" style={{ gridColumn: '1 / -1' }}>
                              <div className="lbl">対象箇所</div>
                              <input
                                value={String(ch?.target || '')}
                                onChange={(e) => updateReportChemical(i, { target: e.target.value })}
                                placeholder="例: 厨房床 / グリスト / 壁面"
                              />
                            </label>
                            <label className="f" style={{ gridColumn: '1 / -1' }}>
                              <div className="lbl">備考（短文）</div>
                              <input
                                value={String(ch?.note || '')}
                                onChange={(e) => updateReportChemical(i, { note: e.target.value })}
                                placeholder="例: 塩素系と混合不可"
                              />
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="muted" style={{ marginTop: 10 }}>未登録</div>
                  )}
                </section>
              </div>

              <section className="card card-sub card-wide">
                <div className="card-title-row">
                  <div className="card-title">清掃チェックポイント（報告基準）</div>
                  <div className="seg-tabs">
                    <button type="button" onClick={addReportCheckpoint}>追加</button>
                  </div>
                </div>
                <div className="muted small">
                  各ゾーンで「何を見て、どの状態なら完了か」を固定。現場報告・顧客報告の両方で同じ基準を使う。
                </div>
                {Array.isArray(karteDetail?.report_profile?.checkpoints) && karteDetail.report_profile.checkpoints.length > 0 ? (
                  <div className="service-plan-list" style={{ marginTop: 10 }}>
                    {karteDetail.report_profile.checkpoints.map((cp, i) => (
                      <div key={cp?.checkpoint_id || i} className="service-plan-row">
                        <div className="service-plan-head">
                          <div className="service-plan-title">基準 {i + 1}</div>
                          <button type="button" onClick={() => removeReportCheckpoint(i)}>×</button>
                        </div>
                        <div className="form-grid">
                          <label className="f">
                            <div className="lbl">ゾーン</div>
                            <input
                              value={String(cp?.zone || '')}
                              onChange={(e) => updateReportCheckpoint(i, { zone: e.target.value })}
                              placeholder="例: 厨房 / ホール / トイレ"
                            />
                          </label>
                          <label className="f">
                            <div className="lbl">項目</div>
                            <input
                              value={String(cp?.item || '')}
                              onChange={(e) => updateReportCheckpoint(i, { item: e.target.value })}
                              placeholder="例: グリスト / 床 / 壁面"
                            />
                          </label>
                          <label className="f" style={{ gridColumn: '1 / -1' }}>
                            <div className="lbl">完了基準（短文）</div>
                            <input
                              value={String(cp?.standard || '')}
                              onChange={(e) => updateReportCheckpoint(i, { standard: e.target.value })}
                              placeholder="例: 油膜なし、手触りべたつきなし"
                            />
                          </label>
                          <label className="f">
                            <div className="lbl">写真必須</div>
                            <select
                              value={toBool(cp?.photo_required, true) ? 'y' : 'n'}
                              onChange={(e) => updateReportCheckpoint(i, { photo_required: e.target.value === 'y' })}
                            >
                              <option value="y">必須</option>
                              <option value="n">任意</option>
                            </select>
                          </label>
                          <label className="f">
                            <div className="lbl">顧客に表示</div>
                            <select
                              value={toBool(cp?.customer_visible, true) ? 'y' : 'n'}
                              onChange={(e) => updateReportCheckpoint(i, { customer_visible: e.target.value === 'y' })}
                            >
                              <option value="y">表示する</option>
                              <option value="n">内部のみ</option>
                            </select>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="muted" style={{ marginTop: 10 }}>未登録</div>
                )}
              </section>

              <section className="card card-sub card-wide">
                <div className="card-title-row">
                  <div className="card-title">HACCP 準拠チェック</div>
                  <div className="muted small">
                    状態はHACCP内に記録（チェックのみ）
                    {' '} / 最終更新: <code>{fmtDateTimeJst(karteDetail?.haccp?.updated_at || '') || '—'}</code>
                  </div>
                </div>
                <div className="haccp-grid">
                  {HACCP_GROUPS.map((g) => (
                    <div key={g.title} className="haccp-group">
                      <div className="haccp-group-title">{g.title}</div>
                      <div className="haccp-items">
                        {g.items.map((it) => {
                          const st = String(karteDetail?.haccp?.items?.[it.code]?.status || HACCP_STATUS.MIKANRYO);
                          return (
                            <div className="haccp-item" key={it.code}>
                              <div className="haccp-item-label">
                                <div className="label">{it.label}</div>
                                <div className="code"><code>{it.code}</code></div>
                              </div>
                              <div className="haccp-item-controls" role="radiogroup" aria-label={it.label}>
                                <label className={`radio ${st === HACCP_STATUS.MIKANRYO ? 'active' : ''}`}>
                                  <input
                                    type="radio"
                                    name={it.code}
                                    checked={st === HACCP_STATUS.MIKANRYO}
                                    onChange={() => setHaccpItemStatus(it.code, HACCP_STATUS.MIKANRYO)}
                                  />
                                  未
                                </label>
                                <label className={`radio ${st === HACCP_STATUS.KAKUNIN_ZUMI ? 'active' : ''}`}>
                                  <input
                                    type="radio"
                                    name={it.code}
                                    checked={st === HACCP_STATUS.KAKUNIN_ZUMI}
                                    onChange={() => setHaccpItemStatus(it.code, HACCP_STATUS.KAKUNIN_ZUMI)}
                                  />
                                  OK
                                </label>
                                <label className={`radio ${st === HACCP_STATUS.GAITOU_NASHI ? 'active' : ''}`}>
                                  <input
                                    type="radio"
                                    name={it.code}
                                    checked={st === HACCP_STATUS.GAITOU_NASHI}
                                    onChange={() => setHaccpItemStatus(it.code, HACCP_STATUS.GAITOU_NASHI)}
                                  />
                                  対象外
                                </label>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
