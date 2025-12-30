
/**
 * AutoSaveManager
 * Handles auto-saving of state to localStorage and restoration.
 */
export class AutoSaveManager {
    constructor(stateManager) {
        this.state = stateManager;
        this.STORAGE_KEY = 'report_draft_v2';
        this.SAVE_DELAY = 2000; // 2 seconds
        this.timeout = null;

        // Initialize: Try to restore
        this.restore();

        // Subscribe to state changes for auto-save
        this.state.subscribe(() => {
            this.scheduleSave();
        });
    }

    scheduleSave() {
        if (this.timeout) clearTimeout(this.timeout);
        this.timeout = setTimeout(() => {
            this.save();
        }, this.SAVE_DELAY);
    }

    save() {
        try {
            const dataToSave = {
                sections: this.state.state.sections,
                activeTab: this.state.state.activeTab,
                meta: {
                    // Save input values that aren't in state (if any)
                    // Ideally state should hold everything, but for now we look at DOM for inputs
                    // Or just rely on what's in 'sections' and minimal global state
                    timestamp: Date.now()
                }
            };

            // Also save global image stock
            if (this.state.state.imageStock.length > 0) {
                // Warning: quota limits. Storing Base64 in local storage is risky.
                // Should only store metadata if images are uploaded.
                // For MVP/V2 prototype, we limit stock save or only save uploaded ones?
                // Let's safe-guard by not deep saving 'file' objects (which can't be JSON'd anyway)
                // and keeping blobUrls is pointless across reload (they revoke).

                // We only save 'uploaded' images with remote URLs.
                dataToSave.imageStock = this.state.state.imageStock
                    .filter(img => img.status === 'uploaded')
                    .map(img => ({
                        id: img.id,
                        url: img.url,
                        status: 'uploaded',
                        type: 'stock'
                    }));
            }

            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(dataToSave));
            console.log('[AutoSave] Saved draft.');
        } catch (e) {
            console.warn('[AutoSave] Failed to save draft', e);
        }
    }

    restore() {
        try {
            const json = localStorage.getItem(this.STORAGE_KEY);
            if (!json) return;

            const data = JSON.parse(json);
            console.log('[AutoSave] Found draft:', data);

            // Restore logic
            if (data.activeTab) {
                // this.state.setActiveTab(data.activeTab); // Need this method exposed?
            }

            if (data.sections) {
                // Deep merge or replace?
                // Replacing is safer for full restore
                this.state.state.sections = data.sections;
                this.state.notify();
            }

            if (data.imageStock) {
                this.state.state.imageStock = data.imageStock;
                // Don't notify again immediately if not needed, but good to show stock
                this.state.notify();
            }

        } catch (e) {
            console.warn('[AutoSave] Failed to restore draft', e);
        }
    }

    clear() {
        localStorage.removeItem(this.STORAGE_KEY);
    }
}
