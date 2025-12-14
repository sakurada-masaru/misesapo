# スケジュールシステム仕様書

## 📋 概要

スケジュールシステムは、営業→管理→清掃員の業務フローを一元管理するためのシステムです。

## 🔄 業務フロー

```
1. 営業が案件を受注 → スケジュール作成（ステータス: draft）
   ↓
2. 管理側が確認・承認 → ステータス: pending → approved
   ↓
3. 管理側が清掃員にアサイン → ステータス: assigned
   ↓
4. 清掃員がスケジュールを確認
   ↓
5. 清掃員が作業開始 → ステータス: in_progress
   ↓
6. 清掃員がレポート作成・提出 → ステータス: completed
```

## 📊 データ構造

### スケジュール（schedules テーブル）

```json
{
  "id": "uuid",
  "date": "YYYY-MM-DD",
  "time_slot": "HH:MM-HH:MM",
  "order_type": "regular|spot|emergency",
  "client_id": "string",
  "client_name": "string",
  "store_id": "string",
  "store_name": "string",
  "address": "string",
  "phone": "string",
  "email": "string",
  "cleaning_items": [
    {
      "name": "string",
      "notes": ["string"],
      "quantity": "number|null",
      "unit": "string|null"
    }
  ],
  "notes": "string",
  "status": "draft|pending|approved|rejected|assigned|in_progress|completed|cancelled",
  "created_by": "user_id",
  "created_by_name": "string",
  "assigned_to": "staff_id|null",
  "assigned_to_name": "string|null",
  "approved_by": "user_id|null",
  "started_at": "ISO8601|null",
  "completed_at": "ISO8601|null",
  "report_id": "uuid|null",
  "created_at": "ISO8601",
  "updated_at": "ISO8601"
}
```

### レポート（staff-reports テーブル）

```json
{
  "report_id": "uuid",
  "schedule_id": "uuid|null",  // ⚠️ 現在未実装
  "store_id": "string",
  "store_name": "string",
  "cleaning_date": "YYYY-MM-DD",
  "cleaning_start_time": "HH:MM",
  "cleaning_end_time": "HH:MM",
  "work_items": [...],
  "status": "pending|approved|rejected|published",
  ...
}
```

## 🎯 各ユーザー別機能

### 1. 営業（Sales）

#### 1.1 スケジュール作成
- **ページ**: `/sales/schedules/new.html`
- **機能**:
  - 日付・時間帯の入力
  - 顧客・店舗の選択
  - 作業内容（cleaning_items）の選択
  - 見積もり情報の入力（オプション）
  - 備考の入力
- **API**: `POST /schedules`
- **ステータス**: `draft`（仮押さえ）
- **実装状況**: ✅ 実装済み

#### 1.2 スケジュール一覧
- **ページ**: `/sales/dashboard.html`（スケジュールセクション）
- **機能**:
  - 自分が作成したスケジュール一覧
  - ステータス別フィルター
  - 日付別フィルター
- **API**: `GET /schedules?created_by={user_id}`
- **実装状況**: ✅ 実装済み

### 2. 管理（Admin）

#### 2.1 スケジュール管理
- **ページ**: `/admin/schedules/index.html`
- **機能**:
  - 全スケジュール一覧
  - ステータス別タブ（承認待ち、承認済み、割り当て済み、作業中、完了）
  - スケジュール詳細表示
  - 承認・却下
  - 清掃員への割り当て
  - スケジュール編集
  - スケジュール削除
- **API**:
  - `GET /schedules`
  - `PUT /schedules/{id}`（承認・却下・割り当て）
  - `DELETE /schedules/{id}`
- **実装状況**: ✅ 実装済み

#### 2.2 ダッシュボード統合
- **ページ**: `/admin/dashboard.html`
- **機能**:
  - 承認待ちスケジュール数の表示
  - 今日の清掃予定の表示
- **実装状況**: ✅ 実装済み

### 3. 清掃員（Staff）

#### 3.1 スケジュール一覧
- **ページ**: `/staff/schedule.html`
- **機能**:
  - 自分に割り当てられたスケジュール一覧
  - カレンダー表示（月次・週次）
  - リスト表示
  - スケジュール詳細表示
- **API**: `GET /schedules?assigned_to={staff_id}`
- **実装状況**: ✅ 実装済み

