# LINE_CHECKLIST（P6 完了判定・運用で回り続ける条件）

AGENTS.md 準拠: 変更を finalize する前にここを完了させる。

---

## P6 Phase 1 完了判定

- [ ] `https://misesapo.co.jp/office/work-reports` が本番で表示される（404 でない）
- [ ] 画面表示後、GET /admin/work-reports が 200 を返し rows/items が描画される
- [ ] 詳細で PATCH /admin/work-reports/{id}/state が通り、state と history が更新される
- [ ] 409 は必ず reason を返し、UI は ⚠ 表示 + 再読み込み導線を出す
- [ ] 既存の /work-report（Worker）本番動作（200）が維持される（回帰なし）

## 運用で回り続ける条件（最低限）

- [ ] 静的: GitHub Pages deploy（または CNAME 配信）が通る
- [ ] API: deploy_lambda.sh で Lambda が stg/prod alias にデプロイできる
- [ ] 確認: curl で GET /admin/work-reports が 200、主要画面が開く

---

※ 本番リリースの手順は `docs/spec/RUNBOOK_RELEASE.md` を参照。

## FlowGuide Change Checklist (2026-02-08)

- [x] `src/misogi/pages/FlowGuideScreen.jsx` で `flowData.js` / `messageTemplates.js` を単一参照
- [x] 役割表示を `判断:現場 / 顧客窓口:営業 / 調整:OP` に統一
- [x] 深夜帯（00:00-08:59）は応急対応、09:00以降に正式調整へ切替表示を実装

## Schedule Rebuild Master Spec Checklist (2026-02-08)

- [x] スケジュール再設計の意思決定（全刷新/延命/部分刷新）を明文化
- [x] 顧客側・供給側・サービス構造を1枚仕様に統合
- [x] biz_date（16:00境界）と朝勤/夜勤定義を確定
- [x] V1の実装範囲（今日の自分、dispatch、手動更新）を確定
- [x] 既知競合を `docs/spec/TODO_CONFLICTS.md` に追記

## Admin Schedule Timeline Alignment (2026-02-08)

- [x] `AdminScheduleTimelinePage.jsx` の朝勤/夜勤ラベルを運用定義（夜勤16:00-翌04:00、日勤04:00-16:00）に統一
- [x] タイムライン12時間分割ロジックを 00-12/12-24 から 04-16/16-04 に修正
- [x] 管理スケジュール保存時に `dispatch` へ実行状態（todo/enroute/working/done）を同期
- [x] 管理スケジュール画面の blocks 依存（API取得・作成UI・重複判定）を一時停止

## YOTEI Rebuild Spec (2026-02-08)

- [x] `docs/spec/YOTEI_API_DB_SPEC.md` を新規作成
- [x] `/yotei/*` API と `yotei_schedules` / `yotei_dispatch` の責務を定義
- [x] `worker-availability` 必須依存を撤廃する方針を明文化
- [x] 409レスポンスに `conflicts[]` 必須の要件を明文化

## YOTEI Local Implementation (2026-02-08)

- [x] `AdminScheduleTimelinePage.jsx` のスケジュールI/Oを `/yotei` へ切替
- [x] フェーズ1方針に合わせ、`AdminScheduleTimelinePage.jsx` の `/yotei/dispatch` 実通信を停止
- [x] `lambda_function.py` に `/yotei` CRUD を追加（旧 `/schedules` 非依存）
- [x] `lambda_function.py` に `/yotei/dispatch` GET/PUT/PATCH を追加

## Domain Language Spec (2026-02-08)

- [x] `docs/spec/MISOGI_DOMAIN_SPEC.md` を新規作成
- [x] `yakusoku -> shigoto -> yotei -> ugoki -> houkoku` の責務と命名規則を明文化

## UGOKI Dashboard Phase2 (2026-02-09)

- [x] `/admin/ugoki` を新規追加（病院型: 人×時間）
- [x] 30/60分停滞警告（⚠/🔴）を実装
- [x] 管理override時の reason_code 必須化（NET/DEV/FORGOT/CHAOS/ADMIN/EMG/OTHER）
- [x] 管理入口ホットバーから管制ダッシュボードへの遷移を追加

