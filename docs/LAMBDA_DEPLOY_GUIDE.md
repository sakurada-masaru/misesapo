# Lambda関数のデプロイガイド

## 🚀 デプロイ手順

### 方法1: AWSコンソールからデプロイ（推奨）

1. **Lambdaコンソールを開く**
   - https://console.aws.amazon.com/lambda/ にアクセス

2. **関数を選択**
   - 既存のLambda関数を選択（例: `misesapo-s3-upload`）

3. **コードを確認**
   - 「コード」タブを開く
   - `lambda_function.py` の内容を確認
   - レポート機能の関数（`get_reports`, `create_report` など）が含まれているか確認

4. **コードを更新**
   - ローカルの `lambda_function.py` の内容をコピー
   - Lambda関数のコードエディタに貼り付け
   - 「Deploy」ボタンをクリック

### 方法2: AWS CLIからデプロイ

```bash
# Lambda関数をZIPファイルに圧縮
zip -r lambda_function.zip lambda_function.py

# Lambda関数を更新
aws lambda update-function-code \
  --function-name YOUR_LAMBDA_FUNCTION_NAME \
  --zip-file fileb://lambda_function.zip \
  --region ap-northeast-1
```

### 方法3: デプロイスクリプトを使用

```bash
# デプロイスクリプトを作成（必要に応じて）
./deploy-lambda.sh
```

---

## ✅ デプロイ後の確認

### 1. Lambda関数のコードを確認

1. **Lambdaコンソール** → 関数を選択 → 「コード」タブ
2. 以下の関数が含まれているか確認：
   - `get_reports()`
   - `create_report()`
   - `get_report_detail()`
   - `update_report()`
   - `delete_report()`

### 2. 環境変数を確認

1. **「設定」タブ** → 「環境変数」を開く
2. 以下が設定されているか確認：
   ```
   S3_BUCKET_NAME: misesapo-cleaning-manual-images
   S3_REGION: ap-northeast-1
   ```

### 3. IAMロールを確認

1. **「設定」タブ** → 「実行ロール」を開く
2. ロール名をクリックしてIAMコンソールを開く
3. 以下のポリシーがアタッチされているか確認：
   - `AmazonDynamoDBFullAccess` または DynamoDBへのアクセス権限
   - `AmazonS3FullAccess` または S3へのアクセス権限

### 4. テストを実行

```bash
# テストスクリプトを実行
./test-api.sh
```

---

## 🆘 トラブルシューティング

### エラー: `name 'get_reports' is not defined`
- Lambda関数が最新のコードでデプロイされていない可能性があります
- Lambda関数のコードを確認して、`get_reports` 関数が含まれているか確認してください

### エラー: `Table not found: staff-reports`
- DynamoDBテーブルが作成されていない可能性があります
- DynamoDBコンソールでテーブルを確認してください

### エラー: `Access Denied`
- Lambda関数のIAMロールに必要な権限がない可能性があります
- IAMロールに DynamoDB と S3 の権限を追加してください

---

## 📝 参考

- [Lambda関数の更新](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-awscli.html)
- [Lambda関数のデプロイ](https://docs.aws.amazon.com/lambda/latest/dg/python-package.html)

