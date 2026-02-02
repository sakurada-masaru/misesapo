# api/upload-url と api/work-report で 403 が出る場合

## 403 の意味

**403 Forbidden** は「サーバーがそのリクエストを許可していない」という応答です。

- **「保存する場所がない」のではありません。** 保存先（Lambda + DynamoDB / S3）は存在します。
- 原因は主に次のどれかです:
  1. **本番 Lambda に新しいルートがまだ入っていない**（コードはリポジトリにあるが未デプロイ）
  2. **API Gateway の認証（Authorizer）で拒否されている**（トークンなし・期限切れ・未許可ルート）
  3. **Lambda 内の権限チェックで拒否**（例: 他人の報告に対する PATCH で worker_id 不一致）

---

## やること（優先順）

### 1. Lambda をデプロイする（必須）

リポジトリには次の対応が入っていますが、**本番で動かすにはデプロイが必要**です。

- **POST /upload-url**: 添付用 Presigned URL 発行（認証必須）
- **GET /work-report/{log_id}**: 自分の報告1件取得

**手順（リポジトリルートで）:**

```bash
./scripts/deploy_lambda.sh misesapo-reports prod lambda_function.py
```

- これで `lambda_function.py` と `universal_work_reports.py` が本番 Lambda に反映されます。
- デプロイ後、ブラウザをリロードして再度「保存」「添付」を試してください。

### 2. 403 のレスポンス body を確認する（重要）

ブラウザの開発者ツール → Network → 失敗したリクエスト（upload-url または work-report）をクリック → **Response** タブで body を確認する。

| レスポンス body（例） | 意味 | 対処 |
|-----------------------|------|------|
| `{"message":"Missing Authentication Token"}` | **API Gateway** が返している。このパスにリソース/メソッドが無い | API Gateway で `{proxy+}` または `/upload-url`・`/work-report` が Lambda に紐づいているか確認 |
| `{"message":"User is not authorized to access this resource"}` など | **API Gateway の Authorizer** がトークンを拒否 | ログアウトして再ログイン。Request Headers に `Authorization: Bearer ...` が付いているか確認。Cognito のトークンが有効か確認 |
| `{"error":"Forbidden"}`（Lambda 由来） | **Lambda** が 403 を返している（例: 他人の報告へのアクセス） | work-report の場合、その報告が「自分が作成した報告」か確認。他人の報告の操作は 403 |
| （body が空や CORS エラー） | ブラウザが CORS で body を隠している可能性 | 同上のうち、API Gateway のルートと Authorizer を優先して確認 |

**補足**: Lambda は未認証時に **401** を返します。**403** がそのまま出ている場合、多くの場合は **API Gateway** が先に 403 を返しています（ルート未設定 or Authorizer 拒否）。

### 3. デプロイ後も 403 のとき

- **ログイン状態**: 同じタブで一度ログアウトして再ログインし、もう一度試す。
- **トークン**: 開発者ツールの Network で該当リクエストを選び、Request Headers に `Authorization: Bearer ...` が付いているか確認する。
- **work-report の 403**: その報告が「自分が作成した報告」か確認する。他人の報告の提出（PATCH）・取得（GET）は 403 になります。

### 4. api-wr/work-report で 403（Invalid key=value pair in Authorization header）が出る場合

**業務報告は専用ゲート `/api-wr`** を使います。API Gateway 側が **Bearer トークンを AWS_IAM 署名として解釈**していると、`Invalid key=value pair in Authorization header` で 403 になります。**認証を NONE に統一**してください。

1. **業務報告ゲートの API ID を特定**
   - `docs/spec/WORK_REPORT_GATEWAY_URL.txt` を読む（例: `https://1x0f73dj2l.../prod` → API_ID は `1x0f73dj2l`）
2. **認証 NONE に統一**
   ```bash
   ./scripts/apigw_proxy_auth_to_none.sh 1x0f73dj2l
   ```
