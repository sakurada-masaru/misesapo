# Approval Log (staff-report-approvals)

## Purpose
Every approval/return/rejection must leave an immutable audit log with a reviewed snapshot.

## Table
- Table name: staff-report-approvals
- Partition key: report_id (string)
- Sort key: reviewed_at (string, ISO8601 UTC)

## Required fields
- approval_id (string)
- report_id (string)
- reviewed_at (string, ISO8601 UTC)
- reviewer_id (string)
- reviewer_name (string)
- reviewer_role (string)
- decision (string: approved | rejected | revision_requested | return)
- reason_code (string)
- report_status_before (string)
- report_status_after (string)
- reviewed_snapshot_json (string, JSON)
- reviewed_snapshot_hash (string, sha256)

## Snapshot rule
- reviewed_snapshot_json must be built from the exact record reviewed.
- reviewed_snapshot_hash = sha256(reviewed_snapshot_json).

## Mandatory sequence
1) build reviewed_snapshot_json
2) compute snapshot hash
3) write approval log
4) update main record status

## Notes
- Free text is not a source of truth. It is optional and only for exception notes.
- reason_code is mandatory for approvals, returns, and rejections.
