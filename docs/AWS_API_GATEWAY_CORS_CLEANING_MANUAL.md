# API Gateway CORS設定: 清掃マニュアルエンドポイント

`/cleaning-manual` と `/cleaning-manual/draft` エンドポイントのCORS設定方法です。

## 問題

GitHub PagesからAPI Gatewayにリクエストを送信すると、以下のCORSエラーが発生します：

```
Access to fetch at 'https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod/cleaning-manual' 
from origin 'https://sakurada-masaru.github.io' has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## 解決方法

API Gatewayで `/cleaning-manual` リソースと `/cleaning-manual/draft` リソースを作成し、CORSを有効にする必要があります。

### ステップ0: `/cleaning-manual` リソースの作成

`/cleaning-manual` リソースが存在しない場合は、まず作成する必要があります。

1. **AWS Console** (https://console.aws.amazon.com/) にアクセス
2. 検索バーに「**API Gateway**」と入力して選択
3. API名 `misesapo-s3-upload-api` をクリック
4. 左側のメニューから **「リソース」** を選択
5. ルートリソース（`/`）を選択
6. **「アクション」** → **「リソースの作成」** をクリック
7. **リソース名**: `cleaning-manual` と入力
8. **リソースパス**: `/cleaning-manual` が自動的に設定されます
9. **「リソースの作成」** をクリック

### ステップ0-1: `/cleaning-manual` リソースにメソッドを追加

1. `/cleaning-manual` リソースを選択
2. **「アクション」** → **「メソッドの作成」** をクリック
3. **メソッド**: `GET` を選択
4. **統合タイプ**: `Lambda関数` を選択
5. **Lambda関数**: `misesapo-s3-upload`（または使用しているLambda関数名）を選択
6. **「保存」** をクリック
7. **「Lambda関数に権限を追加」** のダイアログで **「OK」** をクリック

同様に、`PUT` メソッドも追加してください：
1. `/cleaning-manual` リソースを選択
2. **「アクション」** → **「メソッドの作成」** をクリック
3. **メソッド**: `PUT` を選択
4. **統合タイプ**: `Lambda関数` を選択
5. **Lambda関数**: `misesapo-s3-upload` を選択
6. **「保存」** をクリック

さらに、`POST` メソッドも追加してください（CORS設定で選択できるようにするため）：
1. `/cleaning-manual` リソースを選択
2. **「アクション」** → **「メソッドの作成」** をクリック
3. **メソッド**: `POST` を選択
4. **統合タイプ**: `Lambda関数` を選択
5. **Lambda関数**: `misesapo-s3-upload` を選択
6. **「保存」** をクリック

**注意**: CORS設定の「アクセス制御を許可するメソッド」には、実際にリソースに追加されているメソッドのみが表示されます。`POST`メソッドを追加しないと、CORS設定で`POST`を選択できません。

### ステップ0-2: `/cleaning-manual/draft` リソースの作成

1. `/cleaning-manual` リソースを選択
2. **「アクション」** → **「リソースの作成」** をクリック
3. **リソース名**: `draft` と入力
4. **リソースパス**: `/cleaning-manual/draft` が自動的に設定されます
5. **「リソースの作成」** をクリック

### ステップ0-3: `/cleaning-manual/draft` リソースにメソッドを追加

1. `/cleaning-manual/draft` リソースを選択
2. **「アクション」** → **「メソッドの作成」** をクリック
3. **メソッド**: `GET` を選択
4. **統合タイプ**: `Lambda関数` を選択
5. **Lambda関数**: `misesapo-s3-upload` を選択
6. **「保存」** をクリック

同様に、`PUT` メソッドも追加してください。

さらに、`POST` メソッドも追加してください：
1. `/cleaning-manual/draft` リソースを選択
2. **「アクション」** → **「メソッドの作成」** をクリック
3. **メソッド**: `POST` を選択
4. **統合タイプ**: `Lambda関数` を選択
5. **Lambda関数**: `misesapo-s3-upload` を選択
6. **「保存」** をクリック

### ステップ1: `/cleaning-manual` リソースのCORS設定

**重要**: CORS設定を行う前に、`GET`, `PUT`, `POST` メソッドがすべて追加されていることを確認してください。メソッドが追加されていないと、CORS設定の選択肢に表示されません。

1. **AWS Console** (https://console.aws.amazon.com/) にアクセス
2. 検索バーに「**API Gateway**」と入力して選択
3. API名 `misesapo-s3-upload-api` をクリック
4. 左側のメニューから **「リソース」** を選択
5. `/cleaning-manual` リソースをクリック
6. **「アクション」** → **「CORS を有効にする」** をクリック
7. 以下の設定を入力：
   - **アクセス制御を許可するオリジン**: `*`（すべてのオリジン）
   - **アクセス制御を許可するヘッダー**: `Content-Type`
   - **アクセス制御を許可するメソッド**: `GET, PUT, POST, OPTIONS` にチェック
8. **「CORS を有効にして既存の CORS ヘッダーを置き換える」** をクリック
9. **「はい、既存の値を置き換えます」** をクリック

### ステップ2: `/cleaning-manual/draft` リソースのCORS設定

1. `/cleaning-manual` リソースを展開
2. `/draft` リソースをクリック
3. **「アクション」** → **「CORS を有効にする」** をクリック
4. 以下の設定を入力：
   - **アクセス制御を許可するオリジン**: `*`（すべてのオリジン）
   - **アクセス制御を許可するヘッダー**: `Content-Type`
   - **アクセス制御を許可するメソッド**: `GET, PUT, POST, OPTIONS` にチェック
5. **「CORS を有効にして既存の CORS ヘッダーを置き換える」** をクリック
6. **「はい、既存の値を置き換えます」** をクリック

### ステップ3: API Gatewayのデプロイ

**重要**: CORS設定を変更した後、必ずAPI Gatewayをデプロイする必要があります。

1. **「アクション」** → **「API のデプロイ」** をクリック
2. **デプロイされるステージ**: `prod` を選択
3. **「デプロイ」** をクリック

### ステップ4: OPTIONSメソッドの確認

各リソースにOPTIONSメソッドが存在することを確認してください。

#### `/cleaning-manual` リソースのOPTIONSメソッド

1. `/cleaning-manual` リソースを選択
2. **「メソッド」** タブで `OPTIONS` メソッドが存在するか確認
3. 存在しない場合：
   - **「アクション」** → **「メソッドの作成」** をクリック
   - **メソッド**: `OPTIONS` を選択
   - **統合タイプ**: `MOCK` を選択
   - **「保存」** をクリック
   - **「統合レスポンス」** をクリック
   - **「200」** のステータスコードを選択
   - **「ヘッダーのマッピング」** で以下を追加：
     - `Access-Control-Allow-Origin`: `'*'`
     - `Access-Control-Allow-Headers`: `'Content-Type'`
     - `Access-Control-Allow-Methods`: `'GET, PUT, POST, OPTIONS'`
   - **「保存」** をクリック

#### `/cleaning-manual/draft` リソースのOPTIONSメソッド

1. `/cleaning-manual/draft` リソースを選択
2. 上記と同じ手順でOPTIONSメソッドを追加

## 設定の確認

### 1. OPTIONSリクエストのテスト

```bash
# /cleaning-manual エンドポイント
curl -X OPTIONS https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod/cleaning-manual \
  -H "Origin: https://sakurada-masaru.github.io" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -i

