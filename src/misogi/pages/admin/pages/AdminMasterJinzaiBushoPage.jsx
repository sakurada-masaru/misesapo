import React from 'react';
import AdminMasterBase from './AdminMasterBase';

// ブラウザ直叩きは CORS で死ぬので、dev/prod ともに同一オリジン相対を正とする。
const JINZAI_API_BASE = '/api-jinzai';

export default function AdminMasterJinzaiBushoPage() {
  return (
    <AdminMasterBase
      title="人材部署マスタ (jinzai_busho)"
      apiBase={JINZAI_API_BASE}
      resourceBasePath=""
      resource="jinzai/busho"
      idKey="busho_id"
      fields={[
        { key: 'name', label: '部署名' },
      ]}
    />
  );
}
