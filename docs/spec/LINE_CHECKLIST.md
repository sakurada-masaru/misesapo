# LINE_CHECKLIST（P6 完了判定・運用で回り続ける条件）

AGENTS.md 準拠: 変更を finalize する前にここを完了させる。

---

## Cleaning Entrance: HOTBAR Bottom Padding Tuning (2026-03-07)

- [x] スマホ実機で下端が詰まらないよう、HOTバーの下側余白を拡大
- [x] `env(safe-area-inset-bottom)` を維持したまま追加パディングを加算
- [x] `npm -C src/misogi run build` でビルド成功を確認

## Cleaning Entrance: HOTBAR LINE-Style Nav (2026-03-07)

- [x] HOTバーを `LINE` の下部メニュー風UIへ調整（アイコン上・ラベル下の縦配置）
- [x] `報告 / 予定 / ツール / 設定` に対応するアイコンを `Hotbar` コンポーネントへ追加
- [x] アクティブ状態を `LINE` 風の緑アクセントで表示（`#06c755`）
- [x] 下部固定バーの高さ・余白を `LINE` 近いサイズ感へ調整
- [x] `npm -C src/misogi run build` でビルド成功を確認

## Cleaning Entrance: Header Removal + HOTBAR 4 Categories (2026-03-07)

- [x] 清掃エントランス (`/jobs/cleaning/entrance`) では共通ヘッダーを非表示化し、`戻る` / `ハンバーガー` を非表示
- [x] 清掃HOTバーを `報告 / 予定 / ツール / 設定` の4カテゴリへ変更
- [x] 清掃エントランスの `設定` タブで `言語` / `表示(テーマ)` を直接変更できるパネルを追加
- [x] HOTバーの左右パディングを拡大し、画面端に寄りすぎないよう調整
- [x] `npm -C src/misogi run build` でビルド成功を確認

## Yasumi: Grid Border Visibility Restore (2026-03-07)

- [x] 清掃員 `休み申請カレンダー` のセル枠線色を専用変数 `--gcal-grid-line` に分離し、常時視認できるよう調整
- [x] 管理 `yasumi` のセル枠線色を専用変数 `--yasumi-grid-line` に分離し、ライト/ダーク双方で見える濃度へ調整
- [x] `npm -C src/misogi run build` でビルド成功を確認

## Cleaning Yasumi: Subtitle Label Removal (2026-03-07)

- [x] 清掃員 `休み申請カレンダー` のヘッダー補助文言 `清掃員ジョブモード / Googleカレンダー風 月表示` を削除
- [x] 清掃員向け `yasumi` 画面で不要ラベルが表示されないことをソース上で確認
- [x] `npm -C src/misogi run build` でビルド成功を確認

## Cleaning Entrance: Mobile Header Safe Area Offset (2026-03-07)

- [x] 清掃エントランス（スマホ）で上部の `戻る` / `ハンバーガー` がOSステータスバーと重ならないよう調整
- [x] `breadcrumbs.css` に `env(safe-area-inset-top/left/right)` を追加し、ヘッダー全体を安全領域分オフセット
- [x] `@media (max-width: 900px)` でスマホ向け上部余白を追加調整
- [x] `npm -C src/misogi run build` でビルド成功を確認

## Cleaning Yasumi: Remove Fixed 6-Week Grid (2026-03-07)

- [x] 清掃員 `休み申請カレンダー` の月グリッド生成を 6週固定から可変週へ変更
- [x] `ContractorAvailabilityDeclarationPage.jsx` の `buildCalendarCells` を `weekCount` 算出方式へ修正
- [x] `contractor-availability-declaration.css` の `.gcal-grid` を `grid-template-rows: repeat(6,...)` から `grid-auto-rows` へ変更
- [x] `npm -C src/misogi run build` でビルド成功を確認

## Product Demo: Chinese Tablet Menu (2026-03-06)

- [x] `src/misogi/pages/product/ChineseTabletMenuPage.jsx` を追加（タブレット注文UI / PC受信UI）
- [x] `src/misogi/pages/product/chinese-tablet-menu.css` を追加（タブレット・PC両レイアウト）
- [x] タブレット注文送信時に PC 側へリアルタイム通知（`BroadcastChannel` + `localStorage` fallback）を実装
- [x] `master/admin_chat` を利用した端末間同期（タブレット⇄PCの別端末共有）を追加
- [x] PC 側で注文ステータス更新（`新規/調理中/提供準備完了/提供済み`）を実装
- [x] ルーターに `/product/chuka-menu` と `/product/chinese-tablet-menu` を追加
- [x] `npm -C src/misogi run build` でビルド成功を確認

## Admin Entrance: Dashboard / Filebox Split (2026-03-06)

- [x] 管理サイドバーの `ダッシュボード` と `ファイルボックス` を独立項目へ分離
- [x] ルーターに `/admin/dashboard` を追加し、ダッシュボード導線を新設
- [x] `/admin/dashboard` は `共通チャット + 本日の更新通知（現在アクティビティ）` を表示
- [x] `/admin/filebox` はファイル管理UI（フォルダ/アップロード/閲覧）のみに整理
- [x] `Breadcrumbs` のラベル・ペイントグル対象を `dashboard` 基準へ調整
- [x] `npm -C src/misogi run build` でビルド成功を確認

## Contractor Availability Declaration Tool (2026-03-05)

- [x] `ContractorAvailabilityDeclarationPage.jsx` を追加し、業務委託者向けの月次稼働予定申告UIを実装（1日4択: 稼働可/午前のみ/午後のみ/休み）
- [x] UIをGoogleカレンダー風の月グリッドへ再構成し、日別予定チップを表示
- [x] 期間指定（開始日/終了日）で一括休み申請できるフォームを追加
- [x] 自由記述を廃止し、`reason_note` は `DECL_V1:*` の構造化コードで保存するよう統一
- [x] `/blocks` 保存前に `detectBlockConflicts` で既存予定重複を検出し、重複時は保存を拒否
- [x] ルーターに `/jobs/cleaning/availability-declare` を追加し、清掃エントランスの `予定` タブに導線を追加
- [x] `npm -C src/misogi run build` でビルド成功を確認

## HamburgerMenu Maximum Update Depth Fix (2026-02-26)

- [x] `HamburgerMenu.jsx` の `filteredLinks` を `useMemo` 化し、毎レンダーで新配列が生成されないよう修正
- [x] セクション初期化 `useEffect` で同値 state 更新を抑止（`openSections` 差分なしなら `prev` を返す）
- [x] アクティブセクション展開 `useEffect` で no-op 更新を抑止（既に開いている場合は更新しない）
- [x] `npm -C src/misogi run build` でビルド成功を確認

## Admin Light Visualizer Black Tone (2026-02-26)

- [x] `components.css` でライトモード時の `data-job="admin"` に限定して `--accent-color` を黒へ上書き
- [x] 同上で `--accent-glow` を透明化し、余計な光彩（青み含む）を抑止
- [x] 管理ライトモード限定で `Visualizer` コアの `box-shadow` と `filter(blur)` を無効化
- [x] 管理ライトモード限定でエントランス背景の青系グラデーションを黒系へ置換
- [x] `npm -C src/misogi run build` でビルド成功を確認

## February Daily PR Report Document (2026-02-26)

- [x] `docs/spec/PR_DAILY_REPORT_2026_02.md` を新規作成
- [x] `2026-02-01` 起点で日付順に主要実装を要約
- [x] 未完タスク（2026-02-15起票）を継続項目として明記

## Admin Log Modal Field Order Tuning (2026-02-26)

- [x] `AdminAdminLogPage.jsx` の新規登録モーダルで `日誌本文` と `明日の予定` を縦積み表示へ変更
- [x] `明日の予定` が `日誌本文` の直下に出るよう `modalColSpan` を調整
- [x] `npm -C src/misogi run build` でビルド成功を確認

## Admin Diary Backfill Script (2026-02-26)

- [x] `scripts/create_kanri_logs_from_pr_report.py` を追加（PR日次報告から `kanri_log` を自動生成）
- [x] 2/17〜2/25 の投入を実行し、重複日付は自動スキップで保護
- [x] `python3 -m py_compile scripts/create_kanri_logs_from_pr_report.py` で構文確認

## Admin Diary Date Strip Light Theme Tuning (2026-02-26)

- [x] `admin-log-date-strip` / `admin-log-monthly-list` のライトモード配色を調整
- [x] 月切替ボタン・月次チップの枠線/背景/文字色をライトモード向けに調整
- [x] active/hover 状態の視認性を改善
- [x] `npm -C src/misogi run build` でビルド成功を確認

## Admin Diary Submitter Tag Filter (2026-02-26)

- [x] 管理日誌月次ヘッダーに提出者別タグ（件数付き）を追加
- [x] タグクリックで提出者フィルタ（全員/個人）を切替可能に実装
- [x] 提出者候補を `jinzai`（管理系ロール）から取得し、未提出者も `0件` で表示
- [x] 月切替時に存在しない提出者選択は自動で `全員` にリセット
- [x] ライト/ダーク両テーマで提出者タグ配色を調整
- [x] `npm -C src/misogi run build` でビルド成功を確認

## Admin Diary List Sort By Reported Date (2026-02-26)

- [x] 管理日誌一覧のソートを `reported_at`（日付）優先へ変更
- [x] 同日内のみ `updated_at`（更新時刻）で並ぶように調整
- [x] `npm -C src/misogi run build` でビルド成功を確認

## Admin Diary Aggregation Refresh Fix (2026-02-26)

- [x] `AdminAdminLogPage.jsx` の `fetchAdminLogItems` 実行時に `allAdminLogs` も同時更新するよう修正
- [x] 管理日誌の保存/取消後に `loadItemsOverride` 再実行で月次・提出者集計が最新化されるよう調整
- [x] 集計専用の初回 `useEffect` 二重取得を削除し、取得経路を一本化
- [x] 管理日誌集計取得（`kanri_log`）に 12秒タイムアウトを追加し、`読み込み中...` 固着を防止
- [x] 管理日誌ページの `parentSources.kadai` 取得を廃止し、親データ大量取得による `ERR_INSUFFICIENT_RESOURCES` を抑止
- [x] 提出者セレクトを `submitterCandidates + 既存ログ提出者` 由来に変更し、`parents` 依存なしで選択肢を維持
- [x] `npm -C src/misogi run build` でビルド成功を確認

## Admin Diary Legacy Source Removal (2026-02-26)

- [x] `AdminAdminLogPage.jsx` の管理日誌取得から `kadai`（legacy）参照を削除
- [x] 管理日誌一覧を `kanri_log` コレクションのみで表示するよう統一
- [x] `npm -C src/misogi run build` でビルド成功を確認

## Sidebar Visual Alignment (Entrance / Page) (2026-02-26)

- [x] `hamburger-menu.css` を `job-entrance-sidebar` と同じ情報設計（幅・階層・アクティブ表示）に統一
- [x] ライト/ダーク配色をエントランス側のトーンに合わせて調整
- [x] `npm -C src/misogi run build` でビルド成功を確認

## Sidebar Settings Placement (2026-02-26)

- [x] `JobEntranceScreen.jsx` のサイドバー下部に「設定」セクションを追加
- [x] 設定セクションに `LanguageSwitcher`（言語）と `ThemeToggle`（ダーク/ライト）を追加
- [x] `components.css` でサイドバー内設定セクションのライト/ダーク両対応スタイルを追加
- [x] `npm -C src/misogi run build` でビルド成功を確認

## Admin Log Historical Visibility Fix (2026-02-26)

- [x] `AdminAdminLogPage.jsx` の一覧取得を `kanri_log` + 旧 `kadai(admin_log/kanri_logタグ)` の統合取得に変更
- [x] 月次チップに旧データも含め、現在月にデータがない場合は最新提出月へ自動切替
- [x] 旧 `kadai` 管理ログは参照専用表示にし、編集/取消ボタンを非表示化
- [x] `AdminMasterBase.jsx` に `loadItemsOverride` / `canEditRow` 拡張を追加
- [x] `npm -C src/misogi run build` でビルド成功を確認

## Admin Log Preview Layout Tuning (2026-02-26)

- [x] 管理日誌プレビュー（行展開）の2カラム詳細レイアウトを管理日誌専用CSSで再定義
- [x] 情報カード/本文エリア/保存ボタンの視認性と余白を調整（ライト/ダーク両対応）
- [x] モバイル幅（`max-width: 980px`）で1カラムに自動切替
- [x] `npm -C src/misogi run build` でビルド成功を確認

## Admin Entrance Header Removal (2026-02-26)

- [x] `/admin/entrance` で `Breadcrumbs` を描画しないよう調整（管理エントランスのヘッダー非表示）
- [x] `npm -C src/misogi run build` でビルド成功を確認

## Global Header Common Chat Overlay (2026-02-26)

- [x] 共通ヘッダーに `CommonHeaderChat` を追加（右側チャット呼び出しボタン）
- [x] チャットUIをドロワーではなく「移動可能なオーバーレイボックス」に変更
- [x] オーバーレイに送受信・5秒更新・閉じる・リサイズ（`resize: both`）を実装
- [x] スマホ幅（`<=900px`）では共通チャットを非表示化
- [x] `npm -C src/misogi run build` でビルド成功を確認

## Common Header Chat Dedicated S3 Storage (2026-02-26)

- [x] `lambda_torihikisaki_api.py` に `CHAT_STORAGE_BUCKET`（未設定時は `STORAGE_BUCKET` フォールバック）を追加
- [x] `admin_chat` に `mode=presign_upload` を追加し、`admin_chat/{room}/YYYY/MM/...` へアップロードURLを発行
- [x] `admin_chat` GET 一覧で `attachment_key` を自動presignして `attachment_url` を返す処理を追加
- [x] `CommonHeaderChat.jsx` に添付アップロード（S3 presign -> PUT）と添付付き投稿を実装
- [x] `breadcrumbs.css` に添付プレビュー/リンク/選択済み表示のスタイルを追加
- [x] 複数添付（写真/ファイル）を1投稿で送信できるように実装
- [x] 共有データ(JSON)を投稿本文と一緒に送受信・表示・コピーできるように実装
- [x] `python3 -m py_compile lambda_torihikisaki_api.py` 成功
- [x] `npm -C src/misogi run build` 成功

## Common Header Chat Translation Button (2026-02-27)

- [x] `lambda_torihikisaki_api.py` の `admin_chat` に `mode=translate_text` を追加（AWS Translate連携）
- [x] 共通チャットに翻訳先言語セレクタ（日本語/ポルトガル語/英語）を追加
- [x] 他者メッセージに「翻訳/原文」ボタンを追加し、翻訳結果をメッセージ直下に表示
- [x] 翻訳結果をメッセージ単位でキャッシュし、同じ文面の再翻訳呼び出しを抑止
- [x] `mode` 欠落時でも翻訳ペイロードを自動判定できるよう `admin_chat` POST の翻訳判定を拡張
- [x] AWS Translate エラー時は 500 ではなく 200 + 原文フォールバック返却に変更（チャット操作継続）
- [x] `admin_chat` POST で `text` キーがあれば翻訳扱いに統一（判定条件を単純化）
- [x] 例外ハンドラでも翻訳ペイロード時は 200 + 原文フォールバック返却するガードを追加
- [x] フロント翻訳先デフォルトを `auto`（`ja⇄pt`）に変更し、同一言語判定時は自動反転で再翻訳
- [x] `python3 -m py_compile lambda_torihikisaki_api.py` 成功
- [x] `npm -C src/misogi run build` 成功

## Entrance Chat Unification (2026-02-26)

- [x] `JobEntranceScreen.jsx` の管理エントランス専用チャット（`admin_entrance`）を廃止
- [x] 管理エントランスで `CommonHeaderChat` を利用するよう統一
- [x] エントランス用にチャット呼び出しボタン位置を `components.css` で固定
- [x] `npm -C src/misogi run build` 成功

## Common Chat S3 Presign Stability (2026-02-26)

- [x] `lambda_torihikisaki_api.py` の S3 client を `region=ap-northeast-1` + `signature_version=s3v4` 固定化
- [x] S3 presigned URL のグローバル endpoint/古い署名形式による CORS 失敗リスクを低減
- [x] `python3 -m py_compile lambda_torihikisaki_api.py` 成功

## Common Header Chat: Own Message Delete (2026-02-26)

