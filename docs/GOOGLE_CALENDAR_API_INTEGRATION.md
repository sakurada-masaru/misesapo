# Google Calendar API統合ガイド

## 概要

このガイドでは、Google Calendar APIを使用してスケジュールをGoogleカレンダーに自動的に作成する方法を説明します。

## 前提条件

1. Google Cloud Platform (GCP) プロジェクトの作成
2. Google Calendar APIの有効化
3. サービスアカウントまたはOAuth 2.0認証の設定
4. 必要なライブラリのインストール

## 認証方法の選択

### 方法1: サービスアカウント（推奨）

**メリット:**
- サーバーサイドで動作
- ユーザー認証不要
- 特定のカレンダーに自動的にイベントを作成

**デメリット:**
- 共有カレンダーが必要（サービスアカウントのメールアドレスを共有）

### 方法2: OAuth 2.0

**メリット:**
- ユーザーの個人カレンダーに直接作成可能
- より柔軟な権限管理

**デメリット:**
- ユーザー認証が必要
- トークン管理が複雑

## 実装手順

### ステップ1: Google Cloud Platformの設定

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. プロジェクトを作成または選択
3. 「APIとサービス」→「ライブラリ」から「Google Calendar API」を検索して有効化

### ステップ2: サービスアカウントの作成（方法1の場合）

1. 「IAMと管理」→「サービスアカウント」を選択
2. 「サービスアカウントを作成」をクリック
3. サービスアカウント名を入力（例: `misesapo-calendar`）
4. 「作成して続行」をクリック
5. キーを作成:
   - サービスアカウントを選択
   - 「キー」タブを開く
   - 「キーを追加」→「新しいキーを作成」
   - JSON形式を選択してダウンロード

### ステップ3: カレンダーの共有設定

1. Googleカレンダーを開く
2. カレンダー設定を開く
3. 「特定のユーザーと共有」セクションで、サービスアカウントのメールアドレス（`xxx@xxx.iam.gserviceaccount.com`）を追加
4. 権限を「変更イベントの管理」に設定

### ステップ4: Lambda関数への実装

Lambda関数にGoogle Calendar APIクライアントを追加し、スケジュール作成時にイベントを作成します。

#### 4.1 必要なライブラリのインストール

Lambda Layerまたはrequirements.txtに以下を追加:

```txt
google-api-python-client==2.108.0
google-auth-httplib2==0.1.1
google-auth-oauthlib==1.1.0
```

#### 4.2 環境変数の設定

Lambda関数の環境変数に以下を設定:

- `GOOGLE_CALENDAR_ENABLED`: `true` に設定して機能を有効化
- `GOOGLE_CALENDAR_ID`: カレンダーID（サービスアカウントのメールアドレスまたは`primary`）
- `GOOGLE_SERVICE_ACCOUNT_JSON`: サービスアカウントのJSONキー（文字列形式）

**注意**: セキュリティのため、サービスアカウントのJSONキーはAWS Secrets Managerに保存することを推奨します。

#### 4.3 AWS Secrets Managerを使用する場合（推奨）

1. AWS Secrets Managerでシークレットを作成:
   - シークレット名: `google-calendar-service-account`
   - シークレット値: サービスアカウントのJSONキー（文字列形式）

2. Lambda関数に以下のIAM権限を追加:
   ```json
   {
     "Effect": "Allow",
     "Action": [
       "secretsmanager:GetSecretValue"
     ],
     "Resource": "arn:aws:secretsmanager:REGION:ACCOUNT_ID:secret:google-calendar-service-account-*"
   }
   ```

3. `lambda_function.py`の`get_google_calendar_service()`関数を修正してSecrets Managerから取得するように変更

### ステップ5: 動作確認

1. スケジュールを作成
2. Googleカレンダーにイベントが作成されているか確認
3. Lambda関数のログでエラーがないか確認

## 実装例

詳細な実装例は `lambda_function.py` を参照してください。

## 認証情報の設定

認証情報の設定方法については、以下のドキュメントを参照してください:

- **[認証情報の設定方法（詳細）](GOOGLE_CALENDAR_AUTH_SETUP.md)**: 詳しい設定手順とトラブルシューティング
- **[クイックスタートガイド](GOOGLE_CALENDAR_QUICK_START.md)**: 最短で設定する方法

### 主な関数

- `get_google_calendar_service()`: Google Calendar APIサービスオブジェクトを取得
- `create_google_calendar_event(schedule_data)`: Google Calendarにイベントを作成

### スケジュール作成時の動作

1. DynamoDBにスケジュールを保存
2. Google Calendarにイベントを作成（`GOOGLE_CALENDAR_ENABLED=true`の場合）
3. 作成されたイベントIDをスケジュールデータに保存

### レスポンス例

```json
{
  "status": "success",
  "message": "スケジュールを作成しました",
  "schedule_id": "SCH-20250101-001",
  "google_calendar": {
    "success": true,
    "event_id": "abc123...",
    "html_link": "https://www.google.com/calendar/event?eid=...",
    "message": "Google Calendarイベントを作成しました"
  }
}
```

## トラブルシューティング

### エラー: "Google Calendar API libraries not available"

**原因**: 必要なライブラリがインストールされていない

**解決方法**: Lambda Layerまたはrequirements.txtに必要なライブラリを追加

### エラー: "Failed to initialize Google Calendar service"

**原因**: サービスアカウントの認証情報が正しく設定されていない

**解決方法**: 
- 環境変数`GOOGLE_SERVICE_ACCOUNT_JSON`が正しく設定されているか確認
- サービスアカウントのJSONキーが有効か確認

### エラー: "Calendar not found"

**原因**: カレンダーIDが正しくない、またはカレンダーが共有されていない

**解決方法**:
- 環境変数`GOOGLE_CALENDAR_ID`が正しいか確認
- サービスアカウントのメールアドレスがカレンダーに共有されているか確認

## セキュリティに関する注意事項

1. **サービスアカウントキーの管理**: サービスアカウントのJSONキーは機密情報です。環境変数に直接設定するのではなく、AWS Secrets Managerを使用することを強く推奨します。

2. **最小権限の原則**: サービスアカウントには必要最小限の権限のみを付与してください。

3. **カレンダーの共有**: サービスアカウントに共有するカレンダーは、必要最小限の権限（「変更イベントの管理」）のみを付与してください。

