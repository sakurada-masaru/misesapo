import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../../shared/auth/useAuth';
import { apiFetch, apiFetchWorkReport } from '../../shared/api/client';
import Visualizer from '../../shared/ui/Visualizer/Visualizer';

// --- Constants ---
const TEMPLATE_STORE = 'CLEANING_STORE_V1';
const TEMPLATE_SALES = 'FIELD_SALES_V1';
const TEMPLATE_CLEANING = 'CLEANING_V1';
const TEMPLATE_ENGINEERING = 'ENGINEERING_V1';
const TEMPLATE_OFFICE = 'OFFICE_ADMIN_V1';
const TEMPLATE_DAY = 'CLEANING_DAY_V1';

const MAX_ATTACHMENTS = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'pdf', 'xlsx', 'docx', 'heic'];

const emptyStore = (enabled = false) => ({
    enabled,
    corporate_name: '',
    brand_name: '',
    store_name: '',
    address: '',
    witness: '',
    work_start_time: '',
    work_end_time: '',
    store_minutes: 0,
    witness: '',
    work_start_time: '',
    work_end_time: '',
    note: '',
    photo_mode: 'before_after', // 'before_after' or 'execution'
    inspection: {
        fat_level: 'middle', // low, middle, high, abnormal
        residue_level: 'middle',
        odor_level: 'none', // none, low, middle, high
        water_level: 'normal', // normal, adjust
        assessment: 'normal', // normal, unexpected
    },
    services: [{ name: '', minutes: 0, memo: '' }],
    attachments: [],
    attachments_after: [], // After用を分離
    confirmed: false,
    saved: { log_id: null, version: null, state: null },
});

function serializeStoreReport(store) {
    return {
        store: {
            corporate_name: store.corporate_name || '',
            brand_name: store.brand_name || '',
            name: store.store_name || '',
            address: store.address || '',
            witness: store.witness || '',
            work_start_time: store.work_start_time || '',
            work_end_time: store.work_end_time || '',
            note: store.note || '',
            photo_mode: store.photo_mode || 'before_after',
            inspection: store.inspection || {},
            services: (store.services || []).map(s => ({
                name: s.name || '',
                minutes: parseInt(s.minutes) || 0,
                memo: s.memo || ''
            })),
            attachments: (store.attachments || []).map(a => ({ key: a.key, url: a.url, name: a.name || 'before' })),
            attachments_after: (store.attachments_after || []).map(a => ({ key: a.key, url: a.url, name: a.name || 'after' }))
        }
    };
}

function deserializeStoreReport(descStr, meta = {}) {
    try {
        const d = typeof descStr === 'string' ? JSON.parse(descStr) : descStr;
        const s = d.store || {};
        return {
            enabled: true,
            corporate_name: s.corporate_name || '',
            brand_name: s.brand_name || '',
            store_name: s.name || '',
            address: s.address || '',
            witness: s.witness || '',
            work_start_time: s.work_start_time || '',
            work_end_time: s.work_end_time || '',
            store_minutes: 0,
            note: s.note || '',
            services: (s.services || []).map(sv => ({
                name: sv.name || '',
                minutes: sv.minutes || 0,
                memo: sv.memo || ''
            })),
            attachments: s.attachments || [],
            confirmed: true,
            saved: { log_id: meta.log_id, version: meta.version, state: meta.state },
        };
    } catch (e) {
        return emptyStore(true);
    }
}

