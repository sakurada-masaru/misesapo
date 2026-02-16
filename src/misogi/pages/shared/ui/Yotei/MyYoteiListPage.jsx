import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import Visualizer from '../Visualizer/Visualizer';
import { apiFetch } from '../../api/client';
import { useAuth } from '../../auth/useAuth';
import { JOBS } from '../../utils/constants';
import SupportHistoryDrawer from '../SupportHistoryDrawer';
import './my-yotei.css';

function fmtDate(d) {
  return dayjs(d).format('YYYY-MM-DD');
}

function safeStr(v) {
  return String(v == null ? '' : v).trim();
}

function normalizeJotai(it) {
  const j = safeStr(it?.jotai || it?.status).toLowerCase();
  return j || 'unknown';
}

function jotaiLabel(j) {
  switch (String(j || '').toLowerCase()) {
    case 'yuko': return '有効';
    case 'planned': return '予定';
    case 'working': return '進行中';
    case 'done': return '完了';
    case 'mikanryo': return '未完了';
    case 'torikeshi': return '取消';
    default: return j || '-';
  }
}

function fmtTime(iso) {
  if (!iso) return '';
  const d = dayjs(iso);
  if (!d.isValid()) return '';
  return d.format('HH:mm');
}

function pillClass(j) {
  const k = String(j || '').toLowerCase();
  if (k === 'torikeshi') return 'pill pill-cancel';
  if (k === 'done') return 'pill pill-done';
  if (k === 'working') return 'pill pill-working';
  if (k === 'planned' || k === 'yuko') return 'pill pill-planned';
  return 'pill';
}

