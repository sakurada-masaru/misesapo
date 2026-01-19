# レポート機能 設定確認チェックリスト

## ✅ 設定確認項目

### 1. Lambda関数

- [ ] Lambda関数のコードが最新版にデプロイされている
- [ ] 環境変数が設定されている：
  - [ ] `S3_BUCKET_NAME`: `misesapo-cleaning-manual-images`
  - [ ] `S3_REGION`: `ap-northeast-1`
- [ ] IAMロールに以下のポリシーがアタッチされている：
  - [ ] `AmazonDynamoDBFullAccess` または DynamoDBへのアクセス権限
  - [ ] `AmazonS3FullAccess` または S3へのアクセス権限

### 2. DynamoDB

- [ ] テーブル `staff-reports` が作成されている
- [ ] テーブルが「アクティブ」状態である
- [ ] パーティションキー: `report_id` (String)
- [ ] ソートキー: `created_at` (String)
- [ ] GSI 1: `staff_id-created_at-index` が「アクティブ」状態
- [ ] GSI 2: `store_id-created_at-index` が「アクティブ」状態
- [ ] GSI 3: `status-created_at-index` が「アクティブ」状態

### 3. API Gateway

- [ ] リソース `/staff/reports` が作成されている
- [ ] メソッドが作成されている：
  - [ ] GET `/staff/reports`
  - [ ] POST `/staff/reports`
  - [ ] PUT `/staff/reports`
  - [ ] OPTIONS `/staff/reports` (CORS用)
- [ ] リソース `/staff/reports/{report_id}` が作成されている
- [ ] メソッドが作成されている：
  - [ ] GET `/staff/reports/{report_id}`
  - [ ] DELETE `/staff/reports/{report_id}`
  - [ ] OPTIONS `/staff/reports/{report_id}` (CORS用)
- [ ] 各メソッドの統合がLambda関数に設定されている
- [ ] CORSが有効化されている
- [ ] APIが `prod` ステージにデプロイされている
- [ ] エンドポイントURLを確認（例: `https://xxxxx.execute-api.ap-northeast-1.amazonaws.com/prod`）

### 4. S3

- [ ] バケット `misesapo-cleaning-manual-images` が存在する
- [ ] Lambda関数からの書き込み権限がある
- [ ] 公開読み取りが許可されている（`reports/*` パス）

### 5. フロントエンド

- [ ] `src/pages/admin/reports.html` の `API_BASE_URL` が設定されている
- [ ] `src/pages/admin/reports/new.html` の `API_BASE_URL` が設定されている
- [ ] `src/pages/admin/reports/[id]/edit.html` の `API_BASE_URL` が設定されている
- [ ] `src/pages/reports/[id].html` の `API_BASE_URL` が設定されている

---

## 🧪 テスト手順

### ステップ1: APIエンドポイントのテスト

1. **APIエンドポイントURLを確認**
   ```bash
   # API Gatewayコンソールで確認
   # 例: https://xxxxx.execute-api.ap-northeast-1.amazonaws.com/prod
   ```

2. **テストスクリプトを実行**
   ```bash
   # APIエンドポイントURLを環境変数に設定
   export API_URL="https://YOUR_API_GATEWAY_URL.execute-api.ap-northeast-1.amazonaws.com/prod"
   
   # テストスクリプトを実行
   ./test-api.sh
   ```

### ステップ2: ブラウザでのテスト

1. **レポート一覧ページ**
   - `/admin/reports.html` にアクセス
   - レポート一覧が表示されるか確認

2. **レポート作成ページ**
   - `/admin/reports/new.html` にアクセス
   - フォームが表示されるか確認
   - レポートを作成して送信

3. **レポート編集ページ**
   - `/admin/reports/{report_id}/edit.html` にアクセス
   - 既存データが読み込まれるか確認

4. **レポート詳細ページ**
   - `/reports/{report_id}.html` にアクセス
   - レポート詳細が表示されるか確認

---

## 🆘 トラブルシューティング

### エラー: `Table not found: staff-reports`
- DynamoDBコンソールでテーブルが作成されているか確認

### エラー: `Access Denied` (DynamoDB)
- Lambda関数のIAMロールに `AmazonDynamoDBFullAccess` を追加

### エラー: `Access Denied` (S3)
- Lambda関数のIAMロールに `AmazonS3FullAccess` を追加

### エラー: `Method not found`
- API Gatewayでメソッドが作成されているか確認
- APIがデプロイされているか確認

### エラー: `CORS error`
- API GatewayでCORSが有効化されているか確認

### エラー: `Unauthorized`
- Firebase IDトークンが正しく送信されているか確認
- Lambda関数の `verify_firebase_token` 関数を確認


