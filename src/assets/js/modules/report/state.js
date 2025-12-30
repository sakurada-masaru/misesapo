/**
 * ReportStateManager
 * Manages the application state for the report creation page.
 * Acts as the Single Source of Truth.
 */
export class ReportStateManager {
    constructor() {
        this.state = {
            activeTab: 'new', // 'new' | 'proposal'
            sections: {
                new: {},
                proposal: {}
            },
            imageStock: [], // Array of image objects
            meta: {
                brandId: null,
                storeId: null,
                scheduleId: null,
                date: null,
                startTime: null,
                endTime: null
            }
        };

        this.listeners = [];
        console.log('[ReportStateManager] Initialized');
    }

    /**
     * Get the current state
     */
    getState() {
        return this.state;
    }

    /**
     * Get sections for the current active tab
     */
    getCurrentSections() {
        return this.state.sections[this.state.activeTab];
    }

    /**
     * Set the active tab
     * @param {string} tabName 'new' or 'proposal'
     */
    setActiveTab(tabName) {
        if (['new', 'proposal'].includes(tabName)) {
            this.state.activeTab = tabName;
            this.notify();
        }
    }

    /**
     * Add a listener for state changes
     * @param {Function} callback 
     */
    subscribe(callback) {
        this.listeners.push(callback);
    }

    /**
     * Notify all listeners of state changes
     */
    notify() {
        this.listeners.forEach(cb => cb(this.state));
    }

    /**
     * Add a new section
     * @param {string} tabName 'new' or 'proposal'
     * @param {Object} sectionData 
     * @returns {string} The new section ID
     */
    addSection(tabName, sectionData) {
        if (!['new', 'proposal'].includes(tabName)) return console.error('Invalid tab');

        // Generate ID if not present
        const sectionId = sectionData.id || `section-${Date.now()}`;

        // Add to state
        this.state.sections[tabName][sectionId] = {
            ...sectionData,
            id: sectionId
        };

        this.notify();
        return sectionId;
    }

    /**
     * Remove a section
     * @param {string} tabName 
     * @param {string} sectionId 
     */
    removeSection(tabName, sectionId) {
        if (this.state.sections[tabName] && this.state.sections[tabName][sectionId]) {
            delete this.state.sections[tabName][sectionId];
            this.notify();
        }
    }

    /**
     * Update a section
     * @param {string} tabName 
     * @param {string} sectionId 
     * @param {Object} updates 
     */
    updateSection(tabName, sectionId, updates) {
        if (this.state.sections[tabName] && this.state.sections[tabName][sectionId]) {
            this.state.sections[tabName][sectionId] = {
                ...this.state.sections[tabName][sectionId],
                ...updates
            };
            this.notify();
        }
    }

    // --- Image Handling ---

    addImageToStock(imageObj) {
        this.state.imageStock.push(imageObj);
        this.notify();
    }

    updateImageStatus(imageId, updates) {
        const index = this.state.imageStock.findIndex(img => img.id === imageId);
        if (index !== -1) {
            this.state.imageStock[index] = { ...this.state.imageStock[index], ...updates };
            this.notify();
        } else {
            // Also search in sections? For now, we only upload from stock upon addition.
            // If we implement drop-to-upload directly, we'd need to search sections too.
        }
    }

    moveImageToSection(imageId, targetSectionId, targetCategory) {
        // 1. Find the image (in stock or another section)
        // For MVP: assume it's in stock
        const stockIndex = this.state.imageStock.findIndex(img => img.id === imageId);
        let imageObj = null;

        if (stockIndex !== -1) {
            imageObj = this.state.imageStock[stockIndex];
            // Remove from stock
            this.state.imageStock.splice(stockIndex, 1);
        } else {
            console.warn('Image not found in stock (Section->Section move not implemented yet)');
            return;
        }

        // 2. Add to target section
        const targetTab = this.state.activeTab;
        const section = this.state.sections[targetTab][targetSectionId];

        if (section) {
            // Ensure imageContents structure exists
            if (!section.imageContents) section.imageContents = [];

            // Find or create correct imageContent group
            // Simplified: Just use the first one or create new
            let targetContent = section.imageContents[0];
            if (!targetContent) {
                targetContent = { id: `ic-${Date.now()}`, imageType: 'before_after', photos: { before: [], after: [] } };
                section.imageContents.push(targetContent);
            }

            // Ensure photo arrays exist
            if (!targetContent.photos[targetCategory]) targetContent.photos[targetCategory] = [];

            targetContent.photos[targetCategory].push(imageObj);

            this.notify();
        }
    }
}
