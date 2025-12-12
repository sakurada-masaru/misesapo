# ミセサポシステム ER図

## 📊 データベース構造

### DynamoDBテーブル

#### 1. staff-reports（作業レポート）

**テーブル構造:**
- **パーティションキー**: `report_id` (String, UUID)
- **ソートキー**: `created_at` (String, ISO 8601)

**主要属性:**
- `report_id`: レポートID（UUID）
- `created_at`: 作成日時（ISO 8601形式）
- `staff_id`: 清掃員ID（Firebase UID）
- `store_id`: 店舗ID
- `store_name`: 店舗名
- `cleaning_date`: 清掃日
- `cleaning_time`: 清掃時間
- `cleaning_items`: 清掃項目（配列）
- `photos_before`: 作業前写真（配列、S3 URL）
- `photos_after`: 作業後写真（配列、S3 URL）
- `location`: 作業場所（オプション）
- `memo`: 作業メモ
- `status`: ステータス（"draft" | "published" | "archived"）
- `updated_at`: 更新日時

**GSI（グローバルセカンダリインデックス）:**
1. `staff_id-created_at-index`
   - パーティションキー: `staff_id`
   - ソートキー: `created_at`
   - 用途: 清掃員ごとのレポート一覧取得

2. `store_id-created_at-index`
   - パーティションキー: `store_id`
   - ソートキー: `created_at`
   - 用途: 店舗ごとのレポート一覧取得

3. `status-created_at-index`
   - パーティションキー: `status`
   - ソートキー: `created_at`
   - 用途: ステータス別レポート取得

---

#### 2. announcements（お知らせ）

**テーブル構造:**
- **パーティションキー**: `id` (String)
- **ソートキー**: なし

**主要属性:**
- `id`: お知らせID（UUID）
- `title`: タイトル
- `content`: 本文
- `status`: ステータス（"draft" | "published" | "archived"）
- `published_at`: 公開日時（ISO 8601形式）
- `created_at`: 作成日時
- `updated_at`: 更新日時
- `author_id`: 作成者ID（Firebase UID）
- `target_roles`: 対象ロール（配列: ["customer", "staff", "admin"]）

**GSI:**
- `status-published_at-index`
  - パーティションキー: `status`
  - ソートキー: `published_at`
  - 用途: 公開済みお知らせの取得

---

### S3バケット（misesapo-cleaning-manual-images）

#### 1. cleaning-manual/data.json（清掃マニュアル）

**構造:**
```json
{
  "kitchen": [
    {
      "id": "string",
      "title": "string",
      "steps": ["string"],
      "images": ["S3 URL"],
      "notes": "string"
    }
  ],
  "aircon": [],
  "floor": [],
  "other": [],
  "updatedAt": "ISO 8601",
  "updatedBy": "string"
}
```

#### 2. cleaning-manual/draft.json（清掃マニュアル下書き）

**構造:** `data.json` と同じ

#### 3. services/service_items.json（サービス管理）

**構造:**
```json
[
  {
    "id": 1,
    "title": "string",
    "category": "string",
    "price": "string",
    "image": "string",
    "description": "string",
    "problems": ["string"],
    "solution": "string",
    "sections": [
      {
        "sectionIndex": 0,
        "title": "string",
        "content": "string",
        "images": ["string"]
      }
    ]
  }
]
```

#### 4. cleaning-manual-images/（画像ファイル）

**パス構造:**
- `cleaning-manual-images/{timestamp}_{filename}`

---

### Firebase Authentication

#### Users（ユーザー認証）

**構造:**
- `uid`: ユーザーID（Firebase UID）
- `email`: メールアドレス
- `emailVerified`: メール認証済みフラグ
- `displayName`: 表示名（オプション）
- `customClaims`: カスタムクレーム
  - `role`: ロール（"customer" | "staff" | "sales" | "admin" | "developer" | "master"）

**ロール:**
- `customer`: 顧客
- `staff`: 清掃員
- `sales`: 営業・コンシェルジュ
- `admin`: 管理者
- `developer`: 開発者
- `master`: マスター

