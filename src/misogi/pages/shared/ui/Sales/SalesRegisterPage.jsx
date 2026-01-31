import React from 'react';
import { Link } from 'react-router-dom';
import './sales-customer-list.css';

export default function SalesRegisterPage() {
  return (
    <div className="sales-page sales-register-page">
      <h1 className="sales-page-title">顧客登録</h1>
      <p className="sales-page-back">
        <Link to="/jobs/sales/entrance">営業入口に戻る</Link>
      </p>
      <p className="sales-register-placeholder">顧客登録画面（準備中）</p>
    </div>
  );
}
