import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import './admin-yotei-timeline.css';
import { normalizeGatewayBase, YOTEI_GATEWAY } from '../../shared/api/gatewayBase';
// Hamburger / admin-top are provided by GlobalNav.

function isLocalUiHost() {
    if (typeof window === 'undefined') return false;
    const h = window.location?.hostname || '';
    return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
}

const IS_LOCAL = import.meta.env?.DEV || isLocalUiHost();
const API_BASE = IS_LOCAL
    ? '/api'
    : normalizeGatewayBase(import.meta.env?.VITE_API_BASE, YOTEI_GATEWAY);
const MASTER_API_BASE = IS_LOCAL
    ? '/api-master'
    : normalizeGatewayBase(import.meta.env?.VITE_MASTER_API_BASE, 'https://jtn6in2iuj.execute-api.ap-northeast-1.amazonaws.com/prod');
const JINZAI_API_BASE = IS_LOCAL
    ? '/api-jinzai'
    : normalizeGatewayBase(import.meta.env?.VITE_JINZAI_API_BASE, 'https://ho3cd7ibtl.execute-api.ap-northeast-1.amazonaws.com/prod');
const YAKUSOKU_FALLBACK_BASE = IS_LOCAL
    ? '/api2'
    : normalizeGatewayBase(import.meta.env?.VITE_YAKUSOKU_API_BASE, API_BASE);

const WORK_TYPES = [
    '定期清掃（1ヶ月）',
    '定期清掃（2ヶ月）',
    '定期清掃（3ヶ月）',
    '定期清掃（6ヶ月）',
    '定期清掃（12ヶ月）',
    'スポット清掃',
    'その他'
];

const AKI_MARKS = {
    full: { key: 'full', mark: '◎', label: '十分空きあり' },
    ok: { key: 'ok', mark: '○', label: '空きあり' },
    few: { key: 'few', mark: '△', label: '空き少なめ' },
    none: { key: 'none', mark: '×', label: '空きなし' },
};

const TROUBLE_EVENT_DEFS = [
    {
        key: 'reclean',
        label: '再清掃',
        match: ['reclean', 're-clean', '再清掃', 'やり直し', '再実施', '再訪問'],
    },
    {
        key: 'lack_consumption',
        label: '不足清掃消化',
        match: ['不足清掃', '不足清掃消化', '不足分消化', '不足消化', '消化対応'],
    },
    {
        key: 'claim_followup',
        label: 'クレーム再対応',
        match: ['クレーム', 'claim', '再対応', '手直し'],
    },
];

