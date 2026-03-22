# LINE_CHECKLIST（P6 完了判定・運用で回り続ける条件）

AGENTS.md 準拠: 変更を finalize する前にここを完了させる。

---

## Repo Housekeeping: Root Artifact Cleanup (2026-03-15)

- [x] ルート直下の生成物/一時成果物（`zip/log/json/txt/ics`）を `archive/root_artifacts/2026-03-15/` へ退避
- [x] 実行系ファイル（`src/`, `scripts/`, `lambda_function.py`, `requirements.txt` など）は未変更のまま維持
- [x] 既存で削除状態だった `import_to_db*` 系ファイルには追加変更を加えず、そのまま尊重
- [x] ルート一覧の視認性改善（散在成果物を集約）

## HTML Legacy Contrast Inventory (2026-03-15)

- [x] `src/**.html`（`node_modules`除外）を集計し、現行運用/生成物/レガシー候補に分類
- [x] 現行運用を `src/misogi/index.html`（Viteエントリ）として明示
- [x] `src/misogi/dist/index.html` を生成物（編集対象外）として分離
- [x] レガシー候補のカテゴリ別件数と `src/misogi` 内レガシーHTML 4件を整理（`docs/spec/HTML_LEGACY_CONTRAST_20260315.md`）

## Misogi Legacy HTML Cleanup (2026-03-15)

- [x] `src/misogi/pages/jobs/sales/entrance/*.html`（4件）を `archive/legacy_html/src/misogi/pages/jobs/sales/entrance/` へ退避
- [x] 退避方針を `archive/legacy_html/README.md` に記録
- [x] 関連仕様ドキュメントの参照先を退避後パスへ更新（`src/misogi/docs/SALES_CLIENT_NEW_INVITE_BUTTON_SPEC.md`）

## Legacy Pages Archive: `src/pages` (2026-03-15)

- [x] `src/pages`（レガシー静的HTML群、119 files）を `archive/legacy_html/src/pages` へ退避
- [x] 退避内容を `archive/legacy_html/README.md` に追記
- [x] HTML対比ドキュメントを最新状態へ更新（`docs/spec/HTML_LEGACY_CONTRAST_20260315.md`）

## Admin Customer Master: Manual Input Save Reflection Fix (2026-03-12)

- [x] 顧客マスタ編集の保存処理で、更新APIの対象IDを編集中値ではなく元レコードIDで固定（自由入力時の誤パス更新を防止）
- [x] `tenpo` 保存時に `kokyaku_id/kokyaku_name/torihikisaki_name/yagou_name` も差分反映するよう拡張
- [x] 自由入力で取引先ID・屋号IDを変更した場合でも、保存後の再取得で表示が欠落しにくいよう補助項目を永続化
- [x] `npm -C src/misogi run build` でビルド成功を確認

## Admin Customer Master: Single-Page Batch Edit + Create (2026-03-12)

- [x] `顧客マスタ` 画面内で `取引先 / 屋号 / 店舗` を新規追加できる3カードUIを追加
- [x] 追加APIを `POST /master/torihikisaki`・`POST /master/yagou`・`POST /master/tenpo` へ統一し、同画面再読込で反映
- [x] 取引先・屋号の候補連動（店舗追加時に取引先絞り込み/屋号連携）を実装
- [x] 一括編集の見やすさ向上のため、`顧客マスタ` 専用の作成セクションCSS（ライト/ダーク両対応）を追加
- [x] `npm -C src/misogi run build` でビルド成功を確認

## Admin Customer Master: Create UI Consistency + Kokyaku Inputs (2026-03-12)

- [x] 新規追加セクションの先頭カードを `顧客 / 取引先を追加` へ変更し、`顧客ID(kokyaku)`・`顧客名(kokyaku)` 入力を追加
- [x] `取引先追加` API送信時に `kokyaku_id` / `kokyaku_name` を同時保存するよう拡張
- [x] 新規追加3カードのボタンサイズを統一（幅100%・同一高さ・同一配置）
- [x] `npm -C src/misogi run build` でビルド成功を確認

## Admin Customer Master: Create Button Pop Style (2026-03-12)

- [x] 新規追加3カードの `primary` ボタンを強い角丸（ピル形）へ変更
- [x] ボタン配色をポップ寄りグラデーションへ調整（既存パレット準拠）
- [x] ホバー/押下/無効時の見た目を追加して操作感を改善
- [x] `npm -C src/misogi run build` でビルド成功を確認

## Admin Customer Master: Edit Input Mode UI Refresh (2026-03-12)

- [x] 編集モーダルの `入力モード` をチェックボックス式から `構造化入力 / 自由入力` の2択トグルUIへ変更
- [x] モード説明文を追加し、自由入力時は警告色で注意喚起する表示へ調整
- [x] ダーク/ライト両テーマでモードトグルの配色と可読性を最適化
- [x] `npm -C src/misogi run build` でビルド成功を確認

## Admin Customer Master: Sticky List Header On Scroll (2026-03-12)

- [x] 顧客マスタ一覧のテーブルヘッダーを `position: sticky` 化し、スクロール時も上部に固定表示
- [x] 顧客マスタのみテーブルラッパーに高さ制約を追加し、一覧スクロールをページ全体と分離
- [x] ライト/ダーク両テーマで sticky ヘッダー背景と境界線を調整
- [x] `npm -C src/misogi run build` でビルド成功を確認

## Admin Torihikisaki Meibo: Theme Tone Sync (2026-03-12)

- [x] `取引先名簿` のライトテーマ基調色を管理ページ共通トーンへ調整（背景 `#FCF9EA` / ヘッダー `#FFDBDB`）
- [x] テキスト・ミュート色を `#493628` 系へ統一し、他管理ページと視覚整合
- [x] 行ホバー/選択色、ボタン境界色、エラー表示色をピンク系パレットへ調整
- [x] `npm -C src/misogi run build` でビルド成功を確認

## Admin Sidebar: Dashboard/Filebox Direct Buttons (2026-03-11)

- [x] 管理サイドバーの `ダッシュボード` / `ファイルボックス` をアコーディオン開閉対象から除外
- [x] 上記2項目は単一遷移先のダイレクトボタンとして表示（1クリックで遷移）
- [x] 既存の他カテゴリ（複数項目）は従来通りアコーディオン表示を維持
- [x] `npm -C src/misogi run build` でビルド成功を確認

## Admin Entrance: Default Open Dashboard (2026-03-11)

- [x] `/admin/entrance` を `/admin/dashboard` へ `replace` リダイレクトするよう変更
- [x] 管理エントランス起動時にダッシュボード表示モードが初期表示になることをルーティングで統一
- [x] `npm -C src/misogi run build` でビルド成功を確認

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

## Cleaning Entrance: Top-Left Login/Logout Tag (2026-03-07)

- [x] 清掃エントランス左上に `ログイン / ログアウト` タグボタンを追加
- [x] 未ログイン時は `ログイン` 表示で `/` へ遷移、ログイン済み時は `ログアウト` 実行
- [x] safe-area（ノッチ）を考慮した固定配置スタイルを追加
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Entrance Single View + Hotbar List View Split (2026-03-07)

- [x] 清掃エントランス予定バブル押下時は `yotei_id` をクエリで渡し、`単体表示` で開くよう変更
- [x] HOTバーの `予定` から開く `/jobs/cleaning/yotei` は従来どおり `一覧表示`（全件）を維持
- [x] 一覧表示はリスト名（屋号/店舗）を押すと、詳細と引き継ぎを展開するUIへ変更
- [x] 単体表示時は `一覧表示へ` ボタンを追加し、通常一覧へ戻れる導線を追加
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Single View Density Up (2026-03-07)

- [x] 単体表示から `予定（単体）` ラベル、`一覧表示へ` ボタンを除去
- [x] 単体表示では `件数 / 有効` サマリーを非表示化
- [x] 単体表示では日別ヘッダー（日付・件数）を非表示化
- [x] 単体表示では `詳細` を折りたたみではなく常時表示に変更
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Worker UI: Always Hotbar + No Breadcrumb Header (2026-03-07)

- [x] 清掃員ルート（`/jobs/cleaning/*`）では共通 `Breadcrumbs` を完全非表示化
- [x] 清掃員ルート共通のトップバーを追加（左上 `戻る` / 右上 `ログイン・ログアウト`）
- [x] 清掃エントランス内の旧ログインタグを削除し、共通トップバーへ統一
- [x] 清掃員ページ（`entrance` / `houkoku` 以外）にナビ用HOTバーを常設表示
- [x] safe-areaと重なり回避のため、清掃員ルートに上部/下部余白を追加
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Entrance: Notice Bubble Narrow + Running Slide Switch (2026-03-07)

- [x] 清掃エントランスの直近予定バブル幅を調整（`min(84vw, 620px)`）し、表示をコンパクト化
- [x] 各予定バブルにスライド式スイッチを追加（右ONで `実行中`）
- [x] スイッチON時はバブルを赤系スタイルへ変更し、状態タグを `実行中` 表示
- [x] スイッチ状態を `localStorage(misogi-v2-cleaning-notice-running)` に保存
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yotei: Cleaning Running Sync + Card Status Emphasis (2026-03-07)

- [x] 清掃エントランスの `実行中` スイッチを `localStorage` のみではなく `yotei` API（`PUT /yotei/{id}`）へ保存するよう変更
- [x] `実行中` 保存時に `jokyo / ugoki_jokyo / ugoki_jotai` を更新し、管理側タイムラインへ状態連携
- [x] 管理 `yotei` タイムラインの状態判定を `yotei` 側 `jokyo` 優先へ調整（清掃側実行状態を即反映）
- [x] 管理タイムラインカード（todayレール/作業員レーン）に `実行中` の大きめラベルを追加
- [x] 管理タイムラインの `status-shinkou` カード配色を強調し、実行中の視認性を向上
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Entrance: Bubble Swipe Switch + 30min Gate (2026-03-07)

- [x] 直近予定バブルを「内部スイッチ」方式から「バブル本体スライド」方式へ変更
- [x] 予定開始30分前までは `待機中`、30分前以降は `実行可`、実行中は `実行中` を表示
- [x] `実行可` の予定のみ `実行中` に遷移できるようガードを追加（早すぎる操作はアラートで抑止）
- [x] バブルの `詳細` ボタンを廃止し、`タップで詳細画面 / スライドでugoki変更` に統一
- [x] 予定バブルの表示幅を画面いっぱい（左右safe-area考慮）に拡張
- [x] スワイプUI専用スタイルを追加（白基調、待機/実行可/実行中の背景色分離）
- [x] 実行中スライド距離を短縮（`82px`）し、発火閾値も調整（`46px`）
- [x] `実行中` ステータスラベルの左右余白を縮小（`padding 2px 6px`）
- [x] 時刻表示確保のため、内部グリッドの `gap` と各タグ余白を追加で圧縮（`gap 8→5`, `day/yagou/status` のpadding縮小）
- [x] さらに実行中側の空き量を減らすため、スライド距離を再短縮（`68px`）し、発火閾値を再調整（`38px`）
- [x] 背面ステータスを左右配置へ再設計（左: `実行中` / 右: `待機中・実行可`）、バブル本体は日付・屋号・店舗・時間のみ表示
- [x] バブルを左右スライドで状態変更できるよう更新（右寄せ=実行中 / 左寄せ=待機・実行可）
- [x] 店舗と時間の間隔を圧縮し、時間を左寄せ表示へ調整（見切れ防止）
- [x] 背面ステータスの色を高彩度化（実行中: 赤 / 実行可: 緑 / 待機中: グレー）
- [x] ステータス片側表示に統一（待機/実行可では左ステータス非表示、実行中では右ステータス非表示）
- [x] 背面/前面の不透明化を実施（透過背景を廃止）
- [x] ステータス表示を楕円チップから全面色ブロック＋白文字ラベルへ変更
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Entrance: Foreground/Background Bubble Refinement (2026-03-07)

- [x] 直近予定バブルを前面詳細バブル（`日付/屋号/店舗/時間`）+ 背面ステータスバブルの2層構造に統一
- [x] 背面ステータスを中央分割のベタ塗りへ変更（左半分: 赤 `実行中` / 右半分: グレー `待機中`）
- [x] 前面詳細バブルを左右スライド可能にし、左右どちらか一方の背面ラベルのみ表示される挙動へ調整
- [x] スワイプ判定を双方向化（`-MAX..+MAX`）し、保存スナップ位置も左右固定へ変更
- [x] 前面/背面バブル間の余白（マージン/パディング由来の隙間）を除去し、不要表示を解消
- [x] `実行中 / 待機中` ラベルを白文字で常時視認できる位置（左/右端寄せ）へ調整
- [x] 前面詳細バブルの左右スナップを背面端に一致させ、反対色の背面露出を解消
- [x] 予定バブルのボーダーを削除（ダークモードで白縁が目立つ問題を解消）
- [x] 詳細バブル内に売上表示（`¥...`）を追加し、予定単価の視認を強化
- [x] 詳細バブル内部の左右パディングを `5px` に調整（バブル本体サイズは維持）
- [x] 左側情報を `日付 → 時間(2行: 開始/終了) → 屋号/店舗` の順に再配置
- [x] 時間表示を2行化しつつ、フォント/間隔を最適化してバブル高さを固定維持
- [x] 詳細バブル内部の左右パディングを追加拡張（`9px`）して余白を確保
- [x] `屋号 / 店舗` フォントサイズを拡大し、視認優先に再調整
- [x] バブル内テキスト全体を一段拡大し、縦方向の余白を活用するよう最適化
- [x] 詳細バブル内部の左右パディングを `16px` へ再調整
- [x] `屋号 / 店舗` をさらに拡大（特に店舗名を強調）
- [x] 開始/終了時間をタグ化（2行ともチップ表示）し視認性を向上
- [x] `屋号 / 店舗` を追加拡大（`屋号 13px / 店舗 15px`）へ再調整
- [x] `屋号 / 店舗` サイズを最終調整（`屋号 16px / 店舗 14px`）
- [x] エントランス予定の並び順を時系列固定（古い予定を上、新しい予定を下）へ変更
- [x] 予定バブル表示位置を `HOTバー上 + 50px` へ固定し、下端を動かさず上方向へ積み上がる配置へ変更
- [x] 5件上限時は新しい側5件を採用し、追加予定が下端に出る挙動へ調整（表示順は古い→新しい）
- [x] 右スライド（待機→実行）時に開始確認オーバーレイを追加（MISOGI文言 + `はい/いいえ`）
- [x] 確認文言をログイン名差し込み形式へ変更（`〜様。作業開始いたしますか？`）
- [x] `はい` 選択時は実行状態を保存して当該予定の詳細画面へ遷移、`いいえ` で待機側へ復帰
- [x] 開始確認オーバーレイのメタ情報を拡張（`日付 / 屋号・店舗 / 時間` を表示）
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Briefing-First Detail UX + Local Hotbar (2026-03-07)

- [x] `/jobs/cleaning/yotei?view=single` の初期表示を「詳細未表示」に変更（デフォルトで詳細を展開しない）
- [x] 単体予定画面に `MISOGI ブリーフィング` 初期パネルを追加（現場開始前の説明を先に表示）
- [x] 単体予定画面専用のローカルHOTバーを追加（左から `詳細 / 履歴 / 報告 / ツール`）
- [x] `詳細` 選択時のみ、詳細グリッドを下からフェードイン表示するボトムシート挙動を実装
- [x] `履歴` タブから既存 `対応履歴`（SupportHistoryDrawer）を開ける導線を追加
- [x] `報告` タブから当該予定IDで `houkoku` へ遷移する導線を追加
- [x] `ツール` タブに補助操作（再取得/店舗履歴）を追加
- [x] 一覧画面（非single）側のカード動作・既存導線は維持
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Global Hotbar Switch on Single Detail (2026-03-07)

- [x] 清掃共通HOTバーを `view=single` 時のみ `詳細 / 履歴 / 報告 / ツール` に切替
- [x] `view=single` では共通HOTバー操作をクエリ `tab` 同期に変更（`tab=detail|history|report|tools`）
- [x] 単体予定画面の表示内容を `tab` クエリ駆動へ統一（ローカル重複HOTバーを撤去）
- [x] 通常画面（`view=single` 以外）は従来の共通HOTバー（`報告 / 予定 / ツール / 設定`）を維持
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Visualizer Top Fix on Single Detail (2026-03-07)

- [x] `view=single` の予定詳細画面のみ、ビジュアライザーを画面上部へ固定表示
- [x] 固定表示に伴い本文開始位置をオフセット調整し、コンテンツ被りを防止
- [x] 一覧画面（非single）のビジュアライザー挙動は変更しない
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Single Detail Visual Tuning (2026-03-07)

- [x] `.app-fullscreen` 背景を `rgba(255, 255, 255, 0.06)` に変更
- [x] `view=single` の `.report-page-viz` 上端を `top: calc(env(safe-area-inset-top))` へ変更
- [x] `view=single` のビジュアライザー光彩を無効化（`core-circle` の `box-shadow` / `filter` をオフ）
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Worker Header: Back Button to Entrance (2026-03-07)

- [x] 清掃ヘッダー左上ボタン文言を `戻る` から `エントランス` へ変更
- [x] 左上ボタン押下時の遷移を履歴戻りから `/jobs/cleaning/entrance` 固定へ変更
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Briefing Reset Button on Toolbar (2026-03-07)

- [x] `view=single` のツールバー右列に `ブリーフィング` ボタンを追加（`更新` と同じ行）
- [x] `ブリーフィング` 押下で `tab` クエリを解除し、HOTバー選択解除状態（ブリーフィング表示）へ復帰
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Briefing Content Reorder (2026-03-07)

- [x] ブリーフィング表示を指定順へ変更（`MISOGIコメント → ID/日付/時間/屋号店舗 → プラン`）
- [x] ブリーフィング情報ブロックを追加（`ID / 日付 / 時間 / 屋号・店舗`）
- [x] ブリーフィングの `プラン` セクションを追加（サービス/作業種別をタグ表示）
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Single View Duplicate Removal (2026-03-07)

- [x] `view=single` で上段の重複表示（時間/ID/店舗名/引き継ぎ）を非表示化
- [x] 単体画面は `ブリーフィング + HOTバー切替パネル` 中心の表示へ整理
- [x] 一覧画面（非single）の既存表示は維持
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Briefing Section Flatten (2026-03-07)

- [x] ブリーフィングDOMを簡素化（見出し階層を削減し `コメント / 情報行 / プラン` のフラット構成へ）
- [x] ブリーフィングCSSを簡素化（過剰な区切り・入れ子スタイルを削減）
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Single View DOM Depth Reduction (2026-03-07)

- [x] `view=single` ヘッダーの不要ラッパーを削減（`my-yotei-title` 層を除去）
- [x] ブリーフィング内の中間ラッパー（`facts` / `row-plan`）を撤去し、行要素を直下へフラット化
- [x] 詳細シートの中間ラッパー（`my-yotei-detail`）を撤去し、`detail-sheet` 直下に `detail-grid` を配置
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Single Briefing Hint Above Hotbar (2026-03-07)

- [x] `view=single` かつ `tab未選択`（ブリーフィング状態）のときだけ、HOTバー直上に誘導ヒントを表示
- [x] ヒント文言を `↓ 詳細を押して確認を開始` とし、下向き矢印で操作誘導を追加
- [x] ライト/ダーク両モードで視認性を維持する専用スタイルを追加
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Briefing as Navigation Only (2026-03-07)

- [x] `view=single` のブリーフィングセクションから詳細情報（ID/日付/時間/屋号店舗/プラン）を撤去
- [x] ブリーフィングは `詳細` タブ操作を促す MISOGI ナビ文のみ表示に変更
- [x] 使わなくなったブリーフィング用変数を削除し、描画ロジックを簡素化
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Briefing Navigation Always Visible (2026-03-07)

- [x] `view=single` のMISOGIナビ（ブリーフィング文）を `tab` 状態に依存せず常時表示へ変更
- [x] `tab未選択` 専用判定を削除し、単体予定画面内でナビ表示を固定化
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Move MISOGI Nav Under Visualizer (2026-03-07)

- [x] MISOGIナビを予定カード内から分離し、`report-page-main` 先頭（ビジュアライザー直下）へ移設
- [x] `view=single` 時のみ上部ナビセクションを描画する構成へ変更
- [x] 上部ナビ専用スタイル（`my-yotei-top-briefing`）を追加し、既存トーンを維持
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: MISOGI Speaker Label + Briefing Button Removal (2026-03-07)

- [x] 上部MISOGIナビに左右パディングを追加し、safe-area考慮の余白で見栄えを調整
- [x] ナビ文先頭に `MISOGI` 話者ラベルを追加し、誰のコメントか視覚的に識別可能化
- [x] `view=single` ツールバーの `ブリーフィング` ボタンを削除
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Day Section Border Removal (2026-03-07)

- [x] `.my-yotei-day` の外枠ボーダー（`border: 1px solid var(--card-border)`）を削除
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Top Nav Header Layout + Toolbar Cleanup (2026-03-07)

