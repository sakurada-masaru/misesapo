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
        // Default layout mode is 'compare'
        const layoutMode = section.layoutMode || 'compare';

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
                   
                   <!-- Dynamic Image Labels & Layout Switcher -->
                   ${(() => {
                let beforeLabel = '作業前';
                let afterLabel = '作業後';
                // Determine if Pest Control
                if (section.item_name && (section.item_name.includes('駆除') || section.item_name.includes('防除') || section.item_name.includes('捕獲'))) {
                    beforeLabel = '設置箇所・状況';
                    afterLabel = '捕獲・施工後';
                }

                const pinkColor = '#ec4899'; // Pink accent

                const switchButtons = `
                    <div style="display: flex; gap: 4px; border: 1px solid #ddd; border-radius: 4px; padding: 2px; background: #fff;">
                        <button type="button" onclick="window.handleSectionLayoutModeChange('${section.id}', 'compare')" 
                            style="border: none; background: ${layoutMode === 'compare' ? pinkColor : 'transparent'}; color: ${layoutMode === 'compare' ? 'white' : '#666'}; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 0.8rem;" title="作業前・作業後">
                            <i class="fas fa-columns"></i>
                        </button>
                        <button type="button" onclick="window.handleSectionLayoutModeChange('${section.id}', 'single')" 
                            style="border: none; background: ${layoutMode === 'single' ? pinkColor : 'transparent'}; color: ${layoutMode === 'single' ? 'white' : '#666'}; padding: 4px 8px; border-radius: 3px; cursor: pointer; font-size: 0.8rem;" title="施工後のみ">
                            <i class="fas fa-image"></i>
                        </button>
                    </div>
                `;

                let contentHtml = '';

                if (layoutMode === 'compare') {
                    // Pattern 1: Compare (Before -> After)
                    contentHtml = `
                       <div class="cleaning-item-image-area" style="display:flex; gap:10px; margin-top:10px;">
                            <!-- Before Drop Zone -->
                            <div class="image-list" data-category="before" style="flex:1; border: 2px dashed #ddd; border-radius: 6px; min-height: 180px; padding: 10px; background: #fafafa; position:relative; overflow:hidden; display: flex; flex-direction: column; align-items: center;">
                                <div style="width:100%; display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                                    <div style="font-size:0.8rem; font-weight:bold; color:${pinkColor};">${beforeLabel}</div>
                                    <label style="cursor:pointer; background:${pinkColor}; color:white; padding:4px 8px; border-radius:4px; font-size:0.75rem; display:flex; align-items:center;">
                                        <i class="fas fa-camera" style="margin-right:4px;"></i> 追加
                                        <input type="file" accept="image/*" capture="environment" style="display:none;" onchange="window.handleSectionImageUpload(this, '${section.id}', 'before')">
                                    </label>
                                </div>
                                <div style="display:flex; flex-wrap:wrap; justify-content:center; gap:8px; width:100%;">
                                    ${this._renderPhotos(section, 'before')}
                                </div>
                            </div>
                            
                            <div style="align-self:center; font-size:1.5rem; color:#ccc;">➡</div>

                            <!-- After Drop Zone -->
                            <div class="image-list" data-category="after" style="flex:1; border: 2px dashed #ddd; border-radius: 6px; min-height: 180px; padding: 10px; background: #fafafa; position:relative; overflow:hidden; display: flex; flex-direction: column; align-items: center;">
                                <div style="width:100%; display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                                    <div style="font-size:0.8rem; font-weight:bold; color:${pinkColor};">${afterLabel}</div>
                                    <label style="cursor:pointer; background:${pinkColor}; color:white; padding:4px 8px; border-radius:4px; font-size:0.75rem; display:flex; align-items:center;">
                                        <i class="fas fa-camera" style="margin-right:4px;"></i> 追加
                                        <input type="file" accept="image/*" capture="environment" style="display:none;" onchange="window.handleSectionImageUpload(this, '${section.id}', 'after')">
                                    </label>
                                </div>
                                <div style="display:flex; flex-wrap:wrap; justify-content:center; gap:8px; width:100%;">
                                    ${this._renderPhotos(section, 'after')}
                                </div>
                            </div>
                        </div>
                    `;
                } else {
                    // Pattern 2: Single (After/Construction only)
                    contentHtml = `
                       <div class="cleaning-item-image-area" style="margin-top:10px;">
                            <!-- After Drop Zone Only (Full Width) -->
                            <div class="image-list" data-category="after" style="width:100%; border: 2px dashed #ddd; border-radius: 6px; min-height: 150px; padding: 15px; background: #fafafa; position:relative; overflow:hidden; display: flex; flex-direction: column; align-items: center;">
                                <div style="width:100%; display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                                    <div style="font-size:0.9rem; font-weight:bold; color:${pinkColor};">施工後</div>
                                    <label style="cursor:pointer; background:${pinkColor}; color:white; padding:6px 12px; border-radius:4px; font-size:0.85rem; display:flex; align-items:center;">
                                        <i class="fas fa-camera" style="margin-right:6px;"></i> 写真を追加
                                        <input type="file" accept="image/*" capture="environment" style="display:none;" onchange="window.handleSectionImageUpload(this, '${section.id}', 'after')">
                                    </label>
                                </div>
                                <div style="display:flex; flex-wrap:wrap; justify-content:center; gap:10px; width:100%;">
                                    ${this._renderPhotos(section, 'after')}
                                </div>
                            </div>
                        </div>
                    `;
                }

                return `
                        <div style="display:flex; justify-content:flex-end; margin-bottom:0px;">
                            ${switchButtons}
                        </div>
                        ${contentHtml}
                        
                        <!-- Custom Contents Area -->
                        <div id="custom-contents-${section.id}" style="margin-top: 12px;">
                            ${(section.customContents || []).map(content => {
                    if (content.type === 'text') {
                        return `
                                        <div class="custom-content-block" style="background:#f9fafb; padding:10px; border-radius:6px; margin-bottom:8px; border:1px solid #e5e7eb; position:relative;">
                                            <button onclick="window.handleRemoveCustomContent('${section.id}', '${content.id}')" style="position:absolute; top:4px; right:4px; border:none; background:none; color:#9ca3af; cursor:pointer;">&times;</button>
                                            <label style="font-size:0.75rem; color:${pinkColor}; display:block; margin-bottom:4px;">コメント・特記事項</label>
                                            <textarea class="form-input" style="width:100%; min-height:60px; font-size:0.9rem;"
                                                onchange="window.handleUpdateCustomContent('${section.id}', '${content.id}', { value: this.value })">${escapeHtml(content.value || '')}</textarea>
                                        </div>
                                    `;
                    } else if (content.type === 'image') {
                        const src = content.image ? (content.image.blobUrl || content.image.url) : '';
                        const isUploading = content.image && content.image.status === 'uploading';

                        return `
                                        <div class="custom-content-block" style="background:#f9fafb; padding:10px; border-radius:6px; margin-bottom:8px; border:1px solid #e5e7eb; position:relative;">
                                            <button onclick="window.handleRemoveCustomContent('${section.id}', '${content.id}')" style="position:absolute; top:4px; right:4px; border:none; background:none; color:#9ca3af; cursor:pointer;">&times;</button>
                                            <label style="font-size:0.75rem; color:${pinkColor}; display:block; margin-bottom:4px;">追加画像</label>
                                            
                                            ${!src ? `
                                                <label style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100px; border:2px dashed #d1d5db; border-radius:6px; cursor:pointer; background:white;">
                                                    <i class="fas fa-camera" style="color:#9ca3af; font-size:1.5rem; margin-bottom:4px;"></i>
                                                    <span style="font-size:0.8rem; color:#6b7280;">画像を撮影/選択</span>
                                                    <input type="file" accept="image/*" capture="environment" style="display:none;" onchange="window.handleCustomImageUpload(this, '${section.id}', '${content.id}')">
                                                </label>
                                            ` : `
                                                <div style="position:relative; width:100%; height:200px; background:black; display:flex; justify-content:center; align-items:center; border-radius:6px; overflow:hidden;">
                                                    <img src="${src}" style="max-width:100%; max-height:100%; object-fit:contain;">
                                                    ${isUploading ? '<div style="position:absolute; inset:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; color:white;"><i class="fas fa-spinner fa-spin"></i></div>' : ''}
                                                </div>
                                            `}
                                            
                                            <input type="text" placeholder="画像の説明（任意）" value="${escapeHtml(content.value || '')}"
                                                style="width:100%; margin-top:8px; padding:6px; border:1px solid #d1d5db; border-radius:4px; font-size:0.85rem;"
                                                onchange="window.handleUpdateCustomContent('${section.id}', '${content.id}', { value: this.value })">
                                        </div>
                                    `;
                    }
                    return '';
                }).join('')}
                        </div>

                        <!-- Extra Actions: Add Content -->
                        <div style="margin-top: 12px; display: flex; justify-content: flex-end; gap: 8px;">
                            <button type="button" onclick="window.handleAddCustomContent('${section.id}', 'text')" style="background: white; border: 1px solid ${pinkColor}; border-radius: 4px; padding: 6px 12px; font-size: 0.8rem; color: ${pinkColor}; cursor: pointer; display:flex; align-items:center;">
                                <i class="fas fa-comment-dots" style="margin-right:4px;"></i> コメント追加
                            </button>
                            <button type="button" onclick="window.handleAddCustomContent('${section.id}', 'image')" style="background: ${pinkColor}; border: 1px solid ${pinkColor}; border-radius: 4px; padding: 6px 12px; font-size: 0.8rem; color: white; cursor: pointer; display:flex; align-items:center;">
                                <i class="fas fa-camera" style="margin-right:4px;"></i> 画像追加
                            </button>
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
           <div class="image-thumb" style="width:220px; height:220px; display:inline-block; margin:4px; position:relative; opacity:${opacity};">
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
