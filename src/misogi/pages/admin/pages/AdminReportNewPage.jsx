import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../../shared/auth/useAuth';
import { apiFetch, apiFetchWorkReport } from '../../shared/api/client';
import Visualizer from '../../shared/ui/Visualizer/Visualizer';
import TemplateRenderer, { validateTemplatePayload } from '../../../shared/components/TemplateRenderer';
import { getTemplateById, getTemplateList } from '../../../templates';

// --- Constants ---
const TEMPLATE_STORE = 'CLEANING_STORE_V1';
const TEMPLATE_SALES = 'SALES_ACTIVITY_REPORT_V1';
const TEMPLATE_CLEANING = 'CLEANING_V1';
const TEMPLATE_ENGINEERING = 'ENGINEERING_V1';
const TEMPLATE_OFFICE = 'OFFICE_ADMIN_V1';
const TEMPLATE_DAY = 'CLEANING_DAY_V1';

const SERVICE_TO_TEMPLATE = {
    'グリストラップ': 'CLEAN_GREASE_TRAP_V1',
    'グリストラップ清掃': 'CLEAN_GREASE_TRAP_V1',
    'レンジフード': 'CLEAN_RANGE_HOOD_V1',
    '換気扇': 'CLEAN_VENTILATION_FAN_V1',
    'ダクト洗浄': 'CLEAN_DUCT_V1',
    'シロッコファン洗浄': 'CLEAN_RANGE_HOOD_SIROCCO_V1',
    '配管高圧洗浄': 'CLEAN_PIPE_PRESSURE_WASH_V1',
    'グレーチング清掃': 'CLEAN_GRATING_V1',
    '厨房機器洗浄': 'CLEAN_KITCHEN_EQUIPMENT_V1',
    '厨房壁面清掃': 'CLEAN_KITCHEN_WALL_V1',
    'シンク洗浄': 'CLEAN_SINK_V1',
    '排気ファン点検': 'MAINT_EXHAUST_FAN_BELT_V1',
    '防火シャッター点検': 'MAINT_FIRE_SHUTTER_V1',
    'ゴキブリ駆除': 'PEST_INSECT_CONTROL_V1',
    'チョウバエ駆除': 'PEST_INSECT_CONTROL_V1',
    'ネズミ駆除': 'PEST_RODENT_CONTROL_V1',
    '床ワックス': 'CLEAN_FLOOR_WAX_V1',
};

