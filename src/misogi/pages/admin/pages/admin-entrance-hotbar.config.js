/**
 * 管理エントランス用ホットバー（4枠・他エントランスと同様）
 */
export const ADMIN_HOTBAR = [
  {
    id: 'reports',
    label: '業務報告',
    subItems: [
      { id: 'cleaning-reports', label: '清掃報告受領', path: '/houkoku' },
      { id: 'all-reports', label: '全報告管理', path: '/admin/work-reports' },
      { id: 'houkoku-list', label: '新・報告一覧 (New)', path: '/admin/houkoku' },
    ]
  },
  {
    id: 'schedule',
    label: '清掃スケジュール',
    subItems: [
      { id: 'schedule-main', label: '清掃スケジュール(旧)', path: '/admin/schedule' },
      { id: 'yotei-hospital', label: '清掃管理(新)', path: '/admin/yotei' },
      { id: 'ugoki-dashboard', label: '管制ダッシュボード', path: '/admin/ugoki' },
      { id: 'yakusoku-list', label: '案件・定期管理', path: '/admin/yakusoku' },
    ]
  },
  {
    id: 'clients',
    role: 'target',
    label: '顧客',
    subItems: [
      { id: 'client-register', label: '登録', path: '/office/clients/new' },
      { id: 'client-list', label: 'リスト', path: '/office/clients/list' },
      { id: 'client-karte', label: 'カルテ', path: '/office/clients/list' },
    ]
  },
  { id: 'portal-operating-days', label: '玄関稼働日', to: '/admin/portal-operating-days', disabled: false },
];
