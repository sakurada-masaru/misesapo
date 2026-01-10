# エントランスページ リファクタリング計画

作成日: 2026-01-10
作成者: Antigravity (Claude)

---

## 役割分担

| フェーズ | 担当 | 内容 | 状態 |
|----------|------|------|------|
| Phase 1 | **Gemini** | ディレクトリ作成、メタJSON、プレースホルダー | ✅ 完了 |
| Phase 2 | **Claude** | 共通CSS抽出、ジョブページ作成、リダイレクト設定 | ✅ 完了 |
| Phase 3 | **ユーザー** | 動作確認テスト | ✅ 完了 |
| Phase 4 | **Claude** | 共通JSモジュール作成 (`entrance-core.js`) | ✅ 完了 |
| Phase 5 | **オプション** | インラインコード削除、モジュール移行 | 📋 未着手 |

---

## ⚠️ Gemini への作業指示（厳守）

### ✅ やるべきこと（MUST）- 全て機械的作業

#### Task 1: ディレクトリ作成 ✓完了
```bash
mkdir -p src/pages/entrance/shared/css
mkdir -p src/pages/entrance/shared/js
mkdir -p src/pages/entrance/cleaning
... (残りのディレクトリ)
```

#### Task 2: メタデータJSONファイル作成
以下のファイルを**正確にこの内容で**作成:

```bash
# 清掃
echo '{ "title": "清掃エントランス | ミセサポ" }' > src/data/meta/entrance_cleaning_title.json
echo '{ "body_class": "entrance-page job-cleaning" }' > src/data/meta/entrance_cleaning_body_class.json

# 事務
echo '{ "title": "事務エントランス | ミセサポ" }' > src/data/meta/entrance_office_title.json
echo '{ "body_class": "entrance-page job-office" }' > src/data/meta/entrance_office_body_class.json

# 営業
echo '{ "title": "営業エントランス | ミセサポ" }' > src/data/meta/entrance_sales_title.json
echo '{ "body_class": "entrance-page job-sales" }' > src/data/meta/entrance_sales_body_class.json

# 人事
echo '{ "title": "人事エントランス | ミセサポ" }' > src/data/meta/entrance_hr_title.json
echo '{ "body_class": "entrance-page job-hr" }' > src/data/meta/entrance_hr_body_class.json

# 経理
echo '{ "title": "経理エントランス | ミセサポ" }' > src/data/meta/entrance_accounting_title.json
echo '{ "body_class": "entrance-page job-accounting" }' > src/data/meta/entrance_accounting_body_class.json

# 管理
echo '{ "title": "管理エントランス | ミセサポ" }' > src/data/meta/entrance_admin_title.json
echo '{ "body_class": "entrance-page job-admin" }' > src/data/meta/entrance_admin_body_class.json

# 開発
echo '{ "title": "開発エントランス | ミセサポ" }' > src/data/meta/entrance_dev_title.json
echo '{ "body_class": "entrance-page job-dev" }' > src/data/meta/entrance_dev_body_class.json
```

#### Task 3: プレースホルダーHTMLファイル作成
各ジョブディレクトリに以下の内容で `index.html` を作成:

```bash
for job in cleaning office sales hr accounting admin dev; do
  echo "<!-- TODO: Phase 2でClaudeが実装予定 - ${job}用エントランス -->" > src/pages/entrance/${job}/index.html
done
```

#### Task 4: 確認
```bash
ls -la src/pages/entrance/
ls -la src/data/meta/entrance_*.json
```

### ❌ やってはいけないこと（DO NOT）
1. ❌ 上記以外のコード記述
2. ❌ entrance/index.html の変更
3. ❌ CSSやJSの実際のコード記述
4. ❌ プランの再解釈や独自の最適化

## 概要

`entrance/index.html`（約4000行）をジョブ別に分割し、保守性を向上させる。

---

## 1. 現状分析

### ファイル構成
- **entrance/index.html**: 4000行の巨大ファイル、全82関数
- **重複なし確認済み**: `staff/os/reports.html`はリスト表示ページ（ウィザードではない）

### 関数分類

| カテゴリ | 関数数 | 説明 |
|----------|--------|------|
| SHARED | 37 | 全ジョブ共通（認証、チャット、AI） |
| SALES | 19 | 営業専用（依頼書ウィザード） |
| CLEANING | 20 | 清掃専用（日報ウィザード） |
| OFFICE | 1 | 事務専用（未実装） |
| HR/ACCOUNTING/ADMIN/DEV | 0 | 固有機能なし |