#### 3.2 レポート作成
- **ページ**: `/staff/reports/new.html`
- **機能**:
  - スケジュール選択（⚠️ 現在未実装）
  - 作業内容の選択
  - 写真アップロード（作業前・作業後）
  - 作業時間の入力
  - メモの入力
  - レポート送信
- **API**: `POST /staff/reports`
- **実装状況**: ⚠️ スケジュール連携未実装

## ⚠️ 現在の問題点・未実装機能

### 1. レポートとスケジュールの連携
- **問題**: レポート作成時にスケジュールIDを紐付けていない
- **影響**: スケジュールからレポートへの遷移ができない
- **必要な修正**:
  - レポート作成時に`schedule_id`を保存
  - スケジュール完了時に`report_id`を更新
  - レポート作成画面でスケジュールを選択できるようにする

### 2. スケジュールステータスの自動更新
- **問題**: レポート提出時にスケジュールステータスが自動更新されない
- **影響**: スケジュールが`in_progress`のまま残る
- **必要な修正**:
  - レポート提出時にスケジュールを`completed`に更新
  - `report_id`をスケジュールに保存

### 3. 作業開始機能
- **問題**: 清掃員が作業開始を記録する機能がない
- **影響**: スケジュールが`assigned`から`in_progress`に自動更新されない
- **必要な修正**:
  - 作業開始ボタンの実装
  - 位置情報の取得（GPS）
  - スケジュールステータスの更新

## 🔧 実装が必要な機能

### 優先度: 高

1. **レポート作成時のスケジュール選択**
   - レポート作成画面にスケジュール選択ドロップダウンを追加
   - 選択したスケジュールの情報（店舗、日付、作業内容）を自動入力

2. **レポートとスケジュールの紐付け**
   - レポート作成時に`schedule_id`を保存
   - スケジュール更新時に`report_id`を保存

3. **スケジュールステータスの自動更新**
   - レポート提出時にスケジュールを`completed`に更新
   - 作業開始時にスケジュールを`in_progress`に更新

### 優先度: 中

4. **作業開始機能**
   - 清掃員がスケジュール詳細から作業開始ボタンを押す
   - 位置情報を取得して`started_at`と`start_location`を記録
   - ステータスを`in_progress`に更新

5. **スケジュールからレポートへの遷移**
   - スケジュール詳細画面からレポート作成画面へのリンク
   - スケジュール情報を自動入力

### 優先度: 低

6. **繰り返しスケジュール**
   - 定期清掃の自動生成
   - 繰り返し設定のUI

7. **通知機能**
   - スケジュール割り当て時の通知
   - 作業開始リマインダー

## 📝 API仕様

### スケジュール作成
```
POST /schedules
```

### スケジュール一覧取得
```
GET /schedules?status={status}&date={date}&assigned_to={staff_id}
```

### スケジュール詳細取得
```
GET /schedules/{id}
```

### スケジュール更新
```
PUT /schedules/{id}
```

### スケジュール削除
```
DELETE /schedules/{id}
```

### 作業開始
```
POST /schedules/{id}/start
Body: {
  "latitude": number,
  "longitude": number,
  "address": string
}
```

### 作業完了（レポート提出時）
```
PUT /schedules/{id}
Body: {
  "status": "completed",
  "report_id": "uuid"
}
```

## 🗄️ DynamoDBテーブル設計

### schedules テーブル
- **パーティションキー**: `id` (String)
- **ソートキー**: なし
- **GSI**:
  - `status-index`: `status` (HASH), `date` (RANGE)
  - `assigned_to-index`: `assigned_to` (HASH), `date` (RANGE)
  - `date-index`: `date` (HASH), `created_at` (RANGE)

### staff-reports テーブル
- **パーティションキー**: `report_id` (String)
- **ソートキー**: なし
- **GSI**:
  - `schedule_id-index`: `schedule_id` (HASH), `created_at` (RANGE)  // ⚠️ 未作成

## 📅 実装スケジュール

1. **Phase 1**: レポートとスケジュールの紐付け（1-2日）
2. **Phase 2**: スケジュールステータスの自動更新（1日）
3. **Phase 3**: 作業開始機能（1-2日）
4. **Phase 4**: UI改善・通知機能（2-3日）













