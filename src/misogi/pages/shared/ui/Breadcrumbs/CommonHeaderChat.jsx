import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { normalizeGatewayBase } from '../../api/gatewayBase';
import { useAuth } from '../../auth/useAuth';

const CHAT_ROOM = 'common_header';
const POLL_MS = 5000;
const MAX_ITEMS = 120;
const MAX_UPLOAD_SIZE = 15 * 1024 * 1024;
const MAX_MESSAGE_LEN = 280;
const BASIC_EMOJIS = ['😀', '😊', '😂', '🙏', '👍', '👏', '✅', '⚠️', '❗', '📷', '📎', '📌', '💡', '🔥'];

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

export default function CommonHeaderChat() {
  const { user, authz } = useAuth();
  const [desktopOnly, setDesktopOnly] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth > 900;
  });
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [showDataEditor, setShowDataEditor] = useState(false);
  const [dataText, setDataText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const listRef = useRef(null);
  const fileInputRef = useRef(null);
  const dragRef = useRef({ active: false, startX: 0, startY: 0, baseX: 0, baseY: 0 });
  const [boxPos, setBoxPos] = useState(() => {
    if (typeof window === 'undefined') return { x: 24, y: 72 };
    const w = window.innerWidth;
    return { x: Math.max(12, w - 380), y: 76 };
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

  const senderId = useMemo(() => String(
    authz?.workerId
    || user?.id
    || user?.sub
    || user?.username
    || user?.email
    || ''
  ).trim(), [authz?.workerId, user]);

  const fetchChat = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const base = MASTER_API_BASE.replace(/\/$/, '');
      const url = `${base}/master/admin_chat?limit=300&jotai=yuko&room=${encodeURIComponent(CHAT_ROOM)}`;
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
  }, []);

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
        room: CHAT_ROOM,
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
  }, []);

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
        room: CHAT_ROOM,
        name: titleBase.length > 24 ? `${titleBase.slice(0, 24)}…` : titleBase,
        sender_name: senderName,
        sender_display_name: senderName,
        sender_id: senderId,
        message: msg,
        source: 'common_header_chat',
        jotai: 'yuko',
        has_attachment: hasAttachments,
      };
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
      setAttachments([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchChat(true);
      setError('');
    } catch (e) {
      setError(String(e?.message || e || '送信エラー'));
    } finally {
      setSending(false);
    }
  }, [attachments, dataText, fetchChat, senderId, senderName, sending, text, uploading]);

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

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onResize = () => {
      const isDesktop = window.innerWidth > 900;
      setDesktopOnly(isDesktop);
      if (!isDesktop) setOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    fetchChat(false);
    const timer = setInterval(() => { fetchChat(true); }, POLL_MS);
    const onEsc = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onEsc);
    return () => {
      clearInterval(timer);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open, fetchChat]);

  const onDragStart = useCallback((e) => {
    if (!desktopOnly) return;
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
  }, [boxPos.x, boxPos.y, desktopOnly]);

  useEffect(() => {
    if (!open || !desktopOnly) return undefined;
    const onMove = (e) => {
      const d = dragRef.current;
      if (!d.active) return;
      const maxX = Math.max(0, window.innerWidth - 320);
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
  }, [open, desktopOnly]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [items.length, open]);

  if (!desktopOnly) return null;

  return (
    <>
      <button
        type="button"
        className="breadcrumbs-chat-trigger"
        aria-label="共通チャットを開く"
        onClick={() => setOpen(true)}
      >
        💬
      </button>
      <section
        className={`header-chat-overlay ${open ? 'open' : ''}`}
        aria-label="共通チャット"
        style={{ left: `${boxPos.x}px`, top: `${boxPos.y}px` }}
      >
        <div className="header-chat-head" onMouseDown={onDragStart}>
          <strong>共通チャット</strong>
          <span className="status">5秒更新</span>
          <button type="button" className="close" onClick={() => setOpen(false)} aria-label="閉じる">×</button>
        </div>
        <div className="header-chat-log" ref={listRef}>
          {loading && items.length === 0 ? (
            <div className="header-chat-empty">読み込み中...</div>
          ) : items.length === 0 ? (
            <div className="header-chat-empty">まだ投稿がありません</div>
          ) : (
            items.map((row) => {
              const mine = senderId && String(row?.sender_id || '') === senderId;
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
              return (
                <article key={String(row?.chat_id || row?.created_at || Math.random())} className={`header-chat-item ${mine ? 'mine' : ''}`}>
                  <header>
                    <span className="who">{senderDisplayName}</span>
                    <span className="at">{toDisplayDateTime(row?.created_at)}</span>
                  </header>
                  {String(row?.message || '').trim() ? (
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
          <input
            ref={fileInputRef}
            type="file"
            className="file-input"
            multiple
            onChange={onSelectFile}
          />
          <textarea
            value={text}
            onChange={(e) => setText(truncateByCodePoints(e.target.value, MAX_MESSAGE_LEN))}
            placeholder={`メッセージ（最大${MAX_MESSAGE_LEN}文字）`}
          />
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
              <button type="button" onClick={() => setShowEmojiPicker((v) => !v)} disabled={sending || uploading}>
                {showEmojiPicker ? '絵文字閉じる' : '絵文字'}
              </button>
              <button type="button" onClick={() => setShowDataEditor((v) => !v)} disabled={sending || uploading}>
                {showDataEditor ? 'データ閉じる' : 'データ'}
              </button>
              <button
                type="button"
                disabled={sending || uploading || (!String(text || '').trim() && attachments.length === 0 && !String(dataText || '').trim())}
                onClick={send}
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