---

## 2. 新ディレクトリ構造

```
src/pages/entrance/
├── index.html              ← 軽量化：ログイン + ジョブ選択のみ
├── shared/
│   ├── css/
│   │   └── entrance-common.css
│   └── js/
│       ├── auth.js
│       ├── chat-log.js
│       ├── misogi-core.js
│       └── visualizer.js
├── cleaning/
│   └── index.html
├── office/
│   └── index.html
├── sales/
│   └── index.html
├── admin/
│   └── index.html
├── hr/
│   └── index.html
├── accounting/
│   └── index.html
└── dev/
    └── index.html
```

---

## 3. 実装手順（Gemini用）

### Step 1: ディレクトリ作成
```bash
mkdir -p src/pages/entrance/shared/css
mkdir -p src/pages/entrance/shared/js
mkdir -p src/pages/entrance/cleaning
mkdir -p src/pages/entrance/office
mkdir -p src/pages/entrance/sales
mkdir -p src/pages/entrance/admin
mkdir -p src/pages/entrance/hr
mkdir -p src/pages/entrance/accounting
mkdir -p src/pages/entrance/dev
```

### Step 2: 共通CSS抽出
`entrance/index.html` から以下のスタイルを `shared/css/entrance-common.css` に移動:
- 行 7-1601: 全てのCSS（`<style>`タグ内）
- ジョブカラー変数（`.job-cleaning`, `.job-sales` 等）
- ビジュアライザースタイル
- チャットログスタイル
- アニメーション定義

### Step 3: 共通JS抽出

#### shared/js/auth.js
以下の関数を移動:
- `ensureAuthOrRedirect()` (行1630)
- `performLogin()` (行1789)
- `performClockIn()` (行1820)
- `performBreakStart()` (行1869)
- `performBreakEnd()` (行1892)
- `performClockOut()` (行1914)

#### shared/js/chat-log.js
以下の関数を移動:
- `appendChatMessage()` (行1960)
- `writeLog()` (行2003)
- `renderChatLog()` (行2016)
- `filterChatLog()` (行2050)
- `toggleChatLog()` (行2061)
- `expandChatLog()` (行2069)
- `openTeamChat()` (行2103)
- `closeTeamChat()` (行2147)
- `switchChatChannel()` (行2157)
- `openChannelPicker()` (行2192)
- `loadTeamMessages()` (行2213)
- `sendTeamMessage()` (行2254)
- `sendInlineTeamMessage()` (行2290)
- `initChatLogInteractions()` (行2345)
- `saveChatLogState()` (行2431)

#### shared/js/misogi-core.js
以下の関数を移動:
- `sendTextMessage()` (行2448)
- `handleAiResponse()` (行2534)
- `handleAiCommands()` (行2653)
- `submitQuickReply()` (行2725)
- `renderActionButtons()` (行2732)
- JOB_TYPES, CHAT_CHANNELS 定数

#### shared/js/visualizer.js
以下の関数を移動:
- `initWaterMorph()` (行1615)
- `switchMode()` (行1938)
- ビジュアライザークリックイベント (行3037-3072)

### Step 4: ジョブ別ページ作成

#### cleaning/index.html
- 共通モジュールを読み込む
- 清掃専用関数（20個）を含める:
  - `startReportWizard()` (行3447)
  - `fetchTodaySchedules()` (行3460)
  - ...（その他18関数）

#### sales/index.html
- 共通モジュールを読み込む
- 営業専用関数（19個）を含める:
  - `startRequestWizard()` (行3073)
  - ...

#### その他のジョブページ
- 共通モジュールを読み込む
- `showJobActions()` で定義されたボタンリンクのみ
- 固有のウィザードなし

### Step 5: entrance/index.html 軽量化
1. 共通モジュールを `<script src>` と `<link>` で読み込む
2. ジョブ固有コードを削除
3. `selectJobType()` を修正してリダイレクト:
```javascript
function selectJobType(jobKey) {
    localStorage.setItem('current_job_type', jobKey);
    window.location.href = `/entrance/${jobKey}/`;
}
```

### Step 6: 不要ファイル削除
移植完了後、以下を確認して削除:
- 古いインラインコード（entrance/index.htmlから削除された部分）
- 重複するスタイル定義