export default function AdminReportNewPage() {
    const { user, authz, isLoading: authLoading, getToken } = useAuth();
    const [activeTemplate, setActiveTemplate] = useState(TEMPLATE_CLEANING);
    const [activeStoreTab, setActiveStoreTab] = useState(0);
    const [showPreview, setShowPreview] = useState(false); // プレビュー状態

    // Initial Active Tab based on permissions
    useEffect(() => {
        if (!authLoading && authz.allowedTemplateIds.length > 0) {
            if (!authz.allowedTemplateIds.includes(activeTemplate)) {
                setActiveTemplate(authz.allowedTemplateIds[0]);
            }
        }
    }, [authLoading, authz.allowedTemplateIds, activeTemplate]);

    // --- State: Cleaning ---
    const [header, setHeader] = useState({
        work_date: new Date().toISOString().split('T')[0],
        reporter_name: '',
        work_start_time: '',
        work_end_time: '',
        total_minutes: 0,
        note: ''
    });
    const [stores, setStores] = useState([emptyStore(true), emptyStore(false), emptyStore(false)]);
    const [daySaved, setDaySaved] = useState({ log_id: null, version: null, state: null });
    const [schedules, setSchedules] = useState([]);
    const [serviceMaster, setServiceMaster] = useState([]);
    const [masterStores, setMasterStores] = useState([]);

    // --- State: Sales ---
    const [sales, setSales] = useState({
        target_name: '',
        visit_type: '訪問',
        status: 'ヒアリング',
        content: '',
        next_actions: '',
        attachments: []
    });

    // --- State: Engineering ---
    const [eng, setEng] = useState({
        project: '',
        status: '進行中',
        tasks_done: '',
        tasks_next: '',
        issues: '',
        attachments: []
    });

    // --- State: Office Admin ---
    const [office, setOffice] = useState({
        counts: { billing: 0, payment: 0, scanning: 0 },
        done: '',
        needs_decision: '',
        next_actions: '',
        attachments: []
    });

    const [isSaving, setIsSaving] = useState(false);
    const [statusMessage, setStatusMessage] = useState(null); // { type: 'success' | 'error', text: string }
    const [saveError, setSaveError] = useState('');

    // --- State: Service Master Modal ---
    const [showServiceModal, setShowServiceModal] = useState(false);
    const [serviceModalCategory, setServiceModalCategory] = useState('すべて');
    const [serviceModalSearch, setServiceModalSearch] = useState('');

    // Sync user name when loaded
    useEffect(() => {
        if (!authLoading && user) {
            const name = user.name || user.displayName || user.username || user.email || '';
            if (name && !header.reporter_name) {
                setHeader(prev => ({ ...prev, reporter_name: name }));
            }
        }
    }, [user, authLoading, header.reporter_name]);

    const loadData = useCallback(async () => {
        // getToken() は期限切れを null 返すので、直接 localStorage からも取得
        const token = getToken() || localStorage.getItem('cognito_id_token');
        if (!token) return;
        const headers = { Authorization: `Bearer ${String(token).trim()}` };

        try {
            try {
                // Fetch the service master data from the centralized S3-backed API
                const svcData = await apiFetch('/services', { headers });
                setServiceMaster(Array.isArray(svcData) ? svcData : svcData.services || svcData.items || []);
            } catch (e) {
                console.warn("Service master fetch failed:", e.message);
            }

            try {
                // Fetch schedules ONLY for the selected work_date
                const targetDate = header.work_date;
                setSchedules([]); // Clear old data before fetching new ones

                const schData = await apiFetch(`/schedules?date_from=${targetDate}&date_to=${targetDate}&limit=100`, { headers });
                const rawSchedules = Array.isArray(schData) ? schData : (schData.items || schData.schedules || []);

                // Stricter filter: status, target existence, and EXACT date match
                const filtered = rawSchedules.filter(s => {
                    const sDate = s.scheduled_date || s.date || '';
                    if (sDate !== targetDate) return false; // Force match with selected date

                    if (s.status === 'cancelled') return false;
                    // Skip empty blocks/notes that don't have a specific target store/name
                    if (!s.target_name && !s.store_name && !s.summary) return false;

                    if (authz.isAdmin) return true;
                    const wIds = s.worker_ids || (s.worker_id ? [s.worker_id] : []);
                    return wIds.includes(authz.workerId);
                }).sort((a, b) => {
                    const timeA = a.start_time || a.start || a.scheduled_time || '00:00';
                    const timeB = b.start_time || b.start || b.scheduled_time || '00:00';
                    return timeA.localeCompare(timeB);
                });

                setSchedules(filtered);
            } catch (e) {
                console.warn("Schedules fetch failed:", e.message);
            }

            try {
                const storeData = await apiFetch('/stores', { headers });
                setMasterStores(Array.isArray(storeData) ? storeData : storeData.items || []);
            } catch (e) {
                console.warn("Stores master fetch failed:", e.message);
            }

            // Fetch existing report if date is present
            const params = new URLSearchParams(window.location.search);
            const date = params.get('date');
            if (date) {
                setHeader(h => ({ ...h, work_date: date }));
                try {
                    const reports = await apiFetchWorkReport(`/work-report?date=${date}`, { headers });
                    if (Array.isArray(reports)) {
                        const dayItem = reports.find(r => r.template_id === TEMPLATE_DAY);
                        if (dayItem) {
                            const d = JSON.parse(dayItem.description || '{}');
                            setHeader({
                                work_date: dayItem.work_date,
                                reporter_name: d.reporter_name || user?.name || '',
                                work_start_time: d.work_start_time || '',
                                work_end_time: d.work_end_time || '',
                                total_minutes: dayItem.work_minutes,
                                note: d.note || ''
                            });
                            setDaySaved({ log_id: dayItem.log_id, version: dayItem.version, state: dayItem.state });
                        }
                        const storeItems = reports.filter(r => r.template_id === TEMPLATE_STORE);
                        if (storeItems.length > 0) {
                            setStores(prev => {
                                const next = [...prev];
                                storeItems.slice(0, 3).forEach((it, i) => {
                                    next[i] = deserializeStoreReport(it.description, it);
                                });
                                return next;
                            });
                        }
                    }
                } catch (e) {
                    console.warn("Failed to load existing reports:", e.message);
                }
            }
        } catch (e) {
            console.error("Failed to load data:", e);
        }
    }, [user, getToken, authz.isAdmin, authz.workerId, header.work_date]);

    // Re-load when date changes
    useEffect(() => {
        if (!authLoading && authz.workerId) {
            loadData();
        }
    }, [header.work_date]);

    const handleApplySchedule = (sch) => {
        // Find first empty or disabled store slot
        const idx = stores.findIndex(s => !s.enabled || !s.store_name);
        const targetIdx = idx === -1 ? activeStoreTab : idx;

        updateStore(targetIdx, {
            enabled: true,
            store_name: sch.target_name || sch.store_name || '',
            brand_name: sch.brand_name || '',
            work_start_time: sch.start || '',
            work_end_time: sch.end || '',
        });
        setActiveStoreTab(targetIdx);
    };

    useEffect(() => {
        if (!authLoading && authz.workerId) {
            loadData();
        }
    }, [authLoading, authz.workerId, loadData]);

    const { isAuthenticated, login } = useAuth();

    if (authLoading) return <div style={{ padding: 40, textAlign: 'center', color: '#fff' }}>読み込み中...</div>;

    if (!isAuthenticated) {
        return (
            <PageContainer>
                <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <h2 style={{ marginBottom: '20px' }}>ログインが必要です</h2>
                    <p style={{ marginBottom: '30px', opacity: 0.8 }}>このページを利用するにはログインしてください。</p>
                    <Link to="/" style={{ textDecoration: 'none' }}>
                        <ActionButton $variant="primary">
                            ポータル（ログイン画面）へ
                        </ActionButton>
                    </Link>
                </div>
            </PageContainer>
        );
    }

    const updateStore = (idx, data) => {
        setStores(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], ...data };
            return next;
        });
    };

    const handleDaySave = async () => {
        setIsSaving(true);
        try {
            const token = getToken() || localStorage.getItem('cognito_id_token');
            const headers = token ? { Authorization: `Bearer ${String(token).trim()}` } : {};
            const res = await apiFetchWorkReport('/houkoku', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    template_id: 'CLEANING_DAY_V1',
                    work_date: header.work_date,
                    payload: {
                        work_start_time: header.work_start_time,
                        work_end_time: header.work_end_time,
                        note: header.note
                    }
                })
            });
            setDaySaved({ log_id: res.log_id, version: res.version, state: res.state });
            alert('一日の詳細を保存しました');
        } catch (e) {
            alert('保存失敗: ' + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleHoukokuUpload = async (index, file, slot = 'before') => {
        setIsSaving(true);
        try {
            const token = getToken() || localStorage.getItem('cognito_id_token');
            const headers = token ? { Authorization: `Bearer ${String(token).trim()}` } : {};

            const res = await apiFetchWorkReport('/houkoku/upload-url', {
                method: 'POST',
                headers,
                body: JSON.stringify({ filename: file.name, mime: file.type })
            });

            await fetch(res.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });

            const newAttachment = { url: res.url, key: res.key, name: file.name };

            if (index === 'SALES') setSales(p => ({ ...p, attachments: [...p.attachments, newAttachment] }));
            else if (index === 'ENGINEERING') setEng(p => ({ ...p, attachments: [...p.attachments, newAttachment] }));
            else if (index === 'OFFICE') setOffice(p => ({ ...p, attachments: [...p.attachments, newAttachment] }));
            else {
                // 清掃報告（店舗 index）の場合
                const attr = slot === 'after' ? 'attachments_after' : 'attachments';
                updateStore(index, {
                    [attr]: [...(stores[index][attr] || []), newAttachment]
                });
            }
        } catch (e) {
            console.error("Upload failed:", e);
            alert("アップロード失敗");
        } finally {
            setIsSaving(false);
        }
    };

    const handleAttachmentRemove = (index, ai, slot = 'before') => {
        if (typeof index === 'number') {
            const attr = slot === 'after' ? 'attachments_after' : 'attachments';
            const next = [...(stores[index][attr] || [])];
            next.splice(ai, 1);
            updateStore(index, { [attr]: next });
        } else {
            // 他のテンプレート用
            const target = index === 'SALES' ? sales : index === 'ENGINEERING' ? eng : office;
            const setFunc = index === 'SALES' ? setSales : index === 'ENGINEERING' ? setEng : setOffice;
            const next = [...target.attachments];
            next.splice(ai, 1);
            setFunc(p => ({ ...p, attachments: next }));
        }
    };

    const handleReset = () => {
        if (!window.confirm('入力内容をリセットしてもよろしいですか？')) return;

        if (activeTemplate === TEMPLATE_CLEANING) {
            setStores([emptyStore(true), emptyStore(false), emptyStore(false)]);
            setHeader(p => ({
                ...p,
                work_start_time: '',
                work_end_time: '',
                note: ''
            }));
            setActiveStoreTab(0);
        } else if (activeTemplate === TEMPLATE_SALES) {
            setSales({ target_name: '', visit_type: '訪問', status: 'ヒアリング', content: '', next_actions: '', attachments: [] });
        } else if (activeTemplate === TEMPLATE_ENGINEERING) {
            setEng({ project: '', status: '進行中', tasks_done: '', tasks_next: '', issues: '', attachments: [] });
        } else if (activeTemplate === TEMPLATE_OFFICE) {
            setOffice({ counts: { billing: 0, payment: 0, scanning: 0 }, done: '', needs_decision: '', next_actions: '', attachments: [] });
        }
    };

    const handleHoukokuSubmit = async (templateId) => {
        if (isSaving) return; // 二重送信防止
        setIsSaving(true);
        let payload = {};
        if (templateId === TEMPLATE_CLEANING) payload = { header, stores: stores.filter(s => s.enabled && s.confirmed).map(s => serializeStoreReport(s)) };
        else if (templateId === TEMPLATE_SALES) payload = sales;
        else if (templateId === TEMPLATE_ENGINEERING) payload = eng;
        else if (templateId === TEMPLATE_OFFICE) payload = office;

        try {
            const token = getToken() || localStorage.getItem('cognito_id_token');
            const headers = token ? { Authorization: `Bearer ${String(token).trim()}` } : {};
            const res = await apiFetchWorkReport('/houkoku', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    template_id: templateId,
                    work_date: header.work_date,
                    payload: payload
                })
            });
            setStatusMessage({ type: 'success', text: '報告を送信しました' });
            handleReset(); // 送信成功後にフォームをリセット
            setTimeout(() => setStatusMessage(null), 3000); // 3秒後に自動で消す
        } catch (e) {
            console.error("Submission failed:", e);
            setStatusMessage({ type: 'error', text: '送信失敗: ' + e.message });
            setTimeout(() => setStatusMessage(null), 5000);
        } finally {
            setIsSaving(false);
        }
    };

    if (authLoading) return <div style={{ padding: 40, textAlign: 'center' }}>読み込み中...</div>;

    return (
        <PageContainer data-job="admin">
            {statusMessage && (
                <StatusOverlay $type={statusMessage.type}>
                    <StatusContent $type={statusMessage.type}>
                        <i className={`fas ${statusMessage.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle'}`}></i>
                        <span>{statusMessage.text}</span>
                    </StatusContent>
                </StatusOverlay>
            )}
            <VizContainer><Visualizer mode="base" /></VizContainer>
            <MainContent>
                <ContentHeader>
                    <BackLink to="/portal"><i className="fas fa-chevron-left"></i></BackLink>
                    <ContentTitle>業務報告</ContentTitle>
                </ContentHeader>

                <TabNav>
                    {authz.allowedTemplateIds.includes(TEMPLATE_CLEANING) && (
                        <TabButton $active={activeTemplate === TEMPLATE_CLEANING} onClick={() => setActiveTemplate(TEMPLATE_CLEANING)}>
                            <i className="fas fa-broom"></i><span>清掃</span>
                        </TabButton>
                    )}
                    {authz.allowedTemplateIds.includes(TEMPLATE_SALES) && (
                        <TabButton $active={activeTemplate === TEMPLATE_SALES} onClick={() => setActiveTemplate(TEMPLATE_SALES)}>
                            <i className="fas fa-briefcase"></i><span>営業</span>
                        </TabButton>
                    )}
                    {authz.allowedTemplateIds.includes(TEMPLATE_ENGINEERING) && (
                        <TabButton $active={activeTemplate === TEMPLATE_ENGINEERING} onClick={() => setActiveTemplate(TEMPLATE_ENGINEERING)}>
                            <i className="fas fa-code"></i><span>開発</span>
                        </TabButton>
                    )}
                    {authz.allowedTemplateIds.includes(TEMPLATE_OFFICE) && (
                        <TabButton $active={activeTemplate === TEMPLATE_OFFICE} onClick={() => setActiveTemplate(TEMPLATE_OFFICE)}>
                            <i className="fas fa-file-invoice"></i><span>事務</span>
                        </TabButton>
                    )}
                </TabNav>

                {activeTemplate === TEMPLATE_CLEANING && (
                    <>
                        <Card>
                            <SectionHeader><CardTitle>1. 清掃報告</CardTitle></SectionHeader>
                            <FormGrid>
                                <Field><Label>作業日</Label><Input type="date" value={header.work_date} onChange={e => setHeader(p => ({ ...p, work_date: e.target.value }))} /></Field>
                                <Field><Label>作業者</Label><Input type="text" value={header.reporter_name} onChange={e => setHeader(p => ({ ...p, reporter_name: e.target.value }))} /></Field>
                                <Field><Label>開始時間</Label><Input type="time" value={header.work_start_time} onChange={e => setHeader(p => ({ ...p, work_start_time: e.target.value }))} /></Field>
                                <Field><Label>終了時間</Label><Input type="time" value={header.work_end_time} onChange={e => setHeader(p => ({ ...p, work_end_time: e.target.value }))} /></Field>
                                <Field $full><Label>備考</Label><FormTextarea value={header.note} onChange={e => setHeader(p => ({ ...p, note: e.target.value }))} /></Field>
                            </FormGrid>
                            <ButtonRow>
                                <ActionButton $variant="primary" onClick={handleDaySave} disabled={isSaving}>保存</ActionButton>
                                <ActionButton $variant="secondary" onClick={handleReset}>リセット</ActionButton>
                            </ButtonRow>
                        </Card>

                        {schedules.length > 0 && (
                            <Card style={{ border: '1px dashed #3b82f6' }}>
                                <SectionHeader style={{ border: 'none', marginBottom: 12 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <CardTitle style={{ fontSize: '0.9rem', opacity: 0.8 }}>本日の予定案件（スケジュールから引用）</CardTitle>
                                        <small style={{ color: '#94a3b8' }}>{schedules.length}件見つかりました</small>
                                    </div>
                                </SectionHeader>
                                <ScheduleList>
                                    {schedules
                                        .filter(s => {
                                            if (authz.isAdmin) return true;
                                            const wIds = s.worker_ids || (s.worker_id ? [s.worker_id] : []);
                                            return wIds.includes(authz.workerId);
                                        })
                                        .map((s, si) => {
                                            const name = s.target_name || s.store_name || '案件';
                                            const time = s.start_time || s.start || '';
                                            return (
                                                <ScheduleItem key={si} onClick={() => handleApplySchedule(s)}>
                                                    <div style={{ fontWeight: 600 }}>{time} {name}</div>
                                                    <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>{s.work_type || s.order_type}</div>
                                                </ScheduleItem>
                                            );
                                        })}
                                </ScheduleList>
                            </Card>
                        )}

                        <StoreTabNav>
                            {stores.map((s, i) => (
                                <StoreTabItem key={i} $active={activeStoreTab === i} onClick={() => setActiveStoreTab(i)}>
                                    <input type="checkbox" checked={s.enabled} onChange={e => updateStore(i, { enabled: e.target.checked })} />
                                    <span>{s.store_name || `店舗${i + 1}`}</span>
                                </StoreTabItem>
                            ))}
                        </StoreTabNav>

                        {stores.map((s, i) => i === activeStoreTab && (
                            <Card key={i}>
                                <SectionHeader><CardTitle>店舗 {i + 1} 報告</CardTitle></SectionHeader>
                                {s.enabled && (
                                    <>
                                        <FormGrid>
                                            <Field><Label>作業開始</Label><Input type="time" value={s.work_start_time} onChange={e => updateStore(i, { work_start_time: e.target.value })} /></Field>
                                            <Field><Label>作業終了</Label><Input type="time" value={s.work_end_time} onChange={e => updateStore(i, { work_end_time: e.target.value })} /></Field>
                                            <Field $full style={{ position: 'relative' }}>
                                                <Label>店舗名 (検索して選択)</Label>
                                                <Input
                                                    value={s.store_name}
                                                    placeholder="店舗名を入力して検索..."
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        updateStore(i, { store_name: val });
                                                    }}
                                                />
                                                {s.store_name && !s.confirmed && (
                                                    <SuggestionList>
                                                        {masterStores
                                                            .filter(m => (m.name || '').includes(s.store_name) || (m.brand_name || '').includes(s.store_name))
                                                            .slice(0, 10)
                                                            .map(m => (
                                                                <SuggestionItem key={m.store_id || m.id} onClick={() => {
                                                                    updateStore(i, {
                                                                        store_name: m.name,
                                                                        corporate_name: m.company_name || m.client_name || '',
                                                                        brand_name: m.brand_name || '',
                                                                        address: m.address || '',
                                                                    });
                                                                }}>
                                                                    <strong>{m.name}</strong> <small style={{ opacity: 0.6 }}>({m.brand_name || 'ブランドなし'})</small>
                                                                </SuggestionItem>
                                                            ))
                                                        }
                                                    </SuggestionList>
                                                )}
                                            </Field>
                                            <Field $full><Label>所感</Label><FormTextarea value={s.note} onChange={e => updateStore(i, { note: e.target.value })} /></Field>
                                        </FormGrid>
                                        <div style={{ marginTop: 24 }}>
                                            <Label>清掃内容</Label>

                                            <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                                                <span style={{ fontSize: '0.8rem', color: '#94a3b8', marginRight: 4 }}>クイック追加:</span>
                                                <ActionButton
                                                    $variant="primary"
                                                    style={{ padding: '6px 16px', fontSize: '0.8rem', background: '#3b82f6' }}
                                                    onClick={() => {
                                                        setShowServiceModal(true);
                                                    }}
                                                >
                                                    <i className="fas fa-list-ul"></i> マスタから選択
                                                </ActionButton>
                                                <div style={{ width: '100%', height: '8px' }}></div>
                                                {serviceMaster
                                                    .filter(m => [1, 2, 3, 4, 5, 10, 35].includes(m.id))
                                                    .map(m => (
                                                        <button
                                                            key={m.id}
                                                            type="button"
                                                            style={{
                                                                padding: '4px 12px',
                                                                borderRadius: '16px',
                                                                border: '1px solid #3b82f6',
                                                                background: 'transparent',
                                                                color: '#3b82f6',
                                                                fontSize: '0.75rem',
                                                                cursor: 'pointer'
                                                            }}
                                                            onClick={() => {
                                                                const next = [...s.services];
                                                                const emptyIdx = next.findIndex(sv => !sv.name);
                                                                if (emptyIdx !== -1) {
                                                                    next[emptyIdx].name = m.title;
                                                                    next[emptyIdx].confirmed = true;
                                                                } else {
                                                                    next.push({ name: m.title, minutes: 0, memo: '', confirmed: true });
                                                                }
                                                                updateStore(i, { services: next });
                                                            }}
                                                        >
                                                            + {m.title}
                                                        </button>
                                                    ))
                                                }
                                            </div>

                                            {s.services.map((sv, si) => (
                                                <div key={si} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
                                                    <div style={{ position: 'relative', flex: 1 }}>
                                                        <Input
                                                            value={sv.name}
                                                            placeholder="清掃箇所（例：換気扇、床）"
                                                            onChange={e => {
                                                                const val = e.target.value;
                                                                const next = [...s.services];
                                                                next[si].name = val;
                                                                next[si].confirmed = false;
                                                                updateStore(i, { services: next });
                                                            }}
                                                        />
                                                        {sv.name && !sv.confirmed && serviceMaster.length > 0 && (
                                                            <SuggestionList style={{ top: '100%', left: 0, width: '100%', zIndex: 10 }}>
                                                                {serviceMaster
                                                                    .filter(m => (m.title || '').includes(sv.name) || (m.category || '').includes(sv.name))
                                                                    .slice(0, 8)
                                                                    .map((m, mi) => (
                                                                        <SuggestionItem key={m.id || mi} onClick={() => {
                                                                            const next = [...s.services];
                                                                            next[si].name = m.title;
                                                                            next[si].confirmed = true;
                                                                            updateStore(i, { services: next });
                                                                        }}>
                                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                                <span>{m.title}</span>
                                                                                <small style={{ opacity: 0.5, fontSize: '0.7rem' }}>{m.category}</small>
                                                                            </div>
                                                                        </SuggestionItem>
                                                                    ))
                                                                }
                                                            </SuggestionList>
                                                        )}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        style={{ background: 'transparent', border: 'none', color: '#ff4d4f', padding: '8px', cursor: 'pointer' }}
                                                        onClick={() => {
                                                            const next = [...s.services];
                                                            next.splice(si, 1);
                                                            updateStore(i, { services: next });
                                                        }}
                                                    >
                                                        <i className="fas fa-times"></i>
                                                    </button>
                                                </div>
                                            ))}
                                            <ActionButton $variant="secondary" style={{ marginTop: 8 }} onClick={() => updateStore(i, { services: [...s.services, { name: '', minutes: 0, memo: '', confirmed: false }] })}>
                                                <i className="fas fa-plus"></i> 項目を追加
                                            </ActionButton>
                                        </div>
                                        <div style={{ marginTop: 24 }}>
                                            <Label>写真モード</Label>
                                            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                                                <ActionButton $variant={s.photo_mode === 'before_after' ? 'primary' : 'secondary'} onClick={() => updateStore(i, { photo_mode: 'before_after' })}>Before / After</ActionButton>
                                                <ActionButton $variant={s.photo_mode === 'execution' ? 'primary' : 'secondary'} onClick={() => updateStore(i, { photo_mode: 'execution' })}>施工後のみ</ActionButton>
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                                                <div>
                                                    <Label>{s.photo_mode === 'before_after' ? '作業前 (Before)' : '施工写真'}</Label>
                                                    <UploadZone onClick={() => document.getElementById(`upload-${i}-before`).click()}>画像を選択</UploadZone>
                                                    <input id={`upload-${i}-before`} type="file" multiple hidden onChange={e => Array.from(e.target.files).forEach(f => handleHoukokuUpload(i, f, 'before'))} />
                                                    <AttachmentList>
                                                        {s.attachments.map((at, ai) => (
                                                            <AttachmentCard key={ai}><RemoveBtn onClick={() => handleAttachmentRemove(i, ai, 'before')}>x</RemoveBtn><img src={at.url} alt="" /></AttachmentCard>
                                                        ))}
                                                    </AttachmentList>
                                                </div>
                                                {s.photo_mode === 'before_after' && (
                                                    <div>
                                                        <Label>作業後 (After)</Label>
                                                        <UploadZone onClick={() => document.getElementById(`upload-${i}-after`).click()}>画像を選択</UploadZone>
                                                        <input id={`upload-${i}-after`} type="file" multiple hidden onChange={e => Array.from(e.target.files).forEach(f => handleHoukokuUpload(i, f, 'after'))} />
                                                        <AttachmentList>
                                                            {s.attachments_after.map((at, ai) => (
                                                                <AttachmentCard key={ai}><RemoveBtn onClick={() => handleAttachmentRemove(i, ai, 'after')}>x</RemoveBtn><img src={at.url} alt="" /></AttachmentCard>
                                                            ))}
                                                        </AttachmentList>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div style={{ marginTop: 24, padding: 20, background: 'rgba(255,255,255,0.05)', borderRadius: 16 }}>
                                            <Label style={{ color: '#3b82f6', fontSize: '1rem' }}>現場調査・点検項目</Label>
                                            <FormGrid style={{ marginTop: 16 }}>
                                                <Field>
                                                    <Label>油脂の堆積状況</Label>
                                                    <select style={{ width: '100%', padding: 10, borderRadius: 8 }} value={s.inspection.fat_level} onChange={e => updateStore(i, { inspection: { ...s.inspection, fat_level: e.target.value } })}>
                                                        <option value="low">少</option><option value="middle">中</option><option value="high">多</option><option value="abnormal">異常</option>
                                                    </select>
                                                </Field>
                                                <Field>
                                                    <Label>悪臭の有無</Label>
                                                    <select style={{ width: '100%', padding: 10, borderRadius: 8 }} value={s.inspection.odor_level} onChange={e => updateStore(i, { inspection: { ...s.inspection, odor_level: e.target.value } })}>
                                                        <option value="none">なし</option><option value="low">弱</option><option value="middle">中</option><option value="high">強</option>
                                                    </select>
                                                </Field>
                                                <Field>
                                                    <Label>状態評価</Label>
                                                    <select style={{ width: '100%', padding: 10, borderRadius: 8 }} value={s.inspection.assessment} onChange={e => updateStore(i, { inspection: { ...s.inspection, assessment: e.target.value } })}>
                                                        <option value="normal">通常想定内</option><option value="unexpected">想定外（長期未清掃など）</option>
                                                    </select>
                                                </Field>
                                            </FormGrid>
                                        </div>

                                        <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <Checkbox type="checkbox" id={`confirm-${i}`} checked={s.confirmed} onChange={e => updateStore(i, { confirmed: e.target.checked })} />
                                            <Label htmlFor={`confirm-${i}`} style={{ margin: 0, cursor: 'pointer', color: s.confirmed ? '#3b82f6' : '#94a3b8' }}>報告内容を確認しました（完了チェック）</Label>
                                        </div>
                                    </>
                                )}
                            </Card>
                        ))}
                        <ButtonRow style={{ display: 'flex', gap: 12 }}>
                            <ActionButton $variant="secondary" style={{ flex: 1, height: 50 }} onClick={() => setShowPreview(true)}>
                                <i className="fas fa-eye"></i> 提出前にプレビュー
                            </ActionButton>
                            <ActionButton $variant="primary" style={{ flex: 2, height: 50 }} onClick={() => handleHoukokuSubmit(TEMPLATE_CLEANING)} disabled={isSaving}>
                                <i className="fas fa-paper-plane"></i> 提出
                            </ActionButton>
                        </ButtonRow>

                        {/* --- Preview Modal --- */}
                        {showPreview && (
                            <PreviewOverlay onClick={() => setShowPreview(false)}>
                                <PreviewContent onClick={e => e.stopPropagation()}>
                                    <PreviewHeader>
                                        <h3>提出前プレビュー</h3>
                                        <CloseBtn onClick={() => setShowPreview(false)}><i className="fas fa-times"></i></CloseBtn>
                                    </PreviewHeader>
                                    <PreviewInner>
                                        <PreviewLabel>管理者には以下のように表示されます</PreviewLabel>

                                        {/* 基本情報の再現 */}
                                        <PreviewCard>
                                            <div style={{ fontWeight: 800, marginBottom: 16, borderBottom: '1px solid #eee', paddingBottom: 8 }}>基本情報</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 14 }}>
                                                <div><small style={{ color: '#94a3b8' }}>作業日</small><div>{header.work_date}</div></div>
                                                <div><small style={{ color: '#94a3b8' }}>作業者</small><div>{header.reporter_name}</div></div>
                                                <div><small style={{ color: '#94a3b8' }}>時間</small><div>{header.work_start_time} - {header.work_end_time}</div></div>
                                            </div>
                                            {header.note && <div style={{ marginTop: 12 }}><small style={{ color: '#94a3b8' }}>備考</small><div style={{ fontSize: 14 }}>{header.note}</div></div>}
                                        </PreviewCard>

                                        {/* 店舗ごとの再現 */}
                                        {stores.filter(s => s.enabled).map((s, idx) => (
                                            <PreviewCard key={idx}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eee', paddingBottom: 8, marginBottom: 12 }}>
                                                    <div style={{ fontWeight: 800 }}>店舗 {idx + 1}: {s.store_name}</div>
                                                    <div style={{ fontSize: 12, color: '#64748b' }}>{s.work_start_time} - {s.work_end_time}</div>
                                                </div>
                                                <div style={{ fontSize: 14, marginBottom: 12 }}>
                                                    <small style={{ color: '#94a3b8', display: 'block', marginBottom: 4 }}>清掃項目</small>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                        {s.services.map((sv, si) => sv.name && <span key={si} style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>{sv.name}</span>)}
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: 14 }}>
                                                    <small style={{ color: '#94a3b8', display: 'block', marginBottom: 4 }}>所感</small>
                                                    <div>{s.note || '特筆事項なし'}</div>
                                                </div>
                                                {s.attachments.length > 0 && (
                                                    <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8 }}>
                                                        {s.attachments.map((at, ai) => <img key={ai} src={at.url} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8 }} />)}
                                                    </div>
                                                )}
                                            </PreviewCard>
                                        ))}

                                        <div style={{ padding: 20, textAlign: 'center' }}>
                                            <ActionButton $variant="primary" onClick={() => { setShowPreview(false); handleHoukokuSubmit(TEMPLATE_CLEANING); }}>
                                                問題ないので提出する
                                            </ActionButton>
                                        </div>
                                    </PreviewInner>
                                </PreviewContent>
                            </PreviewOverlay>
                        )}

                        {/* --- Service Master Modal --- */}
                        {showServiceModal && (
                            <PreviewOverlay onClick={() => setShowServiceModal(false)}>
                                <PreviewContent style={{ maxWidth: '600px', height: '80vh', background: '#1e293b', border: '1px solid #334155' }} onClick={e => e.stopPropagation()}>
                                    <PreviewHeader style={{ background: '#1e293b', borderBottom: '1px solid #334155' }}>
                                        <h3 style={{ color: '#fff' }}>サービスマスタ選択</h3>
                                        <CloseBtn style={{ background: '#334155', color: '#94a3b8' }} onClick={() => setShowServiceModal(false)}><i className="fas fa-times"></i></CloseBtn>
                                    </PreviewHeader>
                                    <div style={{ padding: '0 20px 20px' }}>
                                        <Input
                                            placeholder="サービス名で検索..."
                                            value={serviceModalSearch}
                                            onChange={e => setServiceModalSearch(e.target.value)}
                                            style={{ marginBottom: 16 }}
                                        />

                                        <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 8 }}>
                                            {['すべて', ...new Set(serviceMaster.map(m => m.category || 'その他'))].filter(cat => cat !== '定期清掃').map(cat => (
                                                <CategoryTab
                                                    key={cat}
                                                    $active={serviceModalCategory === cat}
                                                    onClick={() => setServiceModalCategory(cat)}
                                                >
                                                    {cat}
                                                </CategoryTab>
                                            ))}
                                        </div>

                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: '1fr 1fr',
                                            gap: 12,
                                            maxHeight: 'calc(80vh - 200px)',
                                            overflowY: 'auto',
                                            paddingRight: 4
                                        }}>
                                            {serviceMaster
                                                .filter(m => {
                                                    const cat = m.category || 'その他';
                                                    if (cat === '定期清掃') return false;
                                                    const matchCat = serviceModalCategory === 'すべて' || cat === serviceModalCategory;
                                                    const matchSearch = (m.title || '').includes(serviceModalSearch);
                                                    return matchCat && matchSearch;
                                                })
                                                .map(m => (
                                                    <ServiceItemCard
                                                        key={m.id}
                                                        onClick={() => {
                                                            const next = [...stores[activeStoreTab].services];
                                                            const exists = next.some(sv => sv.name === m.title);
                                                            if (!exists) {
                                                                const emptyIdx = next.findIndex(sv => !sv.name);
                                                                if (emptyIdx !== -1) {
                                                                    next[emptyIdx].name = m.title;
                                                                    next[emptyIdx].confirmed = true;
                                                                } else {
                                                                    next.push({ name: m.title, minutes: 0, memo: '', confirmed: true });
                                                                }
                                                                updateStore(activeStoreTab, { services: next });
                                                            }
                                                            setShowServiceModal(false);
                                                        }}
                                                    >
                                                        <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 4 }}>{m.title}</div>
                                                        <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>{m.category || 'その他'}</div>
                                                    </ServiceItemCard>
                                                ))
                                            }
                                        </div>
                                    </div>
                                </PreviewContent>
                            </PreviewOverlay>
                        )}
                    </>
                )}

                {activeTemplate === TEMPLATE_SALES && (
                    <Card>
                        <SectionHeader><CardTitle>営業報告</CardTitle></SectionHeader>
                        <FormGrid>
                            <Field $full><Label>訪問先</Label><Input value={sales.target_name} onChange={e => setSales(p => ({ ...p, target_name: e.target.value }))} /></Field>
                            <Field $full><Label>内容</Label><FormTextarea value={sales.content} onChange={e => setSales(p => ({ ...p, content: e.target.value }))} /></Field>
                        </FormGrid>
                        <div style={{ marginTop: 24 }}>
                            <Label>添付</Label>
                            <UploadZone onClick={() => document.getElementById('sales-up').click()}>選択</UploadZone>
                            <input id="sales-up" type="file" multiple hidden onChange={e => Array.from(e.target.files).forEach(f => handleHoukokuUpload('SALES', f))} />
                            <AttachmentList>
                                {sales.attachments.map((at, i) => (
                                    <AttachmentCard key={i}><RemoveBtn onClick={() => handleAttachmentRemove('SALES', i)}>x</RemoveBtn><img src={at.url} alt="" /></AttachmentCard>
                                ))}
                            </AttachmentList>
                        </div>
                        <ButtonRow>
                            <ActionButton $variant="primary" style={{ flex: 1 }} onClick={() => handleHoukokuSubmit(TEMPLATE_SALES)} disabled={isSaving}>提出</ActionButton>
                            <ActionButton $variant="secondary" onClick={handleReset}>リセット</ActionButton>
                        </ButtonRow>
                    </Card>
                )}

                {activeTemplate === TEMPLATE_ENGINEERING && (
                    <Card>
                        <SectionHeader><CardTitle>開発報告</CardTitle></SectionHeader>
                        <FormGrid>
                            <Field $full><Label>プロジェクト</Label><Input value={eng.project} onChange={e => setEng(p => ({ ...p, project: e.target.value }))} /></Field>
                            <Field $full><Label>完了事項</Label><FormTextarea value={eng.tasks_done} onChange={e => setEng(p => ({ ...p, tasks_done: e.target.value }))} /></Field>
                        </FormGrid>
                        <div style={{ marginTop: 24 }}>
                            <Label>添付</Label>
                            <UploadZone onClick={() => document.getElementById('eng-up').click()}>選択</UploadZone>
                            <input id="eng-up" type="file" multiple hidden onChange={e => Array.from(e.target.files).forEach(f => handleHoukokuUpload('ENGINEERING', f))} />
                            <AttachmentList>
                                {eng.attachments.map((at, i) => (
                                    <AttachmentCard key={i}><RemoveBtn onClick={() => handleAttachmentRemove('ENGINEERING', i)}>x</RemoveBtn><img src={at.url} alt="" /></AttachmentCard>
                                ))}
                            </AttachmentList>
                        </div>
                        <ButtonRow>
                            <ActionButton $variant="primary" style={{ flex: 1 }} onClick={() => handleHoukokuSubmit(TEMPLATE_ENGINEERING)} disabled={isSaving}>提出</ActionButton>
                            <ActionButton $variant="secondary" onClick={handleReset}>リセット</ActionButton>
                        </ButtonRow>
                    </Card>
                )}

                {activeTemplate === TEMPLATE_OFFICE && (
                    <Card>
                        <SectionHeader><CardTitle>事務報告</CardTitle></SectionHeader>
                        <FormGrid>
                            <Field $full><Label>完了事項</Label><FormTextarea value={office.done} onChange={e => setOffice(p => ({ ...p, done: e.target.value }))} /></Field>
                        </FormGrid>
                        <div style={{ marginTop: 24 }}>
                            <Label>添付</Label>
                            <UploadZone onClick={() => document.getElementById('off-up').click()}>選択</UploadZone>
                            <input id="off-up" type="file" multiple hidden onChange={e => Array.from(e.target.files).forEach(f => handleHoukokuUpload('OFFICE', f))} />
                            <AttachmentList>
                                {office.attachments.map((at, i) => (
                                    <AttachmentCard key={i}><RemoveBtn onClick={() => handleAttachmentRemove('OFFICE', i)}>x</RemoveBtn><img src={at.url} alt="" /></AttachmentCard>
                                ))}
                            </AttachmentList>
                        </div>
                        <ButtonRow>
                            <ActionButton $variant="primary" style={{ flex: 1 }} onClick={() => handleHoukokuSubmit(TEMPLATE_OFFICE)} disabled={isSaving}>提出</ActionButton>
                            <ActionButton $variant="secondary" onClick={handleReset}>リセット</ActionButton>
                        </ButtonRow>
                    </Card>
                )}

                <div style={{ marginTop: 32, textAlign: 'center' }}>
                    <Link to="/portal" style={{ color: '#64748b', textDecoration: 'none' }}>ポータルに戻る</Link>
                </div>
            </MainContent>
        </PageContainer>
    );
}

