/**
 * 清掃員レポート作成ページ
 * SP最適化・セクション方式
 */

(function() {
  const API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';
  const REPORT_API = 'https://2z0ui5xfxb.execute-api.ap-northeast-1.amazonaws.com/prod';
  const DEFAULT_NO_PHOTO_IMAGE = '/images-report/no-photo-default.png'; // デフォルト画像パス

  // データ
  let stores = [];
  let brands = [];
  let clients = [];
  let serviceItems = [];
  let sectionCounter = 0;
  let sections = {}; // セクションデータを保持

  // 画像倉庫用
  let warehouseImages = [];
  let selectedWarehouseImages = { before: [], after: [], completed: [] };
  let currentImageSection = null;
  let currentImageCategory = null;

  // 画像ストック用
  let imageStock = []; // ローカル保存された画像データ配列 { id, file, blobUrl, fileName, uploaded: false }
  const STOCK_DB_NAME = 'report-image-stock';
  const STOCK_DB_VERSION = 1;

  // 初期化
  document.addEventListener('DOMContentLoaded', async () => {
    await Promise.all([loadStores(), loadBrands(), loadClients(), loadServiceItems()]);
    await initImageStockDB();
    await loadImageStockFromDB();
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

  // ブランド読み込み
  async function loadBrands() {
    try {
      const res = await fetch(`${API_BASE}/brands`);
      brands = await res.json();
    } catch (e) {
      console.error('Failed to load brands:', e);
    }
  }

  // クライアント読み込み
  async function loadClients() {
    try {
      const res = await fetch(`${API_BASE}/clients`);
      clients = await res.json();
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
    const dateInput = document.getElementById('report-date');
    if (dateInput) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }
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
    const storeSearchInput = document.getElementById('report-store-search');
    if (storeSearchInput) {
      storeSearchInput.value = report.store_name || '';
      // readonly属性を確実に設定（モーダルを開くため）
      storeSearchInput.setAttribute('readonly', 'readonly');
    }
    
    // ブランド情報を設定（店舗から取得）
    if (report.store_id) {
      const store = stores.find(s => (s.store_id || s.id) === report.store_id);
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
              // readonly属性を確実に設定（モーダルを開くため）
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
          brandSearchInput.setAttribute('readonly', 'readonly');
        }
      }
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
            <span class="section-title"><i class="fas fa-image"></i> 画像（施工後）</span>
            <button type="button" class="section-delete" onclick="deleteSection('${sectionId}')">
              <i class="fas fa-trash"></i>
            </button>
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
                  <button type="button" class="image-add-btn" onclick="openImageDialog('${sectionId}', 'completed')">
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
                  ${(photos.before || []).length === 0 ? `
                    <div class="image-placeholder">
                      <img src="${DEFAULT_NO_PHOTO_IMAGE}" alt="写真を撮り忘れました" class="default-no-photo-image">
                    </div>
                  ` : ''}
                  ${(photos.before || []).map(url => `
                    <div class="image-thumb" draggable="true" data-section-id="${sectionId}" data-category="before" data-image-url="${url}">
                      <img src="${url}" alt="Before" draggable="false">
                      <button type="button" class="image-thumb-remove" onclick="removeImage('${sectionId}', 'before', '${url}', '', this)">
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
                  ${(photos.after || []).length === 0 ? `
                    <div class="image-placeholder">
                      <img src="${DEFAULT_NO_PHOTO_IMAGE}" alt="写真を撮り忘れました" class="default-no-photo-image">
                    </div>
                  ` : ''}
                  ${(photos.after || []).map(url => `
                    <div class="image-thumb" draggable="true" data-section-id="${sectionId}" data-category="after" data-image-url="${url}">
                      <img src="${url}" alt="After" draggable="false">
                      <button type="button" class="image-thumb-remove" onclick="removeImage('${sectionId}', 'after', '${url}', '', this)">
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
    const allCards = contentArea.querySelectorAll('.section-card');
    allCards.forEach(card => setupSectionDragAndDrop(card));
  }

  // ヘルパー関数
  function getBrandName(brandId) {
    if (!brandId) return '';
    const brand = brands.find(b => b.id === brandId || String(b.id) === String(brandId));
    return brand ? (brand.name || '') : '';
  }

  // イベントリスナー設定
  function setupEventListeners() {
    // ブランド検索
    const brandSearchInput = document.getElementById('report-brand-search');
    const brandResults = document.getElementById('brand-search-results');
    
    function updateBrandDropdown() {
      if (!brandSearchInput || !brandResults) return;
      
      const query = brandSearchInput.value.trim();
      
      // 検索クエリが空の場合は全ブランドを表示（清掃項目と同じ仕様）
      const filtered = query.length === 0 
        ? brands 
        : brands.filter(brand => {
            const name = (brand.name || '').toLowerCase();
            return name.includes(query.toLowerCase());
          });
      
      if (filtered.length === 0) {
        brandResults.innerHTML = '<div class="store-search-item no-results">該当するブランドが見つかりません</div>';
        brandResults.style.display = 'block';
        return;
      }
      
      brandResults.innerHTML = filtered.map(brand => {
        const name = brand.name;
        const id = brand.id;
        return `<div class="store-search-item" data-id="${id}" data-name="${escapeHtml(name)}">${escapeHtml(name)}</div>`;
      }).join('');
      
      brandResults.style.display = 'block';
      
      brandResults.querySelectorAll('.store-search-item').forEach(item => {
        if (item.classList.contains('no-results')) return;
        item.addEventListener('click', function() {
          const id = this.dataset.id;
          const name = this.dataset.name;
          document.getElementById('report-brand').value = id;
          document.getElementById('report-brand-name').value = name;
          brandSearchInput.value = name;
          brandResults.style.display = 'none';
          
          // ブランド選択時に店舗リストを更新
          if (storeSearchInput) {
            updateStoreDropdown();
          }
        });
      });
    }
    
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
      
      if (filtered.length === 0) {
        modalResults.innerHTML = '<div class="store-search-item no-results">該当するブランドが見つかりません</div>';
        return;
      }
      
      modalResults.innerHTML = filtered.map(brand => {
        const name = brand.name;
        const id = brand.id;
        return `<div class="store-search-item" data-id="${id}" data-name="${escapeHtml(name)}">${escapeHtml(name)}</div>`;
      }).join('');
      
      // クリックイベント
      modalResults.querySelectorAll('.store-search-item').forEach(item => {
        if (item.classList.contains('no-results')) return;
        item.addEventListener('click', function() {
          const id = this.dataset.id;
          const name = this.dataset.name;
          document.getElementById('report-brand').value = id;
          document.getElementById('report-brand-name').value = name;
          brandSearchInput.value = name;
          closeBrandModal();
          
          // ブランド選択時に店舗リストを更新
          if (storeSearchInput) {
            updateStoreModal();
          }
        });
      });
    }
    
    // モーダル内の検索フィールドのイベント
    const brandModalSearch = document.getElementById('brand-modal-search');
    if (brandModalSearch) {
      brandModalSearch.addEventListener('input', updateBrandModal);
    }
    
    // 入力フィールドをクリックしたときにモーダルを開く
    if (brandSearchInput) {
      // readonly属性を設定（直接入力を無効化）
      brandSearchInput.setAttribute('readonly', 'readonly');
      // クリックイベント（readonlyでも発火する）
      brandSearchInput.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        openBrandModal();
      });
      // フォーカスイベント
      brandSearchInput.addEventListener('focus', function(e) {
        e.preventDefault();
        e.stopPropagation();
        openBrandModal();
      });
      // タッチイベント（モバイル対応）
      brandSearchInput.addEventListener('touchstart', function(e) {
        e.preventDefault();
        e.stopPropagation();
        openBrandModal();
      });
    }

    // 店舗検索
    const storeSearchInput = document.getElementById('report-store-search');
    const storeResults = document.getElementById('store-search-results');
    
    // ドロップダウンを表示・更新する関数
    function updateStoreDropdown() {
      if (!storeSearchInput || !storeResults) return;
      
      const query = storeSearchInput.value.trim();
      const selectedBrandId = document.getElementById('report-brand')?.value;
      
      // 部分一致で検索（空文字の場合は全店舗を表示）
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
      }
      
      if (filtered.length === 0) {
        storeResults.innerHTML = '<div class="store-search-item no-results">該当する店舗が見つかりません</div>';
        storeResults.style.display = 'block';
        return;
      }
      
      storeResults.innerHTML = filtered.map(store => {
        const name = store.store_name || store.name;
        const id = store.store_id || store.id;
        const brandId = store.brand_id || store.brandId;
        return `<div class="store-search-item" data-id="${id}" data-name="${escapeHtml(name)}" data-brand-id="${brandId || ''}">${escapeHtml(name)}</div>`;
      }).join('');
      
      storeResults.style.display = 'block';
      
      // クリックイベント
      storeResults.querySelectorAll('.store-search-item').forEach(item => {
        if (item.classList.contains('no-results')) return;
        item.addEventListener('click', function() {
          const id = this.dataset.id;
          const name = this.dataset.name;
          const brandId = this.dataset.brandId;
          
          document.getElementById('report-store').value = id;
          document.getElementById('report-store-name').value = name;
          storeSearchInput.value = name;
          storeResults.style.display = 'none';
          
          // 店舗選択時にブランド名も自動設定
          if (brandId && brandSearchInput) {
            const brandName = getBrandName(brandId);
            if (brandName) {
              document.getElementById('report-brand').value = brandId;
              document.getElementById('report-brand-name').value = brandName;
              brandSearchInput.value = brandName;
            }
          }
        });
      });
    }
    
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
      
      if (!modalSearch || !modalResults) return;
      
      const query = modalSearch.value.trim();
      const selectedBrandId = document.getElementById('report-brand')?.value;
      
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
      }
      
      if (filtered.length === 0) {
        modalResults.innerHTML = '<div class="store-search-item no-results">該当する店舗が見つかりません</div>';
        return;
      }
      
      modalResults.innerHTML = filtered.map(store => {
        const name = store.store_name || store.name;
        const id = store.store_id || store.id;
        const brandId = store.brand_id || store.brandId;
        return `<div class="store-search-item" data-id="${id}" data-name="${escapeHtml(name)}" data-brand-id="${brandId || ''}">${escapeHtml(name)}</div>`;
      }).join('');
      
      // クリックイベント
      modalResults.querySelectorAll('.store-search-item').forEach(item => {
        if (item.classList.contains('no-results')) return;
        item.addEventListener('click', function() {
          const id = this.dataset.id;
          const name = this.dataset.name;
          const brandId = this.dataset.brandId;
          
          document.getElementById('report-store').value = id;
          document.getElementById('report-store-name').value = name;
          storeSearchInput.value = name;
          closeStoreModal();
          
          // 店舗選択時にブランド名も自動設定
          if (brandId && brandSearchInput) {
            const brandName = getBrandName(brandId);
            if (brandName) {
              document.getElementById('report-brand').value = brandId;
              document.getElementById('report-brand-name').value = brandName;
              brandSearchInput.value = brandName;
            }
          }
        });
      });
    }
    
    // モーダル内の検索フィールドのイベント
    const storeModalSearch = document.getElementById('store-modal-search');
    if (storeModalSearch) {
      storeModalSearch.addEventListener('input', updateStoreModal);
    }
    
    // 入力フィールドをクリックしたときにモーダルを開く
    if (storeSearchInput) {
      // readonly属性を設定（直接入力を無効化）
      storeSearchInput.setAttribute('readonly', 'readonly');
      // クリックイベント（readonlyでも発火する）
      storeSearchInput.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        openStoreModal();
      });
      // フォーカスイベント
      storeSearchInput.addEventListener('focus', function(e) {
        e.preventDefault();
        e.stopPropagation();
        openStoreModal();
      });
      // タッチイベント（モバイル対応）
      storeSearchInput.addEventListener('touchstart', function(e) {
        e.preventDefault();
        e.stopPropagation();
        openStoreModal();
      });
    }
    
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
    
    // 外部クリックで閉じる
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.store-search-group')) {
        if (storeResults) storeResults.style.display = 'none';
        if (brandResults) brandResults.style.display = 'none';
      }
    });

    // 追加ボタン
    document.getElementById('add-cleaning-item').addEventListener('click', addCleaningItemSection);
    document.getElementById('add-image').addEventListener('click', openImageSectionTypeModal);
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

    // 画像倉庫フィルター
    document.getElementById('library-date').addEventListener('change', loadWarehouseImages);
    document.getElementById('library-category').addEventListener('change', loadWarehouseImages);
    document.getElementById('library-date').value = new Date().toISOString().split('T')[0];

    // 画像選択確定
    document.getElementById('save-images-btn').addEventListener('click', saveSelectedImages);

    // 画像ストック機能
    setupImageStock();
    
  }

  // 画像ストック機能の設定
  function setupImageStock() {
    const stockFileInput = document.getElementById('stock-file-input');
    const stockGrid = document.getElementById('image-stock-grid');
    const clearStockBtn = document.getElementById('clear-stock-btn');

    // ファイル選択
    stockFileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      await addImagesToStock(files);
      e.target.value = ''; // リセット
    });

    // すべて削除
    clearStockBtn.addEventListener('click', async () => {
      if (confirm('画像ストック内のすべての画像を削除しますか？')) {
        // Blob URLを解放
        imageStock.forEach(item => {
          if (item.blobUrl) {
            URL.revokeObjectURL(item.blobUrl);
          }
        });
        
        imageStock = [];
        await clearImageStockDB();
        renderImageStock();
      }
    });

    // 画像ストックグリッドのドロップゾーン設定
    setupImageStockDropZone(stockGrid);
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
        // Blob URLを再生成
        imageStock.forEach(item => {
          if (item.data && !item.blobUrl) {
            const blob = new Blob([item.data], { type: item.type || 'image/jpeg' });
            item.blobUrl = URL.createObjectURL(blob);
          } else if (item.blobData && !item.blobUrl) {
            item.blobUrl = URL.createObjectURL(new Blob([item.blobData], { type: item.fileType || 'image/jpeg' }));
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
    
    return new Promise((resolve, reject) => {
      const transaction = stockDB.transaction(['images'], 'readwrite');
      const store = transaction.objectStore('images');
      const request = store.put(imageData);
      
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

  // 画像をストックに追加（ローカル保存）
  async function addImagesToStock(files) {
    for (const file of files) {
      try {
        // 画像IDを生成
        const imageId = `stock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Blob URLを作成（プレビュー用）
        const blobUrl = URL.createObjectURL(file);
        
        // ArrayBufferに変換（IndexedDB保存用）
        const arrayBuffer = await file.arrayBuffer();
        
        // 画像データオブジェクト
        const imageData = {
          id: imageId,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          blobData: arrayBuffer,
          blobUrl: blobUrl,
          uploaded: false,
          createdAt: new Date().toISOString()
        };
        
        // IndexedDBに保存
        await saveImageToDB(imageData);
        
        // メモリにも追加
        imageStock.push(imageData);
      } catch (error) {
        console.error('Error adding image to stock:', error);
        alert(`画像の保存に失敗しました: ${file.name}`);
      }
    }
    
    renderImageStock();
  }

  // 画像ストックを表示
  function renderImageStock() {
    const stockGrid = document.getElementById('image-stock-grid');
    const clearStockBtn = document.getElementById('clear-stock-btn');
    
    if (!stockGrid) {
      console.warn('image-stock-grid element not found');
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
    stockGrid.innerHTML = imageStock.map((imageData, index) => {
      if (!imageData.blobUrl) {
        console.warn('Image data missing blobUrl:', imageData);
        return '';
      }
      return `
        <div class="image-stock-item" draggable="true" data-image-id="${imageData.id}" data-stock-index="${index}">
          <img src="${imageData.blobUrl}" alt="Stock image" draggable="false">
          <button type="button" class="image-stock-item-remove" onclick="removeFromStock('${imageData.id}')">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `;
    }).filter(html => html).join('');

    // 各ストックアイテムにドラッグ&ドロップを設定
    stockGrid.querySelectorAll('.image-stock-item').forEach(item => {
      setupStockItemDragAndDrop(item);
    });
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

    // データに追加（画像データオブジェクトとして保存）
    sections[sectionId].photos[category].push({
      imageId: imageData.id,
      blobUrl: imageData.blobUrl,
      fileName: imageData.fileName,
      uploaded: false
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
          const newThumb = createImageThumb(sectionId, category, imageData.blobUrl, imageData.id);
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
    const newThumb = createImageThumb(sectionId, category, imageData.blobUrl, imageData.id);
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
                <div class="image-placeholder">
                  <img src="${DEFAULT_NO_PHOTO_IMAGE}" alt="写真を撮り忘れました" class="default-no-photo-image">
                </div>
                <button type="button" class="image-add-btn" onclick="openImageDialog('${sectionId}', 'before')">
                  <i class="fas fa-plus"></i>
                  <span>追加</span>
                </button>
              </div>
            </div>
            <div class="image-category">
              <div class="image-category-title after"><i class="fas fa-check-circle"></i> 作業後</div>
              <div class="image-list" id="${sectionId}-after">
                <div class="image-placeholder">
                  <img src="${DEFAULT_NO_PHOTO_IMAGE}" alt="写真を撮り忘れました" class="default-no-photo-image">
                </div>
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
    if (newCard) {
      setupSectionDragAndDrop(newCard);
      // 画像リストにドラッグ&ドロップを設定
      const beforeList = document.getElementById(`${sectionId}-before`);
      const afterList = document.getElementById(`${sectionId}-after`);
      if (beforeList) setupImageListDragAndDrop(beforeList, sectionId, 'before');
      if (afterList) setupImageListDragAndDrop(afterList, sectionId, 'after');
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
          <span class="section-title"><i class="fas fa-image"></i> 画像（施工後）</span>
          <button type="button" class="section-delete" onclick="deleteSection('${sectionId}')">
            <i class="fas fa-trash"></i>
          </button>
        </div>
        <div class="section-body">
          <div class="image-grid image-grid-completed">
            <div class="image-category image-category-completed">
              <div class="image-category-title completed"><i class="fas fa-star"></i> 施工後</div>
              <div class="image-list image-list-completed" id="${sectionId}-completed">
                <div class="image-placeholder">
                  <img src="${DEFAULT_NO_PHOTO_IMAGE}" alt="写真を撮り忘れました" class="default-no-photo-image">
                </div>
                <button type="button" class="image-add-btn" onclick="openImageDialog('${sectionId}', 'completed')">
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
    if (newCard) {
      setupSectionDragAndDrop(newCard);
      // 画像リストにドラッグ&ドロップを設定
      const completedList = document.getElementById(`${sectionId}-completed`);
      if (completedList) setupImageListDragAndDrop(completedList, sectionId, 'completed');
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
      alert('画像を選択してください');
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
  function setupImageListDragAndDrop(listElement, sectionId, category) {
    if (listElement.dataset.dragSetup) return;
    listElement.dataset.dragSetup = 'true';

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

    const sourceIndex = sourcePhotos.indexOf(url);
    if (sourceIndex === -1) return;

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
    sections[targetSectionId].photos[targetCategory].push(url);

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
    const newThumb = createImageThumb(targetSectionId, targetCategory, url);
    targetContainer.insertBefore(newThumb, addBtn);

    // ターゲットリストにドラッグ&ドロップを設定（まだ設定されていない場合）
    setupImageListDragAndDrop(targetContainer, targetSectionId, targetCategory);
  }

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

    const form = document.getElementById('report-form');
    const reportId = form.dataset.reportId; // 編集モードかどうか
    const isEditMode = !!reportId;

    const storeId = document.getElementById('report-store').value;
    const storeName = document.getElementById('report-store-name').value;
    const brandId = document.getElementById('report-brand')?.value || '';
    const brandName = document.getElementById('report-brand-name')?.value || '';
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
              uploadedPhotos.completed = await uploadSectionImages(s.photos.completed || [], cleaningDate);
            } else {
              uploadedPhotos.before = await uploadSectionImages(s.photos.before || [], cleaningDate);
              uploadedPhotos.after = await uploadSectionImages(s.photos.after || [], cleaningDate);
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

  // セクション内の画像をアップロード（ローカル画像のみ）
  async function uploadSectionImages(images, cleaningDate) {
    const uploadedUrls = await Promise.all(
      images.map(async (img) => {
        // 既にURLの場合はそのまま返す
        if (typeof img === 'string') {
          return img;
        }
        
        // 画像データオブジェクトの場合
        if (typeof img === 'object' && img.imageId) {
          // 既にアップロード済みの場合はURLを返す
          if (img.uploaded && img.url) {
            return img.url;
          }
          
          // ローカル画像をS3にアップロード
          try {
            const imageData = imageStock.find(stock => stock.id === img.imageId);
            if (!imageData) {
              console.warn(`Image not found in stock: ${img.imageId}`);
              return null;
            }
            
            // ArrayBufferをBlobに変換してBase64に変換
            const blob = new Blob([imageData.blobData], { type: imageData.fileType || 'image/jpeg' });
            const base64 = await blobToBase64(blob);
            
            // S3にアップロード
            const response = await fetch(`${REPORT_API}/staff/report-images`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                image: base64,
                category: 'work',
                cleaning_date: cleaningDate
              })
            });
            
            if (!response.ok) {
              throw new Error('Upload failed');
            }
            
            const result = await response.json();
            return result.image.url;
          } catch (error) {
            console.error('Error uploading image:', error);
            return null;
          }
        }
        
        return null;
      })
    );
    
    // nullを除外
    return uploadedUrls.filter(url => url !== null);
  }

  // BlobをBase64に変換
  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
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
})();

