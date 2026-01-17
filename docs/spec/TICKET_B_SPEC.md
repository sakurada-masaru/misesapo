# Ticket B Spec (Entrance Line System)

## Goal
- Implement line operation from entrance with a single button.
- Normal cases flow through and auto-generate execution certificate.
- Exceptions stop and require approval.
- Daily report tab remains unchanged.
- UI layout must not be broken.

## 1) Entrance Additions (UI)
- Element: one button
- Text: "実施証明ラインを開始"
- Location: entrance main action area (top section of the entrance dashboard, near primary actions)
- States:
  - Default: enabled
  - If already in progress: disabled with label "進行中"
  - If exception pending: disabled with label "承認待ち"

## 2) Destination and Responsibility
- Route: /staff/os/reports/new
- Screen responsibility:
  - Line input only (arrival/start/end + scope checklist + exception flag)
  - No narrative input in normal cases
  - Exception details only when exception flag is on

## 3) 3-Tap Definition
- Arrival tap: records arrival_time
- Start tap: records cleaning_start_time
- End tap: records cleaning_end_time
- Normal case:
  - exception_flag = none
  - flow continues to auto-generate execution certificate
- Exception case:
  - exception_flag != none
  - requires reason_code if exception_flag = unfinished
  - stops at approval gate

## 4) Data Contract (API I/O)
- Endpoint: PUT /staff/reports/{report_id}
- Required headers:
  - Authorization: Bearer ID_TOKEN
  - Content-Type: application/json
- Payload (line UI -> server):
  - report_id
  - schedule_id
  - arrival_time
  - cleaning_start_time
  - cleaning_end_time
  - scope_checks (array of item ids)
  - exception_flag (none, unfinished, photo_required, proposal_required)
  - reason_code (required when exception_flag = unfinished)
  - reason_text (optional short note)
- Response:
  - 200 success with updated report object
  - 400 when required fields or scope_checks validation fails

## 5) Payload Definition (Line UI)
{
  "report_id": "string",
  "schedule_id": "string",
  "arrival_time": "HH:MM",
  "cleaning_start_time": "HH:MM",
  "cleaning_end_time": "HH:MM",
  "scope_checks": ["item_id_1", "item_id_2"],
  "exception_flag": "none|unfinished|photo_required|proposal_required",
  "reason_code": "string",
  "reason_text": "string"
}

## 6) Scope Check Validation (Server)
- Validate scope_checks against allowed items for the schedule.
- If any item is outside the allowed list: 400.

## 7) Exception Approval Flow
- If exception_flag != none:
  - status -> pending_approval
  - approval request is created
  - normal flow is stopped
- Approval result:
  - approved -> allow line to pass
  - rejected/return -> stay stopped with reason_code

## 8) State Machine (Only exceptions stop)
- Normal:
  - in_progress -> completed -> auto_generate_certificate -> done
- Exception:
  - in_progress -> completed -> pending_approval (stop)
  - pending_approval -> approved -> auto_generate_certificate -> done
  - pending_approval -> return -> pending_approval

## 9) Approval Log
- DynamoDB table: staff-report-approvals
- Required fields:
  - report_id
  - reviewed_at
  - reviewer_id
  - decision
  - reason_code
  - reviewed_snapshot_hash

## 10) DoD / Acceptance Tests
- Entrance button exists and routes to /staff/os/reports/new
- Normal case:
  - 3 taps + scope checks only
  - no narrative input visible
  - flow completes and certificate is generated
- Exception case:
  - exception_flag on stops flow
  - reason_code required for unfinished
  - approval log written with reason_code and snapshot hash

## 11) Implementation Checklist for Antigravity
- Entrance button added with correct states
- Line UI collects 3 taps + scope_checks + exception_flag
- Exception fields are hidden unless exception_flag is on
- Payload matches contract
- Server validates scope_checks, returns 400 on invalid
- Exception flow stops at approval gate
- Approval log writes reason_code and reviewed_snapshot_hash

## 12) UI Non-Disruption Definition
- No layout shifts outside the new button.
- No styling changes to existing tabs.
- Daily report tab unchanged.

## 13) Prohibited Items
- No free text narrative or evaluation inputs
- No new AI guidance for non-sales
- Do not modify /ai/process usage
- Do not stop normal cases
