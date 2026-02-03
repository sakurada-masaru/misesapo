import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import Router from './router';
import HamburgerMenu from '../shared/ui/HamburgerMenu/HamburgerMenu';
import { GlobalFlashTransition } from '../shared/ui/ReportTransition/reportTransition';

/** ヘッダーなし・フルスクリーンにするパス（トップ＝Portal / 全ジョブエントランス・報告・営業日報・顧客登録・営業カルテ・管理エントランス・業務報告管理） */
function isFullscreenPath(pathname) {
  if (pathname === '/' || pathname === '/portal') return true;
  if (/^\/jobs\/[^/]+\/entrance$/.test(pathname)) return true;
  if (/^\/jobs\/[^/]+\/report$/.test(pathname)) return true;
  if (pathname === '/sales/report-day') return true;
  if (pathname === '/sales/customers') return true;
  if (pathname === '/sales/clients/list') return true;
  if (pathname === '/sales/clients/new') return true;
  if (pathname === '/sales/kartes') return true;
  if (/^\/sales\/store\/[^/]+$/.test(pathname)) return true;
  if (pathname === '/sales/leads') return true;
  if (pathname === '/sales/leads/new') return true;
  if (/^\/sales\/leads\/[^/]+$/.test(pathname)) return true;
  if (pathname === '/sales/schedule') return true;
  if (pathname === '/office/clients/list') return true;
  if (pathname === '/office/clients/new') return true;
  if (pathname.startsWith('/office/clients/') && pathname !== '/office/clients/list' && pathname !== '/office/clients/new') return true;
  if (pathname === '/admin/entrance') return true;
  if (pathname === '/admin/work-reports') return true;
  if (pathname === '/admin/schedule') return true;
  if (pathname === '/jobs/cleaning/schedule') return true;
  if (pathname.startsWith('/office/payroll/')) return true;
  if (pathname.startsWith('/office/work-reports/')) return true;
  if (pathname.startsWith('/sales/work-reports/')) return true;
  return false;
}

export default function App() {
  const location = useLocation();
  const fullscreen = isFullscreenPath(location.pathname);

  return (
    <>
      <HamburgerMenu />
      <GlobalFlashTransition />
      {fullscreen ? (
        <div className="app-fullscreen">
          <Router />
        </div>
      ) : (
        <div style={{ padding: 16 }}>
          <h1>MISOGI V2</h1>
          <nav style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <Link to="/">Portal（トップ）</Link>
            <Link to="/jobs/sales/entrance">営業 Entrance</Link>
            <Link to="/jobs/cleaning/entrance">清掃 Entrance</Link>
            <Link to="/admin/entrance">管理</Link>
            <Link to="/admin">管理 TOP</Link>
            <Link to="/admin/hr/attendance">HR Attendance</Link>
            <Link to="/sales/store/demo">営業カルテ（店舗）</Link>
          </nav>
          <Router />
        </div>
      )}
    </>
  );
}
