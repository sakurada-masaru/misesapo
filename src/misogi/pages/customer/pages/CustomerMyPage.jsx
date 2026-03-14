import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { getAdminWorkReports } from '../../shared/api/adminWorkReportsApi';
import {
  fetchCustomerPortalChats,
  postCustomerPortalChat,
} from '../../shared/utils/customerPortalChat';
import { buildCustomerPortalAiReply } from '../../shared/utils/customerPortalAi';
import './customer-mypage.css';

const DETAIL_PANES = ['left', 'center', 'right'];
const CUSTOMER_REPORT_SOUKO_SOURCE = 'customer_result_report';
const CUSTOMER_REPORT_FOLDER_ID = 'customer_report_results';
const CUSTOMER_REPORT_FOLDER_NAME = '作業完了レポート';
const DEFAULT_SERVICE_CATALOG_SPLIT_FILES = [
  '0102.png',
  '0506.png',
  '0708.png',
  '0910.png',
  '1112.png',
  '1314.png',
  '1516.png',
  '1718.png',
  '1920.png',
  '2122.png',
  '2223.png',
  '2425.png',
  '2627.png',
  '2829.png',
  '3031.png',
  '3233.png',
  '3435.png',
];

function authHeaders() {
  const token =
    localStorage.getItem('idToken') ||
    localStorage.getItem('cognito_id_token') ||
    localStorage.getItem('id_token') ||
    localStorage.getItem('accessToken') ||
    localStorage.getItem('cognito_access_token') ||
    localStorage.getItem('token') ||
    '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function asItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.rows)) return data.rows;
  return [];
}

function safeArr(v) {
  return Array.isArray(v) ? v : [];
}

function norm(v) {
  return String(v || '').trim();
}

