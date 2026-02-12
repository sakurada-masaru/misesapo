import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import Visualizer from '../Visualizer/Visualizer';
import {
  putWorkReport,
  patchWorkReport,
  getWorkReportsForStore,
  getUploadUrl,
} from './salesKarteApi';
import OfficeClientKartePanel from '../../../jobs/office/clients/OfficeClientKartePanel';
import { normalizeGatewayBase, YOTEI_GATEWAY } from '../../api/gatewayBase';
import './sales-store-karte.css';
import '../../../jobs/office/clients/office-client-karte-panel.css';

const TEMPLATE_ENTITY = 'SALES_ENTITY_V1';
const TEMPLATE_ACTIVITY = 'SALES_ACTIVITY_V1';
const TEMPLATE_TODO = 'SALES_TODO_V1';
const MAX_ATTACHMENTS = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'pdf', 'xlsx', 'docx', 'heic'];

const PIPELINE_OPTIONS = [
  { value: 'new', label: '新規' },
  { value: 'contacted', label: '接触済' },
  { value: 'qualified', label: '要件確認済' },
  { value: 'proposal', label: '提案中' },
  { value: 'estimate', label: '見積中' },
  { value: 'won', label: '受注' },
  { value: 'lost', label: '失注' },
];

const ACTIVITY_TYPES = [
  { value: 'visit', label: '訪問' },
  { value: 'call', label: '電話' },
  { value: 'email', label: 'メール' },
  { value: 'other', label: 'その他' },
];

function emptyEntity(storeKey = '') {
  return {
    store: {
      key: storeKey,
      company_name: '',
      brand_name: '',
      store_name: '',
      address: '',
      tel: '',
      contact_person: '',
      email: '',
    },
    pipeline: 'new',
    note: '',
    attachments: [],
    saved: { log_id: null, version: null, state: null },
  };
}

function emptyActivity(storeKey = '', storeName = '') {
  return {
    store_key: storeKey,
    store_name: storeName,
    type: 'visit',
    datetime: new Date().toISOString().slice(0, 16),
    summary: '',
    detail: '',
    pipeline_after: '',
    attachments: [],
    saved: { log_id: null, version: null, state: null },
  };
}

function emptyTodo(storeKey = '', storeName = '') {
  return {
    store_key: storeKey,
    store_name: storeName,
    due_date: '',
    title: '',
    note: '',
    status: 'open',
    attachments: [],
    saved: { log_id: null, version: null, state: null },
  };
}

function serializeEntity(entity) {
  return {
    store: { ...entity.store },
    pipeline: entity.pipeline || 'new',
    note: entity.note || '',
    attachments: entity.attachments || [],
  };
}

function deserializeEntity(descriptionJson, workReportItem) {
  let store = { key: '', company_name: '', brand_name: '', store_name: '', address: '', tel: '', contact_person: '', email: '' };
  let pipeline = 'new';
  let note = '';
  let attachments = [];
  try {
    const d = JSON.parse(descriptionJson || '{}');
    store = { ...store, ...(d.store || {}) };
    pipeline = d.pipeline || 'new';
    note = d.note || '';
    attachments = Array.isArray(d.attachments) ? d.attachments : [];
  } catch (_) { }
  return {
    store,
    pipeline,
    note,
    attachments,
    saved: {
      log_id: workReportItem?.log_id ?? null,
      version: workReportItem?.version ?? null,
      state: workReportItem?.state ?? null,
    },
  };
}

function serializeActivity(act) {
  return {
    store_key: act.store_key || '',
    store_name: act.store_name || '',
    type: act.type || 'visit',
    datetime: act.datetime || '',
    summary: act.summary || '',
    detail: act.detail || '',
    pipeline_after: act.pipeline_after || '',
    attachments: act.attachments || [],
  };
}

function deserializeActivity(descriptionJson, workReportItem) {
  let o = {};
  try {
    o = JSON.parse(descriptionJson || '{}');
  } catch (_) { }
  return {
    store_key: o.store_key || '',
    store_name: o.store_name || '',
    type: o.type || 'visit',
    datetime: o.datetime || '',
    summary: o.summary || '',
    detail: o.detail || '',
    pipeline_after: o.pipeline_after || '',
    attachments: Array.isArray(o.attachments) ? o.attachments : [],
    saved: {
      log_id: workReportItem?.log_id ?? null,
      version: workReportItem?.version ?? null,
      state: workReportItem?.state ?? null,
    },
  };
}

