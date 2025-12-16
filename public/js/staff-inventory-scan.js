// 清掃員在庫管理スキャン画面

const REPORT_API = 'https://2z0ui5xfxb.execute-api.ap-northeast-1.amazonaws.com/prod';
const ALLOWED_EMAIL_DOMAIN = '@misesapo.co.jp';

let cart = []; // カート内の商品
let html5QrCode = null;
let currentProduct = null;
let currentUser = null;

// 認証チェック（入庫/出庫時のみ実行）
function checkAuthentication() {
    const cognitoUser = localStorage.getItem('cognito_user');
    const authData = localStorage.getItem('misesapo_auth');
    const cognitoIdToken = localStorage.getItem('cognito_id_token');
    
    // 認証情報がない場合はログインページにリダイレクト
    if (!cognitoUser && !authData && !cognitoIdToken) {
        alert('入庫/出庫を行うにはログインが必要です。\nLogin is required to process inventory transactions.');
        redirectToLogin();
        return false;
    }
    
    try {
        // ユーザー情報を取得
        let user = null;
        if (cognitoUser) {
            user = JSON.parse(cognitoUser);
        } else if (authData) {
            const parsed = JSON.parse(authData);
            user = parsed.user || parsed;
        }
        
        // ユーザー情報がなくてもトークンがあればOK
        if (!user && cognitoIdToken) {
            currentUser = { email: 'unknown@misesapo.co.jp' };
            return true;
        }
        
        if (!user || !user.email) {
            alert('ユーザー情報が見つかりません。再度ログインしてください。\nUser information not found. Please login again.');
            redirectToLogin();
            return false;
        }
        
        // @misesapo.co.jp のメールアドレスかチェック
        if (!user.email.endsWith(ALLOWED_EMAIL_DOMAIN)) {
            alert('この操作は従業員専用です。\nThis operation is for employees only.\n\n@misesapo.co.jp のアカウントでログインしてください。');
            redirectToLogin();
            return false;
        }
        
        currentUser = user;
        return true;
        
    } catch (e) {
        console.error('Error checking authentication:', e);
        // エラーでもトークンがあれば続行
        if (cognitoIdToken) {
            currentUser = { email: 'unknown@misesapo.co.jp' };
            return true;
        }
        alert('認証エラーが発生しました。再度ログインしてください。\nAuthentication error. Please login again.');
        redirectToLogin();
        return false;
    }
}

// ログインページにリダイレクト
function redirectToLogin() {
    const currentUrl = window.location.href;
    const loginUrl = '/staff/signin.html?redirect=' + encodeURIComponent(currentUrl);
    window.location.href = loginUrl;
}

// ID Token取得（認証済みユーザーから）
async function getFirebaseIdToken() {
    // Cognito ID Token（優先）
    const cognitoIdToken = localStorage.getItem('cognito_id_token');
    if (cognitoIdToken) {
        return cognitoIdToken;
    }
    
    // Cognito認証のユーザーオブジェクトからトークンを取得
    const cognitoUser = localStorage.getItem('cognito_user');
    if (cognitoUser) {
        try {
            const parsed = JSON.parse(cognitoUser);
            if (parsed.tokens && parsed.tokens.idToken) {
                return parsed.tokens.idToken;
            }
            if (parsed.idToken) {
                return parsed.idToken;
            }
        } catch (e) {
            console.error('Error parsing cognito user:', e);
        }
    }
    
    // misesapo_auth から取得
    const authData = localStorage.getItem('misesapo_auth');
    if (authData) {
        try {
            const parsed = JSON.parse(authData);
            if (parsed.token) {
                return parsed.token;
            }
        } catch (e) {
            console.error('Error parsing auth data:', e);
        }
    }
    
    // 認証情報がない場合はログインページにリダイレクト
    redirectToLogin();
    return null;
}

