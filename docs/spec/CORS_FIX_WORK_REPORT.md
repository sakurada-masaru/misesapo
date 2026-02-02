# 業務報告 API CORS エラー解消手順

## 目的

本番で発生している CORS エラーを解消する。

**対象エラー**:
- `GET https://1x0f73dj2l.execute-api.ap-northeast-1.amazonaws.com/prod/admin/work-reports/{id}`
- preflight (OPTIONS) が `Access-Control-Allow-Origin` を返さずブラウザでブロック

**対象 API**:
- API Gateway: **1x0f73dj2l**
- Region: **ap-northeast-1**
- Stage: **prod**

---

## 実施手順

### 1. Lambda 側の CORS ヘッダ修正（完了）

**変更内容**:
- `lambda_work_reports.py` の `_cors_headers()` を修正
  - Origin が `https://misesapo.co.jp` のとき: `Access-Control-Allow-Origin: https://misesapo.co.jp`
  - それ以外: 空文字（CORS エラーになるがセキュリティ上正しい）
  - `Vary: Origin` を追加
  - `Access-Control-Allow-Headers: Authorization,Content-Type`（簡略化）
  - `Access-Control-Allow-Methods: GET,PUT,POST,PATCH,DELETE,OPTIONS`
- エラー時（4xx/5xx）にも CORS ヘッダを付ける（既に `headers` を返しているので自動的に付く）

**デプロイ**:
```bash
./scripts/deploy_work_reports_lambda.sh prod
```

---

### 2. API Gateway 側の OPTIONS メソッド追加

**対象パス**:
- `/admin`
- `/admin/{proxy+}`（これで `/admin/work-reports`, `/admin/work-reports/{id}`, `/admin/work-reports/{id}/state`, `/admin/payroll/{user_id}/{yyyy_mm}` をカバー）

**実行**:
```bash
./scripts/aws/add_admin_options_cors.sh
```

**やること**:
- `/admin` と `/admin/{proxy+}` に OPTIONS メソッドを追加
- 統合タイプ: **AWS_PROXY**（Lambda proxy 統合、既存の GET/PATCH と同じ）
- Lambda: `misesapo-work-reports:prod`
- 認証: **NONE**（既存と同様）

**注意**: `/admin/{proxy+}` に OPTIONS を追加すれば、`/admin/work-reports/{id}` などの下位パスもカバーされる。

---

### 3. 動作確認

#### A. preflight（OPTIONS）単体確認

```bash
curl -i -X OPTIONS \
  'https://1x0f73dj2l.execute-api.ap-northeast-1.amazonaws.com/prod/admin/work-reports/28c19e6e-225f-4497-9148-24b491845c56' \
  -H 'Origin: https://misesapo.co.jp' \
  -H 'Access-Control-Request-Method: GET' \
  -H 'Access-Control-Request-Headers: authorization,content-type'
```

**期待される結果**:
- HTTP **200**
- `Access-Control-Allow-Origin: https://misesapo.co.jp`
- `Access-Control-Allow-Headers: Authorization,Content-Type`
- `Access-Control-Allow-Methods: GET,PUT,POST,PATCH,DELETE,OPTIONS`
- `Vary: Origin`

#### B. 実ブラウザ確認

1. **https://misesapo.co.jp/misogi/#/sales/work-reports/28c19e6e-225f-4497-9148-24b491845c56** を開く
2. Chrome DevTools → Network タブ
3. `/admin/work-reports/{id}` のリクエストを確認
   - **preflight (OPTIONS)** が 200 で成功していること
   - **GET** が CORS ブロックされていないこと
   - Response Headers に `Access-Control-Allow-Origin: https://misesapo.co.jp` があること

---

### 4. まだ失敗する場合の確認項目

以下を報告してください:

1. **OPTIONS の response headers 全文**
   ```bash
   curl -v -X OPTIONS \
     'https://1x0f73dj2l.execute-api.ap-northeast-1.amazonaws.com/prod/admin/work-reports/28c19e6e-225f-4497-9148-24b491845c56' \
     -H 'Origin: https://misesapo.co.jp' \
     -H 'Access-Control-Request-Method: GET' \
     -H 'Access-Control-Request-Headers: authorization,content-type' \
     2>&1 | grep -E '< HTTP|< Access-Control|< x-amzn'
   ```

2. **GET の response headers 全文**（認証トークンが必要）
   ```bash
   curl -v -X GET \
     'https://1x0f73dj2l.execute-api.ap-northeast-1.amazonaws.com/prod/admin/work-reports/28c19e6e-225f-4497-9148-24b491845c56' \
     -H 'Origin: https://misesapo.co.jp' \
     -H 'Authorization: Bearer <ID_TOKEN>' \
     2>&1 | grep -E '< HTTP|< Access-Control|< x-amzn'
   ```

3. **x-amzn-RequestId, x-amzn-ErrorType**（あれば）

---

## 補足

- **API Gateway 側だけでなく、Lambda レスポンスに CORS を入れないと proxy 統合では不足することがある** → Lambda 側で CORS ヘッダを返すように修正済み。
- **401/403/404 などエラー系レスポンスにも CORS ヘッダを必ず載せること** → Lambda のすべてのレスポンスで `headers` に CORS ヘッダを含めるように修正済み。
- **Origin の許可**: 本番では `https://misesapo.co.jp` のみ許可。開発環境（localhost）も許可リストに含める場合は `lambda_work_reports.py` の `allowed_origins` を編集。