---

## 4. 各ジョブページのテンプレート

```html
@layout('layouts.admin')
@json('data/meta/entrance_[JOB]_title.json', $title)
@json('data/meta/entrance_[JOB]_body_class.json', $body_class)

<link rel="stylesheet" href="/entrance/shared/css/entrance-common.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js"></script>

<!-- 共通HTML構造 (visualizer, chat-log等) -->
@include('partials.entrance-common')

<script src="/entrance/shared/js/auth.js"></script>
<script src="/entrance/shared/js/chat-log.js"></script>
<script src="/entrance/shared/js/misogi-core.js"></script>
<script src="/entrance/shared/js/visualizer.js"></script>

<script>
    // ジョブ固有のコード
    const currentJobType = '[JOB]';
    
    // [JOB]専用のウィザード関数（必要な場合のみ）
</script>
```

---

## 5. 注意事項

1. **API_BASE定数**: 各モジュールで使用するため、グローバルに定義しておく
2. **localStorage**: 認証トークンは全ページで共有される（変更不要）
3. **ビルドスクリプト**: `scripts/build.py` は自動的に新ディレクトリを処理する
4. **テスト**: 各ステップ後にビルドして動作確認

---

## 6. 関数の詳細分類

### SHARED（37関数）
```
handleImageSelect (1604)
initWaterMorph (1615)
ensureAuthOrRedirect (1630)
startWorkflow (1662)
performLogin (1789)
performClockIn (1820)
performBreakStart (1869)
performBreakEnd (1892)
performClockOut (1914)
switchMode (1938)
appendChatMessage (1960)
writeLog (2003)
renderChatLog (2016)
filterChatLog (2050)
toggleChatLog (2061)
expandChatLog (2069)
openTeamChat (2103)
closeTeamChat (2147)
switchChatChannel (2157)
hexToRgb (2186)
openChannelPicker (2192)
loadTeamMessages (2213)
sendTeamMessage (2254)
logEvent (2285)
sendInlineTeamMessage (2290)
initChatLogInteractions (2345)
saveChatLogState (2431)
sendTextMessage (2448)
handleAiResponse (2534)
handleAiCommands (2653)
submitQuickReply (2725)
renderActionButtons (2732)
showJobSelection (2824)
selectJobType (2852)
showJobActions (2940)
filterSidebar (2992)
requestJobChange (3024)
```

### SALES（19関数）
```
startRequestWizard (3073)
showRequestWizardStep (3085)
renderCustomerSelect (3113)
renderCustomerListItems (3163)
filterCustomerList (3198)
handleWizardInput (3218)
renderTextInput (3226)
renderMultiSelect (3243)
renderSingleSelect (3268)
renderConfirm (3285)
selectCustomer (3307)
selectNewCustomer (3325)
submitWizardText (3329)
skipWizardStep (3338)
toggleMultiOption (3342)
submitMultiSelect (3353)
submitSingleSelect (3362)
finishRequestWizard (3369)
cancelRequestWizard (3424)
```

### CLEANING（20関数）
```
startReportWizard (3447)
fetchTodaySchedules (3460)
showScheduleSelection (3485)
showManualStoreInput (3523)
selectScheduleForReport (3531)
proceedToPhotoUpload (3539)
showPhotoUploadUI (3547)
handleReportPhotoUpload (3585)
updatePhotoCount (3601)
proceedToReportDetails (3617)
showCleaningTargetSelection (3628)
selectCleaningTarget (3652)
submitReport (3666)
window.sendTextMessage (3746) ← 上書き
showNextProposalTiming (3778)
selectNextProposalTiming (3812)
showNextProposalWork (3833)
selectNextProposalWork (3864)
showReportConfirmation (3870)
showConfirmButtons (3888)
openReportPreview (3916)
```

### OFFICE（1関数）
```
startWorkOrderWizard (3945) ← 未実装
```

---

## 7. 完了条件

- [ ] 7つのジョブディレクトリが作成されている
- [ ] 共通モジュールが `shared/` に抽出されている
- [ ] 各ジョブページが独立して動作する
- [ ] `entrance/index.html` がログイン+ジョブ選択のみになっている
- [ ] ビルドが成功する
- [ ] 各ジョブでログイン→業務開始が可能

---

作成者: Claude (Opus)
実行者: Gemini
