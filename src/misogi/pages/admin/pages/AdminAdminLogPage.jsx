import React from 'react';
import AdminMasterBase from './AdminMasterBase';

const STATUS_OPTIONS = [
  { value: 'open', label: 'open' },
  { value: 'in_progress', label: 'in_progress' },
  { value: 'blocked', label: 'blocked' },
  { value: 'done', label: 'done' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'low' },
  { value: 'mid', label: 'mid' },
  { value: 'high', label: 'high' },
  { value: 'urgent', label: 'urgent' },
];

function todayYmd() {
  try {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return '';
  }
}

/**
 * 管理専用の「提出/ログ」ページ。
 *
 * - Field(現場) に narrative を書かせない原則のため、このページは admin が使う前提。
 * - 保存内容は structured fields に分離（Fact/Interpretation/Decision/NextAction）。
 */
export default function AdminAdminLogPage() {
  return (
    <AdminMasterBase
      title="管理ログ(提出) (kadai/admin_log)"
      resource="kadai"
      idKey="kadai_id"
      fixedQuery={{ category: 'admin_log', jotai: 'yuko' }}
      fixedNewValues={{
        category: 'admin_log',
        status: 'open',
        priority: 'mid',
        source: 'internal',
        reported_at: todayYmd(),
        reported_by: '管理',
        jotai: 'yuko',
      }}
      localSearch={{
        label: '検索',
        placeholder: '件名/Fact/Decision/店舗IDなど',
        keys: [
          'kadai_id',
          'name',
          'reported_at',
          'reported_by',
          'torihikisaki_id',
          'yagou_id',
          'tenpo_id',
          'jinzai_id',
          'fact',
          'interpretation',
          'decision',
          'next_action',
          'links',
        ],
      }}
      filters={[
        {
          key: 'status',
          label: '進捗',
          options: STATUS_OPTIONS,
          valueKey: 'value',
          labelKey: 'label',
        },
        {
          key: 'priority',
          label: '優先度',
          options: PRIORITY_OPTIONS,
          valueKey: 'value',
          labelKey: 'label',
        },
      ]}
      fields={[
        { key: 'name', label: '件名' },
        {
          key: 'category',
          label: 'カテゴリ',
          readOnly: true,
          format: () => 'admin_log',
        },
        {
          key: 'status',
          label: '進捗',
          type: 'select',
          options: STATUS_OPTIONS,
          valueKey: 'value',
          labelKey: 'label',
          defaultValue: 'open',
        },
        {
          key: 'priority',
          label: '優先度',
          type: 'select',
          options: PRIORITY_OPTIONS,
          valueKey: 'value',
          labelKey: 'label',
          defaultValue: 'mid',
        },
        { key: 'reported_at', label: '日付(YYYY-MM-DD)' },
        { key: 'reported_by', label: '提出者(管理)' },

        { key: 'torihikisaki_id', label: 'torihikisaki_id(任意)' },
        { key: 'yagou_id', label: 'yagou_id(任意)' },
        { key: 'tenpo_id', label: 'tenpo_id(任意)' },
        { key: 'jinzai_id', label: 'jinzai_id(任意)' },

        // Structured log fields (line-system style)
        { key: 'fact', label: 'Fact(事実)' },
        { key: 'interpretation', label: 'Interpretation(解釈/仮説)' },
        { key: 'decision', label: 'Decision(判断/責任)' },
        { key: 'next_action', label: 'Next(次アクション)' },

        { key: 'links', label: '関連リンク(任意)' },
      ]}
    />
  );
}

