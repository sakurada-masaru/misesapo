/**
 * 清掃カルテテンプレート（店舗ID紐づき）
 * 店舗に1つ紐づくカルテの構造と初期レコードを定義する。
 * @see docs/ADMIN_STORE_CHART_REF.md
 */

/** プラン頻度の選択肢 */
export const PLAN_FREQUENCY_OPTIONS = [
  { value: 'monthly', label: '毎月' },
  { value: 'bimonthly', label: '隔月' },
  { value: 'quarterly', label: '3ヶ月' },
  { value: 'semiannual', label: '6ヶ月' },
  { value: 'yearly', label: '年1' },
  { value: 'spot', label: 'スポット' },
];

/** カルテの全フィールド（空の初期値） */
const KARTE_EMPTY_FIELDS = {
  chart_id: null,
  store_id: null,
  brand_id: null,
  client_id: null,
  status: 'active',
  version: 'complete',
  plan_frequency: 'semiannual',
  security_box_number: '',
  equipment: [],
  services: [],
  consumables: [],
  cleaning_staff_history: [],
  notes: '',
  // 初回ヒアリング・基本ヒアリング
  issue: '',
  environment: '',
  staff_min: '',
  staff_max: '',
  hours: '',
  cleaning_frequency: '',
  // 店舗仕様
  area_sqm: '',
  area_tatami: '',
  ceiling_height: '',
  electrical_amps: '',
  toilet_count: '',
  aircon_count: '',
  wall_material: '',
  floor_material: '',
  breaker_location: '',
  key_location: '',
  entrances: '',
  staff_room: '',
  breaker_photo_url: '',
  key_photo_url: '',
  seat_counter: false,
  seat_box: false,
  seat_zashiki: false,
  // 注意事項・計画
  aircon_state: '',
  kitchen_state: '',
  hotspots: '',
  intake_notes: '',
  last_clean: '',
  plan: '',
  self_rating: '',
};

/**
 * 店舗IDに紐づいたカルテの新規テンプレートを作成する。
 * 店舗情報から brand_id / client_id を引き継ぐ。
 * @param {string} storeId - 店舗ID（必須）
 * @param {object} [store] - 店舗オブジェクト（任意。brand_id, client_id を引き継ぐ）
 * @returns {object} 店舗ID紐づきのカルテレコード（初期値）
 */
export function createKarteForStore(storeId, store = {}) {
  if (!storeId) {
    throw new Error('karteTemplate: storeId is required');
  }
  return {
    ...KARTE_EMPTY_FIELDS,
    store_id: storeId,
    brand_id: store.brand_id ?? null,
    client_id: store.client_id ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * 既存のカルテに不足しているフィールドをテンプレートで補う（マージ用）。
 * @param {object} existing - 既存のカルテ（localStorage や API から取得）
 * @param {string} storeId - 店舗ID
 * @param {object} [store] - 店舗オブジェクト
 */
export function mergeKarteWithTemplate(existing, storeId, store = {}) {
  const template = createKarteForStore(storeId, store);
  return {
    ...template,
    ...existing,
    store_id: storeId,
    brand_id: existing.brand_id ?? store.brand_id ?? null,
    client_id: existing.client_id ?? store.client_id ?? null,
    equipment: Array.isArray(existing.equipment) ? existing.equipment : template.equipment,
    services: Array.isArray(existing.services) ? existing.services : template.services,
    consumables: Array.isArray(existing.consumables) ? existing.consumables : template.consumables,
    cleaning_staff_history: Array.isArray(existing.cleaning_staff_history) ? existing.cleaning_staff_history : template.cleaning_staff_history,
  };
}

export default createKarteForStore;
