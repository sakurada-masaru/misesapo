// APIエンドポイント（将来的に実装）
const API_BASE_URL = 'https://2z0ui5xfxb.execute-api.ap-northeast-1.amazonaws.com/prod';

// デフォルト画像（画像がない場合）
const DEFAULT_NO_PHOTO_IMAGE = '/images-admin/sorry.png';

// パスを解決（GitHub Pages対応）
function resolvePath(path) {
    if (!path || path.startsWith('http://') || path.startsWith('https://') || path.startsWith('//')) {
        return path;
    }
    
    const hostname = window.location.hostname;
    const isLocalDev = hostname === 'localhost' || 
                      hostname === '127.0.0.1' ||
                      hostname === '';
    
    const isCustomDomain = hostname === 'misesapo.co.jp' || hostname === 'www.misesapo.co.jp';
    
    if (isLocalDev || isCustomDomain) {
        return path.startsWith('/') ? path : '/' + path;
    }
    
    // GitHub Pages（sakurada-masaru.github.io）では/misesapo/を追加
    let resolvedPath;
    if (path.startsWith('/misesapo/')) {
        resolvedPath = path;
    } else if (path.startsWith('/')) {
        resolvedPath = '/misesapo' + path;
    } else {
        resolvedPath = '/misesapo/' + path;
    }
    
    return resolvedPath;
}

// URLからレポートIDを取得
function getReportIdFromUrl() {
    const path = window.location.pathname;
    // /reports/shared/{id}/view の形式からIDを取得
    const match = path.match(/\/reports\/shared\/([^\/]+)\/view/);
    return match ? match[1] : null;
}

// 日付フォーマット
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// レポート詳細を取得
async function loadReportDetail() {
    const loadingEl = document.getElementById('loading');
    const contentEl = document.getElementById('report-content');
    const errorEl = document.getElementById('error-message');
    
    const reportId = getReportIdFromUrl();
    if (!reportId) {
        if (loadingEl) loadingEl.style.display = 'none';
        if (errorEl) {
            errorEl.style.display = 'block';
            errorEl.textContent = 'レポートIDが取得できませんでした';
        }
        return;
    }

    try {
        if (loadingEl) loadingEl.style.display = 'block';
        if (contentEl) contentEl.style.display = 'none';
        if (errorEl) errorEl.style.display = 'none';
        
        // APIからレポートデータを取得
        try {
            const response = await fetch(`${API_BASE_URL}/public/reports/${reportId}`);
            if (!response.ok) {
                throw new Error('レポートが見つかりませんでした');
            }
            const data = await response.json();
            const report = data.report || data;
            
            // レポート情報を表示
            renderReport(report);
        } catch (apiError) {
            console.warn('API fetch failed, trying local JSON:', apiError);
            
            // フォールバック: ローカルJSONファイルから取得
            try {
                const reportsResponse = await fetch('/data/cleaning_reports.json');
                const reportsData = await reportsResponse.json();
                const report = reportsData.reports.find(r => r.id == reportId);
                
                if (report) {
                    // 古い形式のデータを変換
                    let cleaningDate = new Date().toISOString();
                    if (report.cleaning_datetime) {
                        const match = report.cleaning_datetime.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
                        if (match) {
                            const year = parseInt(match[1]);
                            const month = parseInt(match[2]) - 1;
                            const day = parseInt(match[3]);
                            cleaningDate = new Date(year, month, day).toISOString();
                        }
                    }
                    
                    const formattedReport = {
                        report_id: report.id,
                        cleaning_date: cleaningDate,
                        cleaning_start_time: '08:00',
                        cleaning_end_time: '11:30',
                        store_name: report.store_name || 'テスト店舗',
                        work_items: (report.detail || []).map(item => ({
                            item_name: item.cleaning_item,
                            work_content: item.work_content,
                            work_memo: item.work_memo,
                            photos: {
                                before: item.images ? [item.images[0]] : [],
                                after: item.images ? [item.images[1]] : []
                            }
                        }))
                    };
                    
                    renderReport(formattedReport);
                } else {
                    throw new Error('レポートが見つかりませんでした');
                }
            } catch (localError) {
                console.error('Local JSON fetch also failed:', localError);
                throw new Error('レポートが見つかりませんでした');
            }
        }
        
        if (loadingEl) loadingEl.style.display = 'none';
        if (contentEl) contentEl.style.display = 'block';
    } catch (error) {
        console.error('Error loading report:', error);
        if (loadingEl) loadingEl.style.display = 'none';
        if (errorEl) {
            errorEl.style.display = 'block';
            errorEl.textContent = `エラー: ${error.message}`;
        }
    }
}

