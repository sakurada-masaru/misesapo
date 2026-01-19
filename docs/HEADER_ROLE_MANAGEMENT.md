# ヘッダー管理仕様（ロール毎のヘッダー管理）

## 概要

本システムでは、ユーザーのロール（役割）に応じて異なるヘッダーを表示し、IDベースで管理する仕組みを実装しています。

## 実装日

2025年11月9日

## 仕様詳細

### 1. ロール毎のヘッダーファイル

各ロール用のヘッダーファイルを `src/partials/` に配置：

- `header-guest.html` - ゲスト用
- `header-customer.html` - ユーザー（顧客）用
- `header-staff.html` - 清掃員用
- `header-concierge.html` - コンシェルジュ用
- `header-admin.html` - 管理者用
- `header-developer.html` - 開発者用
- `header-master.html` - マスター用

### 2. ヘッダーのID構造

各ヘッダーには以下のIDと属性を設定：

#### ヘッダー要素
- **ID**: `id="header-{role}"`（例：`id="header-admin"`）
- **data-role属性**: `data-role="{role}"`（例：`data-role="admin"`）
- **クラス**: `class="site-header"`

#### ナビゲーション要素
- **ID**: `id="nav-{role}"`（例：`id="nav-admin"`）
- **aria-label**: `aria-label="Primary"`

### 3. ロール名バッジ

各ヘッダーにはロール名を表示するバッジを配置：

```html
<span class="role-badge" style="padding: 4px 12px; background: {bg_color}; color: {text_color}; border-radius: 4px; font-size: 0.875rem; font-weight: 500;">
  {ロール表示名}
</span>
```

#### ロール別の色設定

| ロール | 背景色 | 文字色 | 表示名 |
|--------|--------|--------|--------|
| guest | `#e5e7eb` | `#6b7280` | ゲスト |
| customer | `#dbeafe` | `#1e40af` | ユーザー（顧客） |
| staff | `#dcfce7` | `#166534` | 清掃員 |
| concierge | `#fef3c7` | `#92400e` | コンシェルジュ |
| admin | `#e0e7ff` | `#3730a3` | 管理者 |
| developer | `#fce7f3` | `#831843` | 開発者 |
| master | `#fef2f2` | `#991b1b` | マスター |

### 4. 動的切り替えの仕組み

#### JavaScript実装

`src/assets/js/navigation.js` で実装：

1. **初期化**: ページ読み込み時に現在のロールを取得
2. **ヘッダー切り替え**: `switchHeaderByRole(role)` 関数で以下を実行
   - ヘッダー要素のIDとdata-role属性を更新
   - ナビゲーションコンテナのIDを更新
   - ロール名バッジのテキストと色を更新
   - ログイン/ログアウトボタンの表示制御
   - ナビゲーション項目の生成

3. **ナビゲーション生成**: `renderNavigation(containerId, role)` 関数で以下を実行
   - `role_config.js` からロールに応じたナビゲーション項目を取得
   - 各項目を `<a>` 要素として生成
   - アイコン、アクティブ状態、パス解決を処理

#### レイアウトへの統合

`src/layouts/base.html` で以下を読み込み：

```html
<script src="/js/role_config.js"></script>
<script src="/js/auth.js"></script>
<script src="/js/navigation.js"></script>
```

読み込み順序：
1. `role_config.js` - ロール設定とナビゲーション定義
2. `auth.js` - 認証情報とロール取得
3. `navigation.js` - ヘッダー切り替えとナビゲーション生成

### 5. デフォルトヘッダー

レイアウトでは `@include('partials.header')` でデフォルトのヘッダー（`header-guest.html` 相当）をインクルードし、JavaScriptで動的に切り替えます。

### 6. ログイン/ログアウト制御

- **ゲスト（未ログイン）**: ログイン・新規登録リンクを表示、ログアウトボタンを非表示
- **ログイン済み**: ログアウトボタンを表示、ログイン・新規登録リンクを非表示

### 7. ナビゲーション項目の管理（推奨ナビゲーション）

ナビゲーション項目は `src/assets/js/role_config.js` の `ROLE_CONFIG.navigation` オブジェクトで定義：

#### 各ロールの推奨ナビゲーション項目

**guest（ゲスト）**:
- 発注 (`/index.html`)
- サービス一覧 (`/service.html`)
- コンシェルジュ (`/concierge.html`)
- お問い合わせ (`/contact.html`)

**customer（ユーザー・顧客）**:
- マイページ (`/mypage.html`)
- 発注 (`/index.html`)
- サービス一覧 (`/service.html`)
- カート (`/cart.html`)
- 注文履歴 (`/order/history.html`)
- スケジュール (`/schedule.html`)
- レポート一覧 (`/report.html`)

**staff（清掃員）**:
- ダッシュボード (`/staff/dashboard.html`)
- スケジュール (`/staff/schedule.html`)
- 作業一覧 (`/staff/assignments.html`)
- レポート作成 (`/staff/reports/new.html`)
- トレーニング (`/staff/training.html`)

**concierge（コンシェルジュ）**:
- ダッシュボード (`/sales/dashboard.html`)
- 顧客管理 (`/sales/clients.html`)
- 新規顧客登録 (`/sales/clients/new.html`)
- 見積もり一覧 (`/sales/estimates.html`)
- 見積もり作成 (`/sales/estimates/new.html`)
- スケジュール (`/sales/schedule.html`)
- 発注管理 (`/sales/orders.html`)

