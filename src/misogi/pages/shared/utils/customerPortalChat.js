export const CUSTOMER_PORTAL_CHAT_ROOM = 'customer_portal_chat';
export const CUSTOMER_PORTAL_CHAT_SOURCE = 'customer_portal_chat';

function norm(v) {
  return String(v || '').trim();
}

function asItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.rows)) return data.rows;
  return [];
}

function toEpochMs(value) {
  const t = Date.parse(norm(value));
  return Number.isFinite(t) ? t : 0;
}

function parsePayload(rawPayload) {
  if (rawPayload && typeof rawPayload === 'object') return rawPayload;
  const s = norm(rawPayload);
  if (!s) return {};
  try {
    const parsed = JSON.parse(s);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function isSameTenpo(payload, tenpoId) {
  const expected = norm(tenpoId);
  if (!expected) return true;
  return norm(payload?.tenpo_id) === expected;
}

export function normalizeCustomerPortalChatRows(rawRows, tenpoId = '') {
  return asItems(rawRows)
    .map((row, idx) => {
      const payload = parsePayload(row?.data_payload);
      if (!isSameTenpo(payload, tenpoId)) return null;
      const text = norm(row?.message || payload?.message || row?.name);
      if (!text) return null;
      const at = norm(row?.created_at || row?.updated_at || row?.reported_at || payload?.sent_at || row?.date) || new Date().toISOString();
      const senderRoleRaw = norm(payload?.sender_role || row?.sender_role || (String(row?.source || '').includes('customer') ? 'customer' : 'admin')).toLowerCase();
      const senderRole = senderRoleRaw === 'customer' ? 'customer' : 'admin';
      const senderName = norm(
        row?.sender_display_name
        || row?.sender_name
        || payload?.sender_name
        || payload?.sender_display_name
        || (senderRole === 'customer' ? 'お客様' : 'ミセサポ')
      ) || (senderRole === 'customer' ? 'お客様' : 'ミセサポ');
      return {
        id: norm(row?.chat_id || row?.admin_chat_id || row?.id) || `customer-portal-chat-${idx}-${toEpochMs(at) || Date.now()}`,
        text,
        at,
        atMs: toEpochMs(at),
        senderRole,
        senderName,
        tenpoId: norm(payload?.tenpo_id),
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.atMs || 0) - (b.atMs || 0));
}

export async function fetchCustomerPortalChats({
  masterApiBase,
  authHeaders,
  tenpoId,
  limit = 400,
}) {
  const base = String(masterApiBase || '').replace(/\/$/, '');
  const qs = new URLSearchParams({
    limit: String(limit),
    jotai: 'yuko',
    room: CUSTOMER_PORTAL_CHAT_ROOM,
  });
  const headers = typeof authHeaders === 'function' ? authHeaders() : (authHeaders || {});
  const res = await fetch(`${base}/master/admin_chat?${qs.toString()}`, {
    headers,
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`お客様チャットの取得に失敗 (${res.status}) ${text}`.trim());
  }
  const data = await res.json();
  return normalizeCustomerPortalChatRows(data, tenpoId);
}

export async function postCustomerPortalChat({
  masterApiBase,
  authHeaders,
  tenpoId,
  tenpoName = '',
  yagouName = '',
  senderRole = 'customer',
  senderName = '',
  senderId = '',
  message = '',
  dataPayloadExtra = null,
}) {
  const base = String(masterApiBase || '').replace(/\/$/, '');
  const text = norm(message);
  if (!text) throw new Error('message is required');
  const sentAt = new Date().toISOString();
  const titleBase = text.length > 24 ? `${text.slice(0, 24)}…` : text;
  const extraPayload = (dataPayloadExtra && typeof dataPayloadExtra === 'object')
    ? dataPayloadExtra
    : {};
  const payload = {
    room: CUSTOMER_PORTAL_CHAT_ROOM,
    name: titleBase,
    sender_name: senderName,
    sender_display_name: senderName,
    sender_id: senderId,
    message: text,
    source: CUSTOMER_PORTAL_CHAT_SOURCE,
    jotai: 'yuko',
    has_attachment: false,
    data_payload: {
      channel: 'customer_portal_chat',
      sender_role: senderRole === 'customer' ? 'customer' : 'admin',
      sender_name: senderName,
      tenpo_id: norm(tenpoId),
      tenpo_name: norm(tenpoName),
      yagou_name: norm(yagouName),
      store_label: [norm(yagouName), norm(tenpoName)].filter(Boolean).join(' / '),
      sent_at: sentAt,
      message: text,
      ...extraPayload,
    },
  };
  const headers = {
    ...(typeof authHeaders === 'function' ? authHeaders() : (authHeaders || {})),
    'Content-Type': 'application/json',
  };
  const res = await fetch(`${base}/master/admin_chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const textErr = await res.text().catch(() => '');
    throw new Error(`お客様チャットの送信に失敗 (${res.status}) ${textErr}`.trim());
  }
  return res.json().catch(() => ({}));
}