// HTMLエスケープ
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// レポートを表示
function renderReport(report) {
    // ヘッダー
    // ブランド名（brand_name、brand、brandNameのいずれかから取得）
    const brandEl = document.getElementById('report-brand');
    if (brandEl) {
        const brandName = report.brand_name || report.brand || report.brandName || 
                         (report.store && report.store.brand_name) || 
                         'ブランド名不明';
        brandEl.textContent = brandName;
    }
    
    // 清掃日時
    const dateStr = formatDate(report.cleaning_date);
    const timeStr = report.cleaning_start_time && report.cleaning_end_time 
        ? `${report.cleaning_start_time} - ${report.cleaning_end_time}`
        : '';
    document.getElementById('report-date').textContent = `清掃日時: ${dateStr} ${timeStr}`;
    
    // 店舗名
    document.getElementById('report-store').textContent = report.store_name || '店舗名不明';
    
    // 担当者氏名
    const staffEl = document.getElementById('report-staff');
    if (staffEl && report.staff_name) {
        staffEl.textContent = `担当: ${report.staff_name}`;
    }
    
    // 清掃項目リスト
    const cleaningItemsEl = document.getElementById('cleaning-items');
    const items = report.work_items || [];
    const itemNames = items.map(item => item.item_name || item.item_id).filter(Boolean);
    cleaningItemsEl.innerHTML = itemNames.map(name => 
        `<span class="items-list-item">${escapeHtml(name)}</span>`
    ).join('');
    
    // 清掃項目の詳細（項目名と詳細のみ、写真は別のsectionsで表示）
    const workItemsHtml = items.map(item => {
        const details = item.details || {};
        const tags = [];
        if (details.type) tags.push(details.type);
        if (details.count) tags.push(`${details.count}個`);
        const tagsHtml = tags.map(tag => `<span class="detail-tag">${escapeHtml(tag)}</span>`).join('');
        
        return `
          <section class="cleaning-section">
            <div class="item-header">
              <h3 class="item-title">〜 ${escapeHtml(item.item_name || item.item_id)} 〜</h3>
              <div class="item-details">${tagsHtml}</div>
            </div>
          </section>
        `;
    }).join('');
    
    // セクション（画像、コメント、作業内容）を表示
    const sections = report.sections || [];
    const sectionsHtml = sections.map(section => {
        if (section.section_type === 'image') {
            // 画像セクション
            const beforePhotos = section.photos?.before || [];
            const afterPhotos = section.photos?.after || [];
            const imageType = section.image_type || 'work';
            const beforeLabel = imageType === 'work' ? '作業前（Before）' : '設置前（Before）';
            const afterLabel = imageType === 'work' ? '作業後（After）' : '設置後（After）';
            
            const beforePhotosHtml = beforePhotos.length > 0
                ? `<div class="image-list">
                     ${beforePhotos.map((url, index) => `
                       <div class="image-item" data-image-url="${url}">
                         <img src="${url}" alt="${beforeLabel}" loading="lazy" 
                              onerror="this.onerror=null; this.src='${DEFAULT_NO_PHOTO_IMAGE}';" />
                       </div>
                     `).join('')}
                   </div>`
                : `<div class="image-list">
                     <div class="image-item">
                       <img src="${resolvePath(DEFAULT_NO_PHOTO_IMAGE)}" alt="写真なし" class="default-no-photo-image" />
                     </div>
                   </div>`;
            
            const afterPhotosHtml = afterPhotos.length > 0
                ? `<div class="image-list">
                     ${afterPhotos.map((url, index) => `
                       <div class="image-item" data-image-url="${url}">
                         <img src="${url}" alt="${afterLabel}" loading="lazy" 
                              onerror="this.onerror=null; this.src='${resolvePath(DEFAULT_NO_PHOTO_IMAGE)}';" />
                       </div>
                     `).join('')}
                   </div>`
                : `<div class="image-list">
                     <div class="image-item">
                       <img src="${resolvePath(DEFAULT_NO_PHOTO_IMAGE)}" alt="写真なし" class="default-no-photo-image" />
                     </div>
                   </div>`;
            
            return `
              <section class="image-section">
                <div class="section-header">
                  <h4 class="section-title">画像</h4>
                </div>
                <div class="image-grid">
                  <div class="image-category before-category">
                    <h4 class="image-category-title">${beforeLabel}</h4>
                    ${beforePhotosHtml}
                  </div>
                  <div class="image-category after-category">
                    <h4 class="image-category-title">${afterLabel}</h4>
                    ${afterPhotosHtml}
                  </div>
                </div>
              </section>
            `;
        } else if (section.section_type === 'comment') {
            // コメントセクション
            return `
              <section class="comment-section">
                <div class="section-header">
                  <h4 class="section-title">コメント</h4>
                </div>
                <div class="subsection">
                  <p style="white-space: pre-wrap;">${escapeHtml(section.content || '')}</p>
                </div>
              </section>
            `;
        } else if (section.section_type === 'work_content') {
            // 作業内容セクション
            return `
              <section class="work-content-section">
                <div class="section-header">
                  <h4 class="section-title">作業内容</h4>
                </div>
                <div class="subsection">
                  <p style="white-space: pre-wrap;">${escapeHtml(section.content || '')}</p>
                </div>
              </section>
            `;
        }
        return '';
    }).filter(Boolean).join('');
    
    // レポート本体を表示
    const reportMainEl = document.getElementById('report-main');
    reportMainEl.innerHTML = workItemsHtml + sectionsHtml;
    
    // 画像クリックイベントを設定
    setupImageModal();
}