## UGOKI Dashboard Phase2 (2026-02-09)

- [x]  を新規追加（病院型: 人×時間）
- [x] 30/60分停滞警告（⚠/🔴）を実装
- [x] 管理override時の reason_code 必須化（NET/DEV/FORGOT/CHAOS/ADMIN/EMG/OTHER）
- [x] 管理入口ホットバーから管制ダッシュボードへ遷移追加

## Sales Houkoku Soft Template (2026-02-09)

- [x] `SalesDayReportPage.jsx` の提出必須条件を緩和（案件カード必須項目を撤廃）
- [x] 営業日次フォームを5項目（活動日 / 活動時間 / 本日の成果 / 明日の予定 / 気になった点）中心に簡素化
- [x] 画面から案件カード入力UIと添付UIを外し、日次サマリ単体で提出可能に調整

## YOTEI View Expansion (2026-02-09)

- [x] `/admin/yotei` に `今日 / 週間 / 月間 / 予約表` タブを追加
- [x] 週間ビューで `作業員×7日` の件数・状態集計と日次遷移を実装
- [x] 月間ビューで日別件数カレンダーと0件日警告（⚠）を実装
- [x] 月間ビューに `yakusoku` 消化サマリー（quota/used/remaining）を表示

## Master UI Foundation (2026-02-10)

- [x] `/admin/master/torihikisaki` を新規追加（`name` / `jotai` CRUD）
- [x] `/admin/master/yagou` を新規追加（`torihikisaki_id` フィルタ/選択対応）
- [x] `/admin/master/tenpo` を新規追加（`torihikisaki_id` / `yagou_id` フィルタ/選択対応）
- [x] `/admin/master/souko` を新規追加（`tenpo_id` フィルタ/選択対応）
- [x] `jotai=yuko|torikeshi` を各マスタ画面で統一（DELETE=torikeshi 前提）

## Master Data Gate Path (2026-02-10)

- [x] マスタ投入テンプレート（`torihikisaki/yagou/tenpo/souko`）を `docs/spec/templates/*.csv` に追加
- [x] 「器と道」用の運用手順を `docs/spec/MASTER_DATA_GATE_SETUP.md` に追加

## JINZAI Domain Spec (2026-02-11)

- [x] `docs/spec/JINZAI_DOMAIN_SPEC.md` を新規作成
- [x] `jinzai` の3軸（`koyou_kubun` / `shokushu` / `yakuwari`）を固定
- [x] `jinzai_kaban` とS3（`jinzai-kaban`）の責務分離を明文化

## JINZAI API Scaffold (2026-02-11)

- [x] `lambda_jinzai_api.py` を追加（`/jinzai`・`/jinzai/busho`・`/jinzai/shokushu`・`/jinzai/{id}/kaban`）
- [x] `scripts/setup_jinzai_api.sh` を追加（DynamoDB/Lambda/APIGateway の器作成）
- [x] `scripts/import_jinzai_to_api.py` でCSV投入手順を整備
- [x] `docs/spec/JINZAI_API_SETUP_RUNBOOK.md` を追加

## JINZAI Login Integration (2026-02-11)

- [x] `signInWithCognito` のユーザー解決元を `/workers` から `jinzai-data API` に切替

## Tenpo Karte Support History Layout (2026-02-15)

- [x] 店舗カルテ（詳細）に「対応履歴（短文・200字）」を右カラムに大きく配置（右カラムは幅広・大画面ではsticky）
- [x] 「対応履歴」は短文・構造化入力（date/category/requested_by/handled_by/topic/action/outcome）に限定し、長文は例外メモへ逃がす
- [x] 担当履歴は人材マスタ（候補）から選択でき、必要なら自由入力も可能

## Admin Entrance Cleanup (2026-02-11)

