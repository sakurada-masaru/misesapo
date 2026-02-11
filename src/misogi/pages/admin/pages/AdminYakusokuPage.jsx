import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import './admin-yotei-timeline.css'; // Reuse styling

function isLocalUiHost() {
  if (typeof window === 'undefined') return false;
  const h = window.location?.hostname || '';
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
}

const IS_LOCAL = import.meta.env?.DEV || isLocalUiHost();
const API_BASE = IS_LOCAL
  ? '/api'
  : (import.meta.env?.VITE_API_BASE || 'https://v7komjxk4k.execute-api.ap-northeast-1.amazonaws.com/prod');
const YAKUSOKU_FALLBACK_BASE = IS_LOCAL
  ? '/api2'
  : (import.meta.env?.VITE_YAKUSOKU_API_BASE || API_BASE);
const MASTER_API_BASE = IS_LOCAL
  ? '/api-master'
  : (import.meta.env?.VITE_MASTER_API_BASE || 'https://jtn6in2iuj.execute-api.ap-northeast-1.amazonaws.com/prod');

function authHeaders() {
  const legacyAuth = (() => {
    try {
      return JSON.parse(localStorage.getItem('misesapo_auth') || '{}')?.token || '';
    } catch {
      return '';
    }
  })();
  const token =
    localStorage.getItem('idToken') ||
    localStorage.getItem('cognito_id_token') ||
    localStorage.getItem('id_token') ||
    localStorage.getItem('accessToken') ||
    localStorage.getItem('cognito_access_token') ||
    localStorage.getItem('token') ||
    legacyAuth ||
    '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchYakusokuWithFallback(path, options = {}) {
  const primaryBase = API_BASE.replace(/\/$/, '');
  const primaryRes = await fetch(`${primaryBase}${path}`, options);
  if (primaryRes.ok) return primaryRes;
  if (![401, 403, 404].includes(primaryRes.status)) return primaryRes;
  const fallbackBase = YAKUSOKU_FALLBACK_BASE.replace(/\/$/, '');
  if (fallbackBase === primaryBase) return primaryRes;
  return fetch(`${fallbackBase}${path}`, options);
}

