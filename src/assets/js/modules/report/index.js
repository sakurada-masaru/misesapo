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

    // URL Parameter Handling
    const urlParams = new URLSearchParams(window.location.search);
    const scheduleId = urlParams.get('schedule_id'); // Get schedule ID

    // Retrieve pending items from SessionStorage (Preferred) OR URL (Legacy fallback)
    let selectedItems = [];

    // 1. Try SessionStorage (Set by MyPage)
    const pendingItemsJson = sessionStorage.getItem('pendingReportItems');
    if (pendingItemsJson) {
        try {
            selectedItems = JSON.parse(pendingItemsJson);
            console.log('[Report Module] Loaded pending items from SessionStorage:', selectedItems);
            // Optional: Clear session storage to avoid reuse? 
            // sessionStorage.removeItem('pendingReportItems'); // Keep for safety for now, or clear on submit
        } catch (e) {
            console.error('[Report Module] Failed to parse SessionStorage pending items:', e);
        }
    }

    // 2. Fallback to URL 'selected_items'
    if (selectedItems.length === 0) {
        const selectedItemsParam = urlParams.get('selected_items');
        if (selectedItemsParam) {
            try {
                selectedItems = JSON.parse(decodeURIComponent(selectedItemsParam));
                console.log('[Report Module] Loaded items from URL:', selectedItems);
            } catch (e) {
                console.error('[Report Module] Failed to parse URL selected_items:', e);
            }
        }
    }

    // 3. Fallback to URL 'services'
    if (selectedItems.length === 0) {
        const servicesParam = urlParams.get('services');
        if (servicesParam) {
            selectedItems = servicesParam.split(',').filter(Boolean);
            console.log('[Report Module] Loaded services from URL:', selectedItems);
        }
    }

    // Initialize Managers
    const imageManager = new ImageManager(stateManager);
    const previewGenerator = new PreviewGenerator();
    const submitManager = new SubmitManager(stateManager, apiService);
    const autoSaveManager = new AutoSaveManager(stateManager);

    // Context-sensitive initialization
    let isRestored = false;
    if (scheduleId) {
        // Attempt to restore draft specific to this schedule
        isRestored = autoSaveManager.restore(scheduleId);
    }

    // If NO draft was restored (or mismatch), initialize from params
    if (!isRestored && selectedItems.length > 0) {
        console.log('[Report Module] Initializing fresh report state from params.');
        // Clear existing state just in case
        // stateManager.reset(); // If such method exists, or rely on fresh instance

        selectedItems.forEach(item => {
            const itemName = typeof item === 'object' ? (item.name || item.item_name || item.title) : item;
            if (itemName) {
                stateManager.addSection('new', {
                    type: 'cleaning',
                    item_name: itemName,
                    subtitles: [],
                    comments: [],
                    imageContents: []
                });
            }
        });

        // Save initial state immediately to establish correct scheduleId context
        if (scheduleId) {
            autoSaveManager.setScheduleId(scheduleId);
            autoSaveManager.save();
        }
    } else {
        console.log('[Report Module] Draft restored or no items to initialize.');
        if (scheduleId) autoSaveManager.setScheduleId(scheduleId); // Ensure context is set if restored
    }

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

    // Side Panel Toggle Logic
    const detailsBtn = document.getElementById('details-btn');
    const sidePanel = document.getElementById('side-panel');
    const sidePanelOverlay = document.getElementById('side-panel-overlay');
    const sidePanelClose = document.getElementById('side-panel-close');

    if (detailsBtn && sidePanel && sidePanelOverlay) {
        const togglePanel = () => {
            const isActive = sidePanel.classList.contains('active');
            if (isActive) {
                sidePanel.classList.remove('active');
                sidePanelOverlay.classList.remove('active');
                detailsBtn.classList.remove('active');
            } else {
                sidePanel.classList.add('active');
                sidePanelOverlay.classList.add('active');
                detailsBtn.classList.add('active');
            }
        };

        detailsBtn.addEventListener('click', togglePanel);
        if (sidePanelClose) sidePanelClose.addEventListener('click', togglePanel);
        sidePanelOverlay.addEventListener('click', togglePanel);
    }

    // Comment Handlers
    window.handleAddSectionComment = (sectionId) => {
        const text = prompt('コメントを入力してください:');
        if (text) {
            const currentTab = stateManager.state.activeTab;
            const section = stateManager.state.sections[currentTab][sectionId];
            if (section) {
                const comments = section.comments || [];
                // Simple state update, could be optimized in stateManager
                stateManager.updateSection(currentTab, sectionId, { comments: [...comments, text] });
            }
        }
    };
    // Populate Request Sheet based on selected schedule
    const updateRequestSheet = (schedule) => {
        const container = document.getElementById('request-sheet-content');
        if (!container || !schedule) return;

        const cleaningItems = schedule.cleaning_items || schedule.service_items || (schedule.service_names ? (Array.isArray(schedule.service_names) ? schedule.service_names : [schedule.service_names]) : []) || [];
        const address = schedule.address || (schedule.store ? schedule.store.address : '') || '住所未設定';
        const clientName = schedule.client_name || (schedule.client ? schedule.client.name : '') || '';

        // Mock data or real data if available
        const notes = schedule.notes || '特になし';
        const precautions = schedule.precautions || '入店時、裏口のインターホンを押してください。';

        const itemsHtml = cleaningItems.length > 0
            ? cleaningItems.map(item => `<li style="margin-bottom:4px;">${typeof item === 'object' ? (item.name || item.item_name) : item}</li>`).join('')
            : '<li>指定なし</li>';

        container.innerHTML = `
            <div style="margin-bottom: 12px;">
                <strong style="display:block; color:#374151; font-size:0.85rem; margin-bottom:4px;">法人名</strong>
                <div style="color:#111827;">${clientName || '---'}</div>
            </div>
            <div style="margin-bottom: 12px;">
                <strong style="display:block; color:#374151; font-size:0.85rem; margin-bottom:4px;">所在地</strong>
                <div style="color:#111827;">${address}</div>
            </div>
            <div style="margin-bottom: 12px;">
                <strong style="display:block; color:#374151; font-size:0.85rem; margin-bottom:4px;">実施項目</strong>
                <ul style="padding-left: 20px; margin:0; color:#111827;">
                    ${itemsHtml}
                </ul>
            </div>
            <div style="margin-bottom: 12px;">
                <strong style="display:block; color:#374151; font-size:0.85rem; margin-bottom:4px;">特記事項</strong>
                <div style="color:#111827; white-space: pre-wrap;">${notes}</div>
            </div>
             <div style="margin-bottom: 12px;">
                <strong style="display:block; color:#ec4899; font-size:0.85rem; margin-bottom:4px;">注意事項 (入館ルール等)</strong>
                <div style="color:#111827; white-space: pre-wrap; background:white; padding:8px; border:1px solid #fce7f3; border-radius:4px;">${precautions}</div>
            </div>
        `;
    };

    // Hook into schedule loading
    const originalLoadSchedules = window.loadSchedules; // Assuming this function exists or we find where it is called
    // Since loadSchedules is likely inside DOMContentLoaded or called by it, we act on 'schedule_id' detection

    // Check if we have a selected schedule on load
    const currentScheduleId = urlParams.get('schedule_id');
    if (currentScheduleId) {
        // Wait for apiService to fetch schedules, then find and update
        const checkSchedule = setInterval(() => {
            // Check global variable OR state manager OR if loadSchedules has populated the select dropdown
            const schedules = window.osAllSchedules || (stateManager.state.schedules) || [];

            if (schedules.length > 0) {
                const schedule = schedules.find(s => String(s.id) === String(currentScheduleId));
                if (schedule) {
                    updateRequestSheet(schedule);
                    clearInterval(checkSchedule);
                }
            }
        }, 300); // Check every 300ms
        setTimeout(() => clearInterval(checkSchedule), 15000); // 15s timeout
    }
    window.handleDeleteSectionComment = (sectionId, idx) => {
        if (!confirm('コメントを削除しますか？')) return;
        const currentTab = stateManager.state.activeTab;
        const section = stateManager.state.sections[currentTab][sectionId];
        if (section && section.comments) {
            const newComments = [...section.comments];
            newComments.splice(idx, 1);
            stateManager.updateSection(currentTab, sectionId, { comments: newComments });
        }
    };

    // --- Custom Content Handlers ---
    window.handleAddCustomContent = (sectionId, type) => {
        const currentTab = stateManager.state.activeTab;
        stateManager.addCustomContent(currentTab, sectionId, type);
    };

    window.handleRemoveCustomContent = (sectionId, contentId) => {
        if (!confirm('削除してよろしいですか？')) return;
        const currentTab = stateManager.state.activeTab;
        stateManager.removeCustomContent(currentTab, sectionId, contentId);
    };

    window.handleUpdateCustomContent = (sectionId, contentId, updates) => {
        const currentTab = stateManager.state.activeTab;
        stateManager.updateCustomContent(currentTab, sectionId, contentId, updates);
    };

    window.handleSectionLayoutModeChange = (sectionId, mode) => {
        const currentTab = stateManager.state.activeTab;
        stateManager.updateSection(currentTab, sectionId, { layoutMode: mode });
    };

    window.handleCustomImageUpload = async (input, sectionId, contentId) => {
        if (input.files && input.files[0]) {
            const file = input.files[0];
            const currentTab = stateManager.state.activeTab;

            // 1. Show preview immediately
            const blobUrl = URL.createObjectURL(file);
            stateManager.updateCustomContent(currentTab, sectionId, contentId, {
                image: { blobUrl: blobUrl, status: 'uploading' }
            });

            try {
                // 2. Upload
                // Retrieve global API instance
                const api = window.ApiServiceInstance;
                if (!api) throw new Error('API Service unavailable');

                const date = stateManager.state.meta.date || new Date().toISOString().split('T')[0];
                const result = await api.uploadImage(file, 'extra', 'temp_report_id', date);

                // 3. Update with remote URL
                stateManager.updateCustomContent(currentTab, sectionId, contentId, {
                    image: {
                        blobUrl: blobUrl,
                        url: result.url,
                        status: 'uploaded',
                        id: result.id
                    }
                });

            } catch (error) {
                console.error('Custom image upload failed', error);
                alert('画像のアップロードに失敗しました');
                stateManager.updateCustomContent(currentTab, sectionId, contentId, {
                    image: { blobUrl: blobUrl, status: 'error' }
                });
            }
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

        // Expose globally for other modules/logic to access
        window.osAllSchedules = schedules;
        // Also update state manager if it has a setter
        stateManager.setSchedules(schedules);

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
            scheduleSelect.appendChild(option);
        });

        scheduleSelect.disabled = false;

        // Check URL params for auto-selection (Enhancement)
        const urlParams = new URLSearchParams(window.location.search);
        const scheduleParam = urlParams.get('schedule_id');
        if (scheduleParam) {
            scheduleSelect.value = scheduleParam;
            // Dispatch change event to trigger listeners
            scheduleSelect.dispatchEvent(new Event('change'));

            // Explicitly update request sheet immediately
            const targetSchedule = schedules.find(s => String(s.id) === String(scheduleParam));
            if (targetSchedule) {
                updateRequestSheet(targetSchedule);
            }
        }
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
