# 清掃員向け清掃スケジュール 操作フロー仕様書

## 1. 概要

### 1.1 目的

清掃員（および staff ロール）が「清掃スケジュール」画面で行える操作と、画面遷移・データの流れを定義する。

### 1.2 対象画面・URL

| 項目 | 値 |
|------|-----|
| 画面名 | 清掃スケジュール |
| URL | `/jobs/cleaning/schedule` |
| コンポーネント | `CleanerSchedulePage.jsx` |

### 1.3 権限

- **閲覧・操作可能**: ロール `cleaning` または `staff`
- **不可**: 上記以外は `/`（Portal）へリダイレクト

### 1.4 制約（清掃員の権限範囲）

- **案件（スケジュール）**: **閲覧のみ**。作成・編集・削除は不可。
- **ブロック（クローズ）**: **作成のみ**。編集・削除は管理側で行う想定。
- **カルテ**: 選択した案件に紐づく店舗カルテを**閲覧のみ**（`isLocked={true}`）。

---

## 2. 入口フロー

### 2.1 玄関からの到達経路

1. ユーザーが Portal（`/`）で「清掃」ジョブを選択
2. 清掃エントランス（`/jobs/cleaning/entrance`）でログイン／入室
3. ホットバー「**予定**」をタップ → `/jobs/cleaning/schedule` へ遷移

### 2.2 ホットバー構成（清掃エントランス）

| id | label | 役割 | 遷移先 |
|----|--------|------|--------|
| site | 店舗 | target | （未定義） |
| quality | 進捗 | status | （未定義） |
| **flow** | **予定** | plan | **/jobs/cleaning/schedule** |
| photo | 報告 | log | （未定義） |

### 2.3 初回表示時の処理順

1. **認証チェック**  
   - 未認証 or ロールが cleaning/staff 以外 → `/` へリダイレクト
2. **Worker 取得**  
   - `GET /api/workers` で一覧取得  
   - ログインユーザーの `user.email` と一致する worker を検索  
   - 一致した worker の `id`（または `worker_id` / `user_id`）を `workerId` として保持
3. **Worker 未取得時**  
   - 「清掃員情報の取得に失敗しました」を表示し、エントランスへ戻るリンクを表示
4. **スケジュール取得**  
   - `workerId` が確定後、`loadSchedules(workerId)` を実行（表示モードに応じた日付範囲で `GET /api/schedules`）
5. **ブロック取得**  
   - `loadBlocks(workerId)` を実行（`dateISO` 前後7日で `GET /api/blocks`）

---

## 3. 表示モードとナビゲーション

### 3.1 表示モード

| モード | view 値 | 説明 | ナビゲーション |
|--------|---------|------|----------------|
| 日別 | `day` | 1日分のタイムライン（0:00〜24:00、1時間刻み） | 前日 / 今日 / 翌日 |
| 週間 | `week` | 月曜〜日曜の7日分をカード表示 | 前週 / 今週 / 翌週 |
| 月間 | `month` | 当月カレンダー（日付クリックでその日へ移動） | 前月 / 今月 / 翌月 |

- ヘッダーの「表示」切替ボタン（日別・週・月アイコン）でモード変更。
- 日付・週・月の移動ボタンで `dateISO` を更新し、再取得が走る。

### 3.2 スケジュール取得パラメータ

- **日別**: `date_from = date_to = dateISO`
- **週間**: `date_from = その週の月曜`, `date_to = その週の日曜`
- **月間**: `date_from = 当月1日`, `date_to = 当月末日`
- 共通: `worker_id={workerId}`, `limit=1000`  
- API: `GET /api/schedules?date_from=...&date_to=...&worker_id=...&limit=1000`

### 3.3 ブロック取得

- 常に `dateISO` の **前後7日** で取得。  
- API: `GET /api/blocks?user_id=...&date_from=...&date_to=...&limit=1000`

---

## 4. 日別表示での操作フロー

### 4.1 タイムラインの構成

- 縦軸: 時間スロット（0:00〜24:00、1時間刻み）
- 各スロットに「案件（appointment）」または「ブロック（クローズ）」または「空き」が表示される

### 4.2 空きスロットの操作（ブロック作成）

1. **操作**: 空きスロットの「空き（タップでブロック作成）」を**クリック**または**右クリック**
2. **結果**: ブロック作成モーダル（`BlockCreateModal`）が開く
3. **初期値**: 開始＝そのスロットの先頭時刻、終了＝開始+1時間（最大24:00）

#### ブロック作成モーダルでの入力

| 項目 | 必須 | 説明 |
|------|------|------|
| 開始 | ○ | datetime-local（15分刻み） |
| 終了 | ○ | datetime-local（15分刻み）。開始 ≧ 終了の場合は「作成」不可 |
| 理由 | ○ | 睡眠 / 移動 / 私用 / その他（reason_code） |
| メモ | 任意 | テキスト（例: 病院） |

4. **作成ボタン押下時**  
   - **重複チェック**: `detectBlockConflicts()` で既存の案件・ブロックとの時間重複を検証  
   - 重複あり → モーダル内に「409 Conflict（重複のため登録できません）」＋詳細を表示し、API は呼ばない  
   - 重複なし → `POST /api/blocks` でブロック作成  
   - 成功時: ローカル state と localStorage を更新し、モーダルを閉じる  
   - 失敗時: モーダル内にエラーメッセージを表示