- [x] `CommonHeaderChat.jsx` に自分の投稿のみ `削除` ボタンを追加（削除中状態つき）
- [x] `lambda_torihikisaki_api.py` の `admin_chat` PUT/DELETE で投稿者チェックを追加（本人以外は 403）
- [x] `admin_chat` POST 時に `sender_id/sender_name/created_by` を補完して投稿者判定を安定化

## Common Header Chat: Mine Alignment Restore (2026-02-27)

- [x] チャットの「自分投稿判定」を `sender_id` 単独比較から複合比較（`sender_id/created_by/sender_name/email系`）へ拡張
- [x] 右寄せ（`.header-chat-item.mine`）が再度適用されるよう `CommonHeaderChat.jsx` の `mine` 判定を修正
- [x] `python3 scripts/create_kanri_logs_from_pr_report.py --from 2026-02-23 --to 2026-02-26` を実行し、既存4件を確認（created=0 / skipped=4）

## Common Header Chat: Unread Badge (2026-02-27)

- [x] ヘッダーチャット呼び出しボタンに未読バッジを追加（`99+` 上限表示）
- [x] 既読管理を `localStorage`（ユーザー×room単位）で保持し、チャットを開いた時点でバッジを消去
- [x] チャットが閉じている間も5秒ポーリングで新着検知し、未読数を更新


## Master Registration Integrity Check (2026-02-25)

- [x] `lambda_torihikisaki_api.py` で `name` / 親IDの空白のみ入力を作成時に拒否
- [x] `torihikisaki/yagou/tenpo/souko` のID直接指定を作成時に拒否（連番ポリシー保護）
- [x] `torihikisaki/yagou/tenpo` の同名アクティブ重複をサーバ側で作成時に拒否
- [x] `AdminMasterBase.jsx` で空白文字のみセルを `-` 表示に統一
- [x] `python3 -m py_compile lambda_torihikisaki_api.py` 成功
- [x] `npm -C src/misogi run build` 成功

## Parent Link Safety / Existing Add Fix (2026-02-26)

- [x] `lambda_torihikisaki_api.py` に親子整合性チェックを追加（`yagou->torihikisaki` / `tenpo->(torihikisaki,yagou)` / `souko,keiyaku->tenpo`）
- [x] `tenpo` 保存時に `yagou_id` と `torihikisaki_id` の不整合をサーバ側で拒否
- [x] 既存不整合データの通常更新を止めないよう、`PUT` は親キー変更時のみ整合性検証
- [x] `AdminTorihikisakiTourokuPage.jsx` で取引先変更時の屋号自動引継ぎを停止（同一取引先に存在する屋号IDのみ維持）
- [x] `python3 -m py_compile lambda_torihikisaki_api.py` 成功
- [x] `npm -C src/misogi run build` 成功

## Yagou Fallback Rule Fix (2026-02-26)

- [x] 問診票作成（onboarding）で `yagou_name` 未入力時は `torihikisaki_name` を継承（店舗名継承は禁止）
- [x] 問診票作成（onboarding）で `tenpo_name` 未入力時は `yagou_name` を継承
- [x] `AdminTorihikisakiTourokuPage.jsx` の一括作成で屋号未入力を許可し、同じフォールバック規則に統一
- [x] `AdminTorihikisakiTourokuPage.jsx` の一括作成で店舗名未入力を許可し、`tenpo_name <- yagou_name` を適用
- [x] idempotency key 生成も `effective yagou`（未入力時は取引先名）に統一
- [x] `python3 -m py_compile lambda_torihikisaki_api.py` 成功
- [x] `npm -C src/misogi run build` 成功

## Meibo Yagou Fallback Display Fix (2026-02-25)

- [x] `屋号名なし` の表示を `取引先直下` 表示へ変更（`yagou_id` 生値表示を抑止）
- [x] 該当店舗のカルテ遷移時、`屋号名なし` ブロックでは `yagou_id` クエリを空で渡すよう調整
- [x] `npm -C src/misogi run build` 成功

## 店舗マスタ 全件表示化 (2026-02-25)

- [x] `AdminMasterTenpoPage` で `listLimit={20000}` を指定し、店舗マスタを全件表示

## 取引先/屋号マスタ 表示件数拡張 (2026-02-25)

- [x] `AdminMasterTorihikisakiPage` で `listLimit={20000}` を指定
- [x] `AdminMasterYagouPage` で `listLimit={20000}` を指定
- [x] `AdminMasterYagouPage` の取引先親ソース取得上限を `limit=20000` に拡張

## 取引先/屋号/店舗マスタ 検索追加 (2026-02-25)

- [x] 取引先マスタに統合検索（`torihikisaki_id`, `name`）を追加
- [x] 屋号マスタに統合検索（`yagou_id`, `name`, `torihikisaki_id`）を追加
- [x] 店舗マスタに統合検索（`tenpo_id`, `name`, `yagou_id`, `torihikisaki_id`）を追加

## Keiyaku/Yakusoku Separation Integration (2026-02-24)

- [x] `master` API に `keiyaku` コレクションを追加し、CRUD・親キー（`tenpo_id`）・フィルタを有効化
- [x] 管理マスタに `契約マスタ (keiyaku)` 画面と導線（router / hotbar / breadcrumb）を追加
- [x] `/admin/yakusoku` で `keiyaku` 選択を必須化（新規定期）し、一覧にも契約列を表示
- [x] 顧客登録の契約書 `管理` 保存で `souko` 保存と同時に `keiyaku` を作成/更新するよう連携
- [x] `npm -C src/misogi run build` でビルド成功を確認

## Keiyaku Preview Word-like Layout (2026-02-24)

- [x] `契約マスタ (keiyaku)` の行クリックでプレビューを開く導線を維持
- [x] 契約プレビューを「白地＋罫線テーブル」の申込書レイアウトへ変更
- [x] プレビューモーダル幅を拡張し、PCで横スクロールしにくい表示に調整
- [x] `npm -C src/misogi run build` でビルド成功を確認

## Keiyaku Contract ZIP Import Prep (2026-02-25)

- [x] `keiyaku` プレビューを実契約書の縦型フォーム（ラベル+記入欄）に寄せる調整
- [x] ZIP内 `docx` を直接解析して契約情報を抽出する `scripts/import_keiyaku_from_contract_zip.py` を追加
- [x] サンプルZIPで `docx=132` 件の解析を確認（出力: `/tmp/keiyaku_zip_parsed.json`）
- [x] `npm -C src/misogi run build` でビルド成功を確認

## Admin Houkoku Visibility Fix (2026-02-23)

- [x] 管理報告一覧の日表示を `/admin/work-reports` 優先取得に変更（`states` に `approved/archived` も含める）
- [x] 互換のため `/houkoku` 取得結果を日表示でマージ（重複除外）する
- [x] 報告詳細を `/admin/work-reports/{id}` 優先＋`/houkoku/{id}` フォールバックに変更
- [x] `npm -C src/misogi run build` でビルド成功を確認

## Admin Houkoku Template Resolve Fix (2026-02-26)

- [x] `OFFICE_ADMIN_V1` テンプレートを追加し、事務報告を専用テンプレートで表示
- [x] `ENGINEERING_V1` テンプレートを追加し、開発報告を専用テンプレートで表示
- [x] `getTemplateById` に `OFFICE_*` / `ENGINEERING_*` / `DEV_*` のフォールバック解決を追加
- [x] `npm -C src/misogi run build` でビルド成功を確認

## Customer Registration Contract Tab (2026-02-24)

- [x] `管理 > 登録` に「契約書作成」タブを追加（モバイルタブ切替対応）
- [x] 契約書雛形（利用者登録 申込書）の主要項目をフォーム化（申込日/利用開始日/法人/担当/連絡先/店舗/条項）
- [x] 新規追加入力・既存選択から契約書項目へ差し込み反映を追加
- [x] 契約書プレビューと `.txt` 出力を追加
- [x] `npm -C src/misogi run build` でビルド成功を確認

## Customer Registration Contract PDF/Souko (2026-02-24)

- [x] 契約書タブで `PDF保存（端末）` を実装（スマホ/PCダウンロード対応）
- [x] 契約書タブで `PDFをsouko保存` を実装（`presign_upload` -> S3 PUT -> souko.files 更新）
- [x] souko保存の `doc_category` を `contract` に統一（店舗ストレージ表示互換）
- [x] 契約書印刷用テンプレートを非表示オフスクリーン領域で描画（画面表示を崩さずPDF生成）
- [x] `npm -C src/misogi run build` でビルド成功を確認

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

## Monshin Flow Hardening (2026-02-22)

- [x] 顧客登録（新）の「一括作成」導線文言を「問診票を作成」に統一
- [x] 顧客登録（新）→店舗詳細遷移を `?mode=monshin` 付きに統一
- [x] 店舗詳細に「問診票チェック（必須項目進捗）」を追加（担当者連絡先/鍵の扱い/営業時間/立会い/営業担当/契約/報告設計）
- [x] 店舗詳細の保存前チェックで「担当者連絡先」「鍵の扱い」を必須化

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

## Torihikisaki Registration Metadata (2026-02-21)

- [x] `AdminTorihikisakiTourokuPage` の `情報登録者名` をログイン中アカウント名で自動入力
- [x] 取引先登録（新規一括/既存追加）時に `touroku_date`（登録日）を自動付与
- [x] `lambda_torihikisaki_api.py` のオンボーディング作成でも `touroku_date` を `torihikisaki/yagou/tenpo/souko/karte` に保存

## Tenpo Karte Detail Layout Adjust (2026-02-21)

- [x] 詳細レイアウトを再配置（左: `プラン・評価` → `運用・鍵` → `担当履歴`、中央: `報告設計`、右: `消耗品` → `使用薬剤・資材`）
- [x] `例外メモ` 入力カードを削除し、関連文言（説明/必須項目）からも除去

## Yagou Master Label Rendering (2026-02-21)

- [x] `AdminMasterBase` の `select` 型カラム表示をラベル解決（`sourceKey`/`options`）対応に拡張
- [x] `yagou` マスタ一覧の `取引先` を `torihikisaki_id` ではなく取引先名で表示
- [x] `AdminMasterYagouPage` の `torihikisaki` 親データ取得上限を `5000` に拡張（名前解決漏れ防止）
- [x] `AdminMasterTenpoPage` の `取引先/屋号` 親データ取得上限を `5000` に拡張（店舗マスタでの名称表示漏れ防止）
- [x] `npm -C src/misogi run build` でビルド成功を確認

## Torihikisaki Meibo Row Layout (2026-02-21)

- [x] 取引先エリアのチェックボックスを名前の左に移動
- [x] 取引先行を1行レイアウト化（左: チェック + 名前 / 右: ID + 屋号件数）
- [x] 長いID/名称は省略表示して行の横はみ出しを防止
- [x] `npm -C src/misogi run build` でビルド成功を確認

## Tenpo Karte Basic Info Additions (2026-02-21)

- [x] `AdminTenpoKartePage` 基本情報に `営業時間` を追加（概要表示）
- [x] `AdminTenpoKartePage` 基本情報に `お客様立会い（あり/なし/不明）` を追加（概要表示）
- [x] `AdminTenpoKartePage` 詳細 `運用・鍵` に `営業時間` 入力欄を追加
- [x] `AdminTenpoKartePage` 詳細 `運用・鍵` に `お客様立会い` 選択欄を追加
- [x] `karte_detail.spec` 正規化に `business_hours` / `customer_attendance` を追加
- [x] `npm -C src/misogi run build` でビルド成功を確認

## Master Registration Sequential IDs (2026-02-21)

- [x] `lambda_torihikisaki_api.py` の採番を、登録情報（`torihikisaki/yagou/tenpo/souko`）は連番採番に変更
- [x] 連番は既存IDの最大数値サフィックスを走査して `max+1` を採用（例: `TORI#0007 -> TORI#0008`）
- [x] 同時作成衝突に備えて `ConditionalCheckFailed` 時の再採番リトライを追加
- [x] オンボーディング作成（取引先→屋号→店舗→倉庫）も同じ連番ロジックへ統一
- [x] `python3 -m py_compile lambda_torihikisaki_api.py` で構文チェック成功

## Tenpo Karte Basic Info Simplify (2026-02-21)

- [x] `AdminTenpoKartePage` 基本情報から `報告設計` / `使用薬剤` の要約表示を削除
- [x] `AdminTenpoKartePage` 基本情報に `URL` 表示（リンク）を追加
- [x] `npm -C src/misogi run build` でビルド成功を確認

## Tenpo Karte Basic Info Editable (2026-02-21)

- [x] `AdminTenpoKartePage` の基本情報に `編集/保存/キャンセル` 操作を追加
- [x] 基本情報編集で `店舗名/住所/電話/URL` を更新可能化
- [x] 基本情報編集で `営業時間/お客様立会い/連絡手段/営業担当` を更新可能化
- [x] 保存時に `tenpo` マスタ項目と `karte_detail.spec` を同時更新するよう実装
- [x] `npm -C src/misogi run build` でビルド成功を確認

## Master Registration Datetime (2026-02-21)

- [x] `lambda_torihikisaki_api.py` の `torihikisaki/yagou/tenpo/souko/service/zaiko` 作成時に `touroku_at` を自動付与
- [x] `lambda_torihikisaki_api.py` の `PUT` 時に `touroku_at` 欠損データを自動補完
- [x] `lambda_jinzai_api.py` の `jinzai/busho/shokushu` 作成時に `touroku_at` を自動付与
- [x] `lambda_jinzai_api.py` に `busho/shokushu` の個別 `GET/PUT/DELETE` ルートを追加
- [x] 各マスタ画面（取引先/屋号/店舗/顧客ストレージ/人材/部署/職種/サービス/在庫）に `登録日時` 列を追加
- [x] 既存データ一括打刻用 `scripts/backfill_master_touroku_at.py` を追加

## Service Master ID Format Fix (2026-02-21)

- [x] `service` 新規作成時のID採番を `SERVICE#<uuid>` から `service_0001` 形式へ修正
- [x] 既存 `service_00xx` をスキャンして次番採番（例: `service_0067` の次は `service_0068`）
- [x] `python3 -m py_compile lambda_torihikisaki_api.py` で構文確認

## Yakusoku Service Picker UX (2026-02-21)

- [x] サービス選択モーダルにカテゴリチップ（全カテゴリ/カテゴリ別件数）を追加
- [x] 候補表示をカテゴリ別セクションに再構成（デフォルトでカテゴリ単位で探せる）
- [x] カテゴリ絞り込みと既存検索（サービス名/ID/カテゴリ）を併用可能にした
- [x] `npm -C src/misogi run build` でビルド確認

## Torihikisaki Touroku Existing Add Search (2026-02-21)

- [x] 顧客登録（新）> 既存に追加 に統合検索（取引先/屋号/店舗/ID）を追加
- [x] 検索候補クリックで `取引先` / `屋号` 選択へ反映
- [x] 新規作成/追加後に検索インデックスを再読み込み
- [x] `npm -C src/misogi run build` でビルド確認

## Torihikisaki Touroku Existing Add Basic Info (2026-02-21)

- [x] 顧客登録（新）> 既存に追加 で店舗追加時の基本情報入力（電話/メール/担当者/住所/URL/情報登録者）を追加
- [x] 店舗追加 API (`POST /master/tenpo`) に基本情報を保存するよう連携
- [x] 追加成功後に入力欄をクリアし、情報登録者名はログイン名で再初期化
- [x] `npm -C src/misogi run build` でビルド確認

## Torihikisaki Touroku Mobile Tabs (2026-02-21)

- [x] スマホ版 顧客登録で「新規追加 / 既存に追加」をタブ切替に変更
- [x] PC版は従来どおり2カラム同時表示を維持
- [x] `npm -C src/misogi run build` でビルド確認

## Torihikisaki Touroku Mobile Tab Sticky Note UI (2026-02-21)

- [x] スマホ版タブ（新規追加 / 既存に追加）を付箋風デザインへ変更
- [x] 2つのタブで色味と傾きを変え、アクティブ時の浮き上がり表現を追加
- [x] `npm -C src/misogi run build` でビルド確認

## Torihikisaki Touroku Mobile Tabs Color Tuning (2026-02-21)

- [x] スマホ版タブの傾きを撤廃（水平表示に統一）
- [x] アクティブ/非アクティブ状態を明確に色分け
- [x] `npm -C src/misogi run build` でビルド確認

## Yakusoku Header Back Button Dedup (2026-02-21)

- [x] `AdminYakusokuPage` 内のローカル戻るボタン（重複分）を削除
- [x] グローバルヘッダー側の戻る導線のみを残す
- [x] `npm -C src/misogi run build` でビルド確認

