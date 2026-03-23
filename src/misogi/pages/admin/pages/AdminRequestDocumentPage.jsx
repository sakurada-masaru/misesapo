import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { normalizeGatewayBase } from '../../shared/api/gatewayBase';
import companyLogoWide from '../../../../assets/images-material/footer-logo.jpg';
import companyLogoSquare from '../../../../assets/images-material/logo_ver1-pk.png';
import companyLogoIcon from '../../../../assets/images-material/logo_144x144.png';
import './admin-request-document.css';

const STORAGE_KEY = 'misogi-v2-admin-request-document-draft';
const FILEBOX_SOUKO_SOURCE = 'admin_filebox';
const FILEBOX_SOUKO_TENPO_ID = 'filebox_company';
const WORKFLOW_INBOX_FOLDER_ID = 'workflow_inbox';
const WORKFLOW_INBOX_FOLDER_NAME = '受信業務依頼';
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

const COMPANY_INFO = {
  name: '株式会社ミセサポ',
  postal: '〒103-0025',
  address1: '東京都中央区日本橋茅場町1-8-1',
  address2: '茅場町一丁目平和ビル7F',
  tel: '070-3332-3939',
  email: 'info@misesapo.co.jp',
  website: 'https://misesapo.co.jp/',
};

const COMPANY_LOGO_OPTIONS = [
  { value: 'wide', label: '横長ロゴ' },
  { value: 'square', label: '正方形ロゴ' },
  { value: 'icon', label: 'アイコンロゴ' },
];