const PageContainer = styled.div` min-height: 100vh; background: #0f172a; color: #f8fafc; `;
const VizContainer = styled.div` position: fixed; inset: 0; pointer-events: none; z-index: 0; opacity: 0.3; `;
const MainContent = styled.div` position: relative; z-index: 1; max-width: 800px; margin: 0 auto; padding: 24px 16px; `;
const ContentHeader = styled.header` display: flex; align-items: center; gap: 16px; margin-bottom: 32px; `;
const BackLink = styled(Link)` color: #94a3b8; `;
const ContentTitle = styled.h1` font-size: 1.5rem; font-weight: 700; `;
const TabNav = styled.div` display: flex; gap: 8px; margin-bottom: 24px; overflow-x: auto; `;
const TabButton = styled.button` display: flex; align-items: center; gap: 8px; padding: 10px 20px; background: ${props => props.$active ? '#3b82f6' : '#1e293b'}; color: #fff; border: 1px solid #334155; border-radius: 99px; cursor: pointer; `;
const Card = styled.div` background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(8px); border: 1px solid #334155; border-radius: 16px; padding: 24px; margin-bottom: 24px; `;
const SectionHeader = styled.div` margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); `;
const CardTitle = styled.h2` font-size: 1.1rem; color: #3b82f6; `;
const FormGrid = styled.div` display: grid; grid-template-columns: 1fr 1fr; gap: 16px; @media(max-width:600px){ grid-template-columns:1fr; } `;
const Field = styled.div` grid-column: ${props => props.$full ? '1 / -1' : 'span 1'}; `;
const Label = styled.label` display: block; font-size: 0.85rem; color: #94a3b8; margin-bottom: 6px; `;
const Input = styled.input` width: 100%; background: #1e293b; border: 1px solid #334155; color: #fff; padding: 10px; border-radius: 8px; `;
const FormTextarea = styled.textarea` width: 100%; height: 100px; background: #1e293b; border: 1px solid #334155; color: #fff; padding: 10px; border-radius: 8px; `;
const ButtonRow = styled.div` display: flex; gap: 12px; margin-top: 24px; `;
const ActionButton = styled.button` padding: 10px 24px; border-radius: 8px; font-weight: 600; cursor: pointer; background: ${props => props.$variant === 'primary' ? '#3b82f6' : '#334155'}; color: #fff; border: none; &:disabled{ opacity: 0.5; } `;
const StoreTabNav = styled.div` display: flex; gap: 4px; margin-bottom: 16px; `;
const StoreTabItem = styled.div` flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px; background: ${props => props.$active ? 'rgba(59, 130, 246, 0.2)' : 'rgba(30, 41, 59, 0.5)'}; border: 1px solid ${props => props.$active ? '#3b82f6' : '#334155'}; border-radius: 8px; cursor: pointer; `;
const UploadZone = styled.div` border: 2px dashed #334155; padding: 20px; text-align: center; color: #94a3b8; border-radius: 12px; cursor: pointer; `;
const AttachmentList = styled.div` display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 12px; margin-top: 12px; `;
const AttachmentCard = styled.div` position: relative; aspect-ratio: 1; border-radius: 8px; overflow: hidden; img { width: 100%; height: 100%; object-fit: cover; } `;
const RemoveBtn = styled.button` position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,0.5); color: #fff; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; `;

