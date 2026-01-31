import React from 'react';
import { Link } from 'react-router-dom';

/**
 * HR Attendance（ひとまずダミー）
 */
export default function HrAttendance() {
  return (
    <div className="admin-page admin-hr-attendance">
      <h1>HR Attendance Placeholder</h1>
      <p style={{ color: 'var(--muted)' }}>人事・勤怠画面は今後実装</p>
      <p style={{ marginTop: 16 }}>
        <Link to="/admin">管理 TOP へ戻る</Link>
      </p>
    </div>
  );
}
