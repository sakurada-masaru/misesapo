# FLOW_RULE Gap Priority (2026-02-08)

## Summary
- total missing combinations: `761`
- by role:
  - worker: `109`
  - op: `125`
  - admin: `96`
  - sales: `40`
  - accounting: `6`
  - owner: `385`

## Priority Order
1. worker / op の実運用導線（11-28）
2. admin の確認・請求導線（23-30）
3. sales の契約前後導線（1-9, 26-34）
4. accounting（29-32）
5. owner（最後に拡張）

## Top Gaps To Fill First
- op step 11: `ok,weather,staff,entry,late,contact,material,incident,complaint,system,no_show`
- op step 12: `ok,weather,staff,entry,late,contact,material,incident,complaint,system,no_show`
- op step 13: `ok,weather,staff,entry,late,contact,material,incident,complaint,system,no_show`
- op step 14: `ok,weather,staff,entry,late,contact,material,incident,complaint,system,no_show`
- op step 15: `ok,weather,staff,entry,late,contact,material,incident,complaint,system,no_show`
- worker step 13: `ok,weather,entry,late,contact,material,incident,system`
- worker step 14: `ok,weather,entry,late,contact,material,incident,system`
- worker step 15: `ok,weather,entry,late,contact,material,incident,system`
- worker step 20: `ok,weather,entry,late,contact,material,incident,system`
- worker step 21: `ok,weather,entry,late,contact,material,incident,system`
- worker step 22: `ok,weather,entry,late,contact,material,incident,system`
- worker step 23: `ok,weather,entry,late,contact,material,incident,system`
- worker step 24: `ok,weather,entry,late,contact,material,incident,system`
- worker step 25: `ok,weather,entry,late,contact,material,incident,system`
- worker step 26: `ok,weather,entry,late,contact,material,incident,system`
- worker step 27: `weather,entry,late,contact,material,incident,system`
- worker step 28: `ok,weather,entry,late,contact,material,incident,system`
- admin step 23: `ok,weather,staff,complaint,payment,incident,system`
- admin step 24: `ok,weather,staff,complaint,payment,incident,system`
- admin step 25: `ok,weather,staff,complaint,payment,incident,system`
- admin step 26: `ok,weather,staff,complaint,payment,incident,system`
- admin step 27: `weather,staff,payment,incident,system`
- admin step 28: `ok,weather,staff,complaint,payment,incident,system`
- admin step 29: `ok,weather,staff,complaint,payment,incident,system`
- admin step 30: `ok,weather,staff,complaint,payment,incident,system`
- sales step 1: `ok,complaint,contact`
- sales step 2: `ok,complaint,contact`
- sales step 3: `ok,complaint,contact`
- sales step 4: `ok,complaint,contact`
- sales step 5: `ok,complaint,contact`
- sales step 6: `ok,complaint,contact`
- sales step 7: `ok,complaint,contact`
- sales step 8: `ok,complaint,contact`
- sales step 9: `ok,complaint,contact`
- accounting step 29: `ok,payment`
- accounting step 30: `ok,payment`
- accounting step 32: `ok,payment`

## Implementation Policy Applied In UI
- unanswered options are not shown in `FlowGuideScreen`
- if no answerable item exists, user is prompted to go back and reselect
- role scope remains login-role locked
