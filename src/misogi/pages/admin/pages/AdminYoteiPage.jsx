import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import './admin-yotei.css';
import { normalizeGatewayBase, YOTEI_GATEWAY } from '../../shared/api/gatewayBase';

function isLocalUiHost() {
  if (typeof window === 'undefined') return false;
  const h = window.location?.hostname || '';
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
}

const IS_LOCAL = import.meta.env?.DEV || isLocalUiHost();
const API_BASE = IS_LOCAL
  ? '/api'
  : normalizeGatewayBase(import.meta.env?.VITE_API_BASE, YOTEI_GATEWAY);

const TIMELINE_START_HOUR = 16;
const TIMELINE_END_HOUR_NEXT_DAY = 4;
const TOTAL_MINUTES = ((24 - TIMELINE_START_HOUR) + TIMELINE_END_HOUR_NEXT_DAY) * 60; // 720

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

function dateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(yyyyMmDd, days) {
  const d = new Date(`${yyyyMmDd}T00:00:00`);
  d.setDate(d.getDate() + days);
  return dateStr(d);
}

function hhmmToMinutes(hhmm) {
  const [h, m] = String(hhmm || '00:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToHHMM(v) {
  const n = Math.max(0, Number(v) || 0);
  const h = Math.floor(n / 60) % 24;
  const m = n % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function toIsoFromBizDateAndTime(bizDate, hhmm) {
  const min = hhmmToMinutes(hhmm);
  const h = Math.floor(min / 60);
  const day = h < 4 ? addDays(bizDate, 1) : bizDate;
  return `${day}T${minutesToHHMM(min)}:00+09:00`;
}

function timelineMinuteFromIso(iso) {
  const d = new Date(iso || '');
  if (Number.isNaN(d.getTime())) return 0;
  const h = d.getHours();
  const m = d.getMinutes();
  if (h >= TIMELINE_START_HOUR) return ((h - TIMELINE_START_HOUR) * 60) + m;
  return (((h + 24) - TIMELINE_START_HOUR) * 60) + m;
}

function normalizeYoteiList(payload) {
  const list = Array.isArray(payload) ? payload : (payload?.items || payload?.yotei || payload?.rows || []);
  return list.map((v) => ({
    id: v.id || v.yotei_id || '',
    yotei_id: v.yotei_id || v.id || '',
    yakusoku_id: v.yakusoku_id || '',
    tenpo_id: v.tenpo_id || v.store_id || '',
    tenpo_name: v.tenpo_name || v.store_name || v.target_name || '',
    sagyouin_id: v.sagyouin_id || v.worker_id || v.assigned_to || v.cleaner_id || v.user_id || '',
    sagyouin_name: v.sagyouin_name || v.worker_name || v.assignee_name || v.cleaner_name || v.user_name || '',
    start_at: v.start_at || '',
    end_at: v.end_at || '',
    work_type: v.work_type || v.service_name || v.service_id || '作業',
    jotai: String(v.jotai || v.status || 'planned'),
    memo: v.memo || '',
    updated_at: v.updated_at || v.created_at || '',
  })).filter((v) => v.yotei_id);
}

function canonicalSagyouinId(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  // 例: SAGYOUIN#W002 -> W002
  const p = s.split('#');
  return p[p.length - 1].toUpperCase();
}

function normalizeUgokiList(payload) {
  return asList(payload).map((v) => ({
    id: v.yotei_id || v.id || '',
    yotei_id: v.yotei_id || v.id || '',
    sagyouin_id: v.sagyouin_id || v.worker_id || '',
    sagyouin_name: v.sagyouin_name || v.worker_name || '',
    tenpo_name: v.tenpo_name || v.store_name || '',
    start_at: v.start_at || '',
    end_at: v.end_at || '',
    jotai: String(v.jotai || 'mikanryo'),
    updated_at: v.updated_at || '',
  })).filter((v) => v.yotei_id);
}

function normalizeYakusokuPanel(payload) {
  return asList(payload).map((v) => ({
    id: v.yakusoku_id || v.id || '',
    tenpo_name: v.tenpo_name || v.store_name || '',
    kubun: v.kubun || v.type || 'teiki',
    plan_name: v.plan_name || v.name || 'プラン',
    status: v.status || 'active',
    quota_monthly: Number(v.quota_monthly || v.monthly_quota || 0) || 0,
    consumption_count: v.consumption_count || {},
    unit_price: Number(v.unit_price || v.price || 0) || 0,
  })).filter((v) => v.id);
}

function normalizeUgokiMap(payload) {
  const list = Array.isArray(payload) ? payload : (payload?.items || payload?.ugoki || payload?.rows || []);
  const map = new Map();
  list.forEach((v) => {
    const id = v.yotei_id || v.id;
    if (!id) return;
    const jotaiRaw = String(v.jotai || '').toLowerCase();
    const jotai = (jotaiRaw === 'kanryou' || jotaiRaw === 'shinkou' || jotaiRaw === 'mikanryo')
      ? jotaiRaw
      : 'mikanryo';
    map.set(id, {
      jotai,
      updated_at: v.updated_at || '',
      reason_code: v.reason_code || '',
    });
  });
  return map;
}

function colorClass(appt, nowMs) {
  const base = String(appt.ugoki_jotai || appt.jotai || '').toLowerCase();
  if (base === 'torikeshi') return 'status-torikeshi';
  if (base === 'kanryou') return 'status-kanryou';
  if (base === 'shinkou') return 'status-shinkou';
  if (base === 'mikanryo') {
    const startMs = Date.parse(appt.start_at || '');
    const refMs = Date.parse(appt.ugoki_updated_at || appt.updated_at || '');
    if (Number.isFinite(startMs) && nowMs > startMs + 30 * 60 * 1000 && (!Number.isFinite(refMs) || nowMs - refMs > 30 * 60 * 1000)) {
      return 'status-delay';
    }
    return 'status-mikanryo';
  }
  if (base === 'planned') return 'status-planned';
  return 'status-planned';
}

function overlaps(aStartIso, aEndIso, bStartIso, bEndIso) {
  const aS = Date.parse(aStartIso || '');
  const aE = Date.parse(aEndIso || '');
  const bS = Date.parse(bStartIso || '');
  const bE = Date.parse(bEndIso || '');
  if (![aS, aE, bS, bE].every(Number.isFinite)) return false;
  return aS < bE && aE > bS;
}

function YoteiToolbar({ date, setDate, search, setSearch, onRefresh, onCreate }) {
  return (
    <div className="yotei-toolbar">
      <label>
        日付
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label className="grow">
        店舗検索
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="店舗名で絞り込み" />
      </label>
      <button type="button" onClick={onCreate}>＋ 新規予定</button>
      <button type="button" onClick={onRefresh}>更新</button>
    </div>
  );
}

function YoteiCard({ item, onEdit }) {
  const start = new Date(item.start_at || '');
  const end = new Date(item.end_at || '');
  const timeText = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')} - ${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
  return (
    <button type="button" className={`yotei-card ${item.colorClass}`} onClick={() => onEdit(item)}>
      <div className="line1">{item.tenpo_name || item.tenpo_id || '店舗未設定'}</div>
      <div className="line2">{timeText}</div>
      <div className="line3">{item.work_type || '作業'}</div>
    </button>
  );
}

function YoteiTimelineGrid({ rows, onEdit }) {
  const ticks = useMemo(() => {
    const out = [];
    for (let h = 16; h <= 27; h += 1) {
      const labelHour = h >= 24 ? h - 24 : h;
      out.push({ h, label: `${String(labelHour).padStart(2, '0')}:00` });
    }
    return out;
  }, []);

  return (
    <section className="yotei-grid-wrap">
      <div className="yotei-grid-head">
        <div>作業員</div>
        <div className="timeline-head">
          {ticks.map((t) => <span key={t.h}>{t.label}</span>)}
        </div>
      </div>
      {rows.map((row) => (
        <div className="yotei-grid-row" key={row.sagyouin_id}>
          <div className="worker-cell">
            <strong>{row.sagyouin_name || row.sagyouin_id}</strong>
            <small>{row.sagyouin_id}</small>
          </div>
          <div className="timeline-cell">
            {row.items.map((item) => {
              const leftPct = Math.max(0, Math.min(100, (item.start_min / TOTAL_MINUTES) * 100));
              const widthPct = Math.max(0.8, Math.min(100, ((item.end_min - item.start_min) / TOTAL_MINUTES) * 100));
              return (
                <div key={item.yotei_id} className="yotei-pos" style={{ left: `${leftPct}%`, width: `${widthPct}%` }}>
                  <YoteiCard item={item} onEdit={onEdit} />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}

function YoteiEditModal({ open, mode, date, workers, stores, yakusokuList, value, onChange, onClose, onSave, onDelete, busy, error }) {
  if (!open) return null;
  const storeOptions = stores.filter((s) => (s.name || '').includes(value.storeQuery || ''));
  return (
    <div className="yotei-modal-backdrop" onClick={onClose}>
      <div className="yotei-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{mode === 'create' ? '新規予定' : '予定編集'}</h2>
        <div className="yotei-modal-grid">
          <label className="span2">
            yakusoku
            <select value={value.yakusoku_id || ''} onChange={(e) => onChange({ ...value, yakusoku_id: e.target.value })}>
              <option value="">選択なし</option>
              {yakusokuList.map((y) => (
                <option key={y.id} value={y.id}>
                  {`${y.plan_name} / ${y.tenpo_name || y.tenpo_id} / ${y.kubun === 'teiki' ? '定期' : '単発'}`}
                </option>
              ))}
            </select>
            {value.yakusoku_id ? (
              <small className="yotei-yakusoku-meta">
                {(() => {
                  const hit = yakusokuList.find((y) => y.id === value.yakusoku_id);
                  if (!hit) return 'yakusoku情報なし';
                  return `種別: ${hit.kubun === 'teiki' ? '定期' : '単発'}`;
                })()}
              </small>
            ) : null}
          </label>
          <label>
            店舗
            <input
              type="text"
              placeholder="店舗名検索"
              value={value.storeQuery || ''}
              onChange={(e) => onChange({ ...value, storeQuery: e.target.value })}
            />
            <select value={value.tenpo_id || ''} onChange={(e) => onChange({ ...value, tenpo_id: e.target.value })}>
              <option value="">選択してください</option>
              {storeOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label>
            担当者
            <select value={value.sagyouin_id || ''} onChange={(e) => onChange({ ...value, sagyouin_id: e.target.value })}>
              <option value="">選択してください</option>
              {workers.map((w) => <option key={w.id} value={w.id}>{w.name || w.id}</option>)}
            </select>
          </label>
          <label>
            開始時刻
            <input type="time" value={value.start_hhmm || ''} onChange={(e) => onChange({ ...value, start_hhmm: e.target.value })} />
          </label>
          <label>
            終了時刻
            <input type="time" value={value.end_hhmm || ''} onChange={(e) => onChange({ ...value, end_hhmm: e.target.value })} />
          </label>
          <label>
            作業種別
            <input type="text" value={value.work_type || ''} onChange={(e) => onChange({ ...value, work_type: e.target.value })} />
          </label>
          <label>
            メモ
            <textarea rows={3} value={value.memo || ''} onChange={(e) => onChange({ ...value, memo: e.target.value })} />
          </label>
        </div>
        <div className="yotei-modal-note">基準日: {date}（16:00〜翌04:00）</div>
        {error ? <div className="yotei-modal-error">{error}</div> : null}
        <div className="yotei-modal-actions">
          {mode === 'edit' ? <button type="button" className="danger" onClick={onDelete} disabled={busy}>取消</button> : null}
          <button type="button" onClick={onClose} disabled={busy}>閉じる</button>
          <button type="button" className="primary" onClick={onSave} disabled={busy}>{busy ? '保存中…' : '保存'}</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminYoteiPage() {
  const [activeTab, setActiveTab] = useState('yotei');
  const [date, setDate] = useState(dateStr());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [yotei, setYotei] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [stores, setStores] = useState([]);
  const [yakusokuList, setYakusokuList] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [modalValue, setModalValue] = useState({});
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState('');
  const [ugokiTabList, setUgokiTabList] = useState([]);
  const [yakusokuTabList, setYakusokuTabList] = useState([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [tabError, setTabError] = useState('');

  const loadMasters = useCallback(async () => {
    const base = API_BASE.replace(/\/$/, '');
    const headers = { ...authHeaders() };
    const [wRes, sRes, ykRes] = await Promise.all([
      fetch(`${base}/workers?limit=1000`, { headers, cache: 'no-store' }).catch(() => null),
      fetch(`${base}/stores?limit=2000`, { headers, cache: 'no-store' }).catch(() => null),
      fetch(`${base}/yakusoku?limit=1000`, { headers, cache: 'no-store' }).catch(() => null),
    ]);
    if (wRes?.ok) {
      const w = await wRes.json();
      const list = Array.isArray(w) ? w : (w?.items || w?.workers || []);
      setWorkers(list.map((v) => ({
        id: v.sagyouin_id || v.worker_id || v.id,
        name: v.sagyouin_name || v.worker_name || v.name || v.display_name || v.id,
      })).filter((v) => v.id));
    }
    if (sRes?.ok) {
      const s = await sRes.json();
      const list = Array.isArray(s) ? s : (s?.items || s?.stores || []);
      setStores(list.map((v) => ({
        id: v.tenpo_id || v.store_id || v.id,
        name: v.tenpo_name || v.store_name || v.name || v.id,
      })).filter((v) => v.id));
    }
    if (ykRes?.ok) {
      const yk = await ykRes.json();
      const list = asList(yk).map((v) => ({
        id: v.yakusoku_id || v.id,
        tenpo_id: v.tenpo_id || v.store_id || '',
        tenpo_name: v.tenpo_name || v.store_name || '',
        kubun: v.kubun || 'teiki',
        plan_name: v.plan_name || v.name || 'プラン',
      })).filter((v) => v.id);
      setYakusokuList(list);
    }
  }, []);

  const loadYotei = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const base = API_BASE.replace(/\/$/, '');
      const headers = { ...authHeaders() };
      const [yRes, uRes] = await Promise.all([
        fetch(`${base}/yotei?date=${encodeURIComponent(date)}&limit=2000`, { headers, cache: 'no-store' }),
        fetch(`${base}/ugoki?date=${encodeURIComponent(date)}&limit=2000`, { headers, cache: 'no-store' }).catch(() => null),
      ]);
      if (!yRes.ok) throw new Error(`YOTEI HTTP ${yRes.status}`);
      const yData = await yRes.json();
      const yList = normalizeYoteiList(yData);
      const ugokiMap = uRes?.ok ? normalizeUgokiMap(await uRes.json()) : new Map();
      const merged = yList.map((v) => {
        const ug = ugokiMap.get(v.yotei_id);
        return {
          ...v,
          ugoki_jotai: ug?.jotai || 'mikanryo',
          ugoki_updated_at: ug?.updated_at || v.updated_at || '',
          ugoki_reason_code: ug?.reason_code || '',
        };
      });
      setYotei(merged);
    } catch (e) {
      setError(e?.message || '読込エラー');
      setYotei([]);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    loadMasters();
  }, [loadMasters]);

  useEffect(() => {
    loadYotei();
  }, [loadYotei]);

  const loadUgokiTab = useCallback(async () => {
    setTabLoading(true);
    setTabError('');
    try {
      const base = API_BASE.replace(/\/$/, '');
      const res = await fetch(`${base}/ugoki?date=${encodeURIComponent(date)}&limit=2000`, {
        headers: { ...authHeaders() },
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`UGOKI HTTP ${res.status}`);
      setUgokiTabList(normalizeUgokiList(await res.json()));
    } catch (e) {
      setTabError(e?.message || 'UGOKI読込エラー');
      setUgokiTabList([]);
    } finally {
      setTabLoading(false);
    }
  }, [date]);

  const loadYakusokuTab = useCallback(async () => {
    setTabLoading(true);
    setTabError('');
    try {
      const base = API_BASE.replace(/\/$/, '');
      const res = await fetch(`${base}/yakusoku?limit=1000`, {
        headers: { ...authHeaders() },
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`YAKUSOKU HTTP ${res.status}`);
      setYakusokuTabList(normalizeYakusokuPanel(await res.json()));
    } catch (e) {
      setTabError(e?.message || 'YAKUSOKU読込エラー');
      setYakusokuTabList([]);
    } finally {
      setTabLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'ugoki') loadUgokiTab();
    if (activeTab === 'yakusoku') loadYakusokuTab();
  }, [activeTab, loadUgokiTab, loadYakusokuTab]);

  const rows = useMemo(() => {
    const byWorker = new Map();
    const workerNameMap = new Map();
    workers.forEach((w) => {
      workerNameMap.set(canonicalSagyouinId(w.id), w.name || w.id);
    });
    const nowMs = Date.now();
    const source = yotei.filter((v) => {
      const key = `${v.tenpo_name} ${v.tenpo_id}`.toLowerCase();
      return key.includes(search.toLowerCase());
    });
    source.forEach((item) => {
      const rawWorkerId = item.sagyouin_id || '未割当';
      const workerId = canonicalSagyouinId(rawWorkerId) || '未割当';
      if (!byWorker.has(workerId)) {
        const workerName =
          item.sagyouin_name ||
          workerNameMap.get(workerId) ||
          rawWorkerId ||
          workerId;
        byWorker.set(workerId, { sagyouin_id: workerId, sagyouin_name: workerName, items: [] });
      }
      const startMin = timelineMinuteFromIso(item.start_at);
      const endMin = Math.max(startMin + 15, timelineMinuteFromIso(item.end_at));
      byWorker.get(workerId).items.push({
        ...item,
        start_min: startMin,
        end_min: endMin,
        colorClass: colorClass(item, nowMs),
      });
    });
    return Array.from(byWorker.values())
      .map((r) => ({ ...r, items: r.items.sort((a, b) => a.start_min - b.start_min) }))
      .sort((a, b) => a.sagyouin_name.localeCompare(b.sagyouin_name, 'ja'));
  }, [yotei, search, workers]);

  const openCreate = useCallback(() => {
    setModalMode('create');
    setModalValue({
      yakusoku_id: '',
      tenpo_id: '',
      sagyouin_id: '',
      start_hhmm: '16:00',
      end_hhmm: '17:00',
      work_type: '定期清掃',
      memo: '',
      storeQuery: '',
    });
    setModalError('');
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((item) => {
    const s = new Date(item.start_at);
    const e = new Date(item.end_at);
    setModalMode('edit');
    setModalValue({
      id: item.yotei_id,
      yakusoku_id: item.yakusoku_id || '',
      tenpo_id: item.tenpo_id || '',
      sagyouin_id: item.sagyouin_id || '',
      start_hhmm: `${String(s.getHours()).padStart(2, '0')}:${String(s.getMinutes()).padStart(2, '0')}`,
      end_hhmm: `${String(e.getHours()).padStart(2, '0')}:${String(e.getMinutes()).padStart(2, '0')}`,
      work_type: item.work_type || '',
      memo: item.memo || '',
      storeQuery: item.tenpo_name || '',
    });
    setModalError('');
    setModalOpen(true);
  }, []);

  const saveModal = useCallback(async () => {
    const v = modalValue;
    if (!v.yakusoku_id || !v.tenpo_id || !v.sagyouin_id || !v.start_hhmm || !v.end_hhmm) {
      setModalError('案件(yakusoku)・店舗・担当者・開始/終了時刻は必須です');
      return;
    }
    const startAt = toIsoFromBizDateAndTime(date, v.start_hhmm);
    const endAt = toIsoFromBizDateAndTime(date, v.end_hhmm);
    if (Date.parse(startAt) >= Date.parse(endAt)) {
      setModalError('開始時刻は終了時刻より前にしてください');
      return;
    }

    const candidateId = v.id || 'new';
    const targetSagyouin = canonicalSagyouinId(v.sagyouin_id);
    const hasConflict = yotei.some((x) => (
      x.yotei_id !== candidateId &&
      canonicalSagyouinId(x.sagyouin_id) === targetSagyouin &&
      String(x.jotai || '').toLowerCase() !== 'torikeshi' &&
      overlaps(startAt, endAt, x.start_at, x.end_at)
    ));
    if (hasConflict) {
      setModalError('同一作業員の時間重複があります');
      return;
    }

    setModalBusy(true);
    setModalError('');
    try {
      const base = API_BASE.replace(/\/$/, '');
      const body = {
        yakusoku_id: v.yakusoku_id || null,
        tenpo_id: v.tenpo_id,
        sagyouin_id: v.sagyouin_id,
        start_at: startAt,
        end_at: endAt,
        work_type: v.work_type || '作業',
        memo: v.memo || '',
        jotai: 'planned',
      };
      const headers = { 'Content-Type': 'application/json', ...authHeaders() };
      const res = modalMode === 'create'
        ? await fetch(`${base}/yotei`, { method: 'POST', headers, body: JSON.stringify(body) })
        : await fetch(`${base}/yotei/${encodeURIComponent(v.id)}`, { method: 'PUT', headers, body: JSON.stringify(body) });
      if (res.status === 409) {
        const detail = await res.json().catch(() => ({}));
        setModalError(detail?.message || detail?.error || '時間重複で保存できません');
        return;
      }
      if (!res.ok) throw new Error(`YOTEI SAVE HTTP ${res.status}`);
      setModalOpen(false);
      await loadYotei();
    } catch (e) {
      setModalError(e?.message || '保存に失敗しました');
    } finally {
      setModalBusy(false);
    }
  }, [modalValue, date, modalMode, yotei, loadYotei]);

  const deleteModal = useCallback(async () => {
    if (!modalValue?.id) return;
    if (!window.confirm('この予定を取消しますか？')) return;
    setModalBusy(true);
    setModalError('');
    try {
      const base = API_BASE.replace(/\/$/, '');
      const res = await fetch(`${base}/yotei/${encodeURIComponent(modalValue.id)}`, {
        method: 'DELETE',
        headers: { ...authHeaders() },
      });
      if (!res.ok) throw new Error(`YOTEI DELETE HTTP ${res.status}`);
      setModalOpen(false);
      await loadYotei();
    } catch (e) {
      setModalError(e?.message || '取消に失敗しました');
    } finally {
      setModalBusy(false);
    }
  }, [modalValue, loadYotei]);

  return (
    <div className="report-page admin-yotei-page" data-job="admin">
      <div className="report-page-content admin-yotei-content">
        <p className="admin-yotei-back">
          <Link to="/admin/entrance">← 管理トップへ戻る</Link>
        </p>
        <h1>YOTEI 予約管理（病院型）</h1>
        <div className="ops-tabs">
          <button type="button" className={activeTab === 'yotei' ? 'active' : ''} onClick={() => setActiveTab('yotei')}>YOTEI</button>
          <button type="button" className={activeTab === 'ugoki' ? 'active' : ''} onClick={() => setActiveTab('ugoki')}>UGOKI</button>
          <button type="button" className={activeTab === 'yakusoku' ? 'active' : ''} onClick={() => setActiveTab('yakusoku')}>YAKUSOKU</button>
        </div>

        {activeTab === 'yotei' ? (
          <>
            <YoteiToolbar
              date={date}
              setDate={setDate}
              search={search}
              setSearch={setSearch}
              onRefresh={loadYotei}
              onCreate={openCreate}
            />
            {loading ? <div className="yotei-msg">読み込み中…</div> : null}
            {error ? <div className="yotei-err">{error}</div> : null}
            <YoteiTimelineGrid rows={rows} onEdit={openEdit} />
          </>
        ) : null}

        {activeTab === 'ugoki' ? (
          <section className="ops-panel">
            <div className="ops-panel-head">
              <h2>UGOKI 管制</h2>
              <button type="button" onClick={loadUgokiTab}>更新</button>
            </div>
            {tabLoading ? <div className="yotei-msg">読み込み中…</div> : null}
            {tabError ? <div className="yotei-err">{tabError}</div> : null}
            <div className="ops-table">
              <div className="ops-table-head">
                <span>作業員</span><span>店舗</span><span>時刻</span><span>状態</span><span>更新</span>
              </div>
              {ugokiTabList.map((u) => (
                <div key={u.yotei_id} className="ops-table-row">
                  <span>{u.sagyouin_name || u.sagyouin_id || '—'}</span>
                  <span>{u.tenpo_name || '—'}</span>
                  <span>{u.start_at} - {u.end_at}</span>
                  <span>{u.jotai}</span>
                  <span>{u.updated_at || '—'}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {activeTab === 'yakusoku' ? (
          <section className="ops-panel">
            <div className="ops-panel-head">
              <h2>YAKUSOKU 管理</h2>
              <button type="button" onClick={loadYakusokuTab}>更新</button>
            </div>
            {tabLoading ? <div className="yotei-msg">読み込み中…</div> : null}
            {tabError ? <div className="yotei-err">{tabError}</div> : null}
            <div className="ops-table">
              <div className="ops-table-head">
                <span>店舗</span><span>種別</span><span>プラン</span><span>今月 quota/消化/残り</span><span>価格</span><span>状態</span>
              </div>
              {yakusokuTabList.map((k) => {
                const month = `${date.slice(0, 7)}`;
                const used = Number(k.consumption_count?.[month] || 0);
                const quota = Number(k.quota_monthly || 0);
                const remain = Math.max(0, quota - used);
                return (
                  <div key={k.id} className="ops-table-row">
                    <span>{k.tenpo_name || '—'}</span>
                    <span>{k.kubun === 'teiki' ? '定期' : '単発'}</span>
                    <span>{k.plan_name}</span>
                    <span>[{used} / {quota}] 残 {remain}</span>
                    <span>¥{k.unit_price.toLocaleString('ja-JP')}</span>
                    <span>{k.status}</span>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>

      <YoteiEditModal
        open={modalOpen}
        mode={modalMode}
        date={date}
        workers={workers}
        stores={stores}
        yakusokuList={yakusokuList}
        value={modalValue}
        onChange={(next) => {
          const prev = modalValue?.yakusoku_id || '';
          const curr = next?.yakusoku_id || '';
          if (curr && curr !== prev) {
            const hit = yakusokuList.find((y) => y.id === curr);
            if (hit) {
              const workType = `${hit.kubun === 'teiki' ? '定期' : '単発'} / ${hit.plan_name}`;
              setModalValue({ ...next, tenpo_id: hit.tenpo_id || next.tenpo_id, work_type: workType });
              return;
            }
          }
          setModalValue(next);
        }}
        onClose={() => setModalOpen(false)}
        onSave={saveModal}
        onDelete={deleteModal}
        busy={modalBusy}
        error={modalError}
      />
    </div>
  );
}
