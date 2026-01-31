import React from 'react';

/**
 * 共通 Card コンポーネント
 * 必要に応じてスタイル・スロットを拡張。
 */
export default function Card({ children, className = '' }) {
  return <div className={`card ${className}`.trim()}>{children}</div>;
}
