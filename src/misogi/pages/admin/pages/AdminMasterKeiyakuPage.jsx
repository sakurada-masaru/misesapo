import React from 'react';
import AdminMasterBase from './AdminMasterBase';
import { formatMasterDateTime } from './masterDateTime';

function formatYen(v, row) {
  const n = Number(v ?? row?.price ?? 0);
  if (!Number.isFinite(n) || n <= 0) return '-';
  return `¥${Math.trunc(n).toLocaleString()}`;
}

function txt(v) {
  const s = String(v ?? '').trim();
  return s || '-';
}

function toNameMap(list, idKey = 'id') {
  const m = new Map();
  (Array.isArray(list) ? list : []).forEach((it) => {
    const id = String(it?.[idKey] || '').trim();
    if (!id) return;
    m.set(id, String(it?.name || '').trim());
  });
  return m;
}

function renderKeiyakuPreview({ row, parents }) {
  const toriMap = toNameMap(parents?.torihikisaki, 'torihikisaki_id');
  const yagouMap = toNameMap(parents?.yagou, 'yagou_id');
  const tenpoMap = toNameMap(parents?.tenpo, 'tenpo_id');

  const torihikisakiName = toriMap.get(String(row?.torihikisaki_id || '').trim()) || row?.torihikisaki_name || '';
  const yagouName = yagouMap.get(String(row?.yagou_id || '').trim()) || row?.yagou_name || '';
  const tenpoName = tenpoMap.get(String(row?.tenpo_id || '').trim()) || row?.tenpo_name || '';

  const storeName = txt(row?.store_name || tenpoName);
  const storeAddress = txt(row?.store_address || row?.address);
  const pricing = txt(row?.pricing) !== '-' ? txt(row?.pricing) : '料金表または見積書に定めるとおりとします。';
  const cancelRule = txt(row?.cancel_rule) !== '-' ? txt(row?.cancel_rule) : '別途定めるとおりとします。';
  const paymentMethod = txt(row?.payment_method) !== '-' ? txt(row?.payment_method) : '請求書を送付いたします。指定の口座に当月締め翌月末までに支払いください。';
  const validTerm = txt(row?.valid_term) !== '-' ? txt(row?.valid_term) : '原則利用開始日から1年間（自動更新）';
  const withdrawalNotice = txt(row?.withdrawal_notice) !== '-' ? txt(row?.withdrawal_notice) : '90日前';
  const specialNotes = txt(row?.special_notes) !== '-' ? txt(row?.special_notes) : '店舗での設備に関するアラートや運営改善のため、設備情報をミセサポへ登録します。';
  const norm = (v, fallback = '　') => {
    const s = String(v ?? '').trim();
    return s || fallback;
  };
  const table = {
    width: '100%',
    borderCollapse: 'collapse',
    tableLayout: 'fixed',
    border: '1px solid #222',
    fontSize: 13,
    lineHeight: 1.45,
    background: '#fff',
  };
  const td = {
    border: '1px solid #222',
    padding: '6px 8px',
    verticalAlign: 'top',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  };
  const labelTd = {
    ...td,
    width: 150,
    fontWeight: 700,
    background: '#fff',
  };
  const compactTd = {
    ...td,
    padding: '4px 6px',
    fontSize: 12,
  };
  const serviceStores = [storeName, storeAddress]
    .filter((v) => String(v || '').trim() && String(v || '').trim() !== '-')
    .join('\n');
  const providerName = txt(row?.provider_name || 'hairVR株式会社 ミセサポ事業部　代表取締役　正田和輝');
  const providerAddress = txt(row?.provider_address || '東京都中央区日本橋茅場町1-8-1 7F');
  const providerPhone = txt(row?.provider_phone || '070-3332-3939');
  const pageWrap = {
    width: '100%',
    overflowX: 'auto',
    overflowY: 'hidden',
    padding: '4px 0 8px',
  };
  const a4Page = {
    width: '210mm',
    minHeight: '297mm',
    margin: '0 auto',
    background: '#fff',
    color: '#111',
    border: '1px solid #222',
    borderRadius: 2,
    padding: '9mm 8mm 8mm',
    boxSizing: 'border-box',
    fontFamily: '"MS Mincho", "Yu Mincho", "Hiragino Mincho ProN", serif',
    boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
  };

  return (
    <div style={pageWrap}>
      <div style={a4Page}>
        <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 40 / 2, letterSpacing: 1, marginBottom: 4 }}>利用者登録 申込書（契約書）</div>
        <div style={{ textAlign: 'center', fontSize: 12, marginBottom: 8 }}>ミセサポ　利用規約に同意し、以下の通り、本サービスの利用を申し込みます。</div>

        <table style={table}>
          <tbody>
            <tr>
              <td style={{ ...compactTd, fontWeight: 700, width: 180 }}>申込日及び利用開始日</td>
              <td style={{ ...compactTd, fontWeight: 700 }}>
                申込日：{norm(row?.application_date, '-')}　／　利用開始日：{norm(row?.start_date, '-')}
              </td>
            </tr>

            <tr>
              <td style={labelTd}>個人／法人名</td>
              <td style={{ ...td, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span>{norm(row?.company_name)}</span>
                <span>{norm(row?.company_stamp, '㊞')}</span>
              </td>
            </tr>

            <tr>
              <td style={labelTd}>住所／本店住所</td>
              <td style={td}>{norm(row?.company_address)}</td>
            </tr>

            <tr>
              <td style={labelTd}>担当者</td>
              <td style={{ ...td, padding: 0 }}>
                <table style={{ ...table, border: 'none' }}>
                  <tbody>
                    <tr>
                      <td style={{ ...compactTd, width: '33.33%', borderLeft: 'none', borderTop: 'none' }}>{norm(row?.contact_person)}</td>
                      <td style={{ ...compactTd, width: '33.33%', fontWeight: 700, borderTop: 'none' }}>電話番号</td>
                      <td style={{ ...compactTd, width: '33.33%', borderRight: 'none', borderTop: 'none' }}>{norm(row?.phone)}</td>
                    </tr>
                    <tr>
                      <td style={{ ...compactTd, borderLeft: 'none', borderBottom: 'none' }} />
                      <td style={{ ...compactTd, fontWeight: 700, borderBottom: 'none' }}>メールアドレス</td>
                      <td style={{ ...compactTd, borderRight: 'none', borderBottom: 'none' }}>{norm(row?.email)}</td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>

            <tr>
              <td style={labelTd}>サービスを利用したい店舗の名称及び住所（複数ある場合は全てご記載ください。）</td>
              <td style={td}>
                {norm(serviceStores || `${storeName}\n${storeAddress}`)}
                <div style={{ marginTop: 6, fontSize: 12 }}>
                  取引先：{norm(torihikisakiName, '-')}　／　屋号：{norm(yagouName, '-')}　／　店舗ID：{norm(row?.tenpo_id, '-')}
                </div>
              </td>
            </tr>

            <tr>
              <td style={labelTd}>料金</td>
              <td style={td}>
                {pricing}
                {txt(row?.price) !== '-' ? <span style={{ marginLeft: 8 }}>（{formatYen(row?.price, row)}）</span> : null}
              </td>
            </tr>

            <tr>
              <td style={labelTd}>個別業務のキャンセル</td>
              <td style={td}>{cancelRule}</td>
            </tr>

            <tr>
              <td style={labelTd}>支払方法</td>
              <td style={td}>{paymentMethod}</td>
            </tr>

            <tr>
              <td style={labelTd}>有効期間</td>
              <td style={td}>{validTerm}</td>
            </tr>

            <tr>
              <td style={labelTd}>退会予告期間</td>
              <td style={td}>{withdrawalNotice}</td>
            </tr>

            <tr>
              <td style={labelTd}>特約事項</td>
              <td style={td}>{specialNotes}</td>
            </tr>

            <tr>
              <td style={labelTd}>サービス提供者</td>
              <td style={td}>
                {providerName}
                <br />
                住所：{providerAddress}
                <br />
                電話：{providerPhone}
                <br />
                契約PDFキー：{norm(row?.contract_doc_key, '-')}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminMasterKeiyakuPage() {
  const [previewRow, setPreviewRow] = React.useState(null);
  const [previewParents, setPreviewParents] = React.useState({});

  const openPreview = React.useCallback((row, ctx = {}) => {
    setPreviewRow(row || null);
    setPreviewParents(ctx?.parents || {});
  }, []);

  const closePreview = React.useCallback(() => {
    setPreviewRow(null);
  }, []);

  return (
    <>
      <AdminMasterBase
        title="契約マスタ (keiyaku)"
        resource="keiyaku"
        idKey="keiyaku_id"
        listLimit={200}
        showJotaiColumn={false}
        onRowClick={openPreview}
        onPreviewRow={openPreview}
        previewButtonLabel="プレビュー"
        listColumnKeys={[
          'torihikisaki_id',
          'yagou_id',
          'tenpo_id',
          'start_date',
          'price',
          'status',
          'touroku_at',
        ]}
        localSearch={{
          label: '統合検索',
          placeholder: 'keiyaku_id / 契約名 / tenpo / 取引先 / 屋号 / 連絡先',
          keys: [
            'keiyaku_id',
            'name',
            'tenpo_id',
            'tenpo_name',
            'yagou_id',
            'yagou_name',
            'torihikisaki_id',
            'torihikisaki_name',
            'company_name',
            'contact_person',
            'phone',
            'email',
          ],
        }}
        filters={[
          { key: 'torihikisaki_id', label: '取引先', sourceKey: 'torihikisaki', valueKey: 'torihikisaki_id', labelKey: 'name' },
          { key: 'yagou_id', label: '屋号', sourceKey: 'yagou', valueKey: 'yagou_id', labelKey: 'name' },
          { key: 'tenpo_id', label: '店舗', sourceKey: 'tenpo', valueKey: 'tenpo_id', labelKey: 'name' },
          {
            key: 'status',
            label: '契約状態',
            options: [
              { value: 'active', label: 'active' },
              { value: 'inactive', label: 'inactive' },
              { value: 'draft', label: 'draft' },
            ],
            valueKey: 'value',
            labelKey: 'label',
          },
        ]}
        parentSources={{
          torihikisaki: { resource: 'torihikisaki', query: { limit: 5000, jotai: 'yuko' } },
          yagou: { resource: 'yagou', query: { limit: 8000, jotai: 'yuko' } },
          tenpo: { resource: 'tenpo', query: { limit: 20000, jotai: 'yuko' } },
        }}
        fields={[
          { key: 'name', label: '契約名', required: true, modalColSpan: 2 },
          {
            key: 'torihikisaki_id',
            label: '取引先',
            columnLabel: '取引先',
            type: 'select',
            sourceKey: 'torihikisaki',
            valueKey: 'torihikisaki_id',
            labelKey: 'name',
          },
          {
            key: 'yagou_id',
            label: '屋号',
            columnLabel: '屋号',
            type: 'select',
            sourceKey: 'yagou',
            valueKey: 'yagou_id',
            labelKey: 'name',
          },
          {
            key: 'tenpo_id',
            label: '店舗',
            columnLabel: '店舗',
            type: 'select',
            sourceKey: 'tenpo',
            valueKey: 'tenpo_id',
            labelKey: 'name',
          },
          { key: 'application_date', label: '申込日' },
          { key: 'start_date', label: '契約開始日', columnLabel: '開始日' },
          { key: 'price', label: '契約金額', columnLabel: '金額', type: 'number', format: formatYen },
          {
            key: 'status',
            label: '契約状態',
            type: 'select',
            defaultValue: 'active',
            options: [
              { value: 'active', label: 'active' },
              { value: 'inactive', label: 'inactive' },
              { value: 'draft', label: 'draft' },
            ],
            valueKey: 'value',
            labelKey: 'label',
          },
          { key: 'company_name', label: '契約先名' },
          { key: 'contact_person', label: '担当者' },
          { key: 'phone', label: '電話番号' },
          { key: 'email', label: 'メール' },
          { key: 'payment_method', label: '支払方法', type: 'textarea', rows: 3, modalColSpan: 2 },
          { key: 'valid_term', label: '有効期間', type: 'textarea', rows: 3, modalColSpan: 2 },
          { key: 'cancel_rule', label: 'キャンセル条件', type: 'textarea', rows: 3, modalColSpan: 2 },
          { key: 'withdrawal_notice', label: '退会予告期間' },
          { key: 'special_notes', label: '特約事項', type: 'textarea', rows: 4, modalColSpan: 2 },
          { key: 'contract_doc_key', label: '契約PDFキー', readOnly: true, modalColSpan: 2 },
          { key: 'yakusoku_id', label: '関連yakusoku_id' },
          { key: 'source', label: '登録元' },
          { key: 'touroku_at', label: '登録日時', columnLabel: '登録日時', readOnly: true, format: formatMasterDateTime },
        ]}
      />

      {previewRow ? (
        <>
          <div className="admin-master-modal-backdrop" onClick={closePreview} />
          <section className="admin-master-modal" role="dialog" aria-modal="true" aria-label="契約プレビュー" onClick={(e) => e.stopPropagation()} style={{ width: 'min(980px, calc(100vw - 20px))' }}>
            <h2 style={{ margin: '0 0 10px' }}>契約プレビュー</h2>
            {renderKeiyakuPreview({ row: previewRow, parents: previewParents })}
            <div className="admin-master-modal-actions" style={{ marginTop: 12 }}>
              <button type="button" className="primary" onClick={closePreview}>閉じる</button>
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}
