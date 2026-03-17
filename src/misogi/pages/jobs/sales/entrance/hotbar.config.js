/** 4枠 */
export const SALES_HOTBAR = [
  {
    id: 'customer',
    role: 'target',
    icon: 'customer',
    label: '顧客',
    subItems: [
      { id: 'client-master-new', label: '顧客マスタ登録', path: '/sales/master/customer' },
      { id: 'client-list', label: '顧客情報一覧', path: '/sales/clients/list' },
    ]
  },
  {
    id: 'progress',
    role: 'status',
    label: '進捗',
    subItems: [
      { id: 'first-response', label: '一次対応', path: '/sales/inbox' },
      { id: 'lead-new', label: 'リード登録', path: '/sales/leads/new' },
      { id: 'lead-info', label: 'リード情報', path: '/sales/leads' },
    ]
  },
  {
    id: 'schedule',
    role: 'plan',
    label: '予定',
    subItems: [
      { id: 'schedule-view', label: 'スケジュール', path: '/sales/schedule' },
    ]
  },
  { id: 'report', role: 'log', label: '報告', to: '/houkoku' },
];
