# /cleaning-manual/draft OPTIONSメソッドの修正

## 問題

`/cleaning-manual/draft`のOPTIONSメソッドが500エラーを返しています。`/cleaning-manual`のOPTIONSは正常に動作しているため、設定の違いが原因の可能性があります。

## 解決方法

### 方法1: OPTIONSメソッドを削除して再作成（推奨）

1. **API Gateway** → `misesapo-s3-upload-api` → **リソース** → `/cleaning-manual/draft` を選択
2. **OPTIONS** メソッドを選択
3. **「アクション」** → **「メソッドの削除」** をクリック
4. **「はい、削除します」** をクリック
5. **「アクション」** → **「メソッドの作成」** をクリック
6. **メソッド**: `OPTIONS` を選択
7. **統合タイプ**: `MOCK` を選択
8. **「保存」** をクリック
9. **「統合レスポンス」** をクリック
10. **「200」** のステータスコードを選択
11. **「ヘッダーのマッピング」** で以下を追加：
    - `Access-Control-Allow-Origin`: `'*'`
    - `Access-Control-Allow-Headers`: `'Content-Type'`
    - `Access-Control-Allow-Methods`: `'GET, PUT, POST, OPTIONS'`
12. **「マッピングテンプレート」** タブを開く
13. **「コンテンツタイプの追加」** をクリック
14. **コンテンツタイプ**: `application/json` と入力
15. **テンプレート本文** に `{}` を入力
16. **「保存」** をクリック
17. **「メソッドレスポンス」** をクリック
18. **「200」** のステータスコードを選択
19. **「HTTP ヘッダー」** タブで以下を追加：
    - `Access-Control-Allow-Origin`（必須: チェックを外す）
    - `Access-Control-Allow-Headers`（必須: チェックを外す）
    - `Access-Control-Allow-Methods`（必須: チェックを外す）
20. **「保存」** をクリック

### 方法2: Lambdaプロキシ統合に変更

MOCK統合で問題が解決しない場合、Lambdaプロキシ統合に変更することもできます。

1. **API Gateway** → `misesapo-s3-upload-api` → **リソース** → `/cleaning-manual/draft` を選択
2. **OPTIONS** メソッドを選択
3. **「統合リクエスト」** をクリック
4. **統合タイプ**: `Lambda関数` を選択
5. **Lambda関数**: `misesapo-s3-upload` を選択
6. **「Lambdaプロキシ統合を使用」** にチェックを入れる
7. **「保存」** をクリック

**注意**: Lambda関数のコードでOPTIONSリクエストを処理する必要があります。現在の`lambda_function.py`にはOPTIONS処理が含まれているため、この方法でも動作するはずです。

### API Gatewayのデプロイ

設定を変更した後、必ずAPI Gatewayをデプロイしてください：

1. **「アクション」** → **「API のデプロイ」** をクリック
2. **デプロイされるステージ**: `prod` を選択
3. **「デプロイ」** をクリック

## 確認

修正後、以下のコマンドで確認してください：

```bash
curl -X OPTIONS https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod/cleaning-manual/draft \
  -H "Origin: https://sakurada-masaru.github.io" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -i
```

期待されるレスポンス：
- ステータスコード: `200 OK`
- CORSヘッダーが含まれている

## 推奨

`/cleaning-manual`のOPTIONSが正常に動作しているため、同じ設定を`/cleaning-manual/draft`にも適用してください。方法1（削除して再作成）を推奨します。