- [x] MISOGIナビを「ヘッダー（`MISOGI`）+ 下段コメント」構成へ変更
- [x] 上部MISOGIナビを中央寄せ（見出し・本文とも中央配置）へ調整
- [x] `view=single` の `更新` ボタンを削除
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Detail Sheet Hidden by Default in Briefing (2026-03-07)

- [x] `view=single` の詳細シートから通常詳細クラス（`my-yotei-detail`）を分離し、非表示状態で箱が出ないよう修正
- [x] ブリーフィング初期表示時は `my-yotei-detail-sheet` が完全非表示（`open` 時のみ表示）となる構成へ整理
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Hint Arrow Alignment to Detail Icon (2026-03-07)

- [x] ブリーフィング時ヒントを「テキストバッジ + 矢印ピン留め」構成へ変更
- [x] `↓` 矢印をHOTバー1つ目（`詳細`）アイコン中心に一致するよう位置計算で固定
- [x] ライト/ダーク両テーマで矢印・ヒントの視認性を維持
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Hint Label Start Alignment (2026-03-07)

- [x] ヒント表示を「矢印単体固定」から「矢印+文言ラベル全体の先頭固定」へ変更
- [x] ラベルの開始X座標を `詳細` アイコン中心と一致するよう調整
- [x] ラベル全体を1つのバッジとして表示し、テーマ別配色は維持
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Hint Text-Only Style (2026-03-07)

- [x] ヒントラベルの背景・ボーダー・シャドウを削除し、テキストのみ表示へ変更
- [x] 矢印+文言の位置合わせロジックは維持（先頭X座標は`詳細`アイコン基準）
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Hint Arrow Center Fine Tuning (2026-03-07)

- [x] ヒント全体を左へ `5px` 微調整し、矢印中心を `詳細` アイコン中心へ合わせ込み
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Hint Lift + Bounce Animation (2026-03-07)

- [x] ヒント表示位置を上方向へ `約10px` オフセット
- [x] ヒント全体にバウンスアニメーションを追加（軽い上下リズム）
- [x] 既存の横位置補正（`-5px`）は維持
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Guided Order Lock (2026-03-07)

- [x] `view=single` で `briefing_checked` クエリが未完了時、HOTバーの `詳細` 以外（`履歴/報告/ツール`）を disabled 化
- [x] 未確認状態で `履歴/報告/ツール` を押しても遷移しないガードを追加
- [x] `詳細` タブ上部に作業前確認チェック（3項目）を追加
- [x] 3項目完了後の `確認完了して報告を解放` で `briefing_checked=1` を付与
- [x] `報告` タブは未確認時に開始不可 + `詳細へ移動` 導線を表示
- [x] `詳細` 内チェックUIのスタイルを追加
- [x] `作業前確認` ブロックを `詳細情報グリッドの下` へ移動（表示順を下段化）
- [x] `詳細` タブ表示中は `詳細を押して確認を開始` ヒントを非表示化
- [x] `詳細` タブ表示中のパネル先頭に `詳細` ヘッダーラベルを表示
- [x] `詳細` パネルを `基本情報 / 注意事項 / 作業内容` の3サブタブ切替に変更
- [x] `作業前確認` を詳細情報タブとは別ブロックとして下段に独立配置
- [x] `作業前確認` チェック文言を指定3項目へ更新（実施場所/注意事項/作業内容）
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yotei: Yakusoku Reflection Consistency (2026-03-07)

- [x] `yakusoku` API取得失敗時のフォールバック（`yotei`抽出）に `service_ids/service_names/work_type` を含めるよう補強
- [x] 編集モーダルで `yakusoku` 連携が未反映の既存予定（サービス未設定）に限り、`yakusoku` からサービス情報を自動補完
- [x] 既に `yotei` スナップショット（サービス情報）がある既存予定は上書きしないガードを追加
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yotei: Work Type Two-Option Unification (2026-03-07)

- [x] `作業種別` 選択肢を `定期清掃 / スポット清掃` の2択に統一
- [x] 既存データの旧表記（例: `定期清掃（○ヶ月）` / `単発`）を編集時に2択へ正規化
- [x] `yakusoku` フォールバック抽出・保存ペイロードでも `work_type` を2択正規化
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Briefing Service Display Unified (2026-03-07)

- [x] 清掃側 `作業内容` タブの `作業種別` を `定期清掃 / スポット清掃` 表示へ統一
- [x] `サービス` はIDフォールバックを廃止し、日本語サービス名のみタグ表示に変更
- [x] 一覧詳細の `サービス` 表示も同ルールへ統一（ID非表示）
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Service Tag Two-Line Layout (2026-03-07)

- [x] 清掃側 `作業内容` タブの `サービス` を2行レイアウトへ変更（1行目タイトル / 2行目タグ）
- [x] タグ行を全幅折り返し表示へ調整（画面幅に応じて羅列）
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Keep Briefing Unlock State (2026-03-07)

- [x] `予定ID` 単位で `作業前確認→報告解放` 状態を `localStorage` へ永続化
- [x] 単体予定画面の判定を `query(briefing_checked) or localStorage` の統合判定へ変更
- [x] 清掃側HOTバーの `詳細以外ロック` 判定も同じ永続化状態に連動
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Hide Gate After Unlock + Briefing Message/Declaration (2026-03-07)

- [x] 報告解放済み（`briefing_checked`）の予定では `作業前確認` セクションを非表示化
- [x] MISOGIナビ文言を解放済み時に指定2行へ差し替え（業務内容確認への労い + 履歴/報告の利用案内）
- [x] ナビ文言判定を永続化状態（`localStorage`）に連動させ、再訪時も維持
- [x] ブリーフィング表示（`view=single` かつ `tab未選択`）時に「ミセサポ安心保証 宣言」テキストを表示
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Move Declaration Into Yotei Card (2026-03-07)

- [x] 「ミセサポ安心保証 宣言」の描画位置を上部MISOGIナビから `yotei` カード内（ブリーフィング時）へ移設
- [x] 上部ナビ側の宣言コンテナ描画を削除し、不要な空枠表示を解消
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: One-Time Declaration Agree + Detail Guidance (2026-03-07)

- [x] 宣言表示を `view=single` 初回のみ表示（アカウント単位の `localStorage` 永続化）
- [x] 宣言に同意チェックを追加し、チェック時に `詳細` タブへ自動誘導
- [x] 同意済みアカウントでは以後のブリーフィングで宣言を非表示化
- [x] MISOGIナビ文言を同意状態に応じて切替（未同意: 宣言同意を案内 / 同意済: 詳細確認を案内）
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Lock Detail Until Declaration Consent (2026-03-07)

- [x] 宣誓未同意時は予定詳細HOTバーの `詳細/履歴/報告/ツール` を全てロック
- [x] 宣誓未同意時はURLクエリで `tab=detail` を指定しても詳細パネルを開かないガードを追加
- [x] 宣誓同意後のみ `詳細` 解放（従来どおり `履歴/報告/ツール` は作業前確認完了までロック）
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Declaration-State Nav Message Update (2026-03-07)

- [x] 宣誓表示中（未同意時）のMISOGIナビ文言を指定文へ変更
- [x] 文言: `ご苦労様です。ミセサポ安心保証宣言に同意して、詳細確認へとお進みください。`
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Declaration Wording Unified to Oath (2026-03-07)

- [x] UI文言を `宣言` から `宣誓` へ統一（タイトル/ナビ文/同意チェック文）
- [x] 宣誓セクションのARIAラベルも `宣誓` 表記へ統一
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Show Oath on Initial Briefing Per Yotei (2026-03-07)

- [x] 宣誓同意状態の保存キーをアカウント単位から `予定ID` 単位へ変更
- [x] 予定ごとのブリーフィング初期画面で宣誓が表示される挙動へ調整
- [x] 同一予定で同意済みの場合のみ宣誓を非表示化し、詳細へ進行可能
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Oath Agree Flow Without Auto Transition (2026-03-07)

- [x] 宣誓同意チェック時の `詳細` 自動遷移を廃止（手動で詳細ボタンを押す導線へ変更）
- [x] 宣誓同意後もブリーフィング初期画面では宣誓カードを即時非表示にしない挙動へ変更
- [x] 同意後のMISOGIナビ文言を「同意確認済み + 詳細へ進行案内」に切替
- [x] 同意後にHOTバーの `詳細` が解放され、詳細ヒントが表示される導線を維持
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Report Start Guard by Oath/Briefing/Working (2026-03-07)

- [x] 報告開始条件を `宣誓同意 + 作業前確認完了 + 予定状態=実行中(working)` に厳格化
- [x] 単体 `報告` タブの開始ボタンを条件連動でdisabled化し、不足条件に応じた案内文へ切替
- [x] 一覧カードの `この予定で報告` ボタンも同条件でdisabled化
- [x] `openHoukokuFromYotei` 側でも同条件の実行ガードを追加（条件未達時は遷移しない）
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Keep Oath Hidden After Return (2026-03-07)

- [x] 同一予定で `作業前確認完了/報告解放` 済みの再訪時、宣誓同意フラグを自動補完
- [x] これによりエントランスへ戻って再入場しても宣誓を再表示しない挙動へ統一
- [x] MISOGIナビ文言と宣誓表示条件の状態ズレを解消
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Default Detail View After Report Unlock (2026-03-07)

- [x] `報告解放済み` かつ `tab未指定` の単体予定画面で、表示タブを `詳細` に既定化
- [x] ページ本体（`MyYoteiListPage`）とHOTバー選択状態（`CleaningWorkerChrome`）の既定タブ解決を統一
- [x] 宣誓未同意時のタブロック仕様は維持
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Fix Briefing Checked Init Order Error (2026-03-07)

- [x] `effectiveSingleHotbarTab` が `briefingChecked` を初期化前参照していた順序不整合を修正
- [x] `MyYoteiListPage.jsx:601` の `ReferenceError` を解消
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Detail Hotbar Icon to Search (2026-03-07)

- [x] 予定詳細HOTバーの `詳細` アイコンを `plan` から `preview`（虫眼鏡）へ変更
- [x] `履歴/報告/ツール` の既存アイコンは維持
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: History Hotbar Icon to Teleop (2026-03-07)

- [x] 予定詳細HOTバーの `履歴` アイコンを `テレオペアイコン.svg` ベースへ差し替え
- [x] `public/icons/hotbar/history.svg` を追加し、`hotbar.css` に `hotbar-icon-history` を追加
- [x] `CleaningWorkerChrome.jsx` の `履歴` アイコン指定を `settings` から `history` に変更
- [x] `npm -C src/misogi run build` でビルド確認

## Yotei: Yakusoku Unit Price + Cleaning Reward Tab (2026-03-07)

- [x] 管理 `yotei` カードに `小計売り上げ`（yakusoku単価優先）を表示（本日タイムライン/予約表）
- [x] `yotei` 保存時に `unit_price` スナップショットを保持し、yakusoku取得不可時でも金額共有できるよう補強
- [x] 清掃側 `詳細` サブタブに `報酬` を追加し、`報酬 = 小計売り上げ × 80%` を表示
- [x] 清掃側 `基本情報` に `小計売り上げ` 項目を追加
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Sales: Worker MyPage + Admin Management (2026-03-07)

- [x] 清掃員向け `マイページ（売上）` を追加（`/jobs/cleaning/mypage`）
- [x] 清掃員マイページで月次の `対象件数 / 小計売り上げ / 報酬見込(80%)` を表示
- [x] 清掃員マイページで予定単位の売上明細（屋号/店舗/時間/状態/小計売り上げ/報酬）を表示
- [x] 管理向け `清掃売上管理` ページを追加（`/admin/cleaning-sales`）
- [x] 管理ページで清掃員別の月次集計（件数/小計売り上げ/報酬見込/状態内訳）を表示
- [x] 管理サイドバー `スケジュール管理` 配下に `清掃売上管理` 導線を追加
- [x] 清掃エントランスHOTBAR `予定` 配下に `マイページ（売上）` 導線を追加
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Sidebar: Move Cleaning Sales To Staff Section (2026-03-07)

- [x] `清掃売上管理` 導線を `スケジュール管理` から削除
- [x] `清掃売上管理` 導線を `人材管理` 配下へ移動
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Cleaning Sales: Contractor Calendar + Top 5 Cards (2026-03-07)

- [x] `清掃売上管理` を業務委託者ごとの月次カレンダー管理UIへ変更
- [x] 画面左に業務委託者（清掃員）名のリストを追加し、選択者を切替可能化
- [x] 画面上部に売上上位者の統計カードを追加（1位〜5位）
- [x] 選択清掃員のカレンダーセルに日次の `小計売り上げ` と `件数` を表示
- [x] 月次総計サマリ（対象清掃員/件数/小計売り上げ/報酬見込）を維持
- [x] 月次総計サマリに `総売り上げ（予定ベース）` を追加（予定ID単位で重複排除）
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Cleaning Sales: Worker Horizontal + Date Vertical Matrix (2026-03-07)

- [x] 集計対象を清掃員へ限定（人材マスタの部署/職種/役割に `清掃/cleaning` を含む対象）
- [x] 表示をマトリクス化（横軸: 清掃員名 / 縦軸: 月の日付1〜末日）
- [x] ヘッダーは `上段=該当者の小計売上合計`、`下段=名前` の順で表示
- [x] 日付行セルはその日の `小計売上` のみ表示（余計な補助情報を非表示）
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Cleaning Sales: Remove Ranking Block (2026-03-07)

- [x] 画面上部の `売上上位5名`（順位）セクションを削除
- [x] 順位セクションに紐づくフロントロジック（`topFive`）を削除
- [x] 順位用CSS（`admin-cleaning-sales-top5` 系）を削除し、未使用スタイルを整理
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Report Unlock Running-Status Rule Fix (2026-03-07)

- [x] 清掃 `yotei` の実行中判定を `jotai/status` だけでなく `jokyo/ugoki_jokyo/ugoki_jotai/ugoki_status/progress_status` まで統合
- [x] 実行中判定の別名 (`working/shinkou/in_progress/progress/実行中/進行中`) を同一ルールで解釈
- [x] 報告開始直前に `GET /yotei/{id}` で最新状態を再取得して再判定（状態反映遅延の吸収）
- [x] 詳細内 `状態` 表示も同じ統一判定を参照するように修正
- [x] `npm -C src/misogi run build` でビルド確認

## Customer: MyPage Store URL + Address List (2026-03-09)

- [x] お客様向け `お客様マイページ` を v2 に新規追加（`/customer/mypage`）
- [x] 店舗マスタ（`tenpo`）から `店舗ID / 店舗名 / 住所 / URL` を一覧表示
- [x] `URL` 未設定店舗には仮URL（`https://store.misesapo.local/{tenpo_id}`）を自動補完表示
- [x] 検索（店舗名/住所/URL）と手動更新を実装
- [x] パンくず表示名に `お客様マイページ` を追加
- [x] `npm -C src/misogi run build` でビルド確認

## Store Basic Info: Add URL Field Across Key Views (2026-03-09)

- [x] `営業カルテ（SalesStoreKarte）` の基本情報に `URL` 入力項目を追加
- [x] 営業カルテの店舗初期化（`/stores/:id` 取得時）で `url/site_url/website` を取り込み
- [x] `事務カルテパネル（OfficeClientKartePanel）` の基本情報に `URL` 表示を追加
- [x] `清掃予定詳細（MyYoteiListPage）` の基本情報に `URL` 表示を追加（一覧/単体の両方）
- [x] `tenpo` 参照時に `url/site_url/website/google_map_url/map_url` を優先解決して表示
- [x] `npm -C src/misogi run build` でビルド確認

## Store URL: Avoid Blank Display With Fallback (2026-03-09)

- [x] `営業カルテ（SalesStoreKarte）` の基本情報URLが未設定でも仮URLを補完表示
- [x] `事務カルテ（OfficeClientKartePanel）` の基本情報URLが未設定でも仮URLを補完表示
- [x] `清掃予定詳細（MyYoteiListPage）` の基本情報URLが未設定でも仮URLを補完表示
- [x] `https://` なしURLは表示時に自動補正（`https://` 付与）
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Tenpo Karte: Basic Info URL Fallback (2026-03-09)

- [x] `お客様情報基本情報（AdminTenpoKarte）` のURL解決元を拡張（`url/site_url/website/google_map_url/map_url`）
- [x] URL未設定時に `https://store.misesapo.local/{tenpo_id}` を自動補完表示
- [x] `https://` なしURLは表示時に自動補正（`https://` 付与）
- [x] `npm -C src/misogi run build` でビルド確認

## Customer URL: Switch To MISOGI MyPage Link (2026-03-09)

- [x] `お客様情報基本情報（AdminTenpoKarte）` のURLを外部サイトではなく `MISOGIお客様マイページURL` 生成へ変更
- [x] 生成URL形式を `https://misesapo.co.jp/misogi/#/customer/mypage?tenpo_id={tenpo_id}` に統一（環境変数上書き可）
- [x] `CustomerMyPage` で `tenpo_id` クエリを受け取り対象店舗のみ表示できるよう対応
- [x] `CustomerMyPage` の行URLを `MISOGIお客様マイページURL` 優先へ統一
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Detach System Chrome (2026-03-09)

- [x] `/customer/mypage` で共通ヘッダー（パンくず/戻る/ハンバーガー/共通チャット）を非表示化
- [x] `CustomerMyPage` 内の `Portalへ戻る` 導線を削除
- [x] お客様マイページをシステム外導線前提の単独画面として整理
- [x] `App.jsx` 側にも `/customer/mypage` のヘッダー描画抑止ガードを追加（二重抑止）
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Pink POP Redesign + Detail Sections (2026-03-09)

- [x] `CustomerMyPage` 全体レイアウトを刷新（ピンク基調・POPトーン・カード型UI）
- [x] `tenpo_id` 指定時に `基本情報 / 対応履歴 / ストレージ` の3セクション表示を追加
- [x] `対応履歴` は `tenpo.karte_detail.support_history` を日付降順で表示
- [x] `ストレージ` は `souko(tenpo_id)` の登録ファイルをカード表示（画像サムネイル + 開くリンク）
- [x] `tenpo_id` 未指定時は店舗カード一覧（店舗別お客様ページURL導線）を表示
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: White Background (2026-03-09)

- [x] `CustomerMyPage` のページ背景を白固定へ変更
- [x] `/customer/mypage`（standalone-page）時のアプリ全体背景を白固定へ変更
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Basic Info Labels + Remove Search (2026-03-09)

- [x] 基本情報から `店舗ID` を削除
- [x] 基本情報に `取引先` を追加（`torihikisaki_name/company_name/customer_name` などから解決）
- [x] 基本情報の `屋号` 表示を維持
- [x] 検索UI（検索入力）を削除
- [x] `tenpo_id` 未指定時の一覧は検索なし全件表示に変更（更新ボタンは一覧サマリへ集約）
- [x] 基本情報ラベル `取引先` を `法人` 表記へ変更
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Brand Title Masking (2026-03-09)

- [x] `/customer/mypage` 表示中のみブラウザタイトルを `ミセサポ お客様マイページ` に切り替え
- [x] ページ離脱時に元のタイトルへ復帰
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Customer-only PWA Manifest (2026-03-09)

- [x] お客様向け `customer-manifest.json` を追加（`name/short_name = ミセサポ`）
- [x] `/customer/mypage` 表示中のみ `link[rel="manifest"]` を `customer-manifest.json` へ差し替え
- [x] ページ離脱時に元の `manifest` 参照へ復元
- [x] `/customer/mypage` 表示中のみ `apple-mobile-web-app-title` を `ミセサポ` へ設定（離脱時復元）
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Basic Info Self Edit (2026-03-09)

- [x] お客様マイページ `基本情報` に `編集 / 保存 / キャンセル` を追加
- [x] 編集対象を `法人 / 屋号 / 店舗名 / 住所 / 電話番号 / 担当者 / 営業時間` に設定
- [x] 保存時に `PUT /master/tenpo/{tenpo_id}` で `tenpo` 本体 + `karte_detail.spec` を同時更新
- [x] 保存結果を画面へ即時反映し、保存メッセージを表示
- [x] PC/SP で崩れないよう入力UIスタイルを追加
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Base Background Color FCF9EA (2026-03-09)

- [x] `CustomerMyPage` 背景色を `#FCF9EA` に変更
- [x] `/customer/mypage` の standalone 背景色を `#FCF9EA` に変更
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Color Palette Update (2026-03-09)

- [x] お客様マイページのカラーパレットを指定値へ更新（メイン `#FFA4A4` / サブ `#FFBDBD` / アクセント `#BADFDB`）
- [x] ボタン/バッジ/入力フォーカス/履歴ステータス/ストレージサムネ背景など主要UI配色を新パレットに統一
- [x] お客様向け PWA `customer-manifest.json` の `theme_color` をメインカラー `#FFA4A4` へ変更
- [x] お客様マイページの基準文字色を `#493628` へ変更
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Basic Info Edit Text Visibility Fix (2026-03-09)

