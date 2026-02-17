import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Visualizer from './Visualizer/Visualizer';
import Hotbar from './Hotbar/Hotbar';
import { useReportStyleTransition, TRANSITION_CLASS_PAGE, TRANSITION_CLASS_UI } from './ReportTransition/reportTransition.jsx';
import { JOBS } from '../utils/constants';
import { useI18n } from '../i18n/I18nProvider';

const JOB_KEYS = ['sales', 'cleaning', 'office', 'dev', 'admin'];

export default function JobEntranceScreen({ job: jobKey, hotbarConfig, showFlowGuideButton = true }) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { isTransitioning, startTransition } = useReportStyleTransition(navigate);
  const job = jobKey && JOBS[jobKey];
  const valid = job && JOB_KEYS.includes(jobKey);
  const actions = Array.isArray(hotbarConfig) && hotbarConfig.length === 4 ? hotbarConfig : null;
  const [tab, setTab] = useState(actions?.[0]?.id ?? null);
  const [subGroupByTab, setSubGroupByTab] = useState({});

  const onHotbar = (id) => {
    const action = actions?.find((a) => a.id === id);
    setTab(id);

    if (action?.to) {
      if (action.to.startsWith('http')) {
        // External link
        window.location.href = action.to;
      } else {
        // Internal link
        navigate(action.to);
      }
    }
  };

  if (!valid) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p>{t('ジョブが見つかりません。')}</p>
        <Link to="/">{t('Portal へ戻る')}</Link>
      </div>
    );
  }

  const currentAction = actions?.find((a) => a.id === tab);
  const tabLabel = t(currentAction?.label ?? tab ?? '');
  // 遷移時の「MODE CHANGE」演出は無効化したいので、Visualizer の log モードは使わない。
  const vizMode = currentAction?.role === 'log' ? 'base' : (currentAction?.role ?? 'base');
  const showTransition = isTransitioning;

  const subGroups = useMemo(() => {
    const items = currentAction?.subItems;
    if (!Array.isArray(items) || items.length === 0) return null;

    const groups = new Map(); // preserve insertion order
    items.forEach((it) => {
      const g = (it && it.group) ? String(it.group) : t('その他');
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(it);
    });
    return {
      keys: [...groups.keys()],
      itemsByKey: groups,
    };
  }, [currentAction]);

  // タブ切替時に、サブカテゴリが存在するなら先頭に合わせる（未設定時のみ）
  useEffect(() => {
    if (!currentAction?.id) return;
    if (!subGroups?.keys?.length) return;
    const current = subGroupByTab[currentAction.id];
    if (current && subGroups.itemsByKey.has(current)) return;
    setSubGroupByTab((prev) => ({ ...prev, [currentAction.id]: subGroups.keys[0] }));
  }, [currentAction?.id, subGroups?.keys?.length]);

  const activeSubGroupKey = currentAction?.id ? subGroupByTab[currentAction.id] : null;
  const activeSubItems = useMemo(() => {
    if (!subGroups) return currentAction?.subItems || null;
    if (subGroups.keys.length <= 1) return currentAction?.subItems || null;
    const k = activeSubGroupKey || subGroups.keys[0];
    return subGroups.itemsByKey.get(k) || [];
  }, [subGroups, currentAction, activeSubGroupKey]);

  return (
    <div className={`job-entrance-page ${showTransition ? TRANSITION_CLASS_PAGE : ''}`} data-job={jobKey} style={{ paddingBottom: 110 }}>
      <div className="job-entrance-viz">
        <Visualizer mode={vizMode} />
      </div>
      <div className={`job-entrance-ui ${showTransition ? TRANSITION_CLASS_UI : ''}`}>
        <main className="job-entrance-main">
          <h1 className="job-entrance-title" style={{ color: job.color }}>{job.label}</h1>

          {/* サブホットバー（選択中のアクションに subItems がある場合表示） */}
          {Array.isArray(currentAction?.subItems) && currentAction.subItems.length > 0 && (
            <div className="sub-hotbar-wrap">
              {subGroups?.keys?.length > 1 && (
                <div className="sub-hotbar-groups" role="tablist" aria-label={t('カテゴリ')}>
                  {subGroups.keys.map((k) => {
                    const active = (activeSubGroupKey || subGroups.keys[0]) === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        className={`sub-hotbar-group-btn ${active ? 'active' : ''}`}
                        onClick={() => setSubGroupByTab((prev) => ({ ...prev, [currentAction.id]: k }))}
                        disabled={isTransitioning}
                      >
                        {t(k)}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="sub-hotbar">
                {(activeSubItems || []).map((item) => (
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
                    {t(item.label)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!currentAction?.subItems && (
            <p className="job-entrance-dummy">{actions ? `${t('タブ:')} ${tabLabel}` : t('（ダミー画面）')}</p>
          )}
          <p style={{ marginTop: 16 }}><Link to="/">{t('Portal へ戻る')}</Link></p>
        </main>
      </div>
      {actions && <Hotbar actions={actions} active={tab} onChange={onHotbar} showFlowGuideButton={showFlowGuideButton} />}
    </div>
  );
}
