/** 4枠 */
export const SALES_HOTBAR = [
  {
    id: 'customer',
    role: 'target',
    icon: 'customer',
    label: '顧客',
    subItems: [
      { id: 'client-master-new', label: '顧客登録申請', path: '/sales/master/customer' },
      { id: 'client-list', label: '顧客情報一覧', path: '/sales/clients/list' },
    ]
  },
  {
    id: 'progress',
    role: 'status',
    label: '進捗',
    directOnTap: true,
    subItems: [
      { id: 'lead-info', label: '進捗一覧', path: '/sales/leads' },
      { id: 'first-response', label: '一次対応Inbox', path: '/sales/inbox' },
      { id: 'lead-new', label: '新規リード登録', path: '/sales/leads/new' },
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