// 商品情報を取得
async function loadProduct(productId) {
    try {
        const idToken = await getFirebaseIdToken();
        
        console.log('[Load Product] Fetching product:', productId);
        console.log('[Load Product] Token available:', idToken !== null && idToken !== 'dev-token');
        
        const response = await fetch(`${REPORT_API}/staff/inventory/items`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('[Load Product] Response status:', response.status);
        console.log('[Load Product] Response ok:', response.ok);
        
        if (!response.ok) {
            let errorMessage = `商品情報の取得に失敗しました (HTTP ${response.status})`;
            try {
                const errorText = await response.text();
                console.error('[Load Product] Error response text:', errorText);
                if (errorText) {
                    const errorData = JSON.parse(errorText);
                    errorMessage = errorData.message || errorData.error || errorMessage;
                }
            } catch (e) {
                console.error('[Load Product] Error parsing error response:', e);
            }
            throw new Error(errorMessage);
        }
        
        const responseText = await response.text();
        console.log('[Load Product] Response text length:', responseText.length);
        
        if (!responseText || responseText.trim() === '') {
            throw new Error('空のレスポンスが返されました');
        }
        
        const data = JSON.parse(responseText);
        console.log('[Load Product] Parsed data:', data);
        
        const items = data.items || [];
        const product = items.find(item => item.product_id === productId);
        
        if (!product) {
            throw new Error('商品が見つかりませんでした');
        }
        
        return product;
    } catch (error) {
        console.error('[Load Product] Error loading product:', error);
        console.error('[Load Product] Error name:', error.name);
        console.error('[Load Product] Error message:', error.message);
        console.error('[Load Product] Error stack:', error.stack);
        
        // ネットワークエラーの場合
        if (error.name === 'TypeError' && (error.message.includes('fetch') || error.message.includes('Failed to fetch'))) {
            throw new Error('ネットワークエラー: サーバーに接続できませんでした。インターネット接続を確認してください。');
        }
        
        throw error;
    }
}

// 商品情報を表示
function showProduct(product) {
    currentProduct = product;
    
    document.getElementById('product-name').textContent = product.name;
    document.getElementById('product-id').textContent = product.product_id;
    document.getElementById('product-stock').textContent = `${product.stock.toLocaleString()} 個`;
    document.getElementById('quantity-input').value = '1';
    
    document.getElementById('product-info-section').style.display = 'block';
    document.getElementById('scan-area').style.display = 'none';
}

// 商品情報を非表示
function hideProduct() {
    currentProduct = null;
    document.getElementById('product-info-section').style.display = 'none';
    document.getElementById('scan-area').style.display = 'block';
    stopScan();
}

// カートを更新
function updateCart() {
    const cartItems = document.getElementById('cart-items');
    const cartBadge = document.getElementById('cart-badge');
    const cartSection = document.getElementById('cart-section');
    const cartTotalCount = document.getElementById('cart-total-count');
    
    if (cart.length === 0) {
        cartItems.innerHTML = '<p style="text-align: center; color: #6b7280; padding: 40px;">カートは空です</p>';
        cartBadge.style.display = 'none';
        cartSection.style.display = 'none';
    } else {
        cartBadge.textContent = cart.length;
        cartBadge.style.display = 'inline-block';
        
        cartItems.innerHTML = cart.map((item, index) => `
            <div class="cart-item">
                <div class="cart-item-info">
                    <div class="cart-item-name">${escapeHtml(item.name)}</div>
                    <div class="cart-item-id">${escapeHtml(item.product_id)}</div>
                </div>
                <div style="display: flex; align-items: center;">
                    <span class="cart-item-quantity">${item.quantity}個</span>
                    <button type="button" class="btn-remove-item" onclick="removeFromCart(${index})">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
        const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
        cartTotalCount.textContent = totalCount;
    }
}

// 直接入庫/出庫処理
async function processStock(mode) {
    // 入庫/出庫前に認証チェック
    if (!checkAuthentication()) {
        return; // 認証失敗時は処理を中断（リダイレクト済み）
    }
    
    if (!currentProduct) {
        alert('商品が選択されていません');
        return;
    }
    
    const quantity = parseInt(document.getElementById('quantity-input').value, 10);
    if (isNaN(quantity) || quantity <= 0) {
        alert('数量を正しく入力してください');
        return;
    }
    
    const actionTextJa = mode === 'in' ? '入庫' : '出庫';
    const actionTextEn = mode === 'in' ? 'Stock In' : 'Stock Out';
    
    const confirmMessage = `
━━━━━━━━━━━━━━━━━
${actionTextJa}しますか？
${actionTextEn}?
━━━━━━━━━━━━━━━━━

📦 ${currentProduct.name}
📊 数量: ${quantity}個
    `.trim();
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    try {
        const idToken = await getFirebaseIdToken();
        const response = await fetch(`${REPORT_API}/staff/inventory/${mode}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
                items: [{
                    product_id: currentProduct.product_id,
                    quantity: quantity
                }]
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `${actionTextJa}に失敗しました`);
        }
        
        const result = await response.json();
        
        if (result.errors && result.errors.length > 0) {
            alert('エラー:\n' + result.errors.join('\n'));
            return;
        }
        
        alert(`✅ ${actionTextJa}完了: ${currentProduct.name} ${quantity}個`);
        
        // 在庫情報を更新
        const updatedProduct = await loadProduct(currentProduct.product_id);
        showProduct(updatedProduct);
        
    } catch (error) {
        console.error('Error processing stock:', error);
        alert(`${actionTextJa}に失敗しました: ` + error.message);
    }
}

