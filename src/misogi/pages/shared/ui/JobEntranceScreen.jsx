import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Visualizer from './Visualizer/Visualizer';
import Hotbar from './Hotbar/Hotbar';
import { useReportStyleTransition, TRANSITION_CLASS_PAGE, TRANSITION_CLASS_UI } from './ReportTransition/reportTransition.jsx';
import { JOBS } from '../utils/constants';
import { useI18n } from '../i18n/I18nProvider';
import { normalizeGatewayBase } from '../api/gatewayBase';
import ThemeToggle from './ThemeToggle/ThemeToggle';
import EntranceModeToggle from './EntranceModeToggle/EntranceModeToggle';
import LanguageSwitcher from './LanguageSwitcher/LanguageSwitcher';
import CommonHeaderChat from './Breadcrumbs/CommonHeaderChat';
import MisogiSupportOrb from './MisogiSupport/MisogiSupportOrb';
import { useAuth } from '../auth/useAuth';
import { getAdminWorkReports } from '../api/adminWorkReportsApi';

const JOB_KEYS = ['sales', 'cleaning', 'office', 'dev', 'admin'];
const ADMIN_ENTRANCE_MODE_STORAGE_KEY = 'misogi-v2-admin-entrance-mode';
const ADMIN_ENTRANCE_MODE_DEFAULT = 'default';
const ADMIN_ENTRANCE_MODE_SEPIA = 'sepia';
const ADMIN_ENTRANCE_MODE_LEGACY_NIER = 'nier';
const ADMIN_UPDATES_POLL_MS = 30000;
const FILEBOX_MAX_UPLOAD_SIZE = 15 * 1024 * 1024;
const ADMIN_FILEBOX_FOLDERS = [
  { id: 'contracts', name: '契約書', room: 'filebox_contracts' },
  { id: 'manuals', name: '業務マニュアル', room: 'filebox_manuals' },
  { id: 'reports', name: '提出書類', room: 'filebox_reports' },
  { id: 'common', name: '共通ドキュメント', room: 'filebox_common' },
];
const FILEBOX_VIEW_MODE_OPTIONS = [
  { id: 'icon', label: 'アイコン表示', icon: '◼' },
  { id: 'list', label: 'リスト表示', icon: '☰' },
  { id: 'slider', label: 'スライダー表示', icon: '↔' },
];
const FILEBOX_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif', 'heic', 'heif']);
const FILEBOX_VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv', 'm4v']);
const FILEBOX_AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'aac', 'm4a', 'ogg', 'flac']);

function isLocalUiHost() {
  if (typeof window === 'undefined') return false;
  const h = String(window.location?.hostname || '').toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
}

const MASTER_API_BASE = (import.meta.env?.DEV || isLocalUiHost())
  ? '/api-master'
  : normalizeGatewayBase(import.meta.env?.VITE_MASTER_API_BASE, 'https://jtn6in2iuj.execute-api.ap-northeast-1.amazonaws.com/prod');

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