const Checkbox = styled.input`
    width: 20px;
    height: 20px;
    accent-color: #3b82f6;
    cursor: pointer;
`;

const SuggestionList = styled.div`
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 8px;
    margin-top: 4px;
    max-height: 200px;
    overflow-y: auto;
    z-index: 100;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
`;

const SuggestionItem = styled.div`
    padding: 10px 16px;
    cursor: pointer;
    border-bottom: 1px solid #334155;
    &:hover { background: #334155; }
    &:last-child { border-bottom: none; }
`;

const ScheduleList = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
`;

const ScheduleItem = styled.div`
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 10px;
    padding: 12px;
    cursor: pointer;
    transition: all 0.2s;
    &:hover {
        background: rgba(59, 130, 246, 0.2);
        transform: translateY(-2px);
    }
`;

const StatusOverlay = styled.div`
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0.4);
    backdrop-filter: blur(4px);
    animation: fadeIn 0.3s ease-out;
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
`;

const StatusContent = styled.div`
    background: ${props => props.$type === 'success' ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)' : 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'};
    color: white;
    padding: 24px 48px;
    border-radius: 16px;
    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2), 0 10px 10px -5px rgba(0,0,0,0.1);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    
    i { font-size: 48px; }
    span { font-size: 20px; font-weight: 600; text-shadow: 0 2px 4px rgba(0,0,0,0.1); }
