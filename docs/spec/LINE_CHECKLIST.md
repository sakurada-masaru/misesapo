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

## YOTEI Monthly Trouble Event Strip (2026-02-13)

- [x] 月間ビューに清掃トラブルイベント（再清掃/不足清掃消化/クレーム再対応）の全幅エリアを追加
- [x] サマリー直下〜日次カレンダー上にタグ集計表示（件数・対象日・現場名）を追加
- [x] タグクリックで該当日の予約表（timeline）へ遷移可能化

## YOTEI Weekly Trouble Event Strip (2026-02-13)

- [x] 週間ビューに清掃トラブルイベント（再清掃/不足清掃消化/クレーム再対応）の全幅エリアを追加
- [x] 週サマリー直下にタグ集計表示（件数・対象日・現場名）を追加
