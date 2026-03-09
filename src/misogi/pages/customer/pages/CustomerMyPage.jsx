import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import './customer-mypage.css';

function authHeaders() {
  const token =
    localStorage.getItem('idToken') ||
    localStorage.getItem('cognito_id_token') ||
    localStorage.getItem('id_token') ||
    localStorage.getItem('accessToken') ||
    localStorage.getItem('cognito_access_token') ||
    localStorage.getItem('token') ||
    '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function asItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.rows)) return data.rows;
  return [];
}

function safeArr(v) {
  return Array.isArray(v) ? v : [];
}

function norm(v) {
  return String(v || '').trim();
}

function ensureHttpUrl(raw) {
  const s = norm(raw);
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

const MISOGI_CUSTOMER_MYPAGE_BASE = String(
  import.meta.env?.VITE_MISOGI_CUSTOMER_MYPAGE_URL || 'https://misesapo.co.jp/misogi/#/customer/mypage'
).trim();

function buildCustomerMyPageUrl(tenpoId) {
  const id = encodeURIComponent(norm(tenpoId) || 'store');
  const base = MISOGI_CUSTOMER_MYPAGE_BASE || 'https://misesapo.co.jp/misogi/#/customer/mypage';
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}tenpo_id=${id}`;
}

function normalizeStoreRow(row) {
  const id = norm(row?.tenpo_id || row?.id || row?.store_id);
  const name = norm(row?.name || row?.tenpo_name || row?.store_name) || '(店舗名未設定)';
  const address = norm(row?.address) || '住所未設定';
  const yagou = norm(row?.yagou_name);
  const sourceUrl = row?.customer_mypage_url || row?.mypage_url || row?.url;
  const explicitUrl = ensureHttpUrl(sourceUrl);
  const url = /customer\/mypage/i.test(explicitUrl) ? explicitUrl : buildCustomerMyPageUrl(id);
  return {
    id: id || name,
    name,
    yagou,
    address,
    url,
    raw: row && typeof row === 'object' ? row : {},
  };
}

function fileExt(fileName, key = '') {
  const base = norm(fileName || key);
  const i = base.lastIndexOf('.');
  if (i < 0) return '';
  return base.slice(i + 1).toLowerCase();
}

function isImageContentType(ct = '') {
  return String(ct || '').toLowerCase().startsWith('image/');
}

function isImageFile(fileName, contentType, key = '') {
  if (isImageContentType(contentType)) return true;
  const ext = fileExt(fileName, key);
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif', 'heic', 'heif'].includes(ext);
}

function fileKindLabel(fileName, contentType, key) {
  if (isImageFile(fileName, contentType, key)) return 'IMG';
  const ext = fileExt(fileName, key);
  if (ext === 'pdf') return 'PDF';
  if (['doc', 'docx'].includes(ext)) return 'DOC';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'SHEET';
  if (['zip', 'rar', '7z'].includes(ext)) return 'ZIP';
  if (['mp4', 'mov', 'avi'].includes(ext)) return 'VIDEO';
  return ext ? ext.toUpperCase() : 'FILE';
}

function parseYmdToInt(ymd) {
  const s = norm(ymd);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return Number(`${m[1]}${m[2]}${m[3]}`);
}

function sortSupportHistoryNewestFirst(list) {
  const arr = Array.isArray(list) ? list.slice() : [];
  const keyed = arr.map((it, idx) => {
    const key = parseYmdToInt(it?.date);
    return { it, idx, key: key == null ? -1 : key };
  });
  keyed.sort((a, b) => {
    if (a.key !== b.key) return b.key - a.key;
    return a.idx - b.idx;
  });
  return keyed.map((x) => x.it);
}

function fmtDateTimeJst(iso) {
  const s = norm(iso);
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  try {
    return new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return s;
  }
}

function formatBytes(size) {
  const n = Number(size || 0);
  if (!Number.isFinite(n) || n <= 0) return '-';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function normalizeSoukoFiles(soukoRecord) {
  return safeArr(soukoRecord?.files)
    .map((it) => {
      const previewUrl = norm(it?.preview_url);
      const getUrl = norm(it?.get_url || it?.url);
      return {
        key: norm(it?.key),
        file_name: norm(it?.file_name),
        content_type: norm(it?.content_type),
        size: Number(it?.size || 0) || 0,
        uploaded_at: norm(it?.uploaded_at),
        kubun: norm(it?.kubun),
        doc_category: norm(it?.doc_category),
        open_url: previewUrl || getUrl,
      };
    })
    .filter((it) => it.key);
}

export default function CustomerMyPage() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stores, setStores] = useState([]);

  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailTenpo, setDetailTenpo] = useState(null);
  const [detailSoukoFiles, setDetailSoukoFiles] = useState([]);

  const scopedTenpoId = useMemo(() => {
    const sp = new URLSearchParams(location.search || '');
    return norm(sp.get('tenpo_id'));
  }, [location.search]);

  const masterApiBase = useMemo(() => (
    String(import.meta.env.VITE_MASTER_API_BASE || '/api-master').replace(/\/$/, '')
  ), []);

  const loadStores = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${masterApiBase}/master/tenpo?limit=20000&jotai=yuko`, {
        headers: { ...authHeaders() },
        cache: 'no-store',
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`店舗一覧の取得に失敗 (${res.status}) ${text}`.trim());
      }
      const data = await res.json();
      const rows = asItems(data).map(normalizeStoreRow);
      setStores(rows);
    } catch (e) {
      setError(String(e?.message || e || '店舗一覧の取得に失敗しました'));
      setStores([]);
    } finally {
      setLoading(false);
    }
  }, [masterApiBase]);

  const loadScopedDetail = useCallback(async () => {
    if (!scopedTenpoId) {
      setDetailTenpo(null);
      setDetailSoukoFiles([]);
      setDetailError('');
      return;
    }

    setDetailLoading(true);
    setDetailError('');
    try {
      let tenpoRow = null;
      const listRes = await fetch(
        `${masterApiBase}/master/tenpo?limit=5&jotai=yuko&tenpo_id=${encodeURIComponent(scopedTenpoId)}`,
        { headers: { ...authHeaders() }, cache: 'no-store' }
      );
      if (listRes.ok) {
        const listData = await listRes.json();
        tenpoRow = asItems(listData)?.[0] || null;
      }

      if (!tenpoRow) {
        const idRes = await fetch(`${masterApiBase}/master/tenpo/${encodeURIComponent(scopedTenpoId)}`, {
          headers: { ...authHeaders() },
          cache: 'no-store',
        });
        if (idRes.ok) {
          tenpoRow = await idRes.json();
        }
      }

      if (!tenpoRow) {
        throw new Error(`店舗(${scopedTenpoId})が見つかりません`);
      }

      setDetailTenpo(tenpoRow);

      const soukoRes = await fetch(
        `${masterApiBase}/master/souko?limit=20&jotai=yuko&tenpo_id=${encodeURIComponent(scopedTenpoId)}`,
        { headers: { ...authHeaders() }, cache: 'no-store' }
      );
      if (soukoRes.ok) {
        const soukoData = await soukoRes.json();
        const souko = asItems(soukoData)?.[0] || null;
        setDetailSoukoFiles(normalizeSoukoFiles(souko));
      } else {
        setDetailSoukoFiles([]);
      }
    } catch (e) {
      setDetailTenpo(null);
      setDetailSoukoFiles([]);
      setDetailError(String(e?.message || e || '詳細の取得に失敗しました'));
    } finally {
      setDetailLoading(false);
    }
  }, [masterApiBase, scopedTenpoId]);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  useEffect(() => {
    loadScopedDetail();
  }, [loadScopedDetail]);

  const scopedStores = useMemo(() => {
    if (!scopedTenpoId) return stores;
    const key = scopedTenpoId.toLowerCase();
    return stores.filter((it) => norm(it.id).toLowerCase() === key);
  }, [stores, scopedTenpoId]);

  const activeStore = useMemo(() => {
    if (!scopedTenpoId) return null;
    return scopedStores[0] || stores.find((it) => norm(it.id) === scopedTenpoId) || null;
  }, [scopedStores, stores, scopedTenpoId]);

  const effectiveTenpo = detailTenpo || activeStore?.raw || null;
  const spec = effectiveTenpo?.karte_detail?.spec || {};

  const supportHistory = useMemo(() => {
    const rows = safeArr(effectiveTenpo?.karte_detail?.support_history);
    return sortSupportHistoryNewestFirst(rows);
  }, [effectiveTenpo]);

  const basicInfoRows = useMemo(() => {
    if (!effectiveTenpo && !activeStore) return [];
    const tenpoId = norm(effectiveTenpo?.tenpo_id || effectiveTenpo?.id || activeStore?.id);
    const myPageUrl = buildCustomerMyPageUrl(tenpoId);
    const torihikisaki = norm(
      effectiveTenpo?.torihikisaki_name ||
      effectiveTenpo?.torihikisaki ||
      effectiveTenpo?.company_name ||
      effectiveTenpo?.customer_name
    );
    return [
      { label: '法人', value: torihikisaki || '-' },
      { label: '屋号', value: norm(effectiveTenpo?.yagou_name || activeStore?.yagou) || '-' },
      { label: '店舗名', value: norm(effectiveTenpo?.name || activeStore?.name) || '-' },
      { label: '住所', value: norm(effectiveTenpo?.address || activeStore?.address) || '-' },
      { label: '電話番号', value: norm(effectiveTenpo?.phone) || '-' },
      { label: '担当者', value: norm(spec?.customer_contact_name || effectiveTenpo?.tantou_name || effectiveTenpo?.contact_name) || '-' },
      { label: '営業時間', value: norm(spec?.business_hours || effectiveTenpo?.business_hours || effectiveTenpo?.eigyou_jikan) || '-' },
      { label: 'お客様マイページURL', value: myPageUrl, href: myPageUrl },
    ];
  }, [effectiveTenpo, activeStore, spec?.customer_contact_name, spec?.business_hours]);

  const detailHeadline = useMemo(() => {
    const yagou = norm(effectiveTenpo?.yagou_name || activeStore?.yagou);
    const name = norm(effectiveTenpo?.name || activeStore?.name);
    if (yagou && name) return `${yagou} / ${name}`;
    return name || yagou || '店舗詳細';
  }, [effectiveTenpo, activeStore]);

  return (
    <div className="customer-mypage customer-mypage--pop">
      <header className="customer-mypage-hero">
        <p className="customer-mypage-kicker">MISESAPO CUSTOMER PORTAL</p>
        <h1>お客様マイページ</h1>
        <p className="customer-mypage-sub">
          {scopedTenpoId
            ? `基本情報 / 対応履歴 / ストレージを確認できます（${scopedTenpoId}）`
            : '店舗を選択して、基本情報・対応履歴・ストレージをご確認ください。'}
        </p>
      </header>

      {error ? <p className="customer-mypage-error">{error}</p> : null}
      {detailError ? <p className="customer-mypage-error">{detailError}</p> : null}

      {!scopedTenpoId ? (
        <section className="customer-store-grid-wrap">
          <div className="customer-mypage-summary">
            <span>表示件数: {scopedStores.length}</span>
            <span>全件数: {stores.length}</span>
            <button type="button" className="btn btn-secondary" onClick={loadStores} disabled={loading || detailLoading}>
              {loading ? '読込中...' : '更新'}
            </button>
          </div>
          <div className="customer-store-grid">
            {(!loading && scopedStores.length === 0) ? (
              <div className="customer-store-empty">表示対象がありません</div>
            ) : null}
            {scopedStores.map((it) => (
              <article key={it.id} className="customer-store-card">
                <div className="customer-store-card-head">
                  <h2>{it.name}</h2>
                  <span className="chip">{it.id}</span>
                </div>
                <p className="customer-store-yagou">{it.yagou || '屋号未設定'}</p>
                <p className="customer-store-address">{it.address}</p>
                <a className="customer-store-link" href={it.url}>この店舗のページを開く</a>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="customer-detail-layout" aria-busy={detailLoading ? 'true' : 'false'}>
          <div className="customer-detail-title">{detailHeadline}</div>

          <article className="customer-panel">
            <div className="customer-panel-head">
              <h3>基本情報</h3>
            </div>
            <dl className="customer-basic-grid">
              {basicInfoRows.map((row) => (
                <div key={row.label} className="customer-basic-row">
                  <dt>{row.label}</dt>
                  <dd>
                    {row.href ? (
                      <a href={row.href} target="_blank" rel="noreferrer">{row.value}</a>
                    ) : row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </article>

          <article className="customer-panel">
            <div className="customer-panel-head">
              <h3>対応履歴</h3>
              <span className="count">{supportHistory.length}</span>
            </div>
            {supportHistory.length === 0 ? (
              <p className="customer-muted">対応履歴はまだありません。</p>
            ) : (
              <div className="customer-history-list">
                {supportHistory.map((h, idx) => {
                  const logs = safeArr(h?.logs).filter((lg) => norm(lg?.message));
                  return (
                    <article key={norm(h?.history_id) || `history-${idx}`} className="customer-history-card">
                      <div className="customer-history-top">
                        <span className="date">{norm(h?.date) || '-'}</span>
                        <span className="status">{norm(h?.status) || 'open'}</span>
                      </div>
                      <p><strong>件名:</strong> {norm(h?.topic) || '-'}</p>
                      <p><strong>対応:</strong> {norm(h?.action) || '-'}</p>
                      <p><strong>結果:</strong> {norm(h?.outcome) || '-'}</p>
                      <p className="customer-muted small">
                        更新: {fmtDateTimeJst(h?.updated_at) || '-'} / 返信 {logs.length}件
                      </p>
                    </article>
                  );
                })}
              </div>
            )}
          </article>

          <article className="customer-panel customer-panel-full">
            <div className="customer-panel-head">
              <h3>ストレージ</h3>
              <span className="count">{detailSoukoFiles.length}</span>
            </div>
            {detailSoukoFiles.length === 0 ? (
              <p className="customer-muted">登録済みファイルはありません。</p>
            ) : (
              <div className="customer-storage-grid">
                {detailSoukoFiles.slice().reverse().map((f) => (
                  <article key={f.key} className="customer-storage-card">
                    <div className="thumb">
                      {isImageFile(f.file_name, f.content_type, f.key) && f.open_url ? (
                        <img src={f.open_url} alt={f.file_name || f.key} loading="lazy" />
                      ) : (
                        <span>{fileKindLabel(f.file_name, f.content_type, f.key)}</span>
                      )}
                    </div>
                    <div className="meta">
                      <div className="name" title={f.file_name || f.key}>{f.file_name || '(no name)'}</div>
                      <div className="sub">
                        <span>{f.doc_category || '未分類'}</span>
                        <span>{formatBytes(f.size)}</span>
                        <span>{fmtDateTimeJst(f.uploaded_at) || f.uploaded_at || '-'}</span>
                      </div>
                    </div>
                    <div className="actions">
                      {f.open_url ? (
                        <a href={f.open_url} target="_blank" rel="noreferrer">開く</a>
                      ) : (
                        <span className="customer-muted">URLなし</span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </article>
        </section>
      )}
    </div>
  );
}
