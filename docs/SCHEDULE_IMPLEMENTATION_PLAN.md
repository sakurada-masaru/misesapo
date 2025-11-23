# スケジュール機能実装計画

## 📋 現在の業務フロー

1. **コンシェルジュ（営業）** → 案件を受注
2. **管理部** → 情報を確認・共有
3. **管理部** → 清掃員に情報を発信
4. **清掃員** → 案件を確認して清掃を実施

---

## 🎯 システム化後のフロー

### 1. コンシェルジュ（営業）が案件を作成
- 受注情報を入力
- スケジュール/案件を作成
- ステータス: `pending`（承認待ち）

### 2. 管理者が確認・承認・割り当て
- 案件を確認
- 承認・却下
- 清掃員への割り当て
- ステータス: `assigned`（割り当て済み）

### 3. 清掃員が確認・作業
- 割り当てられた案件を確認
- 作業開始（位置情報取得）
- 作業完了
- ステータス: `in_progress` → `completed`

---

## ⚠️ 重要：実装範囲の明確化

### フロントエンド側（この実装計画の対象）
- ✅ スケジュール管理のUI実装
- ✅ 既存データ構造（`clients.json`など）を活用した表示
- ✅ バックエンドAPIが完成するまでのモック実装
- ✅ ユーザー体験の設計・実装

### バックエンドエンジニア側（担当外）
- ❌ DynamoDBテーブル設計・作成
- ❌ Lambda関数の実装
- ❌ API Gatewayの設定
- ❌ Azure Entra ID認証基盤との連携
- ❌ 顧客・取引先構造（企業・ブランド・店舗）との連携
- ❌ 決済・請求ロジックとの連携
- ❌ 認証・セキュリティ基盤の実装

**注意**: フロントエンド側は、バックエンドAPIの仕様を想定してUIを実装し、APIが完成するまではモックデータで動作確認できるようにします。

---

## 🗄️ データ構造（バックエンドエンジニアとの連携想定）

### 想定されるAPIレスポンス構造

**注意**: 以下の構造は、バックエンドエンジニアと相談して決定する想定のものです。フロントエンド側は、この構造を前提にUIを実装します。

#### スケジュールデータ構造（想定）:
```json
{
  "schedule_id": "string (UUID)",
  "created_at": "string (ISO 8601)",
  "updated_at": "string (ISO 8601)",
  
  // 基本情報
  "date": "string (YYYY-MM-DD)",
  "time_slot": "string (例: 10:00-12:00)",
  "order_type": "string (regular|spot|emergency)",
  
  // 顧客・店舗情報
  "client_id": "string",
  "client_name": "string",
  "store_id": "string",
  "store_name": "string",
  "address": "string",
  "phone": "string",
  "email": "string",
  
  // 作業内容
  "cleaning_items": [
    {
      "name": "string",
      "notes": ["string"],
      "quantity": "number|null",
      "unit": "string|null"
    }
  ],
  "notes": "string",
  
  // 担当者情報
  "created_by": "string (user_id, コンシェルジュ)",
  "assigned_to": "string|null (staff_id, 清掃員)",
  "approved_by": "string|null (user_id, 管理者)",
  
  // ステータス
  "status": "string (pending|approved|rejected|assigned|in_progress|completed|cancelled)",
  
  // 作業実績
  "started_at": "string|null (ISO 8601)",
  "completed_at": "string|null (ISO 8601)",
  "start_location": {
    "latitude": "number",
    "longitude": "number",
    "address": "string"
  } | null,
  "report_id": "string|null (完了後のレポートID)",
  
  // 繰り返し設定（将来用）
  "recurrence": {
    "type": "string (daily|weekly|monthly)",
    "interval": "number",
    "end_date": "string|null (YYYY-MM-DD)"
  } | null
}
```

**注意**: DynamoDBテーブル設計、GSI設計はバックエンドエンジニアが担当します。

---

## 🔌 API設計（バックエンドエンジニアとの連携想定）

**注意**: 以下のAPI仕様は、バックエンドエンジニアと相談して決定する想定のものです。フロントエンド側は、この仕様を前提にUIを実装し、APIが完成するまではモックデータで動作確認します。

### 1. スケジュール一覧取得
```
GET /api/schedules
```

**クエリパラメータ:**
- `role`: `admin` | `sales` | `staff` (必須)
- `status`: `pending` | `approved` | `assigned` | `in_progress` | `completed` | `cancelled` (オプション)
- `date`: `YYYY-MM-DD` (オプション)
- `assigned_to`: `staff_id` (オプション、管理者用)
- `created_by`: `user_id` (オプション、コンシェルジュ用)
- `start_date`: `YYYY-MM-DD` (オプション、範囲検索)
- `end_date`: `YYYY-MM-DD` (オプション、範囲検索)

