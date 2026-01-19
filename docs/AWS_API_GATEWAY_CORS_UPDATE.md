# API Gateway CORS設定の更新方法

API GatewayのCORS設定を更新して、すべてのオリジンからのアクセスを許可する方法です。

## 現在の設定

現在、`access-control-allow-origin`が`https://sakurada-masaru.github.io`に限定されているため、他のオリジン（localhostなど）からのアクセスがブロックされる可能性があります。

## 修正方法

### 方法1: API Gatewayコンソールから修正（推奨）

1. **AWS Console** (https://console.aws.amazon.com/) にアクセス
2. 検索バーに「**API Gateway**」と入力して選択
3. API名 `misesapo-s3-upload-api` をクリック
4. 左側のメニューから **「リソース」** を選択
5. `/upload` リソースをクリック
6. **「アクション」** → **「CORS を有効にする」** をクリック
7. 以下の設定を入力：
   - **アクセス制御を許可するオリジン**: `*`（すべてのオリジン）または複数のオリジンをカンマ区切りで指定
     - 例: `*`（すべて許可）
     - 例: `https://sakurada-masaru.github.io,http://localhost:5173`（特定のオリジンのみ）
   - **アクセス制御を許可するヘッダー**: `Content-Type`
   - **アクセス制御を許可するメソッド**: `POST, OPTIONS` にチェック
8. **「CORS を有効にして既存の CORS ヘッダーを置き換える」** をクリック
9. **「はい、既存の値を置き換えます」** をクリック

### 方法2: Lambda関数のレスポンスヘッダーで対応

Lambda関数のコードで既に `'Access-Control-Allow-Origin': '*'` が設定されているため、API GatewayのCORS設定を削除して、Lambda関数のレスポンスヘッダーを使用することもできます。

1. API Gatewayコンソールで `/upload` リソースを選択
2. **「アクション」** → **「CORS を削除」** をクリック
3. Lambda関数のレスポンスヘッダーが使用されます（既に `*` が設定済み）

## 推奨設定

### 開発・テスト環境
- **アクセス制御を許可するオリジン**: `*`（すべてのオリジン）
- これにより、localhost、GitHub Pages、その他のオリジンからアクセス可能

### 本番環境（セキュリティ重視）
- **アクセス制御を許可するオリジン**: 特定のオリジンのみ
  - `https://sakurada-masaru.github.io`
  - `https://yourdomain.com`（カスタムドメインがある場合）
- これにより、許可されたオリジンのみからアクセス可能

## 設定後の確認

### 1. OPTIONSリクエストの確認

```bash
curl -X OPTIONS https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod/upload \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -i
```

期待されるレスポンスヘッダー：
```
access-control-allow-origin: *
access-control-allow-methods: POST, OPTIONS
access-control-allow-headers: Content-Type
```

### 2. 実際のアップロードテスト

ブラウザの開発者ツール（F12）のコンソールで、以下のエラーが発生しないことを確認：
- `CORS policy: No 'Access-Control-Allow-Origin' header`
- `CORS policy: The request client is not a secure context`

## トラブルシューティング

### CORSエラーが発生する場合

1. **API GatewayのCORS設定を確認**
   - リソース `/upload` のCORS設定を確認
   - `*` が設定されているか確認

2. **Lambda関数のレスポンスヘッダーを確認**
   - `lambda_function.py` の `headers` に `'Access-Control-Allow-Origin': '*'` が含まれているか確認

3. **API Gatewayのデプロイを確認**
   - CORS設定を変更した後、必ず **「API のデプロイ」** を実行
   - ステージ `prod` にデプロイされているか確認

4. **ブラウザのキャッシュをクリア**
   - ブラウザのキャッシュが古いCORS設定を保持している可能性があります
   - ハードリロード（Ctrl+Shift+R または Cmd+Shift+R）を実行

## 参考

- [AWS API Gateway CORS ドキュメント](https://docs.aws.amazon.com/apigateway/latest/developerguide/how-to-cors.html)
- [Lambda関数のコード](lambda_function.py)

