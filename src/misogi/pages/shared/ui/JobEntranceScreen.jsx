import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Visualizer from './Visualizer/Visualizer';
import Hotbar from './Hotbar/Hotbar';
import { useReportStyleTransition, TRANSITION_CLASS_PAGE, TRANSITION_CLASS_UI } from './ReportTransition/reportTransition.jsx';
import { JOBS } from '../utils/constants';
import { useI18n } from '../i18n/I18nProvider';
import ThemeToggle from './ThemeToggle/ThemeToggle';
import LanguageSwitcher from './LanguageSwitcher/LanguageSwitcher';
import CommonHeaderChat from './Breadcrumbs/CommonHeaderChat';

const JOB_KEYS = ['sales', 'cleaning', 'office', 'dev', 'admin'];

export default function JobEntranceScreen({ job: jobKey, hotbarConfig, showFlowGuideButton = true }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const { isTransitioning, startTransition } = useReportStyleTransition(navigate);
  const job = jobKey && JOBS[jobKey];
  const valid = job && JOB_KEYS.includes(jobKey);
  const actions = Array.isArray(hotbarConfig) && hotbarConfig.length > 0 ? hotbarConfig : null;
  const [tab, setTab] = useState(actions?.[0]?.id ?? null);
  const [subGroupByTab, setSubGroupByTab] = useState({});
  const useSidebarNav = jobKey === 'admin';
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return jobKey === 'admin' ? window.innerWidth >= 1024 : false;
  });
  const [openSidebarSections, setOpenSidebarSections] = useState({});

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

  useEffect(() => {
    if (!useSidebarNav) return;
    const onResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [useSidebarNav]);

  const sidebarSections = useMemo(() => {
    if (!useSidebarNav || !Array.isArray(actions)) return [];
    return actions
      .map((section) => {
        const subItems = Array.isArray(section?.subItems) ? section.subItems : [];
        if (!subItems.length) return null;
        const groups = new Map();
        subItems.forEach((item) => {
          const key = item?.group || t('その他');
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(item);
        });
        return {
          id: section.id,
          label: section.label,
          groups: [...groups.entries()].map(([groupLabel, items]) => ({ groupLabel, items })),
        };
      })
      .filter(Boolean);
  }, [actions, t, useSidebarNav]);

  const isPathActive = (path) => {
    if (!path) return false;
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const onSidebarNavigate = (path) => {
    if (!path || isTransitioning) return;
    startTransition(path);
    if (window.innerWidth < 1024) setSidebarOpen(false);
  };

  useEffect(() => {
    if (!useSidebarNav || !sidebarSections.length) return;
    setOpenSidebarSections((prev) => {
      const next = {};
      sidebarSections.forEach((section, idx) => {
        next[section.id] = Object.prototype.hasOwnProperty.call(prev, section.id) ? !!prev[section.id] : idx === 0;
      });
      return next;
    });
  }, [sidebarSections, useSidebarNav]);

  useEffect(() => {
    if (!useSidebarNav || !sidebarSections.length) return;
    const activeSection = sidebarSections.find((section) =>
      section.groups.some(({ items }) => items.some((item) => isPathActive(item.path || item.to)))
    );
    if (!activeSection) return;
    setOpenSidebarSections((prev) => ({ ...prev, [activeSection.id]: true }));
  }, [location.pathname, sidebarSections, useSidebarNav]);

  return (
    <div
      className={`job-entrance-page ${showTransition ? TRANSITION_CLASS_PAGE : ''}`}
      data-job={jobKey}
      style={{ paddingBottom: useSidebarNav ? 24 : 110 }}
    >
      <div className="job-entrance-viz">
        <Visualizer mode={vizMode} />
      </div>
      <div className={`job-entrance-ui ${showTransition ? TRANSITION_CLASS_UI : ''}`}>
        {useSidebarNav && (
          <>
            <button
              type="button"
              className={`job-entrance-sidebar-toggle ${sidebarOpen ? 'open' : ''}`}
              aria-label={t('メニュー')}
              onClick={() => setSidebarOpen((prev) => !prev)}
            >
              ☰
            </button>
            <button
              type="button"
              className={`job-entrance-sidebar-backdrop ${sidebarOpen ? 'open' : ''}`}
              aria-label={t('メニューを閉じる')}
              onClick={() => setSidebarOpen(false)}
            />
            <div className="job-entrance-common-chat-anchor">
              <CommonHeaderChat />
            </div>
            <aside className={`job-entrance-sidebar ${sidebarOpen ? 'open' : ''}`} aria-label={t('管理メニュー')}>
              <div className="job-entrance-sidebar-head">{t('管理メニュー')}</div>
              <div className="job-entrance-sidebar-scroll">
                {sidebarSections.map((section) => (
                  <section key={section.id} className="job-entrance-sidebar-section">
                    <button
                      type="button"
                      className={`job-entrance-sidebar-section-title ${openSidebarSections[section.id] ? 'open' : ''}`}
                      onClick={() =>
                        setOpenSidebarSections((prev) => ({
                          ...prev,
                          [section.id]: !prev[section.id],
                        }))
                      }
                    >
                      <span>{t(section.label)}</span>
                      <span className="job-entrance-sidebar-section-icon">
                        {openSidebarSections[section.id] ? '▾' : '▸'}
                      </span>
                    </button>
                    {openSidebarSections[section.id] && section.groups.map(({ groupLabel, items }) => (
                      <div key={`${section.id}-${groupLabel}`} className="job-entrance-sidebar-group">
                        {section.groups.length > 1 && (
                          <p className="job-entrance-sidebar-group-label">{t(groupLabel)}</p>
                        )}
                        <div className="job-entrance-sidebar-links">
                          {items.map((item) => {
                            const path = item.path || item.to;
                            const active = isPathActive(path);
                            return (
                              <button
                                key={item.id}
                                type="button"
                                className={`job-entrance-sidebar-link ${active ? 'active' : ''}`}
                                onClick={() => onSidebarNavigate(path)}
                                disabled={isTransitioning}
                              >
                                {t(item.label)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </section>
                ))}
              </div>
              <div className="job-entrance-sidebar-footer">
                <div className="job-entrance-sidebar-footer-title">{t('設定')}</div>
                <div className="job-entrance-sidebar-footer-content">
                  <LanguageSwitcher />
                  <ThemeToggle />
                </div>
              </div>
            </aside>
          </>
        )}

        <main className={`job-entrance-main ${useSidebarNav ? 'with-sidebar' : ''}`}>
          <h1 className="job-entrance-title" style={{ color: job.color }}>{job.label}</h1>

          {/* サブホットバー（選択中のアクションに subItems がある場合表示） */}
          {!useSidebarNav && Array.isArray(currentAction?.subItems) && currentAction.subItems.length > 0 && (
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

          {useSidebarNav && (
            <p className="job-entrance-dummy">{t('左のサイドバーから機能を選択してください。')}</p>
          )}

          {!useSidebarNav && !currentAction?.subItems && (
            <p className="job-entrance-dummy">{actions ? `${t('タブ:')} ${tabLabel}` : t('（ダミー画面）')}</p>
          )}
          <p style={{ marginTop: 16 }}><Link to="/">{t('Portal へ戻る')}</Link></p>
        </main>
      </div>
      {!useSidebarNav && actions && (
        <Hotbar actions={actions} active={tab} onChange={onHotbar} showFlowGuideButton={showFlowGuideButton} />
      )}
    </div>
  );
}
