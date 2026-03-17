import React from 'react';
import { useLocation } from 'react-router-dom';
import Router from './router';
import AppErrorBoundary from '../shared/ui/ErrorBoundary/AppErrorBoundary';
import Breadcrumbs from '../shared/ui/Breadcrumbs/Breadcrumbs';
import CleaningWorkerChrome from '../shared/ui/Cleaning/CleaningWorkerChrome';

function isCleaningWorkerPath(pathname) {
  const p = String(pathname || '/');
  return /^\/jobs\/cleaning(?:\/|$)/.test(p);
}

function shouldShowCleaningNavHotbar(pathname) {
  const p = String(pathname || '/');
  if (!isCleaningWorkerPath(p)) return false;
  if (/^\/jobs\/cleaning\/entrance\/?$/.test(p)) return false;
  return true;
}

function isStandaloneCustomerMyPagePath(pathname) {
  const p = String(pathname || '/');
  return /^\/customer\/mypage(?:\/|$)/.test(p);
}

function isAdminPath(pathname) {
  const p = String(pathname || '/');
  return /^\/admin(?:\/|$)/.test(p);
}

export default function App() {
  const location = useLocation();
  const pathname = location?.pathname || '/';
  const onCleaningWorkerPath = isCleaningWorkerPath(pathname);
  const showCleaningNavHotbar = shouldShowCleaningNavHotbar(pathname);
  const hideSharedHeader = isStandaloneCustomerMyPagePath(pathname);
  const onAdminPath = isAdminPath(pathname);

  React.useEffect(() => {
    if (!onAdminPath || typeof document === 'undefined') return undefined;
    const prevBodyBg = document.body.style.backgroundColor;
    const prevHtmlBg = document.documentElement.style.backgroundColor;
    document.body.style.backgroundColor = '#FCF9EA';
    document.documentElement.style.backgroundColor = '#FCF9EA';
    return () => {
      document.body.style.backgroundColor = prevBodyBg;
      document.documentElement.style.backgroundColor = prevHtmlBg;
    };
  }, [onAdminPath]);

  return (
    <div
      className={[
        'app-fullscreen',
        onCleaningWorkerPath ? 'cleaning-worker-app' : '',
        showCleaningNavHotbar ? 'with-cleaning-nav-hotbar' : '',
        onAdminPath ? 'admin-management-app' : '',
        hideSharedHeader ? 'standalone-page' : '',
      ].filter(Boolean).join(' ')}
    >
      <AppErrorBoundary>
        {!hideSharedHeader ? <Breadcrumbs /> : null}
        <Router />
        {onCleaningWorkerPath ? <CleaningWorkerChrome showNavHotbar={showCleaningNavHotbar} /> : null}
      </AppErrorBoundary>
    </div>
  );
}
