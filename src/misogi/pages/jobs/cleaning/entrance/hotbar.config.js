/** 清掃ホットバー */
export const CLEANING_HOTBAR = [
  {
    id: 'report',
    role: 'log',
    label: '報告',
    subItems: [
      { id: 'work-report-from-yotei', label: '予定から報告', path: '/jobs/cleaning/yotei' },
    ],
  },
  {
    id: 'plan',
    role: 'plan',
    label: '予定',
    subItems: [
      { id: 'my-yotei', label: '予定一覧', path: '/jobs/cleaning/yotei' },
      { id: 'availability-declare', label: '休み申請カレンダー', path: '/jobs/cleaning/availability-declare' },
    ],
  },
  {
    id: 'tools',
    role: 'status',
    label: 'ツール',
    subItems: [
      { id: 'flow-guide', label: '業務フロー', path: '/flow-guide' },
    ],
  },
  {
    id: 'settings',
    role: 'base',
    label: '設定',
  },
];
