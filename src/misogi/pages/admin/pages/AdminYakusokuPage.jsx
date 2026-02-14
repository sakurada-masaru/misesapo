import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import './admin-yotei-timeline.css'; // Reuse styling
import { normalizeGatewayBase, YOTEI_GATEWAY } from '../../shared/api/gatewayBase';
// Hamburger / admin-top are provided by GlobalNav.

function isLocalUiHost() {
  if (typeof window === 'undefined') return false;
  const h = window.location?.hostname || '';
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
}

const IS_LOCAL = import.meta.env?.DEV || isLocalUiHost();
const API_BASE = IS_LOCAL
  ? '/api'
  : normalizeGatewayBase(import.meta.env?.VITE_API_BASE, YOTEI_GATEWAY);
const YAKUSOKU_FALLBACK_BASE = IS_LOCAL
  ? '/api2'
  : normalizeGatewayBase(import.meta.env?.VITE_YAKUSOKU_API_BASE, API_BASE);
const MASTER_API_BASE = IS_LOCAL
  ? '/api-master'
  : normalizeGatewayBase(import.meta.env?.VITE_MASTER_API_BASE, 'https://jtn6in2iuj.execute-api.ap-northeast-1.amazonaws.com/prod');

const PLAN_BUCKETS = [
  { key: 'monthly', label: '毎月' },
  { key: 'odd_month', label: '奇数月' },
  { key: 'even_month', label: '偶数月' },
  { key: 'quarterly_a', label: '四半期A (1/5/9月)' },
  { key: 'quarterly_b', label: '四半期B (3/7/11月)' },
  { key: 'half_year_a', label: '半年A (1/7月)' },
  { key: 'half_year_b', label: '半年B (5/11月)' },
  { key: 'yearly', label: '年1回' },
];

function createEmptyTaskMatrix() {
  return Object.fromEntries(PLAN_BUCKETS.map((b) => [b.key, []]));
}

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

async function fetchYakusokuWithFallback(path, options = {}) {
  const primaryBase = API_BASE.replace(/\/$/, '');
  const primaryRes = await fetch(`${primaryBase}${path}`, options);
  if (primaryRes.ok) return primaryRes;
  if (![401, 403, 404].includes(primaryRes.status)) return primaryRes;
  const fallbackBase = YAKUSOKU_FALLBACK_BASE.replace(/\/$/, '');
  if (fallbackBase === primaryBase) return primaryRes;
  return fetch(`${fallbackBase}${path}`, options);
}

