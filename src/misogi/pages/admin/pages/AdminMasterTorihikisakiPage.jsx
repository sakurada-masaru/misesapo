import React from 'react';
import AdminMasterBase from './AdminMasterBase';
import { formatMasterDateTime } from './masterDateTime';

export default function AdminMasterTorihikisakiPage() {
  return (
    <AdminMasterBase
      title="取引先マスタ (torihikisaki)"
      resource="torihikisaki"
      idKey="torihikisaki_id"
      listLimit={20000}
      enableColumnSort
      initialSortKey="torihikisaki_id"
      initialSortDir="asc"
      localSearch={{
        label: '統合検索',
        placeholder: '取引先ID / 取引先名',
        keys: ['torihikisaki_id', 'name'],
      }}
      fields={[
        { key: 'name', label: '取引先名' },
        { key: 'touroku_at', label: '登録日時', readOnly: true, format: formatMasterDateTime },
      ]}
    />
  );
}
