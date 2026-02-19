import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
// Hamburger / admin-top are provided by GlobalNav.
import './admin-master.css';

const EMPTY_OBJ = Object.freeze({});

function isLocalUiHost() {
  if (typeof window === 'undefined') return false;
  const h = String(window.location?.hostname || '').toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
}

const DEFAULT_API_BASE =
  (import.meta.env?.DEV || isLocalUiHost())
    ? '/api-master'
    : (import.meta.env?.VITE_MASTER_API_BASE || 'https://jtn6in2iuj.execute-api.ap-northeast-1.amazonaws.com/prod');

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

function decodeJwtPayload(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function currentActorName() {
  try {
    const token =
      localStorage.getItem('idToken') ||
      localStorage.getItem('cognito_id_token') ||
      localStorage.getItem('id_token') ||
      localStorage.getItem('accessToken') ||
      localStorage.getItem('cognito_access_token') ||
      localStorage.getItem('token') ||
      '';
    const payload = decodeJwtPayload(token);
    const fromJwt = payload?.name || payload?.email || payload?.['cognito:username'];
    if (fromJwt) return String(fromJwt);
  } catch {}
  try {
    const legacy = JSON.parse(localStorage.getItem('misesapo_auth') || '{}');
    return String(legacy?.name || legacy?.email || '').trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}

function toQuery(query) {
  const params = new URLSearchParams();
  Object.entries(query || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    params.set(k, String(v));
  });
  return params.toString();
}

async function apiFetch(baseUrl, path, options = {}) {
  const base = (baseUrl || DEFAULT_API_BASE).replace(/\/$/, '');
  const controller = new AbortController();
  const timeoutMs = Number(options?.timeoutMs || 12000);
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        ...authHeaders(),
        ...(options.headers || {}),
      },
    });
    return res;
  } finally {
    clearTimeout(t);
  }
}

function getItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function pickId(item, idKey) {
  return item?.[idKey] || item?.id || '';
}

function formatCellValue(value) {
  if (value === null || value === undefined || value === '') return '-';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') {
    // Avoid heavy JSON.stringify on arbitrary objects (can freeze with large nested data).
    // Prefer human keys when present, otherwise show a lightweight preview.
    try {
      if (value.label) return String(value.label);
      if (value.name) return String(value.name);
      if (value.title) return String(value.title);
      if (value.id) return String(value.id);
      if (value.key) return String(value.key);

      const keys = Object.keys(value || {});
      if (keys.length === 0) return '{}';

      // If it's a small, shallow object, show key=value pairs.
      const previewPairs = [];
      for (const k of keys.slice(0, 4)) {
        const v = value[k];
        if (v === null || v === undefined) continue;
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
          previewPairs.push(`${k}=${String(v)}`);
        } else if (v && (v.label || v.name || v.id)) {
          previewPairs.push(`${k}=${String(v.label || v.name || v.id)}`);
        }
      }
      if (previewPairs.length) {
        const extra = keys.length > 4 ? `,+${keys.length - 4}` : '';
        return `{${previewPairs.join(', ')}${extra}}`;
      }

      // Fallback: stringify but cap length.
      const s = JSON.stringify(value);
      if (s.length > 160) return `${s.slice(0, 160)}…`;
      return s;
    } catch {
      return '[object]';
    }
  }
  const s = String(value);
  // Prevent huge text from freezing table layout; full text is editable in modal.
  if (s.length > 160) return `${s.slice(0, 160)}…`;
  return s;
}

function toSearchText(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map((v) => toSearchText(v)).join(' ');
  if (typeof value === 'object') {
    try {
      return Object.values(value).map((v) => toSearchText(v)).join(' ');
    } catch {
      return '';
    }
  }
  return String(value);
}

function isDiagMode() {
  try {
    if (typeof window === 'undefined') return false;
    const sp = new URLSearchParams(window.location.search || '');
    return sp.get('diag') === '1' || sp.get('diag') === 'true';
  } catch {
    return false;
  }
}

function isNoTableMode() {
  try {
    if (typeof window === 'undefined') return false;
    const sp = new URLSearchParams(window.location.search || '');
    return sp.get('no_table') === '1' || sp.get('no_table') === 'true';
  } catch {
    return false;
  }
}

function getDiagStep() {
  try {
    if (typeof window === 'undefined') return 0;
    const sp = new URLSearchParams(window.location.search || '');
    const raw = sp.get('diag_step') || '';
    const n = Number(raw);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
  } catch {
    return 0;
  }
}

