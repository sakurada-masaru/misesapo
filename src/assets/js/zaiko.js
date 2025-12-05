// --- JavaScript ロジック ---
        
// 1. 在庫データ（データベース代わり） - 20項目
const initialInventory = [
    { id: 'P001', name: '商品A（ビスケット）', stock: 150 },
    { id: 'P002', name: '商品B（飲料水）', stock: 200 },
    { id: 'P003', name: '商品C（文房具セット）', stock: 50 },
    { id: 'P004', name: '商品D（電池パック）', stock: 300 },
    { id: 'P005', name: '商品E（タオル）', stock: 100 },
    { id: 'P006', name: '商品F（シャンプー）', stock: 120 },
    { id: 'P007', name: '商品G（トイレットペーパー）', stock: 80 },
    { id: 'P008', name: '商品H（洗剤）', stock: 140 },
    { id: 'P009', name: '商品I（歯磨き粉）', stock: 90 },
    { id: 'P010', name: '商品J（レトルト食品）', stock: 250 },
    { id: 'P011', name: '商品K（マスク）', stock: 400 },
    { id: 'P012', name: '商品L（救急箱）', stock: 70 },
    { id: 'P013', name: '商品M（軍手）', stock: 180 },
    { id: 'P014', name: '商品N（カセットコンロ）', stock: 30 },
    { id: 'P015', name: '商品O（ガムテープ）', stock: 110 },
    { id: 'P016', name: '商品P（懐中電灯）', stock: 60 },
    { id: 'P017', name: '商品Q（アルミホイル）', stock: 130 },
    { id: 'P018', name: '商品R（ラップ）', stock: 170 },
    { id: 'P019', name: '商品S（ビニール袋）', stock: 220 },
    { id: 'P020', name: '商品T（ロープ）', stock: 40 }
];

let inventoryData = [...initialInventory]; // 実際に操作するデータ
let currentMode = 'out'; // 初期モードは 'out'（出庫） - レジ打ちイメージ

// 2. DOM要素の取得
const modeInButton = document.getElementById('mode-in');
const modeOutButton = document.getElementById('mode-out');
const productIdInput = document.getElementById('product-id');
const quantityInput = document.getElementById('quantity');
const processButton = document.getElementById('process-button');
const inventoryListBody = document.getElementById('inventory-list');
const messageDiv = document.getElementById('message');

// 3. モード切り替え機能
function setMode(mode) {
    currentMode = mode;
    if (mode === 'in') {
        modeInButton.className = 'active';
        modeOutButton.className = 'inactive';
        processButton.textContent = '入庫処理を実行';
        processButton.style.backgroundColor = '#28a745';
    } else {
        modeInButton.className = 'inactive';
        modeOutButton.className = 'active';
        processButton.textContent = '出庫処理を実行';
        processButton.style.backgroundColor = '#dc3545';
    }
}

modeInButton.addEventListener('click', () => setMode('in'));
modeOutButton.addEventListener('click', () => setMode('out'));

// 4. 在庫テーブルの描画
function renderInventory() {
    inventoryListBody.innerHTML = ''; // 一旦クリア
    inventoryData.forEach(item => {
        const row = inventoryListBody.insertRow();
        row.insertCell().textContent = item.id;
        row.insertCell().textContent = item.name;
        const stockCell = row.insertCell();
        stockCell.textContent = item.stock.toLocaleString();
        stockCell.className = 'center-text';
        
        // 在庫不足を警告
        if (item.stock < 50) {
            stockCell.style.fontWeight = 'bold';
            stockCell.style.color = '#dc3545';
        }
    });
}

// 5. メッセージ表示機能
function displayMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type; // 'success' or 'error'
    // メッセージを数秒後にクリアする
    setTimeout(() => {
        messageDiv.textContent = '';
        messageDiv.className = '';
    }, 3000);
}

// 6. 在庫更新処理
function processTransaction() {
    const productId = productIdInput.value.toUpperCase().trim();
    const quantity = parseInt(quantityInput.value, 10);

    // 入力チェック
    if (!productId || isNaN(quantity) || quantity <= 0) {
        displayMessage('商品IDと数量（1以上の数値）を正しく入力してください。', 'error');
        return;
    }

    const item = inventoryData.find(i => i.id === productId);

    // 商品ID存在チェック
    if (!item) {
        displayMessage(`エラー: 商品ID ${productId} は見つかりませんでした。`, 'error');
        return;
    }

    // 在庫更新ロジック
    if (currentMode === 'in') {
        // 入庫処理
        item.stock += quantity;
        displayMessage(`✅ 入庫成功: ${item.name} に ${quantity} 個を追加しました。現在の在庫: ${item.stock}`, 'success');
    } else {
        // 出庫処理
        if (item.stock < quantity) {
            displayMessage(`⚠️ 出庫エラー: ${item.name} の在庫は ${item.stock} 個しかありません。${quantity} 個出庫できません。`, 'error');
            return;
        }
        item.stock -= quantity;
        displayMessage(`✅ 出庫成功: ${item.name} から ${quantity} 個を減らしました。現在の在庫: ${item.stock}`, 'success');
    }

    // UIを更新
    renderInventory();
    productIdInput.value = ''; // 入力フィールドをクリア
    quantityInput.value = '1'; // 数量を初期値に戻す
    productIdInput.focus(); // QRコードスキャンに備えてフォーカス
}

// 7. イベントリスナーの設定
processButton.addEventListener('click', processTransaction);

// Enterキーでも実行できるようにする
document.addEventListener('keypress', (e) => {
    // スキャン後の商品ID入力時にEnterキーが押されたことを想定
    if (e.key === 'Enter') {
        // 現在フォーカスが数量入力フィールドにあるか、商品IDフィールドにある場合のみ実行
        if (document.activeElement === productIdInput || document.activeElement === quantityInput) {
            processTransaction();
        }
    }
});

// 初期化処理
window.onload = function() {
    renderInventory();
    setMode('out'); // レジ打ちのイメージに合わせて初期モードを出庫にする
};