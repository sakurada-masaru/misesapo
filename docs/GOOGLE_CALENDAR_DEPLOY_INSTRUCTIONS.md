# Google Calendar API デプロイ手順

## ✅ 完了した作業

1. ✅ Google Calendar APIからイベントを取得する機能を実装
2. ✅ API Gatewayの設定を完了

## 🚀 次のステップ: Lambda関数をデプロイ

### ステップ1: Lambda関数のコードを更新

1. **AWS Lambdaコンソールを開く**
   - https://console.aws.amazon.com/lambda/ にアクセス
   - リージョン: `ap-northeast-1` を選択

2. **Lambda関数を選択**
   - 関数名: `misesapo-s3-upload` を選択

3. **コードを更新**
   - 「コード」タブを開く
   - ローカルの `lambda_function.py` の内容をすべてコピー
   - Lambda関数のコードエディタに貼り付け
   - 「Deploy」ボタンをクリック
   - デプロイが完了するまで待つ（数秒〜数十秒）

4. **デプロイの確認**
   - 「Last modified: ...」が最新の日時になっていることを確認

### ステップ2: 環境変数の確認

1. **「設定」タブ** → **「環境変数」** を開く
2. 以下が設定されているか確認：
   ```
   GOOGLE_CALENDAR_ENABLED: true
   GOOGLE_CALENDAR_ID: [カレンダーID]
   GOOGLE_SERVICE_ACCOUNT_SECRET_NAME: [シークレット名] (または GOOGLE_SERVICE_ACCOUNT_JSON)
   ```

### ステップ3: 動作確認

デプロイが完了したら、以下のコマンドでテスト：

```bash
# イベント一覧を取得（今日から30日後まで）
curl 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod/google-calendar/events'

# 特定の日付範囲でイベントを取得
curl 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod/google-calendar/events?start_date=2025-01-15T00:00:00%2B09:00&end_date=2025-01-15T23:59:59%2B09:00'

# 特定のイベントを取得（EVENT_IDを実際のイベントIDに置き換える）
curl 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod/google-calendar/events/EVENT_ID'
```

## 📋 実装された機能

### APIエンドポイント

1. **`GET /google-calendar/events`** - イベント一覧取得
   - クエリパラメータ:
     - `start_date` (オプション): 開始日時 (ISO 8601形式)
     - `end_date` (オプション): 終了日時 (ISO 8601形式)
     - `max_results` (オプション): 最大取得件数 (デフォルト: 100)

2. **`GET /google-calendar/events/{event_id}`** - イベント詳細取得

### レスポンス形式

#### イベント一覧
```json
{
  "success": true,
  "events": [
    {
      "event_id": "abc123...",
      "summary": "店舗名 - 清掃",
      "description": "【清掃項目】\n・グリストラップ\n【スケジュールID】\nSCH-20250115-001",
      "location": "東京都新宿区...",
      "start": {
        "dateTime": "2025-01-15T10:00:00+09:00",
        "timeZone": "Asia/Tokyo"
      },
      "end": {
        "dateTime": "2025-01-15T11:00:00+09:00",
        "timeZone": "Asia/Tokyo"
      },
      "html_link": "https://www.google.com/calendar/event?eid=...",
      "status": "confirmed",
      "schedule_id": "SCH-20250115-001"  // 説明から抽出
    }
  ],
  "count": 1
}
```

#### イベント詳細
```json
{
  "success": true,
  "event_id": "abc123...",
  "summary": "店舗名 - 清掃",
  "description": "...",
  "location": "...",
  "start": {...},
  "end": {...},
  "html_link": "...",
  "created": "2025-01-10T09:00:00Z",
  "updated": "2025-01-10T09:00:00Z",
  "status": "confirmed",
  "schedule_id": "SCH-20250115-001"  // 説明から抽出
}
```

## 🔧 トラブルシューティング

### エラー: "Google Calendar integration is disabled"
- 環境変数 `GOOGLE_CALENDAR_ENABLED` が `true` に設定されているか確認

### エラー: "Failed to initialize Google Calendar service"
- 環境変数 `GOOGLE_SERVICE_ACCOUNT_SECRET_NAME` または `GOOGLE_SERVICE_ACCOUNT_JSON` が正しく設定されているか確認
- AWS Secrets Managerに認証情報が保存されているか確認

### エラー: "Calendar not found"
- 環境変数 `GOOGLE_CALENDAR_ID` が正しいか確認
- サービスアカウントのメールアドレスがカレンダーに共有されているか確認

