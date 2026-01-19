# ID形式変更による影響箇所の修正まとめ

## 変更内容

ID形式を5桁のゼロパディング形式に統一：
- **お客様ID**: `CU00001`〜
- **法人**: `CL00001`〜
- **ブランド**: `BR00001`〜
- **店舗**: `ST00001`〜
- **従業員**: `W00001`〜

## 修正した箇所

### 1. フロントエンド（JavaScript）

#### data_utils.js
- ✅ ID_PREFIXの更新（`WK` → `W`、`CU`追加）
- ✅ ID正規化を5桁に変更（`padStart(5, '0')`）
- ✅ `generate()`関数を非推奨化
- ✅ `generateSequential()`関数を追加
- ✅ `normalizeCustomer()`と`normalizeWorker()`を追加

#### 営業画面（sales/dashboard.html）
- ✅ `getClientName()` - EntityFinderを使用
- ✅ `getBrandName()` - EntityFinderを使用
- ✅ `viewClientDetail()` - EntityFinderを使用
- ✅ スケジュールフィルタリング - IdUtils.isSameを使用
- ✅ 新規クライアント作成時のID生成を削除
- ✅ 新規ブランド作成時のID生成を削除
- ✅ 新規店舗作成時のID生成を削除
- ✅ ブランド検索時のID比較 - IdUtils.isSameを使用
- ✅ 店舗検索時のID比較 - EntityFinderを使用
- ✅ 従業員検索時のID比較 - EntityFinderを使用

#### 管理画面（admin/customers/index.html）
- ✅ `renderTable()` - EntityFinderを使用
- ✅ `filterAndRender()` - IdUtils.isSameを使用
- ✅ `updateBrandFilter()` - EntityFinderを使用
- ✅ `populateHierarchySelects()` - EntityFinderを使用
- ✅ `updateBrandSelectForForm()` - EntityFinderを使用
- ✅ `loadStoreDetail()` - EntityFinderを使用
- ✅ 削除時のID比較 - IdUtils.isSameを使用
- ✅ 更新時のID比較 - IdUtils.isSameを使用
- ✅ 見積もり・レポートフィルタリング - IdUtils.isSameを使用
- ✅ 新規法人・ブランド・店舗作成時のID生成を削除

#### 管理画面（admin/customers/stores/detail.html）
- ✅ 店舗検索 - EntityFinderを使用
- ✅ ブランド・クライアント検索 - EntityFinderを使用

#### 管理画面（admin/customers/brands/detail.html）
- ✅ ブランドに属する店舗のフィルタリング - IdUtils.isSameを使用
- ✅ スケジュールフィルタリング - IdUtils.isSameを使用

#### 管理画面（admin/customers/clients/detail.html）
- ✅ クライアントに属するブランドのフィルタリング - IdUtils.isSameを使用
- ✅ 店舗のフィルタリング - IdUtils.isSameを使用
- ✅ スケジュールフィルタリング - IdUtils.isSameを使用

#### 管理画面（admin/users/index.html）
- ✅ 新規従業員作成時のID生成を削除
- ✅ 従業員検索 - EntityFinderを使用
- ✅ ID正規化ロジックを修正

### 2. バックエンド（Lambda）

#### lambda_function.py
- ✅ ID生成ヘルパー関数を追加
  - `extract_number_from_id()` - IDから数値部分を抽出
  - `get_max_id_number()` - 最大ID番号を取得
  - `generate_next_id()` - 次のIDを生成（5桁形式）
- ✅ 法人作成 - `CL00001`形式でID生成
- ✅ 従業員作成 - `W00001`形式でID生成
- ✅ brands/storesエンドポイントを追加
  - `get_brands()` - ブランド一覧取得
  - `create_brand()` - ブランド作成（`BR00001`形式）
  - `get_brand_detail()` - ブランド詳細取得
  - `update_brand()` - ブランド更新
  - `delete_brand()` - ブランド削除
  - `get_stores()` - 店舗一覧取得
  - `create_store()` - 店舗作成（`ST00001`形式）
  - `get_store_detail()` - 店舗詳細取得
  - `update_store()` - 店舗更新
  - `delete_store()` - 店舗削除
- ✅ BRANDS_TABLEとSTORES_TABLEの定義を追加

## 修正方法

### ID比較の統一

すべてのID比較を以下のいずれかに統一：

1. **EntityFinderを使用**（推奨）
   ```javascript
   const client = window.DataUtils?.EntityFinder?.findClient(allClients, clientId);
   ```

2. **IdUtils.isSame()を使用**（フィルタリング時など）
   ```javascript
   brands = allBrands.filter(b => window.DataUtils?.IdUtils?.isSame(b.client_id, clientId));
   ```

3. **フォールバック**（EntityFinderが利用できない場合）
   ```javascript
   client = allClients.find(c => c.id === clientId || String(c.id) === String(clientId));
   ```

### ID生成の統一

- フロントエンドでのID生成を削除
- バックエンド（Lambda）でID生成を一元管理
- 5桁形式（`CL00001`、`BR00001`など）で生成

## 影響範囲

### 修正済み
- ✅ 顧客管理画面
- ✅ 営業画面
- ✅ 管理画面（各種詳細画面含む）
- ✅ ユーザー管理画面
- ✅ バックエンドAPI（clients, workers, brands, stores）

### 確認が必要
- ⚠️ 既存データとの互換性（数値ID、タイムスタンプIDなど）
- ⚠️ データ移行スクリプト（必要に応じて）

## テスト項目

以下を確認してください：

1. ✅ 新規作成時にIDが5桁形式で生成される
2. ✅ 既存データ（数値ID、タイムスタンプID）が正しく表示される
3. ✅ フィルタリングが正しく動作する
4. ✅ 検索が正しく動作する
5. ✅ 削除が正しく動作する
6. ✅ 更新が正しく動作する
7. ✅ 法人名・ブランド名が正しく表示される

## 注意事項

- 既存の数値IDやタイムスタンプIDは、`EntityFinder`や`IdUtils.isSame()`により正しく処理されます
- 新規作成されるIDはすべて5桁形式になります
- 既存データの移行は必要に応じて実施してください

