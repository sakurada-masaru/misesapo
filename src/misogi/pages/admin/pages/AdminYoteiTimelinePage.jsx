import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import './admin-yotei-timeline.css';

const API_BASE =
    typeof window !== 'undefined' && window.location?.hostname === 'localhost'
        ? '/api'
        : (import.meta.env?.VITE_API_BASE || 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod');
const YAKUSOKU_FALLBACK_BASE =
    typeof window !== 'undefined' && window.location?.hostname === 'localhost'
        ? '/api2'
        : API_BASE;

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
    const [date, setDate] = useState(todayDateString());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [yakusokuError, setYakusokuError] = useState('');
    const [schedules, setSchedules] = useState([]);
    const [workers, setWorkers] = useState([]);
    const [yakusokus, setYakusokus] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [modalData, setModalData] = useState(null);
    const [saving, setSaving] = useState(false);

    // 時間枠の定義 (16:00 - 翌04:00)
    const hours = [16, 17, 18, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4];
    const durationHours = 12;

    const fetchWorkers = useCallback(async () => {
        try {
            const base = API_BASE.replace(/\/$/, '');
            const res = await fetch(`${base}/workers`, { headers: authHeaders() });
            if (!res.ok) throw new Error(`Workers HTTP ${res.status}`);
            const data = await res.json();
            const items = Array.isArray(data) ? data : (data?.items || data?.workers || []);
            const cleaningDept = items.filter(w =>
                (w.department && String(w.department).trim() === '清掃事業部') ||
                (w.parent_department && String(w.parent_department).trim() === '清掃事業部')
            ).map(w => ({ id: w.id, name: w.name || w.email || w.id }));
            setWorkers(cleaningDept);
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

    const fetchSchedules = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const base = API_BASE.replace(/\/$/, '');
            const res = await fetch(`${base}/yotei?date=${date}&limit=1000`, { headers: authHeaders() });
            if (!res.ok) throw new Error(`Schedules HTTP ${res.status}`);
            const data = await res.json();
            setSchedules(Array.isArray(data) ? data : (data?.items || []));
        } catch (e) { setError(e.message || 'スケジュールの取得に失敗しました'); }
        finally { setLoading(false); }
    }, [date]);

    useEffect(() => { fetchWorkers(); fetchYakusokus(); }, [fetchWorkers, fetchYakusokus]);
    useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

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

    const openNewModal = (workerId) => {
        setModalData({
            isNew: true,
            sagyouin_id: workerId || (workers[0]?.id || ''),
            yakusoku_id: '',
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
                        <button onClick={fetchSchedules} disabled={loading}>{loading ? '...' : '更新'}</button>
                    </div>
                </header>
                {yakusokuError ? <div style={{ margin: '8px 0', color: '#fbbf24' }}>{yakusokuError}</div> : null}

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
                                        <div className="yotei-card-tenpo">{s.tenpo_name || '現場未設定'}</div>
                                        <div className="yotei-card-time">{dayjs(s.start_at).format('HH:mm')} - {dayjs(s.end_at).format('HH:mm')}</div>
                                        {s.yakusoku && <div style={{ fontSize: '9px', opacity: 0.7 }}>{s.yakusoku.type === 'teiki' ? '月額' : '単発'}</div>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
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
                                        tenpo_name: selected?.tenpo_name || selected?.memo || modalData.tenpo_name
                                    });
                                }} required>
                                    <option value="">選択してください</option>
                                    {yakusokus.map(y => (
                                        <option key={y.yakusoku_id} value={y.yakusoku_id}>
                                            [{y.type === 'teiki' ? '定期' : '単発'}] {y.tenpo_name || y.yakusoku_id}
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
