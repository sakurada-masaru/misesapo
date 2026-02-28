import React, { useCallback, useMemo, useState } from 'react';
import styled from 'styled-components';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import TemplateRenderer, { getNestedValue, setNestedValue, validateTemplatePayload } from '../../../shared/components/TemplateRenderer';
import { getTemplateById } from '../../../templates';
import { apiFetchWorkReport } from '../../shared/api/client';
import { useAuth } from '../../shared/auth/useAuth';
import { getServiceCategoryLabel } from './serviceCategoryCatalog';

const TEMPLATE_ID = 'CLEANING_SHEETS_3_V1';
const WORK_TYPE_OPTIONS = ['定期清掃', 'スポット清掃', '追加清掃', '再清掃'];
const SPECIAL_ADD_SERVICE_ID = 'service_0044';
const SPECIAL_ADD_SERVICE_LABEL = 'その他';

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

function todayYmd() {
  try {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return '';
  }
}

function coerceArray(v) {
  return Array.isArray(v) ? v : [];
}

function getItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function norm(v) {
  return String(v || '').trim();
}

function nowIso() {
  return new Date().toISOString();
}

function safeFilePart(v) {
  const s = norm(v)
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
  return s || 'cleaning_report';
}

function isImageAttachment(att) {
  const mime = String(att?.mime || att?.content_type || '').toLowerCase();
  if (mime.startsWith('image/')) return true;
  const name = String(att?.name || att?.file_name || '').toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.heic', '.heif'].some((ext) => name.endsWith(ext));
}

const REPORT_PHOTO_BUCKETS = ['before', 'after', 'work'];
const SINGLE_WORK_BUCKET_SERVICE_RE = /(害虫駆除|害獣駆除)/;
const SINGLE_WORK_BUCKET_HINT_RE = /(害虫|害獣|pest|rodent|insect|ゴキブリ|ねずみ|ネズミ)/i;
const SINGLE_WORK_BUCKET_CATEGORY_SET = new Set(['pest_control', 'pest_hygiene', 'pest']);

function emptyServicePhotoBuckets() {
  return { before: [], after: [], work: [] };
}

function isSingleWorkPhotoService(service) {
  const name = norm(service?.name);
  const serviceIdRaw = norm(service?.service_id);
  const serviceId = serviceIdRaw.toLowerCase();
  if (serviceIdRaw === SPECIAL_ADD_SERVICE_ID) return true;
  const category = norm(service?.category).toLowerCase();
  const concept = norm(service?.category_concept).toLowerCase();
  const categoryLabel = norm(getServiceCategoryLabel(service?.category)).toLowerCase();
  const conceptLabel = norm(getServiceCategoryLabel(service?.category_concept)).toLowerCase();
  if (SINGLE_WORK_BUCKET_CATEGORY_SET.has(category)) return true;
  if (SINGLE_WORK_BUCKET_CATEGORY_SET.has(concept)) return true;
  if (SINGLE_WORK_BUCKET_CATEGORY_SET.has(categoryLabel)) return true;
  if (SINGLE_WORK_BUCKET_CATEGORY_SET.has(conceptLabel)) return true;
  if (category.includes('pest') || concept.includes('pest')) return true;
  if (categoryLabel.includes('pest') || conceptLabel.includes('pest')) return true;
  if (SINGLE_WORK_BUCKET_HINT_RE.test(serviceId)) return true;
  if (SINGLE_WORK_BUCKET_HINT_RE.test(category)) return true;
  if (SINGLE_WORK_BUCKET_HINT_RE.test(concept)) return true;
  if (SINGLE_WORK_BUCKET_HINT_RE.test(categoryLabel)) return true;
  if (SINGLE_WORK_BUCKET_HINT_RE.test(conceptLabel)) return true;
  if (!name) return false;
  return SINGLE_WORK_BUCKET_SERVICE_RE.test(name) || SINGLE_WORK_BUCKET_HINT_RE.test(name);
}

function getPhotoNo(att) {
  const n = Number(att?.photo_no);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function getPhotoIdentity(att) {
  const no = getPhotoNo(att);
  if (no) return `写真No.${no}`;
  return norm(att?.name) || norm(att?.file_name) || '写真';
}

function getMaxPhotoNo(state) {
  const nums = [];
  coerceArray(state?.pool).forEach((att) => {
    const n = getPhotoNo(att);
    if (n) nums.push(n);
  });
  Object.values(state?.byService || {}).forEach((buckets) => {
    [...coerceArray(buckets?.before), ...coerceArray(buckets?.after), ...coerceArray(buckets?.work)].forEach((att) => {
      const n = getPhotoNo(att);
      if (n) nums.push(n);
    });
  });
  return nums.length ? Math.max(...nums) : 0;
}

function normalizeReportPhotos(raw, selectedServiceIds = []) {
  const byService = {};
  const selected = coerceArray(selectedServiceIds).map((v) => norm(v)).filter(Boolean);
  selected.forEach((sid) => {
    byService[sid] = emptyServicePhotoBuckets();
  });

  if (!raw) return { pool: [], byService };

  if (raw?.by_service && typeof raw.by_service === 'object') {
    Object.entries(raw.by_service || {}).forEach(([sidRaw, buckets]) => {
      const sid = norm(sidRaw);
      if (!sid) return;
      byService[sid] = {
        before: coerceArray(buckets?.before),
        after: coerceArray(buckets?.after),
        work: coerceArray(buckets?.work),
      };
    });
    return { pool: coerceArray(raw?.pool), byService };
  }

  if (Array.isArray(raw)) {
    return { pool: [...raw], byService };
  }

  // Legacy compatibility: old structure (global before/after/unassigned or array).
  const fallbackSid = selected[0];
  if (!fallbackSid) {
    return { pool: coerceArray(raw?.unassigned), byService };
  }
  const legacyBefore = coerceArray(raw?.before);
  const legacyAfter = coerceArray(raw?.after);
  const legacyUnassigned = coerceArray(raw?.unassigned);
  byService[fallbackSid] = {
    before: [...legacyBefore],
    after: [...legacyAfter],
    work: [],
  };
  return { pool: [...legacyUnassigned], byService };
}

function formatYmdJaWithWeekday(ymd) {
  const s = norm(ymd);
  if (!s) return '-';
  const d = new Date(`${s}T00:00:00`);
  if (Number.isNaN(d.getTime())) return s;
  const weeks = ['日', '月', '火', '水', '木', '金', '土'];
  return `${d.getFullYear()}年 ${d.getMonth() + 1}月 ${d.getDate()}日（${weeks[d.getDay()]}曜日）`;
}

function calcMinutes(startRaw, endRaw) {
  const start = norm(startRaw);
  const end = norm(endRaw);
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return null;
  const [sh, sm] = start.split(':').map((v) => Number(v));
  const [eh, em] = end.split(':').map((v) => Number(v));
  if ([sh, sm, eh, em].some((v) => Number.isNaN(v))) return null;
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  if (e < s) return null;
  return e - s;
}

function normalizeShokushuList(raw) {
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v || '').trim().toLowerCase()).filter(Boolean);
  }
  const s = String(raw || '').trim();
  if (!s) return [];
  const cleaned = s
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .replace(/"/g, '')
    .replace(/'/g, '');
  return cleaned
    .split(/[,\s、/]+/)
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const comma = dataUrl.indexOf(',');
      resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
    };
    reader.onerror = () => reject(new Error('ファイル変換に失敗しました'));
    reader.readAsDataURL(file);
  });
}

