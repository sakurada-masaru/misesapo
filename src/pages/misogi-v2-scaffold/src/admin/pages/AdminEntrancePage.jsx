import React, { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Visualizer from '../../shared/ui/Visualizer/Visualizer';
import Hotbar from '../../shared/ui/Hotbar/Hotbar';
import { JOBS } from '../../shared/utils/constants';
import { ADMIN_HOTBAR } from './admin-entrance-hotbar.config';
import './admin-entrance.css';

const job = JOBS.admin;

/**
 * 管理エントランス（他エントランスと同様に Visualizer + メイン + ホットバー4枠）
 * 選択肢はホットバーボタン。オーバーレイ禁止。権限ガードは当面なし。
 */
export default function AdminEntrancePage() {
  const navigate = useNavigate();
  const [active, setActive] = useState(null);

  const onHotbar = useCallback(
    (id) => {
      const action = ADMIN_HOTBAR.find((a) => a.id === id);
      if (action?.disabled || !action?.to) return;
      const to = action.to; // /admin/work-reports → 実際のURLは /v2/admin/work-reports
      if (id === 'work-reports') console.log('go:', '/v2/admin/work-reports');
      navigate(to);
    },
    [navigate]
  );

  return (
    <div className="job-entrance-page admin-entrance-page" data-job="admin" style={{ paddingBottom: 110 }}>
      <div className="job-entrance-viz">
        <Visualizer mode="base" />
      </div>
      <div className="job-entrance-ui">
        <main className="job-entrance-main">
          <h1 className="job-entrance-title" style={{ color: job?.color ?? 'var(--accent-color)' }}>
            管理エントランス
          </h1>
          <p className="job-entrance-dummy">下のホットバーから項目を選んでください</p>
          <p className="admin-entrance-back">
            <Link to="/portal">Portal へ戻る</Link>
            {' · '}
            <Link to="/entrance">現場入口に戻る</Link>
          </p>
        </main>
      </div>
      <Hotbar actions={ADMIN_HOTBAR} active={active} onChange={onHotbar} />
    </div>
  );
}
