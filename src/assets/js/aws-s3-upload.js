/**
 * AWS S3への直接アップロード機能
 * 
 * 注意: セキュリティ上の理由から、AWS認証情報をクライアント側に直接埋め込むことはできません。
 * この実装では、開発サーバーまたはAPI GatewayのAPIエンドポイント経由でS3にアップロードします。
 * 
 * - ローカル開発環境: 開発サーバーのAPIエンドポイントを使用
 * - GitHub Pages環境: API Gatewayのエンドポイントを使用
 */

(function() {
    'use strict';
    
    // API GatewayのエンドポイントURL
    // このURLは、API Gatewayのデプロイ時に取得した「呼び出しURL」に置き換えてください
    // 例: 'https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/prod'
    let API_GATEWAY_ENDPOINT = null; // TODO: API GatewayのエンドポイントURLを設定してください
    
    /**
     * APIエンドポイントを取得
     */
    function getApiEndpoint() {
        // 開発サーバーが利用可能な場合は、開発サーバーのエンドポイントを使用
        const hostname = window.location.hostname;
        const isLocalDev = hostname === 'localhost' || hostname === '127.0.0.1';
        
        if (isLocalDev) {
            return {
                url: `${window.location.protocol}//${window.location.host}`,
                type: 'dev-server' // 開発サーバー
            };
        }
        
        // GitHub Pages環境の場合、API Gatewayのエンドポイントを使用
        if (API_GATEWAY_ENDPOINT) {
            return {
                url: API_GATEWAY_ENDPOINT,
                type: 'api-gateway' // API Gateway
            };
        }
        
        return null;
    }
    
    /**
     * ファイルをbase64エンコード
     */
    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                // data:image/jpeg;base64,xxxxx の形式から base64部分だけを取得
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
    
    /**
     * S3に画像をアップロード（開発サーバーまたはAPI Gateway経由）
     */
    async function uploadToS3(file, fieldName) {
        const endpoint = getApiEndpoint();
        
        if (!endpoint) {
            throw new Error('S3へのアップロードには開発サーバーまたはAPI Gatewayが必要です。\n' +
                          'API Gatewayのエンドポイントを設定するか、localhostで開発サーバーを起動してください。');
        }
        
        // 開発サーバーの場合（multipart/form-data）
        if (endpoint.type === 'dev-server') {
            const formData = new FormData();
            formData.append('image', file);
            
            const response = await fetch(`${endpoint.url}/api/cleaning-manual/upload-image`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`S3アップロードエラー: ${errorText}`);
            }
            
            const result = await response.json();
            return {
                url: result.url || result.path,
                path: result.path || result.url
            };
        }
        
        // API Gatewayの場合（base64エンコードしてJSONで送信）
        if (endpoint.type === 'api-gateway') {
            try {
                // ファイルをbase64エンコード
                const base64Data = await fileToBase64(file);
                
                // API Gateway経由でアップロード
                const response = await fetch(`${endpoint.url}/upload`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        image: base64Data,
                        fileName: file.name,
                        contentType: file.type || 'image/jpeg'
                    })
                });
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                    throw new Error(`S3アップロードエラー: ${errorData.message || errorData.error || 'Unknown error'}`);
                }
                
                const result = await response.json();
                return {
                    url: result.url || result.path,
                    path: result.path || result.url
                };
            } catch (error) {
                console.error('[AWSS3Upload] Upload error:', error);
                throw error;
            }
        }
        
        throw new Error('Unknown endpoint type');
    }
    
    /**
     * 画像をS3にアップロード（公開関数）
     */
    window.AWSS3Upload = {
        uploadImage: uploadToS3,
        isAvailable: function() {
            return getApiEndpoint() !== null;
        },
        setApiGatewayEndpoint: function(endpoint) {
            // 動的にAPI Gatewayのエンドポイントを設定する場合に使用
            if (typeof endpoint === 'string' && endpoint.startsWith('http')) {
                API_GATEWAY_ENDPOINT = endpoint;
                return true;
            }
            return false;
        },
        getApiGatewayEndpoint: function() {
            return API_GATEWAY_ENDPOINT;
        }
    };
})();