**レスポンス:**
```json
{
  "schedules": [
    {
      "schedule_id": "uuid",
      "date": "2025-11-22",
      "time_slot": "10:00-12:00",
      "client_name": "株式会社 Dart Ace",
      "store_name": "日本橋茅場町店",
      "status": "assigned",
      "assigned_to": "staff-001",
      ...
    }
  ],
  "total": 10
}
```

### 2. スケジュール詳細取得
```
GET /api/schedules/{schedule_id}
```

**レスポンス:**
```json
{
  "schedule_id": "uuid",
  "date": "2025-11-22",
  "time_slot": "10:00-12:00",
  "order_type": "regular",
  "client_id": "client-001",
  "client_name": "株式会社 Dart Ace",
  "store_id": "store-001",
  "store_name": "日本橋茅場町店",
  "address": "東京都中央区...",
  "phone": "03-1234-5678",
  "email": "info@example.com",
  "cleaning_items": [...],
  "notes": "備考",
  "status": "assigned",
  "created_by": "sales-001",
  "assigned_to": "staff-001",
  "approved_by": "admin-001",
  ...
}
```

### 3. スケジュール作成（コンシェルジュ用）
```
POST /api/schedules
```

**リクエストボディ:**
```json
{
  "date": "2025-11-22",
  "time_slot": "10:00-12:00",
  "order_type": "regular",
  "client_id": "client-001",
  "store_id": "store-001",
  "cleaning_items": [
    {
      "name": "レンジフード洗浄",
      "notes": ["分解洗浄あり"],
      "quantity": 1,
      "unit": null
    }
  ],
  "notes": "備考",
  "address": "東京都中央区...",
  "phone": "03-1234-5678",
  "email": "info@example.com"
}
```

**レスポンス:**
```json
{
  "schedule_id": "uuid",
  "status": "pending",
  "message": "スケジュールを作成しました"
}
```

### 4. スケジュール更新
```
PUT /api/schedules/{schedule_id}
```

**リクエストボディ:**
```json
{
  "date": "2025-11-22",
  "time_slot": "10:00-12:00",
  "cleaning_items": [...],
  "notes": "更新された備考",
  ...
}
```

### 5. スケジュール承認・却下（管理者用）
```
POST /api/schedules/{schedule_id}/approve
POST /api/schedules/{schedule_id}/reject
```

**リクエストボディ:**
```json
{
  "reason": "承認理由" // rejectの場合のみ
}
```

### 6. スケジュール割り当て（管理者用）
```
POST /api/schedules/{schedule_id}/assign
```

**リクエストボディ:**
```json
{
  "assigned_to": "staff-001"
}
```

### 7. 作業開始（清掃員用）
```
POST /api/schedules/{schedule_id}/start
```

**リクエストボディ:**
```json
{
  "latitude": 35.6812,
  "longitude": 139.7671,
  "address": "東京都中央区..."
}
```

### 8. 作業完了（清掃員用）
```
POST /api/schedules/{schedule_id}/complete
```

**リクエストボディ:**
```json
{
  "report_id": "report-uuid" // オプション、レポート作成済みの場合
}
```

### 9. スケジュール削除
```
DELETE /api/schedules/{schedule_id}
```

---

## 📱 フロントエンド実装

### Phase 1: コンシェルジュ（営業）向け

#### 1.1 スケジュール作成画面
**ページ**: `/sales/schedules/new.html`

**機能:**
- 案件情報の入力フォーム
  - 日付・時間
  - 顧客・店舗選択（既存顧客から選択 or 新規入力）
  - 作業内容（cleaning_items）
  - 備考
- 作成ボタン → API呼び出し → ステータス: `pending`

#### 1.2 スケジュール一覧画面（既存拡張）
**ページ**: `/sales/schedule.html`

**機能:**
- 自分が作成したスケジュール一覧
- ステータス別フィルター（pending, approved, rejected, assigned, completed）
- 日付別フィルター
- スケジュール詳細表示・編集

---

### Phase 2: 管理者向け

#### 2.1 スケジュール管理画面
**ページ**: `/admin/schedules.html`

**機能:**
- 全スケジュール一覧（ステータス別タブ）
  - 承認待ち（pending）
  - 承認済み（approved）
  - 割り当て済み（assigned）
  - 作業中（in_progress）
  - 完了（completed）
- スケジュール詳細表示
- 承認・却下ボタン
- 清掃員への割り当て（ドロップダウンで選択）
- 一括操作（複数選択して一括承認・割り当て）

