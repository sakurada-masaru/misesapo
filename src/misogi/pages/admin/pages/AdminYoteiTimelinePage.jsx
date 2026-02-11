import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import './admin-yotei-timeline.css';

function isLocalUiHost() {
    if (typeof window === 'undefined') return false;
    const h = window.location?.hostname || '';
    return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
}

const IS_LOCAL = import.meta.env?.DEV || isLocalUiHost();
const API_BASE = IS_LOCAL
    ? '/api'
    : (import.meta.env?.VITE_API_BASE || 'https://v7komjxk4k.execute-api.ap-northeast-1.amazonaws.com/prod');
const MASTER_API_BASE = IS_LOCAL
    ? '/api-master'
    : (import.meta.env?.VITE_MASTER_API_BASE || 'https://jtn6in2iuj.execute-api.ap-northeast-1.amazonaws.com/prod');
const JINZAI_API_BASE = IS_LOCAL
    ? '/api-jinzai'
    : (import.meta.env?.VITE_JINZAI_API_BASE || 'https://ho3cd7ibtl.execute-api.ap-northeast-1.amazonaws.com/prod');
const YAKUSOKU_FALLBACK_BASE = IS_LOCAL
    ? '/api2'
    : (import.meta.env?.VITE_YAKUSOKU_API_BASE || API_BASE);

const WORK_TYPES = [
    '定期清掃（1ヶ月）',
    '定期清掃（2ヶ月）',
    '定期清掃（3ヶ月）',
    '定期清掃（6ヶ月）',
    '定期清掃（12ヶ月）',
    'スポット清掃',
    'その他'
];

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
    return dayjs().format('YYYY-MM-DD');
}

function weekRange(baseDate) {
    const d = dayjs(baseDate);
    const day = d.day();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const from = d.add(mondayOffset, 'day').format('YYYY-MM-DD');
    const to = dayjs(from).add(6, 'day').format('YYYY-MM-DD');
    return { from, to };
}

function monthRange(baseDate) {
    const d = dayjs(baseDate);
    return {
        from: d.startOf('month').format('YYYY-MM-DD'),
        to: d.endOf('month').format('YYYY-MM-DD'),
    };
}

function itemDate(item) {
    return dayjs(item?.start_at || item?.scheduled_date).format('YYYY-MM-DD');
}

function itemYoteiId(item) {
    return item?.yotei_id || item?.id;
}

function normalizeProgressJotai(v) {
    const s = String(v || '').toLowerCase();
    if (!s) return 'mikanryo';
    if (s === 'working') return 'shinkou';
    if (s === 'done') return 'kanryou';
    if (s === 'todo') return 'mikanryo';
    if (s === 'shinkouchu') return 'shinkou';
    return s;
}

async function fetchYakusokuWithFallback(path, options = {}) {
    const primaryBase = API_BASE.replace(/\/$/, '');
    const primaryRes = await fetch(`${primaryBase}${path}`, options);
    if (primaryRes.ok) return primaryRes;
    if (![401, 403, 404].includes(primaryRes.status)) return primaryRes;
    const fallbackBase = YAKUSOKU_FALLBACK_BASE.replace(/\/$/, '');
    if (fallbackBase === primaryBase) return primaryRes;
    const fallbackRes = await fetch(`${fallbackBase}${path}`, options);
    return fallbackRes;
}

