# Google Calendar API 管理者向けセットアップガイド

## 概要

管理者権限をお持ちの場合、サービスアカウントの作成とキーの作成を直接行うことができます。

## 前提条件

- Google Cloud Platform (GCP) の管理者権限
- Google Calendar APIの有効化
- 共有カレンダーへのアクセス権限

## セットアップ手順

### ステップ1: 組織ポリシーの確認

サービスアカウントキーの作成が無効になっている原因を確認します。

1. **Google Cloud Console**を開く
   - https://console.cloud.google.com/

2. **組織ポリシーの確認**
   - 「IAMと管理」→「組織ポリシー」を選択
   - 検索バーに `disableServiceAccountKeyCreation` と入力
   - `constraints/iam.disableServiceAccountKeyCreation` をクリック

3. **ポリシーの状態を確認**
   - **「継承」または「未設定」**: キー作成は許可されています
   - **「強制」**: キー作成が制限されています

### ステップ2: 組織ポリシーの例外を設定（必要な場合）

ポリシーが「強制」になっている場合、例外を設定します。

#### 方法A: プロジェクト単位で例外を設定（推奨）

1. `constraints/iam.disableServiceAccountKeyCreation` の詳細ページを開く
2. 「カスタマイズ」を選択
3. 「ポリシーを強制」を選択
4. 「例外を追加」をクリック
5. **プロジェクトID**を入力（例: `my-project-123456`）
6. 「保存」をクリック

#### 方法B: 組織全体でポリシーを無効化

**注意**: セキュリティ上の理由から、組織全体で無効化するのは推奨されません。

1. `constraints/iam.disableServiceAccountKeyCreation` の詳細ページを開く
2. 「ポリシーを無効にする」を選択
3. 「保存」をクリック

### ステップ3: Google Calendar APIの有効化

1. **APIとサービス**→「ライブラリ」を選択
2. 「Google Calendar API」を検索
3. 「有効にする」をクリック

### ステップ4: サービスアカウントの作成

1. **IAMと管理**→「サービスアカウント」を選択
2. 「サービスアカウントを作成」をクリック
3. 以下の情報を入力:
   - **サービスアカウント名**: `misesapo-calendar`
   - **サービスアカウントID**: 自動生成されます（例: `misesapo-calendar`）
   - **説明**: 「Google Calendar API用のサービスアカウント」
4. 「作成して続行」をクリック
5. 「ロールを付与」はスキップして「完了」をクリック

### ステップ5: サービスアカウントキーの作成

1. 作成したサービスアカウント（`misesapo-calendar`）をクリック
2. 「キー」タブを選択
3. 「キーを追加」→「新しいキーを作成」をクリック

   **もし「キーの作成無効状態」と表示される場合:**
   - ステップ2で例外が正しく設定されているか確認
   - ブラウザをリフレッシュして再度試す
   - 別のプロジェクトで試す（プロジェクトレベルの制限の可能性）

4. **キーのタイプ**: 「JSON」を選択
5. 「作成」をクリック
6. **重要**: JSONファイルが自動的にダウンロードされます。このファイルを安全に保管してください。

### ステップ6: カレンダーの共有設定

共有カレンダーにサービスアカウントを追加します。

1. **Googleカレンダー**を開く
   - https://calendar.google.com/

2. **カレンダー設定を開く**
   - 左側のカレンダー一覧で、共有したいカレンダーの横にある「⋮」（三点リーダー）をクリック
   - 「設定と共有」を選択

3. **サービスアカウントを追加**
   - 「特定のユーザーと共有」セクションまでスクロール
   - 「ユーザーを追加」をクリック
   - **サービスアカウントのメールアドレス**を入力:
     - ダウンロードしたJSONファイルの`client_email`フィールドの値
     - 例: `misesapo-calendar@your-project-id.iam.gserviceaccount.com`
   - **権限**: 「変更イベントの管理」を選択
   - 「送信」をクリック

### ステップ7: Lambda関数への設定

#### 方法A: 環境変数を使用（開発・テスト用）

1. **AWS Lambdaコンソール**を開く
2. Lambda関数（`misesapo-s3-upload`）を選択
3. 「設定」タブ→「環境変数」を選択
4. 「編集」をクリック
5. 以下の環境変数を追加:

