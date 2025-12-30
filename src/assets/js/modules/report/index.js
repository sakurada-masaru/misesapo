import { ReportStateManager } from './state.js';
import { ReportApiService } from './api.js';
import { TabManager } from './ui/tab-manager.js';
import { SectionManager } from './ui/section-manager.js';
import { PreviewGenerator } from './ui/preview-generator.js';
import { ImageManager } from './ui/image-manager.js';
import { HaccpManager } from './ui/haccp-manager.js';
import { SubmitManager } from './ui/submit-manager.js';
import { AutoSaveManager } from './ui/auto-save-manager.js';

console.log('[Report Module] Initializing...');

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Report Module] DOMContentLoaded');

    // Initialize State
    const stateManager = new ReportStateManager();

    // Initialize API
    const apiService = new ReportApiService();
    window.ApiServiceInstance = apiService;

    // Initialize UI Components
    const haccpManager = new HaccpManager(stateManager);

    // Pass haccpManager to SectionManager (which passes to SectionRenderer) or ensure global availability first
    window.HaccpManagerInstance = haccpManager; // Keep for now as renderer checks window

    const tabManager = new TabManager(stateManager);
    const sectionManager = new SectionManager(stateManager); // SectionRenderer is inside here

    // URL Parameter Handling (Restoring legacy functionality)
    const urlParams = new URLSearchParams(window.location.search);
    const selectedItemsParam = urlParams.get('selected_items');
    const servicesParam = urlParams.get('services');

    if (selectedItemsParam) {
        try {
            const selectedItems = JSON.parse(decodeURIComponent(selectedItemsParam));
            console.log('[Report Module] Loaded selected items:', selectedItems);

            if (Array.isArray(selectedItems)) {
                selectedItems.forEach(item => {
                    const itemName = typeof item === 'object' ? (item.name || item.item_name || item.title) : item;
                    if (itemName) {
                        stateManager.addSection('new', {
                            type: 'cleaning',
                            item_name: itemName,
                            // Initialize empty structure for compatibility
                            subtitles: [],
                            comments: [],
                            imageContents: []
                        });
                    }
                });
            }
        } catch (e) {
            console.error('[Report Module] Failed to parse selected_items:', e);
        }
    } else if (servicesParam) {
        // OS Service Injection
        const services = servicesParam.split(',').filter(Boolean);
        console.log('[Report Module] Injecting services:', services);
        services.forEach(serviceName => {
            stateManager.addSection('new', {
                type: 'cleaning',
                item_name: serviceName,
                subtitles: [],
                comments: [],
                imageContents: []
            });
        });
    }



    // Initialize Managers
    // const haccpManager = new HaccpManager(stateManager); // Moved up
    const imageManager = new ImageManager(stateManager);
    const previewGenerator = new PreviewGenerator();
    const submitManager = new SubmitManager(stateManager, apiService);
    const autoSaveManager = new AutoSaveManager(stateManager);

    // Bind Submit Button
    const submitBtn = document.getElementById('report-submit-btn');
    if (submitBtn) {
        submitBtn.addEventListener('click', () => submitManager.handleSubmit());
    }

    // Inject HaccpManager into SectionManager/Renderer indirectly or pass it down?
    // Ideally sectionManager should know about haccpManager or we pass it to renderer.
    // For now, let's attach logic to global window to handle the events from HaccpManager's HTML.

    window.handleHaccpChange = (sectionId, field, value) => {
        console.log(`[HACCP] Change ${sectionId}: ${field} = ${value}`);
        // We need to update the state
        // stateManager.updateSection wants the Whole object? No, we extended it to accept updates.
        // We need to get current section first to deep merge haccp_info
        const currentTab = stateManager.state.activeTab;
        const section = stateManager.state.sections[currentTab][sectionId];

        if (section) {
            const haccpInfo = section.haccp_info || {};
            haccpInfo[field] = value;

            stateManager.updateSection(currentTab, sectionId, { haccp_info: haccpInfo });
        }
    };

    // Direct Image Upload Handler (from SectionRenderer)
    window.handleSectionImageUpload = (input, sectionId, category) => {
        console.log('[ImageUpload] Triggered for:', sectionId, category);
        if (input.files && input.files[0]) {
            const file = input.files[0];
            imageManager.uploadToSection(file, sectionId, category);
            input.value = ''; // Reset input so same file can be selected again if needed
        }
    };

    // We also need to tell SectionRenderer how to render HACCP fields.
    // Ideally SectionRenderer should have a reference to HaccpManager.
    // Since we created SectionManager earlier, let's look at how to inject this dependency.
    // Quickest way: Assign to a global or static, OR update SectionManager construction.
    // Let's attach to window for Renderer to use easily in "prototype" phase.
    window.HaccpManagerInstance = haccpManager;
    const formalPreviewBtn = document.getElementById('formal-preview-btn');
    if (formalPreviewBtn) {
        formalPreviewBtn.addEventListener('click', () => {
            // Gather data (merging meta from inputs and sections from state)
            const meta = {
                brandName: document.getElementById('report-brand-search')?.value,
                storeName: document.getElementById('report-store-search')?.value,
                date: document.getElementById('report-date')?.value
            };

            // Get current active tab sections
            const currentSections = stateManager.getCurrentSections();

            previewGenerator.openFormalReportPreview({
                meta: meta,
                sections: currentSections
            });
        });
    }



    // --- Load Schedules ---
    async function loadSchedules() {
        const scheduleSelect = document.getElementById('report-schedule-select');
        if (!scheduleSelect) return;

        scheduleSelect.innerHTML = '<option value="">読み込み中...</option>';
        scheduleSelect.disabled = true;

        const schedules = await apiService.fetchSchedules();

        // Filter logic could be added here (e.g. active only)
        // For now, map all

        scheduleSelect.innerHTML = '<option value="">案件を選択してください</option>';
        schedules.forEach(schedule => {
            // Simplified label formatting
            const date = schedule.date || schedule.scheduled_date || '';
            const time = schedule.time || schedule.time_slot || '';
            const storeName = schedule.store_name || schedule.storeName || '店舗名不明';
            const label = `${date} ${time} ${storeName}`;

            const option = document.createElement('option');
            option.value = schedule.id;
            option.textContent = label;
            // Store full data if needed?
            // stateManager usually doesn't store ALL schedules, just current selection
            option.dataset.json = JSON.stringify(schedule);
            scheduleSelect.appendChild(option);
        });

        scheduleSelect.disabled = false;

        // Check for schedule_id in URL
        const urlParams = new URLSearchParams(window.location.search);
        const scheduleIdParam = urlParams.get('schedule_id');

        if (scheduleIdParam) {
            const targetOption = scheduleSelect.querySelector(`option[value="${scheduleIdParam}"]`);
            if (targetOption) {
                scheduleSelect.value = scheduleIdParam;
                // Manually trigger update
                const schedule = JSON.parse(targetOption.dataset.json);
                console.log('[Schedule] Auto-selected from URL:', schedule);

                const dateInput = document.getElementById('report-date');
                if (dateInput && (schedule.date || schedule.scheduled_date)) {
                    dateInput.value = schedule.date || schedule.scheduled_date;
                }
            }
        }

        // Listen for change
        scheduleSelect.addEventListener('change', (e) => {
            const selectedOpt = scheduleSelect.options[scheduleSelect.selectedIndex];
            if (selectedOpt && selectedOpt.dataset.json) {
                const schedule = JSON.parse(selectedOpt.dataset.json);
                console.log('[Schedule] Selected:', schedule);

                // Set meta data
                const dateInput = document.getElementById('report-date');
                if (dateInput && (schedule.date || schedule.scheduled_date)) {
                    dateInput.value = schedule.date || schedule.scheduled_date;
                }

                // Inject cleaning items from schedule if needed
                // Legacy behavior: auto-add cleaning items if not manually added?
                // For V2, we might want to ask or just add
            }
        });
    }

    loadSchedules();

    console.log('[Report Module] Ready', { stateManager, apiService, tabManager, sectionManager, previewGenerator });
});
