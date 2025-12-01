# CORSエラー修正: Workers DELETE API

## 🔴 エラー内容

```
Access to fetch at 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod/workers/4' 
from origin 'https://sakurada-masaru.github.io' has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## 📋 原因

DELETEリクエストは、ブラウザがプリフライトリクエスト（OPTIONS）を自動的に送信します。API Gateway側で `/workers/{id}` リソースのDELETEメソッドに対して、OPTIONSメソッドとCORSヘッダーが適切に設定されていないため、エラーが発生しています。

## 🔧 解決方法

### 方法1: API Gatewayコンソールから設定（推奨）

1. **AWS Console** (https://console.aws.amazon.com/) にアクセス
2. 検索バーに「**API Gateway**」と入力して選択
3. API名を選択（`misesapo-s3-upload-api` または該当するAPI）
4. 左側のメニューから **「リソース」** を選択
5. `/workers/{id}` リソースを展開
6. **DELETE** メソッドを選択
7. **「アクション」** → **「CORS を有効にする」** をクリック
8. 以下の設定を入力：
   - **アクセス制御を許可するオリジン**: `*`（すべてのオリジン）または `https://sakurada-masaru.github.io`
   - **アクセス制御を許可するヘッダー**: `Content-Type,Authorization`
   - **アクセス制御を許可するメソッド**: `DELETE, OPTIONS` にチェック
9. **「CORS を有効にして既存の CORS ヘッダーを置き換える」** をクリック
10. **「はい、既存の値を置き換えます」** をクリック
11. **「アクション」** → **「API のデプロイ」** をクリック
12. デプロイステージを選択（`prod`）して **「デプロイ」** をクリック

### 方法2: AWS CLIで設定

```bash
# API IDとリソースIDを取得
REST_API_ID="your-api-id"
WORKERS_RESOURCE_ID="your-resource-id"
WORKER_ID_RESOURCE_ID="your-worker-id-resource-id"

# OPTIONSメソッドを追加
aws apigateway put-method \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WORKER_ID_RESOURCE_ID} \
  --http-method OPTIONS \
  --authorization-type NONE \
  --region ap-northeast-1

# OPTIONSメソッドの統合を設定（MOCK）
aws apigateway put-integration \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WORKER_ID_RESOURCE_ID} \
  --http-method OPTIONS \
  --type MOCK \
  --request-templates '{"application/json":"{\"statusCode\":200}"}' \
  --region ap-northeast-1

# OPTIONSメソッドのレスポンスを設定
aws apigateway put-method-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WORKER_ID_RESOURCE_ID} \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters "method.response.header.Access-Control-Allow-Headers=false,method.response.header.Access-Control-Allow-Methods=false,method.response.header.Access-Control-Allow-Origin=false" \
  --region ap-northeast-1

aws apigateway put-integration-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WORKER_ID_RESOURCE_ID} \
  --http-method OPTIONS \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Headers":"'"'"'Content-Type,Authorization'"'"'","method.response.header.Access-Control-Allow-Methods":"'"'"'DELETE,OPTIONS'"'"'","method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'"}' \
  --region ap-northeast-1

# DELETEメソッドのレスポンスにもCORSヘッダーを追加
aws apigateway put-method-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WORKER_ID_RESOURCE_ID} \
  --http-method DELETE \
  --status-code 200 \
  --response-parameters "method.response.header.Access-Control-Allow-Origin=false" \
  --region ap-northeast-1

aws apigateway put-integration-response \
  --rest-api-id ${REST_API_ID} \
  --resource-id ${WORKER_ID_RESOURCE_ID} \
  --http-method DELETE \
  --status-code 200 \
  --response-parameters '{"method.response.header.Access-Control-Allow-Origin":"'"'"'*'"'"'"}' \
  --region ap-northeast-1

# APIをデプロイ
aws apigateway create-deployment \
  --rest-api-id ${REST_API_ID} \
  --stage-name prod \
  --region ap-northeast-1
```

### 方法3: Lambda関数のレスポンスヘッダーで対応

Lambda関数のレスポンスにCORSヘッダーを追加する方法もありますが、OPTIONSリクエストの処理も必要です。

```python
def lambda_handler(event, context):
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Content-Type': 'application/json'
    }
    
    # OPTIONSリクエスト（プリフライト）の処理
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'message': 'OK'})
        }
    
    # DELETEリクエストの処理
    if event.get('httpMethod') == 'DELETE':
        # 削除処理...
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'success': True})
        }
```

## ✅ 確認方法

1. ブラウザの開発者ツール（F12）を開く
2. Networkタブを選択
3. ユーザー削除を試行
4. OPTIONSリクエストとDELETEリクエストの両方が成功することを確認
5. レスポンスヘッダーに `Access-Control-Allow-Origin` が含まれていることを確認

## 📝 注意事項

- CORS設定を変更した後は、必ずAPI Gatewayをデプロイする必要があります
- 本番環境（`prod`ステージ）にデプロイすることを忘れないでください
- セキュリティ上、`Access-Control-Allow-Origin: *` ではなく、特定のオリジンを指定することを推奨します

