# Yakusoku Credit / Yoshin Specification (v1.0)

## 0. Purpose

This document standardizes how MISOGI represents **monthly fixed-plan billing**,
**top-ups**, and **yoshin (credit/advance)** for regular cleaning contracts.

It is designed to align with the MISOGI domain layers:

`yakusoku -> shigoto -> yotei -> ugoki -> houkoku`

## 1. Definitions (Non-negotiable)

### 1.1 Contract Type

- `yakusoku.type = teiki` (regular contract)
- `yakusoku.type = tanpatsu` (spot / one-off)

### 1.2 Monthly Plan (Fixed Truth)

Regular cleaning plan is billed monthly (example):

- `plan_monthly_charge_yen = 50000`

Notes:

- `50000/600000` is only a *maximum theoretical annual total* (12 months).
- Actual cash collection is typically **monthly**.
- Lump-sum payment is allowed as an exception.

### 1.3 Validity / Cancel

- All records use `jotai: yuko | torikeshi`.
- DELETE is logical cancel (torikeshi); no physical delete.

## 2. Core Idea

We separate:

- **credit_balance**: money-equivalent credit that is already paid/secured
- **yoshin**: advance usage (front-borrow) allowed by policy, must be recovered within deadline

Regular plan charge (monthly 50,000) continues as the baseline truth.
Plan-external services may use:

1. top-up (preferred)
2. yoshin (advance) as last resort

## 3. Source of Truth by Layer

### 3.1 yakusoku (contract blueprint)

yakusoku defines:

- plan amount (monthly charge)
- what services are included (line items, frequency rules)
- which customer entity it belongs to (torihikisaki/yagou/tenpo)

### 3.2 shigoto (12/12 and monthly workload truth)

For `teiki`, we create **12 months worth of shigoto** at yakusoku creation time.

Why:

- "12/12 is filled" should be true **without** requiring schedule time allocation.
- `yotei` is for time/assignment and should not be bloated with future months.

Each `shigoto` must carry:

- `yakusoku_id`
- `target_month` (`YYYY-MM`)
- `sequence` (1..12) or deterministic month mapping
- `planned_cost_yen` (sum of planned service work for that month)

### 3.3 yotei (only monthly scheduling)

`yotei` exists only for **actual planned schedules** (time/worker assignment).

Rule:

- `yotei` should be created only for the current (or near) period.
- Auto-creation of `yotei` for all 12 months is not required and not recommended.

### 3.4 ugoki / houkoku

No changes for credit/yoshin logic.
They are downstream results.

## 4. Yoshin Policy (per customer, override supported)

### 4.1 Policy location

Yoshin policy is owned by customer entity:

- default: `torihikisaki`
- override: `yagou`
- override: `tenpo`

Resolution priority:

`tenpo override > yagou override > torihikisaki default`

### 4.2 Policy fields (minimum)

- `yoshin_limit_yen` (amount limit)
- `yoshin_max_days` (deadline; default 60)
- `jotai` (yuko/torikeshi)

Interpretation:

- `yoshin_max_days = 60` means: advance must be recovered within 60 days.
- Equivalent to “max 2 monthly cycles” in a monthly billing model.

## 5. Enforcement Rule: Plan Stop Gate (difference-maker)

If **advance is not recovered within deadline**, we stop the regular plan.

Stop condition (conceptually):

- `yoshin_used_yen > 0`
- and `now - oldest_yoshin_used_at > yoshin_max_days`

When stopped:

- regular plan operations are blocked (see 5.1)
- repayment/top-up operations remain allowed

### 5.1 What is blocked when stopped

At minimum:

- generation/activation of regular `shigoto` for upcoming months
- creation of new `yotei` under the regular plan

Optional:

- allow *spot* work (tanpatsu) only if separately paid/top-upped (policy choice)

## 6. Funding Options for Plan-external work

### 6.1 Preferred: top-up (special charge)

Use top-up to avoid advance:

- create a top-up request (billing)
- once paid/confirmed, increase credit_balance
- then create shigoto/yotei for the extra work

### 6.2 Last resort: yoshin (advance)

Advance creates `yoshin_used_yen` and starts deadline tracking.

Recovery methods:

- later top-up payment
- later monthly plan payment (policy-defined whether this is allowed to repay)

## 7. Ledgers (recommended for audit)

To keep everything explainable:

### 7.1 credit_ledger (money-equivalent credit)

Event types:

- `MONTHLY_GRANT` (after paid/confirmed monthly charge)
- `TOPUP_GRANT` (after paid/confirmed top-up)
- `CONSUME` (planned/locked to shigoto or executed completion; choose one)
- `ADJUST` (admin correction; reason required)

### 7.2 yoshin_ledger (advance)

Event types:

- `USE`
- `REPAY`
- `ADJUST`

Fields:

- `entity_type`: torihikisaki|yagou|tenpo
- `entity_id`
- `amount_yen`
- `reason_code` (required for USE/ADJUST)
- `ref` (yakusoku_id / shigoto_id / invoice_id)

## 8. UI Requirements (minimum)

In yakusoku detail:

- current month plan charge
- credit balance (paid)
- yoshin remaining (limit - used)
- oldest yoshin age (days)
- stop status (if stopped, show reason and required action)

When adding plan-external work:

- show shortage
- offer actions:
  - `Create top-up`
  - `Use yoshin` (reason required; shows deadline)

## 9. Open Decisions (explicit)

1. Trigger for monthly credit grant:
   - recommended: on `paid` confirmation (safer)
   - optional: on invoice issue, then stop on delinquency (riskier)
2. When stop is active:
   - should spot (tanpatsu) still be allowed?
3. Repayment priority:
   - recommended: repay `yoshin` first, then add to credit_balance