3. **実行ログ確認**: update-method が成功していること、create-deployment が prod に成功していること
4. **失敗時**: `aws sts get-caller-identity` で CLI 認証確認。`aws apigateway get-resources --rest-api-id 1x0f73dj2l --region ap-northeast-1` でリソース存在確認
5. **完了後**: ブラウザで `http://localhost:3334/misogi/#/sales/report-day` をハードリロードし、Network で以下が 403 でないことを確認: `GET /api-wr/work-report?date=...`、`POST /api-wr/upload-url`。**まだ 403 なら以下を収集して報告**: Request URL、Response Headers の `x-amzn-errortype`、Response body 全文。

#### API Gateway コンソールでの確認・修正手順（業務報告ゲート 1x0f73dj2l）

1. **API Gateway コンソール**で **API ID: 1x0f73dj2l** を開く。
2. **左側のリソース**から、次の各メソッドで **認証が NONE か**確認する:
   - **/work-report** … GET, PUT, OPTIONS
   - **/work-report/{id}** … GET, PATCH, OPTIONS
   - **/upload-url** … POST, OPTIONS
   - **/upload-put** … POST, OPTIONS
3. **AWS_IAM になっていたら**、そのメソッドの「メソッドリクエスト」→「認証 (Authorization)」を **NONE** に変更して保存。
4. **変更した場合は、必ず「API のデプロイ」**（ステージ: **prod**）を実行する。
5. **ブラウザでページをリロード**して動作確認する。  
   → **「写真の追加」「下書き保存」「提出」**が正常に行えるようになります。

### 5. x-amzn-errortype: IncompleteSignatureException が出る場合（重要）

**Response header に `x-amzn-errortype: IncompleteSignatureException` がある** → API Gateway の **Method Authorization が AWS_IAM (SigV4)** になっています。フロントは **Cognito の Bearer トークン** を送るため、署名形式が合わず 403 になります。

**対処**: `/work-report` 系および `/upload-url` を扱うリソース（多くは `/{proxy+}` の ANY）の **Method Authorization** を次に統一する。

| 希望する認証 | 設定 |
|--------------|------|
| **Cognito で認証** | Authorization: **Cognito User Pools**、Authorizer に作成済み Cognito Authorizer を指定 |
| **Lambda 内で Bearer 検証** | Authorization: **NONE**（API Gateway は通すだけ。Lambda の `_get_user_info_from_event` で Authorization ヘッダーを検証） |

**手順（API Gateway コンソール）:**

1. API Gateway → 対象 API（51bhoxkbxd）→ リソース
2. `/{proxy+}`（または `/work-report` 等）を選択
3. **ANY** または **PATCH** / **GET** / **POST** の「メソッド」をクリック
4. **メソッドリクエスト**（または Method Request）を開く
5. **認証 (Authorization)** を確認:
   - **AWS_IAM** になっている → **NONE** または **Cognito User Pools**（＋ Authorizer 選択）に変更
6. **保存** 後、**「API のデプロイ」** でステージ（prod）へデプロイする

**リポジトリのスクリプトで一括実行（推奨）:**

```bash
# 本番 API (51bhoxkbxd) の場合
./scripts/apigw_proxy_auth_to_none.sh
# 業務報告専用ゲート (api-wr) の場合: docs/spec/WORK_REPORT_GATEWAY_URL.txt から API_ID を取得して指定
./scripts/apigw_proxy_auth_to_none.sh 1x0f73dj2l
```

**CLI で手動で確認・変更する例（リソース ID は環境により異なります）:**

```bash
API_ID=51bhoxkbxd
REGION=ap-northeast-1
# リソース一覧で {proxy+} の id を確認
aws apigateway get-resources --rest-api-id $API_ID --region $REGION --query "items[?path=='/{proxy+}'].id" --output text
# 上記で得た RESOURCE_ID を使ってメソッドの認証タイプを確認
# aws apigateway get-method --rest-api-id $API_ID --resource-id $RESOURCE_ID --http-method ANY --region $REGION --query authorizationType
# NONE に変更する例（既存の統合を壊さないよう patch）
# aws apigateway update-method --rest-api-id $API_ID --resource-id $RESOURCE_ID --http-method ANY --patch-operations op=replace,path=/authorizationType,value=NONE --region $REGION
```

変更後、ステージをデプロイし、ブラウザで再試行して 403 が解消し Lambda に到達することを確認する。

### 6. API Gateway の確認（上記で直らない場合）

