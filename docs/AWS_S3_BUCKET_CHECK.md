# S3バケットの確認と初期セットアップ

## バケット内にオブジェクトがない場合

S3バケットを確認したところ、オブジェクトがない場合は、以下のいずれかの状況です：

1. **まだ画像をアップロードしていない**
2. **まだデータファイルをアップロードしていない**
3. **別のバケットを見ている**
4. **バケットが存在しない**

## 確認手順

### 1. 正しいバケット名を確認

プロジェクトで使用しているバケット名は：
- **`misesapo-cleaning-manual-images`**

AWSコンソールで、この名前のバケットが存在するか確認してください。

### 2. バケットが存在しない場合

バケットが存在しない場合は、作成する必要があります：

1. AWSコンソールでS3サービスを開く
2. 「バケットを作成」をクリック
3. バケット名: `misesapo-cleaning-manual-images`
4. リージョン: `ap-northeast-1`（東京）
5. パブリックアクセス設定: 必要に応じて設定（画像を公開する場合はブロックを解除）

詳細は [AWS S3 セットアップガイド](AWS_S3_SETUP.md) を参照してください。

### 3. データファイルをアップロード

既存のJSONデータをS3にアップロードします：

```bash
# 必要なパッケージをインストール（初回のみ）
pip3 install boto3 python-dotenv

# .envファイルにAWS認証情報を設定
# AWS_ACCESS_KEY_ID=your_access_key_id
# AWS_SECRET_ACCESS_KEY=your_secret_access_key
# AWS_S3_BUCKET_NAME=misesapo-cleaning-manual-images
# AWS_S3_REGION=ap-northeast-1

# スクリプトを実行
python3 scripts/upload_cleaning_manual_to_s3.py
```

このスクリプトを実行すると、`src/data/cleaning-manual.json`がS3バケットの`cleaning-manual/data.json`にアップロードされます。

### 4. 画像をアップロード（テスト）

画像アップロード機能をテストするには：

1. 管理画面（`cleaning-manual-admin.html`）を開く
2. 項目を編集または新規作成
3. 「画像をアップロード」ボタンをクリック
4. 画像を選択してアップロード

アップロードが成功すると、S3バケットの`cleaning-manual-images/`フォルダに画像が保存されます。

## バケット内の構造（アップロード後）

アップロードが完了すると、以下のような構造になります：

```
misesapo-cleaning-manual-images/
├── cleaning-manual-images/          # 画像ファイル
│   └── {timestamp}_{filename}.jpg
└── cleaning-manual/                 # データファイル
    ├── data.json                    # 確定版データ
    └── draft.json                   # 下書きデータ（存在する場合）
```

## トラブルシューティング

### バケットが見つからない

- AWSコンソールで正しいリージョン（`ap-northeast-1`）を選択しているか確認
- バケット名のスペルミスがないか確認
- 別のAWSアカウントでログインしていないか確認

### アップロードに失敗する

- `.env`ファイルに正しいAWS認証情報が設定されているか確認
- IAMユーザーにS3への書き込み権限があるか確認
- バケットのパブリックアクセス設定を確認

### 画像が表示されない

- バケットのパブリックアクセス設定を確認
- バケットポリシーが正しく設定されているか確認
- 画像のURLが正しいか確認（コンソールログを確認）

