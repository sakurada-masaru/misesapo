/**
 * 清掃マニュアル管理 - AWS API統合
 * AWS Lambda + API Gateway + S3を使用
 */

(function() {
    'use strict';
    
    // API Gatewayエンドポイント
    const API_GATEWAY_ENDPOINT = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';
    
    /**
     * 開発サーバーかどうかを判定
     */
    function isDevelopmentServer() {
        const hostname = window.location.hostname;
        return hostname === 'localhost' || hostname === '127.0.0.1';
    }
    
    /**
     * APIエンドポイントを解決
     */
    function getApiEndpoint(path = '') {
        if (isDevelopmentServer()) {
            // 開発サーバーの場合はローカルAPIを使用（API Gatewayは使わない）
            return `/api/cleaning-manual${path}`;
        }
        // 本番環境ではAPI Gatewayを使用
        return `${API_GATEWAY_ENDPOINT}/cleaning-manual${path}`;
    }
    
    /**
     * データを取得
     */
    async function loadData(isDraft = false) {
        const path = isDraft ? '/draft' : '';
        const endpoint = getApiEndpoint(path);
        
        console.log('[AWSCleaningManualAPI] Loading data from:', endpoint, '(isDevelopmentServer:', isDevelopmentServer(), ')');
        
        try {
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('[AWSCleaningManualAPI] Data loaded successfully:', data);
            return data;
        } catch (error) {
            console.error('[AWSCleaningManualAPI] Load error:', error);
            
            // 開発サーバーの場合、フォールバックを試す
            if (isDevelopmentServer()) {
                console.log('[AWSCleaningManualAPI] Trying fallback to static JSON file...');
                try {
                    const fallbackResponse = await fetch('/data/cleaning-manual.json');
                    if (fallbackResponse.ok) {
                        const fallbackData = await fallbackResponse.json();
                        console.log('[AWSCleaningManualAPI] Fallback data loaded:', fallbackData);
                        return fallbackData;
                    }
                } catch (fallbackError) {
                    console.error('[AWSCleaningManualAPI] Fallback error:', fallbackError);
                }
            }
            
            // 初期データを返す
            console.warn('[AWSCleaningManualAPI] Returning empty data');
            return {
                kitchen: [],
                aircon: [],
                floor: [],
                other: []
            };
        }
    }
    
    /**
     * データを保存
     */
    async function saveData(data, isDraft = false) {
        const path = isDraft ? '/draft' : '';
        const endpoint = getApiEndpoint(path);
        
        try {
            const response = await fetch(endpoint, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('[AWSCleaningManualAPI] Save error:', error);
            throw error;
        }
    }
    
    /**
     * 下書きデータを取得
     */
    async function loadDraft() {
        return await loadData(true);
    }
    
    /**
     * 下書きデータを保存
     */
    async function saveDraft(data) {
        return await saveData(data, true);
    }
    
    /**
     * 下書きを確定版に保存
     */
    async function publishDraft(draftData) {
        // 下書きデータを確定版として保存
        return await saveData(draftData, false);
    }
    
    // グローバルに公開
    window.AWSCleaningManualAPI = {
        loadData,
        saveData,
        loadDraft,
        saveDraft,
        publishDraft,
        isAvailable: () => true, // 常に利用可能
        getApiEndpoint: () => API_GATEWAY_ENDPOINT
    };
    
    console.log('[AWSCleaningManualAPI] Initialized');
})();

