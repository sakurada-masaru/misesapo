import React from 'react';
import AdminMasterBase from './AdminMasterBase';

const CATEGORY_OPTIONS = [
  { value: 'ops', label: '運用' },
  { value: 'complaint', label: 'クレーム' },
  { value: 'quality', label: '品質' },
  { value: 'finance', label: '請求/与信' },
  { value: 'system', label: 'システム' },
  { value: 'other', label: 'その他' },
];

const FLOW_STAGE_OPTIONS = [
  { value: 'sales', label: '営業/提案' },
  { value: 'yakusoku', label: '契約(yakusoku)' },
  { value: 'yotei', label: '予定(yotei)' },
  { value: 'shigoto', label: '作業(shigoto)' },
  { value: 'houkoku', label: '報告(houkoku)' },
  { value: 'seikyu', label: '請求/支払' },
  { value: 'master', label: 'マスタ管理' },
  { value: 'other', label: 'その他' },
];

const STATUS_OPTIONS = [
  { value: 'open', label: '未着手(open)' },
  { value: 'in_progress', label: '対応中(in_progress)' },
  { value: 'blocked', label: '保留(blocked)' },
  { value: 'done', label: '完了(done)' },
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
      title="Kadaiリスト"
      resource="kadai"
      idKey="kadai_id"
      localSearch={{
        label: '統合検索',
        placeholder: '業務フロー段階/課題内容/店舗IDなど',
        keys: [
          'flow_stage',
          'kadai_id',
          'name',
          'category',
          'status',
          'reported_at',
          'reported_by',
          'tenpo_id',
          'fact',
          'plan',
        ],
      }}
      filters={[
        {
          key: 'flow_stage',
          label: '業務フロー段階',
          options: FLOW_STAGE_OPTIONS,
          valueKey: 'value',
          labelKey: 'label',
        },
        {
          key: 'category',
          label: '課題種別',
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
        flow_stage: 'yotei',
        category: 'ops',
        status: 'open',
        reported_at: todayYmd(),
        reported_by: '管理',
        jotai: 'yuko',
      }}
      fields={[
        {
          key: 'flow_stage',
          label: '業務フロー段階',
          type: 'select',
          options: FLOW_STAGE_OPTIONS,
          valueKey: 'value',
          labelKey: 'label',
          defaultValue: 'yotei',
        },
        { key: 'name', label: '課題（何が問題か）' },
        {
          key: 'category',
          label: '課題種別',
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
        { key: 'reported_at', label: '起票日(YYYY-MM-DD)' },
        { key: 'reported_by', label: '起票者(氏名/窓口)' },
        { key: 'tenpo_id', label: '対象店舗ID(任意)' },
        { key: 'fact', label: '課題内容（メモ）' },
        { key: 'plan', label: '対応方針（任意）' },
      ]}
    />
  );
}