## Service Category Legacy Option Cleanup (2026-02-21)

- [x] サービスカテゴリ選択肢から `(互換)` 項目を削除
- [x] 旧カテゴリ値はラベル変換フォールバックのみ維持（表示崩れ防止）
- [x] `npm -C src/misogi run build` でビルド確認

## Yakusoku Service Modal Scroll Containment (2026-02-21)

- [x] サービス選択オーバーレイ表示中は `html/body` の背景スクロールを抑止
- [x] モーダルパネルを固定グリッド化し、候補リストのみ内部スクロール化
- [x] リストに `overscroll-behavior: contain` を適用し、スクロール伝播を抑制
- [x] `npm -C src/misogi run build` でビルド確認

## Yakusoku Monthly Tags UX (2026-02-21)

- [x] 定期メニュー（月別タグ）に「選択済みサービスから追加」導線を追加
- [x] サービス選択後は再検索なしで月別タグへワンタップ追加可能にした
- [x] `npm -C src/misogi run build` でビルド確認

## Yakusoku Monthly Tag Name Display (2026-02-21)

- [x] 定期メニュー（月別タグ）の表示を `service_id` から `サービス名` 優先へ変更
- [x] 保存値は従来どおり `service_id` を維持（互換性維持）
- [x] `npm -C src/misogi run build` でビルド確認

## Yakusoku Quarterly/Half-Year Checkbox Buckets (2026-02-21)

- [x] 定期メニュー（月別タグ）を「毎月」「四半期」「半年」の3構成に再編
- [x] 四半期を A(1/5/9) B(2/6/10) C(3/7/11) D(4/8/12) チェックボックス化
- [x] 半年を A(1/7) B(2/8) C(3/9) D(4/10) E(5/11) F(6/12) チェックボックス化
- [x] 旧 `odd/even/yearly` バケット値は `monthly` へ集約する互換処理を追加
- [x] `npm -C src/misogi run build` でビルド確認

## Yakusoku Extended Recurrence Buckets (2026-02-21)

- [x] 隔月を A(1/3/5/7/9/11) / B(2/4/6/8/10/12) チェックボックスで追加
- [x] 週次Aを 曜日チェック（⽉〜日）で追加
- [x] 隔週A(1/3/5週) / 隔週B(2/4週) を曜日チェックで追加
- [x] 新バケットを `task_matrix` キーとして保存対象に追加
- [x] `npm -C src/misogi run build` でビルド確認

## Yakusoku Service Pool (Reduction Flow) UX (2026-02-21)

- [x] 定期メニューに「未割当プール / 割当済み」可視化を追加
- [x] バケット選択時の自動割当を撤廃（有効化のみ）
- [x] プールから各バケットへ手動配分する減数方式へ変更
- [x] 同一サービスを別バケットへ追加した場合は元バケットから移動（重複排除）
- [x] `npm -C src/misogi run build` でビルド確認

## Yakusoku List Tenpo + Yagou Name Display (2026-02-21)

- [x] yakusoku 一覧の現場名を「店舗名 / 屋号名（名前のみ）」表示へ変更
- [x] `tenpo_id` から屋号名を逆引きして、`item.yagou_name` 未保持時も表示可能にした
- [x] `npm -C src/misogi run build` でビルド確認

## Yakusoku Monthly Tags Visual Clarity (2026-02-21)

- [x] 定期メニューのサービス状態表示を「割当済み（上）/ 未割当プール（下）」の順へ変更
- [x] 割当済み/未割当をカード化し、色分けで視認性を改善
- [x] `npm -C src/misogi run build` でビルド確認

## Yakusoku Monthly Tags Pool-Only Add (2026-02-21)

- [x] 各周期バケット内の文言を「選択済みサービスから追加」→「未割当プールから追加」へ変更
- [x] 各バケット内の検索追加UI（検索/セレクト/追加ボタン）を撤廃
- [x] 未割当プールの配分のみでタグ追加する運用へ統一
- [x] `npm -C src/misogi run build` でビルド確認

## Yakusoku Onsite Flags Label/Field Update (2026-02-21)

- [x] 現場チェックに `キーボックスあり` (`has_keybox`) を追加
- [x] `合鍵あり` ラベルを `鍵預かり` に変更（キーは `has_spare_key` 維持）
- [x] `npm -C src/misogi run build` でビルド確認

## Yakusoku Quarterly Pattern Update (2026-02-21)

- [x] 四半期パターンを A(1/4/7/10) B(2/5/8/11) C(3/6/9/12) の3区分へ変更
- [x] 旧 `quarterly_d` は互換として `quarterly_a` に吸収
- [x] `npm -C src/misogi run build` でビルド確認

## Yakusoku Onsite Flags Key Category (2026-02-21)

- [x] 現場チェックをカテゴリ表示化し「鍵カテゴリ」を追加
- [x] 鍵カテゴリに `鍵預かり / キーボックスあり / ポスト管理 / 鍵紛失＝鍵交換（注意）` を配置
- [x] `has_post_management` フラグを保存対象へ追加
- [x] `npm -C src/misogi run build` でビルド確認

## Yakusoku Onsite Flags Attendance (2026-02-21)

- [x] 現場チェック（運用カテゴリ）に `立会いあり` を追加
- [x] 保存フラグ `has_customer_attendance` を追加
- [x] `npm -C src/misogi run build` でビルド確認

## Yakusoku Yagou Misassignment Guard (2026-02-21)

- [x] 現場名入力の完全一致でない場合、`tenpo_id/yagou_id/yagou_name` を保持せずクリアするよう修正
- [x] 保存時に `yagou_id` が空なら `yagou_name` を空へ正規化
- [x] 一覧表示の屋号名解決を `tenpo` マスタ優先へ変更
- [x] `npm -C src/misogi run build` でビルド確認

## Yakusoku Direct Month/Week Checks (2026-02-21)

- [x] A/B パターン依存を廃止し、四半期/半年/隔月を 1〜12 月の直接チェック方式へ変更
- [x] 週次・隔週を曜日直接チェック（週次/隔週の2カテゴリ）へ簡素化
- [x] 旧 A/B 系キーは `normalizeTaskMatrix` で新キーへ互換吸収
- [x] `npm -C src/misogi run build` でビルド確認

## Tenpo Karte Basic Info: Store Contact Field (2026-02-22)

- [x] 店舗カルテの基本情報に「ご担当者様（店舗担当者）」を追加
- [x] 編集時は `karte_detail.spec.customer_contact_name` を保存し、表示時は `contact_name/contact_person/tantou_name` 互換で補完
- [x] 保存時に店舗マスタ `tantou_name` へ反映（営業担当 `sales_owner` とは分離）
- [x] `npm -C src/misogi run build` でビルド確認

## Tenpo Karte Basic Info: Customer Contact Phone (2026-02-22)

- [x] 店舗カルテの基本情報に「担当者連絡先」を追加
- [x] 編集時は `karte_detail.spec.customer_contact_phone` を保存し、表示時は `tantou_phone/contact_person_phone/contact_phone` 互換で補完
- [x] 保存時に店舗マスタ `tantou_phone` へ反映
- [x] `npm -C src/misogi run build` でビルド確認

## Tenpo Karte Basic Info: Security Field (2026-02-22)

- [x] 店舗カルテの基本情報に「セキュリティ」項目を追加
- [x] 編集時は `karte_detail.spec.security_info` に保存し、表示時は `tenpo.security_info` を互換参照
- [x] 保存時に店舗マスタ `security_info` へ反映
- [x] `npm -C src/misogi run build` でビルド確認

## Yakusoku Same-Assignment Shortcut (2026-02-22)

- [x] 月次/週次バケット編集に「同様の割り当て」ボタンを追加
- [x] 同区分でチェック済みの他バケットへ、現在バケットのサービス割当を一括コピー
- [x] 割当元が空の時はガード（先に割当が必要）
- [x] `npm -C src/misogi run build` でビルド確認

## Tenpo Karte Basic Info: Share & Reuse (2026-02-22)

- [x] 基本情報に「共有・転用」セクションを追加（他店舗コピー / 屋号共有 / 取引先共有）
- [x] 同屋号の他店舗から基本情報をドラフトへコピー可能にした
- [x] 屋号/取引先に `shared_basic_profile` を保存し、カルテへ再適用できる操作を追加
- [x] 基本情報表示は `店舗固有 → 屋号共有 → 取引先共有` の順で補完表示
- [x] `npm -C src/misogi run build` でビルド確認

## Yakusoku Tenpo Search: Selection Visibility (2026-02-22)

- [x] 現場検索候補で選択中行をハイライト表示
- [x] 「現在の選択」サマリー（屋号/店舗、取引先、ID群）を追加
- [x] `npm -C src/misogi run build` でビルド確認

## Yakusoku Tenpo Field: Show Yagou + Tenpo in Input (2026-02-22)

- [x] 新規/編集モーダルの現場検索入力で「屋号 / 店舗名」を表示
- [x] 内部保存値 `tenpo_name`（店舗名）と表示用 `tenpo_query` を分離して互換維持
- [x] 候補選択時は `tenpo_query` にも屋号付き表示名を反映
- [x] 保存時に `tenpo_query` を payload から除外
- [x] `npm -C src/misogi run build` でビルド確認

## Yakusoku Tenpo Selector: Final Selection Clarity (2026-02-22)

- [x] 検索入力中に既存選択を自動解除しない挙動へ変更（最終選択を保持）
- [x] 「候補なし」文言を選択状態が分かる案内へ変更
- [x] 候補行に「選択中」表示を追加
- [x] 「最終選択（保存対象）」を明示し、未選択警告を追加
- [x] 明示的な「選択解除」ボタンを追加
- [x] `npm -C src/misogi run build` でビルド確認

## Yakusoku Modal: Price Position Adjustment (2026-02-22)

- [x] 新規/編集モーダルで「金額（単価）」を「サービス」の直上へ移動
- [x] 既存の下段金額欄を削除して重複を解消
- [x] `npm -C src/misogi run build` でビルド確認

## Yakusoku List: Unified Search (2026-02-22)

- [x] `yakusoku` 一覧に統合検索入力を追加
- [x] `ID / 取引先 / 屋号 / 店舗 / サービス / 状態 / メモ` を横断検索対象に設定
- [x] 検索結果件数（`filtered / total`）表示を追加
- [x] 該当なし時の空状態メッセージを追加
- [x] `npm -C src/misogi run build` でビルド確認

## Yakusoku Modal: Start Date Emphasis (2026-02-22)

- [x] 新規/編集モーダルに `yakusoku開始日` を追加
- [x] `yakusoku開始日` を「金額（単価）」の直上へ配置
- [x] 下段の旧「開始日」欄を削除し重複を解消
- [x] `npm -C src/misogi run build` でビルド確認

## Tenpo Karte: Yakusoku Linkage + Souko Categories (2026-02-22)

- [x] 店舗カルテで `yakusoku` を `tenpo_id` 連携取得して表示（概要/詳細）
- [x] 主契約（`plan.primary_yakusoku_id`）をカルテ上で設定可能にした
- [x] 契約サマリー（開始日/周期/単価/サービス）を可視化
- [x] `souko` アップロードに「書類カテゴリ（見積/契約書/請求/報告提出/写真/その他）」を追加
- [x] ファイル一覧に書類カテゴリ表示を追加
- [x] `npm -C src/misogi run build` でビルド確認

## Sales Function Review: Route Unification + First Response Inbox (2026-02-25)

- [x] 営業入口のホットバーから `業務フロー` を非表示化（`showFlowGuideButton=false`）
- [x] 旧営業顧客導線 `/sales/customers` を `/sales/clients/list` へ統一リダイレクト
- [x] 旧営業登録導線 `/sales/register` を `/sales/clients/new` へ統一リダイレクト
- [x] 営業ホットバー「進捗」に `一次対応` を追加
- [x] `一次対応インボックス` 画面（`/sales/inbox`）を追加し、要対応案件の検索・期限別確認・詳細遷移・日報遷移を実装
- [x] `npm -C src/misogi run build` でビルド確認

## Sales API Base Unification (2026-02-25)

- [x] Salesの主要5画面（顧客一覧/顧客登録/リード一覧/リード登録/リード詳細）の`/api`固定を本番対応APIベース解決へ統一
- [x] ローカルは`localhost/127.0.0.1`時のみ`/api`を使用し、本番は`VITE_API_BASE`→`YOTEI_GATEWAY`の順で解決
- [x] `npm -C src/misogi run build` でビルド確認

## Admin 管理日誌 月次リスト表示 (2026-02-25)

- [x] 管理日誌提出ページに「過去提出（月次）」一覧（件数付き）を追加
- [x] 月次チップ押下で対象月へ切替し、当月提出リストを即時表示
- [x] 月次一覧は `kanri_log` を別取得して月別集計（`jotai=yuko`）で表示
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Master Sort: Torihikisaki / Yagou / Tenpo (2026-02-26)

- [x] `torihikisaki / yagou / tenpo` 一覧のデフォルト順をID昇順に設定
- [x] 列ヘッダクリックで昇順/降順を切替できる列ソートを追加
- [x] ソートUI（矢印・アクティブ表示）をライト/ダークテーマ両対応で追加
- [x] `npm -C src/misogi run build` でビルド確認

## Yakusoku Keiyaku Optional + Reference Sync Fix (2026-02-26)

- [x] `teiki` 新規作成時の `keiyaku` 必須バリデーションを解除
- [x] `keiyaku` 選択時に `keiyaku_name / keiyaku_start_date` を確実に同期
- [x] 現場確定時（候補選択・一致確定）に契約参照を同期し、`tenpo` への反映を安定化
- [x] 契約開始日は `start_date` 優先、未設定時は `application_date` をフォールバック

## Keiyaku Edit: Searchable Parent Selectors (2026-02-26)

- [x] `AdminMasterBase` の `select` フィールドに検索選択UI（候補フィルタ/選択/解除）を追加
- [x] `keiyaku` 編集の `取引先 / 屋号 / 店舗` フィールドで検索選択を有効化
- [x] ライト/ダークテーマ両方で検索選択UIのスタイルを追加

## Keiyaku Edit: Unified Cross-Search (2026-02-26)

- [x] `keiyaku` モーダルに `取引先 / 屋号 / 店舗` 横断の統合検索を追加
- [x] 統合検索の候補選択で `torihikisaki_id / yagou_id / tenpo_id` を一括反映
- [x] 個別の検索付きセレクト依存を外し、統合検索中心で選択できる構成に変更

## Keiyaku Form Label/Field Cleanup (2026-02-26)

- [x] 統合検索選択時に `name`（個人/法人名）へ自動反映
- [x] `契約名` ラベルを `個人/法人名` に変更
- [x] 候補ラベルを `検索結果` 表記へ統一
- [x] `契約先名` フィールドを削除
- [x] `契約開始日` 表記を `利用開始日` に変更
- [x] 料金欄を `別途料金表、または見積書に定めるとおりとする` の固定文言へ統一
- [x] `所在地/本社所在地` フィールドを追加

## Keiyaku Unified Search UX Tuning (2026-02-26)

- [x] 統合検索は入力時のみ検索結果を表示（デフォルト非表示）
- [x] 検索結果選択時に検索入力をリセットし、結果リストを自動クローズ

## Admin Entrance: Sidebar Dashboard Navigation (2026-02-26)

- [x] 管理エントランス(`job=admin`)のみ HOTバー/サブHOTバー表示を無効化
- [x] 左サイドバー（PC常時表示 / スマホオーバーレイ）で管理リンク群を表示
- [x] サイドバーは既存 `ADMIN_HOTBAR` の構成をそのままセクション・グループ化して再利用
- [x] 現在ルートに応じたアクティブ表示を追加
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Narrow Sidebar + Accordion Sections (2026-02-26)

- [x] サイドバー幅を縮小（PC 236px / モバイル最大80vw）
- [x] 大カテゴリ（報告/予定/情報/運用ツール）を開閉式アコーディオンに変更
- [x] 現在ルートを含むカテゴリは自動展開
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Master Info Category Split (2026-02-26)

- [x] 管理サイドバーの「情報」からマスタ系リンクを分離
- [x] 新規大カテゴリ「マスタ情報」を追加し、マスタ系リンクを集約
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Sidebar Visual Simplification (2026-02-26)

