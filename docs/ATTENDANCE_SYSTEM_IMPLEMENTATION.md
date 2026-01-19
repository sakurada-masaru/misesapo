# 勤怠システム実装ガイド

## 📋 概要

従業員がスタッフ窓口からログインし、マイページから勤怠を記録できるシステムを実装しました。

## 🎯 実装内容

### 1. ログイン後のリダイレクト

- **全ロールをマイページにリダイレクト**
  - スタッフログイン（`/staff/signin.html`）後、全ロールが`/staff/mypage.html`にリダイレクト
  - 従業員IDをURLパラメータとして渡す（`/staff/mypage.html?id={従業員ID}`）

### 2. マイページの表示

- **従業員IDで表示**
  - URLパラメータ（`?id={従業員ID}`）からIDを取得
  - 認証情報からIDを取得（フォールバック）
  - APIから従業員情報を取得して表示

### 3. 勤怠機能

- **勤怠ボタン（スイッチ）**
  - 出勤/退勤/再出勤を切り替え
  - 現在の状態を視覚的に表示
  - 出退勤時刻を自動記録

- **勤怠データの保存**
  - API（`/attendance`）に保存
  - ローカルストレージにも保存（オフライン対応）
  - API保存に失敗した場合でもローカルストレージに保存

## 🔌 APIエンドポイント

### POST /attendance
勤怠記録を作成または更新

**リクエストボディ:**
```json
{
  "staff_id": "W00001",
  "staff_name": "山田太郎",
  "date": "2025-01-15",
  "clock_in": "2025-01-15T09:00:00Z",
  "clock_out": "2025-01-15T18:00:00Z"
}
```

**レスポンス:**
```json
{
  "status": "success",
  "message": "勤怠記録を保存しました"
}
```

### GET /attendance?staff_id={id}&date={date}
特定の従業員の特定日の勤怠記録を取得

**レスポンス:**
```json
{
  "id": "2025-01-15_W00001",
  "staff_id": "W00001",
  "staff_name": "山田太郎",
  "date": "2025-01-15",
  "clock_in": "2025-01-15T09:00:00Z",
  "clock_out": "2025-01-15T18:00:00Z",
  "created_at": "2025-01-15T09:00:00Z",
  "updated_at": "2025-01-15T18:00:00Z"
}
```

### GET /attendance?staff_id={id}
特定の従業員の勤怠記録一覧を取得

**レスポンス:**
```json
{
  "items": [
    {
      "id": "2025-01-15_W00001",
      "staff_id": "W00001",
      "staff_name": "山田太郎",
      "date": "2025-01-15",
      "clock_in": "2025-01-15T09:00:00Z",
      "clock_out": "2025-01-15T18:00:00Z"
    }
  ]
}
```

## 🗄️ DynamoDBテーブル

### attendance テーブル

**テーブル名:** `attendance`

**スキーマ:**
- `id` (String, パーティションキー): `{date}_{staff_id}` 形式（例: `2025-01-15_W00001`）
- `staff_id` (String): 従業員ID
- `staff_name` (String): 従業員名
- `date` (String): 日付（YYYY-MM-DD形式）
- `clock_in` (String): 出勤時刻（ISO 8601形式）
- `clock_out` (String): 退勤時刻（ISO 8601形式）
- `created_at` (String): 作成日時
- `updated_at` (String): 更新日時

**GSI（オプション）:**
- `staff_id-date-index`: `staff_id`をパーティションキー、`date`をソートキーとするGSI（将来的に追加可能）

## 📝 実装ファイル

### フロントエンド
- `src/pages/staff/signin.html` - ログイン後のリダイレクト設定
- `src/pages/staff/mypage.html` - マイページと勤怠機能
- `src/assets/js/role_config.js` - ロールごとのデフォルトページ設定

### バックエンド
- `lambda_function.py` - 勤怠APIエンドポイントの実装

## 🚀 使用方法

### 1. 従業員のログイン

1. `/staff/signin.html`にアクセス
2. メールアドレスとパスワードでログイン
3. 自動的に`/staff/mypage.html?id={従業員ID}`にリダイレクト

### 2. 勤怠の記録

1. マイページの「出退勤記録」セクションを確認
2. 「出勤する」ボタンをクリック（出勤）
3. 「退勤する」ボタンをクリック（退勤）
4. 出退勤時刻が自動的に記録される

### 3. 勤怠データの確認

- マイページに今月の出勤日数と総労働時間が表示される
- カレンダーに出退勤記録がある日がマークされる

## ⚙️ 設定

### DynamoDBテーブルの作成

`attendance`テーブルをDynamoDBに作成する必要があります。

**テーブル設定:**
- テーブル名: `attendance`
- パーティションキー: `id` (String)
- 読み取り/書き込みキャパシティ: オンデマンドまたはプロビジョニング

**GSI（オプション）:**
- インデックス名: `staff_id-date-index`
- パーティションキー: `staff_id` (String)
- ソートキー: `date` (String)

### API Gatewayの設定

`/attendance`エンドポイントをAPI Gatewayに追加する必要があります。

**必要なメソッド:**
- `GET /attendance` - 勤怠記録の取得
- `POST /attendance` - 勤怠記録の作成/更新

**CORS設定:**
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS`
- `Access-Control-Allow-Headers: Content-Type,Authorization`

## 🔄 データフロー

```
1. 従業員がログイン
   ↓
2. /staff/signin.html で認証
   ↓
3. 従業員IDを取得
   ↓
4. /staff/mypage.html?id={従業員ID} にリダイレクト
   ↓
5. マイページで従業員情報を表示
   ↓
6. 勤怠ボタンをクリック
   ↓
7. API (/attendance) に保存
   ↓
8. ローカルストレージにも保存（オフライン対応）
   ↓
9. UIを更新
```

## 📊 データ構造

### 勤怠記録（Attendance Record）

```json
{
  "id": "2025-01-15_W00001",
  "staff_id": "W00001",
  "staff_name": "山田太郎",
  "date": "2025-01-15",
  "clock_in": "2025-01-15T09:00:00Z",
  "clock_out": "2025-01-15T18:00:00Z",
  "created_at": "2025-01-15T09:00:00Z",
  "updated_at": "2025-01-15T18:00:00Z"
}
```

## 🎨 UIコンポーネント

### 出退勤ボタン

- **状態表示**: 出勤中/退勤済み/未出勤
- **ボタンテキスト**: 「出勤する」/「退勤する」/「再出勤」
- **時刻表示**: 出退勤時刻を表示

### 統計表示

- **今月の出勤日数**: カレンダーから自動計算
- **今月の総労働時間**: 出退勤時刻から自動計算

## 🔒 セキュリティ

- 従業員は自分のIDでしかマイページにアクセスできない
- 認証情報から従業員IDを取得し、APIで検証
- URLパラメータでIDを指定する場合も、認証情報と照合

## 📝 今後の拡張

- 勤怠記録の編集機能
- 勤怠記録の削除機能
- 月次レポートの生成
- 勤怠データのエクスポート機能
- 管理者画面での勤怠一覧表示

