# 実装TODOリスト

最終更新: 2025年3月

## 優先度：中（推奨）

### サポートデスク Phase 2
1. **ヘルプセンター** (`/mypage/support/help.html`)
   - 拡張ナレッジベース機能
   - カテゴリ別ヘルプ記事
   - 検索機能、人気記事、関連記事、記事評価

2. **利用ガイド** (`/mypage/support/guides.html`)
   - 初めての方へ（ステップバイステップ）
   - サービス別の使い方
   - 動画チュートリアル（YouTube埋め込みなど）

3. **お知らせページ** (`/mypage/support/news.html`)
   - サービス更新、メンテナンス情報
   - カテゴリ別（重要、更新、メンテナンス、お役立ち）
   - 既読管理

4. **サポート検索** (`/mypage/support/search.html`)
   - サポート記事、FAQ、お問い合わせ履歴の統合検索
   - 検索履歴、よく検索されるキーワード

---

## 優先度：中

### 詳細ページ
5. **清掃員の作業詳細** (`/staff/assignments/[id].html`)
   - 作業割り当ての詳細情報表示
   - 作業内容、スケジュール、顧客情報

6. **営業マンの新規顧客登録** (`/sales/clients/new.html`)
   - 顧客情報登録フォーム
   - CSVデータ構造に合わせた項目

---

## 優先度：低

### 機能拡張
7. **見積もりフィルター機能**
   - 下書き一覧 (`/sales/estimates/draft`)
   - 送付済み見積もり (`/sales/estimates/sent`)
   - 承認済み見積もり (`/sales/estimates/approved`)

8. **管理者向けユーザー管理詳細**
   - 顧客一覧（ユーザー管理内） (`/admin/users/customers`)
   - 清掃員一覧 (`/admin/users/staff`)
   - 営業マン一覧 (`/admin/users/sales`)

---

## 完了済み

### ✅ サポートデスク Phase 1
- サポートセンター（親ページ・ハブ）
- FAQページ（ナレッジベース）
- お問い合わせ履歴（チケット管理）
- 新規お問い合わせ（チケット作成）
- 緊急連絡先ページ（マルチチャネル）

### ✅ 営業マン向け顧客管理
- 顧客一覧 (`/sales/clients.html`)
- 顧客詳細 (`/sales/clients/[id].html`)
- 見積もり詳細 (`/sales/estimates/[id].html`)

### ✅ 情報編集ページ
- 会社基本情報編集 (`/mypage/company/edit.html`)
- 店舗情報編集 (`/mypage/store/edit.html`)

### ✅ 管理者向け
- 顧客一覧（3カラムレイアウト） (`/admin/clients.html`)

---

## 実装メモ

### データ構造
- 顧客情報は **API（DynamoDB）を正** とする（`/clients` `/brands` `/stores`）
- 動的ページ生成は `scripts/build.py` の `_build_client_detail_pages` 関数を使用

### デザイン方針
- SPメイン：ユーザー向け、清掃員向け、営業マン向け
- PCメイン：管理者向け
- ピンク（`var(--primary)`）をアクセントカラーとして使用

