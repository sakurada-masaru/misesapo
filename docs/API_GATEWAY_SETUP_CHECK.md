# API Gateway 設定確認ガイド

## 🔍 現在の状況

APIエンドポイントにアクセスすると404エラーが返ってきています。これは、API Gatewayのリソースが正しく設定されていない可能性があります。

## ✅ 確認手順

### 1. API Gatewayのリソースを確認

1. **AWSコンソールにログイン**
   - https://console.aws.amazon.com/apigateway/ にアクセス

2. **APIを選択**
   - 既存のAPIを選択（例: `misesapo-s3-upload-api`）

3. **リソースを確認**
   - 左メニューの「リソース」を開く
   - 以下のリソースが存在するか確認：
     - `/staff` リソース
     - `/staff/reports` リソース
     - `/staff/reports/{report_id}` リソース

### 2. リソースが存在しない場合

#### 2-1. `/staff` リソースを作成

1. **ルートリソース（`/`）を選択**
2. **「アクション」→「リソースの作成」** をクリック
3. **リソース名**: `staff`
4. **リソースパス**: `/staff`
5. **「リソースの作成」** をクリック

#### 2-2. `/staff/reports` リソースを作成

1. **`/staff` リソースを選択**
2. **「アクション」→「リソースの作成」** をクリック
3. **リソース名**: `reports`
4. **リソースパス**: `/reports`
5. **「リソースの作成」** をクリック

#### 2-3. `/staff/reports/{report_id}` リソースを作成

1. **`/staff/reports` リソースを選択**
2. **「アクション」→「リソースの作成」** をクリック
3. **リソース名**: `{report_id}`
4. **リソースパス**: `{report_id}`
5. **「リソースの作成」** をクリック

### 3. メソッドを作成

#### 3-1. `/staff/reports` リソースのメソッド

1. **`/staff/reports` リソースを選択**
2. **「アクション」→「メソッドの作成」** をクリック
3. **メソッド**: `GET` を選択
4. **統合タイプ**: `Lambda関数` を選択
5. **Lambda関数**: 既存のLambda関数を選択
6. **「Lambdaプロキシ統合を使用」** にチェックを入れる
7. **「保存」** をクリック
8. **「Lambda関数に権限を追加」** のダイアログで **「OK」** をクリック

同様に、以下のメソッドも作成：
- `POST` メソッド
- `PUT` メソッド
- `OPTIONS` メソッド（CORS用）

#### 3-2. `/staff/reports/{report_id}` リソースのメソッド

1. **`/staff/reports/{report_id}` リソースを選択**
2. **「アクション」→「メソッドの作成」** をクリック
3. **メソッド**: `GET` を選択
4. **統合タイプ**: `Lambda関数` を選択
5. **Lambda関数**: 既存のLambda関数を選択
6. **「Lambdaプロキシ統合を使用」** にチェックを入れる
7. **「保存」** をクリック
8. **「Lambda関数に権限を追加」** のダイアログで **「OK」** をクリック

同様に、以下のメソッドも作成：
- `DELETE` メソッド
- `OPTIONS` メソッド（CORS用）

### 4. CORSを有効化

1. **`/staff/reports` リソースを選択**
2. **「アクション」→「CORSを有効にする」** をクリック
3. **「CORSを有効にして既存のCORSヘッダーを置き換える」** にチェックを入れる
4. **「有効化して既存のCORSヘッダーを置き換える」** をクリック

同様に、`/staff/reports/{report_id}` リソースでもCORSを有効化

### 5. APIをデプロイ

1. **「アクション」→「APIのデプロイ」** をクリック
2. **デプロイされるステージ**: `prod` を選択
3. **「デプロイ」** をクリック

### 6. テスト

```bash
# GET /staff/reports
curl -X GET "https://2z0ui5xfxb.execute-api.ap-northeast-1.amazonaws.com/prod/staff/reports" \
  -H "Content-Type: application/json"
```

---

## 🆘 トラブルシューティング

### エラー: `Method not found`
- メソッドが作成されているか確認
- APIがデプロイされているか確認

### エラー: `404 Not Found`
- リソースが正しく作成されているか確認
- リソースパスが正しいか確認（`/staff/reports` など）

### エラー: `CORS error`
- CORSが有効化されているか確認
- OPTIONSメソッドが作成されているか確認

### エラー: `Internal Server Error`
- Lambda関数のログを確認（CloudWatch Logs）
- Lambda関数のコードが正しくデプロイされているか確認

---

## 📝 参考

- [API Gateway リソースの作成](https://docs.aws.amazon.com/apigateway/latest/developerguide/how-to-create-api.html)
- [Lambda関数への統合](https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html)
- [CORSの設定](https://docs.aws.amazon.com/apigateway/latest/developerguide/how-to-cors.html)

