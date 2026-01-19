# Google Calendar API OAuth 2.0認証設定方法

## 概要

サービスアカウントのキー作成が許可されていない場合、OAuth 2.0を使用してGoogle Calendar APIにアクセスする方法です。

## 前提条件

1. Google Cloud Platform (GCP) プロジェクトの作成
2. Google Calendar APIの有効化
3. OAuth 2.0認証情報の作成
4. リフレッシュトークンの取得

## 認証フローの概要

1. **初回認証**: ユーザーがGoogleアカウントでログインして認証
2. **トークン取得**: アクセストークンとリフレッシュトークンを取得
3. **トークン保存**: リフレッシュトークンをAWS Secrets Managerに保存
4. **自動更新**: アクセストークンの有効期限が切れたら、リフレッシュトークンで自動更新

## 実装手順

### ステップ1: OAuth 2.0認証情報の作成

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. 「APIとサービス」→「認証情報」を選択
3. 「認証情報を作成」→「OAuth クライアント ID」を選択
4. アプリケーションの種類: 「ウェブアプリケーション」を選択
5. 名前: `misesapo-calendar-oauth`（任意）
6. **承認済みのリダイレクト URI**を追加:
   - 開発環境: `http://localhost:8080/oauth2callback`
   - 本番環境: `https://your-domain.com/oauth2callback`
7. 「作成」をクリック
8. **クライアントID**と**クライアントシークレット**をコピー（後で使用）

### ステップ2: リフレッシュトークンの取得

リフレッシュトークンを取得するには、一度OAuth認証フローを実行する必要があります。

#### 方法1: ローカルで認証フローを実行（推奨）

以下のPythonスクリプトを実行して、リフレッシュトークンを取得します：

```python
import os
from google_auth_oauthlib.flow import Flow
from google.auth.transport.requests import Request

# OAuth 2.0認証情報
CLIENT_ID = 'your-client-id'
CLIENT_SECRET = 'your-client-secret'
REDIRECT_URI = 'http://localhost:8080/oauth2callback'
SCOPES = ['https://www.googleapis.com/auth/calendar']

# OAuth 2.0フローを作成
flow = Flow.from_client_config(
    {
        "web": {
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [REDIRECT_URI]
        }
    },
    scopes=SCOPES,
    redirect_uri=REDIRECT_URI
)

# 認証URLを生成
auth_url, _ = flow.authorization_url(prompt='consent')
print(f'以下のURLにアクセスして認証してください:')
print(auth_url)

# リダイレクト後のURLを入力
authorization_response = input('リダイレクト後のURLを入力してください: ')

# トークンを取得
flow.fetch_token(authorization_response=authorization_response)
credentials = flow.credentials

# リフレッシュトークンを表示
print(f'\nリフレッシュトークン: {credentials.refresh_token}')
print(f'アクセストークン: {credentials.token}')
```

#### 方法2: ウェブアプリケーションで認証フローを実装

認証用のエンドポイントを作成し、ユーザーがブラウザで認証できるようにします。

### ステップ3: リフレッシュトークンをAWS Secrets Managerに保存

1. **AWS Secrets Managerコンソール**を開く
2. 「シークレットを保存」をクリック
3. 「その他のシークレットタイプ」を選択
4. 「プレーンテキスト」を選択
5. **シークレット値**: 以下のJSON形式で保存

```json
{
  "client_id": "your-client-id",
  "client_secret": "your-client-secret",
  "refresh_token": "your-refresh-token",
  "token_uri": "https://oauth2.googleapis.com/token"
}
```

6. **シークレット名**: `google-calendar-oauth2-credentials`
7. 「保存」をクリック

### ステップ4: Lambda関数のコードを更新

`lambda_function.py`にOAuth 2.0認証を追加します：

