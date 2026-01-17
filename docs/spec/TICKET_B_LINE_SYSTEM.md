# チケットB: ラインシステム仕様書（B確定版）

## 目的
工程通過→自動実施証明生成のライン運用を、entrance起点（ボタン追加）で実現する。
- 日報タブは会社向け日報として現状維持
- UIは崩さず、例外だけ止める
- Ticket B は entrance を業務ラインの唯一の入口として構築する
- /line/ は entrance から遷移する内部画面である
- 状態 進行中 承認待ちは必ず entrance に反映される
- 本仕様はB確定版として運用し、以降再議論しない

---

## 1. Entranceへの追加要素

### 1.1 ボタン定義

| 項目 | 値 |
|------|-----|
| 文言 | `ライン開始` / `進行中` / `承認待ち` |
| 表示位置 | `cleaning` モードの job-actions 先頭 |
| スタイル | `primary: true`（既存アクセントカラー使用） |
| 表示条件 | `jobKey === 'cleaning'` の場合のみ |

### 1.2 ボタン状態判定ルール

**判定方法**: 当日（または最新）のline対象reportのstatusを取得して決定

| report.status | ボタン表示 | 動作 |
|---------------|-----------|------|
| `in_progress` | 「進行中」 | 既存のラインUIへ遷移（途中再開） |
| `pending_approval` | 「承認待ち」 | 承認待ち画面表示（操作不可） |
| その他（なし含む） | 「ライン開始」(enabled) | 新規ライン開始 |

**API**: `GET /line/status?worker_id={id}&date={YYYY-MM-DD}`

### 1.3 既存UIへの影響
- 日報タブ: **変更なし**
- レイアウト: ボタン1つ追加のみ（最小差分）
- 他のモード（sales, office, hr, accounting, admin, dev）: **変更なし**

---

## 2. 遷移先

### 2.1 ルート定義

| 項目 | 値 |
|------|-----|
| パス | `/staff/os/reports/new` |
| ファイル | `src/pages/staff/os/reports/new.html` |
| 責務 | 3タップで工程通過を完了するUI |

### 2.2 画面責務
1. 当日/割当の工程を表示（範囲外は出さない）
2. schedule.cleaning_items または工程定義に紐づくチェック項目のみ表示（範囲外はUIに出さない、自由記述なし）
3. 通過処理の実行

---

## 3. 3タップフロー定義

```
[タップ1] 工程選択
    ↓
[タップ2] チェック項目確認・例外フラグ設定
    ↓
[タップ3] 通過（完了）
```

### 3.1 通常フロー（例外フラグOFF）

```
工程選択 → チェック完了 → 通過
    ↓
止めずにそのまま通過
    ↓
実施証明を自動生成
    ↓
完了画面表示
```

### 3.2 例外フロー（例外フラグON）

```
工程選択 → チェック完了 → 例外フラグON
    ↓
reason_code選択必須（全例外で必須、例外種別による分岐なし）
    ↓
承認待ち状態で停止
    ↓
（管理者承認後）通過可能
```

---

## 4. データ契約（API I/O）

### 4.1 ラインUI → API（POST /line/pass）

**リクエスト**
```json
{
  "process_id": "PROC-20260117-001",
  "worker_id": "4704ca58-f071-70ac-9b9b-24780df173db",
  "check_results": [
    { "item_id": "CHK001", "passed": true },
    { "item_id": "CHK002", "passed": true }
  ],
  "exception_flag": "none",
  "reason_code": null
}
```

> **注意**: `reason_text` / メモ欄 / コメント欄は**一切持たない**。理由は`reason_code`のみ。

**レスポンス（通常）**
```json
{
  "status": "passed",
  "certificate_id": "CERT-20260117-001",
  "message": "工程を通過しました"
}
```

**レスポンス（例外）**
```json
{
  "status": "pending_approval",
  "approval_request_id": "APR_xxxxx",
  "message": "承認待ちです"
}
```

### 4.2 範囲チェック（サーバ側バリデーション）

#### 4.2.1 許可リスト参照元

| データソース | 用途 |
|-------------|------|
| `schedules` テーブル | 当日の割当工程一覧（`process_id`の有効性確認） |
| `schedules.cleaning_items` | 工程に紐づくチェック項目の許可リスト（`item_id`の範囲確認） |

#### 4.2.2 バリデーションルール

| 条件 | 結果 |
|------|------|
| `process_id`が当日/割当外 | `400 Bad Request` |
| `check_results`に工程定義外の`item_id`が**1件でも**含まれる | `400 Bad Request` |
| `exception_flag != none` かつ `reason_code` が空 | `400 Bad Request` |

> **重要**: 1件でも範囲外があれば即座に400で落とす。部分的な受け入れはしない。

**エラーレスポンス例**
```json
{
  "error": "out_of_scope",
  "message": "指定された項目は工程定義に含まれていません",
  "invalid_items": ["CHK999"]
}
```

### 4.3 承認API（既存を流用）

**エンドポイント**: `PUT /staff/reports/{id}`

**リクエスト**
```json
{
  "status": "approved",
  "reason_code": "OK_STANDARD"
}
```

**バリデーション**
- `reason_code` **必須**（なければ`400`）→ **既にOK**
- 例外種別による必須条件分岐は**作らない**（全例外で一律必須）

**承認ログ保存先**: `staff-report-approvals` テーブル
- `report_id`
- `reviewed_at`
- `reason_code`
- `reviewed_snapshot_hash`
- その他既存フィールド

---

## 5. 状態機械

