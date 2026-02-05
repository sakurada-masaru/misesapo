# API Gateway 認証設定変更手順

## 問題
`/houkoku` と `/houkoku/upload-url` エンドポイントが AWS_IAM 認証を要求しているが、
フロントエンドは Bearer (Cognito JWT) を送信しているため 403 Forbidden エラーが発生。

## 対象
- **API Gateway ID**: `1x0f73dj2l`
- **API 名**: misesapo-work-report
- **リージョン**: ap-northeast-1

---

## 手順

### Step 1: API Gateway を開く

1. AWS Console にログイン
2. リージョンを **ap-northeast-1 (東京)** に設定
3. **API Gateway** サービスを開く
4. API 一覧から `1x0f73dj2l` または `misesapo-work-report` を選択

---

### Step 2: API タイプを確認

API が **REST API** か **HTTP API** かで設定方法が異なる。

#### HTTP API の場合（推奨）

1. 左メニューの **Authorization** をクリック
2. **Create and attach an authorizer** をクリック
3. **Authorizer type**: `JWT`
4. **Identity source**: `$request.header.Authorization`
5. **Issuer URL**: `https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_EDKElIGoC`
6. **Audience**: `25abe85ibm5hn6rrsokd5jssb5`
7. **Attach this authorizer to routes** で以下を選択:
   - `POST /houkoku`
   - `POST /houkoku/upload-url`
8. **OPTIONS** ルートは認証 **なし** のまま（CORS用）

#### REST API の場合

1. 左メニューの **Authorizers** をクリック
2. **Create New Authorizer** をクリック
3. 以下を設定:
   - **Name**: `CognitoAuthorizer`
   - **Type**: `Cognito`
   - **Cognito User Pool**: `ap-northeast-1_EDKElIGoC` を選択
   - **Token Source**: `Authorization`
4. **Create** をクリック
5. 左メニューの **Resources** をクリック
6. `/houkoku` → `POST` を選択
7. **Method Request** をクリック
8. **Authorization** を先ほど作成した `CognitoAuthorizer` に変更
9. `/houkoku/upload-url` → `POST` も同様に設定
10. **OPTIONS** メソッドは `NONE` のまま

---

### Step 3: デプロイ

⚠️ **重要: 変更は Deploy しないと反映されません**

1. **Actions** → **Deploy API** をクリック
2. **Deployment stage**: `prod` を選択
3. **Deploy** をクリック

---

### Step 4: テスト

ブラウザまたは curl で確認:

```bash
TOKEN=$(cat ~/.cognito_token | tr -d '\n')
curl -s -X POST "https://1x0f73dj2l.execute-api.ap-northeast-1.amazonaws.com/prod/houkoku" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"template_id":"CLEANING_V1","work_date":"2026-02-05","payload":{"test":true}}'
```

期待する結果: `{"report_id": "HK#...", "state": "submitted"}`

---

## トラブルシューティング

### まだ 403 が出る場合

1. **Deploy を忘れていないか確認**
2. **Authorizer のテスト**: API Gateway の Authorizer 画面で「Test」ボタンを使い、トークンを貼り付けてテスト
3. **Token Source** が正しいか確認（`Authorization` ヘッダー）

### CloudFront を使っている場合（本番のみ）

Origin Request Policy で `Authorization` ヘッダーが転送されているか確認:
1. CloudFront → Distributions → 対象のディストリビューション
2. Origins → 対象の Origin を編集
3. **Origin request policy**: `Authorization` が含まれるポリシーを選択
