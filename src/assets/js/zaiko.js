// --- 在庫管理 JavaScript ---

const REPORT_API = 'https://2z0ui5xfxb.execute-api.ap-northeast-1.amazonaws.com/prod';
const BASE_URL = window.location.origin;

let inventoryData = []; // DynamoDBから取得したデータ
let modalCurrentMode = 'out'; // モーダル内のモード
let currentProductId = null; // 現在選択中の商品ID

// DOM要素の取得
const inventoryGrid = document.getElementById('inventory-grid');
const loadingSpinner = document.getElementById('loading-spinner');

// Firebase ID Token取得（簡易版）
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
    
    // トークンが見つからない場合はエラー
    console.error('No authentication token found');
    return null;
}

// 在庫一覧を取得
async function loadInventory() {
    if (loadingSpinner) loadingSpinner.style.display = 'block';
    
    try {
        const idToken = await getFirebaseIdToken();
        const response = await fetch(`${REPORT_API}/staff/inventory/items`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${idToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('在庫一覧の取得に失敗しました');
        }
        
        const data = await response.json();
        inventoryData = (data.items || []).map(item => ({
            id: item.product_id,
            product_id: item.product_id,
            name: item.name,
            stock: item.stock || 0,
            minStock: item.minStock || 50,
            safeStock: item.safeStock || 100,
            status: item.status
        }));
        
        renderInventory();
    } catch (error) {
        console.error('Error loading inventory:', error);
        alert('在庫一覧の読み込みに失敗しました: ' + error.message);
    } finally {
        if (loadingSpinner) loadingSpinner.style.display = 'none';
    }
}

// 4. 在庫ステータスの判定
function getStockStatus(item) {
    const safeStock = item.safeStock || 100;
    const minStock = item.minStock || 50;
    
    if (item.stock >= safeStock) {
        return 'safe'; // 緑：安全
    } else if (item.stock >= minStock) {
        return 'warning'; // 黄色：注意
    } else {
        return 'danger'; // 赤：危険
    }
}

// 5. 在庫カードの描画
function renderInventory() {
    if (!inventoryGrid) return;
    
    inventoryGrid.innerHTML = ''; // 一旦クリア
    
    inventoryData.forEach(item => {
        const status = getStockStatus(item);
        const statusClass = `stock-${status}`;
        const statusIcon = status === 'safe' ? '✓' : status === 'warning' ? '⚠' : '✗';
        
        const card = document.createElement('div');
        card.className = `inventory-card ${statusClass}`;
        card.dataset.productId = item.id;
        
        const productId = item.product_id || item.id;
        card.innerHTML = `
            <div class="card-icon">
                <i class="fas fa-box"></i>
            </div>
            <div class="card-content">
                <div class="card-name">${escapeHtml(item.name)}</div>
                <div class="card-id">${escapeHtml(productId)}</div>
                <div class="card-stock">
                    <span class="stock-number">${item.stock.toLocaleString()}</span>
                    <span class="stock-unit">個</span>
                </div>
                <div class="card-status">
                    <span class="status-badge ${statusClass}">${statusIcon}</span>
                </div>
            </div>
        `;
        
        // カードクリックでモーダルを開く
        card.addEventListener('click', () => {
            openProductDetail(productId);
        });
        
        inventoryGrid.appendChild(card);
    });
}

// 商品詳細モーダルを開く
async function openProductDetail(productId) {
    const item = inventoryData.find(i => i.id === productId || i.product_id === productId);
    if (!item) return;
    
    currentProductId = item.product_id || item.id;
    modalCurrentMode = 'out';
    
    // モーダルに情報を設定
    document.getElementById('modal-product-name').textContent = item.name;
    document.getElementById('modal-product-id').textContent = currentProductId;
    document.getElementById('modal-product-name-text').textContent = item.name;
    document.getElementById('modal-product-stock').textContent = `${item.stock.toLocaleString()} 個`;
    
    // 商品名編集フォームをリセット
    const editNameForm = document.getElementById('edit-name-form');
    const editNameInput = document.getElementById('edit-name-input');
    if (editNameForm) editNameForm.style.display = 'none';
    if (editNameInput) editNameInput.value = item.name;
    
    // 最終入出庫情報を初期化
    document.getElementById('last-in-info').textContent = '読み込み中...';
    document.getElementById('last-out-info').textContent = '読み込み中...';
        
    // 最終入出庫情報を取得
    loadLastTransactions(currentProductId);
    
    // QRコードを生成
    const qrContainer = document.getElementById('modal-product-qrcode');
    if (qrContainer) {
        qrContainer.innerHTML = ''; // 既存のQRコードをクリア
        
        const qrUrl = `${BASE_URL}/staff/inventory/scan?product_id=${currentProductId}`;
        if (typeof QRCode !== 'undefined') {
            try {
                new QRCode(qrContainer, {
                    text: qrUrl,
                    width: 200,
                    height: 200,
                    colorDark: '#000000',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.H
                });
            } catch (error) {
                console.error('Error generating QR code:', error);
                qrContainer.innerHTML = '<div style="color: #dc2626; font-size: 0.9rem;">QRコードの生成に失敗しました</div>';
            }
        } else {
            qrContainer.innerHTML = '<div style="color: #dc2626; font-size: 0.9rem;">QRコードライブラリが読み込まれていません</div>';
        }
    }
    
    // モーダル内のモードボタンをリセット
    const modalModeIn = document.getElementById('modal-mode-in');
    const modalModeOut = document.getElementById('modal-mode-out');
    const modalProcessBtn = document.getElementById('modal-process-button');
    
    modalModeIn.className = 'inactive';
    modalModeOut.className = 'active';
    modalProcessBtn.textContent = '出庫処理を実行';
    modalProcessBtn.style.backgroundColor = '#dc3545';
    
    // 数量をリセット
    document.getElementById('modal-quantity').value = '1';
    
    // モーダルを表示
    document.getElementById('product-detail-dialog').showModal();
}

// HTMLエスケープ関数
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// 最終入出庫情報を取得
async function loadLastTransactions(productId) {
    try {
        const idToken = await getFirebaseIdToken();
        const response = await fetch(`${REPORT_API}/admin/inventory/transactions?product_id=${productId}&limit=20`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${idToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('トランザクション取得に失敗');
        }
        
        const data = await response.json();
        const transactions = data.transactions || [];
        
        // 最新の入庫と出庫を探す
        let lastIn = null;
        let lastOut = null;
        
        for (const tx of transactions) {
            if (tx.type === 'in' && !lastIn) {
                lastIn = tx;
            } else if (tx.type === 'out' && !lastOut) {
                lastOut = tx;
            }
            if (lastIn && lastOut) break;
        }
        
        // 表示を更新
        const lastInEl = document.getElementById('last-in-info');
        const lastOutEl = document.getElementById('last-out-info');
        
        if (lastIn) {
            const date = formatTransactionDate(lastIn.created_at);
            lastInEl.innerHTML = `${escapeHtml(lastIn.staff_name || '不明')} <span style="color: #6b7280; font-weight: normal;">(${date})</span>`;
        } else {
            lastInEl.textContent = '履歴なし';
        }
        
        if (lastOut) {
            const date = formatTransactionDate(lastOut.created_at);
            lastOutEl.innerHTML = `${escapeHtml(lastOut.staff_name || '不明')} <span style="color: #6b7280; font-weight: normal;">(${date})</span>`;
        } else {
            lastOutEl.textContent = '履歴なし';
        }
        
    } catch (error) {
        console.error('Error loading transactions:', error);
        document.getElementById('last-in-info').textContent = '-';
        document.getElementById('last-out-info').textContent = '-';
    }
}

// トランザクション日時をフォーマット
function formatTransactionDate(dateString) {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${month}/${day} ${hours}:${minutes}`;
    } catch (e) {
        return dateString;
    }
}

// モーダル内での在庫更新処理
async function processModalTransaction() {
    if (!currentProductId) return;
    
    const quantity = parseInt(document.getElementById('modal-quantity').value, 10);
    const item = inventoryData.find(i => (i.id === currentProductId || i.product_id === currentProductId));
    
    if (!item) {
        alert('商品が見つかりませんでした');
        return;
    }

    // 入力チェック
    if (isNaN(quantity) || quantity <= 0) {
        alert('数量（1以上の数値）を正しく入力してください。');
        return;
    }

    try {
        const idToken = await getFirebaseIdToken();
        const endpoint = modalCurrentMode === 'in' ? '/staff/inventory/in' : '/staff/inventory/out';
        
        const response = await fetch(`${REPORT_API}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
                product_id: currentProductId,
                quantity: quantity
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || '在庫更新に失敗しました');
        }
        
        const result = await response.json();
        
        if (result.errors && result.errors.length > 0) {
            alert('エラー: ' + result.errors.join('\n'));
            return;
        }
        
        if (result.results && result.results.length > 0) {
            const res = result.results[0];
            alert(`✅ ${modalCurrentMode === 'in' ? '入庫' : '出庫'}成功: ${res.product_name} ${quantity}個。現在の在庫: ${res.stock_after}`);
    }

    // UIを更新
        await loadInventory();
        openProductDetail(currentProductId); // モーダルを更新
        
    } catch (error) {
        console.error('Error processing transaction:', error);
        alert('在庫更新に失敗しました: ' + error.message);
    }
}

