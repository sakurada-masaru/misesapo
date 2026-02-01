/** 4枠 */
export const OFFICE_HOTBAR = [
  {
    id: 'task',
    role: 'target',
    label: '顧客',
    subItems: [
      { id: 'client-list', label: 'リスト', path: '/office/clients/list' },
      { id: 'client-karte', label: 'カルテ', path: '/office/clients/list' },
    ]
  },
  { id: 'status', role: 'status', label: '進捗' },
  { id: 'plan', role: 'plan', label: '予定' },
  { id: 'memo', role: 'log', label: '報告' },
];
