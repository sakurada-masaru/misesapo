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
            schedules: [],   // Store loaded schedules
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
        }
    }

    // New: Add image directly to a section's category
    addImageToSection(tabName, sectionId, category, imageObj) {
        const section = this.state.sections[tabName][sectionId];
        if (!section) return;

        if (!section.imageContents) section.imageContents = [];
        // Ensure at least one container exists
        if (section.imageContents.length === 0) {
            section.imageContents.push({
                id: `ic-${Date.now()}`,
                imageType: 'before_after',
                photos: { before: [], after: [] }
            });
        }

        const content = section.imageContents[0];
        if (!content.photos) content.photos = { before: [], after: [] };
        if (!content.photos[category]) content.photos[category] = [];

        content.photos[category].push(imageObj);
        this.notify();
    }

    // New: Update image inside a section
    updateSectionImage(tabName, sectionId, category, tempId, updates) {
        const section = this.state.sections[tabName][sectionId];
        if (!section || !section.imageContents) return;

        const content = section.imageContents[0];
        if (!content || !content.photos || !content.photos[category]) return;

        const photos = content.photos[category];
        const index = photos.findIndex(img => img.id === tempId);

        if (index !== -1) {
            photos[index] = { ...photos[index], ...updates };
            this.notify();
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
        this.addImageToSection(targetTab, targetSectionId, targetCategory, imageObj);
    }

    // --- Custom Content Handling ---

    addCustomContent(tabName, sectionId, contentType) {
        const section = this.state.sections[tabName][sectionId];
        if (!section) return;

        if (!section.customContents) section.customContents = [];

        const newContent = {
            id: `cc-${Date.now()}`,
            type: contentType, // 'text' | 'image'
            value: '', // For text
            image: null // For image content { url, blobUrl, status }
        };

        section.customContents.push(newContent);
        this.notify();
    }

    removeCustomContent(tabName, sectionId, contentId) {
        const section = this.state.sections[tabName][sectionId];
        if (!section || !section.customContents) return;

        section.customContents = section.customContents.filter(c => c.id !== contentId);
        this.notify();
    }

    updateCustomContent(tabName, sectionId, contentId, updates) {
        const section = this.state.sections[tabName][sectionId];
        if (!section || !section.customContents) return;

        const index = section.customContents.findIndex(c => c.id === contentId);
        if (index !== -1) {
            section.customContents[index] = { ...section.customContents[index], ...updates };
            this.notify();
        }
    }

    /**
     * Load existing report data into state
     * @param {Object} report 
     */
    loadReport(report) {
        console.log('[ReportStateManager] Loading report data:', report);

        // 1. Meta Data
        this.state.meta = {
            id: report.id || report.report_id,
            brandId: report.brand_id,
            storeId: report.store_id,
            scheduleId: report.schedule_id,
            date: report.cleaning_date || report.work_date,
            startTime: report.cleaning_start_time || report.start_time,
            endTime: report.cleaning_end_time || report.end_time
        };

        // 2. Clear existing sections
        this.state.sections = {
            new: {},
            proposal: {}
        };

        // 3. Load Sections
        // Backend might store sections in 'sections' field
        const sectionsSource = report.sections || {};

        // If it's a proposal mode load, we might want to shift everything to proposal tab?
        // Or if the report itself is a proposal.
        const targetTab = (report.proposal_type === 'proposal' || report.type === 'proposal') ? 'proposal' : 'new';

        if (typeof sectionsSource === 'object') {
            // If sectionsSource has 'new' and 'proposal' keys
            if (sectionsSource.new || sectionsSource.proposal) {
                this.state.sections.new = sectionsSource.new || {};
                this.state.sections.proposal = sectionsSource.proposal || {};
            } else {
                // Otherwise assume it's the sections for the main report
                this.state.sections[targetTab] = sectionsSource;
            }
        }

        // 4. Update UI
        this.notify();
    }
}