// 画像モーダル機能
function setupImageModal() {
    const imageItems = document.querySelectorAll('.image-item');
    
    imageItems.forEach(item => {
        item.style.cursor = 'pointer';
        item.addEventListener('click', function() {
            const img = this.querySelector('img');
            if (img && img.src) {
                openImageModal(img.src);
            }
        });
    });
}

// 画像モーダルを開く
function openImageModal(imageSrc) {
    // モーダルが既に存在する場合は削除
    const existingModal = document.getElementById('image-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // モーダル要素を作成
    const modal = document.createElement('div');
    modal.id = 'image-modal';
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
    
    // モーダルを表示
    setTimeout(() => {
        modal.classList.add('show');
    }, 10);
}

// レポート承認の処理
document.addEventListener('DOMContentLoaded', function() {
    // 必要な要素が存在する場合のみloadReportDetailを実行
    const loadingEl = document.getElementById('loading');
    const contentEl = document.getElementById('report-content');
    if (loadingEl || contentEl) {
        loadReportDetail();
    }
    
    // レポート承認ボタンの処理
    const approvalButton = document.getElementById('approval-button');
    if (approvalButton) {
        approvalButton.addEventListener('click', function() {
            if (this.disabled) return;
            
            // ダイアログを表示
            showApprovalDialog();
        });
    }
});

// 承認ダイアログを表示
function showApprovalDialog() {
    // 既存のダイアログが存在する場合は削除
    const existingDialog = document.getElementById('approval-dialog');
    if (existingDialog) {
        existingDialog.remove();
    }
    
    // ダイアログ要素を作成
    const dialog = document.createElement('div');
    dialog.id = 'approval-dialog';
    dialog.className = 'approval-dialog';
    dialog.innerHTML = `
        <div class="approval-dialog-overlay"></div>
        <div class="approval-dialog-content">
            <p class="approval-dialog-message">レポート承認を受け付けました。スタッフ一同、またのご利用心よりお待ちしております。ありがとうございました</p>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    // ダイアログを表示
    setTimeout(() => {
        dialog.classList.add('show');
    }, 10);
    
    // タッチ/クリックでダイアログを閉じる
    const overlay = dialog.querySelector('.approval-dialog-overlay');
    const content = dialog.querySelector('.approval-dialog-content');
    
    const closeDialog = () => {
        dialog.classList.remove('show');
        setTimeout(() => {
            dialog.remove();
            // ボタンを「ありがとうございました」に変更し、無効化
            const approvalButton = document.getElementById('approval-button');
            if (approvalButton) {
                approvalButton.textContent = 'ありがとうございました';
                approvalButton.disabled = true;
                approvalButton.classList.add('disabled');
            }
        }, 300);
    };
    
    overlay.addEventListener('click', closeDialog);
    content.addEventListener('click', closeDialog);
    
    // ESCキーで閉じる
    const handleEsc = (e) => {
        if (e.key === 'Escape') {
            closeDialog();
            document.removeEventListener('keydown', handleEsc);
        }
    };
    document.addEventListener('keydown', handleEsc);
}


