# NFCタグ登録ガイド

## 概要

このドキュメントでは、MISESAPOシステムで使用するNFCタグの登録手順を説明します。

## 重要：正しい登録手順

**必ず以下の順序で実行してください：**

1. **タグのシリアルナンバー（UID）を取得**
2. **DynamoDBにUIDを含めて登録**
3. **URLをタグに書き込む**

この順序を守ることで、同じ`tag_id`が複数の物理タグに書き込まれても、UIDで区別できます。

---

## 1. タグのUIDを取得

### NFC Toolsを使用する場合

1. NFC Toolsアプリを開く
2. 「読む」をタップ
3. NFCタグにiPhoneを近づける
4. タグ情報が表示されたら、UID（シリアルナンバー）を確認
   - 例: `04:E5:DD:31:C3:2A:81`
   - 例: `04:D1:3E:AD:46:02:89`

### UIDの形式

- 通常は7バイト（14文字の16進数）
- コロン（`:`）区切りで表示される
- 例: `04:E5:DD:31:C3:2A:81`

---

## 2. DynamoDBにタグ情報を登録

### 登録スクリプトの使用方法

```bash
./scripts/register_nfc_tag.sh [TAG_ID] [FACILITY_ID] [LOCATION_ID] [FACILITY_NAME] [LOCATION_NAME] [DESCRIPTION] [PRODUCT_ID] [UID]
```

### パラメータ説明

| パラメータ | 説明 | 必須 | 例 |
|-----------|------|------|-----|
| TAG_ID | タグID（システム内で一意） | 必須 | `TEST_001`, `INVENTORY_TEST_001` |
| FACILITY_ID | 施設ID | 必須 | `ABC_001` |
| LOCATION_ID | 場所ID | 必須 | `TK_R01_TOILET_IN`, `LOC_INVENTORY` |
| FACILITY_NAME | 施設名 | 必須 | `テスト店舗`, `新宿店` |
| LOCATION_NAME | 場所名 | 必須 | `トイレ入口`, `在庫管理` |
| DESCRIPTION | 説明 | 必須 | `打刻テスト用タグ`, `在庫管理テスト用タグ` |
| PRODUCT_ID | 商品ID（在庫管理用のみ） | オプション | `P001` |
| UID | タグの物理UID | **推奨** | `04:E5:DD:31:C3:2A:81` |

### 登録例

#### 打刻用タグ

```bash
./scripts/register_nfc_tag.sh \
  TEST_001 \
  ABC_001 \
  TK_R01_TOILET_IN \
  "テスト店舗" \
  "トイレ入口" \
  "打刻テスト用タグ" \
  "" \
  "04:E5:DD:31:C3:2A:81"
```

#### 在庫管理用タグ

```bash
./scripts/register_nfc_tag.sh \
  INVENTORY_TEST_001 \
  ABC_001 \
  LOC_INVENTORY \
  "テスト店舗" \
  "在庫管理" \
  "在庫管理テスト用タグ" \
  P001 \
  "04:D1:3E:AD:46:02:89"
```

---

## 3. URLをタグに書き込む

### NFC Toolsを使用する場合

1. NFC Toolsアプリを開く
2. 「書く」をタップ
3. 「レコードを追加」をタップ
4. **「URL」を選択**（重要：「Web site」や「Text」ではない）
5. URLを入力（下記参照）
6. 「書き込み」をタップ
7. NFCタグにiPhoneを近づける

### URLの形式

#### 打刻用タグ

```
https://misesapo.co.jp/staff/dashboard?nfc_tag_id=[TAG_ID]
```

例：
```
https://misesapo.co.jp/staff/dashboard?nfc_tag_id=TEST_001
```

#### 在庫管理用タグ

```
https://misesapo.co.jp/staff/inventory/scan?nfc_tag_id=[TAG_ID]
```

例：
```
https://misesapo.co.jp/staff/inventory/scan?nfc_tag_id=INVENTORY_TEST_001
```

### 注意事項

- **必ず「URL」レコードタイプを選択**してください
- 「Web site」や「Text」を選択すると、ブラウザが正しく開かない場合があります
- URLにスペースが含まれていないか確認してください

---

## タグの種類と用途

### 打刻用タグ

- **用途**: 清掃員の出退勤記録
- **リダイレクト先**: `/staff/dashboard`
- **API Gateway**: `51bhoxkbxd`
- **必須フィールド**: `tag_id`, `facility_id`, `location_id`, `facility_name`, `location_name`, `description`
- **オプションフィールド**: `uid`

### 在庫管理用タグ

- **用途**: 商品の在庫管理
- **リダイレクト先**: `/staff/inventory/scan`
- **API Gateway**: `2z0ui5xfxb`
- **必須フィールド**: `tag_id`, `facility_id`, `location_id`, `facility_name`, `location_name`, `description`, `product_id`
- **オプションフィールド**: `uid`

---

## 登録済みタグの確認

### DynamoDBから確認

```bash
aws dynamodb get-item \
  --table-name nfc-tags \
  --key '{"tag_id": {"S": "TEST_001"}}' \
  --region ap-northeast-1 \
  --output json | python3 -m json.tool
```

### 登録されているフィールド

- `tag_id`: タグID（パーティションキー）
- `facility_id`: 施設ID
- `location_id`: 場所ID
- `facility_name`: 施設名
- `location_name`: 場所名
- `description`: 説明
- `product_id`: 商品ID（在庫管理用のみ）
- `uid`: タグの物理UID（シリアルナンバー）
- `created_at`: 作成日時
- `updated_at`: 更新日時

---

## トラブルシューティング

### タグを読み取っても反応しない

1. **URLが正しく書き込まれているか確認**
   - NFC Toolsで「読む」を実行して、URLを確認
   - 「URL」レコードタイプになっているか確認

2. **iPhoneのNFC設定を確認**
   - iPhoneのNFCは通常常時有効
   - Safariがデフォルトブラウザに設定されているか確認

3. **URLにスペースが含まれていないか確認**
   - URLの前後にスペースがあるとエラーになる場合があります

### タグ情報が取得できない

1. **DynamoDBに登録されているか確認**
   - 上記のコマンドで確認

2. **API Gatewayの設定を確認**
   - 打刻用: `51bhoxkbxd`
   - 在庫管理用: `2z0ui5xfxb`

3. **認証トークンが有効か確認**
   - ログインページにリダイレクトされる場合は、認証が必要です

### 在庫管理で商品情報が表示されない

1. **`product_id`が登録されているか確認**
   - DynamoDBのタグ情報に`product_id`フィールドがあるか確認

2. **商品が存在するか確認**
   - `product_id`に対応する商品が在庫管理システムに登録されているか確認

---

## 関連ファイル

- **登録スクリプト**: `scripts/register_nfc_tag.sh`
- **API Gateway設定（打刻用）**: `scripts/setup_nfc_clock_in_api.sh`
- **API Gateway設定（在庫管理用）**: `scripts/setup_nfc_tag_api_inventory.sh`
- **Lambda関数**: `lambda_function.py`（`get_nfc_tag_info`関数）

---

## 更新履歴

- 2025-01-XX: 初版作成
- UID記録機能を追加
- 在庫管理用タグの登録手順を追加

