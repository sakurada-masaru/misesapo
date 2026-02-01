# CORS とローカル開発（localhost）

## 現象

`http://localhost:3335` から API（例: `GET /work-report?date=...`）を呼ぶと、ブラウザが次のエラーを出すことがあります。

- `The 'Access-Control-Allow-Origin' header has a value 'https://misesapo.co.jp' that is not equal to the supplied origin.`

## 原因

1. **Lambda の CORS 設定**  
   Lambda はリクエストの `Origin` を見て、許可されていればその値を `Access-Control-Allow-Origin` に返す実装になっています。  
   - `http://localhost:*` と `http://127.0.0.1:*` はコード上で許可済みです。
2. **デプロイが古い**  
   上記の localhost 許可が入った Lambda がまだデプロイされていないと、本番では古い挙動（`https://misesapo.co.jp` 固定など）のままになります。
3. **API Gateway が CORS を上書きしている**  
   API Gateway の「CORS を有効化」などで固定の `Access-Control-Allow-Origin` を返していると、Lambda の返すヘッダーが上書きされ、localhost が許可されません。

## 対処

### 0. API Gateway の Gateway Responses を更新（本番で実施済みの場合）

エラー応答（404 / 403 / 500 など）で `Access-Control-Allow-Origin: https://misesapo.co.jp` が固定で返っていると、localhost からのプリフライトやエラー時に CORS でブロックされます。

- **スクリプト**: `scripts/apigw_gateway_response_cors_star.sh`
- **内容**: 全 Gateway Response の `Access-Control-Allow-Origin` を `*` に変更し、prod にデプロイ
- **実行例**: `./scripts/apigw_gateway_response_cors_star.sh 51bhoxkbxd`

### 1. Lambda の再デプロイ（推奨）

- `lambda_function.py` の CORS まわりは、次のように localhost 対応済みです。
  - `resolve_cors_origin`: `http://localhost:*` と `http://127.0.0.1:*` を許可
  - `_get_headers`: `headers` と `multiValueHeaders` の両方からヘッダー取得
- このコードをデプロイした Lambda が API の背後で動くようにしてください。
- デプロイ後、`http://localhost:3335` から再度リクエストして、CORS エラーが消えるか確認してください。

### 2. API Gateway で CORS を上書きしている場合

- API Gateway の「CORS の有効化」や「Gateway Responses」で  
  `Access-Control-Allow-Origin` を **固定値**（例: `https://misesapo.co.jp`）で返していると、Lambda の設定が効きません。
- その場合は次のいずれかが必要です。
  - **Lambda に任せる**: API Gateway 側で CORS 用の固定ヘッダーを付けない（Lambda のレスポンスヘッダーだけを使う）。
  - **複数オリジンにする**: API Gateway や別のプロキシで、`Origin` に応じて `Access-Control-Allow-Origin` を切り替え、`http://localhost:3335` なども許可する。

### 3. 環境変数でオリジンを追加（任意）

- Lambda の環境変数 `ALLOWED_ORIGINS` に、カンマ区切りでオリジンを指定できます。
- 例: `ALLOWED_ORIGINS=https://misesapo.co.jp,http://localhost:3335`
- コード側で `http://localhost:*` はすでに許可しているため、通常はデプロイだけで足ります。

## まとめ

- まず **Lambda を最新の `lambda_function.py` で再デプロイ**し、localhost からのリクエストで CORS が通るか確認してください。
- まだエラーになる場合は、**API Gateway が CORS ヘッダーを固定で返していないか**を確認し、必要なら「Lambda の返す CORS を使う」か「localhost を許可する設定」に変更してください。