export default function AdminCleaningHoukokuBuilderPage() {
  const { user, isLoading: authLoading, isAuthenticated, login, getToken } = useAuth();
  const template = useMemo(() => getTemplateById(TEMPLATE_ID), []);
  const editorTemplate = useMemo(() => {
    if (!template) return template;
    const sections = Array.isArray(template.sections)
      ? template.sections.filter((sec) => !['overview', 'sheets', 'supplement'].includes(String(sec?.id || '')))
      : [];
    return { ...template, sections };
  }, [template]);
  const printRef = React.useRef(null);
  const reportPhotosInputRef = React.useRef(null);
  const supplementFilesInputRef = React.useRef(null);
  const [payload, setPayload] = useState(() => ({
    work_date: todayYmd(),
    user_name: user?.name || '',
    work_start_time: '',
    work_end_time: '',
    work_type: '定期清掃',
    work_detail: '',
    sheets: { sheet1: [], sheet2: [], sheet3: [] },
    report_photos: { pool: [], by_service: {} },
    service_photo_comments: {},
    supplement_files: [],
  }));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // {type,text}
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [soukoBusy, setSoukoBusy] = useState(false);
  const [tenpoRows, setTenpoRows] = useState([]);
  const [serviceRows, setServiceRows] = useState([]);
  const [cleanerRows, setCleanerRows] = useState([]);
  const [masterQuery, setMasterQuery] = useState('');
  const [serviceQuery, setServiceQuery] = useState('');
  const [servicePickerOpen, setServicePickerOpen] = useState(false);
  const [activeServiceTab, setActiveServiceTab] = useState('');
  const [tenpoId, setTenpoId] = useState('');
  const [serviceIds, setServiceIds] = useState([]);
  const [cleanerIds, setCleanerIds] = useState([]);
  const [draggingPhoto, setDraggingPhoto] = useState(null); // {type:'pool'|'service',serviceId?,bucket?,index}
  const localPhotoObjectUrlsRef = React.useRef(new Set());
  const [localPhotoSrcByKey, setLocalPhotoSrcByKey] = useState({});

  // Keep user_name updated when auth finishes.
  React.useEffect(() => {
    if (!user?.name) return;
    setPayload((p) => (p.user_name ? p : { ...p, user_name: user.name }));
  }, [user?.name]);

  React.useEffect(() => () => {
    localPhotoObjectUrlsRef.current.forEach((u) => {
      try {
        URL.revokeObjectURL(u);
      } catch (_) {
        // no-op
      }
    });
    localPhotoObjectUrlsRef.current.clear();
  }, []);

  const reportPhotosState = useMemo(
    () => normalizeReportPhotos(getNestedValue(payload, 'report_photos'), serviceIds),
    [payload, serviceIds]
  );
  const reportPhotoPool = reportPhotosState.pool;
  const reportPhotoByService = reportPhotosState.byService;
  const reportPhotos = useMemo(
    () => coerceArray(serviceIds).flatMap((sidRaw) => {
      const sid = norm(sidRaw);
      const buckets = reportPhotoByService[sid] || emptyServicePhotoBuckets();
      return [...coerceArray(buckets.before), ...coerceArray(buckets.after), ...coerceArray(buckets.work)];
    }),
    [reportPhotoByService, serviceIds]
  );
  const reportPhotosAssignedCount = useMemo(
    () => Object.values(reportPhotoByService || {}).reduce(
      (sum, b) => sum + coerceArray(b?.before).length + coerceArray(b?.after).length + coerceArray(b?.work).length,
      0
    ),
    [reportPhotoByService]
  );
  const rawServicePhotoComments = getNestedValue(payload, 'service_photo_comments');
  const resolvePhotoSrc = useCallback((att) => {
    const key = norm(att?.key);
    if (key && localPhotoSrcByKey[key]) return localPhotoSrcByKey[key];
    return String(att?.url || '');
  }, [localPhotoSrcByKey]);
  const servicePhotoComments = useMemo(
    () => (rawServicePhotoComments && typeof rawServicePhotoComments === 'object'
      ? rawServicePhotoComments
      : {}),
    [rawServicePhotoComments]
  );
  const supplementFiles = useMemo(
    () => coerceArray(getNestedValue(payload, 'supplement_files')),
    [payload]
  );

  const canSubmit = (
    reportPhotos.length > 0
    && !saving
    && !photoBusy
    && !soukoBusy
    && !!norm(payload.work_date)
    && !!norm(tenpoId)
    && Array.isArray(cleanerIds)
    && cleanerIds.length > 0
    && Array.isArray(serviceIds)
    && serviceIds.length > 0
  );

  const authHeaders = useCallback(() => {
    const token = getToken() || localStorage.getItem('cognito_id_token');
    return token ? { Authorization: `Bearer ${String(token).trim()}` } : {};
  }, [getToken]);

  const apiJson = useCallback(async (path, { method = 'GET', body } = {}) => {
    const base = MASTER_API_BASE.replace(/\/$/, '');
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...authHeaders(),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`${method} ${path} HTTP ${res.status}${text ? ` ${text}` : ''}`.trim());
    }
    return res.json();
  }, [authHeaders]);

  const jinzaiJson = useCallback(async (path, { method = 'GET', body } = {}) => {
    const base = JINZAI_API_BASE.replace(/\/$/, '');
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...authHeaders(),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`${method} ${path} HTTP ${res.status}${text ? ` ${text}` : ''}`.trim());
    }
    return res.json();
  }, [authHeaders]);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [tenpoData, yagouData, toriData, serviceData, jinzaiData] = await Promise.all([
          apiJson('/master/tenpo?limit=20000&jotai=yuko'),
          apiJson('/master/yagou?limit=20000&jotai=yuko'),
          apiJson('/master/torihikisaki?limit=20000&jotai=yuko'),
          apiJson('/master/service?limit=5000&jotai=yuko'),
          jinzaiJson('/jinzai?limit=5000&jotai=yuko'),
        ]);
        if (!mounted) return;
        const yagouMap = new Map(
          getItems(yagouData)
            .map((it) => [norm(it?.yagou_id), norm(it?.name)])
            .filter(([id]) => Boolean(id))
        );
        const toriMap = new Map(
          getItems(toriData)
            .map((it) => [norm(it?.torihikisaki_id), norm(it?.name)])
            .filter(([id]) => Boolean(id))
        );
        const rows = getItems(tenpoData)
          .map((it) => ({
            ...it,
            yagou_name: norm(it?.yagou_name) || yagouMap.get(norm(it?.yagou_id)) || '',
            torihikisaki_name: norm(it?.torihikisaki_name) || toriMap.get(norm(it?.torihikisaki_id)) || '',
          }))
          .sort((a, b) => {
            const an = [norm(a?.torihikisaki_name), norm(a?.yagou_name), norm(a?.name), norm(a?.tenpo_id)].join(' ');
            const bn = [norm(b?.torihikisaki_name), norm(b?.yagou_name), norm(b?.name), norm(b?.tenpo_id)].join(' ');
            return an.localeCompare(bn, 'ja');
          });
        setTenpoRows(rows);
        setTenpoId((cur) => (cur && rows.some((r) => norm(r?.tenpo_id) === cur) ? cur : ''));

        const services = getItems(serviceData)
          .map((it) => ({
            ...it,
            service_id: norm(it?.service_id),
            name: norm(it?.name) || norm(it?.service_id),
          }))
          .filter((it) => Boolean(it.service_id))
          .sort((a, b) => {
            const an = [norm(a?.category), norm(a?.name), norm(a?.service_id)].join(' ');
            const bn = [norm(b?.category), norm(b?.name), norm(b?.service_id)].join(' ');
            return an.localeCompare(bn, 'ja');
          });
        setServiceRows(services);

        const allJinzai = getItems(jinzaiData);
        const onlyCleaning = allJinzai.filter((it) => {
          const sList = normalizeShokushuList(it?.shokushu);
          const busho = String(it?.busho || '').toLowerCase();
          return sList.includes('seisou') || sList.includes('cleaning') || busho.includes('清掃');
        });
        const cleaners = (onlyCleaning.length ? onlyCleaning : allJinzai)
          .map((it) => ({
            ...it,
            jinzai_id: norm(it?.jinzai_id),
            name: norm(it?.name) || norm(it?.jinzai_id),
          }))
          .filter((it) => Boolean(it.jinzai_id))
          .sort((a, b) => norm(a?.name).localeCompare(norm(b?.name), 'ja'));
        setCleanerRows(cleaners);
        setCleanerIds((cur) => {
          const keep = Array.isArray(cur)
            ? cur.map((id) => norm(id)).filter((id) => cleaners.some((r) => norm(r?.jinzai_id) === id))
            : [];
          return keep;
        });
      } catch (e) {
        console.error('[AdminCleaningHoukokuBuilder] tenpo load failed', e);
        setStatus({ type: 'error', text: e?.message || '店舗/サービス/清掃員一覧の取得に失敗しました' });
      }
    })();
    return () => {
      mounted = false;
    };
  }, [apiJson, jinzaiJson]);

  const tenpoById = useMemo(() => {
    const m = new Map();
    (tenpoRows || []).forEach((row) => {
      const id = norm(row?.tenpo_id);
      if (!id) return;
      m.set(id, row);
    });
    return m;
  }, [tenpoRows]);

  const visibleTenpoRows = useMemo(() => {
    const q = norm(masterQuery).toLowerCase();
    if (!q) return tenpoRows;
    return (tenpoRows || []).filter((row) => {
      const blob = [
        row?.tenpo_id,
        row?.name,
        row?.address,
        row?.yagou_name,
        row?.torihikisaki_name,
      ].map((v) => String(v || '').toLowerCase()).join(' ');
      return blob.includes(q);
    });
  }, [masterQuery, tenpoRows]);

  const visibleServiceRows = useMemo(() => {
    const q = norm(serviceQuery || masterQuery).toLowerCase();
    const rows = (serviceRows || []).filter((row) => norm(row?.service_id) !== SPECIAL_ADD_SERVICE_ID);
    if (!q) return rows;
    return rows.filter((row) => {
      const blob = [
        row?.service_id,
        row?.name,
        row?.category,
        row?.category_concept,
      ].map((v) => String(v || '').toLowerCase()).join(' ');
      return blob.includes(q);
    });
  }, [masterQuery, serviceQuery, serviceRows]);

  const visibleServiceGroups = useMemo(() => {
    const groups = new Map();
    (visibleServiceRows || []).forEach((row) => {
      const category = getServiceCategoryLabel(row?.category);
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(row);
    });
    return Array.from(groups.entries())
      .map(([category, items]) => ({
        category,
        items: [...items].sort((a, b) => {
          const an = [norm(a?.name), norm(a?.service_id)].join(' ');
          const bn = [norm(b?.name), norm(b?.service_id)].join(' ');
          return an.localeCompare(bn, 'ja');
        }),
      }))
      .sort((a, b) => a.category.localeCompare(b.category, 'ja'));
  }, [visibleServiceRows]);

  const visibleCleanerRows = useMemo(() => {
    const q = norm(masterQuery).toLowerCase();
    if (!q) return cleanerRows;
    const filtered = (cleanerRows || []).filter((row) => {
      const blob = [
        row?.jinzai_id,
        row?.name,
        row?.busho,
        row?.shokushu,
      ].map((v) => String(v || '').toLowerCase()).join(' ');
      return blob.includes(q);
    });
    // 統合検索で店舗/サービス語句を入れた場合に清掃員候補が0件になり、
    // 選択不可に見える状態を避けるため全件へフォールバックする。
    return filtered.length ? filtered : cleanerRows;
  }, [masterQuery, cleanerRows]);

  const searchCandidates = useMemo(() => {
    const active = norm(masterQuery);
    if (!active) return null;
    const selectedTenpo = tenpoById.get(norm(tenpoId));
    const tenpoCandidates = selectedTenpo
      ? [selectedTenpo]
      : (visibleTenpoRows || []).slice(0, 8);
    return {
      tenpo: tenpoCandidates,
      cleaner: (visibleCleanerRows || []).slice(0, 8),
      service: (visibleServiceRows || []).slice(0, 12),
    };
  }, [masterQuery, tenpoById, tenpoId, visibleCleanerRows, visibleServiceRows, visibleTenpoRows]);

  const serviceById = useMemo(() => {
    const m = new Map();
    (serviceRows || []).forEach((row) => {
      const id = norm(row?.service_id);
      if (!id) return;
      m.set(id, row);
    });
    return m;
  }, [serviceRows]);
  const specialAddService = useMemo(
    () => serviceById.get(SPECIAL_ADD_SERVICE_ID) || null,
    [serviceById]
  );
  const getServiceDisplayName = useCallback((serviceOrId) => {
    const sid = typeof serviceOrId === 'string'
      ? norm(serviceOrId)
      : norm(serviceOrId?.service_id);
    if (!sid) return '';
    if (sid === SPECIAL_ADD_SERVICE_ID) return SPECIAL_ADD_SERVICE_LABEL;
    if (typeof serviceOrId === 'string') return sid;
    return norm(serviceOrId?.name) || sid;
  }, []);

  const cleanerById = useMemo(() => {
    const m = new Map();
    (cleanerRows || []).forEach((row) => {
      const id = norm(row?.jinzai_id);
      if (!id) return;
      m.set(id, row);
    });
    return m;
  }, [cleanerRows]);

  const selectedTenpoLabel = useMemo(() => {
    const row = tenpoById.get(norm(tenpoId)) || {};
    return [
      norm(row?.torihikisaki_name),
      norm(row?.yagou_name),
      norm(row?.name) || norm(tenpoId),
    ].filter(Boolean).join(' / ');
  }, [tenpoById, tenpoId]);

  const selectedTenpoWorkLabel = useMemo(() => {
    const row = tenpoById.get(norm(tenpoId)) || {};
    return [
      norm(row?.yagou_name),
      norm(row?.name) || norm(tenpoId),
    ].filter(Boolean).join(' / ');
  }, [tenpoById, tenpoId]);

  const selectedServiceNames = useMemo(
    () => (serviceIds || []).map((sid) => getServiceDisplayName(serviceById.get(norm(sid)) || sid)).filter(Boolean),
    [getServiceDisplayName, serviceById, serviceIds]
  );

  const selectedServiceGroupsForDoc = useMemo(() => {
    const groups = new Map();
    (serviceIds || []).forEach((sidRaw) => {
      const sid = norm(sidRaw);
      if (!sid) return;
      const svc = serviceById.get(sid) || {};
      const cat = getServiceCategoryLabel(svc?.category);
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat).push(getServiceDisplayName(svc || sid));
    });
    return Array.from(groups.entries()).map(([category, names]) => ({ category, names }));
  }, [getServiceDisplayName, serviceById, serviceIds]);

  const totalWorkMinutes = useMemo(
    () => calcMinutes(payload.work_start_time, payload.work_end_time),
    [payload.work_start_time, payload.work_end_time]
  );

  const selectedTenpo = useMemo(
    () => tenpoById.get(norm(tenpoId)) || {},
    [tenpoById, tenpoId]
  );

  const tenpoSelectRows = useMemo(() => {
    const selected = tenpoById.get(norm(tenpoId));
    if (selected) return [selected];
    return visibleTenpoRows;
  }, [tenpoById, tenpoId, visibleTenpoRows]);

  const recipientName = useMemo(
    () => norm(selectedTenpo?.torihikisaki_name) || norm(selectedTenpo?.yagou_name) || norm(selectedTenpo?.name) || '-',
    [selectedTenpo]
  );

  const uploadOne = useCallback(async (file) => {
    const headers = authHeaders();
    const res = await apiFetchWorkReport('/houkoku/upload-url', {
      method: 'POST',
      headers,
      body: JSON.stringify({ filename: file.name, mime: file.type }),
    });
    const fileBase64 = await fileToBase64(file);
    await apiFetchWorkReport('/upload-put', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        uploadUrl: res.uploadUrl,
        contentType: file.type || 'application/octet-stream',
        fileBase64,
      }),
    });
    return {
      url: res.url,
      key: res.key,
      name: file.name,
      mime: file.type || 'application/octet-stream',
      size: file.size,
      uploaded_at: new Date().toISOString(),
    };
  }, [authHeaders]);

  const onFileUpload = useCallback(async (keyPath, file) => {
    setSaving(true);
    setStatus(null);
    try {
      const att = await uploadOne(file);
      setPayload((prev) => {
        return setNestedValue(prev, keyPath, [att]);
      });
    } catch (e) {
      console.error(e);
      setStatus({ type: 'error', text: `アップロード失敗: ${e?.message || e}` });
    } finally {
      setSaving(false);
    }
  }, [uploadOne]);

  const onFileRemove = useCallback((keyPath, index) => {
    setPayload((prev) => {
      const arr = coerceArray(getNestedValue(prev, keyPath));
      if (typeof index !== 'number') return setNestedValue(prev, keyPath, []);
      return setNestedValue(prev, keyPath, arr.filter((_, i) => i !== index));
    });
  }, []);

  const addPoolPhotos = useCallback(async (files) => {
    const list = Array.from(files || []).filter(Boolean);
    if (!list.length) return;
    setPhotoBusy(true);
    setStatus(null);
    try {
      const uploaded = [];
      for (const file of list) {
        // eslint-disable-next-line no-await-in-loop
        const att = await uploadOne(file);
        uploaded.push(att);
      }
      const localEntries = uploaded
        .map((att, idx) => {
          const key = norm(att?.key);
          if (!key) return null;
          const file = list[idx];
          if (!file) return null;
          const objectUrl = URL.createObjectURL(file);
          localPhotoObjectUrlsRef.current.add(objectUrl);
          return [key, objectUrl];
        })
        .filter(Boolean);
      if (localEntries.length) {
        setLocalPhotoSrcByKey((prev) => ({ ...prev, ...Object.fromEntries(localEntries) }));
      }
      setPayload((prev) => {
        const state = normalizeReportPhotos(getNestedValue(prev, 'report_photos'), serviceIds);
        const baseNo = getMaxPhotoNo(state);
        const numbered = uploaded.map((att, idx) => ({ ...att, photo_no: baseNo + idx + 1 }));
        return setNestedValue(prev, 'report_photos', {
          pool: [...coerceArray(state.pool), ...numbered],
          by_service: {
            ...state.byService,
          },
        });
      });
    } catch (e) {
      console.error(e);
      setStatus({ type: 'error', text: `写真アップロード失敗: ${e?.message || e}` });
    } finally {
      setPhotoBusy(false);
    }
  }, [serviceIds, uploadOne]);

  const removeReportPhoto = useCallback((serviceIdRaw, bucketRaw, index) => {
    const serviceId = norm(serviceIdRaw);
    const bucket = String(bucketRaw || '').trim();
    if (!serviceId || !REPORT_PHOTO_BUCKETS.includes(bucket)) return;
    setPayload((prev) => {
      const state = normalizeReportPhotos(getNestedValue(prev, 'report_photos'), serviceIds);
      const byService = state.byService;
      const currentBuckets = byService[serviceId] || emptyServicePhotoBuckets();
      return setNestedValue(prev, 'report_photos', {
        pool: coerceArray(state.pool),
        by_service: {
          ...byService,
          [serviceId]: {
            ...currentBuckets,
            [bucket]: coerceArray(currentBuckets[bucket]).filter((_, i) => i !== index),
          },
        },
      });
    });
  }, [serviceIds]);

  const removePoolPhoto = useCallback((index) => {
    setPayload((prev) => {
      const state = normalizeReportPhotos(getNestedValue(prev, 'report_photos'), serviceIds);
      return setNestedValue(prev, 'report_photos', {
        pool: coerceArray(state.pool).filter((_, i) => i !== index),
        by_service: { ...state.byService },
      });
    });
  }, [serviceIds]);

  const movePhotoItem = useCallback((from, to, toIndex = null) => {
    if (!from || !to) return;
    if (typeof from.index !== 'number' || from.index < 0) return;
    if (to.type === 'service' && !REPORT_PHOTO_BUCKETS.includes(String(to.bucket || '').trim())) return;
    if (from.type === 'service' && !REPORT_PHOTO_BUCKETS.includes(String(from.bucket || '').trim())) return;

    setPayload((prev) => {
      const state = normalizeReportPhotos(getNestedValue(prev, 'report_photos'), serviceIds);
      let pool = [...coerceArray(state.pool)];
      const byService = Object.fromEntries(
        Object.entries(state.byService || {}).map(([sid, b]) => [sid, {
          before: [...coerceArray(b?.before)],
          after: [...coerceArray(b?.after)],
          work: [...coerceArray(b?.work)],
        }])
      );

      const fromSid = norm(from.serviceId);
      const toSid = norm(to.serviceId);

      const getArr = (src) => {
        if (src.type === 'pool') return pool;
        if (!src.serviceId || !src.bucket) return null;
        const sid = norm(src.serviceId);
        if (!byService[sid] && src.type === 'service') byService[sid] = emptyServicePhotoBuckets();
        return byService[sid]?.[String(src.bucket).trim()] || null;
      };

      const fromArr = getArr(from);
      if (!fromArr || from.index >= fromArr.length) return prev;
      const [picked] = fromArr.splice(from.index, 1);

      if (to.type === 'pool') {
        let insertAt = typeof toIndex === 'number' ? toIndex : pool.length;
        if (from.type === 'pool' && from.index < insertAt) insertAt -= 1;
        insertAt = Math.max(0, Math.min(insertAt, pool.length));
        pool.splice(insertAt, 0, picked);
      } else {
        if (!toSid) return prev;
        if (!byService[toSid]) byService[toSid] = emptyServicePhotoBuckets();
        const bucket = String(to.bucket).trim();
        const toArr = byService[toSid][bucket];
        let insertAt = typeof toIndex === 'number' ? toIndex : toArr.length;
        if (from.type === 'service' && fromSid === toSid && from.bucket === bucket && from.index < insertAt) insertAt -= 1;
        insertAt = Math.max(0, Math.min(insertAt, toArr.length));
        toArr.splice(insertAt, 0, picked);
      }

      return setNestedValue(prev, 'report_photos', {
        pool,
        by_service: byService,
      });
    });
  }, [serviceIds]);

  const onPhotoDrop = useCallback((toServiceId, toBucket, toIndex = null) => {
    if (!draggingPhoto) return;
    movePhotoItem(draggingPhoto, { type: 'service', serviceId: toServiceId, bucket: toBucket }, toIndex);
    setDraggingPhoto(null);
  }, [draggingPhoto, movePhotoItem]);

  const onPoolDrop = useCallback((toIndex = null) => {
    if (!draggingPhoto) return;
    movePhotoItem(draggingPhoto, { type: 'pool' }, toIndex);
    setDraggingPhoto(null);
  }, [draggingPhoto, movePhotoItem]);

  const addSupplementFiles = useCallback(async (files) => {
    const list = Array.from(files || []).filter(Boolean);
    if (!list.length) return;
    setPhotoBusy(true);
    setStatus(null);
    try {
      const uploaded = [];
      for (const file of list) {
        // eslint-disable-next-line no-await-in-loop
        const att = await uploadOne(file);
        uploaded.push(att);
      }
      setPayload((prev) => {
        const cur = coerceArray(getNestedValue(prev, 'supplement_files'));
        return setNestedValue(prev, 'supplement_files', [...cur, ...uploaded]);
      });
    } catch (e) {
      console.error(e);
      setStatus({ type: 'error', text: `補助資料アップロード失敗: ${e?.message || e}` });
    } finally {
      setPhotoBusy(false);
    }
  }, [uploadOne]);

  const removeSupplementFile = useCallback((index) => {
    setPayload((prev) => {
      const cur = coerceArray(getNestedValue(prev, 'supplement_files'));
      return setNestedValue(prev, 'supplement_files', cur.filter((_, i) => i !== index));
    });
  }, []);

  const onMetaChange = useCallback((key, value) => {
    setPayload((prev) => ({ ...prev, [key]: value }));
  }, []);

  const onServiceCommentChange = useCallback((serviceIdRaw, value) => {
    const sid = norm(serviceIdRaw);
    if (!sid) return;
    setPayload((prev) => {
      const current = getNestedValue(prev, 'service_photo_comments');
      const next = current && typeof current === 'object' ? { ...current } : {};
      const v = String(value || '');
      if (norm(v)) next[sid] = v;
      else delete next[sid];
      return setNestedValue(prev, 'service_photo_comments', next);
    });
  }, []);

  const selectedServices = useMemo(
    () => (serviceIds || []).map((sid) => serviceById.get(norm(sid))).filter(Boolean),
    [serviceById, serviceIds]
  );
  const selectedServicesForTag = useMemo(
    () => selectedServices.filter((svc) => norm(svc?.service_id) !== SPECIAL_ADD_SERVICE_ID),
    [selectedServices]
  );
  const isSpecialAddServiceSelected = serviceIds.includes(SPECIAL_ADD_SERVICE_ID);
  const selectedOverlayServiceCount = useMemo(
    () => serviceIds.filter((sid) => norm(sid) !== SPECIAL_ADD_SERVICE_ID).length,
    [serviceIds]
  );

  React.useEffect(() => {
    const singleServiceIds = new Set(
      selectedServices
        .filter((svc) => isSingleWorkPhotoService(svc))
        .map((svc) => norm(svc?.service_id))
        .filter(Boolean)
    );
    if (!singleServiceIds.size) return;

    setPayload((prev) => {
      const state = normalizeReportPhotos(getNestedValue(prev, 'report_photos'), serviceIds);
      const byService = { ...state.byService };
      let changed = false;
      singleServiceIds.forEach((sid) => {
        const buckets = byService[sid] || emptyServicePhotoBuckets();
        const before = coerceArray(buckets.before);
        const after = coerceArray(buckets.after);
        if (!before.length && !after.length) return;
        changed = true;
        byService[sid] = {
          ...buckets,
          before: [],
          after: [],
          work: [...coerceArray(buckets.work), ...before, ...after],
        };
      });
      if (!changed) return prev;
      return setNestedValue(prev, 'report_photos', {
        pool: coerceArray(state.pool),
        by_service: byService,
      });
    });
  }, [selectedServices, serviceIds]);

  React.useEffect(() => {
    const ids = selectedServices.map((svc) => norm(svc?.service_id)).filter(Boolean);
    setActiveServiceTab((cur) => {
      if (cur && ids.includes(cur)) return cur;
      return ids[0] || '';
    });
  }, [selectedServices]);

  const reportPhotoDocGroups = useMemo(
    () => selectedServices.map((svc) => {
      const sid = norm(svc?.service_id);
      const buckets = reportPhotoByService[sid] || emptyServicePhotoBuckets();
      const singleWorkMode = isSingleWorkPhotoService(svc);
      const mergedWork = [
        ...coerceArray(buckets.work),
        ...coerceArray(buckets.before),
        ...coerceArray(buckets.after),
      ];
      return {
        key: sid,
        serviceName: getServiceDisplayName(svc || sid),
        comment: String(servicePhotoComments?.[sid] || ''),
        singleWorkMode,
        before: singleWorkMode ? [] : coerceArray(buckets.before),
        after: singleWorkMode ? [] : coerceArray(buckets.after),
        work: singleWorkMode ? mergedWork : coerceArray(buckets.work),
      };
    }),
    [getServiceDisplayName, reportPhotoByService, selectedServices, servicePhotoComments]
  );

  const cleanerNames = useMemo(
    () => (cleanerIds || [])
      .map((cid) => norm(cleanerById.get(norm(cid))?.name || cid))
      .filter(Boolean),
    [cleanerById, cleanerIds]
  );

  const primaryCleanerName = useMemo(
    () => cleanerNames[0] || '',
    [cleanerNames]
  );

  const toggleService = useCallback((sidRaw) => {
    const sid = norm(sidRaw);
    if (!sid) return;
    setServiceIds((prev) => (
      prev.includes(sid)
        ? prev.filter((id) => id !== sid)
        : [...prev, sid]
    ));
  }, []);

  const removeService = useCallback((sid) => {
    const target = norm(sid);
    setServiceIds((prev) => prev.filter((id) => norm(id) !== target));
  }, []);

  React.useEffect(() => {
    if (!cleanerNames.length) return;
    setPayload((prev) => ({ ...prev, user_name: cleanerNames.join(' / ') }));
  }, [cleanerNames]);

  const toggleCleaner = useCallback((cidRaw) => {
    const cid = norm(cidRaw);
    if (!cid) return;
    setCleanerIds((prev) => (prev.includes(cid) ? prev.filter((id) => id !== cid) : [...prev, cid]));
  }, []);

  React.useEffect(() => {
    if (!servicePickerOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setServicePickerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [servicePickerOpen]);

  const buildReportPdfBlob = useCallback(async () => {
    const node = printRef.current;
    if (!node) throw new Error('プレビュー領域が見つかりません');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const pageMarginX = 8;
    const pageMarginTop = 8;
    const pageMarginBottom = 8;
    const contentWidth = Math.max(1, pdfWidth - (pageMarginX * 2));
    const pageBottomY = pdfHeight - pageMarginBottom;
    let cursorY = pageMarginTop;

    const renderTargets = Array.from(node.querySelectorAll('[data-pdf-block="1"]'));
    const blocks = renderTargets.length ? renderTargets : [node];

    const renderCanvasToPdf = (canvas) => {
      const widthPx = Number(canvas?.width || 0);
      const heightPx = Number(canvas?.height || 0);
      if (!widthPx || !heightPx) return;

      const mmPerPx = contentWidth / widthPx;
      let offsetPx = 0;
      let remainPx = heightPx;

      while (remainPx > 0) {
        const remainMmInPage = pageBottomY - cursorY;
        if (remainMmInPage <= 0.5) {
          pdf.addPage();
          cursorY = pageMarginTop;
          continue;
        }

        const availablePx = Math.max(1, Math.floor(remainMmInPage / mmPerPx));
        const slicePx = Math.min(remainPx, availablePx);

        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = widthPx;
        sliceCanvas.height = slicePx;
        const ctx = sliceCanvas.getContext('2d');
        if (!ctx) throw new Error('PDF描画コンテキスト取得に失敗しました');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, widthPx, slicePx);
        ctx.drawImage(canvas, 0, offsetPx, widthPx, slicePx, 0, 0, widthPx, slicePx);

        const sliceHeightMm = slicePx * mmPerPx;
        pdf.addImage(
          sliceCanvas.toDataURL('image/jpeg', 0.95),
          'JPEG',
          pageMarginX,
          cursorY,
          contentWidth,
          sliceHeightMm
        );

        cursorY += sliceHeightMm;
        offsetPx += slicePx;
        remainPx -= slicePx;

        if (remainPx > 0) {
          pdf.addPage();
          cursorY = pageMarginTop;
        }
      }
    };

    for (let i = 0; i < blocks.length; i += 1) {
      const target = blocks[i];
      const forceBreakBefore = target?.dataset?.pdfBreakBefore === '1';
      if (forceBreakBefore && cursorY > pageMarginTop) {
        pdf.addPage();
        cursorY = pageMarginTop;
      }
      // eslint-disable-next-line no-await-in-loop
      const canvas = await html2canvas(target, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });
      const blockHeightMm = (canvas.height * contentWidth) / canvas.width;
      const remainMmInPage = pageBottomY - cursorY;
      // セクション単位で次ページへ送ることで、見出しや表の途中分断を減らす。
      if (cursorY > pageMarginTop && blockHeightMm <= (pageBottomY - pageMarginTop) && blockHeightMm > remainMmInPage) {
        pdf.addPage();
        cursorY = pageMarginTop;
      }
      renderCanvasToPdf(canvas);
    }

    const tenpo = tenpoById.get(norm(tenpoId)) || {};
    const tenpoName = norm(tenpo?.name) || norm(tenpoId) || 'tenpo';
    const fileName = `${safeFilePart(tenpoName)}_${safeFilePart(norm(payload.work_date) || todayYmd())}_清掃報告書.pdf`;
    return { blob: pdf.output('blob'), fileName };
  }, [payload.work_date, tenpoById, tenpoId]);

  const outputPdf = useCallback(async () => {
    setPdfBusy(true);
    setStatus(null);
    try {
      const { blob, fileName } = await buildReportPdfBlob();
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank', 'noopener,noreferrer');
      if (!win) {
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setStatus({ type: 'success', text: 'PDFを出力しました' });
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e) {
      setStatus({ type: 'error', text: e?.message || 'PDF出力に失敗しました' });
    } finally {
      setPdfBusy(false);
    }
  }, [buildReportPdfBlob]);

  const ensureSoukoForTenpo = useCallback(async (targetTenpoId) => {
    const tid = norm(targetTenpoId);
    if (!tid) throw new Error('souko保存先の店舗が未選択です');
    const checkQs = new URLSearchParams({ limit: '20', jotai: 'yuko', tenpo_id: tid });
    const check = await apiJson(`/master/souko?${checkQs.toString()}`);
    const existing = getItems(check)?.[0] || null;
    if (norm(existing?.souko_id)) return existing;

    const tenpo = tenpoById.get(tid) || {};
    const created = await apiJson('/master/souko', {
      method: 'POST',
      body: {
        tenpo_id: tid,
        name: `${norm(tenpo?.name) || tid} 顧客ストレージ`,
        jotai: 'yuko',
      },
    });
    if (!norm(created?.souko_id)) throw new Error('souko作成に失敗しました');
    return created;
  }, [apiJson, tenpoById]);

  const savePdfToSouko = useCallback(async ({ reportId = '' } = {}) => {
    const tid = norm(tenpoId);
    if (!tid) throw new Error('souko保存先店舗を選択してください');
    const { blob, fileName } = await buildReportPdfBlob();
    const souko = await ensureSoukoForTenpo(tid);
    const presign = await apiJson('/master/souko', {
      method: 'POST',
      body: {
        mode: 'presign_upload',
        tenpo_id: tid,
        file_name: fileName,
        content_type: 'application/pdf',
      },
    });
    if (!presign?.put_url || !presign?.key) throw new Error('soukoアップロードURL取得に失敗しました');

    const putRes = await fetch(String(presign.put_url), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf' },
      body: blob,
      redirect: 'follow',
    });
    if (!putRes.ok) {
      const text = await putRes.text().catch(() => '');
      throw new Error(`S3 upload failed (${putRes.status}) ${text}`.trim());
    }

    const nextFiles = [
      ...(Array.isArray(souko?.files) ? souko.files : []),
      {
        key: presign.key,
        file_name: fileName,
        content_type: 'application/pdf',
        size: blob.size || 0,
        uploaded_at: nowIso(),
        kubun: 'teishutsu',
        doc_category: 'cleaning_houkoku',
        preview_url: String(presign?.get_url || ''),
        report_id: norm(reportId),
      },
    ];

    await apiJson(`/master/souko/${encodeURIComponent(souko.souko_id)}`, {
      method: 'PUT',
      body: {
        ...souko,
        files: nextFiles,
      },
    });
    return { soukoId: souko.souko_id, key: presign.key, fileName };
  }, [apiJson, buildReportPdfBlob, ensureSoukoForTenpo, tenpoId]);

  const submit = useCallback(async () => {
    if (!template) return;
    setSaving(true);
    setStatus(null);
    try {
      const tid = norm(tenpoId);
      if (!tid) throw new Error('souko保存先の店舗を選択してください');

      // Validation: at least one service photo is required.
      const errs = validateTemplatePayload(editorTemplate, payload);
      if (errs.length || reportPhotos.length <= 0) {
        throw new Error('作業写真を1枚以上アップロードしてください。');
      }

      const workDate = String(payload.work_date || todayYmd());
      const userName = String(primaryCleanerName || payload.user_name || user?.name || '').trim() || '不明';
      const selectedServiceIds = (serviceIds || []).map((sid) => norm(sid)).filter(Boolean);
      const selectedCleanerIds = (cleanerIds || []).map((cid) => norm(cid)).filter(Boolean);
      const headers = authHeaders();
      const submitRes = await apiFetchWorkReport('/houkoku', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          template_id: TEMPLATE_ID,
          work_date: workDate,
          user_name: userName,
          state: 'submitted',
          target_label: selectedTenpoLabel || norm(tenpoById.get(tid)?.name) || tid,
          worker_id: selectedCleanerIds[0] || '',
          worker_ids: selectedCleanerIds,
          service_ids: selectedServiceIds,
          service_names: selectedServiceNames,
          tenpo_id: tid,
          context: {
            tenpo_id: tid,
            tenpo_label: selectedTenpoLabel || norm(tenpoById.get(tid)?.name) || tid,
            cleaner_id: selectedCleanerIds[0] || '',
            cleaner_ids: selectedCleanerIds,
            cleaner_name: userName,
            cleaner_names: cleanerNames,
            service_ids: selectedServiceIds,
            service_names: selectedServiceNames,
          },
          payload,
        }),
      });
      const reportId = norm(submitRes?.report_id || submitRes?.id || submitRes?.houkoku_id || submitRes?.work_report_id);
      setSoukoBusy(true);
      const saved = await savePdfToSouko({ reportId });
      const tenpoName = norm(tenpoById.get(tid)?.name) || tid;
      setStatus({
        type: 'success',
        text: `提出してsoukoへ保存しました（${tenpoName} / ${saved.fileName}）`,
      });
    } catch (e) {
      console.error(e);
      setStatus({ type: 'error', text: e?.message || '提出に失敗しました' });
    } finally {
      setSoukoBusy(false);
      setSaving(false);
    }
  }, [authHeaders, cleanerIds, cleanerNames, primaryCleanerName, editorTemplate, payload, reportPhotos.length, savePdfToSouko, selectedServiceNames, selectedTenpoLabel, serviceIds, tenpoById, tenpoId, user?.name]);

  const renderPhotoBucket = useCallback((serviceId, serviceName, bucketKey, bucketLabel, photos) => (
    <PhotoBucket
      key={`${serviceId}-${bucketKey}`}
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onPhotoDrop(serviceId, bucketKey);
      }}
    >
      <div className="bucket-head">
        <strong>{serviceName} / {bucketLabel}</strong>
        <span>{photos.length}枚</span>
      </div>
      <PhotoGrid className="bucket-grid">
        {photos.map((att, idx) => (
          <PhotoItem
            key={`${serviceId}-${bucketKey}-${att?.key || att?.url || 'photo'}-${idx}`}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', `${serviceId}:${bucketKey}:${idx}`);
              setDraggingPhoto({ type: 'service', serviceId, bucket: bucketKey, index: idx });
            }}
            onDragEnd={() => setDraggingPhoto(null)}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPhotoDrop(serviceId, bucketKey, idx);
            }}
          >
            <div className="thumb">
              {isImageAttachment(att) ? (
                <img src={resolvePhotoSrc(att)} alt={String(att?.name || `${serviceName}${bucketLabel}${idx + 1}`)} />
              ) : (
                <div className="not-image">画像プレビュー不可</div>
              )}
            </div>
            <div className="meta">
              <span>{bucketLabel} / {getPhotoIdentity(att)}</span>
              <button type="button" onClick={() => removeReportPhoto(serviceId, bucketKey, idx)}>削除</button>
            </div>
          </PhotoItem>
        ))}
        {!photos.length ? (
          <div className="empty">{bucketLabel}写真をここへドラッグ&ドロップ</div>
        ) : null}
      </PhotoGrid>
    </PhotoBucket>
  ), [onPhotoDrop, removeReportPhoto]);

  if (authLoading) return <Wrap>読み込み中...</Wrap>;
    if (!isAuthenticated) {
      return (
        <Wrap>
          <Card>
          <h1>企業向け清掃レポート 作成</h1>
          <p>ログインが必要です。</p>
          <button type="button" onClick={login}>Portalへ</button>
        </Card>
      </Wrap>
    );
  }

  return (
    <Wrap data-job="cleaning">
      {status ? (
        <Toast $type={status.type}>
          {status.text}
        </Toast>
      ) : null}

      <MasterPickCard aria-label="清掃業務報告 必要選択">
        <MasterPickHead>
          <div className="t">清掃業務報告 必要選択</div>
          <div className="sub">サービス / 店舗情報 / 清掃員を選択してください（統合検索対応）</div>
        </MasterPickHead>
        <PickGrid>
          <PickCell>
            <div className="h">統合検索</div>
            <MasterSearch
              type="text"
              value={masterQuery}
              onChange={(e) => setMasterQuery(String(e.target.value || ''))}
              placeholder="統合検索: 店舗名 / 屋号 / 取引先 / サービス / 清掃員"
            />
            {searchCandidates ? (
              <UnifiedSearchCandidates aria-label="統合検索結果">
                <section>
                  <h4>店舗候補</h4>
                  <div className="chips">
                    {searchCandidates.tenpo.length ? searchCandidates.tenpo.map((row) => {
                      const id = norm(row?.tenpo_id);
                      const label = [norm(row?.torihikisaki_name), norm(row?.yagou_name), norm(row?.name) || id]
                        .filter(Boolean)
                        .join(' / ');
                      const active = norm(tenpoId) === id;
                      return (
                        <button
                          key={`cand-tenpo-${id}`}
                          type="button"
                          className={active ? 'active' : ''}
                          onClick={() => setTenpoId(id)}
                          title={label || id}
                        >
                          {label || id}
                        </button>
                      );
                    }) : <div className="empty">候補なし</div>}
                  </div>
                </section>
                <section>
                  <h4>清掃員候補</h4>
                  <div className="chips">
                    {searchCandidates.cleaner.length ? searchCandidates.cleaner.map((row) => {
                      const id = norm(row?.jinzai_id);
                      const label = norm(row?.name) || id;
                      const active = cleanerIds.includes(id);
                      return (
                        <button
                          key={`cand-cleaner-${id}`}
                          type="button"
                          className={active ? 'active' : ''}
                          onClick={() => toggleCleaner(id)}
                          title={label || id}
                        >
                          {label || id}
                        </button>
                      );
                    }) : <div className="empty">候補なし</div>}
                  </div>
                </section>
                <section>
                  <h4>サービス候補</h4>
                  <div className="chips">
                    {searchCandidates.service.length ? searchCandidates.service.map((row) => {
                      const sid = norm(row?.service_id);
                      const label = [norm(row?.name) || sid, getServiceCategoryLabel(row?.category)].filter(Boolean).join(' / ');
                      const active = serviceIds.includes(sid);
                      return (
                        <button
                          key={`cand-service-${sid}`}
                          type="button"
                          className={active ? 'active' : ''}
                          onClick={() => toggleService(sid)}
                          title={label || sid}
                        >
                          {label || sid}
                        </button>
                      );
                    }) : <div className="empty">候補なし</div>}
                  </div>
                </section>
              </UnifiedSearchCandidates>
            ) : null}

            <div className="h">店舗情報（souko保存先）</div>
            <TenpoSelect
              value={tenpoId}
              onChange={(e) => setTenpoId(String(e.target.value || ''))}
            >
              <option value="">店舗を選択してください（souko保存先）</option>
              {tenpoSelectRows.map((row) => {
                const id = norm(row?.tenpo_id);
                const label = [
                  norm(row?.torihikisaki_name),
                  norm(row?.yagou_name),
                  norm(row?.name) || id,
                ].filter(Boolean).join(' / ');
                return (
                  <option key={id} value={id}>
                    {label || id}
                  </option>
                );
              })}
            </TenpoSelect>
            <div style={{ marginTop: 10 }}>
              <div className="h">サービス選択</div>
              <ServicePickHeader>
                <ServicePickerOpenBtn
                  type="button"
                  onClick={() => {
                    if (!norm(serviceQuery) && norm(masterQuery)) setServiceQuery(norm(masterQuery));
                    setServicePickerOpen(true);
                  }}
                >
                  サービスを選択
                </ServicePickerOpenBtn>
                {specialAddService ? (
                  <ServiceExtraBtn
                    type="button"
                    className={isSpecialAddServiceSelected ? 'active' : ''}
                    onClick={() => toggleService(SPECIAL_ADD_SERVICE_ID)}
                    title={isSpecialAddServiceSelected ? `${SPECIAL_ADD_SERVICE_LABEL}を解除` : `${SPECIAL_ADD_SERVICE_LABEL}を選択`}
                  >
                    {SPECIAL_ADD_SERVICE_LABEL}
                  </ServiceExtraBtn>
                ) : null}
                <ServiceTagFrame aria-label="選択済みサービス">
                  <ServiceTags>
                    {selectedServicesForTag.length ? selectedServicesForTag.map((svc) => {
                      const sid = norm(svc?.service_id);
                      const label = [norm(svc?.name) || sid, getServiceCategoryLabel(svc?.category)].filter(Boolean).join(' / ');
                      return (
                        <button type="button" key={sid} onClick={() => removeService(sid)} title="選択解除">
                          {label}
                          <span>×</span>
                        </button>
                      );
                    }) : (
                      <div className="empty">{isSpecialAddServiceSelected ? `${SPECIAL_ADD_SERVICE_LABEL}のみ選択中` : 'サービス未選択'}</div>
                    )}
                  </ServiceTags>
                </ServiceTagFrame>
              </ServicePickHeader>
            </div>
          </PickCell>
          <PickCell>
            <div className="h">清掃員（複数選択）</div>
            <CleanerChecklist aria-label="清掃員選択リスト">
              {visibleCleanerRows.map((row) => {
                const id = norm(row?.jinzai_id);
                const label = norm(row?.name) || id;
                const checked = cleanerIds.includes(id);
                return (
                  <label key={id}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCleaner(id)}
                    />
                    <span>{label || id}</span>
                  </label>
                );
              })}
              {!visibleCleanerRows.length ? (
                <div className="empty">清掃員候補がありません</div>
              ) : null}
            </CleanerChecklist>
          </PickCell>
        </PickGrid>

        <WorkMetaGrid>
          <label>
            <span>作業日</span>
            <input
              type="date"
              value={norm(payload.work_date)}
              onChange={(e) => onMetaChange('work_date', String(e.target.value || ''))}
            />
          </label>
          <label>
            <span>作業開始</span>
            <input
              type="time"
              value={norm(payload.work_start_time)}
              onChange={(e) => onMetaChange('work_start_time', String(e.target.value || ''))}
            />
          </label>
          <label>
            <span>作業終了</span>
            <input
              type="time"
              value={norm(payload.work_end_time)}
              onChange={(e) => onMetaChange('work_end_time', String(e.target.value || ''))}
            />
          </label>
          <div className="mins">
            総作業時間: {typeof totalWorkMinutes === 'number' ? `${totalWorkMinutes} 分` : '-'}
          </div>
          <label>
            <span>作業区分</span>
            <select
              value={norm(payload.work_type) || '定期清掃'}
              onChange={(e) => onMetaChange('work_type', String(e.target.value || '定期清掃'))}
            >
              {WORK_TYPE_OPTIONS.map((it) => (
                <option key={it} value={it}>{it}</option>
              ))}
            </select>
          </label>
        </WorkMetaGrid>
      </MasterPickCard>

      <WorkDetailCard aria-label="作業内容詳細">
        <PhotoHead>
          <div className="t">作業内容詳細</div>
          <div className="sub">写真に載せきれない実施内容や補足を記録します。</div>
        </PhotoHead>
        <WorkDetailField>
          <textarea
            value={String(payload.work_detail || '')}
            onChange={(e) => onMetaChange('work_detail', String(e.target.value || '').slice(0, 1200))}
            placeholder="作業内容の補足（重点箇所・実施内容・注意点など）"
          />
          <div className="meta">{String(payload.work_detail || '').length} / 1200</div>
        </WorkDetailField>
      </WorkDetailCard>

      <ReportPhotoCard aria-label="作業写真">
        <PhotoHead>
          <div className="t">作業写真（任意枚数）</div>
          <div className="sub">左の共通画像プールへアップロードし、各サービスの写真枠へドラッグ&ドロップで振り分けてください。</div>
        </PhotoHead>
        <PhotoActions>
          <button type="button" disabled={photoBusy} onClick={() => reportPhotosInputRef.current?.click()}>
            {photoBusy ? 'アップロード中...' : '共通画像プールへ追加'}
          </button>
          <span>割当済み {reportPhotos.length}枚 / プール {reportPhotoPool.length}枚</span>
        </PhotoActions>
        <input
          ref={reportPhotosInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            const files = e.target.files;
            if (files?.length) addPoolPhotos(files);
            e.target.value = '';
          }}
        />
        <PhotoWorkbench>
          <PhotoPoolPanel
            onDragOver={(e) => {
              e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              onPoolDrop();
            }}
          >
            <PhotoPoolHead>
              <strong>共通画像プール</strong>
              <span>{reportPhotoPool.length}枚</span>
            </PhotoPoolHead>
            <PhotoPoolHint>ここに置いた写真を、各サービスの写真枠へ移動して使います（重複しません）。</PhotoPoolHint>
            <PhotoGrid className="pool-grid">
              {reportPhotoPool.map((att, idx) => (
                <PhotoItem
                  className="pool-item"
                  key={`pool-${att?.key || att?.url || 'photo'}-${idx}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', `pool:${idx}`);
                    setDraggingPhoto({ type: 'pool', index: idx });
                  }}
                  onDragEnd={() => setDraggingPhoto(null)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onPoolDrop(idx);
                  }}
                >
                  <div className="thumb">
                    {isImageAttachment(att) ? (
                      <img src={resolvePhotoSrc(att)} alt={String(att?.name || `pool${idx + 1}`)} />
                    ) : (
                      <div className="not-image">画像プレビュー不可</div>
                    )}
                  </div>
                  <div className="meta">
                    <span>{getPhotoIdentity(att)}</span>
                    <button type="button" onClick={() => removePoolPhoto(idx)}>削除</button>
                  </div>
                </PhotoItem>
              ))}
              {!reportPhotoPool.length ? (
                <div className="empty">共通画像プールは空です。まず写真を追加してください。</div>
              ) : null}
            </PhotoGrid>
          </PhotoPoolPanel>

          <ServicePhotoSections>
            {selectedServices.length ? (
              (() => {
                const activeService = selectedServices.find((svc) => norm(svc?.service_id) === norm(activeServiceTab))
                  || selectedServices[0];
                const sid = norm(activeService?.service_id);
                const serviceName = getServiceDisplayName(activeService || sid);
                const buckets = reportPhotoByService[sid] || emptyServicePhotoBuckets();
                const singleWorkMode = isSingleWorkPhotoService(activeService);
                const activeWorkPhotos = coerceArray(buckets.work);
                return (
                  <>
                    <ServiceTabs role="tablist" aria-label="サービス写真タブ">
                      {selectedServices.map((svc) => {
                        const tabId = norm(svc?.service_id);
                        const tabName = getServiceDisplayName(svc || tabId);
                        const tabBuckets = reportPhotoByService[tabId] || emptyServicePhotoBuckets();
                        const tabSingleWorkMode = isSingleWorkPhotoService(svc);
                        const count = tabSingleWorkMode
                          ? coerceArray(tabBuckets.work).length
                          : coerceArray(tabBuckets.before).length + coerceArray(tabBuckets.after).length + coerceArray(tabBuckets.work).length;
                        const active = tabId === sid;
                        return (
                          <button
                            key={`svc-tab-${tabId}`}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            className={active ? 'active' : ''}
                            onClick={() => setActiveServiceTab(tabId)}
                          >
                            <span className="nm">{tabName}</span>
                            <span className="cnt">{count}枚</span>
                          </button>
                        );
                      })}
                    </ServiceTabs>
                    <ServicePhotoSection key={`svc-photo-${sid}`}>
                      <ServicePhotoHead>
                        <strong>{serviceName}</strong>
                        <span>
                          {singleWorkMode
                            ? activeWorkPhotos.length
                            : coerceArray(buckets.before).length + coerceArray(buckets.after).length + coerceArray(buckets.work).length}
                          枚
                        </span>
                      </ServicePhotoHead>
                      <ServiceCommentBox>
                        <label htmlFor={`service-comment-${sid}`}>作業詳細コメント</label>
                        <textarea
                          id={`service-comment-${sid}`}
                          value={String(servicePhotoComments?.[sid] || '')}
                          onChange={(e) => onServiceCommentChange(sid, e.target.value)}
                          placeholder={`${serviceName} の作業内容（重点箇所・実施内容など）`}
                        />
                      </ServiceCommentBox>
                      <PhotoBuckets>
                        {singleWorkMode ? (
                          renderPhotoBucket(sid, serviceName, 'work', '作業写真', activeWorkPhotos)
                        ) : (
                          <>
                            {renderPhotoBucket(sid, serviceName, 'before', 'ビフォア', coerceArray(buckets.before))}
                            {renderPhotoBucket(sid, serviceName, 'after', 'アフター', coerceArray(buckets.after))}
                          </>
                        )}
                      </PhotoBuckets>
                    </ServicePhotoSection>
                  </>
                );
              })()
            ) : (
              <div className="empty">先にサービスを選択すると、作業写真エリアが自動表示されます。</div>
            )}
          </ServicePhotoSections>
        </PhotoWorkbench>
      </ReportPhotoCard>

      <SupplementCard aria-label="補助資料">
        <PhotoHead>
          <div className="t">補助資料（任意ファイル）</div>
          <div className="sub">PDF・Excel・Word・画像などを添付できます。</div>
        </PhotoHead>
        <PhotoActions>
          <button
            type="button"
            onClick={() => supplementFilesInputRef.current?.click()}
            disabled={photoBusy}
          >
            {photoBusy ? 'アップロード中...' : 'ファイルを追加'}
          </button>
          <span>{supplementFiles.length}件</span>
        </PhotoActions>
        <input
          ref={supplementFilesInputRef}
          type="file"
          multiple
          accept=".pdf,.xlsx,.xls,.doc,.docx,.txt,.csv,.zip,.png,.jpg,.jpeg,.webp,.heic,.heif"
          style={{ display: 'none' }}
          onChange={(e) => {
            const files = e.target.files;
            if (files?.length) addSupplementFiles(files);
            e.target.value = '';
          }}
        />
        <SupplementList>
          {supplementFiles.map((att, idx) => {
            const name = norm(att?.name) || norm(att?.file_name) || `補助資料${idx + 1}`;
            const sizeKb = Number(att?.size || 0) > 0 ? `${Math.ceil(Number(att?.size || 0) / 1024)}KB` : '-';
            return (
              <li key={`${att?.key || att?.url || 'supp'}-${idx}`}>
                <div className="meta">
                  <div className="name">{name}</div>
                  <div className="sub">{sizeKb}</div>
                </div>
                <button type="button" onClick={() => removeSupplementFile(idx)}>削除</button>
              </li>
            );
          })}
          {!supplementFiles.length ? (
            <li className="empty">補助資料は未追加です</li>
          ) : null}
        </SupplementList>
      </SupplementCard>

      <TemplateRenderer
        template={editorTemplate}
        hideHeader
        suppressEditGlow
        editMaxWidth="1480px"
        payload={payload}
        report={{
          user_name: primaryCleanerName || user?.name || payload.user_name || '',
          work_date: payload.work_date || todayYmd(),
          target_label: selectedTenpoLabel || norm(tenpoById.get(norm(tenpoId))?.name) || norm(tenpoId) || '',
        }}
        onChange={onMetaChange}
        onFileUpload={onFileUpload}
        onFileRemove={onFileRemove}
        mode="edit"
        footer={(
          <FooterBar>
            <Progress>
              <span className="k">写真</span>
              <span className="v">{reportPhotos.length}枚</span>
            </Progress>
            <Progress>
              <span className="k">割当済み</span>
              <span className="v">{reportPhotosAssignedCount}枚</span>
            </Progress>
            <Progress>
              <span className="k">補助資料</span>
              <span className="v">{supplementFiles.length}件</span>
            </Progress>
            <FooterActions>
              <SubBtn type="button" disabled={pdfBusy || saving || soukoBusy} onClick={() => setPreviewOpen(true)}>
                プレビュー
              </SubBtn>
              <SubBtn type="button" disabled={pdfBusy || saving || soukoBusy} onClick={outputPdf}>
                {pdfBusy ? 'PDF生成中...' : 'PDF出力'}
              </SubBtn>
              <SubmitBtn type="button" disabled={!canSubmit} onClick={submit}>
                {(saving || soukoBusy) ? '保存中...' : '提出＋souko保存'}
              </SubmitBtn>
            </FooterActions>
          </FooterBar>
        )}
      />

      {/* PDF生成用のA4キャンバス（画面外描画） */}
      <PrintHost aria-hidden>
        <PrintSheet ref={printRef}>
          <ReportPaper>
            <ReportTop data-pdf-block="1">
              <div className="meta-row">
                <div className="left-pane">
                  <div className="title-main">
                    作業報告書<span>（作業記録書・作業完了チェック表）</span>
                  </div>
                  <div className="recipient">{recipientName} 様</div>
                  <ReportLead>
                    平素より大変お世話になっております。{'\n'}
                    下記の通り作業を実施いたしましたのでご報告申し上げます。
                  </ReportLead>
                  <ReportPlaceTable>
                    <tbody>
                      <tr>
                        <th>作業店舗名</th>
                        <td>{selectedTenpoWorkLabel || norm(tenpoId) || '-'}</td>
                      </tr>
                      <tr>
                        <th>作業実施場所</th>
                        <td>{norm(selectedTenpo?.address) || '-'}</td>
                      </tr>
                    </tbody>
                  </ReportPlaceTable>
                </div>
                <div className="right-pane">
                  <div className="stamp-grid" aria-label="押印欄">
                    <div className="stamp-cell">①清掃担当印</div>
                    <div className="stamp-cell">②現場責任者印</div>
                    <div className="stamp-cell">③会社印</div>
                  </div>
                  <div className="company">
                    <div className="logo">ミセサポ</div>
                    <div className="name">株式会社ミセサポ</div>
                    <div className="meta">〒103-0025</div>
                    <div className="meta">住所: 東京都中央区日本橋茅場町1-8-1</div>
                    <div className="meta">茅場町一丁目平和ビル7F</div>
                    <div className="meta">電話: 070-3332-3939</div>
                    <div className="meta">メール: info@misesapo.co.jp</div>
                  </div>
                </div>
              </div>
            </ReportTop>

            <ReportTable data-pdf-block="1">
              <tbody>
                <tr>
                  <th>作業実施日</th>
                  <td>{formatYmdJaWithWeekday(norm(payload.work_date) || todayYmd())}</td>
                </tr>
                <tr>
                  <th>作業実施時間</th>
                  <td>
                    作業開始[{norm(payload.work_start_time) || '--:--'}] 〜 作業終了[{norm(payload.work_end_time) || '--:--'}]
                    {' / '}
                    総作業時間[{typeof totalWorkMinutes === 'number' ? `${totalWorkMinutes} 分` : '--'}]
                  </td>
                </tr>
                <tr>
                  <th>作業区分</th>
                  <td>
                    {WORK_TYPE_OPTIONS.map((it) => (
                      <span key={it} className="work-type">{norm(payload.work_type) === it ? '☑' : '☐'} {it}</span>
                    ))}
                  </td>
                </tr>
                <tr>
                  <th>作業員氏名</th>
                  <td>
                    1: {cleanerNames[0] || '-'}　
                    2: {cleanerNames[1] || '-'}　
                    3: {cleanerNames[2] || '-'}　
                    4: {cleanerNames[3] || '-'}
                  </td>
                </tr>
                <tr>
                  <th>作業内容</th>
                  <td>
                    <ServiceChecklistGrid>
                      {selectedServiceGroupsForDoc.length ? selectedServiceGroupsForDoc.map((group) => (
                        <section key={group.category} className="svc-box">
                          <div className="cat">■{group.category}</div>
                          {group.names.map((nm) => (
                            <div key={`${group.category}-${nm}`} className="item">☑ {nm}</div>
                          ))}
                        </section>
                      )) : (
                        <section className="svc-box">
                          <div className="cat">■作業項目</div>
                          <div className="item">☐ 未選択</div>
                        </section>
                      )}
                    </ServiceChecklistGrid>
                  </td>
                </tr>
              </tbody>
            </ReportTable>

            <ReportDetailSection data-pdf-block="1">
              <h3>作業内容詳細</h3>
              <p>{norm(payload.work_detail) || '記載なし'}</p>
            </ReportDetailSection>

            <ReportPhotoSection>
              <h3 data-pdf-block="1" data-pdf-break-before="1">作業写真</h3>
              {reportPhotoDocGroups.length ? reportPhotoDocGroups.map((group) => (
                <div key={group.key} className="service-group" data-pdf-block="1">
                  <div className="service-head">{group.serviceName}</div>
                  {norm(group.comment) ? (
                    <div className="service-comment">
                      <span className="label">作業詳細:</span>
                      <span className="text">{group.comment}</span>
                    </div>
                  ) : null}
                  {group.singleWorkMode ? (
                    <div className="group">
                      <div className="ghead">{group.serviceName} / 作業写真</div>
                      <div className="grid">
                        {group.work.length ? group.work.map((att, idx) => (
                          <div key={`${group.key}-work-${att?.key || att?.url || 'p'}-${idx}`} className="photo">
                            {isImageAttachment(att) ? (
                              <img src={resolvePhotoSrc(att)} alt={String(att?.name || `${group.serviceName}作業写真${idx + 1}`)} />
                            ) : (
                              <div className="na">画像なし</div>
                            )}
                            <div className="cap">作業写真 / {getPhotoIdentity(att)}</div>
                          </div>
                        )) : <div className="empty">なし</div>}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="group">
                        <div className="ghead">{group.serviceName} / ビフォア</div>
                        <div className="grid">
                          {group.before.length ? group.before.map((att, idx) => (
                            <div key={`${group.key}-before-${att?.key || att?.url || 'p'}-${idx}`} className="photo">
                              {isImageAttachment(att) ? (
                                <img src={resolvePhotoSrc(att)} alt={String(att?.name || `${group.serviceName}ビフォア${idx + 1}`)} />
                              ) : (
                                <div className="na">画像なし</div>
                              )}
                              <div className="cap">ビフォア / {getPhotoIdentity(att)}</div>
                            </div>
                          )) : <div className="empty">なし</div>}
                        </div>
                      </div>
                      <div className="group">
                        <div className="ghead">{group.serviceName} / アフター</div>
                        <div className="grid">
                          {group.after.length ? group.after.map((att, idx) => (
                            <div key={`${group.key}-after-${att?.key || att?.url || 'p'}-${idx}`} className="photo">
                              {isImageAttachment(att) ? (
                                <img src={resolvePhotoSrc(att)} alt={String(att?.name || `${group.serviceName}アフター${idx + 1}`)} />
                              ) : (
                                <div className="na">画像なし</div>
                              )}
                              <div className="cap">アフター / {getPhotoIdentity(att)}</div>
                            </div>
                          )) : <div className="empty">なし</div>}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )) : <div className="empty" data-pdf-block="1">写真なし</div>}
            </ReportPhotoSection>

            <ReportSupplementSection data-pdf-block="1">
              <h3>補助資料</h3>
              <ul>
                {supplementFiles.length ? supplementFiles.map((att, idx) => {
                  const name = norm(att?.name) || norm(att?.file_name) || `補助資料${idx + 1}`;
                  return <li key={`${att?.key || att?.url || 'supp'}-${idx}`}>{name}</li>;
                }) : (
                  <li>なし</li>
                )}
              </ul>
            </ReportSupplementSection>
          </ReportPaper>
        </PrintSheet>
      </PrintHost>

      {previewOpen ? (
        <PreviewOverlay role="dialog" aria-modal="true" aria-label="報告書プレビュー">
          <PreviewPanel>
            <PreviewHead>
              <strong>報告書プレビュー</strong>
              <button type="button" onClick={() => setPreviewOpen(false)}>閉じる</button>
            </PreviewHead>
            <PreviewBody>
              <PreviewPaperWrap>
                <PrintSheet>
                  <ReportPaper>
                    <ReportTop>
                      <div className="meta-row">
                        <div className="left-pane">
                          <div className="title-main">
                            作業報告書<span>（作業記録書・作業完了チェック表）</span>
                          </div>
                          <div className="recipient">{recipientName} 様</div>
                          <ReportLead>
                            平素より大変お世話になっております。{'\n'}
                            下記の通り作業を実施いたしましたのでご報告申し上げます。
                          </ReportLead>
                          <ReportPlaceTable>
                            <tbody>
                              <tr>
                                <th>作業店舗名</th>
                                <td>{selectedTenpoWorkLabel || norm(tenpoId) || '-'}</td>
                              </tr>
                              <tr>
                                <th>作業実施場所</th>
                                <td>{norm(selectedTenpo?.address) || '-'}</td>
                              </tr>
                            </tbody>
                          </ReportPlaceTable>
                        </div>
                        <div className="right-pane">
                          <div className="stamp-grid" aria-label="押印欄">
                            <div className="stamp-cell">①清掃担当印</div>
                            <div className="stamp-cell">②現場責任者印</div>
                            <div className="stamp-cell">③会社印</div>
                          </div>
                          <div className="company">
                            <div className="logo">ミセサポ</div>
                            <div className="name">株式会社ミセサポ</div>
                            <div className="meta">〒103-0025</div>
                            <div className="meta">住所: 東京都中央区日本橋茅場町1-8-1</div>
                            <div className="meta">茅場町一丁目平和ビル7F</div>
                            <div className="meta">電話: 070-3332-3939</div>
                            <div className="meta">メール: info@misesapo.co.jp</div>
                          </div>
                        </div>
                      </div>
                    </ReportTop>

                    <ReportTable>
                      <tbody>
                        <tr>
                          <th>作業実施日</th>
                          <td>{formatYmdJaWithWeekday(norm(payload.work_date) || todayYmd())}</td>
                        </tr>
                        <tr>
                          <th>作業実施時間</th>
                          <td>
                            作業開始[{norm(payload.work_start_time) || '--:--'}] 〜 作業終了[{norm(payload.work_end_time) || '--:--'}]
                            {' / '}
                            総作業時間[{typeof totalWorkMinutes === 'number' ? `${totalWorkMinutes} 分` : '--'}]
                          </td>
                        </tr>
                        <tr>
                          <th>作業区分</th>
                          <td>
                            {WORK_TYPE_OPTIONS.map((it) => (
                              <span key={it} className="work-type">{norm(payload.work_type) === it ? '☑' : '☐'} {it}</span>
                            ))}
                          </td>
                        </tr>
                        <tr>
                          <th>作業員氏名</th>
                          <td>
                            1: {cleanerNames[0] || '-'}　
                            2: {cleanerNames[1] || '-'}　
                            3: {cleanerNames[2] || '-'}　
                            4: {cleanerNames[3] || '-'}
                          </td>
                        </tr>
                        <tr>
                          <th>作業内容</th>
                          <td>
                            <ServiceChecklistGrid>
                              {selectedServiceGroupsForDoc.length ? selectedServiceGroupsForDoc.map((group) => (
                                <section key={group.category} className="svc-box">
                                  <div className="cat">■{group.category}</div>
                                  {group.names.map((nm) => (
                                    <div key={`${group.category}-${nm}`} className="item">☑ {nm}</div>
                                  ))}
                                </section>
                              )) : (
                                <section className="svc-box">
                                  <div className="cat">■作業項目</div>
                                  <div className="item">☐ 未選択</div>
                                </section>
                              )}
                            </ServiceChecklistGrid>
                          </td>
                        </tr>
                      </tbody>
                    </ReportTable>

                    <ReportDetailSection>
                      <h3>作業内容詳細</h3>
                      <p>{norm(payload.work_detail) || '記載なし'}</p>
                    </ReportDetailSection>

                    <ReportPhotoSection>
                      <h3>作業写真</h3>
                      {reportPhotoDocGroups.length ? reportPhotoDocGroups.map((group) => (
                        <div key={group.key} className="service-group">
                          <div className="service-head">{group.serviceName}</div>
                          {norm(group.comment) ? (
                            <div className="service-comment">
                              <span className="label">作業詳細:</span>
                              <span className="text">{group.comment}</span>
                            </div>
                          ) : null}
                  {group.singleWorkMode ? (
                    <div className="group">
                      <div className="ghead">{group.serviceName} / 作業写真</div>
                      <div className="grid">
                        {group.work.length ? group.work.map((att, idx) => (
                          <div key={`${group.key}-work-${att?.key || att?.url || 'p'}-${idx}`} className="photo">
                            {isImageAttachment(att) ? (
                              <img src={resolvePhotoSrc(att)} alt={String(att?.name || `${group.serviceName}作業写真${idx + 1}`)} />
                            ) : (
                              <div className="na">画像なし</div>
                            )}
                            <div className="cap">作業写真 / {getPhotoIdentity(att)}</div>
                          </div>
                        )) : <div className="empty">なし</div>}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="group">
                        <div className="ghead">{group.serviceName} / ビフォア</div>
                        <div className="grid">
                          {group.before.length ? group.before.map((att, idx) => (
                            <div key={`${group.key}-before-${att?.key || att?.url || 'p'}-${idx}`} className="photo">
                              {isImageAttachment(att) ? (
                                <img src={resolvePhotoSrc(att)} alt={String(att?.name || `${group.serviceName}ビフォア${idx + 1}`)} />
                              ) : (
                                <div className="na">画像なし</div>
                              )}
                              <div className="cap">ビフォア / {getPhotoIdentity(att)}</div>
                            </div>
                          )) : <div className="empty">なし</div>}
                        </div>
                      </div>
                      <div className="group">
                        <div className="ghead">{group.serviceName} / アフター</div>
                        <div className="grid">
                          {group.after.length ? group.after.map((att, idx) => (
                            <div key={`${group.key}-after-${att?.key || att?.url || 'p'}-${idx}`} className="photo">
                              {isImageAttachment(att) ? (
                                <img src={resolvePhotoSrc(att)} alt={String(att?.name || `${group.serviceName}アフター${idx + 1}`)} />
                              ) : (
                                <div className="na">画像なし</div>
                              )}
                              <div className="cap">アフター / {getPhotoIdentity(att)}</div>
                            </div>
                          )) : <div className="empty">なし</div>}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )) : <div className="empty">写真なし</div>}
            </ReportPhotoSection>

                    <ReportSupplementSection>
                      <h3>補助資料</h3>
                      <ul>
                        {supplementFiles.length ? supplementFiles.map((att, idx) => {
                          const name = norm(att?.name) || norm(att?.file_name) || `補助資料${idx + 1}`;
                          return <li key={`${att?.key || att?.url || 'supp'}-${idx}`}>{name}</li>;
                        }) : (
                          <li>なし</li>
                        )}
                      </ul>
                    </ReportSupplementSection>
                  </ReportPaper>
                </PrintSheet>
              </PreviewPaperWrap>
            </PreviewBody>
          </PreviewPanel>
        </PreviewOverlay>
      ) : null}

      {servicePickerOpen ? (
        <ServiceOverlay role="dialog" aria-modal="true" aria-label="サービス選択" onClick={() => setServicePickerOpen(false)}>
          <ServiceOverlayPanel onClick={(e) => e.stopPropagation()}>
            <ServiceOverlayHead>
              <strong>サービス選択</strong>
              <button type="button" onClick={() => setServicePickerOpen(false)}>閉じる</button>
            </ServiceOverlayHead>
            <ServiceOverlaySearch
              type="text"
              value={serviceQuery}
              onChange={(e) => setServiceQuery(String(e.target.value || ''))}
              placeholder="サービス名 / ID / カテゴリで検索"
            />
            <ServiceOverlayCount>
              候補 {visibleServiceRows.length} 件 / 選択 {selectedOverlayServiceCount} 件
            </ServiceOverlayCount>
            <ServiceOverlayList>
              {visibleServiceGroups.map((group) => (
                <section key={group.category} className="svc-group">
                  <div className="svc-group-head">
                    <strong>{group.category}</strong>
                    <span>{group.items.length}件</span>
                  </div>
                  <div className="svc-group-grid">
                    {group.items.map((row) => {
                      const sid = norm(row?.service_id);
                      const checked = serviceIds.includes(sid);
                      return (
                        <label key={sid} className={checked ? 'checked' : ''}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleService(sid)}
                          />
                          <div className="nm">{norm(row?.name) || sid}</div>
                          <div className="meta">{sid}</div>
                        </label>
                      );
                    })}
                  </div>
                </section>
              ))}
              {!visibleServiceGroups.length ? (
                <div className="empty">候補がありません。サービスマスタを確認してください。</div>
              ) : null}
            </ServiceOverlayList>
            <ServiceOverlayFoot>
              <button type="button" onClick={() => setServicePickerOpen(false)}>選択を反映して閉じる</button>
            </ServiceOverlayFoot>
          </ServiceOverlayPanel>
        </ServiceOverlay>
      ) : null}
    </Wrap>
  );
}

const Wrap = styled.div`
  --ch-bg: #0b1220;
  --ch-text: #e9eefc;
  --ch-sub: rgba(233, 238, 252, 0.72);
  --ch-border: rgba(255, 255, 255, 0.12);
  --ch-card-bg: rgba(15, 23, 42, 0.55);
  --ch-card-bg-strong: rgba(15, 23, 42, 0.75);
  --ch-input-bg: rgba(255, 255, 255, 0.04);
  --ch-input-border: rgba(255, 255, 255, 0.12);
  --ch-input-text: rgba(233, 238, 252, 0.96);
  --ch-list-bg: rgba(255, 255, 255, 0.02);
  --ch-hover-bg: rgba(255, 255, 255, 0.06);
  --ch-selected-bg: rgba(16, 185, 129, 0.14);
  --ch-primary-btn-bg: rgba(37, 99, 235, 0.92);
  --ch-sub-btn-bg: rgba(59, 130, 246, 0.22);
  --ch-sub-btn-text: rgba(233, 238, 252, 0.95);
  --ch-submit-btn-bg: rgba(16, 185, 129, 0.95);
  --ch-submit-btn-text: #081a12;
  --ch-danger-bg: rgba(239, 68, 68, 0.18);
  --ch-preview-panel-bg: rgba(11, 13, 18, 0.96);
  --ch-overlay-bg: rgba(0, 0, 0, 0.55);
  --ch-toast-text: #e9eefc;

  [data-theme="light"] & {
    --ch-bg: #f3f7ff;
    --ch-text: #10233f;
    --ch-sub: rgba(16, 35, 63, 0.68);
    --ch-border: rgba(15, 40, 80, 0.18);
    --ch-card-bg: rgba(255, 255, 255, 0.96);
    --ch-card-bg-strong: rgba(255, 255, 255, 0.98);
    --ch-input-bg: #ffffff;
    --ch-input-border: rgba(19, 57, 112, 0.22);
    --ch-input-text: #0f2442;
    --ch-list-bg: rgba(16, 43, 82, 0.04);
    --ch-hover-bg: rgba(24, 86, 172, 0.10);
    --ch-selected-bg: rgba(16, 185, 129, 0.18);
    --ch-primary-btn-bg: #2f67d8;
    --ch-sub-btn-bg: rgba(47, 103, 216, 0.16);
    --ch-sub-btn-text: #12325c;
    --ch-submit-btn-bg: #16a34a;
    --ch-submit-btn-text: #ffffff;
    --ch-danger-bg: rgba(239, 68, 68, 0.14);
    --ch-preview-panel-bg: #f7fbff;
    --ch-overlay-bg: rgba(10, 23, 42, 0.28);
    --ch-toast-text: #10233f;
  }

  min-height: 100vh;
  padding: 18px 12px 80px;
  background: var(--ch-bg);
  color: var(--ch-text);
`;

const Card = styled.div`
  max-width: 520px;
  margin: 60px auto 0;
  padding: 18px;
  border: 1px solid var(--ch-border);
  border-radius: 14px;
  background: var(--ch-card-bg-strong);
  h1 { margin: 0 0 10px; font-size: 18px; }
  p { margin: 0 0 12px; color: var(--ch-sub); }
  button {
    height: 40px;
    border-radius: 10px;
    border: 1px solid var(--ch-border);
    background: var(--ch-primary-btn-bg);
    color: white;
    font-weight: 800;
    padding: 0 14px;
    cursor: pointer;
  }
`;

const MasterPickCard = styled.section`
  max-width: 1480px;
  width: 100%;
  margin: 8px auto 12px;
  padding: 14px;
  border: 1px solid var(--ch-border);
  border-radius: 14px;
  background: var(--ch-card-bg);
`;

const MasterPickHead = styled.div`
  margin-bottom: 8px;
  .t {
    font-size: 13px;
    font-weight: 900;
    color: var(--ch-text);
  }
  .sub {
    margin-top: 4px;
    font-size: 12px;
    color: var(--ch-sub);
  }
`;

const MasterSearch = styled.input`
  width: 100%;
  height: 38px;
  border-radius: 10px;
  border: 1px solid var(--ch-input-border);
  background: var(--ch-input-bg);
  color: var(--ch-input-text);
  padding: 0 10px;
  margin-bottom: 8px;
  outline: none;
`;

const UnifiedSearchCandidates = styled.div`
  margin-bottom: 10px;
  display: grid;
  gap: 8px;
  section {
    border: 1px solid var(--ch-border);
    border-radius: 10px;
    background: var(--ch-list-bg);
    padding: 8px;
  }
  h4 {
    margin: 0 0 6px;
    font-size: 12px;
    font-weight: 900;
    color: var(--ch-text);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chips button {
    border: 1px solid var(--ch-border);
    border-radius: 999px;
    background: var(--ch-input-bg);
    color: var(--ch-input-text);
    padding: 6px 10px;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    max-width: min(100%, 420px);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chips button.active {
    background: var(--ch-selected-bg);
    border-color: rgba(16, 185, 129, 0.5);
  }
  .empty {
    font-size: 11px;
    color: var(--ch-sub);
    padding: 2px 0;
  }
`;

const PickGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const PickCell = styled.div`
  .h {
    margin-bottom: 6px;
    font-size: 12px;
    font-weight: 900;
    color: var(--ch-text);
  }
`;

const ServicePickHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  flex-wrap: wrap;
`;

const ServiceTagFrame = styled.div`
  flex: 1;
  min-width: 240px;
  min-height: 36px;
  border: 1px dashed var(--ch-input-border);
  border-radius: 10px;
  background: var(--ch-input-bg);
  padding: 5px 8px;
`;

const ServicePickerOpenBtn = styled.button`
  height: 34px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid var(--ch-border);
  background: var(--ch-sub-btn-bg);
  color: var(--ch-sub-btn-text);
  font-size: 12px;
  font-weight: 900;
  cursor: pointer;
`;

const ServiceExtraBtn = styled.button`
  height: 34px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid var(--ch-border);
  background: var(--ch-input-bg);
  color: var(--ch-input-text);
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;

  &.active {
    border-color: rgba(16, 185, 129, 0.55);
    background: var(--ch-selected-bg);
    color: var(--ch-text);
  }
`;

const TenpoSelect = styled.select`
  width: 100%;
  min-height: 40px;
  border-radius: 10px;
  border: 1px solid var(--ch-input-border);
  background: var(--ch-input-bg);
  color: var(--ch-input-text);
  padding: 8px 10px;
  outline: none;
`;

const CleanerChecklist = styled.div`
  min-height: 144px;
  max-height: 224px;
  overflow: auto;
  border: 1px solid var(--ch-input-border);
  border-radius: 10px;
  background: var(--ch-input-bg);
  padding: 8px;
  display: grid;
  gap: 6px;

  label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--ch-input-text);
    cursor: pointer;
    padding: 4px 6px;
    border-radius: 8px;
  }

  label:hover {
    background: var(--ch-hover-bg);
  }

  input[type="checkbox"] {
    width: 15px;
    height: 15px;
    accent-color: #16a34a;
    cursor: pointer;
  }

  .empty {
    font-size: 12px;
    color: var(--ch-sub);
    padding: 4px 2px;
  }
`;

const ServiceTags = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  min-height: 22px;

  .empty {
    font-size: 12px;
    color: var(--ch-sub);
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid var(--ch-border);
    background: var(--ch-selected-bg);
    color: var(--ch-text);
    border-radius: 999px;
    padding: 6px 10px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }

  button span {
    font-weight: 900;
    opacity: 0.9;
  }
`;

const FooterBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
`;

const FooterActions = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
`;

const ReportPhotoCard = styled.section`
  max-width: 1480px;
  width: 100%;
  margin: 12px auto;
  padding: 14px;
  border: 1px solid var(--ch-border);
  border-radius: 14px;
  background: var(--ch-card-bg);
`;

const WorkDetailCard = styled(ReportPhotoCard)`
  margin: 0 auto 12px;
`;

const SupplementCard = styled(ReportPhotoCard)`
  margin-top: 0;
`;

const PhotoHead = styled.div`
  .t {
    font-size: 13px;
    font-weight: 900;
    color: var(--ch-text);
  }
  .sub {
    margin-top: 4px;
    font-size: 12px;
    color: var(--ch-sub);
  }
`;

const PhotoActions = styled.div`
  margin-top: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  button {
    height: 36px;
    border-radius: 10px;
    border: 1px solid var(--ch-border);
    background: var(--ch-sub-btn-bg);
    color: var(--ch-sub-btn-text);
    padding: 0 12px;
    font-weight: 800;
    cursor: pointer;
  }
  span {
    font-size: 12px;
    color: var(--ch-sub);
    font-weight: 800;
  }
`;

const WorkDetailField = styled.div`
  margin-top: 10px;
  display: grid;
  gap: 6px;
  textarea {
    min-height: 110px;
    resize: vertical;
    border-radius: 10px;
    border: 1px solid var(--ch-input-border);
    background: var(--ch-input-bg);
    color: var(--ch-input-text);
    padding: 10px 12px;
    font-size: 13px;
    line-height: 1.5;
    outline: none;
  }
  .meta {
    text-align: right;
    font-size: 11px;
    color: var(--ch-sub);
    font-weight: 800;
  }
`;

const PhotoWorkbench = styled.div`
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const PhotoPoolPanel = styled.section`
  border: 1px solid var(--ch-border);
  border-radius: 12px;
  background: var(--ch-list-bg);
  padding: 10px;
  min-height: 300px;
`;

const PhotoPoolHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  strong {
    font-size: 13px;
    font-weight: 900;
    color: var(--ch-text);
  }
  span {
    font-size: 11px;
    color: var(--ch-sub);
    font-weight: 800;
  }
`;

const PhotoPoolHint = styled.p`
  margin: 6px 0 0;
  font-size: 11px;
  line-height: 1.4;
  color: var(--ch-sub);
`;

const PhotoGrid = styled.div`
  margin-top: 10px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  .empty {
    grid-column: 1 / -1;
    font-size: 12px;
    color: var(--ch-sub);
    border: 1px dashed var(--ch-border);
    border-radius: 10px;
    padding: 12px;
    text-align: center;
  }
  &.pool-grid {
    display: flex;
    flex-wrap: nowrap;
    gap: 10px;
    grid-template-columns: none;
    max-height: none;
    overflow: auto;
    padding: 2px 2px 6px;
  }
  &.pool-grid > .pool-item {
    flex: 0 0 220px;
    min-width: 220px;
  }
  @media (max-width: 900px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  @media (max-width: 640px) {
    grid-template-columns: 1fr;
    &.pool-grid {
      display: flex;
      flex-wrap: nowrap;
    }
    &.pool-grid > .pool-item {
      flex-basis: 180px;
      min-width: 180px;
    }
  }
`;

const ServicePhotoSections = styled.div`
  display: grid;
  gap: 10px;
  .empty {
    font-size: 12px;
    color: var(--ch-sub);
    border: 1px dashed var(--ch-border);
    border-radius: 10px;
    padding: 12px;
    text-align: center;
  }
`;

const ServiceTabs = styled.div`
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
  overflow: auto;
  padding-bottom: 2px;
  button {
    flex: 0 0 auto;
    min-width: 200px;
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    border-radius: 10px;
    border: 1px solid var(--ch-border);
    background: var(--ch-list-bg);
    color: var(--ch-text);
    padding: 8px 10px;
    cursor: pointer;
  }
  button.active {
    background: var(--ch-selected-bg);
    border-color: rgba(16, 185, 129, 0.5);
  }
  .nm {
    font-size: 12px;
    font-weight: 800;
    text-align: left;
  }
  .cnt {
    font-size: 11px;
    color: var(--ch-sub);
    font-weight: 800;
    white-space: nowrap;
  }
`;

const ServicePhotoSection = styled.section`
  border: 1px solid var(--ch-border);
  border-radius: 12px;
  background: var(--ch-list-bg);
  padding: 10px;
`;

const ServicePhotoHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  strong {
    font-size: 13px;
    font-weight: 900;
    color: var(--ch-text);
  }
  span {
    font-size: 11px;
    color: var(--ch-sub);
    font-weight: 800;
  }
`;

const ServiceCommentBox = styled.div`
  margin-bottom: 8px;
  display: grid;
  gap: 6px;
  label {
    font-size: 11px;
    font-weight: 800;
    color: var(--ch-sub);
  }
  textarea {
    min-height: 66px;
    resize: vertical;
    border-radius: 10px;
    border: 1px solid var(--ch-input-border);
    background: var(--ch-input-bg);
    color: var(--ch-input-text);
    padding: 8px 10px;
    font-size: 12px;
    line-height: 1.4;
    outline: none;
  }
`;

const PhotoBuckets = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  @media (max-width: 860px) {
    grid-template-columns: 1fr;
  }
`;

const PhotoBucket = styled.section`
  border: 1px dashed var(--ch-border);
  border-radius: 12px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.01);
  min-height: 240px;
  .bucket-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  }
  .bucket-head strong {
    font-size: 12px;
    font-weight: 900;
    color: var(--ch-text);
  }
  .bucket-head span {
    font-size: 11px;
    color: var(--ch-sub);
    font-weight: 800;
  }
  .bucket-grid {
    margin-top: 0;
    grid-template-columns: 1fr;
    max-height: 420px;
    overflow: auto;
    padding-right: 2px;
  }
  .bucket-grid .empty {
    padding: 16px 10px;
  }
`;

const PhotoItem = styled.div`
  border: 1px solid var(--ch-border);
  border-radius: 10px;
  background: var(--ch-list-bg);
  overflow: hidden;
  cursor: grab;
  &:active {
    cursor: grabbing;
  }
  .thumb {
    aspect-ratio: 4 / 3;
    background: rgba(15, 23, 42, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .not-image {
    font-size: 11px;
    color: var(--ch-sub);
  }
  .meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 8px;
  }
  .meta span {
    font-size: 12px;
    color: var(--ch-text);
    font-weight: 800;
  }
  .meta button {
    border: 1px solid var(--ch-border);
    background: var(--ch-danger-bg);
    color: var(--ch-text);
    border-radius: 8px;
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 800;
    cursor: pointer;
  }
`;

const SupplementList = styled.ul`
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 8px;
  li {
    border: 1px solid var(--ch-border);
    border-radius: 10px;
    background: var(--ch-list-bg);
    padding: 8px 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .meta {
    min-width: 0;
    flex: 1;
  }
  .name {
    font-size: 12px;
    color: var(--ch-text);
    font-weight: 800;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sub {
    margin-top: 2px;
    font-size: 11px;
    color: var(--ch-sub);
  }
  button {
    border: 1px solid var(--ch-border);
    background: var(--ch-danger-bg);
    color: var(--ch-text);
    border-radius: 8px;
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 800;
    cursor: pointer;
    white-space: nowrap;
  }
  .empty {
    font-size: 12px;
    color: var(--ch-sub);
    justify-content: center;
  }
`;

const Progress = styled.div`
  display: inline-flex;
  align-items: baseline;
  gap: 10px;
  .k { font-size: 12px; opacity: 0.8; }
  .v { font-size: 16px; font-weight: 900; }
`;

const SubmitBtn = styled.button`
  height: 44px;
  min-width: 120px;
  border-radius: 14px;
  border: 1px solid var(--ch-border);
  background: var(--ch-submit-btn-bg);
  color: var(--ch-submit-btn-text);
  font-weight: 900;
  cursor: pointer;
  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    background: rgba(148, 163, 184, 0.28);
    color: var(--ch-sub);
  }
`;

const SubBtn = styled.button`
  height: 40px;
  min-width: 100px;
  border-radius: 12px;
  border: 1px solid var(--ch-border);
  background: var(--ch-sub-btn-bg);
  color: var(--ch-sub-btn-text);
  font-weight: 800;
  cursor: pointer;
  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;

const PrintHost = styled.div`
  position: fixed;
  left: -99999px;
  top: -99999px;
  width: 210mm;
  pointer-events: none;
  opacity: 0;
`;

const PrintSheet = styled.div`
  width: 210mm;
  min-height: 297mm;
  background: #fff;
  color: #111;
  padding: 10mm 9mm 9mm;
  box-sizing: border-box;
`;

const ReportPaper = styled.div`
  color: #111;
  font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", sans-serif;
  font-size: 10px;
`;

const ReportTop = styled.div`
  --right-pane-width: 236px;
  display: grid;
  gap: 8px;
  margin-bottom: 10px;

  .left-pane {
    display: grid;
    gap: 8px;
    align-content: start;
  }

  .right-pane {
    display: grid;
    gap: 8px;
    align-content: start;
    width: var(--right-pane-width);
    justify-self: end;
  }

  .title-main {
    text-align: left;
    margin: 0;
    font-size: 18px;
    letter-spacing: 0.02em;
    font-weight: 900;
    line-height: 1.2;
  }
  .title-main span {
    font-size: 11px;
    margin-left: 8px;
    font-weight: 700;
  }

  .meta-row {
    margin-top: 4px;
    display: grid;
    grid-template-columns: 1fr var(--right-pane-width);
    gap: 14px;
    align-items: start;
  }

  .stamp-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    width: 100%;
  }

  .stamp-cell {
    width: auto;
    height: 72px;
    border: 1.5px solid #111;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 4px;
    font-size: 8px;
    line-height: 1.25;
    text-align: center;
    font-weight: 700;
    white-space: normal;
    background: #fff;
  }

  .recipient {
    margin-top: 18px;
    align-self: end;
    min-height: 36px;
    border-bottom: 2px solid #222;
    padding-bottom: 3px;
    text-align: left;
    font-size: 15px;
    font-weight: 800;
  }

  .company {
    align-self: start;
    width: 100%;
    padding-bottom: 8px;
  }

  .company .logo {
    display: block;
    width: 100%;
    box-sizing: border-box;
    background: #ff0a9b;
    color: #fff;
    font-size: 26px;
    line-height: 1;
    font-weight: 900;
    text-align: center;
    padding: 8px 0 7px;
    letter-spacing: 0.04em;
  }
  .company .name {
    margin-top: 7px;
    font-size: 15px;
    font-weight: 900;
    letter-spacing: 0.01em;
  }
  .company .meta {
    margin-top: 2px;
    font-size: 10px;
    line-height: 1.3;
  }

  @media (max-width: 900px) {
    .meta-row {
      grid-template-columns: 1fr;
    }
    .stamp-cell {
      width: 72px;
      min-height: 56px;
      height: auto;
    }
  }
`;

const ReportLead = styled.p`
  margin: 2px 0 6px;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.45;
  white-space: pre-line;
`;

const ReportPlaceTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  border: 2px solid #111;
  margin: 4px 0 8px;
  th, td {
    border: 1px solid #111;
    vertical-align: top;
  }
  th {
    width: 150px;
    font-size: 11px;
    font-weight: 800;
    padding: 6px 8px;
    white-space: nowrap;
    background: #fafafa;
  }
  td {
    padding: 6px 8px;
    font-size: 11px;
    line-height: 1.4;
  }
`;

const ReportTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  border: 2px solid #111;
  th, td {
    border: 1px solid #111;
    vertical-align: top;
  }
  th {
    width: 150px;
    font-size: 11px;
    font-weight: 800;
    padding: 6px 8px;
    white-space: nowrap;
    background: #fafafa;
  }
  td {
    padding: 6px 8px;
    font-size: 11px;
    line-height: 1.4;
  }
  .work-type {
    display: inline-block;
    margin-right: 12px;
  }
`;

const ServiceChecklistGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 16px;
  .svc-box {
    min-height: 80px;
  }
  .cat {
    font-size: 10px;
    font-weight: 900;
    margin-bottom: 4px;
  }
  .item {
    font-size: 10px;
    line-height: 1.4;
  }
`;

const PreviewPaperWrap = styled.div`
  display: flex;
  justify-content: center;
  padding: 8px 0 20px;
  background: transparent;
`;

const ReportDetailSection = styled.section`
  margin-top: 10px;
  border: 1px solid #111;
  padding: 7px 9px;
  h3 {
    margin: 0 0 4px;
    font-size: 11px;
    font-weight: 900;
  }
  p {
    margin: 0;
    font-size: 10px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
  }
`;

const ReportPhotoSection = styled.section`
  margin-top: 10px;
  h3 {
    margin: 0 0 6px;
    font-size: 11px;
    font-weight: 900;
  }
  .service-group {
    margin-top: 8px;
  }
  .service-head {
    font-size: 10px;
    font-weight: 900;
    margin-bottom: 4px;
  }
  .service-comment {
    margin-bottom: 5px;
    font-size: 9px;
    line-height: 1.4;
    .label {
      font-weight: 900;
      margin-right: 4px;
    }
    .text {
      white-space: pre-wrap;
    }
  }
  .group {
    margin-top: 4px;
  }
  .ghead {
    font-size: 10px;
    font-weight: 900;
    margin-bottom: 3px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }
  .empty {
    grid-column: 1 / -1;
    border: 1px dashed #777;
    padding: 6px;
    text-align: center;
    font-size: 9px;
    color: #666;
  }
  .photo {
    border: 1px solid #111;
    background: #fff;
    padding: 4px;
  }
  .photo img {
    width: 100%;
    height: 48mm;
    object-fit: cover;
    display: block;
  }
  .photo .na {
    height: 48mm;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    color: #666;
    background: #f5f5f5;
  }
  .photo .cap {
    margin-top: 2px;
    font-size: 9px;
    text-align: center;
  }
`;

const ReportSupplementSection = styled.section`
  margin-top: 8px;
  h3 {
    margin: 0 0 4px;
    font-size: 11px;
    font-weight: 900;
  }
  ul {
    margin: 0;
    padding-left: 18px;
  }
  li {
    font-size: 9px;
    line-height: 1.4;
  }
`;

const PreviewOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 22000;
  background: var(--ch-overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
`;

const PreviewPanel = styled.div`
  width: min(1100px, 96vw);
  max-height: 92vh;
  border-radius: 14px;
  border: 1px solid var(--ch-border);
  background: var(--ch-preview-panel-bg);
  overflow: hidden;
  display: grid;
  grid-template-rows: auto 1fr;
`;

const PreviewHead = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--ch-border);
  strong {
    font-size: 14px;
    color: var(--ch-text);
  }
  button {
    height: 34px;
    border-radius: 8px;
    border: 1px solid var(--ch-border);
    background: var(--ch-sub-btn-bg);
    color: var(--ch-sub-btn-text);
    padding: 0 10px;
    cursor: pointer;
  }
`;

const PreviewBody = styled.div`
  overflow: auto;
  padding: 6px 10px 12px;
`;

const ServiceOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 23000;
  background: var(--ch-overlay-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px;
`;

const ServiceOverlayPanel = styled.div`
  width: min(1100px, 96vw);
  max-height: 90vh;
  border-radius: 14px;
  border: 1px solid var(--ch-border);
  background: var(--ch-preview-panel-bg);
  display: grid;
  grid-template-rows: auto auto auto minmax(160px, 1fr) auto;
  overflow: hidden;
`;

const ServiceOverlayHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--ch-border);
  strong {
    font-size: 14px;
    color: var(--ch-text);
  }
  button {
    height: 34px;
    border-radius: 8px;
    border: 1px solid var(--ch-border);
    background: var(--ch-sub-btn-bg);
    color: var(--ch-sub-btn-text);
    padding: 0 10px;
    cursor: pointer;
    font-weight: 800;
  }
`;

const ServiceOverlaySearch = styled.input`
  width: calc(100% - 28px);
  margin: 12px 14px 0;
  height: 40px;
  border-radius: 10px;
  border: 1px solid var(--ch-input-border);
  background: var(--ch-input-bg);
  color: var(--ch-input-text);
  padding: 0 10px;
  outline: none;
`;

const ServiceOverlayCount = styled.div`
  padding: 8px 14px 0;
  font-size: 12px;
  color: var(--ch-sub);
  font-weight: 700;
`;

const ServiceOverlayList = styled.div`
  margin: 10px 14px 0;
  border: 1px solid var(--ch-border);
  border-radius: 10px;
  background: var(--ch-list-bg);
  overflow: auto;
  padding: 10px;

  .svc-group + .svc-group {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px dashed var(--ch-border);
  }

  .svc-group-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  }

  .svc-group-head strong {
    font-size: 13px;
    color: var(--ch-text);
  }

  .svc-group-head span {
    font-size: 11px;
    color: var(--ch-sub);
    font-weight: 700;
  }

  .svc-group-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  label {
    display: grid;
    grid-template-columns: 18px 1fr;
    grid-template-areas:
      "cb nm"
      "cb meta";
    gap: 2px 8px;
    align-items: start;
    padding: 7px;
    border-radius: 8px;
    cursor: pointer;
  }
  label:hover {
    background: var(--ch-hover-bg);
  }
  label.checked {
    background: var(--ch-selected-bg);
  }
  input {
    grid-area: cb;
    margin-top: 2px;
  }
  .nm {
    grid-area: nm;
    font-size: 13px;
    font-weight: 800;
    color: var(--ch-text);
  }
  .meta {
    grid-area: meta;
    font-size: 11px;
    color: var(--ch-sub);
  }
  .empty {
    padding: 12px 10px;
    font-size: 12px;
    color: var(--ch-sub);
  }

  @media (max-width: 980px) {
    .svc-group-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 640px) {
    .svc-group-grid {
      grid-template-columns: 1fr;
    }
  }
`;

const ServiceOverlayFoot = styled.div`
  padding: 10px 14px 12px;
  border-top: 1px solid var(--ch-border);
  display: flex;
  justify-content: flex-end;
  button {
    height: 36px;
    border-radius: 10px;
    border: 1px solid var(--ch-border);
    background: var(--ch-sub-btn-bg);
    color: var(--ch-sub-btn-text);
    padding: 0 12px;
    cursor: pointer;
    font-weight: 800;
  }
`;

const WorkMetaGrid = styled.div`
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--ch-border);
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
  label {
    display: grid;
    gap: 6px;
  }
  label span {
    font-size: 12px;
    font-weight: 800;
    color: var(--ch-sub);
  }
  label input,
  label select {
    width: 100%;
    height: 38px;
    border-radius: 10px;
    border: 1px solid var(--ch-input-border);
    background: var(--ch-input-bg);
    color: var(--ch-input-text);
    padding: 0 10px;
    outline: none;
  }
  .mins {
    align-self: end;
    height: 38px;
    display: flex;
    align-items: center;
    border-radius: 10px;
    border: 1px solid var(--ch-input-border);
    background: var(--ch-list-bg);
    color: var(--ch-text);
    padding: 0 10px;
    font-size: 12px;
    font-weight: 900;
    white-space: nowrap;
  }
  @media (max-width: 900px) {
    grid-template-columns: 1fr 1fr;
  }
`;

const Toast = styled.div`
  position: fixed;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20000;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid var(--ch-border);
  background: ${(p) => (p.$type === 'success' ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)')};
  color: var(--ch-toast-text);
  box-shadow: none;
  font-weight: 800;
`;
