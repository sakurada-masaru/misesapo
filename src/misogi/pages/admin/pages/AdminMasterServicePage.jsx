import React from 'react';
import AdminMasterBase from './AdminMasterBase';

const CATEGORY_OPTIONS = [
  { category: 'kitchen_haccp', name: '厨房衛生(HACCP)' },
  { category: 'aircon', name: '空調設備' },
  { category: 'floor', name: 'フロア清掃' },
  { category: 'pest_hygiene', name: '害虫衛生' },
  { category: 'maintenance', name: '設備メンテナンス' },
  { category: 'window_wall', name: '窓・壁面' },
  { category: 'other', name: 'その他' },
  // legacy
  { category: 'cleaning', name: '(互換) cleaning' },
  { category: 'pest', name: '(互換) pest' },
];

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
          options: CATEGORY_OPTIONS,
          valueKey: 'category',
          labelKey: 'name',
        },
        {
          key: 'category_concept',
          label: '簡易概念',
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
        {
          key: 'category_concept',
          label: '簡易概念',
          type: 'select',
          options: CATEGORY_OPTIONS,
          valueKey: 'category',
          labelKey: 'name',
          defaultValue: 'kitchen_haccp',
        },
        { key: 'default_duration_min', label: '標準時間(分)', type: 'number', defaultValue: 60 },
        { key: 'default_price', label: '標準単価', type: 'number', defaultValue: 0 },
      ]}
    />
  );
}