- [x] 枠付きカード表現を削除し、テキストナビ中心の軽量デザインへ変更
- [x] 階層を「大カテゴリ > 小カテゴリ > リンク」のインデントと補助線で明確化
- [x] 開閉アイコンを `▸ / ▾` へ変更
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Light/Dark Theme Contrast Tuning (2026-02-26)

- [x] サイドバーのライトモード配色（背景/文字/hover/active）を明示設定
- [x] サイドバーのダークモード配色（補助線/hover/active）を明示設定
- [x] ライト/ダークで階層視認性を維持
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Right Chat Overlay (2026-02-26)

- [x] 管理エントランス右側にチャットオーバーレイUIを追加（PC固定表示 / スマホトグル）
- [x] 5秒ポーリングで `admin_chat` を取得し、リアルタイム更新
- [x] メッセージ投稿（最大280文字）と送信エラー表示を追加
- [x] ライト/ダークテーマ両対応のチャット配色を追加
- [x] `api-master` Lambda に `admin_chat` コレクション定義を追加
- [x] `npm -C src/misogi run build` でビルド確認
- [x] `python3 -m py_compile lambda_torihikisaki_api.py` で構文確認

## Admin: Back/Hamburger Moved To Sidebar (2026-02-26)

- [x] `/admin` 配下のみ上部Breadcrumbsから `戻る` / `ハンバーガー` を除去
- [x] 左固定サイドバーに `戻る` と `ハンバーガーメニュー` を配置
- [x] 管理エントランス（`/admin/entrance`）でも同サイドバー表示に統一
- [x] モバイルではサイドバーをコンパクト化（戻るは矢印表示）
- [x] `npm -C src/misogi run build` でビルド確認

## Global Hamburger: Sidebar Menu Content (2026-02-26)

- [x] 共通 `HamburgerMenu` の中身をサイドバー形式（カテゴリ開閉＋リンク）に変更
- [x] 管理ルートでは `ADMIN_HOTBAR` 構成を流用して階層表示
- [x] 非管理ルートでもジョブ切替をサイドバー形式で表示
- [x] 現在ルートのアクティブ表示を追加
- [x] `npm -C src/misogi run build` でビルド確認

## Common Header Chat: Multi-Function Upgrade (2026-02-27)

- [x] チャットルーム切替（共通/管理/営業/清掃/事務/開発）を追加し、ルーム別に投稿/取得できるように変更
- [x] ルーム・既読時刻をユーザー別で保持し、切替時の表示状態（検索/返信/ツール）を安全にリセット
- [x] メッセージ検索（本文/投稿者/返信引用/添付名）と表示フィルタ（全件/自分/添付/データ）を追加
- [x] 返信引用（reply_to_*）UIを追加し、チャットを掲示板形式から会話形式へ拡張
- [x] 翻訳機能を一括運用できる自動翻訳トグルを追加（既存の個別翻訳は維持）
- [x] 定型文挿入・Enter送信・コピー/返信操作など送信UXを改善
- [x] ライト/ダーク双方で新UI（ルームタブ/検索バー/返信表示/翻訳トグル）の配色を追加
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Operation Tool: Cleaning Houkoku Builder (2026-02-28)

- [x] 管理運用ツールに「清掃報告書作成」導線を追加
- [x] `/admin/tools/cleaning-houkoku` ルートを追加
- [x] 清掃ジョブ `houkoku` と同等UIを管理専用の独立コンポーネントとして実装
- [x] 管理画面パンくずラベルに新規ツール名を追加
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Cleaning Houkoku: Souko Save / Preview / PDF (2026-02-28)

- [x] 清掃報告書作成画面に `souko保存先（tenpo）` 選択を追加（取引先/屋号/店舗名の統合ラベル）
- [x] 提出時に `tenpo_id` 紐づきの `souko` を自動解決し、未作成時は自動作成
- [x] 提出後に報告内容をPDF化して `souko` に保存（`doc_category=cleaning_houkoku`）
- [x] 画面内プレビュー（モーダル）を追加
- [x] 単独 `PDF出力` ボタンを追加（新規タブ表示/ダウンロードフォールバック）
- [x] `apiJson` 参照順（TDZ）を修正して実行時エラーを回避
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Cleaning Houkoku: Required Picks + Unified Search (2026-02-28)

- [x] 清掃業務報告書に必要入力として `店舗情報` / `サービス` / `清掃員` の選択UIを追加
- [x] 統合検索ボックスを1つ追加し、上記3選択候補を同時フィルタできるように実装
- [x] サービス選択UIを `yakusoku` 同様のチェック選択 + タグ表示（選択解除可）へ変更
- [x] ページ内styled-componentsをテーマ変数化し、ライト/ダーク配色を明確に分離
- [x] サービスは複数選択（追加/解除）対応
- [x] 提出時に `worker_id` / `service_ids` / `service_names` / `tenpo_id` を保存
- [x] 未選択時は提出不可（3点必須）に制御
- [x] `npm -C src/misogi run build` でビルド確認

## TemplateRenderer Theme Separation (2026-02-28)

- [x] `TemplateRenderer` の editモード固定ダーク配色をテーマ変数化
- [x] `data-theme=\"light\"` 時に editモード背景を白系へ切替
- [x] ヘッダー/入力欄/選択UI/写真枠/フッターをテーマ連動へ統一
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Cleaning Houkoku: Service Picker Overlay (2026-02-28)

- [x] サービス選択をページ内リストからオーバーレイ方式へ変更
- [x] `yakusoku` と同様に検索 + チェック選択 + 反映して閉じる操作を追加
- [x] 選択済みサービスはタグ表示を維持（タグクリックで解除）
- [x] `masterQuery` を初期値としてサービス検索へ引き継ぎ可能に調整
- [x] オーバーレイ候補をカテゴリ単位で3列グリッド表示へ変更（余白最適化）
- [x] カテゴリ名を `serviceCategoryCatalog` に基づく日本語ラベル表示へ統一
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Cleaning Houkoku: A4 Form Layout (2026-02-28)

- [x] PDF/プレビューを固定A4帳票レイアウトへ変更（提示サンプル準拠）
- [x] ヘッダー（作業報告書タイトル / 宛先 / ミセサポ会社情報）を追加
- [x] 作業実施日 / 実施時間 / 作業員氏名 / 作業区分 / 作業内容を罫線テーブル化
- [x] 作業内容はカテゴリ単位のチェックリスト表示に変更
- [x] 作業開始・作業終了・作業区分の入力UIと総作業時間自動計算を追加
- [x] `selectedServices` 参照順のTDZエラーを修正（`serviceIds + serviceById` で再構成）
- [x] A4前提で帳票フォント/行間を縮小し、プレビュー文字サイズを調整
- [x] 作業日入力を「必要選択」エリアへ移設
- [x] コンテンツエリアから担当作業員項目を除外（`overview` セクションを編集UI非表示化）
- [x] 固定3枚（sheets）運用を解除し、任意枚数の作業写真アップロードUIを追加
- [x] 作業写真は編集画面で3列グリッド表示（追加/削除）
- [x] A4プレビュー/PDFで作業写真を横3列レイアウトで出力
- [x] 補助資料機能を削除し、写真管理を「作業写真」へ一本化
- [x] 補助資料を「任意ファイル添付（supplement_files）」として再追加（写真とは分離）
- [x] A4プレビュー/PDFに補助資料ファイル名リストを表示
- [x] 編集エリアの `清掃 業務報告書（3枚提出）` タイトル表示を非表示化（詳細操作は独立エリア維持）
- [x] 清掃報告書ページの黒い光彩/影を低減（編集キャンバスのグロー無効化・背景単色化）
- [x] 作業写真エリアをサービス選択数に応じて自動生成（サービスごとに独立表示）
- [x] 各サービスで `ビフォア / アフター` を独立アップロード + ドラッグ&ドロップ移動対応
- [x] ビフォア/アフター左側に共通画像プールを追加（アップロード起点を一本化）
- [x] 共通画像プール→サービス枠は「移動」運用に統一し、写真の重複配置を防止
- [x] サービスごとに作業詳細コメント欄を追加し、A4プレビュー/PDFへ反映
- [x] 作業写真UIを全幅化し、共通画像プールとサービス編集を上下レイアウトへ変更
- [x] 共通画像プールを横スクロール（左右スライド）表示へ変更
- [x] サービス写真編集をタブ方式へ変更（選択サービスごとに切替）
- [x] 「清掃業務報告 必要選択」エリアを全幅化
- [x] TemplateRenderer（プレビュー/提出操作を含む編集エリア）を全幅化
- [x] 全幅化後の横幅を `1480px` 基準へ微調整（必要選択/作業写真/TemplateRenderer を統一）
- [x] プレビュー/PDFのヘッダー配置を調整（タイトル中央、会社概要右、取引先名左）
- [x] プレビュー/PDFヘッダーの会社概要ブロックを下寄せ配置へ調整
- [x] プレビュー/PDFの「作業実施場所」を独立ブロックから罫線テーブル内セルへ移設
- [x] 作業実施場所を `作業店舗名` と `作業実施場所` の2行へ分割
- [x] 帳票テーブルの並び順を `日付 → 店舗名 → 場所 → 時間 → 区分 → 作業員 → 内容` に統一
- [x] 帳票ヘッダーのタイトルを左寄せ化し、右上（会社概要の上）に押印3マス（清掃担当印/現場責任者印/会社印）を追加
- [x] 帳票ヘッダー右カラム幅を再調整し、押印3マス・会社ロゴ・本表の右端ラインを揃えた
- [x] 帳票ヘッダーの取引先名を下方向へ微調整（視認性向上）
- [x] 帳票リード文を「平素より…下記の通り…」へ差し替え、取引先名の直下へ配置
- [x] 挨拶文の直下に `作業店舗名 / 作業実施場所` 専用セルを追加し、本表から該当2行を移設
- [x] 帳票の `作業店舗名` 表示を `屋号 / 店舗名` のみに調整（取引先名を除外）
- [x] 作業写真エリアの前に `作業内容詳細` 入力エリアを追加し、A4プレビュー/PDFにも同セクションを反映
- [x] 統合検索語句で清掃員候補が0件になる場合、清掃員選択を全件フォールバック表示に修正（選択不能回避）
- [x] 統合検索結果をクリック選択できる候補チップ（店舗/清掃員/サービス）を追加
- [x] 店舗セレクトは選択済み店舗のみ表示へ変更（他店舗を非表示）
- [x] 統合検索の店舗候補も選択済み店舗のみ表示へ統一（選択後の候補ぶれを防止）
- [x] 店舗/清掃員の初期自動選択を廃止し、統合検索のデフォルト状態を未選択へ統一
- [x] `souko保存先（店舗情報）` セレクトに未選択プレースホルダを追加し、初期表示で店舗名が出ないように修正
- [x] 清掃員を複数選択化し、帳票/提出データへ反映（`worker_ids` 送信）
- [x] 清掃員選択UIを`multiple select`からチェックボックス方式へ変更（クリックのみで複数選択可能）
- [x] 清掃員表示ラベルから職種/部署ステータス表記を除去（名前表示に統一）
- [x] 必要選択レイアウトを再編（左: 統合検索+店舗情報+サービス選択 / 右: 清掃員）し、サービス選択ボタンを左寄せ配置
- [x] 必要選択の作業メタ行を1列化（`作業日 / 作業開始 / 作業終了 / 総作業時間 / 作業区分` を同一行で表示）
- [x] PDF生成をセクション単位の改ページ方式へ変更（帳票途中の不自然な途切れを低減）
- [x] PDFで `作業写真` 見出し前に強制改ページを追加（1枚目は作業内容詳細まで）
- [x] PDF描画にA4固定余白（上下左右8mm）を追加し、ページ端まで詰まる表示を解消
- [x] PDF画像欠落対策として、アップロード直後は `S3 URL` ではなくローカル `ObjectURL` を優先描画
- [x] プレビュー帳票の会社情報ブロック下に余白（padding-bottom）を追加し、下要素との詰まりを解消
- [x] `害虫・害獣対策` 系サービス（`category/category_concept/service_id/name` 判定）は写真バケットを単一化（`作業写真`のみ）し、ビフォア/アフター分割を無効化
- [x] 画像識別を固定化（アップロード時に `photo_no` 採番し、移動/並び替え後も表示番号を更新しない）
- [x] A4プレビュー/PDFで `サービス名 / ビフォア`・`サービス名 / アフター` 見出し表示
- [x] 報告書作成ページの横幅を拡張（TemplateRenderer/選択カード/写真カードを1100px基準へ）
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Cleaning Houkoku: Service Tag Dock (2026-02-28)

- [x] 選択済みサービスの追加枠（タグ）をサービス欄内から分離し、`サービスを選択` ボタン横の独立フレームへ移設
- [x] `service_0044`（追加枠）をサービス選択オーバーレイ候補から除外し、ボタン横の専用トグルボタンへ分離
- [x] `service_0044` のUI表示名を `その他` に変更（専用ボタン/選択状態テキスト/サービス名表示を統一）
- [x] `service_0044`（その他）は写真バケットを単一化（`作業写真`のみ）し、ビフォア/アフター分割を無効化
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Cleaning Houkoku: Report List Link (2026-02-28)

- [x] 清掃報告書作成ツールの提出データ（`template_id=CLEANING_SHEETS_3_V1`）を一覧表示する管理ページを追加
- [x] `/admin/tools/cleaning-houkoku/list` ルートを追加
- [x] 管理エントランスのサイドバー（運用ツール > 報告書）に `報告書一覧` リンクを追加
- [x] パンくずラベルに `清掃報告書一覧` を追加
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Cleaning Houkoku: Label Rename (2026-02-28)

- [x] サイドバー文言を `清掃報告書作成 / 報告書一覧` から `清掃レポート作成 / レポート一覧` へ変更
- [x] パンくず・一覧ページ見出し・遷移リンクの文言を `レポート` 表記へ統一
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Houkoku: Mobile + Job Sync (2026-02-28)

- [x] 共通画像プールを廃止（常時非表示）し、写真追加は各バケットからの直接アップロードに統一
- [x] 清掃レポート作成UIにスマホ向けレスポンシブ調整を追加（横溢れ防止・操作エリアの縦積み化・作業メタ入力の1カラム化）
- [x] `/jobs/cleaning/report` を管理版と同一の清掃レポートビルダーへ切替（清掃ロールでも同仕様で作成可能化）
- [x] 清掃ホットバー導線を `/jobs/cleaning/houkoku` に統一し、`/jobs/:job/houkoku` ルートを追加（`/jobs/cleaning/report` は互換維持）
- [x] 清掃側 `houkoku` は `legacy` 分岐を廃止し、管理側と同一ビルダー（プレビュー/PDF A4）へ固定
- [x] 清掃側の旧UI導線は廃止し、`/jobs/cleaning/report` と `/jobs/cleaning/houkoku` の両方で新ビルダーを常時使用
- [x] 清掃ジョブのスマホ幅では共通画像プールを非表示化し、ビフォア/アフター枠から直接ライブラリアップロードできるように変更
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Houkoku: Preview/PDF Layout Sync (2026-03-01)

- [x] PDFヘッダー右カラムの順序を変更（上: 押印欄 / 下: 会社情報）
- [x] プレビューをHTML帳票描画から「PDF実体の埋め込み表示」へ変更し、PDF出力とレイアウト差分を解消
- [x] PDFヘッダー配置を調整（会社情報を右上、取引先名/作業店舗名/作業実施場所を左カラムに固定）
- [x] PDFヘッダーの右カラムを強制行配置（`company` を1行目固定、`stamp-grid` を2行目固定）して位置ズレを解消
- [x] PDFヘッダー上段を`grid`から`flex`へ変更し、`html2canvas`描画でも会社情報が右上固定になるように調整
- [x] PDFヘッダーを画面幅非依存の2カラム固定に変更（左: 取引先名/挨拶/作業店舗名/場所、右: 会社情報/押印欄）
- [x] PDFヘッダーDOMにインライン2カラム指定を追加し、モバイル幅・CSS競合時でも左右レイアウトが崩れないように固定
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yotei: New Registration UX Sync (2026-03-01)

- [x] 管理 `yotei` 新規登録モーダルに `店舗統合検索` を追加（取引先/屋号/店舗/ID 検索、候補タップで確定）
- [x] 店舗選択時に `yakusoku` を同一店舗候補から自動補完（既選択維持優先）
- [x] サービス選択を `yakusoku` 同等のオーバーレイ方式へ変更（カテゴリチップ + 複数チェック + タグ解除）
- [x] 清掃員選択を複数チェック方式へ変更（検索フィルタ + 選択タグ表示）
- [x] 保存 payload を拡張（`worker_ids` / `worker_names` / `service_ids` / `service_names` を送信、主担当は先頭IDで `sagyouin_*` に同期）
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yotei: Modal Two-Column Layout (2026-03-01)

