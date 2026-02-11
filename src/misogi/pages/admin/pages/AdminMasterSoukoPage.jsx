import React from 'react';
import AdminMasterBase from './AdminMasterBase';

export default function AdminMasterSoukoPage() {
  return (
    <AdminMasterBase
      title="顧客ストレージ (souko)"
      resource="souko"
      idKey="souko_id"
      filters={[
        { key: 'tenpo_id', label: '店舗', sourceKey: 'tenpo', valueKey: 'tenpo_id', labelKey: 'name' },
      ]}
  parentSources={{
        tenpo: { resource: 'tenpo', query: { limit: 200 } },
  }}
      fields={[
        { key: 'tenpo_id', label: '店舗', type: 'select', sourceKey: 'tenpo', valueKey: 'tenpo_id', labelKey: 'name' },
        { key: 'name', label: '顧客ストレージ名' },
      ]}
    />
  );
}