- [x] 「玄関稼働日」ボタン/ページ（`/admin/portal-operating-days`）を撤去（謎の副産物のため）
- [x] `jinzai.shokushu` から `role`（`sales/cleaning/dev/office/admin`）を決定するロジックを追加
- [x] `useAuth` で `sagyouin_id` 優先の `workerId` 解決と `dept` 判定互換を追加
- [x] `scripts/sync_jinzai_cognito_sub.py` を追加（Cognito `sub` の一括反映）

## Customer Registration Refresh (2026-02-11)

- [x] 管理向けの入力特化ページ `/admin/torihikisaki-touroku` を追加（`torihikisaki → yagou → tenpo → souko`）
- [x] 旧「顧客（旧）」ページ（`/office/clients/*`, `/office/stores/*`）をルーティング/導線から除外し、ページ自体も削除
- [x] 旧導線（Office hotbar / AdminScheduleTimeline の「顧客新規登録」）を新ページへ差し替え
- [x] `npm -C src/misogi run build` が通る

## Remove Portal Operating Days UI (2026-02-11)

- [x] 管理ホットバーから「玄関稼働日」を削除
- [x] `/admin/portal-operating-days` ルートとページを削除（未使用化）

## Remove Legacy Report Management (2026-02-11)

- [x] 管理ホットバー「報告」から「全報告管理」を削除
- [x] `/admin/work-reports` ルートと `AdminWorkReportsPage` を削除
- [x] 旧一覧リンクを `/admin/houkoku` に統一
- [x] 管理ホットバー「清掃報告受領」を削除し、「新・報告一覧 (New)」を「報告一覧」に改称

## Global Header Cleanup (2026-02-11)

- [x] `App.jsx` の非フルスクリーン共通ナビ（Portal/Entrance群）を削除
- [x] 全ページで上部ナビヘッダーなしの統一描画に変更

## Tenpo Onboarding API Unification (2026-02-11)

- [x] `POST /master/tenpo/onboarding` を `lambda_torihikisaki_api.py` に追加（`torihikisaki -> yagou -> tenpo` を単一APIで作成）
- [x] 顧客登録（新）に `同時にカルテ作成` チェックを追加し、単一API呼び出しへ切替
- [x] 顧客登録（新）へ追加項目（電話番号/メール/担当者/住所/URL/情報登録者名）を追加
- [x] `tenpo` と `tenpo_karte` 初期データへ基本情報を同時反映
- [x] API側に `idempotency_key` 受け入れと再送時の再利用（重複作成回避）を実装

## Tenpo Karte Always-On Creation (2026-02-11)

- [x] onboarding APIで `tenpo_karte` を常時自動作成（`create_karte` 任意フラグ依存を廃止）
- [x] 顧客登録（新）のチェック項目を「作成可否」ではなく「作成後にカルテ入力へ進むか」に変更
- [x] 登録送信ペイロードの `create_karte` は常に `true` を送信

## Service Master Gate (2026-02-11)

- [x] `service` テーブルを作成（`service_id` PK / `jotai` / `category`）
- [x] 初期サービス3件（`cleaning_regular` / `maintenance_check` / `pest_spot`）を投入
- [x] `lambda_torihikisaki_api.py` に `service` コレクションを追加（`/master/service` CRUD）

## Service Link to Scheduling (2026-02-11)

- [x] `/admin/yotei` の予定モーダルに `service` 選択を追加（`/master/service` 参照）
- [x] `service` 選択時に `work_type` と終了時刻（`default_duration_min`）を自動補完
- [x] `/admin/yakusoku` の案件モーダルに `service` 選択を追加（`service_id/service_name` 保存）

## Service Master UI (2026-02-11)

- [x] 管理マスタ画面 `/admin/master/service` を新規追加
- [x] 管理ホットバー（情報）に「サービスマスタ」導線を追加
- [x] 一覧/新規/編集/取消を `AdminMasterBase` 共通UIで運用可能化

## YOTEI Header Navigation (2026-02-12)

