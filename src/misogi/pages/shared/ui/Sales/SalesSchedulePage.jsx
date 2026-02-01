import React from 'react';
import { useFlashTransition } from '../ReportTransition/reportTransition';
import Visualizer from '../Visualizer/Visualizer';
import '../../styles/components.css';

/**
 * スケジュールページ (スマホ特化レイアウト)
 */
export default function SalesSchedulePage() {
    const { startTransition } = useFlashTransition();

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
                    <h1 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 600 }}>スケジュール</h1>
                </div>

                {/* プレースホルダー */}
                <div style={{
                    textAlign: 'center',
                    padding: '60px 20px',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.05)'
                }}>
                    <p style={{ fontSize: '3rem', marginBottom: '16px' }}>📅</p>
                    <p style={{ opacity: 0.6, fontSize: '0.9rem' }}>スケジュール機能は準備中です</p>
                </div>

                <p style={{ textAlign: 'center', marginTop: '40px', paddingBottom: '40px' }}>
                    <a
                        href="#"
                        onClick={(e) => { e.preventDefault(); startTransition('/jobs/sales/entrance'); }}
                        style={{ color: 'var(--job-sales)', fontSize: '0.85rem', textDecoration: 'none', opacity: 0.6 }}
                    >
                        エントランスへ戻る
                    </a>
                </p>
            </div>
        </div>
    );
}
