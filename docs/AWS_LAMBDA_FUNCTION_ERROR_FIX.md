# Lambda関数エラー修正: "name 'python' is not defined"

## 問題

Lambda関数で以下のエラーが発生しています：

```json
{
  "errorMessage": "name 'python' is not defined",
  "errorType": "NameError",
  "stackTrace": [
    "File \"/var/task/lambda_function.py\", line 1, in <module>\n    python\n"
  ]
}
```

## 原因

Lambda関数にデプロイされているコードの1行目に`python`という文字列が含まれている可能性があります。これは、コードをコピー&ペーストする際に誤って含まれてしまった可能性があります。

## 解決方法

### 1. Lambda関数のコードを確認

1. **AWS Console** → **Lambda** を開く
2. `misesapo-s3-upload` 関数を選択
3. **「コード」** タブを開く
4. `lambda_function.py` の1行目を確認

### 2. コードを修正

`lambda_function.py` の1行目が以下のようになっている場合：

```python
python
import json
```

以下のように修正してください：

```python
import json
```

### 3. Lambda関数を再デプロイ

1. **「Deploy」** ボタンをクリック
2. または、ローカルの `lambda_function.py` を確認して、正しいコードをコピー&ペースト

### 4. 正しいコードの確認

ローカルの `lambda_function.py` ファイルの1行目は以下のようになっているはずです：

```python
import json
import boto3
import base64
import os
from datetime import datetime
```

## OPTIONSメソッドの設定確認

`/cleaning-manual/draft` のOPTIONSリクエストがLambda関数に到達してエラーになっている場合、OPTIONSメソッドの統合タイプを確認してください。

### OPTIONSメソッドをMOCK統合に変更

1. **API Gateway** → `misesapo-s3-upload-api` を開く
2. **リソース** → `/cleaning-manual/draft` を選択
3. **メソッド** → `OPTIONS` を選択
4. **統合リクエスト** をクリック
5. **統合タイプ**: `MOCK` を選択
6. **「保存」** をクリック

### MOCK統合のレスポンス設定

1. **統合レスポンス** をクリック
2. **「200」** のステータスコードを選択
3. **「ヘッダーのマッピング」** で以下を追加：
   - `Access-Control-Allow-Origin`: `'*'`
   - `Access-Control-Allow-Headers`: `'Content-Type'`
   - `Access-Control-Allow-Methods`: `'GET, PUT, POST, OPTIONS'`
4. **「保存」** をクリック

### API Gatewayのデプロイ

1. **「アクション」** → **「API のデプロイ」** をクリック
2. **デプロイされるステージ**: `prod` を選択
3. **「デプロイ」** をクリック

## 確認

修正後、以下のコマンドで確認してください：

```bash
# OPTIONSリクエストのテスト
curl -X OPTIONS https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod/cleaning-manual/draft \
  -H "Origin: https://sakurada-masaru.github.io" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -i

# GETリクエストのテスト
curl -X GET https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod/cleaning-manual/draft \
  -H "Origin: https://sakurada-masaru.github.io" \
  -i
```

期待される結果：
- OPTIONSリクエスト: ステータスコード `200`、CORSヘッダーが含まれる
- GETリクエスト: ステータスコード `200`、JSONデータが返される（エラーメッセージがない）

