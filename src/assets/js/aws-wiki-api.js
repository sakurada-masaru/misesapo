/**
 * WIKI管理 - AWS API統合
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
            // 開発サーバーの場合はローカルAPIを使用
            return `/api/wiki${path}`;
        }
        // 本番環境ではAPI Gatewayを使用
        return `${API_GATEWAY_ENDPOINT}/wiki${path}`;
    }
    
    /**
     * WIKIデータを取得
     */
    async function loadData() {
        const endpoint = getApiEndpoint();
        
        console.log('[AWSWikiAPI] Loading data from:', endpoint);
        
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
            console.log('[AWSWikiAPI] Data loaded successfully');
            return data;
        } catch (error) {
            console.error('[AWSWikiAPI] Load error:', error);
            
            // 開発サーバーの場合、フォールバックを試す
            if (isDevelopmentServer()) {
                console.log('[AWSWikiAPI] Trying fallback to static JSON file...');
                try {
                    const fallbackResponse = await fetch('/data/wiki_entries.json');
                    if (fallbackResponse.ok) {
                        const fallbackData = await fallbackResponse.json();
                        console.log('[AWSWikiAPI] Fallback data loaded');
                        return fallbackData;
                    }
                } catch (fallbackError) {
                    console.error('[AWSWikiAPI] Fallback error:', fallbackError);
                }
            }
            
            // 初期データを返す
            console.warn('[AWSWikiAPI] Returning empty data');
            return {
                entries: [],
                categories: []
            };
        }
    }
    
    /**
     * WIKIデータを保存
     */
    async function saveData(data) {
        const endpoint = getApiEndpoint();
        
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
            console.log('[AWSWikiAPI] Data saved successfully');
            return result;
        } catch (error) {
            console.error('[AWSWikiAPI] Save error:', error);
            throw error;
        }
    }
    
    // グローバルに公開
    window.AWSWikiAPI = {
        loadData,
        saveData,
        isAvailable: () => true,
        getApiEndpoint: () => API_GATEWAY_ENDPOINT
    };
    
    console.log('[AWSWikiAPI] Initialized');
})();

