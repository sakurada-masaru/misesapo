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

// 次回ご提案レポートを取得
async function loadProposalReport(reportId, reportData = null) {
    const proposalLoadingEl = document.getElementById('proposal-loading');
    const proposalEmptyEl = document.getElementById('proposal-empty');
    const proposalItemsBarEl = document.getElementById('proposal-items-bar');
    const proposalMainEl = document.getElementById('proposal-report-main');
    
    // ローディング表示
    if (proposalLoadingEl) proposalLoadingEl.style.display = 'block';
    if (proposalEmptyEl) proposalEmptyEl.style.display = 'none';
    if (proposalItemsBarEl) proposalItemsBarEl.style.display = 'none';
    if (proposalMainEl) proposalMainEl.style.display = 'none';
    
    // 既に取得済みのレポートデータがある場合はそれを使用
    let report = reportData;
    
    // レポートデータがない場合は取得を試みる（CORSエラーの可能性があるため、短いタイムアウトで試行）
    if (!report) {
        try {
            // タイムアウト付きでfetchを実行
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); // 3秒でタイムアウト
            
            const response = await fetch(`${API_BASE_URL}/public/reports/${reportId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json();
                report = data.report || data;
            }
        } catch (fetchError) {
            // CORSエラーやネットワークエラー、タイムアウトの場合は次回ご提案を取得できない
            // エラーを無視して、次回ご提案がない場合として扱う
        }
    }
    
    // レポートデータがない場合は次回ご提案も取得できない
    if (!report) {
        if (proposalLoadingEl) proposalLoadingEl.style.display = 'none';
        if (proposalEmptyEl) proposalEmptyEl.style.display = 'block';
        if (proposalItemsBarEl) proposalItemsBarEl.style.display = 'none';
        if (proposalMainEl) proposalMainEl.style.display = 'none';
        return;
    }
    
    // 次回ご提案レポートを探す（parent_report_idまたはstore_id + cleaning_dateで検索）
    let proposalReport = null;
    
    // 方法1: parent_report_idで検索（CORSエラーの可能性があるため、タイムアウト付きで試行）
    if (report.report_id || report.id) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); // 3秒でタイムアウト
            
            const proposalResponse = await fetch(`${API_BASE_URL}/public/reports?parent_report_id=${report.report_id || report.id}&proposal_type=proposal`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (proposalResponse && proposalResponse.ok) {
                try {
                    const proposalData = await proposalResponse.json();
                    if (proposalData.reports && proposalData.reports.length > 0) {
                        proposalReport = proposalData.reports[0];
                    } else if (proposalData.items && proposalData.items.length > 0) {
                        proposalReport = proposalData.items[0];
                    } else if (proposalData.report) {
                        proposalReport = proposalData.report;
                    }
                } catch (jsonError) {
                    // JSON解析エラーは無視
                }
            }
        } catch (fetchError) {
            // CORSエラーやネットワークエラー、タイムアウトの場合は静かに失敗
            // エラーログは出力しない（ブラウザが自動的に表示するため）
        }
    }
    
    // 方法2: store_id + cleaning_dateで検索（parent_report_idがない場合）
    if (!proposalReport && report.store_id && report.cleaning_date) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); // 3秒でタイムアウト
            
            const proposalResponse = await fetch(`${API_BASE_URL}/public/reports?store_id=${report.store_id}&cleaning_date=${report.cleaning_date}&proposal_type=proposal`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (proposalResponse && proposalResponse.ok) {
                try {
                    const proposalData = await proposalResponse.json();
                    if (proposalData.reports && proposalData.reports.length > 0) {
                        proposalReport = proposalData.reports[0];
                    } else if (proposalData.items && proposalData.items.length > 0) {
                        proposalReport = proposalData.items[0];
                    } else if (proposalData.report) {
                        proposalReport = proposalData.report;
                    }
                } catch (jsonError) {
                    // JSON解析エラーは無視
                }
            }
        } catch (fetchError) {
            // CORSエラーやネットワークエラー、タイムアウトの場合は静かに失敗
            // エラーログは出力しない（ブラウザが自動的に表示するため）
        }
    }
    
    // 結果を表示
    if (proposalReport) {
        // 次回ご提案を表示
        renderProposalReport(proposalReport);
        if (proposalLoadingEl) proposalLoadingEl.style.display = 'none';
        if (proposalEmptyEl) proposalEmptyEl.style.display = 'none';
        if (proposalItemsBarEl) proposalItemsBarEl.style.display = 'flex';
        if (proposalMainEl) proposalMainEl.style.display = 'block';
    } else {
        // 次回ご提案がない場合
        if (proposalLoadingEl) proposalLoadingEl.style.display = 'none';
        if (proposalEmptyEl) proposalEmptyEl.style.display = 'block';
        if (proposalItemsBarEl) proposalItemsBarEl.style.display = 'none';
        if (proposalMainEl) proposalMainEl.style.display = 'none';
    }
}

// 次回ご提案レポートを表示
function renderProposalReport(report) {
    // 清掃項目リスト
    const items = report.work_items || [];
    const proposalItemsEl = document.getElementById('proposal-cleaning-items');
    if (proposalItemsEl) {
        const itemNames = items.map(item => item.item_name || item.item_id).filter(Boolean);
        proposalItemsEl.innerHTML = itemNames.map(name => 
            `<span class="items-list-item">${escapeHtml(name)}</span>`
        ).join('');
    }
    
    // レポート本体を表示
    const proposalMainEl = document.getElementById('proposal-report-main');
    if (proposalMainEl) {
        // 清掃項目の詳細
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
                // 画像URLを正規化（配列でない場合や、オブジェクトの場合に対応）
                const normalizePhotoUrls = (photos) => {
                    if (!photos) return [];
                    if (Array.isArray(photos)) {
                        return photos.map(photo => {
                            if (typeof photo === 'string') {
                                // 文字列の場合はそのまま返す（相対パスの場合はresolvePathで解決）
                                return photo.startsWith('http://') || photo.startsWith('https://') || photo.startsWith('//')
                                    ? photo
                                    : resolvePath(photo);
                            } else if (typeof photo === 'object' && photo !== null) {
                                // オブジェクトの場合はurlプロパティを取得
                                const url = photo.url || photo.warehouseUrl || photo.imageUrl || '';
                                return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')
                                    ? url
                                    : resolvePath(url);
                            }
                            return '';
                        }).filter(Boolean);
                    }
                    return [];
                };
                
                const beforePhotos = normalizePhotoUrls(section.photos?.before);
                const afterPhotos = normalizePhotoUrls(section.photos?.after);
                const imageType = section.image_type || 'work';
                const beforeLabel = imageType === 'work' ? '作業前（Before）' : '設置前（Before）';
                const afterLabel = imageType === 'work' ? '作業後（After）' : '設置後（After）';
                
                const beforePhotosHtml = beforePhotos.length > 0
                    ? `<div class="image-list">
                         ${beforePhotos.map((url, index) => {
                             const resolvedUrl = url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')
                                 ? url
                                 : resolvePath(url);
                             return `
                           <div class="image-item" data-image-url="${resolvedUrl}">
                             <img src="${resolvedUrl}" alt="${beforeLabel}" loading="lazy" 
                                  onerror="this.onerror=null; this.src='${resolvePath(DEFAULT_NO_PHOTO_IMAGE)}';" />
                           </div>
                         `;
                         }).join('')}
                       </div>`
                    : `<div class="image-list">
                         <div class="image-item">
                           <img src="${resolvePath(DEFAULT_NO_PHOTO_IMAGE)}" alt="写真なし" class="default-no-photo-image" />
                         </div>
                       </div>`;
                
                const afterPhotosHtml = afterPhotos.length > 0
                    ? `<div class="image-list">
                         ${afterPhotos.map((url, index) => {
                             const resolvedUrl = url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')
                                 ? url
                                 : resolvePath(url);
                             return `
                           <div class="image-item" data-image-url="${resolvedUrl}">
                             <img src="${resolvedUrl}" alt="${afterLabel}" loading="lazy" 
                                  onerror="this.onerror=null; this.src='${resolvePath(DEFAULT_NO_PHOTO_IMAGE)}';" />
                           </div>
                         `;
                         }).join('')}
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
        
        proposalMainEl.innerHTML = workItemsHtml + sectionsHtml;
        
        // 画像クリックイベントを設定
        setupImageModal();
    }
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
            
            // デバッグログ: APIから取得したレポートデータを確認
            console.log('[loadReportDetail] API response:', data);
            console.log('[loadReportDetail] Report data:', report);
            console.log('[loadReportDetail] Report sections:', report.sections);
            console.log('[loadReportDetail] work_items:', report.work_items);
            if (report.work_items && report.work_items.length > 0) {
                report.work_items.forEach((item, index) => {
                    console.log(`[loadReportDetail] work_items[${index}]:`, item);
                    console.log(`[loadReportDetail] work_items[${index}].photos:`, item.photos);
                });
            }
            
            // レポート情報を表示（window.renderReportを使用）
            if (window.renderReport) {
                window.renderReport(report);
            } else {
                console.error('window.renderReport is not defined');
            }
            
            // 次回ご提案も読み込む（既に取得したレポートデータを渡すことで、CORSエラーを避ける）
            await loadProposalReport(reportId, report);
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
                    
                    // レポート情報を表示（window.renderReportを使用）
                    if (window.renderReport) {
                        window.renderReport(formattedReport);
                    } else {
                        console.error('window.renderReport is not defined');
                    }
                    
                    // 次回ご提案はローカルJSONにはないため、空表示
                    const proposalEmptyEl = document.getElementById('proposal-empty');
                    if (proposalEmptyEl) proposalEmptyEl.style.display = 'block';
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

// レポートを表示（グローバルに公開）
window.renderReport = function(report, container) {
    console.log('[window.renderReport] Called with container:', container ? 'yes' : 'no');
    // コンテナ要素が指定された場合は、そのコンテナ内にHTMLを生成
    if (container) {
        console.log('[window.renderReport] Calling renderReportToContainer');
        return renderReportToContainer(report, container);
    }
    
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
    const dateEl = document.getElementById('report-date');
    if (dateEl) {
        dateEl.textContent = `清掃日時: ${dateStr} ${timeStr}`;
    }
    
    // 店舗名
    const storeEl = document.getElementById('report-store');
    if (storeEl) {
        storeEl.textContent = report.store_name || '店舗名不明';
    }
    
    // 担当者氏名
    const staffEl = document.getElementById('report-staff');
    if (staffEl && report.staff_name) {
        staffEl.textContent = `担当: ${report.staff_name}`;
    }
    
    // 清掃項目リスト
    const items = report.work_items || [];
    const cleaningItemsEl = document.getElementById('cleaning-items');
    if (cleaningItemsEl) {
        const itemNames = items.map(item => item.item_name || item.item_id).filter(Boolean);
        cleaningItemsEl.innerHTML = itemNames.map(name => 
            `<span class="items-list-item">${escapeHtml(name)}</span>`
        ).join('');
    }
    
    // 清掃項目の詳細（項目名、詳細、写真を含む）
    const workItemsHtml = items.map(item => {
        console.log('[renderReport] Processing work item:', item);
        console.log('[renderReport] Item photos (raw):', item.photos);
        const details = item.details || {};
        const tags = [];
        if (details.type) tags.push(details.type);
        if (details.count) tags.push(`${details.count}個`);
        const tagsHtml = tags.map(tag => `<span class="detail-tag">${escapeHtml(tag)}</span>`).join('');
        
        // 画像を正規化
        const normalizePhotoUrls = (photos) => {
            if (!photos) {
                console.log('[renderReport] normalizePhotoUrls: photos is null/undefined');
                return [];
            }
            if (Array.isArray(photos)) {
                return photos.map(photo => {
                    if (typeof photo === 'string') {
                        const resolved = photo.startsWith('http://') || photo.startsWith('https://') || photo.startsWith('//')
                            ? photo
                            : resolvePath(photo);
                        console.log('[renderReport] normalizePhotoUrls: string photo resolved:', photo, '->', resolved);
                        return resolved;
                    } else if (typeof photo === 'object' && photo !== null) {
                        const url = photo.url || photo.warehouseUrl || photo.imageUrl || photo.blobUrl || '';
                        const resolved = url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')
                            ? url
                            : resolvePath(url);
                        console.log('[renderReport] normalizePhotoUrls: object photo resolved:', photo, '->', resolved);
                        return resolved;
                    }
                    console.log('[renderReport] normalizePhotoUrls: unknown photo type:', typeof photo, photo);
                    return '';
                }).filter(Boolean);
            }
            console.log('[renderReport] normalizePhotoUrls: photos is not an array:', typeof photos, photos);
            return [];
        };
        
        const beforePhotos = normalizePhotoUrls(item.photos?.before);
        const afterPhotos = normalizePhotoUrls(item.photos?.after);
        console.log('[renderReport] Item photos (normalized):', {
            itemName: item.item_name,
            before: beforePhotos,
            after: afterPhotos,
            rawPhotos: item.photos
        });
        
        let photosHtml = '';
        if (beforePhotos.length > 0 || afterPhotos.length > 0) {
            const beforePhotosHtml = beforePhotos.length > 0
                ? `<div class="image-list">
                     ${beforePhotos.map((url, index) => {
                         const resolvedUrl = url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')
                             ? url
                             : resolvePath(url);
                         return `
                       <div class="image-item" data-image-url="${resolvedUrl}">
                         <img src="${resolvedUrl}" alt="作業前" loading="lazy" 
                              onclick="if(window.openImageModal) window.openImageModal('${resolvedUrl}')"
                              onerror="this.onerror=null; this.src='${resolvePath(DEFAULT_NO_PHOTO_IMAGE)}';" />
                       </div>
                     `;
                     }).join('')}
                   </div>`
                : '';
            
            const afterPhotosHtml = afterPhotos.length > 0
                ? `<div class="image-list">
                     ${afterPhotos.map((url, index) => {
                         const resolvedUrl = url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')
                             ? url
                             : resolvePath(url);
                         return `
                       <div class="image-item" data-image-url="${resolvedUrl}">
                         <img src="${resolvedUrl}" alt="作業後" loading="lazy" 
                              onclick="if(window.openImageModal) window.openImageModal('${resolvedUrl}')"
                              onerror="this.onerror=null; this.src='${resolvePath(DEFAULT_NO_PHOTO_IMAGE)}';" />
                       </div>
                     `;
                     }).join('')}
                   </div>`
                : '';
            
            photosHtml = `
              <div class="image-grid">
                ${beforePhotos.length > 0 ? `
                  <div class="image-category before-category">
                    <h4 class="image-category-title">作業前（Before）</h4>
                    ${beforePhotosHtml}
                  </div>
                ` : ''}
                ${afterPhotos.length > 0 ? `
                  <div class="image-category after-category">
                    <h4 class="image-category-title">作業後（After）</h4>
                    ${afterPhotosHtml}
                  </div>
                ` : ''}
              </div>
            `;
        }
        
        // コメントとサブタイトルを取得（renderReport関数用）
        const comments = item.comments || [];
        const subtitles = item.subtitles || [];
        
        // サブタイトルとコメントのHTMLを生成
        let subtitlesHtml = '';
        if (subtitles && subtitles.length > 0) {
            subtitlesHtml = subtitles.map(subtitle => 
                `<div class="cleaning-item-subtitle-display" style="margin-top: 12px; margin-bottom: 8px; font-weight: 600; font-size: 1rem; color: #333;">${escapeHtml(subtitle)}</div>`
            ).join('');
        }
        
        let commentsHtml = '';
        if (comments && comments.length > 0) {
            commentsHtml = comments.map(comment => 
                `<div class="cleaning-item-comment-display" style="margin-top: 8px; margin-bottom: 12px; padding: 12px; background: #f5f5f5; border-radius: 4px; white-space: pre-wrap; color: #333;">${escapeHtml(comment)}</div>`
            ).join('');
        }
        
        return `
          <section class="cleaning-section">
            <div class="item-header">
              <h3 class="item-title">〜 ${escapeHtml(item.item_name || item.item_id)} 〜</h3>
              <div class="item-details">${tagsHtml}</div>
            </div>
            ${subtitlesHtml}
            ${photosHtml}
            ${commentsHtml}
          </section>
        `;
    }).join('');
    
    // セクション（画像、コメント、作業内容）を表示
    const sections = report.sections || [];
    
    // デバッグログ: セクションの構造を確認
    console.log('[renderReport] Sections:', sections);
    
    const sectionsHtml = sections.map(section => {
        if (section.section_type === 'image') {
            // 画像セクション
            // 画像URLを正規化（配列でない場合や、オブジェクトの場合に対応）
            const normalizePhotoUrls = (photos) => {
                if (!photos) return [];
                if (Array.isArray(photos)) {
                    return photos.map(photo => {
                        if (typeof photo === 'string') {
                            // 文字列の場合はそのまま返す（相対パスの場合はresolvePathで解決）
                            return photo.startsWith('http://') || photo.startsWith('https://') || photo.startsWith('//')
                                ? photo
                                : resolvePath(photo);
                        } else if (typeof photo === 'object' && photo !== null) {
                            // オブジェクトの場合はurlプロパティを取得
                            return photo.url || photo.warehouseUrl || photo.imageUrl || '';
                        }
                        return '';
                    }).filter(Boolean);
                }
                return [];
            };
            
            const beforePhotos = normalizePhotoUrls(section.photos?.before);
            const afterPhotos = normalizePhotoUrls(section.photos?.after);
            const imageType = section.image_type || 'work';
            const beforeLabel = imageType === 'work' ? '作業前（Before）' : '設置前（Before）';
            const afterLabel = imageType === 'work' ? '作業後（After）' : '設置後（After）';
            
            // デバッグログ: 画像URLを確認
            console.log('[renderReport] Image section:', section);
            console.log('[renderReport] Before photos:', beforePhotos);
            console.log('[renderReport] After photos:', afterPhotos);
            
            const beforePhotosHtml = beforePhotos.length > 0
                ? `<div class="image-list">
                     ${beforePhotos.map((url, index) => {
                         const resolvedUrl = url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')
                             ? url
                             : resolvePath(url);
                         return `
                       <div class="image-item" data-image-url="${resolvedUrl}">
                         <img src="${resolvedUrl}" alt="${beforeLabel}" loading="lazy" 
                              onerror="this.onerror=null; this.src='${resolvePath(DEFAULT_NO_PHOTO_IMAGE)}';" />
                       </div>
                     `;
                     }).join('')}
                   </div>`
                : `<div class="image-list">
                     <div class="image-item">
                       <img src="${resolvePath(DEFAULT_NO_PHOTO_IMAGE)}" alt="写真なし" class="default-no-photo-image" />
                     </div>
                   </div>`;
            
            const afterPhotosHtml = afterPhotos.length > 0
                ? `<div class="image-list">
                     ${afterPhotos.map((url, index) => {
                         const resolvedUrl = url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')
                             ? url
                             : resolvePath(url);
                         return `
                       <div class="image-item" data-image-url="${resolvedUrl}">
                         <img src="${resolvedUrl}" alt="${afterLabel}" loading="lazy" 
                              onerror="this.onerror=null; this.src='${resolvePath(DEFAULT_NO_PHOTO_IMAGE)}';" />
                       </div>
                     `;
                     }).join('')}
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
    if (reportMainEl) {
        reportMainEl.innerHTML = workItemsHtml + sectionsHtml;
        
        // 画像クリックイベントを設定
        setupImageModal();
    }
}

// コンテナ要素内にレポートを表示（プレビュー用）
function renderReportToContainer(report, container) {
    console.log('[renderReportToContainer] Called with report:', report);
    console.log('[renderReportToContainer] work_items:', report.work_items);
    const dateStr = formatDate(report.cleaning_date);
    const timeStr = report.cleaning_start_time && report.cleaning_end_time 
        ? `${report.cleaning_start_time} - ${report.cleaning_end_time}`
        : '';
    const brandName = report.brand_name || report.brand || report.brandName || 
                     (report.store && report.store.brand_name) || 
                     'ブランド名不明';
    const storeName = report.store_name || '店舗名不明';
    const items = report.work_items || [];
    console.log('[renderReportToContainer] items:', items);
    const itemNames = items.map(item => item.item_name || item.item_id).filter(Boolean);
    
    // 清掃項目の詳細（項目名、詳細、写真を含む）
    const workItemsHtml = items.map(item => {
        console.log('[renderReportToContainer] Processing work item:', item);
        const details = item.details || {};
        const tags = [];
        if (details.type) tags.push(details.type);
        if (details.count) tags.push(`${details.count}個`);
        const tagsHtml = tags.map(tag => `<span class="detail-tag">${escapeHtml(tag)}</span>`).join('');
        
        // 画像を正規化
        const normalizePhotoUrls = (photos) => {
            if (!photos) return [];
            if (Array.isArray(photos)) {
                return photos.map(photo => {
                    if (typeof photo === 'string') {
                        return photo.startsWith('http://') || photo.startsWith('https://') || photo.startsWith('//')
                            ? photo
                            : resolvePath(photo);
                    } else if (typeof photo === 'object' && photo !== null) {
                        const url = photo.url || photo.warehouseUrl || photo.imageUrl || photo.blobUrl || '';
                        return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')
                            ? url
                            : resolvePath(url);
                    }
                    return '';
                }).filter(Boolean);
            }
            return [];
        };
        
        const beforePhotos = normalizePhotoUrls(item.photos?.before);
        const afterPhotos = normalizePhotoUrls(item.photos?.after);
        console.log('[renderReportToContainer] Item photos:', {
            itemName: item.item_name,
            before: beforePhotos,
            after: afterPhotos,
            rawPhotos: item.photos
        });
        
        // コメントとサブタイトルを取得
        const comments = item.comments || [];
        const subtitles = item.subtitles || [];
        console.log('[renderReportToContainer] Item comments:', comments);
        console.log('[renderReportToContainer] Item subtitles:', subtitles);
        
        // サブタイトルとコメントのHTMLを生成
        let subtitlesHtml = '';
        if (subtitles && subtitles.length > 0) {
            subtitlesHtml = subtitles.map(subtitle => 
                `<div class="cleaning-item-subtitle-display" style="margin-top: 12px; margin-bottom: 8px; font-weight: 600; font-size: 1rem; color: #333;">${escapeHtml(subtitle)}</div>`
            ).join('');
        }
        
        let commentsHtml = '';
        if (comments && comments.length > 0) {
            commentsHtml = comments.map(comment => 
                `<div class="cleaning-item-comment-display" style="margin-top: 8px; margin-bottom: 12px; padding: 12px; background: #f5f5f5; border-radius: 4px; white-space: pre-wrap; color: #333;">${escapeHtml(comment)}</div>`
            ).join('');
        }
        
        let photosHtml = '';
        if (beforePhotos.length > 0 || afterPhotos.length > 0) {
            const beforePhotosHtml = beforePhotos.length > 0
                ? `<div class="image-list">
                     ${beforePhotos.map((url, index) => {
                         const resolvedUrl = url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')
                             ? url
                             : resolvePath(url);
                         return `
                       <div class="image-item" data-image-url="${resolvedUrl}">
                         <img src="${resolvedUrl}" alt="作業前" loading="lazy" 
                              onclick="if(window.openImageModal) window.openImageModal('${resolvedUrl}')"
                              onerror="this.onerror=null; this.src='${resolvePath(DEFAULT_NO_PHOTO_IMAGE)}';" />
                       </div>
                     `;
                     }).join('')}
                   </div>`
                : '';
            
            const afterPhotosHtml = afterPhotos.length > 0
                ? `<div class="image-list">
                     ${afterPhotos.map((url, index) => {
                         const resolvedUrl = url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')
                             ? url
                             : resolvePath(url);
                         return `
                       <div class="image-item" data-image-url="${resolvedUrl}">
                         <img src="${resolvedUrl}" alt="作業後" loading="lazy" 
                              onclick="if(window.openImageModal) window.openImageModal('${resolvedUrl}')"
                              onerror="this.onerror=null; this.src='${resolvePath(DEFAULT_NO_PHOTO_IMAGE)}';" />
                       </div>
                     `;
                     }).join('')}
                   </div>`
                : '';
            
            photosHtml = `
              <div class="image-grid">
                ${beforePhotos.length > 0 ? `
                  <div class="image-category before-category">
                    <h4 class="image-category-title">作業前（Before）</h4>
                    ${beforePhotosHtml}
                  </div>
                ` : ''}
                ${afterPhotos.length > 0 ? `
                  <div class="image-category after-category">
                    <h4 class="image-category-title">作業後（After）</h4>
                    ${afterPhotosHtml}
                  </div>
                ` : ''}
              </div>
            `;
        }
        
        return `
          <section class="cleaning-section">
            <div class="item-header">
              <h3 class="item-title">〜 ${escapeHtml(item.item_name || item.item_id)} 〜</h3>
              <div class="item-details">${tagsHtml}</div>
            </div>
            ${photosHtml}
          </section>
        `;
    }).join('');
    
    // セクション（画像、コメント、作業内容）を表示
    const sections = report.sections || [];
    // 画像URLを正規化する関数
    const normalizePhotoUrls = (photos) => {
        if (!photos) return [];
        if (Array.isArray(photos)) {
            return photos.map(photo => {
                if (typeof photo === 'string') {
                    return photo.startsWith('http://') || photo.startsWith('https://') || photo.startsWith('//')
                        ? photo
                        : resolvePath(photo);
                } else if (typeof photo === 'object' && photo !== null) {
                    const url = photo.url || photo.warehouseUrl || photo.imageUrl || photo.blobUrl || '';
                    if (!url) return '';
                    return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')
                        ? url
                        : resolvePath(url);
                }
                return '';
            }).filter(Boolean);
        }
        return [];
    };
    
    const sectionsHtml = sections.map(section => {
        if (section.section_type === 'image') {
            // 画像セクション
            const beforePhotos = normalizePhotoUrls(section.photos?.before);
            const afterPhotos = normalizePhotoUrls(section.photos?.after);
            const completedPhotos = normalizePhotoUrls(section.photos?.completed);
            const imageType = section.image_type || 'work';
            const beforeLabel = imageType === 'work' ? '作業前（Before）' : '設置前（Before）';
            const afterLabel = imageType === 'work' ? '作業後（After）' : '設置後（After）';
            
            if (imageType === 'completed' && completedPhotos.length > 0) {
                // 施工後のみ
                return `
                  <section class="image-section">
                    <div class="section-header">
                      <h4 class="section-title">画像</h4>
                    </div>
                    <div class="image-grid">
                      <div class="image-category completed-category">
                        <h4 class="image-category-title">施工後（After）</h4>
                        <div class="image-list">
                          ${completedPhotos.map((url, index) => {
                              const resolvedUrl = url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')
                                  ? url
                                  : resolvePath(url);
                              return `
                            <div class="image-item" data-image-url="${resolvedUrl}">
                              <img src="${resolvedUrl}" alt="施工後" loading="lazy" 
                                   onerror="this.onerror=null; this.src='${resolvePath(DEFAULT_NO_PHOTO_IMAGE)}';" />
                            </div>
                          `;
                          }).join('')}
                        </div>
                      </div>
                    </div>
                  </section>
                `;
            } else {
                // 作業前・作業後
                const beforePhotosHtml = beforePhotos.length > 0
                    ? `<div class="image-list">
                         ${beforePhotos.map((url, index) => {
                             const resolvedUrl = url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')
                                 ? url
                                 : resolvePath(url);
                             return `
                           <div class="image-item" data-image-url="${resolvedUrl}">
                             <img src="${resolvedUrl}" alt="${beforeLabel}" loading="lazy" 
                                  onerror="this.onerror=null; this.src='${resolvePath(DEFAULT_NO_PHOTO_IMAGE)}';" />
                           </div>
                         `;
                         }).join('')}
                       </div>`
                    : `<div class="image-list">
                         <div class="image-item">
                           <img src="${resolvePath(DEFAULT_NO_PHOTO_IMAGE)}" alt="写真なし" class="default-no-photo-image" />
                         </div>
                       </div>`;
                
                const afterPhotosHtml = afterPhotos.length > 0
                    ? `<div class="image-list">
                         ${afterPhotos.map((url, index) => {
                             const resolvedUrl = url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')
                                 ? url
                                 : resolvePath(url);
                             return `
                           <div class="image-item" data-image-url="${resolvedUrl}">
                             <img src="${resolvedUrl}" alt="${afterLabel}" loading="lazy" 
                                  onerror="this.onerror=null; this.src='${resolvePath(DEFAULT_NO_PHOTO_IMAGE)}';" />
                           </div>
                         `;
                         }).join('')}
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
            }
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
    
    // HTMLを生成
    const html = `
      <div class="report-header" id="preview-report-header">
        <div class="report-header-logo">
          <img src="/images/header-logo.jpg" alt="ミセサポ" onerror="this.style.display='none';">
        </div>
        <div class="report-header-content">
          <div class="report-brand" id="preview-report-brand">${escapeHtml(brandName)}</div>
          <div class="report-date" id="preview-report-date">清掃日時: ${dateStr} ${timeStr}</div>
          <div class="report-store" id="preview-report-store">${escapeHtml(storeName)}</div>
        </div>
      </div>
      
      <div class="items-list-bar">
        <div class="items-list">
          <span class="items-list-label">実施清掃項目</span>
          <div class="items-list-items" id="preview-cleaning-items">
            ${itemNames.map(name => `<span class="items-list-item">${escapeHtml(name)}</span>`).join('')}
          </div>
        </div>
      </div>
      
      <div class="report-main" id="preview-report-main">
        ${workItemsHtml}
        ${sectionsHtml}
      </div>
    `;
    
    container.innerHTML = html;
    
    // 画像クリックイベントを設定
    setupImageModalInContainer(container);
}

// コンテナ内の画像モーダル機能
function setupImageModalInContainer(container) {
    const imageItems = container.querySelectorAll('.image-item');
    
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

// 画像モーダルを開く（グローバルに公開）
window.openImageModal = function(imageSrc) {
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

// タブ切り替え処理
function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const targetTab = this.dataset.tab;
            
            // すべてのタブボタンとコンテンツからactiveクラスを削除
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => {
                c.classList.remove('active');
                c.style.display = 'none';
            });
            
            // クリックされたタブをアクティブにする
            this.classList.add('active');
            const targetContent = document.getElementById(`tab-content-${targetTab}`);
            if (targetContent) {
                targetContent.classList.add('active');
                targetContent.style.display = 'block';
            }
        });
    });
}

// レポート承認の処理
document.addEventListener('DOMContentLoaded', function() {
    // タブ機能を設定
    setupTabs();
    
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