export default function AdminYakusokuPage() {
  const [items, setItems] = useState([]);
  const [services, setServices] = useState([]);
  const [tenpos, setTenpos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalData, setModalData] = useState(null);
  const [saving, setSaving] = useState(false);

  const normalizeServiceConcept = useCallback((svc) => {
    const raw = String(svc?.category_concept || svc?.category || '').trim();
    const map = {
      kitchen_haccp: '厨房衛生(HACCP)',
      aircon: '空調設備',
      floor: 'フロア清掃',
      pest_hygiene: '害虫衛生',
      maintenance: '設備メンテ',
      window_wall: '窓・壁面',
      cleaning: '清掃',
      pest: '害虫',
      other: 'その他',
    };
    return map[raw] || raw || '未分類';
  }, []);

  const normalizeTaskMatrix = useCallback((taskMatrix) => {
    const base = createEmptyTaskMatrix();
    if (!taskMatrix || typeof taskMatrix !== 'object') return base;
    for (const b of PLAN_BUCKETS) {
      const arr = taskMatrix[b.key];
      base[b.key] = Array.isArray(arr) ? arr.map((x) => String(x)).filter(Boolean) : [];
    }
    return base;
  }, []);

  const normalizeServiceSelection = useCallback((src) => {
    const ids = Array.isArray(src?.service_ids)
      ? src.service_ids.map((x) => String(x)).filter(Boolean)
      : [];
    const names = Array.isArray(src?.service_names)
      ? src.service_names.map((x) => String(x)).filter(Boolean)
      : [];

    if (!ids.length && src?.service_id) ids.push(String(src.service_id));
    if (!names.length && src?.service_name) names.push(String(src.service_name));
    return { service_ids: ids, service_names: names };
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchYakusokuWithFallback('/yakusoku', { headers: authHeaders() });
      if (!res.ok) throw new Error(`Yakusoku HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.items || []);
    } catch (e) {
      console.error(e);
      window.alert('yakusokuの取得に失敗しました（権限または接続先を確認）');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    const run = async () => {
      try {
        const base = MASTER_API_BASE.replace(/\/$/, '');
        const res = await fetch(`${base}/master/service?limit=2000&jotai=yuko`, { headers: authHeaders(), cache: 'no-store' });
        if (!res.ok) throw new Error(`Service HTTP ${res.status}`);
        const data = await res.json();
        setServices(Array.isArray(data) ? data : (data?.items || []));
      } catch (e) {
        console.error('Failed to fetch services:', e);
        setServices([]);
      }
    };
    run();
  }, []);

  useEffect(() => {
    const run = async () => {
      try {
        const base = MASTER_API_BASE.replace(/\/$/, '');
        const [toriRes, yagouRes, tenpoRes] = await Promise.all([
          fetch(`${base}/master/torihikisaki?limit=5000&jotai=yuko`, { headers: authHeaders(), cache: 'no-store' }),
          fetch(`${base}/master/yagou?limit=8000&jotai=yuko`, { headers: authHeaders(), cache: 'no-store' }),
          fetch(`${base}/master/tenpo?limit=20000&jotai=yuko`, { headers: authHeaders(), cache: 'no-store' }),
        ]);
        if (!toriRes.ok) throw new Error(`Torihikisaki HTTP ${toriRes.status}`);
        if (!yagouRes.ok) throw new Error(`Yagou HTTP ${yagouRes.status}`);
        if (!tenpoRes.ok) throw new Error(`Tenpo HTTP ${tenpoRes.status}`);

        const toriData = await toriRes.json();
        const yagouData = await yagouRes.json();
        const tenpoData = await tenpoRes.json();
        const toriItems = Array.isArray(toriData) ? toriData : (toriData?.items || []);
        const yagouItems = Array.isArray(yagouData) ? yagouData : (yagouData?.items || []);
        const tenpoItems = Array.isArray(tenpoData) ? tenpoData : (tenpoData?.items || []);

        const toriNameById = new Map(toriItems.map((it) => [it?.torihikisaki_id || it?.id, it?.name || '']));
        const yagouNameById = new Map(yagouItems.map((it) => [it?.yagou_id || it?.id, it?.name || '']));

        const normalized = tenpoItems
          .map((it) => {
            const tenpo_id = it?.tenpo_id || it?.id || '';
            const name = it?.name || '';
            const torihikisaki_id = it?.torihikisaki_id || '';
            const yagou_id = it?.yagou_id || '';
            const torihikisaki_name = toriNameById.get(torihikisaki_id) || '';
            const yagou_name = yagouNameById.get(yagou_id) || '';
            const search_blob = [
              name,
              tenpo_id,
              yagou_name,
              yagou_id,
              torihikisaki_name,
              torihikisaki_id,
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();
            return { tenpo_id, name, torihikisaki_id, yagou_id, torihikisaki_name, yagou_name, search_blob };
          })
          .filter((it) => it.tenpo_id && it.name)
          .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
        setTenpos(normalized);
      } catch (e) {
        console.error('Failed to fetch tenpos:', e);
        setTenpos([]);
      }
    };
    run();
  }, []);

  const openNew = () => {
    setModalData({
      isNew: true,
      type: 'teiki',
      tenpo_name: '',
      service_id: '',
      service_name: '',
      service_ids: [],
      service_names: [],
      service_query: '',
      monthly_quota: 1,
      price: 0,
      start_date: dayjs().format('YYYY-MM-DD'),
      status: 'active',
      memo: '',
      recurrence_rule: { type: 'flexible', task_matrix: createEmptyTaskMatrix() },
      _tagDrafts: {},
      _tagSearch: {},
    });
  };

  const openEdit = (item) => {
    const rr = item?.recurrence_rule && typeof item.recurrence_rule === 'object'
      ? item.recurrence_rule
      : { type: 'flexible' };
    const multiSvc = normalizeServiceSelection(item);
    setModalData({
      ...item,
      ...multiSvc,
      isNew: false,
      service_query: item?.service_name || item?.service_id || '',
      recurrence_rule: {
        ...rr,
        task_matrix: normalizeTaskMatrix(rr.task_matrix),
      },
      _tagDrafts: {},
      _tagSearch: {},
    });
  };

  const tenpoCandidates = useMemo(() => {
    const q = String(modalData?.tenpo_name || '').trim().toLowerCase();
    if (!q) return tenpos.slice(0, 12);
    return tenpos
      .filter((it) => (it.search_blob || '').includes(q))
      .slice(0, 20);
  }, [modalData?.tenpo_name, tenpos]);

  const serviceCandidates = useMemo(() => {
    const q = String(modalData?.service_query || '').trim().toLowerCase();
    if (!q) return services.slice(0, 12);
    return services
      .filter((s) => {
        const blob = [
          s?.name,
          s?.service_id,
          s?.category,
          s?.category_concept,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return blob.includes(q);
      })
      .slice(0, 20);
  }, [modalData?.service_query, services]);

  const setBucketDraft = useCallback((bucketKey, value) => {
    setModalData((prev) => ({
      ...prev,
      _tagDrafts: {
        ...(prev?._tagDrafts || {}),
        [bucketKey]: value,
      },
    }));
  }, []);

  const setBucketSearch = useCallback((bucketKey, value) => {
    setModalData((prev) => ({
      ...prev,
      _tagSearch: {
        ...(prev?._tagSearch || {}),
        [bucketKey]: value,
      },
    }));
  }, []);

  const serviceCandidatesForTag = useCallback((qRaw) => {
    const q = String(qRaw || '').trim().toLowerCase();
    const list = Array.isArray(services) ? services : [];
    if (!q) return list.slice(0, 80);
    return list
      .filter((s) => {
        const blob = [
          s?.name,
          s?.service_id,
          s?.category,
          s?.category_concept,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return blob.includes(q);
      })
      .slice(0, 80);
  }, [services]);

  const addBucketTag = useCallback((bucketKey) => {
    setModalData((prev) => {
      const draft = String(prev?._tagDrafts?.[bucketKey] || '').trim();
      if (!draft) return prev;
      const tm = normalizeTaskMatrix(prev?.recurrence_rule?.task_matrix);
      const nextSet = new Set(tm[bucketKey] || []);
      nextSet.add(draft);
      return {
        ...prev,
        recurrence_rule: {
          ...(prev?.recurrence_rule || { type: 'flexible' }),
          task_matrix: {
            ...tm,
            [bucketKey]: [...nextSet],
          },
        },
        _tagDrafts: {
          ...(prev?._tagDrafts || {}),
          [bucketKey]: '',
        },
      };
    });
  }, [normalizeTaskMatrix]);

  const removeBucketTag = useCallback((bucketKey, tag) => {
    setModalData((prev) => {
      const tm = normalizeTaskMatrix(prev?.recurrence_rule?.task_matrix);
      return {
        ...prev,
        recurrence_rule: {
          ...(prev?.recurrence_rule || { type: 'flexible' }),
          task_matrix: {
            ...tm,
            [bucketKey]: (tm[bucketKey] || []).filter((x) => String(x) !== String(tag)),
          },
        },
      };
    });
  }, [normalizeTaskMatrix]);

  const save = async () => {
    setSaving(true);
    try {
      const method = modalData.isNew ? 'POST' : 'PUT';
      const path = modalData.isNew ? '/yakusoku' : `/yakusoku/${modalData.yakusoku_id}`;
      const payload = { ...modalData };
      const serviceIds = Array.isArray(payload.service_ids)
        ? payload.service_ids.map((x) => String(x)).filter(Boolean)
        : (payload.service_id ? [String(payload.service_id)] : []);
      const serviceNames = Array.isArray(payload.service_names)
        ? payload.service_names.map((x) => String(x)).filter(Boolean)
        : (payload.service_name ? [String(payload.service_name)] : []);
      payload.service_ids = serviceIds;
      payload.service_names = serviceNames;
      // Backward compatibility: keep single-value fields for existing readers.
      payload.service_id = serviceIds[0] || '';
      payload.service_name = serviceNames[0] || '';
      delete payload.service_query;
      delete payload._tagDrafts;
      delete payload._tagSearch;
      const res = await fetchYakusokuWithFallback(path, {
        method,
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to save');
      setModalData(null);
      fetchItems();
    } catch (e) {
      window.alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (id) => {
    if (!window.confirm('この案件を削除（論理削除）しますか？')) return;
    try {
      const res = await fetchYakusokuWithFallback(`/yakusoku/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) throw new Error(`Yakusoku DELETE HTTP ${res.status}`);
      fetchItems();
    } catch (e) {
      window.alert(e.message);
    }
  };

  return (
    <div className="admin-yotei-timeline-page">
      <div className="admin-yotei-timeline-content">
        <header className="yotei-head">
          <div className="admin-top-left">
                        {/* GlobalNav handles navigation */}
          </div>
          <h1>実案件・定期管理 (yakusoku)</h1>
          <div className="yotei-head-actions">
            <button className="primary" onClick={openNew}>新規案件登録</button>
            <button onClick={fetchItems} disabled={loading}>{loading ? '...' : '更新'}</button>
          </div>
        </header>

        <div className="yakusoku-list" style={{ padding: '20px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', color: 'white' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #444' }}>
                <th style={{ padding: '10px' }}>ID</th>
                <th style={{ padding: '10px' }}>現場名</th>
                <th style={{ padding: '10px' }}>サービス</th>
                <th style={{ padding: '10px' }}>種別</th>
                <th style={{ padding: '10px' }}>月枠</th>
                <th style={{ padding: '10px' }}>当月消化</th>
                <th style={{ padding: '10px' }}>単価</th>
                <th style={{ padding: '10px' }}>状態</th>
                <th style={{ padding: '10px' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map(it => {
                const monthKey = dayjs().format('YYYY-MM');
                const consumed = it.consumption_count ? (it.consumption_count[monthKey] || 0) : 0;
                return (
                  <tr key={it.yakusoku_id} style={{ borderBottom: '1px solid #333' }}>
                    <td style={{ padding: '10px', fontSize: '12px', color: '#888' }}>{it.yakusoku_id}</td>
                    <td style={{ padding: '10px' }}>{it.tenpo_name || '---'}</td>
                    <td style={{ padding: '10px' }}>
                      {(() => {
                        const ids = Array.isArray(it.service_ids) ? it.service_ids : [];
                        const names = Array.isArray(it.service_names) ? it.service_names : [];
                        const primary = names[0] || it.service_name || ids[0] || it.service_id || '---';
                        const extra = Math.max(0, Math.max(ids.length, names.length) - 1);
                        return extra > 0 ? `${primary} (+${extra})` : primary;
                      })()}
                    </td>
                    <td style={{ padding: '10px' }}>{it.type === 'teiki' ? '定期' : '単発'}</td>
                    <td style={{ padding: '10px' }}>{it.monthly_quota || '-'}回</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ color: consumed >= (it.monthly_quota || 0) ? '#4caf50' : '#ff9800' }}>
                        {consumed}
                      </span>
                    </td>
                    <td style={{ padding: '10px' }}>¥{(it.price || 0).toLocaleString()}</td>
                    <td style={{ padding: '10px' }}>{it.status}</td>
                    <td style={{ padding: '10px' }}>
                      <button onClick={() => openEdit(it)}>編集</button>
                      <button className="danger" onClick={() => deleteItem(it.yakusoku_id)}>削除</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modalData && (
        <div className="yotei-modal-overlay" onClick={() => setModalData(null)}>
          <div className="yotei-modal" onClick={e => e.stopPropagation()}>
            <div className="yotei-modal-header">
              <h2>{modalData.isNew ? '新規案件登録' : '案件編集'}</h2>
              <button onClick={() => setModalData(null)} style={{ background: 'none', border: 'none', color: 'white', fontSize: 24 }}>×</button>
            </div>
            <div className="yotei-modal-content">
              <div className="yotei-form-group">
                <label>種別</label>
                <select value={modalData.type} onChange={e => setModalData({ ...modalData, type: e.target.value })}>
                  <option value="teiki">定期 (teiki)</option>
                  <option value="tanpatsu">単発 (tanpatsu)</option>
                </select>
              </div>
              <div className="yotei-form-group">
                <label>現場名（統合検索）</label>
                <input
                  type="text"
                  value={modalData.tenpo_name || ''}
                  onChange={e => {
                    const nextName = e.target.value;
                    const exact = tenpos.find((t) => t.name === nextName);
                    setModalData({
                      ...modalData,
                      tenpo_name: nextName,
                      tenpo_id: exact?.tenpo_id || modalData.tenpo_id || '',
                    });
                  }}
                  placeholder="取引先 / 屋号 / 店舗 / ID で検索"
                />
                <div style={{ marginTop: 8, display: 'grid', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                  {tenpoCandidates.map((tp) => (
                    <button
                      key={tp.tenpo_id}
                      type="button"
                      onClick={() => setModalData({ ...modalData, tenpo_name: tp.name, tenpo_id: tp.tenpo_id })}
                      style={{
                        textAlign: 'left',
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: '1px solid rgba(255,255,255,0.14)',
                        background: 'rgba(255,255,255,0.04)',
                        color: 'white',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{tp.name}</div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>
                        {(tp.torihikisaki_name || '取引先未設定')} / {(tp.yagou_name || '屋号未設定')}
                      </div>
                      <div style={{ fontSize: 11, opacity: 0.65 }}>
                        {tp.tenpo_id} ・ {tp.yagou_id || '-'} ・ {tp.torihikisaki_id || '-'}
                      </div>
                    </button>
                  ))}
                  {!tenpoCandidates.length && (
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>候補がありません。新規顧客登録から作成してください。</div>
                  )}
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>選択ID: {modalData.tenpo_id || '未選択'}</span>
                  <Link to="/admin/torihikisaki-touroku" style={{ color: '#8bd8ff', textDecoration: 'none' }}>
                    新規顧客登録へ →
                  </Link>
                </div>
              </div>
              <div className="yotei-form-group">
                <label>サービス</label>
                <input
                  type="text"
                  value={modalData.service_query || ''}
                  onChange={(e) => {
                    const q = e.target.value;
                    setModalData({
                      ...modalData,
                      service_query: q,
                    });
                  }}
                  placeholder="サービス名 / ID / カテゴリで検索"
                />
                <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(Array.isArray(modalData.service_names) ? modalData.service_names : []).map((nm, idx) => {
                    const sid = String((modalData.service_ids || [])[idx] || '');
                    const key = `${sid || nm}-${idx}`;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          const ids = [...(modalData.service_ids || [])];
                          const names = [...(modalData.service_names || [])];
                          ids.splice(idx, 1);
                          names.splice(idx, 1);
                          setModalData({
                            ...modalData,
                            service_ids: ids,
                            service_names: names,
                            service_id: ids[0] || '',
                            service_name: names[0] || '',
                          });
                        }}
                        style={{
                          border: '1px solid rgba(255,255,255,0.18)',
                          background: 'rgba(255,255,255,0.08)',
                          color: 'white',
                          borderRadius: 999,
                          padding: '4px 10px',
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                        title="クリックで削除"
                      >
                        {nm || sid} ×
                      </button>
                    );
                  })}
                  {!(modalData.service_ids || []).length ? (
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>未選択</span>
                  ) : null}
                </div>
                <div style={{ marginTop: 8, display: 'grid', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                  {serviceCandidates.map((s) => (
                    <button
                      key={String(s?.service_id || '')}
                      type="button"
                      onClick={() => {
                        const sid = String(s?.service_id || '');
                        const sname = String(s?.name || sid);
                        const ids = [...(modalData.service_ids || [])];
                        const names = [...(modalData.service_names || [])];
                        if (!ids.includes(sid)) {
                          ids.push(sid);
                          names.push(sname);
                        }
                        setModalData({
                          ...modalData,
                          service_query: '',
                          service_ids: ids,
                          service_names: names,
                          service_id: ids[0] || '',
                          service_name: names[0] || '',
                          price:
                            modalData.isNew && Number(s?.default_price || 0) > 0 && ids.length === 1
                              ? Number(s.default_price)
                              : modalData.price,
                        });
                      }}
                      style={{
                        textAlign: 'left',
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: '1px solid rgba(255,255,255,0.14)',
                        background: 'rgba(255,255,255,0.04)',
                        color: 'white',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{String(s?.name || s?.service_id || '')}</div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>
                        {normalizeServiceConcept(s)} / {String(s?.category || '未分類')}
                      </div>
                      <div style={{ fontSize: 11, opacity: 0.65 }}>
                        {String(s?.service_id || '-')} ・ 標準単価 ¥{Number(s?.default_price || 0).toLocaleString()}
                      </div>
                    </button>
                  ))}
                  {!serviceCandidates.length ? (
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>候補がありません。サービスマスタを確認してください。</div>
                  ) : null}
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
                  選択件数: {(modalData.service_ids || []).length} 件
                </div>
              </div>
              {modalData.type === 'teiki' && (
                <div className="yotei-form-group">
                  <label>定期メニュー（月別タグ）</label>
                  <div style={{ display: 'grid', gap: 10 }}>
                    {PLAN_BUCKETS.map((b) => {
                      const matrix = normalizeTaskMatrix(modalData?.recurrence_rule?.task_matrix);
                      const tags = matrix[b.key] || [];
                      const draft = String(modalData?._tagDrafts?.[b.key] || '');
                      const search = String(modalData?._tagSearch?.[b.key] || '');
                      const tagCandidates = serviceCandidatesForTag(search);
                      return (
                        <div key={b.key} style={{ border: '1px solid rgba(255,255,255,0.14)', borderRadius: 10, padding: 10 }}>
                          <div style={{ fontWeight: 700, marginBottom: 8 }}>{b.label}</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                            {tags.length ? tags.map((tag) => (
                              <button
                                key={`${b.key}-${tag}`}
                                type="button"
                                onClick={() => removeBucketTag(b.key, tag)}
                                style={{
                                  border: '1px solid rgba(255,255,255,0.18)',
                                  background: 'rgba(255,255,255,0.08)',
                                  color: 'white',
                                  borderRadius: 999,
                                  padding: '4px 10px',
                                  fontSize: 12,
                                  cursor: 'pointer',
                                }}
                                title="クリックで削除"
                              >
                                {tag} ×
                              </button>
                            )) : <span style={{ fontSize: 12, color: 'var(--muted)' }}>未設定</span>}
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input
                              type="text"
                              value={search}
                              onChange={(e) => setBucketSearch(b.key, e.target.value)}
                              placeholder="検索 (サービス名/ID/カテゴリ)"
                              style={{ minWidth: 220 }}
                            />
                            <select value={draft} onChange={(e) => setBucketDraft(b.key, e.target.value)}>
                              <option value="">追加するタグを選択</option>
                              {tagCandidates.map((s) => (
                                <option key={String(s?.service_id || '')} value={String(s?.service_id || '')}>
                                  {String(s?.name || s?.service_id || '')}
                                </option>
                              ))}
                            </select>
                            <button type="button" onClick={() => addBucketTag(b.key)}>追加</button>
                          </div>
                          <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>
                            候補 {tagCandidates.length} 件（検索はこのバケット内のみ適用）
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="yotei-form-group">
                <label>月間規定回数 (monthly_quota)</label>
                <input type="number" value={modalData.monthly_quota} onChange={e => setModalData({ ...modalData, monthly_quota: parseInt(e.target.value) })} />
              </div>
              <div className="yotei-form-group">
                <label>金額 (単価)</label>
                <input type="number" value={modalData.price} onChange={e => setModalData({ ...modalData, price: parseInt(e.target.value) })} />
              </div>
              <div className="yotei-form-group">
                <label>開始日</label>
                <input type="date" value={modalData.start_date} onChange={e => setModalData({ ...modalData, start_date: e.target.value })} />
              </div>
              <div className="yotei-form-group">
                <label>状態</label>
                <select value={modalData.status} onChange={e => setModalData({ ...modalData, status: e.target.value })}>
                  <option value="active">有効 (active)</option>
                  <option value="inactive">無効 (inactive)</option>
                </select>
              </div>
              <div className="yotei-form-group">
                <label>メモ</label>
                <textarea value={modalData.memo} onChange={e => setModalData({ ...modalData, memo: e.target.value })} rows={3} />
              </div>
            </div>
            <div className="yotei-modal-footer">
              <button onClick={() => setModalData(null)}>キャンセル</button>
              <button className="primary" onClick={save} disabled={saving}>{saving ? '保存中...' : '保存'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
