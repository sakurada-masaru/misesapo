import React from 'react';
import AdminMasterBase from './AdminMasterBase';
import { formatMasterDateTime } from './masterDateTime';
import { SERVICE_CATEGORY_OPTIONS, SERVICE_CONCEPT_OPTIONS } from './serviceCategoryCatalog';

function asNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof v === 'object' && v && typeof v.N === 'string') {
    const n = Number(v.N);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function formatYen(v, row) {
  const n =
    asNumber(v) ??
    asNumber(row?.default_price) ??
    asNumber(row?.price) ??
    asNumber(row?.unit_price) ??
    asNumber(row?.standard_price);
  if (n === null) return '-';
  return `¥${n.toLocaleString()}`;
}

function formatMinutes(v, row) {
  const n =
    asNumber(v) ??
    asNumber(row?.default_duration_min) ??
    asNumber(row?.duration_min) ??
    asNumber(row?.standard_duration_min);
  if (n === null) return '-';
  return `${Math.trunc(n)}分`;
}

export default function AdminMasterServicePage() {
  return (
    <AdminMasterBase
      title="サービスマスタ (service)"
      resource="service"
      idKey="service_id"
      localSearch={{
        label: '統合検索',
        placeholder: 'service_id / 名称 / カテゴリ / 概念',
        keys: ['service_id', 'name', 'category', 'category_concept'],
      }}
      filters={[
        {
          key: 'category',
          label: 'カテゴリ',
          options: SERVICE_CATEGORY_OPTIONS,
          valueKey: 'category',
          labelKey: 'name',
        },
        {
          key: 'category_concept',
          label: '簡易概念',
          options: SERVICE_CONCEPT_OPTIONS,
          valueKey: 'category',
          labelKey: 'name',
        },
        {
          key: 'jotai',
          label: '状態',
          options: [
            { jotai: 'yuko', name: 'yuko' },
            { jotai: 'torikeshi', name: 'torikeshi' },
          ],
          valueKey: 'jotai',
          labelKey: 'name',
        },
      ]}
      fields={[
        { key: 'name', label: 'サービス名' },
        {
          key: 'category',
          label: 'カテゴリ',
          type: 'select',
          options: SERVICE_CATEGORY_OPTIONS,
          valueKey: 'category',
          labelKey: 'name',
          defaultValue: 'general_cleaning',
        },
        {
          key: 'category_concept',
          label: '簡易概念',
          type: 'select',
          options: SERVICE_CONCEPT_OPTIONS,
          valueKey: 'category',
          labelKey: 'name',
          defaultValue: 'cleaning',
        },
        {
          key: 'default_duration_min',
          label: '標準時間(分)',
          type: 'number',
          defaultValue: 60,
          format: formatMinutes,
        },
        {
          key: 'default_price',
          label: '標準単価',
          type: 'number',
          defaultValue: 0,
          format: formatYen,
        },
        { key: 'touroku_at', label: '登録日時', readOnly: true, format: formatMasterDateTime },
      ]}
    />
  );
}
