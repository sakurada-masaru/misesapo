import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
// Hamburger / back / admin-top are provided by GlobalNav.
import './admin-torihikisaki-touroku.css';

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

async function apiJson(path, { method = 'GET', body } = {}) {
  const base = MASTER_API_BASE.replace(/\/$/, '');
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...authHeaders(),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${method} ${path} HTTP ${res.status} ${text}`.trim());
  }
  // master API は JSON を返す前提
  return res.json();
}

function getItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function norm(v) {
  return String(v || '').trim();
}

function normalizeKeyPart(v) {
  return norm(v).toLowerCase().replace(/\s+/g, ' ');
}

function stableHash(input) {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  const s = String(input || '');
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = (h >>> 0) * 0x01000193;
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function buildOnboardingIdempotencyKey(tName, yName, tenpoName) {
  const keySource = [
    normalizeKeyPart(tName),
    normalizeKeyPart(yName),
    normalizeKeyPart(tenpoName),
  ].join('|');
  return `onboarding-${stableHash(keySource)}`;
}

export default function AdminTorihikisakiTourokuPage() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [okMsg, setOkMsg] = useState('');

  // 既存選択用
  const [torihikisakiList, setTorihikisakiList] = useState([]);
  const [selectedTorihikisakiId, setSelectedTorihikisakiId] = useState('');
  const [yagouList, setYagouList] = useState([]);
  const [selectedYagouId, setSelectedYagouId] = useState('');

  // 一括作成入力
  const [bulkTorihikisakiName, setBulkTorihikisakiName] = useState('');
  const [bulkYagouName, setBulkYagouName] = useState('');
  const [bulkTenpoName, setBulkTenpoName] = useState('');
  const [bulkPhone, setBulkPhone] = useState('');
  const [bulkEmail, setBulkEmail] = useState('');
  const [bulkTantouName, setBulkTantouName] = useState('');
  const [bulkAddress, setBulkAddress] = useState('');
  const [bulkUrl, setBulkUrl] = useState('');
  const [bulkJouhouTourokuShaName, setBulkJouhouTourokuShaName] = useState('');
  const [bulkOpenKarteAfterCreate, setBulkOpenKarteAfterCreate] = useState(true);

  // 既存に追加入力
  const [addYagouName, setAddYagouName] = useState('');
  const [addTenpoName, setAddTenpoName] = useState('');

  const reloadTorihikisaki = useCallback(async () => {
    setErr('');
    setOkMsg('');
    setLoading(true);
    try {
      // master API は scan+filter なので、返却件数は絞る（必要なら検索で運用）
      const data = await apiJson(`/master/torihikisaki?limit=500&jotai=yuko`);
      const items = getItems(data).sort((a, b) => norm(a?.name).localeCompare(norm(b?.name), 'ja'));
      setTorihikisakiList(items);
      setSelectedTorihikisakiId((cur) => cur || items?.[0]?.torihikisaki_id || '');
    } catch (e) {
      setErr(e?.message || '取引先の読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  const reloadYagou = useCallback(async (torihikisakiId) => {
    if (!torihikisakiId) {
      setYagouList([]);
      setSelectedYagouId('');
      return;
    }
    setErr('');
    setOkMsg('');
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        limit: '5000',
        jotai: 'yuko',
        torihikisaki_id: torihikisakiId,
      });
      const data = await apiJson(`/master/yagou?${qs.toString()}`);
      const items = getItems(data).sort((a, b) => norm(a?.name).localeCompare(norm(b?.name), 'ja'));
      setYagouList(items);
      setSelectedYagouId((cur) => cur || items?.[0]?.yagou_id || '');
    } catch (e) {
      setErr(e?.message || '屋号の読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadTorihikisaki();
  }, [reloadTorihikisaki]);

  useEffect(() => {
    reloadYagou(selectedTorihikisakiId);
  }, [selectedTorihikisakiId, reloadYagou]);

  const torihikisakiById = useMemo(() => {
    const m = new Map();
    torihikisakiList.forEach((it) => {
      const id = it?.torihikisaki_id;
      if (!id) return;
      m.set(id, it);
    });
    return m;
  }, [torihikisakiList]);

  const selectedTorihikisaki = useMemo(() => {
    return selectedTorihikisakiId ? torihikisakiById.get(selectedTorihikisakiId) : null;
  }, [selectedTorihikisakiId, torihikisakiById]);

  const findExistingTenpoByNames = useCallback(async ({ torihikisakiName, yagouName, tenpoName }) => {
    const tNameNorm = normalizeKeyPart(torihikisakiName);
    const yNameNorm = normalizeKeyPart(yagouName);
    const tenpoNameNorm = normalizeKeyPart(tenpoName);
    if (!tNameNorm || !yNameNorm || !tenpoNameNorm) return null;

    const toriData = await apiJson('/master/torihikisaki?limit=5000&jotai=yuko');
    const toriItems = getItems(toriData);
    const matchedTori = toriItems.find((it) => normalizeKeyPart(it?.name) === tNameNorm);
    if (!matchedTori?.torihikisaki_id) return null;

    const yagouQs = new URLSearchParams({
      limit: '5000',
      jotai: 'yuko',
      torihikisaki_id: matchedTori.torihikisaki_id,
    });
    const yagouData = await apiJson(`/master/yagou?${yagouQs.toString()}`);
    const yagouItems = getItems(yagouData);
    const matchedYagou = yagouItems.find((it) => normalizeKeyPart(it?.name) === yNameNorm);
    if (!matchedYagou?.yagou_id) return null;

    const tenpoQs = new URLSearchParams({
      limit: '20000',
      jotai: 'yuko',
      torihikisaki_id: matchedTori.torihikisaki_id,
      yagou_id: matchedYagou.yagou_id,
    });
    const tenpoData = await apiJson(`/master/tenpo?${tenpoQs.toString()}`);
    const tenpoItems = getItems(tenpoData);
    const matchedTenpo = tenpoItems.find((it) => normalizeKeyPart(it?.name) === tenpoNameNorm);
    if (!matchedTenpo?.tenpo_id) return null;

    return {
      torihikisaki: matchedTori,
      yagou: matchedYagou,
      tenpo: matchedTenpo,
    };
  }, []);

  const createSoukoIfMissing = useCallback(async (tenpoId, tenpoName) => {
    if (!tenpoId) return;
    const checkQs = new URLSearchParams({ limit: '1', jotai: 'yuko', tenpo_id: tenpoId });
    const check = await apiJson(`/master/souko?${checkQs.toString()}`);
    const items = getItems(check);
    if (items.length > 0) return;
    await apiJson('/master/souko', {
      method: 'POST',
      body: {
        tenpo_id: tenpoId,
        name: `${tenpoName || tenpoId} 顧客ストレージ`,
        jotai: 'yuko',
      },
    });
  }, []);

  const onBulkCreate = useCallback(async () => {
    const tName = norm(bulkTorihikisakiName);
    const yName = norm(bulkYagouName);
    const tenpoName = norm(bulkTenpoName);
    if (!tName || !yName || !tenpoName) {
      window.alert('取引先名・屋号名・店舗名は必須です');
      return;
    }
    setErr('');
    setOkMsg('');
    setLoading(true);
    try {
      const existing = await findExistingTenpoByNames({
        torihikisakiName: tName,
        yagouName: yName,
        tenpoName,
      });
      if (existing?.tenpo?.tenpo_id) {
        const go = window.confirm(
          `同名の既存店舗が見つかりました。\n` +
          `${existing.torihikisaki?.name} / ${existing.yagou?.name} / ${existing.tenpo?.name}\n\n` +
          '既存カルテを開きますか？'
        );
        if (go) nav(`/admin/tenpo/${encodeURIComponent(existing.tenpo.tenpo_id)}`);
        return;
      }

      const idempotencyKey = buildOnboardingIdempotencyKey(tName, yName, tenpoName);
      const result = await apiJson('/master/tenpo', {
        method: 'POST',
        body: {
          mode: 'onboarding',
          torihikisaki_name: tName,
          yagou_name: yName,
          tenpo_name: tenpoName,
          phone: norm(bulkPhone),
          email: norm(bulkEmail),
          tantou_name: norm(bulkTantouName),
          address: norm(bulkAddress),
          url: norm(bulkUrl),
          jouhou_touroku_sha_name: norm(bulkJouhouTourokuShaName),
          // カルテは常時自動作成。ここは「作成後に入力へ進むか」のUI選択のみ。
          create_karte: true,
          idempotency_key: idempotencyKey,
        },
      });
      const torihikisakiId = result?.torihikisaki_id || '';
      const yagouId = result?.yagou_id || '';
      const tenpoId = result?.tenpo_id || '';
      const karteId = result?.karte_id || '';

      setOkMsg(`作成しました: ${tName} / ${yName} / ${tenpoName}`);
      setBulkTorihikisakiName('');
      setBulkYagouName('');
      setBulkTenpoName('');
      setBulkPhone('');
      setBulkEmail('');
      setBulkTantouName('');
      setBulkAddress('');
      setBulkUrl('');
      setBulkJouhouTourokuShaName('');
      setBulkOpenKarteAfterCreate(true);

      // 既存一覧を更新し、選択を新規に寄せる
      await reloadTorihikisaki();
      if (torihikisakiId) setSelectedTorihikisakiId(torihikisakiId);
      if (yagouId) setSelectedYagouId(yagouId);
      if (tenpoId) {
        if (karteId) {
          setOkMsg(`作成しました: ${tName} / ${yName} / ${tenpoName}（カルテ: ${karteId}）`);
        }
        if (bulkOpenKarteAfterCreate) {
          nav(`/admin/tenpo/${encodeURIComponent(tenpoId)}`);
        }
      }
    } catch (e) {
      setErr(e?.message || '作成に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [
    bulkTorihikisakiName,
    bulkYagouName,
    bulkTenpoName,
    bulkPhone,
    bulkEmail,
    bulkTantouName,
    bulkAddress,
    bulkUrl,
    bulkJouhouTourokuShaName,
    bulkOpenKarteAfterCreate,
    findExistingTenpoByNames,
    reloadTorihikisaki,
    nav,
  ]);

  const onAddYagou = useCallback(async () => {
    const torihikisakiId = selectedTorihikisakiId;
    const name = norm(addYagouName);
    if (!torihikisakiId) {
      window.alert('取引先を選択してください');
      return;
    }
    if (!name) {
      window.alert('屋号名は必須です');
      return;
    }
    setErr('');
    setOkMsg('');
    setLoading(true);
    try {
      const y = await apiJson('/master/yagou', {
        method: 'POST',
        body: { name, torihikisaki_id: torihikisakiId, jotai: 'yuko' },
      });
      const yagouId = y?.yagou_id || y?.id;
      setAddYagouName('');
      await reloadYagou(torihikisakiId);
      if (yagouId) setSelectedYagouId(yagouId);
      setOkMsg(`屋号を追加しました: ${name}`);
    } catch (e) {
      setErr(e?.message || '屋号の追加に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [selectedTorihikisakiId, addYagouName, reloadYagou]);

  const onAddTenpo = useCallback(async () => {
    const torihikisakiId = selectedTorihikisakiId;
    const yagouId = selectedYagouId;
    const name = norm(addTenpoName);
    if (!torihikisakiId || !yagouId) {
      window.alert('取引先・屋号を選択してください');
      return;
    }
    if (!name) {
      window.alert('店舗名は必須です');
      return;
    }
    setErr('');
    setOkMsg('');
    setLoading(true);
    try {
      const dupQs = new URLSearchParams({
        limit: '20000',
        jotai: 'yuko',
        torihikisaki_id: torihikisakiId,
        yagou_id: yagouId,
      });
      const dupData = await apiJson(`/master/tenpo?${dupQs.toString()}`);
      const dupItems = getItems(dupData);
      const hit = dupItems.find((it) => normalizeKeyPart(it?.name) === normalizeKeyPart(name));
      if (hit?.tenpo_id) {
        const go = window.confirm(
          `同名の既存店舗が見つかりました: ${hit.name}\n既存カルテを開きますか？`
        );
        if (go) nav(`/admin/tenpo/${encodeURIComponent(hit.tenpo_id)}`);
        return;
      }

      const tenpo = await apiJson('/master/tenpo', {
        method: 'POST',
        body: { name, torihikisaki_id: torihikisakiId, yagou_id: yagouId, jotai: 'yuko' },
      });
      const tenpoId = tenpo?.tenpo_id || tenpo?.id;
      await createSoukoIfMissing(tenpoId, name);
      setAddTenpoName('');
      setOkMsg(`店舗を追加しました: ${name}`);
      if (tenpoId) nav(`/admin/tenpo/${encodeURIComponent(tenpoId)}`);
    } catch (e) {
      setErr(e?.message || '店舗の追加に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [selectedTorihikisakiId, selectedYagouId, addTenpoName, createSoukoIfMissing, nav]);

  return (
    <div className="admin-touroku-page">
      <div className="admin-touroku-content">
        <header className="admin-touroku-header">
          <div className="admin-top-left">
            {/* GlobalNav handles navigation */}
          </div>
          <div className="admin-touroku-headline">
            <h1>顧客登録（新）</h1>
            <div className="sub">torihikisaki → yagou → tenpo → souko（自動作成）</div>
          </div>
          <div className="admin-touroku-actions">
            <button onClick={reloadTorihikisaki} disabled={loading}>更新</button>
            <Link className="ghost" to="/admin/torihikisaki-meibo">名簿へ</Link>
          </div>
        </header>

        {err ? <div className="admin-touroku-err">{err}</div> : null}
        {okMsg ? <div className="admin-touroku-ok">{okMsg}</div> : null}

        <div className="admin-touroku-grid">
          <section className="card">
            <div className="card-h">
              <div className="t">新規一括作成</div>
              <div className="d">取引先・屋号・店舗を一発で作ります</div>
            </div>
            <div className="form">
              <label>
                <span>取引先名</span>
                <input value={bulkTorihikisakiName} onChange={(e) => setBulkTorihikisakiName(e.target.value)} placeholder="例: 株式会社○○" />
              </label>
              <label>
                <span>屋号名</span>
                <input value={bulkYagouName} onChange={(e) => setBulkYagouName(e.target.value)} placeholder="例: ○○カフェ" />
              </label>
              <label>
                <span>店舗名</span>
                <input value={bulkTenpoName} onChange={(e) => setBulkTenpoName(e.target.value)} placeholder="例: 新宿店" />
              </label>
              <label>
                <span>電話番号</span>
                <input value={bulkPhone} onChange={(e) => setBulkPhone(e.target.value)} placeholder="例: 03-xxxx-xxxx" />
              </label>
              <label>
                <span>メールアドレス</span>
                <input value={bulkEmail} onChange={(e) => setBulkEmail(e.target.value)} placeholder="例: info@example.com" />
              </label>
              <label>
                <span>担当者</span>
                <input value={bulkTantouName} onChange={(e) => setBulkTantouName(e.target.value)} placeholder="例: 山田太郎" />
              </label>
              <label>
                <span>住所</span>
                <input value={bulkAddress} onChange={(e) => setBulkAddress(e.target.value)} placeholder="例: 東京都..." />
              </label>
              <label>
                <span>URL</span>
                <input value={bulkUrl} onChange={(e) => setBulkUrl(e.target.value)} placeholder="https://..." />
              </label>
              <label>
                <span>情報登録者名</span>
                <input value={bulkJouhouTourokuShaName} onChange={(e) => setBulkJouhouTourokuShaName(e.target.value)} placeholder="例: 管理オペ担当" />
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={bulkOpenKarteAfterCreate}
                  onChange={(e) => setBulkOpenKarteAfterCreate(e.target.checked)}
                />
                <span>登録後にカルテ情報を入力する</span>
              </label>
              <div className="row">
                <button className="primary" onClick={onBulkCreate} disabled={loading}>一括作成</button>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-h">
              <div className="t">既存に追加</div>
              <div className="d">既存の取引先に屋号・店舗を追加します</div>
            </div>

            <div className="form">
              <label>
                <span>取引先</span>
                <select value={selectedTorihikisakiId} onChange={(e) => setSelectedTorihikisakiId(e.target.value)}>
                  <option value="">未選択</option>
                  {torihikisakiList.map((t) => (
                    <option key={t.torihikisaki_id} value={t.torihikisaki_id}>
                      {t.name} ({t.torihikisaki_id})
                    </option>
                  ))}
                </select>
              </label>

              <div className="hint">
                選択中: <code>{selectedTorihikisaki?.name || '---'}</code>
              </div>

              <label>
                <span>屋号（既存）</span>
                <select value={selectedYagouId} onChange={(e) => setSelectedYagouId(e.target.value)} disabled={!selectedTorihikisakiId}>
                  <option value="">未選択</option>
                  {yagouList.map((y) => (
                    <option key={y.yagou_id} value={y.yagou_id}>
                      {y.name} ({y.yagou_id})
                    </option>
                  ))}
                </select>
              </label>

              <div className="split">
                <label>
                  <span>屋号（新規追加）</span>
                  <input value={addYagouName} onChange={(e) => setAddYagouName(e.target.value)} placeholder="例: ○○ダイニング" />
                </label>
                <div className="row">
                  <button onClick={onAddYagou} disabled={loading || !selectedTorihikisakiId}>屋号を追加</button>
                </div>
              </div>

              <div className="split">
                <label>
                  <span>店舗（新規追加）</span>
                  <input value={addTenpoName} onChange={(e) => setAddTenpoName(e.target.value)} placeholder="例: 池袋店" />
                </label>
                <div className="row">
                  <button className="primary" onClick={onAddTenpo} disabled={loading || !selectedTorihikisakiId || !selectedYagouId}>店舗を追加</button>
                </div>
              </div>

              <div className="hint">
                店舗作成後は <code>souko</code>（顧客ストレージ）を自動作成し、店舗カルテへ遷移します。
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
