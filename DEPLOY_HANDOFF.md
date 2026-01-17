# DEPLOY_HANDOFF

## API契約 今回の変更
- 正しいパス: PUT /staff/reports/{report_id}
- ルーティング根拠: lambda_function.py の normalized_path.startswith /staff/reports/ で PUT が update_report_by_id にルーティングされる
- ベースURLの決定場所: src/assets/js/admin-reports.js の REPORT_API 定数
- 必須ヘッダ: Authorization Bearer ID_TOKEN, Content-Type application/json
- 必須フィールド: reason_code status が approved rejected revision_requested の場合
- エラー条件: reason_code が無い場合は 400

## 追加 変更したリソース
- DynamoDB テーブル staff-report-approvals

## 必要なIAM権限
- Lambda 実行ロール
- dynamodb:PutItem on staff-report-approvals

## DevTools Network から値を取得する手順
1 管理画面でレポート一覧または承認操作を開く
2 DevTools の Network で staff/reports のリクエストを選択する
3 Request URL から REPORT_API を取得する
4 Request URL の末尾から REPORT_ID を取得する
5 Request Headers から Authorization Bearer ID_TOKEN を取得する

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
curl -i -X PUT $REPORT_API/staff/reports/$REPORT_ID -H Content-Type:application/json -H Authorization:Bearer$ID_TOKEN --data-binary @payload_no_reason.json
```

### 2 reason_code あり 200 を期待
```bash
curl -i -X PUT $REPORT_API/staff/reports/$REPORT_ID -H Content-Type:application/json -H Authorization:Bearer$ID_TOKEN --data-binary @payload_with_reason.json
```

### 3 DynamoDB 確認
```bash
aws dynamodb query --table-name staff-report-approvals --key-condition-expression report_id=:rid --expression-attribute-values :rid={S=$REPORT_ID}
```

## DynamoDB確認手順
前提 PK SK は report_id reviewed_at
AWS CLI 例
```bash
aws dynamodb query --table-name staff-report-approvals --key-condition-expression report_id=:rid --expression-attribute-values :rid={S=$REPORT_ID}
```
確認項目 report_id reviewed_at reason_code

## reason_code 最小辞書
- OK_STANDARD
- OK_EXCEPTION_APPROVED
- NG_POLICY_VIOLATION
- RETURN_MISSING_REQUIRED_FIELDS
- RETURN_NEED_PHOTOS
- RETURN_SCOPE_MISMATCH
