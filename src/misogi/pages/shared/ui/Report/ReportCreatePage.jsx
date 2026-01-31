import React from 'react';
import { useParams } from 'react-router-dom';
import CleaningDayReportPage from './CleaningDayReportPage';
import ReportUnavailable from './ReportUnavailable';

/**
 * 報告画面の振り分け
 * 清掃 → 1日レポート（最大3店舗）。その他 → 準備中表示。
 */
export default function ReportCreatePage() {
  const { job: jobKey } = useParams();

  if (jobKey === 'cleaning') {
    return <CleaningDayReportPage />;
  }
  return <ReportUnavailable jobKey={jobKey} />;
}