const CAPACITY_PER_WORKER = {
    safe: 2,
    standard: 2.5,
    max: 3,
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

function normalizeTimelineStatus(v) {
    const s = String(v || '').toLowerCase().trim();
    if (!s) return 'mikanryo';
    if (['kanryou', 'done', 'completed', 'complete'].includes(s)) return 'kanryou';
    if (['shinkou', 'working', 'in_progress', 'shinkouchu', 'progress'].includes(s)) return 'shinkou';
    if (['kakunin', 'kakuninchu', 'confirm', 'checking'].includes(s)) return 'kakunin';
    if (['chousei', 'chouseichu', 'adjust', 'adjusting', 'coordination'].includes(s)) return 'chousei';
    if (['mikanryo', 'todo', 'pending', 'wait'].includes(s)) return 'mikanryo';
    return 'mikanryo';
}

function isDemoMode(searchParams) {
    const v = searchParams?.get?.('demo');
    return v === '1' || v === 'true';
}

function demoDataFor({ date, view }) {
    // UI verification mode: does not require any API to be up.
    // Keep it deterministic per date to make screenshots comparable.
    const d = dayjs(date || todayDateString());
    const baseDate = d.format('YYYY-MM-DD');

    const workers = [
        { id: 'JINZAI#DEMO01', name: '佐藤（デモ）' },
        { id: 'JINZAI#DEMO02', name: '鈴木（デモ）' },
        { id: 'JINZAI#DEMO03', name: '高橋（デモ）' },
    ];

    const tenpos = [
        { tenpo_id: 'TENPO#DEMO01', torihikisaki_id: 'TORI#DEMO01', yagou_id: 'YAGOU#DEMO01', name: '丸鶏 るいすけ 本店（デモ）' },
        { tenpo_id: 'TENPO#DEMO02', torihikisaki_id: 'TORI#DEMO02', yagou_id: 'YAGOU#DEMO02', name: 'ゴーゴーカレー 神田（デモ）' },
        { tenpo_id: 'TENPO#DEMO03', torihikisaki_id: 'TORI#DEMO03', yagou_id: 'YAGOU#DEMO03', name: 'モンキーツリー 中野（デモ）' },
    ];

    const tenpoNameMap = Object.fromEntries(tenpos.map((t) => [t.tenpo_id, t.name]));

    const yakusokus = [
        { yakusoku_id: 'YAKU#DEMO01', tenpo_id: tenpos[0].tenpo_id, type: 'teiki', memo: '定期（デモ）' },
        { yakusoku_id: 'YAKU#DEMO02', tenpo_id: tenpos[1].tenpo_id, type: 'tanpatsu', memo: '単発（デモ）' },
        { yakusoku_id: 'YAKU#DEMO03', tenpo_id: tenpos[2].tenpo_id, type: 'teiki', memo: '定期（デモ）' },
    ];

    const services = [
        { service_id: 'cleaning_regular', name: '定期清掃', category: 'cleaning', default_duration_min: 120, default_price: 30000 },
        { service_id: 'maintenance_check', name: 'メンテ巡回', category: 'maintenance', default_duration_min: 90, default_price: 40000 },
        { service_id: 'pest_spot', name: '害虫スポット対応', category: 'pest', default_duration_min: 60, default_price: 25000 },
    ];

    const jst = (hhmm) => `${baseDate}T${hhmm}:00+09:00`;
    const mkYotei = (id, { workerIdx, tenpoIdx, start, end, serviceIdx, yakIdx, jotai = 'yuko' }) => ({
        id,
        yotei_id: id,
        start_at: jst(start),
        end_at: jst(end),
        scheduled_date: baseDate,
        sagyouin_id: workers[workerIdx]?.id,
        sagyouin_name: workers[workerIdx]?.name,
        tenpo_id: tenpos[tenpoIdx]?.tenpo_id,
        tenpo_name: tenpos[tenpoIdx]?.name,
        yakusoku_id: yakusokus[yakIdx]?.yakusoku_id,
        yakusoku: yakusokus[yakIdx] || null,
        service_id: services[serviceIdx]?.service_id,
        service_name: services[serviceIdx]?.name,
        work_type: services[serviceIdx]?.name || 'その他',
        memo: 'デモ予定',
        jotai,
    });

    const schedules = [
        mkYotei('YOT-DEMO-001', { workerIdx: 0, tenpoIdx: 0, yakIdx: 0, serviceIdx: 0, start: '20:00', end: '22:00' }),
        {
            ...mkYotei('YOT-DEMO-002', { workerIdx: 1, tenpoIdx: 1, yakIdx: 1, serviceIdx: 2, start: '22:30', end: '23:30' }),
            memo: 'クレーム再対応 / 再清掃',
            reason_code: 'RECLEAN',
        },
        {
            ...mkYotei('YOT-DEMO-003', { workerIdx: 2, tenpoIdx: 2, yakIdx: 2, serviceIdx: 1, start: '01:00', end: '03:00' }),
            note: '不足清掃消化',
        },
    ];

    // Simulate progress + staleness to validate colors / warning badges.
    const now = dayjs();
    const ugokiItems = [
        {
            id: 'YOT-DEMO-001',
            yotei_id: 'YOT-DEMO-001',
            jotai: 'shinkou',
            updated_at: now.subtract(35, 'minute').toISOString(),
        },
        {
            id: 'YOT-DEMO-002',
            yotei_id: 'YOT-DEMO-002',
            jotai: 'mikanryo',
            updated_at: now.subtract(75, 'minute').toISOString(),
        },
        {
            id: 'YOT-DEMO-003',
            yotei_id: 'YOT-DEMO-003',
            jotai: 'kanryou',
            updated_at: now.subtract(5, 'minute').toISOString(),
        },
    ];

    // Week/month views use range fetch; this demo keeps only the selected date populated.
    // (The UI still renders properly and shows 0-count cells elsewhere.)
    if (view === 'week' || view === 'month') {
        return { workers, yakusokus, services, schedules, ugokiItems, tenpoNameMap };
    }
    return { workers, yakusokus, services, schedules, ugokiItems, tenpoNameMap };
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
    const isDemo = isDemoMode(searchParams);
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
    const [timelineBand, setTimelineBand] = useState('both'); // both | night | day
    const [modalData, setModalData] = useState(null);
    const [saving, setSaving] = useState(false);
    const [handoffLoading, setHandoffLoading] = useState(false);
    const [handoffError, setHandoffError] = useState('');
    const [handoffLatest, setHandoffLatest] = useState(null);
    const [viewportHeight, setViewportHeight] = useState(
        typeof window === 'undefined' ? 900 : window.innerHeight
    );
    const tenpoCacheRef = useRef(new Map());
    const tenpoMasterLoadedRef = useRef(false);

    // 時間枠の定義（2段）
    const nightHours = [16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4]; // 16:00-翌04:00
    const dayHours = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]; // 04:00-16:00
    const durationHours = 12;
    // Timeline vertical density (bigger = easier to operate / read at night)
    const todayLanePx = 64;

    const clearTenpoCache = useCallback(() => {
        tenpoCacheRef.current = new Map();
        tenpoMasterLoadedRef.current = false;
        setTenpoNameMap({});
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const onResize = () => setViewportHeight(window.innerHeight || 900);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    const switchView = useCallback((view) => {
        const next = { view };
        if (isDemo) next.demo = '1';
        setSearchParams(next);
    }, [isDemo, setSearchParams]);

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
        if (isDemo) return;
        try {
            // 旧 /workers は使用しない。jinzai を作業員マスタの正として使う。
            const base = JINZAI_API_BASE.replace(/\/$/, '');
            const res = await fetch(`${base}/jinzai?limit=1000&jotai=yuko`, { headers: authHeaders(), cache: 'no-store' });
            if (!res.ok) throw new Error(`JINZAI HTTP ${res.status}`);
            const data = await res.json();
            const items = Array.isArray(data) ? data : (data?.items || []);

            // Timeline の縦軸: internal の有効人材は全員表示（清掃専任とは限らないため）。
            // - `han_type` が未設定の古いデータは internal 扱いに寄せる（移行期の互換）。
            const baseWorkers = items
                .filter((it) => it?.jotai !== 'torikeshi')
                .filter((it) => (it?.han_type || 'internal') === 'internal')
                .map((it) => ({
                    id: it.jinzai_id || it.sagyouin_id || it.worker_id || it.id,
                    name: it.name || it.email || it.jinzai_id || it.id,
                }))
                .filter((v) => v.id);

            setWorkers(baseWorkers);
        } catch (e) { console.error('Failed to fetch workers:', e); }
    }, []);

    const fetchYakusokus = useCallback(async () => {
        if (isDemo) return;
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
        if (isDemo) return;
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
        if (isDemo) return;
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
        if (isDemo) return;
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
        if (isDemo) return;
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

    useEffect(() => {
        if (!isDemo) {
            fetchWorkers();
            fetchYakusokus();
            fetchServices();
            return;
        }
        // Demo: inject deterministic data for UI verification.
        const demo = demoDataFor({ date, view: currentView });
        setWorkers(demo.workers);
        setYakusokus(demo.yakusokus);
        setServices(demo.services);
        setSchedules(demo.schedules);
        setUgokiItems(demo.ugokiItems);
        setTenpoNameMap(demo.tenpoNameMap);
        setError('');
        setYakusokuError('');
        setLoading(false);
    }, [isDemo, fetchWorkers, fetchYakusokus, fetchServices, date, currentView]);
    useEffect(() => {
        // 当日表示キャッシュ方針: 日付/ビュー切替時に店舗名キャッシュをクリア
        clearTenpoCache();
    }, [date, currentView, clearTenpoCache]);
    useEffect(() => {
        if (isDemo) return;
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
        fetchSchedulesRange(date, date);
        fetchUgokiRange(date, date);
    }, [currentView, date, fetchSchedulesRange, fetchUgokiRange]);

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

    const statusFor = useCallback((s) => {
        if (s.jotai === 'torikeshi') return 'torikeshi';
        const u = ugokiByYoteiId.get(itemYoteiId(s));
        return normalizeTimelineStatus(
            u?.jokyo || u?.jotai || s?.ugoki_jokyo || s?.ugoki_jotai || s?.jokyo
        );
    }, [ugokiByYoteiId]);

    const progressFor = useCallback((s) => {
        const st = statusFor(s);
        if (st === 'kanryou' || st === 'shinkou' || st === 'torikeshi') return st;
        return 'mikanryo';
    }, [statusFor]);

    const statusLabelFor = useCallback((s) => {
        const st = statusFor(s);
        if (st === 'kanryou') return '完了';
        if (st === 'shinkou') return '進行中';
        if (st === 'kakunin') return '確認中';
        if (st === 'chousei') return '調整中';
        if (st === 'torikeshi') return '取消';
        return '未完了';
    }, [statusFor]);

    const warningLevelFor = useCallback((s) => {
        const u = ugokiByYoteiId.get(itemYoteiId(s));
        if (!u?.updated_at) return 0;
        const p = statusFor(s);
        if (p === 'kanryou' || p === 'torikeshi') return 0;
        const mins = dayjs().diff(dayjs(u.updated_at), 'minute');
        if (mins >= 60) return 2;
        if (mins >= 30) return 1;
        return 0;
    }, [ugokiByYoteiId, statusFor]);

    const todaySegments = useMemo(() => {
        const today = todayDateString();
        const src = schedules
            .slice()
            .sort((a, b) => dayjs(a.start_at).valueOf() - dayjs(b.start_at).valueOf());
        const totalMinutes = durationHours * 60;

        const buildSegment = ({ baseHour, wrapEarlyMorning }) => {
            const base = dayjs(today).hour(baseHour).minute(0).second(0);
            const lanes = [];
            const placed = [];

            src.forEach((s) => {
                let st = dayjs(s.start_at);
                let ed = dayjs(s.end_at);
                if (wrapEarlyMorning) {
                    if (st.isBefore(base) && st.hour() < 4) st = st.add(1, 'day');
                    if (ed.isBefore(base) && ed.hour() < 4) ed = ed.add(1, 'day');
                }

                const rawStart = st.diff(base, 'minute');
                const rawEnd = ed.diff(base, 'minute');
                if (rawEnd <= 0 || rawStart >= totalMinutes) return;

                const startMin = Math.max(0, Math.min(totalMinutes, rawStart));
                const endMin = Math.max(0, Math.min(totalMinutes, rawEnd));

                let lane = lanes.findIndex((laneEnd) => laneEnd <= startMin);
                if (lane === -1) {
                    lane = lanes.length;
                    lanes.push(endMin);
                } else {
                    lanes[lane] = endMin;
                }

                placed.push({
                    ...s,
                    lane,
                    startMin,
                    endMin,
                    leftPct: (startMin / totalMinutes) * 100,
                    widthPct: Math.max(2, ((Math.max(endMin, startMin + 15) - startMin) / totalMinutes) * 100),
                });
            });

            return { items: placed, laneCount: Math.max(1, lanes.length) };
        };

        return {
            night: buildSegment({ baseHour: 16, wrapEarlyMorning: true }),
            day: buildSegment({ baseHour: 4, wrapEarlyMorning: false }),
        };
    }, [schedules, durationHours]);

    const todaySharedRailHeightPx = useMemo(() => {
        const maxLaneCount = Math.max(todaySegments.night.laneCount, todaySegments.day.laneCount);
        const laneNeed = maxLaneCount * todayLanePx;
        // 画面内に収めることを優先（縦スクロール抑制）
        const viewportFitPerSegment = Math.max(150, Math.min(240, Math.floor((viewportHeight - 450) / 2)));
        // lanesが多い時だけ必要最小限まで拡張、通常時はfit値を優先
        return Math.max(viewportFitPerSegment, Math.min(laneNeed, 260));
    }, [todaySegments, todayLanePx, viewportHeight]);

    const showNightBand = timelineBand !== 'day';
    const showDayBand = timelineBand !== 'night';

    const weekDays = useMemo(() => {
        const { from } = weekRange(date);
        return Array.from({ length: 7 }).map((_, i) => dayjs(from).add(i, 'day').format('YYYY-MM-DD'));
    }, [date]);
    const weekFrom = weekDays[0];
    const weekTo = weekDays[6];
    const weekLabel = useMemo(() => {
        if (!weekFrom || !weekTo) return '';
        return `${dayjs(weekFrom).format('M/D')} - ${dayjs(weekTo).format('M/D')}`;
    }, [weekFrom, weekTo]);

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

    const monthLabel = useMemo(() => dayjs(date).format('YYYY年M月'), [date]);

    // Worker id normalization:
    // - historical IDs like `SAG#W002` should be treated as the same as `SAGYOUIN#W002`
    // - newer data paths may use `JINZAI#....` (jinzai master) as the scheduling axis
    const normalizeWorkerId = useCallback((id) => {
        const s = String(id || '').trim();
        if (!s) return '';
        if (s.startsWith('SAG#')) return s.replace(/^SAG#/, 'SAGYOUIN#');
        return s;
    }, []);

    const workerNameMap = useMemo(() => {
        const map = {};
        (workers || []).forEach((w) => {
            const k = normalizeWorkerId(w?.id);
            if (!k) return;
            map[k] = w?.name || w?.email || w?.id || '';
        });
        return map;
    }, [workers, normalizeWorkerId]);

    const workerKeyFor = useCallback((row) => {
        if (!row) return '';
        const direct = row.sagyouin_id || row.worker_id || row.assigned_to;
        if (direct) return normalizeWorkerId(direct);
        const arr = row.worker_ids;
        if (Array.isArray(arr) && arr.length > 0) return normalizeWorkerId(arr[0]);
        return '';
    }, [normalizeWorkerId]);

    const weeklyCell = useCallback((workerId, day) => {
        const wid = normalizeWorkerId(workerId);
        const items = schedules.filter((s) => workerKeyFor(s) === wid && itemDate(s) === day);
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
    }, [schedules, progressFor, normalizeWorkerId, workerKeyFor]);

    const openDayTimeline = useCallback((d) => {
        setDate(d);
        setSearchParams({ view: 'timeline' });
    }, [setSearchParams]);

    const displayTenpoName = useCallback((row) => {
        if (!row) return '現場未設定';
        return tenpoNameMap[row.tenpo_id] || row.tenpo_name || '現場未設定';
    }, [tenpoNameMap]);

    const displayWorkerName = useCallback((row) => {
        if (!row) return '担当未設定';
        if (row.sagyouin_name) return row.sagyouin_name;
        if (row.worker_name) return row.worker_name;
        const k = workerKeyFor(row);
        return workerNameMap[k] || (k || '担当未設定');
    }, [workerKeyFor, workerNameMap]);

    const detectTroubleEventType = useCallback((item) => {
        const text = [
            item?.event_type,
            item?.trouble_type,
            item?.reason_code,
            item?.memo,
            item?.note,
            item?.remarks,
            item?.description,
            item?.title,
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
        if (!text) return null;
        const hit = TROUBLE_EVENT_DEFS.find((def) => def.match.some((kw) => text.includes(String(kw).toLowerCase())));
        return hit || null;
    }, []);

    const weekSummary = useMemo(() => {
        const yuko = schedules.filter((s) => s.jotai !== 'torikeshi');
        const total = yuko.length;
        const byWorker = workers.map((w) => ({
            worker: w,
            count: yuko.filter((s) => workerKeyFor(s) === normalizeWorkerId(w.id)).length,
        }));
        const sorted = [...byWorker].sort((a, b) => b.count - a.count);
        const blankDays = weekDays.filter((d) => yuko.filter((s) => itemDate(s) === d).length === 0);
        return {
            total,
            top: sorted[0] || null,
            low: sorted[sorted.length - 1] || null,
            blankDays,
        };
    }, [schedules, workers, weekDays, workerKeyFor, normalizeWorkerId]);

    const calcCapacitySummary = useCallback((usedCount, workerCount, dayCount) => {
        const workersNum = Math.max(1, Number(workerCount || 0));
        const daysNum = Math.max(1, Number(dayCount || 0));
        const safeCap = Math.max(1, Math.floor(workersNum * daysNum * CAPACITY_PER_WORKER.safe));
        const standardCap = Math.max(1, Math.floor(workersNum * daysNum * CAPACITY_PER_WORKER.standard));
        const maxCap = Math.max(1, Math.floor(workersNum * daysNum * CAPACITY_PER_WORKER.max));
        const rate = standardCap > 0 ? (usedCount / standardCap) : 0;
        const ratePct = Math.round(rate * 100);
        let level = 'safe';
        if (rate > 0.9) level = 'danger';
        else if (rate > 0.7) level = 'warn';
        return {
            used: usedCount,
            safeCap,
            standardCap,
            maxCap,
            rate,
            ratePct,
            level,
            levelClass: `capacity-${level}`,
        };
    }, []);

    const weekTroubleSummary = useMemo(() => {
        const weekSet = new Set(weekDays);
        const map = new Map();
        schedules.forEach((s) => {
            if (s?.jotai === 'torikeshi') return;
            const d = itemDate(s);
            if (!weekSet.has(d)) return;
            const hit = detectTroubleEventType(s);
            if (!hit) return;
            const key = `${hit.key}:${d}`;
            if (!map.has(key)) {
                map.set(key, {
                    key,
                    type: hit.key,
                    label: hit.label,
                    date: d,
                    count: 0,
                    tenpoNames: new Set(),
                });
            }
            const row = map.get(key);
            row.count += 1;
            row.tenpoNames.add(displayTenpoName(s));
        });

        const items = Array.from(map.values())
            .map((row) => ({
                ...row,
                tenpoNames: Array.from(row.tenpoNames).filter(Boolean).slice(0, 3),
            }))
            .sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));
        const total = items.reduce((acc, v) => acc + v.count, 0);
        const byType = TROUBLE_EVENT_DEFS.map((def) => ({
            key: def.key,
            label: def.label,
            count: items.filter((it) => it.type === def.key).reduce((acc, it) => acc + it.count, 0),
        })).filter((v) => v.count > 0);
        return { total, byType, items };
    }, [schedules, weekDays, detectTroubleEventType, displayTenpoName]);

    const monthSummary = useMemo(() => {
        const yuko = schedules.filter((s) => s.jotai !== 'torikeshi');
        const total = yuko.length;
        const byWorker = workers.map((w) => ({
            worker: w,
            count: yuko.filter((s) => workerKeyFor(s) === normalizeWorkerId(w.id)).length,
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
    }, [schedules, workers, yakusokus, progressFor, workerKeyFor, normalizeWorkerId]);

    const todayUsedCount = useMemo(
        () => schedules.filter((s) => s.jotai !== 'torikeshi').length,
        [schedules]
    );
    const todayCapacity = useMemo(
        () => calcCapacitySummary(todayUsedCount, workers.length, 1),
        [todayUsedCount, workers.length, calcCapacitySummary]
    );
    const weekCapacity = useMemo(
        () => calcCapacitySummary(weekSummary.total, workers.length, weekDays.length || 7),
        [weekSummary.total, workers.length, weekDays.length, calcCapacitySummary]
    );
    const monthCapacity = useMemo(
        () => calcCapacitySummary(monthSummary.total, workers.length, monthlyDays.length || 30),
        [monthSummary.total, workers.length, monthlyDays.length, calcCapacitySummary]
    );
    const activeCapacityClass = useMemo(() => {
        if (currentView === 'month') return monthCapacity.levelClass;
        if (currentView === 'week') return weekCapacity.levelClass;
        return todayCapacity.levelClass;
    }, [currentView, monthCapacity.levelClass, weekCapacity.levelClass, todayCapacity.levelClass]);

    const availabilityForWeekCell = useCallback((count) => {
        if (count <= 0) return AKI_MARKS.full;
        if (count === 1) return AKI_MARKS.ok;
        if (count === 2) return AKI_MARKS.few;
        return AKI_MARKS.none;
    }, []);

    const availabilityForMonthDay = useCallback((count) => {
        const capacity = Math.max(4, workers.length * 2);
        const ratio = capacity > 0 ? (count / capacity) : 1;
        if (ratio <= 0.25) return AKI_MARKS.full;
        if (ratio <= 0.5) return AKI_MARKS.ok;
        if (ratio <= 0.8) return AKI_MARKS.few;
        return AKI_MARKS.none;
    }, [workers.length]);

    const monthTroubleSummary = useMemo(() => {
        const map = new Map();
        schedules.forEach((s) => {
            if (s?.jotai === 'torikeshi') return;
            const hit = detectTroubleEventType(s);
            if (!hit) return;
            const d = itemDate(s);
            const key = `${hit.key}:${d}`;
            if (!map.has(key)) {
                map.set(key, {
                    key,
                    type: hit.key,
                    label: hit.label,
                    date: d,
                    count: 0,
                    tenpoNames: new Set(),
                });
            }
            const row = map.get(key);
            row.count += 1;
            row.tenpoNames.add(displayTenpoName(s));
        });

        const items = Array.from(map.values())
            .map((row) => ({
                ...row,
                tenpoNames: Array.from(row.tenpoNames).filter(Boolean).slice(0, 3),
            }))
            .sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label));

        const total = items.reduce((acc, v) => acc + v.count, 0);
        const byType = TROUBLE_EVENT_DEFS.map((def) => ({
            key: def.key,
            label: def.label,
            count: items.filter((it) => it.type === def.key).reduce((acc, it) => acc + it.count, 0),
        })).filter((v) => v.count > 0);

        return { total, byType, items };
    }, [schedules, detectTroubleEventType, displayTenpoName]);

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
            jotai: 'yuko',
            handoff_checks: {
                key_rule: false,
                entry_rule: false,
                caution_points: false,
                photo_rule: false,
                unresolved_checked: false,
            },
        });
    };

    const openEditModal = (s) => {
        setModalData({
            ...s,
            isNew: false,
            service_id: s.service_id || '',
            service_name: s.service_name || '',
            start_time: s.start_at ? dayjs(s.start_at).format('HH:mm') : '20:00',
            end_time: s.end_at ? dayjs(s.end_at).format('HH:mm') : '22:00',
            handoff_checks: {
                key_rule: Boolean(s?.handoff_checks?.key_rule),
                entry_rule: Boolean(s?.handoff_checks?.entry_rule),
                caution_points: Boolean(s?.handoff_checks?.caution_points),
                photo_rule: Boolean(s?.handoff_checks?.photo_rule),
                unresolved_checked: Boolean(s?.handoff_checks?.unresolved_checked),
            },
        });
    };

    useEffect(() => {
        let aborted = false;
        const tenpoId = String(modalData?.tenpo_id || '').trim();
        if (!modalData || !tenpoId) {
            setHandoffLatest(null);
            setHandoffError('');
            setHandoffLoading(false);
            return undefined;
        }
        const fetchLatestSupport = async () => {
            setHandoffLoading(true);
            setHandoffError('');
            try {
                const base = MASTER_API_BASE.replace(/\/$/, '');
                const res = await fetch(`${base}/master/tenpo/${encodeURIComponent(tenpoId)}`, { headers: authHeaders(), cache: 'no-store' });
                if (!res.ok) throw new Error(`引き継ぎ履歴の取得に失敗: ${res.status}`);
                const tenpo = await res.json();
                const rows = Array.isArray(tenpo?.karte_detail?.support_history) ? tenpo.karte_detail.support_history : [];
                const latest = rows
                    .slice()
                    .sort((a, b) => String(b?.date || '').localeCompare(String(a?.date || '')))[0] || null;
                if (!aborted) setHandoffLatest(latest);
            } catch (e) {
                if (!aborted) {
                    setHandoffLatest(null);
                    setHandoffError(e?.message || '引き継ぎ履歴の取得に失敗しました');
                }
            } finally {
                if (!aborted) setHandoffLoading(false);
            }
        };
        fetchLatestSupport();
        return () => { aborted = true; };
    }, [modalData?.tenpo_id]);

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
                // Make the UI stable even when the API doesn't hydrate names.
                sagyouin_name: workerNameMap[normalizeWorkerId(modalData.sagyouin_id)] || modalData.sagyouin_name || '',
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

    const getPositionForSegment = (startAt, endAt, segment) => {
        const totalMinutes = durationHours * 60;
        const baseHour = segment === 'day' ? 4 : 16;
        const wrapEarlyMorning = segment === 'night';
        const base = dayjs(date).hour(baseHour).minute(0).second(0);

        let s = dayjs(startAt);
        let e = dayjs(endAt);
        if (wrapEarlyMorning) {
            if (s.isBefore(base) && s.hour() < 4) s = s.add(1, 'day');
            if (e.isBefore(base) && e.hour() < 4) e = e.add(1, 'day');
        }

        const startDiff = s.diff(base, 'minute');
        const endDiff = e.diff(base, 'minute');
        if (endDiff <= 0 || startDiff >= totalMinutes) return { display: 'none' };

        const startMin = Math.max(0, startDiff);
        const endMin = Math.min(totalMinutes, endDiff);
        const left = (startMin / totalMinutes) * 100;
        const width = ((endMin - startMin) / totalMinutes) * 100;
        return { left: `${Math.max(0, left)}%`, width: `${Math.min(100 - Math.max(0, left), width)}%` };
    };

    return (
        <div className={`admin-yotei-timeline-page ${activeCapacityClass}`}>
            <div className="admin-yotei-timeline-content">
                <header className="yotei-head">
                    <div className="admin-top-left">
                        {/* GlobalNav handles navigation */}
                    </div>
                    <h1>清掃管制スケジュール (16:00-翌04:00 / 04:00-16:00){isDemo ? ' [DEMO]' : ''}</h1>
                    <div className="yotei-head-actions">
                        <div className="yotei-head-nav">
                            <button
                                type="button"
                                className={currentView === 'today' ? 'active' : ''}
                                onClick={() => switchView('today')}
                            >
                                今日
                            </button>
                            <button
                                type="button"
                                className={currentView === 'week' ? 'active' : ''}
                                onClick={() => switchView('week')}
                            >
                                週間
                            </button>
                            <button
                                type="button"
                                className={currentView === 'month' ? 'active' : ''}
                                onClick={() => switchView('month')}
                            >
                                月間
                            </button>
                            <button
                                type="button"
                                className={currentView === 'timeline' ? 'active' : ''}
                                onClick={() => switchView('timeline')}
                            >
                                予約表
                            </button>
                            <Link to="/admin/ugoki" className="yotei-head-link">UGOKI</Link>
                            <Link to="/admin/yakusoku" className="yotei-head-link">YAKUSOKU</Link>
                        </div>
                        <input type="text" placeholder="作業員検索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                        <button className="primary" onClick={() => openNewModal()}>新規登録</button>
                        <button
                            onClick={() => {
                                if (isDemo) {
                                    const demo = demoDataFor({ date, view: currentView });
                                    setWorkers(demo.workers);
                                    setYakusokus(demo.yakusokus);
                                    setServices(demo.services);
                                    setSchedules(demo.schedules);
                                    setUgokiItems(demo.ugokiItems);
                                    setTenpoNameMap(demo.tenpoNameMap);
                                    setError('');
                                    setYakusokuError('');
                                    setLoading(false);
                                    return;
                                }
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
                                fetchSchedulesRange(date, date);
                                fetchUgokiRange(date, date);
                            }}
                            disabled={loading}
                        >
                            {loading ? '...' : '更新'}
                        </button>
                    </div>
                </header>
                {isDemo ? (
                    <div style={{ margin: '8px 0', color: '#93c5fd' }}>
                        DEMOモード: APIなしでUIを確認できます。URL末尾に <code>?view={currentView}&amp;demo=1</code>
                    </div>
                ) : null}
                {yakusokuError ? <div style={{ margin: '8px 0', color: '#fbbf24' }}>{yakusokuError}</div> : null}
                {currentView === 'today' && (
                    <div className="yotei-today-wrap">
                        <div className="today-top-row">
                            <div className="today-date-controls">
                                <div className="today-switcher" aria-label="今日表示ナビゲーション">
                                    <button
                                        type="button"
                                        className="today-switcher-nav"
                                        onClick={() => setDate(dayjs(date).subtract(1, 'day').format('YYYY-MM-DD'))}
                                    >
                                        ← 前日
                                    </button>
                                    <strong className="today-switcher-label">{dayjs(date).format('YYYY/MM/DD (dd)')}</strong>
                                    <div className="today-switcher-actions">
                                        <button
                                            type="button"
                                            className="is-current"
                                            onClick={() => setDate(todayDateString())}
                                        >
                                            今日
                                        </button>
                                        <button
                                            type="button"
                                            className="today-switcher-nav"
                                            onClick={() => setDate(dayjs(date).add(1, 'day').format('YYYY-MM-DD'))}
                                        >
                                            翌日 →
                                        </button>
                                    </div>
                                </div>
                                <div className="today-date-card">
                                    <label htmlFor="today-date-input">日付指定</label>
                                    <input
                                        id="today-date-input"
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="yotei-summary-cards today-summary-cards">
                                <div className={`sum-card capacity-card ${todayCapacity.levelClass}`}>
                                    <div>キャパ使用率（標準）</div>
                                    <strong>{todayCapacity.used}/{todayCapacity.standardCap}件 ({todayCapacity.ratePct}%)</strong>
                                    <small>安全 {todayCapacity.safeCap} / 上限 {todayCapacity.maxCap}</small>
                                </div>
                                <div className="sum-card"><div>本日予定数</div><strong>{todayUsedCount}</strong></div>
                                <div className="sum-card"><div>進行中</div><strong>{schedules.filter((s) => progressFor(s) === 'shinkou').length}</strong></div>
                                <div className="sum-card"><div>完了</div><strong>{schedules.filter((s) => progressFor(s) === 'kanryou').length}</strong></div>
                                <div className="sum-card"><div>停滞警告</div><strong>{schedules.filter((s) => warningLevelFor(s) > 0).length}</strong></div>
                            </div>
                        </div>
                        <div className="today-scroll-wrap">
                            <div className="today-timeline-inner">
                                <div className="today-seg">
                                    <div className="yotei-seg-title">🌙 夜タイムライン 16:00-翌04:00</div>
                                    <div className="today-time-header">
                                        {nightHours.slice(0, -1).map((h, i) => (
                                            <div key={`n-${i}`} className="today-time-cell">{String(h).padStart(2, '0')}:00</div>
                                        ))}
                                    </div>
                                    <div className="today-time-rail" style={{ height: `${todaySharedRailHeightPx}px` }}>
                                        {todaySegments.night.items.map((s) => {
                                            const warn = warningLevelFor(s);
                                            const status = statusFor(s);
                                            return (
                                                <button
                                                    key={`${s.id}-n`}
                                                    className={`today-rail-card status-${status} ${warn === 2 ? 'danger' : warn === 1 ? 'warn' : ''}`}
                                                    style={{
                                                        left: `${s.leftPct}%`,
                                                        width: `${s.widthPct}%`,
                                                        top: `${s.lane * todayLanePx + 8}px`,
                                                    }}
                                                    onClick={() => openEditModal(s)}
                                                >
                                                    <div className="today-rail-time">{dayjs(s.start_at).format('HH:mm')} - {dayjs(s.end_at).format('HH:mm')}</div>
                                                    <div className="today-rail-tenpo">{displayTenpoName(s)}</div>
                                                    <div className="today-rail-meta">
                                                        <span>{displayWorkerName(s)}</span>
                                                        <span>{statusLabelFor(s)} {warn === 2 ? '🔴' : warn === 1 ? '⚠' : ''}</span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="today-seg">
                                    <div className="yotei-seg-title">☀️ 昼タイムライン 04:00-16:00</div>
                                    <div className="today-time-header">
                                        {dayHours.slice(0, -1).map((h, i) => (
                                            <div key={`d-${i}`} className="today-time-cell">{String(h).padStart(2, '0')}:00</div>
                                        ))}
                                    </div>
                                    <div className="today-time-rail" style={{ height: `${todaySharedRailHeightPx}px` }}>
                                        {todaySegments.day.items.map((s) => {
                                            const warn = warningLevelFor(s);
                                            const status = statusFor(s);
                                            return (
                                                <button
                                                    key={`${s.id}-d`}
                                                    className={`today-rail-card status-${status} ${warn === 2 ? 'danger' : warn === 1 ? 'warn' : ''}`}
                                                    style={{
                                                        left: `${s.leftPct}%`,
                                                        width: `${s.widthPct}%`,
                                                        top: `${s.lane * todayLanePx + 8}px`,
                                                    }}
                                                    onClick={() => openEditModal(s)}
                                                >
                                                    <div className="today-rail-time">{dayjs(s.start_at).format('HH:mm')} - {dayjs(s.end_at).format('HH:mm')}</div>
                                                    <div className="today-rail-tenpo">{displayTenpoName(s)}</div>
                                                    <div className="today-rail-meta">
                                                        <span>{displayWorkerName(s)}</span>
                                                        <span>{statusLabelFor(s)} {warn === 2 ? '🔴' : warn === 1 ? '⚠' : ''}</span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {currentView === 'week' && (
                    <div className="yotei-week-wrap">
                        <div className="week-top-row">
                            <div className="week-switcher" aria-label="週間表示ナビゲーション">
                                <button
                                    type="button"
                                    className="week-switcher-nav"
                                    onClick={() => setDate(dayjs(weekFrom).subtract(7, 'day').format('YYYY-MM-DD'))}
                                >
                                    ← 前週
                                </button>
                                <strong className="week-switcher-label">{weekLabel}</strong>
                                <div className="week-switcher-actions">
                                    <button
                                        type="button"
                                        className="is-current"
                                        onClick={() => setDate(weekRange(todayDateString()).from)}
                                    >
                                        今週
                                    </button>
                                    <button
                                        type="button"
                                        className="week-switcher-nav"
                                        onClick={() => setDate(dayjs(weekFrom).add(7, 'day').format('YYYY-MM-DD'))}
                                    >
                                        次週 →
                                    </button>
                                </div>
                            </div>
                            <div className="yotei-summary-cards week-summary-cards">
                                <div className={`sum-card capacity-card ${weekCapacity.levelClass}`}>
                                    <div>キャパ使用率（標準）</div>
                                    <strong>{weekCapacity.used}/{weekCapacity.standardCap}件 ({weekCapacity.ratePct}%)</strong>
                                    <small>安全 {weekCapacity.safeCap} / 上限 {weekCapacity.maxCap}</small>
                                </div>
                                <div className="sum-card"><div>週合計件数</div><strong>{weekSummary.total}</strong></div>
                                <div className="sum-card"><div>最多</div><strong>{weekSummary.top ? `${weekSummary.top.worker.name} (${weekSummary.top.count})` : '-'}</strong></div>
                                <div className="sum-card"><div>最少</div><strong>{weekSummary.low ? `${weekSummary.low.worker.name} (${weekSummary.low.count})` : '-'}</strong></div>
                                <div className="sum-card"><div>0件日（未割当）</div><strong>{weekSummary.blankDays.length > 0 ? weekSummary.blankDays.map((d) => dayjs(d).format('M/D')).join(', ') : 'なし'}</strong></div>
                            </div>
                        </div>
                        <footer className="yotei-legend-footer week-inline-footer" aria-label="週間ビュー備考">
                            <div className="legend-row">
                                <span className="legend-chip">
                                    <span className="aki-mark is-full">◎</span>
                                    十分空きあり
                                </span>
                                <span className="legend-chip">
                                    <span className="aki-mark is-ok">○</span>
                                    空きあり
                                </span>
                                <span className="legend-chip">
                                    <span className="aki-mark is-few">△</span>
                                    空き少なめ
                                </span>
                                <span className="legend-chip">
                                    <span className="aki-mark is-none">×</span>
                                    空きなし
                                </span>
                                <span className="legend-chip">
                                    <span className="tag is-mikanryo">未</span>
                                    未完了あり
                                </span>
                                <span className="legend-chip">
                                    <span className="tag is-shinkou">進</span>
                                    進行中あり
                                </span>
                                <span className="legend-chip">
                                    <span className="tag is-kanryou">完</span>
                                    予定分すべて完了
                                </span>
                                <span className="legend-chip">
                                    <span className="dot is-torikeshi" />
                                    取消のみ
                                </span>
                                <span className="legend-chip">
                                    <span className="mark">⚠</span>
                                    予定なし（空白日）
                                </span>
                            </div>
                        </footer>
                        <div className="month-trouble-strip week-trouble-strip" aria-label="週間 清掃トラブルイベント集計">
                            <div className="month-trouble-strip-head">
                                <strong>清掃トラブルイベント（週間）</strong>
                                <div className="month-trouble-head-right">
                                    {weekTroubleSummary.total > 0 ? (
                                        <div className="month-trouble-type-summary">
                                            {weekTroubleSummary.byType.map((t) => (
                                                <span key={t.key} className={`month-trouble-pill is-${t.key}`}>
                                                    {t.label}: {t.count}
                                                </span>
                                            ))}
                                        </div>
                                    ) : null}
                                    <span>再清掃 / 不足清掃消化 などを週内で集計</span>
                                </div>
                            </div>
                            {weekTroubleSummary.total > 0 ? (
                                <div className="month-trouble-event-list">
                                    {weekTroubleSummary.items.map((ev) => (
                                        <button
                                            type="button"
                                            key={ev.key}
                                            className={`month-trouble-tag is-${ev.type}`}
                                            onClick={() => openDayTimeline(ev.date)}
                                            title={`${dayjs(ev.date).format('M/D')} ${ev.label} ${ev.tenpoNames.join(' / ')}`}
                                        >
                                            <span className="date">{dayjs(ev.date).format('M/D')}</span>
                                            <span className="type">{ev.label}</span>
                                            <span className="count">{ev.count}件</span>
                                            {ev.tenpoNames.length > 0 ? (
                                                <span className="shops">{ev.tenpoNames.join(' / ')}</span>
                                            ) : null}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="month-trouble-empty">今週の再清掃イベントはありません</div>
                            )}
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
                                        const aki = availabilityForWeekCell(c.yotei);
                                        let cls = '';
                                        if (c.shinkou > 0) cls = 'shinkou';
                                        else if (c.yotei > 0 && c.kanryou === c.yotei) cls = 'kanryou';
                                        else if (c.torikeshi > 0 && c.yotei === 0) cls = 'torikeshi';
                                        const empty = c.yotei === 0 && c.torikeshi === 0;
                                        return (
                                            <button key={`${w.id}-${d}`} className={`week-cell ${cls}`} onClick={() => openDayTimeline(d)}>
                                                <div className="aki-indicator">
                                                    <span className={`aki-mark card-aki-mark is-${aki.key}`} aria-label={aki.label}>{aki.mark}</span>
                                                </div>
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
                        <div className="month-top-row">
                            <div className="month-switcher" aria-label="月間表示ナビゲーション">
                                <button
                                    type="button"
                                    className="month-switcher-nav"
                                    onClick={() => setDate(dayjs(date).subtract(1, 'month').startOf('month').format('YYYY-MM-DD'))}
                                >
                                    ← 前月
                                </button>
                                <strong className="month-switcher-label">{monthLabel}</strong>
                                <div className="month-switcher-actions">
                                    <button
                                        type="button"
                                        className="is-current"
                                        onClick={() => setDate(dayjs().startOf('month').format('YYYY-MM-DD'))}
                                    >
                                        今月
                                    </button>
                                    <button
                                        type="button"
                                        className="month-switcher-nav"
                                        onClick={() => setDate(dayjs(date).add(1, 'month').startOf('month').format('YYYY-MM-DD'))}
                                    >
                                        次月 →
                                    </button>
                                </div>
                            </div>
                            <div className="yotei-summary-cards month-summary-cards">
                                <div className={`sum-card capacity-card ${monthCapacity.levelClass}`}>
                                    <div>キャパ使用率（標準）</div>
                                    <strong>{monthCapacity.used}/{monthCapacity.standardCap}件 ({monthCapacity.ratePct}%)</strong>
                                    <small>安全 {monthCapacity.safeCap} / 上限 {monthCapacity.maxCap}</small>
                                </div>
                                <div className="sum-card"><div>月合計予定</div><strong>{monthSummary.total}</strong></div>
                                <div className="sum-card"><div>作業員数</div><strong>{workers.length}</strong></div>
                                <div className="sum-card"><div>0件日</div><strong>{monthlyDays.filter((d) => schedules.filter((s) => itemDate(s) === d && s.jotai !== 'torikeshi').length === 0).length}</strong></div>
                            </div>
                        </div>
                        <div className="month-trouble-strip" aria-label="清掃トラブルイベント集計">
                            <div className="month-trouble-strip-head">
                                <strong>清掃トラブルイベント</strong>
                                <div className="month-trouble-head-right">
                                    {monthTroubleSummary.total > 0 ? (
                                        <div className="month-trouble-type-summary">
                                            {monthTroubleSummary.byType.map((t) => (
                                                <span key={t.key} className={`month-trouble-pill is-${t.key}`}>
                                                    {t.label}: {t.count}
                                                </span>
                                            ))}
                                        </div>
                                    ) : null}
                                    <span>再清掃 / 不足清掃消化 などを月内で集計</span>
                                </div>
                            </div>
                            {monthTroubleSummary.total > 0 ? (
                                <>
                                    <div className="month-trouble-event-list">
                                        {monthTroubleSummary.items.map((ev) => (
                                            <button
                                                type="button"
                                                key={ev.key}
                                                className={`month-trouble-tag is-${ev.type}`}
                                                onClick={() => openDayTimeline(ev.date)}
                                                title={`${dayjs(ev.date).format('M/D')} ${ev.label} ${ev.tenpoNames.join(' / ')}`}
                                            >
                                                <span className="date">{dayjs(ev.date).format('M/D')}</span>
                                                <span className="type">{ev.label}</span>
                                                <span className="count">{ev.count}件</span>
                                                {ev.tenpoNames.length > 0 ? (
                                                    <span className="shops">{ev.tenpoNames.join(' / ')}</span>
                                                ) : null}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div className="month-trouble-empty">今月の再清掃イベントはありません</div>
                            )}
                        </div>
                        <div className="month-calendar">
                            {monthlyDays.map((d) => {
                                const cnt = schedules.filter((s) => itemDate(s) === d && s.jotai !== 'torikeshi').length;
                                const aki = availabilityForMonthDay(cnt);
                                const isToday = d === todayDateString();
                                return (
                                    <button key={d} className={`month-day ${isToday ? 'is-today' : ''}`} onClick={() => openDayTimeline(d)}>
                                        {isToday ? <span className="month-today-badge">TODAY</span> : null}
                                        <div>{dayjs(d).format('D')}</div>
                                        <strong>{cnt}件</strong>
                                        <div className="aki-indicator month-aki-indicator">
                                            <span className={`aki-mark card-aki-mark is-${aki.key}`} aria-label={aki.label}>{aki.mark}</span>
                                        </div>
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
                    <>
                        <footer className="yotei-legend-footer timeline-inline-footer" aria-label="タイムライン備考">
                            <div className="legend-row">
                                <span className="legend-chip">
                                    <span className="dot is-yotei" />
                                    予定
                                </span>
                                <span className="legend-chip">
                                    <span className="dot is-torikeshi" />
                                    取消
                                </span>
                                <span className="legend-chip">
                                    <span className="mark">⚠</span>
                                    停滞30分+
                                </span>
                                <span className="legend-chip">
                                    <span className="mark">🔴</span>
                                    停滞60分+
                                </span>
                                <span className="legend-chip">
                                    <span className="tag is-mikanryo">未</span>
                                    未完了
                                </span>
                                <span className="legend-chip">
                                    <span className="tag is-chousei">調</span>
                                    調整中
                                </span>
                                <span className="legend-chip">
                                    <span className="tag is-kakunin">確</span>
                                    確認中
                                </span>
                                <span className="legend-chip">
                                    <span className="tag is-shinkou">進</span>
                                    進行中
                                </span>
                                <span className="legend-chip">
                                    <span className="tag is-kanryou">完</span>
                                    完了
                                </span>
                            </div>
                        </footer>
                        <div className="timeline-date-strip" aria-label="予約表 日付選択">
                            <div className="timeline-date-inline">
                                <div className="timeline-month-switch" aria-label="予約表 月切替">
                                    <button
                                        type="button"
                                        onClick={() => setDate(dayjs(date).subtract(1, 'month').startOf('month').format('YYYY-MM-DD'))}
                                    >
                                        ← 前月
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDate(dayjs().startOf('month').format('YYYY-MM-DD'))}
                                    >
                                        今月
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDate(dayjs(date).add(1, 'month').startOf('month').format('YYYY-MM-DD'))}
                                    >
                                        次月 →
                                    </button>
                                </div>
                                <div className="timeline-date-strip-head">{dayjs(date).format('YYYY年M月')} 日付選択</div>
                                <div className="timeline-date-scroll">
                                    {monthlyDays.map((d) => {
                                        const isActive = d === date;
                                        const isToday = d === todayDateString();
                                        return (
                                            <button
                                                key={d}
                                                type="button"
                                                className={`timeline-date-chip ${isActive ? 'active' : ''} ${isToday ? 'is-today' : ''}`}
                                                onClick={() => setDate(d)}
                                                title={dayjs(d).format('YYYY/MM/DD (dd)')}
                                            >
                                                {dayjs(d).format('D')}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                        <div className="yotei-grid-container">
                            <div className="timeline-band-switch">
                                <button
                                    type="button"
                                    className={timelineBand === 'both' ? 'active' : ''}
                                    onClick={() => setTimelineBand('both')}
                                >
                                    🌗 両方
                                </button>
                                <button
                                    type="button"
                                    className={timelineBand === 'night' ? 'active' : ''}
                                    onClick={() => setTimelineBand('night')}
                                >
                                    🌙 夜のみ
                                </button>
                                <button
                                    type="button"
                                    className={timelineBand === 'day' ? 'active' : ''}
                                    onClick={() => setTimelineBand('day')}
                                >
                                    ☀️ 昼のみ
                                </button>
                            </div>
                            <div className="yotei-grid-header">
                                {showNightBand && (
                                <div className="yotei-grid-header-row is-night">
                                    <div className="yotei-grid-header-cell worker-col">
                                        作業員 <span className="yotei-seg-chip">🌙 16:00-翌04:00</span>
                                    </div>
                                    {nightHours.slice(0, -1).map((h, i) => <div key={`n-${i}`} className="yotei-grid-header-cell">{String(h).padStart(2, '0')}:00</div>)}
                                </div>
                                )}
                                {showDayBand && (
                                <div className="yotei-grid-header-row is-day">
                                    <div className="yotei-grid-header-cell worker-col"><span className="yotei-seg-chip">☀️ 04:00-16:00</span></div>
                                    {dayHours.slice(0, -1).map((h, i) => <div key={`d-${i}`} className="yotei-grid-header-cell">{String(h).padStart(2, '0')}:00</div>)}
                                </div>
                                )}
                            </div>
                            {filteredWorkers.map(w => (
                                <div key={w.id} className="yotei-row">
                                    <div className="yotei-worker-cell">
                                        <div className="yotei-worker-name">{w.name}</div>
                                        <div className="yotei-worker-id">{w.id}</div>
                                    </div>
                                    <div className={`yotei-timeline-stack ${timelineBand !== 'both' ? 'one-row' : ''}`}>
                                        {showNightBand && (
                                        <div className="yotei-timeline-cell is-night" onClick={(e) => { if (e.target === e.currentTarget) openNewModal(w.id); }}>
                                            {(schedulesByWorker.get(w.id) || []).map(s => {
                                                const style = getPositionForSegment(s.start_at, s.end_at, 'night');
                                                if (style.display === 'none') return null;
                                                const status = statusFor(s);
                                                return (
                                                    <div key={`${s.id}-n`} className={`yotei-card status-${status}`} style={style} onClick={() => openEditModal(s)}>
                                                        <div className="yotei-card-tenpo">{displayTenpoName(s)}</div>
                                                        <div className="yotei-card-time">{dayjs(s.start_at).format('HH:mm')} - {dayjs(s.end_at).format('HH:mm')}</div>
                                                        <div style={{ fontSize: '9px', opacity: 0.85 }}>{statusLabelFor(s)}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        )}
                                        {showDayBand && (
                                        <div className="yotei-timeline-cell is-day" onClick={(e) => { if (e.target === e.currentTarget) openNewModal(w.id); }}>
                                            {(schedulesByWorker.get(w.id) || []).map(s => {
                                                const style = getPositionForSegment(s.start_at, s.end_at, 'day');
                                                if (style.display === 'none') return null;
                                                const status = statusFor(s);
                                                return (
                                                    <div key={`${s.id}-d`} className={`yotei-card status-${status}`} style={style} onClick={() => openEditModal(s)}>
                                                        <div className="yotei-card-tenpo">{displayTenpoName(s)}</div>
                                                        <div className="yotei-card-time">{dayjs(s.start_at).format('HH:mm')} - {dayjs(s.end_at).format('HH:mm')}</div>
                                                        <div style={{ fontSize: '9px', opacity: 0.85 }}>{statusLabelFor(s)}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {currentView === 'today' && (
                    <footer className="yotei-legend-footer" aria-label="タイムライン備考">
                        <div className="legend-row">
                            <span className="legend-chip">
                                <span className="dot is-yotei" />
                                予定
                            </span>
                            <span className="legend-chip">
                                <span className="dot is-torikeshi" />
                                取消
                            </span>
                            <span className="legend-chip">
                                <span className="mark">⚠</span>
                                停滞30分+
                            </span>
                            <span className="legend-chip">
                                <span className="mark">🔴</span>
                                停滞60分+
                            </span>
                            <span className="legend-chip">
                                <span className="tag is-mikanryo">未</span>
                                未完了
                            </span>
                            <span className="legend-chip">
                                <span className="tag is-chousei">調</span>
                                調整中
                            </span>
                            <span className="legend-chip">
                                <span className="tag is-kakunin">確</span>
                                確認中
                            </span>
                            <span className="legend-chip">
                                <span className="tag is-shinkou">進</span>
                                進行中
                            </span>
                            <span className="legend-chip">
                                <span className="tag is-kanryou">完</span>
                                完了
                            </span>
                        </div>
                    </footer>
                )}

                {currentView === 'month' && (
                    <footer className="yotei-legend-footer" aria-label="月間ビュー備考">
                        <div className="legend-row">
                            <span className="legend-chip">
                                <span className="aki-mark is-full">◎</span>
                                十分空きあり
                            </span>
                            <span className="legend-chip">
                                <span className="aki-mark is-ok">○</span>
                                空きあり
                            </span>
                            <span className="legend-chip">
                                <span className="aki-mark is-few">△</span>
                                空き少なめ
                            </span>
                            <span className="legend-chip">
                                <span className="aki-mark is-none">×</span>
                                空きなし
                            </span>
                            <span className="legend-chip">
                                <span className="mark">📅</span>
                                日付セル: その日の予定件数
                            </span>
                            <span className="legend-chip">
                                <span className="mark">⚠</span>
                                0件日（未割当/空白）
                            </span>
                            <span className="legend-chip">
                                <span className="mark">🧾</span>
                                下段: yakusoku消化（使用/枠）
                            </span>
                        </div>
                    </footer>
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
                            <div className="yotei-form-group handoff-group">
                                <label>引き継ぎ（前回→今回）</label>
                                <div className="handoff-box">
                                    {handoffLoading ? <div className="handoff-muted">前回対応を読み込み中...</div> : null}
                                    {!handoffLoading && handoffError ? <div className="handoff-error">{handoffError}</div> : null}
                                    {!handoffLoading && !handoffError && handoffLatest ? (
                                        <div className="handoff-latest">
                                            <div className="handoff-title">前回対応サマリ</div>
                                            <div><strong>いつ:</strong> {handoffLatest?.date || '-'}</div>
                                            <div><strong>誰が:</strong> {handoffLatest?.handled_by || '-'}</div>
                                            <div><strong>何の件か:</strong> {handoffLatest?.topic || '-'}</div>
                                            <div><strong>結果:</strong> {handoffLatest?.outcome || '-'}</div>
                                        </div>
                                    ) : null}
                                    {!handoffLoading && !handoffError && !handoffLatest ? (
                                        <div className="handoff-muted">前回の対応履歴は未登録です。</div>
                                    ) : null}
                                    <div className="handoff-checks">
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={Boolean(modalData?.handoff_checks?.key_rule)}
                                                onChange={(e) => setModalData((prev) => ({
                                                    ...prev,
                                                    handoff_checks: { ...(prev?.handoff_checks || {}), key_rule: e.target.checked },
                                                }))}
                                            />
                                            鍵ルール確認
                                        </label>
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={Boolean(modalData?.handoff_checks?.entry_rule)}
                                                onChange={(e) => setModalData((prev) => ({
                                                    ...prev,
                                                    handoff_checks: { ...(prev?.handoff_checks || {}), entry_rule: e.target.checked },
                                                }))}
                                            />
                                            入館手順確認
                                        </label>
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={Boolean(modalData?.handoff_checks?.caution_points)}
                                                onChange={(e) => setModalData((prev) => ({
                                                    ...prev,
                                                    handoff_checks: { ...(prev?.handoff_checks || {}), caution_points: e.target.checked },
                                                }))}
                                            />
                                            注意点確認
                                        </label>
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={Boolean(modalData?.handoff_checks?.photo_rule)}
                                                onChange={(e) => setModalData((prev) => ({
                                                    ...prev,
                                                    handoff_checks: { ...(prev?.handoff_checks || {}), photo_rule: e.target.checked },
                                                }))}
                                            />
                                            写真提出ルール確認
                                        </label>
                                        <label>
                                            <input
                                                type="checkbox"
                                                checked={Boolean(modalData?.handoff_checks?.unresolved_checked)}
                                                onChange={(e) => setModalData((prev) => ({
                                                    ...prev,
                                                    handoff_checks: { ...(prev?.handoff_checks || {}), unresolved_checked: e.target.checked },
                                                }))}
                                            />
                                            未解決課題確認
                                        </label>
                                    </div>
                                </div>
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
