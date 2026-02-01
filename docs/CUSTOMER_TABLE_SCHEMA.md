# 顧客情報テーブル設計（CSV準拠）

## 正とするデータソース

- **ファイル**: `顧客DB 152a4cf1e6bd80218baad0a094e029d5.csv`（Notion 顧客DB エクスポート）
- **配置**: 例）`Downloads/プライベート、シェア/顧客DB/` または プロジェクト内にコピーして利用
- **文字コード**: UTF-8（BOM あり可）
- **1行**: 1店舗。同一法人・同一ブランドが複数行にわたる。

---

## CSV 列と DynamoDB 属性の対応

### CSV ヘッダー（16列）

| CSV列名 | 必須 | 用途 | 格納先テーブル | DynamoDB属性名 |
|--------|------|------|----------------|----------------|
| 会社名 | 推奨 | 法人名 | clients | name |
| ブランド名 | 任意 | ブランド名（空は法人直下店舗） | brands | name |
| 店舗名 | 推奨 | 店舗名 | stores | name |
| 担当者（代表者）紹介者 | 任意 | 担当者・紹介者 | stores | contact_person |
| ログインメールアドレス | 任意 | メール | stores | email |
| 電話番号 | 任意 | 電話番号 | stores | phone |
| URL | 任意 | 店舗・法人URL | stores | url |
| 獲得者(ミセサポ) | 任意 | 獲得者 | stores | acquired_by |
| 担当者(ミセサポ) | 任意 | 担当者 | stores | assigned_to |
| 店舗数 | 任意 | 店舗数（法人・ブランド単位の記載） | stores | store_count |
| ステータス | 任意 | 稼働状態 | clients/brands/stores | status |
| ニーズ内容 | 任意 | ニーズ・備考 | stores | needs_notes |
| 清掃頻度 | 任意 | 毎月/スポット/隔月など | stores | cleaning_frequency |
| 紹介者 | 任意 | 紹介元 | stores | introducer |
| 実施項目 | 任意 | 実施内容 | stores | implementation_items |

- 法人名が空の行: **ブランド名 or 店舗名で法人を補完**し、その名前で `misesapo-clients` に1件作成する。法人がないブランド・店舗も必ず `client_id` を持つ。
- ブランド名が空の行: 法人名でブランドを補完（法人直下の店舗として扱う）。
- 店舗名が空の行: ブランド名で店舗名を補完。

**運用方針**: すべての店舗は必ず1つの `client_id`（法人ID）を持つ。法人名が空の場合は「法人」レコードをブランド名 or 店舗名で1件作成して割り当てる。

---

## ステータス正規化

CSV の「ステータス」を API/UI 用に正規化する。

| CSVの値 | DynamoDB / API の値 |
|---------|---------------------|
| 稼働中 | active |
| 契約作業中 | contract_in_progress |
| 現場一時停止 | suspended |
| 上記以外・空 | inactive |

---

## テーブル定義

### 1. misesapo-clients（法人）

| 属性 | 型 | キー | 説明 |
|------|-----|------|------|
| id | S | PK | CL00001 形式（採番） |
| name | S | | 法人名（CSV「会社名」） |
| status | S | | active / inactive |
| created_at | S | | ISO8601 |
| updated_at | S | | ISO8601 |

- インポート時: 同一「会社名」で1件のみ作成。
- API から作成する場合は email, phone 等を利用。

### 2. misesapo-brands（ブランド）

| 属性 | 型 | キー | 説明 |
|------|-----|------|------|
| id | S | PK | BR00001 形式 |
| client_id | S | | 法人ID |
| name | S | | ブランド名（CSV「ブランド名」） |
| status | S | | active / inactive |
| created_at | S | | ISO8601 |
| updated_at | S | | ISO8601 |

- 同一 (client_id, ブランド名) で1件のみ作成。

### 3. misesapo-stores（店舗）

| 属性 | 型 | キー | 説明 |
|------|-----|------|------|
| id | S | PK | ST00001 形式 |
| client_id | S | | 法人ID（必ず1つ。法人名が空の場合はブランド名 or 店舗名で client を1件作成） |
| client_name | S | | 法人名（店舗レコードに持たせる。一覧で名前を返すため） |
| brand_id | S | | ブランドID |
| brand_name | S | | ブランド名（店舗レコードに持たせる。一覧で名前を返すため） |
| name | S | | 店舗名 |
| contact_person | S | | 担当者（代表者）紹介者 |
| email | S | | ログインメールアドレス |
| phone | S | | 電話番号 |
| url | S | | URL |
| acquired_by | S | | 獲得者(ミセサポ) |
| assigned_to | S | | 担当者(ミセサポ) |
| store_count | S | | 店舗数（CSVの記載のまま） |
| status | S | | 正規化後: active / contract_in_progress / suspended / inactive |
| needs_notes | S | | ニーズ内容 |
| cleaning_frequency | S | | 清掃頻度 |
| introducer | S | | 紹介者 |
| implementation_items | S | | 実施項目 |
| postcode | S | | 住所（CSVにない場合は空） |
| pref | S | | 都道府県 |
| city | S | | 市区町村 |
| address1 | S | | 番地等 |
| address2 | S | | 建物名等 |
| notes | S | | 備考（従来用・任意） |
| sales_notes | S | | 営業メモ（従来用・任意） |
| registration_type | S | | csv_import / manual |
| owner_id | S | | API登録時のみ。インポート時は空可 |
| created_at | S | | ISO8601 |
| updated_at | S | | ISO8601 |

- **1 CSV 行 = 1 店舗レコード**。上記の CSV 由来項目をすべて格納する。
- 住所は CSV に列が無いため、インポート時は空。API や手動編集で追加可能。

---

## インデックス・キー

- 各テーブルとも **パーティションキーのみ: id**（HASH）。
- クエリ: client_id / brand_id でのフィルタは Scan + FilterExpression で対応（現状どおり）。

---

## 運用

1. **初回・再構築**: `scripts/import_customer_list.py` に CSV を渡すと、既存の clients / brands / stores を削除したうえで CSV から再採番・投入する。
2. **最新 CSV**: 顧客DBの「最新」は上記 CSV ファイルを正とする。再インポートで DynamoDB を同期する。
3. **API からの新規**: 営業画面から店舗を手動登録する場合は `create_store` がそのまま利用可能。新属性（url, acquired_by, assigned_to 等）は API で任意追加可能。

---

## 関連ドキュメント

- [CUSTOMER_CSV_IMPORT.md](./CUSTOMER_CSV_IMPORT.md) - インポート手順と実行方法
