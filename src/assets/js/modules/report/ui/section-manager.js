import { SectionRenderer } from './section-renderer.js';

/**
 * SectionManager
 * specific responsibility:
 * 1. Listen to state changes => Re-render section list
 * 2. Listen to "Add Section" buttons
 * 3. Listen to events within sections (Delete, Update)
 */
export class SectionManager {
    /**
     * @param {ReportStateManager} stateManager 
     */
    constructor(stateManager) {
        this.state = stateManager;
        this.renderer = new SectionRenderer();

        // DOM Elements
        this.containerNew = document.getElementById('report-content');
        this.containerProposal = document.getElementById('report-content-proposal');

        // Add Button Listeners (New & Proposal)
        this.initAddButtons();

        // Subscribe to state changes
        this.state.subscribe(() => this.renderAll());
    }

    initAddButtons() {
        const addNewBtn = document.getElementById('section-add-toggle-btn');
        if (addNewBtn) {
            addNewBtn.addEventListener('click', () => {
                this.openServiceSelectionModal('new');
            });
        }

        // Proposal tab button
        const addPropBtn = document.getElementById('section-add-toggle-btn-proposal');
        if (addPropBtn) {
            addPropBtn.addEventListener('click', () => {
                this.openServiceSelectionModal('proposal');
            });
        }
    }

