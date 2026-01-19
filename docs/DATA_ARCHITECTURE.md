# ミセサポ データアーキテクチャ仕様書

**作成日**: 2025年11月25日  
**バージョン**: 1.0  
**目的**: クラウド非依存のデータ管理設計

---

## 1. 設計方針

### 1.1 クラウド非依存（ポータビリティ）

本システムのデータ層は、以下のクラウドプラットフォームへの移行を考慮して設計する。

| プラットフォーム | ストレージ | データベース | 認証 |
|------------------|-----------|-------------|------|
| **AWS** | S3 | DynamoDB / RDS | Cognito |
| **Azure** | Blob Storage | Cosmos DB / Azure SQL | Azure AD B2C |
| **GCP** | Cloud Storage | Firestore / Cloud SQL | Firebase Auth |

### 1.2 データ形式の標準化

- **マスターデータ**: JSON形式（どのクラウドでも読み込み可能）
- **トランザクションデータ**: JSON形式 or リレーショナルDB
- **画像/ファイル**: オブジェクトストレージ（S3/Blob/GCS互換）
- **エクスポート**: CSV/JSON（移行用）

---

## 2. データ分類

### 2.1 マスターデータ（変更頻度: 低）

| データ | 説明 | 件数目安 |
|--------|------|----------|
| 店舗 (stores) | 顧客の店舗情報 | 200+ |
| サービス (services) | 提供サービス一覧 | 50+ |
| ユーザー (users) | 顧客/清掃員/営業/管理者 | 500+ |
| 清掃員 (workers) | 清掃スタッフ情報 | 100+ |
| パートナー (providers) | 協力会社 | 20+ |

### 2.2 トランザクションデータ（変更頻度: 高）

| データ | 説明 | 件数目安 |
|--------|------|----------|
| スケジュール (schedules) | 作業予定 | 10,000+/年 |
| レポート (reports) | 作業報告 | 10,000+/年 |
| 契約 (contracts) | 顧客との契約 | 500+ |
| メッセージ (messages) | 通知/連絡 | 50,000+/年 |

### 2.3 ファイルデータ

| データ | 説明 | 保存先 |
|--------|------|--------|
| レポート画像 | Before/After写真 | オブジェクトストレージ |
| 契約書類 | PDF等 | オブジェクトストレージ |
| 研修動画 | MP4等 | オブジェクトストレージ |

---

## 3. ストレージ構造

### 3.1 オブジェクトストレージ（AWS S3 / Azure Blob）

```
misesapo-data/                    ← プライベートバケット
├── exports/                      ← データエクスポート（移行用）
│   ├── 2025-11-25/
│   │   ├── stores.json
│   │   ├── users.json
│   │   ├── service_jobs.json
│   │   └── providers.json
│   └── latest/                   ← 最新版のシンボリック
│       └── *.json
├── masters/                      ← マスターデータ（本番用）
│   ├── stores.json
│   ├── services.json
│   ├── workers.json
│   └── providers.json
├── backups/                      ← 定期バックアップ
│   └── YYYY-MM-DD/
└── migrations/                   ← 移行履歴
    └── YYYY-MM-DD_description/

misesapo-prod-public/             ← パブリックバケット（既存）
├── reports/                      ← レポート画像
│   └── {report_id}/
│       ├── before/
│       ├── after/
│       └── other/
├── icons/                        ← アイコン
└── assets/                       ← 静的アセット

misesapo-static/                  ← Webサイトホスティング（将来）
└── (ビルド成果物)
```

---

## 4. データスキーマ

### 4.1 店舗 (stores.json)

```json
{
  "version": "1.0",
  "exported_at": "2025-11-25T12:00:00Z",
  "source": "mysql:misesapo-app.stores",
  "data": [
    {
      "id": "STORE-001",
      "legacy_id": 1,
      "name": "神楽坂店",
      "company": {
        "id": "COMP-001",
        "name": "株式会社〇〇"
      },
      "address": {
        "postcode": "1620825",
        "pref": "東京都",
        "city": "新宿区",
        "address1": "神楽坂1-1-1",
        "address2": "〇〇ビル1F"
      },
      "contact": {
        "phone": "03-1234-5678",
        "email": "store@example.com",
        "person": "田中太郎"
      },
      "administrator_id": "USER-001",
      "note": "",
      "created_at": "2024-01-15T10:00:00Z",
      "updated_at": "2025-03-20T15:30:00Z",
      "deleted_at": null
    }
  ]
}
```

### 4.2 ユーザー (users.json)

```json
{
  "version": "1.0",
  "exported_at": "2025-11-25T12:00:00Z",
  "source": "mysql:misesapo-app.users",
  "data": [
    {
      "id": "USER-001",
      "legacy_id": 1,
      "name": "山田花子",
      "email": "yamada@example.com",
      "role": "customer",
      "store_ids": ["STORE-001", "STORE-002"],
      "created_at": "2024-01-10T09:00:00Z",
      "updated_at": "2025-02-15T14:00:00Z",
      "deleted_at": null
    }
  ]
}
```

