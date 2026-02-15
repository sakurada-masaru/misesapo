import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  resource,
  idKey,
  apiBase,
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
  const [searchText, setSearchText] = useState('');
  const [uiDebug, setUiDebug] = useState(null);
  const diagMode = isDiagMode();
  const diagStep = getDiagStep();
  const noTableMode = isNoTableMode();

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
          const query = toQuery(source.query || {});
          const path = query
            ? `${buildResourcePath(source.resource)}?${query}`
            : buildResourcePath(source.resource);
          const res = await apiFetch(apiBase, path);
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
  }, [parentSources, apiBase, buildResourcePath]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // master API の scan を前提にしているため、過大な limit は 500/timeout の原因になる。
      // 一覧はまず 50 件に抑え、必要ならフィルタ/検索で絞る運用にする（UIフリーズ回避）。
      const query = toQuery({ limit: 50, ...filtersValue, ...(fixedQuery || EMPTY_OBJ) });
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
  }, [resource, filtersValue, apiBase, buildResourcePath, fixedQuery]);

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
    setEditing(initial);
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => setModalOpen(true));
    } else {
      setModalOpen(true);
    }
  }, [fields, diagMode, diagStep, fixedNewValues]);

  const openEdit = useCallback((row) => {
    if (diagMode && !diagStep) {
      window.alert(`[diag] openEdit clicked id=${pickId(row, idKey)}`);
      return;
    }
    const at = new Date().toISOString();
    if (!diagMode) setUiDebug({ action: 'openEdit', at, id: pickId(row, idKey) });
    const model = { ...row };
    if (!model.jotai) model.jotai = 'yuko';
    setEditing(model);
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => setModalOpen(true));
    } else {
      setModalOpen(true);
    }
  }, [diagMode, diagStep, idKey]);

  const closeModal = useCallback(() => {
    setUiDebug({ action: 'closeModal', at: new Date().toISOString() });
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
      const currentId = pickId(editing, idKey);
      const isUpdate = !!currentId && !String(currentId).startsWith('TMP#');
      const path = isUpdate
        ? buildResourcePath(`${resource}/${encodeURIComponent(currentId)}`)
        : buildResourcePath(resource);
      const method = isUpdate ? 'PUT' : 'POST';
      const res = await apiFetch(apiBase, path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
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
            id: pickId(responseData, idKey) || currentId || editing?.[idKey] || '',
            editing,
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
  }, [editing, idKey, resource, closeModal, loadItems, onAfterSave, apiBase, buildResourcePath, resourceBasePath]);

  const onDelete = useCallback((row) => {
    setUiDebug({ action: 'openDeleteConfirm', at: new Date().toISOString(), id: pickId(row, idKey) });
    const rowId = pickId(row, idKey);
    if (!rowId) return;
    setDeleteTarget(row);
  }, [idKey]);

  const closeDeleteConfirm = useCallback(() => {
    if (deleting) return;
    setUiDebug({ action: 'closeDeleteConfirm', at: new Date().toISOString() });
    setDeleteTarget(null);
  }, [deleting]);

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

  const fieldByKey = useMemo(() => {
    const m = new Map();
    (fields || []).forEach((f) => {
      if (!f?.key) return;
      m.set(f.key, f);
    });
    return m;
  }, [fieldsSig]); // keep stable even if fields array ref changes

  const columns = useMemo(() => {
    return [
      { key: idKey, label: 'ID' },
      ...fields.map((f) => ({ key: f.key, label: f.label })),
      { key: 'jotai', label: '状態' },
    ];
  }, [fieldsSig, idKey]);

  const visibleItems = useMemo(() => {
    const q = String(searchText || '').trim().toLowerCase();
    const keys = Array.isArray(localSearch?.keys) ? localSearch.keys : [];
    if (!q || !keys.length) return items;
    return items.filter((row) =>
      keys.some((k) => String(row?.[k] ?? '').toLowerCase().includes(q))
    );
  }, [items, searchText, localSearchKeysSig]);

  // Rendering the full table for every modal state change can stall the UI on large lists.
  // Memoize table rows so opening/closing the modal doesn't redo heavy cell formatting work.
  const tableContent = useMemo(() => (
    <section className="admin-master-table-wrap">
      <table className="admin-master-table">
        <thead>
          <tr>
            {columns.map((c) => <th key={c.key}>{c.label}</th>)}
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {visibleItems.length === 0 && !loading && (
            <tr>
              <td colSpan={columns.length + 1} className="empty">データがありません</td>
            </tr>
          )}
          {visibleItems.map((row) => {
            const rid = pickId(row, idKey);
            return (
              <tr key={rid || Math.random()}>
                {columns.map((c) => {
                  const f = fieldByKey.get(c.key);
                  const raw = row?.[c.key];
                  const v = typeof f?.format === 'function' ? f.format(raw, row) : raw;
                  return <td key={`${rid}-${c.key}`}>{formatCellValue(v)}</td>;
                })}
                <td className="actions">
                  <button type="button" onClick={() => openEdit(row)}>編集</button>
                  <button type="button" className="danger" onClick={() => onDelete(row)}>取消</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  ), [visibleItems, columns, fieldByKey, loading, openEdit, onDelete, idKey]);

  return (
    <div className="admin-master-page">
      <div className="admin-master-content">
        <header className="admin-master-header">
          <div className="admin-top-left">
            {/* GlobalNav handles navigation */}
          </div>
          <h1>{title}</h1>
          <div className="admin-master-header-actions">
            <button type="button" onClick={openCreate} className="primary">新規登録</button>
            <button type="button" onClick={loadItems} disabled={loading}>{loading ? '更新中...' : '更新'}</button>
          </div>
        </header>

        {uiDebug ? (
          <div style={{ fontSize: 12, color: '#9aa6c5', marginBottom: 8 }}>
            ui: {uiDebug.action} {uiDebug.id ? `(${uiDebug.id})` : ''} {uiDebug.at}
          </div>
        ) : null}

        {/* Inline editor (avoid fixed/portal overlays; browsers were hard-freezing on modal open). */}
        {modalOpen && editing ? (
          <section style={{ border: '1px solid #273049', borderRadius: 12, background: '#0f172a', padding: 16, marginBottom: 12 }}>
            <h2 style={{ margin: '0 0 12px' }}>{pickId(editing, idKey) ? '編集' : '新規登録'}</h2>
            <div className="admin-master-modal-grid">
              {fields.map((f) => {
                const options = f.sourceKey ? (parents[f.sourceKey] || []) : (f.options || []);
                if (f.type === 'select') {
                  const valueKey = f.valueKey || f.key;
                  const labelKey = f.labelKey || 'name';
                  return (
                    <label key={f.key}>
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

                return (
                  <label key={f.key}>
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
            </div>

            {typeof renderModalExtra === 'function' ? (
              <div style={{ marginTop: 12 }}>
                {renderModalExtra({ editing, setEditing })}
              </div>
            ) : null}

            <div className="admin-master-modal-actions">
              <button type="button" onClick={closeModal}>キャンセル</button>
              <button type="button" className="primary" onClick={onSave} disabled={saving}>
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </section>
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
            <label>
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
            const options = f.sourceKey ? (parents[f.sourceKey] || []) : (f.options || []);
            const valueKey = f.valueKey || f.key;
            const labelKey = f.labelKey || 'name';
            return (
              <label key={f.key}>
                <span>{f.label}</span>
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
