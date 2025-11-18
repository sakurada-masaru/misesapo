# Firebase → AWS 完全移行計画

清掃マニュアル機能をFirebaseからAWSのみに移行する計画です。

## 現在のFirebase使用状況

### 1. Firestore（データベース）
- **用途**: 清掃マニュアルデータの保存・読み込み
- **コレクション**:
  - `cleaning-manual`（確定版データ）
  - `cleaning-manual-drafts`（下書きデータ）

### 2. Firebase Authentication
- **用途**: 認証とロール管理（Custom Claims）
- **ロール**: admin, staff, concierge, developer, master

### 3. Firebase Storage
- **用途**: 画像アップロード
- **状態**: ✅ 既にAWS S3に移行済み

## 移行方針

### オプション1: S3 + Lambda + API Gateway（推奨）

**構成**:
- **データ保存**: S3バケットにJSONファイルとして保存
- **API**: Lambda + API Gatewayで読み書きAPIを提供
- **認証**: API GatewayのリソースポリシーまたはLambda関数内で簡易認証

**メリット**:
- ✅ 既存のS3アップロードAPIと同じ構成で統一できる
- ✅ コストが低い（S3は非常に安価）
- ✅ シンプルな実装

**デメリット**:
- ⚠️ リアルタイム更新がない（ページリロードが必要）
- ⚠️ 同時編集の競合制御が難しい

**実装難易度**: ⭐⭐☆☆☆（中程度）

### オプション2: DynamoDB + Lambda + API Gateway

**構成**:
- **データ保存**: DynamoDBテーブル
- **API**: Lambda + API Gateway
- **認証**: API GatewayのリソースポリシーまたはLambda関数内で簡易認証

**メリット**:
- ✅ データベースとしての機能が充実
- ✅ クエリ機能が使える
- ✅ スケーラブル

**デメリット**:
- ⚠️ コストがS3より高い
- ⚠️ 設定が複雑

**実装難易度**: ⭐⭐⭐☆☆（やや高）

### オプション3: 認証なし + 開発サーバー経由のみ

**構成**:
- **データ保存**: ローカルのJSONファイル（開発サーバー経由）
- **認証**: なし（開発サーバー経由のみアクセス可能）

**メリット**:
- ✅ 実装が最も簡単
- ✅ 追加のAWS設定が不要

**デメリット**:
- ⚠️ 本番環境では使用できない
- ⚠️ 認証機能がない

**実装難易度**: ⭐☆☆☆☆（簡単）

## 推奨: オプション1（S3 + Lambda + API Gateway）

既存のS3アップロードAPIと同じ構成で統一できるため、オプション1を推奨します。

## 移行手順

### ステップ1: Lambda関数の拡張

既存の `misesapo-s3-upload` Lambda関数を拡張して、データの読み書きも処理できるようにします。

または、新しいLambda関数 `misesapo-cleaning-manual-api` を作成します。

### ステップ2: API Gatewayの拡張

既存のAPI Gatewayに以下のエンドポイントを追加：
- `GET /cleaning-manual` - データ読み込み
- `PUT /cleaning-manual` - データ保存（確定版）
- `GET /cleaning-manual/draft` - 下書き読み込み
- `PUT /cleaning-manual/draft` - 下書き保存

### ステップ3: クライアント側コードの修正

`cleaning-manual-firebase.js` を `cleaning-manual-aws.js` に置き換え、AWS API Gateway経由でデータを読み書きするように変更します。

### ステップ4: 認証の簡略化

- オプションA: API GatewayのリソースポリシーでIP制限
- オプションB: Lambda関数内で簡易認証（APIキーなど）
- オプションC: 認証なし（開発サーバー経由のみ）

## 実装の詳細

詳細な実装手順は、選択したオプションに応じて別途ドキュメントを作成します。

## 移行のタイミング

- **段階的移行**: FirebaseとAWSを併用しながら、徐々にAWSに移行
- **一括移行**: 一度にすべてをAWSに移行

どちらの方法でも可能です。

