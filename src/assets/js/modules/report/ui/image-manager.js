
/**
 * ImageManager
 * Handles image stock, drag and drop, and image operations.
 */
export class ImageManager {
    constructor(stateManager) {
        this.state = stateManager;
        this.dragSrcEl = null;

        // Initial setup
        this.init();
    }

    init() {
        // Setup image stock drag and drop listeners
        this.setupStockListeners();

        // Listen to section rendering to attach droppable zones
        // Since we don't have a direct "afterRender" event yet, we might need a MutationObserver
        // or let the SectionManager call us.
        // For now, let's assume we can attach a global mutation observer for specific classes.
        this.setupDropZonesObserver();
    }

    setupStockListeners() {
        const stockInput = document.getElementById('stock-file-input');
        if (stockInput) {
            stockInput.addEventListener('change', (e) => this.handleStockUpload(e));
        }

        // Setup existing stock items (if any, though initially empty)
        // Also listen for clicks to open file chooser if empty?
    }

    async handleStockUpload(e) {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        console.log('[ImageManager] Uploading stock images:', files.length);

        // Process and Add to state immediately (Optimistic UI)
        const processingPromises = files.map(async (file) => {
            const imageObj = await this._processFile(file);

            // Add to stock immediately with 'uploading' status
            imageObj.status = 'uploading';
            if (this.state.addImageToStock) {
                this.state.addImageToStock(imageObj);
            }

            // Trigger background upload
            this._uploadInBackground(imageObj);
            return imageObj;
        });

        await Promise.all(processingPromises);
        e.target.value = ''; // Reset input
    }

    async _uploadInBackground(imageObj) {
        try {
            // Find API service - ideally injected, but for now we look for it globally or pass in constructor
            // We need to update index.js to pass apiService to ImageManager
            const apiService = window.ApiServiceInstance;

            if (!apiService) {
                console.warn('[ImageManager] Build API service not found, skipping upload');
                return;
            }

            const result = await apiService.uploadImage(imageObj.file, 'stock');

            // Update state with remote URL and status
            // We need a method in StateManager to update a specific image in stock
            // For now, let's implement a direct update helper or assume updateImageInStock exists
            console.log('[ImageManager] Upload complete:', result);

            if (this.state.updateImageStatus) {
                this.state.updateImageStatus(imageObj.id, {
                    status: 'uploaded',
                    url: result.url,
                    item_id: result.id // Remote ID
                });
            }

        } catch (error) {
            console.error('[ImageManager] Upload failed:', error);
            if (this.state.updateImageStatus) {
                this.state.updateImageStatus(imageObj.id, {
                    status: 'error',
                    error: error.message
                });
            }
        }
    }

    async _processFile(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                resolve({
                    id: 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                    blobUrl: e.target.result, // Data URL for immediate preview
                    file: file,
                    fileName: file.name,
                    type: 'stock',
                    status: 'pending' // pending, uploading, uploaded, error
                });
            };
            reader.readAsDataURL(file);
        });
    }

    // --- Drag and Drop Logic ---

    setupDropZonesObserver() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    // Check if new drop zones were added
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) { // Element
                            // Logic to find .image-list or similar drop zones inside the node
                            const dropZones = node.querySelectorAll('.image-list, .cleaning-item-image-area');
                            dropZones.forEach(zone => this.attachDropHandlers(zone));

                            // Also if the node itself is a drop zone
                            if (node.matches('.image-list, .cleaning-item-image-area')) {
                                this.attachDropHandlers(node);
                            }
                        }
                    });
                }
            });
        });

        const config = { childList: true, subtree: true };
        const target = document.getElementById('report-content');
        if (target) observer.observe(target, config);

        const targetProp = document.getElementById('report-content-proposal');
        if (targetProp) observer.observe(targetProp, config);
    }

    attachDropHandlers(element) {
        // Prevent multiple attachments
        if (element.dataset.dndAttached) return;
        element.dataset.dndAttached = 'true';

        element.addEventListener('dragover', (e) => this.handleDragOver(e));
        element.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        element.addEventListener('drop', (e) => this.handleDrop(e));
    }

    handleDragOver(e) {
        if (e.preventDefault) e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        e.currentTarget.classList.add('drag-over');
        return false;
    }

    handleDragLeave(e) {
        e.currentTarget.classList.remove('drag-over');
    }

    handleDrop(e) {
        if (e.stopPropagation) e.stopPropagation();
        e.currentTarget.classList.remove('drag-over');

        // Identify source data (JSON passed in dataTransfer)
        const dataJson = e.dataTransfer.getData('application/json');
        if (!dataJson) return false;

        try {
            const data = JSON.parse(dataJson);

            // Logic: Determine target section and category (before/after)
            // The drop zone should have metadata
            const targetSectionId = e.currentTarget.closest('[data-section-id]')?.dataset.sectionId;
            const targetCategory = e.currentTarget.dataset.category || 'before'; // default

            if (targetSectionId) {
                console.log('[ImageManager] Dropped image', data.id, 'to section', targetSectionId, targetCategory);

                // Call StateManager to move image: Stock -> Section, or Section -> Section
                this.state.moveImageToSection(data.id, targetSectionId, targetCategory);
            }
        } catch (err) {
            console.error('Drop error', err);
        }

        return false;
    }

    /**
     * Upload an image directly to a section from a file input
     */
    async uploadToSection(file, sectionId, category) {
        if (!file) return;

        // 1. Create Placeholder
        const tempId = `img-${Date.now()}`;
        const blobUrl = URL.createObjectURL(file);
        const imageObj = {
            id: tempId,
            url: null,
            blobUrl: blobUrl,
            status: 'uploading',
            file: file, // Keep file ref if needed
            name: file.name
        };

        // 2. Add to State immediately (UI Updates)
        const tabName = this.state.state.activeTab;
        this.state.addImageToSection(tabName, sectionId, category, imageObj);

        try {
            // 3. Upload Background
            // Retrieve global API instance (a bit messy dependency but pragmatic)
            const api = window.ApiServiceInstance;
            if (!api) throw new Error('API Service not available');

            const date = this.state.state.meta.date || new Date().toISOString().split('T')[0];

            // Assuming uploadImage returns { url, id, ... }
            const result = await api.uploadImage(file, category, 'temp_report_id', date);

            // 4. Update State on Success
            this.state.updateSectionImage(tabName, sectionId, category, tempId, {
                status: 'uploaded',
                url: result.url,
                id: result.id // Updates temp ID to real ID
            });
            console.log('[ImageManager] Direct upload success:', result.url);

        } catch (error) {
            console.error('[ImageManager] Direct upload failed', error);
            this.state.updateSectionImage(tabName, sectionId, category, tempId, {
                status: 'error'
            });
            console.warn('[ImageManager] Direct upload failed, but local preview remains available.');
        }
    }
}
