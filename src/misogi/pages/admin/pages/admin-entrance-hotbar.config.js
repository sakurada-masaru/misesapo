/**
 * 管理エントランス用ホットバー（4枠・他エントランスと同様）
 */
export const ADMIN_HOTBAR = [
  {
    id: 'reports',
    label: '報告',
    subItems: [
      { id: 'houkoku-list', label: '報告一覧', path: '/admin/houkoku', group: '報告' },
      { id: 'admin-log', label: '管理ログ(提出)', path: '/admin/admin-log', group: '提出' },
    ]
  },
  {
    id: 'schedule',
    label: '予定',
    subItems: [
      { id: 'yotei', label: 'Yotei', path: '/admin/yotei', group: '予定' },
      { id: 'ugoki', label: 'Ugoki', path: '/admin/ugoki', group: '予定' },
      { id: 'yakusoku', label: 'Yakusoku', path: '/admin/yakusoku', group: '予定' },
    ]
  },
  {
    id: 'clients',
    role: 'target',
    label: '情報',
    subItems: [
      { id: 'torihikisaki-touroku', label: '顧客登録(新)', path: '/admin/torihikisaki-touroku', group: '登録' },
      { id: 'torihikisaki-meibo', label: '取引先名簿', path: '/admin/torihikisaki-meibo', group: '名簿' },
      { id: 'jinzai-meibo', label: '人材名簿', path: '/admin/jinzai-meibo', group: '名簿' },
      { id: 'master-torihikisaki', label: '取引先マスタ', path: '/admin/master/torihikisaki', group: 'マスタ(顧客)' },
      { id: 'master-yagou', label: '屋号マスタ', path: '/admin/master/yagou', group: 'マスタ(顧客)' },
      { id: 'master-tenpo', label: '店舗マスタ', path: '/admin/master/tenpo', group: 'マスタ(顧客)' },
      { id: 'master-souko', label: '顧客ストレージ', path: '/admin/master/souko', group: 'マスタ(顧客)' },
      { id: 'master-jinzai', label: '人材マスタ', path: '/admin/master/jinzai', group: 'マスタ(人材)' },
      { id: 'master-jinzai-busho', label: '人材部署', path: '/admin/master/jinzai-busho', group: 'マスタ(人材)' },
      { id: 'master-jinzai-shokushu', label: '人材職種', path: '/admin/master/jinzai-shokushu', group: 'マスタ(人材)' },
      { id: 'master-service', label: 'サービスマスタ', path: '/admin/master/service', group: 'マスタ(運用)' },
      { id: 'master-zaiko', label: '在庫管理DB', path: '/admin/master/zaiko', group: 'マスタ(運用)' },
      { id: 'zaiko-order', label: '在庫発注フォーム', path: '/admin/master/zaiko-order', group: 'マスタ(運用)' },
    ]
  },
  {
    // 4枠固定（JobEntranceScreenの仕様）なので、運用メニューの残りをここに寄せる
    id: 'tools',
    label: '運用ツール',
    subItems: [
      { id: 'flow-guide', label: '業務フロー', path: '/flow-guide', group: '基本' },
      { id: 'kadai', label: 'Kadaiリスト', path: '/admin/kadai', group: '基本' },
    ],
  },
];
