# CloudWatch Logsの確認方法

## ログストリームの確認

ログストリーム `2025/11/18/[$LATEST]7de867e1fc8848c6b02b7ff45bf2e1f2` を開いたら、以下のログを探してください：

### 1. Lambda関数の起動ログ

```
START RequestId: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx Version: $LATEST
```

このログが表示されていれば、Lambda関数が呼び出されています。

### 2. デバッグログ

以下のようなログを探してください：

```
DEBUG: path=/cleaning-manual, method=GET
DEBUG: full event keys=[...]
```

または、パスが一致しなかった場合：

```
DEBUG: Path not matched. normalized_path=..., original_path=...
```

### 3. エラーログ

エラーが発生した場合、以下のようなログが表示されます：

```
Error: ...
Traceback (most recent call last):
  ...
```

### 4. Lambda関数の終了ログ

```
END RequestId: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
REPORT RequestId: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx	Duration: xxx ms	Billed Duration: xxx ms	Memory Size: xxx MB	Max Memory Used: xxx MB
```

## ログが見つからない場合

### Lambda関数のコードが更新されていない可能性

1. **AWS Console** → **Lambda** → `misesapo-s3-upload` 関数を開く
2. **「コード」** タブを開く
3. `lambda_function.py` の内容を確認
4. 以下のコードが含まれているか確認：

```python
# デバッグ: パスとメソッドをログに出力（必ず実行される）
print(f"DEBUG: path={path}, method={method}")
print(f"DEBUG: full event keys={list(event.keys())}")
```

このコードが含まれていない場合、ローカルの`lambda_function.py`の内容をコピー&ペーストして、**「Deploy」** ボタンをクリックしてください。

### リクエストがLambda関数に到達していない可能性

1. **API Gateway** → `misesapo-s3-upload-api` → **リソース** → `/cleaning-manual` を選択
2. **GET** メソッドを選択
3. **統合リクエスト** をクリック
4. 以下を確認：
   - **統合タイプ**: `Lambda関数` が選択されているか
   - **Lambda関数**: `misesapo-s3-upload` が選択されているか

## ログの内容を共有する方法

ログストリームを開いて、以下の情報を共有してください：

1. `START RequestId: ...` のログがあるか
2. `DEBUG: path=...` のログがあるか
3. エラーログがあるか
4. `END RequestId: ...` のログがあるか

これらの情報があれば、問題の原因を特定できます。

