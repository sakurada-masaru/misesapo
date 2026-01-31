/**
 * 顧客一覧の localStorage 管理（/sales/customers）
 * Key: misogi_sales_customers
 * 形式: 配列 JSON [{ storeKey, company, store, address, tel, contact, email }, ...]
 */

export const STORAGE_KEY = 'misogi_sales_customers';

/**
 * 文字列をスラッグ化（URL・キー用）
 * @param {string} str
 * @returns {string}
 */
export function slug(str) {
  const s = String(str ?? '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_\u3040-\u9FFFー\-]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return s || 'store';
}

/**
 * 店舗キーを生成（被り回避で timestamp 付与）
 * @param {string} company
 * @param {string} store
 * @returns {string}
 */
export function generateStoreKey(company, store) {
  const base = slug(company + '_' + store) || 'store';
  return `${base}_${Date.now()}`;
}

/**
 * localStorage から顧客配列を取得
 * @returns {Array<{ storeKey: string, company: string, store: string, address: string, tel: string, contact: string, email: string }>}
 */
export function getCustomers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * 顧客配列を localStorage に保存
 * @param {Array<{ storeKey: string, company: string, store: string, address: string, tel: string, contact: string, email: string }>} list
 */
export function setCustomers(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

/** 初期データ（localStorage が空のときのみ投入） */
function buildSeed() {
  return [
    {
      storeKey: generateStoreKey('セブン&アイ', 'セブンイレブン新宿店'),
      company: 'セブン&アイ',
      store: 'セブンイレブン新宿店',
      address: '東京都新宿区西新宿1-1-1',
      tel: '03-1234-5678',
      contact: '山田',
      email: 'shinjuku@example.com',
    },
    {
      storeKey: generateStoreKey('ローソン', 'ローソン池袋東口店'),
      company: 'ローソン',
      store: 'ローソン池袋東口店',
      address: '東京都豊島区東池袋1-2-3',
      tel: '',
      contact: '',
      email: '',
    },
  ];
}

/**
 * 顧客一覧を取得。空なら初期データを投入して返す
 * @returns {Array<{ storeKey: string, company: string, store: string, address: string, tel: string, contact: string, email: string }>}
 */
export function getCustomersWithSeed() {
  const list = getCustomers();
  if (list.length === 0) {
    const seed = buildSeed();
    setCustomers(seed);
    return seed;
  }
  return list;
}
