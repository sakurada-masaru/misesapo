import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import './breadcrumbs.css';
import HamburgerMenu from '../HamburgerMenu/HamburgerMenu';
import CommonHeaderChat from './CommonHeaderChat';

const DASHBOARD_EXPLORER_VISIBLE_STORAGE_KEY = 'misogi-v2-admin-dashboard-explorer-visible';
const DASHBOARD_CHAT_VISIBLE_STORAGE_KEY = 'misogi-v2-admin-dashboard-chat-visible';
const DASHBOARD_PANE_TOGGLE_EVENT = 'misogi-dashboard-pane-toggle';

function readStoredBoolean(key, fallback = true) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = String(window.localStorage.getItem(key) || '').trim().toLowerCase();
    if (!raw) return fallback;
    if (raw === '1' || raw === 'true') return true;
    if (raw === '0' || raw === 'false') return false;
    return fallback;
  } catch {
    return fallback;
  }
}

function isEntrancePath(pathname) {
  const p = String(pathname || '/');
  if (p === '/' || p === '/portal' || p === '/entrance') return true;
  if (p === '/admin/entrance') return true;
  if (p === '/admin/dashboard') return true;
  if (/^\/jobs\/[^/]+\/entrance$/.test(p)) return true;
  return false;
}

function isCleaningEntrancePath(pathname) {
  const p = String(pathname || '/');
  return p === '/jobs/cleaning/entrance' || p === '/jobs/cleaning/entrance/';
}

function isCleaningWorkerPath(pathname) {
  const p = String(pathname || '/');
  return /^\/jobs\/cleaning(?:\/|$)/.test(p);
}

function isAdminPath(pathname) {
  return String(pathname || '/').startsWith('/admin');
}

function isWorkerReportPath(pathname) {
  const p = String(pathname || '/');
  // 現場の報告画面は余計なUIを増やさない（AGENTS.md ルール優先）
  if (/^\/jobs\/[^/]+\/report$/.test(p)) return true;
  return false;
}

function isStandaloneCustomerMyPagePath(pathname) {
  const p = String(pathname || '/');
  return p === '/customer/mypage' || p === '/customer/mypage/';
}

function labelForPath(pathname) {
  const p = String(pathname || '/');

  // Admin
  if (p === '/admin') return '管理TOP';
  if (p === '/admin/kadai') return '課題リスト';
  if (p === '/admin/request-doc') return '依頼書作成';
  if (p === '/admin/houkoku') return '業務報告一覧';
  if (p.startsWith('/admin/houkoku/')) return '業務報告詳細';
  if (p === '/admin/yotei') return '予定';
  if (p === '/admin/cleaning-sales') return '清掃売上管理';
  if (p === '/admin/yasumi') return 'yasumi';
  if (p === '/admin/ugoki') return 'UGOKI';
  if (p === '/admin/yakusoku') return 'YAKUSOKU';
  if (p === '/admin/dashboard') return 'ダッシュボード';
  if (p === '/admin/filebox') return 'ファイルボックス';
  if (p === '/admin/torihikisaki-touroku') return '顧客登録';
  if (p === '/admin/torihikisaki-meibo') return '取引先名簿';
  if (p === '/admin/jinzai-meibo') return '人材名簿';
  if (p.startsWith('/admin/tenpo/')) return '店舗カルテ';
  if (p === '/admin/master/torihikisaki') return '取引先マスタ';
  if (p === '/admin/master/yagou') return '屋号マスタ';
  if (p === '/admin/master/tenpo') return '店舗マスタ';
  if (p === '/admin/master/souko') return '顧客ストレージ';
  if (p === '/admin/master/jinzai') return '人材マスタ';
  if (p === '/admin/master/jinzai-busho') return '人材部署';
  if (p === '/admin/master/jinzai-shokushu') return '人材職種';
  if (p === '/admin/master/service') return 'サービスマスタ';
  if (p === '/admin/master/keiyaku') return '契約マスタ';
  if (p === '/admin/master/zaiko') return '在庫管理DB';
  if (p === '/admin/master/zaiko-order') return '在庫発注フォーム';
  if (p === '/admin/tools/cleaning-houkoku') return '清掃レポート作成';
  if (p === '/admin/tools/cleaning-houkoku/list') return 'レポート一覧';

  // Jobs (v2)
  if (/^\/jobs\/[^/]+\/yotei$/.test(p)) return '予定';
  if (p === '/jobs/cleaning/mypage') return 'マイページ（売上）';
  if (p === '/customer/mypage') return 'お客様マイページ';

  // Sales / Office / Cleaning / Dev (minimal)
  if (p.startsWith('/sales/')) return '営業';
  if (p.startsWith('/office/')) return '事務';
  if (p.startsWith('/jobs/sales/')) return '営業';
  if (p.startsWith('/jobs/office/')) return '事務';
  if (p.startsWith('/jobs/cleaning/')) return '清掃';
  if (p.startsWith('/jobs/dev/')) return '開発';

  // Fallback: last segment
  const parts = p.split('/').filter(Boolean);
  return parts[parts.length - 1] || 'Page';
}

