# Googleカレンダー設定手順（ステップバイステップ）

## 📋 全体の流れ

1. 組織ポリシーの設定（キー作成を許可）
2. Google Calendar APIの有効化
3. サービスアカウントの作成
4. サービスアカウントキーの作成
5. カレンダーの共有設定
6. Lambda関数への設定
7. 動作確認

---

## ステップ1: 組織ポリシーの設定（キー作成を許可）

**目的**: サービスアカウントキーを作成できるようにする

### 1-1. Google Cloud Consoleを開く

1. ブラウザで https://console.cloud.google.com/ にアクセス
2. プロジェクト「teikisesiou-tesuto」を選択（画面上部のプロジェクト選択ドロップダウン）

### 1-2. 古いポリシーを開く

1. 左側のメニューから「**IAMと管理**」をクリック
2. 「**組織のポリシー**」をクリック
3. 検索バーに `iam.disableServiceAccountKeyCreation` と入力
   - **重要**: `managed` は含めない（古い版のポリシーを検索）
4. `constraints/iam.disableServiceAccountKeyCreation` をクリック

### 1-3. プロジェクトに対して例外を設定

1. 「**ポリシーを管理**」ボタンをクリック
2. 「**カスタマイズ**」を選択
3. 「**ポリシーを強制**」を選択
4. 「**例外を追加**」をクリック
5. **プロジェクトID**: `teikisesiou-tesuto` を入力
6. 「**保存**」をクリック

### 1-4. 設定の確認

1. ブラウザをリフレッシュ（F5キーまたはCmd+R）
2. 数分待ってから、次のステップに進む

---

## ステップ2: Google Calendar APIの有効化

**目的**: Google Calendar APIを使用できるようにする

1. 左側のメニューから「**APIとサービス**」をクリック
2. 「**ライブラリ**」をクリック
3. 検索バーに「**Google Calendar API**」と入力
4. 「**Google Calendar API**」をクリック
5. 「**有効にする**」ボタンをクリック
6. 有効化が完了するまで待つ（数秒〜数十秒）

---

## ステップ3: サービスアカウントの作成

**目的**: Google Calendar APIにアクセスするためのサービスアカウントを作成

1. 左側のメニューから「**IAMと管理**」をクリック
2. 「**サービスアカウント**」をクリック
3. 「**サービスアカウントを作成**」ボタンをクリック

4. 以下の情報を入力:
   - **サービスアカウント名**: `misesapo-calendar`
   - **サービスアカウントID**: 自動生成されます（そのままでOK）
   - **説明**: `Google Calendar API用のサービスアカウント`（任意）

5. 「**作成して続行**」をクリック

6. 「**ロールを付与**」はスキップして「**完了**」をクリック

---

## ステップ4: サービスアカウントキーの作成

**目的**: サービスアカウントの認証情報（JSONキー）を取得

1. 作成したサービスアカウント（`misesapo-calendar`）をクリック

2. 「**キー**」タブをクリック

3. 「**キーを追加**」→「**新しいキーを作成**」をクリック

   **もし「キーの作成無効状態」と表示される場合:**
   - ステップ1で例外が正しく設定されているか確認
   - ブラウザをリフレッシュして再度試す
   - 数分待ってから再度試す

4. **キーのタイプ**: 「**JSON**」を選択

5. 「**作成**」をクリック

6. **重要**: JSONファイルが自動的にダウンロードされます
   - ファイル名: `teikisesiou-tesuto-xxxxx-xxxxx.json` のような形式
   - このファイルを安全な場所に保存してください
   - **このファイルは機密情報です。他人に共有しないでください**

---

## ステップ5: カレンダーの共有設定

**目的**: サービスアカウントがGoogleカレンダーにアクセスできるようにする

### 5-1. サービスアカウントのメールアドレスを確認

1. ダウンロードしたJSONファイルを開く（テキストエディタで）
2. `"client_email"` というフィールドを探す
3. その値をコピー（例: `misesapo-calendar@teikisesiou-tesuto.iam.gserviceaccount.com`）

### 5-2. Googleカレンダーを開く

1. 新しいタブで https://calendar.google.com/ にアクセス
2. 左側のカレンダー一覧で、共有したいカレンダー（`info@misesapo.app`）を探す

### 5-3. カレンダー設定を開く

1. カレンダーの横にある「**⋮**」（三点リーダー）をクリック
2. 「**設定と共有**」を選択

### 5-4. サービスアカウントを追加

1. 「**特定のユーザーと共有**」セクションまでスクロール
2. 「**ユーザーを追加**」をクリック
3. **メールアドレス**: ステップ5-1でコピーしたサービスアカウントのメールアドレスを貼り付け
4. **権限**: 「**変更イベントの管理**」を選択
5. 「**送信**」をクリック

