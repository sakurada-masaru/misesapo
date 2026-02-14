import React from 'react';
import Router from './router';
import AppErrorBoundary from '../shared/ui/ErrorBoundary/AppErrorBoundary';
import Breadcrumbs from '../shared/ui/Breadcrumbs/Breadcrumbs';

export default function App() {
  return (
    <div className="app-fullscreen">
      <AppErrorBoundary>
        <Breadcrumbs />
        <Router />
      </AppErrorBoundary>
    </div>
  );
}
