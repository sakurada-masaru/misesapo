/**
 * ロール別情報開示制御
 * 各ロールがどの情報にアクセスできるかを定義
 */

(function() {
  'use strict';

  /**
   * ロール別の情報開示設定
   * true = 表示可能, false = 非表示, 'own' = 自分のデータのみ
   */
  const ROLE_PERMISSIONS = {
    // 管理者・開発者・マスター（全権限）
    admin: {
      // 企業情報
      client_basic: true,           // 企業基本情報
      client_contact: true,         // 担当者情報
      client_contract: true,        // 契約情報（金額含む）
      client_sales_notes: true,     // 営業メモ
      
      // ブランド情報
      brand_basic: true,
      brand_notes: true,
      
      // 店舗情報
      store_basic: true,            // 店舗基本情報
      store_documents: true,        // 提出資料（契約書、図面等）
      store_sales_notes: true,      // 営業メモ・注意事項
      store_key_info: true,         // 鍵情報
      store_managers: true,         // 責任者情報
      
      // 履歴情報
      estimates: true,              // 見積もり履歴
      schedules: true,              // スケジュール履歴
      reports: true,                // レポート履歴
      
      // 統計
      stats: true,
      
      // アクション
      can_edit: true,
      can_delete: true,
      can_approve: true,
    },
    
    // 開発者（管理者と同等）
    developer: {
      client_basic: true,
      client_contact: true,
      client_contract: true,
      client_sales_notes: true,
      brand_basic: true,
      brand_notes: true,
      store_basic: true,
      store_documents: true,
      store_sales_notes: true,
      store_key_info: true,
      store_managers: true,
      estimates: true,
      schedules: true,
      reports: true,
      stats: true,
      can_edit: true,
      can_delete: true,
      can_approve: true,
    },
    
    // マスター（全権限）
    master: {
      client_basic: true,
      client_contact: true,
      client_contract: true,
      client_sales_notes: true,
      brand_basic: true,
      brand_notes: true,
      store_basic: true,
      store_documents: true,
      store_sales_notes: true,
      store_key_info: true,
      store_managers: true,
      estimates: true,
      schedules: true,
      reports: true,
      stats: true,
      can_edit: true,
      can_delete: true,
      can_approve: true,
    },
    
    // 営業/コンシェルジュ
    concierge: {
      client_basic: true,
      client_contact: true,
      client_contract: false,       // 契約金額は見れない
      client_sales_notes: true,     // 営業メモは見れる
      brand_basic: true,
      brand_notes: true,
      store_basic: true,
      store_documents: false,       // 提出資料は見れない
      store_sales_notes: true,      // 営業メモは見れる
      store_key_info: false,        // 鍵情報は見れない
      store_managers: true,         // 責任者情報は見れる
      estimates: true,              // 見積もりは見れる（自分が作成したもの）
      schedules: true,              // スケジュールは見れる
      reports: true,                // レポートは見れる
      stats: true,
      can_edit: false,              // 編集は不可（仮押さえのみ）
      can_delete: false,
      can_approve: false,
    },
    
    // 清掃員
    staff: {
      client_basic: false,          // 企業情報は見れない
      client_contact: false,
      client_contract: false,
      client_sales_notes: false,
      brand_basic: false,
      brand_notes: false,
      store_basic: 'assigned',      // 担当店舗の基本情報のみ
      store_documents: false,
      store_sales_notes: false,
      store_key_info: 'assigned',   // 担当店舗の鍵情報のみ
      store_managers: 'assigned',   // 担当店舗の責任者情報のみ
      estimates: false,
      schedules: 'assigned',        // 担当スケジュールのみ
      reports: 'own',               // 自分のレポートのみ
      stats: false,
      can_edit: false,
      can_delete: false,
      can_approve: false,
    },
    
    // 顧客
    customer: {
      client_basic: 'own',          // 自社の情報のみ
      client_contact: 'own',
      client_contract: 'own',
      client_sales_notes: false,    // 営業メモは見れない
      brand_basic: 'own',
      brand_notes: false,
      store_basic: 'own',           // 自社店舗のみ
      store_documents: 'own',       // 自社の提出資料のみ
      store_sales_notes: false,
      store_key_info: 'own',
      store_managers: 'own',
      estimates: 'own',             // 自社の見積もりのみ
      schedules: 'own',             // 自社のスケジュールのみ
      reports: 'own',               // 自社のレポートのみ
      stats: 'own',
      can_edit: 'own',              // 自社情報の編集のみ
      can_delete: false,
      can_approve: false,
    },
    
    // ゲスト
    guest: {
      client_basic: false,
      client_contact: false,
      client_contract: false,
      client_sales_notes: false,
      brand_basic: false,
      brand_notes: false,
      store_basic: false,
      store_documents: false,
      store_sales_notes: false,
      store_key_info: false,
      store_managers: false,
      estimates: false,
      schedules: false,
      reports: false,
      stats: false,
      can_edit: false,
      can_delete: false,
      can_approve: false,
    }
  };

  /**
   * 現在のユーザーロールを取得
   */
  function getCurrentRole() {
    if (window.Auth && window.Auth.getCurrentRole) {
      return window.Auth.getCurrentRole();
    }
    // セッションストレージから直接取得
    try {
      const authData = sessionStorage.getItem('misesapo_auth');
      if (authData) {
        const parsed = JSON.parse(authData);
        return parsed.role || 'guest';
      }
    } catch (e) {
      console.warn('[RolePermissions] Failed to get role from session:', e);
    }
    return 'guest';
  }

  /**
   * 特定の権限を持っているかチェック
   * @param {string} permission - 権限名
   * @param {object} context - コンテキスト（所有者ID、担当ID等）
   * @returns {boolean}
   */
  function hasPermission(permission, context = {}) {
    const role = getCurrentRole();
    const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.guest;
    const value = permissions[permission];

    if (value === true) {
      return true;
    }
    
    if (value === false) {
      return false;
    }
    
    // 'own' - 自分のデータのみ
    if (value === 'own') {
      if (context.ownerId && context.currentUserId) {
        return context.ownerId === context.currentUserId;
      }
      if (context.clientId && context.userClientId) {
        return context.clientId === context.userClientId;
      }
      // コンテキストがない場合はtrue（後で個別にフィルタリング）
      return true;
    }
    
    // 'assigned' - 担当のデータのみ
    if (value === 'assigned') {
      if (context.assignedTo && context.currentUserId) {
        return context.assignedTo === context.currentUserId;
      }
      if (context.storeId && context.assignedStores) {
        return context.assignedStores.includes(context.storeId);
      }
      return true;
    }
    
    return false;
  }

  /**
   * ロールの権限一覧を取得
   * @param {string} role - ロール名（省略時は現在のロール）
   * @returns {object}
   */
  function getPermissions(role) {
    role = role || getCurrentRole();
    return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.guest;
  }

  /**
   * 要素の表示/非表示を権限に基づいて制御
   * @param {string} permission - 権限名
   * @param {HTMLElement} element - 対象要素
   * @param {object} context - コンテキスト
   */
  function toggleElementByPermission(permission, element, context = {}) {
    if (!element) return;
    
    if (hasPermission(permission, context)) {
      element.style.display = '';
      element.classList.remove('permission-hidden');
    } else {
      element.style.display = 'none';
      element.classList.add('permission-hidden');
    }
  }

  /**
   * data-permission属性を持つ要素を自動的に制御
   */
  function applyPermissions() {
    const elements = document.querySelectorAll('[data-permission]');
    elements.forEach(el => {
      const permission = el.dataset.permission;
      const ownerId = el.dataset.ownerId;
      const clientId = el.dataset.clientId;
      
      const context = {};
      if (ownerId) context.ownerId = ownerId;
      if (clientId) context.clientId = clientId;
      
      // 現在のユーザー情報を取得
      try {
        const userData = sessionStorage.getItem('misesapo_user');
        if (userData) {
          const user = JSON.parse(userData);
          context.currentUserId = user.id;
          context.userClientId = user.client_id;
          context.assignedStores = user.assigned_stores || [];
        }
      } catch (e) {
        console.warn('[RolePermissions] Failed to get user data:', e);
      }
      
      toggleElementByPermission(permission, el, context);
    });
  }

  /**
   * 管理者ロールかどうか
   */
  function isAdmin() {
    const role = getCurrentRole();
    return ['admin', 'developer', 'master'].includes(role);
  }

  /**
   * 営業ロールかどうか
   */
  function isSales() {
    const role = getCurrentRole();
    return ['concierge', 'admin', 'developer', 'master'].includes(role);
  }

  /**
   * 清掃員ロールかどうか
   */
  function isStaff() {
    const role = getCurrentRole();
    return role === 'staff';
  }

  /**
   * 顧客ロールかどうか
   */
  function isCustomer() {
    const role = getCurrentRole();
    return role === 'customer';
  }

  // ページ読み込み時に自動適用
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyPermissions);
  } else {
    applyPermissions();
  }

  // グローバルに公開
  window.RolePermissions = {
    ROLE_PERMISSIONS,
    getCurrentRole,
    hasPermission,
    getPermissions,
    toggleElementByPermission,
    applyPermissions,
    isAdmin,
    isSales,
    isStaff,
    isCustomer
  };

})();

