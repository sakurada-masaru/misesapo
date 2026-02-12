import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import './admin-master.css';

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
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });
  return res;
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
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
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
  parentSources = {},
  onAfterSave,
  localSearch = null,
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
    const next = {};
    await Promise.all(
      Object.entries(parentSources).map(async ([key, source]) => {
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
      // 一覧はまず 200 件に抑え、必要ならフィルタで絞る運用にする。
      const query = toQuery({ limit: 200, ...filtersValue });
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
  }, [resource, filtersValue, apiBase, buildResourcePath]);

  useEffect(() => {
    loadParents();
  }, [loadParents]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const openCreate = useCallback(() => {
    const initial = { jotai: 'yuko' };
    fields.forEach((f) => {
      if (f.defaultValue !== undefined) initial[f.key] = f.defaultValue;
      else if (initial[f.key] === undefined) initial[f.key] = '';
    });
    setEditing(initial);
    setModalOpen(true);
  }, [fields]);

  const openEdit = useCallback((row) => {
    const model = { ...row };
    if (!model.jotai) model.jotai = 'yuko';
    setEditing(model);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditing(null);
  }, []);

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
    const rowId = pickId(row, idKey);
    if (!rowId) return;
    setDeleteTarget(row);
  }, [idKey]);

  const closeDeleteConfirm = useCallback(() => {
    if (deleting) return;
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

  const columns = useMemo(() => {
    return [
      { key: idKey, label: 'ID' },
      ...fields.map((f) => ({ key: f.key, label: f.label })),
      { key: 'jotai', label: '状態' },
    ];
  }, [fields, idKey]);

  const visibleItems = useMemo(() => {
    const q = String(searchText || '').trim().toLowerCase();
    if (!q || !localSearch?.keys?.length) return items;
    return items.filter((row) =>
      localSearch.keys.some((k) => String(row?.[k] ?? '').toLowerCase().includes(q))
    );
  }, [items, searchText, localSearch]);

  return (
    <div className="admin-master-page">
      <div className="admin-master-content">
        <header className="admin-master-header">
          <Link to="/admin/entrance" className="admin-master-back">← 管理トップ</Link>
          <h1>{title}</h1>
          <div className="admin-master-header-actions">
            <button onClick={openCreate} className="primary">新規登録</button>
            <button onClick={loadItems} disabled={loading}>{loading ? '更新中...' : '更新'}</button>
          </div>
        </header>

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
                    const v = opt?.[valueKey] || opt?.id || '';
                    const l = opt?.[labelKey] || v;
                    if (!v) return null;
                    return <option key={v} value={v}>{l}</option>;
                  })}
                </select>
              </label>
            );
          })}
        </section>

        {error && <div className="admin-master-error">{error}</div>}

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
                    {columns.map((c) => <td key={`${rid}-${c.key}`}>{formatCellValue(row?.[c.key])}</td>)}
                    <td className="actions">
                      <button onClick={() => openEdit(row)}>編集</button>
                      <button className="danger" onClick={() => onDelete(row)}>取消</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>

      {modalOpen && editing && (
        <div className="admin-master-modal-backdrop" onClick={closeModal}>
          <div className="admin-master-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{pickId(editing, idKey) ? '編集' : '新規登録'}</h2>
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
                        onChange={(e) => setEditing((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      >
                        <option value="">選択してください</option>
                        {options.map((opt) => {
                          const v = opt?.[valueKey] || opt?.id || '';
                          const l = opt?.[labelKey] || v;
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
                      onChange={(e) => setEditing((prev) => ({ ...prev, [f.key]: e.target.value }))}
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
            <div className="admin-master-modal-actions">
              <button onClick={closeModal}>キャンセル</button>
              <button className="primary" onClick={onSave} disabled={saving}>{saving ? '保存中...' : '保存'}</button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="admin-master-modal-backdrop" onClick={closeDeleteConfirm}>
          <div className="admin-master-modal" onClick={(e) => e.stopPropagation()}>
            <h2>取り消し確認</h2>
            <p style={{ marginTop: 0, color: '#cbd5e1' }}>
              このデータを取り消し（`torikeshi`）にします。よろしいですか？
            </p>
            <div style={{ marginBottom: 12, padding: 10, border: '1px solid #273049', borderRadius: 8, background: '#0b1220' }}>
              <div style={{ color: '#9aa6c5', fontSize: 12 }}>対象ID</div>
              <div>{pickId(deleteTarget, idKey)}</div>
              {deleteTarget?.name ? (
                <>
                  <div style={{ color: '#9aa6c5', fontSize: 12, marginTop: 6 }}>名称</div>
                  <div>{deleteTarget.name}</div>
                </>
              ) : null}
            </div>
            <div className="admin-master-modal-actions">
              <button onClick={closeDeleteConfirm} disabled={deleting}>キャンセル</button>
              <button className="primary" onClick={confirmDelete} disabled={deleting}>
                {deleting ? '取り消し中...' : '取り消す'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
