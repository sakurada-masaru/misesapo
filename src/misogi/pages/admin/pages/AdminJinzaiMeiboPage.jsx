import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
// Hamburger / admin-top are provided by GlobalNav.
import './admin-jinzai-meibo.css';

function isLocalUiHost() {
  if (typeof window === 'undefined') return false;
  const h = window.location?.hostname || '';
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
}

const JINZAI_API_BASE =
  (import.meta.env?.DEV || isLocalUiHost())
    ? '/api-jinzai'
    : (import.meta.env?.VITE_JINZAI_API_BASE || 'https://ho3cd7ibtl.execute-api.ap-northeast-1.amazonaws.com/prod');

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

function normStr(v) {
  return String(v || '').trim();
}

function normArr(v) {
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  if (typeof v === 'string' && v.trim().startsWith('[')) {
    try {
      const a = JSON.parse(v);
      return Array.isArray(a) ? a.filter(Boolean).map(String) : [];
    } catch {
      return [];
    }
  }
  if (!v) return [];
  return [String(v)];
}

async function fetchJinzaiList({ limit = 2000, jotai = 'yuko' } = {}) {
  const base = JINZAI_API_BASE.replace(/\/$/, '');
  const qs = new URLSearchParams({ limit: String(limit), jotai: String(jotai) }).toString();
  const res = await fetch(`${base}/jinzai?${qs}`, { headers: authHeaders(), cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`JINZAI HTTP ${res.status} ${text}`.trim());
  }
  const data = await res.json();
  const items = Array.isArray(data) ? data : (data?.items || []);
  return Array.isArray(items) ? items : [];
}

export default function AdminJinzaiMeiboPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [yakuwari, setYakuwari] = useState('');
  const [shokushu, setShokushu] = useState('');
  const [items, setItems] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchJinzaiList({ limit: 2000, jotai: 'yuko' });
      setItems(data);
    } catch (e) {
      setError(e?.message || '読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const options = useMemo(() => {
    const yakuwariSet = new Set();
    const shokushuSet = new Set();
    items.forEach((it) => {
      normArr(it?.yakuwari).forEach((v) => yakuwariSet.add(v));
      normArr(it?.shokushu).forEach((v) => shokushuSet.add(v));
    });
    return {
      yakuwari: [...yakuwariSet].sort(),
      shokushu: [...shokushuSet].sort(),
    };
  }, [items]);

  const filtered = useMemo(() => {
    const needle = normStr(q).toLowerCase();
    return items
      .filter((it) => {
        if (yakuwari) {
          const ys = normArr(it?.yakuwari);
          if (!ys.includes(yakuwari)) return false;
        }
        if (shokushu) {
          const ss = normArr(it?.shokushu);
          if (!ss.includes(shokushu)) return false;
        }
        if (!needle) return true;
        const hay = [
          it?.jinzai_id,
          it?.name,
          it?.email,
          it?.phone,
          it?.koyou_kubun,
          ...(normArr(it?.yakuwari)),
          ...(normArr(it?.shokushu)),
          it?.busho_names,
          ...(normArr(it?.busho_ids)),
        ]
          .map((x) => normStr(x).toLowerCase())
          .join(' ');
        return hay.includes(needle);
      })
      .sort((a, b) => normStr(a?.name).localeCompare(normStr(b?.name), 'ja'));
  }, [items, q, yakuwari, shokushu]);

  const copy = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(String(text || ''));
    } catch {
      // noop
    }
  }, []);

  return (
    <div className="jinzai-meibo-page">
      <header className="jinzai-meibo-head">
        <div className="left">
          <div className="admin-top-left">
            {/* GlobalNav handles navigation */}
          </div>
          <h1>人材名簿（meibo）</h1>
          <div className="sub">jinzai（人）</div>
        </div>
        <div className="right">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="検索（name / id / email / phone / 部署 / 職種 / 役割）"
          />
          <button onClick={load} disabled={loading}>{loading ? '更新中...' : '更新'}</button>
        </div>
      </header>

      {error ? <div className="jinzai-meibo-err">{error}</div> : null}

      <section className="jinzai-meibo-toolbar">
        <label>
          <span>役割(yakuwari)</span>
          <select value={yakuwari} onChange={(e) => setYakuwari(e.target.value)}>
            <option value="">全て</option>
            {options.yakuwari.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label>
          <span>職種(shokushu)</span>
          <select value={shokushu} onChange={(e) => setShokushu(e.target.value)}>
            <option value="">全て</option>
            {options.shokushu.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <div className="count">{filtered.length} 件</div>
        <Link to="/admin/master/jinzai" className="link">人材マスタ編集へ</Link>
      </section>

      <div className="jinzai-meibo-table-wrap">
        <table className="jinzai-meibo-table">
          <thead>
            <tr>
              <th>氏名</th>
              <th>ID</th>
              <th>役割</th>
              <th>職種</th>
              <th>部署</th>
              <th>メール</th>
              <th>電話</th>
              <th>契約形態</th>
              <th>状態</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((it) => {
              const id = it?.jinzai_id || it?.id || '';
              const ys = normArr(it?.yakuwari);
              const ss = normArr(it?.shokushu);
              return (
                <tr key={id || Math.random()}>
                  <td className="name">{it?.name || '(no name)'}</td>
                  <td className="id">
                    <code>{id}</code>
                  </td>
                  <td className="tags">
                    {ys.map((v) => <span key={v} className="tag">{v}</span>)}
                  </td>
                  <td className="tags">
                    {ss.map((v) => <span key={v} className="tag">{v}</span>)}
                  </td>
                  <td className="busho">{it?.busho_names || normArr(it?.busho_ids).join(', ')}</td>
                  <td className="email">{it?.email || ''}</td>
                  <td className="phone">{it?.phone || ''}</td>
                  <td className="koyou">{it?.koyou_kubun || ''}</td>
                  <td className="jotai">{it?.jotai || ''}</td>
                  <td className="actions">
                    <button onClick={() => copy(id)}>IDコピー</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
