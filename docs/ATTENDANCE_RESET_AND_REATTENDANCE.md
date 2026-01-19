# 出退勤のリセットと再出勤の扱い

## 現在の実装状況

### 1. 日付のリセットタイミング

**現在の動作：**
- `const today = new Date().toISOString().split('T')[0];` で毎回現在の日付を取得
- 日付が変わると自動的に新しい日付として扱われる
- **問題点**: ローカルストレージには前日のデータが残っている

**リセットされるタイミング：**
- ページを読み込んだ時点で、現在の日付が取得される
- 日付が変わると、`today`変数は新しい日付になる
- しかし、`attendanceRecords[today]`が存在しない場合、前日のデータが表示され続ける可能性がある

### 2. 再出勤の扱い

**現在の実装：**

#### フロントエンド（staff-mypage.js）
```javascript
// 退勤済みの状態で「出勤」ボタンを押すと再出勤として扱われる
else {
  // 再出勤（1日1回制限の例外：退勤後の再出勤は別記録として扱う）
  attendanceData = {
    staff_id: currentUser.id,
    staff_name: currentUser.name,
    date: today,  // 同じ日付
    clock_in: now,
    breaks: []
  };
  // 既存のレコードを上書き（clock_outが消える）
  attendanceRecords[today][currentUser.id] = {
    clock_in: now,
    staff_id: currentUser.id,
    staff_name: currentUser.name,
    breaks: []
  };
}
```

#### Lambda関数（lambda_function.py）
```python
# 退勤済みの場合は、再出勤として別記録として扱う（IDを変更）
# 再出勤の場合は、新しいIDを生成（日付_従業員ID_2, _3...）
counter = 2
new_attendance_id = f"{date}_{staff_id}_{counter}"
while True:
    check_response = ATTENDANCE_TABLE.get_item(Key={'id': new_attendance_id})
    if 'Item' not in check_response:
        attendance_id = new_attendance_id
        existing_item = None  # 新規作成として扱う
        break
    counter += 1
    new_attendance_id = f"{date}_{staff_id}_{counter}"
```

**問題点：**
1. フロントエンドでは既存レコードを上書きしているが、Lambda関数では別レコードとして作成される
2. 再出勤のデータが複数のレコードに分散する
3. 出勤履歴ページで複数のレコードが表示される可能性がある

## 改善案

### 案1: 再出勤を別レコードとして明確に扱う（推奨）

**メリット：**
- 1日の複数の勤務時間を正確に記録できる
- データの整合性が保たれる
- 出勤履歴で複数の勤務時間を確認できる

**実装：**
1. フロントエンドで再出勤時も別レコードとして扱う
2. 出勤履歴ページで同じ日付の複数レコードを統合表示
3. マイページでは最新のレコードのみ表示

### 案2: 再出勤を同じレコードの更新として扱う

**メリット：**
- シンプルな実装
- 1日1レコードで管理しやすい

**デメリット：**
- 最初の退勤時刻が失われる
- 複数の勤務時間を記録できない

### 案3: 日付が変わったときに自動的にリセット

**実装：**
```javascript
// ページ読み込み時または日付変更時に実行
function checkAndResetAttendance() {
  const today = new Date().toISOString().split('T')[0];
  const lastCheckDate = localStorage.getItem('lastAttendanceCheckDate');
  
  if (lastCheckDate && lastCheckDate !== today) {
    // 日付が変わった場合、前日のデータをクリア
    // または、前日のデータを保持して新しい日付のデータを初期化
    console.log('日付が変わりました。前日のデータ:', lastCheckDate);
  }
  
  localStorage.setItem('lastAttendanceCheckDate', today);
}
```

## 推奨実装

### 1. 日付リセットの改善

```javascript
// ページ読み込み時に実行
function initializeAttendanceForToday() {
  const today = new Date().toISOString().split('T')[0];
  const lastCheckDate = localStorage.getItem('lastAttendanceCheckDate');
  
  // 日付が変わった場合
  if (lastCheckDate && lastCheckDate !== today) {
    console.log('[Attendance] 日付が変わりました。新しい日の出退勤を開始します。');
    // 前日のデータは保持（出勤履歴で使用）
    // 今日のデータを初期化
    if (!attendanceRecords[today]) {
      attendanceRecords[today] = {};
    }
  }
  
  localStorage.setItem('lastAttendanceCheckDate', today);
}
```

### 2. 再出勤の扱いを統一

**フロントエンド：**
```javascript
// 再出勤時も別レコードとして扱う（Lambda関数と統一）
else {
  // 再出勤：既存のレコードは保持し、新しいレコードを作成
  // ただし、UI上は最新のレコードのみ表示
  attendanceData = {
    staff_id: currentUser.id,
    staff_name: currentUser.name,
    date: today,
    clock_in: now,
    breaks: []
  };
  
  // 既存のレコードは保持（出勤履歴で使用）
  // 新しいレコードを追加（Lambda関数で別IDとして作成される）
  // UI上は最新のレコードのみ表示
}
```

**表示ロジック：**
```javascript
function renderAttendanceStatus() {
  const today = new Date().toISOString().split('T')[0];
  
  // 同じ日付の複数レコードから最新のものを取得
  const todayRecords = getTodayRecords(today); // APIから取得した複数レコード
  const latestRecord = todayRecords[todayRecords.length - 1]; // 最新のレコード
  
  if (latestRecord && latestRecord.clock_in && !latestRecord.clock_out) {
    // 出勤中
  } else if (latestRecord && latestRecord.clock_out) {
    // 退勤済み（再出勤可能）
  } else {
    // 未出勤
  }
}
```

## 実装の優先順位

1. **最優先**: 日付が変わったときのリセット処理
2. **重要**: 再出勤の扱いを統一（フロントエンドとLambda関数）
3. **改善**: 出勤履歴ページで複数レコードを統合表示






