import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFlashTransition } from '../../../shared/ui/ReportTransition/reportTransition';
import Visualizer from '../../../shared/ui/Visualizer/Visualizer';
import OfficeClientKartePanel from './OfficeClientKartePanel';
import { forceCreateKarte } from './karteStorage';
import '../../../shared/styles/components.css';
import './office-client-list.css';
import './office-client-karte-panel.css';

// API ベースURL: 本番環境では直接API Gatewayエンドポイントを使用
const API_BASE = (() => {
  if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
    return '/api';
  }
  if (import.meta.env.DEV) {
    return '/api';
  }
  // 本番環境: 直接API Gatewayエンドポイントを使用
  return import.meta.env.VITE_API_BASE || 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';
})();
const STATUS_OPTIONS = [
  { value: 'active', label: '稼働中' },
  { value: 'contract_in_progress', label: '契約作業中' },
  { value: 'suspended', label: '現場一時停止' },
  { value: 'inactive', label: 'その他' },
];

const initialForm = () => ({
  client_id: '',
  brand_id: '',
  brand_name: '',
  client_name: '',
  name: '',
  contact_person: '',
  phone: '',
  email: '',
  url: '',
  status: 'active',
  cleaning_frequency: '',
  acquired_by: '',
  assigned_to: '',
  introducer: '',
  needs_notes: '',
  implementation_items: '',
});

/**
 * 事務ジョブ用・顧客リストページ
 * 行クリックで右から編集パネルがせり出し、2カラムで表示。各カラムは縦横スクロール・幅リサイズ可。
 */
