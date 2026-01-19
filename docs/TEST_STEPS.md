# レポート機能 テスト手順

## 📋 ステップ1: AWS設定の確認

### 1-1. DynamoDBテーブルの確認

1. **AWSコンソールにログイン**
   - https://console.aws.amazon.com/dynamodb/ にアクセス

2. **テーブルを確認**
   - 左メニューから「テーブル」を選択
   - `staff-reports` テーブルが存在するか確認
   - テーブルが「アクティブ」状態であることを確認

3. **GSIを確認**
   - `staff-reports` テーブルを選択
   - 「インデックス」タブを開く
   - 以下の3つのGSIが「アクティブ」状態であることを確認：
     - `staff_id-created_at-index`
     - `store_id-created_at-index`
     - `status-created_at-index`

**⚠️ もしGSIが作成されていない、または「作成中」の状態の場合：**
- 1つずつ順番に作成してください（同時に複数作成できません）
- 各GSIが「アクティブ」になるまで待ってから次のGSIを作成

---

### 1-2. Lambda関数の確認

1. **Lambdaコンソールを開く**
   - https://console.aws.amazon.com/lambda/ にアクセス

2. **関数を確認**
   - 既存のLambda関数を選択
   - 「コード」タブで `lambda_function.py` が最新版か確認
   - レポート機能の関数（`create_report`, `get_reports` など）が含まれているか確認

3. **環境変数を確認**
   - 「設定」タブ → 「環境変数」を開く
   - 以下が設定されているか確認：
     ```
     S3_BUCKET_NAME: misesapo-cleaning-manual-images
     S3_REGION: ap-northeast-1
     ```

4. **IAMロールを確認**
   - 「設定」タブ → 「実行ロール」を開く
   - ロール名をクリックしてIAMコンソールを開く
   - 「アクセス許可」タブで以下のポリシーがアタッチされているか確認：
     - `AmazonDynamoDBFullAccess` または DynamoDBへのアクセス権限
     - `AmazonS3FullAccess` または S3へのアクセス権限

**⚠️ もし権限がない場合：**
- 「アクセス許可を追加」→「ポリシーをアタッチ」から追加

---

### 1-3. API Gatewayの確認

1. **API Gatewayコンソールを開く**
   - https://console.aws.amazon.com/apigateway/ にアクセス

2. **リソースを確認**
   - 既存のAPIを選択
   - 左メニューの「リソース」で以下が存在するか確認：
     - `/staff/reports` (GET, POST, PUT, OPTIONS)
     - `/staff/reports/{report_id}` (GET, DELETE, OPTIONS)

3. **メソッドを確認**
   - `/staff/reports` を選択
   - 各メソッド（GET, POST, PUT, OPTIONS）が存在するか確認
   - 各メソッドの「統合リクエスト」でLambda関数が正しく設定されているか確認

4. **CORSを確認**
   - `/staff/reports` を選択
   - 「アクション」→「CORSを有効にする」で設定を確認
   - または、OPTIONSメソッドが存在することを確認

5. **APIをデプロイ**
   - 「アクション」→「APIのデプロイ」を選択
   - デプロイステージ: `prod` を選択
   - 「デプロイ」をクリック

6. **エンドポイントURLをコピー**
   - 「ステージ」タブを開く
   - `prod` ステージを選択
   - 「呼び出しURL」をコピー
   - 例: `https://xxxxx.execute-api.ap-northeast-1.amazonaws.com/prod`

---

## 📋 ステップ2: APIエンドポイントのテスト

### 2-1. テストスクリプトを実行

1. **APIエンドポイントURLを環境変数に設定**
   ```bash
   export API_URL="https://YOUR_API_GATEWAY_URL.execute-api.ap-northeast-1.amazonaws.com/prod"
   ```
   （`YOUR_API_GATEWAY_URL` を実際のURLに置き換えてください）

