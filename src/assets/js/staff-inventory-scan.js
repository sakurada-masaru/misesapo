// 清掃員在庫管理スキャン画面

const REPORT_API = 'https://2z0ui5xfxb.execute-api.ap-northeast-1.amazonaws.com/prod';

let cart = []; // カート内の商品
let html5QrCode = null;
let currentProduct = null;

// Firebase ID Token取得
async function getFirebaseIdToken() {
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
    return 'mock-token';
}

// 商品情報を取得
async function loadProduct(productId) {
    try {
        const idToken = await getFirebaseIdToken();
        const response = await fetch(`${REPORT_API}/staff/inventory/items`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${idToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('商品情報の取得に失敗しました');
        }
        
        const data = await response.json();
        const items = data.items || [];
        const product = items.find(item => item.product_id === productId);
        
        if (!product) {
            throw new Error('商品が見つかりませんでした');
        }
        
        return product;
    } catch (error) {
        console.error('Error loading product:', error);
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

// URLパラメータから商品IDを取得して自動表示
async function checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const productId = urlParams.get('product_id');
    
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
    // URLパラメータをチェック
    checkUrlParams();
    
    // スキャン開始ボタン
    document.getElementById('btn-start-scan').addEventListener('click', startScan);
    
    // 手入力ボタン
    document.getElementById('btn-manual-input').addEventListener('click', () => {
        document.getElementById('manual-input-dialog').classList.add('active');
        document.getElementById('manual-product-id').focus();
    });
    
    // 手入力モーダルを閉じる
    document.getElementById('btn-close-manual').addEventListener('click', () => {
        document.getElementById('manual-input-dialog').classList.remove('active');
    });
    document.getElementById('btn-cancel-manual').addEventListener('click', () => {
        document.getElementById('manual-input-dialog').classList.remove('active');
    });
    
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
    
    // カートに追加
    document.getElementById('btn-add-to-cart').addEventListener('click', addToCart);
    
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
    document.getElementById('btn-close-mode').addEventListener('click', () => {
        document.getElementById('process-mode-dialog').classList.remove('active');
    });
    document.getElementById('btn-cancel-mode').addEventListener('click', () => {
        document.getElementById('process-mode-dialog').classList.remove('active');
    });
    
    // 初期化
    updateCart();
});

