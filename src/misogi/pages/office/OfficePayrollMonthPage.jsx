import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getAdminPayrollMonth } from '../shared/api/adminWorkReportsApi';
import '../shared/styles/components.css';

/**
 * 経理用・ユーザー×年月の月次ビュー
 * /office/payroll/:user_id/:YYYY-MM
 * デフォルトは支払対象（approved）のみ。state=all で全件表示。
 */
export default function OfficePayrollMonthPage() {
  const { userId, yyyyMm } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [stateFilter, setStateFilter] = useState('approved');

  const fetchData = useCallback(async () => {
    if (!userId || !yyyyMm) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminPayrollMonth(userId, yyyyMm, { state: stateFilter });
      setData(res);
    } catch (e) {
      setError(e?.message || '取得に失敗しました');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [userId, yyyyMm, stateFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!userId || !yyyyMm) {
    return (
      <div className="report-page" data-job="office" style={{ padding: 24 }}>
        <p>URLが不正です。user_id と YYYY-MM が必要です。</p>
        <Link to="/admin/houkoku">報告一覧へ</Link>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="report-page" data-job="office" style={{ padding: 24 }}>
        <p>読み込み中...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="report-page" data-job="office" style={{ padding: 24 }}>
        <h1 style={{ fontSize: '1.25rem', marginBottom: 16 }}>経理・月次ビュー</h1>
        <p style={{ color: 'var(--alert)' }}>{error}</p>
        <Link to="/admin/houkoku">報告一覧へ</Link>
      </div>
    );
  }

  const totalMinutes = data?.total_minutes ?? 0;
  const totalAmount = data?.total_amount;
  const rows = data?.rows ?? [];

  return (
    <div className="report-page" data-job="office" style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <p style={{ marginBottom: 16 }}>
        <Link to="/admin/houkoku" style={{ color: 'var(--job-office)' }}>← 報告一覧</Link>
      </p>
      <h1 style={{ fontSize: '1.25rem', marginBottom: 8 }}>経理・月次ビュー</h1>
      <p style={{ fontSize: '0.9rem', color: 'var(--muted)', marginBottom: 24 }}>
        user_id: {userId} · {yyyyMm}
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>表示:</span>
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            style={{ padding: '8px 12px', background: 'var(--surface)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'var(--fg)' }}
          >
            <option value="approved">支払対象（approved）のみ</option>
            <option value="all">全件</option>
          </select>
        </label>
      </div>

      <section style={{ background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <h2 style={{ fontSize: '1rem', margin: '0 0 12px', color: 'var(--muted)' }}>月次サマリ</h2>
        <dl style={{ margin: 0, display: 'grid', gap: '8px 16px', gridTemplateColumns: 'auto 1fr' }}>
          <dt style={{ margin: 0, color: 'var(--muted)' }}>合計稼働（分）</dt>
          <dd style={{ margin: 0 }}>{totalMinutes} 分</dd>
          {totalAmount != null && (
            <>
              <dt style={{ margin: 0, color: 'var(--muted)' }}>合計支払額</dt>
              <dd style={{ margin: 0 }}>{totalAmount}</dd>
            </>
          )}
        </dl>
      </section>

      <section style={{ background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 20 }}>
        <h2 style={{ fontSize: '1rem', margin: '0 0 12px', color: 'var(--muted)' }}>明細</h2>
        {rows.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>該当する報告はありません。</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--muted)' }}>日付</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--muted)' }}>種別</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', color: 'var(--muted)' }}>分</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--muted)' }}>状態</th>
                <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--muted)' }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.report_id || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <td style={{ padding: '8px 12px' }}>{row.date || '—'}</td>
                  <td style={{ padding: '8px 12px' }}>{row.template_id || '—'}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>{row.minutes ?? '—'}</td>
                  <td style={{ padding: '8px 12px' }}>{row.state || '—'}</td>
                  <td style={{ padding: '8px 12px' }}>
                    {row.report_id && (
                      <Link to={`/office/work-reports/${row.report_id}`} style={{ color: 'var(--job-office)' }}>
                        詳細
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
