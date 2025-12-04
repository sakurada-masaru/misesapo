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
    setDefaultDate();
  });

  // 店舗読み込み
  async function loadStores() {
    try {
      const res = await fetch(`${API_BASE}/stores`);
      stores = await res.json();
      
      const select = document.getElementById('report-store');
      stores.forEach(store => {
        const opt = document.createElement('option');
        opt.value = store.store_id || store.id;
        opt.textContent = store.store_name || store.name;
        opt.dataset.name = store.store_name || store.name;
        select.appendChild(opt);
      });
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

  // イベントリスナー設定
  function setupEventListeners() {
    // 店舗選択時
    document.getElementById('report-store').addEventListener('change', function() {
      const opt = this.options[this.selectedIndex];
      document.getElementById('report-store-name').value = opt.dataset.name || '';
    });

    // 追加ボタン
    document.getElementById('add-cleaning-item').addEventListener('click', addCleaningItemSection);
    document.getElementById('add-image').addEventListener('click', () => addImageSection());
    document.getElementById('add-comment').addEventListener('click', addCommentSection);
    document.getElementById('add-work-content').addEventListener('click', addWorkContentSection);

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
      let url = `${REPORT_API}/staff/report-images?cleaning_date=${date}`;
      if (category) url += `&category=${category}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to load');

      const data = await response.json();
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
      console.error('Error loading warehouse:', error);
      grid.innerHTML = '<p style="text-align:center;color:#dc2626;padding:20px;">読み込みに失敗しました</p>';
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
      .map(s => ({
        item_name: s.item_name,
        details: {},
        photos: { before: [], after: [] }
      }));

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

      const response = await fetch(`${REPORT_API}/staff/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(reportData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `送信に失敗しました (${response.status})`);
      }

      alert('レポートを提出しました！');
      window.location.href = '/staff/dashboard';

    } catch (error) {
      console.error('[Submit] Error:', error);
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

