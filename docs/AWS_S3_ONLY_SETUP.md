# AWS S3のみを使用する設定

Firebase Storageの代わりに、AWS S3のみを使用して画像をアップロードするように変更しました。

## 変更内容

1. **Firebase Storageへのフォールバックを削除**
   - 以前は、開発サーバーが利用できない場合にFirebase Storageにフォールバックしていました
   - 現在は、AWS S3のみを使用します

2. **AWS S3アップロード機能の追加**
   - `src/assets/js/aws-s3-upload.js` を追加
   - 開発サーバーのAPIエンドポイント経由でS3にアップロード

## 使用方法

### 開発環境（localhost）

1. **開発サーバーを起動**
   ```bash
   python3 scripts/dev_server.py
   ```

2. **ブラウザでアクセス**
   ```
   http://localhost:5173/cleaning-manual-admin.html
   ```

3. **画像をアップロード**
   - 画像アップロードボタンをクリック
   - 画像を選択または撮影
   - 自動的にS3にアップロードされます

### 本番環境（GitHub Pages）

**注意**: GitHub Pages環境では、開発サーバーが利用できないため、画像のアップロードはできません。

以下のいずれかの方法で解決できます：

#### 方法1: 開発サーバーを別の場所でホスト

- Heroku、AWS Lambda、API Gatewayなどで開発サーバーのAPIエンドポイントをホスト
- `src/assets/js/aws-s3-upload.js` の `getApiEndpoint()` 関数を修正して、ホストしたエンドポイントを指定

#### 方法2: AWS Lambda + API Gatewayを使用

1. **AWS Lambda関数を作成**
   - S3へのアップロード処理を実装
   - API Gatewayと統合

2. **API Gatewayエンドポイントを設定**
   - Lambda関数を呼び出すエンドポイントを作成
   - CORSを有効化

3. **`aws-s3-upload.js` を修正**
   - `getApiEndpoint()` 関数でAPI Gatewayのエンドポイントを返すように修正

## 設定

### 環境変数（開発サーバー用）

`.env` ファイルに以下を設定：

```bash
# AWS S3設定
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_S3_BUCKET_NAME=misesapo-cleaning-manual-images
AWS_S3_REGION=ap-northeast-1
```

### S3バケットの設定

1. **CORS設定**
   - S3バケットの「アクセス許可」タブ → 「CORS」セクション
   - 以下の設定を追加：
   ```json
   [
       {
           "AllowedHeaders": ["*"],
           "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
           "AllowedOrigins": ["*"],
           "ExposeHeaders": ["ETag"],
           "MaxAgeSeconds": 3000
       }
   ]
   ```

2. **バケットポリシー**
   - パブリック読み取りを許可（必要に応じて）

## トラブルシューティング

### 画像がアップロードできない

1. **開発サーバーが起動しているか確認**
   ```bash
   python3 scripts/dev_server.py
   ```

2. **環境変数が正しく設定されているか確認**
   ```bash
   cat .env
   ```

3. **S3バケットのCORS設定を確認**
   - AWS Console → S3 → バケット → アクセス許可 → CORS

### エラーメッセージ: "S3へのアップロードには開発サーバーが必要です"

- GitHub Pages環境では、開発サーバーが利用できないため、このエラーが表示されます
- 上記の「方法1」または「方法2」を実装してください

## 参考

- [AWS S3設定ガイド](./AWS_S3_SETUP.md)
- [AWS S3設定ガイド（ステップバイステップ）](./AWS_S3_SETUP_STEP_BY_STEP.md)

