# /upload エンドポイントの設定確認

## 概要

`/upload`リソースは画像アップロード用のエンドポイントです。Lambda関数のコードで`/upload`パスを処理しているため、API Gatewayでも正しく設定されている必要があります。

## 確認手順

### 1. /uploadリソースの存在確認

1. **API Gateway** → `misesapo-s3-upload-api` → **リソース** を開く
2. `/upload`リソースが存在するか確認

存在しない場合、作成する必要があります。

### 2. /uploadリソースの作成（存在しない場合）

1. ルートリソース（`/`）を選択
2. **「アクション」** → **「リソースの作成」** をクリック
3. **リソース名**: `upload` と入力
4. **「リソースの作成」** をクリック

### 3. /uploadリソースのPOSTメソッド設定

1. `/upload`リソースを選択
2. **「アクション」** → **「メソッドの作成」** をクリック
3. **メソッド**: `POST` を選択
4. **統合タイプ**: `Lambda関数` を選択
5. **Lambda関数**: `misesapo-s3-upload` を選択
6. **「Lambdaプロキシ統合を使用」** にチェックを入れる（重要）
7. **「保存」** をクリック
8. **「Lambda関数に権限を追加」** のダイアログで **「OK」** をクリック

### 4. /uploadリソースのOPTIONSメソッド設定

CORSのプリフライトリクエストを処理するため、OPTIONSメソッドも必要です。

#### 方法1: MOCK統合を使用（推奨）

1. `/upload`リソースを選択
2. **「アクション」** → **「メソッドの作成」** をクリック
3. **メソッド**: `OPTIONS` を選択
4. **統合タイプ**: `MOCK` を選択
5. **「保存」** をクリック
6. **「統合レスポンス」** をクリック
7. **「200」** のステータスコードを選択
8. **「ヘッダーのマッピング」** で以下を追加：
   - `Access-Control-Allow-Origin`: `'*'`
   - `Access-Control-Allow-Headers`: `'Content-Type'`
   - `Access-Control-Allow-Methods`: `'POST, OPTIONS'`
9. **「保存」** をクリック

#### 方法2: Lambda関数で処理

Lambda関数のコードでOPTIONSリクエストを処理する場合：

1. `/upload`リソースを選択
2. **「アクション」** → **「メソッドの作成」** をクリック
3. **メソッド**: `OPTIONS` を選択
4. **統合タイプ**: `Lambda関数` を選択
5. **Lambda関数**: `misesapo-s3-upload` を選択
6. **「Lambdaプロキシ統合を使用」** にチェックを入れる
7. **「保存」** をクリック

### 5. /uploadリソースのCORS設定

1. `/upload`リソースを選択
2. **「アクション」** → **「CORS を有効にする」** をクリック
3. 以下の設定を入力：
   - **アクセス制御を許可するオリジン**: `*`（すべてのオリジン）
   - **アクセス制御を許可するヘッダー**: `Content-Type`
   - **アクセス制御を許可するメソッド**: `POST, OPTIONS` にチェック
4. **「CORS を有効にして既存の CORS ヘッダーを置き換える」** をクリック
5. **「はい、既存の値を置き換えます」** をクリック

### 6. API Gatewayのデプロイ

設定を変更した後、必ずAPI Gatewayをデプロイしてください：

1. **「アクション」** → **「API のデプロイ」** をクリック
2. **デプロイされるステージ**: `prod` を選択
3. **「デプロイ」** をクリック

## 確認

### リクエストのテスト

```bash
# OPTIONSリクエスト（プリフライト）
curl -X OPTIONS https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod/upload \
  -H "Origin: https://sakurada-masaru.github.io" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -i

# POSTリクエスト（実際のアップロード）
curl -X POST https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod/upload \
  -H "Origin: https://sakurada-masaru.github.io" \
  -H "Content-Type: application/json" \
  -d '{"image": "...", "fileName": "test.jpg", "contentType": "image/jpeg"}' \
  -i
```

## まとめ

`/upload`リソースも以下の設定が必要です：

- **POSTメソッド**: Lambdaプロキシ統合を使用
- **OPTIONSメソッド**: MOCK統合を使用（推奨）またはLambdaプロキシ統合を使用
- **CORS設定**: 有効化

## 参考

- [API Gateway Lambda統合](https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html)
- [API Gateway CORS設定](https://docs.aws.amazon.com/apigateway/latest/developerguide/how-to-cors.html)

