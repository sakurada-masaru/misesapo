import React from 'react';
import './entrance-mode-toggle.css';

const ENTRANCE_MODES = [
  { id: 'default', label: '標準' },
  { id: 'sepia', label: 'セピア' },
];

export default function EntranceModeToggle({ mode = 'default', onChange }) {
  const safeMode = ENTRANCE_MODES.some((item) => item.id === mode) ? mode : 'default';

  return (
    <div className="entrance-mode-toggle" role="group" aria-label="管理エントランス表示モード">
      <span className="entrance-mode-toggle-label">表示モード</span>
      <div className="entrance-mode-toggle-buttons">
        {ENTRANCE_MODES.map((item) => {
          const active = safeMode === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`entrance-mode-toggle-button ${active ? 'active' : ''}`}
              onClick={() => onChange?.(item.id)}
              aria-pressed={active}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
