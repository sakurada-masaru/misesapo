import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import HamburgerMenu from '../../shared/ui/HamburgerMenu/HamburgerMenu';
import './admin-tenpo-karte.css';

function isLocalUiHost() {
  if (typeof window === 'undefined') return false;
  const h = window.location?.hostname || '';
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
}

const MASTER_API_BASE =
  (import.meta.env?.DEV || isLocalUiHost())
    ? '/api-master'
    : (import.meta.env?.VITE_MASTER_API_BASE || 'https://jtn6in2iuj.execute-api.ap-northeast-1.amazonaws.com/prod');

const KARTE_VIEW = {
  SUMMARY: 'summary',
  DETAIL: 'detail',
};

// v1: 旧カルテ（OfficeClientKartePanel）の項目を、管理オペ用に再構築して tenpo.karte_detail に保持する。
// フィールドスタッフ入力ではないため、自由記述は最小限（例外メモのみ・短文）にする。
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

const SELF_RATING_OPTIONS = [
  { value: 'yoi', label: '良い' },
  { value: 'futsu', label: '普通' },
  { value: 'kaizen', label: '要改善' },
  { value: 'mihyouka', label: '未評価' },
];

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

function clampStr(v, max) {
  const s = String(v || '');
  if (!max) return s;
  return s.length > max ? s.slice(0, max) : s;
}

async function fetchOneByIdOrList({ collection, id, listQuery }) {
  if (!id) return null;
  try {
    return await apiGetJson(`/master/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`);
  } catch (e) {
    const isNotFound = Number(e?.status) === 404 || String(e?.message || '').includes('HTTP 404');
    if (!isNotFound) return null;
    try {
      const qs = new URLSearchParams({ limit: '2000', jotai: 'yuko', ...(listQuery || {}) }).toString();
      const res = await apiGetJson(`/master/${encodeURIComponent(collection)}?${qs}`);
      return asItems(res).find((it) => String(it?.[`${collection}_id`] || it?.id || '') === id) || null;
    } catch {
      return null;
    }
  }
}

