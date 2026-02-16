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

function detectQueryKind(qRaw) {
  const q = normStr(qRaw);
  if (!q) return 'none';
  const n = normalizeForSearch(q);
  if (!n) return 'none';

  // Looks like an ID (TENPO#/YAGOU#/TORI# or numeric code etc)
  if (n.includes('tenpo') || n.includes('yagou') || n.includes('tori')) return 'id';
  if (/^(tenpo|yagou|tori)\d+/.test(n)) return 'id';

  // Phone-like: 9+ digits (hyphens/space removed by normalizeForSearch)
  if (/^\d{9,}$/.test(n)) return 'phone';

  // Address-like: Japanese postal / prefecture/city markers (keep raw to detect kana/kanji)
  if (q.includes('〒') || /[都道府県市区町村]/.test(q)) return 'address';

  // Default: brand/store free text
  return 'brand';
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

      // 初期選択: 先頭
      setSelectedTorihikisakiId((cur) => cur || (t?.[0]?.torihikisaki_id || ''));
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

  const torihikisakiById = useMemo(() => {
    const m = new Map();
    torihikisakis.forEach((it) => {
      const id = it?.torihikisaki_id || it?.id;
      if (!id) return;
      m.set(id, it);
    });
    return m;
  }, [torihikisakis]);

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
    const base = [...torihikisakis].sort((a, b) => normStr(a?.name).localeCompare(normStr(b?.name), 'ja'));
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
  }, [torihikisakis, q, searchYagouByTorihikisaki, searchTenpoByTorihikisaki]);

  const tenpoSearchHits = useMemo(() => {
    const needle = normStr(q);
    if (!needle || !searchCorpusReady) return [];
    const kind = detectQueryKind(needle);

    // Do NOT slice too early (brand search should yield "stores under the brand").
    // Cap only to protect UI responsiveness.
    const maxTotal = kind === 'brand' ? 500 : (kind === 'address' ? 300 : 150);

    const hits = (searchTenpos || []).filter((tp) => matchAllTokens(tp?._search_norm || '', needle));

    const nq = normalizeForSearch(needle);
    const score = (tp) => {
      const tenpoId = String(tp?.tenpo_id || tp?.id || '');
      const tenpoName = String(tp?.name || '');
      const addr = tenpoAddress(tp);
      const phone = tenpoPhone(tp);
      const yagouId = String(tp?.yagou_id || '');
      const toriId = String(tp?.torihikisaki_id || '');
      const yagouName = searchNameById.yagouById.get(yagouId) || '';
      const toriName = searchNameById.toriById.get(toriId) || '';

      const tid = normalizeForSearch(tenpoId);
      const tname = normalizeForSearch(tenpoName);
      const yname = normalizeForSearch(yagouName);
      const yid = normalizeForSearch(yagouId);
      const aname = normalizeForSearch(addr);
      const pnum = normalizeForSearch(phone);
      const torin = normalizeForSearch(toriName);

      let s = 0;
      if (!nq) return 0;

      if (kind === 'id') {
        if (tid && tid.includes(nq)) s += 200;
        if (yid && yid.includes(nq)) s += 160;
      } else if (kind === 'phone') {
        if (pnum && pnum.includes(nq)) s += 240;
      } else if (kind === 'address') {
        if (aname && aname.includes(nq)) s += 220;
      } else {
        // brand
        if (yname && yname.includes(nq)) s += 220;
        if (torin && torin.includes(nq)) s += 120;
        if (tname && tname.includes(nq)) s += 90;
      }

      // Secondary signals
      if (tname && tname.includes(nq)) s += 30;
      if (aname && aname.includes(nq)) s += 25;
      if (pnum && pnum.includes(nq)) s += 15;
      return s;
    };

    hits.sort((a, b) => {
      const sa = score(a);
      const sb = score(b);
      if (sb !== sa) return sb - sa;
      // Stable-ish: then by yagou->tenpo name
      const ay = String(searchNameById.yagouById.get(a?.yagou_id || '') || a?.yagou_id || '');
      const by = String(searchNameById.yagouById.get(b?.yagou_id || '') || b?.yagou_id || '');
      const yn = normStr(ay).localeCompare(normStr(by), 'ja');
      if (yn !== 0) return yn;
      return normStr(a?.name).localeCompare(normStr(b?.name), 'ja');
    });

    return hits.slice(0, maxTotal);
  }, [q, searchCorpusReady, searchTenpos]);

  const tenpoSearchGroups = useMemo(() => {
    if (!tenpoSearchHits.length) return [];
    const needle = normStr(q);
    const nq = normalizeForSearch(needle);
    const kind = detectQueryKind(needle);

    const groups = new Map(); // yagou_id -> { yagou_id, yagou_name, torihikisaki_id, torihikisaki_name, items }
    tenpoSearchHits.forEach((tp) => {
      const yagouId = tp?.yagou_id || '';
      const tenpoId = tp?.tenpo_id || tp?.id || '';
      const torihikisakiId = tp?.torihikisaki_id || '';
      const yagouName = searchNameById.yagouById.get(yagouId) || '';
      const toriName = searchNameById.toriById.get(torihikisakiId) || '';
      const key = yagouId || '(no-yagou)';
      if (!groups.has(key)) {
        groups.set(key, {
          yagou_id: yagouId,
          yagou_name: yagouName,
          torihikisaki_id: torihikisakiId,
          torihikisaki_name: toriName,
          items: [],
          _score: 0,
        });
      }
      const g = groups.get(key);
      g.items.push({ ...tp, _tenpo_id: tenpoId });
    });

    const out = Array.from(groups.values()).map((g) => {
      const yNameNorm = normalizeForSearch(g.yagou_name || '');
      const yIdNorm = normalizeForSearch(g.yagou_id || '');
      // Score: if query matches yagou name/id strongly, group goes top.
      let score = 0;
      if (nq && yNameNorm && yNameNorm.includes(nq)) score += 100;
      if (nq && yIdNorm && yIdNorm.includes(nq)) score += 80;
      score += Math.min(30, g.items.length); // prefer larger groups a bit
      g._score = score;

      // Within group, keep "store name" order for brand search, and keep scoring order for address/phone/id.
      if (kind === 'brand') {
        g.items.sort((a, b) => normStr(a?.name).localeCompare(normStr(b?.name), 'ja'));
      }
      return g;
    });

    out.sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      return normStr(a.yagou_name || a.yagou_id).localeCompare(normStr(b.yagou_name || b.yagou_id), 'ja');
    });
    return out;
  }, [tenpoSearchHits, q, searchNameById]);

  const selectedTorihikisaki = useMemo(() => {
    if (!selectedTorihikisakiId) return null;
    return torihikisakiById.get(selectedTorihikisakiId) || null;
  }, [selectedTorihikisakiId, torihikisakiById]);

  const selectedYagous = useMemo(() => {
    if (!selectedTorihikisakiId) return [];
    return yagouByTorihikisaki.get(selectedTorihikisakiId) || [];
  }, [selectedTorihikisakiId, yagouByTorihikisaki]);

  const copy = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(String(text || ''));
    } catch {
      // noop: clipboard unavailable (non-secure context)
    }
  }, []);

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

      {normStr(q) ? (
        <section className="meibo-search-hits">
          <div className="meibo-search-hits-head">
            <div className="k">店舗検索結果</div>
            <div className="v">{searchCorpusReady ? tenpoSearchHits.length : '-'}</div>
            {!searchCorpusReady ? <div className="hint">（検索インデックス読み込み中）</div> : null}
          </div>
          {searchCorpusReady && tenpoSearchHits.length ? (
            <div className="meibo-search-hits-list">
              {tenpoSearchGroups.map((g) => {
                const header = [
                  g.torihikisaki_name || g.torihikisaki_id || '取引先未設定',
                  g.yagou_name || g.yagou_id || '屋号未設定',
                ].join(' / ');
                return (
                  <div key={g.yagou_id || '(no-yagou)'} className="hit-group">
                    <div className="hit-group-head">
                      <div className="hit-group-title">{header}</div>
                      <div className="hit-group-count">店舗 {g.items.length}</div>
                    </div>
                    {g.items.map((tp) => {
                      const tenpoId = tp?._tenpo_id || tp?.tenpo_id || tp?.id || '';
                      const toriId = tp?.torihikisaki_id || '';
                      const yagouId = tp?.yagou_id || '';
                      return (
                        <div key={`${g.yagou_id || ''}-${tenpoId}`} className="hit-row">
                          <div className="hit-main">
                            <div className="hit-name">{tp?.name || '(no name)'}</div>
                            <div className="hit-meta">
                              <span className="lbl">ID:</span><span className="val"><code>{tenpoId}</code></span>
                              {tenpoAddress(tp) ? (
                                <>
                                  <span className="lbl">住所:</span><span className="val">{tenpoAddress(tp)}</span>
                                </>
                              ) : null}
                              {tenpoPhone(tp) ? (
                                <>
                                  <span className="lbl">電話:</span><span className="val">{tenpoPhone(tp)}</span>
                                </>
                              ) : null}
                            </div>
                          </div>
                          <div className="hit-actions">
                            <button
                              type="button"
                              onClick={() => {
                                if (toriId) setSelectedTorihikisakiId(toriId);
                              }}
                            >
                              名簿で表示
                            </button>
                            <Link
                              className="link"
                              to={`/admin/tenpo/${encodeURIComponent(tenpoId)}?${new URLSearchParams({
                                torihikisaki_id: toriId,
                                yagou_id: yagouId,
                              }).toString()}`}
                            >
                              カルテ
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ) : searchCorpusReady ? (
            <div className="meibo-search-hits-empty">該当店舗が見つかりません。</div>
          ) : null}
        </section>
      ) : null}

      <div className="meibo-body">
        <aside className="meibo-list">
          <div className="meibo-list-head">
            <div className="k">取引先</div>
            <div className="v">{filteredTorihikisakis.length}</div>
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
                  onClick={() => setSelectedTorihikisakiId(id)}
                >
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
            <div className="meibo-empty">取引先を選択してください</div>
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
                ) : selectedYagous.length === 0 ? (
                  <div className="meibo-empty">
                    <div>屋号がありません</div>
                    <div className="meibo-empty-sub">
                      確認: <code>/api-master/master/yagou?torihikisaki_id={encodeURIComponent(selectedTorihikisakiId)}&amp;limit=5000&amp;jotai=yuko</code>
                    </div>
                  </div>
                ) : (
                  selectedYagous.map((y) => {
                    const yagouId = y?.yagou_id || y?.id;
                    const tps = tenpoByYagou.get(yagouId) || [];
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
    </div>
  );
}
