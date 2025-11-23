/**
 * サービス管理 - AWS API統合
 * AWS Lambda + API Gateway + S3/DynamoDBを使用
 */

(function() {
    'use strict';
    
    // API Gatewayエンドポイント（サービス管理用）
    // 清掃マニュアルと同じAPI Gatewayを使用
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
            return `/api/services${path}`;
        }
        // 本番環境ではAPI Gatewayを使用
        return `${API_GATEWAY_ENDPOINT}/services${path}`;
    }
    
    /**
     * サービス一覧を取得
     */
    async function loadServices() {
        const endpoint = getApiEndpoint('');
        
        console.log('[AWSServicesAPI] Loading services from:', endpoint, '(isDevelopmentServer:', isDevelopmentServer(), ')');
        
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
            console.log('[AWSServicesAPI] Services loaded successfully:', data);
            return data;
        } catch (error) {
            console.error('[AWSServicesAPI] Load error:', error);
            
            // 開発サーバーの場合、フォールバックを試す
            if (isDevelopmentServer()) {
                console.log('[AWSServicesAPI] Trying fallback to static JSON file...');
                try {
                    const fallbackResponse = await fetch('/data/service_items.json');
                    if (fallbackResponse.ok) {
                        const fallbackData = await fallbackResponse.json();
                        console.log('[AWSServicesAPI] Fallback data loaded:', fallbackData);
                        return fallbackData;
                    }
                } catch (fallbackError) {
                    console.error('[AWSServicesAPI] Fallback error:', fallbackError);
                }
            }
            
            // 空の配列を返す
            console.warn('[AWSServicesAPI] Returning empty array');
            return [];
        }
    }
    
    /**
     * サービスを取得（ID指定）
     */
    async function getService(serviceId) {
        const endpoint = getApiEndpoint(`/${serviceId}`);
        
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
            return data;
        } catch (error) {
            console.error('[AWSServicesAPI] Get service error:', error);
            throw error;
        }
    }
    
    /**
     * サービスを作成
     */
    async function createService(serviceData) {
        const endpoint = getApiEndpoint('');
        
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(serviceData)
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('[AWSServicesAPI] Create service error:', error);
            throw error;
        }
    }
    
    /**
     * サービスを更新
     */
    async function updateService(serviceId, serviceData) {
        const endpoint = getApiEndpoint(`/${serviceId}`);
        
        try {
            const response = await fetch(endpoint, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(serviceData)
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('[AWSServicesAPI] Update service error:', error);
            throw error;
        }
    }
    
    /**
     * サービスを削除
     */
    async function deleteService(serviceId) {
        const endpoint = getApiEndpoint(`/${serviceId}`);
        
        try {
            const response = await fetch(endpoint, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('[AWSServicesAPI] Delete service error:', error);
            throw error;
        }
    }
    
    // グローバルに公開
    window.AWSServicesAPI = {
        loadServices,
        getService,
        createService,
        updateService,
        deleteService,
        isAvailable: () => true, // 常に利用可能
        getApiEndpoint: () => API_GATEWAY_ENDPOINT
    };
    
    console.log('[AWSServicesAPI] Initialized');
})();


 * AWS Lambda + API Gateway + S3/DynamoDBを使用
 */

(function() {
    'use strict';
    
    // API Gatewayエンドポイント（サービス管理用）
    // 清掃マニュアルと同じAPI Gatewayを使用
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
            return `/api/services${path}`;
        }
        // 本番環境ではAPI Gatewayを使用
        return `${API_GATEWAY_ENDPOINT}/services${path}`;
    }
    
    /**
     * サービス一覧を取得
     */
    async function loadServices() {
        const endpoint = getApiEndpoint('');
        
        console.log('[AWSServicesAPI] Loading services from:', endpoint, '(isDevelopmentServer:', isDevelopmentServer(), ')');
        
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
            console.log('[AWSServicesAPI] Services loaded successfully:', data);
            return data;
        } catch (error) {
            console.error('[AWSServicesAPI] Load error:', error);
            
            // 開発サーバーの場合、フォールバックを試す
            if (isDevelopmentServer()) {
                console.log('[AWSServicesAPI] Trying fallback to static JSON file...');
                try {
                    const fallbackResponse = await fetch('/data/service_items.json');
                    if (fallbackResponse.ok) {
                        const fallbackData = await fallbackResponse.json();
                        console.log('[AWSServicesAPI] Fallback data loaded:', fallbackData);
                        return fallbackData;
                    }
                } catch (fallbackError) {
                    console.error('[AWSServicesAPI] Fallback error:', fallbackError);
                }
            }
            
            // 空の配列を返す
            console.warn('[AWSServicesAPI] Returning empty array');
            return [];
        }
    }
    
    /**
     * サービスを取得（ID指定）
     */
    async function getService(serviceId) {
        const endpoint = getApiEndpoint(`/${serviceId}`);
        
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
            return data;
        } catch (error) {
            console.error('[AWSServicesAPI] Get service error:', error);
            throw error;
        }
    }
    
    /**
     * サービスを作成
     */
    async function createService(serviceData) {
        const endpoint = getApiEndpoint('');
        
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(serviceData)
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('[AWSServicesAPI] Create service error:', error);
            throw error;
        }
    }
    
    /**
     * サービスを更新
     */
    async function updateService(serviceId, serviceData) {
        const endpoint = getApiEndpoint(`/${serviceId}`);
        
        try {
            const response = await fetch(endpoint, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(serviceData)
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('[AWSServicesAPI] Update service error:', error);
            throw error;
        }
    }
    
    /**
     * サービスを削除
     */
    async function deleteService(serviceId) {
        const endpoint = getApiEndpoint(`/${serviceId}`);
        
        try {
            const response = await fetch(endpoint, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('[AWSServicesAPI] Delete service error:', error);
            throw error;
        }
    }
    
    // グローバルに公開
    window.AWSServicesAPI = {
        loadServices,
        getService,
        createService,
        updateService,
        deleteService,
        isAvailable: () => true, // 常に利用可能
        getApiEndpoint: () => API_GATEWAY_ENDPOINT
    };
    
    console.log('[AWSServicesAPI] Initialized');
})();

