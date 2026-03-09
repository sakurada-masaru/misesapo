import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getAdminWorkReports } from '../../shared/api/adminWorkReportsApi';
import './customer-mypage.css';

function authHeaders() {
  const token =
    localStorage.getItem('idToken') ||
    localStorage.getItem('cognito_id_token') ||
    localStorage.getItem('id_token') ||
    localStorage.getItem('accessToken') ||
    localStorage.getItem('cognito_access_token') ||
    localStorage.getItem('token') ||
    '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function asItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.rows)) return data.rows;
  return [];
}

function safeArr(v) {
  return Array.isArray(v) ? v : [];
}

function norm(v) {
  return String(v || '').trim();
}

function ensureHttpUrl(raw) {
  const s = norm(raw);
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

const MISOGI_CUSTOMER_MYPAGE_BASE = String(
  import.meta.env?.VITE_MISOGI_CUSTOMER_MYPAGE_URL || 'https://misesapo.co.jp/misogi/#/customer/mypage'
).trim();

function buildCustomerMyPageUrl(tenpoId) {
  const id = encodeURIComponent(norm(tenpoId) || 'store');
  const base = MISOGI_CUSTOMER_MYPAGE_BASE || 'https://misesapo.co.jp/misogi/#/customer/mypage';
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}tenpo_id=${id}`;
}

function normalizeStoreRow(row) {
  const id = norm(row?.tenpo_id || row?.id || row?.store_id);
  const name = norm(row?.name || row?.tenpo_name || row?.store_name) || '(店舗名未設定)';
  const address = norm(row?.address) || '住所未設定';
  const yagou = norm(row?.yagou_name);
  const sourceUrl = row?.customer_mypage_url || row?.mypage_url || row?.url;
  const explicitUrl = ensureHttpUrl(sourceUrl);
  const url = /customer\/mypage/i.test(explicitUrl) ? explicitUrl : buildCustomerMyPageUrl(id);
  return {
    id: id || name,
    name,
    yagou,
    address,
    url,
    raw: row && typeof row === 'object' ? row : {},
  };
}

function fileExt(fileName, key = '') {
  const base = norm(fileName || key);
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

function parseYmdToInt(ymd) {
  const s = norm(ymd);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return Number(`${m[1]}${m[2]}${m[3]}`);
}

function sortSupportHistoryNewestFirst(list) {
  const arr = Array.isArray(list) ? list.slice() : [];
  const keyed = arr.map((it, idx) => {
    const key = parseYmdToInt(it?.date);
    return { it, idx, key: key == null ? -1 : key };
  });
  keyed.sort((a, b) => {
    if (a.key !== b.key) return b.key - a.key;
    return a.idx - b.idx;
  });
  return keyed.map((x) => x.it);
}

function fmtDateTimeJst(iso) {
  const s = norm(iso);
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  try {
    return new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return s;
  }
}

function fmtYmd(dateLike) {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function coerceObject(raw) {
  if (!raw) return {};
  if (typeof raw === 'object' && raw !== null) return raw;
  if (typeof raw !== 'string') return {};
  const s = raw.trim();
  if (!s) return {};
  try {
    const parsed = JSON.parse(s);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function compact(v) {
  return String(v || '').trim();
}

function normalizeMatchKey(v) {
  return compact(v).toLowerCase().replace(/[\s　]/g, '');
}

function pickFirstText(...vals) {
  for (const v of vals) {
    const s = compact(v);
    if (s) return s;
  }
  return '';
}

function extractReportStoreName(item, payload) {
  return pickFirstText(
    item?.target_label,
    item?.target_name,
    item?.store_name,
    item?.tenpo_name,
    payload?.store?.name,
    payload?.store_name,
    payload?.tenpo_name,
    payload?.target_name,
    payload?.header?.store_name,
    payload?.header?.tenpo_name,
    payload?.overview?.store_name
  );
}

function extractReportTenpoId(item, payload) {
  return pickFirstText(
    item?.tenpo_id,
    item?.store_id,
    item?.target_id,
    payload?.tenpo_id,
    payload?.store_id,
    payload?.target_id,
    payload?.store?.tenpo_id
  );
}

function extractReportResult(item, payload) {
  const direct = pickFirstText(
    item?.outcome,
    item?.result,
    item?.summary,
    item?.memo,
    payload?.outcome,
    payload?.result,
    payload?.result_today,
    payload?.honjitsu_seika,
    payload?.summary,
    payload?.memo,
    payload?.note,
    payload?.store?.note,
    payload?.header?.summary,
    payload?.overview?.summary
  );
  if (direct) return direct;

  const services = Array.isArray(payload?.services) ? payload.services : [];
  const names = services
    .map((sv) => compact(sv?.name))
    .filter(Boolean)
    .slice(0, 5);
  if (names.length) return `実施内容: ${names.join(' / ')}`;

  return '';
}

function reportDateKey(item, payload) {
  return pickFirstText(
    item?.work_date,
    payload?.work_date,
    payload?.date,
    payload?.header?.work_date,
    String(item?.created_at || '').slice(0, 10)
  );
}

function reportTimeKey(item) {
  const ts = Date.parse(String(item?.created_at || item?.updated_at || ''));
  return Number.isFinite(ts) ? ts : 0;
}

function isRunningYoteiStatus(row) {
  const s = pickFirstText(
    row?.jokyo,
    row?.ugoki_jotai,
    row?.ugoki_jokyo,
    row?.ugoki_status,
    row?.jotai,
    row?.status
  ).toLowerCase();
  return s === 'working' || s === 'shinkou' || s === 'in_progress' || s === 'progress' || s === 'running' || s === '実行中' || s === '進行中';
}

function formatBytes(size) {
  const n = Number(size || 0);
  if (!Number.isFinite(n) || n <= 0) return '-';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function normalizeSoukoFiles(soukoRecord) {
  return safeArr(soukoRecord?.files)
    .map((it) => {
      const previewUrl = norm(it?.preview_url);
      const getUrl = norm(it?.get_url || it?.url);
      return {
        key: norm(it?.key),
        file_name: norm(it?.file_name),
        content_type: norm(it?.content_type),
        size: Number(it?.size || 0) || 0,
        uploaded_at: norm(it?.uploaded_at),
        kubun: norm(it?.kubun),
        doc_category: norm(it?.doc_category),
        open_url: previewUrl || getUrl,
      };
    })
    .filter((it) => it.key);
}

function buildBasicInfoForm(tenpoLike, fallbackStore) {
  const tenpo = tenpoLike && typeof tenpoLike === 'object' ? tenpoLike : {};
  const spec = (tenpo.karte_detail && typeof tenpo.karte_detail === 'object' && tenpo.karte_detail.spec && typeof tenpo.karte_detail.spec === 'object')
    ? tenpo.karte_detail.spec
    : {};
  return {
    torihikisaki_name: norm(tenpo.torihikisaki_name || tenpo.torihikisaki || tenpo.company_name || tenpo.customer_name),
    yagou_name: norm(tenpo.yagou_name || fallbackStore?.yagou),
    name: norm(tenpo.name || tenpo.tenpo_name || tenpo.store_name || fallbackStore?.name),
    address: norm(tenpo.address || fallbackStore?.address),
    phone: norm(tenpo.phone),
    customer_contact_name: norm(spec.customer_contact_name || tenpo.tantou_name || tenpo.contact_name),
    business_hours: norm(spec.business_hours || tenpo.business_hours || tenpo.eigyou_jikan),
  };
}

export default function CustomerMyPage() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stores, setStores] = useState([]);

  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailTenpo, setDetailTenpo] = useState(null);
  const [detailSoukoFiles, setDetailSoukoFiles] = useState([]);
  const [resultReportsLoading, setResultReportsLoading] = useState(false);
  const [resultReportsError, setResultReportsError] = useState('');
  const [resultReports, setResultReports] = useState([]);
  const [customerNoticesLoading, setCustomerNoticesLoading] = useState(false);
  const [customerNoticesError, setCustomerNoticesError] = useState('');
  const [customerNotices, setCustomerNotices] = useState([]);
  const [basicEditMode, setBasicEditMode] = useState(false);
  const [basicSaving, setBasicSaving] = useState(false);
  const [basicSaveMessage, setBasicSaveMessage] = useState('');
  const [basicInfoForm, setBasicInfoForm] = useState({
    torihikisaki_name: '',
    yagou_name: '',
    name: '',
    address: '',
    phone: '',
    customer_contact_name: '',
    business_hours: '',
  });

  const scopedTenpoId = useMemo(() => {
    const sp = new URLSearchParams(location.search || '');
    return norm(sp.get('tenpo_id'));
  }, [location.search]);

  const masterApiBase = useMemo(() => (
    String(import.meta.env.VITE_MASTER_API_BASE || '/api-master').replace(/\/$/, '')
  ), []);

  const loadStores = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${masterApiBase}/master/tenpo?limit=20000&jotai=yuko`, {
        headers: { ...authHeaders() },
        cache: 'no-store',
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`店舗一覧の取得に失敗 (${res.status}) ${text}`.trim());
      }
      const data = await res.json();
      const rows = asItems(data).map(normalizeStoreRow);
      setStores(rows);
    } catch (e) {
      setError(String(e?.message || e || '店舗一覧の取得に失敗しました'));
      setStores([]);
    } finally {
      setLoading(false);
    }
  }, [masterApiBase]);

  const loadScopedDetail = useCallback(async () => {
    if (!scopedTenpoId) {
      setDetailTenpo(null);
      setDetailSoukoFiles([]);
      setDetailError('');
      return;
    }

    setDetailLoading(true);
    setDetailError('');
    try {
      let tenpoRow = null;
      const listRes = await fetch(
        `${masterApiBase}/master/tenpo?limit=5&jotai=yuko&tenpo_id=${encodeURIComponent(scopedTenpoId)}`,
        { headers: { ...authHeaders() }, cache: 'no-store' }
      );
      if (listRes.ok) {
        const listData = await listRes.json();
        tenpoRow = asItems(listData)?.[0] || null;
      }

      if (!tenpoRow) {
        const idRes = await fetch(`${masterApiBase}/master/tenpo/${encodeURIComponent(scopedTenpoId)}`, {
          headers: { ...authHeaders() },
          cache: 'no-store',
        });
        if (idRes.ok) {
          tenpoRow = await idRes.json();
        }
      }

      if (!tenpoRow) {
        throw new Error(`店舗(${scopedTenpoId})が見つかりません`);
      }

      setDetailTenpo(tenpoRow);

      const soukoRes = await fetch(
        `${masterApiBase}/master/souko?limit=20&jotai=yuko&tenpo_id=${encodeURIComponent(scopedTenpoId)}`,
        { headers: { ...authHeaders() }, cache: 'no-store' }
      );
      if (soukoRes.ok) {
        const soukoData = await soukoRes.json();
        const souko = asItems(soukoData)?.[0] || null;
        setDetailSoukoFiles(normalizeSoukoFiles(souko));
      } else {
        setDetailSoukoFiles([]);
      }
    } catch (e) {
      setDetailTenpo(null);
      setDetailSoukoFiles([]);
      setDetailError(String(e?.message || e || '詳細の取得に失敗しました'));
    } finally {
      setDetailLoading(false);
    }
  }, [masterApiBase, scopedTenpoId]);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const prevTitle = document.title;
    const manifestLink = document.querySelector('link[rel="manifest"]');
    const prevManifestHref = manifestLink?.getAttribute('href') || '';
    if (manifestLink) manifestLink.setAttribute('href', 'customer-manifest.json');

    let createdAppleTitleMeta = false;
    let prevAppleTitle = '';
    let appleTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (!appleTitleMeta) {
      appleTitleMeta = document.createElement('meta');
      appleTitleMeta.setAttribute('name', 'apple-mobile-web-app-title');
      document.head.appendChild(appleTitleMeta);
      createdAppleTitleMeta = true;
    } else {
      prevAppleTitle = appleTitleMeta.getAttribute('content') || '';
    }
    appleTitleMeta.setAttribute('content', 'ミセサポ');

    document.title = 'ミセサポ お客様マイページ';
    return () => {
      document.title = prevTitle;
      if (manifestLink) {
        if (prevManifestHref) manifestLink.setAttribute('href', prevManifestHref);
        else manifestLink.removeAttribute('href');
      }
      if (appleTitleMeta) {
        if (createdAppleTitleMeta) {
          appleTitleMeta.remove();
        } else {
          appleTitleMeta.setAttribute('content', prevAppleTitle);
        }
      }
    };
  }, []);

  useEffect(() => {
    loadScopedDetail();
  }, [loadScopedDetail]);

  const scopedStores = useMemo(() => {
    if (!scopedTenpoId) return stores;
    const key = scopedTenpoId.toLowerCase();
    return stores.filter((it) => norm(it.id).toLowerCase() === key);
  }, [stores, scopedTenpoId]);

  const activeStore = useMemo(() => {
    if (!scopedTenpoId) return null;
    return scopedStores[0] || stores.find((it) => norm(it.id) === scopedTenpoId) || null;
  }, [scopedStores, stores, scopedTenpoId]);

  const effectiveTenpo = detailTenpo || activeStore?.raw || null;
  const spec = effectiveTenpo?.karte_detail?.spec || {};
  const effectiveTenpoId = norm(effectiveTenpo?.tenpo_id || effectiveTenpo?.id || activeStore?.id);
  const canEditBasicInfo = Boolean(scopedTenpoId && effectiveTenpoId);

  const supportHistory = useMemo(() => {
    const rows = safeArr(effectiveTenpo?.karte_detail?.support_history);
    return sortSupportHistoryNewestFirst(rows);
  }, [effectiveTenpo]);

  const loadResultReports = useCallback(async () => {
    if (!scopedTenpoId) {
      setResultReports([]);
      setResultReportsError('');
      setResultReportsLoading(false);
      return;
    }

    const scopedTenpoKey = normalizeMatchKey(effectiveTenpoId || scopedTenpoId);
    const storeNameCandidates = [
      effectiveTenpo?.name,
      effectiveTenpo?.tenpo_name,
      activeStore?.name,
      activeStore?.raw?.store_name,
      activeStore?.raw?.name,
    ]
      .map((v) => normalizeMatchKey(v))
      .filter(Boolean);

    setResultReportsLoading(true);
    setResultReportsError('');
    try {
      const today = new Date();
      const from = new Date(today);
      from.setDate(today.getDate() - 180);
      const items = await getAdminWorkReports({
        from: fmtYmd(from),
        to: fmtYmd(today),
        states: ['submitted', 'triaged', 'approved', 'archived'],
        limit: 2000,
      });

      const rows = safeArr(items)
        .map((item) => {
          const payload = coerceObject(
            item?.payload ??
            item?.payload_json ??
            item?.payloadJson ??
            item?.description ??
            item?.body ??
            item?.data
          );
          const reportTenpoKey = normalizeMatchKey(extractReportTenpoId(item, payload));
          const reportStoreName = extractReportStoreName(item, payload);
          const reportStoreKey = normalizeMatchKey(reportStoreName);
          const matchedByTenpoId = scopedTenpoKey && reportTenpoKey && reportTenpoKey === scopedTenpoKey;
          const matchedByName = reportStoreKey && storeNameCandidates.some((c) => reportStoreKey === c || reportStoreKey.includes(c) || c.includes(reportStoreKey));
          const isTargetStore = matchedByTenpoId || (!matchedByTenpoId && matchedByName);
          if (!isTargetStore) return null;

          const result = extractReportResult(item, payload);
          if (!result) return null;
          return {
            id: compact(item?.id || item?.log_id || item?.report_id || item?.houkoku_id),
            workDate: reportDateKey(item, payload),
            result,
            createdAt: compact(item?.created_at || item?.updated_at),
            sortTs: reportTimeKey(item),
          };
        })
        .filter(Boolean)
        .sort((a, b) => {
          if (a.workDate !== b.workDate) return String(b.workDate).localeCompare(String(a.workDate));
          return b.sortTs - a.sortTs;
        })
        .slice(0, 30);

      setResultReports(rows);
    } catch (e) {
      setResultReports([]);
      setResultReportsError(String(e?.message || e || '作業完了レポートの取得に失敗しました'));
    } finally {
      setResultReportsLoading(false);
    }
  }, [scopedTenpoId, effectiveTenpoId, effectiveTenpo, activeStore]);

  useEffect(() => {
    loadResultReports();
  }, [loadResultReports]);

  const loadCustomerNotices = useCallback(async () => {
    if (!scopedTenpoId) {
      setCustomerNotices([]);
      setCustomerNoticesError('');
      setCustomerNoticesLoading(false);
      return;
    }

    const scopedTenpoKey = normalizeMatchKey(effectiveTenpoId || scopedTenpoId);
    const storeNameCandidates = [
      effectiveTenpo?.name,
      effectiveTenpo?.tenpo_name,
      activeStore?.name,
      activeStore?.raw?.store_name,
      activeStore?.raw?.name,
    ]
      .map((v) => normalizeMatchKey(v))
      .filter(Boolean);

    setCustomerNoticesLoading(true);
    setCustomerNoticesError('');
    try {
      const today = new Date();
      const from = new Date(today);
      const to = new Date(today);
      from.setDate(today.getDate() - 180);
      to.setDate(today.getDate() + 180);
      const qs = new URLSearchParams({
        from: fmtYmd(from),
        to: fmtYmd(to),
        limit: '3000',
      });
      const res = await fetch(`${masterApiBase}/yotei?${qs.toString()}`, {
        headers: { ...authHeaders() },
        cache: 'no-store',
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`お知らせの取得に失敗しました (${res.status}) ${text}`.trim());
      }
      const data = await res.json();
      const rows = asItems(data);
      const notices = [];
      for (const row of rows) {
        const tenpoKey = normalizeMatchKey(row?.tenpo_id || row?.store_id || row?.target_id);
        const tenpoNameKey = normalizeMatchKey(row?.tenpo_name || row?.store_name || row?.name || row?.target_label);
        const matchedByTenpoId = scopedTenpoKey && tenpoKey && tenpoKey === scopedTenpoKey;
        const matchedByName = tenpoNameKey && storeNameCandidates.some((c) => tenpoNameKey === c || tenpoNameKey.includes(c) || c.includes(tenpoNameKey));
        if (!matchedByTenpoId && !matchedByName) continue;

        const yagou = compact(row?.yagou_name);
        const tenpoName = pickFirstText(row?.tenpo_name, row?.store_name, row?.name, row?.target_label, activeStore?.name, effectiveTenpo?.name);
        const storeLabel = yagou && tenpoName ? `${yagou} / ${tenpoName}` : (yagou || tenpoName || '店舗');
        const yoteiId = compact(row?.yotei_id || row?.id || row?.schedule_id);

        const createdAt = compact(row?.created_at);
        const createdTs = Date.parse(createdAt);
        if (createdAt && Number.isFinite(createdTs)) {
          notices.push({
            id: `created-${yoteiId || storeLabel}-${createdAt}`,
            kind: 'created',
            at: createdAt,
            ts: createdTs,
            text: `${storeLabel} の予定が作成されました。`,
          });
        }

        if (isRunningYoteiStatus(row)) {
          const runAt = pickFirstText(row?.ugoki_updated_at, row?.updated_at, row?.started_at, row?.start_at, createdAt);
          const runTs = Date.parse(runAt);
          if (runAt && Number.isFinite(runTs)) {
            const workerName = pickFirstText(row?.sagyouin_name, row?.worker_name, row?.tantou_name);
            notices.push({
              id: `running-${yoteiId || storeLabel}-${runAt}`,
              kind: 'running',
              at: runAt,
              ts: runTs,
              text: workerName
                ? `${storeLabel} の予定が実行中になりました（${workerName}）。`
                : `${storeLabel} の予定が実行中になりました。`,
            });
          }
        }
      }

      const deduped = Array.from(
        new Map(
          notices.map((n) => [n.id, n])
        ).values()
      )
        .sort((a, b) => b.ts - a.ts)
        .slice(0, 50);

      setCustomerNotices(deduped);
    } catch (e) {
      setCustomerNotices([]);
      setCustomerNoticesError(String(e?.message || e || 'お知らせの取得に失敗しました'));
    } finally {
      setCustomerNoticesLoading(false);
    }
  }, [scopedTenpoId, effectiveTenpoId, effectiveTenpo, activeStore, masterApiBase]);

  useEffect(() => {
    loadCustomerNotices();
  }, [loadCustomerNotices]);

  useEffect(() => {
    if (!canEditBasicInfo) return;
    setBasicInfoForm(buildBasicInfoForm(effectiveTenpo, activeStore));
    setBasicEditMode(false);
  }, [canEditBasicInfo, effectiveTenpoId, effectiveTenpo, activeStore]);

  const basicInfoRows = useMemo(() => {
    if (!effectiveTenpo && !activeStore) return [];
    const myPageUrl = buildCustomerMyPageUrl(effectiveTenpoId);
    return [
      { key: 'torihikisaki_name', label: '法人', value: basicInfoForm.torihikisaki_name || '-' },
      { key: 'yagou_name', label: '屋号', value: basicInfoForm.yagou_name || '-' },
      { key: 'name', label: '店舗名', value: basicInfoForm.name || '-' },
      { key: 'address', label: '住所', value: basicInfoForm.address || '-' },
      { key: 'phone', label: '電話番号', value: basicInfoForm.phone || '-' },
      { key: 'customer_contact_name', label: '担当者', value: basicInfoForm.customer_contact_name || '-' },
      { key: 'business_hours', label: '営業時間', value: basicInfoForm.business_hours || '-' },
      { label: 'お客様マイページURL', value: myPageUrl, href: myPageUrl },
    ];
  }, [effectiveTenpo, activeStore, effectiveTenpoId, basicInfoForm]);

  const onBasicInfoField = useCallback((key, value) => {
    setBasicInfoForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleBasicInfoSave = useCallback(async () => {
    if (!canEditBasicInfo || !effectiveTenpoId || basicSaving) return;
    setBasicSaveMessage('');
    setBasicSaving(true);
    try {
      const prevKarte = (effectiveTenpo?.karte_detail && typeof effectiveTenpo.karte_detail === 'object')
        ? effectiveTenpo.karte_detail
        : {};
      const prevSpec = (prevKarte.spec && typeof prevKarte.spec === 'object') ? prevKarte.spec : {};
      const nextSpec = {
        ...prevSpec,
        customer_contact_name: norm(basicInfoForm.customer_contact_name),
        business_hours: norm(basicInfoForm.business_hours),
      };
      const payload = {
        torihikisaki_name: norm(basicInfoForm.torihikisaki_name),
        yagou_name: norm(basicInfoForm.yagou_name),
        name: norm(basicInfoForm.name),
        address: norm(basicInfoForm.address),
        phone: norm(basicInfoForm.phone),
        tantou_name: norm(basicInfoForm.customer_contact_name),
        business_hours: norm(basicInfoForm.business_hours),
        karte_detail: {
          ...prevKarte,
          spec: nextSpec,
          updated_at: new Date().toISOString(),
        },
      };
      const res = await fetch(`${masterApiBase}/master/tenpo/${encodeURIComponent(effectiveTenpoId)}`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`保存に失敗しました (${res.status}) ${text}`.trim());
      }
      const updated = await res.json();
      if (updated && typeof updated === 'object') {
        setDetailTenpo(updated);
      } else {
        setDetailTenpo((prev) => ({ ...(prev || {}), ...payload }));
      }
      setBasicEditMode(false);
      setBasicSaveMessage('基本情報を保存しました。');
    } catch (e) {
      setBasicSaveMessage(String(e?.message || e || '保存に失敗しました。'));
    } finally {
      setBasicSaving(false);
    }
  }, [canEditBasicInfo, effectiveTenpoId, basicSaving, effectiveTenpo, basicInfoForm, masterApiBase]);

  const detailHeadline = useMemo(() => {
    const yagou = norm(
      basicInfoForm.yagou_name ||
      effectiveTenpo?.yagou_name ||
      activeStore?.yagou
    );
    const name = norm(
      basicInfoForm.name ||
      effectiveTenpo?.name ||
      effectiveTenpo?.tenpo_name ||
      effectiveTenpo?.store_name ||
      activeStore?.name
    );
    if (yagou && name) return `${yagou} / ${name}`;
    if (yagou && !name) return `${yagou} / 店舗名未設定`;
    if (!yagou && name) return `屋号未設定 / ${name}`;
    return '屋号未設定 / 店舗名未設定';
  }, [basicInfoForm.yagou_name, basicInfoForm.name, effectiveTenpo, activeStore]);

  return (
    <div className="customer-mypage customer-mypage--pop">
      <header className="customer-mypage-hero">
        <p className="customer-mypage-kicker">MISESAPO CUSTOMER PORTAL</p>
        <h1>お客様マイページ</h1>
        <p className="customer-mypage-sub">
          {scopedTenpoId
            ? `基本情報 / 対応履歴 / ストレージを確認できます（${scopedTenpoId}）`
            : '店舗を選択して、基本情報・対応履歴・ストレージをご確認ください。'}
        </p>
      </header>

      {error ? <p className="customer-mypage-error">{error}</p> : null}
      {detailError ? <p className="customer-mypage-error">{detailError}</p> : null}
      {scopedTenpoId ? (
        <section className="customer-notice-section customer-notice-section-under-hero">
          <article className="customer-panel customer-panel-full">
            <div className="customer-panel-head">
              <h3>お知らせ</h3>
              <span className="count">{customerNotices.length}</span>
            </div>
            {customerNoticesLoading ? (
              <p className="customer-muted">お知らせを読み込み中です...</p>
            ) : customerNoticesError ? (
              <p className="customer-muted">{customerNoticesError}</p>
            ) : customerNotices.length === 0 ? (
              <p className="customer-muted">お知らせはまだありません。</p>
            ) : (
              <div className="customer-notice-list">
                {customerNotices.map((n) => (
                  <article key={n.id} className="customer-notice-card">
                    <div className="customer-notice-meta">
                      <span className={`kind kind-${n.kind}`}>{n.kind === 'running' ? '実行中' : '予定作成'}</span>
                      <span className="customer-notice-time">{fmtDateTimeJst(n.at) || '-'}</span>
                    </div>
                    <div className="customer-notice-text">{n.text}</div>
                  </article>
                ))}
              </div>
            )}
          </article>
        </section>
      ) : null}

      {!scopedTenpoId ? (
        <section className="customer-store-grid-wrap">
          <div className="customer-mypage-summary">
            <span>表示件数: {scopedStores.length}</span>
            <span>全件数: {stores.length}</span>
            <button type="button" className="btn btn-secondary" onClick={loadStores} disabled={loading || detailLoading}>
              {loading ? '読込中...' : '更新'}
            </button>
          </div>
          <div className="customer-store-grid">
            {(!loading && scopedStores.length === 0) ? (
              <div className="customer-store-empty">表示対象がありません</div>
            ) : null}
            {scopedStores.map((it) => (
              <article key={it.id} className="customer-store-card">
                <div className="customer-store-card-head">
                  <h2>{it.name}</h2>
                  <span className="chip">{it.id}</span>
                </div>
                <p className="customer-store-yagou">{it.yagou || '屋号未設定'}</p>
                <p className="customer-store-address">{it.address}</p>
                <a className="customer-store-link" href={it.url}>この店舗のページを開く</a>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <>
          <section className="customer-detail-layout" aria-busy={detailLoading ? 'true' : 'false'}>
            <div className="customer-detail-title">{detailHeadline}</div>

          <article className="customer-panel">
            <div className="customer-panel-head">
              <h3>基本情報</h3>
              {canEditBasicInfo ? (
                <div className="customer-panel-actions">
                  {basicEditMode ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setBasicInfoForm(buildBasicInfoForm(effectiveTenpo, activeStore));
                          setBasicEditMode(false);
                        }}
                        disabled={basicSaving}
                      >
                        キャンセル
                      </button>
                      <button type="button" className="btn btn-secondary" onClick={handleBasicInfoSave} disabled={basicSaving}>
                        {basicSaving ? '保存中...' : '保存'}
                      </button>
                    </>
                  ) : (
                    <button type="button" className="btn btn-secondary" onClick={() => setBasicEditMode(true)}>
                      編集
                    </button>
                  )}
                </div>
              ) : null}
            </div>
            {basicSaveMessage ? <p className="customer-basic-save-message">{basicSaveMessage}</p> : null}
            <dl className="customer-basic-grid">
              {basicInfoRows.map((row) => (
                <div key={row.label} className="customer-basic-row">
                  <dt>{row.label}</dt>
                  <dd>
                    {basicEditMode && row.key ? (
                      <input
                        type="text"
                        value={String(basicInfoForm?.[row.key] || '')}
                        onChange={(e) => onBasicInfoField(row.key, e.target.value)}
                        placeholder={`${row.label}を入力`}
                        disabled={basicSaving}
                      />
                    ) : row.href ? (
                      <a href={row.href} target="_blank" rel="noreferrer">{row.value}</a>
                    ) : row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </article>

          <article className="customer-panel">
            <div className="customer-panel-head">
              <h3>対応履歴</h3>
              <span className="count">{supportHistory.length}</span>
            </div>
            {supportHistory.length === 0 ? (
              <p className="customer-muted">対応履歴はまだありません。</p>
            ) : (
              <div className="customer-history-list">
                {supportHistory.map((h, idx) => {
                  const logs = safeArr(h?.logs).filter((lg) => norm(lg?.message));
                  return (
                    <article key={norm(h?.history_id) || `history-${idx}`} className="customer-history-card">
                      <div className="customer-history-top">
                        <span className="date">{norm(h?.date) || '-'}</span>
                        <span className="status">{norm(h?.status) || 'open'}</span>
                      </div>
                      <p><strong>件名:</strong> {norm(h?.topic) || '-'}</p>
                      <p><strong>対応:</strong> {norm(h?.action) || '-'}</p>
                      <p><strong>結果:</strong> {norm(h?.outcome) || '-'}</p>
                      <p className="customer-muted small">
                        更新: {fmtDateTimeJst(h?.updated_at) || '-'} / 返信 {logs.length}件
                      </p>
                    </article>
                  );
                })}
              </div>
            )}
          </article>

          <article className="customer-panel customer-panel-full">
            <div className="customer-panel-head">
              <h3>作業完了レポート（結果）</h3>
              <span className="count">{resultReports.length}</span>
            </div>
            {resultReportsLoading ? (
              <p className="customer-muted">作業完了レポートを読み込み中です...</p>
            ) : resultReportsError ? (
              <p className="customer-muted">{resultReportsError}</p>
            ) : resultReports.length === 0 ? (
              <p className="customer-muted">表示できる作業結果はまだありません。</p>
            ) : (
              <div className="customer-report-result-list">
                {resultReports.map((row, idx) => (
                  <article key={row.id || `${row.workDate}-${idx}`} className="customer-report-result-card">
                    <div className="customer-report-result-date">{row.workDate || '-'}</div>
                    <div className="customer-report-result-text">{row.result}</div>
                  </article>
                ))}
              </div>
            )}
          </article>

          <article className="customer-panel customer-panel-full">
            <div className="customer-panel-head">
              <h3>ストレージ</h3>
              <span className="count">{detailSoukoFiles.length}</span>
            </div>
            {detailSoukoFiles.length === 0 ? (
              <p className="customer-muted">登録済みファイルはありません。</p>
            ) : (
              <div className="customer-storage-grid">
                {detailSoukoFiles.slice().reverse().map((f) => (
                  <article key={f.key} className="customer-storage-card">
                    <div className="thumb">
                      {isImageFile(f.file_name, f.content_type, f.key) && f.open_url ? (
                        <img src={f.open_url} alt={f.file_name || f.key} loading="lazy" />
                      ) : (
                        <span>{fileKindLabel(f.file_name, f.content_type, f.key)}</span>
                      )}
                    </div>
                    <div className="meta">
                      <div className="name" title={f.file_name || f.key}>{f.file_name || '(no name)'}</div>
                      <div className="sub">
                        <span>{f.doc_category || '未分類'}</span>
                        <span>{formatBytes(f.size)}</span>
                        <span>{fmtDateTimeJst(f.uploaded_at) || f.uploaded_at || '-'}</span>
                      </div>
                    </div>
                    <div className="actions">
                      {f.open_url ? (
                        <a href={f.open_url} target="_blank" rel="noreferrer">開く</a>
                      ) : (
                        <span className="customer-muted">URLなし</span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </article>

          </section>

        </>
      )}
    </div>
  );
}
