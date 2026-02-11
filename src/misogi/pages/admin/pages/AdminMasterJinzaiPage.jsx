import React, { useCallback } from 'react';
import AdminMasterBase from './AdminMasterBase';

// ブラウザ直叩きは CORS で死ぬので、dev/prod ともに同一オリジン相対を正とする。
const JINZAI_API_BASE = '/api-jinzai';

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
