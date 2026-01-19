# APIの役割とアーキテクチャ

## 🏢 わかりやすい例え

**API = 貯蔵庫の受付**

- **貯蔵庫（DynamoDB）**: データが保管されている場所
- **受付（API Gateway + Lambda）**: 貯蔵庫への出入りを管理する窓口
- **利用者（ブラウザ）**: データを取り出したり、格納したりしたい人

**重要なポイント**:
- データを取り出す → **必ず受付（API）を通る**
- データを格納する → **必ず受付（API）を通る**
- 直接貯蔵庫にアクセスすることは**不可能**

---

## 📋 現在のアーキテクチャ

```
┌─────────────┐
│  ブラウザ    │  ← 利用者（データが欲しい/保存したい）
│ (フロントエンド) │
└──────┬──────┘
       │ HTTP/HTTPS
       │ 「データをください」「データを保存してください」
       ▼
┌─────────────────────────────────┐
│      API Gateway                │  ← 受付（出入り管理）
│  https://51bhoxkbxd.../prod     │
│  - エンドポイント管理            │
│  - CORS設定                     │
│  - レート制限                   │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│      Lambda関数                 │  ← 受付係（処理・確認）
│  (lambda_function.py)           │
│  - ビジネスロジック              │
│  - データ変換・バリデーション    │
│  - エラーハンドリング            │
└──────┬──────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│      DynamoDB                   │  ← 貯蔵庫（データ保管）
│  (workers テーブル)              │
│  - データストレージ              │
└─────────────────────────────────┘
```

---

## 🔑 APIの役割（受付としての機能）

### 1. **出入り管理（セキュリティ層）**

**例え**: 貯蔵庫には鍵がかかっていて、受付を通らないと入れない

**問題**: ブラウザから直接DynamoDBにアクセスすることは**不可能**です。

**理由**:
- DynamoDBはAWSの内部サービスで、直接アクセスにはAWS認証情報（アクセスキー、シークレットキー）が必要
- ブラウザに認証情報を埋め込むことは**極めて危険**（誰でも見られる）
- CORS（Cross-Origin Resource Sharing）の制限

**APIの役割（受付として）**:
- Lambda関数がAWS認証情報を持ち、安全にDynamoDBにアクセス
- 認証・認可の処理をサーバー側で実行（受付で本人確認）
- 不正なアクセスを防止（不審者は入れない）

---

### 2. **データアクセスの抽象化（受付での手続き簡素化）**

**例え**: 受付で「W999のデータをください」と言えば、受付が貯蔵庫から取り出してくれる

**APIの役割**:
- DynamoDBの複雑なクエリを簡単なHTTPリクエストに変換
- 例: `GET /workers?email=user@example.com` → DynamoDBのスキャン操作
- フロントエンドはHTTP APIだけを知っていれば良い（貯蔵庫の内部構造を知る必要がない）

---

### 3. **ビジネスロジックの実行**

**APIの役割**:
- データの検証（メールアドレスの形式チェックなど）
- データの変換（role_code → role の変換など）
- 計算処理（統計情報の集計など）
- データの正規化

**例**:
```python
# Lambda関数内で実行
def normalize_worker(worker):
    role_code = worker.get('role_code')
    role = worker.get('role')
    # role_codeからroleを変換するロジック
    if not role and role_code:
        role = role_code_map.get(str(role_code), 'staff')
    return {...}
```

---

### 4. **エラーハンドリング**

**APIの役割**:
- DynamoDBのエラーを適切なHTTPステータスコードに変換
- エラーメッセージをユーザーが理解しやすい形式に変換
- ログ記録（CloudWatch Logs）

**例**:
```python
try:
    response = WORKERS_TABLE.get_item(Key={'id': worker_id})
except Exception as e:
    return {
        'statusCode': 500,
        'body': json.dumps({'error': 'ユーザー情報の取得に失敗しました'})
    }
```

---

### 5. **CORS対応**

**問題**: ブラウザは異なるドメイン間のリクエストを制限（Same-Origin Policy）

**APIの役割**:
- API GatewayでCORSヘッダーを設定
- ブラウザからのリクエストを許可