- [x] `/admin/yotei` ヘッダーに `UGOKI` / `YAKUSOKU` への導線を追加
- [x] `/admin/yotei` の `今日/週間/月間/予約表` 切替をヘッダー内へ統合

## YOTEI Status Visualization (2026-02-12)

- [x] タイムラインカードを `未完了/調整中/確認中/進行中/完了/取消` で色分け
- [x] カード内メタ表示に `jokyo/jotai` 正規化ラベルを表示
- [x] 備考フッター凡例に状態タグ（未/調/確/進/完）を追加

## YOTEI Availability Iconization (2026-02-13)

- [x] 週表示セルに予約可能状況アイコン（空きなし/少/あり/十分）を表示
- [x] 月表示セルに予約可能状況アイコン（空きなし/少/あり/十分）を表示
- [x] 週間/月間フッター凡例に予約可能状況アイコンを追加

## Jobs YOTEI Task List (2026-02-15)

- [x] `/jobs/:job/yotei`（閲覧専用）を追加し、自分の `worker_id` の予定をリスト表示できる
- [x] 玄関ホットバーの「予定」導線を `/jobs/*/yotei` に統一（cleaning/sales/office/dev）
- [x] 現場側の入力要求（自由記述/評価/提案）を増やさない（閲覧のみ）

## Master Search Spec & Meibo UX (2026-02-15)

- [x] `docs/spec/MASTER_SEARCH_SPEC.md` を追加（torihikisaki/yagou/tenpo 検索の正規・確定ID方針）
- [x] 取引先名簿の統合検索を NFKC/記号/空白に強い検索へ改善
- [x] 屋号検索時に `取引先/屋号` グルーピングで店舗が一覧できるUIを追加

## Yakusoku -> Yotei Operation MVP (2026-02-15)

- [x] 管理UI `/admin/yakusoku` で `tenpo_id/type/service_ids` を前提に案件作成できる
- [x] API `/yakusoku` が `service_ids/service_names/tenpo_name` を保存し、必須項目を 400 で拒否できる
- [x] 管理UI `/admin/yotei` の予定作成で `yakusoku_id` を必須にし、選択時に `tenpo_id/tenpo_name` を自動設定できる
- [ ] Worker 側 `/jobs/:job/yotei` で「自分の割当」が週間/当日で見えることを実データで確認（本番投入後）

## KADAI / Admin Log UI (2026-02-15)

- [ ] 管理エントランス（運用ツール）から `Kadaiリスト` が開ける
- [ ] `Kadaiリスト` で `新規登録/編集/取消` が動作する（ブラウザが固まらない）
- [ ] 管理エントランス（報告）から `管理ログ(提出)` が開ける
- [ ] `管理ログ(提出)` は `Fact/Interpretation/Decision/NextAction` の分離入力ができ、保存できる

## Cleaning Houkoku Sheets Upload (2026-02-15)

- [ ] 清掃の提出画面（`/jobs/cleaning/report`）が「アップロードのみ」になっている
- [ ] 報告書1/2/3 を各1枚アップロードできる（差し替え可能）
- [ ] 3/3 揃うまで提出できない

## MISOGI Portuguese i18n Rollout (2026-02-17)

- [x] `I18nProvider` を `main.jsx` に適用（全ページ共通）
- [x] パンくず右上に `日本語 / Português(BR)` 切替を配置
- [x] 入口ページでも言語切替を表示（breadcrumbs非表示条件から独立）
- [x] `ptJaMap.js` を拡張し、Portal/Entrance/管理主要ラベルを翻訳
- [x] `npm -C src/misogi run build` が通る

## YOTEI Monthly Trouble Event Strip (2026-02-13)

- [x] 月間ビューに清掃トラブルイベント（再清掃/不足清掃消化/クレーム再対応）の全幅エリアを追加
- [x] サマリー直下〜日次カレンダー上にタグ集計表示（件数・対象日・現場名）を追加
- [x] タグクリックで該当日の予約表（timeline）へ遷移可能化

## YOTEI Weekly Trouble Event Strip (2026-02-13)

