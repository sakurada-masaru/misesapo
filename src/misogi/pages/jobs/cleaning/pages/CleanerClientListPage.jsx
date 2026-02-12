import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFlashTransition } from '../../../shared/ui/ReportTransition/reportTransition';
import Visualizer from '../../../shared/ui/Visualizer/Visualizer';
import '../../../shared/styles/components.css';
import { normalizeGatewayBase, YOTEI_GATEWAY } from '../../../shared/api/gatewayBase';

const API_BASE = (() => {
    if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
        return '/api';
    }
    return normalizeGatewayBase(import.meta.env?.VITE_API_BASE, YOTEI_GATEWAY);
})();

export default function CleanerClientListPage() {
    const navigate = useNavigate();
    const { startTransition } = useFlashTransition();
    const [loading, setLoading] = useState(true);
    const [stores, setStores] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');

    const headers = useCallback(
        () => ({
            Authorization: `Bearer ${localStorage.getItem('cognito_id_token') || (JSON.parse(localStorage.getItem('misesapo_auth') || '{}').token)}`,
            'Content-Type': 'application/json',
        }),
        []
    );

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch(`${API_BASE}/stores`, { headers: headers() });
            if (res.ok) {
                const data = await res.json();
                setStores(Array.isArray(data) ? data : data.items || []);
            }
        } catch (error) {
            console.error('[CleanerClientListPage] Failed to fetch stores:', error);
        } finally {
            setLoading(false);
        }
    }, [headers]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredStores = useMemo(() => {
        if (!searchQuery.trim()) return stores;
        const q = searchQuery.toLowerCase().trim();
        return stores.filter((store) => {
            const name = (store.name || '').toLowerCase();
            const brand = (store.brand_name || '').toLowerCase();
            const client = (store.client_name || store.company_name || '').toLowerCase();
            return name.includes(q) || brand.includes(q) || client.includes(q);
        });
    }, [stores, searchQuery]);

    if (loading) {
        return (
            <div className="report-page" data-job="cleaning" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p>読み込み中...</p>
            </div>
        );
    }

    return (
        <div className="report-page" data-job="cleaning">
            <div className="report-page-content" style={{ maxWidth: '100%', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0' }}>
                    <button
                        type="button"
                        onClick={() => navigate('/jobs/cleaning/entrance')}
                        style={{
                            background: 'rgba(255,255,255,0.08)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: 'var(--fg)',
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            marginRight: '12px',
                            cursor: 'pointer'
                        }}
                    >
                        ←
                    </button>
                    <h1 style={{ fontSize: '1.25rem', margin: 0 }}>店舗カルテ検索</h1>
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <input
                        type="text"
                        placeholder="店舗名やブランド名で検索..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '14px',
                            borderRadius: '12px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: 'rgba(255,255,255,0.05)',
                            color: 'var(--fg)',
                            fontSize: '1rem',
                            outline: 'none'
                        }}
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {filteredStores.length === 0 ? (
                        <p style={{ textAlign: 'center', opacity: 0.6, marginTop: '40px' }}>
                            店舗が見つかりませんでした。
                        </p>
                    ) : (
                        filteredStores.map((store) => (
                            <div
                                key={store.id}
                                onClick={() => navigate(`/jobs/cleaning/clients/${store.id}`)}
                                style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '12px',
                                    padding: '16px',
                                    cursor: 'pointer'
                                }}
                            >
                                <div style={{ fontSize: '0.8rem', color: 'var(--job-cleaning)', fontWeight: 'bold', marginBottom: '4px' }}>
                                    {store.brand_name || 'ブランド未設定'}
                                </div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '8px' }}>
                                    {store.name}
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                                    {store.address1 || ''} {store.address2 || ''}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
