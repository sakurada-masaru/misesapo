import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Visualizer from './Visualizer/Visualizer';
import Hotbar from './Hotbar/Hotbar';
import { useReportStyleTransition, TRANSITION_CLASS_PAGE, TRANSITION_CLASS_UI } from './ReportTransition/reportTransition.jsx';
import { JOBS } from '../utils/constants';
import { useI18n } from '../i18n/I18nProvider';
import { normalizeGatewayBase, YOTEI_GATEWAY } from '../api/gatewayBase';
import ThemeToggle from './ThemeToggle/ThemeToggle';
import LanguageSwitcher from './LanguageSwitcher/LanguageSwitcher';
import CommonHeaderChat from './Breadcrumbs/CommonHeaderChat';
import MisogiSupportOrb from './MisogiSupport/MisogiSupportOrb';
import { useAuth } from '../auth/useAuth';
import { getAdminWorkReports } from '../api/adminWorkReportsApi';

const JOB_KEYS = ['sales', 'cleaning', 'office', 'dev', 'admin'];
const ADMIN_ENTRANCE_MODE_DEFAULT = 'default';
const ADMIN_UPDATES_POLL_MS = 30000;
const FILEBOX_MAX_UPLOAD_SIZE = 15 * 1024 * 1024;
const FILEBOX_SOUKO_SOURCE = 'admin_filebox';
const FILEBOX_SOUKO_TENPO_ID = 'filebox_company';
const WORKFLOW_INBOX_FOLDER_ID = 'workflow_inbox';
const WORKFLOW_INBOX_FOLDER_NAME = '受信業務依頼';
const REQUEST_TYPE_LABEL_MAP = {
  shorui_sofu: '書類送付',
  keiyaku_shinsa: '契約審査',
  mitsumori: '見積作成',
  seikyuu_shiharai: '請求/支払',
  jinji_shinsei: '人事申請',
  ringi_shonin: '稟議/承認',
  other: 'その他',
};
const DEFAULT_ADMIN_FILEBOX_FOLDERS = [
  { id: WORKFLOW_INBOX_FOLDER_ID, name: WORKFLOW_INBOX_FOLDER_NAME },
  { id: 'contracts', name: '契約書' },
  { id: 'manuals', name: '業務マニュアル' },
  { id: 'reports', name: '提出書類' },
  { id: 'common', name: '共通ドキュメント' },
];
const DEFAULT_ADMIN_FILEBOX_FOLDER_IDS = new Set(DEFAULT_ADMIN_FILEBOX_FOLDERS.map((row) => row.id));
const FILEBOX_VIEW_MODE_OPTIONS = [
  { id: 'icon', label: 'アイコン表示', icon: '◼' },
  { id: 'list', label: 'リスト表示', icon: '☰' },
  { id: 'slider', label: 'スライダー表示', icon: '↔' },
];
const FILEBOX_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif', 'heic', 'heif']);
const FILEBOX_VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'm4v']);
const FILEBOX_AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'aac', 'm4a', 'ogg', 'flac']);
const DASHBOARD_EXPLORER_WIDTH_STORAGE_KEY = 'misogi-v2-admin-dashboard-explorer-width';
const DASHBOARD_CHAT_WIDTH_STORAGE_KEY = 'misogi-v2-admin-dashboard-chat-width';
const DASHBOARD_EXPLORER_VISIBLE_STORAGE_KEY = 'misogi-v2-admin-dashboard-explorer-visible';
const DASHBOARD_CHAT_VISIBLE_STORAGE_KEY = 'misogi-v2-admin-dashboard-chat-visible';
const DASHBOARD_EXPLORER_WIDTH_DEFAULT = 260;
const DASHBOARD_EXPLORER_WIDTH_MIN = 220;
const DASHBOARD_EXPLORER_WIDTH_MAX = 520;
const DASHBOARD_CHAT_WIDTH_DEFAULT = 440;
const DASHBOARD_CHAT_WIDTH_MIN = 320;
const DASHBOARD_CHAT_WIDTH_MAX = 760;
const DASHBOARD_RESIZER_ENABLED_MIN_WIDTH = 1024;
const DASHBOARD_RESIZER_BAR_WIDTH = 10;
const DASHBOARD_WORKSPACE_MIN_WIDTH = 420;
const DASHBOARD_PANEL_MIN_WIDTH = 700;
const DASHBOARD_PANE_TOGGLE_EVENT = 'misogi-dashboard-pane-toggle';
const CLEANING_NOTICE_RUNNING_STORAGE_KEY = 'misogi-v2-cleaning-notice-running';
const CLEANING_NOTICE_SWIPE_MAX = 44;
const CLEANING_NOTICE_SWIPE_THRESHOLD = 12;
const ADMIN_DIRECT_SIDEBAR_SECTION_IDS = new Set(['dashboard', 'filebox']);
const CUSTOMER_CHAT_ADMIN_ROOM = 'customer_portal_chat';

function isLocalUiHost() {
  if (typeof window === 'undefined') return false;
  const h = String(window.location?.hostname || '').toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
}

const MASTER_API_BASE = (import.meta.env?.DEV || isLocalUiHost())
  ? '/api-master'
  : normalizeGatewayBase(import.meta.env?.VITE_MASTER_API_BASE, 'https://jtn6in2iuj.execute-api.ap-northeast-1.amazonaws.com/prod');
const YOTEI_API_BASE = (import.meta.env?.DEV || isLocalUiHost())
  ? '/api'
  : normalizeGatewayBase(import.meta.env?.VITE_YOTEI_API_BASE, YOTEI_GATEWAY);

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

function asItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function toEpochMs(value) {
  const t = Date.parse(String(value || '').trim());
  return Number.isNaN(t) ? 0 : t;
}

function isSameLocalDate(ts, now = new Date()) {
  if (!Number.isFinite(ts) || ts <= 0) return false;
  const d = new Date(ts);
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
}

