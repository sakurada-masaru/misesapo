import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import './admin-yotei-timeline.css'; // Reuse styling
import { normalizeGatewayBase, YOTEI_GATEWAY } from '../../shared/api/gatewayBase';
import { getServiceCategoryLabel } from './serviceCategoryCatalog';
// Hamburger / admin-top are provided by GlobalNav.

function isLocalUiHost() {
  if (typeof window === 'undefined') return false;
  const h = window.location?.hostname || '';
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
}

const IS_LOCAL = import.meta.env?.DEV || isLocalUiHost();
const API_BASE = IS_LOCAL
  ? '/api'
  : normalizeGatewayBase(import.meta.env?.VITE_API_BASE, YOTEI_GATEWAY);
const YAKUSOKU_FALLBACK_BASE = IS_LOCAL
  ? '/api2'
  : normalizeGatewayBase(import.meta.env?.VITE_YAKUSOKU_API_BASE, API_BASE);
const MASTER_API_BASE = IS_LOCAL
  ? '/api-master'
  : normalizeGatewayBase(import.meta.env?.VITE_MASTER_API_BASE, 'https://jtn6in2iuj.execute-api.ap-northeast-1.amazonaws.com/prod');

const MONTHLY_BUCKET = { key: 'monthly', label: '毎月 (1〜12月)' };
const BIMONTHLY_LABEL = '隔月（1〜12月指定）';
const QUARTERLY_LABEL = '四半期（1〜12月指定）';
const HALF_YEAR_LABEL = '半年（1〜12月指定）';
const YEARLY_BUCKET = { key: 'yearly', label: '年 (年1回)' };
const DAILY_BUCKET = { key: 'daily', label: '毎日' };
const MONTH_NUMBERS = Array.from({ length: 12 }, (_, i) => i + 1);
const makeMonthBuckets = (prefix) => MONTH_NUMBERS.map((m) => ({
  key: `${prefix}_m${String(m).padStart(2, '0')}`,
  label: `${m}`,
}));
const QUARTERLY_BUCKETS = makeMonthBuckets('quarterly');
const HALF_YEAR_BUCKETS = makeMonthBuckets('half_year');
const BIMONTHLY_BUCKETS = makeMonthBuckets('bimonthly');
const WEEKDAY_OPTIONS = [
  { key: 'mon', label: '月' },
  { key: 'tue', label: '火' },
  { key: 'wed', label: '水' },
  { key: 'thu', label: '木' },
  { key: 'fri', label: '金' },
  { key: 'sat', label: '土' },
  { key: 'sun', label: '日' },
];
const WEEKLY_BUCKETS = WEEKDAY_OPTIONS.map((d) => ({ key: `weekly_${d.key}`, label: `${d.label}` }));
const BIWEEKLY_BUCKETS = WEEKDAY_OPTIONS.map((d) => ({ key: `biweekly_${d.key}`, label: `${d.label}` }));
const PLAN_BUCKETS = [
  MONTHLY_BUCKET,
  ...BIMONTHLY_BUCKETS,
  ...QUARTERLY_BUCKETS,
  ...HALF_YEAR_BUCKETS,
  YEARLY_BUCKET,
  DAILY_BUCKET,
  ...WEEKLY_BUCKETS,
  ...BIWEEKLY_BUCKETS,
];

const DEFAULT_ONSITE_FLAGS = {
  has_spare_key: false,
  has_keybox: false,
  has_post_management: false,
  has_customer_attendance: false,
  key_loss_replacement_risk: false,
  require_gas_valve_check: false,
  trash_pickup_required: false,
  trash_photo_required: false,
};

const ONSITE_FLAG_GROUPS = [
  {
    title: '鍵カテゴリ',
    items: [
      { key: 'has_spare_key', label: '鍵預かり' },
      { key: 'has_keybox', label: 'キーボックスあり' },
      { key: 'has_post_management', label: 'ポスト管理' },
      { key: 'key_loss_replacement_risk', label: '鍵紛失＝鍵交換（注意）' },
    ],
  },
  {
    title: '運用カテゴリ',
    items: [
      { key: 'has_customer_attendance', label: '立会いあり' },
      { key: 'require_gas_valve_check', label: 'ガス栓確認 必須' },
      { key: 'trash_pickup_required', label: 'ゴミ回収あり' },
      { key: 'trash_photo_required', label: 'ゴミ回収時に写真 必須' },
    ],
  },
];

function createEmptyTaskMatrix() {
  return Object.fromEntries(PLAN_BUCKETS.map((b) => [b.key, []]));
}

