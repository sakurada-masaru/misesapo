/**
 * TabManager
 * Handles switching between 'New Report' and 'Proposal' tabs.
 */
export class TabManager {
    /**
     * @param {ReportStateManager} stateManager 
     */
    constructor(stateManager) {
        this.stateManager = stateManager;
        this.tabs = document.querySelectorAll('.tab-btn');
        this.contents = document.querySelectorAll('.tab-content');
        this.sharedHeader = document.getElementById('shared-report-header');

        this.init();
    }

    init() {
        this.tabs.forEach(btn => {
            btn.addEventListener('click', (e) => this.handleTabClick(e));
        });
    }

    handleTabClick(e) {
        // Find the button (handle clicks on icons inside button)
        const btn = e.target.closest('.tab-btn');
        if (!btn) return;

        const targetTab = btn.dataset.tab; // 'new' or 'proposal'

        // Update State
        this.stateManager.setActiveTab(targetTab);

        // Update UI
        this.updateUi(targetTab);
    }

    updateUi(activeTab) {
        // Toggle Buttons
        this.tabs.forEach(btn => {
            if (btn.dataset.tab === activeTab) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Toggle Content
        this.contents.forEach(content => {
            // Content ID format: 'tab-content-new' or 'tab-content-proposal'
            if (content.id === `tab-content-${activeTab}`) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });

        // Header Visibility (Always shown for these two tabs)
        if (this.sharedHeader) {
            this.sharedHeader.style.display = 'block';
        }
    }
}
