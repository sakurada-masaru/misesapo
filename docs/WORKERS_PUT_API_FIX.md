# Workers PUT API エラー修正ガイド

## 🔴 発生しているエラー

1. **CORSエラー**: `No 'Access-Control-Allow-Origin' header is present on the requested resource`
2. **403 Forbiddenエラー**: `PUT https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod/workers/W1764549250789 net::ERR_FAILED 403 (Forbidden)`

## 🔍 原因分析

### 1. CORSエラー
- API GatewayのPUTメソッドにCORSヘッダーが正しく設定されていない
- OPTIONSメソッド（プリフライトリクエスト）が正しく処理されていない

### 2. 403 Forbiddenエラー
- API GatewayのPUTメソッドに認証が設定されている可能性
- 認証が必要な設定になっているため、リクエストが拒否されている

## ✅ 修正方法

### 方法1: スクリプトを実行（推奨）

以下のスクリプトを実行して、CORS設定と認証設定を修正します：

```bash
cd /Users/sakuradamasaru/Desktop/misesapo-main
./scripts/fix_workers_put_api.sh
```

このスクリプトは以下を実行します：
1. PUTメソッドの認証設定を`NONE`に変更（403エラーを解決）
2. PUTメソッドのCORSヘッダーを設定（200, 400, 404, 500ステータスコード）
3. OPTIONSメソッドを設定（プリフライトリクエスト用）
4. APIをデプロイ

### 方法2: AWSコンソールから手動で修正

#### ステップ1: 認証設定の確認・修正

1. **AWS Console** (https://console.aws.amazon.com/) にアクセス
2. 検索バーに「**API Gateway**」と入力して選択
3. API名を選択（REST API ID: `51bhoxkbxd`）
4. 左側のメニューから **「リソース」** を選択
5. `/workers/{id}` リソースをクリック
6. **PUT** メソッドを選択
7. **「メソッドリクエスト」** をクリック
8. **「認証」** セクションで **「認証なし」** を選択
9. **「保存」** をクリック

#### ステップ2: CORS設定の確認・修正

1. `/workers/{id}` リソースを選択
2. **「アクション」** → **「CORS を有効にする」** をクリック
3. 以下の設定を入力：
   - **アクセス制御を許可するオリジン**: `*`（すべてのオリジン）
   - **アクセス制御を許可するヘッダー**: `Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token`
   - **アクセス制御を許可するメソッド**: `GET,PUT,POST,DELETE,OPTIONS` にチェック
4. **「CORS を有効にして既存の CORS ヘッダーを置き換える」** をクリック
5. **「はい、既存の値を置き換えます」** をクリック

#### ステップ3: OPTIONSメソッドの確認

1. `/workers/{id}` リソースを選択
2. **OPTIONS** メソッドが存在するか確認
3. 存在しない場合は、**「アクション」** → **「メソッドの作成」** → **OPTIONS** を選択
4. **統合タイプ**: `MOCK` を選択
5. **「保存」** をクリック
6. **「統合レスポンス」** をクリック
7. **「200」** のステータスコードを選択
8. **「ヘッダーのマッピング」** で以下を追加：
   - `Access-Control-Allow-Origin`: `'*'`
   - `Access-Control-Allow-Headers`: `'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'`
   - `Access-Control-Allow-Methods`: `'GET,PUT,POST,DELETE,OPTIONS'`
9. **「保存」** をクリック

#### ステップ4: APIのデプロイ

1. **「アクション」** → **「API のデプロイ」** をクリック
2. **デプロイするステージ**: `prod` を選択
3. **デプロイの説明**: `Workers PUT API CORS設定と認証設定の修正` を入力
4. **「デプロイ」** をクリック

## 🧪 動作確認

修正後、以下の手順で動作確認を行ってください：

1. **ブラウザをリロード**（キャッシュをクリア）
2. **ユーザー詳細ページ**（`/admin/users/detail.html?id=W1764549250789`）を開く
3. **「編集」** ボタンをクリック
4. **ユーザー情報を変更**して **「保存」** をクリック
5. **エラーが発生しないことを確認**

## 📝 注意事項

- スクリプトを実行するには、AWS CLIがインストールされ、適切な認証情報が設定されている必要があります
- スクリプトを実行する前に、AWS CLIの認証情報を確認してください：
  ```bash
  aws configure list
  ```
- スクリプトを実行後、API Gatewayのデプロイが完了するまで数秒かかる場合があります
- ブラウザのキャッシュをクリアしてから再度お試しください

## 🔗 関連ドキュメント

- [API Gateway CORS設定の更新方法](docs/AWS_API_GATEWAY_CORS_UPDATE.md)
- [API Gateway メソッド設定ガイド](docs/AWS_API_GATEWAY_METHODS_SETUP.md)

