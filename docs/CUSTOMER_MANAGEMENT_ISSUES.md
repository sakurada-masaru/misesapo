# 顧客管理の不整合と改善点

## 発見された問題

### 1. フィルタリングロジックの不整合 ⚠️

**問題箇所**: `filterAndRender()`関数（1650-1655行目）

```javascript
// 取引先でフィルター（ブランド経由）
let matchClient = true;
if (clientValue && !brandValue) {
  const clientBrands = allBrands.filter(b => b.client_id === clientValue).map(b => b.id);
  matchBrand = clientBrands.includes(store.brand_id);  // ❌ matchClientではなくmatchBrandを上書き
}
```

**問題点**:
- `matchClient`変数を定義しているが、実際には`matchBrand`を上書きしている
- `matchClient`が常に`true`のままになり、取引先フィルターが正しく機能しない
- 取引先とブランドの両方が選択されている場合の処理が不十分

**修正案**:
```javascript
// ブランドでフィルター
let matchBrand = true;
if (brandValue) {
  matchBrand = store.brand_id === brandValue;
}

// 取引先でフィルター（ブランド経由、または直接）
let matchClient = true;
if (clientValue) {
  if (brandValue) {
    // ブランドも選択されている場合、ブランドがその取引先に属しているか確認
    const brand = allBrands.find(b => b.id === brandValue);
    matchClient = brand && brand.client_id === clientValue;
  } else {
    // ブランドが選択されていない場合、取引先に属するブランドの店舗を表示
    const clientBrands = allBrands.filter(b => b.client_id === clientValue).map(b => b.id);
    matchBrand = clientBrands.includes(store.brand_id) || store.client_id === clientValue;
  }
}
```

### 2. 3層構造取得ロジックの重複 ⚠️

**問題箇所**: `renderTable()`関数（1758-1761行目）

```javascript
// 3層構造の情報を取得
const brand = allBrands.find(b => b.id === store.brand_id);
const client = brand ? allClients.find(c => c.id === brand.client_id) : 
               allClients.find(c => c.id === store.client_id);
```

**問題点**:
- `data_utils.js`の`Hierarchy.getFromStore()`と同じロジックが重複している
- コードの保守性が低下

**修正案**:
```javascript
// data_utils.jsを使用
const { client, brand, store: storeData } = DataUtils.Hierarchy.getFromStore(store, allClients, allBrands);
```

### 3. フィルタリングロジックの改善提案 💡

**現状**: 手動でフィルタリングロジックを実装

**改善案**: `data_utils.js`の`Hierarchy.getStoresByClient()`を使用

```javascript
// 取引先でフィルター
if (clientValue && !brandValue) {
  filteredStores = DataUtils.Hierarchy.getStoresByClient(allStores, allBrands, clientValue);
}
```

### 4. エラーハンドリングの不備 ⚠️

**問題箇所**: 新規法人・ブランド作成時（2220-2250行目）

**問題点**:
- API呼び出しが失敗した場合のエラーハンドリングが不十分
- 作成に失敗しても処理が続行される可能性がある

**修正案**:
```javascript
if (!clientRes.ok) {
  const errorData = await clientRes.json();
  throw new Error(errorData.error || '法人の作成に失敗しました');
}
```

### 5. データ整合性の問題 ⚠️

**問題点**:
- 店舗に`client_id`と`brand_id`の両方がある場合、どちらを優先するかが一貫していない
- ブランドが削除された場合、店舗の`brand_id`が無効になる可能性がある

**改善案**:
- データ整合性チェック機能の追加
- 無効な`brand_id`や`client_id`を持つ店舗の検出

### 6. パフォーマンスの問題 💡

**問題点**:
- `renderTable()`内で毎回`find()`を実行している
- 大量のデータがある場合、パフォーマンスが低下する可能性がある

**改善案**:
- マップ（Map）を使用してO(1)の検索を実現
- メモ化の活用

## 優先度

1. **高**: フィルタリングロジックの不整合（1）
2. **中**: エラーハンドリングの不備（4）
3. **中**: 3層構造取得ロジックの重複（2）
4. **低**: パフォーマンスの改善（6）
5. **低**: データ整合性チェック（5）