- [x] 基本情報編集エリアの `編集/保存/キャンセル` ボタン文字色を固定化し、テーマ差分で文字が見えなくならないよう修正
- [x] 基本情報編集入力の文字色を明示指定（`-webkit-text-fill-color` 含む）して可読性を安定化
- [x] プレースホルダ文字色を調整し、入力欄で視認できるよう修正
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Main Content Drop Shadow Removal (2026-03-09)

- [x] お客様マイページのメインコンテンツ（`.customer-mypage`）のドロップシャドウを削除
- [x] フォーカスリング等の操作性に必要な視認効果は維持
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Houkoku Result-only Section (2026-03-09)

- [x] お客様マイページに `作業完了レポート（結果）` セクションを追加
- [x] `admin/work-reports` から対象店舗の報告を抽出し、顧客向けに `結果` テキストのみ表示（本文詳細は非表示）
- [x] 表示対象を完了系ステータス（`submitted/triaged/approved/archived`）に限定
- [x] 取得失敗時は画面を壊さず、結果セクション内でメッセージ表示
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Notice Feed + Houkoku Tenpo Link (2026-03-09)

- [x] 清掃報告（`CleaningDayReportPage`）の店舗保存データに `tenpo_id` を永続化（`description.store.tenpo_id`）
- [x] 店舗選択時に `StoreSearchField` の `store_key` を報告データへ連携（`tenpo_id` として保持）
- [x] 報告保存時、`tenpo_id` がある場合は `target_id` にも反映して照合精度を向上
- [x] お客様マイページの作業完了レポート抽出で `tenpo_id` 一致を優先し、店舗名一致をフォールバック化
- [x] お客様マイページ下部に `お知らせ` セクションを追加
- [x] `yotei` 作成イベント（`created_at`）を通知表示
- [x] `yotei` 実行中イベント（`working/shinkou` 系ステータス）を通知表示
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Move Notice Section To Page Bottom (2026-03-09)

- [x] `お知らせ` を詳細グリッド内から分離し、`お客様マイページ` の最下部セクションへ移動
- [x] 下部配置用の余白スタイル（`.customer-notice-section`）を追加
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Detail Title Uses Yagou + Tenpo (2026-03-09)

- [x] お客様マイページ詳細タイトルを `屋号 / 店舗名` のセット表示へ統一
- [x] どちらか未設定時はタイトル側のみ `屋号未設定` / `店舗名未設定` を補完表示
- [x] 基本情報セクションの個別表示は既存のまま維持

## Admin Theme: Customer Palette Sync + Light-only Mode (2026-03-10)

- [x] 管理系統（`data-job="admin"`）の基調カラーをお客様マイページと同一パレットへ統一（`#FCF9EA / #FFA4A4 / #FFBDBD / #BADFDB / #493628`）
- [x] 管理系統の見出し文字色を `#3B3B1A` へ統一
- [x] 管理系統のコンテンツ背景（カード/パネル/ワークスペース）を `#FCF9EA` 基調へ統一
- [x] 共通ヘッダー（`breadcrumbs`）背景色を `#FFDBDB` に統一
- [x] 管理ルートのボディ外枠背景（`app-fullscreen`）を `#FCF9EA` へ固定
- [x] 管理ルート表示中は `body/html` 背景色も `#FCF9EA` へ固定（root外余白も同色化）
- [x] 管理エントランス（通常/セピア）背景を同一トーンに統一し、セピア専用のテクスチャ演出を無効化
- [x] 管理サイドバー / 通知レール / 通知パネル / 管理ワークスペースの配色を同一トーンへ統一
- [x] 管理パンくずヘッダー（`.breadcrumbs-admin`）の配色を同一トーンへ統一
- [x] 管理系統の表示モードをライト固定化（管理サイドバーからモード切替UIを撤去し、`ライトモード（固定）` 表示へ変更）
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Master: Table Row Key Stabilization (2026-03-10)

- [x] `AdminMasterBase` のテーブル行 `key` を `Math.random()` 依存から安定キーへ変更（`rid` 優先 / 未定義時は `rowIndex` フォールバック）
- [x] セル `key` も `rid` 依存から行安定キーに統一し、ID欠落行での再描画ズレを抑制
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Master: Tenpo Yagou Empty Display (2026-03-10)

- [x] 店舗マスタの `屋号` 列で、未割り当て値を `-` 補完せず空白表示する仕様を追加
- [x] 共通テーブルに `emptyAsBlank` を追加し、指定フィールドのみ空欄表示を選択可能化
- [x] `AdminMasterTenpoPage` の `yagou_id` フィールドへ `emptyAsBlank` を適用
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Master: Customer Master Integration Entry (2026-03-10)

- [x] `AdminTorihikisakiTourokuPage` を `mode` 対応し、`顧客マスタ` 用の見出し/説明へ切替可能化
- [x] `AdminCustomerMasterPage` を追加し、統合導線 `/admin/master/customer` を新設
- [x] 管理エントランスの `マスタ情報` を `顧客マスタ` 1本導線へ集約（取引先/屋号/店舗の個別導線を統合）
- [x] 事務エントランスの `情報` 内 `マスタ(顧客)` 導線も `顧客マスタ` へ統合
- [x] パンくず表示に `/admin/master/customer` => `顧客マスタ` を追加
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Master: Partial Hierarchy Support (2026-03-10)

- [x] 顧客マスタの `屋号追加` で `取引先未選択` を許容（`torihikisaki_id` は任意送信）
- [x] 顧客マスタの `店舗追加` で `取引先のみ` / `屋号のみ` / `両方なし` を許容（`torihikisaki_id`/`yagou_id` を任意送信）
- [x] `屋号（既存）` 選択を取引先未選択でも有効化し、未選択時は全屋号をロード
- [x] 既存検索インデックスを拡張し、`取引先なし屋号` / `屋号なし店舗` / `取引先なし店舗` も候補表示
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Master: Customer Master Unified Edit Page (2026-03-10)

- [x] `/admin/master/customer` を「取引先 / 屋号 / 店舗の一括編集・保存」専用ページとして再実装
- [x] 3マスタを同時取得し、`tenpo` 中心 + `yagou単体` + `torihikisaki単体` を統合表示
- [x] 1行編集で `torihikisaki / yagou / tenpo` を横断更新できるモーダル保存を実装
- [x] `torihikisaki_id`・`yagou_id` の再紐付けを店舗保存時に同時更新可能化
- [x] 旧 `/admin/torihikisaki-touroku` は「顧客登録（新規作成）」導線として維持
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Master: Hide Address Display In Customer Master (2026-03-10)

- [x] 顧客マスタ一覧テーブルの `住所` 列を非表示化（列ヘッダー/値表示を削除）
- [x] 空状態行 `colSpan` を列数に合わせて調整
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Torihikisaki Label Revert (2026-03-10)

- [x] 基本情報の `torihikisaki_name` ラベルを `法人` から `取引先` へ戻す
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Torihikisaki Label As Houjin (2026-03-10)

- [x] お客様マイページの基本情報で `torihikisaki_name` ラベルを `法人` 表記へ戻す
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Master: Customer Master Kokyaku Layer + Clean Filters (2026-03-10)

- [x] 顧客マスタ一覧に `顧客(kokyaku)` 列を追加（`kokyaku_id/kokyaku_name` を表示）
- [x] `kokyaku` 検索を統合検索に追加（顧客/取引先/屋号/店舗を横断検索）
- [x] 画面フィルタを追加（`全件` / `未紐付け` / `重複候補`）
- [x] 一覧に状態列を追加し、`未紐付けあり` / `重複候補` / `正常` を可視化
- [x] 編集モーダルに `顧客ID(kokyaku)` / `顧客名(kokyaku)` を追加
- [x] `torihikisaki` 保存時に `kokyaku_id` / `kokyaku_name` 更新を反映
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Master: Customer Master Sort + Center Search (2026-03-10)

- [x] 顧客マスタ一覧ヘッダーに列別ソートを追加（`顧客/取引先/屋号/店舗/電話/URL/状態` の昇順・降順切替）
- [x] ID系ソート（`TORI/YAGOU/TENPO/KOKYAKU`）を若番優先で比較し、番号が小さい順に上から表示
- [x] 既定ソートを `取引先ID` 昇順に変更（若番が上）
- [x] 表示件数をソート後リスト基準で表示するよう調整
- [x] 統合検索を大型化（入力高・フォント拡大）し、ツールバー中央へ配置
- [x] モバイル幅では検索を全幅・左寄せへフォールバック
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Master: Kokyaku ID Priority Display (2026-03-10)

- [x] 顧客IDの既定表示を `kokyaku_id` 優先に統一
- [x] `kokyaku_id` 未設定時の表示フォールバックを `TORI#...` 直接表示ではなく `KOKYAKU#...` 形式へ正規化
- [x] 既定ソートを `kokyaku_id` 昇順（若番優先）に変更
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Master: Customer URL Column Compaction (2026-03-10)

- [x] 顧客マスタの `URL` 列を固定幅化（140px）して横幅を圧縮
- [x] URL表示をホスト名ベースへ短縮し、フルURLはツールチップで保持
- [x] 顧客マスタテーブルを固定レイアウト化し、列幅圧縮時の横スクロールを抑制
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Master: Customer ID Tag Colors (2026-03-10)

- [x] 顧客マスタ一覧のIDをタグ表示へ変更（`kokyaku / torihikisaki / yagou / tenpo`）
- [x] IDタグを種別ごとに色分け（ダーク/ライト両テーマ対応）
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Master: Customer Table Emergency Layout Stabilization (2026-03-10)

- [x] 顧客マスタで崩れ要因になっていた固定テーブルレイアウト強制（`table-layout: fixed`）を解除
- [x] 顧客マスタで全セル折返し強制（`white-space: normal`）を解除し、既存の安定表示へ復帰
- [x] `URL` 列の圧縮（固定幅 + 省略表示）は維持
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Master: Customer Bulk Delete + URL Removal (2026-03-10)

- [x] 顧客マスタに行選択チェックボックス（ヘッダー一括選択 + 行ごとの選択）を追加
- [x] ツールバーの一括アクションを `取り消し` から `削除` へ変更（確認ダイアログ付き）
- [x] 選択行は `DELETE` API で物理削除するフローへ変更（成功/失敗メッセージも削除文言へ統一）
- [x] 顧客マスタ一覧と編集モーダルから `URL` 項目を削除
- [x] 顧客マスタの `URL` ソート分岐を削除し、表示列定義と整合
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Master: Structured Edit Default + Manual Override (2026-03-10)

- [x] 顧客マスタ編集モーダルを「構造化入力デフォルト」に変更（ID/紐付けは選択式）
- [x] `取引先ID` / `屋号ID` を手入力欄から既存候補の `select` へ変更
- [x] 選択時に関連する名称（必要に応じて `kokyaku` 情報）を自動反映する補助ロジックを追加
- [x] `顧客ID` / `店舗ID` は通常モードで直接編集不可（誤入力防止）
- [x] 必要時のみ `自由入力を許可（通常はOFF推奨）` をONにして手入力可能なハイブリッド運用へ対応
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Cleaning Houkoku: Selection Card Backdrop Tone Adjustment (2026-03-10)

- [x] `清掃業務報告 必要選択` カード本体背景は白基調を維持
- [x] カード背面（ページ背景）を指定トーン `#FCF9EA` へ調整
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Theme: Cream Backdrop Expansion (2026-03-10)

- [x] 管理マスタ系ページ（`.admin-master-page`）のライト背景を `#FCF9EA` に統一
- [x] 例外で白背景だった `kadai` 画面も `#FCF9EA` へ統一
- [x] 管理報告ページ（`.report-page[data-job=\"admin\"]`）のライト背景を `#FCF9EA` へ統一
- [x] 管理エントランス（`.job-entrance-page[data-job=\"admin\"]`）のライト背景を `#FCF9EA` へ統一
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Theme: Yotei/Ugoki/Yakusoku Cream Backdrop Sync (2026-03-10)

- [x] `yotei` / `yakusoku` 共通タイムライン画面（`.admin-yotei-timeline-page`）のライト背景を `#FCF9EA` へ統一
- [x] `capacity-safe / warn / danger` の背景グラデーション下地も `#FCF9EA` へ統一
- [x] `ugoki` ダッシュボード（`.admin-ugoki-dashboard-page`）のライト背景を `#FCF9EA` へ統一
- [x] カード/パネル背景は白を維持（可読性優先）
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yotei: Gradient Removal (2026-03-10)

- [x] `admin-yotei-timeline` の `capacity-safe / warn / danger` 背景グラデーションを削除し、単色背景へ統一
- [x] `yotei-head h1` のグラデーション文字を廃止し、単色文字表示へ統一
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Request Document: Cream Background Sync (2026-03-10)

- [x] `依頼書作成` ページ（`.admin-request-doc-page`）の背景をクリームトーン `#FCF9EA` へ統一
- [x] ライトモード時の背景色も `#FCF9EA` へ統一
- [x] 入力/プレビューのパネル背景（白）は維持
- [x] `npm -C src/misogi run build` でビルド確認

## Shared Header: Blue Tone Update (2026-03-12)

- [x] 共通 `Breadcrumbs` ヘッダー背景を青系トーンへ変更（`#dbeafe`）
- [x] 共通リンク/現在地ラベル/境界線色を青系へ調整
- [x] `breadcrumbs-admin` 上書き配色も青系へ統一（ボタンON状態含む）
- [x] `npm -C src/misogi run build` でビルド確認

## Global Palette: 4-Color Theme Sync (2026-03-12)

- [x] ライトテーマ共通トークンを4色パレットへ統一（`#FCF9EA / #BADFDB / #FFA4A4 / #FFBDBD`）
- [x] 共通UI（リンク/入力/ボタン/カード）のライト配色を4色パレットへ調整
- [x] 共通ヘッダー（Breadcrumbs）配色を4色パレットへ再統一
- [x] 取引先名簿ヘッダー配色を4色パレットへ調整
- [x] 管理 `yasumi` / `schedule timeline` のライト配色を4色パレットへ調整
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Per-Store URL Scope Fix (2026-03-12)

- [x] `customer/mypage` URLが既存値でも `tenpo_id` を必ず付与・上書きする共通補助関数を追加
- [x] `CustomerMyPage` の店舗一覧リンク生成で `tenpo_id` 付きURLを強制し、全店舗同一ページ化を防止
- [x] `AdminTenpoKarte` の基本情報URL解決でも `tenpo_id` を強制付与し、表示URLの一意性を保証
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Scoped Detail Strict Match (2026-03-12)

- [x] `tenpo_id` 指定付き一覧取得の結果を先頭採用せず、`tenpo_id` 完全一致のみ採用するよう修正
- [x] API側フィルタが効かない場合でも他店舗データを誤表示しないよう防御
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Basic Info Source Sync To Karte (2026-03-12)

- [x] お客様マイページ基本情報を `tenpo` 直値だけでなく `karte_detail.spec` 優先で参照するよう修正
- [x] `yagou.shared_basic_profile` / `torihikisaki.shared_basic_profile` を取得し、カルテ同様の階層マージ参照へ統一
- [x] 基本情報フォーム初期値と編集キャンセル復帰時の参照元を同一ロジックへ統一
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Support History Calendar (2026-03-12)

- [x] お客様マイページの `対応履歴` セクションに月カレンダーを追加
- [x] 日付セル選択で該当日の履歴だけを絞り込み表示（再タップ/全日表示で解除）
- [x] 履歴件数バッジを日付セルへ表示し、月移動（前月/次月）操作を追加
- [x] カレンダーUIの専用スタイルを追加し、既存配色トーンへ統一
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning: Manual Page React Rebuild (2026-03-12)

- [x] 旧 `cleaning-manual.html` の構成をもとに、React版 `清掃マニュアル` ページを新規実装
- [x] 既存データ `cleaning-manual.json / cleaning-manual-en.json` を利用したカテゴリ切替・言語切替を実装
- [x] NG/OK 比較・リスク・Q&A・画像表示をカードUIで再構成（モバイル表示対応）
- [x] ルーティングを追加（`/jobs/cleaning/manual`）し、`/cleaning-manual` からの遷移もReactページへ統一
- [x] 清掃エントランスの `ツール` 配下に `清掃マニュアル` 導線を追加
- [x] 清掃ワーカー共通HOTバーの `tools` アクティブ判定に `manual` ルートを追加
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Customer Master: New Create ID Auto-Assignment (2026-03-12)

- [x] 顧客マスタ新規追加の `顧客ID(kokyaku)` 手入力欄を廃止
- [x] 新規追加時の `kokyaku_id` は一覧データから算出した次連番を自動割り当てへ変更
- [x] 新規追加カードに `顧客/取引先/屋号/店舗` の自動採番予定IDを表示
- [x] 自動採番表示用のUIスタイルを追加（ライト/ダーク両対応）
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Customer Master: List Header Sticky to Viewport Top (2026-03-12)

- [x] 顧客マスタ一覧の内部スクロールを廃止し、ページスクロール基準へ変更
- [x] リストヘッダー（`thead`）が画面上部へ固定される挙動へ調整
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Customer Master: Sticky Search + Internal List Scroll (2026-03-12)

- [x] 顧客マスタの検索ツールバーを画面上部で `sticky` 固定へ変更
- [x] 検索バー到達後は一覧テーブルを内部スクロールするように調整（`table-wrap` 高さ制御）
- [x] モバイル時のツールバー高さを考慮した内部スクロール高さへ調整
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Side Arrow Slide Navigation (2026-03-12)

- [x] お客様マイページ詳細表示を3ペイン化（左: 基本情報 / 中央: レポート+対応履歴 / 右: ストレージ）
- [x] 左右余白に `← / →` ナビボタンを追加し、クリックでスライド切替を実装
- [x] デフォルト表示を中央ペイン（レポート + 対応履歴）に設定
- [x] モバイル含むレスポンシブでスライダーレイアウトを調整
- [x] メインコンテンツを全幅化し、矢印ボタンをコンテンツ外の独立固定コントロールへ変更
- [x] 矢印ボタンとの重なり防止のため、詳細コンテンツに左右クリアランスを追加
- [x] 左右矢印を「1ステップ移動コントローラー」へ変更（左:1つ左 / 右:1つ右）
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Basic Info Service Subscription Tags (2026-03-12)

- [x] 基本情報カード下に `現在お申し込み中のサービス` セクションを追加
- [x] `プラン` をタグ表示（`karte_detail.plan` / 店舗側プラン項目をフォールバック参照）
- [x] `サービス` をタグ表示（`karte_detail.service_plan` を主軸に既存サービス項目をフォールバック参照）
- [x] サービス/プラン表示をお客様マイページ配色に合わせたタグUIへ調整
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Arrow Hint + Content Clearance Tuning (2026-03-12)

- [x] 左右ナビ矢印の上にヒントラベルを追加（次に移動するペイン名を表示）
- [x] 矢印ヒントとコンテンツの重なりを避けるため、左右クリアランスを拡張
- [x] SP/タブレット向けにヒント文字サイズとクリアランスをレスポンシブ調整
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Body Horizontal Padding Tuning (2026-03-12)

- [x] お客様マイページのボディ左右パディングを拡張（PC: `24px`）
- [x] SP時の左右パディングも拡張（`16px`）して端詰まり感を軽減
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Control Button Inset Tuning (2026-03-12)

- [x] 左右コントロールボタンの配置を内側へ調整（`left/right` を固定値 `8px` から可変insetへ変更）
- [x] `customer-detail-shell` に `--customer-nav-inset` を追加し、PC/タブレット/SPで最適値を切り替え
- [x] 矢印ボタンの見た目位置をコンテンツ端に合わせやすいよう調整
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Control Button Inset = Body Padding (2026-03-12)

- [x] コントロールボタンの左右insetをボディ左右パディングと同値へ統一（PC/Tablet: `24px`、SP: `16px`）
- [x] `customer-detail-shell` の `--customer-nav-inset` をブレークポイントごとに再調整
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Footer Copyright (2026-03-12)

- [x] お客様マイページ最下部にコピーライトフッターを追加
- [x] フッター配色をピンク背景＋白文字へ統一
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Fixed Full-Width Footer Overlay (2026-03-12)

- [x] お客様マイページのコピーライトフッターを `position: fixed` で全幅表示に変更
- [x] フッターを最前面表示（高 `z-index`）へ調整
- [x] フッター固定時にコンテンツが隠れないよう、ページ下部余白をフッター高さ分拡張
- [x] `env(safe-area-inset-bottom)` を加味してSP実機の下端表示を調整
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Footer Height Compact (2026-03-12)

- [x] 固定フッター高さを約半分へ縮小（`--customer-fixed-footer-height: 24px`）
- [x] フッター内余白・コピーライト文字サイズを縮小して高さに合わせて最適化
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Hide TENPO# ID In Cards (2026-03-12)

- [x] お客様マイページの店舗カードで `TENPO#...` IDチップを非表示化
- [x] `TENPO#` 以外のID表示は従来通り維持
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Hide TENPO# In Hero Subtitle (2026-03-12)

