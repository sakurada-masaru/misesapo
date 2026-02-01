# 顧客リストCSVでIDを再生成する手順

## 概要

`scripts/import_customer_list.py` は、**顧客DB CSV**（`顧客DB 152a4cf1e6bd80218baad0a094e029d5.csv` 形式）を正として、DynamoDB の法人・ブランド・店舗テーブルを再構成します。

- **法人ID（CL）・ブランドID（BR）・店舗ID（ST）** を新規採番して投入します。
- 実行すると **既存の clients / brands / stores は全件削除** され、CSV の内容だけで再構成されます。
- テーブル設計は [CUSTOMER_TABLE_SCHEMA.md](./CUSTOMER_TABLE_SCHEMA.md) に準拠しています。

---

## 正とするCSV

- **ファイル名例**: `顧客DB 152a4cf1e6bd80218baad0a094e029d5.csv`（Notion 顧客DB エクスポート）
- **配置例**: `Downloads/プライベート、シェア/顧客DB/` または プロジェクト内にコピー（例: `scripts/customer_list_notion.csv`）
- **文字コード**: UTF-8（BOM あり可）
- **1行**: 1店舗。同一法人・同一ブランドが複数行にわたります。

---

## CSV の列（ヘッダー）

| 列名 | 必須 | 説明 |
|------|------|------|
| 会社名 | 推奨 | 法人名。空の場合はブランド名 or 店舗名で補完 |
| ブランド名 | 任意 | ブランド名。空の場合は法人名で補完（法人直下の店舗） |
| 店舗名 | 推奨 | 店舗名。空の場合はブランド名で補完 |
| 担当者（代表者）紹介者 | 任意 | 担当者・紹介者 |
| ログインメールアドレス | 任意 | メールアドレス |
| 電話番号 | 任意 | 電話番号 |
| URL | 任意 | 店舗・法人URL |
| 獲得者(ミセサポ) | 任意 | 獲得者（ミセサポ側） |
| 担当者(ミセサポ) | 任意 | 担当者（ミセサポ側） |
| 店舗数 | 任意 | 店舗数（法人・ブランド単位の記載） |
| ステータス | 任意 | 稼働中 / 契約作業中 / 現場一時停止 等 → 正規化して保存 |
| ニーズ内容 | 任意 | ニーズ・備考 |
| 清掃頻度 | 任意 | 毎月清掃 / スポット清掃 / 隔月清掃 等 |
| 紹介者 | 任意 | 紹介元 |
| 実施項目 | 任意 | 実施内容 |

- 法人名・ブランド名・店舗名がすべて空の行はスキップされます。
- 「稼働中」のみの行など無効なデータ行もスキップされます。

---

## 実行方法

1. CSV を用意する（例: 最新の顧客DBを `scripts/customer_list_notion.csv` にコピー）
2. AWS 認証済み・リージョン ap-northeast-1 で以下を実行:

```bash
cd /path/to/misesapo
python3 scripts/import_customer_list.py scripts/customer_list_notion.csv
```

- 既存の **misesapo-clients / misesapo-brands / misesapo-stores** を削除したうえで、CSV の内容で新規 ID を採番して投入します。
- 法人は「会社名」でユニーク、ブランドは「法人＋ブランド名」でユニークとして重複を作らず、CL00001〜, BR00001〜, ST00001〜 を振ります。

---

## テーブルが無い場合

初回や別環境では、先にテーブルを作成してください。

```bash
./scripts/create_clients_table.sh
./scripts/create_brands_table.sh
./scripts/create_stores_table.sh
```

---

## 実行後の確認

- 管理画面の顧客一覧や misogi の顧客カルテ一覧で、法人・ブランド・店舗が CSV どおりに表示されるか確認してください。
- 不整合があれば、CSV の列名・文字コードを [CUSTOMER_TABLE_SCHEMA.md](./CUSTOMER_TABLE_SCHEMA.md) および `scripts/import_customer_list.py` の列名マッピングと照らして調整してください。
