# API Gateway メソッド設定ガイド

## メソッドごとの統合設定

### GET, PUT, POSTメソッド

**「Lambdaプロキシ統合を使用」にチェックを入れる必要があります。**

これらのメソッドは、Lambda関数で実際の処理（データの取得、保存など）を行うため、Lambda関数に統合する必要があります。

設定手順：
1. リソースを選択（例: `/cleaning-manual`）
2. メソッド（GET, PUT, POST）を選択
3. **「統合リクエスト」** をクリック
4. **統合タイプ**: `Lambda関数` を選択
5. **Lambda関数**: `misesapo-s3-upload` を選択
6. **「Lambdaプロキシ統合を使用」** にチェックを入れる（重要）
7. **「保存」** をクリック

### OPTIONSメソッド

**2つの選択肢があります：**

#### 選択肢1: MOCK統合を使用（推奨）

OPTIONSメソッドは、CORSのプリフライトリクエストを処理するため、通常はMOCK統合を使用してCORSヘッダーを返します。

設定手順：
1. リソースを選択（例: `/cleaning-manual`）
2. **OPTIONS** メソッドを選択
3. **「統合リクエスト」** をクリック
4. **統合タイプ**: `MOCK` を選択
5. **「保存」** をクリック
6. **「統合レスポンス」** をクリック
7. **「200」** のステータスコードを選択
8. **「ヘッダーのマッピング」** で以下を追加：
   - `Access-Control-Allow-Origin`: `'*'`
   - `Access-Control-Allow-Headers`: `'Content-Type'`
   - `Access-Control-Allow-Methods`: `'GET, PUT, POST, OPTIONS'`
9. **「保存」** をクリック

#### 選択肢2: Lambda関数で処理

Lambda関数のコードでOPTIONSリクエストを処理することもできます。この場合、Lambdaプロキシ統合を使用します。

設定手順：
1. リソースを選択（例: `/cleaning-manual`）
2. **OPTIONS** メソッドを選択
3. **「統合リクエスト」** をクリック
4. **統合タイプ**: `Lambda関数` を選択
5. **Lambda関数**: `misesapo-s3-upload` を選択
6. **「Lambdaプロキシ統合を使用」** にチェックを入れる
7. **「保存」** をクリック

**注意**: Lambda関数のコードでOPTIONSリクエストを処理する場合、`lambda_function.py`の最初の部分でOPTIONSリクエストを処理するコードが含まれている必要があります：

```python
# OPTIONSリクエスト（プリフライト）の処理
if event.get('httpMethod') == 'OPTIONS':
    return {
        'statusCode': 200,
        'headers': headers,
        'body': json.dumps({'message': 'OK'})
    }
```

## 推奨設定

### `/cleaning-manual` リソース

- **GET**: Lambdaプロキシ統合を使用
- **PUT**: Lambdaプロキシ統合を使用
- **POST**: Lambdaプロキシ統合を使用
- **OPTIONS**: MOCK統合を使用（推奨）またはLambdaプロキシ統合を使用

### `/cleaning-manual/draft` リソース

- **GET**: Lambdaプロキシ統合を使用
- **PUT**: Lambdaプロキシ統合を使用
- **POST**: Lambdaプロキシ統合を使用
- **OPTIONS**: MOCK統合を使用（推奨）またはLambdaプロキシ統合を使用

## まとめ

- **GET, PUT, POST**: 必ず「Lambdaプロキシ統合を使用」にチェックを入れる
- **OPTIONS**: MOCK統合を使用するか、Lambdaプロキシ統合を使用するか選択可能（MOCK統合が推奨）

## 参考

- [API Gateway Lambda統合](https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html)
- [API Gateway CORS設定](https://docs.aws.amazon.com/apigateway/latest/developerguide/how-to-cors.html)