const TEMPLATE_OPTIONS = [
  { value: 'department_request', label: '部署間依頼書' },
  { value: 'estimate_request', label: '見積書' },
  { value: 'contract_review', label: '契約書' },
  { value: 'payment_request', label: '請求書' },
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

const BASE_REQUIRED_FIELDS = ['title', 'requester_dept', 'receiver_dept', 'receiver_jinzai_id', 'due_date', 'purpose', 'request_detail'];
const ESTIMATE_INVOICE_REQUIRED_FIELDS = ['title', 'requester_dept', 'receiver_dept', 'receiver_jinzai_id', 'due_date', 'purpose'];
const PAYMENT_REQUIRED_FIELDS = ['title', 'due_date', 'purpose'];

const FIELD_LABELS = {
  title: '件名',
  requester_dept: '依頼元部署',
  receiver_dept: '依頼先部署',
  requester_name: '依頼者名',
  receiver_jinzai_id: '依頼先担当者',
  due_date: '希望期限',
  priority: '優先度',
  purpose: '依頼目的',
  request_detail: '依頼内容',
  deliverables: '成果物・完了条件',
  attachment_refs: '添付/参照ファイル',
  note: '備考',
  target_store: '対象店舗/案件',
  budget_range: '想定予算',
  contract_id: '契約ID',
  counterparty: '契約先',
  contract_term_start: '契約開始日',
  contract_term_end: '契約終了日',
  contract_amount: '契約金額',
  invoice_no: '請求書番号',
  amount: '金額',
  estimate_no: '見積書番号',
  tax_rate: '税率(%)',
  payment_terms: '支払条件',
  client_company: '請求取引先',
  client_name: '請求先担当者名',
  client_address: '請求先住所',
  bank_info: '振込先',
  invoice_torihikisaki_id: '請求取引先',
};

const RECIPIENT_ALLOWED_SCOPES = ['管理', '事務', '営業', '開発'];

const TEMPLATE_DEFS = {
  department_request: {
    hint: '部署間での依頼・引き継ぎに使う基本テンプレート',
    docTitle: '依頼書',
    subjectPrefix: '部署間依頼',
    requiredExtraFields: [],
    showPriority: true,
    showRequestDetail: true,
    showDeliverables: true,
    showAttachmentRefs: true,
    showNote: true,
    dueDateLabel: '希望期限',
    purposeLabel: '依頼目的',
    requestDetailLabel: '依頼内容',
    deliverablesLabel: '成果物・完了条件',
    purposePlaceholder: '何のための依頼かを簡潔に記載',
    requestDetailPlaceholder: '対応してほしい内容を箇条書きで記載',
    deliverablesPlaceholder: '何をもって完了とするか',
    extraFields: [],
  },
  estimate_request: {
    hint: '顧客向け見積書を作成するテンプレート',
    docTitle: '見積書',
    docSubtitle: '（御見積書）',
    subjectPrefix: '見積書',
    requiredExtraFields: ['estimate_no', 'target_store'],
    showPriority: false,
    showRequestDetail: false,
    showDeliverables: false,
    showAttachmentRefs: true,
    showNote: true,
    dueDateLabel: '見積有効期限',
    purposeLabel: '見積概要',
    requestDetailLabel: '見積明細',
    purposePlaceholder: '見積対象・背景を記載',
    requestDetailPlaceholder: '明細概要（補足）を記載',
    fieldLabelOverrides: {
      title: '見積件名',
      due_date: '見積有効期限',
      requester_dept: '発行部署',
      receiver_dept: '宛先部署',
      requester_name: '発行担当者',
      receiver_jinzai_id: '宛先担当者',
      purpose: '見積概要',
      request_detail: '見積明細',
      estimate_no: '見積書番号',
      tax_rate: '税率(%)',
      payment_terms: '支払条件',
    },
    extraFields: [
      { key: 'estimate_no', label: '見積書番号', placeholder: '例: EST-2026-0101' },
      { key: 'target_store', label: '対象店舗/案件', placeholder: '例: ○○店 空調清掃' },
      { key: 'payment_terms', label: '支払条件', placeholder: '例: 月末締め翌月末払い' },
      { key: 'tax_rate', label: '税率(%)', placeholder: '例: 10' },
    ],
  },
  contract_review: {
    hint: '契約書作成向けテンプレート',
    docTitle: '契約書',
    docSubtitle: '（業務委託契約書）',
    subjectPrefix: '契約書',
    requiredExtraFields: ['counterparty', 'contract_term_start', 'contract_term_end'],
    showPriority: false,
    showRequestDetail: true,
    showDeliverables: true,
    showAttachmentRefs: true,
    showNote: true,
    dueDateLabel: '締結希望日',
    purposeLabel: '契約趣旨',
    requestDetailLabel: '条項（ドラフト）',
    deliverablesLabel: '納品・検収条件',
    purposePlaceholder: '契約の目的・背景を記載',
    requestDetailPlaceholder: '条項案を1行ずつ入力（プレビューで箇条書き化）',
    deliverablesPlaceholder: '納品物・検収条件を記載',
    fieldLabelOverrides: {
      title: '契約件名',
      due_date: '締結希望日',
      purpose: '契約趣旨',
      request_detail: '条項（ドラフト）',
      deliverables: '納品・検収条件',
      counterparty: '契約先',
      contract_id: '契約番号',
      contract_term_start: '契約開始日',
      contract_term_end: '契約終了日',
      contract_amount: '契約金額',
      payment_terms: '支払条件',
    },
    extraFields: [
      { key: 'contract_id', label: '契約番号', placeholder: '例: KEIYAKU#2026-0012' },
      { key: 'counterparty', label: '契約先', placeholder: '例: 株式会社○○' },
      { key: 'contract_term_start', label: '契約開始日', placeholder: '例: 2026-04-01' },
      { key: 'contract_term_end', label: '契約終了日', placeholder: '例: 2027-03-31' },
      { key: 'contract_amount', label: '契約金額', placeholder: '例: 1200000' },
      { key: 'payment_terms', label: '支払条件', placeholder: '例: 月末締め翌月末払い' },
    ],
  },
  payment_request: {
    hint: '請求書作成向けテンプレート',
    docTitle: '請求書',
    docSubtitle: '（請求明細書）',
    subjectPrefix: '請求書',
    requiredExtraFields: ['invoice_no'],
    showPriority: false,
    showRequestDetail: false,
    showDeliverables: false,
    showAttachmentRefs: true,
    showNote: true,
    dueDateLabel: 'お支払期限',
    purposeLabel: '請求概要',
    requestDetailLabel: 'ご請求内容',
    purposePlaceholder: '請求の概要を記載',
    requestDetailPlaceholder: '明細内容を1行ずつ入力（プレビューで表形式表示）',
    fieldLabelOverrides: {
      title: '請求件名',
      due_date: 'お支払期限',
      requester_dept: '発行部署',
      receiver_dept: '宛先部署',
      requester_name: '発行担当者',
      receiver_jinzai_id: '宛先担当者',
      purpose: '請求概要',
      request_detail: 'ご請求内容',
      invoice_no: '請求書番号',
      amount: 'ご請求金額',
      tax_rate: '税率(%)',
      payment_terms: '支払条件',
      client_company: '請求取引先',
      client_name: '請求先担当者名',
      client_address: '請求先住所',
      bank_info: '振込先',
    },
    extraFields: [
      { key: 'invoice_no', label: '請求書番号', placeholder: '例: INV-2026-0101' },
      { key: 'client_name', label: '請求先担当者名', placeholder: '例: 山田 太郎' },
      { key: 'client_address', label: '請求先住所', placeholder: '例: 東京都新宿区西新宿9-9-9' },
      { key: 'payment_terms', label: '支払条件', placeholder: '例: 月末締め翌月末払い' },
      { key: 'bank_info', label: '振込先', placeholder: '例: ○○銀行 渋谷支店 普通 1234567' },
      { key: 'tax_rate', label: '税率(%)', placeholder: '例: 10' },
    ],
  },
};

function createLineItem(overrides = {}) {
  return {
    id: `li_${Math.random().toString(36).slice(2, 10)}`,
    description: '',
    qty: '1',
    unit_price: '',
    ...overrides,
  };
}

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

function firstFilled(...values) {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
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
    estimate_no: '',
    contract_id: '',
    counterparty: '',
    contract_term_start: '',
    contract_term_end: '',
    contract_amount: '',
    invoice_no: '',
    payment_terms: '',
    tax_rate: '10',
    amount: '',
    client_company: '',
    client_name: '',
    client_address: '',
    invoice_torihikisaki_id: '',
    bank_info: '',
    line_items: [createLineItem()],
    company_logo_variant: 'wide',
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

function formatCurrencyYen(value) {
  const n = Number(String(value || '').replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(n)) return '¥0';
  return `¥${Math.round(n).toLocaleString('ja-JP')}`;
}

function toNumber(value, fallback = 0) {
  const n = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : fallback;
}

function normalizeLineItems(raw) {
  const rows = Array.isArray(raw) ? raw : [];
  const normalized = rows
    .map((row) => {
      const description = String(row?.description || '').trim();
      const qty = toNumber(row?.qty, 0);
      const unitPrice = toNumber(row?.unit_price, 0);
      return {
        id: String(row?.id || createLineItem().id),
        description,
        qty,
        unitPrice,
        rowTotal: qty * unitPrice,
      };
    })
    .filter((row) => row.description || row.qty > 0 || row.unitPrice > 0);
  return normalized;
}

function addSama(name) {
  const n = String(name || '').trim();
  if (!n) return 'ご担当者様';
  return /様$/.test(n) ? n : `${n} 様`;
}

function asOnchu(name) {
  const n = String(name || '')
    .trim()
    .replace(/\s*(様|御中)$/u, '')
    .trim();
  if (!n) return '';
  return `${n} 御中`;
}

function resolveOnchuRecipientName(name, dept) {
  const primary = asOnchu(name);
  if (primary) return primary;
  const fallback = asOnchu(dept);
  if (fallback) return fallback;
  return 'ご担当者様';
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
  const hasCorporateHeader = preview?.templateKey === 'contract_review'
    || preview?.templateKey === 'payment_request'
    || preview?.templateKey === 'estimate_request';
  const renderPlainLines = (lines, empty = '（未入力）') => {
    const rows = (Array.isArray(lines) ? lines : []).filter(Boolean);
    if (!rows.length) return `<p>${escapeHtml(empty)}</p>`;
    return rows.map((line) => `<p>${escapeHtml(line)}</p>`).join('');
  };

  const renderBullets = (lines, empty = '（未入力）') => {
    const rows = (Array.isArray(lines) ? lines : []).filter(Boolean);
    if (!rows.length) return `<li>${escapeHtml(empty)}</li>`;
    return rows.map((line) => `<li>${escapeHtml(line)}</li>`).join('');
  };

  const renderMetaRows = (rows) => (
    rows
      .map((row) => `<tr><th>${escapeHtml(row?.label || '')}</th><td>${escapeHtml(row?.value || '-')}</td></tr>`)
      .join('')
  );

  const renderAnvilRows = (rows, emptyLabel) => {
    const list = Array.isArray(rows) ? rows : [];
    const printable = list.filter((row) => String(row?.description || '').trim() && Number(row?.qty || 0) > 0);
    const renderQty = (n) => {
      const v = Number(n || 0);
      return Number.isInteger(v) ? String(v) : String(v.toFixed(2));
    };
    const renderMoney = (n) => escapeHtml(formatCurrencyYen(n));
    if (!printable.length) {
      return `<tr><td>1</td><td>${escapeHtml(emptyLabel || '（明細未入力）')}</td><td class="right">${renderMoney(0)}</td><td class="bold right">${renderMoney(0)}</td></tr>`;
    }
    return printable
      .map((row) => `<tr><td>${escapeHtml(renderQty(row.qty))}</td><td>${escapeHtml(row.description)}</td><td class="right">${renderMoney(row.unitPrice)}</td><td class="bold right">${renderMoney(row.rowTotal)}</td></tr>`)
      .join('');
  };

  const renderCompanyBrand = () => `
      <div class="doc-company-brand">
        <div class="doc-company-logo-wrap">
          <img class="doc-company-logo" src="${escapeHtml(preview?.companyLogoSrc || companyLogoWide)}" alt="ミセサポ ロゴ" />
        </div>
        <div class="doc-company-info">
          <p class="name">${escapeHtml(COMPANY_INFO.name)}</p>
          <p>${escapeHtml(COMPANY_INFO.postal)}</p>
          <p>${escapeHtml(COMPANY_INFO.address1)}</p>
          <p>${escapeHtml(COMPANY_INFO.address2)}</p>
          <p>TEL: ${escapeHtml(COMPANY_INFO.tel)}</p>
          <p>Email: ${escapeHtml(COMPANY_INFO.email)}</p>
        </div>
      </div>
  `;

  const renderCompanyHead = (title, subtitle = '', meta = '', recipient = '') => `
    <section class="doc-company-head">
      <div class="doc-company-title">
        <h2>${escapeHtml(title || '')}</h2>
        ${subtitle ? `<p class="doc-company-subtitle">${escapeHtml(subtitle)}</p>` : ''}
        ${meta ? `<p class="doc-company-meta">${escapeHtml(meta)}</p>` : ''}
        ${recipient ? `<p class="doc-company-recipient">${escapeHtml(recipient)}</p>` : ''}
      </div>
      ${renderCompanyBrand()}
    </section>
  `;

  const renderBody = () => {
    if (preview?.templateKey === 'payment_request') {
      return `
    <section class="doc-invoice-title-top">
      <p class="doc-invoice-date-top">発行日&nbsp;&nbsp;${escapeHtml(preview?.issueDate || '-')}</p>
      <h2>${escapeHtml(preview?.docTitle || '請求書')}</h2>
      <p class="doc-company-meta">請求書番号: ${escapeHtml(preview?.invoiceNo || '（未入力）')}</p>
    </section>
    <section class="doc-company-head">
      <div class="doc-company-title">
        <div class="doc-company-recipient-box">
          <p class="doc-company-recipient">${escapeHtml(`${preview?.clientCompany ? `${preview.clientCompany}\n` : ''}${preview?.clientOnchu || 'ご担当者様'}${preview?.clientAddress ? `\n${preview.clientAddress}` : ''}`)}</p>
        </div>
      </div>
      ${renderCompanyBrand()}
    </section>
    <table class="invoice-info-container invoice-meta-table">
      <tr><th>発行部署</th><td><strong>${escapeHtml(preview?.senderDept || '（未設定）')}</strong></td></tr>
      <tr><th>お支払期限</th><td><strong>${escapeHtml(preview?.dueDate || '-')}</strong></td></tr>
    </table>

    <table class="line-items-container">
      <thead>
        <tr>
          <th class="heading-quantity">数量</th>
          <th class="heading-description">内容</th>
          <th class="heading-price">単価</th>
          <th class="heading-subtotal">小計</th>
        </tr>
      </thead>
      <tbody>${renderAnvilRows(preview?.lineItems, '（ご請求内容未入力）')}</tbody>
    </table>

    <table class="line-items-container has-bottom-border">
      <thead>
        <tr>
          <th>請求概要 / 支払条件</th>
          <th>支払期限</th>
          <th>合計請求額</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="payment-info">
            <div>概要: <strong>${escapeHtml(preview?.purpose || '（未入力）')}</strong></div>
            <div>支払条件: <strong>${escapeHtml(preview?.paymentTerms || '（未入力）')}</strong></div>
            <div>税率: <strong>${escapeHtml(String(preview?.taxRate ?? 10))}%</strong></div>
            <div>振込先: <strong>${escapeHtml(preview?.bankInfo || '（未入力）')}</strong></div>
            ${preview?.noteLines?.length ? `<div>備考: <strong>${escapeHtml(preview.noteLines.join(' / '))}</strong></div>` : ''}
          </td>
          <td class="large">${escapeHtml(preview?.dueDate || '-')}</td>
          <td class="large total">${escapeHtml(preview?.amountDisplay || '¥0')}</td>
        </tr>
      </tbody>
    </table>
      `;
    }
    if (preview?.templateKey === 'estimate_request') {
      return `
    <section class="doc-invoice-title-top">
      <h2>${escapeHtml(preview?.docTitle || '見積書')}</h2>
      ${preview?.docSubtitle ? `<p class="doc-company-subtitle">${escapeHtml(preview.docSubtitle)}</p>` : ''}
      <p class="doc-company-meta">見積書番号: ${escapeHtml(preview?.estimateNo || '（未入力）')}</p>
    </section>
    <section class="doc-company-head">
      <div class="doc-company-title">
        <div class="doc-company-recipient-box">
          <p class="doc-company-recipient">${escapeHtml(`${preview?.receiverDept ? `${preview.receiverDept}\n` : ''}${preview?.receiverOnchu || 'ご担当者様'}`)}</p>
        </div>
      </div>
      ${renderCompanyBrand()}
    </section>
    <table class="invoice-info-container invoice-meta-table">
      <tr><th>見積日</th><td><strong>${escapeHtml(preview?.issueDate || '-')}</strong></td></tr>
      <tr><th>発行部署</th><td><strong>${escapeHtml(preview?.senderDept || '（未設定）')}</strong></td></tr>
      <tr><th>有効期限</th><td><strong>${escapeHtml(preview?.dueDate || '-')}</strong></td></tr>
    </table>

    <table class="line-items-container">
      <thead>
        <tr>
          <th class="heading-quantity">数量</th>
          <th class="heading-description">内容</th>
          <th class="heading-price">単価</th>
          <th class="heading-subtotal">小計</th>
        </tr>
      </thead>
      <tbody>${renderAnvilRows(preview?.lineItems, '（見積内容未入力）')}</tbody>
    </table>

    <table class="line-items-container has-bottom-border">
      <thead>
        <tr>
          <th>見積概要 / 支払条件</th>
          <th>有効期限</th>
          <th>見積合計額</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="payment-info">
            <div>概要: <strong>${escapeHtml(preview?.purpose || '（未入力）')}</strong></div>
            <div>対象: <strong>${escapeHtml(preview?.targetStore || '（未入力）')}</strong></div>
            <div>支払条件: <strong>${escapeHtml(preview?.paymentTerms || '（未入力）')}</strong></div>
            <div>税率: <strong>${escapeHtml(String(preview?.taxRate ?? 10))}%</strong></div>
            ${preview?.noteLines?.length ? `<div>備考: <strong>${escapeHtml(preview.noteLines.join(' / '))}</strong></div>` : ''}
          </td>
          <td class="large">${escapeHtml(preview?.dueDate || '-')}</td>
          <td class="large total">${escapeHtml(preview?.amountDisplay || '¥0')}</td>
        </tr>
      </tbody>
    </table>
      `;
    }
    if (preview?.templateKey === 'contract_review') {
      return `
    <section class="doc-contract-title-top">
      <p class="doc-contract-date-top">締結日&nbsp;&nbsp;${escapeHtml(preview?.dueDate || '-')}</p>
      <h2>${escapeHtml(preview?.docTitle || '契約書')}</h2>
      ${preview?.docSubtitle ? `<p class="doc-company-subtitle">${escapeHtml(preview.docSubtitle)}</p>` : ''}
      <p class="doc-company-meta">契約番号: ${escapeHtml(preview?.contractId || '（未入力）')}</p>
    </section>
    <section class="doc-company-head">
      <div class="doc-company-title">
        <div class="doc-company-recipient-box">
          <p class="doc-company-recipient">${escapeHtml(`${preview?.counterparty || '（契約先未入力）'}\n${preview?.receiverOnchu || 'ご担当者様'}`)}</p>
        </div>
      </div>
      ${renderCompanyBrand()}
    </section>
    <section class="doc-contract-top">
      <div class="doc-contract-parties">
        <div><span>${escapeHtml(preview?.contractPartyALabel || '甲（契約先）')}</span><strong>${escapeHtml(preview?.contractPartyAName || '（未入力）')}</strong><p>担当: ${escapeHtml(preview?.contractPartyAContact || '（担当者未入力）')}</p></div>
        <div><span>${escapeHtml(preview?.contractPartyBLabel || '乙（サービス提供者）')}</span><strong>${escapeHtml(preview?.contractPartyBName || '（未入力）')}</strong><p>TEL: ${escapeHtml(preview?.contractPartyBPhone || '（電話未入力）')}</p></div>
      </div>
      <table class="doc-sheet-table"><tbody>
        ${renderMetaRows([
          { label: '契約番号', value: preview?.contractId || '（未入力）' },
          { label: '契約件名', value: preview?.subject || '（件名未入力）' },
          { label: '契約期間', value: `${preview?.contractTermStart || '（未入力）'} 〜 ${preview?.contractTermEnd || '（未入力）'}` },
          { label: '契約金額', value: preview?.contractAmountDisplay || '¥0' },
          { label: '支払条件', value: preview?.paymentTerms || '（未入力）' },
        ])}
      </tbody></table>
    </section>
    <section class="doc-sheet-block">
      <h4>第1条（契約趣旨）</h4>
      ${renderPlainLines([preview?.purpose || '（未入力）'])}
    </section>
    <section class="doc-sheet-block">
      <h4>第2条（条項）</h4>
      <ol>${renderBullets(preview?.detailLines, '（条項未入力）')}</ol>
    </section>
    <section class="doc-sheet-block">
      <h4>第3条（納品・検収条件）</h4>
      ${renderPlainLines(preview?.deliverableLines, '（未入力）')}
    </section>
    <section class="doc-sheet-block">
      <h4>第4条（特記事項）</h4>
      ${renderPlainLines(preview?.noteLines, '（備考なし）')}
    </section>
    <section class="doc-sheet-block">
      <h4>別紙・添付資料</h4>
      ${renderPlainLines(preview?.attachmentLines, '（添付なし）')}
    </section>
    <section class="doc-signature-grid">
      <div class="doc-signature-card">
        <p class="doc-signature-label">${escapeHtml(preview?.contractPartyALabel || '甲（契約先）')}</p>
        <p class="doc-signature-name">${escapeHtml(preview?.contractPartyAName || '（未入力）')}</p>
        <p>住所: ${escapeHtml(preview?.contractPartyAAddress || '（住所未入力）')}</p>
        <p>担当: ${escapeHtml(preview?.contractPartyAContact || '（担当者未入力）')}</p>
        <p>TEL: ${escapeHtml(preview?.contractPartyAPhone || '（電話未入力）')}</p>
        <p>MAIL: ${escapeHtml(preview?.contractPartyAEmail || '（メール未入力）')}</p>
        <p class="doc-signature-stamp">${escapeHtml(preview?.contractPartyAStamp || '㊞')}</p>
      </div>
      <div class="doc-signature-card">
        <p class="doc-signature-label">${escapeHtml(preview?.contractPartyBLabel || '乙（サービス提供者）')}</p>
        <p class="doc-signature-name">${escapeHtml(preview?.contractPartyBName || '（未入力）')}</p>
        <p>住所: ${escapeHtml(preview?.contractPartyBAddress || '（住所未入力）')}</p>
        <p>TEL: ${escapeHtml(preview?.contractPartyBPhone || '（電話未入力）')}</p>
        <p>MAIL: ${escapeHtml(preview?.contractPartyBEmail || '（メール未入力）')}</p>
      </div>
    </section>
      `;
    }
    return `
    <section class="doc-letter-meta">
      <div class="doc-letter-recipient">
        <p>${escapeHtml(preview?.receiverDept || '（依頼先未設定）')}</p>
        <p>${escapeHtml(preview?.receiverDisplayName || 'ご担当者様')}</p>
      </div>
      <div class="doc-letter-sender-wrap">
        <p class="doc-letter-date">${escapeHtml(preview?.issueDate || '-')}</p>
        <div class="doc-letter-sender">
          <p>${escapeHtml(preview?.senderDept || '（依頼元未設定）')}</p>
          <p>${escapeHtml(preview?.senderName || '（氏名未入力）')}</p>
        </div>
      </div>
    </section>
    <section class="doc-letter-subject">
      <p>件名</p>
      <p class="subject-text">${escapeHtml(preview?.subject || '（件名未入力）')}</p>
    </section>
    <section class="doc-sheet-block">
      <table class="doc-sheet-table"><tbody>
        ${renderMetaRows([
          { label: '希望期限', value: preview?.dueDate || '-' },
          { label: '優先度', value: preview?.priorityLabel || '-' },
          ...(preview?.targetStore ? [{ label: '対象店舗/案件', value: preview.targetStore }] : []),
          ...(preview?.budgetRange ? [{ label: '想定予算', value: preview.budgetRange }] : []),
        ])}
      </tbody></table>
    </section>
    <section class="doc-sheet-block">
      <h4>依頼目的</h4>
      ${renderPlainLines([preview?.purpose || '（未入力）'])}
    </section>
    <section class="doc-sheet-block">
      <h4>依頼内容</h4>
      <ul>${renderBullets(preview?.detailLines, '（未入力）')}</ul>
    </section>
    <section class="doc-sheet-block">
      <h4>成果物・完了条件</h4>
      ${renderPlainLines(preview?.deliverableLines, '（未入力）')}
    </section>
    <section class="doc-sheet-block">
      <h4>備考</h4>
      ${renderPlainLines(preview?.noteLines, '（備考なし）')}
    </section>
    <section class="doc-sheet-block">
      <h4>添付/参照</h4>
      ${renderPlainLines(preview?.attachmentLines, '（添付なし）')}
    </section>
    `;
  };

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(preview?.docTitle || '依頼書')}</title>
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
    .paper * { box-sizing: border-box; }
    .line-top { height: 1px; background: #bfbfbf; margin: 0 0 8mm; }
    .title {
      text-align: center;
      font-size: 11pt;
      letter-spacing: 0.08em;
      margin: 0;
    }
    .line-title { height: 1.6px; background: #9d9d9d; margin: 8mm 0 14mm; }
    .doc-invoice-title-top {
      text-align: center;
      margin: 0 0 3.6mm;
    }
    .doc-invoice-date-top {
      margin: 0 0 1.2mm;
      text-align: right;
      font-size: 9.2pt;
      line-height: 1.3;
      color: #344a61;
      font-weight: 600;
      letter-spacing: 0.01em;
    }
    .doc-invoice-title-top h2 {
      margin: 0;
      font-size: 18.5pt;
      line-height: 1.12;
      letter-spacing: 0.18em;
      color: #111;
    }
    .doc-invoice-title-top .doc-company-subtitle {
      margin-top: 1.2mm !important;
    }
    .doc-invoice-title-top .doc-company-meta {
      margin-top: 1.4mm !important;
      font-size: 9.4pt;
    }
    .doc-contract-title-top {
      text-align: center;
      margin: 0 0 3.6mm;
    }
    .doc-contract-date-top {
      margin: 0 0 1.2mm;
      text-align: right;
      font-size: 9.2pt;
      line-height: 1.3;
      color: #344a61;
      font-weight: 600;
      letter-spacing: 0.01em;
    }
    .doc-contract-title-top h2 {
      margin: 0;
      font-size: 18.5pt;
      line-height: 1.12;
      letter-spacing: 0.18em;
      color: #111;
    }
    .doc-contract-title-top .doc-company-subtitle {
      margin-top: 1.2mm !important;
    }
    .doc-contract-title-top .doc-company-meta {
      margin-top: 1.4mm !important;
      font-size: 9.4pt;
    }
    .doc-company-head {
      margin-bottom: 4mm;
      border: 1px solid #d2d7df;
      border-radius: 10px;
      padding: 3mm;
      background: #fff;
      display: grid;
      grid-template-columns: 1fr 76mm;
      gap: 3mm;
      align-items: center;
    }
    .doc-company-title h2 {
      margin: 0;
      font-size: 13pt;
      color: #111;
      letter-spacing: 0.01em;
    }
    .doc-company-title p {
      margin: 0;
    }
    .doc-company-subtitle {
      margin-top: 1mm !important;
      font-size: 9.5pt;
      color: #333;
      font-weight: 600;
    }
    .doc-company-meta {
      margin-top: 1.2mm !important;
      font-size: 9.2pt;
      color: #41556d;
      font-weight: 700;
    }
    .doc-company-recipient {
      margin-top: 2.2mm !important;
      font-size: 12.2pt;
      line-height: 1.5;
      font-weight: 700;
      color: #162638;
      white-space: pre-line;
    }
    .doc-company-recipient-box {
      min-height: 15mm;
      border-bottom: 1px solid #bcc7d6;
      display: flex;
      align-items: flex-end;
      padding: 0 0 1.6mm;
    }
    .doc-company-brand {
      display: inline-grid;
      gap: 2mm;
      justify-items: stretch;
      width: fit-content;
      margin-left: auto;
    }
    .doc-company-logo-wrap {
      border: 1px solid #e7e7e7;
      border-radius: 8px;
      background: #fff;
      min-height: 16mm;
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      padding: 1.5mm;
    }
    .doc-company-logo {
      max-width: 100%;
      max-height: 15mm;
      object-fit: contain;
      display: block;
    }
    .doc-company-info p {
      margin: 0;
      font-size: 8.8pt;
      line-height: 1.45;
      word-break: break-word;
    }
    .doc-company-info {
      display: block;
      width: 100%;
      text-align: left;
    }
    .doc-company-info .name {
      font-weight: 700;
      font-size: 10pt;
      margin-bottom: 1mm;
    }
    .invoice-info-container {
      width: 100%;
      border-collapse: collapse;
      margin: 0 0 4.5mm;
      font-size: 9.8pt;
    }
    .invoice-info-container th,
    .invoice-info-container td {
      padding: 1.4mm 0;
      vertical-align: top;
      line-height: 1.6;
    }
    .invoice-info-container th {
      width: 28mm;
      text-align: left;
      color: #5a6d83;
      font-weight: 700;
      padding-right: 3mm;
    }
    .invoice-info-container td {
      color: #1f2a38;
    }
    .invoice-info-container td:last-child {
      text-align: right;
      color: #3a4d65;
    }
    .invoice-info-container .client-name {
      font-size: 14pt;
      font-weight: 700;
      color: #162638;
      padding-right: 6mm;
    }
    .doc-invoice-recipient-line {
      margin: 0 0 2.8mm;
      padding: 1.4mm 0;
      font-size: 13.2pt;
      font-weight: 700;
      color: #162638;
      border-bottom: 1px solid #e4eaf2;
    }
    .invoice-meta-table {
      margin-top: 1mm;
      margin-bottom: 4mm;
    }
    .invoice-meta-table td:last-child {
      text-align: left;
      color: #22354a;
    }
    .line-items-container {
      width: 100%;
      border-collapse: collapse;
      margin: 5mm 0;
      font-size: 9.7pt;
    }
    .line-items-container th {
      text-align: left;
      color: #69798f;
      border-bottom: 1.8px solid #d2dbe7;
      padding: 2mm 0;
      font-size: 8.3pt;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      font-weight: 700;
    }
    .line-items-container th:last-child {
      text-align: right;
    }
    .line-items-container td {
      padding: 2.4mm 0;
      border-bottom: 1px solid #e4eaf2;
      vertical-align: top;
      line-height: 1.6;
      color: #1f2e43;
    }
    .line-items-container tbody tr:first-child td {
      padding-top: 3.2mm;
    }
    .line-items-container.has-bottom-border tbody tr:last-child td {
      padding-bottom: 3.2mm;
      border-bottom: 1.8px solid #d2dbe7;
    }
    .line-items-container.has-bottom-border {
      margin-top: 3mm;
      margin-bottom: 0;
    }
    .line-items-container th.heading-quantity {
      width: 16mm;
    }
    .line-items-container th.heading-price,
    .line-items-container th.heading-subtotal {
      width: 24mm;
      text-align: right;
    }
    .line-items-container .right {
      text-align: right;
    }
    .line-items-container .bold {
      font-weight: 700;
    }
    .line-items-container .large {
      font-size: 11.8pt;
      font-weight: 700;
    }
    .line-items-container .total {
      font-size: 13pt;
      font-weight: 800;
      color: #e11d48;
    }
    .payment-info {
      width: 52%;
      font-size: 8.8pt;
      line-height: 1.65;
      color: #27364a;
    }
    .payment-info div {
      margin-bottom: 1mm;
    }
    .payment-info div:last-child {
      margin-bottom: 0;
    }
    .doc-letter-meta {
      display: flex;
      justify-content: space-between;
      gap: 12mm;
      min-height: 38mm;
      margin-bottom: 8mm;
    }
    .doc-letter-recipient { white-space: pre-line; line-height: 1.9; font-size: 10.5pt; padding-top: 10mm; }
    .doc-letter-sender-wrap { min-width: 60mm; text-align: right; line-height: 1.8; font-size: 10.5pt; }
    .doc-letter-sender { margin-top: 12mm; white-space: pre-line; }
    .doc-letter-subject {
      text-align: center;
      margin: 2mm 0 10mm;
      line-height: 1.8;
    }
    .doc-letter-subject .subject-text { font-size: 11pt; min-height: 1.8em; }
    .doc-sheet-block {
      border: 1px solid #d2d7df;
      border-radius: 8px;
      padding: 3.5mm;
      margin-top: 4mm;
      background: #fafcff;
    }
    .doc-sheet-block h4 {
      margin: 0 0 2.5mm;
      font-size: 10.5pt;
      letter-spacing: 0.02em;
    }
    .doc-sheet-block p,
    .doc-sheet-block li,
    .doc-sheet-block td,
    .doc-sheet-block th,
    .doc-contract-top p,
    .doc-contract-top span,
    .doc-contract-top strong,
    .doc-invoice-top p,
    .doc-amount-box .k,
    .doc-amount-box .v {
      font-size: 10pt;
      line-height: 1.75;
    }
    .doc-sheet-block p {
      margin: 0 0 3.5mm;
      word-break: break-word;
      white-space: pre-wrap;
    }
    .doc-sheet-block ul,
    .doc-sheet-block ol { margin: 0; padding-left: 4.5mm; }
    .doc-sheet-table {
      width: 100%;
      border-collapse: collapse;
    }
    .doc-sheet-table th {
      width: 28mm;
      text-align: left;
      color: #3a4a5e;
      font-weight: 600;
      padding: 1.5mm 2mm 1.5mm 0;
      vertical-align: top;
    }
    .doc-sheet-table td {
      color: #1c2530;
      padding: 1.5mm 0;
      vertical-align: top;
      word-break: break-word;
    }
    .doc-contract-top {
      display: grid;
      gap: 4mm;
      margin-top: 2mm;
    }
    .doc-contract-parties {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4mm;
    }
    .doc-contract-parties > div {
      border: 1px solid #d2d7df;
      border-radius: 8px;
      padding: 3mm;
      background: #fff;
    }
    .doc-contract-parties span { display: block; color: #4d5f73; }
    .doc-contract-parties strong { display: block; margin-top: 1mm; }
    .doc-signature-grid {
      margin-top: 8mm;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4mm;
    }
    .doc-signature-card {
      min-height: 38mm;
      border: 1px solid #aab4c2;
      border-radius: 8px;
      padding: 2.4mm 2.8mm;
      display: grid;
      gap: 0.8mm;
      align-content: start;
      color: #2a3644;
    }
    .doc-signature-card p {
      margin: 0;
      font-size: 8.8pt;
      line-height: 1.45;
      word-break: break-word;
      white-space: pre-wrap;
    }
    .doc-signature-label {
      font-size: 8.3pt;
      color: #5b6a7b;
      font-weight: 700;
    }
    .doc-signature-name {
      font-size: 10pt;
      color: #1a2735;
      font-weight: 700;
    }
    .doc-signature-stamp {
      margin-top: 0.6mm !important;
      font-size: 10.4pt !important;
      text-align: right;
      letter-spacing: 0.08em;
    }
    .doc-invoice-top {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 72mm;
      gap: 3mm;
      margin: 1mm 0 3mm;
    }
    .doc-invoice-recipient p,
    .doc-invoice-sender p { margin: 0; }
    .doc-invoice-recipient .cap,
    .doc-invoice-sender .cap {
      font-size: 8.5pt;
      color: #5d6e84;
    }
    .doc-invoice-recipient .dept,
    .doc-invoice-recipient .name {
      font-size: 10.5pt;
      color: #1d2b3b;
      font-weight: 700;
      line-height: 1.6;
    }
    .doc-invoice-recipient .lead {
      margin-top: 1.5mm;
      font-size: 9.2pt;
      color: #33465c;
      line-height: 1.65;
    }
    .doc-invoice-summary {
      display: grid;
      gap: 2mm;
    }
    .doc-invoice-sender {
      text-align: right;
      border: 1px solid #d5dde8;
      border-radius: 6px;
      background: #fff;
      padding: 1.6mm 2.2mm;
    }
    .doc-invoice-meta-line {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 2mm;
      margin-bottom: 3mm;
    }
    .doc-invoice-meta-line > div {
      border: 1px solid #d5dde8;
      border-radius: 6px;
      padding: 1.2mm 1.6mm;
      background: #fff;
      display: grid;
      gap: 0.5mm;
    }
    .doc-invoice-meta-line span {
      font-size: 8.8pt;
      color: #5b6a7e;
    }
    .doc-invoice-meta-line strong {
      font-size: 10pt;
      color: #1b2633;
      font-weight: 600;
    }
    .doc-invoice-amount-line {
      margin: 0;
      padding: 2mm 2.2mm;
      border: 1px solid #c3cfde;
      border-radius: 6px;
      background: #f8fbff;
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 3mm;
    }
    .doc-invoice-amount-line .k {
      font-size: 10pt;
      font-weight: 600;
      color: #2e3d4e;
    }
    .doc-invoice-amount-line .v {
      font-size: 14pt;
      font-weight: 700;
      color: #121820;
      letter-spacing: 0.02em;
    }
    .doc-invoice-detail-clean h4,
    .doc-invoice-note h4 {
      margin: 0 0 1.5mm;
      font-size: 10pt;
      color: #2a3a4d;
      font-weight: 700;
    }
    .doc-invoice-table-clean {
      width: 100%;
      border-collapse: collapse;
      border-top: 1px solid #c8d1de;
      border-bottom: 1px solid #c8d1de;
    }
    .doc-invoice-table-clean th,
    .doc-invoice-table-clean td {
      border-bottom: 1px solid #d7dee8;
      padding: 1.8mm 0;
      font-size: 9.8pt;
      vertical-align: top;
      line-height: 1.65;
    }
    .doc-invoice-table-clean thead th {
      border-top: none;
      border-bottom: 1px solid #c8d1de;
      color: #4a5c72;
      font-weight: 600;
      text-align: left;
    }
    .doc-invoice-table-clean .col-no {
      width: 12mm;
      text-align: center;
      color: #5b6c81;
    }
    .doc-invoice-table-clean .col-qty {
      width: 12mm;
      text-align: right;
      color: #334b66;
    }
    .doc-invoice-table-clean .col-unit {
      width: 22mm;
      text-align: right;
      color: #334b66;
    }
    .doc-invoice-table-clean .col-amount {
      width: 24mm;
      text-align: right;
      color: #1d2f44;
      font-weight: 600;
    }
    .doc-invoice-note { margin-top: 3mm; }
    .doc-invoice-note p {
      margin: 0 0 2mm;
      font-size: 9.8pt;
      line-height: 1.7;
      word-break: break-word;
      white-space: pre-wrap;
    }
    .doc-invoice-total-box {
      margin-top: 3mm;
      margin-left: auto;
      width: 72mm;
      border: 1px solid #d5dde8;
      border-radius: 6px;
      background: #fff;
      padding: 1.6mm 2mm;
      display: grid;
      gap: 1.2mm;
    }
    .doc-invoice-total-box > div {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 2mm;
      font-size: 9.4pt;
      color: #2f455d;
    }
    .doc-invoice-total-box strong {
      color: #11253a;
      font-size: 9.8pt;
    }
    .doc-invoice-total-box .grand {
      border-top: 1px solid #d5dde8;
      padding-top: 1.2mm;
    }
    .doc-invoice-total-box .grand strong {
      font-size: 11pt;
      font-weight: 800;
    }
    .template-payment_request .doc-company-head,
    .template-estimate_request .doc-company-head {
      border: none;
      border-radius: 0;
      background: transparent;
      padding: 0 0 4mm;
      border-bottom: 1.8px solid #d2d7df;
      margin-bottom: 3.5mm;
      align-items: start;
      grid-template-columns: minmax(0, 1fr) 60mm;
      gap: 5mm;
    }
    .template-payment_request .doc-company-brand,
    .template-estimate_request .doc-company-brand {
      gap: 1.1mm;
    }
    .template-payment_request .doc-company-logo-wrap,
    .template-estimate_request .doc-company-logo-wrap {
      border: none;
      border-radius: 0;
      padding: 0;
      justify-content: flex-start;
      min-height: auto;
    }
    .template-payment_request .doc-company-logo,
    .template-estimate_request .doc-company-logo {
      max-height: 11mm;
    }
    .template-payment_request .doc-company-info p,
    .template-estimate_request .doc-company-info p {
      font-size: 8pt;
      line-height: 1.35;
    }
    .template-payment_request .doc-company-info .name,
    .template-estimate_request .doc-company-info .name {
      font-size: 8.8pt;
      margin-bottom: 0.6mm;
    }
    .template-payment_request .doc-company-title h2,
    .template-estimate_request .doc-company-title h2 {
      font-size: 18.5pt;
      line-height: 1.1;
      letter-spacing: 0.01em;
      margin: 0;
      text-align: center;
    }
    .template-payment_request .doc-company-subtitle,
    .template-estimate_request .doc-company-subtitle {
      font-size: 10.2pt;
      color: #1f2d3d;
      font-weight: 600;
    }
    .template-payment_request .doc-company-meta,
    .template-estimate_request .doc-company-meta {
      font-size: 9.6pt;
      color: #2f4560;
      font-weight: 700;
    }
    .template-payment_request .doc-company-recipient,
    .template-estimate_request .doc-company-recipient {
      margin-top: 0 !important;
      font-size: 13.5pt;
      line-height: 1.52;
      color: #111827;
      font-weight: 700;
    }
    .template-payment_request .doc-company-recipient-box,
    .template-estimate_request .doc-company-recipient-box {
      min-height: 17mm;
      padding-bottom: 1.8mm;
    }
    .template-payment_request .doc-sheet-block,
    .template-payment_request .doc-sheet-table,
    .template-estimate_request .doc-sheet-block,
    .template-estimate_request .doc-sheet-table {
      border: none;
      background: transparent;
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
  <main class="paper template-${escapeHtml(String(preview?.templateKey || 'department_request'))}">
    ${hasCorporateHeader ? '' : `<h1 class="title">${escapeHtml(preview?.docTitle || '依頼書')}</h1><div class="line-title"></div>`}
    ${renderBody()}
    ${(preview?.templateKey === 'payment_request' || preview?.templateKey === 'contract_review' || preview?.templateKey === 'estimate_request') ? '' : '<div class="closing">敬具</div>'}
  </main>
</body>
</html>`;
}

function normalizeTemplateValue(v) {
  const value = String(v || '').trim();
  if (!value) return '';
  return Object.prototype.hasOwnProperty.call(TEMPLATE_DEFS, value) ? value : '';
}

export default function AdminRequestDocumentPage() {
  const location = useLocation();
  const [form, setForm] = useState(() => loadDraft());
  const [recipientOptions, setRecipientOptions] = useState([]);
  const [recipientLoading, setRecipientLoading] = useState(false);
  const [recipientError, setRecipientError] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [sending, setSending] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadMessage, setUploadMessage] = useState('');
  const [keiyakuRef, setKeiyakuRef] = useState(null);
  const [keiyakuLoading, setKeiyakuLoading] = useState(false);
  const [keiyakuError, setKeiyakuError] = useState('');
  const [invoiceTorihikisakiRows, setInvoiceTorihikisakiRows] = useState([]);
  const [invoiceTorihikisakiLoading, setInvoiceTorihikisakiLoading] = useState(false);
  const [invoiceTorihikisakiError, setInvoiceTorihikisakiError] = useState('');
  const [invoiceTorihikisakiQuery, setInvoiceTorihikisakiQuery] = useState('');
  const fileInputRef = useRef(null);
  const previewPaperRef = useRef(null);
  const previewWrapRef = useRef(null);
  const [previewScale, setPreviewScale] = useState(1);
  const template = TEMPLATE_DEFS[form.template] || TEMPLATE_DEFS.department_request;
  const templateLabel = TEMPLATE_OPTIONS.find((x) => x.value === form.template)?.label || '-';
  const isEstimateOrInvoice = form.template === 'estimate_request' || form.template === 'payment_request';
  const filteredInvoiceTorihikisakiRows = useMemo(() => {
    const q = String(invoiceTorihikisakiQuery || '').trim().toLowerCase();
    const rows = Array.isArray(invoiceTorihikisakiRows) ? invoiceTorihikisakiRows : [];
    if (!q) return rows.slice(0, 30);
    return rows
      .filter((row) => String(row?._search || '').includes(q))
      .slice(0, 30);
  }, [invoiceTorihikisakiRows, invoiceTorihikisakiQuery]);

  const preview = useMemo(() => {
    const templateKey = String(form.template || 'department_request');
    const keiyaku = keiyakuRef && typeof keiyakuRef === 'object' ? keiyakuRef : null;
    const subject = String(form.title || '').trim() || `${template.subjectPrefix}（未入力）`;
    const issueDate = formatYmdJa(todayYmd());
    const dueDate = formatYmdJa(form.due_date);
    const detailLines = splitParagraphs(form.request_detail);
    const deliverableLines = splitParagraphs(form.deliverables);
    const noteLines = splitParagraphs(form.note);
    const attachmentLines = splitParagraphs(form.attachment_refs);
    const purpose = String(form.purpose || '').trim() || '（未入力）';
    const priorityLabel = formatPriority(form.priority);
    const lineItems = normalizeLineItems(form.line_items);
    const subtotal = lineItems.reduce((acc, row) => acc + Number(row.rowTotal || 0), 0);
    const taxRate = Math.max(0, toNumber(form.tax_rate, 10));
    const taxAmount = Math.round(subtotal * (taxRate / 100));
    const totalAmount = subtotal + taxAmount;
    const fallbackManual = toNumber(form.amount, 0);
    const finalAmount = totalAmount > 0 ? totalAmount : fallbackManual;
    const rawVariant = String(form.company_logo_variant || 'wide');
    const logoVariant = rawVariant === 'square' || rawVariant === 'icon' ? rawVariant : 'wide';
    const companyLogoSrc = logoVariant === 'square'
      ? companyLogoSquare
      : logoVariant === 'icon'
        ? companyLogoIcon
        : companyLogoWide;
    const companyLogoLabel = COMPANY_LOGO_OPTIONS.find((x) => x.value === logoVariant)?.label || '横長ロゴ';
    const clientCompany = String(form.client_company || '').trim();
    const clientName = String(form.client_name || '').trim();
    const clientAddress = String(form.client_address || '').trim();
    const bankInfo = String(form.bank_info || '').trim();
    const contractTermStart = formatYmdJa(firstFilled(form.contract_term_start, keiyaku?.start_date));
    const contractTermEnd = formatYmdJa(firstFilled(form.contract_term_end, keiyaku?.end_date));
    const contractAmountRaw = String(form.contract_amount || '').trim();
    const contractAmount = toNumber(contractAmountRaw, 0);
    const contractPartyAName = firstFilled(keiyaku?.name, keiyaku?.company_name, form.counterparty);
    const contractPartyAAddress = firstFilled(keiyaku?.company_address, form.client_address);
    const contractPartyAContact = firstFilled(keiyaku?.contact_person, form.receiver_name, form.client_name);
    const contractPartyAPhone = firstFilled(keiyaku?.phone);
    const contractPartyAEmail = firstFilled(keiyaku?.email);
    const contractPartyAStamp = firstFilled(keiyaku?.company_stamp, '㊞');
    const contractPartyBName = firstFilled(keiyaku?.provider_name, COMPANY_INFO.name);
    const contractPartyBAddress = firstFilled(
      keiyaku?.provider_address,
      [COMPANY_INFO.address1, COMPANY_INFO.address2].filter(Boolean).join(' ')
    );
    const contractPartyBPhone = firstFilled(keiyaku?.provider_phone, COMPANY_INFO.tel);
    const contractPartyBEmail = firstFilled(keiyaku?.provider_email, COMPANY_INFO.email);
    const clientOnchu = resolveOnchuRecipientName(clientName || clientCompany, clientCompany);
    const receiverOnchu = templateKey === 'payment_request'
      ? clientOnchu
      : resolveOnchuRecipientName(form.receiver_name, form.receiver_dept);

    return {
      docTitle: String(template?.docTitle || '依頼書').trim(),
      docSubtitle: String(template?.docSubtitle || '').trim(),
      templateKey,
      templateLabel,
      templateHint: String(template?.hint || ''),
      issueDate,
      dueDate,
      receiverDept: String(form.receiver_dept || '').trim() || '（依頼先未設定）',
      receiverName: String(form.receiver_name || '').trim() || 'ご担当者様',
      receiverDisplayName: addSama(String(form.receiver_name || '').trim() || 'ご担当者様'),
      receiverOnchu,
      senderDept: String(form.requester_dept || '').trim() || '（依頼元未設定）',
      senderName: String(form.requester_name || '').trim() || '（氏名未入力）',
      clientCompany: clientCompany || '（請求先未入力）',
      clientName: clientName || '（担当者未入力）',
      clientAddress: clientAddress || '（住所未入力）',
      clientOnchu,
      bankInfo: bankInfo || '（未入力）',
      subject,
      purpose,
      detailLines,
      deliverableLines,
      noteLines,
      attachmentLines,
      priorityLabel,
      targetStore: String(form.target_store || '').trim(),
      budgetRange: String(form.budget_range || '').trim(),
      contractId: firstFilled(form.contract_id, keiyaku?.keiyaku_id),
      counterparty: templateKey === 'contract_review' ? contractPartyAName : String(form.counterparty || '').trim(),
      contractTermStart,
      contractTermEnd,
      contractAmountDisplay: formatCurrencyYen(contractAmount),
      contractPartyALabel: '甲（契約先）',
      contractPartyAName: contractPartyAName || '（未入力）',
      contractPartyAAddress: contractPartyAAddress || '（住所未入力）',
      contractPartyAContact: contractPartyAContact || '（担当者未入力）',
      contractPartyAPhone: contractPartyAPhone || '（電話未入力）',
      contractPartyAEmail: contractPartyAEmail || '（メール未入力）',
      contractPartyAStamp,
      contractPartyBLabel: '乙（サービス提供者）',
      contractPartyBName: contractPartyBName || COMPANY_INFO.name,
      contractPartyBAddress: contractPartyBAddress || '（住所未入力）',
      contractPartyBPhone: contractPartyBPhone || '（電話未入力）',
      contractPartyBEmail: contractPartyBEmail || '（メール未入力）',
      estimateNo: String(form.estimate_no || '').trim(),
      invoiceNo: String(form.invoice_no || '').trim(),
      paymentTerms: String(form.payment_terms || '').trim(),
      taxRate,
      lineItems,
      subtotal,
      taxAmount,
      totalAmount,
      amountDisplay: formatCurrencyYen(finalAmount),
      subtotalDisplay: formatCurrencyYen(subtotal),
      taxAmountDisplay: formatCurrencyYen(taxAmount),
      totalAmountDisplay: formatCurrencyYen(totalAmount),
      companyLogoVariant: logoVariant,
      companyLogoSrc,
      companyLogoLabel,
    };
  }, [form, template, templateLabel, keiyakuRef]);

  const requiredMissing = useMemo(() => {
    const templateKey = String(form.template || '');
    const baseRequired = templateKey === 'payment_request'
      ? PAYMENT_REQUIRED_FIELDS
      : (templateKey === 'estimate_request' ? ESTIMATE_INVOICE_REQUIRED_FIELDS : BASE_REQUIRED_FIELDS);
    const required = [...baseRequired, ...(Array.isArray(template.requiredExtraFields) ? template.requiredExtraFields : [])];
    const labelOverrides = template.fieldLabelOverrides || {};
    const missing = required
      .filter((k) => !String(form[k] || '').trim())
      .map((k) => labelOverrides[k] || FIELD_LABELS[k] || k);
    if (templateKey === 'estimate_request' || templateKey === 'payment_request') {
      const hasLine = normalizeLineItems(form.line_items).some((row) => row.description && row.qty > 0);
      if (!hasLine) missing.push('明細行');
    }
    return missing;
  }, [form, template]);

  const renderPreviewLineRows = (emptyLabel) => {
    const rows = Array.isArray(preview.lineItems) ? preview.lineItems : [];
    const printable = rows.filter((row) => row.description && row.qty > 0);
    if (!printable.length) {
      return (
        <tr>
          <td>1</td>
          <td>{emptyLabel}</td>
          <td className="right">¥0</td>
          <td className="bold right">¥0</td>
        </tr>
      );
    }
    return printable.map((row, idx) => (
      <tr key={`${preview.templateKey}-line-${idx}`}>
        <td>{Number.isInteger(row.qty) ? row.qty : row.qty.toFixed(2)}</td>
        <td>{row.description}</td>
        <td className="right">{formatCurrencyYen(row.unitPrice)}</td>
        <td className="bold right">{formatCurrencyYen(row.rowTotal)}</td>
      </tr>
    ));
  };

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
    const qs = new URLSearchParams(String(location?.search || ''));
    const nextTemplate = normalizeTemplateValue(qs.get('template'));
    if (!nextTemplate) return;
    setForm((prev) => {
      if (String(prev?.template || '') === nextTemplate) return prev;
      const nextDef = TEMPLATE_DEFS[nextTemplate] || TEMPLATE_DEFS.department_request;
      const title = String(prev?.title || '').trim()
        ? prev.title
        : `${nextDef.subjectPrefix}：`;
      const next = {
        ...prev,
        template: nextTemplate,
        title,
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, [location?.search]);

  useEffect(() => {
    const wrap = previewWrapRef.current;
    if (!wrap) return undefined;

    const PAPER_WIDTH_PX = 794;
    let rafId = 0;
    const updateScale = () => {
      const available = Math.max(0, Number(wrap.clientWidth || 0) - 4);
      const next = Math.max(0.34, Math.min(1, available / PAPER_WIDTH_PX));
      setPreviewScale((prev) => (Math.abs(prev - next) < 0.005 ? prev : next));
    };
    const queueUpdate = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updateScale);
    };
    updateScale();

    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(queueUpdate);
      ro.observe(wrap);
    }
    window.addEventListener('resize', queueUpdate);
    return () => {
      cancelAnimationFrame(rafId);
      if (ro) ro.disconnect();
      window.removeEventListener('resize', queueUpdate);
    };
  }, []);

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
    let cancelled = false;
    const templateKey = String(form.template || '');
    const contractId = String(form.contract_id || '').trim();
    if (templateKey !== 'contract_review') {
      setKeiyakuRef(null);
      setKeiyakuLoading(false);
      setKeiyakuError('');
      return () => {
        cancelled = true;
      };
    }
    if (!contractId) {
      setKeiyakuRef(null);
      setKeiyakuLoading(false);
      setKeiyakuError('');
      return () => {
        cancelled = true;
      };
    }

    const loadKeiyaku = async () => {
      setKeiyakuLoading(true);
      setKeiyakuError('');
      try {
        const base = MASTER_API_BASE.replace(/\/$/, '');
        const headers = {
          ...authHeaders(),
          'Content-Type': 'application/json',
        };

        let row = null;
        const directRes = await fetch(`${base}/master/keiyaku/${encodeURIComponent(contractId)}`, {
          headers,
          cache: 'no-store',
        });
        if (directRes.ok) {
          row = await directRes.json();
        } else if (directRes.status !== 404) {
          const txt = await directRes.text();
          throw new Error(`契約情報取得失敗: HTTP ${directRes.status}${txt ? ` ${txt}` : ''}`);
        }

        if (!row) {
          const qs = new URLSearchParams({
            limit: '300',
            jotai: 'yuko',
            keiyaku_id: contractId,
          });
          const listRes = await fetch(`${base}/master/keiyaku?${qs.toString()}`, {
            headers,
            cache: 'no-store',
          });
          if (!listRes.ok) {
            const txt = await listRes.text();
            throw new Error(`契約情報取得失敗: HTTP ${listRes.status}${txt ? ` ${txt}` : ''}`);
          }
          const rows = asItems(await listRes.json());
          row = rows.find((it) => String(it?.keiyaku_id || '').trim() === contractId) || null;
        }

        if (!row) {
          throw new Error(`契約ID ${contractId} の契約情報が見つかりません`);
        }
        if (!cancelled) {
          setKeiyakuRef(row);
          setKeiyakuError('');
        }
      } catch (e) {
        if (!cancelled) {
          setKeiyakuRef(null);
          setKeiyakuError(String(e?.message || e || '契約情報の取得に失敗しました'));
        }
      } finally {
        if (!cancelled) setKeiyakuLoading(false);
      }
    };
    loadKeiyaku();
    return () => {
      cancelled = true;
    };
  }, [form.template, form.contract_id]);

  useEffect(() => {
    let cancelled = false;
    if (String(form.template || '') !== 'payment_request') {
      setInvoiceTorihikisakiRows([]);
      setInvoiceTorihikisakiLoading(false);
      setInvoiceTorihikisakiError('');
      setInvoiceTorihikisakiQuery('');
      return () => {
        cancelled = true;
      };
    }
    const loadTorihikisaki = async () => {
      setInvoiceTorihikisakiLoading(true);
      setInvoiceTorihikisakiError('');
      try {
        const base = MASTER_API_BASE.replace(/\/$/, '');
        const res = await fetch(`${base}/master/torihikisaki?limit=5000&jotai=yuko`, {
          headers: {
            ...authHeaders(),
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        });
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`請求取引先一覧取得失敗: HTTP ${res.status}${txt ? ` ${txt}` : ''}`);
        }
        const rows = asItems(await res.json())
          .map((row) => {
            const torihikisakiId = String(row?.torihikisaki_id || row?.id || '').trim();
            const name = String(row?.name || '').trim();
            if (!torihikisakiId || !name) return null;
            const contactName = firstFilled(row?.tantou_name, row?.contact_person, row?.contact_name);
            const address = firstFilled(row?.address, row?.company_address);
            const phone = firstFilled(row?.phone, row?.contact_phone, row?.tel);
            const email = firstFilled(row?.email, row?.mail);
            const search = [torihikisakiId, name, contactName, address, phone, email]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();
            return {
              torihikisaki_id: torihikisakiId,
              name,
              contact_name: contactName,
              address,
              phone,
              email,
              _search: search,
            };
          })
          .filter(Boolean)
          .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ja'));
        if (!cancelled) {
          setInvoiceTorihikisakiRows(rows);
        }
      } catch (e) {
        if (!cancelled) {
          setInvoiceTorihikisakiRows([]);
          setInvoiceTorihikisakiError(String(e?.message || e || '請求取引先一覧の取得に失敗しました'));
        }
      } finally {
        if (!cancelled) setInvoiceTorihikisakiLoading(false);
      }
    };
    loadTorihikisaki();
    return () => {
      cancelled = true;
    };
  }, [form.template]);

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

  useEffect(() => {
    if (String(form.template || '') !== 'payment_request') return;
    const selectedId = String(form.invoice_torihikisaki_id || '').trim();
    if (!selectedId) return;
    const selected = invoiceTorihikisakiRows.find((row) => row.torihikisaki_id === selectedId) || null;
    if (!selected) return;
    if (!String(invoiceTorihikisakiQuery || '').trim()) {
      setInvoiceTorihikisakiQuery(selected.name || '');
    }
  }, [form.template, form.invoice_torihikisaki_id, invoiceTorihikisakiRows, invoiceTorihikisakiQuery]);

  const onReceiverChange = (nextId) => {
    const selected = recipientOptions.find((row) => row.id === nextId) || null;
    saveDraft({
      ...form,
      receiver_jinzai_id: nextId,
      receiver_name: selected?.name || '',
      receiver_dept: selected?.dept || form.receiver_dept || '',
    });
  };

  const onInvoiceTorihikisakiSelect = (torihikisakiId) => {
    const selected = invoiceTorihikisakiRows.find((row) => row.torihikisaki_id === torihikisakiId) || null;
    if (!selected) return;
    saveDraft({
      ...form,
      invoice_torihikisaki_id: selected.torihikisaki_id,
      client_company: selected.name || form.client_company,
      client_name: selected.contact_name || form.client_name,
      client_address: selected.address || form.client_address,
    });
    setInvoiceTorihikisakiQuery(selected.name || '');
  };

  const onSave = () => {
    saveDraft({ ...form });
    setUploadError('');
    setUploadMessage('保存しました');
  };

  const onResetForm = () => {
    if (sending) return;
    const ok = window.confirm('入力済みの内容をリセットします。よろしいですか？');
    if (!ok) return;
    const resetBase = emptyDraft();
    const nextTemplate = normalizeTemplateValue(form.template) || 'department_request';
    const nextTemplateDef = TEMPLATE_DEFS[nextTemplate] || TEMPLATE_DEFS.department_request;
    const next = {
      ...resetBase,
      template: nextTemplate,
      title: `${nextTemplateDef.subjectPrefix}：`,
      company_logo_variant: String(form.company_logo_variant || resetBase.company_logo_variant),
    };
    saveDraft(next);
    setSelectedFiles([]);
    setUploadError('');
    setUploadMessage('入力項目をリセットしました');
  };

  const onTemplateChange = (nextTemplate) => {
    const currentItems = Array.isArray(form.line_items) ? form.line_items : [];
    const next = {
      ...form,
      template: nextTemplate,
      title: String(form.title || '').trim() ? form.title : `${(TEMPLATE_DEFS[nextTemplate] || template).subjectPrefix}：`,
      line_items: currentItems.length ? currentItems : [createLineItem()],
    };
    saveDraft(next);
  };

  const updateLineItem = (id, key, value) => {
    const nextItems = (Array.isArray(form.line_items) ? form.line_items : [createLineItem()]).map((row) => (
      row.id === id ? { ...row, [key]: value } : row
    ));
    saveDraft({ ...form, line_items: nextItems });
  };

  const addLineItem = () => {
    const nextItems = [...(Array.isArray(form.line_items) ? form.line_items : []), createLineItem()];
    saveDraft({ ...form, line_items: nextItems });
  };

  const removeLineItem = (id) => {
    const current = Array.isArray(form.line_items) ? form.line_items : [];
    const nextItems = current.filter((row) => row.id !== id);
    saveDraft({ ...form, line_items: nextItems.length ? nextItems : [createLineItem()] });
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

  const labelOf = (key, fallback) => (
    template?.fieldLabelOverrides?.[key]
    || FIELD_LABELS[key]
    || fallback
  );

  return (
    <div className="admin-request-doc-page">
      <div className="admin-request-doc-content">
        <header className="admin-request-doc-head">
          <h1>書類作成</h1>
          <p>見積書・請求書・契約書・依頼書を作成できます。送信時にPDFを生成し、依頼先のマイストレージへ保存します。</p>
        </header>

        <div className="admin-request-doc-grid">
          <section className="admin-request-doc-panel">
            <h2>テンプレート入力</h2>
            <div className="admin-request-doc-form">
              <div className="admin-request-doc-template-field">
                <span className="admin-request-doc-template-label">テンプレート</span>
                <div className="admin-request-doc-template-picker" role="tablist" aria-label="テンプレート選択">
                  {TEMPLATE_OPTIONS.map((opt) => {
                    const active = String(form.template || '') === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        className={`admin-request-doc-template-tag ${active ? 'active' : ''}`}
                        onClick={() => onTemplateChange(opt.value)}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="admin-request-doc-template-field">
                <span className="admin-request-doc-template-label">会社ロゴ</span>
                <div className="admin-request-doc-template-picker" role="tablist" aria-label="会社ロゴ選択">
                  {COMPANY_LOGO_OPTIONS.map((opt) => {
                    const active = String(form.company_logo_variant || 'wide') === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        className={`admin-request-doc-template-tag ${active ? 'active' : ''}`}
                        onClick={() => update('company_logo_variant', opt.value)}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="admin-request-doc-hint">{template.hint}</div>

              <label>
                {labelOf('title', '件名')}
                <input
                  value={form.title}
                  onChange={(e) => update('title', e.target.value)}
                  placeholder={`${template.subjectPrefix}：`}
                  maxLength={80}
                />
              </label>

              {form.template === 'payment_request' ? null : (
                <>
                  <div className="admin-request-doc-two-col">
                    <label>
                      {labelOf('requester_dept', '依頼元部署')}
                      <select value={form.requester_dept} onChange={(e) => update('requester_dept', e.target.value)}>
                        {DEPARTMENT_OPTIONS.map((x) => <option key={x} value={x}>{x}</option>)}
                      </select>
                    </label>
                    <label>
                      {labelOf('receiver_dept', '依頼先部署')}
                      <select value={form.receiver_dept} onChange={(e) => update('receiver_dept', e.target.value)}>
                        {DEPARTMENT_OPTIONS.map((x) => <option key={x} value={x}>{x}</option>)}
                      </select>
                    </label>
                  </div>

                  <div className="admin-request-doc-two-col">
                    <label>
                      {labelOf('requester_name', '依頼者名')}
                      <input
                        value={form.requester_name}
                        onChange={(e) => update('requester_name', e.target.value)}
                        placeholder="例: 桜田"
                        maxLength={40}
                      />
                    </label>
                    <label>
                      {labelOf('receiver_jinzai_id', '依頼先担当者')}
                      <select
                        value={form.receiver_jinzai_id || ''}
                        onChange={(e) => onReceiverChange(e.target.value)}
                        disabled={recipientLoading}
                      >
                        <option value="">
                          {recipientLoading
                            ? '担当者読込中...'
                            : `${labelOf('receiver_jinzai_id', '担当者')}を選択してください（管理/事務/営業/開発）`}
                        </option>
                        {recipientOptions.map((row) => (
                          <option key={row.id} value={row.id}>{row.label}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {recipientError ? <div className="admin-request-doc-meta">{recipientError}</div> : null}
                </>
              )}

              <div className="admin-request-doc-two-col">
                <label>
                  {template.dueDateLabel || '希望期限'}
                  <input type="date" value={form.due_date} onChange={(e) => update('due_date', e.target.value)} />
                </label>
              </div>

              {template.showPriority === false ? null : (
                <label>
                  {labelOf('priority', '優先度')}
                  <select value={form.priority} onChange={(e) => update('priority', e.target.value)}>
                    {PRIORITY_OPTIONS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                  </select>
                </label>
              )}

              {form.template === 'payment_request' ? (
                <div className="admin-request-doc-torihikisaki-search">
                  <label>
                    請求取引先
                    <input
                      value={invoiceTorihikisakiQuery}
                      onChange={(e) => {
                        setInvoiceTorihikisakiQuery(e.target.value);
                        if (form.invoice_torihikisaki_id) {
                          update('invoice_torihikisaki_id', '');
                        }
                      }}
                      placeholder="取引先名 / 取引先ID / 担当者 / 住所 で検索"
                      maxLength={120}
                    />
                  </label>
                  <div className="admin-request-doc-torihikisaki-meta">
                    {invoiceTorihikisakiLoading
                      ? '請求取引先を読み込み中...'
                      : invoiceTorihikisakiError
                        ? invoiceTorihikisakiError
                        : `候補 ${filteredInvoiceTorihikisakiRows.length}件`}
                  </div>
                  {invoiceTorihikisakiLoading || invoiceTorihikisakiError ? null : (
                    <div className="admin-request-doc-torihikisaki-list" role="listbox" aria-label="請求取引先候補">
                      {filteredInvoiceTorihikisakiRows.length ? (
                        filteredInvoiceTorihikisakiRows.map((row) => {
                          const active = String(form.invoice_torihikisaki_id || '') === row.torihikisaki_id;
                          return (
                            <button
                              key={row.torihikisaki_id}
                              type="button"
                              role="option"
                              aria-selected={active}
                              className={`admin-request-doc-torihikisaki-item ${active ? 'active' : ''}`}
                              onClick={() => onInvoiceTorihikisakiSelect(row.torihikisaki_id)}
                            >
                              <span className="name">{row.name}</span>
                              <span className="meta">
                                {row.torihikisaki_id}
                                {row.contact_name ? ` / 担当: ${row.contact_name}` : ''}
                              </span>
                            </button>
                          );
                        })
                      ) : (
                        <div className="admin-request-doc-torihikisaki-empty">一致する請求取引先がありません</div>
                      )}
                    </div>
                  )}
                </div>
              ) : null}

              {(template.extraFields || []).map((field) => (
                <label key={field.key}>
                  {field.label}
                  {(() => {
                    const isDateField = field.key === 'contract_term_start' || field.key === 'contract_term_end';
                    const isMoneyField = field.key === 'contract_amount';
                    return (
                      <input
                        type={isDateField ? 'date' : 'text'}
                        inputMode={isMoneyField ? 'numeric' : undefined}
                        value={form[field.key] || ''}
                        onChange={(e) => update(field.key, e.target.value)}
                        placeholder={isDateField ? undefined : (field.placeholder || '')}
                        maxLength={isDateField ? undefined : 120}
                      />
                    );
                  })()}
                </label>
              ))}
              {form.template === 'contract_review' && String(form.contract_id || '').trim() ? (
                <div className="admin-request-doc-meta">
                  {keiyakuLoading
                    ? '契約マスタ(keiyaku)を読み込み中...'
                    : keiyakuError
                      ? keiyakuError
                      : `契約マスタを読み込みました: ${firstFilled(keiyakuRef?.name, keiyakuRef?.company_name, keiyakuRef?.keiyaku_id) || String(form.contract_id || '').trim()}`}
                </div>
              ) : null}

              {isEstimateOrInvoice ? (
                <div className="admin-request-doc-lineitems">
                  <div className="admin-request-doc-lineitems-head">
                    <span>{template.requestDetailLabel || '明細行'}</span>
                    <button type="button" className="ghost" onClick={addLineItem}>明細追加</button>
                  </div>
                  <div className="admin-request-doc-lineitems-table">
                    <div className="lineitem-th">内容</div>
                    <div className="lineitem-th qty">数量</div>
                    <div className="lineitem-th unit">単価(円)</div>
                    <div className="lineitem-th amount">小計</div>
                    <div className="lineitem-th action" />
                    {(Array.isArray(form.line_items) ? form.line_items : [createLineItem()]).map((row) => {
                      const qty = toNumber(row?.qty, 0);
                      const unitPrice = toNumber(row?.unit_price, 0);
                      return (
                        <React.Fragment key={row.id}>
                          <input
                            value={row.description || ''}
                            onChange={(e) => updateLineItem(row.id, 'description', e.target.value)}
                            placeholder="例: 定期清掃（月次）"
                            maxLength={120}
                          />
                          <input
                            className="qty"
                            value={row.qty || ''}
                            onChange={(e) => updateLineItem(row.id, 'qty', e.target.value)}
                            placeholder="1"
                            inputMode="decimal"
                          />
                          <input
                            className="unit"
                            value={row.unit_price || ''}
                            onChange={(e) => updateLineItem(row.id, 'unit_price', e.target.value)}
                            placeholder="10000"
                            inputMode="numeric"
                          />
                          <div className="lineitem-amount">{formatCurrencyYen(qty * unitPrice)}</div>
                          <button type="button" className="ghost lineitem-remove" onClick={() => removeLineItem(row.id)}>削除</button>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <label>
                {template.purposeLabel || '依頼目的'}
                <textarea
                  value={form.purpose}
                  onChange={(e) => update('purpose', e.target.value)}
                  placeholder={template.purposePlaceholder || '何のための依頼かを簡潔に記載'}
                  rows={3}
                  maxLength={300}
                />
              </label>

              {template.showRequestDetail === false ? null : (
                <label>
                  {template.requestDetailLabel || '依頼内容'}
                  <textarea
                    value={form.request_detail}
                    onChange={(e) => update('request_detail', e.target.value)}
                    placeholder={template.requestDetailPlaceholder || '対応してほしい内容を箇条書きで記載'}
                    rows={5}
                    maxLength={800}
                  />
                </label>
              )}

              {template.showDeliverables === false ? null : (
                <label>
                  {template.deliverablesLabel || '成果物・完了条件'}
                  <textarea
                    value={form.deliverables}
                    onChange={(e) => update('deliverables', e.target.value)}
                    placeholder={template.deliverablesPlaceholder || '何をもって完了とするか'}
                    rows={3}
                    maxLength={300}
                  />
                </label>
              )}

              {template.showAttachmentRefs === false ? null : (
                <label>
                  {labelOf('attachment_refs', '添付/参照ファイル')}
                  <input
                    value={form.attachment_refs}
                    onChange={(e) => update('attachment_refs', e.target.value)}
                    placeholder="例: souko://workflow/req-001, /admin/filebox（マイストレージ）"
                    maxLength={220}
                  />
                </label>
              )}

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

              {template.showNote === false ? null : (
                <label>
                  {labelOf('note', '備考')}
                  <textarea
                    value={form.note}
                    onChange={(e) => update('note', e.target.value)}
                    placeholder="補足があれば記載"
                    rows={2}
                    maxLength={240}
                  />
                </label>
              )}
            </div>

            <div className="admin-request-doc-actions">
              <button type="button" className="ghost" onClick={onSave} disabled={sending}>保存</button>
              <button type="button" className="ghost" onClick={onResetForm} disabled={sending}>リセット</button>
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
            <div ref={previewWrapRef} className="admin-request-doc-preview-wrap">
              <div className="admin-request-doc-preview-scale" style={{ '--preview-scale': previewScale }}>
                <article
                  ref={previewPaperRef}
                  className={`admin-request-doc-preview-paper template-${preview.templateKey || 'department_request'}`}
                >
                {preview.templateKey === 'payment_request' || preview.templateKey === 'contract_review' || preview.templateKey === 'estimate_request' ? null : (
                  <>
                    <header className="doc-letter-head">
                      <h3>{preview.docTitle || '依頼書'}</h3>
                    </header>
                    <div className="doc-letter-line-title" />
                  </>
                )}
                {preview.templateKey === 'payment_request' ? (
                  <>
                    <section className="doc-invoice-title-top">
                      <p className="doc-invoice-date-top">発行日&nbsp;&nbsp;{preview.issueDate || '-'}</p>
                      <h2>{preview.docTitle || '請求書'}</h2>
                      <p className="doc-company-meta">請求書番号: {preview.invoiceNo || '（未入力）'}</p>
                    </section>
                    <section className="doc-company-head">
                      <div className="doc-company-title">
                        <div className="doc-company-recipient-box">
                          <p className="doc-company-recipient">
                            {preview.clientCompany ? `${preview.clientCompany}\n` : ''}
                            {preview.clientOnchu || 'ご担当者様'}
                            {preview.clientAddress ? `\n${preview.clientAddress}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="doc-company-brand">
                        <div className="doc-company-logo-wrap">
                          <img className="doc-company-logo" src={preview.companyLogoSrc || companyLogoWide} alt="ミセサポ ロゴ" />
                        </div>
                        <div className="doc-company-info">
                          <p className="name">{COMPANY_INFO.name}</p>
                          <p>{COMPANY_INFO.postal}</p>
                          <p>{COMPANY_INFO.address1}</p>
                          <p>{COMPANY_INFO.address2}</p>
                          <p>TEL: {COMPANY_INFO.tel}</p>
                          <p>Email: {COMPANY_INFO.email}</p>
                        </div>
                      </div>
                    </section>
                    <table className="invoice-info-container invoice-meta-table">
                      <tbody>
                        <tr><th>発行部署</th><td><strong>{preview.senderDept || '（未設定）'}</strong></td></tr>
                        <tr><th>お支払期限</th><td><strong>{preview.dueDate || '-'}</strong></td></tr>
                      </tbody>
                    </table>

                    <section className="doc-invoice-detail-clean">
                      <table className="line-items-container">
                        <thead>
                          <tr>
                            <th className="heading-quantity">数量</th>
                            <th className="heading-description">内容</th>
                            <th className="heading-price">単価</th>
                            <th className="heading-subtotal">小計</th>
                          </tr>
                        </thead>
                        <tbody>{renderPreviewLineRows('（ご請求内容未入力）')}</tbody>
                      </table>
                    </section>

                    <table className="line-items-container has-bottom-border">
                      <thead>
                        <tr>
                          <th>請求概要 / 支払条件</th>
                          <th>支払期限</th>
                          <th>合計請求額</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="payment-info">
                            <div>概要: <strong>{preview.purpose || '（未入力）'}</strong></div>
                            <div>支払条件: <strong>{preview.paymentTerms || '（未入力）'}</strong></div>
                            <div>税率: <strong>{preview.taxRate ?? 10}%</strong></div>
                            <div>振込先: <strong>{preview.bankInfo || '（未入力）'}</strong></div>
                            {(preview.noteLines || []).length
                              ? <div>備考: <strong>{preview.noteLines.join(' / ')}</strong></div>
                              : null}
                          </td>
                          <td className="large">{preview.dueDate || '-'}</td>
                          <td className="large total">{preview.amountDisplay || '¥0'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </>
                ) : preview.templateKey === 'estimate_request' ? (
                  <>
                    <section className="doc-invoice-title-top">
                      <h2>{preview.docTitle || '見積書'}</h2>
                      {preview.docSubtitle ? <p className="doc-company-subtitle">{preview.docSubtitle}</p> : null}
                      <p className="doc-company-meta">見積書番号: {preview.estimateNo || '（未入力）'}</p>
                    </section>
                    <section className="doc-company-head">
                      <div className="doc-company-title">
                        <div className="doc-company-recipient-box">
                          <p className="doc-company-recipient">
                            {preview.receiverDept ? `${preview.receiverDept}\n` : ''}
                            {preview.receiverOnchu || 'ご担当者様'}
                          </p>
                        </div>
                      </div>
                      <div className="doc-company-brand">
                        <div className="doc-company-logo-wrap">
                          <img className="doc-company-logo" src={preview.companyLogoSrc || companyLogoWide} alt="ミセサポ ロゴ" />
                        </div>
                        <div className="doc-company-info">
                          <p className="name">{COMPANY_INFO.name}</p>
                          <p>{COMPANY_INFO.postal}</p>
                          <p>{COMPANY_INFO.address1}</p>
                          <p>{COMPANY_INFO.address2}</p>
                          <p>TEL: {COMPANY_INFO.tel}</p>
                          <p>Email: {COMPANY_INFO.email}</p>
                        </div>
                      </div>
                    </section>
                    <table className="invoice-info-container invoice-meta-table">
                      <tbody>
                        <tr><th>見積日</th><td><strong>{preview.issueDate || '-'}</strong></td></tr>
                        <tr><th>発行部署</th><td><strong>{preview.senderDept || '（未設定）'}</strong></td></tr>
                        <tr><th>有効期限</th><td><strong>{preview.dueDate || '-'}</strong></td></tr>
                      </tbody>
                    </table>

                    <section className="doc-invoice-detail-clean">
                      <table className="line-items-container">
                        <thead>
                          <tr>
                            <th className="heading-quantity">数量</th>
                            <th className="heading-description">内容</th>
                            <th className="heading-price">単価</th>
                            <th className="heading-subtotal">小計</th>
                          </tr>
                        </thead>
                        <tbody>{renderPreviewLineRows('（見積内容未入力）')}</tbody>
                      </table>
                    </section>

                    <table className="line-items-container has-bottom-border">
                      <thead>
                        <tr>
                          <th>見積概要 / 支払条件</th>
                          <th>有効期限</th>
                          <th>見積合計額</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="payment-info">
                            <div>概要: <strong>{preview.purpose || '（未入力）'}</strong></div>
                            <div>対象: <strong>{preview.targetStore || '（未入力）'}</strong></div>
                            <div>支払条件: <strong>{preview.paymentTerms || '（未入力）'}</strong></div>
                            <div>税率: <strong>{preview.taxRate ?? 10}%</strong></div>
                            {(preview.noteLines || []).length
                              ? <div>備考: <strong>{preview.noteLines.join(' / ')}</strong></div>
                              : null}
                          </td>
                          <td className="large">{preview.dueDate || '-'}</td>
                          <td className="large total">{preview.amountDisplay || '¥0'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </>
                ) : preview.templateKey === 'contract_review' ? (
                  <>
                    <section className="doc-contract-title-top">
                      <p className="doc-contract-date-top">締結日&nbsp;&nbsp;{preview.dueDate || '-'}</p>
                      <h2>{preview.docTitle || '契約書'}</h2>
                      {preview.docSubtitle ? <p className="doc-company-subtitle">{preview.docSubtitle}</p> : null}
                      <p className="doc-company-meta">契約番号: {preview.contractId || '（未入力）'}</p>
                    </section>
                    <section className="doc-company-head">
                      <div className="doc-company-title">
                        <div className="doc-company-recipient-box">
                          <p className="doc-company-recipient">
                            {preview.counterparty || '（契約先未入力）'}
                            {'\n'}
                            {preview.receiverOnchu || 'ご担当者様'}
                          </p>
                        </div>
                      </div>
                      <div className="doc-company-brand">
                        <div className="doc-company-logo-wrap">
                          <img className="doc-company-logo" src={preview.companyLogoSrc || companyLogoWide} alt="ミセサポ ロゴ" />
                        </div>
                        <div className="doc-company-info">
                          <p className="name">{COMPANY_INFO.name}</p>
                          <p>{COMPANY_INFO.postal}</p>
                          <p>{COMPANY_INFO.address1}</p>
                          <p>{COMPANY_INFO.address2}</p>
                          <p>TEL: {COMPANY_INFO.tel}</p>
                          <p>Email: {COMPANY_INFO.email}</p>
                        </div>
                      </div>
                    </section>

                    <section className="doc-contract-top">
                      <div className="doc-contract-parties">
                        <div>
                          <span>{preview.contractPartyALabel || '甲（契約先）'}</span>
                          <strong>{preview.contractPartyAName || '（未入力）'}</strong>
                          <p>担当: {preview.contractPartyAContact || '（担当者未入力）'}</p>
                        </div>
                        <div>
                          <span>{preview.contractPartyBLabel || '乙（サービス提供者）'}</span>
                          <strong>{preview.contractPartyBName || '（未入力）'}</strong>
                          <p>TEL: {preview.contractPartyBPhone || '（電話未入力）'}</p>
                        </div>
                      </div>
                      <table className="doc-sheet-table">
                        <tbody>
                          <tr>
                            <th>契約番号</th>
                            <td>{preview.contractId || '（未入力）'}</td>
                          </tr>
                          <tr>
                            <th>契約件名</th>
                            <td>{preview.subject || '（件名未入力）'}</td>
                          </tr>
                          <tr>
                            <th>契約期間</th>
                            <td>{`${preview.contractTermStart || '（未入力）'} 〜 ${preview.contractTermEnd || '（未入力）'}`}</td>
                          </tr>
                          <tr>
                            <th>契約金額</th>
                            <td>{preview.contractAmountDisplay || '¥0'}</td>
                          </tr>
                          <tr>
                            <th>支払条件</th>
                            <td>{preview.paymentTerms || '（未入力）'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </section>

                    <section className="doc-sheet-block">
                      <h4>第1条（契約趣旨）</h4>
                      <p>{preview.purpose || '（未入力）'}</p>
                    </section>

                    <section className="doc-sheet-block">
                      <h4>第2条（条項）</h4>
                      <ol>
                        {(preview.detailLines || []).length
                          ? preview.detailLines.map((line, idx) => <li key={`con-d-${idx}`}>{line}</li>)
                          : <li>（条項未入力）</li>}
                      </ol>
                    </section>

                    <section className="doc-sheet-block">
                      <h4>第3条（納品・検収条件）</h4>
                      {(preview.deliverableLines || []).length
                        ? preview.deliverableLines.map((line, idx) => <p key={`con-v-${idx}`}>{line}</p>)
                        : <p>（未入力）</p>}
                    </section>

                    <section className="doc-sheet-block">
                      <h4>第4条（特記事項）</h4>
                      {(preview.noteLines || []).length
                        ? preview.noteLines.map((line, idx) => <p key={`con-n-${idx}`}>{line}</p>)
                        : <p>（備考なし）</p>}
                    </section>

                    <section className="doc-sheet-block">
                      <h4>別紙・添付資料</h4>
                      {(preview.attachmentLines || []).length
                        ? preview.attachmentLines.map((line, idx) => <p key={`con-a-${idx}`}>{line}</p>)
                        : <p>（添付なし）</p>}
                    </section>

                    <section className="doc-signature-grid">
                      <div className="doc-signature-card">
                        <p className="doc-signature-label">{preview.contractPartyALabel || '甲（契約先）'}</p>
                        <p className="doc-signature-name">{preview.contractPartyAName || '（未入力）'}</p>
                        <p>住所: {preview.contractPartyAAddress || '（住所未入力）'}</p>
                        <p>担当: {preview.contractPartyAContact || '（担当者未入力）'}</p>
                        <p>TEL: {preview.contractPartyAPhone || '（電話未入力）'}</p>
                        <p>MAIL: {preview.contractPartyAEmail || '（メール未入力）'}</p>
                        <p className="doc-signature-stamp">{preview.contractPartyAStamp || '㊞'}</p>
                      </div>
                      <div className="doc-signature-card">
                        <p className="doc-signature-label">{preview.contractPartyBLabel || '乙（サービス提供者）'}</p>
                        <p className="doc-signature-name">{preview.contractPartyBName || '（未入力）'}</p>
                        <p>住所: {preview.contractPartyBAddress || '（住所未入力）'}</p>
                        <p>TEL: {preview.contractPartyBPhone || '（電話未入力）'}</p>
                        <p>MAIL: {preview.contractPartyBEmail || '（メール未入力）'}</p>
                      </div>
                    </section>
                  </>
                ) : (
                  <>
                    <section className="doc-letter-meta">
                      <div className="doc-letter-recipient">
                        <p>{preview.receiverDept}</p>
                        <p>{preview.receiverDisplayName}</p>
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

                    <section className="doc-sheet-block">
                      <table className="doc-sheet-table">
                        <tbody>
                          <tr>
                            <th>希望期限</th>
                            <td>{preview.dueDate || '-'}</td>
                          </tr>
                          <tr>
                            <th>優先度</th>
                            <td>{preview.priorityLabel || '-'}</td>
                          </tr>
                          {preview.targetStore ? (
                            <tr>
                              <th>対象店舗/案件</th>
                              <td>{preview.targetStore}</td>
                            </tr>
                          ) : null}
                          {preview.budgetRange ? (
                            <tr>
                              <th>想定予算</th>
                              <td>{preview.budgetRange}</td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                    </section>

                    <section className="doc-sheet-block">
                      <h4>依頼目的</h4>
                      <p>{preview.purpose || '（未入力）'}</p>
                    </section>

                    <section className="doc-sheet-block">
                      <h4>依頼内容</h4>
                      <ul>
                        {(preview.detailLines || []).length
                          ? preview.detailLines.map((line, idx) => <li key={`req-d-${idx}`}>{line}</li>)
                          : <li>（未入力）</li>}
                      </ul>
                    </section>

                    <section className="doc-sheet-block">
                      <h4>成果物・完了条件</h4>
                      {(preview.deliverableLines || []).length
                        ? preview.deliverableLines.map((line, idx) => <p key={`req-v-${idx}`}>{line}</p>)
                        : <p>（未入力）</p>}
                    </section>

                    <section className="doc-sheet-block">
                      <h4>備考</h4>
                      {(preview.noteLines || []).length
                        ? preview.noteLines.map((line, idx) => <p key={`req-n-${idx}`}>{line}</p>)
                        : <p>（備考なし）</p>}
                    </section>

                    <section className="doc-sheet-block">
                      <h4>添付/参照</h4>
                      {(preview.attachmentLines || []).length
                        ? preview.attachmentLines.map((line, idx) => <p key={`req-a-${idx}`}>{line}</p>)
                        : <p>（添付なし）</p>}
                    </section>

                    <div className="doc-letter-closing">敬具</div>
                  </>
                )}
                </article>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
