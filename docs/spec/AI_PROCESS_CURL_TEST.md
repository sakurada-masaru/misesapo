# /ai/process 動作確認（curl）

AI エンドポイントは **Cognito ID トークン必須**。未設定・不正の場合は 401。

## 前提

- `COGNITO_ID_TOKEN`: ブラウザの DevTools などで取得した ID トークン（`localStorage.getItem('cognito_id_token')` またはサインイン後の Bearer トークン）
- 本番 API: `https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod`

## 1) 認証ありで 200 が返ること

```bash
# トークンなし → 401 になること
curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d '{"action":"schedule_assistant","selected_schedule":null,"rolling_days":[],"visible_schedules":[]}' \
  "https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod/ai/process"
# 期待: 401

# トークンあり → 200 になること
curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $COGNITO_ID_TOKEN" \
  -d '{"action":"schedule_assistant","selected_schedule":null,"rolling_days":["2025-02-02"],"visible_schedules":[]}' \
  "https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod/ai/process"
# 期待: JSON body + 末尾に 200
```

## 2) action: schedule_assistant で JSON が返ること

```bash
export COGNITO_ID_TOKEN="<ここにIDトークンを貼る>"

curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $COGNITO_ID_TOKEN" \
  -d '{
    "action": "schedule_assistant",
    "selected_schedule": {"id":"a1","date":"2025-02-02","target_name":"A店","cleaner_id":"c1","start_min":540,"end_min":570},
    "rolling_days": ["2025-02-02","2025-02-03"],
    "visible_schedules": [
      {"id":"a1","date":"2025-02-02","target_name":"A店","cleaner_id":"c1","start_min":540,"end_min":570},
      {"id":"a2","date":"2025-02-02","target_name":"B店","cleaner_id":"c1","start_min":600,"end_min":630}
    ]
  }' \
  "https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod/ai/process"
```

期待するレスポンス例:

```json
{
  "status": "success",
  "result": {
    "overlaps": "同一担当 c1 が 2025-02-02 に A店 と B店 で重複",
    "congestion": "2025-02-02 に c1 が過密",
    "contact_deadline": "なし",
    "notes_summary": "特になし"
  }
}
```

## 3) /staff/ai/process も同一ハンドラ（フォールスルー）

```bash
curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $COGNITO_ID_TOKEN" \
  -d '{"action":"schedule_assistant","rolling_days":[],"visible_schedules":[]}' \
  "https://51bhoxkbxd.execute-api.ap-northeast-1.amazonaws.com/prod/staff/ai/process"
# 期待: 200（/ai/process と同じ handle_ai_process が動く）
```

## ローカル（API Gateway 経由で Lambda を叩く場合）

`localhost` や Vite の proxy で `/api` が Lambda に向いている場合:

```bash
curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $COGNITO_ID_TOKEN" \
  -d '{"action":"schedule_assistant","rolling_days":[],"visible_schedules":[]}' \
  "http://localhost:5173/api/ai/process"
```
