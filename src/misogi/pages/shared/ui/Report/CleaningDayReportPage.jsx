import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Visualizer from '../Visualizer/Visualizer';
import Hotbar from '../Hotbar/Hotbar';
import { putWorkReport, patchWorkReport, getWorkReport, getUploadUrl } from './cleaningDayReportApi';
import { getApiBase } from '../../api/client';
import { getAuthHeaders } from '../../auth/cognitoStorage';
import StoreSearchField from '../Sales/StoreSearchField';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useAuth } from '../../auth/useAuth';
import './cleaning-day-report.css';

const TEMPLATE_DAY = 'CLEANING_DAY_V1';
const TEMPLATE_STORE = 'CLEANING_STORE_V1';
const UPLOAD_CONTEXT = 'cleaning-store-attachment';
const MAX_ATTACHMENTS = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'pdf', 'xlsx', 'docx', 'heic'];

const emptyStore = (enabled = false) => ({
  enabled,
  tenpo_id: '',
  store_name: '',
  address: '',
  witness: '',
  work_start_time: '',
  work_end_time: '',
  store_minutes: 0,
  note: '',
  services: [{ name: '', minutes: 0, memo: '' }],
  attachments: [],
  saved: { log_id: null, version: null, state: null },
});

/** 店舗レポートの description(JSON) をシリアライズ（後で report_data 移行時も流用） */
function serializeStoreReport(store) {
  return {
    store: {
      tenpo_id: store.tenpo_id || '',
      name: store.store_name || '',
      address: store.address || '',
      witness: store.witness || '',
      work_start_time: store.work_start_time || '',
      work_end_time: store.work_end_time || '',
      note: store.note || '',
    },
    services: store.services || [],
    attachments: store.attachments || [],
  };
}

