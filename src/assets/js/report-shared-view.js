// APIエンドポイント（将来的に実装）
const API_BASE_URL = 'https://2z0ui5xfxb.execute-api.ap-northeast-1.amazonaws.com/prod';

// URLからレポートIDを取得
function getReportIdFromUrl() {
    const path = window.location.pathname;
    // /reports/shared/{id}/view の形式からIDを取得
    const match = path.match(/\/reports\/shared\/([^\/]+)\/view/);
    return match ? match[1] : null;
}

// 日付フォーマット（YYYY年MM月DD日形式）
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}年${month}月${day}日`;
}

// 時刻フォーマット（HH:MM形式）
function formatTime(timeString) {
    if (!timeString) return '';
    // HH:MM形式の場合はそのまま返す
    if (timeString.match(/^\d{2}:\d{2}$/)) {
        return timeString;
    }
    return timeString;
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

// レポートを表示
function renderReport(report) {
    // ヘッダー部分
    const dateStr = formatDate(report.cleaning_date);
    const startTime = formatTime(report.cleaning_start_time);
    const endTime = formatTime(report.cleaning_end_time);
    const timeStr = startTime && endTime ? ` ${startTime}-${endTime}` : '';
    
    // タイトルに日付を追加
    document.getElementById('report-title').textContent = `作業報告書 - ${dateStr}`;
    
    // 作業日時
    document.getElementById('report-date').textContent = `${dateStr}${timeStr}`;
    
    // 作業場所
    document.getElementById('report-store').textContent = report.store_name || '店舗名不明';
    
    // 業者名・担当名
    const staffName = report.staff_name || '担当者名不明';
    const companyName = 'ミセサポ';
    document.getElementById('report-staff').textContent = `${companyName} / 担当：${staffName}`;
    
    // 清掃項目リスト
    const cleaningItemsEl = document.getElementById('cleaning-items');
    const items = report.work_items || [];
    const itemNames = items.map(item => item.item_name || item.item_id).filter(Boolean);
    cleaningItemsEl.innerHTML = itemNames.map(name => 
        `<span class="items-list-item">${name}</span>`
    ).join('');
    
    // 清掃項目の詳細
    const reportMainEl = document.getElementById('report-main');
    reportMainEl.innerHTML = items.map(item => {
        // 写真の表示（複数ある場合は連続表示）
        const beforePhotos = item.photos?.before || [];
        const afterPhotos = item.photos?.after || [];
        
        // 作業前写真（複数ある場合は連続表示）
        const beforePhotosHtml = beforePhotos.length > 0
            ? `<div class="photos-section">
                 <div class="photos-label">作業前:</div>
                 <div class="photos-grid">
                   ${beforePhotos.map(url => `
                     <div class="photo-item">
                       <img src="${url}" alt="作業前" loading="lazy" />
                     </div>
                   `).join('')}
                 </div>
               </div>`
            : '';
        
        // 作業後写真（複数ある場合は連続表示）
        const afterPhotosHtml = afterPhotos.length > 0
            ? `<div class="photos-section">
                 <div class="photos-label">作業後:</div>
                 <div class="photos-grid">
                   ${afterPhotos.map(url => `
                     <div class="photo-item">
                       <img src="${url}" alt="作業後" loading="lazy" />
                     </div>
                   `).join('')}
                 </div>
               </div>`
            : '';
        
        // コメント（work_memoまたはwork_content）
        const comment = item.work_memo || item.work_content || '';
        const commentHtml = comment
            ? `<div class="comment-section">
                 <div class="comment-label">コメント</div>
                 <div class="comment-text">${comment}</div>
               </div>`
            : '';
        
        return `
          <section class="work-item-section">
            <h2 class="work-item-title">${item.item_name || item.item_id}</h2>
            ${beforePhotosHtml}
            ${afterPhotosHtml}
            ${commentHtml}
          </section>
        `;
    }).join('');
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


