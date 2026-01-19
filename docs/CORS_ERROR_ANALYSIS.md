# CORSエラー分析と解決方法

## ⚠️ エラー内容

### エラーメッセージ

```
Access to fetch at 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod/workers/W1764549250789' 
from origin 'https://sakurada-masaru.github.io' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

### 発生箇所

- **ページ**: `/admin/users/detail.html?id=W1764549250789`
- **API**: `PUT /workers/W1764549250789`
- **原因**: CORSポリシーによってブロックされている

---

## 🔍 原因分析

### 1. Lambda関数のCORSヘッダー設定

**現状**: Lambda関数ではCORSヘッダーが設定されています

```python
headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
    'Content-Type': 'application/json'
}
```

**問題点**: 
- Lambda関数のレスポンスにCORSヘッダーが含まれているが、API Gatewayが正しく返していない可能性

### 2. API GatewayのCORS設定

**問題点**:
- API GatewayのCORS設定が不十分な可能性
- OPTIONSリクエスト（プリフライト）が正しく処理されていない可能性

### 3. プリフライトリクエスト（OPTIONS）

**現状**: Lambda関数でOPTIONSリクエストの処理は実装されています

```python
if event.get('httpMethod') == 'OPTIONS':
    return {
        'statusCode': 200,
        'headers': headers,
        'body': json.dumps({'message': 'OK'})
    }
```

**問題点**:
- API GatewayでOPTIONSメソッドが有効になっていない可能性

---

## 🔧 解決方法

### 方法1: API GatewayのCORS設定を確認・修正（推奨）

#### ステップ1: API GatewayのCORS設定を確認

1. **AWS Console** → **API Gateway** → **該当のAPI**を選択
2. **リソース** → **`/workers/{id}`**を選択
3. **アクション** → **CORSを有効にする**を選択
4. CORS設定を確認:
   - **Access-Control-Allow-Origin**: `*` または `https://sakurada-masaru.github.io`
   - **Access-Control-Allow-Headers**: `Content-Type,Authorization`
   - **Access-Control-Allow-Methods**: `GET,PUT,POST,DELETE,OPTIONS`

#### ステップ2: OPTIONSメソッドを追加

1. **リソース** → **`/workers/{id}`**を選択
2. **アクション** → **メソッドの作成** → **OPTIONS**を選択
3. **統合タイプ**: **MOCK**を選択
4. **統合レスポンス**でCORSヘッダーを設定

#### ステップ3: APIを再デプロイ

1. **アクション** → **APIのデプロイ**
2. **デプロイステージ**: `prod`を選択
3. **デプロイ**をクリック

---

### 方法2: Lambda関数のCORSヘッダーを強化

#### 修正内容

```python
# CORSヘッダーを強化
headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Credentials': 'false',
    'Content-Type': 'application/json'
}
```

---

### 方法3: API Gatewayの統合レスポンスでCORSヘッダーを設定

#### ステップ1: メソッドの統合レスポンスを設定

1. **リソース** → **`/workers/{id}`** → **PUT**メソッドを選択
2. **統合レスポンス**を選択
3. **ヘッダーマッピング**を追加:
   - **Access-Control-Allow-Origin**: `'*'`
   - **Access-Control-Allow-Headers**: `'Content-Type,Authorization'`
   - **Access-Control-Allow-Methods**: `'GET,PUT,POST,DELETE,OPTIONS'`

---

## 🚀 推奨される解決手順

### ステップ1: API GatewayのCORS設定を確認

```bash
# API GatewayのCORS設定を確認
aws apigateway get-resource \
  --rest-api-id <API_ID> \
  --resource-id <RESOURCE_ID> \
  --region ap-northeast-1
```

### ステップ2: OPTIONSメソッドを追加

```bash
# OPTIONSメソッドを作成
aws apigateway put-method \
  --rest-api-id <API_ID> \
  --resource-id <RESOURCE_ID> \
  --http-method OPTIONS \
  --authorization-type NONE \
  --region ap-northeast-1
```

### ステップ3: APIを再デプロイ

```bash
# APIを再デプロイ
aws apigateway create-deployment \
  --rest-api-id <API_ID> \
  --stage-name prod \
  --region ap-northeast-1
```

---

## 📝 一時的な回避策

### フロントエンド側での対応

CORSエラーが発生する場合、一時的に以下の対応が可能です：

1. **プロキシサーバーを使用**: フロントエンドとAPI Gatewayの間にプロキシサーバーを配置
2. **CORS拡張機能を使用**: ブラウザのCORS拡張機能を使用（開発環境のみ）

**注意**: これらは一時的な回避策であり、根本的な解決ではありません。

---

## ✅ 確認事項

### 1. API GatewayのCORS設定

- [ ] CORSが有効になっているか？
- [ ] OPTIONSメソッドが追加されているか？
- [ ] CORSヘッダーが正しく設定されているか？

### 2. Lambda関数のCORSヘッダー

- [ ] CORSヘッダーがレスポンスに含まれているか？
- [ ] OPTIONSリクエストが正しく処理されているか？

### 3. API Gatewayのデプロイ

- [ ] APIが最新の状態でデプロイされているか？
- [ ] デプロイステージが正しいか？（`prod`）

---

## 🔗 参考資料

- [AWS API Gateway CORS設定](https://docs.aws.amazon.com/ja_jp/apigateway/latest/developerguide/how-to-cors.html)
- [Lambda関数のCORS設定](https://docs.aws.amazon.com/ja_jp/apigateway/latest/developerguide/how-to-cors.html)

