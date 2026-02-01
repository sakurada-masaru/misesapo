# 清掃カルテ（完全版）参照

事務ジョブの顧客リストから開く「カルテ」は、**営業側のカルテではなく**、管理画面の**清掃カルテ（完全版）**を参照する。

## URL

- **本番例**: `https://misesapo.co.jp/admin/customers/stores/[id]/chart.html?store_id=ST00123`
- **パス**: `/admin/customers/stores/{storeId}/chart.html?store_id={storeId}`

## テンプレート・スクリプト

| 種別 | パス |
|------|------|
| HTML | `src/pages/admin/customers/stores/[id]/chart.html` |
| JS | `src/assets/js/admin-store-chart.js` |
| CSS | `src/assets/css/admin-store-chart.css` |

## 店舗IDの取得（admin-store-chart.js）

- パス: `/admin/customers/stores/{id}/chart.html` の `{id}`
- クエリ: `?store_id=xxx` または `?storeId=xxx` または `?id=xxx`
- 404.html の動的ルーティングで `[id]` が実際の storeId に置換される

## 清掃カルテ（完全版）の構成

### 基本情報
- 顧客ID・ブランドID・店舗ID・カルテID
- ブランド名・店舗名・担当者
- 住所・電話・メール
- プラン（定期: 毎月/隔月/3ヶ月/6ヶ月/年1 / スポット）
- セキュリティボックス No.
- 設備・客席（問診票）

### 初回ヒアリング（営業問診票）
- **基本ヒアリング**: 清掃の悩み、店内環境、稼働人数（最小/最大）、稼働時間、通常清掃の頻度
- **店舗仕様**: 平米数、畳数、天井高さ、アンペア数、トイレ数、空調の数、壁/床の材質、ブレーカー/鍵の位置、出入口、スタッフルーム、ブレーカー/鍵の写真
- **設備・客席**: カウンター席/ボックス席/座敷、設備（空調・ダクト・レンジフード・グリストラップ・床・排水溝・トイレ・窓・ガラス）
- **注意事項・計画**: 空調設備の状態、厨房設備の状態、特に気になる場所、注意事項、最終清掃日、依頼プラン、衛生状態自己評価

### サービス内容
- 読み込み表示

### 使用消耗品
- 消耗品一覧・追加

### 清掃担当者履歴
- 担当者一覧・追加

### メモ・特記事項
- メモ

---

## カルテの内容（UI項目一覧）

画面上の表示順・ラベルを記載。プレースホルダーや「選択してください」等は実際の chart.html に準拠。

