import React from 'react';
import { useParams } from 'react-router-dom';
import AdminCleaningHoukokuBuilderPage from '../../../admin/pages/AdminCleaningHoukokuBuilderPage';
import ReportUnavailable from './ReportUnavailable';

/**
 * 報告画面の振り分け
 * 清掃 → 1日レポート（最大3店舗）。その他 → 準備中表示。
 */
export default function ReportCreatePage() {
  const { job: jobKey } = useParams();

  if (jobKey === 'cleaning') {
    // Always use the same builder as admin to keep preview/PDF(A4) identical.
    return <AdminCleaningHoukokuBuilderPage />;
  }
  return <ReportUnavailable jobKey={jobKey} />;
}
