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

export default function AdminMasterJinzaiShokushuPage() {
  return (
    <AdminMasterBase
      title="人材職種マスタ (jinzai_shokushu)"
      apiBase={JINZAI_API_BASE}
      resourceBasePath=""
      resource="jinzai/shokushu"
      idKey="shokushu_code"
      fields={[
        { key: 'shokushu_code', label: '職種コード' },
      ]}
    />
  );
}
