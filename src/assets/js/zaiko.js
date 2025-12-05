// --- JavaScript ロジック ---
        
// 1. 在庫データ（データベース代わり） - 20項目
const initialInventory = [
    { id: 'P001', name: '商品A（ビスケット）', stock: 150, minStock: 50, safeStock: 100 },
    { id: 'P002', name: '商品B（飲料水）', stock: 200, minStock: 50, safeStock: 100 },
    { id: 'P003', name: '商品C（文房具セット）', stock: 50, minStock: 30, safeStock: 60 },
    { id: 'P004', name: '商品D（電池パック）', stock: 300, minStock: 50, safeStock: 100 },
    { id: 'P005', name: '商品E（タオル）', stock: 100, minStock: 40, safeStock: 80 },
    { id: 'P006', name: '商品F（シャンプー）', stock: 120, minStock: 50, safeStock: 100 },
    { id: 'P007', name: '商品G（トイレットペーパー）', stock: 80, minStock: 40, safeStock: 80 },
    { id: 'P008', name: '商品H（洗剤）', stock: 140, minStock: 50, safeStock: 100 },
    { id: 'P009', name: '商品I（歯磨き粉）', stock: 90, minStock: 40, safeStock: 80 },
    { id: 'P010', name: '商品J（レトルト食品）', stock: 250, minStock: 50, safeStock: 100 },
    { id: 'P011', name: '商品K（マスク）', stock: 400, minStock: 100, safeStock: 200 },
    { id: 'P012', name: '商品L（救急箱）', stock: 70, minStock: 30, safeStock: 60 },
    { id: 'P013', name: '商品M（軍手）', stock: 180, minStock: 50, safeStock: 100 },
    { id: 'P014', name: '商品N（カセットコンロ）', stock: 30, minStock: 20, safeStock: 40 },
    { id: 'P015', name: '商品O（ガムテープ）', stock: 110, minStock: 40, safeStock: 80 },
    { id: 'P016', name: '商品P（懐中電灯）', stock: 60, minStock: 30, safeStock: 60 },
    { id: 'P017', name: '商品Q（アルミホイル）', stock: 130, minStock: 50, safeStock: 100 },
    { id: 'P018', name: '商品R（ラップ）', stock: 170, minStock: 50, safeStock: 100 },
    { id: 'P019', name: '商品S（ビニール袋）', stock: 220, minStock: 50, safeStock: 100 },
    { id: 'P020', name: '商品T（ロープ）', stock: 40, minStock: 20, safeStock: 40 }
];

let inventoryData = [...initialInventory]; // 実際に操作するデータ
let modalCurrentMode = 'out'; // モーダル内のモード
let currentProductId = null; // 現在選択中の商品ID

// 2. DOM要素の取得
const inventoryGrid = document.getElementById('inventory-grid');

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
        
        card.innerHTML = `
            <div class="card-icon">
                <i class="fas fa-box"></i>
            </div>
            <div class="card-content">
                <div class="card-name">${escapeHtml(item.name)}</div>
                <div class="card-id">${escapeHtml(item.id)}</div>
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
            openProductDetail(item.id);
        });
        
        inventoryGrid.appendChild(card);
    });
}

// 6. 商品詳細モーダルを開く
function openProductDetail(productId) {
    const item = inventoryData.find(i => i.id === productId);
    if (!item) return;
    
    currentProductId = productId;
    modalCurrentMode = 'out';
    
    // モーダルに情報を設定
    document.getElementById('modal-product-name').textContent = item.name;
    document.getElementById('modal-product-id').textContent = item.id;
    document.getElementById('modal-product-name-text').textContent = item.name;
    document.getElementById('modal-product-stock').textContent = `${item.stock.toLocaleString()} 個`;
    
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

// 7. モーダル内での在庫更新処理
function processModalTransaction() {
    if (!currentProductId) return;
    
    const quantity = parseInt(document.getElementById('modal-quantity').value, 10);
    const item = inventoryData.find(i => i.id === currentProductId);
    
    if (!item) {
        alert('商品が見つかりませんでした');
        return;
    }
    
    // 入力チェック
    if (isNaN(quantity) || quantity <= 0) {
        alert('数量（1以上の数値）を正しく入力してください。');
        return;
    }
    
    // 在庫更新ロジック
    if (modalCurrentMode === 'in') {
        // 入庫処理
        item.stock += quantity;
        alert(`✅ 入庫成功: ${item.name} に ${quantity} 個を追加しました。現在の在庫: ${item.stock}`);
    } else {
        // 出庫処理
        if (item.stock < quantity) {
            alert(`⚠️ 出庫エラー: ${item.name} の在庫は ${item.stock} 個しかありません。${quantity} 個出庫できません。`);
            return;
        }
        item.stock -= quantity;
        alert(`✅ 出庫成功: ${item.name} から ${quantity} 個を減らしました。現在の在庫: ${item.stock}`);
    }
    
    // UIを更新
    renderInventory();
    openProductDetail(currentProductId); // モーダルを更新
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

// 初期化処理
document.addEventListener('DOMContentLoaded', function() {
    renderInventory();
});