const API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';
const REPORT_API = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';

export class ReportApiService {
    constructor() { }

    async _getAuthHeader() {
        // Firebase Auth is not used. Returning standard headers.
        return {
            'Content-Type': 'application/json'
            // Add other auth headers here if needed (e.g., API Key)
        };
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
            try {
                // 1. Compress Image before upload to avoid 413 Content Too Large (Lambda 6MB limit)
                const compressedImage = await this._compressImage(imageFile);
                const reader = new FileReader();

                reader.onload = async (e) => {
                    const base64Data = e.target.result; // Data URL
                    const base64Content = base64Data.split(',')[1];

                    const payload = {
                        image_data: base64Content,
                        category: category,
                        file_name: imageFile.name,
                        content_type: 'image/jpeg', // Always JPEG after compression
                        report_id: reportId,
                        cleaning_date: cleaningDate
                    };

                    console.log(`[API] Uploading compressed image (${(base64Content.length / 1024).toFixed(1)} KB)`);
                    console.log('[API] Payload keys:', Object.keys(payload));

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
                    // Lambda returns { success: true, image: { url, image_id, ... } }
                    const imageData = result.image || result;
                    resolve({
                        url: imageData.url || imageData.imageUrl,
                        id: imageData.image_id || imageData.id || imageData.item_id
                    });
                };
                reader.onerror = (err) => reject(err);
                reader.readAsDataURL(compressedImage);
            } catch (err) {
                console.error('[API] Image Compression/Upload Error:', err);
                reject(err);
            }
        });
    }

    // Client-side image compression using Canvas
    async _compressImage(file, maxWidth = 1600, maxHeight = 1600, quality = 0.8) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth || height > maxHeight) {
                        if (width > height) {
                            height *= maxWidth / width;
                            width = maxWidth;
                        } else {
                            width *= maxHeight / height;
                            height = maxHeight;
                        }
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob((blob) => {
                        if (!blob) return reject(new Error('Canvas compression failed'));
                        const compressedFile = new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        });
                        resolve(compressedFile);
                    }, 'image/jpeg', quality);
                };
                img.onerror = (err) => reject(err);
            };
            reader.onerror = (err) => reject(err);
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

    async fetchReport(reportId) {
        try {
            const headers = await this._getAuthHeader();
            const response = await fetch(`${REPORT_API}/daily-reports/${reportId}?type=cleaning`, { headers });
            if (!response.ok) throw new Error(`Failed to fetch report: ${response.status}`);
            const data = await response.json();
            return data.report || data;
        } catch (error) {
            console.error('[API] Fetch Report Error:', error);
            throw error;
        }
    }
}
