# Schedule V2 Conflict Resolution & UI Behavior

## 1. Overlap Definition (The Boundary Rules)
To prevent common "one minute overlap" edge cases, we define the standard for overlap as:

```javascript
// Strict overlap (Standard)
function isOverlapping(A_start, A_end, B_start, B_end) {
    return A_start < B_end && B_start < A_end;
}
```

- **Touching is NOT an overlap**: If Job A ends at 10:00 and Job B starts at 10:00, they are VALID.
- **Buffer handling**: The V2 design does not enforce a minimum buffer at the DB level, but the UI should visually suggest transit time gaps.

## 2. API Response: HTTP 409 Structure
The Lambda must return a structured JSON when a conflict is detected to help the UI explain the situation.

```json
{
  "status": 409,
  "error": "Conflict",
  "code": "worker_unavailable",
  "message": "担当者が対応不可の時間帯です",
  "conflict_details": {
    "type": "block",
    "block_type": "availability",
    "scope": "personal",
    "event_id": "B#123",
    "start_at": "2026-02-08T09:00:00",
    "end_at": "2026-02-08T12:00:00",
    "summary": "午前休み（事前申告）"
  }
}
```

## 3. UI/UX Flow for Conflicts

### Step 1: Frontend Warning (Optional but Recommended)
- While editing on the timeline, call `detectConflictsBeforeSave` locally.
- Color the card/slot in red if a local conflict is detected.

### Step 2: Saving Attempt
- Call API `POST /schedules` or `PUT /schedules/{id}`.
- Show a "Saving..." loading state.

### Step 3: Handling 409
- If API returns 409, extract `conflict_details`.
- Display a modal or toast: `"保存できませんでした。担当者Aさんは 9:00〜12:00 に「午前休み」が登録されています。"`。
- **Action**: Provide a "Force Save" option only for SUPERADMINs (overriding the 409 check using a special flag in the request), otherwise prompt the user to change the time.

## 4. Normalization Rules
Ensure that the `worker_id` retrieved from the authentication context is the primary key for all lookups.

- **Check**: Before sending any `worker_id` to the API, verify it starts with "W" (or follow the standard set in the `workers` master).
- **Fallback**: If `worker_id` is missing, prevent save and prompt for user profile verification.
