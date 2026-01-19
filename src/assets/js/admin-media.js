(function() {
  'use strict';

  // ====== タブ切り替え機能 ======
  const tabButtons = document.querySelectorAll('.media-tabs .tab-btn');
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
        if (content.id === `tab-content-${targetTab}`) {
          content.classList.add('active');
        }
      });
    });
  });

  // ====== サービス画像タブの機能 ======
  (function() {
    // ベースパスを取得（GitHub Pages対応）
    function getBasePath() {
      const base = document.querySelector('base');
      if (base && base.href) {
        try {
          const url = new URL(base.href);
          return url.pathname;
        } catch (e) {
          return base.getAttribute('href') || '/';
        }
      }
      const hostname = window.location.hostname;
      if (hostname === 'misesapo.co.jp' || hostname === 'www.misesapo.co.jp') {
        return '/';
      }
      const path = window.location.pathname;
      if (path.includes('/misesapo/')) {
        return '/misesapo/';
      }
      return '/';
    }
    
    function resolvePath(path) {
      if (!path || path.startsWith('http://') || path.startsWith('https://') || path.startsWith('//')) {
        return path;
      }
      const basePath = getBasePath();
      if (path.startsWith('/')) {
        return basePath === '/' ? path : basePath.slice(0, -1) + path;
      }
      return basePath === '/' ? '/' + path : basePath + path;
    }
    
    async function loadServiceImages() {
      try {
        let response = await fetch(resolvePath('/data/images.json'));
        if (!response.ok) {
          response = await fetch(resolvePath('/api/images'));
        }
        const data = response.ok ? await response.json() : { images: [] };
        
        if (data.images && data.images.length > 0) {
          const imagePaths = data.images.map(img => img.path);
          renderServiceImages(imagePaths);
        } else {
          const grid = document.getElementById('images-grid');
          if (grid) {
            grid.innerHTML = `
              <div class="error-message">
                <i class="fas fa-info-circle"></i>
                <p>画像が見つかりませんでした</p>
              </div>
            `;
          }
        }
      } catch (err) {
        console.error('画像の読み込みに失敗しました:', err);
        const grid = document.getElementById('images-grid');
        if (grid) {
          grid.innerHTML = `
            <div class="error-message">
              <i class="fas fa-exclamation-triangle"></i>
              <p>画像の読み込みに失敗しました: ${err.message}</p>
            </div>
          `;
        }
      }
    }
    
    // 選択状態を管理
    let selectedServiceImages = new Set();
    
    function renderServiceImages(imagePaths) {
      const grid = document.getElementById('images-grid');
      if (!grid) return;
      
      const searchQuery = (document.getElementById('image-search')?.value || '').toLowerCase();
      const filterType = document.getElementById('image-filter')?.value || '';
      
      let filteredImages = imagePaths;
      if (searchQuery) {
        filteredImages = filteredImages.filter(path => 
          path.toLowerCase().includes(searchQuery)
        );
      }
      if (filterType) {
        filteredImages = filteredImages.filter(path => 
          path.toLowerCase().endsWith('.' + filterType)
        );
      }
      
      const countEl = document.getElementById('total-count');
      if (countEl) {
        countEl.textContent = filteredImages.length;
      }
      
      grid.innerHTML = filteredImages.map(path => {
        const fileName = path.split('/').pop();
        const fileExt = fileName.split('.').pop().toLowerCase();
        const resolvedPath = resolvePath(path);
        const isSelected = selectedServiceImages.has(path);
        return `
          <div class="image-card ${isSelected ? 'selected' : ''}" data-path="${path}">
            <div class="image-card-checkbox ${isSelected ? 'checked' : ''}" data-path="${path}">
              ${isSelected ? '<i class="fas fa-check"></i>' : ''}
            </div>
            <div class="image-card-thumb">
              <img src="${resolvedPath}" alt="${fileName}" loading="lazy" onerror="this.src='${resolvePath('/images/service-300x200.svg')}'" />
              <div class="image-card-overlay">
                <i class="fas fa-eye"></i>
              </div>
            </div>
            <div class="image-card-info">
              <div class="image-card-name" title="${fileName}">${fileName}</div>
              <div class="image-card-path" title="${path}">${path}</div>
              <div class="image-card-badge">${fileExt.toUpperCase()}</div>
            </div>
          </div>
        `;
      }).join('');
      
      // チェックボックスのイベントリスナー
      document.querySelectorAll('.image-card-checkbox').forEach(checkbox => {
        checkbox.addEventListener('click', function(e) {
          e.stopPropagation();
          const path = this.dataset.path;
          toggleServiceImageSelection(path);
        });
      });
      
      document.querySelectorAll('.image-card').forEach(card => {
        card.addEventListener('click', function(e) {
          // チェックボックスがクリックされた場合は無視
          if (e.target.closest('.image-card-checkbox')) return;
          
          const path = this.dataset.path;
          const fileName = path.split('/').pop();
          
          const urlParams = new URLSearchParams(window.location.search);
          if (urlParams.get('selectMode') === 'true') {
            if (window.parent && window.parent !== window) {
              window.parent.postMessage({
                type: 'image-selected',
                path: path
              }, '*');
            }
            return;
          }
          
          openServiceImageModal(path, fileName);
        });
      });
      
      updateServiceSelectionToolbar();
    }
    
    function toggleServiceImageSelection(path) {
      if (selectedServiceImages.has(path)) {
        selectedServiceImages.delete(path);
      } else {
        selectedServiceImages.add(path);
      }
      renderServiceImages(Array.from(document.querySelectorAll('.image-card')).map(card => card.dataset.path));
    }
    
    function selectAllServiceImages() {
      const allPaths = Array.from(document.querySelectorAll('.image-card')).map(card => card.dataset.path);
      allPaths.forEach(path => selectedServiceImages.add(path));
      renderServiceImages(allPaths);
    }
    
    function deselectAllServiceImages() {
      selectedServiceImages.clear();
      const allPaths = Array.from(document.querySelectorAll('.image-card')).map(card => card.dataset.path);
      renderServiceImages(allPaths);
    }
    
    function updateServiceSelectionToolbar() {
      const toolbar = document.getElementById('service-selection-toolbar');
      const countEl = document.getElementById('service-selected-count');
      
      if (toolbar && countEl) {
        const count = selectedServiceImages.size;
        countEl.textContent = count;
        toolbar.style.display = count > 0 ? 'flex' : 'none';
      }
    }
    
    async function deleteSelectedServiceImages() {
      const selected = Array.from(selectedServiceImages);
      if (selected.length === 0) return;
      
      if (!confirm(`${selected.length}件の画像を削除しますか？この操作は取り消せません。`)) {
        return;
      }
      
      let successCount = 0;
      let errorCount = 0;
      
      for (const imagePath of selected) {
        try {
          // サービス画像の削除APIを呼び出す
          // パスからファイル名を抽出
          const fileName = imagePath.split('/').pop();
          const response = await fetch(`${API_GATEWAY_ENDPOINT}/images/${encodeURIComponent(fileName)}`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok || response.status === 404) {
            // 404の場合は既に削除されているとみなす
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          console.error('Delete error:', error);
          errorCount++;
        }
      }
      
      selectedServiceImages.clear();
      loadServiceImages();
      
      if (successCount > 0) {
        alert(`${successCount}件の画像を削除しました${errorCount > 0 ? `（${errorCount}件失敗）` : ''}`);
      } else {
        alert('削除に失敗しました');
      }
    }
    
    document.getElementById('btn-select-all-service')?.addEventListener('click', selectAllServiceImages);
    document.getElementById('btn-deselect-all-service')?.addEventListener('click', deselectAllServiceImages);
    document.getElementById('btn-delete-selected-service')?.addEventListener('click', deleteSelectedServiceImages);
    
    function openServiceImageModal(path, fileName) {
      const modal = document.getElementById('image-modal');
      const img = document.getElementById('image-modal-img');
      const title = document.getElementById('image-modal-title');
      const pathEl = document.getElementById('image-modal-path');
      const downloadLink = document.getElementById('image-download-link');
      
      if (!modal || !img || !title || !pathEl || !downloadLink) return;
      
      const resolvedPath = resolvePath(path);
      img.src = resolvedPath;
      img.alt = fileName;
      title.textContent = fileName;
      pathEl.textContent = path;
      downloadLink.href = resolvedPath;
      downloadLink.download = fileName;
      
      modal.classList.remove('hidden');
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
    
    function closeServiceImageModal() {
      const modal = document.getElementById('image-modal');
      if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('open');
        document.body.style.overflow = '';
      }
    }
    
    document.getElementById('image-copy-path')?.addEventListener('click', function() {
      const path = document.getElementById('image-modal-path')?.textContent;
      if (path) {
        navigator.clipboard.writeText(path).then(() => {
          const btn = this;
          const originalText = btn.innerHTML;
          btn.innerHTML = '<i class="fas fa-check"></i> コピーしました';
          btn.classList.add('btn-success');
          setTimeout(() => {
            btn.innerHTML = originalText;
            btn.classList.remove('btn-success');
          }, 2000);
        });
      }
    });
    
    document.getElementById('image-modal-close')?.addEventListener('click', closeServiceImageModal);
    document.querySelector('.image-modal-overlay')?.addEventListener('click', closeServiceImageModal);
    
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        const modal = document.getElementById('image-modal');
        if (modal && modal.classList.contains('open')) {
          closeServiceImageModal();
        }
      }
    });
    
    document.getElementById('image-search')?.addEventListener('input', loadServiceImages);
    document.getElementById('image-filter')?.addEventListener('change', loadServiceImages);
    
    // アップロード機能
    const API_GATEWAY_ENDPOINT = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';
    let pendingFiles = [];
    
    document.getElementById('btn-upload-image')?.addEventListener('click', function() {
      const modal = document.getElementById('upload-modal');
      if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('open');
        document.body.style.overflow = 'hidden';
        pendingFiles = [];
        updateUploadPreview();
      }
    });
    
    function closeUploadModal() {
      const modal = document.getElementById('upload-modal');
      if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('open');
        document.body.style.overflow = '';
        pendingFiles = [];
        updateUploadPreview();
      }
    }
    
    document.getElementById('upload-modal-close')?.addEventListener('click', closeUploadModal);
    document.querySelector('.upload-modal-overlay')?.addEventListener('click', closeUploadModal);
    document.getElementById('btn-cancel-upload')?.addEventListener('click', closeUploadModal);
    
    document.getElementById('btn-select-files')?.addEventListener('click', function() {
      document.getElementById('upload-file-input')?.click();
    });
    
    document.getElementById('upload-file-input')?.addEventListener('change', function(e) {
      const files = Array.from(e.target.files || []);
      addFilesToPending(files);
      e.target.value = '';
    });
    
    const dropzone = document.getElementById('upload-dropzone');
    if (dropzone) {
      dropzone.addEventListener('dragover', function(e) {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
      
      dropzone.addEventListener('dragleave', function(e) {
        e.preventDefault();
        dropzone.classList.remove('dragover');
      });
      
      dropzone.addEventListener('drop', function(e) {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files || []).filter(f => f.type.startsWith('image/'));
        addFilesToPending(files);
      });
    }
    
    function addFilesToPending(files) {
      files.forEach(file => {
        if (file.type.startsWith('image/')) {
          pendingFiles.push({
            file: file,
            name: file.name,
            preview: URL.createObjectURL(file)
          });
        }
      });
      updateUploadPreview();
    }
    
    function updateUploadPreview() {
      const list = document.getElementById('upload-preview-list');
      const confirmBtn = document.getElementById('btn-confirm-upload');
      
      if (!list || !confirmBtn) return;
      
      if (pendingFiles.length === 0) {
        list.innerHTML = '';
        confirmBtn.disabled = true;
        return;
      }
      
      confirmBtn.disabled = false;
      list.innerHTML = pendingFiles.map((item, idx) => `
        <div class="upload-preview-item">
          <img src="${item.preview}" alt="${item.name}" />
          <div class="upload-preview-info">
            <span class="upload-preview-name">${item.name}</span>
          </div>
          <button type="button" class="upload-preview-remove" data-index="${idx}">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `).join('');
      
      list.querySelectorAll('.upload-preview-remove').forEach(btn => {
        btn.addEventListener('click', function() {
          const idx = parseInt(this.dataset.index);
          URL.revokeObjectURL(pendingFiles[idx].preview);
          pendingFiles.splice(idx, 1);
          updateUploadPreview();
        });
      });
    }
    
    document.getElementById('btn-confirm-upload')?.addEventListener('click', async function() {
      if (pendingFiles.length === 0) return;
      
      const btn = this;
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> アップロード中...';
      
      let successCount = 0;
      let errorCount = 0;
      
      for (const item of pendingFiles) {
        try {
          await uploadServiceImage(item.file);
          successCount++;
        } catch (error) {
          console.error('Upload error:', error);
          errorCount++;
        }
      }
      
      btn.innerHTML = '<i class="fas fa-upload"></i> アップロード';
      btn.disabled = false;
      
      if (successCount > 0) {
        alert(`${successCount}件の画像をアップロードしました${errorCount > 0 ? `（${errorCount}件失敗）` : ''}`);
        closeUploadModal();
        loadServiceImages();
      } else {
        alert('アップロードに失敗しました');
      }
    });
    
    async function uploadServiceImage(file) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'reports');
      
      const response = await fetch(`${API_GATEWAY_ENDPOINT}/upload`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      return await response.json();
    }
    
    // 初期読み込み
    loadServiceImages();
  })();

  // ====== レポート画像タブの機能 ======
  (function() {
    const REPORT_API = 'https://2z0ui5xfxb.execute-api.ap-northeast-1.amazonaws.com/prod';
    let currentReportImages = [];
    let currentReportFilter = 'all';
    let currentReportDate = '';
    let currentReportFolder = '';
    let availableReportFolders = [];
    let selectedReportImageId = null;

    async function getFirebaseIdToken() {
      try {
        const cognitoIdToken = localStorage.getItem('cognito_id_token');
        if (cognitoIdToken) return cognitoIdToken;
        
        const cognitoUser = localStorage.getItem('cognito_user');
        if (cognitoUser) {
          try {
            const parsed = JSON.parse(cognitoUser);
            if (parsed.tokens && parsed.tokens.idToken) return parsed.tokens.idToken;
            if (parsed.idToken) return parsed.idToken;
          } catch (e) {
            console.warn('Error parsing cognito user:', e);
          }
        }
        
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
        
        const authData = localStorage.getItem('misesapo_auth');
        if (authData) {
          try {
            const parsed = JSON.parse(authData);
            if (parsed.token) return parsed.token;
          } catch (e) {
            console.warn('Error parsing auth data:', e);
          }
        }
        
        return 'dev-token';
      } catch (error) {
        console.error('Error getting ID token:', error);
        return 'dev-token';
      }
    }

    async function calculateImageHash(blob) {
      const arrayBuffer = await blob.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function blobToBase64(blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result;
          const base64 = dataUrl.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }

    async function optimizeImage(file, maxWidth = 1920, quality = 0.85) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
              height = (height * maxWidth) / width;
              width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob((blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('画像の最適化に失敗しました'));
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

    async function checkDuplicateImage(imageHash) {
      const cleaningDate = currentReportDate || new Date().toISOString().split('T')[0];
      let url = `${REPORT_API}/staff/report-images?date=${cleaningDate}`;
      
      try {
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${await getFirebaseIdToken()}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          const images = data.images || [];
          return images.some(img => img.image_hash === imageHash);
        }
      } catch (error) {
        console.warn('Duplicate check error:', error);
      }
      return false;
    }

    async function uploadReportImage(file) {
      try {
        const optimizedBlob = await optimizeImage(file);
        const imageHash = await calculateImageHash(optimizedBlob);
        
        const isDuplicate = await checkDuplicateImage(imageHash);
        if (isDuplicate) {
          throw new Error('この画像は既にアップロードされています');
        }
        
        const base64 = await blobToBase64(optimizedBlob);
        const cleaningDate = currentReportDate || new Date().toISOString().split('T')[0];
        const folderName = currentReportFolder || null;
        
        let category = currentReportFilter;
        if (category === 'all') {
          category = 'after';
        }

        const requestBody = {
          image: base64,
          category: category,
          cleaning_date: cleaningDate,
          folder_name: folderName,
          image_hash: imageHash
        };

        const response = await fetch(`${REPORT_API}/staff/report-images`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await getFirebaseIdToken()}`
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          if (errorData.error && errorData.error.includes('重複')) {
            throw new Error('この画像は既にアップロードされています');
          }
          throw new Error(errorData.error || 'アップロードに失敗しました');
        }

        const result = await response.json();
        return result.image || result;
      } catch (error) {
        console.error('Upload error:', error);
        throw error;
      }
    }

    async function loadReportFolders() {
      try {
        const cleaningDate = currentReportDate || new Date().toISOString().split('T')[0];
        let url = `${REPORT_API}/staff/report-images?date=${cleaningDate}`;
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${await getFirebaseIdToken()}`
          }
        });

        if (!response.ok) {
          throw new Error('フォルダの取得に失敗しました');
        }

        const data = await response.json();
        const images = data.images || [];
        
        const folderSet = new Set();
        images.forEach(img => {
          if (img.folder_name) {
            folderSet.add(img.folder_name);
          }
        });
        
        availableReportFolders = Array.from(folderSet).sort();
        updateReportFolderSelect();
      } catch (error) {
        console.error('Load folders error:', error);
      }
    }

    function updateReportFolderSelect() {
      const select = document.getElementById('report-folder-select');
      if (!select) return;
      
      const currentValue = select.value;
      select.innerHTML = '<option value="">全てのフォルダ</option>';
      
      availableReportFolders.forEach(folder => {
        const option = document.createElement('option');
        option.value = folder;
        option.textContent = folder;
        select.appendChild(option);
      });
      
      if (currentValue && availableReportFolders.includes(currentValue)) {
        select.value = currentValue;
      }
    }

    async function loadReportImages() {
      const grid = document.getElementById('report-media-grid');
      if (!grid) return;
      
      grid.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i><p>読み込み中...</p></div>';

      try {
        const cleaningDate = currentReportDate || new Date().toISOString().split('T')[0];
        let url = `${REPORT_API}/staff/report-images?date=${cleaningDate}`;
        if (currentReportFilter !== 'all') {
          url += `&category=${currentReportFilter}`;
        }
        if (currentReportFolder) {
          url += `&folder_name=${encodeURIComponent(currentReportFolder)}`;
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
        currentReportImages = data.images || [];

        renderReportImages();
      } catch (error) {
        console.error('Load error:', error);
        grid.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-circle"></i><p>画像の読み込みに失敗しました</p></div>';
      }
    }

    // 選択状態を管理
    let selectedReportImages = new Set();
    
    function renderReportImages() {
      const grid = document.getElementById('report-media-grid');
      if (!grid) return;

      if (currentReportImages.length === 0) {
        grid.innerHTML = '<div class="empty-state"><i class="fas fa-images"></i><p>画像がありません</p></div>';
        updateReportSelectionToolbar();
        return;
      }

      grid.innerHTML = currentReportImages.map(img => {
        const categoryLabel = img.category === 'before' ? '作業前' : '作業後';
        const isSelected = selectedReportImages.has(img.image_id);
        return `
          <div class="report-media-item ${isSelected ? 'selected' : ''}" data-image-id="${img.image_id}">
            <div class="report-media-item-checkbox ${isSelected ? 'checked' : ''}" data-image-id="${img.image_id}">
              ${isSelected ? '<i class="fas fa-check"></i>' : ''}
            </div>
            <img src="${img.url}" alt="Image" loading="lazy">
            <div class="report-media-item-category">${categoryLabel}</div>
            <div class="report-media-item-overlay">
              <i class="fas fa-search-plus" style="color:#fff; font-size:2rem;"></i>
            </div>
          </div>
        `;
      }).join('');
      
      // チェックボックスのイベントリスナー
      document.querySelectorAll('.report-media-item-checkbox').forEach(checkbox => {
        checkbox.addEventListener('click', function(e) {
          e.stopPropagation();
          const imageId = this.dataset.imageId;
          toggleReportImageSelection(imageId);
        });
      });
      
      // 画像アイテムのクリックイベント
      document.querySelectorAll('.report-media-item').forEach(item => {
        item.addEventListener('click', function(e) {
          // チェックボックスがクリックされた場合は無視
          if (e.target.closest('.report-media-item-checkbox')) return;
          
          const imageId = this.dataset.imageId;
          const image = currentReportImages.find(img => img.image_id === imageId);
          if (image) {
            openReportImagePreview(imageId, image.url);
          }
        });
      });
      
      updateReportSelectionToolbar();
    }
    
    function toggleReportImageSelection(imageId) {
      if (selectedReportImages.has(imageId)) {
        selectedReportImages.delete(imageId);
      } else {
        selectedReportImages.add(imageId);
      }
      renderReportImages();
    }
    
    function selectAllReportImages() {
      currentReportImages.forEach(img => selectedReportImages.add(img.image_id));
      renderReportImages();
    }
    
    function deselectAllReportImages() {
      selectedReportImages.clear();
      renderReportImages();
    }
    
    function updateReportSelectionToolbar() {
      const toolbar = document.getElementById('report-selection-toolbar');
      const countEl = document.getElementById('report-selected-count');
      
      if (toolbar && countEl) {
        const count = selectedReportImages.size;
        countEl.textContent = count;
        toolbar.style.display = count > 0 ? 'flex' : 'none';
      }
    }
    
    async function deleteSelectedReportImages() {
      const selected = Array.from(selectedReportImages);
      if (selected.length === 0) return;
      
      if (!confirm(`${selected.length}件の画像を削除しますか？この操作は取り消せません。`)) {
        return;
      }
      
      let successCount = 0;
      let errorCount = 0;
      let corsErrorCount = 0;
      const errors = [];
      
      for (const imageId of selected) {
        try {
          const token = await getFirebaseIdToken();
          const response = await fetch(`${REPORT_API}/staff/report-images/${imageId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            mode: 'cors'
          });
          
          if (response.ok) {
            successCount++;
          } else {
            const errorText = await response.text().catch(() => '');
            console.error(`Delete failed for ${imageId}:`, response.status, errorText);
            errorCount++;
            errors.push(`${imageId} (HTTP ${response.status})`);
          }
        } catch (error) {
          console.error('Delete error:', error);
          errorCount++;
          
          // CORSエラーの検出（より確実に検出）
          const errorMessage = error.message || '';
          const errorName = error.name || '';
          const isCorsError = 
            errorMessage.includes('CORS') || 
            errorMessage.includes('Failed to fetch') ||
            errorMessage.includes('network') ||
            errorMessage.includes('NetworkError') ||
            (errorName === 'TypeError' && errorMessage.includes('fetch')) ||
            (errorName === 'TypeError' && !errorMessage); // TypeErrorでメッセージがない場合もCORSの可能性が高い
          
          if (isCorsError) {
            corsErrorCount++;
            errors.push(`${imageId} (CORSエラー)`);
            console.warn(`CORS error detected for ${imageId}. This is a backend configuration issue.`);
          } else {
            errors.push(`${imageId} (${errorMessage || errorName || 'Unknown error'})`);
          }
        }
      }
      
      selectedReportImages.clear();
      loadReportImages();
      
      // CORSエラーがすべてのリクエストで発生している場合
      if (corsErrorCount === selected.length && successCount === 0) {
        alert(`画像の削除に失敗しました。\n\n原因: CORS（Cross-Origin Resource Sharing）エラー\n\nこのエラーは、バックエンド側のAPI Gateway設定が原因です。\n以下の設定が必要です：\n\n1. API Gatewayで /staff/report-images/{image_id} リソースのDELETEメソッドに対して\n2. OPTIONSメソッドを追加し、CORSヘッダーを設定\n3. DELETEメソッドのレスポンスにもCORSヘッダーを追加\n4. API Gatewayをデプロイ\n\n詳細は、AWS API Gatewayコンソールで確認してください。`);
        return;
      }
      
      if (successCount > 0) {
        if (errorCount > 0) {
          const corsMessage = corsErrorCount > 0 ? `\n\n注意: ${corsErrorCount}件のCORSエラーが発生しました。バックエンドのAPI Gateway設定を確認してください。` : '';
          alert(`${successCount}件の画像を削除しました。${errorCount}件の削除に失敗しました。${corsMessage}`);
        } else {
          alert(`${successCount}件の画像を削除しました`);
        }
      } else {
        const corsMessage = corsErrorCount > 0 ? `\n\n原因: CORSエラーが発生しています。バックエンドのAPI Gateway設定を確認してください。` : '';
        alert(`削除に失敗しました。${corsMessage}`);
      }
    }
    
    document.getElementById('btn-select-all-report')?.addEventListener('click', selectAllReportImages);
    document.getElementById('btn-deselect-all-report')?.addEventListener('click', deselectAllReportImages);
    document.getElementById('btn-delete-selected-report')?.addEventListener('click', deleteSelectedReportImages);

    window.openReportImagePreview = function(imageId, imageUrl) {
      selectedReportImageId = imageId;
      const modal = document.getElementById('report-image-preview-modal');
      const previewImg = document.getElementById('preview-report-image');
      const imageInfo = document.getElementById('report-image-info');
      const image = currentReportImages.find(img => img.image_id === imageId);

      if (modal && previewImg && imageInfo && image) {
        previewImg.src = imageUrl;
        const date = new Date(image.cleaning_date).toLocaleDateString('ja-JP');
        const categoryLabel = image.category === 'before' ? '作業前' : '作業後';
        const folderName = image.folder_name || 'フォルダなし';
        imageInfo.innerHTML = `
          <div><strong>カテゴリ:</strong> ${categoryLabel}</div>
          <div><strong>フォルダ:</strong> ${folderName}</div>
          <div><strong>日付:</strong> ${date}</div>
          <div><strong>アップロード日時:</strong> ${new Date(image.uploaded_at).toLocaleString('ja-JP')}</div>
        `;
        modal.style.display = 'flex';
        
        // 削除ボタンのイベントリスナーを更新
        const deleteBtn = document.getElementById('delete-report-image-btn');
        if (deleteBtn) {
          deleteBtn.onclick = () => {
            deleteReportImage(imageId);
          };
        }
      }
    };

    window.closeReportImagePreview = function() {
      const modal = document.getElementById('report-image-preview-modal');
      if (modal) {
        modal.style.display = 'none';
        selectedReportImageId = null;
      }
    };

    async function deleteReportImage(imageId) {
      if (!confirm('この画像を削除しますか？')) {
        return;
      }

      try {
        const response = await fetch(`${REPORT_API}/staff/report-images/${imageId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${await getFirebaseIdToken()}`
          }
        });

        if (!response.ok) {
          if (response.status === 404 || response.status === 405) {
            alert('画像削除機能は現在利用できません。バックエンドの実装をお待ちください。');
            return;
          }
          throw new Error('削除に失敗しました');
        }

        closeReportImagePreview();
        loadReportImages();
        alert('画像を削除しました');
      } catch (error) {
        console.error('Delete error:', error);
        alert('画像の削除に失敗しました。バックエンドの実装をお待ちください。');
      }
    }

    window.openCreateReportFolderModal = function() {
      const modal = document.getElementById('create-report-folder-modal');
      const input = document.getElementById('new-report-folder-name');
      if (modal && input) {
        input.value = '';
        modal.style.display = 'flex';
        input.focus();
      }
    };

    window.closeCreateReportFolderModal = function() {
      const modal = document.getElementById('create-report-folder-modal');
      if (modal) {
        modal.style.display = 'none';
      }
    };

    document.getElementById('create-report-folder-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'create-report-folder-modal') {
        closeCreateReportFolderModal();
      }
    });

    async function createReportFolder() {
      const input = document.getElementById('new-report-folder-name');
      if (!input) return;
      
      const folderName = input.value.trim();
      
      if (!folderName) {
        alert('フォルダ名を入力してください');
        return;
      }

      if (folderName.length > 50) {
        alert('フォルダ名は50文字以内で入力してください');
        return;
      }

      if (availableReportFolders.includes(folderName)) {
        alert('このフォルダ名は既に存在します');
        return;
      }

      availableReportFolders.push(folderName);
      availableReportFolders.sort();
      updateReportFolderSelect();
      
      const select = document.getElementById('report-folder-select');
      if (select) {
        select.value = folderName;
        currentReportFolder = folderName;
      }
      
      closeCreateReportFolderModal();
      loadReportImages();
    }

    // イベントリスナー
    document.getElementById('report-media-file-input')?.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      const grid = document.getElementById('report-media-grid');
      if (!grid) return;
      
      const originalContent = grid.innerHTML;
      grid.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i><p>アップロード中...</p></div>';

      let successCount = 0;
      let errorCount = 0;
      let duplicateCount = 0;
      const errorMessages = [];

      for (const file of files) {
        try {
          await uploadReportImage(file);
          successCount++;
        } catch (error) {
          console.error('Upload error:', error);
          errorCount++;
          const errorMessage = error.message || 'アップロードに失敗しました';
          
          if (errorMessage.includes('既にアップロードされています') || errorMessage.includes('重複')) {
            duplicateCount++;
          } else {
            errorMessages.push(`${file.name}: ${errorMessage}`);
          }
        }
      }

      e.target.value = '';
      loadReportFolders();
      loadReportImages();

      if (errorCount > 0 || duplicateCount > 0) {
        let message = `${successCount}件の画像をアップロードしました`;
        if (duplicateCount > 0) {
          message += `\n${duplicateCount}件の画像は既にアップロード済みのためスキップしました`;
        }
        if (errorMessages.length > 0) {
          message += `\n\nエラー:\n${errorMessages.slice(0, 3).join('\n')}`;
          if (errorMessages.length > 3) {
            message += `\n...他${errorMessages.length - 3}件`;
          }
        }
        alert(message);
      } else if (successCount > 0) {
        alert(`${successCount}件の画像をアップロードしました`);
      }
    });

    document.querySelectorAll('.filter-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentReportFilter = btn.dataset.filter;
        loadReportImages();
      });
    });

    document.getElementById('report-media-date-filter')?.addEventListener('change', (e) => {
      currentReportDate = e.target.value;
      currentReportFolder = '';
      const select = document.getElementById('report-folder-select');
      if (select) {
        select.value = '';
      }
      loadReportFolders();
      loadReportImages();
    });

    document.getElementById('report-folder-select')?.addEventListener('change', (e) => {
      currentReportFolder = e.target.value;
      loadReportImages();
    });

    document.getElementById('btn-create-report-folder')?.addEventListener('click', openCreateReportFolderModal);
    document.getElementById('confirm-create-report-folder-btn')?.addEventListener('click', createReportFolder);

    document.getElementById('new-report-folder-name')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        createReportFolder();
      }
    });

    document.getElementById('delete-report-image-btn')?.addEventListener('click', () => {
      if (selectedReportImageId) {
        deleteReportImage(selectedReportImageId);
      }
    });

    // 初期化
    const dateFilter = document.getElementById('report-media-date-filter');
    if (dateFilter) {
      dateFilter.value = new Date().toISOString().split('T')[0];
      currentReportDate = new Date().toISOString().split('T')[0];
      loadReportFolders();
      loadReportImages();
    }
  })();
})();