#### 2.2 ダッシュボード統合
**ページ**: `/admin/dashboard.html`

**機能:**
- 「承認待ちスケジュール数」カード（既存）
- 「今日の清掃予定」カード（既存）
- クイックリンク: 「スケジュール管理」→ `/admin/schedules.html`

---

### Phase 3: 清掃員向け

#### 3.1 スケジュール一覧画面（既存拡張）
**ページ**: `/staff/schedule.html`

**機能:**
- 自分に割り当てられたスケジュール一覧
- カレンダー表示（月次・週次）
- スケジュール詳細表示
  - 日時・場所
  - 作業内容
  - 顧客情報
  - 地図表示
- 作業開始ボタン
  - 位置情報取得（GPS）
  - 開始時刻記録
  - ステータス: `in_progress`
- 作業完了ボタン
  - 完了時刻記録
  - レポート作成へのリンク
  - ステータス: `completed`

#### 3.2 ダッシュボード統合
**ページ**: `/staff/dashboard.html`

**機能:**
- 「本日の予定」セクション（既存）
- 「作業開始」ボタン → スケジュール詳細へ
- 「レポート作成」ボタン → レポート作成画面へ

---

## 🔔 通知機能（将来実装）

### ブラウザ通知
- 清掃員: 作業開始時間のリマインダー（30分前、1時間前）
- 管理者: 承認待ちスケジュールの通知

### メール通知（AWS SNS）
- 清掃員: スケジュール割り当て通知
- コンシェルジュ: 承認・却下通知

---

## 📊 実装優先順位（フロントエンド側）

### Phase 1: UI実装（モックデータ使用）
1. ✅ コンシェルジュ向けスケジュール作成画面
   - 既存の`clients.json`を活用した顧客・店舗選択
   - フォーム入力・バリデーション
   - モックAPI呼び出し（実際のAPI完成まで）

2. ✅ 管理者向けスケジュール管理画面（承認・割り当て）
   - スケジュール一覧表示
   - ステータス別フィルター
   - 承認・却下・割り当てUI
   - モックAPI呼び出し

3. ✅ 清掃員向けスケジュール確認・作業開始/完了
   - カレンダー表示（既存の`/staff/schedule.html`を拡張）
   - スケジュール詳細表示
   - 作業開始・完了ボタン
   - モックAPI呼び出し

### Phase 2: UI改善
4. ✅ カレンダー表示の改善
5. ✅ フィルター機能の強化
6. ✅ ダッシュボード統合

### Phase 3: バックエンドAPI連携（API完成後）
7. ✅ モックAPIから実際のAPIへの切り替え
8. ✅ エラーハンドリングの実装
9. ✅ ローディング状態の表示

---

## 🚀 フロントエンド側の次のステップ

1. **既存データ構造の確認**
   - `clients.json`の構造を確認
   - 顧客・店舗選択UIの実装方針を決定

2. **UI実装（モックデータ使用）**
   - コンシェルジュ向け: スケジュール作成画面
   - 管理者向け: スケジュール管理画面
   - 清掃員向け: スケジュール確認・作業開始/完了

3. **バックエンドエンジニアとの連携**
   - API仕様の確認
   - データ構造の確認
   - 認証方式の確認（Azure Entra ID）

4. **API連携（API完成後）**
   - モックAPIから実際のAPIへの切り替え
   - エラーハンドリングの実装

---

## ❓ フロントエンド側の確認事項

1. **既存データ構造の活用**
   - `clients.json`の構造を確認済み（企業・ブランド・店舗の階層構造）
   - スケジュール作成時に、この構造を活用して顧客・店舗を選択するUIを実装

2. **作業内容（cleaning_items）の入力方法**
   - サービス管理（`services/service_items.json`）から選択？
   - 自由入力？
   - 両方対応？

3. **UI/UXの優先順位**
   - どの画面から実装を開始するか？（コンシェルジュ → 管理者 → 清掃員の順？）
   - カレンダー表示の優先度は？

4. **レポートとの連携**
   - スケジュール完了時に自動でレポート作成画面を開く？
   - レポートIDをスケジュールに紐付ける表示は必要？

---

## 📝 バックエンドエンジニアとの連携事項

以下の点について、バックエンドエンジニアと相談が必要です：

1. **API仕様の確定**
   - エンドポイントURL
   - リクエスト/レスポンス形式
   - 認証方式（Azure Entra ID）

2. **データ構造の確定**
   - スケジュールデータの構造
   - 顧客・店舗情報の参照方法
   - ステータスの定義

3. **実装スケジュール**
   - API完成予定時期
   - 段階的なリリース計画

