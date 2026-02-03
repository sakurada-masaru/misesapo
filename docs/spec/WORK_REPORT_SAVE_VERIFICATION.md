# 業務報告の保存状況確認手順

## 目的
業務報告が正しくDynamoDBに保存されているか確認する。

---

## 1. Lambda環境変数の確認

### 実行コマンド
```bash
./scripts/check_work_reports_lambda_env.sh
```

### 確認項目
- `UNIVERSAL_WORK_LOGS_TABLE` が `misesapo-sales-work-reports` であること
- `WORK_REPORTS_BUCKET` が `misesapo-work-reports` であること
- `AWS_REGION` が `ap-northeast-1` であること

### 期待される出力
```
✅ Environment variables are correctly set!
  UNIVERSAL_WORK_LOGS_TABLE: misesapo-sales-work-reports
  WORK_REPORTS_BUCKET: misesapo-work-reports
```

### 問題がある場合
```bash
# Lambdaを再デプロイ
./scripts/deploy_work_reports_lambda.sh prod
```

---

## 2. DynamoDBテーブルの内容確認

### 2-1. テーブルの件数確認

```bash
python3 scripts/list_work_reports_table.py
```

### 期待される出力
```
Table: misesapo-sales-work-reports
Items (this scan): 5+
  [1] log_id=xxx-xxx-xxx work_date=2026-01-28 state=submitted
  [2] log_id=yyy-yyy-yyy work_date=2026-01-27 state=draft
  ...
```

### 問題がある場合
- `Items (this scan): 0` または `(no items)` の場合、保存が実行されていない可能性があります。

### 2-2. 特定のlog_idで確認

```bash
python3 scripts/get_work_report_by_id.py <log_id>
```

### 例
```bash
python3 scripts/get_work_report_by_id.py 28c19e6e-225f-4497-9148-24b491845c56
```

### 期待される出力
```json
{
  "log_id": "28c19e6e-225f-4497-9148-24b491845c56",
  "worker_id": "user-123",
  "work_date": "2026-01-28",
  "state": "submitted",
  "version": 2,
  "created_at": "2026-01-28T10:00:00+09:00",
  "updated_at": "2026-01-28T10:05:00+09:00",
  ...
}
```

### 問題がある場合
- `Not found: log_id=xxx` の場合、そのlog_idはテーブルに存在しません。

---

## 3. CloudWatch Logsで保存処理のログ確認

### 3-1. AWSコンソールで確認

1. AWSコンソール → CloudWatch → Log groups
2. `/aws/lambda/misesapo-work-reports` を選択
3. 最新のログストリームを開く

### 3-2. 確認すべきログ

#### 保存処理の開始
```
[WORK_REPORT] saving log_id=xxx, table=misesapo-sales-work-reports, existing=false, worker_id=user-123
[PUT /work-report] About to save: log_id=xxx, table=misesapo-sales-work-reports
```

#### 保存処理の成功
```
[WORK_REPORT] saved log_id=xxx, table=misesapo-sales-work-reports, version=1
[PUT /work-report] Saved successfully: log_id=xxx, table=misesapo-sales-work-reports
```

#### 保存処理の失敗
```
[WORK_REPORT] DynamoDB ClientError: code=AccessDeniedException, message=...
[PUT /work-report] DynamoDB ClientError - AccessDeniedException: ...
```

### 3-3. AWS CLIで確認

```bash
# 最新のログイベントを取得
aws logs tail /aws/lambda/misesapo-work-reports --follow --format short

# 特定の時間範囲で検索
aws logs filter-log-events \
  --log-group-name /aws/lambda/misesapo-work-reports \
  --start-time $(date -d '1 hour ago' +%s)000 \
  --filter-pattern "[WORK_REPORT] saved"
```

---

## 4. 実際の保存フロー確認

### 4-1. フロントエンドで提出

1. ブラウザで `https://misesapo.co.jp/misogi/#/sales/report-day` を開く
2. 日次サマリを入力
3. 「日次サマリを下書き保存」をクリック
4. 「提出する」をクリック
5. 共有URLが表示されることを確認

### 4-2. ネットワークタブで確認

1. ブラウザの開発者ツール → Networkタブを開く
2. 「提出する」をクリック
3. 以下のリクエストを確認：

#### PUT /api-wr/work-report (下書き保存)
- Status: 200
- Response: `{ "log_id": "xxx", "version": 1, "state": "draft" }`

#### PATCH /api-wr/work-report/{log_id} (提出)
- Status: 200
- Response: `{ "log_id": "xxx", "version": 2, "state": "submitted" }`

