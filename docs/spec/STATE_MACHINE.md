# State Machine (Line System)

## Scope
This state machine defines the canonical flow for staff reports in the line system. Normal cases must flow without stopping. Only exceptions may stop.

## Roles
- Field: arrival/start/end, checklist, exception flags
- QA: approve, return, route-to-exception
- Finance: pay ok, hold, return

## States (canonical)
- draft: record created, no field action yet
- in_progress: arrival/start has begun
- completed: end tapped, checklist done
- submitted: sent to QA gate
- qa_approved: QA approved normal case
- qa_returned: QA returned to field (exception or correction)
- finance_approved: Finance approved (payment ok)
- finance_returned: Finance returned to QA/field
- exception_review: manual review route (only for exception flags)

## Allowed transitions
| From | Event | To | Actor |
| --- | --- | --- | --- |
| draft | arrival | in_progress | Field |
| in_progress | end + checklist | completed | Field |
| completed | submit | submitted | Field |
| submitted | approve | qa_approved | QA |
| submitted | route_to_exception | exception_review | QA |
| submitted | return | qa_returned | QA |
| qa_returned | resubmit | submitted | Field |
| exception_review | approve | qa_approved | QA |
| qa_approved | approve | finance_approved | Finance |
| qa_approved | return | finance_returned | Finance |
| finance_returned | resubmit | submitted | QA/Field |

## Rules
- Returns are logged as approval events (approval log), not only status changes.
- Only QA/Finance can move approval gates.
- Normal cases must not require manual edits to generate the certificate.
