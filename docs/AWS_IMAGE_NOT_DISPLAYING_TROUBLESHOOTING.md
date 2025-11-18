# 画像が表示されない場合のトラブルシューティング

## 確認手順

### 1. ブラウザのコンソールを確認

1. ブラウザの開発者ツールを開く（F12キー）
2. 「Console」タブを開く
3. 以下のログを確認：
   - `[ImageUpload] Upload result:` - アップロード結果
   - `[ImageUpload] Image URL:` - 画像のURL
   - `[ImagePreview] Failed to load image:` - 画像読み込みエラー

### 2. 画像のURLを確認

アップロード後、以下の情報を確認：

- **画像のURL形式**: `https://misesapo-cleaning-manual-images.s3.ap-northeast-1.amazonaws.com/cleaning-manual-images/{timestamp}_{filename}.jpg`
- **URLが正しく保存されているか**: フォームの画像URLフィールドを確認

### 3. S3バケット内の画像を確認

1. AWSコンソールでS3バケットを開く
2. `cleaning-manual-images/`フォルダを確認
3. 画像ファイルが存在するか確認
4. 画像ファイルをクリックして「オブジェクトURL」を確認
5. そのURLをブラウザで直接開いて、画像が表示されるか確認

## よくある原因と対処法

### 原因1: S3のパブリックアクセスがブロックされている

**症状**: 画像のURLにアクセスすると403エラーまたはアクセス拒否

**対処法**:
1. S3バケットの「アクセス許可」タブを開く
2. 「パブリックアクセスをブロック」の設定を確認
3. 必要に応じて、パブリックアクセスを許可

詳細は [AWS S3 パブリックアクセス設定](AWS_S3_PUBLIC_ACCESS_SETUP.md) を参照してください。

### 原因2: バケットポリシーが設定されていない

**症状**: 画像のURLにアクセスすると403エラー

**対処法**:
1. S3バケットの「アクセス許可」タブを開く
2. 「バケットポリシー」セクションで「編集」をクリック
3. 以下のポリシーを追加：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::misesapo-cleaning-manual-images/*"
    }
  ]
}
```

**注意**: `misesapo-cleaning-manual-images`を実際のバケット名に置き換えてください。

### 原因3: 画像のURLが正しく保存されていない

**症状**: 画像のURLフィールドが空、または間違ったURL

**対処法**:
1. ブラウザのコンソールで`[ImageUpload] Image URL:`のログを確認
2. 正しいURLが表示されているか確認
3. フォームの画像URLフィールドに正しいURLが入力されているか確認
4. データを保存後、再度読み込んでURLが保持されているか確認

### 原因4: CORSエラー

**症状**: ブラウザのコンソールにCORSエラーが表示される

**対処法**:
1. S3バケットの「アクセス許可」タブを開く
2. 「CORS」セクションで「編集」をクリック
3. 以下の設定を追加：

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

### 原因5: Lambda関数のACL設定

**症状**: 画像はアップロードされるが、アクセスできない

**対処法**:
1. Lambda関数のコードを確認
2. `put_object`の`ACL='public-read'`が設定されているか確認
3. バケットでACLが無効になっている場合は、バケット設定を変更するか、ACLを削除してバケットポリシーを使用

### 原因6: 画像のURLが相対パスになっている

**症状**: 画像のURLが`cleaning-manual-images/...`のような相対パスになっている

**対処法**:
1. 画像のURLが完全なURL（`https://...`で始まる）になっているか確認
2. 相対パスの場合は、S3の完全なURLに変換する必要があります

## デバッグ方法

### 1. 画像のURLを直接確認

1. 管理画面で画像をアップロード
2. ブラウザのコンソールで`[ImageUpload] Image URL:`のログを確認
3. そのURLをコピーして、新しいタブで開く
4. 画像が表示されるか確認

### 2. S3バケット内の画像を確認

1. AWSコンソールでS3バケットを開く
2. `cleaning-manual-images/`フォルダを確認
3. 最新の画像ファイルを確認
4. 画像ファイルをクリックして「オブジェクトURL」をコピー
5. そのURLをブラウザで開いて、画像が表示されるか確認

### 3. ネットワークタブで確認

1. ブラウザの開発者ツールを開く
2. 「Network」タブを開く
3. ページをリロード
4. 画像のリクエストを確認
5. ステータスコードを確認（200なら成功、403/404ならエラー）

## 確認チェックリスト

- [ ] S3バケット内に画像ファイルが存在する
- [ ] 画像のURLが完全なURL（`https://...`で始まる）になっている
- [ ] S3バケットのパブリックアクセスが許可されている
- [ ] バケットポリシーが正しく設定されている
- [ ] CORS設定が正しく設定されている
- [ ] Lambda関数の`ACL='public-read'`が設定されている
- [ ] 画像のURLがデータに正しく保存されている
- [ ] ブラウザのコンソールにエラーがない

## 関連ドキュメント

- [AWS S3 パブリックアクセス設定](AWS_S3_PUBLIC_ACCESS_SETUP.md)
- [AWS S3 セットアップガイド](AWS_S3_SETUP.md)
- [AWS Lambda + API Gateway セットアップ](AWS_LAMBDA_API_GATEWAY_SETUP.md)

