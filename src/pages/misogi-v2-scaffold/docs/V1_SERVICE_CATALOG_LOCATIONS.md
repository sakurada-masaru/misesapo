# v1 サービスカタログの所在（Service Items）

サービス内容（清掃メニュー・見積用カタログ等）が **どこにあり、どのような体系か** をまとめる。  
清掃レポートのテンプレ分岐に使えるかを判断するための参照。

---

## 1. 所在（Source of Truth）

| 場所 | パス / キー | 用途 |
|------|-------------|------|
| **リポジトリ（静的）** | `legacy/misesapo v1/src/data/service_items.json` | v1 フロントの静的配信またはビルド時に取り込み。編集のマスタとして利用可能。 |
| **S3（v1 本番）** | オブジェクトキー: `services/service_items.json`（Lambda 内で `SERVICES_KEY = 'services/service_items.json'`） | Lambda が S3 から GET して API で返す。管理画面での更新時は S3 に PUT。バケットは Lambda の環境変数・IAM で参照。 |

※ 本番とリポジトリのどちらを正とするかは運用次第。v2 で「単一の正」にするなら、S3 に集約するか、リポジトリをビルドして CDN 配信するかを決める。

---

## 2. サービスカテゴリ・ID の体系

### 2.1 ファイル構造（service_items.json）

- **型**: JSON 配列。1要素 = 1サービスメニュー。
- **主要フィールド**:
  - `id` (number): サービス ID（1, 2, 3, …）
  - `title` (string): サービス名（例: グリストラップ、U字溝・グレーチング清掃）
  - `category` (string): カテゴリ（例: 「厨房設備」）
  - `price` (string): 表示用価格（例: 「¥ 21,000〜」）
  - `description` / `problems` / `solution`: 説明・課題・解決案
  - `forms` (array): 見積フォームの定義（section-type: radio-text, radio-image, grid-items 等）
  - `details` (array): 詳細セクション（種類・数量など）
  - `image` / `detail-image`: 画像パス（相対パス）

### 2.2 カテゴリ例（ファイル内で出現するもの）

- **厨房設備** … グリストラップ、U字溝・グレーチング、配管高圧洗浄 等
- その他カテゴリも `category` で分類されている。

### 2.3 ID 体系

- 数値の連番（1, 2, 3, …）。重複なし。
- v2 で新規サービスを増やす場合は、既存 ID と衝突しない範囲で採番するか、文字列 ID に移行するかを検討。

---

## 3. 清掃レポートのテンプレ分岐に使えるか

### 3.1 v1 の業務報告テンプレ分岐

- **work-report** は `template_id` で種別を分岐（universal_work_reports.py）。
- 例: `CLEANING_DAY_V1`（清掃日報）、`CLEANING_STORE_V1`（店舗別）、`CLEANING_PDF`（PDF 出力）、`SALES_ENTITY_V1`（営業カルテ）、`HR_V1`（人事）等。
- 清掃レポートは「テンプレート ID」で分岐しており、**サービス ID（service_items の id）とは直接紐づいていない**。

### 3.2 service_items を清掃レポートで使う場合

- **可能**: 清掃レポートの「実施したサービス」を、service_items の `id` または `title` で選択させる UI を v2 で作る場合は、同一の `service_items.json`（または S3 の同じキー）を参照すればよい。
- **テンプレ分岐との関係**: 「どのテンプレートを使うか」（CLEANING_DAY_V1 / 店舗別 等）は template_id で決まり、その中で「どのサービスを実施したか」を service_items の id で持つ、という二段構えにできる。
- **推奨**: v2 の清掃レポートで「サービス種別」を選ぶフィールドを設ける場合、service_items の id を値として保存し、表示時だけ title / category を参照する形にすると、v1 のカタログと整合が取りやすい。

---

## 4. v2 での利用案

| 用途 | 案 |
|------|-----|
| **参照元** | リポジトリの `legacy/.../src/data/service_items.json` を v2 用にコピー or 参照する。または S3 の `services/service_items.json` を v2 API で GET して返す。 |
| **清掃レポート** | 店舗タブごとの「実施サービス」に、service_items の id を配列で持たせ、表示時に title/category を解決する。 |
| **テンプレ分岐** | 既存の template_id（CLEANING_DAY_V1 等）はそのまま利用し、サービス種別は description 内の JSON で `service_ids: [1, 2]` のように持つ。 |

※ 秘密情報は含めない。所在・ファイル名・キー・ID 体系のみ記載。
