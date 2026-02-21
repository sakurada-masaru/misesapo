import React from 'react';
import AdminMasterBase from './AdminMasterBase';

const ORDER_STATUS_OPTIONS = [
  { value: 'draft', label: '下書き' },
  { value: 'ordered', label: '発注済み' },
  { value: 'arrived', label: '入荷済み' },
  { value: 'cancelled', label: '取消' },
];

export default function AdminZaikoOrderPage() {
  return (
    <AdminMasterBase
      title="在庫発注フォーム"
      resource="zaiko_hacchu"
      idKey="hacchu_id"
      localSearch={{
        label: '統合検索',
        placeholder: '品目名 / 仕入先 / 発注者',
        keys: ['hacchu_id', 'item_name', 'supplier_name', 'ordered_by', 'status'],
      }}
      filters={[
        {
          key: 'status',
          label: '発注状態',
          options: ORDER_STATUS_OPTIONS,
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
      parentSources={{
        zaiko: {
          resource: 'zaiko',
          query: { limit: 2000, jotai: 'yuko' },
        },
      }}
      normalizeEditingModel={(model) => {
        const m = { ...(model || {}) };
        if (!String(m.status || '').trim()) m.status = 'draft';
        if (!String(m.jotai || '').trim()) m.jotai = 'yuko';
        if (!String(m.ordered_date || '').trim()) {
          const d = new Date();
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          m.ordered_date = `${yyyy}-${mm}-${dd}`;
        }
        return m;
      }}
      fields={[
        {
          key: 'zaiko_id',
          label: '在庫品目',
          type: 'select',
          sourceKey: 'zaiko',
          valueKey: 'zaiko_id',
          labelKey: 'item_name',
          required: true,
        },
        { key: 'item_name', label: '品目名', required: true },
        { key: 'order_qty', label: '発注数', type: 'number', required: true, defaultValue: 1 },
        { key: 'unit_price', label: '単価', type: 'number', defaultValue: 0 },
        { key: 'ordered_date', label: '発注日' },
        { key: 'supplier_name', label: '仕入先' },
        { key: 'ordered_by', label: '発注者' },
        {
          key: 'status',
          label: '発注状態',
          type: 'select',
          options: ORDER_STATUS_OPTIONS,
          valueKey: 'value',
          labelKey: 'label',
          defaultValue: 'draft',
        },
        { key: 'note', label: '備考', type: 'textarea', rows: 5, modalColSpan: 2 },
      ]}
    />
  );
}
