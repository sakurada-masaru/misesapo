# NFCタグ打刻システム - クイックスタートガイド

## 前提条件

- AWSアカウントがあること
- AWS CLIがインストール・設定されていること
- 既存のLambda関数とAPI Gatewayがあること

## 手順1: AWS CLIの確認

まず、AWS CLIが正しく設定されているか確認します：

```bash
aws sts get-caller-identity
```

正常に動作すれば、AWSアカウントID、ユーザー名、ARNが表示されます。

## 手順2: セットアップスクリプトの実行

### 2-1. スクリプトの設定を確認・編集

`scripts/setup_nfc_clock_in.sh` を開いて、以下の変数を環境に合わせて変更してください：

```bash
LAMBDA_FUNCTION_NAME="misesapo-s3-upload"  # 既存のLambda関数名
API_GATEWAY_NAME="misesapo-api"  # 既存のAPI Gateway名（参考用）
REGION="ap-northeast-1"  # リージョン
```

### 2-2. スクリプトを実行

```bash
cd /Users/sakuradamasaru/Desktop/misesapo-main
./scripts/setup_nfc_clock_in.sh
```

このスクリプトが以下を自動実行します：
- ✅ DynamoDBテーブル `cleaning-logs` の作成
- ✅ IAMポリシー `CleaningLogsWritePolicy` の作成
- ✅ Lambda関数のロールへのポリシーアタッチ

## 手順3: Lambda関数のデプロイ

### 3-1. Lambda関数のコードを更新

既存のLambda関数に新しいコードをデプロイします：

**方法A: AWS CLIでデプロイ（推奨）**

```bash
# Lambda関数のZIPファイルを作成
cd /Users/sakuradamasaru/Desktop/misesapo-main
zip -r lambda_function.zip lambda_function.py

# Lambda関数を更新
aws lambda update-function-code \
  --function-name misesapo-s3-upload \
  --zip-file fileb://lambda_function.zip \
  --region ap-northeast-1
```

**方法B: AWSマネジメントコンソールでデプロイ**

1. AWSマネジメントコンソールでLambdaを開く
2. 関数 `misesapo-s3-upload` を選択
3. 「コード」タブを開く
4. `lambda_function.py` の内容をコピー＆ペースト
5. 「Deploy」をクリック

## 手順4: API Gatewayの設定

### 4-1. API Gatewayコンソールを開く

1. AWSマネジメントコンソールでAPI Gatewayを開く
2. 既存のAPI（例: `misesapo-api`）を選択

### 4-2. リソースの作成

1. 左側のメニューから「リソース」を選択
2. `/staff` リソースを探す（なければ作成）
3. `/staff` を選択して「アクション」→「リソースの作成」
4. リソース名: `nfc`
5. 「リソースの作成」をクリック
6. `/staff/nfc` を選択して「アクション」→「リソースの作成」
7. リソース名: `clock-in`
8. 「リソースの作成」をクリック

### 4-3. POSTメソッドの追加

1. `/staff/nfc/clock-in` を選択
2. 「アクション」→「メソッドの作成」→「POST」を選択
3. 統合タイプ: `Lambda関数` を選択
4. Lambda関数: `misesapo-s3-upload` を選択
5. **「Lambdaプロキシ統合を使用」にチェックを入れる**（重要）
6. 「保存」をクリック
7. Lambda関数の権限を許可するか確認されたら「OK」をクリック

### 4-4. GETメソッドの追加（ログ取得用）

1. `/staff/nfc/clock-in` を選択
2. 「アクション」→「メソッドの作成」→「GET」を選択
3. 統合タイプ: `Lambda関数` を選択
4. Lambda関数: `misesapo-s3-upload` を選択
5. **「Lambdaプロキシ統合を使用」にチェックを入れる**
6. 「保存」をクリック

### 4-5. OPTIONSメソッドの追加（CORS対応）

1. `/staff/nfc/clock-in` を選択
2. 「アクション」→「メソッドの作成」→「OPTIONS」を選択
3. 統合タイプ: `MOCK` を選択
4. 「保存」をクリック
5. 「統合レスポンス」をクリック
6. 「200」のステータスコードを選択
7. 「ヘッダーのマッピング」で以下を追加：
   - `Access-Control-Allow-Origin`: `'*'`
   - `Access-Control-Allow-Headers`: `'Content-Type,Authorization'`
   - `Access-Control-Allow-Methods`: `'POST,GET,OPTIONS'`
8. 「保存」をクリック

### 4-6. APIのデプロイ

1. 「アクション」→「APIのデプロイ」をクリック
2. デプロイステージ: `prod`（または既存のステージ）を選択
3. 「デプロイ」をクリック
4. **Invoke URLをメモする**（例: `https://xxxxx.execute-api.ap-northeast-1.amazonaws.com/prod`）

## 手順5: テスト

### 5-1. テストスクリプトの設定

`scripts/test_nfc_clock_in.sh` を開いて、API GatewayのURLを設定：

```bash
# スクリプトの先頭部分を編集
API_URL="https://YOUR_API_GATEWAY_URL/prod/staff/nfc/clock-in"
```

または、環境変数で設定：

```bash
export API_GATEWAY_URL=https://xxxxx.execute-api.ap-northeast-1.amazonaws.com
```

### 5-2. テスト実行

```bash
./scripts/test_nfc_clock_in.sh
```

### 5-3. 手動テスト（cURL）

```bash
# 打刻記録のテスト
curl -X POST https://YOUR_API_GATEWAY_URL/prod/staff/nfc/clock-in \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "WKR_001",
    "facility_id": "ABC_001",
    "location_id": "TK_R01_TOILET_IN"
  }'

# ログ取得のテスト
curl "https://YOUR_API_GATEWAY_URL/prod/staff/nfc/clock-in?user_id=WKR_001&limit=10"
```

## トラブルシューティング

### エラー: "Table cleaning-logs does not exist"

→ DynamoDBテーブルが作成されていない可能性があります。手順2を再実行してください。

### エラー: "AccessDeniedException"

→ Lambda関数のIAMロールにDynamoDBへの書き込み権限がありません。手順2を再実行するか、手動でIAMポリシーをアタッチしてください。

### エラー: "404 Not Found"

→ API Gatewayのエンドポイントが正しく設定されていない可能性があります。手順4を確認してください。

### エラー: "Internal server error"

→ CloudWatch LogsでLambda関数のエラーログを確認してください：

```bash
aws logs tail /aws/lambda/misesapo-s3-upload --follow --region ap-northeast-1
```

## 確認チェックリスト

- [ ] DynamoDBテーブル `cleaning-logs` が作成されている
- [ ] IAMポリシー `CleaningLogsWritePolicy` が作成されている
- [ ] Lambda関数のロールにポリシーがアタッチされている
- [ ] Lambda関数のコードが最新版に更新されている
- [ ] API Gatewayに `/staff/nfc/clock-in` エンドポイントが追加されている
- [ ] POSTメソッドが設定されている
- [ ] GETメソッドが設定されている（ログ取得用）
- [ ] OPTIONSメソッドが設定されている（CORS用）
- [ ] APIがデプロイされている
- [ ] テストが成功している

## 次のステップ

システムが正常に動作することを確認したら：

1. スマートフォンアプリからAPIを呼び出す実装
2. 認証の追加（API Key、Cognito等）
3. 監視とアラートの設定（CloudWatch）
4. コスト最適化（DynamoDBのプロビジョニングモード検討）

