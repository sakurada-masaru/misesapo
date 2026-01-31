# 営業エントランス「顧客」タブ・サブボタン＋個別ページ 実装完了報告

## 目的

営業エントランスにオーバーレイ（一覧UI）を出さず、「顧客」タブではサブボタン2つのみ表示し、押下で個別ページに遷移させる。遷移時は報告と同じアニメーション（UIフェードアウト・5.2秒後に遷移）を適用する。

---

## 変更ファイル一覧

| 種別 | パス |
|------|------|
| ルート | `src/app/router.jsx` |
| 新規 | `src/shared/ui/Sales/SalesCustomersPage.jsx` |
| 新規 | `src/shared/ui/Sales/SalesKarteListPage.jsx` |
| 変更 | `src/shared/ui/Sales/SalesCustomerListPanel.jsx` |
| 変更 | `src/shared/ui/JobEntranceScreen.jsx` |
| 変更 | `src/shared/styles/components.css` |
| 変更 | `src/shared/ui/Sales/sales-customer-list.css` |
| 報告 | `docs/IMPLEMENTATION_REPORT_SALES_ENTRANCE_SUBMENU.md`（本ファイル） |

---

## 実装内容

### 1) ルート追加（router.jsx）

- `/sales/customers` → `SalesCustomersPage`
- `/sales/kartes` → `SalesKarteListPage`
- 既存の `/sales/store/:storeKey` はそのまま。

### 2) 新規ページ

- **SalesCustomersPage.jsx**  
  - タイトル「顧客一覧」  
  - 戻るリンク（`/jobs/sales/entrance`）  
  - `<SalesCustomerListPanel title="顧客一覧" />`

- **SalesKarteListPage.jsx**  
  - タイトル「営業カルテ」  
  - 戻るリンク（`/jobs/sales/entrance`）  
  - `<SalesCustomerListPanel title="営業カルテ" />`

### 3) SalesCustomerListPanel

- **title** を props で受け取る（デフォルト `'顧客一覧'`）。  
- 見出しに `{title}` を表示。  
- クリック挙動（`/sales/store/:storeKey` への遷移）は従来どおり。

### 4) エントランス修正（JobEntranceScreen.jsx）

- **SalesCustomerListPanel の import を削除**（入口に一覧を出さない）。
- 顧客タブ選択時は **サブボタン2つのみ**表示：
  - 「顧客一覧」ボタン → クリックで `transitioningTo = '/sales/customers'` をセット。
  - 「営業カルテ」ボタン → クリックで `transitioningTo = '/sales/kartes'` をセット。
- **遷移アニメーション（報告と同じ）**  
  - `transitioningTo` がセットされたら、ページに `log-transition`、UI に `transitioning-out` を付与（報告タブと同じクラス）。  
  - 5.2秒後に `navigate(transitioningTo)` を実行し、`transitioningTo` をクリア。  
  - 報告タブの Visualizer log モードと同じタイミング（5200ms）を使用。

### 5) CSS

- **components.css**  
  - `.sales-entrance-submenu`：縦並び＋余白。  
  - `.sales-entrance-subbtn`：大きめボタン（エントランスらしい見た目）、ホバー時拡大。
- **sales-customer-list.css**  
  - `.sales-page` / `.sales-page-title` / `.sales-page-back`：`/sales/customers` と `/sales/kartes` ページ用のレイアウト・タイトル・戻るリンク。

---

## 確認手順

1. **エントランス（顧客タブ）**  
   - `/v2/jobs/sales/entrance` を開く。  
   - ホットバーで「顧客」を押す。  
   - 入口本文に「顧客一覧」「営業カルテ」の2ボタンのみ表示される（一覧カードは出ない）。

2. **顧客一覧ページ**  
   - 「顧客一覧」を押す → 報告と同じフェードアウト → 5.2秒後に `/v2/sales/customers` に遷移。  
   - タイトル「顧客一覧」、戻るリンク、検索＋顧客カード一覧が表示される。  
   - カードをクリック → `/v2/sales/store/:storeKey`（カルテ）に遷移。

3. **営業カルテページ**  
   - 「営業カルテ」を押す → 同様のフェードアウト → 5.2秒後に `/v2/sales/kartes` に遷移。  
   - タイトル「営業カルテ」、戻るリンク、同じく顧客カード一覧が表示される。  
   - カードをクリック → カルテに遷移。

---

## 補足

- オーバーレイは作らず、入口の本文領域にサブボタンが出るだけ。  
- ページ遷移は報告タブと同じアニメーション（`log-transition` / `transitioning-out` ＋ 5.2秒後に navigate）で統一。
