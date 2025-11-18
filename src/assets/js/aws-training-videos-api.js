/**
 * 研修動画管理 - AWS API統合
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
            return `/api/training-videos${path}`;
        }
        // 本番環境ではAPI Gatewayを使用
        return `${API_GATEWAY_ENDPOINT}/training-videos${path}`;
    }
    
    /**
     * 動画データを取得
     */
    async function loadData() {
        const endpoint = getApiEndpoint();
        
        console.log('[AWSTrainingVideosAPI] Loading data from:', endpoint, '(isDevelopmentServer:', isDevelopmentServer(), ')');
        
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
            console.log('[AWSTrainingVideosAPI] Data loaded:', data);
            return data;
        } catch (error) {
            console.error('[AWSTrainingVideosAPI] Load error:', error);
            
            // フォールバック: 静的JSONファイルを読み込む
            console.log('[AWSTrainingVideosAPI] Trying fallback to static JSON file...');
            try {
                const fallbackResponse = await fetch('/data/training_videos.json');
                if (fallbackResponse.ok) {
                    const fallbackData = await fallbackResponse.json();
                    console.log('[AWSTrainingVideosAPI] Fallback data loaded');
                    return fallbackData;
                }
            } catch (fallbackError) {
                console.error('[AWSTrainingVideosAPI] Fallback also failed:', fallbackError);
            }
            
            // それでも失敗した場合は空のデータを返す
            console.log('[AWSTrainingVideosAPI] Returning empty data');
            return { categories: [] };
        }
    }
    
    /**
     * 動画データを保存
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
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('[AWSTrainingVideosAPI] Data saved:', result);
            return result;
        } catch (error) {
            console.error('[AWSTrainingVideosAPI] Save error:', error);
            throw error;
        }
    }
    
    // グローバルスコープに公開
    window.AWSTrainingVideosAPI = {
        loadData,
        saveData
    };
    
    console.log('[AWSTrainingVideosAPI] Initialized');
})();