**admin（管理者）**:
- ダッシュボード (`/admin/dashboard.html`)
- サービス管理 (`/admin/services.html`)
- 新規サービス登録 (`/admin/services/new.html`)
- 顧客管理 (`/admin/clients.html`)
- 発注管理 (`/admin/orders.html`)
- ユーザー管理 (`/admin/users.html`)
- サイトマップ (`/admin/sitemap.html`)

**developer（開発者）**:
- ダッシュボード (`/admin/dashboard.html`)
- サービス管理 (`/admin/services.html`)
- 変更レビュー (`/admin/services/review.html`)
- 画像管理 (`/admin/images.html`)
- 顧客管理 (`/admin/clients.html`)
- 発注管理 (`/admin/orders.html`)
- ユーザー管理 (`/admin/users.html`)
- サイトマップ (`/admin/sitemap.html`)

**master（マスター）**:
- ダッシュボード (`/admin/dashboard.html`)
- サイトマップ (`/admin/sitemap.html`)
- （ドロップダウンリストで全ページにアクセス可能）

### 8. ファイル構成

```
src/
├── partials/
│   ├── header.html              # デフォルトヘッダー（ゲスト用）
│   ├── header-guest.html         # ゲスト用ヘッダー
│   ├── header-customer.html      # ユーザー（顧客）用ヘッダー
│   ├── header-staff.html         # 清掃員用ヘッダー
│   ├── header-concierge.html     # コンシェルジュ用ヘッダー
│   ├── header-admin.html         # 管理者用ヘッダー
│   ├── header-developer.html     # 開発者用ヘッダー
│   └── header-master.html        # マスター用ヘッダー
├── assets/
│   └── js/
│       ├── role_config.js        # ロール設定とナビゲーション定義
│       ├── auth.js               # 認証管理
│       └── navigation.js         # ヘッダー切り替えとナビゲーション生成
└── layouts/
    └── base.html                 # ベースレイアウト（ヘッダーをインクルード）
```

### 9. ビルドプロセス

`scripts/build.py` の `copy_assets()` 関数により、`src/assets/js/navigation.js` が自動的に `public/js/navigation.js` にコピーされます。

### 10. 使用方法

#### 新しいロールを追加する場合

1. `src/partials/header-{newrole}.html` を作成
2. `src/assets/js/role_config.js` の `ROLE_CONFIG.roles` と `ROLE_CONFIG.navigation` に追加
3. `src/assets/js/navigation.js` の `badgeColors` オブジェクトに色設定を追加

#### ナビゲーション項目を変更する場合

`src/assets/js/role_config.js` の `ROLE_CONFIG.navigation.{role}` 配列を編集

#### ヘッダーのスタイルを変更する場合

各 `header-{role}.html` ファイルを直接編集、または `src/assets/css/style.css` で共通スタイルを定義

## 技術的な詳細

### ID命名規則

- ヘッダーID: `header-{role}`
- ナビゲーションID: `nav-{role}`
- 一貫性を保つため、ロール名は小文字で統一

### パス解決

GitHub Pages対応のため、`navigation.js` 内でベースパスを考慮したパス解決を実装：

```javascript
function resolvePath(path) {
  const basePath = getBasePath();
  if (path.startsWith('/')) {
    return basePath === '/' ? path : basePath.slice(0, -1) + path;
  }
  return basePath === '/' ? '/' + path : basePath + path;
}
```

### アクティブ状態の判定

現在のページパスとナビゲーション項目の `href` を比較して、アクティブ状態を判定：

```javascript
if (normalizedPath === item.href || normalizedPath === item.href.replace('.html', '')) {
  link.classList.add('active');
  link.setAttribute('aria-current', 'page');
}
```

## 注意事項

1. **ロール名の一貫性**: ロール名は `role_config.js`、ヘッダーファイル名、ID名で一貫性を保つ
2. **JavaScriptの読み込み順序**: `role_config.js` → `auth.js` → `navigation.js` の順序を維持
3. **ビルド後の確認**: ビルド後、`public/js/navigation.js` が正しくコピーされているか確認
4. **デフォルトヘッダー**: レイアウトでインクルードする `header.html` はゲスト用を想定

## 関連ファイル

- `src/partials/header*.html` - ヘッダーテンプレート
- `src/assets/js/navigation.js` - ヘッダー切り替えロジック
- `src/assets/js/role_config.js` - ロール設定とナビゲーション定義
- `src/assets/js/auth.js` - 認証管理
- `src/layouts/base.html` - ベースレイアウト
- `scripts/build.py` - ビルドスクリプト

## 注意事項・例外

### index.html（トップページ）の扱い

**`/index.html` はロール毎のヘッダー管理システムの対象外**として扱います。

- **理由**: `index.html` はパブリック向けのランディングページとして機能しており、独自のヘッダー・フッター構造を持っています
- **実装**: `base.html` レイアウトを使用せず、完全に独立したHTML構造を維持
- **影響**: ロール毎のヘッダー切り替え機能は適用されません
- **アクセス**: 全ロール（guest, customer, staff, concierge, admin, developer, master）がアクセス可能

### その他のページ

`index.html` 以外のページは `base.html` レイアウトを使用し、ロール毎のヘッダー管理システムが適用されます。

## 更新履歴

- 2025年11月9日: 初版作成（ロール毎のヘッダー管理仕様）
- 2025年11月9日: index.htmlの扱いを追記（ロール毎のヘッダー管理システムの対象外）

