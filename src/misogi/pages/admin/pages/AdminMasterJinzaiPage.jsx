import React, { useCallback } from 'react';
import AdminMasterBase from './AdminMasterBase';

function isLocalUiHost() {
  if (typeof window === 'undefined') return false;
  const h = String(window.location?.hostname || '').toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0';
}

const JINZAI_API_BASE =
  (import.meta.env?.DEV || isLocalUiHost())
    ? '/api-jinzai'
    : (import.meta.env?.VITE_JINZAI_API_BASE || 'https://ho3cd7ibtl.execute-api.ap-northeast-1.amazonaws.com/prod');

export default function AdminMasterJinzaiPage() {
  const handleAfterSave = useCallback(async ({ isUpdate, id, editing, request }) => {
    if (isUpdate || !id) return;
    const res = await request(`/jinzai/${encodeURIComponent(id)}/kaban`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${editing?.name || id} kaban`,
        jotai: 'yuko',
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`kaban自動作成失敗 (${res.status}) ${text}`);
    }
  }, []);

  return (
    <AdminMasterBase
      title="人材マスタ (jinzai)"
      apiBase={JINZAI_API_BASE}
      resourceBasePath=""
      resource="jinzai"
      idKey="jinzai_id"
      onAfterSave={handleAfterSave}
      fields={[
        { key: 'name', label: '氏名' },
        { key: 'koyou_kubun', label: '契約形態' },
        { key: 'shokushu', label: '職種(JSON配列可)' },
        { key: 'busho_ids', label: '部署ID(JSON配列可)' },
        { key: 'email', label: 'メール' },
        { key: 'phone', label: '電話' },
      ]}
    />
  );
}