---

## 🔗 エンティティ間の関係

### リレーションシップ

1. **Users → staff-reports**
   - 1対多（1人の清掃員が複数のレポートを作成）
   - `staff_id` で関連付け

2. **Users → announcements**
   - 1対多（1人の管理者が複数のお知らせを作成）
   - `author_id` で関連付け

3. **staff-reports → S3 (photos)**
   - 1対多（1つのレポートに複数の写真）
   - `photos_before`, `photos_after` でS3 URLを保持

4. **cleaning-manual → S3 (images)**
   - 1対多（1つのマニュアル項目に複数の画像）
   - `images` 配列でS3 URLを保持

---

## 📐 ER図（Mermaid形式）

```mermaid
erDiagram
    USERS ||--o{ STAFF_REPORTS : creates
    USERS ||--o{ ANNOUNCEMENTS : authors
    STAFF_REPORTS ||--o{ S3_PHOTOS : contains
    CLEANING_MANUAL ||--o{ S3_IMAGES : contains
    
    USERS {
        string uid PK
        string email
        boolean emailVerified
        string displayName
        string role "customClaims"
    }
    
    STAFF_REPORTS {
        string report_id PK
        string created_at SK
        string staff_id FK
        string store_id
        string store_name
        string cleaning_date
        string cleaning_time
        array cleaning_items
        array photos_before
        array photos_after
        string location
        string memo
        string status
        string updated_at
    }
    
    ANNOUNCEMENTS {
        string id PK
        string title
        string content
        string status
        string published_at
        string created_at
        string updated_at
        string author_id FK
        array target_roles
    }
    
    CLEANING_MANUAL {
        string id PK
        string category
        string title
        array steps
        array images
        string notes
        string updatedAt
        string updatedBy
    }
    
    SERVICES {
        int id PK
        string title
        string category
        string price
        string image
        string description
        array problems
        string solution
        array sections
    }
    
    S3_PHOTOS {
        string url PK
        string report_id FK
        string type "before|after"
    }
    
    S3_IMAGES {
        string url PK
        string manual_id FK
    }
```

---

## 📝 データストレージの分類

### DynamoDB（構造化データ、検索可能）
- `staff-reports`: 作業レポート（検索・フィルタリングが必要）
- `announcements`: お知らせ（公開日時でのソートが必要）

### S3（JSONファイル、静的データ）
- `cleaning-manual/data.json`: 清掃マニュアル（編集頻度が低い）
- `cleaning-manual/draft.json`: 清掃マニュアル下書き
- `services/service_items.json`: サービス管理（編集頻度が低い）

### S3（画像ファイル）
- `cleaning-manual-images/`: 清掃マニュアル画像
- レポート写真（S3 URLとしてDynamoDBに保存）

### Firebase Authentication（認証情報）
- ユーザー認証情報
- Custom Claims（ロール管理）

---

## 🔍 インデックス戦略

### DynamoDB GSI

1. **staff-reports**
   - `staff_id-created_at-index`: 清掃員ごとのレポート取得
   - `store_id-created_at-index`: 店舗ごとのレポート取得
   - `status-created_at-index`: ステータス別レポート取得

2. **announcements**
   - `status-published_at-index`: 公開済みお知らせの取得

---

## 📊 データフロー

1. **レポート作成**
   - フロントエンド → API Gateway → Lambda → DynamoDB
   - 画像アップロード: フロントエンド → API Gateway → Lambda → S3

2. **サービス管理**
   - フロントエンド → API Gateway → Lambda → S3 (JSON)

3. **清掃マニュアル**
   - フロントエンド → API Gateway → Lambda → S3 (JSON)

4. **認証**
   - フロントエンド → Firebase Authentication → Custom Claims

---

## 🎯 今後の拡張予定

- ユーザー管理テーブル（DynamoDB）
- 店舗管理テーブル（DynamoDB）
- スケジュール管理テーブル（DynamoDB）
- お問い合わせ管理テーブル（DynamoDB）


































