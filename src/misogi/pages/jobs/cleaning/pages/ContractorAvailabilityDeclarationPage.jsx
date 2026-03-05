import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import Visualizer from '../../../shared/ui/Visualizer/Visualizer';
import { useAuth } from '../../../shared/auth/useAuth';
import { normalizeGatewayBase, YOTEI_GATEWAY } from '../../../shared/api/gatewayBase';
import '../../../shared/styles/components.css';
import './contractor-availability-declaration.css';

const API_BASE =
  typeof window !== 'undefined' && window.location?.hostname === 'localhost'
    ? '/api'
    : normalizeGatewayBase(import.meta.env?.VITE_API_BASE, YOTEI_GATEWAY);

const MODE_LABEL = {
  available: '稼働可',
  off: '休み',
};

const MODE_ORDER = ['available', 'off'];

const MODE_OPTIONS = [
  { value: 'available', label: '稼働可' },
  { value: 'off', label: '休み' },
];

function getMonthRange(monthISO) {
  const base = dayjs(monthISO);
  return {
    start: base.startOf('month').format('YYYY-MM-DD'),
    end: base.endOf('month').format('YYYY-MM-DD'),
  };
}

function monthDays(monthISO) {
  const base = dayjs(monthISO).startOf('month');
  const count = base.daysInMonth();
  return Array.from({ length: count }, (_, i) => base.add(i, 'day').format('YYYY-MM-DD'));
}

function toHHMMByMin(min) {
  const safeMin = Number.isFinite(Number(min)) ? Number(min) : 0;
  const hh = String(Math.max(0, Math.floor(safeMin / 60))).padStart(2, '0');
  const mm = String(Math.max(0, safeMin % 60)).padStart(2, '0');
  return `${hh}:${mm}`;
}

function scheduleToConflictShape(schedule, fallbackDate, defaultAssigneeId) {
  const date = String(schedule?.date || schedule?.scheduled_date || fallbackDate || '').slice(0, 10);

  const startAt = schedule?.start_time
    || (schedule?.start_min != null ? `${date}T${toHHMMByMin(Number(schedule.start_min))}:00` : `${date}T09:00:00`);
  const endAt = schedule?.end_time
    || (schedule?.end_min != null ? `${date}T${toHHMMByMin(Number(schedule.end_min))}:00` : `${date}T10:00:00`);

  return {
    id: String(schedule?.id || schedule?.schedule_id || `${date}-${startAt}`),
    schedule_id: String(schedule?.id || schedule?.schedule_id || `${date}-${startAt}`),
    assignee_id: String(schedule?.worker_id || schedule?.assigned_to || schedule?.cleaner_id || defaultAssigneeId || ''),
    start_at: startAt,
    end_at: endAt,
    title: schedule?.store_name || schedule?.target_name || schedule?.client_name || '現場',
    kind: 'job',
  };
}

