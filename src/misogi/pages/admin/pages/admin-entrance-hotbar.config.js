/**
 * 管理エントランス用ナビ設定
 * - 管理エントランスは左サイドバー表示（JobEntranceScreen 側で admin をサイドバー化）
 * - 他ジョブとの互換のためフォーマットは HOTBAR 設定を流用
 */
export const ADMIN_HOTBAR = [
  {
    id: 'dashboard',
    label: 'ダッシュボード',
    direct: true,
    subItems: [
      { id: 'admin-dashboard', label: 'ダッシュボード', path: '/admin/dashboard', group: 'ダッシュボード' },
    ]
  },
  {
    id: 'filebox',
    label: 'ファイルボックス',
    direct: true,
    subItems: [
      { id: 'company-filebox', label: 'ファイルボックス', path: '/admin/filebox', group: 'ファイルボックス' },
    ]
  },
  {
    id: 'kintai',
    label: '勤怠管理',
    subItems: [
      { id: 'kintai-link', label: '勤怠管理', path: 'https://f.ieyasu.co/misesapo/login/', group: '勤怠管理' },
    ]
  },
  {
    id: 'reports',
    label: '業務報告',
    subItems: [
      { id: 'houkoku-list', label: '業務報告一覧', path: '/admin/houkoku', group: '業務報告' },
      { id: 'admin-log', label: '管理業務記録一覧', path: '/admin/admin-log', group: '業務報告' },
    ]
  },
  {
    id: 'workflow-requests',
    label: '業務依頼',
    subItems: [
      { id: 'workflow-request-doc-create', label: '依頼書作成', path: '/admin/request-doc', group: '業務依頼' },
    ]
  },
  {
    id: 'schedule',
    label: 'スケジュール管理',
    subItems: [
      { id: 'yotei', label: 'yotei', path: '/admin/yotei', group: 'スケジュール管理' },
      { id: 'yasumi', label: 'yasumi', path: '/admin/yasumi', group: 'スケジュール管理' },
      { id: 'ugoki', label: 'ugoki', path: '/admin/ugoki', group: 'スケジュール管理' },
      { id: 'yakusoku', label: 'yakusoku', path: '/admin/yakusoku', group: 'スケジュール管理' },
    ]
  },
  {
    id: 'customers',
    role: 'target',
    label: '顧客管理',
    subItems: [
      { id: 'customer-master', label: '顧客マスタ', path: '/admin/master/customer', group: '顧客管理' },
      { id: 'torihikisaki-meibo', label: '顧客情報一覧(取引先名簿)', path: '/admin/torihikisaki-meibo', group: '顧客管理' },
      { id: 'master-souko', label: '顧客ストレージ', path: '/admin/master/souko', group: '顧客管理' },
    ]
  },
  {
    id: 'staff',
    role: 'target',
    label: '人材管理',
    subItems: [
      { id: 'smarthr-link', label: 'スマートHR', path: 'https://misesapo.smarthr.jp/home', group: '人材管理' },
      { id: 'cleaning-sales', label: '清掃売上管理', path: '/admin/cleaning-sales', group: '人材管理' },
    ]
  },
  {
    id: 'masters',
    role: 'target',
    label: 'マスタ情報',
    subItems: [
      { id: 'master-customer', label: '顧客マスタ', path: '/admin/master/customer', group: 'マスタ(顧客)' },
      { id: 'master-jinzai', label: '人材マスタ', path: '/admin/master/jinzai', group: 'マスタ(人材)' },
      { id: 'master-jinzai-busho', label: '人材部署', path: '/admin/master/jinzai-busho', group: 'マスタ(人材)' },
      { id: 'master-jinzai-shokushu', label: '人材職種', path: '/admin/master/jinzai-shokushu', group: 'マスタ(人材)' },
      { id: 'master-service', label: 'サービスマスタ', path: '/admin/master/service', group: 'マスタ(運用)' },
      { id: 'master-keiyaku', label: '契約マスタ', path: '/admin/master/keiyaku', group: 'マスタ(運用)' },
      { id: 'master-zaiko', label: '在庫管理DB', path: '/admin/master/zaiko', group: 'マスタ(運用)' },
    ]
  },
  {
    // 4枠固定（JobEntranceScreenの仕様）なので、運用メニューの残りをここに寄せる
    id: 'tools',
    label: '運用ツール',
    subItems: [
      { id: 'flow-guide', label: '業務フロー', path: '/flow-guide', group: '基本' },
      { id: 'kadai', label: '課題リスト', path: '/admin/kadai', group: '基本' },
      { id: 'cleaning-houkoku-tool', label: '清掃レポート作成', path: '/admin/tools/cleaning-houkoku', group: '報告書' },
      { id: 'cleaning-houkoku-list', label: 'レポート一覧', path: '/admin/tools/cleaning-houkoku/list', group: '報告書' },
      { id: 'zaiko-order', label: '在庫発注フォーム', path: '/admin/master/zaiko-order', group: '基本' },
    ],
  },
];
