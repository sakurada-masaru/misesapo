const API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';
const REPORT_API = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';

export class ReportApiService {
    constructor() { }

    async _getAuthHeader() {
        if (typeof window.getFirebaseIdToken === 'function') {
            const token = await window.getFirebaseIdToken();
            return {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            };
        } else {
            console.warn('getFirebaseIdToken is not available. Using mock token or failing.');
            return { 'Content-Type': 'application/json' };
        }
    }

    async fetchSchedules() {
        try {
            const headers = await this._getAuthHeader();
            const response = await fetch(`${API_BASE}/schedules`, { headers });
            if (!response.ok) throw new Error(`Failed to fetch schedules: ${response.status}`);
            const data = await response.json();
            return data.schedules || data;
        } catch (error) {
            console.error('[API] Fetch Schedules Error:', error);
            return [];
        }
    }

    // Upload image (Base64 JSON approach based on legacy code)
    async uploadImage(imageFile, category, reportId = null, cleaningDate = null) {
        return new Promise(async (resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const base64Data = e.target.result; // Data URL

                // Remove 'data:image/jpeg;base64,' prefix
                const base64Content = base64Data.split(',')[1];

                const payload = {
                    image_data: base64Content,
                    category: category,
                    file_name: imageFile.name,
                    content_type: imageFile.type, // Add content type explicitly
                    report_id: reportId, // Optional
                    cleaning_date: cleaningDate
                };

                // Debug logging
                console.log('[API] Uploading payload:', { ...payload, image_data: '<<BASE64_TRUNCATED>>' });

                try {
                    const headers = await this._getAuthHeader();
                    const response = await fetch(`${REPORT_API}/staff/report-images`, {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify(payload)
                    });

                    if (!response.ok) {
                        const errText = await response.text();
                        throw new Error(`Upload failed: ${response.status} ${errText}`);
                    }

                    const result = await response.json();
                    resolve({
                        url: result.url || result.imageUrl,
                        id: result.id || result.item_id
                    });
                } catch (err) {
                    console.error('[API] Image Upload Error:', err);
                    reject(err);
                }
            };
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(imageFile);
        });
    }

    async saveReport(reportData, isEditMode = false) {
        try {
            const headers = await this._getAuthHeader();
            const url = isEditMode
                ? `${REPORT_API}/daily-reports/${reportData.id}?type=cleaning`
                : `${REPORT_API}/daily-reports?type=cleaning`;

            const method = isEditMode ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: headers,
                body: JSON.stringify(reportData)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Save failed: ${response.status} ${errText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('[API] Save Report Error:', error);
            throw error;
        }
    }

    async fetchServiceItems() {
        try {
            const response = await fetch('/data/service_items.json');
            if (!response.ok) return [];
            return await response.json();
        } catch (e) {
            console.warn('Failed to fetch service items', e);
            return [];
        }
    }

    async fetchStores() {
        try {
            const headers = await this._getAuthHeader();
            const response = await fetch(`${API_BASE}/stores`, { headers });
            return response.ok ? await response.json() : [];
        } catch (e) { return []; }
    }

    async fetchBrands() {
        try {
            const headers = await this._getAuthHeader();
            const response = await fetch(`${API_BASE}/brands`, { headers });
            return response.ok ? await response.json() : [];
        } catch (e) { return []; }
    }
}