export default function MyYoteiListPage() {
  const { job: jobKey } = useParams();
  const job = (jobKey && JOBS[jobKey]) ? JOBS[jobKey] : null;

  const { isAuthenticated, isLoading: authLoading, getToken, authz } = useAuth();
  const workerId = authz?.workerId || null;

  const [dateISO, setDateISO] = useState(fmtDate(new Date()));
  const [mode, setMode] = useState('week'); // 'day' | 'week'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);

  const [supportOpen, setSupportOpen] = useState(false);
  const [supportTenpoId, setSupportTenpoId] = useState('');
  const [supportTenpoLabel, setSupportTenpoLabel] = useState('');

  const range = useMemo(() => {
    const base = dayjs(dateISO);
    if (!base.isValid()) return { from: fmtDate(new Date()), to: fmtDate(new Date()) };
    if (mode === 'day') {
      const d = base.format('YYYY-MM-DD');
      return { from: d, to: d };
    }
    // week: today + 6 days (simple, not calendar-week)
    return { from: base.format('YYYY-MM-DD'), to: base.add(6, 'day').format('YYYY-MM-DD') };
  }, [dateISO, mode]);

  const authHeaders = useCallback(() => {
    const token = getToken?.();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [getToken]);

  const openSupport = useCallback((tenpoId, tenpoLabel) => {
    const id = safeStr(tenpoId);
    if (!id) return;
    setSupportTenpoId(id);
    setSupportTenpoLabel(safeStr(tenpoLabel));
    setSupportOpen(true);
  }, []);

  const load = useCallback(async () => {
    if (!workerId) return;
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      qs.set('limit', mode === 'day' ? '2000' : '3000');
      qs.set('worker_id', workerId);
      if (range.from === range.to) qs.set('date', range.from);
      else {
        qs.set('from', range.from);
        qs.set('to', range.to);
      }

      const data = await apiFetch(`/yotei?${qs.toString()}`, { headers: authHeaders(), cache: 'no-store' });
      const list = Array.isArray(data) ? data : (data?.items || []);
      setItems(list);
    } catch (e) {
      console.error('[MyYoteiListPage] load failed:', e);
      setError(e?.message || '取得に失敗しました');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [workerId, mode, range.from, range.to, authHeaders]);

  useEffect(() => {
    if (!isAuthenticated || !workerId) return;
    load();
  }, [isAuthenticated, workerId, load]);

  const grouped = useMemo(() => {
    const list = Array.isArray(items) ? items : [];
    const map = new Map();
    list.forEach((it) => {
      const date = safeStr(it?.date || it?.scheduled_date) || (it?.start_at ? dayjs(it.start_at).format('YYYY-MM-DD') : '');
      const key = date || 'unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(it);
    });
    // sort within each day
    for (const [k, arr] of map) {
      arr.sort((a, b) => {
        const as = Date.parse(a?.start_at || '') || 0;
        const bs = Date.parse(b?.start_at || '') || 0;
        return as - bs;
      });
      map.set(k, arr);
    }
    // keep stable order by date asc
    const keys = Array.from(map.keys()).sort((a, b) => {
      if (a === 'unknown') return 1;
      if (b === 'unknown') return -1;
      return a.localeCompare(b);
    });
    return { keys, map };
  }, [items]);

  const totalCount = items?.length || 0;
  const yukoCount = useMemo(() => {
    return (items || []).filter((it) => normalizeJotai(it) !== 'torikeshi').length;
  }, [items]);

  const titleJob = job?.label || safeStr(jobKey) || 'Job';
  const entranceTo = jobKey ? `/jobs/${jobKey}/entrance` : '/';

  if (authLoading) {
    return (
      <div className="report-page" data-job={jobKey || 'unknown'}>
        <div className="report-page-viz"><Visualizer mode="base" /></div>
        <div className="report-page-main">
          <h1 className="report-page-title">YOTEI</h1>
          <p style={{ opacity: 0.7 }}>読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="report-page" data-job={jobKey || 'unknown'}>
        <div className="report-page-viz"><Visualizer mode="base" /></div>
        <div className="report-page-main">
          <h1 className="report-page-title">{titleJob} / YOTEI（タスク）</h1>
          <p style={{ opacity: 0.8 }}>未ログインです。</p>
          <p><Link to="/">Portal へ</Link></p>
        </div>
      </div>
    );
  }

  return (
    <div className="report-page my-yotei-page" data-job={jobKey || 'unknown'}>
      <div className="report-page-viz"><Visualizer mode="base" /></div>

      <div className="report-page-main">
        <div className="my-yotei-head">
          <div className="my-yotei-title">
            <h1 className="report-page-title">{titleJob} / YOTEI（タスク）</h1>
            <div className="my-yotei-sub">
              <span className="my-yotei-sub-strong">{range.from}{range.from !== range.to ? ` .. ${range.to}` : ''}</span>
              <span className="my-yotei-sub-muted">担当: {workerId}</span>
            </div>
          </div>
          <div className="my-yotei-head-actions">
            <Link className="btn btn-secondary" to={entranceTo}>入口へ</Link>
          </div>
        </div>

        <div className="my-yotei-toolbar">
          <div className="my-yotei-toolbar-left">
            <button type="button" className="btn btn-secondary" onClick={() => setDateISO(fmtDate(dayjs(dateISO).subtract(1, 'day')))} disabled={loading}>←</button>
            <input
              type="date"
              value={dateISO}
              onChange={(e) => setDateISO(e.target.value)}
              className="my-yotei-date"
              disabled={loading}
            />
            <button type="button" className="btn btn-secondary" onClick={() => setDateISO(fmtDate(dayjs(dateISO).add(1, 'day')))} disabled={loading}>→</button>
            <button type="button" className="btn btn-secondary" onClick={() => setDateISO(fmtDate(new Date()))} disabled={loading}>今日</button>
          </div>

          <div className="my-yotei-toolbar-right">
            <div className="my-yotei-seg">
              <button type="button" className={mode === 'day' ? 'active' : ''} onClick={() => setMode('day')} disabled={loading}>1日</button>
              <button type="button" className={mode === 'week' ? 'active' : ''} onClick={() => setMode('week')} disabled={loading}>7日</button>
            </div>
            <button type="button" className="btn btn-primary" onClick={load} disabled={loading}>更新</button>
          </div>
        </div>

        <div className="my-yotei-summary">
          <div className="my-yotei-summary-item"><span className="k">件数</span><span className="v">{totalCount}</span></div>
          <div className="my-yotei-summary-item"><span className="k">有効</span><span className="v">{yukoCount}</span></div>
        </div>

        {error ? <div className="my-yotei-error">{error}</div> : null}
        {loading ? <div className="my-yotei-loading">読み込み中...</div> : null}

        {!loading && !error && totalCount === 0 ? (
          <div className="my-yotei-empty">
            この期間に、あなたに割り当てられた予定はありません。
          </div>
        ) : null}

        <div className="my-yotei-list">
          {grouped.keys.map((k) => {
            const arr = grouped.map.get(k) || [];
            const label = k === 'unknown' ? '日付未設定' : dayjs(k).format('M/D(ddd)');
            return (
              <section key={k} className="my-yotei-day">
                <div className="my-yotei-day-head">
                  <div className="my-yotei-day-label">{label}</div>
                  <div className="my-yotei-day-count">{arr.length}件</div>
                </div>
                <div className="my-yotei-cards">
                  {arr.map((it) => {
                    const jotai = normalizeJotai(it);
                    const tenpoName = safeStr(it?.tenpo_name || it?.store_name || it?.target_name);
                    const tenpoId = safeStr(it?.tenpo_id || it?.store_id);
                    const memo = safeStr(it?.memo || it?.notes || it?.description);
                    const workType = safeStr(it?.work_type || it?.type || '');
                    const start = fmtTime(it?.start_at);
                    const end = fmtTime(it?.end_at);
                    const id = safeStr(it?.yotei_id || it?.schedule_id || it?.id);

                    return (
                      <div key={id || `${tenpoId}-${start}-${end}`} className="my-yotei-card">
                        <div className="my-yotei-card-top">
                          <div className="my-yotei-time">
                            <span className="t">{start || '--:--'}</span>
                            <span className="sep">-</span>
                            <span className="t">{end || '--:--'}</span>
                          </div>
                          <div className={pillClass(jotai)} title={jotai}>
                            {jotaiLabel(jotai)}
                          </div>
                        </div>
                        <div className="my-yotei-main">
                          <div className="my-yotei-tenpo">
                            <div className="name">{tenpoName || '(現場未設定)'}</div>
                            <div className="meta">
                              {tenpoId ? <span className="code">{tenpoId}</span> : null}
                              {workType ? <span className="tag">{workType}</span> : null}
                            </div>
                          </div>
                          {memo ? <div className="my-yotei-memo">{memo}</div> : null}
                        </div>
                        {tenpoId ? (
                          <div className="my-yotei-card-actions">
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => openSupport(tenpoId, tenpoName)}
                            >
                              対応履歴
                            </button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <SupportHistoryDrawer
        open={supportOpen}
        onClose={() => setSupportOpen(false)}
        tenpoId={supportTenpoId}
        tenpoLabel={supportTenpoLabel}
        getAuthHeaders={authHeaders}
        canEdit={Boolean(authz?.isAdmin)}
      />
    </div>
  );
}
