import React from 'react';
import AdminMasterBase from './AdminMasterBase';

export default function AdminMasterTorihikisakiPage() {
  return (
    <AdminMasterBase
      title="取引先マスタ (torihikisaki)"
      resource="torihikisaki"
      idKey="torihikisaki_id"
      fields={[
        { key: 'name', label: '取引先名' },
      ]}
    />
  );
}
