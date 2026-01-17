# AI Policy (Action Map)

## Allowed usage
- Formatting / summarizing / template-fill only
- Structured extraction for Sales (JSON output only)

## Forbidden usage
- Guided chat for field workers
- AI judgement or evaluation
- Free-text proposal generation
- AI-based approvals

## /ai/process actions
| Action | Policy | Output | Notes |
| --- | --- | --- | --- |
| suggest_request_form | ALLOWED (Sales only) | JSON (schema required) | Must validate JSON schema before use |
| suggest_estimate | ALLOWED (Sales only) | JSON (schema required) | Must validate JSON schema before use |
| any_other_action | DISABLED | n/a | Reject with action_disabled |

## Implementation rules
- Unknown actions must be rejected.
- Non-sales pages must not call /ai/process.
- AI output must not become source of truth without validation.
