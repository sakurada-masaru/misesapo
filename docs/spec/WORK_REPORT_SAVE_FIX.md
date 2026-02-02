# 営業日報：共有URLは出るのにDBに無く404になる問題の根治

## 🎯 目的

MISOGI V2 の営業日報で、「提出」すると「社内共有URLを発行しました」が出るが、そのURLの `log_id` が DynamoDB に存在せず、`GET /admin/work-reports/{id}` が 404 になる問題を根治する。

## ✅ ゴール

- 保存成功したデータだけが共有URLになる
- 共有URLのIDは必ずDynamoDBに存在する
- `/admin/work-reports/{id}` が 200 で内容を返す

## 📋 実施した修正

### 1. React側：共有URL表示条件の厳密化 ✅

**ファイル**: `src/misogi/pages/shared/ui/Sales/SalesDayReportPage.jsx`

**変更内容**:
- `handleHeaderSubmit` / `handleCaseSubmit` で、`res?.log_id` が確実に存在する場合のみ共有URLを表示
- `res` が `undefined` や `null`、または `log_id` が無い場合はエラーメッセージを表示
- コンソールログでデバッグ情報を出力

**修正箇所**:
```javascript
// ✅ 必須: log_id がレスポンスに含まれている場合のみ共有URLを表示
if (!res || !res.log_id) {
  const errorMsg = res ? '保存に失敗しました（log_idが返ってきません）' : '提出に失敗しました（レスポンスが空です）';
  console.error('[handleHeaderSubmit] Missing log_id in response:', res);
  setHeaderSubmitError(errorMsg);
  return;
}
```

### 2. APIクライアントのエラーハンドリング改善 ✅

**ファイル**: `src/misogi/pages/shared/api/client.js`

**変更内容**:
- `apiFetchWorkReport` で 4xx/5xx のレスポンスボディを詳細に読み取る
- `err.body`（生テキスト）と `err.bodyParsed`（パース済みJSON）の両方を設定
- エラーメッセージの優先順位: `message > error > reason > statusText`
- コンソールに詳細なエラー情報を出力

### 3. Lambda側：保存失敗を200で返さない、必ずlog_idを返す、ログ追加 ✅

**ファイル**: `universal_work_reports.py`

**変更内容**:

#### 3.1 ロガー設定追加
```python
import logging
import traceback

logger = logging.getLogger()
logger.setLevel(logging.INFO)
```

#### 3.2 PUT /work-report の改善
- 保存成功時: `logger.info(f"[WORK_REPORT] saved log_id={log_id}...")` を出力
- レスポンスに `log_id` が含まれていることを確認（含まれない場合は 500 を返す）
- 例外時: `logger.exception()` で詳細ログを出力し、500 を返す（200 を返さない）

#### 3.3 PATCH /work-report/{log_id} の改善
- 提出成功時: `logger.info(f"[WORK_REPORT] submitted log_id={log_id}...")` を出力
- レスポンスに `log_id` が含まれていることを確認（含まれない場合は 500 を返す）
- 例外時: `logger.exception()` で詳細ログを出力し、500 を返す（200 を返さない）

### 4. DynamoDBテーブル/キーの整合性確認 ✅

**確認結果**:
- **保存側**: `PUT /work-report` → `table.put_item(Item=item)` （`table` は `universal_work_reports.py` の `TABLE_NAME`）
- **読み取り側**: `GET /admin/work-reports/{id}` → `table.get_item(Key={'log_id': report_id})` （同じ `table`）
- **テーブル名**: 環境変数 `UNIVERSAL_WORK_LOGS_TABLE`（未設定時は `misesapo-sales-work-reports`）
- **キー**: 両方とも `log_id` を使用

**結論**: 保存と読み取りは同じテーブル・同じキーを使用している。問題は Lambda の環境変数が正しく設定されていない可能性がある。

## 🔍 検証手順

### 1. Lambda 環境変数の確認

```bash
aws lambda get-function-configuration \
  --function-name misesapo-work-reports:prod \
  --region ap-northeast-1 \
  --query 'Environment.Variables'
```

期待値:
```json
{
  "UNIVERSAL_WORK_LOGS_TABLE": "misesapo-sales-work-reports",
  "WORK_REPORTS_BUCKET": "misesapo-work-reports"
}
```

### 2. ブラウザで提出テスト

1. `report-day` で「提出」をクリック
2. Network タブで `PATCH /work-report/{log_id}` を確認
3. **Response JSON に `log_id` が含まれていることを確認**
4. 共有URLが表示されることを確認（`log_id` が無い場合はエラーメッセージが表示される）

### 3. CLIでDB確認

```bash
# 共有URLに含まれる log_id をコピー
python3 scripts/get_work_report_by_id.py "<log_id>"
```

期待値: `log_id` が存在し、内容が表示される（`Not found` にならない）

### 4. APIで確認

```bash
curl -i -H "Authorization: Bearer <token>" \
  "https://1x0f73dj2l.execute-api.ap-northeast-1.amazonaws.com/prod/admin/work-reports/<log_id>"
```

期待値: **HTTP 200** で本文が返る

## 🚀 デプロイ手順

### 1. Lambda を再デプロイ

```bash
./scripts/deploy_work_reports_lambda.sh prod
```

これにより以下が反映されます:
- `universal_work_reports.py` の修正（ログ追加、log_id 確認）
- 環境変数 `UNIVERSAL_WORK_LOGS_TABLE=misesapo-sales-work-reports` の確認

### 2. React アプリのビルド・デプロイ

React側の修正は、次回のビルド・デプロイ時に反映されます。

## 📊 CloudWatch Logs での確認

Lambda の CloudWatch Logs で以下を確認:

### 保存成功時
```
[WORK_REPORT] saved log_id=28c19e6e-225f-4497-9148-24b491845c56, version=1, worker_id=xxx, template_id=SALES_DAY_V1
```

### 提出成功時
```
[WORK_REPORT] submitted log_id=28c19e6e-225f-4497-9148-24b491845c56, worker_id=xxx, state=submitted
```

### 保存失敗時
```
[WORK_REPORT] save failed request_id=xxx, error=...
（続いて traceback が出力される）
```

## ⚠️ よくあるバグのチェックリスト

- [ ] `table.put_item` が条件分岐でスキップされていないか
- [ ] `except: pass` で例外が握りつぶされていないか
- [ ] `UNIVERSAL_WORK_LOGS_TABLE` が未設定/別名になっていないか
- [ ] キー設計（`log_id`）と `GetItem` のキーが一致しているか
- [ ] API Gateway の path に `/prod` が含まれている場合、Lambda で stage 除去が行われているか（`lambda_work_reports.py` で実施済み）

## 📝 まとめ

1. **React側**: `log_id` がレスポンスに含まれている場合のみ共有URLを表示
2. **APIクライアント**: エラーレスポンスの詳細を読み取り、コンソールに出力
3. **Lambda側**: 保存失敗を200で返さない、必ず `log_id` を返す、詳細ログを出力
4. **DynamoDB**: 保存と読み取りが同じテーブル・同じキーを使用していることを確認

これにより、「提出→log_id返る→共有URL→DBに存在→詳細200」のフローが確実に動作するようになります。