function hhmmLabel(ts) {
  if (!Number.isFinite(ts) || ts <= 0) return '--:--';
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function ymdHmLabel(ts) {
  if (!Number.isFinite(ts) || ts <= 0) return '----/--/-- --:--';
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}/${m}/${day} ${hh}:${mm}`;
}

function normalizeToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, '');
}

function isLikelyLoginEvent(row) {
  const fields = [
    row?.action,
    row?.event,
    row?.log_type,
    row?.type,
    row?.kind,
    row?.category,
    row?.source,
    row?.name,
    row?.title,
    row?.subject,
    row?.note,
    row?.description,
  ];
  const joined = normalizeToken(fields.filter(Boolean).join(' '));
  return (
    joined.includes('login')
    || joined.includes('signin')
    || joined.includes('ログイン')
    || joined.includes('サインイン')
    || joined.includes('ログオン')
  );
}

function tryRestoreUtf8Mojibake(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/[ぁ-んァ-ン一-龯]/.test(text)) return text;
  if (!/[À-ÿ]/.test(text)) return text;
  try {
    const chars = Array.from(text);
    const bytes = Uint8Array.from(chars.map((ch) => {
      const code = ch.charCodeAt(0);
      return code <= 0xff ? code : 0x3f;
    }));
    const restored = new TextDecoder('utf-8', { fatal: true }).decode(bytes).trim();
    if (!restored) return text;
    if (/[ぁ-んァ-ン一-龯]/.test(restored)) return restored;
    return text;
  } catch {
    return text;
  }
}

function parsePossibleName(raw) {
  if (raw == null) return '';
  if (typeof raw === 'object') {
    return tryRestoreUtf8Mojibake(String(
      raw?.name
      || raw?.display_name
      || raw?.user_name
      || raw?.updated_by_name
      || raw?.created_by_name
      || ''
    ).trim());
  }
  const s = tryRestoreUtf8Mojibake(String(raw).trim());
  if (!s) return '';
  if (s.startsWith('{') && s.endsWith('}')) {
    try {
      const j = JSON.parse(s);
      if (j && typeof j === 'object') {
        return parsePossibleName(j);
      }
    } catch {
      // ignore
    }
  }
  return s;
}

function isLikelySystemIdentifier(v) {
  const s = String(v || '').trim();
  if (!s) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)) return true;
  if (/^arn:aws:/i.test(s)) return true;
  if (/^aida[0-9a-z]{12,}$/i.test(s)) return true;
  if (/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(s)) return true;
  if (s.length >= 36 && /^[A-Za-z0-9:/_.-]+$/.test(s)) return true;
  return false;
}

function pickDisplayName(...candidates) {
  for (const c of candidates) {
    const parsed = parsePossibleName(c);
    if (!parsed) continue;
    if (isLikelySystemIdentifier(parsed)) continue;
    return parsed;
  }
  for (const c of candidates) {
    const parsed = parsePossibleName(c);
    if (parsed) return parsed;
  }
  return '未設定';
}

function reportWho(item) {
  return pickDisplayName(
    item?.updated_by_name,
    item?.submitted_by_name,
    item?.user_name,
    item?.worker_name,
    item?.reporter_name,
    item?.created_by_name,
    item?.updated_by,
    item?.submitted_by,
    item?.created_by,
  );
}

function summarizeFact(row) {
  const raw = String(
    row?.action
    || row?.event
    || row?.name
    || row?.title
    || row?.subject
    || row?.log_type
    || row?.type
    || row?.kind
    || row?.category
    || row?.note
    || row?.summary
    || row?.description
    || ''
  ).trim();
  if (!raw) return '情報を更新しました';
  return raw.length > 70 ? `${raw.slice(0, 70)}…` : raw;
}

function reportActionLabel(item) {
  const state = String(item?.state || item?.status || '').trim().toLowerCase();
  if (state === 'submitted' || item?.submitted_at) return '業務報告を提出しました';
  if (state === 'triaged') return '業務報告を確認しました';
  if (state === 'rejected') return '業務報告を差し戻しました';
  if (state === 'approved') return '業務報告を承認しました';
  if (state === 'archived') return '業務報告を保管しました';
  if (state === 'draft') return '業務報告を保存しました';
  return '業務報告を更新しました';
}

function readLocalUserName() {
  if (typeof window === 'undefined') return '';
  try {
    const raw = JSON.parse(window.localStorage.getItem('cognito_user') || '{}');
    return String(
      raw?.name
      || raw?.display_name
      || raw?.attributes?.name
      || raw?.attributes?.email
      || raw?.email
      || ''
    ).trim();
  } catch {
    return '';
  }
}

function normalizeFileboxFolderId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function parseFileboxFolderMeta(row) {
  const soukoId = String(row?.souko_id || '').trim();
  const id = normalizeFileboxFolderId(row?.folder_id || '');
  const name = String(row?.folder_name || row?.name || '').trim();
  if (!soukoId || !id || !name) return null;
  return {
    id,
    name,
    soukoId,
    atMs: toEpochMs(row?.updated_at || row?.created_at),
  };
}

function parseFileboxFiles(row, folder) {
  const list = Array.isArray(row?.files) ? row.files : [];
  return list
    .map((it, idx) => {
      const name = String(it?.file_name || it?.name || '').trim();
      const key = String(it?.key || '').trim();
      const url = String(it?.preview_url || it?.get_url || it?.url || '').trim();
      if (!name || (!key && !url)) return null;
      return {
        id: `${String(row?.souko_id || folder.id)}-${key || name}-${idx}`,
        folderId: folder.id,
        folderName: folder.name,
        soukoId: String(row?.souko_id || '').trim(),
        name,
        key,
        url,
        size: Number(it?.size || 0),
        contentType: String(it?.content_type || it?.mime || '').trim(),
        uploader: String(it?.uploaded_by_name || it?.uploaded_by || row?.updated_by || row?.created_by || '未設定').trim(),
        atMs: toEpochMs(it?.uploaded_at || it?.updated_at || it?.created_at || row?.updated_at || row?.created_at),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.atMs - a.atMs);
}

function parseNameList(value) {
  if (Array.isArray(value)) {
    return value.map((v) => String(v || '').trim()).filter(Boolean);
  }
  const raw = String(value || '').trim();
  if (!raw) return [];
  if (raw.startsWith('[') && raw.endsWith(']')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v || '').trim()).filter(Boolean);
      }
    } catch {
      // ignore JSON parse errors
    }
  }
  return raw
    .split(/[\n,、/・]+/)
    .map((v) => String(v || '').trim())
    .filter(Boolean);
}

function toYmd(value) {
  const t = toEpochMs(value);
  if (!t) return '';
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toRequestTypeLabel(value) {
  const key = String(value || '').trim();
  if (!key) return '-';
  return REQUEST_TYPE_LABEL_MAP[key] || key;
}

function normalizeMatchToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function rowToWorkflowRequestFile(row) {
  const kadaiId = String(row?.kadai_id || row?.id || '').trim() || `kadai-${Date.now()}`;
  const subject = String(row?.category || row?.title || row?.request_type || '業務依頼').trim();
  const due = String(row?.due_date || '').trim();
  const requester = String(row?.reported_by || row?.updated_by || '未設定').trim();
  const target = parseNameList(row?.target_to).join(' / ') || '-';
  const reqType = toRequestTypeLabel(row?.request_type);
  const status = String(row?.status || '-').trim();
  const priority = String(row?.priority || '-').trim();
  const requestText = String(row?.request || '').trim() || '（本文なし）';
  const refs = String(row?.file_refs || '').trim() || '（なし）';
  const reportDate = String(row?.reported_at || '').trim() || '-';
  const updatedDate = String(row?.updated_at || '').trim() || '-';
  const atMs = toEpochMs(row?.updated_at || row?.reported_at || row?.created_at);
  const ymd = toYmd(row?.reported_at || row?.created_at || row?.updated_at);
  const plainText = [
    '【業務依頼】',
    `ID: ${kadaiId}`,
    `件名: ${subject}`,
    `種別: ${reqType}`,
    `依頼者: ${requester}`,
    `宛先: ${target}`,
    `期限: ${due || '-'}`,
    `優先度: ${priority}`,
    `状態: ${status}`,
    `起票日: ${reportDate}`,
    `更新日: ${updatedDate}`,
    '',
    '【本文】',
    requestText,
    '',
    '【添付/参照】',
    refs,
  ].join('\n');
  return {
    id: `workflow-${kadaiId}`,
    folderId: WORKFLOW_INBOX_FOLDER_ID,
    folderName: WORKFLOW_INBOX_FOLDER_NAME,
    soukoId: '',
    name: `${ymd || '----'}_${subject || '業務依頼'}_${kadaiId}.txt`,
    key: kadaiId,
    url: `data:text/plain;charset=utf-8,${encodeURIComponent(plainText)}`,
    size: plainText.length,
    contentType: 'text/plain',
    uploader: requester || '未設定',
    atMs,
  };
}

function extractFileExtension(name) {
  const base = String(name || '').trim().toLowerCase();
  const dot = base.lastIndexOf('.');
  if (dot <= 0 || dot === base.length - 1) return '';
  return base.slice(dot + 1);
}

function detectFileKind(item) {
  const mime = String(item?.contentType || '').toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf') return 'pdf';
  const ext = extractFileExtension(item?.name);
  if (FILEBOX_IMAGE_EXTENSIONS.has(ext)) return 'image';
  if (FILEBOX_VIDEO_EXTENSIONS.has(ext)) return 'video';
  if (FILEBOX_AUDIO_EXTENSIONS.has(ext)) return 'audio';
  if (ext === 'pdf') return 'pdf';
  if (['doc', 'docx', 'odt', 'rtf', 'txt', 'md'].includes(ext)) return 'doc';
  if (['xls', 'xlsx', 'csv', 'tsv', 'ods'].includes(ext)) return 'sheet';
  if (['ppt', 'pptx', 'odp', 'key'].includes(ext)) return 'slide';
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) return 'archive';
  return 'file';
}

function fileKindIcon(kind) {
  switch (kind) {
    case 'image': return '🖼️';
    case 'video': return '🎬';
    case 'audio': return '🎵';
    case 'pdf': return '📕';
    case 'doc': return '📄';
    case 'sheet': return '📊';
    case 'slide': return '📽️';
    case 'archive': return '🗜️';
    default: return '📎';
  }
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function readStoredPaneWidth(key, fallback, min, max) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = Number(localStorage.getItem(key));
    if (!Number.isFinite(raw) || raw <= 0) return fallback;
    return clampNumber(Math.round(raw), min, max);
  } catch {
    return fallback;
  }
}

function readStoredBoolean(key, fallback = true) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = String(localStorage.getItem(key) || '').trim().toLowerCase();
    if (!raw) return fallback;
    if (raw === '1' || raw === 'true') return true;
    if (raw === '0' || raw === 'false') return false;
    return fallback;
  } catch {
    return fallback;
  }
}

function readStoredBooleanMap(key) {
  if (typeof window === 'undefined') return {};
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '{}');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out = {};
    Object.entries(raw).forEach(([k, v]) => {
      const id = String(k || '').trim();
      if (!id) return;
      out[id] = !!v;
    });
    return out;
  } catch {
    return {};
  }
}

function normalizeYoteiIdentityToken(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s\u3000]+/g, '');
}

function expandComparableYoteiTokens(values) {
  const out = [];
  const push = (v) => {
    const normalized = normalizeYoteiIdentityToken(v);
    if (!normalized) return;
    out.push(normalized);
    const hashPos = normalized.lastIndexOf('#');
    if (hashPos >= 0 && hashPos < normalized.length - 1) {
      out.push(normalized.slice(hashPos + 1));
    }
  };
  (Array.isArray(values) ? values : [values]).forEach(push);
  return Array.from(new Set(out));
}

function toYoteiIdentityTokens(value) {
  if (Array.isArray(value)) {
    return value.flatMap((it) => toYoteiIdentityTokens(it));
  }
  if (value && typeof value === 'object') {
    return [
      ...toYoteiIdentityTokens(value?.jinzai_id),
      ...toYoteiIdentityTokens(value?.worker_id),
      ...toYoteiIdentityTokens(value?.sagyouin_id),
      ...toYoteiIdentityTokens(value?.id),
      ...toYoteiIdentityTokens(value?.user_id),
      ...toYoteiIdentityTokens(value?.name),
      ...toYoteiIdentityTokens(value?.display_name),
      ...toYoteiIdentityTokens(value?.worker_name),
      ...toYoteiIdentityTokens(value?.jinzai_name),
      ...toYoteiIdentityTokens(value?.sagyouin_name),
    ];
  }
  const raw = String(value || '').trim();
  if (!raw) return [];
  if (raw.includes(',')) {
    return raw.split(',').flatMap((part) => toYoteiIdentityTokens(part));
  }
  return [raw];
}

function extractYoteiWorkerTokens(row) {
  const raw = [
    ...toYoteiIdentityTokens(row?.worker_id),
    ...toYoteiIdentityTokens(row?.sagyouin_id),
    ...toYoteiIdentityTokens(row?.assigned_to),
    ...toYoteiIdentityTokens(row?.jinzai_id),
    ...toYoteiIdentityTokens(row?.worker_name),
    ...toYoteiIdentityTokens(row?.sagyouin_name),
    ...toYoteiIdentityTokens(row?.jinzai_name),
    ...toYoteiIdentityTokens(row?.worker_ids),
    ...toYoteiIdentityTokens(row?.jinzai_ids),
    ...toYoteiIdentityTokens(row?.assignees),
    ...toYoteiIdentityTokens(row?.participants),
  ];
  return expandComparableYoteiTokens(raw);
}

function toYoteiSortTimeMs(row) {
  const start = toEpochMs(row?.start_at || row?.start_time || row?.start || row?.work_start_at);
  if (start > 0) return start;
  const dateStr = String(row?.date || row?.scheduled_date || '').trim();
  if (!dateStr) return 0;
  const t = Date.parse(`${dateStr}T00:00:00+09:00`);
  return Number.isNaN(t) ? 0 : t;
}

function toYoteiTimeLabel(row) {
  const raw = String(row?.start_at || row?.start_time || row?.start || '').trim();
  if (!raw) return '';
  if (/^\d{1,2}:\d{2}/.test(raw)) return raw.slice(0, 5);
  const ms = toEpochMs(raw);
  if (!ms) return '';
  return hhmmLabel(ms);
}

function toYoteiSingleTimeLabel(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\d{1,2}:\d{2}/.test(raw)) return raw.slice(0, 5);
  const ms = toEpochMs(raw);
  if (!ms) return '';
  return hhmmLabel(ms);
}

function toYoteiTimeRangeLabel(row) {
  const start = toYoteiSingleTimeLabel(row?.start_time || row?.start_at || row?.start || row?.work_start_at);
  const end = toYoteiSingleTimeLabel(row?.end_time || row?.end_at || row?.end || row?.work_end_at);
  if (start && end) return `${start}〜${end}`;
  if (start) return `${start}〜`;
  if (end) return `〜${end}`;
  return '';
}

function toYoteiStartTimeMs(row) {
  const direct = toEpochMs(row?.start_at || row?.start || row?.work_start_at);
  if (direct > 0) return direct;
  const dateStr = String(row?.date || row?.scheduled_date || '').trim();
  const hhmm = toYoteiSingleTimeLabel(row?.start_time);
  if (dateStr && hhmm) {
    const t = Date.parse(`${dateStr}T${hhmm}:00+09:00`);
    if (!Number.isNaN(t)) return t;
  }
  return toYoteiSortTimeMs(row);
}

function toYoteiYagouLabel(row) {
  const candidates = [
    row?.yagou_name,
    row?.yagou,
    row?.brand_name,
    row?.shop_brand_name,
    row?.yagou_label,
    row?.store_brand,
    row?.tenpo?.yagou_name,
    row?.store?.yagou_name,
    row?.meta?.yagou_name,
    row?.yakusoku?.yagou_name,
    row?.yagou_id,
  ];
  for (const c of candidates) {
    const s = String(c || '').trim();
    if (s) return s;
  }
  return '';
}

function toYmdLabelFromRow(row) {
  const direct = String(row?.date || row?.scheduled_date || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(direct)) return direct;
  const ms = toYoteiSortTimeMs(row);
  if (!ms) return '';
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toRelativeYmdTag(ymd, todayYmd, yesterdayYmd, tomorrowYmd) {
  if (!ymd) return '-';
  if (ymd === yesterdayYmd) return '前日';
  if (ymd === todayYmd) return '当日';
  if (ymd === tomorrowYmd) return '明日';
  return ymd.slice(5);
}

function isYoteiCanceledLike(value) {
  const s = String(value || '').trim().toLowerCase();
  return s === 'torikeshi' || s === 'cancel' || s === 'canceled' || s === 'cancelled';
}

function isYoteiCompletedLike(value) {
  const s = String(value || '').trim().toLowerCase();
  return s === 'kanryou' || s === 'complete' || s === 'completed' || s === 'done' || s === '完了';
}

function isYoteiRunningLike(value) {
  const s = String(value || '').trim().toLowerCase();
  return s === 'shinkou' || s === 'working' || s === 'in_progress' || s === 'progress' || s === '実行中' || s === '進行中';
}

function isYoteiUnfinished(row) {
  if (!row) return false;
  const statusCandidates = [
    row?.jotai,
    row?.status,
    row?.state,
    row?.jokyo,
    row?.ugoki_jotai,
    row?.ugoki_status,
    row?.progress_status,
  ];
  if (statusCandidates.some((v) => isYoteiCanceledLike(v))) return false;
  if (statusCandidates.some((v) => isYoteiCompletedLike(v))) return false;
  return true;
}

function parseYoteiAmountValue(row) {
  const candidates = [
    row?.unit_price,
    row?.price,
    row?.amount,
    row?.kingaku,
    row?.total,
    row?.total_amount,
    row?.estimate_amount,
    row?.yotei_amount,
    row?.service_price,
    row?.yakusoku_price,
    row?.uriage_yotei,
  ];
  for (const v of candidates) {
    if (v == null || v === '') continue;
    const n = Number(String(v).replace(/[^\d.-]/g, ''));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

export default function JobEntranceScreen({ job: jobKey, hotbarConfig, showFlowGuideButton = true }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const { user, isAuthenticated, logout, authz } = useAuth();
  const { isTransitioning, startTransition } = useReportStyleTransition(navigate);
  const job = jobKey && JOBS[jobKey];
  const valid = job && JOB_KEYS.includes(jobKey);
  const actions = Array.isArray(hotbarConfig) && hotbarConfig.length > 0 ? hotbarConfig : null;
  const [tab, setTab] = useState(null);
  const [subGroupByTab, setSubGroupByTab] = useState({});
  const useSidebarNav = jobKey === 'admin';
  const adminEntranceMode = ADMIN_ENTRANCE_MODE_DEFAULT;
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return jobKey === 'admin' ? window.innerWidth >= 1024 : false;
  });
  const [openSidebarSectionId, setOpenSidebarSectionId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [updatesSidebarOpen, setUpdatesSidebarOpen] = useState(false);
  const [updatesLoading, setUpdatesLoading] = useState(false);
  const [updatesError, setUpdatesError] = useState('');
  const [todayUpdates, setTodayUpdates] = useState([]);
  const [fileboxFolders, setFileboxFolders] = useState(() => [...DEFAULT_ADMIN_FILEBOX_FOLDERS]);
  const [activeFileboxFolderId, setActiveFileboxFolderId] = useState(null);
  const [fileboxViewMode, setFileboxViewMode] = useState('list');
  const [newFileboxFolderName, setNewFileboxFolderName] = useState('');
  const [fileboxCreatingFolder, setFileboxCreatingFolder] = useState(false);
  const [fileboxFoldersLoading, setFileboxFoldersLoading] = useState(false);
  const [fileboxMap, setFileboxMap] = useState({});
  const [, setFileboxSoukoMap] = useState({});
  const [fileboxLoading, setFileboxLoading] = useState(false);
  const [fileboxUploading, setFileboxUploading] = useState(false);
  const [fileboxError, setFileboxError] = useState('');
  const [dashboardExplorerWidth, setDashboardExplorerWidth] = useState(() =>
    readStoredPaneWidth(
      DASHBOARD_EXPLORER_WIDTH_STORAGE_KEY,
      DASHBOARD_EXPLORER_WIDTH_DEFAULT,
      DASHBOARD_EXPLORER_WIDTH_MIN,
      DASHBOARD_EXPLORER_WIDTH_MAX,
    )
  );
  const [dashboardChatWidth, setDashboardChatWidth] = useState(() =>
    readStoredPaneWidth(
      DASHBOARD_CHAT_WIDTH_STORAGE_KEY,
      DASHBOARD_CHAT_WIDTH_DEFAULT,
      DASHBOARD_CHAT_WIDTH_MIN,
      DASHBOARD_CHAT_WIDTH_MAX,
    )
  );
  const [dashboardResizingPane, setDashboardResizingPane] = useState('');
  const [dashboardExplorerVisible, setDashboardExplorerVisible] = useState(() =>
    readStoredBoolean(DASHBOARD_EXPLORER_VISIBLE_STORAGE_KEY, true)
  );
  const [dashboardChatVisible, setDashboardChatVisible] = useState(() =>
    readStoredBoolean(DASHBOARD_CHAT_VISIBLE_STORAGE_KEY, true)
  );
  const [cleaningTodayNoticesLoading, setCleaningTodayNoticesLoading] = useState(false);
  const [cleaningTodayNotices, setCleaningTodayNotices] = useState([]);
  const [cleaningNoticeRunningMap, setCleaningNoticeRunningMap] = useState(() =>
    readStoredBooleanMap(CLEANING_NOTICE_RUNNING_STORAGE_KEY)
  );
  const [cleaningNoticeSavingMap, setCleaningNoticeSavingMap] = useState({});
  const [cleaningNoticeSlideMap, setCleaningNoticeSlideMap] = useState({});
  const [cleaningNoticeNowMs, setCleaningNoticeNowMs] = useState(() => Date.now());
  const [cleaningStartConfirm, setCleaningStartConfirm] = useState(null);
  const [cleaningStartConfirmSaving, setCleaningStartConfirmSaving] = useState(false);
  const fileboxInputRef = useRef(null);
  const fileboxLayoutRef = useRef(null);
  const fileboxShellRef = useRef(null);
  const cleaningNoticeSwipeRef = useRef({
    id: '',
    pointerId: null,
    startX: 0,
    startOffset: 0,
    moved: false,
  });
  const dashboardResizeRef = useRef({
    startX: 0,
    explorerWidth: DASHBOARD_EXPLORER_WIDTH_DEFAULT,
    chatWidth: DASHBOARD_CHAT_WIDTH_DEFAULT,
  });

  const onHotbar = (id) => {
    const action = actions?.find((a) => a.id === id);
    setTab(id);

    if (action?.to) {
      if (action.to.startsWith('http')) {
        // External link
        window.location.href = action.to;
      } else {
        // Internal link
        startTransition(action.to);
      }
      return;
    }

    // 清掃エントランスではメインHOTバー押下で既定のサブ項目へ進める
    if (jobKey === 'cleaning') {
      const firstSub = Array.isArray(action?.subItems)
        ? action.subItems.find((it) => String(it?.path || it?.to || '').trim())
        : null;
      const firstPath = String(firstSub?.path || firstSub?.to || '').trim();
      if (firstPath) {
        startTransition(firstPath);
      }
    }
  };

  const toggleCleaningNoticeRunning = useCallback(async (notice, checked) => {
    const id = String(notice?.id || '').trim();
    if (!id) return false;
    const previous = !!cleaningNoticeRunningMap[id];
    const idCandidates = Array.from(new Set(
      (Array.isArray(notice?.idCandidates) ? notice.idCandidates : [id])
        .map((v) => String(v || '').trim())
        .filter(Boolean)
    ));
    const nextJokyo = checked ? 'working' : 'mikanryo';

    setCleaningNoticeRunningMap((prev) => ({ ...prev, [id]: !!checked }));
    setCleaningNoticeSavingMap((prev) => ({ ...prev, [id]: true }));
    let saved = false;
    try {
      const base = YOTEI_API_BASE.replace(/\/$/, '');
      let lastErr = '';
      for (const candidateId of idCandidates) {
        const res = await fetch(`${base}/yotei/${encodeURIComponent(candidateId)}`, {
          method: 'PUT',
          headers: {
            ...authHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jokyo: nextJokyo,
            ugoki_jokyo: nextJokyo,
            ugoki_jotai: nextJokyo,
          }),
        });
        if (res.ok) {
          saved = true;
          break;
        }
        const text = await res.text().catch(() => '');
        lastErr = `HTTP ${res.status}${text ? ` ${text}` : ''}`;
      }
      if (!saved) throw new Error(lastErr || 'yotei更新に失敗しました');
      setCleaningTodayNotices((prev) =>
        (Array.isArray(prev) ? prev : []).map((row) => (
          row?.id === id
            ? { ...row, runStatus: checked ? 'shinkou' : 'mikanryo' }
            : row
        ))
      );
      setCleaningNoticeSlideMap((prev) => ({ ...prev, [id]: checked ? CLEANING_NOTICE_SWIPE_MAX : -CLEANING_NOTICE_SWIPE_MAX }));
    } catch (error) {
      setCleaningNoticeRunningMap((prev) => ({ ...prev, [id]: previous }));
      setCleaningNoticeSlideMap((prev) => ({ ...prev, [id]: previous ? CLEANING_NOTICE_SWIPE_MAX : -CLEANING_NOTICE_SWIPE_MAX }));
      window.alert(`実行状態の保存に失敗しました: ${String(error?.message || error || 'unknown error')}`);
    } finally {
      setCleaningNoticeSavingMap((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
    return saved;
  }, [cleaningNoticeRunningMap]);

  const beginCleaningNoticeSwipe = useCallback((item, e) => {
    if (e.button != null && e.button !== 0) return;
    const id = String(item?.id || '').trim();
    if (!id || cleaningNoticeSavingMap[id]) return;
    const currentOffset = Number(
      cleaningNoticeSlideMap[id] ?? (cleaningNoticeRunningMap[id] ? CLEANING_NOTICE_SWIPE_MAX : -CLEANING_NOTICE_SWIPE_MAX)
    );
    cleaningNoticeSwipeRef.current = {
      id,
      pointerId: e.pointerId,
      startX: Number(e.clientX || 0),
      startOffset: Number.isFinite(currentOffset) ? currentOffset : -CLEANING_NOTICE_SWIPE_MAX,
      moved: false,
    };
    if (typeof e.currentTarget?.setPointerCapture === 'function') {
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
    }
  }, [cleaningNoticeRunningMap, cleaningNoticeSavingMap, cleaningNoticeSlideMap]);

  const moveCleaningNoticeSwipe = useCallback((item, e) => {
    const id = String(item?.id || '').trim();
    const st = cleaningNoticeSwipeRef.current;
    if (!id || st.id !== id || st.pointerId !== e.pointerId) return;
    const dx = Number(e.clientX || 0) - st.startX;
    if (Math.abs(dx) >= 4) st.moved = true;
    const nextOffset = Math.max(-CLEANING_NOTICE_SWIPE_MAX, Math.min(CLEANING_NOTICE_SWIPE_MAX, st.startOffset + dx));
    setCleaningNoticeSlideMap((prev) => ({ ...prev, [id]: nextOffset }));
  }, []);

  const openCleaningNoticeDetail = useCallback((item) => {
    const qs = new URLSearchParams();
    qs.set('view', 'single');
    qs.set('yotei_id', String(item?.id || ''));
    if (item?.dateISO) qs.set('date', item.dateISO);
    startTransition(`/jobs/cleaning/yotei?${qs.toString()}`);
  }, [startTransition]);

  const closeCleaningStartConfirm = useCallback(() => {
    const notice = cleaningStartConfirm?.notice;
    const id = String(notice?.id || '').trim();
    if (id) {
      setCleaningNoticeSlideMap((prev) => ({
        ...prev,
        [id]: CLEANING_NOTICE_SWIPE_MAX * -1,
      }));
    }
    setCleaningStartConfirm(null);
    setCleaningStartConfirmSaving(false);
  }, [cleaningStartConfirm]);

  const confirmCleaningStart = useCallback(async () => {
    const notice = cleaningStartConfirm?.notice;
    if (!notice) return;
    setCleaningStartConfirmSaving(true);
    const ok = await toggleCleaningNoticeRunning(notice, true);
    setCleaningStartConfirmSaving(false);
    if (!ok) {
      closeCleaningStartConfirm();
      return;
    }
    setCleaningStartConfirm(null);
    openCleaningNoticeDetail(notice);
  }, [cleaningStartConfirm, closeCleaningStartConfirm, openCleaningNoticeDetail, toggleCleaningNoticeRunning]);

  const endCleaningNoticeSwipe = useCallback(async (item, e, options = {}) => {
    const { openDetailOnTap = false } = options || {};
    const id = String(item?.id || '').trim();
    const st = cleaningNoticeSwipeRef.current;
    if (!id || st.id !== id || st.pointerId !== e.pointerId) return;
    const deltaX = Math.abs(Number(e.clientX || 0) - Number(st.startX || 0));
    const isTap = !st.moved && deltaX < 6;
    const nowOffset = Number(
      cleaningNoticeSlideMap[id] ?? (cleaningNoticeRunningMap[id] ? CLEANING_NOTICE_SWIPE_MAX : -CLEANING_NOTICE_SWIPE_MAX)
    );
    const shouldRun = nowOffset >= CLEANING_NOTICE_SWIPE_THRESHOLD;
    const shouldWait = nowOffset <= -CLEANING_NOTICE_SWIPE_THRESHOLD;
    const wasRunning = !!cleaningNoticeRunningMap[id];

    if (isTap && openDetailOnTap) {
      setCleaningNoticeSlideMap((prev) => ({ ...prev, [id]: wasRunning ? CLEANING_NOTICE_SWIPE_MAX : -CLEANING_NOTICE_SWIPE_MAX }));
      cleaningNoticeSwipeRef.current = { id: '', pointerId: null, startX: 0, startOffset: 0, moved: false };
      if (typeof e.currentTarget?.releasePointerCapture === 'function') {
        try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
      }
      openCleaningNoticeDetail(item);
      return;
    }

    const canStart = Number(item?.readyAtMs || 0) > 0 ? cleaningNoticeNowMs >= Number(item.readyAtMs) : true;
    if (shouldRun && !wasRunning && !canStart) {
      setCleaningNoticeSlideMap((prev) => ({ ...prev, [id]: wasRunning ? CLEANING_NOTICE_SWIPE_MAX : -CLEANING_NOTICE_SWIPE_MAX }));
      if (typeof e.currentTarget?.releasePointerCapture === 'function') {
        try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
      }
      window.alert('開始30分前になるまで実行中にできません');
      cleaningNoticeSwipeRef.current = { id: '', pointerId: null, startX: 0, startOffset: 0, moved: false };
      return;
    }

    if (shouldRun && !wasRunning) {
      setCleaningNoticeSlideMap((prev) => ({ ...prev, [id]: CLEANING_NOTICE_SWIPE_MAX }));
      setCleaningStartConfirm({ notice: item });
      cleaningNoticeSwipeRef.current = { id: '', pointerId: null, startX: 0, startOffset: 0, moved: false };
      if (typeof e.currentTarget?.releasePointerCapture === 'function') {
        try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
      }
      return;
    }

    const nextRunning = shouldRun ? true : (shouldWait ? false : wasRunning);
    setCleaningNoticeSlideMap((prev) => ({
      ...prev,
      [id]: nextRunning ? CLEANING_NOTICE_SWIPE_MAX : -CLEANING_NOTICE_SWIPE_MAX,
    }));
    if (nextRunning !== wasRunning) {
      await toggleCleaningNoticeRunning(item, nextRunning);
    }
    cleaningNoticeSwipeRef.current = { id: '', pointerId: null, startX: 0, startOffset: 0, moved: false };
    if (typeof e.currentTarget?.releasePointerCapture === 'function') {
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    }
  }, [cleaningNoticeNowMs, cleaningNoticeRunningMap, cleaningNoticeSlideMap, openCleaningNoticeDetail, toggleCleaningNoticeRunning]);

  if (!valid) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p>{t('ジョブが見つかりません。')}</p>
        <Link to="/">{t('Portal へ戻る')}</Link>
      </div>
    );
  }

  const currentAction = actions?.find((a) => a.id === tab);
  const showCleaningEntranceNotices = !useSidebarNav && jobKey === 'cleaning' && !tab;
  const cleaningLoginName = String(
    user?.display_name || user?.name || user?.username || user?.user_name || user?.email || '担当者'
  ).trim() || '担当者';
  const showLocalSettingsPanel = !useSidebarNav && currentAction?.id === 'settings';
  const useSimpleCleaningSubHotbar = !useSidebarNav && jobKey === 'cleaning';
  // 遷移時の「MODE CHANGE」演出は無効化したいので、Visualizer の log モードは使わない。
  const vizMode = currentAction?.role === 'log' ? 'base' : (currentAction?.role ?? 'base');
  const showTransition = isTransitioning;

  const subGroups = useMemo(() => {
    const items = currentAction?.subItems;
    if (!Array.isArray(items) || items.length === 0) return null;

    const groups = new Map(); // preserve insertion order
    items.forEach((it) => {
      const g = (it && it.group) ? String(it.group) : t('その他');
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(it);
    });
    return {
      keys: [...groups.keys()],
      itemsByKey: groups,
    };
  }, [currentAction]);

  // タブ切替時に、サブカテゴリが存在するなら先頭に合わせる（未設定時のみ）
  useEffect(() => {
    if (!currentAction?.id) return;
    if (!subGroups?.keys?.length) return;
    const current = subGroupByTab[currentAction.id];
    if (current && subGroups.itemsByKey.has(current)) return;
    setSubGroupByTab((prev) => ({ ...prev, [currentAction.id]: subGroups.keys[0] }));
  }, [currentAction?.id, subGroups?.keys?.length]);

  const activeSubGroupKey = currentAction?.id ? subGroupByTab[currentAction.id] : null;
  const activeSubItems = useMemo(() => {
    if (!subGroups) return currentAction?.subItems || null;
    if (subGroups.keys.length <= 1) return currentAction?.subItems || null;
    const k = activeSubGroupKey || subGroups.keys[0];
    return subGroups.itemsByKey.get(k) || [];
  }, [subGroups, currentAction, activeSubGroupKey]);

  useEffect(() => {
    if (!showCleaningEntranceNotices || !isAuthenticated) {
      setCleaningTodayNoticesLoading(false);
      setCleaningTodayNotices([]);
      return;
    }

    const workerIdentityRaw = Array.from(new Set([
      ...toYoteiIdentityTokens(authz?.workerId),
      ...toYoteiIdentityTokens(authz?.jinzaiId),
      ...toYoteiIdentityTokens(user?.jinzai_id),
      ...toYoteiIdentityTokens(user?.worker_id),
      ...toYoteiIdentityTokens(user?.workerId),
      ...toYoteiIdentityTokens(user?.sagyouin_id),
      ...toYoteiIdentityTokens(user?.id),
      ...toYoteiIdentityTokens(user?.user_id),
      ...toYoteiIdentityTokens(user?.name),
      ...toYoteiIdentityTokens(user?.display_name),
      ...toYoteiIdentityTokens(user?.attributes?.name),
    ].map((v) => String(v || '').trim()).filter(Boolean)));
    const workerTokens = expandComparableYoteiTokens(workerIdentityRaw);
    if (!workerTokens.length) {
      setCleaningTodayNoticesLoading(false);
      setCleaningTodayNotices([]);
      return;
    }

    let cancelled = false;
    const today = new Date();
    const rangeFromDate = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
    const rangeToDate = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
    const toYmd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const rangeFromYmd = toYmd(rangeFromDate);
    const rangeToYmd = toYmd(rangeToDate);
    const loadTodayNotices = async () => {
      setCleaningTodayNoticesLoading(true);
      try {
        const qs = new URLSearchParams();
        qs.set('from', rangeFromYmd);
        qs.set('to', rangeToYmd);
        qs.set('limit', '2000');
        const primaryWorkerId = workerIdentityRaw[0] || workerTokens[0];
        qs.set('jinzai_id', primaryWorkerId);
        qs.set('worker_id', primaryWorkerId);
        qs.set('sagyouin_id', primaryWorkerId);
        qs.set('assigned_to', primaryWorkerId);
        const res = await fetch(`${YOTEI_API_BASE}/yotei?${qs.toString()}`, {
          headers: {
            ...authHeaders(),
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.json();
        const rows = asItems(raw);
        let filtered = rows.filter((row) => {
          const rowTokens = extractYoteiWorkerTokens(row);
          if (!rowTokens.length) return false;
          return rowTokens.some((token) => workerTokens.includes(token));
        });
        if (!filtered.length) {
          const fallbackQs = new URLSearchParams();
          fallbackQs.set('from', rangeFromYmd);
          fallbackQs.set('to', rangeToYmd);
          fallbackQs.set('limit', '5000');
          const fallbackRes = await fetch(`${YOTEI_API_BASE}/yotei?${fallbackQs.toString()}`, {
            headers: {
              ...authHeaders(),
              'Content-Type': 'application/json',
            },
            cache: 'no-store',
          });
          if (fallbackRes.ok) {
            const fallbackRaw = await fallbackRes.json();
            const fallbackRows = asItems(fallbackRaw);
            filtered = fallbackRows.filter((row) => {
              const rowTokens = extractYoteiWorkerTokens(row);
              if (!rowTokens.length) return false;
              return rowTokens.some((token) => workerTokens.includes(token));
            });
          }
        }
        const unfinishedRows = filtered.filter((row) => isYoteiUnfinished(row));
        const notices = unfinishedRows
          .slice()
          .sort((a, b) => toYoteiSortTimeMs(a) - toYoteiSortTimeMs(b))
          .slice(-5)
          .map((row, idx) => {
            const idCandidates = Array.from(new Set(
              [
                row?.id,
                row?.yotei_id,
                row?.schedule_id,
              ].map((v) => String(v || '').trim()).filter(Boolean)
            ));
            const id = String(idCandidates[0] || `yotei-${idx}`).trim();
            const ymd = toYmdLabelFromRow(row);
            const rangeTime = toYoteiTimeRangeLabel(row) || toYoteiTimeLabel(row);
            const startTime = toYoteiSingleTimeLabel(row?.start_time || row?.start_at || row?.start || row?.work_start_at);
            const endTime = toYoteiSingleTimeLabel(row?.end_time || row?.end_at || row?.end || row?.work_end_at);
            const rangeParts = String(rangeTime || '').split('〜').map((s) => String(s || '').trim());
            const startTimeLabel = startTime || rangeParts[0] || '--:--';
            const endTimeLabel = endTime || (rangeParts.length > 1 ? rangeParts[1] : '') || '--:--';
            const yagou = toYoteiYagouLabel(row);
            const tenpo = String(
              row?.tenpo_name
              || row?.genba_name
              || row?.tenpo_id
              || '-'
            ).trim();
            const amount = parseYoteiAmountValue(row);
            const runStatus = isYoteiRunningLike(
              row?.jokyo || row?.ugoki_jokyo || row?.ugoki_jotai || row?.ugoki_status || row?.status
            ) ? 'shinkou' : 'mikanryo';
            const startAtMs = toYoteiStartTimeMs(row);
            return {
              id,
              idCandidates,
              dateISO: ymd || '',
              dateLabel: ymd ? ymd.replace(/-/g, '/') : '----/--/--',
              yagou: yagou || '-',
              tenpo: tenpo || '-',
              time: `${startTimeLabel}〜${endTimeLabel}`,
              startTimeLabel,
              endTimeLabel,
              amountLabel: amount > 0 ? `¥${amount.toLocaleString('ja-JP')}` : '-',
              runStatus,
              startAtMs,
              readyAtMs: startAtMs > 0 ? (startAtMs - 30 * 60 * 1000) : 0,
            };
          });

        if (cancelled) return;
        setCleaningTodayNotices(notices);
        setCleaningNoticeRunningMap((prev) => {
          const next = { ...(prev || {}) };
          notices.forEach((item) => {
            next[item.id] = item.runStatus === 'shinkou';
          });
          return next;
        });
      } catch (error) {
        if (!cancelled) {
          setCleaningTodayNotices([]);
        }
      } finally {
        if (!cancelled) setCleaningTodayNoticesLoading(false);
      }
    };

    loadTodayNotices();
    return () => {
      cancelled = true;
    };
  }, [showCleaningEntranceNotices, isAuthenticated, user, authz?.workerId, authz?.jinzaiId]);

  useEffect(() => {
    if (!showCleaningEntranceNotices) return undefined;
    const timer = window.setInterval(() => {
      setCleaningNoticeNowMs(Date.now());
    }, 30000);
    return () => window.clearInterval(timer);
  }, [showCleaningEntranceNotices]);

  useEffect(() => {
    if (!showCleaningEntranceNotices && cleaningStartConfirm) {
      setCleaningStartConfirm(null);
      setCleaningStartConfirmSaving(false);
    }
  }, [showCleaningEntranceNotices, cleaningStartConfirm]);

  useEffect(() => {
    setCleaningNoticeSlideMap((prev) => {
      const next = { ...(prev || {}) };
      const alive = new Set();
      (Array.isArray(cleaningTodayNotices) ? cleaningTodayNotices : []).forEach((item) => {
        const id = String(item?.id || '').trim();
        if (!id) return;
        alive.add(id);
        const activeDrag = cleaningNoticeSwipeRef.current?.id === id;
        if (activeDrag) return;
        next[id] = cleaningNoticeRunningMap[id] ? CLEANING_NOTICE_SWIPE_MAX : -CLEANING_NOTICE_SWIPE_MAX;
      });
      Object.keys(next).forEach((id) => {
        if (!alive.has(id)) delete next[id];
      });
      return next;
    });
  }, [cleaningTodayNotices, cleaningNoticeRunningMap]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(
        CLEANING_NOTICE_RUNNING_STORAGE_KEY,
        JSON.stringify(cleaningNoticeRunningMap || {})
      );
    } catch {
      // noop
    }
  }, [cleaningNoticeRunningMap]);

  useEffect(() => {
    if (!useSidebarNav) return;
    const onResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [useSidebarNav]);

  const sidebarSections = useMemo(() => {
    if (!useSidebarNav || !Array.isArray(actions)) return [];
    return actions
      .map((section) => {
        const subItems = Array.isArray(section?.subItems) ? section.subItems : [];
        if (!subItems.length) return null;
        const directPath = String(subItems[0]?.path || subItems[0]?.to || '').trim();
        const isDirect = subItems.length === 1
          && !!directPath
          && (section?.direct === true || ADMIN_DIRECT_SIDEBAR_SECTION_IDS.has(String(section?.id || '')));
        return {
          id: section.id,
          label: section.label,
          items: subItems,
          isDirect,
          directPath: isDirect ? directPath : '',
        };
      })
      .filter(Boolean);
  }, [actions, useSidebarNav]);

  const isPathActive = (path) => {
    if (!path) return false;
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const onSidebarNavigate = (path) => {
    if (!path || isTransitioning) return;
    if (/^https?:\/\//i.test(String(path))) {
      window.open(String(path), '_blank', 'noopener,noreferrer');
      if (window.innerWidth < 1024) setSidebarOpen(false);
      return;
    }
    startTransition(path);
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  const onSidebarAuth = () => {
    if (isAuthenticated) {
      logout?.();
    } else {
      startTransition('/');
    }
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  const loadTodayUpdates = useCallback(async () => {
    if (!useSidebarNav) return;
    setUpdatesLoading(true);
    setUpdatesError('');
    try {
      const now = new Date();
      const ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const [kanriResult, reportsResult, customerChatResult] = await Promise.allSettled([
        fetch(`${MASTER_API_BASE}/master/kanri_log?limit=400&jotai=yuko`, {
          headers: {
            ...authHeaders(),
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        }).then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        }),
        getAdminWorkReports({
          from: ymd,
          to: ymd,
          states: ['draft', 'submitted', 'triaged', 'rejected', 'approved', 'archived'],
          limit: 500,
        }),
        fetch(
          `${MASTER_API_BASE}/master/admin_chat?limit=400&jotai=yuko&room=${encodeURIComponent(CUSTOMER_CHAT_ADMIN_ROOM)}`,
          {
            headers: {
              ...authHeaders(),
              'Content-Type': 'application/json',
            },
            cache: 'no-store',
          }
        ).then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        }),
      ]);

      const kanriRows = kanriResult.status === 'fulfilled' ? asItems(kanriResult.value) : [];
      const reportRows = reportsResult.status === 'fulfilled' ? asItems(reportsResult.value) : [];
      const customerChatRows = customerChatResult.status === 'fulfilled' ? asItems(customerChatResult.value) : [];

      const logEvents = kanriRows
        .map((row) => {
          const whenMs = toEpochMs(row?.updated_at || row?.created_at || row?.reported_at || row?.date);
          const who = pickDisplayName(
            row?.updated_by_name,
            row?.reported_by_name,
            row?.created_by_name,
            row?.user_name,
            row?.worker_name,
            row?.reporter_name,
            row?.updated_by,
            row?.reported_by,
            row?.created_by,
          );
          const isLogin = isLikelyLoginEvent(row);
          const fact = isLogin ? 'ログインしました' : summarizeFact(row);
          return {
            id: String(row?.kanri_log_id || row?.id || `${who}-${whenMs}-${Math.random()}`),
            atMs: whenMs,
            atLabel: hhmmLabel(whenMs),
            who,
            what: `${who}が${fact} >>> ${ymdHmLabel(whenMs)}`,
            kind: isLogin ? 'login' : 'update',
          };
        })
        .filter(Boolean)
        .filter((row) => isSameLocalDate(row.atMs, now));

      const reportEvents = reportRows
        .map((item) => {
          const whenMs = toEpochMs(item?.submitted_at || item?.updated_at || item?.created_at);
          const who = reportWho(item);
          const fact = reportActionLabel(item);
          return {
            id: String(item?.log_id || item?.report_id || item?.id || `${who}-${whenMs}-${Math.random()}`),
            atMs: whenMs,
            atLabel: hhmmLabel(whenMs),
            who,
            what: `${who}が${fact} >>> ${ymdHmLabel(whenMs)}`,
            kind: 'work-report',
          };
        })
        .filter(Boolean)
        .filter((row) => isSameLocalDate(row.atMs, now));

      const customerChatEvents = customerChatRows
        .map((row) => {
          const whenMs = toEpochMs(row?.created_at || row?.updated_at || row?.reported_at || row?.date);
          const who = pickDisplayName(
            row?.sender_display_name,
            row?.sender_name,
            row?.updated_by_name,
            row?.created_by_name,
            row?.user_name,
            row?.sender_id,
          );
          const rawPayload = row?.data_payload;
          const payload = (rawPayload && typeof rawPayload === 'object')
            ? rawPayload
            : (() => {
                try {
                  return rawPayload ? JSON.parse(String(rawPayload)) : {};
                } catch {
                  return {};
                }
              })();
          const storeLabel = String(
            payload?.store_label
            || [payload?.yagou_name, payload?.tenpo_name].filter(Boolean).join(' / ')
            || ''
          ).trim();
          const message = String(row?.message || row?.name || '').trim();
          const messagePreview = message ? `「${message.length > 24 ? `${message.slice(0, 24)}…` : message}」` : '';
          const storeSuffix = storeLabel ? `（${storeLabel}）` : '';
          return {
            id: String(row?.chat_id || row?.id || `${who}-${whenMs}-${Math.random()}`),
            atMs: whenMs,
            atLabel: hhmmLabel(whenMs),
            who,
            what: `${who}がお客様チャットを送信しました${storeSuffix}${messagePreview} >>> ${ymdHmLabel(whenMs)}`,
            kind: 'customer-chat',
          };
        })
        .filter(Boolean)
        .filter((row) => isSameLocalDate(row.atMs, now));

      const list = [...customerChatEvents, ...reportEvents, ...logEvents]
        .sort((a, b) => b.atMs - a.atMs)
        .slice(0, 80);

      setTodayUpdates(list);
      if (
        kanriResult.status === 'rejected'
        && reportsResult.status === 'rejected'
        && customerChatResult.status === 'rejected'
      ) {
        setUpdatesError('更新通知の取得に失敗しました');
      }
    } catch {
      setUpdatesError('更新通知の取得に失敗しました');
      setTodayUpdates([]);
    } finally {
      setUpdatesLoading(false);
    }
  }, [useSidebarNav]);

  useEffect(() => {
    if (!useSidebarNav || !sidebarSections.length) return;
    setOpenSidebarSectionId((prev) => {
      if (prev && sidebarSections.some((section) => section.id === prev)) return prev;
      const firstExpandable = sidebarSections.find((section) => !section.isDirect);
      return firstExpandable?.id || null;
    });
  }, [sidebarSections, useSidebarNav]);

  useEffect(() => {
    if (!useSidebarNav || !sidebarSections.length) return;
    const activeSection = sidebarSections.find((section) =>
      section.items.some((item) => isPathActive(item.path || item.to))
    );
    if (!activeSection) return;
    if (activeSection.isDirect) return;
    setOpenSidebarSectionId(activeSection.id);
  }, [location.pathname, sidebarSections, useSidebarNav]);

  useEffect(() => {
    if (!useSidebarNav || typeof document === 'undefined') return undefined;
    const root = document.documentElement;
    const prevTheme = root.getAttribute('data-theme');
    root.setAttribute('data-theme', 'light');
    try {
      localStorage.setItem('theme', 'light');
    } catch {
      // ignore
    }
    return () => {
      if (prevTheme === 'dark' || prevTheme === 'light') {
        root.setAttribute('data-theme', prevTheme);
      } else {
        root.removeAttribute('data-theme');
      }
    };
  }, [useSidebarNav]);

  useEffect(() => {
    if (!useSidebarNav) return;
    let cancelled = false;
    let timer = null;
    const tick = async () => {
      if (cancelled) return;
      await loadTodayUpdates();
      if (!cancelled) timer = window.setTimeout(tick, ADMIN_UPDATES_POLL_MS);
    };
    tick();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [loadTodayUpdates, useSidebarNav]);

  const updatesRailLeft = useSidebarNav ? (sidebarOpen ? 'min(236px, 80vw)' : '0px') : '0px';
  const updatesPanelLeft = updatesRailLeft;
  const showAdminDashboard = useSidebarNav && location.pathname === '/admin/dashboard';
  const showAdminFilebox = useSidebarNav && location.pathname === '/admin/filebox';
  const showAdminWorkspace = showAdminDashboard || showAdminFilebox;
  const beginDashboardResize = useCallback((pane, event) => {
    if (!showAdminWorkspace) return;
    if (typeof window === 'undefined' || window.innerWidth < DASHBOARD_RESIZER_ENABLED_MIN_WIDTH) return;
    if (pane === 'explorer' && !dashboardExplorerVisible) return;
    if (pane === 'chat' && !dashboardChatVisible) return;
    dashboardResizeRef.current = {
      startX: Number(event?.clientX || 0),
      explorerWidth: dashboardExplorerWidth,
      chatWidth: dashboardChatWidth,
    };
    setDashboardResizingPane(pane);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  }, [dashboardChatVisible, dashboardChatWidth, dashboardExplorerVisible, dashboardExplorerWidth, showAdminWorkspace]);

  useEffect(() => {
    try {
      localStorage.setItem(DASHBOARD_EXPLORER_WIDTH_STORAGE_KEY, String(Math.round(dashboardExplorerWidth)));
    } catch {
      // ignore
    }
  }, [dashboardExplorerWidth]);

  useEffect(() => {
    try {
      localStorage.setItem(DASHBOARD_CHAT_WIDTH_STORAGE_KEY, String(Math.round(dashboardChatWidth)));
    } catch {
      // ignore
    }
  }, [dashboardChatWidth]);

  useEffect(() => {
    try {
      localStorage.setItem(DASHBOARD_EXPLORER_VISIBLE_STORAGE_KEY, dashboardExplorerVisible ? '1' : '0');
    } catch {
      // ignore
    }
  }, [dashboardExplorerVisible]);

  useEffect(() => {
    try {
      localStorage.setItem(DASHBOARD_CHAT_VISIBLE_STORAGE_KEY, dashboardChatVisible ? '1' : '0');
    } catch {
      // ignore
    }
  }, [dashboardChatVisible]);

  useEffect(() => {
    if (!dashboardResizingPane) return undefined;
    const onMove = (event) => {
      const startX = Number(dashboardResizeRef.current.startX || 0);
      if (dashboardResizingPane === 'explorer') {
        const shellRect = fileboxShellRef.current?.getBoundingClientRect();
        const shellWidth = Number(shellRect?.width || 0);
        const dynamicMax = shellWidth > 0
          ? Math.max(
            DASHBOARD_EXPLORER_WIDTH_MIN,
            Math.floor(shellWidth - DASHBOARD_RESIZER_BAR_WIDTH - DASHBOARD_WORKSPACE_MIN_WIDTH),
          )
          : DASHBOARD_EXPLORER_WIDTH_MAX;
        const maxWidth = clampNumber(dynamicMax, DASHBOARD_EXPLORER_WIDTH_MIN, DASHBOARD_EXPLORER_WIDTH_MAX);
        const next = dashboardResizeRef.current.explorerWidth + (Number(event?.clientX || 0) - startX);
        setDashboardExplorerWidth(clampNumber(Math.round(next), DASHBOARD_EXPLORER_WIDTH_MIN, maxWidth));
        return;
      }
      if (dashboardResizingPane === 'chat') {
        const layoutRect = fileboxLayoutRef.current?.getBoundingClientRect();
        const layoutWidth = Number(layoutRect?.width || 0);
        const dynamicMax = layoutWidth > 0
          ? Math.max(
            DASHBOARD_CHAT_WIDTH_MIN,
            Math.floor(layoutWidth - DASHBOARD_RESIZER_BAR_WIDTH - DASHBOARD_PANEL_MIN_WIDTH),
          )
          : DASHBOARD_CHAT_WIDTH_MAX;
        const maxWidth = clampNumber(dynamicMax, DASHBOARD_CHAT_WIDTH_MIN, DASHBOARD_CHAT_WIDTH_MAX);
        const next = dashboardResizeRef.current.chatWidth + (startX - Number(event?.clientX || 0));
        setDashboardChatWidth(clampNumber(Math.round(next), DASHBOARD_CHAT_WIDTH_MIN, maxWidth));
      }
    };
    const stop = () => {
      setDashboardResizingPane('');
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [dashboardResizingPane]);

  useEffect(() => {
    if (dashboardResizingPane === 'explorer' && !dashboardExplorerVisible) {
      setDashboardResizingPane('');
    }
    if (dashboardResizingPane === 'chat' && !dashboardChatVisible) {
      setDashboardResizingPane('');
    }
  }, [dashboardChatVisible, dashboardExplorerVisible, dashboardResizingPane]);

  useEffect(() => {
    const onPaneToggle = (event) => {
      const pane = String(event?.detail?.pane || '').toLowerCase();
      const requestedVisible = event?.detail?.visible;
      if (pane === 'explorer') {
        setDashboardExplorerVisible((prev) => (typeof requestedVisible === 'boolean' ? requestedVisible : !prev));
        return;
      }
      if (pane === 'chat') {
        setDashboardChatVisible((prev) => (typeof requestedVisible === 'boolean' ? requestedVisible : !prev));
      }
    };
    window.addEventListener(DASHBOARD_PANE_TOGGLE_EVENT, onPaneToggle);
    return () => window.removeEventListener(DASHBOARD_PANE_TOGGLE_EVENT, onPaneToggle);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const clampDashboardPaneWidths = () => {
      const layoutRect = fileboxLayoutRef.current?.getBoundingClientRect();
      const shellRect = fileboxShellRef.current?.getBoundingClientRect();
      const layoutWidth = Number(layoutRect?.width || 0);
      const shellWidth = Number(shellRect?.width || 0);
      const dynamicChatMax = layoutWidth > 0
        ? Math.max(
          DASHBOARD_CHAT_WIDTH_MIN,
          Math.floor(layoutWidth - DASHBOARD_RESIZER_BAR_WIDTH - DASHBOARD_PANEL_MIN_WIDTH),
        )
        : DASHBOARD_CHAT_WIDTH_MAX;
      const chatMax = clampNumber(dynamicChatMax, DASHBOARD_CHAT_WIDTH_MIN, DASHBOARD_CHAT_WIDTH_MAX);
      const dynamicExplorerMax = shellWidth > 0
        ? Math.max(
          DASHBOARD_EXPLORER_WIDTH_MIN,
          Math.floor(shellWidth - DASHBOARD_RESIZER_BAR_WIDTH - DASHBOARD_WORKSPACE_MIN_WIDTH),
        )
        : DASHBOARD_EXPLORER_WIDTH_MAX;
      const explorerMax = clampNumber(dynamicExplorerMax, DASHBOARD_EXPLORER_WIDTH_MIN, DASHBOARD_EXPLORER_WIDTH_MAX);
      setDashboardChatWidth((prev) => clampNumber(prev, DASHBOARD_CHAT_WIDTH_MIN, chatMax));
      setDashboardExplorerWidth((prev) => clampNumber(prev, DASHBOARD_EXPLORER_WIDTH_MIN, explorerMax));
    };
    if (showAdminWorkspace) {
      window.requestAnimationFrame(clampDashboardPaneWidths);
    }
    window.addEventListener('resize', clampDashboardPaneWidths);
    return () => {
      window.removeEventListener('resize', clampDashboardPaneWidths);
    };
  }, [showAdminWorkspace]);

  const fileboxActor = useMemo(() => {
    const name = String(
      user?.name
      || user?.display_name
      || user?.attributes?.name
      || user?.email
      || readLocalUserName()
      || '管理者'
    ).trim();
    const id = String(user?.id || user?.worker_id || user?.sagyouin_id || name || 'admin').trim();
    return { name, id };
  }, [user]);
  const fileboxOwnerDept = useMemo(() => {
    return String(
      user?.department
      || user?.dept
      || user?.busho
      || user?.attributes?.department
      || user?.attributes?.dept
      || user?.attributes?.busho
      || user?.attributes?.['custom:department']
      || user?.attributes?.['custom:busho']
      || ''
    ).trim();
  }, [user]);
  const fileboxOwnerKey = useMemo(() => {
    return normalizeMatchToken(fileboxActor.name || fileboxActor.id);
  }, [fileboxActor.id, fileboxActor.name]);
  const workflowReceiverTokens = useMemo(() => {
    const raw = [
      fileboxActor.name,
      user?.department,
      user?.dept,
      user?.busho,
      user?.attributes?.department,
      user?.attributes?.dept,
      user?.attributes?.busho,
      user?.attributes?.['custom:department'],
      user?.attributes?.['custom:busho'],
    ];
    const normalized = raw
      .map((v) => String(v || '').trim())
      .filter(Boolean)
      .map((v) => normalizeMatchToken(v));
    return [...new Set(normalized)];
  }, [fileboxActor.name, user]);
  const folderById = useMemo(
    () => Object.fromEntries(fileboxFolders.map((row) => [row.id, row])),
    [fileboxFolders]
  );
  const activeFileboxFolder = activeFileboxFolderId ? (folderById[activeFileboxFolderId] || null) : null;
  const activeFolderItems = useMemo(() => {
    if (!activeFileboxFolder?.id) return [];
    const list = Array.isArray(fileboxMap[activeFileboxFolder.id]) ? fileboxMap[activeFileboxFolder.id] : [];
    return list.slice().sort((a, b) => b.atMs - a.atMs);
  }, [activeFileboxFolder?.id, fileboxMap]);
  const dashboardTitleLabel = activeFileboxFolder?.name || t('ファイルボックス');
  const fileboxStats = useMemo(() => {
    const stats = {};
    fileboxFolders.forEach((folder) => {
      const list = Array.isArray(fileboxMap[folder.id]) ? fileboxMap[folder.id] : [];
      const latest = list.slice().sort((a, b) => b.atMs - a.atMs)[0];
      stats[folder.id] = {
        count: list.length,
        latestAtMs: latest?.atMs || 0,
      };
    });
    return stats;
  }, [fileboxFolders, fileboxMap]);
  const fileboxBusy = fileboxLoading || fileboxUploading || fileboxCreatingFolder || fileboxFoldersLoading;

  const createFileboxSoukoFolder = useCallback(async (folder) => {
    const base = MASTER_API_BASE.replace(/\/$/, '');
    const res = await fetch(`${base}/master/souko`, {
      method: 'POST',
      headers: {
        ...authHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenpo_id: FILEBOX_SOUKO_TENPO_ID,
        source: FILEBOX_SOUKO_SOURCE,
        folder_id: folder.id,
        folder_name: folder.name,
        name: `${folder.name} フォルダ`,
        uploaded_by: fileboxActor.id,
        uploaded_by_name: fileboxActor.name,
        owner_name: fileboxActor.name,
        owner_key: fileboxOwnerKey,
        owner_dept: fileboxOwnerDept,
        files: [],
        jotai: 'yuko',
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`フォルダ作成失敗: HTTP ${res.status}${txt ? ` ${txt}` : ''}`);
    }
    return res.json();
  }, [fileboxActor.id, fileboxActor.name, fileboxOwnerDept, fileboxOwnerKey]);

  const loadFileboxData = useCallback(async () => {
    if (!useSidebarNav) return;
    setFileboxFoldersLoading(true);
    setFileboxLoading(true);
    setFileboxError('');
    try {
      const base = MASTER_API_BASE.replace(/\/$/, '');
      const qs = new URLSearchParams({
        limit: '1000',
        jotai: 'yuko',
        tenpo_id: FILEBOX_SOUKO_TENPO_ID,
        source: FILEBOX_SOUKO_SOURCE,
        owner_key: fileboxOwnerKey,
      });
      const res = await fetch(`${base}/master/souko?${qs.toString()}`, {
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`フォルダ一覧取得失敗: HTTP ${res.status}${txt ? ` ${txt}` : ''}`);
      }

      const rows = asItems(await res.json());
      const rowByFolderId = new Map();
      rows.forEach((row) => {
        const parsed = parseFileboxFolderMeta(row);
        if (!parsed) return;
        const prev = rowByFolderId.get(parsed.id);
        if (!prev || parsed.atMs >= prev.atMs) {
          rowByFolderId.set(parsed.id, row);
        }
      });

      let workflowItems = [];
      try {
        const workflowQs = new URLSearchParams({
          limit: '2000',
          jotai: 'yuko',
        });
        const workflowRes = await fetch(`${base}/master/kadai?${workflowQs.toString()}`, {
          headers: {
            ...authHeaders(),
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        });
        if (workflowRes.ok) {
          const workflowRows = asItems(await workflowRes.json());
          workflowItems = workflowRows
            .filter((row) => {
              const targets = parseNameList(row?.target_to).map((v) => normalizeMatchToken(v)).filter(Boolean);
              if (!targets.length) return true;
              if (!workflowReceiverTokens.length) return true;
              return workflowReceiverTokens.some((receiver) =>
                targets.some((target) => target.includes(receiver) || receiver.includes(target))
              );
            })
            .map((row) => rowToWorkflowRequestFile(row))
            .filter(Boolean)
            .sort((a, b) => b.atMs - a.atMs);
        }
      } catch (workflowErr) {
        console.error('failed to load workflow inbox items', workflowErr);
      }

      const customFolders = [...rowByFolderId.values()]
        .map((row) => parseFileboxFolderMeta(row))
        .filter((row) => row && !DEFAULT_ADMIN_FILEBOX_FOLDER_IDS.has(row.id))
        .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ja'))
        .map(({ id, name }) => ({ id, name }));

      const mergedFolders = [...DEFAULT_ADMIN_FILEBOX_FOLDERS, ...customFolders];
      const nextSoukoMap = {};
      const nextFileMap = {};
      mergedFolders.forEach((folder) => {
        if (folder.id === WORKFLOW_INBOX_FOLDER_ID) {
          nextFileMap[folder.id] = workflowItems;
          return;
        }
        const row = rowByFolderId.get(folder.id);
        if (row) nextSoukoMap[folder.id] = row;
        nextFileMap[folder.id] = row ? parseFileboxFiles(row, folder) : [];
      });

      setFileboxFolders(mergedFolders);
      setFileboxSoukoMap(nextSoukoMap);
      setFileboxMap(nextFileMap);
    } catch (e) {
      setFileboxError(String(e?.message || e || 'ファイルボックスの取得に失敗しました'));
      setFileboxFolders([...DEFAULT_ADMIN_FILEBOX_FOLDERS]);
      setFileboxSoukoMap({});
      setFileboxMap({});
    } finally {
      setFileboxFoldersLoading(false);
      setFileboxLoading(false);
    }
  }, [fileboxOwnerKey, useSidebarNav, workflowReceiverTokens]);

  const fetchSoukoFolderRecord = useCallback(async (folderId) => {
    const normalizedFolderId = normalizeFileboxFolderId(folderId);
    if (!normalizedFolderId) return null;
    const base = MASTER_API_BASE.replace(/\/$/, '');
    const qs = new URLSearchParams({
      limit: '20',
      jotai: 'yuko',
      tenpo_id: FILEBOX_SOUKO_TENPO_ID,
      source: FILEBOX_SOUKO_SOURCE,
      folder_id: normalizedFolderId,
      owner_key: fileboxOwnerKey,
    });
    const res = await fetch(`${base}/master/souko?${qs.toString()}`, {
      headers: {
        ...authHeaders(),
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });
    if (!res.ok) {
      return null;
    }
    const rows = asItems(await res.json());
    return rows
      .slice()
      .sort((a, b) => toEpochMs(b?.updated_at || b?.created_at) - toEpochMs(a?.updated_at || a?.created_at))[0] || null;
  }, [fileboxOwnerKey]);

  const ensureSoukoFolderRecord = useCallback(async (folder) => {
    const latest = await fetchSoukoFolderRecord(folder.id);
    if (latest?.souko_id) {
      setFileboxSoukoMap((prev) => ({ ...prev, [folder.id]: latest }));
      return latest;
    }
    const created = await createFileboxSoukoFolder(folder);
    setFileboxSoukoMap((prev) => ({ ...prev, [folder.id]: created }));
    return created;
  }, [createFileboxSoukoFolder, fetchSoukoFolderRecord]);

  const uploadFileboxFile = useCallback(async (folder, file) => {
    if (!folder || !file) return;
    if (file.size > FILEBOX_MAX_UPLOAD_SIZE) {
      throw new Error(`「${file.name}」は15MB以下にしてください`);
    }
    const currentFolderRecord = await ensureSoukoFolderRecord(folder);
    const base = MASTER_API_BASE.replace(/\/$/, '');
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
    const putRes = await fetch(String(presign?.put_url || ''), {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: file,
    });
    if (!putRes.ok) {
      throw new Error(`アップロード失敗: HTTP ${putRes.status}`);
    }
    const nextFiles = [
      ...(Array.isArray(currentFolderRecord?.files) ? currentFolderRecord.files : []),
      {
        key: String(presign?.key || ''),
        file_name: String(file.name || 'file'),
        content_type: contentType,
        size: Number(file.size || 0),
        uploaded_at: new Date().toISOString(),
        uploaded_by: fileboxActor.id,
        uploaded_by_name: fileboxActor.name,
        preview_url: String(presign?.get_url || ''),
      },
    ];
    const updateRes = await fetch(`${base}/master/souko/${encodeURIComponent(String(currentFolderRecord?.souko_id || ''))}`, {
      method: 'PUT',
      headers: {
        ...authHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...currentFolderRecord,
        tenpo_id: String(currentFolderRecord?.tenpo_id || FILEBOX_SOUKO_TENPO_ID),
        source: FILEBOX_SOUKO_SOURCE,
        folder_id: folder.id,
        folder_name: folder.name,
        name: String(currentFolderRecord?.name || `${folder.name} フォルダ`),
        uploaded_by: fileboxActor.id,
        uploaded_by_name: fileboxActor.name,
        owner_name: String(currentFolderRecord?.owner_name || fileboxActor.name || ''),
        owner_key: String(currentFolderRecord?.owner_key || fileboxOwnerKey || ''),
        owner_dept: String(currentFolderRecord?.owner_dept || fileboxOwnerDept || ''),
        files: nextFiles,
      }),
    });
    if (!updateRes.ok) {
      const txt = await updateRes.text();
      throw new Error(`アップロード記録失敗: HTTP ${updateRes.status}${txt ? ` ${txt}` : ''}`);
    }
    const updated = await updateRes.json();
    setFileboxSoukoMap((prev) => ({ ...prev, [folder.id]: updated }));
  }, [ensureSoukoFolderRecord, fileboxActor.id, fileboxActor.name, fileboxOwnerDept, fileboxOwnerKey]);

  const onFileboxUploadClick = useCallback(() => {
    if (fileboxUploading) return;
    if (!activeFileboxFolder) {
      setFileboxError('先にフォルダを選択してください');
      return;
    }
    if (activeFileboxFolder.id === WORKFLOW_INBOX_FOLDER_ID) {
      setFileboxError('受信業務依頼フォルダはアップロード対象外です');
      return;
    }
    fileboxInputRef.current?.click();
  }, [activeFileboxFolder, fileboxUploading]);

  const onCreateFileboxFolder = useCallback(async () => {
    const name = String(newFileboxFolderName || '').trim();
    if (!name) {
      setFileboxError('フォルダ名を入力してください');
      return;
    }
    if (fileboxFolders.some((row) => row.name === name)) {
      setFileboxError('同名のフォルダが既にあります');
      return;
    }
    setFileboxCreatingFolder(true);
    try {
      const baseId = normalizeFileboxFolderId(name) || `folder_${Date.now().toString(36)}`;
      let id = baseId;
      let index = 2;
      while (fileboxFolders.some((row) => row.id === id)) {
        id = `${baseId}_${index}`;
        index += 1;
      }
      await createFileboxSoukoFolder({ id, name });
      await loadFileboxData();
      setActiveFileboxFolderId(id);
      setNewFileboxFolderName('');
      setFileboxError('');
    } catch (err) {
      setFileboxError(String(err?.message || err || 'フォルダ作成に失敗しました'));
    } finally {
      setFileboxCreatingFolder(false);
    }
  }, [createFileboxSoukoFolder, fileboxFolders, loadFileboxData, newFileboxFolderName]);

  const onFileboxSelect = useCallback(async (e) => {
    const files = Array.from(e?.target?.files || []);
    if (!activeFileboxFolder || files.length === 0) return;
    setFileboxUploading(true);
    setFileboxError('');
    try {
      for (const file of files) {
        await uploadFileboxFile(activeFileboxFolder, file);
      }
      await loadFileboxData();
    } catch (err) {
      setFileboxError(String(err?.message || err || 'アップロードに失敗しました'));
    } finally {
      setFileboxUploading(false);
      if (fileboxInputRef.current) fileboxInputRef.current.value = '';
    }
  }, [activeFileboxFolder, loadFileboxData, uploadFileboxFile]);

  const onOpenFolderCard = useCallback((folderId) => {
    const folder = folderById[folderId];
    if (!folder) return;
    setActiveFileboxFolderId(folderId);
    setFileboxError('');
  }, [folderById]);

  const onRefreshFilebox = useCallback(async () => {
    await loadFileboxData();
  }, [loadFileboxData]);

  useEffect(() => {
    if (!activeFileboxFolderId) return;
    if (!folderById[activeFileboxFolderId]) {
      setActiveFileboxFolderId(null);
    }
  }, [activeFileboxFolderId, folderById]);

  useEffect(() => {
    if (!showAdminFilebox) return;
    loadFileboxData();
  }, [showAdminFilebox, loadFileboxData]);

  return (
    <div
      className={`job-entrance-page ${showTransition ? TRANSITION_CLASS_PAGE : ''}`}
      data-job={jobKey}
      data-entrance-mode={useSidebarNav ? adminEntranceMode : undefined}
      style={{ paddingBottom: useSidebarNav ? 24 : 110 }}
    >
      <div className={`job-entrance-viz ${useSidebarNav ? 'is-hidden' : ''}`}>
        {useSidebarNav ? null : <Visualizer mode={vizMode} />}
      </div>
      <div className={`job-entrance-ui ${showTransition ? TRANSITION_CLASS_UI : ''}`}>
        {useSidebarNav && (
          <>
            <button
              type="button"
              className={`job-entrance-sidebar-toggle ${sidebarOpen ? 'open' : ''}`}
              aria-label={t('メニュー')}
              onClick={() => setSidebarOpen((prev) => !prev)}
            >
              ☰
            </button>
            <button
              type="button"
              className={`job-entrance-sidebar-backdrop ${sidebarOpen ? 'open' : ''}`}
              aria-label={t('メニューを閉じる')}
              onClick={() => setSidebarOpen(false)}
            />
            <div className="job-entrance-common-chat-anchor">
              {!showAdminDashboard ? <CommonHeaderChat /> : null}
              {!showAdminDashboard ? <MisogiSupportOrb /> : null}
            </div>
            <button
              type="button"
              className={`job-entrance-updates-rail ${updatesSidebarOpen ? 'open' : ''}`}
              style={{ left: updatesRailLeft }}
              aria-label={t('本日の更新通知を開閉')}
              onClick={() => setUpdatesSidebarOpen((prev) => !prev)}
            >
              {updatesSidebarOpen ? '◂' : '▸'}
            </button>
            <button
              type="button"
              className={`job-entrance-updates-backdrop ${updatesSidebarOpen ? 'open' : ''}`}
              aria-label={t('通知を閉じる')}
              onClick={() => setUpdatesSidebarOpen(false)}
            />
            <aside
              className={`job-entrance-updates-sidebar ${updatesSidebarOpen ? 'open' : ''}`}
              style={{ left: updatesPanelLeft }}
              aria-label={t('本日の更新通知')}
            >
              <div className="job-entrance-updates-head">
                <strong>{t('本日の更新通知')}</strong>
                <button type="button" onClick={loadTodayUpdates} disabled={updatesLoading}>
                  {updatesLoading ? '...' : '更新'}
                </button>
              </div>
              <div className="job-entrance-updates-body">
                {updatesError ? <p className="job-entrance-updates-empty">{updatesError}</p> : null}
                {!updatesError && updatesLoading && todayUpdates.length === 0 ? (
                  <p className="job-entrance-updates-empty">読み込み中...</p>
                ) : null}
                {!updatesError && !updatesLoading && todayUpdates.length === 0 ? (
                  <p className="job-entrance-updates-empty">本日のシステム通知はありません。</p>
                ) : null}
                {todayUpdates.length > 0 ? (
                  <ul className="job-entrance-updates-list">
                    {todayUpdates.map((row) => (
                      <li key={row.id}>
                        <span className="what">{row.what}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </aside>
            <aside className={`job-entrance-sidebar ${sidebarOpen ? 'open' : ''}`} aria-label={t('管理メニュー')}>
              <div className="job-entrance-sidebar-head">{t('管理メニュー')}</div>
              <div className="job-entrance-sidebar-scroll">
                {sidebarSections.map((section) => (
                  <section key={section.id} className="job-entrance-sidebar-section">
                    {section.isDirect ? (
                      <button
                        type="button"
                        className={`job-entrance-sidebar-link ${isPathActive(section.directPath) ? 'active' : ''}`}
                        onClick={() => onSidebarNavigate(section.directPath)}
                        disabled={isTransitioning}
                      >
                        {t(section.label)}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          className={`job-entrance-sidebar-section-title ${openSidebarSectionId === section.id ? 'open' : ''}`}
                          onClick={() => setOpenSidebarSectionId((prev) => (prev === section.id ? null : section.id))}
                        >
                          <span>{t(section.label)}</span>
                          <span className="job-entrance-sidebar-section-icon">
                            {openSidebarSectionId === section.id ? '▾' : '▸'}
                          </span>
                        </button>
                        {openSidebarSectionId === section.id ? (
                          <div className="job-entrance-sidebar-links">
                            {section.items.map((item) => {
                              const path = item.path || item.to;
                              const active = isPathActive(path);
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  className={`job-entrance-sidebar-link ${active ? 'active' : ''}`}
                                  onClick={() => onSidebarNavigate(path)}
                                  disabled={isTransitioning}
                                >
                                  {t(item.label)}
                                </button>
                              );
                            })}
                            {showAdminDashboard && section.id === 'tools' ? (
                              <div className="job-entrance-sidebar-misogi">
                                <MisogiSupportOrb />
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </>
                    )}
                  </section>
                ))}
              </div>
              <div className="job-entrance-sidebar-footer">
                <button
                  type="button"
                  className={`job-entrance-sidebar-settings-toggle ${settingsOpen ? 'open' : ''}`}
                  onClick={() => setSettingsOpen((prev) => !prev)}
                >
                  <span>{t('設定')}</span>
                  <span className="job-entrance-sidebar-section-icon">{settingsOpen ? '▾' : '▸'}</span>
                </button>
                {settingsOpen ? (
                  <div className="job-entrance-sidebar-footer-content">
                    <LanguageSwitcher />
                    {useSidebarNav ? (
                      <div className="job-entrance-sidebar-theme-block">
                        <span className="job-entrance-sidebar-theme-label">{t('表示')}</span>
                        <span className="job-entrance-sidebar-theme-fixed">{t('ライトモード（固定）')}</span>
                      </div>
                    ) : (
                      <div className="job-entrance-sidebar-theme-block">
                        <span className="job-entrance-sidebar-theme-label">{t('ライトモード切り替え')}</span>
                        <ThemeToggle />
                      </div>
                    )}
                  </div>
                ) : null}
                <div className="job-entrance-sidebar-account">
                  <div className="job-entrance-sidebar-footer-title">{t('ログイン / ログアウト')}</div>
                  <button
                    type="button"
                    className="job-entrance-sidebar-auth-btn"
                    onClick={onSidebarAuth}
                    disabled={isTransitioning}
                  >
                    {isAuthenticated ? t('ログアウト') : t('ログイン')}
                  </button>
                </div>
              </div>
            </aside>
          </>
        )}

        <main className={`job-entrance-main ${useSidebarNav ? 'with-sidebar' : ''} ${showAdminWorkspace ? 'with-filebox' : ''}`.trim()}>
          {!showAdminWorkspace ? (
            <h1 className="job-entrance-title" style={{ color: job.color }}>{job.label}</h1>
          ) : null}

          {/* サブホットバー（選択中のアクションに subItems がある場合表示） */}
          {!useSidebarNav && Array.isArray(currentAction?.subItems) && currentAction.subItems.length > 0 && (
            <div className="sub-hotbar-wrap">
              {useSimpleCleaningSubHotbar ? (
                <div className="sub-hotbar sub-hotbar-simple">
                  <button
                    type="button"
                    className="sub-hotbar-back-btn"
                    aria-label={t('戻る')}
                    title={t('戻る')}
                    onClick={() => setTab(null)}
                    disabled={isTransitioning}
                  >
                    ←
                  </button>
                </div>
              ) : (
                <>
                  {subGroups?.keys?.length > 1 && (
                    <div className="sub-hotbar-groups" role="tablist" aria-label={t('カテゴリ')}>
                      {subGroups.keys.map((k) => {
                        const active = (activeSubGroupKey || subGroups.keys[0]) === k;
                        return (
                          <button
                            key={k}
                            type="button"
                            className={`sub-hotbar-group-btn ${active ? 'active' : ''}`}
                            onClick={() => setSubGroupByTab((prev) => ({ ...prev, [currentAction.id]: k }))}
                            disabled={isTransitioning}
                          >
                            {t(k)}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="sub-hotbar">
                    {(activeSubItems || []).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="sub-hotbar-btn"
                        onClick={() => {
                          const path = item.path || item.to;
                          if (path) {
                            startTransition(path);
                          }
                        }}
                        disabled={isTransitioning}
                      >
                        {t(item.label)}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {useSidebarNav ? (
            showAdminDashboard ? (
              <>
                <div
                  className={`admin-filebox-layout admin-dashboard-layout ${dashboardResizingPane === 'chat' ? 'is-resizing' : ''} ${!dashboardChatVisible ? 'hide-chat' : ''} ${!dashboardExplorerVisible ? 'hide-explorer' : ''}`.trim()}
                  ref={fileboxLayoutRef}
                  style={{ '--dash-chat-width': `${dashboardChatWidth}px` }}
                >
                  {dashboardExplorerVisible ? (
                    <section className="admin-dashboard-activity-panel" aria-label={t('現在のアクティビティ')}>
                      <div className="admin-dashboard-activity-head">
                        <div className="admin-filebox-toolbar-title">
                          <strong>{t('現在のアクティビティ')}</strong>
                          <span>{t('本日の更新通知を時系列で確認できます')}</span>
                        </div>
                        <button type="button" onClick={loadTodayUpdates} disabled={updatesLoading}>
                          {updatesLoading ? '...' : t('更新')}
                        </button>
                      </div>
                      {updatesError ? <p className="admin-filebox-error">{updatesError}</p> : null}
                      <div className="admin-dashboard-activity-body">
                        {todayUpdates.length === 0 ? (
                          <p className="admin-filebox-empty">{t('本日の更新はありません')}</p>
                        ) : (
                          <ul className="job-entrance-updates-list">
                            {todayUpdates.map((item) => (
                              <li key={item.id}>
                                <span className="time">{item.atLabel}</span>
                                <span className="who">{item.who}</span>
                                <span className="what">{item.what}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </section>
                  ) : null}
                  {dashboardExplorerVisible && dashboardChatVisible ? (
                    <div
                      className={`admin-filebox-resizer admin-filebox-resizer-chat ${dashboardResizingPane === 'chat' ? 'active' : ''}`}
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={t('右ペイン幅リサイズ')}
                      onPointerDown={(event) => beginDashboardResize('chat', event)}
                    />
                  ) : null}
                  {dashboardChatVisible ? (
                    <aside className="admin-filebox-chat-panel" aria-label={t('共通チャット')}>
                      <CommonHeaderChat
                        alwaysOpen
                        hideTrigger
                        docked
                        showCloseButton={false}
                        draggable={false}
                        ariaLabel={t('ダッシュボード共通チャット')}
                      />
                    </aside>
                  ) : (
                    <section className="admin-dashboard-activity-panel" aria-label={t('ダッシュボード')}>
                      <div className="admin-dashboard-activity-body">
                        <p className="admin-filebox-empty">{t('右ペインが非表示です。ヘッダーの「右ON」で表示できます。')}</p>
                      </div>
                    </section>
                  )}
                </div>
                <div className="admin-dashboard-body-footer" aria-hidden />
              </>
            ) : showAdminFilebox ? (
              <>
                <div
                  className={`admin-filebox-layout hide-chat ${dashboardResizingPane === 'explorer' ? 'is-resizing' : ''}`.trim()}
                  ref={fileboxLayoutRef}
                  style={{ '--dash-chat-width': `${dashboardChatWidth}px` }}
                >
                  <section className="admin-filebox-panel" aria-label={t('ファイルボックス')}>
                    <div className="admin-filebox-toolbar admin-filebox-toolbar-top">
                      <div className="admin-filebox-toolbar-title">
                        <strong>{dashboardTitleLabel || t('ファイルボックス')}</strong>
                        <span>{t('ファイルとドキュメントを保存・閲覧できます')}</span>
                      </div>
                    </div>
                    <div
                      className={`admin-filebox-shell ${dashboardResizingPane === 'explorer' ? 'is-resizing' : ''} ${!dashboardExplorerVisible ? 'hide-explorer' : ''}`.trim()}
                      ref={fileboxShellRef}
                      style={{ '--dash-explorer-width': `${dashboardExplorerWidth}px` }}
                    >
                      {dashboardExplorerVisible ? (
                        <aside className="admin-filebox-explorer" aria-label={t('フォルダ一覧')}>
                          <div className="admin-filebox-explorer-head">
                            <strong>{t('フォルダ')}</strong>
                            <button
                              type="button"
                              onClick={onRefreshFilebox}
                              disabled={fileboxBusy}
                            >
                              {(fileboxLoading || fileboxFoldersLoading) ? t('更新中...') : t('更新')}
                            </button>
                          </div>
                          {fileboxError ? <p className="admin-filebox-error">{fileboxError}</p> : null}
                          <div className="admin-filebox-create">
                            <input
                              type="text"
                              value={newFileboxFolderName}
                              onChange={(e) => setNewFileboxFolderName(e.target.value)}
                              placeholder={t('新規フォルダ名を入力')}
                              maxLength={40}
                              disabled={fileboxBusy}
                            />
                            <button
                              type="button"
                              onClick={onCreateFileboxFolder}
                              disabled={fileboxBusy}
                            >
                              {fileboxCreatingFolder ? t('作成中...') : t('フォルダ追加')}
                            </button>
                          </div>
                          <div className="admin-filebox-folder-list">
                            {fileboxFolders.map((folder) => (
                              <button
                                key={folder.id}
                                type="button"
                                className={`admin-filebox-folder-row ${activeFileboxFolder?.id === folder.id ? 'active' : ''}`}
                                onClick={() => onOpenFolderCard(folder.id)}
                              >
                                <span className="name">{folder.name}</span>
                                <span className="meta">{Number(fileboxStats?.[folder.id]?.count || 0)}件</span>
                              </button>
                            ))}
                          </div>
                        </aside>
                      ) : null}
                      {dashboardExplorerVisible ? (
                        <div
                          className={`admin-filebox-resizer admin-filebox-resizer-explorer ${dashboardResizingPane === 'explorer' ? 'active' : ''}`}
                          role="separator"
                          aria-orientation="vertical"
                          aria-label={t('左ペイン幅リサイズ')}
                          onPointerDown={(event) => beginDashboardResize('explorer', event)}
                        />
                      ) : null}
                      <section className="admin-filebox-workspace" aria-label={t('ファイルワークスペース')}>
                        <div className="admin-filebox-workspace-head">
                          <div className="admin-filebox-toolbar-title">
                            <strong>{activeFileboxFolder ? activeFileboxFolder.name : t('フォルダを選択')}</strong>
                            <span>
                              {activeFileboxFolder
                                ? (
                                  activeFileboxFolder.id === WORKFLOW_INBOX_FOLDER_ID
                                    ? t('受信した業務依頼をファイル単位で確認できます')
                                    : t('表示方式を選んでファイルを確認できます')
                                )
                                : t('左のフォルダ一覧から選ぶと、ここにファイルが表示されます')}
                            </span>
                          </div>
                          <div className="admin-filebox-toolbar-actions">
                            {activeFileboxFolder ? (
                              <button
                                type="button"
                                onClick={() => setActiveFileboxFolderId(null)}
                                disabled={fileboxBusy}
                              >
                                {t('戻る')}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={onFileboxUploadClick}
                              disabled={!activeFileboxFolder || fileboxBusy || activeFileboxFolder.id === WORKFLOW_INBOX_FOLDER_ID}
                            >
                              {activeFileboxFolder?.id === WORKFLOW_INBOX_FOLDER_ID
                                ? t('受信専用')
                                : (fileboxUploading ? t('アップロード中...') : t('アップロード'))}
                            </button>
                            <input
                              ref={fileboxInputRef}
                              type="file"
                              className="file-input"
                              onChange={onFileboxSelect}
                              multiple
                              hidden
                            />
                          </div>
                        </div>
                        {!activeFileboxFolder ? (
                          <div className="admin-filebox-welcome">
                            <div className="welcome-icon" aria-hidden>🗂️</div>
                            <div className="welcome-title">{t('フォルダを選択してファイルを表示')}</div>
                            <p className="welcome-desc">{t('業務依頼PDFや添付資料を、フォルダ単位で管理できます。')}</p>
                            <div className="welcome-stats">
                              <span>{t('フォルダ数')}: {fileboxFolders.length}</span>
                              <span>
                                {t('総ファイル数')}: {
                                  fileboxFolders.reduce((sum, folder) => sum + Number(fileboxStats?.[folder.id]?.count || 0), 0)
                                }
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="admin-filebox-focus">
                            <div className="admin-filebox-focus-card">
                              <div className="admin-filebox-card active">
                                <div className="icon" aria-hidden>📁</div>
                                <div className="name">{activeFileboxFolder.name}</div>
                                <div className="meta">{Number(fileboxStats?.[activeFileboxFolder.id]?.count || 0)}件</div>
                                <div className="at">
                                  {fileboxStats?.[activeFileboxFolder.id]?.latestAtMs
                                    ? ymdHmLabel(fileboxStats[activeFileboxFolder.id].latestAtMs)
                                    : t('ファイルなし')}
                                </div>
                              </div>
                            </div>
                            <div className="admin-filebox-view-switch" role="tablist" aria-label={t('表示方式')}>
                              {FILEBOX_VIEW_MODE_OPTIONS.map((mode) => (
                                <button
                                  key={mode.id}
                                  type="button"
                                  role="tab"
                                  aria-selected={fileboxViewMode === mode.id}
                                  className={fileboxViewMode === mode.id ? 'active' : ''}
                                  onClick={() => setFileboxViewMode(mode.id)}
                                  title={t(mode.label)}
                                >
                                  <span aria-hidden>{mode.icon}</span>
                                </button>
                              ))}
                            </div>
                            <section className={`admin-filebox-recents mode-${fileboxViewMode}`}>
                              <h3>{`${activeFileboxFolder.name}${t(' のファイル')}`}</h3>
                              {activeFolderItems.length === 0 ? (
                                <p className="admin-filebox-empty">{t('ファイルがありません')}</p>
                              ) : fileboxViewMode === 'list' ? (
                                <ul>
                                  {activeFolderItems.map((item) => {
                                    const kind = detectFileKind(item);
                                    return (
                                      <li key={item.id}>
                                        <div className="file-main">
                                          <span className={`file-preview kind-${kind}`} aria-hidden>
                                            <span className="file-preview-icon">{fileKindIcon(kind)}</span>
                                            {kind === 'image' ? (
                                              <img
                                                className="file-preview-image"
                                                src={item.url}
                                                alt=""
                                                loading="lazy"
                                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                              />
                                            ) : null}
                                          </span>
                                          <a
                                            className="file"
                                            href={item.url || '#'}
                                            target={item.url ? '_blank' : undefined}
                                            rel={item.url ? 'noopener noreferrer' : undefined}
                                            onClick={(e) => { if (!item.url) e.preventDefault(); }}
                                          >
                                            {item.name}
                                          </a>
                                        </div>
                                        <span className="folder">{item.uploader || t('未設定')}</span>
                                        <span className="at">{ymdHmLabel(item.atMs)}</span>
                                      </li>
                                    );
                                  })}
                                </ul>
                              ) : (
                                <div className={`admin-filebox-tiles ${fileboxViewMode === 'slider' ? 'slider' : ''}`}>
                                  {activeFolderItems.map((item) => {
                                    const kind = detectFileKind(item);
                                    return (
                                      <a
                                        key={item.id}
                                        className="admin-filebox-tile"
                                        href={item.url || '#'}
                                        target={item.url ? '_blank' : undefined}
                                        rel={item.url ? 'noopener noreferrer' : undefined}
                                        onClick={(e) => { if (!item.url) e.preventDefault(); }}
                                      >
                                        <span className={`file-preview kind-${kind}`} aria-hidden>
                                          <span className="file-preview-icon">{fileKindIcon(kind)}</span>
                                          {kind === 'image' ? (
                                            <img
                                              className="file-preview-image"
                                              src={item.url}
                                              alt=""
                                              loading="lazy"
                                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                            />
                                          ) : null}
                                        </span>
                                        <span className="tile-name">{item.name}</span>
                                        <span className="tile-at">{ymdHmLabel(item.atMs)}</span>
                                      </a>
                                    );
                                  })}
                                </div>
                              )}
                            </section>
                          </div>
                        )}
                      </section>
                    </div>
                  </section>
                </div>
                <div className="admin-dashboard-body-footer" aria-hidden />
              </>
            ) : (
              <p className="job-entrance-dummy">{t('左のサイドバーから機能を選択してください。')}</p>
            )
          ) : null}

          {!useSidebarNav && showLocalSettingsPanel ? (
            <section className="job-entrance-settings-panel" aria-label={t('設定')}>
              <div className="job-entrance-settings-row">
                <span className="job-entrance-settings-label">{t('言語')}</span>
                <LanguageSwitcher />
              </div>
              <div className="job-entrance-settings-row">
                <span className="job-entrance-settings-label">{t('表示')}</span>
                <ThemeToggle />
              </div>
            </section>
          ) : null}

          {showCleaningEntranceNotices ? (
            <section className="job-entrance-cleaning-notices" aria-label={t('未完了予定（直近5件）')}>
              {cleaningTodayNoticesLoading ? (
                <div className="job-entrance-cleaning-notice">{t('未完了予定を確認中...')}</div>
              ) : cleaningTodayNotices.length === 0 ? (
                <div className="job-entrance-cleaning-notice">{t('未完了の予定はありません')}</div>
              ) : (
                cleaningTodayNotices.map((item) => (
                  <div
                    key={item.id}
                    className={`job-entrance-cleaning-notice is-interactive ${cleaningNoticeRunningMap[item.id] ? 'is-running' : ''}`}
                    title={`${item.dateLabel} ${item.time} / ${item.yagou} / ${item.tenpo} / ${item.amountLabel}`}
                  >
                    {(() => {
                      const isRunning = !!cleaningNoticeRunningMap[item.id];
                      const gateClass = isRunning ? 'is-running' : 'is-waiting';
                      const slideOffset = Math.max(
                        -CLEANING_NOTICE_SWIPE_MAX,
                        Math.min(
                          CLEANING_NOTICE_SWIPE_MAX,
                          Number(cleaningNoticeSlideMap[item.id] ?? (isRunning ? CLEANING_NOTICE_SWIPE_MAX : -CLEANING_NOTICE_SWIPE_MAX))
                        )
                      );
                      const backStateClass = slideOffset > 0
                        ? 'show-left'
                        : (slideOffset < 0 ? 'show-right' : (isRunning ? 'show-left' : 'show-right'));
                      return (
                        <>
                          <div className="notice-swipe-bg" aria-hidden="true" />
                          <div className={`notice-swipe-back notice-swipe-back-left is-running ${backStateClass}`} aria-hidden="true">
                            実行中
                          </div>
                          <div className={`notice-swipe-back notice-swipe-back-right is-waiting ${backStateClass}`} aria-hidden="true">
                            待機中
                          </div>
                          <div
                            className={`notice-swipe-body ${gateClass}`}
                            style={{ transform: `translateX(${slideOffset}px)` }}
                            onPointerDown={(e) => beginCleaningNoticeSwipe(item, e)}
                            onPointerMove={(e) => moveCleaningNoticeSwipe(item, e)}
                            onPointerUp={(e) => { endCleaningNoticeSwipe(item, e, { openDetailOnTap: true }); }}
                            onPointerCancel={(e) => { endCleaningNoticeSwipe(item, e); }}
                          >
                            <span className="notice-day">{item.dateLabel}</span>
                            <span className="notice-time-stack">
                              <span className="notice-time-line">{item.startTimeLabel}</span>
                              <span className="notice-time-line">{item.endTimeLabel}</span>
                            </span>
                            <span className="notice-shop">
                              <span className="notice-yagou">{item.yagou}</span>
                              <span className="notice-tenpo">{item.tenpo}</span>
                            </span>
                            <span className="notice-amount">{item.amountLabel}</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ))
              )}
            </section>
          ) : null}

          {showCleaningEntranceNotices && cleaningStartConfirm ? (
            <div className="cleaning-start-confirm-overlay" role="dialog" aria-modal="true" aria-label="作業開始確認">
              <div className="cleaning-start-confirm-card">
                <div className="cleaning-start-confirm-head">MISOGI</div>
                <p className="cleaning-start-confirm-message">{`${cleaningLoginName}様。作業開始いたしますか？`}</p>
                <div className="cleaning-start-confirm-meta">
                  <span>{cleaningStartConfirm.notice?.dateLabel || '-'}</span>
                  <span>{`${cleaningStartConfirm.notice?.yagou || '-'} / ${cleaningStartConfirm.notice?.tenpo || '-'}`}</span>
                  <span>{cleaningStartConfirm.notice?.time || '-'}</span>
                </div>
                <div className="cleaning-start-confirm-actions">
                  <button
                    type="button"
                    className="cleaning-start-confirm-btn yes"
                    onClick={confirmCleaningStart}
                    disabled={cleaningStartConfirmSaving}
                  >
                    はい
                  </button>
                  <button
                    type="button"
                    className="cleaning-start-confirm-btn no"
                    onClick={closeCleaningStartConfirm}
                    disabled={cleaningStartConfirmSaving}
                  >
                    いいえ
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {!useSidebarNav && jobKey !== 'cleaning' ? (
            <p style={{ marginTop: 16 }}><Link to="/">{t('Portal へ戻る')}</Link></p>
          ) : null}
        </main>
      </div>
      {!useSidebarNav && actions && (
        <Hotbar actions={actions} active={tab} onChange={onHotbar} showFlowGuideButton={showFlowGuideButton} />
      )}
    </div>
  );
}
