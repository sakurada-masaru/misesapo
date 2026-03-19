import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Hotbar from '../Hotbar/Hotbar';
import { SALES_HOTBAR } from '../../../jobs/sales/entrance/hotbar.config';
import '../../../admin/pages/admin-master.css';
import './sales-customer-requests-monthly.css';

function isLocalUiHost() {
  if (typeof window === 'undefined') return false;
  const h = String(window.location?.hostname || '').toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
}

const API_BASE =
  (import.meta.env?.DEV || isLocalUiHost())
    ? '/api-master'
    : (import.meta.env?.VITE_MASTER_API_BASE || 'https://jtn6in2iuj.execute-api.ap-northeast-1.amazonaws.com/prod');

const APPROVAL_ROOM = 'customer_master_approval';
const APPROVAL_CHANNEL = 'customer_master_approval';

function norm(v) {
  return String(v || '').trim();
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

function getItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.rows)) return data.rows;
  return [];
}

function parseRequestEvents(rawRows) {
  return getItems(rawRows)
    .map((row, idx) => {
      const payload = parseDataPayload(row?.data_payload);
      if (norm(payload?.channel) !== APPROVAL_CHANNEL) return null;
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

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function toMonthKey(atMs) {
  if (!Number.isFinite(atMs) || atMs <= 0) return '';
  const d = new Date(atMs);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatDateTime(v) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '-';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}/${m}/${day} ${hh}:${mm}`;
}

export default function SalesCustomerRequestsMonthlyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const actorId = useMemo(() => {
    const v = norm(readActorId());
    return v === 'unknown' ? '' : v;
  }, []);
  const actorName = useMemo(() => {
    const v = norm(readActorName());
    return v === 'unknown' ? '' : v;
  }, []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [month, setMonth] = useState(currentMonthValue);
  const [statusFilter, setStatusFilter] = useState('all');
  const [events, setEvents] = useState([]);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    setOk('');
    try {
      const qs = new URLSearchParams({
        limit: '5000',
        jotai: 'yuko',
        room: APPROVAL_ROOM,
      });
      const data = await apiJson(`/master/admin_chat?${qs.toString()}`);
      setEvents(parseRequestEvents(data));
      setOk('申請履歴を更新しました');
    } catch (e) {
      setError(e?.message || '申請履歴の取得に失敗しました');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const requestRows = useMemo(() => {
    const requestMap = new Map();
    const decisionMap = new Map();
    events.forEach((ev) => {
      if (ev.eventType === 'change_request') requestMap.set(ev.requestId, ev);
      if (ev.eventType === 'change_decision') decisionMap.set(ev.requestId, ev);
    });

    const rows = [];
    requestMap.forEach((reqEv, requestId) => {
      const payload = reqEv?.payload || {};
      if (norm(payload?.action) !== 'create_customer_bundle') return;
      const sid = norm(payload?.sender_id || '');
      const sname = norm(payload?.sender_name || reqEv?.actorName || '');
      const mine = sid
        ? (actorId ? sid === actorId : (actorName ? sname === actorName : false))
        : (actorName ? sname === actorName : false);
      if (!mine) return;

      const decisionEv = decisionMap.get(requestId);
      const reqAt = norm(payload?.sent_at || reqEv?.at);
      const reqAtMs = Date.parse(reqAt);
      const status = decisionEv
        ? (norm(decisionEv?.payload?.decision) === 'approved' ? 'approved' : 'rejected')
        : 'pending';

      rows.push({
        requestId,
        status,
        requestedAt: reqAt,
        requestedAtMs: Number.isFinite(reqAtMs) ? reqAtMs : 0,
        decidedAt: decisionEv?.at || '',
        decidedAtMs: Number.isFinite(decisionEv?.atMs) ? decisionEv.atMs : 0,
        decisionReason: norm(decisionEv?.payload?.reason || ''),
        after: payload?.after || {},
      });
    });

    return rows.sort((a, b) => (b.requestedAtMs || 0) - (a.requestedAtMs || 0));
  }, [events, actorId, actorName]);

  const monthRows = useMemo(() => {
    const filtered = requestRows.filter((row) => toMonthKey(row.requestedAtMs) === month);
    if (statusFilter === 'all') return filtered;
    return filtered.filter((row) => row.status === statusFilter);
  }, [requestRows, month, statusFilter]);

  const summary = useMemo(() => {
    const base = requestRows.filter((row) => toMonthKey(row.requestedAtMs) === month);
    const acc = { all: base.length, pending: 0, approved: 0, rejected: 0 };
    base.forEach((row) => {
      if (row.status === 'pending') acc.pending += 1;
      else if (row.status === 'approved') acc.approved += 1;
      else if (row.status === 'rejected') acc.rejected += 1;
    });
    return acc;
  }, [requestRows, month]);

  const salesHotbarActive = useMemo(() => {
    const path = String(location?.pathname || '');
    if (path.startsWith('/sales/master/customer') || path.startsWith('/sales/clients/list')) return 'customer';
    if (path.startsWith('/sales/inbox') || path.startsWith('/sales/leads')) return 'progress';
    if (path.startsWith('/sales/schedule') || path.startsWith('/sales/tools/customer-requests')) return 'schedule';
    if (path.startsWith('/houkoku')) return 'report';
    return 'schedule';
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

  return (
    <div className="admin-master-page is-sales-mode sales-customer-requests-page">
      <div className="admin-master-content">
        <header className="admin-master-header">
          <div className="sales-customer-requests-head-row">
            <h1>顧客登録申請（月次）</h1>
            <div className="admin-master-header-actions">
              <button type="button" onClick={loadRequests} disabled={loading}>
                {loading ? '更新中...' : '更新'}
              </button>
            </div>
          </div>
          <p className="admin-master-subtitle">営業本人が申請した「顧客登録申請」の月次一覧です。インセンティブ確認に利用します。</p>
          <div className="sales-customer-requests-actor">対象: {actorName || '-'} ({actorId || '-'})</div>
        </header>

        {error ? <div className="admin-master-error">{error}</div> : null}
        {ok ? <div className="admin-master-success">{ok}</div> : null}

        <section className="sales-customer-requests-toolbar">
          <label className="admin-master-field">
            <span>対象月</span>
            <input type="month" value={month} onChange={(e) => setMonth(norm(e.target.value) || currentMonthValue())} />
          </label>
          <label className="admin-master-field">
            <span>状態</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(norm(e.target.value) || 'all')}>
              <option value="all">全て</option>
              <option value="pending">承認待ち</option>
              <option value="approved">承認済み</option>
              <option value="rejected">却下</option>
            </select>
          </label>
        </section>

        <section className="sales-customer-requests-summary">
          <div className="item"><span>申請総数</span><strong>{summary.all}</strong></div>
          <div className="item"><span>承認待ち</span><strong>{summary.pending}</strong></div>
          <div className="item"><span>承認済み</span><strong>{summary.approved}</strong></div>
          <div className="item"><span>却下</span><strong>{summary.rejected}</strong></div>
        </section>

        <section className="sales-customer-requests-list">
          {monthRows.length === 0 ? (
            <div className="sales-customer-requests-empty">該当月の顧客登録申請はありません。</div>
          ) : (
            monthRows.map((row) => {
              const after = row.after || {};
              const kokyaku = norm(after.kokyaku_name || '');
              const tori = norm(after.torihikisaki_name || '');
              const yagou = norm(after.yagou_name || '');
              const tenpo = norm(after.tenpo_name || '');
              const statusLabel = row.status === 'approved' ? '承認済み' : row.status === 'rejected' ? '却下' : '承認待ち';
              return (
                <article key={row.requestId} className={`sales-customer-requests-item status-${row.status}`}>
                  <div className="meta-row">
                    <span className="status-pill">{statusLabel}</span>
                    <span className="dt">申請: {formatDateTime(row.requestedAt)}</span>
                    <span className="id">申請ID: {row.requestId}</span>
                  </div>
                  <div className="info-row">
                    <span className="tag kokyaku">顧客: {kokyaku || '-'}</span>
                    <span className="tag torihikisaki">取引先: {tori || '-'}</span>
                    <span className="tag yagou">屋号: {yagou || '-'}</span>
                    <span className="tag tenpo">店舗: {tenpo || '-'}</span>
                  </div>
                  {row.status !== 'pending' ? (
                    <div className="decision-row">
                      <span>判定: {row.status === 'approved' ? '承認' : '却下'}</span>
                      <span>判定時刻: {formatDateTime(row.decidedAt)}</span>
                      {row.decisionReason ? <span>理由: {row.decisionReason}</span> : null}
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </section>
      </div>

      <div className="sales-mobile-hotbar-anchor" aria-label="営業HOTバー">
        <Hotbar
          actions={SALES_HOTBAR}
          active={salesHotbarActive}
          onChange={handleSalesHotbarChange}
          showFlowGuideButton={false}
        />
      </div>
    </div>
  );
}