#### ブロック作成 API ペイロード

- `user_id`: 自分の workerId  
- `start_at` / `end_at`: ISO 8601（`YYYY-MM-DDTHH:mm:ss`）  
- `type`: `personal_close`  
- `reason_code`: 選択値（sleep / move / private / other）  
- `reason_note`: メモ（任意）  
- `visibility`: `admin_only`

### 4.3 案件（スケジュール）の操作（閲覧・カルテ表示）

1. **操作**: タイムライン上の案件カードを**クリック**
2. **結果**:  
   - 画面下部に **カルテ Dock** が表示される  
   - 選択した案件がハイライト（active）表示
3. **カルテ Dock**  
   - 左: 案件サマリ（店舗名・日付・時間・種別）＋店舗情報（店舗名・ブランド名・法人名・電話・キーボックス解錠番号など）  
   - 右: `OfficeClientKartePanel`（閲覧専用・`isLocked`）  
   - 店舗情報は `GET /api/stores/{store_id}` で取得
4. **Dock の閉じ方**  
   - ヘッダー右の「×」ボタンで閉じる  
   - Dock の高さは上部ヘッダーをドラッグで変更可能（200px〜画面高さ-100px）。高さは `localStorage` の `cleaner-schedule-karte-dock-height` に保存

---

## 5. 週間表示での操作フロー

- 7日分がカードで横並び（月〜日）。
- 各日のカード内に、その日の「案件」と「ブロック」が一覧表示される。
- **案件をクリック** → カルテ Dock が開き、選択した案件の店舗カルテを表示（日別と同様）。
- 週間表示では**ブロック作成はできない**（空きスロットのタップは日別表示のみ）。

---

## 6. 月間表示での操作フロー

- 当月のカレンダー（`MonthSimple`）を表示。
- **日付をクリック** → その日を `dateISO` に設定し、日別表示に切り替えた場合にその日が表示される（表示モードはそのまま。日付のみ変更）。
- 月間画面では日付クリックで「その日へ移動」するだけなので、ブロック作成やカルテ表示は、**日別または週間に切り替えて**行う。

---

## 7. データフロー一覧

| 操作 | トリガー | API / 処理 | 結果 |
|------|----------|------------|------|
| ページ表示 | マウント＋workerId 確定 | GET /workers, GET /schedules, GET /blocks | スケジュール・ブロック表示 |
| 表示切替 | 日/週/月ボタン | dateISO または範囲変更で loadSchedules 再実行 | 該当範囲の予定を再表示 |
| 日付移動 | 前日/翌日 等 | dateISO 更新 → loadSchedules / loadBlocks 再実行 | 該当日の予定を表示 |
| 空きタップ（日別） | クリック | モーダル表示 → 作成時 POST /blocks | ブロック追加表示 |
| 案件クリック | クリック | GET /stores/:id（store_id がある場合） | カルテ Dock 表示 |
| カルテ閉じる | × ボタン | なし | Dock 非表示 |
| Dock リサイズ | ドラッグ | localStorage に高さ保存 | 次回表示時に復元 |

---

## 8. エラー・異常系

| 状況 | 画面表示 | ユーザー操作 |
|------|----------|--------------|
| 未認証 | 認証が必要です ＋ エントランスへ戻るリンク | リンクで `/jobs/cleaning/entrance` へ |
| workerId 未取得 | 清掃員情報の取得に失敗しました ＋ 管理者へ連絡案内 ＋ エントランスへ戻る | リンクでエントランスへ |
| スケジュール取得失敗 | 空のタイムライン（または前回表示のまま） | 再読み込みや日付変更で再試行可能 |
| ブロック取得失敗 | localStorage のフォールバックを表示。API 失敗時はローカル保存分を使用 | 同上 |
| ブロック作成 409 | モーダル内に重複メッセージ表示 | 開始・終了時刻を変更して再実行 |
| ブロック作成 4xx/5xx | モーダル内に「ブロックの作成に失敗しました: ...」 | 内容を確認して再実行 or キャンセル |

---

## 9. 関連ファイル・API

### 9.1 フロントエンド

- `src/misogi/pages/jobs/cleaning/pages/CleanerSchedulePage.jsx` — メイン画面
- `src/misogi/pages/jobs/cleaning/entrance/hotbar.config.js` — 予定へのリンク
- `src/misogi/pages/shared/ui/BlockCreateModal/BlockCreateModal.jsx` — ブロック作成モーダル
- `src/misogi/pages/jobs/office/clients/OfficeClientKartePanel.jsx` — カルテ（閲覧専用で利用）
- `src/misogi/pages/shared/utils/scheduleConflicts.js` — ブロック重複検知
- `src/misogi/pages/app/router.jsx` — `/jobs/cleaning/schedule` ルート

### 9.2 API エンドポイント（想定）

| メソッド | パス | 用途 |
|----------|------|------|
| GET | /api/workers | 自分の workerId 取得用一覧 |
| GET | /api/schedules | 自分のスケジュール取得（date_from, date_to, worker_id） |
| GET | /api/blocks | 自分のブロック取得（user_id, date_from, date_to） |
| POST | /api/blocks | ブロック作成（personal_close） |
| GET | /api/stores/:id | カルテ用店舗詳細 |

---

## 10. 改訂履歴

| 日付 | 内容 |
|------|------|
| 2025-02-03 | 初版作成（CleanerSchedulePage 実装に基づく操作フロー仕様） |
