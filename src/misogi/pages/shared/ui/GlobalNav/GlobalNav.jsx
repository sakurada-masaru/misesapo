import React, { useCallback, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import HamburgerMenu from '../HamburgerMenu/HamburgerMenu';
import './global-nav.css';

function safeHistoryBackAvailable() {
  try {
    return typeof window !== 'undefined' && window.history && window.history.length > 1;
  } catch {
    return false;
  }
}

function navContextFromPath(pathname) {
  const p = String(pathname || '/');
  if (p.startsWith('/admin')) return { key: 'admin', label: '管理トップ', to: '/admin/entrance' };
  if (p.startsWith('/sales')) return { key: 'sales', label: '営業', to: '/jobs/sales/entrance' };
  if (p.startsWith('/office')) return { key: 'office', label: '事務', to: '/jobs/office/entrance' };
  if (p.startsWith('/jobs/cleaning')) return { key: 'cleaning', label: '清掃', to: '/jobs/cleaning/entrance' };
  if (p.startsWith('/jobs/dev')) return { key: 'dev', label: '開発', to: '/jobs/dev/entrance' };
  if (p.startsWith('/jobs/sales')) return { key: 'sales', label: '営業', to: '/jobs/sales/entrance' };
  if (p.startsWith('/jobs/office')) return { key: 'office', label: '事務', to: '/jobs/office/entrance' };
  if (p.startsWith('/jobs/')) return { key: 'portal', label: 'Portal', to: '/' };
  return { key: 'portal', label: 'Portal', to: '/' };
}

export default function GlobalNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const ctx = useMemo(() => navContextFromPath(location?.pathname), [location?.pathname]);

  const fallbackTo = useMemo(() => {
    // If back history is not available, go to the current context top.
    return ctx?.to || '/';
  }, [ctx?.to]);

  const onBack = useCallback(() => {
    if (safeHistoryBackAvailable()) {
      navigate(-1);
      return;
    }
    navigate(fallbackTo);
  }, [navigate, fallbackTo]);

  // On Portal itself, keep the chrome minimal (no need to overlay).
  if ((location?.pathname || '/') === '/') return null;

  return (
    <div className="global-nav" role="navigation" aria-label="共通ナビ">
      <button type="button" className="global-nav-btn" onClick={onBack} title="ひとつ前のページへ戻る">
        <span aria-hidden="true">←</span>
        <span className="global-nav-label">戻る</span>
      </button>

      <Link to={ctx.to} className="global-nav-link" title={`${ctx.label}へ`}>
        <span aria-hidden="true">⌂</span>
        <span className="global-nav-label">{ctx.label}</span>
      </Link>

      <div className="global-nav-menu">
        <HamburgerMenu />
      </div>
    </div>
  );
}

