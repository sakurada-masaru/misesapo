import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { normalizeGatewayBase } from '../../api/gatewayBase';
import { useAuth } from '../../auth/useAuth';

const DEFAULT_CHAT_ROOM = 'common_header';
const ROOM_STORAGE_KEY = 'misogi.chat.activeRoom';
const ROOM_PRESETS = [
  { key: 'common_header', label: '共通' },
  { key: 'kanri', label: '管理' },
  { key: 'sales', label: '営業' },
  { key: 'cleaning', label: '清掃' },
  { key: 'office', label: '事務' },
  { key: 'dev', label: '開発' },
];
const POLL_MS = 5000;
const MAX_ITEMS = 120;
const MAX_UPLOAD_SIZE = 15 * 1024 * 1024;
const MAX_MESSAGE_LEN = 280;
const MAX_MENTION_OPTIONS = 8;
const CHAT_OVERLAY_WIDTH = 440;
const CHAT_OVERLAY_RIGHT_GUTTER = 20;
const CHAT_OVERLAY_VISIBLE_WIDTH = 40;
const BASIC_EMOJIS = ['😀', '😊', '😂', '🙏', '👍', '👏', '✅', '⚠️', '❗', '📷', '📎', '📌', '💡', '🔥'];
const QUICK_TEMPLATES = [
  '承知しました。確認して折り返します。',
  '対応完了しました。ご確認をお願いします。',
  '現場到着しました。',
  '資料を添付します。',
];

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
  const token =
    localStorage.getItem('idToken')
    || localStorage.getItem('cognito_id_token')
    || localStorage.getItem('id_token')
    || localStorage.getItem('accessToken')
    || localStorage.getItem('cognito_access_token')
    || localStorage.getItem('token')
    || legacyAuth
    || '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function readStoredUserProfile() {
  try {
    const raw = localStorage.getItem('cognito_user');
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? obj : {};
  } catch {
    return {};
  }
}

function asItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function toDisplayDateTime(value) {
  const raw = String(value || '').trim();
  if (!raw) return '-';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${mi}`;
}

function toReadableBytes(bytes) {
  const n = Number(bytes || 0);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${Math.round((n / 1024) * 10) / 10}KB`;
  return `${Math.round((n / (1024 * 1024)) * 10) / 10}MB`;
}

function isImageContentType(contentType) {
  return String(contentType || '').toLowerCase().startsWith('image/');
}

function truncateByCodePoints(value, maxLen) {
  return Array.from(String(value || '')).slice(0, maxLen).join('');
}

function asRowAttachments(row) {
  if (Array.isArray(row?.attachments)) {
    return row.attachments.filter((a) => a && typeof a === 'object');
  }
  const attachmentUrl = String(row?.attachment_url || '').trim();
  if (!attachmentUrl) return [];
  return [{
    key: String(row?.attachment_key || ''),
    bucket: String(row?.attachment_bucket || ''),
    name: String(row?.attachment_name || '添付ファイル'),
    content_type: String(row?.attachment_content_type || ''),
    size: Number(row?.attachment_size || 0),
    url: attachmentUrl,
  }];
}

function buildIdentitySet(values) {
  const set = new Set();
  for (const v of values || []) {
    const s = String(v || '').trim();
    if (!s) continue;
    const lower = s.toLowerCase();
    set.add(lower);
    if (lower.includes('@')) set.add(lower.split('@')[0]);
  }
  return set;
}

function toEpochMs(value) {
  const t = Date.parse(String(value || '').trim());
  return Number.isNaN(t) ? 0 : t;
}

function clampRoomKey(value) {
  const k = String(value || '').trim();
  return ROOM_PRESETS.some((row) => row.key === k) ? k : DEFAULT_CHAT_ROOM;
}

