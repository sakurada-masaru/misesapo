import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFlashTransition } from '../../../shared/ui/ReportTransition/reportTransition';
import Visualizer from '../../../shared/ui/Visualizer/Visualizer';
import { normalizeGatewayBase, YOTEI_GATEWAY } from '../../../shared/api/gatewayBase';
import { useAuth } from '../../../shared/auth/useAuth';
import '../../../shared/styles/components.css';
import './sales-client-pages.css';

/**
 * 顧客登録ページ (スマホ特化レイアウト)
 */
export default function SalesClientNewPage() {
    const navigate = useNavigate();
    const { startTransition } = useFlashTransition();
    const { getToken, user } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [copyDone, setCopyDone] = useState(false);
    const [successData, setSuccessData] = useState(null); // { inviteLink: string }
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

    const API_BASE = (() => {
        if (typeof window !== 'undefined') {
            const host = String(window.location?.hostname || '').toLowerCase();
            if (host === 'localhost' || host === '127.0.0.1') return '/api';
        }
        return normalizeGatewayBase(import.meta.env?.VITE_API_BASE, YOTEI_GATEWAY);
    })();

    const actorName = useMemo(() => {
        const fromUser = String(
            user?.name
            || user?.displayName
            || user?.nickname
            || user?.username
            || ''
        ).trim();
        if (fromUser) return fromUser;
        try {
            const auth = JSON.parse(localStorage.getItem('misesapo_auth') || '{}');
            return String(auth?.name || auth?.email || '').trim();
        } catch {
            return '';
        }
    }, [user]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitError('');
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
            sales_rep: actorName || '営業担当',
            registration_type: 'sales_lead',
            status: 'pending_customer_info',
            created_at: new Date().toISOString()
        };

        try {
            const token = getToken?.();
            if (!token) throw new Error('認証トークンを取得できません。再ログインしてください。');

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
                const inviteLink = `${window.location.origin}/misogi/#/registration/onboarding/${result.id}`;
                setSuccessData({ inviteLink });
            } else {
                const text = await response.text().catch(() => '');
                throw new Error(`登録に失敗しました (${response.status}) ${text}`.trim());
            }
        } catch (error) {
            console.error('Error:', error);
            setSubmitError(error?.message || '登録に失敗しました。');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="report-page sales-client-new-page" data-job="sales">
            <div className="report-page-viz">
                <Visualizer mode="base" className="report-page-visualizer" />
            </div>

            <div className="report-page-content sales-client-new-content">
                <div className="sales-client-new-head">
                    <button
                        type="button"
                        onClick={() => startTransition('/jobs/sales/entrance')}
                        className="sales-client-new-back"
                        aria-label="営業エントランスへ戻る"
                    >
                        ←
                    </button>
                    <div className="sales-client-new-title-wrap">
                        <h1 className="sales-client-new-title">顧客登録申請</h1>
                        <p className="sales-client-new-sub">営業担当が顧客情報を入力し、申請を送信します。</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate('/sales/clients/list')}
                        className="sales-client-new-link-btn"
                    >
                        一覧
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="report-page-form sales-client-new-form">
                    <div className="report-page-field sales-client-new-field">
                        <label>1. 会社名・屋号 *</label>
                        <input
                            name="company_name"
                            type="text"
                            required
                            placeholder="例: 株式会社 Dart Ace"
                            value={formData.company_name}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="report-page-field sales-client-new-field">
                        <label>2. 店舗名 *</label>
                        <input
                            name="store_name"
                            type="text"
                            required
                            placeholder="例: 日本橋茅場町店"
                            value={formData.store_name}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="report-page-field sales-client-new-field">
                        <label>3. 担当者名 *</label>
                        <input
                            name="contact_person"
                            type="text"
                            required
                            placeholder="例: 山田 太郎"
                            value={formData.contact_person}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="report-page-field sales-client-new-field">
                        <label>4. 電話番号 *</label>
                        <input
                            name="phone"
                            type="tel"
                            required
                            placeholder="03-1234-5678"
                            value={formData.phone}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="report-page-field sales-client-new-field">
                        <label>5. メールアドレス *</label>
                        <input
                            name="email"
                            type="email"
                            required
                            placeholder="info@example.com"
                            value={formData.email}
                            onChange={handleChange}
                        />
                    </div>

                    {submitError ? <p className="sales-client-new-error">{submitError}</p> : null}

                    <div className="form-actions sales-client-new-actions">
                        <button
                            type="submit"
                            className="sales-client-new-submit"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? '登録中...' : '登録して招待リンクを送信'}
                        </button>
                    </div>
                </form>

                <p className="sales-client-new-cancel">
                    <a
                        href="#"
                        onClick={(e) => { e.preventDefault(); startTransition('/jobs/sales/entrance'); }}
                    >
                        キャンセルして戻る
                    </a>
                </p>
            </div>

            {successData && (
                <div className="sales-client-new-modal-backdrop">
                    <div className="sales-client-new-modal">
                        <div className="sales-client-new-modal-icon">✓</div>
                        <h2>リード登録完了</h2>
                        <p className="sales-client-new-modal-sub">
                            リードの登録が完了しました。<br />以下の招待リンクをお客様へお送りください。
                        </p>

                        <div className="sales-client-new-invite-url">
                            {successData.inviteLink}
                        </div>

                        <div className="sales-client-new-modal-actions">
                            <button
                                type="button"
                                onClick={() => {
                                    navigator.clipboard.writeText(successData.inviteLink);
                                    setCopyDone(true);
                                    window.setTimeout(() => setCopyDone(false), 1600);
                                }}
                                className="sales-client-new-modal-btn"
                            >
                                {copyDone ? 'コピー済み' : 'リンクをコピー'}
                            </button>
                            <button
                                type="button"
                                onClick={() => startTransition('/jobs/sales/entrance')}
                                className="sales-client-new-modal-btn primary"
                            >
                                完了
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
