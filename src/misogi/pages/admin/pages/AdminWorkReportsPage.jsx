import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiFetchWorkReport } from '../../shared/api/client';
import { useAuth } from '../../shared/auth/useAuth';
import './admin-work-reports.css';

/** 清掃・提出済みサンプル1件（管理側で表示確認用。?sample=1 で表示） */
const SAMPLE_CLEANING_REPORT = {
  log_id: 'sample-cleaning-001',
  version: 1,
  state: 'submitted',
  template_id: 'CLEANING_STORE_V1',
  work_date: new Date().toISOString().slice(0, 10),
  work_minutes: 90,
  target_label: 'サンプル店舗（清掃）',
  created_by_name: '清掃担当',
  updated_at: new Date().toISOString().slice(0, 19),
  description: JSON.stringify({
    store: {
      name: 'サンプル店舗（清掃）',
      address: '東京都〇〇区〇〇 1-2-3',
      witness: '立会人 太郎',
      work_start_time: '09:00',
      work_end_time: '10:30',
      note: '清掃側から提出された業務報告のサンプルです。管理画面でこの形で表示されます。',
    },
    services: [
      { name: '通常清掃', minutes: 60, memo: 'フロア・トイレ' },
      { name: '追加作業', minutes: 30, memo: '窓ガラス' },
    ],
    attachments: [
      { url: 'https://example.com/photo.jpg', name: '作業後写真.jpg' },
    ],
  }),
};

/** 業務報告（管理）の権限は暫定クリア：誰でも見れる。必要になったら cognito_user.role で復活させる。 */

function getYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * 壊れたデータで落ちないJSONパース（description / report_data 用）
 * string → JSON.parse を試みる。失敗したら {}
 * object → そのまま返す
 * null/undefined → {}
 */
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

/**
 * description から要約・課題・メモを抽出（safeJsonParse 済み前提）
 * 清掃（CLEANING_*）は store.note / store.name を要約・メモに含める（docs/CLEANING_REPORT_STRUCTURE.md 参照）
 */
function extractDescriptionText(desc) {
  const summary = [desc.summary, desc?.header?.summary, desc?.store?.name].filter(Boolean).join(' ') || '';
  const issues = [desc.issues, desc?.header?.issues].filter(Boolean).join(' ') || '';
  const notes = [desc.note, desc.notes, desc?.header?.note, desc?.store?.note].filter(Boolean).join(' ') || '';
  return { summary, issues, notes };
}

/** description から添付URL一覧を取得（揺れても落ちない） */
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

/** 添付件数（attachments が null/string/array でも落ちない） */
function attachmentCount(item) {
  return collectAttachmentUrls(item).length;
}

function templateLabel(templateId) {
  if (!templateId) return '—';
  if (templateId.startsWith('SALES') || templateId.includes('SALES')) return '営業';
  if (templateId.startsWith('CLEANING') || templateId.includes('CLEANING')) return '清掃';
  return 'その他';
}

function submitterLabel(item) {
  return item.created_by_name || item.created_by || item.worker_id || '—';
}

