import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ThemeToggle from '../ThemeToggle/ThemeToggle';
import LanguageSwitcher from '../LanguageSwitcher/LanguageSwitcher';
import { useAuth } from '../../auth/useAuth';
import { ADMIN_HOTBAR } from '../../../admin/pages/admin-entrance-hotbar.config';
import './hamburger-menu.css';

/**
 * ジョブチェンジホットバー（各エントランスに必須）
 * 大前提: Portal=玄関（ジョブ選択）、エントランス=各部署の窓口。
 * 各部署のホットバーはエントランスになくてはならない。
 * 「管理」の遷移先はポータルではなく管理エントランス（/admin/entrance）。
 */
const MENU_LINKS = [
  { to: '/', label: 'Portal（トップ）', dept: 'ANY' },
  { to: '/jobs/sales/entrance', label: '営業 / コンシェルジュ', dept: 'SALES' },
  { to: '/jobs/cleaning/entrance', label: '清掃', dept: 'CLEANING' },
  { to: '/jobs/office/entrance', label: '事務', dept: 'OFFICE' },
  { to: '/jobs/dev/entrance', label: '開発', dept: 'ENGINEERING' },
  { to: '/admin/entrance', label: '管理', dept: 'ADMIN' },
  { to: '/admin', label: '管理 TOP', dept: 'ADMIN' },
  { to: '/admin/hr/attendance', label: 'HR Attendance', dept: 'ADMIN' },
  { to: '/sales/store/demo', label: '営業カルテ（店舗）', dept: 'SALES' },
  { to: '/flow-guide', label: '業務フロー', dept: 'ANY' },
];

function groupBy(items, getKey) {
  const map = new Map();
  (items || []).forEach((item) => {
    const key = String(getKey(item) || 'その他');
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  });
  return [...map.entries()].map(([groupLabel, rows]) => ({ groupLabel, rows }));
}

