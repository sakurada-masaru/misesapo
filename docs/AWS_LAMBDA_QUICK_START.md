# AWS Lambda + API Gateway クイックスタートガイド

このガイドでは、AWS Lambda + API Gatewayを使ってS3アップロードAPIを最短でセットアップする方法を説明します。

## 📋 事前準備

1. AWSアカウントを持っていること
2. S3バケットが作成済みであること（`misesapo-cleaning-manual-images`）
3. IAMユーザーのアクセスキーが取得済みであること

## 🚀 セットアップ手順（約15分）

### ステップ1: Lambda関数を作成（5分）

1. **AWS Console** → **Lambda** → **「関数の作成」**
2. **「一から作成」** を選択
3. 設定:
   - **関数名**: `misesapo-s3-upload`
   - **ランタイム**: `Python 3.11`
   - **アーキテクチャ**: `x86_64`
4. **「関数の作成」** をクリック

5. **コードエディタ**に `lambda_function.py` の内容をコピー&ペースト

6. **「設定」** → **「環境変数」** → **「環境変数を編集」**:
   - `S3_BUCKET_NAME`: `misesapo-cleaning-manual-images`
   - `S3_REGION`: `ap-northeast-1`

7. **「設定」** → **「アクセス権限」** → **ロール名をクリック** → **「ポリシーをアタッチ」**:
   - `AmazonS3FullAccess` を検索して選択
   - **「ポリシーをアタッチ」** をクリック

### ステップ2: API GatewayでREST APIを作成（5分）

1. **AWS Console** → **API Gateway** → **「API を作成」**
2. **「REST API」** → **「構築」**
3. **「新しいAPI」** → **API名**: `misesapo-s3-upload-api` → **「API の作成」**

4. **「アクション」** → **「リソースの作成」**:
   - **リソース名**: `upload` → **「リソースの作成」**

5. `upload` リソースを選択 → **「アクション」** → **「メソッドの作成」**:
   - **メソッド**: `POST`
   - **統合タイプ**: `Lambda関数`
   - **Lambda関数**: `misesapo-s3-upload` → **「保存」** → **「OK」**

6. **「アクション」** → **「CORS を有効にする」**:
   - **アクセス制御を許可するオリジン**: `*`
   - **アクセス制御を許可するヘッダー**: `Content-Type`
   - **アクセス制御を許可するメソッド**: `POST, OPTIONS` にチェック
   - **「CORS を有効にして既存の CORS ヘッダーを置き換える」** → **「はい、既存の値を置き換えます」**

7. **「アクション」** → **「API のデプロイ」**:
   - **デプロイされるステージ**: `[新しいステージ]`
   - **ステージ名**: `prod`
   - **「デプロイ」** をクリック

8. **「呼び出しURL」** をコピー（例: `https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/prod`）

### ステップ3: クライアント側のコードを更新（2分）

1. `src/assets/js/aws-s3-upload.js` を開く
2. 17行目の `API_GATEWAY_ENDPOINT` を、コピーした「呼び出しURL」に置き換え:

```javascript
let API_GATEWAY_ENDPOINT = 'https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/prod';
```

3. ビルドを実行:

```bash
python3 scripts/build.py
```

### ステップ4: 動作確認（3分）

1. GitHub Pagesにデプロイ
2. 清掃マニュアル管理画面を開く
3. 画像をアップロードしてみる
4. 正常にアップロードできれば完了！

## 🔧 トラブルシューティング

### エラー: "S3へのアップロードには開発サーバーまたはAPI Gatewayが必要です"

**原因**: `API_GATEWAY_ENDPOINT` が設定されていない

**解決策**: `aws-s3-upload.js` の `API_GATEWAY_ENDPOINT` を正しいURLに設定してください

### エラー: CORSエラー

**原因**: API GatewayのCORS設定が正しくない

**解決策**: 
1. API Gatewayの `upload` リソースで **「CORS を有効にする」** を再度実行
2. Lambda関数のレスポンスヘッダーを確認

### エラー: 500 Internal Server Error

**原因**: Lambda関数のエラー

**解決策**:
1. Lambda関数の **「モニタリング」** → **「CloudWatch Logs を表示」** でログを確認
2. 環境変数が正しく設定されているか確認
3. IAMロールにS3への書き込み権限があるか確認

## 📚 詳細な手順

より詳細な手順は `docs/AWS_LAMBDA_API_GATEWAY_SETUP.md` を参照してください。

## 💰 コスト

- **Lambda**: 無料枠（月100万リクエストまで無料）
- **API Gateway**: 無料枠（月100万リクエストまで無料）
- **S3**: ストレージと転送量に応じた従量課金（通常は月数百円程度）

## ✅ チェックリスト

- [ ] Lambda関数を作成
- [ ] Lambda関数のコードを設定
- [ ] 環境変数を設定
- [ ] IAMロールにS3権限を追加
- [ ] API GatewayでREST APIを作成
- [ ] `upload` リソースと `POST` メソッドを作成
- [ ] CORSを有効化
- [ ] APIをデプロイ
- [ ] 呼び出しURLをコピー
- [ ] `aws-s3-upload.js` の `API_GATEWAY_ENDPOINT` を設定
- [ ] ビルドを実行
- [ ] 動作確認

