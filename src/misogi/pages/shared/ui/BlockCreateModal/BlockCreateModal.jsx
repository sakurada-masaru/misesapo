import React, { useState, useEffect } from 'react';
import './block-create-modal.css';

/**
 * ブロック（クローズ）作成モーダル（SP/PC共通）
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
    // onClose is handled internally by onCreate if success, 
    // but here we just call the prop if needed.
  }

  const title = userId == null ? '全体クローズ' : '不可欠時間の登録';

  const reasons = [
    { code: 'sleep', label: '睡眠', icon: '💤' },
    { code: 'move', label: '移動', icon: '🚗' },
    { code: 'private', label: '私用', icon: '🏠' },
    { code: 'other', label: 'その他', icon: '💬' },
  ];

  return (
    <div className="blockCreateModalBackdrop" onMouseDown={onClose} role="presentation">
      <div className="blockCreateModal" onMouseDown={(e) => e.stopPropagation()} role="dialog">
        <div className="blockCreateModalHeader">
          <div className="blockCreateModalTitle">{title}</div>
          <button type="button" className="iconBtn" onClick={onClose} aria-label="閉じる" style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', color: 'var(--muted)' }}>✕</button>
        </div>

        {conflictError && (
          <div className="modalConflictError" role="alert" style={{ marginTop: 12 }}>
            {conflictError}
          </div>
        )}

        <div className="blockCreateModalBody">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
          </div>

          <div className="field">
            <span>理由を選択</span>
            <div className="reasonGrid">
              {reasons.map(r => (
                <div
                  key={r.code}
                  className={`reasonOption ${reasonCode === r.code ? 'active' : ''}`}
                  onClick={() => setReasonCode(r.code)}
                >
                  <span style={{ fontSize: '1.2rem' }}>{r.icon}</span>
                  <span>{r.label}</span>
                </div>
              ))}
            </div>
          </div>

          <label className="field">
            <span>メモ（任意）</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="例：病院、休憩など" />
          </label>
        </div>

        <div className="blockCreateModalFooter">
          <button type="button" className="btn" onClick={onClose}>キャンセル</button>
          <button
            type="button"
            className="btnPrimary btn"
            onClick={handleCreate}
            disabled={!startAt || !endAt || Date.parse(startAt) >= Date.parse(endAt)}
          >
            登録する
          </button>
        </div>
      </div>
    </div>
  );
}
