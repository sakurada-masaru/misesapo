import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useFlashTransition } from '../../../shared/ui/ReportTransition/reportTransition';
import Visualizer from '../Visualizer/Visualizer';
import { useAuth } from '../../auth/useAuth';
import { getApiBase } from '../../api/client';
import { getAuthHeaders } from '../../auth/cognitoStorage';
import { putWorkReport, patchWorkReport, getWorkReportByDate, getWorkReportById, getUploadUrl, uploadPutToS3 } from './salesDayReportApi';
import StoreSearchField from './StoreSearchField';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/** 業務報告をURLで開くだけの共有用（認証不要）。資料として誰でも見られる */
function buildReportShareUrl(reportId) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const pathname = typeof window !== 'undefined' ? (window.location.pathname || '').replace(/\/$/, '') : '';
  const base = (pathname || '/misogi').replace(/\/?$/, '/');
  return `${origin}${base}work-report-view.html?id=${encodeURIComponent(reportId)}`;
}
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
  } catch (_) { }
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
  } catch (_) { }
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
  const { startTransition } = useFlashTransition();
  const dateFromQuery = searchParams.get('date') || '';
  const workDate = dateFromQuery || getToday();

  const [header, setHeader] = useState(() => emptyHeader(workDate));
  const [cases, setCases] = useState([]);
  const [headerSaving, setHeaderSaving] = useState(false);
  const [headerSubmitting, setHeaderSubmitting] = useState(false);
  const [headerError, setHeaderError] = useState('');
  const [headerSubmitError, setHeaderSubmitError] = useState('');
  const [headerSaveSuccess, setHeaderSaveSuccess] = useState(false);
  const [caseSaving, setCaseSaving] = useState({});
  const [caseErrors, setCaseErrors] = useState({});
  const [caseSaveSuccess, setCaseSaveSuccess] = useState({});
  const [submitErrors, setSubmitErrors] = useState({});
  const [uploading, setUploading] = useState({ section: null, id: null });
  const [attachmentErrors, setAttachmentErrors] = useState({});
  const [shareUrl, setShareUrl] = useState(null);
  const [shareUrlCopied, setShareUrlCopied] = useState(false);
  /** 提出成功後にサーバーで読めない場合の警告（保存が別テーブル等で反映されていない） */
  const [shareVerifyError, setShareVerifyError] = useState(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [storeList, setStoreList] = useState([]);
  const fileInputRefs = useRef({});
  const saveSuccessTimerRef = useRef(null);
  const reportContentRef = useRef(null);

  useEffect(() => {
    const base = getApiBase().replace(/\/$/, '');
    const headers = getAuthHeaders();
    fetch(`${base}/stores`, { headers: { ...headers, 'Content-Type': 'application/json' }, cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => setStoreList(Array.isArray(data.items) ? data.items : []))
      .catch(() => setStoreList([]));
  }, []);

  const updateHeader = useCallback((next) => setHeader((h) => (typeof next === 'function' ? next(h) : { ...h, ...next })), []);

  const handleSavePdf = useCallback(async () => {
    if (!reportContentRef.current) return;
    setPdfGenerating(true);
    try {
      // 1. HTML -> Canvas
      const canvas = await html2canvas(reportContentRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff', // 背景色白
      });

      // 2. Canvas -> PDF
      const imgData = canvas.toDataURL('image/jpeg', 0.8);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgProps = pdf.getImageProperties(imgData);
      const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

      // 複数ページ対応
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      const pdfBlob = pdf.output('blob');
      const filename = `report_${header.work_date || workDate}_${Date.now()}.pdf`;
      const file = new File([pdfBlob], filename, { type: 'application/pdf' });

      // プレビュー: 新しいタブで開く
      const previewUrl = URL.createObjectURL(pdfBlob);
      window.open(previewUrl, '_blank');

      // 3. Upload
      // uploadAttachmentロジックを再利用したいが、uploadAttachmentはsetUploading等UI用stateを触るので
      // ここで別途アップロード処理を書く（ロジックは同じ）
      const context = 'sales-day-attachment';

      const { uploadUrl, fileUrl, key: s3Key } = await getUploadUrl({
        filename: file.name,
        mime: file.type,
        size: file.size,
        context,
        date: header.work_date || workDate,
      });

      // S3へPUT
      // FileオブジェクトはBlobの一種なのでそのまま送る、またはBuffer化
      // uploadPutToS3 は body を受け取る
      // ブラウザ環境なので File/Blob をそのまま fetch の body に渡せるはずだが、
      // 既存の uploadAttachment では FileReader で base64化している。
      // バイナリ送信の方が効率的だが、既存に合わせる（または uploadPutToS3 がどうなっているかによる）。
      // 既存実装: uploadPutToS3(uploadUrl, type, body) -> bodyがstringならそのまま、blobなら...
      // ここでは既存に合わせてBase64化する（確実）
      const fileBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result;
          resolve(dataUrl.indexOf(',') >= 0 ? dataUrl.slice(dataUrl.indexOf(',') + 1) : dataUrl);
        };
        reader.onerror = () => reject(new Error('PDF変換に失敗しました'));
        reader.readAsDataURL(file);
      });

      const res = await uploadPutToS3(uploadUrl, file.type, fileBase64);
      if (!res.ok) throw new Error('PDFのアップロードに失敗しました');

      const item = {
        name: file.name,
        mime: file.type,
        size: file.size,
        url: fileUrl,
        key: s3Key,
        uploaded_at: new Date().toISOString()
      };

      // 4. Headerに添付して保存
      // まずState更新
      let currentHeader = header;
      setHeader((prev) => {
        currentHeader = { ...prev, attachments: [...(prev.attachments || []), item] };
        return currentHeader;
      });

      // そのまま保存処理へ（少し待たないとState反映されないので、直接bodyを作る）
      const reporterName = user?.name || currentHeader.reporter_name || '';
      const body = {
        date: currentHeader.work_date,
        work_date: currentHeader.work_date,
        work_minutes: Number(currentHeader.total_minutes),
        template_id: TEMPLATE_DAY,
        state: 'draft',
        target_label: 'sales-day',
        description: JSON.stringify(serializeHeader({ ...currentHeader, reporter_name: reporterName })),
      };
      if (currentHeader.saved?.log_id) {
        body.log_id = currentHeader.saved.log_id;
        body.version = currentHeader.saved.version;
      }

      const saveRes = await putWorkReport(body);
      if (saveRes && saveRes.log_id) {
        const logId = saveRes.log_id;
        const version = saveRes.version ?? currentHeader.saved?.version ?? 0;
        const state = saveRes.state ?? 'draft';
        setHeader((h) => ({ ...h, saved: { log_id: logId, version, state } }));
        setHeaderSaveSuccess(true);
        setTimeout(() => setHeaderSaveSuccess(false), 2500);
      }

    } catch (e) {
      console.error(e);
      setHeaderError('PDF保存に失敗しました: ' + (e.message || 'Error'));
    } finally {
      setPdfGenerating(false);
    }
  }, [header, workDate, user?.name]);
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
        const fileBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result;
            resolve(dataUrl.indexOf(',') >= 0 ? dataUrl.slice(dataUrl.indexOf(',') + 1) : dataUrl);
          };
          reader.onerror = () => reject(new Error('ファイル読み込みに失敗しました'));
          reader.readAsDataURL(file);
        });
        const res = await uploadPutToS3(uploadUrl, file.type || 'application/octet-stream', fileBase64);
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
    setHeaderError('');
    setHeaderSaveSuccess(false);
    if (err) {
      setHeaderError(err);
      return;
    }
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
      // レスポンス検証: log_id が返らない場合は保存未反映としてエラー表示
      if (!res || res.log_id == null) {
        setHeaderError('保存に失敗しました（サーバーから log_id が返りませんでした）。しばらくしてから再試行してください。');
        return;
      }
      const logId = res.log_id ?? header.saved?.log_id;
      const version = res.version ?? header.saved?.version ?? 0;
      const state = res.state ?? 'draft';
      setHeader((h) => ({ ...h, saved: { log_id: logId, version, state } }));
      setHeaderError('');
      setHeaderSaveSuccess(true);
      if (saveSuccessTimerRef.current) clearTimeout(saveSuccessTimerRef.current);
      saveSuccessTimerRef.current = setTimeout(() => {
        setHeaderSaveSuccess(false);
        saveSuccessTimerRef.current = null;
      }, 2500);
    } catch (e) {
      if (e?.status === 401) setAuthError(true);
      const msg = e?.message || '保存に失敗しました';
      setHeaderError(msg);
      if (msg.includes('another process') || msg.includes('refresh')) {
        const logId = header.saved?.log_id;
        if (logId) {
          getWorkReportById(logId)
            .then((item) => {
              setHeader(deserializeHeader(item.description, item));
              setHeaderError('最新の内容を反映しました。もう一度保存してください。');
            })
            .catch(() => { });
        }
      }
    } finally {
      setHeaderSaving(false);
    }
  }, [header, user?.name, validateHeader, workDate]);

  const handleHeaderSubmit = useCallback(async () => {
    setHeaderSubmitError('');
    const err = validateHeader();
    if (err) {
      setHeaderSubmitError(err);
      return;
    }
    if (header.saved?.state === 'submitted') {
      setHeaderSubmitError('すでに提出済みです');
      return;
    }
    setHeaderSubmitting(true);
    setShareUrl(null);
    setShareVerifyError(null);
    try {
      let logId = header.saved?.log_id;
      let version = header.saved?.version || 0;

      // ✅ ステップ0: 最新の内容を下書き保存（log_idがない場合、または内容が変更されている可能性があるため）
      try {
        const reporterName = user?.name || header.reporter_name || '';
        const saveBody = {
          date: header.work_date,
          work_date: header.work_date,
          work_minutes: Number(header.total_minutes),
          template_id: TEMPLATE_DAY,
          state: 'draft',
          target_label: 'sales-day',
          description: JSON.stringify(serializeHeader({ ...header, reporter_name: reporterName })),
        };
        if (logId) {
          saveBody.log_id = logId;
          saveBody.version = version;
        }
        const saveRes = await putWorkReport(saveBody);
        logId = saveRes.log_id;
        version = saveRes.version;
        // 下書き保存の状態を更新
        setHeader((h) => ({ ...h, saved: { log_id: logId, version, state: 'draft' } }));
      } catch (saveErr) {
        const saveMsg = saveErr?.message || '下書き保存に失敗しました';
        console.error('[handleHeaderSubmit] Draft save failed:', saveErr);
        setHeaderSubmitError(`下書き保存に失敗しました: ${saveMsg}`);
        return;
      }

      // ✅ ステップ1: 提出APIを呼び出す（下書き保存が完了したlog_idとversionを使用）
      const res = await patchWorkReport(logId, { state: 'submitted', version });

      // ✅ ステップ2: log_id がレスポンスに含まれているか確認
      if (!res || !res.log_id) {
        const errorMsg = res ? '保存に失敗しました（log_idが返ってきません）' : '提出に失敗しました（レスポンスが空です）';
        console.error('[handleHeaderSubmit] Missing log_id in response:', res);
        setHeaderSubmitError(errorMsg);
        return;
      }

      // ✅ ステップ3: 保存が確実に完了したことを確認（サーバーで実際に読めるか検証）
      try {
        const verifiedItem = await getWorkReportById(res.log_id);
        if (!verifiedItem || verifiedItem.state !== 'submitted') {
          throw new Error('提出状態が確認できませんでした');
        }

        // ✅ ステップ4: 検証成功後にのみ状態を更新
        setHeader((h) => ({ ...h, saved: { ...h.saved, state: 'submitted', version: res.version ?? (h.saved?.version || 0) + 1 } }));
        setHeaderSubmitError('');

        // ✅ ステップ5: 保存が確実に完了したことを確認してから共有URLを設定
        setShareUrl(buildReportShareUrl(res.log_id));
      } catch (verifyErr) {
        console.error('[handleHeaderSubmit] Failed to verify saved report:', verifyErr);
        if (verifyErr?.status === 404) {
          setHeaderSubmitError('提出は完了しましたが、サーバーに反映されていない可能性があります。管理者に連絡してください。');
        } else {
          setHeaderSubmitError('提出は完了しましたが、保存の確認に失敗しました。管理者に連絡してください。');
        }
        // 検証失敗時はモーダルを表示しない（URLを設定しない）
        return;
      }
    } catch (e) {
      if (e?.status === 401) setAuthError(true);
      const msg = e?.message || e?.body || '提出に失敗しました';
      console.error('[handleHeaderSubmit] Error:', e);
      setHeaderSubmitError(msg);
      if (msg.includes('another process') || msg.includes('refresh')) {
        const logId = header.saved?.log_id;
        if (logId) {
          getWorkReportById(logId)
            .then((item) => {
              setHeader(deserializeHeader(item.description, item));
              setHeaderSubmitError('最新の内容を反映しました。もう一度提出してください。');
            })
            .catch(() => { });
        }
      }
    } finally {
      setHeaderSubmitting(false);
    }
  }, [header.saved?.log_id, header.saved?.version, header.saved?.state, header.work_date, workDate]);

  const handleCaseSave = useCallback(
    async (index) => {
      const c = cases[index];
      setCaseErrors((prev) => ({ ...prev, [index]: null }));
      setCaseSaveSuccess((prev) => ({ ...prev, [index]: false }));
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
        if (!res || res.log_id == null) {
          setCaseErrors((prev) => ({ ...prev, [index]: '保存に失敗しました（サーバーから log_id が返りませんでした）。しばらくしてから再試行してください。' }));
          return;
        }
        updateCase(index, (prev) => ({
          ...prev,
          saved: { log_id: res.log_id, version: res.version ?? prev.saved?.version, state: res.state ?? 'draft' },
        }));
        setCaseSaveSuccess((prev) => ({ ...prev, [index]: true }));
        setTimeout(() => setCaseSaveSuccess((prev) => ({ ...prev, [index]: false })), 2500);
      } catch (e) {
        if (e?.status === 401) setAuthError(true);
        const msg = e?.message || '保存に失敗しました';
        setCaseErrors((prev) => ({ ...prev, [index]: msg }));
        if (msg.includes('another process') || msg.includes('refresh')) {
          const logId = c.saved?.log_id;
          if (logId) {
            getWorkReportById(logId)
              .then((item) => {
                updateCase(index, () => deserializeCase(item.description, item));
                setCaseErrors((prev) => ({ ...prev, [index]: '最新の内容を反映しました。もう一度保存してください。' }));
              })
              .catch(() => { });
          }
        }
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
      setCaseSaving((prev) => ({ ...prev, [index]: true }));
      setShareUrl(null);
      setShareVerifyError(null);
      try {
        let logId = c.saved?.log_id;
        let version = c.saved?.version || 0;

        // ✅ ステップ0: 最新の内容を下書き保存（log_idがない場合、または内容が変更されている可能性があるため）
        try {
          const saveBody = {
            date: header.work_date || workDate,
            work_date: header.work_date || workDate,
            work_minutes: Number(c.work_minutes) || 0,
            template_id: TEMPLATE_CASE,
            state: 'draft',
            target_label: c.store_name || `案件${index + 1}`,
            description: JSON.stringify(serializeCase(c)),
          };
          if (logId) {
            saveBody.log_id = logId;
            saveBody.version = version;
          }
          const saveRes = await putWorkReport(saveBody);
          logId = saveRes.log_id;
          version = saveRes.version;
          // 下書き保存の状態を更新
          updateCase(index, (prev) => ({ ...prev, saved: { log_id: logId, version, state: 'draft' } }));
        } catch (saveErr) {
          const saveMsg = saveErr?.message || '下書き保存に失敗しました';
          console.error('[handleCaseSubmit] Draft save failed:', saveErr);
          setSubmitErrors((prev) => ({ ...prev, [index]: `下書き保存に失敗しました: ${saveMsg}` }));
          return;
        }

        // ✅ ステップ1: 提出APIを呼び出す（下書き保存が完了したlog_idとversionを使用）
        const res = await patchWorkReport(logId, { state: 'submitted', version });

        // ✅ ステップ2: log_id がレスポンスに含まれているか確認
        if (!res || !res.log_id) {
          const errorMsg = res ? '保存に失敗しました（log_idが返ってきません）' : '提出に失敗しました（レスポンスが空です）';
          console.error('[handleCaseSubmit] Missing log_id in response:', res);
          setSubmitErrors((prev) => ({ ...prev, [index]: errorMsg }));
          return;
        }

        // ✅ ステップ3: 保存が確実に完了したことを確認（サーバーで実際に読めるか検証）
        try {
          const verifiedItem = await getWorkReportById(res.log_id);
          if (!verifiedItem || verifiedItem.state !== 'submitted') {
            throw new Error('提出状態が確認できませんでした');
          }

          // ✅ ステップ4: 検証成功後にのみ状態を更新
          updateCase(index, (prev) => ({ ...prev, saved: { ...prev.saved, state: 'submitted', version: res.version ?? (prev.saved?.version || 0) + 1 } }));
          setSubmitErrors((prev) => ({ ...prev, [index]: null }));

          // ✅ ステップ5: 保存が確実に完了したことを確認してから共有URLを設定
          setShareUrl(buildReportShareUrl(res.log_id));
        } catch (verifyErr) {
          console.error('[handleCaseSubmit] Failed to verify saved report:', verifyErr);
          if (verifyErr?.status === 404) {
            setSubmitErrors((prev) => ({ ...prev, [index]: '提出は完了しましたが、サーバーに反映されていない可能性があります。管理者に連絡してください。' }));
          } else {
            setSubmitErrors((prev) => ({ ...prev, [index]: '提出は完了しましたが、保存の確認に失敗しました。管理者に連絡してください。' }));
          }
          // 検証失敗時はモーダルを表示しない（URLを設定しない）
          return;
        }
      } catch (e) {
        if (e?.status === 401) setAuthError(true);
        const msg = e?.message || e?.body || '提出に失敗しました';
        console.error('[handleCaseSubmit] Error:', e);
        setSubmitErrors((prev) => ({ ...prev, [index]: msg }));
        if (msg.includes('another process') || msg.includes('refresh')) {
          const logId = c.saved?.log_id;
          if (logId) {
            getWorkReportById(logId)
              .then((item) => {
                updateCase(index, () => deserializeCase(item.description, item));
                setSubmitErrors((prev) => ({ ...prev, [index]: '最新の内容を反映しました。もう一度提出してください。' }));
              })
              .catch(() => { });
          }
        }
      } finally {
        setCaseSaving((prev) => ({ ...prev, [index]: false }));
      }
    },
    [cases, validateCaseSubmit, updateCase, header.work_date, workDate]
  );

  const addCase = useCallback(() => {
    setCases((prev) => [...prev, emptyCase()]);
  }, []);

  useEffect(() => {
    setHeader((h) => ({ ...h, work_date: workDate }));
  }, [workDate]);

  useEffect(() => {
    return () => {
      if (saveSuccessTimerRef.current) clearTimeout(saveSuccessTimerRef.current);
    };
  }, []);

  const [authError, setAuthError] = useState(false);
  useEffect(() => {
    setAuthError(false);
    getWorkReportByDate(workDate)
      .then((items) => {
        if (!Array.isArray(items)) return;
        const dayItem = items.find((i) => i.template_id === TEMPLATE_DAY);
        const caseItems = items.filter((i) => i.template_id === TEMPLATE_CASE);
        if (dayItem) setHeader(deserializeHeader(dayItem.description, dayItem));
        setCases(caseItems.map((it) => deserializeCase(it.description, it)));
      })
      .catch((e) => {
        if (e?.status === 401) setAuthError(true);
      });
  }, [workDate]);

  const isUploading = (section, id) => uploading.section === section && uploading.id === id;

  return (
    <div className="report-page sales-day-report-page" data-job="sales">
      <div className="report-page-viz">
        <Visualizer mode="base" className="report-page-visualizer" />
      </div>
      <div className="report-page-content sales-day-content" ref={reportContentRef}>
        {authError && (
          <div style={{ marginBottom: 16, padding: 12, background: 'rgba(255,48,48,0.15)', border: '1px solid rgba(255,48,48,0.3)', borderRadius: 8, fontSize: '0.9rem' }} role="alert">
            ログインが必要です。業務報告の取得・保存にはサインインしてください。
            <Link to="/" style={{ marginLeft: 8, color: 'var(--accent)' }}>トップへ</Link>
          </div>
        )}
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
          <h1 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 600 }}>業務報告</h1>
        </div>

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
              className="btn btn-secondary"
              onClick={handleSavePdf}
              disabled={pdfGenerating || headerSaving}
              style={{ marginLeft: 8 }}
            >
              {pdfGenerating ? 'PDF生成中...' : 'PDF保存'}
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
          {headerSaveSuccess && <p className="sales-day-success" role="status">保存しました</p>}
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
                    <StoreSearchField
                      stores={storeList}
                      value={c.store_name}
                      storeKey={c.store_key}
                      onChange={(o) => updateCase(index, o)}
                      placeholder="法人名・ブランド名・店舗名で検索"
                    />
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
                {caseSaveSuccess[index] && <p className="sales-day-success" role="status">保存しました</p>}
                {caseErrors[index] && <p className="sales-day-error">{caseErrors[index]}</p>}
                {submitErrors[index] && <p className="sales-day-error">{submitErrors[index]}</p>}
              </div>
            ))}
          </div>
        </section>

        {shareUrl && (
          <div
            className="sales-day-share-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="個別URLを発行しました"
            onClick={() => { setShareUrl(null); setShareUrlCopied(false); setShareVerifyError(null); }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
          >
            <div
              className="sales-day-share-modal"
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'var(--surface, #1f2937)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12,
                padding: 24,
                maxWidth: 480,
                width: '90%',
              }}
            >
              <h3 style={{ margin: '0 0 12px', fontSize: '1.1rem' }}>社内共有URLを発行しました</h3>
              <p style={{ margin: '0 0 12px', fontSize: '0.9rem', color: 'var(--muted, #9ca3af)' }}>
                社内ログイン後にこのURLで報告詳細を閲覧できます。
              </p>
              {shareVerifyError && (
                <p role="alert" style={{ margin: '0 0 12px', fontSize: '0.9rem', color: 'var(--alert, #ff3030)' }}>
                  {shareVerifyError}
                </p>
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    color: 'var(--fg)',
                    fontSize: '0.85rem',
                  }}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    if (typeof navigator?.clipboard?.writeText === 'function') {
                      navigator.clipboard.writeText(shareUrl);
                      setShareUrlCopied(true);
                    }
                  }}
                >
                  {shareUrlCopied ? 'コピーしました' : 'コピー'}
                </button>
              </div>
              <button
                type="button"
                className="btn"
                onClick={() => { setShareUrl(null); setShareUrlCopied(false); setShareVerifyError(null); }}
              >
                閉じる
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
