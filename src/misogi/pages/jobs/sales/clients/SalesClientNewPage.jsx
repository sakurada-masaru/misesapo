import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFlashTransition } from '../../../shared/ui/ReportTransition/reportTransition';
import Visualizer from '../../../shared/ui/Visualizer/Visualizer';
import '../../../shared/styles/components.css';

/**
 * 顧客登録ページ (スマホ特化レイアウト)
 */
export default function SalesClientNewPage() {
    const navigate = useNavigate();
    const { startTransition } = useFlashTransition();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        company_name: '',
        store_name: '',
        contact_person: '',
        phone: '',
        email: '',
        lead_status: 'negotiating',
        probability: '',
        notes: ''
    });

    const API_BASE = '/api';

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
            probability: formData.probability,
            notes: formData.notes,
            sales_rep: '正田和輝',
            registration_type: 'sales_lead',
            status: 'pending_customer_info',
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
                const result = await response.json();
                const inviteLink = `${window.location.origin}/registration/customer-complete.html?token=${result.id}`;
                alert(`リードを登録しました！\n\n招待リンク:\n${inviteLink}`);
                startTransition('/jobs/sales/entrance');
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
                    <h1 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 600 }}>顧客登録</h1>
                    <button
                        type="button"
                        onClick={() => navigate('/sales/clients/list')}
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
                        一覧
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="report-page-form">
                    <div className="report-page-field">
                        <label style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '8px' }}>会社名・屋号 *</label>
                        <textarea
                            name="company_name"
                            rows="1"
                            required
                            placeholder="例: 株式会社 Dart Ace"
                            value={formData.company_name}
                            onChange={handleChange}
                            style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}
                        />
                    </div>

                    <div className="report-page-field">
                        <label style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '8px' }}>店舗名 *</label>
                        <textarea
                            name="store_name"
                            rows="1"
                            required
                            placeholder="例: 日本橋茅場町店"
                            value={formData.store_name}
                            onChange={handleChange}
                            style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}
                        />
                    </div>

                    <div className="report-page-field">
                        <label style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '8px' }}>電話番号 *</label>
                        <textarea
                            name="phone"
                            rows="1"
                            required
                            placeholder="03-1234-5678"
                            value={formData.phone}
                            onChange={handleChange}
                            style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}
                        />
                    </div>

                    <div className="report-page-field">
                        <label style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '8px' }}>メールアドレス *</label>
                        <textarea
                            name="email"
                            rows="1"
                            required
                            placeholder="info@example.com"
                            value={formData.email}
                            onChange={handleChange}
                            style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}
                        />
                    </div>

                    <div className="form-actions" style={{ marginTop: '32px' }}>
                        <button
                            type="submit"
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
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? '登録中...' : '登録して招待リンクを送信'}
                        </button>
                    </div>
                </form>

                <p style={{ textAlign: 'center', marginTop: '40px', paddingBottom: '40px' }}>
                    <a
                        href="#"
                        onClick={(e) => { e.preventDefault(); startTransition('/jobs/sales/entrance'); }}
                        style={{ color: 'var(--job-sales)', fontSize: '0.85rem', textDecoration: 'none', opacity: 0.6 }}
                    >
                        キャンセルして戻る
                    </a>
                </p>
            </div>
        </div>
    );
}