- [x] お客様マイページヘッダー説明文から `（TENPO#...）` のID表記を削除
- [x] ヘッダー説明文は `基本情報 / 対応履歴 / ストレージを確認できます` に統一
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Hover Visibility Enhancement (2026-03-12)

- [x] PCマウス環境でカード/パネル/行/カレンダー要素に統一ホバー強調（境界・影）を追加
- [x] ボタン/リンク/ナビにホバー時の浮き表現を追加し、現在のポインタ位置を視認しやすく調整
- [x] フォーカス可視化（`focus-visible`）を追加して操作対象を明確化
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Control Button Hover Motion Removal (2026-03-12)

- [x] 左右コントロールボタンのホバー時移動（translate）を削除
- [x] コントロールボタンは色変化のみでホバー反応するよう調整
- [x] 共通ホバー浮き演出の対象からコントロールボタンを除外
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Support History Generalization + Next Schedule Highlight (2026-03-12)

- [x] `対応履歴` セクションを `対応履歴・次回予定` へ拡張
- [x] `yotei` から対象店舗の次回予定（未来・未クローズ）を抽出して表示
- [x] 次回予定の日付を赤文字で強調表示し、判別しやすく調整
- [x] 次回予定の店舗名・時間帯・担当者を履歴セクション内で確認できるよう追加
- [x] `fmtDateTimeJst` を `Date` 入力にも対応させ、表示の安定性を改善
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Download -> Auto Save To Souko (2026-03-12)

- [x] 作業完了レポート（結果）に `PDFダウンロード` ボタンを追加
- [x] ダウンロード時にレポート内容からA4 PDFを生成（店舗/作業日/作成日時/結果を含む）
- [x] ダウンロード実行と同時に同一PDFを `souko` へ自動保存する処理を追加
- [x] `souko` 保存フローを実装（保存先取得 or 作成 -> presign -> PUT -> files更新）
- [x] 保存成功/失敗のフィードバック表示を追加し、成功時にストレージ一覧を再取得
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Notice Area Slim + Quick Buttons (2026-03-12)

- [x] ヘッダー下のお知らせ領域を2カラム化し、お知らせ幅をスリム化
- [x] 右カラムにクイックメニューを追加（`サービスカタログ / 基本情報 / レポート / ストレージ / お知らせ更新`）
- [x] `サービスカタログ` ボタン導線用PDFを `public/customer/catalog/misesapo_catalog_0303.pdf` に配置
- [x] SP幅ではお知らせ+クイックメニューを1カラムに自動切替
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Remove Quick Menu Panel Style (2026-03-12)

- [x] `クイックメニュー` 独立パネルを撤去し、`お知らせ`単一パネル構成へ変更
- [x] 操作ボタン群は `お知らせ` ヘッダー右に統合（`サービスカタログ` ボタンは維持）
- [x] お知らせパネル幅を抑制（`max-width`）し、過剰な横幅使用を抑えるレイアウトへ調整
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Notice Header Buttons Narrowed To 2 (2026-03-12)

- [x] お知らせヘッダーの操作ボタンを `サービスカタログ` / `お問い合わせ` の2つに整理
- [x] `基本情報/レポート/ストレージ/更新` ボタンを撤去
- [x] `お問い合わせ` 導線を `VITE_CUSTOMER_INQUIRY_URL` 優先、未設定時は `https://misesapo.co.jp/contact/` にフォールバック
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Move Notice Buttons Outside Panel (2026-03-12)

- [x] `サービスカタログ / お問い合わせ` ボタンを `お知らせ` パネル内から外へ移動
- [x] ボタンを `お知らせ` セクション上部ツールバーとして配置
- [x] `お知らせ` パネルヘッダーは件数表示のみへ整理
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Place Catalog/Inquiry On Right Side Of Notice (2026-03-12)

- [x] `お知らせ` と `サービスカタログ/お問い合わせ` を同一行に再配置（左: お知らせ、右: 2ボタン）
- [x] 2ボタンは `お知らせ` パネル外の右サイドアクションとして実装
- [x] SP表示は1カラムへ自動切替し、2ボタンは横並び表示
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Right Buttons 2-Row + Match Notice Height (2026-03-12)

- [x] `サービスカタログ / お問い合わせ` を右サイドで上下2段固定に調整
- [x] `お知らせ` 行を `stretch` 配置にして、右2ボタンの高さを左お知らせパネル高に追従
- [x] ボタンを行内中央配置にしつつ、2行グリッド全面フィットへ変更
- [x] SP時も右2ボタンは2段表示を維持
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Tools: Cleaning Manual Link + Cleaner Visibility Confirmed (2026-03-12)

- [x] 管理サイドバー `運用ツール` に `清掃マニュアル` 導線を追加（`/jobs/cleaning/manual`）
- [x] 清掃員側 `ツール > 清掃マニュアル` の既存導線が維持されていることを確認
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yakusoku: ICS Import Preview + Bulk Create (2026-03-12)

- [x] `yakusoku` 画面ヘッダーに `ICS取り込み` ボタンを追加
- [x] `.ics` ファイル読込 / ICSテキスト貼り付けの両対応モーダルを実装
- [x] VEVENTを解析して、店舗一致・清掃判定・重複判定（`memo` 内 `ics_source=`）付きプレビューを追加
- [x] `取り込み実行` で `yakusoku` を一括作成（種別/サービス/月枠/定期のtask_matrixを自動補完）
- [x] 取り込み結果（作成件数/失敗件数/エラー詳細）を画面表示
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yakusoku: ICS Precision Matching + Pre-Import Manual Fix (2026-03-12)

- [x] `SUMMARY（屋号/店舗/プラン）` 優先の重み付けマッチへ調整（店舗/サービス抽出精度を改善）
- [x] 取り込みプレビュー行ごとに `対象ON/OFF・種別・開始日・店舗・サービス・月枠` を手修正可能化
- [x] `全件ON / 全件OFF` を追加し、一括選別を高速化
- [x] 取り込み判定を行単位で再評価（除外・清掃判定・重複・店舗・サービス・日付）
- [x] 手修正した値をそのまま `yakusoku` 一括作成に反映
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yakusoku: ICS Service Content + Tenpo/Yagou Match Boost (2026-03-12)

- [x] `LOCATION`/`SUMMARY`/`DESCRIPTION` をイベント文脈として扱う店舗一致ロジックへ強化（屋号+店舗の同時一致を加点）
- [x] `SUMMARY` の区切りパターン（`/` と全角スペース連結）を拡張し、屋号/店舗/プランの推定精度を改善
- [x] ICS本文（`SUMMARY` + `DESCRIPTION`）から `サービス内容` を抽出する処理を追加
- [x] ICSプレビュー行に `サービス内容` 編集列を追加（行ごとに手修正可能）
- [x] `yakusoku` 作成時に `service_content` / `service_contents` へ抽出内容を保存
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yakusoku: ICS Duplicate Collapse To Single Case (2026-03-12)

- [x] ICSプレビューを `UID` 優先キーで重複統合し、同一予定系列を1件表示へ変更
- [x] `RECURRENCE-ID` 付き複製は、親イベント（`RECURRENCE-ID` なし）優先で残すよう調整
- [x] 既存取り込み判定を `ics_source` の完全一致に加えて `UID` 単位でも重複判定するよう強化
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yakusoku: ICS Master Service Strict + Non-Cleaning Omit (2026-03-12)

- [x] ICS取り込みで `service_id` がサービスマスタに存在しない行は作成不可に変更（`サービス未一致(マスタ外)`）
- [x] `service_name` はサービスマスタ正式名称を強制使用（取り込み時の名称揺れを排除）
- [x] `清掃系キーワードのみ取り込む` ON時は、非清掃予定をプレビューから非表示化
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yakusoku: Same Yagou/Tenpo Unified Into One Yakusoku (2026-03-12)

- [x] ICS取り込み実行時、`tenpo_id`（同一屋号/店舗）単位で行を統合して1件の `yakusoku` を作成
- [x] 統合時に `service_ids/service_names` を重複排除で束ね、先頭を `service_id/service_name` に反映
- [x] 統合時に `task_matrix` をバケット単位でマージし、`start_date` は最古日を採用
- [x] 統合時に `service_content/service_contents` を集約して保存
- [x] `memo` に `ics_uid_keys` を保持し、再取り込み時のUID重複判定を強化
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yakusoku: One-Store-One-Yakusoku Upsert Merge (2026-03-12)

- [x] ICS取り込みを `同一店舗=同一yakusoku` の upsert 方式へ変更（既存があれば `PUT` 更新、なければ `POST` 作成）
- [x] 既存yakusoku更新時に `service_ids/service_names` をマスタ準拠でマージ統合
- [x] 既存yakusoku更新時に `task_matrix`・`monthly_quota`・`start_date` を統合ルールで更新（開始日は最古）
- [x] `service_content/service_contents` を既存値+ICS抽出値で累積統合
- [x] 取り込み結果サマリーに `更新件数` を追加表示
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yakusoku: Merge Services Even From Non-Creatable ICS Rows (2026-03-12)

- [x] ICS取り込み集計母集団を `canCreate` 限定から拡張し、対象ONかつ店舗/サービス一致の行を統合候補化
- [x] 重複扱い行でも、既存yakusoku更新時はサービス統合・サービス内容統合に反映
- [x] 新規作成は従来どおり `hasCreatable` 条件を維持（開始日等の最低条件を満たす場合のみ作成）
- [x] `site key` を `tenpo_id` 優先 + `屋号名/店舗名` フォールバックで統合
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yakusoku: ICS Tenpo Matching Fuzzy Boost (2026-03-12)

- [x] `LOCATION` 先頭（店名部）と `SUMMARY` 先頭を抽出し、屋号+店舗の近似一致（表記ゆれ吸収）を加点
- [x] 近似一致が競合した場合は誤一致回避のため未一致扱いにする安全弁を追加
- [x] 店舗一致率向上を狙いつつ、誤マッチ増加を抑えるスコアガードを実装
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yakusoku: ICS Preview Clarification For Store-Level Merge (2026-03-12)

- [x] ICSモーダル統計に `統合後店舗` 件数を追加（取り込み後の実際のyakusoku件数目安を可視化）
- [x] 「プレビューはイベント単位、取り込み時は同一屋号/店舗を統合」の注記を追加
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yakusoku: ICS Import Runtime Fixes (2026-03-12)

- [x] `TASK_BUCKETS is not defined` 例外を修正（`PLAN_BUCKETS` 参照へ統一）
- [x] 取り込みボタンの有効条件を `作成可能件数` から `upsert可能店舗件数` へ変更
- [x] `取り込み実行` ボタン表示件数を新ロジック（店舗単位upsert件数）へ同期
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yakusoku: ICS Memo(Service Content) Ingestion Boost (2026-03-12)

- [x] ICSデコードで `\\N` 改行も解釈するよう修正（メモ列の段落を保持）
- [x] `service_content` 抽出で `DESCRIPTION + SUMMARY + LOCATION` を統合利用
- [x] メモ抽出時に全角/連続空白・見出し記号（`【】`）を分割トークン化へ反映
- [x] メモ抽出タグから頻出接頭語（`毎月/隔月/都度` 等）を除去し、作業語を正規化
- [x] ICSプレビュー表に `メモ抜粋` 列を追加し、吸い込み確認を可視化
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yakusoku: ICS Execute Button Activation + Diagnostics (2026-03-12)

- [x] `取り込み実行` ボタン無効化条件を緩和（プレビュー行があれば押下可能）
- [x] 実行不可理由は押下時アラートで案内するフローへ統一
- [x] ICS統計表示に `統合対象行` / `実行対象店舗` を追加し、押せない原因を可視化
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yakusoku: ICS 店舗未一致を解約候補として切り分け (2026-03-12)

- [x] ICS統計に `店舗未一致` 件数を表示
- [x] 取り込みモーダルに `未一致を除外` ボタンを追加（対象ONの未一致行を一括OFF）
- [x] 未一致理由を `候補名 + 解約・名称変更候補` 付きで表示するよう改善
- [x] 注記に「未一致を除外で切り分け可能」を追加
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yakusoku: ICSサービス内容を既存yakusokuへ同期 (2026-03-12)

- [x] ICSプレビュー（対象ON + 店舗一致）を店舗単位に集約し、サービス内容同期候補を算出
- [x] `既存へ内容同期` ボタンを追加（新規作成せず、既存yakusokuの `service_content/service_contents` のみ更新）
- [x] 同期時は既存値とICS抽出値を重複排除でマージし、変更なし案件はスキップ
- [x] 同期結果サマリー（対象/更新/変更なし/失敗）をモーダルに表示
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yakusoku: 屋号/店舗名 一括補完 (2026-03-12)

- [x] `tenpo_id` を基準に `yakusoku` の `tenpo_name/yagou_id/yagou_name/torihikisaki_id/torihikisaki_name` を補完する一括処理を追加
- [x] ヘッダーに `屋号・店舗名補完` ボタンを追加し、補完対象件数を表示
- [x] 補完実行後に結果サマリー（対象/更新/失敗）を表示
- [x] 失敗時は `yakusoku_id` 単位のエラー行を表示
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yakusoku: 定期清掃の安定満単位金額を一括割当 (2026-03-12)

- [x] ICSプレビュー行に `金額候補` 列を追加（SUMMARY/DESCRIPTION/LOCATION から `¥/円` を抽出）
- [x] 定期行のみを対象に、`満単位（1000円単位）` 金額の安定候補を店舗単位で集計
- [x] `定期金額割当` ボタンを追加し、安定候補のみ `yakusoku.price` へ一括反映
- [x] 価格割当結果サマリー（対象/更新/変更なし/失敗）を表示
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Notice Label Renamed To Misesapo Message (2026-03-13)

- [x] お客様マイページの `お知らせ` 見出しを `ミセサポからのメッセージ` へ変更
- [x] 読み込み中/空表示文言を `ミセサポからのメッセージ` 表記へ統一
- [x] サイドアクションのARIAラベルを `ミセサポメッセージ操作` へ変更
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Billing/Receipt List + PDF Preview (2026-03-13)

- [x] お客様マイページ右側アクションに `請求書` / `領収書` ボタンを追加（ファイル未登録時は無効化）
- [x] `souko` 登録ファイルを `doc_category / kubun / ファイル名` から請求・領収へ自動分類するロジックを追加
- [x] ボタン押下で「期間付きリスト + PDFプレビュー」モーダルを表示し、リスト選択で対象PDFを閲覧可能化
- [x] 期間表示（`YYYY年MM月分`）をファイル名優先で推定し、取得不可時はアップロード月を表示
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Notice Side Buttons 2-Row Horizontal + Chat (2026-03-13)

- [x] お客様マイページのお知らせ右側アクションに `チャット` ボタンを追加
- [x] 右側ボタン群を `2段` の横並びレイアウト（`3列 x 2段`）へ変更
- [x] ボタン高を揃えて、PC/SPとも横方向優先で並ぶUIに調整
- [x] `チャット` 遷移先は `VITE_CUSTOMER_CHAT_URL` 優先、未設定時は `お問い合わせ` 導線へフォールバック
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Add Terms + Policy/Privacy Buttons (2026-03-13)

- [x] お客様マイページ右側アクションに `利用規約` ボタンを追加
- [x] お客様マイページ右側アクションに `ポリシーアンドプライバシー` ボタンを追加
- [x] ボタン群を `4列 x 2段` に調整し、2段固定のまま横方向へ拡張
- [x] `利用規約` は `VITE_CUSTOMER_TERMS_URL` 優先、未設定時は `https://misesapo.co.jp/terms/`
- [x] `ポリシーアンドプライバシー` は `VITE_CUSTOMER_POLICY_PRIVACY_URL` 優先、未設定時は `https://misesapo.co.jp/privacy-policy/`
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Notice Area Width Expansion (2026-03-13)

- [x] お知らせ行コンテナの最大幅を拡張（`1120px` → `min(1380px, 100%)`）
- [x] 右側アクション列の最小幅を最適化（`456px` → `420px`）し、メッセージ本文の横幅を拡大
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Next Yotei Button + Inline Chat Panel (2026-03-13)

- [x] お知らせ右側アクションに `次回予定` ボタンを追加（未設定時は無効化）
- [x] `次回予定` 押下で中央ペイン（対応履歴・次回予定）へフォーカスし、次回予定日の履歴へ絞り込み
- [x] `チャット` を外部リンクから切替ボタンへ変更し、対応履歴エリア位置に独自チャットパネルを表示
- [x] お客様チャットは店舗単位キーで `localStorage` 永続化（再訪時復元）
- [x] 中央パネルに `履歴 / チャット` の表示切替ボタンを追加
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yakusoku: List Ordering Aligned With Customer Master (2026-03-13)

- [x] `yakusoku` 一覧の表示順を固定化（顧客マスタと同様に `kokyaku/torihikisaki/yagou/tenpo` のID若番優先）
- [x] `tenpo_id` 由来メタ（取引先ID・屋号ID）で補完し、旧データでも安定した並び順になるよう調整
- [x] ID同順時は `取引先名 → 屋号名 → 店舗名 → yakusoku_id` の順でフォールバック
- [x] 統合検索あり/なしの両ケースで同一ソートロジックを適用
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yakusoku: Site Name Tags In List (2026-03-13)

- [x] `yakusoku` 一覧の `現場名` をテキスト1行表示からタグ表示へ変更
- [x] `屋号` と `店舗名` を分離して2タグ化し、視認性を向上
- [x] 屋号欠損時は `tenpo` マスタメタ（`tenpo_id/tenpo_name`）から補完してタグ表示
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yakusoku: Add Torihikisaki Tag In Site Name (2026-03-13)

- [x] `yakusoku` 一覧 `現場名` タグに `取引先` を追加（`取引先 / 屋号 / 店舗` の順）
- [x] `取引先名` は `yakusoku` 本体値優先 + `tenpo` メタ補完で表示
- [x] 同名重複タグは除外し、タグ色を種別ごとに固定
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Yakusoku: Tenpo Tag Color Adjust (2026-03-13)

- [x] `yakusoku` 一覧の `店舗` タグ配色を青系に変更
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Chat/Right Tabs/Report Button Relayout (2026-03-13)

- [x] 旧 `作業完了レポート` 表示領域（中央上段）を `チャット` パネルへ置換
- [x] 右ペインに `予定カレンダー / 対応履歴` タブ切替パネルを新設
- [x] `作業完了レポート` はお知らせ右側アクションのボタン化（押下でモーダル表示）
- [x] レポートモーダル内で一覧表示 + `PDFダウンロード` を継続利用可能化
- [x] 右側アクションボタン増加に合わせてボタングリッド行数を自動拡張へ調整
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Default Pane With Chat + Calendar (2026-03-13)

- [x] デフォルト表示（中央ペイン）に `チャット` と `予定カレンダー` を同居配置
- [x] `対応履歴` も中央ペインへ統合し、カレンダー選択連動で同画面表示
- [x] 右ペインの `予定カレンダー/対応履歴` タブ切替を撤去し、右は `ストレージ` 中心へ整理
- [x] `次回予定` ボタン押下時は中央ペインへ遷移し、該当日付をカレンダー選択
- [x] お知らせ右側アクションボタンを `2段` 固定・横並び拡張（PC/SPとも5列ベース）
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Chat + Calendar Two-Column Layout (2026-03-13)

- [x] 中央ペイン上段を `チャット（左） / 予定カレンダー（右）` の2カラム配置へ変更
- [x] 2カラム内のセクション見出し余白を調整（同一基準で横並び）
- [x] 画面幅 `<=1024px` では1カラムへ自動フォールバック
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: History Tab Switch With Calendar (2026-03-13)

- [x] 中央ペイン右上の `予定カレンダー` 枠に `カレンダー / 対応履歴` タブ切替を追加
- [x] 既存の独立 `対応履歴` セクションを撤去し、カレンダー枠内表示へ統合
- [x] `次回予定` ボタン押下時はカレンダータブへ自動切替する挙動を追加
- [x] 対応履歴タブで日付フィルタ中は `選択日` 表示と `全日表示` リセットを提供
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Move Calendar/History Tabs To Bottom Rail (2026-03-13)

- [x] `予定・対応履歴` タブを見出し行からセクション下部へ移動
- [x] 予定/履歴の表示本体を `customer-center-schedule-body` へ分離し、下部タブと構造分離
- [x] 上段2カラムを `stretch` にして、左 `送信` 帯と右タブ帯の高さラインを揃えやすく調整
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Align Chat/Calendar Inner Heights (2026-03-13)

- [x] 上段2カラムの各パネルを縦 `flex` 化し、左右で内部の伸縮ロジックを統一
- [x] チャット側は `ログ` を伸縮領域に変更し、下段 `送信` 帯の位置を安定化
- [x] カレンダー側は `schedule-body` を伸縮領域に変更し、下段タブ帯と高さ整合を改善
- [x] 対応履歴タブ時の履歴リストを可変高さ化（固定 `max-height` を解除）
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Move No-Next-Plan Message To Header Row (2026-03-13)

