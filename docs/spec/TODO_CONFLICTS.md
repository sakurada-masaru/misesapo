# TODO Conflicts (Line System Rules)

## P0 (must fix first)
- Field UI still contains narrative inputs and AI-guided chat in `src/pages/entrance/cleaning/index.html` and `src/pages/staff/os/reports/new.html`; must be unified to 3 taps + checklist + exception flags with free text hidden by default.
- Non-sales pages still call `/ai/process` (example: `src/pages/entrance/cleaning/index.html`, `src/pages/staff/daily-reports.html`); these calls must be removed or disabled per AI policy.

## P1
- Approval log requires `reason_code`, but current logging uses only `review_comment` in `lambda_function.py`; add reason_code collection + storage.
- Approval actions should require reason_code for approve/return/reject before status update; enforcement is missing in current handlers.
