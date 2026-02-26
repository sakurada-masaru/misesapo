import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFlashTransition } from '../ReportTransition/reportTransition';
import Visualizer from '../Visualizer/Visualizer';
import { normalizeGatewayBase, YOTEI_GATEWAY } from '../../api/gatewayBase';
import '../../styles/components.css';

const STATUS_OPTIONS = [
    { value: 'appointment', label: 'アポ', color: '#3b82f6' },
    { value: 'estimate', label: '見積もり', color: '#8b5cf6' },
    { value: 'survey', label: '現地調査', color: '#f59e0b' },
    { value: 'screening', label: '顧客審査', color: '#22c55e' },
];

const API_BASE = (() => {
    if (typeof window !== 'undefined') {
        const host = String(window.location?.hostname || '').toLowerCase();
        if (host === 'localhost' || host === '127.0.0.1') return '/api';
    }
    return normalizeGatewayBase(import.meta.env?.VITE_API_BASE, YOTEI_GATEWAY);
})();

/**
 * リード登録ページ (新規見込み客登録)
 */
export default function SalesLeadNewPage() {
    const navigate = useNavigate();
    const { startTransition } = useFlashTransition();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        company_name: '',
        store_name: '',
        contact_person: '',
        phone: '',
        email: '',
        lead_status: 'appointment',
        notes: '',
        next_action_date: '',
        next_action_content: ''
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        const leadData = {
            name: formData.store_name,
            company_name: formData.company_name,
            contact_person: formData.contact_person,
            phone: formData.phone,
            email: formData.email,
            lead_status: formData.lead_status,
            notes: formData.notes,
            next_action_date: formData.next_action_date,
            next_action_content: formData.next_action_content,
            registration_type: 'lead',
            created_at: new Date().toISOString()
        };

        try {
            const token = localStorage.getItem('cognito_id_token') ||
                JSON.parse(localStorage.getItem('misesapo_auth') || '{}').token;

            const response = await fetch(`${API_BASE}/stores`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(leadData)
            });

            if (response.ok) {
                alert('リードを登録しました！');
                startTransition('/sales/leads');
            } else {
                throw new Error('登録に失敗しました');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('登録に失敗しました。');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="report-page" data-job="sales">
            <div className="report-page-viz">
                <Visualizer mode="base" className="report-page-visualizer" />
            </div>

            <div className="report-page-content" style={{ paddingTop: '50px' }}>
                {/* ヘッダー */}
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                    <button
                        onClick={() => startTransition('/sales/leads')}
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
                    <h1 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 600 }}>リード登録</h1>
                    <button
                        onClick={() => navigate('/sales/leads')}
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
                        リード情報
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* ステータス選択 */}
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ fontSize: '0.8rem', opacity: 0.6, display: 'block', marginBottom: '8px', textAlign: 'center' }}>ステータス *</label>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
                            {STATUS_OPTIONS.map(opt => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, lead_status: opt.value })}
                                    style={{
                                        padding: '8px 14px',
                                        fontSize: '0.8rem',
                                        borderRadius: '8px',
                                        border: formData.lead_status === opt.value ? `2px solid ${opt.color}` : '1px solid rgba(255,255,255,0.1)',
                                        background: formData.lead_status === opt.value ? opt.color : 'rgba(255,255,255,0.05)',
                                        color: '#fff',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 会社名 */}
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ fontSize: '0.8rem', opacity: 0.6, display: 'block', marginBottom: '6px' }}>会社名・屋号 *</label>
                        <input
                            type="text"
                            name="company_name"
                            required
                            placeholder="例: 株式会社 Dart Ace"
                            value={formData.company_name}
                            onChange={handleChange}
                            style={{
                                width: '100%',
                                padding: '12px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '10px',
                                color: 'var(--fg)',
                                fontSize: '0.95rem'
                            }}
                        />
                    </div>

                    {/* 店舗名 */}
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ fontSize: '0.8rem', opacity: 0.6, display: 'block', marginBottom: '6px' }}>店舗名</label>
                        <input
                            type="text"
                            name="store_name"
                            placeholder="例: 新宿西口店"
                            value={formData.store_name}
                            onChange={handleChange}
                            style={{
                                width: '100%',
                                padding: '12px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '10px',
                                color: 'var(--fg)',
                                fontSize: '0.95rem'
                            }}
                        />
                    </div>

                    {/* 担当者名 */}
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ fontSize: '0.8rem', opacity: 0.6, display: 'block', marginBottom: '6px' }}>担当者名</label>
                        <input
                            type="text"
                            name="contact_person"
                            placeholder="例: 山田太郎"
                            value={formData.contact_person}
                            onChange={handleChange}
                            style={{
                                width: '100%',
                                padding: '12px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '10px',
                                color: 'var(--fg)',
                                fontSize: '0.95rem'
                            }}
                        />
                    </div>

                    {/* 電話番号 */}
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ fontSize: '0.8rem', opacity: 0.6, display: 'block', marginBottom: '6px' }}>電話番号</label>
                        <input
                            type="tel"
                            name="phone"
                            placeholder="03-1234-5678"
                            value={formData.phone}
                            onChange={handleChange}
                            style={{
                                width: '100%',
                                padding: '12px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '10px',
                                color: 'var(--fg)',
                                fontSize: '0.95rem'
                            }}
                        />
                    </div>

                    {/* メールアドレス */}
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ fontSize: '0.8rem', opacity: 0.6, display: 'block', marginBottom: '6px' }}>メールアドレス</label>
                        <input
                            type="email"
                            name="email"
                            placeholder="例: contact@example.com"
                            value={formData.email}
                            onChange={handleChange}
                            style={{
                                width: '100%',
                                padding: '12px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '10px',
                                color: 'var(--fg)',
                                fontSize: '0.95rem'
                            }}
                        />
                    </div>

                    {/* 次アクション */}
                    <div style={{
                        marginBottom: '16px',
                        padding: '16px',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: '12px',
                        border: '1px solid rgba(255,255,255,0.05)'
                    }}>
                        <label style={{ fontSize: '0.8rem', opacity: 0.6, display: 'block', marginBottom: '10px' }}>📌 次アクション</label>
                        <input
                            type="date"
                            name="next_action_date"
                            value={formData.next_action_date}
                            onChange={handleChange}
                            style={{
                                width: '100%',
                                padding: '10px',
                                marginBottom: '8px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px',
                                color: 'var(--fg)',
                                fontSize: '0.9rem'
                            }}
                        />
                        <input
                            type="text"
                            name="next_action_content"
                            placeholder="やること（例: 見積もり送付）"
                            value={formData.next_action_content}
                            onChange={handleChange}
                            style={{
                                width: '100%',
                                padding: '10px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '8px',
                                color: 'var(--fg)',
                                fontSize: '0.9rem'
                            }}
                        />
                    </div>

                    {/* メモ */}
                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ fontSize: '0.8rem', opacity: 0.6, display: 'block', marginBottom: '6px' }}>メモ</label>
                        <textarea
                            name="notes"
                            rows={3}
                            placeholder="特記事項、商談メモなど..."
                            value={formData.notes}
                            onChange={handleChange}
                            style={{
                                width: '100%',
                                padding: '12px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '10px',
                                color: 'var(--fg)',
                                fontSize: '0.95rem',
                                resize: 'vertical'
                            }}
                        />
                    </div>

                    {/* 送信ボタン */}
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        style={{
                            width: '100%',
                            padding: '14px',
                            background: 'var(--job-sales)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '1rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 4px 12px var(--job-sales-glow)'
                        }}
                    >
                        {isSubmitting ? '登録中...' : 'リードを登録'}
                    </button>
                </form>

                <p style={{ textAlign: 'center', marginTop: '40px', paddingBottom: '40px' }}>
                    <a
                        href="#"
                        onClick={(e) => { e.preventDefault(); startTransition('/sales/leads'); }}
                        style={{ color: 'var(--job-sales)', fontSize: '0.85rem', textDecoration: 'none', opacity: 0.6 }}
                    >
                        キャンセル
                    </a>
                </p>
            </div>
        </div>
    );
}
