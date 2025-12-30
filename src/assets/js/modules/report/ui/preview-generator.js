
/**
 * PreviewGenerator
 * specifically handles the generation of the formal printed report.
 */
export class PreviewGenerator {
  constructor() { }

  /**
   * Open the formal report preview
   * @param {Object} reportData 
   */
  openFormalReportPreview(reportData) {
    // Prepare HTML for sections
    const sectionsHtml = this._generateSectionsHtml(reportData.sections);
    const meta = reportData.meta;
    const brandName = meta.brandName || 'ブランド未設定';
    const storeName = meta.storeName || '店舗未設定';
    const date = meta.date ? new Date(meta.date).toLocaleDateString('ja-JP') : new Date().toLocaleDateString('ja-JP');

    const html = `
     <!DOCTYPE html>
     <html lang="ja">
     <head>
       <meta charset="UTF-8">
       <title>作業実施報告書 - ${this._escape(brandName)} ${this._escape(storeName)}</title>
       <link rel="stylesheet" href="/css/staff-report-preview.css?v=${Date.now()}">
       <style>
          /* 印刷時の強制設定 */
          @media print {
             body { -webkit-print-color-adjust: exact; }
          }
       </style>
     </head>
     <body>
       <div class="header">
         <div class="title">作業実施報告書</div>
         <div class="meta">
           <div>報告日: ${new Date().toLocaleDateString('ja-JP')}</div>
           <div>株式会社ミセサポ</div>
         </div>
       </div>
       
       <div class="store-info">
         <div class="store-name">${this._escape(storeName)} 様</div>
         <div>ブランド: ${this._escape(brandName)}</div>
         <div>作業実施日: ${this._escape(date)}</div>
       </div>
       
       <div class="content">
         ${sectionsHtml || '<p>報告内容がありません。</p>'}
       </div>

       <div class="footer">
         <div style="margin-right: 20px; align-self: flex-end;">確認欄:</div>
         <div class="signature-box">
           <div class="signature-title">施設確認印</div>
         </div>
       </div>
       
       <script>
         window.onload = function() { setTimeout(function() { window.print(); }, 1000); };
       </script>
     </body>
     </html>
     `;

    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    } else {
      alert('ポップアップがブロックされました。ブラウザの設定を確認してください。');
    }
  }

  _generateSectionsHtml(sectionsMap) {
    if (!sectionsMap) return '';

    return Object.values(sectionsMap)
      .filter(section => {
        // Determine if valid (has content)
        if (section.type === 'cleaning') {
          const hasItemName = section.item_name && section.item_name.trim() !== '';
          const hasImages = section.imageContents && section.imageContents.length > 0;
          return hasItemName || hasImages;
        }
        return true; // Other types like comments
      })
      .map(section => {
        if (section.type === 'cleaning') {
          return this._renderCleaningSection(section);
        } else if (section.type === 'comment') {
          return `<div class="report-section"><div class="section-comment">${this._escape(section.content)}</div></div>`;
        }
        return '';
      })
      .join('');
  }

  _renderCleaningSection(section) {
    const title = section.item_name || '清掃項目';

    let photosHtml = '';

    // Render Photos
    if (section.imageContents && section.imageContents.length > 0) {
      let photos = { before: [], after: [] };

      section.imageContents.forEach(ic => {
        const type = ic.imageType || 'before_after';
        if (type === 'completed') {
          const completed = (ic.photos?.completed || []).map(p => this._extractUrl(p)).filter(Boolean);
          photos.after = photos.after.concat(completed); // Completed goes to 'after' side visually or separate
        } else {
          const before = (ic.photos?.before || []).map(p => this._extractUrl(p)).filter(Boolean);
          const after = (ic.photos?.after || []).map(p => this._extractUrl(p)).filter(Boolean);
          photos.before = photos.before.concat(before);
          photos.after = photos.after.concat(after);
        }
      });

      // Generate HTML for photo pairs
      const maxRows = Math.max(photos.before.length, photos.after.length);
      for (let i = 0; i < maxRows; i++) {
        const beforeUrl = photos.before[i] || null;
        const afterUrl = photos.after[i] || null;

        photosHtml += `
                    <div class="photo-pair">
                        <div class="photo-box">
                            <div class="photo-label">作業前</div>
                            ${beforeUrl ? `<img src="${beforeUrl}" class="photo-img">` : '<div class="no-photo">写真なし</div>'}
                        </div>
                        <div class="photo-arrow">➡</div>
                        <div class="photo-box">
                            <div class="photo-label">作業後/完了</div>
                            ${afterUrl ? `<img src="${afterUrl}" class="photo-img">` : '<div class="no-photo">写真なし</div>'}
                        </div>
                    </div>
                `;
      }

      if (photosHtml) {
        photosHtml = `<div class="photos-container">${photosHtml}</div>`;
      }
    }

    let textHtml = '';
    if (section.subtitles) {
      section.subtitles.forEach(s => textHtml += `<div class="section-subtitle">■ ${this._escape(s.value)}</div>`);
    }
    if (section.comments) {
      section.comments.forEach(c => textHtml += `<div class="section-comment">${this._escape(c.value)}</div>`);
    }

    return `
         <div class="report-section">
             <div class="section-heading">${this._escape(title)}</div>
             ${textHtml}
             ${photosHtml}
         </div>`;
  }

  _escape(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function (m) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      }[m];
    });
  }
  _extractUrl(photoObj) {
    if (typeof photoObj === 'string') return photoObj;
    if (typeof photoObj === 'object' && photoObj !== null) {
      return photoObj.blobUrl || photoObj.warehouseUrl || photoObj.url || '';
    }
    return '';
  }
}
