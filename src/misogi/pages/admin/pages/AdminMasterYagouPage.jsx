import React from 'react';
import AdminMasterBase from './AdminMasterBase';

export default function AdminMasterYagouPage() {
  return (
    <AdminMasterBase
      title="屋号マスタ (yagou)"
      resource="yagou"
      idKey="yagou_id"
      filters={[
        { key: 'torihikisaki_id', label: '取引先', sourceKey: 'torihikisaki', valueKey: 'torihikisaki_id', labelKey: 'name' },
      ]}
  parentSources={{
        torihikisaki: { resource: 'torihikisaki', query: { limit: 200 } },
  }}
      fields={[
        { key: 'torihikisaki_id', label: '取引先', type: 'select', sourceKey: 'torihikisaki', valueKey: 'torihikisaki_id', labelKey: 'name' },
        { key: 'name', label: '屋号名' },
      ]}
    />
  );
}
