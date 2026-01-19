# ミセサポ プロジェクト概要

**最終更新**: 2025年11月25日  
**バージョン**: 1.0

---

## 📋 目次

1. [システム概要](#システム概要)
2. [ページ構成](#ページ構成)
3. [ディレクトリ構造](#ディレクトリ構造)
4. [技術スタック](#技術スタック)
5. [ドキュメント構成](#ドキュメント構成)
6. [開発・デプロイフロー](#開発デプロイフロー)

---

## システム概要

### 目的
店舗清掃サービス「ミセサポ」のWebアプリケーション。顧客・清掃員・営業・管理者向けの各機能を提供する。

### 主要機能
- **顧客向け**: サービス発注、レポート確認、スケジュール管理、マイページ
- **清掃員向け**: 作業割り当て確認、レポート作成、スケジュール管理、研修動画視聴
- **営業向け**: 顧客管理、見積もり作成、スケジュール管理、コンシェルジュ機能
- **管理者向け**: 全ユーザー管理、発注管理、サービス管理、レポート管理

### 認証・権限
- Firebase Authentication（将来的にAWS Cognito移行検討中）
- ロールベースアクセス制御（顧客/清掃員/営業/管理者）

---

## ページ構成

### パブリックサイト（未認証）
```
/ (index.html)
├── ヒーローセクション
├── サービス一覧（カテゴリ別）
├── キャンペーン
├── イベント出店情報
├── 導入事例
├── お客様の声
├── 資料ダウンロード
├── 対応エリア
├── FAQ
└── ご利用イメージ

/signin.html          # ログイン
/signup.html          # 新規登録（ステップ1）
/signup2.html         # 新規登録（ステップ2）
/signup3.html         # 新規登録（ステップ3）
/reset-password.html  # パスワードリセット
/lp.html              # ランディングページ
/service.html         # サービス詳細
/voice.html           # お客様の声
/customers.html       # 導入店舗一覧
/about.html           # 会社概要
/recruit.html         # 採用情報
/announcements.html   # お知らせ
```

### 顧客向けサイト
```
/mypage.html                    # ダッシュボード
├── /mypage/info.html          # オーナー情報
│   ├── /mypage/company/edit.html
│   └── /mypage/store/edit.html
├── /mypage/support.html       # サポートセンター
│   ├── /mypage/support/faq.html
│   ├── /mypage/support/tickets.html
│   ├── /mypage/support/inquiry/new.html
│   └── /mypage/support/contact.html
├── /cart.html                 # カート
├── /checkout.html             # 決済確認
├── /order-complete.html       # 発注完了
├── /order/history.html        # 発注履歴
├── /report.html               # レポート一覧
├── /reports/[id].html         # レポート詳細
└── /schedule.html             # スケジュール一覧
```

### 清掃員向けサイト
```
/staff/dashboard.html          # ダッシュボード
├── /staff/assignments.html    # 作業割り当て一覧
├── /staff/reports/new.html    # レポート作成
├── /staff/schedule.html       # スケジュール
└── /staff/training.html       # 研修動画アーカイブ
```

### 営業向けサイト
```
/concierge.html                # コンシェルジュ（TOP）
├── /sales/dashboard.html      # ダッシュボード
├── /sales/clients.html        # 顧客一覧
│   ├── /sales/clients/[id].html
│   ├── /sales/clients/new.html
│   └── /sales/clients/[id]/edit.html
├── /sales/estimates.html      # 見積もり一覧
│   ├── /sales/estimates/new.html
│   └── /sales/estimates/[id].html
├── /sales/orders.html         # 発注管理
└── /sales/schedule.html       # スケジュール管理
```

### 管理者向けサイト
```
/admin/sitemap.html            # サイトマップ
├── /admin/dashboard.html      # ダッシュボード
├── /admin/clients.html        # 顧客一覧
├── /admin/users.html          # ユーザー管理
│   ├── /admin/users/customers.html
│   ├── /admin/users/staff.html
│   └── /admin/users/sales.html
├── /admin/orders.html         # 発注管理
├── /admin/services.html       # サービス管理
│   └── /admin/services/new.html
└── /admin/reports.html        # レポート管理
```

---

## ディレクトリ構造

```
misesapo-main/
├── src/                       # ソースファイル
│   ├── pages/                 # ページHTML（103ファイル）
│   ├── layouts/               # レイアウトテンプレート
│   ├── partials/              # 共通パーツ（18ファイル）
│   ├── assets/                # アセット
│   │   ├── css/               # スタイルシート
│   │   ├── js/                # JavaScript
│   │   └── images/            # 画像（742ファイル）
│   └── data/                  # データファイル（147ファイル）
│       └── *.json             # JSONデータ
│
├── public/                    # ビルド成果物（自動生成）
│   ├── *.html                 # 生成されたHTML
│   ├── css/                   # コピーされたCSS
│   ├── js/                    # コピーされたJS
│   └── images/                # コピーされた画像
│
├── docs/                      # ドキュメント（150+ファイル）
│   ├── DOCUMENTATION_INDEX.md # ドキュメントインデックス
│   ├── PAGE_SPECIFICATIONS.md # ページ仕様書
│   └── [カテゴリ別ドキュメント]
│
├── scripts/                   # ビルド・デプロイスクリプト
│   ├── build.py               # ビルドスクリプト
│   └── dev_server.py          # 開発サーバー
│
├── nginx/                     # Nginx設定
├── Dockerfile                 # Docker設定
├── README.md                  # プロジェクト説明
└── AGENTS.md                  # 開発ガイドライン
```

---

## 技術スタック

### フロントエンド
- **HTML/CSS/JavaScript**: バニラJS（フレームワーク不使用）
- **テンプレートエンジン**: カスタム（`@layout`, `@include`, `@json`, `@foreach`）
- **ビルドツール**: Python（`scripts/build.py`）
- **CSSフレームワーク**: なし（カスタムCSS）

### バックエンド・インフラ
- **認証**: Firebase Authentication（AWS Cognito移行検討中）
- **データストレージ**: 
  - 静的JSONファイル（現在）
  - DynamoDB（AWS移行時）
- **ホスティング**: 
  - GitHub Pages（現在）
  - Cloud Run（CI/CD）
  - AWS S3 + CloudFront（移行予定）

### 開発環境
- **ローカルサーバー**: Python HTTP Server / Node serve
- **開発サーバー**: `scripts/dev_server.py`（API機能付き）
- **コンテナ**: Docker + Nginx

---

## ドキュメント構成

### 主要ドキュメント
- **PROJECT_OVERVIEW.md**（本ドキュメント）: プロジェクト全体概要
- **PAGE_SPECIFICATIONS.md**: 全ページの詳細仕様
- **DOCUMENTATION_INDEX.md**: ドキュメントカテゴリ別インデックス
- **README.md**: プロジェクト説明・クイックスタート
- **AGENTS.md**: 開発ガイドライン・コーディング規約

### カテゴリ別ドキュメント（150+ファイル）

#### 🔵 AWS関連（30+ファイル）
- Lambda/API Gateway設定
- S3セットアップ
- Cognito vs Firebase比較
- 移行ガイド

#### 🔴 Firebase関連（15+ファイル）
- 認証実装
- Storage CORS設定
- Custom Claims設定
- トラブルシューティング

#### 🟢 GitHub関連（10+ファイル）
- PAT設定
- Pages設定
- Actions CI/CD
- アップロードガイド

#### 🟡 WordPress関連（10+ファイル）
- セットアップガイド
- テーマ設定
- functions.php設定

#### 🟣 機能実装関連（20+ファイル）
- ヘッダー・ナビゲーション
- ヒーローセクション
- UI要素（ボタン、モーダル等）

#### 🟠 デプロイ・運用関連（10+ファイル）
- Cloud Runデプロイ
- 公開ガイド
- トラブルシューティング

#### 🔶 提案・設計関連（15+ファイル）
- アーキテクチャ比較
- 実装提案
- 機能設計

#### 📝 その他（30+ファイル）
- テストガイド
- エラー修正チェックリスト
- 実装ステータス

---

## 開発・デプロイフロー

### ローカル開発
```bash
# 1. ビルド
python3 scripts/build.py

# 2. 開発サーバー起動（API機能付き）
python3 scripts/dev_server.py
# → http://localhost:5173

# または静的ファイルのみ
python3 -m http.server 5173 --directory public
```

### ビルドプロセス
1. `src/pages/*.html` → `public/*.html` に生成
2. `src/assets/**` → `public/**` にコピー
3. テンプレート処理（`@include`, `@layout`, `@json`等）

### デプロイ
- **GitHub Pages**: `main`ブランチにpush → 自動デプロイ
- **Cloud Run**: GitHub Actionsで自動デプロイ（`--source .`）
- **AWS**: 移行予定（S3 + CloudFront）

### Git運用
- **ブランチ**: `main`（本番）
- **コミット**: Conventional Commits推奨
- **プッシュ前**: `docs/GITHUB_UPLOAD_CHECKLIST.md` を確認

---

## 主要な設計方針

### ディレクトリ管理
- **ソース**: `src/` で管理
- **成果物**: `public/` は自動生成（直接編集NG）
- **AWS移行**: 将来的なAWS運用を視野に入れた構造

### レスポンシブ設計
- **ブレークポイント**: `--bp-xs:480px`, `--bp-sm:640px`, `--bp-md:768px`, `--bp-lg:1024px`, `--bp-xl:1280px`
- **コンテナ幅**: `--container-sm:640px`, `--container-md:768px`, `--container-lg:1024px`, `--container-xl:1280px`
- **優先**: SPメイン（顧客・清掃員・営業）、PCメイン（管理者）

### データ管理
- **現在**: 静的JSONファイル（`src/data/*.json`）
- **将来**: DynamoDB（AWS移行時）
- **動的ページ**: `[id].html` 形式でJavaScriptで生成

---

## 今後の展開

### 短期
- Indexページのリファクタリング（スタイル分離、パーツ化）
- AWS移行準備（S3/CloudFront設定）

### 中期
- 認証システムのAWS Cognito移行検討
- データベースのDynamoDB移行
- API機能の拡充

### 長期
- フレームワーク導入検討（Laravel/Rails等）
- マイクロサービス化検討
- パフォーマンス最適化

---

**最終更新**: 2025年11月25日