export default function AdminYoteiTimelinePage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const currentView = searchParams.get('view') || 'today';
    const [date, setDate] = useState(todayDateString());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [yakusokuError, setYakusokuError] = useState('');
    const [schedules, setSchedules] = useState([]);
    const [workers, setWorkers] = useState([]);
    const [yakusokus, setYakusokus] = useState([]);
    const [services, setServices] = useState([]);
    const [ugokiItems, setUgokiItems] = useState([]);
    const [tenpoNameMap, setTenpoNameMap] = useState({});
    const [searchQuery, setSearchQuery] = useState('');
    const [modalData, setModalData] = useState(null);
    const [saving, setSaving] = useState(false);
    const tenpoCacheRef = useRef(new Map());
    const tenpoMasterLoadedRef = useRef(false);

    // 時間枠の定義 (16:00 - 翌04:00)
    const hours = [16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4];
    const durationHours = 12;

    const clearTenpoCache = useCallback(() => {
        tenpoCacheRef.current = new Map();
        tenpoMasterLoadedRef.current = false;
        setTenpoNameMap({});
    }, []);

    const ensureTenpoMasterCache = useCallback(async () => {
        if (tenpoMasterLoadedRef.current) return;
        const base = MASTER_API_BASE.replace(/\/$/, '');
        try {
            const res = await fetch(`${base}/master/tenpo?limit=20000&jotai=yuko`, { headers: authHeaders(), cache: 'no-store' });
            if (!res.ok) return;
            const data = await res.json();
            const items = Array.isArray(data) ? data : (data?.items || []);
            items.forEach((it) => {
                const id = it?.tenpo_id || it?.id;
                if (!id) return;
                tenpoCacheRef.current.set(id, it?.name || '');
            });
            tenpoMasterLoadedRef.current = true;
        } catch (e) {
            // tenpo マスタが落ちている場合はIDフォールバックで継続する。
            console.warn('ensureTenpoMasterCache failed', e);
        }
    }, []);

    const hydrateTenpoNames = useCallback(async (rows) => {
        const items = Array.isArray(rows) ? rows : [];
        const tenpoIds = Array.from(new Set(items.map((r) => r?.tenpo_id).filter(Boolean)));
        if (tenpoIds.length === 0) return items;

        await ensureTenpoMasterCache();
        tenpoIds.forEach((id) => {
            if (!tenpoCacheRef.current.has(id)) tenpoCacheRef.current.set(id, '');
        });

        const nextMap = {};
        tenpoCacheRef.current.forEach((v, k) => { nextMap[k] = v; });
        setTenpoNameMap(nextMap);

        return items.map((it) => ({
            ...it,
            tenpo_name: nextMap[it.tenpo_id] || it.tenpo_name || '',
        }));
    }, [ensureTenpoMasterCache]);

    const fetchWorkers = useCallback(async () => {
        try {
            // 旧 /workers は使用しない。jinzai を作業員マスタの正として使う。
            const base = JINZAI_API_BASE.replace(/\/$/, '');
            const res = await fetch(`${base}/jinzai?limit=1000&jotai=yuko`, { headers: authHeaders(), cache: 'no-store' });
            if (!res.ok) throw new Error(`JINZAI HTTP ${res.status}`);
            const data = await res.json();
            const items = Array.isArray(data) ? data : (data?.items || []);

            // Timeline の縦軸: 基本は worker yakuwari、なければ清掃/メンテ職種。
            const baseWorkers = items
                .filter((it) => it?.jotai !== 'torikeshi')
                .filter((it) => {
                    const yakuwari = it?.yakuwari || [];
                    if (Array.isArray(yakuwari) && yakuwari.includes('worker')) return true;
                    const shokushu = it?.shokushu || [];
                    return Array.isArray(shokushu) && (shokushu.includes('seisou') || shokushu.includes('maintenance'));
                })
                .map((it) => ({
                    id: it.jinzai_id || it.sagyouin_id || it.worker_id || it.id,
                    name: it.name || it.email || it.jinzai_id || it.id,
                }))
                .filter((v) => v.id);

            setWorkers(baseWorkers);
        } catch (e) { console.error('Failed to fetch workers:', e); }
    }, []);

    const fetchYakusokus = useCallback(async () => {
        try {
            setYakusokuError('');
            const res = await fetchYakusokuWithFallback('/yakusoku', { headers: authHeaders() });
            if (!res.ok) throw new Error(`Yakusoku HTTP ${res.status}`);
            const data = await res.json();
            setYakusokus(data.items || []);
        } catch (e) {
            console.error('Failed to fetch yakusokus:', e);
            setYakusokuError('yakusokuの取得に失敗しました（権限不足の可能性）。既存予定から候補を抽出します。');
            try {
                const base = API_BASE.replace(/\/$/, '');
                const ys = await fetch(`${base}/yotei?date=${date}&limit=2000`, { headers: authHeaders(), cache: 'no-store' });
                if (ys.ok) {
                    const yData = await ys.json();
                    const yItems = Array.isArray(yData) ? yData : (yData?.items || []);
                    const map = new Map();
                    yItems.forEach((it) => {
                        const y = it.yakusoku || null;
                        const yid = it.yakusoku_id || y?.yakusoku_id || y?.id;
                        if (!yid || map.has(yid)) return;
                        map.set(yid, {
                            yakusoku_id: yid,
                            tenpo_id: it.tenpo_id || y?.tenpo_id || '',
                            tenpo_name: it.tenpo_name || y?.tenpo_name || '',
                            type: y?.type || 'teiki',
                        });
                    });
                    setYakusokus(Array.from(map.values()));
                }
            } catch (fallbackErr) {
                console.error('Yakusoku fallback from yotei failed:', fallbackErr);
            }
        }
    }, [date]);

    const calcEndTimeByDuration = useCallback((startTime, durationMin) => {
        const start = dayjs(`2000-01-01T${startTime}:00`);
        return start.add(Number(durationMin || 0), 'minute').format('HH:mm');
    }, []);

    const fetchServices = useCallback(async () => {
        try {
            const base = MASTER_API_BASE.replace(/\/$/, '');
            const res = await fetch(`${base}/master/service?limit=2000&jotai=yuko`, { headers: authHeaders(), cache: 'no-store' });
            if (!res.ok) throw new Error(`Service HTTP ${res.status}`);
            const data = await res.json();
            const items = Array.isArray(data) ? data : (data?.items || []);
            setServices(items);
        } catch (e) {
            console.error('Failed to fetch services:', e);
            setServices([]);
        }
    }, []);

    const fetchSchedules = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const base = API_BASE.replace(/\/$/, '');
            const res = await fetch(`${base}/yotei?date=${date}&limit=1000`, { headers: authHeaders() });
            if (!res.ok) throw new Error(`Schedules HTTP ${res.status}`);
            const data = await res.json();
            const items = Array.isArray(data) ? data : (data?.items || []);
            const hydrated = await hydrateTenpoNames(items);
            setSchedules(hydrated);
        } catch (e) { setError(e.message || 'スケジュールの取得に失敗しました'); }
        finally { setLoading(false); }
    }, [date, hydrateTenpoNames]);

    const fetchSchedulesRange = useCallback(async (from, to) => {
        setLoading(true);
        setError('');
        try {
            const base = API_BASE.replace(/\/$/, '');
            const rangeRes = await fetch(`${base}/yotei?from=${from}&to=${to}&limit=3000`, { headers: authHeaders() });
            if (rangeRes.ok) {
                const data = await rangeRes.json();
                const items = Array.isArray(data) ? data : (data?.items || []);
                const hydrated = await hydrateTenpoNames(items);
                setSchedules(hydrated);
                return;
            }
            const days = [];
            let cur = dayjs(from);
            const end = dayjs(to);
            while (cur.isBefore(end) || cur.isSame(end, 'day')) {
                days.push(cur.format('YYYY-MM-DD'));
                cur = cur.add(1, 'day');
            }
            const all = [];
            for (const d of days) {
                const res = await fetch(`${base}/yotei?date=${d}&limit=1000`, { headers: authHeaders() });
                if (!res.ok) continue;
                const data = await res.json();
                const items = Array.isArray(data) ? data : (data?.items || []);
                all.push(...items);
            }
            const hydrated = await hydrateTenpoNames(all);
            setSchedules(hydrated);
        } catch (e) {
            setError(e.message || 'スケジュールの取得に失敗しました');
        } finally {
            setLoading(false);
        }
    }, [hydrateTenpoNames]);

    const fetchUgokiRange = useCallback(async (from, to) => {
        try {
            const base = API_BASE.replace(/\/$/, '');
            const res = await fetch(`${base}/ugoki?from=${from}&to=${to}&limit=3000`, { headers: authHeaders() });
            if (!res.ok) {
                setUgokiItems([]);
                return;
            }
            const data = await res.json();
            setUgokiItems(Array.isArray(data) ? data : (data?.items || []));
        } catch {
            setUgokiItems([]);
        }
    }, []);

    useEffect(() => { fetchWorkers(); fetchYakusokus(); fetchServices(); }, [fetchWorkers, fetchYakusokus, fetchServices]);
    useEffect(() => {
        // 当日表示キャッシュ方針: 日付/ビュー切替時に店舗名キャッシュをクリア
        clearTenpoCache();
    }, [date, currentView, clearTenpoCache]);
    useEffect(() => {
        if (currentView === 'week') {
            const { from, to } = weekRange(date);
            fetchSchedulesRange(from, to);
            fetchUgokiRange(from, to);
            return;
        }
        if (currentView === 'month') {
            const { from, to } = monthRange(date);
            fetchSchedulesRange(from, to);
            fetchUgokiRange(from, to);
            return;
        }
        if (currentView === 'today') {
            const d = todayDateString();
            fetchSchedulesRange(d, d);
            fetchUgokiRange(d, d);
            return;
        }
        fetchSchedules();
        fetchUgokiRange(date, date);
    }, [currentView, date, fetchSchedules, fetchSchedulesRange, fetchUgokiRange]);

    const filteredWorkers = useMemo(() => {
        if (!searchQuery) return workers;
        const q = searchQuery.toLowerCase();
        return workers.filter(w => w.name.toLowerCase().includes(q) || w.id.toLowerCase().includes(q));
    }, [workers, searchQuery]);

    const schedulesByWorker = useMemo(() => {
        const map = new Map();
        schedules.forEach(s => {
            const wId = s.sagyouin_id || s.worker_id || 'unassigned';
            if (!map.has(wId)) map.set(wId, []);
            map.get(wId).push(s);
        });
        return map;
    }, [schedules]);

    const ugokiByYoteiId = useMemo(() => {
        const map = new Map();
        ugokiItems.forEach((u) => {
            const key = itemYoteiId(u);
            if (key) map.set(key, u);
        });
        return map;
    }, [ugokiItems]);

    const progressFor = useCallback((s) => {
        if (s.jotai === 'torikeshi') return 'torikeshi';
        const u = ugokiByYoteiId.get(itemYoteiId(s));
        const p = normalizeProgressJotai(u?.jotai || u?.jokyo || s.ugoki_jotai || s.jokyo);
        if (p === 'kanryou' || p === 'shinkou' || p === 'mikanryo') return p;
        return 'mikanryo';
    }, [ugokiByYoteiId]);

    const warningLevelFor = useCallback((s) => {
        const u = ugokiByYoteiId.get(itemYoteiId(s));
        if (!u?.updated_at) return 0;
        const p = progressFor(s);
        if (p === 'kanryou' || p === 'torikeshi') return 0;
        const mins = dayjs().diff(dayjs(u.updated_at), 'minute');
        if (mins >= 60) return 2;
        if (mins >= 30) return 1;
        return 0;
    }, [ugokiByYoteiId, progressFor]);

    const todayTimeline = useMemo(() => {
        const today = todayDateString();
        const base = dayjs(today).hour(16).minute(0).second(0);
        const totalMinutes = durationHours * 60;
        const src = schedules
            .slice()
            .sort((a, b) => dayjs(a.start_at).valueOf() - dayjs(b.start_at).valueOf());

        const lanes = [];
        const placed = src.map((s) => {
            const rawStart = dayjs(s.start_at).diff(base, 'minute');
            const rawEnd = dayjs(s.end_at).diff(base, 'minute');
            const startMin = Math.max(0, Math.min(totalMinutes, rawStart));
            const endMin = Math.max(0, Math.min(totalMinutes, rawEnd));

            let lane = lanes.findIndex((laneEnd) => laneEnd <= startMin);
            if (lane === -1) {
                lane = lanes.length;
                lanes.push(endMin);
            } else {
                lanes[lane] = endMin;
            }

            return {
                ...s,
                lane,
                startMin,
                endMin,
                leftPct: (startMin / totalMinutes) * 100,
                widthPct: Math.max(2, ((Math.max(endMin, startMin + 15) - startMin) / totalMinutes) * 100),
            };
        });

        return { items: placed, laneCount: Math.max(1, lanes.length) };
    }, [schedules, durationHours]);

    const weekDays = useMemo(() => {
        const { from } = weekRange(date);
        return Array.from({ length: 7 }).map((_, i) => dayjs(from).add(i, 'day').format('YYYY-MM-DD'));
    }, [date]);

    const monthlyDays = useMemo(() => {
        const start = dayjs(date).startOf('month');
        const end = dayjs(date).endOf('month');
        const days = [];
        let cur = start;
        while (cur.isBefore(end) || cur.isSame(end, 'day')) {
            days.push(cur.format('YYYY-MM-DD'));
            cur = cur.add(1, 'day');
        }
        return days;
    }, [date]);

    const weeklyCell = useCallback((workerId, day) => {
        const items = schedules.filter((s) => (s.sagyouin_id || s.worker_id) === workerId && itemDate(s) === day);
        const yukoItems = items.filter((s) => s.jotai !== 'torikeshi');
        const counts = {
            yotei: yukoItems.length,
            mikanryo: 0,
            shinkou: 0,
            kanryou: 0,
            torikeshi: items.filter((s) => s.jotai === 'torikeshi').length,
        };
        yukoItems.forEach((s) => {
            const p = progressFor(s);
            if (p === 'shinkou') counts.shinkou += 1;
            else if (p === 'kanryou') counts.kanryou += 1;
            else counts.mikanryo += 1;
        });
        return counts;
    }, [schedules, progressFor]);

    const openDayTimeline = useCallback((d) => {
        setDate(d);
        setSearchParams({ view: 'timeline' });
    }, [setSearchParams]);

    const displayTenpoName = useCallback((row) => {
        if (!row) return '現場未設定';
        return tenpoNameMap[row.tenpo_id] || row.tenpo_name || '現場未設定';
    }, [tenpoNameMap]);

    const weekSummary = useMemo(() => {
        const yuko = schedules.filter((s) => s.jotai !== 'torikeshi');
        const total = yuko.length;
        const byWorker = workers.map((w) => ({
            worker: w,
            count: yuko.filter((s) => (s.sagyouin_id || s.worker_id) === w.id).length,
        }));
        const sorted = [...byWorker].sort((a, b) => b.count - a.count);
        const blankDays = weekDays.filter((d) => yuko.filter((s) => itemDate(s) === d).length === 0);
        return {
            total,
            top: sorted[0] || null,
            low: sorted[sorted.length - 1] || null,
            blankDays,
        };
    }, [schedules, workers, weekDays]);

    const monthSummary = useMemo(() => {
        const yuko = schedules.filter((s) => s.jotai !== 'torikeshi');
        const total = yuko.length;
        const byWorker = workers.map((w) => ({
            worker: w,
            count: yuko.filter((s) => (s.sagyouin_id || s.worker_id) === w.id).length,
        }));
        const byYakusokuUsed = new Map();
        yuko.forEach((s) => {
            if (progressFor(s) !== 'kanryou') return;
            const key = s.yakusoku_id;
            if (!key) return;
            byYakusokuUsed.set(key, (byYakusokuUsed.get(key) || 0) + 1);
        });
        const yakusokuConsumption = yakusokus.slice(0, 10).map((y) => {
            const quota =
                Number(y.monthly_quota) ||
                Number(y.quota) ||
                Number(y?.recurrence_rule?.monthly_quota) ||
                0;
            const used = byYakusokuUsed.get(y.yakusoku_id) || 0;
            return {
                id: y.yakusoku_id,
                tenpo_name: y.tenpo_name || y.memo || y.yakusoku_id,
                quota,
                used,
                remaining: quota > 0 ? Math.max(0, quota - used) : null,
            };
        });
        return { total, byWorker, yakusokuConsumption };
    }, [schedules, workers, yakusokus, progressFor]);

    const openNewModal = (workerId) => {
        setModalData({
            isNew: true,
            sagyouin_id: workerId || (workers[0]?.id || ''),
            yakusoku_id: '',
            service_id: '',
            service_name: '',
            scheduled_date: date,
            start_time: '20:00',
            end_time: '22:00',
            tenpo_name: '',
            work_type: '定期清掃（1ヶ月）',
            memo: '',
            jotai: 'yuko'
        });
    };

    const openEditModal = (s) => {
        setModalData({
            ...s,
            isNew: false,
            service_id: s.service_id || '',
            service_name: s.service_name || '',
            start_time: s.start_at ? dayjs(s.start_at).format('HH:mm') : '20:00',
            end_time: s.end_at ? dayjs(s.end_at).format('HH:mm') : '22:00'
        });
    };

    const saveModal = async () => {
        if (!modalData?.yakusoku_id) { window.alert('紐付ける契約(yakusoku)を選択してください'); return; }
        setSaving(true);
        try {
            const base = API_BASE.replace(/\/$/, '');
            const method = modalData.isNew ? 'POST' : 'PUT';
            const url = modalData.isNew ? `${base}/yotei` : `${base}/yotei/${modalData.id}`;

            const startH = parseInt(modalData.start_time.split(':')[0]);
            const endH = parseInt(modalData.end_time.split(':')[0]);
            const startDate = (startH < 12) ? dayjs(modalData.scheduled_date).add(1, 'day').format('YYYY-MM-DD') : modalData.scheduled_date;
            const endDate = (endH < 12) ? dayjs(modalData.scheduled_date).add(1, 'day').format('YYYY-MM-DD') : modalData.scheduled_date;

            const payload = {
                ...modalData,
                start_at: `${startDate}T${modalData.start_time}:00`,
                end_at: `${endDate}T${modalData.end_time}:00`,
                service_id: modalData.service_id || '',
                service_name: modalData.service_name || '',
            };

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                body: JSON.stringify(payload)
            });
            if (!res.ok) { const err = await res.json(); throw new Error(err.message || `Save failed: ${res.status}`); }
            setModalData(null);
            fetchSchedules();
        } catch (e) { window.alert(e.message); }
        finally { setSaving(false); }
    };

    const deleteSchedule = async (id) => {
        if (!window.confirm('この予定を取り消しますか？')) return;
        try {
            const base = API_BASE.replace(/\/$/, '');
            const res = await fetch(`${base}/yotei/${id}`, { method: 'DELETE', headers: authHeaders() });
            if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
            fetchSchedules();
            setModalData(null);
        } catch (e) { window.alert(e.message); }
    };

    const getPosition = (startAt, endAt) => {
        const s = dayjs(startAt);
        const e = dayjs(endAt);
        const baseDateAt16 = dayjs(date).hour(16).minute(0).second(0);
        const startDiff = s.diff(baseDateAt16, 'minute');
        const endDiff = e.diff(baseDateAt16, 'minute');
        const totalMinutes = durationHours * 60;
        if (endDiff <= 0 || startDiff >= totalMinutes) return { display: 'none' };
        const left = (startDiff / totalMinutes) * 100;
        const width = ((endDiff - startDiff) / totalMinutes) * 100;
        return { left: `${Math.max(0, left)}%`, width: `${Math.min(100 - Math.max(0, left), width)}%` };
    };

    return (
        <div className="admin-yotei-timeline-page">
            <div className="admin-yotei-timeline-content">
                <header className="yotei-head">
                    <Link to="/admin/entrance" style={{ color: 'var(--muted)', textDecoration: 'none' }}>← 管理トップ</Link>
                    <h1>清掃管制スケジュール (16:00-翌04:00)</h1>
                    <div className="yotei-head-actions">
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                        <input type="text" placeholder="作業員検索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                        <button className="primary" onClick={() => openNewModal()}>新規登録</button>
                        <button
                            onClick={() => {
                                if (currentView === 'week') {
                                    const { from, to } = weekRange(date);
                                    fetchSchedulesRange(from, to);
                                    fetchUgokiRange(from, to);
                                    return;
                                }
                                if (currentView === 'month') {
                                    const { from, to } = monthRange(date);
                                    fetchSchedulesRange(from, to);
                                    fetchUgokiRange(from, to);
                                    return;
                                }
                                if (currentView === 'today') {
                                    const d = todayDateString();
                                    fetchSchedulesRange(d, d);
                                    fetchUgokiRange(d, d);
                                    return;
                                }
                                fetchSchedules();
                                fetchUgokiRange(date, date);
                            }}
                            disabled={loading}
                        >
                            {loading ? '...' : '更新'}
                        </button>
                    </div>
                </header>
                <div className="yotei-view-tabs">
                    <button className={currentView === 'today' ? 'active' : ''} onClick={() => setSearchParams({ view: 'today' })}>今日</button>
                    <button className={currentView === 'week' ? 'active' : ''} onClick={() => setSearchParams({ view: 'week' })}>週間</button>
                    <button className={currentView === 'month' ? 'active' : ''} onClick={() => setSearchParams({ view: 'month' })}>月間</button>
                    <button className={currentView === 'timeline' ? 'active' : ''} onClick={() => setSearchParams({ view: 'timeline' })}>予約表</button>
                </div>
                {yakusokuError ? <div style={{ margin: '8px 0', color: '#fbbf24' }}>{yakusokuError}</div> : null}
                {currentView === 'today' && (
                    <div className="yotei-today-wrap">
                        <div className="yotei-summary-cards">
                            <div className="sum-card"><div>本日予定数</div><strong>{schedules.filter((s) => s.jotai !== 'torikeshi').length}</strong></div>
                            <div className="sum-card"><div>進行中</div><strong>{schedules.filter((s) => progressFor(s) === 'shinkou').length}</strong></div>
                            <div className="sum-card"><div>完了</div><strong>{schedules.filter((s) => progressFor(s) === 'kanryou').length}</strong></div>
                            <div className="sum-card"><div>停滞警告</div><strong>{schedules.filter((s) => warningLevelFor(s) > 0).length}</strong></div>
                        </div>
                        <div className="today-scroll-wrap">
                            <div className="today-timeline-inner">
                                <div className="today-time-header">
                                    {hours.slice(0, -1).map((h, i) => (
                                        <div key={i} className="today-time-cell">{String(h).padStart(2, '0')}:00</div>
                                    ))}
                                </div>
                                <div className="today-time-rail" style={{ height: `${todayTimeline.laneCount * 56}px` }}>
                                    {todayTimeline.items.map((s) => {
                                        const warn = warningLevelFor(s);
                                        return (
                                            <button
                                                key={s.id}
                                                className={`today-rail-card ${s.jotai === 'torikeshi' ? 'torikeshi' : ''} ${warn === 2 ? 'danger' : warn === 1 ? 'warn' : ''}`}
                                                style={{
                                                    left: `${s.leftPct}%`,
                                                    width: `${s.widthPct}%`,
                                                    top: `${s.lane * 56 + 4}px`,
                                                }}
                                                onClick={() => openEditModal(s)}
                                            >
                                                <div className="today-rail-time">{dayjs(s.start_at).format('HH:mm')} - {dayjs(s.end_at).format('HH:mm')}</div>
                                                <div className="today-rail-tenpo">{displayTenpoName(s)}</div>
                                                <div className="today-rail-meta">
                                                    <span>{s.sagyouin_name || '担当未設定'}</span>
                                                    <span>{progressFor(s)} {warn === 2 ? '🔴' : warn === 1 ? '⚠' : ''}</span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {currentView === 'week' && (
                    <div className="yotei-week-wrap">
                        <div className="yotei-summary-cards">
                            <div className="sum-card"><div>週合計件数</div><strong>{weekSummary.total}</strong></div>
                            <div className="sum-card"><div>最多</div><strong>{weekSummary.top ? `${weekSummary.top.worker.name} (${weekSummary.top.count})` : '-'}</strong></div>
                            <div className="sum-card"><div>最少</div><strong>{weekSummary.low ? `${weekSummary.low.worker.name} (${weekSummary.low.count})` : '-'}</strong></div>
                            <div className="sum-card"><div>空白日</div><strong>{weekSummary.blankDays.length > 0 ? weekSummary.blankDays.map((d) => dayjs(d).format('M/D')).join(', ') : 'なし'}</strong></div>
                        </div>
                        <div className="week-grid">
                            <div className="week-row week-head">
                                <div className="worker-col">作業員</div>
                                {weekDays.map((d) => <div key={d}>{dayjs(d).format('M/D(dd)')}</div>)}
                            </div>
                            {filteredWorkers.map((w) => (
                                <div className="week-row" key={w.id}>
                                    <div className="worker-col">
                                        <div>{w.name}</div>
                                    </div>
                                    {weekDays.map((d) => {
                                        const c = weeklyCell(w.id, d);
                                        let cls = '';
                                        if (c.shinkou > 0) cls = 'shinkou';
                                        else if (c.yotei > 0 && c.kanryou === c.yotei) cls = 'kanryou';
                                        else if (c.torikeshi > 0 && c.yotei === 0) cls = 'torikeshi';
                                        const empty = c.yotei === 0 && c.torikeshi === 0;
                                        return (
                                            <button key={`${w.id}-${d}`} className={`week-cell ${cls}`} onClick={() => openDayTimeline(d)}>
                                                <div>{c.yotei}件 {empty ? '⚠' : ''}</div>
                                                <small>未:{c.mikanryo} 進:{c.shinkou} 完:{c.kanryou} 取:{c.torikeshi}</small>
                                            </button>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {currentView === 'month' && (
                    <div className="yotei-month-wrap">
                        <div className="yotei-summary-cards">
                            <div className="sum-card"><div>月合計予定</div><strong>{monthSummary.total}</strong></div>
                            <div className="sum-card"><div>作業員数</div><strong>{workers.length}</strong></div>
                            <div className="sum-card"><div>0件日</div><strong>{monthlyDays.filter((d) => schedules.filter((s) => itemDate(s) === d && s.jotai !== 'torikeshi').length === 0).length}</strong></div>
                        </div>
                        <div className="month-calendar">
                            {monthlyDays.map((d) => {
                                const cnt = schedules.filter((s) => itemDate(s) === d && s.jotai !== 'torikeshi').length;
                                return (
                                    <button key={d} className="month-day" onClick={() => openDayTimeline(d)}>
                                        <div>{dayjs(d).format('D')}</div>
                                        <strong>{cnt}件</strong>
                                        {cnt === 0 ? <span>⚠</span> : null}
                                    </button>
                                );
                            })}
                        </div>
                        {monthSummary.yakusokuConsumption.length > 0 && (
                            <div className="yakusoku-consumption">
                                <h3>yakusoku消化サマリー</h3>
                                {monthSummary.yakusokuConsumption.map((y) => (
                                    <div key={y.id} className="yakusoku-row">
                                        <span>{displayTenpoName(y)}</span>
                                        <span>{y.quota > 0 ? `${y.used}/${y.quota}（残 ${y.remaining}）` : `${y.used}（quota未設定）`}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {currentView === 'timeline' && (
                    <div className="yotei-grid-container">
                        <div className="yotei-grid-header">
                            <div className="yotei-grid-header-cell worker-col">作業員</div>
                            {hours.slice(0, -1).map((h, i) => <div key={i} className="yotei-grid-header-cell">{h}:00</div>)}
                        </div>
                        {filteredWorkers.map(w => (
                            <div key={w.id} className="yotei-row">
                                <div className="yotei-worker-cell">
                                    <div className="yotei-worker-name">{w.name}</div>
                                    <div className="yotei-worker-id">{w.id}</div>
                                </div>
                                <div className="yotei-timeline-cell" onClick={(e) => { if (e.target === e.currentTarget) openNewModal(w.id); }}>
                                    {(schedulesByWorker.get(w.id) || []).map(s => (
                                        <div key={s.id} className={`yotei-card ${s.jotai === 'torikeshi' ? 'torikeshi' : ''}`} style={getPosition(s.start_at, s.end_at)} onClick={() => openEditModal(s)}>
                                            <div className="yotei-card-tenpo">{displayTenpoName(s)}</div>
                                            <div className="yotei-card-time">{dayjs(s.start_at).format('HH:mm')} - {dayjs(s.end_at).format('HH:mm')}</div>
                                            {s.yakusoku && <div style={{ fontSize: '9px', opacity: 0.7 }}>{s.yakusoku.type === 'teiki' ? '月額' : '単発'}</div>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {modalData && (
                <div className="yotei-modal-overlay" onClick={() => setModalData(null)}>
                    <div className="yotei-modal" onClick={e => e.stopPropagation()}>
                        <div className="yotei-modal-header">
                            <h2>{modalData.isNew ? '新規予定登録' : '予定編集'}</h2>
                            <button onClick={() => setModalData(null)} style={{ background: 'none', border: 'none', color: 'white', fontSize: 24 }}>×</button>
                        </div>
                        <div className="yotei-modal-content">
                            <div className="yotei-form-group">
                                <label>紐付け契約 (yakusoku) *必須</label>
                                <select value={modalData.yakusoku_id || ''} onChange={e => {
                                    const yid = e.target.value;
                                    const selected = yakusokus.find(y => y.yakusoku_id === yid);
                                    setModalData({
                                        ...modalData,
                                        yakusoku_id: yid,
                                        tenpo_id: selected?.tenpo_id || modalData.tenpo_id,
                                        tenpo_name: displayTenpoName(selected) || selected?.memo || modalData.tenpo_name
                                    });
                                }} required>
                                    <option value="">選択してください</option>
                                    {yakusokus.map(y => (
                                        <option key={y.yakusoku_id} value={y.yakusoku_id}>
                                            [{y.type === 'teiki' ? '定期' : '単発'}] {displayTenpoName(y) || y.yakusoku_id}
                                        </option>
                                    ))}
                                </select>
                                {yakusokus.length === 0 && (
                                    <input
                                        type="text"
                                        placeholder="yakusoku_id を直接入力"
                                        value={modalData.yakusoku_id || ''}
                                        onChange={e => setModalData({ ...modalData, yakusoku_id: e.target.value })}
                                    />
                                )}
                            </div>
                            <div className="yotei-form-group">
                                <label>担当作業員</label>
                                <select value={modalData.sagyouin_id} onChange={e => setModalData({ ...modalData, sagyouin_id: e.target.value })}>
                                    {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </div>
                            <div className="yotei-form-group">
                                <label>現場名 (自動設定されます)</label>
                                <input type="text" value={modalData.tenpo_name} onChange={e => setModalData({ ...modalData, tenpo_name: e.target.value })} placeholder="店舗名・施設名" />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                <div className="yotei-form-group">
                                    <label>開始時間 (16:00-04:00)</label>
                                    <input type="time" value={modalData.start_time} onChange={e => setModalData({ ...modalData, start_time: e.target.value })} />
                                </div>
                                <div className="yotei-form-group">
                                    <label>終了時間</label>
                                    <input type="time" value={modalData.end_time} onChange={e => setModalData({ ...modalData, end_time: e.target.value })} />
                                </div>
                            </div>
                            <div className="yotei-form-group">
                                <label>作業種別</label>
                                <select value={modalData.work_type} onChange={e => setModalData({ ...modalData, work_type: e.target.value })}>
                                    {WORK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div className="yotei-form-group">
                                <label>サービス</label>
                                <select
                                    value={modalData.service_id || ''}
                                    onChange={e => {
                                        const sid = e.target.value;
                                        const svc = services.find((x) => x.service_id === sid);
                                        setModalData({
                                            ...modalData,
                                            service_id: sid,
                                            service_name: svc?.name || '',
                                            work_type: svc?.name || modalData.work_type,
                                            end_time: svc?.default_duration_min
                                                ? calcEndTimeByDuration(modalData.start_time, svc.default_duration_min)
                                                : modalData.end_time,
                                        });
                                    }}
                                >
                                    <option value="">選択してください</option>
                                    {services.map((s) => (
                                        <option key={s.service_id} value={s.service_id}>
                                            {s.name} ({s.category})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="yotei-form-group">
                                <label>メモ</label>
                                <textarea value={modalData.memo} onChange={e => setModalData({ ...modalData, memo: e.target.value })} rows={3} />
                            </div>
                            <div className="yotei-form-group">
                                <label>状態</label>
                                <select value={modalData.jotai} onChange={e => setModalData({ ...modalData, jotai: e.target.value })}>
                                    <option value="yuko">有効</option>
                                    <option value="torikeshi">取消</option>
                                </select>
                            </div>
                        </div>
                        <div className="yotei-modal-footer">
                            {!modalData.isNew && <button className="danger" onClick={() => deleteSchedule(modalData.id)}>予定取消</button>}
                            <button onClick={() => setModalData(null)}>キャンセル</button>
                            <button className="primary" onClick={saveModal} disabled={saving}>{saving ? '保存中...' : '保存'}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
