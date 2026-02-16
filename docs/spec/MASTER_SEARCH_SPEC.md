# Master Search Specification (Torihikisaki / Yagou / Tenpo)

Date: 2026-02-15

## Purpose
Make master-data lookup robust and unambiguous for operations.

Key pain points addressed:
- "Search doesn't hit" due to full/half width, punctuation, whitespace variations.
- "Entities get mixed" (torihikisaki/yagou/tenpo confusion) causing mis-selection.
- Field staff cannot identify a site by store-name alone ("Shinjuku store" ambiguity).

## Domain Definitions (non-negotiable)
- **torihikisaki**: legal / billing entity (payer).
- **yagou**: brand / business name (what on-site staff usually remember).
- **tenpo**: physical site / store (execution location).

## Source of Truth & Join Keys
- **All joins MUST use IDs**, never names.
- Canonical relationships:
  - `yagou.torihikisaki_id` required
  - `tenpo.torihikisaki_id` required
  - `tenpo.yagou_id` required
- UI selection must **always** end at `tenpo_id` (store/site).
  - Names (`tenpo_name`, `yagou_name`, `torihikisaki_name`) are display caches only.

## Search UX Requirements
### Unified Search Input
Single search box. Same UI across roles, but results can be ranked differently.

### Robust Normalization
Search must be resilient to:
- NFKC (full/half width)
- spaces (including Japanese full-width space)
- punctuation (`#`, `-`, `・`, etc.)

### Result Card Must Be Identifiable
Every store hit must show:
- `torihikisaki_name / yagou_name / tenpo_name`
- address (recommended: always show if available)
- phone (if available)
- map URL (if available)
- `TENPO#...` (ID)

### Default Experience: Brand -> Stores ("屋号でズラッと")
For typical on-site lookup:
1. User enters brand (yagou name)
2. Search results group by `torihikisaki / yagou`
3. Under each group, list all matching stores
4. Store selection uses `tenpo_id`

## Role Intent (guidance)
This is a ranking/preset guide, not separate UIs.

### Cleaning / Field
Intent: avoid wrong site; confirm address quickly.
- Primary input: **yagou name**
- Confirmation: **address**
- Selection: **tenpo_id**

### Office / HQ Operations
Intent: find brand, then payer, then store detail for invoicing.
- Primary input: **yagou name**
- Secondary: torihikisaki name / ID
- Confirmation: address / phone
- Selection: **tenpo_id**

### Sales
Intent: create/extend master data; onboarding.
- Primary input: yagou or torihikisaki
- If not found: strong CTA to create new torihikisaki/yagou/tenpo (separate flows)
- Selection: tenpo_id (when the store exists)

## Query Type Detection (ranking)
Implementation should detect query "kind" and adjust scoring:
- `id`: contains `TENPO#` / `YAGOU#` / `TORI#` or looks like an ID-like token
- `phone`: digits-only (9+)
- `address`: contains `〒` or typical address Kanji markers
- `brand` (default): everything else

Ranking target:
- `brand`: prioritize yagou match, then address, then tenpo name
- `address`: prioritize address match
- `phone`: prioritize phone match
- `id`: prioritize ID match

## Implementation (Current: Client-Side Search Index)
Current v1 implementation loads master lists and searches in-browser.

Pros:
- fast to implement
- no backend changes required

Cons:
- scales poorly with larger datasets (scan cost + large transfer)

## Future Implementation (Recommended): Server Search API
Add a dedicated endpoint:
- `GET /master/tenpo/search?q=...&limit=50`

Response:
- `items[]` of **tenpo** only, with parent names included
- `count`

This keeps selection unambiguous while remaining identifiable.

## Acceptance Checks
1. Searching by brand shows groups and multiple stores under the brand.
2. Searching by address finds the correct store even when store name is ambiguous.
3. Searching by ID returns the exact store at top.
4. Clicking a hit always yields a concrete `tenpo_id` for downstream flows.

