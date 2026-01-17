# DEPLOY_HANDOFF

## API契約 今回の変更
- 正しいパス: PUT /staff/reports/{report_id}
- ルーティング根拠: lambda_function.py の normalized_path.startswith /staff/reports/ で PUT が update_report_by_id にルーティングされる
- ベースURLの決定場所: src/assets/js/admin-reports.js の REPORT_API 定数
- 必須ヘッダ: Authorization: Bearer ID_TOKEN, Content-Type application/json
- 必須フィールド: reason_code status が approved rejected revision_requested の場合
- エラー条件: reason_code が無い場合は 400

## API契約 予定作成
- 正しいパス: POST /schedules
- 必須フィールド: store_id scheduled_date worker_id
- サーバ強制: service cleaning status scheduled
- 可用性チェック: worker_id scheduled_date が open 以外なら 409 worker_unavailable
- 重複条件: store_id scheduled_date worker_id service が一致したら 409
- レスポンス: 201 で id を返す

## API契約 稼働可否
- 正しいパス: GET /workers/me/availability?from=YYYY-MM-DD&to=YYYY-MM-DD
- 正しいパス: PUT /workers/me/availability
- 必須ヘッダ: Authorization: Bearer ID_TOKEN, Content-Type application/json
- PUT 必須フィールド: date status
- status 値: open closed
- レスポンス: GET 200 で items を返す, PUT 200 で status success
- エラー条件: from または to が無い場合は 400, date または status が無い場合は 400

## API契約 営業 稼働状況マトリクス
- 正しいパス: GET /sales/availability-matrix?from=YYYY-MM-DD&to=YYYY-MM-DD&service=cleaning&worker_ids=W1,W2
- 必須ヘッダ: Authorization: Bearer ID_TOKEN
- 必須パラメータ: from to worker_ids
- service 任意 省略時 cleaning
- レスポンス: 200 で workers を返す
- status 値: open scheduled closed
- 優先順位: scheduled > open > closed
- エラー条件: from または to または worker_ids が無い場合は 400

## 追加 変更したリソース
- DynamoDB テーブル staff-report-approvals
- DynamoDB テーブル worker-availability

## 追加 変更した機能
- 営業エントランス 申込書を作成 が 依頼書ウィザードを起動し sales_requests を保存する
- 清掃エントランス 稼働日設定 open closed の更新

## 必要なIAM権限
- Lambda 実行ロール
- dynamodb:PutItem on staff-report-approvals
- dynamodb:GetItem dynamodb:Query dynamodb:PutItem on worker-availability
- dynamodb:Query on schedules

## DevTools Network から値を取得する手順
1 管理画面でレポート一覧または承認操作を開く
2 DevTools の Network で staff/reports のリクエストを選択する
3 Request URL から REPORT_API を取得する
4 Request URL の末尾から REPORT_ID を取得する
5 Request Headers から Authorization: Bearer ID_TOKEN を取得する

## 事前準備 値の設定
REPORT_API=REPLACE_WITH_REPORT_API
REPORT_ID=REPLACE_WITH_REPORT_ID
ID_TOKEN=REPLACE_WITH_ID_TOKEN

payload_no_reason.json は status approved のみを含むJSON
payload_with_reason.json は status approved と reason_code OK_STANDARD を含むJSON
DevTools の request payload を保存して作成する

## 手動テスト curl
### 1 reason_code 無し 400 を期待
```bash
curl -i -X PUT $REPORT_API/staff/reports/$REPORT_ID -H Content-Type:application/json -H Authorization: Bearer $ID_TOKEN --data-binary @payload_no_reason.json
```

### 2 reason_code あり 200 を期待
```bash
curl -i -X PUT $REPORT_API/staff/reports/$REPORT_ID -H Content-Type:application/json -H Authorization: Bearer $ID_TOKEN --data-binary @payload_with_reason.json
```

### 3 DynamoDB 確認
```bash
aws dynamodb query --table-name staff-report-approvals --key-condition-expression report_id=:rid --expression-attribute-values '{":rid":{"S":"'"$REPORT_ID"'"}}'
```

### 4 予定作成 201 を期待
```bash
curl -i -X POST $REPORT_API/schedules -H Content-Type:application/json -H Authorization: Bearer $ID_TOKEN --data-binary @payload_schedule_create.json
```

payload_schedule_create.json は store_id scheduled_date worker_id を含むJSON

### 5 稼働可否 取得 200 を期待
```bash
curl -i -G $REPORT_API/workers/me/availability -H Authorization: Bearer $ID_TOKEN --data from=YYYY-MM-DD --data to=YYYY-MM-DD
```

### 6 稼働可否 更新 200 を期待
```bash
curl -i -X PUT $REPORT_API/workers/me/availability -H Content-Type:application/json -H Authorization: Bearer $ID_TOKEN --data-binary @payload_availability_open.json
```

payload_availability_open.json は date status open を含むJSON

### 7 営業 稼働状況マトリクス 200 を期待
```bash
curl -i -G $REPORT_API/sales/availability-matrix -H Authorization: Bearer $ID_TOKEN --data from=YYYY-MM-DD --data to=YYYY-MM-DD --data service=cleaning --data worker_ids=W1,W2
```

## DynamoDB確認手順
前提 PK SK は report_id reviewed_at
AWS CLI 例
```bash
aws dynamodb query --table-name staff-report-approvals --key-condition-expression report_id=:rid --expression-attribute-values '{":rid":{"S":"'"$REPORT_ID"'"}}'
```
確認項目 report_id reviewed_at reason_code

## reason_code 最小辞書
- OK_STANDARD
- OK_EXCEPTION_APPROVED
- NG_POLICY_VIOLATION
- RETURN_MISSING_REQUIRED_FIELDS
- RETURN_NEED_PHOTOS
- RETURN_SCOPE_MISMATCH