function shortMessage(value, maxLen = 72) {
  const s = String(value || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  const chars = Array.from(s);
  return chars.length > maxLen ? `${chars.slice(0, maxLen).join('')}…` : s;
}

function extractMentionContext(text, caretPos) {
  const value = String(text || '');
  const caret = Math.max(0, Math.min(Number(caretPos || 0), value.length));
  const left = value.slice(0, caret);
  const at = left.lastIndexOf('@');
  if (at < 0) return null;
  const before = at > 0 ? left.slice(at - 1, at) : '';
  if (before && !/\s|\n|\r|\t|[([{"'`]/.test(before)) return null;
  const query = left.slice(at + 1);
  if (/[\s\n\r\t]/.test(query)) return null;
  return {
    start: at,
    end: caret,
    query: String(query || ''),
  };
}

export default function CommonHeaderChat({
  alwaysOpen = false,
  hideTrigger = false,
  docked = false,
  showCloseButton = true,
  draggable = true,
  ariaLabel = '共通チャット',
  triggerAriaLabel = '共通チャットを開く',
} = {}) {
  const { user, authz } = useAuth();
  const [desktopOnly, setDesktopOnly] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth > 900;
  });
  const [activeRoom, setActiveRoom] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_CHAT_ROOM;
    try {
      return clampRoomKey(localStorage.getItem(ROOM_STORAGE_KEY) || DEFAULT_CHAT_ROOM);
    } catch {
      return DEFAULT_CHAT_ROOM;
    }
  });
  const [open, setOpen] = useState(Boolean(alwaysOpen));
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [showDataEditor, setShowDataEditor] = useState(false);
  const [dataText, setDataText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastSeenAt, setLastSeenAt] = useState('');
  const listRef = useRef(null);
  const fileInputRef = useRef(null);
  const composeTextareaRef = useRef(null);
  const dragRef = useRef({ active: false, startX: 0, startY: 0, baseX: 0, baseY: 0 });
  const [caretPos, setCaretPos] = useState(0);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [boxPos, setBoxPos] = useState(() => {
    if (typeof window === 'undefined') return { x: 24, y: 72 };
    const w = window.innerWidth;
    return { x: Math.max(12, w - (CHAT_OVERLAY_WIDTH + CHAT_OVERLAY_RIGHT_GUTTER)), y: 76 };
  });

  const senderName = useMemo(() => {
    const stored = readStoredUserProfile();
    const email = String(user?.email || user?.attributes?.email || '').trim();
    const display = String(
      user?.name
      || user?.display_name
      || user?.full_name
      || user?.attributes?.name
      || user?.attributes?.preferred_username
      || user?.nickname
      || user?.username
      || stored?.name
      || stored?.display_name
      || stored?.full_name
      || stored?.attributes?.name
      || stored?.attributes?.preferred_username
      || stored?.username
      || user?.id
      || ''
    ).trim();
    if (display && !/^unknown$/i.test(display)) return display;
    if (email.includes('@')) return email.split('@')[0];
    return email || '名無し';
  }, [user]);

  const canClose = !alwaysOpen && showCloseButton;
  const canDrag = draggable && !docked;

  const senderId = useMemo(() => String(
    authz?.workerId
    || user?.id
    || user?.sub
    || user?.username
    || user?.email
    || ''
  ).trim(), [authz?.workerId, user]);

  const viewerKey = useMemo(() => {
    const base = String(
      senderId
      || user?.email
      || user?.username
      || senderName
      || 'anon'
    ).trim().toLowerCase();
    return base.replace(/\s+/g, '_') || 'anon';
  }, [senderId, senderName, user?.email, user?.username]);

  const seenStorageKey = useMemo(
    () => `misogi.chat.lastSeen.${activeRoom}.${viewerKey}`,
    [activeRoom, viewerKey]
  );

  const identitySet = useMemo(() => {
    const stored = readStoredUserProfile();
    return buildIdentitySet([
      senderId,
      senderName,
      user?.id,
      user?.sub,
      user?.username,
      user?.email,
      user?.attributes?.email,
      user?.attributes?.name,
      stored?.name,
      stored?.display_name,
      stored?.username,
      stored?.email,
      stored?.attributes?.email,
      authz?.workerId,
    ]);
  }, [authz?.workerId, senderId, senderName, user]);

  const isMyRow = useCallback((row) => {
    if (!row || identitySet.size === 0) return false;
    const rowIds = buildIdentitySet([
      row?.sender_id,
      row?.created_by,
      row?.updated_by,
      row?.sender_name,
      row?.sender_display_name,
      row?.created_by_name,
      row?.updated_by_name,
    ]);
    for (const id of rowIds) {
      if (identitySet.has(id)) return true;
    }
    return false;
  }, [identitySet]);

  const latestMessageAt = useMemo(() => {
    if (!Array.isArray(items) || items.length === 0) return '';
    return String(items[items.length - 1]?.created_at || '').trim();
  }, [items]);

  const visibleItems = useMemo(() => {
    const q = String(query || '').trim().toLowerCase();
    return (items || []).filter((row) => {
      const mine = isMyRow(row);
      const hasAttachment = asRowAttachments(row).length > 0;
      const hasData = !!(row?.data_payload && typeof row.data_payload === 'object');
      if (filterMode === 'mine' && !mine) return false;
      if (filterMode === 'files' && !hasAttachment) return false;
      if (filterMode === 'data' && !hasData) return false;
      if (!q) return true;
      const haystack = [
        row?.message,
        row?.sender_name,
        row?.sender_display_name,
        row?.reply_to_message,
        row?.reply_to_sender_name,
        ...asRowAttachments(row).map((a) => a?.name),
      ].map((v) => String(v || '').toLowerCase());
      return haystack.some((v) => v.includes(q));
    });
  }, [filterMode, isMyRow, items, query]);

  const activeRoomLabel = useMemo(() => {
    const found = ROOM_PRESETS.find((row) => row.key === activeRoom);
    return found?.label || '共通';
  }, [activeRoom]);

  const mentionCandidates = useMemo(() => {
    const seen = new Set();
    const names = [];
    (items || []).forEach((row) => {
      const n = String(
        row?.sender_name
        || row?.sender_display_name
        || row?.updated_by_name
        || row?.created_by_name
        || ''
      ).trim();
      if (!n) return;
      const key = n.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      names.push(n);
    });
    return names.sort((a, b) => a.localeCompare(b, 'ja'));
  }, [items]);

  const mentionContext = useMemo(
    () => extractMentionContext(text, caretPos),
    [text, caretPos]
  );

  const mentionOptions = useMemo(() => {
    if (!mentionContext) return [];
    const q = String(mentionContext.query || '').trim().toLowerCase();
    const base = q
      ? mentionCandidates.filter((n) => n.toLowerCase().includes(q))
      : mentionCandidates;
    return base.slice(0, MAX_MENTION_OPTIONS);
  }, [mentionCandidates, mentionContext]);

  const fetchChat = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const base = MASTER_API_BASE.replace(/\/$/, '');
      const url = `${base}/master/admin_chat?limit=500&jotai=yuko&room=${encodeURIComponent(activeRoom)}`;
      const res = await fetch(url, {
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`admin_chat HTTP ${res.status}${txt ? `: ${txt}` : ''}`);
      }
      const data = await res.json();
      const list = asItems(data)
        .slice()
        .sort((a, b) => String(a?.created_at || '').localeCompare(String(b?.created_at || '')))
        .slice(-MAX_ITEMS);
      setItems(list);
      setError('');
    } catch (e) {
      setError(String(e?.message || e || 'チャット取得エラー'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [activeRoom]);

  const uploadAttachment = useCallback(async (file) => {
    if (!file) return;
    if (file.size > MAX_UPLOAD_SIZE) {
      throw new Error('添付は15MB以下にしてください');
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
        room: activeRoom,
        file_name: file.name,
        content_type: contentType,
      }),
    });
    if (!presignRes.ok) {
      const txt = await presignRes.text();
      throw new Error(`添付準備失敗: HTTP ${presignRes.status}${txt ? ` ${txt}` : ''}`);
    }
    const presign = await presignRes.json();
    const putRes = await fetch(String(presign?.put_url || ''), {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: file,
    });
    if (!putRes.ok) {
      throw new Error(`添付アップロード失敗: HTTP ${putRes.status}`);
    }
    return {
      key: String(presign?.key || ''),
      bucket: String(presign?.bucket || ''),
      name: String(file.name || 'file'),
      content_type: contentType,
      size: Number(file.size || 0),
      url: String(presign?.get_url || ''),
    };
  }, [activeRoom]);

  const send = useCallback(async () => {
    const msg = String(text || '').trim();
    const hasAttachments = attachments.length > 0;
    const hasData = String(dataText || '').trim().length > 0;
    if ((!msg && !hasAttachments && !hasData) || sending || uploading) return;
    setSending(true);
    try {
      const base = MASTER_API_BASE.replace(/\/$/, '');
      let dataPayload = null;
      const rawDataText = String(dataText || '').trim();
      if (rawDataText) {
        try {
          dataPayload = JSON.parse(rawDataText);
        } catch {
          throw new Error('共有データ(JSON)の形式が不正です');
        }
      }
      const titleBase = msg || attachments[0]?.name || '添付';
      const body = {
        room: activeRoom,
        name: titleBase.length > 24 ? `${titleBase.slice(0, 24)}…` : titleBase,
        sender_name: senderName,
        sender_display_name: senderName,
        sender_id: senderId,
        message: msg,
        source: 'common_header_chat',
        jotai: 'yuko',
        has_attachment: hasAttachments,
      };
      if (replyTo?.chat_id) {
        body.reply_to_chat_id = String(replyTo.chat_id);
        body.reply_to_sender_name = String(replyTo.sender_name || replyTo.sender_display_name || '');
        body.reply_to_message = shortMessage(replyTo.message || '');
      }
      if (hasAttachments) {
        body.attachments = attachments;
        const firstAttachment = attachments[0];
        // Backward compatibility with older chat renderer.
        body.attachment_key = firstAttachment.key;
        body.attachment_bucket = firstAttachment.bucket;
        body.attachment_name = firstAttachment.name;
        body.attachment_content_type = firstAttachment.content_type;
        body.attachment_size = firstAttachment.size;
      }
      if (dataPayload) {
        body.data_payload = dataPayload;
      }
      const res = await fetch(`${base}/master/admin_chat`, {
        method: 'POST',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`送信失敗: HTTP ${res.status}${txt ? ` ${txt}` : ''}`);
      }
      setText('');
      setDataText('');
      setReplyTo(null);
      setAttachments([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchChat(true);
      setError('');
    } catch (e) {
      setError(String(e?.message || e || '送信エラー'));
    } finally {
      setSending(false);
    }
  }, [activeRoom, attachments, dataText, fetchChat, replyTo, senderId, senderName, sending, text, uploading]);

  const insertMention = useCallback((name) => {
    if (!mentionContext) return;
    const picked = String(name || '').trim();
    if (!picked) return;
    const current = String(text || '');
    const left = current.slice(0, mentionContext.start);
    const right = current.slice(mentionContext.end);
    const nextText = `${left}@${picked} ${right}`;
    const nextCaret = left.length + picked.length + 2;
    setText(truncateByCodePoints(nextText, MAX_MESSAGE_LEN));
    requestAnimationFrame(() => {
      const el = composeTextareaRef.current;
      if (!el) return;
      const pos = Math.min(nextCaret, String(nextText || '').length);
      try {
        el.focus();
        el.setSelectionRange(pos, pos);
        setCaretPos(pos);
      } catch {}
    });
  }, [mentionContext, text]);

  const onClickAttach = useCallback(() => {
    if (uploading || sending) return;
    fileInputRef.current?.click();
  }, [sending, uploading]);

  const onSelectFile = useCallback(async (e) => {
    const files = Array.from(e?.target?.files || []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(files.map((f) => uploadAttachment(f)));
      setAttachments((prev) => [...prev, ...uploaded].slice(0, 12));
      setError('');
    } catch (err) {
      setError(String(err?.message || err || '添付エラー'));
    } finally {
      setUploading(false);
    }
  }, [uploadAttachment]);

  const onInsertEmoji = useCallback((emoji) => {
    setText((prev) => truncateByCodePoints(`${prev || ''}${emoji || ''}`, MAX_MESSAGE_LEN));
  }, []);

  const removeOwnMessage = useCallback(async (row) => {
    const chatId = String(row?.chat_id || '').trim();
    if (!chatId || deletingId) return;
    setDeletingId(chatId);
    try {
      const base = MASTER_API_BASE.replace(/\/$/, '');
      const res = await fetch(`${base}/master/admin_chat/${encodeURIComponent(chatId)}`, {
        method: 'DELETE',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`削除失敗: HTTP ${res.status}${txt ? ` ${txt}` : ''}`);
      }
      await fetchChat(true);
      setError('');
    } catch (e) {
      setError(String(e?.message || e || '削除エラー'));
    } finally {
      setDeletingId('');
    }
  }, [deletingId, fetchChat]);

  const markAsRead = useCallback((explicitSeenAt = '') => {
    const seenAt = String(explicitSeenAt || latestMessageAt || new Date().toISOString()).trim();
    if (!seenAt) return;
    setLastSeenAt(seenAt);
    setUnreadCount(0);
    try {
      localStorage.setItem(seenStorageKey, seenAt);
    } catch {}
  }, [latestMessageAt, seenStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onResize = () => {
      const isDesktop = window.innerWidth > 900;
      setDesktopOnly(isDesktop);
      if (!isDesktop) {
        setOpen(false);
        return;
      }
      if (alwaysOpen) setOpen(true);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [alwaysOpen]);

  useEffect(() => {
    if (alwaysOpen) setOpen(true);
  }, [alwaysOpen]);

  useEffect(() => {
    try {
      localStorage.setItem(ROOM_STORAGE_KEY, activeRoom);
    } catch {}
    setQuery('');
    setFilterMode('all');
    setReplyTo(null);
    setAttachments([]);
    setShowEmojiPicker(false);
    setShowDataEditor(false);
  }, [activeRoom]);

  useEffect(() => {
    if (!desktopOnly) return undefined;
    fetchChat(true);
    const timer = setInterval(() => { fetchChat(true); }, POLL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [desktopOnly, fetchChat]);

  useEffect(() => {
    if (!open) return undefined;
    fetchChat(false);
    markAsRead();
    const onEsc = (e) => {
      if (e.key === 'Escape' && canClose) setOpen(false);
    };
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('keydown', onEsc);
    };
  }, [canClose, fetchChat, markAsRead, open]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(seenStorageKey) || '';
      setLastSeenAt(saved);
    } catch {
      setLastSeenAt('');
    }
  }, [seenStorageKey]);

  useEffect(() => {
    if (open) {
      setUnreadCount(0);
      return;
    }
    const seenTs = toEpochMs(lastSeenAt);
    const unread = (items || []).filter((row) => {
      if (isMyRow(row)) return false;
      return toEpochMs(row?.created_at) > seenTs;
    }).length;
    setUnreadCount(unread);
  }, [isMyRow, items, lastSeenAt, open]);

  useEffect(() => {
    if (!open || !latestMessageAt) return;
    markAsRead(latestMessageAt);
  }, [latestMessageAt, markAsRead, open]);

  useEffect(() => {
    setMentionIndex(0);
  }, [mentionContext?.start, mentionContext?.query, mentionOptions.length]);

  const onDragStart = useCallback((e) => {
    if (!desktopOnly || !canDrag) return;
    if (e.button !== 0) return;
    if (e.target && typeof e.target.closest === 'function') {
      const blocked = e.target.closest('button,textarea,input,select,a');
      if (blocked) return;
    }
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      baseX: boxPos.x,
      baseY: boxPos.y,
    };
    e.preventDefault();
  }, [boxPos.x, boxPos.y, canDrag, desktopOnly]);

  useEffect(() => {
    if (!open || !desktopOnly || !canDrag) return undefined;
    const onMove = (e) => {
      const d = dragRef.current;
      if (!d.active) return;
      const maxX = Math.max(0, window.innerWidth - (CHAT_OVERLAY_WIDTH - CHAT_OVERLAY_VISIBLE_WIDTH));
      const maxY = Math.max(0, window.innerHeight - 220);
      const nextX = Math.min(maxX, Math.max(0, d.baseX + (e.clientX - d.startX)));
      const nextY = Math.min(maxY, Math.max(0, d.baseY + (e.clientY - d.startY)));
      setBoxPos({ x: nextX, y: nextY });
    };
    const onUp = () => {
      dragRef.current.active = false;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [open, desktopOnly, canDrag]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [items.length, open]);

  if (!desktopOnly) return null;

  return (
    <>
      {!hideTrigger ? (
        <button
          type="button"
          className="breadcrumbs-chat-trigger"
          aria-label={triggerAriaLabel}
          onClick={() => {
            setOpen(true);
            markAsRead();
          }}
        >
          💬
          {unreadCount > 0 ? (
            <span className="breadcrumbs-chat-badge" aria-label={`${unreadCount}件の未読`}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </button>
      ) : null}
      <section
        className={`header-chat-overlay ${open ? 'open' : ''} ${docked ? 'docked' : ''}`.trim()}
        aria-label={ariaLabel}
        style={docked ? undefined : { left: `${boxPos.x}px`, top: `${boxPos.y}px` }}
      >
        <div className={`header-chat-head ${canDrag ? '' : 'no-drag'}`.trim()} onMouseDown={canDrag ? onDragStart : undefined}>
          <strong>共通チャット</strong>
          <span className="status">{activeRoomLabel} / 5秒更新</span>
          {canClose ? (
            <button type="button" className="close" onClick={() => setOpen(false)} aria-label="閉じる">×</button>
          ) : null}
        </div>
        <div className="header-chat-room-tabs" aria-label="チャットルーム">
          {ROOM_PRESETS.map((room) => (
            <button
              key={room.key}
              type="button"
              className={activeRoom === room.key ? 'active' : ''}
              onClick={() => setActiveRoom(room.key)}
            >
              {room.label}
            </button>
          ))}
        </div>
        <div className="header-chat-toolbar">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(String(e.target.value || '').slice(0, 80))}
            placeholder="メッセージ/投稿者/添付名で検索"
          />
          <div className="header-chat-filter-chips">
            {[
              { key: 'all', label: '全件' },
              { key: 'mine', label: '自分' },
              { key: 'files', label: '添付' },
              { key: 'data', label: 'データ' },
            ].map((f) => (
              <button
                key={f.key}
                type="button"
                className={filterMode === f.key ? 'active' : ''}
                onClick={() => setFilterMode(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
          <span className="result-count">{visibleItems.length}/{items.length}</span>
        </div>
        <div className="header-chat-log" ref={listRef}>
          {loading && visibleItems.length === 0 ? (
            <div className="header-chat-empty">読み込み中...</div>
          ) : visibleItems.length === 0 ? (
            <div className="header-chat-empty">まだ投稿がありません</div>
          ) : (
            visibleItems.map((row, idx) => {
              const mine = isMyRow(row);
              const rowChatId = String(row?.chat_id || '').trim();
              const senderDisplayName = String(
                row?.sender_name
                || row?.sender_display_name
                || row?.updated_by_name
                || row?.created_by_name
                || row?.sender_id
                || row?.updated_by
                || row?.created_by
                || '名無し'
              ).trim();
              const rowAttachments = asRowAttachments(row);
              const hasAttachment = rowAttachments.length > 0;
              const dataPayload = row?.data_payload && typeof row.data_payload === 'object' ? row.data_payload : null;
              const messageText = String(row?.message || '').trim();
              const replySummary = shortMessage(row?.reply_to_message || '');
              const replySender = String(row?.reply_to_sender_name || '').trim();
              return (
                <article key={String(row?.chat_id || row?.created_at || `idx-${idx}`)} className={`header-chat-item ${mine ? 'mine' : ''}`}>
                  <header>
                    <span className="who">{senderDisplayName}</span>
                    <div className="meta-right">
                      <span className="at">{toDisplayDateTime(row?.created_at)}</span>
                      {messageText ? (
                        <button
                          type="button"
                          className="msg-reply"
                          onClick={() => setReplyTo(row)}
                        >
                          返信
                        </button>
                      ) : null}
                      {messageText ? (
                        <button
                          type="button"
                          className="msg-copy"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(messageText);
                            } catch {}
                          }}
                        >
                          コピー
                        </button>
                      ) : null}
                      {mine && rowChatId ? (
                        <button
                          type="button"
                          className="msg-cancel"
                          onClick={() => removeOwnMessage(row)}
                          disabled={deletingId === rowChatId}
                        >
                          {deletingId === rowChatId ? '削除中...' : '削除'}
                        </button>
                      ) : null}
                    </div>
                  </header>
                  {replySummary ? (
                    <div className="reply-ref">
                      <span>{replySender || '返信先'}:</span> {replySummary}
                    </div>
                  ) : null}
                  {messageText ? (
                    <p>{String(row?.message || '')}</p>
                  ) : null}
                  {hasAttachment ? (
                    <div className="attachment">
                      {rowAttachments.map((att, idx) => {
                        const attUrl = String(att?.url || '').trim();
                        const attName = String(att?.name || '添付ファイル');
                        const attType = String(att?.content_type || '');
                        const attSize = toReadableBytes(att?.size);
                        if (!attUrl) return null;
                        return (
                          <div key={`${attName}-${idx}`} className="attachment-row">
                            {isImageContentType(attType) ? (
                              <a className="attachment-thumb" href={attUrl} target="_blank" rel="noreferrer">
                                <img src={attUrl} alt={attName} loading="lazy" />
                              </a>
                            ) : null}
                            <div className="attachment-info">
                              <a className="attachment-link" href={attUrl} target="_blank" rel="noreferrer">
                                {attName}
                              </a>
                              {attSize ? <span className="attachment-meta">{attSize}</span> : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                  {dataPayload ? (
                    <div className="data-payload">
                      <div className="data-payload-head">
                        <span>共有データ(JSON)</span>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(JSON.stringify(dataPayload, null, 2));
                            } catch {}
                          }}
                        >
                          コピー
                        </button>
                      </div>
                      <pre>{JSON.stringify(dataPayload, null, 2)}</pre>
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
        <div className="header-chat-compose">
          {replyTo ? (
            <div className="reply-box">
              <div className="reply-box-title">返信先: {String(replyTo?.sender_name || replyTo?.sender_display_name || '不明')}</div>
              <div className="reply-box-body">{shortMessage(replyTo?.message || '') || '(本文なし)'}</div>
              <button type="button" onClick={() => setReplyTo(null)}>返信解除</button>
            </div>
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            className="file-input"
            multiple
            onChange={onSelectFile}
          />
          <textarea
            ref={composeTextareaRef}
            value={text}
            onChange={(e) => {
              setText(truncateByCodePoints(e.target.value, MAX_MESSAGE_LEN));
              setCaretPos(e.currentTarget.selectionStart || 0);
            }}
            onClick={(e) => setCaretPos(e.currentTarget.selectionStart || 0)}
            onKeyUp={(e) => setCaretPos(e.currentTarget.selectionStart || 0)}
            onSelect={(e) => setCaretPos(e.currentTarget.selectionStart || 0)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                send();
                return;
              }
              if (mentionOptions.length > 0) {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setMentionIndex((prev) => Math.min(prev + 1, mentionOptions.length - 1));
                  return;
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setMentionIndex((prev) => Math.max(prev - 1, 0));
                  return;
                }
                if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
                  e.preventDefault();
                  insertMention(mentionOptions[mentionIndex] || mentionOptions[0]);
                }
              }
            }}
            placeholder={`メッセージ（最大${MAX_MESSAGE_LEN}文字）`}
          />
          {mentionOptions.length > 0 ? (
            <div className="mention-picker" aria-label="@メンション候補">
              {mentionOptions.map((name, idx) => (
                <button
                  key={`${name}-${idx}`}
                  type="button"
                  className={idx === mentionIndex ? 'active' : ''}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertMention(name)}
                >
                  @{name}
                </button>
              ))}
            </div>
          ) : null}
          <div className="compose-template-row">
            <select
              value=""
              onChange={(e) => {
                const picked = String(e.target.value || '');
                if (!picked) return;
                setText((prev) => truncateByCodePoints(`${prev ? `${prev}\n` : ''}${picked}`, MAX_MESSAGE_LEN));
              }}
            >
              <option value="">定型文を挿入</option>
              {QUICK_TEMPLATES.map((tpl) => (
                <option key={tpl} value={tpl}>{tpl}</option>
              ))}
            </select>
          </div>
          {showEmojiPicker ? (
            <div className="emoji-picker" aria-label="絵文字選択">
              {BASIC_EMOJIS.map((emoji) => (
                <button key={emoji} type="button" onClick={() => onInsertEmoji(emoji)} aria-label={`絵文字 ${emoji}`}>
                  {emoji}
                </button>
              ))}
            </div>
          ) : null}
          {attachments.length > 0 ? (
            <div className="attachment-picked-list">
              {attachments.map((att, idx) => (
                <div key={`${att.key || att.name}-${idx}`} className="attachment-picked">
                  <span>{att.name}{att.size ? ` (${toReadableBytes(att.size)})` : ''}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setAttachments((prev) => prev.filter((_, i) => i !== idx));
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          {showDataEditor ? (
            <textarea
              className="data-input"
              value={dataText}
              onChange={(e) => setDataText(String(e.target.value || '').slice(0, 4000))}
              placeholder={'共有データ(JSON 任意)\n例: {"tenpo_id":"TENPO#0001","amount":12000}'}
            />
          ) : null}
          <div className="compose-row">
            <span className="count">{Array.from(text || '').length}/{MAX_MESSAGE_LEN}</span>
            <div className="compose-actions">
              <button type="button" onClick={onClickAttach} disabled={uploading || sending}>
                {uploading ? '添付中...' : '添付'}
              </button>
              <button
                type="button"
                onClick={() => setShowEmojiPicker((v) => !v)}
                disabled={sending || uploading}
              >
                {showEmojiPicker ? '絵文字閉じる' : '絵文字'}
              </button>
              <button
                type="button"
                onClick={() => setShowDataEditor((v) => !v)}
                disabled={sending || uploading}
              >
                {showDataEditor ? 'データ閉じる' : 'データ'}
              </button>
              <button
                type="button"
                disabled={sending || uploading || (!String(text || '').trim() && attachments.length === 0 && !String(dataText || '').trim())}
                onClick={send}
                title="Ctrl+Enter で送信"
              >
                {sending ? '送信中...' : '送信'}
              </button>
            </div>
          </div>
          {error ? <div className="error">{error}</div> : null}
        </div>
      </section>
    </>
  );
}