function serializeTodo(todo) {
  return {
    store_key: todo.store_key || '',
    store_name: todo.store_name || '',
    due_date: todo.due_date || '',
    title: todo.title || '',
    note: todo.note || '',
    status: todo.status || 'open',
    attachments: todo.attachments || [],
  };
}

function deserializeTodo(descriptionJson, workReportItem) {
  let o = {};
  try {
    o = JSON.parse(descriptionJson || '{}');
  } catch (_) { }
  return {
    store_key: o.store_key || '',
    store_name: o.store_name || '',
    due_date: o.due_date || '',
    title: o.title || '',
    note: o.note || '',
    status: o.status || 'open',
    attachments: Array.isArray(o.attachments) ? o.attachments : [],
    saved: {
      log_id: workReportItem?.log_id ?? null,
      version: workReportItem?.version ?? null,
      state: workReportItem?.state ?? null,
    },
  };
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SalesStoreKartePage() {
  const { storeKey } = useParams();
  const decodedKey = storeKey ? decodeURIComponent(storeKey) : '';
  const [entity, setEntity] = useState(() => emptyEntity(decodedKey));
  const [activities, setActivities] = useState([]);
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [entitySaving, setEntitySaving] = useState(false);
  const [entityError, setEntityError] = useState('');
  const [activitySaving, setActivitySaving] = useState({});
  const [activityErrors, setActivityErrors] = useState({});
  const [todoSaving, setTodoSaving] = useState({});
  const [todoErrors, setTodoErrors] = useState({});
  const [uploading, setUploading] = useState({ section: null, id: null });
  const [attachmentErrors, setAttachmentErrors] = useState({});
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [showTodoForm, setShowTodoForm] = useState(false);
  const [activeTab, setActiveTab] = useState('entity'); // 'entity' | 'activities' | 'todos'
  const [newActivity, setNewActivity] = useState(() => emptyActivity(decodedKey, entity.store?.store_name || ''));
  const [newTodo, setNewTodo] = useState(() => emptyTodo(decodedKey, entity.store?.store_name || ''));
  const [storeMetadata, setStoreMetadata] = useState(null);
  const fileInputRefs = useRef({});

  const today = new Date().toISOString().slice(0, 10);

  const updateEntity = useCallback((next) => {
    setEntity((e) => (typeof next === 'function' ? next(e) : { ...e, ...next }));
  }, []);

  const updateActivity = useCallback((index, next) => {
    setActivities((prev) => {
      const arr = [...prev];
      arr[index] = typeof next === 'function' ? next(arr[index]) : { ...arr[index], ...next };
      return arr;
    });
  }, []);

  const updateTodo = useCallback((index, next) => {
    setTodos((prev) => {
      const arr = [...prev];
      arr[index] = typeof next === 'function' ? next(arr[index]) : { ...arr[index], ...next };
      return arr;
    });
  }, []);

  const validateEntity = useCallback(() => {
    if (!entity.store?.store_name?.trim()) return '店舗名は必須です';
    return '';
  }, [entity.store?.store_name]);

  const validateActivity = useCallback((act) => {
    if (!act.summary?.trim()) return '活動ログ：要約は必須です';
    return '';
  }, []);

  const validateTodoItem = useCallback((todo) => {
    if (!todo.due_date?.trim()) return 'ToDo：期限は必須です';
    if (!todo.title?.trim()) return 'ToDo：タイトルは必須です';
    return '';
  }, []);

  const validateAttachmentFile = useCallback((file, currentCount) => {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) return `「${file.name}」は許可されていない形式です（許可: ${ALLOWED_EXT.join(', ')}）`;
    if (file.size > MAX_FILE_SIZE) return `「${file.name}」は 10MB を超えています`;
    if (currentCount >= MAX_ATTACHMENTS) return `最大 ${MAX_ATTACHMENTS} 件までです`;
    return '';
  }, []);

  const uploadAttachment = useCallback(
    async (file, context, attachTo) => {
      setAttachmentErrors((prev) => ({ ...prev, [attachTo.key]: null }));
      setUploading({ section: attachTo.section, id: attachTo.id });
      try {
        const { uploadUrl, fileUrl, key } = await getUploadUrl({
          filename: file.name,
          mime: file.type || 'application/octet-stream',
          size: file.size,
          context,
          date: today,
          storeKey: decodedKey,
        });
        const res = await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
        });
        if (!res.ok) throw new Error('アップロードに失敗しました');
        const item = { name: file.name, mime: file.type || 'application/octet-stream', size: file.size, url: fileUrl, key, uploaded_at: new Date().toISOString() };
        if (attachTo.section === 'entity') {
          updateEntity((e) => ({ ...e, attachments: [...(e.attachments || []), item] }));
        } else if (attachTo.section === 'activity') {
          updateActivity(attachTo.id, (a) => ({ ...a, attachments: [...(a.attachments || []), item] }));
        } else if (attachTo.section === 'todo') {
          updateTodo(attachTo.id, (t) => ({ ...t, attachments: [...(t.attachments || []), item] }));
        }
      } catch (e) {
        setAttachmentErrors((prev) => ({ ...prev, [attachTo.key]: e.message || 'アップロードに失敗しました' }));
      } finally {
        setUploading({ section: null, id: null });
      }
    },
    [decodedKey, today, updateEntity, updateActivity, updateTodo]
  );

  const handleAttachmentSelect = useCallback(
    async (section, id, fileList, currentCount) => {
      const files = Array.from(fileList || []);
      let err = '';
      for (let i = 0; i < files.length; i++) {
        err = validateAttachmentFile(files[i], currentCount + i);
        if (err) break;
      }
      if (!err && currentCount + files.length > MAX_ATTACHMENTS) err = `最大 ${MAX_ATTACHMENTS} 件までです`;
      const key = section === 'entity' ? 'entity' : `${section}-${id}`;
      if (err) {
        setAttachmentErrors((prev) => ({ ...prev, [key]: err }));
        return;
      }
      setAttachmentErrors((prev) => ({ ...prev, [key]: null }));
      const context = section === 'entity' ? 'sales-entity-attachment' : section === 'activity' ? 'sales-activity-attachment' : 'sales-todo-attachment';
      for (const file of files) {
        await uploadAttachment(file, context, { section, id, key });
      }
      const refKey = section === 'entity' ? 'entity' : `${section}-${id}`;
      const input = fileInputRefs.current[refKey];
      if (input) input.value = '';
    },
    [validateAttachmentFile, uploadAttachment]
  );

  const removeAttachment = useCallback(
    (section, id, attachIndex) => {
      const key = section === 'entity' ? 'entity' : `${section}-${id}`;
      setAttachmentErrors((prev) => ({ ...prev, [key]: null }));
      if (section === 'entity') {
        updateEntity((e) => ({ ...e, attachments: (e.attachments || []).filter((_, i) => i !== attachIndex) }));
      } else if (section === 'activity') {
        updateActivity(id, (a) => ({ ...a, attachments: (a.attachments || []).filter((_, i) => i !== attachIndex) }));
      } else if (section === 'todo') {
        updateTodo(id, (t) => ({ ...t, attachments: (t.attachments || []).filter((_, i) => i !== attachIndex) }));
      }
    },
    [updateEntity, updateActivity, updateTodo]
  );

  const handleEntitySave = useCallback(async () => {
    const err = validateEntity();
    setEntityError(err);
    if (err) return;
    setEntitySaving(true);
    try {
      const body = {
        date: today,
        work_date: today,
        work_minutes: 0,
        template_id: TEMPLATE_ENTITY,
        state: 'draft',
        target_label: entity.store?.store_name || decodedKey,
        description: JSON.stringify(serializeEntity(entity)),
      };
      if (entity.saved?.log_id) {
        body.log_id = entity.saved.log_id;
        body.version = entity.saved.version;
      }
      const res = await putWorkReport(body);
      setEntity((e) => ({ ...e, saved: { log_id: res.log_id, version: res.version, state: res.state } }));
      setEntityError('');
    } catch (e) {
      setEntityError(e.message || '保存に失敗しました');
    } finally {
      setEntitySaving(false);
    }
  }, [entity, decodedKey, today, validateEntity]);

  const handleActivitySave = useCallback(
    async (index) => {
      const act = index === -1 ? newActivity : activities[index];
      const err = validateActivity(act);
      if (index === -1) setActivityErrors((prev) => ({ ...prev, new: err }));
      else setActivityErrors((prev) => ({ ...prev, [index]: err }));
      if (err) return;
      setActivitySaving((prev) => ({ ...prev, [index]: true }));
      try {
        const body = {
          date: today,
          work_date: today,
          work_minutes: 0,
          template_id: TEMPLATE_ACTIVITY,
          state: 'draft',
          target_label: act.store_name || entity.store?.store_name || decodedKey,
          description: JSON.stringify(serializeActivity(act)),
        };
        if (index >= 0 && act.saved?.log_id) {
          body.log_id = act.saved.log_id;
          body.version = act.saved.version;
        }
        const res = await putWorkReport(body);
        if (index === -1) {
          setActivities((prev) => [{ ...newActivity, saved: { log_id: res.log_id, version: res.version, state: res.state } }, ...prev]);
          setNewActivity(emptyActivity(decodedKey, entity.store?.store_name || ''));
          setShowActivityForm(false);
        } else {
          updateActivity(index, (a) => ({ ...a, saved: { log_id: res.log_id, version: res.version, state: res.state } }));
        }
        setActivityErrors((prev) => ({ ...prev, [index]: null, new: null }));
        if (act.pipeline_after) {
          updateEntity((e) => ({ ...e, pipeline: act.pipeline_after }));
        }
      } catch (e) {
        setActivityErrors((prev) => ({ ...prev, [index]: e.message || '保存に失敗しました' }));
      } finally {
        setActivitySaving((prev) => ({ ...prev, [index]: false }));
      }
    },
    [activities, newActivity, entity.store?.store_name, decodedKey, today, validateActivity, updateActivity, updateEntity]
  );

  const handleTodoSave = useCallback(
    async (index) => {
      const todo = index === -1 ? newTodo : todos[index];
      const err = validateTodoItem(todo);
      if (index === -1) setTodoErrors((prev) => ({ ...prev, new: err }));
      else setTodoErrors((prev) => ({ ...prev, [index]: err }));
      if (err) return;
      setTodoSaving((prev) => ({ ...prev, [index]: true }));
      try {
        const body = {
          date: todo.due_date || today,
          work_date: todo.due_date || today,
          work_minutes: 0,
          template_id: TEMPLATE_TODO,
          state: 'draft',
          target_label: todo.store_name || entity.store?.store_name || decodedKey,
          description: JSON.stringify(serializeTodo(todo)),
        };
        if (index >= 0 && todo.saved?.log_id) {
          body.log_id = todo.saved.log_id;
          body.version = todo.saved.version;
        }
        const res = await putWorkReport(body);
        if (index === -1) {
          setTodos((prev) => [...prev, { ...newTodo, saved: { log_id: res.log_id, version: res.version, state: res.state } }]);
          setNewTodo(emptyTodo(decodedKey, entity.store?.store_name || ''));
          setShowTodoForm(false);
        } else {
          updateTodo(index, (t) => ({ ...t, saved: { log_id: res.log_id, version: res.version, state: res.state } }));
        }
        setTodoErrors((prev) => ({ ...prev, [index]: null, new: null }));
      } catch (e) {
        setTodoErrors((prev) => ({ ...prev, [index]: e.message || '保存に失敗しました' }));
      } finally {
        setTodoSaving((prev) => ({ ...prev, [index]: false }));
      }
    },
    [todos, newTodo, entity.store?.store_name, decodedKey, today, validateTodoItem, updateTodo]
  );

  const handleTodoToggleDone = useCallback(
    async (index) => {
      const todo = todos[index];
      const nextStatus = todo.status === 'open' ? 'done' : 'open';
      const updated = { ...todo, status: nextStatus };
      setTodoSaving((prev) => ({ ...prev, [index]: true }));
      try {
        const body = {
          date: updated.due_date || today,
          work_date: updated.due_date || today,
          work_minutes: 0,
          template_id: TEMPLATE_TODO,
          state: 'draft',
          target_label: updated.store_name || entity.store?.store_name || decodedKey,
          description: JSON.stringify(serializeTodo(updated)),
        };
        if (todo.saved?.log_id) {
          body.log_id = todo.saved.log_id;
          body.version = todo.saved.version;
        }
        const res = await putWorkReport(body);
        updateTodo(index, (t) => ({ ...t, status: nextStatus, saved: { log_id: res.log_id, version: res.version, state: res.state } }));
        setTodoErrors((prev) => ({ ...prev, [index]: null }));
      } catch (e) {
        setTodoErrors((prev) => ({ ...prev, [index]: e.message || '更新に失敗しました' }));
      } finally {
        setTodoSaving((prev) => ({ ...prev, [index]: false }));
      }
    },
    [todos, entity.store?.store_name, decodedKey, today, updateTodo]
  );

  const headers = useCallback(
    () => ({
      Authorization: `Bearer ${localStorage.getItem('cognito_id_token') || (JSON.parse(localStorage.getItem('misesapo_auth') || '{}').token)}`,
      'Content-Type': 'application/json',
    }),
    []
  );

  useEffect(() => {
    if (!decodedKey) {
      setLoading(false);
      setError('店舗キーがありません');
      return;
    }
    setEntity((e) => ({ ...e, store: { ...e.store, key: decodedKey } }));

    const API_BASE =
      typeof window !== 'undefined' && window.location?.hostname === 'localhost'
        ? '/api'
        : normalizeGatewayBase(import.meta.env?.VITE_API_BASE, YOTEI_GATEWAY);

    Promise.all([
      getWorkReportsForStore(decodedKey, 30),
      fetch(`${API_BASE}/stores/${decodedKey}`, { headers: headers() }).then(res => res.ok ? res.json() : null)
    ])
      .then(([items, storeData]) => {
        const entityItem = items.find((i) => {
          if (i.template_id !== TEMPLATE_ENTITY) return false;
          try {
            const d = JSON.parse(i.description || '{}');
            return d.store?.key === decodedKey;
          } catch (_) { return false; }
        }) || null;

        const activityItems = items.filter((i) => i.template_id === TEMPLATE_ACTIVITY);
        const todoItems = items.filter((i) => i.template_id === TEMPLATE_TODO);

        if (entityItem) {
          setEntity(deserializeEntity(entityItem.description, entityItem));
        } else if (storeData) {
          // ワークレポートがない場合、マスタ情報で初期化
          setEntity({
            ...emptyEntity(decodedKey),
            store: {
              key: decodedKey,
              company_name: storeData.company_name || '',
              brand_name: storeData.brand_name || '',
              store_name: storeData.name || '',
              address: [storeData.address1, storeData.address2].filter(Boolean).join(' '),
              tel: storeData.phone || '',
              contact_person: storeData.contact_person || '',
              email: storeData.email || '',
            }
          });
        }

        setActivities(activityItems.map((it) => deserializeActivity(it.description, it)).sort((a, b) => (b.datetime || '').localeCompare(a.datetime || '')));
        setTodos(todoItems.map((it) => deserializeTodo(it.description, it)));
        setStoreMetadata(storeData);
        setError('');
      })
      .catch((e) => setError(e.message || 'データの取得に失敗しました'))
      .finally(() => setLoading(false));
  }, [decodedKey, headers]);

  useEffect(() => {
    setNewActivity((a) => ({ ...a, store_key: decodedKey, store_name: entity.store?.store_name || '' }));
    setNewTodo((t) => ({ ...t, store_key: decodedKey, store_name: entity.store?.store_name || '' }));
  }, [decodedKey, entity.store?.store_name]);

  if (loading) {
    return (
      <div className="sales-karte-page">
        <p className="sales-karte-loading">読み込み中...</p>
      </div>
    );
  }
  if (error && !entity.saved?.log_id) {
    return (
      <div className="sales-karte-page">
        <p className="sales-karte-error">{error}</p>
        <p><Link to="/">Portal に戻る</Link></p>
      </div>
    );
  }

  const isUploading = (section, id) => uploading.section === section && uploading.id === id;

  return (
    <div className="report-page sales-karte-page" data-job="sales">
      <div className="report-page-viz">
        <Visualizer mode="base" className="report-page-visualizer" />
      </div>
      <div className="report-page-content sales-karte-content">
        <h1 className="sales-karte-title">店舗カルテ：{entity.store?.store_name || decodedKey || '（未設定）'}</h1>
        <p className="report-page-back"><Link to="/">Portal に戻る</Link> / <Link to="/jobs/sales/entrance">顧客へ戻る</Link> / <Link to="/sales/kartes">営業カルテ一覧</Link></p>

        <div className="sales-karte-tabs" role="tablist" aria-label="カルテタブ">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'entity'}
            aria-controls="sales-karte-panel-entity"
            id="sales-karte-tab-entity"
            className={`sales-karte-tab ${activeTab === 'entity' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('entity')}
          >
            基本情報
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'activities'}
            aria-controls="sales-karte-panel-activities"
            id="sales-karte-tab-activities"
            className={`sales-karte-tab ${activeTab === 'activities' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('activities')}
          >
            活動ログ
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'todos'}
            aria-controls="sales-karte-panel-todos"
            id="sales-karte-tab-todos"
            className={`sales-karte-tab ${activeTab === 'todos' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('todos')}
          >
            次アクション
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'cleaning'}
            aria-controls="sales-karte-panel-cleaning"
            id="sales-karte-tab-cleaning"
            className={`sales-karte-tab ${activeTab === 'cleaning' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('cleaning')}
          >
            清掃情報
          </button>
        </div>

        {/* 基本情報カード */}
        <section
          id="sales-karte-panel-entity"
          role="tabpanel"
          aria-labelledby="sales-karte-tab-entity"
          className="sales-karte-card sales-karte-entity"
          hidden={activeTab !== 'entity'}
        >
          <h2>基本情報</h2>
          <div className="sales-karte-fields">
            <div className="sales-karte-field">
              <label>店舗名（必須）</label>
              <input
                type="text"
                value={entity.store?.store_name || ''}
                onChange={(e) => updateEntity((e2) => ({ ...e2, store: { ...e2.store, store_name: e.target.value } }))}
              />
            </div>
            <div className="sales-karte-field">
              <label>会社名</label>
              <input
                type="text"
                value={entity.store?.company_name || ''}
                onChange={(e) => updateEntity((e2) => ({ ...e2, store: { ...e2.store, company_name: e.target.value } }))}
              />
            </div>
            <div className="sales-karte-field">
              <label>ブランド名</label>
              <input
                type="text"
                value={entity.store?.brand_name || ''}
                onChange={(e) => updateEntity((e2) => ({ ...e2, store: { ...e2.store, brand_name: e.target.value } }))}
              />
            </div>
            <div className="sales-karte-field">
              <label>住所</label>
              <input
                type="text"
                value={entity.store?.address || ''}
                onChange={(e) => updateEntity((e2) => ({ ...e2, store: { ...e2.store, address: e.target.value } }))}
              />
            </div>
            <div className="sales-karte-field">
              <label>TEL</label>
              <input
                type="text"
                value={entity.store?.tel || ''}
                onChange={(e) => updateEntity((e2) => ({ ...e2, store: { ...e2.store, tel: e.target.value } }))}
              />
            </div>
            <div className="sales-karte-field">
              <label>担当者</label>
              <input
                type="text"
                value={entity.store?.contact_person || ''}
                onChange={(e) => updateEntity((e2) => ({ ...e2, store: { ...e2.store, contact_person: e.target.value } }))}
              />
            </div>
            <div className="sales-karte-field">
              <label>Email</label>
              <input
                type="email"
                value={entity.store?.email || ''}
                onChange={(e) => updateEntity((e2) => ({ ...e2, store: { ...e2.store, email: e.target.value } }))}
              />
            </div>
            <div className="sales-karte-field">
              <label>営業ステータス（パイプライン）</label>
              <select
                value={entity.pipeline || 'new'}
                onChange={(e) => updateEntity({ pipeline: e.target.value })}
              >
                {PIPELINE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="sales-karte-field">
              <label>店舗メモ</label>
              <textarea
                value={entity.note || ''}
                onChange={(e) => updateEntity({ note: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <div className="sales-karte-attachments">
            <h3>補助資料添付</h3>
            <input
              ref={(el) => { fileInputRefs.current.entity = el; }}
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.pdf,.xlsx,.docx,.heic"
              className="sales-karte-file-input"
              onChange={(e) => handleAttachmentSelect('entity', 0, e.target.files, entity.attachments?.length || 0)}
            />
            <button
              type="button"
              className="btn btn-sm"
              disabled={isUploading('entity', 0) || (entity.attachments?.length || 0) >= MAX_ATTACHMENTS}
              onClick={() => fileInputRefs.current.entity?.click()}
            >
              {isUploading('entity', 0) ? 'アップロード中...' : 'ファイルを追加'}
            </button>
            <p className="sales-karte-attachments-hint">最大 {MAX_ATTACHMENTS} 件・1ファイル 10MB まで</p>
            {(entity.attachments?.length || 0) > 0 && (
              <ul className="sales-karte-attachment-list">
                {(entity.attachments || []).map((att, ai) => (
                  <li key={ai} className="sales-karte-attachment-row">
                    <span className="sales-karte-attachment-name" title={att.name}>{att.name}</span>
                    <span className="sales-karte-attachment-size">{formatFileSize(att.size)}</span>
                    {att.url && <a href={att.url} target="_blank" rel="noopener noreferrer" className="sales-karte-attachment-open">開く</a>}
                    <button type="button" className="sales-karte-attachment-remove" onClick={() => removeAttachment('entity', 0, ai)} title="削除">×</button>
                  </li>
                ))}
              </ul>
            )}
            {attachmentErrors.entity && <p className="sales-karte-error">{attachmentErrors.entity}</p>}
          </div>
          <div className="sales-karte-actions">
            <button type="button" className="btn" onClick={handleEntitySave} disabled={entitySaving}>
              {entitySaving ? '保存中...' : '基本情報を保存'}
            </button>
          </div>
          {entityError && <p className="sales-karte-error">{entityError}</p>}
        </section>

        {/* 活動ログ */}
        <section
          id="sales-karte-panel-activities"
          role="tabpanel"
          aria-labelledby="sales-karte-tab-activities"
          className="sales-karte-card sales-karte-activities"
          hidden={activeTab !== 'activities'}
        >
          <h2>活動ログ</h2>
          {!showActivityForm ? (
            <button type="button" className="btn btn-sm" onClick={() => setShowActivityForm(true)}>+ 活動追加</button>
          ) : (
            <div className="sales-karte-activity-form">
              <div className="sales-karte-fields">
                <div className="sales-karte-field">
                  <label>種別</label>
                  <select value={newActivity.type} onChange={(e) => setNewActivity((a) => ({ ...a, type: e.target.value }))}>
                    {ACTIVITY_TYPES.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div className="sales-karte-field">
                  <label>日時</label>
                  <input
                    type="datetime-local"
                    value={newActivity.datetime}
                    onChange={(e) => setNewActivity((a) => ({ ...a, datetime: e.target.value }))}
                  />
                </div>
                <div className="sales-karte-field">
                  <label>要約（必須）</label>
                  <input
                    type="text"
                    value={newActivity.summary}
                    onChange={(e) => setNewActivity((a) => ({ ...a, summary: e.target.value }))}
                  />
                </div>
                <div className="sales-karte-field">
                  <label>詳細</label>
                  <textarea value={newActivity.detail} onChange={(e) => setNewActivity((a) => ({ ...a, detail: e.target.value }))} rows={2} />
                </div>
                <div className="sales-karte-field">
                  <label>記録後パイプライン</label>
                  <select value={newActivity.pipeline_after} onChange={(e) => setNewActivity((a) => ({ ...a, pipeline_after: e.target.value }))}>
                    <option value="">変更しない</option>
                    {PIPELINE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="sales-karte-actions">
                <button type="button" className="btn" onClick={() => handleActivitySave(-1)} disabled={activitySaving.new}>保存</button>
                <button type="button" className="btn btn-sm" onClick={() => { setShowActivityForm(false); setActivityErrors((p) => ({ ...p, new: null })); }}>キャンセル</button>
              </div>
              {activityErrors.new && <p className="sales-karte-error">{activityErrors.new}</p>}
            </div>
          )}
          <ul className="sales-karte-activity-list">
            {activities.map((act, i) => (
              <li key={i} className="sales-karte-activity-item">
                <span className="sales-karte-activity-type">{ACTIVITY_TYPES.find((t) => t.value === act.type)?.label || act.type}</span>
                <span className="sales-karte-activity-datetime">{act.datetime}</span>
                <span className="sales-karte-activity-summary">{act.summary}</span>
                {act.detail && <p className="sales-karte-activity-detail">{act.detail}</p>}
                {act.attachments?.length > 0 && (
                  <ul className="sales-karte-attachment-list small">
                    {act.attachments.map((att, ai) => (
                      <li key={ai}>
                        {att.url ? <a href={att.url} target="_blank" rel="noopener noreferrer">{att.name}</a> : att.name}
                      </li>
                    ))}
                  </ul>
                )}
                <button type="button" className="btn btn-sm" onClick={() => handleActivitySave(i)} disabled={activitySaving[i]}>再保存</button>
                {activityErrors[i] && <p className="sales-karte-error">{activityErrors[i]}</p>}
              </li>
            ))}
          </ul>
        </section>

        {/* ToDo */}
        <section
          id="sales-karte-panel-todos"
          role="tabpanel"
          aria-labelledby="sales-karte-tab-todos"
          className="sales-karte-card sales-karte-todos"
          hidden={activeTab !== 'todos'}
        >
          <h2>次アクション（ToDo）</h2>
          {!showTodoForm ? (
            <button type="button" className="btn btn-sm" onClick={() => setShowTodoForm(true)}>+ ToDo追加</button>
          ) : (
            <div className="sales-karte-todo-form">
              <div className="sales-karte-fields">
                <div className="sales-karte-field">
                  <label>期限（必須）</label>
                  <input
                    type="date"
                    value={newTodo.due_date}
                    onChange={(e) => setNewTodo((t) => ({ ...t, due_date: e.target.value }))}
                  />
                </div>
                <div className="sales-karte-field">
                  <label>タイトル（必須）</label>
                  <input
                    type="text"
                    value={newTodo.title}
                    onChange={(e) => setNewTodo((t) => ({ ...t, title: e.target.value }))}
                  />
                </div>
                <div className="sales-karte-field">
                  <label>メモ</label>
                  <input type="text" value={newTodo.note} onChange={(e) => setNewTodo((t) => ({ ...t, note: e.target.value }))} />
                </div>
              </div>
              <div className="sales-karte-actions">
                <button type="button" className="btn" onClick={() => handleTodoSave(-1)} disabled={todoSaving.new}>保存</button>
                <button type="button" className="btn btn-sm" onClick={() => { setShowTodoForm(false); setTodoErrors((p) => ({ ...p, new: null })); }}>キャンセル</button>
              </div>
              {todoErrors.new && <p className="sales-karte-error">{todoErrors.new}</p>}
            </div>
          )}
          <ul className="sales-karte-todo-list">
            {todos.map((todo, i) => (
              <li key={i} className={`sales-karte-todo-item ${todo.status === 'done' ? 'done' : ''}`}>
                <input
                  type="checkbox"
                  checked={todo.status === 'done'}
                  onChange={() => handleTodoToggleDone(i)}
                  disabled={todoSaving[i]}
                />
                <span className="sales-karte-todo-due">{todo.due_date}</span>
                <span className="sales-karte-todo-title">{todo.title}</span>
                {todo.note && <span className="sales-karte-todo-note">{todo.note}</span>}
                <button type="button" className="btn btn-sm" onClick={() => handleTodoSave(i)} disabled={todoSaving[i]}>保存</button>
                {todoErrors[i] && <p className="sales-karte-error">{todoErrors[i]}</p>}
              </li>
            ))}
          </ul>
        </section>

        {/* 清掃情報パネル（お客様カルテ） */}
        <section
          id="sales-karte-panel-cleaning"
          role="tabpanel"
          aria-labelledby="sales-karte-tab-cleaning"
          className="sales-karte-card sales-karte-cleaning"
          hidden={activeTab !== 'cleaning'}
          style={{ padding: 0, background: 'transparent', border: 'none', boxShadow: 'none' }}
        >
          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', padding: '16px' }}>
            <OfficeClientKartePanel
              storeId={decodedKey}
              store={storeMetadata || entity.store}
              isLocked={true}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