| セクション | 項目（ラベル） | 備考 |
|------------|----------------|------|
| **基本情報** | ブランド名 | - |
| | 店舗名 | 例: Aphrodite　アフロディーテ（ニューハーフバー） |
| | 担当者 | 例: 岩下 弥樹 |
| | 住所 | - |
| | 電話 | - |
| | メール | - |
| | プラン | 定期: / スポット等 |
| | セキュリティボックス | No. |
| | 設備・客席（問診票） | 未入力 |
| **初回ヒアリング（営業問診票）** | | |
| 基本ヒアリング | 清掃の悩み | 例：厨房の油汚れが落ちない |
| | 店内環境 | 例：油煙が強い、湿気が多い |
| | 稼働人数（最小） | 選択してください |
| | 稼働人数（最大） | 選択してください |
| | 稼働時間 | 例：11:00〜23:30 |
| | 通常清掃の頻度 | 例：毎日（閉店後30分） |
| 店舗仕様 | 平米数 | 例：120 ㎡ |
| | 畳数 | 例：72 畳 |
| | 天井高さ | 例：2.6 m |
| | アンペア数 | 例：60 A |
| | トイレ数 | 例：2 基 |
| | 空調の数 | 例：3台 |
| | 壁の材質 | 例：タイル |
| | 床の材質 | 例：塩ビ |
| | ブレーカーの位置 | 例：厨房奥 |
| | 鍵の位置 | 例：受付右棚 |
| | 出入口 | 例：正面1/裏口1 |
| | スタッフルーム | 選択してください |
| | ブレーカー位置の写真 | 画像を追加 URL |
| | 鍵の置き場の写真 | 画像を追加 URL |
| 設備・客席 | カウンター席・ボックス席・座敷 | 客席（設備補足） |
| 設備情報（問診票） | 空調・ダクト・レンジフード・グリストラップ・床・排水溝・トイレ・窓・ガラス | |
| 注意事項・計画 | 空調設備の状態 | 例：台数3、1台異音 |
| | 厨房設備の状態 | 例：レンジフード油固着 |
| | 特に気になる場所 | 例：ダクト、床排水溝 |
| | 注意事項 | 例：薬剤の臭いNG |
| | 最終清掃日 | 年/月/日 |
| | 依頼プラン | 選択してください |
| | 衛生状態自己評価 | 選択してください |
| **サービス内容** | 厨房設備・空調設備・フロア・その他 | チェックリスト（グリストラップ、U字溝、配管高圧洗浄、レンジフード洗浄、ダクト洗浄、防火シャッター清掃、換気扇洗浄、排気ファン清掃、アアコン洗浄、窓清掃、シール剥がし、テーブル拭き、トイレ清掃、床清掃、床ワックス、整理整頓、ソファークリーニング、ゴミ回収、配線整理、スタッフルーム清掃、床マット交換、エアコン法定点検、店舗衛生管理、5Sコンサルティング、高所/厨房機器内埃取り、ネズミ駆除、ゴキブリ/チョウバエ駆除、HACCP、汚水槽 等） |
| **使用消耗品** | 消耗品が登録されていません / 消耗品を追加 | |
| **清掃担当者履歴** | 担当者履歴がありません / 担当者を追加 | |
| **メモ・特記事項** | 特記事項や注意点を入力してください | |

## データ（chartData / admin-store-chart.js）

- `chart_id`, `store_id`, `brand_id`, `client_id`
- `status`, `version` (完全版は `'complete'`)
- `plan_frequency`: monthly, bimonthly, quarterly, semiannual, yearly, spot
- `security_box_number`
- `equipment[]`, `services[]`, `consumables[]`, `cleaning_staff_history[]`, `notes`

## 事務側からの導線

- **misogi 顧客リスト**（`OfficeClientListPage`）の編集パネル「カルテ」ボタン  
  → 同じ編集パネル内で **清掃カルテフォーム**（`OfficeClientKartePanel`）を表示。店舗IDに紐づくカルテは **テンプレート**（`karteTemplate.js`）で存在保証し、**ストレージ**（`karteStorage.js`）で localStorage / API に保存。「編集に戻る」でフォーム表示に戻る。
- **misogi ルート** `/office/clients/:storeId`（`OfficeClientKartePage`）  
  → 管理画面の清掃カルテ（完全版）URL へリダイレクト

## misogi 側のカルテテンプレート（店舗ID紐づき）

- **テンプレート**: `src/misogi/pages/jobs/office/clients/karteTemplate.js`  
  - `createKarteForStore(storeId, store)` … 店舗IDに紐づいた新規カルテレコード（初期値）を作成  
  - `mergeKarteWithTemplate(existing, storeId, store)` … 既存カルテに不足フィールドをテンプレートで補う
- **ストレージ**: `src/misogi/pages/jobs/office/clients/karteStorage.js`  
  - `getKarte(storeId)` … localStorage から取得  
  - `setKarte(storeId, karte)` … localStorage に保存  
  - `ensureKarteExists(storeId, store)` … 存在しなければテンプレートから作成して保存し、返す  
  - `saveKarte(storeId, karte)` … 保存（localStorage + 任意で POST /api/kartes）

## 関連

- 営業側カルテ: `SalesStoreKartePage`（店舗キー単位の営業カルテ）とは別
- 清掃カルテ簡易版: `src/pages/sales/stores/[id]/chart.html`
- 清掃員向け: `src/pages/staff/schedules/[id]/chart.html`
