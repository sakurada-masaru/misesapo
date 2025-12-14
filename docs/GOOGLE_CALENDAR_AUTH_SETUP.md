# Google Calendar API 認証情報の設定方法

このドキュメントでは、Google Calendar APIを使用するための認証情報の設定方法を詳しく説明します。

## 目次

1. [Google Cloud Platformでの設定](#1-google-cloud-platformでの設定)
2. [認証情報の取得方法](#2-認証情報の取得方法)
3. [Lambda関数への設定方法](#3-lambda関数への設定方法)
   - [方法A: 環境変数を使用（開発・テスト用）](#方法a-環境変数を使用開発テスト用)
   - [方法B: AWS Secrets Managerを使用（本番環境推奨）](#方法b-aws-secrets-managerを使用本番環境推奨)
4. [動作確認](#4-動作確認)
5. [トラブルシューティング](#5-トラブルシューティング)

---

## 1. Google Cloud Platformでの設定

### 1.1 プロジェクトの作成

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. プロジェクトを作成または既存のプロジェクトを選択

### 1.2 Google Calendar APIの有効化

1. 「APIとサービス」→「ライブラリ」を選択
2. 「Google Calendar API」を検索
3. 「有効にする」をクリック

### 1.3 サービスアカウントの作成

1. 「IAMと管理」→「サービスアカウント」を選択
2. 「サービスアカウントを作成」をクリック
3. 以下の情報を入力:
   - **サービスアカウント名**: `misesapo-calendar`（任意の名前）
   - **サービスアカウントID**: 自動生成されます
   - **説明**: 「Google Calendar API用のサービスアカウント」（任意）
4. 「作成して続行」をクリック
5. 「ロールを付与」はスキップして「完了」をクリック

### 1.4 サービスアカウントキーの作成

1. 作成したサービスアカウントをクリック
2. 「キー」タブを選択
3. 「キーを追加」→「新しいキーを作成」をクリック
4. **キーのタイプ**: 「JSON」を選択
5. 「作成」をクリック
6. **重要**: JSONファイルが自動的にダウンロードされます。このファイルを安全に保管してください。

**ダウンロードされたJSONファイルの例:**
```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "misesapo-calendar@your-project-id.iam.gserviceaccount.com",
  "client_id": "123456789...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

### 1.5 カレンダーの共有設定

1. [Googleカレンダー](https://calendar.google.com/)を開く
2. 左側のカレンダー一覧で、共有したいカレンダーの横にある「⋮」（三点リーダー）をクリック
3. 「設定と共有」を選択
4. 「特定のユーザーと共有」セクションまでスクロール
5. 「ユーザーを追加」をクリック
6. **サービスアカウントのメールアドレス**を入力:
   - 例: `misesapo-calendar@your-project-id.iam.gserviceaccount.com`
   - これは、ダウンロードしたJSONファイルの`client_email`フィールドの値です
7. **権限**: 「変更イベントの管理」を選択
8. 「送信」をクリック

**注意**: サービスアカウントのメールアドレスは、JSONファイルの`client_email`フィールドに記載されています。

---

## 2. 認証情報の取得方法

認証情報は、ダウンロードしたJSONファイルの内容です。このJSONファイル全体を文字列として使用します。

---

## 3. Lambda関数への設定方法

認証情報をLambda関数に設定する方法は2つあります。

### 方法A: 環境変数を使用（開発・テスト用）

**メリット:**
- 設定が簡単
- すぐに動作確認できる

**デメリット:**
- セキュリティリスクが高い（環境変数はログに出力される可能性がある）
- JSONが大きい場合、環境変数のサイズ制限に引っかかる可能性がある

#### 手順

1. **AWS Lambdaコンソール**を開く
2. Lambda関数を選択
3. 「設定」タブ→「環境変数」を選択
4. 「編集」をクリック
5. 以下の環境変数を追加:

| キー | 値 | 説明 |
|------|-----|------|
| `GOOGLE_CALENDAR_ENABLED` | `true` | Google Calendar統合を有効化 |
| `GOOGLE_CALENDAR_ID` | `your-calendar-id@group.calendar.google.com` | カレンダーID（サービスアカウントのメールアドレスまたは共有カレンダーのID） |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | `{"type":"service_account",...}` | サービスアカウントのJSONキー（**全体を1行の文字列として**） |

**`GOOGLE_SERVICE_ACCOUNT_JSON`の設定方法:**

ダウンロードしたJSONファイルを開き、**全体を1行の文字列として**環境変数に設定します。

**例:**
```json
{"type":"service_account","project_id":"your-project-id","private_key_id":"abc123...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"misesapo-calendar@your-project-id.iam.gserviceaccount.com","client_id":"123456789...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/..."}
```

**注意**: 
- JSON内の改行（`\n`）はそのまま保持してください
- 全体を1行にする必要があります（改行を削除）
- 引用符はエスケープする必要はありません（Lambdaの環境変数は文字列として扱われます）

#### JSONを1行に変換する方法

**方法1: コマンドラインを使用**
```bash
# macOS/Linux
cat service-account-key.json | jq -c .

# Windows (PowerShell)
Get-Content service-account-key.json | ConvertFrom-Json | ConvertTo-Json -Compress
```

**方法2: オンラインツールを使用**
- [JSON Minifier](https://jsonformatter.org/json-minify)などのツールを使用

**方法3: Pythonスクリプトを使用**
```python
import json

with open('service-account-key.json', 'r') as f:
    data = json.load(f)
    one_line = json.dumps(data, separators=(',', ':'))
    print(one_line)
```

### 方法B: AWS Secrets Managerを使用（本番環境推奨）

**メリット:**
- セキュリティが高い
- 認証情報のローテーションが容易
- 監査ログが取得できる

**デメリット:**
- 設定がやや複雑
- Secrets Managerのコストがかかる（月額約$0.40/シークレット）

#### 手順

##### ステップ1: Secrets Managerでシークレットを作成

1. **AWS Secrets Managerコンソール**を開く
2. 「シークレットを保存」をクリック
3. 「その他のシークレットタイプ」を選択
4. 「プレーンテキスト」を選択
5. **シークレット値**: ダウンロードしたJSONファイルの内容を**1行の文字列として**貼り付け
   - 方法Aと同様に、JSONを1行に変換してください
6. 「次へ」をクリック
7. **シークレット名**: `google-calendar-service-account`（任意の名前）
8. **説明**: 「Google Calendar API用のサービスアカウント認証情報」（任意）
9. 「次へ」をクリック
10. 「自動ローテーションを設定」は**無効**のまま（サービスアカウントキーは手動でローテーション）
11. 「次へ」をクリック
12. 設定を確認して「保存」をクリック

##### ステップ2: Lambda関数にIAM権限を追加

1. **AWS Lambdaコンソール**を開く
2. Lambda関数を選択
3. 「設定」タブ→「アクセス権限」を選択
4. 実行ロール名をクリック（例: `misesapo-lambda-role`）
5. 「許可を追加」→「ポリシーをアタッチ」をクリック
6. 検索バーに「SecretsManagerReadWrite」と入力
7. **「SecretsManagerReadWrite」**を選択して「許可を追加」をクリック

**または、カスタムポリシーを作成:**

1. IAMコンソールで「ポリシー」→「ポリシーを作成」をクリック
2. JSONタブで以下を貼り付け（`REGION`と`ACCOUNT_ID`を実際の値に置き換え）:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": "arn:aws:secretsmanager:REGION:ACCOUNT_ID:secret:google-calendar-service-account-*"
    }
  ]
}
```

3. ポリシー名を入力（例: `misesapo-google-calendar-secrets-read`）
4. 「ポリシーを作成」をクリック
5. Lambda関数の実行ロールにこのポリシーをアタッチ

##### ステップ3: Lambda関数の環境変数を設定

1. **AWS Lambdaコンソール**を開く
2. Lambda関数を選択
3. 「設定」タブ→「環境変数」を選択
4. 「編集」をクリック
5. 以下の環境変数を追加:

| キー | 値 | 説明 |
|------|-----|------|
| `GOOGLE_CALENDAR_ENABLED` | `true` | Google Calendar統合を有効化 |
| `GOOGLE_CALENDAR_ID` | `your-calendar-id@group.calendar.google.com` | カレンダーID |
| `GOOGLE_SERVICE_ACCOUNT_SECRET_NAME` | `google-calendar-service-account` | Secrets Managerのシークレット名 |

**注意**: `GOOGLE_SERVICE_ACCOUNT_JSON`は設定**しない**でください。Secrets Managerから取得します。

##### ステップ4: Lambda関数のコードを更新

`lambda_function.py`の`get_google_calendar_service()`関数が、Secrets Managerから認証情報を取得するように設定されていることを確認してください。

---

## 4. 動作確認

### 4.1 環境変数の確認

Lambda関数の「設定」→「環境変数」で、以下の環境変数が設定されていることを確認:

- `GOOGLE_CALENDAR_ENABLED`: `true`
- `GOOGLE_CALENDAR_ID`: カレンダーID
- `GOOGLE_SERVICE_ACCOUNT_JSON`（方法Aの場合）または`GOOGLE_SERVICE_ACCOUNT_SECRET_NAME`（方法Bの場合）

### 4.2 テスト実行

1. Lambda関数の「テスト」タブで、スケジュール作成のイベントを実行
2. 「モニタリング」タブ→「ログを表示」でCloudWatch Logsを確認
3. エラーがないことを確認

### 4.3 Googleカレンダーで確認

1. [Googleカレンダー](https://calendar.google.com/)を開く
2. 共有したカレンダーを選択
3. スケジュール作成後に、イベントが作成されていることを確認

---

## 5. トラブルシューティング

### エラー: "Google Service Account JSON not configured"

**原因**: 認証情報が正しく設定されていない

**解決方法**:
- 環境変数`GOOGLE_SERVICE_ACCOUNT_JSON`が設定されているか確認（方法Aの場合）
- 環境変数`GOOGLE_SERVICE_ACCOUNT_SECRET_NAME`が設定されているか確認（方法Bの場合）
- Secrets Managerのシークレットが存在するか確認（方法Bの場合）

### エラー: "Failed to initialize Google Calendar service"

**原因**: サービスアカウントの認証情報が無効

**解決方法**:
- JSONファイルが正しく1行の文字列に変換されているか確認
- JSONファイルの内容が正しいか確認（ダウンロードしたファイルをそのまま使用）
- サービスアカウントキーが有効期限内か確認

### エラー: "Calendar not found" または "Forbidden"

**原因**: カレンダーが共有されていない、または権限が不足

**解決方法**:
- サービスアカウントのメールアドレスがカレンダーに共有されているか確認
- カレンダーの共有権限が「変更イベントの管理」になっているか確認
- `GOOGLE_CALENDAR_ID`が正しいか確認（サービスアカウントのメールアドレスまたは共有カレンダーのID）

### エラー: "AccessDeniedException" (Secrets Manager)

**原因**: Lambda関数にSecrets Managerへのアクセス権限がない

**解決方法**:
- Lambda関数の実行ロールにSecrets Managerの読み取り権限が付与されているか確認
- ポリシーのリソースARNが正しいか確認（シークレット名の末尾に`-*`が付いているか）

### エラー: "Invalid JSON format"

**原因**: JSONが正しくフォーマットされていない

**解決方法**:
- JSONを1行の文字列に変換する際に、改行（`\n`）が正しく保持されているか確認
- JSONの構文エラーがないか確認（オンラインのJSONバリデーターを使用）

---

## 補足: カレンダーIDの確認方法

### 方法1: カレンダー設定から確認

1. [Googleカレンダー](https://calendar.google.com/)を開く
2. カレンダー設定を開く
3. 「カレンダーの統合」セクションまでスクロール
4. 「カレンダーID」をコピー

### 方法2: サービスアカウントのメールアドレスを使用

サービスアカウントのメールアドレス（JSONファイルの`client_email`）を`GOOGLE_CALENDAR_ID`に設定することもできます。この場合、サービスアカウントが所有するカレンダーにイベントが作成されます。

---

## セキュリティのベストプラクティス

1. **本番環境では必ずSecrets Managerを使用**
   - 環境変数はログに出力される可能性があるため、機密情報には適さない

2. **最小権限の原則**
   - サービスアカウントには必要最小限の権限のみを付与
   - Lambda関数の実行ロールにも必要最小限の権限のみを付与

3. **定期的なキーのローテーション**
   - サービスアカウントキーは定期的に再生成することを推奨
   - 新しいキーを作成したら、Secrets Managerのシークレットを更新

4. **監査ログの確認**
   - CloudWatch Logsで認証エラーがないか定期的に確認
   - Secrets Managerのアクセスログを確認







