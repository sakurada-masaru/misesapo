# ユーザー登録の分離提案

## 🚨 現状の問題点

### 1. 登録窓口の混在
- **お客様（customer）**と**従業員（staff, sales, adminなど）**が同じ`/signup.html`から登録している
- 全てFirebase Authenticationを通して認証している
- ロールによってリダイレクト先が変わるだけ

### 2. データ構造の混在
- **お客様**: `clients`テーブル（推測）または`customers`テーブル
- **従業員**: `workers`テーブル
- 同じFirebase Authenticationを使用しているが、データ保存先が異なる可能性

### 3. セキュリティ上の懸念
- 従業員が勝手に登録できる可能性
- お客様が従業員として登録できる可能性
- ロール管理が複雑

### 4. 運用上の問題
- 管理画面でお客様と従業員が混在して表示される
- 登録フローが分かりにくい
- データの整合性が保ちにくい

## 💡 改善案

### 案1: 登録窓口を完全に分離（推奨）

#### お客様（Customer）の登録
- **登録ページ**: `/signup.html`（既存）
- **認証**: Firebase Authentication
- **データ保存先**: `clients`テーブル（または`customers`テーブル）
- **ロール**: `customer`（固定）
- **特徴**:
  - 誰でも登録可能
  - メール確認が必要
  - 会社情報・店舗情報の登録が必要

#### 従業員（Worker）の登録
- **登録ページ**: `/admin/users/new.html`（管理画面内）
- **認証**: Firebase Authentication（管理者が作成）
- **データ保存先**: `workers`テーブル
- **ロール**: `staff`, `sales`, `admin`, `developer`, `master`（管理者が指定）
- **特徴**:
  - 管理者のみが登録可能
  - メール確認は不要（管理者が作成）
  - 初期パスワードを設定して通知

### 案2: 認証方法を分離

#### お客様（Customer）
- **認証**: Firebase Authentication（既存）
- **データ保存先**: `clients`テーブル

#### 従業員（Worker）
- **認証**: Firebase Authentication（管理者が作成）
- **データ保存先**: `workers`テーブル
- **登録方法**: 管理者が管理画面から登録

### 案3: データ構造を統一

#### 統一テーブル: `users`
- **カラム**: `id`, `firebase_uid`, `email`, `name`, `role`, `type`（`customer` or `worker`）
- **メリット**: データ管理が統一される
- **デメリット**: 既存データの移行が必要

## 🎯 推奨される実装方針

### ステップ1: 登録窓口の分離

#### `/signup.html`（お客様専用）
```javascript
// お客様のみが登録可能
async function registerCustomer(email, password, name) {
  // Firebase Authenticationに登録
  // clientsテーブルに保存
  // role: 'customer'（固定）
}
```

#### `/admin/users/new.html`（従業員専用）
```javascript
// 管理者のみが登録可能
async function registerWorker(workerData) {
  // Firebase Authenticationに登録（管理者が作成）
  // workersテーブルに保存
  // role: 管理者が指定（staff, sales, adminなど）
}
```

### ステップ2: データ構造の明確化

#### `clients`テーブル（お客様）
```json
{
  "id": "C1764552147000",
  "firebase_uid": "abc123...",
  "email": "customer@example.com",
  "name": "お客様名",
  "company_name": "会社名",
  "store_name": "店舗名",
  "role": "customer",
  "status": "active",
  "created_at": "2025-12-01T00:00:00Z"
}
```

#### `workers`テーブル（従業員）
```json
{
  "id": "W1764552147000",
  "firebase_uid": "def456...",
  "email": "worker@example.com",
  "name": "従業員名",
  "role": "staff",
  "department": "清掃員",
  "status": "active",
  "created_at": "2025-12-01T00:00:00Z"
}
```

### ステップ3: 認証フローの明確化

#### お客様のログイン
1. `/signin.html`でログイン
2. Firebase Authenticationで認証
3. `role: 'customer'`の場合、`/customers/dashboard.html`にリダイレクト
4. `clients`テーブルから情報を取得

#### 従業員のログイン
1. `/signin.html`でログイン
2. Firebase Authenticationで認証
3. `role: 'staff'`, `'sales'`, `'admin'`などの場合、`/staff/dashboard.html`にリダイレクト
4. `workers`テーブルから情報を取得

## 📋 実装手順

### フェーズ1: 登録窓口の分離（1-2日）
1. `/signup.html`を`/customers/signup.html`に移動（またはリダイレクト）
2. `/admin/users/new.html`を作成（従業員登録専用）
3. 登録処理を分離

### フェーズ2: データ構造の明確化（2-3日）
1. `clients`テーブルの確認・作成
2. `workers`テーブルの確認
3. データ移行スクリプトの作成

### フェーズ3: 認証フローの改善（1-2日）
1. ログイン後のリダイレクト処理を改善
2. ロール判定の明確化
3. エラーハンドリングの改善

## ⚠️ 注意点

### 1. 既存データの移行
- 既存のFirebaseユーザーを`clients`と`workers`に分類
- データの整合性を保つ

### 2. セキュリティ
- 従業員の登録は管理者のみが可能
- お客様の登録は誰でも可能（ただし、メール確認が必要）

### 3. 運用
- 管理画面でお客様と従業員を分けて表示
- 登録フローを明確にする

## 🎯 結論

**推奨**: 案1（登録窓口を完全に分離）

**理由**:
1. セキュリティが向上する
2. データ管理が明確になる
3. 運用が簡単になる
4. 将来的な拡張が容易になる

**実装期間**: 約1週間（段階的に実装可能）

