# CORSエラー分析: 顧客管理API

## ⚠️ エラー内容

### エラーメッセージ

```
Access to fetch at 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod/clients' 
from origin 'https://misesapo.co.jp' has been blocked by CORS policy: 
Request header field authorization is not allowed by Access-Control-Allow-Headers in preflight response.
```

### 発生箇所

- **ページ**: `/sales/clients/`
- **API**: `GET /clients`, `GET /stores`, `GET /brands`
- **原因**: API GatewayのCORS設定で`Authorization`ヘッダーが許可されていない

---

## 🔍 原因分析

### 1. Lambda関数のCORSヘッダー設定

**現状**: Lambda関数ではCORSヘッダーが設定されています

```python
headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Credentials': 'false',
    'Content-Type': 'application/json'
}
```

**問題点**: 
- Lambda関数のレスポンスにCORSヘッダーが含まれているが、API GatewayのOPTIONSメソッド（プリフライトリクエスト）で`Authorization`ヘッダーが許可されていない

### 2. API GatewayのCORS設定

**問題点**:
- `/clients`, `/stores`, `/brands`エンドポイントのOPTIONSメソッドで`Authorization`ヘッダーが許可されていない
- プリフライトリクエスト（OPTIONS）が正しく処理されていない可能性

---

## 🔧 解決方法

### 方法1: API GatewayのCORS設定を修正（推奨）

`/clients`, `/stores`, `/brands`エンドポイントのOPTIONSメソッドの統合レスポンスで、`Authorization`ヘッダーを許可する必要があります。

#### 修正内容

OPTIONSメソッドの統合レスポンスで以下のヘッダーを設定：

```
Access-Control-Allow-Headers: Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token
Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS
Access-Control-Allow-Origin: *
```

---

## 🚀 実装手順

### ステップ1: CORS設定スクリプトの作成

`scripts/setup_clients_api_cors.sh`を作成して、以下のエンドポイントのCORS設定を修正：

- `/clients`
- `/stores`
- `/brands`

### ステップ2: スクリプトの実行

```bash
chmod +x scripts/setup_clients_api_cors.sh
./scripts/setup_clients_api_cors.sh
```

### ステップ3: 動作確認

1. ブラウザの開発者ツールでNetworkタブを開く
2. `/sales/clients/`ページにアクセス
3. `/clients`, `/stores`, `/brands`エンドポイントへのリクエストが成功することを確認
4. OPTIONSリクエストが200ステータスで返り、`Authorization`ヘッダーが許可されていることを確認

---

## 📝 注意事項

- API GatewayのCORS設定を変更した後は、必ずAPIをデプロイする必要があります
- プリフライトリクエスト（OPTIONS）は、ブラウザが自動的に送信するため、明示的にOPTIONSメソッドを設定する必要があります

