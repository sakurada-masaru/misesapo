# Intelligent Report Wizard Enhancement Plan (for Opus 4.5)

## Objective
Implement a "Button-First" AI-powered report wizard that learns from past reports (RAG) and provides high-quality previews.

## Current Successful Plan (Logic only)
### 1. Backend: RAG Integration
- **Action**: `admin_concierge`
- **Data Source**: DynamoDB `staff-reports` table.
- **Logic**: Fetch the 3 most recent reports for a given `store_id`.
- **Injection**: Convert reports to a compact string context and inject into the Gemini System Instruction.
- **Instruction**: Tell the AI to analyze these past trends to suggest high-quality comments for the current work.

### 2. Frontend: State Machine Wizard
- **State**: `reportWizardState` (step, store, schedule, photos, target, notes, nextProposal).
- **Flow**: 
  1. Store/Schedule selection -> Triggers background `sendSilentAiRequest` with `store_id`.
  2. Photo Upload (Before/After).
  3. Cleaning Target selection -> Triggers `sendTextMessage(target_name)`.
  4. AI suggests comments -> AI returns `show_options`.
  5. Staff selects/edits comment.
  6. Next Proposal selection.
  7. **Preview Stage**: Show a high-quality overlay before final submission.

### 3. UI/UX Refinement
- **CSS**: Glassmorphism overlay for the preview.
- **CSS Hierarchy**: Ensure modal styles are at root level (not nested inside buttons containers).
- **Buttons**: Use the `.attendance-btn` style for consistency.

## Implementation Notes & Risks
- **Hook Integrity**: When intercepting `sendTextMessage`, ensure it can handle programmatic calls (with arguments) vs manual user typing.
- **Function Persistence**: Do not accidentally delete core helper functions like `handleReportPhotoUpload` or `submitReport` during refactoring.
- **State Cleanup**: Always reset the `reportWizardState` and `window.reportWizardInputMode` after submission.
