import React, { useEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { normalizeGatewayBase } from '../../shared/api/gatewayBase';
import './admin-request-document.css';

const STORAGE_KEY = 'misogi-v2-admin-request-document-draft';
const FILEBOX_SOUKO_SOURCE = 'admin_filebox';
const FILEBOX_SOUKO_TENPO_ID = 'filebox_company';
const WORKFLOW_INBOX_FOLDER_ID = 'workflow_inbox';
const WORKFLOW_INBOX_FOLDER_NAME = '受信業務依頼';
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

const TEMPLATE_OPTIONS = [
  { value: 'department_request', label: '部署間依頼書' },
  { value: 'estimate_request', label: '見積依頼書' },
  { value: 'contract_review', label: '契約確認依頼書' },
  { value: 'payment_request', label: '支払処理依頼書' },
];

const DEPARTMENT_OPTIONS = [
  '運営本部',
  '組織運営本部',
  '経営管理本部',
  '営業部',
  '清掃事業部',
  '開発部',
  '経理部',
  '人事部',
  'オペレーション部',
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: '低' },
  { value: 'normal', label: '中' },
  { value: 'high', label: '高' },
  { value: 'urgent', label: '緊急' },
];

const RECIPIENT_ALLOWED_SCOPES = ['管理', '事務', '営業', '開発'];

const TEMPLATE_DEFS = {
  department_request: {
    hint: '部署間での依頼・引き継ぎに使う基本テンプレート',
    subjectPrefix: '部署間依頼',
    extraFields: [],
  },
  estimate_request: {
    hint: '見積作成や見積再提出の依頼向けテンプレート',
    subjectPrefix: '見積依頼',
    extraFields: [
      { key: 'target_store', label: '対象店舗/案件', placeholder: '例: ○○店 空調清掃' },
      { key: 'budget_range', label: '想定予算', placeholder: '例: 5万円〜10万円' },
    ],
  },
  contract_review: {
    hint: '契約書レビュー・契約条件確認向けテンプレート',
    subjectPrefix: '契約確認依頼',
    extraFields: [
      { key: 'contract_id', label: '契約ID', placeholder: '例: KEIYAKU#2026-0012' },
      { key: 'counterparty', label: '契約先', placeholder: '例: 株式会社○○' },
    ],
  },
  payment_request: {
    hint: '請求・支払・経費処理向けテンプレート',
    subjectPrefix: '支払処理依頼',
    extraFields: [
      { key: 'invoice_no', label: '請求書番号', placeholder: '例: INV-2026-0101' },
      { key: 'amount', label: '金額', placeholder: '例: 123000' },
    ],
  },
};

function isLocalUiHost() {
  if (typeof window === 'undefined') return false;
  const h = String(window.location?.hostname || '').toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
}

const MASTER_API_BASE = (import.meta.env?.DEV || isLocalUiHost())
  ? '/api-master'
  : normalizeGatewayBase(import.meta.env?.VITE_MASTER_API_BASE, 'https://jtn6in2iuj.execute-api.ap-northeast-1.amazonaws.com/prod');
const JINZAI_API_BASE = (import.meta.env?.DEV || isLocalUiHost())
  ? '/api-jinzai'
  : normalizeGatewayBase(import.meta.env?.VITE_JINZAI_API_BASE, 'https://ho3cd7ibtl.execute-api.ap-northeast-1.amazonaws.com/prod');

function authHeaders() {
  const legacyAuth = (() => {
    try {
      return JSON.parse(localStorage.getItem('misesapo_auth') || '{}')?.token || '';
    } catch {
      return '';
    }
  })();
  const token = localStorage.getItem('idToken')
    || localStorage.getItem('cognito_id_token')
    || localStorage.getItem('id_token')
    || localStorage.getItem('accessToken')
    || localStorage.getItem('cognito_access_token')
    || localStorage.getItem('token')
    || legacyAuth
    || '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function todayYmd() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function nowStamp() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
    String(d.getHours()).padStart(2, '0'),
    String(d.getMinutes()).padStart(2, '0'),
    String(d.getSeconds()).padStart(2, '0'),
  ].join('');
}

function normalizeOwnerKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function sanitizeFileToken(value) {
  return String(value || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, ' ')
    .slice(0, 60);
}

function asItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function mergeAttachmentRefs(current, appended) {
  const base = String(current || '').trim();
  const next = String(appended || '').trim();
  if (!next) return base;
  if (!base) return next;
  return `${base}\n${next}`;
}

function addDaysYmd(base, days) {
  const m = String(base || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() + Number(days || 0));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function emptyDraft() {
  const today = todayYmd();
  return {
    template: 'department_request',
    title: '',
    requester_dept: '営業部',
    requester_name: '',
    receiver_jinzai_id: '',
    receiver_dept: '経理部',
    receiver_name: '',
    due_date: addDaysYmd(today, 3),
    priority: 'normal',
    purpose: '',
    request_detail: '',
    deliverables: '',
    attachment_refs: '',
    note: '',
    target_store: '',
    budget_range: '',
    contract_id: '',
    counterparty: '',
    invoice_no: '',
    amount: '',
  };
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDraft();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return emptyDraft();
    return { ...emptyDraft(), ...parsed };
  } catch {
    return emptyDraft();
  }
}

function formatPriority(value) {
  const found = PRIORITY_OPTIONS.find((x) => x.value === value);
  return found ? found.label : '-';
}

function formatYmdJa(ymd) {
  const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '-';
  return `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日`;
}

