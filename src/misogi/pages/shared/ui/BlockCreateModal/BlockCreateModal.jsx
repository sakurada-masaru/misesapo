import React, { useState, useEffect } from 'react';

/**
 * ブロック（クローズ）作成モーダル（SP/PC共通）
 * props: userId (string | null = 全体クローズ), userName, initialStartAt, initialEndAt (YYYY-MM-DDTHH:mm), onClose, onCreate(payload), conflictError (string | null)
 */
export default function BlockCreateModal({ userId, userName, initialStartAt, initialEndAt, onClose, onCreate, conflictError }) {
  const [startAt, setStartAt] = useState(initialStartAt ?? '');
  const [endAt, setEndAt] = useState(initialEndAt ?? '');
  const [reasonCode, setReasonCode] = useState('sleep');
  const [note, setNote] = useState('');

  useEffect(() => {
    setStartAt(initialStartAt ?? '');
    setEndAt(initialEndAt ?? '');
  }, [initialStartAt, initialEndAt]);

  function handleCreate() {
    if (!startAt || !endAt) return;
    if (Date.parse(startAt) >= Date.parse(endAt)) return;

    const startIso = startAt.length === 16 ? `${startAt}:00` : startAt;
    const endIso = endAt.length === 16 ? `${endAt}:00` : endAt;

    onCreate({
      user_id: userId,
      start_at: startIso,
      end_at: endIso,
      type: userId == null ? 'company_close' : 'personal_close',
      reason_code: reasonCode,
      reason_note: note || undefined,
      visibility: 'admin_only',
    });
    onClose();
  }

  const title = userId == null ? '全体クローズ（この時間は誰も割当不可）' : `この時間は入れない（${userName ?? userId}）`;

  return (
    <div className="blockCreateModalBackdrop" onMouseDown={onClose} role="presentation">
      <div className="blockCreateModal" onMouseDown={(e) => e.stopPropagation()} role="dialog">
        <div className="blockCreateModalHeader">
          <div className="blockCreateModalTitle">{title}</div>
          <button type="button" className="iconBtn" onClick={onClose} aria-label="閉じる">✕</button>
        </div>
        {conflictError && (
          <div className="modalConflictError" role="alert">
            {conflictError}
          </div>
        )}
        <div className="blockCreateModalBody">
          <label className="field">
            <span>開始</span>
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              step={900}
            />
          </label>
          <label className="field">
            <span>終了</span>
            <input
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              step={900}
            />
          </label>
          <label className="field">
            <span>理由</span>
            <select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
              <option value="sleep">睡眠</option>
              <option value="move">移動</option>
              <option value="private">私用</option>
              <option value="other">その他</option>
            </select>
          </label>
          <label className="field">
            <span>メモ（任意）</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="例）病院" />
          </label>
        </div>
        <div className="blockCreateModalFooter">
          <button type="button" className="btn" onClick={onClose}>キャンセル</button>
          <button
            type="button"
            className="btnPrimary"
            onClick={handleCreate}
            disabled={!startAt || !endAt || Date.parse(startAt) >= Date.parse(endAt)}
          >
            作成
          </button>
        </div>
      </div>
    </div>
  );
}