- [x] `次回予定はまだありません` を本文からヘッダー行（`予定・対応履歴` と同じ高さ）へ移動
- [x] 表示位置をヘッダー右側に固定（カレンダータブ時かつ次回予定なしの場合のみ）
- [x] 本文側の重複メッセージを削除
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Align Chat Log Top With Calendar Top (2026-03-13)

- [x] カレンダータブ内の表示順を調整し、`カレンダー` を `次回予定` より先に表示
- [x] チャット側 `メッセージ表示` とカレンダー側 `カレンダー表示` の上端を同一ラインに統一
- [x] `次回予定` カードの余白を下マージンから上マージンへ切替（新しい表示順に整合）
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Split Chat And Calendar Into Separate Containers (2026-03-13)

- [x] 中央ペインの `チャット` と `予定・対応履歴` を単一パネル内構造から分離し、左右それぞれ独立 `customer-panel` 化
- [x] 分離後の高さ崩れを防ぐため、中央2カラムパネルに `flex` ベースの共通コンテナルールを追加
- [x] `チャット` / `予定・対応履歴` ともに内部を独立スクロール可能な構成へ維持
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Align Title Label Row Height (2026-03-13)

- [x] 中央2カラムのタイトル行（`customer-panel-head-sub`）に `min-height: 34px` を設定し、左右で同一高さに固定
- [x] 右側補助テキスト（`次回予定はまだありません`）を1行固定 + 省略表示に変更し、折返しによる高さズレを防止
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Force Equal Header Row Height (2026-03-13)

- [x] 中央2カラムのヘッダー行を `min-height` から `height: 36px` 固定へ変更
- [x] 左右の `customer-panel-head customer-panel-head-sub` が常に同一高さになるよう調整
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Header Bottom Margin Zero (2026-03-13)

- [x] 中央2カラム内の `customer-panel-head customer-panel-head-sub` に `margin-bottom: 0` を適用
- [x] チャット見出し下の余白を除去し、直下コンテンツへ密着させる表示へ調整
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Remove Bottom Tabs Margin (2026-03-13)

- [x] `customer-center-tabs customer-center-tabs-bottom` の余白を削除（`margin: 0`）
- [x] 下部タブ帯の不要スペースを除去
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Calendar Container Vertical Margin 10px (2026-03-13)

- [x] `customer-history-calendar` のマージンを上下 `10px` に統一（`margin: 10px 0`）
- [x] カレンダーコンテナの上下間隔を固定化
- [x] `npm -C src/misogi run build` でビルド確認

## Customer Chat: Notify Admin Dashboard Activity (2026-03-13)

- [x] お客様マイページのチャット送信時に `admin_chat(room=customer_mypage)` へ同時投稿する処理を追加
- [x] 投稿ペイロードに `tenpo_id/tenpo_name/yagou_name/store_label` を含め、管理側で店舗文脈を判別可能化
- [x] 管理ダッシュボードの `現在のアクティビティ` 取得対象へ `admin_chat(room=customer_mypage)` を追加
- [x] お客様チャットイベントを当日分時系列に統合表示（既存 `kanri_log` / `業務報告` と同列）
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Tenpo Detail: Center Pane Two-Column (2026-03-14)

- [x] `お客様詳細` の初期中央ペインで `チャット / 対応履歴` を2カラム横並びへ変更
- [x] 2カラムの左右カードを同一サイズ（同幅・同高）で表示するよう調整
- [x] チャット側はメッセージ一覧を伸縮領域化し、カード高さに追従するよう修正
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Tenpo Detail: Tone & Manner Sync With Customer MyPage (2026-03-14)

- [x] `AdminTenpoKarte` ライトテーマ配色を `お客様マイページ` パレット（`#FCF9EA / #FFA4A4 / #FFBDBD / #BADFDB / #493628`）へ統一
- [x] ヘッダー・カード・入力・タグ・セグメント・ステータス色を同一トーンへ調整
- [x] ミュート文字・見出し色・エラー配色もマイページ準拠へ寄せて可読性を維持
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Tenpo Detail: Consolidate Controls Near Arrow Panel (2026-03-14)

- [x] 矢印コントロール領域に `基本情報 / チャット・対応履歴 / ストレージ` の直接切替ボタンを追加
- [x] `取引先名簿 / 店舗マスタ / カルテ詳細 / 更新` ボタンを同領域へ集約
- [x] ヘッダー右側から上記操作ボタンを撤去し、操作場所を1箇所へ統一
- [x] PC/SPで崩れないようボタン群のグリッドをレスポンシブ化
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Tenpo Detail: Place Buttons Inside Arrow Control Panel (2026-03-14)

- [x] `矢印コントロール枠` の内側に `表示切替ボタン` と `ページ操作ボタン` を内包する構造へ変更
- [x] 既存の外側ボタン群を廃止し、矢印・ラベル・各種ボタンを単一コンテナ化
- [x] モバイル表示時も同一コンテナ内で折返し表示されるよう調整
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Tenpo Detail: Single-line Compact Control Buttons (2026-03-14)

- [x] 矢印内ボタン群を `1行` に統一（`flex-nowrap` + 横スクロール）
- [x] ボタン幅をコンパクト化（等幅グリッドを廃止し自動幅へ変更）
- [x] 選択中の状態表現は `ボタン色変化のみ` とし、補助ラベル表示を削除
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Tenpo Detail: Add Monshin Action Buttons To Control Group (2026-03-14)

- [x] 問診チェック内操作（`基本情報 / 詳細入力 / yakusoku管理`）をコントロールボタン群へ追加
- [x] `問診: 基本情報` は `概要表示 + 基本情報ペイン` へ遷移するよう連動
- [x] `問診: 詳細入力` は `カルテ詳細` へ遷移
- [x] `問診: yakusoku管理へ` リンクをボタン群内へ追加
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Tenpo Detail: Remove Monshin Section Buttons (2026-03-14)

- [x] `問診チェック` セクション内の操作ボタン（`基本情報 / 詳細入力 / yakusoku管理へ`）を削除
- [x] 操作導線を上部コントロールボタン群へ一本化
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Tenpo Detail: Basic Info Multi-column Density Update (2026-03-14)

- [x] `基本情報` の `accordion-body` を2カラム化し、余白を削減して表示密度を改善
- [x] ワイド画面では3カラム化（`>=1280px`）し、狭い画面では1カラムへ自動フォールバック
- [x] 操作行/共有設定アコーディオン/リンクカードは全幅維持、`kv` 情報カードのみカラム配置に変更
- [x] ライトテーマでもカード境界/背景をパレットに合わせて可読性を維持
- [x] `npm -C src/misogi run build` でビルド確認

## Customer Chat: Dedicated Portal Thread + Admin Tenpo View (2026-03-14)

- [x] お客様マイページのチャット保存を `localStorage` 依存から廃止し、`admin_chat(room=customer_portal_chat)` を正として取得/表示する構成へ変更
- [x] お客様マイページのチャット送信を専用ユーティリティ経由に統一（`sender_role=customer` / `tenpo_id` を必須付与）
- [x] 管理側 `AdminTenpoKartePage` に「お客様チャット（専用）」カードを追加し、店舗単位でお客様マイページと同一スレッドを閲覧・返信可能化
- [x] 管理返信時は `sender_role=admin` として同一専用スレッドへ投稿するよう実装
- [x] 管理ダッシュボードのアクティビティ監視対象ルームを `customer_portal_chat` へ更新
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Tenpo Detail: Mypage Tone + Arrow Pane Control (2026-03-14)

- [x] `お客様詳細` サマリーにコントロール矢印を追加し、表示ペインを `左=基本情報 / 初期=チャット+対応履歴 / 右=ストレージ` で切替可能化
- [x] サマリーの表示モードを1画面集中（非選択ペインは非表示）へ調整
- [x] 問診チェック（`monshin-overview`）の縦サイズを圧縮（見出し・説明・進捗バー・アクション余白を縮小）
- [x] サマリー切替コントロールのライトモード配色をマイページトーン寄りに調整
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Tenpo Detail: Side Arrows + Hint Labels (2026-03-14)

- [x] `お客様詳細` の矢印コントロールをコンテンツ内から分離し、左右サイド（画面中央高さ）へ固定配置
- [x] 左右矢印にヒントラベル（`基本情報` / `ストレージ`）を追加し、操作意図を視覚化
- [x] サイド矢印とコンテンツが重ならないよう、シェル側に左右余白（安全域含む）を追加
- [x] モバイル幅では矢印サイズと余白を縮小し、極小幅ではヒントを非表示化
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Tenpo Detail: Main Content Width Tuning For Side Controls (2026-03-14)

- [x] `お客様詳細` のメインコンテンツに最大幅（`1460px`）を設定し、左右コントロールボタンとの重なりを回避
- [x] `ヘッダー / 問診概要 / サマリーシェル / エラー / メイングリッド` を同一最大幅で中央寄せし、ページ全体の基準幅を統一
- [x] 既存の縦方向マージン・パディングは維持し、横幅のみ調整
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Tenpo Detail: Width Balance Re-tuning (2026-03-14)

- [x] 全体を絞りすぎていたため、`ヘッダー/問診概要` の中央寄せ制約を解除して元バランスへ復帰
- [x] 幅制御対象を `サマリーシェル / エラー / メイングリッド` のみに限定
- [x] 幅制御は `1200px以上` のみ有効化し、`max-width: 1520px` で軽く絞る方式へ変更
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Tenpo Detail: Full-width + Monshin/Buttons Single-row Panels (2026-03-14)

- [x] `max-width` 制約を撤回し、`お客様詳細` コンテンツを全幅運用へ戻す
- [x] `問診票` と `ボタン群` を同一行の2パネル構成へ変更（左: 問診票 / 右: ボタン群）
- [x] サマリー時は `問診票 + コントロール` を横展開し、詳細入力時は問診票を単体表示
- [x] モバイル幅では2パネルを縦積みに自動フォールバック
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Tenpo Detail: Move Customer Labels Into Content + Side-control Safe Insets (2026-03-14)

- [x] 上部ヘッダーの顧客名表示を簡素化し、`取引先 / 屋号 / 店舗` 表示をコンテンツ内（チャット上）へ移設
- [x] サマリー中央ペイン先頭に `お客様表示` セクションを追加し、チャットの直上で店舗文脈を確認可能化
- [x] サマリー領域に `side-control` 回避用インセットを追加し、固定矢印との干渉を防止
- [x] 問診票＋ボタン群の1行2パネル構成を維持したまま、SP幅では自動縦積みに調整
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Tenpo Detail: Customer MyPage Linkage Action (2026-03-14)

- [x] お客様詳細コントロールボタン群に `お客様マイページ` 直接遷移ボタンを追加（同一 `tenpo_id` 付き）
- [x] 遷移は新規タブで開き、管理画面の編集状態を保持したまま参照可能化
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Tenpo Detail: Slightly Narrower Content Width (2026-03-14)

- [x] サマリー表示の左右インセットを拡張し、コンテンツ幅を一段狭めて視認バランスを調整
- [x] デスクトップ/タブレット/スマホの各ブレークポイントでインセット値を再設定（`72px / 54px / 40px`）
- [x] 既存の2パネル構成（問診票 + ボタン群）と固定矢印動線は維持
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Tenpo Detail: Move Customer Info Block Back To Lower Position (2026-03-14)

- [x] サマリー中央ペインの `お客様表示` ブロックを下段に戻すよう表示順を調整
- [x] `チャット -> 対応履歴 -> お客様表示` の順で並ぶよう `order` と `grid-column` を設定
- [x] DOM構造は維持し、CSSのみで配置を変更
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Tenpo Detail: Restore Customer Info Into Title Area (2026-03-14)

- [x] ヘッダータイトルを `屋号 / 店舗` ベースの表示へ復帰（未設定時は `取引先` または `tenpo_id`）
- [x] タイトル下サブ行に `取引先 / 屋号 / 店舗` を表示し、お客様情報をタイトル領域へ統合
- [x] サマリー中央ペインの `お客様表示` カードを削除
- [x] 連動して不要化した `tenpo-inline-*` スタイル定義を削除
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Tenpo Detail: Remove Pane Shortcut Buttons (2026-03-14)

- [x] コントロールボタン群から `基本情報 / チャット・対応履歴 / ストレージ` の3ボタンを削除
- [x] 左右矢印によるペイン切替導線は維持
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Tenpo Detail: Control Buttons Two-row Layout (2026-03-14)

- [x] コントロールボタン群を `1行スクロール` から `グリッド2段` 表示へ変更
- [x] PCは4列、タブレットは3列、スマホは2列で折返し表示するレスポンシブ構成に調整
- [x] 各ボタン/リンクをセル幅いっぱいに展開して、行内高さと視認性を統一
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Tenpo Detail: Content-only Toggle Back To Customer Summary (2026-03-14)

- [x] `カルテ詳細` ヘッダー操作に `お客様詳細` ボタンを追加
- [x] `setKarteView(KARTE_VIEW.SUMMARY)` により、ページ遷移なしでコンテンツのみ切替
- [x] 既存の `保存` ボタンと同列配置のまま運用可能
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Tenpo Detail: Keep Monshin + Button Group In Detail View (2026-03-14)

- [x] `問診票チェック` と `ボタン群` を共通パネル化し、`概要/詳細` の両ビューで同一表示に統一
- [x] 詳細ビュー上部でも `問診票 + コントロール` を1行2パネルで表示
- [x] `tenpo-content-safe` の左右インセットを `summary/detail` 共通で適用し、固定矢印との干渉を防止
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Tenpo Detail: Pane Buttons Hover Color Feedback (2026-03-14)

- [x] `お客様詳細` のコントロールボタン群にホバー時の軽い色変化を追加（非アクティブ時のみ）
- [x] ダーク/ライトテーマそれぞれでホバー配色を調整し、視認性を改善
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Split Catalog Viewer + Smooth Page Transition (2026-03-14)

- [x] 分割カタログ画像（`customer/catalog/split/*.png`）を読み込むページ一覧ビューアを追加
- [x] `サービスカタログ` ボタンを専用モーダル表示へ変更（ページ一覧 + 前へ/次へ + 新規タブ表示）
- [x] ページ切替時にフェード＋軽いスライドのアニメーションを追加し、閲覧を滑らかに改善
- [x] カタログモーダルで `Esc / ← / →` キー操作をサポート
- [x] `npm -C src/misogi run build` でビルド確認

## Customer Info: Operator-extensible Custom Fields (2026-03-14)

- [x] 管理 `お客様詳細 > 基本情報` に `追加情報` 編集UIを追加（項目名/内容を行追加・削除）
- [x] 追加情報の保存先を `tenpo.karte_detail.spec.custom_fields` に統一（配列構造へ正規化）
- [x] 保存時に `custom_fields` を正規化し、空行除去・文字数制限を適用して事故を抑制
- [x] お客様マイページの `基本情報` に `custom_fields` を自動表示し、運用側追加情報を反映
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Tenpo Detail: Remove HACCP Section (2026-03-14)

- [x] カルテ詳細の `HACCP 準拠チェック` セクションをUIから削除
- [x] HACCP関連の初期化/更新ロジック（`haccp.items` 生成・更新）を削除
- [x] HACCP専用CSS定義を削除し、ライトテーマの関連セレクタも整理
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Tenpo Detail: Remove Cleaning Checkpoint Container + Add Rule Free Note (2026-03-14)

- [x] カルテ詳細の `清掃チェックポイント（報告基準）` コンテナをUIから削除
- [x] ルールセクションに大きめ自由入力 `運用ルール（自由入力）` を追加（`spec.rule_free_note`）
- [x] `rule_free_note` の初期化/正規化（最大2000文字）を追加
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Tenpo Detail: Remove Monshin Basic/Detail Buttons (2026-03-14)

- [x] ボタン群から `問診: 基本情報` ボタンを削除
- [x] ボタン群から `問診: 詳細入力` ボタンを削除
- [x] その他のショートカット導線（取引先名簿/店舗マスタ/お客様マイページ/カルテ詳細/更新/yakusoku）は維持
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Tenpo Detail: Add Yotei Shortcut + Yakusoku Label Rename (2026-03-14)

- [x] ボタン群に `yotei` への導線ボタンを追加（`/admin/yotei`）
- [x] `問診: yakusoku管理へ` のラベルを `yakusoku` に変更
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Tenpo Detail: Customer Chat Border Visibility (2026-03-14)

- [x] お客様詳細ページのチャット欄（`.support-chat`）に明示的なボーダーを追加
- [x] 角丸と内側パディングを調整し、チャットコンテナ境界を視認しやすく変更
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Tenpo Detail: Chat Message Area Border Alignment (2026-03-14)

- [x] お客様詳細チャットのメッセージ表示エリア（`.support-chat-list`）に入力欄同系のボーダーを追加
- [x] メッセージ表示エリアに角丸と内側余白を付与し、視認性を改善
- [x] ライトテーマ時も入力欄と同じ配色ルール（`--tp-sub / --tp-card`）を適用
- [x] `npm -C src/misogi run build` でビルド確認

## Customer/Admin Chat: LINE-style Left/Right Bubble Placement (2026-03-15)

- [x] お客様詳細チャットで `customer` メッセージを左、`admin` メッセージを右に配置
- [x] お客様マイページチャットで `customer` メッセージを右、`agent` メッセージを左に配置
- [x] 各バブルの最大幅を制限し、LINE風の見え方（片側寄せ）に調整
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Raise Chat/Schedule Container Height (2026-03-15)

- [x] チャットと予定・対応履歴の両コンテナに最小高さを追加し、表示領域を拡張
- [x] レスポンシブで高さを段階調整（PC: 520px / タブレット: 460px / スマホ: 420px）
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Align Chat Bubble Direction With Admin (2026-03-15)

- [x] お客様マイページのチャットバブル左右配置を管理側と同じ向きに統一
- [x] `customer` を左寄せ、`agent` を右寄せへ変更
- [x] `npm -C src/misogi run build` でビルド確認

## Customer/Admin Chat: Compact LINE-style Bubble Sizing (2026-03-15)

- [x] 管理側・お客様側チャットの吹き出しを `fit-content + max-width(72%)` 化
- [x] バブル内余白/角丸/メタ文字サイズを圧縮し、余白過多を解消
- [x] 短文メッセージが横に伸びすぎないLINE風レイアウトへ調整
- [x] `npm -C src/misogi run build` でビルド確認

## Customer/Admin Chat: Tag-like Compact Bubble Height (2026-03-15)

- [x] 管理側お客様チャットを `タグ風` 表示へ調整（丸み強化・高さ圧縮・送信者時刻の簡略化）
- [x] お客様マイページチャットも同様に `タグ風` に調整（メッセージ高さ/メタ表示圧縮）
- [x] お客様側チャット入力欄の最小高さを 92px → 64px に縮小
- [x] `npm -C src/misogi run build` でビルド確認

## Customer/Admin Chat: LINE-like Gray/Green Bubble Alignment (2026-03-15)

- [x] お客様マイページを `自分=右グリーン / 相手=左グレー` のLINE風配色へ調整
- [x] 管理側お客様詳細チャットも同系配色へ統一（`admin=右グリーン / customer=左グレー`）
- [x] 両画面でメッセージメタ表示を省き、短文時の高さを最小化
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Customer Chat: Fix Light Theme Override For Bubble Colors (2026-03-15)

- [x] ライトテーマ時の汎用 `.support-chat-item` 上書きがLINE風配色を潰していたため、`customer-portal-chat-card` 専用ルールで再固定
- [x] 管理側チャットの `customer=左グレー / admin=右グリーン` をライトテーマでも維持
- [x] `npm -C src/misogi run build` でビルド確認

## Customer/Admin Chat: Fix Vertical-Stretched Bubble Bug (2026-03-15)

- [x] `inline-flex` 起因でメッセージが縦に潰れる不具合を修正（管理側/お客様側とも `display:block` 化）
- [x] 吹き出しを横長基準に戻し、`line-height` と `word-break` を見直して自然な改行に調整
- [x] `border-radius` / `padding` を再調整し、LINE風の通常吹き出し見た目へ復帰
- [x] `npm -C src/misogi run build` でビルド確認

## Customer/Admin Chat: Proper Conversation Layout Rebuild (2026-03-15)

- [x] 管理側お客様詳細チャットを `support-chat-row + support-chat-bubble` 構造へ変更し、単なる投稿一覧ではなく会話UIとして再構築
- [x] お客様マイページチャットを `customer-chat-row + customer-chat-bubble` 構造へ統一し、左右の会話フローを固定
- [x] 専用スレッド（`customer_portal_chat`）は維持し、ダッシュボード共通チャットとは分離したままUIのみ会話型に改善
- [x] `npm -C src/misogi run build` でビルド確認

## Customer/Admin Chat: Bubble Color Update (2026-03-15)

- [x] 発信バブル色を緑から薄いピンク（`#FFBDBD`）へ変更
- [x] 受信バブル色を薄い青（`#BADFDB`）へ変更
- [x] 配色変更に合わせてバブル内文字色を可読性重視で調整
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Tenpo Detail: Customer Chat AI Candidate Workflow (2026-03-15)