// カートに追加
function addToCart() {
    if (!currentProduct) return;
    
    const quantity = parseInt(document.getElementById('quantity-input').value, 10);
    if (isNaN(quantity) || quantity <= 0) {
        alert('数量を正しく入力してください');
        return;
    }
    
    // 既にカートにある場合は数量を更新
    const existingIndex = cart.findIndex(item => item.product_id === currentProduct.product_id);
    if (existingIndex >= 0) {
        cart[existingIndex].quantity += quantity;
    } else {
        cart.push({
            product_id: currentProduct.product_id,
            name: currentProduct.name,
            quantity: quantity
        });
    }
    
    updateCart();
    hideProduct();
    alert('カートに追加しました');
}

// カートから削除
function removeFromCart(index) {
    cart.splice(index, 1);
    updateCart();
}

// カートをクリア
function clearCart() {
    if (confirm('カートをクリアしますか？')) {
        cart = [];
        updateCart();
    }
}

// カートを一括処理
async function processCart() {
    if (cart.length === 0) {
        alert('カートが空です');
        return;
    }
    
    // 処理モードを選択
    const modeDialog = document.getElementById('process-mode-dialog');
    modeDialog.classList.add('active');
    
    // モード選択ボタンのイベント
    const modeButtons = document.querySelectorAll('.btn-mode');
    modeButtons.forEach(btn => {
        btn.onclick = async () => {
            const mode = btn.dataset.mode;
            modeDialog.classList.remove('active');
            
            await executeCartProcess(mode);
        };
    });
}

