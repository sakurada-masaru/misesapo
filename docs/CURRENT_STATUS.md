# 現状整理：清掃マニュアル管理システム

## 現在の状態（2024年）

### ✅ 完了していること

#### 1. コード上の移行（クライアント側）
- ✅ `cleaning-manual-admin.html` - AWS APIを使用するように変更済み
- ✅ `cleaning-manual.html` - AWS APIを使用するように変更済み
- ✅ Firebase SDKの読み込みを削除
- ✅ AWS API用のクライアント側JavaScriptファイルを追加
  - `src/assets/js/aws-cleaning-manual-api.js`
  - `src/assets/js/aws-s3-upload.js`（既存）

#### 2. 画像アップロード機能
- ✅ AWS S3を使用して画像をアップロード
- ✅ Lambda関数 + API Gateway経由でアップロード
- ✅ 既に動作している

#### 3. 開発サーバー
- ✅ ローカル開発用のAPIエンドポイントを追加
  - `/api/cleaning-manual` - データ読み書き
  - `/api/cleaning-manual/draft` - 下書き読み書き
  - `/api/cleaning-manual/upload-image` - 画像アップロード

### ⚠️ 未完了・要確認のこと

#### 1. AWS側の設定（Lambda関数）
- ⚠️ Lambda関数の拡張版をデプロイする必要がある
  - 現在のLambda関数: 画像アップロードのみ対応
  - 必要な機能: データ読み書き機能を追加
  - ファイル: `lambda_function.py`（拡張版が作成済み）

#### 2. AWS側の設定（API Gateway）
- ⚠️ API Gatewayに以下のエンドポイントを追加する必要がある
  - `GET /cleaning-manual` - データ読み込み
  - `PUT /cleaning-manual` - データ保存（確定版）
  - `GET /cleaning-manual/draft` - 下書き読み込み
  - `PUT /cleaning-manual/draft` - 下書き保存
  - 現在: `/upload` エンドポイントのみ存在（画像アップロード用）

#### 3. S3へのデータアップロード
- ⚠️ 既存のJSONデータをS3にアップロードする必要がある
  - スクリプト: `scripts/upload_cleaning_manual_to_s3.py`（作成済み）
  - アップロード先: `cleaning-manual/data.json`
  - まだ実行していない可能性

## 現在の動作状況

### ローカル開発環境（localhost:5173）
- ✅ 開発サーバー経由でデータ読み書きが可能
- ✅ 画像アップロードが可能
- ✅ 下書き機能が動作

### 本番環境（GitHub Pages）
- ⚠️ **データ読み書き**: API Gatewayの設定が完了していないため、動作しない可能性
- ✅ **画像アップロード**: 既に動作している（既存のLambda関数を使用）
- ⚠️ **データ表示**: S3にデータがアップロードされていない場合、表示されない

## データの保存場所

### 現在の構成
```
AWS S3バケット: misesapo-cleaning-manual-images
├── cleaning-manual-images/     # 画像ファイル（✅ 使用中）
│   └── {timestamp}_{filename}.jpg
└── cleaning-manual/            # データファイル（⚠️ 未アップロードの可能性）
    ├── data.json               # 確定版データ
    └── draft.json              # 下書きデータ
```

### Firebase（旧構成）
- ❌ コード上では使用していない
- ⚠️ 既存データがFirestoreに残っている可能性

## 次のステップ

### 1. Lambda関数のデプロイ（最優先）
1. AWSコンソールでLambda関数を開く
2. `lambda_function.py`の内容をコピー＆ペースト
3. 環境変数を設定
4. デプロイ

### 2. API Gatewayの設定
1. API Gatewayでリソースとメソッドを追加
2. CORS設定を確認
3. APIをデプロイ

### 3. データのアップロード
1. `.env`ファイルにAWS認証情報を設定
2. `python3 scripts/upload_cleaning_manual_to_s3.py`を実行
3. S3バケット内に`cleaning-manual/data.json`が作成されることを確認

### 4. 動作確認
1. GitHub Pagesで管理画面を開く
2. データが読み込まれることを確認
3. 編集・保存が動作することを確認

## まとめ

**コード上ではAWS移行は完了していますが、AWS側の設定（Lambda関数のデプロイ、API Gatewayの設定、データのアップロード）がまだ完了していない可能性があります。**

現在は**移行途中**の状態です。完全にAWSで動作させるには、上記の「次のステップ」を実行する必要があります。

