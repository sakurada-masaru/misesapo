# misesapo-new: Line System (Report-Line) Rules

## Product definition
This is NOT a report-writing tool.
This is a line system where reports are generated automatically as a byproduct of passing steps.

## Non-negotiable principles
1) Separate Fact / Interpretation / Responsibility (Approval)
2) Field staff must NOT write narratives, evaluations, or proposals
3) Normal cases must flow without stopping; only exceptions stop
4) Every approval must leave an audit log:
   - who, when, decision, reason_code, and reviewed_snapshot_json + hash

## Decision rules (Codex must self-check)
- If a UI asks the field worker to type sentences -> REJECT
- If AI output is saved as source of truth -> REJECT
- If approval does not store reviewed_snapshot_json + hash -> REJECT
- If a normal case requires manual editing -> REJECT
- If AI performs evaluation or judgement -> REJECT

## MVP scope (must be implemented first)
- Field UI: arrival/start/end (one tap each) + scope checklist + exception flags
- QA UI: approve / route to exception / return (reason required)
- Finance UI: pay ok / hold / return (reason required)
- Auto-generated "Execution Certificate" (fixed template; no evaluative words)

## AI usage policy
Allowed:
- Formatting / summarizing / template-fill ONLY
- Structured extraction for Sales (JSON output only)
Forbidden:
- Asking field workers guided questions to produce narratives
- Clean/dirty judgement, sufficiency judgement
- Auto-generating proposals as free text
- AI-based approvals (until logs accumulate and explicitly allowed)

## Data as source of truth
- DB truth is structured fields only.
- Free text is disabled by default and only allowed for exception notes (short, constrained).

## Engineering rules
- State transitions must be centralized (single source of truth).
- Returns should be logged as events (approval log), not only status overwrite.
- Any approval action must:
  1) build reviewed_snapshot_json
  2) compute snapshot hash
  3) write to approvals table
  4) then update main record status

## Output / acceptance
- Field input <= 3 minutes
- Normal case produces certificate without manual writing
- Exceptions always go through approval gate
- Approval logs are usable for payment evidence

## UI base (v2)
- **メイン UI** は `src/misogi`（v2）とする。
- 新規・改修は v2 を優先し、他ページは段階的にこのディレクトリに統合する。
- 本番 URL: `https://misesapo.co.jp/misogi/`。トップ＝Portal（ジョブ選択の玄関）。`/` で表示。

## Governance
- AGENTS.md and docs/spec/* are the top-level rules.
- Before finalizing any change, complete docs/spec/LINE_CHECKLIST.md.
- If a request conflicts with these rules, stop and explain the conflict.
- Any known conflicts in current code must be tracked in docs/spec/TODO_CONFLICTS.md with priority.
