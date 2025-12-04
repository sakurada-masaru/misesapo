// APIエンドポイント（将来的に実装）
const API_BASE_URL = 'https://2z0ui5xfxb.execute-api.ap-northeast-1.amazonaws.com/prod';

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
        loadingEl.style.display = 'none';
        errorEl.style.display = 'block';
        errorEl.textContent = 'レポートIDが取得できませんでした';
        return;
    }

    try {
        loadingEl.style.display = 'block';
        contentEl.style.display = 'none';
        errorEl.style.display = 'none';
        
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
        
        loadingEl.style.display = 'none';
        contentEl.style.display = 'block';
    } catch (error) {
        console.error('Error loading report:', error);
        loadingEl.style.display = 'none';
        errorEl.style.display = 'block';
        errorEl.textContent = `エラー: ${error.message}`;
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
    const dateStr = formatDate(report.cleaning_date);
    const timeStr = report.cleaning_start_time && report.cleaning_end_time 
        ? `${report.cleaning_start_time} - ${report.cleaning_end_time}`
        : '';
    document.getElementById('report-date').textContent = `清掃日時: ${dateStr} ${timeStr}`;
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
              <h3 class="item-title">${escapeHtml(item.item_name || item.item_id)}</h3>
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
                     ${beforePhotos.map(url => `
                       <div class="image-item">
                         <img src="${url}" alt="${beforeLabel}" loading="lazy" 
                              onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect fill=%22%23ddd%22 width=%22100%22 height=%22100%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22%3E画像エラー%3C/text%3E%3C/svg%3E';" />
                       </div>
                     `).join('')}
                   </div>`
                : '<p class="no-photo">写真なし</p>';
            
            const afterPhotosHtml = afterPhotos.length > 0
                ? `<div class="image-list">
                     ${afterPhotos.map(url => `
                       <div class="image-item">
                         <img src="${url}" alt="${afterLabel}" loading="lazy" 
                              onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect fill=%22%23ddd%22 width=%22100%22 height=%22100%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23999%22%3E画像エラー%3C/text%3E%3C/svg%3E';" />
                       </div>
                     `).join('')}
                   </div>`
                : '<p class="no-photo">写真なし</p>';
            
            return `
              <section class="image-section">
                <div class="section-header">
                  <h4 class="section-title">📷 画像</h4>
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
                  <h4 class="section-title">💬 コメント</h4>
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
                  <h4 class="section-title">📋 作業内容</h4>
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
}

// 満足度評価の処理
document.addEventListener('DOMContentLoaded', function() {
    loadReportDetail();
    
    // 満足度評価の星
    const wrap = document.getElementById('satisfaction-wrap');
    const thanks = document.getElementById('satisfaction-thanks');
    if (wrap) {
        const stars = Array.from(wrap.querySelectorAll('.star'));
        let rating = 0;
        function render() {
            stars.forEach((s, i) => {
                const filled = (i + 1) <= rating;
                s.classList.toggle('filled', filled);
                s.setAttribute('aria-checked', String(filled && (i + 1) === rating));
            });
        }
        stars.forEach((s) => {
            s.addEventListener('click', () => { rating = Number(s.dataset.value || '0'); render(); });
            s.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); rating = Number(s.dataset.value || '0'); render(); }
                if (e.key === 'ArrowRight') { e.preventDefault(); rating = Math.min(5, rating + 1) || 1; render(); }
                if (e.key === 'ArrowLeft') { e.preventDefault(); rating = Math.max(1, rating - 1) || 1; render(); }
            });
        });
        const btn = document.getElementById('satisfaction-submit');
        if (btn) btn.addEventListener('click', () => {
            const reportId = getReportIdFromUrl();
            const comment = document.getElementById('storeComment').value.trim();
            
            // TODO: 実際のAPI呼び出しに置き換え
            // 現在はローカルストレージに保存
            const feedbackData = {
                report_id: reportId,
                rating: rating,
                comment: comment,
                submitted_at: new Date().toISOString()
            };
            localStorage.setItem(`report_feedback_${reportId}`, JSON.stringify(feedbackData));
            
            wrap.style.display = 'none';
            if (thanks) thanks.style.display = 'block';
        });
    }
});