function buildCalendarCells(monthISO) {
  const base = dayjs(monthISO).startOf('month');
  const daysInMonth = base.daysInMonth();
  const firstDow = base.day();
  const cells = [];

  for (let i = 0; i < firstDow; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push(base.date(d).format('YYYY-MM-DD'));
  }
  while (cells.length < 42) cells.push(null);

  return Array.from({ length: 6 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}

function inRange(iso, from, to) {
  const d = dayjs(iso);
  const s = dayjs(from);
  const e = dayjs(to);
  return (d.isAfter(s, 'day') || d.isSame(s, 'day')) && (d.isBefore(e, 'day') || d.isSame(e, 'day'));
}

function dateOrder(a, b) {
  if (!a && !b) return [null, null];
  if (!a) return [b, b];
  if (!b) return [a, a];
  return dayjs(a).isAfter(dayjs(b), 'day') ? [b, a] : [a, b];
}

export default function ContractorAvailabilityDeclarationPage() {
  const { user, isAuthenticated, isLoading, getToken } = useAuth();
  const navigate = useNavigate();

  const [monthISO, setMonthISO] = useState(dayjs().add(1, 'month').startOf('month').format('YYYY-MM-DD'));
  const [selectedDay, setSelectedDay] = useState(dayjs().add(1, 'month').startOf('month').format('YYYY-MM-DD'));
  const [workerId, setWorkerId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const [appointments, setAppointments] = useState([]);
  const [availabilityItems, setAvailabilityItems] = useState([]);
  const [modeByDay, setModeByDay] = useState({});

  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [rangeMode, setRangeMode] = useState('off');

  const monthRange = useMemo(() => getMonthRange(monthISO), [monthISO]);
  const days = useMemo(() => monthDays(monthISO), [monthISO]);
  const calendarWeeks = useMemo(() => buildCalendarCells(monthISO), [monthISO]);

  const appointmentsByDay = useMemo(() => {
    const map = {};
    days.forEach((d) => {
      map[d] = [];
    });
    appointments.forEach((a) => {
      const dateKey = String(a?.start_at || '').slice(0, 10);
      if (!map[dateKey]) return;
      map[dateKey].push(a);
    });
    Object.keys(map).forEach((k) => {
      map[k].sort((x, y) => String(x.start_at).localeCompare(String(y.start_at)));
    });
    return map;
  }, [appointments, days]);

  const counts = useMemo(() => {
    const c = { available: 0, off: 0 };
    days.forEach((iso) => {
      const mode = modeByDay[iso] || 'available';
      c[mode] += 1;
    });
    return c;
  }, [days, modeByDay]);

  const selectedMode = modeByDay[selectedDay] || 'available';
  const todayISO = dayjs().format('YYYY-MM-DD');
  const [orderedStart, orderedEnd] = dateOrder(rangeStart, rangeEnd);

  const loadWorkerId = useCallback(async () => {
    const token = getToken();
    if (!token || !user?.email) return '';
    const res = await fetch(`${API_BASE}/workers`, {
      headers: { Authorization: `Bearer ${String(token).trim()}` },
      cache: 'no-store',
    });
    if (!res.ok) return '';
    const json = await res.json();
    const workers = Array.isArray(json) ? json : (Array.isArray(json?.items) ? json.items : []);
    const own = workers.find((w) => String(w?.email || w?.email_address || '').toLowerCase() === String(user.email).toLowerCase());
    const id = own?.id || own?.worker_id || own?.user_id || '';
    return String(id || '');
  }, [getToken, user?.email]);

  const loadMonthData = useCallback(async (targetWorkerId) => {
    if (!targetWorkerId) return;
    const token = getToken();
    if (!token) return;

    const authHeaders = { Authorization: `Bearer ${String(token).trim()}` };
    const scheduleUrl = `${API_BASE}/schedules?date_from=${monthRange.start}&date_to=${monthRange.end}&worker_id=${encodeURIComponent(targetWorkerId)}&limit=1000`;
    const availabilityUrl = `${API_BASE}/workers/me/availability?from=${encodeURIComponent(monthRange.start)}&to=${encodeURIComponent(monthRange.end)}`;

    const [scheduleRes, availabilityRes] = await Promise.all([
      fetch(scheduleUrl, { headers: authHeaders, cache: 'no-store' }),
      fetch(availabilityUrl, { headers: authHeaders, cache: 'no-store' }),
    ]);

    if (!scheduleRes.ok) {
      throw new Error(`予定取得に失敗しました (${scheduleRes.status})`);
    }
    if (!availabilityRes.ok) {
      throw new Error(`休み申請データ取得に失敗しました (${availabilityRes.status})`);
    }

    const scheduleJson = await scheduleRes.json();
    const availabilityJson = await availabilityRes.json();
    const scheduleItems = Array.isArray(scheduleJson?.items) ? scheduleJson.items : [];
    const availabilityEntries = Array.isArray(availabilityJson?.items) ? availabilityJson.items : [];

    setAppointments(scheduleItems.map((s) => scheduleToConflictShape(s, monthRange.start, targetWorkerId)));
    setAvailabilityItems(availabilityEntries);

    const nextModeByDay = {};
    days.forEach((iso) => {
      nextModeByDay[iso] = 'available';
    });

    availabilityEntries.forEach((entry) => {
      const dateKey = String(entry?.date || '').slice(0, 10);
      if (!nextModeByDay[dateKey]) return;
      const status = String(entry?.status || '').toLowerCase();
      nextModeByDay[dateKey] = status === 'open' ? 'available' : 'off';
    });

    setModeByDay(nextModeByDay);
  }, [days, getToken, monthRange.end, monthRange.start]);

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !user)) {
      navigate('/');
    }
  }, [isLoading, isAuthenticated, user, navigate]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!isAuthenticated || !user?.email) return;
      setLoading(true);
      setError('');
      setStatusMessage('');
      try {
        const wid = await loadWorkerId();
        if (!wid) {
          throw new Error('作業者IDが見つかりません（workersマスタ未登録）');
        }
        if (cancelled) return;
        setWorkerId(wid);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '作業者情報の取得に失敗しました');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [isAuthenticated, user?.email, loadWorkerId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!workerId) return;
      setLoading(true);
      setError('');
      setStatusMessage('');
      try {
        await loadMonthData(workerId);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'データ取得に失敗しました');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [workerId, monthISO, loadMonthData]);

  useEffect(() => {
    if (!days.includes(selectedDay) && days.length > 0) {
      setSelectedDay(days[0]);
    }
  }, [days, selectedDay]);

  useEffect(() => {
    if (days.length > 0) {
      setRangeStart(days[0]);
      setRangeEnd(days[Math.max(0, days.length - 1)]);
    }
  }, [monthISO, days]);

  const setDayMode = useCallback((iso, mode) => {
    setModeByDay((prev) => ({ ...prev, [iso]: mode }));
  }, []);

  const applyWeekdayPattern = useCallback(() => {
    setModeByDay((prev) => {
      const next = { ...prev };
      days.forEach((iso) => {
        const dow = dayjs(iso).day();
        next[iso] = (dow === 0 || dow === 6) ? 'off' : 'available';
      });
      return next;
    });
  }, [days]);

  const applyAll = useCallback((mode) => {
    setModeByDay((prev) => {
      const next = { ...prev };
      days.forEach((iso) => {
        next[iso] = mode;
      });
      return next;
    });
  }, [days]);

  const applyRange = useCallback(() => {
    if (!orderedStart || !orderedEnd) return;
    setModeByDay((prev) => {
      const next = { ...prev };
      days.forEach((iso) => {
        if (inRange(iso, orderedStart, orderedEnd)) {
          next[iso] = rangeMode;
        }
      });
      return next;
    });
  }, [days, orderedEnd, orderedStart, rangeMode]);

  const saveDeclarations = useCallback(async () => {
    if (!workerId) return;
    const token = getToken();
    if (!token) {
      setError('認証トークンが取得できません');
      return;
    }

    setSaving(true);
    setError('');
    setStatusMessage('');

    try {
      const headers = {
        Authorization: `Bearer ${String(token).trim()}`,
        'Content-Type': 'application/json',
      };

      for (const iso of days) {
        const mode = modeByDay[iso] || 'available';
        const status = mode === 'available' ? 'open' : 'closed';

        const res = await fetch(`${API_BASE}/workers/me/availability`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ date: iso, status }),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`休み申請保存に失敗しました (${res.status}) ${text}`);
        }
      }

      await loadMonthData(workerId);
      setStatusMessage('休み申請を保存しました。');
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }, [days, getToken, loadMonthData, modeByDay, workerId]);

  if (isLoading || loading) {
    return (
      <div className="contractor-availability-page loading-state">
        <p>読み込み中...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="contractor-availability-page loading-state">
        <p>認証が必要です</p>
        <Link to="/jobs/cleaning/entrance">清掃エントランスへ戻る</Link>
      </div>
    );
  }

  return (
    <div className="contractor-availability-page report-page" data-job="cleaning">
      <div className="report-page-viz">
        <Visualizer mode="base" className="report-page-visualizer" />
      </div>

      <div className="report-page-content contractor-availability-content">
        <header className="gcal-toolbar">
          <div className="gcal-toolbar-left">
            <h1>休み申請カレンダー</h1>
            <p>清掃員ジョブモード / Googleカレンダー風 月表示</p>
          </div>
          <div className="gcal-toolbar-actions">
            <button type="button" className="btn" onClick={() => setMonthISO(dayjs(monthISO).subtract(1, 'month').startOf('month').format('YYYY-MM-DD'))}>◀</button>
            <button type="button" className="btn" onClick={() => setMonthISO(dayjs().add(1, 'month').startOf('month').format('YYYY-MM-DD'))}>来月</button>
            <button type="button" className="btn" onClick={() => setMonthISO(dayjs(monthISO).add(1, 'month').startOf('month').format('YYYY-MM-DD'))}>▶</button>
            <strong className="gcal-month-label">{dayjs(monthISO).format('YYYY年M月')}</strong>
          </div>
        </header>

        <section className="gcal-quick-actions">
          <button type="button" className="btn" onClick={() => applyAll('available')}>全日 稼働可</button>
          <button type="button" className="btn" onClick={applyWeekdayPattern}>平日稼働 / 土日休み</button>
          <button type="button" className="btn" onClick={() => applyAll('off')}>全日 休み</button>
        </section>

        {error ? <div className="status-error" role="alert">{error}</div> : null}
        {statusMessage ? <div className="status-ok">{statusMessage}</div> : null}

        <main className="gcal-layout">
          <section className="gcal-month">
            <div className="gcal-weekdays">
              {['日', '月', '火', '水', '木', '金', '土'].map((w) => <span key={w}>{w}</span>)}
            </div>

            <div className="gcal-grid">
              {calendarWeeks.flatMap((week) => week).map((iso, idx) => {
                if (!iso) return <div key={`empty-${idx}`} className="gcal-cell empty" />;

                const mode = modeByDay[iso] || 'available';
                const active = iso === selectedDay;
                const dayAppts = appointmentsByDay[iso] || [];
                const isToday = iso === todayISO;
                const inPickedRange = orderedStart && orderedEnd ? inRange(iso, orderedStart, orderedEnd) : false;

                return (
                  <button
                    key={iso}
                    type="button"
                    className={`gcal-cell mode-${mode} ${active ? 'active' : ''} ${isToday ? 'today' : ''} ${inPickedRange ? 'range' : ''}`}
                    onClick={() => {
                      setSelectedDay(iso);
                      setRangeStart(iso);
                      setRangeEnd(iso);
                    }}
                  >
                    <div className="gcal-cell-head">
                      <span className="date-dot">{dayjs(iso).date()}</span>
                      <span className="mode-pill">{MODE_LABEL[mode]}</span>
                    </div>
                    <div className="gcal-cell-events">
                      {dayAppts.slice(0, 2).map((a) => (
                        <span key={a.id} className="event-chip" title={a.title}>
                          {dayjs(a.start_at).format('HH:mm')} {a.title}
                        </span>
                      ))}
                      {dayAppts.length > 2 ? <span className="event-chip muted">+{dayAppts.length - 2}件</span> : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="gcal-side-panel">
            <section className="side-card">
              <h2>{dayjs(selectedDay).format('M月D日')} の申請</h2>
              <div className="mode-buttons" role="radiogroup" aria-label="休み申請モード">
                {MODE_ORDER.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className={`mode-btn mode-${mode} ${selectedMode === mode ? 'active' : ''}`}
                    aria-pressed={selectedMode === mode}
                    onClick={() => setDayMode(selectedDay, mode)}
                  >
                    {MODE_LABEL[mode]}
                  </button>
                ))}
              </div>
              <div className="summary-list">
                <p>稼働可: {counts.available}日</p>
                <p>休み: {counts.off}日</p>
              </div>
            </section>

            <section className="side-card">
              <h3>期間一括申請</h3>
              <label className="field-row">
                <span>開始日</span>
                <input type="date" value={rangeStart} min={monthRange.start} max={monthRange.end} onChange={(e) => setRangeStart(e.target.value)} />
              </label>
              <label className="field-row">
                <span>終了日</span>
                <input type="date" value={rangeEnd} min={monthRange.start} max={monthRange.end} onChange={(e) => setRangeEnd(e.target.value)} />
              </label>
              <label className="field-row">
                <span>申請内容</span>
                <select value={rangeMode} onChange={(e) => setRangeMode(e.target.value)}>
                  {MODE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </label>
              <button type="button" className="btn" onClick={applyRange}>この期間へ適用</button>
            </section>

            <section className="side-card">
              <p>対象月: {monthRange.start} 〜 {monthRange.end}</p>
              <p>既存案件: {appointments.length}件</p>
              <p>既存稼働設定: {availabilityItems.length}件</p>
              <button type="button" className="btn btnPrimary save-btn" onClick={saveDeclarations} disabled={saving}>
                {saving ? '保存中...' : '休み申請を保存'}
              </button>
              <p className="save-help">保存先: workers/me/availability（status: open / closed）</p>
            </section>
          </aside>
        </main>
      </div>
    </div>
  );
}
