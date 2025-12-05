/**
 * ミセサポ データユーティリティ
 * 
 * AWS (DynamoDB) と Azure (Dataverse) の両システムに対応した
 * 統一的なデータアクセスレイヤー
 * 
 * ============================================================
 * データ構造方針（Azure Dataverseに準拠）
 * ============================================================
 * 
 * 【3層構造】
 * - 第1層: 取引先（clients）- 企業/個人
 * - 第2層: ブランド（brands）- 店舗名/屋号
 * - 第3層: 店舗（stores）- 実店舗/支店
 * 
 * 【ID形式】
 * - AWS現行: プレフィックス+連番 (ST0086, CL0018, BR0032)
 * - AWS旧: 数値のみ (101, 184)
 * - Azure: GUID (36文字)
 * 
 * 【データリンクルール】
 * - 契約 → 第1層（企業）
 * - 見積もり/スケジュール/レポート → 第3層（店舗）、フォールバック: 第2層→第1層
 * 
 * ============================================================
 */

(function(global) {
  'use strict';

  // ====================
  // 定数定義
  // ====================
  
  const ID_PREFIX = {
    CLIENT: 'CL',
    BRAND: 'BR',
    STORE: 'ST',
    SCHEDULE: 'SCH-',
    ESTIMATE: 'EST',
    REPORT: 'RPT',
    WORKER: 'W',
    CUSTOMER: 'CU',
    USER: 'USR'
  };

  const STATUS = {
    // 共通ステータス
    ACTIVE: 'active',
    SUSPENDED: 'suspended',
    TERMINATED: 'terminated',
    
    // 契約ステータス
    CONTRACT_PENDING: 'contract_pending',
    PENDING_APPROVAL: 'pending_approval',
    PENDING_CUSTOMER_INFO: 'pending_customer_info',
    
    // 営業ステータス
    APPROACH_BEFORE: 'approach_before',
    NEGOTIATING: 'negotiating',
    NEGOTIATED: 'negotiated',
    LOST: 'lost',
    
    // スケジュールステータス
    DRAFT: 'draft',
    SCHEDULED: 'scheduled',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    
    // 見積もりステータス
    PENDING: 'pending',
    PROCESSING: 'processing',
    REJECTED: 'rejected',
    
    // レポートステータス
    APPROVED: 'approved',
    PUBLISHED: 'published'
  };

  const STATUS_LABELS = {
    // 日本語ラベル
    [STATUS.ACTIVE]: '稼働中',
    [STATUS.SUSPENDED]: '休止中',
    [STATUS.TERMINATED]: '契約終了',
    [STATUS.CONTRACT_PENDING]: '契約作業中',
    [STATUS.PENDING_APPROVAL]: '承認待ち',
    [STATUS.PENDING_CUSTOMER_INFO]: '情報入力待ち',
    [STATUS.APPROACH_BEFORE]: 'アプローチ前',
    [STATUS.NEGOTIATING]: '検討中',
    [STATUS.NEGOTIATED]: '商談済',
    [STATUS.LOST]: '失注',
    [STATUS.DRAFT]: '仮押さえ',
    [STATUS.SCHEDULED]: '予定',
    [STATUS.IN_PROGRESS]: '作業中',
    [STATUS.COMPLETED]: '完了',
    [STATUS.CANCELLED]: 'キャンセル',
    [STATUS.PENDING]: '未処理',
    [STATUS.PROCESSING]: '作成中',
    [STATUS.REJECTED]: '却下',
    [STATUS.APPROVED]: '承認済み',
    [STATUS.PUBLISHED]: '公開済み',
    // 日本語ステータスのマッピング（CSVインポート対応）
    '稼働中': '稼働中',
    '休止中': '休止中',
    '契約終了': '契約終了',
    '契約作業中': '契約作業中',
    '検討中': '検討中',
    'アプローチ前': 'アプローチ前',
    '商談済': '商談済',
    '失注': '失注'
  };

  // ====================
  // ID操作
  // ====================

  const IdUtils = {
    /**
     * IDを正規化（プレフィックス+5桁形式に統一）
     */
    normalize(id, prefix) {
      if (!id) return null;
      const str = String(id);
      
      // 既に正しい形式の場合（プレフィックス+5桁）
      if (str.startsWith(prefix) && /^\d{5}$/.test(str.substring(prefix.length))) {
        return str;
      }
      
      // プレフィックス付きだが桁数が異なる場合
      if (str.startsWith(prefix)) {
        const numPart = str.substring(prefix.length);
        if (/^\d+$/.test(numPart)) {
          return `${prefix}${numPart.padStart(5, '0')}`;
        }
      }
      
      // 数値のみの場合はプレフィックス付きに変換
      if (/^\d+$/.test(str)) {
        return `${prefix}${str.padStart(5, '0')}`;
      }
      
      return str;
    },

    /**
     * IDから数値部分を抽出
     */
    extractNumber(id) {
      if (!id) return null;
      const str = String(id);
      // プレフィックスを除去して数値部分を取得
      const match = str.match(/\d+$/);
      return match ? match[0].replace(/^0+/, '') || '0' : str;
    },

    /**
     * 2つのIDが同じエンティティを指しているか比較
     */
    isSame(id1, id2) {
      if (!id1 || !id2) return false;
      if (String(id1) === String(id2)) return true;
      return this.extractNumber(id1) === this.extractNumber(id2);
    },

    /**
     * 新しいIDを生成（非推奨: バックエンドで生成することを推奨）
     * @deprecated バックエンドでID生成を行うことを推奨します
     */
    generate(prefix) {
      console.warn('IdUtils.generate() is deprecated. ID generation should be handled by the backend.');
      return `${prefix}${Date.now()}`;
    },
    
    /**
     * 連番IDを生成（5桁形式）
     * 注意: この関数は最大IDを取得できないため、バックエンドでの実装を推奨
     */
    generateSequential(prefix, number) {
      return `${prefix}${String(number).padStart(5, '0')}`;
    },

    // 各エンティティ用のショートカット
    normalizeStore(id) { return this.normalize(id, ID_PREFIX.STORE); },
    normalizeClient(id) { return this.normalize(id, ID_PREFIX.CLIENT); },
    normalizeBrand(id) { return this.normalize(id, ID_PREFIX.BRAND); },
    normalizeCustomer(id) { return this.normalize(id, ID_PREFIX.CUSTOMER); },
    normalizeWorker(id) { return this.normalize(id, ID_PREFIX.WORKER); },
    // 非推奨: バックエンドでID生成を行うことを推奨
    generateStore() { return this.generate(ID_PREFIX.STORE); },
    generateClient() { return this.generate(ID_PREFIX.CLIENT); },
    generateBrand() { return this.generate(ID_PREFIX.BRAND); },
    generateCustomer() { return this.generate(ID_PREFIX.CUSTOMER); },
    generateWorker() { return this.generate(ID_PREFIX.WORKER); },
    generateSchedule() { return this.generate(ID_PREFIX.SCHEDULE); },
    generateEstimate() { return this.generate(ID_PREFIX.ESTIMATE); },
    generateReport() { return this.generate(ID_PREFIX.REPORT); }
  };

  // ====================
  // エンティティ検索
  // ====================

  const EntityFinder = {
    /**
     * 店舗を検索（新旧両方のIDに対応）
     */
    findStore(stores, storeId) {
      if (!stores || !storeId) return null;
      
      // 完全一致
      let entity = stores.find(s => String(s.id) === String(storeId));
      if (entity) return entity;
      
      // 正規化して検索
      const normalized = IdUtils.normalizeStore(storeId);
      entity = stores.find(s => String(s.id) === normalized);
      if (entity) return entity;
      
      // 数値部分で検索
      const numId = IdUtils.extractNumber(storeId);
      return stores.find(s => IdUtils.extractNumber(s.id) === numId) || null;
    },

    /**
     * 汎用エンティティ検索
     */
    find(entities, id, prefix) {
      if (!entities || !id) return null;
      
      let entity = entities.find(e => String(e.id) === String(id));
      if (entity) return entity;
      
      const normalized = IdUtils.normalize(id, prefix);
      entity = entities.find(e => String(e.id) === normalized);
      if (entity) return entity;
      
      const numId = IdUtils.extractNumber(id);
      return entities.find(e => IdUtils.extractNumber(e.id) === numId) || null;
    },

    findClient(clients, id) { return this.find(clients, id, ID_PREFIX.CLIENT); },
    findBrand(brands, id) { return this.find(brands, id, ID_PREFIX.BRAND); }
  };

  // ====================
  // データ正規化
  // ====================

  const Normalizer = {
    /**
     * スケジュールデータを正規化
     * 旧システム(Laravel)と新システム(AWS)の差異を吸収
     */
    schedule(data) {
      if (!data) return null;
      return {
        id: data.id,
        store_id: data.store_id,
        store_name: data.store_name || null,
        date: data.scheduled_date || data.desired_date || null,
        time: data.scheduled_time || data.desired_time || null,
        duration: data.duration_minutes || 60,
        worker_id: data.worker_id || null,
        worker_name: data.worker_name || null,
        status: data.status || STATUS.SCHEDULED,
        notes: data.notes || '',
        work_content: data.name || data.notes || '', // 旧システムはnameに作業内容
        created_at: data.created_at,
        updated_at: data.updated_at,
        _raw: data
      };
    },

    /**
     * レポートデータを正規化
     */
    report(data) {
      if (!data) return null;
      return {
        id: data.report_id || data.id,
        store_id: data.store_id,
        store_name: data.store_name || null,
        worker_id: data.staff_id || data.worker_id,
        worker_name: data.staff_name || null,
        date: data.cleaning_date || data.work_date || null,
        start_time: data.cleaning_start_time || data.start_time || null,
        end_time: data.cleaning_end_time || data.end_time || null,
        status: data.status === 'published' ? STATUS.APPROVED : data.status,
        work_items: data.work_items || [],
        notes: data.work_memo || data.notes || '',
        photos: data.photos || { before: [], after: [] },
        created_at: data.created_at,
        _raw: data
      };
    },

    /**
     * 見積もりデータを正規化
     */
    estimate(data) {
      if (!data) return null;
      return {
        id: data.id,
        store_id: data.store_id,
        store_name: data.store_name || null,
        items: data.items || [],
        total: data.total || 0,
        status: data.status || STATUS.PENDING,
        notes: data.notes || '',
        created_by: data.created_by,
        created_at: data.created_at,
        _raw: data
      };
    },

    /**
     * 店舗データを正規化（Azure Dataverse形式に準拠）
     */
    store(data) {
      if (!data) return null;
      return {
        id: data.id,
        name: data.name || '',
        client_id: data.client_id || null,
        brand_id: data.brand_id || null,
        // 住所（AWS分割形式）
        postcode: data.postcode || '',
        pref: data.pref || '',
        city: data.city || '',
        address1: data.address1 || '',
        address2: data.address2 || '',
        // 連絡先
        phone: data.phone || '',
        email: data.email || '',
        contact_person: data.contact_person || '',
        // Azure追加フィールド
        google_map: data.google_map || '',
        start_date: data.start_date || null,
        storage_folder: data.storage_folder || '',
        storage_share: data.storage_share || '',
        // ステータス
        status: data.status || STATUS.ACTIVE,
        // メモ
        notes: data.notes || '',
        sales_notes: data.sales_notes || '',
        // メタ
        registration_type: data.registration_type || 'manual',
        created_at: data.created_at,
        updated_at: data.updated_at,
        _raw: data
      };
    }
  };

  // ====================
  // フィルタリング
  // ====================

  const Filter = {
    /**
     * 店舗IDでフィルタリング（新旧両方のIDに対応）
     */
    byStoreId(items, storeId) {
      if (!items || !storeId) return [];
      const numId = IdUtils.extractNumber(storeId);
      return items.filter(item => {
        const itemNumId = IdUtils.extractNumber(item.store_id);
        return String(item.store_id) === String(storeId) || itemNumId === numId;
      });
    },

    /**
     * ブランドIDでフィルタリング
     */
    byBrandId(items, brandId) {
      if (!items || !brandId) return [];
      return items.filter(item => IdUtils.isSame(item.brand_id, brandId));
    },

    /**
     * 取引先IDでフィルタリング
     */
    byClientId(items, clientId) {
      if (!items || !clientId) return [];
      return items.filter(item => IdUtils.isSame(item.client_id, clientId));
    },

    /**
     * 日付範囲でフィルタリング
     */
    byDateRange(items, dateField, from, to) {
      if (!items) return [];
      return items.filter(item => {
        const date = item[dateField];
        if (!date) return false;
        if (from && date < from) return false;
        if (to && date > to) return false;
        return true;
      });
    },

    /**
     * ステータスでフィルタリング
     */
    byStatus(items, status) {
      if (!items || !status) return items || [];
      return items.filter(item => item.status === status);
    }
  };

  // ====================
  // 表示ヘルパー
  // ====================

  const Display = {
    /**
     * 店舗名を取得
     */
    getStoreName(stores, storeId, fallback) {
      const store = EntityFinder.findStore(stores, storeId);
      if (store) return store.name;
      if (fallback) return fallback;
      return `店舗ID: ${storeId}`;
    },

    /**
     * ステータスラベルを取得
     */
    getStatusLabel(status) {
      return STATUS_LABELS[status] || status || '未設定';
    },

    /**
     * 日付フォーマット
     */
    formatDate(dateStr) {
      if (!dateStr) return '-';
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
    },

    /**
     * 日時フォーマット
     */
    formatDateTime(dateStr) {
      if (!dateStr) return '-';
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      const h = date.getHours();
      const m = String(date.getMinutes()).padStart(2, '0');
      return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${h}:${m}`;
    },

    /**
     * 金額フォーマット
     */
    formatCurrency(amount) {
      if (amount == null) return '-';
      return `¥${Number(amount).toLocaleString()}`;
    },

    /**
     * HTMLエスケープ
     */
    escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
  };

  // ====================
  // 3層構造ヘルパー
  // ====================

  const Hierarchy = {
    /**
     * 店舗から3層構造を取得
     */
    getFromStore(store, clients, brands) {
      if (!store) return { client: null, brand: null, store: null };
      
      const brand = store.brand_id ? EntityFinder.findBrand(brands, store.brand_id) : null;
      const client = brand?.client_id 
        ? EntityFinder.findClient(clients, brand.client_id)
        : (store.client_id ? EntityFinder.findClient(clients, store.client_id) : null);
      
      return { client, brand, store };
    },

    /**
     * ブランドから所属店舗を取得
     */
    getStoresByBrand(stores, brandId) {
      return Filter.byBrandId(stores, brandId);
    },

    /**
     * 取引先から所属ブランドを取得
     */
    getBrandsByClient(brands, clientId) {
      return Filter.byClientId(brands, clientId);
    },

    /**
     * 取引先から所属店舗を取得（ブランド経由）
     */
    getStoresByClient(stores, brands, clientId) {
      const clientBrands = this.getBrandsByClient(brands, clientId);
      const brandIds = clientBrands.map(b => b.id);
      return stores.filter(s => brandIds.includes(s.brand_id) || IdUtils.isSame(s.client_id, clientId));
    }
  };

  // ====================
  // 公開API
  // ====================

  const DataUtils = {
    // 定数
    ID_PREFIX,
    STATUS,
    STATUS_LABELS,
    
    // ID操作
    ...IdUtils,
    IdUtils,
    
    // エンティティ検索
    findStore: EntityFinder.findStore.bind(EntityFinder),
    findClient: EntityFinder.findClient.bind(EntityFinder),
    findBrand: EntityFinder.findBrand.bind(EntityFinder),
    EntityFinder,
    
    // 正規化
    normalizeSchedule: Normalizer.schedule,
    normalizeReport: Normalizer.report,
    normalizeEstimate: Normalizer.estimate,
    normalizeStore: Normalizer.store,
    Normalizer,
    
    // フィルタリング
    filterByStoreId: Filter.byStoreId,
    filterByBrandId: Filter.byBrandId,
    filterByClientId: Filter.byClientId,
    filterByDateRange: Filter.byDateRange,
    filterByStatus: Filter.byStatus,
    Filter,
    
    // 表示ヘルパー
    getStoreName: Display.getStoreName,
    getStatusLabel: Display.getStatusLabel,
    formatDate: Display.formatDate,
    formatDateTime: Display.formatDateTime,
    formatCurrency: Display.formatCurrency,
    escapeHtml: Display.escapeHtml,
    Display,
    
    // 3層構造
    getHierarchy: Hierarchy.getFromStore,
    getStoresByBrand: Hierarchy.getStoresByBrand,
    getBrandsByClient: Hierarchy.getBrandsByClient,
    getStoresByClient: Hierarchy.getStoresByClient,
    Hierarchy,

    // 後方互換性のためのエイリアス
    isSameStore: IdUtils.isSame,
    extractStoreIdNumber: IdUtils.extractNumber
  };

  // グローバルに公開
  global.DataUtils = DataUtils;

})(typeof window !== 'undefined' ? window : this);
