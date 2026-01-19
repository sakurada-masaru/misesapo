# レポート機能 テストガイド

## 📋 テスト項目

### 1. Lambda関数の確認

#### 1-1. Lambda関数のコードを確認

1. **AWS Lambdaコンソールを開く**
   - https://console.aws.amazon.com/lambda/ にアクセス
   - 既存のLambda関数を選択

2. **コードを確認**
   - `lambda_function.py` に以下の関数が含まれているか確認：
     - `create_report()`
     - `get_reports()`
     - `get_report_detail()`
     - `update_report()`
     - `delete_report()`

3. **環境変数を確認**
   - 「設定」タブ → 「環境変数」
   - 以下が設定されているか確認：
     ```
     S3_BUCKET_NAME: misesapo-cleaning-manual-images
     S3_REGION: ap-northeast-1
     ```

#### 1-2. Lambda関数の権限を確認

1. **IAMロールを確認**
   - 「設定」タブ → 「実行ロール」
   - ロール名をクリックしてIAMコンソールを開く

2. **ポリシーを確認**
   - 以下のポリシーがアタッチされているか確認：
     - `AmazonDynamoDBFullAccess` または DynamoDBへのアクセス権限
     - `AmazonS3FullAccess` または S3へのアクセス権限

---

### 2. DynamoDBテーブルの確認

#### 2-1. テーブルの存在確認

1. **DynamoDBコンソールを開く**
   - https://console.aws.amazon.com/dynamodb/ にアクセス

2. **テーブルを確認**
   - テーブル `staff-reports` が存在するか確認
   - テーブルが「アクティブ」状態であることを確認

#### 2-2. GSIの確認

1. **インデックスを確認**
   - テーブル `staff-reports` を選択
   - 「インデックス」タブを開く
   - 以下の3つのGSIが「アクティブ」状態であることを確認：
     - `staff_id-created_at-index`
     - `store_id-created_at-index`
     - `status-created_at-index`

---

### 3. API Gatewayの確認

#### 3-1. リソースの確認

1. **API Gatewayコンソールを開く**
   - https://console.aws.amazon.com/apigateway/ にアクセス
   - 既存のAPIを選択

2. **リソースを確認**
   - 左メニューの「リソース」で以下が存在するか確認：
     - `/staff/reports` (GET, POST, PUT, OPTIONS)
     - `/staff/reports/{report_id}` (GET, DELETE, OPTIONS)

#### 3-2. メソッドの確認

1. **各メソッドを確認**
   - `/staff/reports` → GET, POST, PUT, OPTIONS
   - `/staff/reports/{report_id}` → GET, DELETE, OPTIONS

2. **統合を確認**
   - 各メソッドの「統合リクエスト」を確認
   - Lambda関数が正しく設定されているか確認

#### 3-3. CORSの確認

1. **CORS設定を確認**
   - `/staff/reports` を選択
   - 「アクション」→「CORSを有効にする」で設定を確認
   - 以下のヘッダーが設定されているか確認：
     - `Access-Control-Allow-Origin: *`
     - `Access-Control-Allow-Headers: Content-Type,Authorization`
     - `Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS`

#### 3-4. APIのデプロイ確認

1. **ステージを確認**
   - 「ステージ」タブを開く
   - `prod` ステージが存在するか確認
   - 最新のデプロイが反映されているか確認

2. **エンドポイントURLを確認**
   - `prod` ステージを選択
   - 「呼び出しURL」をコピー
   - 例: `https://xxxxx.execute-api.ap-northeast-1.amazonaws.com/prod`

---

### 4. APIエンドポイントのテスト

#### 4-1. GET /staff/reports のテスト

```bash
# エンドポイントURLを環境変数に設定
export API_URL="https://YOUR_API_GATEWAY_URL.execute-api.ap-northeast-1.amazonaws.com/prod"

# GETリクエストを送信
curl -X GET "${API_URL}/staff/reports" \
  -H "Content-Type: application/json"
```

