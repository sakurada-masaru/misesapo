import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFlashTransition } from '../../../shared/ui/ReportTransition/reportTransition';
import Visualizer from '../../../shared/ui/Visualizer/Visualizer';
import '../../../shared/styles/components.css';

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

/**
 * 事務ジョブ用・顧客（店舗）新規登録ページ
 */
export default function OfficeClientNewPage() {
  const navigate = useNavigate();
  const { startTransition } = useFlashTransition();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [brands, setBrands] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    client_id: '',
    new_client_name: '',
    brand_id: '',
    new_brand_name: '',
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

  const headers = () => ({
    Authorization: `Bearer ${localStorage.getItem('cognito_id_token') || (JSON.parse(localStorage.getItem('misesapo_auth') || '{}').token)}`,
    'Content-Type': 'application/json',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [clientsRes, brandsRes] = await Promise.all([
          fetch(`${API_BASE}/clients`, { headers: headers() }).catch(() => ({ ok: false })),
          fetch(`${API_BASE}/brands`, { headers: headers() }).catch(() => ({ ok: false })),
        ]);
        if (clientsRes.ok) {
          const d = await clientsRes.json();
          setClients(Array.isArray(d) ? d : d.items || []);
        }
        if (brandsRes.ok) {
          const d = await brandsRes.json();
          setBrands(Array.isArray(d) ? d : d.items || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const brandsForClient = form.client_id
    ? brands.filter((b) => String(b.client_id) === String(form.client_id))
    : [];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === 'client_id') setForm((prev) => ({ ...prev, brand_id: '', new_brand_name: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let clientId = form.client_id;
      let brandId = form.brand_id;

      if (form.new_client_name.trim()) {
        const res = await fetch(`${API_BASE}/clients`, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({
            name: form.new_client_name.trim(),
            status: 'active',
          }),
        });
        if (!res.ok) throw new Error('法人の登録に失敗しました');
        const data = await res.json();
        clientId = data.id || data.client?.id;
      }
      if (!clientId) {
        alert('法人を選択するか、新規法人名を入力してください。');
        setIsSubmitting(false);
        return;
      }

      if (form.new_brand_name.trim()) {
        const res = await fetch(`${API_BASE}/brands`, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({
            client_id: clientId,
            name: form.new_brand_name.trim(),
            status: 'active',
          }),
        });
        if (!res.ok) throw new Error('ブランドの登録に失敗しました');
        const data = await res.json();
        brandId = data.id || data.brand?.id;
      }
      if (!brandId && brandsForClient.length === 0 && !form.new_brand_name.trim()) {
        alert('ブランドを選択するか、新規ブランド名を入力してください。');
        setIsSubmitting(false);
        return;
      }
      if (!brandId && form.new_brand_name.trim()) {
        // brandId was set above
      } else if (!brandId) {
        brandId = brandsForClient[0]?.id;
      }

      if (!form.name.trim()) {
        alert('店舗名を入力してください。');
        setIsSubmitting(false);
        return;
      }

      const storePayload = {
        client_id: clientId,
        brand_id: brandId || '',
        name: form.name.trim(),
        contact_person: form.contact_person.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        url: form.url.trim(),
        status: form.status,
        cleaning_frequency: form.cleaning_frequency.trim(),
        acquired_by: form.acquired_by.trim(),
        assigned_to: form.assigned_to.trim(),
        introducer: form.introducer.trim(),
        needs_notes: form.needs_notes.trim(),
        implementation_items: form.implementation_items.trim(),
      };

      const res = await fetch(`${API_BASE}/stores`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(storePayload),
      });
      if (!res.ok) throw new Error('店舗の登録に失敗しました');
      alert('登録しました。');
      startTransition('/office/clients/list');
    } catch (err) {
      console.error(err);
      alert(err.message || '登録に失敗しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="report-page" data-job="office" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p className="job-entrance-dummy">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="report-page" data-job="office">
      <div className="report-page-viz">
        <Visualizer mode="base" className="report-page-visualizer" />
      </div>
      <div className="report-page-content">
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
          <button
            type="button"
            onClick={() => startTransition('/office/clients/list')}
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
          <h1 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 600 }}>新規登録</h1>
          <button
            type="button"
            onClick={() => navigate('/office/clients/list')}
            style={{ marginLeft: 'auto', padding: '8px 16px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', color: 'var(--fg)', cursor: 'pointer' }}
          >
            一覧
          </button>
        </div>

        <form onSubmit={handleSubmit} className="report-page-form">
          <div className="report-page-field">
            <label>法人</label>
            <select name="client_id" value={form.client_id} onChange={handleChange} style={{ width: '100%', padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'var(--fg)' }}>
              <option value="">-- 選択 --</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name || c.company_name || c.id}</option>
              ))}
            </select>
          </div>
          <div className="report-page-field">
            <label>新規法人名（上で選択しない場合）</label>
            <input type="text" name="new_client_name" value={form.new_client_name} onChange={handleChange} placeholder="新規で法人を登録する場合" style={{ width: '100%', padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'var(--fg)' }} />
          </div>
          <div className="report-page-field">
            <label>ブランド</label>
            <select name="brand_id" value={form.brand_id} onChange={handleChange} style={{ width: '100%', padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'var(--fg)' }}>
              <option value="">-- 選択 --</option>
              {brandsForClient.map((b) => (
                <option key={b.id} value={b.id}>{b.name || b.id}</option>
              ))}
            </select>
          </div>
          <div className="report-page-field">
            <label>新規ブランド名（上で選択しない場合）</label>
            <input type="text" name="new_brand_name" value={form.new_brand_name} onChange={handleChange} placeholder="新規でブランドを登録する場合" style={{ width: '100%', padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'var(--fg)' }} />
          </div>
          <div className="report-page-field">
            <label>店舗名 *</label>
            <input type="text" name="name" value={form.name} onChange={handleChange} required placeholder="店舗名" style={{ width: '100%', padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'var(--fg)' }} />
          </div>
          <div className="report-page-field">
            <label>担当者</label>
            <input type="text" name="contact_person" value={form.contact_person} onChange={handleChange} style={{ width: '100%', padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'var(--fg)' }} />
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
            <label>清掃頻度</label>
            <input type="text" name="cleaning_frequency" value={form.cleaning_frequency} onChange={handleChange} placeholder="毎月清掃 / スポット清掃 等" style={{ width: '100%', padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'var(--fg)' }} />
          </div>
          <div className="report-page-field">
            <label>獲得者(ミセサポ)</label>
            <input type="text" name="acquired_by" value={form.acquired_by} onChange={handleChange} style={{ width: '100%', padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'var(--fg)' }} />
          </div>
          <div className="report-page-field">
            <label>担当者(ミセサポ)</label>
            <input type="text" name="assigned_to" value={form.assigned_to} onChange={handleChange} style={{ width: '100%', padding: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'var(--fg)' }} />
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
          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button type="submit" disabled={isSubmitting} style={{ padding: '12px 24px', background: 'var(--job-office)', border: 'none', borderRadius: 8, color: '#fff', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontWeight: 600 }}>
              {isSubmitting ? '登録中...' : '登録する'}
            </button>
            <button type="button" onClick={() => startTransition('/office/clients/list')} style={{ padding: '12px 24px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: 'var(--fg)', cursor: 'pointer' }}>
              キャンセル
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
