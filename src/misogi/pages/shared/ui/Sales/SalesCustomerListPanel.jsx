import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './sales-customer-list.css';

const API_BASE = (() => {
  if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
    return '/api';
  }
  return import.meta.env?.VITE_API_BASE || '/api';
})();

const PIPELINE_LABELS = {
  new: '新規',
  contacted: '接触済',
  qualified: '要件確認済',
  proposal: '提案中',
  estimate: '見積中',
  won: '受注',
  lost: '失注',
};

export default function SalesCustomerListPanel({ title = '顧客一覧' }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);

  const headers = useCallback(
    () => ({
      Authorization: `Bearer ${localStorage.getItem('cognito_id_token') || (JSON.parse(localStorage.getItem('misesapo_auth') || '{}').token)}`,
      'Content-Type': 'application/json',
    }),
    []
  );

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/stores`, { headers: headers() })
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (!cancelled) {
          const items = Array.isArray(data) ? data : (data.items || []);
          setStores(items);
          setLoading(false);
        }
      })
      .catch(err => {
        console.error('[SalesCustomerListPanel] fetch error:', err);
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [headers]);

  const filtered = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    if (!q) return stores;
    return stores.filter(
      (s) =>
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.brand_name && s.brand_name.toLowerCase().includes(q)) ||
        (s.client_name && s.client_name.toLowerCase().includes(q)) ||
        (s.company_name && s.company_name.toLowerCase().includes(q))
    );
  }, [search, stores]);

  const goToKarte = (storeId) => {
    navigate(`/sales/store/${encodeURIComponent(storeId)}`);
  };

  if (loading) {
    return <p className="sales-customer-list-loading">読み込み中...</p>;
  }

  return (
    <div className="sales-customer-list-panel">
      <h2 className="sales-customer-list-title">{title}</h2>
      <div className="sales-customer-list-search">
        <input
          type="search"
          placeholder="店舗名・ブランド名・会社名で検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sales-customer-list-search-input"
        />
      </div>
      <div className="sales-customer-list-cards">
        {filtered.length === 0 ? (
          <p className="sales-customer-list-empty">該当する顧客がありません</p>
        ) : (
          filtered.map((s) => (
            <button
              key={s.id}
              type="button"
              className="sales-customer-list-card"
              onClick={() => goToKarte(s.id)}
            >
              <span className="sales-customer-list-card-store">{s.name}</span>
              <span className="sales-customer-list-card-company">{s.brand_name || s.client_name || s.company_name}</span>
              <span className="sales-customer-list-card-meta">
                <span>{s.address1} {s.address2}</span>
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
