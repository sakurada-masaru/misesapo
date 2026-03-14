const AI_ENABLED_RAW = String(import.meta.env?.VITE_CUSTOMER_CHAT_AI_ENABLED || '').trim().toLowerCase();
const CUSTOMER_CHAT_AI_ENABLED = AI_ENABLED_RAW
  ? !['0', 'false', 'off', 'disabled'].includes(AI_ENABLED_RAW)
  : true;
const OPERATOR_START_HOUR = Number(import.meta.env?.VITE_CUSTOMER_CHAT_OPERATOR_START_HOUR ?? 9);
const OPERATOR_END_HOUR = Number(import.meta.env?.VITE_CUSTOMER_CHAT_OPERATOR_END_HOUR ?? 18);

function norm(v) {
  return String(v || '').trim();
}

function sanitizeReply(text) {
  return String(text || '').replace(/\r/g, '').trim();
}

function getJstHour(now = new Date()) {
  try {
    const hourText = new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      hour: '2-digit',
      hour12: false,
    }).format(now);
    const hour = Number(String(hourText).replace(/[^\d]/g, '').slice(-2));
    return Number.isFinite(hour) ? hour : 0;
  } catch {
    // fallback: local time
    return now.getHours();
  }
}

export function isWithinOperatorSupportHours(now = new Date()) {
  const hour = getJstHour(now);
  const start = Number.isFinite(OPERATOR_START_HOUR) ? OPERATOR_START_HOUR : 9;
  const end = Number.isFinite(OPERATOR_END_HOUR) ? OPERATOR_END_HOUR : 18;
  return hour >= start && hour < end;
}

export function shouldUseCustomerAiAutoReplyNow(now = new Date()) {
  if (!CUSTOMER_CHAT_AI_ENABLED) return false;
  return !isWithinOperatorSupportHours(now);
}

async function requestCustomerAiRelay({
  masterApiBase,
  authHeaders,
  userMessage,
  storeLabel = '',
  recentMessages = [],
}) {
  const base = String(masterApiBase || '').replace(/\/$/, '');
  if (!base) throw new Error('masterApiBase is required');
  const headers = {
    ...(typeof authHeaders === 'function' ? authHeaders() : (authHeaders || {})),
    'Content-Type': 'application/json',
  };
  const normalizedRecent = (Array.isArray(recentMessages) ? recentMessages : [])
    .slice(-6)
    .map((m) => ({
      sender_role: String(m?.senderRole || m?.sender_role || '').toLowerCase() === 'customer' ? 'customer' : 'admin',
      text: String(m?.text || '').slice(0, 220),
      sent_at: String(m?.at || m?.sent_at || ''),
    }));
  const response = await fetch(`${base}/master/admin_chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      mode: 'customer_ai_reply',
      user_message: String(userMessage || ''),
      store_label: String(storeLabel || ''),
      recent_messages: normalizedRecent,
    }),
  });
  if (!response.ok) {
    const raw = await response.text().catch(() => '');
    throw new Error(`AI中継API応答エラー: ${response.status} ${raw}`.trim());
  }
  const payload = await response.json().catch(() => ({}));
  return payload && typeof payload === 'object' ? payload : {};
}

export async function buildCustomerPortalAiReply({
  masterApiBase = '',
  authHeaders = null,
  userMessage = '',
  storeLabel = '',
  recentMessages = [],
}) {
  const message = norm(userMessage);
  if (!message) {
    return {
      enabled: CUSTOMER_CHAT_AI_ENABLED,
      blocked: false,
      mode: 'empty',
      provider: 'none',
      model: '',
      reply: '',
    };
  }
  if (!CUSTOMER_CHAT_AI_ENABLED) {
    return {
      enabled: false,
      blocked: false,
      mode: 'disabled',
      provider: 'none',
      model: '',
      reply: '',
    };
  }
  try {
    const relay = await requestCustomerAiRelay({
      masterApiBase,
      authHeaders,
      userMessage: message,
      storeLabel,
      recentMessages,
    });
    const reply = sanitizeReply(relay?.reply || '');
    return {
      enabled: relay?.enabled !== false,
      blocked: Boolean(relay?.blocked),
      mode: String(relay?.mode || ''),
      provider: String(relay?.provider || ''),
      model: String(relay?.model || ''),
      reasons: Array.isArray(relay?.reasons) ? relay.reasons : [],
      reply,
    };
  } catch {
    return {
      enabled: true,
      blocked: false,
      mode: 'fallback',
      provider: 'misogi-fallback',
      model: '',
      reply: 'お問い合わせありがとうございます。内容を受け付けました。担当者が確認してご連絡いたします。',
    };
  }
}