export default function HamburgerMenu() {
  const { isAuthenticated, logout, user, authz } = useAuth();
  const [open, setOpen] = useState(false);
  const [openSections, setOpenSections] = useState({});
  const location = useLocation();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    close();
  }, [location.pathname, close]);

  useEffect(() => {
    if (!open) return;
    const onEscape = (e) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [open, close]);

  const navigate = useNavigate();
  const handleAuthAction = () => {
    if (isAuthenticated) {
      logout();
    } else {
      navigate('/');
    }
    close();
  };

  const userName = user?.name || user?.displayName || user?.username || user?.email || (isAuthenticated ? 'ログイン済み' : '');
  const isAdminRoute = String(location?.pathname || '').startsWith('/admin');
  const isPathActive = useCallback((path) => {
    const p = String(path || '');
    if (!p) return false;
    return location.pathname === p || location.pathname.startsWith(`${p}/`);
  }, [location.pathname]);

  // 所属部署によるリンクのフィルタリング
  const filteredLinks = useMemo(() => MENU_LINKS.filter((link) => {
    if (link.dept === 'ANY') return true;

    const userDept = authz?.dept || '';

    // 特定の部署に所属している場合、管理関連以外の他部署リンクは出さない（adminでも適用）
    if (['SALES', 'CLEANING', 'ENGINEERING', 'OFFICE'].includes(userDept)) {
      if (link.dept !== 'ANY' && link.dept !== 'ADMIN' && link.dept !== userDept) {
        return false;
      }
    }

    // 管理者・開発者は原則全リンクOK（ただし上記部署フィルタがかかっていない場合）
    if (authz?.isAdmin || authz?.isDev) return true;

    if (link.dept === 'SALES') return userDept === 'SALES';
    if (link.dept === 'ENGINEERING') return userDept === 'ENGINEERING';
    if (link.dept === 'OFFICE' || link.dept === 'ADMIN') return ['OFFICE', 'ADMIN', 'ADMINISTRATION'].includes(userDept);
    if (link.dept === 'CLEANING') {
      return !['SALES', 'ENGINEERING', 'OFFICE', 'ADMIN', 'ADMINISTRATION'].includes(userDept);
    }
    return false;
  }), [authz?.dept, authz?.isAdmin, authz?.isDev]);

  const sidebarSections = useMemo(() => {
    if (isAdminRoute) {
      const adminSections = (ADMIN_HOTBAR || []).map((section) => ({
        id: `admin-${String(section?.id || '')}`,
        label: String(section?.label || ''),
        groups: groupBy(section?.subItems || [], (row) => row?.group || 'その他'),
      }));
      return adminSections;
    }

    return [
      {
        id: 'jobs',
        label: 'ジョブ切替',
        groups: [{ groupLabel: 'メニュー', rows: filteredLinks.map((row) => ({ id: row.to, label: row.label, to: row.to })) }],
      },
    ];
  }, [isAdminRoute, filteredLinks]);

  useEffect(() => {
    if (!sidebarSections.length) return;
    setOpenSections((prev) => {
      const next = {};
      sidebarSections.forEach((section, idx) => {
        const hasActive = section.groups.some((g) => g.rows.some((r) => isPathActive(r.path || r.to)));
        next[section.id] = Object.prototype.hasOwnProperty.call(prev, section.id)
          ? !!prev[section.id]
          : (hasActive || idx === 0);
      });
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      const unchanged = prevKeys.length === nextKeys.length
        && nextKeys.every((key) => prev[key] === next[key]);
      return unchanged ? prev : next;
    });
  }, [sidebarSections, isPathActive]);

  useEffect(() => {
    if (!sidebarSections.length) return;
    const activeSection = sidebarSections.find((section) =>
      section.groups.some((g) => g.rows.some((r) => isPathActive(r.path || r.to)))
    );
    if (!activeSection) return;
    setOpenSections((prev) => {
      if (prev[activeSection.id]) return prev;
      return { ...prev, [activeSection.id]: true };
    });
  }, [location.pathname, sidebarSections, isPathActive]);

  const onNavigate = (path) => {
    if (!path) return;
    navigate(path);
    close();
  };

  return (
    <>
      <button
        type="button"
        className="hamburger-menu-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="hamburger-menu-drawer"
        aria-label="メニューを開く"
      >
        <span className="hamburger-menu-icon" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>
      <div
        id="hamburger-menu-drawer"
        className={`hamburger-menu-backdrop ${open ? 'is-open' : ''}`}
        aria-hidden={!open}
        onClick={close}
      >
        <aside
          className="hamburger-menu-drawer"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="hamburger-menu-header">
            <span className="hamburger-menu-title">メニュー</span>
            <button
              type="button"
              className="hamburger-menu-close"
              onClick={close}
              aria-label="メニューを閉じる"
            >
              ×
            </button>
          </div>
          <nav className="hamburger-menu-sidebar" aria-label="サイドバー">
            {sidebarSections.map((section) => (
              <section key={section.id} className="hamburger-menu-sidebar-section">
                <button
                  type="button"
                  className={`hamburger-menu-sidebar-section-title ${openSections[section.id] ? 'open' : ''}`.trim()}
                  onClick={() => setOpenSections((prev) => ({ ...prev, [section.id]: !prev[section.id] }))}
                >
                  <span>{section.label}</span>
                  <span className="hamburger-menu-sidebar-section-icon">{openSections[section.id] ? '▾' : '▸'}</span>
                </button>
                {openSections[section.id] ? (
                  <div className="hamburger-menu-sidebar-groups">
                    {section.groups.map((group) => (
                      <div key={`${section.id}-${group.groupLabel}`} className="hamburger-menu-sidebar-group">
                        {group.groupLabel ? (
                          <p className="hamburger-menu-sidebar-group-label">{group.groupLabel}</p>
                        ) : null}
                        <div className="hamburger-menu-sidebar-links">
                          {group.rows.map((row) => {
                            const path = row.path || row.to;
                            const active = isPathActive(path);
                            return (
                              <button
                                key={String(row.id || path || row.label)}
                                type="button"
                                className={`hamburger-menu-sidebar-link ${active ? 'active' : ''}`.trim()}
                                onClick={() => onNavigate(path)}
                              >
                                {row.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            ))}
          </nav>
          <div className="hamburger-menu-footer">
            <div className="hamburger-menu-section">
              <div className="hamburger-menu-section-title">アカウント</div>
              <div className="hamburger-menu-section-content">
                {isAuthenticated && (
                  <div className="hamburger-menu-user-info">
                    {userName}
                  </div>
                )}
                <button
                  type="button"
                  className="hamburger-menu-button"
                  onClick={handleAuthAction}
                >
                  {isAuthenticated ? 'ログアウト' : 'ログイン'}
                </button>
              </div>
            </div>
            <div className="hamburger-menu-section" style={{ marginTop: '20px' }}>
              <div className="hamburger-menu-section-title">設定</div>
              <div className="hamburger-menu-section-content">
                <LanguageSwitcher />
                <ThemeToggle />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
