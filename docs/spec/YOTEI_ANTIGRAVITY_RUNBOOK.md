# アンチグラビティ向け実行手順（YOTEI Phase1 / 日本語OS準拠）

## 0. 目的

`/yotei` で予定作成が通ることを実データで検証する。旧 `/schedules` は使わない。

## 1. 前提

- API反映済み
- 対象環境URL確定
- Bearerトークンあり
- TZは `+09:00`

## 2. データ形式（必須）

1行1件、最低これだけ必要：

- `sagyouin_id`
- `tenpo_id`
- `start_at`（`YYYY-MM-DDTHH:mm:ss+09:00`）
- `end_at`（同上）
- `jotai`（`yuko` or `torikeshi`）※空なら `yuko`

任意：

- `shigoto_id`, `memo`, `origin`

## 3. 事前正規化ルール

- `cancelled` は `torikeshi` に変換
- 空の `jotai` は `yuko`
- `start_at < end_at` 必須
- 重複判定対象は `jotai=yuko` のみ
- 同一 `sagyouin_id` の重複候補は事前に印をつける

## 4. テストケース（最低）

1. 正常作成 3件（重複なし）
2. 重複作成 2件（同一sagyouinで時間重なり）
3. `torikeshi` 後に再作成 1件（同時間で通ること）

## 5. 実行コマンド（例）

```bash
BASE_PROD="https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod"
AUTH="Authorization: Bearer $(cat ~/.cognito_token)"

# 一覧
curl -sS -i -H "$AUTH" "$BASE_PROD/yotei?limit=5"

# 作成（正常）
curl -sS -i -X POST "$BASE_PROD/yotei" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{
    "start_at":"2026-02-09T01:00:00+09:00",
    "end_at":"2026-02-09T02:00:00+09:00",
    "sagyouin_id":"SAGYOUIN#W002",
    "tenpo_id":"TENPO#S010",
    "jotai":"yuko"
  }'
```

## 6. 判定基準

- 成功: `201`
- 重複: `409` かつ `error=yotei_conflict` と `conflicts[]`
- 取消: `DELETE /yotei/{id}` 後に `jotai=torikeshi`（物理削除はしない）

## 7. 報告フォーマット

- 投入件数:
- 成功件数:
- 409件数:
- 想定外エラー件数:
- 問題ID一覧:
- 所感（運用上の懸念）:

## 8. 追加確認（任意）

- `409` の `conflicts[]` に `id/start_at/end_at` が入っているか
- `DELETE` した予定が重複判定から外れるか（`torikeshi` は無視されるか）
