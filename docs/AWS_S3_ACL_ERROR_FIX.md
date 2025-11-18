# S3 ACLエラー修正: "The bucket does not allow ACLs"

## 問題

画像アップロード時に以下のエラーが発生します：

```
An error occurred (AccessControlListNotSupported) when calling the PutObject operation: 
The bucket does not allow ACLs
```

## 原因

S3バケットでACL（Access Control List）が無効になっているため、`ACL='public-read'`を指定してアップロードしようとするとエラーになります。

## 解決方法

### 方法1: Lambda関数からACLを削除（推奨）

ACLを使用せず、バケットポリシーでパブリックアクセスを許可する方法です。これが推奨される方法です。

1. **Lambda関数のコードを更新**
   - `lambda_function.py`から`ACL='public-read'`を削除
   - 既に修正済みです

2. **S3バケットポリシーを設定**
   - バケットポリシーでパブリックアクセスを許可
   - 詳細は `docs/AWS_S3_PUBLIC_ACCESS_SETUP.md` を参照

3. **Lambda関数をデプロイ**
   - AWS Console → Lambda → `misesapo-s3-upload` 関数を開く
   - 「コード」タブで、更新された`lambda_function.py`の内容をコピー&ペースト
   - 「Deploy」ボタンをクリック

### 方法2: S3バケットでACLを有効化（非推奨）

セキュリティ上の理由から、この方法は推奨されません。

1. **AWS Console** → **S3** → バケット `misesapo-cleaning-manual-images` を選択
2. **「アクセス許可」** タブをクリック
3. **「ブロックパブリックアクセス設定」** → **「編集」** をクリック
4. 以下の設定を変更：
   - **新しいパブリック ACL とアップロードされたオブジェクトのパブリック ACL をブロック**: **オフ**（チェックを外す）
   - **パブリック ACL を通じて付与されたパブリックアクセスとクロスアカウントアクセスをブロック**: **オフ**（チェックを外す）
5. **「変更を保存」** をクリック

## 推奨設定

### バケットポリシー

以下のバケットポリシーを設定してください：

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

### ブロックパブリックアクセス設定

- ✅ **新しいパブリックバケットポリシーをブロック**: **オフ**
- ✅ **パブリックバケットポリシーを通じて付与されたパブリックアクセスとクロスアカウントアクセスをブロック**: **オフ**
- ⚠️ **新しいパブリック ACL とアップロードされたオブジェクトのパブリック ACL をブロック**: **オン**（ACLを使用しないため）
- ⚠️ **パブリック ACL を通じて付与されたパブリックアクセスとクロスアカウントアクセスをブロック**: **オン**（ACLを使用しないため）

## 確認

Lambda関数を更新した後、画像アップロードを再度試してください。

1. ブラウザでページをリロード
2. 画像をアップロード
3. エラーが発生しないことを確認
4. アップロード後の画像URLに直接アクセスして、画像が表示されることを確認

## 参考

- [AWS S3 パブリックアクセス設定](https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html)
- [AWS S3 バケットポリシー](https://docs.aws.amazon.com/AmazonS3/latest/userguide/bucket-policies.html)
- [AWS S3 ACLエラー](https://docs.aws.amazon.com/AmazonS3/latest/userguide/about-object-ownership.html)

