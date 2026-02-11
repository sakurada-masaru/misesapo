import React, { Suspense } from 'react';
import { Routes, Route, useParams, Navigate, Link } from 'react-router-dom';

/** /report/* は廃止。社内は /office/work-reports/:reportId を使用 */
function ReportLegacyRedirect() {
  return (
    <div style={{ padding: 24, maxWidth: 560, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.25rem', marginBottom: 16 }}>業務報告の閲覧</h1>
      <p style={{ color: 'var(--muted)' }}>このURLは廃止されました。社内ではログイン後、業務報告（管理）から個別ページを開いてください。</p>
      <p><Link to="/admin/houkoku">報告一覧へ</Link></p>
    </div>
  );
}
import Portal from '../portal/pages/Portal';
import AdminHome from '../admin/pages/Home';
import AdminEntrancePage from '../admin/pages/AdminEntrancePage';
import AdminCleaningReportsPage from '../admin/pages/AdminCleaningReportsPage';
import AdminScheduleTimelinePage from '../admin/pages/AdminScheduleTimelinePage';
import AdminUgokiDashboardPage from '../admin/pages/AdminUgokiDashboardPage';
import AdminYoteiTimelinePage from '../admin/pages/AdminYoteiTimelinePage';
import AdminYakusokuPage from '../admin/pages/AdminYakusokuPage';
import AdminReportNewPage from '../admin/pages/AdminReportNewPage';
import AdminHoukokuListPage from '../admin/pages/AdminHoukokuListPage';
import AdminHoukokuDetailPage from '../admin/pages/AdminHoukokuDetailPage';
import AdminMasterTorihikisakiPage from '../admin/pages/AdminMasterTorihikisakiPage';
import AdminMasterYagouPage from '../admin/pages/AdminMasterYagouPage';
import AdminMasterTenpoPage from '../admin/pages/AdminMasterTenpoPage';
import AdminMasterSoukoPage from '../admin/pages/AdminMasterSoukoPage';
import AdminMasterJinzaiPage from '../admin/pages/AdminMasterJinzaiPage';
import AdminMasterJinzaiBushoPage from '../admin/pages/AdminMasterJinzaiBushoPage';
import AdminMasterJinzaiShokushuPage from '../admin/pages/AdminMasterJinzaiShokushuPage';
import AdminMasterServicePage from '../admin/pages/AdminMasterServicePage';
import AdminTorihikisakiMeiboPage from '../admin/pages/AdminTorihikisakiMeiboPage';
import AdminJinzaiMeiboPage from '../admin/pages/AdminJinzaiMeiboPage';
import AdminTenpoKartePage from '../admin/pages/AdminTenpoKartePage';
import AdminTorihikisakiTourokuPage from '../admin/pages/AdminTorihikisakiTourokuPage';
import HrAttendance from '../admin/pages/hr/Attendance';
import ReportCreatePage from '../shared/ui/Report/ReportCreatePage';
import SalesStoreKartePage from '../shared/ui/Sales/SalesStoreKartePage';
import SalesDayReportPage from '../shared/ui/Sales/SalesDayReportPage';
import OfficeWorkReportDetailPage from '../office/OfficeWorkReportDetailPage';
import OfficePayrollMonthPage from '../office/OfficePayrollMonthPage';
import SalesCustomersPage from '../shared/ui/Sales/SalesCustomersPage';
import SalesRegisterPage from '../shared/ui/Sales/SalesRegisterPage';
import SalesKarteListPage from '../shared/ui/Sales/SalesKarteListPage';
import SalesClientNewPage from '../jobs/sales/clients/SalesClientNewPage';
import SalesClientListPage from '../jobs/sales/clients/SalesClientListPage';
import SalesLeadsPage from '../shared/ui/Sales/SalesLeadsPage';
import SalesLeadNewPage from '../shared/ui/Sales/SalesLeadNewPage';
import SalesLeadDetailPage from '../shared/ui/Sales/SalesLeadDetailPage';
import SalesSchedulePage from '../shared/ui/Sales/SalesSchedulePage';
import CleanerSchedulePage from '../jobs/cleaning/pages/CleanerSchedulePage';
import CleanerClientListPage from '../jobs/cleaning/pages/CleanerClientListPage';
import CleanerClientKartePage from '../jobs/cleaning/pages/CleanerClientKartePage';
import CustomerOnboardingPage from '../registration/CustomerOnboardingPage';
import FlowGuideScreen from '../FlowGuideScreen';

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
        <Link to="/">Portal へ戻る</Link>
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
 * ルーティング定義（basename /misogi）
 * ボタン遷移先と完全一致させる（末尾スラッシュなし）
 */
export default function Router() {
  return (
    <Routes>
      <Route path="/" element={<Portal />} />
      <Route path="/portal" element={<Navigate to="/" replace />} />
      <Route path="/entrance" element={<Navigate to="/" replace />} />
      <Route path="/jobs/:job/entrance" element={<JobEntranceRoute />} />
      <Route path="/jobs/:job/report" element={<ReportCreatePage />} />
      <Route path="/admin" element={<AdminHome />} />
      <Route path="/admin/entrance" element={<AdminEntrancePage />} />
      <Route path="/admin/cleaning-reports" element={<AdminCleaningReportsPage />} />
      <Route path="/admin/reports/new" element={<AdminReportNewPage />} />
      <Route path="/houkoku" element={<AdminReportNewPage />} />
      <Route path="/admin/schedule" element={<AdminScheduleTimelinePage />} />
      <Route path="/admin/yotei" element={<AdminYoteiTimelinePage />} />
      <Route path="/admin/yakusoku" element={<AdminYakusokuPage />} />
      <Route path="/admin/ugoki" element={<AdminUgokiDashboardPage />} />
      <Route path="/admin/torihikisaki-touroku" element={<AdminTorihikisakiTourokuPage />} />
      <Route path="/admin/torihikisaki-meibo" element={<AdminTorihikisakiMeiboPage />} />
      <Route path="/admin/jinzai-meibo" element={<AdminJinzaiMeiboPage />} />
      <Route path="/admin/tenpo/:tenpoId" element={<AdminTenpoKartePage />} />
      <Route path="/admin/master/torihikisaki" element={<AdminMasterTorihikisakiPage />} />
      <Route path="/admin/master/yagou" element={<AdminMasterYagouPage />} />
      <Route path="/admin/master/tenpo" element={<AdminMasterTenpoPage />} />
      <Route path="/admin/master/souko" element={<AdminMasterSoukoPage />} />
      <Route path="/admin/master/jinzai" element={<AdminMasterJinzaiPage />} />
      <Route path="/admin/master/jinzai-busho" element={<AdminMasterJinzaiBushoPage />} />
      <Route path="/admin/master/jinzai-shokushu" element={<AdminMasterJinzaiShokushuPage />} />
      <Route path="/admin/master/service" element={<AdminMasterServicePage />} />
      <Route path="/admin/houkoku" element={<AdminHoukokuListPage />} />
      <Route path="/admin/houkoku/:reportId" element={<AdminHoukokuDetailPage />} />
      <Route path="/office/work-reports/:reportId" element={<OfficeWorkReportDetailPage />} />
      <Route path="/sales/work-reports/:reportId" element={<OfficeWorkReportDetailPage />} />
      <Route path="/office/payroll/:userId/:yyyyMm" element={<OfficePayrollMonthPage />} />
      {/* 廃止: 旧 /report/:shareToken。参照が残っている環境でクラッシュしないようフォールバック */}
      <Route path="/report/*" element={<ReportLegacyRedirect />} />
      <Route path="/admin/hr/attendance" element={<HrAttendance />} />
      <Route path="/sales/store/:storeKey" element={<SalesStoreKartePage />} />
      <Route path="/sales/report-day" element={<SalesDayReportPage />} />
      <Route path="/sales/customers" element={<SalesCustomersPage />} />
      <Route path="/sales/clients/list" element={<SalesClientListPage />} />
      <Route path="/sales/register" element={<SalesRegisterPage />} />
      <Route path="/sales/clients/new" element={<SalesClientNewPage />} />
      <Route path="/sales/kartes" element={<SalesKarteListPage />} />
      <Route path="/sales/leads" element={<SalesLeadsPage />} />
      <Route path="/sales/leads/new" element={<SalesLeadNewPage />} />
      <Route path="/sales/leads/:leadId" element={<SalesLeadDetailPage />} />
      <Route path="/sales/schedule" element={<SalesSchedulePage />} />
      <Route path="/jobs/cleaning/schedule" element={<CleanerSchedulePage />} />
      <Route path="/jobs/cleaning/clients/list" element={<CleanerClientListPage />} />
      <Route path="/jobs/cleaning/clients/:storeId" element={<CleanerClientKartePage />} />
      <Route path="/registration/onboarding/:storeId" element={<CustomerOnboardingPage />} />
      <Route path="/flow-guide" element={<FlowGuideScreen />} />
    </Routes>
  );
}
