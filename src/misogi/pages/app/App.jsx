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
  if (/^\/jobs\/cleaning\/(?:houkoku|report)(?:\/|$)/.test(p)) return false;
  return true;
}

function isStandaloneCustomerMyPagePath(pathname) {
  const p = String(pathname || '/');
  return /^\/customer\/mypage(?:\/|$)/.test(p);
}

export default function App() {
  const location = useLocation();
  const pathname = location?.pathname || '/';
  const onCleaningWorkerPath = isCleaningWorkerPath(pathname);
  const showCleaningNavHotbar = shouldShowCleaningNavHotbar(pathname);
  const hideSharedHeader = isStandaloneCustomerMyPagePath(pathname);
  return (
    <div
      className={[
        'app-fullscreen',
        onCleaningWorkerPath ? 'cleaning-worker-app' : '',
        showCleaningNavHotbar ? 'with-cleaning-nav-hotbar' : '',
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
