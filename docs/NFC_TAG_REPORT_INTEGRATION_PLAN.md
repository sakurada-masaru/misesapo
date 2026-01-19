# NFCタグ × レポート自動生成システム - 実装プラン

## 📋 概要

NFCタグを読み取ることで、場所ごとに写真とコメントを入力し、自動的にレポートに統合するシステムの実装プランです。

## 🎯 目標

- 清掃員が各場所でタグを読み取り、その場で写真とコメントを入力
- 入力されたデータが自動的にレポートの該当セクションに追加
- 複数の場所のデータを自動的に統合してレポートを完成

## 📊 システム構成

### データフロー

```
1. NFCタグ読み取り
   ↓
2. タグIDから場所情報を取得（DynamoDB: nfc-tags）
   ↓
3. 場所専用フォームを表示
   ↓
4. 写真とコメントを入力
   ↓
5. 下書きレポートに自動追加（DynamoDB: reports-draft）
   ↓
6. レポート完成時に統合
```

## 🗂️ データ構造の拡張

### 1. `nfc-tags` テーブルの拡張

既存のフィールドに以下を追加：

```json
{
  "tag_id": "TOILET_001",
  "facility_id": "ABC_001",
  "location_id": "TK_R01_TOILET_IN",
  "facility_name": "新宿店",
  "location_name": "トイレ入口",
  "description": "1階トイレ入口",
  
  // 新規追加フィールド
  "report_section_type": "cleaning_item",  // レポートセクションタイプ
  "section_title": "トイレ清掃",           // セクションタイトル
  "default_comment_template": "トイレ清掃完了",  // デフォルトコメントテンプレート
  "required_photos": 2,                    // 必須写真数
  "photo_category": "after",               // 写真カテゴリ（before/after）
  "created_at": "2025-01-15T10:00:00Z",
  "updated_at": "2025-01-15T10:00:00Z"
}
```

### 2. 下書きレポート構造

```json
{
  "report_id": "DRAFT_001",
  "user_id": "WKR_001",
  "brand_id": "BRAND_001",
  "brand_name": "テストブランド",
  "store_id": "STORE_001",
  "store_name": "新宿店",
  "cleaning_date": "2025-01-15",
  "start_time": "09:00",
  "end_time": "12:00",
  "status": "draft",  // draft, in_progress, completed
  "sections": [
    {
      "section_id": "section-1",
      "location_id": "TOILET_001",
      "location_name": "トイレ入口",
      "section_type": "cleaning_item",
      "title": "トイレ清掃",
      "photos": [
        {
          "url": "https://s3.../photo1.jpg",
          "category": "after",
          "uploaded_at": "2025-01-15T10:30:00Z"
        }
      ],
      "comment": "トイレ清掃完了",
      "created_at": "2025-01-15T10:30:00Z",
      "updated_at": "2025-01-15T10:30:00Z"
    },
    {
      "section_id": "section-2",
      "location_id": "KITCHEN_001",
      "location_name": "台所",
      "section_type": "cleaning_item",
      "title": "台所清掃",
      "photos": [...],
      "comment": "台所清掃完了",
      "created_at": "2025-01-15T10:45:00Z",
      "updated_at": "2025-01-15T10:45:00Z"
    }
  ],
  "created_at": "2025-01-15T09:00:00Z",
  "updated_at": "2025-01-15T10:45:00Z"
}
```

## 🚀 実装ステップ

### Phase 1: 基盤整備（1-2日）

#### 1.1 DynamoDBテーブルの拡張
- [ ] `nfc-tags`テーブルにレポート関連フィールドを追加
- [ ] `reports-draft`テーブルを作成（既存の`reports`テーブルと同構造）

#### 1.2 Lambda関数の拡張
- [ ] `get_nfc_tag_info`関数を拡張（レポート関連情報を含める）
- [ ] `create_draft_report`関数を追加（下書きレポート作成）
- [ ] `add_section_to_draft`関数を追加（セクション追加）
- [ ] `get_draft_report`関数を追加（下書きレポート取得）
- [ ] `update_draft_report`関数を追加（下書きレポート更新）

#### 1.3 API Gatewayエンドポイント追加
- [ ] `POST /staff/reports/draft` - 下書きレポート作成
- [ ] `GET /staff/reports/draft` - 下書きレポート取得
- [ ] `PUT /staff/reports/draft` - 下書きレポート更新
- [ ] `POST /staff/reports/draft/sections` - セクション追加

### Phase 2: NFCタグ読み取りフォーム（2-3日）

#### 2.1 専用フォームページ作成
- [ ] `/staff/nfc-location-form.html` を作成
  - タグIDから場所情報を取得
  - 写真アップロード機能（複数枚）
  - コメント入力
  - 送信ボタン

