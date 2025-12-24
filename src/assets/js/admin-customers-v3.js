/**
 * 顧客管理システム v3
 * PC版詳細管理、スマホ版簡易、清掃員閲覧専用の3つのビューに対応
 */

(function() {
  'use strict';

  const API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';
  
  // グローバル状態（既存のグローバル変数と共有）
  let allStores = window.allStoresGlobal || [];
  let allClients = window.allClientsGlobal || [];
  let allBrands = window.allBrandsGlobal || [];
  let filteredData = window.filteredStoresGlobal || [];
  let currentViewMode = 'flat'; // 'hierarchy', 'flat', 'cards'
  let currentUserRole = null;
  let selectedItems = window.selectedItems || new Set();
  let favorites = new Set(JSON.parse(localStorage.getItem('customer_favorites') || '[]'));
  
  // パフォーマンス最適化: キャッシュ
  let renderCache = new Map();
  let lastRenderTime = 0;
  const RENDER_THROTTLE = 100; // 100ms以内の連続レンダリングを抑制

  // 最近閲覧した顧客
  let recentViews = JSON.parse(localStorage.getItem('customer_recent_views') || '[]');
  const MAX_RECENT_VIEWS = 10;

  // 検索履歴
  let searchHistory = JSON.parse(localStorage.getItem('customer_search_history') || '[]');
  const MAX_SEARCH_HISTORY = 20;

  /**
   * 最近閲覧した顧客の表示
   */
  function renderRecentViews() {
    const section = document.getElementById('recent-views-section');
    const list = document.getElementById('recent-views-list');
    if (!section || !list) return;

    if (recentViews.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    
    const items = recentViews.slice(0, 5).map(view => {
      const entity = view.type === 'store' 
        ? allStores.find(s => (window.DataUtils?.IdUtils?.isSame ? window.DataUtils.IdUtils.isSame(s.id, view.id) : s.id === view.id))
        : view.type === 'brand'
        ? allBrands.find(b => (window.DataUtils?.IdUtils?.isSame ? window.DataUtils.IdUtils.isSame(b.id, view.id) : b.id === view.id))
        : allClients.find(c => (window.DataUtils?.IdUtils?.isSame ? window.DataUtils.IdUtils.isSame(c.id, view.id) : c.id === view.id));

      if (!entity) return '';

      const iconMap = {
        client: 'fa-building',
        brand: 'fa-tag',
        store: 'fa-store'
      };

      const routeMap = {
        client: `/admin/customers/clients/detail.html?id=${view.id}`,
        brand: `/admin/customers/brands/detail.html?id=${view.id}`,
        store: `/admin/customers/stores/detail.html?id=${view.id}`
      };

      const name = entity.name || entity.company_name || view.id;
      const timeAgo = getTimeAgo(view.timestamp);

      return `
        <a href="${routeMap[view.type]}" class="recent-view-item">
          <i class="fas ${iconMap[view.type]} recent-view-icon"></i>
          <span>${escapeHtml(name)}</span>
          <span class="recent-view-time">${timeAgo}</span>
        </a>
      `;
    }).filter(Boolean).join('');

    list.innerHTML = items || '<div style="color: var(--customer-gray); font-size: 0.875rem;">最近閲覧した顧客がありません</div>';
  }

  /**
   * 経過時間の表示
   */
  function getTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'たった今';
    if (minutes < 60) return `${minutes}分前`;
    if (hours < 24) return `${hours}時間前`;
    if (days < 7) return `${days}日前`;
    return new Date(timestamp).toLocaleDateString('ja-JP');
  }

  /**
   * 初期化
   */
  function init() {
    detectUserRole();
    setupViewModeSwitcher();
    loadData().then(() => {
      // データ読み込み後に整合性チェック
      validateDataIntegrity();
      improveAccessibility();
      renderRecentViews();
    });
    setupEventListeners();
    applyReadonlyMode();
    optimizeMobileView();
    setupKeyboardShortcuts();
    
    // リサイズ時に最適化
    window.addEventListener('resize', debounce(optimizeMobileView, 300));
  }

  /**
   * ユーザーロールの検出
   */
  function detectUserRole() {
    try {
      const authData = localStorage.getItem('misesapo_auth');
      if (authData) {
        const parsed = JSON.parse(authData);
        currentUserRole = parsed.user?.role || parsed.role || 'guest';
      }
    } catch (error) {
      console.error('Failed to detect user role:', error);
      currentUserRole = 'guest';
    }
  }

  /**
   * ビューモード切り替えの設定
   */
  function setupViewModeSwitcher() {
    const switcher = document.querySelector('.view-mode-switcher');
    if (!switcher) return;

    const buttons = switcher.querySelectorAll('.view-mode-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const viewMode = btn.dataset.view;
        switchViewMode(viewMode);
        
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // デフォルトビューの設定
    if (window.innerWidth <= 768) {
      // スマホ版
      switchViewMode('cards');
      const cardsBtn = switcher.querySelector('[data-view="cards"]');
      if (cardsBtn) cardsBtn.classList.add('active');
    } else {
      // PC版
      switchViewMode('flat');
      const flatBtn = switcher.querySelector('[data-view="flat"]');
      if (flatBtn) flatBtn.classList.add('active');
    }
  }

  /**
   * ビューモードの切り替え
   */
  function switchViewMode(mode) {
    currentViewMode = mode;
    
    // 各ビューの表示/非表示
    const hierarchyView = document.getElementById('hierarchy-view');
    const flatView = document.getElementById('flat-view');
    const cardsView = document.getElementById('cards-view');

    if (hierarchyView) {
      hierarchyView.style.display = mode === 'hierarchy' ? 'block' : 'none';
      hierarchyView.setAttribute('aria-hidden', mode !== 'hierarchy' ? 'true' : 'false');
    }
    if (flatView) {
      flatView.style.display = mode === 'flat' ? 'block' : 'none';
      flatView.setAttribute('aria-hidden', mode !== 'flat' ? 'true' : 'false');
    }
    if (cardsView) {
      cardsView.style.display = mode === 'cards' ? 'block' : 'none';
      cardsView.setAttribute('aria-hidden', mode !== 'cards' ? 'true' : 'false');
    }

    // ARIA属性の更新
    document.querySelectorAll('.view-mode-btn').forEach(btn => {
      const isSelected = btn.dataset.view === mode;
      btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      btn.classList.toggle('active', isSelected);
    });

    // ビューモードに応じたレンダリング
    renderCurrentView();
  }

  /**
   * データの読み込み（既存のデータを使用、AWS連携対応、キャッシュ対応）
   */
  async function loadData(forceRefresh = false) {
    try {
      // キャッシュから読み込み（強制リフレッシュでない場合）
      if (!forceRefresh) {
        const cacheKey = 'customer_data_cache';
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const cachedData = JSON.parse(cached);
            const cacheTime = cachedData.timestamp || 0;
            const CACHE_DURATION = 5 * 60 * 1000; // 5分
            
            if (Date.now() - cacheTime < CACHE_DURATION) {
              allStores = cachedData.stores || [];
              allClients = cachedData.clients || [];
              allBrands = cachedData.brands || [];
              filteredData = allStores;
              
              // グローバル変数に保存
              window.allStoresGlobal = allStores;
              window.allClientsGlobal = allClients;
              window.allBrandsGlobal = allBrands;
              window.filteredStoresGlobal = filteredData;
              
              renderCurrentView();
              
              // バックグラウンドで最新データを取得
              loadData(true).catch(() => {
                // エラーは無視（キャッシュデータを使用）
              });
              return;
            }
          } catch (e) {
            console.warn('Failed to load cache:', e);
          }
        }
      }

      // 既存のグローバル変数からデータを取得
      if (window.allStoresGlobal && window.allStoresGlobal.length > 0 && !forceRefresh) {
        allStores = window.allStoresGlobal;
        allClients = window.allClientsGlobal || [];
        allBrands = window.allBrandsGlobal || [];
        filteredData = window.filteredStoresGlobal || allStores;
        renderCurrentView();
        return;
      }

      // フォールバック: 直接APIから取得（AWS連携）
      const headers = await getAuthHeaders();
      
      // エラーハンドリングを強化
      const fetchWithRetry = async (url, options, retries = 3) => {
        for (let i = 0; i < retries; i++) {
          try {
            const response = await fetch(url, options);
            if (response.ok) {
              return response;
            }
            if (i === retries - 1) {
              console.warn(`Failed to fetch ${url} after ${retries} retries`);
              return { ok: false };
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
          } catch (error) {
            if (i === retries - 1) {
              console.error(`Error fetching ${url}:`, error);
              return { ok: false };
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
          }
        }
        return { ok: false };
      };

      const [storesRes, clientsRes, brandsRes] = await Promise.all([
        fetchWithRetry(`${API_BASE}/stores`, { headers }),
        fetchWithRetry(`${API_BASE}/clients`, { headers }),
        fetchWithRetry(`${API_BASE}/brands`, { headers })
      ]);

      if (storesRes.ok) {
        try {
          const data = await storesRes.json();
          allStores = Array.isArray(data) ? data : (data.items || data.stores || []);
          // ID正規化の確認
          if (window.DataUtils?.IdUtils?.normalize) {
            allStores = allStores.map(store => ({
              ...store,
              id: window.DataUtils.IdUtils.normalize(store.id)
            }));
          }
        } catch (e) {
          console.error('Failed to parse stores data:', e);
          allStores = [];
        }
      }

      if (clientsRes.ok) {
        try {
          const data = await clientsRes.json();
          allClients = Array.isArray(data) ? data : (data.items || data.clients || []);
          if (window.DataUtils?.IdUtils?.normalize) {
            allClients = allClients.map(client => ({
              ...client,
              id: window.DataUtils.IdUtils.normalize(client.id)
            }));
          }
        } catch (e) {
          console.error('Failed to parse clients data:', e);
          allClients = [];
        }
      }

      if (brandsRes.ok) {
        try {
          const data = await brandsRes.json();
          allBrands = Array.isArray(data) ? data : (data.items || data.brands || []);
          if (window.DataUtils?.IdUtils?.normalize) {
            allBrands = allBrands.map(brand => ({
              ...brand,
              id: window.DataUtils.IdUtils.normalize(brand.id),
              client_id: window.DataUtils.IdUtils.normalize(brand.client_id)
            }));
          }
        } catch (e) {
          console.error('Failed to parse brands data:', e);
          allBrands = [];
        }
      }

      filteredData = allStores;
      
      // グローバル変数に保存
      window.allStoresGlobal = allStores;
      window.allClientsGlobal = allClients;
      window.allBrandsGlobal = allBrands;
      window.filteredStoresGlobal = filteredData;

      // キャッシュに保存
      try {
        const cacheData = {
          stores: allStores,
          clients: allClients,
          brands: allBrands,
          timestamp: Date.now()
        };
        localStorage.setItem('customer_data_cache', JSON.stringify(cacheData));
      } catch (e) {
        console.warn('Failed to save cache:', e);
      }

      renderCurrentView();
    } catch (error) {
      console.error('Failed to load data:', error);
      // エラー通知
      if (window.showError) {
        showError('データの読み込みに失敗しました。ページを再読み込みしてください。');
      }
      // エラー時も空の状態でレンダリング
      allStores = [];
      allClients = [];
      allBrands = [];
      filteredData = [];
      renderCurrentView();
    }
  }

  /**
   * 現在のビューをレンダリング（パフォーマンス測定付き、スロットル対応）
   */
  function renderCurrentView() {
    const now = Date.now();
    if (now - lastRenderTime < RENDER_THROTTLE) {
      // スロットル: 連続レンダリングを抑制
      clearTimeout(window.renderTimeout);
      window.renderTimeout = setTimeout(() => {
        renderCurrentView();
      }, RENDER_THROTTLE - (now - lastRenderTime));
      return;
    }
    lastRenderTime = now;

    measurePerformance('renderCurrentView', () => {
      switch (currentViewMode) {
        case 'hierarchy':
          renderHierarchyView();
          break;
        case 'flat':
          renderFlatView();
          break;
        case 'cards':
          renderCardsView();
          break;
      }
    });
  }

  /**
   * 階層ビューのレンダリング（パフォーマンス最適化）
   */
  function renderHierarchyView() {
    const container = document.getElementById('hierarchy-tree-container');
    if (!container) return;

    // パフォーマンス最適化: 大量データの場合、フィルター適用を促す
    if (allStores.length > 1000 && filteredData.length === allStores.length) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-info-circle"></i>
          <p>データが多すぎます（${allStores.length}件）</p>
          <small>検索やフィルターを適用して表示件数を減らしてください</small>
        </div>
      `;
      return;
    }

    const storesToRender = filteredData.length > 0 && filteredData.length < allStores.length ? filteredData : allStores;

    // 法人ごとにグループ化（ID正規化対応）
    const clientsMap = new Map();
    allClients.forEach(client => {
      const clientId = window.DataUtils?.IdUtils?.normalize 
        ? window.DataUtils.IdUtils.normalize(client.id)
        : client.id;
      clientsMap.set(clientId, {
        client,
        brands: []
      });
    });

    // ブランドを法人に紐付け（ID正規化対応）
    allBrands.forEach(brand => {
      const brandClientId = window.DataUtils?.IdUtils?.normalize
        ? window.DataUtils.IdUtils.normalize(brand.client_id)
        : brand.client_id;
      
      // ID比較を正規化対応
      let matchedClientId = null;
      if (window.DataUtils?.IdUtils?.isSame) {
        for (const [clientId] of clientsMap.entries()) {
          if (window.DataUtils.IdUtils.isSame(brandClientId, clientId)) {
            matchedClientId = clientId;
            break;
          }
        }
      } else {
        matchedClientId = clientsMap.has(brandClientId) ? brandClientId : null;
      }

      if (matchedClientId && clientsMap.has(matchedClientId)) {
        clientsMap.get(matchedClientId).brands.push({
          brand,
          stores: []
        });
      }
    });

    // 店舗をブランドに紐付け（ID正規化対応）
    storesToRender.forEach(store => {
      const storeBrandId = window.DataUtils?.IdUtils?.normalize
        ? window.DataUtils.IdUtils.normalize(store.brand_id)
        : store.brand_id;

      for (const [clientId, data] of clientsMap.entries()) {
        const brandData = data.brands.find(b => {
          const bId = window.DataUtils?.IdUtils?.normalize
            ? window.DataUtils.IdUtils.normalize(b.brand.id)
            : b.brand.id;
          
          if (window.DataUtils?.IdUtils?.isSame) {
            return window.DataUtils.IdUtils.isSame(storeBrandId, bId);
          }
          return storeBrandId === bId;
        });
        
        if (brandData) {
          brandData.stores.push(store);
          break; // 見つかったら次の店舗へ
        }
      }
    });

    // HTML生成（DocumentFragmentを使用してパフォーマンス向上）
    const fragment = document.createDocumentFragment();
    const tempDiv = document.createElement('div');
    
    clientsMap.forEach((data, clientId) => {
      tempDiv.innerHTML = renderTreeNode('client', data.client, data.brands);
      while (tempDiv.firstChild) {
        fragment.appendChild(tempDiv.firstChild);
      }
    });

    container.innerHTML = '';
    container.appendChild(fragment);
    setupTreeNodeToggle();
    
    // 検索結果数を更新
    if (filteredData.length < allStores.length) {
      const info = document.createElement('div');
      info.className = 'data-integrity-warning';
      info.style.cssText = 'margin-top: 12px; padding: 8px 12px;';
      info.innerHTML = `<i class="fas fa-filter"></i> フィルター適用中: ${filteredData.length} / ${allStores.length}件を表示`;
      container.appendChild(info);
    }
  }

  /**
   * ツリーノードのレンダリング
   */
  function renderTreeNode(type, entity, children = []) {
    const iconMap = {
      client: 'fa-building',
      brand: 'fa-tag',
      store: 'fa-store'
    };

    const hasChildren = children && Array.isArray(children) && children.length > 0;
    const childrenHtml = hasChildren ? children.map(child => {
      if (!child) return ''; // childが存在しない場合は空文字を返す
      
      if (type === 'client') {
        // child.brandとchild.storesが存在することを確認
        if (!child.brand) return '';
        const stores = Array.isArray(child.stores) ? child.stores : [];
        return renderTreeNode('brand', child.brand, stores);
      } else if (type === 'brand') {
        // child.storesが存在することを確認
        // childは { brand, stores: [] } の形式
        if (!child.stores || !Array.isArray(child.stores)) return '';
        return child.stores.map(store => {
          if (!store) return '';
          return renderTreeNode('store', store);
        }).join('');
      }
      return '';
    }).filter(Boolean).join('') : '';

    return `
      <div class="tree-node" data-type="${type}" data-id="${entity.id}">
        <div class="tree-node-header">
          ${hasChildren ? '<button class="tree-node-toggle">+</button>' : '<span class="tree-node-toggle" style="visibility: hidden;"></span>'}
          <i class="fas ${iconMap[type]} tree-node-icon"></i>
          <span class="tree-node-label">${escapeHtml(entity.name || entity.company_name || '-')}</span>
          <span class="tree-node-badge">${getEntityCount(type, entity, children)}</span>
        </div>
        ${hasChildren ? `<div class="tree-node-children">${childrenHtml}</div>` : ''}
      </div>
    `;
  }

  /**
   * エンティティのカウント取得
   */
  function getEntityCount(type, entity, children) {
    if (type === 'client') {
      return `${children.reduce((sum, b) => sum + b.stores.length, 0)}店舗`;
    } else if (type === 'brand') {
      return `${children.length}店舗`;
    }
    return '';
  }

  /**
   * ツリーノードのトグル設定
   */
  function setupTreeNodeToggle() {
    document.querySelectorAll('.tree-node-header').forEach(header => {
      header.addEventListener('click', (e) => {
        if (e.target.classList.contains('tree-node-toggle')) {
          const node = header.closest('.tree-node');
          node.classList.toggle('expanded');
          const toggle = header.querySelector('.tree-node-toggle');
          if (toggle) {
            toggle.textContent = node.classList.contains('expanded') ? '−' : '+';
          }
        } else {
          // ノードクリックで詳細ページへ
          const node = header.closest('.tree-node');
          const type = node.dataset.type;
          const id = node.dataset.id;
          navigateToDetail(type, id);
        }
      });
    });
  }

  /**
   * 詳細ページへの遷移（最近閲覧に追加）
   */
  function navigateToDetail(type, id) {
    // 最近閲覧に追加
    const viewItem = { type, id, timestamp: Date.now() };
    recentViews = recentViews.filter(v => !(v.type === type && v.id === id));
    recentViews.unshift(viewItem);
    recentViews = recentViews.slice(0, MAX_RECENT_VIEWS);
    localStorage.setItem('customer_recent_views', JSON.stringify(recentViews));

    const routes = {
      client: `/admin/customers/clients/detail.html?id=${id}`,
      brand: `/admin/customers/brands/detail.html?id=${id}`,
      store: `/admin/customers/stores/detail.html?id=${id}`
    };
    if (routes[type]) {
      window.location.href = routes[type];
    }
  }

  /**
   * フラットビューのレンダリング（既存のテーブル表示）
   */
  function renderFlatView() {
    // 既存のrenderTable関数を使用
    if (typeof window.renderTable === 'function') {
      window.renderTable();
    }
  }

  /**
   * カードビューのレンダリング（パフォーマンス最適化：仮想スクロール対応）
   */
  function renderCardsView() {
    const container = document.getElementById('cards-view-container');
    if (!container) return;

    const storesToRender = filteredData.length > 0 ? filteredData : allStores;
    
    if (storesToRender.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-inbox"></i>
          <p>該当する店舗がありません</p>
          <small>検索条件やフィルターを変更してください</small>
        </div>
      `;
      return;
    }

    // パフォーマンス最適化: 大量データの場合はバッチ処理
    const BATCH_SIZE = 50;
    if (storesToRender.length > BATCH_SIZE) {
      // 最初のバッチのみ表示
      const firstBatch = storesToRender.slice(0, BATCH_SIZE);
      renderCardsBatch(firstBatch, container);
      
      // 残りを遅延読み込み
      setTimeout(() => {
        const remaining = storesToRender.slice(BATCH_SIZE);
        renderCardsBatch(remaining, container, true);
      }, 100);
    } else {
      renderCardsBatch(storesToRender, container);
    }

    // 検索結果数を更新
    if (filteredData.length < allStores.length) {
      const info = document.createElement('div');
      info.className = 'data-integrity-warning';
      info.style.cssText = 'margin-top: 12px; padding: 8px 12px;';
      info.innerHTML = `<i class="fas fa-filter"></i> フィルター適用中: ${filteredData.length} / ${allStores.length}件を表示`;
      container.appendChild(info);
    }
  }

  /**
   * カードのバッチレンダリング
   */
  function renderCardsBatch(stores, container, append = false) {
    const fragment = document.createDocumentFragment();
    const tempDiv = document.createElement('div');
    
      const cards = stores.map(store => {
      const brand = findBrand(store.brand_id);
      const client = findClient(brand?.client_id || store.client_id);
      const isSelected = window.selectedItems && window.selectedItems.has(store.id);

      return `
        <div class="customer-card ${isSelected ? 'selected' : ''}" data-id="${store.id}" data-type="store">
          <div class="customer-card-header">
            <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
              <input type="checkbox" class="store-checkbox" data-id="${store.id}" onchange="toggleStoreSelection('${store.id}')" style="margin-right: 4px;" aria-label="店舗 ${escapeHtml(store.name || store.id)} を選択" ${isSelected ? 'checked' : ''}>
              <h3 class="customer-card-title">${escapeHtml(store.name || '-')}</h3>
            </div>
            <button class="favorite-btn ${favorites.has(store.id) ? 'active' : ''}" 
                    data-id="${store.id}" 
                    onclick="toggleFavorite('${store.id}')">
              <i class="fas fa-star"></i>
            </button>
          </div>
          <div class="customer-card-hierarchy">
            ${client ? `<div class="hierarchy-item">
              <i class="fas fa-building hierarchy-item-icon"></i>
              <span>${escapeHtml(client.name || client.company_name || '-')}</span>
            </div>` : ''}
            ${brand ? `<div class="hierarchy-item">
              <i class="fas fa-tag hierarchy-item-icon"></i>
              <span>${escapeHtml(brand.name || '-')}</span>
            </div>` : ''}
          </div>
          <div class="customer-card-info">
            <div class="info-row">
              <span class="info-label">ステータス:</span>
              <span class="info-value">${getStatusBadge(store.status)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">住所:</span>
              <span class="info-value">${escapeHtml((store.pref || '') + (store.city || '') + (store.address1 || ''))}</span>
            </div>
            <div class="info-row">
              <span class="info-label">電話:</span>
              <span class="info-value">${escapeHtml(store.phone || '-')}</span>
            </div>
          </div>
          <div class="customer-card-actions">
            <a href="/admin/customers/stores/${store.id}/chart.html" class="card-action-btn">
              <i class="fas fa-clipboard-list"></i> カルテ
            </a>
            <a href="/admin/customers/stores/detail.html?id=${store.id}" class="card-action-btn primary">
              <i class="fas fa-eye"></i> 詳細
            </a>
          </div>
        </div>
      `;
    }).join('');

    tempDiv.innerHTML = cards;
    while (tempDiv.firstChild) {
      fragment.appendChild(tempDiv.firstChild);
    }

    if (append) {
      container.appendChild(fragment);
    } else {
      container.innerHTML = '';
      container.appendChild(fragment);
    }
  }

  /**
   * ブランド検索
   */
  function findBrand(brandId) {
    if (!brandId) return null;
    if (window.DataUtils?.EntityFinder?.findBrand) {
      return window.DataUtils.EntityFinder.findBrand(allBrands, brandId);
    }
    return allBrands.find(b => b.id === brandId || String(b.id) === String(brandId));
  }

  /**
   * 法人検索
   */
  function findClient(clientId) {
    if (!clientId) return null;
    if (window.DataUtils?.EntityFinder?.findClient) {
      return window.DataUtils.EntityFinder.findClient(allClients, clientId);
    }
    return allClients.find(c => c.id === clientId || String(c.id) === String(clientId));
  }

  /**
   * ステータスバッジ取得
   */
  function getStatusBadge(status) {
    const statusMap = {
      active: { label: '稼働中', color: '#10b981' },
      suspended: { label: '休止中', color: '#6b7280' },
      terminated: { label: '契約終了', color: '#ef4444' },
      contract_pending: { label: '契約作業中', color: '#f59e0b' }
    };
    const info = statusMap[status] || { label: status || '未設定', color: '#9ca3af' };
    return `<span class="customer-card-status" style="background: ${info.color}20; color: ${info.color}; border: 1px solid ${info.color}40;">${info.label}</span>`;
  }

  /**
   * お気に入りの切り替え
   */
  window.toggleFavorite = function(id) {
    if (favorites.has(id)) {
      favorites.delete(id);
      if (window.showSuccess) showSuccess('お気に入りから削除しました');
    } else {
      favorites.add(id);
      if (window.showSuccess) showSuccess('お気に入りに追加しました');
    }
    localStorage.setItem('customer_favorites', JSON.stringify(Array.from(favorites)));
    renderCurrentView();
  };

  // グローバルに公開（エラー通知用）
  window.showError = showError;
  window.showSuccess = showSuccess;

  /**
   * 検索履歴の表示
   */
  function updateSearchSuggestions() {
    const datalist = document.getElementById('search-suggestions');
    if (!datalist) return;

    datalist.innerHTML = searchHistory.slice(0, 10).map(term => 
      `<option value="${escapeHtml(term)}">`
    ).join('');

    // 検索履歴クリアボタンの表示/非表示
    const clearHistoryBtn = document.getElementById('clear-search-history');
    if (clearHistoryBtn) {
      clearHistoryBtn.style.display = searchHistory.length > 0 ? 'inline-flex' : 'none';
    }
  }

  /**
   * イベントリスナーの設定
   */
  function setupEventListeners() {
    // 統合検索（既にデバウンス済み）
    const searchInput = document.getElementById('unified-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', handleUnifiedSearch);
      searchInput.addEventListener('focus', updateSearchSuggestions);
      // 検索履歴を初期表示
      updateSearchSuggestions();
    }

    // フィルター
    const unifiedClientFilter = document.getElementById('unified-client-filter');
    const unifiedBrandFilter = document.getElementById('unified-brand-filter');
    const unifiedStatusFilter = document.getElementById('unified-status-filter');
    const unifiedResetBtn = document.getElementById('unified-reset-filters');

    if (unifiedClientFilter) {
      unifiedClientFilter.addEventListener('change', () => {
        updateUnifiedBrandFilter();
        handleUnifiedSearch();
      });
    }

    if (unifiedBrandFilter) {
      unifiedBrandFilter.addEventListener('change', handleUnifiedSearch);
    }

    if (unifiedStatusFilter) {
      unifiedStatusFilter.addEventListener('change', handleUnifiedSearch);
    }

    if (unifiedResetBtn) {
      unifiedResetBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        if (unifiedClientFilter) unifiedClientFilter.value = '';
        if (unifiedBrandFilter) unifiedBrandFilter.value = '';
        if (unifiedStatusFilter) unifiedStatusFilter.value = '';
        handleUnifiedSearch();
        updateSearchSuggestions();
      });
    }

    // 検索履歴クリア
    const clearHistoryBtn = document.getElementById('clear-search-history');
    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener('click', () => {
        if (confirm('検索履歴をすべて削除しますか？')) {
          searchHistory = [];
          localStorage.removeItem('customer_search_history');
          updateSearchSuggestions();
          if (window.showSuccess) showSuccess('検索履歴を削除しました');
        }
      });
      
      // 検索履歴がある場合のみ表示
      if (searchHistory.length > 0) {
        clearHistoryBtn.style.display = 'inline-flex';
      }
    }

    // 統合検索のフィルター選択肢を更新
    updateUnifiedFilters();
  }

  /**
   * 統合検索のフィルター選択肢を更新
   */
  function updateUnifiedFilters() {
    const unifiedClientFilter = document.getElementById('unified-client-filter');
    const unifiedBrandFilter = document.getElementById('unified-brand-filter');

    if (unifiedClientFilter) {
      unifiedClientFilter.innerHTML = '<option value="">全法人</option>' + 
        allClients.map(c => `<option value="${c.id}">${escapeHtml(c.name || c.company_name || '')}</option>`).join('');
    }

    updateUnifiedBrandFilter();
  }

  /**
   * 統合検索のブランドフィルターを更新
   */
  function updateUnifiedBrandFilter() {
    const unifiedClientFilter = document.getElementById('unified-client-filter');
    const unifiedBrandFilter = document.getElementById('unified-brand-filter');
    
    if (!unifiedBrandFilter) return;

    const selectedClient = unifiedClientFilter?.value || '';
    let brands;
    
    if (selectedClient) {
      if (window.DataUtils?.IdUtils?.isSame) {
        brands = allBrands.filter(b => window.DataUtils.IdUtils.isSame(b.client_id, selectedClient));
      } else {
        brands = allBrands.filter(b => b.client_id === selectedClient || String(b.client_id) === String(selectedClient));
      }
    } else {
      brands = allBrands;
    }

    unifiedBrandFilter.innerHTML = '<option value="">全ブランド</option>' + 
      brands.map(b => `<option value="${b.id}">${escapeHtml(b.name || '')}</option>`).join('');
  }

  /**
   * 統合検索の処理（パフォーマンス最適化：デバウンスとメモ化、検索履歴対応）
   */
  function handleUnifiedSearchInternal() {
    const searchInput = document.getElementById('unified-search-input');
    const searchTerm = searchInput?.value.toLowerCase() || '';
    const clientFilter = document.getElementById('unified-client-filter')?.value || '';
    const brandFilter = document.getElementById('unified-brand-filter')?.value || '';
    const statusFilter = document.getElementById('unified-status-filter')?.value || '';
    
    // 検索履歴に追加（検索語が3文字以上の場合）
    if (searchTerm.length >= 3) {
      searchHistory = searchHistory.filter(h => h !== searchTerm);
      searchHistory.unshift(searchTerm);
      searchHistory = searchHistory.slice(0, MAX_SEARCH_HISTORY);
      localStorage.setItem('customer_search_history', JSON.stringify(searchHistory));
    }
    
    // パフォーマンス最適化: 検索結果をキャッシュ（簡易実装）
    const cacheKey = `${searchTerm}_${clientFilter}_${brandFilter}_${statusFilter}`;
    if (window.searchCache && window.searchCache.key === cacheKey) {
      filteredData = window.searchCache.data;
      renderCurrentView();
      return;
    }
    
    filteredData = allStores.filter(store => {
      // 店舗名、住所、電話で検索
      const matchStore = !searchTerm || 
        (store.name || '').toLowerCase().includes(searchTerm) ||
        (store.city || '').toLowerCase().includes(searchTerm) ||
        (store.address1 || '').toLowerCase().includes(searchTerm) ||
        (store.phone || '').includes(searchTerm);

      // ブランド名で検索
      const brand = findBrand(store.brand_id);
      const matchBrand = !searchTerm || (brand?.name || '').toLowerCase().includes(searchTerm);

      // 法人名で検索
      const client = findClient(brand?.client_id || store.client_id);
      const matchClient = !searchTerm || (client?.name || client?.company_name || '').toLowerCase().includes(searchTerm);

      // フィルター適用
      let matchClientFilter = true;
      if (clientFilter) {
        if (window.DataUtils?.IdUtils?.isSame) {
          matchClientFilter = window.DataUtils.IdUtils.isSame(brand?.client_id || store.client_id, clientFilter);
        } else {
          matchClientFilter = (brand?.client_id || store.client_id) === clientFilter;
        }
      }

      let matchBrandFilter = true;
      if (brandFilter) {
        if (window.DataUtils?.IdUtils?.isSame) {
          matchBrandFilter = window.DataUtils.IdUtils.isSame(store.brand_id, brandFilter);
        } else {
          matchBrandFilter = store.brand_id === brandFilter;
        }
      }

      const matchStatusFilter = !statusFilter || store.status === statusFilter;

      return (matchStore || matchBrand || matchClient) && matchClientFilter && matchBrandFilter && matchStatusFilter;
    });

    // 検索結果をキャッシュ
    window.searchCache = {
      key: cacheKey,
      data: filteredData
    };

    // 既存のfilteredStoresも更新
    if (window.filteredStoresGlobal !== undefined) {
      window.filteredStoresGlobal = filteredData;
    }

    renderCurrentView();
    
    // 既存のテーブルビューも更新
    if (typeof window.filterAndRender === 'function') {
      // 統合検索の結果を既存のフィルターに反映
      window.filteredStoresGlobal = filteredData;
    }
  }

  const handleUnifiedSearch = debounce(handleUnifiedSearchInternal, 300);

  /**
   * 閲覧専用モードの適用
   */
  function applyReadonlyMode() {
    if (currentUserRole === 'staff') {
      document.body.classList.add('customer-view-readonly');
      // 清掃員は担当店舗のみ表示
      if (window.selectedItems) {
        // 担当店舗のフィルタリング（実装予定：スケジュールから取得）
        // 現時点では全店舗表示
      }
    }
  }

  /**
   * スマホ版の最適化（営業向け簡易問診票ビュー）
   */
  function optimizeMobileView() {
    if (window.innerWidth <= 768) {
      // スマホ版では階層ビューを非表示
      const hierarchyView = document.getElementById('hierarchy-view');
      if (hierarchyView) {
        hierarchyView.style.display = 'none';
      }
      
      // デフォルトでカードビューに切り替え
      if (currentViewMode === 'hierarchy') {
        switchViewMode('cards');
        const cardsBtn = document.querySelector('[data-view="cards"]');
        if (cardsBtn) cardsBtn.classList.add('active');
      }
    }
  }

  /**
   * 認証ヘッダー取得
   */
  async function getAuthHeaders() {
    try {
      const cognitoIdToken = localStorage.getItem('cognito_id_token');
      if (cognitoIdToken) {
        return {
          'Authorization': `Bearer ${cognitoIdToken}`,
          'Content-Type': 'application/json'
        };
      }

      const authData = localStorage.getItem('misesapo_auth');
      if (authData) {
        const parsed = JSON.parse(authData);
        if (parsed.token) {
          return {
            'Authorization': `Bearer ${parsed.token}`,
            'Content-Type': 'application/json'
          };
        }
      }
    } catch (error) {
      console.error('Error getting auth headers:', error);
    }
    return { 'Content-Type': 'application/json' };
  }

  /**
   * ユーティリティ関数
   */
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function debounce(fn, delay) {
    let timer;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  /**
   * エラーハンドリングと通知
   */
  function showError(message, duration = 5000) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-notification';
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ef4444;
      color: #fff;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      z-index: 10000;
      max-width: 400px;
      animation: slideIn 0.3s ease;
    `;
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
      errorDiv.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => errorDiv.remove(), 300);
    }, duration);
  }

  function showSuccess(message, duration = 3000) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success-notification';
    successDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: #fff;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      z-index: 10000;
      max-width: 400px;
      animation: slideIn 0.3s ease;
    `;
    successDiv.textContent = message;
    document.body.appendChild(successDiv);
    
    setTimeout(() => {
      successDiv.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => successDiv.remove(), 300);
    }, duration);
  }

  /**
   * データ整合性チェック（AWS連携時のID形式の違いに対応）
   */
  function validateDataIntegrity() {
    const errors = [];
    const warnings = [];
    
    // 店舗のブランドIDが存在するかチェック（ID正規化対応）
    allStores.forEach(store => {
      if (store.brand_id) {
        const brand = findBrand(store.brand_id);
        if (!brand) {
          warnings.push(`店舗 ${store.id}: ブランドID ${store.brand_id} が見つかりません（参照切れの可能性）`);
        }
      }
    });

    // ブランドの法人IDが存在するかチェック（ID正規化対応）
    allBrands.forEach(brand => {
      if (brand.client_id) {
        const client = findClient(brand.client_id);
        if (!client) {
          warnings.push(`ブランド ${brand.id}: 法人ID ${brand.client_id} が見つかりません（参照切れの可能性）`);
        }
      }
    });

    // 重複IDチェック
    const storeIds = new Set();
    allStores.forEach(store => {
      if (storeIds.has(store.id)) {
        errors.push(`重複した店舗ID: ${store.id}`);
      }
      storeIds.add(store.id);
    });

    if (errors.length > 0) {
      console.error('データ整合性エラー:', errors);
      if (window.showError) {
        showError(`データ整合性エラーが${errors.length}件検出されました`, 10000);
      }
    }

    if (warnings.length > 0) {
      console.warn('データ整合性警告:', warnings);
      // 警告は開発環境のみ表示
      if (window.location.hostname === 'localhost' || window.location.hostname.includes('dev')) {
        console.info('警告:', warnings.slice(0, 5).join(', '), warnings.length > 5 ? `他${warnings.length - 5}件` : '');
      }
    }

    return errors.length === 0;
  }

  /**
   * キーボードショートカット
   */
  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + K: 検索にフォーカス
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('unified-search-input') || document.getElementById('search-input');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }

      // Ctrl/Cmd + E: エクスポート
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        const exportBtn = document.getElementById('export-csv-btn');
        if (exportBtn) exportBtn.click();
      }

      // Ctrl/Cmd + /: ショートカットヘルプ表示
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        toggleKeyboardShortcutsHelp();
      }

      // Escape: 選択解除
      if (e.key === 'Escape') {
        if (window.selectedItems && window.selectedItems.size > 0) {
          if (window.clearSelection) window.clearSelection();
        }
        // ショートカットヘルプを閉じる
        const help = document.getElementById('keyboard-shortcuts-help');
        if (help && help.classList.contains('show')) {
          help.classList.remove('show');
        }
      }
    });
  }

  /**
   * キーボードショートカットヘルプの表示/非表示
   */
  function toggleKeyboardShortcutsHelp() {
    let help = document.getElementById('keyboard-shortcuts-help');
    if (!help) {
      help = document.createElement('div');
      help.id = 'keyboard-shortcuts-help';
      help.className = 'keyboard-shortcuts';
      help.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 8px;">キーボードショートカット</div>
        <div class="keyboard-shortcut-item">
          <span class="keyboard-shortcut-key">Ctrl/Cmd + K</span>: 検索にフォーカス
        </div>
        <div class="keyboard-shortcut-item">
          <span class="keyboard-shortcut-key">Ctrl/Cmd + E</span>: エクスポート
        </div>
        <div class="keyboard-shortcut-item">
          <span class="keyboard-shortcut-key">Ctrl/Cmd + /</span>: このヘルプ
        </div>
        <div class="keyboard-shortcut-item">
          <span class="keyboard-shortcut-key">Esc</span>: 選択解除
        </div>
      `;
      document.body.appendChild(help);
    }
    help.classList.toggle('show');
  }

  /**
   * アクセシビリティ改善
   */
  function improveAccessibility() {
    // ARIAラベルの追加
    const viewModeBtns = document.querySelectorAll('.view-mode-btn');
    viewModeBtns.forEach(btn => {
      if (!btn.getAttribute('aria-label')) {
        btn.setAttribute('aria-label', `ビューモード: ${btn.textContent.trim()}`);
      }
    });

    // キーボードナビゲーションの改善（遅延実行でパフォーマンス向上）
    setTimeout(() => {
      const interactiveElements = document.querySelectorAll('.customer-card, .tree-node-header');
      interactiveElements.forEach((el, index) => {
        if (!el.getAttribute('tabindex')) {
          el.setAttribute('tabindex', '0');
        }
        // イベントリスナーは一度だけ追加
        if (!el.dataset.keyboardListenerAdded) {
          el.dataset.keyboardListenerAdded = 'true';
          el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              el.click();
            }
          });
        }
      });
    }, 100);
  }

  // DOMContentLoaded時に初期化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(init, 500); // 既存のコードが読み込まれるのを待つ
    });
  } else {
    setTimeout(init, 500);
  }

  /**
   * パフォーマンス監視（本番環境では無効化）
   */
  function measurePerformance(name, fn) {
    // 本番環境ではパフォーマンス測定をスキップ
    if (window.location.hostname !== 'localhost' && !window.location.hostname.includes('dev')) {
      return fn();
    }

    if (window.performance && window.performance.mark) {
      const startMark = `${name}-start-${Date.now()}`;
      const endMark = `${name}-end-${Date.now()}`;
      window.performance.mark(startMark);
      const result = fn();
      window.performance.mark(endMark);
      window.performance.measure(name, startMark, endMark);
      const measure = window.performance.getEntriesByName(name).pop();
      if (measure && measure.duration > 100) {
        console.warn(`Performance warning: ${name} took ${measure.duration.toFixed(2)}ms`);
        // 1000ms以上かかる場合はエラーとして扱う
        if (measure.duration > 1000) {
          console.error(`Performance error: ${name} took ${measure.duration.toFixed(2)}ms - 最適化が必要です`);
        }
      }
      return result;
    }
    return fn();
  }

  /**
   * メモリ使用量の監視（開発環境のみ）
   */
  function monitorMemoryUsage() {
    if (window.performance && window.performance.memory && (window.location.hostname === 'localhost' || window.location.hostname.includes('dev'))) {
      const memory = window.performance.memory;
      const usedMB = (memory.usedJSHeapSize / 1048576).toFixed(2);
      const totalMB = (memory.totalJSHeapSize / 1048576).toFixed(2);
      const limitMB = (memory.jsHeapSizeLimit / 1048576).toFixed(2);
      
      if (usedMB > 50) {
        console.warn(`Memory usage: ${usedMB}MB / ${totalMB}MB (limit: ${limitMB}MB)`);
        // キャッシュをクリア
        if (usedMB > 100) {
          renderCache.clear();
          window.searchCache = null;
          localStorage.removeItem('customer_data_cache');
          console.warn('Cache cleared due to high memory usage');
        }
      }
    }
  }

  // 定期的にメモリ使用量を監視（開発環境のみ）
  if (window.location.hostname === 'localhost' || window.location.hostname.includes('dev')) {
    setInterval(monitorMemoryUsage, 30000); // 30秒ごと
  }

  // グローバルに公開
  window.CustomerManagementV3 = {
    switchViewMode,
    renderCurrentView,
    loadData,
    toggleFavorite,
    allStores,
    allClients,
    allBrands,
    filteredData,
    handleUnifiedSearch,
    updateUnifiedFilters,
    measurePerformance,
    renderRecentViews,
    recentViews,
    searchHistory
  };

})();

