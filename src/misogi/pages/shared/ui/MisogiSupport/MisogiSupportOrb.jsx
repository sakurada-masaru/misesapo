import React, { useCallback, useEffect, useRef, useState } from 'react';
import Visualizer from '../Visualizer/Visualizer';

const GOOGLE_MODEL = String(import.meta.env?.VITE_GOOGLE_AI_MODEL || 'gemini-2.0-flash').trim();
const GOOGLE_API_KEY = String(import.meta.env?.VITE_GOOGLE_AI_API_KEY || '').trim();
const OVERLAY_WIDTH = 340;
const OVERLAY_HEIGHT = 520;

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clampOverlayPosition(pos) {
  if (typeof window === 'undefined') return pos;
  const maxX = Math.max(12, window.innerWidth - OVERLAY_WIDTH - 12);
  const maxY = Math.max(12, window.innerHeight - OVERLAY_HEIGHT - 12);
  return {
    x: clampNumber(Number(pos?.x || 0), 12, maxX),
    y: clampNumber(Number(pos?.y || 0), 12, maxY),
  };
}

function resolveInitialPosition() {
  if (typeof window === 'undefined') return { x: 20, y: 84 };
  const x = Math.max(12, window.innerWidth - OVERLAY_WIDTH - 24);
  return { x, y: 84 };
}

function sanitizeText(value) {
  return String(value || '').replace(/\r/g, '').trim();
}

function parseGeminiText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts.map((row) => String(row?.text || '')).join('\n').trim();
}

async function requestGeminiReply(nextUserMessage) {
  if (!GOOGLE_API_KEY) {
    throw new Error('Google AI APIキーが未設定です（VITE_GOOGLE_AI_API_KEY）。');
  }
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GOOGLE_MODEL)}:generateContent?key=${encodeURIComponent(GOOGLE_API_KEY)}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{
          text: 'あなたはMISOGIサポートAIです。管理業務を支援する実務的な短文で回答してください。事実確認が必要な内容は断定せず、次の確認アクションを示してください。',
        }],
      },
      generationConfig: {
        temperature: 0.4,
        topP: 0.95,
        maxOutputTokens: 600,
      },
      contents: [{
        role: 'user',
        parts: [{ text: nextUserMessage }],
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
  return text;
}

export default function MisogiSupportOrb() {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(() => resolveInitialPosition());
  const [assistantMessage, setAssistantMessage] = useState('MISOGIサポートです。必要なことを入力してください。');
  const [userMessage, setUserMessage] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [errorText, setErrorText] = useState('');
  const dragStateRef = useRef({ active: false, offsetX: 0, offsetY: 0 });

  useEffect(() => {
    if (!open) return;
    setPosition((prev) => clampOverlayPosition(prev));
    const onResize = () => setPosition((prev) => clampOverlayPosition(prev));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onMove = (event) => {
      const state = dragStateRef.current;
      if (!state.active) return;
      const x = Number(event?.clientX || 0) - state.offsetX;
      const y = Number(event?.clientY || 0) - state.offsetY;
      setPosition(clampOverlayPosition({ x, y }));
    };
    const onUp = () => {
      dragStateRef.current.active = false;
      document.body.style.userSelect = '';
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.body.style.userSelect = '';
    };
  }, [open]);

  const startDrag = useCallback((event) => {
    const rect = event.currentTarget?.closest('.misogi-support-overlay')?.getBoundingClientRect();
    if (!rect) return;
    dragStateRef.current = {
      active: true,
      offsetX: Number(event.clientX || 0) - rect.left,
      offsetY: Number(event.clientY || 0) - rect.top,
    };
    document.body.style.userSelect = 'none';
  }, []);

  const sendMessage = useCallback(async () => {
    const message = sanitizeText(draft);
    if (!message || sending) return;
    setErrorText('');
    setDraft('');
    setSending(true);
    setUserMessage(message);
    try {
      const reply = await requestGeminiReply(message);
      setAssistantMessage(reply);
    } catch (error) {
      setErrorText(String(error?.message || '送信に失敗しました。'));
      setAssistantMessage('応答取得に失敗しました。時間をおいて再試行してください。');
    } finally {
      setSending(false);
    }
  }, [draft, sending]);

  const onDraftKeyDown = useCallback((event) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    sendMessage();
  }, [sendMessage]);

  return (
    <>
      <button
        type="button"
        className={`misogi-support-trigger ${open ? 'open' : ''}`}
        aria-label="MISOGIサポートを開く"
        onClick={() => setOpen((prev) => !prev)}
      >
        {open ? '×' : 'M'}
      </button>
      {open && (
        <section
          className="misogi-support-overlay"
          style={{ left: `${position.x}px`, top: `${position.y}px` }}
          aria-label="MISOGIサポート"
        >
          <div className="misogi-support-log ai-pane">
            <div className="misogi-msg ai">
              {String(assistantMessage || '')}
            </div>
            {sending && <div className="misogi-msg ai loading">考えています...</div>}
          </div>
          <div className="misogi-support-orb" onPointerDown={startDrag}>
            <Visualizer mode="base" className="misogi-support-visualizer" />
          </div>
          <div className="misogi-support-log user-pane">
            {userMessage ? (
              <div className="misogi-msg mine">
                {String(userMessage || '')}
              </div>
            ) : null}
          </div>
          <footer className="misogi-support-compose">
            <textarea
              value={draft}
              onChange={(event) => setDraft(String(event.target.value || '').slice(0, 800))}
              onKeyDown={onDraftKeyDown}
              placeholder="MISOGIへ相談する内容を入力"
              disabled={sending}
            />
            <button type="button" onClick={sendMessage} disabled={sending || !sanitizeText(draft)}>
              送信
            </button>
          </footer>
          {errorText ? <p className="misogi-support-error">{errorText}</p> : null}
        </section>
      )}
    </>
  );
}
