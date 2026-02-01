import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';

/**
 * 事務ジョブ用・顧客カルテへの導線
 * /office/clients/:storeId にアクセスした場合は管理画面の清掃カルテ（完全版）へリダイレクトする。
 * @see https://misesapo.co.jp/admin/customers/stores/[id]/chart.html?store_id=ST00123
 */
export default function OfficeClientKartePage() {
  const { storeId } = useParams();

  useEffect(() => {
    if (!storeId) return;
    const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '');
    const url = `${base}/admin/customers/stores/${encodeURIComponent(storeId)}/chart.html?store_id=${encodeURIComponent(storeId)}`;
    window.location.href = url;
  }, [storeId]);

  return (
    <div className="report-page" data-job="office" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
      <p className="job-entrance-dummy">清掃カルテ（完全版）へ移動しています...</p>
    </div>
  );
}