// サービス名からtemplate_idを取得（マッチしなければデフォルトを返す）
const getTemplateIdFromServices = (services, defaultId = TEMPLATE_CLEANING) => {
    if (!services || services.length === 0) return defaultId;
    // 最初にマッチしたサービスのtemplate_idを使う
    for (const svc of services) {
        const name = svc.name || '';
        if (SERVICE_TO_TEMPLATE[name]) {
            return SERVICE_TO_TEMPLATE[name];
        }
    }
    return defaultId;
};

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
    note: '',
    // テンプレート駆動用のデータ
    template_id: null,
    template_payload: {},
    services: [{ name: '', minutes: 0, memo: '' }],
    attachments: [],
    attachments_after: [],
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
        },
        template_id: store.template_id,
        template_payload: store.template_payload,
        attachments: (store.attachments || []).map(a => ({ key: a.key, url: a.url, name: a.name || 'before' })),
        attachments_after: (store.attachments_after || []).map(a => ({ key: a.key, url: a.url, name: a.name || 'after' }))
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
    const [showPreview, setShowPreview] = useState(false); // プレビュー状態

    // Initial Active Tab based on permissions
    // Initial Active Tab based on permissions - DISABLED for now to allow all
    // useEffect(() => {
    //     if (!authLoading && authz.allowedTemplateIds.length > 0) {
    //         if (!authz.allowedTemplateIds.includes(activeTemplate)) {
    //             setActiveTemplate(authz.allowedTemplateIds[0]);
    //         }
    //     }
    // }, [authLoading, authz.allowedTemplateIds, activeTemplate]);

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

    // --- State: Template Mode ---
    // アクティブな店舗インデックス (0, 1, 2)
    const [activeStoreIdx, setActiveStoreIdx] = useState(0);
    const currentStore = stores[activeStoreIdx];
    const selectedTemplate = currentStore?.template_id ? getTemplateById(currentStore.template_id) : null;

    // Sync user name when loaded
    useEffect(() => {
        if (!authLoading && user) {
            const name = user.name || user.displayName || user.username || user.email || '';
            const email = user.email || '';
            const today = new Date().toISOString().split('T')[0];

            if (name && !header.reporter_name) {
                setHeader(prev => ({ ...prev, reporter_name: name }));
            }
            if (activeTemplate === TEMPLATE_CLEANING && email === 'konno@misesapo.co.jp') {
                setActiveTemplate(TEMPLATE_SALES);
            }

            // 営業テンプレートの初期値設定
            setSales(prev => {
                if (prev.work_date && prev.user_name) return prev;
                return {
                    ...prev,
                    work_date: prev.work_date || today,
                    user_name: prev.user_name || name
                };
            });
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
        const targetIdx = idx === -1 ? activeStoreIdx : idx;

        updateStore(targetIdx, {
            enabled: true,
            store_name: sch.target_name || sch.store_name || '',
            brand_name: sch.brand_name || '',
            work_start_time: sch.start_time || sch.start || '',
            work_end_time: sch.end_time || sch.end || '',
        });
        setActiveStoreIdx(targetIdx);
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
            setActiveStoreIdx(0);
        } else if (activeTemplate === TEMPLATE_SALES) {
            setSales({});
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
        let finalTemplateId = templateId;

        if (templateId === TEMPLATE_CLEANING) {
            const confirmedStores = stores.filter(s => s.enabled && s.confirmed);
            if (confirmedStores.length === 0) {
                setStatusMessage({ type: 'error', text: '確認済みの店舗がありません' });
                setTimeout(() => setStatusMessage(null), 3000);
                setIsSaving(false); // Ensure saving state is reset
                return;
            }

            // バリデーションチェック
            for (const store of confirmedStores) {
                const tmpl = getTemplateById(store.template_id);
                if (tmpl) {
                    const errors = validateTemplatePayload(tmpl, store.template_payload);
                    if (errors.length > 0) {
                        setStatusMessage({ type: 'error', text: `${store.store_name}: ${errors[0]}` });
                        setTimeout(() => setStatusMessage(null), 5000);
                        setIsSaving(false); // Ensure saving state is reset
                        return;
                    }
                }
            }

            payload = { header, stores: confirmedStores.map(s => serializeStoreReport(s)) };

            // 店舗のサービスからtemplate_idを決定
            // 複数店舗がある場合は最初の店舗の最初のマッチするサービスを使う
            for (const store of confirmedStores) {
                const matchedId = getTemplateIdFromServices(store.services, null);
                if (matchedId) {
                    finalTemplateId = matchedId;
                    break;
                }
            }
            // マッチしなければ元のtemplateIdのまま
            if (!finalTemplateId) finalTemplateId = templateId;
        }
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
                    template_id: finalTemplateId,
                    work_date: header.work_date,
                    user_name: header.reporter_name,
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

    // テンプレートモードでの提出
    const handleTemplateSubmit = async () => {
        if (isSaving || !selectedTemplateId) return;
        setIsSaving(true);

        try {
            const token = getToken() || localStorage.getItem('cognito_id_token');
            const headers = token ? { Authorization: `Bearer ${String(token).trim()}` } : {};
            await apiFetchWorkReport('/houkoku', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    template_id: selectedTemplateId,
                    work_date: header.work_date,
                    payload: templatePayload
                })
            });
            setStatusMessage({ type: 'success', text: '報告を送信しました' });
            // リセット
            setSelectedTemplateId(null);
            setTemplatePayload({});
            setTimeout(() => setStatusMessage(null), 3000);
        } catch (e) {
            console.error("Template submission failed:", e);
            setStatusMessage({ type: 'error', text: '送信失敗: ' + e.message });
            setTimeout(() => setStatusMessage(null), 5000);
        } finally {
            setIsSaving(false);
        }
    };

    // テンプレート内の画像アップロード
    const handleTemplateFileUpload = async (key, file) => {
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

            // ペイロードを更新
            const currentPayload = { ...(stores[activeStoreIdx].template_payload || {}) };

            // キーが 'nested.photos' のような形式なので分解してセット
            const parts = key.split('.');
            let target = currentPayload;
            for (let i = 0; i < parts.length - 1; i++) {
                if (!target[parts[i]]) target[parts[i]] = {};
                target = target[parts[i]];
            }
            const lastKey = parts[parts.length - 1];
            if (!Array.isArray(target[lastKey])) target[lastKey] = [];
            target[lastKey] = [...target[lastKey], newAttachment];

            updateStore(activeStoreIdx, { template_payload: currentPayload });

        } catch (e) {
            console.error("Template upload failed:", e);
            alert("アップロード失敗");
        } finally {
            setIsSaving(false);
        }
    };

    // テンプレート内の画像削除
    const handleTemplateFileRemove = (key, photoIdx) => {
        const currentPayload = { ...(stores[activeStoreIdx].template_payload || {}) };

        const parts = key.split('.');
        let target = currentPayload;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!target[parts[i]]) return;
            target = target[parts[i]];
        }
        const lastKey = parts[parts.length - 1];
        if (Array.isArray(target[lastKey])) {
            const next = [...target[lastKey]];
            next.splice(photoIdx, 1);
            target[lastKey] = next;
            updateStore(activeStoreIdx, { template_payload: currentPayload });
        }
    };

    // 営業用テンプレートハンドラー
    const handleSalesPayloadChange = (key, value) => {
        if (typeof key !== 'string') {
            console.error("handleSalesPayloadChange: key must be a string", key);
            return;
        }
        setSales(prev => {
            const next = JSON.parse(JSON.stringify(prev));
            const parts = key.split('.');
            let current = next;
            for (let i = 0; i < parts.length - 1; i++) {
                if (!current[parts[i]]) current[parts[i]] = {};
                current = current[parts[i]];
            }
            current[parts[parts.length - 1]] = value;
            return next;
        });
    };

    const handleSalesFileUpload = async (key, file) => {
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

            setSales(prev => {
                const next = JSON.parse(JSON.stringify(prev));
                const parts = key.split('.');
                let current = next;
                for (let i = 0; i < parts.length - 1; i++) {
                    if (!current[parts[i]]) current[parts[i]] = {};
                    current = current[parts[i]];
                }
                const lastKey = parts[parts.length - 1];
                if (!Array.isArray(current[lastKey])) current[lastKey] = [];
                current[lastKey].push(newAttachment);
                return next;
            });
        } catch (e) {
            console.error("Sales upload failed:", e);
            alert("アップロード失敗");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSalesFileRemove = (key, photoIdx) => {
        setSales(prev => {
            const next = JSON.parse(JSON.stringify(prev));
            const parts = key.split('.');
            let current = next;
            for (let i = 0; i < parts.length - 1; i++) {
                if (!current[parts[i]]) return prev;
                current = current[parts[i]];
            }
            const lastKey = parts[parts.length - 1];
            if (Array.isArray(current[lastKey])) {
                current[lastKey].splice(photoIdx, 1);
            }
            return next;
        });
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
                    <TabButton $active={activeTemplate === TEMPLATE_CLEANING} onClick={() => setActiveTemplate(TEMPLATE_CLEANING)}>
                        <i className="fas fa-broom"></i><span>清掃</span>
                    </TabButton>
                    <TabButton $active={activeTemplate === TEMPLATE_SALES} onClick={() => setActiveTemplate(TEMPLATE_SALES)}>
                        <i className="fas fa-briefcase"></i><span>営業</span>
                    </TabButton>
                    <TabButton $active={activeTemplate === TEMPLATE_ENGINEERING} onClick={() => setActiveTemplate(TEMPLATE_ENGINEERING)}>
                        <i className="fas fa-code"></i><span>開発</span>
                    </TabButton>
                    <TabButton $active={activeTemplate === TEMPLATE_OFFICE} onClick={() => setActiveTemplate(TEMPLATE_OFFICE)}>
                        <i className="fas fa-file-invoice"></i><span>事務</span>
                    </TabButton>
                </TabNav>

                {activeTemplate === TEMPLATE_CLEANING && (
                    <MobileStage>
                        {/* 1. 基本情報（日付・作業者） */}
                        <CompactCard>
                            <SectionHeader style={{ border: 'none', marginBottom: 12 }}>
                                <CardTitle style={{ fontSize: '0.9rem' }}>1. 報告基本情報</CardTitle>
                            </SectionHeader>
                            <FormGrid>
                                <Field>
                                    <Label htmlFor="work_date">作業日</Label>
                                    <Input
                                        id="work_date"
                                        name="work_date"
                                        type="date"
                                        value={header.work_date}
                                        onChange={e => setHeader(p => ({ ...p, work_date: e.target.value }))}
                                    />
                                </Field>
                                <Field>
                                    <Label htmlFor="reporter_name">作業者</Label>
                                    <Input
                                        id="reporter_name"
                                        name="reporter_name"
                                        type="text"
                                        value={header.reporter_name}
                                        onChange={e => setHeader(p => ({ ...p, reporter_name: e.target.value }))}
                                    />
                                </Field>
                            </FormGrid>
                        </CompactCard>

                        {/* 2. 店舗選択（タブ） */}
                        <div style={{ marginBottom: 24 }}>
                            <StoreTabs>
                                {stores.map((s, i) => (
                                    <StoreTab
                                        key={i}
                                        $active={activeStoreIdx === i}
                                        onClick={() => setActiveStoreIdx(i)}
                                    >
                                        <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>店舗 {i + 1}</div>
                                        <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                            {s.store_name || `未選択`}
                                        </div>
                                        {s.confirmed && <i className="fas fa-check-circle" style={{ position: 'absolute', top: 4, right: 4, fontSize: '0.8rem', color: '#10b981' }}></i>}
                                    </StoreTab>
                                ))}
                            </StoreTabs>

                            <CompactCard>
                                <div style={{ animation: 'fadeIn 0.3s ease' }}>
                                    <div style={{ marginBottom: 16 }}>
                                        <Label htmlFor={`store_search_${activeStoreIdx}`}>店舗名（検索して選択）</Label>
                                        <Input
                                            id={`store_search_${activeStoreIdx}`}
                                            name="store_name"
                                            placeholder="店舗検索..."
                                            value={currentStore.store_name}
                                            onChange={e => {
                                                const val = e.target.value;
                                                updateStore(activeStoreIdx, { store_name: val, enabled: true });
                                                const match = masterStores.find(m => m.name === val);
                                                if (match) updateStore(activeStoreIdx, { corporate_name: match.corporate_name, brand_name: match.brand_name, address: match.address });
                                            }}
                                        />
                                    </div>

                                    <Label htmlFor="template-select-0" style={{ marginBottom: 12 }}>実施サービスを選択</Label>
                                    <TemplateSelectGrid>
                                        {[
                                            { id: 'CLEAN_GREASE_TRAP_V1', label: 'グリスト', icon: 'fa-shower' },
                                            { id: 'CLEAN_RANGE_HOOD_V1', label: 'フード', icon: 'fa-wind' },
                                            { id: 'CLEAN_VENTILATION_FAN_V1', label: '換気扇', icon: 'fa-fan' },
                                            { id: 'CLEAN_DUCT_V1', label: 'ダクト', icon: 'fa-tools' },
                                            { id: 'CLEAN_RANGE_HOOD_SIROCCO_V1', label: 'シロッコ', icon: 'fa-hockey-puck' },
                                            { id: 'CLEAN_PIPE_PRESSURE_WASH_V1', label: '配管洗浄', icon: 'fa-faucet' },
                                            { id: 'CLEAN_GRATING_V1', label: 'U字溝', icon: 'fa-stream' },
                                            { id: 'CLEAN_KITCHEN_EQUIPMENT_V1', label: '厨房機器', icon: 'fa-blender' },
                                            { id: 'CLEAN_KITCHEN_WALL_V1', label: '壁清掃', icon: 'fa-border-all' },
                                            { id: 'CLEAN_SINK_V1', label: 'シンク', icon: 'fa-sink' },
                                            { id: 'MAINT_EXHAUST_FAN_BELT_V1', label: '排気ファン', icon: 'fa-gear' },
                                            { id: 'MAINT_FIRE_SHUTTER_V1', label: '防火扉', icon: 'fa-door-closed' },
                                            { id: 'PEST_INSECT_CONTROL_V1', label: '害虫駆除', icon: 'fa-bug' },
                                            { id: 'PEST_RODENT_CONTROL_V1', label: 'ネズミ駆除', icon: 'fa-paw' },
                                            { id: 'CLEAN_FLOOR_WAX_V1', label: '床ワックス', icon: 'fa-magic' },
                                        ].map((t, idx) => (
                                            <TemplateSelectButton
                                                key={t.id}
                                                id={idx === 0 ? 'template-select-0' : undefined}
                                                $selected={currentStore.template_id === t.id}
                                                onClick={() => updateStore(activeStoreIdx, { template_id: t.id, enabled: true })}
                                                style={{ padding: '12px 4px' }}
                                            >
                                                <i className={`fas ${t.icon}`} style={{ fontSize: 16 }}></i>
                                                <span style={{ fontSize: '0.6rem', marginTop: 4 }}>{t.label}</span>
                                            </TemplateSelectButton>
                                        ))}
                                    </TemplateSelectGrid>
                                </div>
                            </CompactCard>
                        </div>

                        {selectedTemplate ? (
                            <TemplateRenderer
                                template={selectedTemplate}
                                report={{
                                    work_date: header.work_date,
                                    user_name: header.reporter_name,
                                }}
                                payload={currentStore.template_payload}
                                onPayloadChange={(newPayload) => updateStore(activeStoreIdx, { template_payload: newPayload })}
                                onFileUpload={handleTemplateFileUpload}
                                onFileRemove={handleTemplateFileRemove}
                                mode="edit"
                                footer={
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px' }}>
                                            <input
                                                type="checkbox"
                                                id={`confirm-${activeStoreIdx}`}
                                                name={`confirm-${activeStoreIdx}`}
                                                style={{ width: 18, height: 18 }}
                                                checked={currentStore.confirmed}
                                                onChange={e => updateStore(activeStoreIdx, { confirmed: e.target.checked })}
                                            />
                                            <Label htmlFor={`confirm-${activeStoreIdx}`} style={{ margin: 0, cursor: 'pointer', color: currentStore.confirmed ? '#3b82f6' : '#94a3b8', fontSize: '0.75rem' }}>
                                                この店舗の入力内容を確認しました
                                            </Label>
                                        </div>
                                        <ButtonRow style={{ marginTop: 0 }}>
                                            <ActionButton $variant="secondary" style={{ flex: 1, height: 48 }} onClick={handleReset}>
                                                <i className="fas fa-undo"></i>
                                            </ActionButton>
                                            <ActionButton $variant="primary" style={{ flex: 3, height: 48, borderRadius: 14 }} onClick={() => handleHoukokuSubmit(TEMPLATE_CLEANING)} disabled={isSaving}>
                                                <i className="fas fa-paper-plane" style={{ marginRight: 8 }}></i>
                                                まとめて報告を送信
                                            </ActionButton>
                                        </ButtonRow>
                                    </div>
                                }
                            />
                        ) : (
                            <div style={{ marginTop: 20, textAlign: 'center', padding: 60, border: '2px dashed #334155', borderRadius: 24, color: '#475569' }}>
                                <i className="fas fa-hand-pointer" style={{ fontSize: 32, marginBottom: 16, opacity: 0.3 }}></i>
                                <div style={{ fontSize: '0.9rem' }}>店舗とサービスを選択してください</div>
                            </div>
                        )}
                    </MobileStage>
                )}

                {
                    activeTemplate === TEMPLATE_SALES && (
                        <Card>
                            <SectionHeader><CardTitle>営業活動報告</CardTitle></SectionHeader>
                            <TemplateRenderer
                                template={getTemplateById(TEMPLATE_SALES)}
                                payload={sales}
                                mode="edit"
                                onChange={handleSalesPayloadChange}
                                onFileUpload={handleSalesFileUpload}
                                onFileRemove={handleSalesFileRemove}
                            />
                            <ButtonRow>
                                <ActionButton $variant="primary" style={{ flex: 1 }} onClick={() => handleHoukokuSubmit(TEMPLATE_SALES)} disabled={isSaving}>提出</ActionButton>
                                <ActionButton $variant="secondary" onClick={handleReset}>リセット</ActionButton>
                            </ButtonRow>
                        </Card>
                    )
                }

                {
                    activeTemplate === TEMPLATE_ENGINEERING && (
                        <Card>
                            <SectionHeader><CardTitle>開発報告</CardTitle></SectionHeader>
                            <FormGrid>
                                <Field $full>
                                    <Label htmlFor="eng_project">プロジェクト</Label>
                                    <Input
                                        id="eng_project"
                                        name="project"
                                        value={eng.project}
                                        onChange={e => setEng(p => ({ ...p, project: e.target.value }))}
                                    />
                                </Field>
                                <Field $full>
                                    <Label htmlFor="eng_tasks_done">完了事項</Label>
                                    <FormTextarea
                                        id="eng_tasks_done"
                                        name="tasks_done"
                                        value={eng.tasks_done}
                                        onChange={e => setEng(p => ({ ...p, tasks_done: e.target.value }))}
                                    />
                                </Field>
                            </FormGrid>
                            <div style={{ marginTop: 24 }}>
                                <Label htmlFor="eng-up">添付</Label>
                                <UploadZone onClick={() => document.getElementById('eng-up').click()}>選択</UploadZone>
                                <input id="eng-up" name="eng_attachments" aria-label="開発報告の添付ファイル" type="file" multiple hidden onChange={e => Array.from(e.target.files).forEach(f => handleHoukokuUpload('ENGINEERING', f))} />
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
                    )
                }

                {
                    activeTemplate === TEMPLATE_OFFICE && (
                        <Card>
                            <SectionHeader><CardTitle>事務報告</CardTitle></SectionHeader>
                            <FormGrid>
                                <Field $full>
                                    <Label htmlFor="office_done">完了事項</Label>
                                    <FormTextarea
                                        id="office_done"
                                        name="done"
                                        value={office.done}
                                        onChange={e => setOffice(p => ({ ...p, done: e.target.value }))}
                                    />
                                </Field>
                            </FormGrid>
                            <div style={{ marginTop: 24 }}>
                                <Label htmlFor="off-up">添付</Label>
                                <UploadZone onClick={() => document.getElementById('off-up').click()}>選択</UploadZone>
                                <input id="off-up" name="office_attachments" aria-label="事務報告の添付ファイル" type="file" multiple hidden onChange={e => Array.from(e.target.files).forEach(f => handleHoukokuUpload('OFFICE', f))} />
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
                    )
                }

                <div style={{ marginTop: 32, textAlign: 'center' }}>
                    <Link to="/portal" style={{ color: '#64748b', textDecoration: 'none' }}>ポータルに戻る</Link>
                </div>
            </MainContent >
        </PageContainer >
    );
}

