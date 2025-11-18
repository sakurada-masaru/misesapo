# FirebaseからAWSへの移行ガイド

## 概要

清掃マニュアル管理機能をFirebaseからAWS（Lambda + API Gateway + S3）に移行しました。

## 移行内容

- **データストレージ**: Firestore → S3
- **画像ストレージ**: Firebase Storage → S3
- **API**: Firebase Functions → Lambda + API Gateway
- **認証**: Firebase Authentication → なし（管理画面は直接アクセス可能）

## 必要な設定

### 1. 環境変数の設定

`.env`ファイルを作成し、以下の環境変数を設定してください：

```bash
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_S3_BUCKET_NAME=misesapo-cleaning-manual-images
AWS_S3_REGION=ap-northeast-1
```

### 2. 既存データのS3へのアップロード

**重要**: 既存のS3バケット（`misesapo-cleaning-manual-images`）を使用します。新しいバケットを作成する必要はありません。

既存のJSONデータをS3にアップロードします：

```bash
# 必要なパッケージをインストール（初回のみ）
pip3 install boto3 python-dotenv

# スクリプトを実行
python3 scripts/upload_cleaning_manual_to_s3.py
```

このスクリプトは`src/data/cleaning-manual.json`を読み込み、**既存のS3バケット**内の`cleaning-manual/data.json`にアップロードします。

#### S3バケット内の構造

既存のバケット（`misesapo-cleaning-manual-images`）内で、以下のように整理されます：

```
misesapo-cleaning-manual-images/
├── cleaning-manual-images/          # 画像ファイル（既存）
│   └── {timestamp}_{filename}.jpg
└── cleaning-manual/                 # データファイル（新規追加）
    ├── data.json                    # 確定版データ
    └── draft.json                   # 下書きデータ
```

同じバケット内で異なるパス（プレフィックス）を使って整理するため、新しいバケットを作成する必要はありません。

### 3. Lambda関数のデプロイ

#### 3.1 Lambda関数の作成

1. AWSコンソールでLambda関数を作成
2. ランタイム: Python 3.11 または 3.12
3. `lambda_function.py`の内容をコピー＆ペースト

#### 3.2 環境変数の設定

Lambda関数の環境変数に以下を設定：

- `S3_BUCKET_NAME`: S3バケット名（例: `misesapo-cleaning-manual-images`）
- `S3_REGION`: リージョン（例: `ap-northeast-1`）

#### 3.3 IAMロールの設定