function createEmptyBucketEnabled() {
  return Object.fromEntries(PLAN_BUCKETS.map((b) => [b.key, false]));
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

function getBucketFamilyKeys(bucketKey) {
  const key = String(bucketKey || '');
  if (key === YEARLY_BUCKET.key) return [YEARLY_BUCKET.key];
  if (key === DAILY_BUCKET.key) return [DAILY_BUCKET.key];
  if (key.startsWith('quarterly_')) return QUARTERLY_BUCKETS.map((b) => b.key);
  if (key.startsWith('half_year_')) return HALF_YEAR_BUCKETS.map((b) => b.key);
  if (key.startsWith('bimonthly_')) return BIMONTHLY_BUCKETS.map((b) => b.key);
  if (key.startsWith('weekly_')) return WEEKLY_BUCKETS.map((b) => b.key);
  if (key.startsWith('biweekly_')) return BIWEEKLY_BUCKETS.map((b) => b.key);
  return [MONTHLY_BUCKET.key];
}

async function fetchYakusokuWithFallback(path, options = {}) {
  const primaryBase = API_BASE.replace(/\/$/, '');
  const primaryRes = await fetch(`${primaryBase}${path}`, options);
  if (primaryRes.ok) return primaryRes;
  if (![401, 403, 404].includes(primaryRes.status)) return primaryRes;
  const fallbackBase = YAKUSOKU_FALLBACK_BASE.replace(/\/$/, '');
  if (fallbackBase === primaryBase) return primaryRes;
  return fetch(`${fallbackBase}${path}`, options);
}

export default function AdminYakusokuPage() {
  const [items, setItems] = useState([]);
  const [services, setServices] = useState([]);
  const [tenpos, setTenpos] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [listQuery, setListQuery] = useState('');
  const [modalData, setModalData] = useState(null);
  const [servicePickerOpen, setServicePickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const getServiceCategoryMeta = useCallback((svc) => {
    const raw = String(svc?.category || svc?.category_concept || '').trim();
    const normalized = raw || 'uncategorized';
    return {
      key: normalized,
      label: getServiceCategoryLabel(raw),
    };
  }, []);

  const normalizeServiceConcept = useCallback((svc) => {
    return getServiceCategoryMeta(svc).label;
  }, [getServiceCategoryMeta]);

  const normalizeTaskMatrix = useCallback((taskMatrix) => {
    const base = createEmptyTaskMatrix();
    if (!taskMatrix || typeof taskMatrix !== 'object') return base;
    for (const b of PLAN_BUCKETS) {
      const arr = taskMatrix[b.key];
      base[b.key] = Array.isArray(arr) ? arr.map((x) => String(x)).filter(Boolean) : [];
    }
    const mergeInto = (targetKey, values) => {
      const merged = new Set([...(base[targetKey] || []), ...values]);
      base[targetKey] = [...merged];
    };
    const legacyValues = (legacyKey) => (
      Array.isArray(taskMatrix[legacyKey])
        ? taskMatrix[legacyKey].map((x) => String(x)).filter(Boolean)
        : []
    );
    const applyLegacy = (legacyKey, targetKeys) => {
      const vals = legacyValues(legacyKey);
      if (!vals.length) return;
      targetKeys.forEach((k) => mergeInto(k, vals));
    };

    // Backward compatibility: legacy buckets are expanded into direct month/weekday buckets.
    applyLegacy('odd_month', ['monthly']);
    applyLegacy('even_month', ['monthly']);
    applyLegacy('yearly', [YEARLY_BUCKET.key]);
    applyLegacy('daily', [DAILY_BUCKET.key]);
    applyLegacy('month_01', ['quarterly_m01']);
    applyLegacy('month_02', ['quarterly_m02']);
    applyLegacy('month_03', ['quarterly_m03']);
    applyLegacy('month_04', ['quarterly_m04']);
    applyLegacy('month_05', ['quarterly_m05']);
    applyLegacy('month_06', ['quarterly_m06']);
    applyLegacy('month_07', ['quarterly_m07']);
    applyLegacy('month_08', ['quarterly_m08']);
    applyLegacy('month_09', ['quarterly_m09']);
    applyLegacy('month_10', ['quarterly_m10']);
    applyLegacy('month_11', ['quarterly_m11']);
    applyLegacy('month_12', ['quarterly_m12']);

    applyLegacy('quarterly_a', ['quarterly_m01', 'quarterly_m04', 'quarterly_m07', 'quarterly_m10']);
    applyLegacy('quarterly_b', ['quarterly_m02', 'quarterly_m05', 'quarterly_m08', 'quarterly_m11']);
    applyLegacy('quarterly_c', ['quarterly_m03', 'quarterly_m06', 'quarterly_m09', 'quarterly_m12']);
    applyLegacy('quarterly_d', ['quarterly_m04', 'quarterly_m08', 'quarterly_m12']);

    applyLegacy('half_year_a', ['half_year_m01', 'half_year_m07']);
    applyLegacy('half_year_b', ['half_year_m02', 'half_year_m08']);
    applyLegacy('half_year_c', ['half_year_m03', 'half_year_m09']);
    applyLegacy('half_year_d', ['half_year_m04', 'half_year_m10']);
    applyLegacy('half_year_e', ['half_year_m05', 'half_year_m11']);
    applyLegacy('half_year_f', ['half_year_m06', 'half_year_m12']);

    applyLegacy('bimonthly_a', ['bimonthly_m01', 'bimonthly_m03', 'bimonthly_m05', 'bimonthly_m07', 'bimonthly_m09', 'bimonthly_m11']);
    applyLegacy('bimonthly_b', ['bimonthly_m02', 'bimonthly_m04', 'bimonthly_m06', 'bimonthly_m08', 'bimonthly_m10', 'bimonthly_m12']);

    WEEKDAY_OPTIONS.forEach((d) => {
      applyLegacy(`weekly_a_${d.key}`, [`weekly_${d.key}`]);
      applyLegacy(`biweekly_a_${d.key}`, [`biweekly_${d.key}`]);
      applyLegacy(`biweekly_b_${d.key}`, [`biweekly_${d.key}`]);
    });
    return base;
  }, []);

  const normalizeOnsiteFlags = useCallback((flags) => {
    const src = flags && typeof flags === 'object' ? flags : {};
    const out = { ...DEFAULT_ONSITE_FLAGS };
    for (const k of Object.keys(out)) out[k] = Boolean(src[k]);
    return out;
  }, []);

  const normalizeServiceSelection = useCallback((src) => {
    const ids = Array.isArray(src?.service_ids)
      ? src.service_ids.map((x) => String(x)).filter(Boolean)
      : [];
    const names = Array.isArray(src?.service_names)
      ? src.service_names.map((x) => String(x)).filter(Boolean)
      : [];

    if (!ids.length && src?.service_id) ids.push(String(src.service_id));
    if (!names.length && src?.service_name) names.push(String(src.service_name));
    return { service_ids: ids, service_names: names };
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchYakusokuWithFallback('/yakusoku', { headers: authHeaders() });
      if (!res.ok) throw new Error(`Yakusoku HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.items || []);
    } catch (e) {
      console.error(e);
      window.alert('yakusokuの取得に失敗しました（権限または接続先を確認）');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    const run = async () => {
      try {
        const base = MASTER_API_BASE.replace(/\/$/, '');
        const res = await fetch(`${base}/master/service?limit=2000&jotai=yuko`, { headers: authHeaders(), cache: 'no-store' });
        if (!res.ok) throw new Error(`Service HTTP ${res.status}`);
        const data = await res.json();
        setServices(Array.isArray(data) ? data : (data?.items || []));
      } catch (e) {
        console.error('Failed to fetch services:', e);
        setServices([]);
      }
    };
    run();
  }, []);

  useEffect(() => {
    const run = async () => {
      try {
        const base = MASTER_API_BASE.replace(/\/$/, '');
        const res = await fetch(`${base}/master/keiyaku?limit=5000&jotai=yuko`, {
          headers: authHeaders(),
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`Keiyaku HTTP ${res.status}`);
        const data = await res.json();
        const rows = Array.isArray(data) ? data : (data?.items || []);
        const normalized = rows
          .map((it) => ({
            ...it,
            keiyaku_id: String(it?.keiyaku_id || it?.id || '').trim(),
            name: String(it?.name || '').trim(),
            tenpo_id: String(it?.tenpo_id || '').trim(),
            start_date: String(it?.start_date || '').trim(),
            application_date: String(it?.application_date || '').trim(),
            status: String(it?.status || '').trim(),
            updated_at: String(it?.updated_at || '').trim(),
            jotai: String(it?.jotai || 'yuko').trim(),
          }))
          .filter((it) => it.keiyaku_id);
        setContracts(normalized);
      } catch (e) {
        console.warn('Failed to fetch keiyaku:', e);
        setContracts([]);
      }
    };
    run();
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    if (servicePickerOpen) {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    } else {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    }
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, [servicePickerOpen]);

  useEffect(() => {
    const run = async () => {
      try {
        const base = MASTER_API_BASE.replace(/\/$/, '');
        const [toriRes, yagouRes, tenpoRes] = await Promise.all([
          fetch(`${base}/master/torihikisaki?limit=5000&jotai=yuko`, { headers: authHeaders(), cache: 'no-store' }),
          fetch(`${base}/master/yagou?limit=8000&jotai=yuko`, { headers: authHeaders(), cache: 'no-store' }),
          fetch(`${base}/master/tenpo?limit=20000&jotai=yuko`, { headers: authHeaders(), cache: 'no-store' }),
        ]);
        if (!toriRes.ok) throw new Error(`Torihikisaki HTTP ${toriRes.status}`);
        if (!yagouRes.ok) throw new Error(`Yagou HTTP ${yagouRes.status}`);
        if (!tenpoRes.ok) throw new Error(`Tenpo HTTP ${tenpoRes.status}`);

        const toriData = await toriRes.json();
        const yagouData = await yagouRes.json();
        const tenpoData = await tenpoRes.json();
        const toriItems = Array.isArray(toriData) ? toriData : (toriData?.items || []);
        const yagouItems = Array.isArray(yagouData) ? yagouData : (yagouData?.items || []);
        const tenpoItems = Array.isArray(tenpoData) ? tenpoData : (tenpoData?.items || []);

        const toriNameById = new Map(toriItems.map((it) => [it?.torihikisaki_id || it?.id, it?.name || '']));
        const yagouNameById = new Map(yagouItems.map((it) => [it?.yagou_id || it?.id, it?.name || '']));

        const normalized = tenpoItems
          .map((it) => {
            const tenpo_id = it?.tenpo_id || it?.id || '';
            const name = it?.name || '';
            const torihikisaki_id = it?.torihikisaki_id || '';
            const yagou_id = it?.yagou_id || '';
            const torihikisaki_name = toriNameById.get(torihikisaki_id) || '';
            const yagou_name = yagouNameById.get(yagou_id) || '';
            const search_blob = [
              name,
              tenpo_id,
              yagou_name,
              yagou_id,
              torihikisaki_name,
              torihikisaki_id,
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();
            return { tenpo_id, name, torihikisaki_id, yagou_id, torihikisaki_name, yagou_name, search_blob };
          })
          .filter((it) => it.tenpo_id && it.name)
          .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
        setTenpos(normalized);
      } catch (e) {
        console.error('Failed to fetch tenpos:', e);
        setTenpos([]);
      }
    };
    run();
  }, []);

  const openNew = () => {
    setServicePickerOpen(false);
    setModalData({
      isNew: true,
      type: 'teiki',
      tenpo_name: '',
      tenpo_query: '',
      service_id: '',
      service_name: '',
      service_ids: [],
      service_names: [],
      service_category: 'all',
      service_query: '',
      monthly_quota: 1,
      price: 0,
      start_date: dayjs().format('YYYY-MM-DD'),
      keiyaku_id: '',
      keiyaku_name: '',
      keiyaku_start_date: '',
      status: 'active',
      memo: '',
      onsite_flags: { ...DEFAULT_ONSITE_FLAGS },
      recurrence_rule: { type: 'flexible', task_matrix: createEmptyTaskMatrix() },
      _tagDrafts: {},
      _tagSearch: {},
      _tagAdvanced: {},
      _bucketEnabled: createEmptyBucketEnabled(),
      _monthLock: false,
    });
  };

  const openEdit = (item) => {
    const rr = item?.recurrence_rule && typeof item.recurrence_rule === 'object'
      ? item.recurrence_rule
      : { type: 'flexible' };
    const multiSvc = normalizeServiceSelection(item);
    const normalizedTaskMatrix = normalizeTaskMatrix(rr.task_matrix);
    setServicePickerOpen(false);
    const tenpoDisplay = [String(item?.yagou_name || '').trim(), String(item?.tenpo_name || '').trim()]
      .filter(Boolean)
      .join(' / ');
    setModalData({
      ...item,
      ...multiSvc,
      isNew: false,
      tenpo_query: tenpoDisplay || String(item?.tenpo_name || ''),
      service_category: 'all',
      service_query: item?.service_name || item?.service_id || '',
      keiyaku_id: String(item?.keiyaku_id || '').trim(),
      keiyaku_name: String(item?.keiyaku_name || '').trim(),
      keiyaku_start_date: String(item?.keiyaku_start_date || item?.contract_start_date || '').trim(),
      onsite_flags: normalizeOnsiteFlags(item?.onsite_flags),
      recurrence_rule: {
        ...rr,
        task_matrix: normalizedTaskMatrix,
      },
      _tagDrafts: {},
      _tagSearch: {},
      _tagAdvanced: {},
      _bucketEnabled: {
        ...createEmptyBucketEnabled(),
        ...Object.fromEntries(PLAN_BUCKETS.map((b) => [b.key, (normalizedTaskMatrix[b.key] || []).length > 0])),
      },
      _monthLock: false,
    });
  };

  const toggleServiceSelection = useCallback((svc, checked) => {
    const sid = String(svc?.service_id || '');
    if (!sid) return;
    const sname = String(svc?.name || sid);
    setModalData((prev) => {
      if (!prev) return prev;
      const ids = Array.isArray(prev.service_ids) ? [...prev.service_ids].map(String) : [];
      const names = Array.isArray(prev.service_names) ? [...prev.service_names].map(String) : [];
      const hit = ids.indexOf(sid);
      if (checked) {
        if (hit < 0) {
          ids.push(sid);
          names.push(sname);
        }
      } else if (hit >= 0) {
        ids.splice(hit, 1);
        names.splice(hit, 1);
      }
      const nextTaskMatrix = normalizeTaskMatrix(prev?.recurrence_rule?.task_matrix);
      if (!checked) {
        for (const k of Object.keys(nextTaskMatrix)) {
          nextTaskMatrix[k] = (nextTaskMatrix[k] || []).filter((x) => String(x) !== sid);
        }
      }
      return {
        ...prev,
        service_ids: ids,
        service_names: names,
        service_id: ids[0] || '',
        service_name: names[0] || '',
        recurrence_rule: {
          ...(prev?.recurrence_rule || { type: 'flexible' }),
          task_matrix: nextTaskMatrix,
        },
        price:
          prev.isNew && checked && Number(svc?.default_price || 0) > 0 && ids.length === 1
            ? Number(svc.default_price)
            : prev.price,
      };
    });
  }, []);

  const tenpoCandidates = useMemo(() => {
    const q = String(modalData?.tenpo_query || '').trim().toLowerCase();
    if (!q) return tenpos.slice(0, 12);
    return tenpos
      .filter((it) => (it.search_blob || '').includes(q))
      .slice(0, 20);
  }, [modalData?.tenpo_query, tenpos]);

  const tenpoMetaById = useMemo(() => {
    const m = new Map();
    (tenpos || []).forEach((tp) => {
      const id = String(tp?.tenpo_id || '').trim();
      if (!id) return;
      m.set(id, tp);
    });
    return m;
  }, [tenpos]);

  const tenpoMetaByName = useMemo(() => {
    const m = new Map();
    (tenpos || []).forEach((tp) => {
      const name = String(tp?.name || '').trim();
      if (!name || m.has(name)) return;
      m.set(name, tp);
    });
    return m;
  }, [tenpos]);

  const contractById = useMemo(() => {
    const m = new Map();
    (contracts || []).forEach((c) => {
      const id = String(c?.keiyaku_id || '').trim();
      if (!id) return;
      m.set(id, c);
    });
    return m;
  }, [contracts]);

  const pickPrimaryContractIdForTenpo = useCallback((tenpoId, currentId = '') => {
    const tid = String(tenpoId || '').trim();
    if (!tid) return '';
    const rows = (contracts || [])
      .filter((c) => String(c?.tenpo_id || '').trim() === tid)
      .filter((c) => String(c?.jotai || 'yuko').trim() !== 'torikeshi')
      .sort((a, b) => {
        const ad = String(a?.start_date || a?.application_date || '').trim();
        const bd = String(b?.start_date || b?.application_date || '').trim();
        if (ad !== bd) return bd.localeCompare(ad);
        return String(b?.updated_at || '').localeCompare(String(a?.updated_at || ''));
      });
    const curr = String(currentId || '').trim();
    if (curr && rows.some((r) => String(r?.keiyaku_id || '').trim() === curr)) return curr;
    return String(rows?.[0]?.keiyaku_id || '').trim();
  }, [contracts]);

  const contractCandidates = useMemo(() => {
    const tid = String(modalData?.tenpo_id || '').trim();
    const rows = (contracts || [])
      .filter((c) => String(c?.jotai || 'yuko').trim() !== 'torikeshi')
      .filter((c) => !tid || String(c?.tenpo_id || '').trim() === tid)
      .sort((a, b) => {
        const ad = String(a?.start_date || a?.application_date || '').trim();
        const bd = String(b?.start_date || b?.application_date || '').trim();
        if (ad !== bd) return bd.localeCompare(ad);
        return String(b?.updated_at || '').localeCompare(String(a?.updated_at || ''));
      });
    return rows.slice(0, 500);
  }, [contracts, modalData?.tenpo_id]);

  const selectedContract = useMemo(() => {
    const id = String(modalData?.keiyaku_id || '').trim();
    if (!id) return null;
    return contractById.get(id) || null;
  }, [modalData?.keiyaku_id, contractById]);

  const contractSelectOptions = useMemo(() => {
    const rows = [...contractCandidates];
    const currId = String(modalData?.keiyaku_id || '').trim();
    if (currId && !rows.some((r) => String(r?.keiyaku_id || '').trim() === currId)) {
      rows.unshift({
        keiyaku_id: currId,
        name: String(modalData?.keiyaku_name || currId).trim(),
        tenpo_id: String(modalData?.tenpo_id || '').trim(),
        start_date: String(modalData?.keiyaku_start_date || '').trim(),
        _stale: true,
      });
    }
    return rows;
  }, [contractCandidates, modalData?.keiyaku_id, modalData?.keiyaku_name, modalData?.tenpo_id, modalData?.keiyaku_start_date]);

  const formatTenpoDisplay = useCallback((tenpoId, tenpoName, yagouName) => {
    const name = String(tenpoName || '').trim();
    if (!name) return '---';
    const metaById = tenpoMetaById.get(String(tenpoId || '').trim());
    const metaByName = tenpoMetaByName.get(name);
    const yagou = String(yagouName || metaById?.yagou_name || metaByName?.yagou_name || '').trim();
    return yagou ? `${yagou} / ${name}` : name;
  }, [tenpoMetaById, tenpoMetaByName]);

  const selectedTenpoSummary = useMemo(() => {
    const id = String(modalData?.tenpo_id || '').trim();
    const inputName = String(modalData?.tenpo_name || '').trim();
    const direct = id ? tenpoMetaById.get(id) : null;
    const byName = inputName ? tenpoMetaByName.get(inputName) : null;
    const tenpoName = String(direct?.name || byName?.name || inputName || '').trim();
    if (!tenpoName) {
      return {
        label: '未選択',
        tori: '',
        ids: '',
      };
    }
    const yagouName = String(direct?.yagou_name || byName?.yagou_name || modalData?.yagou_name || '').trim();
    const toriName = String(direct?.torihikisaki_name || byName?.torihikisaki_name || modalData?.torihikisaki_name || '').trim();
    return {
      label: formatTenpoDisplay(id, tenpoName, yagouName),
      tori: toriName,
      ids: [id || String(direct?.tenpo_id || byName?.tenpo_id || '').trim(), String(direct?.yagou_id || byName?.yagou_id || modalData?.yagou_id || '').trim(), String(direct?.torihikisaki_id || byName?.torihikisaki_id || modalData?.torihikisaki_id || '').trim()].filter(Boolean).join(' ・ '),
    };
  }, [
    modalData?.tenpo_id,
    modalData?.tenpo_name,
    modalData?.yagou_name,
    modalData?.yagou_id,
    modalData?.torihikisaki_name,
    modalData?.torihikisaki_id,
    tenpoMetaById,
    tenpoMetaByName,
    formatTenpoDisplay,
  ]);

  const tenpoSearchValue = useMemo(() => {
    const q = String(modalData?.tenpo_query || '').trim();
    if (q) return q;
    return selectedTenpoSummary.label === '未選択' ? '' : selectedTenpoSummary.label;
  }, [modalData?.tenpo_query, selectedTenpoSummary.label]);
  const hasTenpoQuery = String(modalData?.tenpo_query || '').trim().length > 0;
  const hasSelectedTenpo = String(modalData?.tenpo_id || '').trim().length > 0;

  const filteredItems = useMemo(() => {
    const q = String(listQuery || '').trim().toLowerCase();
    if (!q) return items;
    const tokens = q.split(/\s+/).filter(Boolean);
    return (items || []).filter((it) => {
      const metaById = tenpoMetaById.get(String(it?.tenpo_id || '').trim());
      const metaByName = tenpoMetaByName.get(String(it?.tenpo_name || '').trim());
      const toriName = String(it?.torihikisaki_name || metaById?.torihikisaki_name || metaByName?.torihikisaki_name || '').trim();
      const yagouName = String(it?.yagou_name || metaById?.yagou_name || metaByName?.yagou_name || '').trim();
      const siteLabel = formatTenpoDisplay(it?.tenpo_id, it?.tenpo_name, yagouName);
      const serviceIds = Array.isArray(it?.service_ids) ? it.service_ids : [];
      const serviceNames = Array.isArray(it?.service_names) ? it.service_names : [];
      const searchBlob = [
        it?.yakusoku_id,
        it?.keiyaku_id,
        it?.keiyaku_name,
        it?.keiyaku_start_date,
        it?.tenpo_id,
        it?.tenpo_name,
        siteLabel,
        toriName,
        yagouName,
        metaById?.torihikisaki_id,
        metaById?.yagou_id,
        it?.service_id,
        it?.service_name,
        ...serviceIds,
        ...serviceNames,
        it?.type,
        it?.status,
        it?.memo,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return tokens.every((tk) => searchBlob.includes(tk));
    });
  }, [listQuery, items, tenpoMetaById, tenpoMetaByName, formatTenpoDisplay]);

  const serviceCandidates = useMemo(() => {
    const q = String(modalData?.service_query || '').trim().toLowerCase();
    if (!q) return services;
    return services
      .filter((s) => {
        const blob = [
          s?.name,
          s?.service_id,
          s?.category,
          s?.category_concept,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return blob.includes(q);
      });
  }, [modalData?.service_query, services]);

  const serviceGroups = useMemo(() => {
    const bucket = new Map();
    for (const svc of serviceCandidates) {
      const meta = getServiceCategoryMeta(svc);
      if (!bucket.has(meta.key)) {
        bucket.set(meta.key, { key: meta.key, label: meta.label, items: [] });
      }
      bucket.get(meta.key).items.push(svc);
    }
    const order = ['kitchen_haccp', 'aircon', 'floor', 'pest_hygiene', 'maintenance', 'window_wall', 'cleaning', 'pest', 'other', 'uncategorized'];
    return Array.from(bucket.values()).sort((a, b) => {
      const ai = order.indexOf(a.key);
      const bi = order.indexOf(b.key);
      if (ai >= 0 && bi >= 0) return ai - bi;
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return a.label.localeCompare(b.label, 'ja');
    });
  }, [serviceCandidates, getServiceCategoryMeta]);

  const activeServiceCategory = String(modalData?.service_category || 'all');
  const visibleServiceGroups = useMemo(() => {
    if (activeServiceCategory === 'all') return serviceGroups;
    return serviceGroups.filter((g) => g.key === activeServiceCategory);
  }, [activeServiceCategory, serviceGroups]);

  const setBucketDraft = useCallback((bucketKey, value) => {
    setModalData((prev) => ({
      ...prev,
      _tagDrafts: {
        ...(prev?._tagDrafts || {}),
        [bucketKey]: value,
      },
    }));
  }, []);

  const setBucketSearch = useCallback((bucketKey, value) => {
    setModalData((prev) => ({
      ...prev,
      _tagSearch: {
        ...(prev?._tagSearch || {}),
        [bucketKey]: value,
      },
    }));
  }, []);

  const setBucketAdvanced = useCallback((bucketKey, open) => {
    setModalData((prev) => ({
      ...prev,
      _tagAdvanced: {
        ...(prev?._tagAdvanced || {}),
        [bucketKey]: Boolean(open),
      },
    }));
  }, []);

  const serviceCandidatesForTag = useCallback((qRaw) => {
    const q = String(qRaw || '').trim().toLowerCase();
    const list = Array.isArray(services) ? services : [];
    if (!q) return list.slice(0, 80);
    return list
      .filter((s) => {
        const blob = [
          s?.name,
          s?.service_id,
          s?.category,
          s?.category_concept,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return blob.includes(q);
      })
      .slice(0, 80);
  }, [services]);

  const selectedServicesForModal = useMemo(() => {
    const ids = Array.isArray(modalData?.service_ids) ? modalData.service_ids.map((x) => String(x)).filter(Boolean) : [];
    const names = Array.isArray(modalData?.service_names) ? modalData.service_names.map((x) => String(x)).filter(Boolean) : [];
    const byId = new Map((services || []).map((s) => [String(s?.service_id || ''), s]));
    return ids.map((sid, idx) => ({
      service_id: sid,
      name: names[idx] || String(byId.get(sid)?.name || sid),
    }));
  }, [modalData?.service_ids, modalData?.service_names, services]);

  const serviceDisplayNameById = useMemo(() => {
    const m = new Map();
    (services || []).forEach((s) => {
      const sid = String(s?.service_id || '').trim();
      if (!sid) return;
      m.set(sid, String(s?.name || sid));
    });
    const ids = Array.isArray(modalData?.service_ids) ? modalData.service_ids : [];
    const names = Array.isArray(modalData?.service_names) ? modalData.service_names : [];
    ids.forEach((sid, idx) => {
      const key = String(sid || '').trim();
      if (!key) return;
      const nm = String(names[idx] || '').trim();
      if (nm) m.set(key, nm);
    });
    return m;
  }, [services, modalData?.service_ids, modalData?.service_names]);

  const toServiceTagLabel = useCallback((rawTag) => {
    const key = String(rawTag || '').trim();
    if (!key) return '';
    return serviceDisplayNameById.get(key) || key;
  }, [serviceDisplayNameById]);

  const addBucketTagValue = useCallback((bucketKey, tagValue) => {
    const value = String(tagValue || '').trim();
    if (!value) return;
    setModalData((prev) => {
      const tm = normalizeTaskMatrix(prev?.recurrence_rule?.task_matrix);
      Object.keys(tm).forEach((k) => {
        tm[k] = (tm[k] || []).filter((x) => String(x) !== value);
      });
      const nextSet = new Set(tm[bucketKey] || []);
      nextSet.add(value);
      return {
        ...prev,
        recurrence_rule: {
          ...(prev?.recurrence_rule || { type: 'flexible' }),
          task_matrix: {
            ...tm,
            [bucketKey]: [...nextSet],
          },
        },
        _bucketEnabled: {
          ...(prev?._bucketEnabled || createEmptyBucketEnabled()),
          [bucketKey]: true,
        },
      };
    });
  }, [normalizeTaskMatrix]);

  const addBucketTag = useCallback((bucketKey) => {
    setModalData((prev) => {
      const draft = String(prev?._tagDrafts?.[bucketKey] || '').trim();
      if (!draft) return prev;
      const tm = normalizeTaskMatrix(prev?.recurrence_rule?.task_matrix);
      Object.keys(tm).forEach((k) => {
        tm[k] = (tm[k] || []).filter((x) => String(x) !== draft);
      });
      const nextSet = new Set(tm[bucketKey] || []);
      nextSet.add(draft);
      return {
        ...prev,
        recurrence_rule: {
          ...(prev?.recurrence_rule || { type: 'flexible' }),
          task_matrix: {
            ...tm,
            [bucketKey]: [...nextSet],
          },
        },
        _tagDrafts: {
          ...(prev?._tagDrafts || {}),
          [bucketKey]: '',
        },
        _bucketEnabled: {
          ...(prev?._bucketEnabled || createEmptyBucketEnabled()),
          [bucketKey]: true,
        },
      };
    });
  }, [normalizeTaskMatrix]);

  const removeBucketTag = useCallback((bucketKey, tag) => {
    setModalData((prev) => {
      const tm = normalizeTaskMatrix(prev?.recurrence_rule?.task_matrix);
      return {
        ...prev,
        recurrence_rule: {
          ...(prev?.recurrence_rule || { type: 'flexible' }),
          task_matrix: {
            ...tm,
            [bucketKey]: (tm[bucketKey] || []).filter((x) => String(x) !== String(tag)),
          },
        },
      };
    });
  }, [normalizeTaskMatrix]);

  const save = async () => {
    // Minimal operational validation (admin-only; avoids half-baked truth records).
    const tenpoId = String(modalData?.tenpo_id || '').trim();
    const type = String(modalData?.type || '').trim();
    const serviceIds = Array.isArray(modalData?.service_ids)
      ? modalData.service_ids.map((x) => String(x)).filter(Boolean)
      : [];
    const monthlyQuota = Number(modalData?.monthly_quota || 0);
    const price = Number(modalData?.price || 0);
    const keiyakuId = String(modalData?.keiyaku_id || '').trim();
    const tm = normalizeTaskMatrix(modalData?.recurrence_rule?.task_matrix);
    const tmTagCount = Object.values(tm).reduce((acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0), 0);

    if (!tenpoId) { window.alert('tenpo_id（現場）を選択してください'); return; }
    if (!['teiki', 'tanpatsu'].includes(type)) { window.alert('type（種別）は teiki / tanpatsu から選択してください'); return; }
    if (!serviceIds.length) { window.alert('service（サービス）を1件以上選択してください'); return; }
    if (type === 'teiki') {
      if (!Number.isFinite(monthlyQuota) || monthlyQuota < 1) { window.alert('monthly_quota（月間規定回数）は1以上で入力してください'); return; }
      if (!Number.isFinite(price) || price < 0) { window.alert('price（単価）は0以上で入力してください'); return; }
      if (modalData?.isNew && !keiyakuId) { window.alert('新規定期案件は契約（keiyaku）を選択してください'); return; }
      if (tmTagCount <= 0) { window.alert('定期メニュー（task_matrix）を1件以上設定してください'); return; }
    }

    setSaving(true);
    try {
      const method = modalData.isNew ? 'POST' : 'PUT';
      const path = modalData.isNew ? '/yakusoku' : `/yakusoku/${modalData.yakusoku_id}`;
      const payload = { ...modalData };
      const serviceIds = Array.isArray(payload.service_ids)
        ? payload.service_ids.map((x) => String(x)).filter(Boolean)
        : (payload.service_id ? [String(payload.service_id)] : []);
      const serviceNames = Array.isArray(payload.service_names)
        ? payload.service_names.map((x) => String(x)).filter(Boolean)
        : (payload.service_name ? [String(payload.service_name)] : []);
      payload.service_ids = serviceIds;
      payload.service_names = serviceNames;
      // Backward compatibility: keep single-value fields for existing readers.
      payload.service_id = serviceIds[0] || '';
      payload.service_name = serviceNames[0] || '';
      payload.keiyaku_id = String(payload.keiyaku_id || '').trim();
      const linkedContract = payload.keiyaku_id ? contractById.get(payload.keiyaku_id) : null;
      if (linkedContract) {
        payload.keiyaku_name = String(linkedContract?.name || payload.keiyaku_name || '').trim();
        payload.keiyaku_start_date = String(linkedContract?.start_date || payload.keiyaku_start_date || '').trim();
        if (!String(payload.tenpo_id || '').trim()) payload.tenpo_id = String(linkedContract?.tenpo_id || '').trim();
      } else if (!payload.keiyaku_id) {
        payload.keiyaku_name = '';
        payload.keiyaku_start_date = '';
      }
      if (!String(payload.yagou_id || '').trim()) payload.yagou_name = '';
      delete payload.tenpo_query;
      delete payload.service_query;
      delete payload.service_category;
      delete payload._tagDrafts;
      delete payload._tagSearch;
      delete payload._tagAdvanced;
      delete payload._bucketEnabled;
      delete payload._monthLock;
      payload.onsite_flags = normalizeOnsiteFlags(payload.onsite_flags);
      const res = await fetchYakusokuWithFallback(path, {
        method,
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to save');
      setModalData(null);
      fetchItems();
    } catch (e) {
      window.alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (id) => {
    if (!window.confirm('この案件を削除（論理削除）しますか？')) return;
    try {
      const res = await fetchYakusokuWithFallback(`/yakusoku/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) throw new Error(`Yakusoku DELETE HTTP ${res.status}`);
      fetchItems();
    } catch (e) {
      window.alert(e.message);
    }
  };

  const activeTaskMatrix = normalizeTaskMatrix(modalData?.recurrence_rule?.task_matrix);
  const isBucketEnabled = useCallback(
    (bucketKey) => Boolean(modalData?._bucketEnabled?.[bucketKey]) || (activeTaskMatrix[bucketKey] || []).length > 0,
    [modalData?._bucketEnabled, activeTaskMatrix]
  );
  const assignedServiceIdsAcrossBuckets = useMemo(() => {
    const ids = new Set();
    Object.values(activeTaskMatrix || {}).forEach((arr) => {
      if (!Array.isArray(arr)) return;
      arr.forEach((v) => {
        const sid = String(v || '').trim();
        if (sid) ids.add(sid);
      });
    });
    return ids;
  }, [activeTaskMatrix]);
  const pooledServicesForModal = useMemo(
    () => selectedServicesForModal.filter((svc) => !assignedServiceIdsAcrossBuckets.has(String(svc.service_id || ''))),
    [selectedServicesForModal, assignedServiceIdsAcrossBuckets]
  );
  const assignedServicesForModal = useMemo(
    () => selectedServicesForModal.filter((svc) => assignedServiceIdsAcrossBuckets.has(String(svc.service_id || ''))),
    [selectedServicesForModal, assignedServiceIdsAcrossBuckets]
  );

  const toggleBucketGroupOption = useCallback((bucketKey, checked) => {
    setModalData((prev) => {
      if (!prev) return prev;
      const tm = normalizeTaskMatrix(prev?.recurrence_rule?.task_matrix);
      if (!checked) {
        tm[bucketKey] = [];
      }
      return {
        ...prev,
        recurrence_rule: {
          ...(prev?.recurrence_rule || { type: 'flexible' }),
          task_matrix: tm,
        },
        _bucketEnabled: {
          ...(prev?._bucketEnabled || createEmptyBucketEnabled()),
          [bucketKey]: Boolean(checked),
        },
      };
    });
  }, [normalizeTaskMatrix]);

  const copyBucketTagsToEnabled = useCallback((sourceBucketKey) => {
    const sourceTags = Array.isArray(activeTaskMatrix?.[sourceBucketKey]) ? activeTaskMatrix[sourceBucketKey] : [];
    if (!sourceTags.length) {
      window.alert('先にこの月（曜日）へサービスを割り当ててください');
      return;
    }
    const familyKeys = getBucketFamilyKeys(sourceBucketKey);
    setModalData((prev) => {
      if (!prev) return prev;
      const tm = normalizeTaskMatrix(prev?.recurrence_rule?.task_matrix);
      const isEnabled = (k) => Boolean(prev?._bucketEnabled?.[k]) || (tm[k] || []).length > 0;
      familyKeys.forEach((k) => {
        if (k === sourceBucketKey) return;
        if (!isEnabled(k)) return;
        tm[k] = [...sourceTags];
      });
      return {
        ...prev,
        recurrence_rule: {
          ...(prev?.recurrence_rule || { type: 'flexible' }),
          task_matrix: tm,
        },
      };
    });
  }, [activeTaskMatrix, normalizeTaskMatrix]);

  const renderBucketEditor = useCallback((bucket) => {
    const tags = activeTaskMatrix[bucket.key] || [];
    const quickAddServices = pooledServicesForModal;
    const familyKeys = getBucketFamilyKeys(bucket.key);
    const enabledSiblingCount = familyKeys
      .filter((k) => k !== bucket.key)
      .filter((k) => isBucketEnabled(k))
      .length;
    const canCopy = familyKeys.length > 1 && enabledSiblingCount > 0;
    return (
      <div key={bucket.key} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>{bucket.label}</div>
          {canCopy ? (
            <button
              type="button"
              onClick={() => copyBucketTagsToEnabled(bucket.key)}
              style={{
                border: '1px solid var(--line)',
                background: 'rgba(16,185,129,0.16)',
                color: 'var(--text)',
                borderRadius: 999,
                padding: '4px 10px',
                fontSize: 12,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
              title="この割り当てを、同区分でチェック済みの他の月（曜日）へ一括反映"
            >
              同様の割り当て
            </button>
          ) : null}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {tags.length ? tags.map((tag) => (
            <button
              key={`${bucket.key}-${tag}`}
              type="button"
              onClick={() => removeBucketTag(bucket.key, tag)}
              style={{
                border: '1px solid var(--line)',
                background: 'var(--panel)',
                color: 'var(--text)',
                borderRadius: 999,
                padding: '4px 10px',
                fontSize: 12,
                cursor: 'pointer',
              }}
              title="クリックで削除"
            >
              {toServiceTagLabel(tag)} ×
            </button>
          )) : <span style={{ fontSize: 12, color: 'var(--muted)' }}>未設定</span>}
        </div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>未割当プールから追加</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {quickAddServices.length ? quickAddServices.map((svc) => (
              <button
                key={`${bucket.key}-selected-${svc.service_id}`}
                type="button"
                onClick={() => addBucketTagValue(bucket.key, svc.service_id)}
                style={{
                  border: '1px solid var(--line)',
                  background: 'rgba(37,99,235,0.14)',
                  color: 'var(--text)',
                  borderRadius: 999,
                  padding: '4px 10px',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
                title={`追加: ${svc.name} (${svc.service_id})`}
              >
                + {svc.name}
              </button>
            )) : (
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                {selectedServicesForModal.length ? '未割当プールにサービスがありません' : '先に上の「サービス」で選択してください'}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }, [
    activeTaskMatrix,
    isBucketEnabled,
    removeBucketTag,
    toServiceTagLabel,
    selectedServicesForModal,
    pooledServicesForModal,
    addBucketTagValue,
    copyBucketTagsToEnabled,
  ]);

  return (
    <div className="admin-yotei-timeline-page">
      <div className="admin-yotei-timeline-content">
        <header className="yotei-head">
          <h1>実案件・定期管理 (yakusoku)</h1>
          <div className="yotei-head-actions">
            <div className="yotei-head-nav" aria-label="ページ移動">
              <Link to="/admin/yotei" className="yotei-head-link">YOTEI</Link>
              <Link to="/admin/ugoki" className="yotei-head-link">UGOKI</Link>
              <span className="yotei-head-link active" aria-current="page">YAKUSOKU</span>
            </div>
            <button className="primary" onClick={openNew}>新規案件登録</button>
            <button onClick={fetchItems} disabled={loading}>{loading ? '...' : '更新'}</button>
          </div>
        </header>
        <div
          style={{
            padding: '0 20px 10px',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <input
            type="text"
            value={listQuery}
            onChange={(e) => setListQuery(e.target.value)}
            placeholder="統合検索: 取引先 / 屋号 / 店舗 / サービス / ID / 状態 / メモ"
            style={{ minWidth: 280, flex: '1 1 420px' }}
          />
          <button type="button" onClick={() => setListQuery('')} disabled={!String(listQuery || '').trim()}>
            クリア
          </button>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            {filteredItems.length} / {items.length} 件
          </span>
        </div>

        <div className="yakusoku-list" style={{ padding: '20px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text)' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--line)' }}>
                <th style={{ padding: '10px' }}>ID</th>
                <th style={{ padding: '10px' }}>現場名</th>
                <th style={{ padding: '10px' }}>契約</th>
                <th style={{ padding: '10px' }}>サービス</th>
                <th style={{ padding: '10px' }}>種別</th>
                <th style={{ padding: '10px' }}>月枠</th>
                <th style={{ padding: '10px' }}>当月消化</th>
                <th style={{ padding: '10px' }}>単価</th>
                <th style={{ padding: '10px' }}>状態</th>
                <th style={{ padding: '10px' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(it => {
                const monthKey = dayjs().format('YYYY-MM');
                const consumed = it.consumption_count ? (it.consumption_count[monthKey] || 0) : 0;
                return (
                  <tr key={it.yakusoku_id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '10px', fontSize: '12px', color: 'var(--muted)' }}>{it.yakusoku_id}</td>
                    <td style={{ padding: '10px' }}>
                      {formatTenpoDisplay(it.tenpo_id, it.tenpo_name, it.yagou_name)}
                    </td>
                    <td style={{ padding: '10px' }}>
                      {it.keiyaku_name || it.keiyaku_id ? (
                        <div>
                          <div>{it.keiyaku_name || it.keiyaku_id}</div>
                          {it.keiyaku_start_date ? (
                            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                              開始: {it.keiyaku_start_date}
                            </div>
                          ) : null}
                        </div>
                      ) : '-'}
                    </td>
                    <td style={{ padding: '10px' }}>
                      {(() => {
                        const ids = Array.isArray(it.service_ids) ? it.service_ids : [];
                        const names = Array.isArray(it.service_names) ? it.service_names : [];
                        const primary = names[0] || it.service_name || ids[0] || it.service_id || '---';
                        const extra = Math.max(0, Math.max(ids.length, names.length) - 1);
                        return extra > 0 ? `${primary} (+${extra})` : primary;
                      })()}
                    </td>
                    <td style={{ padding: '10px' }}>{it.type === 'teiki' ? '定期' : '単発'}</td>
                    <td style={{ padding: '10px' }}>{it.monthly_quota || '-'}回</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ color: consumed >= (it.monthly_quota || 0) ? '#4caf50' : '#ff9800' }}>
                        {consumed}
                      </span>
                    </td>
                    <td style={{ padding: '10px' }}>¥{(it.price || 0).toLocaleString()}</td>
                    <td style={{ padding: '10px' }}>{it.status}</td>
                    <td style={{ padding: '10px' }}>
                      <button onClick={() => openEdit(it)}>編集</button>
                      <button className="danger" onClick={() => deleteItem(it.yakusoku_id)}>削除</button>
                    </td>
                  </tr>
                );
              })}
              {!filteredItems.length ? (
                <tr>
                  <td colSpan={10} style={{ padding: '16px 10px', color: 'var(--muted)' }}>
                    条件に一致する案件がありません
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {modalData && (
        <div className="yotei-modal-overlay" onClick={() => setModalData(null)}>
          <div className="yotei-modal" onClick={e => e.stopPropagation()}>
            <div className="yotei-modal-header">
              <h2>{modalData.isNew ? '新規案件登録' : '案件編集'}</h2>
              <button onClick={() => setModalData(null)} style={{ background: 'none', border: 'none', color: 'var(--text)', fontSize: 24 }}>×</button>
            </div>
            <div className="yotei-modal-content">
              <div className="yotei-form-group">
                <label>種別</label>
                <select value={modalData.type} onChange={e => setModalData({ ...modalData, type: e.target.value })}>
                  <option value="teiki">定期 (teiki)</option>
                  <option value="tanpatsu">単発 (tanpatsu)</option>
                </select>
              </div>
              <div className="yotei-form-group">
                <label>現場名（統合検索）</label>
                <input
                  type="text"
                  value={tenpoSearchValue}
                  onChange={e => {
                    const nextQuery = e.target.value;
                    const normalized = String(nextQuery || '').trim();
                    const exact = tenpos.find((t) => {
                      const display = formatTenpoDisplay(t.tenpo_id, t.name, t.yagou_name);
                      return (
                        String(t.name || '').trim() === normalized ||
                        display === normalized ||
                        String(t.tenpo_id || '').trim() === normalized
                      );
                    });
                    const resolved = exact ? {
                      tenpo_id: exact.tenpo_id || '',
                      tenpo_name: exact.name || '',
                      torihikisaki_id: exact.torihikisaki_id || '',
                      yagou_id: exact.yagou_id || '',
                      torihikisaki_name: exact.torihikisaki_name || '',
                      yagou_name: exact.yagou_name || '',
                    } : null;
                    setModalData({
                      ...modalData,
                      tenpo_query: nextQuery,
                      keiyaku_id: resolved ? pickPrimaryContractIdForTenpo(resolved.tenpo_id, modalData?.keiyaku_id) : modalData?.keiyaku_id,
                      ...(resolved || {}),
                    });
                  }}
                  placeholder="取引先 / 屋号 / 店舗 / ID で検索"
                />
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>
                  候補をタップすると「最終選択（保存対象）」に反映されます
                </div>
                <div style={{ marginTop: 8, display: 'grid', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                  {tenpoCandidates.map((tp) => (
                    <button
                      key={tp.tenpo_id}
                      type="button"
                      aria-pressed={String(modalData?.tenpo_id || '').trim() === String(tp.tenpo_id || '').trim()}
                      onClick={() => setModalData({
                        ...modalData,
                        tenpo_name: tp.name,
                        tenpo_query: formatTenpoDisplay(tp.tenpo_id, tp.name, tp.yagou_name),
                        tenpo_id: tp.tenpo_id,
                        keiyaku_id: pickPrimaryContractIdForTenpo(tp.tenpo_id, modalData?.keiyaku_id),
                        torihikisaki_id: tp.torihikisaki_id || '',
                        yagou_id: tp.yagou_id || '',
                        torihikisaki_name: tp.torihikisaki_name || '',
                        yagou_name: tp.yagou_name || '',
                      })}
                      style={{
                        textAlign: 'left',
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: String(modalData?.tenpo_id || '').trim() === String(tp.tenpo_id || '').trim()
                          ? '1px solid #60a5fa'
                          : '1px solid var(--line)',
                        background: String(modalData?.tenpo_id || '').trim() === String(tp.tenpo_id || '').trim()
                          ? 'rgba(96,165,250,0.15)'
                          : 'var(--panel)',
                        color: 'var(--text)',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span>{formatTenpoDisplay(tp.tenpo_id, tp.name, tp.yagou_name)}</span>
                        {String(modalData?.tenpo_id || '').trim() === String(tp.tenpo_id || '').trim() ? (
                          <span style={{ fontSize: 11, color: '#93c5fd', fontWeight: 700 }}>選択中</span>
                        ) : null}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>
                        {(tp.torihikisaki_name || '取引先未設定')} / {(tp.yagou_name || '屋号未設定')}
                      </div>
                      <div style={{ fontSize: 11, opacity: 0.65 }}>
                        {tp.tenpo_id} ・ {tp.yagou_id || '-'} ・ {tp.torihikisaki_id || '-'}
                      </div>
                    </button>
                  ))}
                  {!tenpoCandidates.length && (
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {hasTenpoQuery
                        ? '一致する候補がありません（最終選択は下のカードを確認）'
                        : '検索語を入力すると候補が表示されます'}
                    </div>
                  )}
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>最終選択ID: {modalData.tenpo_id || '未選択'}</span>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setModalData({
                        ...modalData,
                        tenpo_query: '',
                        tenpo_id: '',
                        tenpo_name: '',
                        keiyaku_id: '',
                        keiyaku_name: '',
                        keiyaku_start_date: '',
                        torihikisaki_id: '',
                        yagou_id: '',
                        torihikisaki_name: '',
                        yagou_name: '',
                      })}
                      style={{
                        border: '1px solid var(--line)',
                        borderRadius: 8,
                        padding: '2px 8px',
                        fontSize: 12,
                        background: 'transparent',
                        color: 'var(--muted)',
                        cursor: 'pointer',
                      }}
                    >
                      選択解除
                    </button>
                    <Link to="/admin/torihikisaki-touroku" style={{ color: '#8bd8ff', textDecoration: 'none' }}>
                      新規顧客登録へ →
                    </Link>
                  </div>
                </div>
                <div
                  style={{
                    marginTop: 8,
                    border: '1px solid var(--line)',
                    borderRadius: 8,
                    padding: '8px 10px',
                    background: 'rgba(15,23,42,0.35)',
                  }}
                >
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
                    最終選択（保存対象）
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{selectedTenpoSummary.label}</div>
                  {!hasSelectedTenpo ? (
                    <div style={{ fontSize: 12, color: '#fbbf24', marginTop: 2 }}>
                      まだ選択されていません（候補をタップしてください）
                    </div>
                  ) : null}
                  {selectedTenpoSummary.tori ? (
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      取引先: {selectedTenpoSummary.tori}
                    </div>
                  ) : null}
                  {selectedTenpoSummary.ids ? (
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                      {selectedTenpoSummary.ids}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="yotei-form-group">
                <label>契約（keiyaku）</label>
                <select
                  value={modalData.keiyaku_id || ''}
                  onChange={(e) => {
                    const nextId = String(e.target.value || '').trim();
                    const linked = nextId ? contractById.get(nextId) : null;
                    const linkedTenpoId = String(linked?.tenpo_id || '').trim();
                    const linkedTenpo = linkedTenpoId ? tenpoMetaById.get(linkedTenpoId) : null;
                    setModalData({
                      ...modalData,
                      keiyaku_id: nextId,
                      keiyaku_name: String(linked?.name || '').trim(),
                      keiyaku_start_date: String(linked?.start_date || '').trim(),
                      ...(linkedTenpo ? {
                        tenpo_id: linkedTenpo.tenpo_id || '',
                        tenpo_name: linkedTenpo.name || '',
                        tenpo_query: formatTenpoDisplay(linkedTenpo.tenpo_id, linkedTenpo.name, linkedTenpo.yagou_name),
                        torihikisaki_id: linkedTenpo.torihikisaki_id || '',
                        yagou_id: linkedTenpo.yagou_id || '',
                        torihikisaki_name: linkedTenpo.torihikisaki_name || '',
                        yagou_name: linkedTenpo.yagou_name || '',
                      } : {}),
                    });
                  }}
                >
                  <option value="">未選択</option>
                  {contractSelectOptions.map((c) => (
                    <option key={c.keiyaku_id} value={c.keiyaku_id}>
                      {[c.name || c.keiyaku_id, c.start_date || c.application_date || '', c._stale ? '履歴' : '']
                        .filter(Boolean)
                        .join(' / ')}
                    </option>
                  ))}
                </select>
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>
                  {selectedContract
                    ? `選択中: ${selectedContract.name || selectedContract.keiyaku_id}（開始: ${selectedContract.start_date || '-' }）`
                    : '新規定期案件では契約を必ず選択してください'}
                  {' '}<Link to="/admin/master/keiyaku" style={{ color: '#8bd8ff', textDecoration: 'none' }}>契約マスタを開く →</Link>
                </div>
              </div>
              <div className="yotei-form-group">
                <label>yakusoku開始日</label>
                <input type="date" value={modalData.start_date} onChange={e => setModalData({ ...modalData, start_date: e.target.value })} />
              </div>
              <div className="yotei-form-group">
                <label>金額 (単価)</label>
                <input type="number" value={modalData.price} onChange={e => setModalData({ ...modalData, price: parseInt(e.target.value) })} />
              </div>
              <div className="yotei-form-group">
                <label>サービス</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button type="button" onClick={() => setServicePickerOpen(true)}>
                    サービスを選択（オーバーレイ）
                  </button>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    選択件数: {(modalData.service_ids || []).length} 件
                  </span>
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(Array.isArray(modalData.service_names) ? modalData.service_names : []).map((nm, idx) => {
                    const sid = String((modalData.service_ids || [])[idx] || '');
                    const key = `${sid || nm}-${idx}`;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          const ids = [...(modalData.service_ids || [])];
                          const names = [...(modalData.service_names || [])];
                          ids.splice(idx, 1);
                          names.splice(idx, 1);
                          setModalData({
                            ...modalData,
                            service_ids: ids,
                            service_names: names,
                            service_id: ids[0] || '',
                            service_name: names[0] || '',
                          });
                        }}
                        style={{
                          border: '1px solid var(--line)',
                          background: 'var(--panel)',
                          color: 'var(--text)',
                          borderRadius: 999,
                          padding: '4px 10px',
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                        title="クリックで削除"
                      >
                        {nm || sid} ×
                      </button>
                    );
                  })}
                  {!(modalData.service_ids || []).length ? (
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>未選択</span>
                  ) : null}
                </div>
              </div>
              {modalData.type === 'teiki' && (
                <div className="yotei-form-group">
                  <label>定期メニュー（周期タグ）</label>
                  <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 10, marginBottom: 10 }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
                      選択済みサービス {selectedServicesForModal.length}件
                    </div>

                    <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 8, marginBottom: 8, background: 'rgba(16,185,129,0.08)' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                        割当済み ({assignedServicesForModal.length})
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {assignedServicesForModal.length ? assignedServicesForModal.map((svc) => (
                          <span
                            key={`assigned-${svc.service_id}`}
                            style={{ border: '1px solid var(--line)', borderRadius: 999, padding: '2px 8px', fontSize: 12, background: 'var(--panel)' }}
                          >
                            {svc.name}
                          </span>
                        )) : <span style={{ fontSize: 12, color: 'var(--muted)' }}>なし</span>}
                      </div>
                    </div>

                    <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 8, background: 'rgba(59,130,246,0.08)' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                        未割当プール ({pooledServicesForModal.length})
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {pooledServicesForModal.length ? pooledServicesForModal.map((svc) => (
                          <span
                            key={`pool-${svc.service_id}`}
                            style={{ border: '1px solid var(--line)', borderRadius: 999, padding: '2px 8px', fontSize: 12, background: 'var(--panel)' }}
                          >
                            {svc.name}
                          </span>
                        )) : <span style={{ fontSize: 12, color: 'var(--muted)' }}>なし</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gap: 10 }}>
                    {renderBucketEditor(MONTHLY_BUCKET)}

                    <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 10 }}>
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>{BIMONTHLY_LABEL}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                        {BIMONTHLY_BUCKETS.map((b) => {
                          const checked = isBucketEnabled(b.key);
                          return (
                            <label key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => toggleBucketGroupOption(b.key, e.target.checked)}
                              />
                              <span>{b.label}</span>
                            </label>
                          );
                        })}
                      </div>
                      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                        {BIMONTHLY_BUCKETS
                          .filter((b) => isBucketEnabled(b.key))
                          .map((b) => renderBucketEditor(b, true))}
                      </div>
                    </div>

                    <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 10 }}>
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>{QUARTERLY_LABEL}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                        {QUARTERLY_BUCKETS.map((b) => {
                          const checked = isBucketEnabled(b.key);
                          return (
                            <label key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => toggleBucketGroupOption(b.key, e.target.checked)}
                              />
                              <span>{b.label}</span>
                            </label>
                          );
                        })}
                      </div>
                      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                        {QUARTERLY_BUCKETS
                          .filter((b) => isBucketEnabled(b.key))
                          .map((b) => renderBucketEditor(b, true))}
                      </div>
                    </div>

                    <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 10 }}>
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>{HALF_YEAR_LABEL}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                        {HALF_YEAR_BUCKETS.map((b) => {
                          const checked = isBucketEnabled(b.key);
                          return (
                            <label key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => toggleBucketGroupOption(b.key, e.target.checked)}
                              />
                              <span>{b.label}</span>
                            </label>
                          );
                        })}
                      </div>
                      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                        {HALF_YEAR_BUCKETS
                          .filter((b) => isBucketEnabled(b.key))
                          .map((b) => renderBucketEditor(b, true))}
                      </div>
                    </div>

                    {renderBucketEditor(YEARLY_BUCKET)}
                    {renderBucketEditor(DAILY_BUCKET)}

                    <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 10 }}>
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>週次・隔週（曜日指定）</div>

                      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>週次</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                        {WEEKLY_BUCKETS.map((b) => {
                          const checked = isBucketEnabled(b.key);
                          return (
                            <label key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => toggleBucketGroupOption(b.key, e.target.checked)}
                              />
                              <span>{b.label}</span>
                            </label>
                          );
                        })}
                      </div>

                      <div style={{ fontSize: 12, color: 'var(--muted)', margin: '10px 0 6px' }}>隔週</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                        {BIWEEKLY_BUCKETS.map((b) => {
                          const checked = isBucketEnabled(b.key);
                          return (
                            <label key={b.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => toggleBucketGroupOption(b.key, e.target.checked)}
                              />
                              <span>{b.label}</span>
                            </label>
                          );
                        })}
                      </div>

                      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                        {[...WEEKLY_BUCKETS, ...BIWEEKLY_BUCKETS]
                          .filter((b) => isBucketEnabled(b.key))
                          .map((b) => renderBucketEditor(b, true))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="yotei-form-group">
                <label>月間規定回数 (monthly_quota)</label>
                <input type="number" value={modalData.monthly_quota} onChange={e => setModalData({ ...modalData, monthly_quota: parseInt(e.target.value) })} />
              </div>
              <div className="yotei-form-group">
                <label>状態</label>
                <select value={modalData.status} onChange={e => setModalData({ ...modalData, status: e.target.value })}>
                  <option value="active">有効 (active)</option>
                  <option value="inactive">無効 (inactive)</option>
                </select>
              </div>
              <div className="yotei-form-group">
                <label>メモ</label>
                <textarea
                  value={modalData.memo}
                  onChange={e => setModalData({ ...modalData, memo: e.target.value })}
                  rows={3}
                  maxLength={200}
                  placeholder="短く（例: 鍵/ガス栓/ゴミ回収などの運用注意のみ）"
                />
              </div>
              <div className="yotei-form-group">
                <label>現場チェック（構造化）</label>
                <div style={{ display: 'grid', gap: 8 }}>
                  {ONSITE_FLAG_GROUPS.map((group) => (
                    <div key={group.title} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>
                        {group.title}
                      </div>
                      <div style={{ display: 'grid', gap: 6 }}>
                        {group.items.map((it) => (
                          <label key={it.key} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, color: 'var(--text)' }}>
                            <input
                              type="checkbox"
                              checked={Boolean(modalData?.onsite_flags?.[it.key])}
                              onChange={(e) => setModalData({
                                ...modalData,
                                onsite_flags: {
                                  ...normalizeOnsiteFlags(modalData?.onsite_flags),
                                  [it.key]: e.target.checked,
                                },
                              })}
                            />
                            <span>{it.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="yotei-modal-footer">
              <button onClick={() => setModalData(null)}>キャンセル</button>
              <button className="primary" onClick={save} disabled={saving}>{saving ? '保存中...' : '保存'}</button>
            </div>
          </div>
        </div>
      )}
      {modalData && servicePickerOpen && (
        <div className="yakusoku-service-overlay" onClick={() => setServicePickerOpen(false)}>
          <div className="yakusoku-service-panel" onClick={(e) => e.stopPropagation()}>
            <div className="yakusoku-service-head">
              <strong>サービス選択</strong>
              <button type="button" onClick={() => setServicePickerOpen(false)}>閉じる</button>
            </div>
            <input
              type="text"
              value={modalData.service_query || ''}
              onChange={(e) => setModalData({ ...modalData, service_query: e.target.value })}
              placeholder="サービス名 / ID / カテゴリで検索"
            />
            <div className="yakusoku-service-count">候補 {serviceCandidates.length} 件 / 選択 {(modalData.service_ids || []).length} 件</div>
            <div className="yakusoku-service-categories">
              <button
                type="button"
                className={`yakusoku-service-cat-chip ${activeServiceCategory === 'all' ? 'active' : ''}`}
                onClick={() => setModalData({ ...modalData, service_category: 'all' })}
              >
                全カテゴリ ({serviceCandidates.length})
              </button>
              {serviceGroups.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  className={`yakusoku-service-cat-chip ${activeServiceCategory === g.key ? 'active' : ''}`}
                  onClick={() => setModalData({ ...modalData, service_category: g.key })}
                >
                  {g.label} ({g.items.length})
                </button>
              ))}
            </div>
            <div className="yakusoku-service-list">
              {visibleServiceGroups.map((group) => (
                <section key={group.key} className="yakusoku-service-group">
                  <div className="yakusoku-service-group-head">
                    <strong>{group.label}</strong>
                    <span>{group.items.length}件</span>
                  </div>
                  <div className="yakusoku-service-group-grid">
                    {group.items.map((s) => {
                      const sid = String(s?.service_id || '');
                      const checked = Array.isArray(modalData?.service_ids) && modalData.service_ids.includes(sid);
                      return (
                        <label key={sid} className="yakusoku-service-option">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => toggleServiceSelection(s, e.target.checked)}
                          />
                          <div>
                            <div style={{ fontWeight: 700 }}>{String(s?.name || sid)}</div>
                            <div style={{ fontSize: 12, opacity: 0.82 }}>
                              {normalizeServiceConcept(s)} / {String(s?.category || '未分類')}
                            </div>
                            <div style={{ fontSize: 11, opacity: 0.68 }}>
                              {sid || '-'} ・ 標準単価 ¥{Number(s?.default_price || 0).toLocaleString()}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </section>
              ))}
              {!visibleServiceGroups.length ? (
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>候補がありません。サービスマスタを確認してください。</div>
              ) : null}
            </div>
            <div className="yakusoku-service-foot">
              <button type="button" onClick={() => setServicePickerOpen(false)}>選択を反映して閉じる</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
