import React from 'react';
import './hotbar.css';

/**
 * アクションボタン。ジョブごとに内容は変えるが、仕組みは機能呼び出しだけ。
 * action.disabled === true のときはボタン無効（onChange は呼ばない）。
 */
export default function Hotbar({ actions, active, onChange }) {
  if (!actions?.length) return null;
  return (
    <div className="hotbar" role="navigation">
      {actions.map((a) => {
        const isDisabled = a.disabled === true;
        return (
          <button
            key={a.id}
            type="button"
            className={`hotbar-btn ${a.id === active ? 'active' : ''} ${isDisabled ? 'hotbar-btn-disabled' : ''}`}
            disabled={isDisabled}
            onClick={() => !isDisabled && onChange?.(a.id)}
          >
            {a.label}
          </button>
        );
      })}
    </div>
  );
}
