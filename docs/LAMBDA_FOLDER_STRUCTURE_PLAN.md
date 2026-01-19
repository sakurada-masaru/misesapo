# Lambda関数フォルダ構造計画書

## 📋 現状分析

### 現在の構造
- **ファイル**: `lambda_function.py` (約7000行)
- **関数数**: 99個の関数
- **問題点**: 
  - 1つの巨大なファイルで管理が困難
  - 機能ごとの分離ができていない
  - テストが困難
  - コードの再利用性が低い

### 機能カテゴリ分析

1. **共通ユーティリティ** (10関数)
   - ID生成: `extract_number_from_id`, `get_max_id_number`, `generate_next_id`, `get_max_sequence_for_date`, `generate_schedule_id`
   - バリデーション: `validate_worker_email`
   - S3操作: `convert_to_s3_url`, `upload_photo_to_s3`, `upload_report_photo_with_metadata`
   - 認証: `verify_firebase_token`, `check_admin_permission`

2. **スケジュール管理** (5関数)
   - `create_schedule`, `get_schedules`, `get_schedule_detail`, `update_schedule`, `delete_schedule`

3. **レポート管理** (6関数)
   - `create_report`, `get_reports`, `get_public_report`, `get_report_detail`, `update_report`, `update_report_by_id`, `delete_report`
   - 画像関連: `get_report_images_by_date`, `upload_report_image`, `get_report_images`
   - フィードバック: `save_report_feedback`, `get_report_feedback`

4. **見積もり管理** (5関数)
   - `create_estimate`, `get_estimates`, `get_estimate_detail`, `update_estimate`, `delete_estimate`

5. **従業員管理** (4関数)
   - `get_workers`, `get_worker_detail`, `create_worker`, `update_worker`, `delete_worker`
   - Cognito: `create_cognito_user`

6. **顧客管理** (12関数)
   - 法人: `get_clients`, `create_client`, `get_client_detail`, `update_client`, `delete_client`
   - ブランド: `get_brands`, `create_brand`, `get_brand_detail`, `update_brand`, `delete_brand`
   - 店舗: `get_stores`, `create_store`, `get_store_detail`, `update_store`, `delete_store`

7. **出勤管理** (10関数)
   - `get_attendance`, `create_or_update_attendance`, `get_attendance_detail`, `update_attendance`, `delete_attendance`
   - エラー: `log_attendance_error`, `get_attendance_errors`
   - 申請: `create_attendance_request`, `get_attendance_requests`, `get_attendance_request_detail`, `update_attendance_request`, `delete_attendance_request`

8. **在庫管理** (4関数)
   - `get_inventory_items`, `create_inventory_item`, `update_inventory_item`, `process_inventory_transaction`, `get_inventory_transactions`

9. **お知らせ管理** (7関数)
   - ビジネス: `create_announcement`, `get_announcements`
   - スタッフ: `get_staff_announcements`, `mark_announcement_read`
   - 管理者: `get_admin_announcements`, `create_announcement`, `get_announcement_detail`, `update_announcement`, `delete_announcement`

10. **サービス管理** (5関数)
    - `get_services`, `get_service_detail`, `create_service`, `update_service`, `delete_service`

11. **清掃マニュアル** (3関数)
    - `get_cleaning_manual_data`, `save_cleaning_manual_data`

12. **Wiki** (2関数)
    - `get_wiki_data`, `save_wiki_data`

13. **画像アップロード** (2関数)
    - `handle_image_upload`

14. **ダッシュボード** (1関数)
    - `get_dashboard_stats`

15. **休日管理** (5関数)
    - `get_holidays`, `create_holiday`, `get_holiday_detail`, `update_holiday`, `delete_holiday`

---

## 🎯 提案するフォルダ構造

