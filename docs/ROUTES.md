# ミセサポ サイトルーティング一覧

最終更新: 2025年3月

## パブリックサイト（未認証ユーザー向け）

### トップページ・認証
- `/` - トップページ（発注ページ）
- `/index.html` - トップページ（発注ページ）
- `/signin.html` - ログイン
- `/signup.html` - 新規登録（個人）
- `/signup2.html` - 新規登録（ステップ2）
- `/signup3.html` - 新規登録（ステップ3）
- `/reset-password.html` - パスワードリセット

### 登録ページ
- `/registration/personal.html` - 個人登録
- `/registration/personal2.html` - 個人登録（ステップ2）
- `/registration/corporation.html` - 法人登録
- `/registration/corporation2.html` - 法人登録（ステップ2）
- `/registration/corporation3.html` - 法人登録（ステップ3）
- `/registration/complete.html` - 登録完了

### お問い合わせ
- `/inquiry/complete.html` - お問い合わせ完了

---

## ユーザー（顧客）向けサイト（SPメイン、PCもあり）

### ダッシュボード
- `/mypage.html` - マイページ（ダッシュボード）
- `/mypage/info.html` - オーナー情報
- `/mypage/inquiry.html` - お問い合わせ

### サポート（サポートデスク）
- `/mypage/support.html` - サポートセンター（親ページ・ハブ）
- `/mypage/support/faq.html` - よくある質問（FAQ）
- `/mypage/support/tickets.html` - お問い合わせ履歴（チケット管理）
- `/mypage/support/inquiry/new.html` - 新規お問い合わせ（チケット作成）
- `/mypage/support/contact.html` - お問い合わせ・連絡先（マルチチャネル）

### 発注・予約
- `/cart.html` - カート
- `/checkout.html` - 確認・決済
- `/order-confirm.html` - 発注確認
- `/order-complete.html` - 発注完了
- `/order/history.html` - 発注履歴

### レポート・確認
- `/report.html` - 清掃レポート一覧
- `/reports/[id].html` - 清掃レポート詳細

### スケジュール
- `/schedule.html` - 清掃予定一覧

### コンシェルジュ
- `/concierge.html` - コンシェルジュページ

---

## 清掃員向けサイト（SPのみ）

### ダッシュボード
- `/staff/dashboard.html` - 清掃員ダッシュボード

### 作業管理
- `/staff/assignments.html` - 作業割り当て一覧

### レポート
- `/staff/reports/new.html` - レポート作成

### スケジュール
- `/staff/schedule.html` - スケジュール

---

## 営業マン向けサイト（SPメイン）

### ダッシュボード
- `/sales/dashboard.html` - 営業ダッシュボード

### 顧客管理
- `/sales/clients.html` - 顧客一覧（未実装・枠組みのみ）

### 見積もり
- `/sales/estimates.html` - 見積もり一覧
- `/sales/estimates/new.html` - 見積もり作成

### 発注管理
- `/sales/orders.html` - 発注管理

---

## 管理者向けサイト（PCメイン）

### ダッシュボード
- `/admin/dashboard.html` - 管理ダッシュボード

### ユーザー管理
- `/admin/users.html` - ユーザー管理

### 発注管理
- `/admin/orders.html` - 発注管理

### サービス管理
- `/admin/services.html` - サービス管理

### その他
- `/admin/sitemap.html` - サイトマップ一覧

---

## ページ実装状況

### ✅ 実装済み
- パブリックサイト: 全て実装済み
- ユーザー向け: 全て実装済み（サポートデスク要素含む）
- 清掃員向け: 全て実装済み
- 営業マン向け: 全て実装済み（顧客一覧は枠組みのみ）
- 管理者向け: 全て実装済み

### 📝 補足
- 静的モックアップ段階のため、バックエンド連携は未実装
- データは静的JSONファイルから読み込み
- 顧客情報はCSVファイルからJSONに自動変換される（`src/data/clients.csv` → `src/data/clients.json`）

---

## アクセス制御（想定）

### ロール定義
- **guest**: 未認証ユーザー（パブリックサイトのみ）
- **customer**: 顧客（個人・法人）
- **staff**: 清掃員
- **sales**: 営業マン
- **admin**: 管理者

### ページアクセス権限
- `/` - guest, customer, sales, admin
- `/mypage.html` - customer
- `/staff/*` - staff, admin
- `/sales/*` - sales, admin
- `/admin/*` - admin

---

## デバイス対応

### SPメイン（スマートフォン優先）
- ユーザー向けサイト
- 清掃員向けサイト
- 営業マン向けサイト

### PCメイン（デスクトップ優先）
- 管理者向けサイト

### 両対応
- パブリックサイト
- ユーザー向けサイト（SPメインだがPCでも利用可能）

---

## データファイル

### 顧客情報
- 顧客情報は **API（DynamoDB）を正** とする
  - `GET /clients` - 法人（クライアント）一覧
  - `GET /brands` - ブランド一覧
  - `GET /stores` - 店舗一覧

### その他のデータ
- `src/data/service_items.json` - サービス一覧
- `src/data/cart_items.json` - カートアイテム
- `src/data/cleaning_reports.json` - 清掃レポート
- `src/data/cleaning_schedules.json` - 清掃スケジュール