2. **テストスクリプトを実行**
   ```bash
   ./test-api.sh
   ```

3. **結果を確認**
   - すべてのテストが成功すれば ✅
   - エラーが出た場合は、エラーメッセージを確認

### 2-2. 個別にcurlでテスト

```bash
# 1. GET /staff/reports
curl -X GET "${API_URL}/staff/reports" \
  -H "Content-Type: application/json"

# 2. POST /staff/reports
curl -X POST "${API_URL}/staff/reports" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mock-token" \
  -d '{
    "store_id": "store-001",
    "store_name": "テスト店舗",
    "cleaning_date": "2025-03-28",
    "cleaning_start_time": "10:00",
    "cleaning_end_time": "12:00",
    "work_items": []
  }'
```

---

## 📋 ステップ3: フロントエンドの設定

### 3-1. APIエンドポイントURLを設定

以下のファイルで `API_BASE_URL` を実際のAPI Gateway URLに設定：

1. **`src/pages/admin/reports.html`**
2. **`src/pages/admin/reports/new.html`**
3. **`src/pages/admin/reports/[id]/edit.html`**
4. **`src/pages/reports/[id].html`**

各ファイル内で以下のように設定：
```javascript
const API_BASE_URL = 'https://YOUR_API_GATEWAY_URL.execute-api.ap-northeast-1.amazonaws.com/prod';
```

### 3-2. ブラウザでテスト

1. **ローカルサーバーを起動**
   ```bash
   python3 -m http.server 5173 --directory public
   # または
   npx serve public
   ```

2. **レポート一覧ページを開く**
   - http://localhost:5173/admin/reports.html
   - レポート一覧が表示されるか確認

3. **レポート作成ページを開く**
   - http://localhost:5173/admin/reports/new.html
   - フォームが表示されるか確認
   - レポートを作成して送信

4. **ブラウザの開発者ツールを確認**
   - F12キーで開発者ツールを開く
   - 「Console」タブでエラーメッセージを確認
   - 「Network」タブでAPIリクエストを確認

---

## 🆘 エラーが発生した場合

### エラー: `Table not found: staff-reports`
- DynamoDBコンソールでテーブルが作成されているか確認
- テーブル名が正確か確認（`staff-reports`）

### エラー: `Access Denied` (DynamoDB)
- Lambda関数のIAMロールに `AmazonDynamoDBFullAccess` を追加

### エラー: `Access Denied` (S3)
- Lambda関数のIAMロールに `AmazonS3FullAccess` を追加

### エラー: `Method not found` または `404 Not Found`
- API Gatewayでメソッドが作成されているか確認
- APIがデプロイされているか確認
- エンドポイントURLが正しいか確認

### エラー: `CORS error`
- API GatewayでCORSが有効化されているか確認
- OPTIONSメソッドが作成されているか確認

### エラー: `Unauthorized`
- 現状は `mock-token` で動作するように設定されています
- 本番環境では、Firebase IDトークンを正しく取得する必要があります

---

## ✅ チェックリスト

- [ ] DynamoDBテーブル `staff-reports` が作成されている
- [ ] GSI 3つが「アクティブ」状態である
- [ ] Lambda関数のコードが最新版にデプロイされている
- [ ] Lambda関数の環境変数が設定されている
- [ ] Lambda関数のIAMロールにDynamoDB権限がある
- [ ] Lambda関数のIAMロールにS3権限がある
- [ ] API Gatewayに `/staff/reports` リソースが作成されている
- [ ] API Gatewayに `/staff/reports/{report_id}` リソースが作成されている
- [ ] 各メソッドが正しく設定されている
- [ ] CORSが設定されている
- [ ] APIがデプロイされている
- [ ] APIエンドポイントURLを取得した
- [ ] テストスクリプトが成功した
- [ ] フロントエンドのAPI URLが設定されている
- [ ] ブラウザでレポート一覧が表示される
- [ ] ブラウザでレポート作成ができる

