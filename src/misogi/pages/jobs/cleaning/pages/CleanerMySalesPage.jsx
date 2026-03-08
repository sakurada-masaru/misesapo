import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import Visualizer from '../../../shared/ui/Visualizer/Visualizer';
import { apiFetch } from '../../../shared/api/client';
import { useAuth } from '../../../shared/auth/useAuth';
import './cleaner-my-sales.css';

const REWARD_RATE = 0.8;
const EXCLUDED_STATUS = new Set(['torikeshi']);

function safeStr(v) {
  return String(v == null ? '' : v).trim();
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

function fmtHm(iso) {
  const d = dayjs(iso);
  if (!d.isValid()) return '--:--';
  return d.format('HH:mm');
}

function normalizeComparableId(v) {
  return String(v || '').trim().toLowerCase().replace(/\s+/g, '');
}

function expandComparableIds(v) {
  const out = [];
  const push = (raw) => {
    const normalized = normalizeComparableId(raw);
    if (!normalized) return;
    out.push(normalized);
    const hashPos = normalized.lastIndexOf('#');
    if (hashPos >= 0 && hashPos < normalized.length - 1) {
      out.push(normalized.slice(hashPos + 1));
    }
  };
  (Array.isArray(v) ? v : [v]).forEach(push);
  return Array.from(new Set(out));
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

function extractParticipantIds(item) {
  return Array.from(new Set([
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
    ...toIdList(item?.assignees),
    ...toIdList(item?.participants),
  ]));
}

function includesWorker(item, workerIds) {
  const participants = extractParticipantIds(item);
  if (!participants.length) return false;
  const set = new Set(participants.flatMap((id) => expandComparableIds(id)));
  return workerIds.some((id) => set.has(id));
}

function jotaiLabel(raw) {
  const v = safeStr(raw).toLowerCase();
  if (v === 'yuko') return '有効';
  if (v === 'planned') return '予定';
  if (v === 'working') return '実行中';
  if (v === 'done') return '完了';
  if (v === 'mikanryo') return '未完了';
  if (v === 'torikeshi') return '削除';
  return raw || '-';
}

export default function CleanerMySalesPage() {
  const { user, authz, getToken, isAuthenticated } = useAuth();
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);

  const jinzaiId = authz?.jinzaiId || user?.jinzai_id || user?.worker_id || user?.sagyouin_id || user?.id || '';
  const workerIdSet = useMemo(() => expandComparableIds(jinzaiId), [jinzaiId]);
  const authHeader = useMemo(() => {
    const token = getToken?.();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [getToken]);

  const range = useMemo(() => {
    const d = dayjs(`${month}-01`);
    const from = d.startOf('month').format('YYYY-MM-DD');
    const to = d.endOf('month').format('YYYY-MM-DD');
    return { from, to };
  }, [month]);

  const load = useCallback(async () => {
    if (!isAuthenticated || !jinzaiId) return;
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      qs.set('from', range.from);
      qs.set('to', range.to);
      qs.set('limit', '5000');
      qs.set('jinzai_id', jinzaiId);
      qs.set('worker_id', jinzaiId);
      qs.set('sagyouin_id', jinzaiId);
      qs.set('assigned_to', jinzaiId);
      const initial = await apiFetch(`/yotei?${qs.toString()}`, { headers: authHeader, cache: 'no-store' });
      const initialList = Array.isArray(initial) ? initial : (initial?.items || []);
      if (initialList.length > 0) {
        setItems(initialList);
        return;
      }

      const fallbackQs = new URLSearchParams();
      fallbackQs.set('from', range.from);
      fallbackQs.set('to', range.to);
      fallbackQs.set('limit', '10000');
      const fallback = await apiFetch(`/yotei?${fallbackQs.toString()}`, { headers: authHeader, cache: 'no-store' });
      const fallbackList = Array.isArray(fallback) ? fallback : (fallback?.items || []);
      setItems(Array.isArray(fallbackList) ? fallbackList : []);
    } catch (e) {
      setError(e?.message || '売上データの取得に失敗しました');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [authHeader, isAuthenticated, jinzaiId, range.from, range.to]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    return (items || [])
      .filter((it) => includesWorker(it, workerIdSet))
      .filter((it) => !EXCLUDED_STATUS.has(safeStr(it?.jotai || it?.status).toLowerCase()))
      .map((it) => {
        const amount = resolveYoteiUnitPrice(it);
        const reward = Math.round(amount * REWARD_RATE);
        const date = safeStr(it?.date || it?.scheduled_date || it?.scheduled_for || '');
        const start = safeStr(it?.start_at || it?.start_time || '');
        const end = safeStr(it?.end_at || it?.end_time || '');
        const tenpo = safeStr(it?.tenpo_name || it?.store_name || it?.tenpo || '-');
        const yagou = safeStr(it?.yagou_name || it?.brand_name || it?.yagou || '-');
        const id = safeStr(it?.yotei_id || it?.schedule_id || it?.id || '-');
        return {
          id,
          date,
          tenpo,
          yagou,
          timeLabel: `${fmtHm(start)} - ${fmtHm(end)}`,
          status: jotaiLabel(it?.jotai || it?.status),
          amount,
          reward,
        };
      })
      .sort((a, b) => {
        const ak = `${a.date} ${a.timeLabel}`;
        const bk = `${b.date} ${b.timeLabel}`;
        return ak.localeCompare(bk);
      });
  }, [items, workerIdSet]);

  const totals = useMemo(() => {
    const count = rows.length;
    const subtotal = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const reward = rows.reduce((sum, row) => sum + Number(row.reward || 0), 0);
    return { count, subtotal, reward };
  }, [rows]);

  return (
    <div className="report-page cleaner-my-sales-page" data-job="cleaning">
      <div className="report-page-viz">
        <Visualizer mode="base" className="report-page-visualizer" />
      </div>
      <div className="report-page-content cleaner-my-sales-content">
        <header className="cleaner-my-sales-header">
          <h1>マイページ（売上）</h1>
          <div className="cleaner-my-sales-controls">
            <label htmlFor="cleaner-my-sales-month">対象月</label>
            <input
              id="cleaner-my-sales-month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
            <button type="button" className="btn btn-primary" onClick={load} disabled={loading}>
              {loading ? '更新中…' : '更新'}
            </button>
          </div>
        </header>

        <section className="cleaner-my-sales-summary" aria-label="売上サマリ">
          <article>
            <span className="k">対象件数</span>
            <strong className="v">{totals.count}件</strong>
          </article>
          <article>
            <span className="k">小計売り上げ</span>
            <strong className="v">{formatYen(totals.subtotal)}</strong>
          </article>
          <article>
            <span className="k">報酬見込（80%）</span>
            <strong className="v">{formatYen(totals.reward)}</strong>
          </article>
        </section>

        {error ? <p className="cleaner-my-sales-error">{error}</p> : null}

        <section className="cleaner-my-sales-table-wrap" aria-label="売上一覧">
          <table className="cleaner-my-sales-table">
            <thead>
              <tr>
                <th>日付</th>
                <th>時間</th>
                <th>屋号 / 店舗</th>
                <th>状態</th>
                <th>小計売り上げ</th>
                <th>報酬</th>
              </tr>
            </thead>
            <tbody>
              {!loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty">対象データがありません</td>
                </tr>
              ) : null}
              {rows.map((row) => (
                <tr key={`${row.id}-${row.date}-${row.timeLabel}`}>
                  <td>{row.date || '-'}</td>
                  <td>{row.timeLabel}</td>
                  <td>
                    <div className="yagou">{row.yagou}</div>
                    <div className="tenpo">{row.tenpo}</div>
                  </td>
                  <td>{row.status}</td>
                  <td>{formatYen(row.amount)}</td>
                  <td>{formatYen(row.reward)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
