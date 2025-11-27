# サービス管理 AWS実装ガイド

## 📋 実装手順

### ステップ1: Lambda関数にコードを追加 ✅

`lambda_function.py` にサービス管理の処理を追加しました：
- `get_services()` - サービス一覧を取得
- `get_service_detail()` - サービス詳細を取得
- `create_service()` - サービスを作成
- `update_service()` - サービスを更新
- `delete_service()` - サービスを削除

**次のステップ**: Lambda関数をAWSにデプロイしてください。

---

### ステップ2: Lambda関数をデプロイ

1. **AWS Lambdaコンソールにアクセス**
   - https://console.aws.amazon.com/lambda/ にアクセス

2. **Lambda関数を選択**
   - 既存のLambda関数（例: `misesapo-s3-upload`）を選択

3. **コードを更新**
   - 「コード」タブを開く
   - `lambda_function.py` の内容をコピー＆ペースト
   - 「Deploy」をクリック

---

### ステップ3: API Gatewayにリソースを追加

1. **API Gatewayコンソールにアクセス**
   - https://console.aws.amazon.com/apigateway/ にアクセス

2. **APIを選択**
   - 既存のAPI（例: `misesapo-s3-upload-api`）を選択

3. **`/services` リソースを作成**
   - ルートリソース（`/`）を選択
   - 「アクション」→「リソースの作成」をクリック
   - **リソース名**: `services`
   - **リソースパス**: `/services`
   - 「リソースの作成」をクリック

4. **`/services` リソースにメソッドを追加**

   #### GET メソッド
   - `/services` リソースを選択
   - 「アクション」→「メソッドの作成」をクリック
   - **メソッド**: `GET` を選択
   - **統合タイプ**: `Lambda関数` を選択
   - **Lambda関数**: 既存のLambda関数を選択
   - **「Lambdaプロキシ統合を使用」** にチェック
   - 「保存」をクリック

   #### POST メソッド
   - 同様に `POST` メソッドを作成

   #### OPTIONS メソッド（CORS用）
   - 同様に `OPTIONS` メソッドを作成

5. **`/services/{service_id}` リソースを作成**
   - `/services` リソースを選択
   - 「アクション」→「リソースの作成」をクリック
   - **リソース名**: `{service_id}`
   - **リソースパス**: `{service_id}`
   - 「リソースの作成」をクリック

6. **`/services/{service_id}` リソースにメソッドを追加**

   #### GET メソッド
   - `/services/{service_id}` リソースを選択
   - 「アクション」→「メソッドの作成」をクリック
   - **メソッド**: `GET` を選択
   - **統合タイプ**: `Lambda関数` を選択
   - **Lambda関数**: 既存のLambda関数を選択
   - **「Lambdaプロキシ統合を使用」** にチェック
   - 「保存」をクリック

   #### PUT メソッド
   - 同様に `PUT` メソッドを作成

   #### DELETE メソッド
   - 同様に `DELETE` メソッドを作成

   #### OPTIONS メソッド（CORS用）
   - 同様に `OPTIONS` メソッドを作成

7. **CORSを有効化**
   - 各リソース（`/services` と `/services/{service_id}`）で「アクション」→「CORSを有効にする」をクリック
   - デフォルト設定で「CORSを有効にして既存のCORSヘッダーを置き換える」をクリック

8. **APIをデプロイ**
   - 「アクション」→「APIのデプロイ」をクリック
   - **デプロイされるステージ**: `prod` を選択
   - 「デプロイ」をクリック

---

### ステップ4: S3バケットの確認

1. **S3バケットを確認**
   - https://console.aws.amazon.com/s3/ にアクセス
   - バケット `misesapo-cleaning-manual-images` が存在することを確認

2. **サービスデータの初期化（オプション）**
   - バケット内に `services/service_items.json` ファイルを作成
   - 初期データとして空の配列 `[]` を設定

---

### ステップ5: フロントエンドの確認

フロントエンドのコードは既に更新済みです：
- `src/assets/js/aws-services-api.js` - APIエンドポイントを設定済み
- `src/pages/admin/services.html` - AWS APIを使用するように更新済み

**確認事項**:
- API Gatewayエンドポイントが正しく設定されているか確認
  - `src/assets/js/aws-services-api.js` の11行目
  - 現在の値: `https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod`

---

## ✅ 確認チェックリスト

- [ ] Lambda関数にサービス管理のコードが追加されている
- [ ] Lambda関数がデプロイされている
- [ ] API Gatewayに `/services` リソースが作成されている
- [ ] API Gatewayに `/services/{service_id}` リソースが作成されている
- [ ] 各リソースに必要なメソッド（GET, POST, PUT, DELETE, OPTIONS）が作成されている
- [ ] CORSが有効化されている
- [ ] APIが `prod` ステージにデプロイされている
- [ ] S3バケットに `services/service_items.json` が存在する（または空の配列で作成される）

---

## 🧪 テスト方法

### 1. ローカル開発サーバーでテスト

```bash
python3 scripts/dev_server.py
```

ブラウザで `http://localhost:5173/admin/services.html` にアクセスして、サービス一覧が表示されることを確認。

### 2. API Gatewayで直接テスト

AWSコンソールのAPI Gatewayで、各メソッドの「テスト」機能を使用してテストできます。

---

## 📝 注意事項

- サービスデータはS3の `services/service_items.json` に保存されます
- 開発サーバーでは、ローカルの `/api/services` エンドポイントが使用されます
- 本番環境では、API Gatewayのエンドポイントが使用されます








