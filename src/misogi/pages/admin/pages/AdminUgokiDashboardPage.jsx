import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import './admin-ugoki-dashboard.css';

function isLocalUiHost() {
  if (typeof window === 'undefined') return false;
  const h = window.location?.hostname || '';
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
}

// UI は常に同一オリジン相対 (/api) を正とする。
const API_BASE = (import.meta.env?.DEV || isLocalUiHost()) ? '/api' : '/api';
const MASTER_API_BASE = (import.meta.env?.DEV || isLocalUiHost()) ? '/api-master' : '/api-master';
const JINZAI_API_BASE = (import.meta.env?.DEV || isLocalUiHost()) ? '/api-jinzai' : '/api-jinzai';

const REASON_OPTIONS = [
  { value: 'NET', label: 'NET' },
  { value: 'DEV', label: 'DEV' },
  { value: 'FORGOT', label: 'FORGOT' },
  { value: 'CHAOS', label: 'CHAOS' },
  { value: 'ADMIN', label: 'ADMIN' },
  { value: 'EMG', label: 'EMG' },
  { value: 'OTHER', label: 'OTHER' },
];
// 当初方針「定型のみ」に合わせ、reason_note は送信しない（UI表示のみ）。
const SEND_REASON_NOTE = false;

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

function todayDateString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function normalizeUgokiJotai(raw) {
  const v = String(raw || '').toLowerCase();
  if (v === 'kanryou' || v === 'done' || v === 'completed') return 'kanryou';
  if (v === 'shinkou' || v === 'shinkouchu' || v === 'working' || v === 'in_progress') return 'shinkou';
  return 'mikanryo';
}

function normalizeJotai(raw) {
  const v = String(raw || '').toLowerCase();
  if (v === 'torikeshi' || v === 'cancelled') return 'torikeshi';
  return 'yuko';
}

function asList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.ugoki)) return payload.ugoki;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
}

function delayMinutes(startAt, nowMs) {
  const t = Date.parse(startAt || '');
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((nowMs - t) / 60000));
}

function warningClass(item, nowMs) {
  if (item.yotei_jotai === 'torikeshi') return 'is-red';
  if (item.jotai === 'kanryou') return 'is-green';
  const d = delayMinutes(item.start_at, nowMs);
  if (d >= 60) return 'is-red';
  if (d >= 30) return 'is-yellow';
  return 'is-white';
}

function buildUgokiPatchPayload({ jotai, reasonCode, reasonNote }) {
  const payload = {
    jotai,
    reason_code: reasonCode,
    override: {
      by: 'admin',
      at: new Date().toISOString(),
      reason_code: reasonCode,
    },
  };
  if (SEND_REASON_NOTE && reasonNote) payload.reason_note = reasonNote;
  return payload;
}

