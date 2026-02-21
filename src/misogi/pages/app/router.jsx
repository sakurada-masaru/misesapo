import React, { Suspense } from 'react';
import { Routes, Route, useParams, Navigate, Link } from 'react-router-dom';
import { useAuth } from '../shared/auth/useAuth';

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
import AdminKadaiListPage from '../admin/pages/AdminKadaiListPage';
import AdminAdminLogPage from '../admin/pages/AdminAdminLogPage';
import AdminMasterTorihikisakiPage from '../admin/pages/AdminMasterTorihikisakiPage';
import AdminMasterYagouPage from '../admin/pages/AdminMasterYagouPage';
import AdminMasterTenpoPage from '../admin/pages/AdminMasterTenpoPage';
import AdminMasterSoukoPage from '../admin/pages/AdminMasterSoukoPage';
import AdminMasterJinzaiPage from '../admin/pages/AdminMasterJinzaiPage';
import AdminMasterJinzaiBushoPage from '../admin/pages/AdminMasterJinzaiBushoPage';
import AdminMasterJinzaiShokushuPage from '../admin/pages/AdminMasterJinzaiShokushuPage';
import AdminMasterServicePage from '../admin/pages/AdminMasterServicePage';
import AdminMasterZaikoPage from '../admin/pages/AdminMasterZaikoPage';
import AdminZaikoOrderPage from '../admin/pages/AdminZaikoOrderPage';
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
import MyYoteiListPage from '../shared/ui/Yotei/MyYoteiListPage';
import CustomerOnboardingPage from '../registration/CustomerOnboardingPage';
import FlowGuideScreen from '../FlowGuideScreen';

function readCurrentTokenClaims() {
  try {
    const token =
      localStorage.getItem('idToken') ||
      localStorage.getItem('cognito_id_token') ||
      localStorage.getItem('id_token') ||
      localStorage.getItem('accessToken') ||
      localStorage.getItem('cognito_access_token') ||
      localStorage.getItem('token') ||
      '';
    const parts = String(token || '').split('.');
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function hasAdminClaim(claims) {
  if (!claims || typeof claims !== 'object') return false;
  const normalize = (v) => String(v || '').trim().toLowerCase();
  const listify = (v) => (Array.isArray(v) ? v : (v == null ? [] : [v]));
  const groups = listify(claims['cognito:groups']).map(normalize);
  const role = normalize(claims.role || claims['custom:role']);
  const roles = listify(claims.roles).map(normalize);
  return groups.includes('admin') || role === 'admin' || roles.includes('admin');
}

function AdminMasterOnly({ children }) {
  const { authz, user } = useAuth();
  const claims = readCurrentTokenClaims();
  const roleList = (
    Array.isArray(user?.roles) ? user.roles : (user?.role ? [user.role] : [])
  ).map((r) => String(r || '').trim().toLowerCase());
  const ok = !!authz?.isAdmin || hasAdminClaim(claims) || roleList.includes('admin');
  if (ok) return children;
  return (
    <div style={{ padding: 24, maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.2rem', marginBottom: 12 }}>アクセス制限</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 16 }}>
        このページは管理者のみ表示可能です。
      </p>
      <p><Link to="/admin">管理トップへ戻る</Link></p>
    </div>
  );
}

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
      <Route path="/jobs/:job/yotei" element={<MyYoteiListPage />} />
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
      <Route path="/admin/torihikisaki-meibo" element={<AdminMasterOnly><AdminTorihikisakiMeiboPage /></AdminMasterOnly>} />
      <Route path="/admin/jinzai-meibo" element={<AdminMasterOnly><AdminJinzaiMeiboPage /></AdminMasterOnly>} />
      <Route path="/admin/tenpo/:tenpoId" element={<AdminMasterOnly><AdminTenpoKartePage /></AdminMasterOnly>} />
      <Route path="/admin/master/torihikisaki" element={<AdminMasterOnly><AdminMasterTorihikisakiPage /></AdminMasterOnly>} />
      <Route path="/admin/master/yagou" element={<AdminMasterOnly><AdminMasterYagouPage /></AdminMasterOnly>} />
      <Route path="/admin/master/tenpo" element={<AdminMasterOnly><AdminMasterTenpoPage /></AdminMasterOnly>} />
      <Route path="/admin/master/souko" element={<AdminMasterOnly><AdminMasterSoukoPage /></AdminMasterOnly>} />
      <Route path="/admin/master/jinzai" element={<AdminMasterOnly><AdminMasterJinzaiPage /></AdminMasterOnly>} />
      <Route path="/admin/master/jinzai-busho" element={<AdminMasterOnly><AdminMasterJinzaiBushoPage /></AdminMasterOnly>} />
      <Route path="/admin/master/jinzai-shokushu" element={<AdminMasterOnly><AdminMasterJinzaiShokushuPage /></AdminMasterOnly>} />
      <Route path="/admin/master/service" element={<AdminMasterOnly><AdminMasterServicePage /></AdminMasterOnly>} />
      <Route path="/admin/master/zaiko" element={<AdminMasterOnly><AdminMasterZaikoPage /></AdminMasterOnly>} />
      <Route path="/admin/master/zaiko-order" element={<AdminMasterOnly><AdminZaikoOrderPage /></AdminMasterOnly>} />
      <Route path="/admin/houkoku" element={<AdminHoukokuListPage />} />
      <Route path="/admin/houkoku/:reportId" element={<AdminHoukokuDetailPage />} />
      <Route path="/admin/kadai" element={<AdminKadaiListPage />} />
      <Route path="/admin/admin-log" element={<AdminAdminLogPage />} />
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
