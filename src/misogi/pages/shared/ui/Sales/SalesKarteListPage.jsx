import React from 'react';
import Visualizer from '../Visualizer/Visualizer';
import { useFlashTransition } from '../ReportTransition/reportTransition';
import SalesCustomerListPanel from './SalesCustomerListPanel';
import './sales-customer-list.css';

export default function SalesKarteListPage() {
  const { startTransition } = useFlashTransition();

  return (
    <div className="report-page sales-karte-list-page" data-job="sales">
      <div className="report-page-viz">
        <Visualizer mode="base" className="report-page-visualizer" />
      </div>
      <div className="report-page-content sales-karte-list-content">
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
          <h1 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 600 }}>顧客カルテ</h1>
        </div>
        <SalesCustomerListPanel title="顧客カルテ" />
      </div>
    </div>
  );
}