function ensureHttpUrl(raw) {
  const s = norm(raw);
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

const MISOGI_CUSTOMER_MYPAGE_BASE = String(
  import.meta.env?.VITE_MISOGI_CUSTOMER_MYPAGE_URL || 'https://misesapo.co.jp/misogi/#/customer/mypage'
).trim();

function withQueryParam(url, key, value) {
  const raw = norm(url);
  const paramKey = norm(key);
  const paramValue = encodeURIComponent(norm(value));
  if (!raw || !paramKey || !paramValue) return raw;
  const re = new RegExp(`([?&])${paramKey}=[^&#]*`);
  if (re.test(raw)) return raw.replace(re, `$1${paramKey}=${paramValue}`);
  const hashIndex = raw.indexOf('#');
  if (hashIndex >= 0) {
    const left = raw.slice(0, hashIndex);
    const hash = raw.slice(hashIndex);
    return `${left}${hash}${hash.includes('?') ? '&' : '?'}${paramKey}=${paramValue}`;
  }
  return `${raw}${raw.includes('?') ? '&' : '?'}${paramKey}=${paramValue}`;
}

function buildCustomerMyPageUrl(tenpoId) {
  const id = norm(tenpoId) || 'store';
  const base = MISOGI_CUSTOMER_MYPAGE_BASE || 'https://misesapo.co.jp/misogi/#/customer/mypage';
  return withQueryParam(base, 'tenpo_id', id);
}

function normalizeStoreRow(row) {
  const id = norm(row?.tenpo_id || row?.id || row?.store_id);
  const name = norm(row?.name || row?.tenpo_name || row?.store_name) || '(店舗名未設定)';
  const address = norm(row?.address) || '住所未設定';
  const yagou = norm(row?.yagou_name);
  const sourceUrl = row?.customer_mypage_url || row?.mypage_url || row?.url;
  const explicitUrl = ensureHttpUrl(sourceUrl);
  const url = /customer\/mypage/i.test(explicitUrl)
    ? withQueryParam(explicitUrl, 'tenpo_id', id || 'store')
    : buildCustomerMyPageUrl(id);
  return {
    id: id || name,
    name,
    yagou,
    address,
    url,
    raw: row && typeof row === 'object' ? row : {},
  };
}

const BASIC_INFO_PROFILE_KEYS = [
  'name',
  'address',
  'phone',
  'url',
  'business_hours',
  'customer_attendance',
  'key_handling',
  'contact_method',
  'security_info',
  'customer_contact_name',
  'customer_contact_phone',
  'sales_owner',
];

function normalizeBasicInfoProfile(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  return {
    name: norm(src.name),
    address: norm(src.address),
    phone: norm(src.phone),
    url: ensureHttpUrl(src.url),
    business_hours: norm(src.business_hours),
    customer_attendance: norm(src.customer_attendance),
    key_handling: norm(src.key_handling),
    contact_method: norm(src.contact_method),
    security_info: norm(src.security_info),
    customer_contact_name: norm(src.customer_contact_name),
    customer_contact_phone: norm(src.customer_contact_phone),
    sales_owner: norm(src.sales_owner),
  };
}

function isBlankValue(v) {
  return norm(v) === '';
}

function mergeBasicInfoProfile(baseProfile, overlayProfile) {
  const base = normalizeBasicInfoProfile(baseProfile);
  const overlay = normalizeBasicInfoProfile(overlayProfile);
  const next = { ...base };
  BASIC_INFO_PROFILE_KEYS.forEach((k) => {
    if (!isBlankValue(overlay[k])) next[k] = overlay[k];
  });
  return normalizeBasicInfoProfile(next);
}

function resolveBasicInfoByHierarchy(storeProfile, yagouSharedProfile, toriSharedProfile) {
  const byTori = mergeBasicInfoProfile(storeProfile, toriSharedProfile);
  return mergeBasicInfoProfile(byTori, yagouSharedProfile);
}

function normalizeCustomBasicInfoFields(raw) {
  const srcList = Array.isArray(raw)
    ? raw
    : (raw && typeof raw === 'object'
      ? Object.entries(raw).map(([label, value]) => ({ label, value }))
      : []);
  return srcList
    .map((it) => ({
      label: norm(it?.label ?? it?.key ?? it?.name ?? ''),
      value: norm(it?.value ?? it?.v ?? it?.text ?? ''),
    }))
    .filter((it) => it.label || it.value);
}

function extractBasicInfoProfileFromTenpoRecord(tp, fallbackStore) {
  const tenpo = tp && typeof tp === 'object' ? tp : {};
  const spec = tenpo?.karte_detail?.spec && typeof tenpo.karte_detail.spec === 'object'
    ? tenpo.karte_detail.spec
    : {};
  return normalizeBasicInfoProfile({
    name: tenpo?.name || tenpo?.tenpo_name || tenpo?.store_name || fallbackStore?.name || '',
    address: tenpo?.address || fallbackStore?.address || '',
    phone: tenpo?.phone || '',
    url: tenpo?.url || tenpo?.site_url || tenpo?.website || '',
    business_hours: spec?.business_hours || tenpo?.business_hours || tenpo?.eigyou_jikan || '',
    customer_attendance: spec?.customer_attendance || '',
    key_handling: spec?.key_handling || tenpo?.key_handling || '',
    contact_method: spec?.contact_method || tenpo?.contact_method || '',
    security_info: spec?.security_info || tenpo?.security_info || '',
    customer_contact_name: spec?.customer_contact_name || tenpo?.tantou_name || tenpo?.contact_name || tenpo?.contact_person || '',
    customer_contact_phone: spec?.customer_contact_phone || tenpo?.tantou_phone || tenpo?.contact_person_phone || tenpo?.contact_phone || '',
    sales_owner: spec?.sales_owner || '',
  });
}

function fileExt(fileName, key = '') {
  const base = norm(fileName || key);
  const i = base.lastIndexOf('.');
  if (i < 0) return '';
  return base.slice(i + 1).toLowerCase();
}

function isImageContentType(ct = '') {
  return String(ct || '').toLowerCase().startsWith('image/');
}

function isImageFile(fileName, contentType, key = '') {
  if (isImageContentType(contentType)) return true;
  const ext = fileExt(fileName, key);
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif', 'heic', 'heif'].includes(ext);
}

function fileKindLabel(fileName, contentType, key) {
  if (isImageFile(fileName, contentType, key)) return 'IMG';
  const ext = fileExt(fileName, key);
  if (ext === 'pdf') return 'PDF';
  if (['doc', 'docx'].includes(ext)) return 'DOC';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'SHEET';
  if (['zip', 'rar', '7z'].includes(ext)) return 'ZIP';
  if (['mp4', 'mov', 'avi'].includes(ext)) return 'VIDEO';
  return ext ? ext.toUpperCase() : 'FILE';
}

function parseYmdToInt(ymd) {
  const s = norm(ymd);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return Number(`${m[1]}${m[2]}${m[3]}`);
}

function extractYmd(ymdLike) {
  const s = norm(ymdLike);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function ymdFromDate(dateLike) {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function monthStart(dateLike) {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(dateLike, delta) {
  const d = monthStart(dateLike);
  return new Date(d.getFullYear(), d.getMonth() + Number(delta || 0), 1);
}

function sortSupportHistoryNewestFirst(list) {
  const arr = Array.isArray(list) ? list.slice() : [];
  const keyed = arr.map((it, idx) => {
    const key = parseYmdToInt(it?.date);
    return { it, idx, key: key == null ? -1 : key };
  });
  keyed.sort((a, b) => {
    if (a.key !== b.key) return b.key - a.key;
    return a.idx - b.idx;
  });
  return keyed.map((x) => x.it);
}

function fmtDateTimeJst(iso) {
  const s = iso instanceof Date ? iso.toISOString() : norm(iso);
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  try {
    return new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return s;
  }
}

function fmtYmd(dateLike) {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function catalogPageLabel(fileName) {
  const stem = norm(fileName).replace(/\.[^.]+$/, '');
  const m = stem.match(/^(\d{2})(\d{2})$/);
  if (!m) return stem || 'ページ';
  const start = Number(m[1]);
  const end = Number(m[2]);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return `${m[1]}-${m[2]}ページ`;
  return `${start}-${end}ページ`;
}

function coerceObject(raw) {
  if (!raw) return {};
  if (typeof raw === 'object' && raw !== null) return raw;
  if (typeof raw !== 'string') return {};
  const s = raw.trim();
  if (!s) return {};
  try {
    const parsed = JSON.parse(s);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function compact(v) {
  return String(v || '').trim();
}

function normalizeMatchKey(v) {
  return compact(v).toLowerCase().replace(/[\s　]/g, '');
}

function pickFirstText(...vals) {
  for (const v of vals) {
    const s = compact(v);
    if (s) return s;
  }
  return '';
}

function extractReportStoreName(item, payload) {
  return pickFirstText(
    item?.target_label,
    item?.target_name,
    item?.store_name,
    item?.tenpo_name,
    payload?.store?.name,
    payload?.store_name,
    payload?.tenpo_name,
    payload?.target_name,
    payload?.header?.store_name,
    payload?.header?.tenpo_name,
    payload?.overview?.store_name
  );
}

function extractReportTenpoId(item, payload) {
  return pickFirstText(
    item?.tenpo_id,
    item?.store_id,
    item?.target_id,
    payload?.tenpo_id,
    payload?.store_id,
    payload?.target_id,
    payload?.store?.tenpo_id
  );
}

function extractReportResult(item, payload) {
  const direct = pickFirstText(
    item?.outcome,
    item?.result,
    item?.summary,
    item?.memo,
    payload?.outcome,
    payload?.result,
    payload?.result_today,
    payload?.honjitsu_seika,
    payload?.summary,
    payload?.memo,
    payload?.note,
    payload?.store?.note,
    payload?.header?.summary,
    payload?.overview?.summary
  );
  if (direct) return direct;

  const services = Array.isArray(payload?.services) ? payload.services : [];
  const names = services
    .map((sv) => compact(sv?.name))
    .filter(Boolean)
    .slice(0, 5);
  if (names.length) return `実施内容: ${names.join(' / ')}`;

  return '';
}

function reportDateKey(item, payload) {
  return pickFirstText(
    item?.work_date,
    payload?.work_date,
    payload?.date,
    payload?.header?.work_date,
    String(item?.created_at || '').slice(0, 10)
  );
}

function reportTimeKey(item) {
  const ts = Date.parse(String(item?.created_at || item?.updated_at || ''));
  return Number.isFinite(ts) ? ts : 0;
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildResultReportFileName(row, idx = 0) {
  const ymd = String(row?.workDate || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  const stamp = ymd ? `${ymd[1]}${ymd[2]}${ymd[3]}` : fmtYmd(new Date()).replace(/-/g, '');
  const suffix = String(Number(idx || 0) + 1).padStart(2, '0');
  return `作業完了レポート_${stamp}_${suffix}.pdf`;
}

async function buildResultReportPdfBlob({ row, storeLabel }) {
  if (typeof document === 'undefined') {
    throw new Error('PDF生成に必要なブラウザ環境が見つかりません');
  }
  const paper = document.createElement('div');
  paper.style.position = 'fixed';
  paper.style.left = '-100000px';
  paper.style.top = '0';
  paper.style.width = '794px';
  paper.style.minHeight = '1123px';
  paper.style.background = '#fff';
  paper.style.color = '#111';
  paper.style.padding = '64px 72px';
  paper.style.boxSizing = 'border-box';
  paper.style.fontFamily = `"Hiragino Sans","Yu Gothic","Meiryo",sans-serif`;
  paper.innerHTML = `
    <div style="display:grid;gap:22px;">
      <div style="display:grid;gap:8px;">
        <h1 style="margin:0;font-size:30px;letter-spacing:0.06em;">作業完了レポート</h1>
        <div style="display:flex;gap:10px;flex-wrap:wrap;font-size:16px;color:#444;">
          <span>店舗: ${escapeHtml(storeLabel || '-')}</span>
          <span>作業日: ${escapeHtml(row?.workDate || '-')}</span>
          <span>作成: ${escapeHtml(fmtDateTimeJst(row?.createdAt) || '-')}</span>
        </div>
      </div>
      <div style="border-top:2px solid #222;padding-top:16px;">
        <div style="font-size:18px;font-weight:700;margin-bottom:10px;">結果</div>
        <div style="font-size:16px;line-height:1.8;white-space:pre-wrap;">${escapeHtml(row?.result || '-')}</div>
      </div>
    </div>
  `;
  document.body.appendChild(paper);
  try {
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
    return pdf.output('blob');
  } finally {
    paper.remove();
  }
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'report.pdf';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  }
}

function isRunningYoteiStatus(row) {
  const s = pickFirstText(
    row?.jokyo,
    row?.ugoki_jotai,
    row?.ugoki_jokyo,
    row?.ugoki_status,
    row?.jotai,
    row?.status
  ).toLowerCase();
  return s === 'working' || s === 'shinkou' || s === 'in_progress' || s === 'progress' || s === 'running' || s === '実行中' || s === '進行中';
}

function isClosedYoteiStatus(row) {
  const s = pickFirstText(
    row?.jokyo,
    row?.ugoki_jotai,
    row?.ugoki_jokyo,
    row?.ugoki_status,
    row?.jotai,
    row?.status,
    row?.state
  ).toLowerCase();
  return s === 'done'
    || s === 'kanryou'
    || s === 'completed'
    || s === 'complete'
    || s === 'torikeshi'
    || s === 'cancel'
    || s === 'canceled'
    || s === 'cancelled'
    || s === 'inactive'
    || s === '無効'
    || s === '完了'
    || s === '取消';
}

function resolveYoteiDateTime(row, type = 'start') {
  const direct = pickFirstText(
    type === 'start' ? row?.start_at : row?.end_at,
    type === 'start' ? row?.start_datetime : row?.end_datetime,
    type === 'start' ? row?.planned_start_at : row?.planned_end_at,
    type === 'start' ? row?.scheduled_start_at : row?.scheduled_end_at,
    type === 'start' ? row?.starts_at : row?.ends_at
  );
  const directTs = Date.parse(direct);
  if (direct && Number.isFinite(directTs)) return new Date(directTs);

  const ymd = pickFirstText(row?.date, row?.scheduled_date, row?.work_date, row?.target_date).slice(0, 10);
  const hhmmRaw = pickFirstText(
    type === 'start' ? row?.start_hhmm : row?.end_hhmm,
    type === 'start' ? row?.start_time : row?.end_time,
    type === 'start' ? row?.from_hhmm : row?.to_hhmm
  ).slice(0, 5);
  const hhmm = /^\d{2}:\d{2}$/.test(hhmmRaw) ? hhmmRaw : '';
  if (!ymd || !hhmm) return null;
  const d = new Date(`${ymd}T${hhmm}:00+09:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function fmtDateJst(dateLike) {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(d.getTime())) return '-';
  try {
    return new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function formatBytes(size) {
  const n = Number(size || 0);
  if (!Number.isFinite(n) || n <= 0) return '-';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function normalizeSoukoFiles(soukoRecord) {
  return safeArr(soukoRecord?.files)
    .map((it) => {
      const previewUrl = norm(it?.preview_url);
      const getUrl = norm(it?.get_url || it?.url);
      return {
        key: norm(it?.key),
        file_name: norm(it?.file_name),
        content_type: norm(it?.content_type),
        size: Number(it?.size || 0) || 0,
        uploaded_at: norm(it?.uploaded_at),
        kubun: norm(it?.kubun),
        doc_category: norm(it?.doc_category),
        open_url: previewUrl || getUrl,
      };
    })
    .filter((it) => it.key);
}

function toHalfWidthDigits(input) {
  return String(input || '').replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
}

function isPdfFile(fileName, contentType, key = '') {
  if (String(contentType || '').toLowerCase().includes('pdf')) return true;
  return fileExt(fileName, key) === 'pdf';
}

function classifyBillingDocumentType(file) {
  const item = file && typeof file === 'object' ? file : {};
  const source = [
    normalizeMatchKey(item.doc_category),
    normalizeMatchKey(item.kubun),
    normalizeMatchKey(item.file_name || item.key),
  ].join('|');
  if (!source) return '';
  if (/receipt|領収|領収書|ryoushu|ryoshu|入金/.test(source)) return 'receipt';
  if (/invoice|請求|請求書|billing|seikyuu|seikyu/.test(source)) return 'invoice';
  return '';
}

function extractBillingYearMonth(raw) {
  const source = toHalfWidthDigits(norm(raw));
  if (!source) return null;
  const compacted = source.replace(/\s+/g, '');
  let m = compacted.match(/(20\d{2})[\/_.-]?(0?[1-9]|1[0-2])(?:月|[\/_.-]|$)/);
  if (!m) m = compacted.match(/(20\d{2})(0[1-9]|1[0-2])/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  if (month < 1 || month > 12) return null;
  return { year, month };
}

function formatBillingPeriodLabel(yearMonth) {
  if (!yearMonth || !Number.isFinite(yearMonth.year) || !Number.isFinite(yearMonth.month)) return '';
  return `${yearMonth.year}年${String(yearMonth.month).padStart(2, '0')}月分`;
}

function extractBillingPeriodLabel(file) {
  const item = file && typeof file === 'object' ? file : {};
  const byName = extractBillingYearMonth(item.file_name);
  if (byName) return formatBillingPeriodLabel(byName);
  const byKey = extractBillingYearMonth(item.key);
  if (byKey) return formatBillingPeriodLabel(byKey);
  const uploaded = new Date(item.uploaded_at);
  if (!Number.isNaN(uploaded.getTime())) {
    return `${uploaded.getFullYear()}年${String(uploaded.getMonth() + 1).padStart(2, '0')}月分`;
  }
  return '時期不明';
}

function billingTypeLabel(type) {
  return type === 'receipt' ? '領収書' : '請求書';
}

function buildBasicInfoForm({ tenpoLike, fallbackStore, resolvedProfile, torihikisakiLike, yagouLike }) {
  const tenpo = tenpoLike && typeof tenpoLike === 'object' ? tenpoLike : {};
  const spec = (tenpo.karte_detail && typeof tenpo.karte_detail === 'object' && tenpo.karte_detail.spec && typeof tenpo.karte_detail.spec === 'object')
    ? tenpo.karte_detail.spec
    : {};
  const resolved = normalizeBasicInfoProfile(resolvedProfile || {});
  return {
    torihikisaki_name: norm(
      tenpo.torihikisaki_name ||
      tenpo.torihikisaki ||
      tenpo.company_name ||
      tenpo.customer_name ||
      torihikisakiLike?.name
    ),
    yagou_name: norm(tenpo.yagou_name || yagouLike?.name || fallbackStore?.yagou),
    name: norm(resolved.name || tenpo.name || tenpo.tenpo_name || tenpo.store_name || fallbackStore?.name),
    address: norm(resolved.address || tenpo.address || fallbackStore?.address),
    phone: norm(resolved.phone || tenpo.phone),
    customer_contact_name: norm(resolved.customer_contact_name || spec.customer_contact_name || tenpo.tantou_name || tenpo.contact_name),
    business_hours: norm(resolved.business_hours || spec.business_hours || tenpo.business_hours || tenpo.eigyou_jikan),
  };
}

function normalizeServiceLabel(raw) {
  const s = norm(raw);
  if (!s) return '';
  return s
    .replace(/\b(?:SERVICE|SV|SERV|MENU|TASK|PLAN)#[-A-Za-z0-9_]+\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function extractCurrentSubscription(tenpoLike) {
  const tenpo = tenpoLike && typeof tenpoLike === 'object' ? tenpoLike : {};
  const karteDetail = (tenpo.karte_detail && typeof tenpo.karte_detail === 'object') ? tenpo.karte_detail : {};
  const plan = (karteDetail.plan && typeof karteDetail.plan === 'object') ? karteDetail.plan : {};
  const servicePlan = Array.isArray(karteDetail.service_plan) ? karteDetail.service_plan : [];

  const planTags = [];
  const pushPlanTag = (value) => {
    const label = normalizeServiceLabel(value);
    if (!label) return;
    if (!planTags.includes(label)) planTags.push(label);
  };
  pushPlanTag(plan.plan_name);
  pushPlanTag(plan.name);
  pushPlanTag(tenpo.plan_name);
  pushPlanTag(tenpo.plan);
  pushPlanTag(tenpo.work_type);

  const frequencyRaw = norm(plan.plan_frequency).toLowerCase();
  if (frequencyRaw) {
    const frequencyLabelMap = {
      monthly: '毎月',
      weekly: '毎週',
      biweekly: '隔週',
      quarterly: '四半期',
      yearly: '年次',
    };
    const frequencyLabel = frequencyLabelMap[frequencyRaw] || norm(plan.plan_frequency);
    if (frequencyLabel) pushPlanTag(`頻度: ${frequencyLabel}`);
  }

  const serviceTags = [];
  const pushServiceTag = (value) => {
    const label = normalizeServiceLabel(value);
    if (!label) return;
    if (!serviceTags.includes(label)) serviceTags.push(label);
  };

  servicePlan.forEach((sp) => {
    pushServiceTag(sp?.service_name);
    pushServiceTag(sp?.service_id);
  });

  pushServiceTag(tenpo.service_name);
  if (Array.isArray(tenpo.service_names)) tenpo.service_names.forEach(pushServiceTag);
  if (Array.isArray(tenpo.services)) {
    tenpo.services.forEach((sv) => {
      if (sv && typeof sv === 'object') {
        pushServiceTag(sv.name || sv.service_name || sv.service_id || sv.id);
        return;
      }
      pushServiceTag(sv);
    });
  }

  if (Array.isArray(plan.service_names)) plan.service_names.forEach(pushServiceTag);
  if (Array.isArray(plan.services)) {
    plan.services.forEach((sv) => {
      if (sv && typeof sv === 'object') {
        pushServiceTag(sv.name || sv.service_name || sv.service_id || sv.id);
        return;
      }
      pushServiceTag(sv);
    });
  }

  return {
    planTags,
    serviceTags,
  };
}

export default function CustomerMyPage() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stores, setStores] = useState([]);

  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailTenpo, setDetailTenpo] = useState(null);
  const [detailTorihikisaki, setDetailTorihikisaki] = useState(null);
  const [detailYagou, setDetailYagou] = useState(null);
  const [detailSoukoFiles, setDetailSoukoFiles] = useState([]);
  const [resultReportsLoading, setResultReportsLoading] = useState(false);
  const [resultReportsError, setResultReportsError] = useState('');
  const [resultReports, setResultReports] = useState([]);
  const [resultReportSavingId, setResultReportSavingId] = useState('');
  const [resultReportActionMessage, setResultReportActionMessage] = useState('');
  const [resultReportActionError, setResultReportActionError] = useState('');
  const [customerNoticesLoading, setCustomerNoticesLoading] = useState(false);
  const [customerNoticesError, setCustomerNoticesError] = useState('');
  const [customerNotices, setCustomerNotices] = useState([]);
  const [nextYotei, setNextYotei] = useState(null);
  const [basicEditMode, setBasicEditMode] = useState(false);
  const [basicSaving, setBasicSaving] = useState(false);
  const [basicSaveMessage, setBasicSaveMessage] = useState('');
  const [historySelectedDate, setHistorySelectedDate] = useState('');
  const [historyMonthCursor, setHistoryMonthCursor] = useState(() => monthStart(new Date()));
  const [centerScheduleTab, setCenterScheduleTab] = useState('calendar');
  const [detailPane, setDetailPane] = useState('center');
  const [reportViewerOpen, setReportViewerOpen] = useState(false);
  const [customerChatMessages, setCustomerChatMessages] = useState([]);
  const [customerChatDraft, setCustomerChatDraft] = useState('');
  const [customerChatLoading, setCustomerChatLoading] = useState(false);
  const [customerChatSending, setCustomerChatSending] = useState(false);
  const [customerChatError, setCustomerChatError] = useState('');
  const [catalogViewerOpen, setCatalogViewerOpen] = useState(false);
  const [catalogSelectedName, setCatalogSelectedName] = useState('');
  const [catalogImageLoading, setCatalogImageLoading] = useState(true);
  const [billingViewerOpen, setBillingViewerOpen] = useState(false);
  const [billingViewerType, setBillingViewerType] = useState('invoice');
  const [billingSelectedKey, setBillingSelectedKey] = useState('');
  const [basicInfoForm, setBasicInfoForm] = useState({
    torihikisaki_name: '',
    yagou_name: '',
    name: '',
    address: '',
    phone: '',
    customer_contact_name: '',
    business_hours: '',
  });

  const scopedTenpoId = useMemo(() => {
    const sp = new URLSearchParams(location.search || '');
    return norm(sp.get('tenpo_id'));
  }, [location.search]);

  const masterApiBase = useMemo(() => (
    String(import.meta.env.VITE_MASTER_API_BASE || '/api-master').replace(/\/$/, '')
  ), []);

  const loadStores = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${masterApiBase}/master/tenpo?limit=20000&jotai=yuko`, {
        headers: { ...authHeaders() },
        cache: 'no-store',
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`店舗一覧の取得に失敗 (${res.status}) ${text}`.trim());
      }
      const data = await res.json();
      const rows = asItems(data).map(normalizeStoreRow);
      setStores(rows);
    } catch (e) {
      setError(String(e?.message || e || '店舗一覧の取得に失敗しました'));
      setStores([]);
    } finally {
      setLoading(false);
    }
  }, [masterApiBase]);

  const loadScopedDetail = useCallback(async () => {
    if (!scopedTenpoId) {
      setDetailTenpo(null);
      setDetailTorihikisaki(null);
      setDetailYagou(null);
      setDetailSoukoFiles([]);
      setDetailError('');
      return;
    }

    setDetailLoading(true);
    setDetailError('');
    try {
      let tenpoRow = null;
      const listRes = await fetch(
        `${masterApiBase}/master/tenpo?limit=5&jotai=yuko&tenpo_id=${encodeURIComponent(scopedTenpoId)}`,
        { headers: { ...authHeaders() }, cache: 'no-store' }
      );
      if (listRes.ok) {
        const listData = await listRes.json();
        const hit = asItems(listData).find((it) => {
          const id = norm(it?.tenpo_id || it?.id || it?.store_id);
          return id === scopedTenpoId;
        });
        tenpoRow = hit || null;
      }

      if (!tenpoRow) {
        const idRes = await fetch(`${masterApiBase}/master/tenpo/${encodeURIComponent(scopedTenpoId)}`, {
          headers: { ...authHeaders() },
          cache: 'no-store',
        });
        if (idRes.ok) {
          tenpoRow = await idRes.json();
        }
      }

      if (!tenpoRow) {
        throw new Error(`店舗(${scopedTenpoId})が見つかりません`);
      }

      setDetailTenpo(tenpoRow);

      const fetchOneByIdOrList = async ({ collection, id, listQuery }) => {
        const targetId = norm(id);
        if (!targetId) return null;
        try {
          const qs = new URLSearchParams({
            limit: '2000',
            jotai: 'yuko',
            ...(listQuery || {}),
          });
          const res = await fetch(`${masterApiBase}/master/${encodeURIComponent(collection)}?${qs.toString()}`, {
            headers: { ...authHeaders() },
            cache: 'no-store',
          });
          if (!res.ok) return null;
          const data = await res.json();
          return asItems(data).find((it) => norm(it?.[`${collection}_id`] || it?.id) === targetId) || null;
        } catch {
          return null;
        }
      };

      const toriId = norm(tenpoRow?.torihikisaki_id);
      const yagouId = norm(tenpoRow?.yagou_id);
      const [toriRow, yagouRow] = await Promise.all([
        fetchOneByIdOrList({ collection: 'torihikisaki', id: toriId, listQuery: {} }),
        fetchOneByIdOrList({
          collection: 'yagou',
          id: yagouId,
          listQuery: toriId ? { torihikisaki_id: toriId } : {},
        }),
      ]);
      setDetailTorihikisaki(toriRow);
      setDetailYagou(yagouRow);

      const soukoRes = await fetch(
        `${masterApiBase}/master/souko?limit=20&jotai=yuko&tenpo_id=${encodeURIComponent(scopedTenpoId)}`,
        { headers: { ...authHeaders() }, cache: 'no-store' }
      );
      if (soukoRes.ok) {
        const soukoData = await soukoRes.json();
        const souko = asItems(soukoData)?.[0] || null;
        setDetailSoukoFiles(normalizeSoukoFiles(souko));
      } else {
        setDetailSoukoFiles([]);
      }
    } catch (e) {
      setDetailTenpo(null);
      setDetailTorihikisaki(null);
      setDetailYagou(null);
      setDetailSoukoFiles([]);
      setDetailError(String(e?.message || e || '詳細の取得に失敗しました'));
    } finally {
      setDetailLoading(false);
    }
  }, [masterApiBase, scopedTenpoId]);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const prevTitle = document.title;
    const manifestLink = document.querySelector('link[rel="manifest"]');
    const prevManifestHref = manifestLink?.getAttribute('href') || '';
    if (manifestLink) manifestLink.setAttribute('href', 'customer-manifest.json');

    let createdAppleTitleMeta = false;
    let prevAppleTitle = '';
    let appleTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (!appleTitleMeta) {
      appleTitleMeta = document.createElement('meta');
      appleTitleMeta.setAttribute('name', 'apple-mobile-web-app-title');
      document.head.appendChild(appleTitleMeta);
      createdAppleTitleMeta = true;
    } else {
      prevAppleTitle = appleTitleMeta.getAttribute('content') || '';
    }
    appleTitleMeta.setAttribute('content', 'ミセサポ');

    document.title = 'ミセサポ お客様マイページ';
    return () => {
      document.title = prevTitle;
      if (manifestLink) {
        if (prevManifestHref) manifestLink.setAttribute('href', prevManifestHref);
        else manifestLink.removeAttribute('href');
      }
      if (appleTitleMeta) {
        if (createdAppleTitleMeta) {
          appleTitleMeta.remove();
        } else {
          appleTitleMeta.setAttribute('content', prevAppleTitle);
        }
      }
    };
  }, []);

  useEffect(() => {
    loadScopedDetail();
  }, [loadScopedDetail]);

  useEffect(() => {
    setDetailPane('center');
  }, [scopedTenpoId]);

  useEffect(() => {
    setResultReportActionMessage('');
    setResultReportActionError('');
    setResultReportSavingId('');
  }, [scopedTenpoId]);

  const detailPaneIndex = useMemo(() => {
    const idx = DETAIL_PANES.indexOf(detailPane);
    return idx >= 0 ? idx : 1;
  }, [detailPane]);

  const canMovePaneLeft = detailPaneIndex > 0;
  const canMovePaneRight = detailPaneIndex < DETAIL_PANES.length - 1;
  const paneHintLabelMap = {
    left: '基本情報',
    center: 'チャット/予定',
    right: 'ストレージ',
  };
  const leftHint = canMovePaneLeft
    ? paneHintLabelMap[DETAIL_PANES[detailPaneIndex - 1]]
    : '先頭';
  const rightHint = canMovePaneRight
    ? paneHintLabelMap[DETAIL_PANES[detailPaneIndex + 1]]
    : '末尾';

  const moveDetailPane = useCallback((direction) => {
    setDetailPane((prev) => {
      const current = DETAIL_PANES.indexOf(prev);
      const currentIndex = current >= 0 ? current : 1;
      const nextIndex = Math.min(DETAIL_PANES.length - 1, Math.max(0, currentIndex + direction));
      return DETAIL_PANES[nextIndex];
    });
  }, []);

  const scopedStores = useMemo(() => {
    if (!scopedTenpoId) return stores;
    const key = scopedTenpoId.toLowerCase();
    return stores.filter((it) => norm(it.id).toLowerCase() === key);
  }, [stores, scopedTenpoId]);

  const activeStore = useMemo(() => {
    if (!scopedTenpoId) return null;
    return scopedStores[0] || stores.find((it) => norm(it.id) === scopedTenpoId) || null;
  }, [scopedStores, stores, scopedTenpoId]);

  const effectiveTenpo = detailTenpo || activeStore?.raw || null;
  const effectiveTenpoId = norm(effectiveTenpo?.tenpo_id || effectiveTenpo?.id || activeStore?.id);
  const canEditBasicInfo = Boolean(scopedTenpoId && effectiveTenpoId);

  const tenpoBasicInfoProfile = useMemo(() => (
    extractBasicInfoProfileFromTenpoRecord(effectiveTenpo, activeStore)
  ), [effectiveTenpo, activeStore]);

  const yagouSharedBasicInfoProfile = useMemo(() => (
    normalizeBasicInfoProfile(detailYagou?.shared_basic_profile || {})
  ), [detailYagou?.shared_basic_profile]);

  const toriSharedBasicInfoProfile = useMemo(() => (
    normalizeBasicInfoProfile(detailTorihikisaki?.shared_basic_profile || {})
  ), [detailTorihikisaki?.shared_basic_profile]);

  const resolvedBasicInfoProfile = useMemo(() => (
    resolveBasicInfoByHierarchy(
      tenpoBasicInfoProfile,
      yagouSharedBasicInfoProfile,
      toriSharedBasicInfoProfile
    )
  ), [tenpoBasicInfoProfile, yagouSharedBasicInfoProfile, toriSharedBasicInfoProfile]);

  const supportHistory = useMemo(() => {
    const rows = safeArr(effectiveTenpo?.karte_detail?.support_history);
    return sortSupportHistoryNewestFirst(rows);
  }, [effectiveTenpo]);

  const supportHistoryByYmd = useMemo(() => {
    const m = new Map();
    supportHistory.forEach((row) => {
      const ymd = extractYmd(row?.date || row?.updated_at || row?.created_at);
      if (!ymd) return;
      m.set(ymd, (m.get(ymd) || 0) + 1);
    });
    return m;
  }, [supportHistory]);

  useEffect(() => {
    const latest = supportHistory.find((row) => extractYmd(row?.date || row?.updated_at || row?.created_at));
    const latestYmd = extractYmd(latest?.date || latest?.updated_at || latest?.created_at);
    if (latestYmd) setHistoryMonthCursor(monthStart(new Date(latestYmd)));
  }, [supportHistory]);

  const filteredSupportHistory = useMemo(() => {
    if (!historySelectedDate) return supportHistory;
    return supportHistory.filter((row) => {
      const ymd = extractYmd(row?.date || row?.updated_at || row?.created_at);
      return ymd === historySelectedDate;
    });
  }, [supportHistory, historySelectedDate]);

  const historyCalendarCells = useMemo(() => {
    const start = monthStart(historyMonthCursor);
    const y = start.getFullYear();
    const m = start.getMonth();
    const firstWeekday = new Date(y, m, 1).getDay();
    const monthDays = new Date(y, m + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < 42; i += 1) {
      const dayOffset = i - firstWeekday + 1;
      const d = new Date(y, m, dayOffset);
      const ymd = ymdFromDate(d);
      cells.push({
        ymd,
        day: d.getDate(),
        inMonth: d.getMonth() === m,
        count: supportHistoryByYmd.get(ymd) || 0,
      });
    }
    return cells;
  }, [historyMonthCursor, supportHistoryByYmd]);

  const historyMonthLabel = useMemo(() => {
    const d = monthStart(historyMonthCursor);
    return `${d.getFullYear()}年${d.getMonth() + 1}月`;
  }, [historyMonthCursor]);

  const loadCustomerChat = useCallback(async ({ silent = false } = {}) => {
    const tenpoId = norm(scopedTenpoId || effectiveTenpoId);
    if (!tenpoId) {
      setCustomerChatMessages([]);
      setCustomerChatError('');
      setCustomerChatLoading(false);
      return;
    }
    if (!silent) setCustomerChatLoading(true);
    try {
      const rows = await fetchCustomerPortalChats({
        masterApiBase,
        authHeaders,
        tenpoId,
      });
      setCustomerChatMessages(rows);
      setCustomerChatError('');
    } catch (e) {
      if (!silent) {
        setCustomerChatError(String(e?.message || e || 'チャットの取得に失敗しました'));
      }
    } finally {
      if (!silent) setCustomerChatLoading(false);
    }
  }, [scopedTenpoId, effectiveTenpoId, masterApiBase]);

  useEffect(() => {
    setCustomerChatDraft('');
    void loadCustomerChat();
  }, [loadCustomerChat]);

  useEffect(() => {
    const tenpoId = norm(scopedTenpoId || effectiveTenpoId);
    if (!tenpoId) return undefined;
    const timer = window.setInterval(() => {
      void loadCustomerChat({ silent: true });
    }, 15000);
    return () => window.clearInterval(timer);
  }, [scopedTenpoId, effectiveTenpoId, loadCustomerChat]);

  const loadResultReports = useCallback(async () => {
    if (!scopedTenpoId) {
      setResultReports([]);
      setResultReportsError('');
      setResultReportsLoading(false);
      return;
    }

    const scopedTenpoKey = normalizeMatchKey(effectiveTenpoId || scopedTenpoId);
    const storeNameCandidates = [
      effectiveTenpo?.name,
      effectiveTenpo?.tenpo_name,
      activeStore?.name,
      activeStore?.raw?.store_name,
      activeStore?.raw?.name,
    ]
      .map((v) => normalizeMatchKey(v))
      .filter(Boolean);
    const fallbackStoreName = pickFirstText(
      effectiveTenpo?.name,
      effectiveTenpo?.tenpo_name,
      activeStore?.name,
      activeStore?.raw?.name,
      activeStore?.raw?.store_name
    );
    const fallbackYagouName = pickFirstText(effectiveTenpo?.yagou_name, activeStore?.yagou, activeStore?.raw?.yagou_name);
    const fallbackStoreLabel = (fallbackYagouName && fallbackStoreName)
      ? `${fallbackYagouName} / ${fallbackStoreName}`
      : (fallbackYagouName || fallbackStoreName || '店舗');

    setResultReportsLoading(true);
    setResultReportsError('');
    try {
      const today = new Date();
      const from = new Date(today);
      from.setDate(today.getDate() - 180);
      const items = await getAdminWorkReports({
        from: fmtYmd(from),
        to: fmtYmd(today),
        states: ['submitted', 'triaged', 'approved', 'archived'],
        limit: 2000,
      });

      const rows = safeArr(items)
        .map((item) => {
          const payload = coerceObject(
            item?.payload ??
            item?.payload_json ??
            item?.payloadJson ??
            item?.description ??
            item?.body ??
            item?.data
          );
          const reportTenpoKey = normalizeMatchKey(extractReportTenpoId(item, payload));
          const reportStoreName = extractReportStoreName(item, payload);
          const reportStoreKey = normalizeMatchKey(reportStoreName);
          const matchedByTenpoId = scopedTenpoKey && reportTenpoKey && reportTenpoKey === scopedTenpoKey;
          const matchedByName = reportStoreKey && storeNameCandidates.some((c) => reportStoreKey === c || reportStoreKey.includes(c) || c.includes(reportStoreKey));
          const isTargetStore = matchedByTenpoId || (!matchedByTenpoId && matchedByName);
          if (!isTargetStore) return null;

          const result = extractReportResult(item, payload);
          if (!result) return null;
          return {
            id: compact(item?.id || item?.log_id || item?.report_id || item?.houkoku_id),
            workDate: reportDateKey(item, payload),
            result,
            createdAt: compact(item?.created_at || item?.updated_at),
            sortTs: reportTimeKey(item),
            storeLabel: reportStoreName || fallbackStoreLabel,
          };
        })
        .filter(Boolean)
        .sort((a, b) => {
          if (a.workDate !== b.workDate) return String(b.workDate).localeCompare(String(a.workDate));
          return b.sortTs - a.sortTs;
        })
        .slice(0, 30);

      setResultReports(rows);
    } catch (e) {
      setResultReports([]);
      setResultReportsError(String(e?.message || e || '作業完了レポートの取得に失敗しました'));
    } finally {
      setResultReportsLoading(false);
    }
  }, [scopedTenpoId, effectiveTenpoId, effectiveTenpo, activeStore]);

  const uploadResultReportToSouko = useCallback(async ({ blob, fileName }) => {
    const tenpoId = norm(scopedTenpoId || effectiveTenpoId);
    if (!tenpoId) throw new Error('店舗IDが特定できないため保存できません');
    const actorName = norm(
      localStorage.getItem('display_name') ||
      localStorage.getItem('name') ||
      localStorage.getItem('username')
    ) || 'customer';
    const actorId = norm(localStorage.getItem('user_id') || actorName) || 'customer';

    const listQs = new URLSearchParams({
      limit: '50',
      jotai: 'yuko',
      tenpo_id: tenpoId,
    });
    const listRes = await fetch(`${masterApiBase}/master/souko?${listQs.toString()}`, {
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    if (!listRes.ok) {
      const text = await listRes.text().catch(() => '');
      throw new Error(`ストレージ取得に失敗しました (${listRes.status}) ${text}`.trim());
    }
    const soukoRows = asItems(await listRes.json())
      .slice()
      .sort((a, b) => Date.parse(String(b?.updated_at || b?.created_at || 0)) - Date.parse(String(a?.updated_at || a?.created_at || 0)));

    let targetSouko = soukoRows.find((it) => norm(it?.folder_id) === CUSTOMER_REPORT_FOLDER_ID)
      || soukoRows.find((it) => norm(it?.source) === CUSTOMER_REPORT_SOUKO_SOURCE)
      || soukoRows[0]
      || null;

    if (!targetSouko) {
      const createRes = await fetch(`${masterApiBase}/master/souko`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenpo_id: tenpoId,
          source: CUSTOMER_REPORT_SOUKO_SOURCE,
          folder_id: CUSTOMER_REPORT_FOLDER_ID,
          folder_name: CUSTOMER_REPORT_FOLDER_NAME,
          name: CUSTOMER_REPORT_FOLDER_NAME,
          uploaded_by: actorId,
          uploaded_by_name: actorName,
          files: [],
          jotai: 'yuko',
        }),
      });
      if (!createRes.ok) {
        const text = await createRes.text().catch(() => '');
        throw new Error(`保存先フォルダ作成に失敗しました (${createRes.status}) ${text}`.trim());
      }
      targetSouko = await createRes.json();
    }

    const soukoId = norm(targetSouko?.souko_id);
    if (!soukoId) throw new Error('保存先フォルダID(souko_id)が取得できませんでした');

    const contentType = 'application/pdf';
    const presignRes = await fetch(`${masterApiBase}/master/souko`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'presign_upload',
        tenpo_id: tenpoId,
        file_name: fileName,
        content_type: contentType,
      }),
    });
    if (!presignRes.ok) {
      const text = await presignRes.text().catch(() => '');
      throw new Error(`アップロード準備に失敗しました (${presignRes.status}) ${text}`.trim());
    }
    const presign = await presignRes.json();
    const putUrl = norm(presign?.put_url);
    if (!putUrl) throw new Error('アップロードURLが取得できませんでした');

    const putRes = await fetch(putUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: blob,
    });
    if (!putRes.ok) {
      throw new Error(`ファイルアップロードに失敗しました (${putRes.status})`);
    }

    const existingFiles = safeArr(targetSouko?.files);
    const nextFiles = [
      ...existingFiles,
      {
        key: norm(presign?.key),
        file_name: fileName,
        content_type: contentType,
        size: Number(blob?.size || 0) || 0,
        uploaded_at: new Date().toISOString(),
        uploaded_by: actorId,
        uploaded_by_name: actorName,
        preview_url: norm(presign?.get_url),
        doc_category: 'result_report',
        kubun: 'report',
      },
    ];

    const updateRes = await fetch(`${masterApiBase}/master/souko/${encodeURIComponent(soukoId)}`, {
      method: 'PUT',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...targetSouko,
        tenpo_id: norm(targetSouko?.tenpo_id || tenpoId),
        source: norm(targetSouko?.source || CUSTOMER_REPORT_SOUKO_SOURCE),
        folder_id: norm(targetSouko?.folder_id || CUSTOMER_REPORT_FOLDER_ID),
        folder_name: norm(targetSouko?.folder_name || CUSTOMER_REPORT_FOLDER_NAME),
        name: norm(targetSouko?.name || CUSTOMER_REPORT_FOLDER_NAME),
        uploaded_by: actorId,
        uploaded_by_name: actorName,
        files: nextFiles,
      }),
    });
    if (!updateRes.ok) {
      const text = await updateRes.text().catch(() => '');
      throw new Error(`ストレージ更新に失敗しました (${updateRes.status}) ${text}`.trim());
    }
    await updateRes.json().catch(() => null);
  }, [masterApiBase, scopedTenpoId, effectiveTenpoId]);

  const onDownloadResultReport = useCallback(async (row, idx) => {
    if (!row || resultReportSavingId) return;
    const actionId = row.id || `${row.workDate || 'row'}-${idx}`;
    const fallbackStoreName = pickFirstText(
      effectiveTenpo?.name,
      effectiveTenpo?.tenpo_name,
      activeStore?.name,
      activeStore?.raw?.name,
      activeStore?.raw?.store_name
    );
    const fallbackYagouName = pickFirstText(
      effectiveTenpo?.yagou_name,
      activeStore?.yagou,
      activeStore?.raw?.yagou_name
    );
    const fallbackStoreLabel = (fallbackYagouName && fallbackStoreName)
      ? `${fallbackYagouName} / ${fallbackStoreName}`
      : (fallbackYagouName || fallbackStoreName || '店舗');
    setResultReportSavingId(actionId);
    setResultReportActionMessage('');
    setResultReportActionError('');
    try {
      const fileName = buildResultReportFileName(row, idx);
      const blob = await buildResultReportPdfBlob({
        row,
        storeLabel: row.storeLabel || fallbackStoreLabel,
      });
      downloadBlob(blob, fileName);
      await uploadResultReportToSouko({ blob, fileName });
      setResultReportActionMessage('PDFをダウンロードし、ストレージに保存しました。');
      loadScopedDetail();
    } catch (e) {
      setResultReportActionError(String(e?.message || e || 'レポート保存に失敗しました'));
    } finally {
      setResultReportSavingId('');
    }
  }, [resultReportSavingId, effectiveTenpo, activeStore, uploadResultReportToSouko, loadScopedDetail]);

  useEffect(() => {
    loadResultReports();
  }, [loadResultReports]);

  const loadCustomerNotices = useCallback(async () => {
    if (!scopedTenpoId) {
      setCustomerNotices([]);
      setCustomerNoticesError('');
      setCustomerNoticesLoading(false);
      setNextYotei(null);
      return;
    }

    const scopedTenpoKey = normalizeMatchKey(effectiveTenpoId || scopedTenpoId);
    const storeNameCandidates = [
      effectiveTenpo?.name,
      effectiveTenpo?.tenpo_name,
      activeStore?.name,
      activeStore?.raw?.store_name,
      activeStore?.raw?.name,
    ]
      .map((v) => normalizeMatchKey(v))
      .filter(Boolean);

    setCustomerNoticesLoading(true);
    setCustomerNoticesError('');
    try {
      const today = new Date();
      const from = new Date(today);
      const to = new Date(today);
      from.setDate(today.getDate() - 180);
      to.setDate(today.getDate() + 180);
      const qs = new URLSearchParams({
        from: fmtYmd(from),
        to: fmtYmd(to),
        limit: '3000',
      });
      const res = await fetch(`${masterApiBase}/yotei?${qs.toString()}`, {
        headers: { ...authHeaders() },
        cache: 'no-store',
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`お知らせの取得に失敗しました (${res.status}) ${text}`.trim());
      }
      const data = await res.json();
      const rows = asItems(data);
      const notices = [];
      const nextYoteiCandidates = [];
      const nowTs = Date.now();
      for (const row of rows) {
        const tenpoKey = normalizeMatchKey(row?.tenpo_id || row?.store_id || row?.target_id);
        const tenpoNameKey = normalizeMatchKey(row?.tenpo_name || row?.store_name || row?.name || row?.target_label);
        const matchedByTenpoId = scopedTenpoKey && tenpoKey && tenpoKey === scopedTenpoKey;
        const matchedByName = tenpoNameKey && storeNameCandidates.some((c) => tenpoNameKey === c || tenpoNameKey.includes(c) || c.includes(tenpoNameKey));
        if (!matchedByTenpoId && !matchedByName) continue;

        const yagou = compact(row?.yagou_name);
        const tenpoName = pickFirstText(row?.tenpo_name, row?.store_name, row?.name, row?.target_label, activeStore?.name, effectiveTenpo?.name);
        const storeLabel = yagou && tenpoName ? `${yagou} / ${tenpoName}` : (yagou || tenpoName || '店舗');
        const yoteiId = compact(row?.yotei_id || row?.id || row?.schedule_id);

        const createdAt = compact(row?.created_at);
        const createdTs = Date.parse(createdAt);
        if (createdAt && Number.isFinite(createdTs)) {
          notices.push({
            id: `created-${yoteiId || storeLabel}-${createdAt}`,
            kind: 'created',
            at: createdAt,
            ts: createdTs,
            text: `${storeLabel} の予定が作成されました。`,
          });
        }

        if (isRunningYoteiStatus(row)) {
          const runAt = pickFirstText(row?.ugoki_updated_at, row?.updated_at, row?.started_at, row?.start_at, createdAt);
          const runTs = Date.parse(runAt);
          if (runAt && Number.isFinite(runTs)) {
            const workerName = pickFirstText(row?.sagyouin_name, row?.worker_name, row?.tantou_name);
            notices.push({
              id: `running-${yoteiId || storeLabel}-${runAt}`,
              kind: 'running',
              at: runAt,
              ts: runTs,
              text: workerName
                ? `${storeLabel} の予定が実行中になりました（${workerName}）。`
                : `${storeLabel} の予定が実行中になりました。`,
            });
          }
        }

        const startAt = resolveYoteiDateTime(row, 'start');
        const endAt = resolveYoteiDateTime(row, 'end');
        if (startAt && !isClosedYoteiStatus(row)) {
          const startTs = startAt.getTime();
          if (Number.isFinite(startTs) && startTs >= nowTs) {
            const workerName = pickFirstText(row?.sagyouin_name, row?.worker_name, row?.tantou_name);
            nextYoteiCandidates.push({
              id: yoteiId || `next-${storeLabel}-${startTs}`,
              startAt,
              endAt,
              ts: startTs,
              storeLabel,
              workerName,
            });
          }
        }
      }

      const deduped = Array.from(
        new Map(
          notices.map((n) => [n.id, n])
        ).values()
      )
        .sort((a, b) => b.ts - a.ts)
        .slice(0, 50);

      setCustomerNotices(deduped);
      const nextUpcoming = nextYoteiCandidates
        .sort((a, b) => a.ts - b.ts)
        .find(Boolean) || null;
      setNextYotei(nextUpcoming);
    } catch (e) {
      setCustomerNotices([]);
      setCustomerNoticesError(String(e?.message || e || 'お知らせの取得に失敗しました'));
      setNextYotei(null);
    } finally {
      setCustomerNoticesLoading(false);
    }
  }, [scopedTenpoId, effectiveTenpoId, effectiveTenpo, activeStore, masterApiBase]);

  useEffect(() => {
    loadCustomerNotices();
  }, [loadCustomerNotices]);

  useEffect(() => {
    if (!canEditBasicInfo) return;
    setBasicInfoForm(buildBasicInfoForm({
      tenpoLike: effectiveTenpo,
      fallbackStore: activeStore,
      resolvedProfile: resolvedBasicInfoProfile,
      torihikisakiLike: detailTorihikisaki,
      yagouLike: detailYagou,
    }));
    setBasicEditMode(false);
  }, [canEditBasicInfo, effectiveTenpoId, effectiveTenpo, activeStore, resolvedBasicInfoProfile, detailTorihikisaki, detailYagou]);

  const basicInfoRows = useMemo(() => {
    if (!effectiveTenpo && !activeStore) return [];
    const myPageUrl = buildCustomerMyPageUrl(effectiveTenpoId);
    const customRows = normalizeCustomBasicInfoFields(
      effectiveTenpo?.karte_detail?.spec?.custom_fields
      ?? []
    ).map((row, idx) => ({
      key: `custom_${idx}`,
      label: row.label || `追加情報${idx + 1}`,
      value: row.value || '-',
      readOnly: true,
    }));
    return [
      { key: 'torihikisaki_name', label: '法人', value: basicInfoForm.torihikisaki_name || '-' },
      { key: 'yagou_name', label: '屋号', value: basicInfoForm.yagou_name || '-' },
      { key: 'name', label: '店舗名', value: basicInfoForm.name || '-' },
      { key: 'address', label: '住所', value: basicInfoForm.address || '-' },
      { key: 'phone', label: '電話番号', value: basicInfoForm.phone || '-' },
      { key: 'customer_contact_name', label: '担当者', value: basicInfoForm.customer_contact_name || '-' },
      { key: 'business_hours', label: '営業時間', value: basicInfoForm.business_hours || '-' },
      ...customRows,
      { label: 'お客様マイページURL', value: myPageUrl, href: myPageUrl },
    ];
  }, [effectiveTenpo, activeStore, effectiveTenpoId, basicInfoForm]);

  const currentSubscription = useMemo(
    () => extractCurrentSubscription(effectiveTenpo),
    [effectiveTenpo]
  );

  const onBasicInfoField = useCallback((key, value) => {
    setBasicInfoForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleBasicInfoSave = useCallback(async () => {
    if (!canEditBasicInfo || !effectiveTenpoId || basicSaving) return;
    setBasicSaveMessage('');
    setBasicSaving(true);
    try {
      const prevKarte = (effectiveTenpo?.karte_detail && typeof effectiveTenpo.karte_detail === 'object')
        ? effectiveTenpo.karte_detail
        : {};
      const prevSpec = (prevKarte.spec && typeof prevKarte.spec === 'object') ? prevKarte.spec : {};
      const nextSpec = {
        ...prevSpec,
        customer_contact_name: norm(basicInfoForm.customer_contact_name),
        business_hours: norm(basicInfoForm.business_hours),
      };
      const payload = {
        torihikisaki_name: norm(basicInfoForm.torihikisaki_name),
        yagou_name: norm(basicInfoForm.yagou_name),
        name: norm(basicInfoForm.name),
        address: norm(basicInfoForm.address),
        phone: norm(basicInfoForm.phone),
        tantou_name: norm(basicInfoForm.customer_contact_name),
        business_hours: norm(basicInfoForm.business_hours),
        karte_detail: {
          ...prevKarte,
          spec: nextSpec,
          updated_at: new Date().toISOString(),
        },
      };
      const res = await fetch(`${masterApiBase}/master/tenpo/${encodeURIComponent(effectiveTenpoId)}`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`保存に失敗しました (${res.status}) ${text}`.trim());
      }
      const updated = await res.json();
      if (updated && typeof updated === 'object') {
        setDetailTenpo(updated);
      } else {
        setDetailTenpo((prev) => ({ ...(prev || {}), ...payload }));
      }
      setBasicEditMode(false);
      setBasicSaveMessage('基本情報を保存しました。');
    } catch (e) {
      setBasicSaveMessage(String(e?.message || e || '保存に失敗しました。'));
    } finally {
      setBasicSaving(false);
    }
  }, [canEditBasicInfo, effectiveTenpoId, basicSaving, effectiveTenpo, basicInfoForm, masterApiBase]);

  const detailHeadline = useMemo(() => {
    const yagou = norm(
      basicInfoForm.yagou_name ||
      effectiveTenpo?.yagou_name ||
      activeStore?.yagou
    );
    const name = norm(
      basicInfoForm.name ||
      effectiveTenpo?.name ||
      effectiveTenpo?.tenpo_name ||
      effectiveTenpo?.store_name ||
      activeStore?.name
    );
    if (yagou && name) return `${yagou} / ${name}`;
    if (yagou && !name) return `${yagou} / 店舗名未設定`;
    if (!yagou && name) return `屋号未設定 / ${name}`;
    return '屋号未設定 / 店舗名未設定';
  }, [basicInfoForm.yagou_name, basicInfoForm.name, effectiveTenpo, activeStore]);

  const headerTitle = useMemo(() => (
    scopedTenpoId ? detailHeadline : 'お客様マイページ'
  ), [scopedTenpoId, detailHeadline]);

  const serviceCatalogUrl = useMemo(() => {
    const explicit = norm(import.meta.env?.VITE_CUSTOMER_SERVICE_CATALOG_URL);
    if (explicit) return explicit;
    const base = String(import.meta.env?.BASE_URL || '/');
    const normalizedBase = base.endsWith('/') ? base : `${base}/`;
    return `${normalizedBase}customer/catalog/misesapo_catalog_0303.pdf`;
  }, []);

  const serviceCatalogPages = useMemo(() => {
    const envCsv = norm(import.meta.env?.VITE_CUSTOMER_SERVICE_CATALOG_SPLIT_FILES);
    const fileNames = (envCsv
      ? envCsv.split(',').map((v) => norm(v)).filter(Boolean)
      : DEFAULT_SERVICE_CATALOG_SPLIT_FILES
    ).slice();
    const base = String(import.meta.env?.BASE_URL || '/');
    const normalizedBase = base.endsWith('/') ? base : `${base}/`;
    return fileNames.map((fileName, idx) => ({
      fileName,
      label: catalogPageLabel(fileName),
      order: idx + 1,
      url: `${normalizedBase}customer/catalog/split/${encodeURIComponent(fileName)}`,
    }));
  }, []);

  const customerInquiryUrl = useMemo(() => {
    const explicit = norm(import.meta.env?.VITE_CUSTOMER_INQUIRY_URL);
    if (explicit) return explicit;
    return 'https://misesapo.co.jp/contact/';
  }, []);

  const customerTermsUrl = useMemo(() => {
    const explicit = norm(import.meta.env?.VITE_CUSTOMER_TERMS_URL);
    if (explicit) return explicit;
    return 'https://misesapo.co.jp/terms/';
  }, []);

  const customerPolicyPrivacyUrl = useMemo(() => {
    const explicit = norm(import.meta.env?.VITE_CUSTOMER_POLICY_PRIVACY_URL);
    if (explicit) return explicit;
    return 'https://misesapo.co.jp/privacy-policy/';
  }, []);

  const billingDocuments = useMemo(() => (
    detailSoukoFiles
      .map((f) => ({
        ...f,
        billingType: classifyBillingDocumentType(f),
        billingPeriod: extractBillingPeriodLabel(f),
      }))
      .filter((f) => f.billingType)
      .sort((a, b) => {
        const aTs = Date.parse(String(a?.uploaded_at || '')) || 0;
        const bTs = Date.parse(String(b?.uploaded_at || '')) || 0;
        if (aTs !== bTs) return bTs - aTs;
        return String(a?.file_name || a?.key || '').localeCompare(String(b?.file_name || b?.key || ''));
      })
  ), [detailSoukoFiles]);

  const invoiceDocuments = useMemo(() => (
    billingDocuments.filter((f) => f.billingType === 'invoice')
  ), [billingDocuments]);

  const receiptDocuments = useMemo(() => (
    billingDocuments.filter((f) => f.billingType === 'receipt')
  ), [billingDocuments]);

  const activeBillingDocuments = useMemo(() => (
    billingViewerType === 'receipt' ? receiptDocuments : invoiceDocuments
  ), [billingViewerType, receiptDocuments, invoiceDocuments]);

  const selectedBillingDocument = useMemo(() => {
    const selected = activeBillingDocuments.find((f) => f.key === billingSelectedKey);
    return selected || activeBillingDocuments[0] || null;
  }, [activeBillingDocuments, billingSelectedKey]);

  const selectedCatalogPage = useMemo(() => {
    if (!serviceCatalogPages.length) return null;
    const selected = serviceCatalogPages.find((p) => p.fileName === catalogSelectedName);
    return selected || serviceCatalogPages[0];
  }, [serviceCatalogPages, catalogSelectedName]);

  const selectedCatalogIndex = useMemo(() => {
    if (!selectedCatalogPage) return -1;
    return serviceCatalogPages.findIndex((p) => p.fileName === selectedCatalogPage.fileName);
  }, [serviceCatalogPages, selectedCatalogPage]);

  const canMoveCatalogPrev = selectedCatalogIndex > 0;
  const canMoveCatalogNext = selectedCatalogIndex >= 0 && selectedCatalogIndex < serviceCatalogPages.length - 1;

  const openServiceCatalog = useCallback(() => {
    if (!serviceCatalogPages.length) {
      if (serviceCatalogUrl && typeof window !== 'undefined') {
        window.open(serviceCatalogUrl, '_blank', 'noopener,noreferrer');
      }
      return;
    }
    setCatalogSelectedName(serviceCatalogPages[0].fileName);
    setCatalogImageLoading(true);
    setCatalogViewerOpen(true);
  }, [serviceCatalogPages, serviceCatalogUrl]);

  const closeServiceCatalog = useCallback(() => {
    setCatalogViewerOpen(false);
    setCatalogImageLoading(true);
  }, []);

  const moveCatalogPage = useCallback((delta) => {
    if (!serviceCatalogPages.length) return;
    const baseIndex = selectedCatalogIndex >= 0 ? selectedCatalogIndex : 0;
    const nextIndex = Math.max(0, Math.min(serviceCatalogPages.length - 1, baseIndex + Number(delta || 0)));
    const next = serviceCatalogPages[nextIndex];
    if (!next || next.fileName === catalogSelectedName) return;
    setCatalogImageLoading(true);
    setCatalogSelectedName(next.fileName);
  }, [serviceCatalogPages, selectedCatalogIndex, catalogSelectedName]);

  const openBillingViewer = useCallback((type) => {
    setBillingViewerType(type === 'receipt' ? 'receipt' : 'invoice');
    setBillingSelectedKey('');
    setBillingViewerOpen(true);
  }, []);

  const closeBillingViewer = useCallback(() => {
    setBillingViewerOpen(false);
    setBillingSelectedKey('');
  }, []);

  useEffect(() => {
    if (!billingViewerOpen) return;
    if (!activeBillingDocuments.length) {
      setBillingSelectedKey('');
      return;
    }
    if (!activeBillingDocuments.some((f) => f.key === billingSelectedKey)) {
      setBillingSelectedKey(activeBillingDocuments[0].key);
    }
  }, [billingViewerOpen, activeBillingDocuments, billingSelectedKey]);

  useEffect(() => {
    setBillingViewerOpen(false);
    setBillingSelectedKey('');
  }, [scopedTenpoId]);

  useEffect(() => {
    if (!catalogViewerOpen) return;
    if (!serviceCatalogPages.length) {
      setCatalogSelectedName('');
      setCatalogImageLoading(true);
      return;
    }
    if (!serviceCatalogPages.some((p) => p.fileName === catalogSelectedName)) {
      setCatalogSelectedName(serviceCatalogPages[0].fileName);
      setCatalogImageLoading(true);
    }
  }, [catalogViewerOpen, serviceCatalogPages, catalogSelectedName]);

  useEffect(() => {
    setCatalogViewerOpen(false);
    setCatalogSelectedName('');
    setCatalogImageLoading(true);
  }, [scopedTenpoId]);

  useEffect(() => {
    if (!catalogViewerOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeServiceCatalog();
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        moveCatalogPage(-1);
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        moveCatalogPage(1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [catalogViewerOpen, closeServiceCatalog, moveCatalogPage]);

  useEffect(() => {
    setReportViewerOpen(false);
  }, [scopedTenpoId]);

  const openNextYoteiPanel = useCallback(() => {
    setDetailPane('center');
    setCenterScheduleTab('calendar');
    if (nextYotei?.startAt) {
      const ymd = ymdFromDate(nextYotei.startAt);
      if (ymd) {
        setHistoryMonthCursor(monthStart(new Date(ymd)));
        setHistorySelectedDate(ymd);
      }
    }
  }, [nextYotei]);

  const openCustomerChatPanel = useCallback(() => {
    setDetailPane('center');
  }, []);

  const openResultReportViewer = useCallback(() => {
    setReportViewerOpen(true);
  }, []);

  const closeResultReportViewer = useCallback(() => {
    setReportViewerOpen(false);
  }, []);

  const sendCustomerChat = useCallback(async () => {
    const text = norm(customerChatDraft);
    if (!text) return;
    const tenpoId = norm(scopedTenpoId || effectiveTenpoId);
    if (!tenpoId) return;
    const actorName = norm(
      localStorage.getItem('display_name')
      || localStorage.getItem('name')
      || localStorage.getItem('username')
      || localStorage.getItem('user_name')
      || ''
    ) || 'お客様';
    const actorId = norm(localStorage.getItem('user_id')) || `customer:${tenpoId || 'unknown'}`;
    const tenpoName = pickFirstText(
      detailTenpo?.name,
      detailTenpo?.tenpo_name,
      effectiveTenpo?.name,
      activeStore?.name
    );
    const yagouName = pickFirstText(
      detailYagou?.name,
      detailYagou?.yagou_name,
      detailTenpo?.yagou_name,
      activeStore?.yagou
    );
    const storeLabel = [yagouName, tenpoName].filter(Boolean).join(' / ');
    setCustomerChatSending(true);
    try {
      await postCustomerPortalChat({
        masterApiBase,
        authHeaders,
        tenpoId,
        tenpoName,
        yagouName,
        senderRole: 'customer',
        senderName: actorName,
        senderId: actorId,
        message: text,
      });
      const aiResult = await buildCustomerPortalAiReply({
        userMessage: text,
        storeLabel,
        recentMessages: [
          ...safeArr(customerChatMessages),
          {
            senderRole: 'customer',
            text,
            at: new Date().toISOString(),
          },
        ],
      });
      const aiReply = norm(aiResult?.reply);
      if (aiReply) {
        const aiRestricted = Boolean(aiResult?.blocked);
        await postCustomerPortalChat({
          masterApiBase,
          authHeaders,
          tenpoId,
          tenpoName,
          yagouName,
          senderRole: 'admin',
          senderName: 'ミセサポAI',
          senderId: 'misogi-customer-ai',
          message: aiReply,
          dataPayloadExtra: aiRestricted
            ? {
                event_type: 'customer_ai_escalation',
                priority: 'high',
                ai_guard: {
                  restricted: true,
                  reason_count: Array.isArray(aiResult?.reasons) ? aiResult.reasons.length : 0,
                },
                origin_sender_name: actorName,
              }
            : {
                event_type: 'customer_ai_reply',
                priority: 'normal',
                ai_guard: {
                  restricted: false,
                },
              },
        });
      }
      setCustomerChatDraft('');
      setCustomerChatError('');
      await loadCustomerChat({ silent: true });
    } catch (e) {
      setCustomerChatError(String(e?.message || e || 'チャットの送信に失敗しました'));
    } finally {
      setCustomerChatSending(false);
    }
  }, [
    customerChatDraft,
    scopedTenpoId,
    effectiveTenpoId,
    detailTenpo,
    detailYagou,
    effectiveTenpo,
    activeStore,
    customerChatMessages,
    masterApiBase,
    loadCustomerChat,
  ]);

  return (
    <div className="customer-mypage customer-mypage--pop">
      <header className="customer-mypage-hero">
        <p className="customer-mypage-kicker">MISESAPO CUSTOMER PORTAL</p>
        <h1>{headerTitle}</h1>
        <p className="customer-mypage-sub">
          {scopedTenpoId
            ? '基本情報 / 対応履歴 / ストレージを確認できます'
            : '店舗を選択して、基本情報・対応履歴・ストレージをご確認ください。'}
        </p>
      </header>

      {error ? <p className="customer-mypage-error">{error}</p> : null}
      {detailError ? <p className="customer-mypage-error">{detailError}</p> : null}
      {scopedTenpoId ? (
        <section className="customer-notice-section customer-notice-section-under-hero">
          <div className="customer-notice-row">
            <article className="customer-panel customer-notice-panel">
              <div className="customer-panel-head">
                <h3>ミセサポからのメッセージ</h3>
                <span className="count">{customerNotices.length}</span>
              </div>
              {customerNoticesLoading ? (
                <p className="customer-muted">ミセサポからのメッセージを読み込み中です...</p>
              ) : customerNoticesError ? (
                <p className="customer-muted">{customerNoticesError}</p>
              ) : customerNotices.length === 0 ? (
                <p className="customer-muted">ミセサポからのメッセージはまだありません。</p>
              ) : (
                <div className="customer-notice-list">
                  {customerNotices.map((n) => (
                    <article key={n.id} className="customer-notice-card">
                      <div className="customer-notice-meta">
                        <span className={`kind kind-${n.kind}`}>{n.kind === 'running' ? '実行中' : '予定作成'}</span>
                        <span className="customer-notice-time">{fmtDateTimeJst(n.at) || '-'}</span>
                      </div>
                      <div className="customer-notice-text">{n.text}</div>
                    </article>
                  ))}
                </div>
              )}
            </article>
            <aside className="customer-notice-side-actions" aria-label="ミセサポメッセージ操作">
              <button
                type="button"
                className="btn btn-secondary customer-quick-btn customer-quick-btn-doc"
                onClick={() => openBillingViewer('invoice')}
                disabled={invoiceDocuments.length === 0}
                title={invoiceDocuments.length === 0 ? '請求書がまだありません' : ''}
              >
                請求書
              </button>
              <button
                type="button"
                className="btn btn-secondary customer-quick-btn customer-quick-btn-doc"
                onClick={() => openBillingViewer('receipt')}
                disabled={receiptDocuments.length === 0}
                title={receiptDocuments.length === 0 ? '領収書がまだありません' : ''}
              >
                領収書
              </button>
              <button
                type="button"
                className="btn btn-secondary customer-quick-btn"
                onClick={openNextYoteiPanel}
                disabled={!nextYotei}
                title={!nextYotei ? '次回予定はまだありません' : ''}
              >
                次回予定
              </button>
              <button
                type="button"
                className="btn btn-secondary customer-quick-btn"
                onClick={openResultReportViewer}
              >
                作業完了レポート
              </button>
              <button
                type="button"
                className="btn btn-secondary customer-quick-btn"
                onClick={openServiceCatalog}
              >
                サービスカタログ
              </button>
              <button
                type="button"
                className="btn btn-secondary customer-quick-btn"
                onClick={openCustomerChatPanel}
              >
                チャット
              </button>
              <a
                className="btn btn-secondary customer-quick-btn"
                href={customerInquiryUrl}
                target="_blank"
                rel="noreferrer"
              >
                お問い合わせ
              </a>
              <a
                className="btn btn-secondary customer-quick-btn"
                href={customerTermsUrl}
                target="_blank"
                rel="noreferrer"
              >
                利用規約
              </a>
              <a
                className="btn btn-secondary customer-quick-btn"
                href={customerPolicyPrivacyUrl}
                target="_blank"
                rel="noreferrer"
              >
                ポリシーアンドプライバシー
              </a>
            </aside>
          </div>
        </section>
      ) : null}

      {!scopedTenpoId ? (
        <section className="customer-store-grid-wrap">
          <div className="customer-mypage-summary">
            <span>表示件数: {scopedStores.length}</span>
            <span>全件数: {stores.length}</span>
            <button type="button" className="btn btn-secondary" onClick={loadStores} disabled={loading || detailLoading}>
              {loading ? '読込中...' : '更新'}
            </button>
          </div>
          <div className="customer-store-grid">
            {(!loading && scopedStores.length === 0) ? (
              <div className="customer-store-empty">表示対象がありません</div>
            ) : null}
            {scopedStores.map((it) => (
              <article key={it.id} className="customer-store-card">
                <div className="customer-store-card-head">
                  <h2>{it.name}</h2>
                  {/^TENPO#/i.test(String(it.id || '').trim()) ? null : <span className="chip">{it.id}</span>}
                </div>
                <p className="customer-store-yagou">{it.yagou || '屋号未設定'}</p>
                <p className="customer-store-address">{it.address}</p>
                <a className="customer-store-link" href={it.url}>この店舗のページを開く</a>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <>
          <section className="customer-detail-shell" aria-busy={detailLoading ? 'true' : 'false'}>
            <div className="customer-detail-title">{detailHeadline}</div>
            <div className="customer-detail-slider">
              <div className="customer-detail-viewport">
                <div className={`customer-detail-track pane-${detailPane}`}>
                  <section className="customer-detail-pane customer-detail-pane-left">
                    <article className="customer-panel">
                      <div className="customer-panel-head">
                        <h3>基本情報</h3>
                        {canEditBasicInfo ? (
                          <div className="customer-panel-actions">
                            {basicEditMode ? (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-secondary"
                                  onClick={() => {
                                    setBasicInfoForm(buildBasicInfoForm({
                                      tenpoLike: effectiveTenpo,
                                      fallbackStore: activeStore,
                                      resolvedProfile: resolvedBasicInfoProfile,
                                      torihikisakiLike: detailTorihikisaki,
                                      yagouLike: detailYagou,
                                    }));
                                    setBasicEditMode(false);
                                  }}
                                  disabled={basicSaving}
                                >
                                  キャンセル
                                </button>
                                <button type="button" className="btn btn-secondary" onClick={handleBasicInfoSave} disabled={basicSaving}>
                                  {basicSaving ? '保存中...' : '保存'}
                                </button>
                              </>
                            ) : (
                              <button type="button" className="btn btn-secondary" onClick={() => setBasicEditMode(true)}>
                                編集
                              </button>
                            )}
                          </div>
                        ) : null}
                      </div>
                      {basicSaveMessage ? <p className="customer-basic-save-message">{basicSaveMessage}</p> : null}
                      <dl className="customer-basic-grid">
                        {basicInfoRows.map((row) => (
                          <div key={row.label} className="customer-basic-row">
                            <dt>{row.label}</dt>
                            <dd>
                              {basicEditMode && row.key && !row.readOnly ? (
                                <input
                                  type="text"
                                  value={String(basicInfoForm?.[row.key] || '')}
                                  onChange={(e) => onBasicInfoField(row.key, e.target.value)}
                                  placeholder={`${row.label}を入力`}
                                  disabled={basicSaving}
                                />
                              ) : row.href ? (
                                <a href={row.href} target="_blank" rel="noreferrer">{row.value}</a>
                              ) : row.value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                      <section className="customer-current-subscription" aria-label="現在お申し込み中のサービス">
                        <h4>現在お申し込み中のサービス</h4>
                        <div className="customer-current-subscription-row">
                          <span className="k">プラン</span>
                          <div className="tags">
                            {currentSubscription.planTags.length > 0 ? (
                              currentSubscription.planTags.map((tag) => (
                                <span key={`plan-${tag}`} className="customer-subscription-tag customer-subscription-tag-plan">{tag}</span>
                              ))
                            ) : (
                              <span className="customer-subscription-empty">未設定</span>
                            )}
                          </div>
                        </div>
                        <div className="customer-current-subscription-row">
                          <span className="k">サービス</span>
                          <div className="tags">
                            {currentSubscription.serviceTags.length > 0 ? (
                              currentSubscription.serviceTags.map((tag) => (
                                <span key={`service-${tag}`} className="customer-subscription-tag customer-subscription-tag-service">{tag}</span>
                              ))
                            ) : (
                              <span className="customer-subscription-empty">未設定</span>
                            )}
                          </div>
                        </div>
                      </section>
                    </article>
                  </section>

                  <section className="customer-detail-pane customer-detail-pane-center">
                    <div className="customer-center-top-grid">
                      <article className="customer-panel customer-center-panel customer-center-panel-chat">
                        <section className="customer-chat-panel" aria-label="お客様チャット">
                          <div className="customer-panel-head customer-panel-head-sub">
                            <h3>チャット</h3>
                            <span className="count">{customerChatMessages.length}</span>
                          </div>
                          <div className="customer-chat-log">
                            {customerChatLoading ? (
                              <p className="customer-muted">チャットを読み込み中です...</p>
                            ) : customerChatMessages.length === 0 ? (
                              <p className="customer-muted">メッセージはまだありません。</p>
                            ) : (
                              customerChatMessages.map((m) => {
                                const mine = m.senderRole === 'customer';
                                return (
                                  <div key={m.id} className={`customer-chat-row ${mine ? 'mine' : 'other'}`}>
                                    <article className={`customer-chat-bubble ${mine ? 'mine' : 'other'}`}>
                                      <div className="customer-chat-bubble-name">
                                        {m.senderName || (mine ? 'お客様' : 'ミセサポ')}
                                      </div>
                                      <div className="customer-chat-bubble-text">{m.text}</div>
                                      <div className="customer-chat-bubble-time">{fmtDateTimeJst(m.at) || '-'}</div>
                                    </article>
                                  </div>
                                );
                              })
                            )}
                          </div>
                          {customerChatError ? <p className="customer-muted">{customerChatError}</p> : null}
                          <div className="customer-chat-composer">
                            <textarea
                              value={customerChatDraft}
                              onChange={(e) => setCustomerChatDraft(e.target.value)}
                              placeholder="メッセージを入力"
                              rows={3}
                            />
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={sendCustomerChat}
                              disabled={!norm(customerChatDraft) || customerChatSending}
                            >
                              {customerChatSending ? '送信中...' : '送信'}
                            </button>
                          </div>
                        </section>
                      </article>

                      <article className="customer-panel customer-center-panel customer-center-panel-schedule">
                        <section className="customer-center-schedule" aria-label="予定カレンダーと対応履歴">
                          <div className="customer-panel-head customer-panel-head-sub">
                            <h3>予定・対応履歴</h3>
                            {centerScheduleTab === 'calendar' && !nextYotei ? (
                              <span className="customer-center-empty-note">次回予定はまだありません</span>
                            ) : null}
                          </div>
                          <div className="customer-center-schedule-body">
                            {centerScheduleTab === 'calendar' ? (
                              <>
                                <div className="customer-history-calendar">
                                  <div className="customer-history-calendar-head">
                                    <button
                                      type="button"
                                      className="customer-calendar-nav"
                                      onClick={() => setHistoryMonthCursor((prev) => addMonths(prev, -1))}
                                      aria-label="前月"
                                    >
                                      ←
                                    </button>
                                    <div className="customer-calendar-label">{historyMonthLabel}</div>
                                    <button
                                      type="button"
                                      className="customer-calendar-nav"
                                      onClick={() => setHistoryMonthCursor((prev) => addMonths(prev, 1))}
                                      aria-label="次月"
                                    >
                                      →
                                    </button>
                                    <button
                                      type="button"
                                      className="customer-calendar-clear"
                                      onClick={() => setHistorySelectedDate('')}
                                      disabled={!historySelectedDate}
                                    >
                                      全日表示
                                    </button>
                                  </div>
                                  <div className="customer-calendar-weekdays">
                                    {['日', '月', '火', '水', '木', '金', '土'].map((wd) => (
                                      <span key={wd}>{wd}</span>
                                    ))}
                                  </div>
                                  <div className="customer-history-calendar-grid">
                                    {historyCalendarCells.map((cell) => (
                                      <button
                                        key={cell.ymd}
                                        type="button"
                                        className={[
                                          'customer-calendar-day',
                                          cell.inMonth ? '' : 'is-outside',
                                          cell.count > 0 ? 'has-record' : '',
                                          historySelectedDate === cell.ymd ? 'is-selected' : '',
                                        ].filter(Boolean).join(' ')}
                                        onClick={() => {
                                          setHistoryMonthCursor(monthStart(new Date(cell.ymd)));
                                          setHistorySelectedDate((prev) => (prev === cell.ymd ? '' : cell.ymd));
                                        }}
                                        aria-label={`${cell.ymd} ${cell.count}件`}
                                      >
                                        <span className="day-number">{cell.day}</span>
                                        {cell.count > 0 ? <span className="day-count">{cell.count}</span> : null}
                                      </button>
                                    ))}
                                  </div>
                                  {historySelectedDate ? (
                                    <p className="customer-muted small">
                                      選択日: {historySelectedDate}
                                    </p>
                                  ) : null}
                                </div>
                                {nextYotei ? (
                                  <section className="customer-next-yotei" aria-label="次回予定">
                                    <div className="customer-next-yotei-top">
                                      <span className="customer-next-yotei-label">次回予定</span>
                                      <span className="customer-next-yotei-date">{fmtDateJst(nextYotei.startAt)}</span>
                                    </div>
                                    <div className="customer-next-yotei-main">{nextYotei.storeLabel}</div>
                                    <div className="customer-next-yotei-sub">
                                      <span>{fmtDateTimeJst(nextYotei.startAt) || '-'}</span>
                                      <span>〜</span>
                                      <span>{fmtDateTimeJst(nextYotei.endAt) || '-'}</span>
                                      {nextYotei.workerName ? <span>担当: {nextYotei.workerName}</span> : null}
                                    </div>
                                  </section>
                                ) : null}
                              </>
                            ) : (
                              <>
                                {historySelectedDate ? (
                                  <div className="customer-history-tab-head">
                                    <p className="customer-muted small">選択日: {historySelectedDate}</p>
                                    <button
                                      type="button"
                                      className="customer-calendar-clear"
                                      onClick={() => setHistorySelectedDate('')}
                                    >
                                      全日表示
                                    </button>
                                  </div>
                                ) : null}
                                {supportHistory.length === 0 ? (
                                  <p className="customer-muted">対応履歴はまだありません。</p>
                                ) : filteredSupportHistory.length === 0 ? (
                                  <p className="customer-muted">選択した日付の対応履歴はありません。</p>
                                ) : (
                                  <div className="customer-history-list">
                                    {filteredSupportHistory.map((h, idx) => {
                                      const logs = safeArr(h?.logs).filter((lg) => norm(lg?.message));
                                      return (
                                        <article key={norm(h?.history_id) || `history-${idx}`} className="customer-history-card">
                                          <div className="customer-history-top">
                                            <span className="date">{norm(h?.date) || '-'}</span>
                                            <span className="status">{norm(h?.status) || 'open'}</span>
                                          </div>
                                          <p><strong>件名:</strong> {norm(h?.topic) || '-'}</p>
                                          <p><strong>対応:</strong> {norm(h?.action) || '-'}</p>
                                          <p><strong>結果:</strong> {norm(h?.outcome) || '-'}</p>
                                          <p className="customer-muted small">
                                            更新: {fmtDateTimeJst(h?.updated_at) || '-'} / 返信 {logs.length}件
                                          </p>
                                        </article>
                                      );
                                    })}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                          <div className="customer-center-tabs customer-center-tabs-bottom" role="tablist" aria-label="予定と対応履歴の表示切替">
                            <button
                              type="button"
                              role="tab"
                              aria-selected={centerScheduleTab === 'calendar'}
                              className={['customer-center-tab', centerScheduleTab === 'calendar' ? 'is-active' : ''].filter(Boolean).join(' ')}
                              onClick={() => setCenterScheduleTab('calendar')}
                            >
                              カレンダー
                            </button>
                            <button
                              type="button"
                              role="tab"
                              aria-selected={centerScheduleTab === 'history'}
                              className={['customer-center-tab', centerScheduleTab === 'history' ? 'is-active' : ''].filter(Boolean).join(' ')}
                              onClick={() => setCenterScheduleTab('history')}
                            >
                              対応履歴
                            </button>
                          </div>
                        </section>
                      </article>
                    </div>
                  </section>

                  <section className="customer-detail-pane customer-detail-pane-right">
                    <article className="customer-panel">
                      <div className="customer-panel-head">
                        <h3>ストレージ</h3>
                        <span className="count">{detailSoukoFiles.length}</span>
                      </div>
                      {detailSoukoFiles.length === 0 ? (
                        <p className="customer-muted">登録済みファイルはありません。</p>
                      ) : (
                        <div className="customer-storage-grid">
                          {detailSoukoFiles.slice().reverse().map((f) => (
                            <article key={f.key} className="customer-storage-card">
                              <div className="thumb">
                                {isImageFile(f.file_name, f.content_type, f.key) && f.open_url ? (
                                  <img src={f.open_url} alt={f.file_name || f.key} loading="lazy" />
                                ) : (
                                  <span>{fileKindLabel(f.file_name, f.content_type, f.key)}</span>
                                )}
                              </div>
                              <div className="meta">
                                <div className="name" title={f.file_name || f.key}>{f.file_name || '(no name)'}</div>
                                <div className="sub">
                                  <span>{f.doc_category || '未分類'}</span>
                                  <span>{formatBytes(f.size)}</span>
                                  <span>{fmtDateTimeJst(f.uploaded_at) || f.uploaded_at || '-'}</span>
                                </div>
                              </div>
                              <div className="actions">
                                {f.open_url ? (
                                  <a href={f.open_url} target="_blank" rel="noreferrer">開く</a>
                                ) : (
                                  <span className="customer-muted">URLなし</span>
                                )}
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </article>
                  </section>
                </div>
              </div>
            </div>
            <button
              type="button"
              className={`customer-body-nav customer-body-nav-left${detailPane === 'left' ? ' is-active' : ''}`}
              onClick={() => moveDetailPane(-1)}
              aria-label="左へ移動"
              disabled={!canMovePaneLeft}
            >
              <span className="customer-body-nav-hint" aria-hidden="true">{leftHint}</span>
              ←
            </button>
            <button
              type="button"
              className={`customer-body-nav customer-body-nav-right${detailPane === 'right' ? ' is-active' : ''}`}
              onClick={() => moveDetailPane(1)}
              aria-label="右へ移動"
              disabled={!canMovePaneRight}
            >
              <span className="customer-body-nav-hint" aria-hidden="true">{rightHint}</span>
              →
            </button>
          </section>

        </>
      )}
      {catalogViewerOpen ? (
        <div
          className="customer-billing-modal-backdrop"
          role="presentation"
          onClick={closeServiceCatalog}
        >
          <section
            className="customer-billing-modal customer-catalog-modal"
            role="dialog"
            aria-modal="true"
            aria-label="サービスカタログ"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="customer-billing-modal-head">
              <div className="customer-billing-modal-title">
                <h3>サービスカタログ</h3>
                <span className="count">{serviceCatalogPages.length}</span>
              </div>
              <button type="button" className="btn btn-secondary customer-billing-close-btn" onClick={closeServiceCatalog}>
                閉じる
              </button>
            </header>

            <div className="customer-billing-modal-body">
              <aside className="customer-billing-list-pane" aria-label="カタログページ一覧">
                {serviceCatalogPages.length === 0 ? (
                  <p className="customer-muted">表示できるカタログページがありません。</p>
                ) : (
                  <div className="customer-billing-list">
                    {serviceCatalogPages.map((page) => (
                      <button
                        key={page.fileName}
                        type="button"
                        className={`customer-billing-list-item${selectedCatalogPage?.fileName === page.fileName ? ' is-selected' : ''}`}
                        onClick={() => {
                          setCatalogImageLoading(true);
                          setCatalogSelectedName(page.fileName);
                        }}
                      >
                        <div className="customer-billing-list-top">
                          <span className="period">{page.label}</span>
                          <span className="time">{String(page.order).padStart(2, '0')}</span>
                        </div>
                        <div className="name" title={page.fileName}>{page.fileName}</div>
                      </button>
                    ))}
                  </div>
                )}
              </aside>

              <section className="customer-billing-preview-pane customer-catalog-preview-pane" aria-label="カタログプレビュー">
                {!selectedCatalogPage ? (
                  <p className="customer-muted">左のリストからページを選択してください。</p>
                ) : (
                  <>
                    <div className="customer-billing-preview-head customer-catalog-preview-head">
                      <div className="name" title={selectedCatalogPage.fileName}>
                        {selectedCatalogPage.label}
                      </div>
                      <div className="customer-catalog-preview-actions">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => moveCatalogPage(-1)}
                          disabled={!canMoveCatalogPrev}
                        >
                          ← 前へ
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => moveCatalogPage(1)}
                          disabled={!canMoveCatalogNext}
                        >
                          次へ →
                        </button>
                        <a href={selectedCatalogPage.url} target="_blank" rel="noreferrer" className="btn btn-secondary">
                          新しいタブで開く
                        </a>
                      </div>
                    </div>
                    <div className="customer-catalog-image-wrap">
                      <img
                        key={selectedCatalogPage.fileName}
                        className={`customer-catalog-image${catalogImageLoading ? ' is-loading' : ''}`}
                        src={selectedCatalogPage.url}
                        alt={selectedCatalogPage.label}
                        onLoad={() => setCatalogImageLoading(false)}
                        onError={() => setCatalogImageLoading(false)}
                      />
                    </div>
                  </>
                )}
              </section>
            </div>
          </section>
        </div>
      ) : null}
      {reportViewerOpen ? (
        <div
          className="customer-billing-modal-backdrop"
          role="presentation"
          onClick={closeResultReportViewer}
        >
          <section
            className="customer-billing-modal customer-report-modal"
            role="dialog"
            aria-modal="true"
            aria-label="作業完了レポート一覧"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="customer-billing-modal-head">
              <div className="customer-billing-modal-title">
                <h3>作業完了レポート（結果）</h3>
                <span className="count">{resultReports.length}</span>
              </div>
              <button type="button" className="btn btn-secondary customer-billing-close-btn" onClick={closeResultReportViewer}>
                閉じる
              </button>
            </header>
            <div className="customer-report-modal-body">
              {resultReportActionMessage ? <p className="customer-basic-save-message">{resultReportActionMessage}</p> : null}
              {resultReportActionError ? <p className="customer-mypage-error customer-report-action-error">{resultReportActionError}</p> : null}
              {resultReportsLoading ? (
                <p className="customer-muted">作業完了レポートを読み込み中です...</p>
              ) : resultReportsError ? (
                <p className="customer-muted">{resultReportsError}</p>
              ) : resultReports.length === 0 ? (
                <p className="customer-muted">表示できる作業結果はまだありません。</p>
              ) : (
                <div className="customer-report-result-list">
                  {resultReports.map((row, idx) => (
                    <article key={row.id || `${row.workDate}-${idx}`} className="customer-report-result-card">
                      <div className="customer-report-result-head">
                        <div className="customer-report-result-date">{row.workDate || '-'}</div>
                        <button
                          type="button"
                          className="btn btn-secondary customer-report-download-btn"
                          onClick={() => onDownloadResultReport(row, idx)}
                          disabled={Boolean(resultReportSavingId)}
                        >
                          {resultReportSavingId === (row.id || `${row.workDate || 'row'}-${idx}`)
                            ? '保存中...'
                            : 'PDFダウンロード'}
                        </button>
                      </div>
                      <div className="customer-report-result-text">{row.result}</div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}
      {billingViewerOpen ? (
        <div
          className="customer-billing-modal-backdrop"
          role="presentation"
          onClick={closeBillingViewer}
        >
          <section
            className="customer-billing-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`${billingTypeLabel(billingViewerType)}一覧`}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="customer-billing-modal-head">
              <div className="customer-billing-modal-title">
                <h3>{billingTypeLabel(billingViewerType)}一覧</h3>
                <span className="count">{activeBillingDocuments.length}</span>
              </div>
              <button type="button" className="btn btn-secondary customer-billing-close-btn" onClick={closeBillingViewer}>
                閉じる
              </button>
            </header>

            <div className="customer-billing-modal-body">
              <aside className="customer-billing-list-pane" aria-label={`${billingTypeLabel(billingViewerType)}リスト`}>
                {activeBillingDocuments.length === 0 ? (
                  <p className="customer-muted">表示できる{billingTypeLabel(billingViewerType)}はありません。</p>
                ) : (
                  <div className="customer-billing-list">
                    {activeBillingDocuments.map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        className={`customer-billing-list-item${selectedBillingDocument?.key === f.key ? ' is-selected' : ''}`}
                        onClick={() => setBillingSelectedKey(f.key)}
                      >
                        <div className="customer-billing-list-top">
                          <span className="period">{f.billingPeriod}</span>
                          <span className="time">{fmtDateTimeJst(f.uploaded_at) || '-'}</span>
                        </div>
                        <div className="name" title={f.file_name || f.key}>{f.file_name || f.key}</div>
                      </button>
                    ))}
                  </div>
                )}
              </aside>

              <section className="customer-billing-preview-pane" aria-label="PDFプレビュー">
                {!selectedBillingDocument ? (
                  <p className="customer-muted">左のリストから{billingTypeLabel(billingViewerType)}を選択してください。</p>
                ) : !selectedBillingDocument.open_url ? (
                  <p className="customer-muted">このファイルにはプレビューURLがありません。</p>
                ) : !isPdfFile(selectedBillingDocument.file_name, selectedBillingDocument.content_type, selectedBillingDocument.key) ? (
                  <div className="customer-billing-preview-empty">
                    <p className="customer-muted">このファイルはPDFではありません。新しいタブで開いて確認してください。</p>
                    <a href={selectedBillingDocument.open_url} target="_blank" rel="noreferrer" className="btn btn-secondary">
                      新しいタブで開く
                    </a>
                  </div>
                ) : (
                  <>
                    <div className="customer-billing-preview-head">
                      <div className="name" title={selectedBillingDocument.file_name || selectedBillingDocument.key}>
                        {selectedBillingDocument.file_name || selectedBillingDocument.key}
                      </div>
                      <a
                        href={selectedBillingDocument.open_url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary"
                      >
                        新しいタブで開く
                      </a>
                    </div>
                    <iframe
                      className="customer-billing-pdf-frame"
                      title={selectedBillingDocument.file_name || selectedBillingDocument.key}
                      src={selectedBillingDocument.open_url}
                    />
                  </>
                )}
              </section>
            </div>
          </section>
        </div>
      ) : null}
      <footer className="customer-mypage-footer">
        <small>© MISESAPO All Rights Reserved.</small>
      </footer>
    </div>
  );
}
