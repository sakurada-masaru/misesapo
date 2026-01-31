import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Admin TOP（HR / Attendance 等へのリンク）
 */
export default function AdminHome() {
  return (
    <div className="admin-page">
      <h1>管理 TOP</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 16 }}>ジョブ別サマリー等は今後実装</p>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Link to="/admin/entrance">管理エントランス</Link>
        <Link to="/admin/hr/attendance">HR / Attendance</Link>
      </nav>
      <p style={{ marginTop: 24 }}>
        <Link to="/entrance">現場入口に戻る</Link>
      </p>
    </div>
  );
}
