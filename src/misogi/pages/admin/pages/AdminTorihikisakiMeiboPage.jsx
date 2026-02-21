import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
// Hamburger / admin-top are provided by GlobalNav.
import './admin-torihikisaki-meibo.css';
import { matchAllTokens, normalizeForSearch } from '../../shared/utils/search';

function isLocalUiHost() {
  if (typeof window === 'undefined') return false;
  const h = window.location?.hostname || '';
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
}

const MASTER_API_BASE =
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

async function fetchMaster(collection, { limit = 3000 } = {}) {
  const base = MASTER_API_BASE.replace(/\/$/, '');
  const qs = new URLSearchParams({ limit: String(limit), jotai: 'yuko' }).toString();
  const res = await fetch(`${base}/master/${encodeURIComponent(collection)}?${qs}`, {
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${collection} HTTP ${res.status} ${text}`.trim());
  }
  const data = await res.json();
  return Array.isArray(data) ? data : (data?.items || []);
}

async function fetchMasterWithQuery(collection, query = {}) {
  const base = MASTER_API_BASE.replace(/\/$/, '');
  const qs = new URLSearchParams({
    limit: String(query.limit ?? 200),
    jotai: String(query.jotai ?? 'yuko'),
    ...(query || {}),
  });
  const res = await fetch(`${base}/master/${encodeURIComponent(collection)}?${qs.toString()}`, {
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${collection} HTTP ${res.status} ${text}`.trim());
  }
  const data = await res.json();
  return Array.isArray(data) ? data : (data?.items || []);
}

function normStr(v) {
  return String(v || '').trim();
}

function tenpoAddress(tp) {
  return (
    tp?.address ||
    tp?.jusho ||
    tp?.location ||
    tp?.addr ||
    ''
  );
}

function tenpoPhone(tp) {
  return (
    tp?.phone ||
    tp?.tel ||
    tp?.telephone ||
    ''
  );
}

export default function AdminTorihikisakiMeiboPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchTorihikisakis, setSearchTorihikisakis] = useState([]);
  const [searchYagous, setSearchYagous] = useState([]);
  const [searchTenpos, setSearchTenpos] = useState([]);
  const [searchCorpusReady, setSearchCorpusReady] = useState(false);
  const [torihikisakis, setTorihikisakis] = useState([]);
  const [yagous, setYagous] = useState([]);
  const [tenpos, setTenpos] = useState([]);
  const [selectedTorihikisakiId, setSelectedTorihikisakiId] = useState('');
  const [bulkSelectedTorihikisakiIds, setBulkSelectedTorihikisakiIds] = useState([]);
  const [showTorikeshiOverlay, setShowTorikeshiOverlay] = useState(false);
  const [torikeshiSubmitting, setTorikeshiSubmitting] = useState(false);

  // NOTE: 取引先一覧は「初回/手動更新」のみでロードする。
  // selectedTorihikisakiId を依存に入れると、クリックのたびに再ロード→子データが空に戻るフラッシュが起きる。
  const loadTorihikisakiOnly = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // DynamoDB の scan は重いので「まず取引先だけ」取得し、選択後に子を絞り込んで取得する。
      // master API の Lambda timeout が短い環境があるため、まずは小さめに取得する。
      const t = await fetchMasterWithQuery('torihikisaki', { limit: 200 });
      setTorihikisakis(t);
    } catch (e) {
      setError(e?.message || '読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTorihikisakiOnly();
  }, [loadTorihikisakiOnly]);

  const loadSearchCorpus = useCallback(async () => {
    if (searchLoading || searchCorpusReady) return;
    setSearchLoading(true);
    try {
      const [allTori, allYagou, allTenpo] = await Promise.all([
        fetchMaster('torihikisaki', { limit: 3000 }),
        fetchMaster('yagou', { limit: 8000 }),
        fetchMaster('tenpo', { limit: 20000 }),
      ]);
      // Search corpus is for cross-entity lookup (integrated search).
      // Keep NFKC/whitespace-insensitive string for robust matching.
      const toriNameById = new Map();
      allTori.forEach((it) => {
        const id = it?.torihikisaki_id || it?.id || '';
        if (!id) return;
        toriNameById.set(id, it?.name || '');
      });

      const yagouNameById = new Map();
      allYagou.forEach((it) => {
        const id = it?.yagou_id || it?.id || '';
        if (!id) return;
        yagouNameById.set(id, it?.name || '');
      });

      const toriNorm = allTori.map((it) => {
        const id = it?.torihikisaki_id || it?.id || '';
        const name = it?.name || '';
        const blob = [name, id].filter(Boolean).join(' ');
        return { ...it, _search_norm: normalizeForSearch(blob) };
      });
      const yagouNorm = allYagou.map((it) => {
        const id = it?.yagou_id || it?.id || '';
        const name = it?.name || '';
        const tid = it?.torihikisaki_id || '';
        const tName = toriNameById.get(tid) || '';
        const blob = [name, id, tid, tName].filter(Boolean).join(' ');
        return { ...it, _search_norm: normalizeForSearch(blob) };
      });
      const tenpoNorm = allTenpo.map((it) => {
        const id = it?.tenpo_id || it?.id || '';
        const name = it?.name || '';
        const tid = it?.torihikisaki_id || '';
        const yid = it?.yagou_id || '';
        const tName = toriNameById.get(tid) || '';
        const yName = yagouNameById.get(yid) || '';
        const addr = tenpoAddress(it);
        const phone = tenpoPhone(it);
        const mapUrl = it?.google_map_url || it?.map_url || it?.url || '';
        // Important: include torihikisaki/yagou NAMES so "屋号検索" yields stores list.
        const blob = [name, id, yName, yid, tName, tid, addr, phone, mapUrl].filter(Boolean).join(' ');
        return { ...it, _search_norm: normalizeForSearch(blob) };
      });
      setSearchTorihikisakis(toriNorm);
      setSearchYagous(yagouNorm);
      setSearchTenpos(tenpoNorm);
      setSearchCorpusReady(true);
    } catch (e) {
      setError(e?.message || '検索インデックスの読み込みに失敗しました');
    } finally {
      setSearchLoading(false);
    }
  }, [searchLoading, searchCorpusReady]);

  useEffect(() => {
    if (!normStr(q)) return;
    loadSearchCorpus();
  }, [q, loadSearchCorpus]);

  // 右ペイン全件表示のため、検索インデックスは初回から読み込んでおく。
  useEffect(() => {
    loadSearchCorpus();
  }, [loadSearchCorpus]);

  const loadChildren = useCallback(async (torihikisakiId) => {
    if (!torihikisakiId) return;
    setLoading(true);
    setError('');
    try {
      const y = await fetchMasterWithQuery('yagou', {
        // master API は scan+filter なので、評価件数が小さいと当たりに届かず 0 件になりうる。
        // UI側は十分大きめに取り、表示はローカルで絞る（運用が重くなったら API を Query 化する）。
        limit: 5000,
        torihikisaki_id: torihikisakiId,
      });
      setYagous(y);

      // tenpo は torihikisaki_id + yagou_id が必須（API側の REQUIRED_PARENT_KEYS）。
      // そのため yagou ごとに絞り込み取得し、フロントで結合する。
      const tenpoChunks = await Promise.all(
        y.map(async (it) => {
          const yagouId = it?.yagou_id || it?.id || '';
          if (!yagouId) return [];
          return fetchMasterWithQuery('tenpo', {
            limit: 5000,
            torihikisaki_id: torihikisakiId,
            yagou_id: yagouId,
          });
        })
      );
      setTenpos(tenpoChunks.flat());
    } catch (e) {
      setError(e?.message || '読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  // 選択取引先が変わったら子（屋号/店舗）を再ロード
  useEffect(() => {
    if (!selectedTorihikisakiId) return;
    loadChildren(selectedTorihikisakiId);
  }, [selectedTorihikisakiId, loadChildren]);

  const putTorihikisakiTorikeshi = useCallback(async (item) => {
    const id = item?.torihikisaki_id || item?.id;
    if (!id) throw new Error('torihikisaki_id が不正です');
    const base = MASTER_API_BASE.replace(/\/$/, '');
    const res = await fetch(`${base}/master/torihikisaki/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify({ ...(item || {}), torihikisaki_id: id, jotai: 'torikeshi' }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`torihikisaki 取消 failed: HTTP ${res.status} ${text}`.trim());
    }
    return res.json().catch(() => ({}));
  }, []);

  const torihikisakiById = useMemo(() => {
    const merged = new Map();
    // 検索時は全件インデックス側にも同一IDが存在するため、まず検索側を入れる。
    // その後、実データ（一覧API取得分）で上書きして詳細情報を優先する。
    searchTorihikisakis.forEach((it) => {
      const id = it?.torihikisaki_id || it?.id;
      if (!id) return;
      merged.set(id, it);
    });
    torihikisakis.forEach((it) => {
      const id = it?.torihikisaki_id || it?.id;
      if (!id) return;
      merged.set(id, it);
    });

    const m = new Map();
    merged.forEach((it, id) => {
      if (!id) return;
      m.set(id, it);
    });
    return m;
  }, [torihikisakis, searchTorihikisakis]);

  const torihikisakiListSource = useMemo(() => {
    const needle = normStr(q);
    // 通常時は軽量の一覧（200件）を表示。統合検索時のみ全件インデックスを母集合に切り替える。
    const source = (needle && searchCorpusReady) ? searchTorihikisakis : torihikisakis;
    const m = new Map();
    source.forEach((it) => {
      const id = it?.torihikisaki_id || it?.id;
      if (!id) return;
      m.set(id, it);
    });
    return m;
  }, [q, searchCorpusReady, searchTorihikisakis, torihikisakis]);

  const yagouByTorihikisaki = useMemo(() => {
    const m = new Map();
    yagous.forEach((it) => {
      const tId = it?.torihikisaki_id;
      if (!tId) return;
      if (!m.has(tId)) m.set(tId, []);
      m.get(tId).push(it);
    });
    m.forEach((arr) => arr.sort((a, b) => normStr(a?.name).localeCompare(normStr(b?.name), 'ja')));
    return m;
  }, [yagous]);

  const tenpoByYagou = useMemo(() => {
    const m = new Map();
    tenpos.forEach((it) => {
      const yId = it?.yagou_id;
      if (!yId) return;
      if (!m.has(yId)) m.set(yId, []);
      m.get(yId).push(it);
    });
    m.forEach((arr) => arr.sort((a, b) => normStr(a?.name).localeCompare(normStr(b?.name), 'ja')));
    return m;
  }, [tenpos]);

  const searchTenpoByTorihikisakiAndYagou = useMemo(() => {
    const m = new Map();
    searchTenpos.forEach((it) => {
      const tId = it?.torihikisaki_id || '';
      const yId = it?.yagou_id || '(no-yagou)';
      if (!tId) return;
      const key = `${tId}::${yId}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(it);
    });
    m.forEach((arr) => arr.sort((a, b) => normStr(a?.name).localeCompare(normStr(b?.name), 'ja')));
    return m;
  }, [searchTenpos]);

  const searchTenpoByYagouGlobal = useMemo(() => {
    const m = new Map();
    searchTenpos.forEach((it) => {
      const yId = it?.yagou_id || '(no-yagou)';
      if (!m.has(yId)) m.set(yId, []);
      m.get(yId).push(it);
    });
    m.forEach((arr) => arr.sort((a, b) => normStr(a?.name).localeCompare(normStr(b?.name), 'ja')));
    return m;
  }, [searchTenpos]);

  const searchYagouByTorihikisaki = useMemo(() => {
    const m = new Map();
    searchYagous.forEach((it) => {
      const tId = it?.torihikisaki_id;
      if (!tId) return;
      if (!m.has(tId)) m.set(tId, []);
      m.get(tId).push(it);
    });
    return m;
  }, [searchYagous]);

  const searchTenpoByTorihikisaki = useMemo(() => {
    const yagouToTorihikisaki = new Map();
    searchYagous.forEach((it) => {
      const yId = it?.yagou_id || it?.id;
      const tId = it?.torihikisaki_id;
      if (yId && tId) yagouToTorihikisaki.set(yId, tId);
    });

    const m = new Map();
    searchTenpos.forEach((it) => {
      const tId = it?.torihikisaki_id || yagouToTorihikisaki.get(it?.yagou_id);
      if (!tId) return;
      if (!m.has(tId)) m.set(tId, []);
      m.get(tId).push(it);
    });
    return m;
  }, [searchTenpos, searchYagous]);

  const searchNameById = useMemo(() => {
    const toriById = new Map();
    searchTorihikisakis.forEach((it) => {
      const id = it?.torihikisaki_id || it?.id;
      if (!id) return;
      toriById.set(id, it?.name || '');
    });
    const yagouById = new Map();
    searchYagous.forEach((it) => {
      const id = it?.yagou_id || it?.id;
      if (!id) return;
      yagouById.set(id, it?.name || '');
    });
    return { toriById, yagouById };
  }, [searchTorihikisakis, searchYagous]);

  const filteredTorihikisakis = useMemo(() => {
    const needle = normStr(q);
    const base = [...torihikisakiListSource.values()].sort((a, b) => normStr(a?.name).localeCompare(normStr(b?.name), 'ja'));
    if (!needle) return base;
    return base.filter((it) => {
      const torihikisakiId = it?.torihikisaki_id || it?.id;
      const name = normStr(it?.name);
      const id = normStr(torihikisakiId);
      if (matchAllTokens(`${name} ${id}`, needle)) return true;

      const hitInYagou = (searchYagouByTorihikisaki.get(torihikisakiId) || []).some((yg) => {
        const yName = normStr(yg?.name);
        const yId = normStr(yg?.yagou_id || yg?.id);
        const blob = yg?._search_norm ? `${yg._search_norm}` : `${yName} ${yId}`;
        return matchAllTokens(blob, needle);
      });
      if (hitInYagou) return true;

      return (searchTenpoByTorihikisaki.get(torihikisakiId) || []).some((tp) => {
        const tName = normStr(tp?.name);
        const tId = normStr(tp?.tenpo_id || tp?.id);
        const blob = tp?._search_norm ? `${tp._search_norm}` : `${tName} ${tId}`;
        return matchAllTokens(blob, needle);
      });
    });
  }, [torihikisakiListSource, q, searchYagouByTorihikisaki, searchTenpoByTorihikisaki]);

  const bulkSelectedSet = useMemo(() => new Set(bulkSelectedTorihikisakiIds), [bulkSelectedTorihikisakiIds]);

  const toggleBulkSelect = useCallback((id, checked) => {
    if (!id) return;
    setBulkSelectedTorihikisakiIds((prev) => {
      const set = new Set(prev);
      if (checked) set.add(id);
      else set.delete(id);
      return Array.from(set);
    });
  }, []);

  const executeTorikeshi = useCallback(async () => {
    if (!bulkSelectedTorihikisakiIds.length) {
      setShowTorikeshiOverlay(false);
      return;
    }
    setTorikeshiSubmitting(true);
    setError('');
    try {
      const idSet = new Set(bulkSelectedTorihikisakiIds);
      const targets = torihikisakis.filter((it) => idSet.has(it?.torihikisaki_id || it?.id));
      if (!targets.length) throw new Error('取り消し対象が見つかりません');
      for (const it of targets) {
        // NOTE: サーバ側の監査整合のため逐次更新
        // eslint-disable-next-line no-await-in-loop
        await putTorihikisakiTorikeshi(it);
      }
      setBulkSelectedTorihikisakiIds([]);
      setShowTorikeshiOverlay(false);
      await loadTorihikisakiOnly();
    } catch (e) {
      setError(e?.message || '取り消しに失敗しました');
    } finally {
      setTorikeshiSubmitting(false);
    }
  }, [bulkSelectedTorihikisakiIds, torihikisakis, putTorihikisakiTorikeshi, loadTorihikisakiOnly]);

  const selectedTorihikisaki = useMemo(() => {
    if (!selectedTorihikisakiId) return null;
    return torihikisakiById.get(selectedTorihikisakiId) || null;
  }, [selectedTorihikisakiId, torihikisakiById]);

  const selectedYagous = useMemo(() => {
    if (!selectedTorihikisakiId) return [];
    const fromApi = yagouByTorihikisaki.get(selectedTorihikisakiId) || [];
    if (fromApi.length) return fromApi;

    const fromSearchYagou = searchYagouByTorihikisaki.get(selectedTorihikisakiId) || [];
    if (fromSearchYagou.length) return fromSearchYagou;

    const fromSearchTenpo = searchTenpoByTorihikisaki.get(selectedTorihikisakiId) || [];
    if (!fromSearchTenpo.length) return [];

    // 屋号データ取得に失敗した場合でも、店舗検索結果から疑似屋号グループを作って右ペインに表示する。
    const uniq = new Map();
    fromSearchTenpo.forEach((tp) => {
      const yId = tp?.yagou_id || '(no-yagou)';
      if (uniq.has(yId)) return;
      uniq.set(yId, {
        yagou_id: tp?.yagou_id || '',
        name: searchNameById.yagouById.get(tp?.yagou_id || '') || tp?.yagou_id || '屋号未設定',
      });
    });
    return Array.from(uniq.values()).sort((a, b) => normStr(a?.name).localeCompare(normStr(b?.name), 'ja'));
  }, [selectedTorihikisakiId, yagouByTorihikisaki, searchYagouByTorihikisaki, searchTenpoByTorihikisaki, searchNameById]);

  const getTenposForYagou = useCallback((yagouId) => {
    const apiRows = tenpoByYagou.get(yagouId) || [];
    if (apiRows.length) return apiRows;
    if (!selectedTorihikisakiId) return [];
    const key = `${selectedTorihikisakiId}::${yagouId || '(no-yagou)'}`;
    return searchTenpoByTorihikisakiAndYagou.get(key) || [];
  }, [tenpoByYagou, searchTenpoByTorihikisakiAndYagou, selectedTorihikisakiId]);

  const selectedTorihikisakiMatchesQuery = useMemo(() => {
    const needle = normStr(q);
    if (!needle || !selectedTorihikisaki) return false;
    const id = selectedTorihikisaki?.torihikisaki_id || selectedTorihikisaki?.id || '';
    const name = selectedTorihikisaki?.name || '';
    return matchAllTokens(`${name} ${id}`, needle);
  }, [q, selectedTorihikisaki]);

  const getVisibleTenposForYagou = useCallback((yagouId) => {
    const rows = getTenposForYagou(yagouId);
    const needle = normStr(q);
    if (!needle || selectedTorihikisakiMatchesQuery) return rows;
    return rows.filter((tp) => {
      const blob = tp?._search_norm || [
        tp?.name || '',
        tp?.tenpo_id || tp?.id || '',
        tp?.yagou_id || '',
        tp?.torihikisaki_id || '',
        tenpoAddress(tp),
        tenpoPhone(tp),
      ].join(' ');
      return matchAllTokens(blob, needle);
    });
  }, [getTenposForYagou, q, selectedTorihikisakiMatchesQuery]);

  const visibleSelectedYagous = useMemo(() => {
    const needle = normStr(q);
    if (!needle || selectedTorihikisakiMatchesQuery) return selectedYagous;
    return selectedYagous.filter((y) => {
      const yagouId = y?.yagou_id || y?.id || '';
      const yBlob = y?._search_norm || `${y?.name || ''} ${yagouId} ${selectedTorihikisakiId || ''}`;
      if (matchAllTokens(yBlob, needle)) return true;
      return getVisibleTenposForYagou(yagouId).length > 0;
    });
  }, [q, selectedYagous, selectedTorihikisakiId, selectedTorihikisakiMatchesQuery, getVisibleTenposForYagou]);

  const copy = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(String(text || ''));
    } catch {
      // noop: clipboard unavailable (non-secure context)
    }
  }, []);

  const getVisibleAllTenposForYagou = useCallback((yagouId) => {
    const rows = searchTenpoByYagouGlobal.get(yagouId || '(no-yagou)') || [];
    const needle = normStr(q);
    if (!needle) return rows;
    return rows.filter((tp) => {
      const blob = tp?._search_norm || [
        tp?.name || '',
        tp?.tenpo_id || tp?.id || '',
        tp?.yagou_id || '',
        tp?.torihikisaki_id || '',
        tenpoAddress(tp),
        tenpoPhone(tp),
      ].join(' ');
      return matchAllTokens(blob, needle);
    });
  }, [searchTenpoByYagouGlobal, q]);

  const visibleAllYagous = useMemo(() => {
    const needle = normStr(q);
    const byId = new Map();
    searchYagous.forEach((y) => {
      const id = y?.yagou_id || y?.id;
      if (!id) return;
      byId.set(id, y);
    });
    // 屋号未設定店舗向けの疑似グループ
    if ((searchTenpoByYagouGlobal.get('(no-yagou)') || []).length) {
      byId.set('(no-yagou)', { yagou_id: '', name: '屋号未設定', _search_norm: '屋号未設定 no-yagou' });
    }
    const base = Array.from(byId.values()).sort((a, b) => normStr(a?.name).localeCompare(normStr(b?.name), 'ja'));
    if (!needle) return base;
    return base.filter((y) => {
      const yagouId = y?.yagou_id || y?.id || '';
      const yBlob = y?._search_norm || `${y?.name || ''} ${yagouId} ${y?.torihikisaki_id || ''}`;
      if (matchAllTokens(yBlob, needle)) return true;
      return getVisibleAllTenposForYagou(yagouId).length > 0;
    });
  }, [q, searchYagous, getVisibleAllTenposForYagou, searchTenpoByYagouGlobal]);

  return (
    <div className="meibo-page">
      <header className="meibo-head">
        <div className="meibo-head-left">
          <div className="admin-top-left">
            {/* GlobalNav handles navigation */}
          </div>
          <h1>取引先名簿（meibo）</h1>
          <div className="meibo-sub">torihikisaki → yagou → tenpo</div>
        </div>
        <div className="meibo-head-right">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="統合検索（取引先 / 屋号 / 店舗 / id）"
          />
          <button onClick={loadTorihikisakiOnly} disabled={loading}>更新</button>
        </div>
      </header>

      {error ? <div className="meibo-err">{error}</div> : null}
      {!error && searchLoading ? <div className="meibo-err">検索インデックス読み込み中...</div> : null}

      <div className="meibo-body">
        <aside className="meibo-list">
          <div className="meibo-list-head">
            <div className="k">取引先</div>
            <div className="v">{filteredTorihikisakis.length}</div>
            <button
              type="button"
              className="meibo-cancel-btn"
              disabled={!bulkSelectedTorihikisakiIds.length || torikeshiSubmitting}
              onClick={() => setShowTorikeshiOverlay(true)}
            >
              取り消し
            </button>
          </div>
          <div className="meibo-list-scroll">
            {filteredTorihikisakis.map((it) => {
              const id = it?.torihikisaki_id || it?.id;
              const active = id && id === selectedTorihikisakiId;
              // NOTE: 屋号は「選択した取引先のみ」取得しているため、全件分の件数はここでは出せない。
              // 誤解を避けるため、件数表示は選択中の取引先に限定する。
              const yagouCount = active ? (yagouByTorihikisaki.get(id) || []).length : null;
              return (
                <button
                  key={id}
                  className={`meibo-row ${active ? 'active' : ''}`}
                  onClick={() => setSelectedTorihikisakiId((cur) => (cur === id ? '' : id))}
                >
                  <div className="meibo-row-check">
                    <input
                      type="checkbox"
                      checked={bulkSelectedSet.has(id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => toggleBulkSelect(id, e.target.checked)}
                      aria-label={`${it?.name || id} を取り消し選択`}
                    />
                  </div>
                  <div className="name">{it?.name || '(no name)'}</div>
                  <div className="meta">
                    <span className="id">{id}</span>
                    {yagouCount === null ? null : <span className="count">屋号 {yagouCount}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="meibo-detail">
          {!selectedTorihikisaki ? (
            <>
              <div className="meibo-detail-head">
                <div className="title">
                  <div className="tname">全取引先（屋号・店舗）</div>
                  <div className="tid">取引先未選択: 全件表示</div>
                </div>
                <div className="actions">
                  <Link to="/admin/master/torihikisaki" className="link">マスタ編集へ</Link>
                </div>
              </div>

              <div className="meibo-yagou">
                {!searchCorpusReady ? (
                  <div className="meibo-empty">屋号/店舗を読み込み中...</div>
                ) : visibleAllYagous.length === 0 ? (
                  <div className="meibo-empty">該当する屋号/店舗がありません</div>
                ) : (
                  visibleAllYagous.map((y) => {
                    const yagouId = y?.yagou_id || y?.id;
                    const tps = getVisibleAllTenposForYagou(yagouId);
                    return (
                      <details key={yagouId || '(no-yagou)'} className="yagou-block" open>
                        <summary>
                          <span className="yagou-name">{y?.name || '(no name)'}</span>
                          <span className="yagou-id">{yagouId || '(no-yagou)'}</span>
                          <span className="yagou-count">店舗 {tps.length}</span>
                        </summary>
                        <div className="tenpo-list">
                          {tps.map((tp) => {
                            const tenpoId = tp?.tenpo_id || tp?.id;
                            const toriId = tp?.torihikisaki_id || '';
                            const yId = tp?.yagou_id || yagouId || '';
                            return (
                              <div className="tenpo-row" key={`${yagouId || '(no-yagou)'}-${tenpoId}`}>
                                <div className="tenpo-main">
                                  <div className="tenpo-name">{tp?.name || '(no name)'}</div>
                                  <div className="tenpo-id">{tenpoId}</div>
                                  <div className="tenpo-address">
                                    <span className="lbl">住所:</span>
                                    <span className="txt">{tenpoAddress(tp) || '未設定'}</span>
                                  </div>
                                  <div className="tenpo-address">
                                    <span className="lbl">電話:</span>
                                    <span className="txt">{tenpoPhone(tp) || '未設定'}</span>
                                  </div>
                                </div>
                                <div className="tenpo-actions">
                                  <button onClick={() => copy(tenpoId)}>IDコピー</button>
                                  <Link
                                    to={`/admin/tenpo/${encodeURIComponent(tenpoId)}?${new URLSearchParams({
                                      torihikisaki_id: toriId,
                                      yagou_id: yId,
                                    }).toString()}`}
                                    className="link"
                                  >
                                    カルテ
                                  </Link>
                                  <Link to="/admin/yotei" className="link">予定へ</Link>
                                  <Link to="/admin/master/tenpo" className="link">マスタへ</Link>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <>
              <div className="meibo-detail-head">
                <div className="title">
                  <div className="tname">{selectedTorihikisaki?.name || ''}</div>
                  <div className="tid">{selectedTorihikisakiId}</div>
                </div>
                <div className="actions">
                  <button onClick={() => copy(selectedTorihikisakiId)}>IDコピー</button>
                  <Link to="/admin/master/torihikisaki" className="link">マスタ編集へ</Link>
                </div>
              </div>

              <div className="meibo-yagou">
                {loading && selectedYagous.length === 0 ? (
                  <div className="meibo-empty">屋号を読み込み中...</div>
                ) : visibleSelectedYagous.length === 0 ? (
                  <div className="meibo-empty">
                    <div>屋号がありません</div>
                    <div className="meibo-empty-sub">
                      確認: <code>/api-master/master/yagou?torihikisaki_id={encodeURIComponent(selectedTorihikisakiId)}&amp;limit=5000&amp;jotai=yuko</code>
                    </div>
                  </div>
                ) : (
                  visibleSelectedYagous.map((y) => {
                    const yagouId = y?.yagou_id || y?.id;
                    const tps = getVisibleTenposForYagou(yagouId);
                    return (
                      <details key={yagouId} className="yagou-block" open>
                        <summary>
                          <span className="yagou-name">{y?.name || '(no name)'}</span>
                          <span className="yagou-id">{yagouId}</span>
                          <span className="yagou-count">店舗 {tps.length}</span>
                        </summary>
                        <div className="tenpo-list">
                          {tps.map((tp) => {
                            const tenpoId = tp?.tenpo_id || tp?.id;
                            return (
                              <div className="tenpo-row" key={tenpoId}>
                              <div className="tenpo-main">
                                  <div className="tenpo-name">{tp?.name || '(no name)'}</div>
                                  <div className="tenpo-id">{tenpoId}</div>
                                  <div className="tenpo-address">
                                    <span className="lbl">住所:</span>
                                    <span className="txt">{tenpoAddress(tp) || '未設定'}</span>
                                  </div>
                                  <div className="tenpo-address">
                                    <span className="lbl">電話:</span>
                                    <span className="txt">{tenpoPhone(tp) || '未設定'}</span>
                                  </div>
                                </div>
                              <div className="tenpo-actions">
                                <button onClick={() => copy(tenpoId)}>IDコピー</button>
                                <Link
                                  to={`/admin/tenpo/${encodeURIComponent(tenpoId)}?${new URLSearchParams({
                                    torihikisaki_id: selectedTorihikisakiId,
                                    yagou_id: yagouId,
                                  }).toString()}`}
                                  className="link"
                                >
                                  カルテ
                                </Link>
                                <Link to="/admin/yotei" className="link">予定へ</Link>
                                <Link to="/admin/master/tenpo" className="link">マスタへ</Link>
                              </div>
                            </div>
                          );
                          })}
                        </div>
                      </details>
                    );
                  })
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {showTorikeshiOverlay ? (
        <div className="meibo-overlay-backdrop" role="dialog" aria-modal="true">
          <div className="meibo-overlay">
            <h3>取引先の取り消し確認</h3>
            <p>選択した {bulkSelectedTorihikisakiIds.length} 件を「取り消し」にします。実行しますか？</p>
            <div className="meibo-overlay-list">
              {bulkSelectedTorihikisakiIds.slice(0, 20).map((id) => {
                const found = torihikisakis.find((it) => (it?.torihikisaki_id || it?.id) === id);
                return (
                  <div key={id} className="item">
                    <span className="nm">{found?.name || '(no name)'}</span>
                    <span className="id">{id}</span>
                  </div>
                );
              })}
              {bulkSelectedTorihikisakiIds.length > 20 ? (
                <div className="item">...他 {bulkSelectedTorihikisakiIds.length - 20} 件</div>
              ) : null}
            </div>
            <div className="meibo-overlay-actions">
              <button
                type="button"
                onClick={() => setShowTorikeshiOverlay(false)}
                disabled={torikeshiSubmitting}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="danger"
                onClick={executeTorikeshi}
                disabled={torikeshiSubmitting}
              >
                {torikeshiSubmitting ? '処理中...' : '取り消し実行'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
