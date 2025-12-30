import { escapeHtml } from '../utils.js';

/**
 * SectionRenderer
 * specific responsibility: Generate HTML string for section data
 */
export class SectionRenderer {
    constructor() { }

    /**
     * Render a single section
     * @param {Object} section 
     */
    render(section) {
        if (section.type === 'cleaning') {
            return this.renderCleaningSection(section);
        } else if (section.type === 'image') {
            return this.renderImageSection(section);
        }
        return '';
    }

    renderCleaningSection(section) {
        const title = section.item_name || '清掃項目';
        return `
            <div class="section-card" data-section-id="${section.id}">
                <div class="section-header">
                    <input type="checkbox" class="section-select-checkbox" data-section-id="${section.id}">
                    <span class="section-title"><i class="fas fa-broom"></i> ${escapeHtml(title)}</span>
                    <div class="section-header-actions">
                        <button type="button" class="section-delete" data-action="delete" data-id="${section.id}" title="削除">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="section-body">
                   <div style="margin-bottom: 12px;">
                       <label style="font-size: 0.85rem; color: #666; display: block; margin-bottom: 4px;">清掃項目名</label>
                       <input type="text" class="form-input" value="${escapeHtml(title)}" readonly style="background: #f9fafb; color: #374151;">
                   </div>

                   <!-- HACCP Fields -->
                   ${window.HaccpManagerInstance ? window.HaccpManagerInstance.renderHaccpFields(section.id, section.item_name, section.haccp_info) : ''}
                   
                   <!-- Dynamic Image Labels -->
                   ${(() => {
                let beforeLabel = '作業前';
                let afterLabel = '作業後';
                // Determine if Pest Control
                if (section.item_name && (section.item_name.includes('駆除') || section.item_name.includes('防除') || section.item_name.includes('捕獲'))) {
                    beforeLabel = '設置箇所・状況';
                    afterLabel = '捕獲・施工後';
                }

                return `
                       <div class="cleaning-item-image-area" style="display:flex; gap:10px; margin-top:10px;">
                            <!-- Before Drop Zone -->
                            <div class="image-list" data-category="before" style="flex:1; border: 2px dashed #ddd; border-radius: 6px; min-height: 120px; padding: 10px; background: #fafafa; position:relative; overflow:hidden; display: flex; flex-direction: column; align-items: center;">
                                <div style="width:100%; display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                                    <div style="font-size:0.8rem; font-weight:bold; color:#555;">${beforeLabel}</div>
                                    <label style="cursor:pointer; background:#3b82f6; color:white; padding:4px 8px; border-radius:4px; font-size:0.75rem; display:flex; align-items:center;">
                                        <i class="fas fa-camera" style="margin-right:4px;"></i> 追加
                                        <input type="file" accept="image/*" capture="environment" style="display:none;" onchange="window.handleSectionImageUpload(this, '${section.id}', 'before')">
                                    </label>
                                </div>
                                <div style="display:flex; flex-wrap:wrap; justify-content:center; gap:8px; width:100%;">
                                    ${this._renderPhotos(section, 'before')}
                                </div>
                            </div>
                            
                            <div style="align-self:center; font-size:1.5rem; color:#ccc;">➡</div>

                            <!--After Drop Zone-- >
                    <div class="image-list" data-category="after" style="flex:1; border: 2px dashed #ddd; border-radius: 6px; min-height: 120px; padding: 10px; background: #fafafa; position:relative; overflow:hidden; display: flex; flex-direction: column; align-items: center;">
                        <div style="width:100%; display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                            <div style="font-size:0.8rem; font-weight:bold; color:#555;">${afterLabel}</div>
                            <label style="cursor:pointer; background:#10b981; color:white; padding:4px 8px; border-radius:4px; font-size:0.75rem; display:flex; align-items:center;">
                                <i class="fas fa-camera" style="margin-right:4px;"></i> 追加
                                <input type="file" accept="image/*" capture="environment" style="display:none;" onchange="window.handleSectionImageUpload(this, '${section.id}', 'after')">
                            </label>
                        </div>
                        <div style="display:flex; flex-wrap:wrap; justify-content:center; gap:8px; width:100%;">
                            ${this._renderPhotos(section, 'after')}
                        </div>
                    </div>
                       </div >

                       < !--Extra Actions: Add Comment / Add additional Image-- >
                       <div style="margin-top: 12px; display: flex; justify-content: flex-end; gap: 8px;">
                            <button type="button" onclick="window.handleAddSectionComment('${section.id}')" style="background: none; border: 1px solid #d1d5db; border-radius: 4px; padding: 4px 8px; font-size: 0.8rem; color: #6b7280; cursor: pointer;">
                                <i class="fas fa-comment-dots"></i> コメント追加
                            </button>
                            <button type="button" onclick="alert('任意画像の追加機能は開発中です（次期アップデート予定）')" style="background: none; border: 1px solid #d1d5db; border-radius: 4px; padding: 4px 8px; font-size: 0.8rem; color: #6b7280; cursor: pointer;">
                                <i class="fas fa-image"></i> 画像追加
                            </button>
                       </div>

                       <!--Comments Area-- >
                    <div id="comments-${section.id}" style="margin-top: 8px;">
                        ${(section.comments || []).map((comment, idx) => `
                               <div style="background: #fdfeba; padding: 6px 10px; border-radius: 4px; margin-bottom: 4px; font-size: 0.9rem; display: flex; align-items: center; justify-content: space-between;">
                                   <span>${escapeHtml(comment)}</span>
                                   <button onclick="window.handleDeleteSectionComment('${section.id}', ${idx})" style="border: none; background: none; color: #aaa; cursor: pointer;">&times;</button>
                               </div>
                           `).join('')}
                    </div>
                `;
            })()}
                </div>
            </div>
        `;
    }

    _renderPhotos(section, category) {
        // Helper to render thumbnails
        if (!section.imageContents || section.imageContents.length === 0) return '';

        // Flattens all photos of that category from all imageContents
        const photos = section.imageContents.flatMap(ic => ic.photos?.[category] || []);

        return photos.map(photo => {
            let statusIcon = '';
            let opacity = '1';

            if (photo.status === 'uploading') {
                statusIcon = '<div style="position:absolute; inset:0; background:rgba(255,255,255,0.7); display:flex; align-items:center; justify-content:center;"><i class="fas fa-spinner fa-spin" style="color:#ec4899;"></i></div>';
            } else if (photo.status === 'error') {
                statusIcon = '<div style="position:absolute; top:2px; right:2px; color:red;"><i class="fas fa-exclamation-circle"></i></div>';
                opacity = '0.7';
            }

            // Prefer blobUrl for immediate display, fall back to url (remote)
            const src = photo.blobUrl || photo.url || '';

            return `
           <div class="image-thumb" style="width:80px; height:80px; display:inline-block; margin:4px; position:relative; opacity:${opacity};">
               <img src="${src}" style="width:100%; height:100%; object-fit:cover; border-radius:4px;">
               ${statusIcon}
           </div>
           `;
        }).join('');
    }

    renderImageSection(section) {
        // ... similar logic for image only section
        return `<div class="section-card">Image Section Placeholder</div>`;
    }
}