- [x] 週間ビューに清掃トラブルイベント（再清掃/不足清掃消化/クレーム再対応）の全幅エリアを追加
- [x] 週サマリー直下にタグ集計表示（件数・対象日・現場名）を追加

## ICS Tenpo Geo Sync (2026-02-13)

- [x] `scripts/sync_tenpo_geo_from_ics.py` を追加（dry-run既定 / `--apply` で反映）
- [x] `tenpo` への `address` / `map_url` / `google_map_url` 反映ロジックを追加
- [x] `docs/spec/ICS_TENPO_GEO_SYNC_RUNBOOK.md` を追加（手順・注意点・検証方法）

## Tenpo Places Details Sync (2026-02-13)

- [x] `scripts/sync_tenpo_places_details.py` を追加（dry-run既定 / `--apply` で反映）
- [x] `tenpo` への `phone` / `opening_hours` / `maps_place_id` 反映ロジックを追加
- [x] `docs/spec/TENPO_PLACES_SYNC_RUNBOOK.md` を追加（Google Places 同期手順）

## Service Price Sync From Quote CSV (2026-02-13)

- [x] `scripts/sync_service_price_from_quote_csv.py` を追加（dry-run既定 / `--apply` で反映）
- [x] 料金表CSVの価格列（毎月/隔月/四半期/半年/年間/スポット）を選択して `default_price` 更新可能化
- [x] 名称ゆらぎに対して fuzzy match + 閾値指定（`--min-score`）で誤更新を抑止

## YOTEI Worker Display Stability (2026-02-13)

- [x] `SAG#...` を `SAGYOUIN#...` と同一扱いにする正規化を追加（集計/表示の揺れ抑止）
- [x] `sagyouin_name` が空でも `jinzai` マスタから表示名を解決するフォールバックを追加
- [x] 予定保存時に `sagyouin_name` を同梱して空欄を減らす

## JINZAI Partner Change UI (2026-02-13)

- [x] 人材マスタ編集モーダルに「契約主体変更」UIを追加（`partner_type/partner_id` 更新 + `partner_history` 追記）
- [x] `AdminMasterBase` に `renderModalExtra` を追加して、マスタ種別ごとに拡張UIを差し込めるようにした

## Global Back Button (2026-02-13)

- [x] 全ページ共通の「戻る」ボタンを `App.jsx` に追加（履歴が無い場合は適切なトップへフォールバック）

## Admin Houkoku List View Modes (2026-02-13)

- [x] `/admin/houkoku` に表示形式（`日/週/月/カレンダー`）の切替を追加
- [x] 週/月は提出状況（提出/未提出）をサマリ化し、未提出者をタグ表示
- [x] 戻るボタンを `/admin`（管理トップ）へ明確化（アイコンのみ→ラベル付き）

## Global Nav Unification (2026-02-14)

- [x] 固定ナビ（戻る / コンテキストトップ / ハンバーガー）を `GlobalNav` に統一
- [x] 各ページの重複した「管理トップ」「ハンバーガー」表示を撤去して重なりを解消

## Kadai List (2026-02-14)

- [x] 管理エントランス `運用ツール` に `Kadaiリスト` 導線を追加
- [x] `/admin/kadai` を追加（一覧/新規/編集/取消）
- [x] `kadai` collection を `lambda_torihikisaki_api.py` に追加（テーブル env `TABLE_KADAI`）
- [x] 運用手順を `docs/spec/KADAI_LIST_RUNBOOK.md` に追加

## JINZAI Affiliation Normalization (2026-02-16)

- [x] 所属区分（`han_type`）を `internal | gaibu` に一本化する方針を実装
- [x] 既存の `han_type = kigyou/kojin` は UI 上 `gaibu` として吸収表示
- [x] 正規化スクリプトで `koyou_kubun` に応じて `han_type` を補正（`gyomu_itaku/haken_shain -> gaibu`）
- [x] `koyou_kubun=役員` を `seishain` に正規化する吸収ルールを追加

## YOTEI / Tenpo Karte Contact Fields (2026-02-16)

