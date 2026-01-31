import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Visualizer from '../Visualizer/Visualizer';
import { getCustomersWithSeed, setCustomers, generateStoreKey } from './salesCustomersStorage';
import './sales-customer-list.css';

function truncateAddress(str, max = 24) {
  const s = String(str ?? '').trim();
  if (s.length <= max) return s;
  return s.slice(0, max) + '…';
}

const INIT_FORM = {
  company: '',
  store: '',
  address: '',
  tel: '',
  contact: '',
  email: '',
};

function trim(s) {
  return String(s ?? '').trim();
}

function isBlank(s) {
  return trim(s) === '';
}

export default function SalesCustomersPage() {
  const navigate = useNavigate();
  const [customers, setCustomersState] = useState([]);
  const [form, setForm] = useState(INIT_FORM);
  const [errors, setErrors] = useState({ store: '', address: '' });

  const loadCustomers = useCallback(() => {
    setCustomersState(getCustomersWithSeed());
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const updateForm = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === 'store') setErrors((e) => ({ ...e, store: '' }));
    if (field === 'address') setErrors((e) => ({ ...e, address: '' }));
  };

  const validate = () => {
    const storeVal = trim(form.store);
    const addressVal = trim(form.address);
    const nextErrors = { store: '', address: '' };
    if (isBlank(form.store)) nextErrors.store = '店舗名は必須です。';
    else if (!storeVal) nextErrors.store = '店舗名は空白のみにできません。';
    if (isBlank(form.address)) nextErrors.address = '住所は必須です。';
    else if (!addressVal) nextErrors.address = '住所は空白のみにできません。';
    setErrors(nextErrors);
    return !nextErrors.store && !nextErrors.address;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    const storeKey = generateStoreKey(form.company, form.store);
    const newCustomer = {
      storeKey,
      company: trim(form.company),
      store: trim(form.store),
      address: trim(form.address),
      tel: trim(form.tel),
      contact: trim(form.contact),
      email: trim(form.email),
    };
    const nextList = [...customers, newCustomer];
    setCustomers(nextList); // localStorage に保存
    setCustomersState(nextList);
    setForm(INIT_FORM);
    setErrors({ store: '', address: '' });
  };

  const goToKarte = (storeKey) => {
    navigate(`/sales/store/${encodeURIComponent(storeKey)}`);
  };

  return (
    <div className="report-page sales-customers-page" data-job="sales">
      <div className="report-page-viz">
        <Visualizer mode="base" className="report-page-visualizer" />
      </div>
      <div className="report-page-content sales-customers-content">
        <p className="report-page-back">
          <Link to="/jobs/sales/entrance">営業入口に戻る</Link>
        </p>

        <section className="sales-customers-form-section" aria-labelledby="sales-customers-form-title">
        <h1 id="sales-customers-form-title" className="sales-page-title">
          新規顧客登録
        </h1>
        <form onSubmit={handleSubmit} className="sales-customers-form">
          <div className="sales-customers-form-row">
            <label htmlFor="sales-form-company">会社名</label>
            <input
              id="sales-form-company"
              type="text"
              value={form.company}
              onChange={(e) => updateForm('company', e.target.value)}
              placeholder="会社名"
              className="sales-customers-input"
            />
          </div>
          <div className="sales-customers-form-row">
            <label htmlFor="sales-form-store">店舗名<span className="sales-required">（必須）</span></label>
            <input
              id="sales-form-store"
              type="text"
              value={form.store}
              onChange={(e) => updateForm('store', e.target.value)}
              placeholder="店舗名"
              className={`sales-customers-input ${errors.store ? 'sales-input-error' : ''}`}
              aria-invalid={!!errors.store}
              aria-describedby={errors.store ? 'sales-error-store' : undefined}
            />
            {errors.store && (
              <span id="sales-error-store" className="sales-field-error" role="alert">
                {errors.store}
              </span>
            )}
          </div>
          <div className="sales-customers-form-row">
            <label htmlFor="sales-form-address">住所<span className="sales-required">（必須）</span></label>
            <input
              id="sales-form-address"
              type="text"
              value={form.address}
              onChange={(e) => updateForm('address', e.target.value)}
              placeholder="住所"
              className={`sales-customers-input ${errors.address ? 'sales-input-error' : ''}`}
              aria-invalid={!!errors.address}
              aria-describedby={errors.address ? 'sales-error-address' : undefined}
            />
            {errors.address && (
              <span id="sales-error-address" className="sales-field-error" role="alert">
                {errors.address}
              </span>
            )}
          </div>
          <div className="sales-customers-form-row">
            <label htmlFor="sales-form-tel">TEL</label>
            <input
              id="sales-form-tel"
              type="tel"
              value={form.tel}
              onChange={(e) => updateForm('tel', e.target.value)}
              placeholder="TEL"
              className="sales-customers-input"
            />
          </div>
          <div className="sales-customers-form-row">
            <label htmlFor="sales-form-contact">担当者</label>
            <input
              id="sales-form-contact"
              type="text"
              value={form.contact}
              onChange={(e) => updateForm('contact', e.target.value)}
              placeholder="担当者"
              className="sales-customers-input"
            />
          </div>
          <div className="sales-customers-form-row">
            <label htmlFor="sales-form-email">Email</label>
            <input
              id="sales-form-email"
              type="email"
              value={form.email}
              onChange={(e) => updateForm('email', e.target.value)}
              placeholder="Email"
              className="sales-customers-input"
            />
          </div>
          <div className="sales-customers-form-actions">
            <button type="submit" className="btn sales-customers-submit">
              登録
            </button>
          </div>
        </form>
      </section>

      <section className="sales-customers-list-section" aria-labelledby="sales-customers-list-title">
        <h2 id="sales-customers-list-title" className="sales-customers-list-heading">
          登録済み一覧
        </h2>
        <div className="sales-customer-list-cards">
          {customers.length === 0 ? (
            <p className="sales-customer-list-empty">登録済み顧客はいません。</p>
          ) : (
            customers.map((c) => (
              <article key={c.storeKey} className="sales-customer-list-card sales-customer-card-with-karte">
                <span className="sales-customer-list-card-store">{c.store}</span>
                <span className="sales-customer-list-card-company">{c.company}</span>
                <span className="sales-customer-list-card-address">{truncateAddress(c.address)}</span>
                <button
                  type="button"
                  className="sales-customer-karte-btn"
                  onClick={() => goToKarte(c.storeKey)}
                >
                  カルテを見る
                </button>
              </article>
            ))
          )}
        </div>
      </section>
      </div>
    </div>
  );
}
