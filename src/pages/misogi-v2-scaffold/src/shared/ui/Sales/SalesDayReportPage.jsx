import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Visualizer from '../Visualizer/Visualizer';
import { useAuth } from '../../auth/useAuth';
import { putWorkReport, patchWorkReport, getWorkReportByDate, getUploadUrl } from './salesDayReportApi';
import './sales-day-report.css';

const TEMPLATE_DAY = 'SALES_DAY_V1';
const TEMPLATE_CASE = 'SALES_CASE_V1';
const MAX_ATTACHMENTS = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'pdf', 'xlsx', 'docx', 'heic'];

const TOUCH_TYPES = [
  { value: 'visit', label: '訪問' },
  { value: 'call', label: '電話' },
  { value: 'email', label: 'メール' },
  { value: 'other', label: 'その他' },
];

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function emptyHeader(workDate = '') {
  return {
    work_date: workDate || getToday(),
    total_minutes: 0,
    work_start_time: '',
    work_end_time: '',
    reporter_name: '',
    summary: '',
    issues: '',
    top_priority: '',
    attachments: [],
    saved: { log_id: null, version: null, state: null },
  };
}

function emptyCase() {
  return {
    store_key: '',
    store_name: '',
    touch_type: 'visit',
    summary: '',
    detail: '',
    next_due: '',
    next_title: '',
    pipeline_after: '',
    attachments: [],
    work_minutes: 0,
    saved: { log_id: null, version: null, state: null },
  };
}

function serializeHeader(header) {
  return {
    summary: header.summary || '',
    issues: header.issues || '',
    top_priority: header.top_priority || '',
    work_start_time: header.work_start_time || '',
    work_end_time: header.work_end_time || '',
    reporter_name: header.reporter_name || '',
    attachments: header.attachments || [],
  };
}

function deserializeHeader(descriptionJson, workReportItem) {
  let summary = '', issues = '', top_priority = '', work_start_time = '', work_end_time = '', reporter_name = '', attachments = [];
  try {
    const d = JSON.parse(descriptionJson || '{}');
    summary = d.summary || '';
    issues = d.issues || '';
    top_priority = d.top_priority || '';
    work_start_time = d.work_start_time || '';
    work_end_time = d.work_end_time || '';
    reporter_name = d.reporter_name || '';
    attachments = Array.isArray(d.attachments) ? d.attachments : [];
  } catch (_) {}
  return {
    work_date: workReportItem?.work_date || getToday(),
    total_minutes: workReportItem?.work_minutes || 0,
    work_start_time,
    work_end_time,
    reporter_name,
    summary,
    issues,
    top_priority,
    attachments,
    saved: {
      log_id: workReportItem?.log_id ?? null,
      version: workReportItem?.version ?? null,
      state: workReportItem?.state ?? null,
    },
  };
}

function serializeCase(c) {
  return {
    store_key: c.store_key || '',
    store_name: c.store_name || '',
    touch_type: c.touch_type || 'visit',
    summary: c.summary || '',
    detail: c.detail || '',
    next: { due: c.next_due || '', title: c.next_title || '' },
    pipeline_after: c.pipeline_after || '',
    attachments: c.attachments || [],
  };
}