- [x] 新規予定登録モーダルを2カラム化（左: `紐付け契約` + `現場名（統合検索）`、右: `清掃員（複数選択）`）
- [x] `紐付け契約` を `現場名（統合検索）` の上段へ固定配置
- [x] `最終選択tenpo` 表示ブロックを2カラム外へ分離し、全幅表示に変更
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Houkoku: Tag Layout + Meta Fit (2026-03-01)

- [x] 清掃ジョブ `houkoku` の選択済みサービスタグを `サービスを選択` / `その他` ボタンの下段へ固定配置
- [x] サービスタグを小型化（フォント・余白縮小）し、高さ占有を抑えて横幅を活かす表示へ調整
- [x] `作業日 / 作業開始 / 作業終了` 入力の幅はみ出しを防止（`WorkMetaGrid` の縮小制約・入力幅制御を追加）
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yotei: Tenpo Query Visibility + Self Worker Auto (2026-03-01)

- [x] 店舗統合検索候補はクエリ未入力時に非表示化（入力時のみ候補表示）
- [x] 現場名検索入力は未入力時に空表示へ変更（選択済み情報は `最終選択tenpo` 全幅ブロックで確認）
- [x] 清掃員の検索選択UIを廃止し、ログイン中アカウント名を自動入力（read-only）へ変更
- [x] 清掃員表示を `作業種別` の上へ移設
- [x] 新規予定モーダル上段は実レイアウトに合わせて `紐付け契約 + 現場名検索` の1カラム構成へ調整
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Houkoku: Admin Pool Restore (2026-03-01)

- [x] 共通ビルダーの画像運用を用途別に分離（管理: 共通画像プール表示 / 清掃ジョブ: 直接アップロード）
- [x] 清掃ジョブ経路（`ReportCreatePage`）のみ `forceDirectBucketUpload` を有効化
- [x] 管理 `清掃レポート作成` では共通画像プールを再表示
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Houkoku: Label Rename (2026-03-01)

- [x] 管理サイドバーの `報告` セクション名を `業務報告` に変更
- [x] 管理サイドバーの `報告一覧` を `業務報告一覧` に変更
- [x] `/admin/houkoku` のパンくずを `業務報告一覧`、詳細を `業務報告詳細` に変更
- [x] 管理報告一覧ページの見出しを `業務報告一覧` に変更
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Display Mode Toggle (2026-03-01)

- [x] 管理エントランスの設定に表示モード（`標準 / NieR風`）トグルを追加
- [x] 選択モードを `localStorage(misogi-v2-admin-entrance-mode)` に保存し再訪時に復元
- [x] `NieR風` は管理エントランス限定で適用（背景/タイポ/サイドバー配色を専用化）
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Sepia Light Tuning (2026-03-01)

- [x] 表示モード名を `NieR風` から `セピア` に変更
- [x] 既存保存値 `nier` は互換的に `sepia` として自動移行
- [x] セピアモードをライト寄り配色へ再設計（背景/タイトル/リンク）
- [x] セピアモード時のサイドバーを専用デザインに調整（色・境界・ホバー・設定UI）
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: MISOGI Support Chat Bubble (2026-03-03)

- [x] 管理エントランスのヘッダーに `MISOGI AI` 呼び出しボタンを追加（チャットバブルオーバーレイ起動）
- [x] 既存 `CommonHeaderChat` を拡張し、表示名/ARIA/トリガー文言/初期ルーム/保存キーを外部指定可能化
- [x] 管理エントランス用チャットは初期ルームを `管理` に設定し、ルーム状態を専用キーで保持
- [x] トリガーボタンのテキスト付きスタイルを追加（管理ヘッダーで視認性向上）
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Chat Restore (2026-03-03)

- [x] 管理エントランスのヘッダーチャットを既定の `共通チャット（管理人同士）` へ復元
- [x] `MISOGI AI` 専用のトリガー文言・専用保存キー・専用スタイル差分をロールバック
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: MISOGI Support Orb (2026-03-03)

- [x] 既存チャットとは別に `MISOGIサポート` 呼び出しボタンを追加（ヘッダー右上）
- [x] 管理エントランスの通常ビジュアライザーを初期非表示化（サポート球体はボタン押下時のみ表示）
- [x] ドラッグ移動可能な `MISOGI` 球体オーバーレイを追加（任意位置へ移動可）
- [x] 球体オーバーレイ内にチャットUIを実装（履歴表示 + 入力 + 送信）
- [x] Google AI（Gemini API）連携を追加（`VITE_GOOGLE_AI_API_KEY` / `VITE_GOOGLE_AI_MODEL`）
- [x] `MISOGIサポート` チャットオーバーレイ背景を透明化
- [x] `MISOGIサポート` の `Google AI` ラベルを削除し、オーバーレイのボーダー/ドロップシャドウを除去
- [x] `MISOGIサポート` の発言レイアウトを上下分離（上: MISOGI / 下: ユーザー）、タイトルと罫線を非表示化
- [x] `MISOGIサポート` の表示履歴を最新1往復に限定（過去履歴スクロールとユーザー履歴蓄積を廃止）
- [x] `MISOGIサポート` のメッセージ表示を球体側へ寄せ、メッセージと球体の間隔を縮小
- [x] ユーザー側メッセージ（下段）も球体側へさらに寄せるよう余白を追加調整
- [x] `MISOGIサポート` の上下メッセージ帯を固定高へ変更し、球体との距離をさらに圧縮
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Kadai: Delete + Category Options (2026-03-03)

- [x] `Kadaiリスト` の削除UIを常時利用可能化（管理権限は行削除/一括削除可）
- [x] 削除前確認を `削除キー入力` 方式から `confirm` ダイアログ方式へ変更
- [x] `業務フロー段階` 表示を `カテゴリ` 表記へ統一（フィルタ/列ラベル/検索プレースホルダ）
- [x] カテゴリ候補を指定値へ差し替え（`営業/清掃/事務/経理/OP/現場/管理/予定/約束契約/動き`）
- [x] `flow_stage` 初期値を `予定` に変更
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Common Chat Translation Removal (2026-03-03)

- [x] 管理エントランスの `共通チャット` から翻訳UIを削除（翻訳先セレクト / 自動翻訳トグル / 各メッセージ翻訳ボタン）
- [x] 翻訳ロジックと翻訳表示状態を削除し、チャットの通常表示へ統一
- [x] 翻訳関連CSSを削除し、ヘッダーレイアウト崩れを解消（`header-chat-head` のカラム再調整）
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Common Chat Send Trigger Update (2026-03-03)

- [x] 共通チャット入力で `Enter` キー送信を無効化（改行のみ）
- [x] 投稿は `送信` ボタン押下時のみ実行に変更
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Sidebar IA + Settings/Auth Relayout (2026-03-03)

- [x] 管理サイドバーの大カテゴリ構成を再編（`業務報告 / スケジュール管理 / 顧客管理 / 人材管理 / マスタ情報 / 運用ツール`）
- [x] 各項目ラベルを指定名へ統一（`業務報告一覧 / 管理業務記録一覧 / yotei / ugoki / yakusoku / 顧客登録 / 顧客情報一覧(取引先名簿) / 人材名簿`）
- [x] HOTBAR由来の小キャプション表示を削除（グループラベル非表示）
- [x] サイドバー `設定` 内に `表示モード / 言語 / ライトモード切り替え` を集約
- [x] サイドバー下部に `ログイン / ログアウト` 操作ブロックを追加
- [x] 大カテゴリ開閉トリガーのタップ領域とホバー/フォーカス視認性を改善
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Sidebar Accordion + Settings Collapse (2026-03-03)

- [x] サイドバー大カテゴリをアコーディオン化（同時に開けるカテゴリは最大1つ）
- [x] `設定` ブロックを開閉式に変更（デフォルト閉じ）
- [x] 縦スクロール抑制のため、カテゴリ展開状態を単一選択ロジックへ変更
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Sidebar Item Relocation (2026-03-03)

- [x] `在庫発注フォーム` を `マスタ情報` から `運用ツール` へ移動
- [x] `顧客ストレージ` を `マスタ情報` から `顧客管理` へ移動
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Right Update Sidebar (2026-03-03)

- [x] 管理エントランス右上に `通知` トグルを追加し、右サイドバーを開閉可能化
- [x] 右サイドバーに `本日の更新通知` リストを追加（`kanri_log` を本日分抽出）
- [x] 通知表示を `何時何分 / 誰が / 何をした` 形式へ整形して箇条書き表示
- [x] 30秒自動更新 + 手動 `更新` ボタンを追加
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Kintai Link in Reports (2026-03-03)

- [x] サイドバー `業務報告` セクションに `勤怠管理` ボタンを追加
- [x] `勤怠管理` は `https://f.ieyasu.co/misesapo/login/` へ外部遷移するリンクとして設定
- [x] サイドバー遷移処理を外部URL対応（http/https は新規タブで開く）に拡張
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Notification Rail Toggle (2026-03-03)

- [x] 通知トグルを右上固定ボタンから、左サイドバー右隣の細幅レール（約20px）へ移設
- [x] レールボタン押下で通知パネルが展開/収縮するUIへ変更
- [x] 通知パネルを左サイドバー右端に密着表示（左起点スライド）へ調整
- [x] レイヤー順・ライト/セピア配色を再調整し、表示/操作競合を解消
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Notification Panel Under Sidebar Feel (2026-03-03)

- [x] 通知パネルの表示起点をレール位置へ変更し、左サイドバー直下から出る挙動に調整
- [x] 通知パネル/背景の `z-index` を左サイドバーより下へ変更し、「サイドバーの下に隠れる」重なり順へ調整
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Notification Panel Mode Color Separation (2026-03-03)

- [x] 通知パネル配色を `標準/セピア` かつ `ライト/ダーク` の各モードで分離し、視認性を改善
- [x] 標準モード（ライト）の通知パネル背景/文字色/罫線/時間色を再調整
- [x] セピアモード（ダーク）の通知パネル背景/文字色/罫線/時間色を再調整
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Notification Panel Left Padding Fix (2026-03-03)

- [x] 通知パネル展開時に左レールとの重なりを避けるため、ヘッダーラベル領域へ左パディングを追加
- [x] 通知本文リストにも左パディングを追加し、先頭文字の欠けを解消
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Notification Panel Status/Login/Update Timeline (2026-03-03)

- [x] 通知取得元を `kanri_log` のみから `kanri_log + admin/work-reports` へ拡張
- [x] `業務報告の更新状態` を `業務報告(種別): 状態` 形式で通知表示
- [x] `ログイン` 判定（`login/signin/ログイン` 系キーワード）を追加し、`本日のログイン時刻` セクションを表示
- [x] `情報更新: ...` 形式で更新内容と時刻を継続表示
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Notification Panel System Log Simplification (2026-03-03)

- [x] 通知種別を `ログイン` と `業務報告提出` のみへ絞り込み
- [x] 通知文を簡潔な管理ログ形式へ統一（`誰が〜しました >>> 時刻`）
- [x] ログイン専用サマリー表示を廃止し、単一時系列リスト表示に統一
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Notification Panel Fact + Datetime Format (2026-03-03)

- [x] 通知対象を再拡張し、`ログイン` 以外の更新イベントも表示対象に復帰
- [x] 通知文を `誰が / 何をした / 日時` の端的フォーマットへ統一（`>>> YYYY/MM/DD HH:mm`）
- [x] 業務報告イベントは `state/status` に応じて `提出/確認/差し戻し/承認/保管/保存/更新` を表示
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Filebox Top Item (2026-03-03)

- [x] サイドバー最上段に `ファイルボックス` セクションを追加
- [x] `ファイルボックス` から会社ストレージ（`/admin/master/souko`）へ遷移できるよう設定
- [x] 重複回避のため `顧客管理` 配下の `顧客ストレージ` リンクを整理（削除）
- [x] `/admin/master/souko` のパンくずラベルを `ファイルボックス` に変更
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Souko Back to Customers (2026-03-03)

- [x] `顧客管理` 配下に `顧客ストレージ（/admin/master/souko）` を再配置
- [x] `/admin/master/souko` のパンくずラベルを `顧客ストレージ` に戻して整合
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Filebox Independent Panel (2026-03-03)

- [x] `ファイルボックス` を `souko` とは分離し、独立ルート `/admin/filebox` へ変更
- [x] サイドバー `ファイルボックス` 選択時に、管理エントランスのメイン領域へフォルダカードUIを表示
- [x] ファイルボックス画面に `最近のファイル` リストを追加（ファイル名 / フォルダ / 更新日時）
- [x] `/admin/filebox` のパンくずラベルを `ファイルボックス` に追加
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Filebox Centered Layout (2026-03-03)

- [x] ファイルボックス表示時のみメインコンテンツを中央寄せする専用レイアウトクラスを追加
- [x] フォルダカード/最近ファイルカードをメイン領域中央でバランス表示するよう余白と幅を調整
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Filebox Main Header Removal (2026-03-03)

- [x] `/admin/filebox` 表示時のみメインコンテンツ先頭の自動生成ヘッダー（`管理エントランス` タイトル）を非表示化
- [x] ファイルボックス内部ヘッダー用の未使用CSSを削除し、カード先頭余白を調整
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Filebox Entrance Header Hide (2026-03-03)

- [x] `/admin/filebox` をエントランス判定に追加し、共通 `Breadcrumbs` ヘッダーを非表示化
- [x] 管理エントランス系ページと同様に、ファイルボックス表示時はページ上部ヘッダーを描画しない挙動へ統一
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Filebox Real Open + Upload (2026-03-03)

- [x] ファイルボックス4カテゴリ（契約書/業務マニュアル/提出書類/共通ドキュメント）を `admin_chat` 連携ルームへ紐付け
- [x] カードクリック時にカテゴリ内の最新ファイルを新規タブで開く挙動を追加
- [x] カテゴリ別ファイル一覧（クリックで実ファイルURLを開く）を実装
- [x] ファイルボックスにアップロード機能を追加（presign取得 → PUT → メタ記録）
- [x] 最近のファイル一覧を実データで表示するよう変更
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Filebox File Icon + Thumbnail (2026-03-03)

- [x] ファイルボックスのファイル行にプレビュー領域を追加（画像はサムネイル表示）
- [x] 非画像ファイルは種別アイコン表示へ変更（PDF/文書/表計算/動画/音声/圧縮ファイル等）
- [x] `選択フォルダのファイル` と `最近のファイル` の両方へ同一表示ルールを適用
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Filebox Focus + View Mode Switch (2026-03-03)

- [x] ファイルボックスでカード選択前は全カード表示、選択後は選択カードのみ中央表示へ変更
- [x] 選択状態を解除する `戻る` ボタンを追加
- [x] `最近のファイル` セクションを削除し、選択カードに紐づくファイル一覧のみ表示へ統一
- [x] カード上に表示方式切替アイコンを追加（`アイコン/リスト/スライダー`）
- [x] 表示方式に応じてファイル表示を切替（グリッド/行リスト/横スライダー）
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Filebox Card Create (2026-03-03)

- [x] ファイルボックスカードをユーザー追加できるUIを追加（カード名入力 + `カード追加`）
- [x] 追加カードを `localStorage(misogi-v2-admin-filebox-custom-folders)` へ保存し、再訪時に復元
- [x] 追加カードにも既存と同じアップロード/一覧表示フローを適用
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Filebox Wording Folder (2026-03-03)

- [x] ファイルボックスUI文言の `カード` 表記を `フォルダ` 表記へ統一（選択ガイド/エラーメッセージ/作成UI）
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Filebox Souko Storage + Loop Fix (2026-03-03)

- [x] ファイルボックスのフォルダ/ファイル永続化を `admin_chat` から `souko` へ移行（`source=admin_filebox` / `tenpo_id=filebox_company`）
- [x] フォルダ一覧・フォルダ作成・アップロード・一覧表示を `souko` API 経由へ統一
- [x] `/admin/filebox` 初期表示時の無限ループを修正（依存更新で再取得が連鎖しないように調整）
- [x] `lambda_torihikisaki_api.py` に filebox 共通ストレージ用の `souko` 親検証例外を追加
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Filebox Souko Tenpo Fallback (2026-03-03)

