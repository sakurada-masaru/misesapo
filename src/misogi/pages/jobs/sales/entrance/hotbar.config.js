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
    role: 'plan',
    label: '予定',
    directOnTap: true,
    subItems: [
      { id: 'sales-schedule', label: 'スケジュール', path: '/sales/schedule' },
    ]
  },
  {
    id: 'schedule',
    role: 'tools',
    label: '打刻',
    subItems: [
      { id: 'sales-attendance', label: '勤怠打刻', path: 'https://f.ieyasu.co/misesapo/login/' },
      { id: 'sales-monshin-create', label: '問診票作成', path: '/admin/torihikisaki-touroku' },
    ]
  },
  { id: 'report', role: 'log', label: '報告', to: '/houkoku' },
];
