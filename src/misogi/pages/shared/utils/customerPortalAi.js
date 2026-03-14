const GOOGLE_MODEL = String(import.meta.env?.VITE_GOOGLE_AI_MODEL || 'gemini-2.0-flash').trim();
const GOOGLE_API_KEY = String(import.meta.env?.VITE_GOOGLE_AI_API_KEY || '').trim();
const AI_ENABLED_RAW = String(import.meta.env?.VITE_CUSTOMER_CHAT_AI_ENABLED || '').trim().toLowerCase();
const CUSTOMER_CHAT_AI_ENABLED = AI_ENABLED_RAW
  ? !['0', 'false', 'off', 'disabled'].includes(AI_ENABLED_RAW)
  : true;

const RESTRICTED_PATTERNS = [
  /契約/i,
  /契約書/i,
  /約款/i,
  /規約/i,
  /料金/i,
  /金額/i,
  /見積/i,
  /請求/i,
  /領収/i,
  /支払/i,
  /値引/i,
  /返金/i,
  /違約/i,
  /補償/i,
  /賠償/i,
  /責任/i,
  /保証/i,
  /法務/i,
  /違法/i,
  /訴訟/i,
  /判断/i,
  /確約/i,
  /承認/i,
  /合意/i,
];

const RESTRICTED_REPLY = 'ご質問ありがとうございます。契約・金額・判断が必要な内容はAIでは確定回答できません。担当者が確認のうえご連絡いたします。';

function norm(v) {
  return String(v || '').trim();
}

function parseGeminiText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((row) => String(row?.text || '')).join('\n').trim();
}

function sanitizeReply(text) {
  return String(text || '').replace(/\r/g, '').trim();
}

export function detectRestrictedCustomerInquiry(text) {
  const raw = norm(text);
  if (!raw) return { blocked: false, reasons: [] };
  const reasons = [];
  RESTRICTED_PATTERNS.forEach((re) => {
    if (re.test(raw)) reasons.push(re.source);
  });
  return { blocked: reasons.length > 0, reasons };
}

async function requestGeminiCustomerReply({ userMessage, storeLabel = '', recentMessages = [] }) {
  if (!GOOGLE_API_KEY) throw new Error('Google AI APIキーが未設定です（VITE_GOOGLE_AI_API_KEY）。');
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GOOGLE_MODEL)}:generateContent?key=${encodeURIComponent(GOOGLE_API_KEY)}`;

  const historyText = (Array.isArray(recentMessages) ? recentMessages : [])
    .slice(-6)
    .map((m) => {
      const role = String(m?.senderRole || '') === 'customer' ? 'お客様' : '担当者';
      return `${role}: ${String(m?.text || '').slice(0, 220)}`;
    })
    .join('\n');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{
          text: [
            'あなたは「ミセサポ」お客様窓口AIです。',
            '役割: 受付・一般案内・確認事項の整理のみ。',
            '禁止: 契約、金額、請求、値引き、補償、責任、法務、判断、確約、承認に関する確定回答。',
            '禁止話題が含まれる場合は、必ず「担当者が確認して連絡する」旨の案内に留める。',
            '回答は日本語、丁寧語、120文字以内を目安。過剰な装飾や絵文字は使わない。',
          ].join('\n'),
        }],
      },
      generationConfig: {
        temperature: 0.35,
        topP: 0.9,
        maxOutputTokens: 180,
      },
      contents: [{
        role: 'user',
        parts: [{
          text: [
            `店舗ラベル: ${storeLabel || '未設定'}`,
            historyText ? `直近会話:\n${historyText}` : '',
            `今回のお問い合わせ:\n${userMessage}`,
          ].filter(Boolean).join('\n\n'),
        }],
      }],
    }),
  });
  if (!response.ok) {
    const raw = await response.text().catch(() => '');
    throw new Error(`Google AI応答エラー: ${response.status} ${raw}`.trim());
  }
  const payload = await response.json();
  const text = parseGeminiText(payload);
  if (!text) throw new Error('Google AIから有効な応答テキストを取得できませんでした。');
  return sanitizeReply(text);
}

export async function buildCustomerPortalAiReply({
  userMessage = '',
  storeLabel = '',
  recentMessages = [],
}) {
  const message = norm(userMessage);
  if (!message) return { enabled: CUSTOMER_CHAT_AI_ENABLED, blocked: false, reply: '' };
  const restricted = detectRestrictedCustomerInquiry(message);
  if (restricted.blocked) {
    return {
      enabled: CUSTOMER_CHAT_AI_ENABLED,
      blocked: true,
      reasons: restricted.reasons,
      reply: RESTRICTED_REPLY,
    };
  }
  if (!CUSTOMER_CHAT_AI_ENABLED) {
    return { enabled: false, blocked: false, reply: '' };
  }
  try {
    const aiText = await requestGeminiCustomerReply({
      userMessage: message,
      storeLabel,
      recentMessages,
    });
    return {
      enabled: true,
      blocked: false,
      reply: sanitizeReply(aiText) || 'お問い合わせありがとうございます。担当者が内容を確認し、必要に応じてご連絡いたします。',
    };
  } catch {
    return {
      enabled: true,
      blocked: false,
      reply: 'お問い合わせありがとうございます。内容を受け付けました。担当者が確認してご連絡いたします。',
    };
  }
}