- [x] `filebox_company` が無効な環境で `souko` が 400 を返す問題に対応（有効な `tenpo_id` を自動フォールバック）
- [x] フォールバック先 `tenpo_id` を `localStorage(misogi-v2-admin-filebox-tenpo-id)` へ保存し再利用
- [x] フォルダ作成/一覧取得/アップロード準備の全経路にフォールバックを適用
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Filebox Company Storage Fixed (2026-03-03)

- [x] ファイルボックス保存先を `souko(tenpo_id=filebox_company, source=admin_filebox)` 固定へ統一
- [x] 取引先 `tenpo_id` への自動フォールバック処理と `localStorage` キャッシュを削除
- [x] フォルダ作成/一覧取得/アップロード準備/更新の全経路で社内共通ストレージIDを使用
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Today Updates Poster Name Normalize (2026-03-03)

- [x] `本日の更新通知` の投稿者名解決を `*_name` 優先へ修正（`kanri_log` / `work-report` 共通）
- [x] UUID/メール/ARN など識別子のみが表示されるケースを通知表示名から除外
- [x] JSON文字列化された投稿者情報も表示名へ復元する正規化を追加
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Today Updates Name Mojibake Fix (2026-03-03)

- [x] 通知投稿者名の UTF-8 文字化け（例: `æ¡ç°å`）を表示時に自動復元
- [x] 日本語名はそのまま維持し、`À-ÿ` 系の文字化け候補のみを復元対象に制限
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Tenpo Karte: Remove Detail Contract Link + Reflect Primary Yakusoku (2026-03-03)

- [x] `カルテ詳細（管理オペ用）` から `契約連携（yakusoku）` セクションを削除
- [x] `基本情報` の `主契約に設定` 操作時に `primary_yakusoku_id` だけでなく `plan_frequency` を自動反映
- [x] 主契約 `yakusoku` のサービス情報を `service_plan` へ同期反映（周期/月情報を自動展開）
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Tenpo Karte: Service Menu Cycle Tag View (2026-03-03)

- [x] `サービスプラン` 表示を単純羅列から `周期ごと` のグルーピング表示へ変更
- [x] 各周期内のサービス項目をタグ表示（チップ）に変更
- [x] ライト/ダークの両テーマでタグが読めるよう表示スタイルを調整
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Tenpo Karte: Move Cycle Tags to Karte Section (2026-03-03)

- [x] `基本情報` から `サービスプラン` の周期タグ表示を削除（主契約表示のみ維持）
- [x] `カルテ詳細 > サービスメニュー（周期管理）` に周期別タグ表示を配置
- [x] サービスタグ表示を主表示にし、従来の行編集UIは `サービス個別編集` 折りたたみへ移動
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Tenpo Karte: Service Plan Move + Dedup Cleanup (2026-03-03)

- [x] `カルテ詳細` の `サービスメニュー（周期管理）` を上段へ移動し、先頭表示へ変更
- [x] セクション名を `サービスメニュー` から `サービスプラン` へ変更
- [x] 重複していた `プラン・評価` セクション（プラン頻度/衛生状態自己評価/最終清掃日）を削除
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Tenpo Karte: Rule Label + Equipment Right Move (2026-03-03)

- [x] `カルテ詳細` の `運用・鍵` セクション名を `ルール` に変更
- [x] `設備` セクションを左カラムから右カラムへ移動
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Tenpo Karte: Souko Thumbnail + Open for Existing Files (2026-03-03)

- [x] `souko` GET で既存 `files[].key` から `get_url`（署名URL）を補完して返す処理を追加
- [x] お客様詳細ストレージで画像判定を拡張（`content_type` + 拡張子）し、既存ファイルもサムネイル表示
- [x] 登録済みファイルの `開く` リンクを `preview_url/get_url/url` 優先で実ファイルを開けるように変更
- [x] アップロード保存時に `souko.files` の一時 `get_url` を除外して保存するよう調整
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Tenpo Karte: Basic Info Torihikisaki-Keiyaku Link (2026-03-03)

- [x] `お客様詳細 > 基本情報 > 取引先 詳細` に `契約（keiyaku）` 紐付けセレクトを追加
- [x] 取引先IDに応じて `keiyaku` 候補を取得し、既存紐付けIDが候補外でも履歴選択できるよう補完
- [x] 基本情報保存時に `torihikisaki` へ `keiyaku_id / keiyaku_name / keiyaku_start_date` を保存
- [x] 取引先詳細の表示に紐付け契約情報と `契約マスタ` 遷移リンクを追加
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Tenpo Karte: Detail Header Text Cleanup (2026-03-03)

- [x] `カルテ詳細（管理オペ用）` の見出しを `カルテ詳細` に変更
- [x] `旧カルテの項目を整理して再構築しています。自由記述を最小化し、構造化項目中心で運用します。` の説明文を削除
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Tenpo Karte: Rule Fields Cleanup (2026-03-03)

- [x] `カルテ詳細 > ルール` から `スタッフルーム` を削除
- [x] `カルテ詳細 > ルール` から `お客様立会い` を削除
- [x] `カルテ詳細 > ルール` から `担当者連絡先` と `営業担当` を削除
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Tenpo Karte: Basic Info Primary Yakusoku Immediate Save (2026-03-03)

- [x] `基本情報 > yakusoku 契約情報` の `主契約に設定` で `karte_detail.plan.primary_yakusoku_id` を即時保存
- [x] 主契約設定時に `plan_frequency` と `service_plan` 同期値も含めて同時保存
- [x] 保存中は対象ボタンを `保存中...` 表示に変更し、多重押下を抑止
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Tenpo Karte: Direct Yotei Entry from Customer Detail (2026-03-03)

- [x] お客様詳細ヘッダーに `予定` ボタンを追加
- [x] `予定` 押下で `create=1 + tenpo/yagou/torihikisaki/yakusoku` を付与して `/admin/yotei` へ遷移
- [x] `/admin/yotei` 側でクエリを受け、新規予定モーダルを自動起動し対象現場を初期反映
- [x] 取り込み後は起動クエリをURLから除去（再描画での再起動防止）
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yotei: Tenpo Select Yakusoku Sync (2026-03-03)

- [x] 現場名（統合検索）候補に `primary_yakusoku_id` を取り込み、現場マスタ由来の主契約を参照可能化
- [x] 現場選択時の `yakusoku` 解決順を `選択現場の主契約 -> 同現場の有効契約先頭` に統一
- [x] 現場選択時に前回選択の `yakusoku_id` を持ち越さないよう修正（別現場の契約混入を防止）
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yotei: Yakusoku Service Auto Reflect (2026-03-03)

- [x] `yakusoku` の `service_ids/service_names`（および単数フィールド）からサービス選択を復元する正規化を追加
- [x] 新規 `yotei` で `yakusoku` を選択した際、サービス内容（複数タグ）を自動反映
- [x] 現場選択により `yakusoku` が自動切替された場合も、該当 `yakusoku` のサービス内容を自動反映
- [x] `yakusoku` 反映時、主サービス1件の標準作業時間がある場合は `end_time` も自動補正
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yotei: Scheduled Date Editable in Modal (2026-03-03)

- [x] `新規予定登録/予定編集` モーダルに `作業日`（date input）を追加
- [x] 保存時はモーダルで選択した `scheduled_date` を基準に `start_at/end_at` を計算するよう修正
- [x] 編集モーダル初期値に `scheduled_date` を必ず設定（空値で保存されないよう補強）
- [x] 保存前に `scheduled_date` の妥当性チェックを追加（不正値はアラート）
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yotei: Timeline Card Tenpo Label Includes Yagou (2026-03-03)

- [x] タイムラインカードの現場表示を `店舗名のみ` から `屋号 / 店舗名` へ拡張
- [x] `displayTenpoName` を `tenpo` マスタ参照ベースに変更し、`yagou_name` 未同梱データでも表示可能化
- [x] 既存の現場名表示利用箇所（カード/集計）に同一ルールを適用
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yotei: Timeline Card Shows Current Ugoki Jotai (2026-03-03)

- [x] `yotei` タイムラインカードに `UGOKI: <状態>` を表示（夜帯/日中帯の両カード）
- [x] カード表示の `UGOKI` 状態は `ugoki.jotai` を優先参照し、未取得時は既存状態判定へフォールバック
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yotei: Card Edit Save Fix (2026-03-03)

- [x] 予定編集保存時の更新ID解決を `id/yotei_id/schedule_id` フォールバックに変更（`/yotei/undefined` を防止）
- [x] `yakusoku` 必須バリデーションを新規作成時のみ適用し、既存予定編集保存を阻害しないよう修正
- [x] 予定取消でも同一ID解決ルールと空IDガードを適用
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yotei: Edit Save Float Payload Guard (2026-03-03)

- [x] 編集保存 payload をホワイトリスト化し、`modalData` 全展開を廃止（不要フィールド混入を防止）
- [x] `Float types are not supported` の原因となる浮動小数点フィールドが更新APIへ流れないよう修正
- [x] 必須業務項目（日時/現場/契約/作業員/サービス/メモ/状態/引き継ぎチェック）は明示送信を維持
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yotei: Card Cancel Robust Fallback (2026-03-03)

- [x] 予定取消ID解決を候補配列化（`id/schedule_id/yotei_id`）し、ID揺れでの失敗を回避
- [x] 取消APIは `DELETE` 失敗時に `PUT(jotai=status=torikeshi)` へ自動フォールバック
- [x] 取消ボタンからはレコード本体を渡し、候補IDを順次試行できるよう修正
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yotei: Card Cancel Visibility Sync (2026-03-03)

- [x] 予定取得時に `status/state/jokyo` 由来の取消状態も `jotai=torikeshi` へ正規化し、表示判定を統一
- [x] 取消成功直後は対象カードをローカル state から即時除去し、画面反映遅延を抑制
- [x] 取消後の再取得は現在ビューに合わせて実行（`timeline/today=日付単日`,`week/month=範囲取得`）
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yotei: Card Hard Delete (2026-03-03)

- [x] 予定カードの危険操作を `予定取消` から `予定削除` に文言統一
- [x] 削除APIは `DELETE /yotei/{id}` のみ実行し、`PUT torikeshi` フォールバックを廃止
- [x] 削除成功後はローカル state から即時除去し、ビュー別再取得（日/週/月）で同期
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Ops: Kadai to Workflow Request Board (2026-03-03)

- [x] `/admin/kadai` のタイトルと運用文言を `業務依頼ボード` へ変更（課題管理から依頼管理へ転換）
- [x] 依頼運用に必要な項目を追加（`request_type` / `due_date` / `priority` / `file_refs`）
- [x] 進行状態を業務フロー向けに拡張（`依頼中/受付/処理中/承認待ち/差戻し/完了` + 旧値互換）
- [x] 一覧/詳細/検索/フィルタ/新規初期値を依頼ワークフロー前提へ再編
- [x] サイドバーとパンくずの `Kadaiリスト` 表記を `業務依頼` へ統一
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Workflow Request Category Independent (2026-03-03)

- [x] 管理サイドバーに `業務依頼` の独立カテゴリを追加（`業務依頼ボード` を配下表示）
- [x] `運用ツール` から `業務依頼` 導線を削除し、カテゴリ重複を解消
- [x] `/admin/kadai` パンくず名を `業務依頼ボード` に変更
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Workflow Requests: Request Document Template Page (2026-03-03)

- [x] `業務依頼` カテゴリ配下に `依頼書作成` 導線を追加（`/admin/request-doc`）
- [x] `依頼書作成` ページを新設し、テンプレート選択（部署間/見積/契約確認/支払処理）に対応
- [x] テンプレート入力からプレビュー生成、コピー、`.txt` ダウンロードを実装
- [x] 入力内容を `localStorage(misogi-v2-admin-request-document-draft)` へ自動保存
- [x] `/admin/request-doc` のパンくず名を `依頼書作成` として追加
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Workflow Requests: Request Doc to Board Draft Handoff (2026-03-03)

- [x] `依頼書作成` に `業務依頼ボードへ起票` ボタンを追加し、入力内容を連携できるように変更
- [x] `依頼書テンプレート` の入力値を `localStorage(misogi-v2-admin-request-doc-seed)` へ一時保存して `/admin/kadai?create=1&seed=request-doc` へ遷移
- [x] `業務依頼ボード` 側で seed を読込・消費し、新規登録モーダルを自動起動して下書き値を反映
- [x] 自動起票後は seed 値をクリアし、通常の新規登録時に前回seedが残らないよう調整
- [x] `AdminMasterBase` に `autoOpenCreateToken` を追加し、ページ側から新規モーダル自動起動を制御可能化
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Workflow Requests: Request Doc A4 Preview + PDF Save (2026-03-04)

- [x] `依頼書作成` のプレビューをテキストエリアから A4 書類風レイアウトへ変更（表形式ヘッダ + セクション本文）
- [x] `PDF保存（印刷）` ボタンを追加し、同レイアウトを印刷ダイアログ経由でPDF保存できるよう対応
- [x] 印刷用HTMLを専用生成し、プレビューと同等の文書体裁（余白/罫線/見出し）で出力
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Workflow Requests: Request Doc Preview Fit in Frame (2026-03-04)

- [x] A4プレビュー用紙の幅を `min(100%, 210mm)` に変更し、枠内に収まるよう自動フィット化
- [x] プレビュー枠の横方向オーバーフローを抑制し、紙面が枠外へはみ出さないよう調整
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Workflow Requests: Request Doc Container Width 1440 (2026-03-04)

- [x] `依頼書作成` ページのコンテンツ最大幅を `1300px` から `1440px` に変更
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Workflow Requests: Preview Header PDF Button (2026-03-04)

- [x] `依頼書作成` の右側プレビュー見出し行に `PDFプレビュー` ボタンを追加
- [x] 既存の `PDF保存（印刷）` と同じ印刷処理をヘッダーボタンから実行可能化
- [x] プレビューヘッダ用レイアウト/ボタンスタイルを追加（タイトル右配置）
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Workflow Requests: PDF Preview Open Fix (2026-03-04)

- [x] `PDFプレビュー` を印刷即実行ではなく、専用ウィンドウでのプレビュー表示へ修正
- [x] `PDF保存（印刷）` は従来どおり印刷ダイアログ起動を維持（プレビューと分離）
- [x] プレビュー/印刷で共通HTMLを再利用しつつ、`autoPrint` フラグで挙動を切替
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Workflow Requests: Request Doc Letter Style Preview (2026-03-04)

- [x] `依頼書作成` プレビューを表形式から和文レター形式へ再構成（中央タイトル + 罫線 + 宛先/差出人 + 件名 + 本文 + 敬具）
- [x] 本文を `依頼目的/依頼内容/期限/優先度` ベースの段落構成に変更し、テンプレート拡張項目も本文へ組み込み
- [x] `PDFプレビュー` / `PDF保存（印刷）` の出力HTMLも同一レター体裁へ統一
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Workflow Requests: Request Doc PDF A4 Fixed (2026-03-04)

- [x] 印刷用 `@page` を `A4 portrait` 固定へ変更（`margin: 0`）
- [x] 印刷時の紙面コンテナを `210mm x 297mm` 基準に固定し、PDF保存時のサイズ揺れを抑制
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: My Storage Rename + Workflow Inbox Files (2026-03-04)

- [x] サイドバー/パンくずの `ファイルボックス` 表記を `マイストレージ` に変更
- [x] `マイストレージ` に `受信業務依頼` フォルダを追加し、`kadai` の受信対象データを疑似ファイル（`.txt`）として一覧表示
- [x] 受信業務依頼ファイルはクリックで内容を開けるよう `data:text/plain` URL を生成
- [x] `受信業務依頼` フォルダは読み取り専用化（アップロード不可）
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Workflow Requests: Receiver Person Input in Template (2026-03-04)

- [x] `依頼書作成` に `依頼先担当者名` 入力欄を追加
- [x] 入力した担当者名を依頼書プレビュー/PDF出力の宛名へ反映
- [x] `業務依頼ボードへ起票` 時に `target_to` へ依頼先担当者名も連携
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Workflow Requests: Request Doc Attachment Upload + My Storage Link (2026-03-04)

- [x] `依頼書作成` に添付ファイル選択UIを追加（複数選択/一覧表示/個別削除、1件15MB上限）
- [x] `業務依頼ボードへ起票` 実行時に添付ファイルを `souko(source=admin_filebox, tenpo_id=filebox_company)` へアップロード
- [x] 起票単位で `マイストレージ` 用の専用フォルダを自動作成し、`souko_id/folder_id` を `attachment_refs` へ自動追記
- [x] 添付アップロード中は起票ボタンをロックし、エラー/完了メッセージをページ上に表示
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Workflow Requests: Per-Recipient My Storage Isolation (2026-03-04)

