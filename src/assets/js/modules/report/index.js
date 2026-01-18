import { ReportStateManager } from './state.js';
import { ReportApiService } from './api.js';
import { TabManager } from './ui/tab-manager.js';
import { SectionManager } from './ui/section-manager.js';
import { PreviewGenerator } from './ui/preview-generator.js';
import { ImageManager } from './ui/image-manager.js';
import { HaccpManager } from './ui/haccp-manager.js';
import { SubmitManager } from './ui/submit-manager.js';
import { AutoSaveManager } from './ui/auto-save-manager.js';
import { ReportAssistant } from './assistant.js';

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

    // Initialize Assistant
    const reportAssistant = new ReportAssistant(stateManager);
    reportAssistant.init();

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

    // Handle Edit Mode
    const editId = urlParams.get('edit') || urlParams.get('id');
    const isProposalForced = urlParams.get('proposal') === 'true';

    if (editId) {
        console.log('[Report Module] Loading report for editing:', editId);
        try {
            const report = await apiService.fetchReport(editId);
            if (report) {
                stateManager.loadReport(report);

                // Update DOM inputs that aren't reactive yet
                const brandInput = document.getElementById('report-brand-search');
                const storeInput = document.getElementById('report-store-search');
                const dateInput = document.getElementById('report-date');
                const startInput = document.getElementById('report-start');
                const endInput = document.getElementById('report-end');

                if (brandInput) brandInput.value = report.brand_name || '';
                if (storeInput) storeInput.value = report.store_name || '';
                if (dateInput) dateInput.value = report.cleaning_date || report.work_date || '';
                if (startInput) startInput.value = report.cleaning_start_time || report.start_time || '';
                if (endInput) endInput.value = report.cleaning_end_time || report.end_time || '';

                if (isProposalForced) {
                    stateManager.setActiveTab('proposal');
                } else if (report.proposal_type === 'proposal' || report.type === 'proposal') {
                    stateManager.setActiveTab('proposal');
                }
            }
        } catch (e) {
            console.error('[Report Module] Failed to load report:', e);
            alert('レポートの読み込みに失敗しました。');
        }
    }

    // Bind Submit Button
    const submitBtn = document.getElementById('report-submit-btn');
    if (submitBtn) {
        submitBtn.addEventListener('click', () => submitManager.handleSubmit());
    }

    stateManager.subscribe((state) => {
        updatePhotoRequirementUI(state);
    });
    updatePhotoRequirementUI(stateManager.state);

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
    // Helper to render HACCP info
    const renderHaccpInfo = (schedule) => {
        if (!schedule.haccp_instructions && !schedule.haccp_notes) return '';

        const labels = {
            'temp_control': '温度管理の徹底',
            'cross_contamination': '交差汚染の防止',
            'hand_washing': '手洗い・身だしなみ',
            'cleaning_record': '清掃実施記録の確認'
        };

        const instructions = schedule.haccp_instructions || [];
        const instructionList = instructions.length > 0
            ? `<ul style="padding-left: 20px; margin:0; color:#059669;">` +
            instructions.map(key => `<li>${labels[key] || key}</li>`).join('') +
            `</ul>`
            : '<div style="color:#6b7280;">指定なし</div>';

        const haccpNotes = schedule.haccp_notes ? `<div style="margin-top:4px; font-size:0.85rem;">${schedule.haccp_notes}</div>` : '';

        return `
            <div style="margin-bottom: 12px; border: 1px dashed #10b981; padding: 8px; border-radius: 4px; background: #ecfdf5;">
                <strong style="display:block; color:#059669; font-size:0.85rem; margin-bottom:4px;">
                    <i class="fas fa-clipboard-check"></i> HACCP 指示事項
                </strong>
                ${instructionList}
                ${haccpNotes}
            </div>
        `;
    };

    const PHOTO_REQUIREMENTS = new Map([
        ['床・共用部清掃', { min: 3, internal: false }],
        ['店舗内簡易清掃', { min: 3, internal: false }],
        ['窓・ガラス清掃', { min: 3, internal: false }],
        ['換気扇（外側のみ）', { min: 4, internal: false }],
        ['トイレ清掃', { min: 4, internal: false }],
        ['厨房床清掃', { min: 4, internal: false }],
        ['シンク清掃', { min: 4, internal: false }],
        ['排気ファン清掃', { min: 5, internal: false }],
        ['レンジフード清掃', { min: 6, internal: true }],
        ['ダクト清掃', { min: 6, internal: true }],
        ['グリストラップ清掃', { min: 6, internal: true }],
        ['配管高圧洗浄', { min: 5, internal: false }],
        ['防火シャッター清掃', { min: 5, internal: false }]
    ]);

    let currentPhotoRequirement = null;

    const resolveScheduleLines = (schedule) => {
        const items = schedule.cleaning_items || schedule.service_items || (schedule.service_names ? (Array.isArray(schedule.service_names) ? schedule.service_names : [schedule.service_names]) : []) || [];
        return items
            .map(item => (typeof item === 'object' ? (item.name || item.item_name || item.title || '') : item))
            .map(item => String(item || '').trim())
            .filter(Boolean);
    };

    const computePhotoRequirement = (schedule) => {
        const fallback = { min: 3, internal: false, isFallback: true };
        if (!schedule) return fallback;
        const lines = resolveScheduleLines(schedule);
        if (lines.length === 0) return fallback;

        let min = 0;
        let internal = false;
        let matched = 0;

        lines.forEach(line => {
            const requirement = PHOTO_REQUIREMENTS.get(line);
            if (!requirement) return;
            min = Math.max(min, requirement.min);
            internal = internal || requirement.internal;
            matched += 1;
        });

        if (matched === 0) return fallback;
        return { min, internal, isFallback: false };
    };

    const shouldCountPhoto = (photo) => {
        if (!photo || typeof photo !== 'object') return false;
        if (photo.status === 'removed') return false;
        return true;
    };

    const countUploadedPhotos = (state) => {
        const sections = state.sections?.new || {};
        return Object.values(sections).reduce((total, section) => {
            const imageContents = section.imageContents || [];
            const sectionCount = imageContents.reduce((sum, content) => {
                const photos = content.photos || {};
                return sum
                    + (photos.before ? photos.before.filter(shouldCountPhoto).length : 0)
                    + (photos.after ? photos.after.filter(shouldCountPhoto).length : 0)
                    + (photos.completed ? photos.completed.filter(shouldCountPhoto).length : 0);
            }, 0);
            return total + sectionCount;
        }, 0);
    };

    const updatePhotoRequirementUI = (state) => {
        const requirementText = document.getElementById('photo-requirement-text');
        const internalNote = document.getElementById('photo-requirement-internal');
        const warningText = document.getElementById('photo-requirement-warning');

        if (!requirementText || !internalNote || !warningText) return;

        if (!currentPhotoRequirement) {
            currentPhotoRequirement = { min: 3, internal: false, isFallback: true };
        }

        if (currentPhotoRequirement.isFallback) {
            requirementText.textContent = '要件未設定（暫定：最低3枚を推奨）';
        } else {
            requirementText.textContent = `写真を${currentPhotoRequirement.min}枚以上`;
        }

        internalNote.style.display = currentPhotoRequirement.internal ? 'block' : 'none';

        const photoCount = countUploadedPhotos(state);
        if (photoCount < currentPhotoRequirement.min) {
            warningText.textContent = `あと${currentPhotoRequirement.min - photoCount}枚`;
            warningText.style.display = 'block';
        } else {
            warningText.style.display = 'none';
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
        // Sales module saves 'notes' -> 'notes'. 'precautions' is not explicitly saved yet, so we fallback or check if it's added later.
        const notes = schedule.notes || '特になし';

        // Caution: 'precautions' might not exist in sales data yet. 
        // We can display store-level info if we had it, or just use notes if precautions is missing.
        const precautions = schedule.precautions || schedule.store?.precautions || '特になし';

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
            
            ${renderHaccpInfo(schedule)}

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
                    currentPhotoRequirement = computePhotoRequirement(schedule);
                    updatePhotoRequirementUI(stateManager.state);
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
                brandName: document.getElementById('report-brand-search')?.value || document.getElementById('report-info-brand')?.value,
                storeName: document.getElementById('report-store-search')?.value || document.getElementById('report-info-store')?.value,
                date: document.getElementById('report-date')?.value || document.getElementById('report-info-date')?.value
            };

            // Get current active tab sections
            const currentSections = stateManager.getCurrentSections();

            // DEBUG: Log sections data for troubleshooting
            console.log('[Preview Debug] Meta:', meta);
            console.log('[Preview Debug] Sections:', JSON.stringify(currentSections, null, 2));

            previewGenerator.openFormalReportPreview({
                meta: meta,
                sections: currentSections
            });
        });
    }



    // --- Load Schedules ---
    async function loadSchedules() {
        // Use the select element defined in the outer scope or get it again
        const scheduleSelect = document.getElementById('report-schedule-select');
        if (!scheduleSelect) return;

        scheduleSelect.innerHTML = '<option value="">読み込み中...</option>';
        scheduleSelect.disabled = true;

        let schedules = [];
        try {
            schedules = await apiService.fetchSchedules();
        } catch (e) {
            console.error('Failed to load schedules', e);
            scheduleSelect.innerHTML = '<option value="">読み込み失敗</option>';
            return;
        }

        // Expose globally
        window.osAllSchedules = schedules;
        // Update state
        if (stateManager.setSchedules) {
            stateManager.setSchedules(schedules);
        }

        scheduleSelect.innerHTML = '<option value="">案件を選択してください</option>';
        schedules.forEach(schedule => {
            const date = schedule.date || schedule.scheduled_date || '';
            const time = schedule.time || schedule.time_slot || '';
            const storeName = schedule.store_name || schedule.storeName || '店舗名不明';
            const label = `${date} ${time} ${storeName}`;

            const option = document.createElement('option');
            option.value = schedule.id;
            option.textContent = label;
            // Store data for easy access
            option.dataset.json = JSON.stringify(schedule);
            scheduleSelect.appendChild(option);
        });

        scheduleSelect.disabled = false;

        // Auto-selection from URL
        const urlParams = new URLSearchParams(window.location.search);
        const scheduleParam = urlParams.get('schedule_id');
        if (scheduleParam) {
            scheduleSelect.value = scheduleParam;
            // If the value was successfully set (it exists in options)
            if (scheduleSelect.value === scheduleParam) {
                // Trigger updates
                handleScheduleSelection(scheduleParam);
            }
        }
    }

    // Handle Schedule Selection Change
    function handleScheduleSelection(scheduleId) {
        const schedules = window.osAllSchedules || [];
        const schedule = schedules.find(s => String(s.id) === String(scheduleId));

        if (schedule) {
            console.log('[Schedule] Selected:', schedule);

            // 1. Update Request Sheet (Side Panel)
            if (typeof updateRequestSheet === 'function') {
                updateRequestSheet(schedule);
            }

            // 2. Set Date Input
            const dateInput = document.getElementById('report-date');
            if (dateInput && (schedule.date || schedule.scheduled_date)) {
                dateInput.value = schedule.date || schedule.scheduled_date;
            }

            // 3. Update Brand/Store inputs if they exist
            if (schedule.store) {
                const storeInput = document.getElementById('report-store-search');
                const brandInput = document.getElementById('report-brand-search');

                if (storeInput) storeInput.value = schedule.store.name || '';
                if (brandInput && schedule.store.brand) brandInput.value = schedule.store.brand.name || '';
            }

            // 4. Update the new "Report Information" card fields
            const infoClient = document.getElementById('report-info-client');
            const infoBrand = document.getElementById('report-info-brand');
            const infoStore = document.getElementById('report-info-store');
            const infoDate = document.getElementById('report-info-date');

            if (infoClient) infoClient.value = schedule.client_name || '';
            if (infoBrand) infoBrand.value = (schedule.store && schedule.store.brand) ? (schedule.store.brand.name || '') : (schedule.brand_name || '');
            if (infoStore) infoStore.value = schedule.store_name || (schedule.store ? schedule.store.name : '') || '';
            if (infoDate) infoDate.value = schedule.date || schedule.scheduled_date || '';

            currentPhotoRequirement = computePhotoRequirement(schedule);
            updatePhotoRequirementUI(stateManager.state);
        }
    }

    // --- Sync Info Fields ---
    const syncFields = (id1, id2) => {
        const el1 = document.getElementById(id1);
        const el2 = document.getElementById(id2);
        if (el1 && el2) {
            el1.addEventListener('input', () => { el2.value = el1.value; });
            el2.addEventListener('input', () => { el1.value = el2.value; });
        }
    };
    syncFields('report-brand-search', 'report-info-brand');
    syncFields('report-store-search', 'report-info-store');
    syncFields('report-date', 'report-info-date');

    // Bind Change Event for Schedule Select
    const scheduleSelectEl = document.getElementById('report-schedule-select');
    if (scheduleSelectEl) {
        scheduleSelectEl.addEventListener('change', (e) => {
            handleScheduleSelection(e.target.value);
        });
    }

    // --- Filter functionality for Report Info Fields ---
    async function setupInfoFilters() {
        const clientInput = document.getElementById('report-info-client');
        const brandInput = document.getElementById('report-info-brand');
        const storeInput = document.getElementById('report-info-store');

        const clientSuggestions = document.getElementById('report-info-client-suggestions');
        const brandSuggestions = document.getElementById('report-info-brand-suggestions');
        const storeSuggestions = document.getElementById('report-info-store-suggestions');

        if (!clientInput || !brandInput || !storeInput) return;

        // Cache for filter data
        let allClients = [];
        let allBrands = [];
        let allStores = [];

        // Load data
        try {
            console.log('[Filter] Loading master data...');
            const [clientsRes, brandsRes, storesRes] = await Promise.all([
                apiService.fetchClients(),
                apiService.fetchBrands(),
                apiService.fetchStores()
            ]);

            allClients = clientsRes.items || clientsRes || [];
            allBrands = brandsRes.items || brandsRes || [];
            allStores = storesRes.items || storesRes || [];

            console.log('[Filter] Data processed:', { clients: allClients.length, brands: allBrands.length, stores: allStores.length });
        } catch (e) {
            console.error('[Filter] Failed to load master data', e);
        }

        const setupDropdown = (input, suggestions, data, getLabel, getSubLabel, onSelect) => {
            const renderSuggestions = (filtered) => {
                if (filtered.length === 0) {
                    suggestions.style.display = 'none';
                    return;
                }
                suggestions.innerHTML = filtered.map(item => `
                    <div class="suggestion-item" data-id="${item.id}">
                        <span class="item-label">${getLabel(item)}</span>
                        ${getSubLabel ? `<span class="item-sub">${getSubLabel(item)}</span>` : ''}
                    </div>
                `).join('');
                suggestions.style.display = 'block';

                suggestions.querySelectorAll('.suggestion-item').forEach((el, index) => {
                    el.addEventListener('mousedown', (e) => {
                        e.preventDefault(); // Prevent blur before click
                        const item = filtered[index];
                        input.value = getLabel(item);
                        suggestions.style.display = 'none';
                        if (onSelect) onSelect(item);
                        // Trigger input event manually to sync other fields
                        input.dispatchEvent(new Event('input'));
                    });
                });
            };

            input.addEventListener('input', () => {
                const val = input.value.trim().toLowerCase();
                if (!val) {
                    suggestions.style.display = 'none';
                    return;
                }
                const filtered = data.filter(item => {
                    const label = getLabel(item).toLowerCase();
                    const sub = getSubLabel ? getSubLabel(item).toLowerCase() : '';
                    return label.includes(val) || sub.includes(val);
                }).slice(0, 10); // Limit to 10
                renderSuggestions(filtered);
            });

            input.addEventListener('blur', () => {
                setTimeout(() => { suggestions.style.display = 'none'; }, 200);
            });

            input.addEventListener('focus', () => {
                if (input.value.trim()) {
                    input.dispatchEvent(new Event('input'));
                }
            });
        };

        // Setup Clients
        setupDropdown(clientInput, clientSuggestions, allClients,
            (c) => c.name || c.client_name || '',
            (c) => c.id || ''
        );

        // Setup Brands
        setupDropdown(brandInput, brandSuggestions, allBrands,
            (b) => b.name || '',
            (b) => b.client_name || '',
            (brand) => {
                // When brand selected, filter stores? 
                // For now just selection is fine
            }
        );

        // Setup Stores
        setupDropdown(storeInput, storeSuggestions, allStores,
            (s) => s.name || '',
            (s) => (s.brand ? s.brand.name : '') || (s.brand_name || ''),
            (store) => {
                // When store selected, auto-fill brand/client if possible
                if (store.brand && brandInput) {
                    brandInput.value = store.brand.name || '';
                    brandInput.dispatchEvent(new Event('input'));
                }
                if ((store.client_name || (store.client && store.client.name)) && clientInput) {
                    clientInput.value = store.client_name || (store.client ? store.client.name : '');
                    clientInput.dispatchEvent(new Event('input'));
                }
            }
        );
    }

    // Start loading schedules
    loadSchedules();
    // Setup Filters
    setupInfoFilters();

    console.log('[Report Module] Ready v3', { stateManager, apiService, tabManager, sectionManager, previewGenerator });
});
