import React from 'react';
import './hotbar.css';

/**
 * EXHotbar: 会話形式の選択肢を表示するための追加ホットバー。
 * メインのホットバーの上に重なるように配置。
 */
export default function EXHotbar({ options, onSelect, visible, inline = false, className = '' }) {
    if (!visible || !options?.length) return null;

    const cls = [
        'ex-hotbar',
        inline ? 'ex-hotbar-inline' : '',
        className || '',
    ].filter(Boolean).join(' ');

    return (
        <div className={cls}>
            {options.map((opt) => (
                <button
                    key={opt.key}
                    type="button"
                    className="hotbar-btn ex-hotbar-btn"
                    onClick={() => onSelect(opt)}
                    title={opt.fullLabel || opt.label}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}