export default function AdminTenpoKartePage() {
  const { tenpoId: tenpoIdParam } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const tenpoId = decodeURIComponent(String(tenpoIdParam || '')).trim();
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
  const [karteView, setKarteView] = useState(KARTE_VIEW.SUMMARY);

  // tenpo.karte_detail の編集ドラフト（master API PUTはmergeなので差分PUTで安全に保存できる）
  const [karteDetail, setKarteDetail] = useState(null);
  const [savingKarteDetail, setSavingKarteDetail] = useState(false);
  const [services, setServices] = useState([]);

  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [lastUpload, setLastUpload] = useState(null);
  const [soukoView, setSoukoView] = useState('teishutsu'); // teishutsu|naibu|all
  const [uploadKubun, setUploadKubun] = useState('teishutsu'); // default for new upload

  const headerTitle = useMemo(() => {
    const tName = String(tenpo?.name || '').trim();
    const yName = String(yagou?.name || '').trim();
    if (yName && tName) return `${yName} / ${tName}`;
    if (tName) return tName;
    return tenpoId;
  }, [tenpo?.name, yagou?.name, tenpoId]);

  const files = useMemo(() => {
    const arr = safeArr(souko?.files);
    return arr
      .map((it) => ({
        key: String(it?.key || '').trim(),
        file_name: String(it?.file_name || '').trim(),
        content_type: String(it?.content_type || '').trim(),
        size: Number(it?.size || 0) || 0,
        uploaded_at: String(it?.uploaded_at || '').trim(),
        kubun: String(it?.kubun || '').trim(), // teishutsu|naibu|'' (legacy)
      }))
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

  const refresh = useCallback(async () => {
    if (!tenpoId) return;
    setLoading(true);
    setError('');
    try {
      let tp = null;
      try {
        tp = await apiGetJson(`/master/tenpo/${encodeURIComponent(tenpoId)}`);
      } catch (e) {
        // master API が /master/tenpo/{id} を未実装/不安定な場合に備えたフォールバック。
        // 取引先名簿からの遷移では torihikisaki_id/yagou_id をクエリに含めるので、それを使って一覧から拾う。
        const isNotFound = Number(e?.status) === 404 || String(e?.message || '').includes('HTTP 404');
        if (isNotFound && parentKeys.torihikisaki_id && parentKeys.yagou_id) {
          const list = await apiGetJson(
            `/master/tenpo?limit=5000&jotai=yuko&torihikisaki_id=${encodeURIComponent(
              parentKeys.torihikisaki_id
            )}&yagou_id=${encodeURIComponent(parentKeys.yagou_id)}`
          );
          const found = asItems(list).find((it) => String(it?.tenpo_id || it?.id || '') === tenpoId) || null;
          if (!found) {
            const err = new Error(`tenpo not found: ${tenpoId}`);
            err.status = 404;
            throw err;
          }
          tp = found;
        } else {
          throw e;
        }
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
      setLoading(false);
    }
  }, [tenpoId, parentKeys.torihikisaki_id, parentKeys.yagou_id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

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

    // Structured fields (旧カルテの精査版)
    if (!next.spec || typeof next.spec !== 'object') next.spec = {};
    if (!next.plan || typeof next.plan !== 'object') next.plan = {};
    if (!next.seats || typeof next.seats !== 'object') next.seats = {};
    if (!Array.isArray(next.equipment)) next.equipment = [];
    if (!Array.isArray(next.consumables)) next.consumables = [];
    if (!Array.isArray(next.staff_history)) next.staff_history = [];
    if (!Array.isArray(next.service_plan)) next.service_plan = [];

    // Free text is allowed only as short exception memo (admin ops).
    next.memo = clampStr(next.memo || '', 200);

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
  }, [karteDetail]);

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
      cur.push({ name: '', start_date: '', end_date: '' });
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
      it[key] = key === 'name' ? clampStr(value, 40) : clampStr(value, 20);
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
      const updated = await apiPutJson(`/master/tenpo/${encodeURIComponent(tenpoId)}`, { karte_detail: next });
      setTenpo(updated);
      setKarteDetail(updated?.karte_detail || next);
    } catch (e) {
      setError(e?.message || '保存に失敗しました');
    } finally {
      setSavingKarteDetail(false);
    }
  }, [tenpoId, ensureKarteDetailDefaults]);

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

      const nextFiles = [
        ...files,
        {
          key,
          file_name: file.name || '',
          content_type: file.type || '',
          size: file.size || 0,
          uploaded_at: nowIso(),
          kubun: uploadKubun,
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
  }, [file, ensureSouko, tenpoId, files, uploadKubun]);

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
            <HamburgerMenu />
            <Link to="/admin/entrance" className="back">← 管理トップ</Link>
          </div>
          <h1>店舗カルテ</h1>
        </header>
        <div className="tenpo-karte-err">tenpo_id が不正です</div>
      </div>
    );
  }

  return (
    <div className="tenpo-karte-page">
      <header className="tenpo-karte-head">
        <div className="left">
          <div className="admin-top-left">
            <HamburgerMenu />
            <button className="back" onClick={() => navigate(-1)}>← 戻る</button>
          </div>
          <div className="titles">
            <div className="kicker">お客様詳細（患者カルテ風）</div>
            <h1>{headerTitle}</h1>
            <div className="pathline">
              <span className="seg">
                取引先: {torihikisaki?.name || '—'}
              </span>
            </div>
          </div>
        </div>
        <div className="right">
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

      {karteView === KARTE_VIEW.SUMMARY ? (
        <div className="tenpo-karte-grid">
          <details className="card card-accordion">
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
                  <div className="v-main">{tenpo?.name || '—'}</div>
                  <div className="v-sub">
                    <code>{tenpo?.tenpo_id || tenpoId}</code>
                  </div>
                </div>
              </div>

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

          <section className="card">
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
                    <div className="file-row" key={f.key}>
                      <div className="file-main">
                        <div className="file-name">{f.file_name || '(no name)'}</div>
                        <div className="file-meta">
                          <code className="file-key">{f.key}</code>
                          <span className="file-sub">{f.content_type || ''}{f.size ? ` / ${f.size} bytes` : ''}</span>
                          <span className="file-sub">{f.uploaded_at || ''}</span>
                        </div>
                      </div>
                      <div className="file-actions">
                        <button onClick={() => copy(f.key)}>キーコピー</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      ) : (
        <div className="tenpo-karte-grid tenpo-karte-grid-detail">
          <section className="card card-large card-full">
            <div className="card-title-row">
              <div>
                <div className="card-title">カルテ詳細（管理オペ用）</div>
                <div className="muted">
                  旧カルテの項目を整理して再構築しています。自由記述は「例外メモ（200字）」のみに抑えます。
                </div>
              </div>
              <div className="seg-tabs">
                <button type="button" onClick={saveKarteDetailNow} disabled={savingKarteDetail}>
                  {savingKarteDetail ? '保存中...' : '保存'}
                </button>
              </div>
            </div>

            <div className="karte-detail-layout">
              <section className="card card-sub">
                <div className="card-title-row">
                  <div className="card-title">運用・鍵</div>
                </div>
                <div className="form-grid">
                  <label className="f">
                    <div className="lbl">スタッフルーム</div>
                    <select
                      value={String(karteDetail?.spec?.staff_room || '')}
                      onChange={(e) => setKarteField('spec.staff_room', e.target.value)}
                    >
                      <option value="">未設定</option>
                      {STAFF_ROOM_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </label>
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
                </div>
              </section>

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
                  <div className="card-title">プラン・評価</div>
                </div>
                <div className="form-grid">
                  <label className="f">
                    <div className="lbl">プラン頻度</div>
                    <select
                      value={String(karteDetail?.plan?.plan_frequency || '')}
                      onChange={(e) => setKarteField('plan.plan_frequency', e.target.value)}
                    >
                      <option value="">未設定</option>
                      {PLAN_FREQUENCY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="f">
                    <div className="lbl">衛生状態自己評価</div>
                    <select
                      value={String(karteDetail?.plan?.self_rating || '')}
                      onChange={(e) => setKarteField('plan.self_rating', e.target.value)}
                    >
                      <option value="">未設定</option>
                      {SELF_RATING_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="f">
                    <div className="lbl">最終清掃日</div>
                    <input
                      type="date"
                      value={String(karteDetail?.plan?.last_clean || '')}
                      onChange={(e) => setKarteField('plan.last_clean', e.target.value)}
                    />
                  </label>
                </div>
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

              <section className="card card-sub card-wide">
                <div className="card-title-row">
                  <div className="card-title">サービスメニュー（周期管理）</div>
                  <div className="seg-tabs">
                    <button type="button" onClick={addServicePlan}>追加</button>
                  </div>
                </div>
                {Array.isArray(karteDetail?.service_plan) && karteDetail.service_plan.length > 0 ? (
                  <div className="service-plan-list">
                    {karteDetail.service_plan.map((sp, i) => {
                      const selectedService = services.find((s) => String(s?.service_id || '') === String(sp?.service_id || ''));
                      const selectedMonths = Array.isArray(sp?.months) ? sp.months : [];
                      return (
                        <div key={i} className="service-plan-row">
                          <div className="service-plan-head">
                            <div className="service-plan-title">メニュー {i + 1}</div>
                            <button type="button" onClick={() => removeServicePlan(i)}>×</button>
                          </div>
                          <div className="form-grid">
                            <label className="f">
                              <div className="lbl">サービス</div>
                              <select
                                value={String(sp?.service_id || '')}
                                onChange={(e) => {
                                  const serviceId = e.target.value;
                                  const hit = services.find((s) => String(s?.service_id || '') === serviceId);
                                  updateServicePlan(i, {
                                    service_id: serviceId,
                                    service_name: String(hit?.name || ''),
                                  });
                                }}
                              >
                                <option value="">未選択</option>
                                {services.map((s) => (
                                  <option key={String(s?.service_id || '')} value={String(s?.service_id || '')}>
                                    {String(s?.name || s?.service_id || '')}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="f">
                              <div className="lbl">周期</div>
                              <select
                                value={String(sp?.cycle || 'monthly')}
                                onChange={(e) => updateServicePlan(i, { cycle: e.target.value })}
                              >
                                {SERVICE_CYCLE_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value}>{o.label}</option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <div className="muted small">
                            {selectedService?.default_duration_min ? `標準時間: ${selectedService.default_duration_min}分` : '標準時間: -'}
                            {selectedService?.default_price ? ` / 標準単価: ¥${Number(selectedService.default_price).toLocaleString()}` : ' / 標準単価: -'}
                          </div>
                          <div className="month-chip-grid">
                            {MONTH_OPTIONS.map((m) => (
                              <button
                                key={m.value}
                                type="button"
                                className={`month-chip ${selectedMonths.includes(m.value) ? 'active' : ''}`}
                                onClick={() => toggleServicePlanMonth(i, m.value)}
                              >
                                {m.label}
                              </button>
                            ))}
                          </div>
                          <label className="f">
                            <div className="lbl">補足（任意）</div>
                            <input
                              value={String(sp?.note || '')}
                              onChange={(e) => updateServicePlan(i, { note: clampStr(e.target.value, 120) })}
                              placeholder="例: 9・11・1・3・5・7月実施"
                            />
                          </label>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="muted">未登録</div>
                )}
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
                        <input
                          placeholder="氏名"
                          value={String(h?.name || '')}
                          onChange={(e) => updateStaffHistory(i, 'name', e.target.value)}
                        />
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

              <section className="card card-sub card-wide">
                <div className="card-title-row">
                  <div className="card-title">HACCP 準拠チェック</div>
                  <div className="muted small">状態はHACCP内に記録（チェックのみ）</div>
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
                <div className="muted small">
                  最終更新: <code>{String(karteDetail?.haccp?.updated_at || '') || '—'}</code>
                </div>
              </section>

              <section className="card card-sub card-wide">
                <div className="card-title-row">
                  <div className="card-title">例外メモ（任意・200字）</div>
                </div>
                <input
                  className="memo"
                  value={String(karteDetail?.memo || '')}
                  onChange={(e) => setKarteField('memo', clampStr(e.target.value, 200))}
                  placeholder="例: 薬剤の匂いNG / 入館ルール 等（短く）"
                />
              </section>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