#### GET /api-wr/work-report/{log_id} (検証)
- Status: 200
- Response: `{ "log_id": "xxx", "state": "submitted", ... }`

### 4-3. 保存されたlog_idで確認

共有URLから`log_id`を取得して、以下を実行：

```bash
python3 scripts/get_work_report_by_id.py <log_id>
```

---

## 5. 問題の切り分け

### 問題: テーブルが空（0件）

**原因の可能性:**
1. Lambdaの環境変数が間違っている
2. DynamoDBへの権限がない
3. 保存処理が実行されていない

**確認方法:**
```bash
# 1. Lambda環境変数を確認
./scripts/check_work_reports_lambda_env.sh

# 2. IAM権限を確認
aws iam get-role-policy \
  --role-name misesapo-work-reports-role \
  --policy-name WorkReportsDynamoDBPolicy

# 3. CloudWatch Logsでエラーを確認
aws logs tail /aws/lambda/misesapo-work-reports --follow
```

### 問題: 特定のlog_idが見つからない

**原因の可能性:**
1. 別のテーブルに保存されている
2. 保存処理が失敗している
3. log_idが間違っている

**確認方法:**
```bash
# 1. 全てのテーブルをスキャン（別テーブルの可能性）
python3 scripts/list_work_reports_table.py 100

# 2. CloudWatch Logsで保存処理のログを確認
aws logs filter-log-events \
  --log-group-name /aws/lambda/misesapo-work-reports \
  --filter-pattern "log_id=xxx"
```

### 問題: 保存は成功しているが、GETで404

**原因の可能性:**
1. Lambdaの環境変数が間違っている（保存先と読み取り先が異なる）
2. API Gatewayのルーティングが間違っている

**確認方法:**
```bash
# 1. Lambda環境変数を確認
./scripts/check_work_reports_lambda_env.sh

# 2. 直接DynamoDBで確認
python3 scripts/get_work_report_by_id.py <log_id>

# 3. API Gatewayの設定を確認
aws apigateway get-resources --rest-api-id 1x0f73dj2l
```

---

## 6. 修正手順

### Lambda環境変数が間違っている場合

```bash
# Lambdaを再デプロイ
./scripts/deploy_work_reports_lambda.sh prod

# 環境変数を確認
./scripts/check_work_reports_lambda_env.sh
```

### DynamoDB権限がない場合

```bash
# IAMポリシーを付与
./scripts/aws/attach_work_reports_dynamodb_policy.sh
```

### テーブルが存在しない場合

```bash
# テーブルを作成
./scripts/aws/create_sales_work_reports_table.sh
```

---

## 7. 期待される動作

### 正常なフロー

1. **下書き保存**
   - PUT /api-wr/work-report → 200 OK
   - Response: `{ "log_id": "xxx", "version": 1, "state": "draft" }`
   - DynamoDBに保存される

2. **提出**
   - PATCH /api-wr/work-report/xxx → 200 OK
   - Response: `{ "log_id": "xxx", "version": 2, "state": "submitted" }`
   - DynamoDBのstateが`submitted`に更新される

3. **検証**
   - GET /api-wr/work-report/xxx → 200 OK
   - Response: `{ "log_id": "xxx", "state": "submitted", ... }`
   - サーバーで読み取れることを確認

4. **モーダル表示**
   - 検証成功後に共有URLを表示

### 確認ポイント

- ✅ 下書き保存が成功している
- ✅ 提出が成功している
- ✅ DynamoDBに保存されている
- ✅ GETで読み取れる
- ✅ 共有URLが表示される

---

## 8. トラブルシューティング

### エラー: `AccessDeniedException`

**原因:** DynamoDBへの権限がない

**解決:**
```bash
./scripts/aws/attach_work_reports_dynamodb_policy.sh
```

### エラー: `TableNotFoundException`

**原因:** テーブルが存在しない

**解決:**
```bash
./scripts/aws/create_sales_work_reports_table.sh
```

### エラー: `ConditionalCheckFailedException`

**原因:** 楽観ロックのバージョン不一致

**解決:** フロントエンドで最新のversionを取得して再試行

### エラー: `log_id missing in response`

**原因:** Lambdaのレスポンスにlog_idが含まれていない

**解決:** Lambdaのコードを確認（`universal_work_reports.py`のレスポンス処理）

---

## まとめ

保存状況を確認するには：

1. **Lambda環境変数**を確認
2. **DynamoDBテーブル**の内容を確認
3. **CloudWatch Logs**で保存処理のログを確認
4. **フロントエンド**で実際に提出して確認

全ての確認が成功すれば、保存は正しく動作しています。
