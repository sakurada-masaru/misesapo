# MOCK統合の500エラー修正

## 問題

`/cleaning-manual/draft`のOPTIONSメソッドが500エラーを返しています。MOCK統合の設定は正しく見えますが、メソッドレスポンスの設定が不足している可能性があります。

## 解決方法

### 1. メソッドレスポンスの確認

MOCK統合を使用する場合、メソッドレスポンスでヘッダーを定義する必要があります。

1. **API Gateway** → `misesapo-s3-upload-api` → **リソース** → `/cleaning-manual/draft` を選択
2. **OPTIONS** メソッドを選択
3. **「メソッドレスポンス」** をクリック
4. **「200」** のステータスコードを選択
5. **「HTTP ヘッダー」** タブを確認

以下のヘッダーが定義されているか確認してください：

- `Access-Control-Allow-Headers`
- `Access-Control-Allow-Methods`
- `Access-Control-Allow-Origin`
- `Access-Control-Expose-Headers`（オプション）

### 2. メソッドレスポンスにヘッダーを追加（存在しない場合）

1. **「メソッドレスポンス」** → **「200」** を選択
2. **「HTTP ヘッダー」** タブを開く
3. **「ヘッダーの追加」** をクリック
4. 以下のヘッダーを追加：
   - `Access-Control-Allow-Headers`（必須: チェックを外す）
   - `Access-Control-Allow-Methods`（必須: チェックを外す）
   - `Access-Control-Allow-Origin`（必須: チェックを外す）
   - `Access-Control-Expose-Headers`（必須: チェックを外す、オプション）
5. **「保存」** をクリック

### 3. 統合レスポンスの確認

統合レスポンスで、メソッドレスポンスのヘッダーに値をマッピングする必要があります。

1. **「統合レスポンス」** をクリック
2. **「200」** のステータスコードを選択
3. **「ヘッダーのマッピング」** を確認

以下のマッピングが正しく設定されているか確認してください：

- `method.response.header.Access-Control-Allow-Headers` → `'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'`
- `method.response.header.Access-Control-Allow-Methods` → `'GET,OPTIONS,POST,PUT'`
- `method.response.header.Access-Control-Allow-Origin` → `'*'`
- `method.response.header.Access-Control-Expose-Headers` → `'Content-Type'`（オプション）

### 4. 統合レスポンスのマッピングテンプレートの確認

MOCK統合の場合、統合レスポンスでマッピングテンプレートを設定する必要がある場合があります。

1. **「統合レスポンス」** をクリック
2. **「200」** のステータスコードを選択
3. **「マッピングテンプレート」** タブを確認

**重要**: マッピングテンプレートが設定されていない場合、空のテンプレートを追加してください：

1. **「マッピングテンプレート」** タブを開く
2. **「コンテンツタイプの追加」** をクリック
3. **コンテンツタイプ**: `application/json` と入力
4. **テンプレート本文** に以下を入力：

```
{}
```

または、完全に空のレスポンスを返す場合は、テンプレート本文を空にしてください。

5. **「保存」** をクリック

### 5. API Gatewayのデプロイ

設定を変更した後、必ずAPI Gatewayをデプロイしてください：

1. **「アクション」** → **「API のデプロイ」** をクリック
2. **デプロイされるステージ**: `prod` を選択
3. **「デプロイ」** をクリック

## 確認

修正後、以下のコマンドで確認してください：

```bash
curl -X OPTIONS https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod/cleaning-manual/draft \
  -H "Origin: https://sakurada-masaru.github.io" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -i
```

期待されるレスポンス：
- ステータスコード: `200 OK`
- CORSヘッダーが含まれている

## トラブルシューティング

### 500エラーが続く場合

1. **CloudWatch Logs** でAPI Gatewayのログを確認
2. **メソッドレスポンス** でヘッダーが正しく定義されているか確認
3. **統合レスポンス** でヘッダーのマッピングが正しいか確認
4. **統合リクエスト** でレスポンステンプレートが正しいか確認

## 参考

- [API Gateway MOCK統合](https://docs.aws.amazon.com/apigateway/latest/developerguide/how-to-mock-integration.html)
- [API Gateway メソッドレスポンス](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-method-settings-method-response.html)

