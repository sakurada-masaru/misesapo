import React from 'react';
import { Link } from 'react-router-dom';
import Visualizer from '../Visualizer/Visualizer';

/** 清掃以外のジョブで報告画面を開いたときの表示 */
export default function ReportUnavailable({ jobKey }) {
  return (
    <div className="report-page" data-job={jobKey || undefined}>
      <div className="report-page-viz">
        <Visualizer mode="base" className="report-page-visualizer" />
      </div>
      <div className="report-page-content">
        <p className="report-page-muted">報告は清掃ジョブのみ対応しています。</p>
        <p className="report-page-back">
          <Link to={jobKey ? `/jobs/${jobKey}/entrance` : '/portal'}>入口に戻る</Link>
        </p>
      </div>
    </div>
  );
}