```
lambda/
├── __init__.py
├── handler.py                    # メインハンドラー（ルーティング）
├── config.py                     # 設定、テーブル定義、環境変数
├── utils/
│   ├── __init__.py
│   ├── id_generator.py          # ID生成関連
│   ├── validators.py            # バリデーション
│   ├── s3_utils.py              # S3操作
│   └── auth.py                  # 認証関連
├── modules/
│   ├── __init__.py
│   ├── schedules.py             # スケジュール管理
│   ├── reports.py               # レポート管理
│   ├── estimates.py             # 見積もり管理
│   ├── workers.py               # 従業員管理
│   ├── clients.py               # 法人管理
│   ├── brands.py                # ブランド管理
│   ├── stores.py                # 店舗管理
│   ├── attendance.py            # 出勤管理
│   ├── inventory.py             # 在庫管理
│   ├── announcements.py         # お知らせ管理
│   ├── services.py              # サービス管理
│   ├── cleaning_manual.py       # 清掃マニュアル
│   ├── wiki.py                  # Wiki
│   ├── images.py                # 画像アップロード
│   ├── dashboard.py             # ダッシュボード
│   └── holidays.py              # 休日管理
└── requirements.txt             # 依存パッケージ
```

---

## 📝 実装計画

### フェーズ1: フォルダ構造の作成と共通モジュールの移行

1. **フォルダ構造の作成**
2. **config.py**: 設定、テーブル定義を移行
3. **utils/**: 共通ユーティリティを移行
   - `id_generator.py`
   - `validators.py`
   - `s3_utils.py`
   - `auth.py`

### フェーズ2: モジュールの移行（機能ごと）

1. **schedules.py**: スケジュール管理
2. **reports.py**: レポート管理
3. **estimates.py**: 見積もり管理
4. **workers.py**: 従業員管理
5. **clients.py, brands.py, stores.py**: 顧客管理
6. **attendance.py**: 出勤管理
7. **inventory.py**: 在庫管理
8. **announcements.py**: お知らせ管理
9. **services.py**: サービス管理
10. **cleaning_manual.py, wiki.py**: その他

### フェーズ3: メインハンドラーの作成

1. **handler.py**: ルーティングロジックを実装
2. 各モジュールからの関数をインポート
3. パスベースのルーティングを実装

### フェーズ4: テストとデプロイ

1. ローカルでの動作確認
2. AWS Lambdaへのデプロイ
3. 動作確認

---

## 🔄 移行手順

### ステップ1: フォルダ構造の作成

```bash
mkdir -p lambda/utils lambda/modules
touch lambda/__init__.py
touch lambda/utils/__init__.py
touch lambda/modules/__init__.py
```

### ステップ2: 各ファイルの作成と移行

各モジュールごとに、元の`lambda_function.py`から該当する関数を抽出して移行。

### ステップ3: インポートの修正

各モジュールで必要なインポートを追加し、依存関係を整理。

### ステップ4: メインハンドラーの実装

`handler.py`でルーティングロジックを実装し、各モジュールの関数を呼び出す。

---

## ⚠️ 注意事項

1. **後方互換性**: 既存のAPIエンドポイントとの互換性を保つ
2. **インポートパス**: Lambda環境でのインポートパスに注意
3. **デプロイ**: ZIPファイルにまとめてデプロイする必要がある
4. **テスト**: 各モジュールの単体テストを実装

---

## 📦 デプロイ方法

### ZIPファイルの作成

```bash
cd lambda
zip -r ../lambda-deployment.zip .
```

### Lambda関数の更新

1. AWS Lambdaコンソールで関数を選択
2. 「コード」タブで「アップロード元」→「.zipファイル」を選択
3. 作成したZIPファイルをアップロード

---

## 🎯 メリット

1. **保守性**: 機能ごとに分離され、保守が容易
2. **テスト**: 各モジュールを個別にテスト可能
3. **再利用性**: 共通関数を複数のモジュールで利用可能
4. **可読性**: ファイルサイズが小さくなり、可読性が向上
5. **拡張性**: 新機能の追加が容易

