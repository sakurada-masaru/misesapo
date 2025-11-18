# API Gateway CORS トラブルシューティング

## 問題: ブラウザでCORSエラーが発生する

ブラウザのコンソールで以下のエラーが表示される場合：

```
Access to fetch at 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod/cleaning-manual' 
from origin 'https://sakurada-masaru.github.io' has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## 確認手順

### 1. OPTIONSリクエストのテスト

ターミナルで以下のコマンドを実行して、OPTIONSリクエストが正常に動作しているか確認：

```bash
curl -X OPTIONS https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod/cleaning-manual \
  -H "Origin: https://sakurada-masaru.github.io" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -i
```

期待されるレスポンスヘッダー：
```
access-control-allow-origin: *
access-control-allow-methods: GET,OPTIONS,POST,PUT
access-control-allow-headers: Content-Type,...
```

### 2. ブラウザのキャッシュをクリア

ブラウザが古いCORS設定をキャッシュしている可能性があります：

1. **ハードリロード**: `Cmd + Shift + R` (Mac) または `Ctrl + Shift + R` (Windows/Linux)
2. **開発者ツールでキャッシュを無効化**:
   - Chrome/Edge: 開発者ツール（F12）→ Networkタブ → "Disable cache" にチェック
   - Firefox: 開発者ツール（F12）→ Networkタブ → 設定アイコン → "Disable HTTP Cache" にチェック

### 3. API Gatewayのデプロイを確認

CORS設定を変更した後、必ずAPI Gatewayをデプロイしてください：

1. API Gatewayコンソールで `misesapo-s3-upload-api` を選択
2. **「アクション」** → **「API のデプロイ」** をクリック
3. **デプロイされるステージ**: `prod` を選択
4. **「デプロイ」** をクリック

### 4. OPTIONSメソッドの統合タイプを確認

各リソースのOPTIONSメソッドの統合タイプが正しく設定されているか確認：

1. `/cleaning-manual` リソースを選択
2. **「メソッド」** タブで `OPTIONS` をクリック
3. **「統合リクエスト」** を確認：
   - **統合タイプ**: `MOCK` または `Lambda関数` が設定されているか
   - Lambda関数を使用する場合、Lambda関数が正しく設定されているか

### 5. CORS設定の再確認

各リソースのCORS設定を再確認：

1. `/cleaning-manual` リソースを選択
2. **「アクション」** → **「CORS を有効にする」** をクリック
3. 設定を確認：
   - **アクセス制御を許可するオリジン**: `*`
   - **アクセス制御を許可するヘッダー**: `Content-Type`
   - **アクセス制御を許可するメソッド**: `GET, PUT, POST, OPTIONS` にチェック
4. **「CORS を有効にして既存の CORS ヘッダーを置き換える」** をクリック

### 6. ブラウザの開発者ツールでネットワークリクエストを確認

1. ブラウザの開発者ツール（F12）を開く
2. **Network** タブを選択
3. ページをリロード
4. `/cleaning-manual` へのリクエストを確認：
   - **OPTIONS** リクエスト（プリフライト）のステータスコードを確認
   - **Response Headers** に `access-control-allow-origin` が含まれているか確認

### 7. Lambda関数のエラーを確認

GETリクエストが成功しているか確認：

```bash
curl -X GET https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod/cleaning-manual \
  -H "Origin: https://sakurada-masaru.github.io" \
  -i
```

Lambda関数でエラーが発生している場合、CloudWatch Logsでエラーログを確認してください。

## よくある問題と解決方法

### 問題1: OPTIONSリクエストが404エラーになる

**原因**: OPTIONSメソッドがリソースに追加されていない

**解決方法**: 
1. リソースを選択
2. **「アクション」** → **「メソッドの作成」** をクリック
3. **メソッド**: `OPTIONS` を選択
4. **統合タイプ**: `MOCK` を選択
5. **「保存」** をクリック

### 問題2: CORS設定を変更しても反映されない

**原因**: API Gatewayをデプロイしていない

**解決方法**: 
1. **「アクション」** → **「API のデプロイ」** をクリック
2. **デプロイされるステージ**: `prod` を選択
3. **「デプロイ」** をクリック

### 問題3: ブラウザでCORSエラーが続くが、curlでは成功する

**原因**: ブラウザのキャッシュまたはCORS設定の不整合

**解決方法**:
1. ブラウザのキャッシュをクリア
2. シークレット/プライベートモードでテスト
3. 別のブラウザでテスト

### 問題4: Lambda関数のエラーが発生している

**原因**: Lambda関数のコードに問題がある

**解決方法**:
1. CloudWatch Logsでエラーログを確認
2. Lambda関数のコードを確認
3. 必要に応じてLambda関数を再デプロイ

## 参考

- [AWS API Gateway CORS ドキュメント](https://docs.aws.amazon.com/apigateway/latest/developerguide/how-to-cors.html)
- [API Gateway CORS設定: 清掃マニュアルエンドポイント](AWS_API_GATEWAY_CORS_CLEANING_MANUAL.md)