- [x] お客様チャットの会話ログからAI抽出候補（構造化候補）を生成する機能を追加（管理側）
- [x] 候補ごとに `採用 / 却下` を実装し、採用時はカルテ詳細 `spec`（担当者連絡先・営業時間・連絡手段・鍵/セキュリティ・ルールメモ）へ反映
- [x] 候補データは `karte_detail.spec.ai_fact_candidates` に保持し、管理側が最終判断できる運用へ変更
- [x] 候補パネルUI（未処理件数・根拠表示・ステータス表示）を追加
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Show Yagou/Tenpo In Header Title (2026-03-15)

- [x] お客様マイページで `tenpo_id` 指定時、ヘッダータイトル（h1）を `屋号 / 店舗名` 表示へ変更
- [x] 店舗未指定時は従来どおり `お客様マイページ` を表示
- [x] `npm -C src/misogi run build` でビルド確認

## Customer Chat AI: Restriction Guard + Escalation Reply (2026-03-15)

- [x] お客様チャット送信後のAI応答フローを追加（`ミセサポAI` 名義で返信）
- [x] 契約/金額/請求/補償/責任/法務/判断/確約などの禁止領域をキーワード判定し、固定の担当者エスカレーション文へ切替
- [x] 禁止領域外は Gemini 応答（キー未設定・API失敗時は安全な受付文へフォールバック）
- [x] 会話コンテキスト（直近メッセージ）をAI入力へ渡し、短文・案内中心の返信に制御
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Dashboard: Priority Notice For Restricted Customer Inquiries (2026-03-15)

- [x] 禁止領域（契約/金額/判断系）検知時のAI返信メッセージに `event_type=customer_ai_escalation` / `priority=high` を付与
- [x] ダッシュボード通知集約で上記メタを検知し、`【要対応】...` 形式の優先通知文へ変換
- [x] 優先通知文は店舗ラベルとメッセージ要約を含め、通常チャット通知と区別可能化
- [x] `npm -C src/misogi run build` でビルド確認

## Customer Chat AI: Operator Hours Auto Switch (2026-03-15)

- [x] オペレーター受付時間を `9:00-18:00`（JST）として判定する自動切替ロジックを追加
- [x] 受付時間内はAI自動返信を停止し、時間外のみ `MISOGI` 自動返信を有効化
- [x] 時間帯は `VITE_CUSTOMER_CHAT_OPERATOR_START_HOUR` / `VITE_CUSTOMER_CHAT_OPERATOR_END_HOUR` で変更可能化（未指定時は `9/18`）
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage Chat: Operator Hours Info Near Send Button (2026-03-15)

- [x] お客様チャット送信ボタンの横に、オペレーター対応時間案内文を追加
- [x] 文言を「9:00-18:00 はオペレーター対応 / それ以外はサポートAI MISOGI 対応」に統一
- [x] モバイル幅では案内文と送信ボタンを縦並びに切替
- [x] `npm -C src/misogi run build` でビルド確認

## Customer/Admin Chat: Show AI Reply Mode (Gemini/Fallback) (2026-03-15)

- [x] お客様チャット返信データに `ai_meta(mode/provider/model)` を保存するよう拡張
- [x] お客様マイページのAI返信吹き出し名に `Gemini / 定型 / 制限対応` タグを表示
- [x] 管理側お客様詳細チャットにも同タグを表示し、AI応答モードを可視化
- [x] `npm -C src/misogi run build` でビルド確認

## Customer Chat AI: Backend Relay Security Hardening (2026-03-15)

- [x] お客様チャットAI応答をフロント直呼びから `master/admin_chat(mode=customer_ai_reply)` 経由へ変更
- [x] `lambda_torihikisaki_api.py` に `customer_ai_reply` モードを追加（時間帯判定/禁止領域判定/Gemini呼び出し/定型フォールバック）
- [x] フロント `.env` から `VITE_GOOGLE_AI_API_KEY` を削除し、キーは Lambda 環境変数 `GOOGLE_AI_API_KEY` 管理へ切替
- [x] `python3 -m py_compile lambda_torihikisaki_api.py` / `npm -C src/misogi run build` で確認

## Customer/Admin Chat: Max Height + Scroll Lock (2026-03-15)

- [x] お客様マイページのチャットログに最大表示高さを設定（PC/Tablet/SPで段階的 `max-height`）
- [x] 管理側お客様詳細チャットログを `overflow-y: auto` / `overflow-x: hidden` に統一
- [x] チャット本文はログ領域内スクロール表示へ固定（レイアウト崩れ防止）
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Dashboard: Activity Direct Link + Store Tag + Common Chat UI Align (2026-03-15)

- [x] 管理ダッシュボードのアクティビティ各行に `開く` ダイレクトリンクを追加（管理日誌/報告詳細/お客様詳細へ遷移）
- [x] アクティビティ内のお客様チャット通知に `屋号 / 店舗` を1つのタグとして表示
- [x] ダッシュボード右ペインの社内共通チャットを左右分離の吹き出し配色へ変更（自分=ピンク / 相手=ブルー）
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Dashboard Activity: One-line Notification Row (2026-03-15)

- [x] アクティビティ通知行を `タグ / 内容 / 時刻 / 詳細を開く` の1行レイアウトへ統一
- [x] 通知本文から時刻文字列の重複を除去し、時刻は専用カラム（`HH:mm`）表示へ変更
- [x] 長文内容は1行省略（ellipsis）で表示し、横崩れを防止
- [x] 通知のアカウント名を独立タグ化し、人物タグを青系配色で表示
- [x] 通知の時刻を先頭カラムへ移動（`時刻 / 店舗タグ / 人物タグ / 内容 / 詳細`）
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Dashboard Activity: 48-hour History Window (2026-03-15)

- [x] アクティビティ抽出条件を「当日」から「直近48時間」に変更
- [x] `admin/work-reports` 取得範囲を48時間窓に合わせて拡張（`from` を2日前相当に変更）
- [x] 通知パネル文言を `本日の更新通知` から `48時間分の通知` / `直近48時間` へ統一
- [x] 空状態文言を `直近48時間` 基準へ更新
- [x] 業務報告通知に投稿時刻を表示（`submitted/reported` 優先抽出 + `投稿 HH:mm` 追記）
- [x] 時刻パーサを拡張し、epoch秒/epochミリ秒形式の投稿時刻も正しく通知へ反映
- [x] 業務報告イベントを「提出通知（submitted_at）」優先で生成し、状態更新後でも提出時点通知が残るように修正
- [x] アクティビティ用 `admin/work-reports` 取得を期間パラメータ依存から外し、クライアント側48時間抽出へ統一
- [x] `npm -C src/misogi run build` でビルド確認

## Sales Master: Customer Master Request Flow (2026-03-15)

- [x] 営業サイドバーに `顧客マスタ申請` を追加し、`/sales/master/customer` へ遷移可能化
- [x] 営業ルート `/sales/master/customer` を追加し、管理と同一画面 `AdminCustomerMasterPage` を営業モードで再利用
- [x] 営業モードでは `保存/削除/新規追加` を直接反映せず、`master/admin_chat(room=customer_master_approval)` へ申請イベントとして保存
- [x] 管理モードに承認待ち一覧を追加し、`承認して反映 / 却下(理由必須)` を実装
- [x] 承認時は申請内容を実データへ反映し、却下時は却下イベントのみ記録するイベントソーシング構成を追加
- [x] 顧客マスタ画面の申請キューUI/CSS（一覧・操作ボタン・モバイル時レイアウト）を追加
- [x] パンくずに `顧客マスタ申請` ラベルを追加
- [x] `npm -C src/misogi run build` でビルド確認

## Sales HOTBAR: Customer Sub Buttons Simplified (2026-03-15)

- [x] 営業HOTバー `顧客` サブボタンを2件へ削減（`顧客登録申請` / `顧客情報一覧`）
- [x] 旧 `顧客カルテ` / `顧客マスタ申請` サブボタンを非表示化
- [x] `npm -C src/misogi run build` でビルド確認

## Sales Customer List: Reuse Admin Customer Detail In Sales Mode (2026-03-15)

- [x] 営業向け顧客詳細ルート `/sales/tenpo/:tenpoId` を追加し、`AdminTenpoKartePage(mode=\"sales\")` を再利用
- [x] 営業顧客一覧カードの遷移先を `/sales/store/:id` から `/sales/tenpo/:tenpoId` へ変更
- [x] 営業カルテ一覧パネル（`SalesCustomerListPanel`）の遷移先も `/sales/tenpo/:tenpoId` に統一
- [x] 営業モードの顧客詳細で管理専用導線（取引先/店舗/yakusoku/soukoマスタ等）を非表示化
- [x] 営業モードの顧客詳細で編集保存導線を抑止（基本情報編集・対応履歴編集・ストレージアップロードは無効）
- [x] パンくずに営業顧客詳細ラベル（`/sales/tenpo/*` => `顧客詳細`）を追加
- [x] `npm -C src/misogi run build` でビルド確認

## Sales HOTBAR: Keep Customer Master Registration Entry (2026-03-15)

- [x] 営業HOTバー `顧客` サブ1件目を `顧客マスタ登録` へ変更
- [x] `顧客マスタ登録` の遷移先を `/sales/master/customer` に修正（顧客情報一覧との2ボタン構成を維持）
- [x] `npm -C src/misogi run build` でビルド確認

## Sales Customer List: Share Admin Customer Info Page (2026-03-15)

- [x] ` /sales/clients/list ` を営業専用一覧から `AdminTorihikisakiMeiboPage(mode=\"sales\")` 共有へ切替
- [x] 営業モード時の一覧ヘッダ文言を `顧客情報一覧` に変更
- [x] 営業モード時の `カルテ` 遷移先を `/sales/tenpo/:tenpoId` に統一
- [x] 営業モード時の補助導線を営業向けに置換（`予定へ` → `/sales/schedule`、`マスタ` → `/sales/master/customer`）
- [x] 営業モードでは取り消し操作（取引先トリガー/オーバーレイ）を非表示化
- [x] パンくずに `/sales/clients/list` => `顧客情報一覧` を追加
- [x] `npm -C src/misogi run build` でビルド確認

## Sales Customer Detail: Smartphone One-column Layout (2026-03-15)

- [x] `AdminTenpoKartePage` ルートラッパーに営業モードclass（`is-sales-mode`）を付与
- [x] 営業モード時、`max-width:900px` で `pane-center` グリッドを 2カラム→1カラムへ固定
- [x] 営業モード時、スマホ幅で `お客様チャット/対応履歴` カードの最小高さを解除し縦積み表示を安定化
- [x] `npm -C src/misogi run build` でビルド確認

## Sales Customer Detail: Mobile Pane Simplify + Swipe Switch (2026-03-15)

- [x] 営業スマホ顧客詳細のボタン群を `基本情報` / `チャット` / `ストレージ` の3ボタン構成へ整理
- [x] 営業スマホ顧客詳細の3ボタンを1行固定表示（狭幅時も2段折り返ししない）
- [x] 営業スマホ顧客詳細から `お客様マイページ` / `更新` ボタンを非表示化
- [x] 営業スマホ顧客詳細の左右コントローラー矢印を非表示化
- [x] 営業スマホ顧客詳細の表示切替を上部ボタンから下部固定HOTバーへ移行（`基本情報 / チャット / カルテ / ストレージ`）
- [x] 営業スマホ顧客詳細のHOTバー選択に応じて `概要ペイン切替` と `カルテ画面遷移` を統合制御
- [x] 営業スマホ顧客詳細で左右スワイプによる `基本情報 <-> チャット <-> ストレージ` 切替を追加
- [x] 営業スマホ顧客詳細は初期表示を `基本情報` に固定
- [x] 営業スマホ顧客詳細では `問診票チェック` パネルを非表示化
- [x] 営業スマホ顧客詳細のヘッダー `お客様詳細` 表示をコンパクト化（余白/文字サイズ縮小、補助行非表示）
- [x] `npm -C src/misogi run build` でビルド確認

## Sales Entrance: Customer Icon Update (2026-03-15)

- [x] 営業エントランスHOTバー `顧客` に専用アイコン種別 `customer` を割り当て
- [x] HOTバー用 `customer.svg` アイコンを追加（`public/icons/hotbar/customer.svg`）
- [x] HOTバーCSSに `hotbar-icon-customer` マスク定義を追加
- [x] `npm -C src/misogi run build` でビルド確認

## Mobile Entrance Header: Safe-area Offset (2026-03-15)

- [x] スマホ幅で `GlobalNav` の `top` を `env(safe-area-inset-top)` 基準へ変更
- [x] スマホ幅で `GlobalNav` の上マージン/左マージンを safe-area 加味へ変更（戻る/ハンバーガーの重なり回避）
- [x] `npm -C src/misogi run build` でビルド確認

## Sales Mobile: Add Entrance HOTBAR To Customer Master + Customer List (2026-03-15)

- [x] 営業モードの `顧客マスタ (/sales/master/customer)` 下部に、エントランス同等のHOTバーを追加
- [x] 営業モードの `顧客情報一覧 (/sales/clients/list)` 下部に、エントランス同等のHOTバーを追加
- [x] HOTバー押下時の遷移を `SALES_HOTBAR` 定義（`to` または先頭 `subItems.path`）で統一
- [x] モバイル幅のみHOTバーを表示し、コンテンツ下部が隠れないようページ下余白を追加
- [x] `npm -C src/misogi run build` でビルド確認

## App Startup: Keep Portal Default (2026-03-17)

- [x] standalone(PWA)起動時に `#/customer/mypage` で開かれた場合のみ `#/`（Portal）へ補正するガードを追加
- [x] 通常ブラウザの直URL（`#/customer/mypage?...`）は維持し、customer導線は破壊しない条件分岐に調整
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Entrance: Remove Top Padding On App Shell (2026-03-17)

- [x] `app-fullscreen.cleaning-worker-app` の上部パディングを `0` に変更（清掃エントランス上部余白を解消）
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Entrance: Visualizer Ripple Clipping Fix (2026-03-17)

- [x] モバイル時の `visualizer-container` / `visualizer-viz-wrap` の `overflow: hidden` を解除し、波紋がコンテナ境界で切れないように調整
- [x] 波紋最大径を `--visualizer-ripple-max` 変数化し、モバイルでは `min(92vw, 600px)` へ制限（画面内で拡張）
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning HOTBAR: No-assignment 404 Handling + Route Consistency (2026-03-17)

- [x] 清掃予定取得で `404` が返る環境差を吸収し、`MyYoteiListPage` では `予定なし`（空配列）として扱うよう修正
- [x] 清掃ワーカークロームのHOTバー導線をエントランス仕様に整合（`報告` は `予定一覧(報告導線)`、`ツール` は `清掃マニュアル`）
- [x] `報告` 導線（`/jobs/cleaning/yotei?entry=report`）時はHOTバーのアクティブを `報告` 側で表示するよう調整
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Report Start: Remove Stale Disabled Blocker (2026-03-17)

- [x] Yotei一覧/単体の `報告開始` ボタンを `canStartReport` で無効化しないよう修正（`id` 未設定時のみ無効）
- [x] `openHoukokuFromYotei` 内の最新再取得判定（実行中/宣誓/作業前確認）を常に実行できる導線へ修正
- [x] `npm -C src/misogi run build` でビルド確認

## S3 Separation: Manual vs Houkoku Buckets (2026-03-17)

- [x] `universal_work_reports.py` の PDF出力保存先を `WORK_REPORTS_BUCKET/HOUKOKU_BUCKET` 優先 + `misesapo-work-reports` 既定へ統一（`S3_BUCKET_NAME` フォールバック廃止）
- [x] `lambda_function_s3_upload.py` の `/upload-url` で報告ファイル保存先を `WORK_REPORTS_BUCKET_NAME` 固定化（manual バケットへ保存されないよう修正）
- [x] `lambda_function_yotei.py` の `/upload-url` も同様に報告専用バケットへ固定化
- [x] 旧報告経路の `reports/*` URL解決/画像アップロードで `s3_key` プレフィックスに応じてバケットを切替（`reports|work-reports` は報告バケット、その他は manual バケット）
- [x] `lambda_package/universal_work_reports.py` にも同一修正を反映（デプロイ資材との乖離防止）
- [x] `python3 -m py_compile universal_work_reports.py lambda_package/universal_work_reports.py lambda_function_s3_upload.py lambda_function_yotei.py` で構文確認

## Cleaning Manual (React): API-first Image/Data Load (2026-03-17)

- [x] `CleaningManualPage` を静的JSON固定から `cleaning-manual` API優先読込へ変更（`/api-master/cleaning-manual`）
- [x] 英語表示時は `-en` エンドポイントを優先し、未提供環境では通常エンドポイントへフォールバック
- [x] API失敗時は同梱 `cleaning-manual*.json` にフォールバックし、画面に状態メッセージを表示
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Manual (React): Image Frame Portrait Tuning (2026-03-17)

- [x] 清掃マニュアルの比較画像枠を縦長に調整（`180x120` → `168x210`）
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Manual (React): Equal-width Image Layout (2026-03-17)

- [x] 比較画像の配置を固定幅から均等割りグリッドへ変更（`repeat(auto-fit, minmax(140px, 1fr))`）
- [x] 画像幅を `100%` に変更し、表示エリア幅に対して均等表示へ統一
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Manual (React): Slider For 3+ Images (2026-03-17)

- [x] `badImage/goodImage` が3枚以上のセクションのみ `is-slider` クラスを付与
- [x] `is-slider` で横スワイプ + scroll-snap レイアウトへ切替（1〜2枚は均等幅表示を維持）
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Manual (React): Fixed Header + Content-only Scroll (2026-03-17)

- [x] タイトル/言語切替/カテゴリタブを固定し、カード本文のみを内部スクロールへ変更
- [x] `CleaningManualPage` を `scroll` ラッパー構造へ調整（ステータス + リストを同一スクロール領域化）
- [x] `cleaning-manual-react-app/page` を `height:100vh + overflow:hidden` 化してページ全体スクロールを抑止
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Manual (React): No Horizontal Scroll + Extend Vertical Area (2026-03-17)

- [x] 清掃マニュアルルートの横スクロールを抑止（`overflow-x: hidden`）
- [x] カテゴリタブを横スクロールから折り返し表示へ変更（`flex-wrap: wrap`）
- [x] 画面下余白を圧縮し、本文スクロール領域を HOTバー上端まで拡張
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Manual (React): Keep Main Width + Photo-only Carousel + Aspect Ratio (2026-03-17)

- [x] メインコンテンツ幅を全幅維持（`cleaning-manual-react-page` を `width/max-width:100%`）
- [x] 3枚以上の画像は写真行のみカルーセル（1スライド=1枚、`flex-basis:100%`）に変更
- [x] 画像は固定高さを廃止し、`height:auto` で元比率を維持（`max-height:58vh`）
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Manual (React): Aspect-preserving Downscale Tuning (2026-03-17)

- [x] 画像表示を `object-fit: contain` へ変更し、トリミング無しで比率維持
- [x] 通常表示/カルーセル表示それぞれに `max-height` 上限を設定し、過大表示を抑制
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Manual (React): Photo Visual Consistency Tuning (2026-03-17)

- [x] 比率維持のまま画像表示ボックス高さを統一（通常/カルーセルで固定レンジ化）
- [x] `object-position:center` と内部パディング追加で余白バランスを統一
- [x] `align-items: stretch` へ変更し、画像行の見た目揃えを強化
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Manual (React): Disable Carousel, Keep Listed Photos (2026-03-17)

- [x] 3枚以上時の `is-slider` 条件付与を撤去し、常に羅列グリッド表示へ統一
- [x] `.image-row.is-slider` のカルーセル用CSSを削除
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Manual (React): Topbar Language Toggle + Category Tabs Cleanup (2026-03-17)

- [x] 言語切替ボタンをマニュアルヘッダーから清掃トップバー（エントランス/ログイン行）へ移設
- [x] `CleaningWorkerChrome` にトップバー右側拡張スロットを追加し、ページ側から言語トグルを注入可能化
- [x] カテゴリボタンを4列1行固定表示へ変更（`厨房設備/空調設備/フロア/その他`）
- [x] タブ生成対象を `CATEGORY_META` 定義キーのみに制限し、`updatedAt/by` 等メタキーの表示を除外
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei: Report Creation Without Assigned Schedule (2026-03-17)

- [x] 清掃 HOTバー `報告` 導線（`/jobs/cleaning/yotei?entry=report`）で予定0件時に、`予定なしで報告を作成` ボタンを表示
- [x] 上記ボタン押下で `yotei_id` なしの `'/jobs/cleaning/houkoku'` へ遷移できるように変更
- [x] 既存の「予定あり + 実行中 + 宣誓/確認完了」時の報告開始ガードは維持（既存仕様を壊さない）

## Cleaning HOTBAR: Direct Report Navigation (2026-03-17)

