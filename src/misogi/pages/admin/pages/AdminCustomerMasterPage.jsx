import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import './admin-master.css';

function isLocalUiHost() {
  if (typeof window === 'undefined') return false;
  const h = String(window.location?.hostname || '').toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
}

const API_BASE =
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

function norm(v) {
  return String(v || '').trim();
}

function getItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

async function apiJson(path, options = {}) {
  const base = String(API_BASE || '').replace(/\/$/, '');
  const res = await fetch(`${base}${path}`, {
    method: options.method || 'GET',
    headers: {
      ...authHeaders(),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${path} (${res.status}) ${text}`);
  }
  return res.json().catch(() => ({}));
}

function rowSortKey(row) {
  return [
    norm(row.kokyaku_id),
    norm(row.torihikisaki_id),
    norm(row.yagou_id),
    norm(row.tenpo_id),
    norm(row.kokyaku_name),
    norm(row.torihikisaki_name),
    norm(row.yagou_name),
    norm(row.tenpo_name),
  ].join('\u0001').toLowerCase();
}

function parseLeadingNumber(text) {
  const m = String(text || '').match(/(\d+)/);
  if (!m) return Number.NaN;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : Number.NaN;
}

function compareIdYoungFirst(aId, bId, dir) {
  const an = parseLeadingNumber(aId);
  const bn = parseLeadingNumber(bId);
  if (Number.isFinite(an) && Number.isFinite(bn) && an !== bn) {
    return (an - bn) * dir;
  }
  return String(aId || '').localeCompare(String(bId || ''), 'ja', { numeric: true, sensitivity: 'base' }) * dir;
}

function toKokyakuId(rawId, fallbackId) {
  const direct = norm(rawId);
  if (direct) return direct;
  const fb = norm(fallbackId);
  if (!fb) return '';
  if (/^kokyaku#/i.test(fb)) return fb.replace(/^kokyaku#/i, 'KOKYAKU#');
  if (/^tori#/i.test(fb)) return fb.replace(/^tori#/i, 'KOKYAKU#');
  return `KOKYAKU#${fb}`;
}

function IdTag({ value, kind }) {
  const v = norm(value);
  if (!v) return null;
  return <span className={`admin-customer-master-id-tag kind-${kind || 'plain'}`}>{v}</span>;
}

export default function AdminCustomerMasterPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState('all');
  const [sortKey, setSortKey] = useState('kokyaku');
  const [sortOrder, setSortOrder] = useState('asc');
  const [rows, setRows] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState(() => new Set());
  const [editing, setEditing] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    setOk('');
    try {
      const [toriData, yagouData, tenpoData] = await Promise.all([
        apiJson('/master/torihikisaki?limit=5000&jotai=yuko'),
        apiJson('/master/yagou?limit=8000&jotai=yuko'),
        apiJson('/master/tenpo?limit=20000&jotai=yuko'),
      ]);
      const torihikisakiItems = getItems(toriData);
      const yagouItems = getItems(yagouData);
      const tenpoItems = getItems(tenpoData);

      const toriById = new Map();
      torihikisakiItems.forEach((it) => {
        const id = norm(it?.torihikisaki_id || it?.id);
        if (!id) return;
        toriById.set(id, it);
      });

      const yagouById = new Map();
      yagouItems.forEach((it) => {
        const id = norm(it?.yagou_id || it?.id);
        if (!id) return;
        yagouById.set(id, it);
      });

      const tenpoByYagou = new Map();
      const tenpoByTori = new Map();
      tenpoItems.forEach((it) => {
        const yid = norm(it?.yagou_id);
        const tid = norm(it?.torihikisaki_id);
        if (yid) tenpoByYagou.set(yid, (tenpoByYagou.get(yid) || 0) + 1);
        if (tid) tenpoByTori.set(tid, (tenpoByTori.get(tid) || 0) + 1);
      });

      const merged = [];
      tenpoItems.forEach((tenpo) => {
        const tenpoId = norm(tenpo?.tenpo_id || tenpo?.id);
        if (!tenpoId) return;
        const toriId = norm(tenpo?.torihikisaki_id);
        const yagouId = norm(tenpo?.yagou_id);
        const tori = toriById.get(toriId) || null;
        const yagou = yagouById.get(yagouId) || null;
        const kokyakuId = toKokyakuId(tori?.kokyaku_id || tenpo?.kokyaku_id, toriId);
        const kokyakuName = norm(tori?.kokyaku_name || tenpo?.kokyaku_name || tori?.name || tenpo?.torihikisaki_name);
        merged.push({
          kind: 'tenpo',
          key: `tenpo:${tenpoId}`,
          kokyaku_id: kokyakuId,
          kokyaku_name: kokyakuName,
          torihikisaki_id: toriId,
          torihikisaki_name: norm(tori?.name || tenpo?.torihikisaki_name),
          yagou_id: yagouId,
          yagou_name: norm(yagou?.name || tenpo?.yagou_name),
          tenpo_id: tenpoId,
          tenpo_name: norm(tenpo?.name),
          tenpo_address: norm(tenpo?.address),
          tenpo_phone: norm(tenpo?.phone),
          tenpo_url: norm(tenpo?.url),
          tenpo_tantou_name: norm(tenpo?.tantou_name),
          tenpo_email: norm(tenpo?.email),
        });
      });

      yagouItems.forEach((yagou) => {
        const yagouId = norm(yagou?.yagou_id || yagou?.id);
        if (!yagouId) return;
        if ((tenpoByYagou.get(yagouId) || 0) > 0) return;
        const toriId = norm(yagou?.torihikisaki_id);
        const tori = toriById.get(toriId) || null;
        const kokyakuId = toKokyakuId(tori?.kokyaku_id || yagou?.kokyaku_id, toriId);
        const kokyakuName = norm(tori?.kokyaku_name || yagou?.kokyaku_name || tori?.name);
        merged.push({
          kind: 'yagou',
          key: `yagou:${yagouId}`,
          kokyaku_id: kokyakuId,
          kokyaku_name: kokyakuName,
          torihikisaki_id: toriId,
          torihikisaki_name: norm(tori?.name),
          yagou_id: yagouId,
          yagou_name: norm(yagou?.name),
          tenpo_id: '',
          tenpo_name: '',
          tenpo_address: '',
          tenpo_phone: '',
          tenpo_url: '',
          tenpo_tantou_name: '',
          tenpo_email: '',
        });
      });

      torihikisakiItems.forEach((tori) => {
        const toriId = norm(tori?.torihikisaki_id || tori?.id);
        if (!toriId) return;
        const hasTenpo = (tenpoByTori.get(toriId) || 0) > 0;
        const hasYagou = yagouItems.some((y) => norm(y?.torihikisaki_id) === toriId);
        if (hasTenpo || hasYagou) return;
        const kokyakuId = toKokyakuId(tori?.kokyaku_id, toriId);
        const kokyakuName = norm(tori?.kokyaku_name || tori?.name);
        merged.push({
          kind: 'torihikisaki',
          key: `torihikisaki:${toriId}`,
          kokyaku_id: kokyakuId,
          kokyaku_name: kokyakuName,
          torihikisaki_id: toriId,
          torihikisaki_name: norm(tori?.name),
          yagou_id: '',
          yagou_name: '',
          tenpo_id: '',
          tenpo_name: '',
          tenpo_address: '',
          tenpo_phone: '',
          tenpo_url: '',
          tenpo_tantou_name: '',
          tenpo_email: '',
        });
      });

      merged.sort((a, b) => rowSortKey(a).localeCompare(rowSortKey(b), 'ja'));
      setRows(merged);
    } catch (e) {
      setError(e?.message || '顧客マスタの取得に失敗しました');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const filteredRows = useMemo(() => {
    const q = norm(query).toLowerCase();
    if (!q) return rows;
    const tokens = q.split(/\s+/).filter(Boolean);
    return rows.filter((row) => {
      const blob = [
        row.kokyaku_name,
        row.kokyaku_id,
        row.torihikisaki_name,
        row.torihikisaki_id,
        row.yagou_name,
        row.yagou_id,
        row.tenpo_name,
        row.tenpo_id,
        row.tenpo_address,
        row.tenpo_phone,
      ].join(' ').toLowerCase();
      return tokens.every((t) => blob.includes(t));
    });
  }, [rows, query]);

  const rowQuality = useMemo(() => {
    const toriNameCount = new Map();
    const yagouNameCount = new Map();
    const tenpoNameCount = new Map();

    const inc = (map, key) => {
      if (!key) return;
      map.set(key, (map.get(key) || 0) + 1);
    };
    rows.forEach((row) => {
      const toriNameKey = norm(row.torihikisaki_name).toLowerCase();
      const yagouNameKey = `${norm(row.torihikisaki_id).toLowerCase()}|${norm(row.yagou_name).toLowerCase()}`;
      const tenpoNameKey = `${norm(row.torihikisaki_id).toLowerCase()}|${norm(row.yagou_id).toLowerCase()}|${norm(row.tenpo_name).toLowerCase()}`;
      inc(toriNameCount, toriNameKey);
      inc(yagouNameCount, yagouNameKey);
      inc(tenpoNameCount, tenpoNameKey);
    });

    const byKey = new Map();
    rows.forEach((row) => {
      const toriNameKey = norm(row.torihikisaki_name).toLowerCase();
      const yagouNameKey = `${norm(row.torihikisaki_id).toLowerCase()}|${norm(row.yagou_name).toLowerCase()}`;
      const tenpoNameKey = `${norm(row.torihikisaki_id).toLowerCase()}|${norm(row.yagou_id).toLowerCase()}|${norm(row.tenpo_name).toLowerCase()}`;
      const hasLinkGap =
        !norm(row.kokyaku_id) ||
        (row.kind !== 'torihikisaki' && !norm(row.torihikisaki_id)) ||
        (row.kind === 'tenpo' && !norm(row.yagou_id));
      const isDuplicate =
        (norm(row.torihikisaki_name) && (toriNameCount.get(toriNameKey) || 0) > 1) ||
        (norm(row.yagou_name) && (yagouNameCount.get(yagouNameKey) || 0) > 1) ||
        (norm(row.tenpo_name) && (tenpoNameCount.get(tenpoNameKey) || 0) > 1);
      byKey.set(row.key, { hasLinkGap, isDuplicate });
    });
    return byKey;
  }, [rows]);

  const viewFilteredRows = useMemo(() => {
    if (viewMode === 'gap') {
      return filteredRows.filter((row) => rowQuality.get(row.key)?.hasLinkGap);
    }
    if (viewMode === 'duplicate') {
      return filteredRows.filter((row) => rowQuality.get(row.key)?.isDuplicate);
    }
    return filteredRows;
  }, [filteredRows, rowQuality, viewMode]);

  const handleSort = useCallback((nextKey) => {
    setSortKey((prevKey) => {
      if (prevKey === nextKey) {
        setSortOrder((prevOrder) => (prevOrder === 'asc' ? 'desc' : 'asc'));
        return prevKey;
      }
      setSortOrder('asc');
      return nextKey;
    });
  }, []);

  const sortedRows = useMemo(() => {
    const dir = sortOrder === 'asc' ? 1 : -1;
    const idFieldBySortKey = {
      kokyaku: 'kokyaku_id',
      torihikisaki: 'torihikisaki_id',
      yagou: 'yagou_id',
      tenpo: 'tenpo_id',
    };
    const nameFieldBySortKey = {
      kokyaku: 'kokyaku_name',
      torihikisaki: 'torihikisaki_name',
      yagou: 'yagou_name',
      tenpo: 'tenpo_name',
    };

    const getSortValue = (row) => {
      const quality = rowQuality.get(row.key) || {};
      switch (sortKey) {
        case 'kokyaku':
          return `${norm(row.kokyaku_name)} ${norm(row.kokyaku_id)}`;
        case 'torihikisaki':
          return `${norm(row.torihikisaki_name)} ${norm(row.torihikisaki_id)}`;
        case 'yagou':
          return `${norm(row.yagou_name)} ${norm(row.yagou_id)}`;
        case 'tenpo':
          return `${norm(row.tenpo_name)} ${norm(row.tenpo_id)}`;
        case 'phone':
          return norm(row.tenpo_phone);
        case 'status':
          if (quality.hasLinkGap) return '1-未紐付けあり';
          if (quality.isDuplicate) return '2-重複候補';
          return '3-正常';
        case 'default':
        default:
          return rowSortKey(row);
      }
    };

    return [...viewFilteredRows].sort((a, b) => {
      const idField = idFieldBySortKey[sortKey];
      if (idField) {
        const idCmp = compareIdYoungFirst(norm(a[idField]), norm(b[idField]), dir);
        if (idCmp !== 0) return idCmp;
        const nameField = nameFieldBySortKey[sortKey];
        if (nameField) {
          const nameCmp = String(norm(a[nameField])).localeCompare(String(norm(b[nameField])), 'ja', { numeric: true, sensitivity: 'base' });
          if (nameCmp !== 0) return nameCmp * dir;
        }
      }

      const av = getSortValue(a);
      const bv = getSortValue(b);
      const cmp = String(av).localeCompare(String(bv), 'ja', { numeric: true, sensitivity: 'base' });
      if (cmp !== 0) return cmp * dir;
      return rowSortKey(a).localeCompare(rowSortKey(b), 'ja') * dir;
    });
  }, [rowQuality, sortKey, sortOrder, viewFilteredRows]);

  const sortMark = useCallback((key) => {
    if (sortKey !== key) return '↕';
    return sortOrder === 'asc' ? '↑' : '↓';
  }, [sortKey, sortOrder]);

  useEffect(() => {
    setSelectedKeys((prev) => {
      if (!prev.size) return prev;
      const visible = new Set(sortedRows.map((r) => r.key));
      const next = new Set();
      prev.forEach((k) => {
        if (visible.has(k)) next.add(k);
      });
      if (next.size === prev.size) return prev;
      return next;
    });
  }, [sortedRows]);

  const allVisibleSelected = useMemo(
    () => sortedRows.length > 0 && sortedRows.every((r) => selectedKeys.has(r.key)),
    [sortedRows, selectedKeys]
  );

  const selectedRows = useMemo(() => {
    if (!selectedKeys.size) return [];
    return sortedRows.filter((r) => selectedKeys.has(r.key));
  }, [sortedRows, selectedKeys]);

  const toggleAllVisible = useCallback((checked) => {
    if (checked) {
      setSelectedKeys(new Set(sortedRows.map((r) => r.key)));
      return;
    }
    setSelectedKeys(new Set());
  }, [sortedRows]);

  const toggleRowSelected = useCallback((key, checked) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const openEdit = useCallback((row) => {
    setError('');
    setOk('');
    setEditing({
      ...row,
      _manualInput: false,
      _origin: { ...row },
    });
  }, []);

  const closeEdit = useCallback(() => {
    if (saving) return;
    setEditing(null);
  }, [saving]);

  const torihikisakiOptions = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      const id = norm(row.torihikisaki_id);
      if (!id) return;
      if (!map.has(id)) {
        map.set(id, {
          id,
          name: norm(row.torihikisaki_name),
          kokyaku_id: norm(row.kokyaku_id),
          kokyaku_name: norm(row.kokyaku_name),
        });
      }
    });
    return [...map.values()].sort((a, b) => compareIdYoungFirst(a.id, b.id, 1));
  }, [rows]);

  const torihikisakiById = useMemo(
    () => new Map(torihikisakiOptions.map((it) => [it.id, it])),
    [torihikisakiOptions]
  );

  const yagouOptions = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      const id = norm(row.yagou_id);
      if (!id) return;
      if (!map.has(id)) {
        map.set(id, {
          id,
          name: norm(row.yagou_name),
          torihikisaki_id: norm(row.torihikisaki_id),
        });
      }
    });
    return [...map.values()].sort((a, b) => compareIdYoungFirst(a.id, b.id, 1));
  }, [rows]);

  const yagouById = useMemo(
    () => new Map(yagouOptions.map((it) => [it.id, it])),
    [yagouOptions]
  );

  const saveEdit = useCallback(async () => {
    if (!editing) return;
    const origin = editing._origin || {};
    const actor = norm(
      JSON.parse(localStorage.getItem('misesapo_auth') || '{}')?.name ||
      JSON.parse(localStorage.getItem('misesapo_auth') || '{}')?.email ||
      'unknown'
    );
    const changed = (k) => norm(editing[k]) !== norm(origin[k]);

    setSaving(true);
    setError('');
    setOk('');
    try {
      if (norm(editing.torihikisaki_id)) {
        const patch = {};
        if (changed('kokyaku_id')) patch.kokyaku_id = norm(editing.kokyaku_id);
        if (changed('kokyaku_name')) patch.kokyaku_name = norm(editing.kokyaku_name);
        if (changed('torihikisaki_name')) patch.name = norm(editing.torihikisaki_name);
        if (Object.keys(patch).length) {
          await apiJson(`/master/torihikisaki/${encodeURIComponent(editing.torihikisaki_id)}`, {
            method: 'PUT',
            body: { ...patch, updated_by: actor },
          });
        }
      }

      if (norm(editing.yagou_id)) {
        const patch = {};
        if (changed('yagou_name')) patch.name = norm(editing.yagou_name);
        if (norm(editing.torihikisaki_id) && changed('torihikisaki_id')) patch.torihikisaki_id = norm(editing.torihikisaki_id);
        if (Object.keys(patch).length) {
          await apiJson(`/master/yagou/${encodeURIComponent(editing.yagou_id)}`, {
            method: 'PUT',
            body: { ...patch, updated_by: actor },
          });
        }
      }

      if (norm(editing.tenpo_id)) {
        const patch = {};
        if (changed('tenpo_name')) patch.name = norm(editing.tenpo_name);
        if (changed('tenpo_address')) patch.address = norm(editing.tenpo_address);
        if (changed('tenpo_phone')) patch.phone = norm(editing.tenpo_phone);
        if (changed('tenpo_tantou_name')) patch.tantou_name = norm(editing.tenpo_tantou_name);
        if (changed('tenpo_email')) patch.email = norm(editing.tenpo_email);
        if (changed('torihikisaki_id')) patch.torihikisaki_id = norm(editing.torihikisaki_id);
        if (changed('yagou_id')) patch.yagou_id = norm(editing.yagou_id);
        if (Object.keys(patch).length) {
          await apiJson(`/master/tenpo/${encodeURIComponent(editing.tenpo_id)}`, {
            method: 'PUT',
            body: { ...patch, updated_by: actor },
          });
        }
      }

      setOk('顧客マスタを保存しました');
      setEditing(null);
      await loadAll();
    } catch (e) {
      setError(e?.message || '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }, [editing, loadAll]);

  const deleteSelected = useCallback(async () => {
    if (saving || selectedRows.length === 0) return;
    const okDelete = window.confirm(`選択した ${selectedRows.length} 件を削除しますか？\nこの操作は取り消せません。`);
    if (!okDelete) return;

    setSaving(true);
    setError('');
    setOk('');
    try {
      let count = 0;
      for (const row of selectedRows) {
        if (row.kind === 'tenpo' && norm(row.tenpo_id)) {
          await apiJson(`/master/tenpo/${encodeURIComponent(row.tenpo_id)}`, { method: 'DELETE' });
          count += 1;
          continue;
        }
        if (row.kind === 'yagou' && norm(row.yagou_id)) {
          await apiJson(`/master/yagou/${encodeURIComponent(row.yagou_id)}`, { method: 'DELETE' });
          count += 1;
          continue;
        }
        if (row.kind === 'torihikisaki' && norm(row.torihikisaki_id)) {
          await apiJson(`/master/torihikisaki/${encodeURIComponent(row.torihikisaki_id)}`, { method: 'DELETE' });
          count += 1;
        }
      }
      setSelectedKeys(new Set());
      setOk(`${count}件を削除しました`);
      await loadAll();
    } catch (e) {
      setError(e?.message || '削除に失敗しました');
    } finally {
      setSaving(false);
    }
  }, [saving, selectedRows, loadAll]);

  const onTorihikisakiChange = useCallback((nextId) => {
    setEditing((prev) => {
      if (!prev) return prev;
      const picked = torihikisakiById.get(norm(nextId));
      return {
        ...prev,
        torihikisaki_id: norm(nextId),
        torihikisaki_name: picked?.name || '',
        kokyaku_id: picked?.kokyaku_id || prev.kokyaku_id || '',
        kokyaku_name: picked?.kokyaku_name || prev.kokyaku_name || '',
      };
    });
  }, [torihikisakiById]);

  const onYagouChange = useCallback((nextId) => {
    setEditing((prev) => {
      if (!prev) return prev;
      const picked = yagouById.get(norm(nextId));
      if (!picked) {
        return {
          ...prev,
          yagou_id: '',
          yagou_name: '',
        };
      }
      const linkedTori = torihikisakiById.get(picked.torihikisaki_id);
      return {
        ...prev,
        yagou_id: picked.id,
        yagou_name: picked.name || '',
        torihikisaki_id: picked.torihikisaki_id || prev.torihikisaki_id || '',
        torihikisaki_name: linkedTori?.name || prev.torihikisaki_name || '',
        kokyaku_id: linkedTori?.kokyaku_id || prev.kokyaku_id || '',
        kokyaku_name: linkedTori?.kokyaku_name || prev.kokyaku_name || '',
      };
    });
  }, [torihikisakiById, yagouById]);

  return (
    <div className="admin-master-page admin-customer-master-page">
      <div className="admin-master-content">
        <header className="admin-master-header">
          <div>
            <h1>顧客マスタ</h1>
            <p className="admin-master-subtitle">kokyaku / torihikisaki / yagou / tenpo を1画面で修正・保存</p>
          </div>
          <div className="admin-master-header-actions">
            <Link to="/admin/torihikisaki-touroku" className="admin-master-header-tab">新規追加</Link>
            <button type="button" onClick={loadAll} disabled={loading}>{loading ? '更新中...' : '更新'}</button>
          </div>
        </header>

        {error ? <div className="admin-master-error">{error}</div> : null}
        {ok ? <div className="admin-master-success">{ok}</div> : null}

        <section className="admin-master-toolbar admin-customer-master-toolbar">
          <label className="admin-customer-master-search">
            <span>統合検索</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="顧客 / 取引先 / 屋号 / 店舗 / ID / 住所 / 電話"
            />
          </label>
          <div className="admin-master-header-actions">
            <button type="button" className={viewMode === 'all' ? 'primary' : ''} onClick={() => setViewMode('all')}>
              全件
            </button>
            <button type="button" className={viewMode === 'gap' ? 'primary' : ''} onClick={() => setViewMode('gap')}>
              未紐付け
            </button>
            <button type="button" className={viewMode === 'duplicate' ? 'primary' : ''} onClick={() => setViewMode('duplicate')}>
              重複候補
            </button>
            <button
              type="button"
              className="danger"
              onClick={deleteSelected}
              disabled={saving || selectedRows.length === 0}
            >
              {saving ? '処理中...' : '削除'}
            </button>
          </div>
          <div className="admin-master-count">表示件数: {sortedRows.length} / 選択: {selectedRows.length} / 全体: {rows.length}</div>
        </section>

        <section className="admin-master-table-wrap">
          <table className="admin-master-table">
            <thead>
              <tr>
                <th className="bulk-check-col">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(e) => toggleAllVisible(e.target.checked)}
                    aria-label="全件選択"
                  />
                </th>
                <th>
                  <button type="button" className={`admin-master-sort-btn${sortKey === 'kokyaku' ? ' is-active' : ''}`} onClick={() => handleSort('kokyaku')}>
                    顧客(kokyaku)
                    <span className="sort-indicator">{sortMark('kokyaku')}</span>
                  </button>
                </th>
                <th>
                  <button type="button" className={`admin-master-sort-btn${sortKey === 'torihikisaki' ? ' is-active' : ''}`} onClick={() => handleSort('torihikisaki')}>
                    取引先
                    <span className="sort-indicator">{sortMark('torihikisaki')}</span>
                  </button>
                </th>
                <th>
                  <button type="button" className={`admin-master-sort-btn${sortKey === 'yagou' ? ' is-active' : ''}`} onClick={() => handleSort('yagou')}>
                    屋号
                    <span className="sort-indicator">{sortMark('yagou')}</span>
                  </button>
                </th>
                <th>
                  <button type="button" className={`admin-master-sort-btn${sortKey === 'tenpo' ? ' is-active' : ''}`} onClick={() => handleSort('tenpo')}>
                    店舗
                    <span className="sort-indicator">{sortMark('tenpo')}</span>
                  </button>
                </th>
                <th>
                  <button type="button" className={`admin-master-sort-btn${sortKey === 'phone' ? ' is-active' : ''}`} onClick={() => handleSort('phone')}>
                    電話
                    <span className="sort-indicator">{sortMark('phone')}</span>
                  </button>
                </th>
                <th>
                  <button type="button" className={`admin-master-sort-btn${sortKey === 'status' ? ' is-active' : ''}`} onClick={() => handleSort('status')}>
                    状態
                    <span className="sort-indicator">{sortMark('status')}</span>
                  </button>
                </th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 && !loading ? (
                <tr>
                  <td colSpan={8} className="empty">データがありません</td>
                </tr>
              ) : null}
              {sortedRows.map((row) => (
                <tr key={row.key}>
                  <td className="bulk-check-col" data-col="選択">
                    <input
                      type="checkbox"
                      checked={selectedKeys.has(row.key)}
                      onChange={(e) => toggleRowSelected(row.key, e.target.checked)}
                      aria-label={`${row.tenpo_name || row.yagou_name || row.torihikisaki_name || row.key} を選択`}
                    />
                  </td>
                  <td data-col="顧客(kokyaku)">
                    <div>{row.kokyaku_name || ''}</div>
                    <IdTag value={row.kokyaku_id} kind="kokyaku" />
                  </td>
                  <td data-col="取引先">
                    <div>{row.torihikisaki_name || ''}</div>
                    <IdTag value={row.torihikisaki_id} kind="torihikisaki" />
                  </td>
                  <td data-col="屋号">
                    <div>{row.yagou_name || ''}</div>
                    <IdTag value={row.yagou_id} kind="yagou" />
                  </td>
                  <td data-col="店舗">
                    <div>{row.tenpo_name || ''}</div>
                    <IdTag value={row.tenpo_id} kind="tenpo" />
                  </td>
                  <td data-col="電話">{row.tenpo_phone || ''}</td>
                  <td data-col="状態">
                    {rowQuality.get(row.key)?.hasLinkGap ? <small>未紐付けあり</small> : null}
                    {rowQuality.get(row.key)?.isDuplicate ? <small>重複候補</small> : null}
                    {!rowQuality.get(row.key)?.hasLinkGap && !rowQuality.get(row.key)?.isDuplicate ? <small>正常</small> : null}
                  </td>
                  <td className="actions" data-col="操作">
                    <button type="button" onClick={() => openEdit(row)}>編集</button>
                    {row.tenpo_id ? (
                      <Link to={`/admin/tenpo/${encodeURIComponent(row.tenpo_id)}?mode=monshin`} className="link">カルテ</Link>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      {editing ? (
        <>
          <div className="admin-master-modal-backdrop" onClick={closeEdit} />
          <section className="admin-master-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="admin-master-inline-editor-title">顧客マスタ編集</h2>
            <label className="admin-master-field" style={{ marginBottom: 10 }}>
              <span>入力モード</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={Boolean(editing._manualInput)}
                  onChange={(e) => setEditing((p) => ({ ...p, _manualInput: e.target.checked }))}
                />
                <small>自由入力を許可（通常はOFF推奨）</small>
              </div>
            </label>
            <div className="admin-master-modal-grid">
              <label className="admin-master-field">
                <span>顧客ID(kokyaku)</span>
                <input
                  value={editing.kokyaku_id || ''}
                  readOnly={!editing._manualInput}
                  onChange={(e) => setEditing((p) => ({ ...p, kokyaku_id: e.target.value }))}
                />
              </label>
              <label className="admin-master-field">
                <span>顧客名(kokyaku)</span>
                <input
                  value={editing.kokyaku_name || ''}
                  readOnly={!editing._manualInput && editing.kind !== 'torihikisaki'}
                  onChange={(e) => setEditing((p) => ({ ...p, kokyaku_name: e.target.value }))}
                />
              </label>
              <label className="admin-master-field">
                <span>取引先ID</span>
                {editing._manualInput ? (
                  <input
                    value={editing.torihikisaki_id || ''}
                    onChange={(e) => setEditing((p) => ({ ...p, torihikisaki_id: e.target.value }))}
                  />
                ) : (
                  <select
                    value={editing.torihikisaki_id || ''}
                    disabled={editing.kind === 'torihikisaki'}
                    onChange={(e) => onTorihikisakiChange(e.target.value)}
                  >
                    <option value="">未選択</option>
                    {torihikisakiOptions.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.id} / {it.name || '(名称未設定)'}
                      </option>
                    ))}
                  </select>
                )}
              </label>
              <label className="admin-master-field">
                <span>取引先名</span>
                <input
                  value={editing.torihikisaki_name || ''}
                  readOnly={!editing._manualInput && editing.kind !== 'torihikisaki'}
                  onChange={(e) => setEditing((p) => ({ ...p, torihikisaki_name: e.target.value }))}
                />
              </label>
              <label className="admin-master-field">
                <span>屋号ID</span>
                {editing._manualInput ? (
                  <input
                    value={editing.yagou_id || ''}
                    onChange={(e) => setEditing((p) => ({ ...p, yagou_id: e.target.value }))}
                  />
                ) : (
                  <select
                    value={editing.yagou_id || ''}
                    disabled={editing.kind !== 'tenpo'}
                    onChange={(e) => onYagouChange(e.target.value)}
                  >
                    <option value="">未選択</option>
                    {yagouOptions
                      .filter((it) => !norm(editing.torihikisaki_id) || norm(it.torihikisaki_id) === norm(editing.torihikisaki_id))
                      .map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.id} / {it.name || '(名称未設定)'}
                        </option>
                      ))}
                  </select>
                )}
              </label>
              <label className="admin-master-field">
                <span>屋号名</span>
                <input
                  value={editing.yagou_name || ''}
                  readOnly={!editing._manualInput && editing.kind !== 'yagou'}
                  onChange={(e) => setEditing((p) => ({ ...p, yagou_name: e.target.value }))}
                />
              </label>
              <label className="admin-master-field">
                <span>店舗ID</span>
                <input value={editing.tenpo_id || ''} readOnly />
              </label>
              <label className="admin-master-field">
                <span>店舗名</span>
                <input value={editing.tenpo_name || ''} onChange={(e) => setEditing((p) => ({ ...p, tenpo_name: e.target.value }))} />
              </label>
              <label className="admin-master-field">
                <span>住所</span>
                <input value={editing.tenpo_address || ''} onChange={(e) => setEditing((p) => ({ ...p, tenpo_address: e.target.value }))} />
              </label>
              <label className="admin-master-field">
                <span>電話</span>
                <input value={editing.tenpo_phone || ''} onChange={(e) => setEditing((p) => ({ ...p, tenpo_phone: e.target.value }))} />
              </label>
              <label className="admin-master-field">
                <span>担当者</span>
                <input value={editing.tenpo_tantou_name || ''} onChange={(e) => setEditing((p) => ({ ...p, tenpo_tantou_name: e.target.value }))} />
              </label>
              <label className="admin-master-field">
                <span>メール</span>
                <input value={editing.tenpo_email || ''} onChange={(e) => setEditing((p) => ({ ...p, tenpo_email: e.target.value }))} />
              </label>
            </div>
            <div className="admin-master-modal-actions">
              <button type="button" onClick={closeEdit} disabled={saving}>キャンセル</button>
              <button type="button" className="primary" onClick={saveEdit} disabled={saving}>
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
