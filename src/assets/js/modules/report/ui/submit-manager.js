import { resolveScheduleLines, computePhotoRequirement, countUploadedPhotos } from '../photo-logic.js';

/**
 * SubmitManager
 * Handles the report submission process, including validation and API interaction.
 */
export class SubmitManager {
    constructor(stateManager, apiService) {
        this.stateManager = stateManager;
        this.api = apiService;
    }

    async handleSubmit() {
        const state = this.stateManager.state;

        // --- Photo Requirement Validation (Soft) ---
        const currentSections = this.stateManager.getCurrentSections();
        const sectionItems = Object.values(currentSections).map(s => s.item_name).filter(Boolean);

        let scheduleItems = [];
        if (window.osCurrentSchedule) {
            scheduleItems = resolveScheduleLines(window.osCurrentSchedule);
        } else if (state.meta.scheduleId) {
            // Fallback if not globally set but in state
            const schedules = state.schedules || window.osAllSchedules || [];
            const sched = schedules.find(s => String(s.id) === String(state.meta.scheduleId));
            if (sched) scheduleItems = resolveScheduleLines(sched);
        }

        const allItems = [...new Set([...scheduleItems, ...sectionItems])];
        const requirement = computePhotoRequirement(allItems);
        const photoCount = countUploadedPhotos(state);

        if (photoCount < requirement.min) {
            if (!confirm(`写真が${requirement.min}枚に達していません（現在${photoCount}枚）。\nこのまま作業報告を提出しますか？`)) {
                return;
            }
        } else {
            if (!confirm('作業内容を報告し、完了として提出しますか？\n（提出された内容は保存され、報告書として発行可能になります）')) return;
        }

        const submitBtn = document.getElementById('report-submit-btn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 送信中...';
        }

        try {
            // 1. Gather Data
            const reportData = this._buildReportData();

            // 2. Validate
            this._validate(reportData);

            // 3. Save/Submit via API
            // Check if we are in edit mode based on URL or state
            const urlParams = new URLSearchParams(window.location.search);
            const reportId = urlParams.get('id');
            const isEditMode = !!reportId;

            if (isEditMode) {
                reportData.id = reportId;
                // If re-submitting, we might want to reset status to 'pending' if it was requested changes
                reportData.status = 'pending';
            }

            const result = await this.api.saveReport(reportData, isEditMode);
            console.log('[Submit] Success:', result);

            // 4. Post-submission UX
            const path = window.location.pathname;
            if (path.includes('/staff/os/')) {
                alert('作業完了報告を受け付けました。\n報告書データが保存されました。\nマイページへ戻ります。');
                window.location.href = '/staff/os/mypage';
            } else if (path.includes('/admin/')) {
                alert('レポートを保存しました。');
                // Check if in iframe/popup
                if (window.opener) {
                    window.close();
                } else {
                    window.location.href = '/admin/reports/';
                }
            } else {
                alert('レポートを送信しました。');
                window.location.href = '/staff/reports';
            }

        } catch (error) {
            console.error('[Submit] Error:', error);
            alert(`送信エラー: ${error.message}`);
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> レポートを提出';
            }
        }
    }

    _buildReportData() {
        // Collect Meta Data
        const brandSelect = document.getElementById('report-brand-search'); // Input not select
        const storeSelect = document.getElementById('report-store-search'); // Input
        const dateInput = document.getElementById('report-date');
        const arrivalInput = document.getElementById('report-arrival');
        const startInput = document.getElementById('report-start');
        const endInput = document.getElementById('report-end');
        const exceptionFlag = document.getElementById('exception-flag')?.value || 'none';
        const exceptionReasonCode = document.getElementById('exception-reason-code')?.value || '';
        const exceptionNote = document.getElementById('exception-note')?.value || '';
        const scheduleSelect = document.getElementById('report-schedule-select');

        // Logic to resolve IDs from names needed if inputs are just text
        // For MVP/V2, let's assume UI puts ID in dataset or we use what's available
        // Legacy code uses window.brands/stores to find ID from name input

        let storeId = null;
        let brandId = null;
        let scheduleId = scheduleSelect ? scheduleSelect.value : null;

        // Try to get IDs from selected schedule if available
        if (scheduleSelect && scheduleSelect.selectedOptions[0]) {
            const opt = scheduleSelect.selectedOptions[0];
            if (opt.dataset.json) {
                const sched = JSON.parse(opt.dataset.json);
                storeId = sched.store_id;
                // brandId might not be in schedule directly, but fetchable
            }
        }

        // Collect Sections
        const currentSections = this.stateManager.getCurrentSections();
        const sectionsArray = Object.values(currentSections);

        // Transform sections to API format if necessary
        // The API likely expects a JSON structure in 'content' or specific fields
        // Legacy 'saveReport' sends the whole object. 
        // We need to match the expected schema of the backend lambda.
        // Assuming the backend stores 'sections' field as JSON or similar.

        return {
            date: (document.getElementById('report-info-date')?.value) || (dateInput ? dateInput.value : new Date().toISOString().split('T')[0]),
            client_name: document.getElementById('report-info-client')?.value,
            brand_name: document.getElementById('report-info-brand')?.value,
            store_name: document.getElementById('report-info-store')?.value,
            store_id: storeId,
            schedule_id: scheduleId,
            status: 'pending', // Default status
            sections: currentSections, // Send the dictionary or array? 
            // Legacy sends a mapped structure. Let's send the map for now.
            // Also need cleaning items metadata for indexing if backend requires it
            cleaning_items: sectionsArray
                .filter(s => s.type === 'cleaning')
                .map(s => s.item_name),
            arrival_time: arrivalInput ? arrivalInput.value : '',
            cleaning_start_time: startInput ? startInput.value : '',
            cleaning_end_time: endInput ? endInput.value : '',
            exception_flag: exceptionFlag,
            exception_reason_code: exceptionReasonCode,
            exception_note: exceptionNote
        };
    }

    _validate(data) {
        if (!data.date) throw new Error('作業日を入力してください。');
        // if (!data.store_id) throw new Error('店舗を選択してください。'); // Might be relaxed if free input allowed

        const sections = Object.values(data.sections || {});
        if (sections.length === 0) throw new Error('報告セクションがありません。少なくとも1つの項目を追加してください。');

        // Check for empty required fields in sections if strict
        if (data.exception_flag === 'unfinished' && !data.exception_reason_code) {
            throw new Error('未実施の理由コードを選択してください。');
        }
    }
}