function crumbsForPath(pathname) {
  const p = String(pathname || '/');
  const crumbs = [{ to: '/', label: 'Portal' }];

  if (p.startsWith('/admin')) {
    crumbs.push({ to: '/admin/entrance', label: '管理' });
  } else if (p.startsWith('/sales')) {
    crumbs.push({ to: '/jobs/sales/entrance', label: '営業' });
  } else if (p.startsWith('/office')) {
    crumbs.push({ to: '/jobs/office/entrance', label: '事務' });
  } else if (p.startsWith('/jobs/sales')) {
    crumbs.push({ to: '/jobs/sales/entrance', label: '営業' });
  } else if (p.startsWith('/jobs/office')) {
    crumbs.push({ to: '/jobs/office/entrance', label: '事務' });
  } else if (p.startsWith('/jobs/cleaning')) {
    crumbs.push({ to: '/jobs/cleaning/entrance', label: '清掃' });
  } else if (p.startsWith('/jobs/dev')) {
    crumbs.push({ to: '/jobs/dev/entrance', label: '開発' });
  } else if (p.startsWith('/customer')) {
    crumbs.push({ to: '/customer/mypage', label: 'お客様' });
  }

  const currentLabel = labelForPath(p);
  crumbs.push({ to: p, label: currentLabel });

  // Remove consecutive duplicates by `to` (keep the last occurrence)
  const compact = [];
  for (const c of crumbs) {
    const prev = compact[compact.length - 1];
    if (prev && prev.to === c.to) {
      compact[compact.length - 1] = c;
    } else {
      compact.push(c);
    }
  }
  return compact;
}

