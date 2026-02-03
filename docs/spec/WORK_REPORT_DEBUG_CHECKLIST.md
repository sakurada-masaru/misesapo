# 業務報告が保存されない問題のデバッグチェックリスト

## 問題
CloudWatch Logsに保存処理のログ（`[WORK_REPORT] saving`、`[WORK_REPORT] saved`）が全く出ていない。

## 確認すべきポイント

### 1. Lambdaが呼ばれているか

**確認方法:**
```bash
aws logs tail /aws/lambda/misesapo-work-reports --since 10m --follow
```

**期待されるログ:**
- `START RequestId: xxx`
- `[lambda_handler] Routing to handle_universal_worker_work_reports`
- `[handle_universal_worker_work_reports] ENTRY`

**問題がある場合:**
- `START RequestId`も出ていない → API Gatewayのルーティングが間違っている
- `[lambda_handler]`のログは出ているが`[handle_universal_worker_work_reports] ENTRY`が出ていない → インポートエラーまたはルーティング不一致

### 2. インポートエラーがないか

**確認方法:**
CloudWatch Logsで以下を検索：
```
[lambda_work_reports] universal_work_reports not available
```

**問題がある場合:**
- このエラーが出ている → `universal_work_reports.py`のインポートに失敗している
- LambdaのZIPファイルに`universal_work_reports.py`が含まれていない可能性

**解決方法:**
```bash
# Lambdaを再デプロイ
./scripts/deploy_work_reports_lambda.sh prod

# ZIPファイルの内容を確認
unzip -l /tmp/lambda_work_reports_*.zip
```

### 3. パスとメソッドが正しくマッチしているか

**確認方法:**
CloudWatch Logsで以下を検索：
```
[DEBUG] handle_universal_worker_work_reports: method=PUT, path=/work-report
[DEBUG] Checking PUT /work-report: method=PUT (==PUT? True), path=/work-report (==/work-report? True)
```

**問題がある場合:**
- `method=PUT`だが`(==PUT? False)` → メソッドの正規化に問題がある
- `path=/work-report`だが`(==/work-report? False)` → パスの正規化に問題がある

### 4. 認証が通っているか

**確認方法:**
CloudWatch Logsで以下を検索：
```
[work-report] 401: user_info is None
```

**問題がある場合:**
- このエラーが出ている → 認証トークンが正しく渡されていない
- フロントエンドで`Authorization`ヘッダーが設定されているか確認

### 5. 保存処理に到達しているか

**確認方法:**
CloudWatch Logsで以下を検索：
```
[WORK_REPORT] saving log_id=xxx
[PUT /work-report] About to save
```

**問題がある場合:**
- このログが出ていない → 保存処理の分岐に到達していない
- パスやメソッドのマッチングに問題がある可能性

### 6. DynamoDBへの書き込みが実行されているか

**確認方法:**
CloudWatch Logsで以下を検索：
```
[WORK_REPORT] saved log_id=xxx
[PUT /work-report] Saved successfully
```

**問題がある場合:**
- `[WORK_REPORT] saving`は出ているが`[WORK_REPORT] saved`が出ていない → DynamoDBへの書き込みでエラーが発生している
- `DynamoDB ClientError`のログを確認

### 7. エラーログの確認

**確認方法:**
CloudWatch Logsで以下を検索：
```
ERROR
Exception
Traceback
ClientError
```

**問題がある場合:**
- エラーログが出ている → エラーの内容を確認して修正

## デバッグ手順

1. **Lambdaを再デプロイ**
   ```bash
   ./scripts/deploy_work_reports_lambda.sh prod
   ```

2. **フロントエンドで提出を実行**
   - ブラウザで業務報告を提出
   - Networkタブでリクエストを確認

3. **CloudWatch Logsで確認**
   ```bash
   aws logs tail /aws/lambda/misesapo-work-reports --since 5m --follow
   ```

4. **各ステップのログを確認**
   - `[lambda_handler]`のログが出ているか
   - `[handle_universal_worker_work_reports] ENTRY`のログが出ているか
   - `[DEBUG] Checking PUT /work-report`のログが出ているか
   - `[WORK_REPORT] saving`のログが出ているか
   - `[WORK_REPORT] saved`のログが出ているか

5. **問題の特定**
   - どのステップでログが止まっているか確認
   - エラーログがあれば内容を確認

## よくある問題と解決方法

### 問題: `[lambda_handler]`のログも出ていない

**原因:** API Gatewayのルーティングが間違っている

**解決方法:**
```bash
# API Gatewayの設定を確認
aws apigateway get-resources --rest-api-id 1x0f73dj2l

# /work-report の統合を確認
aws apigateway get-integration \
  --rest-api-id 1x0f73dj2l \
  --resource-id <resource-id> \
  --http-method PUT
```

### 問題: `[lambda_work_reports] universal_work_reports not available`

**原因:** `universal_work_reports.py`のインポートに失敗

**解決方法:**
```bash
# Lambdaを再デプロイ
./scripts/deploy_work_reports_lambda.sh prod

# ZIPファイルの内容を確認
unzip -l /tmp/lambda_work_reports_*.zip | grep universal_work_reports
```

### 問題: `[work-report] 401: user_info is None`

**原因:** 認証トークンが正しく渡されていない

**解決方法:**
- フロントエンドで`Authorization`ヘッダーが設定されているか確認
- Cognitoのトークンが有効か確認

### 問題: `[WORK_REPORT] saving`は出ているが`[WORK_REPORT] saved`が出ていない

**原因:** DynamoDBへの書き込みでエラーが発生

**解決方法:**
- CloudWatch Logsで`DynamoDB ClientError`のログを確認
- IAM権限を確認: `./scripts/aws/attach_work_reports_dynamodb_policy.sh`
- テーブルが存在するか確認: `aws dynamodb describe-table --table-name misesapo-sales-work-reports`
