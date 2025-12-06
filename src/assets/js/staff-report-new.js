/**
 * 清掃員レポート作成ページ
 * SP最適化・セクション方式
 */

(function() {
  const API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';
  const REPORT_API = 'https://2z0ui5xfxb.execute-api.ap-northeast-1.amazonaws.com/prod';

  // データ
  let stores = [];
  let serviceItems = [];
  let sectionCounter = 0;
  let sections = {}; // セクションデータを保持

  // 画像倉庫用
  let warehouseImages = [];
  let selectedWarehouseImages = { before: [], after: [] };
  let currentImageSection = null;
  let currentImageCategory = null;

  // 初期化
  document.addEventListener('DOMContentLoaded', async () => {
    await Promise.all([loadStores(), loadServiceItems()]);
    setupEventListeners();
    setupTabs();
    setDefaultDate();
    loadRevisionRequests();
  });

  // 店舗読み込み
  async function loadStores() {
    try {
      const res = await fetch(`${API_BASE}/stores`);
      stores = await res.json();
    } catch (e) {
      console.error('Failed to load stores:', e);
    }
  }

  // サービス項目読み込み
  async function loadServiceItems() {
    try {
      const res = await fetch('/data/service_items.json');
      const data = await res.json();
      serviceItems = data.items || data || [];
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
    }
  }

  // デフォルト日付設定
  function setDefaultDate() {
    document.getElementById('report-date').value = new Date().toISOString().split('T')[0];
  }

  // タブ切り替え設定
  function setupTabs() {
    const tabButtons = document.querySelectorAll('.tabs-navigation .tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;
        
        // タブボタンのアクティブ状態を更新
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // タブコンテンツの表示を切り替え
        tabContents.forEach(content => {
          content.classList.remove('active');
        });
        document.getElementById(`tab-content-${targetTab}`).classList.add('active');
        
        // 修正タブに切り替えた場合は再読み込み
        if (targetTab === 'edit') {
          loadRevisionRequests();
        }
      });
    });
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

  // レポートを編集モードで開く
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
      loadReportToForm(report);
      
    } catch (error) {
      console.error('Error loading report:', error);
      alert('レポートの読み込みに失敗しました: ' + error.message);
    }
  };

  // レポートデータをフォームに読み込む
  function loadReportToForm(report) {
    // 基本情報
    document.getElementById('report-store').value = report.store_id || '';
    document.getElementById('report-store-name').value = report.store_name || '';
    document.getElementById('report-store-search').value = report.store_name || '';
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
            <input type="text" class="form-input cleaning-item-custom" placeholder="清掃項目名を入力" style="display:none; margin-top:8px;" oninput="updateCleaningItem('${sectionId}', this.value)">
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
    sections[sectionId] = {
      type: 'image',
      photos: section.photos || { before: [], after: [] }
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
                ${(section.photos?.before || []).map(url => `
                  <div class="image-thumb">
                    <img src="${url}" alt="Before">
                    <button type="button" class="image-thumb-remove" onclick="removeImage('${sectionId}', 'before', '${url}', this)">
                      <i class="fas fa-times"></i>
                    </button>
                  </div>
                `).join('')}
                <button type="button" class="image-add-btn" onclick="openImageDialog('${sectionId}', 'before')">
                  <i class="fas fa-plus"></i>
                  <span>追加</span>
                </button>
              </div>
            </div>
            <div class="image-category">
              <div class="image-category-title after"><i class="fas fa-check-circle"></i> 作業後</div>
              <div class="image-list" id="${sectionId}-after">
                ${(section.photos?.after || []).map(url => `
                  <div class="image-thumb">
                    <img src="${url}" alt="After">
                    <button type="button" class="image-thumb-remove" onclick="removeImage('${sectionId}', 'after', '${url}', this)">
                      <i class="fas fa-times"></i>
                    </button>
                  </div>
                `).join('')}
                <button type="button" class="image-add-btn" onclick="openImageDialog('${sectionId}', 'after')">
                  <i class="fas fa-plus"></i>
                  <span>追加</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    document.getElementById('report-content').insertAdjacentHTML('beforeend', html);
    const newCard = document.querySelector(`[data-section-id="${sectionId}"]`);
    if (newCard) setupSectionDragAndDrop(newCard);
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
    const allCards = contentArea.querySelectorAll('.section-card');
    allCards.forEach(card => setupSectionDragAndDrop(card));
  }

  // イベントリスナー設定
  function setupEventListeners() {
    // 店舗検索
    const storeSearchInput = document.getElementById('report-store-search');
    const storeResults = document.getElementById('store-search-results');
    
    // ドロップダウンを表示・更新する関数
    function updateStoreDropdown() {
      const query = storeSearchInput.value.trim();
      
      // 部分一致で検索（空文字の場合は全店舗を表示）
      const filtered = query.length === 0 
        ? stores 
        : stores.filter(store => {
            const name = (store.store_name || store.name || '').toLowerCase();
            return name.includes(query.toLowerCase());
          });
      
      if (filtered.length === 0) {
        storeResults.innerHTML = '<div class="store-search-item no-results">該当する店舗が見つかりません</div>';
        storeResults.style.display = 'block';
        return;
      }
      
      storeResults.innerHTML = filtered.map(store => {
        const name = store.store_name || store.name;
        const id = store.store_id || store.id;
        return `<div class="store-search-item" data-id="${id}" data-name="${escapeHtml(name)}">${escapeHtml(name)}</div>`;
      }).join('');
      
      storeResults.style.display = 'block';
      
      // クリックイベント
      storeResults.querySelectorAll('.store-search-item').forEach(item => {
        if (item.classList.contains('no-results')) return;
        item.addEventListener('click', function() {
          const id = this.dataset.id;
          const name = this.dataset.name;
          document.getElementById('report-store').value = id;
          document.getElementById('report-store-name').value = name;
          storeSearchInput.value = name;
          storeResults.style.display = 'none';
        });
      });
    }
    
    // フォーカス時に全店舗を表示
    storeSearchInput.addEventListener('focus', function() {
      updateStoreDropdown();
    });
    
    // 入力時にフィルタリング
    storeSearchInput.addEventListener('input', function() {
      updateStoreDropdown();
    });
    
    // 外部クリックで閉じる
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.store-search-group')) {
        storeResults.style.display = 'none';
      }
    });

    // 追加ボタン
    document.getElementById('add-cleaning-item').addEventListener('click', addCleaningItemSection);
    document.getElementById('add-image').addEventListener('click', () => addImageSection());
    document.getElementById('add-comment').addEventListener('click', addCommentSection);
    document.getElementById('add-work-content').addEventListener('click', addWorkContentSection);

    // セクションカードのドラッグ&ドロップ機能を初期設定
    setupAllSectionDragAndDrop();
    
    // セクションが追加されたときにドラッグ&ドロップを設定するため、MutationObserverを使用
    const contentArea = document.getElementById('report-content');
    const observer = new MutationObserver(() => {
      setupAllSectionDragAndDrop();
    });
    observer.observe(contentArea, { childList: true, subtree: true });

    // ヘルプボタン
    document.getElementById('help-btn').addEventListener('click', () => {
      document.getElementById('help-dialog').style.display = 'flex';
    });

    // フォーム送信
    document.getElementById('report-form').addEventListener('submit', handleSubmit);

    // 画像倉庫タブ切り替え
    document.querySelectorAll('.warehouse-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.warehouse-tabs .tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        this.classList.add('active');
        document.getElementById(`tab-${this.dataset.tab}`).classList.add('active');
      });
    });

    // カメラ入力
    document.getElementById('camera-input').addEventListener('change', handleCameraInput);
    document.getElementById('file-input').addEventListener('change', handleFileInput);

    // 画像倉庫フィルター
    document.getElementById('library-date').addEventListener('change', loadWarehouseImages);
    document.getElementById('library-category').addEventListener('change', loadWarehouseImages);
    document.getElementById('library-date').value = new Date().toISOString().split('T')[0];

    // 画像選択確定
    document.getElementById('save-images-btn').addEventListener('click', saveSelectedImages);
  }

  // 清掃項目セクション追加
  function addCleaningItemSection() {
    sectionCounter++;
    const sectionId = `section-${sectionCounter}`;
    sections[sectionId] = { type: 'cleaning', item_name: '' };

    const options = serviceItems.map(item => 
      `<option value="${escapeHtml(item.title)}">${escapeHtml(item.title)}</option>`
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
          <input type="text" class="form-input cleaning-item-custom" placeholder="清掃項目名を入力" style="display:none; margin-top:8px;" oninput="updateCleaningItem('${sectionId}', this.value)">
        </div>
      </div>
    `;

    document.getElementById('report-content').insertAdjacentHTML('beforeend', html);
    const newCard = document.querySelector(`[data-section-id="${sectionId}"]`);
    if (newCard) setupSectionDragAndDrop(newCard);
    updateCleaningItemsList();
  }

  // 画像セクション追加
  function addImageSection() {
    sectionCounter++;
    const sectionId = `section-${sectionCounter}`;
    sections[sectionId] = { type: 'image', photos: { before: [], after: [] } };

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
                <button type="button" class="image-add-btn" onclick="openImageDialog('${sectionId}', 'before')">
                  <i class="fas fa-plus"></i>
                  <span>追加</span>
                </button>
              </div>
            </div>
            <div class="image-category">
              <div class="image-category-title after"><i class="fas fa-check-circle"></i> 作業後</div>
              <div class="image-list" id="${sectionId}-after">
                <button type="button" class="image-add-btn" onclick="openImageDialog('${sectionId}', 'after')">
                  <i class="fas fa-plus"></i>
                  <span>追加</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('report-content').insertAdjacentHTML('beforeend', html);
    const newCard = document.querySelector(`[data-section-id="${sectionId}"]`);
    if (newCard) setupSectionDragAndDrop(newCard);
  }

  // コメントセクション追加
  function addCommentSection() {
    sectionCounter++;
    const sectionId = `section-${sectionCounter}`;
    sections[sectionId] = { type: 'comment', content: '' };

    const html = `
      <div class="section-card" data-section-id="${sectionId}">
        <div class="section-header">
          <span class="section-title"><i class="fas fa-comment"></i> コメント</span>
          <button type="button" class="section-delete" onclick="deleteSection('${sectionId}')">
            <i class="fas fa-trash"></i>
          </button>
        </div>
        <div class="section-body">
          <textarea class="section-textarea" placeholder="コメントを入力..." oninput="updateSectionContent('${sectionId}', this.value)"></textarea>
        </div>
      </div>
    `;

    document.getElementById('report-content').insertAdjacentHTML('beforeend', html);
    const newCard = document.querySelector(`[data-section-id="${sectionId}"]`);
    if (newCard) setupSectionDragAndDrop(newCard);
  }

  // 作業内容セクション追加
  function addWorkContentSection() {
    sectionCounter++;
    const sectionId = `section-${sectionCounter}`;
    sections[sectionId] = { type: 'work_content', content: '' };

    const html = `
      <div class="section-card" data-section-id="${sectionId}">
        <div class="section-header">
          <span class="section-title"><i class="fas fa-tasks"></i> 作業内容</span>
          <button type="button" class="section-delete" onclick="deleteSection('${sectionId}')">
            <i class="fas fa-trash"></i>
          </button>
        </div>
        <div class="section-body">
          <textarea class="section-textarea" placeholder="作業内容を入力..." oninput="updateSectionContent('${sectionId}', this.value)"></textarea>
        </div>
      </div>
    `;

    document.getElementById('report-content').insertAdjacentHTML('beforeend', html);
    const newCard = document.querySelector(`[data-section-id="${sectionId}"]`);
    if (newCard) setupSectionDragAndDrop(newCard);
  }

  // セクション削除
  window.deleteSection = function(sectionId) {
    delete sections[sectionId];
    document.querySelector(`[data-section-id="${sectionId}"]`).remove();
    updateCleaningItemsList();
  };

  // 清掃項目更新
  window.updateCleaningItem = function(sectionId, value) {
    const card = document.querySelector(`[data-section-id="${sectionId}"]`);
    const customInput = card.querySelector('.cleaning-item-custom');
    
    if (value === '__other__') {
      customInput.style.display = 'block';
      customInput.focus();
      sections[sectionId].item_name = '';
    } else {
      customInput.style.display = 'none';
      sections[sectionId].item_name = value;
    }
    
    updateCleaningItemsList();
  };

  // セクション内容更新
  window.updateSectionContent = function(sectionId, value) {
    sections[sectionId].content = value;
  };

  // 清掃項目リスト更新
  function updateCleaningItemsList() {
    const container = document.getElementById('cleaning-items-list');
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
    selectedWarehouseImages = { before: [], after: [] };
    document.getElementById('upload-preview').innerHTML = '';
    loadWarehouseImages();
    document.getElementById('warehouse-dialog').style.display = 'flex';
  };

  // カメラ入力処理
  async function handleCameraInput(e) {
    const file = e.target.files[0];
    if (!file) return;
    await uploadAndPreview(file);
    e.target.value = '';
  }

  // ファイル入力処理
  async function handleFileInput(e) {
    const files = Array.from(e.target.files);
    for (const file of files) {
      await uploadAndPreview(file);
    }
    e.target.value = '';
  }

  // アップロードとプレビュー
  async function uploadAndPreview(file) {
    const preview = document.getElementById('upload-preview');
    const cleaningDate = document.getElementById('report-date').value || new Date().toISOString().split('T')[0];

    // プレビュー表示（ローディング）
    const itemId = `upload-${Date.now()}`;
    const loadingHtml = `
      <div class="upload-preview-item" id="${itemId}">
        <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#f3f4f6;">
          <i class="fas fa-spinner fa-spin" style="color:#FF679C;"></i>
        </div>
      </div>
    `;
    preview.insertAdjacentHTML('beforeend', loadingHtml);

    try {
      // Base64に変換
      const base64 = await fileToBase64(file);

      // S3にアップロード
      const response = await fetch(`${REPORT_API}/staff/report-images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64,
          category: currentImageCategory,
          cleaning_date: cleaningDate
        })
      });

      if (!response.ok) throw new Error('Upload failed');
      
      const result = await response.json();
      const imageUrl = result.image.url;

      // プレビュー更新
      document.getElementById(itemId).innerHTML = `<img src="${imageUrl}" alt="Preview">`;
      
      // 選択画像に追加
      selectedWarehouseImages[currentImageCategory].push(imageUrl);

    } catch (error) {
      console.error('Upload error:', error);
      document.getElementById(itemId).remove();
      alert('画像のアップロードに失敗しました');
    }
  }

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
    const images = selectedWarehouseImages[category];

    if (images.length === 0) {
      alert('画像を選択してください');
      return;
    }

    // セクションに画像を追加
    sections[sectionId].photos[category] = [
      ...sections[sectionId].photos[category],
      ...images
    ];

    // UIに画像を追加
    const container = document.getElementById(`${sectionId}-${category}`);
    const addBtn = container.querySelector('.image-add-btn');

    images.forEach(url => {
      const thumb = document.createElement('div');
      thumb.className = 'image-thumb';
      thumb.innerHTML = `
        <img src="${url}" alt="Photo">
        <button type="button" class="image-thumb-remove" onclick="removeImage('${sectionId}', '${category}', '${url}', this)">
          <i class="fas fa-times"></i>
        </button>
      `;
      container.insertBefore(thumb, addBtn);
    });

    document.getElementById('warehouse-dialog').style.display = 'none';
  }

  // 画像削除
  window.removeImage = function(sectionId, category, url, btn) {
    const arr = sections[sectionId].photos[category];
    const idx = arr.indexOf(url);
    if (idx > -1) arr.splice(idx, 1);
    btn.closest('.image-thumb').remove();
  };

  // フォーム送信
  async function handleSubmit(e) {
    e.preventDefault();

    const form = document.getElementById('report-form');
    const reportId = form.dataset.reportId; // 編集モードかどうか
    const isEditMode = !!reportId;

    const storeId = document.getElementById('report-store').value;
    const storeName = document.getElementById('report-store-name').value;
    const cleaningDate = document.getElementById('report-date').value;

    if (!storeId) {
      alert('店舗を選択してください');
      return;
    }

    if (!cleaningDate) {
      alert('清掃日を入力してください');
      return;
    }

    // 清掃項目を収集
    const workItems = Object.values(sections)
      .filter(s => s.type === 'cleaning' && s.item_name)
      .map(s => {
        // item_nameからitem_idを生成（スラッグ化）
        const itemId = s.item_name.toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^\w\-]+/g, '')
          .replace(/\-\-+/g, '-')
          .replace(/^-+/, '')
          .replace(/-+$/, '');
        
        return {
          item_id: itemId,
          item_name: s.item_name,
          details: {},
          photos: { before: [], after: [] }
        };
      });

    // セクションを収集
    const sectionData = Object.entries(sections)
      .filter(([_, s]) => s.type !== 'cleaning')
      .map(([id, s]) => {
        if (s.type === 'image') {
          return {
            section_id: id,
            section_type: 'image',
            image_type: 'work',
            photos: s.photos
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
      .filter(Boolean);

    const reportData = {
      store_id: storeId,
      store_name: storeName,
      cleaning_date: cleaningDate,
      cleaning_start_time: document.getElementById('report-start').value || '',
      cleaning_end_time: document.getElementById('report-end').value || '',
      work_items: workItems,
      sections: sectionData,
      status: 'pending' // 清掃員からの提出は「保留」状態
    };

    console.log('[Submit] Report data:', reportData);

    try {
      const submitBtn = document.getElementById('submit-btn');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 送信中...';

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
      alert(isEditMode ? 'レポートを修正しました！' : 'レポートを提出しました！');
      
      // 編集モードの場合はフォームをリセット
      if (isEditMode) {
        form.dataset.reportId = '';
        form.reset();
        sections = {};
        sectionCounter = 0;
        document.getElementById('report-content').innerHTML = '';
        updateCleaningItemsList();
        const submitBtn = document.getElementById('submit-btn');
        if (submitBtn) {
          submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> レポートを提出';
        }
        // 修正タブに切り替えて一覧を更新
        document.getElementById('tab-edit').click();
      } else {
        window.location.href = '/staff/dashboard';
      }

    } catch (error) {
      console.error('[Submit] Error:', error);
      console.error('[Submit] Report data that failed:', reportData);
      alert('送信に失敗しました: ' + error.message);
      const submitBtn = document.getElementById('submit-btn');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> レポートを提出';
    }
  }

  // Firebase IDトークン取得
  async function getFirebaseIdToken() {
    if (typeof firebase !== 'undefined' && firebase.auth) {
      const user = firebase.auth().currentUser;
      if (user) {
        return await user.getIdToken();
      }
    }
    return 'dev-token';
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
})();

