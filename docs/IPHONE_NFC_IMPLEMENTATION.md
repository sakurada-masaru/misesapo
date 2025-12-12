# iPhone 12でのNFCタグ打刻実装ガイド

## ✅ 重要: iPhone 12でも使えます！

**QRコード方式で実装済みです。iPhone 12でも問題なく動作します。**

## 現状の制約

iPhone 12はNFC機能をサポートしていますが、**SafariブラウザではWeb NFC APIがサポートされていません**。

- ✅ **Android Chrome**: Web NFC API対応（NFCタグを直接読み取り可能）
- ❌ **iOS Safari**: Web NFC API未対応（NFCタグを直接読み取り不可）
- ✅ **iPhone 12 + QRコード**: 完全対応（実装済み）

**結論: QRコード方式ならiPhone 12でも使えます！実用的にはNFCタグと同じように使えます。**

## 実装方法の選択肢

### 方法1: QRコード打刻（推奨・すぐに実装可能）

WebアプリでQRコードを読み取って打刻する方法です。既存のQRコードスキャン機能（`staff-inventory-scan.js`）を参考に実装できます。

**メリット:**
- すぐに実装可能
- 既存の技術スタックで対応可能
- iPhone 12で動作する

**実装例:**
```javascript
// QRコードに以下のJSONをエンコード
{
  "facility_id": "ABC_001",
  "location_id": "TK_R01_TOILET_IN"
}

// 読み取り後にAPIを呼び出し
async function handleQRCodeScan(qrData) {
  const data = JSON.parse(qrData);
  const user_id = getCurrentUserId(); // ログインユーザーIDを取得
  
  const response = await fetch('https://YOUR_API_GATEWAY_URL/prod/staff/nfc/clock-in', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${await getFirebaseIdToken()}`
    },
    body: JSON.stringify({
      user_id: user_id,
      facility_id: data.facility_id,
      location_id: data.location_id
    })
  });
  
  const result = await response.json();
  if (result.status === 'success') {
    alert('打刻が完了しました');
  }
}
```

### 方法2: ネイティブアプリ（Swift）

iOSネイティブアプリを作成してNFCタグを読み取る方法です。

**メリット:**
- ネイティブのNFC機能をフル活用
- バックグラウンドでの読み取りも可能

**デメリット:**
- アプリ開発が必要
- App Store審査が必要

### 方法3: 手動入力

施設IDと場所IDを手動で入力する方法です。

**メリット:**
- 実装が簡単
- デバイス依存がない

**デメリット:**
- 入力ミスの可能性
- 手間がかかる

## 推奨実装: QRコード打刻

既存のプロジェクトにはQRコードスキャン機能があるため、これを活用するのが最適です。

### 実装手順

1. **QRコード生成ページを作成**（管理者用）
   - 施設IDと場所IDからQRコードを生成
   - 各場所にQRコードを印刷・設置

2. **打刻ページを作成**（清掃員用）
   - QRコードスキャン機能を実装
   - 読み取り後にAPIを呼び出し

3. **既存のQRコードスキャン機能を活用**
   - `staff-inventory-scan.js`の実装を参考
   - `Html5Qrcode`ライブラリを使用

## 実装例

### QRコード打刻ページの作成

`src/pages/staff/nfc-clock-in.html` を作成し、QRコードスキャン機能を実装します。

### NFCタグ情報の取得

NFCタグには以下の情報を書き込む必要があります：

```json
{
  "facility_id": "ABC_001",
  "location_id": "TK_R01_TOILET_IN"
}
```

この情報をQRコードにエンコードして、各場所に設置します。

## 将来的な対応

iOS SafariでWeb NFC APIがサポートされた場合、以下のように実装できます：

```javascript
if ('NDEFReader' in window) {
  const reader = new NDEFReader();
  await reader.scan();
  
  reader.addEventListener('reading', async (event) => {
    const message = event.message;
    // NFCタグからデータを読み取り
    // APIを呼び出し
  });
}
```

現時点では、**QRコード打刻が最も実用的な解決策**です。