### 4.3 スケジュール (schedules.json)

```json
{
  "version": "1.0",
  "exported_at": "2025-11-25T12:00:00Z",
  "source": "mysql:misesapo-app.service_jobs",
  "data": [
    {
      "id": "SCH-001",
      "legacy_id": 1,
      "store_id": "STORE-001",
      "service_ids": ["SVC-001", "SVC-002"],
      "worker_ids": ["WORKER-001"],
      "sales_id": "SALES-001",
      "schedule": {
        "type": "regular",
        "interval": 14,
        "week_day": [1, 4],
        "start_date": "2024-04-01",
        "end_date": "9999-12-31"
      },
      "next_date": "2025-12-05",
      "time_start": "10:30",
      "time_end": "12:30",
      "status": "scheduled",
      "note": "",
      "created_at": "2024-03-20T10:00:00Z",
      "updated_at": "2025-11-20T09:00:00Z"
    }
  ]
}
```

### 4.4 清掃員 (workers.json)

```json
{
  "version": "1.0",
  "exported_at": "2025-11-25T12:00:00Z",
  "source": "mysql:misesapo-app.provider_members",
  "data": [
    {
      "id": "WORKER-001",
      "legacy_id": 1,
      "user_id": "USER-010",
      "provider_id": "PROV-001",
      "name": "佐藤一郎",
      "skills": ["エアコン分解", "グリストラップ", "床清掃"],
      "area": ["東京23区", "神奈川県"],
      "status": "active",
      "created_at": "2024-02-01T10:00:00Z"
    }
  ]
}
```

---

## 5. ID体系

### 5.1 新ID形式

既存システムの数値IDから、可読性の高いプレフィックス付きIDに移行。

| エンティティ | プレフィックス | 例 |
|-------------|---------------|-----|
| 店舗 | STORE- | STORE-001 |
| ユーザー | USER- | USER-001 |
| 清掃員 | WORKER- | WORKER-001 |
| 営業 | SALES- | SALES-001 |
| スケジュール | SCH- | SCH-2025-1125-001 |
| レポート | RPT- | RPT-2025-1125-001 |
| 契約 | CNT- | CNT-001 |
| サービス | SVC- | SVC-001 |
| パートナー | PROV- | PROV-001 |

### 5.2 レガシーID保持

移行時は `legacy_id` フィールドで旧IDを保持し、既存データとの紐付けを維持。

---

## 6. クラウド移行マッピング

### 6.1 ストレージ

| 用途 | AWS | Azure | GCP |
|------|-----|-------|-----|
| マスターデータ | S3 | Blob Storage | Cloud Storage |
| レポート画像 | S3 | Blob Storage | Cloud Storage |
| Webホスティング | S3 + CloudFront | Static Web Apps | Cloud Storage + CDN |

### 6.2 データベース

| 用途 | AWS | Azure | GCP |
|------|-----|-------|-----|
| NoSQL | DynamoDB | Cosmos DB | Firestore |
| RDB | RDS (MySQL) | Azure SQL | Cloud SQL |

### 6.3 認証

| 用途 | AWS | Azure | GCP |
|------|-----|-------|-----|
| ユーザー認証 | Cognito | Azure AD B2C | Firebase Auth |

---

## 7. バックアップ方針

### 7.1 自動バックアップ

| データ | 頻度 | 保持期間 |
|--------|------|----------|
| マスターデータ | 日次 | 90日 |
| トランザクション | 日次 | 30日 |
| 画像 | 差分のみ | 無期限 |

### 7.2 エクスポート形式

- JSON: 構造化データ
- CSV: Excel等での確認用
- SQL: RDB移行用

---

## 8. セキュリティ

### 8.1 アクセス制御

| バケット | 公開設定 | 用途 |
|----------|----------|------|
| misesapo-data | プライベート | 顧客データ、マスター |
| misesapo-prod-public | パブリック（読取のみ） | レポート画像 |
| misesapo-static | パブリック（読取のみ） | Webサイト |

### 8.2 暗号化

- 保存時: サーバーサイド暗号化 (SSE-S3 / Azure SSE)
- 転送時: HTTPS必須

---

## 9. 移行チェックリスト

### Phase 1: データ抽出
- [ ] stores テーブルエクスポート
- [ ] users テーブルエクスポート
- [ ] service_jobs テーブルエクスポート
- [ ] provider_members テーブルエクスポート
- [ ] providers テーブルエクスポート

### Phase 2: データ変換
- [ ] 新ID体系への変換
- [ ] JSON形式への正規化
- [ ] リレーション整合性チェック

### Phase 3: 新システム構築
- [ ] S3バケット作成
- [ ] データアップロード
- [ ] フロントエンド連携

### Phase 4: 検証
- [ ] データ件数照合
- [ ] サンプルデータ確認
- [ ] API動作確認

---

## 10. 変更履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|----------|
| 2025-11-25 | 1.0 | 初版作成 |

---

**作成者**: AI Assistant  
**レビュー**: 要確認


