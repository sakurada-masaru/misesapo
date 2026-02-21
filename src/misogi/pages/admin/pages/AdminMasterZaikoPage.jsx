import React from 'react';
import AdminMasterBase from './AdminMasterBase';

const CATEGORY_OPTIONS = [
  { value: 'cleaning', label: '清掃用品' },
  { value: 'chemicals', label: '薬剤' },
  { value: 'tools', label: '道具' },
  { value: 'consumables', label: '消耗品' },
  { value: 'other', label: 'その他' },
];

const UNIT_OPTIONS = [
  { value: 'piece', label: '個' },
  { value: 'box', label: '箱' },
  { value: 'set', label: 'セット' },
  { value: 'liter', label: 'L' },
  { value: 'kg', label: 'kg' },
];

export default function AdminMasterZaikoPage() {
  return (
    <AdminMasterBase
      title="在庫管理データベース"
      resource="zaiko"
      idKey="zaiko_id"
      localSearch={{
        label: '統合検索',
        placeholder: '品目コード / 品目名 / 仕入先 / カテゴリ',
        keys: ['zaiko_id', 'item_code', 'item_name', 'supplier_name', 'category'],
      }}
      filters={[
        {
          key: 'category',
          label: 'カテゴリ',
          options: CATEGORY_OPTIONS,
          valueKey: 'value',
          labelKey: 'label',
        },
        {
          key: 'jotai',
          label: '状態',
          options: [
            { value: 'yuko', label: 'yuko' },
            { value: 'torikeshi', label: 'torikeshi' },
          ],
          valueKey: 'value',
          labelKey: 'label',
        },
      ]}
      fields={[
        { key: 'item_code', label: '品目コード', required: true },
        { key: 'item_name', label: '品目名', required: true },
        {
          key: 'category',
          label: 'カテゴリ',
          type: 'select',
          options: CATEGORY_OPTIONS,
          valueKey: 'value',
          labelKey: 'label',
          defaultValue: 'cleaning',
        },
        {
          key: 'unit',
          label: '単位',
          type: 'select',
          options: UNIT_OPTIONS,
          valueKey: 'value',
          labelKey: 'label',
          defaultValue: 'piece',
        },
        { key: 'stock_qty', label: '現在在庫数', type: 'number', defaultValue: 0 },
        { key: 'reorder_point', label: '発注点', type: 'number', defaultValue: 0 },
        { key: 'supplier_name', label: '仕入先' },
        { key: 'memo', label: 'メモ', type: 'textarea', rows: 5, modalColSpan: 2 },
      ]}
    />
  );
}

