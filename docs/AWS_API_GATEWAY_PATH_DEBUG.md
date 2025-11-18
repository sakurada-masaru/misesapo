# API Gateway パス設定のデバッグ

## 問題

`/cleaning-manual` エンドポイントが404エラーを返しています。これは、Lambda関数がパスを認識していない可能性があります。

## 原因

API GatewayからLambda関数に渡される`path`の値が、期待される値と異なる可能性があります。

## 解決方法

### 1. Lambda関数のログを確認

CloudWatch LogsでLambda関数のログを確認して、実際に渡されている`path`の値を確認してください：

1. **AWS Console** → **CloudWatch** → **ロググループ**
2. `/aws/lambda/misesapo-s3-upload` を選択
3. 最新のログストリームを開く
4. `DEBUG: path=...` というログを探す

### 2. API Gatewayの統合設定を確認

各リソースの統合設定で、パスのマッピングが正しく設定されているか確認してください：

1. **API Gateway** → `misesapo-s3-upload-api` → **リソース** → `/cleaning-manual` を選択
2. **GET** メソッドを選択
3. **統合リクエスト** をクリック
4. **統合タイプ**: `Lambda関数` が選択されているか確認
5. **Lambda関数**: `misesapo-s3-upload` が選択されているか確認

### 3. パスのマッピング設定

API Gatewayの統合設定で、パスのマッピングを確認してください：

1. **統合リクエスト** → **URLパスパラメータ** を確認
2. **マッピングテンプレート** を確認

通常、Lambda関数への統合では、パスのマッピングは不要です。API Gatewayが自動的に`path`パラメータをLambda関数に渡します。

### 4. リソースパスの確認

各リソースのパスが正しく設定されているか確認してください：

- `/cleaning-manual` リソースのパス: `/cleaning-manual`
- `/cleaning-manual/draft` リソースのパス: `/cleaning-manual/draft`

### 5. Lambda関数のコードを確認

Lambda関数のコードで、パスの比較が正しく行われているか確認してください：

```python
path = event.get('path', '')
print(f"DEBUG: path={path}")

if path == '/cleaning-manual' or path == '/cleaning-manual/':
    # 処理
elif path == '/cleaning-manual/draft' or path == '/cleaning-manual/draft/':
    # 処理
```

### 6. プロキシ統合の確認

API Gatewayの統合タイプが「Lambdaプロキシ統合」になっているか確認してください：

1. **統合リクエスト** を開く
2. **統合タイプ**: `Lambda関数` が選択されているか確認
3. **Lambdaプロキシ統合を使用** にチェックが入っているか確認

**注意**: Lambdaプロキシ統合を使用する場合、`event`オブジェクトの構造が異なります。`event.get('path')`でパスを取得できます。

## トラブルシューティング

### パスが異なる場合

CloudWatch Logsで確認した`path`の値が期待される値と異なる場合、Lambda関数のコードを修正してください：

```python
# 例: パスが '/prod/cleaning-manual' の場合
if path.endswith('/cleaning-manual') or path.endswith('/cleaning-manual/'):
    # 処理
```

### パスが空の場合

`path`が空の場合、API Gatewayの統合設定に問題がある可能性があります。統合設定を再確認してください。

## 参考

- [AWS API Gateway Lambda統合](https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html)
- [Lambda関数のイベント構造](https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format)