export default function Breadcrumbs() {
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location?.pathname || '/';
  const hideStandaloneCustomerUi = isStandaloneCustomerMyPagePath(pathname);

  const hidden = isEntrancePath(pathname) || isWorkerReportPath(pathname);
  const hideCleaningHeader = isCleaningEntrancePath(pathname);
  const hideAllCleaningWorkerHeader = isCleaningWorkerPath(pathname);
  const isAdmin = isAdminPath(pathname);
  const isAdminDashboard = pathname === '/admin/dashboard';
  const crumbs = useMemo(() => crumbsForPath(pathname), [pathname]);
  const [dashboardExplorerVisible, setDashboardExplorerVisible] = useState(() =>
    readStoredBoolean(DASHBOARD_EXPLORER_VISIBLE_STORAGE_KEY, true)
  );
  const [dashboardChatVisible, setDashboardChatVisible] = useState(() =>
    readStoredBoolean(DASHBOARD_CHAT_VISIBLE_STORAGE_KEY, true)
  );

  useEffect(() => {
    if (!isAdminDashboard) return;
    setDashboardExplorerVisible(readStoredBoolean(DASHBOARD_EXPLORER_VISIBLE_STORAGE_KEY, true));
    setDashboardChatVisible(readStoredBoolean(DASHBOARD_CHAT_VISIBLE_STORAGE_KEY, true));
  }, [isAdminDashboard, pathname]);

  if (hideStandaloneCustomerUi || hideCleaningHeader || hideAllCleaningWorkerHeader) {
    return null;
  }

  if (isAdmin && hidden && !isAdminDashboard) {
    return null;
  }

  const onBack = () => {
    if (typeof window !== 'undefined' && window.history && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/');
  };

  if (isAdmin) {
    const emitPaneToggle = (pane, visible) => {
      if (typeof window === 'undefined') return;
      try {
        if (pane === 'explorer') {
          window.localStorage.setItem(DASHBOARD_EXPLORER_VISIBLE_STORAGE_KEY, visible ? '1' : '0');
        } else if (pane === 'chat') {
          window.localStorage.setItem(DASHBOARD_CHAT_VISIBLE_STORAGE_KEY, visible ? '1' : '0');
        }
      } catch {
        // ignore
      }
      window.dispatchEvent(new CustomEvent(DASHBOARD_PANE_TOGGLE_EVENT, { detail: { pane, visible } }));
    };
    return (
      <nav className={`breadcrumbs breadcrumbs-admin ${hidden ? 'breadcrumbs-admin-hidden' : ''}`.trim()} aria-label="パンくず">
        <div className="breadcrumbs-admin-left">
          <HamburgerMenu />
        </div>
        {!hidden ? (
          <>
            <div className="breadcrumbs-main">
              {crumbs.map((c, idx) => {
                const isLast = idx === crumbs.length - 1;
                return (
                  <span key={`${c.to}-${idx}`} className="breadcrumbs-item">
                    {isLast ? (
                      <span className="breadcrumbs-current">{c.label}</span>
                    ) : (
                      <Link className="breadcrumbs-link" to={c.to}>{c.label}</Link>
                    )}
                    {!isLast ? <span className="breadcrumbs-sep" aria-hidden="true">/</span> : null}
                  </span>
                );
              })}
            </div>
          </>
        ) : (
          <div className="breadcrumbs-main breadcrumbs-main-empty" />
        )}
        <div className="breadcrumbs-controls-wrap">
          {isAdminDashboard ? (
            <div className="breadcrumbs-pane-controls" aria-label="ペイン表示設定">
              <button
                type="button"
                className={`breadcrumbs-pane-btn ${dashboardExplorerVisible ? 'is-on' : ''}`}
                onClick={() => {
                  const next = !dashboardExplorerVisible;
                  setDashboardExplorerVisible(next);
                  emitPaneToggle('explorer', next);
                }}
              >
                {dashboardExplorerVisible ? '左ON' : '左OFF'}
              </button>
              <button
                type="button"
                className={`breadcrumbs-pane-btn ${dashboardChatVisible ? 'is-on' : ''}`}
                onClick={() => {
                  const next = !dashboardChatVisible;
                  setDashboardChatVisible(next);
                  emitPaneToggle('chat', next);
                }}
              >
                {dashboardChatVisible ? '右ON' : '右OFF'}
              </button>
            </div>
          ) : null}
          <CommonHeaderChat />
        </div>
      </nav>
    );
  }

  if (hidden) {
    return (
      <nav className="breadcrumbs breadcrumbs-lang-only" aria-label="ヘッダーメニュー">
        <button type="button" className="breadcrumbs-back" onClick={onBack} aria-label="一つ前の画面に戻る">
          ← 戻る
        </button>
        <div className="breadcrumbs-lang-wrap">
          <CommonHeaderChat />
          <HamburgerMenu />
        </div>
      </nav>
    );
  }

  return (
    <nav className="breadcrumbs" aria-label="パンくず">
      <button type="button" className="breadcrumbs-back" onClick={onBack} aria-label="一つ前の画面に戻る">
        ← 戻る
      </button>
      <div className="breadcrumbs-main">
        {crumbs.map((c, idx) => {
          const isLast = idx === crumbs.length - 1;
          return (
            <span key={`${c.to}-${idx}`} className="breadcrumbs-item">
              {isLast ? (
                <span className="breadcrumbs-current">{c.label}</span>
              ) : (
                <Link className="breadcrumbs-link" to={c.to}>{c.label}</Link>
              )}
              {!isLast ? <span className="breadcrumbs-sep" aria-hidden="true">/</span> : null}
            </span>
          );
        })}
      </div>
      <div className="breadcrumbs-controls-wrap">
        <CommonHeaderChat />
        <HamburgerMenu />
      </div>
    </nav>
  );
}