function splitParagraphs(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeRecipientScope(value) {
  const s = String(value || '').trim().toLowerCase();
  if (!s) return '';
  if (s.includes('開発') || s.includes('dev')) return '開発';
  if (s.includes('営業') || s.includes('sales')) return '営業';
  if (
    s.includes('事務')
    || s.includes('経理')
    || s.includes('人事')
    || s.includes('総務')
    || s.includes('office')
    || s.includes('backoffice')
    || s.includes('バックオフィス')
  ) return '事務';
  if (
    s.includes('管理')
    || s.includes('admin')
    || s.includes('運営本部')
    || s.includes('組織運営本部')
    || s.includes('経営管理本部')
  ) return '管理';
  return '';
}

function resolveRecipientScope(row, deptText) {
  const candidates = [
    deptText,
    row?.role,
    row?.group,
    row?.section,
    row?.job_type,
    row?.shokushu_name,
    row?.shokushu,
  ];
  for (const candidate of candidates) {
    const scope = normalizeRecipientScope(candidate);
    if (scope) return scope;
  }
  return '';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildPrintHtml(preview) {
  const paragraphs = (preview?.paragraphs || [])
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('');

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>依頼書</title>
  <style>
    @page { size: A4 portrait; margin: 0; }
    html, body { margin: 0; padding: 0; background: #ececec; color: #1a1a1a; }
    body { font-family: "Yu Mincho", "Hiragino Mincho ProN", "MS PMincho", serif; }
    .paper {
      width: 210mm;
      min-height: 297mm;
      margin: 10mm auto;
      border: 1px solid #d5d5d5;
      background: #fff;
      box-sizing: border-box;
      padding: 15mm 18mm 18mm;
    }
    .line-top { height: 1px; background: #bfbfbf; margin: 0 0 8mm; }
    .title {
      text-align: center;
      font-size: 11pt;
      letter-spacing: 0.08em;
      margin: 0;
    }
    .line-title { height: 1.6px; background: #9d9d9d; margin: 8mm 0 14mm; }
    .meta {
      display: flex;
      justify-content: space-between;
      gap: 12mm;
      min-height: 38mm;
      margin-bottom: 8mm;
    }
    .meta .left { white-space: pre-line; line-height: 1.9; font-size: 10.5pt; padding-top: 10mm; }
    .meta .right { min-width: 60mm; text-align: right; line-height: 1.8; font-size: 10.5pt; }
    .meta .sender { margin-top: 12mm; white-space: pre-line; }
    .subject {
      text-align: center;
      margin: 2mm 0 10mm;
      line-height: 1.8;
    }
    .subject .label { font-size: 10.5pt; }
    .subject .text { font-size: 11pt; min-height: 1.8em; }
    .body { margin-top: 8mm; }
    .body p {
      margin: 0 0 3.5mm;
      line-height: 1.9;
      font-size: 10.5pt;
      word-break: break-word;
      white-space: pre-wrap;
    }
    .closing {
      margin-top: 10mm;
      text-align: right;
      font-size: 10.5pt;
      letter-spacing: 0.03em;
    }
    @media print {
      html, body { background: #fff; width: 210mm; height: 297mm; }
      .paper {
        width: 210mm;
        min-height: 297mm;
        margin: 0;
        border: none;
        box-shadow: none;
        break-after: page;
      }
    }
  </style>
</head>
<body>
  <main class="paper">
    <div class="line-top"></div>
    <h1 class="title">依頼書</h1>
    <div class="line-title"></div>
    <section class="meta">
      <div class="left">${escapeHtml(preview?.receiverDept || '（依頼先未設定）')}<br/>${escapeHtml(preview?.receiverName || 'ご担当者様')}</div>
      <div class="right">
        <div>${escapeHtml(preview?.issueDate || '-')}</div>
        <div class="sender">${escapeHtml(preview?.senderDept || '（依頼元未設定）')}<br/>${escapeHtml(preview?.senderName || '（氏名未入力）')}</div>
      </div>
    </section>
    <section class="subject">
      <div class="label">件名</div>
      <div class="text">${escapeHtml(preview?.subject || '（件名未入力）')}</div>
    </section>
    <section class="body">${paragraphs}</section>
    <div class="closing">敬具</div>
  </main>
</body>
</html>`;
}

export default function AdminRequestDocumentPage() {
  const [form, setForm] = useState(() => loadDraft());
  const [recipientOptions, setRecipientOptions] = useState([]);
  const [recipientLoading, setRecipientLoading] = useState(false);
  const [recipientError, setRecipientError] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadMessage, setUploadMessage] = useState('');
  const fileInputRef = useRef(null);
  const previewPaperRef = useRef(null);
  const template = TEMPLATE_DEFS[form.template] || TEMPLATE_DEFS.department_request;
  const templateLabel = TEMPLATE_OPTIONS.find((x) => x.value === form.template)?.label || '-';

  const preview = useMemo(() => {
    const subject = String(form.title || '').trim() || `${template.subjectPrefix}（未入力）`;
    const issueDate = formatYmdJa(todayYmd());
    const dueDate = formatYmdJa(form.due_date);

    const paragraphs = [];
    paragraphs.push('拝啓');
    paragraphs.push('平素より大変お世話になっております。');
    paragraphs.push('下記の件につきまして、ご対応をお願い申し上げます。');
    paragraphs.push(`【依頼目的】${String(form.purpose || '').trim() || '（未入力）'}`);

    const detailLines = splitParagraphs(form.request_detail);
    if (detailLines.length) {
      paragraphs.push('【依頼内容】');
      for (const line of detailLines) {
        paragraphs.push(`・${line}`);
      }
    } else {
      paragraphs.push('【依頼内容】（未入力）');
    }

    paragraphs.push(`【希望期限】${dueDate}`);
    paragraphs.push(`【優先度】${formatPriority(form.priority)}`);

    for (const extra of template.extraFields || []) {
      paragraphs.push(`【${extra.label}】${String(form[extra.key] || '').trim() || '（未入力）'}`);
    }

    if (String(form.deliverables || '').trim()) {
      paragraphs.push(`【成果物・完了条件】${String(form.deliverables || '').trim()}`);
    }
    if (String(form.attachment_refs || '').trim()) {
      paragraphs.push(`【添付/参照】${String(form.attachment_refs || '').trim()}`);
    }
    if (String(form.note || '').trim()) {
      paragraphs.push(`【備考】${String(form.note || '').trim()}`);
    }

    return {
      issueDate,
      receiverDept: String(form.receiver_dept || '').trim() || '（依頼先未設定）',
      receiverName: String(form.receiver_name || '').trim() || 'ご担当者様',
      senderDept: String(form.requester_dept || '').trim() || '（依頼元未設定）',
      senderName: String(form.requester_name || '').trim() || '（氏名未入力）',
      subject,
      paragraphs,
      templateLabel,
    };
  }, [form, template, templateLabel]);

  const requiredMissing = useMemo(() => {
    const required = ['title', 'requester_dept', 'receiver_dept', 'receiver_jinzai_id', 'due_date', 'purpose', 'request_detail'];
    return required.filter((k) => !String(form[k] || '').trim());
  }, [form]);

  const saveDraft = (next) => {
    setForm(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  };

  const update = (key, value) => {
    saveDraft({ ...form, [key]: value });
  };

  useEffect(() => {
    let cancelled = false;
    const loadRecipients = async () => {
      setRecipientLoading(true);
      setRecipientError('');
      try {
        const base = JINZAI_API_BASE.replace(/\/$/, '');
        const res = await fetch(`${base}/jinzai?limit=2000&jotai=yuko`, {
          headers: {
            ...authHeaders(),
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`担当者一覧取得失敗: HTTP ${res.status}${txt ? ` ${txt}` : ''}`);
        }
        const rows = asItems(await res.json());
        const options = rows
          .map((row) => {
            const id = String(row?.jinzai_id || row?.id || '').trim();
            const name = String(row?.name || row?.display_name || row?.jinzai_name || '').trim();
            if (!id || !name) return null;
            const dept = String(
              row?.busho_name
              || row?.busho
              || row?.department
              || row?.dept
              || ''
            ).trim();
            const scope = resolveRecipientScope(row, dept);
            if (!RECIPIENT_ALLOWED_SCOPES.includes(scope)) return null;
            return {
              id,
              name,
              dept,
              scope,
              label: dept ? `${name}（${scope} / ${dept}）` : `${name}（${scope}）`,
            };
          })
          .filter(Boolean)
          .sort((a, b) => String(a.label).localeCompare(String(b.label), 'ja'));
        if (!cancelled) {
          setRecipientOptions(options);
          if (options.length === 0) {
            setRecipientError('依頼先担当者が見つかりません（管理/事務/営業/開発のみ表示）。');
          }
        }
      } catch (e) {
        if (!cancelled) {
          setRecipientOptions([]);
          setRecipientError(String(e?.message || e || '担当者一覧の取得に失敗しました'));
        }
      } finally {
        if (!cancelled) setRecipientLoading(false);
      }
    };
    loadRecipients();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!form.receiver_jinzai_id) return;
    const exists = recipientOptions.some((row) => row.id === form.receiver_jinzai_id);
    if (exists) return;
    saveDraft({
      ...form,
      receiver_jinzai_id: '',
      receiver_name: '',
    });
  }, [form, recipientOptions]);

  const onReceiverChange = (nextId) => {
    const selected = recipientOptions.find((row) => row.id === nextId) || null;
    saveDraft({
      ...form,
      receiver_jinzai_id: nextId,
      receiver_name: selected?.name || '',
      receiver_dept: selected?.dept || form.receiver_dept || '',
    });
  };

  const onSave = () => {
    saveDraft({ ...form });
    setUploadError('');
    setUploadMessage('保存しました');
  };

  const onTemplateChange = (nextTemplate) => {
    const next = {
      ...form,
      template: nextTemplate,
      title: String(form.title || '').trim() ? form.title : `${(TEMPLATE_DEFS[nextTemplate] || template).subjectPrefix}：`,
    };
    saveDraft(next);
  };

  const onSelectFiles = () => {
    if (sending) return;
    fileInputRef.current?.click();
  };

  const onPickFiles = (e) => {
    const files = Array.from(e?.target?.files || []);
    if (!files.length) return;
    const next = [...selectedFiles];
    const rejected = [];
    files.forEach((file) => {
      if (Number(file.size || 0) > MAX_UPLOAD_BYTES) {
        rejected.push(file.name);
        return;
      }
      const exists = next.some(
        (row) => row.name === file.name && row.size === file.size && row.lastModified === file.lastModified
      );
      if (!exists) next.push(file);
    });
    if (rejected.length) {
      setUploadError(`15MB超過で追加できないファイルがあります: ${rejected.join(', ')}`);
    } else {
      setUploadError('');
    }
    setUploadMessage('');
    setSelectedFiles(next);
    if (e?.target) e.target.value = '';
  };

  const onRemoveSelectedFile = (idx) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const uploadFilesToRecipientStorage = async (files) => {
    const actorName = String(form.requester_name || '').trim() || '管理者';
    const actorId = actorName;
    const ownerName = String(form.receiver_name || '').trim();
    const ownerDept = String(form.receiver_dept || '').trim();
    const ownerKey = normalizeOwnerKey(ownerName || form.receiver_jinzai_id || ownerDept);
    if (!ownerKey) {
      throw new Error('依頼先担当者を選択してください');
    }
    const base = MASTER_API_BASE.replace(/\/$/, '');
    const folderId = WORKFLOW_INBOX_FOLDER_ID;
    const folderName = WORKFLOW_INBOX_FOLDER_NAME;

    const listQs = new URLSearchParams({
      limit: '20',
      jotai: 'yuko',
      tenpo_id: FILEBOX_SOUKO_TENPO_ID,
      source: FILEBOX_SOUKO_SOURCE,
      folder_id: folderId,
      owner_key: ownerKey,
    });
    const listRes = await fetch(`${base}/master/souko?${listQs.toString()}`, {
      headers: {
        ...authHeaders(),
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });
    if (!listRes.ok) {
      const txt = await listRes.text();
      throw new Error(`送信先フォルダ確認失敗: HTTP ${listRes.status}${txt ? ` ${txt}` : ''}`);
    }
    const existingRows = asItems(await listRes.json());
    const folderRecord = existingRows
      .slice()
      .sort((a, b) => Date.parse(String(b?.updated_at || b?.created_at || 0)) - Date.parse(String(a?.updated_at || a?.created_at || 0)))[0]
      || null;
    const targetFolder = folderRecord || await (async () => {
      const createRes = await fetch(`${base}/master/souko`, {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenpo_id: FILEBOX_SOUKO_TENPO_ID,
          source: FILEBOX_SOUKO_SOURCE,
          folder_id: folderId,
          folder_name: folderName,
          name: `${folderName} フォルダ`,
          uploaded_by: actorId,
          uploaded_by_name: actorName,
          owner_name: ownerName,
          owner_key: ownerKey,
          owner_dept: ownerDept,
          files: [],
          jotai: 'yuko',
        }),
      });
      if (!createRes.ok) {
        const txt = await createRes.text();
        throw new Error(`送信先フォルダ作成失敗: HTTP ${createRes.status}${txt ? ` ${txt}` : ''}`);
      }
      return createRes.json();
    })();

    const soukoId = String(targetFolder?.souko_id || '').trim();
    if (!soukoId) {
      throw new Error('送信先フォルダ応答に souko_id がありません');
    }

    const existingFiles = Array.isArray(targetFolder?.files) ? targetFolder.files : [];
    const uploadedFiles = [];
    for (const file of files) {
      const contentType = String(file.type || 'application/octet-stream');
      const presignRes = await fetch(`${base}/master/souko`, {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: 'presign_upload',
          tenpo_id: FILEBOX_SOUKO_TENPO_ID,
          file_name: file.name,
          content_type: contentType,
        }),
      });
      if (!presignRes.ok) {
        const txt = await presignRes.text();
        throw new Error(`アップロード準備失敗: HTTP ${presignRes.status}${txt ? ` ${txt}` : ''}`);
      }
      const presign = await presignRes.json();
      const putUrl = String(presign?.put_url || '');
      if (!putUrl) throw new Error('presign応答に put_url がありません');
      const putRes = await fetch(putUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: file,
      });
      if (!putRes.ok) {
        throw new Error(`アップロード失敗: HTTP ${putRes.status} (${file.name})`);
      }
      uploadedFiles.push({
        key: String(presign?.key || ''),
        file_name: String(file.name || 'file'),
        content_type: contentType,
        size: Number(file.size || 0),
        uploaded_at: new Date().toISOString(),
        uploaded_by: actorId,
        uploaded_by_name: actorName,
        preview_url: String(presign?.get_url || ''),
      });
    }

    const nextFiles = [...existingFiles, ...uploadedFiles];
    const updateRes = await fetch(`${base}/master/souko/${encodeURIComponent(soukoId)}`, {
      method: 'PUT',
      headers: {
        ...authHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...targetFolder,
        tenpo_id: String(targetFolder?.tenpo_id || FILEBOX_SOUKO_TENPO_ID),
        source: FILEBOX_SOUKO_SOURCE,
        folder_id: folderId,
        folder_name: folderName,
        name: String(targetFolder?.name || `${folderName} フォルダ`),
        uploaded_by: actorId,
        uploaded_by_name: actorName,
        owner_name: ownerName,
        owner_key: ownerKey,
        owner_dept: ownerDept,
        files: nextFiles,
      }),
    });
    if (!updateRes.ok) {
      const txt = await updateRes.text();
      throw new Error(`送信ファイル保存失敗: HTTP ${updateRes.status}${txt ? ` ${txt}` : ''}`);
    }
    await updateRes.json();

    const names = uploadedFiles.map((row) => row.file_name).filter(Boolean).join(', ');
    return {
      count: uploadedFiles.length,
      refText: [
        `マイストレージ: ${folderName} (${uploadedFiles.length}件)`,
        `souko_id=${soukoId}`,
        `folder_id=${folderId}`,
        names ? `files=${names}` : '',
        'open=/admin/filebox',
      ].filter(Boolean).join('\n'),
    };
  };

  const buildPdfFileFromPreview = async () => {
    const paper = previewPaperRef.current;
    if (!paper) throw new Error('PDFプレビューの描画対象が見つかりません');
    const canvas = await html2canvas(paper, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    });
    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgProps = pdf.getImageProperties(imgData);
    const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

    let position = 0;
    let heightLeft = imgHeight;
    pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
    heightLeft -= pdfHeight;
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;
    }
    const pdfBlob = pdf.output('blob');
    const subjectToken = sanitizeFileToken(String(form.title || '').trim()) || '依頼書';
    const stamp = nowStamp();
    return new File([pdfBlob], `${stamp}_${subjectToken}.pdf`, { type: 'application/pdf' });
  };

  const onSend = async () => {
    if (sending) return;
    setUploadError('');
    setUploadMessage('');
    if (requiredMissing.length) {
      setUploadError(`未入力項目があります: ${requiredMissing.join(', ')}`);
      return;
    }
    setSending(true);
    try {
      const pdfFile = await buildPdfFileFromPreview();
      const files = [pdfFile, ...selectedFiles];
      const uploaded = await uploadFilesToRecipientStorage(files);
      const next = {
        ...form,
        attachment_refs: mergeAttachmentRefs(form.attachment_refs, uploaded.refText),
      };
      saveDraft(next);
      setSelectedFiles([]);
      const attachmentCount = Math.max(0, uploaded.count - 1);
      setUploadMessage(`送信しました（PDF + 添付${attachmentCount}件）。依頼先のマイストレージに保存済みです。`);
    } catch (e) {
      setUploadError(String(e?.message || e || '送信に失敗しました'));
    } finally {
      setSending(false);
    }
  };

  const openPdfWindow = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('印刷ウィンドウを開けませんでした。ポップアップ許可を確認してください。');
      return;
    }
    const html = buildPrintHtml(preview);
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
  };

  const onPreviewPdf = () => {
    openPdfWindow();
  };

  return (
    <div className="admin-request-doc-page">
      <div className="admin-request-doc-content">
        <header className="admin-request-doc-head">
          <h1>依頼書作成</h1>
          <p>保存と送信だけで運用できる依頼書テンプレートです。送信時にPDFを生成し、依頼先のマイストレージへ保存します。</p>
        </header>

        <div className="admin-request-doc-grid">
          <section className="admin-request-doc-panel">
            <h2>テンプレート入力</h2>
            <div className="admin-request-doc-form">
              <label>
                テンプレート
                <select value={form.template} onChange={(e) => onTemplateChange(e.target.value)}>
                  {TEMPLATE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>

              <div className="admin-request-doc-hint">{template.hint}</div>

              <label>
                件名
                <input
                  value={form.title}
                  onChange={(e) => update('title', e.target.value)}
                  placeholder={`${template.subjectPrefix}：`}
                  maxLength={80}
                />
              </label>

              <div className="admin-request-doc-two-col">
                <label>
                  依頼元部署
                  <select value={form.requester_dept} onChange={(e) => update('requester_dept', e.target.value)}>
                    {DEPARTMENT_OPTIONS.map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </label>
                <label>
                  依頼先部署
                  <select value={form.receiver_dept} onChange={(e) => update('receiver_dept', e.target.value)}>
                    {DEPARTMENT_OPTIONS.map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </label>
              </div>

              <div className="admin-request-doc-two-col">
                <label>
                  依頼者名
                  <input
                    value={form.requester_name}
                    onChange={(e) => update('requester_name', e.target.value)}
                    placeholder="例: 桜田"
                    maxLength={40}
                  />
                </label>
                <label>
                  依頼先担当者
                  <select
                    value={form.receiver_jinzai_id || ''}
                    onChange={(e) => onReceiverChange(e.target.value)}
                    disabled={recipientLoading}
                  >
                    <option value="">{recipientLoading ? '担当者読込中...' : '選択してください（管理/事務/営業/開発）'}</option>
                    {recipientOptions.map((row) => (
                      <option key={row.id} value={row.id}>{row.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              {recipientError ? <div className="admin-request-doc-meta">{recipientError}</div> : null}

              <div className="admin-request-doc-two-col">
                <label>
                  希望期限
                  <input type="date" value={form.due_date} onChange={(e) => update('due_date', e.target.value)} />
                </label>
              </div>

              <label>
                優先度
                <select value={form.priority} onChange={(e) => update('priority', e.target.value)}>
                  {PRIORITY_OPTIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                </select>
              </label>

              {(template.extraFields || []).map((field) => (
                <label key={field.key}>
                  {field.label}
                  <input
                    value={form[field.key] || ''}
                    onChange={(e) => update(field.key, e.target.value)}
                    placeholder={field.placeholder || ''}
                    maxLength={120}
                  />
                </label>
              ))}

              <label>
                依頼目的
                <textarea
                  value={form.purpose}
                  onChange={(e) => update('purpose', e.target.value)}
                  placeholder="何のための依頼かを簡潔に記載"
                  rows={3}
                  maxLength={300}
                />
              </label>

              <label>
                依頼内容
                <textarea
                  value={form.request_detail}
                  onChange={(e) => update('request_detail', e.target.value)}
                  placeholder="対応してほしい内容を箇条書きで記載"
                  rows={5}
                  maxLength={800}
                />
              </label>

              <label>
                成果物・完了条件
                <textarea
                  value={form.deliverables}
                  onChange={(e) => update('deliverables', e.target.value)}
                  placeholder="何をもって完了とするか"
                  rows={3}
                  maxLength={300}
                />
              </label>

              <label>
                添付/参照ファイル
                <input
                  value={form.attachment_refs}
                  onChange={(e) => update('attachment_refs', e.target.value)}
                  placeholder="例: souko://workflow/req-001, /admin/filebox（マイストレージ）"
                  maxLength={220}
                />
              </label>

              <div className="admin-request-doc-upload-box">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={onPickFiles}
                  style={{ display: 'none' }}
                />
                <div className="admin-request-doc-upload-head">
                  <button type="button" className="ghost" onClick={onSelectFiles} disabled={sending}>
                    添付ファイルを選択
                  </button>
                  <span>選択中: {selectedFiles.length}件（1件15MBまで）</span>
                </div>
                {selectedFiles.length ? (
                  <ul className="admin-request-doc-file-list">
                    {selectedFiles.map((file, idx) => (
                      <li key={`${file.name}-${file.size}-${file.lastModified}`}>
                        <span>{file.name} ({Math.ceil(file.size / 1024)}KB)</span>
                        <button type="button" className="ghost" onClick={() => onRemoveSelectedFile(idx)} disabled={sending}>
                          削除
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <label>
                備考
                <textarea
                  value={form.note}
                  onChange={(e) => update('note', e.target.value)}
                  placeholder="補足があれば記載"
                  rows={2}
                  maxLength={240}
                />
              </label>
            </div>

            <div className="admin-request-doc-actions">
              <button type="button" className="ghost" onClick={onSave} disabled={sending}>保存</button>
              <button type="button" onClick={onSend} disabled={sending}>
                {sending ? '送信中...' : '送信'}
              </button>
            </div>
            <div className="admin-request-doc-meta">
              {uploadError
                ? uploadError
                : uploadMessage || '入力内容はこの端末のブラウザに自動保存されます。'}
            </div>
          </section>

          <section className="admin-request-doc-panel">
            <div className="admin-request-doc-preview-head">
              <h2>プレビュー</h2>
              <button type="button" className="preview-pdf-btn" onClick={onPreviewPdf}>PDFプレビュー</button>
            </div>
            <div className="admin-request-doc-validation">
              {requiredMissing.length
                ? `未入力: ${requiredMissing.join(', ')}`
                : '必須項目は入力済みです。'}
            </div>
            <div className="admin-request-doc-preview-wrap">
              <article ref={previewPaperRef} className="admin-request-doc-preview-paper">
                <div className="doc-letter-line-top" />
                <header className="doc-letter-head">
                  <h3>依頼書</h3>
                </header>
                <div className="doc-letter-line-title" />
                <section className="doc-letter-meta">
                  <div className="doc-letter-recipient">
                    <p>{preview.receiverDept}</p>
                    <p>{preview.receiverName}</p>
                  </div>
                  <div className="doc-letter-sender-wrap">
                    <p className="doc-letter-date">{preview.issueDate}</p>
                    <div className="doc-letter-sender">
                      <p>{preview.senderDept}</p>
                      <p>{preview.senderName}</p>
                    </div>
                  </div>
                </section>
                <section className="doc-letter-subject">
                  <p>件名</p>
                  <p className="subject-text">{preview.subject}</p>
                </section>
                <section className="doc-letter-body">
                  {preview.paragraphs.map((line, idx) => (
                    <p key={`line-${idx}`}>{line}</p>
                  ))}
                </section>
                <div className="doc-letter-closing">敬具</div>
              </article>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
