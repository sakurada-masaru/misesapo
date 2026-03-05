import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { createPortal } from 'react-dom';
import { normalizeGatewayBase, YOTEI_GATEWAY } from '../../shared/api/gatewayBase';
import '../../shared/styles/components.css';
import './admin-yasumi.css';

const API_BASE = (import.meta.env?.DEV || (typeof window !== 'undefined' && window.location?.hostname === 'localhost'))
  ? '/api'
  : normalizeGatewayBase(import.meta.env?.VITE_API_BASE, YOTEI_GATEWAY);

const YASUMI_HIDDEN_WORKER_NAMES = [
  '正田',
  '太田',
  '竹内',
  '梅岡',
  '沖',
  '今野',
  '開発アカウント',
  '櫻田',
  'Noemi',
  '吉井',
  '中島',
];

function authHeaders() {
  const token = localStorage.getItem('cognito_id_token') || (JSON.parse(localStorage.getItem('misesapo_auth') || '{}')).token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function toIso(d) {
  return dayjs(d).format('YYYY-MM-DD');
}

function buildDateList(fromISO, toISO) {
  const start = dayjs(fromISO);
  const end = dayjs(toISO);
  if (!start.isValid() || !end.isValid() || end.isBefore(start, 'day')) return [];
  const arr = [];
  let cur = start;
  while (cur.isBefore(end, 'day') || cur.isSame(end, 'day')) {
    arr.push(cur.format('YYYY-MM-DD'));
    cur = cur.add(1, 'day');
  }
  return arr;
}

function buildCalendarWeeks(monthISO) {
  const base = dayjs(monthISO).startOf('month');
  const daysInMonth = base.daysInMonth();
  const firstDow = base.day();
  const cells = [];

  for (let i = 0; i < firstDow; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push(base.date(d).format('YYYY-MM-DD'));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weekCount = Math.ceil(cells.length / 7);
  return Array.from({ length: weekCount }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}

function buildWeekDays(dayISO) {
  const base = dayjs(dayISO).startOf('week');
  return Array.from({ length: 7 }, (_, i) => base.add(i, 'day').format('YYYY-MM-DD'));
}

function normalizeWorkers(payload) {
  const src = Array.isArray(payload) ? payload : (Array.isArray(payload?.items) ? payload.items : []);
  const shouldHideWorker = (name) => {
    const normalized = String(name || '').replace(/\s+/g, '').trim();
    if (!normalized) return false;
    return YASUMI_HIDDEN_WORKER_NAMES.some((blocked) => normalized.includes(blocked.replace(/\s+/g, '')));
  };
  return src
    .map((w) => ({
      id: String(w?.id || w?.worker_id || w?.user_id || '').trim(),
      name: String(w?.name || w?.display_name || w?.full_name || '').trim() || '名前未設定',
    }))
    .filter((w) => w.id && !shouldHideWorker(w.name))
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
}

function statusLabel(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'open') return '稼働可';
  if (s === 'scheduled') return '予定';
  return '休み';
}

function buildRowsForDay(selectedWorkers, matrixByWorker, dayISO) {
  return selectedWorkers.map((w) => {
    const status = String(matrixByWorker[w.id]?.[dayISO] || 'closed').toLowerCase();
    return {
      id: w.id,
      name: w.name,
      status,
    };
  });
}

function summarizeDay(selectedWorkers, matrixByWorker, dayISO) {
  let open = 0;
  let scheduled = 0;
  let closed = 0;
  const closedNames = [];
  const previewTags = [];
  selectedWorkers.forEach((w) => {
    const status = String(matrixByWorker[w.id]?.[dayISO] || 'closed').toLowerCase();
    previewTags.push({ id: w.id, name: w.name, status });
    if (status === 'open') {
      open += 1;
    } else if (status === 'scheduled') {
      scheduled += 1;
    } else {
      closed += 1;
      if (closedNames.length < 2) closedNames.push(w.name);
    }
  });
  return { open, scheduled, closed, closedNames, previewTags };
}

function chunkWorkerIds(workerIds, size = 12) {
  const safeSize = Math.max(1, Number(size) || 12);
  const chunks = [];
  for (let i = 0; i < workerIds.length; i += safeSize) {
    chunks.push(workerIds.slice(i, i + safeSize));
  }
  return chunks;
}

async function fetchAvailabilityBatch({ fromISO, toISO, workerIds, headers }) {
  const url = `${API_BASE}/sales/availability-matrix?from=${encodeURIComponent(fromISO)}&to=${encodeURIComponent(toISO)}&service=cleaning&worker_ids=${encodeURIComponent(workerIds.join(','))}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(url, {
      headers,
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`休み一覧の取得に失敗しました (${res.status}) ${text}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

function hasAnyAvailabilityData(payload) {
  const items = Array.isArray(payload?.workers) ? payload.workers : [];
  return items.some((it) => {
    const days = it?.days && typeof it.days === 'object' ? it.days : {};
    return Object.keys(days).length > 0;
  });
}

export default function AdminYasumiPage() {
  const [monthISO, setMonthISO] = useState(() => dayjs().startOf('month').format('YYYY-MM-DD'));
  const [selectedDayISO, setSelectedDayISO] = useState(() => dayjs().format('YYYY-MM-DD'));
  const [viewMode, setViewMode] = useState('month');
  const [dayOverlayISO, setDayOverlayISO] = useState('');

  const [workers, setWorkers] = useState([]);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState([]);

  const [matrixByWorker, setMatrixByWorker] = useState({});
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [loadingMatrix, setLoadingMatrix] = useState(false);
  const [checkingNav, setCheckingNav] = useState(false);
  const [monthNavVisible, setMonthNavVisible] = useState({ prev: false, next: false });
  const [error, setError] = useState('');

  const todayISO = useMemo(() => dayjs().format('YYYY-MM-DD'), []);
  const minAllowedMonthISO = useMemo(() => dayjs(todayISO).subtract(1, 'month').startOf('month').format('YYYY-MM-DD'), [todayISO]);
  const maxAllowedMonthISO = useMemo(() => dayjs(todayISO).add(1, 'month').startOf('month').format('YYYY-MM-DD'), [todayISO]);
  const minAllowedDayISO = useMemo(() => dayjs(minAllowedMonthISO).startOf('month').format('YYYY-MM-DD'), [minAllowedMonthISO]);
  const maxAllowedDayISO = useMemo(() => dayjs(maxAllowedMonthISO).endOf('month').format('YYYY-MM-DD'), [maxAllowedMonthISO]);

  const clampDayISO = useCallback((iso) => {
    const d = dayjs(iso);
    if (!d.isValid()) return dayjs(todayISO).format('YYYY-MM-DD');
    if (d.isBefore(minAllowedDayISO, 'day')) return minAllowedDayISO;
    if (d.isAfter(maxAllowedDayISO, 'day')) return maxAllowedDayISO;
    return d.format('YYYY-MM-DD');
  }, [maxAllowedDayISO, minAllowedDayISO, todayISO]);

  const clampMonthISO = useCallback((iso) => {
    const d = dayjs(iso);
    if (!d.isValid()) return dayjs(todayISO).startOf('month').format('YYYY-MM-DD');
    if (d.isBefore(minAllowedMonthISO, 'month')) return minAllowedMonthISO;
    if (d.isAfter(maxAllowedMonthISO, 'month')) return maxAllowedMonthISO;
    return d.startOf('month').format('YYYY-MM-DD');
  }, [maxAllowedMonthISO, minAllowedMonthISO, todayISO]);

  const safeSelectedDayISO = clampDayISO(selectedDayISO);
  const safeMonthISO = clampMonthISO(monthISO);

  const periodRange = useMemo(() => {
    if (viewMode === 'week') {
      const base = dayjs(safeSelectedDayISO);
      const rawFrom = base.startOf('week');
      const rawTo = base.endOf('week');
      return {
        fromISO: rawFrom.isBefore(minAllowedDayISO, 'day') ? minAllowedDayISO : rawFrom.format('YYYY-MM-DD'),
        toISO: rawTo.isAfter(maxAllowedDayISO, 'day') ? maxAllowedDayISO : rawTo.format('YYYY-MM-DD'),
      };
    }
    const base = dayjs(safeMonthISO);
    return {
      fromISO: base.startOf('month').format('YYYY-MM-DD'),
      toISO: base.endOf('month').format('YYYY-MM-DD'),
    };
  }, [maxAllowedDayISO, minAllowedDayISO, safeMonthISO, safeSelectedDayISO, viewMode]);

  const dateList = useMemo(() => buildDateList(periodRange.fromISO, periodRange.toISO), [periodRange.fromISO, periodRange.toISO]);
  const calendarWeeks = useMemo(() => buildCalendarWeeks(safeMonthISO), [safeMonthISO]);
  const weekDays = useMemo(() => buildWeekDays(safeSelectedDayISO), [safeSelectedDayISO]);

  const loadWorkers = useCallback(async () => {
    setLoadingWorkers(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/workers`, {
        headers: authHeaders(),
        cache: 'no-store',
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`担当者一覧の取得に失敗しました (${res.status}) ${text}`);
      }
      const json = await res.json();
      const list = normalizeWorkers(json);
      setWorkers(list);
      setSelectedWorkerIds((prev) => {
        if (prev.length > 0) return prev.filter((id) => list.some((w) => w.id === id));
        return list.map((w) => w.id);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : '担当者一覧の取得に失敗しました');
    } finally {
      setLoadingWorkers(false);
    }
  }, []);

  const loadMatrix = useCallback(async () => {
    if (!dateList.length || !selectedWorkerIds.length) {
      setMatrixByWorker({});
      return;
    }

    setLoadingMatrix(true);
    setError('');
    try {
      const mapped = {};
      const headers = authHeaders();
      const batches = chunkWorkerIds(selectedWorkerIds, 12);
      let partialFailure = 0;

      for (const batch of batches) {
        let json;
        try {
          json = await fetchAvailabilityBatch({
            fromISO: periodRange.fromISO,
            toISO: periodRange.toISO,
            workerIds: batch,
            headers,
          });
        } catch (e) {
          const retryable = e?.name === 'AbortError'
            || String(e?.message || '').includes('(504)')
            || String(e?.message || '').includes('timed out');
          if (!retryable) throw e;
          try {
            json = await fetchAvailabilityBatch({
              fromISO: periodRange.fromISO,
              toISO: periodRange.toISO,
              workerIds: batch,
              headers,
            });
          } catch {
            partialFailure += 1;
            continue;
          }
        }

        const items = Array.isArray(json?.workers) ? json.workers : [];
        items.forEach((it) => {
          const id = String(it?.worker_id || '').trim();
          if (!id) return;
          const days = it?.days && typeof it.days === 'object' ? it.days : {};
          mapped[id] = days;
        });
      }

      if (Object.keys(mapped).length === 0) {
        throw new Error('休み一覧の取得がタイムアウトしました。対象担当者を減らして再試行してください。');
      }
      setMatrixByWorker(mapped);
      if (partialFailure > 0) {
        setError(`休み一覧の一部取得に失敗しました（${partialFailure}バッチ）。表示は取得できた分のみ反映しています。`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '休み一覧の取得に失敗しました');
      setMatrixByWorker({});
    } finally {
      setLoadingMatrix(false);
    }
  }, [dateList.length, periodRange.fromISO, periodRange.toISO, selectedWorkerIds]);

  useEffect(() => {
    loadWorkers();
  }, [loadWorkers]);

  useEffect(() => {
    loadMatrix();
  }, [loadMatrix]);

  useEffect(() => {
    if (safeSelectedDayISO !== selectedDayISO) {
      setSelectedDayISO(safeSelectedDayISO);
    }
  }, [safeSelectedDayISO, selectedDayISO]);

  useEffect(() => {
    if (safeMonthISO !== monthISO) {
      setMonthISO(safeMonthISO);
    }
  }, [monthISO, safeMonthISO]);

  useEffect(() => {
    if (!dateList.includes(safeSelectedDayISO) && dateList.length > 0) {
      setSelectedDayISO(dateList[0]);
    }
  }, [dateList, safeSelectedDayISO]);

  useEffect(() => {
    const nextMonthISO = clampMonthISO(dayjs(safeSelectedDayISO).startOf('month').format('YYYY-MM-DD'));
    if (nextMonthISO !== safeMonthISO) setMonthISO(nextMonthISO);
  }, [clampMonthISO, safeMonthISO, safeSelectedDayISO]);

  const selectedWorkers = useMemo(() => {
    const set = new Set(selectedWorkerIds);
    return workers.filter((w) => set.has(w.id));
  }, [workers, selectedWorkerIds]);

  const daySummaryByDate = useMemo(() => {
    const map = {};
    dateList.forEach((iso) => {
      map[iso] = summarizeDay(selectedWorkers, matrixByWorker, iso);
    });
    return map;
  }, [dateList, matrixByWorker, selectedWorkers]);

  const selectedDayRows = useMemo(() => {
    return buildRowsForDay(selectedWorkers, matrixByWorker, safeSelectedDayISO);
  }, [matrixByWorker, safeSelectedDayISO, selectedWorkers]);

  const selectedDaySummary = daySummaryByDate[safeSelectedDayISO] || summarizeDay(selectedWorkers, matrixByWorker, safeSelectedDayISO);

  const overlayRows = useMemo(() => {
    if (!dayOverlayISO) return [];
    return buildRowsForDay(selectedWorkers, matrixByWorker, dayOverlayISO);
  }, [dayOverlayISO, matrixByWorker, selectedWorkers]);

  const overlaySummary = daySummaryByDate[dayOverlayISO] || summarizeDay(selectedWorkers, matrixByWorker, dayOverlayISO);

  const overlayGroups = useMemo(() => {
    return {
      closed: overlayRows.filter((r) => r.status === 'closed'),
      scheduled: overlayRows.filter((r) => r.status === 'scheduled'),
      open: overlayRows.filter((r) => r.status === 'open'),
    };
  }, [overlayRows]);

  useEffect(() => {
    if (!dayOverlayISO) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setDayOverlayISO('');
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [dayOverlayISO]);

  const toggleWorker = (workerId) => {
    setSelectedWorkerIds((prev) => {
      if (prev.includes(workerId)) return prev.filter((id) => id !== workerId);
      return [...prev, workerId];
    });
  };

  const canMovePrev = useMemo(() => {
    if (viewMode === 'week') {
      const prev = dayjs(safeSelectedDayISO).subtract(1, 'week').format('YYYY-MM-DD');
      return clampDayISO(prev) !== safeSelectedDayISO;
    }
    return dayjs(safeMonthISO).isAfter(dayjs(minAllowedMonthISO), 'month');
  }, [clampDayISO, minAllowedMonthISO, safeMonthISO, safeSelectedDayISO, viewMode]);

  const canMoveNext = useMemo(() => {
    if (viewMode === 'week') {
      const next = dayjs(safeSelectedDayISO).add(1, 'week').format('YYYY-MM-DD');
      return clampDayISO(next) !== safeSelectedDayISO;
    }
    return dayjs(safeMonthISO).isBefore(dayjs(maxAllowedMonthISO), 'month');
  }, [clampDayISO, maxAllowedMonthISO, safeMonthISO, safeSelectedDayISO, viewMode]);

  const prevMonthISO = useMemo(
    () => clampMonthISO(dayjs(safeMonthISO).subtract(1, 'month').startOf('month').format('YYYY-MM-DD')),
    [clampMonthISO, safeMonthISO],
  );
  const nextMonthISO = useMemo(
    () => clampMonthISO(dayjs(safeMonthISO).add(1, 'month').startOf('month').format('YYYY-MM-DD')),
    [clampMonthISO, safeMonthISO],
  );
  const hasPrevMonthCandidate = prevMonthISO !== safeMonthISO;
  const hasNextMonthCandidate = nextMonthISO !== safeMonthISO;

  const hasDataInPeriod = useCallback(async (fromISO, toISO) => {
    if (!selectedWorkerIds.length) return false;
    const headers = authHeaders();
    const batches = chunkWorkerIds(selectedWorkerIds, 12);
    for (const batch of batches) {
      try {
        const json = await fetchAvailabilityBatch({
          fromISO,
          toISO,
          workerIds: batch,
          headers,
        });
        if (hasAnyAvailabilityData(json)) return true;
      } catch {
        // navigation pre-check: ignore per-batch failure and continue
      }
    }
    return false;
  }, [selectedWorkerIds]);

  const showNoDataDialog = () => {
    window.alert('情報がないため表示できません。');
  };

  useEffect(() => {
    if (viewMode !== 'month') {
      setMonthNavVisible({ prev: canMovePrev, next: canMoveNext });
      setCheckingNav(false);
      return;
    }

    let cancelled = false;
    const evaluateMonthNav = async () => {
      if (!selectedWorkerIds.length) {
        if (!cancelled) setCheckingNav(false);
        if (!cancelled) setMonthNavVisible({ prev: false, next: false });
        return;
      }

      setCheckingNav(true);
      const nextVisibility = { prev: false, next: false };

      if (hasPrevMonthCandidate) {
        nextVisibility.prev = await hasDataInPeriod(
          dayjs(prevMonthISO).startOf('month').format('YYYY-MM-DD'),
          dayjs(prevMonthISO).endOf('month').format('YYYY-MM-DD'),
        );
      }

      if (hasNextMonthCandidate) {
        nextVisibility.next = await hasDataInPeriod(
          dayjs(nextMonthISO).startOf('month').format('YYYY-MM-DD'),
          dayjs(nextMonthISO).endOf('month').format('YYYY-MM-DD'),
        );
      }

      if (cancelled) return;
      setMonthNavVisible(nextVisibility);
      setCheckingNav(false);
    };

    evaluateMonthNav().catch(() => {
      if (cancelled) return;
      setMonthNavVisible({ prev: false, next: false });
      setCheckingNav(false);
    });

    return () => {
      cancelled = true;
    };
  }, [
    canMoveNext,
    canMovePrev,
    hasDataInPeriod,
    hasNextMonthCandidate,
    hasPrevMonthCandidate,
    nextMonthISO,
    prevMonthISO,
    selectedWorkerIds.length,
    viewMode,
  ]);

  const showPrevArrow = viewMode === 'month' ? monthNavVisible.prev : canMovePrev;
  const showNextArrow = viewMode === 'month' ? monthNavVisible.next : canMoveNext;

  const movePeriod = (dir) => {
    if (dir < 0 && !showPrevArrow) {
      showNoDataDialog();
      return;
    }
    if (dir > 0 && !showNextArrow) {
      showNoDataDialog();
      return;
    }

    if (viewMode === 'week') {
      const next = clampDayISO(dayjs(safeSelectedDayISO).add(dir, 'week').format('YYYY-MM-DD'));
      if (next === safeSelectedDayISO) return;
      setSelectedDayISO(next);
      return;
    }

    const nextMonth = dir < 0 ? prevMonthISO : nextMonthISO;
    if (nextMonth === safeMonthISO) return;
    setMonthISO(nextMonth);
  };

  const resetToCurrent = () => {
    const now = dayjs();
    setSelectedDayISO(now.format('YYYY-MM-DD'));
    setMonthISO(now.startOf('month').format('YYYY-MM-DD'));
  };

  const periodLabel = useMemo(() => {
    if (viewMode === 'week') {
      const start = dayjs(periodRange.fromISO).format('YYYY/MM/DD');
      const end = dayjs(periodRange.toISO).format('YYYY/MM/DD');
      return `${start} - ${end}`;
    }
    return dayjs(safeMonthISO).format('YYYY年M月');
  }, [periodRange.fromISO, periodRange.toISO, safeMonthISO, viewMode]);

  return (
    <div className={`report-page admin-yasumi-page ${viewMode === 'week' ? 'is-week-mode' : ''}`} data-job="admin">
      <div className="report-page-content report-page-content--full admin-yasumi-content">
        <header className="yasumi-head">
          <div>
            <h1>yasumi</h1>
            <p>Googleカレンダー風の月次・週次表示で、清掃員の休み申告を統合確認します。</p>
          </div>
          <div className="yasumi-head-actions">
            <div className="yasumi-view-toggle" role="tablist" aria-label="表示切替">
              <button type="button" className={`btn ${viewMode === 'month' ? 'is-active' : ''}`} onClick={() => setViewMode('month')}>月次</button>
              <button type="button" className={`btn ${viewMode === 'week' ? 'is-active' : ''}`} onClick={() => setViewMode('week')}>週次</button>
            </div>
            {showPrevArrow ? (
              <button type="button" className="btn" onClick={() => movePeriod(-1)} disabled={checkingNav}>◀</button>
            ) : null}
            <button type="button" className="btn" onClick={resetToCurrent}>{viewMode === 'week' ? '今週' : '今月'}</button>
            {showNextArrow ? (
              <button type="button" className="btn" onClick={() => movePeriod(1)} disabled={checkingNav}>▶</button>
            ) : null}
            <strong className="yasumi-month-label">{periodLabel}</strong>
            <span className="yasumi-range-note">先月〜来月</span>
            <button type="button" className="btn" onClick={loadMatrix} disabled={loadingMatrix}>更新</button>
          </div>
        </header>

        {error ? <div className="yasumi-error" role="alert">{error}</div> : null}

        <section className="yasumi-layout">
          <aside className="yasumi-workers-card">
            <div className="yasumi-workers-head">
              <h2>対象担当者</h2>
              <div className="yasumi-workers-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setSelectedWorkerIds(workers.map((w) => w.id))}
                  disabled={loadingWorkers || workers.length === 0}
                >
                  全選択
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setSelectedWorkerIds([])}
                  disabled={loadingWorkers || selectedWorkerIds.length === 0}
                >
                  解除
                </button>
              </div>
            </div>
            <div className="yasumi-workers-list">
              {loadingWorkers ? <div className="yasumi-muted">担当者を読み込み中...</div> : null}
              {!loadingWorkers && workers.length === 0 ? <div className="yasumi-muted">担当者データがありません</div> : null}
              {workers.map((w) => (
                <label key={w.id} className="yasumi-worker-row">
                  <input
                    type="checkbox"
                    checked={selectedWorkerIds.includes(w.id)}
                    onChange={() => toggleWorker(w.id)}
                  />
                  <span>{w.name}</span>
                </label>
              ))}
            </div>
          </aside>

          <div className="yasumi-main-card">
            <div className="yasumi-calendar-weekdays">
              {['日', '月', '火', '水', '木', '金', '土'].map((d) => <span key={d}>{d}</span>)}
            </div>

            <div className={`yasumi-calendar-grid ${viewMode === 'week' ? 'is-week' : ''}`}>
              {(viewMode === 'week' ? weekDays : calendarWeeks.flatMap((w) => w)).map((iso, idx) => {
                if (!iso) return <div key={`empty-${idx}`} className="yasumi-cal-cell empty" />;

                const isOutOfRange = dayjs(iso).isBefore(minAllowedDayISO, 'day') || dayjs(iso).isAfter(maxAllowedDayISO, 'day');
                const summary = isOutOfRange ? null : (daySummaryByDate[iso] || summarizeDay(selectedWorkers, matrixByWorker, iso));
                const isSelected = iso === safeSelectedDayISO;
                const isToday = iso === todayISO;
                const allTags = Array.isArray(summary?.previewTags) ? summary.previewTags : [];
                const shownTags = viewMode === 'week' ? allTags : allTags.slice(0, 3);

                return (
                  <button
                    key={iso}
                    type="button"
                    className={`yasumi-cal-cell ${isSelected ? 'is-selected' : ''} ${isToday ? 'is-today' : ''} ${isOutOfRange ? 'is-disabled' : ''}`}
                    disabled={isOutOfRange}
                    onClick={() => {
                      if (isOutOfRange) return;
                      setSelectedDayISO(iso);
                      setDayOverlayISO(iso);
                    }}
                  >
                    <div className="yasumi-cal-headline">
                      <span className="yasumi-cal-date">{dayjs(iso).date()}</span>
                    </div>
                    <div className="yasumi-cal-counts">
                      {isOutOfRange ? (
                        <span>対象外</span>
                      ) : (
                        <>
                          <span className="is-open">可 {summary.open}</span>
                          <span className="is-scheduled">予 {summary.scheduled}</span>
                          <span className="is-closed">休 {summary.closed}</span>
                        </>
                      )}
                    </div>
                    <div className="yasumi-cal-preview">
                      {shownTags.map((tag) => (
                        <span key={`${iso}-${tag.id}`} className={`yasumi-cal-name is-${tag.status}`}>{tag.name}</span>
                      ))}
                      {viewMode !== 'week' && allTags.length > shownTags.length ? (
                        <span className="yasumi-cal-more">+{allTags.length - shownTags.length}</span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>

            {viewMode !== 'week' ? (
              <section className="yasumi-day-detail">
                <div className="yasumi-day-detail-head">
                  <h3>{dayjs(safeSelectedDayISO).format('YYYY/MM/DD')} の状況</h3>
                  <div className="yasumi-day-summary">
                    <span className="is-open">稼働可 {selectedDaySummary.open}</span>
                    <span className="is-scheduled">予定 {selectedDaySummary.scheduled}</span>
                    <span className="is-closed">休み {selectedDaySummary.closed}</span>
                  </div>
                </div>

                <div className="yasumi-day-list">
                  {selectedDayRows.map((row) => (
                    <div key={row.id} className="yasumi-day-row">
                      <span className="name">{row.name}</span>
                      <span className={`yasumi-status is-${row.status}`}>{statusLabel(row.status)}</span>
                    </div>
                  ))}
                  {selectedDayRows.length === 0 ? (
                    <div className="yasumi-muted">表示対象の担当者を選択してください</div>
                  ) : null}
                </div>
              </section>
            ) : null}

            {loadingMatrix ? <div className="yasumi-muted">稼働可否を読み込み中...</div> : null}
          </div>
        </section>
      </div>

      {dayOverlayISO && typeof document !== 'undefined'
        ? createPortal(
          <div className="yasumi-overlay-backdrop" role="dialog" aria-modal="true" onClick={() => setDayOverlayISO('')}>
            <div className="yasumi-overlay" onClick={(e) => e.stopPropagation()}>
              <header className="yasumi-overlay-head">
                <div>
                  <h3>{dayjs(dayOverlayISO).format('YYYY/MM/DD')} の担当者状況</h3>
                  <p>休みを中心に、勤務ステータス別で表示しています。</p>
                </div>
                <button type="button" className="btn" onClick={() => setDayOverlayISO('')}>閉じる</button>
              </header>

              <div className="yasumi-overlay-summary">
                <span className="is-closed">休み {overlaySummary.closed}</span>
                <span className="is-scheduled">予定 {overlaySummary.scheduled}</span>
                <span className="is-open">稼働可 {overlaySummary.open}</span>
              </div>

              <div className="yasumi-overlay-groups">
                <section className="yasumi-overlay-group">
                  <h4>休み</h4>
                  <div className="yasumi-tag-list">
                    {overlayGroups.closed.map((r) => (
                      <span key={`closed-${r.id}`} className="yasumi-name-tag is-closed">{r.name}</span>
                    ))}
                    {overlayGroups.closed.length === 0 ? <span className="yasumi-muted">該当なし</span> : null}
                  </div>
                </section>

                <section className="yasumi-overlay-group">
                  <h4>予定</h4>
                  <div className="yasumi-tag-list">
                    {overlayGroups.scheduled.map((r) => (
                      <span key={`scheduled-${r.id}`} className="yasumi-name-tag is-scheduled">{r.name}</span>
                    ))}
                    {overlayGroups.scheduled.length === 0 ? <span className="yasumi-muted">該当なし</span> : null}
                  </div>
                </section>

                <section className="yasumi-overlay-group">
                  <h4>稼働可</h4>
                  <div className="yasumi-tag-list">
                    {overlayGroups.open.map((r) => (
                      <span key={`open-${r.id}`} className="yasumi-name-tag is-open">{r.name}</span>
                    ))}
                    {overlayGroups.open.length === 0 ? <span className="yasumi-muted">該当なし</span> : null}
                  </div>
                </section>
              </div>
            </div>
          </div>,
          document.body,
        )
        : null}
    </div>
  );
}