**期待される結果**:
- ステータスコード: `200`
- レスポンス: `{"items": [], "count": 0}` または レポートのリスト

#### 4-2. POST /staff/reports のテスト

```bash
# テスト用のレポートデータを作成
curl -X POST "${API_URL}/staff/reports" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mock-token" \
  -d '{
    "store_id": "store-001",
    "store_name": "テスト店舗",
    "cleaning_date": "2025-03-28",
    "cleaning_start_time": "10:00",
    "cleaning_end_time": "12:00",
    "work_items": [
      {
        "item_id": "grease-trap",
        "item_name": "グリストラップ",
        "details": {
          "type": "床置き型",
          "count": 1,
          "notes": "テストメモ"
        },
        "work_content": "テスト作業内容",
        "work_memo": "テスト作業メモ",
        "photos": {
          "before": [],
          "after": []
        }
      }
    ]
  }'
```

**期待される結果**:
- ステータスコード: `200`
- レスポンス: `{"status": "success", "message": "レポートを作成しました", "report_id": "..."}`

#### 4-3. GET /staff/reports/{report_id} のテスト

```bash
# 上記で作成したレポートIDを使用
export REPORT_ID="作成されたレポートID"

curl -X GET "${API_URL}/staff/reports/${REPORT_ID}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mock-token"
```

**期待される結果**:
- ステータスコード: `200`
- レスポンス: レポートの詳細データ

#### 4-4. PUT /staff/reports のテスト

```bash
curl -X PUT "${API_URL}/staff/reports" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mock-token" \
  -d '{
    "report_id": "'"${REPORT_ID}"'",
    "store_id": "store-001",
    "store_name": "テスト店舗（更新）",
    "cleaning_date": "2025-03-28",
    "work_items": [...]
  }'
```

**期待される結果**:
- ステータスコード: `200`
- レスポンス: `{"status": "success", "message": "レポートを更新しました", "report_id": "..."}`

#### 4-5. DELETE /staff/reports/{report_id} のテスト

```bash
curl -X DELETE "${API_URL}/staff/reports/${REPORT_ID}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mock-token"
```

**期待される結果**:
- ステータスコード: `200`
- レスポンス: `{"status": "success", "message": "レポートを削除しました"}`

---

### 5. フロントエンドの確認

#### 5-1. APIエンドポイントURLの確認

以下のファイルで `API_BASE_URL` が正しく設定されているか確認：

1. **`src/pages/admin/reports.html`**
   ```javascript
   const API_BASE_URL = 'https://YOUR_API_GATEWAY_URL.execute-api.ap-northeast-1.amazonaws.com/prod';
   ```

2. **`src/pages/admin/reports/new.html`**
   ```javascript
   const API_BASE_URL = 'https://YOUR_API_GATEWAY_URL.execute-api.ap-northeast-1.amazonaws.com/prod';
   ```

3. **`src/pages/admin/reports/[id]/edit.html`**
   ```javascript
   const API_BASE_URL = 'https://YOUR_API_GATEWAY_URL.execute-api.ap-northeast-1.amazonaws.com/prod';
   ```

4. **`src/pages/reports/[id].html`**
   ```javascript
   const API_BASE_URL = 'https://YOUR_API_GATEWAY_URL.execute-api.ap-northeast-1.amazonaws.com/prod';
   ```

#### 5-2. ブラウザでのテスト

1. **レポート一覧ページ**
   - `/admin/reports.html` にアクセス
   - レポート一覧が表示されるか確認
   - エラーが表示されないか確認

2. **レポート作成ページ**
   - `/admin/reports/new.html` にアクセス
   - フォームが表示されるか確認
   - レポートを作成して送信

3. **レポート編集ページ**
   - `/admin/reports/{report_id}/edit.html` にアクセス
   - 既存データが読み込まれるか確認
   - レポートを更新

4. **レポート詳細ページ**
   - `/reports/{report_id}.html` にアクセス
   - レポート詳細が表示されるか確認

---

### 6. エラーの確認方法

#### 6-1. CloudWatch Logs

