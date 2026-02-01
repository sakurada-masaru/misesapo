import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFlashTransition } from '../../../shared/ui/ReportTransition/reportTransition';
import Visualizer from '../../../shared/ui/Visualizer/Visualizer';
import '../../../shared/styles/components.css';

/**
 * 顧客一覧ページ (スマホ特化レイアウト)
 */
export default function SalesClientListPage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [stores, setStores] = useState([]);
    const [clients, setClients] = useState([]);
    const [brands, setBrands] = useState([]);
    const [filter, setFilter] = useState('all');
    const [prefFilter, setPrefFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const { startTransition } = useFlashTransition();

    const API_BASE = '/api';

    const prefectures = useMemo(() => {
        const prefs = stores.map(s => s.pref).filter(Boolean);
        return ['all', ...new Set(prefs)].sort();
    }, [stores]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem('cognito_id_token') ||
                    JSON.parse(localStorage.getItem('misesapo_auth') || '{}').token;

                const headers = {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                };

                const [storesRes, clientsRes, brandsRes] = await Promise.all([
                    fetch(`${API_BASE}/stores`, { headers }).catch(e => ({ ok: false, error: e })),
                    fetch(`${API_BASE}/clients`, { headers }).catch(e => ({ ok: false, error: e })),
                    fetch(`${API_BASE}/brands`, { headers }).catch(e => ({ ok: false, error: e }))
                ]);

                if (storesRes.ok) {
                    const data = await storesRes.json();
                    setStores(Array.isArray(data) ? data : (data.items || []));
                }
                if (clientsRes.ok) {
                    const data = await clientsRes.json();
                    setClients(Array.isArray(data) ? data : (data.items || []));
                }
                if (brandsRes.ok) {
                    const data = await brandsRes.json();
                    setBrands(Array.isArray(data) ? data : (data.items || []));
                }
            } catch (error) {
                console.error('Failed to fetch data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const getClientName = (clientId) => {
        const client = clients.find(c => String(c.id) === String(clientId));
        return client ? (client.name || client.company_name || '') : '';
    };

    /** 事務側と同様: 店舗の brand_name を優先し、なければ brands 一覧から解決 */
    const getBrandName = (store) => {
        if (store.brand_name != null && store.brand_name !== '') return store.brand_name;
        const brand = brands.find(b => String(b.id) === String(store.brand_id));
        return brand ? brand.name : '';
    };

    const filteredStores = useMemo(() => {
        return stores.filter(store => {
            if (filter !== 'all') {
                const status = store.status || 'active';
                let normalizedStatus = status;
                if (status === 'active') normalizedStatus = '稼働中';
                else if (status === 'suspended') normalizedStatus = '休止';
                else if (status === 'terminated') normalizedStatus = '契約終了';
                if (filter === 'リード' && store.registration_type !== 'sales_lead') return false;
                if (filter !== 'リード') {
                    if (normalizedStatus !== filter && status !== filter) return false;
                }
            }
            if (prefFilter !== 'all' && store.pref !== prefFilter) return false;
            if (searchQuery) {
                const keywords = searchQuery.toLowerCase().split(/[\s　]+/).filter(Boolean);
                if (keywords.length > 0) {
                    const clientName = getClientName(store.client_id).toLowerCase();
                    const brandName = getBrandName(store).toLowerCase();
                    const storeName = (store.name || '').toLowerCase();
                    return keywords.every(kw =>
                        storeName.includes(kw) || clientName.includes(kw) || brandName.includes(kw)
                    );
                }
            }
            return true;
        });
    }, [stores, clients, brands, filter, prefFilter, searchQuery]);

    if (loading) {
        return (
            <div className="report-page" data-job="sales" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p className="job-entrance-dummy">読み込み中...</p>
            </div>
        );
    }

    return (
        <div className="report-page" data-job="sales">
            <div className="report-page-viz">
                <Visualizer mode="base" className="report-page-visualizer" />
            </div>

            <div className="report-page-content">
                {/* ヘッダー・戻るボタン */}
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                    <button
                        onClick={() => startTransition('/jobs/sales/entrance')}
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
                            marginRight: '12px'
                        }}
                    >
                        ←
                    </button>
                    <h1 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 600 }}>顧客一覧</h1>
                    <button
                        type="button"
                        onClick={() => navigate('/sales/clients/new')}
                        style={{
                            marginLeft: 'auto',
                            padding: '8px 16px',
                            fontSize: '0.8rem',
                            background: 'var(--job-sales)',
                            border: 'none',
                            borderRadius: '8px',
                            color: '#fff',
                            cursor: 'pointer',
                            fontWeight: 600
                        }}
                    >
                        顧客登録
                    </button>
                </div>

                {/* 検索バー */}
                <div className="report-page-field" style={{ marginBottom: 20 }}>
                    <div style={{
                        position: 'relative',
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '12px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        overflow: 'hidden'
                    }}>
                        <input
                            type="text"
                            placeholder="検索..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '12px 16px',
                                background: 'transparent',
                                color: 'var(--fg)',
                                border: 'none',
                                fontSize: '0.95rem',
                                outline: 'none'
                            }}
                        />
                    </div>
                </div>

                {/* 簡易フィルター */}
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12, marginBottom: 16, scrollbarWidth: 'none' }}>
                    {['all', '稼働中', 'リード'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            style={{
                                padding: '6px 14px',
                                borderRadius: '20px',
                                border: '1px solid',
                                borderColor: filter === f ? 'var(--job-sales)' : 'rgba(255,255,255,0.1)',
                                background: filter === f ? 'var(--job-sales)' : 'rgba(255,255,255,0.05)',
                                color: filter === f ? '#fff' : 'rgba(255,255,255,0.6)',
                                fontSize: '0.8rem',
                                whiteSpace: 'nowrap',
                                cursor: 'pointer'
                            }}
                        >
                            {f === 'all' ? 'すべて' : f}
                        </button>
                    ))}
                </div>

                {/* リスト表示 */}
                <div style={{ display: 'grid', gap: 12 }}>
                    {filteredStores.map(store => (
                        <div
                            key={store.id}
                            className="card"
                            style={{
                                padding: '16px',
                                background: 'rgba(255,255,255,0.03)',
                                borderRadius: '16px',
                                border: '1px solid rgba(255,255,255,0.05)',
                                borderLeftWidth: 4,
                                borderLeftStyle: 'solid',
                                borderLeftColor: store.status === 'active' ? '#22c55e' : 'rgba(255,255,255,0.1)',
                                cursor: 'pointer'
                            }}
                            onClick={() => navigate(`/sales/store/${store.id}`)}
                        >
                            {/* 1行目: 法人 [法人名タグ] / 店舗 〇〇店舗名 */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', marginBottom: '6px', fontSize: '0.8rem' }}>
                                {(store.client_name || getClientName(store.client_id)) && (
                                    <>
                                        <span style={{ opacity: 0.6 }}>法人</span>
                                        <span
                                            title={store.client_name || getClientName(store.client_id)}
                                            style={{
                                                display: 'inline-block',
                                                fontSize: '0.75rem',
                                                fontWeight: 500,
                                                padding: '4px 10px',
                                                borderRadius: '999px',
                                                background: 'rgba(59, 130, 246, 0.2)',
                                                border: '1px solid rgba(59, 130, 246, 0.4)',
                                                color: 'var(--fg)',
                                                maxWidth: '100%',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                            }}
                                        >
                                            {store.client_name || getClientName(store.client_id)}
                                        </span>
                                    </>
                                )}
                                {(store.client_name || getClientName(store.client_id)) && store.name && (
                                    <span style={{ opacity: 0.3 }}>/</span>
                                )}
                                <span style={{ opacity: 0.6 }}>店舗</span>
                                <span style={{ fontWeight: 600 }}>{store.name}</span>
                            </div>
                            {/* 2行目: ブランド名（大きく） */}
                            {getBrandName(store) && (
                                <div style={{ marginBottom: '6px', fontSize: '1.1rem', fontWeight: 600 }}>
                                    {getBrandName(store)}
                                </div>
                            )}
                            {store.registration_type === 'sales_lead' && (
                                <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                                    <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '4px', background: 'var(--job-sales)', color: '#fff' }}>
                                        リード
                                    </span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <p style={{ textAlign: 'center', marginTop: '40px', paddingBottom: '40px' }}>
                    <a
                        href="#"
                        onClick={(e) => { e.preventDefault(); startTransition('/jobs/sales/entrance'); }}
                        style={{ color: 'var(--job-sales)', fontSize: '0.85rem', textDecoration: 'none', opacity: 0.6 }}
                    >
                        エントランスへ戻る
                    </a>
                </p>
            </div>
        </div>
    );
}
