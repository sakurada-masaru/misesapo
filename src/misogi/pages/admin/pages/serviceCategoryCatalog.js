export const SERVICE_CATEGORY_OPTIONS = [
  { category: 'general_cleaning', name: '清掃全般' },
  { category: 'kitchen_cleaning', name: '厨房清掃' },
  { category: 'floor_cleaning', name: '床面清掃' },
  { category: 'aircon_cleaning', name: '空調清掃' },
  { category: 'restroom_cleaning', name: 'トイレ衛生' },
  { category: 'glass_wall_cleaning', name: '窓・壁面清掃' },
  { category: 'hygiene_haccp', name: '衛生/HACCP' },
  { category: 'pest_control', name: '害虫・害獣対策' },
  { category: 'facility_maintenance', name: '設備メンテ' },
  { category: 'repair_construction', name: '修繕・工事' },
  { category: 'waste_collection', name: '廃棄物・回収' },
  { category: 'admin_procedure', name: '申請・名義変更' },
  { category: 'training_consulting', name: '研修・コンサル' },
  { category: 'design_marketing', name: '制作・ブランディング' },
  { category: 'logistics_support', name: '輸送・代行' },
  { category: 'staffing_support', name: '人材支援' },
  { category: 'other_service', name: 'その他サービス' },
];

export const SERVICE_CONCEPT_OPTIONS = [
  { category: 'cleaning', name: '清掃系' },
  { category: 'kitchen_haccp', name: '衛生/HACCP系' },
  { category: 'aircon', name: '空調系' },
  { category: 'floor', name: '床面系' },
  { category: 'window_wall', name: '窓・壁面系' },
  { category: 'pest_hygiene', name: '害虫衛生系' },
  { category: 'maintenance', name: '設備メンテ系' },
  { category: 'other', name: 'その他' },
];

const SERVICE_CATEGORY_LABEL_MAP = new Map(
  SERVICE_CATEGORY_OPTIONS.map((it) => [String(it.category), String(it.name)])
);
const LEGACY_CATEGORY_LABEL_MAP = new Map([
  ['kitchen_haccp', '厨房衛生(HACCP)'],
  ['aircon', '空調設備'],
  ['floor', 'フロア清掃'],
  ['pest_hygiene', '害虫衛生'],
  ['maintenance', '設備メンテ'],
  ['window_wall', '窓・壁面'],
  ['cleaning', '清掃'],
  ['pest', '害虫'],
  ['other', 'その他'],
]);

export function getServiceCategoryLabel(rawValue) {
  const key = String(rawValue || '').trim();
  if (!key) return '未分類';
  return SERVICE_CATEGORY_LABEL_MAP.get(key) || LEGACY_CATEGORY_LABEL_MAP.get(key) || key;
}