`;

const PreviewOverlay = styled.div`
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.85);
    backdrop-filter: blur(8px);
    z-index: 2000;
    padding: 20px;
    display: flex;
    justify-content: center;
    align-items: center;
`;

const PreviewContent = styled.div`
    background: #f8fafc;
    width: 100%;
    max-width: 600px;
    max-height: 90vh;
    border-radius: 24px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
    border: 1px solid rgba(255,255,255,0.1);
`;

const PreviewHeader = styled.div`
    padding: 20px 24px;
    background: white;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    h3 { margin: 0; font-size: 18px; color: #1e293b; }
`;

const CloseBtn = styled.button`
    background: #f1f5f9;
    border: none;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 14px;
    color: #64748b;
    &:hover { background: #e2e8f0; color: #1e293b; }
`;

const PreviewInner = styled.div`
    padding: 24px;
    overflow-y: auto;
    flex: 1;
`;

const PreviewLabel = styled.div`
    font-size: 12px;
    color: #3b82f6;
    font-weight: 800;
    margin-bottom: 20px;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 0.05em;
`;

const PreviewCard = styled.div`
    background: white;
    border-radius: 16px;
    padding: 20px;
    margin-bottom: 16px;
    border: 1px solid #e2e8f0;
    color: #334155;
`;

const CategoryTab = styled.button`
    padding: 6px 16px;
    border-radius: 20px;
    border: 1px solid ${props => props.$active ? '#3b82f6' : '#334155'};
    background: ${props => props.$active ? '#3b82f6' : 'transparent'};
    color: ${props => props.$active ? '#fff' : '#94a3b8'};
    font-size: 0.8rem;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.2s;
    &:hover { border-color: #3b82f6; color: #fff; }
`;

const ServiceItemCard = styled.div`
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid #334155;
    border-radius: 12px;
    padding: 12px;
    cursor: pointer;
    transition: all 0.2s;
    &:hover {
        background: rgba(59, 130, 246, 0.1);
        border-color: #3b82f6;
        transform: translateY(-2px);
    }
`;
