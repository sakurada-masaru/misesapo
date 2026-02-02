# ミセサポ データ分析レポート

**作成日**: 2025年11月26日  
**目的**: エクスポートしたJSONデータの構造分析と機能マッピング

---

## 1. エクスポートデータ一覧

| ファイル | テーブル | 件数 | 説明 |
|----------|---------|------|------|
| stores.json | stores | 195 | 店舗マスター |
| users.json | users | 164 | ユーザー（顧客/清掃員/営業/管理者） |
| schedules.json | service_jobs | 2046 | スケジュール（定期/スポット契約） |
| workers（DynamoDB） | workers | — | 清掃員・従業員（正のソースは DynamoDB。workers.json は廃止） |
| providers.json | providers | 1 | パートナー企業 |
| services.json | items | 32 | サービス種別マスター |
| store_services.json | store_items | 917 | 店舗×サービス紐付け |
| reports.json | task_item_reports | 1945 | 作業レポート |
| tasks.json | service_tasks | 1864 | 実行タスク（スケジュールの実績） |

---

## 2. データ構造詳細

### 2.1 stores.json（店舗）

```json
{
  "id": "16",
  "name": "Darts Bar A's 神楽坂店",
  "group_id": "1",                    // 企業グループID
  "postcode": "1620825",
  "pref": "東京都",
  "city": "新宿区",
  "address1": "神楽坂1-10",
  "address2": "神楽坂アイダビル4F",
  "phone": "03-6457-5797",
  "report_email": null,               // レポート送信先
  "administrator_id": "16",           // 管理者ユーザーID
  "description": "ダーツバーA's",
  "note": null
}
```

**利用シーン:**
- 清掃員ダッシュボード: 作業先の店舗情報表示
- 営業ダッシュボード: 顧客店舗一覧
- 管理者: 店舗管理

---

### 2.2 schedules.json（スケジュール）

```json
{
  "id": "15",
  "store_id": "16",                   // 店舗ID → stores.json
  "store_item_id": "6",               // 店舗サービスID → store_services.json
  "name": "カーペット洗浄",
  "default_worker_ids": "[0]",        // 担当清掃員ID（JSON配列）
  "regular_order": "0",               // 定期契約フラグ（0:スポット, 1:定期）
  "interval": "0",                    // 定期間隔（日数）
  "week_day": "[]",                   // 曜日指定（JSON配列）
  "desired_date": "2023-11-08",       // 希望日
  "desired_time": "PM1",              // 希望時間帯
  "start_date": "0000-00-00",         // 契約開始日
  "end_date": "9999-12-31",           // 契約終了日
  "service_weekday": null,            // サービス曜日
  "service_week": null                // サービス週
}
```

**利用シーン:**
- 清掃員ダッシュボード: 本日/今週のスケジュール
- 営業ダッシュボード: 担当顧客のスケジュール
- 管理者: スケジュール作成・編集

**注意点:**
- `default_worker_ids` はJSON文字列（パース必要）
- `desired_time` は "AM", "PM1", "PM2" などの文字列

---

### 2.3 services.json（サービス種別）

```json
{
  "id": "1",
  "name": "グリストラップ",
  "conditions": "[{...}]",            // 入力フォーム定義（JSON）
  "icon_url": "https://misesapo-prod-public.s3.../icons/icon_greasetrap.svg",
  "type": "1"
}
```

**サービス一覧（32種類）:**
- グリストラップ、床、換気扇、エアコン、厨房機器、シンク、キッチン...

**利用シーン:**
- サービス管理画面
- 見積もり作成時のサービス選択
- レポートのサービス種別表示

---

### 2.4 reports.json（作業レポート）

```json
{
  "id": "1",
  "task_id": "3",                     // タスクID → tasks.json
  "store_item_id": "6",               // 店舗サービスID
  "store_id": "16",                   // 店舗ID
  "provider_id": "1",                 // パートナーID
  "worker_id": null,                  // 清掃員ID
  "name": "カーペット洗浄",
  "before_pictures": "[\"https://...reports/1/before/carpet01.png\"]",
  "after_pictures": "[\"https://...reports/1/after/carpet02.png\"]",
  "other_pictures": null,
  "comment": null,
  "send_at": null                     // 送信日時
}
```

**利用シーン:**
- 清掃員: レポート作成
- 顧客: レポート閲覧
- 管理者: レポート管理

**注意点:**
- `before_pictures`, `after_pictures` はJSON文字列（S3 URL配列）
- S3の `reports/{id}/before/`, `reports/{id}/after/` と対応

