import React from 'react';
import { Link } from 'react-router-dom';
import Visualizer from '../Visualizer/Visualizer';
import SalesCustomerListPanel from './SalesCustomerListPanel';
import './sales-customer-list.css';

export default function SalesKarteListPage() {
  return (
    <div className="report-page sales-karte-list-page" data-job="sales">
      <div className="report-page-viz">
        <Visualizer mode="base" className="report-page-visualizer" />
      </div>
      <div className="report-page-content sales-karte-list-content">
        <h1 className="sales-page-title">営業カルテ</h1>
        <p className="report-page-back">
          <Link to="/jobs/sales/entrance">営業入口に戻る</Link>
        </p>
        <SalesCustomerListPanel title="営業カルテ" />
      </div>
    </div>
  );
}
