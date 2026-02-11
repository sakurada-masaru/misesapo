import React from 'react';
import AdminMasterBase from './AdminMasterBase';

// ブラウザ直叩きは CORS で死ぬので、dev/prod ともに同一オリジン相対を正とする。
const JINZAI_API_BASE = '/api-jinzai';

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
