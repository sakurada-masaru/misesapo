/**
 * 管理エントランス用ホットバー（4枠・他エントランスと同様）
 */
export const ADMIN_HOTBAR = [
  { id: 'work-reports', label: '業務報告', to: '/admin/work-reports', disabled: false },
  { id: 'workers', label: 'ワーカー管理', to: '/admin/workers', disabled: true },
  { id: 'store-profiles', label: 'カルテ管理', to: '/admin/store-profiles', disabled: true },
  { id: 'store-boxes', label: '共有ボックス', to: '/admin/store-boxes', disabled: true },
];