/** 検索クエリにマッチするか（提出者・店舗・要約・課題・メモ、大小文字無視） */
function matchesSearch(item, query) {
  if (!query || !String(query).trim()) return true;
  const q = String(query).trim().toLowerCase();
  const desc = safeJsonParse(item?.description);
  const { summary, issues, notes } = extractDescriptionText(desc);
  const text = [
    submitterLabel(item),
    item.target_label ?? '',
    summary,
    issues,
    notes,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return text.includes(q);
}

/** 提出済み優先表示用：submitted なら true、state 欠落は「その他」として表示可 */
function isSubmitted(item) {
  if (item?.state === 'submitted') return true;
  if (item?.submitted_at) return true;
  if (item?.status === 'submitted') return true;
  return false;
}

/** 一覧は submitted のみ表示（Phase1）。並びは updated_at 降順 */
function filterAndSort(items) {
  const filtered = items.filter((it) => isSubmitted(it));
  return [...filtered].sort((a, b) => {
    const ua = a.updated_at || '';
    const ub = b.updated_at || '';
    return ub.localeCompare(ua);
  });
}

/**
 * 業務報告（管理）一覧
 * GET /admin/work-reports?from=YYYY-MM-DD&to=YYYY-MM-DD（管理用・全件）→ 検索 → 詳細モーダル
 */
export default function AdminWorkReportsPage() {
  const [searchParams] = useSearchParams();
  const showSample = searchParams.get('sample') === '1';
  const [date, setDate] = useState(() => getYesterday());
  const [rawList, setRawList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selected, setSelected] = useState(null);

  const { getToken } = useAuth();

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = getToken() || localStorage.getItem('cognito_id_token');
      const headers = token ? { Authorization: `Bearer ${String(token).trim()}` } : {};

      // 新API (/houkoku) から取得
      const res = await apiFetch(`/houkoku?date=${date}`, {
        method: 'GET',
        headers
      });

      const list = res?.items || [];
      const mappedList = list.map(mapNewHoukokuToOld);
      setRawList(mappedList);
    } catch (e) {
      console.error("Fetch list failed:", e);
      setError(e?.message || '取得に失敗しました');
      setRawList([]);
    } finally {
      setLoading(false);
    }
  }, [date, getToken]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const listToShow = useMemo(() => {
    if (showSample && rawList.length === 0) return [SAMPLE_CLEANING_REPORT];
    return rawList;
  }, [showSample, rawList]);

  const sorted = filterAndSort(listToShow);
  const filteredItems = sorted.filter((item) => matchesSearch(item, searchQuery));

  return (
    <div className="admin-work-reports-page">
      <h1 className="admin-work-reports-title">業務報告（管理）</h1>
      <p className="admin-work-reports-back">
        <Link to="/admin/entrance">管理エントランスに戻る</Link>
      </p>

      <div className="admin-work-reports-toolbar">
        <label className="admin-work-reports-field">
          <span>日付</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="admin-work-reports-input"
          />
        </label>
        <label className="admin-work-reports-field admin-work-reports-search">
          <span>検索</span>
          <input
            type="search"
            placeholder="提出者・店舗・要約・課題・メモ"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="admin-work-reports-input"
            aria-label="検索"
          />
        </label>
      </div>

      {error && (
        <p className="admin-work-reports-error" role="alert">
          {error}
        </p>
      )}
      {loading && <p className="admin-work-reports-loading">読み込み中…</p>}

      {!loading && rawList.length === 0 && !error && !showSample && (
        <p className="admin-work-reports-empty">
          該当する報告はありません。
          <Link to="/admin/work-reports?sample=1" className="admin-work-reports-sample-link">清掃提出サンプル1件を表示</Link>
        </p>
      )}
      {!loading && rawList.length > 0 && filteredItems.length === 0 && (
        <p className="admin-work-reports-empty">検索条件に一致する報告はありません。</p>
      )}

      {showSample && rawList.length === 0 && (
        <p className="admin-work-reports-sample-hint" role="status">
          清掃提出サンプル1件を表示しています（<code>?sample=1</code>）。実際のデータは日付を選んで API から取得されます。
        </p>
      )}
      {!loading && !error && (
        <details className="admin-work-reports-details" style={{ marginBottom: 16 }}>
          <summary>生データ（通信確認用）</summary>
          <pre className="admin-work-reports-pre" style={{ maxHeight: 200 }}>
            {listToShow.length === 0 ? '[]' : JSON.stringify(listToShow, null, 2)}
          </pre>
        </details>
      )}

      <div className="admin-work-reports-cards">
        {!loading &&
          filteredItems.map((item) => {
            const desc = safeJsonParse(item.description);
            const { summary, issues } = extractDescriptionText(desc);
            const minutes = item.work_minutes ?? item.total_minutes ?? '—';
            const updatedAt = item.updated_at
              ? String(item.updated_at).slice(0, 19)
              : '—';
            const count = attachmentCount(item);

            return (
              <button
                key={item.log_id ?? Math.random()}
                type="button"
                className="admin-work-reports-card"
                onClick={() => setSelected(item)}
              >
                <span className="admin-work-reports-card-row admin-work-reports-card-meta">
                  <span className="admin-work-reports-card-date">
                    {item.work_date || item.report_date || item.date || '—'}
                  </span>
                  <span className="admin-work-reports-card-template">
                    {templateLabel(item.template_id)}
                  </span>
                  <span className="admin-work-reports-card-state">
                    {item.state === 'submitted' ? '提出済み' : item.state ?? 'その他'}
                  </span>
                </span>
                <span className="admin-work-reports-card-submitter">
                  提出者: {submitterLabel(item)}
                </span>
                <span className="admin-work-reports-card-target">
                  店舗: {item.target_label ?? '—'}
                </span>
                <span className="admin-work-reports-card-minutes">
                  作業時間: {minutes === '—' ? '—' : `${minutes}分`}
                </span>
                {summary ? (
                  <span className="admin-work-reports-card-summary">
                    要約: {summary.slice(0, 80)}
                    {summary.length > 80 ? '…' : ''}
                  </span>
                ) : null}
                {issues ? (
                  <span className="admin-work-reports-card-issues">
                    課題: {issues.slice(0, 80)}
                    {issues.length > 80 ? '…' : ''}
                  </span>
                ) : null}
                <span className="admin-work-reports-card-attachments">
                  添付: {count}件
                </span>
                <span className="admin-work-reports-card-updated">更新: {updatedAt}</span>
                {item.log_id && (
                  <span className="admin-work-reports-card-link" style={{ marginTop: 8, display: 'block' }}>
                    <Link to={`/office/work-reports/${item.log_id}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                      個別ページを開く
                    </Link>
                  </span>
                )}
              </button>
            );
          })}
      </div>

      {selected && (
        <div
          className="admin-work-reports-modal-backdrop"
          onClick={() => { setSelected(null); setStateChangeError(''); setStateChangeReason(''); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-work-reports-modal-title"
        >
          <div
            className="admin-work-reports-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-work-reports-modal-header">
              <h2 id="admin-work-reports-modal-title">報告詳細</h2>
              <button
                type="button"
                className="admin-work-reports-modal-close"
                onClick={() => { setSelected(null); setStateChangeError(''); setStateChangeReason(''); }}
                aria-label="閉じる"
              >
                ×
              </button>
            </div>
            <div className="admin-work-reports-modal-body">
              <section className="admin-work-reports-modal-meta" aria-label="報告メタ情報">
                <p>
                  <strong>log_id:</strong> {selected.log_id ?? '—'}
                </p>
                <p>
                  <strong>version:</strong> {selected.version ?? '—'}
                </p>
                <p>
                  <strong>state:</strong> {selected.state === 'submitted' ? '提出済み' : selected.state === 'rejected' ? '差し戻し' : selected.state === 'approved' ? '承認済み' : selected.state ?? '—'}
                </p>
                <p>
                  <strong>work_date:</strong>{' '}
                  {selected.work_date || selected.report_date || '—'}
                </p>
                <p>
                  <strong>template_id:</strong> {selected.template_id ?? '—'}
                </p>
                <p>
                  <strong>提出者:</strong> {submitterLabel(selected)}
                </p>
                <p>
                  <strong>店舗:</strong> {selected.target_label ?? '—'}
                </p>
                <p>
                  <strong>時間:</strong>{' '}
                  {selected.work_minutes ?? selected.total_minutes ?? '—'}分
                </p>
                <p>
                  <strong>更新日時:</strong> {selected.updated_at ?? '—'}
                </p>
                {selected.log_id && (
                  <p>
                    <strong>個別URL:</strong>{' '}
                    <Link to={`/office/work-reports/${selected.log_id}`} target="_blank" rel="noopener noreferrer">
                      個別ページを開く
                    </Link>
                  </p>
                )}
              </section>
              {selected.template_id && String(selected.template_id).includes('CLEANING') && (() => {
                const desc = safeJsonParse(selected.description);
                const store = desc.store || {};
                const services = Array.isArray(desc.services) ? desc.services : [];
                if (!store.name && !store.note && services.length === 0) return null;
                return (
                  <section className="admin-work-reports-modal-cleaning" aria-label="清掃レポート">
                    <h3 className="admin-work-reports-modal-h3">清掃レポート</h3>
                    {store.name && <p><strong>店舗名:</strong> {store.name}</p>}
                    {store.address && <p><strong>住所:</strong> {store.address}</p>}
                    {store.witness && <p><strong>立会人:</strong> {store.witness}</p>}
                    {(store.work_start_time || store.work_end_time) && (
                      <p><strong>作業時間:</strong> {store.work_start_time || '—'} ～ {store.work_end_time || '—'}</p>
                    )}
                    {store.note && <p><strong>メモ:</strong> {store.note}</p>}
                    {services.length > 0 && (
                      <>
                        <p><strong>サービス内訳:</strong></p>
                        <ul className="admin-work-reports-services">
                          {services.map((sv, i) => (
                            <li key={i}>{sv.name || '—'} {sv.minutes != null ? `${sv.minutes}分` : ''} {sv.memo ? `（${sv.memo}）` : ''}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </section>
                );
              })()}
              <details className="admin-work-reports-details" open>
                <summary>report_data / description（整形表示）</summary>
                <pre className="admin-work-reports-pre">
                  {(() => {
                    const raw = selected.report_data ?? selected.description;
                    const obj = safeJsonParse(raw);
                    return Object.keys(obj).length === 0
                      ? '(空)'
                      : JSON.stringify(obj, null, 2);
                  })()}
                </pre>
              </details>
              {collectAttachmentUrls(selected).length > 0 && (
                <div className="admin-work-reports-attachments">
                  <h3>添付リンク</h3>
                  <ul>
                    {collectAttachmentUrls(selected).map((a, i) => (
                      <li key={i}>
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {a.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
