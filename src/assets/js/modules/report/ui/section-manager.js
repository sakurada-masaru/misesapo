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
                // For now, just add a dummy section for testing
                this.state.addSection('new', { type: 'cleaning', item_name: 'テスト清掃項目' });
            });
        }

        // Proposal tab button
        const addPropBtn = document.getElementById('section-add-toggle-btn-proposal');
        if (addPropBtn) {
            addPropBtn.addEventListener('click', () => {
                this.state.addSection('proposal', { type: 'cleaning', item_name: '提案用項目' });
            });
        }
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