- [x] `依頼書作成` 添付アップロード時に `souko` へ `owner_name / owner_key / owner_dept` を保存（受信者基準）
- [x] `マイストレージ` の `souko` 取得クエリを `owner_key=ログインユーザー` で絞り込み、他者ファイルを一覧に出さないよう変更
- [x] `souko` API に `owner_user_id / owner_name / owner_key` フィルタを追加し、`admin_filebox` は所有者以外の `GET/PUT/DELETE` を拒否
- [x] 既存互換として `owner_*` 未設定レコードは `uploaded_by / uploaded_by_name` で所有者判定
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Kintai Promoted to Top Category (2026-03-04)

- [x] サイドバー `業務報告` 配下から `勤怠管理` を削除
- [x] サイドバー大カテゴリとして独立 `勤怠管理` を追加し、配下に `勤怠管理` リンクを配置
- [x] 既存リンク先（`https://f.ieyasu.co/misesapo/login/`）は維持
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: SmartHR Link in Staff Category (2026-03-04)

- [x] サイドバー `人材管理` 配下に `スマートHR` 外部リンクを追加
- [x] リンク先を `https://misesapo.smarthr.jp/home` に設定
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Hide Jinzai Meibo from Staff Category (2026-03-04)

- [x] サイドバー `人材管理` 配下の `人材名簿` リンクを非表示化
- [x] `人材管理` 配下は `スマートHR` 導線のみ表示
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Move Kintai Below My Storage (2026-03-04)

- [x] サイドバーの大カテゴリ並びを `マイストレージ -> 勤怠管理 -> 業務報告` に変更
- [x] `勤怠管理` カテゴリ自体は維持し、リンク先は既存の `https://f.ieyasu.co/misesapo/login/` のまま
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Move Kadai List to Tools (2026-03-04)

- [x] 管理サイドバーの `業務依頼` から `/admin/kadai` 導線を外し、`運用ツール` 配下へ移設
- [x] `/admin/kadai` 導線ラベルを `業務依頼ボード` から `課題リスト` へ変更（管理/事務ホットバー）
- [x] パンくずの `/admin/kadai` 表示名を `課題リスト` へ統一
- [x] `依頼書作成` 画面内の関連導線文言（リンク/起票ボタン）を `課題リスト` 表記に更新
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Workflow Requests: Save/Send Only + Recipient Select + PDF Delivery (2026-03-05)

- [x] `依頼書作成` の主要アクションを `保存` / `送信` の2つに整理（起票/テキストDL/印刷保存ボタンを除去）
- [x] `依頼先担当者` を `jinzai` からの選択式へ変更（選択時に担当者名/部署をフォームへ反映）
- [x] `送信` 押下時にプレビューからA4 PDFを生成し、添付ファイルと同梱してアップロード
- [x] 保存先を `souko(source=admin_filebox, tenpo_id=filebox_company)` の `workflow_inbox` 固定にし、依頼先 `owner_key` で分離保存
- [x] 送信済みファイル参照（`souko_id/folder_id/files`）を `attachment_refs` へ追記して下書きへ保持
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Dashboard Rename + Filebox Right Chat Dock (2026-03-05)

- [x] 管理サイドバー `/admin/filebox` のカテゴリ名・項目名を `マイストレージ` から `ダッシュボード` へ変更
- [x] `/admin/filebox` のパンくず表示名を `ダッシュボード` に統一
- [x] `/admin/filebox` 表示時のみ、右カラムへ `共通チャット` を常時展開するドッキングレイアウトを追加
- [x] ファイル一覧ページ上部のチャットトリガーは `/admin/filebox` のみ非表示化（右カラム常設チャットへ一本化）
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Workflow Requests: Recipient Scope Restriction (2026-03-05)

- [x] `依頼書作成` の `依頼先担当者` 候補を `管理 / 事務 / 営業 / 開発` スコープの人材のみに限定
- [x] 部署名/ロール情報からスコープを正規化（`経理/人事/総務` は `事務` として扱う）
- [x] フォームに残っている担当者IDが候補外になった場合は自動クリア
- [x] `依頼先担当者` セレクトのプレースホルダ文言を制限内容に合わせて更新
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Sidebar Hover Color Tuning (2026-03-05)

- [x] サイドバー項目（リンク）のホバー時にアクセント色が分かるよう色変化を強調
- [x] サイドバー大カテゴリ見出し（アコーディオン）にもホバー時の色変化を追加
- [x] ライト/ダーク両テーマでホバー配色を最適化
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Dashboard Chat Right Edge Dock (2026-03-05)

- [x] `/admin/filebox`（ダッシュボード）時のメイン右余白を調整し、右チャットカラムを画面右端へ寄せる
- [x] ダッシュボード2カラムの幅制限を解除して全幅化し、チャットパネルを右端固定配置に最適化
- [x] モバイル幅では既存余白へ戻すレスポンシブ補正を追加
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Dashboard Chat Top/Bottom Flush (2026-03-05)

- [x] `/admin/filebox` 時のメイン上下余白を調整し、右チャットカラムを上端・下端まで密着表示
- [x] ダッシュボードレイアウトに最小高さを付与し、チャットカラム高をビューポート基準へ固定
- [x] ドッキングチャット（`CommonHeaderChat`）を高さ100%化し、角丸/影を外してパネル密着表示に調整
- [x] タブレット/モバイル幅では既存の余白・高さ挙動へ戻す補正を追加
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Dashboard-Only Sidebar MISOGI Trigger (2026-03-05)

- [x] 固定ヘッダー側の `MISOGI` 呼び出しボタンは `/admin/filebox` 時のみ非表示化
- [x] `/admin/filebox` 時に限り、サイドバー `運用ツール` セクション配下へ `MISOGI` 呼び出しボタンを移設
- [x] サイドバー内表示時は `misogi-support-trigger` を固定配置から解除し、リンク行スタイルで表示
- [x] `npm -C src/misogi run build` でビルド確認

## Common Chat: Width +80px for Readability (2026-03-05)

- [x] 共通チャットオーバーレイ幅を `360px -> 440px` に拡張（`+80px`）
- [x] ダッシュボード右側の常設共通チャットカラム幅を `360px -> 440px` に拡張
- [x] 共通チャットのドラッグ座標制限/初期位置計算を新幅に追従させ、はみ出し挙動を補正
- [x] `npm -C src/misogi run build` でビルド確認

## Common Chat: Remove Tools Toggle Button (2026-03-05)

- [x] 共通チャット作成欄の `ツールを表示 / ツールを隠す` ボタンを削除
- [x] 絵文字・データの開閉は各ボタンで直接トグルする挙動へ整理
- [x] `activeRoom` 切替時の不要な `showTools` リセット処理と返信起点の `showTools` 有効化処理を削除
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Dashboard Cursor-Like Workspace UI (2026-03-05)

- [x] `/admin/filebox` ダッシュボードを3ペイン構成へ再設計（左: フォルダエクスプローラ / 中央: ファイルワークスペース / 右: 共通チャット）
- [x] 左エクスプローラに `更新`・`フォルダ追加`・フォルダ一覧（選択ハイライト）を集約
- [x] 中央ワークスペースにフォルダ状態ヘッダ、アップロード導線、表示切替、ファイル一覧を再配置
- [x] フォルダ未選択時はウェルカムパネル（総フォルダ数/総ファイル数）を表示
- [x] ダーク/ライト両テーマで新レイアウト配色を最適化、モバイル幅では1カラムへフォールバック
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Dashboard Color Mode Sync (2026-03-05)

- [x] ダッシュボード新UIの配色を CSS 変数化し、固定色依存を削減
- [x] `標準 × ライト` モード用にダッシュボード配色を調整（面/境界/選択ハイライト）
- [x] `セピア × ライト` モード用にダッシュボード配色を調整（面/境界/選択ハイライト）
- [x] `セピア × ダーク` モード用にダッシュボード配色を調整（面/境界/選択ハイライト）
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Dashboard Pane Resizers (2026-03-05)

- [x] `/admin/filebox` ダッシュボードの左エクスプローラと中央ワークスペースの間に横幅リサイザーを追加
- [x] `/admin/filebox` ダッシュボードの中央ワークスペースと右チャットの間に横幅リサイザーを追加
- [x] リサイザーの幅を `localStorage` に保持し、再訪時に復元
- [x] 画面幅に応じた最小/最大幅制約と、モバイル時のリサイザー非表示フォールバックを追加
- [x] `標準/セピア × ライト/ダーク` 各モードでリサイザー配色を同期
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Dashboard Cursor Header + Panel Toggle + Bottom Tab (2026-03-05)

- [x] `/admin/filebox` ダッシュボード上部に Cursor 風の細いヘッダーバー（現在フォルダパス表示）を追加
- [x] ヘッダー右上に `⚙`（パネル設定）を追加し、左/右ペインの表示・非表示を切替可能化
- [x] 左/右ペインの表示状態を `localStorage` に保持し、再訪時に復元
- [x] `/admin/filebox` ダッシュボード下部に Cursor 風のタブバー（アクティブタブ表示）を追加
- [x] `標準/セピア × ライト/ダーク` でヘッダー/タブ配色をモード同期
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Dashboard Body Header/Footer Layout Fix (2026-03-05)

- [x] コンテンツ内に置いたヘッダー/タブUIを撤去し、ボディ外側レイアウトへ移設
- [x] ボディ上部に補助ヘッダーを追加し、左/右ペインの表示ボタンを配置
- [x] ボディ下部に `20px` 固定のフッター帯を追加
- [x] ペイン表示状態の永続化（`localStorage`）は維持
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Entrance: Move Pane Toggles to Top Header Band (2026-03-05)

- [x] `/admin/filebox` 時は共通ヘッダー帯（戻る/チャットがある帯）を表示し、ここにペイン表示トグルを配置
- [x] トグル操作は `CustomEvent(misogi-dashboard-pane-toggle)` でダッシュボード本体へ連携
- [x] 左/右ペイン表示状態を `localStorage` と同期し、再訪時に復元
- [x] コンテンツ直上の補助ヘッダーは撤去し、ボディ下部 `20px` フッター帯のみ維持
- [x] `npm -C src/misogi run build` でビルド確認

## Schedule: Yasumi Page + Availability API Unification (2026-03-05)

- [x] 清掃員 `休み申請カレンダー` を旧 `blocks` API 依存から `workers/me/availability`（`GET/PUT`）へ統一
- [x] 休み申告モードを `稼働可 / 休み` に整理し、月全体を `status=open/closed` で保存
- [x] 管理 `AdminScheduleTimelinePage` の週表示で `WeekView` に `apiBase` を受け渡し、`sales/availability-matrix` 取得を安定化
- [x] 管理サイドバー `スケジュール管理` に `yasumi` を新設（`/admin/yasumi`）
- [x] `yasumi` ページを追加し、担当者選択 + 日別 `open/scheduled/closed` 集計 + マトリクス表示を実装
- [x] `npm -C src/misogi run build` でビルド確認

## Schedule: Yasumi Google Calendar-like UI (2026-03-05)

- [x] `yasumi` 画面を月表示カレンダー（6週グリッド）へ再構成し、Googleカレンダー風の視認性に調整
- [x] 月移動（前月/今月/翌月）と日付選択を追加し、選択日の詳細集計を下段に表示
- [x] カレンダー各日セルに `稼働可 / 予定 / 休み` 件数と休み担当者プレビュータグを表示
- [x] 左ペインに担当者フィルタ（個別ON/OFF・全選択・解除）を維持し、月表示集計へ即時反映
- [x] レスポンシブ時（タブレット/モバイル）に1カラムへフォールバックするスタイルを追加
- [x] `npm -C src/misogi run build` でビルド確認

## Schedule: Yasumi Full-Width Layout (2026-03-05)

- [x] `yasumi` 画面に `report-page-content--full` を適用し、共通 `max-width: 560px` 制約を解除
- [x] `admin-yasumi-content` を `width: 100% / max-width: none` に調整し、管理画面で横幅を広く使用
- [x] モバイル時の余白を維持しつつ、デスクトップで全幅利用できるようパディングを調整
- [x] `npm -C src/misogi run build` でビルド確認

## Account: Full Purge from Workers/Jinzai/Cognito (2026-03-05)

- [x] 削除対象5名（`生井剛 / 鳥澤美緒 / 平鋭未 / 若松祥江 / 岡本涼子`）を `workers` から物理削除
- [x] 人材側レコード（`jinzai`）の該当データを物理削除
- [x] 認証アカウント（Cognito User Pool: `ap-northeast-1_EDKElIGoC`）を物理削除
- [x] `workers` API と DynamoDB/Cognito 再照合で対象の残存 0 件を確認

## Account: Additional Full Purge from Workers/Jinzai/Cognito (2026-03-05)

- [x] 削除対象4名（`増田優香 / 吉田 / ソウザ レムエル / 高木直人`）を `workers` から物理削除
- [x] 人材側レコード（`jinzai`）の該当データを物理削除
- [x] 認証アカウント（Cognito User Pool: `ap-northeast-1_EDKElIGoC`）を物理削除
- [x] `workers` API と DynamoDB/Cognito 再照合で対象の残存 0 件を確認

## Schedule: Yasumi Day Overlay Tags (2026-03-06)

- [x] `yasumi` カレンダーの日付クリック時に日別詳細オーバーレイを表示
- [x] オーバーレイ内で担当者を `休み / 予定 / 稼働可` の項目別に分割表示
- [x] 各担当者名をタグ表示へ統一し、カテゴリ別の色分けを適用
- [x] ESCキー / 背景クリック / 閉じるボタンでオーバーレイを閉じる挙動を追加
- [x] `npm -C src/misogi run build` でビルド確認

## Schedule: Yasumi Overlay Visibility Fix (2026-03-06)

- [x] 日別オーバーレイを `createPortal(document.body)` 描画へ変更し、親コンテキスト依存を排除
- [x] オーバーレイ backdrop の `z-index` を引き上げ、管理画面の他固定レイヤーより前面表示に統一
- [x] `npm -C src/misogi run build` でビルド確認

## Schedule: Yasumi Overlay Opaque Background Fix (2026-03-06)

- [x] `admin-yasumi-page` に `--panel/--line/--text` を定義し、オーバーレイ背景の変数未定義を解消
- [x] `yasumi-overlay` の背景色を `var(--panel, #121621)` へ変更し、不透明表示を保証
- [x] ライト/ダーク両テーマで `yasumi` 背景と文字色が正しく見えるよう調整
- [x] `npm -C src/misogi run build` でビルド確認

## Schedule: Yasumi Overlay White Theme Adjustment (2026-03-06)

- [x] ユーザー要望に合わせて `yasumi` オーバーレイ本体を白背景固定（`#fff`）へ変更
- [x] オーバーレイ内の文字色・補助文色・境界色を白背景向け（濃色テキスト）に調整
- [x] `npm -C src/misogi run build` でビルド確認

## Schedule: Yasumi Weekly View (2026-03-06)

- [x] `yasumi` 画面に `月次 / 週次` 表示切替トグルを追加
- [x] 週次モードで `選択日` 基準の 1 週間（7日）グリッド表示を実装
- [x] ナビゲーション（前/今/次）を表示モード連動（週次: ±1週、月次: ±1月）に変更
- [x] 取得レンジを表示モード連動（週次: 週範囲、月次: 月範囲）へ変更
- [x] `npm -C src/misogi run build` でビルド確認

## Schedule: Yasumi Weekly Card Focus + Hide Worker ID (2026-03-06)

- [x] 週次モードでは下段の `日別状況` セクションを非表示化し、カレンダーカード中心の表示へ変更
- [x] 週次カードの高さを拡張して情報閲覧しやすいレイアウトへ調整
- [x] 担当者一覧のID表示（`small`）を削除し、名前のみ表示へ変更
- [x] オーバーレイタグの `title` からID露出を削除
- [x] `npm -C src/misogi run build` でビルド確認

## Schedule: Yasumi Weekly Top Spacing + Colored Name Tags (2026-03-06)

- [x] 週次モード時の `admin-yasumi-content` / `yasumi-main-card` 上余白を圧縮し、上に詰めたレイアウトへ調整
- [x] 日セルの名前タグ表示を `休み` のみから全担当者へ拡張（週次は全件表示、月次は先頭3件+残件数）
- [x] 名前タグを `稼働可 / 予定 / 休み` の状態ごとに色分け表示
- [x] `npm -C src/misogi run build` でビルド確認

