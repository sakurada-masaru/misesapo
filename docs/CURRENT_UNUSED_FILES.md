# 現在不要なファイル一覧（2025年12月10日時点）

**目的**: 現在のシステムで実際に存在し、削除可能なファイルを洗い出し

---

## ✅ 即座に削除可能なファイル

### 1. テストページ（1ファイル）
- **`src/pages/header-test.html`** - ヘッダーのテストページ
  - **理由**: テスト用のページであり、本番環境では不要

### 2. WordPressテンプレート（13ファイル）
現在のシステムはWordPressを使用していないため、以下のファイルは削除対象です：

- **`wordpress-templates/contact-box-section.php`**
- **`wordpress-templates/fixed-order-button-html-only.html`**
- **`wordpress-templates/fixed-order-button.php`**
- **`wordpress-templates/header-mega-menu-switch-html-only.html`**
- **`wordpress-templates/header-only-html.html`**
- **`wordpress-templates/header-switch-html-only.html`**
- **`wordpress-templates/hero-section-html-only.html`**
- **`wordpress-templates/hero-section-no-animation.php`**
- **`wordpress-templates/hero-section-with-animation-html-only.html`**
- **`wordpress-templates/hero-section.php`**
- **`wordpress-templates/mega-menu.php`**
- **`wordpress-templates/problem-section.php`**
- **`wordpress-templates/scroll-hint.php`**

**理由**: WordPressを使用していないため、これらのテンプレートは不要

---

## ⚠️ 確認後に削除可能なファイル

### 1. 未使用JSONデータ（確認が必要）
以下のJSONファイルは、コード内で参照されているか確認が必要です：

- **`src/data/staff_assignments.json`** - 使用箇所を確認
- **`src/data/new_inquiries.json`** - 使用箇所を確認
- **`src/data/sales_schedule.json`** - バックアップファイルでのみ使用されている可能性

### 2. 重複ページ（確認が必要）
以下のページは重複している可能性があります：

- **`src/pages/規約/privacy-policy.html`** - `privacy-policy.html` が使用されているため削除可能の可能性
- **`src/pages/規約/anti-social-forces-declaration.html`** - `antisocial-declaration.html` が使用されているため削除可能の可能性
- **`src/pages/規約/information-security-policy.html`** - `security-policy.html` が使用されているため削除可能の可能性

---

## 📊 削除可能ファイルの合計

| カテゴリ | ファイル数 | 状態 |
|---------|-----------|------|
| テストページ | 1 | ✅ 即座に削除可能 |
| WordPressテンプレート | 13 | ✅ 即座に削除可能 |
| 未使用JSONデータ | 3 | ⚠️ 確認後に削除 |
| 重複ページ | 3 | ⚠️ 確認後に削除 |
| **合計** | **20ファイル** | |

---

## 🎯 推奨アクション

### 即座に削除可能（14ファイル）
1. **テストページ（1ファイル）**
   - `src/pages/header-test.html`

2. **WordPressテンプレート（13ファイル）**
   - `wordpress-templates/` ディレクトリ全体を削除

### 確認後に削除（6ファイル）
3. **未使用JSONデータ（3ファイル）**
   - コード内での使用箇所を確認後、未使用であれば削除

4. **重複ページ（3ファイル）**
   - 実際の使用状況を確認後、重複していれば削除

---

## 📝 備考

- **WordPressテンプレート**: 完全に不要なため、`wordpress-templates/` ディレクトリ全体を削除することを推奨
- **テストページ**: 本番環境では使用されていないため、削除可能
- **未使用JSONデータ**: コード内での参照を確認してから削除することを推奨
- **重複ページ**: 実際の使用状況を確認してから削除することを推奨

---

**最終更新**: 2025年12月10日