function reportWho(item) {
  return String(
    item?.updated_by_name
    || item?.updated_by
    || item?.submitted_by_name
    || item?.submitted_by
    || item?.user_name
    || item?.worker_name
    || item?.reporter_name
    || item?.created_by_name
    || item?.created_by
    || ''
  ).trim() || '未設定';
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

function resolveInitialAdminEntranceMode() {
  if (typeof window === 'undefined') return ADMIN_ENTRANCE_MODE_DEFAULT;
  try {
    const stored = localStorage.getItem(ADMIN_ENTRANCE_MODE_STORAGE_KEY);
    if (stored === ADMIN_ENTRANCE_MODE_SEPIA) return ADMIN_ENTRANCE_MODE_SEPIA;
    if (stored === ADMIN_ENTRANCE_MODE_LEGACY_NIER) return ADMIN_ENTRANCE_MODE_SEPIA;
    if (stored === ADMIN_ENTRANCE_MODE_DEFAULT) return ADMIN_ENTRANCE_MODE_DEFAULT;
  } catch {
    // ignore
  }
  return ADMIN_ENTRANCE_MODE_DEFAULT;
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

function extractChatAttachments(row) {
  const arr = Array.isArray(row?.attachments) ? row.attachments : [];
  const normalized = arr
    .map((att, idx) => {
      const name = String(att?.name || att?.file_name || `file_${idx + 1}`).trim();
      const url = String(att?.url || att?.get_url || att?.preview_url || '').trim();
      const key = String(att?.key || '').trim();
      if (!name || (!url && !key)) return null;
      return {
        name,
        key,
        url,
        size: Number(att?.size || 0),
        contentType: String(att?.content_type || att?.mime || '').trim(),
      };
    })
    .filter(Boolean);

  if (normalized.length > 0) return normalized;

  const legacyName = String(row?.attachment_name || '').trim();
  const legacyUrl = String(row?.attachment_url || row?.attachment_get_url || '').trim();
  const legacyKey = String(row?.attachment_key || '').trim();
  if (!legacyName && !legacyUrl && !legacyKey) return [];

  return [{
    name: legacyName || 'attachment',
    key: legacyKey,
    url: legacyUrl,
    size: Number(row?.attachment_size || 0),
    contentType: String(row?.attachment_content_type || '').trim(),
  }];
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

export default function JobEntranceScreen({ job: jobKey, hotbarConfig, showFlowGuideButton = true }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const { user, isAuthenticated, logout } = useAuth();
  const { isTransitioning, startTransition } = useReportStyleTransition(navigate);
  const job = jobKey && JOBS[jobKey];
  const valid = job && JOB_KEYS.includes(jobKey);
  const actions = Array.isArray(hotbarConfig) && hotbarConfig.length > 0 ? hotbarConfig : null;
  const [tab, setTab] = useState(actions?.[0]?.id ?? null);
  const [subGroupByTab, setSubGroupByTab] = useState({});
  const useSidebarNav = jobKey === 'admin';
  const [adminEntranceMode, setAdminEntranceMode] = useState(() =>
    useSidebarNav ? resolveInitialAdminEntranceMode() : ADMIN_ENTRANCE_MODE_DEFAULT
  );
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
  const [activeFileboxFolderId, setActiveFileboxFolderId] = useState(null);
  const [fileboxViewMode, setFileboxViewMode] = useState('list');
  const [fileboxMap, setFileboxMap] = useState({});
  const [fileboxLoading, setFileboxLoading] = useState(false);
  const [fileboxUploading, setFileboxUploading] = useState(false);
  const [fileboxError, setFileboxError] = useState('');
  const fileboxInputRef = useRef(null);

  const onHotbar = (id) => {
    const action = actions?.find((a) => a.id === id);
    setTab(id);

    if (action?.to) {
      if (action.to.startsWith('http')) {
        // External link
        window.location.href = action.to;
      } else {
        // Internal link
        navigate(action.to);
      }
    }
  };

  if (!valid) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p>{t('ジョブが見つかりません。')}</p>
        <Link to="/">{t('Portal へ戻る')}</Link>
      </div>
    );
  }

  const currentAction = actions?.find((a) => a.id === tab);
  const tabLabel = t(currentAction?.label ?? tab ?? '');
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
        return {
          id: section.id,
          label: section.label,
          items: subItems,
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
      const [kanriResult, reportsResult] = await Promise.allSettled([
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
      ]);

      const kanriRows = kanriResult.status === 'fulfilled' ? asItems(kanriResult.value) : [];
      const reportRows = reportsResult.status === 'fulfilled' ? asItems(reportsResult.value) : [];

      const logEvents = kanriRows
        .map((row) => {
          const whenMs = toEpochMs(row?.updated_at || row?.created_at || row?.reported_at || row?.date);
          const who = String(row?.updated_by || row?.reported_by || row?.created_by || row?.user_name || '').trim() || '未設定';
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

      const list = [...reportEvents, ...logEvents]
        .sort((a, b) => b.atMs - a.atMs)
        .slice(0, 80);

      setTodayUpdates(list);
      if (kanriResult.status === 'rejected' && reportsResult.status === 'rejected') {
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
      return sidebarSections[0].id;
    });
  }, [sidebarSections, useSidebarNav]);

  useEffect(() => {
    if (!useSidebarNav || !sidebarSections.length) return;
    const activeSection = sidebarSections.find((section) =>
      section.items.some((item) => isPathActive(item.path || item.to))
    );
    if (!activeSection) return;
    setOpenSidebarSectionId(activeSection.id);
  }, [location.pathname, sidebarSections, useSidebarNav]);

  useEffect(() => {
    if (!useSidebarNav) return;
    if (adminEntranceMode !== ADMIN_ENTRANCE_MODE_SEPIA && adminEntranceMode !== ADMIN_ENTRANCE_MODE_DEFAULT) {
      setAdminEntranceMode(ADMIN_ENTRANCE_MODE_DEFAULT);
      return;
    }
    try {
      localStorage.setItem(ADMIN_ENTRANCE_MODE_STORAGE_KEY, adminEntranceMode);
    } catch {
      // ignore
    }
  }, [adminEntranceMode, useSidebarNav]);

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
  const showAdminFilebox = useSidebarNav && location.pathname === '/admin/filebox';
  const folderById = useMemo(
    () => Object.fromEntries(ADMIN_FILEBOX_FOLDERS.map((row) => [row.id, row])),
    []
  );
  const activeFileboxFolder = activeFileboxFolderId ? (folderById[activeFileboxFolderId] || null) : null;
  const activeFolderItems = useMemo(() => {
    if (!activeFileboxFolder?.id) return [];
    const list = Array.isArray(fileboxMap[activeFileboxFolder.id]) ? fileboxMap[activeFileboxFolder.id] : [];
    return list.slice().sort((a, b) => b.atMs - a.atMs);
  }, [activeFileboxFolder?.id, fileboxMap]);
  const fileboxStats = useMemo(() => {
    const stats = {};
    ADMIN_FILEBOX_FOLDERS.forEach((folder) => {
      const list = Array.isArray(fileboxMap[folder.id]) ? fileboxMap[folder.id] : [];
      const latest = list.slice().sort((a, b) => b.atMs - a.atMs)[0];
      stats[folder.id] = {
        count: list.length,
        latestAtMs: latest?.atMs || 0,
      };
    });
    return stats;
  }, [fileboxMap]);

  const loadFilebox = useCallback(async () => {
    if (!useSidebarNav) return;
    setFileboxLoading(true);
    setFileboxError('');
    try {
      const base = MASTER_API_BASE.replace(/\/$/, '');
      const results = await Promise.all(
        ADMIN_FILEBOX_FOLDERS.map(async (folder) => {
          const url = `${base}/master/admin_chat?limit=500&jotai=yuko&room=${encodeURIComponent(folder.room)}`;
          const res = await fetch(url, {
            headers: {
              ...authHeaders(),
              'Content-Type': 'application/json',
            },
            cache: 'no-store',
          });
          if (!res.ok) {
            const txt = await res.text();
            throw new Error(`${folder.name}: HTTP ${res.status}${txt ? ` ${txt}` : ''}`);
          }
          const data = await res.json();
          const rows = asItems(data);
          const files = rows.flatMap((row, rowIndex) => {
            const atMs = toEpochMs(row?.created_at || row?.updated_at);
            const uploader = String(
              row?.sender_display_name
              || row?.sender_name
              || row?.created_by
              || row?.updated_by
              || '未設定'
            ).trim();
            return extractChatAttachments(row)
              .map((att, index) => {
                const url = String(att.url || '').trim();
                if (!url) return null;
                return {
                  id: `${folder.id}-${row?.chat_id || rowIndex}-${att.key || att.name}-${index}`,
                  folderId: folder.id,
                  folderName: folder.name,
                  name: att.name,
                  url,
                  key: att.key,
                  size: att.size,
                  contentType: att.contentType,
                  uploader,
                  atMs,
                };
              })
              .filter(Boolean);
          });
          return [folder.id, files];
        })
      );
      setFileboxMap(Object.fromEntries(results));
    } catch (e) {
      setFileboxError(String(e?.message || e || 'ファイル一覧の取得に失敗しました'));
    } finally {
      setFileboxLoading(false);
    }
  }, [useSidebarNav]);

  const uploadFileboxFile = useCallback(async (folder, file) => {
    if (!folder || !file) return;
    if (file.size > FILEBOX_MAX_UPLOAD_SIZE) {
      throw new Error(`「${file.name}」は15MB以下にしてください`);
    }
    const base = MASTER_API_BASE.replace(/\/$/, '');
    const contentType = String(file.type || 'application/octet-stream');
    const presignRes = await fetch(`${base}/master/admin_chat`, {
      method: 'POST',
      headers: {
        ...authHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'presign_upload',
        room: folder.room,
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

    const sender = String(
      user?.name
      || user?.display_name
      || user?.attributes?.name
      || user?.email
      || readLocalUserName()
      || '管理者'
    ).trim();
    const attachment = {
      key: String(presign?.key || ''),
      bucket: String(presign?.bucket || ''),
      name: String(file.name || 'file'),
      content_type: contentType,
      size: Number(file.size || 0),
      url: String(presign?.get_url || ''),
    };
    const createRes = await fetch(`${base}/master/admin_chat`, {
      method: 'POST',
      headers: {
        ...authHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        room: folder.room,
        name: String(file.name || 'file').slice(0, 48),
        sender_name: sender,
        sender_display_name: sender,
        sender_id: String(user?.id || user?.worker_id || user?.sagyouin_id || 'admin'),
        source: 'admin_filebox',
        jotai: 'yuko',
        message: `${folder.name} にファイルをアップロード`,
        has_attachment: true,
        attachments: [attachment],
        attachment_key: attachment.key,
        attachment_bucket: attachment.bucket,
        attachment_name: attachment.name,
        attachment_content_type: attachment.content_type,
        attachment_size: attachment.size,
      }),
    });
    if (!createRes.ok) {
      const txt = await createRes.text();
      throw new Error(`アップロード記録失敗: HTTP ${createRes.status}${txt ? ` ${txt}` : ''}`);
    }
  }, [user]);

  const onFileboxUploadClick = useCallback(() => {
    if (fileboxUploading) return;
    if (!activeFileboxFolder) {
      setFileboxError('先にフォルダカードを選択してください');
      return;
    }
    fileboxInputRef.current?.click();
  }, [activeFileboxFolder, fileboxUploading]);

  const onFileboxSelect = useCallback(async (e) => {
    const files = Array.from(e?.target?.files || []);
    if (!activeFileboxFolder || files.length === 0) return;
    setFileboxUploading(true);
    setFileboxError('');
    try {
      for (const file of files) {
        await uploadFileboxFile(activeFileboxFolder, file);
      }
      await loadFilebox();
    } catch (err) {
      setFileboxError(String(err?.message || err || 'アップロードに失敗しました'));
    } finally {
      setFileboxUploading(false);
      if (fileboxInputRef.current) fileboxInputRef.current.value = '';
    }
  }, [activeFileboxFolder, loadFilebox, uploadFileboxFile]);

  const onOpenFolderCard = useCallback((folderId) => {
    const folder = folderById[folderId];
    if (!folder) return;
    setActiveFileboxFolderId(folderId);
    setFileboxError('');
  }, [folderById]);

  useEffect(() => {
    if (!showAdminFilebox) return;
    loadFilebox();
  }, [showAdminFilebox, loadFilebox]);

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
              <CommonHeaderChat />
              <MisogiSupportOrb />
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
                      </div>
                    ) : null}
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
                    {useSidebarNav && (
                      <EntranceModeToggle
                        mode={adminEntranceMode}
                        onChange={setAdminEntranceMode}
                      />
                    )}
                    <LanguageSwitcher />
                    <div className="job-entrance-sidebar-theme-block">
                      <span className="job-entrance-sidebar-theme-label">{t('ライトモード切り替え')}</span>
                      <ThemeToggle />
                    </div>
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

        <main className={`job-entrance-main ${useSidebarNav ? 'with-sidebar' : ''} ${showAdminFilebox ? 'with-filebox' : ''}`.trim()}>
          {!showAdminFilebox ? (
            <h1 className="job-entrance-title" style={{ color: job.color }}>{job.label}</h1>
          ) : null}

          {/* サブホットバー（選択中のアクションに subItems がある場合表示） */}
          {!useSidebarNav && Array.isArray(currentAction?.subItems) && currentAction.subItems.length > 0 && (
            <div className="sub-hotbar-wrap">
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
            </div>
          )}

          {useSidebarNav ? (
            showAdminFilebox ? (
              <section className="admin-filebox-panel" aria-label={t('ファイルボックス')}>
                <div className="admin-filebox-toolbar">
                  <div className="admin-filebox-toolbar-title">
                    <strong>{t('ファイルボックス')}</strong>
                    <span>
                      {activeFileboxFolder
                        ? t('表示方式を選んでファイルを確認できます')
                        : t('カードを選択すると関連ファイルを表示します')}
                    </span>
                  </div>
                  <div className="admin-filebox-toolbar-actions">
                    {activeFileboxFolder ? (
                      <button type="button" onClick={() => setActiveFileboxFolderId(null)} disabled={fileboxLoading || fileboxUploading}>
                        {t('戻る')}
                      </button>
                    ) : null}
                    <button type="button" onClick={loadFilebox} disabled={fileboxLoading || fileboxUploading}>
                      {fileboxLoading ? t('更新中...') : t('更新')}
                    </button>
                    <button
                      type="button"
                      onClick={onFileboxUploadClick}
                      disabled={!activeFileboxFolder || fileboxLoading || fileboxUploading}
                    >
                      {fileboxUploading ? t('アップロード中...') : t('アップロード')}
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
                {fileboxError ? <p className="admin-filebox-error">{fileboxError}</p> : null}
                {!activeFileboxFolder ? (
                  <div className="admin-filebox-grid">
                    {ADMIN_FILEBOX_FOLDERS.map((folder) => (
                      <button
                        key={folder.id}
                        type="button"
                        className="admin-filebox-card"
                        onClick={() => onOpenFolderCard(folder.id)}
                      >
                        <div className="icon" aria-hidden>📁</div>
                        <div className="name">{folder.name}</div>
                        <div className="meta">{Number(fileboxStats?.[folder.id]?.count || 0)}件</div>
                        <div className="at">
                          {fileboxStats?.[folder.id]?.latestAtMs
                            ? ymdHmLabel(fileboxStats[folder.id].latestAtMs)
                            : t('ファイルなし')}
                        </div>
                      </button>
                    ))}
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
                                  <a className="file" href={item.url} target="_blank" rel="noopener noreferrer">
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
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
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
            ) : (
              <p className="job-entrance-dummy">{t('左のサイドバーから機能を選択してください。')}</p>
            )
          ) : null}

          {!useSidebarNav && !currentAction?.subItems ? (
            <p className="job-entrance-dummy">{actions ? `${t('タブ:')} ${tabLabel}` : t('（ダミー画面）')}</p>
          ) : null}
          <p style={{ marginTop: 16 }}><Link to="/">{t('Portal へ戻る')}</Link></p>
        </main>
      </div>
      {!useSidebarNav && actions && (
        <Hotbar actions={actions} active={tab} onChange={onHotbar} showFlowGuideButton={showFlowGuideButton} />
      )}
    </div>
  );
}