export default function AdminUgokiDashboardPage() {
  const [date, setDate] = useState(todayDateString());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);
  const [tenpoNameMap, setTenpoNameMap] = useState({});
  const [jinzaiNameMap, setJinzaiNameMap] = useState({});
  const [overrideModal, setOverrideModal] = useState(null);
  const [savingOverride, setSavingOverride] = useState(false);
  const [groupMode] = useState('sagyouin');

  const loadNameMasters = useCallback(async () => {
    try {
      const [tenpoRes, jinzaiRes] = await Promise.all([
        fetch(`${MASTER_API_BASE.replace(/\/$/, '')}/master/tenpo?limit=20000&jotai=yuko`, {
          headers: { ...authHeaders() },
          cache: 'no-store',
        }),
        fetch(`${JINZAI_API_BASE.replace(/\/$/, '')}/jinzai?limit=2000&jotai=yuko`, {
          headers: { ...authHeaders() },
          cache: 'no-store',
        }),
      ]);

      if (tenpoRes.ok) {
        const tData = await tenpoRes.json();
        const tItems = asList(tData);
        const map = {};
        tItems.forEach((v) => {
          const id = v?.tenpo_id || v?.id;
          if (!id) return;
          map[id] = v?.name || '';
        });
        setTenpoNameMap(map);
      }

      if (jinzaiRes.ok) {
        const jData = await jinzaiRes.json();
        const jItems = asList(jData);
        const map = {};
        jItems.forEach((v) => {
          const id = v?.jinzai_id || v?.id;
          if (!id) return;
          map[id] = v?.name || '';
        });
        setJinzaiNameMap(map);
      }
    } catch {
      // 名前マスタ取得失敗時はAPIレスポンス内の表示名を使って継続
    }
  }, []);

  const loadUgoki = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const base = API_BASE.replace(/\/$/, '');
      const res = await fetch(`${base}/ugoki?date=${encodeURIComponent(date)}&limit=500`, {
        headers: { ...authHeaders() },
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`UGOKI HTTP ${res.status}`);
      const data = await res.json();
      const normalized = asList(data)
        .map((v) => ({
          id: v.yotei_id || v.id || v.ugoki_id || '',
          yotei_id: v.yotei_id || v.id || v.ugoki_id || '',
          shigoto_id: v.shigoto_id || '',
          sagyouin_id: v.sagyouin_id || v.worker_id || '',
          sagyouin_name: v.sagyouin_name || v.worker_name || v.assignee_name || '',
          tenpo_id: v.tenpo_id || v.store_id || '',
          tenpo_name: v.tenpo_name || v.store_name || v.target_name || '',
          start_at: v.start_at || '',
          end_at: v.end_at || '',
          jotai: normalizeUgokiJotai(v.jotai ?? v.progress ?? v.status),
          yotei_jotai: normalizeJotai(v.yotei_jotai ?? v.yotei_status ?? 'yuko'),
          reason_code: v.reason_code || '',
          reason_note: v.reason_note || '',
          updated_at: v.updated_at || '',
        }))
        .filter((v) => v.id);
      setItems(normalized);
    } catch (e) {
      setError(e?.message || 'ugokiの取得に失敗しました');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    loadNameMasters();
  }, [loadNameMasters]);

  useEffect(() => {
    loadUgoki();
  }, [loadUgoki]);

  const workers = useMemo(() => {
    const map = new Map();
    items.forEach((it) => {
      const key = it.sagyouin_id || 'unknown';
      const displayName =
        it.sagyouin_name ||
        jinzaiNameMap[it.sagyouin_id] ||
        jinzaiNameMap[it.worker_id] ||
        '担当未設定';
      if (!map.has(key)) map.set(key, { id: key, name: displayName, jobs: [] });
      map.get(key).jobs.push(it);
    });
    return Array.from(map.values())
      .map((w) => ({
        ...w,
        jobs: w.jobs.sort((a, b) => Date.parse(a.start_at || '') - Date.parse(b.start_at || '')),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  }, [items, jinzaiNameMap]);

  const warningCounts = useMemo(() => {
    const nowMs = Date.now();
    let w30 = 0;
    let w60 = 0;
    items.forEach((it) => {
      if (it.yotei_jotai !== 'yuko' || it.jotai === 'kanryou') return;
      const d = delayMinutes(it.start_at, nowMs);
      if (d >= 60) w60 += 1;
      else if (d >= 30) w30 += 1;
    });
    return { w30, w60 };
  }, [items]);

  const openOverride = useCallback((item) => {
    setOverrideModal({
      ...item,
      next_jotai: item.jotai,
      next_reason_code: item.reason_code || '',
      next_reason_note: item.reason_note || '',
    });
  }, []);

  const saveOverride = useCallback(async () => {
    if (!overrideModal?.id) return;
    if (!overrideModal.next_reason_code) {
      window.alert('理由（reason_code）を選択してください');
      return;
    }
    setSavingOverride(true);
    try {
      const base = API_BASE.replace(/\/$/, '');
      const body = buildUgokiPatchPayload({
        jotai: overrideModal.next_jotai,
        reasonCode: overrideModal.next_reason_code,
        reasonNote: overrideModal.next_reason_note,
      });
      const res = await fetch(`${base}/ugoki/${encodeURIComponent(overrideModal.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`UGOKI PATCH HTTP ${res.status}`);
      setItems((prev) => prev.map((v) => (
        v.id === overrideModal.id
          ? { ...v, jotai: body.jotai, reason_code: body.reason_code, updated_at: new Date().toISOString() }
          : v
      )));
      setOverrideModal(null);
    } catch (e) {
      window.alert(e?.message || 'override保存に失敗しました');
    } finally {
      setSavingOverride(false);
    }
  }, [overrideModal]);

  const nowMs = Date.now();

  return (
    <div className="report-page admin-ugoki-dashboard-page" data-job="admin">
      <div className="report-page-content admin-ugoki-dashboard-content">
        <p className="admin-ugoki-dashboard-back">
          <Link to="/admin/entrance">← 管理トップへ戻る</Link>
        </p>

        <header className="ugoki-head">
          <h1>管制ダッシュボード（ugoki）</h1>
          <div className="ugoki-head-actions">
            <label>
              業務日
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <button type="button" onClick={loadUgoki} disabled={loading}>
              {loading ? '更新中…' : '更新'}
            </button>
          </div>
        </header>

        <section className="ugoki-group-mode">
          <span>表示グループ:</span>
          <strong>{groupMode === 'sagyouin' ? '作業員（sagyouin）' : groupMode}</strong>
          <small>（将来: han / vendor 切替）</small>
        </section>

        <section className="ugoki-alerts">
          <div className="alert-card is-yellow">30分超過: <strong>{warningCounts.w30}</strong>件</div>
          <div className="alert-card is-red">60分超過: <strong>{warningCounts.w60}</strong>件</div>
          <div className="alert-card is-white">対象件数: <strong>{items.length}</strong>件</div>
        </section>

        {error ? <div className="ugoki-error">API読込エラー: {error}</div> : null}

        <section className="ugoki-grid-wrap">
          <div className="ugoki-grid-head">
            <div>担当（人）</div>
            <div>時間（病院型タイムライン）</div>
          </div>
          {workers.length === 0 ? (
            <div className="ugoki-empty">データがありません</div>
          ) : workers.map((w) => (
            <div key={w.id} className="ugoki-row">
              <div className="ugoki-worker">
                <strong>{w.name || '担当未設定'}</strong>
              </div>
              <div className="ugoki-timeline">
                {w.jobs.map((job) => {
                  const wc = warningClass(job, nowMs);
                  const jobTenpoName = job.tenpo_name || tenpoNameMap[job.tenpo_id] || '店舗未設定';
                  return (
                    <article key={job.id} className={`ugoki-card ${wc}`}>
                      <div className="ugoki-card-main">
                        <div className="ugoki-tenpo">{jobTenpoName}</div>
                        <div className="ugoki-time">{job.start_at} - {job.end_at}</div>
                        <div className="ugoki-meta">
                          <span>jotai: {job.jotai}</span>
                          {delayMinutes(job.start_at, nowMs) >= 60 && job.jotai !== 'kanryou' ? <span className="warn-red">🔴 60+</span> : null}
                          {delayMinutes(job.start_at, nowMs) >= 30 && delayMinutes(job.start_at, nowMs) < 60 && job.jotai !== 'kanryou' ? <span className="warn-yellow">⚠ 30+</span> : null}
                          <span>updated: {job.updated_at || '—'}</span>
                        </div>
                      </div>
                      <button type="button" className="override-btn" onClick={() => openOverride(job)}>
                        override
                      </button>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      </div>

      {overrideModal ? (
        <div className="ugoki-modal-backdrop" onClick={() => setOverrideModal(null)}>
          <div className="ugoki-modal" onClick={(e) => e.stopPropagation()}>
            <h2>管理override</h2>
            <div className="ugoki-modal-grid">
              <label>
                jotai(進捗)
                <select value={overrideModal.next_jotai} onChange={(e) => setOverrideModal((p) => ({ ...p, next_jotai: e.target.value }))}>
                  <option value="mikanryo">mikanryo</option>
                  <option value="shinkou">shinkou</option>
                  <option value="kanryou">kanryou</option>
                </select>
              </label>
              <label>
                reason
                <select value={overrideModal.next_reason_code} onChange={(e) => setOverrideModal((p) => ({ ...p, next_reason_code: e.target.value }))}>
                  {REASON_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </label>
              <label>
                note
                <textarea value={overrideModal.next_reason_note} onChange={(e) => setOverrideModal((p) => ({ ...p, next_reason_note: e.target.value }))} rows={3} />
              </label>
            </div>
            <div className="ugoki-modal-actions">
              <button type="button" onClick={() => setOverrideModal(null)}>閉じる</button>
              <button type="button" className="primary" onClick={saveOverride} disabled={savingOverride}>
                {savingOverride ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