Lambda関数の実行ロールに以下のポリシーを追加：

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::misesapo-cleaning-manual-images/*"
    }
  ]
}
```

### 4. API Gatewayの設定

#### 4.1 リソースとメソッドの追加

以下のリソースとメソッドを追加：

- `/upload` - POST, OPTIONS（画像アップロード）
- `/cleaning-manual` - GET, PUT, POST, OPTIONS（データ読み書き）
- `/cleaning-manual/draft` - GET, PUT, POST, OPTIONS（下書き読み書き）

#### 4.2 CORS設定

各メソッドの「アクション」→「CORSを有効化」を選択し、以下を設定：

- **アクセス制御を許可するオリジン**: `*`
- **アクセス制御を許可するヘッダー**: `Content-Type`
- **アクセス制御を許可するメソッド**: `GET, PUT, POST, OPTIONS`
- **アクセス制御を許可する資格情報**: チェックなし

#### 4.3 APIのデプロイ

1. 「アクション」→「APIのデプロイ」を選択
2. デプロイステージ: `prod`（または既存のステージ）
3. デプロイ後、エンドポイントURLを確認

#### 4.4 エンドポイントURLの設定

デプロイ後、以下のファイルでエンドポイントURLを更新：

- `src/assets/js/aws-cleaning-manual-api.js`（`API_GATEWAY_ENDPOINT`）
- `src/assets/js/aws-s3-upload.js`（`API_GATEWAY_ENDPOINT`）

### 5. S3バケットの設定

#### 5.1 パブリックアクセスの設定

1. S3バケットの「アクセス許可」タブを開く
2. 「パブリックアクセスをブロック」の設定を編集
3. すべてのパブリックアクセスをブロックを**無効化**（本番環境では推奨されませんが、画像の公開が必要な場合）

#### 5.2 バケットポリシーの設定

以下のバケットポリシーを追加（画像の公開読み取りを許可）：

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

詳細は [AWS_S3_PUBLIC_ACCESS_SETUP.md](AWS_S3_PUBLIC_ACCESS_SETUP.md) を参照してください。

## 動作確認

### 1. ローカル開発環境

```bash
# 開発サーバーを起動
python3 scripts/dev_server.py

# ブラウザで http://localhost:5173/cleaning-manual-admin.html を開く
```

### 2. 本番環境（GitHub Pages）

1. 変更をコミット・プッシュ
2. GitHub Pagesがデプロイされるのを待つ（数分）
3. `https://sakurada-masaru.github.io/misesapo/cleaning-manual-admin.html` にアクセス

## S3バケット内の確認方法

### バケット内のファイルを確認する

1. **AWSコンソール** (https://console.aws.amazon.com/) にアクセス
2. **S3** サービスを選択
3. バケット名（`misesapo-cleaning-manual-images`）をクリック
4. バケット内のフォルダとファイルが表示されます

**注意**: バケット内にオブジェクトがない場合は、まだアップロードしていない可能性があります。詳細は [S3バケットの確認と初期セットアップ](AWS_S3_BUCKET_CHECK.md) を参照してください。

#### 確認できる内容

- **`cleaning-manual-images/`フォルダ**: アップロードされた画像ファイル
  - ファイル名は `{timestamp}_{元のファイル名}` の形式
  - 画像をクリックすると、詳細情報（サイズ、最終更新日時など）を確認できます
  - 「オブジェクトURL」をクリックすると、画像を直接表示できます

- **`cleaning-manual/`フォルダ**: データファイル
  - `data.json`: 確定版の清掃マニュアルデータ
  - `draft.json`: 下書きデータ

#### 画像のプレビュー

1. バケット内で画像ファイルをクリック
2. 「オブジェクトURL」をコピー
3. ブラウザの新しいタブでURLを開くと、画像を確認できます

**注意**: パブリックアクセスが有効になっている場合のみ、URLから直接画像を表示できます。無効の場合は、AWSコンソール内でのみ確認できます。

## CORS設定

GitHub PagesからAPI Gatewayにアクセスする場合、CORS設定が必要です。

詳細は以下のドキュメントを参照してください：
- [API Gateway CORS設定: 清掃マニュアルエンドポイント](AWS_API_GATEWAY_CORS_CLEANING_MANUAL.md)

## トラブルシューティング

### データが読み込めない

- S3バケットに`cleaning-manual/data.json`が存在するか確認
- Lambda関数のIAMロールにS3への読み取り権限があるか確認
- API GatewayのエンドポイントURLが正しいか確認

### 画像が表示されない

- S3バケットのパブリックアクセス設定を確認
- バケットポリシーが正しく設定されているか確認
- 画像のURLが正しいか確認（コンソールログを確認）
- バケット内に画像ファイルが実際に存在するか確認（AWSコンソールで確認）

### CORSエラー

- API GatewayのCORS設定を確認
- `Access-Control-Allow-Origin`が`*`に設定されているか確認
- API Gatewayを再デプロイ

## 関連ドキュメント

- [AWS Lambda + API Gateway セットアップ](AWS_LAMBDA_API_GATEWAY_SETUP.md)
- [AWS S3 パブリックアクセス設定](AWS_S3_PUBLIC_ACCESS_SETUP.md)
- [AWS API Gateway CORS設定](AWS_API_GATEWAY_CORS_UPDATE.md)

