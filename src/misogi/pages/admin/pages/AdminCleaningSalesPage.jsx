import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { apiFetch } from '../../shared/api/client';
import { useAuth } from '../../shared/auth/useAuth';
import { normalizeGatewayBase } from '../../shared/api/gatewayBase';
import './admin-cleaning-sales.css';

const REWARD_RATE = 0.8;
const EXCLUDED_STATUS = new Set(['torikeshi']);

function safeStr(v) {
  return String(v == null ? '' : v).trim();
}

function isLocalUiHost() {
  if (typeof window === 'undefined') return false;
  const h = String(window.location?.hostname || '').toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
}

function jinzaiApiBase() {
  if (isLocalUiHost()) return '/api-jinzai';
  return normalizeGatewayBase(import.meta.env?.VITE_JINZAI_API_BASE, 'https://ho3cd7ibtl.execute-api.ap-northeast-1.amazonaws.com/prod');
}

function normalizeComparableId(v) {
  return String(v || '').trim().toLowerCase().replace(/\s+/g, '');
}

function parseAmountCandidates(candidates) {
  for (const v of candidates) {
    if (v == null || v === '') continue;
    const n = Number(String(v).replace(/[^\d.-]/g, ''));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function resolveYoteiUnitPrice(item) {
  return parseAmountCandidates([
    item?.unit_price,
    item?.price,
    item?.amount,
    item?.kingaku,
    item?.total,
    item?.total_amount,
    item?.estimate_amount,
    item?.yotei_amount,
    item?.service_price,
    item?.yakusoku_price,
    item?.uriage_yotei,
    item?.yakusoku?.price,
    item?.yakusoku?.unit_price,
  ]);
}

function formatYen(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return '¥0';
  return `¥${Math.round(n).toLocaleString('ja-JP')}`;
}

function toIdList(v) {
  const normalizeArray = (arr) => (
    (arr || [])
      .map((x) => safeStr(x))
      .filter(Boolean)
  );

  if (Array.isArray(v)) {
    return normalizeArray(
      v.flatMap((x) => {
        if (!x) return [];
        if (typeof x !== 'object') return [x];
        return [
          x?.jinzai_id,
          x?.worker_id,
          x?.sagyouin_id,
          x?.assigned_to,
          x?.cleaner_id,
          x?.user_id,
          x?.id,
        ].filter(Boolean);
      })
    );
  }
  if (v && typeof v === 'object') {
    return normalizeArray([
      v?.jinzai_id,
      v?.worker_id,
      v?.sagyouin_id,
      v?.assigned_to,
      v?.cleaner_id,
      v?.user_id,
      v?.id,
    ].filter(Boolean));
  }
  const s = safeStr(v);
  if (!s) return [];
  if (s.includes(',')) return normalizeArray(s.split(','));
  return normalizeArray([s]);
}

function extractParticipantEntries(item) {
  const out = [];
  const push = (id, name) => {
    const rid = safeStr(id);
    const rname = safeStr(name);
    if (!rid && !rname) return;
    out.push({ id: rid, name: rname });
  };
  const fromList = (v) => {
    if (!Array.isArray(v)) return;
    v.forEach((x) => {
      if (!x) return;
      if (typeof x !== 'object') {
        push(x, '');
        return;
      }
      push(
        x?.jinzai_id || x?.worker_id || x?.sagyouin_id || x?.assigned_to || x?.cleaner_id || x?.user_id || x?.id || '',
        x?.name || x?.jinzai_name || x?.display_name || x?.worker_name || x?.sagyouin_name || ''
      );
    });
  };
  fromList(item?.assignees);
  fromList(item?.participants);
  [
    ...toIdList(item?.jinzai_id),
    ...toIdList(item?.jinzai_ids),
    ...toIdList(item?.worker_id),
    ...toIdList(item?.sagyouin_id),
    ...toIdList(item?.sagyouin_ids),
    ...toIdList(item?.assigned_to),
    ...toIdList(item?.assignee_id),
    ...toIdList(item?.cleaner_id),
    ...toIdList(item?.cleaner_ids),
    ...toIdList(item?.worker_ids),
    ...toIdList(item?.workers),
    ...toIdList(item?.jinzai),
    ...toIdList(item?.worker),
    ...toIdList(item?.sagyouin),
  ].forEach((id) => push(id, ''));
  return out;
}

function displayName(entry, nameMap) {
  const idNorm = normalizeComparableId(entry.id);
  const master = idNorm ? safeStr(nameMap.get(idNorm)) : '';
  return safeStr(entry.name) || master || '-';
}

function emptyDailyStat() {
  return { count: 0, subtotal: 0, reward: 0, workingCount: 0, doneCount: 0 };
}

function isCleaningWorkerRecord(it) {
  const fields = [
    it?.busho,
    it?.department,
    it?.dept,
    it?.shokushu,
    it?.job,
    it?.job_type,
    it?.service,
    it?.role,
    it?.type,
  ].map((v) => safeStr(v).toLowerCase());
  const joined = fields.join(' ');
  return joined.includes('清掃')
    || joined.includes('cleaning')
    || joined.includes('clean')
    || joined.includes('seisou');
}

export default function AdminCleaningSalesPage() {
  const { isAuthenticated, getToken } = useAuth();
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);
  const [nameMap, setNameMap] = useState(new Map());
  const [cleaningWorkers, setCleaningWorkers] = useState([]);

  const authHeader = useMemo(() => {
    const token = getToken?.();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [getToken]);

  const range = useMemo(() => {
    const d = dayjs(`${month}-01`);
    return {
      from: d.startOf('month').format('YYYY-MM-DD'),
      to: d.endOf('month').format('YYYY-MM-DD'),
      daysInMonth: d.daysInMonth(),
    };
  }, [month]);

  const loadJinzaiNames = useCallback(async () => {
    try {
      const base = jinzaiApiBase().replace(/\/$/, '');
      const res = await fetch(`${base}/jinzai?limit=5000&jotai=yuko`, {
        headers: authHeader,
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data?.items || []);
      const nextNameMap = new Map();
      const normalized = (list || []).map((it) => {
        const idNorm = normalizeComparableId(it?.jinzai_id || it?.id);
        const idRaw = safeStr(it?.jinzai_id || it?.id);
        const name = safeStr(it?.name || it?.display_name || it?.jinzai_name);
        if (idNorm && name && !nextNameMap.has(idNorm)) nextNameMap.set(idNorm, name);
        return { raw: it, idNorm, idRaw, name: name || '-' };
      }).filter((it) => it.idNorm);

      const cleaningOnly = normalized.filter((it) => isCleaningWorkerRecord(it.raw));
      const targets = cleaningOnly.length ? cleaningOnly : normalized;
      const workers = targets
        .map((it) => ({ key: it.idNorm, id: it.idRaw || '-', name: it.name || '-' }))
        .sort((a, b) => a.name.localeCompare(b.name, 'ja'));

      setNameMap(nextNameMap);
      setCleaningWorkers(workers);
    } catch {
      // noop
    }
  }, [authHeader]);

  const load = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      qs.set('from', range.from);
      qs.set('to', range.to);
      qs.set('limit', '10000');
      const data = await apiFetch(`/yotei?${qs.toString()}`, { headers: authHeader, cache: 'no-store' });
      const list = Array.isArray(data) ? data : (data?.items || []);
      setItems(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e?.message || '清掃売上データの取得に失敗しました');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [authHeader, isAuthenticated, range.from, range.to]);

  useEffect(() => {
    load();
    loadJinzaiNames();
  }, [load, loadJinzaiNames]);

  const rows = useMemo(() => {
    const targetSet = new Set(cleaningWorkers.map((w) => w.key));
    const salesMap = new Map();
    (items || [])
      .filter((it) => !EXCLUDED_STATUS.has(safeStr(it?.jotai || it?.status).toLowerCase()))
      .forEach((it) => {
        const jotai = safeStr(it?.jotai || it?.status).toLowerCase();
        const dateKey = safeStr(it?.date || it?.scheduled_date || it?.scheduled_for || '');
        const entries = extractParticipantEntries(it);
        if (!entries.length) return;
        const amount = resolveYoteiUnitPrice(it);
        const reward = Math.round(amount * REWARD_RATE);
        const seen = new Set();
        entries.forEach((entry) => {
          const idNorm = normalizeComparableId(entry.id || entry.name);
          if (!idNorm || seen.has(idNorm)) return;
          seen.add(idNorm);
          if (targetSet.size > 0 && !targetSet.has(idNorm)) return;
          const baseWorker = cleaningWorkers.find((w) => w.key === idNorm);
          const current = salesMap.get(idNorm) || {
            key: idNorm,
            id: baseWorker?.id || safeStr(entry.id) || '-',
            name: baseWorker?.name || displayName(entry, nameMap),
            count: 0,
            subtotal: 0,
            reward: 0,
            workingCount: 0,
            doneCount: 0,
            daily: {},
          };
          current.count += 1;
          current.subtotal += amount;
          current.reward += reward;
          if (jotai === 'working') current.workingCount += 1;
          if (jotai === 'done') current.doneCount += 1;
          if (dateKey) {
            const d = current.daily[dateKey] || emptyDailyStat();
            d.count += 1;
            d.subtotal += amount;
            d.reward += reward;
            if (jotai === 'working') d.workingCount += 1;
            if (jotai === 'done') d.doneCount += 1;
            current.daily[dateKey] = d;
          }
          salesMap.set(idNorm, current);
        });
      });

    const sourceWorkers = cleaningWorkers.length
      ? cleaningWorkers
      : Array.from(salesMap.values()).map((v) => ({ key: v.key, id: v.id, name: v.name }));

    return sourceWorkers
      .map((w) => {
        const s = salesMap.get(w.key);
        return s || {
          key: w.key,
          id: w.id,
          name: w.name,
          count: 0,
          subtotal: 0,
          reward: 0,
          workingCount: 0,
          doneCount: 0,
          daily: {},
        };
      })
      .sort((a, b) => b.subtotal - a.subtotal);
  }, [items, nameMap, cleaningWorkers]);

  const matrixDays = useMemo(() => {
    const base = dayjs(`${month}-01`);
    return Array.from({ length: range.daysInMonth }, (_, i) => base.date(i + 1));
  }, [month, range.daysInMonth]);

  const totals = useMemo(() => {
    const workerCount = rows.length;
    const totalCount = rows.reduce((sum, row) => sum + row.count, 0);
    const subtotal = rows.reduce((sum, row) => sum + row.subtotal, 0);
    const reward = rows.reduce((sum, row) => sum + row.reward, 0);
    const uniqueSalesMap = new Map();
    (items || [])
      .filter((it) => !EXCLUDED_STATUS.has(safeStr(it?.jotai || it?.status).toLowerCase()))
      .forEach((it) => {
        const scheduleKey = safeStr(it?.yotei_id || it?.schedule_id || it?.id)
          || `${safeStr(it?.date || it?.scheduled_date || it?.scheduled_for)}|${safeStr(it?.start_at || it?.start_time)}|${safeStr(it?.tenpo_id || it?.store_id || it?.tenpo_name || it?.store_name)}`;
        if (!scheduleKey || uniqueSalesMap.has(scheduleKey)) return;
        uniqueSalesMap.set(scheduleKey, resolveYoteiUnitPrice(it));
      });
    const totalSales = Array.from(uniqueSalesMap.values()).reduce((sum, amount) => sum + Number(amount || 0), 0);
    return { workerCount, totalCount, subtotal, reward, totalSales };
  }, [rows, items]);

  return (
    <div className="report-page admin-cleaning-sales-page" data-job="admin">
      <div className="report-page-content report-page-content--full admin-cleaning-sales-content">
        <header className="admin-cleaning-sales-head">
          <h1>清掃売上管理</h1>
          <div className="admin-cleaning-sales-controls">
            <label htmlFor="admin-cleaning-sales-month">対象月</label>
            <input
              id="admin-cleaning-sales-month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
            <button type="button" className="btn btn-primary" onClick={load} disabled={loading}>
              {loading ? '更新中…' : '更新'}
            </button>
          </div>
        </header>

        <section className="admin-cleaning-sales-summary" aria-label="集計サマリ">
          <article>
            <span className="k">対象清掃員</span>
            <strong className="v">{totals.workerCount}名</strong>
          </article>
          <article>
            <span className="k">対象予定件数（延べ）</span>
            <strong className="v">{totals.totalCount}件</strong>
          </article>
          <article>
            <span className="k">小計売り上げ（延べ）</span>
            <strong className="v">{formatYen(totals.subtotal)}</strong>
          </article>
          <article>
            <span className="k">総売り上げ（予定ベース）</span>
            <strong className="v">{formatYen(totals.totalSales)}</strong>
          </article>
          <article>
            <span className="k">報酬見込（80%）</span>
            <strong className="v">{formatYen(totals.reward)}</strong>
          </article>
        </section>

        {error ? <p className="admin-cleaning-sales-error">{error}</p> : null}

        <section className="admin-cleaning-sales-matrix-wrap" aria-label="清掃員別日次小計売上">
          <table className="admin-cleaning-sales-matrix">
            <thead>
              <tr>
                <th className="date-col">日付</th>
                {rows.map((worker) => (
                  <th key={`head-${worker.key}`}>
                    <div className="worker-head-sub">{formatYen(worker.subtotal)}</div>
                    <div className="worker-head-name">{worker.name}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrixDays.map((d) => {
                const dateKey = d.format('YYYY-MM-DD');
                return (
                  <tr key={`row-${dateKey}`}>
                    <th className="date-col">{d.format('D')}</th>
                    {rows.map((worker) => {
                      const daily = worker.daily?.[dateKey];
                      return (
                        <td key={`cell-${dateKey}-${worker.key}`} className={daily?.subtotal > 0 ? 'has-sales' : ''}>
                          {daily?.subtotal > 0 ? formatYen(daily.subtotal) : '-'}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {!loading && rows.length === 0 ? (
                <tr>
                  <td className="empty" colSpan={Math.max(2, rows.length + 1)}>対象データがありません</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
