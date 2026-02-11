import React from 'react';
import AdminMasterBase from './AdminMasterBase';

function isLocalUiHost() {
  if (typeof window === 'undefined') return false;
  const h = window.location?.hostname || '';
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
}

const JINZAI_API_BASE =
  (import.meta.env?.DEV || isLocalUiHost())
    ? '/api-jinzai'
    : (import.meta.env?.VITE_JINZAI_API_BASE || 'https://ho3cd7ibtl.execute-api.ap-northeast-1.amazonaws.com/prod');

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