// カートを処理実行
async function executeCartProcess(mode) {
    try {
        const idToken = await getFirebaseIdToken();
        const response = await fetch(`${REPORT_API}/staff/inventory/${mode}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
                items: cart.map(item => ({
                    product_id: item.product_id,
                    quantity: item.quantity
                }))
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || '在庫更新に失敗しました');
        }
        
        const result = await response.json();
        
        if (result.errors && result.errors.length > 0) {
            alert('エラー:\n' + result.errors.join('\n'));
            return;
        }
        
        if (result.results && result.results.length > 0) {
            const successCount = result.results.length;
            alert(`✅ ${mode === 'in' ? '入庫' : '出庫'}成功: ${successCount}商品を処理しました`);
            cart = [];
            updateCart();
        }
        
    } catch (error) {
        console.error('Error processing cart:', error);
        alert('在庫更新に失敗しました: ' + error.message);
    }
}

// QRコードスキャンを開始
async function startScan() {
    try {
        const reader = document.getElementById('reader');
        const placeholder = document.querySelector('.scan-placeholder');
        
        reader.style.display = 'block';
        placeholder.style.display = 'none';
        
        html5QrCode = new Html5Qrcode("reader");
        
        await html5QrCode.start(
            { facingMode: "environment" },
            {
                fps: 10,
                qrbox: { width: 250, height: 250 }
            },
            async (decodedText, decodedResult) => {
                // QRコードが読み取られた
                await handleScannedCode(decodedText);
                stopScan();
            },
            (errorMessage) => {
                // エラーは無視（継続スキャン）
            }
        );
    } catch (error) {
        console.error('Error starting scan:', error);
        // スキャンエリアを元に戻す
        const reader = document.getElementById('reader');
        const placeholder = document.querySelector('.scan-placeholder');
        reader.style.display = 'none';
        placeholder.style.display = 'block';
        
        // エラーメッセージを表示
        showScanError('カメラを起動できませんでした。商品IDを手入力してください。');
    }
}

// スキャンエラーを表示
function showScanError(message) {
    const placeholder = document.querySelector('.scan-placeholder');
    const errorDiv = document.getElementById('scan-error');
    
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    } else {
        // エラー表示用のdivを作成
        const newErrorDiv = document.createElement('div');
        newErrorDiv.id = 'scan-error';
        newErrorDiv.className = 'scan-error-message';
        newErrorDiv.textContent = message;
        placeholder.insertBefore(newErrorDiv, placeholder.firstChild);
    }
}

// QRコードスキャンを停止
function stopScan() {
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
            html5QrCode.clear();
            html5QrCode = null;
        }).catch(err => {
            console.error('Error stopping scan:', err);
        });
    }
    
    const reader = document.getElementById('reader');
    if (reader) {
        reader.style.display = 'none';
    }
    const placeholder = document.querySelector('.scan-placeholder');
    if (placeholder) {
        placeholder.style.display = 'block';
    }
}

// スキャンされたコードを処理
async function handleScannedCode(code) {
    try {
        // URLから商品IDを抽出
        let productId = code;
        if (code.includes('product_id=')) {
            const url = new URL(code);
            productId = url.searchParams.get('product_id');
        }
        
        if (!productId) {
            alert('商品IDが取得できませんでした');
            return;
        }
        
        const product = await loadProduct(productId);
        showProduct(product);
        
    } catch (error) {
        alert('エラー: ' + error.message);
    }
}

// HTMLエスケープ
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// NFCタグ情報を取得
async function getNfcTagInfo(tagId) {
    try {
        // tagIdの前後のスペースを削除
        const cleanTagId = tagId.trim();
        console.log('[NFC Tag Info] Fetching tag info for:', cleanTagId);
        
        const response = await fetch(`${REPORT_API}/staff/nfc/tag?tag_id=${encodeURIComponent(cleanTagId)}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('[NFC Tag Info] Response status:', response.status);
        console.log('[NFC Tag Info] Response ok:', response.ok);
        
        if (!response.ok) {
            let errorMessage = `NFCタグ情報の取得に失敗しました (HTTP ${response.status})`;
            try {
                const errorText = await response.text();
                console.error('[NFC Tag Info] Error response text:', errorText);
                if (errorText) {
                    const errorData = JSON.parse(errorText);
                    errorMessage = errorData.message || errorData.error || errorMessage;
                }
            } catch (e) {
                console.error('[NFC Tag Info] Error parsing error response:', e);
            }
            throw new Error(errorMessage);
        }
        
        const responseText = await response.text();
        console.log('[NFC Tag Info] Response text:', responseText);
        
        if (!responseText || responseText.trim() === '') {
            throw new Error('空のレスポンスが返されました');
        }
        
        const data = JSON.parse(responseText);
        console.log('[NFC Tag Info] Parsed data:', data);
        return data;
    } catch (error) {
        console.error('[NFC Tag Info] Error loading NFC tag info:', error);
        console.error('[NFC Tag Info] Error name:', error.name);
        console.error('[NFC Tag Info] Error message:', error.message);
        console.error('[NFC Tag Info] Error stack:', error.stack);
        
        // ネットワークエラーの場合
        if (error.name === 'TypeError' && (error.message.includes('fetch') || error.message.includes('Failed to fetch'))) {
            throw new Error('ネットワークエラー: サーバーに接続できませんでした。インターネット接続を確認してください。');
        }
        
        throw error;
    }
}

// NFCタグから商品情報を取得して表示
async function handleNfcTag(tagId) {
    try {
        // NFCタグ情報を取得
        const tagInfo = await getNfcTagInfo(tagId);
        
        // デバッグ: レスポンス全体をログに出力
        console.log('[NFC Tag Info] Full response:', tagInfo);
        
        // レスポンスの構造を確認（statusフィールドがある場合）
        let productId = null;
        if (tagInfo.status === 'success') {
            productId = tagInfo.product_id;
        } else if (tagInfo.product_id) {
            productId = tagInfo.product_id;
        }
        
        console.log('[NFC Tag Info] Extracted product_id:', productId);
        
        // product_idが存在する場合
        if (productId) {
            try {
                const product = await loadProduct(productId);
                showProduct(product);
                
                // トースト通知を表示
                showToast(`NFCタグを読み取りました: ${tagInfo.description || tagInfo.location_name || tagId}`, 'success');
            } catch (productError) {
                console.error('[NFC Tag Info] Error loading product:', productError);
                showToast(`商品情報の読み込みに失敗しました: ${productError.message}`, 'error');
            }
        } else {
            // product_idが存在しない場合はエラー
            console.error('[NFC Tag Info] No product_id found. Response:', tagInfo);
            showToast('このNFCタグは在庫管理用に設定されていません。\n商品IDが登録されていないタグです。', 'error');
        }
    } catch (error) {
        console.error('[NFC Tag Info] Error handling NFC tag:', error);
        console.error('[NFC Tag Info] Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        showToast(`NFCタグの処理に失敗しました: ${error.message}`, 'error');
    }
}

// トースト通知を表示
function showToast(message, type = 'info') {
    // 既存のトーストがあれば削除
    const existingToast = document.getElementById('toast-notification');
    if (existingToast) {
        existingToast.remove();
    }
    
    // トースト要素を作成
    const toast = document.createElement('div');
    toast.id = 'toast-notification';
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 10000;
        font-size: 14px;
        max-width: 90%;
        text-align: center;
    `;
    
    document.body.appendChild(toast);
    
    // 3秒後に自動削除
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// URLパラメータから商品IDまたはNFCタグIDを取得して自動表示
async function checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('product_id')?.trim();
    const nfcTagId = urlParams.get('nfc_tag_id')?.trim();
    
    // NFCタグIDが指定されている場合（優先）
    if (nfcTagId) {
        await handleNfcTag(nfcTagId);
        return;
    }
    
    // 商品IDが指定されている場合
    if (productId) {
        try {
            const product = await loadProduct(productId);
            showProduct(product);
        } catch (error) {
            console.error('Error loading product from URL:', error);
            alert('商品情報の読み込みに失敗しました: ' + error.message);
        }
    }
}

// イベントリスナーの設定
document.addEventListener('DOMContentLoaded', function() {
    // URLパラメータをチェック（認証なしで商品情報を表示可能）
    checkUrlParams();
    
    // スキャン開始ボタン
    document.getElementById('btn-start-scan').addEventListener('click', startScan);
    
    // 手入力ボタン
    document.getElementById('btn-manual-input').addEventListener('click', () => {
        document.getElementById('manual-input-dialog').classList.add('active');
        document.getElementById('manual-product-id').focus();
    });
    
    // 手入力モーダルを閉じる
    const btnCloseManual = document.getElementById('btn-close-manual');
    if (btnCloseManual) {
        btnCloseManual.addEventListener('click', () => {
            document.getElementById('manual-input-dialog').classList.remove('active');
        });
    }
    const btnCancelManual = document.getElementById('btn-cancel-manual');
    if (btnCancelManual) {
        btnCancelManual.addEventListener('click', () => {
            document.getElementById('manual-input-dialog').classList.remove('active');
        });
    }
    
    // 手入力確定ボタン
    document.getElementById('btn-submit-manual').addEventListener('click', async () => {
        const productId = document.getElementById('manual-product-id').value.trim();
        if (!productId) {
            alert('商品IDを入力してください');
            return;
        }
        
        document.getElementById('manual-input-dialog').classList.remove('active');
        
        try {
            const product = await loadProduct(productId);
            showProduct(product);
        } catch (error) {
            alert('エラー: ' + error.message);
        }
        
        document.getElementById('manual-product-id').value = '';
    });
    
    // 商品情報を閉じる
    document.getElementById('btn-close-product').addEventListener('click', hideProduct);
    
    // 入庫ボタン
    const btnStockIn = document.getElementById('btn-stock-in');
    if (btnStockIn) {
        btnStockIn.addEventListener('click', () => processStock('in'));
    }
    
    // 出庫ボタン
    const btnStockOut = document.getElementById('btn-stock-out');
    if (btnStockOut) {
        btnStockOut.addEventListener('click', () => processStock('out'));
    }
    
    // カートに追加（旧機能、互換性のため残す）
    const btnAddToCart = document.getElementById('btn-add-to-cart');
    if (btnAddToCart) {
        btnAddToCart.addEventListener('click', addToCart);
    }
    
    // 数量増減ボタン
    document.getElementById('btn-increase').addEventListener('click', () => {
        const input = document.getElementById('quantity-input');
        input.value = parseInt(input.value, 10) + 1;
    });
    
    document.getElementById('btn-decrease').addEventListener('click', () => {
        const input = document.getElementById('quantity-input');
        const value = parseInt(input.value, 10);
        if (value > 1) {
            input.value = value - 1;
        }
    });
    
    // カート表示
    document.getElementById('btn-cart').addEventListener('click', () => {
        if (cart.length > 0) {
            document.getElementById('cart-section').style.display = 'block';
        }
    });
    
    // カートを閉じる
    document.getElementById('btn-close-cart').addEventListener('click', () => {
        document.getElementById('cart-section').style.display = 'none';
    });
    
    // カートクリア
    document.getElementById('btn-clear-cart').addEventListener('click', clearCart);
    
    // カート一括処理
    document.getElementById('btn-process-cart').addEventListener('click', processCart);
    
    // Enterキーで手入力を確定
    document.getElementById('manual-product-id').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('btn-submit-manual').click();
        }
    });
    
    // 処理モードモーダルを閉じる
    const btnCloseMode = document.getElementById('btn-close-mode');
    if (btnCloseMode) {
        btnCloseMode.addEventListener('click', () => {
            document.getElementById('process-mode-dialog').classList.remove('active');
        });
    }
    const btnCancelMode = document.getElementById('btn-cancel-mode');
    if (btnCancelMode) {
        btnCancelMode.addEventListener('click', () => {
            document.getElementById('process-mode-dialog').classList.remove('active');
        });
    }
    
    // 初期化
    updateCart();
});