#### 2.2 フォーム機能実装
- [ ] 写真アップロード（S3へのアップロード）
- [ ] 写真プレビュー
- [ ] コメント入力バリデーション
- [ ] 送信処理（下書きレポートに追加）

#### 2.3 NFCタグ読み取り処理の拡張
- [ ] `/staff/nfc-redirect` ページを作成
  - タグIDから場所情報を取得
  - 下書きレポートを取得または作成
  - フォームページにリダイレクト（`tag_id`と`draft_report_id`を渡す）

### Phase 3: レポート統合機能（2-3日）

#### 3.1 レポート作成画面の拡張
- [ ] 下書きレポートからセクションを読み込む機能
- [ ] 下書きレポートのセクションを表示
- [ ] 手動セクション追加との統合

#### 3.2 レポート完成処理
- [ ] 下書きレポートを正式レポートに変換
- [ ] セクションの統合処理
- [ ] 下書きレポートの削除またはアーカイブ

### Phase 4: UI/UX改善（1-2日）

#### 4.1 フォームUI改善
- [ ] レスポンシブデザイン
- [ ] 写真アップロードの進捗表示
- [ ] エラーハンドリングとメッセージ表示

#### 4.2 レポート作成画面の改善
- [ ] 下書きセクションの視覚的区別
- [ ] セクションの編集機能
- [ ] セクションの削除機能

### Phase 5: テストと改善（1-2日）

#### 5.1 機能テスト
- [ ] NFCタグ読み取り → フォーム表示 → 送信の流れ
- [ ] 複数場所のデータ統合
- [ ] レポート完成処理

#### 5.2 エラーハンドリング
- [ ] ネットワークエラー
- [ ] 認証エラー
- [ ] データ不整合エラー

## 📝 実装詳細

### 1. NFCタグ読み取りフォームページ

**URL**: `/staff/nfc-location-form.html?tag_id=TOILET_001&draft_report_id=DRAFT_001`

**機能**:
- 場所情報の表示（施設名、場所名）
- 写真アップロード（複数枚、作業後写真）
- コメント入力
- 送信ボタン

**処理フロー**:
1. ページ読み込み時に`tag_id`と`draft_report_id`を取得
2. タグ情報を取得（`GET /staff/nfc/tag?tag_id=TOILET_001`）
3. 下書きレポートを取得（`GET /staff/reports/draft?report_id=DRAFT_001`）
4. フォームを表示
5. 送信時にセクションを追加（`POST /staff/reports/draft/sections`）

### 2. 下書きレポート管理

**作成タイミング**:
- 最初のNFCタグ読み取り時
- レポート作成画面で「新規作成」を選択した時

**更新タイミング**:
- 各場所でフォーム送信時
- レポート作成画面で手動セクション追加時

**完成タイミング**:
- レポート作成画面で「レポートを提出」ボタンを押した時

### 3. セクション統合ロジック

**統合方法**:
1. 下書きレポートのセクションを取得
2. レポート作成画面のセクションと統合
3. 重複チェック（同じ`location_id`のセクションが既にある場合は更新）
4. 正式レポートに変換

## 🔧 技術的な考慮事項

### 1. 写真アップロード
- S3への直接アップロード（Presigned URL使用）
- アップロード進捗の表示
- エラー時のリトライ機能

### 2. オフライン対応
- ローカルストレージに一時保存
- オンライン復帰時に自動アップロード

### 3. パフォーマンス
- 写真のリサイズと圧縮
- バッチアップロード
- キャッシュの活用

## 📅 実装スケジュール

| Phase | 期間 | 優先度 |
|-------|------|--------|
| Phase 1: 基盤整備 | 1-2日 | 高 |
| Phase 2: NFCタグ読み取りフォーム | 2-3日 | 高 |
| Phase 3: レポート統合機能 | 2-3日 | 高 |
| Phase 4: UI/UX改善 | 1-2日 | 中 |
| Phase 5: テストと改善 | 1-2日 | 高 |

**合計**: 7-12日

## 🎯 次のステップ

1. **Phase 1から開始**: DynamoDBテーブルの拡張とLambda関数の実装
2. **段階的な実装**: 各Phaseを順番に実装し、動作確認しながら進める
3. **テスト**: 各Phase完了時にテストを実施

## 📚 関連ドキュメント

- [NFCタグ打刻システム - セットアップガイド](./NFC_CLOCK_IN_SETUP.md)
- [NFCタグトリガー方式セットアップガイド](./NFC_TAG_TRIGGER_SETUP.md)
- [レポート作成システム仕様](./ADMIN_REPORT_CREATION_UI.md)

