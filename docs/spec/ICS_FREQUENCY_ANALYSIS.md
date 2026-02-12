# ICS Frequency Analysis (v1)
- Source: `/Users/sakuradamasaru/Downloads/basic.ics`
- Events parsed: 1629
- Stores detected (by SUMMARY/LOCATION heuristic): 91

## Focus: グリストラップ（洗浄）
This answers: 'Is grist trap cleaning likely monthly baseline across stores?'

- Coverage CSV: `docs/spec/ICS_GRISTTRAP_BY_STORE.csv`

### Heuristic
- A store-month is counted as 'has grist trap' if any event description includes `グリストラップ` or `グリスト`.
- `months_with_any` counts distinct `YYYY-MM` months with at least one (filtered) event.

### Stores that look 'monthly-like' for grist trap
Criteria: ratio >= 0.85 AND months_with_any >= 6

- Count: 0

Top 20:

## Other keyword signals (rough)
Counts across extracted menu lines (rough, not normalized):

- エアコン: 299
- グリストラップ: 240
- レンジフード: 206
- 害虫: 138
- ダクト: 38
- グリスフィルター: 36
- 床ポリッシャー: 30
- ゴキ: 8

## Notes / Limits
- Store name extraction is heuristic; some events may merge/split stores incorrectly.
- DESCRIPTION may contain HTML; we strip tags and look for keywords and bullet lines.
- This is analysis-only and does not import to MISOGI.
