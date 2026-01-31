# /sales/customers 顧客登録＋一覧 完了報告

## 完了条件

- ✅ 登録できる
- ✅ リロードしても残る（localStorage）
- ✅ 一覧に出る
- ✅ カルテに飛べる（「カルテを見る」→ `/sales/store/:storeKey`）

---

## 登録画面

ブラウザで `/v2/sales/customers` を開き、上部フォームで新規顧客を登録できます。  
**登録画面のスクリーンショットは手元で取得してください。**

---

## localStorage 構造

- **Key:** `misogi_sales_customers`
- **形式:** 配列の JSON 文字列

```json
[
  {
    "storeKey": "セブン_アイ_セブンイレブン新宿店_1738291200000",
    "company": "セブン&アイ",
    "store": "セブンイレブン新宿店",
    "address": "東京都新宿区西新宿1-1-1",
    "tel": "03-1234-5678",
    "contact": "山田",
    "email": "shinjuku@example.com"
  }
]
```

- **storeKey:** `slug(company + "_" + store) + "_" + Date.now()` で自動生成（被り回避のため timestamp 付与）
- **登録時:** `getCustomers()` → `push(newCustomer)` → `setCustomers(list)`
- **マウント時:** `getCustomersWithSeed()` で取得。空なら初期データ（モック 2 件）を投入して返す
- **削除:** Phase2 未対応（現状は登録・一覧・カルテ遷移のみ）

---

## 主要 JSX 抜粋

### SalesCustomersPage.jsx（構成）

- **上部:** 新規顧客登録フォーム  
  - 会社名・店舗名（必須）・住所（必須）・TEL・担当者・Email  
  - バリデーション: 店舗名・住所は必須、空白のみ NG。失敗時は `.sales-field-error` で赤文字表示  
  - 送信時: `validate()` → `generateStoreKey(company, store)` → `push` → `setCustomers(list)` → フォームリセット
- **下部:** 登録済み一覧  
  - `getCustomersWithSeed()` で取得した配列をカード表示  
  - 各カード: 店舗名・会社名・住所（省略表示）・「カルテを見る」ボタン  
  - 「カルテを見る」→ `navigate(\`/sales/store/${encodeURIComponent(c.storeKey)}\`)`

### salesCustomersStorage.js

- `STORAGE_KEY = 'misogi_sales_customers'`
- `slug(str)` … スラッグ化
- `generateStoreKey(company, store)` … `slug(company + '_' + store) + '_' + Date.now()`
- `getCustomers()` … `localStorage.getItem` → `JSON.parse`、配列で返す
- `setCustomers(list)` … `localStorage.setItem(STORAGE_KEY, JSON.stringify(list))`
- `getCustomersWithSeed()` … 空ならモック 2 件を `setCustomers` して返す

---

## ファイル一覧

| ファイル | 役割 |
|----------|------|
| `src/shared/ui/Sales/salesCustomersStorage.js` | storeKey 生成・localStorage 読み書き・初期データ |
| `src/shared/ui/Sales/SalesCustomersPage.jsx` | 登録フォーム＋一覧 UI・バリデーション・登録処理 |
| `src/shared/ui/Sales/sales-customer-list.css` | フォーム・一覧カード・エラー表示のスタイル |

営業入口の「顧客登録」ボタンは `/sales/customers` へ遷移するように変更済みです。