    async openServiceSelectionModal(targetTab) {
        let modal = document.getElementById('service-selection-modal');
        if (!modal) {
            modal = this._createServiceModal();
        }

        const body = modal.querySelector('.modal-body');
        const searchInput = modal.querySelector('.modal-search-input');
        body.innerHTML = '<div style="text-align:center; padding:40px;"><i class="fas fa-spinner fa-spin fa-2x" style="color:#ec4899;"></i><p style="margin-top:12px; color:#6b7280;">読み込み中...</p></div>';
        modal.style.display = 'flex';
        if (searchInput) {
            searchInput.value = '';
            searchInput.focus();
        }

        try {
            const api = window.ApiServiceInstance;
            const services = await api.fetchServiceItems();
            const haccpConfig = window.HaccpManagerInstance ? window.HaccpManagerInstance.HACCP_CONFIG : [];

            // Grouping logic
            const categories = {};
            haccpConfig.forEach(cat => {
                categories[cat.category] = cat.items.map(i => i.name);
            });

            // Add other services from JSON
            const handledNames = new Set(Object.values(categories).flat());
            (services || []).forEach(s => {
                if (!handledNames.has(s.title)) {
                    const cat = s.category || 'その他';
                    if (!categories[cat]) categories[cat] = [];
                    categories[cat].push(s.title);
                }
            });

            const renderItems = (filter = '') => {
                body.innerHTML = '';
                let hasAnyMatch = false;

                Object.entries(categories).forEach(([catName, items]) => {
                    const filteredItems = items.filter(name => name.toLowerCase().includes(filter.toLowerCase()));
                    if (filteredItems.length === 0) return;

                    hasAnyMatch = true;
                    const group = document.createElement('div');
                    group.className = 'service-group';
                    group.style.marginBottom = '24px';
                    group.innerHTML = `<h4 style="font-size:0.9rem; font-weight:bold; color:#ec4899; margin-bottom:12px; border-left:4px solid #ec4899; padding-left:10px; background:#fff1f6;">${catName}</h4>`;

                    const grid = document.createElement('div');
                    grid.style.cssText = 'display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:10px;';

                    filteredItems.forEach(name => {
                        const btn = document.createElement('button');
                        btn.type = 'button';
                        btn.className = 'service-item-btn';
                        btn.textContent = name;
                        btn.style.cssText = 'padding:12px 10px; background:#fff; border:1px solid #e5e7eb; border-radius:10px; cursor:pointer; text-align:center; font-size:0.85rem; color:#374151; transition:all 0.2s; box-shadow:0 1px 2px rgba(0,0,0,0.05);';
                        btn.onmouseover = () => {
                            btn.style.background = '#fce7f3';
                            btn.style.borderColor = '#f9a8d4';
                            btn.style.color = '#be185d';
                            btn.style.transform = 'translateY(-2px)';
                            btn.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.1)';
                        };
                        btn.onmouseout = () => {
                            btn.style.background = '#fff';
                            btn.style.borderColor = '#e5e7eb';
                            btn.style.color = '#374151';
                            btn.style.transform = 'translateY(0)';
                            btn.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                        };
                        btn.onclick = () => {
                            this.state.addSection(targetTab, { type: 'cleaning', item_name: name });
                            modal.style.display = 'none';
                        };
                        grid.appendChild(btn);
                    });
                    group.appendChild(grid);
                    body.appendChild(group);
                });

                if (!hasAnyMatch) {
                    body.innerHTML = '<div style="text-align:center; padding:40px; color:#9ca3af;"><i class="fas fa-search" style="font-size:2rem; margin-bottom:12px; opacity:0.3;"></i><p>一致する項目が見つかりません</p></div>';
                }

                // Free input option as a fallback
                const freeBtn = document.createElement('button');
                freeBtn.innerHTML = '<i class="fas fa-edit" style="margin-right:8px;"></i>自由入力で追加する';
                freeBtn.style.cssText = 'width:100%; padding:14px; background:#f9fafb; border:2px dashed #d1d5db; border-radius:12px; color:#6b7280; font-weight:600; margin-top:16px; cursor:pointer; font-size: 0.95rem; transition:all 0.2s;';
                freeBtn.onmouseover = () => { freeBtn.style.background = '#f3f4f6'; freeBtn.style.borderColor = '#9ca3af'; };
                freeBtn.onmouseout = () => { freeBtn.style.background = '#f9fafb'; freeBtn.style.borderColor = '#d1d5db'; };
                freeBtn.onclick = () => {
                    const name = prompt('項目名を入力してください:', filter);
                    if (name) {
                        this.state.addSection(targetTab, { type: 'cleaning', item_name: name });
                        modal.style.display = 'none';
                    }
                };
                body.appendChild(freeBtn);
            };

            renderItems();

            if (searchInput) {
                searchInput.oninput = (e) => renderItems(e.target.value);
            }

        } catch (e) {
            console.error('[SectionManager] Failed to load services:', e);
            body.innerHTML = '<div style="color:#ef4444; text-align:center; padding:40px;"><i class="fas fa-exclamation-triangle" style="font-size:2rem; margin-bottom:12px;"></i><p>データの読み込みに失敗しました</p></div>';
        }
    }

    _createServiceModal() {
        const modal = document.createElement('div');
        modal.id = 'service-selection-modal';
        modal.className = 'modal-overlay';
        modal.style.cssText = 'display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(15, 23, 42, 0.6); z-index:10000; align-items:center; justify-content:center; backdrop-filter: blur(8px); padding:16px;';

        const content = document.createElement('div');
        content.className = 'modal-content';
        content.style.cssText = 'background:#fff; border-radius:24px; padding:0; max-width:640px; width:100%; max-height:85vh; overflow:hidden; display:flex; flex-direction:column; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); border: 1px solid rgba(255, 255, 255, 0.1);';

        content.innerHTML = `
            <div style="padding:24px 24px 16px; border-bottom:1px solid #f1f5f9; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <h3 style="margin:0; font-size:1.5rem; font-weight:800; color:#1e293b; letter-spacing:-0.025em;">清掃項目を選択</h3>
                    <p style="margin:4px 0 0; font-size:0.875rem; color:#64748b;">実施した清掃メニューを選んでください</p>
                </div>
                <button type="button" class="modal-close-btn" style="background:#f1f5f9; border:none; color:#64748b; cursor:pointer; font-size:1.25rem; width:40px; height:40px; border-radius:12px; display:flex; align-items:center; justify-content:center; transition:all 0.2s;">&times;</button>
            </div>
            <div style="padding:16px 24px; background:#f8fafc; border-bottom:1px solid #f1f5f9;">
                <div style="position:relative;">
                    <i class="fas fa-search" style="position:absolute; left:16px; top:50%; transform:translateY(-50%); color:#94a3b8;"></i>
                    <input type="text" class="modal-search-input" placeholder="項目名で検索..." style="width:100%; padding:12px 16px 12px 44px; border:1px solid #e2e8f0; border-radius:12px; font-size:1rem; outline:none; transition:all 0.2s; box-shadow:inset 0 2px 4px 0 rgba(0,0,0,0.05);">
                </div>
            </div>
            <div class="modal-body" style="padding:24px; overflow-y:auto; flex:1; scroll-behavior:smooth;"></div>
            <div style="padding:20px 24px; border-top:1px solid #f1f5f9; display:flex; justify-content:flex-end; background:#ffffff; gap:12px;">
                <button type="button" class="btn-cancel" style="padding:10px 24px; border-radius:12px; border:1px solid #e2e8f0; background:white; color:#64748b; font-weight:600; cursor:pointer; transition:all 0.2s;">キャンセル</button>
            </div>
        `;

        const closeX = content.querySelector('.modal-close-btn');
        const cancelBtn = content.querySelector('.btn-cancel');
        const searchInput = content.querySelector('.modal-search-input');

        const closeModal = () => {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        };

        closeX.onclick = closeModal;
        cancelBtn.onclick = closeModal;
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };

        // Handle focus border for search input
        searchInput.onfocus = () => { searchInput.style.borderColor = '#ec4899'; searchInput.style.boxShadow = '0 0 0 4px rgba(236, 72, 153, 0.1)'; };
        searchInput.onblur = () => { searchInput.style.borderColor = '#e2e8f0'; searchInput.style.boxShadow = 'inset 0 2px 4px 0 rgba(0,0,0,0.05)'; };

        modal.appendChild(content);
        document.body.appendChild(modal);
        return modal;
    }

    /**
     * Re-render all sections for active tabs
     * (Optimized: In a real app, use VDOM or localized updates. For now, simple innerHTML replace)
     */
    renderAll() {
        const state = this.state.getState();

        // Render New Tab
        this._renderContainer(this.containerNew, state.sections.new);

        // Render Proposal Tab
        this._renderContainer(this.containerProposal, state.sections.proposal);
    }

    _renderContainer(container, sectionsMap) {
        if (!container) return;

        // Sort keys (assuming simple insertion order for now)
        // In real app, sections should have an order index
        const html = Object.keys(sectionsMap).map(id => {
            return this.renderer.render(sectionsMap[id]);
        }).join('');

        // Be careful not to wipe out the "Add Icons Area" which might be inside
        // But in our HTML, the 'report-content' container only has sections and the "Add Icons Area" is separate?
        // Let's check new_v2.html again.

        // In new.html:
        // <div class="report-content" id="report-content">
        //   <!-- セクションが動的に追加される -->
        //   <!-- セクション追加アイコンエリア -->
        //   <div class="section-add-icons-area" id="section-add-icons-area">...</div>
        // </div>

        // So we strictly want to insert sections BEFORE the add-icons-area.
        // Or we clear everything except the last child?

        // Better approach:
        // Clear all .section-card elements
        // Insert new HTML before the add-icons-area

        const existingCards = container.querySelectorAll('.section-card');
        existingCards.forEach(el => el.remove());

        const addArea = container.querySelector('.section-add-icons-area');
        if (addArea) {
            addArea.insertAdjacentHTML('beforebegin', html);
        } else {
            container.innerHTML = html; // Fallback
        }

        // Re-attach event listeners for delete buttons, etc.
        this.attachSectionListeners(container);
    }

    attachSectionListeners(container) {
        const deleteBtns = container.querySelectorAll('.section-delete');
        deleteBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                // Determine tab based on container
                const tab = container.id === 'report-content' ? 'new' : 'proposal';

                if (confirm('削除しますか？')) {
                    this.state.removeSection(tab, id);
                }
            });
        });
    }
}
