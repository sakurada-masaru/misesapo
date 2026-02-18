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
  if (templateId.startsWith('OFFICE') || templateId.includes('OFFICE')) return '事務';
  return 'その他';
}

const TOUCH_LABELS = { visit: '訪問', call: '電話', email: 'メール', other: 'その他' };
const OFFICE_WORK_ITEM_LABELS = {
  inquiry: '問合せ対応',
  schedule: '日程調整',
  billing: '請求処理',
  payment: '入金確認',
  order: '発注/手配',
  doc: '書類作成',
  master_update: 'マスタ更新',
  other: 'その他(分類)',
};
const OFFICE_EXCEPTION_LABELS = {
  blocked: '詰まり',
  return_required: '差し戻し',
  urgent: '至急',
  unconfirmed: '未確認',
};

function parseKadaiIds(value) {
  const list = String(value || '')
    .split(/[,\s]+/)
    .map((v) => String(v || '').trim())
    .filter(Boolean)
    .map((v) => (/^kadai#/i.test(v) ? `KADAI#${v.slice(6)}` : v))
    .filter((v) => /^KADAI#/i.test(v));
  return Array.from(new Set(list));
}

function formatMinutes(totalMin) {
  const m = Math.max(0, Number(totalMin) || 0);
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  if (hh <= 0) return `${mm}分`;
  if (mm <= 0) return `${hh}時間`;
  return `${hh}時間${mm}分`;
}

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
        {!embed && <p><Link to="/admin/houkoku">報告一覧へ</Link></p>}
      </div>
    );
  }

  const desc = safeJsonParse(report.description);
  const attachments = collectAttachmentUrls(report);
  const isDay = report.template_id === 'SALES_DAY_V1';
  const isCase = report.template_id === 'SALES_CASE_V1';
  const isOffice = String(report.template_id || '').startsWith('OFFICE_');

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={`report-page office-work-report-detail ${embed ? 'embed' : ''}`} data-job="office" style={{ padding: 24, maxWidth: 720, margin: '0 auto' }}>
      {!embed && (
        <>
          <div className="office-work-report-detail-actions no-print">
            <p style={{ margin: 0 }}>
              <Link to="/admin/houkoku" style={{ color: 'var(--job-office)' }}>← 報告一覧</Link>
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

      {isOffice && (
        <section style={{ background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <h2 style={{ fontSize: '1rem', margin: '0 0 12px', color: 'var(--muted)' }}>事務報告</h2>
          <dl style={{ margin: 0, display: 'grid', gap: '8px 16px', gridTemplateColumns: 'auto 1fr' }}>
            {(desc.user_name || report.user_name) && (
              <>
                <dt style={{ margin: 0, color: 'var(--muted)' }}>提出者</dt>
                <dd style={{ margin: 0 }}>{desc.user_name || report.user_name}</dd>
              </>
            )}
            {(Array.isArray(desc.work_sessions) && desc.work_sessions.length > 0) ? (
              <>
                <dt style={{ margin: 0, color: 'var(--muted)' }}>業務時間</dt>
                <dd style={{ margin: 0 }}>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {desc.work_sessions.map((s, i) => (
                      <div key={i}>{String(s?.start || '—')} ～ {String(s?.end || '—')}</div>
                    ))}
                    {desc.total_minutes != null && Number(desc.total_minutes) >= 0 && (
                      <div style={{ marginTop: 6, fontWeight: 700 }}>総時間: {formatMinutes(desc.total_minutes)}</div>
                    )}
                  </div>
                </dd>
              </>
            ) : ((desc.work_start_time || desc.work_end_time) && (
              <>
                <dt style={{ margin: 0, color: 'var(--muted)' }}>業務時間</dt>
                <dd style={{ margin: 0 }}>{desc.work_start_time || '—'} ～ {desc.work_end_time || '—'}</dd>
              </>
            ))}
            {Array.isArray(desc.work_items) && desc.work_items.length > 0 && (
              <>
                <dt style={{ margin: 0, color: 'var(--muted)' }}>実施項目</dt>
                <dd style={{ margin: 0 }}>
                  {desc.work_items.map((c) => OFFICE_WORK_ITEM_LABELS[c] || c).join(' / ')}
                </dd>
              </>
            )}
            {String(desc.related_kadai_ids || '').trim() && (
              <>
                <dt style={{ margin: 0, color: 'var(--muted)' }}>関連課題</dt>
                <dd style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                  {parseKadaiIds(desc.related_kadai_ids).length
                    ? parseKadaiIds(desc.related_kadai_ids).join(', ')
                    : String(desc.related_kadai_ids || '').trim()}
                </dd>
              </>
            )}
            {desc.counts && typeof desc.counts === 'object' && (
              <>
                <dt style={{ margin: 0, color: 'var(--muted)' }}>件数</dt>
                <dd style={{ margin: 0 }}>
                  {Object.entries(desc.counts)
                    .filter(([, v]) => Number(v) > 0)
                    .map(([k, v]) => `${k}:${v}`)
                    .join(' / ') || '—'}
                </dd>
              </>
            )}
            {Array.isArray(desc.exception_flags) && desc.exception_flags.length > 0 && (
              <>
                <dt style={{ margin: 0, color: 'var(--muted)' }}>例外</dt>
                <dd style={{ margin: 0 }}>
                  {desc.exception_flags.map((c) => OFFICE_EXCEPTION_LABELS[c] || c).join(' / ')}
                </dd>
              </>
            )}
            {desc.exception_note && (
              <>
                <dt style={{ margin: 0, color: 'var(--muted)' }}>例外メモ</dt>
                <dd style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{String(desc.exception_note)}</dd>
              </>
            )}
          </dl>
        </section>
      )}

      {!isDay && !isCase && !isOffice && Object.keys(desc).length > 0 && (
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