---

### 6. **パフォーマンス最適化**

**APIの役割**:
- キャッシュ制御
- データのフィルタリング（必要なデータだけを返す）
- ページネーション
- 強整合性読み取りの制御（`ConsistentRead=True`）

---

## ❓ よくある誤解

### 誤解1: 「ページが直接DBにアクセスしている」

**実際**: 
- ページは**API Gateway**にHTTPリクエストを送信
- API Gatewayが**Lambda関数**を呼び出す
- Lambda関数が**DynamoDB**にアクセス
- 結果が逆の順序で返される

### 誤解2: 「APIは不要では？」

**実際**:
- APIがないと、ブラウザからDynamoDBにアクセスできない
- セキュリティ上の問題（認証情報の漏洩）
- ビジネスロジックをどこで実行するか？

---

## 🔍 現在の実装例

### フロントエンド（ブラウザ）

```javascript
// src/assets/js/admin-users.js
const API_BASE = 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod';

// API GatewayにHTTPリクエストを送信
const response = await fetch(`${API_BASE}/workers`, {
  cache: 'no-store'
});
const workers = await response.json();
```

### API Gateway

- エンドポイント: `https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod`
- ルーティング: `/workers` → Lambda関数の`get_workers`関数を呼び出し

### Lambda関数

```python
# lambda_function.py
def get_workers(event, headers):
    # DynamoDBにアクセス
    response = WORKERS_TABLE.scan(ConsistentRead=True)
    workers = response.get('Items', [])
    
    # データを変換・整形
    # ...
    
    # HTTPレスポンスを返す
    return {
        'statusCode': 200,
        'headers': headers,
        'body': json.dumps({'items': workers})
    }
```

### DynamoDB

- テーブル: `workers`
- データを保存・取得

---

## 🐛 不具合が発生する可能性のある箇所

### 1. **API Gatewayの設定**
- ルーティングが正しく設定されていない
- CORSが正しく設定されていない
- メソッド（GET, POST, PUT, DELETE）が正しく設定されていない

### 2. **Lambda関数のエラー**
- コードのバグ
- DynamoDBへのアクセス権限がない
- タイムアウト

### 3. **DynamoDBの設定**
- テーブルが存在しない
- アクセス権限がない
- データが存在しない

### 4. **ネットワークの問題**
- API Gatewayがダウンしている
- Lambda関数がタイムアウトしている
- レート制限に達している

---

## 🔧 トラブルシューティング

### 不具合を確認する手順

1. **ブラウザの開発者ツールを開く**
   - F12キーを押す
   - 「Network」タブを開く
   - ページをリロード
   - `/workers` のリクエストを確認

2. **APIのレスポンスを確認**
   - ステータスコード（200, 404, 500など）
   - レスポンスボディ
   - エラーメッセージ

3. **Lambda関数のログを確認**
   - AWS CloudWatch Logsを確認
   - エラーメッセージを確認

4. **DynamoDBのデータを確認**
   - AWSコンソールでDynamoDBテーブルを確認
   - データが存在するか確認

---

## 📝 まとめ

### API = 貯蔵庫の受付

**APIの役割（受付として）**:
1. **出入り管理（セキュリティ）**: ブラウザからDynamoDBへの安全なアクセス
2. **手続きの簡素化（抽象化）**: 複雑なDynamoDB操作を簡単なHTTP APIに変換
3. **処理・確認（ビジネスロジック）**: データの変換・検証・計算
4. **エラー対応（エラーハンドリング）**: 適切なエラーレスポンス
5. **来客対応（CORS対応）**: ブラウザからのリクエストを許可
6. **効率化（パフォーマンス）**: キャッシュ、フィルタリング、ページネーション

### 重要な原則

**データを取り出す** → **必ずAPI（受付）を通る**  
**データを格納する** → **必ずAPI（受付）を通る**

**結論**: APIは、ブラウザとDynamoDBの間の**必須の中継層（受付）**です。APIなしでは、ブラウザからDynamoDBにアクセスできません。貯蔵庫に直接入ることはできないので、必ず受付を通る必要があります。