```python
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow

def get_google_calendar_service_oauth2():
    """
    OAuth 2.0を使用してGoogle Calendar APIサービスオブジェクトを取得
    """
    if not GOOGLE_CALENDAR_AVAILABLE or not GOOGLE_CALENDAR_ENABLED:
        return None
    
    try:
        # AWS Secrets ManagerからOAuth 2.0認証情報を取得
        secrets_client = boto3.client('secretsmanager')
        secret_response = secrets_client.get_secret_value(
            SecretId='google-calendar-oauth2-credentials'
        )
        oauth_info = json.loads(secret_response['SecretString'])
        
        # 認証情報を作成
        credentials = Credentials(
            token=None,  # 初回はNone（リフレッシュトークンから取得）
            refresh_token=oauth_info['refresh_token'],
            token_uri=oauth_info['token_uri'],
            client_id=oauth_info['client_id'],
            client_secret=oauth_info['client_secret'],
            scopes=['https://www.googleapis.com/auth/calendar']
        )
        
        # トークンをリフレッシュ（必要に応じて）
        if not credentials.valid:
            credentials.refresh(Request())
        
        # Calendar APIサービスを構築
        service = build('calendar', 'v3', credentials=credentials)
        return service
    except Exception as e:
        print(f"Error creating Google Calendar service with OAuth 2.0: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return None
```

### ステップ5: Lambda関数の環境変数を設定

1. **AWS Lambdaコンソール**を開く
2. Lambda関数を選択
3. 「設定」タブ→「環境変数」を選択
4. 「編集」をクリック
5. 以下の環境変数を追加:

| キー | 値 | 説明 |
|------|-----|------|
| `GOOGLE_CALENDAR_ENABLED` | `true` | Google Calendar統合を有効化 |
| `GOOGLE_CALENDAR_ID` | `your-calendar-id` | カレンダーID |
| `GOOGLE_OAUTH2_SECRET_NAME` | `google-calendar-oauth2-credentials` | Secrets Managerのシークレット名 |
| `GOOGLE_AUTH_METHOD` | `oauth2` | 認証方法（`oauth2`または`service_account`） |

### ステップ6: Lambda関数のIAM権限を設定

Lambda関数の実行ロールに、Secrets Managerへの読み取り権限を追加してください。

詳細は `docs/GOOGLE_CALENDAR_AUTH_SETUP.md` の「方法B: AWS Secrets Managerを使用」セクションを参照してください。

---

## 注意事項

1. **リフレッシュトークンの有効期限**
   - リフレッシュトークンは通常無期限ですが、ユーザーがアクセスを取り消した場合は無効になります
   - 定期的にトークンの有効性を確認してください

2. **セキュリティ**
   - リフレッシュトークンは機密情報です。必ずAWS Secrets Managerに保存してください
   - 環境変数には保存しないでください

3. **ユーザー認証**
   - OAuth 2.0はユーザー認証が必要なため、初回のみユーザーがブラウザで認証する必要があります
   - 認証後は、リフレッシュトークンを使用して自動的にアクセストークンを更新できます

---

## トラブルシューティング

### エラー: "invalid_grant"

**原因**: リフレッシュトークンが無効になっている

**解決方法**:
- ユーザーがアクセスを取り消していないか確認
- リフレッシュトークンを再取得

### エラー: "access_denied"

**原因**: スコープが不足している

**解決方法**:
- 必要なスコープ（`https://www.googleapis.com/auth/calendar`）が設定されているか確認
- リフレッシュトークンを再取得（新しいスコープで）

---

## サービスアカウントとの比較

| 項目 | サービスアカウント | OAuth 2.0 |
|------|-------------------|-----------|
| ユーザー認証 | 不要 | 初回のみ必要 |
| 自動化 | 完全自動 | リフレッシュトークンで自動化可能 |
| セキュリティ | 高い | 高い（適切に管理すれば） |
| 実装の複雑さ | 低い | やや高い |
| 組織ポリシー | 制限される場合がある | 制限されにくい |

---

## 推奨事項

可能であれば、**サービスアカウントを使用することを推奨**します。組織ポリシーで制限されている場合は、組織管理者に依頼してキー作成を許可してもらうことを検討してください。

OAuth 2.0は、サービスアカウントが使用できない場合の代替案として使用してください。

