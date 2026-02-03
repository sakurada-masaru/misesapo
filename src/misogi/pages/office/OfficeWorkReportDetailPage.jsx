import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getAdminWorkReportDetail } from '../shared/api/adminWorkReportsApi';
import '../shared/styles/components.css';
import './office-work-report-detail.css';

function safeJsonParse(val) {
  if (val == null) return {};
  if (typeof val === 'object' && val !== null) return val;
  if (typeof val !== 'string') return {};
  try {
    const parsed = JSON.parse(val);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function collectAttachmentUrls(item) {
  const urls = [];
  const desc = safeJsonParse(item?.description);
  const push = (arr) => {
    if (!Array.isArray(arr)) return;
    arr.forEach((a) => {
      if (a?.url) urls.push({ name: a.name || a.key || '添付', url: a.url });
    });
  };
  push(desc.attachments);
  push(desc.store?.attachments);
  push(desc.header?.attachments);
  return urls;
}

function templateLabel(templateId) {
  if (!templateId) return '—';
  if (templateId.startsWith('SALES') || templateId.includes('SALES')) return '営業';
  if (templateId.startsWith('CLEANING') || templateId.includes('CLEANING')) return '清掃';
  return 'その他';
}

const TOUCH_LABELS = { visit: '訪問', call: '電話', email: 'メール', other: 'その他' };

/**
 * 業務報告の詳細ページ（社内・認証必須）
 * /office/work-reports/:reportId または props で reportId + embed 指定で埋め込み
 */
export default function OfficeWorkReportDetailPage({ reportId: propReportId, embed = false }) {
  const params = useParams();
  const reportId = propReportId ?? params.reportId;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [report, setReport] = useState(null);

  useEffect(() => {
    if (!reportId) {
      setError('URLが不正です');
      setLoading(false);
      return;
    }
    getAdminWorkReportDetail(reportId)
      .then((data) => {
        setReport(data);
        setError(null);
      })
      .catch((e) => {
        setError(e?.message || '報告が見つかりません');
        setReport(null);
      })
      .finally(() => setLoading(false));
  }, [reportId]);

  if (loading) {
    return (
      <div className={`report-page office-work-report-detail ${embed ? 'embed' : ''}`} data-job="office" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <p>読み込み中...</p>
      </div>
    );
  }
  if (error || !report) {
    return (
      <div className={`report-page office-work-report-detail ${embed ? 'embed' : ''}`} data-job="office" style={{ padding: 24, maxWidth: 560, margin: '0 auto' }}>
        {!embed && <h1 style={{ fontSize: '1.25rem', marginBottom: 16 }}>業務報告の閲覧</h1>}
        <p style={{ color: 'var(--alert, #ff3030)' }}>{error}</p>
        {!embed && <p><Link to="/admin/work-reports">業務報告（管理）一覧へ</Link></p>}
      </div>
    );
  }

  const desc = safeJsonParse(report.description);
  const attachments = collectAttachmentUrls(report);
  const isDay = report.template_id === 'SALES_DAY_V1';
  const isCase = report.template_id === 'SALES_CASE_V1';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={`report-page office-work-report-detail ${embed ? 'embed' : ''}`} data-job="office" style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      {!embed && (
        <>
          <div className="office-work-report-detail-actions no-print">
            <p style={{ margin: 0 }}>
              <Link to="/admin/work-reports" style={{ color: 'var(--job-office)' }}>← 業務報告（管理）一覧</Link>
            </p>
            <button type="button" className="btn btn-print" onClick={handlePrint} aria-label="印刷またはPDFで保存">
              印刷／PDFで保存
            </button>
          </div>
          <h1 className="report-print-title" style={{ fontSize: '1.25rem', marginBottom: 8 }}>業務報告（閲覧）</h1>
          <p className="report-print-meta" style={{ fontSize: '0.9rem', color: 'var(--muted)', marginBottom: 24 }}>
            {templateLabel(report.template_id)} · {report.work_date || '—'} · {report.state || '—'}
          </p>
        </>
      )}

      <section style={{ background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
        <h2 style={{ fontSize: '1rem', margin: '0 0 12px', color: 'var(--muted)' }}>基本情報</h2>
        <dl style={{ margin: 0, display: 'grid', gap: '8px 16px', gridTemplateColumns: 'auto 1fr' }}>
          <dt style={{ margin: 0, color: 'var(--muted)' }}>報告日</dt>
          <dd style={{ margin: 0 }}>{report.work_date || '—'}</dd>
          <dt style={{ margin: 0, color: 'var(--muted)' }}>種別</dt>
          <dd style={{ margin: 0 }}>{templateLabel(report.template_id)}</dd>
          {report.target_label && (
            <>
              <dt style={{ margin: 0, color: 'var(--muted)' }}>店舗・対象</dt>
              <dd style={{ margin: 0 }}>{report.target_label}</dd>
            </>
          )}
          {report.work_minutes != null && report.work_minutes > 0 && (
            <>
              <dt style={{ margin: 0, color: 'var(--muted)' }}>作業時間</dt>
              <dd style={{ margin: 0 }}>{report.work_minutes}分</dd>
            </>
          )}
        </dl>
      </section>

      {isDay && (
        <section style={{ background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <h2 style={{ fontSize: '1rem', margin: '0 0 12px', color: 'var(--muted)' }}>日次サマリ</h2>
          <dl style={{ margin: 0, display: 'grid', gap: '8px 16px', gridTemplateColumns: 'auto 1fr' }}>
            {desc.reporter_name && (
              <>
                <dt style={{ margin: 0, color: 'var(--muted)' }}>報告者</dt>
                <dd style={{ margin: 0 }}>{desc.reporter_name}</dd>
              </>
            )}
            {(desc.work_start_time || desc.work_end_time) && (
              <>
                <dt style={{ margin: 0, color: 'var(--muted)' }}>勤務時間</dt>
                <dd style={{ margin: 0 }}>{desc.work_start_time || '—'} ～ {desc.work_end_time || '—'}</dd>
              </>
            )}
            {desc.summary && (
              <>
                <dt style={{ margin: 0, color: 'var(--muted)' }}>要約</dt>
                <dd style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{desc.summary}</dd>
              </>
            )}
            {desc.issues && (
              <>
                <dt style={{ margin: 0, color: 'var(--muted)' }}>課題</dt>
                <dd style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{desc.issues}</dd>
              </>
            )}
            {desc.top_priority && (
              <>
                <dt style={{ margin: 0, color: 'var(--muted)' }}>最優先</dt>
                <dd style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{desc.top_priority}</dd>
              </>
            )}
          </dl>
        </section>
      )}

      {isCase && (
        <section style={{ background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <h2 style={{ fontSize: '1rem', margin: '0 0 12px', color: 'var(--muted)' }}>案件内容</h2>
          <dl style={{ margin: 0, display: 'grid', gap: '8px 16px', gridTemplateColumns: 'auto 1fr' }}>
            {desc.store_name && (
              <>
                <dt style={{ margin: 0, color: 'var(--muted)' }}>店舗名</dt>
                <dd style={{ margin: 0 }}>{desc.store_name}</dd>
              </>
            )}
            {desc.touch_type && (
              <>
                <dt style={{ margin: 0, color: 'var(--muted)' }}>接触種別</dt>
                <dd style={{ margin: 0 }}>{TOUCH_LABELS[desc.touch_type] || desc.touch_type}</dd>
              </>
            )}
            {desc.summary && (
              <>
                <dt style={{ margin: 0, color: 'var(--muted)' }}>要約</dt>
                <dd style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{desc.summary}</dd>
              </>
            )}
            {desc.detail && (
              <>
                <dt style={{ margin: 0, color: 'var(--muted)' }}>詳細</dt>
                <dd style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{desc.detail}</dd>
              </>
            )}
            {(desc.next?.due || desc.next?.title) && (
              <>
                <dt style={{ margin: 0, color: 'var(--muted)' }}>次アクション</dt>
                <dd style={{ margin: 0 }}>{desc.next?.due || ''} {desc.next?.title || ''}</dd>
              </>
            )}
            {desc.pipeline_after && (
              <>
                <dt style={{ margin: 0, color: 'var(--muted)' }}>pipeline_after</dt>
                <dd style={{ margin: 0 }}>{desc.pipeline_after}</dd>
              </>
            )}
          </dl>
        </section>
      )}

      {!isDay && !isCase && Object.keys(desc).length > 0 && (
        <section style={{ background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <h2 style={{ fontSize: '1rem', margin: '0 0 12px', color: 'var(--muted)' }}>内容</h2>
          <pre style={{ margin: 0, fontSize: '0.85rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {JSON.stringify(desc, null, 2)}
          </pre>
        </section>
      )}

      {attachments.length > 0 && (
        <section style={{ background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 20 }}>
          <h2 style={{ fontSize: '1rem', margin: '0 0 12px', color: 'var(--muted)' }}>添付資料</h2>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {attachments.map((a, i) => (
              <li key={i}>
                <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--job-office)' }}>
                  {a.name}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