export default function AdminMasterBase({
  title,
  onTitleClick = null,
  resource,
  idKey,
  apiBase,
  pageClassName = '',
  listLimit = 50,
  // デフォルトは master API だが、jinzai 等「/master を持たないAPI」もあるため切替可能にする。
  // 例) resourceBasePath="" + resource="jinzai" => "/jinzai"
  resourceBasePath = '/master',
  filters = [],
  fields,
  parentSources = EMPTY_OBJ,
  fixedQuery = EMPTY_OBJ,
  fixedNewValues = EMPTY_OBJ,
  onAfterSave,
  localSearch = null,
  renderModalExtra = null,
  headerTabs = null,
  activeHeaderTab = '',
  onHeaderTabChange = null,
  renderHeaderExtra = null,
  clientFilter = null,
  canDeleteRow = null,
  beforeDelete = null,
  enableBulkDelete = false,
  beforeBulkDelete = null,
  enableRowDetail = false,
  rowDetailKeys = null,
  renderRowDetail = null,
  showJotaiColumn = true,
  showJotaiEditor = true,
  normalizeEditingModel = null,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [filtersValue, setFiltersValue] = useState(
    Object.fromEntries(filters.map((f) => [f.key, '']))
  );
  const [parents, setParents] = useState({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectedRowIds, setSelectedRowIds] = useState([]);
  const [expandedRowId, setExpandedRowId] = useState('');
  const [inlineSaving, setInlineSaving] = useState({});
  const [multiSelectOverlayField, setMultiSelectOverlayField] = useState('');
  const [searchText, setSearchText] = useState('');
  const [uiDebug, setUiDebug] = useState(null);
  const textAreaRefs = useRef({});
  const diagMode = isDiagMode();
  const diagStep = getDiagStep();
  const noTableMode = isNoTableMode();

  const setTextAreaRef = useCallback((fieldKey, el) => {
    if (!fieldKey) return;
    if (!el) {
      delete textAreaRefs.current[fieldKey];
      return;
    }
    textAreaRefs.current[fieldKey] = el;
  }, []);

  const applyTextTool = useCallback((fieldKey, tool) => {
    const key = String(fieldKey || '');
    if (!key) return;
    const el = textAreaRefs.current[key];
    const current = String(editing?.[key] ?? '');
    const start = Number.isFinite(el?.selectionStart) ? el.selectionStart : current.length;
    const end = Number.isFinite(el?.selectionEnd) ? el.selectionEnd : current.length;
    const selected = current.slice(start, end);
    let insert = '';

    if (tool === 'date') insert = new Date().toLocaleString('ja-JP');
    if (tool === 'heading') insert = `## ${selected || '見出し'}`;
    if (tool === 'bullet') insert = `- ${selected || ''}`;
    if (tool === 'check') insert = `- [ ] ${selected || ''}`;
    if (tool === 'separator') insert = '\n---\n';

    if (!insert) return;
    const next = `${current.slice(0, start)}${insert}${current.slice(end)}`;
    setEditing((prev) => ({ ...prev, [key]: next }));
    requestAnimationFrame(() => {
      const node = textAreaRefs.current[key];
      if (!node) return;
      const pos = start + insert.length;
      node.focus();
      try {
        node.setSelectionRange(pos, pos);
      } catch {
        // noop
      }
    });
  }, [editing]);

  // NOTE: Many pages pass inline arrays/objects for fields/filters/localSearch.
  // If we use those refs directly as memo deps, opening a modal causes full table re-render.
  // Use value-based signatures to keep memoization effective.
  const fieldsSig = (fields || []).map((f) => {
    const k = f?.key || '';
    const t = f?.type || '';
    const l = f?.label || '';
    const hasFormat = typeof f?.format === 'function' ? 'fmt' : '';
    return `${k}:${t}:${l}:${hasFormat}`;
  }).join('|');
  const localSearchKeysSig = Array.isArray(localSearch?.keys) ? localSearch.keys.map(String).join('|') : '';

  const buildResourcePath = useCallback(
    (suffixPath) => {
      const p = String(resourceBasePath || '').replace(/\/$/, '');
      const s = String(suffixPath || '');
      if (!p) return s.startsWith('/') ? s : `/${s}`;
      if (s.startsWith('/')) return `${p}${s}`;
      return `${p}/${s}`;
    },
    [resourceBasePath]
  );

  const loadParents = useCallback(async () => {
    // If no parent sources are configured, do not touch state.
    // (Avoid effect loops caused by unstable default `{}` props.)
    const entries = Object.entries(parentSources || EMPTY_OBJ);
    if (entries.length === 0) return;

    const next = {};
    await Promise.all(
      entries.map(async ([key, source]) => {
        try {
          const buildPath = (basePath, suffixPath) => {
            const p = String(basePath || '').replace(/\/$/, '');
            const s = String(suffixPath || '');
            if (!p) return s.startsWith('/') ? s : `/${s}`;
            if (s.startsWith('/')) return `${p}${s}`;
            return `${p}/${s}`;
          };

          // Allow parent sources to override API base/path shape (ex: jinzai is not under /master).
          const parentApiBase = source?.apiBase ?? apiBase;
          const parentResourceBasePath = source?.resourceBasePath ?? resourceBasePath;
          const query = toQuery(source.query || {});
          const path = query
            ? `${buildPath(parentResourceBasePath, source.resource)}?${query}`
            : buildPath(parentResourceBasePath, source.resource);
          const res = await apiFetch(parentApiBase, path);
          if (!res.ok) throw new Error(`${source.resource} HTTP ${res.status}`);
          const data = await res.json();
          next[key] = getItems(data);
        } catch (e) {
          console.error(`failed to fetch parent source: ${key}`, e);
          next[key] = [];
        }
      })
    );
    setParents(next);
  }, [parentSources, apiBase, resourceBasePath, buildResourcePath]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // master API の scan を前提にしているため、過大な limit は 500/timeout の原因になる。
      // 一覧はデフォルト 50 件に抑えつつ、ページ側で必要があれば listLimit を上げられるようにする。
      const limit = (() => {
        const n = Number(listLimit);
        if (!Number.isFinite(n) || n <= 0) return 50;
        return Math.trunc(n);
      })();
      const query = toQuery({ limit, ...filtersValue, ...(fixedQuery || EMPTY_OBJ) });
      const path = query
        ? `${buildResourcePath(resource)}?${query}`
        : buildResourcePath(resource);
      const res = await apiFetch(apiBase, path);
      if (!res.ok) {
        throw new Error(`${resource} HTTP ${res.status}`);
      }
      const data = await res.json();
      setItems(getItems(data));
    } catch (e) {
      setError(e.message || `${resource} の取得に失敗しました`);
    } finally {
      setLoading(false);
    }
  }, [resource, filtersValue, apiBase, buildResourcePath, fixedQuery, listLimit]);

  useEffect(() => {
    loadParents();
  }, [loadParents]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const openCreate = useCallback(() => {
    // Diagnostics:
    // - diag=1: stop before any state updates (just confirm click reached).
    // - diag=1&diag_step=N: execute step-by-step to pinpoint which state update freezes.
    //
    // Steps:
    //  1) setUiDebug only
    //  2) build initial only (no setState)
    //  3) setEditing only
    //  4) setModalOpen only
    //  5) setEditing + setModalOpen (sync, no rAF)
    //  6) normal behavior (setEditing + rAF open)
    if (diagMode && !diagStep) {
      window.alert('[diag] openCreate clicked');
      return;
    }

    const at = new Date().toISOString();
    if (diagMode && diagStep === 1) {
      setUiDebug({ action: 'openCreate(step1)', at });
      window.alert('[diag] step1 ok (setUiDebug only)');
      return;
    }

    const initial = { jotai: 'yuko' };
    // Allow callers to pin immutable defaults for "sub-views" (ex: category fixed page).
    if (fixedNewValues && typeof fixedNewValues === 'object') {
      Object.assign(initial, fixedNewValues);
    }
    (fields || []).forEach((f) => {
      if (!f?.key) return;
      if (initial[f.key] !== undefined) return; // fixed values win
      if (f.defaultValue !== undefined) initial[f.key] = f.defaultValue;
      else initial[f.key] = '';
    });

    if (diagMode && diagStep === 2) {
      window.alert(`[diag] step2 ok (built initial keys=${Object.keys(initial).length})`);
      return;
    }

    // Always mark action in non-diag, to help postmortem screenshots.
    if (!diagMode) setUiDebug({ action: 'openCreate', at });

    if (diagMode && diagStep === 3) {
      setEditing(initial);
      setTimeout(() => window.alert('[diag] step3 ok (after setEditing tick)'), 0);
      return;
    }

    if (diagMode && diagStep === 4) {
      setModalOpen(true);
      setTimeout(() => window.alert('[diag] step4 ok (after setModalOpen tick)'), 0);
      return;
    }

    if (diagMode && diagStep === 5) {
      setEditing(initial);
      setModalOpen(true);
      setTimeout(() => window.alert('[diag] step5 ok (after setEditing+setModalOpen tick)'), 0);
      return;
    }

    // Step6 / normal: setEditing then open.
    const normalized = (typeof normalizeEditingModel === 'function')
      ? (normalizeEditingModel(initial, { mode: 'create' }) || initial)
      : initial;
    setEditing(normalized);
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => setModalOpen(true));
    } else {
      setModalOpen(true);
    }
  }, [fields, diagMode, diagStep, fixedNewValues, normalizeEditingModel]);

  const openEdit = useCallback((row) => {
    if (diagMode && !diagStep) {
      window.alert(`[diag] openEdit clicked id=${pickId(row, idKey)}`);
      return;
    }
    const at = new Date().toISOString();
    if (!diagMode) setUiDebug({ action: 'openEdit', at, id: pickId(row, idKey) });
    const model = { ...row };
    if (!model.jotai) model.jotai = 'yuko';
    const normalized = (typeof normalizeEditingModel === 'function')
      ? (normalizeEditingModel(model, { mode: 'edit' }) || model)
      : model;
    setEditing(normalized);
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => setModalOpen(true));
    } else {
      setModalOpen(true);
    }
  }, [diagMode, diagStep, idKey, normalizeEditingModel]);

  const closeModal = useCallback(() => {
    setUiDebug({ action: 'closeModal', at: new Date().toISOString() });
    setMultiSelectOverlayField('');
    setModalOpen(false);
    setEditing(null);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!modalOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') closeModal();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [modalOpen, closeModal]);

  // NOTE: Avoid forcing body scroll lock here; it can trigger expensive reflow on some setups.

  const onSave = useCallback(async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const preModel = (typeof normalizeEditingModel === 'function')
        ? (normalizeEditingModel(editing, { mode: pickId(editing, idKey) ? 'edit' : 'create', phase: 'save' }) || editing)
        : editing;

      const currentId = pickId(preModel, idKey);
      const isUpdate = !!currentId && !String(currentId).startsWith('TMP#');
      if (!isUpdate) {
        const missingRequired = (fields || [])
          .filter((f) => f?.required === true)
          .filter((f) => {
            const v = preModel?.[f.key];
            return v === undefined || v === null || String(v).trim() === '';
          });
        if (missingRequired.length) {
          const labels = missingRequired.map((f) => f.label || f.key).join('\n- ');
          window.alert(`必須項目が未入力です。\n- ${labels}`);
          return;
        }
      }
      const path = isUpdate
        ? buildResourcePath(`${resource}/${encodeURIComponent(currentId)}`)
        : buildResourcePath(resource);
      const method = isUpdate ? 'PUT' : 'POST';
      const actor = currentActorName();
      const payload = { ...preModel, updated_by: actor };
      const res = await apiFetch(apiBase, path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${resource} 保存失敗 (${res.status}) ${text}`);
      }
      let responseData = null;
      try {
        responseData = await res.json();
      } catch {
        responseData = null;
      }
      if (typeof onAfterSave === 'function') {
        try {
          await onAfterSave({
            isUpdate,
            id: pickId(responseData, idKey) || currentId || preModel?.[idKey] || '',
            editing: preModel,
            responseData,
            request: (hookPath, hookOptions = {}) => {
              // 互換: 既存フックは `/souko` のように prefix なしで指定しているため、
              // resourceBasePath が有効で、hookPath が `/master/...` を含まない場合は prefix 配下として扱う。
              const hp = String(hookPath || '');
              const p = String(resourceBasePath || '').replace(/\/$/, '');
              const finalPath =
                p && hp.startsWith('/') && !hp.startsWith(`${p}/`) ? buildResourcePath(hp) : hp;
              return apiFetch(apiBase, finalPath, hookOptions);
            },
          });
        } catch (hookErr) {
          console.error(`${resource} onAfterSave failed`, hookErr);
          window.alert(`保存後処理でエラーが発生しました: ${hookErr?.message || hookErr}`);
        }
      }
      closeModal();
      await loadItems();
    } catch (e) {
      window.alert(e.message || '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }, [editing, idKey, resource, closeModal, loadItems, onAfterSave, apiBase, buildResourcePath, resourceBasePath, fields, normalizeEditingModel]);

  const onDelete = useCallback(async (row) => {
    if (typeof canDeleteRow === 'function' && !canDeleteRow(row)) {
      return;
    }
    if (typeof beforeDelete === 'function') {
      const ok = await beforeDelete(row);
      if (!ok) return;
    }
    setUiDebug({ action: 'openDeleteConfirm', at: new Date().toISOString(), id: pickId(row, idKey) });
    const rowId = pickId(row, idKey);
    if (!rowId) return;
    setDeleteTarget(row);
  }, [idKey, canDeleteRow, beforeDelete]);

  const closeDeleteConfirm = useCallback(() => {
    if (deleting) return;
    setUiDebug({ action: 'closeDeleteConfirm', at: new Date().toISOString() });
    setDeleteTarget(null);
  }, [deleting]);

  useEffect(() => {
    if (!enableBulkDelete) {
      setSelectedRowIds([]);
    }
  }, [enableBulkDelete]);

  const toggleRowSelect = useCallback((rowId, checked) => {
    setSelectedRowIds((prev) => {
      const s = new Set(prev);
      if (checked) s.add(rowId);
      else s.delete(rowId);
      return Array.from(s);
    });
  }, []);

  const toggleSelectAllVisible = useCallback((checked, rows) => {
    const ids = (rows || [])
      .filter((row) => (typeof canDeleteRow !== 'function' || canDeleteRow(row)))
      .map((row) => pickId(row, idKey))
      .filter(Boolean);
    setSelectedRowIds((prev) => {
      const s = new Set(prev);
      ids.forEach((rid) => {
        if (checked) s.add(rid);
        else s.delete(rid);
      });
      return Array.from(s);
    });
  }, [idKey, canDeleteRow]);

  const confirmDelete = useCallback(async () => {
    const row = deleteTarget;
    const rowId = pickId(row, idKey);
    if (!rowId) return;
    setDeleting(true);
    try {
      const res = await apiFetch(apiBase, buildResourcePath(`${resource}/${encodeURIComponent(rowId)}`), {
        method: 'DELETE',
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${resource} 取消失敗 (${res.status}) ${text}`);
      }
      setDeleteTarget(null);
      await loadItems();
    } catch (e) {
      window.alert(e.message || '取消に失敗しました');
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, idKey, apiBase, buildResourcePath, resource, loadItems]);

  const toggleRowDetail = useCallback((row) => {
    if (!enableRowDetail) return;
    const rid = pickId(row, idKey);
    if (!rid) return;
    setExpandedRowId((prev) => (prev === rid ? '' : rid));
  }, [enableRowDetail, idKey]);

  const fieldByKey = useMemo(() => {
    const m = new Map();
    (fields || []).forEach((f) => {
      if (!f?.key) return;
      m.set(f.key, f);
    });
    return m;
  }, [fieldsSig]); // keep stable even if fields array ref changes

  const rowDetailItems = useCallback((row) => {
    const keys = Array.isArray(rowDetailKeys) && rowDetailKeys.length
      ? rowDetailKeys
      : Object.keys(row || {});
    const items = keys
      .filter((k) => Boolean(k))
      .map((k) => {
        const f = fieldByKey.get(k);
        const label = f?.label || (k === idKey ? 'ID' : (k === 'jotai' ? '状態' : k));
        const raw = row?.[k];
        const v = typeof f?.format === 'function' ? f.format(raw, row) : raw;
        return { key: k, label, value: formatCellValue(v) };
      });
    return items;
  }, [rowDetailKeys, fieldByKey, idKey]);

  const onInlineFieldChange = useCallback(async (row, field, value) => {
    const rowId = pickId(row, idKey);
    if (!rowId || !field?.key) return;
    const key = String(field.key);
    const saveKey = `${rowId}:${key}`;
    setInlineSaving((prev) => ({ ...prev, [saveKey]: true }));

    const prevItems = items;
    const actor = currentActorName();
    const nextItems = (items || []).map((it) => (
      pickId(it, idKey) === rowId ? { ...it, [key]: value, updated_by: actor } : it
    ));
    setItems(nextItems);

    try {
      const path = buildResourcePath(`${resource}/${encodeURIComponent(rowId)}`);
      const patch = { [key]: value, updated_by: actor };
      const res = await apiFetch(apiBase, path, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${resource} 更新失敗 (${res.status}) ${text}`);
      }
      let data = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }
      if (data && typeof data === 'object') {
        setItems((curr) => (curr || []).map((it) => (
          pickId(it, idKey) === rowId ? { ...it, ...data } : it
        )));
      }
    } catch (e) {
      setItems(prevItems);
      window.alert(e.message || '状況更新に失敗しました');
    } finally {
      setInlineSaving((prev) => {
        const n = { ...prev };
        delete n[saveKey];
        return n;
      });
    }
  }, [apiBase, buildResourcePath, idKey, items, resource]);

  const columns = useMemo(() => {
    const base = [
      { key: idKey, label: 'ID' },
      ...fields.map((f) => ({ key: f.key, label: f.columnLabel || f.label })),
    ];
    if (showJotaiColumn) base.push({ key: 'jotai', label: '状態' });
    return base;
  }, [fieldsSig, idKey, showJotaiColumn]);

  const visibleItems = useMemo(() => {
    const q = String(searchText || '').trim().toLowerCase();
    const keys = Array.isArray(localSearch?.keys) ? localSearch.keys : [];
    const baseItems = typeof clientFilter === 'function'
      ? (items || []).filter((row) => clientFilter(row))
      : (items || []);
    if (!q || !keys.length) return baseItems;
    return baseItems.filter((row) =>
      keys.some((k) => toSearchText(row?.[k]).toLowerCase().includes(q))
    );
  }, [items, searchText, localSearchKeysSig, clientFilter]);

  const onBulkDelete = useCallback(async () => {
    const targetRows = (visibleItems || []).filter((row) => selectedRowIds.includes(pickId(row, idKey)));
    if (!targetRows.length) return;
    if (typeof beforeBulkDelete === 'function') {
      const ok = await beforeBulkDelete(targetRows);
      if (!ok) return;
    }
    setBulkDeleting(true);
    try {
      let okCount = 0;
      let ngCount = 0;
      for (const row of targetRows) {
        const rid = pickId(row, idKey);
        if (!rid) continue;
        try {
          const res = await apiFetch(apiBase, buildResourcePath(`${resource}/${encodeURIComponent(rid)}`), {
            method: 'DELETE',
          });
          if (!res.ok) throw new Error(`${res.status}`);
          okCount += 1;
        } catch {
          ngCount += 1;
        }
      }
      setSelectedRowIds([]);
      await loadItems();
      if (ngCount > 0) {
        window.alert(`一括削除完了: 成功 ${okCount}件 / 失敗 ${ngCount}件`);
      }
    } finally {
      setBulkDeleting(false);
    }
  }, [visibleItems, selectedRowIds, idKey, beforeBulkDelete, apiBase, buildResourcePath, resource, loadItems]);

  // Rendering the full table for every modal state change can stall the UI on large lists.
  // Memoize table rows so opening/closing the modal doesn't redo heavy cell formatting work.
  const tableContent = useMemo(() => (
    <section className="admin-master-table-wrap">
      <table className="admin-master-table">
        <thead>
          <tr>
            {enableBulkDelete ? (
              <th className="bulk-check-col">
                <input
                  type="checkbox"
                  checked={(() => {
                    const ids = visibleItems
                      .filter((row) => (typeof canDeleteRow !== 'function' || canDeleteRow(row)))
                      .map((row) => pickId(row, idKey))
                      .filter(Boolean);
                    return ids.length > 0 && ids.every((rid) => selectedRowIds.includes(rid));
                  })()}
                  onChange={(e) => toggleSelectAllVisible(e.target.checked, visibleItems)}
                />
              </th>
            ) : null}
            {columns.map((c) => <th key={c.key}>{c.label}</th>)}
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {visibleItems.length === 0 && !loading && (
            <tr>
              <td colSpan={columns.length + 1 + (enableBulkDelete ? 1 : 0)} className="empty">データがありません</td>
            </tr>
          )}
          {visibleItems.map((row) => {
            const rid = pickId(row, idKey);
            const isExpanded = !!rid && expandedRowId === rid;
            const rowDeletable = typeof canDeleteRow !== 'function' || canDeleteRow(row);
            return (
              <React.Fragment key={rid || Math.random()}>
                <tr
                  className={`${enableRowDetail ? 'row-clickable' : ''} ${isExpanded ? 'is-expanded' : ''}`.trim()}
                  onClick={() => toggleRowDetail(row)}
                >
                  {enableBulkDelete ? (
                    <td className="bulk-check-col" data-col="選択" data-key="bulk">
                      {rowDeletable ? (
                        <input
                          type="checkbox"
                          checked={selectedRowIds.includes(rid)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleRowSelect(rid, e.target.checked);
                          }}
                        />
                      ) : null}
                    </td>
                  ) : null}
                  {columns.map((c) => {
                    const f = fieldByKey.get(c.key);
                    const raw = row?.[c.key];
                    if (f?.type === 'select' && f?.inlineEdit === true) {
                      const valueKey = f.valueKey || f.key;
                      const labelKey = f.labelKey || 'name';
                      const options = f.options || [];
                      const rowId = pickId(row, idKey);
                      const saveKey = `${rowId}:${String(f.key)}`;
                      const busy = !!inlineSaving[saveKey];
                      return (
                        <td key={`${rid}-${c.key}`} data-col={c.label} data-key={c.key}>
                          <select
                            className="admin-master-inline-select"
                            value={raw ?? ''}
                            disabled={busy}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              e.stopPropagation();
                              onInlineFieldChange(row, f, e.target.value);
                            }}
                          >
                            {options.map((opt) => {
                              const v = opt?.[valueKey] ?? opt?.value ?? opt?.id ?? '';
                              const l = opt?.[labelKey] ?? opt?.label ?? v;
                              if (!v) return null;
                              return <option key={String(v)} value={String(v)}>{l}</option>;
                            })}
                          </select>
                        </td>
                      );
                    }
                    const rendered = typeof f?.render === 'function' ? f.render(raw, row) : null;
                    if (rendered !== null && rendered !== undefined) {
                      return <td key={`${rid}-${c.key}`} data-col={c.label} data-key={c.key}>{rendered}</td>;
                    }
                    const v = typeof f?.format === 'function' ? f.format(raw, row) : raw;
                    return <td key={`${rid}-${c.key}`} data-col={c.label} data-key={c.key}>{formatCellValue(v)}</td>;
                  })}
                  <td className="actions" data-col="操作" data-key="actions">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(row);
                      }}
                    >
                      編集
                    </button>
                    {rowDeletable ? (
                      <button
                        type="button"
                        className="danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          void onDelete(row);
                        }}
                      >
                        取消
                      </button>
                    ) : null}
                  </td>
                </tr>
                {enableRowDetail && isExpanded ? (
                  <tr className="row-detail">
                    <td colSpan={columns.length + 1 + (enableBulkDelete ? 1 : 0)}>
                      {typeof renderRowDetail === 'function'
                        ? renderRowDetail({
                          row,
                          rowId: rid,
                          items: rowDetailItems(row),
                          parents,
                          onInlineFieldChange: (field, value) => onInlineFieldChange(row, { key: field }, value),
                          inlineSaving,
                        })
                        : (rowDetailItems(row).length ? (
                          <div className="row-detail-grid">
                            {rowDetailItems(row).map((it) => (
                              <div key={`${rid}-detail-${it.key}`} className="row-detail-item">
                                <div className="k">{it.label}</div>
                                <div className="v">{it.value}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="row-detail-empty">詳細はありません</div>
                        ))}
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </section>
  ), [visibleItems, columns, fieldByKey, loading, openEdit, onDelete, canDeleteRow, idKey, enableBulkDelete, selectedRowIds, toggleRowSelect, toggleSelectAllVisible, enableRowDetail, toggleRowDetail, expandedRowId, rowDetailItems, inlineSaving, onInlineFieldChange, renderRowDetail]);

  return (
    <div className={`admin-master-page ${pageClassName || ''}`.trim()} data-resource={resource}>
      <div className="admin-master-content">
        <header className="admin-master-header">
          <div className="admin-top-left">
            {/* GlobalNav handles navigation */}
          </div>
          <h1
            onClick={typeof onTitleClick === 'function' ? onTitleClick : undefined}
            style={typeof onTitleClick === 'function' ? { cursor: 'pointer', userSelect: 'none' } : undefined}
          >
            {title}
          </h1>
          {Array.isArray(headerTabs) && headerTabs.length > 0 ? (
            <div className="admin-master-header-tabs">
              {headerTabs.map((tab) => (
                <button
                  key={String(tab?.value || '')}
                  type="button"
                  className={`admin-master-header-tab ${String(activeHeaderTab) === String(tab?.value || '') ? 'is-active' : ''} ${String(tab?.tone || '')}`}
                  onClick={() => onHeaderTabChange?.(String(tab?.value || ''))}
                >
                  {tab?.label || tab?.value}
                </button>
              ))}
            </div>
          ) : null}
          <div className="admin-master-header-actions">
            <button type="button" onClick={openCreate} className="primary">新規登録</button>
            {enableBulkDelete ? (
              <button
                type="button"
                className="danger"
                disabled={bulkDeleting || selectedRowIds.length === 0}
                onClick={() => void onBulkDelete()}
              >
                {bulkDeleting ? '削除中...' : `選択削除(${selectedRowIds.length})`}
              </button>
            ) : null}
            <button type="button" onClick={loadItems} disabled={loading}>{loading ? '更新中...' : '更新'}</button>
          </div>
        </header>
        {typeof renderHeaderExtra === 'function' ? (
          <div className="admin-master-header-extra">
            {renderHeaderExtra()}
          </div>
        ) : null}

        {uiDebug ? (
          <div style={{ fontSize: 12, color: '#9aa6c5', marginBottom: 8 }}>
            ui: {uiDebug.action} {uiDebug.id ? `(${uiDebug.id})` : ''} {uiDebug.at}
          </div>
        ) : null}

        {/* Overlay editor */}
        {modalOpen && editing ? (
          <div className="admin-master-modal-backdrop" onClick={closeModal}>
            <section
              className="admin-master-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="admin-master-inline-editor-title">{pickId(editing, idKey) ? '編集' : '新規登録'}</h2>
              <div className="admin-master-modal-grid">
              {fields.map((f) => {
                const options = f.sourceKey
                  ? (parents[f.sourceKey] || [])
                  : (typeof f.options === 'function' ? (f.options(parents || EMPTY_OBJ) || []) : (f.options || []));
                if (f.type === 'select') {
                  const modalColSpan = Number(f.modalColSpan || 0);
                  const valueKey = f.valueKey || f.key;
                  const labelKey = f.labelKey || 'name';
                  return (
                    <label
                      key={f.key}
                      className={`admin-master-field field-${String(f.key || '').replace(/[^a-zA-Z0-9_-]/g, '_')}`}
                      style={modalColSpan > 1 ? { gridColumn: `span ${modalColSpan}` } : undefined}
                    >
                      <span>{f.label}</span>
                      <select
                        value={editing[f.key] || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          setEditing((prev) => {
                            let next = { ...prev, [f.key]: value };
                            if (typeof f.onChange === 'function') {
                              const patch = f.onChange({ value, prev: next });
                              if (patch && typeof patch === 'object') next = { ...next, ...patch };
                            }
                            return next;
                          });
                        }}
                        disabled={f.readOnly === true}
                      >
                        <option value="">選択してください</option>
                        {options.map((opt) => {
                          const v = opt?.[valueKey] ?? opt?.value ?? opt?.id ?? '';
                          const l = opt?.[labelKey] ?? opt?.label ?? v;
                          if (!v) return null;
                          return <option key={v} value={v}>{l}</option>;
                        })}
                      </select>
                    </label>
                  );
                }
                if (f.type === 'multi_select') {
                  const modalColSpan = Number(f.modalColSpan || 0);
                  const valueKey = f.valueKey || f.key;
                  const labelKey = f.labelKey || 'name';
                  const currentValue = Array.isArray(editing[f.key]) ? editing[f.key].map(String) : [];
                  const isOverlay = f.overlay === true;
                  const selectedLabels = options
                    .filter((opt) => currentValue.includes(String(opt?.[valueKey] ?? opt?.value ?? opt?.id ?? '')))
                    .map((opt) => String(opt?.[labelKey] ?? opt?.label ?? opt?.[valueKey] ?? opt?.value ?? opt?.id ?? ''))
                    .filter(Boolean);

                  if (isOverlay) {
                    const overlayKey = String(f.key || '');
                    const opened = multiSelectOverlayField === overlayKey;
                    const summary = selectedLabels.length
                      ? `${selectedLabels.slice(0, 2).join(' / ')}${selectedLabels.length > 2 ? ` +${selectedLabels.length - 2}` : ''}`
                      : '選択してください';
                    return (
                      <div
                        key={f.key}
                        className={`admin-master-multi-select-field admin-master-field field-${String(f.key || '').replace(/[^a-zA-Z0-9_-]/g, '_')}`}
                        style={modalColSpan > 1 ? { gridColumn: `span ${modalColSpan}` } : undefined}
                      >
                        <span>{f.label}</span>
                        <div className="admin-master-multi-select-wrap">
                          <button
                            type="button"
                            className="admin-master-multi-select-trigger"
                            disabled={f.readOnly === true}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setMultiSelectOverlayField((prev) => (prev === overlayKey ? '' : overlayKey));
                            }}
                          >
                            {summary}
                          </button>
                          {opened ? (
                            <div
                              className="admin-master-multi-select-overlay"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                            >
                              <div className="admin-master-multi-select-overlay-head">
                                <strong>複数選択</strong>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setMultiSelectOverlayField('');
                                  }}
                                >
                                  閉じる
                                </button>
                              </div>
                              <div className="admin-master-multi-select-overlay-list">
                                {options.map((opt) => {
                                  const v = String(opt?.[valueKey] ?? opt?.value ?? opt?.id ?? '');
                                  const l = String(opt?.[labelKey] ?? opt?.label ?? v);
                                  if (!v) return null;
                                  const checked = currentValue.includes(v);
                                  return (
                                    <label key={v} className="admin-master-multi-select-option">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          const on = e.target.checked;
                                          setEditing((prev) => {
                                            const curr = Array.isArray(prev?.[f.key]) ? prev[f.key].map(String) : [];
                                            const nextValue = on
                                              ? [...new Set([...curr, v])]
                                              : curr.filter((x) => x !== v);
                                            let next = { ...prev, [f.key]: nextValue };
                                            if (typeof f.onChange === 'function') {
                                              const patch = f.onChange({ value: next[f.key], prev: next });
                                              if (patch && typeof patch === 'object') next = { ...next, ...patch };
                                            }
                                            return next;
                                          });
                                        }}
                                      />
                                      <span>{l}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <label
                      key={f.key}
                      className={`admin-master-field field-${String(f.key || '').replace(/[^a-zA-Z0-9_-]/g, '_')}`}
                      style={modalColSpan > 1 ? { gridColumn: `span ${modalColSpan}` } : undefined}
                    >
                      <span>{f.label}</span>
                      <select
                        multiple
                        size={Math.min(10, Math.max(4, options.length || 4))}
                        value={currentValue}
                        onChange={(e) => {
                          const value = Array.from(e.target.selectedOptions || []).map((opt) => String(opt.value || ''));
                          setEditing((prev) => {
                            let next = { ...prev, [f.key]: value.filter(Boolean) };
                            if (typeof f.onChange === 'function') {
                              const patch = f.onChange({ value: next[f.key], prev: next });
                              if (patch && typeof patch === 'object') next = { ...next, ...patch };
                            }
                            return next;
                          });
                        }}
                        disabled={f.readOnly === true}
                      >
                        {options.map((opt) => {
                          const v = opt?.[valueKey] ?? opt?.value ?? opt?.id ?? '';
                          const l = opt?.[labelKey] ?? opt?.label ?? v;
                          if (!v) return null;
                          return <option key={String(v)} value={String(v)}>{l}</option>;
                        })}
                      </select>
                    </label>
                  );
                }

                if (f.type === 'textarea') {
                  const modalColSpan = Number(f.modalColSpan || 0);
                  const toolItems = f.enableTools === true
                    ? [
                      { key: 'date', label: '日付' },
                      { key: 'heading', label: '見出し' },
                      { key: 'bullet', label: '箇条書き' },
                      { key: 'check', label: 'チェック' },
                      { key: 'separator', label: '区切り' },
                    ]
                    : [];
                  return (
                    <label
                      key={f.key}
                      className={`admin-master-field field-${String(f.key || '').replace(/[^a-zA-Z0-9_-]/g, '_')}`}
                      style={modalColSpan > 1 ? { gridColumn: `span ${modalColSpan}` } : undefined}
                    >
                      <span>{f.label}</span>
                      {toolItems.length ? (
                        <div className="admin-master-text-tools" role="toolbar" aria-label={`${f.label} 入力ツール`}>
                          {toolItems.map((tool) => (
                            <button
                              key={tool.key}
                              type="button"
                              onClick={() => applyTextTool(f.key, tool.key)}
                              disabled={f.readOnly === true}
                            >
                              {tool.label}
                            </button>
                          ))}
                        </div>
                      ) : null}
                      <textarea
                        ref={(el) => setTextAreaRef(f.key, el)}
                        value={editing[f.key] ?? ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          setEditing((prev) => {
                            let next = { ...prev, [f.key]: value };
                            if (typeof f.onChange === 'function') {
                              const patch = f.onChange({ value, prev: next });
                              if (patch && typeof patch === 'object') next = { ...next, ...patch };
                            }
                            return next;
                          });
                        }}
                        disabled={f.readOnly === true}
                        rows={Number.isFinite(Number(f.rows)) ? Number(f.rows) : 8}
                      />
                    </label>
                  );
                }

                return (
                  <label
                    key={f.key}
                    className={`admin-master-field field-${String(f.key || '').replace(/[^a-zA-Z0-9_-]/g, '_')}`}
                    style={Number(f.modalColSpan || 0) > 1 ? { gridColumn: `span ${Number(f.modalColSpan)}` } : undefined}
                  >
                    <span>{f.label}</span>
                    <input
                      type={f.type === 'number' ? 'number' : 'text'}
                      value={editing[f.key] ?? ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        setEditing((prev) => {
                          let next = { ...prev, [f.key]: value };
                          if (typeof f.onChange === 'function') {
                            const patch = f.onChange({ value, prev: next });
                            if (patch && typeof patch === 'object') next = { ...next, ...patch };
                          }
                          return next;
                        });
                      }}
                      disabled={f.readOnly === true}
                    />
                  </label>
                );
              })}

              {showJotaiEditor ? (
                <label>
                  <span>状態 (jotai)</span>
                  <select
                    value={editing.jotai || 'yuko'}
                    onChange={(e) => setEditing((prev) => ({ ...prev, jotai: e.target.value }))}
                  >
                    <option value="yuko">yuko</option>
                    <option value="torikeshi">torikeshi</option>
                  </select>
                </label>
              ) : null}
              </div>

              {typeof renderModalExtra === 'function' ? (
                <div style={{ marginTop: 12 }}>
                  {renderModalExtra({ editing, setEditing, parents })}
                </div>
              ) : null}

              <div className="admin-master-modal-actions">
                <button type="button" onClick={closeModal}>キャンセル</button>
                <button type="button" className="primary" onClick={onSave} disabled={saving}>
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {deleteTarget ? (
          <section style={{ border: '1px solid #ef4444', borderRadius: 12, background: 'rgba(127,29,29,0.20)', padding: 16, marginBottom: 12 }}>
            <h2 style={{ margin: '0 0 10px' }}>取り消し確認</h2>
            <p style={{ marginTop: 0, color: '#fecaca' }}>
              このデータを取り消し（`torikeshi`）にします。よろしいですか？
            </p>
            <div style={{ marginBottom: 12, padding: 10, border: '1px solid rgba(239,68,68,0.35)', borderRadius: 8, background: 'rgba(2,6,23,0.35)' }}>
              <div style={{ color: '#fecaca', fontSize: 12 }}>対象ID</div>
              <div>{pickId(deleteTarget, idKey)}</div>
              {deleteTarget?.name ? (
                <>
                  <div style={{ color: '#fecaca', fontSize: 12, marginTop: 6 }}>名称</div>
                  <div>{deleteTarget.name}</div>
                </>
              ) : null}
            </div>
            <div className="admin-master-modal-actions">
              <button type="button" onClick={closeDeleteConfirm} disabled={deleting}>キャンセル</button>
              <button type="button" className="primary" onClick={confirmDelete} disabled={deleting}>
                {deleting ? '取り消し中...' : '取り消す'}
              </button>
            </div>
          </section>
        ) : null}

        <section className="admin-master-toolbar">
          {localSearch?.keys?.length ? (
            <label data-local-search="1">
              <span>{localSearch.label || '検索'}</span>
              <input
                type="text"
                placeholder={localSearch.placeholder || 'キーワード検索'}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </label>
          ) : null}
          {filters.map((f) => {
            const options = f.sourceKey
              ? (parents[f.sourceKey] || [])
              : (typeof f.options === 'function' ? (f.options(parents || EMPTY_OBJ) || []) : (f.options || []));
            const valueKey = f.valueKey || f.key;
            const labelKey = f.labelKey || 'name';
            return (
              <label key={f.key} data-filter-key={String(f.key || '')}>
                <span>{f.label}</span>
                {f.type === 'text' ? (
                  <input
                    type="text"
                    placeholder={f.placeholder || ''}
                    value={filtersValue[f.key] || ''}
                    onChange={(e) => setFiltersValue((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  />
                ) : (
                  <select
                    value={filtersValue[f.key] || ''}
                    onChange={(e) => setFiltersValue((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  >
                    <option value="">全て</option>
                    {options.map((opt) => {
                      // Support { value, label } shape too (used by Kadai filters etc.)
                      const v = opt?.[valueKey] ?? opt?.value ?? opt?.id ?? '';
                      const l = opt?.[labelKey] ?? opt?.label ?? v;
                      if (!v) return null;
                      return <option key={v} value={v}>{l}</option>;
                    })}
                  </select>
                )}
              </label>
            );
          })}
        </section>

        {error && <div className="admin-master-error">{error}</div>}

        {/* Diagnostics: allow disabling the table render to isolate freeze cause. */}
        {noTableMode ? (
          <div style={{ padding: 12, border: '1px dashed #273049', borderRadius: 12, color: '#9aa6c5' }}>
            no_table=1: テーブル描画を無効化中
          </div>
        ) : tableContent}
      </div>
    </div>
  );
}
