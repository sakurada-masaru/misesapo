# Google Calendar API クイックスタートガイド

このガイドでは、Google Calendar APIの認証情報を最短で設定する方法を説明します。

## 📋 前提条件

- Googleアカウント
- AWSアカウント
- Lambda関数が既にデプロイされていること

## 🚀 5分で設定する手順

### ステップ1: Google Cloud Platformでサービスアカウントを作成（2分）

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. プロジェクトを作成または選択
3. 「APIとサービス」→「ライブラリ」→「Google Calendar API」を有効化
4. 「IAMと管理」→「サービスアカウント」→「サービスアカウントを作成」
5. 名前を入力（例: `misesapo-calendar`）→「作成して続行」→「完了」
6. 作成したサービスアカウントをクリック→「キー」タブ→「キーを追加」→「新しいキーを作成」→「JSON」を選択→ダウンロード

### ステップ2: カレンダーを共有（1分）

1. [Googleカレンダー](https://calendar.google.com/)を開く
2. カレンダー設定を開く
3. 「特定のユーザーと共有」→「ユーザーを追加」
4. ダウンロードしたJSONファイルの`client_email`の値を入力
5. 権限を「変更イベントの管理」に設定→「送信」

### ステップ3: Lambda関数に環境変数を設定（2分）

#### 方法A: 環境変数を使用（簡単・開発用）

1. AWS Lambdaコンソールで関数を選択
2. 「設定」→「環境変数」→「編集」
3. 以下を追加:

```
GOOGLE_CALENDAR_ENABLED = true
GOOGLE_CALENDAR_ID = [サービスアカウントのメールアドレスまたはカレンダーID]
GOOGLE_SERVICE_ACCOUNT_JSON = [JSONファイルの内容を1行の文字列に変換]
```

**JSONを1行に変換:**
```bash
# macOS/Linux
cat service-account-key.json | jq -c .
```

#### 方法B: Secrets Managerを使用（推奨・本番用）

1. AWS Secrets Managerでシークレットを作成:
   - 名前: `google-calendar-service-account`
   - 値: JSONファイルの内容を1行の文字列に変換
2. Lambda関数の実行ロールにSecrets Managerの読み取り権限を追加
3. Lambda関数の環境変数に以下を追加:

```
GOOGLE_CALENDAR_ENABLED = true
GOOGLE_CALENDAR_ID = [サービスアカウントのメールアドレスまたはカレンダーID]
GOOGLE_SERVICE_ACCOUNT_SECRET_NAME = google-calendar-service-account
```

## ✅ 動作確認

1. スケジュールを作成
2. Googleカレンダーでイベントが作成されているか確認

## 📚 詳細な手順

より詳しい手順やトラブルシューティングは、[認証情報の設定方法](GOOGLE_CALENDAR_AUTH_SETUP.md)を参照してください。













