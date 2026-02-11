/** 4枠 */
export const OFFICE_HOTBAR = [
  {
    id: 'task',
    role: 'target',
    label: '顧客',
    subItems: [
      // 旧 /office/clients/* は廃止。新マスター体系に統一。
      { id: 'torihikisaki-touroku', label: '登録(新)', path: '/admin/torihikisaki-touroku' },
      { id: 'torihikisaki-meibo', label: '名簿(新)', path: '/admin/torihikisaki-meibo' },
      { id: 'tenpo-master', label: '店舗(新)', path: '/admin/master/tenpo' },
    ]
  },
  { id: 'status', role: 'status', label: '進捗' },
  { id: 'plan', role: 'plan', label: '予定' },
  { id: 'memo', role: 'log', label: '報告', to: '/houkoku' },
];
