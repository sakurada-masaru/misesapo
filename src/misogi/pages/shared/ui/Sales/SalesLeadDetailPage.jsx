import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFlashTransition } from '../ReportTransition/reportTransition';
import Visualizer from '../Visualizer/Visualizer';
import '../../styles/components.css';

const STATUS_OPTIONS = [
    { value: 'appointment', label: 'アポ', color: '#3b82f6' },
    { value: 'estimate', label: '見積もり', color: '#8b5cf6' },
    { value: 'survey', label: '現地調査', color: '#f59e0b' },
    { value: 'screening', label: '顧客審査', color: '#22c55e' },
];

const PROBABILITY_OPTIONS = [
    { value: 'high', label: '高', icon: '🔥' },
    { value: 'medium', label: '中', icon: '🌤' },
    { value: 'low', label: '低', icon: '❄️' },
];

const TOUCH_TYPES = [
    { value: 'visit', label: '訪問', icon: '🚶' },
    { value: 'call', label: '電話', icon: '📞' },
    { value: 'email', label: 'メール', icon: '✉️' },
    { value: 'meeting', label: '商談', icon: '🤝' },
    { value: 'other', label: 'その他', icon: '📝' },
];

/**
 * リード詳細ページ (フルセット版)
 */
export default function SalesLeadDetailPage() {
    const { leadId } = useParams();
    const navigate = useNavigate();
    const { startTransition } = useFlashTransition();
    const [loading, setLoading] = useState(true);
    const [lead, setLead] = useState(null);
    const [timeline, setTimeline] = useState([]);
    const [showAddActivity, setShowAddActivity] = useState(false);
    const [newActivity, setNewActivity] = useState({ type: 'call', content: '' });
    const [nextAction, setNextAction] = useState({ date: '', content: '' });
    const [memo, setMemo] = useState('');
    const [saving, setSaving] = useState(false);

    const API_BASE = '/api';

    useEffect(() => {
        const fetchLead = async () => {
            try {
                const token = localStorage.getItem('cognito_id_token') ||
                    JSON.parse(localStorage.getItem('misesapo_auth') || '{}').token;
                const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

                const res = await fetch(`${API_BASE}/stores/${leadId}`, { headers });
                if (res.ok) {
                    const data = await res.json();
                    setLead(data);
                    setNextAction({ date: data.next_action_date || '', content: data.next_action_content || '' });
                    setMemo(data.notes || '');

                    // ダミータイムライン（本番はAPIから取得）
                    setTimeline([
                        { id: 1, type: 'call', content: '初回電話。担当者につながり、来週訪問のアポ取得。', date: '2026-01-28', by: '正田' },
                        { id: 2, type: 'visit', content: '訪問商談。サービス概要説明。見積もり依頼あり。', date: '2026-01-30', by: '正田' },
                    ]);
                }
            } catch (error) {
                console.error('Failed to fetch lead:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchLead();
    }, [leadId]);

    const handleStatusChange = async (newStatus) => {
        if (!lead) return;
        setSaving(true);
        try {
            const token = localStorage.getItem('cognito_id_token') ||
                JSON.parse(localStorage.getItem('misesapo_auth') || '{}').token;
            await fetch(`${API_BASE}/stores/${leadId}`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ lead_status: newStatus })
            });
            setLead({ ...lead, lead_status: newStatus });
        } catch (e) {
            console.error('Failed to update status:', e);
        } finally {
            setSaving(false);
        }
    };

    const handleAddActivity = () => {
        if (!newActivity.content.trim()) return;
        const activity = {
            id: Date.now(),
            type: newActivity.type,
            content: newActivity.content,
            date: new Date().toISOString().slice(0, 10),
            by: '自分'
        };
        setTimeline([activity, ...timeline]);
        setNewActivity({ type: 'call', content: '' });
        setShowAddActivity(false);
    };

    const handleSaveNextAction = async () => {
        setSaving(true);
        try {
            const token = localStorage.getItem('cognito_id_token') ||
                JSON.parse(localStorage.getItem('misesapo_auth') || '{}').token;
            await fetch(`${API_BASE}/stores/${leadId}`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    next_action_date: nextAction.date,
                    next_action_content: nextAction.content,
                    notes: memo
                })
            });
        } catch (e) {
            console.error('Failed to save:', e);
        } finally {
            setSaving(false);
        }
    };

    const getStatusColor = (status) => {
        const opt = STATUS_OPTIONS.find(o => o.value === status);
        return opt ? opt.color : '#6b7280';
    };

    const getStatusLabel = (status) => {
        const opt = STATUS_OPTIONS.find(o => o.value === status);
        return opt ? opt.label : status;
    };

    if (loading) {
        return (
            <div className="report-page" data-job="sales" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p className="job-entrance-dummy">読み込み中...</p>
            </div>
        );
    }

    if (!lead) {
        return (
            <div className="report-page" data-job="sales">
                <div className="report-page-content" style={{ textAlign: 'center', paddingTop: '60px' }}>
                    <p>リードが見つかりません</p>
                    <button onClick={() => startTransition('/sales/leads')}>戻る</button>
                </div>
            </div>
        );
    }

    return (
        <div className="report-page" data-job="sales">
            <div className="report-page-viz">
                <Visualizer mode="base" className="report-page-visualizer" />
            </div>

            <div className="report-page-content">
                {/* ヘッダー */}
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
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
                    <div>
                        <h1 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 600 }}>{lead.company_name || lead.name}</h1>
                        <p style={{ fontSize: '0.75rem', margin: 0, opacity: 0.6 }}>{lead.name}</p>
                    </div>
                </div>

                {/* ステータス＆見込み度 */}
                <div style={{
                    display: 'flex',
                    gap: '12px',
                    marginBottom: '20px',
                    padding: '16px',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.05)'
                }}>
                    <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '8px' }}>ステータス</p>
                        <span style={{
                            display: 'inline-block',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            background: getStatusColor(lead.lead_status),
                            color: '#fff',
                            fontSize: '0.85rem',
                            fontWeight: 600
                        }}>
                            {getStatusLabel(lead.lead_status)}
                        </span>
                    </div>
                    <div>
                        <p style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '8px' }}>見込み度</p>
                        <span style={{ fontSize: '1.5rem' }}>
                            {lead.probability === 'high' ? '🔥' : lead.probability === 'medium' ? '🌤' : '❄️'}
                        </span>
                    </div>
                </div>

                {/* ステータス変更ボタン */}
                <div style={{ marginBottom: '16px' }}>
                    <p style={{ fontSize: '0.75rem', opacity: 0.5, marginBottom: '8px' }}>ステータス変更</p>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {STATUS_OPTIONS.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => handleStatusChange(opt.value)}
                                disabled={saving}
                                style={{
                                    padding: '6px 10px',
                                    fontSize: '0.7rem',
                                    borderRadius: '6px',
                                    border: lead.lead_status === opt.value ? `2px solid ${opt.color}` : '1px solid rgba(255,255,255,0.1)',
                                    background: lead.lead_status === opt.value ? opt.color : 'rgba(255,255,255,0.05)',
                                    color: lead.lead_status === opt.value ? '#fff' : 'rgba(255,255,255,0.7)',
                                    cursor: 'pointer'
                                }}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 昇格ボタン */}
                {(() => {
                    const statusOrder = ['appointment', 'estimate', 'survey', 'screening'];
                    const currentIndex = statusOrder.indexOf(lead.lead_status);
                    const nextStatus = currentIndex >= 0 && currentIndex < statusOrder.length - 1
                        ? statusOrder[currentIndex + 1]
                        : null;
                    const nextLabel = nextStatus ? STATUS_OPTIONS.find(o => o.value === nextStatus)?.label : null;
                    const nextColor = nextStatus ? STATUS_OPTIONS.find(o => o.value === nextStatus)?.color : null;

                    if (!nextStatus) return null;

                    return (
                        <div style={{
                            padding: '16px',
                            background: `linear-gradient(135deg, ${nextColor}22, ${nextColor}11)`,
                            borderRadius: '16px',
                            border: `2px solid ${nextColor}55`,
                            marginBottom: '20px',
                            textAlign: 'center'
                        }}>
                            <button
                                onClick={() => handleStatusChange(nextStatus)}
                                disabled={saving}
                                style={{
                                    padding: '12px 28px',
                                    background: nextColor,
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '10px',
                                    fontSize: '0.95rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    boxShadow: `0 4px 12px ${nextColor}44`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    margin: '0 auto'
                                }}
                            >
                                <span>⬆️</span>
                                <span>「{nextLabel}」へ昇格</span>
                            </button>
                        </div>
                    );
                })()}

                {/* 基本情報 */}
                <div style={{
                    padding: '16px',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.05)',
                    marginBottom: '20px'
                }}>
                    <p style={{ fontSize: '0.75rem', opacity: 0.5, marginBottom: '12px' }}>基本情報</p>
                    <div style={{ display: 'grid', gap: '8px', fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ opacity: 0.6 }}>担当者</span>
                            <span>{lead.contact_person || '-'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ opacity: 0.6 }}>電話</span>
                            <a href={`tel:${lead.phone}`} style={{ color: 'var(--job-sales)' }}>{lead.phone || '-'}</a>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ opacity: 0.6 }}>メール</span>
                            <a href={`mailto:${lead.email}`} style={{ color: 'var(--job-sales)', fontSize: '0.8rem' }}>{lead.email || '-'}</a>
                        </div>
                    </div>
                </div>

                {/* 次アクション */}
                <div style={{
                    padding: '16px',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.05)',
                    marginBottom: '20px'
                }}>
                    <p style={{ fontSize: '0.75rem', opacity: 0.5, marginBottom: '12px' }}>📌 次アクション</p>
                    <input
                        type="date"
                        value={nextAction.date}
                        onChange={(e) => setNextAction({ ...nextAction, date: e.target.value })}
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
                        placeholder="やること（例: 見積もり送付）"
                        value={nextAction.content}
                        onChange={(e) => setNextAction({ ...nextAction, content: e.target.value })}
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
                <div style={{
                    padding: '16px',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.05)',
                    marginBottom: '20px'
                }}>
                    <p style={{ fontSize: '0.75rem', opacity: 0.5, marginBottom: '12px' }}>📝 メモ</p>
                    <textarea
                        placeholder="商談メモ、特記事項など..."
                        value={memo}
                        onChange={(e) => setMemo(e.target.value)}
                        rows={4}
                        style={{
                            width: '100%',
                            padding: '10px',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            color: 'var(--fg)',
                            fontSize: '0.9rem',
                            resize: 'vertical'
                        }}
                    />
                    <button
                        onClick={handleSaveNextAction}
                        disabled={saving}
                        style={{
                            marginTop: '12px',
                            width: '100%',
                            padding: '12px',
                            background: 'var(--job-sales)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        {saving ? '保存中...' : '保存する'}
                    </button>
                </div>

                {/* 商談タイムライン */}
                <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <p style={{ fontSize: '0.75rem', opacity: 0.5, margin: 0 }}>📋 商談タイムライン</p>
                        <button
                            onClick={() => setShowAddActivity(!showAddActivity)}
                            style={{
                                padding: '6px 12px',
                                fontSize: '0.75rem',
                                background: 'var(--job-sales)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer'
                            }}
                        >
                            + 追加
                        </button>
                    </div>

                    {showAddActivity && (
                        <div style={{
                            padding: '16px',
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: '12px',
                            marginBottom: '12px'
                        }}>
                            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
                                {TOUCH_TYPES.map(t => (
                                    <button
                                        key={t.value}
                                        onClick={() => setNewActivity({ ...newActivity, type: t.value })}
                                        style={{
                                            padding: '4px 10px',
                                            fontSize: '0.75rem',
                                            borderRadius: '6px',
                                            border: newActivity.type === t.value ? '2px solid var(--job-sales)' : '1px solid rgba(255,255,255,0.1)',
                                            background: newActivity.type === t.value ? 'var(--job-sales)' : 'transparent',
                                            color: '#fff',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {t.icon} {t.label}
                                    </button>
                                ))}
                            </div>
                            <textarea
                                placeholder="内容を入力..."
                                value={newActivity.content}
                                onChange={(e) => setNewActivity({ ...newActivity, content: e.target.value })}
                                rows={2}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px',
                                    color: 'var(--fg)',
                                    fontSize: '0.85rem',
                                    marginBottom: '10px'
                                }}
                            />
                            <button
                                onClick={handleAddActivity}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    background: 'var(--job-sales)',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer'
                                }}
                            >
                                記録する
                            </button>
                        </div>
                    )}

                    <div style={{ display: 'grid', gap: '8px' }}>
                        {timeline.map(item => {
                            const touchType = TOUCH_TYPES.find(t => t.value === item.type);
                            return (
                                <div key={item.id} style={{
                                    padding: '12px',
                                    background: 'rgba(255,255,255,0.03)',
                                    borderRadius: '12px',
                                    border: '1px solid rgba(255,255,255,0.05)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                        <span style={{ fontSize: '0.75rem' }}>
                                            {touchType?.icon} {touchType?.label}
                                        </span>
                                        <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>{item.date} / {item.by}</span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.5 }}>{item.content}</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
                {/* 顧客として登録ボタン */}
                {lead.lead_status === 'screening' && (
                    <div style={{
                        padding: '20px',
                        background: 'linear-gradient(135deg, rgba(34,197,94,0.1), rgba(34,197,94,0.05))',
                        borderRadius: '16px',
                        border: '2px solid rgba(34,197,94,0.3)',
                        marginBottom: '20px',
                        textAlign: 'center'
                    }}>
                        <p style={{ fontSize: '0.85rem', marginBottom: '12px', opacity: 0.8 }}>
                            🎉 顧客審査を通過しましたか？
                        </p>
                        <button
                            onClick={() => {
                                // 顧客登録ページに情報を引き継いで遷移
                                const params = new URLSearchParams({
                                    company_name: lead.company_name || '',
                                    store_name: lead.name || '',
                                    phone: lead.phone || '',
                                    email: lead.email || '',
                                    from_lead: leadId
                                });
                                navigate(`/sales/clients/new?${params.toString()}`);
                            }}
                            style={{
                                padding: '14px 32px',
                                background: '#22c55e',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '12px',
                                fontSize: '1rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                boxShadow: '0 4px 16px rgba(34,197,94,0.3)'
                            }}
                        >
                            顧客として登録する
                        </button>
                    </div>
                )}

                <p style={{ textAlign: 'center', marginTop: '40px', paddingBottom: '40px' }}>
                    <a
                        href="#"
                        onClick={(e) => { e.preventDefault(); startTransition('/sales/leads'); }}
                        style={{ color: 'var(--job-sales)', fontSize: '0.85rem', textDecoration: 'none', opacity: 0.6 }}
                    >
                        リード一覧へ戻る
                    </a>
                </p>
            </div>
        </div>
    );
}
