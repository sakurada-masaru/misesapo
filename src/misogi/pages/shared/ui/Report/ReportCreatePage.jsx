import React from 'react';
import { useLocation, useParams } from 'react-router-dom';
import CleaningDayReportPage from './CleaningDayReportPage';
import CleaningSheets3UploadPage from './CleaningSheets3UploadPage';
import ReportUnavailable from './ReportUnavailable';

/**
 * 報告画面の振り分け
 * 清掃 → 1日レポート（最大3店舗）。その他 → 準備中表示。
 */
export default function ReportCreatePage() {
  const { job: jobKey } = useParams();
  const loc = useLocation();
  const sp = new URLSearchParams(loc.search || '');
  const legacy = sp.get('legacy') === '1';

  if (jobKey === 'cleaning') {
    // New default: upload-only (3 sheets) to minimize on-site input and avoid narrative.
    // Legacy: keep old page accessible for admins/dev while transition is ongoing.
    return legacy ? <CleaningDayReportPage /> : <CleaningSheets3UploadPage />;
  }
  return <ReportUnavailable jobKey={jobKey} />;
}