---

### 2.5 tasks.json（実行タスク）

```json
{
  "id": "3",
  "job_id": "15",                     // スケジュールID → schedules.json
  "store_id": "16",
  "provider_id": "1",
  "worker_ids": null,                 // 実際の担当者
  "name": "カーペット洗浄",
  "scheduled_start_at": "2023-11-08 13:00:00",
  "scheduled_end_at": "2023-11-08 17:00:00",
  "start_at": "2023-11-08 13:00:00",  // 実際の開始
  "end_at": "2023-11-08 17:00:00",    // 実際の終了
  "customer_comment": null,
  "rating": null,
  "item_ids": "[6]"                   // サービスID配列
}
```

**利用シーン:**
- 清掃員: 作業詳細、作業開始/完了
- 顧客: 作業履歴
- 管理者: 実績管理

---

## 3. リレーション図

```
stores (195)
    │
    ├── administrator_id → users (164)
    │
    ├── store_items (917) ← item_id → items/services (32)
    │       │
    │       └── store_item_id
    │               │
    │               ▼
    └── service_jobs/schedules (2046)
            │
            ├── default_worker_ids → provider_members/workers (4)
            │
            └── job_id
                    │
                    ▼
            service_tasks/tasks (1864)
                    │
                    └── task_id
                            │
                            ▼
                    task_item_reports/reports (1945)
                            │
                            └── before_pictures, after_pictures
                                    │
                                    ▼
                            S3: reports/{id}/before/, after/
```

---

## 4. 機能別データマッピング

### 4.1 清掃員ダッシュボード

| 機能 | 必要データ | 結合キー |
|------|-----------|----------|
| 次の作業 | tasks + stores | task.store_id = store.id |
| 本日の予定 | tasks (今日の日付でフィルター) | - |
| 作業詳細 | tasks + stores + services | 複合 |
| レポート作成 | reports (新規作成) | task_id |

### 4.2 営業ダッシュボード

| 機能 | 必要データ | 結合キー |
|------|-----------|----------|
| 担当顧客一覧 | stores | (sales_idが必要→未実装) |
| スケジュール | schedules + stores | schedule.store_id |
| 見積もり | (未実装) | - |

### 4.3 管理者ダッシュボード

| 機能 | 必要データ | 結合キー |
|------|-----------|----------|
| 店舗管理 | stores | - |
| ユーザー管理 | users + workers | worker.user_id |
| スケジュール管理 | schedules + stores + workers | 複合 |
| レポート管理 | reports + tasks + stores | 複合 |
| サービス管理 | services | - |

---

## 5. 不足データ・課題

### 5.1 不足しているフィールド

| テーブル | 不足フィールド | 用途 |
|----------|---------------|------|
| users | role | ユーザー種別（顧客/清掃員/営業/管理者） |
| users | phone | 連絡先 |
| stores | sales_id | 担当営業 |
| schedules | status | ステータス（予定/進行中/完了/キャンセル） |
| workers | name, skills, area | 清掃員詳細情報 |

### 5.2 不足しているテーブル

| テーブル | 用途 |
|----------|------|
| contracts | 契約情報（定期契約の詳細） |
| estimates | 見積もり |
| notifications | 通知 |
| messages | メッセージ履歴 |

### 5.3 データ品質の課題

- `default_worker_ids` が `"[0]"` のデータが多い（未アサイン）
- `start_date` が `"0000-00-00"` のデータがある
- `worker_id` が null のレポートが存在

---

## 6. 推奨アクション

### Phase 1: 現状データで実装可能な機能

1. **店舗一覧表示** - stores.json
2. **サービス一覧表示** - services.json
3. **スケジュール一覧表示** - schedules.json + stores.json
4. **レポート一覧表示** - reports.json + stores.json
5. **レポート詳細（写真付き）** - reports.json + S3画像

### Phase 2: データ補完が必要な機能

1. **ユーザーロール管理** - users.jsonにroleフィールド追加
2. **清掃員詳細** - DynamoDB workers に name, skills 等（workers.json は廃止）
3. **担当営業紐付け** - stores.jsonにsales_id追加

### Phase 3: 新規テーブルが必要な機能

1. **見積もり管理** - estimates テーブル新規作成
2. **契約管理** - contracts テーブル新規作成
3. **通知機能** - notifications テーブル新規作成

---

## 7. 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2025-11-26 | 初版作成、全テーブル分析完了 |



