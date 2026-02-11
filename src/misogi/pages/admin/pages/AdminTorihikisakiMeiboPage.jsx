import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import './admin-torihikisaki-meibo.css';

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

export default function AdminTorihikisakiMeiboPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
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

  const filteredTorihikisakis = useMemo(() => {
    const needle = normStr(q).toLowerCase();
    const base = [...torihikisakis].sort((a, b) => normStr(a?.name).localeCompare(normStr(b?.name), 'ja'));
    if (!needle) return base;
    return base.filter((it) => {
      const name = normStr(it?.name).toLowerCase();
      const id = normStr(it?.torihikisaki_id).toLowerCase();
      return name.includes(needle) || id.includes(needle);
    });
  }, [torihikisakis, q]);

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
          <Link to="/admin/entrance" className="meibo-back">← 管理トップ</Link>
          <h1>取引先名簿（meibo）</h1>
          <div className="meibo-sub">torihikisaki → yagou → tenpo</div>
        </div>
        <div className="meibo-head-right">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="取引先を検索（name / id）"
          />
          <button onClick={loadTorihikisakiOnly} disabled={loading}>更新</button>
        </div>
      </header>

      {error ? <div className="meibo-err">{error}</div> : null}

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