// 次の商品IDを自動生成
function generateNextProductId() {
    if (!inventoryData || inventoryData.length === 0) {
        return 'P001';
    }
    
    // 既存の商品IDから最大値を取得
    let maxNum = 0;
    for (const item of inventoryData) {
        const productId = item.product_id || item.id;
        if (productId && productId.startsWith('P')) {
            const numStr = productId.substring(1);
            const num = parseInt(numStr, 10);
            if (!isNaN(num) && num > maxNum) {
                maxNum = num;
            }
        }
    }
    
    // 次のIDを生成（3桁ゼロパディング）
    const nextNum = maxNum + 1;
    return `P${String(nextNum).padStart(3, '0')}`;
}

// 商品登録
async function createInventoryItem() {
    const productId = document.getElementById('new-product-id').value.trim();
    const name = document.getElementById('new-product-name').value.trim();
    const stock = parseInt(document.getElementById('new-product-stock').value, 10);
    const minStock = parseInt(document.getElementById('new-product-min-stock').value, 10);
    const safeStock = parseInt(document.getElementById('new-product-safe-stock').value, 10);
    
    if (!productId || !name) {
        alert('商品IDと商品名は必須です');
        return;
    }
    
    try {
        const idToken = await getFirebaseIdToken();
        const response = await fetch(`${REPORT_API}/staff/inventory/items`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
                product_id: productId,
                name: name,
                stock: stock,
                minStock: minStock,
                safeStock: safeStock
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || '商品登録に失敗しました');
        }
        
        alert('商品を登録しました');
        document.getElementById('new-item-dialog').close();
        
        // フォームをリセット
        const savedProductId = productId;
        const savedName = name;
        // 商品IDは自動生成されるので、モーダルを閉じる時にリセットしない
        document.getElementById('new-product-name').value = '';
        document.getElementById('new-product-stock').value = '0';
        document.getElementById('new-product-min-stock').value = '50';
        document.getElementById('new-product-safe-stock').value = '100';
        
        // 在庫一覧を再読み込み
        await loadInventory();
        
        // 登録した商品のQRコードを表示
        showSingleQRCode(savedProductId, savedName);
        
    } catch (error) {
        console.error('Error creating item:', error);
        alert('商品登録に失敗しました: ' + error.message);
    }
}

