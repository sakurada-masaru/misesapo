# MISOGI 業務ドメイン統合仕様書（v1.0）

## 1. 目的

本仕様書は、MISOGIにおける業務データ・API・DB・UIの用語および責務を統一し、
設計ブレ・再実装・属人化を防止することを目的とする。

本仕様は全実装・改修の基準とする。

## 2. 基本思想（最重要）

MISOGIは以下5層の業務フローを基軸とする。

`yakusoku -> shigoto -> yotei -> ugoki -> houkoku`

すべての業務データは、この流れに沿って生成・更新される。

## Related Specs

- `docs/spec/YAKUSOKU_CREDIT_AND_YOSHIN_SPEC.md` (monthly plan credit, top-up, yoshin, stop gate)

## 3. ドメイン構造（Source of Truth）

### 3.1 正データの定義

| ドメイン | 意味 | 正の責務 |
|---|---|---|
| yakusoku | 約束 | 契約・依頼・受注の正 |
| shigoto | 仕事 | 1件の作業単位（案件）の正 |
| yotei | 予定 | 人員・時間割の正 |
| ugoki | 動き | 実行・進捗の正 |
| houkoku | 報告 | 実績・証跡の正 |

### 3.2 階層関係

`1 yakusoku`
`  └ n shigoto`
`        └ 1 yotei`
`              └ 1 ugoki`
`                    └ 1 houkoku`

- 1つの約束から複数の仕事が発生可能
- yotei / ugoki / houkoku は shigoto に紐づく

## 4. API / DB 命名規則

### 4.1 APIパス

- `/yakusoku`
- `/shigoto`
- `/yotei`
- `/ugoki`
- `/houkoku`

英語パスは禁止。

### 4.2 テーブル名

- `yakusoku`
- `shigoto`
- `yotei`
- `ugoki`
- `houkoku`

環境別prefixのみ許可：

`prod_yotei` / `stg_yotei` 等

## 5. 操作語彙（Action）

| 操作 | 意味 | HTTP |
|---|---|---|
| sakusei | 作成 | POST |
| henshu | 編集 | PUT / PATCH |
| torikeshi | 取消（論理） | DELETE |
| fukkatsu | 復活 | PATCH |
| sakujo | 削除（物理） | 管理限定 |

原則：DELETE = torikeshi

## 6. 状態管理

### 6.1 jotai（状態）

有効性を表す。

`yuko / torikeshi`

ルール：

- 重複判定対象は yuko のみ
- 物理削除は禁止

### 6.2 jokyo（進捗）

ugoki にのみ適用。

`mikanryo -> shinkouchu -> kanryou`

## 7. 人物モデル

### 7.1 人物ID

| ID | 意味 |
|---|---|
| riyousya_id | 操作主体 |
| sagyouin_id | 現場担当 |
| jinzai_id | 人材管理 |

### 7.2 廃止対象

- `user_id`
- `worker_id`
- `staff_id`
- `cleaner_id`
- `assigned_to`

-> 統合

## 8. 顧客モデル

### 8.1 階層

`torihikisaki -> yagou -> tenpo`

### 8.2 ID

- `torihikisaki_id`
- `yagou_id`
- `tenpo_id`

### 8.3 廃止対象

- `client_id`
- `customer_id`
- `brand_id`
- `store_id`

## 9. 権限モデル

| 項目 | 用語 |
|---|---|
| role | yakuwari |
| permission | kengen |

## 10. 各ドメイン責務詳細

### 10.1 yakusoku（約束）

役割

- 契約
- 定期契約
- 単発依頼
- 追加依頼

主項目例

- id
- torihikisaki_id
- start_date
- end_date
- contract_type
- status
- created_at

### 10.2 shigoto（仕事）

役割

- 1回分の作業単位
- 再作業
- 追加作業

主項目例

- id
- yakusoku_id
- service_id
- target_date
- status
- memo

### 10.3 yotei（予定）

役割

- 日時割当
- 人員配置
- 重複管理

主項目例

- id
- shigoto_id
- sagyouin_id
- start_at
- end_at
- jotai

ルール

- 同一 sagyouin の時間重複は禁止
- availability依存は禁止。

### 10.4 ugoki（動き）

役割

- 進捗管理
- 現場状態管理

主項目例

- id
- shigoto_id
- jokyo
- updated_at
- meta

### 10.5 houkoku（報告）

役割

- 写真
- 作業内容
- 証跡

主項目例

- id
- shigoto_id
- payload
- state
- submitted_at

## 11. 旧->新マッピング

### 11.1 ドメイン

| 旧 | 新 |
|---|---|
| orders | yakusoku |
| jobs | shigoto |
| schedules | yotei |
| dispatch | ugoki |
| reports | houkoku |

### 11.2 状態

| 旧 | 新 |
|---|---|
| planned | yuko |
| cancelled | torikeshi |
| todo | mikanryo |
| working | shinkouchu |
| done | kanryou |

## 12. 互換・移行ルール

### 12.1 API境界変換

すべての旧データは入出力時に正規化する。

例：

- cancelled -> torikeshi
- user_id -> riyousya_id

### 12.2 DB移行

- 新規データは新語彙のみ使用
- 旧データは段階変換
- 互換層で吸収

## 13. 禁止事項

以下は禁止。

- 新しい英語業務語彙の追加
- ドメイン混在（例：yotei に契約情報を入れる）
- availability 強制依存
- jotai/jokyo 混用

## 14. 運用ルール

新語彙導入時：

- 本仕様更新
- レビュー
- 実装反映

を必須とする。

## ✅ 結果

この仕様により、MISOGIは：

`言語 × 業務 × 実装`

が完全一致した構造となる。
