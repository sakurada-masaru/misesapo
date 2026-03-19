import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import './admin-master.css';
import Hotbar from '../../shared/ui/Hotbar/Hotbar';
import { SALES_HOTBAR } from '../../jobs/sales/entrance/hotbar.config';

function isLocalUiHost() {
  if (typeof window === 'undefined') return false;
  const h = String(window.location?.hostname || '').toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
}

const API_BASE =
  (import.meta.env?.DEV || isLocalUiHost())
    ? '/api-master'
    : (import.meta.env?.VITE_MASTER_API_BASE || 'https://jtn6in2iuj.execute-api.ap-northeast-1.amazonaws.com/prod');

const CUSTOMER_MASTER_APPROVAL_ROOM = 'customer_master_approval';
const CUSTOMER_MASTER_APPROVAL_SOURCE = 'customer_master_approval';

const REQUEST_ACTION_LABELS = {
  update_row: '編集申請',
  create_torihikisaki: '顧客/取引先追加申請',
  create_yagou: '屋号追加申請',
  create_tenpo: '店舗追加申請',
  create_customer_bundle: '顧客登録申請',
  delete_rows: '削除申請',
};

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

function norm(v) {
  return String(v || '').trim();
}

function parseFixedPrefixNumber(value, prefix) {
  const v = norm(value);
  const re = new RegExp(`^${prefix}#(\\d+)$`, 'i');
  const m = v.match(re);
  if (!m) return Number.NaN;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : Number.NaN;
}

function buildFixedPrefixId(prefix, number) {
  const next = Math.max(1, Number(number) || 1);
  const width = Math.max(4, String(next).length);
  return `${prefix}#${String(next).padStart(width, '0')}`;
}

function readActorName() {
  try {
    const auth = JSON.parse(localStorage.getItem('misesapo_auth') || '{}');
    return norm(auth?.name || auth?.email || 'unknown');
  } catch {
    return 'unknown';
  }
}

function readActorId() {
  try {
    const auth = JSON.parse(localStorage.getItem('misesapo_auth') || '{}');
    return norm(auth?.user_id || auth?.sub || auth?.email || 'unknown');
  } catch {
    return 'unknown';
  }
}

function getItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.rows)) return data.rows;
  return [];
}

function parseDataPayload(raw) {
  if (raw && typeof raw === 'object') return raw;
  const s = norm(raw);
  if (!s) return {};
  try {
    const parsed = JSON.parse(s);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function buildApprovalRequestId() {
  return `CMR-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function listRequestEvents(rawRows) {
  return getItems(rawRows)
    .map((row, idx) => {
      const payload = parseDataPayload(row?.data_payload);
      if (norm(payload?.channel) !== CUSTOMER_MASTER_APPROVAL_SOURCE) return null;
      const requestId = norm(payload?.request_id);
      const eventType = norm(payload?.event_type);
      if (!requestId || !eventType) return null;
      const at = norm(row?.created_at || payload?.sent_at || row?.updated_at) || new Date().toISOString();
      const atMs = Date.parse(at);
      return {
        id: norm(row?.admin_chat_id || row?.id) || `cmr-${idx}-${Date.now()}`,
        requestId,
        eventType,
        at,
        atMs: Number.isFinite(atMs) ? atMs : 0,
        actorName: norm(payload?.sender_name || row?.sender_name || row?.created_by || 'unknown'),
        payload,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.atMs || 0) - (b.atMs || 0));
}

function requestSummary(reqPayload = {}) {
  const action = norm(reqPayload?.action);
  const target = reqPayload?.after || {};
  const rows = Array.isArray(reqPayload?.rows) ? reqPayload.rows : [];
  const actionLabel = REQUEST_ACTION_LABELS[action] || '申請';
  if (action === 'delete_rows') {
    return `${actionLabel} ${rows.length}件`;
  }
  const label = norm(target?.tenpo_name || target?.yagou_name || target?.torihikisaki_name || target?.kokyaku_name || reqPayload?.target_label);
  return label ? `${actionLabel}: ${label}` : actionLabel;
}

async function apiJson(path, options = {}) {
  const base = String(API_BASE || '').replace(/\/$/, '');
  const res = await fetch(`${base}${path}`, {
    method: options.method || 'GET',
    headers: {
      ...authHeaders(),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${path} (${res.status}) ${text}`);
  }
  return res.json().catch(() => ({}));
}

function rowSortKey(row) {
  return [
    norm(row.kokyaku_id),
    norm(row.torihikisaki_id),
    norm(row.yagou_id),
    norm(row.tenpo_id),
    norm(row.kokyaku_name),
    norm(row.torihikisaki_name),
    norm(row.yagou_name),
    norm(row.tenpo_name),
  ].join('\u0001').toLowerCase();
}

function parseLeadingNumber(text) {
  const m = String(text || '').match(/(\d+)/);
  if (!m) return Number.NaN;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : Number.NaN;
}

function compareIdYoungFirst(aId, bId, dir) {
  const an = parseLeadingNumber(aId);
  const bn = parseLeadingNumber(bId);
  if (Number.isFinite(an) && Number.isFinite(bn) && an !== bn) {
    return (an - bn) * dir;
  }
  return String(aId || '').localeCompare(String(bId || ''), 'ja', { numeric: true, sensitivity: 'base' }) * dir;
}

