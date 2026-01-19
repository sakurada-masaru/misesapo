
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
        this.currentScheduleId = null;

        // Note: restore() must now be called explicitly with scheduleId from index.js
        // so we removed the automatic call from here.

        // Subscribe to state changes for auto-save
        this.state.subscribe(() => {
            this.scheduleSave();
        });
    }

    setScheduleId(id) {
        this.currentScheduleId = id;
    }

    scheduleSave() {
        if (this.timeout) clearTimeout(this.timeout);
        this.timeout = setTimeout(() => {
            this.save();
        }, this.SAVE_DELAY);
    }

    save() {
        if (!this.currentScheduleId) return; // Don't save if no context

        try {
            // Helper to sanitize image data types
            const sanitizeImages = (sections) => {
                const sanitized = JSON.parse(JSON.stringify(sections)); // Deep copy first

                Object.keys(sanitized).forEach(tab => {
                    Object.keys(sanitized[tab]).forEach(sectionId => {
                        const section = sanitized[tab][sectionId];

                        // Sanitize standard imageContents
                        if (section.imageContents) {
                            section.imageContents = section.imageContents.filter(img =>
                                img.url && !img.url.startsWith('blob:') && img.status === 'uploaded'
                            );
                        }

                        // Sanitize customContents (images)
                        if (section.customContents) {
                            section.customContents.forEach(content => {
                                if (content.type === 'image' && content.image) {
                                    // If image is blob or uploading, remove the image data but keep the block? 
                                    // Or remove the block entirely? Let's clear the image property if invalid.
                                    if (!content.image.url || content.image.url.startsWith('blob:')) {
                                        content.image = null; // Clear invalid image
                                    }
                                }
                            });
                        }
                    });
                });
                return sanitized;
            };

            const dataToSave = {
                scheduleId: this.currentScheduleId, // SAVE THE ID
                sections: sanitizeImages(this.state.state.sections),
                activeTab: this.state.state.activeTab,
                meta: {
                    timestamp: Date.now()
                }
            };

            // Also save global image stock (uploaded only, no blobs)
            if (this.state.state.imageStock.length > 0) {
                // Warning: quota limits. Storing Base64 in local storage is risky.
                // Should only store metadata if images are uploaded.
                // For MVP/V2 prototype, we limit stock save or only save uploaded ones?
                // Let's safe-guard by not deep saving 'file' objects (which can't be JSON'd anyway)
                // and keeping blobUrls is pointless across reload (they revoke).

                // We only save 'uploaded' images with remote URLs.
                dataToSave.imageStock = this.state.state.imageStock
                    .filter(img => img.status === 'uploaded' && img.url && !img.url.startsWith('blob:'))
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

    restore(currentScheduleId) {
        this.currentScheduleId = currentScheduleId; // Set context

        try {
            const json = localStorage.getItem(this.STORAGE_KEY);
            if (!json) return false;

            const data = JSON.parse(json);

            // CRITICAL: Check if the saved draft belongs to the current schedule
            if (data.scheduleId !== currentScheduleId) {
                console.log('[AutoSave] Draft belongs to different schedule. Discarding.', { saved: data.scheduleId, current: currentScheduleId });
                this.clear(); // Clear mismatching data
                return false; // Did not restore
            }

            console.log('[AutoSave] Found valid draft for this schedule:', data);

            // Restore logic
            if (data.activeTab) {
                this.state.state.activeTab = data.activeTab;
            }

            if (data.sections) {
                // Deep merge or replace?
                // Replacing is safer for full restore
                this.state.state.sections = data.sections;
            }

            if (data.imageStock) {
                this.state.state.imageStock = data.imageStock;
            }

            this.state.notify();
            return true; // Restored successfully

        } catch (e) {
            console.warn('[AutoSave] Failed to restore draft', e);
            return false;
        }
    }

    clear() {
        localStorage.removeItem(this.STORAGE_KEY);
    }
}
