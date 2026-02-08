# Schedule V2 Data Model & Conflict Management Specification

## 1. Overview
The goal of the Schedule V2 redesign is to ensure a robust, scalable, and conflict-free scheduling system. 
This specification shifts the ultimate responsibility for conflict detection to the Backend (API/Lambda) while maintaining a high-fidelity preview on the Frontend.

## 2. Core Principles
- **Canonical ID**: `worker_id` is the primary identifier for all human resources. 
- **Single Source of Truth**: The API (Lambda) is the final authority on Whether a schedule can be saved (HTTP 409 Conflict).
- **Time Event Unification**: Both schedules (jobs) and blocks (availability/closures) are treated as "Time Events" for overlap calculation.

## 3. Data Model

### A. Schedules (Jobs)
Stored in the `schedules` table. Represents an assigned cleaning or maintenance job at a specific location.

| Field | Type | Description |
|-------|------|-------------|
| `schedule_id` | String (PK) | Unique ID for the job. |
| `worker_id` | String | Canonical worker ID (e.g., "W002"). **Must match DB master.** |
| `start_at` | ISO-8601 | Start datetime. |
| `end_at` | ISO-8601 | End datetime. |
| `store_id` | String | Foreign key to `misesapo-stores`. |
| `status` | String | `booked`, `in_progress`, `done`, etc. |
| `event_type` | String | Fixed to `"job"`. |

**Index Requirements:**
- **GSI_worker_time**: 
    - Partition Key: `worker_id`
    - Sort Key: `start_at#schedule_id`

### B. Blocks (Availability/Closures)
Stored in the `blocks` (or `worker-availability`) table. Represents periods where a worker or the whole company is unavailable.

| Field | Type | Description |
|-------|------|-------------|
| `block_id` | String (PK) | Unique ID for the block. |
| `scope` | String | `"personal"`, `"global"`, or `"team"`. |
| `block_type` | String | `"availability"` (Shift/Plan), `"company_close"`, `"quick_block"`. |
| `owner_worker_id` | String | Worker ID for `"personal"`. Use `"GLOBAL"` for `"global"` scope. |
| `start_at` | ISO-8601 | Start datetime. |
| `end_at` | ISO-8601 | End datetime. |

**Index Requirements:**
- **GSI_owner_time**:
    - Partition Key: `owner_worker_id`
    - Sort Key: `start_at#block_id`

## 4. Conflict Detection Logic (Server-Side)
When a `PUT` or `POST` request is made to `/schedules`:

1.  **Retrieve Overlap Candidates**:
    - Query `schedules.GSI_worker_time` for the target `worker_id` within the time range.
    - Query `blocks.GSI_owner_time` where `owner_worker_id` is `target_worker_id` OR `"GLOBAL"`.
2.  **Overlap Calculation**:
    - `candidate.start < existing.end` AND `candidate.end > existing.start`
3.  **Result**:
    - If overlaps found: Return `409 Conflict` with `error_code: "worker_unavailable"` and detail of the conflict.
    - If no overlaps: Proceed with DB update.

## 5. UI/UX (Frontend) Implementation
- **Normalization**: `useAuth.js` and all API callers must ensure `worker_id` is used, mapping from Cognito's `sub` or `id` attributes at the boundary.
- **Pre-check**: Use `detectConflictsBeforeSave` purely for UX (showing warnings/tooltips).
- **Graceful Handling**: Interpret 409 responses and display the specific conflicting event (e.g., "Conflict with Company Holiday: 2026-02-11").
