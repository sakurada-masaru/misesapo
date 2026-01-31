# POST /upload-url 仕様（補助資料 S3 Presigned PUT）

## 概要

業務報告の店舗タブで補助資料（写真/PDF/Excel/Word 等）をアップロードするため、  
ブラウザから S3 へ直 PUT する Presigned URL を発行する API。

## リクエスト

- **Method**: `POST`
- **Path**: `/upload-url`
- **Body (JSON)**:
  - `filename` (string): 元ファイル名
  - `mime` (string): Content-Type（例: `application/pdf`）
  - `size` (number): バイト数
  - `context` (string): 用途（例: `cleaning-store-attachment`）
  - `date` (string): 作業日 YYYY-MM-DD
  - `storeIndex` (number): 店舗インデックス 0〜2

## レスポンス

- **200 OK**  
  - `uploadUrl` (string): S3 Presigned PUT URL（ブラウザが PUT する先）
  - `fileUrl` (string): アップロード後の閲覧用 URL（S3 直 or CloudFront）
  - `key` (string): S3 オブジェクトキー（保存・復元で description に格納）

## バックエンド実装要件

### 1. バケット

- **対象バケット**: 環境変数で指定（例: `UPLOAD_BUCKET` または `S3_REPORTS_BUCKET`）
- 本番・ステージングで別バケット可。

### 2. オブジェクトキー（key）命名

- **形式**: `reports/{date}/{uuid}_{sanitized_filename}`
  - `date`: リクエストの `date`（YYYY-MM-DD）
  - `uuid`: 衝突防止のため必須（v4 推奨）
  - `sanitized_filename`: ファイル名の安全化（制御文字・`..`・パス除去、ASCII 化またはエンコード）
- 例: `reports/2026-01-31/a1b2c3d4-5678-90ab-cdef-1234567890ab_作業指示書.pdf`

### 3. Presign 条件

- **Content-Type を presign 条件に含める**
  - クライアントが `PUT` 時に同じ `Content-Type` ヘッダーを付与する前提。
  - AWS SDK の `PutObjectCommand` で `ContentType` を指定し、署名に含める。

### 4. S3 CORS

- **許可メソッド**: `PUT`, `GET`
- **許可 Origin**: misesapo ドメイン（本番・ステージングのフロント Origin）
- 例:
  ```json
  [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["PUT", "GET"],
      "AllowedOrigins": ["https://*.misesapo.jp", "https://misesapo.jp"],
      "ExposeHeaders": ["ETag"]
    }
  ]
  ```

### 5. fileUrl の形式

- **採用**: **S3 オブジェクトの公開 URL** または **CloudFront の署名付き/公開 URL**
- **推奨**: 本番では CloudFront 経由（キャッシュ・HTTPS・ドメイン統一）。  
  開発・検証では S3 直 URL（`https://{bucket}.s3.{region}.amazonaws.com/{key}`）でも可。
- フロントは `fileUrl` をそのまま「開く」リンクに使用する。

## 参照実装

- Node（Lambda / Express 等）での Presigned URL 発行例: `docs/upload-url-handler.example.js` を参照。
