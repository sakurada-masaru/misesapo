import React from 'react';
import AdminMasterBase from './AdminMasterBase';

const CATEGORY_OPTIONS = [
  { category: 'cleaning', name: 'cleaning' },
  { category: 'maintenance', name: 'maintenance' },
  { category: 'pest', name: 'pest' },
  { category: 'other', name: 'other' },
];

export default function AdminMasterServicePage() {
  return (
    <AdminMasterBase
      title="サービスマスタ (service)"
      resource="service"
      idKey="service_id"
      filters={[
        {
          key: 'category',
          label: 'カテゴリ',
          options: CATEGORY_OPTIONS,
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
          options: CATEGORY_OPTIONS,
          valueKey: 'category',
          labelKey: 'name',
          defaultValue: 'cleaning',
        },
        { key: 'default_duration_min', label: '標準時間(分)' },
        { key: 'default_price', label: '標準単価' },
      ]}
    />
  );
}