/** GET で取得した 1 件の店舗レポートから store オブジェクトを復元 */
function deserializeStoreReport(descriptionJson, workReportItem) {
  let store = {};
  let services = [{ name: '', minutes: 0, memo: '' }];
  let attachments = [];
  try {
    const d = JSON.parse(descriptionJson || '{}');
    store = d.store || {};
    services = Array.isArray(d.services) && d.services.length ? d.services : services;
    attachments = Array.isArray(d.attachments) ? d.attachments : [];
  } catch (_) { }
  return {
    enabled: true,
    tenpo_id: store.tenpo_id || workReportItem?.target_id || workReportItem?.tenpo_id || '',
    store_name: store.name || workReportItem?.target_label || '',
    address: store.address || '',
    witness: store.witness || '',
    work_start_time: store.work_start_time || '',
    work_end_time: store.work_end_time || '',
    store_minutes: workReportItem?.work_minutes || 0,
    note: store.note || '',
    services,
    attachments,
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

function initialStores() {
  return [emptyStore(true), emptyStore(false), emptyStore(false)];
}

function getInitialHeader() {
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const date = params.get('date') || '';
  return { work_date: date, total_minutes: 0, note: '' };
}

export default function CleaningDayReportPage({ isAdmin = false }) {
  const location = useLocation();
  const { user } = useAuth();
  const [header, setHeader] = useState(getInitialHeader);
  const [stores, setStores] = useState(initialStores);
  const [daySaved, setDaySaved] = useState({ log_id: null, version: null, state: null });
  const [activeTab, setActiveTab] = useState(0);
  const [dayError, setDayError] = useState('');
  const [daySaving, setDaySaving] = useState(false);
  const [storeErrors, setStoreErrors] = useState({});
  const [storeSaving, setStoreSaving] = useState({});
  const [submitErrors, setSubmitErrors] = useState({});
  const [storeUploading, setStoreUploading] = useState({});
  const [attachmentErrors, setAttachmentErrors] = useState({});
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [reportHotbarActive, setReportHotbarActive] = useState('report-preview');
  const [storeList, setStoreList] = useState([]);
  const fileInputRefs = useRef([]);
  const printRef = useRef(null);

  useEffect(() => {
    const base = getApiBase().replace(/\/$/, '');
    const headers = getAuthHeaders();
    fetch(`${base}/stores`, { headers: { ...headers, 'Content-Type': 'application/json' }, cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => setStoreList(Array.isArray(data.items) ? data.items : []))
      .catch(() => setStoreList([]));
  }, []);

  const renderPdfDocument = useCallback(async () => {
    if (!printRef.current) throw new Error('印刷プレビュー要素が見つかりません');
    const prevDisplay = printRef.current.style.display;
    printRef.current.style.display = 'block';
    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.8);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgProps = pdf.getImageProperties(imgData);
      const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

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
      return pdf;
    } finally {
      printRef.current.style.display = prevDisplay || 'none';
    }
  }, []);

  const handlePreviewPdf = useCallback(async () => {
    setPdfGenerating(true);
    try {
      const pdf = await renderPdfDocument();
      const pdfBlob = pdf.output('blob');
      const previewUrl = URL.createObjectURL(pdfBlob);
      window.open(previewUrl, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(previewUrl), 60_000);
    } catch (e) {
      console.error(e);
      setDayError('PDFプレビューに失敗しました: ' + (e.message || 'Error'));
    } finally {
      setPdfGenerating(false);
    }
  }, [renderPdfDocument]);

  const handleDownloadPdf = useCallback(async () => {
    setPdfGenerating(true);
    try {
      const pdf = await renderPdfDocument();
      const filename = `cleaning-report-${header.work_date || new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(filename);
    } catch (e) {
      console.error(e);
      setDayError('PDF生成に失敗しました: ' + (e.message || 'Error'));
    } finally {
      setPdfGenerating(false);
    }
  }, [header.work_date, renderPdfDocument]);

  const enabledStores = stores.filter((s) => s.enabled);
  const storeMinutesSum = enabledStores.reduce((acc, s) => acc + (Number(s.store_minutes) || 0), 0);
  const totalMismatch = header.total_minutes > 0 && storeMinutesSum > 0 && header.total_minutes !== storeMinutesSum;

  const updateHeader = useCallback((next) => setHeader((h) => ({ ...h, ...next })), []);
  const updateStore = useCallback((index, next) => {
    setStores((prev) => {
      const s = [...prev];
      s[index] = typeof next === 'function' ? next(s[index]) : { ...s[index], ...next };
      return s;
    });
  }, []);

  const addService = useCallback(
    (storeIndex) => {
      updateStore(storeIndex, (s) => ({
        ...s,
        services: [...s.services, { name: '', minutes: 0, memo: '' }],
      }));
    },
    [updateStore]
  );
  const removeService = useCallback(
    (storeIndex, serviceIndex) => {
      updateStore(storeIndex, (s) => ({
        ...s,
        services: s.services.filter((_, i) => i !== serviceIndex),
      }));
    },
    [updateStore]
  );
  const updateService = useCallback(
    (storeIndex, serviceIndex, field, value) => {
      updateStore(storeIndex, (s) => ({
        ...s,
        services: s.services.map((sv, i) =>
          i === serviceIndex ? { ...sv, [field]: field === 'minutes' ? Number(value) || 0 : value } : sv
        ),
      }));
    },
    [updateStore]
  );

  const validateAttachmentFile = useCallback((file, currentCount) => {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      return `「${file.name}」は許可されていない形式です（許可: ${ALLOWED_EXT.join(', ')}）`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `「${file.name}」は 10MB を超えています`;
    }
    if (currentCount >= MAX_ATTACHMENTS) {
      return `1店舗あたり最大 ${MAX_ATTACHMENTS} 件までです`;
    }
    return '';
  }, []);

  const uploadAttachment = useCallback(
    async (file, storeIndex) => {
      const date = header.work_date || new Date().toISOString().slice(0, 10);
      setAttachmentErrors((prev) => ({ ...prev, [storeIndex]: null }));
      try {
        const { uploadUrl, fileUrl, key } = await getUploadUrl({
          filename: file.name,
          mime: file.type || 'application/octet-stream',
          size: file.size,
          context: UPLOAD_CONTEXT,
          date,
          storeIndex,
        });
        const res = await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
        });
        if (!res.ok) throw new Error('アップロードに失敗しました');
        const item = {
          name: file.name,
          mime: file.type || 'application/octet-stream',
          size: file.size,
          url: fileUrl,
          key,
          uploaded_at: new Date().toISOString(),
        };
        updateStore(storeIndex, (s) => ({
          ...s,
          attachments: [...(s.attachments || []), item],
        }));
      } catch (e) {
        setAttachmentErrors((prev) => ({
          ...prev,
          [storeIndex]: e.message || 'アップロードに失敗しました',
        }));
      }
    },
    [header.work_date, updateStore]
  );

  const handleAttachmentSelect = useCallback(
    async (storeIndex, fileList) => {
      const files = Array.from(fileList || []);
      const currentCount = stores[storeIndex]?.attachments?.length || 0;
      let err = '';
      for (let i = 0; i < files.length; i++) {
        err = validateAttachmentFile(files[i], currentCount + i);
        if (err) break;
      }
      if (!err && currentCount + files.length > MAX_ATTACHMENTS) {
        err = `1店舗あたり最大 ${MAX_ATTACHMENTS} 件までです`;
      }
      if (err) {
        setAttachmentErrors((prev) => ({ ...prev, [storeIndex]: err }));
        return;
      }
      setStoreUploading((prev) => ({ ...prev, [storeIndex]: true }));
      setAttachmentErrors((prev) => ({ ...prev, [storeIndex]: null }));
      for (const file of files) {
        await uploadAttachment(file, storeIndex);
      }
      setStoreUploading((prev) => ({ ...prev, [storeIndex]: false }));
      const input = fileInputRefs.current[storeIndex];
      if (input) input.value = '';
    },
    [stores, validateAttachmentFile, uploadAttachment]
  );

  const removeAttachment = useCallback(
    (storeIndex, attachIndex) => {
      updateStore(storeIndex, (s) => ({
        ...s,
        attachments: (s.attachments || []).filter((_, i) => i !== attachIndex),
      }));
      setAttachmentErrors((prev) => ({ ...prev, [storeIndex]: null }));
    },
    [updateStore]
  );

  const validateDaySave = useCallback(() => {
    if (!header.work_date?.trim()) return '作業日が未入力です';
    if (Number(header.total_minutes) <= 0) return '合計作業時間を入力してください';
    return '';
  }, [header.work_date, header.total_minutes]);

  const validateStoreSubmit = useCallback((store, index) => {
    const errs = [];
    if (!store.store_name?.trim()) errs.push(`店舗${index + 1}: 店舗名が未入力です`);
    if (Number(store.store_minutes) <= 0) errs.push(`店舗${index + 1}: 店舗別作業時間を入力してください`);
    if (!store.services?.length) errs.push(`店舗${index + 1}: 作業を1件以上追加してください`);
    store.services?.forEach((sv, i) => {
      if (!sv.name?.trim()) errs.push(`店舗${index + 1} 作業${i + 1}: 作業名が未入力です`);
      if (Number(sv.minutes) <= 0) errs.push(`店舗${index + 1} 作業${i + 1}: 作業時間を入力してください`);
    });
    return errs;
  }, []);

  const handleDaySave = useCallback(async () => {
    const err = validateDaySave();
    setDayError(err);
    if (err) return;
    setDaySaving(true);
    try {
      const body = {
        date: header.work_date,
        work_date: header.work_date,
        work_minutes: Number(header.total_minutes),
        template_id: TEMPLATE_DAY,
        state: 'draft',
        description: JSON.stringify({
          note: header.note,
          stores_enabled: stores.map((s) => s.enabled),
        }),
      };
      if (daySaved.log_id) {
        body.log_id = daySaved.log_id;
        body.version = daySaved.version;
      }
      const res = await putWorkReport(body);
      setDaySaved({ log_id: res.log_id, version: res.version, state: res.state });
      setDayError('');
    } catch (e) {
      setDayError(e.message || '保存に失敗しました');
    } finally {
      setDaySaving(false);
    }
  }, [header, stores, daySaved, validateDaySave]);

  const handleStoreSave = useCallback(
    async (index) => {
      const s = stores[index];
      setStoreSaving((prev) => ({ ...prev, [index]: true }));
      setStoreErrors((prev) => ({ ...prev, [index]: null }));
      try {
        const body = {
          date: header.work_date || new Date().toISOString().slice(0, 10),
          work_date: header.work_date || new Date().toISOString().slice(0, 10),
          work_minutes: Number(s.store_minutes) || 0,
          template_id: TEMPLATE_STORE,
          state: 'draft',
          target_label: s.store_name || `店舗${index + 1}`,
          description: JSON.stringify(serializeStoreReport(s)),
        };
        if (s.tenpo_id) {
          body.target_id = s.tenpo_id;
        }
        if (s.saved?.log_id) {
          body.log_id = s.saved.log_id;
          body.version = s.saved.version;
        }
        const res = await putWorkReport(body);
        updateStore(index, (prev) => ({
          ...prev,
          saved: { log_id: res.log_id, version: res.version, state: res.state },
        }));
      } catch (e) {
        setStoreErrors((prev) => ({ ...prev, [index]: e.message || '保存に失敗しました' }));
      } finally {
        setStoreSaving((prev) => ({ ...prev, [index]: false }));
      }
    },
    [stores, header.work_date, updateStore]
  );

  const handleStoreSubmit = useCallback(
    async (index) => {
      const s = stores[index];
      const errs = validateStoreSubmit(s, index);
      if (errs.length) {
        setSubmitErrors((prev) => ({ ...prev, [index]: errs.join(' ') }));
        return;
      }
      setSubmitErrors((prev) => ({ ...prev, [index]: null }));
      if (!s.saved?.log_id) {
        setSubmitErrors((prev) => ({ ...prev, [index]: '先に「この店舗を下書き保存」を実行してください' }));
        return;
      }
      setStoreSaving((prev) => ({ ...prev, [index]: true }));
      try {
        await patchWorkReport(s.saved.log_id, { state: 'submitted', version: s.saved.version });
        updateStore(index, (prev) => ({
          ...prev,
          saved: { ...prev.saved, state: 'submitted', version: (prev.saved?.version || 0) + 1 },
        }));
      } catch (e) {
        setSubmitErrors((prev) => ({ ...prev, [index]: e.message || '提出に失敗しました' }));
      } finally {
        setStoreSaving((prev) => ({ ...prev, [index]: false }));
      }
    },
    [stores, validateStoreSubmit, updateStore]
  );

  const handleReportHotbar = useCallback(
    async (id) => {
      setReportHotbarActive(id);
      if (id === 'report-preview') {
        await handlePreviewPdf();
        return;
      }
      if (id === 'report-pdf') {
        await handleDownloadPdf();
        return;
      }
      if (id === 'tools-save') {
        await handleDaySave();
        return;
      }
      if (id === 'tools-camera') {
        const targetIndex = stores[activeTab]?.enabled ? activeTab : stores.findIndex((s) => s.enabled);
        if (targetIndex >= 0) {
          fileInputRefs.current[targetIndex]?.click();
        } else {
          setDayError('有効な店舗タブを選択してからカメラを開いてください');
        }
      }
    },
    [activeTab, handleDaySave, handleDownloadPdf, handlePreviewPdf, stores]
  );

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const date = params.get('date') || header.work_date;
    if (!date) return;
    getWorkReport({ date })
      .then((items) => {
        if (!items || !Array.isArray(items) || items.length === 0) return;
        const dayItem = items.find((i) => i.template_id === TEMPLATE_DAY);
        if (dayItem) {
          setHeader((h) => ({
            ...h,
            work_date: dayItem.work_date || date,
            total_minutes: dayItem.work_minutes || 0,
            note: (() => {
              try {
                const d = JSON.parse(dayItem.description || '{}');
                return d.note || '';
              } catch {
                return '';
              }
            })(),
          }));
          setDaySaved({
            log_id: dayItem.log_id,
            version: dayItem.version,
            state: dayItem.state,
          });
        }
        const storeItems = items.filter((i) => i.template_id === TEMPLATE_STORE);
        if (storeItems.length > 0) {
          setStores((prev) => {
            const next = [...prev];
            storeItems.slice(0, 3).forEach((it, i) => {
              next[i] = deserializeStoreReport(it.description, it);
            });
            return next;
          });
        }
      })
      .catch((err) => {
        if (import.meta.env.DEV) console.warn('[CleaningDayReport] GET /work-report failed:', err?.message || err);
      });
  }, [location.search]);

  const badge = (saved) => {
    if (!saved?.log_id) return <span className="cleaning-day-badge cleaning-day-badge-unsaved">未保存</span>;
    if (saved.state === 'submitted' || saved.state === 'approved') return <span className="cleaning-day-badge cleaning-day-badge-submitted">提出済</span>;
    return <span className="cleaning-day-badge cleaning-day-badge-draft">下書き</span>;
  };
  const badgeSymbol = (saved) => {
    if (!saved?.log_id) return '⚪';
    if (saved.state === 'submitted' || saved.state === 'approved') return '🟢';
    return '🟡';
  };

  return (
    <div className="report-page cleaning-day-report-page" data-job="cleaning">
      <div className="report-page-viz">
        <Visualizer mode="base" className="report-page-visualizer" />
      </div>
      <div className="report-page-content cleaning-day-content">
        <p className="cleaning-day-back-row">
          <Link className="cleaning-day-back-link" to={isAdmin ? "/admin/entrance" : "/jobs/cleaning/entrance"}>
            ← {isAdmin ? "管理エントランスに戻る" : "入口に戻る"}
          </Link>
        </p>
        <h1 className="cleaning-day-title">業務報告</h1>

        {/* ヘッダー */}
        <section className="cleaning-day-header">
          <div className="cleaning-day-header-row">
            <label htmlFor="cd-work-date">作業日（必須）</label>
            <input
              id="cd-work-date"
              type="date"
              value={header.work_date}
              onChange={(e) => updateHeader({ work_date: e.target.value })}
            />
          </div>
          <div className="cleaning-day-header-row">
            <label htmlFor="cd-total-min">合計作業時間（分）必須</label>
            <input
              id="cd-total-min"
              type="number"
              min={0}
              value={header.total_minutes || ''}
              onChange={(e) => updateHeader({ total_minutes: e.target.value })}
            />
          </div>
          <div className="cleaning-day-header-row">
            <label htmlFor="cd-note">全体備考（任意）</label>
            <input
              id="cd-note"
              type="text"
              value={header.note}
              onChange={(e) => updateHeader({ note: e.target.value })}
              placeholder="任意"
            />
          </div>
          <div className="cleaning-day-header-actions">
            <button type="button" className="btn" onClick={handleDaySave} disabled={daySaving}>
              {daySaving ? '保存中...' : '日次サマリを下書き保存'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleDownloadPdf}
              disabled={pdfGenerating}
              style={{ marginLeft: 8 }}
            >
              {pdfGenerating ? 'PDF生成中...' : 'PDF保存'}
            </button>
          </div>
          {dayError && <p className="cleaning-day-error">{dayError}</p>}
          {totalMismatch && (
            <p className="cleaning-day-warning">
              合計時間（{header.total_minutes}分）と保存済み店舗の時間合計（{storeMinutesSum}分）が一致しません。
            </p>
          )}
        </section>

        {/* 店舗タブ */}
        <div className="cleaning-day-tabs">
          {[0, 1, 2].map((i) => (
            <button
              key={i}
              type="button"
              className={`cleaning-day-tab ${activeTab === i ? 'active' : ''} ${!stores[i].enabled ? 'disabled' : ''}`}
              onClick={() => setActiveTab(i)}
            >
              <span className="cleaning-day-tab-label">
                店舗{i + 1}
                {stores[i].store_name?.trim() ? `（${stores[i].store_name}）` : ''}
              </span>
              {i > 0 && (
                <label className="cleaning-day-tab-enable" onClick={(ev) => ev.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={stores[i].enabled}
                    onChange={(e) => updateStore(i, { enabled: e.target.checked })}
                  />
                  有効
                </label>
              )}
              <span className="cleaning-day-tab-badge" title={!stores[i].saved?.log_id ? '未保存' : (stores[i].saved.state === 'submitted' || stores[i].saved.state === 'approved' ? '提出済' : '下書き')}>{badgeSymbol(stores[i].saved)}</span>
            </button>
          ))}
        </div>

        {/* タブ内容 */}
        {stores.map(
          (store, index) =>
            store.enabled && (
              <div
                key={index}
                className={`cleaning-day-panel ${activeTab === index ? 'active' : ''}`}
                hidden={activeTab !== index}
              >
                <div className="cleaning-day-store-fields">
                  <div className="cleaning-day-field">
                    <label>店舗名（必須）</label>
                    <StoreSearchField
                      stores={storeList}
                      value={store.store_name}
                      storeKey={store.tenpo_id || ''}
                      onChange={(o) => updateStore(index, { store_name: o.store_name, tenpo_id: o.store_key || '' })}
                      placeholder="法人名・ブランド名・店舗名で検索"
                    />
                  </div>
                  <div className="cleaning-day-field">
                    <label>住所（任意）</label>
                    <input
                      type="text"
                      value={store.address}
                      onChange={(e) => updateStore(index, { address: e.target.value })}
                    />
                  </div>
                  <div className="cleaning-day-field">
                    <label>立会者（任意）</label>
                    <input
                      type="text"
                      value={store.witness}
                      onChange={(e) => updateStore(index, { witness: e.target.value })}
                    />
                  </div>
                  <div className="cleaning-day-field">
                    <label>業務開始時間（任意）</label>
                    <input
                      type="time"
                      value={store.work_start_time}
                      onChange={(e) => updateStore(index, { work_start_time: e.target.value })}
                    />
                  </div>
                  <div className="cleaning-day-field">
                    <label>業務終了時間（任意）</label>
                    <input
                      type="time"
                      value={store.work_end_time}
                      onChange={(e) => updateStore(index, { work_end_time: e.target.value })}
                    />
                  </div>
                  <div className="cleaning-day-field">
                    <label>店舗別作業時間（分）必須</label>
                    <input
                      type="number"
                      min={0}
                      value={store.store_minutes || ''}
                      onChange={(e) => updateStore(index, { store_minutes: e.target.value })}
                    />
                  </div>
                  <div className="cleaning-day-field">
                    <label>店舗備考（任意）</label>
                    <input
                      type="text"
                      value={store.note}
                      onChange={(e) => updateStore(index, { note: e.target.value })}
                    />
                  </div>
                </div>

                <section className="cleaning-day-attachments">
                  <h3>補助資料添付</h3>
                  <input
                    ref={(el) => { fileInputRefs.current[index] = el; }}
                    type="file"
                    multiple
                    accept=".jpg,.jpeg,.png,.pdf,.xlsx,.docx,.heic,image/jpeg,image/png,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/heic"
                    className="cleaning-day-file-input"
                    onChange={(e) => { handleAttachmentSelect(index, e.target.files); }}
                  />
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={storeUploading[index] || (store.attachments?.length || 0) >= MAX_ATTACHMENTS}
                    onClick={() => fileInputRefs.current[index]?.click()}
                  >
                    {storeUploading[index] ? 'アップロード中...' : 'ファイルを追加'}
                  </button>
                  <p className="cleaning-day-attachments-hint">最大 {MAX_ATTACHMENTS} 件・1ファイル 10MB まで（jpg, png, pdf, xlsx, docx, heic）</p>
                  {(store.attachments?.length || 0) > 0 && (
                    <ul className="cleaning-day-attachment-list">
                      {(store.attachments || []).map((att, ai) => (
                        <li key={ai} className="cleaning-day-attachment-row">
                          <span className="cleaning-day-attachment-name" title={att.name}>{att.name}</span>
                          <span className="cleaning-day-attachment-size">{formatFileSize(att.size)}</span>
                          {att.url && (
                            <a href={att.url} target="_blank" rel="noopener noreferrer" className="cleaning-day-attachment-open">開く</a>
                          )}
                          <button
                            type="button"
                            className="cleaning-day-attachment-remove"
                            onClick={() => removeAttachment(index, ai)}
                            title="削除"
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {attachmentErrors[index] && <p className="cleaning-day-error">{attachmentErrors[index]}</p>}
                </section>

                <div className="cleaning-day-services">
                  <h3>作業一覧</h3>
                  {store.services.map((sv, si) => (
                    <div key={si} className="cleaning-day-service-row">
                      <input
                        type="text"
                        placeholder="作業名（必須）"
                        value={sv.name}
                        onChange={(e) => updateService(index, si, 'name', e.target.value)}
                      />
                      <input
                        type="number"
                        min={0}
                        placeholder="分"
                        value={sv.minutes || ''}
                        onChange={(e) => updateService(index, si, 'minutes', e.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="メモ"
                        value={sv.memo}
                        onChange={(e) => updateService(index, si, 'memo', e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => removeService(index, si)}
                        disabled={store.services.length <= 1}
                      >
                        削除
                      </button>
                    </div>
                  ))}
                  <button type="button" className="btn btn-sm" onClick={() => addService(index)}>
                    + 作業追加
                  </button>
                </div>

                <div className="cleaning-day-store-actions">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => handleStoreSave(index)}
                    disabled={storeSaving[index]}
                  >
                    {storeSaving[index] ? '保存中...' : 'この店舗を下書き保存'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleStoreSubmit(index)}
                    disabled={storeSaving[index]}
                  >
                    この店舗を提出
                  </button>
                </div>
                {storeErrors[index] && <p className="cleaning-day-error">{storeErrors[index]}</p>}
                {submitErrors[index] && <p className="cleaning-day-error">{submitErrors[index]}</p>}
              </div>
            )
        )}

        <p className="report-page-back">
          <Link to={isAdmin ? "/admin/entrance" : "/jobs/cleaning/entrance"}>{isAdmin ? "管理エントランスに戻る" : "入口に戻る"}</Link>
        </p>
      </div>

      <Hotbar
        actions={[
          { id: 'report-preview', label: 'プレビュー', icon: 'preview' },
          { id: 'report-pdf', label: 'PDF', icon: 'pdf' },
          { id: 'tools-save', label: '保存', icon: 'report' },
          { id: 'tools-camera', label: 'カメラ', icon: 'camera' },
        ]}
        active={reportHotbarActive}
        onChange={handleReportHotbar}
        showFlowGuideButton={false}
      />

      {/* 印刷用レイアウト（普段は非表示） */}
      <div ref={printRef} style={{ display: 'none', width: '210mm', minHeight: '297mm', padding: '15mm', backgroundColor: 'white', boxSizing: 'border-box', color: '#000', fontFamily: 'serif' }}>
        <h1 style={{ textAlign: 'center', fontSize: '24px', marginBottom: '20px', borderBottom: '2px solid #000', paddingBottom: '10px' }}>清掃業務報告書</h1>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <p><strong>作業日:</strong> {header.work_date}</p>
            <p><strong>報告者:</strong> {user?.name || ''}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p>作成日: {new Date().toLocaleDateString()}</p>
          </div>
        </div>

        <div style={{ border: '1px solid #000', padding: '10px', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '16px', margin: '0 0 10px 0', borderBottom: '1px solid #ccc' }}>【日次サマリ】</h2>
          <p style={{ margin: '5px 0' }}><strong>合計作業時間:</strong> {header.total_minutes} 分</p>
          <p style={{ margin: '5px 0' }}><strong>全体備考:</strong> {header.note}</p>
        </div>

        {stores.filter(s => s.enabled).map((store, i) => (
          <div key={i} style={{ marginBottom: '30px', pageBreakInside: 'avoid' }}>
            <h3 style={{ backgroundColor: '#f0f0f0', padding: '5px', borderLeft: '5px solid #666', fontSize: '16px', margin: '0 0 10px 0' }}>
              店舗 {i + 1}: {store.store_name}
            </h3>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px', fontSize: '12px' }}>
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #999', padding: '5px', width: '20%', backgroundColor: '#f9f9f9' }}>作業時間</td>
                  <td style={{ border: '1px solid #999', padding: '5px', width: '30%' }}>
                    {store.work_start_time} - {store.work_end_time} ({store.store_minutes}分)
                  </td>
                  <td style={{ border: '1px solid #999', padding: '5px', width: '20%', backgroundColor: '#f9f9f9' }}>住所</td>
                  <td style={{ border: '1px solid #999', padding: '5px', width: '30%' }}>{store.address}</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #999', padding: '5px', backgroundColor: '#f9f9f9' }}>立会者</td>
                  <td style={{ border: '1px solid #999', padding: '5px' }}>{store.witness}</td>
                  <td style={{ border: '1px solid #999', padding: '5px', backgroundColor: '#f9f9f9' }}>備考</td>
                  <td style={{ border: '1px solid #999', padding: '5px' }}>{store.note}</td>
                </tr>
              </tbody>
            </table>

            <h4 style={{ fontSize: '14px', margin: '10px 0 5px 0' }}>作業内容</h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px', fontSize: '12px' }}>
              <thead>
                <tr style={{ backgroundColor: '#eee' }}>
                  <th style={{ border: '1px solid #999', padding: '5px', textAlign: 'left' }}>作業名</th>
                  <th style={{ border: '1px solid #999', padding: '5px', textAlign: 'center', width: '60px' }}>時間</th>
                  <th style={{ border: '1px solid #999', padding: '5px', textAlign: 'left' }}>メモ</th>
                </tr>
              </thead>
              <tbody>
                {store.services.map((sv, si) => (
                  <tr key={si}>
                    <td style={{ border: '1px solid #999', padding: '5px' }}>{sv.name}</td>
                    <td style={{ border: '1px solid #999', padding: '5px', textAlign: 'center' }}>{sv.minutes}</td>
                    <td style={{ border: '1px solid #999', padding: '5px' }}>{sv.memo}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {store.attachments && store.attachments.length > 0 && (
              <div style={{ marginTop: '10px' }}>
                <h4 style={{ fontSize: '14px', margin: '5px 0' }}>添付資料</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                  {store.attachments.map((att, ai) => {
                    const isImg = ['jpg', 'jpeg', 'png', 'heic'].some(ext => att.name?.toLowerCase().endsWith(ext)) || att.mime?.startsWith('image/');
                    if (!isImg) return null; // PDFでの画像表示のみ対応
                    return (
                      <div key={ai} style={{ border: '1px solid #ddd', padding: '5px' }}>
                        <img src={att.url} alt={att.name} style={{ width: '100%', height: '100px', objectFit: 'cover' }} crossOrigin="anonymous" />
                        <p style={{ fontSize: '10px', margin: '2px 0 0 0', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{att.name}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ height: '1px', backgroundColor: '#000', margin: '20px 0' }}></div>
          </div>
        ))}
      </div>
    </div>
  );
}
