import React, { useState, useCallback, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ThemeToggle from '../ThemeToggle/ThemeToggle';
import './hamburger-menu.css';

/**
 * ジョブチェンジホットバー（各エントランスに必須）
 * 大前提: Portal=玄関（ジョブ選択）、エントランス=各部署の窓口。
 * 各部署のホットバーはエントランスになくてはならない。
 * 「管理」の遷移先はポータルではなく管理エントランス（/admin/entrance）。
 */
const MENU_LINKS = [
  { to: '/', label: 'Portal（トップ）' },
  { to: '/jobs/sales/entrance', label: '営業' },
  { to: '/jobs/cleaning/entrance', label: '清掃' },
  { to: '/jobs/office/entrance', label: '事務' },
  { to: '/jobs/dev/entrance', label: '開発' },
  { to: '/admin/entrance', label: '管理' }, // 遷移先は管理エントランス（ポータルではない）
  { to: '/admin', label: '管理 TOP' },
  { to: '/admin/hr/attendance', label: 'HR Attendance' },
  { to: '/sales/store/demo', label: '営業カルテ（店舗）' },
];

export default function HamburgerMenu() {
  const [open, setOpen] = useState(false);
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
          <nav className="hamburger-menu-nav">
            {MENU_LINKS.map(({ to, label }) => (
              <Link key={to} to={to} className="hamburger-menu-link" onClick={close}>
                {label}
              </Link>
            ))}
          </nav>
          <div className="hamburger-menu-footer">
            <div className="hamburger-menu-section">
              <div className="hamburger-menu-section-title">設定</div>
              <div className="hamburger-menu-section-content">
                <ThemeToggle />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