export default function AdminYakusokuPage() {
  const [items, setItems] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalData, setModalData] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchYakusokuWithFallback('/yakusoku', { headers: authHeaders() });
      if (!res.ok) throw new Error(`Yakusoku HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.items || []);
    } catch (e) {
      console.error(e);
      window.alert('yakusokuの取得に失敗しました（権限または接続先を確認）');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    const run = async () => {
      try {
        const base = MASTER_API_BASE.replace(/\/$/, '');
        const res = await fetch(`${base}/master/service?limit=2000&jotai=yuko`, { headers: authHeaders(), cache: 'no-store' });
        if (!res.ok) throw new Error(`Service HTTP ${res.status}`);
        const data = await res.json();
        setServices(Array.isArray(data) ? data : (data?.items || []));
      } catch (e) {
        console.error('Failed to fetch services:', e);
        setServices([]);
      }
    };
    run();
  }, []);

  const openNew = () => {
    setModalData({
      isNew: true,
      type: 'teiki',
      tenpo_name: '',
      service_id: '',
      service_name: '',
      monthly_quota: 1,
      price: 0,
      start_date: dayjs().format('YYYY-MM-DD'),
      status: 'active',
      memo: '',
      recurrence_rule: { type: 'flexible' }
    });
  };

  const openEdit = (item) => {
    setModalData({ ...item, isNew: false });
  };

  const save = async () => {
    setSaving(true);
    try {
      const method = modalData.isNew ? 'POST' : 'PUT';
      const path = modalData.isNew ? '/yakusoku' : `/yakusoku/${modalData.yakusoku_id}`;
      const res = await fetchYakusokuWithFallback(path, {
        method,
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(modalData)
      });
      if (!res.ok) throw new Error('Failed to save');
      setModalData(null);
      fetchItems();
    } catch (e) {
      window.alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (id) => {
    if (!window.confirm('この案件を削除（論理削除）しますか？')) return;
    try {
      const res = await fetchYakusokuWithFallback(`/yakusoku/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) throw new Error(`Yakusoku DELETE HTTP ${res.status}`);
      fetchItems();
    } catch (e) {
      window.alert(e.message);
    }
  };

  return (
    <div className="admin-yotei-timeline-page">
      <div className="admin-yotei-timeline-content">
        <header className="yotei-head">
          <Link to="/admin/entrance" style={{ color: 'var(--muted)', textDecoration: 'none' }}>← 管理トップ</Link>
          <h1>実案件・定期管理 (yakusoku)</h1>
          <div className="yotei-head-actions">
            <button className="primary" onClick={openNew}>新規案件登録</button>
            <button onClick={fetchItems} disabled={loading}>{loading ? '...' : '更新'}</button>
          </div>
        </header>

        <div className="yakusoku-list" style={{ padding: '20px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', color: 'white' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #444' }}>
                <th style={{ padding: '10px' }}>ID</th>
                <th style={{ padding: '10px' }}>現場名</th>
                <th style={{ padding: '10px' }}>サービス</th>
                <th style={{ padding: '10px' }}>種別</th>
                <th style={{ padding: '10px' }}>月枠</th>
                <th style={{ padding: '10px' }}>当月消化</th>
                <th style={{ padding: '10px' }}>単価</th>
                <th style={{ padding: '10px' }}>状態</th>
                <th style={{ padding: '10px' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map(it => {
                const monthKey = dayjs().format('YYYY-MM');
                const consumed = it.consumption_count ? (it.consumption_count[monthKey] || 0) : 0;
                return (
                  <tr key={it.yakusoku_id} style={{ borderBottom: '1px solid #333' }}>
                    <td style={{ padding: '10px', fontSize: '12px', color: '#888' }}>{it.yakusoku_id}</td>
                    <td style={{ padding: '10px' }}>{it.tenpo_name || '---'}</td>
                    <td style={{ padding: '10px' }}>{it.service_name || it.service_id || '---'}</td>
                    <td style={{ padding: '10px' }}>{it.type === 'teiki' ? '定期' : '単発'}</td>
                    <td style={{ padding: '10px' }}>{it.monthly_quota || '-'}回</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ color: consumed >= (it.monthly_quota || 0) ? '#4caf50' : '#ff9800' }}>
                        {consumed}
                      </span>
                    </td>
                    <td style={{ padding: '10px' }}>¥{(it.price || 0).toLocaleString()}</td>
                    <td style={{ padding: '10px' }}>{it.status}</td>
                    <td style={{ padding: '10px' }}>
                      <button onClick={() => openEdit(it)}>編集</button>
                      <button className="danger" onClick={() => deleteItem(it.yakusoku_id)}>削除</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modalData && (
        <div className="yotei-modal-overlay" onClick={() => setModalData(null)}>
          <div className="yotei-modal" onClick={e => e.stopPropagation()}>
            <div className="yotei-modal-header">
              <h2>{modalData.isNew ? '新規案件登録' : '案件編集'}</h2>
              <button onClick={() => setModalData(null)} style={{ background: 'none', border: 'none', color: 'white', fontSize: 24 }}>×</button>
            </div>
            <div className="yotei-modal-content">
              <div className="yotei-form-group">
                <label>種別</label>
                <select value={modalData.type} onChange={e => setModalData({ ...modalData, type: e.target.value })}>
                  <option value="teiki">定期 (teiki)</option>
                  <option value="tanpatsu">単発 (tanpatsu)</option>
                </select>
              </div>
              <div className="yotei-form-group">
                <label>現場名</label>
                <input type="text" value={modalData.tenpo_name} onChange={e => setModalData({ ...modalData, tenpo_name: e.target.value })} />
              </div>
              <div className="yotei-form-group">
                <label>サービス</label>
                <select
                  value={modalData.service_id || ''}
                  onChange={e => {
                    const sid = e.target.value;
                    const svc = services.find((x) => x.service_id === sid);
                    setModalData({
                      ...modalData,
                      service_id: sid,
                      service_name: svc?.name || '',
                      price: modalData.isNew && Number(svc?.default_price || 0) > 0 ? Number(svc.default_price) : modalData.price,
                    });
                  }}
                >
                  <option value="">選択してください</option>
                  {services.map((s) => (
                    <option key={s.service_id} value={s.service_id}>
                      {s.name} ({s.category})
                    </option>
                  ))}
                </select>
              </div>
              <div className="yotei-form-group">
                <label>月間規定回数 (monthly_quota)</label>
                <input type="number" value={modalData.monthly_quota} onChange={e => setModalData({ ...modalData, monthly_quota: parseInt(e.target.value) })} />
              </div>
              <div className="yotei-form-group">
                <label>金額 (単価)</label>
                <input type="number" value={modalData.price} onChange={e => setModalData({ ...modalData, price: parseInt(e.target.value) })} />
              </div>
              <div className="yotei-form-group">
                <label>開始日</label>
                <input type="date" value={modalData.start_date} onChange={e => setModalData({ ...modalData, start_date: e.target.value })} />
              </div>
              <div className="yotei-form-group">
                <label>状態</label>
                <select value={modalData.status} onChange={e => setModalData({ ...modalData, status: e.target.value })}>
                  <option value="active">有効 (active)</option>
                  <option value="inactive">無効 (inactive)</option>
                </select>
              </div>
              <div className="yotei-form-group">
                <label>メモ</label>
                <textarea value={modalData.memo} onChange={e => setModalData({ ...modalData, memo: e.target.value })} rows={3} />
              </div>
            </div>
            <div className="yotei-modal-footer">
              <button onClick={() => setModalData(null)}>キャンセル</button>
              <button className="primary" onClick={save} disabled={saving}>{saving ? '保存中...' : '保存'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
