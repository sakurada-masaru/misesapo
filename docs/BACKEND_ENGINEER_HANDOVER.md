# バックエンドエンジニア連携ドキュメント

**作成日**: 2025/11/26  
**目的**: フロントエンド（AWS）とバックエンド（Azure）の設計統一

---

## 1. 現状の共有

### フロントエンド側（AWS）で構築済み

| 項目 | 内容 |
|------|------|
| **ホスティング** | S3 + CloudFront（静的サイト） |
| **API** | API Gateway + Lambda + DynamoDB |
| **データ** | 旧システム（Laravel/MySQL）からエクスポート済み |
| **画面** | 顧客管理、スケジュール、レポート等のUIモック |

### 構築済みAPI（プロトタイプ）

```
GET/POST   /stores      - 店舗一覧・登録
GET/PUT    /stores/{id} - 店舗詳細・更新
GET/POST   /schedules   - スケジュール一覧・登録
GET/POST   /reports     - レポート一覧・登録
GET        /users       - ユーザー一覧
GET        /workers     - 清掃員一覧
```

---

## 2. 確認したい事項

### 2.1 データモデル

現在のフロントエンド側の想定構造：

```
owners（オーナー/会社）
  ├── stores（店舗）※1:N
  ├── contracts（契約）※1:N
  └── users（ログインアカウント）※1:N

stores（店舗）
  ├── schedules（清掃スケジュール）※1:N
  └── reports（レポート）※1:N

workers（清掃員）
  └── schedules（担当スケジュール）※N:M
```

**質問：**
- [ ] Azure Dataverseで使う予定のエンティティ名は？
- [ ] 上記の構造で問題ないか？
- [ ] 既に設計済み/実装済みのテーブルはあるか？

---

### 2.2 ID体系

現在の仮実装：
- 店舗ID: `S` + タイムスタンプ（例: `S1732612345678`）
- 旧データ: 連番（`1`, `2`, `3`...）

**質問：**
- [ ] 本番で使うID形式は？（UUID / 連番 / プレフィックス付き）
- [ ] Azure ADユーザーIDとの紐付け方法は？

---

### 2.3 フィールド命名規則

現在の仮実装：`snake_case`（例: `company_name`, `created_at`）

**質問：**
- [ ] 本番の命名規則は？（snake_case / camelCase / PascalCase）
- [ ] 日本語フィールド名を使う予定はあるか？

---

### 2.4 API仕様

現在の仮実装：REST API（JSON）

**質問：**
- [ ] 本番のAPI形式は？（REST / GraphQL / OData）
- [ ] 認証方式は？（Azure AD SSO / JWT / APIキー）
- [ ] API仕様書のフォーマットは？（OpenAPI / Swagger / その他）

---

### 2.5 ステータス管理

現在の仮実装（店舗ステータス）：

| ステータス | 意味 |
|-----------|------|
| `pending_customer_info` | 顧客情報入力待ち |
| `pending_approval` | 承認待ち |
| `active` | 稼働中 |
| `suspended` | 休止中 |
| `terminated` | 契約終了 |

**質問：**
- [ ] このステータス体系で問題ないか？
- [ ] 追加/変更が必要なステータスはあるか？

---

## 3. 提案：データ構造の統一

### 3.1 店舗（stores）

```json
{
  "id": "string",
  "owner_id": "string",
  "name": "string",
  "company_name": "string",
  "contact_person": "string",
  "email": "string",
  "phone": "string",
  "postcode": "string",
  "pref": "string",
  "city": "string",
  "address1": "string",
  "address2": "string",
  "status": "string",
  "registration_type": "string",
  "lead_status": "string",
  "probability": "string",
  "notes": "string",
  "sales_rep": "string",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### 3.2 スケジュール（schedules）

```json
{
  "id": "string",
  "store_id": "string",
  "worker_id": "string",
  "scheduled_date": "date",
  "scheduled_time": "time",
  "duration_minutes": "integer",
  "status": "string",
  "notes": "string",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### 3.3 レポート（reports）

```json
{
  "id": "string",
  "schedule_id": "string",
  "store_id": "string",
  "worker_id": "string",
  "report_date": "datetime",
  "status": "string",
  "content": "text",
  "photos": ["string"],
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

---

## 4. 次のステップ

1. **本ドキュメントの確認**
   - 上記の質問事項への回答をお願いします

2. **データモデルの合意**
   - 回答を元にER図を確定

3. **API仕様の確定**
   - 認証方式・エンドポイント設計の統一

4. **実装の分担**
   - フロントエンド: UI/UX、画面遷移
   - バックエンド: API、DB、認証、ビジネスロジック

---

## 5. 参考資料

- `docs/DATA_ARCHITECTURE.md` - 現在のデータ設計（更新予定）
- `docs/PROJECT_OVERVIEW.md` - プロジェクト全体概要
- `docs/PAGE_SPECIFICATIONS.md` - 画面仕様

---

## 6. 連絡事項

フロントエンド側のプロトタイプは以下で確認できます：
- **ローカル**: `http://localhost:5173`
- **AWS API**: `https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod`

データは旧Laravel/MySQLシステムからエクスポートしたものを使用しています。
本番移行時にはAzure側のDBに置き換える想定です。