---

## ステップ6: Lambda関数への設定

**目的**: Lambda関数がGoogle Calendar APIを使用できるようにする

### 6-1. JSONキーを1行の文字列に変換

ダウンロードしたJSONファイルを1行の文字列に変換する必要があります。

#### 方法A: コマンドラインを使用（推奨）

ターミナルで以下のコマンドを実行：

```bash
# ダウンロードしたJSONファイルのパスを指定
cat ~/Downloads/teikisesiou-tesuto-*.json | jq -c .
```

**jqがインストールされていない場合:**

```bash
# macOSの場合
brew install jq

# または、Pythonを使用
python3 -c "import json; print(json.dumps(json.load(open('~/Downloads/teikisesiou-tesuto-*.json')), separators=(',', ':')))"
```

#### 方法B: オンラインツールを使用

1. ダウンロードしたJSONファイルを開く
2. 内容をすべてコピー
3. https://jsonformatter.org/json-minify などのツールで1行に変換
4. 変換結果をコピー

### 6-2. AWS Lambdaコンソールを開く

1. https://console.aws.amazon.com/lambda/ にアクセス
2. リージョン: `ap-northeast-1` を選択
3. Lambda関数「**misesapo-s3-upload**」をクリック

### 6-3. 環境変数を設定

1. 「**設定**」タブをクリック
2. 「**環境変数**」をクリック
3. 「**編集**」をクリック

4. 以下の環境変数を追加:

   | キー | 値 | 説明 |
   |------|-----|------|
   | `GOOGLE_CALENDAR_ENABLED` | `true` | Google Calendar統合を有効化 |
   | `GOOGLE_CALENDAR_ID` | `info@misesapo.app` | カレンダーID |
   | `GOOGLE_SERVICE_ACCOUNT_JSON` | `{"type":"service_account",...}` | ステップ6-1で変換したJSON文字列（全体を1行で） |

5. 「**保存**」をクリック

**注意**: 
- `GOOGLE_SERVICE_ACCOUNT_JSON` の値は、JSONファイル全体を1行の文字列として貼り付けてください
- 改行は削除してください（ただし、`\n` はそのまま保持）

---

## ステップ7: 動作確認

**目的**: 設定が正しく動作しているか確認

### 7-1. APIエンドポイントのテスト

ターミナルで以下のコマンドを実行：

```bash
# イベント一覧を取得
curl 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod/google-calendar/events?calendar_id=info@misesapo.app'
```

**成功した場合:**
- JSON形式でイベントのリストが返ってきます

**エラーが返ってきた場合:**
- ステップ7-2でCloudWatch Logsを確認してください

### 7-2. CloudWatch Logsで確認

1. AWS Lambdaコンソールで「**モニタリング**」タブをクリック
2. 「**ログを表示**」をクリック
3. 最新のログを確認
4. エラーメッセージがないか確認

### 7-3. よくあるエラーと対処法

#### エラー: "Google Service Account JSON not configured"

**原因**: 環境変数が正しく設定されていない

**対処法**:
- ステップ6-3で環境変数が正しく設定されているか確認
- JSONが1行の文字列になっているか確認

#### エラー: "Calendar not found" または "Forbidden"

**原因**: カレンダーが共有されていない、または権限が不足

**対処法**:
- ステップ5でカレンダーの共有設定が正しく行われているか確認
- サービスアカウントのメールアドレス（`client_email`）が正しいか確認
- カレンダーの共有権限が「変更イベントの管理」になっているか確認

---

## ✅ 完了

これで、Googleカレンダーからスケジュールを取得して、システムに同期できるようになりました！

### 次のステップ

1. **Googleカレンダーからイベントを取得**
   ```bash
   curl 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod/google-calendar/events?calendar_id=info@misesapo.app'
   ```

2. **GoogleカレンダーからDynamoDBに同期**
   ```bash
   curl -X POST 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod/google-calendar/sync?calendar_id=info@misesapo.app'
   ```

3. **DynamoDBからGoogleカレンダーにイベントを作成**
   - スケジュール作成時に自動的にGoogleカレンダーにもイベントが作成されます

---

## 📝 補足: セキュリティのベストプラクティス

### 本番環境ではSecrets Managerを使用（推奨）

開発・テスト環境では環境変数を使用できますが、本番環境ではAWS Secrets Managerを使用することを推奨します。

詳細は `docs/GOOGLE_CALENDAR_AUTH_SETUP.md` の「方法B: AWS Secrets Managerを使用」セクションを参照してください。