- [x] 清掃 HOTバー `報告` の遷移先を `'/jobs/cleaning/houkoku'` へ変更（予定一覧を経由しない）
- [x] 清掃エントランスの HOTBAR 設定（`hotbar.config.js`）も同一導線へ統一

## Cleaning Houkoku: Top Margin Offset For Fixed Topbar (2026-03-17)

- [x] `AdminCleaningHoukokuBuilderPage` のメインラッパー上余白を `safe-area` 込みで拡張し、固定トップバーとの重なりを解消
- [x] モバイル幅（`max-width: 640px`）でも同様に上余白を調整

## Cleaning Topbar: Mobile Safe-area Offset Increase (2026-03-17)

- [x] 清掃トップバーの `padding-top` を増やし、`エントランス/ログアウト` ボタンがスマホの時計・ステータス領域と重ならないように調整

## Cleaning Houkoku UI: Store Search + Service Picker Visual Separation (2026-03-17)

- [x] 報告作成の入力上段で `取引先・店舗検索` を1コンテナ化（検索 + 店舗候補 + 店舗選択）
- [x] `サービス選択` を独立コンテナへ分離し、店舗検索と見た目を切り離し
- [x] サービス選択ボタンの `masterQuery` 自動引き継ぎを外し、検索挙動を店舗検索と分離

## Cleaning Houkoku UI: Search/Select Hint Label Update (2026-03-17)

- [x] `取引先・店舗検索` 見出しを `取引先・店舗検索（自由入力で店舗を検索できます。）` へ変更
- [x] `店舗情報（souko保存先）` を `店舗選択（既存顧客の選択ができます）` へ変更
- [x] `サービス選択` 見出しを `サービス選択（担当したサービスの選択を行なってください。）` へ更新

## Cleaning Houkoku: Cleaner Auto-fill (Worker) + Manual Select (Admin) (2026-03-17)

- [x] 清掃員側（`forceDirectBucketUpload=true`）では、清掃員をログインアカウント本人IDで自動設定
- [x] 清掃員側の清掃員UIを「自動入力」表示へ変更（手動チェックリスト非表示）
- [x] 管理側（`forceDirectBucketUpload=false`）は既存どおり複数清掃員を手動選択可能なまま維持

## Cleaning Houkoku: Companion Worker Toggle (2026-03-17)

- [x] 清掃員側に `同伴作業員: なし/あり` の選択UIを追加
- [x] `あり` の場合のみ同伴作業員チェックリストを表示し、同伴者を複数選択可能化
- [x] 本人（ログイン清掃員）は常に選択維持し、`なし` 選択時は同伴者のみ解除

## Cleaning Houkoku UI: Cleaner-first Order + Numbered Section Titles (2026-03-17)

- [x] 入力順を `取引先・店舗` → `清掃員` → `作業日等` → `サービス` へ再編成（`作業日等` を清掃員の下へ移動）
- [x] 各項目タイトルに番号を付与（`1` / `1-1` / `2` / `2-1` / `3` / `4`）
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Houkoku UI: Service Selected Area Height Up (2026-03-17)

- [x] `サービス選択` の選択済み表示枠（`ServiceTagFrame`）の最小高さを拡張（`30px` → `72px`、モバイル `64px`）
- [x] 内側タグ領域（`ServiceTags`）の最小高さを拡張し、空状態/選択状態とも視認性を改善
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Houkoku UI: Service Option Cards Bordered (2026-03-17)

- [x] サービス選択オーバーレイ内でカテゴリごとの候補ブロック（`.svc-group`）をボーダー枠で分離表示
- [x] 各サービス選択項目（`label`）にもボーダーを付与し、選択時は枠色を強調
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Houkoku UI: Boxed Sections for 2 and 3 (2026-03-17)

- [x] `2. 清掃員` ブロックを独立コンテナ化し、`1`/`4` と同様にボーダー枠で囲うよう調整
- [x] `3. 作業日等` ブロックを独立コンテナ化し、ボーダー枠で囲うよう調整
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Houkoku UI: Step-by-step Input Flow (2026-03-17)

- [x] 必須選択セクションを段階表示へ変更（`1: 店舗情報` → `2: 清掃員` → `3: 作業日等` → `4: サービス選択`）
- [x] `次へ進む / 戻る` ナビゲーションを追加し、各ステップの必須条件を満たした場合のみ次へ進行可能化
- [x] ステップヘッダー（4段）を追加し、到達済みステップへの直接移動を可能化
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Houkoku UI: Hide Detail/Photo Blocks Until Step4 Complete (2026-03-17)

- [x] `作業内容詳細` / `作業写真` / `補助資料` / 提出操作を、ステップ4完了（サービス選択済み）まで非表示化
- [x] 非表示中は案内メッセージのみ表示し、入力導線をステップ選択へ集中
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Houkoku UI: Strict Sequential Step Progression (2026-03-17)

- [x] ステップヘッダーの直接クリック遷移を廃止し、順番固定の表示（進捗インジケータ）へ変更
- [x] 進行は `次へ進む` / `戻る` のみで操作する仕様へ統一
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Houkoku UI: Camera Icon In Empty Before/After Buckets (2026-03-17)

- [x] `ビフォア/アフター/作業写真` の空状態文言にカメラアイコン付き `カメラで撮影` ボタンを追加
- [x] バケット別ファイル入力に `capture=\"environment\"` を追加し、モバイルでカメラ起動導線を強化
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning HOTBAR: Move My Sales To Tools (2026-03-17)

- [x] 清掃エントランスHOTバーで `マイページ（売上）` を `予定` から `ツール` サブメニューへ移動
- [x] 清掃ワーカー共通HOTバーの `ツール` 遷移先を `/jobs/cleaning/mypage` に変更（マニュアルとは別導線）
- [x] `activeByPath` で `/jobs/cleaning/mypage` を `tools` アクティブとして判定するよう調整
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Houkoku: Use Default Worker HOTBAR (2026-03-17)

- [x] `App.jsx` で `/jobs/cleaning/houkoku`（`/report` 含む）でも清掃共通HOTバーを表示するよう変更
- [x] `AdminCleaningHoukokuBuilderPage` の専用モバイルHOTバー（検索/サービス/カメラ/プレビュー）を削除
- [x] 報告ページの下部ナビゲーションを `報告 / 予定 / ツール / 設定` に統一
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaner My Sales: Subtotal/Reward Formula + Labels Update (2026-03-17)

- [x] 小計売上を `売上 - システム維持費20%`（=売上×0.8）で計算するよう変更
- [x] 報酬見込みを `小計売上×40%÷人数`（人数は予定参加者数、最低1）で計算するよう変更
- [x] サマリー/表ヘッダー文言を指定表記へ更新（小計売上・報酬見込み）
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning HOTBAR: Tools Sub-buttons For Manual/Sales (2026-03-17)

- [x] 清掃共通HOTバー（`CleaningWorkerChrome`）で `ツール` 選択時にサブボタンを表示
- [x] サブボタンを `売上表`（`/jobs/cleaning/mypage`）と `マニュアル`（`/jobs/cleaning/manual`）の2件に統一
- [x] 現在ページに応じてサブボタンのアクティブ状態を切替（`mypage`=`売上表`, `manual`=`マニュアル`）
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning HOTBAR: Move Tools Sub-buttons To Top (2026-03-17)

- [x] 清掃共通HOTバーの `ツール` サブボタン表示位置を下部から上部（トップバー直下）へ移動
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning UI: Remove Visualizer Display (2026-03-17)

- [x] 清掃ジョブで `job-entrance-viz`（エントランスのビジュアライザー）を非表示化
- [x] 清掃ジョブで `report-page-viz`（各ページ上部ビジュアライザー）を非表示化
- [x] ビジュアライザー非表示に伴い `report-page-content` の上マージンを0へ補正
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Manual UI: Move Category Buttons To Header Right (2026-03-17)

- [x] `作業手順ライブラリ` ヘッダー内へカテゴリボタン（厨房設備/空調設備/フロア/その他）を移設
- [x] タイトル左・カテゴリボタン右の同一行レイアウトに調整
- [x] 画面幅に応じたボタンサイズ/最小幅のレスポンシブ調整を追加
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Pages: Header Layout Unified (2026-03-17)

- [x] `売上表（CleanerMySalesPage）` と `マニュアル（CleaningManualPage）` のヘッダーを共通構造へ統一
- [x] 共通ヘッダー仕様を `左: タイトル(kicker+h1) / 右: 操作群` に統一
- [x] モバイル時の折返し挙動（ヘッダー下段へ操作群）を両ページで同一化
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Manual: Move Language Switch To Settings (2026-03-17)

- [x] 清掃マニュアル画面のトップバー言語切替（日本語/EN）を削除
- [x] 清掃エントランス `設定` パネルへ `マニュアル言語`（日本語/EN）を追加
- [x] マニュアル画面は `localStorage(cleaning-manual-language)` の設定値を参照して表示言語を決定
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Header Layout: Fix Sales/Manual CSS Scope Collision (2026-03-17)

- [x] `売上表` と `マニュアル` の共通ヘッダークラスをページスコープ化し、CSS上書き競合を解消
- [x] `売上表` ヘッダーレイアウト崩れを修正（Manual CSSの影響を遮断）
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Sales/Manual: Fully Decouple Header+Tab Layout (2026-03-17)

- [x] `売上表` ヘッダーを専用クラス（`cleaner-my-sales-head*`）へ分離し、共通クラス依存を廃止
- [x] `マニュアル` ヘッダーを専用クラス（`cleaning-manual-react-head*`）へ分離し、タイトル行とカテゴリタブ行を独立配置
- [x] 両ページのタブ/操作行を相互非依存レイアウトに再調整（タイトル崩れ防止）
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Show Cleaning Report PDFs Immediately After Submission (2026-03-18)

- [x] お客様マイページの `souko` 取得を「先頭1件」から「該当店舗の全 `souko` を集約」へ変更
- [x] 重複キーを除外しつつ、`uploaded_at` 降順で `detailSoukoFiles` を正規化
- [x] `作業完了レポート` モーダルで `cleaning_houkoku_pdf`（および関連カテゴリ）のPDFを直接表示/閲覧可能化
- [x] モーダル表示時に再読込し、提出直後でも反映されるように調整
- [x] 30秒ポーリングで `souko` を再取得し、報告書反映の追従性を改善
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Houkoku: Report ID Issuance On Submit (2026-03-18)

- [x] 清掃報告の送信時に報告ID（`report_ref_id`）を発行する処理を追加
- [x] 発行IDを報告レコード本体（POST payload / context）へ保存
- [x] 生成されるPDF/写真の `souko` メタデータにも同一 `report_ref_id` を付与
- [x] 送信完了トーストに発行済み報告IDを表示
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Houkoku: Customer Publish Gate For Submitted Reports (2026-03-18)

- [x] 清掃員送信直後の `cleaning_houkoku_pdf` を `customer_visible=false` で保存（初期非公開）
- [x] 管理側 `AdminHoukokuDetailPage` に `お客様へ公開/公開停止` トグルを追加
- [x] 公開操作時に `customer_visible` と `customer_published_*` を `souko` へ反映
- [x] お客様マイページは `customer_visible=true` の報告書のみ表示するよう制御
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Houkoku: Admin Approval Flow + Customer Detail Publish Control (2026-03-18)

- [x] 報告書PDFメタに `approval_status=pending` を初期付与し、管理承認待ち状態を明示
- [x] 管理 `お客様詳細`（`AdminTenpoKartePage`）のストレージ一覧で、清掃報告書ごとに `承認待ち/承認済み` と `公開/非公開` を可視化
- [x] 同ページで「お客様へ公開/公開停止」トグルを実装（公開時に `approval_status=approved` を付与）
- [x] お客様マイページ表示条件を `customer_visible=true` かつ承認済み（または旧データ互換条件）へ強化
- [x] `npm -C src/misogi run build` でビルド確認

## Customer Detail: Storage Delete + Publish Checkbox Control (2026-03-18)

- [x] 管理 `お客様詳細` のストレージ一覧でファイル削除を可能化（確認ダイアログ付き）
- [x] 公開設定をボタン式からチェックボックス式へ変更（`お客様へ公開` ON/OFF）
- [x] 公開設定更新中/削除中の排他制御を追加し、同一行の多重操作を防止
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Standalone Redirect Guard Fix (2026-03-18)

- [x] PWA/standalone 起動時の `customer/mypage` 正規化処理を調整
- [x] `tenpo_id` 付きの明示URL（`#/customer/mypage?tenpo_id=...`）は Portal へリダイレクトしないよう修正
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Asset Load Failure Mitigation (2026-03-18)

- [x] 起動失敗時（root空）のフォールバックで、キャッシュバスター付きの1回自動再読込を追加
- [x] `vite build` を `emptyOutDir: false` に変更し、旧ハッシュ資産を残して 404 を減らす運用へ調整
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Customer Detail: MyPage Link Environment-safe URL (2026-03-18)

- [x] 管理 `お客様詳細` の `お客様マイページ` リンク生成を同一オリジン優先に変更
- [x] `VITE_MISOGI_CUSTOMER_MYPAGE_URL` が `customer/mypage` を含む場合のみ明示URLを優先し、未指定/不正時は `window.location.origin` ベースで生成
- [x] `npm -C src/misogi run build` でビルド確認

## Customer/Admin Storage: Expired Image URL Reload Fix (2026-03-18)

- [x] `souko` 返却時の `files[].get_url` を常に再署名するよう `lambda_torihikisaki_api.py` を修正（既存失効URLを上書き）
- [x] 管理 `お客様詳細` の画像表示URL優先順を `get_url > preview_url` に変更
- [x] お客様マイページの画像表示URL優先順を `get_url > preview_url` に変更
- [x] `python3 -m py_compile lambda_torihikisaki_api.py` で構文確認
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Yotei CORS Preflight Avoidance (2026-03-18)

- [x] お客様マイページの `お知らせ用 /yotei` 取得で Authorization ヘッダ送信を停止
- [x] クロスオリジン時の OPTIONS（プリフライト）依存を回避し、CORSエラーを抑制
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Portal/Entrance Access Lock (2026-03-18)

- [x] ルーターに customer専用ガードを追加し、`/customer/mypage?tenpo_id=...` で開いたタブを customer-only モードへロック
- [x] customer-only モード中は `Portal` / `Entrance` / 他全ルートへの遷移を `customer/mypage` へ強制リダイレクト
- [x] `tenpo_id` が欠落した `customer/mypage` も保持済み `tenpo_id` 付きURLへ補正
- [x] `npm -C src/misogi run build` でビルド確認

## Sales UX: Progress Usability + Contrast Tuning (2026-03-19)

- [x] 営業エントランス `進捗` をタップ時に `進捗一覧(/sales/leads)` へ直接遷移する導線へ変更（`directOnTap`）
- [x] 営業エントランス `進捗` サブ項目ラベルを用途が分かる文言へ整理（`進捗一覧 / 一次対応Inbox / 新規リード登録`）
- [x] 営業エントランスの HOTバー / サブHOTバー配色コントラストをライトテーマで強化（可読性改善）
- [x] 営業エントランス `顧客` サブ項目ラベルを `顧客登録申請` へ統一
- [x] 営業 `顧客登録申請` 画面を調整（担当者入力追加、営業担当自動反映、エラー表示改善、フォーム視認性改善）
- [x] `npm -C src/misogi run build` でビルド確認

## Sales Report: Background Tone Unified (2026-03-19)

- [x] 営業 `業務報告` ページ背景を他ページと同じトーン（`#FCF9EA`）へ統一
- [x] 営業報告カード/入力欄/添付行の背景と枠線を統一配色（白背景 + ピンク系ボーダー）へ調整
- [x] 営業報告ヘッダー（戻るボタン/タイトル）と認証エラーバナーをページ専用クラスへ整理
- [x] `npm -C src/misogi run build` でビルド確認

## Sales Hotbar Report (`#/houkoku`): Background Tone Unified (2026-03-19)

- [x] 営業HOTバー `報告` 遷移先（`/houkoku` = `AdminReportNewPage`）の背景をライトトーン（`#FCF9EA`）へ統一
- [x] `/houkoku` のカード/入力/ボタン/選択系UIを白背景 + ピンク/セピア系アクセント配色へ統一
- [x] `/houkoku` 内の読みにくい固定色（白文字/濃色背景）をライト配色へ補正
- [x] `npm -C src/misogi run build` でビルド確認

## Sales Label Cleanup: Hide `営業 / コンシェルジュ` (2026-03-19)

- [x] 報告タブ（`AdminReportNewPage`）の `営業 / コンシェルジュ` 表記を `営業` に統一
- [x] ハンバーガーメニュー（`/jobs/sales/entrance`）の同表記を `営業` に統一
- [x] `npm -C src/misogi run build` でビルド確認

## Sales Report UI Cleanup: Reduce Repetitive Titles (2026-03-19)

- [x] `/houkoku` で表示可能テンプレートが1つのみの場合、テンプレート切替タブを非表示化
- [x] 営業単独表示時は `営業活動報告` 見出しを非表示化し、`業務報告` との重複を削減
- [x] テンプレート切替タブの営業ラベルを `報告` に調整（複数タブ表示時）
- [x] `npm -C src/misogi run build` でビルド確認

## Sales Report UI: Add HOTBAR + Remove Bottom Portal Link (2026-03-19)

- [x] `/houkoku` 営業単独表示時に営業HOTバー（顧客/進捗/予定/報告）を下部固定で表示
- [x] HOTバー重なり回避のため、報告ページの下部パディングを調整
- [x] 下部 `ポータルに戻る` リンクを削除
- [x] `npm -C src/misogi run build` でビルド確認

## Sales Report UI: Hook Order Error Fix (2026-03-19)

- [x] `/houkoku` で追加した HOTバー制御フック（`useMemo`/`useCallback`）を条件分岐より上へ移動
- [x] Reactフック順序不一致（Rendered more hooks than during previous render）を解消
- [x] `npm -C src/misogi run build` でビルド確認

## Sales Report: Activity Time Picker (2026-03-19)

- [x] `TemplateRenderer` に `field.type = "time"` の描画対応を追加
- [x] `SALES_ACTIVITY_REPORT_V1` の `活動時間` を `活動開始/活動終了` の時間選択へ変更
- [x] 旧営業日報UI（`SalesDayReportPage`）も `活動時間（分）` 入力を `開始/終了` 時間選択へ統一
- [x] 旧営業日報UIは時間入力から `total_minutes` を自動計算して保存するよう調整
- [x] `npm -C src/misogi run build` でビルド確認

## Sales Customer Master: Header Text Cleanup (2026-03-19)

- [x] 営業モード `/sales/master/customer` のヘッダータイトルを `顧客登録申請` に変更
- [x] 営業モード時の説明文 `kokyaku / torihikisaki / yagou / tenpo を1画面で申請（管理承認後に反映）` を非表示化
- [x] 更新ボタンはヘッダー内配置を維持（営業モードでも同位置で表示）

## Sales Customer Master: Refresh Button Align Right of Title (2026-03-19)

- [x] 顧客マスタページのヘッダーを `タイトル行 + 補足行` 構造に変更
- [x] 更新ボタンをタイトル行の右端に固定配置（同一行）へ調整
- [x] `npm -C src/misogi run build` でビルド確認

## Sales Customer Master: Simplify Customer/Torihikisaki Input (2026-03-19)

- [x] `顧客 / 取引先を追加` を単一入力へ変更（`顧客名（取引先名と共通）`）
- [x] 入力値を `kokyaku_name` と `torihikisaki_name` に同時反映
- [x] 登録処理を単一値ベースへ調整（`顧客名` 未入力時エラー）

## Sales/Admin Customer Master: Hide Kokyaku ID From UI (2026-03-19)

- [x] 顧客マスタ新規追加カードの `顧客ID（自動採番）` 表示を削除（内部採番は維持）
- [x] 顧客マスタ一覧の `顧客(kokyaku)` 列から `kokyaku_id` タグ表示を削除
- [x] 顧客マスタ編集モーダルの `顧客ID(kokyaku)` 入力欄を非表示化（内部値は保持）
- [x] `npm -C src/misogi run build` でビルド確認

## Sales Customer Master: Step-Based Registration Request (2026-03-19)

- [x] 営業モード `顧客登録申請` の新規追加UIをステップ式へ変更（STEP1〜STEP4）
- [x] STEP1で `新規顧客 / 既存顧客` を選択し、新規は顧客名入力、既存は取引先選択に分岐
- [x] STEP2に `屋号がない場合は取引先と同じにする` ボタンを追加
- [x] STEP3に `店舗がない場合は屋号と同じにする` ボタンを追加
- [x] STEP4で申請内容確認のうえ `申請する` ボタンで一括申請
- [x] 承認側に `create_customer_bundle` アクションを追加し、承認時に `取引先→屋号→店舗` を順に実作成
- [x] `npm -C src/misogi run build` でビルド確認

## Sales Customer Master: Hide Unified Search For Registration (2026-03-19)