function toKokyakuId(rawId, fallbackId) {
  const direct = norm(rawId);
  if (direct) return direct;
  const fb = norm(fallbackId);
  if (!fb) return '';
  if (/^kokyaku#/i.test(fb)) return fb.replace(/^kokyaku#/i, 'KOKYAKU#');
  if (/^tori#/i.test(fb)) return fb.replace(/^tori#/i, 'KOKYAKU#');
  return `KOKYAKU#${fb}`;
}

function IdTag({ value, kind }) {
  const v = norm(value);
  if (!v) return null;
  return <span className={`admin-customer-master-id-tag kind-${kind || 'plain'}`}>{v}</span>;
}

export default function AdminCustomerMasterPage({ mode = 'admin' }) {
  const isSalesMode = String(mode || '').toLowerCase() === 'sales';
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState('all');
  const [sortKey, setSortKey] = useState('kokyaku');
  const [sortOrder, setSortOrder] = useState('asc');
  const [rows, setRows] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState(() => new Set());
  const [editing, setEditing] = useState(null);
  const [creatingKind, setCreatingKind] = useState('');
  const [createDraft, setCreateDraft] = useState({
    kokyaku_name: '',
    torihikisaki_name: '',
    yagou_name: '',
    yagou_torihikisaki_id: '',
    tenpo_name: '',
    tenpo_torihikisaki_id: '',
    tenpo_yagou_id: '',
  });
  const [salesCreateStep, setSalesCreateStep] = useState(1);
  const [salesCustomerType, setSalesCustomerType] = useState('');
  const [salesExistingTorihikisakiId, setSalesExistingTorihikisakiId] = useState('');
  const [salesExistingSearch, setSalesExistingSearch] = useState('');
  const [salesPendingOpen, setSalesPendingOpen] = useState(false);
  const createSectionRef = useRef(null);
  const [requestEvents, setRequestEvents] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestActingId, setRequestActingId] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    setOk('');
    try {
      const [toriData, yagouData, tenpoData] = await Promise.all([
        apiJson('/master/torihikisaki?limit=5000&jotai=yuko'),
        apiJson('/master/yagou?limit=8000&jotai=yuko'),
        apiJson('/master/tenpo?limit=20000&jotai=yuko'),
      ]);
      const torihikisakiItems = getItems(toriData);
      const yagouItems = getItems(yagouData);
      const tenpoItems = getItems(tenpoData);

      const toriById = new Map();
      torihikisakiItems.forEach((it) => {
        const id = norm(it?.torihikisaki_id || it?.id);
        if (!id) return;
        toriById.set(id, it);
      });

      const yagouById = new Map();
      yagouItems.forEach((it) => {
        const id = norm(it?.yagou_id || it?.id);
        if (!id) return;
        yagouById.set(id, it);
      });

      const tenpoByYagou = new Map();
      const tenpoByTori = new Map();
      tenpoItems.forEach((it) => {
        const yid = norm(it?.yagou_id);
        const tid = norm(it?.torihikisaki_id);
        if (yid) tenpoByYagou.set(yid, (tenpoByYagou.get(yid) || 0) + 1);
        if (tid) tenpoByTori.set(tid, (tenpoByTori.get(tid) || 0) + 1);
      });

      const merged = [];
      tenpoItems.forEach((tenpo) => {
        const tenpoId = norm(tenpo?.tenpo_id || tenpo?.id);
        if (!tenpoId) return;
        const toriId = norm(tenpo?.torihikisaki_id);
        const yagouId = norm(tenpo?.yagou_id);
        const tori = toriById.get(toriId) || null;
        const yagou = yagouById.get(yagouId) || null;
        const kokyakuId = toKokyakuId(tori?.kokyaku_id || tenpo?.kokyaku_id, toriId);
        const kokyakuName = norm(tori?.kokyaku_name || tenpo?.kokyaku_name || tori?.name || tenpo?.torihikisaki_name);
        merged.push({
          kind: 'tenpo',
          key: `tenpo:${tenpoId}`,
          kokyaku_id: kokyakuId,
          kokyaku_name: kokyakuName,
          torihikisaki_id: toriId,
          torihikisaki_name: norm(tori?.name || tenpo?.torihikisaki_name),
          yagou_id: yagouId,
          yagou_name: norm(yagou?.name || tenpo?.yagou_name),
          tenpo_id: tenpoId,
          tenpo_name: norm(tenpo?.name),
          tenpo_address: norm(tenpo?.address),
          tenpo_phone: norm(tenpo?.phone),
          tenpo_url: norm(tenpo?.url),
          tenpo_tantou_name: norm(tenpo?.tantou_name),
          tenpo_email: norm(tenpo?.email),
        });
      });

      yagouItems.forEach((yagou) => {
        const yagouId = norm(yagou?.yagou_id || yagou?.id);
        if (!yagouId) return;
        if ((tenpoByYagou.get(yagouId) || 0) > 0) return;
        const toriId = norm(yagou?.torihikisaki_id);
        const tori = toriById.get(toriId) || null;
        const kokyakuId = toKokyakuId(tori?.kokyaku_id || yagou?.kokyaku_id, toriId);
        const kokyakuName = norm(tori?.kokyaku_name || yagou?.kokyaku_name || tori?.name);
        merged.push({
          kind: 'yagou',
          key: `yagou:${yagouId}`,
          kokyaku_id: kokyakuId,
          kokyaku_name: kokyakuName,
          torihikisaki_id: toriId,
          torihikisaki_name: norm(tori?.name),
          yagou_id: yagouId,
          yagou_name: norm(yagou?.name),
          tenpo_id: '',
          tenpo_name: '',
          tenpo_address: '',
          tenpo_phone: '',
          tenpo_url: '',
          tenpo_tantou_name: '',
          tenpo_email: '',
        });
      });

      torihikisakiItems.forEach((tori) => {
        const toriId = norm(tori?.torihikisaki_id || tori?.id);
        if (!toriId) return;
        const hasTenpo = (tenpoByTori.get(toriId) || 0) > 0;
        const hasYagou = yagouItems.some((y) => norm(y?.torihikisaki_id) === toriId);
        if (hasTenpo || hasYagou) return;
        const kokyakuId = toKokyakuId(tori?.kokyaku_id, toriId);
        const kokyakuName = norm(tori?.kokyaku_name || tori?.name);
        merged.push({
          kind: 'torihikisaki',
          key: `torihikisaki:${toriId}`,
          kokyaku_id: kokyakuId,
          kokyaku_name: kokyakuName,
          torihikisaki_id: toriId,
          torihikisaki_name: norm(tori?.name),
          yagou_id: '',
          yagou_name: '',
          tenpo_id: '',
          tenpo_name: '',
          tenpo_address: '',
          tenpo_phone: '',
          tenpo_url: '',
          tenpo_tantou_name: '',
          tenpo_email: '',
        });
      });

      merged.sort((a, b) => rowSortKey(a).localeCompare(rowSortKey(b), 'ja'));
      setRows(merged);
    } catch (e) {
      setError(e?.message || '顧客マスタの取得に失敗しました');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const loadRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const qs = new URLSearchParams({
        limit: '2000',
        jotai: 'yuko',
        room: CUSTOMER_MASTER_APPROVAL_ROOM,
      });
      const data = await apiJson(`/master/admin_chat?${qs.toString()}`);
      setRequestEvents(listRequestEvents(data));
    } catch (e) {
      setError((prev) => prev || (e?.message || '申請一覧の取得に失敗しました'));
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const requestState = useMemo(() => {
    const requestMap = new Map();
    const decisionMap = new Map();
    requestEvents.forEach((ev) => {
      if (ev.eventType === 'change_request') requestMap.set(ev.requestId, ev);
      if (ev.eventType === 'change_decision') decisionMap.set(ev.requestId, ev);
    });
    const pending = [...requestMap.values()]
      .filter((ev) => !decisionMap.has(ev.requestId))
      .sort((a, b) => (b.atMs || 0) - (a.atMs || 0));
    const resolved = [...requestMap.values()]
      .filter((ev) => decisionMap.has(ev.requestId))
      .map((ev) => ({ request: ev, decision: decisionMap.get(ev.requestId) }))
      .sort((a, b) => (b.decision?.atMs || 0) - (a.decision?.atMs || 0));
    return { pending, resolved };
  }, [requestEvents]);

  const postMasterChangeRequest = useCallback(async ({ action, summary, payload }) => {
    const requestId = buildApprovalRequestId();
    const sentAt = new Date().toISOString();
    await apiJson('/master/admin_chat', {
      method: 'POST',
      body: {
        room: CUSTOMER_MASTER_APPROVAL_ROOM,
        source: CUSTOMER_MASTER_APPROVAL_SOURCE,
        jotai: 'yuko',
        has_attachment: false,
        name: norm(summary).slice(0, 80) || '顧客マスタ申請',
        message: norm(summary) || '顧客マスタ申請',
        sender_name: readActorName(),
        sender_display_name: readActorName(),
        sender_id: readActorId(),
        data_payload: {
          channel: CUSTOMER_MASTER_APPROVAL_SOURCE,
          event_type: 'change_request',
          request_id: requestId,
          action: norm(action),
          sent_at: sentAt,
          sender_name: readActorName(),
          sender_id: readActorId(),
          summary: norm(summary),
          ...payload,
        },
      },
    });
    return requestId;
  }, []);

  const postMasterDecision = useCallback(async ({ requestId, decision, reason, requestSummaryText }) => {
    await apiJson('/master/admin_chat', {
      method: 'POST',
      body: {
        room: CUSTOMER_MASTER_APPROVAL_ROOM,
        source: CUSTOMER_MASTER_APPROVAL_SOURCE,
        jotai: 'yuko',
        has_attachment: false,
        name: `${decision === 'approved' ? '承認' : '却下'}: ${norm(requestSummaryText).slice(0, 60)}`,
        message: `${decision === 'approved' ? '承認' : '却下'} ${requestSummaryText || ''}`.trim(),
        sender_name: readActorName(),
        sender_display_name: readActorName(),
        sender_id: readActorId(),
        data_payload: {
          channel: CUSTOMER_MASTER_APPROVAL_SOURCE,
          event_type: 'change_decision',
          request_id: norm(requestId),
          decision: decision === 'approved' ? 'approved' : 'rejected',
          reason: norm(reason),
          sent_at: new Date().toISOString(),
          sender_name: readActorName(),
          sender_id: readActorId(),
        },
      },
    });
  }, []);

  const nextIdPreview = useMemo(() => {
    let maxKokyaku = 0;
    let maxTori = 0;
    let maxYagou = 0;
    let maxTenpo = 0;
    rows.forEach((row) => {
      const k = parseFixedPrefixNumber(row.kokyaku_id, 'KOKYAKU');
      const t = parseFixedPrefixNumber(row.torihikisaki_id, 'TORI');
      const y = parseFixedPrefixNumber(row.yagou_id, 'YAGOU');
      const tp = parseFixedPrefixNumber(row.tenpo_id, 'TENPO');
      if (Number.isFinite(k) && k > maxKokyaku) maxKokyaku = k;
      if (Number.isFinite(t) && t > maxTori) maxTori = t;
      if (Number.isFinite(y) && y > maxYagou) maxYagou = y;
      if (Number.isFinite(tp) && tp > maxTenpo) maxTenpo = tp;
    });
    return {
      kokyaku: buildFixedPrefixId('KOKYAKU', maxKokyaku + 1),
      torihikisaki: buildFixedPrefixId('TORI', maxTori + 1),
      yagou: buildFixedPrefixId('YAGOU', maxYagou + 1),
      tenpo: buildFixedPrefixId('TENPO', maxTenpo + 1),
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = norm(query).toLowerCase();
    if (!q) return rows;
    const tokens = q.split(/\s+/).filter(Boolean);
    return rows.filter((row) => {
      const blob = [
        row.kokyaku_name,
        row.kokyaku_id,
        row.torihikisaki_name,
        row.torihikisaki_id,
        row.yagou_name,
        row.yagou_id,
        row.tenpo_name,
        row.tenpo_id,
        row.tenpo_address,
        row.tenpo_phone,
      ].join(' ').toLowerCase();
      return tokens.every((t) => blob.includes(t));
    });
  }, [rows, query]);

  const rowQuality = useMemo(() => {
    const toriNameCount = new Map();
    const yagouNameCount = new Map();
    const tenpoNameCount = new Map();

    const inc = (map, key) => {
      if (!key) return;
      map.set(key, (map.get(key) || 0) + 1);
    };
    rows.forEach((row) => {
      const toriNameKey = norm(row.torihikisaki_name).toLowerCase();
      const yagouNameKey = `${norm(row.torihikisaki_id).toLowerCase()}|${norm(row.yagou_name).toLowerCase()}`;
      const tenpoNameKey = `${norm(row.torihikisaki_id).toLowerCase()}|${norm(row.yagou_id).toLowerCase()}|${norm(row.tenpo_name).toLowerCase()}`;
      inc(toriNameCount, toriNameKey);
      inc(yagouNameCount, yagouNameKey);
      inc(tenpoNameCount, tenpoNameKey);
    });

    const byKey = new Map();
    rows.forEach((row) => {
      const toriNameKey = norm(row.torihikisaki_name).toLowerCase();
      const yagouNameKey = `${norm(row.torihikisaki_id).toLowerCase()}|${norm(row.yagou_name).toLowerCase()}`;
      const tenpoNameKey = `${norm(row.torihikisaki_id).toLowerCase()}|${norm(row.yagou_id).toLowerCase()}|${norm(row.tenpo_name).toLowerCase()}`;
      const hasLinkGap =
        !norm(row.kokyaku_id) ||
        (row.kind !== 'torihikisaki' && !norm(row.torihikisaki_id)) ||
        (row.kind === 'tenpo' && !norm(row.yagou_id));
      const isDuplicate =
        (norm(row.torihikisaki_name) && (toriNameCount.get(toriNameKey) || 0) > 1) ||
        (norm(row.yagou_name) && (yagouNameCount.get(yagouNameKey) || 0) > 1) ||
        (norm(row.tenpo_name) && (tenpoNameCount.get(tenpoNameKey) || 0) > 1);
      byKey.set(row.key, { hasLinkGap, isDuplicate });
    });
    return byKey;
  }, [rows]);

  const viewFilteredRows = useMemo(() => {
    if (viewMode === 'gap') {
      return filteredRows.filter((row) => rowQuality.get(row.key)?.hasLinkGap);
    }
    if (viewMode === 'duplicate') {
      return filteredRows.filter((row) => rowQuality.get(row.key)?.isDuplicate);
    }
    return filteredRows;
  }, [filteredRows, rowQuality, viewMode]);

  const handleSort = useCallback((nextKey) => {
    setSortKey((prevKey) => {
      if (prevKey === nextKey) {
        setSortOrder((prevOrder) => (prevOrder === 'asc' ? 'desc' : 'asc'));
        return prevKey;
      }
      setSortOrder('asc');
      return nextKey;
    });
  }, []);

  const sortedRows = useMemo(() => {
    const dir = sortOrder === 'asc' ? 1 : -1;
    const idFieldBySortKey = {
      kokyaku: 'kokyaku_id',
      torihikisaki: 'torihikisaki_id',
      yagou: 'yagou_id',
      tenpo: 'tenpo_id',
    };
    const nameFieldBySortKey = {
      kokyaku: 'kokyaku_name',
      torihikisaki: 'torihikisaki_name',
      yagou: 'yagou_name',
      tenpo: 'tenpo_name',
    };

    const getSortValue = (row) => {
      const quality = rowQuality.get(row.key) || {};
      switch (sortKey) {
        case 'kokyaku':
          return `${norm(row.kokyaku_name)} ${norm(row.kokyaku_id)}`;
        case 'torihikisaki':
          return `${norm(row.torihikisaki_name)} ${norm(row.torihikisaki_id)}`;
        case 'yagou':
          return `${norm(row.yagou_name)} ${norm(row.yagou_id)}`;
        case 'tenpo':
          return `${norm(row.tenpo_name)} ${norm(row.tenpo_id)}`;
        case 'phone':
          return norm(row.tenpo_phone);
        case 'status':
          if (quality.hasLinkGap) return '1-未紐付けあり';
          if (quality.isDuplicate) return '2-重複候補';
          return '3-正常';
        case 'default':
        default:
          return rowSortKey(row);
      }
    };

    return [...viewFilteredRows].sort((a, b) => {
      const idField = idFieldBySortKey[sortKey];
      if (idField) {
        const idCmp = compareIdYoungFirst(norm(a[idField]), norm(b[idField]), dir);
        if (idCmp !== 0) return idCmp;
        const nameField = nameFieldBySortKey[sortKey];
        if (nameField) {
          const nameCmp = String(norm(a[nameField])).localeCompare(String(norm(b[nameField])), 'ja', { numeric: true, sensitivity: 'base' });
          if (nameCmp !== 0) return nameCmp * dir;
        }
      }

      const av = getSortValue(a);
      const bv = getSortValue(b);
      const cmp = String(av).localeCompare(String(bv), 'ja', { numeric: true, sensitivity: 'base' });
      if (cmp !== 0) return cmp * dir;
      return rowSortKey(a).localeCompare(rowSortKey(b), 'ja') * dir;
    });
  }, [rowQuality, sortKey, sortOrder, viewFilteredRows]);

  const sortMark = useCallback((key) => {
    if (sortKey !== key) return '↕';
    return sortOrder === 'asc' ? '↑' : '↓';
  }, [sortKey, sortOrder]);

  useEffect(() => {
    setSelectedKeys((prev) => {
      if (!prev.size) return prev;
      const visible = new Set(sortedRows.map((r) => r.key));
      const next = new Set();
      prev.forEach((k) => {
        if (visible.has(k)) next.add(k);
      });
      if (next.size === prev.size) return prev;
      return next;
    });
  }, [sortedRows]);

  const allVisibleSelected = useMemo(
    () => sortedRows.length > 0 && sortedRows.every((r) => selectedKeys.has(r.key)),
    [sortedRows, selectedKeys]
  );

  const selectedRows = useMemo(() => {
    if (!selectedKeys.size) return [];
    return sortedRows.filter((r) => selectedKeys.has(r.key));
  }, [sortedRows, selectedKeys]);

  const toggleAllVisible = useCallback((checked) => {
    if (checked) {
      setSelectedKeys(new Set(sortedRows.map((r) => r.key)));
      return;
    }
    setSelectedKeys(new Set());
  }, [sortedRows]);

  const toggleRowSelected = useCallback((key, checked) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const openEdit = useCallback((row) => {
    setError('');
    setOk('');
    setEditing({
      ...row,
      _manualInput: false,
      _origin: { ...row },
    });
  }, []);

  const closeEdit = useCallback(() => {
    if (saving) return;
    setEditing(null);
  }, [saving]);

  const torihikisakiOptions = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      const id = norm(row.torihikisaki_id);
      if (!id) return;
      if (!map.has(id)) {
        map.set(id, {
          id,
          name: norm(row.torihikisaki_name),
          kokyaku_id: norm(row.kokyaku_id),
          kokyaku_name: norm(row.kokyaku_name),
        });
      }
    });
    return [...map.values()].sort((a, b) => compareIdYoungFirst(a.id, b.id, 1));
  }, [rows]);

  const torihikisakiById = useMemo(
    () => new Map(torihikisakiOptions.map((it) => [it.id, it])),
    [torihikisakiOptions]
  );

  const salesExistingSearchTextByTorihikisakiId = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      const toriId = norm(row.torihikisaki_id);
      if (!toriId) return;
      const base = map.get(toriId) || [];
      base.push(
        norm(row.kokyaku_name),
        norm(row.torihikisaki_name),
        norm(row.yagou_name),
        norm(row.tenpo_name),
        norm(row.torihikisaki_id),
        norm(row.yagou_id),
        norm(row.tenpo_id),
      );
      map.set(toriId, base);
    });
    const compacted = new Map();
    map.forEach((parts, toriId) => {
      const text = parts.filter(Boolean).join(' ').toLowerCase();
      compacted.set(toriId, text);
    });
    return compacted;
  }, [rows]);

  const filteredSalesTorihikisakiOptions = useMemo(() => {
    const q = norm(salesExistingSearch).toLowerCase();
    if (!q) return torihikisakiOptions;
    return torihikisakiOptions.filter((it) => {
      const quickText = `${norm(it.id)} ${norm(it.name)} ${norm(it.kokyaku_name)}`.toLowerCase();
      if (quickText.includes(q)) return true;
      return String(salesExistingSearchTextByTorihikisakiId.get(norm(it.id)) || '').includes(q);
    });
  }, [salesExistingSearch, salesExistingSearchTextByTorihikisakiId, torihikisakiOptions]);

  const yagouOptions = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      const id = norm(row.yagou_id);
      if (!id) return;
      if (!map.has(id)) {
        map.set(id, {
          id,
          name: norm(row.yagou_name),
          torihikisaki_id: norm(row.torihikisaki_id),
        });
      }
    });
    return [...map.values()].sort((a, b) => compareIdYoungFirst(a.id, b.id, 1));
  }, [rows]);

  const yagouById = useMemo(
    () => new Map(yagouOptions.map((it) => [it.id, it])),
    [yagouOptions]
  );

  const selectedSalesTorihikisaki = useMemo(
    () => torihikisakiById.get(norm(salesExistingTorihikisakiId)) || null,
    [salesExistingTorihikisakiId, torihikisakiById]
  );

  const salesTorihikisakiBaseName = useMemo(() => {
    if (salesCustomerType === 'existing') {
      return norm(selectedSalesTorihikisaki?.name || '');
    }
    return norm(createDraft.kokyaku_name || createDraft.torihikisaki_name);
  }, [createDraft.kokyaku_name, createDraft.torihikisaki_name, salesCustomerType, selectedSalesTorihikisaki]);

  const resetSalesCreateWizard = useCallback(() => {
    setSalesCreateStep(1);
    setSalesCustomerType('');
    setSalesExistingTorihikisakiId('');
    setSalesExistingSearch('');
    setCreateDraft({
      kokyaku_name: '',
      torihikisaki_name: '',
      yagou_name: '',
      yagou_torihikisaki_id: '',
      tenpo_name: '',
      tenpo_torihikisaki_id: '',
      tenpo_yagou_id: '',
    });
  }, []);

  const applyRowUpdate = useCallback(async ({ before, after, actor }) => {
    const origin = before || {};
    const next = after || {};
    const originTorihikisakiId = norm(origin.torihikisaki_id);
    const originYagouId = norm(origin.yagou_id);
    const originTenpoId = norm(origin.tenpo_id);
    const changed = (k) => norm(next[k]) !== norm(origin[k]);

    if (originTorihikisakiId) {
      const patch = {};
      if (changed('kokyaku_id')) patch.kokyaku_id = norm(next.kokyaku_id);
      if (changed('kokyaku_name')) patch.kokyaku_name = norm(next.kokyaku_name);
      if (changed('torihikisaki_name')) patch.name = norm(next.torihikisaki_name);
      if (Object.keys(patch).length) {
        await apiJson(`/master/torihikisaki/${encodeURIComponent(originTorihikisakiId)}`, {
          method: 'PUT',
          body: { ...patch, updated_by: actor },
        });
      }
    }

    if (originYagouId) {
      const patch = {};
      if (changed('yagou_name')) patch.name = norm(next.yagou_name);
      if (norm(next.torihikisaki_id) && changed('torihikisaki_id')) patch.torihikisaki_id = norm(next.torihikisaki_id);
      if (Object.keys(patch).length) {
        await apiJson(`/master/yagou/${encodeURIComponent(originYagouId)}`, {
          method: 'PUT',
          body: { ...patch, updated_by: actor },
        });
      }
    }

    if (originTenpoId) {
      const patch = {};
      if (changed('tenpo_name')) patch.name = norm(next.tenpo_name);
      if (changed('tenpo_address')) patch.address = norm(next.tenpo_address);
      if (changed('tenpo_phone')) patch.phone = norm(next.tenpo_phone);
      if (changed('tenpo_tantou_name')) patch.tantou_name = norm(next.tenpo_tantou_name);
      if (changed('tenpo_email')) patch.email = norm(next.tenpo_email);
      if (changed('kokyaku_id')) patch.kokyaku_id = norm(next.kokyaku_id);
      if (changed('kokyaku_name')) patch.kokyaku_name = norm(next.kokyaku_name);
      if (changed('torihikisaki_id')) patch.torihikisaki_id = norm(next.torihikisaki_id);
      if (changed('torihikisaki_name')) patch.torihikisaki_name = norm(next.torihikisaki_name);
      if (changed('yagou_id')) patch.yagou_id = norm(next.yagou_id);
      if (changed('yagou_name')) patch.yagou_name = norm(next.yagou_name);
      if (Object.keys(patch).length) {
        await apiJson(`/master/tenpo/${encodeURIComponent(originTenpoId)}`, {
          method: 'PUT',
          body: { ...patch, updated_by: actor },
        });
      }
    }
  }, []);

  const applyDeleteRows = useCallback(async (rowsToDelete = []) => {
    let count = 0;
    for (const row of rowsToDelete) {
      if (row.kind === 'tenpo' && norm(row.tenpo_id)) {
        await apiJson(`/master/tenpo/${encodeURIComponent(row.tenpo_id)}`, { method: 'DELETE' });
        count += 1;
        continue;
      }
      if (row.kind === 'yagou' && norm(row.yagou_id)) {
        await apiJson(`/master/yagou/${encodeURIComponent(row.yagou_id)}`, { method: 'DELETE' });
        count += 1;
        continue;
      }
      if (row.kind === 'torihikisaki' && norm(row.torihikisaki_id)) {
        await apiJson(`/master/torihikisaki/${encodeURIComponent(row.torihikisaki_id)}`, { method: 'DELETE' });
        count += 1;
      }
    }
    return count;
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editing) return;
    const origin = editing._origin || {};
    const after = Object.fromEntries(
      Object.entries(editing).filter(([k]) => !String(k).startsWith('_'))
    );
    const actor = readActorName();

    setSaving(true);
    setError('');
    setOk('');
    try {
      if (isSalesMode) {
        await postMasterChangeRequest({
          action: 'update_row',
          summary: requestSummary({ action: 'update_row', after }),
          payload: {
            before: origin,
            after,
            target_label: norm(after.tenpo_name || after.yagou_name || after.torihikisaki_name || after.kokyaku_name),
          },
        });
        setOk('変更申請を送信しました（管理承認待ち）');
        setEditing(null);
        await loadRequests();
      } else {
        await applyRowUpdate({ before: origin, after, actor });
        setOk('顧客マスタを保存しました');
        setEditing(null);
        await loadAll();
      }
    } catch (e) {
      setError(e?.message || (isSalesMode ? '申請送信に失敗しました' : '保存に失敗しました'));
    } finally {
      setSaving(false);
    }
  }, [applyRowUpdate, editing, isSalesMode, loadAll, loadRequests, postMasterChangeRequest]);

  const deleteSelected = useCallback(async () => {
    if (saving || selectedRows.length === 0) return;
    const okDelete = window.confirm(`選択した ${selectedRows.length} 件を${isSalesMode ? '削除申請' : '削除'}しますか？\nこの操作は取り消せません。`);
    if (!okDelete) return;

    setSaving(true);
    setError('');
    setOk('');
    try {
      if (isSalesMode) {
        await postMasterChangeRequest({
          action: 'delete_rows',
          summary: requestSummary({ action: 'delete_rows', rows: selectedRows }),
          payload: {
            rows: selectedRows.map((row) => ({
              kind: row.kind,
              kokyaku_id: row.kokyaku_id,
              torihikisaki_id: row.torihikisaki_id,
              yagou_id: row.yagou_id,
              tenpo_id: row.tenpo_id,
              kokyaku_name: row.kokyaku_name,
              torihikisaki_name: row.torihikisaki_name,
              yagou_name: row.yagou_name,
              tenpo_name: row.tenpo_name,
            })),
          },
        });
        setSelectedKeys(new Set());
        setOk(`${selectedRows.length}件の削除申請を送信しました`);
        await loadRequests();
      } else {
        const count = await applyDeleteRows(selectedRows);
        setSelectedKeys(new Set());
        setOk(`${count}件を削除しました`);
        await loadAll();
      }
    } catch (e) {
      setError(e?.message || (isSalesMode ? '削除申請に失敗しました' : '削除に失敗しました'));
    } finally {
      setSaving(false);
    }
  }, [applyDeleteRows, isSalesMode, loadAll, loadRequests, postMasterChangeRequest, saving, selectedRows]);

  const onTorihikisakiChange = useCallback((nextId) => {
    setEditing((prev) => {
      if (!prev) return prev;
      const picked = torihikisakiById.get(norm(nextId));
      return {
        ...prev,
        torihikisaki_id: norm(nextId),
        torihikisaki_name: picked?.name || '',
        kokyaku_id: picked?.kokyaku_id || prev.kokyaku_id || '',
        kokyaku_name: picked?.kokyaku_name || prev.kokyaku_name || '',
      };
    });
  }, [torihikisakiById]);

  const onYagouChange = useCallback((nextId) => {
    setEditing((prev) => {
      if (!prev) return prev;
      const picked = yagouById.get(norm(nextId));
      if (!picked) {
        return {
          ...prev,
          yagou_id: '',
          yagou_name: '',
        };
      }
      const linkedTori = torihikisakiById.get(picked.torihikisaki_id);
      return {
        ...prev,
        yagou_id: picked.id,
        yagou_name: picked.name || '',
        torihikisaki_id: picked.torihikisaki_id || prev.torihikisaki_id || '',
        torihikisaki_name: linkedTori?.name || prev.torihikisaki_name || '',
        kokyaku_id: linkedTori?.kokyaku_id || prev.kokyaku_id || '',
        kokyaku_name: linkedTori?.kokyaku_name || prev.kokyaku_name || '',
      };
    });
  }, [torihikisakiById, yagouById]);

  const createTorihikisaki = useCallback(async () => {
    const kokyakuId = nextIdPreview.kokyaku;
    const baseName = norm(createDraft.kokyaku_name || createDraft.torihikisaki_name);
    const kokyakuName = baseName;
    const torihikisakiName = baseName;
    if (!baseName) {
      setError('顧客名を入力してください');
      return;
    }
    setCreatingKind('torihikisaki');
    setError('');
    setOk('');
    try {
      if (isSalesMode) {
        const after = {
          kokyaku_id: kokyakuId,
          kokyaku_name: kokyakuName || torihikisakiName,
          torihikisaki_name: torihikisakiName,
        };
        await postMasterChangeRequest({
          action: 'create_torihikisaki',
          summary: requestSummary({ action: 'create_torihikisaki', after }),
          payload: { after },
        });
      } else {
        const body = {
          name: torihikisakiName,
          kokyaku_name: kokyakuName || torihikisakiName,
          kokyaku_id: kokyakuId,
          jotai: 'yuko',
          updated_by: readActorName(),
        };
        await apiJson('/master/torihikisaki', {
          method: 'POST',
          body,
        });
      }
      setCreateDraft((prev) => ({
        ...prev,
        kokyaku_name: '',
        torihikisaki_name: '',
      }));
      setOk(isSalesMode ? `顧客/取引先の追加申請を送信しました: ${torihikisakiName}` : `顧客/取引先を追加しました: ${torihikisakiName}`);
      if (isSalesMode) await loadRequests();
      else await loadAll();
    } catch (e) {
      setError(e?.message || (isSalesMode ? '取引先の追加申請に失敗しました' : '取引先の追加に失敗しました'));
    } finally {
      setCreatingKind('');
    }
  }, [createDraft.kokyaku_name, createDraft.torihikisaki_name, isSalesMode, loadAll, loadRequests, nextIdPreview.kokyaku, postMasterChangeRequest]);

  const createYagou = useCallback(async () => {
    const name = norm(createDraft.yagou_name);
    const torihikisakiId = norm(createDraft.yagou_torihikisaki_id);
    if (!name) {
      setError('屋号名を入力してください');
      return;
    }
    setCreatingKind('yagou');
    setError('');
    setOk('');
    try {
      if (isSalesMode) {
        const after = {
          yagou_name: name,
          torihikisaki_id: torihikisakiId,
        };
        await postMasterChangeRequest({
          action: 'create_yagou',
          summary: requestSummary({ action: 'create_yagou', after }),
          payload: { after },
        });
      } else {
        const body = {
          name,
          jotai: 'yuko',
          updated_by: readActorName(),
        };
        if (torihikisakiId) body.torihikisaki_id = torihikisakiId;
        await apiJson('/master/yagou', { method: 'POST', body });
      }
      setCreateDraft((prev) => ({ ...prev, yagou_name: '' }));
      setOk(isSalesMode ? `屋号の追加申請を送信しました: ${name}` : `屋号を追加しました: ${name}`);
      if (isSalesMode) await loadRequests();
      else await loadAll();
    } catch (e) {
      setError(e?.message || (isSalesMode ? '屋号の追加申請に失敗しました' : '屋号の追加に失敗しました'));
    } finally {
      setCreatingKind('');
    }
  }, [createDraft.yagou_name, createDraft.yagou_torihikisaki_id, isSalesMode, loadAll, loadRequests, postMasterChangeRequest]);

  const createTenpo = useCallback(async () => {
    const name = norm(createDraft.tenpo_name);
    let torihikisakiId = norm(createDraft.tenpo_torihikisaki_id);
    const yagouId = norm(createDraft.tenpo_yagou_id);
    if (!name) {
      setError('店舗名を入力してください');
      return;
    }
    if (!torihikisakiId && yagouId) {
      torihikisakiId = norm(yagouById.get(yagouId)?.torihikisaki_id);
    }
    setCreatingKind('tenpo');
    setError('');
    setOk('');
    try {
      if (isSalesMode) {
        const after = {
          tenpo_name: name,
          torihikisaki_id: torihikisakiId,
          yagou_id: yagouId,
        };
        await postMasterChangeRequest({
          action: 'create_tenpo',
          summary: requestSummary({ action: 'create_tenpo', after }),
          payload: { after },
        });
      } else {
        const body = {
          name,
          jotai: 'yuko',
          updated_by: readActorName(),
        };
        if (torihikisakiId) body.torihikisaki_id = torihikisakiId;
        if (yagouId) body.yagou_id = yagouId;
        await apiJson('/master/tenpo', { method: 'POST', body });
      }
      setCreateDraft((prev) => ({ ...prev, tenpo_name: '' }));
      setOk(isSalesMode ? `店舗の追加申請を送信しました: ${name}` : `店舗を追加しました: ${name}`);
      if (isSalesMode) await loadRequests();
      else await loadAll();
    } catch (e) {
      setError(e?.message || (isSalesMode ? '店舗の追加申請に失敗しました' : '店舗の追加に失敗しました'));
    } finally {
      setCreatingKind('');
    }
  }, [createDraft.tenpo_name, createDraft.tenpo_torihikisaki_id, createDraft.tenpo_yagou_id, isSalesMode, loadAll, loadRequests, postMasterChangeRequest, yagouById]);

  const submitSalesBundleRequest = useCallback(async () => {
    if (!isSalesMode) return;
    const mode = norm(salesCustomerType);
    const yagouName = norm(createDraft.yagou_name);
    const tenpoName = norm(createDraft.tenpo_name);

    if (mode !== 'new' && mode !== 'existing') {
      setError('最初に「新規顧客 / 既存顧客」を選択してください');
      return;
    }
    if (!yagouName) {
      setError('屋号名を入力してください');
      return;
    }
    if (!tenpoName) {
      setError('店舗名を入力してください');
      return;
    }

    let torihikisakiId = '';
    let torihikisakiName = '';
    let kokyakuName = '';

    if (mode === 'new') {
      const baseName = norm(createDraft.kokyaku_name || createDraft.torihikisaki_name);
      if (!baseName) {
        setError('顧客名を入力してください');
        return;
      }
      torihikisakiName = baseName;
      kokyakuName = baseName;
    } else {
      torihikisakiId = norm(salesExistingTorihikisakiId);
      if (!torihikisakiId) {
        setError('既存の取引先を選択してください');
        return;
      }
      const picked = torihikisakiById.get(torihikisakiId);
      torihikisakiName = norm(picked?.name || '');
      kokyakuName = norm(picked?.kokyaku_name || '');
    }

    const after = {
      customer_mode: mode,
      kokyaku_name: kokyakuName,
      torihikisaki_id: torihikisakiId,
      torihikisaki_name: torihikisakiName,
      yagou_name: yagouName,
      tenpo_name: tenpoName,
    };

    setCreatingKind('sales_bundle');
    setError('');
    setOk('');
    try {
      await postMasterChangeRequest({
        action: 'create_customer_bundle',
        summary: requestSummary({ action: 'create_customer_bundle', after }),
        payload: { after },
      });
      setOk(`顧客登録申請を送信しました: ${torihikisakiName || tenpoName}`);
      window.confirm('基本情報を入力しますか？');
      resetSalesCreateWizard();
      const qs = torihikisakiId ? `?torihikisaki_id=${encodeURIComponent(torihikisakiId)}` : '';
      navigate(`/sales/clients/list${qs}`);
      await loadRequests();
    } catch (e) {
      setError(e?.message || '顧客登録申請に失敗しました');
    } finally {
      setCreatingKind('');
    }
  }, [
    createDraft.kokyaku_name,
    createDraft.tenpo_name,
    createDraft.torihikisaki_name,
    createDraft.yagou_name,
    isSalesMode,
    loadRequests,
    navigate,
    postMasterChangeRequest,
    resetSalesCreateWizard,
    salesCustomerType,
    salesExistingTorihikisakiId,
    torihikisakiById,
  ]);

  const approveRequest = useCallback(async (reqEvent) => {
    const payload = reqEvent?.payload || {};
    const requestId = norm(reqEvent?.requestId);
    if (!requestId) return;
    setRequestActingId(requestId);
    setError('');
    setOk('');
    try {
      const action = norm(payload?.action);
      if (action === 'update_row') {
        await applyRowUpdate({
          before: payload?.before || {},
          after: payload?.after || {},
          actor: readActorName(),
        });
      } else if (action === 'create_torihikisaki') {
        const after = payload?.after || {};
        await apiJson('/master/torihikisaki', {
          method: 'POST',
          body: {
            name: norm(after?.torihikisaki_name),
            kokyaku_name: norm(after?.kokyaku_name || after?.torihikisaki_name),
            kokyaku_id: norm(after?.kokyaku_id),
            jotai: 'yuko',
            updated_by: readActorName(),
          },
        });
      } else if (action === 'create_yagou') {
        const after = payload?.after || {};
        const body = {
          name: norm(after?.yagou_name),
          jotai: 'yuko',
          updated_by: readActorName(),
        };
        if (norm(after?.torihikisaki_id)) body.torihikisaki_id = norm(after.torihikisaki_id);
        await apiJson('/master/yagou', { method: 'POST', body });
      } else if (action === 'create_tenpo') {
        const after = payload?.after || {};
        const body = {
          name: norm(after?.tenpo_name),
          jotai: 'yuko',
          updated_by: readActorName(),
        };
        if (norm(after?.torihikisaki_id)) body.torihikisaki_id = norm(after.torihikisaki_id);
        if (norm(after?.yagou_id)) body.yagou_id = norm(after.yagou_id);
        await apiJson('/master/tenpo', { method: 'POST', body });
      } else if (action === 'create_customer_bundle') {
        const after = payload?.after || {};
        const mode = norm(after?.customer_mode);
        const actor = readActorName();

        let torihikisakiId = norm(after?.torihikisaki_id);
        let torihikisakiName = norm(after?.torihikisaki_name);
        const kokyakuName = norm(after?.kokyaku_name || torihikisakiName);
        const yagouName = norm(after?.yagou_name);
        const tenpoName = norm(after?.tenpo_name);

        if (!yagouName || !tenpoName) {
          throw new Error('申請データ不備: 屋号名または店舗名が不足しています');
        }

        if (mode === 'new') {
          if (!torihikisakiName) {
            throw new Error('申請データ不備: 取引先名が不足しています');
          }
          const createdTori = await apiJson('/master/torihikisaki', {
            method: 'POST',
            body: {
              name: torihikisakiName,
              kokyaku_name: kokyakuName || torihikisakiName,
              jotai: 'yuko',
              updated_by: actor,
            },
          });
          torihikisakiId = norm(createdTori?.torihikisaki_id || createdTori?.id || createdTori?.item?.torihikisaki_id);
          if (!torihikisakiId) {
            const toriData = await apiJson('/master/torihikisaki?limit=5000&jotai=yuko');
            const matched = getItems(toriData).filter((it) => norm(it?.name) === torihikisakiName);
            if (matched.length) {
              matched.sort((a, b) => compareIdYoungFirst(norm(a?.torihikisaki_id || a?.id), norm(b?.torihikisaki_id || b?.id), -1));
              torihikisakiId = norm(matched[0]?.torihikisaki_id || matched[0]?.id);
            }
          }
        } else if (mode === 'existing') {
          if (!torihikisakiId) {
            throw new Error('申請データ不備: 既存取引先IDが不足しています');
          }
          if (!torihikisakiName) {
            const toriData = await apiJson('/master/torihikisaki?limit=5000&jotai=yuko');
            const picked = getItems(toriData).find((it) => norm(it?.torihikisaki_id || it?.id) === torihikisakiId);
            torihikisakiName = norm(picked?.name || '');
          }
        } else {
          throw new Error(`申請データ不備: customer_mode=${mode || '(empty)'}`);
        }

        const yagouBody = {
          name: yagouName,
          jotai: 'yuko',
          updated_by: actor,
        };
        if (torihikisakiId) yagouBody.torihikisaki_id = torihikisakiId;
        const createdYagou = await apiJson('/master/yagou', { method: 'POST', body: yagouBody });
        let yagouId = norm(createdYagou?.yagou_id || createdYagou?.id || createdYagou?.item?.yagou_id);
        if (!yagouId) {
          const yagouData = await apiJson('/master/yagou?limit=8000&jotai=yuko');
          const matched = getItems(yagouData).filter((it) => {
            const sameName = norm(it?.name) === yagouName;
            if (!sameName) return false;
            if (!torihikisakiId) return true;
            return norm(it?.torihikisaki_id) === torihikisakiId;
          });
          if (matched.length) {
            matched.sort((a, b) => compareIdYoungFirst(norm(a?.yagou_id || a?.id), norm(b?.yagou_id || b?.id), -1));
            yagouId = norm(matched[0]?.yagou_id || matched[0]?.id);
          }
        }

        const tenpoBody = {
          name: tenpoName,
          jotai: 'yuko',
          updated_by: actor,
        };
        if (torihikisakiId) tenpoBody.torihikisaki_id = torihikisakiId;
        if (yagouId) tenpoBody.yagou_id = yagouId;
        await apiJson('/master/tenpo', { method: 'POST', body: tenpoBody });
      } else if (action === 'delete_rows') {
        const rowsToDelete = Array.isArray(payload?.rows) ? payload.rows : [];
        await applyDeleteRows(rowsToDelete);
      } else {
        throw new Error(`未対応の申請アクションです: ${action || '(empty)'}`);
      }
      await postMasterDecision({
        requestId,
        decision: 'approved',
        reason: '承認',
        requestSummaryText: requestSummary(payload),
      });
      setOk(`申請を承認して反映しました: ${requestSummary(payload)}`);
      await Promise.all([loadAll(), loadRequests()]);
    } catch (e) {
      setError(e?.message || '申請の承認反映に失敗しました');
    } finally {
      setRequestActingId('');
    }
  }, [applyDeleteRows, applyRowUpdate, loadAll, loadRequests, postMasterDecision]);

  const rejectRequest = useCallback(async (reqEvent) => {
    const requestId = norm(reqEvent?.requestId);
    if (!requestId) return;
    const reason = window.prompt('却下理由を入力してください（必須）', '内容不備');
    if (reason == null) return;
    if (!norm(reason)) {
      window.alert('却下理由は必須です');
      return;
    }
    setRequestActingId(requestId);
    setError('');
    setOk('');
    try {
      await postMasterDecision({
        requestId,
        decision: 'rejected',
        reason,
        requestSummaryText: requestSummary(reqEvent?.payload || {}),
      });
      setOk(`申請を却下しました: ${requestSummary(reqEvent?.payload || {})}`);
      await loadRequests();
    } catch (e) {
      setError(e?.message || '申請の却下に失敗しました');
    } finally {
      setRequestActingId('');
    }
  }, [loadRequests, postMasterDecision]);

  const salesHotbarActive = useMemo(() => {
    const path = String(location?.pathname || '');
    if (path.startsWith('/sales/master/customer') || path.startsWith('/sales/clients/list')) return 'customer';
    if (path.startsWith('/sales/inbox') || path.startsWith('/sales/leads')) return 'progress';
    if (path.startsWith('/sales/schedule')) return 'schedule';
    if (path.startsWith('/houkoku')) return 'report';
    return 'customer';
  }, [location?.pathname]);

  const handleSalesHotbarChange = useCallback((id) => {
    const action = SALES_HOTBAR.find((it) => it.id === id);
    if (!action) return;
    const nextPath = String(
      action.to ||
      action.subItems?.find((it) => String(it?.path || it?.to || '').trim())?.path ||
      action.subItems?.find((it) => String(it?.path || it?.to || '').trim())?.to ||
      ''
    ).trim();
    if (!nextPath) return;
    if (/^https?:\/\//i.test(nextPath)) {
      window.location.href = nextPath;
      return;
    }
    navigate(nextPath);
  }, [navigate]);

  const salesStep1Ready = useMemo(() => {
    if (salesCustomerType === 'new') return Boolean(norm(createDraft.kokyaku_name || createDraft.torihikisaki_name));
    if (salesCustomerType === 'existing') return Boolean(norm(salesExistingTorihikisakiId));
    return false;
  }, [createDraft.kokyaku_name, createDraft.torihikisaki_name, salesCustomerType, salesExistingTorihikisakiId]);

  const salesStep2Ready = useMemo(() => Boolean(norm(createDraft.yagou_name)), [createDraft.yagou_name]);
  const salesStep3Ready = useMemo(() => Boolean(norm(createDraft.tenpo_name)), [createDraft.tenpo_name]);

  const salesOwnPendingRequests = useMemo(() => {
    if (!isSalesMode) return [];
    const actorId = norm(readActorId());
    const actorName = norm(readActorName());
    return requestState.pending.filter((ev) => {
      const action = norm(ev?.payload?.action);
      if (!['create_customer_bundle', 'create_torihikisaki', 'create_yagou', 'create_tenpo'].includes(action)) return false;
      const sid = norm(ev?.payload?.sender_id || '');
      const sname = norm(ev?.payload?.sender_name || ev?.actorName || '');
      if (actorId && sid) return sid === actorId;
      if (actorName && sname) return sname === actorName;
      return true;
    });
  }, [isSalesMode, requestState.pending]);

  const startReEditPendingRequest = useCallback((reqEvent) => {
    const payload = reqEvent?.payload || {};
    const action = norm(payload?.action);
    const after = payload?.after || {};

    if (action === 'create_customer_bundle') {
      const mode = norm(after?.customer_mode) === 'existing' ? 'existing' : 'new';
      const toriId = norm(after?.torihikisaki_id);
      const picked = torihikisakiById.get(toriId);
      setSalesCustomerType(mode);
      setSalesExistingTorihikisakiId(toriId);
      setSalesExistingSearch(norm(after?.torihikisaki_name || after?.kokyaku_name || picked?.name || ''));
      setCreateDraft((prev) => ({
        ...prev,
        kokyaku_name: norm(after?.kokyaku_name || picked?.kokyaku_name || ''),
        torihikisaki_name: norm(after?.torihikisaki_name || picked?.name || ''),
        yagou_name: norm(after?.yagou_name || ''),
        yagou_torihikisaki_id: toriId,
        tenpo_name: norm(after?.tenpo_name || ''),
        tenpo_torihikisaki_id: toriId,
        tenpo_yagou_id: '',
      }));
      setSalesCreateStep(1);
      setOk('申請内容をフォームへ反映しました。修正後に再申請してください。');
    } else if (action === 'create_torihikisaki') {
      setSalesCustomerType('new');
      setSalesExistingTorihikisakiId('');
      setSalesExistingSearch('');
      setCreateDraft((prev) => ({
        ...prev,
        kokyaku_name: norm(after?.kokyaku_name || after?.torihikisaki_name || ''),
        torihikisaki_name: norm(after?.torihikisaki_name || ''),
      }));
      setSalesCreateStep(1);
      setOk('取引先申請内容をフォームへ反映しました。');
    } else if (action === 'create_yagou') {
      const toriId = norm(after?.torihikisaki_id);
      const picked = torihikisakiById.get(toriId);
      setSalesCustomerType(toriId ? 'existing' : 'new');
      setSalesExistingTorihikisakiId(toriId);
      setSalesExistingSearch(norm(picked?.name || ''));
      setCreateDraft((prev) => ({
        ...prev,
        kokyaku_name: norm(picked?.kokyaku_name || prev.kokyaku_name),
        torihikisaki_name: norm(picked?.name || prev.torihikisaki_name),
        yagou_name: norm(after?.yagou_name || ''),
        yagou_torihikisaki_id: toriId,
        tenpo_torihikisaki_id: toriId,
      }));
      setSalesCreateStep(2);
      setOk('屋号申請内容をフォームへ反映しました。');
    } else if (action === 'create_tenpo') {
      const toriId = norm(after?.torihikisaki_id);
      const picked = torihikisakiById.get(toriId);
      setSalesCustomerType(toriId ? 'existing' : 'new');
      setSalesExistingTorihikisakiId(toriId);
      setSalesExistingSearch(norm(picked?.name || ''));
      setCreateDraft((prev) => ({
        ...prev,
        kokyaku_name: norm(picked?.kokyaku_name || prev.kokyaku_name),
        torihikisaki_name: norm(picked?.name || prev.torihikisaki_name),
        tenpo_name: norm(after?.tenpo_name || ''),
        tenpo_torihikisaki_id: toriId,
      }));
      setSalesCreateStep(3);
      setOk('店舗申請内容をフォームへ反映しました。');
    }

    setError('');
    requestAnimationFrame(() => {
      try {
        createSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch {
        // noop
      }
    });
  }, [torihikisakiById]);

  return (
    <div className={`admin-master-page admin-customer-master-page ${isSalesMode ? 'is-sales-mode' : 'is-admin-mode'}`.trim()}>
      <div className="admin-master-content">
        <header className="admin-master-header admin-customer-master-header">
          <div className="admin-customer-master-header-row">
            <h1>{isSalesMode ? '顧客登録申請' : '顧客マスタ'}</h1>
            <div className="admin-master-header-actions">
              <button type="button" onClick={async () => { await Promise.all([loadAll(), loadRequests()]); }} disabled={loading || requestsLoading}>
                {(loading || requestsLoading) ? '更新中...' : '更新'}
              </button>
            </div>
          </div>
          {!isSalesMode ? (
            <p className="admin-master-subtitle">
              {'kokyaku / torihikisaki / yagou / tenpo を1画面で修正・保存'}
            </p>
          ) : null}
        </header>

        {error ? <div className="admin-master-error">{error}</div> : null}
        {ok ? <div className="admin-master-success">{ok}</div> : null}
        {isSalesMode ? (
          <div className="admin-master-success" style={{ marginBottom: 12 }}>
            営業モード: ここでの保存・削除・新規追加は「申請」として送信され、管理者承認後に本データへ反映されます。
          </div>
        ) : null}

        {isSalesMode ? (
          <section className="admin-customer-master-approval-queue">
            <div className="admin-customer-master-approval-head">
              <button
                type="button"
                className="admin-customer-master-pending-toggle"
                onClick={() => setSalesPendingOpen((prev) => !prev)}
                aria-expanded={salesPendingOpen}
              >
                申請中の顧客
                <span className="state">{salesPendingOpen ? '▲' : '▼'}</span>
              </button>
              <div className="admin-master-count">申請中: {salesOwnPendingRequests.length}</div>
            </div>
            {salesPendingOpen ? (
              salesOwnPendingRequests.length === 0 ? (
                <div className="admin-customer-master-approval-empty">申請中の顧客はありません。</div>
              ) : (
                <div className="admin-customer-master-approval-list">
                  {salesOwnPendingRequests.map((ev) => (
                    <article key={ev.requestId} className="admin-customer-master-approval-item">
                      <div className="summary">{requestSummary(ev.payload)}</div>
                      <div className="meta">
                        <span>申請ID: {ev.requestId}</span>
                        <span>時刻: {ev.at}</span>
                      </div>
                      <div className="actions">
                        <button type="button" className="primary" onClick={() => startReEditPendingRequest(ev)}>
                          再編集
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )
            ) : null}
          </section>
        ) : null}

        {!isSalesMode ? (
          <section className="admin-customer-master-approval-queue">
            <div className="admin-customer-master-approval-head">
              <h2>営業からの申請（承認待ち）</h2>
              <div className="admin-master-count">承認待ち: {requestState.pending.length}</div>
            </div>
            {requestState.pending.length === 0 ? (
              <div className="admin-customer-master-approval-empty">承認待ち申請はありません。</div>
            ) : (
              <div className="admin-customer-master-approval-list">
                {requestState.pending.map((ev) => {
                  const busy = requestActingId === ev.requestId;
                  return (
                    <article key={ev.requestId} className="admin-customer-master-approval-item">
                      <div className="summary">{requestSummary(ev.payload)}</div>
                      <div className="meta">
                        <span>申請ID: {ev.requestId}</span>
                        <span>申請者: {ev.actorName || 'unknown'}</span>
                        <span>時刻: {ev.at}</span>
                      </div>
                      <div className="actions">
                        <button type="button" className="primary" disabled={busy || saving} onClick={() => approveRequest(ev)}>
                          {busy ? '処理中...' : '承認して反映'}
                        </button>
                        <button type="button" className="danger" disabled={busy || saving} onClick={() => rejectRequest(ev)}>
                          却下
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}

        <section className="admin-customer-master-create" ref={createSectionRef}>
          <h2>{isSalesMode ? '同画面で新規追加（申請）' : '同画面で新規追加'}</h2>
          {isSalesMode ? (
            <div className="admin-customer-master-stepper">
              <div className="admin-customer-master-stepper-head">
                {[1, 2, 3, 4].map((stepNo) => (
                  <span
                    key={`sales-step-${stepNo}`}
                    className={`admin-customer-master-step-pill${salesCreateStep === stepNo ? ' is-active' : ''}${salesCreateStep > stepNo ? ' is-done' : ''}`}
                  >
                    STEP {stepNo}
                  </span>
                ))}
              </div>

              <div className="admin-customer-master-create-card admin-customer-master-step-card">
                {salesCreateStep === 1 ? (
                  <>
                    <h3>新規顧客ですか？既存顧客ですか？</h3>
                    <div className="admin-customer-master-step-choice">
                      <button
                        type="button"
                        className={`choice-btn${salesCustomerType === 'new' ? ' is-active' : ''}`}
                        onClick={() => {
                          setSalesCustomerType('new');
                          setSalesExistingTorihikisakiId('');
                          setSalesExistingSearch('');
                          setCreateDraft((p) => ({
                            ...p,
                            yagou_torihikisaki_id: '',
                            tenpo_torihikisaki_id: '',
                          }));
                        }}
                      >
                        新規顧客
                      </button>
                      <button
                        type="button"
                        className={`choice-btn${salesCustomerType === 'existing' ? ' is-active' : ''}`}
                        onClick={() => {
                          setSalesCustomerType('existing');
                          setSalesExistingSearch('');
                          setCreateDraft((p) => ({
                            ...p,
                            kokyaku_name: '',
                            torihikisaki_name: '',
                          }));
                        }}
                      >
                        既存顧客
                      </button>
                    </div>

                    {salesCustomerType === 'new' ? (
                      <>
                        <div className="admin-customer-master-auto-id">
                          <span>取引先ID（自動採番）</span>
                          <strong>{nextIdPreview.torihikisaki}</strong>
                        </div>
                        <label className="admin-master-field">
                          <span>顧客名（取引先名と共通）</span>
                          <input
                            value={createDraft.kokyaku_name}
                            onChange={(e) => {
                              const name = e.target.value;
                              setCreateDraft((p) => ({ ...p, kokyaku_name: name, torihikisaki_name: name }));
                            }}
                            placeholder="例）株式会社〇〇"
                          />
                        </label>
                      </>
                    ) : null}

                    {salesCustomerType === 'existing' ? (
                      <>
                        <label className="admin-master-field">
                          <span>統合検索（顧客 / 取引先 / 屋号 / 店舗）</span>
                          <input
                            value={salesExistingSearch}
                            onChange={(e) => setSalesExistingSearch(e.target.value)}
                            placeholder="例）取引先名 / 屋号 / 店舗 / ID"
                          />
                        </label>
                        <label className="admin-master-field">
                          <span>既存取引先</span>
                          <select
                            value={salesExistingTorihikisakiId}
                            onChange={(e) => {
                              const nextId = norm(e.target.value);
                              const picked = torihikisakiById.get(nextId);
                              setSalesExistingTorihikisakiId(nextId);
                              setCreateDraft((p) => ({
                                ...p,
                                kokyaku_name: norm(picked?.kokyaku_name || ''),
                                torihikisaki_name: norm(picked?.name || ''),
                                yagou_torihikisaki_id: nextId,
                                tenpo_torihikisaki_id: nextId,
                              }));
                            }}
                          >
                            <option value="">選択してください</option>
                            {filteredSalesTorihikisakiOptions.map((it) => (
                              <option key={it.id} value={it.id}>
                                {it.id} / {it.name || '(名称未設定)'}
                              </option>
                            ))}
                          </select>
                        </label>
                      </>
                    ) : null}
                  </>
                ) : null}

                {salesCreateStep === 2 ? (
                  <>
                    <h3>屋号登録</h3>
                    <label className="admin-master-field">
                      <span>屋号名</span>
                      <input
                        value={createDraft.yagou_name}
                        onChange={(e) => setCreateDraft((p) => ({ ...p, yagou_name: e.target.value }))}
                        placeholder="例）〇〇ブランド"
                      />
                    </label>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setCreateDraft((p) => ({ ...p, yagou_name: salesTorihikisakiBaseName }))}
                      disabled={!salesTorihikisakiBaseName}
                    >
                      屋号がない場合は取引先と同じにする
                    </button>
                  </>
                ) : null}

                {salesCreateStep === 3 ? (
                  <>
                    <h3>店舗登録</h3>
                    <label className="admin-master-field">
                      <span>店舗名</span>
                      <input
                        value={createDraft.tenpo_name}
                        onChange={(e) => setCreateDraft((p) => ({ ...p, tenpo_name: e.target.value }))}
                        placeholder="例）渋谷店"
                      />
                    </label>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setCreateDraft((p) => ({ ...p, tenpo_name: norm(p.yagou_name) }))}
                      disabled={!norm(createDraft.yagou_name)}
                    >
                      店舗がない場合は屋号と同じにする
                    </button>
                  </>
                ) : null}

                {salesCreateStep === 4 ? (
                  <>
                    <h3>申請内容確認</h3>
                    <div className="admin-customer-master-step-summary">
                      <div><span>顧客区分</span><strong>{salesCustomerType === 'existing' ? '既存顧客' : '新規顧客'}</strong></div>
                      <div><span>顧客名</span><strong>{createDraft.kokyaku_name || selectedSalesTorihikisaki?.kokyaku_name || '-'}</strong></div>
                      <div><span>取引先名</span><strong>{createDraft.torihikisaki_name || selectedSalesTorihikisaki?.name || '-'}</strong></div>
                      <div><span>屋号名</span><strong>{createDraft.yagou_name || '-'}</strong></div>
                      <div><span>店舗名</span><strong>{createDraft.tenpo_name || '-'}</strong></div>
                    </div>
                  </>
                ) : null}
              </div>

              <div className="admin-customer-master-step-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setSalesCreateStep((prev) => Math.max(1, prev - 1))}
                  disabled={salesCreateStep <= 1 || creatingKind === 'sales_bundle'}
                >
                  戻る
                </button>

                {salesCreateStep < 4 ? (
                  <button
                    type="button"
                    className="primary"
                    onClick={() => setSalesCreateStep((prev) => Math.min(4, prev + 1))}
                    disabled={
                      creatingKind === 'sales_bundle' ||
                      (salesCreateStep === 1 && !salesStep1Ready) ||
                      (salesCreateStep === 2 && !salesStep2Ready) ||
                      (salesCreateStep === 3 && !salesStep3Ready)
                    }
                  >
                    次へ
                  </button>
                ) : (
                  <button
                    type="button"
                    className="primary"
                    onClick={submitSalesBundleRequest}
                    disabled={creatingKind === 'sales_bundle' || !salesStep3Ready}
                  >
                    {creatingKind === 'sales_bundle' ? '申請中...' : '申請する'}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="admin-customer-master-create-grid">
              <div className="admin-customer-master-create-card">
                <h3>顧客 / 取引先を追加</h3>
                <div className="admin-customer-master-auto-id">
                  <span>取引先ID（自動採番）</span>
                  <strong>{nextIdPreview.torihikisaki}</strong>
                </div>
                <label className="admin-master-field">
                  <span>顧客名（取引先名と共通）</span>
                  <input
                    value={createDraft.kokyaku_name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setCreateDraft((p) => ({ ...p, kokyaku_name: name, torihikisaki_name: name }));
                    }}
                    placeholder="例）株式会社〇〇"
                  />
                </label>
                <button
                  type="button"
                  className="primary"
                  onClick={createTorihikisaki}
                  disabled={creatingKind === 'torihikisaki'}
                >
                  {creatingKind === 'torihikisaki' ? '追加中...' : '顧客/取引先追加'}
                </button>
              </div>

              <div className="admin-customer-master-create-card">
                <h3>屋号を追加</h3>
                <div className="admin-customer-master-auto-id">
                  <span>屋号ID（自動採番）</span>
                  <strong>{nextIdPreview.yagou}</strong>
                </div>
                <label className="admin-master-field">
                  <span>取引先ID（任意）</span>
                  <select
                    value={createDraft.yagou_torihikisaki_id}
                    onChange={(e) => setCreateDraft((p) => ({ ...p, yagou_torihikisaki_id: e.target.value }))}
                  >
                    <option value="">未選択</option>
                    {torihikisakiOptions.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.id} / {it.name || '(名称未設定)'}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="admin-master-field">
                  <span>屋号名</span>
                  <input
                    value={createDraft.yagou_name}
                    onChange={(e) => setCreateDraft((p) => ({ ...p, yagou_name: e.target.value }))}
                    placeholder="例）〇〇ブランド"
                  />
                </label>
                <button
                  type="button"
                  className="primary"
                  onClick={createYagou}
                  disabled={creatingKind === 'yagou'}
                >
                  {creatingKind === 'yagou' ? '追加中...' : '屋号追加'}
                </button>
              </div>

              <div className="admin-customer-master-create-card">
                <h3>店舗を追加</h3>
                <div className="admin-customer-master-auto-id">
                  <span>店舗ID（自動採番）</span>
                  <strong>{nextIdPreview.tenpo}</strong>
                </div>
                <label className="admin-master-field">
                  <span>取引先ID（任意）</span>
                  <select
                    value={createDraft.tenpo_torihikisaki_id}
                    onChange={(e) => setCreateDraft((p) => ({ ...p, tenpo_torihikisaki_id: e.target.value }))}
                  >
                    <option value="">未選択</option>
                    {torihikisakiOptions.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.id} / {it.name || '(名称未設定)'}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="admin-master-field">
                  <span>屋号ID（任意）</span>
                  <select
                    value={createDraft.tenpo_yagou_id}
                    onChange={(e) => setCreateDraft((p) => ({ ...p, tenpo_yagou_id: e.target.value }))}
                  >
                    <option value="">未選択</option>
                    {yagouOptions
                      .filter((it) => !norm(createDraft.tenpo_torihikisaki_id) || norm(it.torihikisaki_id) === norm(createDraft.tenpo_torihikisaki_id))
                      .map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.id} / {it.name || '(名称未設定)'}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="admin-master-field">
                  <span>店舗名</span>
                  <input
                    value={createDraft.tenpo_name}
                    onChange={(e) => setCreateDraft((p) => ({ ...p, tenpo_name: e.target.value }))}
                    placeholder="例）渋谷店"
                  />
                </label>
                <button
                  type="button"
                  className="primary"
                  onClick={createTenpo}
                  disabled={creatingKind === 'tenpo'}
                >
                  {creatingKind === 'tenpo' ? '追加中...' : '店舗追加'}
                </button>
              </div>
            </div>
          )}
        </section>

        {!isSalesMode ? (
          <section className="admin-master-toolbar admin-customer-master-toolbar">
            <label className="admin-customer-master-search">
              <span>統合検索</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="顧客 / 取引先 / 屋号 / 店舗 / ID / 住所 / 電話"
              />
            </label>
            <div className="admin-master-header-actions">
              <button type="button" className={viewMode === 'all' ? 'primary' : ''} onClick={() => setViewMode('all')}>
                全件
              </button>
              <button type="button" className={viewMode === 'gap' ? 'primary' : ''} onClick={() => setViewMode('gap')}>
                未紐付け
              </button>
              <button type="button" className={viewMode === 'duplicate' ? 'primary' : ''} onClick={() => setViewMode('duplicate')}>
                重複候補
              </button>
              <button
                type="button"
                className="danger"
                onClick={deleteSelected}
                disabled={saving || selectedRows.length === 0}
              >
                {saving ? '処理中...' : '削除'}
              </button>
            </div>
            <div className="admin-master-count">表示件数: {sortedRows.length} / 選択: {selectedRows.length} / 全体: {rows.length}</div>
          </section>
        ) : null}

        {!isSalesMode ? (
          <section className="admin-master-table-wrap">
            <table className="admin-master-table">
              <thead>
                <tr>
                  <th className="bulk-check-col">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={(e) => toggleAllVisible(e.target.checked)}
                      aria-label="全件選択"
                    />
                  </th>
                  <th>
                    <button type="button" className={`admin-master-sort-btn${sortKey === 'kokyaku' ? ' is-active' : ''}`} onClick={() => handleSort('kokyaku')}>
                      顧客(kokyaku)
                      <span className="sort-indicator">{sortMark('kokyaku')}</span>
                    </button>
                  </th>
                  <th>
                    <button type="button" className={`admin-master-sort-btn${sortKey === 'torihikisaki' ? ' is-active' : ''}`} onClick={() => handleSort('torihikisaki')}>
                      取引先
                      <span className="sort-indicator">{sortMark('torihikisaki')}</span>
                    </button>
                  </th>
                  <th>
                    <button type="button" className={`admin-master-sort-btn${sortKey === 'yagou' ? ' is-active' : ''}`} onClick={() => handleSort('yagou')}>
                      屋号
                      <span className="sort-indicator">{sortMark('yagou')}</span>
                    </button>
                  </th>
                  <th>
                    <button type="button" className={`admin-master-sort-btn${sortKey === 'tenpo' ? ' is-active' : ''}`} onClick={() => handleSort('tenpo')}>
                      店舗
                      <span className="sort-indicator">{sortMark('tenpo')}</span>
                    </button>
                  </th>
                  <th>
                    <button type="button" className={`admin-master-sort-btn${sortKey === 'phone' ? ' is-active' : ''}`} onClick={() => handleSort('phone')}>
                      電話
                      <span className="sort-indicator">{sortMark('phone')}</span>
                    </button>
                  </th>
                  <th>
                    <button type="button" className={`admin-master-sort-btn${sortKey === 'status' ? ' is-active' : ''}`} onClick={() => handleSort('status')}>
                      状態
                      <span className="sort-indicator">{sortMark('status')}</span>
                    </button>
                  </th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={8} className="empty">データがありません</td>
                  </tr>
                ) : null}
                {sortedRows.map((row) => (
                  <tr key={row.key}>
                    <td className="bulk-check-col" data-col="選択">
                      <input
                        type="checkbox"
                        checked={selectedKeys.has(row.key)}
                        onChange={(e) => toggleRowSelected(row.key, e.target.checked)}
                        aria-label={`${row.tenpo_name || row.yagou_name || row.torihikisaki_name || row.key} を選択`}
                      />
                    </td>
                    <td data-col="顧客(kokyaku)">
                      <div>{row.kokyaku_name || ''}</div>
                    </td>
                    <td data-col="取引先">
                      <div>{row.torihikisaki_name || ''}</div>
                      <IdTag value={row.torihikisaki_id} kind="torihikisaki" />
                    </td>
                    <td data-col="屋号">
                      <div>{row.yagou_name || ''}</div>
                      <IdTag value={row.yagou_id} kind="yagou" />
                    </td>
                    <td data-col="店舗">
                      <div>{row.tenpo_name || ''}</div>
                      <IdTag value={row.tenpo_id} kind="tenpo" />
                    </td>
                    <td data-col="電話">{row.tenpo_phone || ''}</td>
                    <td data-col="状態">
                      {rowQuality.get(row.key)?.hasLinkGap ? <small>未紐付けあり</small> : null}
                      {rowQuality.get(row.key)?.isDuplicate ? <small>重複候補</small> : null}
                      {!rowQuality.get(row.key)?.hasLinkGap && !rowQuality.get(row.key)?.isDuplicate ? <small>正常</small> : null}
                    </td>
                    <td className="actions" data-col="操作">
                      <button type="button" onClick={() => openEdit(row)}>編集</button>
                      {row.tenpo_id ? (
                        <Link to={`/admin/tenpo/${encodeURIComponent(row.tenpo_id)}?mode=monshin`} className="link">カルテ</Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}
      </div>

      {editing ? (
        <>
          <div className="admin-master-modal-backdrop" onClick={closeEdit} />
          <section className="admin-master-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="admin-master-inline-editor-title">{isSalesMode ? '顧客マスタ申請編集' : '顧客マスタ編集'}</h2>
            <div className="admin-master-input-mode">
              <div className="admin-master-input-mode-head">入力モード</div>
              <div className="admin-master-input-mode-switch" role="tablist" aria-label="入力モード切替">
                <button
                  type="button"
                  role="tab"
                  aria-selected={!editing._manualInput}
                  className={!editing._manualInput ? 'is-active' : ''}
                  onClick={() => setEditing((p) => ({ ...p, _manualInput: false }))}
                >
                  構造化入力（推奨）
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={Boolean(editing._manualInput)}
                  className={editing._manualInput ? 'is-active warning' : 'warning'}
                  onClick={() => setEditing((p) => ({ ...p, _manualInput: true }))}
                >
                  自由入力
                </button>
              </div>
              <div className={`admin-master-input-mode-note${editing._manualInput ? ' is-warning' : ''}`}>
                {editing._manualInput
                  ? '自由入力中: IDや紐付けを手動変更できます。誤入力に注意してください。'
                  : '構造化入力中: 候補選択ベースで安全に編集できます。'}
              </div>
            </div>
            <div className="admin-master-modal-grid">
              <label className="admin-master-field">
                <span>顧客名(kokyaku)</span>
                <input
                  value={editing.kokyaku_name || ''}
                  readOnly={!editing._manualInput && editing.kind !== 'torihikisaki'}
                  onChange={(e) => setEditing((p) => ({ ...p, kokyaku_name: e.target.value }))}
                />
              </label>
              <label className="admin-master-field">
                <span>取引先ID</span>
                {editing._manualInput ? (
                  <input
                    value={editing.torihikisaki_id || ''}
                    onChange={(e) => setEditing((p) => ({ ...p, torihikisaki_id: e.target.value }))}
                  />
                ) : (
                  <select
                    value={editing.torihikisaki_id || ''}
                    disabled={editing.kind === 'torihikisaki'}
                    onChange={(e) => onTorihikisakiChange(e.target.value)}
                  >
                    <option value="">未選択</option>
                    {torihikisakiOptions.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.id} / {it.name || '(名称未設定)'}
                      </option>
                    ))}
                  </select>
                )}
              </label>
              <label className="admin-master-field">
                <span>取引先名</span>
                <input
                  value={editing.torihikisaki_name || ''}
                  readOnly={!editing._manualInput && editing.kind !== 'torihikisaki'}
                  onChange={(e) => setEditing((p) => ({ ...p, torihikisaki_name: e.target.value }))}
                />
              </label>
              <label className="admin-master-field">
                <span>屋号ID</span>
                {editing._manualInput ? (
                  <input
                    value={editing.yagou_id || ''}
                    onChange={(e) => setEditing((p) => ({ ...p, yagou_id: e.target.value }))}
                  />
                ) : (
                  <select
                    value={editing.yagou_id || ''}
                    disabled={editing.kind !== 'tenpo'}
                    onChange={(e) => onYagouChange(e.target.value)}
                  >
                    <option value="">未選択</option>
                    {yagouOptions
                      .filter((it) => !norm(editing.torihikisaki_id) || norm(it.torihikisaki_id) === norm(editing.torihikisaki_id))
                      .map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.id} / {it.name || '(名称未設定)'}
                        </option>
                      ))}
                  </select>
                )}
              </label>
              <label className="admin-master-field">
                <span>屋号名</span>
                <input
                  value={editing.yagou_name || ''}
                  readOnly={!editing._manualInput && editing.kind !== 'yagou'}
                  onChange={(e) => setEditing((p) => ({ ...p, yagou_name: e.target.value }))}
                />
              </label>
              <label className="admin-master-field">
                <span>店舗ID</span>
                <input value={editing.tenpo_id || ''} readOnly />
              </label>
              <label className="admin-master-field">
                <span>店舗名</span>
                <input value={editing.tenpo_name || ''} onChange={(e) => setEditing((p) => ({ ...p, tenpo_name: e.target.value }))} />
              </label>
              <label className="admin-master-field">
                <span>住所</span>
                <input value={editing.tenpo_address || ''} onChange={(e) => setEditing((p) => ({ ...p, tenpo_address: e.target.value }))} />
              </label>
              <label className="admin-master-field">
                <span>電話</span>
                <input value={editing.tenpo_phone || ''} onChange={(e) => setEditing((p) => ({ ...p, tenpo_phone: e.target.value }))} />
              </label>
              <label className="admin-master-field">
                <span>担当者</span>
                <input value={editing.tenpo_tantou_name || ''} onChange={(e) => setEditing((p) => ({ ...p, tenpo_tantou_name: e.target.value }))} />
              </label>
              <label className="admin-master-field">
                <span>メール</span>
                <input value={editing.tenpo_email || ''} onChange={(e) => setEditing((p) => ({ ...p, tenpo_email: e.target.value }))} />
              </label>
            </div>
            <div className="admin-master-modal-actions">
              <button type="button" onClick={closeEdit} disabled={saving}>キャンセル</button>
              <button type="button" className="primary" onClick={saveEdit} disabled={saving}>
                {saving ? '保存中...' : (isSalesMode ? '申請' : '保存')}
              </button>
            </div>
          </section>
        </>
      ) : null}

      {isSalesMode ? (
        <div className="sales-mobile-hotbar-anchor" aria-label="営業HOTバー">
          <Hotbar
            actions={SALES_HOTBAR}
            active={salesHotbarActive}
            onChange={handleSalesHotbarChange}
            showFlowGuideButton={false}
          />
        </div>
      ) : null}
    </div>
  );
}
