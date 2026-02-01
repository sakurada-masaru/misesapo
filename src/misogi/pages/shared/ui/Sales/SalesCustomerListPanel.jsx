import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import './sales-customer-list.css';

const MOCK_CUSTOMERS = [
  { key: 'seven_shinjuku', company: 'セブン&アイ', store: 'セブンイレブン新宿店', pipeline: 'qualified', next_action: '2026-02-02', last_contact: '2026-01-31', sales_rep: '正田和輝' },
  { key: 'seven_shibuya', company: 'セブン&アイ', store: 'セブンイレブン渋谷店', pipeline: 'proposal', next_action: '2026-02-03', last_contact: '2026-01-28', sales_rep: '山田太郎' },
  { key: 'lawson_ikebukuro', company: 'ローソン', store: 'ローソン池袋東口店', pipeline: 'contacted', next_action: '', last_contact: '2026-01-25', sales_rep: '正田和輝' },
  { key: 'family_shinjuku', company: 'ファミリーマート', store: 'ファミマ新宿三丁目店', pipeline: 'new', next_action: '2026-02-05', last_contact: '', sales_rep: '佐藤花子' },
];

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

  const filtered = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    if (!q) return MOCK_CUSTOMERS;
    return MOCK_CUSTOMERS.filter(
      (c) =>
        (c.company && c.company.toLowerCase().includes(q)) ||
        (c.store && c.store.toLowerCase().includes(q)) ||
        (c.sales_rep && c.sales_rep.toLowerCase().includes(q))
    );
  }, [search]);

  const goToKarte = (storeKey) => {
    navigate(`/sales/store/${encodeURIComponent(storeKey)}`);
  };

  return (
    <div className="sales-customer-list-panel">
      <h2 className="sales-customer-list-title">{title}</h2>
      <div className="sales-customer-list-search">
        <input
          type="search"
          placeholder="会社名・店舗名・営業担当者で検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sales-customer-list-search-input"
        />
      </div>
      <div className="sales-customer-list-cards">
        {filtered.length === 0 ? (
          <p className="sales-customer-list-empty">該当する顧客がありません</p>
        ) : (
          filtered.map((c) => (
            <button
              key={c.key}
              type="button"
              className="sales-customer-list-card"
              onClick={() => goToKarte(c.key)}
            >
              <span className="sales-customer-list-card-store">{c.store}</span>
              <span className="sales-customer-list-card-company">{c.company}</span>
              <span className={`sales-customer-list-badge pipeline-${c.pipeline}`} data-pipeline={c.pipeline}>
                {PIPELINE_LABELS[c.pipeline] ?? c.pipeline}
              </span>
              {c.sales_rep && (
                <span className="sales-customer-list-card-sales-rep">営業: {c.sales_rep}</span>
              )}
              {(c.next_action || c.last_contact) && (
                <span className="sales-customer-list-card-meta">
                  {c.next_action && <span>次: {c.next_action}</span>}
                  {c.last_contact && <span>最終: {c.last_contact}</span>}
                </span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
