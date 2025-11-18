# Lambda関数のデプロイ確認

## 問題

CloudWatch Logsに`DEBUG: path=...`というログが表示されない場合、以下の可能性があります：

1. Lambda関数のコードがまだ更新されていない
2. リクエストがLambda関数に到達していない
3. ログストリームが正しく選択されていない

## 確認手順

### 1. Lambda関数のコードを確認

1. **AWS Console** → **Lambda** → `misesapo-s3-upload` 関数を開く
2. **「コード」** タブを開く
3. `lambda_function.py` の内容を確認
4. 以下のコードが含まれているか確認：

```python
# デバッグ: パスとメソッドをログに出力
print(f"DEBUG: path={path}, method={method}, event={json.dumps(event)}")
```

このコードが含まれていない場合、ローカルの`lambda_function.py`の内容をコピー&ペーストして、**「Deploy」** ボタンをクリックしてください。

### 2. Lambda関数をテスト

Lambda関数が正しく動作しているか確認するため、テストイベントを作成して実行してください：

1. **「テスト」** タブを開く
2. **「新しいイベントを作成」** をクリック
3. **イベント名**: `test-cleaning-manual` と入力
4. **イベントJSON** に以下を入力：

```json
{
  "httpMethod": "GET",
  "path": "/cleaning-manual",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": ""
}
```

5. **「保存」** → **「テスト」** をクリック
6. 実行結果を確認
7. **CloudWatch Logs** でログを確認

### 3. CloudWatch Logsの確認

1. **AWS Console** → **CloudWatch** → **ロググループ**
2. `/aws/lambda/misesapo-s3-upload` を選択
3. **「ログストリーム」** タブを開く
4. 最新のログストリームを選択（日時が最新のもの）
5. ログを確認：
   - `DEBUG: path=...` というログがあるか
   - エラーログがあるか
   - `START RequestId: ...` というログがあるか（Lambda関数が呼び出された証拠）

### 4. API Gatewayの統合設定を確認

リクエストがLambda関数に到達しているか確認するため、API Gatewayの統合設定を確認してください：

1. **API Gateway** → `misesapo-s3-upload-api` → **リソース** → `/cleaning-manual` を選択
2. **GET** メソッドを選択
3. **統合リクエスト** をクリック
4. 以下を確認：
   - **統合タイプ**: `Lambda関数` が選択されているか
   - **Lambda関数**: `misesapo-s3-upload` が選択されているか
   - **Lambdaプロキシ統合を使用**: チェックが入っているか（推奨）

### 5. API Gatewayのログを有効化

API Gatewayのログを有効化して、リクエストが正しく処理されているか確認してください：

1. **API Gateway** → `misesapo-s3-upload-api` → **ステージ** → `prod` を選択
2. **「ログ/トレース」** タブを開く
3. **「CloudWatch ログロール ARN」** を設定（必要に応じてIAMロールを作成）
4. **「ログレベル」**: `INFO` または `ERROR` を選択
5. **「ログの全文を記録」**: チェックを入れる
6. **「保存」** をクリック

### 6. リクエストを再送信

1. ブラウザでページをリロード
2. または、curlコマンドでリクエストを送信：

```bash
curl -X GET https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod/cleaning-manual \
  -H "Origin: https://sakurada-masaru.github.io" \
  -v
```

3. CloudWatch Logsでログを確認

## トラブルシューティング

### Lambda関数が呼び出されていない場合

- API Gatewayの統合設定を確認
- API Gatewayがデプロイされているか確認
- リソースとメソッドが正しく設定されているか確認

### Lambda関数が呼び出されているが、ログが表示されない場合

- Lambda関数のコードが正しくデプロイされているか確認
- CloudWatch Logsの権限を確認
- ログストリームが正しく選択されているか確認

### 404エラーが返される場合

- Lambda関数のコードでパスの比較が正しく行われているか確認
- CloudWatch Logsで実際に渡されている`path`の値を確認
- API GatewayのリソースパスとLambda関数のパス比較が一致しているか確認

## 参考

- [AWS Lambda ログの確認](https://docs.aws.amazon.com/lambda/latest/dg/monitoring-cloudwatchlogs.html)
- [API Gateway ログの有効化](https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-logging.html)

