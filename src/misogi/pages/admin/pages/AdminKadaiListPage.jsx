import React from 'react';
import AdminMasterBase from './AdminMasterBase';

const CATEGORY_OPTIONS = [
  { value: 'ops', label: '運用' },
  { value: 'complaint', label: 'クレーム' },
  { value: 'quality', label: '品質' },
  { value: 'finance', label: '請求/与信' },
  { value: 'system', label: 'システム' },
  { value: 'admin_log', label: '管理ログ(提出)' },
  { value: 'other', label: 'その他' },
];

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

const SOURCE_OPTIONS = [
  { value: 'internal', label: 'internal' },
  { value: 'customer', label: 'customer' },
  { value: 'partner', label: 'partner' },
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

export default function AdminKadaiListPage() {
  return (
    <AdminMasterBase
      title="Kadaiリスト (kadai)"
      resource="kadai"
      idKey="kadai_id"
      localSearch={{
        label: '統合検索',
        placeholder: '件名/要件/店舗ID/取引先ID/屋号ID/人材IDなど',
        keys: [
          'kadai_id',
          'name',
          'category',
          'status',
          'priority',
          'source',
          'reported_at',
          'reported_by',
          'torihikisaki_id',
          'yagou_id',
          'tenpo_id',
          'jinzai_id',
          'fact',
          'request',
          'plan',
          'decision',
          'next_action',
        ],
      }}
      filters={[
        {
          key: 'category',
          label: 'カテゴリ',
          options: CATEGORY_OPTIONS,
          valueKey: 'value',
          labelKey: 'label',
        },
        {
          key: 'status',
          label: '進捗',
          options: STATUS_OPTIONS,
          valueKey: 'value',
          labelKey: 'label',
        },
        {
          key: 'source',
          label: '起点',
          options: SOURCE_OPTIONS,
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
        {
          key: 'jotai',
          label: '状態',
          options: [
            { value: 'yuko', label: 'yuko' },
            { value: 'torikeshi', label: 'torikeshi' },
          ],
          valueKey: 'value',
          labelKey: 'label',
        },
      ]}
      fixedNewValues={{
        category: 'ops',
        status: 'open',
        priority: 'mid',
        source: 'internal',
        reported_at: todayYmd(),
        reported_by: '管理',
        jotai: 'yuko',
      }}
      fields={[
        { key: 'name', label: '件名' },
        {
          key: 'category',
          label: 'カテゴリ',
          type: 'select',
          options: CATEGORY_OPTIONS,
          valueKey: 'value',
          labelKey: 'label',
          defaultValue: 'ops',
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
        {
          key: 'source',
          label: '起点(誰から)',
          type: 'select',
          options: SOURCE_OPTIONS,
          valueKey: 'value',
          labelKey: 'label',
          defaultValue: 'internal',
        },
        { key: 'reported_at', label: 'いつ(YYYY-MM-DD)' },
        { key: 'reported_by', label: '誰(氏名/窓口)' },
        { key: 'torihikisaki_id', label: 'torihikisaki_id(任意)' },
        { key: 'yagou_id', label: 'yagou_id(任意)' },
        { key: 'tenpo_id', label: 'tenpo_id(任意)' },
        { key: 'jinzai_id', label: 'jinzai_id(任意)' },
        { key: 'fact', label: '事実(Fact)' },
        { key: 'request', label: '要件(Request)' },
        { key: 'plan', label: '対応案(Plan)' },
        { key: 'decision', label: '判断/決定(任意)' },
        { key: 'next_action', label: '次アクション(任意)' },
      ]}
    />
  );
}