## Schedule: Yasumi Hidden Worker Filter (2026-03-06)

- [x] `yasumi` 対象担当者から `正田 / 太田 / 竹内 / 梅岡 / 沖 / 今野 / 開発アカウント / 櫻田` を非表示化
- [x] 名前の空白差分を吸収する正規化比較で除外判定を実装
- [x] `npm -C src/misogi run build` でビルド確認

## Schedule: Yasumi Weekly Card Height Expansion (2026-03-06)

- [x] 週次グリッド高さを `calc(100vh - 260px)` 基準へ拡張し、画面縦幅をより多く利用
- [x] 週次セルをグリッド高に追従するよう調整（`height: 100%`）
- [x] 週次タグ表示領域の最大高さをビューポート連動に変更
- [x] タブレット/モバイルでは自動高さへ戻すレスポンシブフォールバックを追加
- [x] `npm -C src/misogi run build` でビルド確認

## Schedule: Yasumi Availability Timeout Resilience (2026-03-06)

- [x] `sales/availability-matrix` 取得を担当者IDのバッチ分割（12件単位）へ変更し、単発重負荷を回避
- [x] 504/timeout/AbortError 発生時に該当バッチを1回リトライする処理を追加
- [x] 全バッチ失敗時は明示エラーメッセージを表示し、部分成功時は取得済みデータで画面表示を継続
- [x] `npm -C src/misogi run build` でビルド確認

## Schedule: Yasumi Hidden Worker Filter Additions (2026-03-06)

- [x] `yasumi` 非表示対象へ `Noemi / 吉井 / 中島` を追加
- [x] 既存の名前正規化比較ロジックにより表記揺れ（空白等）を吸収して除外
- [x] `npm -C src/misogi run build` でビルド確認

## Schedule: Yasumi Weekly Tag Vertical List (2026-03-06)

- [x] 週次モードの `yasumi` 日セルタグを横並び・折返しから縦1列表示へ変更
- [x] 週次タグをセル幅いっぱい（`width: 100%`）で表示し視認性を改善
- [x] `npm -C src/misogi run build` でビルド確認

## Schedule: Yasumi Month Window Limit (2026-03-06)

- [x] `yasumi` の表示レンジを `先月 / 今月 / 来月` の3か月に制限
- [x] 月次/週次の前後ナビゲーションを範囲内のみ有効化（範囲外は移動不可）
- [x] カレンダー範囲外日付セルを `対象外` 表示＋クリック不可へ変更
- [x] `npm -C src/misogi run build` でビルド確認

## Schedule: Yasumi Month Nav No-Data Dialog (2026-03-06)

- [x] 月次ナビ（前月/次月）押下時に対象月のデータ有無を事前チェックし、データなしなら遷移を抑止
- [x] 前月/次月が範囲外またはデータなしの場合は `情報がないため表示できません。` ダイアログを表示
- [x] ナビチェック中は前後ボタンを一時無効化し、連打による状態競合を防止
- [x] `npm -C src/misogi run build` でビルド確認

## Schedule: Yasumi Month Nav Arrow Visibility (2026-03-06)

- [x] 月次表示で前月/次月にデータがない場合、該当矢印ボタンを非表示化
- [x] 前後月のデータ有無を事前評価し、表示可否を自動反映
- [x] `npm -C src/misogi run build` でビルド確認

## Schedule: Yasumi Calendar Week Row Auto (2026-03-06)

- [x] 月次カレンダーの週行を固定6行から必要週数のみ表示へ変更
- [x] `buildCalendarWeeks` のセル埋めを 42 固定から 7 の倍数までに変更し、空6段目を除去
- [x] CSS の `grid-template-rows: repeat(6, ...)` を削除し、余剰行が出ないよう調整
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Entrance: HOTBAR Icon Assets Extraction (2026-03-07)

- [x] HOTBAR アイコンをコンポーネント内 SVG 直書きから `public/icons/hotbar/*.svg` のアセット参照へ移行
- [x] `hotbar.css` を `mask-image` ベース表示へ変更し、テーマ色連動（`currentColor`）を維持
- [x] `report / plan / tools / settings / flow / home / default` のアイコンファイルを追加
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Entrance: HOTBAR Icon Material Replace (2026-03-07)

- [x] 指定素材（`アンケートシート / カレンダー / ツールボックス / 設定歯車`）を HOTBAR 用 `report / plan / tools / settings` に差し替え
- [x] 差し替え後も既存の `mask-image` 表示方式（テーマ色連動）を維持
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Entrance: HOTBAR Tools Icon Re-Swap (2026-03-07)

- [x] `tools` アイコンを `ツールボックスのアイコン.svg` へ再差し替え
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Entrance: HOTBAR Active Style Icon-Only (2026-03-07)

- [x] HOTBAR アクティブ時の緑背景と下線を削除
- [x] アクティブ時はアイコン色のみ緑に変更（ラベル色は通常維持）
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Entrance: HOTBAR Active Label Color (2026-03-07)

- [x] HOTBAR アクティブ時にラベル色も緑へ変更
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Entrance: Sub HOTBAR Position Above Main HOTBAR (2026-03-07)

- [x] サブHOTバー（`EXHotbar`）の固定位置をメインHOTバー直上へ調整
- [x] メインHOTバーとの間に小さな余白を持つ `bottom` オフセットへ変更（モバイル/デスクトップ別）
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Entrance: Sub HOTBAR (subItems) Anchor to HOTBAR +30px (2026-03-07)

- [x] 清掃エントランスの `sub-hotbar`（`subItems`）を画面中央配置から固定配置へ変更
- [x] `data-job="cleaning"` 限定で `HOTバー上30px` 相当（`bottom: calc(max(10px, env(safe-area-inset-bottom)) + 98px)`）にアンカー
- [x] クリック操作維持のため `pointer-events` をサブHOTバー本体にのみ有効化
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Report: HOTBAR Add (Preview / PDF / Save / Camera) (2026-03-07)

- [x] 清掃報告ページにエントランス同系の下部HOTバーを追加（`プレビュー / PDF / 保存 / カメラ`）
- [x] HOTバー操作を既存処理へ連携（`プレビュー=PDFプレビュー` / `PDF=ダウンロード` / `保存=日次下書き保存` / `カメラ=有効店舗タブのファイル追加`）
- [x] HOTバー固定表示でフォーム末尾が隠れないよう下部余白を拡張
- [x] 指定アイコン（`虫眼鏡 / PDF / カメラ`）を `public/icons/hotbar` に配置し、`プレビュー / PDF / カメラ` に割り当て
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Report: HOTBAR Apply to Actual `/jobs/cleaning/houkoku` Page (2026-03-07)

- [x] `/jobs/cleaning/houkoku` 実体ページ `AdminCleaningHoukokuBuilderPage` にモバイル下部 HOTBAR を追加
- [x] HOTBAR 操作を既存処理へ連携（`プレビュー=openPreview` / `PDF=outputPdf` / `保存=submit` / `カメラ=写真入力起動`）
- [x] 直接アップロードモード時の `カメラ` は選択サービスの対象バケット入力を起動し、未選択時はエラー表示
- [x] モバイルでは従来フッターのアクションボタン群を非表示にして重複操作を解消
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Report: Mobile HOTBAR Search/Service Shift (2026-03-07)

- [x] モバイル HOTBAR を `検索 / サービス / カメラ / プレビュー` へ再編し、`保存` を `プレビュー` に置換
- [x] `検索` アクションで現場検索オーバーレイを開き、店舗候補から `tenpo_id` を即時選択できるよう対応
- [x] `サービス` アクションで既存サービス選択オーバーレイを直接起動
- [x] モバイルではフッターの `プレビュー/PDF` を非表示化し、`提出` は維持
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Houkoku: Yotei Link + Souko Date Storage (2026-03-07)

- [x] `houkoku` 保存 payload に `yotei_id / schedule_id` を追加し、`context` にも同期
- [x] `houkoku` の PDF 保存を拡張し、撮影アップロード済み写真も全件を店舗 `souko` へ保存
- [x] `souko` 保存ファイルへ `work_date / date_key / date_month` を付与し、日付基準で管理可能なメタを付与
- [x] 写真保存時に `service_id / service_name / photo_bucket / photo_no` を記録
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yotei: Yakusoku Auto Link Restore (2026-03-07)

- [x] `yakusoku` 選択時の連携を ID型差異（string/number）でも解決できるよう比較処理を正規化
- [x] `tenpo` 選択時に同一店舗の `yakusoku` を自動補完（既存一致は維持、候補なしはクリア）へ修正
- [x] 自動補完時に `work_type`（`定期/単発 + plan_name`）も同期
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yotei Timeline: Yakusoku Fetch Fallback Fix (2026-03-07)

- [x] ローカル時の `yakusoku` フォールバック先を固定 `/api2` から `VITE_YAKUSOKU_API_BASE or API_BASE` へ統一
- [x] 取得URLを `/yakusoku?limit=1000` に揃え、一覧取得の互換性を改善
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yotei: Worker Manual Selection Restore (2026-03-07)

- [x] `新規予定登録` で清掃員の自動指定を廃止（`workerId` 明示指定時のみ事前選択）
- [x] 新規予定モーダルの清掃員UIを read-only から検索 + チェックボックス選択へ復帰
- [x] 複数選択時は `worker_ids` と主担当（`sagyouin_id / worker_id / sagyouin_name`）を同期
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Flow: Yotei First, Then Houkoku (2026-03-07)

- [x] 清掃エントランス `報告` の遷移先を `houkoku` 直行から `予定から報告（/jobs/cleaning/yotei）` へ変更
- [x] 清掃員 `yotei` カードに `この予定で報告` ボタンを追加し、`yotei_id` を付与して `houkoku` へ遷移
- [x] `houkoku` 画面で `yotei_id` 指定時に予定詳細を取得し、`作業日/時間/店舗/清掃員/サービス` を自動反映
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Entrance: No Default HOTBAR Selection + My Yotei Bubble (2026-03-07)

- [x] エントランス初期表示の HOTBAR 選択を `未選択`（`tab = null`）へ変更
- [x] HOTBAR 押下前はサブHOTバー（`subItems`）が表示されない挙動へ統一
- [x] 清掃エントランス未選択時に `自分の予定` バブルボタンを表示（30日先までの割当件数 + 次回日付）
- [x] `自分の予定` バブル押下で `/jobs/cleaning/yotei` へ遷移
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Entrance: Yotei Activity Tags on Idle Screen (2026-03-07)

- [x] 清掃エントランス未選択時に `アクティビティ` カードを追加し、直近予定をタグ表示
- [x] 各タグに `状態 + 日付/時刻 + 現場名` を表示し、ホバー/省略表示に対応
- [x] タグ押下で `予定一覧（/jobs/cleaning/yotei）` へ遷移できる導線を追加
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Entrance: Sub HOTBAR Back Arrow Only (2026-03-07)

- [x] 清掃エントランスのサブHOTバー表示を `戻る（←）` 1ボタン構成へ簡素化
- [x] `戻る（←）` 押下で HOTBAR 未選択状態（`tab = null`）へ復帰
- [x] 清掃エントランスではメインHOTバー押下時に既定サブ項目へ直接遷移（`report/plan/tools`）
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Entrance: Replace Idle Widgets with Today's Notice Bubbles (2026-03-07)

- [x] 清掃エントランス未選択時の `自分の予定` / `アクティビティ` / `HOTバー案内ラベル` を削除
- [x] 清掃エントランスの `Portalへ戻る` 表示を非表示化
- [x] 画面左・下 1/3 付近に当日予定の通知バブルを追加（`yagou / tenpo / 時刻 / 金額`）
- [x] 通知バブル押下で `/jobs/cleaning/yotei` へ遷移
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Entrance: Expand Notice Range to 3 Days (2026-03-07)

- [x] 清掃エントランス通知バブルを `当日` から `前日・当日・明日` の3日分へ拡張
- [x] 各通知に日別タグ（`前日 / 当日 / 明日`）を追加
- [x] 取得クエリを `date` 単日から `from=yesterday / to=tomorrow` へ変更
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Worker ID Resolution Fix (2026-03-07)

- [x] `useAuth.authz` に `jinzaiId`（`workerId` と同値）を追加し、清掃側 `yotei` 参照キーの互換性を確保
- [x] 清掃員予定一覧 `MyYoteiListPage` の担当ID解決を `authz.workerId` 優先へ修正
- [x] 清掃エントランス通知の予定照合を `#` プレフィックス差異（`SAGYOUIN#...` 等）を吸収する比較へ改善
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Worker Field Match Hardening (2026-03-07)

- [x] 清掃員予定一覧の参加者ID抽出を拡張（`worker_ids / worker_id / sagyouin_id / assigned_to / cleaner_id` も自己判定対象化）
- [x] ID比較をプレフィックス差異吸収型へ強化（`JINZAI#xxx` と `xxx` を同一視）
- [x] `yotei` 取得クエリで `jinzai_id` に加えて `worker_id / sagyouin_id / assigned_to` も送信し、API差異を吸収
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Self Fetch Fallback (2026-03-07)

- [x] `assignScope=self` で0件時、担当者条件を外した再取得へフォールバックし、APIフィルタ差異による取りこぼしを回避
- [x] 参加者ID抽出をさらに拡張（`sagyouin_ids / assignee_id / cleaner_ids / workers / jinzai / worker / sagyouin`）
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Card ID Always Visible (2026-03-07)

- [x] 清掃員 `yotei` カードの折りたたみ外に `予定ID` を常時表示
- [x] `my-yotei.css` にID表示の視認性スタイルを追加（小型コード表示）
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yotei: Card ID Visible on Timeline (2026-03-07)

- [x] 管理側 `yotei` タイムラインカード（昼帯/夜帯）に `ID` 行を追加
- [x] `admin-yotei-timeline.css` にカードID表示スタイル（小型モノスペース）を追加
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yotei: New Modal ID Visibility (2026-03-07)

- [x] 管理側 `新規予定登録 / 予定編集` モーダルに `予定ID` 行を追加
- [x] 新規時は `保存後に自動採番`、編集時は実ID（解決不可時は `未設定`）を表示
- [x] `admin-yotei-timeline.css` にモーダルID表示スタイルを追加
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yotei: Today Timeline Card ID Visible (2026-03-07)

- [x] 管理側 `today` 表示のタイムラインカード（昼/夜）にも `yotei ID` 行を追加
- [x] カード内でIDが読めるよう、`today-rail-card` の高さ/余白とID表示スタイルを調整
- [x] レーン重なり防止のため `todayLanePx` を拡張
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Entrance: Notice Fetch Identity Match Fix (2026-03-07)

- [x] 清掃エントランスの `yotei` 取得クエリで小文字化IDを送っていた不整合を修正（生IDを `jinzai_id / worker_id / sagyouin_id / assigned_to` に送信）
- [x] API側フィルタで0件時、担当者条件なし再取得フォールバックを追加して取りこぼしを防止
- [x] 担当者照合トークンに `worker_name / jinzai_name / sagyouin_name` とログインユーザー名を含め、ID未保持データにも対応
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Entrance: Notice API Endpoint Fix (2026-03-07)

- [x] 清掃エントランス通知の `yotei` 取得先を `api-master` から `yotei` API（`YOTEI_API_BASE`）へ切替
- [x] 初回取得とフォールバック取得の両方を同一 `yotei` API 経路に統一
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Entrance: Notice Content + Scope Update (2026-03-07)

- [x] エントランス通知の表示対象を `前日/当日/明日` から `未完了の直近5件` へ変更
- [x] 通知ラベルを相対表記（前日/当日/明日）から `YYYY/MM/DD` の日付表示へ変更
- [x] 通知カードに `屋号 + 店舗名` を明示表示する構成へ統一
- [x] 未完了判定を追加（`完了/取消` 系状態を除外）して抽出精度を改善
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Entrance: Notice Yagou + Time Range Fix (2026-03-07)

- [x] 通知カードの `屋号` 取得候補を拡張し、`yagou_name` 未保持時は `yagou_id` までフォールバック表示
- [x] 通知カードの時間表示を `開始` 単体から `開始〜終了` のレンジ表示に変更
- [x] `end_time / end_at / work_end_at` など複数キーの終端時刻を吸収
- [x] `npm -C src/misogi run build` でビルド確認
