# 営業入口「顧客」タブ・顧客一覧UI 実装完了報告

## 目的

既存の営業入口（`/jobs/sales/entrance`）のホットバー「顧客」タブに顧客一覧UIを表示し、クリックでカルテ詳細（`/sales/store/:storeKey`）へ遷移させる。API接続は後回しで、モックデータのみ。

---

## 変更ファイル一覧

| 種別 | パス |
|------|------|
| 新規 | `src/shared/ui/Sales/SalesCustomerListPanel.jsx` |
| 新規 | `src/shared/ui/Sales/sales-customer-list.css` |
| 変更 | `src/shared/ui/JobEntranceScreen.jsx` |
| 変更 | `src/shared/ui/Sales/SalesStoreKartePage.jsx` |
| 報告 | `docs/IMPLEMENTATION_REPORT_SALES_CUSTOMER_TAB.md`（本ファイル） |

---

## 実装内容

### 1) JobEntranceScreen

- `SalesCustomerListPanel` をインポート。
- `jobKey === 'sales' && tab === 'customer'` のときだけ `<SalesCustomerListPanel />` を描画し、それ以外は従来どおり「タブ: ${tabLabel}」のダミー表示。

### 2) SalesCustomerListPanel.jsx

- **検索**: テキスト入力で会社名・店舗名の部分一致フィルタ（大文字小文字無視）。
- **顧客カード一覧**: 各カードに  
  - 店舗名（大）  
  - 会社名（小）  
  - pipeline バッジ（色付き）  
  - next_action / last_contact（あれば）  
  を表示。
- **クリック**: `useNavigate()` で `/sales/store/${encodeURIComponent(storeKey)}` へ遷移。
- **モックデータ**: 4件（セブン新宿・渋谷、ローソン池袋、ファミマ新宿）。必要に応じて `MOCK_CUSTOMERS` を編集可能。

### 3) sales-customer-list.css

- pipeline バッジ色:  
  new=灰、contacted=青、qualified=紫、proposal=橙、estimate=黄、won=緑、lost=赤。
- カードはホバーで枠・シャドウを強調。

### 4) カルテ側の戻り導線

- `SalesStoreKartePage.jsx` の上部リンクに「顧客へ戻る」を追加。  
  - `Link to="/jobs/sales/entrance"` で営業入口に戻り、そこで「顧客」タブを押すと一覧に戻れる想定。

---

## 確認手順（顧客タブ表示・カルテ遷移）

1. **顧客タブ表示**  
   - ブラウザで `/v2/jobs/sales/entrance` を開く。  
   - ホットバーで「顧客」を選ぶ。  
   - 「顧客一覧」見出し・検索欄・顧客カード（店舗名・会社名・pipeline バッジ・次アクション/最終接触）が表示されること。

2. **検索**  
   - 検索欄に「セブン」「新宿」「ローソン」などを入力。  
   - 該当するカードだけが表示されること。

3. **クリックでカルテ遷移**  
   - 任意の顧客カードをクリック。  
   - `/v2/sales/store/:storeKey`（例: `seven_shinjuku`）のカルテ（SalesStoreKartePage）が開くこと。  
   - カルテ上部に「顧客へ戻る」リンクがあり、クリックで `/v2/jobs/sales/entrance` に戻れること。

---

## 補足

- API接続（work-report 等から顧客一覧を組み立てる）は Phase2 で対応。現状は UI と導線のみ。
- カルテ側のルート（`/sales/store/:storeKey` → SalesStoreKartePage）は既存のまま利用。
