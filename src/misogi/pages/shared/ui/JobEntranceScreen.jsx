import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Visualizer from './Visualizer/Visualizer';
import Hotbar from './Hotbar/Hotbar';
import { useReportStyleTransition, TRANSITION_CLASS_PAGE, TRANSITION_CLASS_UI, ReportTransitionOverlay } from './ReportTransition/reportTransition.jsx';
import { JOBS } from '../utils/constants';

const JOB_KEYS = ['sales', 'cleaning', 'office', 'dev', 'admin'];

export default function JobEntranceScreen({ job: jobKey, hotbarConfig }) {
  const navigate = useNavigate();
  const { isTransitioning, startTransition } = useReportStyleTransition(navigate);
  const job = jobKey && JOBS[jobKey];
  const valid = job && JOB_KEYS.includes(jobKey);
  const actions = Array.isArray(hotbarConfig) && hotbarConfig.length === 4 ? hotbarConfig : null;
  const [tab, setTab] = useState(actions?.[0]?.id ?? null);

  const onHotbar = (id) => {
    const action = actions?.find((a) => a.id === id);
    setTab(id);
    // subItemsがない場合、toプロパティがあれば遷移
    if (!action?.subItems && action?.to) {
      if (action.to.startsWith('http')) {
        window.location.href = action.to;
      } else {
        navigate(action.to);
      }
    }
  };

  if (!valid) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p>ジョブが見つかりません。</p>
        <Link to="/">Portal へ戻る</Link>
      </div>
    );
  }

  const currentAction = actions?.find((a) => a.id === tab);
  const tabLabel = currentAction?.label ?? tab;
  const vizMode = currentAction?.role ?? 'base';
  const isLogTransition = vizMode === 'log';
  const showTransition = isLogTransition || isTransitioning;

  return (
    <div className={`job-entrance-page ${showTransition ? TRANSITION_CLASS_PAGE : ''}`} data-job={jobKey} style={{ paddingBottom: 110 }}>
      <div className="job-entrance-viz">
        <Visualizer
          mode={vizMode}
          onLogTransitionEnd={() => {
            if (currentAction?.to && currentAction.to.startsWith('http')) {
              window.location.href = currentAction.to;
              return;
            }
            if (jobKey === 'sales') {
              navigate('/sales/report-day');
            } else {
              navigate(`/jobs/${jobKey}/report`);
            }
          }}
        />
      </div>
      <div className={`job-entrance-ui ${showTransition ? TRANSITION_CLASS_UI : ''}`}>
        <main className="job-entrance-main">
          <h1 className="job-entrance-title" style={{ color: job.color }}>{job.label}</h1>

          {/* サブホットバー（選択中のアクションに subItems がある場合表示） */}
          {currentAction?.subItems && (
            <div className="sub-hotbar">
              {currentAction.subItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="sub-hotbar-btn"
                  onClick={() => {
                    const path = item.path || item.to;
                    if (path) {
                      startTransition(path);
                    }
                  }}
                  disabled={isTransitioning}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {!currentAction?.subItems && (
            <p className="job-entrance-dummy">{actions ? `タブ: ${tabLabel}` : '（ダミー画面）'}</p>
          )}
          <p style={{ marginTop: 16 }}><Link to="/">Portal へ戻る</Link></p>
        </main>
      </div>
      {actions && <Hotbar actions={actions} active={tab} onChange={onHotbar} />}
      {isTransitioning && <ReportTransitionOverlay visible />}
    </div>
  );
}
