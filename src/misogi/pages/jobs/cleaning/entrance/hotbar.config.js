/** 清掃ホットバー */
export const CLEANING_HOTBAR = [
  {
    id: 'report',
    role: 'log',
    label: '報告',
    subItems: [
      { id: 'work-report', label: '業務報告', path: '/jobs/cleaning/report' },
    ],
  },
  { id: 'plan', role: 'plan', label: '予定', to: '/jobs/cleaning/yotei' },
  {
    id: 'tools',
    role: 'status',
    label: 'ツール',
    subItems: [
      { id: 'flow-guide', label: '業務フロー', path: '/flow-guide' },
    ],
  },
];
