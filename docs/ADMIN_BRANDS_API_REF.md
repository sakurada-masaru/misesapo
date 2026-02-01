# 管理ダッシュボード顧客管理：ブランド API 参照

## 使っている API

管理ダッシュボードの顧客管理（法人・ブランド・店舗の3層）では、ブランドに次の API を使っています。

| 用途 | メソッド | パス | Lambda 関数 | DynamoDB |
|------|----------|------|-------------|----------|
| ブランド一覧取得 | GET | `/brands` | `get_brands` | `misesapo-brands` |
| ブランド詳細取得 | GET | `/brands/{id}` | `get_brand_detail` | `misesapo-brands` |
| ブランド作成 | POST | `/brands` | `create_brand` | `misesapo-brands` |
| ブランド更新 | PUT | `/brands/{id}` | `update_brand` | `misesapo-brands` |
| ブランド削除 | DELETE | `/brands/{id}` | `delete_brand` | `misesapo-brands` |

## 呼び出し元（主なもの）

- **管理顧客一覧** `src/pages/admin/customers/index.html`  
  - `fetch(\`${API_BASE}/brands\`, { headers })` で一覧取得
- **管理顧客・店舗詳細** `src/pages/admin/customers/stores/detail.html`  
  - `fetch(\`${API_BASE}/brands\`)` で一覧取得
- **管理顧客・法人詳細** `src/pages/admin/customers/clients/detail.html`  
  - `fetch(\`${API_BASE}/brands\`)` で一覧取得
- **管理顧客・ブランド詳細** `src/pages/admin/customers/brands/detail.html`  
  - `fetch(\`${API_BASE}/brands\`)` で一覧、`fetch(\`${API_BASE}/brands/${brandId}\`)` で詳細取得
- **管理用 JS**  
  - `src/assets/js/sales-clients.js`、`admin-customers-v3.js`、`admin-schedules.js`、`admin-reports.js` などで `GET /brands` を利用

## 期待するレスポンス形式（一覧）

フロントは次のどちらでも扱えます。

- 配列そのもの: `[{ id, name, client_id, ... }, ...]`
- オブジェクト: `{ items: [...] }` または `{ brands: [...] }`

Lambda の `get_brands` は `{ items: brands, count: len(brands) }` を返します。

## テーブル未作成・例外時の挙動

`misesapo-brands` が存在しない、権限エラー、その他いかなる例外でも、`get_brands` は **200** で `{ items: [], count: 0 }` を返すようにしています（502 を避けるため）。

## 502 Bad Gateway が出る場合

1. **GET /brands がどの Lambda に紐づいているか確認**  
   API Gateway 51bhoxkbxd の GET /brands が **misesapo-reports** ではなく **misesapo-brands-api** など別 Lambda に紐づいていると、その Lambda の不具合で 502 になることがあります。  
   → API Gateway の「統合」で GET /brands を **misesapo-reports** に付け直すか、misesapo-brands-api を修正・デプロイする。

2. **misesapo-reports をデプロイし直す**  
   `./scripts/deploy_lambda.sh misesapo-reports prod lambda_function.py` で最新の `get_brands`（例外時も 200 で空配列を返す）を反映する。

3. **Lambda のタイムアウト**  
   ブランド数が多いと Scan に時間がかかることがあります。Lambda のタイムアウトを 10 秒以上に延長するか、ページネーションで件数制限することを検討してください。

テーブルを作成する場合は:

```bash
./scripts/create_brands_table.sh
```

## 関連ファイル

| 種別 | パス |
|------|------|
| Lambda（一覧・詳細・CRUD） | `lambda_function.py`（`get_brands`, `get_brand_detail`, `create_brand`, `update_brand`, `delete_brand`） |
| テーブル作成 | `scripts/create_brands_table.sh` |
| 管理顧客トップ | `src/pages/admin/customers/index.html` |
| ブランド詳細画面 | `src/pages/admin/customers/brands/detail.html` |
| misogi 顧客一覧 | `src/misogi/pages/jobs/sales/clients/SalesClientListPage.jsx`（`GET /brands`） |
