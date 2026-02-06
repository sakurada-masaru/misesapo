import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Visualizer from '../shared/ui/Visualizer/Visualizer';
import '../shared/styles/components.css';

/**
 * お客様情報登録ページ (招待リンクからアクセスされる公開ページ)
 */
export default function CustomerOnboardingPage() {
    const { storeId } = useParams();
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [storeInfo, setStoreInfo] = useState(null);

    const [formData, setFormData] = useState({
        company_name: '',
        company_name_kana: '',
        representative_name: '',
        contact_person: '',
        phone: '',
        email: '',
        postcode: '',
        pref: '',
        city: '',
        address1: '',
        address2: '',
        floor_area: '',
        business_type: '',
        cleaning_frequency: '',
        preferred_days: [],
        preferred_time: '',
        services: [],
        requests: ''
    });

    const API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';

    useEffect(() => {
        // 既存の情報を取得
        if (!storeId) return;

        const fetchStore = async () => {
            try {
                const res = await fetch(`${API_BASE}/stores/${storeId}`);
                if (res.ok) {
                    const data = await res.json();
                    setStoreInfo(data);
                    setFormData(prev => ({
                        ...prev,
                        company_name: data.company_name || '',
                        contact_person: data.contact_person || '',
                        phone: data.phone || '',
                        email: data.email || '',
                        company_name_kana: data.company_name_kana || '',
                        pref: data.pref || '',
                        city: data.city || '',
                        address1: data.address1 || '',
                        address2: data.address2 || '',
                    }));
                }
            } catch (err) {
                console.error('Failed to fetch store info:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchStore();
    }, [storeId]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (type === 'checkbox') {
            const currentArray = formData[name] || [];
            if (checked) {
                setFormData(prev => ({ ...prev, [name]: [...currentArray, value] }));
            } else {
                setFormData(prev => ({ ...prev, [name]: currentArray.filter(v => v !== value) }));
            }
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const payload = {
                ...formData,
                id: storeId,
                status: 'active', // 登録完了でアクティブにする
                updated_at: new Date().toISOString()
            };

            const res = await fetch(`${API_BASE}/stores/${storeId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setCompleted(true);
            } else {
                alert('送信に失敗しました。時間をおいて再度お試しいただくか、担当者へご連絡ください。');
            }
        } catch (err) {
            console.error('Submit error:', err);
            alert('接続エラーが発生しました。');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="onboarding-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
                <p style={{ color: 'var(--fg)', opacity: 0.6 }}>読み込み中...</p>
            </div>
        );
    }

    if (completed) {
        return (
            <div className="onboarding-page onboarding-success">
                <div className="onboarding-viz">
                    <Visualizer mode="base" className="onboarding-visualizer" />
                </div>
                <div className="onboarding-card glass">
                    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                        <div style={{ fontSize: '4rem', marginBottom: '20px' }}>✨</div>
                        <h1 style={{ fontSize: '1.5rem', marginBottom: '16px' }}>ご登録ありがとうございました</h1>
                        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            入力いただいた情報は正常に送信されました。<br />
                            内容を確認の上、担当者より改めてご連絡させていただきます。
                        </p>
                        <button
                            onClick={() => window.location.href = 'https://misesapo.co.jp'}
                            style={{
                                marginTop: '32px',
                                padding: '12px 32px',
                                borderRadius: '999px',
                                background: 'var(--job-sales)',
                                border: 'none',
                                color: '#fff',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            公式サイトへ
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="onboarding-page">
            <div className="onboarding-viz">
                <Visualizer mode="base" className="onboarding-visualizer" />
            </div>

            <div className="onboarding-container">
                <header className="onboarding-header">
                    <img src="/misogi/images/logo_144x144.png" alt="ミセサポ" className="onboarding-logo" />
                    <h1>お客様情報登録</h1>
                    <p>サービス利用のお手続きを完了してください</p>
                </header>

                <div className="onboarding-progress">
                    {[1, 2, 3, 4].map(s => (
                        <div key={s} className={`progress-step ${step >= s ? 'active' : ''} ${step > s ? 'completed' : ''}`}>
                            <div className="step-num">{step > s ? '✓' : s}</div>
                            <div className="step-label">{['基本情報', '店舗情報', '清掃希望', '確認'][s - 1]}</div>
                        </div>
                    ))}
                </div>

                <div className="onboarding-card glass">
                    <form onSubmit={handleSubmit}>
                        {step === 1 && (
                            <div className="step-content ani-fade-in">
                                <h2><i className="fas fa-building"></i> 基本情報</h2>
                                <div className="field-group">
                                    <label>会社名・屋号 <span className="req">*</span></label>
                                    <input type="text" name="company_name" value={formData.company_name} onChange={handleChange} required placeholder="株式会社 ○○" />
                                </div>
                                <div className="field-row">
                                    <div className="field-group">
                                        <label>代表者名 <span className="req">*</span></label>
                                        <input type="text" name="representative_name" value={formData.representative_name} onChange={handleChange} required />
                                    </div>
                                    <div className="field-group">
                                        <label>ご担当者名 <span className="req">*</span></label>
                                        <input type="text" name="contact_person" value={formData.contact_person} onChange={handleChange} required />
                                    </div>
                                </div>
                                <div className="field-row">
                                    <div className="field-group">
                                        <label>電話番号 <span className="req">*</span></label>
                                        <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required placeholder="03-1234-5678" />
                                    </div>
                                    <div className="field-group">
                                        <label>メールアドレス <span className="req">*</span></label>
                                        <input type="email" name="email" value={formData.email} onChange={handleChange} required />
                                    </div>
                                </div>
                                <div className="btn-row">
                                    <button type="button" className="btn-next" onClick={() => setStep(2)}>次へ進む</button>
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="step-content ani-fade-in">
                                <h2><i className="fas fa-store"></i> 店舗情報</h2>
                                <div className="field-row">
                                    <div className="field-group" style={{ flex: '0 0 120px' }}>
                                        <label>郵便番号</label>
                                        <input type="text" name="postcode" value={formData.postcode} onChange={handleChange} placeholder="123-4567" />
                                    </div>
                                    <div className="field-group">
                                        <label>都道府県</label>
                                        <input type="text" name="pref" value={formData.pref} onChange={handleChange} />
                                    </div>
                                </div>
                                <div className="field-group">
                                    <label>市区町村・番地</label>
                                    <input type="text" name="address1" value={formData.address1} onChange={handleChange} placeholder="新宿区西新宿1-1-1" />
                                </div>
                                <div className="field-group">
                                    <label>建物名・階数</label>
                                    <input type="text" name="address2" value={formData.address2} onChange={handleChange} placeholder="ビル名 3F" />
                                </div>
                                <div className="field-row">
                                    <div className="field-group">
                                        <label>店舗面積（坪）</label>
                                        <input type="number" name="floor_area" value={formData.floor_area} onChange={handleChange} placeholder="20" />
                                    </div>
                                    <div className="field-group">
                                        <label>業種</label>
                                        <select name="business_type" value={formData.business_type} onChange={handleChange}>
                                            <option value="">選択してください</option>
                                            <option value="飲食店">飲食店</option>
                                            <option value="オフィス">オフィス</option>
                                            <option value="クリニック">クリニック</option>
                                            <option value="その他">その他</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="btn-row">
                                    <button type="button" className="btn-back" onClick={() => setStep(1)}>戻る</button>
                                    <button type="button" className="btn-next" onClick={() => setStep(3)}>次へ進む</button>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="step-content ani-fade-in">
                                <h2><i className="fas fa-broom"></i> 清掃希望</h2>
                                <div className="field-group">
                                    <label>希望清掃頻度</label>
                                    <select name="cleaning_frequency" value={formData.cleaning_frequency} onChange={handleChange}>
                                        <option value="">選択してください</option>
                                        <option value="毎日">毎日</option>
                                        <option value="週2-3回">週2-3回</option>
                                        <option value="週1回">週1回</option>
                                        <option value="スポット">スポット（単発）</option>
                                    </select>
                                </div>
                                <div className="field-group">
                                    <label>希望曜日</label>
                                    <div className="check-grid">
                                        {['月', '火', '水', '木', '金', '土', '日'].map(d => (
                                            <label key={d} className="check-item" style={{ padding: '10px' }}>
                                                <input type="checkbox" name="preferred_days" value={d} checked={(formData.preferred_days || []).includes(d)} onChange={handleChange} />
                                                <span>{d}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="field-group">
                                    <label>希望時間帯</label>
                                    <select name="preferred_time" value={formData.preferred_time} onChange={handleChange}>
                                        <option value="">選択してください</option>
                                        <option value="早朝（5:00-8:00）">早朝（5:00-8:00）</option>
                                        <option value="午前（8:00-12:00）">午前（8:00-12:00）</option>
                                        <option value="午後（12:00-17:00）">午後（12:00-17:00）</option>
                                        <option value="夕方（17:00-20:00）">夕方（17:00-20:00）</option>
                                        <option value="深夜（20:00-5:00）">深夜（20:00-5:00）</option>
                                    </select>
                                </div>
                                <div className="field-group">
                                    <label>希望サービス</label>
                                    <div className="check-grid">
                                        {['床清掃', 'トイレ清掃', '厨房清掃', '窓ガラス', 'エアコン'].map(s => (
                                            <label key={s} className="check-item" style={{ padding: '10px' }}>
                                                <input type="checkbox" name="services" value={s} checked={(formData.services || []).includes(s)} onChange={handleChange} />
                                                <span>{s}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="field-group">
                                    <label>ご要望・備考</label>
                                    <textarea name="requests" value={formData.requests} onChange={handleChange} rows="4" placeholder="特記事項があればご記入ください"></textarea>
                                </div>
                                <div className="btn-row">
                                    <button type="button" className="btn-back" onClick={() => setStep(2)}>戻る</button>
                                    <button type="button" className="btn-next" onClick={() => setStep(4)}>確認画面へ</button>
                                </div>
                            </div>
                        )}

                        {step === 4 && (
                            <div className="step-content ani-fade-in">
                                <h2><i className="fas fa-check-circle"></i> 入力内容の確認</h2>
                                <div className="confirm-box">
                                    <div className="confirm-item">
                                        <label>会社名</label>
                                        <div>{formData.company_name}</div>
                                    </div>
                                    <div className="confirm-item">
                                        <label>担当者名</label>
                                        <div>{formData.contact_person}</div>
                                    </div>
                                    <div className="confirm-item">
                                        <label>電話番号</label>
                                        <div>{formData.phone}</div>
                                    </div>
                                    <div className="confirm-item">
                                        <label>住所</label>
                                        <div>{formData.pref}{formData.city}{formData.address1} {formData.address2}</div>
                                    </div>
                                    <div className="confirm-item">
                                        <label>清掃頻度</label>
                                        <div>{formData.cleaning_frequency || '-'}</div>
                                    </div>
                                    <div className="confirm-item">
                                        <label>希望曜日</label>
                                        <div>{(formData.preferred_days || []).join('・') || '-'}</div>
                                    </div>
                                    <div className="confirm-item">
                                        <label>希望時間帯</label>
                                        <div>{formData.preferred_time || '-'}</div>
                                    </div>
                                </div>
                                <div style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '16px', textAlign: 'center' }}>
                                    ※「登録を完了する」ボタンを押すと送信されます
                                </div>
                                <div className="btn-row">
                                    <button type="button" className="btn-back" onClick={() => setStep(3)}>戻る</button>
                                    <button type="submit" className="btn-submit" disabled={submitting}>
                                        {submitting ? '送信中...' : '登録を完了する'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </form>
                </div>
            </div>

            <style>{`
                .onboarding-page {
                    min-height: 100vh;
                    background: var(--bg);
                    color: var(--fg);
                    padding: 40px 20px;
                    font-family: var(--font-family-base);
                    position: relative;
                }
                .onboarding-viz {
                    position: fixed;
                    top: 0; left: 0; width: 100%; height: 100%;
                    z-index: 0;
                    opacity: 0.5;
                }
                .onboarding-container {
                    position: relative;
                    z-index: 1;
                    max-width: 640px;
                    margin: 0 auto;
                }
                .onboarding-header {
                    text-align: center;
                    margin-bottom: 40px;
                }
                .onboarding-logo {
                    width: 72px;
                    height: 72px;
                    margin-bottom: 16px;
                }
                .onboarding-header h1 {
                    font-size: 1.8rem;
                    margin: 0 0 8px;
                    font-weight: 700;
                    background: linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.7) 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                .onboarding-header p {
                    color: var(--text-secondary);
                    font-size: 0.95rem;
                }
                .onboarding-progress {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 32px;
                    padding: 0 10px;
                }
                .progress-step {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                    flex: 1;
                    position: relative;
                }
                .progress-step::after {
                    content: '';
                    position: absolute;
                    top: 15px;
                    left: 50%;
                    width: 100%;
                    height: 2px;
                    background: rgba(255,255,255,0.1);
                    z-index: -1;
                }
                .progress-step:last-child::after { display: none; }
                .step-num {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.85rem;
                    font-weight: 700;
                    color: rgba(255,255,255,0.3);
                    transition: all 0.3s;
                }
                .progress-step.active .step-num {
                    background: var(--job-sales);
                    border-color: var(--job-sales);
                    color: #fff;
                    box-shadow: 0 0 15px var(--job-sales-glow);
                }
                .progress-step.completed .step-num {
                    background: #22c55e;
                    border-color: #22c55e;
                    color: #fff;
                }
                .step-label {
                    font-size: 0.7rem;
                    color: rgba(255,255,255,0.3);
                }
                .progress-step.active .step-label { color: #fff; font-weight: 600; }

                .onboarding-card.glass {
                    background: rgba(255, 255, 255, 0.03);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 24px;
                    padding: 32px;
                    box-shadow: 0 20px 50px rgba(0,0,0,0.3);
                }
                .step-content h2 {
                    font-size: 1.2rem;
                    margin: 0 0 24px;
                    padding-bottom: 12px;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                }
                .field-group { margin-bottom: 20px; }
                .field-row { display: flex; gap: 16px; margin-bottom: 20px; }
                .field-row .field-group { flex: 1; margin-bottom: 0; }
                label { display: block; font-size: 0.85rem; color: rgba(255,255,255,0.6); margin-bottom: 8px; }
                .req { color: #ef4444; margin-left: 2px; }
                input, select, textarea {
                    width: 100%;
                    padding: 12px 16px;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 12px;
                    color: #fff;
                    font-size: 1rem;
                    outline: none;
                    transition: all 0.2s;
                }
                input:focus, select:focus, textarea:focus {
                    background: rgba(255,255,255,0.08);
                    border-color: var(--job-sales);
                    box-shadow: 0 0 0 4px var(--job-sales-glow);
                }
                .check-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
                .check-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    background: rgba(255,255,255,0.03);
                    padding: 12px;
                    border-radius: 12px;
                    cursor: pointer;
                    margin-bottom: 0;
                }
                .check-item input { width: auto; }
                .btn-row { display: flex; gap: 12px; margin-top: 40px; }
                .btn-next, .btn-submit {
                    flex: 1;
                    padding: 14px;
                    background: var(--job-sales);
                    color: #fff;
                    border: none;
                    border-radius: 12px;
                    font-weight: 700;
                    cursor: pointer;
                    box-shadow: 0 4px 15px var(--job-sales-glow);
                    transition: all 0.2s;
                }
                .btn-next:hover, .btn-submit:hover { transform: translateY(-2px); filter: brightness(1.1); }
                .btn-back {
                    padding: 14px 24px;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    color: #fff;
                    border-radius: 12px;
                    font-weight: 600;
                    cursor: pointer;
                }
                .confirm-box {
                    background: rgba(255,255,255,0.02);
                    border-radius: 16px;
                    padding: 24px;
                }
                .confirm-item { margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 12px; }
                .confirm-item:last-child { border: none; }
                .confirm-item label { color: rgba(255,255,255,0.4); font-size: 0.75rem; margin-bottom: 4px; }
                .confirm-item div { font-size: 1rem; }

                .ani-fade-in { animation: fadeIn 0.4s ease-out; }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                @media (max-width: 480px) {
                    .field-row { flex-direction: column; }
                    .onboarding-card { padding: 24px 20px; }
                }
            `}</style>
        </div>
    );
}