```
┌─────────────────────────────────────────────────────────┐
│                    ライン通過フロー                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [開始] ──→ [工程選択] ──→ [チェック完了]               │
│                                  │                      │
│                    ┌─────────────┴─────────────┐        │
│                    ▼                           ▼        │
│              例外フラグOFF                例外フラグON   │
│                    │                           │        │
│                    ▼                           ▼        │
│              [即時通過]                [reason_code入力] │
│                    │                    (必須・分岐なし) │
│                    ▼                           │        │
│            [証明自動生成]                      ▼        │
│                    │                   [承認待ち停止]   │
│                    ▼                           │        │
│                [完了]              (管理者承認後)[通過]  │
│                                                │        │
│                                                ▼        │
│                                         [証明生成]      │
│                                                │        │
│                                                ▼        │
│                                             [完了]      │
└─────────────────────────────────────────────────────────┘
```

**重要**: 通常案件は**止めない**。例外のみ止める。

---

## 6. 受け入れテスト（DoD）

### 6.0 必須ゲート
- 通常通過 例外OFF で止めずに通過し 実施証明が生成される
- 例外ON で pending_approval に停止し entrance が 承認待ち を表示する
- 承認ログが DynamoDB staff-report-approvals に必須項目込みで保存される

### 6.1 必須チェックリスト

| # | テスト項目 | 期待結果 | 確認方法 |
|---|-----------|----------|----------|
| 1 | entranceに「ライン開始」ボタンが表示される | cleaningモードで表示 | ブラウザ目視 |
| 2 | ボタン状態がreport.statusに応じて変化する | in_progress→進行中、pending_approval→承認待ち | API+UI確認 |
| 3 | ボタン押下でラインUIへ遷移する | `/staff/os/reports/new`に遷移 | URL確認 |
| 4 | ラインUIは3タップで通常通過できる | 3タップで完了画面 | 操作確認 |
| 5 | 通過で実施証明が自動生成される | `certificate_id`発行 | APIレスポンス |
| 6 | 例外フラグON時のみ止まる | `status: pending_approval` | APIレスポンス |
| 7 | 例外時`reason_code`必須で承認待ち | 入力なしで進めない | UI確認 |
| 8 | 範囲外チェック項目はUIで出ない | 工程定義外は非表示 | UI確認 |
| 9 | 範囲外項目がAPIに送られたら400 | `400 Bad Request` | curl確認 |
| 10 | 承認ログがDynamoDBに保存される | テーブル確認 | AWS CLI |
| 11 | `reviewed_snapshot_hash`が記録される | ハッシュ値あり | クエリ確認 |
| 12 | 自由記述欄がUIに存在しない | メモ/コメント欄なし | UI目視 |
| 13 | payloadに`reason_text`等が含まれない | API仕様通り | Network確認 |

### 6.2 「UI崩さず」の定義
- ボタン1つ追加のみ（レイアウト変更最小）
- 日報タブは**一切変更しない**
- 既存のアクションボタン配置を維持

---

## 7. 禁止事項

| # | 禁止内容 | 理由 |
|---|---------|------|
| 1 | 自由記述（reason_text/メモ欄/コメント欄） | UI・Payloadともに一切持たない |
| 2 | 例外種別による必須条件分岐 | 全例外で reason_code 一律必須 |
| 3 | 非営業でのAI誘導追加 | 営業抽出JSON以外禁止 |
| 4 | `/ai/process`への接続追加 | 無効化済みを維持 |
| 5 | 通常案件を止める仕様 | 例外のみ停止 |
| 6 | 日報タブの変更 | 会社向け日報として現状維持 |
| 7 | 範囲外項目の部分受け入れ | 1件でも逸脱があれば400 |

---

## 8. 実装対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/pages/entrance/index.html` | 「ライン開始」ボタン追加、状態判定、`startLineSystem()`関数追加 |
| `src/pages/staff/os/reports/new.html` | ラインUI（自由記述なし） |
| `lambda_function.py` | `POST /line/pass`、`GET /line/status` エンドポイント追加、範囲バリデーション |
| DynamoDB | 証明テーブル（必要に応じて） |

---

## 9. reason_code 辞書

| コード | 説明 | 用途 |
|--------|------|------|
| `OK_STANDARD` | 標準承認 | 通常承認時 |
| `OK_EXCEPTION_APPROVED` | 例外承認 | 例外を承認する場合 |
| `NG_POLICY_VIOLATION` | ポリシー違反 | 却下時 |
| `RETURN_MISSING_REQUIRED_FIELDS` | 必須項目不足 | 差戻し時 |
| `RETURN_NEED_PHOTOS` | 写真不足 | 差戻し時 |
| `RETURN_SCOPE_MISMATCH` | 範囲不一致 | 差戻し時 |

---

## 10. scope_checks 許可リスト仕様

### 10.1 参照元

```
schedules テーブル
  └── id: "SCH-20260117-001"
  └── cleaning_items: [
        { "item_id": "CHK001", "name": "床清掃" },
        { "item_id": "CHK002", "name": "トイレ清掃" }
      ]
```

### 10.2 バリデーションフロー

```
1. リクエストの process_id から schedules レコードを取得
2. schedule.cleaning_items から許可 item_id リストを抽出
3. リクエストの check_results.item_id を全件チェック
4. 1件でも許可リストにないものがあれば → 400 Bad Request
5. UI側も同じ cleaning_items を取得し、範囲外項目は表示しない
```

---

## 変更履歴

| 日付 | 内容 | 担当 |
|------|------|------|
| 2026-01-17 | 初版作成 | Antigravity |
| 2026-01-17 | 4点反映：自由記述禁止、例外一律必須、ボタン状態判定、scope_checks参照元明記 | Antigravity |