1. **Lambda関数のログを確認**
   - Lambda関数の「モニタリング」タブ → 「CloudWatch Logs を表示」
   - エラーメッセージを確認

2. **API Gatewayのログを確認**
   - API Gatewayの「ログ」タブ
   - リクエスト/レスポンスを確認

#### 6-2. ブラウザの開発者ツール

1. **コンソールを確認**
   - F12キーで開発者ツールを開く
   - 「Console」タブでエラーメッセージを確認

2. **ネットワークを確認**
   - 「Network」タブでAPIリクエストを確認
   - ステータスコードとレスポンスを確認

---

## 🧪 テスト用スクリプト

### 簡単なテストスクリプト

`test-api.sh` を作成：

```bash
#!/bin/bash

# APIエンドポイントURLを設定
API_URL="https://YOUR_API_GATEWAY_URL.execute-api.ap-northeast-1.amazonaws.com/prod"

echo "=== 1. GET /staff/reports ==="
curl -X GET "${API_URL}/staff/reports" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n\n"

echo "=== 2. POST /staff/reports ==="
RESPONSE=$(curl -s -X POST "${API_URL}/staff/reports" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mock-token" \
  -d '{
    "store_id": "store-001",
    "store_name": "テスト店舗",
    "cleaning_date": "2025-03-28",
    "work_items": []
  }')
echo "$RESPONSE"
echo ""

# レポートIDを抽出（jqが必要）
REPORT_ID=$(echo "$RESPONSE" | grep -o '"report_id":"[^"]*' | cut -d'"' -f4)
echo "Created Report ID: $REPORT_ID"
echo ""

if [ -n "$REPORT_ID" ]; then
  echo "=== 3. GET /staff/reports/${REPORT_ID} ==="
  curl -X GET "${API_URL}/staff/reports/${REPORT_ID}" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer mock-token" \
    -w "\nStatus: %{http_code}\n\n"
fi
```

---

## ✅ チェックリスト

- [ ] Lambda関数のコードが正しくデプロイされている
- [ ] Lambda関数の環境変数が設定されている
- [ ] Lambda関数のIAMロールにDynamoDB権限がある
- [ ] Lambda関数のIAMロールにS3権限がある
- [ ] DynamoDBテーブル `staff-reports` が作成されている
- [ ] GSI 3つが「アクティブ」状態である
- [ ] API Gatewayに `/staff/reports` リソースが作成されている
- [ ] API Gatewayに `/staff/reports/{report_id}` リソースが作成されている
- [ ] 各メソッドが正しく設定されている
- [ ] CORSが設定されている
- [ ] APIがデプロイされている
- [ ] フロントエンドのAPIエンドポイントURLが設定されている
- [ ] GET /staff/reports が動作する
- [ ] POST /staff/reports が動作する
- [ ] GET /staff/reports/{report_id} が動作する
- [ ] PUT /staff/reports が動作する
- [ ] DELETE /staff/reports/{report_id} が動作する

---

## 🆘 よくあるエラーと対処法

### エラー: `Table not found: staff-reports`
- **原因**: DynamoDBテーブルが作成されていない
- **対処**: DynamoDBコンソールでテーブルを作成

### エラー: `Access Denied` (DynamoDB)
- **原因**: Lambda関数にDynamoDB権限がない
- **対処**: IAMロールに `AmazonDynamoDBFullAccess` を追加

### エラー: `Access Denied` (S3)
- **原因**: Lambda関数にS3権限がない
- **対処**: IAMロールに `AmazonS3FullAccess` を追加

### エラー: `Method not found`
- **原因**: API Gatewayでメソッドが作成されていない、またはAPIがデプロイされていない
- **対処**: メソッドを作成してAPIをデプロイ

### エラー: `CORS error`
- **原因**: CORSが設定されていない
- **対処**: API GatewayでCORSを有効化

### エラー: `Unauthorized`
- **原因**: Firebase IDトークンが無効または期限切れ
- **対処**: フロントエンドでFirebase IDトークンを正しく取得


