import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import OfficeClientKartePanel from '../../office/clients/OfficeClientKartePanel';
import Visualizer from '../../../shared/ui/Visualizer/Visualizer';
import '../../../shared/styles/components.css';
import '../../office/clients/office-client-karte-panel.css';
import { normalizeGatewayBase, YOTEI_GATEWAY } from '../../../shared/api/gatewayBase';

const API_BASE = (() => {
    if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
        return '/api';
    }
    return normalizeGatewayBase(import.meta.env?.VITE_API_BASE, YOTEI_GATEWAY);
})();

export default function CleanerClientKartePage() {
    const { storeId } = useParams();
    const navigate = useNavigate();
    const [store, setStore] = useState(null);
    const [loading, setLoading] = useState(true);
    const kartePanelRef = useRef(null);

    const headers = useCallback(
        () => ({
            Authorization: `Bearer ${localStorage.getItem('cognito_id_token') || (JSON.parse(localStorage.getItem('misesapo_auth') || '{}').token)}`,
            'Content-Type': 'application/json',
        }),
        []
    );

    useEffect(() => {
        if (!storeId) return;
        let cancelled = false;
        fetch(`${API_BASE}/stores/${storeId}`, { headers: headers() })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
                if (!cancelled) {
                    setStore(data);
                    setLoading(false);
                }
            })
            .catch((e) => {
                console.error(e);
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = false; };
    }, [storeId, headers]);

    if (loading) {
        return (
            <div className="report-page" data-job="cleaning" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p>読み込み中...</p>
            </div>
        );
    }

    return (
        <div className="report-page" data-job="cleaning">
            <div className="report-page-content" style={{ maxWidth: '100%', padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', flexShrink: 0 }}>
                    <button
                        type="button"
                        onClick={() => navigate('/jobs/cleaning/clients/list')}
                        style={{
                            background: 'rgba(255,255,255,0.08)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: 'var(--fg)',
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            marginRight: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        ←
                    </button>
                    <h1 style={{ fontSize: '1.25rem', margin: 0 }}>店舗カルテ</h1>
                </div>

                <div className="cleaner-karte-container" style={{
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    marginBottom: '20px'
                }}>
                    <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
                        <OfficeClientKartePanel
                            ref={kartePanelRef}
                            storeId={storeId}
                            store={store}
                            isLocked={true} // Cleaners can't edit
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
