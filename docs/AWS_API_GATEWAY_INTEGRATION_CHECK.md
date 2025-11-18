# API Gateway統合設定の確認

## 問題

CloudWatch Logsでリクエストが確認できない場合、Lambda関数が呼び出されていない可能性があります。

## 確認手順

### 1. API Gatewayの統合設定を確認

各リソースのメソッドで、Lambda関数への統合が正しく設定されているか確認してください：

#### `/cleaning-manual` リソースのGETメソッド

1. **API Gateway** → `misesapo-s3-upload-api` → **リソース** → `/cleaning-manual` を選択
2. **GET** メソッドを選択
3. **統合リクエスト** をクリック
4. 以下を確認：
   - **統合タイプ**: `Lambda関数` が選択されているか
   - **Lambda関数**: `misesapo-s3-upload` が選択されているか
   - **Lambdaプロキシ統合を使用**: **チェックが入っているか**（重要）

**重要**: 「Lambdaプロキシ統合を使用」にチェックが入っていない場合、`event`オブジェクトの構造が異なり、`path`や`httpMethod`が取得できません。

#### `/cleaning-manual` リソースのPUTメソッド

同様に、PUTメソッドも確認してください。

#### `/cleaning-manual/draft` リソースのGETメソッド

1. `/cleaning-manual/draft` リソースを選択
2. **GET** メソッドを選択
3. 上記と同じ手順で確認

### 2. Lambdaプロキシ統合を有効化

「Lambdaプロキシ統合を使用」にチェックが入っていない場合：

1. **統合リクエスト** を開く
2. **「Lambdaプロキシ統合を使用」** にチェックを入れる
3. **「保存」** をクリック
4. **「Lambda関数に権限を追加」** のダイアログで **「OK」** をクリック

### 3. API Gatewayのデプロイ

設定を変更した後、必ずAPI Gatewayをデプロイしてください：

1. **「アクション」** → **「API のデプロイ」** をクリック
2. **デプロイされるステージ**: `prod` を選択
3. **「デプロイ」** をクリック

### 4. API Gatewayのログを有効化

API Gatewayのログを有効化して、リクエストが正しく処理されているか確認してください：

1. **API Gateway** → `misesapo-s3-upload-api` → **ステージ** → `prod` を選択
2. **「ログ/トレース」** タブを開く
3. **「CloudWatch ログロール ARN」** を設定（必要に応じてIAMロールを作成）
4. **「ログレベル」**: `INFO` または `ERROR` を選択
5. **「ログの全文を記録」**: チェックを入れる
6. **「保存」** をクリック

### 5. リクエストを再送信

1. ブラウザでページをリロード
2. または、curlコマンドでリクエストを送信：

```bash
curl -X GET https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod/cleaning-manual \
  -H "Origin: https://sakurada-masaru.github.io" \
  -v
```

### 6. CloudWatch Logsで確認

1. **AWS Console** → **CloudWatch** → **ロググループ**
2. `/aws/lambda/misesapo-s3-upload` を選択
3. 最新のログストリームを開く
4. 以下のログを確認：
   - `START RequestId: ...` - Lambda関数が呼び出された証拠
   - `DEBUG: path=...` - デバッグログ
   - `END RequestId: ...` - Lambda関数の終了

### 7. API Gatewayのログを確認

1. **CloudWatch** → **ロググループ**
2. `/aws/apigateway/misesapo-s3-upload-api` を選択（ログを有効化した場合）
3. 最新のログストリームを開く
4. リクエストの処理状況を確認

## トラブルシューティング

### Lambda関数が呼び出されない場合

- API Gatewayの統合設定を確認
- Lambda関数の名前が正しいか確認
- Lambda関数のIAMロールにAPI Gatewayからの呼び出し権限があるか確認

### ログが表示されない場合

- CloudWatch Logsの権限を確認
- Lambda関数の実行ロールにCloudWatch Logsへの書き込み権限があるか確認
- ログストリームが正しく選択されているか確認

## 参考

- [API Gateway Lambda統合](https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html)
- [Lambdaプロキシ統合](https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-create-api-as-simple-proxy-for-lambda.html)

