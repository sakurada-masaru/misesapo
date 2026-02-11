# 業務報告（管理）テスト報告書 作成・取得確認

## 実行日時

- 実行: 2026-01-31（Cursor 実行時）

---

## 1) PUT /work-report（テスト報告 1 件作成）

### 実行コマンド

```bash
BASE_PROD="https://1x0f73dj2l.execute-api.ap-northeast-1.amazonaws.com/prod"
AUTH="Authorization: Bearer $(cat ~/.cognito_token)"
DATE="2026-01-31"

curl -sS -i -X PUT "$BASE_PROD/work-report" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{
    "date":"'"$DATE"'",
    "template_id":"ENGINEERING_V1",
    "target_label":"test-store-001",
    "work_minutes":12,
    "state":"submitted",
    "description":{
      "summary":"（テスト）管理一覧表示確認",
      "issues":"（テスト）課題欄の表示と省略確認",
      "notes":"（テスト）検索対象メモ"
    },
    "attachments":[
      "https://example.com/test-a.jpg",
      "https://example.com/test-b.jpg"
    ]
  }'
```

### 結果

| 項目 | 値 |
|------|-----|
| **HTTP ステータス** | **401 Unauthorized** |
| **原因** | トークン期限切れ（`The incoming token has expired`） |

### レスポンス本文（全文）

```json
{"message":"The incoming token has expired"}
```

### ヘッダ（抜粋）

- `x-amzn-errortype: UnauthorizedException`
- `access-control-allow-methods: GET,PUT,POST,DELETE,OPTIONS`  
  → PUT は許可されている（メソッド・パスは問題なし）

**結論**: PUT のパス・メソッド・ボディは API 仕様と一致している。**`~/.cognito_token` を有効な Cognito ID Token に更新して再実行すれば作成できる想定。**

---

## 2) GET /work-report?date=...（同日の一覧取得）

### 実行コマンド

```bash
curl -sS -i -X GET "$BASE_PROD/work-report?date=$DATE" -H "$AUTH"
```

### 結果

| 項目 | 値 |
|------|-----|
| **HTTP ステータス** | **401 Unauthorized** |
| **原因** | 上記と同様、トークン期限切れ |

### レスポンス本文

```json
{"message":"The incoming token has expired"}
```

**結論**: GET のパス・クエリは問題なし。トークン更新後に再実行すれば、作成した `target_label:"test-store-001"` が一覧に含まれるか確認できる。

---

## 3) 次のアクション（トークン更新後の再実行）

1. **Cognito ID Token を更新**  
   - ログイン画面から再ログインするか、Refresh Token で ID Token を再取得する。  
   - 取得した ID Token を `~/.cognito_token` に保存する。

2. **同じコマンドで再実行**  
   - 下記 `scripts/create-and-fetch-work-report.sh` を実行するか、  
   - 本ドキュメントの「実行コマンド」をそのままターミナルで再実行する。

3. **期待する結果（トークン有効時）**  
   - **PUT**: HTTP 200、レスポンス本文に `log_id` 等が含まれる。  
   - **GET**: HTTP 200、JSON 配列の中に `target_label: "test-store-001"` の要素が 1 件含まれる。

---

## 4) safeJsonParse 確認用（任意・壊れた description の 1 件）

トークン更新後、以下のように `description` を壊した JSON で **別 1 件** を作成すると、  
一覧・詳細で safeJsonParse が効いて落ちないことを確認できる。

```bash
# 上記 PUT の -d 内の "description": { ... } を次に差し替えて PUT を再実行
"description":"{broken json"
```

- 期待: PUT は 200 で作成される（API が description を文字列のまま保存する場合）。  
- フロント: 一覧・詳細モーダルで `description` を safeJsonParse すると `{}` となり、画面が落ちない。

---

## 5) PUT が 405/400/500 だった場合の対応（今回の 401 以外用）

- **405 Method Not Allowed**  
  → 実装が POST のみの可能性。`-X POST` で同じボディを送って再試行。  
- **400 Bad Request**  
  → レスポンス本文の必須項目・形式を確認し、`date` / `template_id` / `state` 等を合わせる。  
- **500 Internal Server Error**  
  → レスポンス本文を共有してもらえれば、API 実装に合わせて正しい作成手順（POST/別パス/必須項目）に書き換える。

今回の 401 の場合は上記いずれにも該当せず、**トークン更新のみ**で再実行すればよい。
