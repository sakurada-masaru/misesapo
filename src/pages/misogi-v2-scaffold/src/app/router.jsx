import React, { Suspense } from 'react';
import { Routes, Route, useParams, Navigate } from 'react-router-dom';
import Portal from '../portal/pages/Portal';
import AdminHome from '../admin/pages/Home';
import AdminEntrancePage from '../admin/pages/AdminEntrancePage';
import AdminWorkReportsPage from '../admin/pages/AdminWorkReportsPage';
import HrAttendance from '../admin/pages/hr/Attendance';
import ReportCreatePage from '../shared/ui/Report/ReportCreatePage';
import SalesStoreKartePage from '../shared/ui/Sales/SalesStoreKartePage';
import SalesDayReportPage from '../shared/ui/Sales/SalesDayReportPage';
import SalesCustomersPage from '../shared/ui/Sales/SalesCustomersPage';
import SalesRegisterPage from '../shared/ui/Sales/SalesRegisterPage';
import SalesKarteListPage from '../shared/ui/Sales/SalesKarteListPage';

/** import.meta.glob で jobs 配下の entrance/Page.jsx を動的解決 */
const pageModules = import.meta.glob('../jobs/*/entrance/Page.jsx');
const lazyPages = {};
for (const path of Object.keys(pageModules)) {
  const m = path.match(/\.\.\/jobs\/([^/]+)\/entrance\/Page\.jsx/);
  if (m) lazyPages[m[1]] = React.lazy(pageModules[path]);
}

/** /jobs/:job/entrance で job から動的に Page を解決。存在しない job は 404 */
function JobEntranceRoute() {
  const { job } = useParams();
  const Page = job ? lazyPages[job] : null;
  if (!Page) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <p>無効なジョブです。</p>
        <a href="/v2/portal">Portal へ戻る</a>
      </div>
    );
  }
  return (
    <Suspense fallback={<div style={{ padding: 24, textAlign: 'center' }}>Loading...</div>}>
      <Page />
    </Suspense>
  );
}

/**
 * ルーティング定義（basename /v2 → 実際のURLは /v2/admin/work-reports 等）
 * ボタン遷移先と完全一致させる（末尾スラッシュなし）
 */
export default function Router() {
  return (
    <Routes>
      <Route path="/" element={<div>Welcome to MISOGI V2</div>} />
      <Route path="/portal" element={<Portal />} />
      <Route path="/entrance" element={<Navigate to="/portal" replace />} />
      <Route path="/jobs/:job/entrance" element={<JobEntranceRoute />} />
      <Route path="/jobs/:job/report" element={<ReportCreatePage />} />
      <Route path="/admin" element={<AdminHome />} />
      <Route path="/admin/entrance" element={<AdminEntrancePage />} />
      {/* /v2/admin/work-reports で確実に表示 */}
      <Route path="/admin/work-reports" element={<AdminWorkReportsPage />} />
      <Route path="/admin/hr/attendance" element={<HrAttendance />} />
      <Route path="/sales/store/:storeKey" element={<SalesStoreKartePage />} />
      <Route path="/sales/report-day" element={<SalesDayReportPage />} />
      <Route path="/sales/customers" element={<SalesCustomersPage />} />
      <Route path="/sales/register" element={<SalesRegisterPage />} />
      <Route path="/sales/kartes" element={<SalesKarteListPage />} />
    </Routes>
  );
}