| キー | 値 | 説明 |
|------|-----|------|
| `GOOGLE_CALENDAR_ENABLED` | `true` | Google Calendar統合を有効化 |
| `GOOGLE_CALENDAR_ID` | `info@misesapo.app` | カレンダーID（既に設定済み） |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | `{"type":"service_account",...}` | サービスアカウントのJSONキー（**全体を1行の文字列として**） |

**JSONを1行に変換する方法:**

```bash
# macOS/Linux
cat service-account-key.json | jq -c .

# または、Pythonを使用
python3 -c "import json; print(json.dumps(json.load(open('service-account-key.json')), separators=(',', ':')))"
```

#### 方法B: AWS Secrets Managerを使用（本番環境推奨）

1. **AWS Secrets Managerコンソール**を開く
2. 「シークレットを保存」をクリック
3. 「その他のシークレットタイプ」を選択
4. 「プレーンテキスト」を選択
5. **シークレット値**: ダウンロードしたJSONファイルの内容を**1行の文字列として**貼り付け
6. 「次へ」をクリック
7. **シークレット名**: `google-calendar-service-account`
8. 「次へ」→「次へ」→「保存」をクリック

9. **Lambda関数の環境変数を設定:**
   - `GOOGLE_CALENDAR_ENABLED`: `true`
   - `GOOGLE_CALENDAR_ID`: `info@misesapo.app`
   - `GOOGLE_SERVICE_ACCOUNT_SECRET_NAME`: `google-calendar-service-account`

10. **Lambda関数のIAM権限を追加:**
    - Lambda関数の実行ロールに、Secrets Managerの読み取り権限を追加
    - 詳細は `docs/GOOGLE_CALENDAR_AUTH_SETUP.md` を参照

### ステップ8: 動作確認

1. **環境変数の確認**
   - Lambda関数の「設定」→「環境変数」で、必要な環境変数が設定されていることを確認

2. **APIエンドポイントのテスト**
   ```bash
   # イベント一覧を取得
   curl 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod/google-calendar/events?calendar_id=info@misesapo.app'
   ```

3. **CloudWatch Logsで確認**
   - Lambda関数の「モニタリング」タブ→「ログを表示」
   - エラーがないことを確認

---

## トラブルシューティング

### エラー: 「キーの作成無効状態」が表示される

**原因1: 組織ポリシーで制限されている**
- ステップ2で例外が正しく設定されているか確認
- プロジェクトIDが正しいか確認

**原因2: プロジェクトレベルの制限**
- プロジェクトの設定を確認
- 別のプロジェクトで試す

**原因3: ブラウザのキャッシュ**
- ブラウザをリフレッシュ
- シークレットモードで試す

### エラー: "Calendar not found" または "Forbidden"

**原因**: カレンダーが共有されていない、または権限が不足

**解決方法**:
- ステップ6でカレンダーの共有設定が正しく行われているか確認
- サービスアカウントのメールアドレス（`client_email`）が正しいか確認
- カレンダーの共有権限が「変更イベントの管理」になっているか確認

### エラー: "Google Service Account JSON not configured"

**原因**: 認証情報が正しく設定されていない

**解決方法**:
- 環境変数`GOOGLE_SERVICE_ACCOUNT_JSON`が設定されているか確認（方法Aの場合）
- 環境変数`GOOGLE_SERVICE_ACCOUNT_SECRET_NAME`が設定されているか確認（方法Bの場合）
- Secrets Managerのシークレットが存在するか確認（方法Bの場合）

---

## 次のステップ

認証情報の設定が完了したら、以下の機能を使用できます：

1. **Googleカレンダーからイベントを取得**
   - `GET /google-calendar/events?calendar_id=info@misesapo.app`

2. **GoogleカレンダーからDynamoDBに同期**
   - `POST /google-calendar/sync?calendar_id=info@misesapo.app`

3. **DynamoDBからGoogleカレンダーにイベントを作成**
   - スケジュール作成時に自動的にGoogleカレンダーにもイベントが作成されます

詳細は `docs/GOOGLE_CALENDAR_DEPLOY_INSTRUCTIONS.md` を参照してください。