- [x] `MyYoteiListPage` 詳細に `住所` / `電話番号` / `連絡手段` を表示
- [x] `MyYoteiListPage` は `tenpo` 参照時に `address/phone/contact_method` を取得するよう拡張
- [x] `AdminTenpoKartePage` の基本情報に `連絡手段` 表示を追加
- [x] `AdminTenpoKartePage` のカルテ詳細（運用・鍵）に `連絡手段` 入力項目を追加

## Admin Log Simplification (2026-02-16)

- [x] `管理ログ提出` を「日付 / 提出者 / PR本文 / 状態」の最小入力に簡素化
- [x] `name` 必須制約に対して、保存時に `PR本文` 先頭行から自動補完するよう統一
- [x] 関連課題（`related_kadai_ids`）は自由入力に統一し、選択UI/タグ表示を廃止（IDはカンマ/空白区切り）

## Master Visibility & Jinzai Meibo Label Alignment (2026-02-16)

- [x] `人材名簿` の表示を `人材マスタ` と同じ正規化基準（所属区分/契約主体/契約形態）に統一
- [x] 管理/情報のマスタ系ルートを `sakurada@misesapo.co.jp` 限定で表示するガードを追加

## MISOGI Portuguese i18n Rollout (2026-02-17)

- [x] `ptJaMap.js` に入口・日次運用の頻出ラベル（営業/清掃/事務/開発/予定/報告/完了系/再清掃系）を追加
- [x] 追加後に `npm -C src/misogi run build` を実行し、ビルド成功を確認
- [x] 管理ページ系の未設定/エラー/定期清掃バリエーション文言を追加し、再ビルド成功を確認
- [x] ログイン/工程案内/清掃運用エラー文言を追加し、再ビルド成功を確認

## Office Houkoku Minimal Structured Fields (2026-02-18)

- [x] 事務報告（`OFFICE_ADMIN_V1`）に `アカウント名` / `業務開始` / `業務終了` を追加
- [x] 事務報告の業務時間を複数枠で入力できるようにし、合計を `総時間` として表示/保存
- [x] 事務報告の入力を「チェックリスト + 件数 + 例外（短文）」中心へ変更（長文ナラティブ入力を撤去）
- [x] 管理一覧のプレビューで `OFFICE_*` を事務として扱う表示を改善

## Tenpo Karte Summary / Support UX (2026-02-20)

- [x] `AdminTenpoKartePage` の概要（基本情報）に `営業担当` / `サービスプラン` を追加
- [x] `AdminTenpoKartePage` の詳細（運用・鍵）に `営業担当` 入力欄を追加し、概要表示と連動
- [x] 概要の `基本情報` / `対応履歴` / `ストレージ` を高さいっぱい運用し、カード内スクロールで閲覧できるよう調整
- [x] `対応履歴` を履歴ごとのスレッド返信（最大200字、発言者/時刻付き、保存時確定）へ改善
- [x] `報告設計`（現場必須項目/顧客必須項目/提出期限/チェックポイント基準）をカルテ詳細に追加
- [x] `使用薬剤・資材` を構造化追加（名称/希釈率/使用量/単位/対象箇所/備考）
- [x] カルテ詳細の余白・グリッド間隔を調整し、情報密度と可読性を改善
- [x] `npm -C src/misogi run build` でビルド成功を確認

## Master Access Policy Update (2026-02-21)

- [x] 管理/情報のマスタ系アクセス制御を「特定メール固定」から「admin権限」判定へ変更
- [x] `/admin/master/*` および関連名簿/店舗カルテルートのガードを admin 判定に統一

## Tenpo Karte Mobile Input UX (2026-02-21)

- [x] `AdminTenpoKartePage` をモバイル初期表示で入力しやすい `カルテ詳細` モードに変更
- [x] モバイル用の固定アクション（保存/概要）を追加し、長文フォームでも保存操作しやすく改善
- [x] 店舗カルテのヘッダー/フォームをスマホ向けに再レイアウト（2列→1列、入力UIのタップサイズ最適化）
