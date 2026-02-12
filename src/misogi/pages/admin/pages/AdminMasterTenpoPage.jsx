import React, { useCallback } from 'react';
import AdminMasterBase from './AdminMasterBase';

function normalizeBillingOwnerKind(v) {
  const s = String(v || '').trim();
  return s === 'yagou' ? 'yagou' : 'torihikisaki';
}

function deriveBillingOwnerId(row) {
  const kind = normalizeBillingOwnerKind(row?.billing_owner_kind);
  if (kind === 'yagou') return row?.billing_owner_id || row?.yagou_id || '';
  return row?.billing_owner_id || row?.torihikisaki_id || '';
}

export default function AdminMasterTenpoPage() {
  const handleAfterSave = useCallback(async ({ isUpdate, editing, request }) => {
    if (isUpdate) return;
    const tenpoId = editing?.tenpo_id;
    if (!tenpoId) return;

    const check = await request(`/souko?tenpo_id=${encodeURIComponent(tenpoId)}&limit=1`);
    if (!check.ok) {
      throw new Error(`souko確認失敗 (${check.status})`);
    }
    const data = await check.json();
    const items = Array.isArray(data) ? data : (data?.items || []);
    if (items.length > 0) return;

    const res = await request('/souko', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenpo_id: tenpoId,
        name: `${editing?.name || tenpoId} 顧客ストレージ`,
        jotai: 'yuko',
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`souko自動作成失敗 (${res.status}) ${text}`);
    }
  }, []);

  return (
    <AdminMasterBase
      title="店舗マスタ (tenpo)"
      resource="tenpo"
      idKey="tenpo_id"
      onAfterSave={handleAfterSave}
      filters={[
        { key: 'torihikisaki_id', label: '取引先', sourceKey: 'torihikisaki', valueKey: 'torihikisaki_id', labelKey: 'name' },
        { key: 'yagou_id', label: '屋号', sourceKey: 'yagou', valueKey: 'yagou_id', labelKey: 'name' },
      ]}
  parentSources={{
        torihikisaki: { resource: 'torihikisaki', query: { limit: 200 } },
        yagou: { resource: 'yagou', query: { limit: 200 } },
  }}
      fields={[
        {
          key: 'torihikisaki_id',
          label: '取引先',
          type: 'select',
          sourceKey: 'torihikisaki',
          valueKey: 'torihikisaki_id',
          labelKey: 'name',
          onChange: ({ value, prev }) => {
            const kind = normalizeBillingOwnerKind(prev?.billing_owner_kind);
            if (kind !== 'torihikisaki') return null;
            return { billing_owner_id: String(value || '').trim() };
          },
        },
        {
          key: 'yagou_id',
          label: '屋号',
          type: 'select',
          sourceKey: 'yagou',
          valueKey: 'yagou_id',
          labelKey: 'name',
          onChange: ({ value, prev }) => {
            const kind = normalizeBillingOwnerKind(prev?.billing_owner_kind);
            if (kind !== 'yagou') return null;
            return { billing_owner_id: String(value || '').trim() };
          },
        },
        { key: 'name', label: '店舗名' },
        {
          key: 'billing_owner_kind',
          label: '請求主体',
          type: 'select',
          defaultValue: 'torihikisaki',
          options: [
            { value: 'torihikisaki', label: '取引先（法人）' },
            { value: 'yagou', label: '屋号（個人店など）' },
          ],
          format: (v) => normalizeBillingOwnerKind(v),
          onChange: ({ value, prev }) => {
            const kind = normalizeBillingOwnerKind(value);
            if (kind === 'yagou') return { billing_owner_id: prev?.yagou_id || '' };
            return { billing_owner_id: prev?.torihikisaki_id || '' };
          },
        },
        {
          key: 'billing_owner_id',
          label: '請求主体ID',
          readOnly: true,
          format: (_v, row) => deriveBillingOwnerId(row),
        },
      ]}
    />
  );
}
