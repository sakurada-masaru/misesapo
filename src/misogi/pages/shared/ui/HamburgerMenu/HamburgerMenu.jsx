import React, { useState, useCallback, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import ThemeToggle from '../ThemeToggle/ThemeToggle';
import { useAuth } from '../../auth/useAuth';
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
];

export default function HamburgerMenu() {
  const { isAuthenticated, login, logout, user, authz } = useAuth();
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

  // 所属部署によるリンクのフィルタリング
  const filteredLinks = MENU_LINKS.filter(link => {
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
  });

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
            {filteredLinks.map(({ to, label }) => (
              <Link key={to} to={to} className="hamburger-menu-link" onClick={close}>
                {label}
              </Link>
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
                <ThemeToggle />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