- API Gateway（51bhoxkbxd）で、`/{proxy+}` の **ANY** メソッド（または `POST /upload-url`・`GET /work-report/{proxy+}` 相当）が **Lambda misesapo-reports** に紐づいているか確認する。
- プロキシ統合（`{proxy+}`）で Lambda に転送している構成なら、Lambda のデプロイだけでルートは有効になります。
- **Authorizer**: **Cognito User Pools** を使う場合、Cognito の ID トークンが正しく送られていないと 403 になります。**AWS_IAM** のままでは Bearer トークンは受け付けられず IncompleteSignatureException になります。

---

## curl で確認する（403 の切り分け）

1. ブラウザでログインした状態で、開発者ツール → Application → Local Storage → 該当オリジン → `cognito_id_token` の値をコピーする。
2. 以下で **本番 API に直接** リクエストする（Vite プロキシ経由ではない）。

```bash
TOKEN="ここにcognito_id_tokenの値を貼る"
# upload-url（POST）
curl -s -o /dev/null -w "%{http_code}" -X POST "https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod/upload-url" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"filename":"test.pdf","mime":"application/pdf","size":0,"context":"sales-day-attachment","date":"2026-02-02"}'
# → 200 なら Lambda まで届いている。403 なら API Gateway が拒否している可能性が高い。

# work-report 1件取得（GET）
curl -s -o /dev/null -w "%{http_code}" "https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod/work-report/ea920a4b-56b6-4b99-8201-cb62801484e7" \
  -H "Authorization: Bearer $TOKEN"
# → 200 なら成功。403 なら Lambda の worker_id 不一致 or API Gateway 拒否。401 ならトークン無効。
```

- **403** かつ **Response body が `{"message":"Missing Authentication Token"}`** → API Gateway のルート未設定。
- **403** かつ **Response body が `{"message":"User is not authorized..."}` など** → API Gateway の Authorizer がトークンを拒否。
- **403** かつ **Response body が `{"error":"Forbidden"}`** → Lambda が 403（他人の報告など）。

---

## まとめ

| 現象 | まずやること |
|------|----------------|
| api/upload-url が 403 | 上記「403 のレスポンス body を確認」→ API Gateway ルート／Authorizer を確認。Lambda は未認証時 401 を返す |
| api/work-report/{id} が 403 | 同上。自分の報告か確認（他人の報告は 403）。**API Gateway に /upload-url や /work-report/{id} が無い**場合は下記「リソースが無い場合」を実行 |
| デプロイ済みでも 403 | ログイン・Authorization ヘッダー・API Gateway のルート・Authorizer を確認。**パスが存在するか**も確認（/upload-url・/work-report/{id}） |

### リソースが無い場合（api/upload-url や api/work-report/{id} が 403 のとき）

フロントは **POST /upload-url** と **PATCH /work-report/{id}** を呼びます。API Gateway にこれらのリソースが無いと 403 になります。

1. **リソース追加スクリプトを実行**（無い場合のみ作成し、prod にデプロイ）:
   ```bash
   ./scripts/aws/setup_work_report_upload_api.sh
   ```
2. **認証を NONE に統一**:
   ```bash
   ./scripts/apigw_proxy_auth_to_none.sh
   ```
3. ブラウザで写真追加・業務報告提出を再試行する。

### S3 CORS（写真追加で「CORS policy」エラーになる場合）

**推奨**: フロントは **POST /upload-put** 経由でアップロードする実装になっています（Lambda が S3 に PUT）。この方式ならブラウザは S3 に直接リクエストしないため、S3 CORS は不要です。Lambda をデプロイし、API Gateway に `/upload-put` を追加すれば解消します。

**S3 に直接 PUT する従来方式**を使う場合は、バケット `misesapo-work-reports` に CORS を設定してください。

```bash
./scripts/aws/setup_work_reports_bucket_cors.sh
```

- **POST /upload-put**: ファイルを base64 で送り、Lambda が Presigned URL 宛に PUT。Lambda 6MB 制限のため、実質約 4.5MB までのファイルを想定。

「保存する場所がない」ではなく、「そのリクエストがサーバー側で許可されていない」状態です。**403 の多くは API Gateway が返している**ため、レスポンス body と API Gateway の設定を優先して確認してください。
