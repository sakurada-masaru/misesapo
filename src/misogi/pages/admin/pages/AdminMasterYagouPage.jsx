import React from 'react';
import AdminMasterBase from './AdminMasterBase';
import { formatMasterDateTime } from './masterDateTime';

export default function AdminMasterYagouPage() {
  return (
    <AdminMasterBase
      title="屋号マスタ (yagou)"
      resource="yagou"
      idKey="yagou_id"
      listLimit={20000}
      enableColumnSort
      initialSortKey="yagou_id"
      initialSortDir="asc"
      localSearch={{
        label: '統合検索',
        placeholder: '屋号ID / 屋号名 / 取引先ID',
        keys: ['yagou_id', 'name', 'torihikisaki_id'],
      }}
      filters={[
        { key: 'torihikisaki_id', label: '取引先', sourceKey: 'torihikisaki', valueKey: 'torihikisaki_id', labelKey: 'name' },
      ]}
      parentSources={{
        torihikisaki: { resource: 'torihikisaki', query: { limit: 20000 } },
      }}
      fields={[
        { key: 'torihikisaki_id', label: '取引先', type: 'select', sourceKey: 'torihikisaki', valueKey: 'torihikisaki_id', labelKey: 'name' },
        { key: 'name', label: '屋号名' },
        { key: 'touroku_at', label: '登録日時', readOnly: true, format: formatMasterDateTime },
      ]}
    />
  );
}
