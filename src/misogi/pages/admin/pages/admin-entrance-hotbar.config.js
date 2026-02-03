/**
 * 管理エントランス用ホットバー（4枠・他エントランスと同様）
 */
export const ADMIN_HOTBAR = [
  { id: 'work-reports', label: '業務報告', to: '/admin/work-reports', disabled: false },
  { id: 'schedule', label: '清掃スケジュール', to: '/admin/schedule', disabled: false },
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
  { id: 'workers', label: 'ワーカー管理', to: '/admin/workers', disabled: true },
];
