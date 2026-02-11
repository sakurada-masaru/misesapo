# JINZAI ドメイン仕様書（v1.0）

## 1. 目的

本仕様は、MISOGIにおける「働く人」ドメイン（jinzai）を統一し、
契約形態・職種・権限を混同しない実装基準を定義する。

## 2. 分離方針（最重要）

- 顧客系API（`torihikisaki-data` / `jtn6in2iuj`）と人材系APIは分離する。
- 顧客系: `torihikisaki -> yagou -> tenpo -> souko`
- 人材系: `jinzai -> kaban`

## 3. jinzai の3軸

`jinzai` には必ず以下3軸を分離して保持する。

1. `koyou_kubun`（契約形態）
2. `shokushu`（職種）
3. `yakuwari`（システム権限）

## 4. マスター値（初期固定）

### 4.1 koyou_kubun

- `gyomu_itaku_kojin`
- `gyomu_itaku_unit`
- `gyomu_itaku_vendor`
- `keiyaku_shain`
- `baito`
- `part`
- `haken`

### 4.2 shokushu

- `seisou`
- `maintenance`
- `engineer`
- `eigyo`
- `jimu`
- `jinji`
- `keiri`

### 4.3 yakuwari

- `admin`
- `manager`
- `field`
- `viewer`

## 5. テーブル定義（Phase 1）

## 5.1 `jinzai`

- PK: `jinzai_id` (S)
- 必須:
  - `jinzai_id`
  - `name`
  - `koyou_kubun`
  - `shokushu`（配列）
  - `yakuwari`（配列）
  - `jotai` (`yuko | torikeshi`)
  - `created_at`
  - `updated_at`
- 任意:
  - `email`
  - `phone`
  - `vendor_id`
  - `unit_id`
  - `memo`

## 5.2 `jinzai_kaban`

- PK: `jinzai_kaban_id` (S)
- 必須:
  - `jinzai_kaban_id`
  - `jinzai_id`
  - `name`
  - `jotai` (`yuko | torikeshi`)
  - `created_at`
  - `updated_at`
- 任意:
  - `description`

関係:

- 原則 `1 jinzai : 1 jinzai_kaban`
- 物理削除は禁止（`torikeshi`）

## 6. API（Phase 1）

### 6.1 jinzai

- `GET /jinzai`
- `POST /jinzai`
- `PUT /jinzai/{jinzai_id}`
- `DELETE /jinzai/{jinzai_id}`（論理削除）

### 6.2 kaban

- `GET /jinzai/{jinzai_id}/kaban`
- `POST /jinzai/{jinzai_id}/kaban`
- `PUT /jinzai/{jinzai_id}/kaban/{jinzai_kaban_id}`
- `DELETE /jinzai/{jinzai_id}/kaban/{jinzai_kaban_id}`（論理削除）

## 7. ストレージ方針（S3）

- 顧客提出物: `torihikisaki-souko`
  - キー規約: `souko/{tenpo_id}/...`
- 人材提出物: `jinzai-kaban`
  - キー規約: `kaban/{jinzai_id}/...`

`kaban` / `souko` は台帳（メタデータ）であり、ファイル実体はS3に保存する。

## 8. 禁止事項

- `koyou_kubun` と `yakuwari` の混在
- `shokushu` と権限判定の直結
- 顧客系ゲートに `jinzai` を混在
- 物理削除

## 9. 受け入れ条件

- `jinzai` が3軸（契約形態/職種/権限）で分離保存される
- `jinzai_kaban` が `jinzai_id` で紐づく
- `DELETE` は `torikeshi` で実施される
- S3 キー規約が `kaban/{jinzai_id}/...` で統一される