const PageContainer = styled.div` min-height: 100vh; background: #0f172a; color: #f8fafc; `;
const VizContainer = styled.div` position: fixed; inset: 0; pointer-events: none; z-index: 0; opacity: 0.15; `;
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

// 店舗切り替えタブ
const StoreTabs = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 24px;
    padding: 6px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 16px;
`;

const MobileStage = styled.div`
    max-width: 800px;
    margin: 0 auto;
    width: 100%;
`;

const CompactCard = styled.div`
    background: rgba(30, 41, 59, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 20px;
    padding: 24px;
    margin-bottom: 24px;
`;

const StoreTab = styled.button`
    flex: 1;
    min-width: 100px;
    height: 54px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border: 1px solid ${props => props.$active ? '#3b82f6' : 'rgba(255,255,255,0.05)'};
    background: ${props => props.$active ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255, 255, 255, 0.02)'};
    color: ${props => props.$active ? '#3b82f6' : '#94a3b8'};
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
    padding: 0 12px;
    &:hover { background: rgba(59, 130, 246, 0.05); }
`;

const TemplateSelectGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 10px;
`;

const TemplateSelectButton = styled.button`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 12px 4px;
    border-radius: 12px;
    border: 1px solid ${props => props.$selected ? '#3b82f6' : 'rgba(255, 255, 255, 0.08)'};
    background: ${props => props.$selected ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.03)'};
    color: ${props => props.$selected ? '#3b82f6' : '#94a3b8'};
    cursor: pointer;
    transition: all 0.2s;
    &:hover { border-color: #3b82f6; color: #3b82f6; }
`;
