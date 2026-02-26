import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFlashTransition } from '../ReportTransition/reportTransition';
import Visualizer from '../Visualizer/Visualizer';
import { normalizeGatewayBase, YOTEI_GATEWAY } from '../../api/gatewayBase';
import '../../styles/components.css';

const LEAD_TABS = [
    { id: 'all', label: 'すべて' },
    { id: 'appointment', label: 'アポ' },
    { id: 'estimate', label: '見積もり' },
    { id: 'survey', label: '現地調査' },
    { id: 'screening', label: '顧客審査' },
];

const STATUS_COLORS = {
    appointment: '#3b82f6',
    estimate: '#8b5cf6',
    survey: '#f59e0b',
    screening: '#22c55e',
};

const STATUS_LABELS = {
    appointment: 'アポ',
    estimate: '見積もり',
    survey: '現地調査',
    screening: '顧客審査',
};

const API_BASE = (() => {
    if (typeof window !== 'undefined') {
        const host = String(window.location?.hostname || '').toLowerCase();
        if (host === 'localhost' || host === '127.0.0.1') return '/api';
    }
    return normalizeGatewayBase(import.meta.env?.VITE_API_BASE, YOTEI_GATEWAY);
})();

/**
 * リード情報ページ (タブ切り替え版)
 */
export default function SalesLeadsPage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [leads, setLeads] = useState([]);
    const [activeTab, setActiveTab] = useState('all');
    const { startTransition } = useFlashTransition();

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem('cognito_id_token') ||
                    JSON.parse(localStorage.getItem('misesapo_auth') || '{}').token;

                const headers = {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                };

                const res = await fetch(`${API_BASE}/stores`, { headers }).catch(e => ({ ok: false }));
                if (res.ok) {
                    const data = await res.json();
                    const allStores = Array.isArray(data) ? data : (data.items || []);
                    // リード（見込み客）のみをフィルター
                    setLeads(allStores.filter(s => s.registration_type === 'lead'));
                }
            } catch (error) {
                console.error('Failed to fetch leads:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const filteredLeads = useMemo(() => {
        if (activeTab === 'all') return leads;
        return leads.filter(l => l.lead_status === activeTab);
    }, [leads, activeTab]);

    const getTabCount = (tabId) => {
        if (tabId === 'all') return leads.length;
        return leads.filter(l => l.lead_status === tabId).length;
    };

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

            <div className="report-page-content" style={{ paddingTop: '50px' }}>
                {/* ヘッダー */}
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
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
                    <h1 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 600 }}>リード情報</h1>
                    <button
                        onClick={() => navigate('/sales/leads/new')}
                        style={{
                            marginLeft: 'auto',
                            padding: '8px 16px',
                            fontSize: '0.8rem',
                            background: 'var(--job-sales)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 600
                        }}
                    >
                        リード登録
                    </button>
                </div>

                {/* タブ */}
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    gap: '6px',
                    marginBottom: '16px'
                }}>
                    {LEAD_TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                padding: '6px 10px',
                                borderRadius: '16px',
                                border: activeTab === tab.id ? '2px solid var(--job-sales)' : '1px solid rgba(255,255,255,0.1)',
                                background: activeTab === tab.id ? 'var(--job-sales)' : 'rgba(255,255,255,0.05)',
                                color: activeTab === tab.id ? '#fff' : 'rgba(255,255,255,0.7)',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                        >
                            {tab.label}
                            <span style={{
                                background: activeTab === tab.id ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
                                padding: '1px 5px',
                                borderRadius: '8px',
                                fontSize: '0.65rem'
                            }}>
                                {getTabCount(tab.id)}
                            </span>
                        </button>
                    ))}
                </div>

                {/* リスト */}
                <div style={{ display: 'grid', gap: 12 }}>
                    {filteredLeads.length > 0 ? filteredLeads.map(lead => (
                        <div
                            key={lead.id}
                            style={{
                                padding: '16px',
                                background: 'rgba(255,255,255,0.03)',
                                borderRadius: '16px',
                                border: '1px solid rgba(255,255,255,0.05)',
                                cursor: 'pointer'
                            }}
                            onClick={() => navigate(`/sales/leads/${lead.id}`)}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '2px' }}>
                                        {lead.company_name || lead.name}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                                        {lead.name}
                                    </div>
                                </div>
                                <span style={{
                                    fontSize: '0.7rem',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    background: STATUS_COLORS[lead.lead_status] || '#6b7280',
                                    color: '#fff'
                                }}>
                                    {STATUS_LABELS[lead.lead_status] || lead.lead_status}
                                </span>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', opacity: 0.5 }}>
                                {lead.phone && <span>📞 {lead.phone}</span>}
                                {lead.next_action_date && (
                                    <span style={{ color: 'var(--job-sales)' }}>
                                        📌 {lead.next_action_date}
                                    </span>
                                )}
                            </div>
                        </div>
                    )) : (
                        <div style={{
                            textAlign: 'center',
                            padding: '60px 20px',
                            background: 'rgba(255,255,255,0.03)',
                            borderRadius: '16px'
                        }}>
                            <p style={{ fontSize: '2rem', marginBottom: '12px' }}>📋</p>
                            <p style={{ opacity: 0.6, fontSize: '0.9rem' }}>
                                {activeTab === 'all' ? 'リードがありません' : `${STATUS_LABELS[activeTab]}のリードがありません`}
                            </p>
                            <button
                                onClick={() => navigate('/sales/leads/new')}
                                style={{
                                    marginTop: '16px',
                                    padding: '10px 20px',
                                    background: 'var(--job-sales)',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer'
                                }}
                            >
                                リードを登録する
                            </button>
                        </div>
                    )}
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