# /cleaning-manual/draft エンドポイント
curl -X OPTIONS https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod/cleaning-manual/draft \
  -H "Origin: https://sakurada-masaru.github.io" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -i
```

期待されるレスポンスヘッダー：
```
HTTP/1.1 200 OK
access-control-allow-origin: *
access-control-allow-methods: GET, PUT, POST, OPTIONS
access-control-allow-headers: Content-Type
```

### 2. 実際のGETリクエストのテスト

```bash
curl -X GET https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod/cleaning-manual \
  -H "Origin: https://sakurada-masaru.github.io" \
  -i
```

期待されるレスポンス：
- ステータスコード: `200 OK`
- ヘッダーに `access-control-allow-origin: *` が含まれている

## トラブルシューティング

### CORSエラーが続く場合

1. **API Gatewayのデプロイを確認**
   - CORS設定を変更した後、必ず **「API のデプロイ」** を実行
   - ステージ `prod` にデプロイされているか確認

2. **Lambda関数のレスポンスヘッダーを確認**
   - `lambda_function.py` の `headers` に `'Access-Control-Allow-Origin': '*'` が含まれているか確認
   - Lambda関数が最新バージョンにデプロイされているか確認

3. **ブラウザのキャッシュをクリア**
   - ブラウザのキャッシュが古いCORS設定を保持している可能性があります
   - ハードリロード（Ctrl+Shift+R または Cmd+Shift+R）を実行

4. **API Gatewayのログを確認**
   - CloudWatch LogsでAPI Gatewayのログを確認
   - エラーメッセージやステータスコードを確認

## 参考

- [AWS API Gateway CORS ドキュメント](https://docs.aws.amazon.com/apigateway/latest/developerguide/how-to-cors.html)
- [Lambda関数のコード](lambda_function.py)