export default function OfficeClientListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { startTransition } = useFlashTransition();
  const listContainerRef = useRef(null);
  const scrollContentRef = useRef(null);
  const mainContainerRef = useRef(null);
  const kartePanelRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState([]);
  const [clients, setClients] = useState([]);
  const [brands, setBrands] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [selectedStoreId, setSelectedStoreId] = useState(null);
  const [panelView, setPanelView] = useState('edit'); // 'edit' | 'karte'（右パネルで編集フォームとカルテを切替）
  const [karteRefreshKey, setKarteRefreshKey] = useState(0); // カルテパネル再読み込み用
  const [leftColumnPercent, setLeftColumnPercent] = useState(50);
  const [resizing, setResizing] = useState(false);
  const [form, setForm] = useState(initialForm());
  const [editLoading, setEditLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [karteSaving, setKarteSaving] = useState(false);

  const headers = useCallback(
    () => ({
      Authorization: `Bearer ${localStorage.getItem('cognito_id_token') || (JSON.parse(localStorage.getItem('misesapo_auth') || '{}').token)}`,
      'Content-Type': 'application/json',
    }),
    []
  );

  const fetchData = useCallback(async () => {
    try {
      const [storesRes, clientsRes, brandsRes] = await Promise.all([
        fetch(`${API_BASE}/stores`, { headers: headers() }).catch((e) => ({ ok: false, error: e })),
        fetch(`${API_BASE}/clients`, { headers: headers() }).catch((e) => ({ ok: false, error: e })),
        fetch(`${API_BASE}/brands`, { headers: headers() }).catch((e) => ({ ok: false, error: e })),
      ]);
      if (storesRes.ok) {
        const data = await storesRes.json();
        setStores(Array.isArray(data) ? data : data.items || []);
      }
      if (clientsRes.ok) {
        const data = await clientsRes.json();
        setClients(Array.isArray(data) ? data : data.items || []);
      }
      if (brandsRes.ok) {
        const data = await brandsRes.json();
        setBrands(Array.isArray(data) ? data : data.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch customer data:', error);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* このページ表示中のみページ全体のスクロールバーを青に */
  useEffect(() => {
    const cls = 'office-client-list-scrollbar';
    document.documentElement.classList.add(cls);
    document.body.classList.add(cls);
    return () => {
      document.documentElement.classList.remove(cls);
      document.body.classList.remove(cls);
    };
  }, []);

  /* カルテから「編集」で戻ってきたときに編集パネルを開く */
  useEffect(() => {
    const openStoreId = location.state?.openStoreId;
    if (openStoreId) {
      setSelectedStoreId(openStoreId);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state?.openStoreId, location.pathname, navigate]);


  useEffect(() => {
    if (!selectedStoreId) {
      setForm(initialForm());
      setPanelView('edit');
      return;
    }
    let cancelled = false;
    setEditLoading(true);
    fetch(`${API_BASE}/stores/${selectedStoreId}`, { headers: headers() })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('取得に失敗'))))
      .then((store) => {
        if (!cancelled) {
          setForm({
            client_id: store.client_id ?? '',
            brand_id: store.brand_id ?? '',
            brand_name: store.brand_name ?? '',
            client_name: store.client_name ?? store.company_name ?? '',
            name: store.name || '',
            contact_person: store.contact_person || '',
            phone: store.phone || '',
            email: store.email || '',
            url: store.url || '',
            status: store.status || 'active',
            cleaning_frequency: store.cleaning_frequency || '',
            acquired_by: store.acquired_by || '',
            assigned_to: store.assigned_to || '',
            introducer: store.introducer || '',
            needs_notes: store.needs_notes || '',
            implementation_items: store.implementation_items || '',
          });
        }
      })
      .catch((e) => {
        if (!cancelled) {
          console.error(e);
          alert('店舗の取得に失敗しました。');
          setSelectedStoreId(null);
        }
      })
      .finally(() => {
        if (!cancelled) setEditLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedStoreId, headers]);

  /* 店舗読み込み後、ブランド名・法人名が空ならリストのマスタから表示用に補完（入力は可能なまま） */
  useEffect(() => {
    if (editLoading || !selectedStoreId) return;
    const store = stores.find((s) => String(s.id) === String(selectedStoreId));
    if (!store) return;
    setForm((prev) => {
      const bn = prev.brand_name || getBrandName(store);
      const cn = prev.client_name || getClientName(store);
      if (bn === prev.brand_name && cn === prev.client_name) return prev;
      return { ...prev, brand_name: bn, client_name: cn };
    });
  }, [editLoading, selectedStoreId, stores, brands, clients]);

  const onResizeStart = useCallback((e) => {
    e.preventDefault();
    setResizing(true);

    const onMove = (moveEvent) => {
      const container = listContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const percent = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      const next = Math.max(20, Math.min(80, percent));
      setLeftColumnPercent(next);
    };
    const onUp = () => {
      setResizing(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const getClientName = (store) => {
    if (store.client_name != null && store.client_name !== '') return store.client_name;
    const c = clients.find((c) => String(c.id) === String(store.client_id));
    return c ? (c.name || c.company_name || '') : '';
  };

  const getBrandName = (store) => {
    if (store.brand_name != null && store.brand_name !== '') return store.brand_name;
    const b = brands.find((b) => String(b.id) === String(store.brand_id));
    return b ? b.name : '';
  };

  const getContractTag = (store) => {
    const f = (store.cleaning_frequency || '').trim();
    if (!f) return null;
    if (/スポット/.test(f)) return 'スポット清掃';
    if (/毎月|隔月|定期/.test(f)) return '定期清掃';
    return f;
  };

  const filteredStores = useMemo(() => {
    return stores.filter((store) => {
      if (statusFilter !== 'all') {
        const status = store.status || 'inactive';
        if (statusFilter === '稼働中' && status !== 'active') return false;
        if (statusFilter === '契約作業中' && status !== 'contract_in_progress') return false;
        if (statusFilter === '現場一時停止' && status !== 'suspended') return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const clientName = getClientName(store).toLowerCase();
        const brandName = getBrandName(store).toLowerCase();
        const storeName = (store.name || '').toLowerCase();
        const contact = (store.contact_person || '').toLowerCase();
        const email = (store.email || '').toLowerCase();
        return (
          clientName.includes(q) ||
          brandName.includes(q) ||
          storeName.includes(q) ||
          contact.includes(q) ||
          email.includes(q)
        );
      }
      return true;
    });
  }, [stores, clients, brands, searchQuery, statusFilter]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = useCallback(
    async (e) => {
      e?.preventDefault?.();
      if (!selectedStoreId) return;
      setIsSubmitting(true);
      try {
        const payload = { ...form };
        if (payload.client_id === '') delete payload.client_id;
        if (payload.brand_id === '') delete payload.brand_id;
        const res = await fetch(`${API_BASE}/stores/${selectedStoreId}`, {
          method: 'PUT',
          headers: headers(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const text = await res.text();
          let detail = '';
          try {
            const json = JSON.parse(text);
            detail = json.message || json.error || json.detail || '';
          } catch {
            detail = text ? text.slice(0, 200) : '';
          }
          const msg = detail ? `更新に失敗しました (${res.status}): ${detail}` : `更新に失敗しました (${res.status})`;
          throw new Error(msg);
        }
        alert('更新しました。');
        setStores((prev) =>
          prev.map((s) =>
            String(s.id) === String(selectedStoreId) ? { ...s, ...payload } : s
          )
        );
        await fetchData();
        setStores((prev) =>
          prev.map((s) =>
            String(s.id) === String(selectedStoreId) ? { ...s, ...payload } : s
          )
        );
      } catch (err) {
        console.error(err);
        alert(err.message || '更新に失敗しました。');
      } finally {
        setIsSubmitting(false);
      }
    },
    [selectedStoreId, form, headers, fetchData]
  );

  if (loading) {
    return (
      <div className="report-page" data-job="office" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p className="job-entrance-dummy">読み込み中...</p>
      </div>
    );
  }

  const showEditPanel = !!selectedStoreId;

  return (
    <div className="report-page office-client-list-page" data-job="office">
      <div className="report-page-viz">
        <Visualizer mode="base" className="report-page-visualizer" />
      </div>

      <div
        ref={scrollContentRef}
        className="report-page-content report-page-content--full office-client-list-page-content"
      >
        {/* ヘッダー・戻る・新規 */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => startTransition('/jobs/office/entrance')}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'var(--fg)',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem',
              marginRight: '12px',
            }}
          >
            ←
          </button>
          <h1 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 600 }}>顧客リスト</h1>
        </div>

        {/* 検索・フィルター（1行） */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0, position: 'relative', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
            <input
              type="text"
              placeholder="会社名・店舗名・担当者・メールで検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '12px 16px', background: 'transparent', color: 'var(--fg)', border: 'none', fontSize: '0.95rem', outline: 'none' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {['all', '稼働中', '契約作業中', '現場一時停止'].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setStatusFilter(f)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: '1px solid',
                  borderColor: statusFilter === f ? 'var(--job-office)' : 'rgba(255,255,255,0.1)',
                  background: statusFilter === f ? 'var(--job-office)' : 'rgba(255,255,255,0.05)',
                  color: statusFilter === f ? '#fff' : 'rgba(255,255,255,0.6)',
                  fontSize: '0.8rem',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                }}
              >
                {f === 'all' ? 'すべて' : f}
              </button>
            ))}
          </div>
        </div>

        {/* メインコンテンツ：画面上部に至ったらそれ以上上にスクロールしない */}
        <div ref={mainContainerRef} className="office-client-list-main-container">
          <div
            ref={listContainerRef}
            className={`office-client-list-two-columns ${showEditPanel ? 'office-client-list-two-columns--with-panel' : ''} ${panelView === 'karte' ? 'office-client-list-two-columns--karte' : ''}`}
          >
            {/* 左: リスト */}
            <div
              className="office-client-list-column-left"
              style={{
                width: showEditPanel ? (panelView === 'karte' ? '30%' : `${leftColumnPercent}%`) : '100%',
                minWidth: showEditPanel ? 200 : undefined,
              }}
            >
            <div style={{ flexShrink: 0, paddingBottom: 12 }}>
              <button
                type="button"
                onClick={() => navigate('/office/clients/new')}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  fontSize: '0.85rem',
                  background: 'var(--job-office)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                新規登録
              </button>
            </div>
            <div className="office-client-list-table">
              <div
                className="office-client-list-row office-client-list-header"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr 1fr 1.2fr 1fr 1fr 0.6fr',
                  gap: 12,
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: '8px 8px 0 0',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.7)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderBottom: 'none',
                }}
              >
                <span>ブランド名</span>
                <span>店舗名</span>
                <span>法人名</span>
                <span>電話番号</span>
                <span>メールアドレス</span>
                <span>担当者</span>
                <span>営業担当者</span>
                <span>契約内容</span>
              </div>
              {filteredStores.length === 0 ? (
                <p style={{ textAlign: 'center', opacity: 0.7, padding: 24 }}>該当する顧客がありません</p>
              ) : (
                filteredStores.map((store) => (
                  <div
                    key={store.id}
                    role="button"
                    tabIndex={0}
                    className="office-client-list-row"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr 1fr 1.2fr 1fr 1fr 0.6fr',
                      gap: 12,
                      padding: '12px 16px',
                      background: selectedStoreId === store.id ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      borderLeftWidth: 4,
                      borderLeftStyle: 'solid',
                      borderLeftColor: store.status === 'active' ? '#22c55e' : 'rgba(255,255,255,0.1)',
                      fontSize: '0.875rem',
                      alignItems: 'center',
                      cursor: 'pointer',
                    }}
                    onClick={() => setSelectedStoreId(store.id)}
                    onKeyDown={(e) => e.key === 'Enter' && setSelectedStoreId(store.id)}
                  >
                    <span className="office-client-list-brand" title={getBrandName(store)}>{getBrandName(store) || '—'}</span>
                    <span title={store.name}>{store.name || '—'}</span>
                    <span title={getClientName(store)}>{getClientName(store) || '—'}</span>
                    <span title={store.phone}>{store.phone || '—'}</span>
                    <span title={store.email} style={{ wordBreak: 'break-all' }}>{store.email || '—'}</span>
                    <span title={store.contact_person}>{store.contact_person || '—'}</span>
                    <span title={store.assigned_to}>{store.assigned_to || '—'}</span>
                    <span className="office-client-list-contract">
                      {getContractTag(store) ? (
                        <span
                          className={`office-client-list-contract-tag ${getContractTag(store) === 'スポット清掃' ? 'office-client-list-contract-tag--spot' :
                            getContractTag(store) === '定期清掃' ? 'office-client-list-contract-tag--regular' : 'office-client-list-contract-tag--other'
                            }`}
                          title={store.cleaning_frequency || ''}
                        >
                          {getContractTag(store)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

            {/* リサイザー：左パネルと右パネルの間。ドラッグで幅変更。干渉しない境界 */}
            {showEditPanel && (
              <div
                role="separator"
                aria-label="カラム幅を変更"
                className="office-client-list-resizer"
                onMouseDown={onResizeStart}
                style={{
                  background: resizing ? 'var(--job-office)' : undefined,
                }}
              />
            )}

            {/* 右: 編集パネル（縦横スクロール・閉じる・保存を上に） */}
            {showEditPanel && (
              <div
                className="office-client-list-column-right"
                style={{
                  flex: 1,
                  minWidth: 200,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  background: 'transparent',
                }}
              >
              <div className="office-client-list-panel-actions">
                <div className="office-client-list-panel-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {/* タブ: 基本情報編集 | カルテ（アクティブを青で表示） */}
                  <button
                    type="button"
                    onClick={() => setPanelView('edit')}
                    style={{
                      padding: '10px 16px',
                      fontSize: '0.85rem',
                      background: panelView === 'edit' ? 'var(--job-office)' : 'rgba(255,255,255,0.08)',
                      border: `1px solid ${panelView === 'edit' ? 'var(--job-office)' : 'rgba(255,255,255,0.15)'}`,
                      borderRadius: '8px',
                      color: panelView === 'edit' ? '#fff' : 'var(--fg)',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    基本情報編集
                  </button>
                  <button
                    type="button"
                    onClick={() => setPanelView('karte')}
                    style={{
                      padding: '10px 16px',
                      fontSize: '0.85rem',
                      background: panelView === 'karte' ? 'var(--job-office)' : 'rgba(255,255,255,0.08)',
                      border: `1px solid ${panelView === 'karte' ? 'var(--job-office)' : 'rgba(255,255,255,0.15)'}`,
                      borderRadius: '8px',
                      color: panelView === 'karte' ? '#fff' : 'var(--fg)',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    カルテ
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {panelView === 'edit' && (
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={isSubmitting || editLoading}
                      style={{
                        padding: '8px 20px',
                        fontSize: '0.9rem',
                        background: 'rgba(255,255,255,0.12)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '8px',
                        color: 'var(--fg)',
                        cursor: isSubmitting || editLoading ? 'not-allowed' : 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      {isSubmitting ? '保存中...' : '保存'}
                    </button>
                  )}
                  {panelView === 'karte' && (
                    <button
                      type="button"
                      onClick={() => {
                        setKarteSaving(true);
                        const p = kartePanelRef.current?.save?.();
                        if (p && typeof p.finally === 'function') p.finally(() => setKarteSaving(false));
                        else setKarteSaving(false);
                      }}
                      disabled={karteSaving}
                      style={{
                        padding: '8px 20px',
                        fontSize: '0.9rem',
                        background: 'rgba(255,255,255,0.12)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '8px',
                        color: 'var(--fg)',
                        cursor: karteSaving ? 'not-allowed' : 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      {karteSaving ? '保存中...' : '保存'}
                    </button>
                  )}
                  {panelView === 'karte' && (
                    <button
                      type="button"
                      onClick={() => {
                        const store = stores.find(s => String(s.id) === String(selectedStoreId)) || { id: selectedStoreId, name: form.name, contact_person: form.contact_person, phone: form.phone, email: form.email };
                        forceCreateKarte(selectedStoreId, store);
                        setKarteRefreshKey(k => k + 1);
                      }}
                      style={{
                        padding: '8px 14px',
                        fontSize: '0.85rem',
                        background: 'var(--job-office)',
                        border: '1px solid var(--job-office)',
                        borderRadius: '8px',
                        color: '#fff',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      新規カルテ作成
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { setSelectedStoreId(null); setPanelView('edit'); }}
                    style={{
                      padding: '8px 16px',
                      fontSize: '0.85rem',
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '8px',
                      color: 'var(--fg)',
                      cursor: 'pointer',
                    }}
                  >
                    閉じる
                  </button>
                </div>
              </div>
              </div>
              <div
                className="office-client-list-panel-body"
                style={{
                  padding: panelView === 'karte' ? 12 : 16,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {panelView === 'karte' ? (
                  <OfficeClientKartePanel
                    ref={kartePanelRef}
                    key={karteRefreshKey}
                    storeId={selectedStoreId}
                    store={stores.find(s => String(s.id) === String(selectedStoreId)) || { id: selectedStoreId, name: form.name, contact_person: form.contact_person, phone: form.phone, email: form.email }}
                    brands={brands}
                    clients={clients}
                    getBrandName={getBrandName}
                    getClientName={getClientName}
                    onBack={() => setPanelView('edit')}
                  />
                ) : editLoading ? (
                  <p style={{ opacity: 0.7 }}>読み込み中...</p>
                ) : (
                  <form onSubmit={handleSave} className="report-page-form" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* リストの列順に合わせる：ブランド名・店舗名・法人名・電話・メール・担当者・営業担当者・契約内容 */}
                    <div className="report-page-field">
                      <label>ブランド名</label>
                      <input type="text" name="brand_name" value={form.brand_name} onChange={handleChange} placeholder="ブランド名を入力" style={{ width: '100%', padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'var(--fg)' }} />
                    </div>
                    <div className="report-page-field">
                      <label>店舗名 *</label>
                      <input type="text" name="name" value={form.name} onChange={handleChange} required style={{ width: '100%', padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'var(--fg)' }} />
                    </div>
                    <div className="report-page-field">
                      <label>法人名</label>
                      <input type="text" name="client_name" value={form.client_name} onChange={handleChange} placeholder="法人名を入力" style={{ width: '100%', padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'var(--fg)' }} />
                    </div>
                    <div className="report-page-field">
                      <label>電話番号</label>
                      <input type="text" name="phone" value={form.phone} onChange={handleChange} style={{ width: '100%', padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'var(--fg)' }} />
                    </div>
                    <div className="report-page-field">
                      <label>メールアドレス</label>
                      <input type="email" name="email" value={form.email} onChange={handleChange} style={{ width: '100%', padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'var(--fg)' }} />
                    </div>
                    <div className="report-page-field">
                      <label>担当者</label>
                      <input type="text" name="contact_person" value={form.contact_person} onChange={handleChange} style={{ width: '100%', padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'var(--fg)' }} />
                    </div>
                    <div className="report-page-field">
                      <label>営業担当者</label>
                      <input type="text" name="assigned_to" value={form.assigned_to} onChange={handleChange} style={{ width: '100%', padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'var(--fg)' }} />
                    </div>
                    <div className="report-page-field">
                      <label>契約内容（清掃頻度）</label>
                      <input type="text" name="cleaning_frequency" value={form.cleaning_frequency} onChange={handleChange} style={{ width: '100%', padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'var(--fg)' }} />
                    </div>
                    <div className="report-page-field">
                      <label>URL</label>
                      <input type="url" name="url" value={form.url} onChange={handleChange} style={{ width: '100%', padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'var(--fg)' }} />
                    </div>
                    <div className="report-page-field">
                      <label>ステータス</label>
                      <select name="status" value={form.status} onChange={handleChange} style={{ width: '100%', padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'var(--fg)' }}>
                        {STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="report-page-field">
                      <label>獲得者(ミセサポ)</label>
                      <input type="text" name="acquired_by" value={form.acquired_by} onChange={handleChange} style={{ width: '100%', padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'var(--fg)' }} />
                    </div>
                    <div className="report-page-field">
                      <label>紹介者</label>
                      <input type="text" name="introducer" value={form.introducer} onChange={handleChange} style={{ width: '100%', padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'var(--fg)' }} />
                    </div>
                    <div className="report-page-field">
                      <label>ニーズ内容</label>
                      <textarea name="needs_notes" value={form.needs_notes} onChange={handleChange} rows={2} style={{ width: '100%', padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'var(--fg)' }} />
                    </div>
                    <div className="report-page-field">
                      <label>実施項目</label>
                      <textarea name="implementation_items" value={form.implementation_items} onChange={handleChange} rows={2} style={{ width: '100%', padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'var(--fg)' }} />
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
