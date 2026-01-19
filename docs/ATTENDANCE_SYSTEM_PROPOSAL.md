# 勤怠記録システム設計提案

## 📋 概要

管理ページに勤怠記録機能を追加し、スタッフの出退勤管理と作業予定の記録を可能にします。

## 🎯 必要な機能

### 1. 出退勤ボタン（トグルスイッチ）
- ブラウザ上で出退勤をオン/オフできる
- タイムレコードを自動記録
- 現在の出退勤状態を視覚的に表示

### 2. カレンダー機能
- 月次カレンダー表示
- 誰がいつ勤務しているかを把握
- 出退勤時刻の表示
- フィルター機能（スタッフ別、日付別）

### 3. 作業予定記録
- 本日の作業予定を書き込む領域
- 作業内容の記録・編集
- 作業時間の記録

## 📁 ファイル構成

```
src/pages/admin/attendance/
  ├── index.html          # 勤怠記録メインページ
  └── [id].html          # スタッフ別詳細ページ（将来用）

src/data/
  └── attendance.json    # モックデータ（API連携前）
```

## 🗄️ データ構造

### 勤怠記録（Attendance Record）

```json
{
  "id": "uuid",
  "staff_id": "staff_user_id",
  "staff_name": "山田太郎",
  "date": "2025-01-15",
  "clock_in": "2025-01-15T09:00:00+09:00",
  "clock_out": "2025-01-15T18:00:00+09:00",
  "work_hours": 8.0,
  "break_hours": 1.0,
  "status": "working" | "completed" | "absent",
  "notes": "本日の作業予定: 新宿店の清掃、渋谷店の点検",
  "tasks": [
    {
      "id": "task_uuid",
      "description": "新宿店の清掃",
      "start_time": "09:30",
      "end_time": "12:00",
      "status": "completed"
    }
  ],
  "created_at": "2025-01-15T09:00:00+09:00",
  "updated_at": "2025-01-15T18:00:00+09:00"
}
```

## 🎨 UI設計

### レイアウト構成

```
┌─────────────────────────────────────────┐
│  勤怠記録管理                            │
├─────────────────────────────────────────┤
│  [今日の出退勤]                          │
│  ┌─────────────────────────────────┐   │
│  │ 出勤: 09:00  [退勤]              │   │
│  │ 本日の作業予定:                  │   │
│  │ [テキストエリア]                 │   │
│  └─────────────────────────────────┘   │
├─────────────────────────────────────────┤
│  [カレンダー表示]                        │
│  ┌─────────────────────────────────┐   │
│  │  ← 2025年1月 →                  │   │
│  │  日 月 火 水 木 金 土            │   │
│  │  ...                            │   │
│  │  15 [山田: 09:00-18:00]         │   │
│  │  16 [佐藤: 08:30-17:30]         │   │
│  └─────────────────────────────────┘   │
├─────────────────────────────────────────┤
│  [今月の勤怠一覧]                        │
│  ┌─────────────────────────────────┐   │
│  │ 日付 | スタッフ | 出勤 | 退勤 |  │   │
│  │ ...                            │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

## 🔌 API設計（将来実装）

### エンドポイント

```
GET    /api/attendance              # 勤怠一覧取得
GET    /api/attendance/{id}         # 勤怠詳細取得
POST   /api/attendance/clock-in     # 出勤記録
POST   /api/attendance/clock-out    # 退勤記録
PUT    /api/attendance/{id}         # 勤怠更新
GET    /api/attendance/calendar     # カレンダーデータ取得
```

## 💡 実装のポイント

### 1. 出退勤ボタン
- 大きなトグルスイッチで視認性を確保
- 現在の状態を明確に表示（出勤中/退勤済み）
- 出退勤時刻を自動記録

### 2. カレンダー表示
- 既存の `admin/schedules/index.html` のカレンダー実装を参考
- 日付ごとにスタッフ名と出退勤時刻を表示
- クリックで詳細表示

### 3. 作業予定記録
- テキストエリアで自由記述
- リアルタイム保存（オートセーブ）
- 過去の記録も閲覧可能

## 📝 参考になる既存コード

1. **カレンダー実装**: `src/pages/admin/schedules/index.html`
   - 月次カレンダーの表示ロジック
   - 日付のフィルタリング

2. **ダッシュボード**: `src/pages/staff/dashboard.html`
   - タイムライン表示
   - クイックアクション

3. **データ管理**: `src/assets/js/data_utils.js`
   - データ正規化のロジック

## 🚀 実装ステップ

1. **Phase 1: 基本UI実装**
   - 出退勤ボタンの実装
   - カレンダー表示の実装
   - モックデータでの動作確認

2. **Phase 2: データ記録機能**
   - 出退勤時刻の記録
   - 作業予定の保存
   - ローカルストレージでの一時保存

3. **Phase 3: API連携**
   - バックエンドAPIとの連携
   - データの永続化
   - リアルタイム更新

## 🎨 UIコンポーネント例

### 出退勤ボタン
```html
<div class="attendance-toggle">
  <div class="toggle-status" id="attendance-status">
    <span class="status-label">出勤中</span>
    <span class="status-time">09:00</span>
  </div>
  <button class="btn-toggle" id="clock-toggle">
    <span class="toggle-icon">⏰</span>
    <span class="toggle-text">退勤する</span>
  </button>
</div>
```

### カレンダーセル
```html
<div class="calendar-day has-attendance">
  <div class="day-number">15</div>
  <div class="attendance-list">
    <div class="attendance-item">
      <span class="staff-name">山田</span>
      <span class="time-range">09:00-18:00</span>
    </div>
  </div>
</div>
```

## 📊 統計情報（将来実装）

- 月間の総労働時間
- 平均労働時間
- 出勤日数
- 遅刻・早退の記録

