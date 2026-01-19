# 勤怠管理システムの実用化提案

## 🎯 現状の問題点

現在のシステムは以下の機能しかありません：
- ✅ 出勤時刻の記録
- ✅ 退勤時刻の記録
- ✅ 休憩時間の記録
- ✅ 実労働時間の計算

**不足している機能**：
- ❌ 所定労働時間の管理
- ❌ 遅刻・早退の判定
- ❌ 残業時間の自動計算
- ❌ 休日・祝日の管理
- ❌ 有給休暇の管理
- ❌ 月次集計・レポート
- ❌ 勤務パターンの設定

## 📋 実装すべき機能（優先順位順）

### Phase 1: 基本機能の拡張（最優先）

#### 1.1 所定労働時間の管理
- **目的**: 各従業員の所定労働時間を設定・管理
- **実装内容**:
  - `workers`テーブルに以下を追加:
    - `scheduled_start_time`: 所定開始時刻（例: "09:00"）
    - `scheduled_end_time`: 所定終了時刻（例: "18:00"）
    - `scheduled_work_hours`: 所定労働時間（例: 8.0）
    - `work_pattern`: 勤務パターン（"fulltime", "parttime", "shift"）
  - 管理画面で設定可能にする

#### 1.2 遅刻・早退の判定
- **目的**: 所定時刻との比較で遅刻・早退を自動判定
- **実装内容**:
  - `attendance`テーブルに以下を追加:
    - `is_late`: 遅刻フラグ（boolean）
    - `late_minutes`: 遅刻分数（number）
    - `is_early_leave`: 早退フラグ（boolean）
    - `early_leave_minutes`: 早退分数（number）
  - 出勤時に所定開始時刻と比較
  - 退勤時に所定終了時刻と比較

#### 1.3 残業時間の自動計算
- **目的**: 所定労働時間を超えた時間を自動計算
- **実装内容**:
  - `attendance`テーブルに以下を追加（既存の`overtime_hours`を拡張）:
    - `overtime_hours`: 残業時間（実労働時間 - 所定労働時間）
    - `overtime_type`: 残業タイプ（"regular", "late_night", "holiday"）
  - 実労働時間が所定労働時間を超えた場合に自動計算

### Phase 2: カレンダー管理

#### 2.1 休日・祝日の管理
- **目的**: 休日・祝日を管理し、休日出勤を記録
- **実装内容**:
  - 新しいDynamoDBテーブル `holidays` を作成:
    - `id`: 祝日ID
    - `date`: 日付（YYYY-MM-DD）
    - `name`: 祝日名
    - `type`: タイプ（"national", "company", "custom"）
  - `attendance`テーブルに以下を追加:
    - `is_holiday`: 休日フラグ（boolean）
    - `is_holiday_work`: 休日出勤フラグ（boolean）

#### 2.2 週休日の設定
- **目的**: 各従業員の週休日を設定
- **実装内容**:
  - `workers`テーブルに以下を追加:
    - `weekly_holidays`: 週休日配列（例: ["Saturday", "Sunday"]）

### Phase 3: 有給休暇管理

#### 3.1 有給休暇の記録
- **目的**: 有給取得を記録し、残日数を管理
- **実装内容**:
  - 新しいDynamoDBテーブル `paid_leaves` を作成:
    - `id`: 有給ID
    - `staff_id`: 従業員ID
    - `date`: 取得日（YYYY-MM-DD）
    - `type`: タイプ（"full", "half_morning", "half_afternoon"）
    - `reason`: 理由
    - `status`: ステータス（"pending", "approved", "rejected"）
  - `workers`テーブルに以下を追加:
    - `paid_leave_balance`: 有給残日数（number）

### Phase 4: 集計・レポート機能

#### 4.1 月次集計の拡張
- **目的**: 月間の詳細な集計データを提供
- **実装内容**:
  - 月次集計APIの拡張:
    - 総労働時間
    - 総残業時間
    - 遅刻回数
    - 早退回数
    - 出勤日数
    - 有給取得日数
    - 休日出勤日数

#### 4.2 ダッシュボード表示
- **目的**: 管理者・従業員向けに集計データを可視化
- **実装内容**:
  - 月間サマリーカード
  - グラフ表示（労働時間の推移、残業時間の推移など）
  - 異常値のアラート（過度な残業、連続勤務など）

## 🔧 実装詳細

### データ構造の拡張

#### `workers`テーブルに追加
```json
{
  "scheduled_start_time": "09:00",
  "scheduled_end_time": "18:00",
  "scheduled_work_hours": 8.0,
  "work_pattern": "fulltime",
  "weekly_holidays": ["Saturday", "Sunday"],
  "paid_leave_balance": 10.0
}
```

#### `attendance`テーブルに追加
```json
{
  "is_late": false,
  "late_minutes": 0,
  "is_early_leave": false,
  "early_leave_minutes": 0,
  "is_holiday": false,
  "is_holiday_work": false,
  "overtime_type": "regular"
}
```

### APIエンドポイントの拡張

#### 1. 従業員情報の更新（所定労働時間の設定）
```
PUT /workers/{id}
{
  "scheduled_start_time": "09:00",
  "scheduled_end_time": "18:00",
  "scheduled_work_hours": 8.0,
  "work_pattern": "fulltime",
  "weekly_holidays": ["Saturday", "Sunday"]
}
```

#### 2. 月次集計の取得（拡張）
```
GET /attendance/summary?staff_id={id}&year=2025&month=12
{
  "total_work_days": 20,
  "total_work_hours": 160.0,
  "total_overtime_hours": 15.5,
  "late_count": 2,
  "early_leave_count": 1,
  "paid_leave_days": 1.0,
  "holiday_work_days": 0
}
```

#### 3. 有給休暇の申請
```
POST /paid-leaves
{
  "staff_id": "W1234567890",
  "date": "2025-12-25",
  "type": "full",
  "reason": "私用"
}
```

## 📊 実装優先順位

1. **Phase 1.1**: 所定労働時間の管理（最優先）
2. **Phase 1.2**: 遅刻・早退の判定
3. **Phase 1.3**: 残業時間の自動計算
4. **Phase 2.1**: 休日・祝日の管理
5. **Phase 3.1**: 有給休暇の記録
6. **Phase 4.1**: 月次集計の拡張

## 🎯 期待される効果

- ✅ 実用的な勤怠管理が可能になる
- ✅ 給与計算への連携が容易になる
- ✅ 労働時間の適正管理が可能になる
- ✅ 従業員の勤務状況を可視化できる
- ✅ コンプライアンス対応が容易になる

