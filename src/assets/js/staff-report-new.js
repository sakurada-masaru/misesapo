/**
 * 清掃員レポート作成ページ
 * SP最適化・セクション方式
 */

(function() {
  const API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';
  const REPORT_API = 'https://2z0ui5xfxb.execute-api.ap-northeast-1.amazonaws.com/prod';
  const DEFAULT_NO_PHOTO_IMAGE = '/images-report/sorry.jpeg'; // デフォルト画像パス

  // データ（グローバルスコープに公開）
  window.stores = [];
  window.brands = [];
  window.clients = [];
  window.serviceItems = [];
  let stores = window.stores;
  let brands = window.brands;
  let clients = window.clients;
  let serviceItems = window.serviceItems;
  let sectionCounter = 0;
  let sections = {}; // セクションデータを保持（タブごとに分ける）
  let sectionsByTab = { new: {}, proposal: {}, edit: {} }; // タブごとのセクションデータ
  let currentActiveTab = 'new'; // 現在アクティブなタブを追跡

  // 画像倉庫用
  let warehouseImages = [];
  let selectedWarehouseImages = { before: [], after: [], completed: [] };
  let currentImageSection = null;
  let currentImageCategory = null;

  // 画像ストック用
  let imageStock = []; // ローカル保存された画像データ配列 { id, file, blobUrl, fileName, uploaded: false }
  const STOCK_DB_NAME = 'report-image-stock';
  const STOCK_DB_VERSION = 1;
  
  // 一括操作用
  let isMultiSelectMode = false; // 複数選択モード（画像用）
  let selectedImageIds = new Set(); // 選択された画像ID
  let isSectionSelectMode = false; // セクション複数選択モード
  let selectedSectionIds = new Set(); // 選択されたセクションID

  // ブランド名のselect要素を初期化
  function initBrandSelect() {
    const brandSelect = document.getElementById('report-brand-select');
    const brandSearchInput = document.getElementById('report-brand-search');
    const brandDropdownBtn = document.getElementById('brand-dropdown-btn');
    const brandResults = document.getElementById('brand-search-results');
    if (!brandSelect || !brandSearchInput || !brandDropdownBtn) return;
    
    // 既存のオプションをクリア
    brandSelect.innerHTML = '<option value="">①ブランド名 *</option>';
    
    // ブランドオプションを追加
    brands.forEach(brand => {
      const option = document.createElement('option');
      option.value = brand.id;
      option.textContent = brand.name;
      brandSelect.appendChild(option);
    });
    
    // 入力フィールドまたはドロップダウンボタンをクリックしたとき：モーダルを開く
    function openBrandModal() {
      if (typeof window.openBrandModal === 'function') {
        window.openBrandModal();
          }
    }
    
    // 下矢印ボタンをクリックしたとき：モーダルを開く
    brandDropdownBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      e.preventDefault();
      openBrandModal();
    });
    
    // 入力フィールドをクリックしたとき：モーダルを開く
    brandSearchInput.addEventListener('click', function(e) {
      // readonlyの場合はモーダルを開く
      if (this.hasAttribute('readonly')) {
        e.preventDefault();
        openBrandModal();
      }
    });
    
    // 入力フィールドで入力したとき：自由入力モード
    brandSearchInput.addEventListener('input', function() {
      if (!this.hasAttribute('readonly')) {
        // 自由入力モード：ブランド名を更新
        const inputValue = this.value.trim();
        document.getElementById('report-brand-name').value = inputValue;
        document.getElementById('report-brand').value = '';
      }
    });
    
    // 初期状態でreadonlyを設定
    brandSearchInput.setAttribute('readonly', 'readonly');
  }
  
  // 店舗名のselect要素を初期化
  function initStoreSelect() {
    const storeSelect = document.getElementById('report-store-select');
    const storeSearchInput = document.getElementById('report-store-search');
    const storeDropdownBtn = document.getElementById('store-dropdown-btn');
    const storeResults = document.getElementById('store-search-results');
    if (!storeSelect || !storeSearchInput || !storeDropdownBtn) return;
    
    // 既存のオプションをクリア
    storeSelect.innerHTML = '<option value="">②店舗名 *</option>';
    
    // 入力フィールドまたはドロップダウンボタンをクリックしたとき：モーダルを開く
    function openStoreModal() {
      // ブランドが選択されていない場合は警告
      const selectedBrandId = document.getElementById('report-brand')?.value;
      const brandNameInput = document.getElementById('report-brand-search')?.value.trim() || '';
      const brandNameHidden = document.getElementById('report-brand-name')?.value || '';
      const hasBrandName = brandNameInput || brandNameHidden;
      
      if (!selectedBrandId && !hasBrandName) {
        showWarning('まずブランド名を選択または入力してください');
        return;
      }
      
      if (typeof window.openStoreModal === 'function') {
        window.openStoreModal();
      }
    }
    
    // 下矢印ボタンをクリックしたとき：モーダルを開く
    storeDropdownBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      e.preventDefault();
      openStoreModal();
    });
    
    // 入力フィールドをクリックしたとき：モーダルを開く
    storeSearchInput.addEventListener('click', function(e) {
      // readonlyの場合はモーダルを開く
      if (this.hasAttribute('readonly')) {
        e.preventDefault();
        openStoreModal();
      }
    });
    
    // 入力フィールドで入力したとき：自由入力モード
    storeSearchInput.addEventListener('input', function() {
      if (!this.hasAttribute('readonly')) {
        // 自由入力モード：店舗名を更新
        const inputValue = this.value.trim();
        document.getElementById('report-store-name').value = inputValue;
        document.getElementById('report-store').value = '';
      }
    });
    
    // updateStoreSelect関数を更新（グローバルスコープに公開）
    window.updateStoreSelect = function() {
      // ブランドが変更されたときの処理（モーダル方式では特に処理不要）
    };
    
    // 初期状態でreadonlyを設定
    storeSearchInput.setAttribute('readonly', 'readonly');
  }

  // 初期化
  document.addEventListener('DOMContentLoaded', async () => {
    await Promise.all([loadStores(), loadBrands(), loadClients(), loadServiceItems()]);
    await initImageStockDB();
    await loadImageStockFromDB();
    setupEventListeners();
    setupTabs();
    setDefaultDate();
    
    // 管理画面側では修正・編集タブの機能を無効化
    const isAdminPage = window.location.pathname.includes('/admin/reports/new-pc') || 
                       window.location.pathname.includes('/admin/reports/new');
    if (!isAdminPage) {
    loadRevisionRequests();
    }
    
    setupMobileKeyboardHandling();
    setupScrollIndicator(); // スクロール位置インジケーターを設定
    // ブランド名と店舗名のselect要素を初期化
    initBrandSelect();
    initStoreSelect();
    
    // URLパラメータからレポートIDを取得して編集モードで開く
    const urlParams = new URLSearchParams(window.location.search);
    const editReportId = urlParams.get('edit');
    const isProposal = urlParams.get('proposal') === 'true';
    
    if (editReportId) {
      // 編集モードで開く
      await loadReportForEdit(editReportId, isProposal);
    }
    
    // レポートヘッダーセクションの初期表示を設定（サイドパネル内に移動）
    const sharedHeader = document.getElementById('shared-report-header');
    const newTab = document.getElementById('tab-new');
    if (sharedHeader && newTab && newTab.classList.contains('active')) {
      sharedHeader.style.display = 'block';
    }
    
    // サイドパネルの初期化
    setupSidePanel();
    
    // 自動保存データの復元を試行（新規作成タブがアクティブな場合のみ）
    if (newTab && newTab.classList.contains('active')) {
      const restored = await loadAutoSaveData();
      // 自動保存データが復元されなかった場合、またはセクションが空の場合、デフォルトで清掃項目セクションを追加
      if ((!restored || Object.keys(sections).length === 0) && window.addCleaningItemSection) {
        window.addCleaningItemSection();
      }
    } else {
      // 新規作成タブがアクティブでない場合でも、タブが切り替わったときに追加
      // これはsetupTabs内で処理される
    }
    
    // 次回ご提案タブがアクティブな場合も同様に処理
    const proposalTab = document.getElementById('tab-proposal');
    if (proposalTab && proposalTab.classList.contains('active')) {
      const restored = await loadAutoSaveData('proposal');
      // 自動保存データが復元されなかった場合、またはセクションが空の場合、デフォルトで清掃項目セクションを追加
      if ((!restored || Object.keys(sections).length === 0) && window.addCleaningItemSection) {
        window.addCleaningItemSection();
      }
    }
    
    // 自動保存のイベントリスナーを設定
    setupAutoSaveListeners();
    
    // リアルタイムバリデーションを設定
    setupRealTimeValidation();
    
    // プレビューモーダルが開いていないことを確認（強制的に非表示）
    const previewDialog = document.getElementById('preview-dialog');
    if (previewDialog) {
      previewDialog.classList.remove('show');
      previewDialog.style.display = 'none';
      previewDialog.style.setProperty('display', 'none', 'important');
    }
    
    // プレビュー保存確認ダイアログが開いていないことを確認（強制的に閉じる）
    const previewSaveDialog = document.getElementById('preview-save-dialog');
    if (previewSaveDialog) {
      if (previewSaveDialog.open) {
        previewSaveDialog.close();
      }
    }
  });
  
  // モバイルキーボード表示時のスクロール問題を修正
  function setupMobileKeyboardHandling() {
    // textareaのblurイベントでスクロール位置を調整
    document.addEventListener('blur', function(e) {
      if (e.target.classList.contains('section-textarea')) {
        // キーボードが閉じた後にスクロール位置を調整
        setTimeout(() => {
          window.scrollTo(0, 0);
          // アクティブなタブコンテンツのスクロール位置も調整
          const activeTab = document.querySelector('.tab-content.active');
          if (activeTab) {
            activeTab.scrollTop = Math.max(0, activeTab.scrollTop - 100);
          }
        }, 300);
      }
    }, true);
    
    // Visual Viewport APIを使用してキーボードの表示/非表示を検知
    if (window.visualViewport) {
      let lastViewportHeight = window.visualViewport.height;
      
      window.visualViewport.addEventListener('resize', () => {
        const currentHeight = window.visualViewport.height;
        const heightDiff = lastViewportHeight - currentHeight;
        
        // キーボードが閉じた場合（高さが増えた場合）
        if (heightDiff < -50) {
          setTimeout(() => {
            window.scrollTo(0, 0);
            const activeTab = document.querySelector('.tab-content.active');
            if (activeTab) {
              // スクロール位置を調整して余白を解消
              const scrollTop = activeTab.scrollTop;
              if (scrollTop > 0) {
                activeTab.scrollTop = Math.max(0, scrollTop - 200);
              }
            }
          }, 100);
        }
        
        lastViewportHeight = currentHeight;
      });
    }
    
    // textareaのフォーカスアウト時にスクロール位置を調整
    document.addEventListener('focusout', function(e) {
      if (e.target.classList.contains('section-textarea')) {
        setTimeout(() => {
          // キーボードが閉じるのを待ってからスクロール位置を調整
          if (window.visualViewport) {
            const viewportHeight = window.visualViewport.height;
            const windowHeight = window.innerHeight;
            
            // キーボードが閉じた場合（ビューポートの高さが増えた場合）
            if (viewportHeight > windowHeight * 0.8) {
              window.scrollTo(0, 0);
              const activeTab = document.querySelector('.tab-content.active');
              if (activeTab) {
                activeTab.scrollTop = Math.max(0, activeTab.scrollTop - 100);
              }
            }
          } else {
            // Visual Viewport APIが使えない場合のフォールバック
            window.scrollTo(0, 0);
            const activeTab = document.querySelector('.tab-content.active');
            if (activeTab) {
              activeTab.scrollTop = Math.max(0, activeTab.scrollTop - 100);
            }
          }
        }, 300);
      }
    }, true);
  }

  // 店舗読み込み
  async function loadStores() {
    try {
      const res = await fetch(`${API_BASE}/stores`);
      const data = await res.json();
      // APIが{items: [...]}形式で返す場合に対応
      stores = Array.isArray(data) ? data : (data.items || []);
      window.stores = stores; // グローバルスコープにも設定
      console.log('[loadStores] Loaded stores:', stores.length, stores.slice(0, 2));
    } catch (e) {
      console.error('Failed to load stores:', e);
    }
  }

  // ブランド読み込み
  async function loadBrands() {
    try {
      const res = await fetch(`${API_BASE}/brands`);
      brands = await res.json();
      window.brands = brands; // グローバルスコープにも設定
    } catch (e) {
      console.error('Failed to load brands:', e);
    }
  }

  // クライアント読み込み
  async function loadClients() {
    try {
      const res = await fetch(`${API_BASE}/clients`);
      clients = await res.json();
      window.clients = clients; // グローバルスコープにも設定
    } catch (e) {
      console.error('Failed to load clients:', e);
    }
  }

  // サービス項目読み込み
  async function loadServiceItems() {
    try {
      const res = await fetch('/data/service_items.json');
      const data = await res.json();
      serviceItems = data.items || data || [];
      window.serviceItems = serviceItems; // グローバルスコープにも設定
    } catch (e) {
      console.error('Failed to load service items:', e);
      serviceItems = [
        { title: 'グリストラップ' },
        { title: 'レンジフード洗浄' },
        { title: 'ダクト洗浄' },
        { title: 'エアコン分解洗浄' },
        { title: '床清掃' },
        { title: '窓清掃' },
        { title: 'トイレ清掃' }
      ];
      window.serviceItems = serviceItems; // グローバルスコープにも設定
    }
  }

  // デフォルト日付設定
  function setDefaultDate() {
    const dateInput = document.getElementById('report-date');
    if (dateInput) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }
  }

  // タブ切り替え設定
  function setupTabs() {
    const tabButtons = document.querySelectorAll('.tabs-navigation .tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const sharedHeader = document.getElementById('shared-report-header');
    
    tabButtons.forEach(btn => {
      btn.addEventListener('click', async () => {
        const targetTab = btn.dataset.tab;
        
        // サイドパネルが開いている場合は閉じる
        const sidePanel = document.getElementById('side-panel');
        const sidePanelOverlay = document.getElementById('side-panel-overlay');
        const detailsBtn = document.getElementById('details-btn');
        if (sidePanel && sidePanel.classList.contains('active')) {
          sidePanel.classList.remove('active');
          if (sidePanelOverlay) sidePanelOverlay.classList.remove('active');
          if (detailsBtn) detailsBtn.classList.remove('active');
          document.body.style.overflow = '';
        }
        
        // タブボタンのアクティブ状態を更新
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // タブコンテンツの表示を切り替え
        tabContents.forEach(content => {
          content.classList.remove('active');
          // 非アクティブなタブのセクション追加ボタンを確実に非表示にする
          const sectionAddIconsArea = content.querySelector('.section-add-icons-area');
          if (sectionAddIconsArea) {
            sectionAddIconsArea.style.display = 'none';
          }
        });
        const activeTabContent = document.getElementById(`tab-content-${targetTab}`);
        if (activeTabContent) {
          activeTabContent.classList.add('active');
          // アクティブなタブのセクション追加ボタンを表示する
          const activeSectionAddIconsArea = activeTabContent.querySelector('.section-add-icons-area');
          if (activeSectionAddIconsArea) {
            activeSectionAddIconsArea.style.display = '';
          }
        }
        
        // レポートヘッダーセクションの表示/非表示を切り替え
        if (sharedHeader) {
          if (targetTab === 'new' || targetTab === 'proposal') {
            sharedHeader.style.display = 'block';
          } else {
            sharedHeader.style.display = 'none';
          }
        }
        
        // タブ切り替え時に、そのタブのセクションデータを保存・復元
        if (targetTab === 'new' || targetTab === 'proposal' || targetTab === 'edit') {
          // 現在のタブのセクションデータを保存（sectionsオブジェクトをそのまま保存）
          const previousActiveTab = currentActiveTab || Array.from(tabButtons).find(btn => btn.classList.contains('active'))?.dataset.tab;
          if (previousActiveTab && (previousActiveTab === 'new' || previousActiveTab === 'proposal' || previousActiveTab === 'edit')) {
            sectionsByTab[previousActiveTab] = { ...sections };
          }
          
          // 切り替え先のタブのセクションデータを復元
          sections = { ...sectionsByTab[targetTab] };
          
          // currentActiveTabを更新
          currentActiveTab = targetTab;
          
          // セクションカウンターを調整（既存のセクションIDから最大値を取得）
          const existingSectionIds = Object.keys(sections).map(id => {
            const match = id.match(/section-(\d+)/);
            return match ? parseInt(match[1]) : 0;
          });
          if (existingSectionIds.length > 0) {
            sectionCounter = Math.max(...existingSectionIds);
          } else {
            sectionCounter = 0;
          }
          
          // 切り替え先のタブのDOMからセクションデータを再構築（DOMが既に存在する場合）
          const reportContentId = targetTab === 'proposal' ? 'report-content-proposal' : 
                                  targetTab === 'edit' ? 'report-content-edit' : 'report-content';
          const reportContent = document.getElementById(reportContentId);
          if (reportContent) {
            const existingSectionCards = reportContent.querySelectorAll('.section-card');
            
            // DOMにセクションが存在するが、sectionsオブジェクトが空の場合は、DOMから再構築
            if (existingSectionCards.length > 0 && Object.keys(sections).length === 0) {
              // DOMからセクションデータを再構築（簡易版：セクションIDだけを保持）
              existingSectionCards.forEach(card => {
                const sectionId = card.dataset.sectionId;
                if (sectionId && !sections[sectionId]) {
                  // セクションタイプを判定
                  const sectionTitle = card.querySelector('.section-title')?.textContent || '';
                  let sectionType = 'cleaning';
                  if (sectionTitle.includes('画像')) {
                    sectionType = 'image';
                  } else if (sectionTitle.includes('コメント')) {
                    sectionType = 'comment';
                  } else if (sectionTitle.includes('作業内容')) {
                    sectionType = 'work_content';
                  }
                  
                  // 基本的なセクションデータを作成（詳細はDOMから読み取る必要があるが、簡易版として空データを作成）
                  sections[sectionId] = { type: sectionType };
                }
              });
              
              // セクションカウンターを更新
              const sectionIds = Object.keys(sections).map(id => {
                const match = id.match(/section-(\d+)/);
                return match ? parseInt(match[1]) : 0;
              });
              if (sectionIds.length > 0) {
                sectionCounter = Math.max(...sectionIds);
              }
            }
            
            // セクションが空の場合はデフォルトで清掃項目セクションを追加
            if (Object.keys(sections).length === 0 && existingSectionCards.length === 0) {
              if (window.addCleaningItemSection) {
                window.addCleaningItemSection();
              }
            }
          }
        }
        
        // 修正タブに切り替えた場合は再読み込み
        if (targetTab === 'edit') {
          loadRevisionRequests();
        }
      });
    });
    
    // 初期表示時の処理はDOMContentLoadedイベントで行うため、ここでは削除
  }

  // 新規レポート作成時のフォームリセット
  async function resetFormForNewReport(tabType = 'new') {
    const formId = tabType === 'proposal' ? 'report-form-proposal' : 'report-form';
    const reportContentId = tabType === 'proposal' ? 'report-content-proposal' : 'report-content';
    
    // フォームをリセット
    const form = document.getElementById(formId);
    if (form) {
      form.reset();
      form.dataset.reportId = '';
    }
    
    // セクションをクリア
    sections = {};
    sectionCounter = 0;
    const reportContent = document.getElementById(reportContentId);
    if (reportContent) {
      // セクション追加アイコンエリアを保持
      const sectionAddIconsAreaId = tabType === 'proposal' ? 'section-add-icons-area-proposal' : 'section-add-icons-area';
      const sectionAddIconsArea = document.getElementById(sectionAddIconsAreaId);
      
      // セクションカードだけを削除（section-add-icons-areaは保持）
      const sectionCards = reportContent.querySelectorAll('.section-card');
      sectionCards.forEach(card => card.remove());
      
      // セクション追加アイコンエリアが削除された場合は再追加
      // ただし、既に存在する場合は何もしない（重複を防ぐ）
      if (!sectionAddIconsArea && reportContent) {
        // 念のため、再度存在確認（他の処理で追加された可能性がある）
        const existingArea = document.getElementById(sectionAddIconsAreaId);
        if (!existingArea) {
          const toggleBtnId = tabType === 'proposal' ? 'section-add-toggle-btn-proposal' : 'section-add-toggle-btn';
          const hintId = tabType === 'proposal' ? 'section-add-hint-proposal' : 'section-add-hint';
          
          // HTMLを再作成
          const sectionAddIconsAreaHTML = `
            <div class="section-add-icons-area" id="${sectionAddIconsAreaId}">
              <div class="section-add-hint" id="${hintId}">
                <span>↓New section↓</span>
              </div>
              <button type="button" class="section-add-toggle-btn" id="${toggleBtnId}">
                <i class="fas fa-plus"></i>
              </button>
            </div>
          `;
          reportContent.insertAdjacentHTML('beforeend', sectionAddIconsAreaHTML);
          // イベントリスナーを再設定
          setupSectionAddButtons(toggleBtnId, tabType);
        }
      }
    }
    
    // 清掃項目リストをリセット
    const cleaningItemsList = document.getElementById('cleaning-items-list');
    if (cleaningItemsList) {
      cleaningItemsList.innerHTML = '<span class="items-list-empty">項目を追加してください</span>';
    }
    
    // 画像ストックをリセット
    await clearImageStockDB();
    imageStock = [];
    renderImageStock();
    
    // 日付を今日に設定
    setDefaultDate();
    
    // 自動保存データをクリア
    clearAutoSaveData();
  }

  // 自動保存機能（localStorage使用）
  const AUTO_SAVE_KEY = 'report_draft_autosave';
  const AUTO_SAVE_DEBOUNCE_MS = 1000; // 1秒後に自動保存
  let autoSaveTimer = null;

  // 自動保存を実行
  function autoSave() {
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }
    
    autoSaveTimer = setTimeout(() => {
      try {
        const formData = {
          brandId: document.getElementById('report-brand')?.value || '',
          brandName: document.getElementById('report-brand-search')?.value || '',
          storeId: document.getElementById('report-store')?.value || '',
          storeName: document.getElementById('report-store-search')?.value || '',
          date: document.getElementById('report-date')?.value || '',
          startTime: document.getElementById('report-start')?.value || '',
          endTime: document.getElementById('report-end')?.value || '',
          sections: JSON.parse(JSON.stringify(sections)), // ディープコピー
          sectionCounter: sectionCounter,
          timestamp: Date.now()
        };
        
        localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(formData));
        console.log('[AutoSave] Saved draft');
      } catch (error) {
        console.error('[AutoSave] Error saving:', error);
      }
    }, AUTO_SAVE_DEBOUNCE_MS);
  }

  // 自動保存データを読み込み
  async function loadAutoSaveData() {
    try {
      const saved = localStorage.getItem(AUTO_SAVE_KEY);
      if (!saved) return false;
      
      const formData = JSON.parse(saved);
      
      // 24時間以上経過したデータは無効
      const now = Date.now();
      if (now - formData.timestamp > 24 * 60 * 60 * 1000) {
        clearAutoSaveData();
        return false;
      }
      
      // ユーザーに確認
      const shouldRestore = await showConfirm('自動保存の復元', '前回の入力内容が保存されています。復元しますか？');
      if (shouldRestore) {
        // フォームデータを復元
        if (formData.brandId) {
          document.getElementById('report-brand')?.setAttribute('value', formData.brandId);
          document.getElementById('report-brand-search')?.setAttribute('value', formData.brandName || '');
        }
        if (formData.storeId) {
          document.getElementById('report-store')?.setAttribute('value', formData.storeId);
          document.getElementById('report-store-search')?.setAttribute('value', formData.storeName || '');
        }
        if (formData.date) {
          document.getElementById('report-date')?.setAttribute('value', formData.date);
        }
        if (formData.startTime) {
          document.getElementById('report-start')?.setAttribute('value', formData.startTime);
        }
        if (formData.endTime) {
          document.getElementById('report-end')?.setAttribute('value', formData.endTime);
        }
        
        // セクションを復元
        sections = formData.sections || {};
        sectionCounter = formData.sectionCounter || 0;
        
        // セクションを再構築
        restoreSectionsFromAutoSave();
        
        return true;
      } else {
        // キャンセル時は自動保存データをクリアし、セクションもクリア
        clearAutoSaveData();
        sections = {};
        sectionCounter = 0;
        return false;
      }
    } catch (error) {
      console.error('[AutoSave] Error loading:', error);
      clearAutoSaveData();
      return false;
    }
  }

  // 自動保存データからセクションを復元
  function restoreSectionsFromAutoSave() {
    const reportContent = document.getElementById('report-content');
    if (!reportContent) return;
    
    reportContent.innerHTML = '';
    
    // セクションを順番に復元
    Object.keys(sections).forEach(sectionId => {
      const section = sections[sectionId];
      if (section.type === 'cleaning') {
        // 清掃項目セクション
        const options = serviceItems.map(si => 
          `<option value="${escapeHtml(si.title)}" ${(si.title === section.item_name) ? 'selected' : ''}>${escapeHtml(si.title)}</option>`
        ).join('');
        
        const html = `
          <div class="section-card" data-section-id="${sectionId}">
            <div class="section-header">
              <input type="checkbox" class="section-select-checkbox" data-section-id="${sectionId}" onchange="toggleSectionSelection('${sectionId}')">
              <span class="section-title"><i class="fas fa-list"></i> 清掃項目</span>
              <div class="section-header-actions">
                <button type="button" class="section-copy" onclick="copySection('${sectionId}')" title="コピー">
                  <i class="fas fa-copy"></i>
                </button>
                <button type="button" class="section-delete" onclick="deleteSection('${sectionId}')" title="削除">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
            <div class="section-body">
              <select class="cleaning-item-select" onchange="updateCleaningItem('${sectionId}', this.value)">
                <option value="">項目を選択</option>
                ${options}
                <option value="__other__">その他（自由入力）</option>
              </select>
              <input type="text" class="form-input cleaning-item-custom" placeholder="清掃項目名を入力" style="display:${section.item_name && !serviceItems.find(si => si.title === section.item_name) ? 'block' : 'none'}; margin-top:8px;" oninput="updateCleaningItemCustom('${sectionId}', this.value)" value="${escapeHtml(section.item_name || '')}">
              ${(section.textFields || []).map(textField => `
                <div class="cleaning-item-text-field-container" style="position:relative; margin-top:8px;">
                  <textarea class="form-input cleaning-item-text-field" placeholder="テキストを入力してください" style="margin-top:8px; min-height:80px; resize:vertical; width:100%;" oninput="updateCleaningItemTextField('${sectionId}', '${textField.id}', this.value)">${escapeHtml(textField.value || '')}</textarea>
                  <button type="button" class="cleaning-item-text-field-delete" onclick="deleteCleaningItemTextField('${sectionId}', '${textField.id}')" style="position:absolute; top:8px; right:8px; width:24px; height:24px; background:rgba(255, 103, 156, 0.9); color:#fff; border:none; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.7rem; z-index:10;">
                    <i class="fas fa-times"></i>
                  </button>
                </div>
              `).join('')}
              ${(section.subtitles || []).map(subtitle => `
                <div class="cleaning-item-subtitle-container" data-subtitle-id="${subtitle.id}" style="position:relative; margin-top:8px;">
                  <input type="text" class="form-input cleaning-item-subtitle" placeholder="サブタイトルを入力" style="width:100%; font-weight:600; font-size:1rem;" oninput="updateCleaningItemSubtitle('${sectionId}', '${subtitle.id}', this.value)" value="${escapeHtml(subtitle.value || '')}">
                  <button type="button" class="cleaning-item-subtitle-delete" data-section-id="${sectionId}" data-subtitle-id="${subtitle.id}" onclick="deleteCleaningItemSubtitle('${sectionId}', '${subtitle.id}')" style="position:absolute; top:8px; right:8px; width:24px; height:24px; background:rgba(255, 103, 156, 0.9); color:#fff; border:none; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.7rem; z-index:10;">
                    <i class="fas fa-times"></i>
                  </button>
                </div>
              `).join('')}
              ${(section.comments || []).map(comment => `
                <div class="cleaning-item-comment-container" data-comment-id="${comment.id}" style="position:relative; margin-top:8px;">
                  <textarea class="form-input cleaning-item-comment" placeholder="コメントを入力してください" style="margin-top:8px; min-height:80px; resize:vertical; width:100%;" oninput="updateCleaningItemComment('${sectionId}', '${comment.id}', this.value)">${escapeHtml(comment.value || '')}</textarea>
                  <button type="button" class="cleaning-item-comment-delete" data-section-id="${sectionId}" data-comment-id="${comment.id}" onclick="deleteCleaningItemComment('${sectionId}', '${comment.id}')" style="position:absolute; top:8px; right:8px; width:24px; height:24px; background:rgba(255, 103, 156, 0.9); color:#fff; border:none; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.7rem; z-index:10;">
                    <i class="fas fa-times"></i>
                  </button>
                </div>
              `).join('')}
              ${(section.imageContents || []).map(imageContent => {
                const imageType = imageContent.imageType || 'before_after';
                if (imageType === 'before_after') {
                  return `
                    <div class="cleaning-item-image-content" data-image-content-id="${imageContent.id}" style="margin-top:16px; position:relative;">
                      <div class="cleaning-item-image-content-header" style="display:flex; justify-content:flex-end; align-items:center; margin-bottom:8px;">
                        <button type="button" class="cleaning-item-image-content-delete" onclick="deleteCleaningItemImageContent('${sectionId}', '${imageContent.id}')" style="width:24px; height:24px; background:rgba(255, 103, 156, 0.9); color:#fff; border:none; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.7rem;">
                          <i class="fas fa-times"></i>
                        </button>
                      </div>
                      <div class="cleaning-item-image-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                        <div class="image-category">
                          <div class="image-category-title before" style="font-size:0.875rem; font-weight:600; color:#374151; margin-bottom:8px;">
                            <i class="fas fa-clock"></i> 作業前
                          </div>
                          <div class="image-list" id="${imageContent.id}-before" style="min-height:120px; border:2px dashed #e5e7eb; border-radius:8px; padding:8px; display:flex; flex-wrap:wrap; gap:8px; align-items:flex-start; justify-content:center;">
                            ${(imageContent.photos?.before || []).map(photo => {
                              const photoUrl = photo.blobUrl || photo;
                              const photoId = photo.imageId || photo;
                              return `
                              <div class="image-thumb" draggable="true" data-image-url="${photoUrl}" data-image-id="${photoId}" data-category="before" data-section-id="${sectionId}" data-image-content-id="${imageContent.id}" style="width:120px; height:120px; position:relative; border-radius:4px; overflow:hidden; margin:0 auto;">
                                <img src="${photoUrl}" alt="Photo" draggable="false" style="width:100%; height:100%; object-fit:cover;">
                                <button type="button" class="image-thumb-remove" onclick="removeCleaningItemImage('${sectionId}', '${imageContent.id}', 'before', '${photoId}', this.parentElement)" style="position:absolute; top:4px; right:4px; width:18px; height:18px; background:rgba(255, 103, 156, 0.9); color:#fff; border:none; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.6rem; z-index:10;">
                                  <i class="fas fa-times"></i>
                                </button>
                              </div>
                            `;
                            }).join('')}
                            <button type="button" class="image-add-btn cleaning-item-image-add-btn" onclick="openCleaningItemImageAddModal('${sectionId}', '${imageContent.id}', 'before')" style="cursor:pointer; width:80px; height:80px; border:2px dashed #d1d5db; border-radius:8px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; color:#6b7280; font-size:0.75rem; background:transparent; padding:0;">
                              <i class="fas fa-plus"></i>
                              <span>追加</span>
                            </button>
                          </div>
                        </div>
                        <div class="image-category">
                          <div class="image-category-title after" style="font-size:0.875rem; font-weight:600; color:#374151; margin-bottom:8px;">
                            <i class="fas fa-check-circle"></i> 作業後
                          </div>
                          <div class="image-list" id="${imageContent.id}-after" style="min-height:120px; border:2px dashed #e5e7eb; border-radius:8px; padding:8px; display:flex; flex-wrap:wrap; gap:8px; align-items:flex-start; justify-content:center;">
                            ${(imageContent.photos?.after || []).map(photo => {
                              const photoUrl = photo.blobUrl || photo;
                              const photoId = photo.imageId || photo;
                              return `
                              <div class="image-thumb" draggable="true" data-image-url="${photoUrl}" data-image-id="${photoId}" data-category="after" data-section-id="${sectionId}" data-image-content-id="${imageContent.id}" style="width:120px; height:120px; position:relative; border-radius:4px; overflow:hidden; margin:0 auto;">
                                <img src="${photoUrl}" alt="Photo" draggable="false" style="width:100%; height:100%; object-fit:cover;">
                                <button type="button" class="image-thumb-remove" onclick="removeCleaningItemImage('${sectionId}', '${imageContent.id}', 'after', '${photoId}', this.parentElement)" style="position:absolute; top:4px; right:4px; width:18px; height:18px; background:rgba(255, 103, 156, 0.9); color:#fff; border:none; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.6rem; z-index:10;">
                                  <i class="fas fa-times"></i>
                                </button>
                              </div>
                            `;
                            }).join('')}
                            <button type="button" class="image-add-btn cleaning-item-image-add-btn" onclick="openCleaningItemImageAddModal('${sectionId}', '${imageContent.id}', 'after')" style="cursor:pointer; width:80px; height:80px; border:2px dashed #d1d5db; border-radius:8px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; color:#6b7280; font-size:0.75rem; background:transparent; padding:0;">
                              <i class="fas fa-plus"></i>
                              <span>追加</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  `;
                } else {
                  // 次回ご提案タブかどうかを判定
                  const activeTab = document.querySelector('.tab-btn.active');
                  const isProposal = activeTab && activeTab.dataset.tab === 'proposal';
                  const labelText = isProposal ? 'ご提案箇所' : '施工後';
                  return `
                    <div class="cleaning-item-image-content" data-image-content-id="${imageContent.id}" style="margin-top:16px; position:relative;">
                      <div class="cleaning-item-image-content-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <div class="image-category-title completed" style="font-size:0.875rem; font-weight:600; color:#374151;">
                          <i class="fas fa-star"></i> ${labelText}
                        </div>
                        <button type="button" class="cleaning-item-image-content-delete" onclick="deleteCleaningItemImageContent('${sectionId}', '${imageContent.id}')" style="width:24px; height:24px; background:rgba(255, 103, 156, 0.9); color:#fff; border:none; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.7rem;">
                          <i class="fas fa-times"></i>
                        </button>
                      </div>
                      <div class="cleaning-item-image-grid" style="display:grid; grid-template-columns:1fr; gap:12px;">
                        <div class="image-category">
                          <div class="image-list" id="${imageContent.id}-completed" style="min-height:120px; border:2px dashed #e5e7eb; border-radius:8px; padding:8px; display:flex; flex-wrap:wrap; gap:8px; align-items:flex-start; justify-content:center;">
                            ${(imageContent.photos?.completed || []).map(photo => {
                              const photoUrl = photo.blobUrl || photo;
                              const photoId = photo.imageId || photo;
                              return `
                              <div class="image-thumb" draggable="true" data-image-url="${photoUrl}" data-image-id="${photoId}" data-category="completed" data-section-id="${sectionId}" data-image-content-id="${imageContent.id}" style="width:120px; height:120px; position:relative; border-radius:4px; overflow:hidden; margin:0 auto;">
                                <img src="${photoUrl}" alt="Photo" draggable="false" style="width:100%; height:100%; object-fit:cover;">
                                <button type="button" class="image-thumb-remove" onclick="removeCleaningItemImage('${sectionId}', '${imageContent.id}', 'completed', '${photoId}', this.parentElement)" style="position:absolute; top:4px; right:4px; width:18px; height:18px; background:rgba(255, 103, 156, 0.9); color:#fff; border:none; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.6rem; z-index:10;">
                                  <i class="fas fa-times"></i>
                                </button>
                              </div>
                            `;
                            }).join('')}
                            <button type="button" class="image-add-btn cleaning-item-image-add-btn" onclick="openCleaningItemImageAddModal('${sectionId}', '${imageContent.id}', 'completed')" style="cursor:pointer; width:80px; height:80px; border:2px dashed #d1d5db; border-radius:8px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; color:#6b7280; font-size:0.75rem; background:transparent; padding:0;">
                              <i class="fas fa-plus"></i>
                              <span>追加</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  `;
                }
              }).join('')}
              <div class="cleaning-item-insert-actions" style="margin-top:16px; display:flex; justify-content:center; gap:12px;">
                <button type="button" class="cleaning-item-insert-btn" onclick="addImageToCleaningItem('${sectionId}')" title="画像挿入">
                  <i class="fas fa-image"></i>
                  <span>画像挿入</span>
                </button>
                <button type="button" class="cleaning-item-insert-btn" onclick="addCommentToCleaningItem('${sectionId}')" title="コメント挿入">
                  <i class="fas fa-comment"></i>
                  <span>コメント挿入</span>
                </button>
                <button type="button" class="cleaning-item-insert-btn" onclick="addSubtitleToCleaningItem('${sectionId}')" title="サブタイトル挿入">
                  <i class="fas fa-heading"></i>
                  <span>サブタイトル挿入</span>
                </button>
              </div>
            </div>
          </div>
        `;
        reportContent.insertAdjacentHTML('beforeend', html);
        
        // セクション内画像コンテンツのイベントリスナーを設定
        if (section.imageContents && section.imageContents.length > 0) {
          setTimeout(() => {
            section.imageContents.forEach(imageContent => {
              const imageType = imageContent.imageType || 'before_after';
              setupCleaningItemImageUpload(imageContent.id, sectionId, imageType);
              
              // ドラッグ&ドロップを設定
              if (imageType === 'before_after') {
                const beforeList = document.getElementById(`${imageContent.id}-before`);
                const afterList = document.getElementById(`${imageContent.id}-after`);
                if (beforeList) setupImageListDragAndDrop(beforeList, sectionId, 'before', imageContent.id);
                if (afterList) setupImageListDragAndDrop(afterList, sectionId, 'after', imageContent.id);
                
                // 画像サムネイルにドラッグ&ドロップを設定
                if (beforeList) {
                  beforeList.querySelectorAll('.image-thumb').forEach(thumb => {
                    const url = thumb.dataset.imageUrl;
                    const imageId = thumb.dataset.imageId;
                    if (url) {
                      setupCleaningItemImageThumbDragAndDrop(thumb, sectionId, imageContent.id, 'before', url, imageId);
                    }
                  });
                }
                if (afterList) {
                  afterList.querySelectorAll('.image-thumb').forEach(thumb => {
                    const url = thumb.dataset.imageUrl;
                    const imageId = thumb.dataset.imageId;
                    if (url) {
                      setupCleaningItemImageThumbDragAndDrop(thumb, sectionId, imageContent.id, 'after', url, imageId);
                    }
                  });
                }
              } else if (imageType === 'completed') {
                const completedList = document.getElementById(`${imageContent.id}-completed`);
                if (completedList) {
                  setupImageListDragAndDrop(completedList, sectionId, 'completed', imageContent.id);
                  
                  // 画像サムネイルにドラッグ&ドロップを設定
                  completedList.querySelectorAll('.image-thumb').forEach(thumb => {
                    const url = thumb.dataset.imageUrl;
                    const imageId = thumb.dataset.imageId;
                    if (url) {
                      setupCleaningItemImageThumbDragAndDrop(thumb, sectionId, imageContent.id, 'completed', url, imageId);
                    }
                  });
                }
              }
            });
          }, 0);
        }
      } else if (section.type === 'image') {
        // 画像セクション（簡易復元、画像は再読み込みが必要）
        // 完全な復元は複雑なため、セクション構造のみ復元
        console.log('[AutoSave] Image sections cannot be fully restored. Please re-add images.');
      } else if (section.type === 'comment') {
        // コメントセクション
        const html = `
          <div class="section-card" data-section-id="${sectionId}">
            <div class="section-header">
              <input type="checkbox" class="section-select-checkbox" data-section-id="${sectionId}" onchange="toggleSectionSelection('${sectionId}')">
              <span class="section-title"><i class="fas fa-comment"></i> コメント</span>
              <div class="section-header-actions">
                <button type="button" class="section-copy" onclick="copySection('${sectionId}')" title="コピー">
                  <i class="fas fa-copy"></i>
                </button>
                <button type="button" class="section-delete" onclick="deleteSection('${sectionId}')" title="削除">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
            <div class="section-body">
              <textarea class="form-input section-textarea" placeholder="コメントを入力..." oninput="updateSectionContent('${sectionId}', this.value)">${escapeHtml(section.content || '')}</textarea>
            </div>
          </div>
        `;
        reportContent.insertAdjacentHTML('beforeend', html);
      } else if (section.type === 'work_content') {
        // 作業内容セクション
        const html = `
          <div class="section-card" data-section-id="${sectionId}">
            <div class="section-header">
              <input type="checkbox" class="section-select-checkbox" data-section-id="${sectionId}" onchange="toggleSectionSelection('${sectionId}')">
              <span class="section-title"><i class="fas fa-tasks"></i> 作業内容</span>
              <div class="section-header-actions">
                <button type="button" class="section-copy" onclick="copySection('${sectionId}')" title="コピー">
                  <i class="fas fa-copy"></i>
                </button>
                <button type="button" class="section-delete" onclick="deleteSection('${sectionId}')" title="削除">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
            <div class="section-body">
              <textarea class="form-input section-textarea" placeholder="作業内容を入力..." oninput="updateSectionContent('${sectionId}', this.value)">${escapeHtml(section.content || '')}</textarea>
            </div>
          </div>
        `;
        reportContent.insertAdjacentHTML('beforeend', html);
      }
    });
    
    // ドラッグ&ドロップを再設定
    setupAllSectionDragAndDrop();
    updateCleaningItemsList();
  }

  // 自動保存データをクリア
  function clearAutoSaveData() {
    localStorage.removeItem(AUTO_SAVE_KEY);
    console.log('[AutoSave] Cleared draft');
  }

  // リアルタイムバリデーション機能
  function setupRealTimeValidation() {
    // 必須項目のバリデーション
    const requiredFields = [
      { id: 'report-brand-search', name: 'ブランド名', getValue: () => {
        const brandNameInput = document.getElementById('report-brand-search')?.value.trim() || '';
        const brandNameHidden = document.getElementById('report-brand-name')?.value || '';
        return brandNameInput || brandNameHidden;
      }},
      { id: 'report-store-search', name: '店舗名', getValue: () => {
        const storeNameInput = document.getElementById('report-store-search')?.value.trim() || '';
        const storeNameHidden = document.getElementById('report-store-name')?.value || '';
        return storeNameInput || storeNameHidden;
      }},
      { id: 'report-date', name: '清掃日', getValue: () => document.getElementById('report-date')?.value || ''}
    ];
    
    // バリデーション状態を更新
    function updateValidationState() {
      requiredFields.forEach(field => {
        const element = document.getElementById(field.id);
        if (!element) return;
        
        const value = field.getValue();
        const isValid = value.length > 0;
        
        // エラー表示を追加/削除
        if (isValid) {
          element.classList.remove('validation-error');
          element.classList.add('validation-valid');
          // エラーメッセージを削除
          const errorMsg = element.parentElement?.querySelector('.validation-error-message');
          if (errorMsg) errorMsg.remove();
        } else {
          element.classList.remove('validation-valid');
          element.classList.add('validation-error');
          // エラーメッセージを追加（まだない場合）
          if (!element.parentElement?.querySelector('.validation-error-message')) {
            const errorMsg = document.createElement('span');
            errorMsg.className = 'validation-error-message';
            errorMsg.textContent = `${field.name}は必須です`;
            element.parentElement?.appendChild(errorMsg);
          }
        }
      });
      
      // 進捗インジケーターを更新
      updateProgressIndicator();
    }
    
    // 進捗インジケーターを更新
    function updateProgressIndicator() {
      const validCount = requiredFields.filter(f => f.getValue().length > 0).length;
      const totalCount = requiredFields.length;
      const progress = Math.round((validCount / totalCount) * 100);
      
      // 進捗バーを更新
      let progressBar = document.getElementById('form-progress-bar');
      if (!progressBar) {
        progressBar = document.createElement('div');
        progressBar.id = 'form-progress-bar';
        progressBar.className = 'form-progress-bar';
        const header = document.querySelector('.page-header-fixed');
        if (header) {
          header.appendChild(progressBar);
        }
      }
      
      progressBar.style.width = `${progress}%`;
      progressBar.setAttribute('data-progress', progress);
    }
    
    // 各フィールドにイベントリスナーを設定
    requiredFields.forEach(field => {
      const element = document.getElementById(field.id);
      if (element) {
        element.addEventListener('input', updateValidationState);
        element.addEventListener('change', updateValidationState);
        element.addEventListener('blur', updateValidationState);
      }
    });
    
    // ブランド・店舗選択時のバリデーション更新
    const brandSelect = document.getElementById('report-brand');
    const storeSelect = document.getElementById('report-store');
    if (brandSelect) {
      brandSelect.addEventListener('change', updateValidationState);
    }
    if (storeSelect) {
      storeSelect.addEventListener('change', updateValidationState);
    }
    
    // 初期状態を更新
    updateValidationState();
  }

  // 自動保存のイベントリスナーを設定
  function setupAutoSaveListeners() {
    // フォーム入力フィールドに自動保存を設定
    const form = document.getElementById('report-form');
    if (!form) return;
    
    // 基本情報フィールド
    const fields = [
      'report-brand-search',
      'report-store-search',
      'report-date',
      'report-start',
      'report-end'
    ];
    
    fields.forEach(fieldId => {
      const field = document.getElementById(fieldId);
      if (field) {
        field.addEventListener('input', autoSave);
        field.addEventListener('change', autoSave);
      }
    });
    
    // セクション追加・削除・更新時に自動保存
    const originalAddCleaningItem = window.addCleaningItemSection;
    const originalAddImageSection = window.addImageSectionBeforeAfter;
    const originalAddComment = window.addCommentSection;
    const originalAddWorkContent = window.addWorkContentSection;
    const originalDeleteSection = window.deleteSection;
    const originalUpdateCleaningItem = window.updateCleaningItem;
    const originalUpdateSectionContent = window.updateSectionContent;
    
    if (originalAddCleaningItem) {
      window.addCleaningItemSection = function() {
        originalAddCleaningItem();
        autoSave();
      };
    }
    
    if (originalAddImageSection) {
      window.addImageSectionBeforeAfter = function() {
        originalAddImageSection();
        autoSave();
      };
    }
    
    if (originalAddComment) {
      window.addCommentSection = function() {
        originalAddComment();
        autoSave();
      };
    }
    
    if (originalAddWorkContent) {
      window.addWorkContentSection = function() {
        originalAddWorkContent();
        autoSave();
      };
    }
    
    if (originalDeleteSection) {
      window.deleteSection = function(sectionId) {
        originalDeleteSection(sectionId);
        autoSave();
      };
    }
    
    if (originalUpdateCleaningItem) {
      window.updateCleaningItem = function(sectionId, value) {
        originalUpdateCleaningItem(sectionId, value);
        autoSave();
      };
    }
    
    // updateCleaningItemCustomも自動保存を呼ぶようにラップ
    const originalUpdateCleaningItemCustom = window.updateCleaningItemCustom;
    if (originalUpdateCleaningItemCustom) {
      window.updateCleaningItemCustom = function(sectionId, value) {
        originalUpdateCleaningItemCustom(sectionId, value);
        autoSave();
      };
    }
    
    if (originalUpdateSectionContent) {
      window.updateSectionContent = function(sectionId, value) {
        originalUpdateSectionContent(sectionId, value);
        autoSave();
      };
    }
    
    // textareaの入力にも自動保存を設定（動的に追加されるセクション用）
    document.addEventListener('input', (e) => {
      if (e.target.classList.contains('section-textarea') || 
          e.target.classList.contains('cleaning-item-select') ||
          e.target.classList.contains('cleaning-item-custom') ||
          e.target.classList.contains('cleaning-item-text-field') ||
          e.target.classList.contains('cleaning-item-comment') ||
          e.target.classList.contains('cleaning-item-subtitle')) {
        autoSave();
      }
    }, true);
    
    // フォーム送信時に自動保存データをクリアし、送信処理を実行
    form.addEventListener('submit', async (e) => {
      // 送信ボタンがクリックされた場合のみ送信を許可
      const submitBtn = form.querySelector('button[type="submit"]');
      if (e.submitter !== submitBtn) {
        e.preventDefault();
        return;
      }
      clearAutoSaveData();
      await handleSubmit(e);
    });
    
    // フォーム内のinput要素でエンターキーを押したときにフォーム送信を防ぐ
    form.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.type !== 'submit') {
        // textarea以外のinput要素でエンターキーを押した場合は送信を防ぐ
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
          e.preventDefault();
        }
      }
    });
    
    // 次回ご提案タブのフォームにも送信ハンドラーを設定
    const proposalForm = document.getElementById('report-form-proposal');
    if (proposalForm) {
      proposalForm.addEventListener('submit', async (e) => {
        // 送信ボタンがクリックされた場合のみ送信を許可
        const submitBtn = proposalForm.querySelector('button[type="submit"]');
        if (e.submitter !== submitBtn) {
          e.preventDefault();
          return;
        }
        clearAutoSaveData('proposal');
        await handleSubmit(e);
      });
      
      // フォーム内のinput要素でエンターキーを押したときにフォーム送信を防ぐ
      proposalForm.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.type !== 'submit') {
          // textarea以外のinput要素でエンターキーを押した場合は送信を防ぐ
          if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
            e.preventDefault();
          }
        }
      });
    }
  }

  // 修正依頼レポートを読み込み
  async function loadRevisionRequests() {
    const listContainer = document.getElementById('revision-list');
    if (!listContainer) return;
    
    listContainer.innerHTML = `
      <div class="loading-spinner">
        <i class="fas fa-spinner fa-spin"></i>
        <p>読み込み中...</p>
      </div>
    `;
    
    try {
      const idToken = await getFirebaseIdToken();
      const response = await fetch(`${REPORT_API}/staff/reports?status=revision_requested`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error('レポートの取得に失敗しました');
      }
      
      const data = await response.json();
      let reports = data.items || data.reports || [];
      
      // 念のため、クライアント側でもrevision_requestedステータスのものだけをフィルタリング
      reports = reports.filter(report => {
        const status = report.status || '';
        return status === 'revision_requested';
      });
      
      // バッジを更新
      const badge = document.getElementById('revision-badge');
      if (badge) {
        if (reports.length > 0) {
          badge.textContent = reports.length;
          badge.style.display = 'inline-block';
        } else {
          badge.style.display = 'none';
        }
      }
      
      if (reports.length === 0) {
        listContainer.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-check-circle"></i>
            <p>修正依頼されたレポートはありません</p>
          </div>
        `;
        return;
      }
      
      listContainer.innerHTML = reports.map(report => {
        const date = new Date(report.cleaning_date || report.created_at).toLocaleDateString('ja-JP');
        const comment = report.revision_comment || report.admin_comment || '';
        
        return `
          <div class="revision-card" data-report-id="${report.report_id || report.id}">
            <div class="revision-card-header">
              <h3 class="revision-card-title">${escapeHtml(report.store_name || '店舗名不明')}</h3>
              <span class="revision-card-date">${date}</span>
            </div>
            <div class="revision-card-info">
              <div><strong>清掃日:</strong> ${date}</div>
              <div><strong>レポートID:</strong> ${report.report_id || report.id}</div>
            </div>
            ${comment ? `
              <div class="revision-card-comment">
                <span class="revision-card-comment-label">管理者からのコメント:</span>
                <p style="margin: 0; white-space: pre-wrap;">${escapeHtml(comment)}</p>
              </div>
            ` : ''}
            <div class="revision-card-actions">
              <button type="button" class="btn-edit" onclick="editReport('${report.report_id || report.id}')">
                <i class="fas fa-edit"></i>
                修正する
              </button>
            </div>
          </div>
        `;
      }).join('');
      
    } catch (error) {
      console.error('Error loading revision requests:', error);
      listContainer.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-exclamation-triangle"></i>
          <p>読み込みに失敗しました<br><small>${error.message}</small></p>
        </div>
      `;
    }
  }

  // URLパラメータからレポートIDを取得して編集モードで開く
  async function loadReportForEdit(reportId, isProposal = false) {
    try {
      const idToken = await getFirebaseIdToken();
      const response = await fetch(`${REPORT_API}/staff/reports/${reportId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error('レポートの取得に失敗しました');
      }
      
      const data = await response.json();
      const report = data.report || data;
      
      // 次回提案の場合は次回ご提案タブに切り替え、それ以外は新規作成タブに切り替え
      if (isProposal || report.proposal_type === 'proposal' || report.type === 'proposal') {
        document.getElementById('tab-proposal').click();
      } else {
        document.getElementById('tab-new').click();
      }
      
      // フォームにデータを読み込む
      await loadReportToForm(report);
      
    } catch (error) {
      console.error('Error loading report for edit:', error);
      showError('レポートの読み込みに失敗しました: ' + getErrorMessage(error));
    }
  }

  // レポートを編集モードで開く（清掃員側の修正・編集タブ用）
  window.editReport = async function(reportId) {
    try {
      const idToken = await getFirebaseIdToken();
      const response = await fetch(`${REPORT_API}/staff/reports/${reportId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error('レポートの取得に失敗しました');
      }
      
      const data = await response.json();
      const report = data.report || data;
      
      // 新規作成タブに切り替え
      document.getElementById('tab-new').click();
      
      // フォームにデータを読み込む
      await loadReportToForm(report);
      
    } catch (error) {
      console.error('Error loading report:', error);
      showError('レポートの読み込みに失敗しました: ' + getErrorMessage(error));
    }
  };

  // レポートデータをフォームに読み込む
  async function loadReportToForm(report) {
    // stores配列が空の場合は読み込みを待つ
    if (stores.length === 0) {
      console.log('[loadReportToForm] Stores not loaded yet, loading...');
      await loadStores();
    }
    
    // 基本情報
    const storeId = report.store_id || '';
    document.getElementById('report-store').value = storeId;
    
    // 店舗名を取得（report.store_nameがあっても、stores配列からも検索して確実に取得）
    let storeName = report.store_name || '';
    if (storeId) {
      // stores配列から店舗を検索（report.store_nameがなくても検索）
      const store = stores.find(s => {
        const sId = s.store_id || s.id;
        return sId === storeId || String(sId) === String(storeId);
      });
      if (store) {
        // stores配列から取得した店舗名を優先（より確実）
        storeName = store.store_name || store.name || storeName;
        console.log('[loadReportToForm] Found store:', { storeId, storeName, store, reportStoreName: report.store_name });
      } else {
        console.warn('[loadReportToForm] Store not found:', { storeId, storesCount: stores.length, sampleStore: stores[0] });
      }
    }
    
    console.log('[loadReportToForm] Store name:', { storeId, storeName, reportStoreName: report.store_name });
    
    document.getElementById('report-store-name').value = storeName;
    const storeSelect = document.getElementById('report-store-select');
    if (storeSelect) {
      // セレクトボックスを更新してから値を設定
      if (typeof window.updateStoreSelect === 'function') {
        window.updateStoreSelect();
      }
      if (storeId) {
        storeSelect.value = storeId;
      }
    }
    
    // ブランド情報を設定（店舗から取得）
    if (storeId) {
      const store = stores.find(s => {
        const sId = s.store_id || s.id;
        return sId === storeId || String(sId) === String(storeId);
      });
      if (store) {
        const brandId = store.brand_id || store.brandId;
        if (brandId) {
          const brandName = getBrandName(brandId);
          if (brandName) {
            document.getElementById('report-brand').value = brandId;
            document.getElementById('report-brand-name').value = brandName;
            const brandSearchInput = document.getElementById('report-brand-search');
            if (brandSearchInput) {
              brandSearchInput.value = brandName;
              // ブランドが設定されている場合はreadonlyにする（ドロップダウン方式）
              brandSearchInput.setAttribute('readonly', 'readonly');
            }
          }
        }
      }
    } else if (report.brand_id) {
      // ブランドIDが直接指定されている場合
      const brandName = getBrandName(report.brand_id);
      if (brandName) {
        document.getElementById('report-brand').value = report.brand_id;
        document.getElementById('report-brand-name').value = brandName;
        const brandSearchInput = document.getElementById('report-brand-search');
        if (brandSearchInput) {
          brandSearchInput.value = brandName;
          // ブランドが設定されている場合はreadonlyにする（ドロップダウン方式）
          brandSearchInput.setAttribute('readonly', 'readonly');
        }
      }
    }
    
    // 店舗名の入力フィールドを更新
    const storeSearchInput = document.getElementById('report-store-search');
    if (storeSearchInput && storeName) {
      storeSearchInput.value = storeName;
    }
    
    document.getElementById('report-date').value = report.cleaning_date || '';
    document.getElementById('report-start').value = report.cleaning_start_time || '';
    document.getElementById('report-end').value = report.cleaning_end_time || '';
    
    // レポートIDを保持（更新時に使用）
    const form = document.getElementById('report-form');
    form.dataset.reportId = report.report_id || report.id;
    
    // セクションをクリア
    sections = {};
    sectionCounter = 0;
    document.getElementById('report-content').innerHTML = '';
    
    // 清掃項目を追加
    const workItems = report.work_items || [];
    workItems.forEach(item => {
      sectionCounter++;
      const sectionId = `section-${sectionCounter}`;
      sections[sectionId] = {
        type: 'cleaning',
        item_name: item.item_name || item.item_id
      };
      
      const options = serviceItems.map(si => 
        `<option value="${escapeHtml(si.title)}" ${(si.title === item.item_name) ? 'selected' : ''}>${escapeHtml(si.title)}</option>`
      ).join('');
      
      const html = `
        <div class="section-card" data-section-id="${sectionId}">
          <div class="section-header">
            <span class="section-title"><i class="fas fa-list"></i> 清掃項目</span>
            <button type="button" class="section-delete" onclick="deleteSection('${sectionId}')">
              <i class="fas fa-trash"></i>
            </button>
          </div>
          <div class="section-body">
            <select class="cleaning-item-select" onchange="updateCleaningItem('${sectionId}', this.value)">
              <option value="">項目を選択</option>
              ${options}
              <option value="__other__">その他（自由入力）</option>
            </select>
            <input type="text" class="form-input cleaning-item-custom" placeholder="清掃項目名を入力" style="display:none; margin-top:8px;" oninput="updateCleaningItemCustom('${sectionId}', this.value)">
          </div>
        </div>
      `;
      document.getElementById('report-content').insertAdjacentHTML('beforeend', html);
      const newCard = document.querySelector(`[data-section-id="${sectionId}"]`);
      if (newCard) setupSectionDragAndDrop(newCard);
    });
    
    // セクションを追加
    const reportSections = report.sections || [];
    reportSections.forEach(section => {
      if (section.section_type === 'image') {
        addImageSectionWithData(section);
      } else if (section.section_type === 'comment') {
        addCommentSectionWithData(section);
      } else if (section.section_type === 'work_content') {
        addWorkContentSectionWithData(section);
      }
    });
    
    updateCleaningItemsList();
    
    // 送信ボタンのテキストを変更
    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn) {
      submitBtn.innerHTML = '<i class="fas fa-save"></i> 修正を提出';
    }
  }

  // データ付きでセクションを追加する関数
  function addImageSectionWithData(section) {
    sectionCounter++;
    const sectionId = section.section_id || `section-${sectionCounter}`;
    const photos = section.photos || {};
    const imageType = section.image_type || (photos.completed && !photos.before && !photos.after ? 'completed' : 'before_after');
    
    // セクションタイプに応じてデータを設定
    if (imageType === 'completed') {
    sections[sectionId] = {
      type: 'image',
        image_type: 'completed',
        photos: { completed: photos.completed || [] }
      };
      
      const html = `
        <div class="section-card" data-section-id="${sectionId}">
          <div class="section-header">
          <input type="checkbox" class="section-select-checkbox" data-section-id="${sectionId}" onchange="toggleSectionSelection('${sectionId}')">
            <span class="section-title"><i class="fas fa-image"></i> 画像（施工後）</span>
          <div class="section-header-actions">
            <button type="button" class="section-copy" onclick="copySection('${sectionId}')" title="コピー">
              <i class="fas fa-copy"></i>
            </button>
            <button type="button" class="section-delete" onclick="deleteSection('${sectionId}')" title="削除">
              <i class="fas fa-trash"></i>
            </button>
          </div>
          </div>
          <div class="section-body">
            <div class="image-grid image-grid-completed">
              <div class="image-category image-category-completed">
                <div class="image-category-title completed"><i class="fas fa-star"></i> 施工後</div>
                <div class="image-list image-list-completed" id="${sectionId}-completed">
                  ${(photos.completed || []).length === 0 ? `
                    <div class="image-placeholder">
                      <img src="${DEFAULT_NO_PHOTO_IMAGE}" alt="写真を撮り忘れました" class="default-no-photo-image">
                    </div>
                  ` : ''}
                  ${(photos.completed || []).map(url => `
                    <div class="image-thumb" draggable="true" data-section-id="${sectionId}" data-category="completed" data-image-url="${url}">
                      <img src="${url}" alt="Completed" draggable="false">
                      <button type="button" class="image-thumb-remove" onclick="removeImage('${sectionId}', 'completed', '${url}', '', this)">
                        <i class="fas fa-times"></i>
                      </button>
                    </div>
                  `).join('')}
                  <label class="image-add-btn" style="cursor: pointer;">
                    <input type="file" accept="image/*" multiple class="section-image-file-input" data-section-id="${sectionId}" data-category="completed" style="display:none;">
                    <i class="fas fa-plus"></i>
                    <span>追加</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      document.getElementById('report-content').insertAdjacentHTML('beforeend', html);
      const newCard = document.querySelector(`[data-section-id="${sectionId}"]`);
      if (newCard) {
        setupSectionDragAndDrop(newCard);
        const completedList = document.getElementById(`${sectionId}-completed`);
        if (completedList) setupImageListDragAndDrop(completedList, sectionId, 'completed');
        newCard.querySelectorAll('.image-thumb').forEach(thumb => {
          const thumbSectionId = thumb.dataset.sectionId;
          const thumbCategory = thumb.dataset.category;
          const thumbUrl = thumb.dataset.imageUrl;
          if (thumbSectionId && thumbCategory && thumbUrl) {
            setupImageThumbDragAndDrop(thumb, thumbSectionId, thumbCategory, thumbUrl);
          }
        });
      }
    } else {
      // 作業前・作業後タイプ
      sections[sectionId] = {
        type: 'image',
        image_type: 'before_after',
        photos: { before: photos.before || [], after: photos.after || [] }
    };
    
    const html = `
      <div class="section-card" data-section-id="${sectionId}">
        <div class="section-header">
          <span class="section-title"><i class="fas fa-image"></i> 画像（作業前・作業後）</span>
          <button type="button" class="section-delete" onclick="deleteSection('${sectionId}')">
            <i class="fas fa-trash"></i>
          </button>
        </div>
        <div class="section-body">
          <div class="image-grid">
            <div class="image-category">
              <div class="image-category-title before"><i class="fas fa-clock"></i> 作業前</div>
              <div class="image-list" id="${sectionId}-before">
                  ${(photos.before || []).map(url => `
                    <div class="image-thumb" draggable="true" data-section-id="${sectionId}" data-category="before" data-image-url="${url}">
                      <img src="${url}" alt="Before" draggable="false">
                      <button type="button" class="image-thumb-remove" onclick="removeImage('${sectionId}', 'before', '${url}', '', this)">
                      <i class="fas fa-times"></i>
                    </button>
                  </div>
                `).join('')}
                <label class="image-add-btn" style="cursor: pointer;">
                  <input type="file" accept="image/*" multiple class="section-image-file-input" data-section-id="${sectionId}" data-category="before" style="display:none;">
                  <i class="fas fa-plus"></i>
                  <span>追加</span>
                </label>
              </div>
            </div>
            <div class="image-category">
              <div class="image-category-title after"><i class="fas fa-check-circle"></i> 作業後</div>
              <div class="image-list" id="${sectionId}-after">
                  ${(photos.after || []).map(url => `
                    <div class="image-thumb" draggable="true" data-section-id="${sectionId}" data-category="after" data-image-url="${url}">
                      <img src="${url}" alt="After" draggable="false">
                      <button type="button" class="image-thumb-remove" onclick="removeImage('${sectionId}', 'after', '${url}', '', this)">
                      <i class="fas fa-times"></i>
                    </button>
                  </div>
                `).join('')}
                <label class="image-add-btn" style="cursor: pointer;">
                  <input type="file" accept="image/*" multiple class="section-image-file-input" data-section-id="${sectionId}" data-category="after" style="display:none;">
                  <i class="fas fa-plus"></i>
                  <span>追加</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    document.getElementById('report-content').insertAdjacentHTML('beforeend', html);
      const newCard = document.querySelector(`[data-section-id="${sectionId}"]`);
      if (newCard) {
        setupSectionDragAndDrop(newCard);
        const beforeList = document.getElementById(`${sectionId}-before`);
        const afterList = document.getElementById(`${sectionId}-after`);
        if (beforeList) setupImageListDragAndDrop(beforeList, sectionId, 'before');
        if (afterList) setupImageListDragAndDrop(afterList, sectionId, 'after');
        newCard.querySelectorAll('.image-thumb').forEach(thumb => {
          const thumbSectionId = thumb.dataset.sectionId;
          const thumbCategory = thumb.dataset.category;
          const thumbUrl = thumb.dataset.imageUrl;
          if (thumbSectionId && thumbCategory && thumbUrl) {
            setupImageThumbDragAndDrop(thumb, thumbSectionId, thumbCategory, thumbUrl);
          }
        });
      }
    }
  }

  function addCommentSectionWithData(section) {
    sectionCounter++;
    const sectionId = section.section_id || `section-${sectionCounter}`;
    sections[sectionId] = {
      type: 'comment',
      content: section.content || ''
    };
    
    const html = `
      <div class="section-card" data-section-id="${sectionId}">
        <div class="section-header">
          <span class="section-title"><i class="fas fa-comment"></i> コメント</span>
          <button type="button" class="section-delete" onclick="deleteSection('${sectionId}')">
            <i class="fas fa-trash"></i>
          </button>
        </div>
        <div class="section-body">
          <textarea class="section-textarea" placeholder="コメントを入力..." oninput="updateSectionContent('${sectionId}', this.value)">${escapeHtml(section.content || '')}</textarea>
        </div>
      </div>
    `;
    document.getElementById('report-content').insertAdjacentHTML('beforeend', html);
    const newCard = document.querySelector(`[data-section-id="${sectionId}"]`);
    if (newCard) setupSectionDragAndDrop(newCard);
  }

  function addWorkContentSectionWithData(section) {
    sectionCounter++;
    const sectionId = section.section_id || `section-${sectionCounter}`;
    sections[sectionId] = {
      type: 'work_content',
      content: section.content || ''
    };
    
    const html = `
      <div class="section-card" data-section-id="${sectionId}">
        <div class="section-header">
          <span class="section-title"><i class="fas fa-tasks"></i> 作業内容</span>
          <button type="button" class="section-delete" onclick="deleteSection('${sectionId}')">
            <i class="fas fa-trash"></i>
          </button>
        </div>
        <div class="section-body">
          <textarea class="section-textarea" placeholder="作業内容を入力..." oninput="updateSectionContent('${sectionId}', this.value)">${escapeHtml(section.content || '')}</textarea>
        </div>
      </div>
    `;
    document.getElementById('report-content').insertAdjacentHTML('beforeend', html);
  }

  // セクションカードのドラッグ&ドロップ設定
  function setupSectionDragAndDrop(sectionCard) {
    if (!sectionCard || sectionCard.dataset.dragSetup) return;
    sectionCard.dataset.dragSetup = 'true';
    sectionCard.draggable = true;

    const header = sectionCard.querySelector('.section-header');
    if (!header) return;

    // タッチイベント用の変数
    let touchStartY = 0;
    let touchStartTime = 0;
    let isDragging = false;
    let draggedCard = null;
    let longPressTimer = null;
    const LONG_PRESS_DURATION = 300; // 300msで長押し判定

    // テキスト選択を防ぐ
    header.addEventListener('selectstart', (e) => {
      e.preventDefault();
      return false;
    });

    // コンテキストメニューを防ぐ（長押しメニュー）
    header.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      return false;
    });

    // タッチ開始（スマホ用）
    header.addEventListener('touchstart', (e) => {
      e.stopPropagation();
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
      isDragging = false;
      sectionCard.classList.add('touching');

      // 長押しタイマー
      longPressTimer = setTimeout(() => {
        isDragging = true;
        draggedCard = sectionCard;
        sectionCard.classList.add('dragging');
        sectionCard.classList.remove('touching');
        
        // 振動フィードバック（対応デバイスのみ）
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      }, LONG_PRESS_DURATION);
    }, { passive: true });

    // タッチ移動（スマホ用）
    header.addEventListener('touchmove', (e) => {
      if (!isDragging && !draggedCard) {
        const touchY = e.touches[0].clientY;
        const deltaY = Math.abs(touchY - touchStartY);
        
        // 5px以上動いたら長押しをキャンセル
        if (deltaY > 5) {
          clearTimeout(longPressTimer);
          sectionCard.classList.remove('touching');
        }
        return;
      }

      if (!isDragging || !draggedCard) return;

      e.preventDefault();
      e.stopPropagation();

      const touchY = e.touches[0].clientY;
      const targetCard = document.elementFromPoint(e.touches[0].clientX, touchY)?.closest('.section-card');

      if (targetCard && targetCard !== draggedCard) {
        const allCards = document.querySelectorAll('.section-card');
        allCards.forEach(card => {
          if (card !== draggedCard) {
            card.classList.remove('drag-over');
          }
        });
        targetCard.classList.add('drag-over');
      }
    }, { passive: false });

    // タッチ終了（スマホ用）
    header.addEventListener('touchend', (e) => {
      clearTimeout(longPressTimer);
      sectionCard.classList.remove('touching');

      if (!isDragging || !draggedCard) return;

      e.preventDefault();
      e.stopPropagation();

      const touchY = e.changedTouches[0].clientY;
      const targetCard = document.elementFromPoint(e.changedTouches[0].clientX, touchY)?.closest('.section-card');

      if (targetCard && targetCard !== draggedCard) {
        const contentArea = document.getElementById('report-content');
        const allCards = Array.from(contentArea.querySelectorAll('.section-card'));
        const draggedIndex = allCards.indexOf(draggedCard);
        const targetIndex = allCards.indexOf(targetCard);

        if (draggedIndex < targetIndex) {
          contentArea.insertBefore(draggedCard, targetCard.nextSibling);
        } else {
          contentArea.insertBefore(draggedCard, targetCard);
        }
      }

      // クリーンアップ
      const allCards = document.querySelectorAll('.section-card');
      allCards.forEach(card => card.classList.remove('drag-over', 'dragging'));
      isDragging = false;
      draggedCard = null;
    }, { passive: false });

    // タッチキャンセル（スマホ用）
    header.addEventListener('touchcancel', () => {
      clearTimeout(longPressTimer);
      sectionCard.classList.remove('touching', 'dragging');
      isDragging = false;
      draggedCard = null;
      const allCards = document.querySelectorAll('.section-card');
      allCards.forEach(card => card.classList.remove('drag-over'));
    });

    // ドラッグ開始（PC用）
    sectionCard.addEventListener('dragstart', (e) => {
      sectionCard.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', sectionCard.dataset.sectionId);
    });

    // ドラッグ終了（PC用）
    sectionCard.addEventListener('dragend', (e) => {
      sectionCard.classList.remove('dragging');
      const allCards = document.querySelectorAll('.section-card');
      allCards.forEach(card => card.classList.remove('drag-over'));
    });

    // ドラッグオーバー（PC用）
    sectionCard.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      const draggedId = e.dataTransfer.getData('text/plain');
      if (draggedId && draggedId !== sectionCard.dataset.sectionId) {
        sectionCard.classList.add('drag-over');
      }
    });

    // ドラッグリーブ（PC用）
    sectionCard.addEventListener('dragleave', (e) => {
      sectionCard.classList.remove('drag-over');
    });

    // ドロップ（PC用）
    sectionCard.addEventListener('drop', (e) => {
      e.preventDefault();
      sectionCard.classList.remove('drag-over');

      const draggedId = e.dataTransfer.getData('text/plain');
      if (!draggedId || draggedId === sectionCard.dataset.sectionId) return;

      const draggedCard = document.querySelector(`[data-section-id="${draggedId}"]`);
      if (!draggedCard) return;

      const contentArea = document.getElementById('report-content');
      const allCards = Array.from(contentArea.querySelectorAll('.section-card'));
      const draggedIndex = allCards.indexOf(draggedCard);
      const targetIndex = allCards.indexOf(sectionCard);

      if (draggedIndex < targetIndex) {
        contentArea.insertBefore(draggedCard, sectionCard.nextSibling);
      } else {
        contentArea.insertBefore(draggedCard, sectionCard);
      }
    });
  }

  // すべてのセクションカードにドラッグ&ドロップを設定
  function setupAllSectionDragAndDrop() {
    const contentArea = document.getElementById('report-content');
    if (!contentArea) {
      // admin-reports.jsから呼ばれる場合、モーダル用のIDを試す
      const modalContentArea = document.getElementById('report-content-modal');
      if (!modalContentArea) return;
      const allCards = modalContentArea.querySelectorAll('.section-card');
      allCards.forEach(card => setupSectionDragAndDrop(card));
      return;
    }
    const allCards = contentArea.querySelectorAll('.section-card');
    allCards.forEach(card => setupSectionDragAndDrop(card));
  }

  // ヘルパー関数
  function getBrandName(brandId) {
    if (!brandId) return '';
    const brand = brands.find(b => b.id === brandId || String(b.id) === String(brandId));
    return brand ? (brand.name || '') : '';
  }

  // 詳細情報の入力状態をチェック
  function checkDetailsInputStatus() {
    const brandInput = document.getElementById('report-brand');
    const brandNameInput = document.getElementById('report-brand-search');
    const brandNameHidden = document.getElementById('report-brand-name');
    const storeInput = document.getElementById('report-store');
    const storeNameInput = document.getElementById('report-store-search');
    const storeNameHidden = document.getElementById('report-store-name');
    const dateInput = document.getElementById('report-date');
    const startTimeInput = document.getElementById('report-start');
    const endTimeInput = document.getElementById('report-end');
    const detailsHint = document.getElementById('details-hint');
    
    if (!detailsHint) return;
    
    // ブランド名が入力されているか（IDまたは名前のいずれか）
    const hasBrand = (brandInput?.value) || 
                     (brandNameInput?.value?.trim()) || 
                     (brandNameHidden?.value?.trim());
    
    // 店舗名が入力されているか（IDまたは名前のいずれか）
    const hasStore = (storeInput?.value) || 
                     (storeNameInput?.value?.trim()) || 
                     (storeNameHidden?.value?.trim());
    
    // いずれかが未入力の場合、ヒントを表示
    const isIncomplete = !hasBrand || !hasStore || !dateInput?.value || 
                         !startTimeInput?.value || !endTimeInput?.value;
    
    if (isIncomplete) {
      detailsHint.classList.add('visible');
      } else {
      detailsHint.classList.remove('visible');
    }
  }

  // サイドパネルの初期化
  function setupSidePanel() {
    const sidePanel = document.getElementById('side-panel');
    const sidePanelOverlay = document.getElementById('side-panel-overlay');
    const detailsBtn = document.getElementById('details-btn');
    const sidePanelClose = document.getElementById('side-panel-close');
    
    if (!sidePanel || !sidePanelOverlay || !detailsBtn) return;
    
    // 初期状態でヒントをチェック
    checkDetailsInputStatus();
    
    // パネルを開く
    function openSidePanel() {
      sidePanel.classList.add('active');
      sidePanelOverlay.classList.add('active');
      detailsBtn.classList.add('active');
      document.body.style.overflow = 'hidden'; // 背景のスクロールを無効化
    }
    
    // パネルを閉じる
    function closeSidePanel() {
      sidePanel.classList.remove('active');
      sidePanelOverlay.classList.remove('active');
      detailsBtn.classList.remove('active');
      document.body.style.overflow = ''; // 背景のスクロールを有効化
    }
    
    // 詳細ボタンのクリックイベント
    detailsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (sidePanel.classList.contains('active')) {
        closeSidePanel();
      } else {
        openSidePanel();
      }
    });
    
    // 閉じるボタンのクリックイベント
    if (sidePanelClose) {
      sidePanelClose.addEventListener('click', (e) => {
        e.stopPropagation();
        closeSidePanel();
      });
    }
    
    // オーバーレイのクリックイベント
    sidePanelOverlay.addEventListener('click', () => {
      closeSidePanel();
    });
    
    // スワイプジェスチャー（モバイル対応）
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;
    let isSwiping = false;
    
    // タッチ開始
    document.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
      isSwiping = false;
    }, { passive: true });
    
    // タッチ移動
    document.addEventListener('touchmove', (e) => {
      if (!sidePanel.classList.contains('active')) return;
      
      touchEndX = e.changedTouches[0].screenX;
      touchEndY = e.changedTouches[0].screenY;
      
      const deltaX = touchEndX - touchStartX;
      const deltaY = touchEndY - touchStartY;
      
      // 横方向のスワイプが縦方向より大きい場合
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
        isSwiping = true;
        
        // 左方向にスワイプ（パネルを閉じる）
        if (deltaX < -50) {
          closeSidePanel();
        }
      }
    }, { passive: true });
    
    // タッチ終了
    document.addEventListener('touchend', () => {
      isSwiping = false;
    }, { passive: true });
    
    // ESCキーで閉じる
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sidePanel.classList.contains('active')) {
        closeSidePanel();
      }
    });
    
    // パネルを閉じた時にヒントをチェック
    const originalCloseSidePanel = closeSidePanel;
    closeSidePanel = function() {
      originalCloseSidePanel();
      setTimeout(checkDetailsInputStatus, 100);
    };
    
    // 詳細情報の入力フィールドにイベントリスナーを追加
    const brandInput = document.getElementById('report-brand');
    const storeInput = document.getElementById('report-store');
    const dateInput = document.getElementById('report-date');
    const startTimeInput = document.getElementById('report-start');
    const endTimeInput = document.getElementById('report-end');
    
    [brandInput, storeInput, dateInput, startTimeInput, endTimeInput].forEach(input => {
      if (input) {
        input.addEventListener('change', checkDetailsInputStatus);
        input.addEventListener('input', checkDetailsInputStatus);
      }
    });
    
    // ブランド・店舗選択時にもチェック（モーダル経由の選択に対応）
    const brandSearchInput = document.getElementById('report-brand-search');
    const storeSearchInput = document.getElementById('report-store-search');
    if (brandSearchInput) {
      brandSearchInput.addEventListener('input', checkDetailsInputStatus);
    }
    if (storeSearchInput) {
      storeSearchInput.addEventListener('input', checkDetailsInputStatus);
    }
  }

  // イベントリスナー設定
  function setupEventListeners() {
    // ブランド検索
    const brandSearchInput = document.getElementById('report-brand-search');
    
    // ブランド選択モーダルを開く
    window.openBrandModal = function() {
      const modal = document.getElementById('brand-select-modal');
      const modalSearch = document.getElementById('brand-modal-search');
      const modalResults = document.getElementById('brand-modal-results');
      
      if (modal) {
        modal.style.display = 'flex';
        updateBrandModal();
        // モーダル内の検索フィールドにフォーカス
        setTimeout(() => {
          if (modalSearch) modalSearch.focus();
        }, 100);
      }
    };
    
    // ブランド選択モーダルを閉じる
    window.closeBrandModal = function() {
      const modal = document.getElementById('brand-select-modal');
      if (modal) {
        modal.style.display = 'none';
        const modalSearch = document.getElementById('brand-modal-search');
        if (modalSearch) modalSearch.value = '';
      }
    };
    
    // ブランドモーダル内の検索結果を更新
    function updateBrandModal() {
      const modalSearch = document.getElementById('brand-modal-search');
      const modalResults = document.getElementById('brand-modal-results');
      
      if (!modalSearch || !modalResults) return;
      
      const query = modalSearch.value.trim();
      const filtered = query.length === 0 
        ? brands 
        : brands.filter(brand => {
            const name = (brand.name || '').toLowerCase();
            return name.includes(query.toLowerCase());
          });
      
      // 検索結果のHTMLを構築（一番上に「自由入力」オプションを追加）
      let html = '<div class="store-search-item free-input-option" data-free-input="true"><i class="fas fa-edit"></i> 自由入力</div>';
      
      if (filtered.length === 0) {
        html += '<div class="store-search-item no-results">該当するブランドが見つかりません</div>';
      } else {
        html += filtered.map(brand => {
          const name = brand.name;
          const id = brand.id;
          return `<div class="store-search-item" data-id="${id}" data-name="${escapeHtml(name)}">${escapeHtml(name)}</div>`;
        }).join('');
      }
      
      modalResults.innerHTML = html;
      
      // 「自由入力」オプションのクリックイベント
      const freeInputOption = modalResults.querySelector('.free-input-option');
      if (freeInputOption) {
        freeInputOption.addEventListener('click', function() {
          // 入力欄を編集可能にする
          brandSearchInput.removeAttribute('readonly');
          brandSearchInput.focus();
          // ブランドIDをクリア（自由入力のため）
          document.getElementById('report-brand').value = '';
          document.getElementById('report-brand-name').value = '';
          brandSearchInput.value = '';
          closeBrandModal();
          
          // 店舗選択を有効化
          const storeSelect = document.getElementById('report-store-select');
          if (storeSelect) {
            storeSelect.disabled = false;
          }
        });
      }
      
      // 通常のブランド選択のクリックイベント
      modalResults.querySelectorAll('.store-search-item:not(.free-input-option):not(.no-results)').forEach(item => {
        item.addEventListener('click', function() {
          const id = this.dataset.id;
          const name = this.dataset.name;
          
          // ブランドが変更されたかどうかを確認
          const currentBrandId = document.getElementById('report-brand')?.value;
          const brandChanged = currentBrandId !== id;
          
          document.getElementById('report-brand').value = id;
          document.getElementById('report-brand-name').value = name;
          checkDetailsInputStatus();
          brandSearchInput.value = name;
          // ブランド選択時は入力欄をreadonlyにする
          brandSearchInput.setAttribute('readonly', 'readonly');
          closeBrandModal();
          
          // ブランド選択時に店舗リストを更新
          if (typeof window.updateStoreSelect === 'function') {
            window.updateStoreSelect();
          }
          
          // ブランドが変更された場合、店舗名をリセット
          if (brandChanged) {
            document.getElementById('report-store').value = '';
            document.getElementById('report-store-name').value = '';
            const storeSearchInput = document.getElementById('report-store-search');
            if (storeSearchInput) {
              storeSearchInput.value = '';
            }
            const storeSelect = document.getElementById('report-store-select');
            if (storeSelect) {
              storeSelect.value = '';
            }
          }
        });
      });
    }
    
    // モーダル内の検索フィールドのイベント
    const brandModalSearch = document.getElementById('brand-modal-search');
    if (brandModalSearch) {
      brandModalSearch.addEventListener('input', updateBrandModal);
    }
    
    // ブランド名入力欄のイベント設定（モーダル方式ではinitBrandSelectで設定済み）
    if (brandSearchInput) {
      // 初期状態はreadonly
      brandSearchInput.setAttribute('readonly', 'readonly');
      
      // 自由入力モード時の入力処理
      brandSearchInput.addEventListener('input', function() {
        // readonlyが解除されている場合のみ処理（自由入力モード）
        if (!this.hasAttribute('readonly')) {
          const inputValue = this.value.trim();
          // 直接入力された場合は、ブランド名のみを設定（ブランドIDは空）
          document.getElementById('report-brand-name').value = inputValue;
          // ブランドIDをクリア
          document.getElementById('report-brand').value = '';
        }
      });
    }

    // 店舗セレクトボックス（モーダル方式では使用しないが、互換性のため残す）
    const storeSelect = document.getElementById('report-store-select');
    
    // 店舗選択モーダルを開く
    window.openStoreModal = function() {
      const modal = document.getElementById('store-select-modal');
      const modalSearch = document.getElementById('store-modal-search');
      const modalResults = document.getElementById('store-modal-results');
      
      if (modal) {
        modal.style.display = 'flex';
        updateStoreModal();
        // モーダル内の検索フィールドにフォーカス
        setTimeout(() => {
          if (modalSearch) modalSearch.focus();
        }, 100);
      }
    };
    
    // 店舗選択モーダルを閉じる
    window.closeStoreModal = function() {
      const modal = document.getElementById('store-select-modal');
      if (modal) {
        modal.style.display = 'none';
        const modalSearch = document.getElementById('store-modal-search');
        if (modalSearch) modalSearch.value = '';
      }
    };
    
    // 店舗モーダル内の検索結果を更新
    function updateStoreModal() {
      const modalSearch = document.getElementById('store-modal-search');
      const modalResults = document.getElementById('store-modal-results');
      const storeSearchInput = document.getElementById('report-store-search');
      
      if (!modalSearch || !modalResults) return;
      
      const query = modalSearch.value.trim();
      const selectedBrandId = document.getElementById('report-brand')?.value;
      const brandNameInput = document.getElementById('report-brand-search')?.value.trim() || '';
      const brandNameHidden = document.getElementById('report-brand-name')?.value || '';
      const hasBrandName = brandNameInput || brandNameHidden;
      
      let filtered = query.length === 0 
        ? stores 
        : stores.filter(store => {
            const name = (store.store_name || store.name || '').toLowerCase();
            return name.includes(query.toLowerCase());
          });
      
      // ブランドが選択されている場合はフィルタリング
      if (selectedBrandId) {
        filtered = filtered.filter(store => {
          const storeBrandId = store.brand_id || store.brandId;
          return storeBrandId === selectedBrandId || String(storeBrandId) === String(selectedBrandId);
        });
      } else if (!hasBrandName) {
        // ブランドが選択・入力されていない場合は空
        filtered = [];
      }
      
      // 結果のHTMLを構築（一番上に「自由入力」オプションを追加）
      let html = '<div class="store-search-item free-input-option" data-free-input="true"><i class="fas fa-edit"></i> 自由入力</div>';
      
      if (filtered.length === 0) {
        html += '<div class="store-search-item no-results">該当する店舗が見つかりません</div>';
        } else {
      html += filtered.map(store => {
        const name = store.store_name || store.name;
        const id = store.store_id || store.id;
        const brandId = store.brand_id || store.brandId;
        return `<div class="store-search-item" data-id="${id}" data-name="${escapeHtml(name)}" data-brand-id="${brandId || ''}">${escapeHtml(name)}</div>`;
      }).join('');
      }
      
      modalResults.innerHTML = html;
      
      // 「自由入力」オプションのクリックイベント
      const freeInputOption = modalResults.querySelector('.free-input-option');
      if (freeInputOption) {
        freeInputOption.addEventListener('click', function() {
          // 入力欄を編集可能にする
          if (storeSearchInput) {
            storeSearchInput.removeAttribute('readonly');
            storeSearchInput.focus();
          }
          // 店舗IDをクリア（自由入力のため）
          document.getElementById('report-store').value = '';
          document.getElementById('report-store-name').value = '';
          if (storeSearchInput) {
            storeSearchInput.value = '';
          }
          closeStoreModal();
        });
      }
      
      // 通常の店舗選択のクリックイベント
      modalResults.querySelectorAll('.store-search-item:not(.free-input-option):not(.no-results)').forEach(item => {
        item.addEventListener('click', function() {
          const id = this.dataset.id;
          const name = this.dataset.name;
          const brandId = this.dataset.brandId;
          
          document.getElementById('report-store').value = id || '';
          document.getElementById('report-store-name').value = name || '';
          if (storeSearchInput) {
            storeSearchInput.value = name || '';
            storeSearchInput.setAttribute('readonly', 'readonly');
          }
          // セレクトボックスを更新
          const storeSelect = document.getElementById('report-store-select');
          if (storeSelect) {
            storeSelect.value = id || '';
          }
          closeStoreModal();
          
          // 店舗選択時にブランド名も自動設定（未設定の場合は設定しない）
          if (id && brandId && brandSearchInput) {
            const brandName = getBrandName(brandId);
            if (brandName) {
              document.getElementById('report-brand').value = brandId;
              document.getElementById('report-brand-name').value = brandName;
              brandSearchInput.value = brandName;
              brandSearchInput.setAttribute('readonly', 'readonly');
            }
          }
          
          checkDetailsInputStatus();
        });
      });
    }
    
    // モーダル内の検索フィールドのイベント
    const storeModalSearch = document.getElementById('store-modal-search');
    if (storeModalSearch) {
      storeModalSearch.addEventListener('input', updateStoreModal);
    }
    
    // セレクトボックスを使用するため、モーダル関連のイベントリスナーは不要
    
    // モーダルの背景をクリックしたときに閉じる
    document.getElementById('brand-select-modal')?.addEventListener('click', function(e) {
      if (e.target === this) {
        closeBrandModal();
      }
    });
    
    document.getElementById('store-select-modal')?.addEventListener('click', function(e) {
      if (e.target === this) {
        closeStoreModal();
      }
    });
    
    // 初期化時に店舗セレクトボックスを設定（モーダル方式では不要）

    // セクション選択モードボタン
    const sectionSelectModeBtn = document.getElementById('section-select-mode-btn');
    const sectionCopyBtn = document.getElementById('section-copy-btn');
    const sectionBulkDeleteBtn = document.getElementById('section-bulk-delete-btn');
    
    if (sectionSelectModeBtn) {
      sectionSelectModeBtn.addEventListener('click', () => {
        isSectionSelectMode = !isSectionSelectMode;
        selectedSectionIds.clear();
        
        if (isSectionSelectMode) {
          sectionSelectModeBtn.classList.add('active');
          sectionSelectModeBtn.innerHTML = '<i class="fas fa-times"></i><span>選択解除</span>';
          if (sectionCopyBtn) sectionCopyBtn.style.display = 'flex';
          if (sectionBulkDeleteBtn) sectionBulkDeleteBtn.style.display = 'flex';
          // セクションカードにチェックボックスを表示
          updateSectionCardsForSelection();
        } else {
          sectionSelectModeBtn.classList.remove('active');
          sectionSelectModeBtn.innerHTML = '<i class="fas fa-check-square"></i><span>セクション選択</span>';
          if (sectionCopyBtn) sectionCopyBtn.style.display = 'none';
          if (sectionBulkDeleteBtn) sectionBulkDeleteBtn.style.display = 'none';
          // セクションカードからチェックボックスを削除
          updateSectionCardsForSelection();
        }
      });
    }
    
    // セクションコピー
    if (sectionCopyBtn) {
      sectionCopyBtn.addEventListener('click', () => {
        if (selectedSectionIds.size === 0) {
          showWarning('コピーするセクションを選択してください');
          return;
        }
        
        // 選択されたセクションをコピー
        selectedSectionIds.forEach(sectionId => {
          copySection(sectionId);
        });
        
        // 選択モードを解除
        isSectionSelectMode = false;
        selectedSectionIds.clear();
        if (sectionSelectModeBtn) {
          sectionSelectModeBtn.classList.remove('active');
          sectionSelectModeBtn.innerHTML = '<i class="fas fa-check-square"></i><span>セクション選択</span>';
        }
        if (sectionCopyBtn) sectionCopyBtn.style.display = 'none';
        if (sectionBulkDeleteBtn) sectionBulkDeleteBtn.style.display = 'none';
        updateSectionCardsForSelection();
      });
    }
    
    // セクション一括削除
    if (sectionBulkDeleteBtn) {
      sectionBulkDeleteBtn.addEventListener('click', async () => {
        if (selectedSectionIds.size === 0) {
          showWarning('削除するセクションを選択してください');
          return;
        }
        
        const shouldDelete = await showConfirm('セクションの削除', `選択した${selectedSectionIds.size}個のセクションを削除しますか？`);
        if (!shouldDelete) {
          return;
        }
        
        // 選択されたセクションを削除
        selectedSectionIds.forEach(sectionId => {
          deleteSection(sectionId);
        });
        
        // 選択モードを解除
        isSectionSelectMode = false;
        selectedSectionIds.clear();
        if (sectionSelectModeBtn) {
          sectionSelectModeBtn.classList.remove('active');
          sectionSelectModeBtn.innerHTML = '<i class="fas fa-check-square"></i><span>セクション選択</span>';
        }
        if (sectionCopyBtn) sectionCopyBtn.style.display = 'none';
        if (sectionBulkDeleteBtn) sectionBulkDeleteBtn.style.display = 'none';
        updateSectionCardsForSelection();
      });
    }

    // 追加ボタン
    const addCleaningItemBtn = document.getElementById('add-cleaning-item');
    const addImageBtn = document.getElementById('add-image');
    const addCommentBtn = document.getElementById('add-comment');
    const addWorkContentBtn = document.getElementById('add-work-content');
    
    if (addCleaningItemBtn) addCleaningItemBtn.addEventListener('click', addCleaningItemSection);
    if (addImageBtn) addImageBtn.addEventListener('click', openImageSectionTypeModal);
    if (addCommentBtn) addCommentBtn.addEventListener('click', addCommentSection);
    if (addWorkContentBtn) addWorkContentBtn.addEventListener('click', addWorkContentSection);
    
    // プレビューボタンのイベントリスナー
    const previewBtn = document.getElementById('preview-btn');
    const previewBtnProposal = document.getElementById('preview-btn-proposal');
    const previewSaveConfirmBtn = document.getElementById('preview-save-confirm-btn');
    const previewSaveDialogClose = document.getElementById('preview-save-dialog-close');
    const previewSaveDialogCancel = document.getElementById('preview-save-dialog-cancel');
    const previewSaveDialog = document.getElementById('preview-save-dialog');
    
    // ダイアログを閉じる関数
    const closePreviewSaveDialog = () => {
      if (previewSaveDialog) {
        if (previewSaveDialog.open) {
          previewSaveDialog.close();
        }
      }
    };
    
    // 保存確認ダイアログを表示する関数
    const showPreviewSaveDialog = () => {
      console.log('[Preview] showPreviewSaveDialog called');
      console.log('[Preview] previewSaveDialog element:', previewSaveDialog);
      if (previewSaveDialog) {
        try {
          previewSaveDialog.showModal();
          console.log('[Preview] Dialog shown successfully');
        } catch (error) {
          console.error('[Preview] Error showing dialog:', error);
        }
      } else {
        console.warn('[Preview] previewSaveDialog element not found');
      }
    };
    
    // ダイアログの閉じるボタン
    if (previewSaveDialogClose) {
      previewSaveDialogClose.addEventListener('click', closePreviewSaveDialog);
    }
    
    // キャンセルボタン
    if (previewSaveDialogCancel) {
      previewSaveDialogCancel.addEventListener('click', closePreviewSaveDialog);
    }
    
    // ダイアログの背景クリックで閉じる（SP対応）
    if (previewSaveDialog) {
      // 背景クリックで閉じる
      previewSaveDialog.addEventListener('click', (e) => {
        if (e.target === previewSaveDialog) {
          closePreviewSaveDialog();
        }
      });
      
      // ESCキーで閉じる
      previewSaveDialog.addEventListener('cancel', (e) => {
        e.preventDefault();
        closePreviewSaveDialog();
      });
      
      // SP画面でのタッチイベント対応
      previewSaveDialog.addEventListener('touchstart', (e) => {
        if (e.target === previewSaveDialog) {
          e.preventDefault();
          closePreviewSaveDialog();
        }
      }, { passive: false });
    }
    
    if (previewBtn) {
      console.log('[Preview] Preview button found, adding event listener');
      previewBtn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('[Preview] Preview button clicked');
        showPreviewSaveDialog();
      });
    }
    // レポート作成画面以外では存在しないため、警告を出さない
    if (previewBtnProposal) {
      console.log('[Preview] Preview button (proposal) found, adding event listener');
      previewBtnProposal.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('[Preview] Preview button (proposal) clicked');
        showPreviewSaveDialog();
      });
    }
    
    // 保存してプレビューを表示
    if (previewSaveConfirmBtn) {
      console.log('[Preview] Preview save confirm button found, adding event listener');
      previewSaveConfirmBtn.addEventListener('click', async () => {
        console.log('[Preview] Preview save confirm button clicked');
        closePreviewSaveDialog();
        
        // レポートを一時保存してからプレビューを表示
        try {
          await saveReportForPreview();
          console.log('[Preview] Report saved for preview');
          if (window.openPreviewModal) {
            console.log('[Preview] Opening preview modal');
            await window.openPreviewModal();
          } else {
            console.error('[Preview] openPreviewModal function not found');
          }
        } catch (error) {
          console.error('[Preview] Error in preview flow:', error);
          alert('プレビューの表示に失敗しました: ' + error.message);
        }
      });
    }
    // レポート作成画面以外では存在しないため、警告を出さない
    
    // セクション追加ボタンのイベントリスナー（新規作成タブ用）
    setupSectionAddButtons('section-add-toggle-btn', 'new');
    
    // セクション追加ボタンのイベントリスナー（次回ご提案タブ用）
    setupSectionAddButtons('section-add-toggle-btn-proposal', 'proposal');
  }
  
  // セクション追加ボタンのイベントリスナーを設定する共通関数
  function setupSectionAddButtons(toggleBtnId, tabType) {
    const sectionAddToggleBtn = document.getElementById(toggleBtnId);
    
    if (sectionAddToggleBtn) {
      // 既存のイベントリスナーを削除するために、ノードをクローンして置き換え
      const newBtn = sectionAddToggleBtn.cloneNode(true);
      sectionAddToggleBtn.parentNode.replaceChild(newBtn, sectionAddToggleBtn);
      
      newBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // +ボタンを押したら直接清掃項目セクションを追加
        if (window.addCleaningItemSection) {
          window.addCleaningItemSection(tabType);
        } else {
          console.warn('[SectionAdd] addCleaningItemSection function not found');
        }
      });
    }

    // 画像倉庫タブ切り替え
    document.querySelectorAll('.warehouse-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.warehouse-tabs .tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        this.classList.add('active');
        document.getElementById(`tab-${this.dataset.tab}`).classList.add('active');
        
        // 画像ストックタブに切り替えた場合は選択状態を再表示
        if (this.dataset.tab === 'stock') {
          renderStockSelection();
        }
      });
    });

    // 画像倉庫フィルター
    const libraryDate = document.getElementById('library-date');
    const libraryCategory = document.getElementById('library-category');
    if (libraryDate) {
      libraryDate.addEventListener('change', loadWarehouseImages);
      libraryDate.value = new Date().toISOString().split('T')[0];
    }
    if (libraryCategory) {
      libraryCategory.addEventListener('change', loadWarehouseImages);
    }

    // 画像選択確定
    const saveImagesBtn = document.getElementById('save-images-btn');
    if (saveImagesBtn) {
      saveImagesBtn.addEventListener('click', saveSelectedImages);
    }

    // 画像ストックタブの「画像を追加」ボタン
    const warehouseStockFileInput = document.getElementById('warehouse-stock-file-input');
    if (warehouseStockFileInput) {
      warehouseStockFileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        await addImagesToStock(files);
        e.target.value = ''; // リセット
        renderStockSelection(); // 選択グリッドを更新
      });
    }

    // 画像ストック機能
    setupImageStock();
    
    // メニュー外をクリックしたときにメニューを閉じる
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.cleaning-item-add-actions')) {
        document.querySelectorAll('.cleaning-item-add-menu').forEach(menu => {
          menu.style.display = 'none';
        });
      }
    });
    
    // セクション内の画像追加ボタンのファイル選択イベント
    document.addEventListener('change', async (e) => {
      if (e.target.classList.contains('section-image-file-input')) {
        const sectionId = e.target.dataset.sectionId;
        const category = e.target.dataset.category;
        const files = Array.from(e.target.files);
        
        if (files.length === 0) return;
        
        // 画像を画像ストックに追加（AWS画像倉庫にも同時にアップロード）
        await addImagesToStock(files);
        
        // 選択した画像をセクションに追加
        const section = sections[sectionId];
        if (section && section.type === 'image') {
          const imageList = document.getElementById(`${sectionId}-${category}`);
          if (imageList) {
            // 最新の画像ストックから追加された画像を取得
            const latestImages = imageStock.slice(-files.length);
            latestImages.forEach(imageData => {
              // warehouseUrlまたはblobUrlがあれば追加
              if (imageData && (imageData.warehouseUrl || imageData.blobUrl)) {
                addImageToSectionFromStock(imageData, sectionId, category);
              }
            });
          }
        }
        
        e.target.value = ''; // リセット
      }
    }, true);
    
  }

  // 画像ストック機能の設定
  function setupImageStock() {
    const stockFileInput = document.getElementById('stock-file-input');
    const stockGrid = document.getElementById('image-stock-grid');
    const clearStockBtn = document.getElementById('clear-stock-btn');
    const selectModeBtn = document.getElementById('select-mode-btn');
    const bulkDeleteBtn = document.getElementById('bulk-delete-btn');

    // ファイル選択
    if (stockFileInput) {
    stockFileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      await addImagesToStock(files);
      e.target.value = ''; // リセット
    });
    }

    // 選択モード切り替え
    if (selectModeBtn) {
      selectModeBtn.addEventListener('click', () => {
        isMultiSelectMode = !isMultiSelectMode;
        selectedImageIds.clear();
        
        if (isMultiSelectMode) {
          selectModeBtn.classList.add('active');
          selectModeBtn.innerHTML = '<i class="fas fa-times"></i><span>選択解除</span>';
          if (bulkDeleteBtn) bulkDeleteBtn.style.display = 'flex';
        } else {
          selectModeBtn.classList.remove('active');
          selectModeBtn.innerHTML = '<i class="fas fa-check-square"></i><span>選択モード</span>';
          if (bulkDeleteBtn) bulkDeleteBtn.style.display = 'none';
        }
        
        renderImageStock();
      });
    }

    // 一括削除
    if (bulkDeleteBtn) {
      bulkDeleteBtn.addEventListener('click', async () => {
        if (selectedImageIds.size === 0) {
          showWarning('削除する画像を選択してください');
          return;
        }
        
        const shouldDelete = await showConfirm('画像の削除', `選択した${selectedImageIds.size}枚の画像を削除しますか？`);
        if (!shouldDelete) {
          return;
        }
        
        // 選択された画像を削除
        for (const imageId of selectedImageIds) {
          const imageData = imageStock.find(img => img.id === imageId);
          if (imageData && imageData.blobUrl) {
            URL.revokeObjectURL(imageData.blobUrl);
          }
          await deleteImageFromDB(imageId);
          imageStock = imageStock.filter(img => img.id !== imageId);
        }
        
        selectedImageIds.clear();
        isMultiSelectMode = false;
        if (selectModeBtn) {
          selectModeBtn.classList.remove('active');
          selectModeBtn.innerHTML = '<i class="fas fa-check-square"></i><span>選択モード</span>';
        }
        if (bulkDeleteBtn) bulkDeleteBtn.style.display = 'none';
        
        renderImageStock();
      });
    }

    // すべて削除
    if (clearStockBtn) {
    clearStockBtn.addEventListener('click', async () => {
        const shouldClear = await showConfirm('画像ストックのクリア', '画像ストック内のすべての画像を削除しますか？');
        if (shouldClear) {
        // Blob URLを解放
        imageStock.forEach(item => {
          if (item.blobUrl) {
            URL.revokeObjectURL(item.blobUrl);
          }
        });
        
        imageStock = [];
        await clearImageStockDB();
          selectedImageIds.clear();
          isMultiSelectMode = false;
        renderImageStock();
      }
    });
    }

    // 画像ストックグリッドのドロップゾーン設定
    if (stockGrid) {
    setupImageStockDropZone(stockGrid);
    }
  }

  // IndexedDBの初期化
  let stockDB = null;
  async function initImageStockDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(STOCK_DB_NAME, STOCK_DB_VERSION);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        stockDB = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('images')) {
          db.createObjectStore('images', { keyPath: 'id' });
        }
      };
    });
  }

  // IndexedDBから画像ストックを読み込み
  async function loadImageStockFromDB() {
    if (!stockDB) {
      await initImageStockDB();
    }
    
    return new Promise((resolve, reject) => {
      const transaction = stockDB.transaction(['images'], 'readonly');
      const store = transaction.objectStore('images');
      const request = store.getAll();
      
      request.onsuccess = () => {
        imageStock = request.result || [];
        // warehouseUrlがない場合のみBlob URLを再生成（AWSアップロード済みの場合は不要）
        imageStock.forEach(item => {
          if (!item.warehouseUrl) {
            // ローカルのみの画像の場合、Blob URLを再生成
          if (item.data && !item.blobUrl) {
            const blob = new Blob([item.data], { type: item.type || 'image/jpeg' });
            item.blobUrl = URL.createObjectURL(blob);
          } else if (item.blobData && !item.blobUrl) {
            item.blobUrl = URL.createObjectURL(new Blob([item.blobData], { type: item.fileType || 'image/jpeg' }));
            }
          }
        });
        renderImageStock();
        resolve();
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  // IndexedDBに画像を保存
  async function saveImageToDB(imageData) {
    if (!stockDB) return;
    
    // AWSアップロード済みの場合は、blobDataを保存しない（ストレージ節約）
    const dataToSave = { ...imageData };
    if (dataToSave.uploaded && dataToSave.warehouseUrl) {
      // AWSアップロード済みの場合は、blobDataとblobUrlを削除
      delete dataToSave.blobData;
      delete dataToSave.blobUrl;
    }
    
    return new Promise((resolve, reject) => {
      const transaction = stockDB.transaction(['images'], 'readwrite');
      const store = transaction.objectStore('images');
      const request = store.put(dataToSave);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // IndexedDBから画像を削除
  async function deleteImageFromDB(imageId) {
    if (!stockDB) return;
    
    return new Promise((resolve, reject) => {
      const transaction = stockDB.transaction(['images'], 'readwrite');
      const store = transaction.objectStore('images');
      const request = store.delete(imageId);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // IndexedDBの全画像を削除
  async function clearImageStockDB() {
    if (!stockDB) return;
    
    return new Promise((resolve, reject) => {
      const transaction = stockDB.transaction(['images'], 'readwrite');
      const store = transaction.objectStore('images');
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // 画像を最適化・圧縮
  async function optimizeImage(file, maxWidth = 1920, quality = 0.85) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // 最大幅を超える場合はリサイズ
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          // JPEG形式で圧縮
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('画像の圧縮に失敗しました'));
            }
          }, 'image/jpeg', quality);
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // 画像をストックに追加（ローカル保存）- 自動最適化付き
  async function addImagesToStock(files) {
    const totalFiles = files.length;
    let processedCount = 0;
    
    // 進捗表示（10枚以上の場合）
    const stockGrid = document.getElementById('image-stock-grid');
    const originalContent = stockGrid?.innerHTML || '';
    if (stockGrid && totalFiles > 10) {
      stockGrid.innerHTML = `
        <div class="image-stock-loading" style="padding: 20px; text-align: center;">
          <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: #3b82f6;"></i>
          <p style="margin-top: 10px; color: #6b7280;">画像を処理中... ${processedCount}/${totalFiles}</p>
        </div>
      `;
    }
    
    // バッチ処理（5枚ずつ処理）
    const BATCH_SIZE = 5;
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      
      // バッチを並列処理
      const batchPromises = batch.map(async (file) => {
        try {
          // 画像を最適化・圧縮
          const optimizedBlob = await optimizeImage(file);
          
        // 画像IDを生成
        const imageId = `stock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Blob URLを作成（プレビュー用）
          const blobUrl = URL.createObjectURL(optimizedBlob);
        
        // ArrayBufferに変換（IndexedDB保存用）
          const arrayBuffer = await optimizedBlob.arrayBuffer();
        
        // 画像データオブジェクト
        const imageData = {
          id: imageId,
          fileName: file.name,
            fileType: 'image/jpeg', // 最適化後は常にJPEG
            fileSize: optimizedBlob.size,
            originalFileSize: file.size,
          blobData: arrayBuffer,
          blobUrl: blobUrl,
          uploaded: false,
          warehouseUrl: null, // AWS画像倉庫のURL
          createdAt: new Date().toISOString()
        };
        
        // AWS画像倉庫に同時にアップロード
        try {
          const cleaningDate = document.getElementById('report-date')?.value || new Date().toISOString().split('T')[0];
          const base64 = await blobToBase64(optimizedBlob);
          
          const requestBody = {
            image: base64,
            category: 'after', // 画像ストックの画像はデフォルトで'after'カテゴリ
            cleaning_date: cleaningDate
          };
          
          const response = await fetch(`${REPORT_API}/staff/report-images`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${await getFirebaseIdToken()}`
            },
            body: JSON.stringify(requestBody)
          });
          
          if (response.ok) {
            const result = await response.json();
            imageData.warehouseUrl = result.image?.url || result.url || null;
            imageData.uploaded = true;
            console.log('[ImageStock] Image uploaded to warehouse:', imageData.warehouseUrl);
            
            // AWSアップロード成功後、ローカルのblobDataを削除してストレージを節約
            if (imageData.blobData) {
              delete imageData.blobData;
              // Blob URLも解放
              if (imageData.blobUrl) {
                URL.revokeObjectURL(imageData.blobUrl);
                delete imageData.blobUrl; // warehouseUrlを使用するため削除
              }
            }
          } else {
            console.warn('[ImageStock] Failed to upload to warehouse:', response.status);
          }
        } catch (error) {
          console.error('[ImageStock] Error uploading to warehouse:', error);
          // エラーが発生しても画像ストックには追加する
        }
        
        // IndexedDBに保存（AWSアップロード済みの場合はblobDataなしで保存）
        await saveImageToDB(imageData);
        
        // メモリにも追加
        imageStock.push(imageData);
          
          processedCount++;
          
          // 進捗更新（10枚以上の場合）
          if (stockGrid && totalFiles > 10 && processedCount % BATCH_SIZE === 0) {
            const loadingDiv = stockGrid.querySelector('.image-stock-loading');
            if (loadingDiv) {
              loadingDiv.querySelector('p').textContent = `画像を処理中... ${processedCount}/${totalFiles}`;
            }
          }
          
          return imageData;
      } catch (error) {
        console.error('Error adding image to stock:', error);
          processedCount++;
          return null;
        }
      });
      
      // バッチの完了を待つ
      await Promise.all(batchPromises);
      
      // UIを更新（バッチごとに更新してパフォーマンスを向上）
      if (i + BATCH_SIZE < files.length) {
        // 中間更新（軽量版）
        if (stockGrid && totalFiles > 10) {
          // 進捗のみ更新
        } else {
          renderImageStock();
        }
      }
      
      // 次のバッチの前に少し待機（UIの応答性を保つ）
      if (i + BATCH_SIZE < files.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    // 最終的なレンダリング
    renderImageStock();
    
    // 完了メッセージ
    if (totalFiles > 10) {
      console.log(`[ImageStock] Processed ${processedCount} images`);
    }
  }

  // 画像ストックを表示
  function renderImageStock() {
    const stockGrid = document.getElementById('image-stock-grid');
    const clearStockBtn = document.getElementById('clear-stock-btn');
    
    if (!stockGrid) {
      // レポート作成画面以外では存在しないため、警告を出さずに終了
      return;
    }

    if (imageStock.length === 0) {
      stockGrid.innerHTML = `
        <div class="image-stock-empty">
          <i class="fas fa-cloud-upload-alt"></i>
          <p>画像をアップロードしてください</p>
          <small>ドラッグ&ドロップで各セクションに配置できます</small>
        </div>
      `;
      if (clearStockBtn) clearStockBtn.style.display = 'none';
      return;
    }

    if (clearStockBtn) clearStockBtn.style.display = 'flex';
    const selectModeBtn = document.getElementById('select-mode-btn');
    if (selectModeBtn && imageStock.length > 0) {
      selectModeBtn.style.display = 'flex';
    }
    
    stockGrid.innerHTML = imageStock.map((imageData, index) => {
      // warehouseUrlがあればそれを使用、なければblobUrlを使用
      const imageUrl = imageData.warehouseUrl || imageData.blobUrl;
      if (!imageUrl) {
        console.warn('Image data missing both warehouseUrl and blobUrl:', imageData);
        return '';
      }
      const isSelected = selectedImageIds.has(imageData.id);
      const draggable = !isMultiSelectMode;
      return `
        <div class="image-stock-item ${isSelected ? 'selected' : ''}" 
             draggable="${draggable}" 
             data-image-id="${imageData.id}" 
             data-stock-index="${index}"
             ${isMultiSelectMode ? `onclick="toggleImageSelection('${imageData.id}')"` : ''}>
          <img src="${imageUrl}" alt="Stock image" draggable="false">
          ${isMultiSelectMode ? `
            <div class="image-stock-select-check">
              <i class="fas fa-check-circle"></i>
            </div>
          ` : `
          <button type="button" class="image-stock-item-remove" onclick="removeFromStock('${imageData.id}')">
            <i class="fas fa-times"></i>
          </button>
          `}
        </div>
      `;
    }).filter(html => html).join('');

    // 各ストックアイテムにドラッグ&ドロップを設定（選択モードでない場合のみ）
    if (!isMultiSelectMode) {
    stockGrid.querySelectorAll('.image-stock-item').forEach(item => {
      setupStockItemDragAndDrop(item);
    });
    }
  }

  // 画像選択をトグル
  window.toggleImageSelection = function(imageId) {
    if (!isMultiSelectMode) return;
    
    if (selectedImageIds.has(imageId)) {
      selectedImageIds.delete(imageId);
    } else {
      selectedImageIds.add(imageId);
    }
    
    renderImageStock();
    
    // 一括削除ボタンの表示を更新
    const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
    if (bulkDeleteBtn) {
      if (selectedImageIds.size > 0) {
        bulkDeleteBtn.innerHTML = `<i class="fas fa-trash"></i><span>選択を削除 (${selectedImageIds.size})</span>`;
      } else {
        bulkDeleteBtn.innerHTML = '<i class="fas fa-trash"></i><span>選択を削除</span>';
      }
    }
  }

  // モーダル内の画像ストック選択を表示
  function renderStockSelection() {
    const selectionGrid = document.getElementById('stock-selection-grid');
    if (!selectionGrid) return;

    if (imageStock.length === 0) {
      selectionGrid.innerHTML = `
        <div class="image-stock-empty">
          <i class="fas fa-box"></i>
          <p>画像ストックが空です</p>
          <small>画像ストックエリアから画像をアップロードしてください</small>
        </div>
      `;
      return;
    }

    selectionGrid.innerHTML = imageStock.map((imageData) => {
      const isSelected = selectedWarehouseImages[currentImageCategory]?.includes(imageData.blobUrl) || false;
      return `
        <div class="stock-selection-item ${isSelected ? 'selected' : ''}" 
             data-image-id="${imageData.id}" 
             data-blob-url="${imageData.blobUrl}"
             onclick="toggleStockImageSelection('${imageData.id}', '${imageData.blobUrl}')">
          <img src="${imageData.blobUrl}" alt="Stock image">
          <div class="stock-selection-check">
            <i class="fas fa-check-circle"></i>
          </div>
        </div>
      `;
    }).join('');
  }

  // ストック画像の選択をトグル
  window.toggleStockImageSelection = function(imageId, blobUrl) {
    const arr = selectedWarehouseImages[currentImageCategory] || [];
    const idx = arr.indexOf(blobUrl);
    
    if (idx > -1) {
      arr.splice(idx, 1);
    } else {
      arr.push(blobUrl);
    }
    
    // UIを更新
    const item = document.querySelector(`.stock-selection-item[data-image-id="${imageId}"]`);
    if (item) {
      if (arr.includes(blobUrl)) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    }
  };

  // ストックアイテムのドラッグ&ドロップ設定
  function setupStockItemDragAndDrop(item) {
    const imageId = item.dataset.imageId;
    const imageData = imageStock.find(img => img.id === imageId);
    if (!imageData) return;

    // テキスト選択を防ぐ
    item.addEventListener('selectstart', (e) => {
      e.preventDefault();
      return false;
    });

    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      return false;
    });

    // タッチイベント用の変数
    let touchStartTime = 0;
    let isDragging = false;
    let longPressTimer = null;
    const LONG_PRESS_DURATION = 300;

    // タッチ開始（スマホ用）
    item.addEventListener('touchstart', (e) => {
      e.stopPropagation();
      touchStartTime = Date.now();
      isDragging = false;

      longPressTimer = setTimeout(() => {
        isDragging = true;
        item.classList.add('dragging');
        
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      }, LONG_PRESS_DURATION);
    }, { passive: true });

    // タッチ移動（スマホ用）
    item.addEventListener('touchmove', (e) => {
      if (!isDragging) {
        clearTimeout(longPressTimer);
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const touch = e.touches[0];
      const targetList = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.image-list');

      if (targetList) {
        document.querySelectorAll('.image-list').forEach(list => {
          if (list !== targetList) {
            list.classList.remove('drag-over');
          }
        });
        targetList.classList.add('drag-over');
      }
    }, { passive: false });

    // タッチ終了（スマホ用）
    item.addEventListener('touchend', (e) => {
      clearTimeout(longPressTimer);
      item.classList.remove('dragging');

      if (!isDragging) return;

      e.preventDefault();
      e.stopPropagation();

      const touch = e.changedTouches[0];
      const targetList = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.image-list');

      if (targetList && targetList.id) {
        const targetIdParts = targetList.id.split('-');
        const targetSectionId = targetIdParts.slice(0, -1).join('-');
        const targetCategory = targetIdParts[targetIdParts.length - 1];

        if (targetSectionId && targetCategory && imageData) {
          addImageToSectionFromStock(imageData, targetSectionId, targetCategory);
        }
      }

      document.querySelectorAll('.image-list').forEach(list => list.classList.remove('drag-over'));
      isDragging = false;
    }, { passive: false });

    item.addEventListener('touchcancel', () => {
      clearTimeout(longPressTimer);
      item.classList.remove('dragging');
      isDragging = false;
      document.querySelectorAll('.image-list').forEach(list => list.classList.remove('drag-over'));
    });

    // ドラッグ開始（PC用）
    item.addEventListener('dragstart', (e) => {
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('application/json', JSON.stringify({
        source: 'stock',
        imageId: imageId
      }));
    });

    // ドラッグ終了（PC用）
    item.addEventListener('dragend', (e) => {
      item.classList.remove('dragging');
      document.querySelectorAll('.image-list').forEach(list => list.classList.remove('drag-over'));
    });
  }

  // 画像ストックのドロップゾーン設定（画像リストからストックに戻す場合）
  function setupImageStockDropZone(stockGrid) {
    stockGrid.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
    });

    stockGrid.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      // ストックへのドロップは実装しない（削除ボタンで対応）
    });
  }

  // ストックからセクションに画像を追加
  function addImageToSectionFromStock(imageData, sectionId, category) {
    // セクションが存在しない場合は作成
    if (!sections[sectionId]) {
      // カテゴリに応じて適切なセクションタイプを決定
      if (category === 'completed') {
        sections[sectionId] = {
          type: 'image',
          image_type: 'completed',
          photos: { completed: [] }
        };
      } else {
        sections[sectionId] = {
          type: 'image',
          image_type: 'before_after',
          photos: { before: [], after: [] }
        };
      }
    }

    if (!sections[sectionId].photos) {
      if (category === 'completed') {
        sections[sectionId].photos = { completed: [] };
      } else {
        sections[sectionId].photos = { before: [], after: [] };
      }
    }

    if (!sections[sectionId].photos[category]) {
      sections[sectionId].photos[category] = [];
    }

    // 既に存在する場合は追加しない（画像IDで判定）
    const exists = sections[sectionId].photos[category].some(
      img => (typeof img === 'object' && img.imageId === imageData.id) || 
             (typeof img === 'string' && img === imageData.id)
    );
    if (exists) {
      return;
    }

    // warehouseUrlがあればそれを使用、なければblobUrlを使用
    const imageUrl = imageData.warehouseUrl || imageData.blobUrl;

    // データに追加（画像データオブジェクトとして保存）
    sections[sectionId].photos[category].push({
      imageId: imageData.id,
      blobUrl: imageUrl, // warehouseUrlまたはblobUrl
      warehouseUrl: imageData.warehouseUrl || null,
      fileName: imageData.fileName,
      uploaded: imageData.uploaded || false
    });

    // UIに追加
    const container = document.getElementById(`${sectionId}-${category}`);
    if (!container) {
      // セクションが存在しない場合は作成（カテゴリに応じて適切なタイプを選択）
      if (category === 'completed') {
        addImageSectionCompleted();
      } else {
        addImageSectionBeforeAfter();
      }
      const newCard = document.querySelector(`[data-section-id="${sectionId}"]`);
      if (newCard) {
        const newContainer = document.getElementById(`${sectionId}-${category}`);
        if (newContainer) {
          // デフォルト画像（placeholder）を削除
          const placeholder = newContainer.querySelector('.image-placeholder');
          if (placeholder) {
            placeholder.remove();
          }
          const addBtn = newContainer.querySelector('.image-add-btn');
          const newThumb = createImageThumb(sectionId, category, imageUrl, imageData.id);
          newContainer.insertBefore(newThumb, addBtn);
          setupImageListDragAndDrop(newContainer, sectionId, category);
        }
      }
      return;
    }

    // デフォルト画像（placeholder）を削除
    const placeholder = container.querySelector('.image-placeholder');
    if (placeholder) {
      placeholder.remove();
    }
    
    const addBtn = container.querySelector('.image-add-btn');
    const newThumb = createImageThumb(sectionId, category, imageUrl, imageData.id);
    container.insertBefore(newThumb, addBtn);
    setupImageListDragAndDrop(container, sectionId, category);
  }

  // ストックから削除
  window.removeFromStock = async function(imageId) {
    const index = imageStock.findIndex(img => img.id === imageId);
    if (index > -1) {
      const imageData = imageStock[index];
      // Blob URLを解放
      if (imageData.blobUrl) {
        URL.revokeObjectURL(imageData.blobUrl);
      }
      // IndexedDBから削除
      await deleteImageFromDB(imageId);
      // メモリから削除
      imageStock.splice(index, 1);
      renderImageStock();
    }
  };

  // 清掃項目セクション追加
  window.addCleaningItemSection = function() {
    // 現在アクティブなタブを確認
    const activeTab = document.querySelector('.tab-btn.active');
    const isProposalTab = activeTab && activeTab.dataset.tab === 'proposal';
    const reportContentId = isProposalTab ? 'report-content-proposal' : 'report-content';
    
    sectionCounter++;
    const sectionId = `section-${sectionCounter}`;
    sections[sectionId] = { type: 'cleaning', item_name: '', textFields: [], subtitles: [], comments: [] };

    const options = serviceItems.map(item => 
      `<option value="${escapeHtml(item.title)}">${escapeHtml(item.title)}</option>`
    ).join('');

    const html = `
      <div class="section-card" data-section-id="${sectionId}">
        <div class="section-header">
          <input type="checkbox" class="section-select-checkbox" data-section-id="${sectionId}" onchange="toggleSectionSelection('${sectionId}')">
          <span class="section-title"><i class="fas fa-list"></i> 清掃項目</span>
          <div class="section-header-actions">
            <button type="button" class="section-copy" onclick="copySection('${sectionId}')" title="コピー">
              <i class="fas fa-copy"></i>
            </button>
            <button type="button" class="section-delete" onclick="deleteSection('${sectionId}')" title="削除">
            <i class="fas fa-trash"></i>
          </button>
          </div>
        </div>
        <div class="section-body">
          <select class="cleaning-item-select" onchange="updateCleaningItem('${sectionId}', this.value)">
            <option value="">項目を選択</option>
            ${options}
            <option value="__other__">その他（自由入力）</option>
          </select>
          <input type="text" class="form-input cleaning-item-custom" placeholder="清掃項目名を入力" style="display:none; margin-top:8px;" oninput="updateCleaningItemCustom('${sectionId}', this.value)">
          <div class="cleaning-item-insert-actions" style="margin-top:16px; display:flex; justify-content:center; gap:12px;">
            <button type="button" class="cleaning-item-insert-btn" onclick="addImageToCleaningItem('${sectionId}')" title="画像挿入">
              <i class="fas fa-image"></i>
              <span>画像挿入</span>
            </button>
            <button type="button" class="cleaning-item-insert-btn" onclick="addCommentToCleaningItem('${sectionId}')" title="コメント挿入">
              <i class="fas fa-comment"></i>
              <span>コメント挿入</span>
            </button>
            <button type="button" class="cleaning-item-insert-btn" onclick="addSubtitleToCleaningItem('${sectionId}')" title="サブタイトル挿入">
              <i class="fas fa-heading"></i>
              <span>サブタイトル挿入</span>
            </button>
          </div>
        </div>
      </div>
    `;

    const reportContent = document.getElementById(reportContentId);
    const sectionAddIconsAreaId = isProposalTab ? 'section-add-icons-area-proposal' : 'section-add-icons-area';
    const sectionAddIconsArea = document.getElementById(sectionAddIconsAreaId);
    
    if (!reportContent) {
      console.error(`[addCleaningItemSection] reportContent not found: ${reportContentId}`);
      return;
    }
    
    // セクション追加アイコンエリアの前に挿入
    if (sectionAddIconsArea && sectionAddIconsArea.parentNode === reportContent) {
      sectionAddIconsArea.insertAdjacentHTML('beforebegin', html);
    } else {
      reportContent.insertAdjacentHTML('beforeend', html);
    }
    
    const newCard = document.querySelector(`[data-section-id="${sectionId}"]`);
    if (newCard) {
      setupSectionDragAndDrop(newCard);
      // セクションが追加されたら選択モードボタンを表示
      const sectionSelectModeBtn = document.getElementById('section-select-mode-btn');
      if (sectionSelectModeBtn && Object.keys(sections).length > 0) {
        sectionSelectModeBtn.style.display = 'flex';
      }
      // 選択モードの場合はチェックボックスを表示
      if (isSectionSelectMode) {
        updateSectionCardsForSelection();
      }
      // セクション追加アイコンエリアは常に最後に配置されるため、個別に追加する必要はない
    }
    
    // セクション追加アイコンエリアを常に最後に配置
    if (sectionAddIconsArea && reportContent) {
      reportContent.appendChild(sectionAddIconsArea);
    }
    
    updateCleaningItemsList();
  };

  // 画像セクションタイプ選択モーダルを開く
  window.openImageSectionTypeModal = function() {
    const modal = document.getElementById('image-section-type-modal');
    if (modal) {
      modal.style.display = 'flex';
    }
  };

  // 画像セクションタイプ選択モーダルを閉じる
  window.closeImageSectionTypeModal = function() {
    const modal = document.getElementById('image-section-type-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  };

  // 作業前・作業後セクション追加
  window.addImageSectionBeforeAfter = function() {
    closeImageSectionTypeModal();
    sectionCounter++;
    const sectionId = `section-${sectionCounter}`;
    sections[sectionId] = { type: 'image', image_type: 'before_after', photos: { before: [], after: [] } };

    const html = `
      <div class="section-card" data-section-id="${sectionId}">
        <div class="section-header">
          <input type="checkbox" class="section-select-checkbox" data-section-id="${sectionId}" onchange="toggleSectionSelection('${sectionId}')">
          <span class="section-title"><i class="fas fa-image"></i> 画像（作業前・作業後）</span>
          <div class="section-header-actions">
            <button type="button" class="section-copy" onclick="copySection('${sectionId}')" title="コピー">
              <i class="fas fa-copy"></i>
            </button>
            <button type="button" class="section-delete" onclick="deleteSection('${sectionId}')" title="削除">
            <i class="fas fa-trash"></i>
          </button>
          </div>
        </div>
        <div class="section-body">
          <div class="image-grid">
            <div class="image-category">
              <div class="image-category-title before"><i class="fas fa-clock"></i> 作業前</div>
              <div class="image-list" id="${sectionId}-before">
                <div class="image-placeholder">
                  <img src="${DEFAULT_NO_PHOTO_IMAGE}" alt="写真を撮り忘れました" class="default-no-photo-image">
                </div>
                <label class="image-add-btn" style="cursor: pointer;">
                  <input type="file" accept="image/*" multiple class="section-image-file-input" data-section-id="${sectionId}" data-category="before" style="display:none;">
                  <i class="fas fa-plus"></i>
                  <span>追加</span>
                </label>
              </div>
            </div>
            <div class="image-category">
              <div class="image-category-title after"><i class="fas fa-check-circle"></i> 作業後</div>
              <div class="image-list" id="${sectionId}-after">
                <div class="image-placeholder">
                  <img src="${DEFAULT_NO_PHOTO_IMAGE}" alt="写真を撮り忘れました" class="default-no-photo-image">
                </div>
                <label class="image-add-btn" style="cursor: pointer;">
                  <input type="file" accept="image/*" multiple class="section-image-file-input" data-section-id="${sectionId}" data-category="after" style="display:none;">
                  <i class="fas fa-plus"></i>
                  <span>追加</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const reportContent = document.getElementById('report-content');
    const sectionAddIconsArea = document.getElementById('section-add-icons-area');
    
    // セクション追加アイコンエリアの前に挿入
    if (sectionAddIconsArea && sectionAddIconsArea.parentNode === reportContent) {
      sectionAddIconsArea.insertAdjacentHTML('beforebegin', html);
    } else {
      reportContent.insertAdjacentHTML('beforeend', html);
    }
    
    const newCard = document.querySelector(`[data-section-id="${sectionId}"]`);
    if (newCard) {
      setupSectionDragAndDrop(newCard);
      // 画像リストにドラッグ&ドロップを設定
      const beforeList = document.getElementById(`${sectionId}-before`);
      const afterList = document.getElementById(`${sectionId}-after`);
      if (beforeList) setupImageListDragAndDrop(beforeList, sectionId, 'before');
      if (afterList) setupImageListDragAndDrop(afterList, sectionId, 'after');
      // セクションが追加されたら選択モードボタンを表示
      const sectionSelectModeBtn = document.getElementById('section-select-mode-btn');
      if (sectionSelectModeBtn && Object.keys(sections).length > 0) {
        sectionSelectModeBtn.style.display = 'flex';
      }
      // 選択モードの場合はチェックボックスを表示
      if (isSectionSelectMode) {
        updateSectionCardsForSelection();
      }
      // セクション追加アイコンエリアは常に最後に配置されるため、個別に追加する必要はない
    }
    
    // セクション追加アイコンエリアを常に最後に配置
    if (sectionAddIconsArea && reportContent) {
      reportContent.appendChild(sectionAddIconsArea);
    }
  };

  // 施工後セクション追加
  window.addImageSectionCompleted = function() {
    closeImageSectionTypeModal();
    sectionCounter++;
    const sectionId = `section-${sectionCounter}`;
    sections[sectionId] = { type: 'image', image_type: 'completed', photos: { completed: [] } };

    const html = `
      <div class="section-card" data-section-id="${sectionId}">
        <div class="section-header">
          <input type="checkbox" class="section-select-checkbox" data-section-id="${sectionId}" onchange="toggleSectionSelection('${sectionId}')">
          <span class="section-title"><i class="fas fa-image"></i> 画像（施工後）</span>
          <div class="section-header-actions">
            <button type="button" class="section-copy" onclick="copySection('${sectionId}')" title="コピー">
              <i class="fas fa-copy"></i>
            </button>
            <button type="button" class="section-delete" onclick="deleteSection('${sectionId}')" title="削除">
            <i class="fas fa-trash"></i>
          </button>
          </div>
        </div>
        <div class="section-body">
          <div class="image-grid image-grid-completed">
            <div class="image-category image-category-completed">
              <div class="image-category-title completed"><i class="fas fa-star"></i> 施工後</div>
              <div class="image-list image-list-completed" id="${sectionId}-completed">
                <div class="image-placeholder">
                  <img src="${DEFAULT_NO_PHOTO_IMAGE}" alt="写真を撮り忘れました" class="default-no-photo-image">
                </div>
                  <label class="image-add-btn" style="cursor: pointer;">
                    <input type="file" accept="image/*" multiple class="section-image-file-input" data-section-id="${sectionId}" data-category="completed" style="display:none;">
                  <i class="fas fa-plus"></i>
                  <span>追加</span>
                  </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const reportContent = document.getElementById('report-content');
    const sectionAddIconsArea = document.getElementById('section-add-icons-area');
    
    // セクション追加アイコンエリアの前に挿入
    if (sectionAddIconsArea && sectionAddIconsArea.parentNode === reportContent) {
      sectionAddIconsArea.insertAdjacentHTML('beforebegin', html);
    } else {
      reportContent.insertAdjacentHTML('beforeend', html);
    }
    
    const newCard = document.querySelector(`[data-section-id="${sectionId}"]`);
    if (newCard) {
      setupSectionDragAndDrop(newCard);
      // 画像リストにドラッグ&ドロップを設定
      const completedList = document.getElementById(`${sectionId}-completed`);
      if (completedList) setupImageListDragAndDrop(completedList, sectionId, 'completed');
      // セクションが追加されたら選択モードボタンを表示
      const sectionSelectModeBtn = document.getElementById('section-select-mode-btn');
      if (sectionSelectModeBtn && Object.keys(sections).length > 0) {
        sectionSelectModeBtn.style.display = 'flex';
      }
      // 選択モードの場合はチェックボックスを表示
      if (isSectionSelectMode) {
        updateSectionCardsForSelection();
      }
      // セクション追加アイコンエリアは常に最後に配置されるため、個別に追加する必要はない
    }
    
    // セクション追加アイコンエリアを常に最後に配置
    if (sectionAddIconsArea && reportContent) {
      reportContent.appendChild(sectionAddIconsArea);
    }
  };

  // コメントセクション追加
  function addCommentSection() {
    sectionCounter++;
    const sectionId = `section-${sectionCounter}`;
    sections[sectionId] = { type: 'comment', content: '' };

    const html = `
      <div class="section-card" data-section-id="${sectionId}">
        <div class="section-header">
          <input type="checkbox" class="section-select-checkbox" data-section-id="${sectionId}" onchange="toggleSectionSelection('${sectionId}')">
          <span class="section-title"><i class="fas fa-comment"></i> コメント</span>
          <div class="section-header-actions">
            <button type="button" class="section-copy" onclick="copySection('${sectionId}')" title="コピー">
              <i class="fas fa-copy"></i>
            </button>
            <button type="button" class="section-delete" onclick="deleteSection('${sectionId}')" title="削除">
            <i class="fas fa-trash"></i>
          </button>
          </div>
        </div>
        <div class="section-body">
          <textarea class="section-textarea" placeholder="コメントを入力..." oninput="updateSectionContent('${sectionId}', this.value)"></textarea>
        </div>
      </div>
    `;

    const reportContent = document.getElementById('report-content');
    const sectionAddIconsArea = document.getElementById('section-add-icons-area');
    
    // セクション追加アイコンエリアの前に挿入
    if (sectionAddIconsArea && sectionAddIconsArea.parentNode === reportContent) {
      sectionAddIconsArea.insertAdjacentHTML('beforebegin', html);
    } else {
      reportContent.insertAdjacentHTML('beforeend', html);
    }
    
    const newCard = document.querySelector(`[data-section-id="${sectionId}"]`);
    if (newCard) {
      setupSectionDragAndDrop(newCard);
      // セクションが追加されたら選択モードボタンを表示
      const sectionSelectModeBtn = document.getElementById('section-select-mode-btn');
      if (sectionSelectModeBtn && Object.keys(sections).length > 0) {
        sectionSelectModeBtn.style.display = 'flex';
      }
      // 選択モードの場合はチェックボックスを表示
      if (isSectionSelectMode) {
        updateSectionCardsForSelection();
      }
      // セクション追加アイコンエリアは常に最後に配置されるため、個別に追加する必要はない
    }
    
    // セクション追加アイコンエリアを常に最後に配置
    if (sectionAddIconsArea && reportContent) {
      reportContent.appendChild(sectionAddIconsArea);
    }
  };

  // 作業内容セクション追加
  function addWorkContentSection() {
    sectionCounter++;
    const sectionId = `section-${sectionCounter}`;
    sections[sectionId] = { type: 'work_content', content: '' };

    const html = `
      <div class="section-card" data-section-id="${sectionId}">
        <div class="section-header">
          <input type="checkbox" class="section-select-checkbox" data-section-id="${sectionId}" onchange="toggleSectionSelection('${sectionId}')">
          <span class="section-title"><i class="fas fa-tasks"></i> 作業内容</span>
          <div class="section-header-actions">
            <button type="button" class="section-copy" onclick="copySection('${sectionId}')" title="コピー">
              <i class="fas fa-copy"></i>
            </button>
            <button type="button" class="section-delete" onclick="deleteSection('${sectionId}')" title="削除">
            <i class="fas fa-trash"></i>
          </button>
          </div>
        </div>
        <div class="section-body">
          <textarea class="section-textarea" placeholder="作業内容を入力..." oninput="updateSectionContent('${sectionId}', this.value)"></textarea>
        </div>
      </div>
    `;

    const reportContent = document.getElementById('report-content');
    const sectionAddIconsArea = document.getElementById('section-add-icons-area');
    
    // セクション追加アイコンエリアの前に挿入
    if (sectionAddIconsArea && sectionAddIconsArea.parentNode === reportContent) {
      sectionAddIconsArea.insertAdjacentHTML('beforebegin', html);
    } else {
      reportContent.insertAdjacentHTML('beforeend', html);
    }
    
    const newCard = document.querySelector(`[data-section-id="${sectionId}"]`);
    if (newCard) {
      setupSectionDragAndDrop(newCard);
      // セクション追加アイコンエリアは常に最後に配置されるため、個別に追加する必要はない
    }
    
    // セクション追加アイコンエリアを常に最後に配置
    if (sectionAddIconsArea && reportContent) {
      reportContent.appendChild(sectionAddIconsArea);
    }
  }

  // セクション削除
  window.deleteSection = function(sectionId) {
    delete sections[sectionId];
    const sectionElement = document.querySelector(`[data-section-id="${sectionId}"]`);
    if (sectionElement) {
      // セクションの下のプラスアイコンも削除
      const addAfterElement = sectionElement.nextElementSibling;
      if (addAfterElement && addAfterElement.classList.contains('section-add-after')) {
        addAfterElement.remove();
      }
      sectionElement.remove();
    }
    // 選択状態からも削除
    selectedSectionIds.delete(sectionId);
    updateCleaningItemsList();
    
    // セクションがなくなったら選択モードボタンを非表示
    const sectionSelectModeBtn = document.getElementById('section-select-mode-btn');
    if (sectionSelectModeBtn && Object.keys(sections).length === 0) {
      sectionSelectModeBtn.style.display = 'none';
      isSectionSelectMode = false;
      selectedSectionIds.clear();
      const sectionCopyBtn = document.getElementById('section-copy-btn');
      const sectionBulkDeleteBtn = document.getElementById('section-bulk-delete-btn');
      if (sectionCopyBtn) sectionCopyBtn.style.display = 'none';
      if (sectionBulkDeleteBtn) sectionBulkDeleteBtn.style.display = 'none';
    }
  };

  // セクション選択のトグル（常に動作する）
  window.toggleSectionSelection = function(sectionId) {
    const checkbox = document.querySelector(`.section-select-checkbox[data-section-id="${sectionId}"]`);
    if (!checkbox) return;
    
    if (checkbox.checked) {
      selectedSectionIds.add(sectionId);
    } else {
      selectedSectionIds.delete(sectionId);
    }
    
    // セクションカードの選択状態を更新
    const sectionCard = document.querySelector(`[data-section-id="${sectionId}"]`);
    if (sectionCard) {
      if (checkbox.checked) {
        sectionCard.classList.add('section-selected');
      } else {
        sectionCard.classList.remove('section-selected');
      }
    }
    
    // ボタンの表示を更新
    const sectionCopyBtn = document.getElementById('section-copy-btn');
    const sectionBulkDeleteBtn = document.getElementById('section-bulk-delete-btn');
    if (sectionCopyBtn) {
      if (selectedSectionIds.size > 0) {
        sectionCopyBtn.innerHTML = `<i class="fas fa-copy"></i><span>コピー (${selectedSectionIds.size})</span>`;
      } else {
        sectionCopyBtn.innerHTML = '<i class="fas fa-copy"></i><span>コピー</span>';
      }
    }
    if (sectionBulkDeleteBtn) {
      if (selectedSectionIds.size > 0) {
        sectionBulkDeleteBtn.innerHTML = `<i class="fas fa-trash"></i><span>削除 (${selectedSectionIds.size})</span>`;
      } else {
        sectionBulkDeleteBtn.innerHTML = '<i class="fas fa-trash"></i><span>削除</span>';
      }
    }
  };

  // セクションをコピー
  window.copySection = function(sectionId) {
    const originalSection = sections[sectionId];
    if (!originalSection) return;
    
    sectionCounter++;
    const newSectionId = `section-${sectionCounter}`;
    
    // セクションデータをディープコピー
    const newSection = JSON.parse(JSON.stringify(originalSection));
    sections[newSectionId] = newSection;
    
    // セクションタイプに応じてHTMLを生成
    const reportContent = document.getElementById('report-content');
    if (!reportContent) return;
    
    let html = '';
    if (newSection.type === 'cleaning') {
      const options = serviceItems.map(item => 
        `<option value="${escapeHtml(item.title)}" ${(item.title === newSection.item_name) ? 'selected' : ''}>${escapeHtml(item.title)}</option>`
      ).join('');
      
      html = `
        <div class="section-card" data-section-id="${newSectionId}">
          <div class="section-header">
            <input type="checkbox" class="section-select-checkbox" data-section-id="${newSectionId}" onchange="toggleSectionSelection('${newSectionId}')">
            <span class="section-title"><i class="fas fa-list"></i> 清掃項目</span>
            <div class="section-header-actions">
              <button type="button" class="section-copy" onclick="copySection('${newSectionId}')" title="コピー">
                <i class="fas fa-copy"></i>
              </button>
              <button type="button" class="section-delete" onclick="deleteSection('${newSectionId}')" title="削除">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
          <div class="section-body">
            <select class="cleaning-item-select" onchange="updateCleaningItem('${newSectionId}', this.value)">
              <option value="">項目を選択</option>
              ${options}
              <option value="__other__">その他（自由入力）</option>
            </select>
            <input type="text" class="form-input cleaning-item-custom" placeholder="清掃項目名を入力" style="display:${newSection.item_name && !serviceItems.find(si => si.title === newSection.item_name) ? 'block' : 'none'}; margin-top:8px;" oninput="updateCleaningItemCustom('${newSectionId}', this.value)" value="${escapeHtml(newSection.item_name || '')}">
            ${(newSection.textFields || []).map(textField => `
              <div class="cleaning-item-text-field-container" style="position:relative; margin-top:8px;">
                <textarea class="form-input cleaning-item-text-field" placeholder="テキストを入力してください" style="margin-top:8px; min-height:80px; resize:vertical; width:100%;" oninput="updateCleaningItemTextField('${newSectionId}', '${textField.id}', this.value)">${escapeHtml(textField.value || '')}</textarea>
                <button type="button" class="cleaning-item-text-field-delete" onclick="deleteCleaningItemTextField('${newSectionId}', '${textField.id}')" style="position:absolute; top:8px; right:8px; width:24px; height:24px; background:rgba(255, 103, 156, 0.9); color:#fff; border:none; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.7rem; z-index:10;">
                  <i class="fas fa-times"></i>
                </button>
              </div>
            `).join('')}
            ${(newSection.subtitles || []).map(subtitle => `
              <div class="cleaning-item-subtitle-container" style="position:relative; margin-top:8px;">
                <input type="text" class="form-input cleaning-item-subtitle" placeholder="サブタイトルを入力" style="width:100%; font-weight:600; font-size:1rem;" oninput="updateCleaningItemSubtitle('${newSectionId}', '${subtitle.id}', this.value)" value="${escapeHtml(subtitle.value || '')}">
                <button type="button" class="cleaning-item-subtitle-delete" onclick="deleteCleaningItemSubtitle('${newSectionId}', '${subtitle.id}')" style="position:absolute; top:8px; right:8px; width:24px; height:24px; background:rgba(255, 103, 156, 0.9); color:#fff; border:none; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.7rem; z-index:10;">
                  <i class="fas fa-times"></i>
                </button>
              </div>
            `).join('')}
            ${(newSection.comments || []).map(comment => `
              <div class="cleaning-item-comment-container" style="position:relative; margin-top:8px;">
                <textarea class="form-input cleaning-item-comment" placeholder="コメントを入力してください" style="margin-top:8px; min-height:80px; resize:vertical; width:100%;" oninput="updateCleaningItemComment('${newSectionId}', '${comment.id}', this.value)">${escapeHtml(comment.value || '')}</textarea>
                <button type="button" class="cleaning-item-comment-delete" onclick="deleteCleaningItemComment('${newSectionId}', '${comment.id}')" style="position:absolute; top:8px; right:8px; width:24px; height:24px; background:rgba(255, 103, 156, 0.9); color:#fff; border:none; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.7rem; z-index:10;">
                  <i class="fas fa-times"></i>
                </button>
              </div>
            `).join('')}
            ${(newSection.imageContents || []).map(imageContent => {
              const imageType = imageContent.imageType || 'before_after';
              if (imageType === 'before_after') {
                return `
                  <div class="cleaning-item-image-content" data-image-content-id="${imageContent.id}" style="margin-top:16px; position:relative;">
                    <div class="cleaning-item-image-content-header" style="display:flex; justify-content:flex-end; align-items:center; margin-bottom:8px;">
                      <button type="button" class="cleaning-item-image-content-delete" onclick="deleteCleaningItemImageContent('${newSectionId}', '${imageContent.id}')" style="width:24px; height:24px; background:rgba(255, 103, 156, 0.9); color:#fff; border:none; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.7rem;">
                        <i class="fas fa-times"></i>
                      </button>
                    </div>
                    <div class="cleaning-item-image-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                      <div class="image-category">
                        <div class="image-category-title before" style="font-size:0.875rem; font-weight:600; color:#374151; margin-bottom:8px;">
                          <i class="fas fa-clock"></i> 作業前
                        </div>
                        <div class="image-list" id="${imageContent.id}-before" style="min-height:120px; border:2px dashed #e5e7eb; border-radius:8px; padding:8px; display:flex; flex-wrap:wrap; gap:8px; align-items:flex-start;">
                          ${(imageContent.photos?.before || []).map(photo => `
                            <div class="image-thumb" draggable="true" data-image-url="${photo.blobUrl || photo}" data-image-id="${photo.imageId || photo}" data-category="before" style="width:120px; height:120px; position:relative; border-radius:4px; overflow:hidden; margin:0 auto;">
                              <img src="${photo.blobUrl || photo}" alt="Photo" draggable="false" style="width:100%; height:100%; object-fit:cover;">
                              <button type="button" class="image-thumb-remove" onclick="removeCleaningItemImage('${newSectionId}', '${imageContent.id}', 'before', '${photo.imageId || photo}', this.parentElement)" style="position:absolute; top:4px; right:4px; width:18px; height:18px; background:rgba(255, 103, 156, 0.9); color:#fff; border:none; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.6rem; z-index:10;">
                                <i class="fas fa-times"></i>
                              </button>
                            </div>
                          `).join('')}
                          <label class="image-add-btn" style="cursor:pointer; width:80px; height:80px; border:2px dashed #d1d5db; border-radius:8px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; color:#6b7280; font-size:0.75rem;">
                            <input type="file" accept="image/*" multiple class="cleaning-item-image-file-input" data-section-id="${newSectionId}" data-image-content-id="${imageContent.id}" data-category="before" style="display:none;">
                            <i class="fas fa-plus"></i>
                            <span>追加</span>
                          </label>
                        </div>
                      </div>
                      <div class="image-category">
                        <div class="image-category-title after" style="font-size:0.875rem; font-weight:600; color:#374151; margin-bottom:8px;">
                          <i class="fas fa-check-circle"></i> 作業後
                        </div>
                          <div class="image-list" id="${imageContent.id}-after" style="min-height:120px; border:2px dashed #e5e7eb; border-radius:8px; padding:8px; display:flex; flex-wrap:wrap; gap:8px; align-items:flex-start; justify-content:center;">
                          ${(imageContent.photos?.after || []).map(photo => `
                            <div class="image-thumb" draggable="true" data-image-url="${photo.blobUrl || photo}" data-image-id="${photo.imageId || photo}" data-category="after" style="width:120px; height:120px; position:relative; border-radius:4px; overflow:hidden; margin:0 auto;">
                              <img src="${photo.blobUrl || photo}" alt="Photo" draggable="false" style="width:100%; height:100%; object-fit:cover;">
                              <button type="button" class="image-thumb-remove" onclick="removeCleaningItemImage('${newSectionId}', '${imageContent.id}', 'after', '${photo.imageId || photo}', this.parentElement)" style="position:absolute; top:4px; right:4px; width:18px; height:18px; background:rgba(255, 103, 156, 0.9); color:#fff; border:none; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.6rem; z-index:10;">
                                <i class="fas fa-times"></i>
                              </button>
                            </div>
                          `).join('')}
                          <label class="image-add-btn" style="cursor:pointer; width:80px; height:80px; border:2px dashed #d1d5db; border-radius:8px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; color:#6b7280; font-size:0.75rem;">
                            <input type="file" accept="image/*" multiple class="cleaning-item-image-file-input" data-section-id="${newSectionId}" data-image-content-id="${imageContent.id}" data-category="after" style="display:none;">
                            <i class="fas fa-plus"></i>
                            <span>追加</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                `;
              } else {
                // 次回ご提案タブかどうかを判定
                const activeTab = document.querySelector('.tab-btn.active');
                const isProposal = activeTab && activeTab.dataset.tab === 'proposal';
                const labelText = isProposal ? 'ご提案箇所' : '施工後';
                return `
                  <div class="cleaning-item-image-content" data-image-content-id="${imageContent.id}" style="margin-top:16px; position:relative;">
                    <div class="cleaning-item-image-content-header" style="display:flex; justify-content:flex-end; align-items:center; margin-bottom:8px;">
                      <button type="button" class="cleaning-item-image-content-delete" onclick="deleteCleaningItemImageContent('${newSectionId}', '${imageContent.id}')" style="width:24px; height:24px; background:rgba(255, 103, 156, 0.9); color:#fff; border:none; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.7rem;">
                        <i class="fas fa-times"></i>
                      </button>
                    </div>
                    <div class="cleaning-item-image-grid" style="display:grid; grid-template-columns:1fr; gap:12px;">
                      <div class="image-category">
                        <div class="image-category-title completed" style="font-size:0.875rem; font-weight:600; color:#374151; margin-bottom:8px;">
                          <i class="fas fa-star"></i> ${labelText}
                        </div>
                        <div class="image-list" id="${imageContent.id}-completed" style="min-height:120px; border:2px dashed #e5e7eb; border-radius:8px; padding:8px; display:flex; flex-wrap:wrap; gap:8px; align-items:flex-start; justify-content:center;">
                          ${(imageContent.photos?.completed || []).map(photo => `
                            <div class="image-thumb" draggable="true" data-image-url="${photo.blobUrl || photo}" data-image-id="${photo.imageId || photo}" data-category="completed" style="width:120px; height:120px; position:relative; border-radius:4px; overflow:hidden; margin:0 auto;">
                              <img src="${photo.blobUrl || photo}" alt="Photo" draggable="false" style="width:100%; height:100%; object-fit:cover;">
                              <button type="button" class="image-thumb-remove" onclick="removeCleaningItemImage('${newSectionId}', '${imageContent.id}', 'completed', '${photo.imageId || photo}', this.parentElement)" style="position:absolute; top:4px; right:4px; width:18px; height:18px; background:rgba(255, 103, 156, 0.9); color:#fff; border:none; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.6rem; z-index:10;">
                                <i class="fas fa-times"></i>
                              </button>
                            </div>
                          `).join('')}
                          <label class="image-add-btn" style="cursor:pointer; width:80px; height:80px; border:2px dashed #d1d5db; border-radius:8px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; color:#6b7280; font-size:0.75rem;">
                            <input type="file" accept="image/*" multiple class="cleaning-item-image-file-input" data-section-id="${newSectionId}" data-image-content-id="${imageContent.id}" data-category="completed" style="display:none;">
                            <i class="fas fa-plus"></i>
                            <span>追加</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                `;
              }
            }).join('')}
            <div class="cleaning-item-insert-actions" style="margin-top:16px; display:flex; justify-content:center; gap:12px;">
              <button type="button" class="cleaning-item-insert-btn" onclick="addImageToCleaningItem('${newSectionId}')" title="画像挿入">
                <i class="fas fa-image"></i>
                <span>画像挿入</span>
              </button>
              <button type="button" class="cleaning-item-insert-btn" onclick="addCommentToCleaningItem('${newSectionId}')" title="コメント挿入">
                <i class="fas fa-comment"></i>
                <span>コメント挿入</span>
              </button>
              <button type="button" class="cleaning-item-insert-btn" onclick="addSubtitleToCleaningItem('${newSectionId}')" title="サブタイトル挿入">
                <i class="fas fa-heading"></i>
                <span>サブタイトル挿入</span>
              </button>
            </div>
          </div>
        </div>
      `;
    } else if (newSection.type === 'comment') {
      html = `
        <div class="section-card" data-section-id="${newSectionId}">
          <div class="section-header">
            <input type="checkbox" class="section-select-checkbox" data-section-id="${newSectionId}" onchange="toggleSectionSelection('${newSectionId}')">
            <span class="section-title"><i class="fas fa-comment"></i> コメント</span>
            <div class="section-header-actions">
              <button type="button" class="section-copy" onclick="copySection('${newSectionId}')" title="コピー">
                <i class="fas fa-copy"></i>
              </button>
              <button type="button" class="section-delete" onclick="deleteSection('${newSectionId}')" title="削除">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
          <div class="section-body">
            <textarea class="form-input section-textarea" placeholder="コメントを入力..." oninput="updateSectionContent('${newSectionId}', this.value)">${escapeHtml(newSection.content || '')}</textarea>
          </div>
        </div>
      `;
    } else if (newSection.type === 'work_content') {
      html = `
        <div class="section-card" data-section-id="${newSectionId}">
          <div class="section-header">
            <input type="checkbox" class="section-select-checkbox" data-section-id="${newSectionId}" onchange="toggleSectionSelection('${newSectionId}')">
            <span class="section-title"><i class="fas fa-tasks"></i> 作業内容</span>
            <div class="section-header-actions">
              <button type="button" class="section-copy" onclick="copySection('${newSectionId}')" title="コピー">
                <i class="fas fa-copy"></i>
              </button>
              <button type="button" class="section-delete" onclick="deleteSection('${newSectionId}')" title="削除">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
          <div class="section-body">
            <textarea class="form-input section-textarea" placeholder="作業内容を入力..." oninput="updateSectionContent('${newSectionId}', this.value)">${escapeHtml(newSection.content || '')}</textarea>
          </div>
        </div>
      `;
    } else if (newSection.type === 'image') {
      // 画像セクションのコピーは複雑なため、簡易版（画像は再追加が必要）
      if (newSection.image_type === 'before_after') {
        html = `
          <div class="section-card" data-section-id="${newSectionId}">
            <div class="section-header">
              <input type="checkbox" class="section-select-checkbox" data-section-id="${newSectionId}" onchange="toggleSectionSelection('${newSectionId}')">
              <span class="section-title"><i class="fas fa-image"></i> 画像（作業前・作業後）</span>
              <div class="section-header-actions">
                <button type="button" class="section-copy" onclick="copySection('${newSectionId}')" title="コピー">
                  <i class="fas fa-copy"></i>
                </button>
                <button type="button" class="section-delete" onclick="deleteSection('${newSectionId}')" title="削除">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
            <div class="section-body">
              <div class="image-grid">
                <div class="image-category">
                  <div class="image-category-title before"><i class="fas fa-clock"></i> 作業前</div>
                  <div class="image-list" id="${newSectionId}-before">
                    <div class="image-placeholder">
                      <img src="${DEFAULT_NO_PHOTO_IMAGE}" alt="写真を撮り忘れました" class="default-no-photo-image">
                    </div>
                    <label class="image-add-btn" style="cursor: pointer;">
                      <input type="file" accept="image/*" multiple class="section-image-file-input" data-section-id="${newSectionId}" data-category="before" style="display:none;">
                      <i class="fas fa-plus"></i>
                      <span>追加</span>
                    </label>
                  </div>
                </div>
                <div class="image-category">
                  <div class="image-category-title after"><i class="fas fa-check-circle"></i> 作業後</div>
                  <div class="image-list" id="${newSectionId}-after">
                    <div class="image-placeholder">
                      <img src="${DEFAULT_NO_PHOTO_IMAGE}" alt="写真を撮り忘れました" class="default-no-photo-image">
                    </div>
                    <label class="image-add-btn" style="cursor: pointer;">
                      <input type="file" accept="image/*" multiple class="section-image-file-input" data-section-id="${newSectionId}" data-category="after" style="display:none;">
                      <i class="fas fa-plus"></i>
                      <span>追加</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
        // 画像データはクリア（再追加が必要）
        newSection.photos = { before: [], after: [] };
      } else if (newSection.image_type === 'completed') {
        html = `
          <div class="section-card" data-section-id="${newSectionId}">
            <div class="section-header">
              <input type="checkbox" class="section-select-checkbox" data-section-id="${newSectionId}" onchange="toggleSectionSelection('${newSectionId}')">
              <span class="section-title"><i class="fas fa-star"></i> 画像（施工後）</span>
              <div class="section-header-actions">
                <button type="button" class="section-copy" onclick="copySection('${newSectionId}')" title="コピー">
                  <i class="fas fa-copy"></i>
                </button>
                <button type="button" class="section-delete" onclick="deleteSection('${newSectionId}')" title="削除">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
            <div class="section-body">
              <div class="image-grid image-grid-completed">
                <div class="image-category image-category-completed">
                  <div class="image-category-title completed"><i class="fas fa-star"></i> 施工後</div>
                  <div class="image-list image-list-completed" id="${newSectionId}-completed">
                    <div class="image-placeholder">
                      <img src="${DEFAULT_NO_PHOTO_IMAGE}" alt="写真を撮り忘れました" class="default-no-photo-image">
                    </div>
                    <label class="image-add-btn" style="cursor: pointer;">
                      <input type="file" accept="image/*" multiple class="section-image-file-input" data-section-id="${newSectionId}" data-category="completed" style="display:none;">
                      <i class="fas fa-plus"></i>
                      <span>追加</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
        // 画像データはクリア（再追加が必要）
        newSection.photos = { completed: [] };
      }
    }
    
    if (html) {
      // 元のセクションの後に挿入
      const originalElement = document.querySelector(`[data-section-id="${sectionId}"]`);
      if (originalElement && originalElement.nextSibling) {
        originalElement.insertAdjacentHTML('afterend', html);
      } else {
        reportContent.insertAdjacentHTML('beforeend', html);
      }
      
      // セクション内画像コンテンツのイベントリスナーを設定（清掃項目セクションの場合）
      if (newSection.type === 'cleaning' && newSection.imageContents && newSection.imageContents.length > 0) {
        setTimeout(() => {
          newSection.imageContents.forEach(imageContent => {
            const imageType = imageContent.imageType || 'before_after';
            setupCleaningItemImageUpload(imageContent.id, newSectionId, imageType);
            
            // ドラッグ&ドロップを設定
            if (imageType === 'before_after') {
              const beforeList = document.getElementById(`${imageContent.id}-before`);
              const afterList = document.getElementById(`${imageContent.id}-after`);
              if (beforeList) setupImageListDragAndDrop(beforeList, newSectionId, 'before', imageContent.id);
              if (afterList) setupImageListDragAndDrop(afterList, newSectionId, 'after', imageContent.id);
              
              // 画像サムネイルにドラッグ&ドロップを設定
              if (beforeList) {
                beforeList.querySelectorAll('.image-thumb').forEach(thumb => {
                  const url = thumb.dataset.imageUrl;
                  const imageId = thumb.dataset.imageId;
                  if (url) {
                    setupCleaningItemImageThumbDragAndDrop(thumb, newSectionId, imageContent.id, 'before', url, imageId);
                  }
                });
              }
              if (afterList) {
                afterList.querySelectorAll('.image-thumb').forEach(thumb => {
                  const url = thumb.dataset.imageUrl;
                  const imageId = thumb.dataset.imageId;
                  if (url) {
                    setupCleaningItemImageThumbDragAndDrop(thumb, newSectionId, imageContent.id, 'after', url, imageId);
                  }
                });
              }
            } else if (imageType === 'completed') {
              const completedList = document.getElementById(`${imageContent.id}-completed`);
              if (completedList) {
                setupImageListDragAndDrop(completedList, newSectionId, 'completed', imageContent.id);
                
                // 画像サムネイルにドラッグ&ドロップを設定
                completedList.querySelectorAll('.image-thumb').forEach(thumb => {
                  const url = thumb.dataset.imageUrl;
                  const imageId = thumb.dataset.imageId;
                  if (url) {
                    setupCleaningItemImageThumbDragAndDrop(thumb, newSectionId, imageContent.id, 'completed', url, imageId);
                  }
                });
              }
            }
          });
        }, 0);
      }
      
      // ドラッグ&ドロップを設定
      const newCard = document.querySelector(`[data-section-id="${newSectionId}"]`);
      if (newCard) {
        setupSectionDragAndDrop(newCard);
      }
      
      updateCleaningItemsList();
      autoSave();
    }
  }

  // セクションカードの選択モード表示を更新
  function updateSectionCardsForSelection() {
    const sectionCards = document.querySelectorAll('.section-card');
    sectionCards.forEach(card => {
      const sectionId = card.dataset.sectionId;
      if (!sectionId) return;
      
      // チェックボックスは常に表示される（HTMLに既に含まれている）
      const checkbox = card.querySelector('.section-select-checkbox[data-section-id]');
      if (checkbox) {
        checkbox.checked = selectedSectionIds.has(sectionId);
      }
      
      // 選択状態を反映
      if (selectedSectionIds.has(sectionId)) {
        card.classList.add('section-selected');
      } else {
        card.classList.remove('section-selected');
      }
    });
  }

  // セクション選択をトグル（常に動作する）
  function toggleSectionSelectionInternal(sectionId) {
    if (selectedSectionIds.has(sectionId)) {
      selectedSectionIds.delete(sectionId);
    } else {
      selectedSectionIds.add(sectionId);
    }
    
    // セクションカードの選択状態を更新
    const sectionCard = document.querySelector(`[data-section-id="${sectionId}"]`);
    const checkbox = document.querySelector(`.section-select-checkbox[data-section-id="${sectionId}"]`);
    if (sectionCard) {
      if (selectedSectionIds.has(sectionId)) {
        sectionCard.classList.add('section-selected');
        if (checkbox) checkbox.checked = true;
      } else {
        sectionCard.classList.remove('section-selected');
        if (checkbox) checkbox.checked = false;
      }
    }
    
    // ボタンの表示を更新
    const sectionCopyBtn = document.getElementById('section-copy-btn');
    const sectionBulkDeleteBtn = document.getElementById('section-bulk-delete-btn');
    if (sectionCopyBtn) {
      if (selectedSectionIds.size > 0) {
        sectionCopyBtn.innerHTML = `<i class="fas fa-copy"></i><span>コピー (${selectedSectionIds.size})</span>`;
      } else {
        sectionCopyBtn.innerHTML = '<i class="fas fa-copy"></i><span>コピー</span>';
      }
    }
    if (sectionBulkDeleteBtn) {
      if (selectedSectionIds.size > 0) {
        sectionBulkDeleteBtn.innerHTML = `<i class="fas fa-trash"></i><span>削除 (${selectedSectionIds.size})</span>`;
      } else {
        sectionBulkDeleteBtn.innerHTML = '<i class="fas fa-trash"></i><span>削除</span>';
      }
    }
  }

  // 清掃項目更新
  window.updateCleaningItem = function(sectionId, value) {
    const card = document.querySelector(`[data-section-id="${sectionId}"]`);
    if (!card) return;
    
    const customInput = card.querySelector('.cleaning-item-custom');
    const select = card.querySelector('.cleaning-item-select');
    
    if (value === '__other__') {
      // 自由入力を選択した場合
      if (customInput) {
      customInput.style.display = 'block';
        customInput.value = ''; // 入力フィールドをクリア
      customInput.focus();
      }
      if (sections[sectionId]) {
      sections[sectionId].item_name = '';
      }
    } else if (value && value !== '') {
      // 通常の項目を選択した場合
      if (customInput) {
      customInput.style.display = 'none';
      }
      if (sections[sectionId]) {
      sections[sectionId].item_name = value;
      }
    }
    
    updateCleaningItemsList();
  };

  // 自由入力フィールドの値を更新
  window.updateCleaningItemCustom = function(sectionId, value) {
    const card = document.querySelector(`[data-section-id="${sectionId}"]`);
    if (!card) return;
    
    const select = card.querySelector('.cleaning-item-select');
    
    // 自由入力フィールドに値が入力された場合、セレクトボックスを「その他（自由入力）」に設定
    if (select && select.value !== '__other__') {
      select.value = '__other__';
    }
    
    // セクションのitem_nameを更新
    if (sections[sectionId]) {
      sections[sectionId].item_name = value || '';
    }
    
    updateCleaningItemsList();
  };

  // 清掃項目のメモ・備考を更新
  window.updateCleaningItemNotes = function(sectionId, value) {
    if (sections[sectionId]) {
      sections[sectionId].notes = value;
    }
  };

  // 清掃項目セクションの追加メニューを表示
  window.showCleaningItemAddMenu = function(sectionId) {
    // 他のメニューを閉じる
    document.querySelectorAll('.cleaning-item-add-menu').forEach(menu => {
      if (menu.id !== `cleaning-item-add-menu-${sectionId}`) {
        menu.style.display = 'none';
      }
    });
    
    const menu = document.getElementById(`cleaning-item-add-menu-${sectionId}`);
    if (menu) {
      menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    }
  };

  // 清掃項目セクションにテキスト入力フィールドを追加
  window.addTextToCleaningItem = function(sectionId) {
    const sectionBody = document.querySelector(`[data-section-id="${sectionId}"] .section-body`);
    if (!sectionBody) return;
    
    const addActions = sectionBody.querySelector('.cleaning-item-add-actions');
    if (!addActions) return;
    
    // 新しいテキスト入力フィールドを作成
    const textFieldId = `cleaning-item-text-${sectionId}-${Date.now()}`;
    const textField = document.createElement('textarea');
    textField.className = 'form-input cleaning-item-text-field';
    textField.placeholder = 'テキストを入力してください';
    textField.style.cssText = 'margin-top:8px; min-height:80px; resize:vertical; width:100%;';
    textField.oninput = function() {
      if (sections[sectionId]) {
        if (!sections[sectionId].textFields) {
          sections[sectionId].textFields = [];
        }
        const fieldIndex = sections[sectionId].textFields.findIndex(f => f.id === textFieldId);
        if (fieldIndex >= 0) {
          sections[sectionId].textFields[fieldIndex].value = this.value;
        } else {
          sections[sectionId].textFields.push({ id: textFieldId, value: this.value });
        }
        autoSave();
      }
    };
    
    // 削除ボタン付きのコンテナを作成
    const textFieldContainer = document.createElement('div');
    textFieldContainer.className = 'cleaning-item-text-field-container';
    textFieldContainer.style.cssText = 'position:relative; margin-top:8px;';
    
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'cleaning-item-text-field-delete';
    deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
    deleteBtn.style.cssText = 'position:absolute; top:8px; right:8px; width:24px; height:24px; background:rgba(239, 68, 68, 0.9); color:#fff; border:none; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.7rem; z-index:10;';
    deleteBtn.onclick = function() {
      deleteCleaningItemTextField(sectionId, textFieldId);
    };
    
    textFieldContainer.appendChild(textField);
    textFieldContainer.appendChild(deleteBtn);
    
    // 追加アクションボタンの前に挿入
    addActions.parentNode.insertBefore(textFieldContainer, addActions);
    
    // メニューを閉じる
    const menu = document.getElementById(`cleaning-item-add-menu-${sectionId}`);
    if (menu) {
      menu.style.display = 'none';
    }
    
    // データに保存
    if (sections[sectionId]) {
      if (!sections[sectionId].textFields) {
        sections[sectionId].textFields = [];
      }
      sections[sectionId].textFields.push({ id: textFieldId, value: '' });
    }
    
    autoSave();
  };

  // 清掃項目セクションに画像コンテンツを追加（セクションタイトルなし）
  window.addImageToCleaningItem = function(sectionId, imageType = 'before_after') {
    // 画像タイプ選択モーダルを表示
    openCleaningItemImageTypeModal(sectionId);
  };
  
  // 清掃項目セクション用の画像タイプ選択モーダルを開く
  function openCleaningItemImageTypeModal(sectionId) {
    // 現在アクティブなタブを確認
    const activeTab = document.querySelector('.tab-btn.active');
    const isProposalTab = activeTab && activeTab.dataset.tab === 'proposal';
    
    const modal = document.getElementById('cleaning-item-image-type-modal');
    if (!modal) {
      // モーダルが存在しない場合は作成
      createCleaningItemImageTypeModal();
    }
    const modalElement = document.getElementById('cleaning-item-image-type-modal');
    if (modalElement) {
      modalElement.dataset.sectionId = sectionId;
      modalElement.dataset.isProposal = isProposalTab ? 'true' : 'false';
      
      // 次回ご提案タブの場合は、モーダルを表示せずに直接「施工後」タイプを追加
      if (isProposalTab) {
        addCleaningItemImageContent(sectionId, 'completed', true);
        return;
      }
      
      modalElement.style.display = 'flex';
    }
  }
  
  // 清掃項目セクション用の画像タイプ選択モーダルを作成
  function createCleaningItemImageTypeModal() {
    const modal = document.createElement('div');
    modal.id = 'cleaning-item-image-type-modal';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:10000; align-items:center; justify-content:center;';
    modal.innerHTML = `
      <div class="modal-content" style="background:#fff; border-radius:12px; padding:24px; max-width:400px; width:90%;">
        <div class="modal-header" style="margin-bottom:20px;">
          <h3 style="font-size:1.25rem; font-weight:600; color:#111827;">画像タイプを選択</h3>
        </div>
        <div class="modal-body" style="display:flex; flex-direction:column; gap:12px;">
          <button type="button" class="btn-image-type" data-type="before_after" style="padding:16px; background:#f9fafb; border:2px solid #e5e7eb; border-radius:8px; cursor:pointer; text-align:left; transition:all 0.2s;">
            <div style="font-weight:600; color:#111827; margin-bottom:4px;">
              <i class="fas fa-images"></i> 作業前・作業後
            </div>
            <div style="font-size:0.875rem; color:#6b7280;">作業前と作業後の写真を追加</div>
          </button>
          <button type="button" class="btn-image-type" data-type="completed" style="padding:16px; background:#f9fafb; border:2px solid #e5e7eb; border-radius:8px; cursor:pointer; text-align:left; transition:all 0.2s;">
            <div style="font-weight:600; color:#111827; margin-bottom:4px;">
              <i class="fas fa-star"></i> 施工後
            </div>
            <div style="font-size:0.875rem; color:#6b7280;">施工後の写真を追加</div>
          </button>
        </div>
        <div class="modal-footer" style="margin-top:20px; display:flex; justify-content:flex-end;">
          <button type="button" class="btn btn-outline" onclick="document.getElementById('cleaning-item-image-type-modal').style.display='none'" style="padding:8px 16px; background:#fff; border:1px solid #d1d5db; border-radius:6px; cursor:pointer; color:#374151;">キャンセル</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    // ボタンのイベントリスナーを設定
    modal.querySelectorAll('.btn-image-type').forEach(btn => {
      btn.addEventListener('click', function() {
        const imageType = this.dataset.type;
        const sectionId = modal.dataset.sectionId;
        const isProposal = modal.dataset.isProposal === 'true';
        modal.style.display = 'none';
        addCleaningItemImageContent(sectionId, imageType, isProposal);
      });
    });
    
    // モーダル外クリックで閉じる
    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  }
  
  // 清掃項目セクションに画像コンテンツを追加（実際の追加処理）
  function addCleaningItemImageContent(sectionId, imageType = 'before_after', isProposal = false) {
    // 現在アクティブなタブを確認
    const activeTab = document.querySelector('.tab-btn.active');
    const isProposalTab = activeTab && activeTab.dataset.tab === 'proposal';
    
    // セクションを検索（タブに関係なく検索）
    const sectionBody = document.querySelector(`[data-section-id="${sectionId}"] .section-body`);
    if (!sectionBody) {
      console.warn(`[addCleaningItemImageContent] sectionBody not found for sectionId: ${sectionId}`);
      return;
    }
    
    const insertActions = sectionBody.querySelector('.cleaning-item-insert-actions');
    if (!insertActions) return;
    
    // セクション内画像コンテンツのIDを生成
    const imageContentId = `cleaning-item-image-${sectionId}-${Date.now()}`;
    
    // セクション内画像コンテンツのHTMLを作成
    const imageContentContainer = document.createElement('div');
    imageContentContainer.className = 'cleaning-item-image-content';
    imageContentContainer.dataset.imageContentId = imageContentId;
    imageContentContainer.style.cssText = 'margin-top:16px; position:relative;';
    
    let imageContentHtml = '';
    
    if (imageType === 'before_after') {
      // 作業前・作業後タイプ
      imageContentHtml = `
        <div class="cleaning-item-image-content-header" style="display:flex; justify-content:flex-end; align-items:center; margin-bottom:8px;">
          <button type="button" class="cleaning-item-image-content-delete" onclick="deleteCleaningItemImageContent('${sectionId}', '${imageContentId}')" style="width:24px; height:24px; background:rgba(255, 103, 156, 0.9); color:#fff; border:none; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.7rem;">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="cleaning-item-image-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
          <div class="image-category">
            <div class="image-category-title before" style="font-size:0.875rem; font-weight:600; color:#374151; margin-bottom:8px;">
              <i class="fas fa-clock"></i> 作業前
            </div>
            <div class="image-list" id="${imageContentId}-before" style="min-height:120px; border:2px dashed #e5e7eb; border-radius:8px; padding:8px; display:flex; flex-wrap:wrap; gap:8px; align-items:flex-start;">
              <button type="button" class="image-add-btn cleaning-item-image-add-btn" onclick="openCleaningItemImageAddModal('${sectionId}', '${imageContentId}', 'before')" style="cursor:pointer; width:80px; height:80px; border:2px dashed #d1d5db; border-radius:8px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; color:#6b7280; font-size:0.75rem; background:transparent; padding:0;">
                <i class="fas fa-plus"></i>
                <span>追加</span>
              </button>
            </div>
          </div>
          <div class="image-category">
            <div class="image-category-title after" style="font-size:0.875rem; font-weight:600; color:#374151; margin-bottom:8px;">
              <i class="fas fa-check-circle"></i> 作業後
            </div>
            <div class="image-list" id="${imageContentId}-after" style="min-height:120px; border:2px dashed #e5e7eb; border-radius:8px; padding:8px; display:flex; flex-wrap:wrap; gap:8px; align-items:flex-start; justify-content:center;">
              <button type="button" class="image-add-btn cleaning-item-image-add-btn" onclick="openCleaningItemImageAddModal('${sectionId}', '${imageContentId}', 'after')" style="cursor:pointer; width:80px; height:80px; border:2px dashed #d1d5db; border-radius:8px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; color:#6b7280; font-size:0.75rem; background:transparent; padding:0;">
                <i class="fas fa-plus"></i>
                <span>追加</span>
              </button>
            </div>
          </div>
        </div>
      `;
    } else if (imageType === 'completed') {
      // 施工後タイプ（次回ご提案タブの場合は「ご提案箇所」に変更）
      const labelText = isProposal ? 'ご提案箇所' : '施工後';
      imageContentHtml = `
        <div class="cleaning-item-image-content-header" style="display:flex; justify-content:flex-end; align-items:center; margin-bottom:8px;">
          <button type="button" class="cleaning-item-image-content-delete" onclick="deleteCleaningItemImageContent('${sectionId}', '${imageContentId}')" style="width:24px; height:24px; background:rgba(255, 103, 156, 0.9); color:#fff; border:none; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.7rem;">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="cleaning-item-image-grid" style="display:grid; grid-template-columns:1fr; gap:12px;">
          <div class="image-category">
            <div class="image-category-title completed" style="font-size:0.875rem; font-weight:600; color:#374151; margin-bottom:8px;">
              <i class="fas fa-star"></i> ${labelText}
            </div>
            <div class="image-list" id="${imageContentId}-completed" style="min-height:120px; border:2px dashed #e5e7eb; border-radius:8px; padding:8px; display:flex; flex-wrap:wrap; gap:8px; align-items:flex-start; justify-content:center;">
              <button type="button" class="image-add-btn cleaning-item-image-add-btn" onclick="openCleaningItemImageAddModal('${sectionId}', '${imageContentId}', 'completed')" style="cursor:pointer; width:80px; height:80px; border:2px dashed #d1d5db; border-radius:8px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; color:#6b7280; font-size:0.75rem; background:transparent; padding:0;">
                <i class="fas fa-plus"></i>
                <span>追加</span>
              </button>
            </div>
          </div>
        </div>
      `;
    }
    
    imageContentContainer.innerHTML = imageContentHtml;
    
    // 挿入アクションボタンの前に挿入
    insertActions.parentNode.insertBefore(imageContentContainer, insertActions);
    
    // データに保存
    if (sections[sectionId]) {
      if (!sections[sectionId].imageContents) {
        sections[sectionId].imageContents = [];
      }
      if (imageType === 'before_after') {
        sections[sectionId].imageContents.push({
          id: imageContentId,
          imageType: 'before_after',
          photos: { before: [], after: [] }
        });
      } else {
        sections[sectionId].imageContents.push({
          id: imageContentId,
          imageType: 'completed',
          photos: { completed: [] }
        });
      }
    }
    
    // 画像アップロードのイベントリスナーを設定
    setupCleaningItemImageUpload(imageContentId, sectionId, imageType);
    
    // ドラッグ&ドロップを設定
    setTimeout(() => {
      if (imageType === 'before_after') {
        const beforeList = document.getElementById(`${imageContentId}-before`);
        const afterList = document.getElementById(`${imageContentId}-after`);
        if (beforeList) setupImageListDragAndDrop(beforeList, sectionId, 'before', imageContentId);
        if (afterList) setupImageListDragAndDrop(afterList, sectionId, 'after', imageContentId);
      } else if (imageType === 'completed') {
        const completedList = document.getElementById(`${imageContentId}-completed`);
        if (completedList) setupImageListDragAndDrop(completedList, sectionId, 'completed', imageContentId);
      }
    }, 0);
    
    autoSave();
  }
  
  // セクション内画像コンテンツの画像追加モーダルを開く
  // 管理レポート作成画面では、メディア選択モーダルを直接開く
  window.openCleaningItemImageAddModal = function(sectionId, imageContentId, category) {
    // メディア選択モーダルを直接開く
    openMediaSelectionDialog(sectionId, imageContentId, category);
  };
  
  // メディア選択ダイアログを開く
  function openMediaSelectionDialog(sectionId, imageContentId, category) {
    const mediaDialog = document.getElementById('media-selection-dialog');
    if (!mediaDialog) return;
    
    // 既存の画像リストを保存（キャンセル時に復元するため）
    const imageList = document.getElementById(`${imageContentId}-${category}`);
    if (imageList) {
      mediaDialog.dataset.originalImageListHTML = imageList.innerHTML;
    }
    
    // ダイアログに情報を保存
    mediaDialog.dataset.sectionId = sectionId;
    mediaDialog.dataset.imageContentId = imageContentId;
    mediaDialog.dataset.category = category;
    
    // 日付を今日に設定
    const dateInput = document.getElementById('media-selection-date');
    if (dateInput) {
      const today = new Date().toISOString().split('T')[0];
      dateInput.value = today;
    }
    
    // フォルダ一覧を読み込み
    loadMediaFolders();
    
    // 画像を読み込み
    loadMediaImages();
    
    // ダイアログを表示
    mediaDialog.style.display = 'flex';
    
    // 保存ボタンのイベントリスナーを設定
    const saveBtn = document.getElementById('save-media-selection-btn');
    if (saveBtn) {
      const newSaveBtn = saveBtn.cloneNode(true);
      saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
      
      newSaveBtn.addEventListener('click', function() {
        const selectedImages = document.querySelectorAll('#media-selection-grid .media-item.selected');
        console.log('[MediaSelection] Save button clicked, selected images:', selectedImages.length);
        
        // mediaDialog.datasetから情報を取得（クロージャーの変数ではなく、確実に取得）
        const currentSectionId = mediaDialog.dataset.sectionId;
        const currentImageContentId = mediaDialog.dataset.imageContentId;
        const currentCategory = mediaDialog.dataset.category;
        
        console.log('[MediaSelection] Section info from dataset:', {
          sectionId: currentSectionId,
          imageContentId: currentImageContentId,
          category: currentCategory
        });
        
        if (selectedImages.length > 0) {
          selectedImages.forEach((item, index) => {
            const imageId = item.dataset.imageId;
            const imageUrl = item.querySelector('img')?.src;
            const imageData = item.dataset.imageData ? JSON.parse(item.dataset.imageData) : null;
            console.log('[MediaSelection] Processing image', index + 1, ':', {
              imageId,
              imageUrl,
              imageData
            });
            
            if (imageId && imageUrl && currentSectionId && currentImageContentId && currentCategory) {
              addImageToCleaningItemFromMedia(
                currentSectionId,
                currentImageContentId,
                currentCategory,
                imageId,
                imageUrl,
                imageData
              );
            } else {
              console.warn('[MediaSelection] Missing required data:', {
                imageId: !!imageId,
                imageUrl: !!imageUrl,
                sectionId: !!currentSectionId,
                imageContentId: !!currentImageContentId,
                category: !!currentCategory
              });
            }
          });
        } else {
          console.warn('[MediaSelection] No images selected');
        }
        closeMediaSelectionDialog();
      });
    }
    
    // フィルター変更時のイベントリスナー
    const dateInputEl = document.getElementById('media-selection-date');
    const folderSelectEl = document.getElementById('media-selection-folder');
    const categorySelectEl = document.getElementById('media-selection-category');
    
    if (dateInputEl) {
      const newDateInput = dateInputEl.cloneNode(true);
      dateInputEl.parentNode.replaceChild(newDateInput, dateInputEl);
      newDateInput.addEventListener('change', () => {
        loadMediaFolders();
        loadMediaImages();
      });
    }
    
    if (folderSelectEl) {
      const newFolderSelect = folderSelectEl.cloneNode(true);
      folderSelectEl.parentNode.replaceChild(newFolderSelect, folderSelectEl);
      newFolderSelect.addEventListener('change', loadMediaImages);
    }
    
    if (categorySelectEl) {
      const newCategorySelect = categorySelectEl.cloneNode(true);
      categorySelectEl.parentNode.replaceChild(newCategorySelect, categorySelectEl);
      newCategorySelect.addEventListener('change', loadMediaImages);
    }
  }
  
  // メディアフォルダ一覧を読み込み
  async function loadMediaFolders() {
    try {
      const dateInput = document.getElementById('media-selection-date');
      const cleaningDate = dateInput?.value || new Date().toISOString().split('T')[0];
      const url = `${REPORT_API}/staff/report-images?date=${cleaningDate}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${await getFirebaseIdToken()}`
        }
      });
      
      if (!response.ok) return;
      
      const data = await response.json();
      const images = data.images || [];
      
      // フォルダ名の一意リストを取得
      const folderSet = new Set();
      images.forEach(img => {
        if (img.folder_name) {
          folderSet.add(img.folder_name);
        }
      });
      
      const folders = Array.from(folderSet).sort();
      const folderSelect = document.getElementById('media-selection-folder');
      if (folderSelect) {
        const currentValue = folderSelect.value;
        folderSelect.innerHTML = '<option value="">全てのフォルダ</option>';
        folders.forEach(folder => {
          const option = document.createElement('option');
          option.value = folder;
          option.textContent = folder;
          folderSelect.appendChild(option);
        });
        if (currentValue && folders.includes(currentValue)) {
          folderSelect.value = currentValue;
        }
      }
    } catch (error) {
      console.error('Error loading media folders:', error);
    }
  }
  
  // メディア画像を読み込み
  async function loadMediaImages() {
    const grid = document.getElementById('media-selection-grid');
    if (!grid) return;
    
    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px; color:#6b7280;"><i class="fas fa-spinner fa-spin" style="font-size:2rem; margin-bottom:12px;"></i><p>読み込み中...</p></div>';
    
    try {
      const dateInput = document.getElementById('media-selection-date');
      const folderSelect = document.getElementById('media-selection-folder');
      const categorySelect = document.getElementById('media-selection-category');
      
      const cleaningDate = dateInput?.value || new Date().toISOString().split('T')[0];
      let url = `${REPORT_API}/staff/report-images?date=${cleaningDate}`;
      
      const category = categorySelect?.value;
      if (category) {
        url += `&category=${category}`;
      }
      
      const folderName = folderSelect?.value;
      if (folderName) {
        url += `&folder_name=${encodeURIComponent(folderName)}`;
      }
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${await getFirebaseIdToken()}`
        }
      });
      
      if (!response.ok) {
        throw new Error('画像の取得に失敗しました');
      }
      
      const data = await response.json();
      const images = data.images || [];
      
      if (images.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px; color:#9ca3af;"><i class="fas fa-images" style="font-size:3rem; margin-bottom:16px; opacity:0.5;"></i><p>画像がありません</p></div>';
        updateMediaSelectionInfo(0);
        return;
      }
      
      grid.innerHTML = images.map(img => {
        const categoryLabel = img.category === 'before' ? '作業前' : '作業後';
        const folderLabel = img.folder_name || 'フォルダなし';
        const date = new Date(img.cleaning_date).toLocaleDateString('ja-JP');
        const imageData = JSON.stringify({
          image_id: img.image_id,
          url: img.url,
          category: img.category,
          folder_name: img.folder_name,
          cleaning_date: img.cleaning_date,
          uploaded_at: img.uploaded_at
        });
        
        return `
          <div class="media-item" data-image-id="${img.image_id}" data-image-data='${imageData.replace(/'/g, "&apos;")}' style="position:relative; aspect-ratio:1; border-radius:8px; overflow:hidden; cursor:pointer; border:2px solid #e5e7eb; transition:all 0.2s;">
            <img src="${img.url}" alt="Media" style="width:100%; height:100%; object-fit:cover;" loading="lazy">
            <div class="media-item-overlay" style="position:absolute; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity 0.2s;">
              <i class="fas fa-check-circle" style="color:#fff; font-size:2rem;"></i>
            </div>
            <div class="media-item-badge" style="position:absolute; top:4px; right:4px; padding:4px 8px; background:rgba(255,103,156,0.9); color:#fff; border-radius:4px; font-size:0.7rem; font-weight:600;">${categoryLabel}</div>
          </div>
        `;
      }).join('');
      
      // クリックイベントを設定
      grid.querySelectorAll('.media-item').forEach(item => {
        item.addEventListener('click', function() {
          this.classList.toggle('selected');
          const overlay = this.querySelector('.media-item-overlay');
          if (overlay) {
            overlay.style.opacity = this.classList.contains('selected') ? '1' : '0';
          }
          updateMediaSelectionInfo();
        });
      });
      
      updateMediaSelectionInfo(images.length);
    } catch (error) {
      console.error('Error loading media images:', error);
      grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px; color:#ef4444;"><i class="fas fa-exclamation-circle" style="font-size:2rem; margin-bottom:12px;"></i><p>画像の読み込みに失敗しました</p></div>';
    }
  }
  
  // メディア選択情報を更新
  function updateMediaSelectionInfo(totalCount) {
    const infoEl = document.getElementById('media-selection-info');
    if (!infoEl) return;
    
    const selectedCount = document.querySelectorAll('#media-selection-grid .media-item.selected').length;
    if (totalCount !== undefined) {
      infoEl.textContent = `全${totalCount}件中${selectedCount}件選択中`;
    } else {
      const total = document.querySelectorAll('#media-selection-grid .media-item').length;
      infoEl.textContent = `全${total}件中${selectedCount}件選択中`;
    }
  }
  
  // メディア選択ダイアログを閉じる
  window.closeMediaSelectionDialog = function() {
    const mediaDialog = document.getElementById('media-selection-dialog');
    if (!mediaDialog) return;
    
    // 画像が選択されていない場合（キャンセル時）は、元の画像リストを復元
    const imageContentId = mediaDialog.dataset.imageContentId;
    const category = mediaDialog.dataset.category;
    const originalHTML = mediaDialog.dataset.originalImageListHTML;
    
    if (originalHTML !== undefined && imageContentId && category) {
      const imageList = document.getElementById(`${imageContentId}-${category}`);
      if (imageList) {
        const currentImages = imageList.querySelectorAll('.image-thumb');
        if (currentImages.length === 0) {
          imageList.innerHTML = originalHTML;
        }
      }
    }
    
    // データ属性をクリア
    delete mediaDialog.dataset.sectionId;
    delete mediaDialog.dataset.imageContentId;
    delete mediaDialog.dataset.category;
    delete mediaDialog.dataset.originalImageListHTML;
    
    // 選択状態をリセット
    mediaDialog.querySelectorAll('.media-item.selected').forEach(item => {
      item.classList.remove('selected');
      const overlay = item.querySelector('.media-item-overlay');
      if (overlay) overlay.style.opacity = '0';
    });
    
    // モーダルを閉じる
    mediaDialog.style.display = 'none';
  };
  
  // メディアから選択した画像をセクションに追加
  function addImageToCleaningItemFromMedia(sectionId, imageContentId, category, imageId, imageUrl, imageData) {
    console.log('[addImageToCleaningItemFromMedia] Called with:', {
      sectionId,
      imageContentId,
      category,
      imageId,
      imageUrl,
      imageData
    });
    
    const imageList = document.getElementById(`${imageContentId}-${category}`);
    if (!imageList) {
      console.warn('[addImageToCleaningItemFromMedia] Image list not found:', `${imageContentId}-${category}`);
      return;
    }
    
    // 画像サムネイルを作成
    const imageThumb = document.createElement('div');
    imageThumb.className = 'image-thumb';
    imageThumb.dataset.imageId = imageId;
    imageThumb.dataset.imageUrl = imageUrl;
    
    // メディア情報を表示
    const folderName = imageData?.folder_name || 'フォルダなし';
    const categoryLabel = imageData?.category === 'before' ? '作業前' : '作業後';
    const date = imageData?.cleaning_date ? new Date(imageData.cleaning_date).toLocaleDateString('ja-JP') : '';
    
    imageThumb.innerHTML = `
      <img src="${imageUrl}" alt="Selected from media" loading="lazy">
      <div class="image-thumb-info" style="position:absolute; bottom:0; left:0; right:0; background:linear-gradient(to top, rgba(0,0,0,0.7), transparent); padding:8px; color:#fff; font-size:0.7rem;">
        <div style="font-weight:600;">${folderName}</div>
        <div style="opacity:0.9;">${categoryLabel} ${date}</div>
      </div>
      <button type="button" class="image-remove" onclick="removeImageFromSection('${imageContentId}', '${category}', '${imageId}')">
        <i class="fas fa-times"></i>
      </button>
    `;
    
    // 追加ボタンの前に挿入
    const addBtn = imageList.querySelector('.image-add-btn');
    if (addBtn) {
      imageList.insertBefore(imageThumb, addBtn);
    } else {
      imageList.appendChild(imageThumb);
    }
    
    // セクションデータを更新（imageContentsに保存）
    if (sections[sectionId] && sections[sectionId].imageContents) {
      const imageContent = sections[sectionId].imageContents.find(ic => ic.id === imageContentId);
      if (imageContent) {
        if (!imageContent.photos[category]) {
          imageContent.photos[category] = [];
        }
        const imageDataObj = {
          imageId: imageId,
          url: imageUrl,
          warehouseUrl: imageUrl,
          imageUrl: imageUrl,
          source: 'media',
          media_info: imageData,
          uploaded: true
        };
        imageContent.photos[category].push(imageDataObj);
        console.log('[ImageUpload] Image added to section (media):', {
          sectionId,
          imageContentId,
          category,
          imageData: imageDataObj,
          allPhotos: imageContent.photos
        });
      } else {
        console.warn('[ImageUpload] ImageContent not found (media):', imageContentId, 'in section:', sectionId);
      }
    } else {
      console.warn('[ImageUpload] Section or imageContents not found (media):', {
        sectionId,
        hasSection: !!sections[sectionId],
        hasImageContents: !!(sections[sectionId] && sections[sectionId].imageContents)
      });
    }
    
    // sectionsByTabも更新
    try {
      const activeTab = (typeof currentActiveTab !== 'undefined' && currentActiveTab) ? currentActiveTab : 'new';
      if (sectionsByTab && sectionsByTab[activeTab]) {
        sectionsByTab[activeTab] = { ...sections };
        console.log('[ImageUpload] Updated sectionsByTab for tab (media):', activeTab);
      } else {
        console.warn('[ImageUpload] sectionsByTab not found for tab:', activeTab);
      }
    } catch (error) {
      console.warn('[ImageUpload] Error updating sectionsByTab:', error);
      // エラーが発生しても処理を続行
    }
  }
  
  // AWS画像倉庫から選択（旧関数、互換性のため残す）
  function openCleaningItemImageWarehouseDialog(sectionId, imageContentId, category) {
    // 既存のwarehouse-dialogを使用
    const warehouseDialog = document.getElementById('warehouse-dialog');
    if (!warehouseDialog) return;
    
    // 既存の画像リストを保存（キャンセル時に復元するため）
    const imageList = document.getElementById(`${imageContentId}-${category}`);
    if (imageList) {
      warehouseDialog.dataset.originalImageListHTML = imageList.innerHTML;
    }
    
    // ダイアログに情報を保存
    warehouseDialog.dataset.cleaningItemSectionId = sectionId;
    warehouseDialog.dataset.cleaningItemImageContentId = imageContentId;
    warehouseDialog.dataset.cleaningItemCategory = category;
    warehouseDialog.dataset.cleaningItemMode = 'true';
    
    // ダイアログを表示
    warehouseDialog.style.display = 'flex';
    
    // 既存のsave-images-btnのイベントを確認
    const saveBtn = document.getElementById('save-images-btn');
    if (saveBtn) {
      // 既存のイベントリスナーを削除して新しいものを追加
      const newSaveBtn = saveBtn.cloneNode(true);
      saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
      
      newSaveBtn.addEventListener('click', function() {
        // 選択された画像をセクション内画像コンテンツに追加
        const selectedImages = document.querySelectorAll('#stock-selection-grid .stock-item.selected, #library-grid .library-item.selected');
        if (selectedImages.length > 0) {
          selectedImages.forEach(item => {
            const imageId = item.dataset.imageId;
            const imageUrl = item.querySelector('img')?.src;
            if (imageId && imageUrl) {
              addImageToCleaningItemFromWarehouse(sectionId, imageContentId, category, imageId, imageUrl);
            }
          });
        }
        closeWarehouseDialog();
      });
    }
  }
  
  // 画像倉庫モーダルを閉じる（セクションが消えないように安全に閉じる）
  window.closeWarehouseDialog = function() {
    const warehouseDialog = document.getElementById('warehouse-dialog');
    if (!warehouseDialog) return;
    
    // セクション内画像コンテンツモードの場合は、画像リストを復元
    if (warehouseDialog.dataset.cleaningItemMode === 'true') {
      const imageContentId = warehouseDialog.dataset.cleaningItemImageContentId;
      const category = warehouseDialog.dataset.cleaningItemCategory;
      const originalHTML = warehouseDialog.dataset.originalImageListHTML;
      
      // 画像が選択されていない場合（キャンセル時）は、元の画像リストを復元
      if (originalHTML !== undefined) {
        const imageList = document.getElementById(`${imageContentId}-${category}`);
        if (imageList) {
          // 現在の画像リストが空または追加ボタンのみの場合、元のHTMLを復元
          const currentImages = imageList.querySelectorAll('.image-thumb');
          if (currentImages.length === 0) {
            imageList.innerHTML = originalHTML;
          }
        }
      }
      
      // データ属性をクリア
      delete warehouseDialog.dataset.cleaningItemSectionId;
      delete warehouseDialog.dataset.cleaningItemImageContentId;
      delete warehouseDialog.dataset.cleaningItemCategory;
      delete warehouseDialog.dataset.cleaningItemMode;
      delete warehouseDialog.dataset.originalImageListHTML;
    }
    
    // モーダルを閉じる
    warehouseDialog.style.display = 'none';
  };
  
  // ライブラリから選択
  function openCleaningItemImageLibraryPicker(sectionId, imageContentId, category) {
    // ファイル入力を作成（ライブラリモード）
    // capture属性を付けないことで、写真ライブラリを優先的に開く
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.style.display = 'none';
    // capture属性を明示的にnullに設定（写真ライブラリを優先）
    // 注意: スマホのブラウザの仕様上、完全に「写真ライブラリ」だけを開くことはできませんが、
    // capture属性がない場合、多くのブラウザでは「写真ライブラリ」が最初の選択肢として表示されます
    
    input.addEventListener('change', function(e) {
      const files = Array.from(e.target.files);
      if (files.length > 0) {
        files.forEach(file => {
          handleCleaningItemImageFileUpload(file, sectionId, imageContentId, category);
        });
      }
      // イベントリスナーを削除してから要素を削除
      input.removeEventListener('change', arguments.callee);
      if (input.parentNode) {
        document.body.removeChild(input);
      }
    });
    
    document.body.appendChild(input);
    // 少し遅延させてからクリック（モーダルが完全に閉じた後に実行）
    setTimeout(() => {
      input.click();
    }, 100);
  }
  
  // カメラで撮影
  function openCleaningItemImageCamera(sectionId, imageContentId, category) {
    // ファイル入力を作成（カメラモード）
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // カメラを起動
    input.style.display = 'none';
    
    input.addEventListener('change', function(e) {
      const files = Array.from(e.target.files);
      if (files.length > 0) {
        files.forEach(file => {
          handleCleaningItemImageFileUpload(file, sectionId, imageContentId, category);
        });
      }
      document.body.removeChild(input);
    });
    
    document.body.appendChild(input);
    input.click();
  }
  
  // セクション内画像コンテンツに画像ファイルをアップロード
  async function handleCleaningItemImageFileUpload(file, sectionId, imageContentId, category) {
    const imageList = document.getElementById(`${imageContentId}-${category}`);
    if (!imageList) return;
    
    // 画像を最適化
    const optimizedBlob = await optimizeImage(file);
    const blobUrl = URL.createObjectURL(optimizedBlob);
    
    // 画像IDを生成
    const imageId = `cleaning-item-image-${imageContentId}-${category}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // 画像をストックに追加
    const imageData = {
      id: imageId,
      blobUrl: blobUrl,
      fileName: file.name,
      uploaded: false
    };
    
    // 画像ストックに追加
    if (window.addImagesToStock) {
      await window.addImagesToStock([imageData]);
    }
    
    // 画像を表示
    const imageThumb = document.createElement('div');
    imageThumb.className = 'image-thumb';
    imageThumb.draggable = true;
    imageThumb.dataset.imageUrl = blobUrl;
    imageThumb.dataset.imageId = imageId;
    imageThumb.dataset.category = category;
    imageThumb.dataset.sectionId = sectionId;
    imageThumb.dataset.imageContentId = imageContentId;
    imageThumb.style.cssText = 'width:120px; height:120px; position:relative; border-radius:4px; overflow:hidden; margin:0 auto;';
    
    const img = document.createElement('img');
    img.src = blobUrl;
    img.alt = 'Photo';
    img.draggable = false;
    img.style.cssText = 'width:100%; height:100%; object-fit:cover;';
    
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'image-thumb-remove';
    removeBtn.innerHTML = '<i class="fas fa-times"></i>';
    removeBtn.style.cssText = 'position:absolute; top:4px; right:4px; width:18px; height:18px; background:rgba(255, 103, 156, 0.9); color:#fff; border:none; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.6rem; z-index:10;';
    removeBtn.onclick = function() {
      removeCleaningItemImage(sectionId, imageContentId, category, imageId, imageThumb);
    };
    
    imageThumb.appendChild(img);
    imageThumb.appendChild(removeBtn);
    
    // セクション内画像コンテンツ用のドラッグ&ドロップを設定
    setupCleaningItemImageThumbDragAndDrop(imageThumb, sectionId, imageContentId, category, blobUrl, imageId);
    
    // 追加ボタンの前に挿入
    const addBtn = imageList.querySelector('.cleaning-item-image-add-btn');
    if (addBtn) {
      imageList.insertBefore(imageThumb, addBtn);
    } else {
      imageList.appendChild(imageThumb);
    }
    
    // データに保存
    if (sections[sectionId] && sections[sectionId].imageContents) {
      const imageContent = sections[sectionId].imageContents.find(ic => ic.id === imageContentId);
      if (imageContent) {
        if (!imageContent.photos[category]) {
          imageContent.photos[category] = [];
        }
        const imageData = {
          imageId: imageId,
          blobUrl: blobUrl,
          fileName: file.name,
          uploaded: false
        };
        imageContent.photos[category].push(imageData);
        console.log('[ImageUpload] Image added to section:', {
          sectionId,
          imageContentId,
          category,
          imageData,
          allPhotos: imageContent.photos
        });
        console.log('[ImageUpload] Full section data:', sections[sectionId]);
      } else {
        console.warn('[ImageUpload] ImageContent not found:', imageContentId, 'in section:', sectionId);
      }
    } else {
      console.warn('[ImageUpload] Section or imageContents not found:', {
        sectionId,
        hasSection: !!sections[sectionId],
        hasImageContents: !!(sections[sectionId] && sections[sectionId].imageContents)
      });
    }
    
    // sectionsByTabも更新
    try {
      const activeTab = (typeof currentActiveTab !== 'undefined' && currentActiveTab) ? currentActiveTab : 'new';
      if (sectionsByTab && sectionsByTab[activeTab]) {
        sectionsByTab[activeTab] = { ...sections };
        console.log('[ImageUpload] Updated sectionsByTab for tab (warehouse):', activeTab);
      } else {
        console.warn('[ImageUpload] sectionsByTab not found for tab:', activeTab);
      }
    } catch (error) {
      console.warn('[ImageUpload] Error updating sectionsByTab:', error);
      // エラーが発生しても処理を続行
    }
    
    autoSave();
  }
  
  // AWS画像倉庫からセクション内画像コンテンツに画像を追加
  async function addImageToCleaningItemFromWarehouse(sectionId, imageContentId, category, imageId, imageUrl) {
    const imageList = document.getElementById(`${imageContentId}-${category}`);
    if (!imageList) return;
    
    // 画像を表示
    const imageThumb = document.createElement('div');
    imageThumb.className = 'image-thumb';
    imageThumb.draggable = true;
    imageThumb.dataset.imageUrl = imageUrl;
    imageThumb.dataset.imageId = imageId;
    imageThumb.dataset.category = category;
    imageThumb.dataset.sectionId = sectionId;
    imageThumb.dataset.imageContentId = imageContentId;
    imageThumb.style.cssText = 'width:120px; height:120px; position:relative; border-radius:4px; overflow:hidden; margin:0 auto;';
    
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = 'Photo';
    img.draggable = false;
    img.style.cssText = 'width:100%; height:100%; object-fit:cover;';
    
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'image-thumb-remove';
    removeBtn.innerHTML = '<i class="fas fa-times"></i>';
    removeBtn.style.cssText = 'position:absolute; top:4px; right:4px; width:18px; height:18px; background:rgba(255, 103, 156, 0.9); color:#fff; border:none; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.6rem; z-index:10;';
    removeBtn.onclick = function() {
      removeCleaningItemImage(sectionId, imageContentId, category, imageId, imageThumb);
    };
    
    imageThumb.appendChild(img);
    imageThumb.appendChild(removeBtn);
    
    // セクション内画像コンテンツ用のドラッグ&ドロップを設定
    setupCleaningItemImageThumbDragAndDrop(imageThumb, sectionId, imageContentId, category, imageUrl, imageId);
    
    // 追加ボタンの前に挿入
    const addBtn = imageList.querySelector('.cleaning-item-image-add-btn');
    if (addBtn) {
      imageList.insertBefore(imageThumb, addBtn);
    } else {
      imageList.appendChild(imageThumb);
    }
    
    // データに保存
    if (sections[sectionId] && sections[sectionId].imageContents) {
      const imageContent = sections[sectionId].imageContents.find(ic => ic.id === imageContentId);
      if (imageContent) {
        if (!imageContent.photos[category]) {
          imageContent.photos[category] = [];
        }
        const imageData = {
          imageId: imageId,
          blobUrl: imageUrl,
          warehouseUrl: imageUrl,
          fileName: imageId,
          uploaded: true
        };
        imageContent.photos[category].push(imageData);
        console.log('[ImageUpload] Image added to section (warehouse):', {
          sectionId,
          imageContentId,
          category,
          imageData,
          allPhotos: imageContent.photos
        });
      } else {
        console.warn('[ImageUpload] ImageContent not found (warehouse):', imageContentId, 'in section:', sectionId);
      }
    } else {
      console.warn('[ImageUpload] Section or imageContents not found (warehouse):', {
        sectionId,
        hasSection: !!sections[sectionId],
        hasImageContents: !!(sections[sectionId] && sections[sectionId].imageContents)
      });
    }
    
    autoSave();
  }
  
  // セクション内画像コンテンツの画像アップロードを設定（後方互換性のため残す）
  function setupCleaningItemImageUpload(imageContentId, sectionId, imageType = 'before_after') {
    // モーダル方式に変更したため、この関数は不要になったが、後方互換性のため残す
  }
  
  // セクション内画像コンテンツの画像アップロード処理
  async function handleCleaningItemImageUpload(event, sectionId, imageContentId, category) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    const imageList = document.getElementById(`${imageContentId}-${category}`);
    if (!imageList) return;
    
    for (const file of files) {
      // 画像を最適化
      const optimizedBlob = await optimizeImage(file);
      const blobUrl = URL.createObjectURL(optimizedBlob);
      
      // 画像IDを生成
      const imageId = `cleaning-item-image-${imageContentId}-${category}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // 画像をストックに追加
      const imageData = {
        id: imageId,
        blobUrl: blobUrl,
        fileName: file.name,
        uploaded: false
      };
      
      // 画像ストックに追加
      if (window.addImagesToStock) {
        await window.addImagesToStock([imageData]);
      }
      
      // 画像を表示
      const imageThumb = document.createElement('div');
      imageThumb.className = 'image-thumb';
      imageThumb.draggable = true;
      imageThumb.dataset.imageUrl = blobUrl;
      imageThumb.dataset.imageId = imageId;
      imageThumb.dataset.category = category;
      imageThumb.style.cssText = 'width:120px; height:120px; position:relative; border-radius:4px; overflow:hidden; margin:0 auto;';
      
      const img = document.createElement('img');
      img.src = blobUrl;
      img.alt = 'Photo';
      img.draggable = false;
      img.style.cssText = 'width:100%; height:100%; object-fit:cover;';
      
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'image-thumb-remove';
      removeBtn.innerHTML = '<i class="fas fa-times"></i>';
      removeBtn.style.cssText = 'position:absolute; top:4px; right:4px; width:18px; height:18px; background:rgba(255, 103, 156, 0.9); color:#fff; border:none; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.6rem; z-index:10;';
      removeBtn.onclick = function() {
        removeCleaningItemImage(sectionId, imageContentId, category, imageId, imageThumb);
      };
      
      imageThumb.appendChild(img);
      imageThumb.appendChild(removeBtn);
      
      // セクション内画像コンテンツ用のドラッグ&ドロップを設定
      imageThumb.dataset.sectionId = sectionId;
      imageThumb.dataset.imageContentId = imageContentId;
      setupCleaningItemImageThumbDragAndDrop(imageThumb, sectionId, imageContentId, category, blobUrl, imageId);
      
      // 追加ボタンの前に挿入
      const addBtn = imageList.querySelector('.image-add-btn');
      if (addBtn) {
        imageList.insertBefore(imageThumb, addBtn);
      } else {
        imageList.appendChild(imageThumb);
      }
      
    // データに保存
    if (sections[sectionId] && sections[sectionId].imageContents) {
      const imageContent = sections[sectionId].imageContents.find(ic => ic.id === imageContentId);
      if (imageContent) {
        if (!imageContent.photos[category]) {
          imageContent.photos[category] = [];
        }
        const imageData = {
          imageId: imageId,
          blobUrl: blobUrl,
          fileName: file.name,
          uploaded: false
        };
        imageContent.photos[category].push(imageData);
        console.log('[ImageUpload] Image added to section (file upload):', {
          sectionId,
          imageContentId,
          category,
          imageData,
          allPhotos: imageContent.photos
        });
      } else {
        console.warn('[ImageUpload] ImageContent not found (file upload):', imageContentId, 'in section:', sectionId);
      }
    } else {
      console.warn('[ImageUpload] Section or imageContents not found (file upload):', {
        sectionId,
        hasSection: !!sections[sectionId],
        hasImageContents: !!(sections[sectionId] && sections[sectionId].imageContents)
      });
    }
    }
    
    autoSave();
  }
  
  // セクション内画像コンテンツの画像を削除
  window.removeCleaningItemImage = function(sectionId, imageContentId, category, imageId, element) {
    if (element) {
      element.remove();
    }
    
    // データから削除
    if (sections[sectionId] && sections[sectionId].imageContents) {
      const imageContent = sections[sectionId].imageContents.find(ic => ic.id === imageContentId);
      if (imageContent && imageContent.photos[category]) {
        imageContent.photos[category] = imageContent.photos[category].filter(img => img.imageId !== imageId);
      }
    }
    
    autoSave();
  };
  
  // セクション内画像コンテンツを削除
  window.deleteCleaningItemImageContent = function(sectionId, imageContentId) {
    const imageContentContainer = document.querySelector(`.cleaning-item-image-content[data-image-content-id="${imageContentId}"]`);
    if (imageContentContainer) {
      imageContentContainer.remove();
    }
    
    // データから削除
    if (sections[sectionId] && sections[sectionId].imageContents) {
      sections[sectionId].imageContents = sections[sectionId].imageContents.filter(ic => ic.id !== imageContentId);
    }
    
    autoSave();
  };

  // 清掃項目セクションにコメントを追加
  window.addCommentToCleaningItem = function(sectionId) {
    // セクションを検索（タブに関係なく検索）
    const sectionBody = document.querySelector(`[data-section-id="${sectionId}"] .section-body`);
    if (!sectionBody) {
      console.warn(`[addCommentToCleaningItem] sectionBody not found for sectionId: ${sectionId}`);
      return;
    }
    
    const insertActions = sectionBody.querySelector('.cleaning-item-insert-actions');
    if (!insertActions) return;
    
    // 新しいコメントフィールドを作成
    const commentId = `cleaning-item-comment-${sectionId}-${Date.now()}`;
    const commentContainer = document.createElement('div');
    commentContainer.className = 'cleaning-item-comment-container';
    commentContainer.dataset.commentId = commentId;
    commentContainer.style.cssText = 'position:relative; margin-top:8px;';
    
    const commentField = document.createElement('textarea');
    commentField.className = 'form-input cleaning-item-comment';
    commentField.placeholder = 'コメントを入力してください';
    commentField.style.cssText = 'margin-top:8px; min-height:80px; resize:vertical; width:100%;';
    commentField.oninput = function() {
      if (sections[sectionId]) {
        if (!sections[sectionId].comments) {
          sections[sectionId].comments = [];
        }
        const commentIndex = sections[sectionId].comments.findIndex(c => c.id === commentId);
        if (commentIndex >= 0) {
          sections[sectionId].comments[commentIndex].value = this.value;
        } else {
          sections[sectionId].comments.push({ id: commentId, value: this.value });
        }
        autoSave();
      }
    };
    
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'cleaning-item-comment-delete';
    deleteBtn.dataset.sectionId = sectionId;
    deleteBtn.dataset.commentId = commentId;
    deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
    deleteBtn.style.cssText = 'position:absolute; top:8px; right:8px; width:24px; height:24px; background:rgba(255, 103, 156, 0.9); color:#fff; border:none; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.7rem; z-index:10;';
    deleteBtn.onclick = function() {
      deleteCleaningItemComment(sectionId, commentId);
    };
    
    commentContainer.appendChild(commentField);
    commentContainer.appendChild(deleteBtn);
    
    // 挿入アクションボタンの前に挿入
    insertActions.parentNode.insertBefore(commentContainer, insertActions);
    
    // データに保存
    if (sections[sectionId]) {
      if (!sections[sectionId].comments) {
        sections[sectionId].comments = [];
      }
      sections[sectionId].comments.push({ id: commentId, value: '' });
    }
    
    autoSave();
  };

  // 清掃項目セクションにサブタイトルを追加
  window.addSubtitleToCleaningItem = function(sectionId) {
    // セクションを検索（タブに関係なく検索）
    const sectionBody = document.querySelector(`[data-section-id="${sectionId}"] .section-body`);
    if (!sectionBody) {
      console.warn(`[addSubtitleToCleaningItem] sectionBody not found for sectionId: ${sectionId}`);
      return;
    }
    
    const insertActions = sectionBody.querySelector('.cleaning-item-insert-actions');
    if (!insertActions) return;
    
    // 新しいサブタイトルフィールドを作成
    const subtitleId = `cleaning-item-subtitle-${sectionId}-${Date.now()}`;
    const subtitleContainer = document.createElement('div');
    subtitleContainer.className = 'cleaning-item-subtitle-container';
    subtitleContainer.dataset.subtitleId = subtitleId;
    subtitleContainer.style.cssText = 'position:relative; margin-top:8px;';
    
    const subtitleField = document.createElement('input');
    subtitleField.type = 'text';
    subtitleField.className = 'form-input cleaning-item-subtitle';
    subtitleField.placeholder = 'サブタイトルを入力';
    subtitleField.style.cssText = 'width:100%; font-weight:600; font-size:1rem;';
    subtitleField.oninput = function() {
      if (sections[sectionId]) {
        if (!sections[sectionId].subtitles) {
          sections[sectionId].subtitles = [];
        }
        const subtitleIndex = sections[sectionId].subtitles.findIndex(s => s.id === subtitleId);
        if (subtitleIndex >= 0) {
          sections[sectionId].subtitles[subtitleIndex].value = this.value;
        } else {
          sections[sectionId].subtitles.push({ id: subtitleId, value: this.value });
        }
        autoSave();
      }
    };
    
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'cleaning-item-subtitle-delete';
    deleteBtn.dataset.sectionId = sectionId;
    deleteBtn.dataset.subtitleId = subtitleId;
    deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
    deleteBtn.style.cssText = 'position:absolute; top:8px; right:8px; width:24px; height:24px; background:rgba(255, 103, 156, 0.9); color:#fff; border:none; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.7rem; z-index:10;';
    deleteBtn.onclick = function() {
      deleteCleaningItemSubtitle(sectionId, subtitleId);
    };
    
    subtitleContainer.appendChild(subtitleField);
    subtitleContainer.appendChild(deleteBtn);
    
    // 挿入アクションボタンの前に挿入
    insertActions.parentNode.insertBefore(subtitleContainer, insertActions);
    
    // データに保存
    if (sections[sectionId]) {
      if (!sections[sectionId].subtitles) {
        sections[sectionId].subtitles = [];
      }
      sections[sectionId].subtitles.push({ id: subtitleId, value: '' });
    }
    
    autoSave();
  };

  // 清掃項目セクションのコメントを更新
  window.updateCleaningItemComment = function(sectionId, commentId, value) {
    if (sections[sectionId]) {
      if (!sections[sectionId].comments) {
        sections[sectionId].comments = [];
      }
      const commentIndex = sections[sectionId].comments.findIndex(c => c.id === commentId);
      if (commentIndex >= 0) {
        sections[sectionId].comments[commentIndex].value = value;
      } else {
        sections[sectionId].comments.push({ id: commentId, value: value });
      }
      autoSave();
    }
  };

  // 清掃項目セクションのコメントを削除
  window.deleteCleaningItemComment = function(sectionId, commentId) {
    if (sections[sectionId] && sections[sectionId].comments) {
      sections[sectionId].comments = sections[sectionId].comments.filter(c => c.id !== commentId);
    }
    // data属性を使用して要素を検索（複数の方法で試行）
    const sectionCard = document.querySelector(`[data-section-id="${sectionId}"]`);
    if (sectionCard) {
      // 方法1: data-comment-id属性で検索
      let commentContainer = sectionCard.querySelector(`.cleaning-item-comment-container[data-comment-id="${commentId}"]`);
      // 方法2: 見つからない場合は、すべてのコンテナを検索してIDを確認
      if (!commentContainer) {
        const containers = sectionCard.querySelectorAll('.cleaning-item-comment-container');
        containers.forEach(container => {
          if (container.dataset.commentId === commentId) {
            commentContainer = container;
          }
        });
      }
      // 方法3: ボタンの親要素を取得
      if (!commentContainer) {
        const deleteBtn = sectionCard.querySelector(`.cleaning-item-comment-delete[data-comment-id="${commentId}"]`);
        if (deleteBtn) {
          commentContainer = deleteBtn.closest('.cleaning-item-comment-container');
        }
      }
      if (commentContainer) {
        commentContainer.remove();
      }
    }
    autoSave();
  };

  // 清掃項目セクションのサブタイトルを更新
  window.updateCleaningItemSubtitle = function(sectionId, subtitleId, value) {
    if (sections[sectionId]) {
      if (!sections[sectionId].subtitles) {
        sections[sectionId].subtitles = [];
      }
      const subtitleIndex = sections[sectionId].subtitles.findIndex(s => s.id === subtitleId);
      if (subtitleIndex >= 0) {
        sections[sectionId].subtitles[subtitleIndex].value = value;
      } else {
        sections[sectionId].subtitles.push({ id: subtitleId, value: value });
      }
      autoSave();
    }
  };

  // 清掃項目セクションのサブタイトルを削除
  window.deleteCleaningItemSubtitle = function(sectionId, subtitleId) {
    if (sections[sectionId] && sections[sectionId].subtitles) {
      sections[sectionId].subtitles = sections[sectionId].subtitles.filter(s => s.id !== subtitleId);
    }
    // data属性を使用して要素を検索（複数の方法で試行）
    const sectionCard = document.querySelector(`[data-section-id="${sectionId}"]`);
    if (sectionCard) {
      // 方法1: data-subtitle-id属性で検索
      let subtitleContainer = sectionCard.querySelector(`.cleaning-item-subtitle-container[data-subtitle-id="${subtitleId}"]`);
      // 方法2: 見つからない場合は、すべてのコンテナを検索してIDを確認
      if (!subtitleContainer) {
        const containers = sectionCard.querySelectorAll('.cleaning-item-subtitle-container');
        containers.forEach(container => {
          if (container.dataset.subtitleId === subtitleId) {
            subtitleContainer = container;
          }
        });
      }
      // 方法3: ボタンの親要素を取得
      if (!subtitleContainer) {
        const deleteBtn = sectionCard.querySelector(`.cleaning-item-subtitle-delete[data-subtitle-id="${subtitleId}"]`);
        if (deleteBtn) {
          subtitleContainer = deleteBtn.closest('.cleaning-item-subtitle-container');
        }
      }
      if (subtitleContainer) {
        subtitleContainer.remove();
      }
    }
    autoSave();
  };

  // セクション内容更新
  window.updateSectionContent = function(sectionId, value) {
    sections[sectionId].content = value;
  };

  // 清掃項目セクションのテキストフィールドを更新
  window.updateCleaningItemTextField = function(sectionId, fieldId, value) {
    if (sections[sectionId]) {
      if (!sections[sectionId].textFields) {
        sections[sectionId].textFields = [];
      }
      const fieldIndex = sections[sectionId].textFields.findIndex(f => f.id === fieldId);
      if (fieldIndex >= 0) {
        sections[sectionId].textFields[fieldIndex].value = value;
      } else {
        sections[sectionId].textFields.push({ id: fieldId, value: value });
      }
      autoSave();
    }
  };

  // 清掃項目セクションのテキストフィールドを削除
  window.deleteCleaningItemTextField = function(sectionId, fieldId) {
    if (sections[sectionId] && sections[sectionId].textFields) {
      sections[sectionId].textFields = sections[sectionId].textFields.filter(f => f.id !== fieldId);
    }
    const fieldContainer = document.querySelector(`[data-section-id="${sectionId}"] .cleaning-item-text-field-container textarea[oninput*="${fieldId}"]`)?.closest('.cleaning-item-text-field-container');
    if (fieldContainer) {
      fieldContainer.remove();
    }
    autoSave();
  };

  // 清掃項目リスト更新
  function updateCleaningItemsList() {
    // items-list-barが削除されたため、この関数は何もしない
    const container = document.getElementById('cleaning-items-list');
    if (!container) {
      return; // 要素が存在しない場合は何もしない
    }
    const items = Object.values(sections)
      .filter(s => s.type === 'cleaning' && s.item_name)
      .map(s => s.item_name);

    if (items.length === 0) {
      container.innerHTML = '<span class="items-list-empty">項目を追加してください</span>';
    } else {
      container.innerHTML = items.map(name => 
        `<span class="items-list-tag">${escapeHtml(name)}</span>`
      ).join('');
    }
  }

  // 画像ダイアログを開く
  window.openImageDialog = function(sectionId, category) {
    currentImageSection = sectionId;
    currentImageCategory = category;
    selectedWarehouseImages = { before: [], after: [], completed: [] };
    renderStockSelection();
    loadWarehouseImages();
    document.getElementById('warehouse-dialog').style.display = 'flex';
  };


  // 画像倉庫読み込み
  async function loadWarehouseImages() {
    const grid = document.getElementById('library-grid');
    const date = document.getElementById('library-date').value;
    const category = document.getElementById('library-category').value;

    grid.innerHTML = '<p class="loading"><i class="fas fa-spinner fa-spin"></i> 読み込み中...</p>';

    try {
      // Lambda関数は 'date' パラメータを期待している
      let url = `${REPORT_API}/staff/report-images?date=${date}`;
      if (category) url += `&category=${category}`;

      console.log('[Warehouse] Loading images:', { date, category, url });

      const response = await fetch(url);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Warehouse] Error response:', response.status, errorText);
        throw new Error(`読み込みに失敗しました (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      console.log('[Warehouse] Received data:', data);
      
      warehouseImages = data.images || [];

      if (warehouseImages.length === 0) {
        grid.innerHTML = '<p style="text-align:center;color:#9ca3af;padding:20px;">画像がありません</p>';
        return;
      }

      grid.innerHTML = warehouseImages.map(img => `
        <div class="library-item" data-url="${img.url}" onclick="toggleLibraryImage(this, '${img.url}')">
          <img src="${img.url}" alt="Image" loading="lazy">
        </div>
      `).join('');

    } catch (error) {
      console.error('[Warehouse] Error loading warehouse:', error);
      grid.innerHTML = `<p style="text-align:center;color:#dc2626;padding:20px;">読み込みに失敗しました<br><small>${error.message}</small></p>`;
    }
  }

  // ライブラリ画像選択切り替え
  window.toggleLibraryImage = function(el, url) {
    el.classList.toggle('selected');
    const arr = selectedWarehouseImages[currentImageCategory];
    const idx = arr.indexOf(url);
    if (idx > -1) {
      arr.splice(idx, 1);
    } else {
      arr.push(url);
    }
  };

  // 選択画像を保存
  function saveSelectedImages() {
    const sectionId = currentImageSection;
    const category = currentImageCategory;
    const images = selectedWarehouseImages[category] || [];

    if (images.length === 0) {
      showWarning('画像を選択してください');
      return;
    }

    // セクションに画像を追加
    if (!sections[sectionId]) {
      // カテゴリに応じて適切なセクションタイプを決定
      if (currentImageCategory === 'completed') {
        sections[sectionId] = { type: 'image', image_type: 'completed', photos: { completed: [] } };
      } else {
        sections[sectionId] = { type: 'image', image_type: 'before_after', photos: { before: [], after: [] } };
      }
    }
    
    // ストック画像の場合は、imageDataオブジェクトとして保存
    images.forEach(blobUrl => {
      const imageData = imageStock.find(img => img.blobUrl === blobUrl);
      if (imageData) {
        // ストック画像の場合、imageDataオブジェクトとして保存
        if (!sections[sectionId].photos[category]) {
          sections[sectionId].photos[category] = [];
        }
        sections[sectionId].photos[category].push({
          imageId: imageData.id,
          blobUrl: imageData.blobUrl,
          fileName: imageData.fileName
        });
      } else {
        // 画像倉庫からの画像の場合、URL文字列として保存
        if (!sections[sectionId].photos[category]) {
          sections[sectionId].photos[category] = [];
        }
        sections[sectionId].photos[category].push(blobUrl);
      }
    });

    // UIに画像を追加
    const container = document.getElementById(`${sectionId}-${category}`);
    const addBtn = container.querySelector('.image-add-btn');

    // デフォルト画像（placeholder）を削除
    const placeholder = container.querySelector('.image-placeholder');
    if (placeholder) {
      placeholder.remove();
    }

    images.forEach(blobUrl => {
      const imageData = imageStock.find(img => img.blobUrl === blobUrl);
      if (imageData) {
        const thumb = createImageThumb(sectionId, category, blobUrl, imageData.id);
        container.insertBefore(thumb, addBtn);
      } else {
        const thumb = createImageThumb(sectionId, category, blobUrl);
        container.insertBefore(thumb, addBtn);
      }
    });
    
    // 画像リストにドラッグ&ドロップを設定
    setupImageListDragAndDrop(container, sectionId, category);

    document.getElementById('warehouse-dialog').style.display = 'none';
  }

  // 画像サムネイルを作成
  function createImageThumb(sectionId, category, url, imageId = null) {
      const thumb = document.createElement('div');
      thumb.className = 'image-thumb';
    thumb.draggable = true;
    thumb.dataset.imageUrl = url;
    thumb.dataset.sectionId = sectionId;
    thumb.dataset.category = category;
    if (imageId) {
      thumb.dataset.imageId = imageId;
    }
      thumb.innerHTML = `
      <img src="${url}" alt="Photo" draggable="false">
      <button type="button" class="image-thumb-remove" onclick="removeImage('${sectionId}', '${category}', '${url}', '${imageId || ''}', this)">
          <i class="fas fa-times"></i>
        </button>
      `;
    
    // 画像サムネイルのドラッグ&ドロップを設定
    setupImageThumbDragAndDrop(thumb, sectionId, category, url, imageId);
    
    return thumb;
  }

  // 画像サムネイルのドラッグ&ドロップ設定
  function setupImageThumbDragAndDrop(thumb, sectionId, category, url, imageId = null) {
    // テキスト選択を防ぐ
    thumb.addEventListener('selectstart', (e) => {
      e.preventDefault();
      return false;
    });

    thumb.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      return false;
    });

    // タッチイベント用の変数
    let touchStartTime = 0;
    let isDragging = false;
    let longPressTimer = null;
    const LONG_PRESS_DURATION = 300;

    // タッチ開始（スマホ用）
    thumb.addEventListener('touchstart', (e) => {
      e.stopPropagation();
      touchStartTime = Date.now();
      isDragging = false;
      thumb.classList.add('touching');

      longPressTimer = setTimeout(() => {
        isDragging = true;
        thumb.classList.add('dragging');
        thumb.classList.remove('touching');
        
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      }, LONG_PRESS_DURATION);
    }, { passive: true });

    // タッチ移動（スマホ用）
    thumb.addEventListener('touchmove', (e) => {
      if (!isDragging) {
        clearTimeout(longPressTimer);
        thumb.classList.remove('touching');
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const touch = e.touches[0];
      const targetList = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.image-list');

      if (targetList) {
        document.querySelectorAll('.image-list').forEach(list => {
          if (list !== targetList) {
            list.classList.remove('drag-over');
          }
        });
        targetList.classList.add('drag-over');
      }
    }, { passive: false });

    // タッチ終了（スマホ用）
    thumb.addEventListener('touchend', (e) => {
      clearTimeout(longPressTimer);
      thumb.classList.remove('touching', 'dragging');

      if (!isDragging) return;

      e.preventDefault();
      e.stopPropagation();

      const touch = e.changedTouches[0];
      const targetList = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.image-list');

      if (targetList && targetList.id) {
        const targetIdParts = targetList.id.split('-');
        const targetSectionId = targetIdParts.slice(0, -1).join('-');
        const targetCategory = targetIdParts[targetIdParts.length - 1];

        if (targetSectionId && targetCategory && (targetSectionId !== sectionId || targetCategory !== category)) {
          moveImage(sectionId, category, url, targetSectionId, targetCategory);
        }
      }

      document.querySelectorAll('.image-list').forEach(list => list.classList.remove('drag-over'));
      isDragging = false;
    }, { passive: false });

    thumb.addEventListener('touchcancel', () => {
      clearTimeout(longPressTimer);
      thumb.classList.remove('touching', 'dragging');
      isDragging = false;
      document.querySelectorAll('.image-list').forEach(list => list.classList.remove('drag-over'));
    });

    // ドラッグ開始（PC用）
    thumb.addEventListener('dragstart', (e) => {
      thumb.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('application/json', JSON.stringify({
        sectionId: sectionId,
        category: category,
        url: url
      }));
    });

    // ドラッグ終了（PC用）
    thumb.addEventListener('dragend', (e) => {
      thumb.classList.remove('dragging');
      document.querySelectorAll('.image-list').forEach(list => list.classList.remove('drag-over'));
    });
  }

  // 画像リストのドラッグ&ドロップ設定
  function setupImageListDragAndDrop(listElement, sectionId, category, imageContentId = null) {
    if (listElement.dataset.dragSetup) return;
    listElement.dataset.dragSetup = 'true';
    
    // セクション内画像コンテンツの場合は専用の処理を使用
    if (imageContentId) {
      setupCleaningItemImageListDragAndDrop(listElement, sectionId, imageContentId, category);
      return;
    }

    // ドラッグオーバー（PC用）
    listElement.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // データを取得（dragoverではgetDataが動作しない場合があるため、effectAllowedで判定）
      const effectAllowed = e.dataTransfer.effectAllowed;
      
      // ストックからのドロップまたは別セクションからの移動
      if (effectAllowed === 'copy' || effectAllowed === 'all') {
        e.dataTransfer.dropEffect = 'copy';
        listElement.classList.add('drag-over');
      } else {
        e.dataTransfer.dropEffect = 'move';
        listElement.classList.add('drag-over');
      }
    });

    // ドラッグリーブ（PC用）
    listElement.addEventListener('dragleave', (e) => {
      if (!listElement.contains(e.relatedTarget)) {
        listElement.classList.remove('drag-over');
      }
    });

    // ドロップ（PC用）
    listElement.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      listElement.classList.remove('drag-over');

      const data = e.dataTransfer.getData('application/json');
      if (!data) return;

      try {
        const dragData = JSON.parse(data);
        
        // ストックからのドロップ
        if (dragData.source === 'stock' && dragData.imageId) {
          const imageData = imageStock.find(img => img.id === dragData.imageId);
          if (imageData) {
            addImageToSectionFromStock(imageData, sectionId, category);
          }
          return;
        }

        // セクション間の移動
        const { sectionId: sourceSectionId, category: sourceCategory, url } = dragData;
        if (sourceSectionId && sourceCategory && url && 
            (sourceSectionId !== sectionId || sourceCategory !== category)) {
          moveImage(sourceSectionId, sourceCategory, url, sectionId, category);
        }
      } catch (e) {
        console.error('Failed to parse drag data:', e);
      }
    });
  }

  // 画像を移動
  function moveImage(sourceSectionId, sourceCategory, url, targetSectionId, targetCategory) {
    // データから削除
    const sourcePhotos = sections[sourceSectionId]?.photos?.[sourceCategory];
    if (!sourcePhotos) return;

    // 画像データを検索（オブジェクト形式または文字列形式に対応）
    let imageData = null;
    let sourceIndex = -1;
    
    for (let i = 0; i < sourcePhotos.length; i++) {
      const photo = sourcePhotos[i];
      if (typeof photo === 'string') {
        if (photo === url) {
          imageData = photo;
          sourceIndex = i;
          break;
        }
      } else if (typeof photo === 'object' && photo.blobUrl) {
        if (photo.blobUrl === url) {
          imageData = photo;
          sourceIndex = i;
          break;
        }
      }
    }
    
    if (sourceIndex === -1 || !imageData) return;

    sourcePhotos.splice(sourceIndex, 1);

    // データに追加
    if (!sections[targetSectionId]) return;
    if (!sections[targetSectionId].photos) {
      // カテゴリに応じて適切な構造を決定
      if (targetCategory === 'completed') {
        sections[targetSectionId].photos = { completed: [] };
      } else {
        sections[targetSectionId].photos = { before: [], after: [] };
      }
    }
    if (!sections[targetSectionId].photos[targetCategory]) {
      sections[targetSectionId].photos[targetCategory] = [];
    }
    // 元のデータ形式を保持（オブジェクト形式または文字列形式）
    sections[targetSectionId].photos[targetCategory].push(imageData);

    // UIから削除
    const sourceThumb = document.querySelector(
      `.image-thumb[data-section-id="${sourceSectionId}"][data-category="${sourceCategory}"][data-image-url="${url}"]`
    );
    if (sourceThumb) {
      sourceThumb.remove();
    }

    // UIに追加
    const targetContainer = document.getElementById(`${targetSectionId}-${targetCategory}`);
    if (!targetContainer) return;

    // デフォルト画像（placeholder）を削除
    const placeholder = targetContainer.querySelector('.image-placeholder');
    if (placeholder) {
      placeholder.remove();
    }
    
    const addBtn = targetContainer.querySelector('.image-add-btn');
    // imageDataがオブジェクト形式の場合はimageIdも渡す
    const imageId = (typeof imageData === 'object' && imageData.imageId) ? imageData.imageId : null;
    const imageUrl = (typeof imageData === 'object' && imageData.blobUrl) ? imageData.blobUrl : imageData;
    const newThumb = createImageThumb(targetSectionId, targetCategory, imageUrl, imageId);
    targetContainer.insertBefore(newThumb, addBtn);

    // ターゲットリストにドラッグ&ドロップを設定（まだ設定されていない場合）
    setupImageListDragAndDrop(targetContainer, targetSectionId, targetCategory);
    
    // 自動保存
    autoSave();
  }
  
  // セクション内画像コンテンツの画像サムネイルにドラッグ&ドロップを設定
  function setupCleaningItemImageThumbDragAndDrop(thumb, sectionId, imageContentId, category, url, imageId) {
    // ドラッグ開始（PC用）
    thumb.addEventListener('dragstart', (e) => {
      thumb.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('application/json', JSON.stringify({
        source: 'cleaning-item-image',
        sectionId: sectionId,
        imageContentId: imageContentId,
        category: category,
        url: url,
        imageId: imageId
      }));
    });
    
    // ドラッグ終了（PC用）
    thumb.addEventListener('dragend', (e) => {
      thumb.classList.remove('dragging');
      document.querySelectorAll('.image-list').forEach(list => list.classList.remove('drag-over'));
    });
    
    // タッチ開始（スマホ用）
    let touchStartTime = 0;
    let isDragging = false;
    let longPressTimer;
    const LONG_PRESS_DURATION = 300;
    
    thumb.addEventListener('touchstart', (e) => {
      e.stopPropagation();
      touchStartTime = Date.now();
      isDragging = false;
      thumb.classList.add('touching');
      
      longPressTimer = setTimeout(() => {
        isDragging = true;
        thumb.classList.add('dragging');
        thumb.classList.remove('touching');
        
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      }, LONG_PRESS_DURATION);
    }, { passive: true });
    
    // タッチ移動（スマホ用）
    thumb.addEventListener('touchmove', (e) => {
      if (!isDragging) {
        clearTimeout(longPressTimer);
        thumb.classList.remove('touching');
        return;
      }
      
      e.preventDefault();
      e.stopPropagation();
      
      const touch = e.touches[0];
      const targetList = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.image-list');
      
      if (targetList) {
        document.querySelectorAll('.image-list').forEach(list => {
          if (list !== targetList) {
            list.classList.remove('drag-over');
          } else {
            list.classList.add('drag-over');
          }
        });
      }
    });
    
    // タッチ終了（スマホ用）
    thumb.addEventListener('touchend', (e) => {
      clearTimeout(longPressTimer);
      thumb.classList.remove('touching', 'dragging');
      
      if (!isDragging) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      const touch = e.changedTouches[0];
      const targetList = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.image-list');
      
      if (targetList && targetList.id) {
        const targetIdParts = targetList.id.split('-');
        const targetImageContentId = targetIdParts.slice(0, -1).join('-');
        const targetCategory = targetIdParts[targetIdParts.length - 1];
        
        // セクション内画像コンテンツ間の移動
        if (targetImageContentId && targetCategory && 
            (targetImageContentId !== imageContentId || targetCategory !== category)) {
          moveCleaningItemImage(sectionId, imageContentId, category, sectionId, targetImageContentId, targetCategory, url, imageId);
        }
      }
      
      document.querySelectorAll('.image-list').forEach(list => list.classList.remove('drag-over'));
      isDragging = false;
    }, { passive: false });
    
    thumb.addEventListener('touchcancel', () => {
      clearTimeout(longPressTimer);
      thumb.classList.remove('touching', 'dragging');
      isDragging = false;
      document.querySelectorAll('.image-list').forEach(list => list.classList.remove('drag-over'));
    });
  }
  
  // セクション内画像コンテンツの画像リストにドラッグ&ドロップを設定
  function setupCleaningItemImageListDragAndDrop(listElement, sectionId, imageContentId, category) {
    // ドラッグオーバー（PC用）
    listElement.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      listElement.classList.add('drag-over');
    });
    
    // ドラッグリーブ（PC用）
    listElement.addEventListener('dragleave', (e) => {
      if (!listElement.contains(e.relatedTarget)) {
        listElement.classList.remove('drag-over');
      }
    });
    
    // ドロップ（PC用）
    listElement.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      listElement.classList.remove('drag-over');
      
      const data = e.dataTransfer.getData('application/json');
      if (!data) return;
      
      try {
        const dragData = JSON.parse(data);
        
        // セクション内画像コンテンツ間の移動
        if (dragData.source === 'cleaning-item-image' && 
            dragData.sectionId && dragData.imageContentId && dragData.category && dragData.url) {
          const { sectionId: sourceSectionId, imageContentId: sourceImageContentId, category: sourceCategory, url, imageId } = dragData;
          
          if ((sourceImageContentId !== imageContentId || sourceCategory !== category)) {
            moveCleaningItemImage(sourceSectionId, sourceImageContentId, sourceCategory, sectionId, imageContentId, category, url, imageId);
          }
        }
      } catch (e) {
        console.error('Failed to parse drag data:', e);
      }
    });
  }
  
  // セクション内画像コンテンツの画像を移動
  function moveCleaningItemImage(sourceSectionId, sourceImageContentId, sourceCategory, targetSectionId, targetImageContentId, targetCategory, url, imageId) {
    // データから削除
    if (!sections[sourceSectionId] || !sections[sourceSectionId].imageContents) return;
    const sourceImageContent = sections[sourceSectionId].imageContents.find(ic => ic.id === sourceImageContentId);
    if (!sourceImageContent || !sourceImageContent.photos[sourceCategory]) return;
    
    const sourcePhotos = sourceImageContent.photos[sourceCategory];
    let imageData = null;
    let sourceIndex = -1;
    
    for (let i = 0; i < sourcePhotos.length; i++) {
      const photo = sourcePhotos[i];
      if (photo.imageId === imageId || photo.blobUrl === url) {
        imageData = photo;
        sourceIndex = i;
        break;
      }
    }
    
    if (sourceIndex === -1 || !imageData) return;
    
    sourcePhotos.splice(sourceIndex, 1);
    
    // データに追加
    if (!sections[targetSectionId] || !sections[targetSectionId].imageContents) return;
    let targetImageContent = sections[targetSectionId].imageContents.find(ic => ic.id === targetImageContentId);
    if (!targetImageContent) return;
    
    if (!targetImageContent.photos[targetCategory]) {
      targetImageContent.photos[targetCategory] = [];
    }
    targetImageContent.photos[targetCategory].push(imageData);
    
    // UIから削除
    const sourceThumb = document.querySelector(
      `.image-thumb[data-image-content-id="${sourceImageContentId}"][data-category="${sourceCategory}"][data-image-url="${url}"]`
    );
    if (sourceThumb) {
      sourceThumb.remove();
    }
    
    // UIに追加
    const targetList = document.getElementById(`${targetImageContentId}-${targetCategory}`);
    if (!targetList) return;
    
    const addBtn = targetList.querySelector('.image-add-btn');
    const newThumb = document.createElement('div');
    newThumb.className = 'image-thumb';
    newThumb.draggable = true;
    newThumb.dataset.imageUrl = url;
    newThumb.dataset.imageId = imageId;
    newThumb.dataset.category = targetCategory;
    newThumb.dataset.sectionId = targetSectionId;
    newThumb.dataset.imageContentId = targetImageContentId;
    newThumb.style.cssText = 'width:120px; height:120px; position:relative; border-radius:4px; overflow:hidden; margin:0 auto;';
    
    const img = document.createElement('img');
    img.src = url;
    img.alt = 'Photo';
    img.draggable = false;
    img.style.cssText = 'width:100%; height:100%; object-fit:cover;';
    
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'image-thumb-remove';
    removeBtn.innerHTML = '<i class="fas fa-times"></i>';
    removeBtn.style.cssText = 'position:absolute; top:4px; right:4px; width:18px; height:18px; background:rgba(255, 103, 156, 0.9); color:#fff; border:none; border-radius:50%; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.6rem; z-index:10;';
    removeBtn.onclick = function() {
      removeCleaningItemImage(targetSectionId, targetImageContentId, targetCategory, imageId, newThumb);
    };
    
    newThumb.appendChild(img);
    newThumb.appendChild(removeBtn);
    
    // ドラッグ&ドロップを設定
    setupCleaningItemImageThumbDragAndDrop(newThumb, targetSectionId, targetImageContentId, targetCategory, url, imageId);
    
    if (addBtn) {
      targetList.insertBefore(newThumb, addBtn);
    } else {
      targetList.appendChild(newThumb);
    }
    
    // 自動保存
    autoSave();
  }

  // セクション内画像コンテンツから画像を削除
  window.removeImageFromSection = function(imageContentId, category, imageId) {
    const imageList = document.getElementById(`${imageContentId}-${category}`);
    if (!imageList) return;
    
    const imageThumb = imageList.querySelector(`.image-thumb[data-image-id="${imageId}"]`);
    if (imageThumb) {
      imageThumb.remove();
    }
    
    // セクションデータからも削除
    const sectionId = imageList.closest('.section')?.dataset?.sectionId;
    if (sectionId && sections[sectionId]) {
      const section = sections[sectionId];
      if (section.images && section.images[category]) {
        section.images[category] = section.images[category].filter(img => img.id !== imageId);
      }
    }
    
    // 画像がなくなった場合、デフォルト画像を表示
    const remainingImages = imageList.querySelectorAll('.image-thumb');
    if (remainingImages.length === 0) {
      const addBtn = imageList.querySelector('.image-add-btn');
      if (addBtn && !imageList.querySelector('.image-placeholder')) {
        const placeholderDiv = document.createElement('div');
        placeholderDiv.className = 'image-placeholder';
        placeholderDiv.innerHTML = `<img src="${DEFAULT_NO_PHOTO_IMAGE}" alt="写真を撮り忘れました" class="default-no-photo-image">`;
        imageList.insertBefore(placeholderDiv, addBtn);
      }
    }
    
    // 自動保存
    autoSave();
  };

  // 画像削除
  window.removeImage = function(sectionId, category, url, imageId, btn) {
    const arr = sections[sectionId].photos[category];
    if (imageId) {
      // 画像データオブジェクトの場合
      const idx = arr.findIndex(img => 
        (typeof img === 'object' && img.imageId === imageId) || 
        (typeof img === 'string' && img === imageId)
      );
    if (idx > -1) arr.splice(idx, 1);
    } else {
      // URL文字列の場合
      const idx = arr.findIndex(img => 
        (typeof img === 'string' && img === url) ||
        (typeof img === 'object' && img.blobUrl === url)
      );
      if (idx > -1) arr.splice(idx, 1);
    }
    btn.closest('.image-thumb').remove();
    
    // 画像がなくなった場合、デフォルト画像を表示
    const container = document.getElementById(`${sectionId}-${category}`);
    if (container && arr.length === 0) {
      const placeholder = container.querySelector('.image-placeholder');
      if (!placeholder) {
        const addBtn = container.querySelector('.image-add-btn');
        const placeholderDiv = document.createElement('div');
        placeholderDiv.className = 'image-placeholder';
        placeholderDiv.innerHTML = `<img src="${DEFAULT_NO_PHOTO_IMAGE}" alt="写真を撮り忘れました" class="default-no-photo-image">`;
        container.insertBefore(placeholderDiv, addBtn);
      }
    }
  };

  // フォーム送信
  async function handleSubmit(e) {
    e.preventDefault();

    // 送信されたフォームを取得（新規作成タブまたは次回ご提案タブ）
    const form = e.target;
    const reportId = form.dataset.reportId; // 編集モードかどうか
    const isEditMode = !!reportId;

    const storeId = document.getElementById('report-store').value;
    // 店舗名は、直接入力された場合は入力欄から、選択された場合はhiddenフィールドから取得
    const storeNameInput = document.getElementById('report-store-search')?.value.trim() || '';
    const storeNameHidden = document.getElementById('report-store-name')?.value || '';
    const storeName = storeNameInput || storeNameHidden;
    const brandId = document.getElementById('report-brand')?.value || '';
    // ブランド名は、直接入力された場合は入力欄から、選択された場合はhiddenフィールドから取得
    const brandNameInput = document.getElementById('report-brand-search')?.value.trim() || '';
    const brandNameHidden = document.getElementById('report-brand-name')?.value || '';
    const brandName = brandNameInput || brandNameHidden;
    const cleaningDate = document.getElementById('report-date').value;

    if (!storeId) {
      showError('店舗を選択してください');
      return;
    }

    if (!brandName) {
      showError('ブランド名を入力してください');
      return;
    }

    if (!cleaningDate) {
      showError('清掃日を入力してください');
      return;
    }

    // アップロードが必要な画像の総数をカウント（先にカウント）
    let totalImagesToUpload = 0;
    let uploadedImagesCount = 0;
    
    Object.values(sections).forEach(s => {
      if (s.type === 'image') {
        const imageType = s.image_type || 'before_after';
        if (imageType === 'completed') {
          totalImagesToUpload += (s.photos?.completed || []).filter(img => 
            typeof img === 'object' && img.imageId && !(img.uploaded && (img.url || img.warehouseUrl))
          ).length;
        } else {
          totalImagesToUpload += (s.photos?.before || []).filter(img => 
            typeof img === 'object' && img.imageId && !(img.uploaded && (img.url || img.warehouseUrl))
          ).length;
          totalImagesToUpload += (s.photos?.after || []).filter(img => 
            typeof img === 'object' && img.imageId && !(img.uploaded && (img.url || img.warehouseUrl))
          ).length;
        }
      } else if (s.type === 'cleaning' && s.imageContents) {
        // cleaningセクション内のimageContentsから画像をカウント
        s.imageContents.forEach(imageContent => {
          const imageType = imageContent.imageType || 'before_after';
          if (imageType === 'completed') {
            totalImagesToUpload += (imageContent.photos?.completed || []).filter(img => 
              typeof img === 'object' && img.imageId && !(img.uploaded && (img.url || img.warehouseUrl))
            ).length;
          } else {
            totalImagesToUpload += (imageContent.photos?.before || []).filter(img => 
              typeof img === 'object' && img.imageId && !(img.uploaded && (img.url || img.warehouseUrl))
            ).length;
            totalImagesToUpload += (imageContent.photos?.after || []).filter(img => 
              typeof img === 'object' && img.imageId && !(img.uploaded && (img.url || img.warehouseUrl))
            ).length;
          }
        });
      }
    });
    
    console.log('[Submit] Total images to upload:', totalImagesToUpload);
    
    // 画像アップロード進捗表示を開始
    if (totalImagesToUpload > 0) {
      showUploadProgress(0, totalImagesToUpload, '画像をアップロードしています...');
    }
    
    // 進捗コールバック関数（グローバルカウンターを使用）
    const updateProgress = () => {
      uploadedImagesCount++;
      if (totalImagesToUpload > 0) {
        showUploadProgress(uploadedImagesCount, totalImagesToUpload, '画像をアップロードしています...');
      }
    };

    // 清掃項目を収集（画像もアップロード）
    const workItems = await Promise.all(
      Object.values(sections)
      .filter(s => s.type === 'cleaning' && s.item_name)
        .map(async (s) => {
        // item_nameからitem_idを生成（スラッグ化）
        const itemId = s.item_name.toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^\w\-]+/g, '')
          .replace(/\-\-+/g, '-')
          .replace(/^-+/, '')
          .replace(/-+$/, '');
        
          // imageContentsから画像をアップロード
          const photos = { before: [], after: [] };
          if (s.imageContents && Array.isArray(s.imageContents)) {
            for (const imageContent of s.imageContents) {
              const imageType = imageContent.imageType || 'before_after';
              if (imageType === 'completed') {
                const uploaded = await uploadSectionImages(imageContent.photos?.completed || [], cleaningDate, 'completed', updateProgress);
                photos.after = photos.after.concat(uploaded.filter(Boolean));
              } else {
                const beforeUploaded = await uploadSectionImages(imageContent.photos?.before || [], cleaningDate, 'before', updateProgress);
                const afterUploaded = await uploadSectionImages(imageContent.photos?.after || [], cleaningDate, 'after', updateProgress);
                photos.before = photos.before.concat(beforeUploaded.filter(Boolean));
                photos.after = photos.after.concat(afterUploaded.filter(Boolean));
              }
            }
          }
          
        return {
          item_id: itemId,
          item_name: s.item_name,
          details: {},
            photos: photos
        };
        })
    );

    // セクションを収集（画像をアップロード）
    const sectionData = await Promise.all(
      Object.entries(sections)
      .filter(([_, s]) => s.type !== 'cleaning')
        .map(async ([id, s]) => {
        if (s.type === 'image') {
            // 画像セクションの場合、ローカル画像をS3にアップロード
            const imageType = s.image_type || 'before_after';
            const uploadedPhotos = {};
            
            if (imageType === 'completed') {
              uploadedPhotos.completed = await uploadSectionImages(s.photos?.completed || [], cleaningDate, 'completed', updateProgress);
            } else {
              uploadedPhotos.before = await uploadSectionImages(s.photos?.before || [], cleaningDate, 'before', updateProgress);
              uploadedPhotos.after = await uploadSectionImages(s.photos?.after || [], cleaningDate, 'after', updateProgress);
            }
            
          return {
            section_id: id,
            section_type: 'image',
              image_type: imageType,
              photos: uploadedPhotos
          };
        } else if (s.type === 'comment') {
          return {
            section_id: id,
            section_type: 'comment',
            content: s.content
          };
        } else if (s.type === 'work_content') {
          return {
            section_id: id,
            section_type: 'work_content',
            content: s.content
          };
        }
        return null;
      })
    );
    const validSectionData = sectionData.filter(Boolean);
    
    // 画像アップロード進捗表示を閉じる
    if (totalImagesToUpload > 0) {
      hideUploadProgress();
    }

    const reportData = {
      store_id: storeId,
      store_name: storeName,
      brand_id: brandId,
      brand_name: brandName,
      cleaning_date: cleaningDate,
      cleaning_start_time: document.getElementById('report-start').value || '',
      cleaning_end_time: document.getElementById('report-end').value || '',
      work_items: workItems,
      sections: validSectionData,
      status: 'pending' // 清掃員からの提出は「保留」状態
    };

    console.log('[Submit] Report data:', reportData);

    try {
      // 送信ボタンを取得（新規作成タブまたは次回ご提案タブ）
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 送信中...';
      }

      const idToken = await getFirebaseIdToken();

      // 編集モードの場合はPUT、新規作成の場合はPOST
      const url = isEditMode 
        ? `${REPORT_API}/staff/reports/${reportId}`
        : `${REPORT_API}/staff/reports`;
      const method = isEditMode ? 'PUT' : 'POST';
      
      // 編集モードの場合はstatusをpendingに戻す
      if (isEditMode) {
        reportData.status = 'pending';
      }

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(reportData)
      });

      if (!response.ok) {
        let errorMessage = `送信に失敗しました (${response.status})`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
          console.error('[Submit] Error response:', errorData);
        } catch (e) {
          const errorText = await response.text();
          console.error('[Submit] Error response text:', errorText);
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('[Submit] Success:', result);
      showSuccess(isEditMode ? 'レポートを修正しました！' : 'レポートを提出しました！');
      
      // 管理画面側のレポート作成画面かどうかを判定
      const isAdminPage = window.location.pathname.includes('/admin/reports/new-pc') || 
                         window.location.pathname.includes('/admin/reports/new');
      
      // 編集モードの場合はフォームをリセット
      if (isEditMode) {
        form.dataset.reportId = '';
        form.reset();
        sections = {};
        sectionCounter = 0;
        document.getElementById('report-content').innerHTML = '';
        updateCleaningItemsList();
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> レポートを提出';
        }
        // 修正タブに切り替えて一覧を更新
        document.getElementById('tab-edit').click();
      } else {
        // 管理画面側の場合はウィンドウを閉じる（新規ウィンドウで開かれている場合）
        if (isAdminPage) {
          // 親ウィンドウのレポート一覧を更新（存在する場合）
          if (window.opener && typeof window.opener.loadReports === 'function') {
            window.opener.loadReports();
          }
          // 少し待ってからウィンドウを閉じる（成功メッセージを表示するため）
          setTimeout(() => {
            window.close();
          }, 1500);
        } else {
          // 清掃員側の場合はダッシュボードにリダイレクト
        window.location.href = '/staff/dashboard';
        }
      }

    } catch (error) {
      console.error('[Submit] Error:', error);
      console.error('[Submit] Report data that failed:', reportData);
      showError('送信に失敗しました: ' + getErrorMessage(error));
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> レポートを提出';
      }
    }
  }

  // IDトークン取得（Cognito/localStorageから取得）
  async function getFirebaseIdToken() {
    try {
      // 1. Cognito ID Token（最優先）
      const cognitoIdToken = localStorage.getItem('cognito_id_token');
      if (cognitoIdToken) {
        return cognitoIdToken;
      }
      
      // 2. Cognito認証のユーザーオブジェクトからトークンを取得
      const cognitoUser = localStorage.getItem('cognito_user');
      if (cognitoUser) {
        try {
          const parsed = JSON.parse(cognitoUser);
          if (parsed.tokens && parsed.tokens.idToken) {
            return parsed.tokens.idToken;
          }
          if (parsed.idToken) {
            return parsed.idToken;
          }
        } catch (e) {
          console.warn('Error parsing cognito user:', e);
        }
      }
      
      // 3. CognitoAuthから取得
      if (window.CognitoAuth && window.CognitoAuth.isAuthenticated && window.CognitoAuth.isAuthenticated()) {
        try {
          const cognitoUser = await window.CognitoAuth.getCurrentUser();
          if (cognitoUser && cognitoUser.tokens && cognitoUser.tokens.idToken) {
            return cognitoUser.tokens.idToken;
          }
        } catch (e) {
          console.warn('Error getting token from CognitoAuth:', e);
        }
      }
      
      // 4. misesapo_auth から取得（フォールバック）
      const authData = localStorage.getItem('misesapo_auth');
      if (authData) {
        try {
          const parsed = JSON.parse(authData);
          if (parsed.token) {
            return parsed.token;
          }
        } catch (e) {
          console.warn('Error parsing auth data:', e);
        }
      }
      
      // 5. 開発環境用のフォールバック
      console.warn('No authentication token found, using dev-token');
      return 'dev-token';
    } catch (error) {
      console.error('Error getting ID token:', error);
    return 'dev-token';
    }
  }

  // 画像アップロード進捗表示用の関数
  function showUploadProgress(current, total, message = '画像をアップロードしています...') {
    let progressToast = document.getElementById('upload-progress-toast');
    if (!progressToast) {
      const container = document.getElementById('toast-container');
      if (!container) return;
      
      progressToast = document.createElement('div');
      progressToast.id = 'upload-progress-toast';
      progressToast.className = 'toast toast-info upload-progress-toast';
      progressToast.innerHTML = `
        <div class="upload-progress-content">
          <i class="fas fa-cloud-upload-alt toast-icon"></i>
          <div class="upload-progress-text">
            <div class="upload-progress-message">${escapeHtml(message)}</div>
            <div class="upload-progress-status">作業完了まで少々お待ちください。</div>
            <div class="upload-progress-bar-container">
              <div class="upload-progress-bar" id="upload-progress-bar"></div>
            </div>
            <div class="upload-progress-percent" id="upload-progress-percent">0%</div>
          </div>
        </div>
      `;
      container.appendChild(progressToast);
    }
    
    const progressBar = document.getElementById('upload-progress-bar');
    const progressPercent = document.getElementById('upload-progress-percent');
    const percent = total > 0 ? Math.round((current / total) * 100) : 0;
    
    if (progressBar) {
      progressBar.style.width = `${percent}%`;
    }
    if (progressPercent) {
      progressPercent.textContent = `${percent}%`;
    }
    
    return progressToast;
  }
  
  // 画像アップロード進捗表示を閉じる
  function hideUploadProgress() {
    const progressToast = document.getElementById('upload-progress-toast');
    if (progressToast) {
      progressToast.classList.add('toast-exit');
      setTimeout(() => {
        if (progressToast.parentNode) {
          progressToast.parentNode.removeChild(progressToast);
        }
      }, 300);
    }
  }

  // セクション内の画像をアップロード（ローカル画像のみ）
  async function uploadSectionImages(images, cleaningDate, category = 'after', onProgress = null) {
    if (!images || images.length === 0) {
      return [];
    }
    
    // 順次処理でアップロード（進捗を正確に追跡するため）
    const uploadedUrls = [];
    for (const img of images) {
        // 既にURLの場合はそのまま返す
        if (typeof img === 'string') {
        uploadedUrls.push(img);
        continue;
        }
        
        // 画像データオブジェクトの場合
      if (typeof img === 'object') {
          // 既にアップロード済みの場合はURLを返す
        if (img.uploaded && (img.url || img.warehouseUrl)) {
          uploadedUrls.push(img.url || img.warehouseUrl);
          continue;
        }
        
        // warehouseUrlがある場合はそのまま使用
        if (img.warehouseUrl) {
          uploadedUrls.push(img.warehouseUrl);
          continue;
        }
        
        // urlプロパティがある場合はそのまま使用
        if (img.url && (img.url.startsWith('http://') || img.url.startsWith('https://'))) {
          uploadedUrls.push(img.url);
          continue;
        }
        
        // imageIdがある場合のみアップロード処理を実行
        if (img.imageId) {
          // ローカル画像をS3にアップロード
          try {
            const imageData = imageStock.find(stock => stock.id === img.imageId);
            if (!imageData) {
              console.warn(`[uploadSectionImages] Image not found in stock: ${img.imageId}`);
              // warehouseUrlがあればそれを使用
              if (img.warehouseUrl) {
                uploadedUrls.push(img.warehouseUrl);
              }
              continue;
            }
            
            let blob;
            // blobDataが存在する場合はそれを使用、なければblobUrlから取得
            if (imageData.blobData) {
              blob = new Blob([imageData.blobData], { type: imageData.fileType || 'image/jpeg' });
            } else if (imageData.blobUrl) {
              // blobUrlからBlobを取得
              const response = await fetch(imageData.blobUrl);
              blob = await response.blob();
            } else if (img.blobUrl) {
              // セクション内のblobUrlから取得
              const response = await fetch(img.blobUrl);
              blob = await response.blob();
            } else {
              console.warn(`[uploadSectionImages] No blob data or blobUrl found for image: ${img.imageId}`);
              // warehouseUrlがあればそれを使用
              if (img.warehouseUrl || imageData.warehouseUrl) {
                uploadedUrls.push(img.warehouseUrl || imageData.warehouseUrl);
              }
              continue;
            }
            
            // Base64に変換
            const base64 = await blobToBase64(blob);
            
            // categoryが'completed'の場合は'after'として扱う（APIの制約）
            const apiCategory = category === 'completed' ? 'after' : category;
            
            // S3にアップロード
            const requestBody = {
              image: base64,
              category: apiCategory,
              cleaning_date: cleaningDate
            };
            
            console.log('[uploadSectionImages] Uploading image:', {
              imageId: img.imageId,
              base64Length: base64?.length,
              category: apiCategory,
              originalCategory: category,
              cleaning_date: cleaningDate
            });
            
            const response = await fetch(`${REPORT_API}/staff/report-images`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${await getFirebaseIdToken()}`
              },
              body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
              let errorText;
              try {
                errorText = await response.text();
                const errorJson = JSON.parse(errorText);
                console.error('[uploadSectionImages] Upload failed:', {
                  status: response.status,
                  statusText: response.statusText,
                  error: errorJson
                });
              } catch (e) {
                errorText = await response.text();
                console.error('[uploadSectionImages] Upload failed:', {
                  status: response.status,
                  statusText: response.statusText,
                  errorText: errorText
                });
              }
              throw new Error(`Upload failed: ${response.status} - ${errorText}`);
            }
            
            const result = await response.json();
            const uploadedUrl = result.image?.url || result.url || null;
            console.log('[uploadSectionImages] Image uploaded successfully:', uploadedUrl);
            
            // 進捗を更新
            if (onProgress) {
              onProgress();
            }
            
            if (uploadedUrl) {
              uploadedUrls.push(uploadedUrl);
            }
          } catch (error) {
            console.error('[uploadSectionImages] Error uploading image:', error);
            // エラー時もwarehouseUrlがあればそれを使用
            if (img.warehouseUrl) {
              uploadedUrls.push(img.warehouseUrl);
            }
          }
        } else if (img.blobUrl) {
          // imageIdがないがblobUrlがある場合、blobUrlからアップロード
          try {
            const response = await fetch(img.blobUrl);
            const blob = await response.blob();
            const base64 = await blobToBase64(blob);
            
            const apiCategory = category === 'completed' ? 'after' : category;
            const requestBody = {
              image: base64,
              category: apiCategory,
              cleaning_date: cleaningDate
            };
            
            const uploadResponse = await fetch(`${REPORT_API}/staff/report-images`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${await getFirebaseIdToken()}`
              },
              body: JSON.stringify(requestBody)
            });
            
            if (uploadResponse.ok) {
              const result = await uploadResponse.json();
              const uploadedUrl = result.image?.url || result.url || null;
              if (uploadedUrl) {
                uploadedUrls.push(uploadedUrl);
                if (onProgress) {
                  onProgress();
                }
              }
            } else {
              console.warn('[uploadSectionImages] Failed to upload from blobUrl:', img.blobUrl);
            }
          } catch (error) {
            console.error('[uploadSectionImages] Error uploading from blobUrl:', error);
          }
        }
      }
    }
    
    // nullを除外
    return uploadedUrls.filter(url => url !== null && url !== undefined);
  }

  // BlobをBase64に変換（data:image/jpeg;base64,プレフィックスを除去）
  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        // data:image/jpeg;base64,プレフィックスを除去
        const base64 = dataUrl.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Base64変換
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // HTMLエスケープ
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // トースト通知システム
  function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icons = {
      success: 'fa-check-circle',
      error: 'fa-exclamation-circle',
      warning: 'fa-exclamation-triangle',
      info: 'fa-info-circle'
    };

    toast.innerHTML = `
      <i class="fas ${icons[type] || icons.info} toast-icon"></i>
      <span class="toast-message">${escapeHtml(message)}</span>
      <button type="button" class="toast-close" aria-label="閉じる">
        <i class="fas fa-times"></i>
      </button>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    const closeToast = () => {
      toast.classList.add('toast-exit');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    };

    closeBtn.addEventListener('click', closeToast);
    container.appendChild(toast);

    // 自動で閉じる
    if (duration > 0) {
      setTimeout(closeToast, duration);
    }

    return toast;
  }

  // 成功メッセージ
  function showSuccess(message, duration = 3000) {
    return showToast(message, 'success', duration);
  }

  // エラーメッセージ
  function showError(message, duration = 5000) {
    return showToast(message, 'error', duration);
  }

  // 警告メッセージ
  function showWarning(message, duration = 4000) {
    return showToast(message, 'warning', duration);
  }

  // 情報メッセージ
  function showInfo(message, duration = 3000) {
    return showToast(message, 'info', duration);
  }

  // カスタム確認ダイアログ
  function showConfirm(title, message, options = {}) {
    return new Promise((resolve) => {
      const dialog = document.getElementById('confirm-dialog');
      const titleEl = document.getElementById('confirm-dialog-title');
      const messageEl = document.getElementById('confirm-dialog-message');
      const okBtn = document.getElementById('confirm-dialog-ok');
      const cancelBtn = document.getElementById('confirm-dialog-cancel');

      if (!dialog || !titleEl || !messageEl || !okBtn || !cancelBtn) {
        // フォールバック: ネイティブconfirmを使用
        resolve(confirm(message));
        return;
      }

      titleEl.textContent = title || '確認';
      messageEl.textContent = message;
      
      const okText = options.okText || 'OK';
      const cancelText = options.cancelText || 'キャンセル';
      okBtn.textContent = okText;
      cancelBtn.textContent = cancelText;

      // 既存のイベントリスナーを削除
      const newOkBtn = okBtn.cloneNode(true);
      const newCancelBtn = cancelBtn.cloneNode(true);
      okBtn.parentNode.replaceChild(newOkBtn, okBtn);
      cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

      const closeDialog = (result) => {
        dialog.style.display = 'none';
        resolve(result);
      };

      newOkBtn.addEventListener('click', () => closeDialog(true));
      newCancelBtn.addEventListener('click', () => closeDialog(false));

      // オーバーレイクリックで閉じる（オプション）
      if (options.closeOnOverlay !== false) {
        dialog.addEventListener('click', (e) => {
          if (e.target === dialog) {
            closeDialog(false);
          }
        });
      }

      // ESCキーで閉じる
      const handleEsc = (e) => {
        if (e.key === 'Escape') {
          closeDialog(false);
          document.removeEventListener('keydown', handleEsc);
        }
      };
      document.addEventListener('keydown', handleEsc);

      dialog.style.display = 'flex';
    });
  }

  // エラーメッセージを日本語化
  function getErrorMessage(error) {
    if (!error) return 'エラーが発生しました';
    
    const errorMessage = error.message || error.toString();
    
    // ネットワークエラー
    if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
      return 'ネットワークエラーが発生しました。接続を確認してください。';
    }
    
    // タイムアウトエラー
    if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
      return 'リクエストがタイムアウトしました。しばらく待ってから再度お試しください。';
    }
    
    // 認証エラー
    if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
      return '認証に失敗しました。再度ログインしてください。';
    }
    
    // 権限エラー
    if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
      return 'この操作を実行する権限がありません。';
    }
    
    // サーバーエラー
    if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
      return 'サーバーエラーが発生しました。しばらく待ってから再度お試しください。';
    }
    
    // その他のエラー
    return errorMessage || 'エラーが発生しました';
  }

  // レポートを一時保存してプレビュー用データを準備（画像もアップロード）
  async function saveReportForPreview() {
    const cleaningDate = document.getElementById('report-date')?.value || '';
    
    // アップロードが必要な画像の総数をカウント
    let totalImagesToUpload = 0;
    let uploadedImagesCount = 0;
    
    Object.values(sections).forEach(s => {
      if (s.type === 'image') {
        const imageType = s.image_type || 'before_after';
        if (imageType === 'completed') {
          totalImagesToUpload += (s.photos?.completed || []).filter(img => 
            typeof img === 'object' && img.imageId && !(img.uploaded && (img.url || img.warehouseUrl))
          ).length;
        } else {
          totalImagesToUpload += (s.photos?.before || []).filter(img => 
            typeof img === 'object' && img.imageId && !(img.uploaded && (img.url || img.warehouseUrl))
          ).length;
          totalImagesToUpload += (s.photos?.after || []).filter(img => 
            typeof img === 'object' && img.imageId && !(img.uploaded && (img.url || img.warehouseUrl))
          ).length;
        }
      } else if (s.type === 'cleaning' && s.imageContents) {
        // cleaningセクション内のimageContentsから画像をカウント
        s.imageContents.forEach(imageContent => {
          const imageType = imageContent.imageType || 'before_after';
          if (imageType === 'completed') {
            totalImagesToUpload += (imageContent.photos?.completed || []).filter(img => 
              typeof img === 'object' && img.imageId && !(img.uploaded && (img.url || img.warehouseUrl))
            ).length;
          } else {
            totalImagesToUpload += (imageContent.photos?.before || []).filter(img => 
              typeof img === 'object' && img.imageId && !(img.uploaded && (img.url || img.warehouseUrl))
            ).length;
            totalImagesToUpload += (imageContent.photos?.after || []).filter(img => 
              typeof img === 'object' && img.imageId && !(img.uploaded && (img.url || img.warehouseUrl))
            ).length;
          }
        });
      }
    });
    
    console.log('[Preview] Total images to upload:', totalImagesToUpload);
    
    // 画像アップロード進捗表示を開始
    if (totalImagesToUpload > 0) {
      showUploadProgress(0, totalImagesToUpload, '画像をアップロードしています...');
    }
    
    // 進捗コールバック関数（グローバルカウンターを使用）
    const updateProgress = () => {
      uploadedImagesCount++;
      if (totalImagesToUpload > 0) {
        showUploadProgress(uploadedImagesCount, totalImagesToUpload, '画像をアップロードしています...');
      }
    };
    
    // 画像をアップロードしてからプレビュー用データを準備
    const previewSections = {};
    for (const [id, s] of Object.entries(sections)) {
      if (s.type === 'image') {
        const imageType = s.image_type || 'before_after';
        const uploadedPhotos = {};
        
        // 画像データを正規化（オブジェクト形式の場合はURLを抽出）
        const normalizeImages = (images) => {
          if (!images || !Array.isArray(images)) return [];
          return images.map(img => {
            if (typeof img === 'string') return img;
            if (typeof img === 'object') {
              // 既にURLがある場合はそれを使用
              if (img.url && (img.url.startsWith('http://') || img.url.startsWith('https://'))) {
                return img.url;
              }
              if (img.warehouseUrl) return img.warehouseUrl;
              // blobUrlがある場合はオブジェクトのまま返す（uploadSectionImagesで処理）
              if (img.blobUrl) return img;
              // imageIdがある場合はオブジェクトのまま返す
              if (img.imageId) return img;
            }
            return img;
          });
        };
        
        if (imageType === 'completed') {
          uploadedPhotos.completed = await uploadSectionImages(normalizeImages(s.photos?.completed), cleaningDate, 'completed', updateProgress);
        } else {
          uploadedPhotos.before = await uploadSectionImages(normalizeImages(s.photos?.before), cleaningDate, 'before', updateProgress);
          uploadedPhotos.after = await uploadSectionImages(normalizeImages(s.photos?.after), cleaningDate, 'after', updateProgress);
        }
        
        previewSections[id] = {
          ...s,
          photos: uploadedPhotos
        };
      } else if (s.type === 'cleaning' && s.imageContents) {
        // cleaningセクション内のimageContentsの画像もアップロード
        const uploadedImageContents = await Promise.all(
          (s.imageContents || []).map(async (imageContent) => {
            const imageType = imageContent.imageType || 'before_after';
            const uploadedPhotos = {};
            
            const normalizeImages = (images) => {
              if (!images || !Array.isArray(images)) return [];
              return images.map(img => {
                if (typeof img === 'string') return img;
                if (typeof img === 'object') {
                  if (img.url && (img.url.startsWith('http://') || img.url.startsWith('https://'))) {
                    return img.url;
                  }
                  if (img.warehouseUrl) return img.warehouseUrl;
                  if (img.blobUrl) return img;
                  if (img.imageId) return img;
                }
                return img;
              });
            };
            
            if (imageType === 'completed') {
              uploadedPhotos.completed = await uploadSectionImages(normalizeImages(imageContent.photos?.completed), cleaningDate, 'completed', updateProgress);
            } else {
              uploadedPhotos.before = await uploadSectionImages(normalizeImages(imageContent.photos?.before), cleaningDate, 'before', updateProgress);
              uploadedPhotos.after = await uploadSectionImages(normalizeImages(imageContent.photos?.after), cleaningDate, 'after', updateProgress);
            }
            
            return {
              ...imageContent,
              photos: uploadedPhotos
            };
          })
        );
        
        previewSections[id] = {
          ...s,
          imageContents: uploadedImageContents
        };
      } else {
        previewSections[id] = { ...s };
      }
    }
    
    // 画像アップロード進捗表示を閉じる
    if (totalImagesToUpload > 0) {
      hideUploadProgress();
    }
    
    // 現在のフォームデータを一時保存（localStorageに保存）
    const previewData = {
      brandName: document.getElementById('report-brand-search')?.value || 
                 document.getElementById('report-brand-name')?.value || '',
      storeName: document.getElementById('report-store-search')?.value || 
                 document.getElementById('report-store-name')?.value || '',
      date: cleaningDate,
      startTime: document.getElementById('report-start')?.value || '',
      endTime: document.getElementById('report-end')?.value || '',
      sections: previewSections, // アップロード済み画像を含む
      savedAt: new Date().toISOString()
    };
    
    // localStorageには保存しない（常に最新のsectionsを使用するため）
    // localStorage.setItem('preview_report_data', JSON.stringify(previewData));
    
    // オートセーブも実行（念のため）
    await autoSave();
  }

  // プレビューモーダルを開く（レポートURL発行後の表示形式に合わせる）
  window.openPreviewModal = async function() {
    // 保存確認モーダルが開いていれば確実に閉じる
    const previewSaveDialog = document.getElementById('preview-save-dialog');
    if (previewSaveDialog && previewSaveDialog.open) {
      previewSaveDialog.close();
    }
    
    const previewDialog = document.getElementById('preview-dialog');
    if (!previewDialog) {
      console.warn('[openPreviewModal] preview-dialog element not found');
      return;
    }
    
    // 既にモーダルが開いている場合は何もしない
    const currentDisplay = previewDialog.style.display || window.getComputedStyle(previewDialog).display;
    if (currentDisplay === 'flex' || currentDisplay === 'block' || previewDialog.classList.contains('show')) {
      console.log('[openPreviewModal] Modal is already open, skipping');
      return;
    }
    
    const previewContent = document.getElementById('preview-report-content');
    if (!previewContent) {
      console.warn('[openPreviewModal] preview-report-content element not found');
      return;
    }
    
    // 現在のフォームデータを使用（常に最新のsectionsを使用）
    const brandName = document.getElementById('report-brand-search')?.value || 
                     document.getElementById('report-brand-name')?.value || '';
    const storeName = document.getElementById('report-store-search')?.value || 
                     document.getElementById('report-store-name')?.value || '';
    const date = document.getElementById('report-date')?.value || '';
    const startTime = document.getElementById('report-start')?.value || '';
    const endTime = document.getElementById('report-end')?.value || '';
    
    // 常に現在のsectionsを使用（localStorageではなく、メモリ上の最新データを使用）
    // 現在アクティブなタブのsectionsを使用
    const activeTab = typeof currentActiveTab !== 'undefined' ? currentActiveTab : 'new';
    const savedSections = sectionsByTab[activeTab] || sections;
    console.log('[Preview] Using sections from tab:', activeTab);
    console.log('[Preview] sectionsByTab:', sectionsByTab);
    
    // デバッグ: sectionsの構造を確認
    console.log('[Preview] savedSections:', savedSections);
    console.log('[Preview] sections (current):', sections);
    console.log('[Preview] sections keys:', Object.keys(savedSections));
    Object.keys(savedSections).forEach(sectionId => {
      const section = savedSections[sectionId];
      console.log('[Preview] Section:', sectionId, 'type:', section.type, 'full data:', section);
      if (section.type === 'cleaning') {
        console.log('[Preview] Cleaning section:', sectionId, section);
        if (section.imageContents) {
          console.log('[Preview] imageContents:', section.imageContents);
          section.imageContents.forEach((ic, idx) => {
            console.log('[Preview] imageContent[' + idx + ']:', ic);
            console.log('[Preview] imageContent[' + idx + '] photos:', ic.photos);
          });
        } else {
          console.warn('[Preview] No imageContents in cleaning section:', sectionId);
        }
      }
    });
    
    // レポートデータを準備（report-shared-view.jsのrenderReport関数と同じ形式）
    // item_nameが空でも、画像がある場合はworkItemsに含める
    const workItems = Object.values(savedSections)
      .filter(s => {
        if (s.type !== 'cleaning') return false;
        // item_nameがある場合、または画像がある場合は含める
        const hasItemName = s.item_name && s.item_name.trim() !== '';
        const hasImages = s.imageContents && Array.isArray(s.imageContents) && s.imageContents.length > 0;
        return hasItemName || hasImages;
      })
      .map(s => {
        // imageContentsから画像を収集
        const photos = { before: [], after: [] };
        if (s.imageContents && Array.isArray(s.imageContents)) {
          console.log('[Preview] Processing cleaning section:', s.item_name, 'imageContents:', s.imageContents);
          s.imageContents.forEach(imageContent => {
            const imageType = imageContent.imageType || 'before_after';
            console.log('[Preview] Processing imageContent:', imageContent, 'imageType:', imageType);
            if (imageType === 'completed') {
              // completedの場合はafterに追加
              const completedPhotos = (imageContent.photos?.completed || []).map(img => {
                if (typeof img === 'string') {
                  console.log('[Preview] Completed photo (string):', img);
                  return img;
                }
                if (typeof img === 'object' && img !== null) {
                  const url = img.url || img.warehouseUrl || img.imageUrl || img.blobUrl || '';
                  console.log('[Preview] Completed photo (object):', img, '-> url:', url);
                  return url;
                }
                return '';
              }).filter(Boolean);
              console.log('[Preview] Completed photos:', completedPhotos);
              photos.after = photos.after.concat(completedPhotos);
            } else {
              // before_afterの場合
              const beforePhotos = (imageContent.photos?.before || []).map(img => {
                if (typeof img === 'string') {
                  console.log('[Preview] Before photo (string):', img);
                  return img;
                }
                if (typeof img === 'object' && img !== null) {
                  const url = img.url || img.warehouseUrl || img.imageUrl || img.blobUrl || '';
                  console.log('[Preview] Before photo (object):', img, '-> url:', url);
                  return url;
                }
                return '';
              }).filter(Boolean);
              const afterPhotos = (imageContent.photos?.after || []).map(img => {
                if (typeof img === 'string') {
                  console.log('[Preview] After photo (string):', img);
                  return img;
                }
                if (typeof img === 'object' && img !== null) {
                  const url = img.url || img.warehouseUrl || img.imageUrl || img.blobUrl || '';
                  console.log('[Preview] After photo (object):', img, '-> url:', url);
                  return url;
                }
                return '';
              }).filter(Boolean);
              console.log('[Preview] Before photos:', beforePhotos, 'After photos:', afterPhotos);
              photos.before = photos.before.concat(beforePhotos);
              photos.after = photos.after.concat(afterPhotos);
            }
          });
        }
        
        // item_nameが空の場合はデフォルト名を使用
        const itemName = s.item_name && s.item_name.trim() !== '' ? s.item_name : '清掃項目';
        console.log('[Preview] Final photos for', itemName, ':', photos);
        
        return {
          item_id: itemName.toLowerCase().replace(/\s+/g, '-'),
          item_name: itemName,
          details: {},
          photos: photos
        };
      });
    
    console.log('[Preview] Final workItems:', workItems);
    
    const reportSections = Object.values(savedSections)
      .filter(s => s.type !== 'cleaning')
      .map(section => {
        if (section.type === 'image') {
          return {
            section_type: 'image',
            image_type: section.image_type || 'work',
            photos: section.photos || {}
          };
        } else if (section.type === 'comment') {
          return {
            section_type: 'comment',
            content: section.content || ''
          };
        } else if (section.type === 'work_content') {
          return {
            section_type: 'work_content',
            content: section.content || ''
          };
        }
        return null;
      })
      .filter(s => s !== null);
    
    // レポートオブジェクトを作成（report-shared-view.jsのrenderReport関数と同じ形式）
    const report = {
      cleaning_date: date,
      cleaning_start_time: startTime,
      cleaning_end_time: endTime,
      store_name: storeName,
      brand_name: brandName,
      work_items: workItems,
      sections: reportSections
    };
    
    // report-shared-view.jsのrenderReportToContainer関数を使用して表示
    // 一時的なコンテナを作成してレンダリング
    const tempContainer = document.createElement('div');
    if (window.renderReport && typeof window.renderReport === 'function') {
      // renderReportToContainerを使う（第2引数にコンテナを指定）
      window.renderReport(report, tempContainer);
      
      // レンダリングされたHTMLから必要な部分を取得
      const renderedHeader = tempContainer.querySelector('.report-header');
      const renderedItemsBar = tempContainer.querySelector('.items-list-bar');
      const renderedMain = tempContainer.querySelector('.report-main');
      
      // プレビュー用の要素にコピー
      if (renderedHeader) {
        const previewHeader = document.getElementById('preview-report-header');
        if (previewHeader) {
          const brandEl = renderedHeader.querySelector('.report-brand');
          const dateEl = renderedHeader.querySelector('.report-date');
          const storeEl = renderedHeader.querySelector('.report-store');
          const staffEl = renderedHeader.querySelector('.report-staff');
          
          const previewBrandEl = document.getElementById('preview-report-brand');
          const previewDateEl = document.getElementById('preview-report-date');
          const previewStoreEl = document.getElementById('preview-report-store');
          const previewStaffEl = document.getElementById('preview-report-staff');
          
          if (brandEl && previewBrandEl) previewBrandEl.textContent = brandEl.textContent;
          if (dateEl && previewDateEl) previewDateEl.textContent = dateEl.textContent;
          if (storeEl && previewStoreEl) previewStoreEl.textContent = storeEl.textContent;
          if (staffEl && previewStaffEl) previewStaffEl.textContent = staffEl.textContent;
        }
      }
      
      if (renderedItemsBar) {
        const itemsEl = renderedItemsBar.querySelector('.items-list-items');
        const previewItemsEl = document.getElementById('preview-cleaning-items');
        if (itemsEl && previewItemsEl) {
          previewItemsEl.innerHTML = itemsEl.innerHTML;
        }
      }
      
      if (renderedMain) {
        const previewMainEl = document.getElementById('preview-report-main');
        if (previewMainEl) {
          previewMainEl.innerHTML = renderedMain.innerHTML;
        }
      }
      
      // 画像クリックイベントを設定（report-shared-view.jsのsetupImageModalInContainerと同じロジック）
      // プレビュー用の要素に対して設定
      const previewImageItems = previewContent.querySelectorAll('#preview-report-main .image-item');
      previewImageItems.forEach(item => {
        item.style.cursor = 'pointer';
        // 既存のイベントリスナーを削除
        const newItem = item.cloneNode(true);
        item.parentNode.replaceChild(newItem, item);
        
        newItem.addEventListener('click', function() {
          const img = this.querySelector('img');
          if (img && img.src) {
            // report-shared-view.jsのopenImageModalを使用
            if (window.openImageModal && typeof window.openImageModal === 'function') {
              window.openImageModal(img.src);
            } else {
              // フォールバック: プレビュー用の画像モーダル
              openPreviewImageModal(img.src);
            }
          }
        });
      });
    } else {
      console.warn('[openPreviewModal] renderReport function not found, using fallback');
      // フォールバック: シンプルな表示
      const previewMainEl = document.getElementById('preview-report-main');
      if (previewMainEl) {
        previewMainEl.innerHTML = `
          <div style="padding: 20px;">
            <h2>${escapeHtml(report.store_name || '店舗名不明')}</h2>
            <p>日付: ${escapeHtml(report.cleaning_date || '-')}</p>
          </div>
        `;
      }
    }
    
    // プレビュー用のタブ機能を設定（既存のイベントリスナーを削除してから追加）
    setupPreviewTabs();
    
    // モーダルを表示
    if (previewDialog) {
      previewDialog.classList.add('show');
      previewDialog.style.display = 'flex';
    }
  }
  
  // プレビュー用のタブ機能を設定
  function setupPreviewTabs() {
    const previewContent = document.getElementById('preview-report-content');
    if (!previewContent) return;
    
    const tabBtns = previewContent.querySelectorAll('.tab-btn');
    const tabContents = previewContent.querySelectorAll('.tab-content');
    
    // 既存のイベントリスナーを削除してから追加（重複を防ぐ）
    tabBtns.forEach(btn => {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      
      newBtn.addEventListener('click', function() {
        const targetTab = this.dataset.tab;
        
        // すべてのタブボタンとコンテンツからactiveクラスを削除
        tabBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => {
          c.classList.remove('active');
          c.style.display = 'none';
        });
        
        // クリックされたタブをアクティブにする
        this.classList.add('active');
        const targetContent = previewContent.querySelector(`#preview-tab-content-${targetTab}`);
        if (targetContent) {
          targetContent.classList.add('active');
          targetContent.style.display = 'block';
        }
      });
    });
  }

  // プレビュー用の画像モーダル機能（report-shared-view.jsと同じ）
  function setupPreviewImageModal() {
    const imageItems = document.querySelectorAll('#preview-report-content .image-item');
    
    imageItems.forEach(item => {
      item.style.cursor = 'pointer';
      item.addEventListener('click', function() {
        const img = this.querySelector('img');
        if (img && img.src) {
          openPreviewImageModal(img.src);
        }
      });
    });
  }

  // プレビュー用の画像モーダルを開く（report-shared-view.jsと同じ）
  function openPreviewImageModal(imageSrc) {
    // モーダルが既に存在する場合は削除
    const existingModal = document.getElementById('preview-image-modal');
    if (existingModal) {
      existingModal.remove();
    }
    
    // モーダル要素を作成
    const modal = document.createElement('div');
    modal.id = 'preview-image-modal';
    modal.className = 'image-modal';
    modal.innerHTML = `
      <div class="image-modal-overlay"></div>
      <div class="image-modal-content">
        <button class="image-modal-close" aria-label="閉じる">&times;</button>
        <img src="${imageSrc}" alt="拡大画像" class="image-modal-img">
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // 閉じるボタンのイベント
    const closeBtn = modal.querySelector('.image-modal-close');
    const overlay = modal.querySelector('.image-modal-overlay');
    
    const closeModal = () => {
      modal.remove();
    };
    
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
    
    // ESCキーで閉じる
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);
  }

  // プレビューモーダルを閉じる
  window.closePreviewModal = function() {
    // 保存確認モーダルが開いていれば確実に閉じる
    const previewSaveDialog = document.getElementById('preview-save-dialog');
    if (previewSaveDialog && previewSaveDialog.open) {
      previewSaveDialog.close();
    }
    
    const previewDialog = document.getElementById('preview-dialog');
    if (previewDialog) {
      previewDialog.classList.remove('show');
      previewDialog.style.display = 'none';
      // プレビューデータをクリア（次回は最新のデータを使用）
      // localStorageのpreview_report_dataは使用しないため、削除処理も不要
      // localStorage.removeItem('preview_report_data');
      console.log('[closePreviewModal] Modal closed and preview data cleared');
    }
  };
  

  // スクロール位置インジケーターを設定（SP版のみ）
  function setupScrollIndicator() {
    // SP版（375px以下）でのみ動作
    if (window.innerWidth > 375) return;

    const tabContents = document.querySelectorAll('.tab-content');
    
    tabContents.forEach(tabContent => {
      // スクロールインジケーター要素を作成
      const indicator = document.createElement('div');
      indicator.className = 'scroll-indicator';
      document.body.appendChild(indicator);

      let scrollTimeout;
      let isScrolling = false;

      // スクロールイベント
      tabContent.addEventListener('scroll', () => {
        if (!isScrolling) {
          indicator.classList.add('visible');
          isScrolling = true;
        }

        // スクロール位置を計算
        const scrollTop = tabContent.scrollTop;
        const scrollHeight = tabContent.scrollHeight;
        const clientHeight = tabContent.clientHeight;
        const scrollableHeight = scrollHeight - clientHeight;
        
        if (scrollableHeight > 0) {
          // スクロール位置の割合（0-1）
          const scrollPercent = scrollTop / scrollableHeight;
          
          // 画面の高さを取得
          const viewportHeight = window.innerHeight;
          const headerHeight = 98; // ヘッダー + タブナビゲーション
          const availableHeight = viewportHeight - headerHeight;
          
          // インジケーターの位置を計算（ヘッダー下から開始）
          const indicatorTop = headerHeight + (availableHeight - 20) * scrollPercent;
          
          indicator.style.top = `${indicatorTop}px`;
        }

        // スクロール停止時に非表示
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          indicator.classList.remove('visible');
          isScrolling = false;
        }, 1000);
      });

      // タブが切り替わったときにインジケーターをリセット
      const observer = new MutationObserver(() => {
        if (tabContent.classList.contains('active')) {
          indicator.classList.remove('visible');
        }
      });
      
      observer.observe(tabContent, {
        attributes: true,
        attributeFilter: ['class']
      });
    });
  }
})();