function deserializeCase(descriptionJson, workReportItem) {
  let o = {};
  try {
    o = JSON.parse(descriptionJson || '{}');
  } catch (_) {}
  const next = o.next || {};
  return {
    store_key: o.store_key || '',
    store_name: o.store_name || workReportItem?.target_label || '',
    touch_type: o.touch_type || 'visit',
    summary: o.summary || '',
    detail: o.detail || '',
    next_due: next.due || '',
    next_title: next.title || '',
    pipeline_after: o.pipeline_after || '',
    attachments: Array.isArray(o.attachments) ? o.attachments : [],
    work_minutes: workReportItem?.work_minutes || 0,
    saved: {
      log_id: workReportItem?.log_id ?? null,
      version: workReportItem?.version ?? null,
      state: workReportItem?.state ?? null,
    },
  };
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function badgeSymbol(saved) {
  if (!saved?.log_id) return '⚪';
  if (saved.state === 'submitted') return '🟢';
  return '🟡';
}

export default function SalesDayReportPage() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const dateFromQuery = searchParams.get('date') || '';
  const workDate = dateFromQuery || getToday();

  const [header, setHeader] = useState(() => emptyHeader(workDate));
  const [cases, setCases] = useState([]);
  const [headerSaving, setHeaderSaving] = useState(false);
  const [headerSubmitting, setHeaderSubmitting] = useState(false);
  const [headerError, setHeaderError] = useState('');
  const [headerSubmitError, setHeaderSubmitError] = useState('');
  const [caseSaving, setCaseSaving] = useState({});
  const [caseErrors, setCaseErrors] = useState({});
  const [submitErrors, setSubmitErrors] = useState({});
  const [uploading, setUploading] = useState({ section: null, id: null });
  const [attachmentErrors, setAttachmentErrors] = useState({});
  const fileInputRefs = useRef({});

  const updateHeader = useCallback((next) => setHeader((h) => (typeof next === 'function' ? next(h) : { ...h, ...next })), []);
  const updateCase = useCallback((index, next) => {
    setCases((prev) => {
      const arr = [...prev];
      arr[index] = typeof next === 'function' ? next(arr[index]) : { ...arr[index], ...next };
      return arr;
    });
  }, []);

  const validateHeader = useCallback(() => {
    if (!header.work_date?.trim()) return '作業日は必須です';
    if (Number(header.total_minutes) <= 0) return '合計作業時間（分）を入力してください';
    return '';
  }, [header.work_date, header.total_minutes]);

  const validateCaseSubmit = useCallback((c) => {
    if (!c.store_name?.trim()) return '店舗名は必須です';
    if (!c.summary?.trim()) return '要約は必須です';
    if (!c.next_due?.trim() && !c.next_title?.trim()) return '次アクションの期限または内容のどちらかは必須です';
    return '';
  }, []);

  const validateAttachmentFile = useCallback((file, currentCount) => {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) return `「${file.name}」は許可されていない形式です`;
    if (file.size > MAX_FILE_SIZE) return `「${file.name}」は 10MB を超えています`;
    if (currentCount >= MAX_ATTACHMENTS) return `最大 ${MAX_ATTACHMENTS} 件までです`;
    return '';
  }, []);

  const uploadAttachment = useCallback(
    async (file, context, attachTo) => {
      const key = attachTo.section === 'header' ? 'header' : `case-${attachTo.id}`;
      setAttachmentErrors((prev) => ({ ...prev, [key]: null }));
      setUploading({ section: attachTo.section, id: attachTo.id });
      try {
        const { uploadUrl, fileUrl, key: s3Key } = await getUploadUrl({
          filename: file.name,
          mime: file.type || 'application/octet-stream',
          size: file.size,
          context,
          date: header.work_date || workDate,
          storeKey: attachTo.section === 'case' ? attachTo.storeKey : undefined,
        });
        const res = await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
        });
        if (!res.ok) throw new Error('アップロードに失敗しました');
        const item = { name: file.name, mime: file.type || 'application/octet-stream', size: file.size, url: fileUrl, key: s3Key, uploaded_at: new Date().toISOString() };
        if (attachTo.section === 'header') {
          updateHeader((h) => ({ ...h, attachments: [...(h.attachments || []), item] }));
        } else {
          updateCase(attachTo.id, (c) => ({ ...c, attachments: [...(c.attachments || []), item] }));
        }
      } catch (e) {
        setAttachmentErrors((prev) => ({ ...prev, [key]: e.message || 'アップロードに失敗しました' }));
      } finally {
        setUploading({ section: null, id: null });
      }
    },
    [header.work_date, workDate, updateHeader, updateCase]
  );

  const handleAttachmentSelect = useCallback(
    async (section, id, fileList, currentCount, storeKey) => {
      const files = Array.from(fileList || []);
      let err = '';
      for (let i = 0; i < files.length; i++) {
        err = validateAttachmentFile(files[i], currentCount + i);
        if (err) break;
      }
      if (!err && currentCount + files.length > MAX_ATTACHMENTS) err = `最大 ${MAX_ATTACHMENTS} 件までです`;
      const key = section === 'header' ? 'header' : `case-${id}`;
      if (err) {
        setAttachmentErrors((prev) => ({ ...prev, [key]: err }));
        return;
      }
      setAttachmentErrors((prev) => ({ ...prev, [key]: null }));
      const context = section === 'header' ? 'sales-day-attachment' : 'sales-case-attachment';
      for (const file of files) {
        await uploadAttachment(file, context, { section, id, storeKey });
      }
      const refEl = fileInputRefs.current[key];
      if (refEl) refEl.value = '';
    },
    [validateAttachmentFile, uploadAttachment]
  );

  const removeAttachment = useCallback(
    (section, id, attachIndex) => {
      const key = section === 'header' ? 'header' : `case-${id}`;
      setAttachmentErrors((prev) => ({ ...prev, [key]: null }));
      if (section === 'header') {
        updateHeader((h) => ({ ...h, attachments: (h.attachments || []).filter((_, i) => i !== attachIndex) }));
      } else {
        updateCase(id, (c) => ({ ...c, attachments: (c.attachments || []).filter((_, i) => i !== attachIndex) }));
      }
    },
    [updateHeader, updateCase]
  );

  const handleHeaderSave = useCallback(async () => {
    const err = validateHeader();
    setHeaderError(err);
    if (err) return;
    setHeaderSaving(true);
    try {
      const reporterName = user?.name || header.reporter_name || '';
      const body = {
        date: header.work_date,
        work_date: header.work_date,
        work_minutes: Number(header.total_minutes),
        template_id: TEMPLATE_DAY,
        state: 'draft',
        target_label: 'sales-day',
        description: JSON.stringify(serializeHeader({ ...header, reporter_name: reporterName })),
      };
      if (header.saved?.log_id) {
        body.log_id = header.saved.log_id;
        body.version = header.saved.version;
      }
      const res = await putWorkReport(body);
      setHeader((h) => ({ ...h, saved: { log_id: res.log_id, version: res.version, state: res.state } }));
      setHeaderError('');
    } catch (e) {
      setHeaderError(e.message || '保存に失敗しました');
    } finally {
      setHeaderSaving(false);
    }
  }, [header, user?.name, validateHeader]);

  const handleHeaderSubmit = useCallback(async () => {
    setHeaderSubmitError('');
    if (!header.saved?.log_id) {
      setHeaderSubmitError('先に「日次サマリを下書き保存」を実行してください');
      return;
    }
    if (header.saved?.state === 'submitted') {
      setHeaderSubmitError('すでに提出済みです');
      return;
    }
    setHeaderSubmitting(true);
    try {
      await patchWorkReport(header.saved.log_id, { state: 'submitted', version: header.saved.version });
      setHeader((h) => ({ ...h, saved: { ...h.saved, state: 'submitted', version: (h.saved?.version || 0) + 1 } }));
      setHeaderSubmitError('');
    } catch (e) {
      setHeaderSubmitError(e.message || '提出に失敗しました');
    } finally {
      setHeaderSubmitting(false);
    }
  }, [header.saved?.log_id, header.saved?.version, header.saved?.state]);

  const handleCaseSave = useCallback(
    async (index) => {
      const c = cases[index];
      setCaseErrors((prev) => ({ ...prev, [index]: null }));
      setCaseSaving((prev) => ({ ...prev, [index]: true }));
      try {
        const body = {
          date: header.work_date || workDate,
          work_date: header.work_date || workDate,
          work_minutes: Number(c.work_minutes) || 0,
          template_id: TEMPLATE_CASE,
          state: 'draft',
          target_label: c.store_name || `案件${index + 1}`,
          description: JSON.stringify(serializeCase(c)),
        };
        if (c.saved?.log_id) {
          body.log_id = c.saved.log_id;
          body.version = c.saved.version;
        }
        const res = await putWorkReport(body);
        updateCase(index, (prev) => ({ ...prev, saved: { log_id: res.log_id, version: res.version, state: res.state } }));
      } catch (e) {
        setCaseErrors((prev) => ({ ...prev, [index]: e.message || '保存に失敗しました' }));
      } finally {
        setCaseSaving((prev) => ({ ...prev, [index]: false }));
      }
    },
    [cases, header.work_date, workDate, updateCase]
  );

  const handleCaseSubmit = useCallback(
    async (index) => {
      const c = cases[index];
      const err = validateCaseSubmit(c);
      setSubmitErrors((prev) => ({ ...prev, [index]: err }));
      if (err) return;
      if (!c.saved?.log_id) {
        setSubmitErrors((prev) => ({ ...prev, [index]: '先に「この案件を下書き保存」を実行してください' }));
        return;
      }
      setCaseSaving((prev) => ({ ...prev, [index]: true }));
      try {
        await patchWorkReport(c.saved.log_id, { state: 'submitted', version: c.saved.version });
        updateCase(index, (prev) => ({ ...prev, saved: { ...prev.saved, state: 'submitted', version: (prev.saved?.version || 0) + 1 } }));
        setSubmitErrors((prev) => ({ ...prev, [index]: null }));
      } catch (e) {
        setSubmitErrors((prev) => ({ ...prev, [index]: e.message || '提出に失敗しました' }));
      } finally {
        setCaseSaving((prev) => ({ ...prev, [index]: false }));
      }
    },
    [cases, validateCaseSubmit, updateCase]
  );

  const addCase = useCallback(() => {
    setCases((prev) => [...prev, emptyCase()]);
  }, []);

  useEffect(() => {
    setHeader((h) => ({ ...h, work_date: workDate }));
  }, [workDate]);

  useEffect(() => {
    getWorkReportByDate(workDate)
      .then((items) => {
        if (!Array.isArray(items)) return;
        const dayItem = items.find((i) => i.template_id === TEMPLATE_DAY);
        const caseItems = items.filter((i) => i.template_id === TEMPLATE_CASE);
        if (dayItem) setHeader(deserializeHeader(dayItem.description, dayItem));
        setCases(caseItems.map((it) => deserializeCase(it.description, it)));
      })
      .catch(() => {});
  }, [workDate]);

  const isUploading = (section, id) => uploading.section === section && uploading.id === id;

  return (
    <div className="report-page sales-day-report-page" data-job="sales">
      <div className="report-page-viz">
        <Visualizer mode="base" className="report-page-visualizer" />
      </div>
      <div className="report-page-content sales-day-content">
        <h1 className="sales-day-report-title">業務報告</h1>
        <p className="report-page-back">
          <Link to="/portal">Portal に戻る</Link> / <Link to="/jobs/sales/entrance">営業入口</Link>
        </p>

        {/* 報告者（証跡） */}
        <section className="sales-day-reporter" aria-label="報告者">
          {user?.name ? (
            <p className="sales-day-reporter-label">報告者：<span className="sales-day-reporter-name">{user.name}</span></p>
          ) : (
            <div className="sales-day-field">
              <label htmlFor="sales-day-reporter-name">報告者名（証跡のため表示・保存されます）</label>
              <input
                id="sales-day-reporter-name"
                type="text"
                value={header.reporter_name || ''}
                onChange={(e) => updateHeader({ reporter_name: e.target.value })}
                placeholder="氏名を入力"
              />
            </div>
          )}
        </section>

        {/* 日次サマリ */}
        <section className="sales-day-report-card sales-day-header">
          <h2>日次サマリ</h2>
          <div className="sales-day-fields">
            <div className="sales-day-field">
              <label>作業日（必須）</label>
              <input
                type="date"
                value={header.work_date}
                onChange={(e) => updateHeader({ work_date: e.target.value })}
              />
            </div>
            <div className="sales-day-field">
              <label>合計作業時間（分）（必須）</label>
              <input
                type="number"
                min={0}
                value={header.total_minutes || ''}
                onChange={(e) => updateHeader({ total_minutes: e.target.value })}
              />
            </div>
            <div className="sales-day-field">
              <label>業務開始時間（任意）</label>
              <input
                type="time"
                value={header.work_start_time || ''}
                onChange={(e) => updateHeader({ work_start_time: e.target.value })}
              />
            </div>
            <div className="sales-day-field">
              <label>業務終了時間（任意）</label>
              <input
                type="time"
                value={header.work_end_time || ''}
                onChange={(e) => updateHeader({ work_end_time: e.target.value })}
              />
            </div>
            <div className="sales-day-field">
              <label>本日の成果（summary）</label>
              <textarea value={header.summary} onChange={(e) => updateHeader({ summary: e.target.value })} rows={2} />
            </div>
            <div className="sales-day-field">
              <label>課題（issues）</label>
              <textarea value={header.issues} onChange={(e) => updateHeader({ issues: e.target.value })} rows={2} />
            </div>
            <div className="sales-day-field">
              <label>明日の最優先（top_priority）</label>
              <input type="text" value={header.top_priority} onChange={(e) => updateHeader({ top_priority: e.target.value })} />
            </div>
          </div>
          <div className="sales-day-attachments">
            <h3>補助資料添付（日次）</h3>
            <input
              ref={(el) => { fileInputRefs.current.header = el; }}
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.pdf,.xlsx,.docx,.heic"
              className="sales-day-file-input"
              onChange={(e) => handleAttachmentSelect('header', 0, e.target.files, header.attachments?.length || 0, null)}
            />
            <button
              type="button"
              className="btn btn-sm"
              disabled={isUploading('header', 0) || (header.attachments?.length || 0) >= MAX_ATTACHMENTS}
              onClick={() => fileInputRefs.current.header?.click()}
            >
              {isUploading('header', 0) ? 'アップロード中...' : 'ファイルを追加'}
            </button>
            <p className="sales-day-attachments-hint">最大 {MAX_ATTACHMENTS} 件・1ファイル 10MB まで</p>
            {(header.attachments?.length || 0) > 0 && (
              <ul className="sales-day-attachment-list">
                {(header.attachments || []).map((att, ai) => (
                  <li key={ai} className="sales-day-attachment-row">
                    <span className="sales-day-attachment-name" title={att.name}>{att.name}</span>
                    <span className="sales-day-attachment-size">{formatFileSize(att.size)}</span>
                    {att.url && <a href={att.url} target="_blank" rel="noopener noreferrer" className="sales-day-attachment-open">開く</a>}
                    <button type="button" className="sales-day-attachment-remove" onClick={() => removeAttachment('header', 0, ai)} title="削除">×</button>
                  </li>
                ))}
              </ul>
            )}
            {attachmentErrors.header && <p className="sales-day-error">{attachmentErrors.header}</p>}
          </div>
          <div className="sales-day-actions">
            <button type="button" className="btn" onClick={handleHeaderSave} disabled={headerSaving}>
              {headerSaving ? '保存中...' : '日次サマリを下書き保存'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleHeaderSubmit}
              disabled={headerSubmitting || header.saved?.state === 'submitted'}
            >
              {headerSubmitting ? '提出中...' : '提出する'}
            </button>
          </div>
          {headerError && <p className="sales-day-error">{headerError}</p>}
          {headerSubmitError && <p className="sales-day-error">{headerSubmitError}</p>}
        </section>

        {/* 案件カード */}
        <section className="sales-day-report-card sales-day-cases">
          <h2>案件カード</h2>
          <button type="button" className="btn btn-sm" onClick={addCase}>+ 案件を追加</button>
          <div className="sales-day-case-list">
            {cases.map((c, index) => (
              <div key={index} className="sales-day-case-card">
                <span className="sales-day-case-badge" title={!c.saved?.log_id ? '未保存' : c.saved.state === 'submitted' ? '提出済' : '下書き'}>
                  {badgeSymbol(c.saved)}
                </span>
                <div className="sales-day-fields">
                  <div className="sales-day-field">
                    <label>店舗名（必須）</label>
                    <input type="text" value={c.store_name} onChange={(e) => updateCase(index, { store_name: e.target.value })} />
                  </div>
                  <div className="sales-day-field">
                    <label>store_key（任意）</label>
                    <input type="text" value={c.store_key} onChange={(e) => updateCase(index, { store_key: e.target.value })} placeholder="空でも可" />
                  </div>
                  <div className="sales-day-field">
                    <label>接触種別</label>
                    <select value={c.touch_type} onChange={(e) => updateCase(index, { touch_type: e.target.value })}>
                      {TOUCH_TYPES.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sales-day-field">
                    <label>要約（必須）</label>
                    <input type="text" value={c.summary} onChange={(e) => updateCase(index, { summary: e.target.value })} />
                  </div>
                  <div className="sales-day-field">
                    <label>詳細（任意）</label>
                    <textarea value={c.detail} onChange={(e) => updateCase(index, { detail: e.target.value })} rows={2} />
                  </div>
                  <div className="sales-day-field row">
                    <label>次アクション</label>
                    <input type="date" placeholder="期限" value={c.next_due} onChange={(e) => updateCase(index, { next_due: e.target.value })} />
                    <input type="text" placeholder="内容" value={c.next_title} onChange={(e) => updateCase(index, { next_title: e.target.value })} />
                  </div>
                  <div className="sales-day-field">
                    <label>pipeline_after（任意）</label>
                    <input type="text" value={c.pipeline_after} onChange={(e) => updateCase(index, { pipeline_after: e.target.value })} />
                  </div>
                  <div className="sales-day-field">
                    <label>作業時間（分）（任意）</label>
                    <input type="number" min={0} value={c.work_minutes || ''} onChange={(e) => updateCase(index, { work_minutes: e.target.value })} />
                  </div>
                </div>
                <div className="sales-day-attachments">
                  <h3>補助資料添付（案件）</h3>
                  <input
                    ref={(el) => { fileInputRefs.current[`case-${index}`] = el; }}
                    type="file"
                    multiple
                    accept=".jpg,.jpeg,.png,.pdf,.xlsx,.docx,.heic"
                    className="sales-day-file-input"
                    onChange={(e) => handleAttachmentSelect('case', index, e.target.files, c.attachments?.length || 0, c.store_key)}
                  />
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={isUploading('case', index) || (c.attachments?.length || 0) >= MAX_ATTACHMENTS}
                    onClick={() => fileInputRefs.current[`case-${index}`]?.click()}
                  >
                    {isUploading('case', index) ? 'アップロード中...' : 'ファイルを追加'}
                  </button>
                  {(c.attachments?.length || 0) > 0 && (
                    <ul className="sales-day-attachment-list small">
                      {(c.attachments || []).map((att, ai) => (
                        <li key={ai} className="sales-day-attachment-row">
                          <span className="sales-day-attachment-name" title={att.name}>{att.name}</span>
                          {att.url && <a href={att.url} target="_blank" rel="noopener noreferrer">開く</a>}
                          <button type="button" className="sales-day-attachment-remove" onClick={() => removeAttachment('case', index, ai)}>×</button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {attachmentErrors[`case-${index}`] && <p className="sales-day-error">{attachmentErrors[`case-${index}`]}</p>}
                </div>
                <div className="sales-day-actions">
                  <button type="button" className="btn" onClick={() => handleCaseSave(index)} disabled={caseSaving[index]}>
                    {caseSaving[index] ? '保存中...' : 'この案件を下書き保存'}
                  </button>
                  <button type="button" className="btn btn-primary" onClick={() => handleCaseSubmit(index)} disabled={caseSaving[index]}>
                    この案件を提出
                  </button>
                </div>
                {caseErrors[index] && <p className="sales-day-error">{caseErrors[index]}</p>}
                {submitErrors[index] && <p className="sales-day-error">{submitErrors[index]}</p>}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
