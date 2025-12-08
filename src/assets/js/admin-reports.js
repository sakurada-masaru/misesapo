(function() {
    const API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';
    const REPORT_API = 'https://2z0ui5xfxb.execute-api.ap-northeast-1.amazonaws.com/prod';
    let allReports = [];
    let allStores = [];
    let allWorkers = [];
    let allServiceItems = [];
    let filteredReports = [];
    let currentPage = 1;
    const perPage = 20;
    let currentReportId = null;

    // 初期化
    document.addEventListener('DOMContentLoaded', async () => {
      await Promise.all([loadReports(), loadStores(), loadWorkers(), loadServiceItems()]);
      setupEventListeners();
        
  });

    // サービス項目をロード
    async function loadServiceItems() {
      try {
        const res = await fetch('/data/service_items.json');
        if (res.ok) {
          allServiceItems = await res.json();
        }
      } catch (err) {
        console.warn('Failed to load service items:', err);
        allServiceItems = [];
      }
    }

    async function loadReports() {
      try {
        // 新レポートAPI（あなたが作ったシステム）からデータ取得
        const res = await fetch(`${REPORT_API}/staff/reports`, {
          headers: { 'Authorization': 'Bearer mock-token' }
        });
        const data = await res.json();
        allReports = data.items || [];
        
        // データ形式を統一
        allReports = allReports.map(r => ({
          ...r,
          id: r.report_id || r.id,
          store_id: r.store_id,
          worker_id: r.staff_id,
          work_date: r.cleaning_date,
          start_time: r.cleaning_start_time,
          end_time: r.cleaning_end_time,
          content: r.work_items?.map(w => w.name).join(', ') || '',
          notes: r.work_memo,
          status: r.status === 'published' ? 'approved' : r.status,
          resubmitted: r.resubmitted || false  // 再提出フラグを保持
        }));
        
        updateStats();
        filterAndRender();
      } catch (e) {
        console.error('Failed to load reports:', e);
        document.getElementById('reports-tbody').innerHTML = '<tr><td colspan="6" class="loading-cell">読み込みに失敗しました</td></tr>';
      }
    }

    async function loadStores() {
      try {
        const res = await fetch(`${API_BASE}/stores`);
        const storesData = await res.json();
        // レスポンスが配列でない場合の処理（itemsやstoresプロパティから取得）
        allStores = Array.isArray(storesData) ? storesData : (storesData.items || storesData.stores || []);
        populateStoreFilters();
      } catch (e) {
        console.error('Failed to load stores:', e);
        allStores = []; // エラー時は空配列を設定
      }
    }

    async function loadWorkers() {
      try {
        const res = await fetch(`${API_BASE}/workers`);
        const workersData = await res.json();
        // レスポンスが配列でない場合の処理（itemsやworkersプロパティから取得）
        allWorkers = Array.isArray(workersData) ? workersData : (workersData.items || workersData.workers || []);
        populateWorkerSelect();
      } catch (e) {
        console.error('Failed to load workers:', e);
        allWorkers = []; // エラー時は空配列を設定
      }
    }

    function populateStoreFilters() {
      const filterSelect = document.getElementById('filter-store');
      const formSelect = document.getElementById('report-store');
      const options = allStores.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
      filterSelect.innerHTML = '<option value="">すべての店舗</option>' + options;
      formSelect.innerHTML = '<option value="">選択してください</option>' + options;
    }

    function populateWorkerSelect() {
      const select = document.getElementById('report-worker');
      if (!select) return; // 新しいモーダルには存在しないので、nullチェック
      
      // 担当業務に「清掃」が含まれる人を抽出
      const cleaningWorkers = allWorkers.filter(w => {
        const job = w.job || '';
        
        // jobが文字列の場合
        if (typeof job === 'string') {
          return job.includes('清掃') || job.toLowerCase().includes('cleaning');
        }
        
        // jobが配列の場合
        if (Array.isArray(job)) {
          return job.some(j => 
            (typeof j === 'string' && (j.includes('清掃') || j.toLowerCase().includes('cleaning')))
          );
        }
        
        return false;
      });
      
      // 万が一 清掃担当者が一人もいない場合は、従来どおり全件を使う（フォールバック）
      const workersToShow = cleaningWorkers.length > 0 ? cleaningWorkers : allWorkers;
      
      select.innerHTML = '<option value="">担当者を選択</option>' + 
        workersToShow.map(w => `<option value="${w.id}">${escapeHtml(w.name || '')}</option>`).join('');
    }

    function updateStats() {
      document.getElementById('stat-total').textContent = allReports.length;
      document.getElementById('stat-pending').textContent = allReports.filter(r => !r.send_at && r.status !== 'approved').length;
      document.getElementById('stat-approved').textContent = allReports.filter(r => r.send_at || r.status === 'approved').length;
      
      const thisMonth = new Date().toISOString().slice(0, 7);
      document.getElementById('stat-thismonth').textContent = allReports.filter(r => 
        (r.work_date || r.created_at || '').startsWith(thisMonth)
      ).length;
    }

    function filterAndRender() {
      const search = document.getElementById('search-input').value.toLowerCase();
      const status = document.getElementById('filter-status').value;
      const storeId = document.getElementById('filter-store').value;
      const dateFrom = document.getElementById('filter-date-from').value;
      const dateTo = document.getElementById('filter-date-to').value;

      filteredReports = allReports.filter(r => {
        const store = allStores.find(s => s.id === r.store_id) || {};
        const worker = allWorkers.find(w => w.id === r.worker_id) || {};
        
        // 検索
        if (search) {
          const searchStr = `${store.name || ''} ${worker.name || ''}`.toLowerCase();
          if (!searchStr.includes(search)) return false;
        }
        
        // ステータス
        if (status) {
          const reportStatus = r.send_at || r.status === 'approved' ? 'approved' : (r.status === 'rejected' ? 'rejected' : 'pending');
          if (reportStatus !== status) return false;
        }
        
        // 店舗
        if (storeId && String(r.store_id) !== storeId) return false;
        
        // 日付範囲
        const workDate = r.work_date || r.created_at?.split('T')[0] || '';
        if (dateFrom && workDate < dateFrom) return false;
        if (dateTo && workDate > dateTo) return false;
        
        return true;
      });

      // 日付でソート（新しい順）
      filteredReports.sort((a, b) => {
        const dateA = a.work_date || a.created_at || '';
        const dateB = b.work_date || b.created_at || '';
        return dateB.localeCompare(dateA);
      });

      currentPage = 1;
      renderTable();
      renderPagination();
    }

    function renderTable() {
      const tbody = document.getElementById('reports-tbody');
      const start = (currentPage - 1) * perPage;
      const pageReports = filteredReports.slice(start, start + perPage);

      if (pageReports.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading-cell">レポートがありません</td></tr>';
        return;
      }

      tbody.innerHTML = pageReports.map(r => {
        // DataUtilsで正規化（フォールバック付き）
        const normalized = (window.DataUtils && window.DataUtils.normalizeReport) 
          ? window.DataUtils.normalizeReport(r)
          : {
              id: r.report_id || r.id,
              worker_id: r.staff_id || r.worker_id,
              date: r.cleaning_date || r.work_date || r.created_at?.split('T')[0],
              start_time: r.cleaning_start_time || r.start_time,
              end_time: r.cleaning_end_time || r.end_time,
              status: r.status,
              store_name: r.store_name
            };
        const store = (window.DataUtils && window.DataUtils.findStore) 
          ? window.DataUtils.findStore(allStores, r.store_id) || {}
          : allStores.find(s => s.id === r.store_id) || {};
        const worker = allWorkers.find(w => w.id === normalized.worker_id) || {};
        const status = normalized.status === 'approved' ? 'approved' : (normalized.status === 'rejected' ? 'rejected' : 'pending');
        const statusLabel = (window.DataUtils && window.DataUtils.getStatusLabel)
          ? window.DataUtils.getStatusLabel(status)
          : (status === 'approved' ? '承認済み' : status === 'rejected' ? '却下' : '承認待ち');
        const displayStoreName = (window.DataUtils && window.DataUtils.getStoreName)
          ? window.DataUtils.getStoreName(allStores, r.store_id, normalized.store_name)
          : (store.name || normalized.store_name || r.store_name || '-');
        
        // 再提出通知バッジ
        const resubmittedBadge = (r.resubmitted || normalized.resubmitted) 
          ? '<span class="resubmitted-badge" title="清掃員から再提出されました"><i class="fas fa-bell"></i> 再提出</span>' 
          : '';

        return `
          <tr ${(r.resubmitted || normalized.resubmitted) ? 'class="resubmitted-row"' : ''}>
            <td>${(window.DataUtils && window.DataUtils.formatDate) ? window.DataUtils.formatDate(normalized.date) : formatDate(normalized.date)}</td>
            <td>${(window.DataUtils && window.DataUtils.escapeHtml) ? window.DataUtils.escapeHtml(displayStoreName) : escapeHtml(displayStoreName)}</td>
            <td>${(window.DataUtils && window.DataUtils.escapeHtml) ? window.DataUtils.escapeHtml(worker.name || normalized.worker_name || '-') : escapeHtml(worker.name || normalized.worker_name || '-')}</td>
            <td>${normalized.start_time || '-'} 〜 ${normalized.end_time || '-'}</td>
            <td>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="status-badge status-${status}">${statusLabel}</span>
                ${resubmittedBadge}
              </div>
            </td>
            <td>
              <div class="action-btns">
                <button class="action-btn view" title="詳細" onclick="viewReport('${r.id}')"><i class="fas fa-eye"></i></button>
                <button class="action-btn edit" title="編集" onclick="editReport('${r.id}')"><i class="fas fa-edit"></i></button>
                <button class="action-btn comment" title="コメント" onclick="viewFeedback('${r.id}')"><i class="fas fa-comment"></i></button>
                <button class="action-btn share" title="URL発行" onclick="shareReport('${r.id}')"><i class="fas fa-share-alt"></i></button>
                <button class="action-btn delete" title="削除" onclick="deleteReport('${r.id}')"><i class="fas fa-trash"></i></button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    function renderPagination() {
      const totalPages = Math.ceil(filteredReports.length / perPage);
      const pagination = document.getElementById('pagination');
      
      if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
      }

      let html = '';
      if (currentPage > 1) {
        html += `<button class="page-btn" onclick="goToPage(${currentPage - 1})"><i class="fas fa-chevron-left"></i></button>`;
      }
      
      for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
          html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
          html += '<span style="padding:8px">...</span>';
        }
      }
      
      if (currentPage < totalPages) {
        html += `<button class="page-btn" onclick="goToPage(${currentPage + 1})"><i class="fas fa-chevron-right"></i></button>`;
      }
      
      pagination.innerHTML = html;
    }

    window.goToPage = function(page) {
      currentPage = page;
      renderTable();
      renderPagination();
    };

    // フィードバック表示
    window.viewFeedback = async function(id) {
        const dialog = document.getElementById('feedback-dialog');
        const content = document.getElementById('feedback-content');
        
        content.innerHTML = '<p class="loading">読み込み中...</p>';
        dialog.showModal();
        
        try {
            const idToken = await firebase.auth().currentUser.getIdToken();
            const response = await fetch(`https://2z0ui5xfxb.execute-api.ap-northeast-1.amazonaws.com/prod/staff/reports/${id}/feedback`, {
                headers: { 'Authorization': `Bearer ${idToken}` }
            });
            
            if (!response.ok) throw new Error('取得に失敗しました');
            
            const data = await response.json();
            const feedback = data.feedback || {};
            
            if (!feedback.rating && !feedback.comment) {
                content.innerHTML = `
                    <div style="text-align: center; padding: 20px; color: #666;">
                        <i class="fas fa-comment-slash" style="font-size: 3rem; margin-bottom: 10px; opacity: 0.5;"></i>
                        <p>まだコメントがありません</p>
                    </div>
                `;
            } else {
                const stars = '★'.repeat(feedback.rating || 0) + '☆'.repeat(5 - (feedback.rating || 0));
                const date = feedback.submitted_at ? new Date(feedback.submitted_at).toLocaleString('ja-JP') : '-';
                content.innerHTML = `
                    <div class="feedback-detail">
                        <div style="margin-bottom: 15px;">
                            <label style="font-weight: 600; display: block; margin-bottom: 5px;">評価</label>
                            <span style="font-size: 1.5rem; color: #FF679C;">${stars}</span>
                        </div>
                        <div style="margin-bottom: 15px;">
                            <label style="font-weight: 600; display: block; margin-bottom: 5px;">コメント</label>
                            <p style="background: #f5f5f5; padding: 12px; border-radius: 8px; white-space: pre-wrap;">${feedback.comment || 'コメントなし'}</p>
                        </div>
                        <div style="font-size: 0.85rem; color: #666;">
                            <i class="fas fa-clock"></i> 送信日時: ${date}
                        </div>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error fetching feedback:', error);
            content.innerHTML = `<p style="color: #dc3545; text-align: center;">コメントの取得に失敗しました</p>`;
        }
    };

    // 詳細表示 - モーダルで表示
    window.viewReport = function(id) {
      const report = allReports.find(r => String(r.id) === String(id) || String(r.report_id) === String(id));
      if (!report) {
        alert('レポートが見つかりませんでした');
        return;
      }

      // デバッグログ
      console.log('[viewReport] Report ID:', id);
      console.log('[viewReport] Report data:', report);
      console.log('[viewReport] Work items:', report.work_items);
      console.log('[viewReport] Sections:', report.sections);

      currentReportId = id;
      const store = allStores.find(s => s.id === report.store_id) || {};
      const worker = allWorkers.find(w => w.id === report.worker_id || w.id === report.staff_id) || {};
      const status = report.send_at || report.status === 'approved' ? 'approved' : (report.status === 'rejected' ? 'rejected' : 'pending');

      // 新しい形式のレポート（work_items配列）かどうかを判定
      const hasWorkItems = report.work_items && Array.isArray(report.work_items) && report.work_items.length > 0;

      let reportHtml = '';

      if (hasWorkItems) {
        // 新しい形式: レポート表示ページと同じレイアウト
        const dateStr = formatDate(report.cleaning_date || report.work_date || report.created_at?.split('T')[0]);
        const timeStr = (report.cleaning_start_time || report.start_time || '') && (report.cleaning_end_time || report.end_time || '')
          ? `${report.cleaning_start_time || report.start_time} - ${report.cleaning_end_time || report.end_time}`
          : '';

        // 実施清掃項目リスト
        const itemNames = report.work_items.map(item => item.item_name || item.name || item.item_id).filter(Boolean);
        const itemsListHtml = itemNames.length > 0
          ? itemNames.map(name => `<span class="items-list-item-modal">${escapeHtml(name)}</span>`).join('')
          : '<span class="items-list-empty-modal">項目なし</span>';

        // 清掃項目の詳細（画像は別のsectionsで管理されるため、ここでは表示しない）
        const workItemsHtml = report.work_items.map(item => {
          const details = item.details || {};
          const tags = [];
          if (details.type) tags.push(details.type);
          if (details.count) tags.push(`${details.count}個`);
          const tagsHtml = tags.map(tag => `<span class="detail-tag-input-modal" style="display:inline-block;margin-right:8px;">${escapeHtml(tag)}</span>`).join('');

          return `
            <section class="cleaning-section-modal">
              <div class="item-header-modal">
                <h3 class="item-title-input-modal" style="border:none;background:transparent;padding:0;font-size:1.6rem;font-weight:600;color:#222;">${escapeHtml(item.item_name || item.name || item.item_id)}</h3>
                <div class="item-details-modal">${tagsHtml}</div>
              </div>
            </section>
          `;
        }).join('');

        reportHtml = `
          <div class="report-container-modal">
            <header class="report-header-modal">
              <div class="report-header-content-modal">
                <div class="form-group-inline-modal">
                  <span class="form-label-inline-modal">清掃日時</span>
                  <span style="color:#fff;font-size:1rem;">${dateStr} ${timeStr}</span>
                </div>
                <div class="form-group-inline-modal">
                  <span class="form-label-inline-modal">店舗</span>
                  <span style="color:#fff;font-size:1rem;">${escapeHtml(report.store_name || store.name || '不明')}</span>
                </div>
                <div class="form-group-inline-modal">
                  <span class="form-label-inline-modal">担当者</span>
                  <span style="color:#fff;font-size:1rem;">${escapeHtml(report.staff_name || worker.name || '-')}</span>
                </div>
              </div>
            </header>
            <div class="items-list-bar-modal">
              <div class="items-list-modal">
                <span class="items-list-label-modal">実施清掃項目</span>
                <div class="items-list-items-modal">${itemsListHtml}</div>
              </div>
            </div>
            <div class="report-main-modal">
              ${workItemsHtml}
              ${report.sections && Array.isArray(report.sections) && report.sections.length > 0 ? report.sections.map(section => {
                if (section.section_type === 'image') {
                  // 画像セクション
                  const beforePhotos = section.photos?.before || [];
                  const afterPhotos = section.photos?.after || [];
                  const imageType = section.image_type || 'work';
                  
                  // デバッグログ
                  console.log(`[viewReport] Image section:`, section);
                  console.log(`[viewReport] Image section - Before photos:`, beforePhotos);
                  console.log(`[viewReport] Image section - After photos:`, afterPhotos);
                  const beforeLabel = imageType === 'work' ? '作業前（Before）' : '設置前（Before）';
                  const afterLabel = imageType === 'work' ? '作業後（After）' : '設置後（After）';
                  
                  const beforePhotosHtml = beforePhotos.length > 0
                    ? `<div class="image-list-modal">
                         ${beforePhotos.map(url => `
                           <div class="image-item-modal">
                             <img src="${url}" alt="${beforeLabel}" loading="lazy" 
                                  onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect fill=%22%23ddd%22 width=%22100%22 height=%22100%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22%3E画像読み込みエラー%3C/text%3E%3C/svg%3E';" />
            </div>
                         `).join('')}
                       </div>`
                    : '<p style="color: #999; font-style: italic; padding: 20px; text-align: center;">写真なし</p>';

                  const afterPhotosHtml = afterPhotos.length > 0
                    ? `<div class="image-list-modal">
                         ${afterPhotos.map(url => `
                           <div class="image-item-modal">
                             <img src="${url}" alt="${afterLabel}" loading="lazy" 
                                  onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect fill=%22%23ddd%22 width=%22100%22 height=%22100%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22%3E画像読み込みエラー%3C/text%3E%3C/svg%3E';" />
                           </div>
                         `).join('')}
                       </div>`
                    : '<p style="color: #999; font-style: italic; padding: 20px; text-align: center;">写真なし</p>';

                  return `
                    <section class="image-section-modal">
                      <div class="section-header-modal">
                        <h4 class="section-title-modal">
                          <i class="fas fa-image"></i> 画像セクション（${imageType === 'work' ? '作業前・作業後' : '設置前・設置後'}）
                        </h4>
                      </div>
                      <div class="image-grid-modal">
                        <div class="image-category-modal before-category">
                          <h4 class="image-category-title-modal">${beforeLabel}</h4>
                          ${beforePhotosHtml}
                        </div>
                        <div class="image-category-modal after-category">
                          <h4 class="image-category-title-modal">${afterLabel}</h4>
                          ${afterPhotosHtml}
                        </div>
                      </div>
                    </section>
                  `;
                } else if (section.section_type === 'comment') {
                  // コメントセクション
                  return `
                    <section class="comment-section-modal">
                      <div class="section-header-modal">
                        <h4 class="section-title-modal">
                          <i class="fas fa-comment"></i> コメント
                        </h4>
                      </div>
                      <div class="subsection-modal">
                        <p style="white-space: pre-wrap;">${escapeHtml(section.content || '')}</p>
                      </div>
                    </section>
                  `;
                } else if (section.section_type === 'work_content') {
                  // 作業内容セクション
                  return `
                    <section class="work-content-section-modal">
                      <div class="section-header-modal">
                        <h4 class="section-title-modal">
                          <i class="fas fa-tasks"></i> 作業内容
                        </h4>
                      </div>
                      <div class="subsection-modal">
                        <p style="white-space: pre-wrap;">${escapeHtml(section.content || '')}</p>
                      </div>
                    </section>
                  `;
                }
                return '';
              }).filter(Boolean).join('') : ''}
            </div>
          </div>
        `;
      } else {
        // 古い形式: 従来の表示
      const photosHtml = report.photos ? `
        <div class="detail-item" style="grid-column: 1/-1;">
          <div class="detail-label">写真</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:8px;">
            <div>
              <div style="font-size:0.75rem;color:#6b7280;margin-bottom:4px;">作業前</div>
              <div style="display:flex;gap:4px;flex-wrap:wrap;">
                ${(report.photos.before || []).map(p => `<img src="${p}" style="width:60px;height:60px;object-fit:cover;border-radius:4px;">`).join('') || '<span style="color:#9ca3af;font-size:0.8rem;">なし</span>'}
              </div>
            </div>
            <div>
              <div style="font-size:0.75rem;color:#6b7280;margin-bottom:4px;">作業後</div>
              <div style="display:flex;gap:4px;flex-wrap:wrap;">
                ${(report.photos.after || []).map(p => `<img src="${p}" style="width:60px;height:60px;object-fit:cover;border-radius:4px;">`).join('') || '<span style="color:#9ca3af;font-size:0.8rem;">なし</span>'}
              </div>
            </div>
          </div>
        </div>
      ` : '';

        reportHtml = `
        <div class="detail-grid">
          <div class="detail-item">
            <div class="detail-label">店舗</div>
            <div class="detail-value">${escapeHtml(report.store_name || store.name || '不明')}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">担当者</div>
            <div class="detail-value">${escapeHtml(report.staff_name || worker.name || '-')}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">作業日</div>
            <div class="detail-value">${formatDate(report.work_date || report.cleaning_date || report.created_at?.split('T')[0])}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">作業時間</div>
            <div class="detail-value">${report.start_time || report.cleaning_start_time || '-'} 〜 ${report.end_time || report.cleaning_end_time || '-'}</div>
          </div>
          ${photosHtml}
        </div>
        <div class="detail-item">
          <div class="detail-label">作業内容</div>
            <div class="detail-value">${escapeHtml(report.content || '-')}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">備考</div>
            <div class="detail-value">${escapeHtml(report.notes || '-')}</div>
        </div>
      `;
      }

      document.getElementById('detail-body').innerHTML = reportHtml;

      // 承認済みなら承認/却下ボタンを非表示
      document.getElementById('btn-approve').style.display = status === 'approved' ? 'none' : '';
      document.getElementById('btn-reject').style.display = status === 'approved' ? 'none' : '';

      document.getElementById('detail-dialog').showModal();
      
      // 再提出フラグをクリア（モーダルを開いた時）
      if (report.resubmitted) {
        clearResubmittedFlag(currentReportId);
      }
    };

    // 編集
    window.editReport = function(id) {
      const report = allReports.find(r => String(r.id) === String(id) || String(r.report_id) === String(id));
      if (!report) {
        alert('レポートが見つかりませんでした');
        return;
      }

      document.getElementById('form-title').textContent = 'レポート編集';
      document.getElementById('report-id').value = report.report_id || report.id;
      
      // 基本情報を設定
      const storeSelect = document.getElementById('report-store');
      if (storeSelect) {
        storeSelect.value = report.store_id || '';
        const selectedOption = storeSelect.options[storeSelect.selectedIndex];
        if (selectedOption) {
          document.getElementById('report-store-name').value = selectedOption.text;
        }
      }
      
      document.getElementById('report-date').value = report.cleaning_date || report.work_date || '';
      document.getElementById('report-start').value = report.cleaning_start_time || report.start_time || '';
      document.getElementById('report-end').value = report.cleaning_end_time || report.end_time || '';
      
      // 担当者情報を設定
      const workerSelect = document.getElementById('report-worker');
      if (workerSelect) {
        workerSelect.value = report.staff_id || report.worker_id || '';
        const selectedOption = workerSelect.options[workerSelect.selectedIndex];
        if (selectedOption) {
          document.getElementById('report-worker-name').value = selectedOption.text || report.staff_name || report.worker_name || '';
        } else {
          document.getElementById('report-worker-name').value = report.staff_name || report.worker_name || '';
        }
      }

      // 清掃項目をクリア
      const workItemsContainer = document.getElementById('work-items-container-modal');
      if (workItemsContainer) {
        workItemsContainer.innerHTML = '';
      }
      modalWorkItemCounter = 0;

      // 新しい形式（work_items配列）の場合
      if (report.work_items && Array.isArray(report.work_items) && report.work_items.length > 0) {
        // 各清掃項目を追加
        report.work_items.forEach(item => {
          addWorkItemModal(item);
        });
      } else {
        // 古い形式の場合、1つの項目として追加
        addWorkItemModal({
          item_id: `work-item-${Date.now()}`,
          item_name: report.content || '',
          work_content: report.content || '',
          work_memo: report.notes || '',
          details: {},
          photos: report.photos || { before: [], after: [] }
        });
      }

      // セクション（画像、コメント、作業内容）を復元
      if (report.sections && Array.isArray(report.sections) && report.sections.length > 0) {
        report.sections.forEach(section => {
          if (section.section_type === 'image') {
            // 画像セクションを追加（既存のsection_idを使用）
            const imageType = section.image_type || 'work';
            window.addImageSectionModal(imageType, section.section_id);
            
            // 追加されたセクションを取得
            const addedSection = document.querySelector(`[data-section-id="${section.section_id}"].image-section-modal`);
            if (addedSection) {
              // 作業前の写真を追加
              if (section.photos && section.photos.before && Array.isArray(section.photos.before)) {
                const photoGrid = addedSection.querySelector('.image-list-modal[data-category="before"]');
                if (photoGrid) {
                  const addBtns = photoGrid.querySelector('.image-add-btns-modal');
                  section.photos.before.forEach(photoUrl => {
                    const photoItem = document.createElement('div');
                    photoItem.className = 'image-item-modal';
                    photoItem.dataset.url = photoUrl;
                    photoItem.innerHTML = `
                      <img src="${escapeHtml(photoUrl)}" alt="作業前">
                      <button type="button" class="image-remove-btn-modal" onclick="removePhotoModal(this)">
                        <i class="fas fa-times"></i>
                      </button>
                    `;
                    if (addBtns) {
                      photoGrid.insertBefore(photoItem, addBtns);
                    } else {
                      photoGrid.appendChild(photoItem);
                    }
                  });
                }
              }
              
              // 作業後の写真を追加
              if (section.photos && section.photos.after && Array.isArray(section.photos.after)) {
                const photoGrid = addedSection.querySelector('.image-list-modal[data-category="after"]');
                if (photoGrid) {
                  const addBtns = photoGrid.querySelector('.image-add-btns-modal');
                  section.photos.after.forEach(photoUrl => {
                    const photoItem = document.createElement('div');
                    photoItem.className = 'image-item-modal';
                    photoItem.dataset.url = photoUrl;
                    photoItem.innerHTML = `
                      <img src="${escapeHtml(photoUrl)}" alt="作業後">
                      <button type="button" class="image-remove-btn-modal" onclick="removePhotoModal(this)">
                        <i class="fas fa-times"></i>
                      </button>
                    `;
                    if (addBtns) {
                      photoGrid.insertBefore(photoItem, addBtns);
                    } else {
                      photoGrid.appendChild(photoItem);
                    }
                  });
                }
              }
            }
          } else if (section.section_type === 'comment') {
            // コメントセクションを追加（既存のsection_idを使用）
            window.addCommentSectionModal(section.section_id);
            
            // 追加されたセクションを取得
            const addedSection = document.querySelector(`[data-section-id="${section.section_id}"].comment-section-modal`);
            if (addedSection && section.content) {
              const textarea = addedSection.querySelector('.comment-textarea-modal');
              if (textarea) {
                textarea.value = section.content;
              }
            }
          } else if (section.section_type === 'work_content') {
            // 作業内容セクションを追加（既存のsection_idを使用）
            window.addWorkContentSectionModal(section.section_id);
            
            // 追加されたセクションを取得
            const addedSection = document.querySelector(`[data-section-id="${section.section_id}"].work-content-section-modal`);
            if (addedSection && section.content) {
              const textarea = addedSection.querySelector('.work-content-textarea-modal');
              if (textarea) {
                textarea.value = section.content;
              }
            }
          }
        });
      }

      document.getElementById('new-dialog').showModal();
    };

    // URL発行
    window.shareReport = function(id) {
      const report = allReports.find(r => String(r.id) === String(id) || String(r.report_id) === String(id));
      if (!report) {
        alert('レポートが見つかりませんでした');
        return;
      }

      // 共有URLを生成（直接レポート表示ページ）
      const reportId = report.report_id || report.id;
      const baseUrl = window.location.origin;
      const shareUrl = `${baseUrl}/reports/shared/${reportId}/view`;

      // URLを表示
      document.getElementById('share-url-input').value = shareUrl;
      
      // コピー成功メッセージを非表示
      document.getElementById('copy-success').style.display = 'none';
      
      // モーダルを表示
      document.getElementById('share-dialog').showModal();
    };

    // URLコピー機能
    document.addEventListener('DOMContentLoaded', function() {
      const copyBtn = document.getElementById('btn-copy-url');
      const urlInput = document.getElementById('share-url-input');
      const copySuccess = document.getElementById('copy-success');
      
      if (copyBtn && urlInput) {
        copyBtn.addEventListener('click', async function() {
          try {
            await navigator.clipboard.writeText(urlInput.value);
            copySuccess.style.display = 'flex';
            setTimeout(() => {
              copySuccess.style.display = 'none';
            }, 3000);
          } catch (err) {
            // フォールバック: テキストエリアを使用
            urlInput.select();
            document.execCommand('copy');
            copySuccess.style.display = 'flex';
            setTimeout(() => {
              copySuccess.style.display = 'none';
            }, 3000);
          }
        });
      }
    });

    // 削除
    window.deleteReport = async function(id) {
      if (!confirm('このレポートを削除しますか？')) return;
      
      try {
        // 新レポートAPIから削除を試みる
        try {
          const idToken = await getFirebaseIdToken();
          await fetch(`${REPORT_API}/staff/reports/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${idToken}` }
          });
        } catch (e) {
          // 旧APIから削除を試みる
        await fetch(`${API_BASE}/reports/${id}`, { method: 'DELETE' });
        }
        allReports = allReports.filter(r => String(r.id) !== String(id));
        updateStats();
        filterAndRender();
      } catch (e) {
        alert('削除に失敗しました');
      }
    };


    // Firebase認証からIDトークンを取得
    async function getFirebaseIdToken() {
      try {
        if (!window.FirebaseAuth) {
          return 'mock-token';
        }
        const currentUser = window.FirebaseAuth.currentUser;
        if (!currentUser) {
          return 'mock-token';
        }
        const idToken = await currentUser.getIdToken();
        return idToken;
      } catch (error) {
        console.error('Error getting Firebase ID token:', error);
        return 'mock-token';
      }
    }

    // 再提出フラグをクリア
    async function clearResubmittedFlag(reportId) {
      try {
        const idToken = await getFirebaseIdToken();
        const report = allReports.find(r => String(r.id) === String(reportId) || String(r.report_id) === String(reportId));
        if (!report || !report.resubmitted) {
          return; // フラグがない場合は何もしない
        }
        
        // フラグをクリア（バックエンドで更新）
        await fetch(`${REPORT_API}/staff/reports/${reportId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            resubmitted: false
          })
        });
        
        // フロントエンドのデータも更新
        if (report) {
          report.resubmitted = false;
        }
        
        // テーブルを再レンダリング
        filterAndRender();
      } catch (error) {
        console.error('Error clearing resubmitted flag:', error);
        // エラーが発生しても処理を続行
      }
    }

    // 承認
    document.getElementById('btn-approve').addEventListener('click', async () => {
      if (!currentReportId) return;
      
      try {
        const idToken = await getFirebaseIdToken();
        const response = await fetch(`${REPORT_API}/staff/reports/${currentReportId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({ 
            status: 'approved',
            resubmitted: false  // 再提出フラグをクリア
          })
        });
        
        if (!response.ok) {
          throw new Error('承認に失敗しました');
        }
        
        const report = allReports.find(r => String(r.id) === String(currentReportId) || String(r.report_id) === String(currentReportId));
        if (report) {
          report.status = 'approved';
          report.resubmitted = false;
        }
        
        document.getElementById('detail-dialog').close();
        updateStats();
        filterAndRender();
      } catch (e) {
        alert('承認に失敗しました: ' + e.message);
      }
    });

    // 却下
    document.getElementById('btn-reject').addEventListener('click', async () => {
      if (!currentReportId) return;
      
      try {
        const idToken = await getFirebaseIdToken();
        const response = await fetch(`${REPORT_API}/staff/reports/${currentReportId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({ 
            status: 'rejected',
            resubmitted: false  // 再提出フラグをクリア
          })
        });
        
        if (!response.ok) {
          throw new Error('却下に失敗しました');
        }
        
        const report = allReports.find(r => String(r.id) === String(currentReportId) || String(r.report_id) === String(currentReportId));
        if (report) {
          report.status = 'rejected';
          report.resubmitted = false;
        }
        
        document.getElementById('detail-dialog').close();
        updateStats();
        filterAndRender();
      } catch (e) {
        alert('却下に失敗しました: ' + e.message);
      }
    });

    // 要修正として返す
    document.getElementById('btn-request-revision').addEventListener('click', () => {
      if (!currentReportId) return;
      document.getElementById('revision-comment').value = '';
      document.getElementById('revision-dialog').showModal();
    });

    // 要修正として返す（確認）
    document.getElementById('btn-confirm-revision').addEventListener('click', async () => {
      if (!currentReportId) return;
      
      const comment = document.getElementById('revision-comment').value.trim();
      if (!comment) {
        alert('修正コメントを入力してください');
        return;
      }
      
      try {
        const idToken = await getFirebaseIdToken();
        const response = await fetch(`${REPORT_API}/staff/reports/${currentReportId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            status: 'revision_requested',
            revision_comment: comment
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || '要修正として返すのに失敗しました');
        }
        
        const report = allReports.find(r => String(r.id) === String(currentReportId) || String(r.report_id) === String(currentReportId));
        if (report) {
          report.status = 'revision_requested';
          report.revision_comment = comment;
        }
        
        document.getElementById('revision-dialog').close();
        document.getElementById('detail-dialog').close();
        updateStats();
        filterAndRender();
        alert('レポートを要修正として返しました');
      } catch (e) {
        console.error('Error requesting revision:', e);
        alert('要修正として返すのに失敗しました: ' + e.message);
      }
    });

    // イベントリスナー
    function setupEventListeners() {
      document.getElementById('search-input').addEventListener('input', debounce(filterAndRender, 300));
      document.getElementById('filter-status').addEventListener('change', filterAndRender);
      document.getElementById('filter-store').addEventListener('change', filterAndRender);
      document.getElementById('filter-date-from').addEventListener('change', filterAndRender);
      document.getElementById('filter-date-to').addEventListener('change', filterAndRender);
      document.getElementById('btn-reset-filters').addEventListener('click', () => {
        document.getElementById('search-input').value = '';
        document.getElementById('filter-status').value = '';
        document.getElementById('filter-store').value = '';
        document.getElementById('filter-date-from').value = '';
        document.getElementById('filter-date-to').value = '';
        filterAndRender();
      });

      // 新規作成
      document.getElementById('btn-new-report').addEventListener('click', () => {
        document.getElementById('form-title').textContent = '新規レポート作成';
        document.getElementById('report-form-modal').reset();
        document.getElementById('report-id').value = '';
        document.getElementById('report-date').value = new Date().toISOString().split('T')[0];
        // モーダル内のコンテナをクリア
        document.getElementById('work-items-container-modal').innerHTML = '';
        document.getElementById('cleaning-items-list-modal').innerHTML = '<span class="items-list-empty-modal">項目を追加してください</span>';
        // 初期項目を追加
        modalWorkItemCounter = 0;
        addWorkItemModal();
        document.getElementById('new-dialog').showModal();
      });

      // モーダル用の変数と関数
      let modalWorkItemCounter = 0;

      // モーダル用: 画像の最適化
      function optimizeImageModal(file, maxWidth = 800, quality = 0.8) {
        return new Promise((resolve) => {
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
              
              canvas.toBlob(resolve, 'image/jpeg', quality);
            };
            img.src = e.target.result;
          };
          reader.readAsDataURL(file);
        });
      }

      // モーダル用: Base64に変換
      function blobToBase64Modal(blob) {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      }

      // モーダル用: 清掃項目リストを更新
      window.updateCleaningItemsListModal = function() {
        const container = document.getElementById('cleaning-items-list-modal');
        const items = document.querySelectorAll('.cleaning-section-modal');
        
        if (items.length === 0) {
          container.innerHTML = '<span class="items-list-empty-modal">項目を追加してください</span>';
          return;
        }
        
        const itemNames = Array.from(items).map(section => {
          const select = section.querySelector('.item-title-select-modal');
          const input = section.querySelector('.item-title-input-modal');
          if (select && select.value === '__custom__' && input) {
            return (input.value || '').trim() || '';
          } else if (select && select.value && select.value !== '__custom__') {
            return select.value;
          } else if (input && input.value) {
            return (input.value || '').trim();
          }
          return '';
        }).filter(name => name !== '');
        
        if (itemNames.length === 0) {
          container.innerHTML = '<span class="items-list-empty-modal">項目を追加してください</span>';
          return;
        }
        
        container.innerHTML = itemNames.map(name => 
          `<span class="items-list-item-modal">${escapeHtml(name)}</span>`
        ).join('');
      };

      // モーダル用: 清掃項目を追加
      window.addWorkItemModal = function(itemData = null) {
        modalWorkItemCounter++;
        const container = document.getElementById('work-items-container-modal');
        const itemIdValue = itemData?.item_id || `work-item-modal-${modalWorkItemCounter}`;
        const itemNameValue = itemData?.item_name || '';
        const details = itemData?.details || {};
        
        const workItemSection = document.createElement('section');
        workItemSection.className = 'cleaning-section-modal';
        workItemSection.dataset.itemId = itemIdValue;
        
        // サービス項目のドロップリストオプションを生成
        const isCustomItem = itemNameValue && !allServiceItems.find(item => item.title === itemNameValue);
        const serviceOptions = allServiceItems.map(item => {
          const selected = item.title === itemNameValue ? 'selected' : '';
          return `<option value="${escapeHtml(item.title)}" ${selected}>${escapeHtml(item.title)}</option>`;
        }).join('');
        
        workItemSection.innerHTML = `
          <div class="item-header-modal">
            <div class="item-title-group-modal">
              <select class="item-title-select-modal" data-item-id="${itemIdValue}">
                <option value="">-- 清掃項目を選択 --</option>
                <option value="__custom__" ${isCustomItem ? 'selected' : ''}>その他（自由入力）</option>
                ${serviceOptions}
              </select>
              <input type="text" class="item-title-input-modal" data-item-id="${itemIdValue}" placeholder="清掃項目を入力" value="${isCustomItem ? escapeHtml(itemNameValue) : ''}" style="display: ${isCustomItem ? 'block' : 'none'};">
            </div>
            <div class="item-details-modal">
              <input type="text" class="detail-tag-input-modal" placeholder="タイプ（例: 床置き型）" style="width: 150px;" value="${escapeHtml(details.type || '')}">
              <input type="text" class="detail-tag-input-modal" placeholder="個数（例: 2個）" style="width: 100px;" value="${escapeHtml(details.count || '')}">
            </div>
            <button type="button" class="item-remove-btn-modal" onclick="removeWorkItemModal('${itemIdValue}')">
              <i class="fas fa-trash"></i>
              削除
            </button>
          </div>
        `;
        
        container.appendChild(workItemSection);
        
        // タイトル選択のイベントリスナー（リスト更新用 + フリーワード入力の表示/非表示）
        const titleSelect = workItemSection.querySelector('.item-title-select-modal');
        const titleInput = workItemSection.querySelector('.item-title-input-modal');
        if (titleSelect) {
          titleSelect.addEventListener('change', function() {
            const value = this.value;
            if (value === '__custom__') {
              titleInput.style.display = 'block';
              titleInput.focus();
            } else {
              titleInput.style.display = 'none';
              titleInput.value = '';
            }
            window.updateCleaningItemsListModal();
          });
        }
        if (titleInput) {
          titleInput.addEventListener('input', function() {
            window.updateCleaningItemsListModal();
          });
        }
        
        window.updateCleaningItemsListModal();
      };

      // モーダル用: 清掃項目を削除
      window.removeWorkItemModal = function(itemId) {
        const section = document.querySelector(`[data-item-id="${itemId}"].cleaning-section-modal`);
        if (section && confirm('この清掃項目を削除しますか？')) {
          section.remove();
          window.updateCleaningItemsListModal();
        }
      };

      // モーダル用: 画像セクションを追加
      window.addImageSectionModal = function(type = 'work', existingSectionId = null) {
        modalWorkItemCounter++;
        const container = document.getElementById('work-items-container-modal');
        const sectionId = existingSectionId || `image-section-modal-${modalWorkItemCounter}`;
        
        const beforeLabel = type === 'work' ? '作業前（Before）' : '設置前（Before）';
        const afterLabel = type === 'work' ? '作業後（After）' : '設置後（After）';
        const beforeIcon = type === 'work' ? 'fa-clock' : 'fa-box';
        const afterIcon = type === 'work' ? 'fa-check-circle' : 'fa-check';
        
        const imageSection = document.createElement('section');
        imageSection.className = 'image-section-modal';
        imageSection.dataset.sectionId = sectionId;
        imageSection.dataset.sectionType = 'image';
        imageSection.dataset.imageType = type;
        
        imageSection.innerHTML = `
          <div class="section-header-modal">
            <h4 class="section-title-modal">
              <i class="fas fa-image"></i> 画像セクション（${type === 'work' ? '作業前・作業後' : '設置前・設置後'}）
            </h4>
            <button type="button" class="section-remove-btn-modal" onclick="removeSectionModal('${sectionId}')">
              <i class="fas fa-trash"></i> 削除
            </button>
          </div>
          <div class="image-grid-modal">
            <div class="image-category-modal before-category">
              <h4 class="image-category-title-modal"><i class="fas ${beforeIcon}"></i> ${beforeLabel}</h4>
              <div class="image-list-modal" data-category="before" data-section-id="${sectionId}">
                <div class="image-item-modal image-add-btns-modal">
                  <label class="image-upload-btn-modal">
                    <input type="file" accept="image/*" multiple data-category="before" data-section-id="${sectionId}" />
                    <i class="fas fa-camera"></i>
                    <span>ファイルから</span>
                  </label>
                  <button type="button" class="image-media-btn-modal" data-category="before" data-section-id="${sectionId}">
                    <i class="fas fa-images"></i>
                    <span>メディアから</span>
                  </button>
                  <button type="button" class="image-warehouse-btn-modal" data-category="before" data-section-id="${sectionId}">
                    <i class="fas fa-warehouse"></i>
                    <span>画像倉庫から</span>
                  </button>
                </div>
              </div>
            </div>
            <div class="image-category-modal after-category">
              <h4 class="image-category-title-modal"><i class="fas ${afterIcon}"></i> ${afterLabel}</h4>
              <div class="image-list-modal" data-category="after" data-section-id="${sectionId}">
                <div class="image-item-modal image-add-btns-modal">
                  <label class="image-upload-btn-modal">
                    <input type="file" accept="image/*" multiple data-category="after" data-section-id="${sectionId}" />
                    <i class="fas fa-camera"></i>
                    <span>ファイルから</span>
                  </label>
                  <button type="button" class="image-media-btn-modal" data-category="after" data-section-id="${sectionId}">
                    <i class="fas fa-images"></i>
                    <span>メディアから</span>
                  </button>
                  <button type="button" class="image-warehouse-btn-modal" data-category="after" data-section-id="${sectionId}">
                    <i class="fas fa-warehouse"></i>
                    <span>画像倉庫から</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;
        
        container.appendChild(imageSection);
        
        // 写真アップロードのイベントリスナー
        imageSection.querySelectorAll('input[type="file"]').forEach(input => {
          input.addEventListener('change', function(e) {
            handlePhotoUploadModal(e);
          });
        });
        
        // メディア選択ボタンのイベントリスナー
        imageSection.querySelectorAll('.image-media-btn-modal').forEach(btn => {
          btn.addEventListener('click', function() {
            const category = this.dataset.category;
            const sectionId = this.dataset.sectionId;
            openMediaSelectorForSection(category, sectionId);
          });
        });
        
        // 画像倉庫ボタンのイベントリスナー
        imageSection.querySelectorAll('.image-warehouse-btn-modal').forEach(btn => {
          btn.addEventListener('click', function() {
            const category = this.dataset.category;
            const sectionId = this.dataset.sectionId;
            openImageWarehouseForSection(category, sectionId);
          });
        });
      };

      // モーダル用: コメントセクションを追加
      window.addCommentSectionModal = function(existingSectionId = null) {
        modalWorkItemCounter++;
        const container = document.getElementById('work-items-container-modal');
        const sectionId = existingSectionId || `comment-section-modal-${modalWorkItemCounter}`;
        
        const commentSection = document.createElement('section');
        commentSection.className = 'comment-section-modal';
        commentSection.dataset.sectionId = sectionId;
        commentSection.dataset.sectionType = 'comment';
        
        commentSection.innerHTML = `
          <div class="section-header-modal">
            <h4 class="section-title-modal">
              <i class="fas fa-comment"></i> コメント
            </h4>
            <button type="button" class="section-remove-btn-modal" onclick="removeSectionModal('${sectionId}')">
              <i class="fas fa-trash"></i> 削除
            </button>
          </div>
          <div class="subsection-modal">
            <textarea class="comment-textarea-modal" placeholder="コメントを入力してください"></textarea>
          </div>
        `;
        
        container.appendChild(commentSection);
      };

      // モーダル用: 作業内容セクションを追加
      window.addWorkContentSectionModal = function(existingSectionId = null) {
        modalWorkItemCounter++;
        const container = document.getElementById('work-items-container-modal');
        const sectionId = existingSectionId || `work-content-section-modal-${modalWorkItemCounter}`;
        
        const workContentSection = document.createElement('section');
        workContentSection.className = 'work-content-section-modal';
        workContentSection.dataset.sectionId = sectionId;
        workContentSection.dataset.sectionType = 'work-content';
        
        workContentSection.innerHTML = `
          <div class="section-header-modal">
            <h4 class="section-title-modal">
              <i class="fas fa-tasks"></i> 作業内容
            </h4>
            <button type="button" class="section-remove-btn-modal" onclick="removeSectionModal('${sectionId}')">
              <i class="fas fa-trash"></i> 削除
            </button>
          </div>
          <div class="subsection-modal">
            <textarea class="work-content-textarea-modal" placeholder="作業内容を入力してください"></textarea>
          </div>
        `;
        
        container.appendChild(workContentSection);
      };

      // モーダル用: セクションを削除
      window.removeSectionModal = function(sectionId) {
        const section = document.querySelector(`[data-section-id="${sectionId}"]`);
        if (section && confirm('このセクションを削除しますか？')) {
          section.remove();
        }
      };

      // モーダル用: 写真アップロード処理
      async function handlePhotoUploadModal(e) {
        const input = e.target;
        const files = Array.from(input.files || []);
        if (files.length === 0) {
          return;
        }
        
        const photoGrid = input.closest('.image-list-modal');
        if (!photoGrid) {
          return;
        }
        const category = photoGrid.dataset.category;
        const itemId = photoGrid.dataset.itemId;
        const sectionId = photoGrid.dataset.sectionId;
        
        for (const file of files) {
          if (!file.type.startsWith('image/')) {
            continue;
          }
          
          try {
            const optimizedBlob = await optimizeImageModal(file, 800, 0.8);
            const base64 = await blobToBase64Modal(optimizedBlob);
            
            const photoItem = document.createElement('div');
            photoItem.className = 'image-item-modal';
            photoItem.dataset.base64 = base64;
            if (itemId) photoItem.dataset.itemId = itemId;
            if (sectionId) photoItem.dataset.sectionId = sectionId;
            photoItem.innerHTML = `
              <img src="${base64}" alt="Uploaded photo">
              <button type="button" class="image-remove-modal" onclick="removePhotoModal(this)">
                <i class="fas fa-times"></i>
              </button>
            `;
            
            const uploadBtn = input.closest('.image-item-modal');
            if (!uploadBtn) {
              continue;
            }
            uploadBtn.parentNode.insertBefore(photoItem, uploadBtn);
            
            photoItem.dataset.base64 = base64;
          } catch (error) {
            console.error('[Modal] Error uploading photo:', error);
            alert(`写真「${file.name}」のアップロードに失敗しました: ${error.message}`);
          }
        }
        
        // ファイル入力をリセット（同じファイルを再度選択できるように）
        input.value = '';
      }

      // モーダル用: 写真を削除
      window.removePhotoModal = function(button) {
        const photoItem = button.closest('.image-item-modal');
        photoItem.remove();
      };

      // メディア選択用の変数
      let currentMediaCategory = null;
      let currentMediaItemId = null;
      let currentMediaSectionId = null;

      // メディア選択モーダルを開く
      function openMediaSelector(category, itemId) {
        currentMediaCategory = category;
        currentMediaItemId = itemId;
        currentMediaSectionId = null;
        
        const dialog = document.getElementById('media-dialog');
        const iframe = document.getElementById('media-iframe');
        iframe.src = '/admin/images?selectMode=true';
        dialog.showModal();
      }

      // セクション用のメディア選択モーダルを開く
      function openMediaSelectorForSection(category, sectionId) {
        currentMediaCategory = category;
        currentMediaItemId = null;
        currentMediaSectionId = sectionId;
        
        const dialog = document.getElementById('media-dialog');
        const iframe = document.getElementById('media-iframe');
        iframe.src = '/admin/images?selectMode=true';
        dialog.showModal();
      }

      // メディアからの画像選択メッセージを受け取る
      window.addEventListener('message', function(e) {
        if (e.data && e.data.type === 'image-selected') {
          const path = e.data.path;
          if (currentMediaSectionId) {
            addMediaImageToReportSection(path, currentMediaCategory, currentMediaSectionId);
          } else {
            addMediaImageToReport(path, currentMediaCategory, currentMediaItemId);
          }
          document.getElementById('media-dialog').close();
        }
      });

      // メディアから選択した画像をレポートに追加（清掃項目用）
      function addMediaImageToReport(imagePath, category, itemId) {
        const photoGrid = document.querySelector(`.image-list-modal[data-category="${category}"][data-item-id="${itemId}"]`);
        if (!photoGrid) {
          console.error('Could not find photo grid for', category, itemId);
          return;
        }
        
        // 画像URLを解決
        const basePath = getBasePath();
        let resolvedPath = imagePath;
        if (!imagePath.startsWith('http://') && !imagePath.startsWith('https://') && !imagePath.startsWith('//')) {
          if (imagePath.startsWith('/')) {
            resolvedPath = basePath === '/' ? imagePath : basePath.slice(0, -1) + imagePath;
          } else {
            resolvedPath = basePath === '/' ? '/' + imagePath : basePath + imagePath;
          }
        }
        
        const photoItem = document.createElement('div');
        photoItem.className = 'image-item-modal';
        photoItem.dataset.url = resolvedPath;
        photoItem.dataset.itemId = itemId;
        photoItem.innerHTML = `
          <img src="${resolvedPath}" alt="Selected from media">
          <button type="button" class="image-remove-modal" onclick="removePhotoModal(this)">
            <i class="fas fa-times"></i>
          </button>
        `;
        
        // アップロードボタンの前に挿入
        const addBtns = photoGrid.querySelector('.image-add-btns-modal');
        if (addBtns) {
          photoGrid.insertBefore(photoItem, addBtns);
        } else {
          photoGrid.appendChild(photoItem);
        }
      }

      // メディアから選択した画像をレポートに追加（セクション用）
      function addMediaImageToReportSection(imagePath, category, sectionId) {
        const photoGrid = document.querySelector(`.image-list-modal[data-category="${category}"][data-section-id="${sectionId}"]`);
        if (!photoGrid) {
          console.error('Could not find photo grid for section', category, sectionId);
          return;
        }
        
        // 画像URLを解決
        const basePath = getBasePath();
        let resolvedPath = imagePath;
        if (!imagePath.startsWith('http://') && !imagePath.startsWith('https://') && !imagePath.startsWith('//')) {
          if (imagePath.startsWith('/')) {
            resolvedPath = basePath === '/' ? imagePath : basePath.slice(0, -1) + imagePath;
          } else {
            resolvedPath = basePath === '/' ? '/' + imagePath : basePath + imagePath;
          }
        }
        
        const photoItem = document.createElement('div');
        photoItem.className = 'image-item-modal';
        photoItem.dataset.url = resolvedPath;
        photoItem.dataset.sectionId = sectionId;
        photoItem.innerHTML = `
          <img src="${resolvedPath}" alt="Selected from media">
          <button type="button" class="image-remove-modal" onclick="removePhotoModal(this)">
            <i class="fas fa-times"></i>
          </button>
        `;
        
        // アップロードボタンの前に挿入
        const addBtns = photoGrid.querySelector('.image-add-btns-modal');
        if (addBtns) {
          photoGrid.insertBefore(photoItem, addBtns);
        } else {
          photoGrid.appendChild(photoItem);
        }
      }

      // 画像倉庫用の変数
      let currentWarehouseCategory = null;
      let currentWarehouseItemId = null;
      let currentWarehouseSectionId = null;
      // Map<imageUrl, category> で選択した画像とカテゴリを保持
      let selectedWarehouseImages = new Map();
      // 保存ボタンで閉じたかどうかを追跡
      let warehouseSaved = false;

      // 画像倉庫を開く（清掃項目用）
      window.openImageWarehouse = function(category, itemId) {
        console.log('[Warehouse] Opening warehouse:', { category, itemId, type: typeof itemId });
        
        // itemIdを文字列として保存（比較のため）
        currentWarehouseCategory = category;
        currentWarehouseItemId = String(itemId);
        currentWarehouseSectionId = null;
        selectedWarehouseImages.clear();
        warehouseSaved = false; // フラグをリセット
        
        console.log('[Warehouse] Set currentWarehouseItemId to:', currentWarehouseItemId);
        
        openImageWarehouseDialog(category);
      };

      // 画像倉庫を開く（セクション用）
      window.openImageWarehouseForSection = function(category, sectionId) {
        console.log('[Warehouse] Opening warehouse for section:', { category, sectionId });
        
        currentWarehouseCategory = category;
        currentWarehouseItemId = null;
        currentWarehouseSectionId = sectionId;
        selectedWarehouseImages.clear();
        warehouseSaved = false;
        
        openImageWarehouseDialog(category);
      };

      // 画像倉庫ダイアログを開く（共通処理）
      function openImageWarehouseDialog(category) {
        
        // レポートの日付を取得（デフォルト値として使用）
        const reportDate = document.getElementById('report-date').value || new Date().toISOString().split('T')[0];
        const dateFilter = document.getElementById('warehouse-date-filter');
        if (dateFilter) {
          dateFilter.value = reportDate;
        }
        
        // カテゴリフィルターを設定（表示用、検索には使わない）
        const categoryFilter = document.getElementById('warehouse-category-filter');
        if (categoryFilter) {
          categoryFilter.value = category || '';
          console.log('[Warehouse] Category filter set to:', categoryFilter.value);
        }
        
        // 作業前/作業後のセクションを表示/非表示
        const beforeSection = document.getElementById('warehouse-category-section-before');
        const afterSection = document.getElementById('warehouse-category-section-after');
        if (category === 'before') {
          if (beforeSection) beforeSection.style.display = 'block';
          if (afterSection) afterSection.style.display = 'none';
        } else if (category === 'after') {
          if (beforeSection) beforeSection.style.display = 'none';
          if (afterSection) afterSection.style.display = 'block';
        } else {
          // カテゴリが指定されていない場合は両方表示
          if (beforeSection) beforeSection.style.display = 'block';
          if (afterSection) afterSection.style.display = 'block';
        }
        
        // モーダルを開く
        const warehouseDialog = document.getElementById('warehouse-dialog');
        if (warehouseDialog) {
          warehouseDialog.showModal();
          
          // モーダルが開かれた後に画像を読み込み（少し遅延させてDOMが準備されるのを待つ）
          setTimeout(() => {
            // 画像を読み込み（選択されたカテゴリのみ）
            loadWarehouseImages(reportDate, category && category.trim() !== '' ? category : undefined);
          }, 100);
        }
      };

      // 画像倉庫の画像を読み込み
      async function loadWarehouseImages(date, category) {
        const beforeContainer = document.getElementById('warehouse-images-before');
        const afterContainer = document.getElementById('warehouse-images-after');
        
        if (!beforeContainer || !afterContainer) {
          console.error('[Warehouse] Containers not found');
          return;
        }
        
        // カテゴリが指定されている場合はそのカテゴリのみ表示
        if (category === 'before') {
          beforeContainer.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> 読み込み中...</div>';
        } else if (category === 'after') {
          afterContainer.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> 読み込み中...</div>';
        } else {
          beforeContainer.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> 読み込み中...</div>';
          afterContainer.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> 読み込み中...</div>';
        }
        
        try {
          const REPORT_API = 'https://2z0ui5xfxb.execute-api.ap-northeast-1.amazonaws.com/prod';
          
          // カテゴリが指定されている場合はそのカテゴリのみ、指定されていない場合は両方を取得
          const categoriesToLoad = category && category.trim() !== '' ? [category] : ['before', 'after'];
          
          // 各カテゴリの画像を取得
          const allImages = { before: [], after: [] };
          
          for (const cat of categoriesToLoad) {
            const params = new URLSearchParams({ date, category: cat });
            const url = `${REPORT_API}/staff/report-images?${params}`;
            console.log('[Warehouse] Loading images:', { date, category: cat, url });
            
            const response = await fetch(url);
            
            if (!response.ok) {
              const errorText = await response.text();
              console.error('[Warehouse] Error response:', errorText);
              continue; // エラーが発生しても他のカテゴリを続行
            }
            
            const data = await response.json();
            console.log('[Warehouse] Received data:', { date: data.date, category: data.category, count: data.count });
            
            const images = data.images || [];
            if (cat === 'before') {
              allImages.before = images;
            } else if (cat === 'after') {
              allImages.after = images;
            }
          }
          
          // 作業前の画像を表示（カテゴリが指定されている場合のみ、または両方表示する場合）
          if (category === 'before' || !category) {
            if (allImages.before.length === 0) {
              // 画像がなくてもメッセージを表示しない（セクション自体が非表示になる）
              beforeContainer.innerHTML = '';
            } else {
              beforeContainer.innerHTML = allImages.before.map(img => {
                const imageUrl = img.url || img.s3_key;
                const isSelected = selectedWarehouseImages.has(imageUrl);
                const escapedUrl = escapeHtml(imageUrl);
                return `
                  <div class="warehouse-image-item ${isSelected ? 'selected' : ''}" 
                       data-image-url="${escapedUrl}"
                       data-category="before">
                    <img src="${escapedUrl}" alt="作業前" loading="lazy">
                    ${isSelected ? '<div class="image-check"><i class="fas fa-check"></i></div>' : ''}
                  </div>
                `;
              }).join('');
              
              // イベントリスナーを追加
              beforeContainer.querySelectorAll('.warehouse-image-item').forEach(item => {
                item.addEventListener('click', function() {
                  const imageUrl = this.dataset.imageUrl;
                  const category = this.dataset.category;
                  if (imageUrl && category) {
                    toggleWarehouseImage(imageUrl, category);
                  }
                });
              });
            }
          }
          
          // 作業後の画像を表示（カテゴリが指定されている場合のみ、または両方表示する場合）
          if (category === 'after' || !category) {
            if (allImages.after.length === 0) {
              // 画像がなくてもメッセージを表示しない（セクション自体が非表示になる）
              afterContainer.innerHTML = '';
            } else {
              afterContainer.innerHTML = allImages.after.map(img => {
                const imageUrl = img.url || img.s3_key;
                const isSelected = selectedWarehouseImages.has(imageUrl);
                const escapedUrl = escapeHtml(imageUrl);
                return `
                  <div class="warehouse-image-item ${isSelected ? 'selected' : ''}" 
                       data-image-url="${escapedUrl}"
                       data-category="after">
                    <img src="${escapedUrl}" alt="作業後" loading="lazy">
                    ${isSelected ? '<div class="image-check"><i class="fas fa-check"></i></div>' : ''}
                  </div>
                `;
              }).join('');
              
              // イベントリスナーを追加
              afterContainer.querySelectorAll('.warehouse-image-item').forEach(item => {
                item.addEventListener('click', function() {
                  const imageUrl = this.dataset.imageUrl;
                  const category = this.dataset.category;
                  if (imageUrl && category) {
                    toggleWarehouseImage(imageUrl, category);
                  }
                });
              });
            }
          }
          
        } catch (error) {
          console.error('[Warehouse] Error loading warehouse images:', error);
          if (category === 'before' || !category) {
            beforeContainer.innerHTML = '<div class="loading">エラー: ' + error.message + '</div>';
          }
          if (category === 'after' || !category) {
            afterContainer.innerHTML = '<div class="loading">エラー: ' + error.message + '</div>';
          }
        }
      }

      // 画像倉庫の画像を選択/解除
      window.toggleWarehouseImage = function(imageUrl, category) {
        console.log('[Warehouse] Toggling image:', { imageUrl, category });
        const escapedUrl = escapeHtml(imageUrl);
        const item = document.querySelector(`.warehouse-image-item[data-image-url="${escapedUrl}"]`);
        if (!item) {
          console.error('[Warehouse] Image item not found:', escapedUrl);
          return;
        }
        
        if (selectedWarehouseImages.has(imageUrl)) {
          // 選択解除
          selectedWarehouseImages.delete(imageUrl);
          item.classList.remove('selected');
          const checkMark = item.querySelector('.image-check');
          if (checkMark) {
            checkMark.remove();
          }
          console.log('[Warehouse] Image deselected:', imageUrl);
        } else {
          // 選択（カテゴリ情報も保存）
          selectedWarehouseImages.set(imageUrl, category);
          item.classList.add('selected');
          // チェックマークがなければ追加
          if (!item.querySelector('.image-check')) {
            const checkMark = document.createElement('div');
            checkMark.className = 'image-check';
            checkMark.innerHTML = '<i class="fas fa-check"></i>';
            item.appendChild(checkMark);
          }
          console.log('[Warehouse] Image selected:', { imageUrl, category, total: selectedWarehouseImages.size });
        }
      };

      // 画像倉庫の検索関数
      function performWarehouseSearch() {
        const date = document.getElementById('warehouse-date-filter').value;
        const categorySelect = document.getElementById('warehouse-category-filter');
        const category = categorySelect ? categorySelect.value : '';
        
        console.log('[Warehouse] Performing search:', { date, category });
        
        if (date) {
          // カテゴリが空文字列の場合は undefined を渡す（すべてのカテゴリを取得）
          loadWarehouseImages(date, category && category.trim() !== '' ? category : undefined);
        } else {
          alert('日付を選択してください');
        }
      }

      // 画像倉庫の検索ボタンとEnterキー
      document.addEventListener('DOMContentLoaded', function() {
        const searchBtn = document.getElementById('warehouse-search-btn');
        if (searchBtn) {
          searchBtn.addEventListener('click', performWarehouseSearch);
        }
        
        // 日付フィルターでEnterキーを押した時に検索
        const dateFilter = document.getElementById('warehouse-date-filter');
        if (dateFilter) {
          dateFilter.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
              e.preventDefault();
              performWarehouseSearch();
            }
          });
        }
        
        // カテゴリフィルターが変更された時に自動検索（日付が設定されている場合）
        const categoryFilter = document.getElementById('warehouse-category-filter');
        if (categoryFilter) {
          categoryFilter.addEventListener('change', function() {
            const date = document.getElementById('warehouse-date-filter').value;
            if (date) {
              performWarehouseSearch();
            }
          });
        }
        
        // 保存ボタンの処理（DOMContentLoaded内のイベントリスナーは削除し、onclickで直接呼び出す）
        
        // 画像倉庫モーダルが閉じられた時（キャンセルボタンや×ボタンで閉じた場合）
        const warehouseDialog = document.getElementById('warehouse-dialog');
        if (warehouseDialog) {
          warehouseDialog.addEventListener('close', function() {
            // 保存ボタンで閉じた場合は既に処理済みなので、何もしない
            if (!warehouseSaved) {
              // キャンセルボタンや×ボタンで閉じた場合は選択をクリア
              if (selectedWarehouseImages.size > 0) {
                console.log('[Warehouse] Modal closed without saving, clearing selections');
                selectedWarehouseImages.clear();
              }
            }
            warehouseSaved = false; // フラグをリセット
          });
        }
      });

      // 画像倉庫の保存ボタン処理
      window.saveWarehouseImages = function() {
        console.log('[Warehouse] Save button clicked');
        console.log('[Warehouse] Selected images count:', selectedWarehouseImages.size);
        console.log('[Warehouse] Current itemId:', currentWarehouseItemId);
        console.log('[Warehouse] Current sectionId:', currentWarehouseSectionId);
        console.log('[Warehouse] Selected images:', Array.from(selectedWarehouseImages.entries()));
        
        // 画像が選択されているか、itemIdまたはsectionIdが設定されているかチェック
        if (selectedWarehouseImages.size === 0) {
          alert('画像を選択してください');
          return;
        }
        
        if (!currentWarehouseItemId && !currentWarehouseSectionId) {
          alert('エラー: 追加先が特定できませんでした');
          return;
        }
        
          warehouseSaved = true;
          
          // 選択した画像をカテゴリごとに追加
          // MapのforEachは (value, key) の順序なので、selectedWarehouseImages.set(imageUrl, category) の場合
          // forEach((category, imageUrl) => ...) が正しい
          let addedCount = 0;
          selectedWarehouseImages.forEach((category, imageUrl) => {
            console.log('[Warehouse] Processing image:', { imageUrl, category, itemId: currentWarehouseItemId, sectionId: currentWarehouseSectionId });
            try {
              let result = false;
              if (currentWarehouseSectionId) {
                result = window.addWarehouseImageToReportSection(imageUrl, category, currentWarehouseSectionId);
            } else if (currentWarehouseItemId) {
                result = window.addWarehouseImageToReport(imageUrl, category, currentWarehouseItemId);
              }
              console.log('[Warehouse] addWarehouseImageToReport returned:', result);
              if (result) {
                addedCount++;
              }
            } catch (error) {
              console.error('[Warehouse] Error adding image:', error);
            }
          });
          
          console.log('[Warehouse] Added', addedCount, 'images out of', selectedWarehouseImages.size);
          selectedWarehouseImages.clear();
          
          // モーダルを閉じる
          document.getElementById('warehouse-dialog').close();
      };

      // 画像倉庫から選択した画像をレポートに追加
      window.addWarehouseImageToReport = function(imageUrl, category, itemId) {
        console.log('[Warehouse] ===== Adding image to report =====');
        console.log('[Warehouse] Parameters:', { imageUrl, category, itemId, itemIdType: typeof itemId });
        
        // itemIdを文字列に変換（比較のため）
        const itemIdStr = String(itemId);
        console.log('[Warehouse] itemIdStr:', itemIdStr);
        
        // まず、すべてのphotoGridを確認
        const allPhotoGrids = document.querySelectorAll('.image-list-modal');
        console.log('[Warehouse] All available photo grids:', Array.from(allPhotoGrids).map(el => ({
          category: el.dataset.category,
          itemId: el.dataset.itemId,
          itemIdType: typeof el.dataset.itemId,
          matchesCategory: el.dataset.category === category,
          matchesItemId: el.dataset.itemId === itemIdStr || el.dataset.itemId === itemId || String(el.dataset.itemId) === itemIdStr
        })));
        
        // セレクターを構築
        const selector = `.image-list-modal[data-category="${category}"][data-item-id="${itemIdStr}"]`;
        console.log('[Warehouse] Looking for photo grid with selector:', selector);
        
        let photoGrid = document.querySelector(selector);
        if (!photoGrid) {
          console.warn('[Warehouse] Direct selector failed, trying fallback search');
          
          // より柔軟な検索を試す
          const fallbackGrid = Array.from(allPhotoGrids).find(el => {
            const categoryMatch = el.dataset.category === category;
            const itemIdMatch = el.dataset.itemId === itemIdStr || 
                               el.dataset.itemId === itemId || 
                               String(el.dataset.itemId) === itemIdStr ||
                               String(el.dataset.itemId) === String(itemId);
            console.log('[Warehouse] Checking grid:', {
              category: el.dataset.category,
              itemId: el.dataset.itemId,
              categoryMatch,
              itemIdMatch,
              willMatch: categoryMatch && itemIdMatch
            });
            return categoryMatch && itemIdMatch;
          });
          
          if (fallbackGrid) {
            console.log('[Warehouse] Found photo grid using fallback search:', fallbackGrid);
            photoGrid = fallbackGrid;
          } else {
            console.error('[Warehouse] Could not find photo grid even with fallback search');
            console.error('[Warehouse] Searched for:', { category, itemId: itemIdStr, originalItemId: itemId });
            alert(`画像を追加できませんでした。\nカテゴリ: ${category}\n項目ID: ${itemIdStr}\n\nコンソールを確認してください。`);
            return false;
          }
        } else {
          console.log('[Warehouse] Found photo grid using direct selector');
        }
        
        console.log('[Warehouse] Found photo grid:', photoGrid);
        
        // 既に同じ画像が追加されていないか確認
        const escapedUrl = escapeHtml(imageUrl);
        const existingImages = photoGrid.querySelectorAll(`.image-item-modal[data-url="${escapedUrl}"]`);
        if (existingImages.length > 0) {
          console.log('[Warehouse] Image already exists, skipping:', imageUrl);
          return false; // 既に追加されている
        }
        
        const photoItem = document.createElement('div');
        photoItem.className = 'image-item-modal';
        photoItem.dataset.url = imageUrl;
        photoItem.innerHTML = `
          <img src="${escapedUrl}" alt="Selected from warehouse" loading="lazy">
          <button type="button" class="image-remove-modal" onclick="removePhotoModal(this)">
            <i class="fas fa-times"></i>
          </button>
        `;
        
        // アップロードボタンの前に挿入
        const addBtns = photoGrid.querySelector('.image-add-btns-modal');
        console.log('[Warehouse] addBtns found:', !!addBtns);
        
        if (addBtns) {
          photoGrid.insertBefore(photoItem, addBtns);
          console.log('[Warehouse] Image inserted before add buttons');
        } else {
          photoGrid.appendChild(photoItem);
          console.log('[Warehouse] Image appended to grid (no add buttons found)');
        }
        
        // 追加されたことを確認
        const addedImage = photoGrid.querySelector(`.image-item-modal[data-url="${escapedUrl}"]`);
        if (addedImage) {
          console.log('[Warehouse] ✓ Image successfully added to DOM:', imageUrl);
          console.log('[Warehouse] Photo grid now has', photoGrid.children.length, 'children');
          return true; // 成功
        } else {
          console.error('[Warehouse] ✗ Image was not added to DOM:', imageUrl);
          return false;
        }
      };

      // 画像倉庫から選択した画像をレポートに追加（セクション用）
      window.addWarehouseImageToReportSection = function(imageUrl, category, sectionId) {
        console.log('[Warehouse] ===== Adding image to report section =====');
        console.log('[Warehouse] Parameters:', { imageUrl, category, sectionId });
        
        const selector = `.image-list-modal[data-category="${category}"][data-section-id="${sectionId}"]`;
        console.log('[Warehouse] Looking for photo grid with selector:', selector);
        
        let photoGrid = document.querySelector(selector);
        if (!photoGrid) {
          console.error('[Warehouse] Could not find photo grid for section:', { category, sectionId });
          alert(`画像を追加できませんでした。\nカテゴリ: ${category}\nセクションID: ${sectionId}`);
          return false;
        }
        
        console.log('[Warehouse] Found photo grid:', photoGrid);
        
        // 既に同じ画像が追加されていないか確認
        const escapedUrl = escapeHtml(imageUrl);
        const existingImages = photoGrid.querySelectorAll(`.image-item-modal[data-url="${escapedUrl}"]`);
        if (existingImages.length > 0) {
          console.log('[Warehouse] Image already exists, skipping:', imageUrl);
          return false;
        }
        
        const photoItem = document.createElement('div');
        photoItem.className = 'image-item-modal';
        photoItem.dataset.url = imageUrl;
        photoItem.dataset.sectionId = sectionId;
        photoItem.innerHTML = `
          <img src="${escapedUrl}" alt="Selected from warehouse" loading="lazy">
          <button type="button" class="image-remove-modal" onclick="removePhotoModal(this)">
            <i class="fas fa-times"></i>
          </button>
        `;
        
        // アップロードボタンの前に挿入
        const addBtns = photoGrid.querySelector('.image-add-btns-modal');
        if (addBtns) {
          photoGrid.insertBefore(photoItem, addBtns);
        } else {
          photoGrid.appendChild(photoItem);
        }
        
        return true;
      };

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

      // モーダル用: 4つの追加ボタン
      // 1. 清掃項目を追加
      document.getElementById('add-work-item-modal')?.addEventListener('click', function() {
        window.addWorkItemModal();
      });
      
      // 2. 画像を追加（作業前・作業後のセクションを直接追加）
      document.getElementById('add-image-modal')?.addEventListener('click', function() {
        window.addImageSectionModal('work');
      });
      
      // 3. コメントを追加（コメントセクションを追加）
      document.getElementById('add-comment-modal')?.addEventListener('click', function() {
        window.addCommentSectionModal();
      });
      
      // 4. 作業内容を追加（作業内容セクションを追加）
      document.getElementById('add-work-content-modal')?.addEventListener('click', function() {
        window.addWorkContentSectionModal();
      });

      // ヘルプボタン
      document.getElementById('btn-help-report')?.addEventListener('click', function() {
        document.getElementById('help-dialog').showModal();
      });

      // モーダル用: 店舗選択の変更
      document.getElementById('report-store')?.addEventListener('change', function() {
        const selectedOption = this.options[this.selectedIndex];
        document.getElementById('report-store-name').value = selectedOption.text;
      });
      
      // モーダル用: 担当者選択の変更
      document.getElementById('report-worker')?.addEventListener('change', function() {
        const selectedOption = this.options[this.selectedIndex];
        document.getElementById('report-worker-name').value = selectedOption.text;
      });

      // フォーム送信（モーダル用）
      document.getElementById('report-form-modal').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        try {
          const formData = {
            store_id: document.getElementById('report-store').value,
            store_name: document.getElementById('report-store-name').value,
            cleaning_date: document.getElementById('report-date').value,
            cleaning_start_time: document.getElementById('report-start').value,
            cleaning_end_time: document.getElementById('report-end').value,
            staff_id: document.getElementById('report-worker').value || '',
            staff_name: document.getElementById('report-worker-name').value || '',
            work_items: []
          };
          
          // 清掃項目を収集
          document.querySelectorAll('.cleaning-section-modal').forEach(section => {
            const itemId = section.dataset.itemId;
            const titleSelect = section.querySelector('.item-title-select-modal');
            const titleInput = section.querySelector('.item-title-input-modal');
            
            // 清掃項目名を取得（フリーワード入力対応）
            let itemName = '';
            if (titleSelect && titleSelect.value === '__custom__' && titleInput) {
              itemName = (titleInput.value || '').trim();
            } else if (titleSelect && titleSelect.value && titleSelect.value !== '__custom__') {
              itemName = (titleSelect.value || '').trim();
            } else if (titleInput && titleInput.value) {
              itemName = (titleInput.value || '').trim();
            }
            
            // 未入力の清掃項目はスキップ
            if (!itemName) {
              return;
            }
            
            const detailInputs = section.querySelectorAll('.detail-tag-input-modal');
            const type = detailInputs[0]?.value?.trim() || '';
            const count = detailInputs[1]?.value?.trim() || '';
            
            const workItem = {
              item_id: itemId,
              item_name: itemName,
              details: {
                type: type,
                count: count
              }
            };
            
            formData.work_items.push(workItem);
          });
          
          // 画像セクション、コメントセクション、作業内容セクションを収集
          formData.sections = [];
          
          // 画像セクションを収集
          document.querySelectorAll('.image-section-modal').forEach(section => {
            const sectionId = section.dataset.sectionId;
            const imageType = section.dataset.imageType || 'work';
            
            const sectionData = {
              section_id: sectionId,
              section_type: 'image',
              image_type: imageType,
              photos: {
                before: [],
                after: []
              }
            };
            
            // 作業前の写真
            const beforeContainer = section.querySelector('.image-list-modal[data-category="before"]');
            if (beforeContainer) {
              const beforeItems = beforeContainer.querySelectorAll('.image-item-modal:not(.image-add-btns-modal)');
              console.log(`[Submit] Image section ${sectionId} - Before items found:`, beforeItems.length);
            beforeItems.forEach(photoItem => {
              if (photoItem.dataset.base64) {
                  sectionData.photos.before.push(photoItem.dataset.base64);
              } else if (photoItem.dataset.url) {
                  sectionData.photos.before.push(photoItem.dataset.url);
              } else {
                const img = photoItem.querySelector('img');
                if (img && img.src) {
                    sectionData.photos.before.push(img.src);
                }
              }
            });
            }
            
            // 作業後の写真
            const afterContainer = section.querySelector('.image-list-modal[data-category="after"]');
            if (afterContainer) {
              const afterItems = afterContainer.querySelectorAll('.image-item-modal:not(.image-add-btns-modal)');
              console.log(`[Submit] Image section ${sectionId} - After items found:`, afterItems.length);
            afterItems.forEach(photoItem => {
              if (photoItem.dataset.base64) {
                  sectionData.photos.after.push(photoItem.dataset.base64);
              } else if (photoItem.dataset.url) {
                  sectionData.photos.after.push(photoItem.dataset.url);
              } else {
                const img = photoItem.querySelector('img');
                if (img && img.src) {
                    sectionData.photos.after.push(img.src);
                }
              }
            });
            }
            
            // 空の画像セクション（写真が1枚もない）はスキップ
            if (sectionData.photos.before.length === 0 && sectionData.photos.after.length === 0) {
              console.log(`[Submit] Image section ${sectionId} - Skipped (no photos)`);
              return;
            }
            
            console.log(`[Submit] Image section ${sectionId} - Photos:`, sectionData.photos);
            formData.sections.push(sectionData);
          });
          
          // コメントセクションを収集
          document.querySelectorAll('.comment-section-modal').forEach(section => {
            const sectionId = section.dataset.sectionId;
            const textarea = section.querySelector('.comment-textarea-modal');
            const comment = textarea ? textarea.value.trim() : '';
            
            // 空のコメントセクションはスキップ
            if (!comment) {
              return;
            }
            
            formData.sections.push({
              section_id: sectionId,
              section_type: 'comment',
              content: comment
            });
          });
          
          // 作業内容セクションを収集
          document.querySelectorAll('.work-content-section-modal').forEach(section => {
            const sectionId = section.dataset.sectionId;
            const textarea = section.querySelector('.work-content-textarea-modal');
            const content = textarea ? textarea.value.trim() : '';
            
            // 空の作業内容セクションはスキップ
            if (!content) {
              return;
            }
            
            formData.sections.push({
              section_id: sectionId,
              section_type: 'work_content',
              content: content
            });
          });
          
          // バリデーション
          if (!formData.store_id) {
            alert('店舗を選択してください');
            return;
          }
          
          if (!formData.cleaning_date) {
            alert('清掃日を入力してください');
            return;
          }
          
          // 少なくとも1つのセクション（清掃項目、画像、コメント、作業内容のいずれか）が必要
          if (formData.work_items.length === 0 && formData.sections.length === 0) {
            alert('少なくとも1つの項目（清掃項目、画像、コメント、作業内容のいずれか）を追加してください');
            return;
          }
          
          // デバッグログ
          console.log('[Submit] Final formData:', JSON.stringify(formData, null, 2));
          console.log('[Submit] Sections count:', formData.sections.length);
          formData.sections.forEach((section, idx) => {
            console.log(`[Submit] Section ${idx}:`, section);
            if (section.section_type === 'image') {
              console.log(`[Submit] Section ${idx} - Before photos:`, section.photos?.before);
              console.log(`[Submit] Section ${idx} - After photos:`, section.photos?.after);
            }
          });
          
          // 編集モードかどうかを判定
          const reportId = document.getElementById('report-id').value;
          const isEditMode = reportId && reportId.trim() !== '';
          
          // APIに送信
          const idToken = await getFirebaseIdToken();
          const url = isEditMode 
            ? `${REPORT_API}/staff/reports/${reportId}`
            : `${REPORT_API}/staff/reports`;
          const method = isEditMode ? 'PUT' : 'POST';
          
          const response = await fetch(url, {
            method: method,
            headers: {
              'Authorization': `Bearer ${idToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
            });
          
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || (isEditMode ? 'レポートの更新に失敗しました' : 'レポートの作成に失敗しました'));
          }
          
          const result = await response.json();
          alert(isEditMode ? 'レポートを更新しました' : 'レポートを作成しました');
          document.getElementById('new-dialog').close();
          
          // フォームをリセット
          document.getElementById('report-form-modal').reset();
          document.getElementById('report-id').value = '';
          document.getElementById('work-items-container-modal').innerHTML = '';
          document.getElementById('cleaning-items-list-modal').innerHTML = '<span class="items-list-empty-modal">項目を追加してください</span>';
          modalWorkItemCounter = 0;
          document.getElementById('form-title').textContent = '新規レポート作成';
          
          await loadReports();
        } catch (error) {
          console.error('Error submitting report:', error);
          alert(`エラー: ${error.message}`);
        }
      });
    }

    function formatDate(dateStr) {
      if (!dateStr) return '-';
      const d = new Date(dateStr);
      return d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' });
    }

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
  })();