- [x] 営業モード `顧客登録申請` 画面では統合検索ツールバー（検索/全件/未紐付け/重複候補/削除）を非表示化
- [x] 管理モード `顧客マスタ` では既存どおり統合検索ツールバーを維持
- [x] `npm -C src/misogi run build` でビルド確認

## Sales Customer Master: Hide List Table On Registration (2026-03-19)

- [x] 営業モード `顧客登録申請` 画面では顧客一覧テーブル（リスト）自体を非表示化
- [x] 管理モード `顧客マスタ` では一覧テーブルを従来どおり表示
- [x] `npm -C src/misogi run build` でビルド確認

## Sales Customer Master: Existing-Customer Search In Step 1 (2026-03-19)

- [x] 営業モードのステップ1で `既存顧客` 選択時のみ `統合検索` 入力を表示
- [x] 統合検索で `顧客名 / 取引先名 / 屋号 / 店舗 / ID` を対象に既存取引先候補を絞り込み
- [x] 新規顧客選択時は統合検索を非表示化
- [x] `npm -C src/misogi run build` でビルド確認

## Sales Customer Master: Post-Submit Basic Info Prompt (2026-03-19)

- [x] `申請する` 実行後に `基本情報を入力しますか？` の確認ダイアログを表示
- [x] ダイアログ閉じ後は `顧客情報一覧(/sales/clients/list)` へ直接遷移（既存取引先IDがある場合はクエリ付与）
- [x] ダイアログ後にステップ入力状態をリセット
- [x] `npm -C src/misogi run build` でビルド確認

## Sales Customer Master: Pending Request Re-Edit (2026-03-19)

- [x] 営業モードでタイトル下説明文の直下に `申請中の顧客（再編集可）` セクションを追加
- [x] 申請中一覧に `申請ID / 時刻 / 再編集` を表示（営業自身の未承認申請を対象）
- [x] `再編集` 押下で申請内容をステップフォームへ再反映し、フォーム位置へスクロール
- [x] `create_customer_bundle` に加えて既存の `create_torihikisaki / create_yagou / create_tenpo` 申請も再編集読み込み対応
- [x] `npm -C src/misogi run build` でビルド確認

## Sales Customer Master: Pending List Toggle (2026-03-19)

- [x] `申請中の顧客` をトグルボタン化し、初期状態ではリストを閉じたまま表示
- [x] ボタン押下時のみ申請中リストを展開し、再編集操作ができる挙動へ変更
- [x] `申請中件数` は常時表示し、開閉状態は `▲/▼` で明示
- [x] `npm -C src/misogi run build` でビルド確認

## Sales Customer Master: Pending Section Color Tone Fix (2026-03-19)

- [x] 営業モード時の `申請中の顧客` セクション配色をライトトーンへ補正（黒っぽさ解消）
- [x] トグルボタン・リストカード・テキスト色を営業画面パレットへ統一
- [x] `npm -C src/misogi run build` でビルド確認

## Sales Entrance HOTBAR: `進捗`→`予定` + `ツール`差し替え (2026-03-19)

- [x] 営業HOTバーの2枠目ラベルを `進捗` から `予定` に変更
- [x] 2枠目のサブ導線を営業スケジュール（`/sales/schedule`）へ統一（`スケジュール`）
- [x] 営業HOTバーの3枠目（旧 `予定`）を `ツール` に差し替え
- [x] 営業HOTバーの3枠目ラベルを `ツール` から `打刻` に変更
- [x] `ツール` のサブボタンに `勤怠打刻`（`/admin/hr/attendance`）と `問診票作成`（`/admin/torihikisaki-touroku`）を追加
- [x] 営業 `勤怠打刻` を管理と同一リンク（`https://f.ieyasu.co/misesapo/login/`）へ変更
- [x] サブHOTバーの外部URLクリック時は新規タブで開く挙動を追加（`JobEntranceScreen`）
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Activity + Daily Digest: All Report Submissions (2026-03-19)

- [x] 管理報告提出（`AdminReportNewPage` 通常提出）に `state: submitted` を付与
- [x] `work-report` 経路（PUT/PATCH/submit）で `submitted_at / last_submitted_at` を保持するよう統一
- [x] `work-report` の提出遷移時に `kanri_log` へ `業務報告提出` イベントを追記
- [x] 旧 `houkoku` 経路の提出時にも `kanri_log` へ `業務報告提出` イベントを追記
- [x] `lambda_work_reports.py` に日次アクティビティメール送信（EventBridge起動）を追加
- [x] 送信先既定を `info@misesapo.co.jp`、集計対象を直近24時間（環境変数で変更可）に設定
- [x] `npm -C src/misogi run build` でビルド確認
- [x] `python3 -m py_compile universal_work_reports.py lambda_work_reports.py houkoku_api.py lambda_package/universal_work_reports.py` で構文確認

## Sales Tool: Monthly Own Customer Registration Requests (2026-03-19)

- [x] 営業向け `顧客登録申請（月次）` ページを新設（`/sales/tools/customer-requests`）
- [x] `customer_master_approval` 申請イベントから営業本人の `create_customer_bundle` のみ抽出
- [x] 月選択（`YYYY-MM`）で当月分の申請履歴を絞り込み表示
- [x] 状態フィルタ（全て/承認待ち/承認済み/却下）を追加
- [x] 申請総数・承認待ち・承認済み・却下の月次サマリを表示
- [x] 各申請に `申請ID / 申請時刻 / 顧客・取引先・屋号・店舗 / 判定情報` を表示
- [x] 営業HOTバー `打刻` サブボタンに `顧客申請（月次）` 導線を追加
- [x] `npm -C src/misogi run build` でビルド確認

## Sales HOTBAR Label: 打刻 → ツール (2026-03-19)

- [x] 営業HOTバー3枠目ラベルを `打刻` から `ツール` に変更
- [x] `勤怠打刻 / 問診票作成 / 顧客申請（月次）` のサブ導線は維持

## Sales HOTBAR Tools: Remove 問診票作成 (2026-03-19)

- [x] 営業HOTバー `ツール` サブ項目から `問診票作成` を削除
- [x] `勤怠打刻 / 顧客申請（月次）` の2導線構成へ整理

## Sales Report: Monthly History View (2026-03-19)

- [x] 営業報告（`SALES_ACTIVITY_REPORT_V1`）カード内に `過去の業務報告` セクションを追加
- [x] `対象月(YYYY-MM)` 入力 + 更新ボタンで月次履歴を再取得可能化
- [x] 履歴取得は `GET /work-report?date_from=...&date_to=...`（本人データ）を利用し営業テンプレートのみ表示
- [x] 各履歴に `日付 / state / version / 詳細` を表示し、`/sales/work-reports/:reportId` へ遷移可能化
- [x] `npm -C src/misogi run build` でビルド確認

## Sales Report History: Legacy Houkoku Fallback (2026-03-19)

- [x] 営業報告履歴取得で `/work-report` が0件の場合、`/houkoku?date=YYYY-MM-DD` を月内日次で収集するフォールバックを追加
- [x] 旧 `houkoku` 由来データを `template_id=SALES_ACTIVITY_REPORT_V1` かつ本人 `user_id` で絞り込み表示
- [x] 互換取得ロジック追加後に `npm -C src/misogi run build` でビルド確認

## Cleaning Report Flow: Admin List + Customer Detail Edit Route (2026-03-19)

- [x] 管理 `業務報告一覧` に清掃報告の `修正` 導線を追加（`/admin/tools/cleaning-houkoku?report_id=...`）
- [x] 管理 `業務報告詳細` のアクションに清掃報告の `修正` 導線を追加
- [x] 管理 `お客様詳細(ストレージ)` の清掃報告PDF行に `報告を修正` 導線を追加
- [x] `AdminCleaningHoukokuBuilderPage` に `report_id` 編集モードを追加（既存報告の読込→編集）
- [x] 編集時は `PUT /houkoku/{report_id}` で更新し、soukoへ再保存（PDF/写真）するフローを追加
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Houkoku Detail: Cleaning Photo URL Hydration Fix (2026-03-19)

- [x] 管理 `業務報告詳細` で `payload` 内画像のURL解決を強化（`key/get_url/preview_url/open_url/url` を統合）
- [x] `tenpo_id` の `souko.files` から `key -> 署名URL` マップを作り、報告payloadの画像項目へ自動補完
- [x] 一覧から詳細を開いた際に、清掃報告の写真が表示欠けしないよう互換補正を追加
- [x] `npm -C src/misogi run build` でビルド確認

## Report Attachment Preview: Multi-URL Fallback (2026-03-19)

- [x] `TemplateRenderer` の写真表示で `url` 固定参照を廃止し、`open_url/get_url/preview_url/src/href` も解決するよう修正
- [x] 管理 `業務報告詳細` の旧レイアウト写真表示でも同様のURLフォールバックを適用
- [x] URL未解決アイテムは描画しないようにして壊れたプレビュー描画を防止
- [x] `npm -C src/misogi run build` でビルド確認

## Cleaning Yotei Layout: Topbar Overlap Fix (2026-03-19)

- [x] 清掃予定ページ（`/jobs/cleaning/yotei`）で fixed topbar とメイン本文が重ならないよう上オフセットを追加
- [x] `.my-yotei-page` / `.my-yotei-page-single` の `report-page-main` に topbar 分の `padding-top` を統一適用
- [x] 同セクションに左右パディング（safe-area対応）を追加し、画面端詰まりを解消
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Dashboard Common Chat: Ctrl+Enter + @Mention (2026-03-19)

- [x] 共通チャット入力で `Ctrl+Enter`（Macは `⌘+Enter`）送信を追加
- [x] `@` 入力時に送信履歴の投稿者名からメンション候補を表示
- [x] メンション候補は Enter / ↑↓ / クリックで選択できるように対応
- [x] メンション候補UIのダーク/ライト配色を追加
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Sidebar: 勤怠管理 Direct Link (2026-03-19)

- [x] 管理サイドバー `勤怠管理` セクションを開閉式から単独リンク表示へ変更（`direct: true`）
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Activity + Daily Digest: Houkoku Submit / Customer Master Request (2026-03-19)

- [x] 管理ダッシュボードのアクティビティ集約に `customer_master_approval` ルームを追加
- [x] 顧客マスタ `change_request / change_decision` を通知行に変換し、`/admin/master/customer` への導線を追加
- [x] 業務報告イベントに投稿内容のプレビュー文を付加して可読性を改善
- [x] 日次メール集計（`lambda_work_reports.py`）に顧客マスタ申請イベントを追加
- [x] 日次メール集計の業務報告行にも内容プレビューを追加
- [x] `python3 -m py_compile lambda_work_reports.py` で構文確認
- [x] `npm -C src/misogi run build` でビルド確認

## Sales Report History: Legacy Owner Match Fix (2026-03-19)

- [x] 営業報告履歴の `/houkoku` フォールバックで、本人判定を `user_id` 単独から複数ID（`worker_id/sagyouin_id/created_by/submitted_by` 含む）照合へ拡張
- [x] `payload` が文字列JSONで返るケースもパースして本人判定に使用
- [x] IDが無い旧データ向けに `user_name/worker_name/...` の名前照合フォールバックを追加
- [x] 履歴対象テンプレート判定を `SALES_ACTIVITY_REPORT_V1` 固定から `SALES_*` 系も含む判定へ拡張
- [x] `npm -C src/misogi run build` でビルド確認

## Sales Report History: WorkReport + Houkoku Merge Fix (2026-03-19)

- [x] 営業履歴で `/work-report` が1件でも返ると `/houkoku` が無視される欠落ロジックを修正（常時マージ化）
- [x] テンプレート判定を `item.template_id` だけでなく `payload.template_id` 等も参照するよう拡張
- [x] 履歴IDの揺れ（`log_id` / `id` / `report_id`）を統一して詳細導線の欠落を防止
- [x] 重複キー統合時は `/work-report` 側（非legacy）を優先するマージルールを追加
- [x] `npm -C src/misogi run build` でビルド確認

## Sales Report Detail 404 Fallback Fix (2026-03-19)

- [x] 営業履歴詳細（`/sales/work-reports/:reportId`）で `GET /admin/work-reports/{id}` が404時に `GET /houkoku/{id}` へフォールバックするよう修正
- [x] legacy `HK-` ID は `houkoku` 優先、それ以外は `admin/work-reports` 優先の順序制御を追加
- [x] `npm -C src/misogi run build` でビルド確認

## Sales Report History: Default Template Legacy Detection (2026-03-19)

- [x] 営業履歴のテンプレート判定を `template_id` のみ依存から、`payload/description` の営業キー（`target_name/visit_type/next_actions/...`）でも判定するよう拡張
- [x] `user.cognito_sub`（Cognito sub）を本人照合トークンに追加し、`/houkoku` 旧レコードの `user_id=sub` を拾えるよう修正
- [x] 履歴判定時のデータ取得を `payload` に加え `description/body/data` もパース対象に拡張
- [x] `npm -C src/misogi run build` でビルド確認

## Sales Report History/Detail: Content Visibility Fix (2026-03-19)

- [x] 営業報告詳細で `description` のみ参照して内容空になる問題を修正（`payload/description/body/data` の順で内容復元）
- [x] 営業報告詳細に `SALES_ACTIVITY_REPORT_V1` 向けの「営業報告」表示ブロック（対象/接触種別/進捗/内容/次アクション）を追加
- [x] 営業履歴リスト行に内容サマリ（対象＋内容）を追加し、内容未登録時は明示表示
- [x] `npm -C src/misogi run build` でビルド確認

## Sales Report Detail: UUID 404 Fallback + Detail ID Strictness (2026-03-19)

- [x] 営業履歴行の `詳細` 導線IDを厳格化（`detail_id` 導入。`id` の汎用UUID誤採用を抑止）
- [x] `/sales/work-reports/:id` の詳細取得フォールバックに `GET /work-report/{id}` を追加
- [x] 参照順序を `admin/work-reports → work-report → houkoku`（HKは `houkoku` 優先）へ調整
- [x] `npm -C src/misogi run build` でビルド確認

## Sales Report History: HK Payload Shape Compatibility (2026-03-19)

- [x] 営業履歴サマリ抽出で `payload_json/payloadJson/template_payload/template_data` も復元対象に追加
- [x] `stores[0].store.*` / `stores[0].template_payload.*` など清掃系構造でも履歴サマリを抽出できるよう対応
- [x] 詳細表示側（`OfficeWorkReportDetailPage`）も同様に複数ペイロード形状を復元できるよう拡張
- [x] `npm -C src/misogi run build` でビルド確認

## Sales Report History: HK Detail Route Fix (2026-03-19)

- [x] 営業履歴の `HK-` 報告は `sales/work-reports/:id` ではなく `admin/houkoku/:id` へ遷移するよう分岐追加（内容復元差異を回避）
- [x] 非HK報告は従来どおり `sales/work-reports/:id` へ遷移
- [x] `npm -C src/misogi run build` でビルド確認

## Sales Report History: Summary Extraction + Merge Priority Fix (2026-03-19)

- [x] 営業履歴サマリ抽出で `description/body/data` のプレーンテキストも要約候補に追加し、`内容未入力` になりやすいケースを解消
- [x] ネストされた `payload/template_payload/template_data`（文字列JSON含む）を段階的に復元するよう拡張
- [x] 同一報告IDマージ時に `/work-report` 固定優先を廃止し、要約が取得できる方を優先するスコアマージへ変更
- [x] `npm -C src/misogi run build` でビルド確認

## Sales Report History: SALES_ACTIVITY Payload Key Coverage Fix (2026-03-19)

- [x] 営業テンプレート実データキー（`result.today` / `plan.tomorrow` / `concern.notes` / `activity.*`）を履歴要約抽出に追加
- [x] 営業判定ロジックに `result/plan/concern/activity` ネスト構造を追加し、営業履歴取り込み漏れを抑制
- [x] 要約が空の場合の補助表示として `activity.start_time/end_time` を時間要約に利用
- [x] `npm -C src/misogi run build` でビルド確認

## Sales Report: Quick Text Templates for "本日の成果" (2026-03-19)

- [x] 営業活動報告フォーム上部に「本日の成果テンプレート」ボタン群を追加（新規訪問 / 既存フォロー / 提案見積 / 受注失注）
- [x] ボタン押下で `result.today` へテンプレ文を追記挿入する処理を追加（既存入力保持）
- [x] 旧形式互換のため `content` へも同時同期
- [x] `npm -C src/misogi run build` でビルド確認

## Sales Report: Move Template Buttons Under "本日の成果" Heading (2026-03-19)

- [x] `TemplateRenderer` にセクション見出し直下の差し込み描画フック（`renderSectionAddon`）を追加
- [x] 営業テンプレ `today_result` セクション（`3. 本日の成果`）直下にテンプレートボタンを表示するよう移設
- [x] 既存の営業カード先頭のテンプレートボタン表示を削除し、見出し直下表示へ統一
- [x] `npm -C src/misogi run build` でビルド確認

## Sales Report Detail: Back Navigation Fix (2026-03-20)

- [x] 共通詳細ページ `OfficeWorkReportDetailPage` の戻り先をルート別に分岐（`/sales/work-reports/:id` は `/houkoku`、それ以外は `/admin/houkoku`）
- [x] エラー表示時の「報告一覧へ」リンクも同じ分岐に統一
- [x] `npm -C src/misogi run build` でビルド確認

## Customer Master: Sales Owner Tracking for Incentive (2026-03-20)

- [x] 営業の `顧客登録申請` / `店舗追加申請` ペイロードに `sales_owner_name` / `sales_owner_id` を付与
- [x] 承認時の `create_customer_bundle` / `create_tenpo` で営業担当情報を `tenpo` へ保存（`sales_owner_name` / `sales_owner_id`）
- [x] 管理 `顧客マスタ` 一覧に `営業担当` 列を追加（名称 + IDタグ）
- [x] 営業担当を検索・ソート・編集保存対象に追加
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Dashboard Common Chat: Drag & Drop Image Upload (2026-03-20)

- [x] 共通チャットに `enableDropUpload` オプションを追加（既存利用は非有効、ダッシュボードのみ有効化）
- [x] ダッシュボード共通チャットで画像/スクショのドラッグ&ドロップ添付を追加
- [x] ドロップ時は画像のみ受理し、非画像ファイルは除外メッセージを表示
- [x] ドロップターゲット強調UI（通常/ライトモード）を追加
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Houkoku Detail: Souko Backfill for Legacy Cleaning Reports (2026-03-20)

- [x] 管理 `業務報告詳細`（清掃）に `店舗ストレージへ保存` ボタンを追加（souko未保存時のみ表示）
- [x] 詳細プレビューをA4 PDF化し、`souko(mode=presign_upload)` 経由で `cleaning_houkoku_pdf` として後追い保存する処理を追加
- [x] `report_id / report_ref_id / schedule_id / work_date / approval_status` を含むメタ情報で `souko.files` へ反映
- [x] 保存済み重複を検知して二重登録を回避
- [x] 保存後に公開状態判定を再読込し、そのまま「お客様へ公開」トグルへ進める導線に調整
- [x] `npm -C src/misogi run build` でビルド確認

## Customer MyPage: Hide Invoice/Receipt Actions (2026-03-20)

- [x] お客様マイページ右側アクションから `請求書` / `領収書` ボタンを一時非表示化
- [x] 他アクション（次回予定 / 作業完了レポート / サービスカタログ / チャット / お問い合わせ / 規約）は維持
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Dashboard Common Chat: Resizer Width Reflection Fix (2026-03-22)

- [x] ダッシュボード右ペインチャットの固定幅 `440px` を廃止し、グリッド列幅（`--dash-chat-width`）に追従するよう修正
- [x] 既存のリサイザー操作で共通チャット幅が視覚的にも反映される状態に修正
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Dashboard: Move Filebox to Left Pane (2026-03-22)

- [x] ダッシュボード左ペインの `現在のアクティビティ` を廃止し、`/admin/filebox` で使っているファイルボックスUIを左ペインへ配置
- [x] ファイルボックス描画を共通化し、`/admin/dashboard` と `/admin/filebox` の表示差分を最小化
- [x] ファイルボックス初期ロードを `showAdminFilebox` 限定から `showAdminWorkspace`（dashboard/filebox）へ拡張
- [x] 右レール通知トグルは既存のまま維持（アクティビティ導線を右レールへ集約）
- [x] `npm -C src/misogi run build` でビルド確認

## Admin Dashboard: Chat Resizer + Single-Viewport Layout (2026-03-22)

- [x] ダッシュボード右ペインのリサイザー幅を拡大（`--dash-resizer-size: 14px`）し、チャット幅変更を操作しやすく改善
- [x] `job-entrance-main.with-sidebar.with-filebox` を1画面固定グリッド化し、ダッシュボード外側の縦スクロールを抑制
- [x] `admin-filebox-layout / panel / shell / chat-panel` を `height: 100%` + `min-height: 0` + `overflow` 制御へ統一し、内部スクロール中心の構成に調整
- [x] モバイル媒体（`max-width: 1023px`）では高さ固定を解除して従来挙動を維持
- [x] `npm -C src/misogi run build` でビルド確認