// 単一商品のQRコードを表示
async function showSingleQRCode(productId, productName) {
    const qrUrl = `${BASE_URL}/staff/inventory/scan?product_id=${productId}`;
    
    // QRコード表示用のモーダルを作成または取得
    let qrModal = document.getElementById('single-qrcode-dialog');
    if (!qrModal) {
        qrModal = document.createElement('dialog');
        qrModal.id = 'single-qrcode-dialog';
        qrModal.className = 'modal-dialog';
        qrModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>QRコード</h3>
                    <button type="button" class="modal-close" onclick="document.getElementById('single-qrcode-dialog').close()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body" style="text-align: center; padding: 24px;">
                    <div id="single-qrcode-container"></div>
                    <div style="margin-top: 16px;">
                        <div style="font-weight: 600; font-size: 1.1rem; color: #111827; margin-bottom: 8px;" id="single-qrcode-name"></div>
                        <div style="font-size: 0.9rem; color: #6b7280;" id="single-qrcode-id"></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-outline" onclick="document.getElementById('single-qrcode-dialog').close()">閉じる</button>
                </div>
            </div>
        `;
        document.body.appendChild(qrModal);
    }
    
    const container = document.getElementById('single-qrcode-container');
    const nameDiv = document.getElementById('single-qrcode-name');
    const idDiv = document.getElementById('single-qrcode-id');
    
    container.innerHTML = '<div style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> QRコードを生成中...</div>';
    nameDiv.textContent = productName;
    idDiv.textContent = productId;
    
    qrModal.showModal();
    
    try {
        container.innerHTML = '';
        const qrDiv = document.createElement('div');
        container.appendChild(qrDiv);
        
        // QRコードを生成（qrcodejsライブラリのAPIを使用）
        if (typeof QRCode !== 'undefined') {
            new QRCode(qrDiv, {
                text: qrUrl,
                width: 256,
                height: 256,
                colorDark: '#000000',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.H
            });
        } else {
            // QRCodeライブラリが読み込まれていない場合
            container.innerHTML = '<div style="color: #dc2626;">QRコードライブラリが読み込まれていません</div>';
        }
    } catch (error) {
        console.error('Error generating QR code:', error);
        container.innerHTML = '<div style="color: #dc2626;">QRコードの生成に失敗しました: ' + error.message + '</div>';
    }
}

// QRコードを生成して表示
async function showQRCodes() {
    const qrcodeGrid = document.getElementById('qrcode-grid');
    if (!qrcodeGrid) return;
    
    qrcodeGrid.innerHTML = '<div style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> QRコードを生成中...</div>';
    
    document.getElementById('qrcode-dialog').showModal();
    
    try {
        qrcodeGrid.innerHTML = '';
        
        for (const item of inventoryData) {
            const productId = item.product_id || item.id;
            const qrUrl = `${BASE_URL}/staff/inventory/scan?product_id=${productId}`;
            
            const qrCard = document.createElement('div');
            qrCard.style.cssText = 'text-align: center; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff;';
            
            const qrDiv = document.createElement('div');
            qrDiv.style.cssText = 'display: inline-block;';
            qrCard.appendChild(qrDiv);
            
            const nameDiv = document.createElement('div');
            nameDiv.style.cssText = 'margin-top: 12px; font-weight: 600; font-size: 0.9rem; color: #111827;';
            nameDiv.textContent = item.name;
            qrCard.appendChild(nameDiv);
            
            const idDiv = document.createElement('div');
            idDiv.style.cssText = 'margin-top: 4px; font-size: 0.75rem; color: #6b7280;';
            idDiv.textContent = productId;
            qrCard.appendChild(idDiv);
            
            qrcodeGrid.appendChild(qrCard);
            
            // QRコードを生成（qrcodejsライブラリのAPIを使用）
            new QRCode(qrDiv, {
                text: qrUrl,
                width: 180,
                height: 180,
                colorDark: '#000000',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.H
            });
        }
    } catch (error) {
        console.error('Error generating QR codes:', error);
        qrcodeGrid.innerHTML = '<div style="text-align: center; padding: 20px; color: #dc2626;">QRコードの生成に失敗しました</div>';
    }
}

// 8. イベントリスナーの設定
// モーダル内のモード切り替え
const modalModeIn = document.getElementById('modal-mode-in');
const modalModeOut = document.getElementById('modal-mode-out');
const modalProcessBtn = document.getElementById('modal-process-button');

if (modalModeIn && modalModeOut) {
    modalModeIn.addEventListener('click', () => {
        modalCurrentMode = 'in';
        modalModeIn.className = 'active';
        modalModeOut.className = 'inactive';
        if (modalProcessBtn) {
            modalProcessBtn.textContent = '入庫処理を実行';
            modalProcessBtn.style.backgroundColor = '#28a745';
        }
    });
    
    modalModeOut.addEventListener('click', () => {
        modalCurrentMode = 'out';
        modalModeIn.className = 'inactive';
        modalModeOut.className = 'active';
        if (modalProcessBtn) {
            modalProcessBtn.textContent = '出庫処理を実行';
            modalProcessBtn.style.backgroundColor = '#dc3545';
        }
    });
}

if (modalProcessBtn) {
    modalProcessBtn.addEventListener('click', processModalTransaction);
}

// Enterキーでも実行できるようにする
document.addEventListener('keypress', (e) => {
    // モーダル内の数量入力フィールドの場合
    if (e.key === 'Enter') {
        if (document.activeElement === document.getElementById('modal-quantity')) {
            processModalTransaction();
        }
    }
});

// イベントリスナーの設定
document.addEventListener('DOMContentLoaded', function() {
    // 在庫一覧を読み込み
    loadInventory();
    
    // 商品登録ボタン
    const btnNewItem = document.getElementById('btn-new-item');
    if (btnNewItem) {
        btnNewItem.addEventListener('click', () => {
            // 次の商品IDを自動生成して入力
            const nextId = generateNextProductId();
            document.getElementById('new-product-id').value = nextId;
            document.getElementById('new-item-dialog').showModal();
        });
    }
    
    // 商品登録実行ボタン
    const btnCreateItem = document.getElementById('btn-create-item');
    if (btnCreateItem) {
        btnCreateItem.addEventListener('click', createInventoryItem);
    }
    
    // QRコード表示ボタン
    const btnShowQRCodes = document.getElementById('btn-show-qrcodes');
    if (btnShowQRCodes) {
        btnShowQRCodes.addEventListener('click', showQRCodes);
    }
    
    // ヘルプボタン
    const btnHelp = document.getElementById('btn-help');
    if (btnHelp) {
        btnHelp.addEventListener('click', () => {
            document.getElementById('help-dialog').showModal();
        });
    }
    
    // 商品名編集機能
    const btnEditName = document.getElementById('btn-edit-name');
    const btnSaveName = document.getElementById('btn-save-name');
    const btnCancelEditName = document.getElementById('btn-cancel-edit-name');
    const editNameForm = document.getElementById('edit-name-form');
    const editNameInput = document.getElementById('edit-name-input');
    const modalProductNameText = document.getElementById('modal-product-name-text');
    
    if (btnEditName) {
        btnEditName.addEventListener('click', () => {
            if (editNameForm) editNameForm.style.display = 'block';
            if (editNameInput && modalProductNameText) {
                editNameInput.value = modalProductNameText.textContent;
                editNameInput.focus();
            }
        });
    }
    
    if (btnCancelEditName) {
        btnCancelEditName.addEventListener('click', () => {
            if (editNameForm) editNameForm.style.display = 'none';
            if (editNameInput && modalProductNameText) {
                editNameInput.value = modalProductNameText.textContent;
            }
        });
    }
    
    if (btnSaveName) {
        btnSaveName.addEventListener('click', async () => {
            if (!currentProductId || !editNameInput) return;
            
            const newName = editNameInput.value.trim();
            if (!newName) {
                alert('商品名を入力してください');
                return;
            }
            
            try {
                const idToken = await getFirebaseIdToken();
                const response = await fetch(`${REPORT_API}/staff/inventory/items/${currentProductId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${idToken}`
                    },
                    body: JSON.stringify({
                        name: newName
                    })
                });
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || '商品名の更新に失敗しました');
                }
                
                // 成功したら表示を更新
                if (modalProductNameText) {
                    modalProductNameText.textContent = newName;
                }
                const modalProductName = document.getElementById('modal-product-name');
                if (modalProductName) {
                    modalProductName.textContent = newName;
                }
                
                // フォームを非表示
                if (editNameForm) editNameForm.style.display = 'none';
                
                // 在庫一覧を再読み込みしてカードの表示も更新
                await loadInventory();
                
                // モーダルを再度開いて最新情報を表示
                openProductDetail(currentProductId);
                
                alert('商品名を更新しました');
            } catch (error) {
                console.error('Error updating product name:', error);
                alert('商品名の更新に失敗しました: ' + error.message);
            }
        });
    }
    
    // Enterキーで保存
    if (editNameInput) {
        editNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && btnSaveName) {
                btnSaveName.click();
            }
        });
    }
});